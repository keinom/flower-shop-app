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

  if (profile?.role !== "admin") redirect("/customer");

  return (
    <div className="min-h-screen flex flex-col">
      {/* トップナビゲーション */}
      <header
        className="text-white shadow-md flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #1f4e3b 0%, #255f47 60%, #2e7458 100%)",
        }}
      >
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-15" style={{ height: "3.75rem" }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">🌸</span>
              <div>
                <span className="font-bold text-base tracking-wide">花長</span>
                <span className="text-brand-300 text-xs ml-1.5 hidden sm:inline">注文管理システム</span>
              </div>
              <span
                className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgb(255 255 255 / 0.15)", color: "#d4f4e2" }}
              >
                管理者
              </span>
            </div>
            <div className="flex items-center gap-5">
              <span className="text-sm" style={{ color: "#b8dccb" }}>
                {profile?.display_name ?? user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors hover:bg-white/10 hover:text-white"
                  style={{ color: "#b8dccb" }}
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
            <NavItem href="/admin/orders" label="注文検索" icon="📋" />
            <NavItem href="/admin/recurring" label="定期注文" icon="🔄" />
            <NavItem href="/admin/customers" label="顧客一覧" icon="👥" />
            <div className="mx-4 my-3 border-t border-gray-200" />
            <div className="px-3 mb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                設定
              </p>
            </div>
            <NavItem href="/admin/users" label="管理者管理" icon="🔑" />
            <NavItem href="/admin/settings" label="設定" icon="⚙️" />
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
