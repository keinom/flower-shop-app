import "server-only";

/**
 * Gmail 連携の設定（すべて server-only の環境変数。NEXT_PUBLIC_ は使わない）
 *
 *   GMAIL_SA_CLIENT_EMAIL   サービスアカウントのメールアドレス
 *   GMAIL_SA_PRIVATE_KEY    サービスアカウントの秘密鍵（改行は \n 表記でも可）
 *   GMAIL_IMPERSONATE_USER  読み取り対象のメールボックス（ドメイン全体の委任で impersonate）
 *   GMAIL_INITIAL_SYNC_DAYS 初回／フォールバック時に取り込む日数（任意・既定 30）
 *
 * 要求スコープは gmail.readonly のみ。impersonate 先は環境変数でのみ決まり、
 * リクエスト・フォーム・DB の値からは決して決めない。
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export interface GmailCredentials {
  clientEmail: string;
  privateKey: string;
  impersonateUser: string;
}

/**
 * フィクスチャ（架空データ）モードか。
 * 開発・検証専用: GMAIL_FIXTURE_MODE=1 かつ本番ではないときだけ有効。
 * NODE_ENV=production または VERCEL_ENV=production では常に無効（フラグを立てても無視される）。
 */
export function isFixtureMode(): boolean {
  if (process.env.GMAIL_FIXTURE_MODE !== "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return true;
}

function normalizePrivateKey(raw: string): string {
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  // Vercel 等に 1 行で登録された場合のリテラル "\n" を実際の改行に戻す
  return k.replace(/\\n/g, "\n");
}

/** 未設定なら null */
export function getGmailCredentials(): GmailCredentials | null {
  const clientEmail = process.env.GMAIL_SA_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GMAIL_SA_PRIVATE_KEY;
  const impersonateUser = process.env.GMAIL_IMPERSONATE_USER?.trim();
  if (!clientEmail || !privateKey?.trim() || !impersonateUser) return null;
  return { clientEmail, privateKey: normalizePrivateKey(privateKey), impersonateUser };
}

export function isGmailConfigured(): boolean {
  return isFixtureMode() || getGmailCredentials() !== null;
}

/** 初回／フォールバック時に遡る日数（1〜365、既定 30） */
export function getInitialSyncDays(): number {
  const n = Number(process.env.GMAIL_INITIAL_SYNC_DAYS);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(Math.floor(n), 365);
}
