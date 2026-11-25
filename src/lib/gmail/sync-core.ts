import "server-only";
import { parseGmailMessage } from "./mime";
import {
  GmailHistoryExpiredError,
  summarizeError,
  type GmailClient,
  type ParsedMail,
} from "./types";

/**
 * 受信メール同期のコア（永続化は SyncStore に委譲。Gmail は GmailClient に委譲）。
 *
 * - 初回: 直近 N 日の INBOX を取り込み、その時点の historyId を保存
 * - 2回目以降: history API で差分のみ。historyId 失効時は直近 N 日の再取り込みにフォールバック
 * - 1 回の処理件数・時間に上限を設け、残りは次回に持ち越す（cursor は全件処理後にだけ進める）
 * - 同時実行はロック（アトミックな条件付き UPDATE・自動失効）で防止
 * - 重複は gmail_message_id の UNIQUE で防止（既存行は一切上書きしない）
 * - Gmail 側は読み取りのみ（既読化・ラベル操作・アーカイブはしない）
 */

export interface InsertRow {
  gmail_message_id: string;
  gmail_thread_id: string;
  message_id_header: string | null;
  references_header: string | null;
  reply_to: string | null;
  from_name: string | null;
  from_address: string;
  to_addresses: string | null;
  cc_addresses: string | null;
  subject: string;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  attachments: ParsedMail["attachments"];
  customer_id: string | null;
}

export interface SyncState {
  lastHistoryId: string | null;
  lastSyncedAt: string | null;
}

export interface SyncStore {
  /** アトミックにロックを取得。他が保持中（かつ未失効）なら acquired=false */
  acquireLock(token: string, ttlSeconds: number): Promise<{ acquired: boolean; state: SyncState }>;
  findExistingIds(ids: string[]): Promise<Set<string>>;
  /** 小文字化済みアドレス → 一致した顧客 ID 一覧 */
  matchCustomers(emails: string[]): Promise<Map<string, string[]>>;
  /** 重複（gmail_message_id 衝突）は無視。実際に挿入した件数を返す */
  insertEmails(rows: InsertRow[]): Promise<number>;
  /** 成功: ロック解除・最終同期日時更新・エラークリア。historyId が null なら cursor は据え置き */
  finishSuccess(token: string, nextHistoryId: string | null): Promise<void>;
  /** 失敗: ロック解除・エラー概要の記録（cursor は据え置き） */
  finishError(token: string, errorSummary: string): Promise<void>;
}

export interface SyncResult {
  status: "ok" | "busy" | "error";
  imported: number;
  /** 取り込み候補のうち今回処理しきれず、次回に持ち越す件数 */
  remaining: number;
  hasMore: boolean;
  mode?: "initial" | "history" | "fallback";
  errorCode?: string;
  error?: string;
}

export interface SyncLimits {
  /** 1 回の同期で Gmail から本文を取得する最大件数 */
  maxPerRun: number;
  /** 1 回の同期の時間予算（ミリ秒）。超えたら残りは次回 */
  timeBudgetMs: number;
  /** 異常終了時でもロックが自動失効するまでの秒数 */
  lockTtlSeconds: number;
  fetchConcurrency: number;
}

export const DEFAULT_LIMITS: SyncLimits = {
  maxPerRun: 100,
  timeBudgetMs: 40_000,
  lockTtlSeconds: 150,
  fetchConcurrency: 5,
};

const MAX_LIST_PAGES = 20; // 500 件 × 20 ページまで
const EXCLUDED_LABELS = ["SPAM", "TRASH", "DRAFT"];

export function isImportable(m: ParsedMail): boolean {
  return m.labelIds.includes("INBOX") && !m.labelIds.some((l) => EXCLUDED_LABELS.includes(l));
}

