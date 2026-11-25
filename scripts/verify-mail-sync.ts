/**
 * 受信メール同期・MIME 解析・HTML 処理のオフライン検証スクリプト（本物の Gmail / Supabase には接続しない）。
 *
 *   npx tsx --conditions=react-server scripts/verify-mail-sync.ts
 *
 * フィクスチャ Gmail クライアント（架空データ）とインメモリ SyncStore で、
 * Issue #32 の「同期」「文字コード」「顧客照合」「本文サニタイズ」の受け入れ条件を実行確認する。
 */
import assert from "node:assert/strict";
import { FixtureGmailClient } from "../src/lib/gmail/fixtures";
import { parseGmailMessage, decodeMimeWords, parseAddressList, findPartById } from "../src/lib/gmail/mime";
import { runSync, type InsertRow, type SyncStore, type SyncState } from "../src/lib/gmail/sync-core";
import { prepareHtmlForViewer, htmlToPlainText } from "../src/lib/gmail/html";
import { buildSrcDoc } from "../src/lib/gmail/viewer";
import { GmailError } from "../src/lib/gmail/types";

// ── インメモリ SyncStore（Supabase 実装と同じ契約: ロックのアトミック取得・UNIQUE 無視 insert） ──
class MemStore implements SyncStore {
  rows = new Map<string, InsertRow & { status: string; memo: string | null }>();
  state: SyncState & { lockExpires: number | null; lockToken: string | null; lastError: string | null } = {
    lastHistoryId: null,
    lastSyncedAt: null,
    lockExpires: null,
    lockToken: null,
    lastError: null,
  };
  customers: { id: string; email: string }[] = [];
  clock = Date.now();

  async acquireLock(token: string, ttl: number) {
    // 単一スレッド内で check-and-set が分割されない = DB の条件付き UPDATE 相当
    if (this.state.lockExpires !== null && this.state.lockExpires > this.clock) {
      return { acquired: false, state: { lastHistoryId: null, lastSyncedAt: null } };
    }
    this.state.lockToken = token;
    this.state.lockExpires = this.clock + ttl * 1000;
    return { acquired: true, state: { lastHistoryId: this.state.lastHistoryId, lastSyncedAt: this.state.lastSyncedAt } };
  }
  async findExistingIds(ids: string[]) {
    return new Set(ids.filter((i) => this.rows.has(i)));
  }
  async matchCustomers(emails: string[]) {
    const m = new Map<string, string[]>();
    for (const c of this.customers) {
      const k = c.email.trim().toLowerCase();
      if (emails.includes(k)) m.set(k, [...(m.get(k) ?? []), c.id]);
    }
    return m;
  }
  async insertEmails(rows: InsertRow[]) {
    let n = 0;
    for (const r of rows) {
      if (this.rows.has(r.gmail_message_id)) continue; // ON CONFLICT DO NOTHING
      this.rows.set(r.gmail_message_id, { ...r, status: "未対応", memo: null });
      n++;
    }
    return n;
  }
  async finishSuccess(token: string, next: string | null) {
    if (this.state.lockToken !== token) return;
    if (next) this.state.lastHistoryId = next;
    this.state.lastSyncedAt = new Date(this.clock).toISOString();
    this.state.lastError = null;
    this.state.lockExpires = null;
    this.state.lockToken = null;
  }
  async finishError(token: string, msg: string) {
    if (this.state.lockToken !== token) return;
    this.state.lastError = msg;
    this.state.lockExpires = null;
    this.state.lockToken = null;
  }
}

