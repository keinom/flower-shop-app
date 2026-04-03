import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OrderStatus } from "@/types";

interface CustomerOrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: CustomerOrderDetailPageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 自分の顧客IDを取得（RLSでも保護されているが念のため顧客IDでフィルター）
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!customer) redirect("/customer");

  // 注文詳細（RLSにより他顧客の注文は取得不可）
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .single();

  if (!order) notFound();

  // 商品明細
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_name, description, quantity, unit_price, tax_rate")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  // ステータス変更履歴
  const { data: logs } = await supabase
    .from("order_status_logs")
    .select("id, old_status, new_status, note, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const isClosed = order.status === "配達完了" || order.status === "キャンセル";

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/customer" className="text-sm text-gray-500 hover:text-gray-700">
          ← 注文履歴
        </Link>
        <h1 className="text-xl font-bold text-gray-900">注文詳細</h1>
      </div>

      {/* 注文完了通知 */}
      {created && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-green-500 text-xl mt-0.5">✓</span>
          <div>
            <p className="text-sm font-medium text-green-800">ご注文を受け付けました</p>
            <p className="text-xs text-green-700 mt-0.5">
              内容を確認のうえ、準備が整い次第ステータスを更新いたします。
            </p>
          </div>
        </div>
      )}

      {/* 現在のステータス */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">現在のステータス</p>
            <StatusBadge status={order.status as OrderStatus} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">注文日</p>
            <p className="text-sm text-gray-700">
              {new Date(order.created_at).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* 進捗ステップ（キャンセル以外） */}
        {order.status !== "キャンセル" && (
          <div className="mt-5">
            <ProgressSteps currentStatus={order.status as OrderStatus} />
          </div>
        )}
      </div>

      {/* お届け先情報 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">
          お届け先情報
        </h2>
        <dl className="space-y-3 text-sm">
          <InfoRow label="お届け先名" value={order.delivery_name} />
          <InfoRow label="お届け先住所" value={order.delivery_address} />
          <InfoRow
            label="お届け希望日"
            value={
              order.delivery_date
                ? new Date(order.delivery_date).toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })
                : null
            }
          />
        </dl>
      </div>

      {/* 商品情報 */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">
          商品情報
        </h2>
        {orderItems && orderItems.length > 0 ? (
          <>
            <div className="space-y-2 text-sm">
              {orderItems.map((item) => {
                const excl = item.quantity * item.unit_price;
                const tax  = Math.round(excl * item.tax_rate / 100);
                return (
                  <div
                    key={item.id}
                    className="py-2.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        {(item as { description?: string | null }).description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(item as { description: string }).description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.quantity}点 × ¥{item.unit_price.toLocaleString("ja-JP")}（税抜）
                        </p>
                      </div>
                      <p className="font-semibold text-gray-700 flex-shrink-0">
                        ¥{(excl + tax).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 税込合計サマリー */}
            {(() => {
              const totalExcl = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
              const taxRate   = orderItems[0].tax_rate;
              const taxAmt    = Math.round(totalExcl * taxRate / 100);
              return (
                <div className="mt-3 pt-3 border-t space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>小計（税抜）</span>
                    <span>¥{totalExcl.toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>消費税（{taxRate}%）</span>
                    <span>¥{taxAmt.toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-brand-700 text-base pt-1 border-t">
                    <span>合計（税込）</span>
                    <span>¥{(totalExcl + taxAmt).toLocaleString("ja-JP")}</span>
                  </div>
                </div>
              );
            })()}
            {order.purpose && (
              <p className="text-xs text-gray-500 mt-3">用途: {order.purpose}</p>
            )}
          </>
        ) : (
          <dl className="space-y-3 text-sm">
            <InfoRow label="商品名" value={order.product_name} />
            <InfoRow label="数量" value={`${order.quantity} 点`} />
            <InfoRow label="用途" value={order.purpose} />
          </dl>
        )}
      </div>

      {/* メッセージ・備考 */}
      {(order.message_card || order.remarks) && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">
            メッセージ・備考
          </h2>
          {order.message_card && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">メッセージカード内容</p>
              <p className="bg-gray-50 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {order.message_card}
              </p>
            </div>
          )}
          {order.remarks && (
            <div>
              <p className="text-xs text-gray-500 mb-1">備考・ご要望</p>
              <p className="bg-gray-50 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {order.remarks}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ステータス変更履歴 */}
      {logs && logs.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">
            対応状況の履歴
          </h2>
          <ol className="space-y-3">
            {logs.map((log, i) => (
              <li key={log.id} className="flex items-start gap-3 text-sm">
                <div className="flex flex-col items-center mt-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      i === logs.length - 1
                        ? "bg-brand-500"
                        : "bg-gray-300"
                    }`}
                  />
                  {i < logs.length - 1 && (
                    <div className="w-px h-full bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.old_status && (
                      <>
                        <StatusBadge status={log.old_status as OrderStatus} size="sm" />
                        <span className="text-gray-400 text-xs">→</span>
                      </>
                    )}
                    <StatusBadge status={log.new_status as OrderStatus} size="sm" />
                  </div>
                  {log.note && (
                    <p className="text-gray-600 text-xs mt-1">{log.note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* アクション */}
      <div className="flex gap-3">
        <Link href="/customer" className="btn-secondary">
          注文履歴に戻る
        </Link>
        {!isClosed && (
          <Link href="/customer/orders/new" className="btn-primary">
            新しい注文をする
          </Link>
        )}
      </div>

      {/* キャンセル案内 */}
      {!isClosed && (
        <p className="text-xs text-gray-400 text-center">
          注文の変更・キャンセルはお電話またはメールにてご連絡ください
        </p>
      )}
    </div>
  );
}

/** 進捗ステップ表示（受付→受付完了→作成中→ラッピング中→配達準備完了→配達中→配達完了） */
const PROGRESS_STEPS: OrderStatus[] = [
  "受付",
  "受付完了",
  "作成中",
  "ラッピング中",
  "配達準備完了",
  "配達中",
  "配達完了",
];

function ProgressSteps({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentIndex = PROGRESS_STEPS.indexOf(currentStatus);

  return (
    <div className="flex items-center">
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isLast = i === PROGRESS_STEPS.length - 1;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isDone
                    ? "bg-brand-500 border-brand-500 text-white"
                    : isCurrent
                    ? "bg-white border-brand-500 text-brand-600"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 text-center leading-tight w-10 ${
                  isCurrent
                    ? "text-brand-700 font-medium"
                    : isDone
                    ? "text-brand-500"
                    : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 ${
                  isDone ? "bg-brand-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}
