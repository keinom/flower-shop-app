#!/usr/bin/env node
/**
 * fix-amount-x10.mjs の resume 版。
 *
 * orders は全 51,706 件 ×10 済み。
 * order_items は途中で Cloudflare 502 で停止したため、
 * 「対応する order の total_amount と itemSum の比率」を見て
 * 未更新(比率 ~10) のみ ×10 する。
 *
 * 判定: itemSum*qty*unit vs total_amount
 *   - ratio ~ 1.0 → 更新済み（total と items が同スケール）
 *   - ratio ~ 10.0 → 未更新（total のみ ×10、items 未更新）
 *
 * 使い方: node scripts/fix-amount-x10-resume.mjs --execute
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const EXEC = process.argv.includes("--execute");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function withRetry(fn, label, maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
      console.warn(`  ${label} 失敗 (${attempt}/${maxAttempts}): ${e?.message?.slice?.(0, 80)} — ${delay}ms待機`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function main() {
  // 1. orders (history, total>0) をページング取得
  console.log("orders 取得...");
  const orders = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,total_amount")
      .eq("status", "履歴")
      .gt("total_amount", 0)
      .like("remarks", "%旧伝票キー%")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    orders.push(...data);
    if (data.length < pageSize) break;
  }
  console.log(`orders: ${orders.length}`);

  // 2. items 取得 & per-order 集計
  console.log("order_items 取得...");
  const itemsByOrder = new Map(); // order_id -> items[]
  const chunk = 100;
  let gathered = 0;
  for (let i = 0; i < orders.length; i += chunk) {
    const ids = orders.slice(i, i + chunk).map((o) => o.id);
    const data = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from("order_items")
          .select("id,order_id,unit_price,quantity")
          .in("order_id", ids)
          .gt("unit_price", 0);
        if (error) throw error;
        return data ?? [];
      },
      `items ${i}-${i + chunk}`
    );
    for (const it of data) {
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
      itemsByOrder.get(it.order_id).push(it);
    }
    gathered += data.length;
    if ((i / chunk) % 50 === 0) console.log(`  orders scanned ${i}/${orders.length}, items ${gathered}`);
  }
  console.log(`items total: ${gathered}`);

  // 3. 判定
  const toUpdate = [];
  let alreadyDone = 0;
  let ambiguous = 0;
  for (const o of orders) {
    const its = itemsByOrder.get(o.id);
    if (!its || its.length === 0) continue;
    const sum = its.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    if (sum === 0) continue;
    const ratio = o.total_amount / sum;
    // total は既に×10済み。items の状態を判定。
    if (ratio >= 0.8 && ratio <= 1.3) {
      // items も×10済み
      alreadyDone += its.length;
    } else if (ratio >= 8 && ratio <= 13) {
      // items 未×10
      for (const it of its) toUpdate.push(it);
    } else {
      // 6%の異常レコード。どちら付かず。
      // 安全側: total/sum がもっと1に近い方でハンドル。
      // total×10済みなので、original比率は以下のどれかだった:
      //   若い方 = ratio (items×10済み), 10倍 = ratio/10 (items未×10)
      // ratio=0.01(元比率0.1=items巨大) → items にも ×10 するとさらに悪化
      // ratio=100(元比率1000=items微小) → items に ×10 は許容
      if (ratio > 13) {
        // items は total に比べて異常に小さい。×10 してもOK
        for (const it of its) toUpdate.push(it);
      } else {
        // items 過大。触らない。
        ambiguous += its.length;
      }
    }
  }
  console.log(`\n判定: to-update=${toUpdate.length}, already-done=${alreadyDone}, ambiguous(skip)=${ambiguous}`);
  console.log("sample to-update 10件:");
  for (const it of toUpdate.slice(0, 10)) {
    console.log(`  order=${it.order_id.slice(0, 8)}.. qty=${it.quantity} unit=${it.unit_price} → ${it.unit_price * 10}`);
  }

  if (!EXEC) {
    console.log("\n[DRY-RUN] --execute で適用");
    return;
  }

  // 4. 更新 (retry 付き)
  console.log(`\n[EXECUTE] ${toUpdate.length} 件を×10 更新中...`);
  let idx = 0, done = 0;
  const concurrency = 6;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= toUpdate.length) break;
      const it = toUpdate[i];
      await withRetry(
        async () => {
          const { error } = await supabase
            .from("order_items")
            .update({ unit_price: it.unit_price * 10 })
            .eq("id", it.id);
          if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error).slice(0, 200));
        },
        `item ${it.id.slice(0, 8)}`
      );
      done++;
      if (done % 1000 === 0 || done === toUpdate.length) console.log(`  ${done}/${toUpdate.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\n✅ 完了: ${done} 件更新`);
}

main().catch((e) => { console.error(e); process.exit(1); });
