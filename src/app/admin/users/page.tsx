import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteAdminButton } from "@/components/admin/DeleteAdminButton";

interface AdminUsersPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // ログイン中の管理者ID取得
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // 管理者プロフィール一覧を取得
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  // auth.usersからメールアドレスを取得
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  // IDをキーにしたメールアドレスのマップ
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));

  // プロフィールとメールを結合
  const adminUsers = (adminProfiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "—",
  }));

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">管理者ユーザー</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            システムにアクセスできる管理者アカウントを管理します
          </p>
        </div>
        <Link href="/admin/users/new" className="btn-primary">
          + 管理者を追加
        </Link>
      </div>

      {sp.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {decodeURIComponent(sp.success)}
        </div>
      )}
      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* 管理者一覧テーブル */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="th">表示名</th>
              <th className="th">メールアドレス</th>
              <th className="th">追加日</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {adminUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="td text-center text-gray-400 py-8">
                  管理者ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              adminUsers.map((admin) => (
                <tr key={admin.id} className="tr-hover">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {admin.display_name ?? "（未設定）"}
                      </span>
                      {admin.id === currentUser?.id && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                          自分
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td text-gray-500">{admin.email}</td>
                  <td className="td text-gray-500 text-xs">
                    {new Date(admin.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="td">
                    {admin.id !== currentUser?.id && (
                      <DeleteAdminButton
                        userId={admin.id}
                        displayName={admin.display_name}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 注意書き */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
        <strong>注意：</strong>管理者アカウントは顧客情報・注文情報のすべてにアクセスできます。
        アカウント発行は信頼できる担当者のみに行ってください。
      </div>
    </div>
  );
}
