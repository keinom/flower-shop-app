/**
 * 過去伝票移行スクリプト (Phase 2)
 *
 * 対象:
 *   - E.csv (66,650件): 伝票ヘッダ → orders テーブル
 *   - F.csv (18,003件): 伝票明細 → order_items テーブル
 *
 * 方針 (ユーザー確認済):
 *   - status = '履歴' 固定
 *   - delivery_date = キーコード先頭8桁 (YYYYMMDD)
 *   - total_amount = 税抜計 + 消費税計
 *   - F.csv トラン区分:
 *       01 (商品)   → order_items に挿入
 *       03 (消費税) → 吸収 (orders.total_amount に含まれるためスキップ)
 *       04 (値引き) → 全件金額0のためスキップ
 *   - F.csv 孤児明細 (対応ヘッダなし) → スキップ
 *   - E.csv で得意先コードに対応する顧客がDBに存在しない伝票 → スキップ (Q5案C)
 *
 * 使い方:
 *   node scripts/import-orders.mjs --dry-run
 *   node scripts/import-orders.mjs --execute
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseCSV, rowsToObjects } from "./lib/csv.mjs";
import { loadEnv } from "./lib/env.mjs";

// ------------------------------------------------------------
// CLI
// ------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const EXECUTE = args.includes("--execute");

if (!DRY_RUN && !EXECUTE) {
  console.error("使い方: node scripts/import-orders.mjs [--dry-run | --execute]");
  process.exit(1);
}

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

function parseInt10(s) {
  const n = parseInt(s || "0", 10);
  return Number.isNaN(n) ? 0 : n;
}

/** キーコード先頭8桁を YYYY-MM-DD に変換 (不正なら null) */
function parseKeyDate(key) {
  if (!key || key.length < 8) return null;
  const ymd = key.slice(0, 8);
  const y = ymd.slice(0, 4);
  const m = ymd.slice(4, 6);
  const d = ymd.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() < 1990 || date.getUTCFullYear() > 2100) return null;
  return `${y}-${m}-${d}`;
}

/** 名前結合 */
function buildName(name, dept) {
  const n = (name ?? "").trim();
  const d = (dept ?? "").trim();
  if (!n) return null;
  if (!d) return n;
  return n + " " + d;
}

