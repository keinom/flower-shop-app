import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SyncResult } from "./sync-core";

/**
 * 受信メールの定期同期（外部スケジューラ → /api/cron/sync-mail）用の共通処理。
 * スケジューラ（Supabase pg_cron / Vercel Cron / 手動 curl）には依存しない。
 */

/** 応答の共通ヘッダ。応答本文は pg_net の応答テーブルに残るためキャッシュさせない */
export const CRON_NO_STORE = { "Cache-Control": "no-store" } as const;

function sha256(v: string): Buffer {
  return createHash("sha256").update(v).digest();
}

/**
 * `Authorization: Bearer <CRON_SECRET>` の検証（フェイルクローズ）。
 * シークレット未設定（未定義・空文字）の環境では、ヘッダの内容にかかわらず常に false。
 * 比較は固定長ハッシュの timingSafeEqual（長さ・内容の差でタイミングが変わらない）。
 */
export function isValidCronAuth(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!authHeader) return false;
  return timingSafeEqual(sha256(authHeader), sha256(`Bearer ${secret}`));
}

/** 応答本文。件数系の情報のみ（メール本文・件名・送信者・メールボックス・鍵・トークンは入れない） */
export interface CronSyncBody {
  status: "ok" | "busy" | "noop" | "error";
  imported: number;
  remaining: number;
  hasMore: boolean;
  mode?: "initial" | "history" | "fallback";
  errorCode?: string;
}

const NOOP: CronSyncBody = { status: "noop", imported: 0, remaining: 0, hasMore: false };

/**
 * 認可済みの呼び出しに対する同期の実行と、結果→HTTP 応答の対応付け。
 * - Gmail 未設定（鍵なし・フィクスチャでもない）: 何も起動せず 200 noop（ロック・DB 書き込み・エラーログなし）
 * - 他の同期がロック保持中: 200 busy（エラーにしない。last_error は書かない）
 * - Gmail / DB エラー: 502（last_error への概要記録は runSync 側で済み）
 */
export async function runCronSync(deps: {
  isConfigured: () => boolean;
  sync: () => Promise<SyncResult>;
}): Promise<{ httpStatus: number; body: CronSyncBody }> {
  if (!deps.isConfigured()) return { httpStatus: 200, body: { ...NOOP } };

  const r = await deps.sync();
  if (r.status === "error") {
    if (r.errorCode === "not_configured") return { httpStatus: 200, body: { ...NOOP } };
    return {
      httpStatus: 502,
      body: { status: "error", imported: 0, remaining: 0, hasMore: false, errorCode: r.errorCode ?? "unknown" },
    };
  }
  return {
    httpStatus: 200,
    body: {
      status: r.status,
      imported: r.imported,
      remaining: r.remaining,
      hasMore: r.hasMore,
      ...(r.mode ? { mode: r.mode } : {}),
    },
  };
}
