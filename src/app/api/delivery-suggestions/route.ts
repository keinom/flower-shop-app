import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * お届け先サジェスト検索 API
 *
 * `customers` テーブル + `delivery_destinations` マテビューを統合検索し、
 * お届け先候補を返す。
 *
 * - 顧客マスタの方を優先（同名なら顧客のレコードを返す）
 * - 検索キー: name / phone / address いずれかに含まれる文字列
 * - 上限: 20件
 *
 * 返却形式:
 *  {
 *    source: "customer" | "destination",
 *    name, postal_code, address, phone, email,
 *    use_count (destination のみ), customer_id (customer のみ)
 *  }[]
 */
export async function GET(req: NextRequest) {
  const rawQuery = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!rawQuery || rawQuery.length < 1) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  // 認可: ログイン admin のみ（顧客個人情報を含むため）
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "employee") {
    return NextResponse.json([], { status: 403 });
  }

  const q = rawQuery.replace(/[%_]/g, ""); // LIKE メタ文字を素直に
  const pattern = `%${q}%`;

  // delivery_destinations マテビューは anon/authenticated から REVOKE 済みのため、
  // admin/employee チェック通過後に限り service_role クライアントで参照する。
  const adminSupabase = createAdminClient();

  // 並行検索
  const [customersRes, destsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, email, postal_code, address")
      .or(`name.ilike.${pattern},phone.ilike.${pattern},address.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(20),
    adminSupabase
      .from("delivery_destinations" as never)
      .select("display_name, postal_code, address, phone, email, use_count, last_used")
      .or(`display_name.ilike.${pattern},phone.ilike.${pattern},address.ilike.${pattern}`)
      .order("use_count", { ascending: false })
      .limit(30),
  ]);

  // 顧客側の正規化キー集合（重複判定用）
  function normalize(s: string | null | undefined) {
    return (s ?? "").toLowerCase().replace(/[\s　]+/g, "");
  }
  const customerNameKeys = new Set(
    (customersRes.data ?? []).map((c) => normalize(c.name))
  );

  type Result = {
    source: "customer" | "destination";
    name: string;
    postal_code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    use_count: number | null;
    last_used: string | null;
    customer_id: string | null;
  };

  const fromCustomers: Result[] = (customersRes.data ?? []).map((c) => ({
    source: "customer",
    name: c.name,
    postal_code: c.postal_code ?? null,
    address: c.address ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    use_count: null,
    last_used: null,
    customer_id: c.id,
  }));

  const fromDests: Result[] = ((destsRes.data ?? []) as Array<{
    display_name: string;
    postal_code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    use_count: number;
    last_used: string | null;
  }>)
    // 顧客マスタに既に存在する名前は除外
    .filter((d) => !customerNameKeys.has(normalize(d.display_name)))
    .map((d) => ({
      source: "destination",
      name: d.display_name,
      postal_code: d.postal_code,
      address: d.address,
      phone: d.phone,
      email: d.email,
      use_count: d.use_count,
      last_used: d.last_used,
      customer_id: null,
    }));

  // 顧客→お届け先 の順で結合、最大 20件
  const merged = [...fromCustomers, ...fromDests].slice(0, 20);
  return NextResponse.json(merged);
}
