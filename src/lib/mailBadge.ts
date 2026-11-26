import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * ナビバッジ用の「未対応メール件数」。
 * 全ページのレイアウト描画に乗るため、count 1 本のみ（未対応の部分インデックス
 * inbound_emails_unhandled_idx を使う）。失敗時は null を返し、バッジを出さないだけでレイアウトは落とさない。
 */
export async function getUnhandledMailCount(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("status", "未対応");
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/**
 * 件数取得口（GET /api/mail/unhandled-count）の応答の決定。staff 以外には件数を返さない（401）。
 * 返すのは件数のみ（メールの内容・送信者は含めない）。件数取得に失敗した場合は 503。
 */
export async function unhandledCountResponse(deps: {
  getStaff: () => Promise<unknown>;
  getCount: () => Promise<number | null>;
}): Promise<{ httpStatus: number; body: { count: number } | { error: string } }> {
  if (!(await deps.getStaff())) return { httpStatus: 401, body: { error: "Unauthorized" } };
  const count = await deps.getCount();
  if (count === null) return { httpStatus: 503, body: { error: "Unavailable" } };
  return { httpStatus: 200, body: { count } };
}
