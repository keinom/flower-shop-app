/**
 * 顧客名・配送先名のフォーマット処理
 *
 * 組織顧客の名前は納品書での見栄えのため `\n` で改行を含むことがある。
 * 画面によって表示方法を切り替える:
 *   - 一覧 / 検索結果: oneLineName で1行化
 *   - 詳細 / 納品書 : style={{ whiteSpace: "pre-line" }} で改行反映
 */

/** 改行を半角スペースに置換し前後trim → 1行表示用 */
export function oneLineName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/** 改行を含む可能性のある名前を pre-line 表示するための style */
export const multiLineNameStyle = { whiteSpace: "pre-line" as const };
