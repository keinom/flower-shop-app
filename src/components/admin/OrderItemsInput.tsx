"use client";

import { useState } from "react";

interface OrderItem {
  product_name: string;
  description: string;
  quantity: number;
  unit_price: string; // 文字列で管理（空欄許容）
}

interface DefaultItem {
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
}

interface Props {
  taxRate: number;
  defaultItems?: DefaultItem[];
}

const EMPTY_ITEM: OrderItem = {
  product_name: "",
  description: "",
  quantity: 1,
  unit_price: "",
};

function toFormItem(item: DefaultItem): OrderItem {
  return {
    product_name: item.product_name,
    description: item.description ?? "",
    quantity: item.quantity,
    unit_price: String(item.unit_price),
  };
}

export function OrderItemsInput({ taxRate, defaultItems }: Props) {
  const [items, setItems] = useState<OrderItem[]>(
    defaultItems && defaultItems.length > 0
      ? defaultItems.map(toFormItem)
      : [{ ...EMPTY_ITEM }]
  );

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(
    index: number,
    field: keyof OrderItem,
    value: string | number
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i !== index ? item : { ...item, [field]: value }))
    );
  }

  // 税計算ユーティリティ
  function getPrice(item: OrderItem) {
    return parseInt(item.unit_price, 10) || 0;
  }
  function subtotalExcl(item: OrderItem) {
    return item.quantity * getPrice(item);
  }
  function subtotalIncl(item: OrderItem) {
    const excl = subtotalExcl(item);
    return excl + Math.round(excl * taxRate / 100);
  }

  const grandExcl  = items.reduce((sum, item) => sum + subtotalExcl(item), 0);
  const grandTax   = Math.round(grandExcl * taxRate / 100);
  const grandIncl  = grandExcl + grandTax;

  return (
    <div className="space-y-3">
      {/* 商品リスト */}
      {items.map((item, index) => {
        const excl = subtotalExcl(item);
        const incl = subtotalIncl(item);
        const hasPrice = item.unit_price !== "" && getPrice(item) > 0;

        return (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/60"
          >
            {/* 行ヘッダー */}
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

            {/* 注文時点の税率をサーバーへ送信 */}
            <input type="hidden" name="item_tax_rate" value={taxRate} />

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

            {/* 説明 */}
            <div>
              <label className="label">
                内容・アレンジの説明
                <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
              </label>
              <input
                type="text"
                name="item_description"
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder="例: 白バラ中心のラウンドブーケ、リボン付き"
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
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value, 10) || 1)}
                  min={1}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  単価（税抜・円） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="item_unit_price"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                  min={0}
                  required
                  placeholder="例: 5000"
                  className="input"
                />
              </div>
              <div>
                <p className="label text-gray-400">小計（税込）</p>
                <p className="py-2 px-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-md">
                  {hasPrice
                    ? `¥${incl.toLocaleString("ja-JP")}`
                    : <span className="text-gray-400 font-normal text-xs">単価を入力</span>
                  }
                </p>
                {hasPrice && excl !== incl && (
                  <p className="text-xs text-gray-400 mt-0.5 text-right">
                    税抜 ¥{excl.toLocaleString("ja-JP")}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* 商品追加ボタン */}
      <button
        type="button"
        onClick={addItem}
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
      >
        ＋ 商品を追加する
      </button>

      {/* 金額サマリー */}
      <div className="rounded-lg border border-brand-200 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white">
          <span className="text-gray-600">小計（税抜）</span>
          <span className="text-gray-700">¥{grandExcl.toLocaleString("ja-JP")}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white border-t border-brand-100">
          <span className="text-gray-600">消費税（{taxRate}%）</span>
          <span className="text-gray-700">¥{grandTax.toLocaleString("ja-JP")}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3 bg-brand-50 border-t border-brand-200">
          <span className="text-sm font-semibold text-gray-700">合計（税込）</span>
          <span className="text-lg font-bold text-brand-700">
            ¥{grandIncl.toLocaleString("ja-JP")}
          </span>
        </div>
      </div>
    </div>
  );
}
