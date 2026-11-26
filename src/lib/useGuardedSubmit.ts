"use client";

import { startTransition, useCallback, useEffect, useRef } from "react";
import type { FormEvent } from "react";

/**
 * `useActionState` のフォームを「入力を消さずに」「二重に送らずに」送信するためのフック。
 *
 * React 19 は `<form action={...}>` の完了後に非制御の入力欄を自動リセットするため、
 * バリデーションエラー・重複警告で同じ画面に戻ると入力が消えてしまう。
 * そこで onSubmit で既定の送信を止め、FormData を自前で組み立てて formAction を
 * transition 内で呼ぶ（この経路ではフォームのリセットが行われない）。
 *
 * - 送信中（isPending）または送信直後の連打・Enter 連打は無視する（入口の二重送信防止）。
 * - JS が読み込まれる前の送信に備えて、フォームには `action={formAction}` も併せて指定しておく
 *   （onSubmit の preventDefault により、JS 有効時は React のフォーム action は呼ばれない）。
 *
 * 使い方:
 *   const [state, formAction, isPending] = useActionState(action, {});
 *   const { formRef, onSubmit, submit } = useGuardedSubmit(formAction, isPending);
 *   <form ref={formRef} action={formAction} onSubmit={onSubmit}> ...
 *   // 追加フィールド付きで再送信（例: 「それでも登録する」）: submit({ confirm_duplicate: "1" })
 */
export function useGuardedSubmit(
  formAction: (payload: FormData) => void,
  isPending: boolean
) {
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);

  // 送信が終わったら（エラー・警告表示で同じ画面に戻ったら）再び送信できるようにする
  useEffect(() => {
    if (!isPending) inFlight.current = false;
  }, [isPending]);

  const submit = useCallback(
    (extra?: Record<string, string>) => {
      const form = formRef.current;
      if (!form || inFlight.current) return;
      inFlight.current = true;
      const fd = new FormData(form);
      if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      startTransition(() => {
        formAction(fd);
      });
    },
    [formAction]
  );

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit();
    },
    [submit]
  );

  return { formRef, onSubmit, submit };
}
