"use client";

import { useState } from "react";
import Link from "next/link";
import { ORDER_PURPOSES } from "@/lib/constants";
import { DeliveryTimeInput } from "@/components/ui/DeliveryTimeInput";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { updateAdminOrder } from "@/app/admin/orders/[id]/edit/actions";

interface OrderItem {
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
}

interface Props {
  orderId: string;
  taxRate: number;
  today: string;
  defaultValues: {
    delivery_name: string;
    delivery_address: string | null;
    delivery_date: string | null;
    delivery_time_start: string | null;
    delivery_time_end: string | null;
    delivery_phone: string | null;
    delivery_email: string | null;
    purpose: string | null;
    message_card: string | null;
    remarks: string | null;
  };
  defaultItems: OrderItem[];
}

export function AdminOrderEditClient({
  orderId,
  taxRate,
  today,
  defaultValues: dv,
  defaultItems,
}: Props) {
  const [deliveryName, setDeliveryName]       = useState(dv.delivery_name);
  const [deliveryAddress, setDeliveryAddress] = useState(dv.delivery_address ?? "");
  const [deliveryPhone, setDeliveryPhone]     = useState(dv.delivery_phone ?? "");
  const [deliveryEmail, setDeliveryEmail]     = useState(dv.delivery_email ?? "");

  return (
    <form action={updateAdminOrder} className="space-y-5">
      <input type="hidden" name="order_id" value={orderId} />

      {/* ══ お届け先情報 ══ */}
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
            value={deliveryName}
            onChange={(e) => setDeliveryName(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="delivery_address" className="label">お届け先住所</label>
          <input
            id="delivery_address"
            name="delivery_address"
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
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
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="delivery_email" className="label">メールアドレス</label>
            <input
              id="delivery_email"
              name="delivery_email"
              type="email"
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="delivery_date" className="label">お届け希望日</label>
          <input
            id="delivery_date"
            name="delivery_date"
            type="date"
            defaultValue={dv.delivery_date ?? ""}
            className="input"
          />
        </div>
        <div>
          <p className="label">
            希望時間帯
            <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
          </p>
          <DeliveryTimeInput
            defaultStart={dv.delivery_time_start}
            defaultEnd={dv.delivery_time_end}
          />
        </div>
      </section>

      {/* ══ 商品情報 ══ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">商品情報</h2>
        <OrderItemsInput taxRate={taxRate} defaultItems={defaultItems} />
        <div>
          <label htmlFor="purpose" className="label">用途</label>
          <select
            id="purpose"
            name="purpose"
            className="input"
            defaultValue={dv.purpose ?? ""}
          >
            <option value="">選択してください（任意）</option>
            {ORDER_PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ══ メッセージカード ══ */}
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
            defaultValue={dv.message_card ?? ""}
            className="input resize-none"
          />
        </div>
      </section>

      {/* ══ 備考・ご要望 ══ */}
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
            defaultValue={dv.remarks ?? ""}
            className="input resize-none"
          />
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-8">変更を保存する</button>
        <Link href={`/admin/orders/${orderId}`} className="btn-secondary">キャンセル</Link>
      </div>
    </form>
  );
}
