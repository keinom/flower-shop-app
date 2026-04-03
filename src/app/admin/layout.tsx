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
      <header className="bg-brand-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌸</span>
              <span className="font-bold text-base">花長注文管理システム</span>
              <span className="ml-2 text-xs bg-brand-500 text-white px-2 py-0.5 rounded">
                管理者
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-brand-100">
                {profile?.display_name ?? user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-brand-200 hover:text-white transition-colors"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* サイドバー（アクティブ表示はClient Component側で制御） */}
        <nav className="w-48 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="py-4">
            <NavItem href="/admin" label="ダッシュボード" icon="📊" exact />
            <NavItem href="/admin/daily" label="日報" icon="📅" />
            <NavItem href="/admin/orders" label="注文一覧" icon="📋" />
            <NavItem href="/admin/customers" label="顧客一覧" icon="👥" />
            <div className="mt-2 mx-3 border-t border-gray-100" />
            <NavItem href="/admin/users" label="管理者管理" icon="🔑" />
            <NavItem href="/admin/settings" label="設定" icon="⚙️" />
          </div>
        </nav>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
