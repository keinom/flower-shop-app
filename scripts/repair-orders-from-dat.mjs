#!/usr/bin/env node
// 注文データ修復:
//   (1) 化けた delivery_name → 顧客マスタの現在 name で置換
//   (2) product_name="（商品明細なし）"系 → f.dat +92 の商品名で補完
//
// 旧伝票キー (21桁 = YYYYMMDD + NNNNNNN + MMMMMM) で f.dat と突合。
// 明細行は複数あるので「generic でない最初の +92」を採用。
//
// 使い方:
//   node scripts/repair-orders-from-dat.mjs --dry-run
//   node scripts/repair-orders-from-dat.mjs --execute

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const lines = JSON.parse(readFileSync("data/import/f-dat-lines.json", "utf8"));

// index by (order_date + order_no)
const linesByOrder = new Map();
for (const l of lines) {
  const k = `${l.order_date}-${l.order_no}`;
  if (!linesByOrder.has(k)) linesByOrder.set(k, []);
  linesByOrder.get(k).push(l);
}
console.log(`f.dat unique orders: ${linesByOrder.size}, lines: ${lines.length}`);

// DB で既に入っている generic 商品名（これらは置換対象）
const GENERIC_DB_PRODUCT = new Set([
  "（商品明細なし）",
  "（商品名なし）",
  "(商品明細なし)",
  "(商品名なし)",
]);

// f.dat +92 でスキップすべき generic 値（delivery でなく意味のある商品名だけ採用）
const GENERIC_FDAT = new Set([
  "消費税",
  "値引",
  "手数料",
  "他",
  "税",
  "",
]);

function isGenericFDat(text) {
  if (!text) return true;
  if (GENERIC_FDAT.has(text)) return true;
  if (/^[\s　]+$/.test(text)) return true;
  return false;
}

function isGarbled(s) {
  if (!s) return false;
  return s.includes("◆") || s.includes("\uFFFD");
}

function extractOrderKey(remarks) {
  const m = remarks?.match(/【旧伝票キー:\s*(\d{8})(\d{7})(\d+)】/);
  if (!m) return null;
  return { date: m[1], no: m[2], sub: m[3] };
}

// f.dat 明細から商品名候補を拾う（+92 優先 → +122 フォールバック）
function pickProductNameFromFDat(orderLines) {
  const picks92 = [];
  const picks122 = [];
  for (const l of orderLines) {
    for (const s of l.segments ?? []) {
      if (s.off === 92) picks92.push(s.text);
      else if (s.off === 122) picks122.push(s.text);
    }
  }
  // 商品らしい値: generic じゃない / 3文字以上優先
  for (const t of picks92) if (!isGenericFDat(t) && t.length >= 2) return t;
  for (const t of picks122) if (!isGenericFDat(t) && t.length >= 2) return t;
  return null;
}

