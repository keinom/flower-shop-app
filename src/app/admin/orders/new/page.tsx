import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ORDER_PURPOSES } from "@/lib/constants";
import { CustomerSelector } from "@/components/admin/CustomerSelector";
import { createAdminOrder } from "./actions";

interface NewAdminOrderPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewAdminOrderPage({ searchParams }: NewAdminOrderPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  // 顧客一覧を取得（名前・連絡先）
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true });

  // 今日の日付
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文を作成</h1>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={createAdminOrder} className="space-y-5">
        {/* ── 顧客選択（Client Component） ── */}
        <CustomerSelector customers={customers ?? []} />

        {/* ── お届け先情報 ── */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            お届け先情報
          </h2>

          <div>
            <label htmlFor="delivery_name" className="label">
              お届け先名 <span className="text-red-500">*</span>
            </label>
            <input
              id="delivery_name"
              name="delivery_name"
              type="text"
              required
              placeholder="例: 株式会社○○ 総務部"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="delivery_address" className="label">
              お届け先住所 <span className="text-red-500">*</span>
            </label>
            <input
              id="delivery_address"
              name="delivery_address"
              type="text"
              required
              placeholder="例: 東京都千代田区1-1-1 ○○ビル1F"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="delivery_date" className="label">
              お届け希望日 <span className="text-red-500">*</span>
            </label>
            <input
              id="delivery_date"
              name="delivery_date"
              type="date"
              required
              min={today}
              className="input"
            />
          </div>
        </section>

        {/* ── 商品情報 ── */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            商品情報
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="product_name" className="label">
                商品名 <span className="text-red-500">*</span>
              </label>
              <input
                id="product_name"
                name="product_name"
                type="text"
                required
                placeholder="例: スタンド花（2段）、花束"
                className="input"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="quantity" className="label">
                数量 <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                required
                min={1}
                defaultValue={1}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="purpose" className="label">用途</label>
            <select
              id="purpose"
              name="purpose"
              className="input"
              defaultValue=""
            >
              <option value="">選択してください（任意）</option>
              {ORDER_PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </section>

        {/* ── メッセージ・備考 ── */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            メッセージ・備考
          </h2>

          <div>
            <label htmlFor="message_card" className="label">
              メッセージカード内容
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

        {/* ── 送信 ── */}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary px-8">
            注文を作成する
          </button>
          <Link href="/admin/orders" className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
