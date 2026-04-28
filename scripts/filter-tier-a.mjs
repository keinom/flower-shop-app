#!/usr/bin/env node
/**
 * Tier A 候補抽出: 高確度のコード流用ケースのみ絞り込み
 *
 * 条件:
 *   - top_old_owner_name の jaccard < 0.2（≒ 別顧客）
 *   - 乖離注文数 ≥ 5
 *   - 現所有者名が「地方発送」「その他」系の汎用バケットでない
 *
 * 出力:
 *   data/import/code-reuse-tier-a.json
 *   コンソールに一覧
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const planPath = resolve(process.cwd(), "data/import/code-reuse-plan.json");
const plan = JSON.parse(readFileSync(planPath, "utf8"));

// 汎用バケット顧客（分離対象外）
const GENERIC_BUCKETS = [
  "地方発送", "地方発送（税込）", "地方発送(税込)",
  "その他", "不明", "児山事務所　児山", "店頭",
];
function isGenericBucket(name) {
  if (!name) return false;
  const n = name.replace(/\s/g, "");
  return GENERIC_BUCKETS.some((g) => n.includes(g.replace(/\s/g, "")));
}

function norm(s) {
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

const tierA = [];
const rejected = { lowOrders: 0, highSim: 0, generic: 0 };

for (const r of plan.reuseCodes) {
  if (r.diverged_orders < 5) { rejected.lowOrders++; continue; }
  if (isGenericBucket(r.current_name)) { rejected.generic++; continue; }

  // top_old_owner の類似度
  const simTop = jaccard(norm(r.current_name), norm(r.top_old_owner_name));
  if (simTop >= 0.2) { rejected.highSim++; continue; }

  tierA.push({
    ...r,
    sim_top: +simTop.toFixed(3),
  });
}

tierA.sort((a, b) => b.diverged_orders - a.diverged_orders);

// 出力
console.log(`\n======== Tier A 候補 ========`);
console.log(`対象: ${tierA.length} コード, 乖離注文合計 ${tierA.reduce((s,r)=>s+r.diverged_orders,0)} 件`);
console.log(`\n除外理由:`);
console.log(`  件数<5:       ${rejected.lowOrders}`);
console.log(`  類似度≥0.2:   ${rejected.highSim}`);
console.log(`  汎用バケット: ${rejected.generic}`);

console.log(`\n--- Tier A 一覧（乖離件数順） ---`);
console.log(`code   | 類似度 | 現所有者 → 旧所有者推定 | 乖離 / 全件 | 期間`);
for (const r of tierA) {
  const d = `${r.date_range.first}～${r.date_range.last}`;
  console.log(`${r.code.padEnd(6)} | ${r.sim_top.toFixed(2)} | "${r.current_name}" → "${r.top_old_owner_name}" | ${r.diverged_orders}/${r.total_orders} | ${d}`);
}

// JSON
const outPath = resolve(process.cwd(), "data/import/code-reuse-tier-a.json");
writeFileSync(outPath, JSON.stringify({
  summary: {
    count: tierA.length,
    diverged_total: tierA.reduce((s,r)=>s+r.diverged_orders,0),
    rejected,
  },
  tierA,
}, null, 2));
console.log(`\n書き出し: ${outPath}`);
