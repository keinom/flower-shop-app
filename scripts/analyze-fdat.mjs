#!/usr/bin/env node
// f.dat の構造推定
import { readFileSync } from "node:fs";
import iconv from "iconv-lite";

const buf = readFileSync("data/import/f.dat");
console.log(`size: ${buf.length}, pages: ${buf.length / 4096}`);

// ページヘッダ先頭4バイトの頻度集計
const pageTypes = new Map();
for (let p = 0; p < buf.length; p += 4096) {
  const sig = buf.slice(p, p + 4).toString("hex");
  pageTypes.set(sig, (pageTypes.get(sig) ?? 0) + 1);
}
console.log("page headers (first 4 bytes):");
for (const [sig, n] of [...pageTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${sig}: ${n}`);
}

// 5桁コード候補の出現密度（先頭 4MB だけ調べる）
function isCode(buf, i) {
  if (i + 5 > buf.length) return false;
  for (let k = 0; k < 5; k++) {
    const c = buf[i + k];
    if (c < 0x30 || c > 0x39) return false;
  }
  if (i > 0 && buf[i - 1] >= 0x30 && buf[i - 1] <= 0x39) return false;
  if (i + 5 < buf.length && buf[i + 5] >= 0x30 && buf[i + 5] <= 0x39) return false;
  return true;
}

const scanEnd = Math.min(buf.length, 4 * 1024 * 1024);
const codeOffsets = [];
for (let i = 0; i < scanEnd; i++) if (isCode(buf, i)) codeOffsets.push(i);
console.log(`\n5-digit codes in first 4MB: ${codeOffsets.length}`);

// 差分ヒストグラム
const diffs = new Map();
for (let i = 1; i < codeOffsets.length; i++) {
  const d = codeOffsets[i] - codeOffsets[i - 1];
  if (d < 2000) diffs.set(d, (diffs.get(d) ?? 0) + 1);
}
const topDiff = [...diffs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log("code-offset diff top10 (<2000):", topDiff);

// 最初の 5 レコードっぽい位置の前後 80 bytes を SJIS で覗く
console.log("\nsample raw text around first codes:");
for (let i = 0; i < Math.min(5, codeOffsets.length); i++) {
  const off = codeOffsets[i];
  const win = buf.slice(Math.max(0, off - 8), Math.min(buf.length, off + 120));
  const dec = iconv
    .decode(Buffer.from(win), "shift_jis")
    .replace(/[\x00-\x08\x0b-\x1f]/g, ".");
  console.log(`  off 0x${off.toString(16)}: ${JSON.stringify(dec)}`);
}

// キーコード (受注日YYYYMMDD) らしき 8桁数字の出現も探す
function isDate8(buf, i) {
  if (i + 8 > buf.length) return false;
  for (let k = 0; k < 8; k++) {
    const c = buf[i + k];
    if (c < 0x30 || c > 0x39) return false;
  }
  if (i > 0 && buf[i - 1] >= 0x30 && buf[i - 1] <= 0x39) return false;
  if (i + 8 < buf.length && buf[i + 8] >= 0x30 && buf[i + 8] <= 0x39) return false;
  // YYYYMMDD 妥当性
  const y = parseInt(buf.slice(i, i + 4).toString());
  const m = parseInt(buf.slice(i + 4, i + 6).toString());
  const d = parseInt(buf.slice(i + 6, i + 8).toString());
  return y >= 1995 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

const dateOffsets = [];
for (let i = 0; i < scanEnd; i++) if (isDate8(buf, i)) dateOffsets.push(i);
console.log(`\nYYYYMMDD candidates in first 4MB: ${dateOffsets.length}`);
if (dateOffsets.length >= 3) {
  const ddiffs = new Map();
  for (let i = 1; i < dateOffsets.length; i++) {
    const d = dateOffsets[i] - dateOffsets[i - 1];
    if (d < 2000) ddiffs.set(d, (ddiffs.get(d) ?? 0) + 1);
  }
  console.log("date diff top5:", [...ddiffs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));
}
