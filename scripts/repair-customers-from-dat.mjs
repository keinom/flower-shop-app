#!/usr/bin/env node
// 文字化けした顧客レコードを a.dat 由来のクリーンデータで修復する
//
// 対象: customers テーブルのうち name/address に ◆ or U+FFFD(�) を含むもの
// 判定: notes 内の「【旧コード: XXXXX】」から 5桁コードを抽出 → a-dat-clean.json を lookup
// 更新: name, address, postal_code, phone を .dat 側の値で上書き
//
// 使い方:
//   node scripts/repair-customers-from-dat.mjs --dry-run
//   node scripts/repair-customers-from-dat.mjs --execute

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLEAN = JSON.parse(
  readFileSync(path.join(ROOT, "data", "import", "a-dat-clean.json"), "utf8")
);
const cleanByCode = new Map(CLEAN.map((c) => [c.code, c]));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function isGarbled(s) {
  if (!s) return false;
  return s.includes("◆") || s.includes("\uFFFD");
}

function extractOldCode(notes) {
  const m = notes?.match(/【旧コード:\s*(\d{5})】/);
  return m ? m[1] : null;
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  console.log(`mode: ${MODE}`);
  console.log(`clean records loaded: ${CLEAN.length}`);

  const { data: rows, error } = await supabase
    .from("customers")
    .select("id, name, address, phone, postal_code, notes")
    .range(0, 9999);
  if (error) throw error;

  const targets = rows.filter((r) => isGarbled(r.name) || isGarbled(r.address));
  console.log(`garbled customers in DB: ${targets.length}`);

  const updates = [];
  const missing = [];
  for (const r of targets) {
    const code = extractOldCode(r.notes);
    if (!code) {
      missing.push({ id: r.id, name: r.name, reason: "no old code" });
      continue;
    }
    const clean = cleanByCode.get(code);
    if (!clean) {
      missing.push({ id: r.id, name: r.name, code, reason: "not in a.dat" });
      continue;
    }
    updates.push({
      id: r.id,
      code,
      before: { name: r.name, address: r.address, phone: r.phone, postal_code: r.postal_code },
      after: {
        name: trimOrNull(clean.name),
        address: trimOrNull(clean.address),
        phone: trimOrNull(clean.phone),
        postal_code: trimOrNull(clean.postal_code),
      },
    });
  }

  console.log(`\nupdatable: ${updates.length}`);
  for (const u of updates) {
    console.log(`  [${u.code}] "${u.before.name}" → "${u.after.name}"`);
    if (u.after.address) console.log(`       addr: ${u.after.address}`);
    if (u.after.phone) console.log(`       tel:  ${u.after.phone}`);
  }

  if (missing.length) {
    console.log(`\nunresolvable: ${missing.length}`);
    for (const m of missing) console.log(`  `, m);
  }

  if (MODE !== "execute") {
    console.log("\n(dry-run — no changes applied)");
    return;
  }

  let ok = 0;
  for (const u of updates) {
    const patch = {};
    // 既存値が NULL or 化けの時だけ上書き（新しい値が non-null の場合）
    if (u.after.name) patch.name = u.after.name;
    if (u.after.address && !u.before.address) patch.address = u.after.address;
    else if (u.after.address) patch.address = u.after.address; // 住所は .dat 側を優先
    if (u.after.phone && !u.before.phone) patch.phone = u.after.phone;
    if (u.after.postal_code && !u.before.postal_code) patch.postal_code = u.after.postal_code;

    const { error: uerr } = await supabase.from("customers").update(patch).eq("id", u.id);
    if (uerr) {
      console.error(`UPDATE failed for ${u.id}:`, uerr.message);
    } else {
      ok++;
    }
  }
  console.log(`\nupdated: ${ok}/${updates.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
