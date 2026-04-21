/**
 * 顧客マスタ移行スクリプト
 *
 * 対象:
 *   - A.csv (147件): 現役得意先。住所・電話・郵便番号を含む完全情報
 *   - invoice_headers_with_customer.csv: 過去伝票に登場するが A.csv にない得意先
 *     (474件想定, 名前のみ)
 *
 * 方針 (ユーザー確認済):
 *   - 部署名は name に結合 (「得意先名 部署名」)
 *   - 得意先コードは notes に 【旧コード: XXXXX】 形式で保持 (伝票紐付け用)
 *   - 旧データのみの顧客は notes に【旧データ・要連絡先更新】も付与
 *   - 得意先コードのみで名前不明の伝票は Phase 1 対象外 (Q5 案C)
 *
 * 使い方:
 *   node scripts/import-customers.mjs --dry-run
 *   node scripts/import-customers.mjs --execute
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCSV, rowsToObjects } from "./lib/csv.mjs";
import { loadEnv } from "./lib/env.mjs";

// ------------------------------------------------------------
// CLI 引数
// ------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const EXECUTE = args.includes("--execute");

if (!DRY_RUN && !EXECUTE) {
  console.error("使い方: node scripts/import-customers.mjs [--dry-run | --execute]");
  process.exit(1);
}
if (DRY_RUN && EXECUTE) {
  console.error("--dry-run と --execute は同時指定できません");
  process.exit(1);
}

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

/** 郵便番号を正規化 (7桁数字 → XXX-XXXX, それ以外は null) */
function normalizePostalCode(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 7) return null;
  return digits.slice(0, 3) + "-" + digits.slice(3);
}

/** 住所結合: 住所１ + (住所２の先頭空白除去) */
function buildAddress(addr1, addr2) {
  const a1 = (addr1 ?? "").trim();
  const a2 = (addr2 ?? "").replace(/^[\s\u3000]+/, "").trim();
  if (!a1 && !a2) return null;
  if (!a2) return a1;
  if (!a1) return a2;
  return a1 + a2;
}

/** 名前結合: 得意先名 + (部署名あれば半角スペース挟んで付加) */
function buildName(customerName, dept) {
  const n = (customerName ?? "").trim();
  const d = (dept ?? "").trim();
  if (!n) return null;
  if (!d) return n;
  return n + " " + d;
}

/** 電話番号: 空白trimのみ、それ以外はそのまま保持 */
function normalizePhone(raw) {
  const s = (raw ?? "").trim();
  return s || null;
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

  const importDir = resolve(process.cwd(), "data/import");

  // ---------------- A.csv 読み込み ----------------
  console.log("[1/3] A.csv を読み込み中...");
  const aText = readFileSync(resolve(importDir, "A.csv"), "utf-8");
  const aRecords = rowsToObjects(parseCSV(aText));
  console.log(`  → ${aRecords.length} 行`);

  // ---------------- invoice_headers_with_customer.csv 読み込み ----------------
  console.log("[2/3] invoice_headers_with_customer.csv を読み込み中...");
  const ihText = readFileSync(
    resolve(importDir, "invoice_headers_with_customer.csv"),
    "utf-8",
  );
  const ihRecords = rowsToObjects(parseCSV(ihText));
  console.log(`  → ${ihRecords.length} 行`);

  // ---------------- 顧客データ構築 ----------------
  console.log("[3/3] 顧客データをマージ中...");

  /** 得意先コード → 顧客レコード */
  const customers = new Map();
  let skipEmptyName = 0;

  // Step 1: A.csv から完全情報を登録
  for (const r of aRecords) {
    const code = (r["得意先コード"] ?? "").trim();
    const name = buildName(r["得意先名"], r["部署名"]);
    if (!code) continue;
    if (!name) {
      skipEmptyName++;
      continue;
    }
    customers.set(code, {
      source: "A",
      code,
      name,
      phone: normalizePhone(r["電話番号"]),
      postal_code: normalizePostalCode(r["郵便番号"]),
      address: buildAddress(r["住所１"], r["住所２"]),
      email: null,
      notes: `【旧コード: ${code}】`,
    });
  }

  // Step 2: invoice_headers から A.csv にない得意先を追加
  let historicalAdded = 0;
  let unknownSkipped = 0;
  const seenCodesWithoutName = new Set();

  for (const r of ihRecords) {
    const code = (r["得意先コード"] ?? "").trim();
    if (!code) continue;
    if (customers.has(code)) continue; // A.csv 優先

    const name = buildName(r["得意先名"], r["部署名"]);
    if (!name) {
      seenCodesWithoutName.add(code);
      continue;
    }

    customers.set(code, {
      source: "IH",
      code,
      name,
      phone: null,
      postal_code: null,
      address: null,
      email: null,
      notes: `【旧コード: ${code}】【旧データ・要連絡先更新】`,
    });
    historicalAdded++;
  }
  unknownSkipped = seenCodesWithoutName.size;

  // ---------------- サマリ ----------------
  const list = Array.from(customers.values());
  const aCount = list.filter((c) => c.source === "A").length;
  const ihCount = list.filter((c) => c.source === "IH").length;

  console.log("");
  console.log("======== 投入サマリ ========");
  console.log(`A.csv 由来 (現役): ${aCount} 件`);
  console.log(`invoice_headers 由来 (休眠): ${ihCount} 件`);
  console.log(`合計: ${list.length} 件`);
  console.log("");
  console.log(`[参考] A.csv 名前空でスキップ: ${skipEmptyName} 件`);
  console.log(`[参考] 得意先コードのみで名前不明のためスキップ: ${unknownSkipped} 件 (Q5案C)`);

  // データ品質統計
  const withPostal = list.filter((c) => c.postal_code).length;
  const withPhone = list.filter((c) => c.phone).length;
  const withAddress = list.filter((c) => c.address).length;
  console.log("");
  console.log("======== データ品質 ========");
  console.log(`郵便番号あり: ${withPostal}/${list.length}`);
  console.log(`電話番号あり: ${withPhone}/${list.length}`);
  console.log(`住所あり: ${withAddress}/${list.length}`);

  // サンプル表示
  console.log("");
  console.log("======== サンプル (A.csv由来 上位5件) ========");
  for (const c of list.filter((c) => c.source === "A").slice(0, 5)) {
    console.log(JSON.stringify(c, null, 2));
  }
  console.log("");
  console.log("======== サンプル (休眠 上位5件) ========");
  for (const c of list.filter((c) => c.source === "IH").slice(0, 5)) {
    console.log(JSON.stringify(c, null, 2));
  }

  // ---------------- 投入 ----------------
  if (DRY_RUN) {
    console.log("");
    console.log("[DRY-RUN] DBへの書き込みは行いませんでした。");
    console.log("本番投入するには: node scripts/import-customers.mjs --execute");
    return;
  }

  console.log("");
  console.log(`[EXECUTE] ${list.length} 件を Supabase に投入します...`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // バッチ分割 (100件ずつ)
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize).map((c) => ({
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      postal_code: c.postal_code,
      notes: c.notes,
    }));
    const { error } = await supabase.from("customers").insert(batch);
    if (error) {
      console.error(`  バッチ ${i}-${i + batch.length} でエラー:`, error);
      throw error;
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${list.length} 件 投入済`);
  }

  console.log("");
  console.log(`✅ 完了: ${inserted} 件の顧客を投入しました。`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
