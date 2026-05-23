"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkUpdateOrderStatus } from "@/app/admin/actions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTypeBadge } from "@/components/ui/OrderTypeBadge";
import type { OrderStatus, OrderType } from "@/types";

export type PastDueOrder = {
  id: string;
  status: string;
  order_type: string | null;
  delivery_date: string | null;
  shipping_date: string | null;
  delivery_name: string;
  product_name: string | null;
  quantity: number;
  customers: { id: string; name: string } | null;
};

const TARGET_STATUSES: OrderStatus[] = [
  "完了",
  "受付完了",
  "作成中",
  "ラッピング中",
  "配達準備完了",
  "配達中",
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });
}

export function PastDueBulkActions({ orders }: { orders: PastDueOrder[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState<OrderStatus>("完了");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleAll() {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkUpdate() {
    if (selected.size === 0) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await bulkUpdateOrderStatus(Array.from(selected), targetStatus);
        setSelected(new Set());
        setMessage({ type: "success", text: `${selected.size}件のステータスを「${targetStatus}」に変更しました` });
      } catch {
        setMessage({ type: "error", text: "ステータスの更新に失敗しました" });
      }
    });
  }

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0;

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-red-100 flex items-center justify-between bg-red-50 rounded-t-xl">
        <div>
          <h2 className="text-sm font-semibold text-red-900 flex items-center gap-2">
            期日超過の注文
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
              {orders.length}
            </span>
          </h2>
          <p className="text-xs text-red-700 mt-0.5">お届け日が過去の未完了注文</p>
        </div>
        <Link
          href="/admin/orders?searched=1"
          className="text-xs text-red-700 hover:underline whitespace-nowrap"
        >
          注文一覧 →
        </Link>
      </div>

      {message && (
        <div
          className={`mx-5 mt-3 px-3 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 一括操作バー */}
      <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-brand-600"
          />
          <span className="text-xs text-gray-600 whitespace-nowrap">
            {allSelected ? "すべて解除" : "すべて選択"}
          </span>
          <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
            ({selected.size}件選択中)
          </span>
        </label>

        <div className="flex items-center gap-2 sm:ml-auto">
          <select
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
            className="text-sm py-1.5 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 flex-1 min-w-0 sm:flex-none sm:w-auto"
          >
            {TARGET_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleBulkUpdate}
            disabled={!someSelected || isPending}
            className="btn-primary text-sm py-1.5 px-4 whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "更新中..." : "一括変更"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {orders.map((order) => {
          const customer = order.customers;
          const dateLabel = order.order_type === "発送" ? order.shipping_date : order.delivery_date;
          return (
            <div
              key={order.id}
              className={`px-5 py-3.5 flex items-center gap-3 transition-colors ${
                selected.has(order.id) ? "bg-red-50/60" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                onChange={() => toggle(order.id)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {order.order_type && (
                    <OrderTypeBadge type={order.order_type as OrderType} size="sm" />
                  )}
                  {customer ? (
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-sm font-semibold text-brand-700 hover:underline truncate"
                    >
                      {customer.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {order.delivery_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {order.product_name ?? `${order.quantity}点`}
                  {dateLabel && (
                    <span className="ml-2 text-red-500 font-medium">
                      {order.order_type === "発送" ? "発送日: " : "お届け: "}
                      {formatDate(dateLabel)}
                    </span>
                  )}
                </p>
              </div>
              <StatusBadge status={order.status as OrderStatus} size="sm" />
              <Link
                href={`/admin/orders/${order.id}`}
                className="text-xs text-brand-600 hover:underline whitespace-nowrap font-medium"
              >
                詳細
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
