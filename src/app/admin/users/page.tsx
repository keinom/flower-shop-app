import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteAdminButton } from "@/components/admin/DeleteAdminButton";

interface AdminUsersPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  admin:    "管理者",
  employee: "従業員",
};

const ROLE_COLORS: Record<string, string> = {
  admin:    "bg-brand-100 text-brand-700",
  employee: "bg-amber-100 text-amber-700",
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  // 管理者のみアクセス可能
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) redirect("/login");
  const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (currentProfile?.role !== "admin") redirect("/admin");

  const adminClient = createAdminClient();

  // admin・employee 両方のプロフィール一覧を取得
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .in("role", ["admin", "employee"])
    .order("created_at", { ascending: true });

  // auth.users からメールアドレスを取得
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  // ID をキーにしたメールアドレスのマップ
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));

  // プロフィールとメールを結合
  const staffUsers = (staffProfiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "—",
  }));

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            管理者・従業員アカウントを管理します
          </p>
        </div>
        <Link href="/admin/users/new" className="btn-primary">
          + ユーザーを追加
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

      {/* ユーザー一覧テーブル */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="th">表示名</th>
              <th className="th">メールアドレス</th>
              <th className="th">権限</th>
              <th className="th">追加日</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {staffUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="td text-center text-gray-400 py-8">
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              staffUsers.map((staff) => (
                <tr key={staff.id} className="tr-hover">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {staff.display_name ?? "（未設定）"}
                      </span>
                      {staff.id === currentUser?.id && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                          自分
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td text-gray-500">{staff.email}</td>
                  <td className="td">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[staff.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[staff.role] ?? staff.role}
                    </span>
                  </td>
                  <td className="td text-gray-500 text-xs">
                    {new Date(staff.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="td">
                    {staff.id !== currentUser?.id && (
                      <DeleteAdminButton
                        userId={staff.id}
                        displayName={staff.display_name}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 権限説明 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-brand-50 border border-brand-100 rounded-md text-sm">
          <p className="font-semibold text-brand-800 mb-1">🔑 管理者</p>
          <p className="text-brand-700">全機能にアクセスできます。ユーザー管理・設定変更も可能です。</p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-md text-sm">
          <p className="font-semibold text-amber-800 mb-1">👤 従業員</p>
          <p className="text-amber-700">注文・顧客・請求書などの業務機能を使用できます。ユーザー管理・設定変更は管理者のみです。</p>
        </div>
      </div>
    </div>
  );
}
