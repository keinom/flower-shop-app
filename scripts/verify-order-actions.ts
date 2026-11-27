/**
 * createAdminOrder / createCustomer の実コードを疑似 Supabase（メモリ上・一意インデックス再現）で動かす検証。
 * DB・Next ランタイム不要。
 *
 *   npx tsx scripts/verify-order-actions.ts
 *
 * Module._load で次をすり替える: server-only / next/cache / next/navigation / @/lib/supabase/server /
 * @/lib/supabase/admin / @/lib/auth/staff
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";

// ── 疑似 DB ──
type Row = Record<string, any>;
const db = {
  tables: {} as Record<string, Row[]>,
  failNextInsert: {} as Record<string, number>,
  seq: 0,
  authUsers: 0,
  createUserCalls: 0,
  revalidated: [] as string[],
  staff: true as boolean,
  reset() {
    this.tables = { customers: [], orders: [], order_items: [], customer_order_counts: [] };
    this.failNextInsert = {};
    this.seq = 0;
    this.authUsers = 0;
    this.createUserCalls = 0;
    this.revalidated = [];
    this.staff = true;
  },
};

class Q {
  filters: Array<(r: Row) => boolean> = [];
  constructor(private table: string) {}
  select() { return this; }
  order() { return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, a: unknown[]) { this.filters.push((r) => a.includes(r[c])); return this; }
  private run() { return db.tables[this.table].filter((r) => this.filters.every((f) => f(r))); }
  range(a: number, b: number) { return Promise.resolve({ data: this.run().slice(a, b + 1), error: null }); }
  maybeSingle() { return Promise.resolve({ data: this.run()[0] ?? null, error: null }); }
  then(res: any, rej: any) { return Promise.resolve({ data: this.run(), error: null }).then(res, rej); }
  insert(input: Row | Row[]) {
    const rows = Array.isArray(input) ? input : [input];
    let result: { data: Row | null; error: { code?: string; message: string } | null };
    if (db.failNextInsert[this.table] > 0) {
      db.failNextInsert[this.table]--;
      result = { data: null, error: { message: "simulated failure" } };
    } else {
      const k = rows[0].idempotency_key;
      if (k != null && db.tables[this.table].some((r) => r.idempotency_key === k)) {
        result = { data: null, error: { code: "23505", message: "duplicate key" } };
      } else {
        let last: Row = {};
        for (const r of rows) {
          last = { ...r, id: `${this.table}-${++db.seq}`, idempotency_key: r.idempotency_key ?? null };
          db.tables[this.table].push(last);
        }
        result = { data: { id: last.id }, error: null };
      }
    }
    return {
      select: () => ({ single: async () => result }),
      then: (res: any, rej: any) => Promise.resolve({ error: result.error }).then(res, rej),
    };
  }
}
const fakeSupabase = { from: (t: string) => new Q(t), auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
const fakeAdmin = {
  auth: {
    admin: {
      createUser: async () => { db.createUserCalls++; db.authUsers++; return { data: { user: { id: `auth-${db.authUsers}` } }, error: null }; },
      deleteUser: async () => { db.authUsers--; return { error: null }; },
    },
  },
};

class RedirectError extends Error {
  constructor(public url: string) { super("REDIRECT " + url); }
}
const stubs: Record<string, unknown> = {
  "server-only": {},
  "next/cache": { revalidatePath: (p: string) => db.revalidated.push(p) },
  "next/navigation": { redirect: (u: string) => { throw new RedirectError(u); } },
  "@/lib/supabase/server": { createClient: async () => fakeSupabase },
  "@/lib/supabase/admin": { createAdminClient: () => fakeAdmin },
  "@/lib/auth/staff": { getStaffOrNull: async () => (db.staff ? { id: "u1", role: "admin", displayName: null } : null) },
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module");
const origLoad = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request in stubs) return stubs[request];
  return origLoad.call(this, request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAdminOrder } = require("../src/app/admin/orders/new/actions");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCustomer } = require("../src/app/admin/customers/actions");

async function call(fn: any, fd: FormData): Promise<{ state?: any; redirect?: string }> {
  try {
    return { state: await fn({}, fd) };
  } catch (e) {
    if (e instanceof RedirectError) return { redirect: e.url };
    throw e;
  }
}

const KEY = "11111111-2222-4333-8444-555555555555";
function orderForm(over: Record<string, string> = {}, key = KEY) {
  const fd = new FormData();
  const base: Record<string, string> = {
    idempotency_key: key,
    customer_type: "new",
    new_customer_name: "架空 花子",
    new_customer_phone: "090-0000-0000",
    delivery_name: "お届け先（架空）",
    order_type: "配達",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  fd.append("item_product_name", "アレンジメント");
  fd.append("item_quantity", "2");
  fd.append("item_unit_price", "3000");
  fd.append("item_description", "");
  fd.append("item_tax_rate", "10");
  return fd;
}

let passed = 0;
async function t(name: string, fn: () => Promise<void>) {
  db.reset();
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

async function main() {
  console.log("createAdminOrder");
  await t("新規顧客＋注文: 注文 INSERT 失敗 → 同じキーで再送信しても顧客は 1 件（警告なし）・注文 1 件・明細どおり", async () => {
    db.failNextInsert.orders = 1;
    const r1 = await call(createAdminOrder, orderForm());
    assert.equal(r1.state.error, "注文の登録に失敗しました");
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 0);
    // 失敗した送信では revalidatePath を呼ばない（再描画でフォーム状態・キーが変わらないように）
    assert.equal(db.revalidated.length, 0);

    const r2 = await call(createAdminOrder, orderForm());
    assert.equal(r2.state, undefined, "重複警告やエラーが返ってはいけない: " + JSON.stringify(r2.state));
    assert.match(r2.redirect!, /^\/admin\/orders\/orders-\d+\?created=true$/);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 1);
    assert.equal(db.tables.orders[0].customer_id, db.tables.customers[0].id);
    assert.equal(db.tables.order_items.length, 1);
    assert.equal(db.tables.order_items[0].quantity, 2);
    assert.ok(db.revalidated.includes("/admin/orders") && db.revalidated.includes("/admin/customers"));
  });
  await t("同じキーの 3 回目以降は作成済みの注文詳細へ（件数不変）", async () => {
    const r1 = await call(createAdminOrder, orderForm());
    const r2 = await call(createAdminOrder, orderForm());
    const r3 = await call(createAdminOrder, orderForm());
    assert.equal(r1.redirect, r2.redirect);
    assert.equal(r2.redirect, r3.redirect);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 1);
    assert.equal(db.tables.order_items.length, 1);
  });
  await t("お届け先名が空 → エラー・顧客は作成されない。修正して再送信 → 顧客 1・注文 1", async () => {
    const r1 = await call(createAdminOrder, orderForm({ delivery_name: "" }));
    assert.equal(r1.state.error, "お届け先名は必須です");
    assert.equal(db.tables.customers.length, 0);
    const r2 = await call(createAdminOrder, orderForm());
    assert.ok(r2.redirect);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 1);
  });
  await t("商品明細がすべて空 → エラー・顧客は作成されない", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ idempotency_key: KEY, customer_type: "new", new_customer_name: "架空 太郎", delivery_name: "宛先" })) fd.set(k, v);
    fd.append("item_product_name", ""); fd.append("item_quantity", "1"); fd.append("item_unit_price", "0"); fd.append("item_description", ""); fd.append("item_tax_rate", "10");
    const r = await call(createAdminOrder, fd);
    assert.equal(r.state.error, "商品を1つ以上入力してください");
    assert.equal(db.tables.customers.length, 0);
  });
  await t("重複警告: 顧客も注文も作成されない → それでも登録で顧客 1・注文 1", async () => {
    db.tables.customers.push({ id: "c-exist", name: "架空　花子", phone: null, email: null, postal_code: null, address: null, idempotency_key: null });
    const r1 = await call(createAdminOrder, orderForm());
    assert.equal(r1.state.duplicates.length, 1);
    assert.equal(r1.state.duplicates[0].id, "c-exist");
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 0);
    const fd = orderForm();
    fd.set("confirm_duplicate", "1");
    const r2 = await call(createAdminOrder, fd);
    assert.ok(r2.redirect);
    assert.equal(db.tables.customers.length, 2);
    assert.equal(db.tables.orders.length, 1);
  });
  await t("重複警告 → 既存顧客に切り替え: 新しい顧客は作成されず、既存顧客の注文 1 件", async () => {
    db.tables.customers.push({ id: "c-exist", name: "架空　花子", phone: null, email: null, postal_code: null, address: null, idempotency_key: null });
    await call(createAdminOrder, orderForm());
    const fd = orderForm({ customer_type: "existing", customer_id: "c-exist" });
    const r = await call(createAdminOrder, fd);
    assert.ok(r.redirect);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 1);
    assert.equal(db.tables.orders[0].customer_id, "c-exist");
  });
  await t("staff 以外（顧客ロール・未ログイン）は /login へ。顧客取得・作成に到達しない", async () => {
    db.staff = false;
    const r = await call(createAdminOrder, orderForm());
    assert.equal(r.redirect, "/login");
    assert.equal(db.tables.customers.length + db.tables.orders.length, 0);
  });

  console.log("createCustomer");
  function custForm(over: Record<string, string> = {}) {
    const fd = new FormData();
    const base: Record<string, string> = { idempotency_key: KEY, name: "架空 次郎", create_account: "on", account_email: "x@example.com", account_password: "password123", ...over };
    for (const [k, v] of Object.entries(base)) fd.set(k, v);
    return fd;
  }
  await t("重複警告時は認証ユーザーを作成しない → それでも登録で顧客とアカウントが 1 組", async () => {
    db.tables.customers.push({ id: "c-exist", name: "架空　次郎", phone: null, email: null, postal_code: null, address: null, idempotency_key: null });
    const r1 = await call(createCustomer, custForm());
    assert.equal(r1.state.duplicates.length, 1);
    assert.equal(db.createUserCalls, 0);
    assert.equal(db.tables.customers.length, 1);
    const fd = custForm();
    fd.set("confirm_duplicate", "1");
    const r2 = await call(createCustomer, fd);
    assert.match(r2.redirect!, /^\/admin\/customers\/customers-\d+\?created=true$/);
    assert.equal(db.createUserCalls, 1);
    assert.equal(db.tables.customers.length, 2);
  });
  await t("同じキーの再送信は作成済み顧客の詳細へ（認証ユーザー・顧客とも増えない）", async () => {
    const r1 = await call(createCustomer, custForm());
    const r2 = await call(createCustomer, custForm());
    const r3 = await call(createCustomer, custForm());
    assert.equal(r1.redirect, r2.redirect);
    assert.equal(r2.redirect, r3.redirect);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.createUserCalls, 1);
  });
  await t("必須エラー・パスワード不足は何も作成せず state でエラー（入力は保持される）", async () => {
    const r1 = await call(createCustomer, custForm({ name: "" }));
    assert.equal(r1.state.error, "顧客名は必須です");
    const r2 = await call(createCustomer, custForm({ account_password: "short" }));
    assert.equal(r2.state.error, "パスワードは8文字以上で設定してください");
    assert.equal(db.createUserCalls, 0);
    assert.equal(db.tables.customers.length, 0);
  });
  await t("顧客 INSERT 失敗時は作成済みの認証ユーザーを後始末する", async () => {
    db.failNextInsert.customers = 1;
    const r = await call(createCustomer, custForm());
    assert.equal(r.state.error, "顧客の登録に失敗しました");
    assert.equal(db.authUsers, 0);
  });
  await t("staff 以外は /login へ。認証ユーザー作成・重複確認に到達しない", async () => {
    db.staff = false;
    const r = await call(createCustomer, custForm());
    assert.equal(r.redirect, "/login");
    assert.equal(db.createUserCalls, 0);
    assert.equal(db.tables.customers.length, 0);
  });

  console.log(`\n${passed} 件すべて成功`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