let passed = 0;
function ok(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => {
      passed++;
      console.log(`  PASS  ${name}`);
    },
    (e) => {
      console.error(`  FAIL  ${name}\n        ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    },
  );
}

async function main() {
  const client = new FixtureGmailClient();
  const store = new MemStore();
  store.customers = [
    { id: "cust-foo", email: "  foo@example.com " },
    { id: "cust-dup-a", email: "dup@example.com" },
    { id: "cust-dup-b", email: "DUP@example.com" },
  ];
  const deps = { client, store, initialDays: 30 };

  console.log("[同期]");
  let first!: Awaited<ReturnType<typeof runSync>>;
  await ok("初回同期: 直近30日の INBOX のみ（送信済み・迷惑メール・45日前は入らない）", async () => {
    first = await runSync(deps);
    assert.equal(first.status, "ok");
    assert.equal(first.mode, "initial");
    assert.equal(first.hasMore, false);
    assert.ok(!store.rows.has("fx-0007"), "SENT が入っている");
    assert.ok(!store.rows.has("fx-0008"), "SPAM が入っている");
    assert.ok(!store.rows.has("fx-0009"), "45日前が入っている");
    assert.ok(store.rows.has("fx-0001") && store.rows.has("fx-bulk-055"));
    assert.equal(store.rows.size, 6 + 55); // 実メール6 + 一括55
    assert.ok(store.state.lastHistoryId, "historyId 保存");
  });

  await ok("一覧ページング検証用に 51 件以上入っている", () => assert.ok(store.rows.size > 50));

  // ユーザー操作を模して既存行を変更
  const r1 = store.rows.get("fx-0001")!;
  r1.status = "対応中";
  r1.memo = "担当者メモ";

  await ok("2回目の同期: 新着のみ増え、既存行のステータス・メモが上書きされない", async () => {
    client.addMessage({ id: "fx-new-1", subject: "新着テスト（架空）" });
    const before = client.calls.getMessage;
    const r = await runSync(deps);
    assert.equal(r.mode, "history");
    assert.equal(r.imported, 1);
    assert.equal(client.calls.getMessage - before, 1, "差分以外を取得している");
    assert.equal(store.rows.size, 6 + 55 + 1);
    assert.equal(store.rows.get("fx-0001")!.status, "対応中");
    assert.equal(store.rows.get("fx-0001")!.memo, "担当者メモ");
  });

  await ok("履歴の中の非INBOX（送信済み）メッセージは取り込まない", async () => {
    client.addMessage({ id: "fx-sent-2", subject: "送信済み（取り込み不可）", labels: ["SENT"] });
    const r = await runSync(deps);
    assert.equal(r.imported, 0);
    assert.ok(!store.rows.has("fx-sent-2"));
  });

  await ok("historyId 失効(404相当): エラーにならず再取り込みされ重複しない", async () => {
    client.expireHistory();
    const sizeBefore = store.rows.size;
    const r = await runSync(deps);
    assert.equal(r.status, "ok");
    assert.equal(r.mode, "fallback");
    assert.equal(r.imported, 0);
    assert.equal(store.rows.size, sizeBefore);
    // 失効後にまた新着が差分で取れる（cursor が更新されている）
    client.addMessage({ id: "fx-new-2", subject: "失効後の新着" });
    const r2 = await runSync(deps);
    assert.equal(r2.mode, "history");
    assert.equal(r2.imported, 1);
  });

  await ok("同じ message id を2回取り込んでも1行のまま", async () => {
    const row = store.rows.get("fx-0002")!;
    const n = await store.insertEmails([row]);
    assert.equal(n, 0);
  });

  await ok("同時実行: 片方は busy でスキップされ、重複・エラーなし", async () => {
    client.addMessage({ id: "fx-new-3", subject: "並行テスト" });
    const [a, b] = await Promise.all([runSync(deps), runSync(deps)]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, ["busy", "ok"]);
    assert.ok(store.rows.has("fx-new-3"));
  });

  await ok("異常終了でロックが残っても、失効時間後に同期できる", async () => {
    store.state.lockToken = "dead";
    store.state.lockExpires = store.clock + 150_000;
    const busy = await runSync(deps);
    assert.equal(busy.status, "busy");
    store.clock += 151_000; // TTL 経過
    client.addMessage({ id: "fx-new-4", subject: "ロック失効後" });
    const r = await runSync({ ...deps, now: () => store.clock });
    assert.equal(r.status, "ok");
    assert.ok(store.rows.has("fx-new-4"));
  });

  await ok("1回あたりの件数上限: 残りは次回に持ち越し（cursor は進めない）", async () => {
    const c2 = new FixtureGmailClient();
    const s2 = new MemStore();
    const r1 = await runSync({ client: c2, store: s2, initialDays: 30, limits: { maxPerRun: 20 } });
    assert.equal(r1.hasMore, true);
    assert.equal(s2.rows.size, 20);
    assert.equal(s2.state.lastHistoryId, null, "未完了なのに cursor が進んだ");
    let guard = 0;
    while ((await runSync({ client: c2, store: s2, initialDays: 30, limits: { maxPerRun: 20 } })).hasMore && guard++ < 10);
    assert.equal(s2.rows.size, 61);
    assert.ok(s2.state.lastHistoryId);
  });

  await ok("Gmail 障害(認証失敗/タイムアウト): error を返し既存データは残り、ロックは解放され、概要に鍵・トークンが無い", async () => {
    const sizeBefore = store.rows.size;
    for (const kind of ["auth", "timeout", "rate_limit"] as const) {
      process.env.GMAIL_FIXTURE_FAIL = kind;
      const r = await runSync(deps);
      assert.equal(r.status, "error");
      assert.equal(r.errorCode, kind);
      assert.ok(!/key|token|bearer|private/i.test(store.state.lastError ?? "") || kind === "auth", "秘匿語");
      assert.equal(store.state.lockToken, null);
    }
    delete process.env.GMAIL_FIXTURE_FAIL;
    assert.equal(store.rows.size, sizeBefore);
    const r = await runSync(deps);
    assert.equal(r.status, "ok"); // 復旧後は同期できる
    assert.equal(store.state.lastError, null);
  });

  await ok("顧客照合: 大文字小文字・空白違いで1件一致 / 複数一致は自動確定しない / 不一致は null", () => {
    assert.equal(store.rows.get("fx-0001")!.from_address, "foo@example.com");
    assert.equal(store.rows.get("fx-0001")!.customer_id, "cust-foo");
    assert.equal(store.rows.get("fx-0002")!.customer_id, null); // dup は2件
    assert.equal(store.rows.get("fx-0003")!.customer_id, null); // 不一致
  });

  console.log("[文字コード / MIME]");
  const parsed = (id: string) => parseGmailMessage(client.peek(id));
  await ok("ISO-2022-JP: 件名・送信者名・本文が文字化けしない", () => {
    const p = parsed("fx-0001");
    assert.equal(p.subject, "【ご注文】母の日ギフトのお願い（架空）");
    assert.equal(p.fromName, "架空商事 見本太郎");
    assert.equal(p.fromAddress, "foo@example.com");
    assert.ok(p.bodyText?.includes("母の日用のアレンジメントを3点、5月10日にお届け"));
    assert.equal(p.bodyHtml, null);
    assert.equal(p.messageIdHeader, "<fx-0001@mail.example.invalid>");
    assert.equal(p.referencesHeader, "<fx-prev@mail.example.invalid>");
    assert.equal(p.replyTo, "Foo Reply <reply-foo@example.com>");
  });
  await ok("Shift_JIS", () => {
    const p = parsed("fx-0002");
    assert.equal(p.subject, "お見積りのご依頼（架空）");
    assert.equal(p.fromName, "見本商店 花子");
    assert.ok(p.bodyText?.includes("店舗用の花束の見積りをお願いします。"));
    assert.equal(p.cc, 'boss@example.test, "Sample, Taro" <taro@example.test>');
  });
  await ok("EUC-JP", () => {
    const p = parsed("fx-0006");
    assert.equal(p.subject, "定期配達についてのご相談（架空）");
    assert.equal(p.fromName, "試験工業 担当者");
    assert.ok(p.bodyText?.includes("毎週月曜日に事務所へ配達できますか。"));
  });
  await ok("UTF-8 multipart/alternative（text+html）・分割エンコード語の件名", () => {
    const p = parsed("fx-0003");
    assert.equal(p.subject, "【架空】春のお知らせ：キャンペーンのご案内");
    assert.ok(p.bodyText?.includes("架空のニュースレター"));
    assert.ok(p.bodyHtml?.includes("<table"));
  });
  await ok("multipart/mixed 入れ子 + 添付（日本語ファイル名・エンコード語ファイル名）", () => {
    const p = parsed("fx-0005");
    assert.ok(p.bodyText?.includes("資料を添付します"));
    assert.ok(p.bodyHtml?.includes("<b>添付</b>"));
    assert.deepEqual(p.attachments.map((a) => a.filename), ["見積書_サンプル.pdf", "report.html", "logo.svg", "大きな資料.zip", "注文書（架空）.txt"]);
    assert.equal(p.attachments[3].size, 6_000_000);
    assert.ok(findPartById(client.peek("fx-0005"), p.attachments[0].part_id));
  });
  await ok("添付取得: part_id から都度 Gmail のパートを解決してバイト列を返す", async () => {
    const msg = (await client.getMessage("fx-0005"))!;
    const att = parseGmailMessage(msg).attachments[0];
    const part = findPartById(msg, att.part_id)!;
    const bytes = await client.getAttachmentData("fx-0005", part.body!.attachmentId!);
    assert.ok(bytes.toString().startsWith("%PDF"));
  });
  await ok("HTML のみ / テキストのみの判別", () => {
    assert.equal(parsed("fx-0004").bodyText, null);
    assert.ok(parsed("fx-0004").bodyHtml);
  });
  await ok("ヘッダ補助: RFC2047 / アドレス分解", () => {
    assert.equal(decodeMimeWords("=?UTF-8?B?44GC?= =?UTF-8?B?44GE?="), "あい");
    assert.deepEqual(parseAddressList('"A, B" <a@x.test>, c@y.test'), [
      { name: "A, B", address: "a@x.test" },
      { name: null, address: "c@y.test" },
    ]);
  });

  console.log("[本文サニタイズ（悪意あるHTML）]");
  const evil = parsed("fx-0004").bodyHtml!;
  const view = prepareHtmlForViewer(evil);
  await ok("script / onerror / javascript: / form / meta refresh / iframe / svg が除去される", () => {
    const h = view.html.toLowerCase();
    for (const bad of ["<script", "onerror", "onclick", "onload", "javascript:", "<form", "<input", "http-equiv", "<iframe", "<svg", "<meta", "<style", "evil.example.invalid"]) {
      assert.ok(!h.includes(bad), `残存: ${bad}`);
    }
  });
  await ok("外部画像は src でなく data-remote-src に退避され、既定ではリクエストされない形になる", () => {
    assert.ok(view.hasRemoteImages);
    assert.ok(!/\ssrc="https?:/i.test(view.html), "img src に外部URLが残っている");
    assert.ok(view.html.includes("data-remote-src"));
    assert.ok(!view.html.includes("background-image"));
  });
  await ok("リンクは新しいタブ + noopener noreferrer、http(s)/mailto/tel のみ", () => {
    assert.ok(view.html.includes('href="https://example.com/ok"'));
    assert.ok(/rel="noopener noreferrer"/.test(view.html));
    assert.ok(/target="_blank"/.test(view.html));
  });
  await ok("相対 href・#fragment・tel: は href を落とし、絶対 http(s)/mailto のみ残る", () => {
    const v2 = prepareHtmlForViewer(
      '<a href="/admin/orders">rel</a><a href="admin/x">rel2</a><a href="//evil.example/x">proto</a><a href="#top">frag</a><a href="tel:0312345678">tel</a>' +
        '<a href="https://example.com/a">abs</a><a href="mailto:a@example.com">mail</a><a href=" javascript:alert(1)">js</a>',
    );
    assert.ok(!/href="\/admin/.test(v2.html) && !v2.html.includes('href="admin') && !v2.html.includes("//evil"));
    assert.ok(!v2.html.includes('href="#') && !v2.html.includes("tel:") && !v2.html.toLowerCase().includes("javascript"));
    assert.ok(v2.html.includes('href="https://example.com/a"') && v2.html.includes('href="mailto:a@example.com"'));
  });
  await ok("画像表示時の置換は属性のみ（本文・alt・title 中の同じ文字列は不変）", () => {
    const v3 = prepareHtmlForViewer(
      '<p>text data-remote-src="x" data-remote-src=y</p><img alt=\'a data-remote-src="b\' title=\'t data-remote-src="c\' src="https://img.example.com/p.png">',
    );
    const shown = buildSrcDoc(v3.html, true);
    const blocked = buildSrcDoc(v3.html, false);
    assert.ok(shown.includes('<p>text data-remote-src="x" data-remote-src=y</p>'), "本文が書き換わった: " + shown.slice(shown.indexOf("<body>")));
    assert.ok(shown.includes('src="https://img.example.com/p.png"') && !/ data-remote-src="https:\/\/img/.test(shown));
    assert.ok(shown.includes("alt=\"a data-remote-src=&quot;b\"") && shown.includes("title=\"t data-remote-src=&quot;c\""), "alt/title が書き換わった");
    assert.ok(!/ src="https:/.test(blocked), "ブロック時に src が残った");
  });
  await ok("ニュースレターHTML: 外部画像が退避される・表は残る", () => {
    const v = prepareHtmlForViewer(parsed("fx-0003").bodyHtml!);
    assert.ok(v.hasRemoteImages);
    assert.ok(v.html.includes("<table"));
    assert.ok(!/\ssrc="https:\/\/images/i.test(v.html));
  });
  await ok("HTML→テキスト表示の切替用プレーンテキスト", () => {
    const t = htmlToPlainText("<p>資料を<b>添付</b>します。</p><script>x()</script>");
    assert.ok(t.includes("資料を添付します。") && !t.includes("x()"));
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " (some FAILED)" : ""}`);
  void GmailError;
}

void main();
