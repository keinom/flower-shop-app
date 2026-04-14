"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateTaxRate(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 管理者のみ操作可能
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/settings?error=" + encodeURIComponent("権限がありません"));
  }

  const rateRaw = formData.get("rate") as string;
  const note    = (formData.get("note") as string)?.trim() || null;
  const rate    = parseInt(rateRaw, 10);

  if (isNaN(rate) || rate < 0 || rate > 100) {
    redirect("/admin/settings?error=" + encodeURIComponent("税率は 0〜100 の整数で入力してください"));
  }

  const { error } = await supabase
    .from("tax_settings")
    .insert({ rate, note, created_by: user.id });

  if (error) {
    redirect("/admin/settings?error=" + encodeURIComponent("税率の更新に失敗しました"));
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=" + encodeURIComponent(`消費税率を ${rate}% に更新しました`));
}
