#!/usr/bin/env node
// f.dat → 注文明細レコード抽出
//
// レコード長: 361 bytes
// 構造（推定）:
//   +0   : 01 00 (prefix)
//   +2   : 受注日 YYYYMMDD (8)
//   +10  : 注文No 7桁
//   +17  : サブキー 8桁
//   +25  : 01 1c マーカー (2)
//   +27  : 得意先コード 5桁
//   +37  : 請求先コード 5桁 (通常同じ)
//   +60  : 商品コード 3桁
//   +86  : 商品名/区分名 SJIS
//   +118 : 立て札・届け先名1 SJIS
//   +150 : 立て札・届け先名2 SJIS
//
// オフセットはレコード抽出後にサンプリングで詰める

import { readFileSync, writeFileSync } from "node:fs";
import iconv from "iconv-lite";

const RECORD_LEN = 361;
const buf = readFileSync("data/import/f.dat");
const N = buf.length;

// 01 00 + 15digit（YYYYMMDD+7digit通番）の出現位置
function findKeys() {
  const offsets = [];
  for (let i = 2; i + 17 < N; i++) {
    if (buf[i - 2] !== 0x01 || buf[i - 1] !== 0x00) continue;
    const c0 = buf[i];
    if (c0 !== 0x31 && c0 !== 0x32) continue;
    const c1 = buf[i + 1];
    if (c0 === 0x31 && c1 !== 0x39) continue;
    if (c0 === 0x32 && c1 !== 0x30) continue;
    let ok = true;
    for (let k = 2; k < 15; k++) {
      const c = buf[i + k];
      if (c < 0x30 || c > 0x39) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const m = parseInt(buf.slice(i + 4, i + 6).toString());
    const d = parseInt(buf.slice(i + 6, i + 8).toString());
    if (m < 1 || m > 12 || d < 1 || d > 31) continue;
    offsets.push(i);
  }
  return offsets;
}

// 361連鎖する先頭位置（データページ内レコード）を抽出
function findDataRecords(keyOffsets) {
  const set = new Set(keyOffsets);
  const result = new Set();
  for (const o of keyOffsets) {
    if (set.has(o + RECORD_LEN)) {
      result.add(o);
      result.add(o + RECORD_LEN);
    }
  }
  return [...result].sort((a, b) => a - b);
}

// SJIS デコード（NUL終端 / 後方空白トリム）
function sjis(bytes) {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x00 || bytes[end - 1] === 0x20)) end--;
  if (end === 0) return "";
  return iconv
    .decode(Buffer.from(bytes.slice(0, end)), "shift_jis")
    .replace(/\u0000+/g, "")
    .trim();
}

// 数字のみフィールド
function digits(bytes) {
  let end = 0;
  while (end < bytes.length && bytes[end] >= 0x30 && bytes[end] <= 0x39) end++;
  return end > 0 ? bytes.slice(0, end).toString() : "";
}

// レコードから印字可能テキストセグメント抽出
function extractSegments(rec, startAt = 27) {
  const segments = [];
  let start = -1;
  for (let i = startAt; i < rec.length; i++) {
    const b = rec[i];
    // SJIS 2バイト先頭 / ASCII可視 / 半角カナ
    const printable =
      (b >= 0x20 && b <= 0x7e) ||
      (b >= 0x81 && b <= 0x9f) ||
      (b >= 0xa0 && b <= 0xfc);
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= 2) {
        const text = sjis(rec.slice(start, i));
        if (text) segments.push({ off: start, text });
      }
      start = -1;
    }
  }
  if (start !== -1 && rec.length - start >= 2) {
    const text = sjis(rec.slice(start, rec.length));
    if (text) segments.push({ off: start, text });
  }
  return segments;
}

console.log(`file: ${N} bytes`);
const keyOffsets = findKeys();
console.log(`keys: ${keyOffsets.length}`);
const recOffsets = findDataRecords(keyOffsets);
console.log(`data records (361-chain): ${recOffsets.length}`);

// パース
const lines = [];
for (const off of recOffsets) {
  const rec = buf.slice(off, off + RECORD_LEN);
  const orderDate = rec.slice(0, 8).toString(); // YYYYMMDD
  const orderNo = rec.slice(8, 15).toString(); // 7桁
  const subKey = rec.slice(15, 23).toString(); // 8桁
  // 得意先コード (offset +25 after 01 1c, so +27 in record aligned at key offset)
  // Our offsets are relative to key (after 01 00), not the 01 00 itself
  // So key is at 0..15, then subkey 15..23, then 01 1c at 23..25, then customer code 25..30
  const custCode = rec.slice(25, 30).toString();
  const billCode = rec.slice(35, 40).toString();
  // product/purpose code near +60
  // 全テキストセグメントを拾う
  const segs = extractSegments(rec, 25);
  lines.push({
    offset: off,
    order_date: orderDate,
    order_no: orderNo,
    sub_key: subKey,
    customer_code: custCode,
    bill_code: billCode,
    segments: segs,
  });
}

// dedupe: (order_date, order_no, sub_key) で一意化
const map = new Map();
for (const l of lines) {
  const k = `${l.order_date}-${l.order_no}-${l.sub_key}`;
  if (!map.has(k)) map.set(k, l);
}
const unique = [...map.values()];
console.log(`unique lines (by date+no+sub): ${unique.length}`);

const uniqueOrders = new Set(unique.map((l) => `${l.order_date}-${l.order_no}`));
console.log(`unique orders: ${uniqueOrders.size}`);

// サンプル: 最初の5行
console.log("\nfirst 3 lines:");
for (const l of unique.slice(0, 3)) {
  console.log(`  ${l.order_date}/${l.order_no}/${l.sub_key} cust=${l.customer_code}`);
  for (const s of l.segments) console.log(`    +${s.off}: ${JSON.stringify(s.text)}`);
}

// 有名な化けオーダーの注文を探す: customer_code=13000 (NHK長崎文化センター) などで絞る
console.log("\nsample for cust 13000 (NHK長崎):");
const sample = unique.filter((l) => l.customer_code === "13000").slice(0, 3);
for (const l of sample) {
  console.log(`  ${l.order_date}/${l.order_no}/${l.sub_key}`);
  for (const s of l.segments) console.log(`    +${s.off}: ${JSON.stringify(s.text)}`);
}

writeFileSync("data/import/f-dat-lines.json", JSON.stringify(unique));
console.log(`\nwrote data/import/f-dat-lines.json (${unique.length} records)`);
