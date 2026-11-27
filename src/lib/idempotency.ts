/**
 * 作成系フォームの冪等キー（二重送信対策）の共通処理。
 *
 * - フォームを表示するサーバーコンポーネントで UUID を発行し（newIdempotencyKey）、
 *   hidden input（name="idempotency_key"）で送信する。リロードすると新しいキー（＝別の送信）になる。
 * - Server Action / Route Handler は INSERT 時にそのキーを保存する。作成対象テーブルには
 *   `WHERE idempotency_key IS NOT NULL` の部分一意インデックスがあり（マイグレーション 032）、
 *   同じキーの 2 回目以降の INSERT は一意制約違反（23505）になる。
 * - 一意制約違反になったら、同じキーの既存行を引いてその詳細画面へ遷移する。
 *
 * このファイルは純粋関数のみ（server-only / DOM 非依存）。scripts/verify-idempotency.ts から検証する。
 */

export const IDEMPOTENCY_FIELD = "idempotency_key";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** フォーム表示用の新しい冪等キーを発行する */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** フォーム値から冪等キーを取り出す。UUID 形式でなければ null（＝冪等化なしの従来動作）。 */
export function parseIdempotencyKey(value: FormDataEntryValue | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return UUID_RE.test(v) ? v.toLowerCase() : null;
}

/** FormData から冪等キーを取り出す */
export function readIdempotencyKey(formData: FormData): string | null {
  return parseIdempotencyKey(formData.get(IDEMPOTENCY_FIELD));
}

/** PostgREST / Postgres の一意制約違反（SQLSTATE 23505）か */
export function isUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return !!error && error.code === "23505";
}

/** 冪等キーで検索できるテーブル */
export type IdempotentTable = "customers" | "orders" | "recurring_order_templates" | "invoices";

/** Supabase クライアントのうち本機能が使う最小の形（テストで差し替え可能にする） */
interface KeyLookupSupabase {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * 同じ冪等キーで作成済みのレコード ID を返す（なければ null）。
 * 作成前の事前確認（2 回目以降の送信を即座に既存レコードへ誘導）と、
 * INSERT が一意制約違反になった後の再取得の両方で使う。
 */
export async function findIdByIdempotencyKey(
  supabase: KeyLookupSupabase,
  table: IdempotentTable,
  key: string | null
): Promise<string | null> {
  if (!key) return null;
  const { data } = await supabase.from(table).select("id").eq("idempotency_key", key).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
