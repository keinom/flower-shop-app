"use client";

import { useState, useEffect, useRef } from "react";

export interface DeliverySuggestion {
  source: "customer" | "destination";
  name: string;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  use_count: number | null;
  last_used: string | null;
  customer_id: string | null;
}

interface Props {
  /** 現在の入力値（textarea content） */
  value: string;
  /** ユーザー入力 / サジェスト選択での変更 */
  onChange: (value: string) => void;
  /** サジェスト選択時、お届け先の他フィールドも自動入力するためのコールバック */
  onSelectSuggestion?: (suggestion: DeliverySuggestion) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
}

/**
 * お届け先名入力 + 過去の顧客・お届け先のサジェスト
 *
 * - 入力中に /api/delivery-suggestions を debounce 付きで叩く
 * - サジェスト候補は「顧客」「お届け先のみ」のバッジで区別
 * - 候補選択で onChange と onSelectSuggestion が呼ばれる
 */
export function DeliverySuggestionInput({
  value, onChange, onSelectSuggestion,
  name = "delivery_name", id = "delivery_name",
  placeholder, required,
}: Props) {
  const [suggestions, setSuggestions] = useState<DeliverySuggestion[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 外クリックで閉じる
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // 検索: 値が変わるたびに debounce で実行
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 検索文字列の先頭行のみで検索（複数行ある時は1行目を検索キーに）
    const firstLine = value.split(/\r?\n/)[0].trim();
    if (firstLine.length < 1) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/delivery-suggestions?q=${encodeURIComponent(firstLine)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const json = (await res.json()) as DeliverySuggestion[];
        setSuggestions(json);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("delivery-suggestions:", e);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function selectSuggestion(s: DeliverySuggestion) {
    onChange(s.name);
    onSelectSuggestion?.(s);
    setShow(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <textarea
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        placeholder={placeholder ?? "例: 株式会社○○ 総務部\n組織で複数行表示したい場合は改行で区切ってください"}
        className="input"
        rows={1}
        style={{ resize: "vertical", minHeight: "2.5rem" }}
        autoComplete="off"
      />
      <p className="text-xs text-gray-400 mt-1">
        組織宛で納品書を複数行表示したい場合は、改行（Enter）で区切れます。 入力すると過去のお届け先・顧客から候補が出ます。
      </p>

      {show && suggestions.length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-72 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={`${s.source}-${s.customer_id ?? s.name}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
              className="px-3 py-2 cursor-pointer hover:bg-brand-50 text-sm border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-gray-900 truncate">{s.name}</div>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                    s.source === "customer"
                      ? "bg-brand-100 text-brand-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s.source === "customer" ? "顧客" : `過去のお届け先 ${s.use_count ? `(${s.use_count}回)` : ""}`}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {s.postal_code && <span className="mr-2">〒{s.postal_code}</span>}
                {s.address && <span>{s.address}</span>}
              </div>
              {(s.phone || s.email) && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {s.phone && <span className="mr-2">📞 {s.phone}</span>}
                  {s.email && <span>✉ {s.email}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {show && !loading && suggestions.length === 0 && value.trim().length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1">
          <li className="px-3 py-2 text-xs text-gray-400">該当するお届け先は見つかりませんでした</li>
        </ul>
      )}
    </div>
  );
}
