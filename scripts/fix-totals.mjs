#!/usr/bin/env node
// Phase 3: e.dat と DB の total_amount の不一致を修正
//
// 対象: DB orders (status=履歴) のうち、旧伝票キーが e.dat に存在し、
//       e.dat のヘッダから計算した合計金額と DB の total_amount が異なるもの。
//
// e.dat 合計 = floor((税抜計 + 消費税計) / 10)  (packed-BCD の V9 implied decimal)
// 負値 (返品) は絶対値化。
//
// 使い方: node scripts/fix-totals.mjs --dry-run
//         node scripts/fix-totals.mjs --execute

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const EXEC = args.includes("--execute");
if (!DRY && !EXEC) {
  console.error("usage: node scripts/fix-totals.mjs [--dry-run | --execute]");
  process.exit(1);
}

loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const eHeaders = JSON.parse(readFileSync("data/import/e-dat-headers.json", "utf8"));
const byKey = new Map();
for (const r of eHeaders) byKey.set(r.key, r);

// Fetch all DB 履歴 orders
const dbOrders = [];
let from = 0;
while (true) {
  const { data, error } = await sb.from("orders")
    .select("id, total_amount, remarks")
    .eq("status", "履歴")
    .range(from, from + 999);
  if (error) throw error;
  if (!data || data.length === 0) break;
  dbOrders.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`DB 履歴 orders: ${dbOrders.length}`);

const updates = []; // {id, from, to, key}
for (const o of dbOrders) {
  const m = (o.remarks || "").match(/【旧伝票キー:\s*(\d{21})】/);
  if (!m) continue;
  const e = byKey.get(m[1]);
  if (!e || e.total_amount === null) continue;
  const predicted = Math.abs(e.total_amount);
  if (predicted !== o.total_amount) {
    updates.push({ id: o.id, key: m[1], from: o.total_amount, to: predicted });
  }
}

const totalFrom = updates.reduce((s, u) => s + u.from, 0);
const totalTo = updates.reduce((s, u) => s + u.to, 0);
console.log("");
console.log(`=== Planned updates: ${updates.length} rows ===`);
console.log(`  sum of old total_amount: ${totalFrom.toLocaleString()} 円`);
console.log(`  sum of new total_amount: ${totalTo.toLocaleString()} 円`);
console.log(`  delta:                   ${(totalTo - totalFrom).toLocaleString()} 円`);

// Histogram of diff magnitude
const diffHist = new Map();
for (const u of updates) {
  const d = u.to - u.from;
  diffHist.set(d, (diffHist.get(d) || 0) + 1);
}
const top = [...diffHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log("  diff histogram (top 10):");
for (const [d, c] of top) console.log(`    ${d >= 0 ? "+" : ""}${d}: ${c}`);

console.log("\n20 sample before/after:");
for (const u of updates.slice(0, 20)) {
  console.log(`  ${u.key}  ${u.from} → ${u.to}  (Δ=${u.to - u.from})`);
}

if (DRY) {
  console.log("\n[DRY-RUN] no writes performed.");
  console.log("To execute: node scripts/fix-totals.mjs --execute");
  process.exit(0);
}

// Batched execute
console.log("\n[EXECUTE] applying updates in batches of 500...");
const batch = 500;
let done = 0;
for (let i = 0; i < updates.length; i += batch) {
  const chunk = updates.slice(i, i + batch);
  // Supabase has no bulk-update-with-different-values, so do individual updates in parallel (limited)
  const pool = 20;
  for (let j = 0; j < chunk.length; j += pool) {
    const slice = chunk.slice(j, j + pool);
    await Promise.all(slice.map(async (u) => {
      const { error } = await sb.from("orders")
        .update({ total_amount: u.to })
        .eq("id", u.id);
      if (error) throw error;
    }));
  }
  done += chunk.length;
  console.log(`  ${done}/${updates.length}`);
}
console.log(`\n✅ Updated ${updates.length} rows.`);
