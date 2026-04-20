"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 顧客を新規登録する（ログインアカウントなし）
 */
export async function createCustomer(formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get("name") as string).trim();
  const phone = (formData.get("phone") as string).trim() || null;
  const email = (formData.get("email") as string).trim() || null;
  const postalCode = (formData.get("postal_code") as string).trim() || null;
  const address = (formData.get("address") as string).trim() || null;
  const notes = (formData.get("notes") as string).trim() || null;
  const createAccount = formData.get("create_account") === "on";
  const accountEmail = (formData.get("account_email") as string)?.trim() || null;
  const accountPassword = (formData.get("account_password") as string)?.trim() || null;

  if (!name) {
    redirect("/admin/customers/new?error=顧客名は必須です");
  }

  let profileId: string | null = null;

  // ログインアカウントを同時に発行する場合
  if (createAccount) {
    if (!accountEmail || !accountPassword) {
      redirect("/admin/customers/new?error=アカウント発行にはメールアドレスとパスワードが必要です");
    }
    if (accountPassword.length < 8) {
      redirect("/admin/customers/new?error=パスワードは8文字以上で設定してください");
    }

    const adminClient = createAdminClient();
    const { data: newUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: accountEmail,
        password: accountPassword,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          role: "customer",
          display_name: name,
        },
      });

    if (authError) {
      const msg =
        authError.message.includes("already registered")
          ? "このメールアドレスはすでに登録されています"
          : `アカウント作成に失敗しました: ${authError.message}`;
      redirect(`/admin/customers/new?error=${encodeURIComponent(msg)}`);
    }

    profileId = newUser.user.id;
  }

  // 顧客レコードを挿入
  const { data: customer, error: insertError } = await supabase
    .from("customers")
    .insert({
      name,
      phone,
      email,
      postal_code: postalCode,
      address,
      notes,
      profile_id: profileId,
    })
    .select("id")
    .single();

  if (insertError) {
    redirect(
      `/admin/customers/new?error=${encodeURIComponent("顧客の登録に失敗しました")}`
    );
  }

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${customer.id}?created=true`);
}

/**
 * 既存の顧客にログインアカウントを発行する
 */
export async function issueAccount(formData: FormData) {
  const customerId = formData.get("customer_id") as string;
  const email = (formData.get("email") as string).trim();
  const password = (formData.get("password") as string).trim();
  const displayName = (formData.get("display_name") as string).trim();

  if (!email || !password) {
    redirect(
      `/admin/customers/${customerId}?error=${encodeURIComponent("メールアドレスとパスワードは必須です")}`
    );
  }
  if (password.length < 8) {
    redirect(
      `/admin/customers/${customerId}?error=${encodeURIComponent("パスワードは8文字以上で設定してください")}`
    );
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: newUser, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "customer",
        display_name: displayName,
      },
    });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "このメールアドレスはすでに登録されています"
      : `アカウント作成に失敗しました`;
    redirect(
      `/admin/customers/${customerId}?error=${encodeURIComponent(msg)}`
    );
  }

  // 顧客レコードと紐づける
  await supabase
    .from("customers")
    .update({ profile_id: newUser.user.id })
    .eq("id", customerId);

  revalidatePath(`/admin/customers/${customerId}`);
  redirect(
    `/admin/customers/${customerId}?success=${encodeURIComponent("アカウントを発行しました")}`
  );
}
