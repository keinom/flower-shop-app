/**
 * 顧客の重複判定（Issue #40 R3）の検証。DB 不要（架空データ・疑似クライアント）。
 *
 *   npx tsx scripts/verify-customer-duplicates.ts
 */
import assert from "node:assert/strict";
import {
  findDuplicateCustomers,
  matchedFields,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  MAX_DUPLICATES_SHOWN,
} from "../src/lib/customerDuplicates";

let passed = 0;
function t(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passed++;
    console.log(`  ok  ${name}`);
  });
}

async function main() {
  console.log("正規化");
  await t("氏名: 半角・全角スペースの有無・改行の違いは同一", () => {
    const a = normalizeName("山田　太郎"); // 全角スペース
    assert.equal(a, normalizeName("山田太郎"));
    assert.equal(a, normalizeName("山田 太郎"));
    assert.equal(a, normalizeName("  山田\n太郎 "));
    assert.equal(a, normalizeName("山田\t太郎"));
  });
  await t("氏名: 別の氏名は別", () => {
    assert.notEqual(normalizeName("山田太郎"), normalizeName("山田次郎"));
  });
  await t("メール: 大文字小文字・前後空白を無視", () => {
    assert.equal(normalizeEmail("  Info@Example.COM "), "info@example.com");
  });
  await t("電話: 数字のみ比較（ハイフン・括弧・全角数字）", () => {
    assert.equal(normalizePhone("03-1234-5678"), "0312345678");
    assert.equal(normalizePhone("(03) 1234 5678"), "0312345678");
    assert.equal(normalizePhone("０３－１２３４－５６７８"), "0312345678");
  });

  console.log("一致判定");
  const base = { name: "山田　太郎", email: "Taro@Example.com", phone: "03-1234-5678" };
  await t("氏名のみ一致（空白違い）", () => {
    assert.deepEqual(matchedFields({ name: "山田太郎" }, base), ["name"]);
    assert.deepEqual(matchedFields({ name: "山田 太郎" }, base), ["name"]);
  });
  await t("氏名が違ってもメール一致（大文字小文字違い）", () => {
    assert.deepEqual(matchedFields({ name: "別人", email: "taro@example.COM" }, base), ["email"]);
  });
  await t("氏名が違っても電話一致（ハイフン有無）", () => {
    assert.deepEqual(matchedFields({ name: "別人", phone: "0312345678" }, base), ["phone"]);
  });
  await t("複数項目の一致を全て返す", () => {
    assert.deepEqual(
      matchedFields({ name: "山田太郎", email: "taro@example.com", phone: "03 1234 5678" }, base),
      ["name", "email", "phone"]
    );
  });
  await t("メール・電話がどちらも空欄どうしは、氏名が違えば一致しない", () => {
    const a = { name: "甲", email: "", phone: "" };
    const b = { name: "乙", email: null, phone: null };
    assert.deepEqual(matchedFields(a, b), []);
    assert.deepEqual(matchedFields({ name: "甲", email: "  ", phone: "---" }, { name: "乙", email: " ", phone: "" }), []);
  });
  await t("氏名が空どうしは一致しない", () => {
    assert.deepEqual(matchedFields({ name: "  " }, { name: "　" }), []);
  });

  console.log("findDuplicateCustomers（疑似クライアント）");
  type Row = { id: string; name: string; phone: string | null; email: string | null; postal_code: string | null; address: string | null };
  const mk = (i: number, over: Partial<Row> = {}): Row => ({
    id: `id-${String(i).padStart(5, "0")}`,
    name: `架空顧客${i}`,
    phone: null,
    email: null,
    postal_code: null,
    address: null,
    ...over,
  });
  function fakeClient(rows: Row[], counts: Record<string, number>) {
    const calls = { pages: 0 };
    return {
      calls,
      from(table: string) {
        if (table === "customers") {
          return {
            select: () => ({
              order: () => ({
                range: async (from: number, to: number) => {
                  calls.pages++;
                  return { data: rows.slice(from, to + 1), error: null };
                },
              }),
            }),
          };
        }
        if (table === "customer_order_counts") {
          return {
            select: () => ({
              in: async (_col: string, ids: string[]) => ({
                data: ids.filter((id) => id in counts).map((id) => ({ customer_id: id, order_count: counts[id] })),
                error: null,
              }),
            }),
          };
        }
        throw new Error("unexpected table " + table);
      },
    };
  }

  await t("1000 件を超える顧客もページングして検索し、注文件数を付与する", async () => {
    const rows: Row[] = Array.from({ length: 2500 }, (_, i) => mk(i));
    rows[2400] = mk(2400, { name: "見本 花子", phone: "090-0000-0000", address: "架空県架空市1-1" });
    const c = fakeClient(rows, { "id-02400": 7 });
    const r = await findDuplicateCustomers(c, { name: "見本　花子" });
    assert.equal(c.calls.pages, 3);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, "id-02400");
    assert.deepEqual(r[0].matched, ["name"]);
    assert.equal(r[0].orderCount, 7);
    assert.equal(r[0].address, "架空県架空市1-1");
  });
  await t("一致なしなら空配列", async () => {
    const c = fakeClient([mk(1), mk(2)], {});
    assert.deepEqual(await findDuplicateCustomers(c, { name: "存在しない", email: "x@example.com", phone: "111" }), []);
  });
  await t("一致件数の多い順に並べ、最大件数で打ち切る", async () => {
    const rows: Row[] = [
      mk(1, { name: "同名", phone: null }),
      mk(2, { name: "同名", phone: "03-0000-0000" }),
      ...Array.from({ length: 20 }, (_, i) => mk(100 + i, { name: "同名" })),
    ];
    const c = fakeClient(rows, {});
    const r = await findDuplicateCustomers(c, { name: "同名", phone: "0300000000" });
    assert.equal(r.length, MAX_DUPLICATES_SHOWN);
    assert.equal(r[0].id, "id-00002");
    assert.deepEqual(r[0].matched, ["name", "phone"]);
  });
  await t("DB エラーは例外（呼び出し側で「確認に失敗」として扱う）", async () => {
    const c = {
      from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: "boom" } }) }) }) }),
    };
    await assert.rejects(() => findDuplicateCustomers(c, { name: "x" }), /重複確認に失敗/);
  });

  console.log(`\n${passed} 件すべて成功`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
