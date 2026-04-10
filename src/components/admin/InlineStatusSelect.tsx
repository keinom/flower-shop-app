"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from "@/lib/constants";
import { updateOrderStatusQuick } from "@/app/admin/daily/actions";
import type { OrderStatus } from "@/types";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

export function InlineStatusSelect({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [isError, setIsError] = useState(false);

  const colors = ORDER_STATUS_COLORS[status];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderStatus;
    if (!newStatus || newStatus === status) return;

    const prevStatus = status;
    setStatus(newStatus);
    setIsError(false);

    startTransition(async () => {
      const result = await updateOrderStatusQuick(orderId, newStatus);
      if (result?.error) {
        setStatus(prevStatus);
        setIsError(true);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <select
        value={status}
        onChange={handleChange}
        disabled={isPending}
        className={`
          appearance-none cursor-pointer rounded-full font-semibold tracking-wide
          text-sm px-3 py-1 pr-6
          border transition-all
          disabled:opacity-60 disabled:cursor-not-allowed
          ${colors.bg} ${colors.text} ${colors.border ? `border ${colors.border}` : "border-transparent"}
          focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1
        `}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* chevron icon */}
      <svg
        className={`pointer-events-none absolute right-1.5 w-3 h-3 ${colors.text} opacity-70`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>

      {/* loading spinner */}
      {isPending && (
        <svg
          className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}

      {/* error indicator */}
      {isError && !isPending && (
        <span className="text-xs text-red-500">失敗</span>
      )}
    </div>
  );
}
