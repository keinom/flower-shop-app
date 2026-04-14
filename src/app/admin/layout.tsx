import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { NavItem } from "@/components/admin/NavItem";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  // スタッフ（admin / employee）以外はアクセス不可
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/customer");

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      {/* トップナビゲーション */}
      <header
        className="flex-shrink-0 text-white"
        style={{
          background: "linear-gradient(135deg, #1a3d2e 0%, #1f4e3b 50%, #255f47 100%)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="px-5 sm:px-8">
          <div className="flex items-center justify-between" style={{ height: "4.5rem" }}>

            {/* 左: ロゴ + システム名 */}
            <div className="flex items-center gap-4">
              {/* ロゴ画像（白抜き） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="花長"
                style={{
                  height: "36px",
                  width: "auto",
                  filter: "brightness(0) invert(1)",
                  opacity: 0.95,
                }}
              />
              {/* 縦区切り線 */}
              <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.25)" }} />
              {/* システム名 */}
              <div>
                <p className="text-xs font-medium tracking-widest hidden sm:block"
                   style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em" }}>
                  ORDER MANAGEMENT
                </p>
                <p className="text-sm font-semibold tracking-wide"
                   style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>
                  注文管理システム
                </p>
              </div>
            </div>

            {/* 右: ユーザー情報 + ログアウト */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {profile?.display_name ?? user.email}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
                  {isAdmin ? "管理者" : "従業員"}
                </span>
              </div>
              <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.2)" }} className="hidden sm:block" />
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs font-medium px-4 py-2 rounded-md transition-all hover:bg-white/10 hover:text-white/95"
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  ログアウト
                </button>
              </form>
            </div>

          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <nav
          className="w-52 flex-shrink-0 flex flex-col"
          style={{
            background: "#fafaf9",
            borderRight: "1px solid #e5e7eb",
          }}
        >
          <div className="py-3 flex-1">
            <div className="px-3 mb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                メニュー
              </p>
            </div>
            <NavItem href="/admin" label="ダッシュボード" icon="📊" exact />
            <NavItem href="/admin/daily" label="日報" icon="📅" />
            <NavItem href="/admin/customers" label="顧客検索" icon="👥" />
            <NavItem href="/admin/orders" label="注文検索" icon="📋" />
            <NavItem href="/admin/recurring" label="定期注文" icon="🔄" />
            <NavItem href="/admin/invoices" label="請求書" icon="📄" />
            {isAdmin && (
              <>
                <div className="mx-4 my-3 border-t border-gray-200" />
                <div className="px-3 mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                    設定
                  </p>
                </div>
                <NavItem href="/admin/users" label="ユーザー管理" icon="🔑" />
                <NavItem href="/admin/settings" label="設定" icon="⚙️" />
              </>
            )}
          </div>
        </nav>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-auto" style={{ background: "#f5f4f2" }}>
          <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
