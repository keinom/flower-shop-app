import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MonthPillsScroller } from "@/components/admin/MonthPillsScroller";
import { issueAccount } from "../actions";
import type { OrderStatus } from "@/types";
import type { Database } from "@/types/database";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"] & { postal_code?: string | null };

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; created?: string; month?: string }>;
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
    .select("*")
    .eq("id", id)
    .single() as { data: CustomerRow | null; error: unknown };

  if (!customer) notFound();

  // 注文履歴: 旧データ含め数千件/顧客に達するため、ページング取得で
  // PostgREST のサーバ側 max-rows (1000) キャップを回避する
  type OrderRow = {
    id: string;
    status: string;
    product_name: string | null;
    quantity: number;
    delivery_date: string | null;
    created_at: string;
    total_amount: number | null;
  };
  async function fetchAllOrders(): Promise<OrderRow[]> {
    const PAGE = 1000;
    const all: OrderRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, product_name, quantity, delivery_date, created_at, total_amount")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error || !data) break;
      all.push(...(data as OrderRow[]));
      if (data.length < PAGE) break;
    }
    return all;
  }
  const orders = await fetchAllOrders();

  const hasAccount = !!customer.profile_id;

  // ── 月ナビゲーション用データ作成 ──
  // 昇順（古い→新しい）で並べ、矢印方向 ← = 過去 / → = 未来 に揃える
  const allMonths: string[] = orders
    ? [...new Set(orders.map((o) => o.created_at.slice(0, 7)))].sort()
    : [];

  // 選択中の月（デフォルトは最新月 = 末尾）
  const latestMonth = allMonths[allMonths.length - 1] ?? "";
  const selectedMonth =
    sp.month && allMonths.includes(sp.month) ? sp.month : latestMonth;

  // 選択月の注文を抽出
  const monthOrders = orders?.filter((o) =>
    o.created_at.startsWith(selectedMonth)
  ) ?? [];

  // 注文日ごとにグループ化（YYYY-MM-DD → orders[]）
  const byDate = monthOrders.reduce<Record<string, typeof monthOrders>>(
    (acc, order) => {
      const date = order.created_at.slice(0, 10);
      if (!acc[date]) acc[date] = [];
      acc[date].push(order);
      return acc;
    },
    {}
  );
  const sortedDates = Object.keys(byDate).sort().reverse();

  // 月合計金額
  const monthTotal = monthOrders.reduce(
    (sum, o) => sum + ((o as { total_amount?: number | null }).total_amount ?? 0),
    0
  );

  // prev / next 月（昇順配列ベース: prev = 過去 = 左、 next = 未来 = 右）
  const currentIndex = allMonths.indexOf(selectedMonth);
  const prevMonth = currentIndex > 0 ? allMonths[currentIndex - 1] : null;
  const nextMonth = currentIndex >= 0 && currentIndex < allMonths.length - 1 ? allMonths[currentIndex + 1] : null;

  // 表示用 "YYYY年M月" フォーマット
  function formatMonth(ym: string) {
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  }

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
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
          <InfoRow label="郵便番号" value={customer.postal_code} />
          <div className="col-span-1 sm:col-span-2">
            <InfoRow
              label="住所"
              value={
                customer.postal_code && customer.address
                  ? `〒${customer.postal_code} ${customer.address}`
                  : customer.address
              }
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* 注文履歴 */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            注文履歴（全{orders?.length ?? 0}件）
          </h2>
          <Link
            href={`/admin/orders/new?customer_id=${id}`}
            className="text-xs text-brand-600 hover:underline"
          >
            + 注文を作成
          </Link>
        </div>

        {allMonths.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">注文履歴がありません</p>
        ) : (
          <>
            {/* ── 月ナビゲーション ── */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-2">
              {/* 前後ナビ + 現在月 */}
              <div className="flex items-center justify-between">
                <Link
                  href={prevMonth ? `/admin/customers/${id}?month=${prevMonth}` : "#"}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors ${
                    prevMonth
                      ? "text-brand-600 hover:bg-brand-50"
                      : "text-gray-300 pointer-events-none"
                  }`}
                >
                  ← {prevMonth ? formatMonth(prevMonth) : ""}
                </Link>
                <span className="text-base font-bold text-gray-800">
                  {formatMonth(selectedMonth)}
                </span>
                <Link
                  href={nextMonth ? `/admin/customers/${id}?month=${nextMonth}` : "#"}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors ${
                    nextMonth
                      ? "text-brand-600 hover:bg-brand-50"
                      : "text-gray-300 pointer-events-none"
                  }`}
                >
                  {nextMonth ? formatMonth(nextMonth) : ""} →
                </Link>
              </div>

              {/* 全月リスト（スクロール可能・選択月にオートスクロール） */}
              <MonthPillsScroller
                months={allMonths}
                selectedMonth={selectedMonth}
                buildHref={(ym) => `/admin/customers/${id}?month=${ym}`}
                formatMonth={formatMonth}
              />
            </div>

            {/* ── 月合計 ── */}
            <div className="flex items-center justify-between px-5 py-3 bg-brand-50 border-b border-brand-100">
              <span className="text-sm text-gray-600">
                {formatMonth(selectedMonth)} の注文 {monthOrders.length}件
              </span>
              <div className="text-right">
                <span className="text-xs text-gray-500 mr-2">月合計（税込）</span>
                <span className="text-lg font-bold text-brand-700">
                  ¥{monthTotal.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>

            {/* ── 注文日ごとのグループ ── */}
            {sortedDates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">
                この月の注文はありません
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedDates.map((date) => {
                  const dayOrders = byDate[date];
                  const dayTotal = dayOrders.reduce(
                    (sum, o) =>
                      sum + ((o as { total_amount?: number | null }).total_amount ?? 0),
                    0
                  );
                  return (
                    <div key={date}>
                      {/* 日付ヘッダー */}
                      <div className="flex items-center justify-between px-5 py-2 bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">
                          {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          })}
                        </span>
                        {dayTotal > 0 && (
                          <span className="text-xs text-gray-500">
                            小計 ¥{dayTotal.toLocaleString("ja-JP")}
                          </span>
                        )}
                      </div>

                      {/* その日の注文（列幅を固定してガタつきを防ぐ） */}
                      <table className="w-full table-fixed text-sm">
                        <colgroup>
                          <col />
                          <col className="w-28" />
                          <col className="w-20" />
                          <col className="w-16" />
                        </colgroup>
                        <tbody className="divide-y divide-gray-50">
                          {dayOrders.map((order) => (
                            <tr key={order.id} className="tr-hover">
                              <td className="px-4 py-2 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {order.product_name ?? `${order.quantity}点`}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                  お届け希望日:{" "}
                                  {order.delivery_date
                                    ? new Date(order.delivery_date).toLocaleDateString("ja-JP")
                                    : "未定"}
                                </p>
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {(order as { total_amount?: number | null }).total_amount != null ? (
                                  <span className="font-semibold text-gray-700">
                                    ¥{(order as { total_amount: number }).total_amount.toLocaleString("ja-JP")}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <StatusBadge status={order.status as OrderStatus} size="sm" />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="text-brand-600 hover:underline"
                                >
                                  詳細
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
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
