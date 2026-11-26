/**
 * 冪等キー処理（Issue #40 R2）の検証。DB 不要。
 *
 *   npx tsx scripts/verify-idempotency.ts
 *
 * 1. 冪等キーの解析・一意制約違反の判定・既存行の引き当て（疑似クライアントで一意インデックスの挙動を再現）
 * 2. マイグレーション 032 の静的検査（4 テーブル・部分一意インデックス・再実行可能・データ変更なし）
 * 3. 配線の静的検査（各作成アクションがキーを読み取り・保存し、一意制約違反時に既存行へ遷移する）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findIdByIdempotencyKey,
  isUniqueViolation,
  newIdempotencyKey,
  parseIdempotencyKey,
  readIdempotencyKey,
} from "../src/lib/idempotency";

let passed = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** 部分一意インデックス（idempotency_key IS NOT NULL）を再現した疑似テーブル */
function fakeDb() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    customers: [],
    orders: [],
    recurring_order_templates: [],
    invoices: [],
  };
  let seq = 0;
  return {
    tables,
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          const k = row.idempotency_key as string | null | undefined;
          let error: { code: string } | null = null;
          let data: { id: string } | null = null;
          if (k != null && tables[table].some((r) => r.idempotency_key === k)) {
            error = { code: "23505" };
          } else {
            const id = `${table}-${++seq}`;
            tables[table].push({ ...row, id, idempotency_key: k ?? null });
            data = { id };
          }
          return { select: (_cols?: string) => ({ single: async () => ({ data, error }) }) };
        },
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: async () => ({
              data: tables[table].find((r) => r.idempotency_key === key) ?? null,
              error: null,
            }),
          }),
        }),
      };
    },
  };
}

