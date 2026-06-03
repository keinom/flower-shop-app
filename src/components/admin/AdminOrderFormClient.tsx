"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import Link from "next/link";
import { ORDER_PURPOSES } from "@/lib/constants";
import { DeliveryTimeInput } from "@/components/ui/DeliveryTimeInput";
import { OrderTypeSelector } from "@/components/ui/OrderTypeSelector";
import { createAdminOrder, type CreateAdminOrderState } from "@/app/admin/orders/new/actions";
import { OrderItemsInput } from "@/components/admin/OrderItemsInput";
import { OrderTotalBar } from "@/components/admin/OrderTotalBar";
import { PostalCodeInput } from "@/components/ui/PostalCodeInput";
import { preventEnterSubmit } from "@/lib/formKeyboard";
import { DeliverySuggestionInput, type DeliverySuggestion } from "@/components/admin/DeliverySuggestionInput";

const INITIAL_STATE: CreateAdminOrderState = {};

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

  // デフォルトは検索モード（既存顧客検索）。サジェストから「新規登録」を選ぶと "new" に切り替わる
  const [mode, setMode] = useState<"new" | "existing">("existing");

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
  const [printDeliveryName, setPrintDeliveryName]   = useState("");

  // ── 注文種別 ──
  const [orderType, setOrderType] = useState<import("@/types").OrderType>("配達");

  // ── 合計金額 ──
  const [itemsTotal, setItemsTotal] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);

  // ── Server Action 状態（エラー時にフォーム入力を保持するため useActionState を使用）──
  const [state, formAction, isPending] = useActionState(createAdminOrder, INITIAL_STATE);

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
    setMode("existing");
    setSearchQuery(customer.name);
    setShowSuggestions(false);
  }

  function switchToNewCustomer() {
    // 検索キーワードを新規顧客名にプリセット
    setNewName(searchQuery.trim());
    setSelectedCustomer(null);
    setMode("new");
    setShowSuggestions(false);
  }

  function clearCustomerSelection() {
    setSelectedCustomer(null);
    setSearchQuery("");
    setMode("existing");
  }

  function backToSearch() {
    setMode("existing");
    setSearchQuery(newName);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewPostalCode("");
    setNewAddress("");
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

  // 過去のお届け先 / 顧客 サジェスト選択時の自動入力
  function handleDeliverySuggestionSelect(s: DeliverySuggestion) {
    if (s.postal_code) setDeliveryPostalCode(s.postal_code);
    if (s.address)     setDeliveryAddress(s.address);
    if (s.phone)       setDeliveryPhone(s.phone);
    if (s.email)       setDeliveryEmail(s.email);
  }

  return (
    <form action={formAction} className="space-y-5" onKeyDown={preventEnterSubmit}>
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {state.error}
        </div>
      )}

      <input type="hidden" name="customer_type" value={mode} />

      {/* ══════════════════════════════════════════
          注文種別
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
          注文種別 <span className="text-red-500">*</span>
        </h2>
        <OrderTypeSelector onChange={setOrderType} />
      </section>

      {/* ══════════════════════════════════════════
          顧客情報
      ══════════════════════════════════════════ */}
      <section className="card p-5 space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-sm font-semibold text-gray-700">
            顧客情報
            {mode === "existing" && selectedCustomer && (
              <span className="ml-2 text-xs font-normal text-gray-400">既存顧客</span>
            )}
            {mode === "new" && (
              <span className="ml-2 text-xs font-normal text-emerald-600">新規顧客</span>
            )}
          </h2>
        </div>

        {/* Server Action に渡す hidden inputs */}
        <input
          type="hidden"
          name="customer_id"
          value={selectedCustomer?.id ?? ""}
        />

        {/* ── 新規顧客フォーム ── */}
        {mode === "new" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <p className="text-xs text-emerald-700 font-medium">
                ✨ 新規顧客として登録します
              </p>
              <button
                type="button"
                onClick={backToSearch}
                className="text-xs text-gray-600 hover:text-gray-900 underline decoration-dotted"
              >
                ← 顧客検索に戻る
              </button>
            </div>
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
              <PostalCodeInput
                id="new_customer_postal_code"
                name="new_customer_postal_code"
                value={newPostalCode}
                onChange={setNewPostalCode}
                onAddressFound={(addr) => setNewAddress(addr)}
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

        {/* ── 顧客検索（既存モード・未選択）── */}
        {mode === "existing" && !selectedCustomer && (
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
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="顧客名・電話番号・メールアドレスで検索 / または新規顧客名を入力"
              className="input"
              autoComplete="off"
            />

            {showSuggestions && (
              <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-72 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      className="px-3 py-2.5 hover:bg-brand-50 cursor-pointer border-b border-gray-50"
                    >
                      <div className="font-medium text-gray-900 text-sm">{c.name}</div>
                      {(c.phone || c.email) && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {[c.phone, c.email].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </li>
                  ))
                ) : (
                  searchQuery.trim() === "" && (
                    <li className="px-3 py-2.5 text-sm text-gray-400">
                      顧客名・電話番号・メールで検索できます
                    </li>
                  )
                )}
                {searchQuery.trim() && (
                  <li
                    onMouseDown={switchToNewCustomer}
                    className="px-3 py-2.5 cursor-pointer bg-emerald-50/40 hover:bg-emerald-50 border-t border-emerald-200"
                  >
                    <div className="text-sm font-medium text-emerald-700">
                      ✨「{searchQuery.trim()}」を新規顧客として登録
                    </div>
                    <div className="text-xs text-emerald-600/80 mt-0.5">
                      連絡先・住所などの追加情報を下に入力できます
                    </div>
                  </li>
                )}
              </ul>
            )}
            <p className="text-xs text-gray-400 mt-2">
              該当する顧客がいなければ、入力したキーワードで新規顧客として登録できます。
            </p>
          </div>
        )}

        {/* ── 選択済み顧客プレビュー ── */}
        {mode === "existing" && selectedCustomer && (
          <div className="bg-brand-50 border border-brand-100 rounded-md p-3 text-sm flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-medium text-brand-800">{selectedCustomer.name}</p>
              <div className="text-xs text-gray-500 space-y-1">
                {selectedCustomer.phone && <p>📞 {selectedCustomer.phone}</p>}
                {selectedCustomer.email && <p>✉ {selectedCustomer.email}</p>}
                {(selectedCustomer.postal_code || selectedCustomer.address) && (
                  <p>📍 {selectedCustomer.postal_code ? `〒${selectedCustomer.postal_code} ` : ""}{selectedCustomer.address}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearCustomerSelection}
              className="text-xs text-gray-500 hover:text-red-600 whitespace-nowrap shrink-0 px-2 py-1 rounded hover:bg-white"
            >
              ✕ 別の顧客を選ぶ
            </button>
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
          <DeliverySuggestionInput
            id="delivery_name"
            name="delivery_name"
            required
            value={deliveryName}
            onChange={setDeliveryName}
            onSelectSuggestion={handleDeliverySuggestionSelect}
          />
        </div>

        <div>
          <label htmlFor="print_delivery_name" className="label">
            印刷用お届け先名 <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
          </label>
          <textarea
            id="print_delivery_name"
            name="print_delivery_name"
            value={printDeliveryName}
            onChange={(e) => setPrintDeliveryName(e.target.value)}
            placeholder="納品書に印字する宛名を上書きする場合のみ入力"
            className="input"
            rows={1}
            style={{ resize: "vertical", minHeight: "2.5rem" }}
          />
          <p className="text-xs text-gray-400 mt-1">
            空欄の場合は上記「お届け先名」がそのまま納品書に印字されます。改行（Enter）で複数行も可。
          </p>
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
                  min={today}
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
            min={today}
            className="input"
          />
        </div>
        {orderType !== "発送" && (
          <div>
            <p className="label">
              希望時間帯
              <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
            </p>
            <DeliveryTimeInput />
          </div>
        )}
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
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-8 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "作成中..." : "注文を作成する"}
        </button>
        <Link href="/admin/orders" className="btn-secondary">キャンセル</Link>
      </div>
    </form>
  );
}
