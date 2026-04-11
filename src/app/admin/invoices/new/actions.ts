"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function generateInvoiceNumber(yearMonth: string, seq: number): string {
  return `INV-${yearMonth.replace("-", "")}-${String(seq).padStart(3, "0")}`;
}

export async function createInvoice(formData: FormData) {
  const customerId     = formData.get("customer_id") as string;
  const invoiceType    = formData.get("invoice_type") as "single" | "monthly";
  const targetYearMonth = (formData.get("target_year_month") as string) || null;
  const dueDate        = (formData.get("due_date") as string) || null;
  const remarks        = (formData.get("remarks") as string) || null;
  const orderIds       = formData.getAll("order_ids[]") as string[];

  if (!customerId || !invoiceType || orderIds.length === 0) {
    return { error: "必須項目が不足しています" };
  }

  const supabase = await createClient();

  // 注文情報を取得
  const { data: orders } = await supabase
    .from("orders")
    .select("id, product_name, quantity, total_amount, delivery_date")
    .in("id", orderIds);

  if (!orders || orders.length === 0) {
    return { error: "注文情報の取得に失敗しました" };
  }

  // 合計を計算（order_itemsがあればそちらを使う、なければtotal_amountから逆算）
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_name, quantity, unit_price, tax_rate")
    .in("order_id", orderIds);

  // 請求書番号の採番（今月の連番）
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { count } = await supabase
    .from("invoices" as never)
    .select("id", { count: "exact", head: true })
    .like("invoice_number" as never, `INV-${ym.replace("-", "")}-%`);

  const seq = (count ?? 0) + 1;
  const invoiceNumber = generateInvoiceNumber(ym, seq);

  // 合計計算
  let subtotal = 0;
  let taxAmount = 0;

  const invoiceItems: Array<{
    order_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }> = [];

  for (const order of orders) {
    const orderItems = (items ?? []).filter((i) => i.order_id === order.id);
    if (orderItems.length > 0) {
      for (const oi of orderItems) {
        const excl = oi.quantity * oi.unit_price;
        const tax  = Math.round(excl * oi.tax_rate / 100);
        subtotal  += excl;
        taxAmount += tax;
        invoiceItems.push({
          order_id:    order.id,
          description: oi.product_name,
          quantity:    oi.quantity,
          unit_price:  oi.unit_price,
          tax_rate:    oi.tax_rate,
        });
      }
    } else {
      // order_itemsがない場合はtotal_amountを使用（税込10%として逆算）
      const total = order.total_amount ?? 0;
      const excl  = Math.round(total / 1.1);
      const tax   = total - excl;
      subtotal  += excl;
      taxAmount += tax;
      invoiceItems.push({
        order_id:    order.id,
        description: order.product_name ?? "商品",
        quantity:    order.quantity ?? 1,
        unit_price:  excl,
        tax_rate:    10,
      });
    }
  }

  const totalAmount = subtotal + taxAmount;

  // 請求書を作成
  const { data: invoice, error: invError } = await supabase
    .from("invoices" as never)
    .insert({
      invoice_number:     invoiceNumber,
      customer_id:        customerId,
      invoice_type:       invoiceType,
      target_year_month:  targetYearMonth,
      subtotal,
      tax_amount:         taxAmount,
      total_amount:       totalAmount,
      status:             "draft",
      due_date:           dueDate || null,
      remarks:            remarks || null,
    } as never)
    .select("id")
    .single();

  if (invError || !invoice) {
    return { error: `請求書の作成に失敗しました: ${invError?.message}` };
  }

  const invoiceId = (invoice as { id: string }).id;

  // 明細を挿入
  const { error: itemsError } = await supabase
    .from("invoice_items" as never)
    .insert(
      invoiceItems.map((item) => ({ ...item, invoice_id: invoiceId } as never))
    );

  if (itemsError) {
    return { error: `明細の作成に失敗しました: ${itemsError.message}` };
  }

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoiceId}?created=1`);
}