async function main() {
  console.log("キーの解析");
  await t("UUID 形式のキーだけを受け付ける（大文字は小文字化）", () => {
    const k = newIdempotencyKey();
    assert.equal(parseIdempotencyKey(k), k);
    assert.equal(parseIdempotencyKey(k.toUpperCase()), k);
    assert.equal(parseIdempotencyKey(` ${k} `), k);
  });
  await t("不正・空・未指定は null（＝冪等化なしの従来動作）", () => {
    assert.equal(parseIdempotencyKey(""), null);
    assert.equal(parseIdempotencyKey("not-a-uuid"), null);
    assert.equal(parseIdempotencyKey(null), null);
    assert.equal(parseIdempotencyKey(undefined), null);
    assert.equal(parseIdempotencyKey(new File([], "x")), null);
  });
  await t("リロード相当（再発行）で別のキーになる", () => {
    assert.notEqual(newIdempotencyKey(), newIdempotencyKey());
  });
  await t("FormData から読み取れる", () => {
    const fd = new FormData();
    const k = newIdempotencyKey();
    fd.set("idempotency_key", k);
    assert.equal(readIdempotencyKey(fd), k);
    assert.equal(readIdempotencyKey(new FormData()), null);
  });
  await t("一意制約違反（23505）の判定", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ code: "23503" }), false);
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation(undefined), false);
  });

  console.log("二重送信のシミュレーション（疑似 DB）");
  for (const table of ["customers", "orders", "recurring_order_templates", "invoices"] as const) {
    await t(`${table}: 同じキーで 2 回 INSERT → 2 回目は一意制約違反、既存行の id を引ける（1 件のみ）`, async () => {
      const db = fakeDb();
      const key = newIdempotencyKey();
      const first = await db.from(table).insert({ idempotency_key: key }).select("id").single();
      assert.equal(first.error, null);
      const second = await db.from(table).insert({ idempotency_key: key }).select("id").single();
      assert.equal(isUniqueViolation(second.error), true);
      assert.equal(await findIdByIdempotencyKey(db, table, key), first.data!.id);
      assert.equal(db.tables[table].length, 1);
    });
  }
  await t("キー NULL の行は何件あっても制約違反にならない（既存行・cron 生成）", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) {
      const r = await db.from("orders").insert({ idempotency_key: null }).select("id").single();
      assert.equal(r.error, null);
    }
    assert.equal(db.tables.orders.length, 3);
  });
  await t("キー未指定（null）では引き当てを行わない", async () => {
    const db = fakeDb();
    assert.equal(await findIdByIdempotencyKey(db, "orders", null), null);
  });
  await t("別のキーは別の送信として作成される（リロード後の再登録）", async () => {
    const db = fakeDb();
    await db.from("customers").insert({ idempotency_key: newIdempotencyKey() }).select("id").single();
    const r = await db.from("customers").insert({ idempotency_key: newIdempotencyKey() }).select("id").single();
    assert.equal(r.error, null);
    assert.equal(db.tables.customers.length, 2);
  });
  await t("新規顧客＋注文: 顧客作成後に注文作成が失敗しても、再送信で顧客は 2 件にならない", async () => {
    const db = fakeDb();
    const key = newIdempotencyKey();
    // 1 回目: 顧客だけ作成（注文は失敗した想定）
    await db.from("customers").insert({ idempotency_key: key }).select("id").single();
    // 再送信: 先に同じキーの顧客を引き当てて再利用 → 注文を作成
    const reused = await findIdByIdempotencyKey(db, "customers", key);
    assert.ok(reused);
    const order = await db.from("orders").insert({ idempotency_key: key, customer_id: reused }).select("id").single();
    assert.equal(order.error, null);
    assert.equal(db.tables.customers.length, 1);
    assert.equal(db.tables.orders.length, 1);
  });

  console.log("マイグレーション 032 の静的検査");
  const mig = read("supabase/migrations/032_idempotency_keys.sql");
  const code = mig.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  await t("4 テーブルに idempotency_key uuid（NULL 許容・デフォルトなし）を IF NOT EXISTS で追加", () => {
    for (const tb of ["customers", "orders", "recurring_order_templates", "invoices"]) {
      assert.match(code, new RegExp(`alter table public\\.${tb}\\s+add column if not exists idempotency_key uuid;`, "i"), tb);
    }
    assert.doesNotMatch(code, /idempotency_key uuid\s+(not null|default)/i);
  });
  await t("NULL を除く部分一意インデックスを IF NOT EXISTS で作成", () => {
    for (const tb of ["customers", "orders", "recurring_order_templates", "invoices"]) {
      assert.match(
        code,
        new RegExp(`create unique index if not exists ${tb}_idempotency_key_uidx\\s+on public\\.${tb} \\(idempotency_key\\)\\s+where idempotency_key is not null;`, "i"),
        tb
      );
    }
  });
  await t("データ変更・破壊的変更・CONCURRENTLY を含まない", () => {
    assert.doesNotMatch(code, /\b(update|delete|insert|drop|truncate)\b/i);
    assert.doesNotMatch(code, /concurrently/i);
  });
  await t("RLS ポリシー・権限を変更しない", () => {
    assert.doesNotMatch(code, /\b(policy|grant|revoke)\b/i);
  });

  console.log("配線の静的検査");
  const wiring: Array<[string, string, string[]]> = [
    ["顧客作成", "src/app/admin/customers/actions.ts", ["readIdempotencyKey(formData)", 'findIdByIdempotencyKey(supabase, "customers"', "idempotency_key: idempotencyKey", "isUniqueViolation"]],
    ["管理者注文作成", "src/app/admin/orders/new/actions.ts", ["readIdempotencyKey(formData)", 'findIdByIdempotencyKey(supabase, "orders"', 'findIdByIdempotencyKey(supabase, "customers"', "idempotency_key:  idempotencyKey", "isUniqueViolation"]],
    ["顧客注文作成", "src/app/customer/orders/actions.ts", ["readIdempotencyKey(formData)", 'findIdByIdempotencyKey(supabase, "orders"', "idempotency_key:  idempotencyKey", "isUniqueViolation"]],
    ["定期注文テンプレート作成", "src/app/admin/recurring/new/actions.ts", ["readIdempotencyKey(formData)", 'findIdByIdempotencyKey(supabase, "recurring_order_templates"', "idempotency_key: idempotencyKey", "isUniqueViolation"]],
    ["請求書作成", "src/app/api/invoices/create/route.ts", ["parseIdempotencyKey(body.idempotencyKey)", 'findIdByIdempotencyKey(supabase, "invoices"', "idempotency_key:   idempotencyKey", "isUniqueViolation"]],
  ];
  for (const [label, file, needles] of wiring) {
    await t(`${label}: キーの読み取り・事前確認・保存・一意制約違反時の引き当て`, () => {
      const src = read(file);
      for (const n of needles) assert.ok(src.includes(n), `${file} に「${n}」がない`);
    });
  }
  await t("フォームが hidden で冪等キーを送る（顧客・管理者注文・顧客注文・定期注文）", () => {
    for (const f of [
      "src/components/admin/CustomerCreateForm.tsx",
      "src/components/admin/AdminOrderFormClient.tsx",
      "src/app/customer/orders/new/NewOrderFormClient.tsx",
      "src/app/admin/recurring/new/RecurringTemplateFormClient.tsx",
    ]) {
      assert.match(read(f), /<input type="hidden" name="idempotency_key" value=\{frozenKey\} \/>/, f);
    }
  });
  await t("請求書作成画面がキーを JSON で送る", () => {
    assert.match(read("src/app/admin/invoices/new/page.tsx"), /idempotencyKey,\s*\}\),/);
  });
  await t("管理者注文作成: 顧客 INSERT より前に全バリデーションがある（孤立顧客を作らない）", () => {
    const src = read("src/app/admin/orders/new/actions.ts");
    const insertAt = src.indexOf('.from("customers")\n        .insert(');
    assert.ok(insertAt > 0);
    for (const msg of ["お届け先名は必須です", "商品を1つ以上入力してください", "顧客名は必須です"]) {
      const at = src.indexOf(msg);
      assert.ok(at > 0 && at < insertAt, `${msg} は顧客 INSERT より前になければならない`);
    }
    // 重複確認も INSERT より前
    assert.ok(src.indexOf("findDuplicateCustomers(supabase") < insertAt);
  });
  await t("顧客作成: 重複判定は認証ユーザー作成（auth.admin.createUser）より前", () => {
    const src = read("src/app/admin/customers/actions.ts");
    const fn = src.slice(src.indexOf("export async function createCustomer"), src.indexOf("export async function updateCustomer"));
    assert.ok(fn.indexOf("findDuplicateCustomers(") > 0);
    assert.ok(fn.indexOf("findDuplicateCustomers(") < fn.indexOf("auth.admin.createUser"));
    assert.ok(fn.indexOf("findIdByIdempotencyKey(") < fn.indexOf("auth.admin.createUser"));
  });

  console.log(`\n${passed} 件すべて成功`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
