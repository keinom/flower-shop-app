"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 管理者ユーザーを新規作成する
 */
export async function createAdminUser(formData: FormData) {
  const displayName = (formData.get("display_name") as string).trim();
  const email = (formData.get("email") as string).trim();
  const password = (formData.get("password") as string).trim();

  if (!displayName || !email || !password) {
    redirect("/admin/users/new?error=" + encodeURIComponent("すべての項目を入力してください"));
  }
  if (password.length < 8) {
    redirect("/admin/users/new?error=" + encodeURIComponent("パスワードは8文字以上で設定してください"));
  }

  // 操作者が管理者かチェック
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/admin/users/new?error=" + encodeURIComponent("権限がありません"));
  }

  // 管理者アカウントを作成
  const adminClient = createAdminClient();
  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "admin",
      display_name: displayName,
    },
  });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "このメールアドレスはすでに登録されています"
      : `ユーザー作成に失敗しました: ${authError.message}`;
    redirect("/admin/users/new?error=" + encodeURIComponent(msg));
  }

  // profilesのroleをadminに明示的に更新（トリガーがcustomerをデフォルトにする場合に備えて）
  await adminClient
    .from("profiles")
    .update({ role: "admin", display_name: displayName })
    .eq("id", newUser.user.id);

  revalidatePath("/admin/users");
  redirect("/admin/users?success=" + encodeURIComponent(`管理者「${displayName}」を追加しました`));
}

/**
 * 管理者ユーザーを削除する（自分自身は削除不可）
 */
export async function deleteAdminUser(formData: FormData) {
  const targetUserId = formData.get("user_id") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 自分自身は削除不可
  if (user.id === targetUserId) {
    redirect("/admin/users?error=" + encodeURIComponent("自分自身のアカウントは削除できません"));
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

  if (error) {
    redirect("/admin/users?error=" + encodeURIComponent("ユーザーの削除に失敗しました"));
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?success=" + encodeURIComponent("管理者ユーザーを削除しました"));
}
