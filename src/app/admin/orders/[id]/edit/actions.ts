"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderType } from "@/types";

export async function updateAdminOrder(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orderId = formData.get("order_id") as string;
  if (!orderId) redirect("/admin/orders");

  // ── お届け先データ ──
  const orderType            = ((formData.get("order_type") as string)?.trim() || "配達") as OrderType;
  const deliveryName         = (formData.get("delivery_name") as string)?.trim();
  const deliveryPostalCode   = (formData.get("delivery_postal_code") as string)?.trim() || null;
  const deliveryAddress      = (formData.get("delivery_address") as string)?.trim() || null;
  const deliveryDate      = (formData.get("delivery_date")       as string) || null;
  const deliveryTimeStart = (formData.get("delivery_time_start") as string) || null;
  const deliveryTimeEnd   = (formData.get("delivery_time_end")   as string) || null;
  const deliveryPhone   = (formData.get("delivery_phone") as string)?.trim() || null;
  const deliveryEmail   = (formData.get("delivery_email") as string)?.trim() || null;
  const purpose         = (formData.get("purpose") as string)?.trim() || null;
  const messageCard     = (formData.get("message_card") as string)?.trim() || null;
  const remarks         = (formData.get("remarks") as string)?.trim() || null;

  if (!deliveryName) {
    redirect(`/admin/orders/${orderId}/edit?error=` + encodeURIComponent("お届け先名は必須です"));
  }

  // ── 商品明細 ──
  const itemProductNames = formData.getAll("item_product_name") as string[];
  const itemQuantities   = formData.getAll("item_quantity")     as string[];
  const itemUnitPrices   = formData.getAll("item_unit_price")   as string[];
  const itemDescriptions = formData.getAll("item_description")  as string[];
  const itemTaxRates     = formData.getAll("item_tax_rate")     as string[];

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
    redirect(`/admin/orders/${orderId}/edit?error=` + encodeURIComponent("商品を1つ以上入力してください"));
  }

  // ── 配送料明細を追加（任意）──
  const shippingEnabled   = formData.get("shipping_enabled") === "true";
  const shippingItemName  = (formData.get("shipping_item_name")  as string) || null;
  const shippingUnitPrice = parseInt((formData.get("shipping_unit_price") as string) || "0", 10);

  if (shippingEnabled && shippingItemName && shippingUnitPrice > 0) {
    orderItems.push({
      product_name: shippingItemName,
      description:  null,
      quantity:     1,
      unit_price:   shippingUnitPrice,
      tax_rate:     10,
    });
  }

  // ── 合計計算（税込）──
  const totalExcl   = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxRate     = orderItems[0].tax_rate;
  const totalAmount = totalExcl + Math.round(totalExcl * taxRate / 100);

  // summaryNameはシッピング以外の商品から算出
  const productItems = orderItems.filter(i => !i.product_name.startsWith("配送料（"));
  const totalQty    = productItems.reduce((s, i) => s + i.quantity, 0);
  const summaryName = productItems.length === 1 ? productItems[0].product_name : null;

  // ── orders を更新 ──
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      order_type:           orderType,
      delivery_name:        deliveryName,
      delivery_postal_code: deliveryPostalCode,
      delivery_address:     deliveryAddress,
      delivery_date:        deliveryDate,
      delivery_time_start: deliveryTimeStart,
      delivery_time_end:   deliveryTimeEnd,
      delivery_phone:      deliveryPhone,
      delivery_email:   deliveryEmail,
      product_name:     summaryName,
      quantity:         totalQty,
      purpose,
      message_card:     messageCard,
      remarks,
      total_amount:     totalAmount,
    })
    .eq("id", orderId);

  if (updateError) {
    redirect(`/admin/orders/${orderId}/edit?error=` + encodeURIComponent("注文の更新に失敗しました"));
  }

  // ── order_items を差し替え（削除→再挿入）──
  await supabase.from("order_items").delete().eq("order_id", orderId);

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      orderItems.map((item) => ({
        order_id:     orderId,
        product_name: item.product_name,
        description:  item.description,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        tax_rate:     item.tax_rate,
      }))
    );

  if (itemsError) {
    redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent("商品明細の更新に失敗しました"));
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}?success=` + encodeURIComponent("注文内容を更新しました"));
}
