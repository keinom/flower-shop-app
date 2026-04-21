/**
 * 最小CSVパーサ (RFC 4180 相当)
 * - UTF-8 BOM 除去
 * - ダブルクォート内のカンマ・改行・"" エスケープをサポート
 * 移行データ用途。大容量CSVでも使えるストリーミング版も同梱。
 */

import { createReadStream } from "node:fs";

/** 文字列全体をパースして行配列を返す（小〜中サイズ用） */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (ch === "\r") {
        // 次が \n ならまとめてスキップ
        if (text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        field = "";
        row = [];
        i++;
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        field = "";
        row = [];
        i++;
        continue;
      }
      field += ch;
      i++;
    }
  }
  // 最終行
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** rows → オブジェクト配列（ヘッダ行ベース） */
export function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === "") continue; // 空行スキップ
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = r[j] ?? "";
    }
    out.push(obj);
  }
  return out;
}

/** 大容量CSVを行オブジェクトのasync iteratorで返す（E.csv, F.csv 用） */
export async function* iterateCSV(filePath) {
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  let buffer = "";
  let headers = null;
  let isFirstChunk = true;

  for await (const chunk of stream) {
    let text = chunk;
    if (isFirstChunk) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      isFirstChunk = false;
    }
    buffer += text;

    // 最後の改行までを確定、残りは次のチャンクへ繰越
    let lastNewline = -1;
    let inQ = false;
    for (let i = 0; i < buffer.length; i++) {
      const c = buffer[i];
      if (c === '"') inQ = !inQ;
      else if ((c === "\n" || c === "\r") && !inQ) lastNewline = i;
    }
    if (lastNewline < 0) continue;

    const parseable = buffer.slice(0, lastNewline + 1);
    buffer = buffer.slice(lastNewline + 1);

    const rows = parseCSV(parseable);
    if (!headers && rows.length > 0) {
      headers = rows.shift();
    }
    for (const r of rows) {
      if (r.length === 1 && r[0] === "") continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j] ?? "";
      yield obj;
    }
  }
  // 残りバッファ
  if (buffer.length > 0) {
    const rows = parseCSV(buffer);
    if (!headers && rows.length > 0) headers = rows.shift();
    for (const r of rows) {
      if (r.length === 1 && r[0] === "") continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j] ?? "";
      yield obj;
    }
  }
}
