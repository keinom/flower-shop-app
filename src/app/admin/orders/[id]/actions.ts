"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";

export async function uploadOrderPhoto(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  const file = formData.get("file") as File;

  if (!orderId || !file || file.size === 0) return;

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("order-photos")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return;
  }

  await supabase.from("order_photos" as never).insert({
    order_id: orderId,
    storage_path: path,
    file_name: file.name,
  } as never);

  revalidatePath(`/admin/orders/${orderId}`);
}

export async function deleteOrderPhoto(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  const photoId = formData.get("photo_id") as string;
  const storagePath = formData.get("storage_path") as string;

  if (!orderId || !photoId || !storagePath) return;

  const supabase = await createClient();

  await supabase.storage.from("order-photos").remove([storagePath]);
  await supabase.from("order_photos" as never).delete().eq("id", photoId);

  revalidatePath(`/admin/orders/${orderId}`);
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  const newStatus = formData.get("new_status") as OrderStatus;
  const note = (formData.get("note") as string).trim() || null;

  if (!orderId || !newStatus) {
    redirect(`/admin/orders/${orderId}?error=ステータスを選択してください`);
  }

  const supabase = await createClient();

  // 現在のステータスを取得
  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!current) {
    redirect(`/admin/orders/${orderId}?error=注文が見つかりません`);
  }

  if (current.status === newStatus) {
    redirect(
      `/admin/orders/${orderId}?error=${encodeURIComponent("同じステータスには変更できません")}`
    );
  }

  // ログインユーザーを取得
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ステータスを更新
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (updateError) {
    redirect(
      `/admin/orders/${orderId}?error=${encodeURIComponent("ステータスの更新に失敗しました")}`
    );
  }

  // 変更履歴を記録
  await supabase.from("order_status_logs").insert({
    order_id: orderId,
    old_status: current.status as OrderStatus,
    new_status: newStatus,
    changed_by: user.id,
    note,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect(
    `/admin/orders/${orderId}?success=${encodeURIComponent(`ステータスを「${newStatus}」に更新しました`)}`
  );
}
