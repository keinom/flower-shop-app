/**
 * Enter キーによる誤送信を防ぐフォームキーボードハンドラ
 *
 * 入力途中で Enter を押すと submit 扱いになり、サーバーバリデーションで
 * 弾かれてリダイレクト → React state リセットで「入力した文字が消える」
 * 現象が起きる。これを防ぐため、テキスト入力上の Enter を捕捉する。
 *
 * - <textarea>: 改行入力として通常通り
 * - <button type="submit">: 送信ボタンの Enter は許容
 * - その他の <input>: Enter を preventDefault
 */
export function preventEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const t = e.target as HTMLElement;
  if (t.tagName === "TEXTAREA") return;
  if (t.tagName === "BUTTON" && (t as HTMLButtonElement).type === "submit") return;
  if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "submit") return;
  e.preventDefault();
}
