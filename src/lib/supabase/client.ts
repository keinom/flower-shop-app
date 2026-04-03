import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * ブラウザ（クライアントコンポーネント）用 Supabase クライアント
 * Client Component 内で使用する
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