async function main() {
  console.log(`mode: ${MODE}`);

  // 顧客マスタ
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .range(0, 9999);
  const custNameById = new Map(customers.map((c) => [c.id, c.name]));

  // ページング取得（10000件制限対策）
  async function fetchAll(filter) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      let q = supabase.from("orders").select("id, customer_id, delivery_name, product_name, remarks");
      q = filter(q).range(offset, offset + 999);
      const { data, error } = await q;
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return all;
  }

  // (1) 化け delivery_name 対象
  const garbled = await fetchAll((q) =>
    q.or("delivery_name.like.*◆*,delivery_name.like.*\uFFFD*")
  );
  console.log(`garbled delivery_name orders: ${garbled.length}`);

  // (2) "（商品明細なし）" 系
  const emptyProduct = await fetchAll((q) =>
    q.in("product_name", ["（商品明細なし）", "（商品名なし）", "(商品明細なし)", "(商品名なし)"])
  );
  console.log(`empty-product orders: ${emptyProduct.length}`);

  // plan A: 化け delivery_name を安全に修復
  //   条件: 化け文字 (◆/U+FFFD) の前の非空白3文字以上 (NFKC 正規化) が
  //         顧客名の NFKC 表現に部分一致する場合のみ、顧客名で上書き。
  //   それ以外は flag-only (remarks に注記を追加)。
  function cleanChars(s) {
    // 化け文字・空白・記号を除去した正規化文字列
    return (s ?? "")
      .normalize("NFKC")
      .replace(/[◆\uFFFD\s　･・「」『』（）()〈〉\[\]【】,、。.\-ー－—:：]/g, "");
  }
  function overlapRatio(a, b) {
    if (!a || !b) return 0;
    const setB = new Set([...b]);
    let hit = 0;
    for (const ch of new Set([...a])) if (setB.has(ch)) hit++;
    return hit / new Set([...a]).size;
  }
  const planA = [];
  const planAFlag = [];
  for (const o of garbled) {
    const cname = custNameById.get(o.customer_id);
    const cleanDeliv = cleanChars(o.delivery_name);
    const cleanCust = cleanChars(cname);
    // 化けを除去した delivery の文字群が、顧客名に 70% 以上重なれば「顧客名と同一」とみなす
    const ratio = overlapRatio(cleanDeliv, cleanCust);
    const prefixMatches =
      cname &&
      !isGarbled(cname) &&
      cleanDeliv.length >= 3 &&
      ratio >= 0.7;
    if (prefixMatches && o.delivery_name !== cname) {
      planA.push({ id: o.id, before: o.delivery_name, after: cname });
    } else {
      // 修復できないもの: remarks に注記を追加（既に付いてなければ）
      const flag = "【delivery_name文字化け・要確認】";
      const newRemarks = (o.remarks ?? "").includes(flag)
        ? null
        : `${o.remarks ?? ""}${flag}`;
      if (newRemarks !== null) {
        planAFlag.push({ id: o.id, delivery: o.delivery_name, remarks: newRemarks });
      }
    }
  }

  // plan B: product_name = f.dat +92
  const planB = [];
  let hitFDat = 0, missFDat = 0;
  for (const o of emptyProduct) {
    const key = extractOrderKey(o.remarks);
    if (!key) continue;
    const ls = linesByOrder.get(`${key.date}-${key.no}`);
    if (!ls) { missFDat++; continue; }
    const clean = pickProductNameFromFDat(ls);
    if (!clean) { missFDat++; continue; }
    hitFDat++;
    if (clean === o.product_name) continue;
    planB.push({ id: o.id, before: o.product_name, after: clean });
  }

  console.log(`\n== Plan A: delivery_name ==`);
  console.log(`  replace with customer name: ${planA.length}`);
  for (const u of planA.slice(0, 8)) console.log(`  "${u.before}" → "${u.after}"`);
  console.log(`  flag-only (requires manual review): ${planAFlag.length}`);
  for (const u of planAFlag.slice(0, 8)) console.log(`  "${u.delivery}" → flag added`);

  console.log(`\n== Plan B: product_name ==`);
  console.log(`  f.dat hit: ${hitFDat}, miss: ${missFDat}`);
  console.log(`  updates: ${planB.length}`);
  for (const u of planB.slice(0, 8)) console.log(`  "${u.before}" → "${u.after}"`);

  if (MODE !== "execute") {
    console.log("\n(dry-run)");
    return;
  }

  async function applyUpdates(plan, field) {
    let ok = 0;
    const BATCH = 100;
    for (let i = 0; i < plan.length; i += BATCH) {
      const chunk = plan.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (u) => {
          const { error } = await supabase
            .from("orders")
            .update({ [field]: u.after })
            .eq("id", u.id);
          if (error) console.error(`\nfail ${u.id}:`, error.message);
          else ok++;
        })
      );
      process.stdout.write(`\r[${field}] ${ok}/${plan.length}`);
    }
    console.log();
    return ok;
  }

  console.log("\napplying Plan A (replace)...");
  const okA = await applyUpdates(planA, "delivery_name");

  console.log("\napplying Plan A (flag)...");
  let okFlag = 0;
  const BATCH = 100;
  for (let i = 0; i < planAFlag.length; i += BATCH) {
    const chunk = planAFlag.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async (u) => {
        const { error } = await supabase
          .from("orders")
          .update({ remarks: u.remarks })
          .eq("id", u.id);
        if (error) console.error(`\nfail ${u.id}:`, error.message);
        else okFlag++;
      })
    );
    process.stdout.write(`\r[flag] ${okFlag}/${planAFlag.length}`);
  }
  console.log();

  console.log("\napplying Plan B...");
  const okB = await applyUpdates(planB, "product_name");
  console.log(`\n✅ delivery_name replaced: ${okA}/${planA.length}`);
  console.log(`✅ flag added:             ${okFlag}/${planAFlag.length}`);
  console.log(`✅ product_name updated:   ${okB}/${planB.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
