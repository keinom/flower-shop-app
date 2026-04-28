/**
 * 日付フォーマットユーティリティ
 *
 * 注意: Vercel サーバーは UTC で動作するため、`new Date(...).toLocaleDateString("ja-JP")`
 * のように timezone 指定なしで日付化すると、UTC で日付が決定されてしまい、
 * JST 上での表示がズレる（例: JST 0:00〜9:00 帯のタイムスタンプが前日扱い）。
 *
 * すべての日付表示・日付比較は本ファイルの関数を経由する。
 */

const JST = "Asia/Tokyo";

/** YYYY/M/D 形式 (toLocaleDateString("ja-JP") 互換) */
export function formatJstDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { timeZone: JST });
}

/** YYYY/M/D HH:MM:SS 形式 */
export function formatJstDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ja-JP", { timeZone: JST });
}

/** HH:MM 形式（24時間） */
export function formatJstTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ja-JP", {
    timeZone: JST, hour: "2-digit", minute: "2-digit",
  });
}

/** ISO timestamp の JST 日付部分を YYYY-MM-DD で取り出す */
export function jstDateString(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";
  // sv-SE ロケールは ISO 形式 (YYYY-MM-DD) を返す
  return d.toLocaleDateString("sv-SE", { timeZone: JST });
}

/** ISO timestamp の JST 年月部分を YYYY-MM で取り出す */
export function jstYearMonthString(input: string | Date | null | undefined): string {
  return jstDateString(input).slice(0, 7);
}

/** YYYY-MM-DD（日付のみ）入力を JST 開始時刻の ISO timestamp に */
export function toJstStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+09:00`;
}

/** YYYY-MM-DD（日付のみ）入力を JST 終了時刻の ISO timestamp に */
export function toJstEndOfDay(dateStr: string): string {
  return `${dateStr}T23:59:59+09:00`;
}

/** 当日の JST 日付 (YYYY-MM-DD) */
export function todayJst(): string {
  return jstDateString(new Date());
}
