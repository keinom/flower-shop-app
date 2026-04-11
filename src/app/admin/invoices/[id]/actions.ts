"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateInvoiceStatus(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  const newStatus = formData.get("new_status") as string;

  const supabase = await createClient();

  const updates: Record<string, unknown> = { status: newStatus };

  if (newStatus === "issued") updates.issued_at = new Date().toISOString();
  if (newStatus === "sent")   updates.sent_at   = new Date().toISOString();

  // 入金済みにする場合、紐付いた注文の payment_status を「代済み」に更新
  if (newStatus === "paid") {
    const { data: items } = await supabase
      .from("invoice_items" as never)
      .select("order_id")
      .eq("invoice_id", invoiceId);

    const orderIds = ((items ?? []) as Array<{ order_id: string }>)
      .map((i) => i.order_id)
      .filter(Boolean);

    if (orderIds.length > 0) {
      await supabase
        .from("orders")
        .update({ payment_status: "代済み" } as never)
        .in("id", orderIds);
    }
  }

  const { error } = await supabase
    .from("invoices" as never)
    .update(updates as never)
    .eq("id", invoiceId);

  if (error) {
    redirect(`/admin/invoices/${invoiceId}?error=${encodeURIComponent("更新に失敗しました")}`);
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  revalidatePath("/admin");
  redirect(`/admin/invoices/${invoiceId}?success=${encodeURIComponent("ステータスを更新しました")}`);
}

export async function deleteInvoice(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  const supabase  = await createClient();

  await supabase.from("invoices" as never).delete().eq("id", invoiceId);

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}