// ------------------------------------------------------------
// メイン
// ------------------------------------------------------------

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------------- 顧客マップ取得 ----------------
  console.log("[1/5] 顧客マップ (旧コード → customer) を取得中...");
  const codeToCustomer = new Map(); // 旧コード → { id, name, phone, address, postal_code }

  // ページング取得 (Supabase のデフォルト1000件制限)
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, address, postal_code, notes")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const c of data) {
      const m = c.notes?.match(/【旧コード: ([^】]+)】/);
      if (m) codeToCustomer.set(m[1], c);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`  → ${codeToCustomer.size} 件の顧客マップを構築`);

  // ---------------- E.csv 読み込み ----------------
  console.log("[2/5] E.csv を読み込み中...");
  const importDir = resolve(process.cwd(), "data/import");
  const eText = readFileSync(resolve(importDir, "E.csv"), "utf-8");
  const eRecords = rowsToObjects(parseCSV(eText));
  console.log(`  → ${eRecords.length} 行`);

  // ---------------- F.csv 読み込み & インデックス化 ----------------
  console.log("[3/5] F.csv を読み込み & インデックス化中...");
  const fText = readFileSync(resolve(importDir, "F.csv"), "utf-8");
  const fRecords = rowsToObjects(parseCSV(fText));
  console.log(`  → ${fRecords.length} 行`);

  /** ヘッダキーコード → F.csv 01行配列 */
  const fItemsByHeader = new Map();
  let fSkipTran03 = 0;
  let fSkipTran04 = 0;
  let fSkipOrphan = 0;
  let fSkipZeroAmount = 0;
  const eKeySet = new Set(eRecords.map((r) => r["キーコード"]));

  for (const f of fRecords) {
    const tran = f["トラン区分"];
    const headerKey = f["キーコード"].slice(0, 21);

    if (tran === "03") {
      fSkipTran03++;
      continue;
    }
    if (tran === "04") {
      fSkipTran04++;
      continue;
    }
    if (tran !== "01") continue;

    if (!eKeySet.has(headerKey)) {
      fSkipOrphan++;
      continue;
    }

    const qty = parseInt10(f["数量"]);
    const price = parseInt10(f["単価"]);
    const amount = parseInt10(f["金額"]);

    // 全部ゼロ → 意味のない行としてスキップ
    if (qty === 0 && price === 0 && amount === 0) {
      fSkipZeroAmount++;
      continue;
    }

    if (!fItemsByHeader.has(headerKey)) fItemsByHeader.set(headerKey, []);
    fItemsByHeader.get(headerKey).push(f);
  }

  console.log(`  → 01行: ${Array.from(fItemsByHeader.values()).reduce((s, a) => s + a.length, 0)} 件`);
  console.log(`  → 03 (消費税) スキップ: ${fSkipTran03}`);
  console.log(`  → 04 (値引き) スキップ: ${fSkipTran04}`);
  console.log(`  → 孤児明細スキップ: ${fSkipOrphan}`);
  console.log(`  → 全ゼロ行スキップ: ${fSkipZeroAmount}`);

  // ---------------- 変換 ----------------
  console.log("[4/5] orders / order_items レコードを生成中...");

  const ordersToInsert = [];
  const itemsToInsert = [];
  let skipNoCustomer = 0;
  let skipInvalidDate = 0;
  let multiItemOrders = 0;

  for (const e of eRecords) {
    const code = (e["得意先コード"] ?? "").trim();
    const customer = codeToCustomer.get(code);
    if (!customer) {
      skipNoCustomer++;
      continue;
    }

    const deliveryDate = parseKeyDate(e["キーコード"]);
    if (!deliveryDate) {
      skipInvalidDate++;
      continue;
    }

    const taxExc = parseInt10(e["税抜計"]);
    const taxAmt = parseInt10(e["消費税計"]);
    const totalAmount = taxExc + taxAmt;

    const deliveryName = buildName(e["得意先名"], e["部署名"]) ?? customer.name;

    // 備考
    const memo = (e["摘要"] ?? "").trim();
    const remarks = (memo ? memo + " " : "") + `【旧伝票キー: ${e["キーコード"]}】`;

    // F.csv の商品行
    const fItems = fItemsByHeader.get(e["キーコード"]) ?? [];

    // 代表商品名 / 数量合計
    let productName = "（商品明細なし）";
    let quantity = 1;
    if (fItems.length > 0) {
      const first = fItems[0];
      const firstName = [(first["商品名"] ?? "").trim(), (first["商品名２"] ?? "").trim()]
        .filter(Boolean)
        .join(" ");
      productName = firstName || "（商品名なし）";
      if (fItems.length > 1) {
        productName += ` 他${fItems.length - 1}点`;
        multiItemOrders++;
      }
      const sumQty = fItems.reduce((s, f) => s + parseInt10(f["数量"]), 0);
      if (sumQty > 0) quantity = sumQty;
    }

    const orderId = randomUUID();

    ordersToInsert.push({
      id: orderId,
      customer_id: customer.id,
      status: "履歴",
      order_type: "配達",
      delivery_name: deliveryName,
      delivery_address: customer.address,
      delivery_phone: customer.phone,
      delivery_postal_code: customer.postal_code,
      delivery_date: deliveryDate,
      product_name: productName,
      quantity: Math.max(1, quantity),
      total_amount: totalAmount,
      payment_status: "代済み",
      remarks,
      created_at: deliveryDate + "T00:00:00+09:00",
      updated_at: deliveryDate + "T00:00:00+09:00",
    });

    // order_items
    for (const fi of fItems) {
      let qty = parseInt10(fi["数量"]);
      let price = parseInt10(fi["単価"]);
      const amount = parseInt10(fi["金額"]);

      // 数量0・単価0・金額>0 → quantity=1, unit_price=金額
      if (qty === 0 && price === 0 && amount > 0) {
        qty = 1;
        price = amount;
      } else if (qty === 0) {
        qty = 1;
      }

      const name = [(fi["商品名"] ?? "").trim(), (fi["商品名２"] ?? "").trim()]
        .filter(Boolean)
        .join(" ") || "（商品名なし）";

      itemsToInsert.push({
        id: randomUUID(),
        order_id: orderId,
        product_name: name,
        quantity: Math.max(1, qty),
        unit_price: Math.max(0, price),
        tax_rate: 10,
        description: (fi["摘要"] ?? "").trim() || null,
      });
    }
  }

  // ---------------- サマリ ----------------
  console.log("");
  console.log("======== 変換結果サマリ ========");
  console.log(`orders 生成: ${ordersToInsert.length}`);
  console.log(`order_items 生成: ${itemsToInsert.length}`);
  console.log(`複数商品注文: ${multiItemOrders}`);
  console.log("");
  console.log(`[参考] 未知顧客でスキップ: ${skipNoCustomer}`);
  console.log(`[参考] 日付不正でスキップ: ${skipInvalidDate}`);

  // 年度別分布
  const yearCount = {};
  for (const o of ordersToInsert) {
    const y = o.delivery_date.slice(0, 4);
    yearCount[y] = (yearCount[y] ?? 0) + 1;
  }
  console.log("");
  console.log("======== orders 年度別件数 ========");
  for (const y of Object.keys(yearCount).sort()) {
    console.log(`  ${y}: ${yearCount[y].toLocaleString()}`);
  }

  // 金額合計
  const totalSum = ordersToInsert.reduce((s, o) => s + o.total_amount, 0);
  console.log("");
  console.log(`orders.total_amount 合計: ${totalSum.toLocaleString()} 円`);

  // サンプル
  console.log("");
  console.log("======== サンプル (複数明細の注文) ========");
  const multiSample = ordersToInsert.find((o) => /他\d+点/.test(o.product_name ?? ""));
  if (multiSample) {
    console.log("[orders]", JSON.stringify(multiSample, null, 2));
    console.log("[order_items 所属]");
    for (const it of itemsToInsert.filter((i) => i.order_id === multiSample.id)) {
      console.log("  ", JSON.stringify(it));
    }
  }
  console.log("");
  console.log("======== サンプル (単一商品 上位3件) ========");
  for (const o of ordersToInsert.slice(0, 3)) {
    console.log(JSON.stringify({
      delivery_date: o.delivery_date,
      delivery_name: o.delivery_name,
      product_name: o.product_name,
      quantity: o.quantity,
      total_amount: o.total_amount,
      status: o.status,
    }));
  }

  // ---------------- 実行 ----------------
  if (DRY_RUN) {
    console.log("");
    console.log("[DRY-RUN] DBへの書き込みは行いませんでした。");
    console.log("本番投入するには: node scripts/import-orders.mjs --execute");
    return;
  }

  // 事前確認: orders が空であること
  const { count: existingCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });
  if ((existingCount ?? 0) > 0) {
    console.error("");
    console.error(`⚠ orders テーブルに既に ${existingCount} 件のデータがあります。`);
    console.error("再実行する場合は、先に orders / order_items / order_status_logs をクリアしてください。");
    process.exit(1);
  }

  console.log("");
  console.log(`[EXECUTE] orders ${ordersToInsert.length} 件を投入します...`);
  const batchSize = 500;
  for (let i = 0; i < ordersToInsert.length; i += batchSize) {
    const batch = ordersToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("orders").insert(batch);
    if (error) {
      console.error(`  バッチ ${i}-${i + batch.length} でエラー:`, error);
      throw error;
    }
    if ((i + batch.length) % 5000 === 0 || i + batch.length === ordersToInsert.length) {
      console.log(`  orders: ${i + batch.length}/${ordersToInsert.length}`);
    }
  }

  console.log(`[EXECUTE] order_items ${itemsToInsert.length} 件を投入します...`);
  for (let i = 0; i < itemsToInsert.length; i += batchSize) {
    const batch = itemsToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("order_items").insert(batch);
    if (error) {
      console.error(`  バッチ ${i}-${i + batch.length} でエラー:`, error);
      throw error;
    }
    if ((i + batch.length) % 5000 === 0 || i + batch.length === itemsToInsert.length) {
      console.log(`  order_items: ${i + batch.length}/${itemsToInsert.length}`);
    }
  }

  console.log("");
  console.log(`✅ 完了: orders ${ordersToInsert.length} / order_items ${itemsToInsert.length} を投入`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
