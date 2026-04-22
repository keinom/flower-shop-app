import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const buf = readFileSync("data/import/e.dat");
const REC = 659;
const { recOffs, keys } = JSON.parse(readFileSync("data/import/e-dat-offsets.tmp.json", "utf8"));
const keyToOff = new Map();
for (let i = 0; i < keys.length; i++) if (!keyToOff.has(keys[i])) keyToOff.set(keys[i], recOffs[i]);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: nz } = await sb.from("orders").select("total_amount, remarks, quantity, product_name").eq("status", "履歴").gt("total_amount", 3000).limit(8);

for (const o of nz) {
  const m = o.remarks.match(/【旧伝票キー:\s*(\d{21})】/);
  const off = keyToOff.get(m[1]);
  if (off === undefined) { console.log("NO OFF for", m[1]); continue; }
  const rec = buf.slice(off, off + REC);
  console.log(`\n=== key=${m[1]} total=${o.total_amount} qty=${o.quantity} prod=${(o.product_name||"").slice(0,30)} ===`);
  for (let r = 64; r < 160; r += 20) {
    const hex = [...rec.slice(r, r+20)].map(b=>b.toString(16).padStart(2,'0')).join(' ');
    console.log(`  +${String(r).padStart(3)}: ${hex}`);
  }
  for (let len = 2; len <= 7; len++) {
    for (let x = 23; x <= REC - len; x++) {
      let str = "";
      let ok = true, sign = 0;
      for (let i = 0; i < len; i++) {
        const b = rec[x+i];
        const hi = (b>>4)&0xf, lo = b&0xf;
        if (i < len-1) { if (hi>9||lo>9){ok=false;break;} str += hi+""+lo; }
        else { if (hi>9){ok=false;break;} str += hi+""; sign = lo; }
      }
      if (!ok) continue;
      const v = parseInt(str, 10);
      if ((sign === 0xc || sign === 0xf) && v === o.total_amount) {
        console.log(`  PACKED@+${x} len=${len} = ${v}`);
      }
    }
  }
  for (let x = 23; x + 4 <= REC; x++) {
    const be = ((rec[x]<<24)|(rec[x+1]<<16)|(rec[x+2]<<8)|rec[x+3])>>>0;
    const le = ((rec[x+3]<<24)|(rec[x+2]<<16)|(rec[x+1]<<8)|rec[x])>>>0;
    if (be === o.total_amount) console.log(`  BE32@+${x}=${be}`);
    if (le === o.total_amount) console.log(`  LE32@+${x}=${le}`);
  }
  for (let x = 23; x + 2 <= REC; x++) {
    const be = (rec[x]<<8)|rec[x+1];
    const le = (rec[x+1]<<8)|rec[x];
    if (be === o.total_amount) console.log(`  BE16@+${x}=${be}`);
    if (le === o.total_amount) console.log(`  LE16@+${x}=${le}`);
  }
}
