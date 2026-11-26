"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffOrNull } from "@/lib/auth/staff";
import { findIdByIdempotencyKey, isUniqueViolation, readIdempotencyKey } from "@/lib/idempotency";
import { findDuplicateCustomers, type DuplicateCustomer } from "@/lib/customerDuplicates";
import type { OrderType } from "@/types";

export type CreateAdminOrderState = {
  error?: string;
  /** 新規顧客の重複候補（顧客も注文も作成していない）。確認後 confirm_duplicate=1 で再送信する */
  duplicates?: DuplicateCustomer[];
};

/**
 * 管理者の注文登録（既存顧客 / 新規顧客インライン作成）
 *
 * 二重送信対策（Issue #40）:
 * - 入力チェック・重複確認はすべて INSERT より前に行う（バリデーションエラーで孤立顧客を作らない）
 * - 冪等キー: 同じキーの送信は注文 1 件のみ。2 回目以降は作成済みの注文詳細へ遷移する。
 *   新規顧客の場合、顧客と注文を「1 つの送信」として扱い、同じキーを両テーブルに保存する
 *   （顧客作成後に注文作成が失敗して再送信されても、顧客は 2 件にならない）
 */
export async function createAdminOrder(
  _prevState: CreateAdminOrderState,
  formData: FormData
): Promise<CreateAdminOrderState> {
  const supabase = await createClient();

  // staff（admin / employee）以外は、顧客の重複確認・作成のいずれにも到達させない
  if (!(await getStaffOrNull())) redirect("/login");

  const idempotencyKey = readIdempotencyKey(formData);

  // ── 同じ送信がすでに処理済みなら、作成済みの注文詳細へ ──
  const doneOrderId = await findIdByIdempotencyKey(supabase, "orders", idempotencyKey);
  if (doneOrderId) {
    redirect(`/admin/orders/${doneOrderId}?created=true`);
  }

  // ── 顧客の入力チェック（まだ何も作成しない）──
  const customerType = formData.get("customer_type") as "existing" | "new";
  const confirmDuplicate = formData.get("confirm_duplicate") === "1";
  let existingCustomerId: string | null = null;
  let newCustomer: {
    name: string;
    phone: string | null;
    email: string | null;
    postalCode: string | null;
    address: string | null;
    notes: string | null;
  } | null = null;

  if (customerType === "existing") {
    // ── 既存顧客 ──
    const selectedId = (formData.get("customer_id") as string)?.trim();
    if (!selectedId) {
      return { error: "顧客を選択してください" };
    }
    existingCustomerId = selectedId;
  } else {
    // ── 新規顧客を作成（INSERT は全入力チェックの後）──
    const name = (formData.get("new_customer_name") as string)?.trim();
    if (!name) {
      return { error: "顧客名は必須です" };
    }
    newCustomer = {
      name,
      phone:      (formData.get("new_customer_phone") as string)?.trim() || null,
      email:      (formData.get("new_customer_email") as string)?.trim() || null,
      postalCode: (formData.get("new_customer_postal_code") as string)?.trim() || null,
      address:    (formData.get("new_customer_address") as string)?.trim() || null,
      notes:      (formData.get("new_customer_notes") as string)?.trim() || null,
    };
  }

  // ── お届け先データを取得 ──
  const orderType            = ((formData.get("order_type") as string)?.trim() || "配達") as OrderType;
  const deliveryName         = (formData.get("delivery_name") as string)?.trim();
  const printSenderName      = (formData.get("print_sender_name") as string)?.trim() || null;
  const deliveryPostalCode   = (formData.get("delivery_postal_code") as string)?.trim() || null;
  const deliveryAddress      = (formData.get("delivery_address") as string)?.trim() || null;
  const deliveryDate      = (formData.get("delivery_date")       as string) || null;
  const deliveryTimeStart = (formData.get("delivery_time_start") as string) || null;
  const deliveryTimeEnd   = (formData.get("delivery_time_end")   as string) || null;
  const deliveryPhone   = (formData.get("delivery_phone") as string)?.trim() || null;
  const deliveryEmail   = (formData.get("delivery_email") as string)?.trim() || null;
  const shippingDate    = orderType === "発送" ? (formData.get("shipping_date")    as string) || null : null;
  const shippingDeadline = orderType === "発送" ? (formData.get("shipping_deadline") as string) || null : null;
  const purpose         = (formData.get("purpose") as string)?.trim() || null;
  const messageCard     = (formData.get("message_card") as string)?.trim() || null;
  const remarks         = (formData.get("remarks") as string)?.trim() || null;

  if (!deliveryName) {
    return { error: "お届け先名は必須です" };
  }

  // ── 商品明細を取得 ──
  const itemProductNames = formData.getAll("item_product_name") as string[];
  const itemQuantities   = formData.getAll("item_quantity")     as string[];
  const itemUnitPrices   = formData.getAll("item_unit_price")   as string[];
  const itemDescriptions = formData.getAll("item_description")  as string[];
  const itemTaxRates     = formData.getAll("item_tax_rate")     as string[];

  if (itemProductNames.length === 0) {
    return { error: "商品を1つ以上入力してください" };
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
    // 商品名・説明・単価がすべて空 (＋数量1) の完全空行のみ除外
    .filter((item) => !(item.product_name === "" && !item.description && item.unit_price === 0));

  if (orderItems.length === 0) {
    return { error: "商品を1つ以上入力してください" };
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
  // インボイス制度では端数処理は「税率ごとに1回」が正しく、明細ごとの丸めは不可。
  // 税率ごとに税抜額を合算してから Math.round で丸め、その合計を taxAmount とする。
  const totalExcl = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const subtotalByRate = new Map<number, number>();
  for (const item of orderItems) {
    const excl = item.quantity * item.unit_price;
    subtotalByRate.set(item.tax_rate, (subtotalByRate.get(item.tax_rate) ?? 0) + excl);
  }
  const taxAmount = Array.from(subtotalByRate.entries()).reduce(
    (sum, [rate, subtotal]) => sum + Math.round((subtotal * rate) / 100),
    0
  );

  const totalAmount = totalExcl + taxAmount;

  // orders.product_name: 1商品のみなら商品名、複数なら null
  const totalQuantity      = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const summaryProductName = orderItems.length === 1 ? orderItems[0].product_name : null;

  // ── 顧客の確定（新規顧客はここで初めて作成する）──
  let customerId: string;
  if (existingCustomerId) {
    customerId = existingCustomerId;
  } else {
    const nc = newCustomer!;
    // 前回の送信で顧客だけ作成済み（注文の作成に失敗）なら、その顧客を再利用する
    let reused = await findIdByIdempotencyKey(supabase, "customers", idempotencyKey);

    if (!reused && !confirmDuplicate) {
      let duplicates: DuplicateCustomer[];
      try {
        duplicates = await findDuplicateCustomers(supabase, { name: nc.name, email: nc.email, phone: nc.phone });
      } catch {
        return { error: "既存顧客の確認に失敗しました。もう一度お試しください。" };
      }
      if (duplicates.length > 0) return { duplicates };
    }

    if (reused) {
      customerId = reused;
    } else {
      const { data: created, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: nc.name,
          phone: nc.phone,
          email: nc.email,
          postal_code: nc.postalCode,
          address: nc.address,
          notes: nc.notes,
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();

      if (customerError || !created) {
        if (isUniqueViolation(customerError)) {
          reused = await findIdByIdempotencyKey(supabase, "customers", idempotencyKey);
        }
        if (!reused) return { error: "顧客の作成に失敗しました" };
        customerId = reused;
      } else {
        customerId = created.id;
      }
    }
  }

  // ── 注文を挿入 ──
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id:           customerId,
      status:                "受付",
      order_type:            orderType,
      delivery_name:         deliveryName,
      print_sender_name:     printSenderName,
      delivery_postal_code:  deliveryPostalCode,
      delivery_address:      deliveryAddress,
      delivery_date:       deliveryDate,
      delivery_time_start: deliveryTimeStart,
      delivery_time_end:   deliveryTimeEnd,
      delivery_phone:      deliveryPhone,
      delivery_email:   deliveryEmail,
      shipping_date:    shippingDate,
      shipping_deadline: shippingDeadline,
      product_name:     summaryProductName,
      quantity:         totalQuantity,
      purpose,
      message_card:     messageCard,
      remarks,
      total_amount:     totalAmount,
      idempotency_key:  idempotencyKey,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // 並行して同じ送信が先に作成していた場合は、その注文へ遷移する
    if (isUniqueViolation(orderError)) {
      const existing = await findIdByIdempotencyKey(supabase, "orders", idempotencyKey);
      if (existing) redirect(`/admin/orders/${existing}?created=true`);
    }
    return { error: "注文の登録に失敗しました" };
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
    revalidatePath("/admin/orders");
    if (newCustomer) revalidatePath("/admin/customers");
    redirect(
      `/admin/orders/${order.id}?created=true&error=` +
        encodeURIComponent("商品明細の登録に失敗しました")
    );
  }

  // 再描画で画面状態が変わるため、revalidate は成功（redirect 直前）にのみ行う
  revalidatePath("/admin/orders");
  if (newCustomer) revalidatePath("/admin/customers");
  redirect(`/admin/orders/${order.id}?created=true`);
}
