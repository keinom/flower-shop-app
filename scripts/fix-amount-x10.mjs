#!/usr/bin/env node
/**
 * 桁ずれ修正: 移行データの total_amount と order_items.unit_price を ×10 する。
 *
 * 背景:
 *   元 E.csv エクスポートで BCD の implied decimal を 1桁誤ってシフトしており、
 *   全ての移行注文の金額が実際の 1/10 で保存されている。
 *   税率比と業務常識（なだ万 週次生け花が 700円→7,000円 が妥当）から確定。
 *
 * 対象:
 *   - orders.status = '履歴' かつ remarks に 【旧伝票キー:...】を含む もののみ
 *   - total_amount > 0 のみ（0円は真に0円なのでそのまま）
 *   - その orders に属する order_items のうち unit_price > 0 のもの
 *
 * 使い方:
 *   node scripts/fix-amount-x10.mjs --dry-run
 *   node scripts/fix-amount-x10.mjs --execute
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const EXEC = args.includes("--execute");
if (!DRY && !EXEC) {
  console.error("使い方: node scripts/fix-amount-x10.mjs [--dry-run | --execute]");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll(table, select, filters) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const f of filters) q = f(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log("=== Phase 1: 対象 orders 収集 ===");
  const orders = await fetchAll("orders", "id,total_amount,delivery_date,remarks", [
    (q) => q.eq("status", "履歴"),
    (q) => q.gt("total_amount", 0),
    (q) => q.like("remarks", "%旧伝票キー%"),
  ]);
  console.log(`対象 orders: ${orders.length}`);
  const sumBefore = orders.reduce((s, o) => s + o.total_amount, 0);
  const sumAfter = sumBefore * 10;
  console.log(`  sum before: ${sumBefore.toLocaleString()} 円`);
  console.log(`  sum after:  ${sumAfter.toLocaleString()} 円 (×10)`);
  console.log("  sample 20:");
  for (const o of orders.slice(0, 20)) {
    console.log(`    ${o.delivery_date}  ${o.total_amount} → ${o.total_amount * 10}`);
  }

  console.log("\n=== Phase 2: 対象 order_items 収集 ===");
  const orderIds = orders.map((o) => o.id);
  const items = [];
  const chunk = 100;
  for (let i = 0; i < orderIds.length; i += chunk) {
    const { data, error } = await supabase
      .from("order_items")
      .select("id,order_id,unit_price,product_name,quantity")
      .in("order_id", orderIds.slice(i, i + chunk))
      .gt("unit_price", 0);
    if (error) throw error;
    items.push(...(data ?? []));
    if ((i / chunk) % 50 === 0) console.log(`  collected items so far: ${items.length} (orders scanned ${i}/${orderIds.length})`);
  }
  console.log(`対象 order_items: ${items.length}`);
  const itemSumBefore = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  console.log(`  item sum (unit×qty) before: ${itemSumBefore.toLocaleString()} 円`);
  console.log(`  item sum after (×10): ${(itemSumBefore * 10).toLocaleString()} 円`);
  console.log("  sample 10:");
  for (const it of items.slice(0, 10)) {
    console.log(`    qty=${it.quantity} unit=${it.unit_price} → ${it.unit_price * 10}  ${(it.product_name ?? "").slice(0, 30)}`);
  }

  if (DRY) {
    console.log("\n[DRY-RUN] 書き込みは行いません。");
    console.log("本番適用: node scripts/fix-amount-x10.mjs --execute");
    return;
  }

  console.log("\n=== EXECUTE ===");

  // orders: RPC で一括 UPDATE が理想だが、service_role + 一行ずつ update でも可。
  // 効率を上げるため、まとまった値ごとにバルク更新する代わりに、
  // 各レコードを id で update する（50k件 / 並列 8）。
  console.log(`[1/2] orders ${orders.length} 件を ×10 更新中...`);
  let done = 0;
  const concurrency = 10;
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= orders.length) break;
      const o = orders[i];
      const { error } = await supabase
        .from("orders")
        .update({ total_amount: o.total_amount * 10 })
        .eq("id", o.id);
      if (error) {
        console.error(`  order ${o.id} 更新失敗:`, error);
        throw error;
      }
      done++;
      if (done % 2000 === 0 || done === orders.length) {
        console.log(`  orders: ${done}/${orders.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log(`\n[2/2] order_items ${items.length} 件を ×10 更新中...`);
  let itemDone = 0;
  let itemIdx = 0;
  async function itemWorker() {
    while (true) {
      const i = itemIdx++;
      if (i >= items.length) break;
      const it = items[i];
      const { error } = await supabase
        .from("order_items")
        .update({ unit_price: it.unit_price * 10 })
        .eq("id", it.id);
      if (error) {
        console.error(`  item ${it.id} 更新失敗:`, error);
        throw error;
      }
      itemDone++;
      if (itemDone % 2000 === 0 || itemDone === items.length) {
        console.log(`  order_items: ${itemDone}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => itemWorker()));

  console.log(`\n✅ 完了: orders ${done} / order_items ${itemDone}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
