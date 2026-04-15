"use client";

import { useState } from "react";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface CustomerSelectorProps {
  customers: Customer[];
}

export function CustomerSelector({ customers }: CustomerSelectorProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    customers.length > 0 ? customers[0] : null
  );

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const found = customers.find((c) => c.id === e.target.value) ?? null;
    setSelectedCustomer(found);
  }

  return (
    <section className="card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">顧客情報</h2>

      {/* 切り替えタブ */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === "existing"
              ? "bg-brand-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          既存の顧客
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
            mode === "new"
              ? "bg-brand-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          新規顧客を作成
        </button>
      </div>

      {/* hidden: どちらのモードか送信 */}
      <input type="hidden" name="customer_type" value={mode} />

      {/* ── 既存顧客モード ── */}
      {mode === "existing" && (
        <div className="space-y-3">
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">
              登録済みの顧客がいません。「新規顧客を作成」から追加してください。
            </p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="customer_id">
                  顧客を選択 <span className="text-red-500">*</span>
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  className="input"
                  value={selectedCustomer?.id ?? ""}
                  onChange={handleSelectChange}
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? `（${c.phone}）` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 選択中の顧客情報プレビュー */}
              {selectedCustomer && (
                <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">電話番号</span>
                    <span className="text-gray-800">{selectedCustomer.phone ?? "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">メール</span>
                    <span className="text-gray-800">{selectedCustomer.email ?? "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">住所</span>
                    <span className="text-gray-800">{selectedCustomer.address ?? "—"}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 新規顧客モード ── */}
      {mode === "new" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            新しい顧客を作成して注文に紐付けます。ログインアカウントは後から発行できます。
          </p>
          <div>
            <label className="label" htmlFor="new_customer_name">
              顧客名 <span className="text-red-500">*</span>
            </label>
            <input
              id="new_customer_name"
              name="new_customer_name"
              type="text"
              required={mode === "new"}
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
                placeholder="example@example.com"
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="new_customer_address">住所</label>
            <input
              id="new_customer_address"
              name="new_customer_address"
              type="text"
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
    </section>
  );
}
