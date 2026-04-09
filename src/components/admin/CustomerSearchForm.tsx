"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

export function CustomerSearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const sp = new URLSearchParams();
      for (const [key, value] of fd.entries()) {
        const v = String(value).trim();
        if (v) sp.set(key, v);
      }
      router.push(`/admin/customers?${sp.toString()}`);
    },
    [router]
  );

  const handleReset = useCallback(() => {
    formRef.current?.reset();
    router.push("/admin/customers");
  }, [router]);

  const get = (key: string) => params.get(key) ?? "";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="card px-5 py-5 space-y-5"
    >
      {/* ─── 行1: キーワード ─── */}
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
            placeholder="顧客名・メール・電話番号・住所で検索"
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="has_account">
            ログインアカウント
          </label>
          <select
            id="has_account"
            name="has_account"
            defaultValue={get("has_account")}
            className="input"
          >
            <option value="">すべて</option>
            <option value="issued">発行済み</option>
            <option value="none">未発行</option>
          </select>
        </div>
      </div>

      {/* ─── 行2: 登録日 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label">登録日（From〜To）</label>
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
