import type { OrderStatus } from "@/types";
import { ORDER_STATUS_COLORS } from "@/lib/constants";

interface StatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "md";
}

const FALLBACK_COLORS = {
  bg: "bg-gray-100",
  text: "text-gray-600",
  border: "border-gray-200",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const colors = ORDER_STATUS_COLORS[status] ?? FALLBACK_COLORS;
  const sizeClass = size === "sm"
    ? "text-xs px-2 py-0.5"
    : "text-sm px-2.5 py-1";
  const borderClass = colors.border ? `border ${colors.border}` : "";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide ${sizeClass} ${colors.bg} ${colors.text} ${borderClass}`}
    >
      {status}
    </span>
  );
}
