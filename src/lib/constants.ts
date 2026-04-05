import type { OrderStatus } from "@/types";

/**
 * 注文ステータス定義
 */
export const ORDER_STATUSES: OrderStatus[] = [
  "受付",
  "受付完了",
  "作成中",
  "ラッピング中",
  "配達準備完了",
  "配達中",
  "配達完了",
  "キャンセル",
];

/**
 * ステータスに対応するバッジの色（Tailwind クラス）
 */
export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border?: string }
> = {
  受付:         { bg: "bg-sky-100",     text: "text-sky-800",    border: "border-sky-200"    },
  受付完了:     { bg: "bg-blue-100",    text: "text-blue-800",   border: "border-blue-200"   },
  作成中:       { bg: "bg-yellow-100",  text: "text-yellow-800", border: "border-yellow-200" },
  ラッピング中: { bg: "bg-amber-100",   text: "text-amber-800",  border: "border-amber-200"  },
  配達準備完了: { bg: "bg-orange-100",  text: "text-orange-800", border: "border-orange-200" },
  配達中:       { bg: "bg-violet-100",  text: "text-violet-800", border: "border-violet-200" },
  配達完了:     { bg: "bg-emerald-100", text: "text-emerald-800",border: "border-emerald-200"},
  キャンセル:   { bg: "bg-gray-100",    text: "text-gray-500",   border: "border-gray-200"   },
};

/**
 * 注文用途の選択肢（よく使われるもの）
 */
export const ORDER_PURPOSES = [
  "開店祝い",
  "開業祝い",
  "誕生日",
  "結婚祝い",
  "記念日",
  "お見舞い",
  "お悔やみ",
  "お礼",
  "季節のお飾り",
  "その他",
] as const;

/**
 * ページネーション設定
 */
export const PAGE_SIZE = 20;
