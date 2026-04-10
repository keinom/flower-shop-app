"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";

export async function uploadOrderPhoto(
  formData: FormData
): Promise<{ error: string } | null> {
  const orderId = formData.get("order_id") as string;
  const file = formData.get("file") as File;

  if (!orderId || !file || file.size === 0) return { error: "ファイルが見つかりません" };

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("order-photos")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return { error: `ストレージへのアップロードに失敗しました: ${uploadError.message}` };
  }

  const { error: dbError } = await supabase.from("order_photos" as never).insert({
    order_id: orderId,
    storage_path: path,
    file_name: file.name,
  } as never);

  if (dbError) {
    console.error("DB insert error:", dbError);
    // ストレージは成功しているので削除してロールバック
    await supabase.storage.from("order-photos").remove([path]);
    return { error: `データベースへの保存に失敗しました: ${(dbError as { message: string }).message}` };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return null;
}

export async function deleteOrderPhoto(
  formData: FormData
): Promise<{ error: string } | null> {
  const orderId = formData.get("order_id") as string;
  const photoId = formData.get("photo_id") as string;
  const storagePath = formData.get("storage_path") as string;

  if (!orderId || !photoId || !storagePath) return { error: "パラメータが不足しています" };

  const supabase = await createClient();

  const { error: storageError } = await supabase.storage
    .from("order-photos")
    .remove([storagePath]);

  if (storageError) {
    console.error("Storage delete error:", storageError);
    return { error: `ストレージの削除に失敗しました: ${storageError.message}` };
  }

  await supabase.from("order_photos" as never).delete().eq("id", photoId);

  revalidatePath(`/admin/orders/${orderId}`);
  return null;
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
