"use client";

import { useState } from "react";
import Link from "next/link";
import { ORDER_PURPOSES } from "@/lib/constants";
import { DeliveryTimeInput } from "@/components/ui/DeliveryTimeInput";
import { OrderTypeSelector } from "@/components/ui/OrderTypeSelector";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { ShippingFeeSelector } from "@/components/admin/ShippingFeeSelector";
import { OrderTotalBar } from "@/components/admin/OrderTotalBar";
import { updateAdminOrder } from "@/app/admin/orders/[id]/edit/actions";
import type { OrderType } from "@/types";
import { PostalCodeInput } from "@/components/ui/PostalCodeInput";

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
    order_type: OrderType;
    delivery_name: string;
    delivery_postal_code: string | null;
    delivery_address: string | null;
    delivery_date: string | null;
    delivery_time_start: string | null;
    delivery_time_end: string | null;
    delivery_phone: string | null;
    delivery_email: string | null;
    purpose: string | null;
    message_card: string | null;
    remarks: string | null;
    shipping_date: string | null;
    shipping_deadline: string | null;
  };
  defaultItems: OrderItem[];
  defaultShipping?: { carrier: string; size: number; feeTaxInc: number };
}

export function AdminOrderEditClient({
  orderId,
  taxRate,
  today,
  defaultValues: dv,
  defaultItems,
  defaultShipping,
}: Props) {
  const [orderType, setOrderType] = useState<OrderType>(dv.order_type);
  const [deliveryName, setDeliveryName]             = useState(dv.delivery_name);
  const [deliveryPostalCode, setDeliveryPostalCode] = useState(dv.delivery_postal_code ?? "");
  const [deliveryAddress, setDeliveryAddress]       = useState(dv.delivery_address ?? "");
  const [deliveryPhone, setDeliveryPhone]           = useState(dv.delivery_phone ?? "");
  const [deliveryEmail, setDeliveryEmail]           = useState(dv.delivery_email ?? "");

  // ── 合計金額 ──
  const [itemsTotal, setItemsTotal] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);

  return (
    <form action={updateAdminOrder} className="space-y-5">
      <input type="hidden" name="order_id" value={orderId} />

      {/* ══ 注文種別 ══ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          注文種別 <span className="text-red-500">*</span>
        </h2>
        <OrderTypeSelector defaultValue={dv.order_type} onChange={setOrderType} />
      </section>

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
          <label htmlFor="delivery_postal_code" className="label">郵便番号</label>
          <PostalCodeInput
            id="delivery_postal_code"
            name="delivery_postal_code"
            value={deliveryPostalCode}
            onChange={setDeliveryPostalCode}
            onAddressFound={(addr) => setDeliveryAddress(addr)}
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
            placeholder="例: 東京都千代田区1-1-1 ○○ビル1F"
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* 発送注文: 発送日・締め切り時刻 */}
        {orderType === "発送" && (
          <div className="border border-violet-200 rounded-lg p-4 bg-violet-50 space-y-3">
            <p className="text-sm font-semibold text-violet-800">📦 発送管理</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="shipping_date" className="label">
                  発送日
                  <span className="text-gray-500 text-xs font-normal ml-1">（日報で管理する日付）</span>
                </label>
                <input
                  id="shipping_date"
                  name="shipping_date"
                  type="date"
                  defaultValue={dv.shipping_date ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="shipping_deadline" className="label">
                  発送締め切り時刻
                  <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
                </label>
                <input
                  id="shipping_deadline"
                  name="shipping_deadline"
                  type="time"
                  defaultValue={dv.shipping_deadline?.slice(0, 5) ?? ""}
                  className="input"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="delivery_date" className="label">
            {orderType === "発送" ? "到着日（お届け希望日）" : "お届け希望日"}
          </label>
          <input
            id="delivery_date"
            name="delivery_date"
            type="date"
            defaultValue={dv.delivery_date ?? ""}
            className="input"
          />
        </div>
        {orderType !== "発送" && (
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
        )}
      </section>

      {/* ══ 商品情報 ══ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">商品情報</h2>
        <OrderItemsInput taxRate={taxRate} defaultItems={defaultItems} onTotalChange={setItemsTotal} />
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

      {/* ══ 配送料 ══ */}
      <ShippingFeeSelector
        deliveryAddress={deliveryAddress}
        onFeeChange={setShippingFee}
        defaultShipping={defaultShipping as any}
      />

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

      {/* ── 合計バー ── */}
      <OrderTotalBar itemsTotal={itemsTotal} shippingFee={shippingFee} />

      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-8">変更を保存する</button>
        <Link href={`/admin/orders/${orderId}`} className="btn-secondary">キャンセル</Link>
      </div>
    </form>
  );
}
