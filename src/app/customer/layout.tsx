import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { NavTab } from "@/components/customer/NavTab";

export default async function CustomerLayout({
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

  if (profile?.role === "admin") redirect("/admin");

  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("profile_id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      {/* トップナビゲーション */}
      <header className="bg-brand-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌸</span>
              <span className="font-bold text-base">花屋注文管理システム</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-brand-100">
                {customer?.name ?? profile?.display_name ?? user.email}
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

      {/* タブナビゲーション（アクティブ表示はClient Component側で制御） */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-6">
            <NavTab href="/customer" label="注文履歴" exact />
            <NavTab href="/customer/orders/new" label="新規注文" />
          </nav>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
