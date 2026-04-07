"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="card p-8">
      {/* エラーメッセージ */}
      {state.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-5">
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

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
