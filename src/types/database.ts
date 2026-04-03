/**
 * Supabase データベース型定義
 * テーブル構造の変更時はこのファイルも更新すること
 */

export type UserRole = "admin" | "customer";

export type OrderStatus =
  | "受付"
  | "受付完了"
  | "作成中"
  | "ラッピング中"
  | "配達準備完了"
  | "配達中"
  | "配達完了"
  | "キャンセル";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          profile_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          status: OrderStatus;
          delivery_name: string;
          delivery_address: string | null;
          delivery_date: string | null;
          delivery_time_start: string | null;
          delivery_time_end: string | null;
          delivery_phone: string | null;
          delivery_email: string | null;
          product_name: string | null;
          quantity: number;
          purpose: string | null;
          message_card: string | null;
          remarks: string | null;
          total_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: OrderStatus;
          delivery_name: string;
          delivery_address?: string | null;
          delivery_date?: string | null;
          delivery_time_start?: string | null;
          delivery_time_end?: string | null;
          delivery_phone?: string | null;
          delivery_email?: string | null;
          product_name?: string | null;
          quantity: number;
          purpose?: string | null;
          message_card?: string | null;
          remarks?: string | null;
          total_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          status?: OrderStatus;
          delivery_name?: string;
          delivery_address?: string | null;
          delivery_date?: string | null;
          delivery_time_start?: string | null;
          delivery_time_end?: string | null;
          delivery_phone?: string | null;
          delivery_email?: string | null;
          product_name?: string | null;
          quantity?: number;
          purpose?: string | null;
          message_card?: string | null;
          remarks?: string | null;
          total_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_name: string;
          description?: string | null;
          quantity: number;
          unit_price: number;
          tax_rate?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_name?: string;
          description?: string | null;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      tax_settings: {
        Row: {
          id: string;
          rate: number;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rate: number;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rate?: number;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_status_logs: {
        Row: {
          id: string;
          order_id: string;
          old_status: OrderStatus | null;
          new_status: OrderStatus;
          changed_by: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          old_status?: OrderStatus | null;
          new_status: OrderStatus;
          changed_by: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          old_status?: OrderStatus | null;
          new_status?: OrderStatus;
          changed_by?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
