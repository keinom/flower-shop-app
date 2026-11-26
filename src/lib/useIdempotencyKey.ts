"use client";

import { useState } from "react";

/**
 * フォームの生存期間中、冪等キーを固定する。
 *
 * サーバーコンポーネント（page.tsx）が発行したキーを props で受け取るが、
 * Server Action 内の revalidatePath などでページが再描画されると page.tsx が再実行され、
 * props のキーは別の値に変わる。そのまま hidden に使うと「エラー後の再送信は同じキー」が崩れ、
 * 作成済みの顧客を再利用できず二重作成になる。
 * useState の初期値は最初の 1 回しか使われないため、再描画では変わらない。
 * 成功して画面遷移した後（フォームを開き直したとき）にのみ新しいキーになる。
 */
export function useIdempotencyKey(initialKey: string): string {
  const [key] = useState(initialKey);
  return key;
}
