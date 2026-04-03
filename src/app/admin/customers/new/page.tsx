import Link from "next/link";
import { createCustomer } from "../actions";

interface NewCustomerPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-700">
          ← 顧客一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">顧客を登録</h1>
      </div>

      {params.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form action={createCustomer} className="card p-6 space-y-6">
        {/* 基本情報 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">基本情報</h2>

          <div>
            <label htmlFor="name" className="label">
              顧客名 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="例: 株式会社○○ / 田中 花子"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="label">電話番号</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="例: 03-1234-5678"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="email" className="label">メールアドレス</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="例: info@example.com"
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="label">住所</label>
            <input
              id="address"
              name="address"
              type="text"
              placeholder="例: 東京都千代田区1-1-1"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="notes" className="label">備考</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="例: 毎月1回定期注文あり、担当者: 鈴木様"
              className="input resize-none"
            />
          </div>
        </section>

        {/* ログインアカウント発行 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">
            ログインアカウント
          </h2>
          <p className="text-xs text-gray-500">
            顧客が自分でログインして注文履歴を確認・注文登録できるようにする場合は発行してください。
            後から詳細画面でも発行できます。
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="create_account"
              id="create_account"
              className="w-4 h-4 text-brand-600 rounded"
            />
            <span className="text-sm text-gray-700">今すぐログインアカウントを発行する</span>
          </label>

          {/* JavaScriptなしでも送信はできるが、チェックなしの場合は空で送られるため
              サーバーアクション側で無視される */}
          <div className="space-y-3 pl-6 border-l-2 border-gray-100">
            <div>
              <label htmlFor="account_email" className="label">
                ログイン用メールアドレス
              </label>
              <input
                id="account_email"
                name="account_email"
                type="email"
                placeholder="例: customer@example.com"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="account_password" className="label">
                初期パスワード <span className="text-gray-400 text-xs font-normal">（8文字以上）</span>
              </label>
              <input
                id="account_password"
                name="account_password"
                type="password"
                placeholder="8文字以上で設定"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                初期パスワードは顧客に直接お知らせください
              </p>
            </div>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary">
            登録する
          </button>
          <Link href="/admin/customers" className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
