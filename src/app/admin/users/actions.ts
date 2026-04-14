"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * スタッフユーザー（管理者 or 従業員）を新規作成する
 */
export async function createStaffUser(formData: FormData) {
  const displayName = (formData.get("display_name") as string).trim();
  const email       = (formData.get("email") as string).trim();
  const password    = (formData.get("password") as string).trim();
  const role        = (formData.get("role") as string) || "employee";

  if (!displayName || !email || !password) {
    redirect("/admin/users/new?error=" + encodeURIComponent("すべての項目を入力してください"));
  }
  if (password.length < 8) {
    redirect("/admin/users/new?error=" + encodeURIComponent("パスワードは8文字以上で設定してください"));
  }
  if (role !== "admin" && role !== "employee") {
    redirect("/admin/users/new?error=" + encodeURIComponent("無効な権限です"));
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

  // アカウントを作成
  const adminClient = createAdminClient();
  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      display_name: displayName,
    },
  });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "このメールアドレスはすでに登録されています"
      : `ユーザー作成に失敗しました: ${authError.message}`;
    redirect("/admin/users/new?error=" + encodeURIComponent(msg));
  }

  // profiles の role・display_name を確実に設定
  await adminClient
    .from("profiles")
    .update({ role, display_name: displayName })
    .eq("id", newUser.user.id);

  const roleLabel = role === "admin" ? "管理者" : "従業員";
  revalidatePath("/admin/users");
  redirect("/admin/users?success=" + encodeURIComponent(`${roleLabel}「${displayName}」を追加しました`));
}

/**
 * 後方互換: 旧 createAdminUser のエイリアス（呼び出し元が残っている場合に備えて）
 */
export const createAdminUser = createStaffUser;

/**
 * スタッフユーザーを削除する（自分自身は削除不可）
 */
export async function deleteAdminUser(formData: FormData) {
  const targetUserId = formData.get("user_id") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 管理者のみ削除可能
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/users?error=" + encodeURIComponent("権限がありません"));
  }

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
  redirect("/admin/users?success=" + encodeURIComponent("ユーザーを削除しました"));
}
