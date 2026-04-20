import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminOrderEditClient } from "@/components/admin/AdminOrderEditClient";

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditOrderPage({
  params,
  searchParams,
}: EditOrderPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, customers(id, name)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  // 現在の消費税率
  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const taxRate = taxSetting?.rate ?? 10;
  const today   = new Date().toISOString().split("T")[0];
  const customer = order.customers as { id: string; name: string } | null;

  // Detect shipping item
  const SHIPPING_PREFIX = "配送料（";
  const shippingItem = orderItems?.find((i) => i.product_name.startsWith(SHIPPING_PREFIX));
  const regularItems = orderItems?.filter((i) => !i.product_name.startsWith(SHIPPING_PREFIX));

  // Parse carrier/size from shipping item name
  let defaultShipping: { carrier: string; size: number; feeTaxInc: number } | undefined;
  if (shippingItem) {
    const m = shippingItem.product_name.match(/配送料（(.+?)\s+(\d+)サイズ）/);
    if (m) {
      const carrierName = m[1];
      const size = parseInt(m[2], 10);
      const carrier = carrierName === "ヤマト運輸" ? "yamato" : carrierName === "佐川急便" ? "sagawa" : null;
      if (carrier && !isNaN(size)) {
        // 税抜→税込の再構築（shipping.ts と同じ端数切り捨てロジック）
        const u = shippingItem.unit_price;
        const feeTaxInc = u + Math.floor(u * 0.1);
        defaultShipping = { carrier, size, feeTaxInc };
      }
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/orders/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 注文詳細
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文を編集</h1>
        {customer && (
          <span className="text-sm text-gray-500">— {customer.name}</span>
        )}
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <AdminOrderEditClient
        orderId={id}
        taxRate={taxRate}
        today={today}
        defaultValues={{
          order_type:            ((order as { order_type?: string }).order_type ?? "配達") as import("@/types").OrderType,
          delivery_name:         order.delivery_name,
          delivery_postal_code:  (order as { delivery_postal_code?: string | null }).delivery_postal_code ?? null,
          delivery_address:      order.delivery_address ?? null,
          delivery_date:         order.delivery_date ?? null,
          delivery_time_start:   (order as { delivery_time_start?: string | null }).delivery_time_start ?? null,
          delivery_time_end:     (order as { delivery_time_end?: string | null }).delivery_time_end ?? null,
          delivery_phone:        (order as { delivery_phone?: string | null }).delivery_phone ?? null,
          delivery_email:        (order as { delivery_email?: string | null }).delivery_email ?? null,
          purpose:               order.purpose          ?? null,
          message_card:          order.message_card     ?? null,
          remarks:               order.remarks          ?? null,
        }}
        defaultItems={
          regularItems?.map((item) => ({
            product_name: item.product_name,
            description:  (item as { description?: string | null }).description ?? null,
            quantity:     item.quantity,
            unit_price:   item.unit_price,
          })) ?? []
        }
        defaultShipping={defaultShipping}
      />
    </div>
  );
}
