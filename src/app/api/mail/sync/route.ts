import { NextRequest, NextResponse } from "next/server";
import { getStaffOrNull } from "@/lib/auth/staff";
import { syncInbox } from "@/lib/gmail/sync";

// Gmail 取得は Node ランタイム（Edge 不可）。Vercel の関数実行時間内に必ず終わるよう同期側にも上限あり。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 受信メールの差分同期を起動する。
 * /api 配下は middleware のロール制御対象外のため、ここで必ず staff チェックを行う。
 * Server Action ではなく Route Handler にしているのは、Server Action がクライアント側で直列に
 * 実行されるため、同期中に他の操作（一括ステータス変更など）が待たされるのを避けるため。
 */
export async function POST(req: NextRequest) {
  const noStore = { "Cache-Control": "private, no-store" };

  const staff = await getStaffOrNull();
  if (!staff) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403, headers: noStore });
  }

  // 他サイトからのリクエストを拒否（Cookie 認証の POST なので同一オリジンのみ許可）
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* 不正な Origin は拒否 */
    }
    if (!host || originHost !== host) {
      return NextResponse.json({ error: "不正なリクエストです" }, { status: 403, headers: noStore });
    }
  }

  const result = await syncInbox();
  return NextResponse.json(
    {
      status: result.status,
      imported: result.imported,
      remaining: result.remaining,
      hasMore: result.hasMore,
      errorCode: result.errorCode ?? null,
      error: result.error ?? null,
    },
    { headers: noStore },
  );
}
