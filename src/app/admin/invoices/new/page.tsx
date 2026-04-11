"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoice } from "./actions";

interface Customer {
  id: string;
  name: string;
}

interface EligibleOrder {
  id: string;
  created_at: string;
  delivery_date: string | null;
  product_name: string | null;
  quantity: number;
  total_amount: number | null;
  payment_plan: string | null;
  status: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [invoiceType, setInvoiceType] = useState<"single" | "monthly">("single");
  const [customerId,  setCustomerId]  = useState("");
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [customerQ,   setCustomerQ]   = useState("");
  const [searching,   setSearching]   = useState(false);

  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [loadingOrders,  setLoadingOrders]  = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [targetYearMonth, setTargetYearMonth] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [dueDate,  setDueDate]  = useState("");
  const [remarks,  setRemarks]  = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 顧客検索
  const searchCustomers = async () => {
    if (!customerQ.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerQ)}`);
      if (res.ok) setCustomers(await res.json());
    } finally {
      setSearching(false);
    }
  };

  // 顧客選択後に対象注文を取得
  const selectCustomer = async (id: string, name: string) => {
    setCustomerId(id);
    setCustomerQ(name);
    setCustomers([]);
    setSelectedOrders([]);
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/invoices/eligible-orders?customer_id=${id}&type=${invoiceType}&ym=${targetYearMonth}`);
      if (res.ok) setEligibleOrders(await res.json());
    } finally {
      setLoadingOrders(false);
    }
  };

  // 請求タイプ変更時に再取得
  const handleTypeChange = async (type: "single" | "monthly") => {
    setInvoiceType(type);
    setSelectedOrders([]);
    if (customerId) {
      setLoadingOrders(true);
      try {
        const res = await fetch(`/api/invoices/eligible-orders?customer_id=${customerId}&type=${type}&ym=${targetYearMonth}`);
        if (res.ok) setEligibleOrders(await res.json());
      } finally {
        setLoadingOrders(false);
      }
    }
  };

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!customerId) return setErrorMsg("顧客を選択してください");
    if (selectedOrders.length === 0) return setErrorMsg("請求する注文を1件以上選択してください");

    const fd = new FormData();
    fd.set("customer_id",       customerId);
    fd.set("invoice_type",      invoiceType);
    fd.set("target_year_month", invoiceType === "monthly" ? targetYearMonth : "");
    fd.set("due_date",          dueDate);
    fd.set("remarks",           remarks);
    selectedOrders.forEach((id) => fd.append("order_ids[]", id));

    startTransition(async () => {
      const result = await createInvoice(fd);
      if (result?.error) {
        setErrorMsg(result.error);
      } else if (result?.invoiceId) {
        router.push(`/admin/invoices/${result.invoiceId}?created=1`);
      }
    });
  };

  const subtotal = eligibleOrders
    .filter((o) => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-gray-900">請求書を作成</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 請求タイプ */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">請求タイプ</h2>
          <div className="flex gap-3">
            {([["single", "個別請求", "1注文 → 1請求書"], ["monthly", "月別まとめ請求", "同一顧客の複数注文をまとめて請求"]] as const).map(([val, label, desc]) => (
              <button
                key={val}
                type="button"
                onClick={() => handleTypeChange(val)}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                  invoiceType === val ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <p className={`text-sm font-semibold ${invoiceType === val ? "text-brand-700" : "text-gray-700"}`}>{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
          {invoiceType === "monthly" && (
            <div>
              <label className="label text-xs">対象年月</label>
              <input
                type="month"
                value={targetYearMonth}
                onChange={(e) => setTargetYearMonth(e.target.value)}
                className="input w-40"
              />
            </div>
          )}
        </div>

        {/* 顧客選択 */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">顧客 <span className="text-red-500">*</span></h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={customerQ}
              onChange={(e) => { setCustomerQ(e.target.value); setCustomerId(""); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchCustomers())}
              placeholder="顧客名で検索..."
              className="input flex-1"
            />
            <button
              type="button"
              onClick={searchCustomers}
              disabled={searching}
              className="btn-secondary text-sm"
            >
              {searching ? "検索中..." : "検索"}
            </button>
          </div>
          {customers.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCustomer(c.id, c.name)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {customerId && (
            <p className="text-xs text-emerald-600 font-medium">✓ {customerQ} を選択中</p>
          )}
        </div>

        {/* 対象注文 */}
        {customerId && (
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">請求する注文 <span className="text-red-500">*</span></h2>

            {loadingOrders ? (
              <p className="text-sm text-gray-400">注文を読み込み中...</p>
            ) : eligibleOrders.length === 0 ? (
              <p className="text-sm text-gray-400">
                対象の注文がありません。（代未・振込予定の注文を確認してください）
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">{eligibleOrders.length}件の対象注文</p>
                  <button
                    type="button"
                    onClick={() => setSelectedOrders(
                      selectedOrders.length === eligibleOrders.length
                        ? []
                        : eligibleOrders.map((o) => o.id)
                    )}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {selectedOrders.length === eligibleOrders.length ? "すべて解除" : "すべて選択"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {eligibleOrders.map((order) => {
                    const checked = selectedOrders.includes(order.id);
                    return (
                      <label
                        key={order.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          checked ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOrder(order.id)}
                          className="w-4 h-4 accent-brand-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {order.product_name ?? "商品"}
                          </p>
                          <p className="text-xs text-gray-500">
                            注文日: {new Date(order.created_at).toLocaleDateString("ja-JP")}
                            {order.delivery_date && (
                              <span className="ml-2">
                                お届け: {new Date(order.delivery_date).toLocaleDateString("ja-JP")}
                              </span>
                            )}
                            {order.payment_plan && (
                              <span className="ml-2 text-amber-600">【{order.payment_plan}】</span>
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-gray-800 flex-shrink-0">
                          ¥{(order.total_amount ?? 0).toLocaleString("ja-JP")}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedOrders.length > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-gray-600">{selectedOrders.length}件選択</span>
                    <span className="text-base font-bold text-brand-700">
                      合計 ¥{subtotal.toLocaleString("ja-JP")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 支払期限・備考 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">その他</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">支払期限（任意）</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">備考（任意）</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="振込先案内など"
              className="input"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-ghost">
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isPending || !customerId || selectedOrders.length === 0}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "作成中..." : "請求書を作成する"}
          </button>
        </div>
      </form>
    </div>
  );
}
