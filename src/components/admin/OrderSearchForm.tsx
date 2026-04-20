"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_PURPOSES } from "@/lib/constants";

export function OrderSearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  // フォームの現在値をURLに反映
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const sp = new URLSearchParams();
      sp.set("searched", "1"); // 検索実行済みフラグ
      for (const [key, value] of fd.entries()) {
        const v = String(value).trim();
        if (v) sp.set(key, v);
      }
      router.push(`/admin/orders?${sp.toString()}`);
    },
    [router]
  );

  // リセット
  const handleReset = useCallback(() => {
    formRef.current?.reset();
    router.push("/admin/orders");
  }, [router]);

  // 現在のパラメータをデフォルト値として取得
  const get = (key: string) => params.get(key) ?? "";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="card px-5 py-5 space-y-5"
    >
      {/* ─── 行1: キーワード ＋ 顧客名 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label" htmlFor="q">
            キーワード
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={get("q")}
            placeholder="商品名・配達先名・住所で検索"
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="customer_name">
            顧客名
          </label>
          <input
            id="customer_name"
            name="customer_name"
            type="text"
            defaultValue={get("customer_name")}
            placeholder="顧客名で検索"
            className="input"
          />
        </div>
      </div>

      {/* ─── 行2: ステータス ＋ 種別 ＋ 用途 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="label" htmlFor="status">
            ステータス
          </label>
          <select
            id="status"
            name="status"
            defaultValue={get("status")}
            className="input"
          >
            <option value="">すべて</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="order_type">
            注文種別
          </label>
          <select
            id="order_type"
            name="order_type"
            defaultValue={get("order_type")}
            className="input"
          >
            <option value="">すべて</option>
            {ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="purpose">
            用途
          </label>
          <select
            id="purpose"
            name="purpose"
            defaultValue={get("purpose")}
            className="input"
          >
            <option value="">すべて</option>
            {ORDER_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── 行3: お届け日 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label">お届け日（From〜To）</label>
          <div className="flex items-center gap-2">
            <input
              name="delivery_from"
              type="date"
              defaultValue={get("delivery_from")}
              className="input flex-1"
            />
            <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
            <input
              name="delivery_to"
              type="date"
              defaultValue={get("delivery_to")}
              className="input flex-1"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="label">注文日（From〜To）</label>
          <div className="flex items-center gap-2">
            <input
              name="created_from"
              type="date"
              defaultValue={get("created_from")}
              className="input flex-1"
            />
            <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
            <input
              name="created_to"
              type="date"
              defaultValue={get("created_to")}
              className="input flex-1"
            />
          </div>
        </div>
      </div>

      {/* ─── 行4: 合計金額 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label">合計金額（From〜To）</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
              <span className="px-2.5 text-gray-400 text-sm bg-gray-50 border-r border-gray-300 self-stretch flex items-center select-none">¥</span>
              <input
                name="amount_min"
                type="number"
                min={0}
                step={100}
                defaultValue={get("amount_min")}
                placeholder="下限なし"
                className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              />
            </div>
            <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
            <div className="flex items-center flex-1 border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
              <span className="px-2.5 text-gray-400 text-sm bg-gray-50 border-r border-gray-300 self-stretch flex items-center select-none">¥</span>
              <input
                name="amount_max"
                type="number"
                min={0}
                step={100}
                defaultValue={get("amount_max")}
                placeholder="上限なし"
                className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── ボタン ─── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="btn-ghost text-sm"
        >
          条件をリセット
        </button>
        <button type="submit" className="btn-primary">
          🔍 検索する
        </button>
      </div>
    </form>
  );
}
