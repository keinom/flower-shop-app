import { login } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-green-100">
      <div className="w-full max-w-md px-4">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-600 text-white text-2xl mb-4">
            🌸
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            花長注文管理システム
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ログインしてご利用ください
          </p>
        </div>

        {/* ログインフォーム */}
        <div className="card p-8">
          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{decodeURIComponent(errorMessage)}</p>
            </div>
          )}

          <form action={login} className="space-y-5">
            <div>
              <label htmlFor="email" className="label">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="example@example.com"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="パスワードを入力"
                className="input"
              />
            </div>

            <button type="submit" className="btn-primary w-full py-2.5">
              ログイン
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          アカウントをお持ちでない方は管理者にお問い合わせください
        </p>
      </div>
    </div>
  );
}
