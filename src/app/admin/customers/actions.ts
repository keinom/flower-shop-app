"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffOrNull } from "@/lib/auth/staff";
import { findIdByIdempotencyKey, isUniqueViolation, readIdempotencyKey } from "@/lib/idempotency";
import { findDuplicateCustomers, type DuplicateCustomer } from "@/lib/customerDuplicates";

export type CreateCustomerState = {
  error?: string;
  /** 重複候補（登録は行われていない）。「それでも登録する」で confirm_duplicate=1 を付けて再送信する */
  duplicates?: DuplicateCustomer[];
};

/**
 * 顧客を新規登録する（任意でログインアカウントも同時発行）
 *
 * 二重送信対策（Issue #40）:
 * - 冪等キー（idempotency_key）が同じ送信は 1 件しか作成せず、2 回目以降は作成済みの顧客詳細へ遷移する
 * - 重複候補（氏名・メール・電話）がいれば登録せずに警告を返す。判定は認証ユーザー作成より前に行う
 * - エラー・警告は state で返し、入力内容を保持したまま画面に表示する
 */
export async function createCustomer(
  _prevState: CreateCustomerState,
  formData: FormData
): Promise<CreateCustomerState> {
  // staff（admin / employee）以外は、重複確認（全顧客取得）・認証ユーザー作成のいずれにも到達させない
  if (!(await getStaffOrNull())) redirect("/login");

  const supabase = await createClient();

  const str = (k: string) => ((formData.get(k) as string | null) ?? "").trim();
  const name = str("name");
  const phone = str("phone") || null;
  const email = str("email") || null;
  const postalCode = str("postal_code") || null;
  const address = str("address") || null;
  const notes = str("notes") || null;
  const createAccount = formData.get("create_account") === "on";
  const accountEmail = str("account_email") || null;
  const accountPassword = str("account_password") || null;
  const confirmDuplicate = formData.get("confirm_duplicate") === "1";
  const idempotencyKey = readIdempotencyKey(formData);

  // ── 同じ送信がすでに処理済みなら、作成済みの顧客詳細へ（認証ユーザー作成より前）──
  const doneId = await findIdByIdempotencyKey(supabase, "customers", idempotencyKey);
  if (doneId) {
    redirect(`/admin/customers/${doneId}?created=true`);
  }

  // ── 入力チェック（何も作成する前に行う）──
  if (!name) return { error: "顧客名は必須です" };
  if (createAccount) {
    if (!accountEmail || !accountPassword) {
      return { error: "アカウント発行にはメールアドレスとパスワードが必要です" };
    }
    if (accountPassword.length < 8) {
      return { error: "パスワードは8文字以上で設定してください" };
    }
  }

  // ── 重複警告（認証ユーザー作成より前）──
  if (!confirmDuplicate) {
    let duplicates: DuplicateCustomer[];
    try {
      duplicates = await findDuplicateCustomers(supabase, { name, email, phone });
    } catch {
      return { error: "既存顧客の確認に失敗しました。もう一度お試しください。" };
    }
    if (duplicates.length > 0) return { duplicates };
  }

  let profileId: string | null = null;

  // ログインアカウントを同時に発行する場合
  if (createAccount) {
    const adminClient = createAdminClient();
    const { data: newUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: accountEmail!,
        password: accountPassword!,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          role: "customer",
          display_name: name,
        },
      });

    if (authError || !newUser?.user) {
      // 並行送信で先に作成されていた場合は、その顧客へ遷移する
      const raced = await findIdByIdempotencyKey(supabase, "customers", idempotencyKey);
      if (raced) redirect(`/admin/customers/${raced}?created=true`);
      const msg =
        authError?.message.includes("already registered")
          ? "このメールアドレスはすでに登録されています"
          : `アカウント作成に失敗しました: ${authError?.message ?? ""}`;
      return { error: msg };
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
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError || !customer) {
    // 認証ユーザーだけが残らないよう後始末（best effort）
    if (profileId) {
      await createAdminClient().auth.admin.deleteUser(profileId).catch(() => {});
    }
    if (isUniqueViolation(insertError)) {
      const existing = await findIdByIdempotencyKey(supabase, "customers", idempotencyKey);
      if (existing) redirect(`/admin/customers/${existing}?created=true`);
    }
    return { error: "顧客の登録に失敗しました" };
  }

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${customer.id}?created=true`);
}

/**
 * 既存の顧客情報を更新する
 */
export async function updateCustomer(formData: FormData) {
  const supabase = await createClient();

  const id = (formData.get("id") as string)?.trim();
  if (!id) {
    redirect("/admin/customers?error=顧客IDが指定されていません");
  }

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const postalCode = (formData.get("postal_code") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!name) {
    redirect(`/admin/customers/${id}/edit?error=${encodeURIComponent("顧客名は必須です")}`);
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      name,
      phone,
      email,
      postal_code: postalCode,
      address,
      notes,
    })
    .eq("id", id);

  if (updateError) {
    redirect(
      `/admin/customers/${id}/edit?error=${encodeURIComponent("顧客情報の更新に失敗しました")}`
    );
  }

  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
  redirect(
    `/admin/customers/${id}?success=${encodeURIComponent("顧客情報を更新しました")}`
  );
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
