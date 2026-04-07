import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_PURPOSES, ORDER_TYPES, ORDER_TYPE_ICONS } from "@/lib/constants";
import { createOrder } from "../actions";
import { DeliveryInfoInput } from "./DeliveryInfoInput";

interface NewOrderPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 顧客情報を取得（クイック入力用）
  const { data: customer } = await supabase
    .from("customers")
    .select("name, address, phone, email")
    .eq("profile_id", user.id)
    .single();

  // 今日の日付（delivery_date の min 値用）
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/customer" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文履歴
        </Link>
        <h1 className="text-xl font-bold text-gray-900">新しい注文をする</h1>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createOrder} className="space-y-6">
        {/* ── 注文種別 ── */}
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            注文種別 <span className="text-red-500">*</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ORDER_TYPES.map((type, i) => (
              <label key={type} className="cursor-pointer">
                <input
                  type="radio"
                  name="order_type"
                  value={type}
                  defaultChecked={i === 1}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 border-gray-200 bg-white text-gray-500 text-sm font-medium transition-all peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700 hover:border-gray-300">
                  <span className="text-xl">{ORDER_TYPE_ICONS[type]}</span>
                  <span>{type}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── お届け先情報 ── */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            お届け先情報
          </h2>

          {/* お届け先名・住所（クイック入力付き） */}
          <DeliveryInfoInput customer={customer} />

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
            <p className="text-xs text-gray-400 mt-1">
              ご希望日の3日前までにご注文ください
            </p>
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
                placeholder="例: スタンド花（2段）、花束、アレンジメント"
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
            <div className="flex gap-2">
              <select
                id="purpose"
                name="purpose"
                className="input flex-1"
                defaultValue=""
              >
                <option value="">選択してください（任意）</option>
                {ORDER_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              リストにない場合は備考欄にご記入ください
            </p>
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
              placeholder={"例: 開店おめでとうございます。\nご多幸をお祈り申し上げます。\n〇〇株式会社 一同"}
              className="input resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              カードに印字する文章をそのままご入力ください
            </p>
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
              placeholder="例: 白系でまとめてください / 午前中の配達希望 / 担当: 鈴木"
              className="input resize-none"
            />
          </div>
        </section>

        {/* ── 確認・送信 ── */}
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm text-brand-800">
          <p className="font-medium mb-1">ご注文前にご確認ください</p>
          <ul className="text-xs space-y-1 text-brand-700 list-disc list-inside">
            <li>注文後は店舗より確認のご連絡をする場合があります</li>
            <li>価格はお問い合わせ・ご確認後にご案内します</li>
            <li>変更・キャンセルはお早めにご連絡ください</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary px-8">
            注文を送信する
          </button>
          <Link href="/customer" className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
