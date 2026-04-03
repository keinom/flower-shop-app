"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 自分の顧客レコードを取得
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!customer) {
    redirect("/customer/orders/new?error=" + encodeURIComponent("顧客情報が見つかりません。管理者にお問い合わせください。"));
  }

  // フォームデータを取得
  const deliveryName    = (formData.get("delivery_name") as string).trim();
  const deliveryAddress = (formData.get("delivery_address") as string).trim();
  const deliveryDate    = formData.get("delivery_date") as string;
  const productName     = (formData.get("product_name") as string).trim();
  const quantityRaw     = formData.get("quantity") as string;
  const purpose         = (formData.get("purpose") as string).trim() || null;
  const messageCard     = (formData.get("message_card") as string).trim() || null;
  const remarks         = (formData.get("remarks") as string).trim() || null;

  // バリデーション
  const errors: string[] = [];
  if (!deliveryName)    errors.push("お届け先名は必須です");
  if (!deliveryAddress) errors.push("お届け先住所は必須です");
  if (!deliveryDate)    errors.push("お届け希望日は必須です");
  if (!productName)     errors.push("商品名は必須です");

  const quantity = parseInt(quantityRaw, 10);
  if (isNaN(quantity) || quantity < 1) errors.push("数量は1以上の数値で入力してください");

  // 過去日付チェック
  if (deliveryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deliveryDate);
    if (d < today) errors.push("お届け希望日は本日以降の日付を指定してください");
  }

  if (errors.length > 0) {
    redirect("/customer/orders/new?error=" + encodeURIComponent(errors.join("、")));
  }

  // 注文を挿入
  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      customer_id:      customer.id,
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

  if (insertError || !order) {
    redirect("/customer/orders/new?error=" + encodeURIComponent("注文の登録に失敗しました。もう一度お試しください。"));
  }

  revalidatePath("/customer");
  redirect(`/customer/orders/${order.id}?created=true`);
}
