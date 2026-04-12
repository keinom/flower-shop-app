"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateInvoiceStatus(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  const newStatus = formData.get("new_status") as string;

  const supabase = await createClient();

  // 現在のステータスを取得（入金済みの往来に使用）
  const { data: current } = await supabase
    .from("invoices" as never)
    .select("status")
    .eq("id", invoiceId)
    .single();
  const currentStatus = (current as { status: string } | null)?.status ?? "";

  // 同じステータスなら何もしない
  if (currentStatus === newStatus) {
    redirect(`/admin/invoices/${invoiceId}`);
  }

  const updates: Record<string, unknown> = { status: newStatus };

  // 発行済みへ変更 → 発行日を記録
  if (newStatus === "issued") updates.issued_at = new Date().toISOString();
  // 送付済みへ変更 → 送付日を記録
  if (newStatus === "sent")   updates.sent_at   = new Date().toISOString();
  // 下書きへ戻す → 日付をリセット
  if (newStatus === "draft") {
    updates.issued_at = null;
    updates.sent_at   = null;
  }

  // 紐付き注文の payment_status を連動更新
  const { data: invoiceItems } = await supabase
    .from("invoice_items" as never)
    .select("order_id")
    .eq("invoice_id", invoiceId);

  const orderIds = ((invoiceItems ?? []) as Array<{ order_id: string }>)
    .map((i) => i.order_id)
    .filter(Boolean);

  if (orderIds.length > 0) {
    if (newStatus === "paid") {
      // 入金済みにする → 注文を「代済み」に
      await supabase
        .from("orders")
        .update({ payment_status: "代済み" } as never)
        .in("id", orderIds);
    } else if (currentStatus === "paid") {
      // 入金済みから戻す → 注文を「代未」に戻す
      await supabase
        .from("orders")
        .update({ payment_status: "代未" } as never)
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

export async function updateInvoiceDetails(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  const dueDate   = (formData.get("due_date")  as string) || null;
  const remarks   = (formData.get("remarks")   as string)?.trim() || null;

  const itemIds         = formData.getAll("item_id")          as string[];
  const itemDescs       = formData.getAll("item_description")  as string[];
  const itemQtys        = formData.getAll("item_quantity")     as string[];
  const itemUnitPrices  = formData.getAll("item_unit_price")   as string[];
  const itemTaxRates    = formData.getAll("item_tax_rate")     as string[];

  const supabase = await createClient();

  // 明細の更新と合計再計算
  let subtotal  = 0;
  let taxAmount = 0;

  for (let i = 0; i < itemIds.length; i++) {
    const qty      = Math.max(1, parseInt(itemQtys[i] ?? "1", 10));
    const price    = Math.max(0, parseInt(itemUnitPrices[i] ?? "0", 10));
    const taxRate  = parseInt(itemTaxRates[i] ?? "10", 10);
    const desc     = (itemDescs[i] ?? "").trim() || "商品";
    const excl     = qty * price;
    const tax      = Math.round(excl * taxRate / 100);
    subtotal  += excl;
    taxAmount += tax;

    await supabase
      .from("invoice_items" as never)
      .update({
        description: desc,
        quantity:    qty,
        unit_price:  price,
        tax_rate:    taxRate,
      } as never)
      .eq("id", itemIds[i]);
  }

  const totalAmount = subtotal + taxAmount;

  const { error } = await supabase
    .from("invoices" as never)
    .update({
      due_date:     dueDate,
      remarks,
      subtotal,
      tax_amount:   taxAmount,
      total_amount: totalAmount,
    } as never)
    .eq("id", invoiceId);

  if (error) {
    redirect(`/admin/invoices/${invoiceId}/edit?error=${encodeURIComponent("保存に失敗しました")}`);
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoiceId}?success=${encodeURIComponent("請求書を更新しました")}`);
}

export async function deleteInvoice(formData: FormData) {
  const invoiceId = formData.get("invoice_id") as string;
  const supabase  = await createClient();

  // 明細を先に削除してから請求書本体を削除
  await supabase.from("invoice_items" as never).delete().eq("invoice_id", invoiceId);
  await supabase.from("invoices" as never).delete().eq("id", invoiceId);

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}
