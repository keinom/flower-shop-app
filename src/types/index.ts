/**
 * アプリ全体で使う型のエクスポート
 */
export type { Database, UserRole, OrderStatus } from "./database";

// テーブルの行型を使いやすいエイリアスとして再エクスポート
import type { Database } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderStatusLog =
  Database["public"]["Tables"]["order_status_logs"]["Row"];

// 顧客情報 + プロフィール情報を結合した型（顧客詳細画面などで使用）
export type CustomerWithProfile = Customer & {
  profiles: Pick<Profile, "display_name"> | null;
};

// 注文 + 顧客名を含む型（注文一覧で使用）
export type OrderWithCustomer = Order & {
  customers: Pick<Customer, "name"> | null;
};
