"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { RecurrenceRuleInput } from "@/components/admin/RecurrenceRuleInput";
import { OrderTypeSelector } from "@/components/ui/OrderTypeSelector";
import { DeliveryTimeInput } from "@/components/ui/DeliveryTimeInput";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { updateRecurringTemplate } from "./actions";
import { ORDER_PURPOSES } from "@/lib/constants";
import type { OrderType } from "@/types";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface TemplateItem {
  id: string;
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  sort_order: number;
}

interface Props {
  templateId: string;
  customers: Customer[];
  taxRate: number;
  // pre-populated values
  defaultTitle: string;
  defaultCustomer: Customer | null;
  defaultRecurrenceType: "weekly" | "monthly_date" | "monthly_weekday" | "interval";
  defaultWeeklyDays: number[] | null;
  defaultMonthlyDay: number | null;
  defaultMonthlyWeek: number | null;
  defaultMonthlyWeekday: number | null;
  defaultIntervalDays: number | null;
  defaultStartDate: string;
  defaultEndDate: string | null;
  defaultOrderType: OrderType;
  defaultDeliveryName: string;
  defaultDeliveryAddress: string | null;
  defaultDeliveryPhone: string | null;
  defaultDeliveryEmail: string | null;
  defaultDeliveryTimeStart: string | null;
  defaultDeliveryTimeEnd: string | null;
  defaultPurpose: string | null;
  defaultMessageCard: string | null;
  defaultRemarks: string | null;
  defaultItems: TemplateItem[];
}

