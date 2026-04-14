import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createStaffUser } from "../actions";

interface NewAdminUserPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewAdminUserPage({ searchParams }: NewAdminUserPageProps) {
  const sp = await searchParams;

  // 管理者のみアクセス可能
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  return (
    <div className="max-w-lg">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-700">
          ← ユーザー一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">ユーザーを追加</h1>
      </div>

      {sp.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="card p-6">
        <form action={createStaffUser} className="space-y-4">
          {/* 表示名 */}
          <div>
            <label className="label" htmlFor="display_name">
              表示名 <span className="text-red-500">*</span>
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              placeholder="例：山田 花子"
              className="input"
            />
          </div>

          {/* メールアドレス */}
          <div>
            <label className="label" htmlFor="email">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="staff@example.com"
              className="input"
            />
          </div>

          {/* パスワード */}
          <div>
            <label className="label" htmlFor="password">
              初期パスワード{" "}
              <span className="text-gray-400 text-xs font-normal">（8文字以上）</span>
              <span className="text-red-500"> *</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="8文字以上で入力"
              className="input"
            />
            <p className="mt-1 text-xs text-gray-400">
              ログイン後にパスワードを変更するよう案内してください
            </p>
          </div>

          {/* 権限 */}
          <div>
            <label className="label" htmlFor="role">
              権限 <span className="text-red-500">*</span>
            </label>
            <select id="role" name="role" defaultValue="employee" className="input">
              <option value="employee">従業員 — 業務機能のみ使用可能</option>
              <option value="admin">管理者 — 全機能 + ユーザー管理・設定変更</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="submit" className="btn-primary">
              ユーザーを追加する
            </button>
            <Link href="/admin/users" className="btn-secondary">
              キャンセル
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
