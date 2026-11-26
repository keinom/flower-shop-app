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
