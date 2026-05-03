"use client";

import { useState } from "react";
import type { OrderType } from "@/types";
import { ORDER_TYPES, ORDER_TYPE_ICONS, ORDER_TYPE_COLORS } from "@/lib/constants";

interface OrderTypeSelectorProps {
  defaultValue?: OrderType;
  name?: string;
  onChange?: (type: OrderType) => void;
}

export function OrderTypeSelector({
  defaultValue = "配達",
  name = "order_type",
  onChange,
}: OrderTypeSelectorProps) {
  const [selected, setSelected] = useState<OrderType>(defaultValue);

  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER_TYPES.map((type) => {
          const isSelected = selected === type;
          const colors = ORDER_TYPE_COLORS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => { setSelected(type); onChange?.(type); }}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all font-medium text-sm ${
                isSelected
                  ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="text-xl">{ORDER_TYPE_ICONS[type]}</span>
              <span>{type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
