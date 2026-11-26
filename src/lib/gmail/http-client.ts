import "server-only";
import { JWT } from "google-auth-library";
import { GMAIL_SCOPE, type GmailCredentials } from "./config";
import {
  GmailError,
  GmailHistoryExpiredError,
  type GmailApiMessage,
  type GmailClient,
  type GmailHistoryResult,
} from "./types";
import { decodeBase64Url } from "./mime";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * 本番用 Gmail クライアント（読み取り専用）。
 *
 * - google-auth-library の JWT（サービスアカウント＋ドメイン全体の委任）で
 *   gmail.readonly のアクセストークンを取得し、Gmail REST を fetch で呼ぶ（googleapis は使わない）。
 * - 対象メールボックスは JWT の subject（= 環境変数 GMAIL_IMPERSONATE_USER）で固定され、
 *   API 呼び出しは常に users/me。呼び出し側から任意のアドレスを渡す経路は無い。
 * - エラーは GmailError に正規化し、鍵・トークン・レスポンス本文を含めない。
 */
export class HttpGmailClient implements GmailClient {
  private readonly jwt: JWT;

  constructor(creds: GmailCredentials) {
    this.jwt = new JWT({
      email: creds.clientEmail,
      key: creds.privateKey,
      scopes: [GMAIL_SCOPE],
      subject: creds.impersonateUser,
    });
  }

  private async accessToken(): Promise<string> {
    try {
      const res = await this.jwt.getAccessToken();
      if (!res.token) throw new GmailError("auth");
      return res.token;
    } catch (e) {
      if (e instanceof GmailError) throw e;
      throw classifyThrown(e);
    }
  }

  private async request(path: string, params?: URLSearchParams): Promise<Response> {
    const url = `${BASE}${path}${params && params.size ? `?${params.toString()}` : ""}`;
    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (e) {
        throw classifyThrown(e);
      }
      if (res.status >= 500 && attempt < 1) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return res;
    }
  }

  private async failure(res: Response): Promise<GmailError> {
    let reason = "";
    try {
      const j = (await res.json()) as { error?: { errors?: { reason?: string }[] } };
      reason = j.error?.errors?.[0]?.reason ?? "";
    } catch {
      /* 本文は読まない・出さない */
    }
    if (res.status === 429 || /ratelimit|quota/i.test(reason)) return new GmailError("rate_limit");
    if (res.status === 401 || res.status === 403) return new GmailError("auth");
    return new GmailError("api", `Gmail API でエラーが発生しました（HTTP ${res.status}）`);
  }

  async getProfileHistoryId(): Promise<string> {
    const res = await this.request("/profile");
    if (!res.ok) throw await this.failure(res);
    const j = (await res.json()) as { historyId?: string };
    if (!j.historyId) throw new GmailError("api");
    return String(j.historyId);
  }

  async listInboxMessageIds(opts: { afterEpochSec: number; pageToken?: string }) {
    const p = new URLSearchParams({
      labelIds: "INBOX",
      q: `after:${Math.floor(opts.afterEpochSec)}`,
      maxResults: "500",
    });
    if (opts.pageToken) p.set("pageToken", opts.pageToken);
    const res = await this.request("/messages", p);
    if (!res.ok) throw await this.failure(res);
    const j = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string };
    return { ids: (j.messages ?? []).map((m) => m.id), nextPageToken: j.nextPageToken };
  }

  async listHistory(startHistoryId: string): Promise<GmailHistoryResult> {
    const ids = new Set<string>();
    let historyId = startHistoryId;
    let pageToken: string | undefined;
    for (let page = 0; page < 20; page++) {
      const p = new URLSearchParams({ startHistoryId, labelId: "INBOX" });
      p.append("historyTypes", "messageAdded");
      p.append("historyTypes", "labelAdded");
      if (pageToken) p.set("pageToken", pageToken);
      const res = await this.request("/history", p);
      if (res.status === 404) throw new GmailHistoryExpiredError();
      if (!res.ok) throw await this.failure(res);
      const j = (await res.json()) as {
        history?: {
          messagesAdded?: { message: { id: string } }[];
          labelsAdded?: { message: { id: string }; labelIds?: string[] }[];
        }[];
        nextPageToken?: string;
        historyId?: string;
      };
      for (const h of j.history ?? []) {
        for (const m of h.messagesAdded ?? []) ids.add(m.message.id);
        for (const m of h.labelsAdded ?? []) {
          if (m.labelIds?.includes("INBOX")) ids.add(m.message.id);
        }
      }
      if (j.historyId) historyId = String(j.historyId);
      pageToken = j.nextPageToken;
      if (!pageToken) return { messageIds: [...ids], historyId };
    }
    // 差分が極端に多い場合は日付ベースの再取り込みに任せる
    throw new GmailHistoryExpiredError();
  }

  async getMessage(id: string): Promise<GmailApiMessage | null> {
    const res = await this.request(`/messages/${encodeURIComponent(id)}`, new URLSearchParams({ format: "full" }));
    if (res.status === 404) return null;
    if (!res.ok) throw await this.failure(res);
    return (await res.json()) as GmailApiMessage;
  }

  async getAttachmentData(messageId: string, attachmentId: string): Promise<Buffer> {
    const res = await this.request(
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    if (!res.ok) throw await this.failure(res);
    const j = (await res.json()) as { data?: string };
    return decodeBase64Url(j.data ?? "");
  }
}

/** fetch / google-auth-library が投げた例外を、機微情報を含まない GmailError に変換 */
function classifyThrown(e: unknown): GmailError {
  const err = e as { name?: string; code?: string | number; response?: { status?: number } } | null;
  const name = err?.name ?? "";
  const code = String(err?.code ?? "");
  if (name === "TimeoutError" || name === "AbortError" || /TIMEDOUT|ECONNRESET|UND_ERR/i.test(code)) {
    return new GmailError("timeout");
  }
  const status = err?.response?.status;
  if (status === 429) return new GmailError("rate_limit");
  if (status && status >= 400 && status < 500) return new GmailError("auth");
  // 鍵の形式不正（ERR_OSSL / DECODER 等）も含め、認証系として扱う（詳細は出さない）
  if (/OSSL|DECODER|PEM|key/i.test(code + name)) return new GmailError("auth");
  return new GmailError("unknown");
}
