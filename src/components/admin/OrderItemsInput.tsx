"use client";

import { useState } from "react";

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

const EMPTY_ITEM: OrderItem = { product_name: "", quantity: 1, unit_price: 0 };

export function OrderItemsInput() {
  const [items, setItems] = useState<OrderItem[]>([{ ...EMPTY_ITEM }]);

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(
    index: number,
    field: keyof OrderItem,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "product_name") return { ...item, product_name: value };
        const num = parseInt(value, 10);
        return { ...item, [field]: isNaN(num) ? 0 : num };
      })
    );
  }

  const grandTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  return (
    <div className="space-y-3">
      {/* 商品リスト */}
      {items.map((item, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              商品 {index + 1}
            </span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                削除
              </button>
            )}
          </div>

          {/* 商品名 */}
          <div>
            <label className="label">
              商品名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="item_product_name"
              value={item.product_name}
              onChange={(e) => updateItem(index, "product_name", e.target.value)}
              required
              placeholder="例: スタンド花（2段）、花束"
              className="input"
            />
          </div>

          {/* 数量 / 単価 / 小計 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">
                数量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="item_quantity"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                min={1}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">
                単価（円） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="item_unit_price"
                value={item.unit_price}
                onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                min={0}
                required
                className="input"
              />
            </div>
            <div>
              <p className="label text-gray-400">小計</p>
              <p className="py-2 px-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-md">
                ¥{(item.quantity * item.unit_price).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* 商品追加ボタン */}
      <button
        type="button"
        onClick={addItem}
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
      >
        ＋ 商品を追加する
      </button>

      {/* 合計金額 */}
      <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 mt-1">
        <span className="text-sm font-semibold text-gray-700">合計金額</span>
        <span className="text-lg font-bold text-brand-700">
          ¥{grandTotal.toLocaleString("ja-JP")}
        </span>
      </div>
    </div>
  );
}
