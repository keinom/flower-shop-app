#!/usr/bin/env node
/**
 * Step 2a: 得意先コード流用の検出（dry-run）
 *
 * 目的:
 *   A.csv 由来で上書きされた customers テーブルに対し、
 *   「旧所有者の注文が新所有者に紐付いて見えるケース」を洗い出す。
 *
 * アルゴリズム:
 *   1. customers を全件取得（notes に【旧コード】がある顧客のみ対象）
 *   2. 各 customer に紐づく orders (customer_id = c.id) を取得
 *   3. delivery_name を正規化（全半角・空白・記号除去）
 *   4. 現 customer.name を正規化
 *   5. orders を「現所有者と一致」「乖離（旧所有者候補）」にバケット化
 *      - 乖離の判定: Jaccard 類似度（文字集合ベース）< 0.5
 *   6. 乖離バケットをさらに delivery_name の正規化キーでグルーピング
 *      → 最頻値を「推定旧所有者」として報告
 *   7. 結果を JSON と要約ログで出力
 *
 * 書き込み:
 *   行いません（dry-run のみ）
 *
 * 出力:
 *   data/import/code-reuse-plan.json
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// --- 正規化 ---
function normalize(s) {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/[\s　･・「」『』（）()〈〉\[\]【】,、。.\-ー－—:：]/g, "")
    .toLowerCase();
}
function charSet(s) { return new Set([...s]); }
function jaccard(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const A = charSet(a), B = charSet(b);
  let inter = 0;
  for (const ch of A) if (B.has(ch)) inter++;
  return inter / (A.size + B.size - inter);
}

// --- ページング取得 ---
async function fetchAllCustomers() {
  const all = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from("customers")
      .select("id, name, notes")
      .range(off, off + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}
async function fetchAllOrders() {
  const all = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from("orders")
      .select("id, customer_id, delivery_name, delivery_date, status")
      .range(off, off + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log("loading customers / orders...");
  const [customers, orders] = await Promise.all([fetchAllCustomers(), fetchAllOrders()]);
  console.log(`  customers: ${customers.length}, orders: ${orders.length}`);

  // 旧コード付き顧客のみ
  const codeRE = /【旧コード:\s*(\d+)】/;
  const custById = new Map();
  for (const c of customers) {
    const m = c.notes?.match(codeRE);
    if (!m) continue;
    custById.set(c.id, { ...c, code: m[1], norm: normalize(c.name) });
  }
  console.log(`  旧コード付き顧客: ${custById.size}`);

  // orders を customer_id でグループ
  const ordersByCust = new Map();
  for (const o of orders) {
    if (!o.customer_id) continue;
    if (!custById.has(o.customer_id)) continue;
    if (!ordersByCust.has(o.customer_id)) ordersByCust.set(o.customer_id, []);
    ordersByCust.get(o.customer_id).push(o);
  }

  // 各顧客を分析
  const reuseCodes = [];   // コード流用が検出された顧客
  const cleanCodes = [];   // 正常
  const emptyCodes = [];   // 注文なし

  for (const [custId, cust] of custById) {
    const os = ordersByCust.get(custId) ?? [];
    if (os.length === 0) { emptyCodes.push(cust); continue; }

    // delivery_name を正規化キーで集約
    const nameGroups = new Map();  // normKey -> { raw, orders }
    for (const o of os) {
      const key = normalize(o.delivery_name);
      if (!nameGroups.has(key)) nameGroups.set(key, { raw: o.delivery_name, orders: [] });
      nameGroups.get(key).orders.push(o);
    }

    // 現所有者に一致するグループ / 乖離グループ
    const matched = [];
    const diverged = [];
    for (const [key, grp] of nameGroups) {
      const sim = jaccard(key, cust.norm);
      const exact = key === cust.norm;
      if (exact || sim >= 0.5) matched.push({ ...grp, key, sim });
      else diverged.push({ ...grp, key, sim });
    }

    if (diverged.length === 0) { cleanCodes.push(cust); continue; }

    // 乖離の中で注文数最多を「推定旧所有者」として抽出
    diverged.sort((a, b) => b.orders.length - a.orders.length);
    const totalDivOrders = diverged.reduce((s, g) => s + g.orders.length, 0);
    const topOldOwner = diverged[0];

    // 日付範囲
    const divDates = diverged.flatMap((g) => g.orders.map((o) => o.delivery_date)).sort();
    const statusCounts = {};
    for (const g of diverged) for (const o of g.orders) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    }

    reuseCodes.push({
      code: cust.code,
      customer_id: custId,
      current_name: cust.name,
      total_orders: os.length,
      matched_orders: os.length - totalDivOrders,
      diverged_orders: totalDivOrders,
      top_old_owner_name: topOldOwner.raw,
      top_old_owner_count: topOldOwner.orders.length,
      div_variants: diverged.length,
      status_counts: statusCounts,
      date_range: { first: divDates[0], last: divDates[divDates.length - 1] },
      variants: diverged.map((g) => ({ name: g.raw, count: g.orders.length, sim: +g.sim.toFixed(2) })),
    });
  }

  // ソート: 注文数が多いものから
  reuseCodes.sort((a, b) => b.diverged_orders - a.diverged_orders);

  // --- レポート ---
  const divTotal = reuseCodes.reduce((s, r) => s + r.diverged_orders, 0);
  console.log("\n======== コード流用検出レポート ========");
  console.log(`正常（乖離なし）:       ${cleanCodes.length} コード`);
  console.log(`流用検出:               ${reuseCodes.length} コード`);
  console.log(`注文なし:               ${emptyCodes.length} コード`);
  console.log(`乖離注文合計:           ${divTotal.toLocaleString()} 件`);

  // 流用コードの Top 30
  console.log("\n-- 流用検出 Top 30 (乖離注文数順) --");
  console.log("code   | 現所有者 → 旧所有者推定 | 乖離件数 / 全件 | 期間");
  for (const r of reuseCodes.slice(0, 30)) {
    const d = `${r.date_range.first} ～ ${r.date_range.last}`;
    const stat = Object.entries(r.status_counts).map(([k,v]) => `${k}:${v}`).join(" ");
    console.log(
      `${r.code.padEnd(6)} | "${r.current_name}" → "${r.top_old_owner_name}" | ${r.diverged_orders}/${r.total_orders} | ${d}  [${stat}]`
    );
  }

  // status 別集計
  const byStatus = {};
  for (const r of reuseCodes) {
    for (const [s, c] of Object.entries(r.status_counts)) {
      byStatus[s] = (byStatus[s] ?? 0) + c;
    }
  }
  console.log("\n-- 乖離注文のステータス分布 --");
  for (const [s, c] of Object.entries(byStatus)) console.log(`  ${s}: ${c}`);

  // 現役（履歴ではない）乖離注文 — 要注意
  const activeDiv = reuseCodes.filter((r) => {
    const nonHist = Object.entries(r.status_counts)
      .filter(([s]) => s !== "履歴")
      .reduce((sum, [, c]) => sum + c, 0);
    return nonHist > 0;
  });
  console.log(`\n-- 履歴以外の乖離注文を含むコード: ${activeDiv.length} --`);
  for (const r of activeDiv.slice(0, 20)) {
    const nonHist = Object.entries(r.status_counts)
      .filter(([s]) => s !== "履歴")
      .map(([s, c]) => `${s}:${c}`).join(" ");
    console.log(`  ${r.code} "${r.current_name}" ← "${r.top_old_owner_name}" [${nonHist}]`);
  }

  // JSON 出力
  const out = resolve(process.cwd(), "data/import/code-reuse-plan.json");
  writeFileSync(out, JSON.stringify({
    summary: {
      clean: cleanCodes.length,
      reuse: reuseCodes.length,
      empty: emptyCodes.length,
      diverged_total: divTotal,
      status: byStatus,
    },
    reuseCodes,
  }, null, 2));
  console.log(`\n書き出し: ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
