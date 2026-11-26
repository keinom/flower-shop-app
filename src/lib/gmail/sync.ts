import "server-only";
import { getGmailClient, getInitialSyncDays, isGmailConfigured, GMAIL_ERROR_MESSAGES } from "./index";
import { runSync, type SyncResult } from "./sync-core";
import { createSupabaseSyncStore } from "./sync-store";

export type { SyncResult } from "./sync-core";

/**
 * 受信メールを同期する。
 * 呼び出し元（Route Handler）が staff チェック、または cron シークレット検証を済ませていること（内部でサービスロールを使うため）。
 */
export async function syncInbox(): Promise<SyncResult> {
  if (!isGmailConfigured()) {
    return {
      status: "error",
      imported: 0,
      remaining: 0,
      hasMore: false,
      errorCode: "not_configured",
      error: GMAIL_ERROR_MESSAGES.not_configured,
    };
  }
  return runSync({
    client: getGmailClient(),
    store: createSupabaseSyncStore(),
    initialDays: getInitialSyncDays(),
  });
}
