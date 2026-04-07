"use client";

import { useState } from "react";

interface CustomerInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface Props {
  customer: CustomerInfo | null;
}

export function DeliveryInfoInput({ customer }: Props) {
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");

  const isSelf =
    customer !== null &&
    deliveryName === customer.name &&
    deliveryAddress === (customer.address ?? "") &&
    deliveryPhone === (customer.phone ?? "") &&
    deliveryEmail === (customer.email ?? "");

  function applySelf() {
    if (!customer) return;
    if (isSelf) {
      setDeliveryName("");
      setDeliveryAddress("");
      setDeliveryPhone("");
      setDeliveryEmail("");
    } else {
      setDeliveryName(customer.name);
      setDeliveryAddress(customer.address ?? "");
      setDeliveryPhone(customer.phone ?? "");
      setDeliveryEmail(customer.email ?? "");
    }
  }

  return (
    <div className="space-y-4">
      {/* クイック入力ボタン */}
      {customer && (
        <div>
          <p className="text-xs text-gray-500 mb-2">クイック入力</p>
          <button
            type="button"
            onClick={applySelf}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              isSelf
                ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:border-brand-400 hover:bg-brand-50"
            }`}
          >
            <span>{isSelf ? "✓" : "👤"}</span>
            <span>自分に届ける（{customer.name}）</span>
          </button>
        </div>
      )}

      {/* お届け先名 */}
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

      {/* お届け先住所 */}
      <div>
        <label htmlFor="delivery_address" className="label">
          お届け先住所 <span className="text-red-500">*</span>
        </label>
        <input
          id="delivery_address"
          name="delivery_address"
          type="text"
          required
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder="例: 東京都千代田区1-1-1 ○○ビル1F"
          className="input"
        />
      </div>

      {/* 電話番号・メールアドレス（任意） */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="delivery_phone" className="label">
            電話番号
          </label>
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
          <label htmlFor="delivery_email" className="label">
            メールアドレス
          </label>
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
    </div>
  );
}
