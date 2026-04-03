import type { OrderStatus } from "@/types";

/**
 * 注文ステータス定義
 */
export const ORDER_STATUSES: OrderStatus[] = [
  "受付",
  "制作中",
  "配達準備中",
  "配達済み",
  "完了",
  "キャンセル",
];

/**
 * ステータスに対応するバッジの色（Tailwind クラス）
 */
export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string }
> = {
  受付: { bg: "bg-blue-100", text: "text-blue-800" },
  制作中: { bg: "bg-yellow-100", text: "text-yellow-800" },
  配達準備中: { bg: "bg-orange-100", text: "text-orange-800" },
  配達済み: { bg: "bg-purple-100", text: "text-purple-800" },
  完了: { bg: "bg-green-100", text: "text-green-800" },
  キャンセル: { bg: "bg-gray-100", text: "text-gray-600" },
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
