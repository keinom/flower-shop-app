import { LoginForm } from "./LoginForm";

export default function LoginPage() {
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

        {/* ログインフォーム（Client Component） */}
        <LoginForm />

        <p className="text-center text-xs text-gray-400 mt-6">
          アカウントをお持ちでない方は管理者にお問い合わせください
        </p>
      </div>
    </div>
  );
}
