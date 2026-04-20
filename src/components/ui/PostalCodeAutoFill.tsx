"use client";

import { useState } from "react";
import { PostalCodeInput } from "@/components/ui/PostalCodeInput";

interface PostalCodeAutoFillProps {
  /** 郵便番号フィールドの name 属性 */
  postalCodeName?: string;
  /** 住所フィールドの name 属性 */
  addressName?: string;
  /** 郵便番号の初期値 */
  defaultPostalCode?: string;
  /** 住所の初期値 */
  defaultAddress?: string;
  /** 住所フィールドの placeholder */
  addressPlaceholder?: string;
}

/**
 * サーバーコンポーネントのフォーム内で使う郵便番号 + 住所セクション
 *
 * name 属性付きの <input> をレンダリングするので、
 * 親の Server Action フォームに値が渡る。
 *
 * 使い方（Server Component の form 内に置くだけ）:
 *   <PostalCodeAutoFill
 *     postalCodeName="postal_code"
 *     addressName="address"
 *   />
 */
export function PostalCodeAutoFill({
  postalCodeName = "postal_code",
  addressName = "address",
  defaultPostalCode = "",
  defaultAddress = "",
  addressPlaceholder = "例: 東京都千代田区1-1-1",
}: PostalCodeAutoFillProps) {
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [address, setAddress] = useState(defaultAddress);

  return (
    <>
      <div>
        <label className="label" htmlFor={postalCodeName}>
          郵便番号
        </label>
        <PostalCodeInput
          name={postalCodeName}
          id={postalCodeName}
          value={postalCode}
          onChange={setPostalCode}
          onAddressFound={(addr) => setAddress(addr)}
        />
      </div>

      <div>
        <label className="label" htmlFor={addressName}>
          住所
        </label>
        <input
          id={addressName}
          name={addressName}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={addressPlaceholder}
          className="input"
        />
      </div>
    </>
  );
}
