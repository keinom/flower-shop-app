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
          delivery_name:    order.delivery_name,
          delivery_address: order.delivery_address ?? null,
          delivery_date:       order.delivery_date ?? null,
          delivery_time_start: (order as { delivery_time_start?: string | null }).delivery_time_start ?? null,
          delivery_time_end:   (order as { delivery_time_end?: string | null }).delivery_time_end ?? null,
          delivery_phone:   (order as { delivery_phone?: string | null }).delivery_phone ?? null,
          delivery_email:   (order as { delivery_email?: string | null }).delivery_email ?? null,
          purpose:          order.purpose          ?? null,
          message_card:     order.message_card     ?? null,
          remarks:          order.remarks          ?? null,
        }}
        defaultItems={
          orderItems?.map((item) => ({
            product_name: item.product_name,
            description:  (item as { description?: string | null }).description ?? null,
            quantity:     item.quantity,
            unit_price:   item.unit_price,
          })) ?? []
        }
      />
    </div>
  );
}