export async function runSync(deps: {
  client: GmailClient;
  store: SyncStore;
  initialDays: number;
  limits?: Partial<SyncLimits>;
  now?: () => number;
  newToken?: () => string;
}): Promise<SyncResult> {
  const { client, store } = deps;
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const now = deps.now ?? Date.now;
  const token = (deps.newToken ?? (() => crypto.randomUUID()))();
  const startedAt = now();

  const lock = await store.acquireLock(token, limits.lockTtlSeconds);
  if (!lock.acquired) return { status: "busy", imported: 0, remaining: 0, hasMore: false };

  try {
    let mode: SyncResult["mode"] = lock.state.lastHistoryId ? "history" : "initial";
    let candidateIds: string[] = [];
    let nextCursor: string;

    if (mode === "history") {
      try {
        const h = await client.listHistory(lock.state.lastHistoryId!);
        candidateIds = h.messageIds;
        nextCursor = h.historyId;
      } catch (e) {
        if (!(e instanceof GmailHistoryExpiredError)) throw e;
        mode = "fallback";
        nextCursor = "";
      }
    } else {
      nextCursor = "";
    }

    if (mode !== "history") {
      // cursor は一覧取得の「前」に確定する（取得中に届いたメールを取りこぼさない。重複は UNIQUE で吸収）
      nextCursor = await client.getProfileHistoryId();
      const afterEpochSec = Math.floor((now() - deps.initialDays * 86_400_000) / 1000);
      const seen = new Set<string>();
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_LIST_PAGES; page++) {
        const r = await client.listInboxMessageIds({ afterEpochSec, pageToken });
        for (const id of r.ids) seen.add(id);
        pageToken = r.nextPageToken;
        if (!pageToken) break;
      }
      candidateIds = [...seen];
    }

    // 既に取り込み済みのものは取得しない
    const existing = await store.findExistingIds(candidateIds);
    const todo = candidateIds.filter((id) => !existing.has(id));

    const toFetch = todo.slice(0, limits.maxPerRun);
    const parsed: ParsedMail[] = [];
    let processed = 0;
    for (let i = 0; i < toFetch.length; i += limits.fetchConcurrency) {
      if (now() - startedAt > limits.timeBudgetMs) break;
      const batch = toFetch.slice(i, i + limits.fetchConcurrency);
      const msgs = await Promise.all(batch.map((id) => client.getMessage(id)));
      processed += batch.length;
      for (const m of msgs) {
        if (!m) continue; // 削除済み
        const p = parseGmailMessage(m);
        if (isImportable(p)) parsed.push(p);
      }
    }

    let imported = 0;
    if (parsed.length > 0) {
      const addrs = [...new Set(parsed.map((p) => p.fromAddress).filter(Boolean))];
      const matches = addrs.length ? await store.matchCustomers(addrs) : new Map<string, string[]>();
      const rows: InsertRow[] = parsed.map((p) => {
        const ids = matches.get(p.fromAddress) ?? [];
        return {
          gmail_message_id: p.gmailMessageId,
          gmail_thread_id: p.gmailThreadId,
          message_id_header: p.messageIdHeader,
          references_header: p.referencesHeader,
          reply_to: p.replyTo,
          from_name: p.fromName,
          from_address: p.fromAddress,
          to_addresses: p.to,
          cc_addresses: p.cc,
          subject: p.subject,
          snippet: p.snippet,
          body_text: p.bodyText,
          body_html: p.bodyHtml,
          received_at: p.receivedAt,
          attachments: p.attachments,
          // 1 件一致のときだけ自動紐付け。複数一致は自動で決めない
          customer_id: ids.length === 1 ? ids[0] : null,
        };
      });
      imported = await store.insertEmails(rows);
    }

    const remaining = todo.length - processed;
    const hasMore = remaining > 0;
    await store.finishSuccess(token, hasMore ? null : nextCursor);
    return { status: "ok", imported, remaining, hasMore, mode };
  } catch (e) {
    const s = summarizeError(e);
    // 鍵・トークン・本文を含まない概要のみ記録・ログ出力
    console.error(`[mail-sync] failed: ${s.code}`);
    try {
      await store.finishError(token, s.message);
    } catch {
      /* ロックは TTL で自動失効する */
    }
    return {
      status: "error",
      imported: 0,
      remaining: 0,
      hasMore: false,
      errorCode: s.code,
      error: s.message,
    };
  }
}
