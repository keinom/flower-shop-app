import { NextRequest, NextResponse } from "next/server";
import { isGmailConfigured } from "@/lib/gmail";
import { syncInbox } from "@/lib/gmail/sync";
import { CRON_NO_STORE, isValidCronAuth, runCronSync } from "@/lib/gmail/cron-sync";

// Gmail 取得は Node ランタイム。同期の時間予算（約40秒）＋前後処理が maxDuration 内に収まる
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 受信メールの定期同期。Supabase pg_cron（10分ごと）から呼ばれる（呼び出し元には依存しない）。
 * 認可は /api/cron/generate-recurring-orders と同じ Bearer CRON_SECRET。ログイン Cookie は見ない。
 * 認可に通らなければ同期・ロック取得・DB 書き込み・Gmail 呼び出しは一切行わない。
 */
export async function GET(req: NextRequest) {
  if (!isValidCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CRON_NO_STORE });
  }

  const { httpStatus, body } = await runCronSync({ isConfigured: isGmailConfigured, sync: syncInbox });
  return NextResponse.json(body, { status: httpStatus, headers: CRON_NO_STORE });
}
