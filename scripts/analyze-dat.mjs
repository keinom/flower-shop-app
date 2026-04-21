#!/usr/bin/env node
// a.dat（Btrieve）→ 顧客レコード抽出（改訂版）
//
// 方針:
//   - 675 byte レコードの「連鎖」を検出してデータレコードだけ抜き出す
//   - 各レコードから: code, 名称, 郵便番号, 住所, 電話, FAX を推定

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import iconv from "iconv-lite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAT_PATH = path.join(ROOT, "data", "import", "a.dat");
const OUT_PATH = path.join(ROOT, "data", "import", "a-dat-records.json");

const RECORD_LEN = 675;

function decode(bytes) {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x00 || bytes[end - 1] === 0x20)) end--;
  return iconv
    .decode(Buffer.from(bytes.slice(0, end)), "shift_jis")
    .replace(/\u0000+/g, "")
    .trim();
}

function isCodeAt(buf, i) {
  if (i + 5 > buf.length) return false;
  for (let k = 0; k < 5; k++) {
    const c = buf[i + k];
    if (c < 0x30 || c > 0x39) return false;
  }
  if (i > 0 && buf[i - 1] >= 0x30 && buf[i - 1] <= 0x39) return false;
  if (i + 5 < buf.length && buf[i + 5] >= 0x30 && buf[i + 5] <= 0x39) return false;
  return true;
}

// 印字可能テキストのセグメントに分割
function extractSegments(buf) {
  const segments = [];
  let start = -1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const printable =
      (b >= 0x20 && b <= 0x7e) ||
      (b >= 0x81 && b <= 0x9f) ||
      (b >= 0xa0 && b <= 0xfc);
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= 2) {
        segments.push({ off: start, text: decode(buf.slice(start, i)) });
      }
      start = -1;
    }
  }
  if (start !== -1 && buf.length - start >= 2) {
    segments.push({ off: start, text: decode(buf.slice(start, buf.length)) });
  }
  return segments;
}

const buf = readFileSync(DAT_PATH);
console.log(`file size: ${buf.length}`);

// Step 1: 675 byte 連鎖を検出してレコード先頭位置を得る
// code 位置 i に対して i+675 にも code が居るか？ さらに i+1350 にも？
const recordStarts = new Set();
for (let i = 0; i + RECORD_LEN * 2 < buf.length; i++) {
  if (!isCodeAt(buf, i)) continue;
  if (!isCodeAt(buf, i + RECORD_LEN)) continue;
  // 最低2連鎖あればその両方をレコード先頭とみなす
  recordStarts.add(i);
  recordStarts.add(i + RECORD_LEN);
  if (isCodeAt(buf, i + RECORD_LEN * 2)) recordStarts.add(i + RECORD_LEN * 2);
}
console.log(`record starts: ${recordStarts.size}`);

// Step 2: 各レコードをパース
const records = [];
for (const off of [...recordStarts].sort((a, b) => a - b)) {
  const rec = buf.slice(off, off + RECORD_LEN);
  const code = decode(rec.slice(0, 5));
  if (!/^\d{5}$/.test(code)) continue;
  const segments = extractSegments(rec);
  records.push({ offset: off, code, segments });
}
console.log(`parsed records: ${records.length}`);

const byCode = new Map();
for (const r of records) {
  if (!byCode.has(r.code)) byCode.set(r.code, []);
  byCode.get(r.code).push(r);
}
console.log(`unique codes: ${byCode.size}`);

// Sample
for (const code of ["00101", "00001", "00100", "00200", "01000"]) {
  const r = byCode.get(code);
  if (!r) continue;
  console.log(`\n=== ${code} (offset 0x${r[0].offset.toString(16)}, ${r.length} dup) ===`);
  for (const seg of r[0].segments) {
    if (seg.text.length >= 2) console.log(`  +${seg.off}: ${JSON.stringify(seg.text)}`);
  }
}

writeFileSync(OUT_PATH, JSON.stringify(records, null, 2));
console.log(`\nwrote ${OUT_PATH} (${records.length} records)`);
