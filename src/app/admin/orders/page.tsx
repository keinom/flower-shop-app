import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import { OrderSearchForm } from "@/components/admin/OrderSearchForm";
import type { OrderStatus, OrderType } from "@/types";

interface SearchParams {
  q?: string;
  customer_name?: string;
  status?: string;
  order_type?: string;
  purpose?: string;
  delivery_from?: string;
  delivery_to?: string;
  created_from?: string;
  created_to?: string;
  amount_min?: string;
  amount_max?: string;
}

interface OrdersPageProps {
  searchParams: Promise<SearchParams>;
}

// 検索条件が1つ以上入力されているか
function hasFilter(p: SearchParams): boolean {
  return Object.values(p).some((v) => v && String(v).trim() !== "");
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const p = await searchParams;
  const supabase = await createClient();

  // ── 顧客名フィルタ: 先にcustomer_idの候補を取得 ──
  let customerIdFilter: string[] | null = null;
  if (p.customer_name?.trim()) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", `%${p.customer_name.trim()}%`);
    customerIdFilter = (customers ?? []).map((c) => c.id);
    // 該当なし → 結果は必ず0件
    if (customerIdFilter.length === 0) customerIdFilter = ["__no_match__"];
  }

  // ── メインクエリ ──
  let query = supabase
    .from("orders")
    .select(
      `id, status, order_type, product_name, quantity,
       delivery_date, delivery_name, purpose,
       created_at, total_amount,
       customers(id, name)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  // キーワード: 商品名 OR 配達先名
  if (p.q?.trim()) {
    const kw = p.q.trim();
    query = query.or(
      `product_name.ilike.%${kw}%,delivery_name.ilike.%${kw}%`
    );
  }

  // 顧客名（事前取得したIDで絞り込み）
  if (customerIdFilter !== null) {
    query = query.in("customer_id", customerIdFilter);
  }

  // ステータス
  if (p.status?.trim()) {
    query = query.eq("status", p.status.trim());
  }

  // 種別
  if (p.order_type?.trim()) {
    query = query.eq("order_type", p.order_type.trim());
  }

  // 用途
  if (p.purpose?.trim()) {
    query = query.eq("purpose", p.purpose.trim());
  }

  // お届け日 From〜To
  if (p.delivery_from?.trim()) {
    query = query.gte("delivery_date", p.delivery_from.trim());
  }
  if (p.delivery_to?.trim()) {
    query = query.lte("delivery_date", p.delivery_to.trim());
  }

  // 注文日 From〜To
  if (p.created_from?.trim()) {
    query = query.gte("created_at", `${p.created_from.trim()}T00:00:00`);
  }
  if (p.created_to?.trim()) {
    query = query.lte("created_at", `${p.created_to.trim()}T23:59:59`);
  }

  // 合計金額 From〜To
  const amountMin = p.amount_min ? parseInt(p.amount_min) : null;
  const amountMax = p.amount_max ? parseInt(p.amount_max) : null;
  if (amountMin !== null && !isNaN(amountMin)) {
    query = query.gte("total_amount", amountMin);
  }
  if (amountMax !== null && !isNaN(amountMax)) {
    query = query.lte("total_amount", amountMax);
  }

  const { data: orders, error } = await query;
  const searched = hasFilter(p);

  return (
    <div className="space-y-5">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">注文検索</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            複数の条件を組み合わせてAND検索できます
          </p>
        </div>
        <Link href="/admin/orders/new" className="btn-primary">
          + 注文を作成
        </Link>
      </div>

      {/* ─── 検索フォーム（Client Component） ─── */}
      <Suspense>
        <OrderSearchForm />
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
              {orders?.length ?? 0}
            </span>
            <span>件 の注文が見つかりました</span>
            {(orders?.length ?? 0) >= 200 && (
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
                  <th className="th">注文日</th>
                  <th className="th">顧客名</th>
                  <th className="th">商品名</th>
                  <th className="th text-right">合計金額</th>
                  <th className="th">お届け日</th>
                  <th className="th">配達先名</th>
                  <th className="th">用途</th>
                  <th className="th">種別</th>
                  <th className="th">ステータス</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!orders || orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="td text-center text-gray-400 py-14"
                    >
                      条件に一致する注文が見つかりませんでした
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const customer = order.customers as
                      | { id: string; name: string }
                      | null;
                    return (
                      <tr key={order.id} className="tr-hover">
                        <td className="td text-gray-500 text-xs whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString(
                            "ja-JP"
                          )}
                        </td>
                        <td className="td">
                          {customer ? (
                            <Link
                              href={`/admin/customers/${customer.id}`}
                              className="text-brand-700 hover:underline text-sm"
                            >
                              {customer.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="td font-medium text-sm">
                          {order.product_name ?? `${order.quantity}点`}
                        </td>
                        <td className="td text-right text-sm whitespace-nowrap">
                          {(order as { total_amount?: number | null })
                            .total_amount != null
                            ? `¥${(
                                order as { total_amount: number }
                              ).total_amount.toLocaleString("ja-JP")}`
                            : "—"}
                        </td>
                        <td className="td text-sm whitespace-nowrap">
                          {order.delivery_date
                            ? new Date(
                                order.delivery_date
                              ).toLocaleDateString("ja-JP")
                            : "—"}
                        </td>
                        <td className="td text-sm text-gray-600">
                          {(order as { delivery_name?: string })
                            .delivery_name ?? "—"}
                        </td>
                        <td className="td text-sm text-gray-500">
                          {(order as { purpose?: string }).purpose ?? "—"}
                        </td>
                        <td className="td">
                          {(order as { order_type?: string }).order_type && (
                            <OrderTypeBadge
                              type={
                                (order as { order_type: string })
                                  .order_type as OrderType
                              }
                              size="sm"
                            />
                          )}
                        </td>
                        <td className="td">
                          <StatusBadge
                            status={order.status as OrderStatus}
                            size="sm"
                          />
                        </td>
                        <td className="td">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sm text-brand-600 hover:underline whitespace-nowrap"
                          >
                            詳細・更新
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
