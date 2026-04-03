import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * サービスロールキーを使う管理者用クライアント
 * RLS をバイパスできるため、Server Action 内でのみ使用すること
 * クライアントコンポーネントでは絶対に使用しない
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です"
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
