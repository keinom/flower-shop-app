"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> {
  children: ReactNode;
  /** 送信中に表示する文言（既定: 処理中...） */
  pendingText?: ReactNode;
  /**
   * 送信中かどうかを外から指定する。
   * `useActionState` の isPending を渡すフォームや、`action` を使わず手動で送信するフォーム用。
   * 省略時は親 <form action={...}> の送信状態（useFormStatus）に従う。
   */
  pending?: boolean;
}

/**
 * 送信ボタン（共通）。
 *
 * 送信を開始してから完了（画面遷移またはエラー表示）するまでボタンを無効化し、
 * 文言を「処理中...」などに切り替える。二重送信（連打・ダブルクリック・Enter 連打）の入口対策。
 * 作成系フォームはサーバー側の冪等化（src/lib/idempotency.ts）と組み合わせて使う。
 *
 * 使い方:
 *   <form action={someAction}> ... <SubmitButton pendingText="登録中...">登録する</SubmitButton> </form>
 *
 * - 確認ダイアログ（confirm）付きの削除フォームは、キャンセル時に onSubmit で preventDefault すれば
 *   送信自体が始まらないため、ボタンは無効化されたままにならない。
 * - 既定の見た目は btn-primary。className を渡すとそちらに置き換わる。
 */
export function SubmitButton({
  children,
  pendingText = "処理中...",
  pending: pendingProp,
  className = "btn-primary",
  disabled,
  ...rest
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
