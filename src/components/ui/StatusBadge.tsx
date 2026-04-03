import type { OrderStatus } from "@/types";
import { ORDER_STATUS_COLORS } from "@/lib/constants";

interface StatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const colors = ORDER_STATUS_COLORS[status];
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colors.bg} ${colors.text}`}
    >
      {status}
    </span>
  );
}
