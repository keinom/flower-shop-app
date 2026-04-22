#!/usr/bin/env node
// f.dat の 361-byte レコードで、金額フィールドがどこにあるか推定する
// 既知: orders で total_amount > 0 のレコードと = 0 のレコードのキーを突き合わせ、
//       f.dat レコードの数値フィールドで傾向差があるオフセットを探す。

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const RECORD_LEN = 361;
const buf = readFileSync("data/import/f.dat");

// f-dat-lines.json を読み、order_date-order_no でインデックス
const lines = JSON.parse(readFileSync("data/import/f-dat-lines.json", "utf8"));
const byOrder = new Map();
for (const l of lines) {
  const k = `${l.order_date}-${l.order_no}`;
  if (!byOrder.has(k)) byOrder.set(k, []);
  byOrder.get(k).push(l);
}
console.log(`f.dat orders: ${byOrder.size}, lines: ${lines.length}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// 旧伝票キーの先頭15桁から (YYYYMMDD, order_no) を抽出
function parseKey(remarks) {
  const m = remarks?.match(/【旧伝票キー:\s*(\d{8})(\d{7})/);
  return m ? { date: m[1], no: m[2] } : null;
}

async function fetchSample(amountZero, limit = 50) {
  const q = supabase
    .from("orders")
    .select("total_amount, remarks")
    .eq("status", "履歴")
    .limit(limit);
  const { data } = amountZero
    ? await q.eq("total_amount", 0)
    : await q.gt("total_amount", 0);
  return data ?? [];
}

function findLineBytes(dateNo) {
  // 1 order key の先頭レコード(オフセット)を使う
  const ls = byOrder.get(dateNo);
  if (!ls) return null;
  // 最初のライン(先頭ヘッダ相当)を返す
  return ls[0];
}

function readBE(rec, off, len) {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 256 + rec[off + i];
  return v;
}
function readLE(rec, off, len) {
  let v = 0;
  for (let i = len - 1; i >= 0; i--) v = v * 256 + rec[off + i];
  return v;
}

async function main() {
  const zeros = await fetchSample(true, 200);
  const nonz  = await fetchSample(false, 200);
  console.log(`DB samples: zero=${zeros.length}, nonzero=${nonz.length}`);

  const zeroHits = [];
  const nonzHits = [];
  for (const o of zeros) {
    const k = parseKey(o.remarks);
    if (!k) continue;
    const line = findLineBytes(`${k.date}-${k.no}`);
    if (!line) continue;
    const rec = buf.slice(line.offset, line.offset + RECORD_LEN);
    zeroHits.push({ rec, db: o });
  }
  for (const o of nonz) {
    const k = parseKey(o.remarks);
    if (!k) continue;
    const line = findLineBytes(`${k.date}-${k.no}`);
    if (!line) continue;
    const rec = buf.slice(line.offset, line.offset + RECORD_LEN);
    nonzHits.push({ rec, db: o });
  }
  console.log(`f.dat matched: zero=${zeroHits.length}, nonzero=${nonzHits.length}`);

  // 全オフセットで、非0側の平均/中央値が明らかに高く、0側はほぼ一様、という列を探す
  // 数値っぽさ: BE/LE 4バイト整数で 0..10,000,000 の範囲
  const offs = [];
  for (let off = 30; off <= RECORD_LEN - 4; off++) {
    const zs = zeroHits.map(({ rec }) => readBE(rec, off, 4));
    const ns = nonzHits.map(({ rec }) => readBE(rec, off, 4));
    const zMax = Math.max(...zs, 0);
    const nMax = Math.max(...ns, 0);
    const nMedian = [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] ?? 0;
    // 非0側で「常識的な金額範囲」にあり、0側は常にずっと小さい
    if (nMedian >= 1000 && nMedian <= 1_000_000 && zMax < nMedian / 4) {
      offs.push({ off, enc: "BE", nMedian, zMax, nMax });
    }
  }
  // LE もチェック
  for (let off = 30; off <= RECORD_LEN - 4; off++) {
    const zs = zeroHits.map(({ rec }) => readLE(rec, off, 4));
    const ns = nonzHits.map(({ rec }) => readLE(rec, off, 4));
    const zMax = Math.max(...zs, 0);
    const nMax = Math.max(...ns, 0);
    const nMedian = [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] ?? 0;
    if (nMedian >= 1000 && nMedian <= 1_000_000 && zMax < nMedian / 4) {
      offs.push({ off, enc: "LE", nMedian, zMax, nMax });
    }
  }
  // ASCII 数字列もチェック（価格が 10文字程度の 0 埋め数字で入っているケース）
  for (let off = 30; off <= RECORD_LEN - 10; off++) {
    let allDigitsOrSpace = true;
    for (let i = 0; i < 10; i++) {
      const b = zeroHits[0]?.rec[off + i];
      if (b === undefined) { allDigitsOrSpace = false; break; }
      if (!((b >= 0x30 && b <= 0x39) || b === 0x20)) { allDigitsOrSpace = false; break; }
    }
    if (!allDigitsOrSpace) continue;
    const parseAt = (rec) => parseInt(rec.slice(off, off + 10).toString().trim(), 10) || 0;
    const zs = zeroHits.map(({ rec }) => parseAt(rec));
    const ns = nonzHits.map(({ rec }) => parseAt(rec));
    const nMedian = [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] ?? 0;
    const zMax = Math.max(...zs, 0);
    if (nMedian >= 1000 && nMedian <= 1_000_000 && zMax < nMedian / 4) {
      offs.push({ off, enc: "ASCII10", nMedian, zMax });
    }
  }

  console.log("\n=== Candidate offsets (non-zero side has amount-like values, zero side doesn't) ===");
  for (const c of offs.slice(0, 15)) console.log(c);

  // 参考: 0hit と nonzerohit それぞれの +30〜+180 領域を16進ダンプで表示
  console.log("\n=== Sample zero-hit record (hex, +30..+200) ===");
  if (zeroHits[0]) {
    const rec = zeroHits[0].rec;
    console.log(`DB total_amount=${zeroHits[0].db.total_amount}`);
    for (let off = 30; off < 200; off += 20) {
      const hex = [...rec.slice(off, off + 20)].map(b => b.toString(16).padStart(2, "0")).join(" ");
      console.log(`  +${off}: ${hex}`);
    }
  }
  console.log("\n=== Sample nonzero-hit record (hex, +30..+200) ===");
  if (nonzHits[0]) {
    const rec = nonzHits[0].rec;
    console.log(`DB total_amount=${nonzHits[0].db.total_amount}`);
    for (let off = 30; off < 200; off += 20) {
      const hex = [...rec.slice(off, off + 20)].map(b => b.toString(16).padStart(2, "0")).join(" ");
      console.log(`  +${off}: ${hex}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
