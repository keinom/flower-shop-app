#!/usr/bin/env node
// a.dat → 顧客マスター CSV 相当の JSON を抽出
// フィールド配置（675 byte レコード内）:
//   +0  : 得意先コード (5)
//   +20 : 得意先名
//   +80 : 郵便番号 (XXX-XXXX)
//   +90 : 住所
//   +150: 電話番号
//   +165: FAX

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import iconv from "iconv-lite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAT_PATH = path.join(ROOT, "data", "import", "a.dat");
const OUT_PATH = path.join(ROOT, "data", "import", "a-dat-clean.json");

const RECORD_LEN = 675;

function sliceField(rec, start, maxLen) {
  // 指定オフセットから最大 maxLen バイト、NUL/空白で終端
  let end = start;
  const limit = Math.min(start + maxLen, rec.length);
  while (end < limit) {
    const b = rec[end];
    if (b === 0x00) break;
    end++;
  }
  return iconv
    .decode(Buffer.from(rec.slice(start, end)), "shift_jis")
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

const buf = readFileSync(DAT_PATH);

// 675 連鎖で先頭を検出
const recordStarts = new Set();
for (let i = 0; i + RECORD_LEN * 2 < buf.length; i++) {
  if (!isCodeAt(buf, i)) continue;
  if (!isCodeAt(buf, i + RECORD_LEN)) continue;
  recordStarts.add(i);
  recordStarts.add(i + RECORD_LEN);
  if (isCodeAt(buf, i + RECORD_LEN * 2)) recordStarts.add(i + RECORD_LEN * 2);
}

const byCode = new Map();
for (const off of [...recordStarts].sort((a, b) => a - b)) {
  const rec = buf.slice(off, off + RECORD_LEN);
  const code = sliceField(rec, 0, 5);
  if (!/^\d{5}$/.test(code)) continue;

  const name = sliceField(rec, 20, 60);
  const postal_raw = sliceField(rec, 80, 10);
  const address = sliceField(rec, 90, 60);
  const phone = sliceField(rec, 150, 15);
  const fax = sliceField(rec, 165, 15);

  // 郵便番号の正規化
  let postal_code = null;
  const pm = postal_raw.match(/^(\d{3})-?(\d{4})$/);
  if (pm) postal_code = `${pm[1]}-${pm[2]}`;

  const entry = { code, name, postal_code, address, phone, fax, offset: off };
  if (!byCode.has(code)) {
    byCode.set(code, entry);
  } else {
    // 既存より情報量が多ければ差し替え
    const prev = byCode.get(code);
    const score = (e) =>
      (e.name?.length ?? 0) +
      (e.postal_code ? 10 : 0) +
      (e.address?.length ?? 0) +
      (e.phone?.length ?? 0);
    if (score(entry) > score(prev)) byCode.set(code, entry);
  }
}

const customers = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
writeFileSync(OUT_PATH, JSON.stringify(customers, null, 2));
console.log(`extracted ${customers.length} unique customers → ${OUT_PATH}`);

// サンプル表示
console.log("\nfirst 8:");
for (const c of customers.slice(0, 8)) console.log(c);
console.log("\n00101:", byCode.get("00101"));
// 問題の14顧客を確認（NHK長崎など）
for (const c of customers) {
  if (c.name && c.name.includes("NHK長崎")) console.log("NHK:", c);
}
