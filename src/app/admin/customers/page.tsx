import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CustomerSearchForm } from "@/components/admin/CustomerSearchForm";

interface SearchParams {
  name?: string;
  phone?: string;
  email?: string;
  q?: string;
  has_account?: string;
  created_from?: string;
  created_to?: string;
  searched?: string;
}

interface CustomersPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const p = await searchParams;
  const supabase = await createClient();

  // ── メインクエリ ──
  let query = supabase
    .from("customers")
    .select("id, name, phone, email, address, created_at, profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  // 顧客名
  if (p.name?.trim()) {
    query = query.ilike("name", `%${p.name.trim()}%`);
  }

  // 電話番号
  if (p.phone?.trim()) {
    query = query.ilike("phone", `%${p.phone.trim()}%`);
  }

  // メールアドレス
  if (p.email?.trim()) {
    query = query.ilike("email", `%${p.email.trim()}%`);
  }

  // キーワード（住所など）
  if (p.q?.trim()) {
    query = query.ilike("address", `%${p.q.trim()}%`);
  }

  // 登録日 From〜To
  if (p.created_from?.trim()) {
    query = query.gte("created_at", `${p.created_from.trim()}T00:00:00`);
  }
  if (p.created_to?.trim()) {
    query = query.lte("created_at", `${p.created_to.trim()}T23:59:59`);
  }

  const { data: customers, error } = await query;

  // ── アカウントフィルタ（クライアント側で絞り込み） ──
  const filtered = (() => {
    if (!customers) return [];
    if (!p.has_account) return customers;
    if (p.has_account === "issued")
      return customers.filter(
        (c) => (c.profiles as { display_name: string | null } | null)?.display_name
      );
    if (p.has_account === "none")
      return customers.filter(
        (c) => !(c.profiles as { display_name: string | null } | null)?.display_name
      );
    return customers;
  })();

  // ── 注文件数マップ ──
  const { data: orderCounts } = await supabase
    .from("orders")
    .select("customer_id");

  const countMap = (orderCounts ?? []).reduce(
    (acc, o) => {
      acc[o.customer_id] = (acc[o.customer_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const searched = p.searched === "1";

  return (
    <div className="space-y-5">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">顧客検索</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            複数の条件を組み合わせてAND検索できます
          </p>
        </div>
        <Link href="/admin/customers/new" className="btn-primary">
          + 顧客を登録
        </Link>
      </div>

      {/* ─── 検索フォーム ─── */}
      <Suspense>
        <CustomerSearchForm />
      </Suspense>

      {/* ─── エラー ─── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          データの取得に失敗しました
        </div>
      )}

      {/* ─── 検索前の案内 / 件数表示 ─── */}
      {!searched ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2">
          <span className="text-4xl">🔍</span>
          <p className="text-sm font-medium">検索条件を入力して「検索する」を押してください</p>
          <p className="text-xs">条件を何も指定しない場合は、最新200件が表示されます</p>
        </div>
      ) : (
        <>
          {/* 件数バー */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-bold text-brand-700 text-lg">
              {filtered.length}
            </span>
            <span>件 の顧客が見つかりました</span>
            {filtered.length >= 200 && (
              <span className="text-xs text-amber-600 ml-1">
                ※ 最大200件まで表示されています。条件を絞り込んでください。
              </span>
            )}
          </div>

          {/* ─── 結果テーブル ─── */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="th"></th>
                  <th className="th">登録日</th>
                  <th className="th">顧客名</th>
                  <th className="th">メールアドレス</th>
                  <th className="th">電話番号</th>
                  <th className="th text-center">注文件数</th>
                  <th className="th">アカウント</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td text-center text-gray-400 py-14">
                      条件に一致する顧客が見つかりませんでした
                    </td>
                  </tr>
                ) : (
                  filtered.map((customer) => (
                    <tr key={customer.id} className="tr-hover">
                      <td className="td">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-sm text-brand-600 hover:underline whitespace-nowrap font-medium"
                        >
                          詳細
                        </Link>
                      </td>
                      <td className="td text-gray-500 text-xs whitespace-nowrap">
                        {new Date(customer.created_at).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="td font-medium text-sm">{customer.name}</td>
                      <td className="td text-gray-600 text-sm">{customer.email ?? "—"}</td>
                      <td className="td text-gray-600 text-sm whitespace-nowrap">{customer.phone ?? "—"}</td>
                      <td className="td text-center text-sm">
                        {countMap[customer.id] ?? 0} 件
                      </td>
                      <td className="td">
                        {(customer.profiles as { display_name: string | null } | null)
                          ?.display_name ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            ✓ 発行済み
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">未発行</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
