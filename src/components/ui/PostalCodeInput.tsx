"use client";

import { useState } from "react";
import { lookupAddressByPostalCode } from "@/lib/postalCode";

interface PostalCodeInputProps {
  /** input の name 属性 */
  name?: string;
  /** input の id 属性 */
  id?: string;
  /** 現在の値（controlled） */
  value: string;
  /** 値変更コールバック */
  onChange: (value: string) => void;
  /** 住所が見つかったときに呼ばれるコールバック */
  onAddressFound: (address: string) => void;
  placeholder?: string;
}

/**
 * 郵便番号入力 + 「住所を検索」ボタン
 *
 * 使い方:
 *   <PostalCodeInput
 *     name="postal_code"
 *     value={postalCode}
 *     onChange={setPostalCode}
 *     onAddressFound={(addr) => setAddress(addr)}
 *   />
 */
export function PostalCodeInput({
  name = "postal_code",
  id,
  value,
  onChange,
  onAddressFound,
  placeholder = "例: 123-4567",
}: PostalCodeInputProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 7桁（数字のみ）が揃っているときだけボタン有効
  const digits = value.replace(/[^0-9]/g, "");
  const canLookup = digits.length === 7;

  async function handleLookup() {
    setErrorMsg(null);
    setLoading(true);
    const address = await lookupAddressByPostalCode(value);
    setLoading(false);

    if (address) {
      onAddressFound(address);
    } else {
      setErrorMsg("住所が見つかりませんでした。郵便番号を確認してください。");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setErrorMsg(null);
          }}
          placeholder={placeholder}
          className="input"
          maxLength={8}
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={!canLookup || loading}
          className="shrink-0 text-xs font-medium px-3 py-2 rounded-md border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "検索中…" : "住所を検索"}
        </button>
      </div>
      {errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
