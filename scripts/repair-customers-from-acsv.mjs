#!/usr/bin/env node
/**
 * 顧客マスタ修復: A.csv (現役147件) を正として customers テーブルを上書き
 *
 * 背景:
 *   - 移行時、得意先コードの流用が発生しており、DB上の顧客名が旧所有者
 *     （invoice_headers由来）のまま残っているケースが多い
 *   - A.csv は「現在の所有者」を示す唯一の信頼できるソース
 *
 * このスクリプトでやること:
 *   1. A.csv を読み込み
 *   2. DB の customers から notes LIKE '%【旧コード: XXXXX】%' で該当レコードを特定
 *   3. name / phone / address / postal_code を A.csv 値と照合
 *   4. 差分があれば更新プランに追加
 *
 * 使い方:
 *   node scripts/repair-customers-from-acsv.mjs --dry-run
 *   node scripts/repair-customers-from-acsv.mjs --execute
 *
 * 出力:
 *   data/import/customer-repair-plan.json  (差分レポート)
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
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 7) return null;
  return digits.slice(0, 3) + "-" + digits.slice(3);
}
function buildAddress(addr1, addr2) {
  const a1 = (addr1 ?? "").trim();
  const a2 = (addr2 ?? "").replace(/^[\s\u3000]+/, "").trim();
  if (!a1 && !a2) return null;
  if (!a2) return a1;
  if (!a1) return a2;
  return a1 + a2;
}
function buildName(customerName, dept) {
  const n = (customerName ?? "").trim();
  const d = (dept ?? "").trim();
  if (!n) return null;
  if (!d) return n;
  return n + " " + d;
}
function normalizePhone(raw) {
  const s = (raw ?? "").trim();
  return s || null;
}
function norm(s) { return (s ?? "").trim(); }

async function fetchAllCustomers() {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from("customers")
      .select("id, name, phone, address, postal_code, notes")
      .range(offset, offset + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log(`mode: ${MODE}`);

  // A.csv 読み込み
  const importDir = resolve(process.cwd(), "data/import");
  const aText = readFileSync(resolve(importDir, "A.csv"), "utf-8");
  const aRecords = rowsToObjects(parseCSV(aText));
  console.log(`A.csv: ${aRecords.length} 行`);

  // A.csv を code → 期待値 マップに
  const expectedByCode = new Map();
  for (const r of aRecords) {
    const code = norm(r["得意先コード"]);
    if (!code) continue;
    const name = buildName(r["得意先名"], r["部署名"]);
    if (!name) continue;
    expectedByCode.set(code, {
      code,
      name,
      phone: normalizePhone(r["電話番号"]),
      postal_code: normalizePostalCode(r["郵便番号"]),
      address: buildAddress(r["住所１"], r["住所２"]),
    });
  }
  console.log(`A.csv 有効顧客: ${expectedByCode.size} 件`);

  // DB から全顧客
  const dbCustomers = await fetchAllCustomers();
  console.log(`DB customers: ${dbCustomers.length} 件`);

  // notes から旧コード抽出 → code → dbCustomer (複数あり得る)
  const dbByCode = new Map();
  const codeRE = /【旧コード:\s*(\d+)】/;
  for (const c of dbCustomers) {
    const m = c.notes?.match(codeRE);
    if (!m) continue;
    const code = m[1];
    if (!dbByCode.has(code)) dbByCode.set(code, []);
    dbByCode.get(code).push(c);
  }
  console.log(`旧コード紐付け済 DB 顧客: ${dbByCode.size} コード`);

  // 比較
  const updates = [];       // 単一一致、差分あり
  const noMatch = [];       // A.csv にあるが DB になし
  const multiMatch = [];    // 複数DB一致（要確認）
  const noChange = [];      // 差分なし
  const freshened = [];     // 休眠フラグ削除

  for (const [code, exp] of expectedByCode) {
    const hits = dbByCode.get(code) ?? [];
    if (hits.length === 0) { noMatch.push({ code, expected: exp }); continue; }
    if (hits.length > 1)  { multiMatch.push({ code, expected: exp, candidates: hits }); continue; }
    const cur = hits[0];

    const diffs = {};
    if (norm(cur.name) !== norm(exp.name))                diffs.name = { from: cur.name, to: exp.name };
    if ((cur.phone ?? null) !== (exp.phone ?? null))      diffs.phone = { from: cur.phone, to: exp.phone };
    if ((cur.address ?? null) !== (exp.address ?? null))  diffs.address = { from: cur.address, to: exp.address };
    if ((cur.postal_code ?? null) !== (exp.postal_code ?? null))
      diffs.postal_code = { from: cur.postal_code, to: exp.postal_code };

    // 休眠フラグが notes に残っている場合は除去対象
    const hasDormantFlag = cur.notes?.includes("【旧データ・要連絡先更新】");
    let newNotes = cur.notes;
    if (hasDormantFlag) {
      newNotes = cur.notes.replace("【旧データ・要連絡先更新】", "");
      diffs.notes = { from: cur.notes, to: newNotes };
    }

    if (Object.keys(diffs).length === 0) {
      noChange.push({ code, id: cur.id, name: cur.name });
    } else {
      updates.push({ code, id: cur.id, diffs, expected: exp, newNotes });
      if (hasDormantFlag) freshened.push(code);
    }
  }

  // レポート
  console.log("");
  console.log("======== 修復プラン ========");
  console.log(`差分あり更新: ${updates.length}`);
  console.log(`変更なし:     ${noChange.length}`);
  console.log(`DB未登録:     ${noMatch.length}`);
  console.log(`複数一致:     ${multiMatch.length}`);
  console.log(`休眠フラグ除去: ${freshened.length}`);

  console.log("\n-- 差分サンプル (先頭20件) --");
  for (const u of updates.slice(0, 20)) {
    const fields = Object.keys(u.diffs).join(",");
    const name = u.diffs.name ? `"${u.diffs.name.from}" → "${u.diffs.name.to}"` : u.expected.name;
    console.log(`  [${u.code}] ${name}  fields:[${fields}]`);
  }

  if (multiMatch.length > 0) {
    console.log("\n-- 複数一致 (要手動確認) --");
    for (const m of multiMatch) {
      console.log(`  [${m.code}] expected "${m.expected.name}" — ${m.candidates.length}件`);
      for (const c of m.candidates) console.log(`     id=${c.id}  name="${c.name}"`);
    }
  }

  if (noMatch.length > 0) {
    console.log("\n-- DB未登録 (要新規作成) --");
    for (const n of noMatch.slice(0, 20)) {
      console.log(`  [${n.code}] ${n.expected.name}`);
    }
  }

  // JSON 出力
  const outPath = resolve(importDir, "customer-repair-plan.json");
  writeFileSync(outPath, JSON.stringify({
    summary: {
      aCount: expectedByCode.size,
      updates: updates.length,
      noChange: noChange.length,
      noMatch: noMatch.length,
      multiMatch: multiMatch.length,
      freshened: freshened.length,
    },
    updates, noMatch, multiMatch,
  }, null, 2));
  console.log(`\n書き出し: ${outPath}`);

  if (MODE !== "execute") {
    console.log("\n(dry-run) 書き込みは行いません");
    return;
  }

  // execute
  console.log("\napplying updates...");
  let ok = 0, fail = 0;
  for (const u of updates) {
    const patch = {};
    if (u.diffs.name)        patch.name = u.diffs.name.to;
    if (u.diffs.phone)       patch.phone = u.diffs.phone.to;
    if (u.diffs.address)     patch.address = u.diffs.address.to;
    if (u.diffs.postal_code) patch.postal_code = u.diffs.postal_code.to;
    if (u.diffs.notes)       patch.notes = u.diffs.notes.to;
    const { error } = await sb.from("customers").update(patch).eq("id", u.id);
    if (error) { fail++; console.error(`  fail id=${u.id}:`, error.message); }
    else ok++;
    process.stdout.write(`\r${ok}/${updates.length} (fail ${fail})`);
  }
  console.log(`\n✅ updated: ${ok}, failed: ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
