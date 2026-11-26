/**
 * Gmail 連携の型・エラー定義（純粋モジュール。サーバー専用モジュールから利用される）
 */

/** Gmail REST API の users.messages.get (format=full) のうち、利用する部分 */
export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
}

export interface GmailApiMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  /** エポックミリ秒（文字列） */
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface GmailHistoryResult {
  /** 追加された（または INBOX ラベルが付いた）メッセージ ID */
  messageIds: string[];
  /** 差分取得後に保存すべき最新 historyId */
  historyId: string;
}

/**
 * 差し替え可能な Gmail 境界。
 * 実装: HttpGmailClient（本番）/ FixtureGmailClient（開発・検証用）
 * すべて読み取り専用（gmail.readonly）。
 */
export interface GmailClient {
  getProfileHistoryId(): Promise<string>;
  /** INBOX のメッセージ ID（新しい順）。afterEpochSec 以降。 */
  listInboxMessageIds(opts: {
    afterEpochSec: number;
    pageToken?: string;
  }): Promise<{ ids: string[]; nextPageToken?: string }>;
  /** startHistoryId 以降の差分。失効時は GmailHistoryExpiredError */
  listHistory(startHistoryId: string): Promise<GmailHistoryResult>;
  /** 削除済み等で存在しなければ null */
  getMessage(id: string): Promise<GmailApiMessage | null>;
  getAttachmentData(messageId: string, attachmentId: string): Promise<Buffer>;
}

export type GmailErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "api"
  | "unknown";

export const GMAIL_ERROR_MESSAGES: Record<GmailErrorCode, string> = {
  not_configured: "Gmail 連携が未設定です（設定手順は docs/GMAIL_SETUP.md）",
  auth: "Gmail の認証に失敗しました。サービスアカウント・ドメイン全体の委任・スコープ・環境変数を確認してください",
  rate_limit: "Gmail の利用制限に達しました。しばらく待ってから更新してください",
  timeout: "Gmail からの応答がありませんでした（タイムアウト）。再度お試しください",
  api: "Gmail API でエラーが発生しました",
  unknown: "Gmail との同期中にエラーが発生しました",
};

/** 画面・DB に出してよい（鍵・トークン・本文を含まない）エラー */
export class GmailError extends Error {
  constructor(
    public readonly code: GmailErrorCode,
    message?: string,
  ) {
    super(message ?? GMAIL_ERROR_MESSAGES[code]);
    this.name = "GmailError";
  }
}

export class GmailHistoryExpiredError extends Error {
  constructor() {
    super("history_expired");
    this.name = "GmailHistoryExpiredError";
  }
}

/** DB の last_error / 画面表示に使う概要。GmailError 以外は詳細を出さない */
export function summarizeError(e: unknown): { code: GmailErrorCode; message: string } {
  if (e instanceof GmailError) return { code: e.code, message: e.message };
  return { code: "unknown", message: GMAIL_ERROR_MESSAGES.unknown };
}

export interface ParsedAttachment {
  filename: string;
  mime_type: string;
  size: number;
  part_id: string;
}

export interface ParsedMail {
  gmailMessageId: string;
  gmailThreadId: string;
  labelIds: string[];
  messageIdHeader: string | null;
  referencesHeader: string | null;
  replyTo: string | null;
  fromName: string | null;
  /** 小文字化・trim 済み */
  fromAddress: string;
  to: string | null;
  cc: string | null;
  subject: string;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  /** ISO 文字列 */
  receivedAt: string;
  attachments: ParsedAttachment[];
}
