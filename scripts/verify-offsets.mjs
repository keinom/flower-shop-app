import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const buf = readFileSync("data/import/e.dat");
const REC = 659;
const { recOffs, keys } = JSON.parse(readFileSync("data/import/e-dat-offsets.tmp.json", "utf8"));
const keyAllOffs = new Map();
for (let i = 0; i < keys.length; i++) {
  if (!keyAllOffs.has(keys[i])) keyAllOffs.set(keys[i], []);
  keyAllOffs.get(keys[i]).push(recOffs[i]);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function fetchAll() {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from("orders")
      .select("total_amount, remarks")
      .eq("status", "履歴")
      .gt("total_amount", 0)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const nz = await fetchAll();
console.log("fetched:", nz.length);

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
      if (lo === 0xc || lo === 0xf) return parseInt(s, 10);
      if (lo === 0xd) return -parseInt(s, 10);
      return null;
    }
  }
  return null;
}

let exact = 0, offByOne = 0, offByMore = 0, nullDecode = 0, noOff = 0;
const diffs = new Map();
const samples = [];
for (const o of nz) {
  const m = o.remarks.match(/【旧伝票キー:\s*(\d{21})】/);
  if (!m) continue;
  const offs = keyAllOffs.get(m[1]);
  if (!offs) { noOff++; continue; }
  // take first offset (most records have exactly one)
  const off = offs[0];
  const rec = buf.slice(off, off + REC);
  const a = readPacked(rec, 77, 6);
  const b = readPacked(rec, 101, 6);
  if (a === null || b === null) { nullDecode++; continue; }
  const predicted = Math.floor((a + b) / 10);
  const diff = predicted - o.total_amount;
  diffs.set(diff, (diffs.get(diff) || 0) + 1);
  if (diff === 0) exact++;
  else if (Math.abs(diff) === 1) offByOne++;
  else { offByMore++; if (samples.length < 15) samples.push({ key: m[1], a, b, sum: a+b, predicted, db: o.total_amount, diff }); }
}
console.log(`exact=${exact}  offBy1=${offByOne}  offByMore=${offByMore}  nullDecode=${nullDecode}  noOff=${noOff}`);
const top = [...diffs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15);
console.log("top diffs (predicted - db):");
for (const [d, c] of top) console.log(" ", d, ":", c);
console.log("offByMore samples:");
for (const s of samples) console.log(" ", s);
