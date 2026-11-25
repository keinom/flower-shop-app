/**
 * 受信メール UI コンポーネントの SSR スモーク（Supabase 不要・DOM 不要）。
 *
 *   NODE_OPTIONS="--require ./scripts/lib/stub-server-only.cjs" npx tsx scripts/verify-mail-ui-ssr.tsx
 *
 * 一覧・同期バー・本文ビューア・添付リンク・ナビバッジが、フィクスチャ由来の props で
 * エラーなくレンダリングでき、期待する要素（sandbox 属性・バッジ・ブロック案内など）を含むことを確認する。
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup as render } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactElement } from "react";

// useRouter() に必要な最小のルーターを提供（SSR のみで実際には呼ばれない）
const stubRouter = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as never;
const renderToStaticMarkup = (el: ReactElement) =>
  render(<AppRouterContext.Provider value={stubRouter}>{el}</AppRouterContext.Provider>);
import { MailList, type MailListRow } from "../src/components/admin/MailList";
import { MailSyncBar } from "../src/components/admin/MailSyncBar";
import { MailBodyViewer } from "../src/components/admin/MailBodyViewer";
import { MailAttachmentLink } from "../src/components/admin/MailAttachmentLink";
import { MailMetaEditor } from "../src/components/admin/MailMetaEditor";
import { FixtureGmailClient } from "../src/lib/gmail/fixtures";
import { parseGmailMessage } from "../src/lib/gmail/mime";
import { prepareHtmlForViewer } from "../src/lib/gmail/html";
import { contentDisposition, sanitizeFilename } from "../src/lib/gmail/attachment";
import { buildMailQueryString, ilikeOrValue, parseMailQuery, sanitizeFromParam } from "../src/lib/mailQuery";

const rows: MailListRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    receivedLabel: "2026/5/1 10:00:00",
    senderLabel: "架空商事 見本太郎",
    senderAddress: "foo@example.com",
    customerName: "架空商事（サンプル）",
    subject: "【ご注文】母の日ギフトのお願い（架空）",
    snippet: "架空商事の見本です。",
    hasAttachment: true,
    status: "未対応",
    assigneeName: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    receivedLabel: "2026/5/1 09:00:00",
    senderLabel: "newsletter@example.org",
    senderAddress: "newsletter@example.org",
    customerName: null,
    subject: "",
    snippet: "<script>alert(1)</script>",
    hasAttachment: false,
    status: "対応済み",
    assigneeName: "担当A",
  },
];

let n = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    n++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}\n        ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
};

ok("MailList: 行・ステータス・顧客名・添付・件名なし・エスケープ", () => {
  const html = renderToStaticMarkup(<MailList rows={rows} fromQuery="status=未対応&page=2" />);
  assert.ok(html.includes("架空商事（サンプル）"));
  assert.ok(html.includes("📎"));
  assert.ok(html.includes("(件名なし)"));
  assert.ok(html.includes("/admin/mail/00000000-0000-4000-8000-000000000001?from="));
  assert.ok(!html.includes("<script>alert(1)</script>"), "スニペットがエスケープされていない");
  assert.ok(html.includes("&lt;script&gt;"));
});

ok("MailSyncBar: 未設定時は更新ボタン無効・最終同期表示", () => {
  const html = renderToStaticMarkup(
    <MailSyncBar configured={false} lastSyncedLabel={null} lastError={null} fixtureMode={false} />,
  );
  assert.ok(html.includes("disabled"));
  assert.ok(html.includes("未同期"));
  const html2 = renderToStaticMarkup(
    <MailSyncBar configured lastSyncedLabel="2026/5/1 10:00:00" lastError="Gmail の認証に失敗しました" fixtureMode />,
  );
  assert.ok(html2.includes("前回の同期エラー"));
  assert.ok(html2.includes("フィクスチャ"));
});

const client = new FixtureGmailClient();
const evil = parseGmailMessage(client.peek("fx-0004")).bodyHtml!;
const v = prepareHtmlForViewer(evil);

ok("MailBodyViewer: sandbox は allow-scripts / allow-same-origin を含まない・画像ブロック案内", () => {
  const html = renderToStaticMarkup(<MailBodyViewer sanitizedHtml={v.html} text="t" hasRemoteImages={v.hasRemoteImages} />);
  const sb = /sandbox="([^"]*)"/.exec(html)?.[1] ?? "";
  assert.ok(sb.length > 0, "sandbox 属性なし");
  assert.ok(!sb.includes("allow-scripts") && !sb.includes("allow-same-origin") && !sb.includes("allow-forms"));
  assert.ok(html.includes("画像を表示"));
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(!html.includes("<script"), "iframe の外に script が出ている");
});

ok("MailBodyViewer: テキストのみのメールは <pre> にエスケープ表示・iframe なし", () => {
  const html = renderToStaticMarkup(<MailBodyViewer sanitizedHtml={null} text={"<b>x</b>\n本文"} hasRemoteImages={false} />);
  assert.ok(!html.includes("<iframe"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

ok("MailAttachmentLink: 通常はダウンロードリンク / 4MB 超は案内のみ", () => {
  const a = renderToStaticMarkup(<MailAttachmentLink mailId="00000000-0000-4000-8000-000000000001" index={0} filename="見積書_サンプル.pdf" size={1200} />);
  assert.ok(a.includes('href="/api/mail/00000000-0000-4000-8000-000000000001/attachments/0"'));
  const b = renderToStaticMarkup(<MailAttachmentLink mailId="x" index={3} filename="大きな資料.zip" size={6_000_000} />);
  assert.ok(!b.includes("<a "));
  assert.ok(b.includes("Gmail で開いてください"));
});

ok("MailMetaEditor: ステータス・担当者・メモ", () => {
  const html = renderToStaticMarkup(
    <MailMetaEditor id="x" status="対応中" assignedTo="u1" memo="メモ" staff={[{ id: "u1", name: "担当A" }]} statusUpdatedLabel="最終更新: 今（担当A）" />,
  );
  assert.ok(html.includes("対応済み") && html.includes("担当A") && html.includes("メモ"));
});

ok("添付ヘッダ: attachment・RFC5987・パス区切り/制御文字除去", () => {
  const cd = contentDisposition("../../見積書\r\n_サンプル.html");
  assert.ok(cd.startsWith("attachment;"));
  assert.ok(cd.includes("filename*=UTF-8''"));
  assert.ok(!/[\r\n/\\]/.test(cd.replace(/%[0-9A-F]{2}/g, "")));
  assert.equal(sanitizeFilename("a/b\\c:d.txt"), "a_b_c_d.txt");
  assert.equal(sanitizeFilename("..."), "attachment");
});

ok("検索条件: 戻り用 from の再構築・ilike エスケープ", () => {
  assert.equal(sanitizeFromParam("status=未対応&page=2&evil=1&q=abc"), "status=%E6%9C%AA%E5%AF%BE%E5%BF%9C&q=abc&page=2");
  assert.deepEqual(parseMailQuery({ status: "x", page: "-3" }), { status: null, q: "", page: 1 });
  assert.equal(buildMailQueryString({ page: 1 }), "");
  assert.equal(ilikeOrValue('a,b)"%_'), String.raw`"%a,b)\"\\%\\_%"`);
});

console.log(`\n${n} UI checks passed${process.exitCode ? " (some FAILED)" : ""}`);
