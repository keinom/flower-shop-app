import type { OrderType } from "@/types";
import { ORDER_TYPE_COLORS, ORDER_TYPE_ICONS } from "@/lib/constants";

interface OrderTypeBadgeProps {
  type: OrderType;
  size?: "sm" | "md";
}

export function OrderTypeBadge({ type, size = "md" }: OrderTypeBadgeProps) {
  const colors = ORDER_TYPE_COLORS[type];
  const icon   = ORDER_TYPE_ICONS[type];
  const sizeClass = size === "sm"
    ? "text-xs px-2 py-0.5 gap-1"
    : "text-sm px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border tracking-wide ${sizeClass} ${colors.bg} ${colors.text} ${colors.border}`}
    >
      <span>{icon}</span>
      <span>{type}</span>
    </span>
  );
}
