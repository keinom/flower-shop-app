#!/usr/bin/env node
/**
 * Tier B 解析: 類似度 0.2〜0.5 の中確度乖離ケースを分類
 *
 * 入力: data/import/code-reuse-plan.json
 *
 * 出力:
 *   - data/import/tier-b-report.json
 *   - data/import/tier-b-review.csv (Excel等で確認用)
 *
 * 分類:
 *   1. variant       : 一方が他方の部分文字列（同一顧客の略称/部署違い）
 *   2. typo          : 編集距離 1〜2（タイポレベル）
 *   3. weak-reuse    : 上記いずれでもない（弱い流用候補）
 *   4. dummy-bucket  : 現所有者が地方発送系
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const planPath = resolve(process.cwd(), "data/import/code-reuse-plan.json");
const plan = JSON.parse(readFileSync(planPath, "utf8"));

function normalize(s) {
  if (!s) return "";
  return s.normalize("NFKC")
    .replace(/[\s　･・「」『』（）()〈〉\[\]【】,、。.\-ー－—:：]/g, "")
    .toLowerCase();
}
function jaccard(a, b) {
  const A = new Set([...a]), B = new Set([...b]);
  let inter = 0;
  for (const ch of A) if (B.has(ch)) inter++;
  return inter / (A.size + B.size - inter);
}
function editDistance(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

const GENERIC_BUCKETS = ["地方発送", "その他", "不明", "店頭", "児山事務所　児山"];
function isGenericBucket(name) {
  if (!name) return false;
  const n = name.replace(/\s/g, "");
  return GENERIC_BUCKETS.some((g) => n.includes(g.replace(/\s/g, "")));
}

const buckets = { variant: [], typo: [], weakReuse: [], dummyBucket: [] };

for (const r of plan.reuseCodes) {
  if (r.diverged_orders < 5) continue;
  const normCur = normalize(r.current_name);
  const normOld = normalize(r.top_old_owner_name);
  const sim = jaccard(normCur, normOld);
  if (sim < 0.2 || sim >= 0.5) continue; // Tier A や類似度高は除外

  if (isGenericBucket(r.current_name)) {
    buckets.dummyBucket.push({ ...r, sim: +sim.toFixed(2) });
    continue;
  }

  // 一方が他方の部分文字列 → variant
  if (normCur.includes(normOld) || normOld.includes(normCur)) {
    buckets.variant.push({ ...r, sim: +sim.toFixed(2), kind: "substring" });
    continue;
  }

  // 編集距離による typo 判定 (短い方の長さの 30% 以下)
  const ed = editDistance(normCur, normOld);
  const minLen = Math.min(normCur.length, normOld.length);
  if (minLen > 0 && ed / minLen <= 0.3) {
    buckets.typo.push({ ...r, sim: +sim.toFixed(2), edit_distance: ed });
    continue;
  }

  buckets.weakReuse.push({ ...r, sim: +sim.toFixed(2) });
}

const tot = (b) => b.reduce((s, r) => s + r.diverged_orders, 0);
console.log("======== Tier B 分類 ========");
console.log(`variant (略称・部分一致):      ${buckets.variant.length} コード / ${tot(buckets.variant)} 件`);
console.log(`typo (編集距離小):              ${buckets.typo.length} コード / ${tot(buckets.typo)} 件`);
console.log(`weakReuse (弱い流用候補):       ${buckets.weakReuse.length} コード / ${tot(buckets.weakReuse)} 件`);
console.log(`dummyBucket (汎用バケット):     ${buckets.dummyBucket.length} コード / ${tot(buckets.dummyBucket)} 件`);

console.log("\n-- variant Top 15 --");
buckets.variant.sort((a,b) => b.diverged_orders - a.diverged_orders);
for (const r of buckets.variant.slice(0, 15)) {
  console.log(`  [${r.code}] "${r.current_name}" vs "${r.top_old_owner_name}"  ${r.diverged_orders}件`);
}

console.log("\n-- typo Top 15 --");
buckets.typo.sort((a,b) => b.diverged_orders - a.diverged_orders);
for (const r of buckets.typo.slice(0, 15)) {
  console.log(`  [${r.code}] "${r.current_name}" vs "${r.top_old_owner_name}" (ed=${r.edit_distance})  ${r.diverged_orders}件`);
}

console.log("\n-- weakReuse Top 20 --");
buckets.weakReuse.sort((a,b) => b.diverged_orders - a.diverged_orders);
for (const r of buckets.weakReuse.slice(0, 20)) {
  console.log(`  [${r.code}] sim=${r.sim} "${r.current_name}" → "${r.top_old_owner_name}"  ${r.diverged_orders}件`);
}

console.log("\n-- dummyBucket --");
for (const r of buckets.dummyBucket) {
  console.log(`  [${r.code}] "${r.current_name}" ← "${r.top_old_owner_name}"  ${r.diverged_orders}件`);
}

// CSV 書き出し（人間レビュー用）
const csvLines = ["category,code,sim,current_name,old_name,diverged_orders,total_orders,date_first,date_last,decision"];
function escCsv(s) {
  if (s == null) return "";
  const t = String(s).replace(/"/g, '""');
  return /[,"\n]/.test(t) ? `"${t}"` : t;
}
const all = [
  ...buckets.variant.map((r) => ["variant", r]),
  ...buckets.typo.map((r) => ["typo", r]),
  ...buckets.weakReuse.map((r) => ["weakReuse", r]),
  ...buckets.dummyBucket.map((r) => ["dummyBucket", r]),
];
for (const [cat, r] of all) {
  csvLines.push([
    cat, r.code, r.sim, escCsv(r.current_name), escCsv(r.top_old_owner_name),
    r.diverged_orders, r.total_orders, r.date_range.first, r.date_range.last, "",
  ].join(","));
}
writeFileSync(resolve(process.cwd(), "data/import/tier-b-review.csv"), csvLines.join("\n"));
writeFileSync(resolve(process.cwd(), "data/import/tier-b-report.json"), JSON.stringify(buckets, null, 2));

console.log("\n書き出し:");
console.log("  data/import/tier-b-report.json");
console.log("  data/import/tier-b-review.csv");
