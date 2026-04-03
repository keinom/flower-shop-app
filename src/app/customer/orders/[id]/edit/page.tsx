import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_PURPOSES, DELIVERY_TIME_OPTIONS } from "@/lib/constants";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { updateCustomerOrder } from "./actions";

interface CustomerEditOrderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function CustomerEditOrderPage({
  params,
  searchParams,
}: CustomerEditOrderPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 自分の顧客IDを確認
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!customer) redirect("/customer");

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .single();

  if (!order) notFound();

  // 「受付」以外は編集不可
  if (order.status !== "受付") {
    redirect(`/customer/orders/${id}`);
  }

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const taxRate = taxSetting?.rate ?? 10;
  const today   = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/customer/orders/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 注文詳細
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文を編集</h1>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
        受付完了になると編集できなくなります。お早めにご確認ください。
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={updateCustomerOrder} className="space-y-5">
        <input type="hidden" name="order_id" value={id} />

        {/* お届け先情報 */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">お届け先情報</h2>
          <div>
            <label htmlFor="delivery_name" className="label">
              お届け先名 <span className="text-red-500">*</span>
            </label>
            <input
              id="delivery_name"
              name="delivery_name"
              type="text"
              required
              defaultValue={order.delivery_name}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="delivery_address" className="label">お届け先住所</label>
            <input
              id="delivery_address"
              name="delivery_address"
              type="text"
              defaultValue={order.delivery_address ?? ""}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="delivery_phone" className="label">電話番号</label>
              <input
                id="delivery_phone"
                name="delivery_phone"
                type="tel"
                defaultValue={(order as { delivery_phone?: string | null }).delivery_phone ?? ""}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="delivery_email" className="label">メールアドレス</label>
              <input
                id="delivery_email"
                name="delivery_email"
                type="email"
                defaultValue={(order as { delivery_email?: string | null }).delivery_email ?? ""}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="delivery_date" className="label">お届け希望日</label>
              <input
                id="delivery_date"
                name="delivery_date"
                type="date"
                min={today}
                defaultValue={order.delivery_date ?? ""}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="delivery_time" className="label">
                希望時間帯
                <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
              </label>
              <input
                id="delivery_time"
                name="delivery_time"
                type="text"
                list="delivery_time_options_customer"
                defaultValue={(order as { delivery_time?: string | null }).delivery_time ?? ""}
                placeholder="例: 午前中、14:00〜16:00"
                className="input"
              />
              <datalist id="delivery_time_options_customer">
                {DELIVERY_TIME_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        {/* 商品情報 */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">商品情報</h2>
          <OrderItemsInput
            taxRate={taxRate}
            defaultItems={
              orderItems?.map((item) => ({
                product_name: item.product_name,
                description:  (item as { description?: string | null }).description ?? null,
                quantity:     item.quantity,
                unit_price:   item.unit_price,
              })) ?? []
            }
          />
          <div>
            <label htmlFor="purpose" className="label">用途</label>
            <select
              id="purpose"
              name="purpose"
              className="input"
              defaultValue={order.purpose ?? ""}
            >
              <option value="">選択してください（任意）</option>
              {ORDER_PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </section>

        {/* メッセージカード */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">メッセージカード</h2>
          <div>
            <label htmlFor="message_card" className="label">
              カード内容
              <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
            </label>
            <textarea
              id="message_card"
              name="message_card"
              rows={3}
              defaultValue={order.message_card ?? ""}
              className="input resize-none"
            />
          </div>
        </section>

        {/* 備考・ご要望 */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">備考・ご要望</h2>
          <div>
            <label htmlFor="remarks" className="label">
              備考・ご要望
              <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
            </label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              defaultValue={order.remarks ?? ""}
              className="input resize-none"
            />
          </div>
        </section>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary px-8">変更を保存する</button>
          <Link href={`/customer/orders/${id}`} className="btn-secondary">キャンセル</Link>
        </div>
      </form>
    </div>
  );
}
