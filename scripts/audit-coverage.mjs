#!/usr/bin/env node
// Phase 2: e.dat ヘッダ集合 vs DB orders 集合 の突合監査

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const eHeaders = JSON.parse(readFileSync("data/import/e-dat-headers.json", "utf8"));
const byKey = new Map();
for (const r of eHeaders) byKey.set(r.key, r);
console.log(`e.dat unique records: ${eHeaders.length}`);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Fetch all orders with 履歴 status
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

// Build DB key → order map
const dbByKey = new Map();
let dbNoKey = 0;
for (const o of dbOrders) {
  const m = (o.remarks || "").match(/【旧伝票キー:\s*(\d{21})】/);
  if (!m) { dbNoKey++; continue; }
  dbByKey.set(m[1], o);
}
console.log(`DB with parseable key: ${dbByKey.size}  (without key: ${dbNoKey})`);

// Coverage
const eKeys = new Set(byKey.keys());
const dKeys = new Set(dbByKey.keys());
const overlap = [...eKeys].filter((k) => dKeys.has(k)).length;
const missingInDb = [...eKeys].filter((k) => !dKeys.has(k));
const orphanInDb = [...dKeys].filter((k) => !eKeys.has(k));
console.log("");
console.log(`overlap (in both): ${overlap}`);
console.log(`missing in DB (e.dat has it, DB doesn't): ${missingInDb.length}`);
console.log(`orphan in DB (DB has it, e.dat doesn't): ${orphanInDb.length}`);

// Amount mismatch audit
let exact = 0, offByOne = 0, offByMore = 0, zeroZero = 0, dbZeroEnonz = 0, edatNull = 0;
const severeSamples = [];
for (const [k, o] of dbByKey) {
  const e = byKey.get(k);
  if (!e) continue;
  if (e.total_amount === null) { edatNull++; continue; }
  const predicted = Math.abs(e.total_amount);
  const db = o.total_amount;
  if (db === 0 && predicted === 0) zeroZero++;
  else if (db === 0 && predicted > 0) {
    dbZeroEnonz++;
    if (severeSamples.length < 10) severeSamples.push({ key: k, db, predicted, memo: e.memo });
  } else {
    const d = predicted - db;
    if (d === 0) exact++;
    else if (Math.abs(d) <= 1) offByOne++;
    else offByMore++;
  }
}
console.log("");
console.log("=== Amount audit ===");
console.log(`exact match:      ${exact}`);
console.log(`off by 1 yen:     ${offByOne}`);
console.log(`off by >1 yen:    ${offByMore}`);
console.log(`both zero:        ${zeroZero}`);
console.log(`DB zero but e.dat >0: ${dbZeroEnonz}  ← main bug target`);
console.log(`e.dat null decode: ${edatNull}`);
console.log("\nsevere 'DB zero but e.dat > 0' samples:");
for (const s of severeSamples) console.log(" ", s);

// Missing in DB: why? Check if customer code exists
console.log("\n=== missing-in-DB analysis ===");
console.log(`sample missing keys (first 10):`);
for (const k of missingInDb.slice(0, 10)) {
  const e = byKey.get(k);
  console.log(`  ${k} cust=${e.customer_code} total=${e.total_amount} memo=${e.memo?.slice(0,30)}`);
}

// Load customer map to check
const codeToCustomer = new Map();
let cFrom = 0;
while (true) {
  const { data, error } = await sb.from("customers").select("id, notes").range(cFrom, cFrom + 999);
  if (error) throw error;
  if (!data || data.length === 0) break;
  for (const c of data) {
    const m = c.notes?.match(/【旧コード:\s*([^】]+)】/);
    if (m) codeToCustomer.set(m[1], c);
  }
  if (data.length < 1000) break;
  cFrom += 1000;
}
console.log(`customers with 旧コード: ${codeToCustomer.size}`);

let missingHasCustomer = 0, missingNoCustomer = 0;
const noCustCodes = new Map();
for (const k of missingInDb) {
  const e = byKey.get(k);
  if (codeToCustomer.has(e.customer_code)) missingHasCustomer++;
  else {
    missingNoCustomer++;
    noCustCodes.set(e.customer_code, (noCustCodes.get(e.customer_code) || 0) + 1);
  }
}
console.log(`  missing in DB & customer EXISTS: ${missingHasCustomer}  ← recoverable`);
console.log(`  missing in DB & customer NOT FOUND: ${missingNoCustomer}`);
const topNoCust = [...noCustCodes.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 10);
console.log("  top 'no-customer' codes:");
for (const [code, c] of topNoCust) console.log(`    ${code}: ${c} records`);

// Orphan in DB samples
console.log("\n=== orphan-in-DB (DB has, e.dat doesn't) samples ===");
for (const k of orphanInDb.slice(0, 10)) {
  const o = dbByKey.get(k);
  console.log(`  ${k} total=${o.total_amount}`);
}
