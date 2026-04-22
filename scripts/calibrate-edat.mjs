import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const buf = readFileSync("data/import/e.dat");
const REC = 659;
const { recOffs, keys } = JSON.parse(readFileSync("data/import/e-dat-offsets.tmp.json", "utf8"));

const keyToOff = new Map();
for (let i = 0; i < keys.length; i++) {
  if (!keyToOff.has(keys[i])) keyToOff.set(keys[i], recOffs[i]);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: nz } = await sb.from("orders")
  .select("total_amount, remarks")
  .eq("status", "履歴")
  .gt("total_amount", 1000)
  .limit(50);

const samples = [];
for (const o of nz) {
  const m = o.remarks?.match(/【旧伝票キー:\s*(\d{21})】/);
  if (!m) continue;
  const off = keyToOff.get(m[1]);
  if (off === undefined) continue;
  samples.push({ total: o.total_amount, rec: buf.slice(off, off + REC), key: m[1] });
}
console.log("samples:", samples.length);

function readPacked(rec, off, len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    const b = rec[off + i];
    const hi = (b >> 4) & 0xf, lo = b & 0xf;
    if (i < len - 1) {
      if (hi > 9 || lo > 9) return null;
      s += hi.toString() + lo.toString();
    } else {
      if (hi > 9) return null;
      s += hi.toString();
      const sign = lo;
      if (sign === 0xc || sign === 0xf) return parseInt(s, 10);
      if (sign === 0xd) return -parseInt(s, 10);
      return null;
    }
  }
  return null;
}

// For each sample, scan record for offsets/lengths where packed decimal decodes to `total`.
// Print offset frequencies across samples.
const lenTry = [3, 4, 5, 6];
const offFreq = new Map(); // key: `${len}@${off}` -> count (where decoded == total)
for (const s of samples) {
  for (const len of lenTry) {
    for (let off = 23; off <= REC - len; off++) {
      const v = readPacked(s.rec, off, len);
      if (v === s.total && v > 0) {
        const k = `${len}@${off}`;
        offFreq.set(k, (offFreq.get(k) || 0) + 1);
      }
    }
  }
}
const top = [...offFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 25);
console.log("top offsets where packed == total:");
for (const [k, c] of top) console.log(" ", k, "hits:", c);

// Also find offset pairs where A+B == total
// Collect, for each sample, the set of (off,len) combinations where packed value > 0
const pairFreq = new Map();
for (const s of samples) {
  const values = [];
  for (const len of lenTry) {
    for (let off = 23; off <= REC - len; off++) {
      const v = readPacked(s.rec, off, len);
      if (v !== null && v >= 0 && v <= 10_000_000) values.push({ off, len, v });
    }
  }
  // pair combinations
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (i === j) continue;
      const a = values[i], b = values[j];
      if (a.off < b.off && a.v + b.v === s.total) {
        const k = `${a.len}@${a.off}+${b.len}@${b.off}`;
        pairFreq.set(k, (pairFreq.get(k) || 0) + 1);
      }
    }
  }
}
const topPairs = [...pairFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 20);
console.log("\ntop A+B==total pairs:");
for (const [k, c] of topPairs) console.log(" ", k, "hits:", c);
