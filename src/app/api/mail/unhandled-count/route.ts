import { NextResponse } from "next/server";
import { getStaffOrNull } from "@/lib/auth/staff";
import { getUnhandledMailCount, unhandledCountResponse } from "@/lib/mailBadge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ナビバッジ用の未対応メール件数（件数のみ）。管理画面を開きっぱなしのときの定期取得用。
 * /api 配下は middleware のロール制御対象外のため、ここで必ず staff チェックを行う。
 */
export async function GET() {
  const { httpStatus, body } = await unhandledCountResponse({
    getStaff: getStaffOrNull,
    getCount: getUnhandledMailCount,
  });
  return NextResponse.json(body, { status: httpStatus, headers: { "Cache-Control": "private, no-store" } });
}
