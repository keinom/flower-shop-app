#!/usr/bin/env node
/**
 * A.csv 未登録顧客の追加
 *
 * 対象: A.csv に存在するが、DB customers の notes に【旧コード: XXXXX】が
 *       存在しない顧客（=移行時に取り込まれなかった現役顧客）
 *
 * 処理:
 *   1. A.csv 読込
 *   2. DB から旧コード付き customers を全取得
 *   3. A.csv のうち旧コードが DB に未登録のものを抽出
 *   4. ノイズフィルタ（明らかに顧客でないもの）を除外
 *   5. dry-run: 対象一覧を出力
 *   6. execute: customers テーブルに INSERT
 *
 * 使い方:
 *   node scripts/add-missing-customers.mjs --dry-run
 *   node scripts/add-missing-customers.mjs --execute
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCSV, rowsToObjects } from "./lib/csv.mjs";
import { loadEnv } from "./lib/env.mjs";

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";
loadEnv();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function normalizePostalCode(raw) {
  if (!raw) return null;
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length !== 7) return null;
  return d.slice(0, 3) + "-" + d.slice(3);
}
function buildAddress(a1, a2) {
  const x = (a1 ?? "").trim();
  const y = (a2 ?? "").replace(/^[\s\u3000]+/, "").trim();
  if (!x && !y) return null;
  if (!y) return x;
  if (!x) return y;
  return x + y;
}
function buildName(n, d) {
  const a = (n ?? "").trim();
  const b = (d ?? "").trim();
  if (!a) return null;
  if (!b) return a;
  return a + " " + b;
}
function normalizePhone(raw) {
  const s = (raw ?? "").trim();
  return s || null;
}

// ノイズ除外フィルタ
const NOISE_NAME_TOKENS = new Set([
  "税込", "税抜", "値引", "現金", "カード", "他", "合計",
  "テスト", "test", "TEST", "サンプル", "ダミー",
]);
function isNoise(code, name) {
  if (!name) return true;
  const t = name.trim();
  if (t.length === 0) return true;
  if (NOISE_NAME_TOKENS.has(t)) return true;
  // 1文字以下
  if (t.replace(/[\s　]/g, "").length < 2) return true;
  return false;
}

async function fetchAllCustomers() {
  const all = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from("customers").select("id, name, notes").range(off, off + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log(`mode: ${MODE}`);

  const aText = readFileSync(resolve(process.cwd(), "data/import/A.csv"), "utf-8");
  const aRecords = rowsToObjects(parseCSV(aText));
  console.log(`A.csv: ${aRecords.length} 行`);

  const customers = await fetchAllCustomers();
  const codeRE = /【旧コード:\s*(\d+)】/;
  const codeRE2 = /【旧コード流用前:\s*(\d+)】/;
  const codeInDb = new Set();
  for (const c of customers) {
    const m1 = c.notes?.match(codeRE);
    const m2 = c.notes?.match(codeRE2);
    if (m1) codeInDb.add(m1[1]);
    if (m2) codeInDb.add(m2[1]);
  }
  console.log(`DB の旧コード保有: ${codeInDb.size}`);

  // A.csv のうち未登録のもの
  const candidates = [];
  const noise = [];
  const seenInCsv = new Set();
  for (const r of aRecords) {
    const code = (r["得意先コード"] ?? "").trim();
    if (!code) continue;
    if (seenInCsv.has(code)) continue;
    seenInCsv.add(code);
    if (codeInDb.has(code)) continue;

    const name = buildName(r["得意先名"], r["部署名"]);
    if (isNoise(code, name)) {
      noise.push({ code, name });
      continue;
    }

    candidates.push({
      code,
      name,
      phone: normalizePhone(r["電話番号"]),
      postal_code: normalizePostalCode(r["郵便番号"]),
      address: buildAddress(r["住所１"], r["住所２"]),
      email: null,
      notes: `【旧コード: ${code}】`,
    });
  }

  console.log(`\n======== A.csv 未登録顧客 ========`);
  console.log(`追加候補: ${candidates.length}`);
  console.log(`ノイズ除外: ${noise.length}`);

  if (noise.length > 0) {
    console.log(`\n-- 除外（ノイズ） --`);
    for (const n of noise) console.log(`  [${n.code}] "${n.name}"`);
  }

  // データ品質
  const withPhone = candidates.filter((c) => c.phone).length;
  const withAddr = candidates.filter((c) => c.address).length;
  const withPostal = candidates.filter((c) => c.postal_code).length;
  console.log(`\nデータ品質:`);
  console.log(`  電話あり: ${withPhone}/${candidates.length}`);
  console.log(`  住所あり: ${withAddr}/${candidates.length}`);
  console.log(`  郵便あり: ${withPostal}/${candidates.length}`);

  console.log(`\n-- 追加候補 Top 30 --`);
  for (const c of candidates.slice(0, 30)) {
    const tel = c.phone ? `tel:${c.phone}` : "";
    console.log(`  [${c.code}] "${c.name}" ${tel}`);
  }

  // 同名 customer 既存チェック（重複警告）
  const dbByName = new Map();
  for (const c of customers) {
    const k = (c.name ?? "").replace(/[\s　]/g, "");
    if (!dbByName.has(k)) dbByName.set(k, []);
    dbByName.get(k).push(c);
  }
  const dupes = [];
  for (const c of candidates) {
    const k = c.name.replace(/[\s　]/g, "");
    const hits = dbByName.get(k) ?? [];
    if (hits.length > 0) dupes.push({ candidate: c, hits });
  }
  console.log(`\n同名顧客が既存にある: ${dupes.length}`);
  for (const d of dupes.slice(0, 15)) {
    const hitNotes = d.hits.map((h) => h.notes ?? "").join(" / ");
    console.log(`  [${d.candidate.code}] "${d.candidate.name}" → 既存 ${d.hits.length}件: ${hitNotes}`);
  }

  // 書き出し
  const outPath = resolve(process.cwd(), "data/import/missing-customers-plan.json");
  writeFileSync(outPath, JSON.stringify({ candidates, noise, dupes: dupes.map((d) => ({ candidate: d.candidate, existing: d.hits.map((h) => ({ id: h.id, name: h.name, notes: h.notes })) })) }, null, 2));
  console.log(`\n書き出し: ${outPath}`);

  // 重複除外して INSERT 対象を決定
  const dupeCodes = new Set(dupes.map((d) => d.candidate.code));
  const toInsert = candidates.filter((c) => !dupeCodes.has(c.code));
  console.log(`\n→ 新規 INSERT: ${toInsert.length}件`);
  console.log(`→ 既存に併記:   ${dupes.length}件`);

  if (MODE !== "execute") {
    console.log("\n(dry-run) 書き込みは行いません");
    return;
  }

  // execute
  console.log("\n=== 実行 ===");
  const BATCH = 100;

  // 1. 新規 INSERT
  console.log("1. 新規追加...");
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH).map((c) => ({
      name: c.name, phone: c.phone, email: c.email,
      address: c.address, postal_code: c.postal_code, notes: c.notes,
    }));
    const { error } = await sb.from("customers").insert(chunk);
    if (error) { console.error(`batch ${i} error:`, error); throw error; }
    inserted += chunk.length;
    process.stdout.write(`\r  ${inserted}/${toInsert.length}`);
  }
  console.log();

  // 2. 既存への併記
  console.log("2. 既存 customer に追加コード併記...");
  let merged = 0, mergeErr = 0;
  for (const d of dupes) {
    const target = d.hits[0]; // 同名複数なら先頭
    const c = d.candidate;

    // notes に追加コード併記: 既存の【旧コード: XXX】 を 【旧コード: XXX, YYY】 へ
    let newNotes = target.notes ?? "";
    const re = /【旧コード:\s*([\d,\s]+)】/;
    const m = newNotes.match(re);
    if (m) {
      const codes = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (!codes.includes(c.code)) {
        codes.push(c.code);
        newNotes = newNotes.replace(re, `【旧コード: ${codes.join(", ")}】`);
      }
    } else {
      newNotes = `${newNotes}【旧コード: ${c.code}】`;
    }

    // 空欄補完: 既存が空 かつ A.csv 側に値があるもののみ
    const patch = { notes: newNotes };
    // 既存の値を取得するため再取得が必要だが、軽量化のため既知 fields 想定で:
    // hits には id, name, notes しか入っていないので、phone/address は別取得
    const { data: cur, error: fErr } = await sb
      .from("customers").select("phone, address, postal_code").eq("id", target.id).single();
    if (fErr) { mergeErr++; console.error(`fetch fail ${target.id}:`, fErr.message); continue; }
    if (!cur.phone && c.phone) patch.phone = c.phone;
    if (!cur.address && c.address) patch.address = c.address;
    if (!cur.postal_code && c.postal_code) patch.postal_code = c.postal_code;

    const { error } = await sb.from("customers").update(patch).eq("id", target.id);
    if (error) { mergeErr++; console.error(`update fail ${target.id}:`, error.message); }
    else merged++;
    process.stdout.write(`\r  ${merged}/${dupes.length} (err ${mergeErr})`);
  }
  console.log();

  console.log(`\n✅ 新規追加: ${inserted}件`);
  console.log(`✅ 既存併記: ${merged}件 (失敗 ${mergeErr})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
