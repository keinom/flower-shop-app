import "server-only";
import { getGmailCredentials, isFixtureMode } from "./config";
import { getFixtureClient } from "./fixtures";
import { HttpGmailClient } from "./http-client";
import { GmailError, type GmailClient } from "./types";

export { isGmailConfigured, isFixtureMode, getInitialSyncDays } from "./config";
export { GmailError, GMAIL_ERROR_MESSAGES, summarizeError } from "./types";
export type { GmailClient } from "./types";

let cached: { key: string; client: HttpGmailClient } | null = null;

/**
 * Gmail クライアントを返す。
 * - フィクスチャモード（開発・検証用。本番では無効）ならフィクスチャ実装
 * - それ以外は環境変数の資格情報で HttpGmailClient（impersonate 先は環境変数のみ）
 * - 未設定なら GmailError("not_configured")
 */
export function getGmailClient(): GmailClient {
  if (isFixtureMode()) return getFixtureClient();
  const creds = getGmailCredentials();
  if (!creds) throw new GmailError("not_configured");
  const key = `${creds.clientEmail}|${creds.impersonateUser}|${creds.privateKey.length}`;
  if (!cached || cached.key !== key) cached = { key, client: new HttpGmailClient(creds) };
  return cached.client;
}
