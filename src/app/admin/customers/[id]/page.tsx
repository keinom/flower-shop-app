import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { issueAccount } from "../actions";
import type { OrderStatus } from "@/types";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; created?: string }>;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*, profiles(display_name)")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, product_name, delivery_date, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const hasAccount =
    !!(customer.profiles as { display_name: string | null } | null)
      ?.display_name || !!customer.profile_id;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-700">
          ← 顧客一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
      </div>

      {sp.created && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          顧客を登録しました
        </div>
      )}
      {sp.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {decodeURIComponent(sp.success)}
        </div>
      )}
      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* 顧客情報 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">顧客情報</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label="顧客名" value={customer.name} />
          <InfoRow label="電話番号" value={customer.phone} />
          <InfoRow label="メールアドレス" value={customer.email} />
          <InfoRow
            label="ログインアカウント"
            value={
              customer.profile_id ? (
                <span className="text-green-700">✓ 発行済み</span>
              ) : (
                <span className="text-gray-400">未発行</span>
              )
            }
          />
          <div className="col-span-2">
            <InfoRow label="住所" value={customer.address} />
          </div>
          <div className="col-span-2">
            <InfoRow label="備考" value={customer.notes} />
          </div>
        </dl>
      </div>

      {/* アカウント発行 */}
      {!hasAccount && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            ログインアカウントを発行
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            顧客が自分でログインできるようにアカウントを発行します
          </p>
          <form action={issueAccount} className="space-y-4">
            <input type="hidden" name="customer_id" value={customer.id} />
            <input type="hidden" name="display_name" value={customer.name} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ログイン用メールアドレス</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="customer@example.com"
                  defaultValue={customer.email ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  初期パスワード{" "}
                  <span className="text-gray-400 text-xs font-normal">（8文字以上）</span>
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="8文字以上"
                  className="input"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              アカウントを発行する
            </button>
          </form>
        </div>
      )}

      {/* 注文一覧 */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            注文履歴（{orders?.length ?? 0}件）
          </h2>
        </div>
        <div className="table-container rounded-none rounded-b-lg border-0">
          <table className="table">
            <thead>
              <tr>
                <th className="th">注文日</th>
                <th className="th">商品名</th>
                <th className="th">お届け希望日</th>
                <th className="th">ステータス</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!orders || orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td text-center text-gray-400 py-8">
                    注文履歴がありません
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="tr-hover">
                    <td className="td text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="td">{order.product_name}</td>
                    <td className="td">
                      {new Date(order.delivery_date).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="td">
                      <StatusBadge status={order.status as OrderStatus} size="sm" />
                    </td>
                    <td className="td">
                      <Link
                        href={`/admin/orders/${order.id}`}
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
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}
