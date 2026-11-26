/**
 * 受信メール定期同期（Issue #37）のオフライン検証スクリプト。本物の Gmail / Supabase / pg_cron には接続しない。
 *
 *   NODE_OPTIONS="--require ./scripts/lib/stub-server-only.cjs" npx tsx scripts/verify-mail-cron.ts
 *
 * 対象: /api/cron/sync-mail の認可・結果の対応付け・同期の挙動（AC-1〜3, 6〜10, 12〜14）、
 *       件数取得口の認可（AC-29）、バッジ定期取得の制御ロジック（AC-26〜28, 31, 32）。
 * （DB 側の AC-15〜25 と、ブラウザ操作・実 DB を要する項目は PR 本文の確認手順を参照）
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { FixtureGmailClient } from "../src/lib/gmail/fixtures";
import { runSync, type InsertRow, type SyncState, type SyncStore } from "../src/lib/gmail/sync-core";
import { isValidCronAuth, runCronSync, CRON_NO_STORE } from "../src/lib/gmail/cron-sync";
import { unhandledCountResponse } from "../src/lib/mailBadge";
import { createMailBadgePoller } from "../src/lib/mailBadgeClient";
import { GET as cronGet } from "../src/app/api/cron/sync-mail/route";

// ── インメモリ SyncStore（Supabase 実装と同じ契約）。書き込みの回数も数える ──
class MemStore implements SyncStore {
  rows = new Map<string, InsertRow & { status: string; memo: string | null }>();
  writes = 0; // ロック取得・insert・finish の総数（no-op / 401 では 0 のままのはず）
  state = {
    lastHistoryId: null as string | null,
    lastSyncedAt: null as string | null,
    lockExpires: null as number | null,
    lockToken: null as string | null,
    lastError: null as string | null,
  };
  clock = Date.now();
  async acquireLock(token: string, ttl: number) {
    this.writes++;
    if (this.state.lockExpires !== null && this.state.lockExpires > this.clock) {
      return { acquired: false, state: { lastHistoryId: null, lastSyncedAt: null } as SyncState };
    }
    this.state.lockToken = token;
    this.state.lockExpires = this.clock + ttl * 1000;
    return { acquired: true, state: { lastHistoryId: this.state.lastHistoryId, lastSyncedAt: this.state.lastSyncedAt } };
  }
  async findExistingIds(ids: string[]) {
    return new Set(ids.filter((i) => this.rows.has(i)));
  }
  async matchCustomers() {
    return new Map<string, string[]>();
  }
  async insertEmails(rows: InsertRow[]) {
    let n = 0;
    for (const r of rows) {
      if (this.rows.has(r.gmail_message_id)) continue;
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
  snapshot() {
    return JSON.stringify({ s: this.state, r: [...this.rows.keys()], w: this.writes });
  }
}

let passed = 0;
async function ok(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}\n        ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

const SECRET = "test-cron-secret-not-real";
const req = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/cron/sync-mail", { headers });

async function main() {
  // 本番用の鍵・フィクスチャは無い前提（実 Supabase にも触れない）
  for (const k of ["GMAIL_SA_CLIENT_EMAIL", "GMAIL_SA_PRIVATE_KEY", "GMAIL_IMPERSONATE_USER", "GMAIL_FIXTURE_MODE"]) delete process.env[k];
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[認可 AC-1〜3]");
  await ok("isValidCronAuth: 正しい Bearer だけ true。ヘッダなし・誤値・スキームなし・Bearer のみは false", () => {
    assert.equal(isValidCronAuth(`Bearer ${SECRET}`, SECRET), true);
    assert.equal(isValidCronAuth(null, SECRET), false);
    assert.equal(isValidCronAuth("Bearer wrong", SECRET), false);
    assert.equal(isValidCronAuth("Bearer ", SECRET), false);
    assert.equal(isValidCronAuth("Bearer", SECRET), false);
    assert.equal(isValidCronAuth(SECRET, SECRET), false); // スキームなしの生値
    assert.equal(isValidCronAuth(`bearer ${SECRET}`, SECRET), false);
    assert.equal(isValidCronAuth(`Bearer ${SECRET} `, SECRET), false);
  });
  await ok("isValidCronAuth: シークレット未設定（undefined・空）では何を送っても false（Bearer undefined / Bearer も通らない）", () => {
    for (const secret of [undefined, ""]) {
      for (const h of [null, "", "Bearer undefined", "Bearer ", "Bearer", "undefined", `Bearer ${secret}`]) {
        assert.equal(isValidCronAuth(h, secret), false, `secret=${JSON.stringify(secret)} header=${h}`);
      }
    }
  });

  console.log("[ルート GET /api/cron/sync-mail（実ハンドラ。Supabase 環境変数なし = DB に触れれば例外になる）]");
  process.env.CRON_SECRET = SECRET;
  await ok("ヘッダなし / 誤値 / 生値 / Bearer のみ → 401・no-store・本文にシークレットなし（DB 非接触）", async () => {
    for (const h of [undefined, "Bearer wrong", SECRET, "Bearer ", "Bearer"]) {
      const res = await cronGet(req(h === undefined ? undefined : { authorization: h }));
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("cache-control"), "no-store");
      const text = await res.text();
      assert.ok(!text.includes(SECRET));
      assert.deepEqual(JSON.parse(text), { error: "Unauthorized" });
    }
  });
  await ok("staff の Cookie があってもシークレットがなければ 401（Cookie は参照しない）", async () => {
    const res = await cronGet(req({ cookie: "sb-access-token=staff-session; sb-refresh-token=x" }));
    assert.equal(res.status, 401);
  });
  await ok("CRON_SECRET 未設定: 正しそうなヘッダ・Bearer undefined・Bearer 空でも 401", async () => {
    delete process.env.CRON_SECRET;
    for (const h of ["Bearer undefined", "Bearer ", `Bearer ${SECRET}`, ""]) {
      const res = await cronGet(req({ authorization: h }));
      assert.equal(res.status, 401, h);
    }
    process.env.CRON_SECRET = "";
    assert.equal((await cronGet(req({ authorization: "Bearer " }))).status, 401);
    process.env.CRON_SECRET = SECRET;
  });
  await ok("AC-12 鍵未設定（フィクスチャでもない）: 正しいシークレットで 200 noop。DB に触れず（Supabase 環境変数なしでも例外にならない）エラーログも出ない", async () => {
    const errs: unknown[][] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errs.push(a);
    try {
      const res = await cronGet(req({ authorization: `Bearer ${SECRET}` }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(await res.json(), { status: "noop", imported: 0, remaining: 0, hasMore: false });
    } finally {
      console.error = orig;
    }
    assert.equal(errs.length, 0);
  });

  console.log("[同期の実行 AC-6〜10, 13（runCronSync + 実 runSync + フィクスチャ Gmail + インメモリ DB）]");
  const client = new FixtureGmailClient();
  const store = new MemStore();
  const call = (limits?: { maxPerRun: number }) =>
    runCronSync({
      isConfigured: () => true,
      sync: () => runSync({ client, store, initialDays: 30, limits }),
    });

  await ok("AC-6: 正しい呼び出しで 200・未取り込みが「未対応」で登録・last_synced_at 更新・ロック解放", async () => {
    const r = await call();
    assert.equal(r.httpStatus, 200);
    assert.equal(r.body.status, "ok");
    assert.equal(r.body.imported, 6 + 55);
    assert.equal(r.body.hasMore, false);
    assert.ok([...store.rows.values()].every((x) => x.status === "未対応"));
    assert.ok(store.state.lastSyncedAt);
    assert.equal(store.state.lockToken, null);
    assert.equal(store.state.lockExpires, null);
    assert.equal(store.state.lastError, null);
  });
  await ok("AC-7: 続けて呼ぶと 200・0 件・件数不変。ユーザーが変えたステータス・メモは上書きされない", async () => {
    const row = store.rows.get("fx-0001")!;
    row.status = "対応中";
    row.memo = "担当者メモ";
    const before = store.rows.size;
    const r = await call();
    assert.equal(r.httpStatus, 200);
    assert.equal(r.body.imported, 0);
    assert.equal(store.rows.size, before);
    assert.equal(store.rows.get("fx-0001")!.status, "対応中");
    assert.equal(store.rows.get("fx-0001")!.memo, "担当者メモ");
  });
  await ok("新着 1 通は差分で取り込まれる（定期実行の通常ケース）", async () => {
    client.addMessage({ id: "fx-cron-new", subject: "新着（架空）" });
    const r = await call();
    assert.equal(r.body.imported, 1);
    assert.equal(r.body.mode, "history");
    assert.ok(store.rows.has("fx-cron-new"));
  });
  await ok("AC-8: 1 回の上限を超える状態 → 1 回目は上限まで + hasMore。繰り返し呼ぶだけで全件。cursor は完了まで進まない", async () => {
    const c2 = new FixtureGmailClient();
    const s2 = new MemStore();
    const run = () =>
      runCronSync({ isConfigured: () => true, sync: () => runSync({ client: c2, store: s2, initialDays: 30, limits: { maxPerRun: 20 } }) });
    const r1 = await run();
    assert.equal(r1.httpStatus, 200);
    assert.equal(r1.body.imported, 20);
    assert.equal(r1.body.hasMore, true);
    assert.equal(r1.body.remaining, 41);
    assert.equal(s2.state.lastHistoryId, null, "未完了なのに cursor が進んだ");
    let calls = 1;
    while ((await run()).body.hasMore) calls++;
    assert.ok(calls <= 5);
    assert.equal(s2.rows.size, 61);
    assert.ok(s2.state.lastHistoryId);
  });
  await ok("AC-9: ロック保持中 → 200 busy。取り込みなし・last_error 不変・保持中のロックを壊さない", async () => {
    const s = new MemStore();
    s.state.lockToken = "other-holder";
    s.state.lockExpires = s.clock + 100_000;
    s.state.lastError = null;
    const r = await runCronSync({ isConfigured: () => true, sync: () => runSync({ client: new FixtureGmailClient(), store: s, initialDays: 30 }) });
    assert.equal(r.httpStatus, 200);
    assert.equal(r.body.status, "busy");
    assert.equal(s.rows.size, 0);
    assert.equal(s.state.lastError, null);
    assert.equal(s.state.lockToken, "other-holder");
    assert.equal(s.state.lockExpires, s.clock + 100_000);
  });
  await ok("AC-10: ロック期限切れ → ロックを取り直して正常に同期", async () => {
    const s = new MemStore();
    s.state.lockToken = "crashed";
    s.state.lockExpires = s.clock - 1000;
    const r = await runCronSync({ isConfigured: () => true, sync: () => runSync({ client: new FixtureGmailClient(), store: s, initialDays: 30 }) });
    assert.equal(r.httpStatus, 200);
    assert.equal(r.body.status, "ok");
    assert.equal(s.rows.size, 61);
    assert.equal(s.state.lockToken, null);
  });
  await ok("同時実行: 並列に複数回呼んでも二重登録なし・5xx なし・ロックは残らない（busy は 200）", async () => {
    const c = new FixtureGmailClient();
    const s = new MemStore();
    const run = () => runCronSync({ isConfigured: () => true, sync: () => runSync({ client: c, store: s, initialDays: 30 }) });
    const rs = await Promise.all([run(), run(), run(), run()]);
    assert.ok(rs.every((r) => r.httpStatus === 200));
    assert.equal(rs.filter((r) => r.body.status === "ok").length, 1);
    assert.equal(rs.filter((r) => r.body.status === "busy").length, 3);
    assert.equal(s.rows.size, 61);
    assert.equal(s.state.lockToken, null);
  });
  await ok("AC-13: Gmail エラー → 502・errorCode のみ（メッセージなし）・last_error に概要・ロック解放・次の正常実行でクリア", async () => {
    for (const kind of ["auth", "timeout", "rate_limit"] as const) {
      process.env.GMAIL_FIXTURE_FAIL = kind;
      const r = await (async () => {
        const orig = console.error;
        console.error = () => {};
        try {
          return await call();
        } finally {
          console.error = orig;
        }
      })();
      assert.equal(r.httpStatus, 502);
      assert.equal(r.body.status, "error");
      assert.equal(r.body.errorCode, kind);
      assert.ok(!("error" in r.body));
      assert.ok(store.state.lastError);
      assert.equal(store.state.lockToken, null);
    }
    delete process.env.GMAIL_FIXTURE_FAIL;
    const r = await call();
    assert.equal(r.httpStatus, 200);
    assert.equal(store.state.lastError, null);
  });
  await ok("AC-12(関数): isConfigured=false なら sync を呼ばず DB に一切書かない / not_configured も noop 扱い", async () => {
    const s = new MemStore();
    const before = s.snapshot();
    let called = false;
    const r = await runCronSync({ isConfigured: () => false, sync: async () => { called = true; throw new Error("x"); } });
    assert.equal(called, false);
    assert.equal(r.httpStatus, 200);
    assert.equal(r.body.status, "noop");
    assert.equal(s.snapshot(), before);
    const r2 = await runCronSync({ isConfigured: () => true, sync: async () => ({ status: "error", imported: 0, remaining: 0, hasMore: false, errorCode: "not_configured", error: "..." }) });
    assert.equal(r2.httpStatus, 200);
    assert.equal(r2.body.status, "noop");
  });
  await ok("AC-14: 全応答（ok / busy / noop / error）にメール内容・アドレス・鍵・シークレットが含まれない。キー集合は件数系のみ", async () => {
    const allowed = new Set(["status", "imported", "remaining", "hasMore", "mode", "errorCode"]);
    const bodies = [
      (await call()).body,
      (await runCronSync({ isConfigured: () => false, sync: async () => { throw 1; } })).body,
      (await runCronSync({ isConfigured: () => true, sync: async () => ({ status: "busy", imported: 0, remaining: 0, hasMore: false }) })).body,
      (await runCronSync({ isConfigured: () => true, sync: async () => ({ status: "error", imported: 0, remaining: 0, hasMore: false, errorCode: "auth", error: "認証に失敗" }) })).body,
    ];
    for (const b of bodies) {
      assert.ok(Object.keys(b).every((k) => allowed.has(k)), JSON.stringify(b));
      const t = JSON.stringify(b);
      assert.ok(!/@|subject|secret|token|key|bearer|架空|新着/i.test(t.replace(/errorCode|"status"/g, "")), t);
    }
    assert.equal(CRON_NO_STORE["Cache-Control"], "no-store");
  });

  console.log("[件数取得口 AC-29]");
  await ok("staff でなければ 401（件数を取得しにも行かない）/ staff なら件数のみ / 取得失敗は 503", async () => {
    let counted = 0;
    const getCount = async () => (counted++, 7);
    const none = await unhandledCountResponse({ getStaff: async () => null, getCount });
    assert.equal(none.httpStatus, 401);
    assert.equal(counted, 0);
    const okRes = await unhandledCountResponse({ getStaff: async () => ({ id: "u", role: "employee" }), getCount });
    assert.equal(okRes.httpStatus, 200);
    assert.deepEqual(okRes.body, { count: 7 });
    const fail = await unhandledCountResponse({ getStaff: async () => ({ id: "u" }), getCount: async () => null });
    assert.equal(fail.httpStatus, 503);
  });

  console.log("[バッジ定期取得の制御 AC-26〜28, 31, 32]");
  function harness(over?: { fetchCount?: (s: AbortSignal) => Promise<number | null> }) {
    let t = 1_000_000;
    let visible = true;
    const timers = new Map<number, () => void>();
    let nextId = 1;
    const counts: number[] = [];
    const fetches: { resolve: (n: number | null) => void; reject: (e: unknown) => void; signal: AbortSignal }[] = [];
    const poller = createMailBadgePoller({
      fetchCount: over?.fetchCount ??
        ((signal) => new Promise((resolve, reject) => { fetches.push({ resolve, reject, signal }); })),
      onCount: (n) => counts.push(n),
      isVisible: () => visible,
      intervalMs: 180_000,
      minGapMs: 15_000,
      now: () => t,
      setIntervalFn: (fn) => { const id = nextId++; timers.set(id, fn); return id; },
      clearIntervalFn: (id) => { timers.delete(id as number); },
    });
    return {
      poller, counts, fetches, timers,
      tick() { for (const fn of [...timers.values()]) fn(); },
      advance(ms: number) { t += ms; },
      setVisible(v: boolean) { visible = v; poller.onVisibilityChange(); },
      flush: () => new Promise((r) => setTimeout(r, 0)),
    };
  }

  await ok("表示中のみ間隔で取得し、反映される（件数のみ取得 = fetchCount 1 本）", async () => {
    const h = harness();
    h.poller.start();
    assert.equal(h.timers.size, 1);
    h.tick();
    assert.equal(h.fetches.length, 1);
    h.fetches[0].resolve(5);
    await h.flush();
    assert.deepEqual(h.counts, [5]);
  });
  await ok("非表示の間はタイマーが止まり取得されない。復帰時（間隔が空いていれば）に即取得、連続切替は 15 秒間隔で間引く", async () => {
    const h = harness();
    h.poller.start();
    h.setVisible(false);
    assert.equal(h.timers.size, 0, "非表示でタイマーが残っている");
    h.tick();
    assert.equal(h.fetches.length, 0);
    h.advance(60_000);
    h.setVisible(true);
    assert.equal(h.fetches.length, 1, "復帰時に取得されない");
    h.fetches[0].resolve(3);
    await h.flush();
    // 直後に連続切替
    h.setVisible(false);
    h.advance(2_000);
    h.setVisible(true);
    assert.equal(h.fetches.length, 1, "連続切替で過剰に取得");
    h.advance(20_000);
    h.setVisible(false);
    h.setVisible(true);
    assert.equal(h.fetches.length, 2);
    assert.deepEqual(h.counts, [3]);
  });
  await ok("取得中は重複して取得しない（同時 1 本）", () => {
    const h = harness();
    h.poller.start();
    h.tick();
    h.tick();
    assert.equal(h.fetches.length, 1);
  });
  await ok("AC-31: 失敗（null・例外・不正値）は無視。表示は更新されず、次の取得で復旧する", async () => {
    const results: (number | null | Error)[] = [null, new Error("offline"), Number.NaN, 9];
    const h = harness({
      fetchCount: async () => {
        const r = results.shift()!;
        if (r instanceof Error) throw r;
        return r;
      },
    });
    h.poller.start();
    for (let i = 0; i < 4; i++) {
      h.tick();
      await h.flush();
    }
    assert.deepEqual(h.counts, [9]);
  });
  await ok("AC-32: invalidate() 後は、取得中だった古い応答を捨てる（ステータス変更直後の巻き戻り防止）。その後の取得は反映", async () => {
    const h = harness();
    h.poller.start();
    h.tick();
    h.poller.invalidate(); // サーバー再描画で新しい値が来た
    assert.equal(h.fetches[0].signal.aborted, true);
    h.fetches[0].resolve(99); // 古い応答（abort 済みでも解決されうる）
    await h.flush();
    assert.deepEqual(h.counts, []);
    h.tick();
    h.fetches[1].resolve(2);
    await h.flush();
    assert.deepEqual(h.counts, [2]);
  });
  await ok("stop() でタイマー解除・応答破棄（アンマウント後に反映しない）", async () => {
    const h = harness();
    h.poller.start();
    h.tick();
    h.poller.stop();
    assert.equal(h.timers.size, 0);
    h.fetches[0].resolve(4);
    await h.flush();
    assert.deepEqual(h.counts, []);
    h.setVisible(true); // 停止後の visibilitychange は無視
    assert.equal(h.fetches.length, 1);
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " (with FAILURES)" : ""}`);
}

main();
