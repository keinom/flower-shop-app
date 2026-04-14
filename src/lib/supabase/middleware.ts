import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Middleware 専用 Supabase クライアント
 * セッションのリフレッシュ処理を担う
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションをリフレッシュ（これを省略するとセッション切れになる）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 未ログインで保護されたページにアクセス → ログインへリダイレクト
  const isProtectedRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/customer");

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login にアクセス → ロールに応じてリダイレクト
  if (pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    // admin・employee はどちらも管理画面へ
    url.pathname =
      profile?.role === "admin" || profile?.role === "employee"
        ? "/admin"
        : "/customer";
    return NextResponse.redirect(url);
  }

  // 管理者ルートへのアクセス制御
  if (pathname.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // スタッフ以外（顧客など）は顧客ページへ
    if (role !== "admin" && role !== "employee") {
      const url = request.nextUrl.clone();
      url.pathname = "/customer";
      return NextResponse.redirect(url);
    }

    // 従業員が管理者専用ページへアクセス → ダッシュボードへ
    const isAdminOnlyPath =
      pathname.startsWith("/admin/settings") ||
      pathname.startsWith("/admin/users");

    if (role === "employee" && isAdminOnlyPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  // 顧客ルートにスタッフがアクセス → 管理画面へリダイレクト
  if (pathname.startsWith("/customer") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin" || profile?.role === "employee") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
