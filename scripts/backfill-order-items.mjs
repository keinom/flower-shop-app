#!/usr/bin/env node
// orders.product_name があるが order_items が空の注文に対し、
// サマリーから 1 行だけ order_items を生成するバックフィル。
//
// 税率: 0（total_amount は税込既確定なので分解しない）
// unit_price: round(total_amount / quantity)（残差は端数分として許容）
//
// 使い方: node scripts/backfill-order-items.mjs --dry-run | --execute

import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll() {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, product_name, quantity, total_amount, created_at")
      .range(offset, offset + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function fetchExistingOrderIds() {
  const ids = new Set();
  // order_items にあるユニークな order_id をページングで取得
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const r of data) ids.add(r.order_id);
    if (data.length < 1000) break;
  }
  return ids;
}

async function main() {
  console.log(`mode: ${MODE}`);
  const [orders, existing] = await Promise.all([fetchAll(), fetchExistingOrderIds()]);
  console.log(`orders: ${orders.length}, orders with items: ${existing.size}`);

  const plan = [];
  for (const o of orders) {
    if (existing.has(o.id)) continue;
    if (!o.product_name) continue;
    const qty = Math.max(1, o.quantity ?? 1);
    const total = o.total_amount ?? 0;
    const unit = Math.round(total / qty);
    plan.push({
      order_id: o.id,
      product_name: o.product_name,
      quantity: qty,
      unit_price: unit,
      tax_rate: 0,
      created_at: o.created_at,
    });
  }
  console.log(`\nbackfill plan: ${plan.length}`);
  console.log("sample:");
  for (const p of plan.slice(0, 5)) console.log(" ", p);

  if (MODE !== "execute") {
    console.log("\n(dry-run)");
    return;
  }

  const BATCH = 500;
  let ok = 0;
  for (let i = 0; i < plan.length; i += BATCH) {
    const chunk = plan.slice(i, i + BATCH);
    const { error } = await supabase.from("order_items").insert(chunk);
    if (error) {
      console.error(`\nbatch ${i} failed:`, error.message);
    } else {
      ok += chunk.length;
    }
    process.stdout.write(`\r${ok}/${plan.length}`);
  }
  console.log(`\n✅ backfilled: ${ok}/${plan.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
