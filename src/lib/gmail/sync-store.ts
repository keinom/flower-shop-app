import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { InsertRow, SyncState, SyncStore } from "./sync-core";

const MAILBOX_KEY = "primary";

/**
 * Supabase（サービスロール）による SyncStore 実装。
 * createAdminClient() は RLS をバイパスするため、呼び出し元（syncInbox）が必ず
 * staff チェック、または cron シークレット検証を通した後にだけ使うこと。
 */
export function createSupabaseSyncStore(): SyncStore {
  const db = createAdminClient();

  return {
    async acquireLock(token, ttlSeconds) {
      // 行が無ければ作る（マイグレーションで投入済みだが念のため）
      await db
        .from("email_sync_state")
        .upsert({ mailbox_key: MAILBOX_KEY }, { onConflict: "mailbox_key", ignoreDuplicates: true });

      const nowDate = new Date();
      const now = nowDate.toISOString();
      const expires = new Date(nowDate.getTime() + ttlSeconds * 1000).toISOString();

      // 条件付き UPDATE 1 文でアトミックに取得（未取得 or 失効済みのときだけ更新される）
      const { data, error } = await db
        .from("email_sync_state")
        .update({ lock_token: token, locked_at: now, lock_expires_at: expires })
        .eq("mailbox_key", MAILBOX_KEY)
        .or(`lock_expires_at.is.null,lock_expires_at.lt.${now}`)
        .select("last_history_id, last_synced_at");
      if (error) throw new Error("lock_failed");

      if (!data || data.length === 0) {
        return { acquired: false, state: { lastHistoryId: null, lastSyncedAt: null } };
      }
      const state: SyncState = {
        lastHistoryId: data[0].last_history_id,
        lastSyncedAt: data[0].last_synced_at,
      };
      return { acquired: true, state };
    },

    async findExistingIds(ids) {
      const found = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data, error } = await db
          .from("inbound_emails")
          .select("gmail_message_id")
          .in("gmail_message_id", chunk);
        if (error) throw new Error("db_read_failed");
        for (const r of data ?? []) found.add(r.gmail_message_id);
      }
      return found;
    },

    async matchCustomers(emails) {
      const map = new Map<string, string[]>();
      const { data, error } = await db.rpc("match_customers_by_email", { p_emails: emails });
      if (error) throw new Error("db_read_failed");
      for (const r of data ?? []) {
        const list = map.get(r.email_key) ?? [];
        list.push(r.customer_id);
        map.set(r.email_key, list);
      }
      return map;
    },

    async insertEmails(rows: InsertRow[]) {
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const { data, error } = await db
          .from("inbound_emails")
          .upsert(rows.slice(i, i + 50), { onConflict: "gmail_message_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error("db_write_failed");
        inserted += data?.length ?? 0;
      }
      return inserted;
    },

    async finishSuccess(token, nextHistoryId) {
      const now = new Date().toISOString();
      const patch: Database["public"]["Tables"]["email_sync_state"]["Update"] = {
        last_error: null,
        last_error_at: null,
        lock_token: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: now,
      };
      if (nextHistoryId) {
        patch.last_history_id = nextHistoryId;
        patch.last_synced_at = now;
      } else {
        // 続きがある場合も「同期は成功した」ので最終成功日時は更新する（historyId は据え置き）
        patch.last_synced_at = now;
      }
      await db
        .from("email_sync_state")
        .update(patch)
        .eq("mailbox_key", MAILBOX_KEY)
        .eq("lock_token", token);
    },

    async finishError(token, errorSummary) {
      const now = new Date().toISOString();
      await db
        .from("email_sync_state")
        .update({
          last_error: errorSummary.slice(0, 300),
          last_error_at: now,
          lock_token: null,
          locked_at: null,
          lock_expires_at: null,
          updated_at: now,
        })
        .eq("mailbox_key", MAILBOX_KEY)
        .eq("lock_token", token);
    },
  };
}
