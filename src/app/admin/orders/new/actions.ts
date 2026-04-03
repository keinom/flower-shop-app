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
    const selectedId = formData.get("customer_id") as string;
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

  // ── 注文データを取得・バリデーション ──
  const deliveryName    = (formData.get("delivery_name") as string)?.trim();
  const deliveryAddress = (formData.get("delivery_address") as string)?.trim();
  const deliveryDate    = formData.get("delivery_date") as string;
  const productName     = (formData.get("product_name") as string)?.trim();
  const quantityRaw     = formData.get("quantity") as string;
  const purpose         = (formData.get("purpose") as string)?.trim() || null;
  const messageCard     = (formData.get("message_card") as string)?.trim() || null;
  const remarks         = (formData.get("remarks") as string)?.trim() || null;

  const errors: string[] = [];
  if (!deliveryName)    errors.push("お届け先名は必須です");
  if (!deliveryAddress) errors.push("お届け先住所は必須です");
  if (!deliveryDate)    errors.push("お届け希望日は必須です");
  if (!productName)     errors.push("商品名は必須です");

  const quantity = parseInt(quantityRaw, 10);
  if (isNaN(quantity) || quantity < 1) errors.push("数量は1以上で入力してください");

  if (errors.length > 0) {
    redirect("/admin/orders/new?error=" + encodeURIComponent(errors.join("、")));
  }

  // ── 注文を挿入 ──
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id:      customerId,
      status:           "受付",
      delivery_name:    deliveryName,
      delivery_address: deliveryAddress,
      delivery_date:    deliveryDate,
      product_name:     productName,
      quantity,
      purpose,
      message_card:     messageCard,
      remarks,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect("/admin/orders/new?error=" + encodeURIComponent("注文の登録に失敗しました"));
  }

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${order.id}?created=true`);
}
