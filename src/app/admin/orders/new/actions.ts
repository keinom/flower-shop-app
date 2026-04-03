"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createAdminOrder(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const customerType = formData.get("customer_type") as "existing" | "new";
  let customerId: string;

  if (customerType === "existing") {
    // ── 既存顧客 ──
    const selectedId = (formData.get("customer_id") as string)?.trim();
    if (!selectedId) {
      redirect("/admin/orders/new?error=" + encodeURIComponent("顧客を選択してください"));
    }
    customerId = selectedId;
  } else {
    // ── 新規顧客を作成 ──
    const name    = (formData.get("new_customer_name") as string)?.trim();
    const phone   = (formData.get("new_customer_phone") as string)?.trim() || null;
    const email   = (formData.get("new_customer_email") as string)?.trim() || null;
    const address = (formData.get("new_customer_address") as string)?.trim() || null;
    const notes   = (formData.get("new_customer_notes") as string)?.trim() || null;

    if (!name) {
      redirect("/admin/orders/new?error=" + encodeURIComponent("顧客名は必須です"));
    }

    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({ name, phone, email, address, notes })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      redirect("/admin/orders/new?error=" + encodeURIComponent("顧客の作成に失敗しました"));
    }

    customerId = newCustomer.id;
    revalidatePath("/admin/customers");
  }

  // ── お届け先データを取得 ──
  const deliveryName    = (formData.get("delivery_name") as string)?.trim();
  const deliveryAddress = (formData.get("delivery_address") as string)?.trim() || null;
  const deliveryDate      = (formData.get("delivery_date")       as string) || null;
  const deliveryTimeStart = (formData.get("delivery_time_start") as string) || null;
  const deliveryTimeEnd   = (formData.get("delivery_time_end")   as string) || null;
  const deliveryPhone   = (formData.get("delivery_phone") as string)?.trim() || null;
  const deliveryEmail   = (formData.get("delivery_email") as string)?.trim() || null;
  const purpose         = (formData.get("purpose") as string)?.trim() || null;
  const messageCard     = (formData.get("message_card") as string)?.trim() || null;
  const remarks         = (formData.get("remarks") as string)?.trim() || null;

  if (!deliveryName) {
    redirect("/admin/orders/new?error=" + encodeURIComponent("お届け先名は必須です"));
  }

  // ── 商品明細を取得 ──
  const itemProductNames = formData.getAll("item_product_name") as string[];
  const itemQuantities   = formData.getAll("item_quantity")     as string[];
  const itemUnitPrices   = formData.getAll("item_unit_price")   as string[];
  const itemDescriptions = formData.getAll("item_description")  as string[];
  const itemTaxRates     = formData.getAll("item_tax_rate")     as string[];

  if (itemProductNames.length === 0 || itemProductNames.every((n) => !n.trim())) {
    redirect("/admin/orders/new?error=" + encodeURIComponent("商品を1つ以上入力してください"));
  }

  const orderItems = itemProductNames
    .map((name, i) => {
      const qty     = parseInt(itemQuantities[i]   ?? "1",  10);
      const price   = parseInt(itemUnitPrices[i]   ?? "0",  10);
      const taxRate = parseInt(itemTaxRates[i]     ?? "10", 10);
      const desc    = (itemDescriptions[i] as string)?.trim() || null;
      return {
        product_name: name.trim(),
        description:  desc,
        quantity:     isNaN(qty)     ? 1  : Math.max(1, qty),
        unit_price:   isNaN(price)   ? 0  : Math.max(0, price),
        tax_rate:     isNaN(taxRate) ? 10 : taxRate,
      };
    })
    .filter((item) => item.product_name !== "");

  if (orderItems.length === 0) {
    redirect("/admin/orders/new?error=" + encodeURIComponent("商品名を入力してください"));
  }

  // ── 合計計算（税込）──
  const totalExcl   = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  // 税率はすべて同じはずだが、最初のアイテムの税率を使用
  const taxRate     = orderItems[0].tax_rate;
  const taxAmount   = Math.round(totalExcl * taxRate / 100);
  const totalAmount = totalExcl + taxAmount;

  // orders.product_name: 1商品のみなら商品名、複数なら null
  const totalQuantity      = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const summaryProductName = orderItems.length === 1 ? orderItems[0].product_name : null;

  // ── 注文を挿入 ──
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id:      customerId,
      status:           "受付",
      delivery_name:    deliveryName,
      delivery_address: deliveryAddress,
      delivery_date:       deliveryDate,
      delivery_time_start: deliveryTimeStart,
      delivery_time_end:   deliveryTimeEnd,
      delivery_phone:      deliveryPhone,
      delivery_email:   deliveryEmail,
      product_name:     summaryProductName,
      quantity:         totalQuantity,
      purpose,
      message_card:     messageCard,
      remarks,
      total_amount:     totalAmount,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect("/admin/orders/new?error=" + encodeURIComponent("注文の登録に失敗しました"));
  }

  // ── 商品明細を挿入 ──
  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      orderItems.map((item) => ({
        order_id:     order.id,
        product_name: item.product_name,
        description:  item.description,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        tax_rate:     item.tax_rate,
      }))
    );

  if (itemsError) {
    redirect(
      `/admin/orders/${order.id}?created=true&error=` +
        encodeURIComponent("商品明細の登録に失敗しました")
    );
  }

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${order.id}?created=true`);
}
