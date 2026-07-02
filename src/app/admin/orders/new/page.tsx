import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminOrderFormClient, type AdminOrderCopyDefaults } from "@/components/admin/AdminOrderFormClient";
import { isShippingItemName, parseShippingItemName } from "@/lib/shipping";
import { formatJstDate } from "@/lib/date";
import { oneLineName } from "@/lib/name";
import type { OrderType } from "@/types";

interface NewAdminOrderPageProps {
  searchParams: Promise<{ customer_id?: string; copy_from?: string }>;
}

export default async function NewAdminOrderPage({ searchParams }: NewAdminOrderPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  // PostgREST max-rows=1000 を超える顧客を取りこぼさないよう、ページング取得
  type Customer = { id: string; name: string; phone: string | null; email: string | null; postal_code: string | null; address: string | null };
  const customers: Customer[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, postal_code, address")
      .order("name", { ascending: true })
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    customers.push(...data);
    if (data.length < 1000) break;
  }

  // 現在の消費税率を取得
  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const taxRate = taxSetting?.rate ?? 10;
  const today = new Date().toISOString().split("T")[0];

  // ── 過去注文のコピー（?copy_from=<注文ID>）──
  let presetCustomerId = sp.customer_id;
  let copyDefaults: AdminOrderCopyDefaults | undefined;
  let copySource: { id: string; deliveryName: string; createdAt: string } | undefined;

  if (sp.copy_from) {
    const { data: sourceOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("id", sp.copy_from)
      .single();

    if (sourceOrder) {
      const { data: sourceItems } = await supabase
        .from("order_items")
        .select("product_name, description, quantity, unit_price")
        .eq("order_id", sp.copy_from)
        .order("created_at", { ascending: true });

      // 配送料明細は商品リストから分離し、配送料セレクタの初期値として復元
      const shippingItem = sourceItems?.find((i) => isShippingItemName(i.product_name));
      const regularItems = (sourceItems ?? []).filter((i) => !isShippingItemName(i.product_name));

      let shipping: AdminOrderCopyDefaults["shipping"];
      if (shippingItem) {
        const parsed = parseShippingItemName(shippingItem.product_name);
        if (parsed) {
          // 明細は税抜で保存されるため税込に復元
          const u = shippingItem.unit_price;
          shipping = { ...parsed, feeTaxInc: u + Math.floor(u * 0.1) };
        }
      }

      copyDefaults = {
        order_type:           ((sourceOrder as { order_type?: string }).order_type ?? "配達") as OrderType,
        delivery_name:        sourceOrder.delivery_name,
        print_sender_name:    (sourceOrder as { print_sender_name?: string | null }).print_sender_name ?? null,
        delivery_postal_code: (sourceOrder as { delivery_postal_code?: string | null }).delivery_postal_code ?? null,
        delivery_address:     sourceOrder.delivery_address ?? null,
        delivery_phone:       (sourceOrder as { delivery_phone?: string | null }).delivery_phone ?? null,
        delivery_email:       (sourceOrder as { delivery_email?: string | null }).delivery_email ?? null,
        delivery_time_start:  (sourceOrder as { delivery_time_start?: string | null }).delivery_time_start ?? null,
        delivery_time_end:    (sourceOrder as { delivery_time_end?: string | null }).delivery_time_end ?? null,
        purpose:              sourceOrder.purpose ?? null,
        message_card:         sourceOrder.message_card ?? null,
        remarks:              sourceOrder.remarks ?? null,
        items: regularItems.map((item) => ({
          product_name: item.product_name,
          description:  (item as { description?: string | null }).description ?? null,
          quantity:     item.quantity,
          unit_price:   item.unit_price,
        })),
        shipping,
      };
      presetCustomerId = sourceOrder.customer_id ?? presetCustomerId;
      copySource = {
        id:           sourceOrder.id,
        deliveryName: sourceOrder.delivery_name,
        createdAt:    sourceOrder.created_at,
      };
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文を作成</h1>
      </div>

      {copySource && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          📋 {formatJstDate(copySource.createdAt)} の注文（{oneLineName(copySource.deliveryName)} 宛）の内容をコピーしています。
          お届け希望日などの日付は引き継がれないため、あらためて入力してください。{" "}
          <Link href={`/admin/orders/${copySource.id}`} className="underline hover:text-blue-900">
            コピー元の注文を見る
          </Link>
        </div>
      )}
      {sp.copy_from && !copySource && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
          ⚠ コピー元の注文が見つかりませんでした。空のフォームを表示しています。
        </div>
      )}

      <AdminOrderFormClient
        customers={customers}
        today={today}
        taxRate={taxRate}
        presetCustomerId={presetCustomerId}
        copyDefaults={copyDefaults}
      />
    </div>
  );
}