export function RecurringTemplateEditFormClient({
  templateId,
  customers,
  taxRate,
  defaultTitle,
  defaultCustomer,
  defaultRecurrenceType,
  defaultWeeklyDays,
  defaultMonthlyDay,
  defaultMonthlyWeek,
  defaultMonthlyWeekday,
  defaultIntervalDays,
  defaultStartDate,
  defaultEndDate,
  defaultOrderType,
  defaultDeliveryName,
  defaultDeliveryAddress,
  defaultDeliveryPhone,
  defaultDeliveryEmail,
  defaultDeliveryTimeStart,
  defaultDeliveryTimeEnd,
  defaultPurpose,
  defaultMessageCard,
  defaultRemarks,
  defaultItems,
}: Props) {
  const [searchQuery, setSearchQuery] = useState(defaultCustomer?.name ?? "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(defaultCustomer);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = customers
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name);
    setShowSuggestions(false);
  }

  return (
    <form action={updateRecurringTemplate} className="space-y-5">
      {/* hidden template id */}
      <input type="hidden" name="template_id" value={templateId} />

      {/* ══════════════════════════════════════════
          管理名称
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          管理名称 <span className="text-red-500">*</span>
        </h2>
        <div>
          <label htmlFor="title" className="label">
            テンプレート名
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={defaultTitle}
            placeholder="例: 株式会社〇〇 毎週月曜配達"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            管理用の名前です。顧客には表示されません。
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          繰り返し設定
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          繰り返し設定 <span className="text-red-500">*</span>
        </h2>
        <RecurrenceRuleInput
          defaultStartDate={defaultStartDate}
          defaultType={defaultRecurrenceType}
          defaultWeeklyDays={defaultWeeklyDays ?? [1]}
          defaultMonthlyDay={defaultMonthlyDay ?? 1}
          defaultMonthlyWeek={defaultMonthlyWeek ?? 1}
          defaultMonthlyWeekday={defaultMonthlyWeekday ?? 1}
          defaultIntervalDays={defaultIntervalDays ?? 7}
          defaultEndDate={defaultEndDate}
        />
      </section>

      {/* ══════════════════════════════════════════
          顧客情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          顧客情報 <span className="text-red-500">*</span>
        </h2>
        {customers.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">
            登録済みの顧客がいません。
            <Link
              href="/admin/customers"
              className="text-brand-600 hover:underline ml-1"
            >
              顧客を登録する
            </Link>
          </p>
        ) : (
          <div ref={searchContainerRef} className="relative">
            <label className="label" htmlFor="customer_search">
              顧客を検索 <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value) setSelectedCustomer(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="顧客名・電話番号・メールアドレスで検索"
              className="input"
              autoComplete="off"
            />
            <input
              type="hidden"
              name="customer_id"
              value={selectedCustomer?.id ?? ""}
            />

            {showSuggestions && (
              <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-56 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-gray-400">
                    該当する顧客が見つかりません
                  </li>
                ) : (
                  filteredCustomers.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      className="px-3 py-2.5 hover:bg-brand-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {c.name}
                      </div>
                      {(c.phone || c.email) && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {[c.phone, c.email].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}

            {selectedCustomer && (
              <div className="mt-3 bg-brand-50 border border-brand-100 rounded-md p-3 text-sm space-y-1.5">
                <p className="font-medium text-brand-800">
                  {selectedCustomer.name}
                </p>
                <div className="text-xs text-gray-500 space-y-1">
                  {selectedCustomer.phone && (
                    <p>📞 {selectedCustomer.phone}</p>
                  )}
                  {selectedCustomer.email && (
                    <p>✉ {selectedCustomer.email}</p>
                  )}
                  {selectedCustomer.address && (
                    <p>📍 {selectedCustomer.address}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          注文種別
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          注文種別 <span className="text-red-500">*</span>
        </h2>
        <OrderTypeSelector defaultValue={defaultOrderType} />
      </section>

      {/* ══════════════════════════════════════════
          お届け先情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          お届け先情報
        </h2>
        <p className="text-xs text-gray-500">
          お届け日は繰り返し設定から自動生成されます。
        </p>

        <div>
          <label htmlFor="delivery_name" className="label">
            お届け先名 <span className="text-red-500">*</span>
          </label>
          <input
            id="delivery_name"
            name="delivery_name"
            type="text"
            required
            defaultValue={defaultDeliveryName}
            placeholder="例: 株式会社○○ 総務部"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="delivery_address" className="label">
            お届け先住所
          </label>
          <input
            id="delivery_address"
            name="delivery_address"
            type="text"
            defaultValue={defaultDeliveryAddress ?? ""}
            placeholder="例: 東京都千代田区1-1-1 ○○ビル1F"
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="delivery_phone" className="label">
              電話番号
            </label>
            <input
              id="delivery_phone"
              name="delivery_phone"
              type="tel"
              defaultValue={defaultDeliveryPhone ?? ""}
              placeholder="03-0000-0000"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="delivery_email" className="label">
              メールアドレス
            </label>
            <input
              id="delivery_email"
              name="delivery_email"
              type="email"
              defaultValue={defaultDeliveryEmail ?? ""}
              placeholder="example@example.com"
              className="input"
            />
          </div>
        </div>

        <div>
          <p className="label">
            希望時間帯
            <span className="text-gray-400 text-xs font-normal ml-1">
              （任意）
            </span>
          </p>
          <DeliveryTimeInput
            defaultStart={defaultDeliveryTimeStart}
            defaultEnd={defaultDeliveryTimeEnd}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          商品情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          商品情報
        </h2>
        <OrderItemsInput
          taxRate={taxRate}
          defaultItems={defaultItems.map((item) => ({
            product_name: item.product_name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))}
        />
        <div>
          <label htmlFor="purpose" className="label">
            用途
          </label>
          <select
            id="purpose"
            name="purpose"
            className="input"
            defaultValue={defaultPurpose ?? ""}
          >
            <option value="">選択してください（任意）</option>
            {ORDER_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          メッセージ・備考
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          メッセージ・備考
        </h2>
        <div>
          <label htmlFor="message_card" className="label">
            メッセージカード内容
            <span className="text-gray-400 text-xs font-normal ml-1">
              （任意）
            </span>
          </label>
          <textarea
            id="message_card"
            name="message_card"
            rows={3}
            defaultValue={defaultMessageCard ?? ""}
            placeholder="例: いつもありがとうございます。"
            className="input resize-none"
          />
        </div>
        <div>
          <label htmlFor="remarks" className="label">
            備考・ご要望
            <span className="text-gray-400 text-xs font-normal ml-1">
              （任意）
            </span>
          </label>
          <textarea
            id="remarks"
            name="remarks"
            rows={3}
            defaultValue={defaultRemarks ?? ""}
            placeholder="例: 白系でまとめてください / 午前中配達希望"
            className="input resize-none"
          />
        </div>
      </section>

      {/* ── 送信 ── */}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-8">
          テンプレートを更新する
        </button>
        <Link
          href={`/admin/recurring/${templateId}`}
          className="btn-secondary"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
