"use client";

import { useEffect, useRef } from "react";
import { DUPLICATE_FIELD_LABELS, type DuplicateCustomer } from "@/lib/customerDuplicates";
import { oneLineName } from "@/lib/name";

interface Props {
  duplicates: DuplicateCustomer[];
  /** 送信処理中（ボタンを無効化する） */
  pending: boolean;
  /** 「それでも登録する」 */
  onProceed: () => void;
  proceedLabel?: string;
  /** 既存顧客への切り替え（注文登録画面のみ）。指定すると各行に切り替えボタンを出す */
  onUseExisting?: (customer: DuplicateCustomer) => void;
}

/**
 * 顧客新規登録時の重複警告（顧客登録画面・注文登録画面の新規顧客で共通）。
 * 登録を禁止せず「確認する」ための表示。一致した既存顧客の一覧と詳細へのリンク（別タブ）を出す。
 */
export function DuplicateCustomerWarning({
  duplicates,
  pending,
  onProceed,
  proceedLabel = "それでも登録する",
  onUseExisting,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // 警告が出たら画面内に入れる（送信ボタンは長いフォームの末尾にあるため）
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [duplicates]);

  return (
    <div
      ref={ref}
      role="alert"
      data-testid="duplicate-warning"
      className="p-4 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-900 space-y-3"
    >
      <p className="font-semibold">
        ⚠ 同じ（または似た）顧客がすでに登録されています。まだ登録していません。
      </p>
      <p className="text-xs text-amber-800">
        下の既存顧客と同じ方でないかご確認ください。別の方（同名の別人など）であれば「{proceedLabel}」を押してください。
      </p>
      <ul className="space-y-2">
        {duplicates.map((d) => (
          <li key={d.id} className="bg-white border border-amber-200 rounded p-2.5 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 break-words">{oneLineName(d.name)}</p>
                <p className="text-xs text-gray-500">
                  一致:{" "}
                  {d.matched.map((m) => (
                    <span
                      key={m}
                      className="inline-block mr-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium"
                    >
                      {DUPLICATE_FIELD_LABELS[m]}
                    </span>
                  ))}
                </p>
              </div>
              <a
                href={`/admin/customers/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline whitespace-nowrap shrink-0"
              >
                詳細を開く ↗
              </a>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <p>電話: {d.phone || "―"}</p>
              <p>
                住所: {d.postal_code ? `〒${d.postal_code} ` : ""}
                {d.address || "―"}
              </p>
              <p>注文件数: {d.orderCount} 件</p>
            </div>
            {onUseExisting && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onUseExisting(d)}
                className="mt-1 text-xs font-medium border border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded px-2.5 py-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                この顧客で注文する
              </button>
            )}
          </li>
        ))}
      </ul>
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={onProceed}
          className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "登録中..." : proceedLabel}
        </button>
      </div>
    </div>
  );
}
