import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select(`
      id, name, phone, email, address, created_at,
      profiles(display_name)
    `)
    .order("created_at", { ascending: false });

  // 各顧客の注文件数を取得
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">顧客一覧</h1>
        <Link href="/admin/customers/new" className="btn-primary">
          + 顧客を登録
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          データの取得に失敗しました
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="th">顧客名</th>
              <th className="th">メールアドレス</th>
              <th className="th">電話番号</th>
              <th className="th">注文件数</th>
              <th className="th">ログインアカウント</th>
              <th className="th">登録日</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!customers || customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="td text-center text-gray-400 py-10">
                  顧客データがありません。「顧客を登録」から追加してください。
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="tr-hover">
                  <td className="td font-medium">{customer.name}</td>
                  <td className="td text-gray-600">{customer.email ?? "—"}</td>
                  <td className="td text-gray-600">{customer.phone ?? "—"}</td>
                  <td className="td text-center">
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
                  <td className="td text-gray-500 text-xs">
                    {new Date(customer.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="td">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
