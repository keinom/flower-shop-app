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

export async function updatePaymentStatus(
  formData: FormData
): Promise<{ error: string } | null> {
  const orderId       = formData.get("order_id") as string;
  const paymentStatus = (formData.get("payment_status") as string) || null;
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const paymentPlan   = (formData.get("payment_plan")   as string) || null;

  if (!orderId) return { error: "注文IDが不正です" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      payment_method: paymentStatus === "代済み" ? paymentMethod : null,
      payment_plan:   paymentStatus === "代未"   ? paymentPlan   : null,
    } as never)
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return null;
}

export async function deleteOrder(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  if (!orderId) redirect("/admin/orders");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 請求書に紐づく注文は削除不可（請求データの整合性を守る）
  const { data: linkedInvoiceItems } = await supabase
    .from("invoice_items")
    .select("invoice_id")
    .eq("order_id", orderId)
    .limit(1);

  if (linkedInvoiceItems && linkedInvoiceItems.length > 0) {
    redirect(
      `/admin/orders/${orderId}?error=${encodeURIComponent(
        "この注文は請求書に紐づいているため削除できません。先に該当の請求書を削除・修正してください。"
      )}`
    );
  }

  // 添付写真をストレージごと削除
  const { data: rawPhotos } = await supabase
    .from("order_photos" as never)
    .select("storage_path")
    .eq("order_id", orderId);

  const photoPaths = ((rawPhotos ?? []) as Array<{ storage_path: string }>).map(
    (p) => p.storage_path
  );
  if (photoPaths.length > 0) {
    await supabase.storage.from("order-photos").remove(photoPaths);
    await supabase.from("order_photos" as never).delete().eq("order_id", orderId);
  }

  // 注文を削除（order_items / order_status_logs は ON DELETE CASCADE）
  // RLS で削除できなかった場合（admin 以外）は 0 件になるため、削除結果を確認する
  const { data: deleted, error: deleteError } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .select("id");

  if (deleteError || !deleted || deleted.length === 0) {
    redirect(
      `/admin/orders/${orderId}?error=${encodeURIComponent(
        "注文の削除に失敗しました。削除は管理者のみ実行できます。"
      )}`
    );
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/daily");
  redirect(`/admin/orders?deleted=1`);
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

  // 受付完了へ変更するときは支払い状況が必須
  if (newStatus === "受付完了") {
    const { data: orderData } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single();
    if (!(orderData as { payment_status?: string | null } | null)?.payment_status) {
      redirect(
        `/admin/orders/${orderId}?error=${encodeURIComponent("「受付完了」にする前に、支払い状況を設定してください")}`
      );
    }
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
