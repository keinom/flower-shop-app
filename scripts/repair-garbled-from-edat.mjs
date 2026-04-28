#!/usr/bin/env node
/**
 * 文字化け delivery_name を e.dat の memo から復元
 *
 * 流れ:
 *   1. DB の orders から delivery_name に U+FFFD を含むレコードを取得
 *   2. remarks の【旧伝票キー: NNN】からキーを抽出
 *   3. e-dat-headers.json (memo フィールド) と突合
 *   4. memo が U+FFFD を含まず、ある程度の長さがあれば置換候補に
 *   5. dry-run: レポート / execute: 更新
 *
 * 使い方:
 *   node scripts/repair-garbled-from-edat.mjs --dry-run
 *   node scripts/repair-garbled-from-edat.mjs --execute
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";

loadEnv();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function isGarbled(s) {
  if (!s) return false;
  return s.includes("�") || s.includes("◆");
}

const ADDR_PREFIX_RE = /(東京都|大阪府|大阪市|京都府|神奈川県|千葉県|千葉市|埼玉県|兵庫県|愛知県|福岡県|北海道|横浜市|川崎市|名古屋市|港区|中央区|千代田区|新宿区|渋谷区|目黒区|大田区|品川区|世田谷区|文京区|台東区|江東区|墨田区|豊島区|北区|荒川区|足立区|葛飾区|江戸川区|杉並区|中野区|練馬区|板橋区|〒\d{3})/;

// memo の住所部分を除去（住所キーワードが現れたらそこで切る）
function stripAddress(s) {
  if (!s) return s;
  const m = s.match(ADDR_PREFIX_RE);
  if (!m) return s;
  return s.slice(0, m.index).trim();
}

function looksLikeAddress(s) {
  if (!s) return false;
  if (/^[\s　]*(東京都|大阪|京都|神奈川|千葉|埼玉|兵庫|愛知|福岡|北海道)/.test(s)) return true;
  if (/^[\s　]*\d{3}[-‐]?\d{4}/.test(s)) return true;
  if (/^[\s　]*〒/.test(s)) return true;
  return false;
}

// 文字化け以前の prefix を取り出す（先頭から U+FFFD 直前まで）
function garbledPrefix(s) {
  const idx = s.indexOf("�");
  if (idx === -1) return s;
  return s.slice(0, idx).trim();
}

// 数文字以上のオーバーラップがあるか
function hasMeaningfulOverlap(prefix, memo) {
  if (!prefix || !memo) return false;
  // 先頭 2-3 文字でも一致すれば可
  for (let len = Math.min(prefix.length, 6); len >= 2; len--) {
    const sub = prefix.slice(0, len).replace(/\s/g, "");
    if (sub.length < 2) continue;
    if (memo.includes(sub)) return true;
  }
  return false;
}

async function fetchGarbledOrders() {
  // PostgREST では U+FFFD を直接 like できないので、サーバーサイドで RPC が必要だが、
  // 代わりに remarks フラグでフィルタ
  const all = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb
      .from("orders")
      .select("id, delivery_name, remarks")
      .like("remarks", "%【delivery_name文字化け・要確認】%")
      .range(off, off + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log(`mode: ${MODE}`);

  // 1. e-dat memo マップ
  console.log("loading e-dat-headers...");
  const headers = JSON.parse(readFileSync(resolve(process.cwd(), "data/import/e-dat-headers.json"), "utf8"));
  const memoByKey = new Map();
  for (const h of headers) memoByKey.set(h.key, h.memo);
  console.log(`  ${memoByKey.size} keys`);

  // 2. 文字化けレコード取得
  console.log("fetching garbled orders...");
  const garbled = await fetchGarbledOrders();
  console.log(`  ${garbled.length} records`);

  // 3. 突合
  const keyRE = /【旧伝票キー:\s*(\d+)】/;
  const updates = [];
  const stats = {
    noKey: 0,
    keyNotFound: 0,
    memoStillGarbled: 0,
    memoLooksLikeAddress: 0,
    memoTooShort: 0,
    sameAsCurrent: 0,
    noOverlap: 0,
    candidate: 0,
  };
  const review = []; // 候補だがオーバーラップなし（ユーザーが手動で見るべき）
  for (const o of garbled) {
    const m = o.remarks?.match(keyRE);
    if (!m) { stats.noKey++; continue; }
    let memo = memoByKey.get(m[1]);
    if (memo === undefined) { stats.keyNotFound++; continue; }

    if (isGarbled(memo)) { stats.memoStillGarbled++; continue; }
    if (looksLikeAddress(memo)) { stats.memoLooksLikeAddress++; continue; }

    // 住所成分を除去
    memo = stripAddress(memo).trim();
    if (!memo || memo.replace(/[\s　]/g, "").length < 2) { stats.memoTooShort++; continue; }
    if (memo === o.delivery_name) { stats.sameAsCurrent++; continue; }

    // 文字化け前の prefix と memo のオーバーラップ確認
    const prefix = garbledPrefix(o.delivery_name);
    if (!hasMeaningfulOverlap(prefix, memo)) {
      review.push({ id: o.id, key: m[1], from: o.delivery_name, memo });
      stats.noOverlap++;
      continue;
    }

    const newRemarks = (o.remarks ?? "").replace("【delivery_name文字化け・要確認】", "");
    updates.push({ id: o.id, old_key: m[1], from: o.delivery_name, to: memo, new_remarks: newRemarks });
    stats.candidate++;
  }

  console.log("\n======== 復元プラン ========");
  console.log(`総文字化け:           ${garbled.length}`);
  console.log(`復元候補:             ${stats.candidate}`);
  console.log(`memo自体も文字化け:   ${stats.memoStillGarbled}`);
  console.log(`memo が住所形式:      ${stats.memoLooksLikeAddress}`);
  console.log(`memo 短すぎ:          ${stats.memoTooShort}`);
  console.log(`memo === 現値:        ${stats.sameAsCurrent}`);
  console.log(`オーバーラップなし:   ${stats.noOverlap} (要確認)`);
  console.log(`旧伝票キーなし:       ${stats.noKey}`);
  console.log(`キーが e.dat に無し:  ${stats.keyNotFound}`);

  console.log("\n-- 復元サンプル (先頭25件) --");
  for (const u of updates.slice(0, 25)) {
    console.log(`  "${u.from}"`);
    console.log(`   → "${u.to}"`);
  }

  console.log("\n-- オーバーラップなし サンプル (10件、要確認) --");
  for (const r of review.slice(0, 10)) {
    console.log(`  "${r.from}"  →  memo:"${r.memo}"`);
  }

  // 出力
  const outPath = resolve(process.cwd(), "data/import/garbled-repair-plan.json");
  writeFileSync(outPath, JSON.stringify({ stats, updates, review }, null, 2));
  console.log(`\n書き出し: ${outPath}`);

  if (MODE !== "execute") {
    console.log("\n(dry-run) 書き込みは行いません");
    return;
  }

  // execute
  console.log("\n=== 実行 ===");
  let ok = 0, fail = 0;
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await Promise.all(chunk.map(async (u) => {
      const { error } = await sb.from("orders")
        .update({ delivery_name: u.to, remarks: u.new_remarks })
        .eq("id", u.id);
      if (error) { fail++; console.error(`fail ${u.id}:`, error.message); }
      else ok++;
    }));
    process.stdout.write(`\r  ${ok}/${updates.length} (fail ${fail})`);
  }
  console.log(`\n✅ ${ok} 件復元 (失敗 ${fail})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
