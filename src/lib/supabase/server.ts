import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * サーバー（Server Component / Server Action / Route Handler）用 Supabase クライアント
 * Server Component 内および Server Action 内で使用する
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component から呼ばれた場合は set できないが問題なし
          }
        },
      },
    }
  );
}

type CurrentUserProfile = {
  user: User | null;
  profile: { role: string; display_name: string | null } | null;
};

/**
 * ログインユーザー本人の検証（auth.getUser）と profiles のロール取得を
 * 1リクエスト内で1回に メモ化するヘルパー。
 *
 * admin/layout.tsx と各 page.tsx（例: admin/orders/[id]/page.tsx）が
 * それぞれ個別に auth.getUser() + profiles クエリを行っていたため、
 * 同一レンダー内で重複実行されていた（ナビゲーション毎に固定コストが乗る）。
 * React の cache() は「同一リクエストの RSC レンダーツリー内」でのみ結果を
 * 共有するため、リクエストをまたいで古い認証結果が使い回されることはない。
 *
 * 注意: auth.getUser() による本人検証自体は必ず実行する（JWT クレームを
 * 未検証で信頼するような近道はしない）。ミドルウェア（src/proxy.ts）は
 * RSC レンダーとは別の実行フェーズのため、このメモ化の対象外
 * （ミドルウェア自身の getUser()+profiles 呼び出しは従来どおり1回だけ発生する）。
 */
export const getCurrentUserProfile = cache(async (): Promise<CurrentUserProfile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  return { user, profile };
});
