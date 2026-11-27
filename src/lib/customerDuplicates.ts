/**
 * 顧客新規登録時の重複判定（Issue #40 R3）。
 *
 * 一致条件（いずれか 1 つでも一致で「重複候補」）:
 *   - 氏名: 半角・全角スペース・改行などの空白をすべて除去して一致
 *   - メール: 前後空白を除き、大文字小文字を区別せず一致
 *   - 電話: 数字以外を除去して一致（全角数字は半角にそろえる）
 *   空欄どうし（正規化後に空文字）は一致とみなさない。
 *
 * 判定ロジックは純粋関数（scripts/verify-customer-duplicates.ts で検証）。
 * DB には空白除去・数字抽出で検索できる列がないため、顧客一覧をページング取得して
 * アプリ側で突き合わせる（顧客は数千件規模・登録操作は低頻度のため許容）。
 */

export type DuplicateField = "name" | "email" | "phone";

export interface CustomerDupInput {
  name: string | null | undefined;
  email?: string | null;
  phone?: string | null;
}

export interface DuplicateCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  address: string | null;
  orderCount: number;
  matched: DuplicateField[];
}

/** 氏名の正規化: すべての空白（半角・全角・改行・タブ）を除去 */
export function normalizeName(v: string | null | undefined): string {
  return (v ?? "").replace(/[\s　]+/g, "");
}

/** メールの正規化: 前後空白除去＋小文字化 */
export function normalizeEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** 電話の正規化: 数字のみ（全角数字は NFKC で半角化してから抽出） */
export function normalizePhone(v: string | null | undefined): string {
  return (v ?? "").normalize("NFKC").replace(/\D+/g, "");
}

/** 入力と既存顧客を比較し、一致した項目を返す（空なら重複なし） */
export function matchedFields(input: CustomerDupInput, existing: CustomerDupInput): DuplicateField[] {
  const out: DuplicateField[] = [];
  const n = normalizeName(input.name);
  if (n !== "" && n === normalizeName(existing.name)) out.push("name");
  const e = normalizeEmail(input.email);
  if (e !== "" && e === normalizeEmail(existing.email)) out.push("email");
  const p = normalizePhone(input.phone);
  if (p !== "" && p === normalizePhone(existing.phone)) out.push("phone");
  return out;
}

export const DUPLICATE_FIELD_LABELS: Record<DuplicateField, string> = {
  name: "氏名",
  email: "メール",
  phone: "電話",
};

/** 警告に出す最大件数 */
export const MAX_DUPLICATES_SHOWN = 10;

type Row = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  address: string | null;
};

/** Supabase クライアントのうち本機能が使う最小の形（テストで差し替え可能にする） */
interface DupSupabase {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** 全顧客から重複候補を探す（ページング取得） */
export async function findDuplicateCustomers(
  supabase: DupSupabase,
  input: CustomerDupInput
): Promise<DuplicateCustomer[]> {
  const matches: Array<Row & { matched: DuplicateField[] }> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, postal_code, address")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`顧客の重複確認に失敗しました: ${error.message}`);
    const rows = (data ?? []) as Row[];
    for (const r of rows) {
      const m = matchedFields(input, r);
      if (m.length > 0) matches.push({ ...r, matched: m });
    }
    if (rows.length < PAGE) break;
  }
  if (matches.length === 0) return [];

  matches.sort((a, b) => b.matched.length - a.matched.length);
  const shown = matches.slice(0, MAX_DUPLICATES_SHOWN);

  const countMap: Record<string, number> = {};
  const { data: counts } = await supabase
    .from("customer_order_counts")
    .select("customer_id, order_count")
    .in("customer_id", shown.map((s) => s.id));
  for (const c of (counts ?? []) as Array<{ customer_id: string; order_count: number }>) {
    countMap[c.customer_id] = c.order_count;
  }

  return shown.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    postal_code: s.postal_code,
    address: s.address,
    orderCount: countMap[s.id] ?? 0,
    matched: s.matched,
  }));
}
