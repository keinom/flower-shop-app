#!/usr/bin/env node
/**
 * Step 2b: コード流用の分離実行
 *
 * 入力:
 *   data/import/code-reuse-tier-a.json (filter-tier-a.mjs が生成)
 *   data/import/code-reuse-exclude.json (任意、手動除外リスト)
 *
 * 処理:
 *   各 Tier A 候補について、
 *     1. 旧所有者名で既存 customers を検索
 *        - マッチあり: 既存 customer にマージ
 *        - マッチなし: 新規作成（notes に【旧コード流用前: XXXXX】）
 *     2. 該当注文（customer_id = 現所有者 AND 正規化delivery_name が旧所有者名と一致）
 *        の customer_id を新/既存の旧所有者 customer に付け替え
 *
 * 使い方:
 *   node scripts/split-code-reuse.mjs --dry-run
 *   node scripts/split-code-reuse.mjs --execute
 *
 * 除外リスト形式 (data/import/code-reuse-exclude.json):
 *   [
 *     { "code": "11356", "reason": "市川團十郎と海老蔵は同一人物（襲名）" },
 *     { "code": "10541", "reason": "株式会社社員とABC番組は同じ会社" }
 *   ]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";

loadEnv();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function normalize(s) {
  if (!s) return "";
  return s.normalize("NFKC")
    .replace(/[\s　･・「」『』（）()〈〉\[\]【】,、。.\-ー－—:：]/g, "")
    .toLowerCase();
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

  const tierPath = resolve(process.cwd(), "data/import/code-reuse-tier-a.json");
  const tier = JSON.parse(readFileSync(tierPath, "utf8"));

  // 除外リスト読み込み
  const excludePath = resolve(process.cwd(), "data/import/code-reuse-exclude.json");
  let excludeSet = new Set();
  if (existsSync(excludePath)) {
    const ex = JSON.parse(readFileSync(excludePath, "utf8"));
    excludeSet = new Set(ex.map((e) => e.code));
    console.log(`除外リスト: ${excludeSet.size} コード`);
  } else {
    console.log(`除外リスト: なし（${excludePath} が存在しない場合は空として処理）`);
  }

  const targets = tier.tierA.filter((r) => !excludeSet.has(r.code));
  const excluded = tier.tierA.filter((r) => excludeSet.has(r.code));
  console.log(`対象 Tier A: ${targets.length} (除外 ${excluded.length})`);

  // 全 customers を取得し、正規化名でインデックス化（既存マージ検索用）
  console.log("loading customers...");
  const customers = await fetchAllCustomers();
  const byNormName = new Map();
  for (const c of customers) {
    const k = normalize(c.name);
    if (!byNormName.has(k)) byNormName.set(k, []);
    byNormName.get(k).push(c);
  }
  console.log(`  customers: ${customers.length}`);

  // 計画作成
  const plan = {
    createNew: [],   // 新規作成 customer
    mergeExisting: [], // 既存 customer に付け替え
    affectedOrders: 0,
  };

  for (const r of targets) {
    const oldName = r.top_old_owner_name;
    const normOld = normalize(oldName);

    // 既存 customer 検索
    const hits = byNormName.get(normOld) ?? [];
    // 現所有者（元のcustomer_id）は除外
    const usable = hits.filter((c) => c.id !== r.customer_id);

    if (usable.length > 0) {
      plan.mergeExisting.push({
        code: r.code,
        from_customer_id: r.customer_id,
        from_name: r.current_name,
        old_name: oldName,
        to_customer_id: usable[0].id,
        to_customer_name: usable[0].name,
        order_count: r.top_old_owner_count,
        candidates: usable.length,
      });
    } else {
      plan.createNew.push({
        code: r.code,
        from_customer_id: r.customer_id,
        from_name: r.current_name,
        new_customer: {
          name: oldName,
          notes: `【旧コード流用前: ${r.code}】【旧データ・要連絡先更新】`,
          phone: null, address: null, postal_code: null, email: null,
        },
        order_count: r.top_old_owner_count,
      });
    }
    plan.affectedOrders += r.top_old_owner_count;
  }

  // レポート
  console.log("\n======== Step 2b プラン ========");
  console.log(`新規 customer 作成:   ${plan.createNew.length}`);
  console.log(`既存 customer にマージ: ${plan.mergeExisting.length}`);
  console.log(`付け替え注文合計:     ${plan.affectedOrders}`);

  if (plan.mergeExisting.length > 0) {
    console.log("\n-- 既存マージ一覧 --");
    for (const m of plan.mergeExisting) {
      console.log(`  [${m.code}] "${m.from_name}" から切り離し → 既存 "${m.to_customer_name}" (id=${m.to_customer_id.slice(0,8)}...)  ${m.order_count}件`);
    }
  }

  console.log("\n-- 新規作成 Top 20 (件数順) --");
  plan.createNew.sort((a,b) => b.order_count - a.order_count);
  for (const n of plan.createNew.slice(0, 20)) {
    console.log(`  [${n.code}] 新規 "${n.new_customer.name}" ← 現"${n.from_name}" から ${n.order_count}件分離`);
  }

  // 書き出し
  const outPath = resolve(process.cwd(), "data/import/split-code-reuse-plan.json");
  writeFileSync(outPath, JSON.stringify(plan, null, 2));
  console.log(`\n書き出し: ${outPath}`);

  if (MODE !== "execute") {
    console.log("\n(dry-run) 書き込みは行いません");
    return;
  }

  // ======== Execute ========
  console.log("\n=== 実行フェーズ ===");

  // 1. 新規 customer を一括作成
  console.log("1. 新規 customer を作成中...");
  const toInsert = plan.createNew.map((n) => n.new_customer);
  const newIds = [];
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { data, error } = await sb
      .from("customers")
      .insert(chunk)
      .select("id, name, notes");
    if (error) { console.error("insert error:", error); throw error; }
    newIds.push(...data);
    process.stdout.write(`\r  ${newIds.length}/${toInsert.length}`);
  }
  console.log();

  // code → new customer id へのマップ
  const codeToNewId = new Map();
  for (let i = 0; i < plan.createNew.length; i++) {
    const n = plan.createNew[i];
    // insert 順序保持前提。insert は配列順に返る
    codeToNewId.set(n.code, newIds[i].id);
  }

  // 2. 注文の付け替え
  console.log("2. 注文を付け替え中...");
  // Tier A 元データに戻って、delivery_name 正規化一致条件で対象注文を特定
  const targetsByCode = new Map(targets.map((r) => [r.code, r]));

  let reassigned = 0, errors = 0;
  for (const r of targets) {
    const toId = codeToNewId.get(r.code)
      ?? plan.mergeExisting.find((m) => m.code === r.code)?.to_customer_id;
    if (!toId) { console.error(`  skip code ${r.code}: no target id`); continue; }

    const normOld = normalize(r.top_old_owner_name);

    // 該当注文を取得: customer_id = 現所有者 の注文のうち normalize(delivery_name) === normOld
    // PostgREST では delivery_name の正規化クエリは難しいため、該当注文をまず引いてくる
    const { data: orders, error: qErr } = await sb
      .from("orders")
      .select("id, delivery_name")
      .eq("customer_id", r.customer_id);
    if (qErr) { console.error(`  query fail ${r.code}:`, qErr.message); errors++; continue; }

    const targetIds = orders
      .filter((o) => normalize(o.delivery_name) === normOld)
      .map((o) => o.id);

    if (targetIds.length === 0) continue;

    // 100件ずつ update
    for (let i = 0; i < targetIds.length; i += BATCH) {
      const ids = targetIds.slice(i, i + BATCH);
      const { error } = await sb
        .from("orders")
        .update({ customer_id: toId })
        .in("id", ids);
      if (error) { console.error(`  update fail ${r.code}:`, error.message); errors++; break; }
      reassigned += ids.length;
    }
    process.stdout.write(`\r  ${reassigned} 件付け替え済 (errors: ${errors})`);
  }
  console.log();
  console.log(`\n✅ 新規作成: ${newIds.length} customer`);
  console.log(`✅ 付け替え: ${reassigned} 件`);
  if (errors > 0) console.log(`⚠️ エラー:   ${errors}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
