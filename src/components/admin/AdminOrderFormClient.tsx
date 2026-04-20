"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ORDER_PURPOSES } from "@/lib/constants";
import { DeliveryTimeInput } from "@/components/ui/DeliveryTimeInput";
import { OrderTypeSelector } from "@/components/ui/OrderTypeSelector";
import { createAdminOrder } from "@/app/admin/orders/new/actions";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { OrderTotalBar } from "@/components/admin/OrderTotalBar";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  address: string | null;
}

interface Props {
  customers: Customer[];
  today: string;
  taxRate: number;
  presetCustomerId?: string;
}

export function AdminOrderFormClient({ customers, today, taxRate, presetCustomerId }: Props) {
  // ── 顧客モード ──
  const preset = presetCustomerId
    ? (customers.find((c) => c.id === presetCustomerId) ?? null)
    : null;

  const [mode, setMode] = useState<"new" | "existing">(preset ? "existing" : "new");

  // ── 新規顧客フィールド（反映ボタン用にcontrolled）──
  const [newName, setNewName]             = useState("");
  const [newPhone, setNewPhone]           = useState("");
  const [newEmail, setNewEmail]           = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newAddress, setNewAddress]       = useState("");

  // ── 既存顧客検索 ──
  const [searchQuery, setSearchQuery]           = useState(preset?.name ?? "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(preset);
  const [showSuggestions, setShowSuggestions]   = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── お届け先フィールド（controlledで反映ボタンに対応）──
  const [deliveryName, setDeliveryName]             = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryAddress, setDeliveryAddress]       = useState("");
  const [deliveryPhone, setDeliveryPhone]           = useState("");
  const [deliveryEmail, setDeliveryEmail]           = useState("");

  // ── 合計金額 ──
  const [itemsTotal, setItemsTotal] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);

  // サジェスト外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 顧客リストのフィルタリング
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name);
    setShowSuggestions(false);
  }

  function handleModeSwitch() {
    if (mode === "new") {
      setMode("existing");
    } else {
      setMode("new");
      setSelectedCustomer(null);
      setSearchQuery("");
    }
  }

  // お届け先情報に顧客情報を反映
  function reflectCustomerInfo() {
    if (mode === "existing" && selectedCustomer) {
      setDeliveryName(selectedCustomer.name);
      setDeliveryPostalCode(selectedCustomer.postal_code ?? "");
      setDeliveryAddress(selectedCustomer.address ?? "");
      setDeliveryPhone(selectedCustomer.phone ?? "");
      setDeliveryEmail(selectedCustomer.email ?? "");
    } else if (mode === "new") {
      setDeliveryName(newName);
      setDeliveryPostalCode(newPostalCode);
      setDeliveryAddress(newAddress);
      setDeliveryPhone(newPhone);
      setDeliveryEmail(newEmail);
    }
  }

  const canReflect =
    (mode === "existing" && selectedCustomer !== null) ||
    (mode === "new" && newName.trim() !== "");

  return (
    <form action={createAdminOrder} className="space-y-5">
      <input type="hidden" name="customer_type" value={mode} />

      {/* ══════════════════════════════════════════
          注文種別
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          注文種別 <span className="text-red-500">*</span>
        </h2>
        <OrderTypeSelector />
      </section>

      {/* ══════════════════════════════════════════
          顧客情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            顧客情報
            <span className="ml-2 text-xs font-normal text-gray-400">
              {mode === "new" ? "新規顧客" : "既存顧客"}
            </span>
          </h2>
          <button
            type="button"
            onClick={handleModeSwitch}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 rounded px-2.5 py-1 bg-brand-50 hover:bg-brand-100 transition-colors"
          >
            {mode === "new" ? "既存の顧客から選択する →" : "← 新規顧客を作成する"}
          </button>
        </div>

        {/* ── 新規顧客フォーム ── */}
        {mode === "new" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              注文と同時に顧客を新規登録します。ログインアカウントは後から発行できます。
            </p>
            <div>
              <label className="label" htmlFor="new_customer_name">
                顧客名 <span className="text-red-500">*</span>
              </label>
              <input
                id="new_customer_name"
                name="new_customer_name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：株式会社〇〇"
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="new_customer_phone">電話番号</label>
                <input
                  id="new_customer_phone"
                  name="new_customer_phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="03-0000-0000"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="new_customer_email">メールアドレス</label>
                <input
                  id="new_customer_email"
                  name="new_customer_email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="new_customer_postal_code">郵便番号</label>
              <input
                id="new_customer_postal_code"
                name="new_customer_postal_code"
                type="text"
                value={newPostalCode}
                onChange={(e) => setNewPostalCode(e.target.value)}
                placeholder="123-4567"
                className="input"
                maxLength={8}
              />
            </div>
            <div>
              <label className="label" htmlFor="new_customer_address">住所</label>
              <input
                id="new_customer_address"
                name="new_customer_address"
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="東京都〇〇区1-1-1"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="new_customer_notes">備考</label>
              <input
                id="new_customer_notes"
                name="new_customer_notes"
                type="text"
                placeholder="担当者名、特記事項など"
                className="input"
              />
            </div>
          </div>
        )}

        {/* ── 既存顧客検索 ── */}
        {mode === "existing" && (
          <div className="space-y-3">
            {customers.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                登録済みの顧客がいません。「新規顧客を作成する」からご登録ください。
              </p>
            ) : (
              <>
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
                  {/* Server Actionに渡すhidden input */}
                  <input
                    type="hidden"
                    name="customer_id"
                    value={selectedCustomer?.id ?? ""}
                  />

                  {/* サジェストドロップダウン */}
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
                            <div className="font-medium text-gray-900 text-sm">{c.name}</div>
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
                </div>

                {/* 選択済み顧客プレビュー */}
                {selectedCustomer && (
                  <div className="bg-brand-50 border border-brand-100 rounded-md p-3 text-sm space-y-1.5">
                    <p className="font-medium text-brand-800">{selectedCustomer.name}</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      {selectedCustomer.phone && <p>📞 {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p>✉ {selectedCustomer.email}</p>}
                      {(selectedCustomer.postal_code || selectedCustomer.address) && (
                        <p>📍 {selectedCustomer.postal_code ? `〒${selectedCustomer.postal_code} ` : ""}{selectedCustomer.address}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          お届け先情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-semibold text-gray-700">お届け先情報</h2>
          <button
            type="button"
            onClick={reflectCustomerInfo}
            disabled={!canReflect}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 rounded px-2.5 py-1 bg-brand-50 hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            顧客情報をそのまま反映
          </button>
        </div>

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
            placeholder="例: 株式会社○○ 総務部"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="delivery_postal_code" className="label">郵便番号</label>
          <input
            id="delivery_postal_code"
            name="delivery_postal_code"
            type="text"
            value={deliveryPostalCode}
            onChange={(e) => setDeliveryPostalCode(e.target.value)}
            placeholder="例: 123-4567"
            className="input"
            maxLength={8}
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
              placeholder="03-0000-0000"
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
              placeholder="example@example.com"
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
            min={today}
            className="input"
          />
        </div>
        <div>
          <p className="label">
            希望時間帯
            <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
          </p>
          <DeliveryTimeInput />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          商品情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">商品情報</h2>
        <OrderItemsInput taxRate={taxRate} onTotalChange={setItemsTotal} />
        <div>
          <label htmlFor="purpose" className="label">用途</label>
          <select id="purpose" name="purpose" className="input" defaultValue="">
            <option value="">選択してください（任意）</option>
            {ORDER_PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          メッセージカード
      ══════════════════════════════════════════ */}
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
            placeholder={"例: 開店おめでとうございます。\nご多幸をお祈り申し上げます。"}
            className="input resize-none"
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          備考・ご要望
      ══════════════════════════════════════════ */}
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
            placeholder="例: 白系でまとめてください / 午前中配達希望"
            className="input resize-none"
          />
        </div>
      </section>

      {/* ── 合計バー ── */}
      <OrderTotalBar itemsTotal={itemsTotal} shippingFee={shippingFee} />

      {/* ── 送信 ── */}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-8">注文を作成する</button>
        <Link href="/admin/orders" className="btn-secondary">キャンセル</Link>
      </div>
    </form>
  );
}
