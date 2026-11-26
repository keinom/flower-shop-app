/**
 * 送信ボタン・重複警告・冪等キー hidden の SSR スモーク（Issue #40 R1/R3）。Supabase・DOM 不要。
 *
 *   NODE_OPTIONS="--require ./scripts/lib/stub-server-only.cjs" npx tsx scripts/verify-submit-ssr.tsx
 *
 * 確認すること:
 *  - 共通 SubmitButton が pending で disabled になり「処理中...」等の文言に変わる／通常時は押せる
 *  - R1 対象フォームの送信ボタンが共通コンポーネント経由（コード上 <button type="submit"> が残っていない）
 *  - 顧客登録フォーム・管理者注文フォーム等が冪等キーの hidden を出す
 *  - 重複警告が一致項目・電話・住所・注文件数・別タブリンクを出し、注文画面用の切り替えボタンを出す
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup as render } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactElement } from "react";

const stubRouter = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as never;
const renderToStaticMarkup = (el: ReactElement) =>
  render(<AppRouterContext.Provider value={stubRouter}>{el}</AppRouterContext.Provider>);

import { SubmitButton } from "../src/components/ui/SubmitButton";
import { DuplicateCustomerWarning } from "../src/components/admin/DuplicateCustomerWarning";
import { CustomerCreateForm } from "../src/components/admin/CustomerCreateForm";
import { AdminOrderFormClient } from "../src/components/admin/AdminOrderFormClient";
import { DeleteOrderButton } from "../src/components/admin/DeleteOrderButton";
import { DeleteInvoiceButton } from "../src/components/admin/DeleteInvoiceButton";
import { DeleteTemplateButton } from "../src/components/admin/DeleteTemplateButton";
import { DeleteAdminButton } from "../src/components/admin/DeleteAdminButton";
import { RecurringTemplateFormClient } from "../src/app/admin/recurring/new/RecurringTemplateFormClient";
import { NewOrderFormClient } from "../src/app/customer/orders/new/NewOrderFormClient";
import type { DuplicateCustomer } from "../src/lib/customerDuplicates";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}
const root = join(__dirname, "..");
const KEY = "11111111-2222-4333-8444-555555555555";

console.log("SubmitButton");
t("通常時は押せる（disabled なし）・文言はそのまま", () => {
  const h = renderToStaticMarkup(<SubmitButton pendingText="登録中...">登録する</SubmitButton>);
  assert.match(h, /type="submit"/);
  assert.doesNotMatch(h, /disabled=""/);
  assert.match(h, />登録する</);
  assert.doesNotMatch(h, /aria-busy/);
});
t("pending 時は disabled・aria-busy・文言が送信中表示に変わる", () => {
  const h = renderToStaticMarkup(<SubmitButton pending pendingText="登録中...">登録する</SubmitButton>);
  assert.match(h, /disabled=""/);
  assert.match(h, /aria-busy="true"/);
  assert.match(h, />登録中\.\.\.</);
  assert.doesNotMatch(h, />登録する</);
});
t("文言の既定は「処理中...」、className の指定が使われる", () => {
  const h = renderToStaticMarkup(<SubmitButton pending className="my-cls">x</SubmitButton>);
  assert.match(h, />処理中\.\.\.</);
  assert.match(h, /class="my-cls /);
});
t("disabled を併用すると pending でなくても無効", () => {
  const h = renderToStaticMarkup(<SubmitButton disabled>x</SubmitButton>);
  assert.match(h, /disabled=""/);
});

console.log("削除ボタン（confirm 付き）");
t("4 種の削除ボタンが共通 SubmitButton で描画され、初期状態では押せる", () => {
  const els = [
    <DeleteOrderButton key="o" orderId="o1" deliveryName="架空" />,
    <DeleteInvoiceButton key="i" invoiceId="i1" />,
    <DeleteTemplateButton key="t" templateId="t1" />,
    <DeleteAdminButton key="a" userId="u1" displayName="架空" />,
  ];
  for (const el of els) {
    const h = renderToStaticMarkup(el);
    assert.match(h, /<button[^>]*type="submit"/);
    assert.doesNotMatch(h, /disabled=""/);
  }
});

console.log("重複警告");
const dups: DuplicateCustomer[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "見本　太郎",
    phone: "03-0000-0000",
    email: "sample@example.com",
    postal_code: "100-0001",
    address: "架空県架空市1-1",
    orderCount: 12,
    matched: ["name", "phone"],
  },
];
t("一致項目・電話・住所・注文件数・別タブリンクを表示する", () => {
  const h = renderToStaticMarkup(<DuplicateCustomerWarning duplicates={dups} pending={false} onProceed={() => {}} />);
  assert.match(h, /見本 太郎/);
  assert.match(h, /氏名/);
  assert.match(h, /電話/);
  assert.match(h, /03-0000-0000/);
  assert.match(h, /架空県架空市1-1/);
  assert.match(h, /注文件数: (<!-- -->)?12(<!-- -->)? 件/);
  assert.match(h, /href="\/admin\/customers\/00000000-0000-4000-8000-000000000001"[^>]*target="_blank"/);
  assert.match(h, /rel="noopener noreferrer"/);
  assert.match(h, /それでも登録する/);
  assert.doesNotMatch(h, /この顧客で注文する/);
});
t("注文画面用: 既存顧客への切り替えボタンが出る。pending 中は無効", () => {
  const h = renderToStaticMarkup(
    <DuplicateCustomerWarning duplicates={dups} pending onProceed={() => {}} onUseExisting={() => {}} proceedLabel="それでも新規顧客として登録する" />
  );
  assert.match(h, /この顧客で注文する/);
  assert.match(h, /登録中\.\.\./);
  assert.equal((h.match(/disabled=""/g) ?? []).length, 2);
});

console.log("フォーム（冪等キー hidden・送信ボタン）");
const hidden = `<input type="hidden" name="idempotency_key" value="${KEY}"/>`;
t("顧客登録フォーム: 冪等キー hidden・押せる送信ボタン・入力欄（氏名/電話/メール/郵便番号/住所/備考）", () => {
  const h = renderToStaticMarkup(<CustomerCreateForm idempotencyKey={KEY} />);
  assert.ok(h.includes(hidden));
  assert.match(h, /<button[^>]*type="submit"[^>]*>登録する</);
  for (const n of ["name", "phone", "email", "postal_code", "address", "notes"]) {
    assert.match(h, new RegExp(`name="${n}"`), n);
  }
  assert.doesNotMatch(h, /duplicate-warning/);
});
t("管理者注文フォーム: 冪等キー hidden・「注文を作成する」ボタン", () => {
  const h = renderToStaticMarkup(
    <AdminOrderFormClient customers={[]} today="2026-11-26" taxRate={10} idempotencyKey={KEY} />
  );
  assert.ok(h.includes(hidden));
  assert.match(h, /<button[^>]*type="submit"[^>]*>注文を作成する</);
  assert.doesNotMatch(h, /duplicate-warning/);
});
t("定期注文作成フォーム: 冪等キー hidden・送信ボタン", () => {
  const h = renderToStaticMarkup(
    <RecurringTemplateFormClient customers={[]} today="2026-11-26" taxRate={10} idempotencyKey={KEY} />
  );
  assert.ok(h.includes(hidden));
  assert.match(h, /<button[^>]*type="submit"[^>]*>定期注文を作成する</);
});
t("顧客の注文作成フォーム: 冪等キー hidden・送信ボタン", () => {
  const h = renderToStaticMarkup(
    <NewOrderFormClient customer={{ name: "架空", address: null, phone: null, email: null }} today="2026-11-26" idempotencyKey={KEY} />
  );
  assert.ok(h.includes(hidden));
  assert.match(h, /<button[^>]*type="submit"[^>]*>注文を送信する</);
});

console.log("R1 対象フォームが共通コンポーネントを使っている（コード検査）");
const r1Files = [
  "src/app/admin/customers/new/page.tsx|src/components/admin/CustomerCreateForm.tsx",
  "src/app/admin/recurring/new/RecurringTemplateFormClient.tsx",
  "src/app/admin/users/new/page.tsx",
  "src/app/admin/customers/[id]/page.tsx",
  "src/app/admin/settings/page.tsx",
  "src/app/admin/recurring/[id]/page.tsx",
  "src/app/admin/shifts/page.tsx",
  "src/app/admin/customers/[id]/edit/page.tsx",
  "src/components/admin/AdminOrderEditClient.tsx",
  "src/app/admin/recurring/[id]/edit/RecurringTemplateEditFormClient.tsx",
  "src/app/admin/invoices/[id]/edit/page.tsx",
  "src/app/admin/invoices/[id]/page.tsx",
  "src/app/admin/orders/[id]/page.tsx",
  "src/app/admin/shifts/requirements/page.tsx",
  "src/app/customer/orders/[id]/edit/page.tsx",
  "src/components/admin/DeleteOrderButton.tsx",
  "src/components/admin/DeleteInvoiceButton.tsx",
  "src/components/admin/DeleteTemplateButton.tsx",
  "src/components/admin/DeleteAdminButton.tsx",
  "src/app/admin/invoices/new/page.tsx",
  "src/app/customer/orders/new/NewOrderFormClient.tsx",
  "src/components/admin/AdminOrderFormClient.tsx",
];
for (const entry of r1Files) {
  t(entry.split("|").pop()!, () => {
    const files = entry.split("|").map((f) => readFileSync(join(root, f), "utf8"));
    const src = files.join("\n");
    assert.ok(src.includes('from "@/components/ui/SubmitButton"'), "SubmitButton を import していない");
    assert.ok(src.includes("<SubmitButton"), "SubmitButton を使っていない");
    assert.doesNotMatch(src, /<button[^>]*\btype="submit"/, "素の <button type=\"submit\"> が残っている");
  });
}

console.log(`\n${passed} 件すべて成功`);
