/**
 * Supabase データベース型定義
 * テーブル構造の変更時はこのファイルも更新すること
 */

export type UserRole = "admin" | "employee" | "customer";

export type OrderType = "来店" | "配達" | "発送" | "生け込み";

export type OrderStatus =
  | "受付"
  | "受付完了"
  | "作成中"
  | "ラッピング中"
  | "配達準備完了"
  | "配達中"
  | "配達完了"
  | "キャンセル";

export type ShiftPreferenceType = "full" | "am" | "pm" | "off";
export type ShiftTimeSlot       = "AM" | "PM" | "FULL";
export type ShiftStatus         = "draft" | "confirmed";

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
          order_type: OrderType;
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
          recurring_template_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: OrderStatus;
          order_type?: OrderType;
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
          recurring_template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          status?: OrderStatus;
          order_type?: OrderType;
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
          recurring_template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_order_templates: {
        Row: {
          id: string;
          customer_id: string;
          title: string;
          recurrence_type: "weekly" | "monthly_date" | "monthly_weekday" | "interval";
          weekly_days: number[] | null;
          monthly_day: number | null;
          monthly_week: number | null;
          monthly_weekday: number | null;
          interval_days: number | null;
          start_date: string;
          end_date: string | null;
          order_type: OrderType;
          delivery_name: string;
          delivery_address: string | null;
          delivery_phone: string | null;
          delivery_email: string | null;
          delivery_time_start: string | null;
          delivery_time_end: string | null;
          purpose: string | null;
          message_card: string | null;
          remarks: string | null;
          is_active: boolean;
          last_generated_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          title: string;
          recurrence_type: "weekly" | "monthly_date" | "monthly_weekday" | "interval";
          weekly_days?: number[] | null;
          monthly_day?: number | null;
          monthly_week?: number | null;
          monthly_weekday?: number | null;
          interval_days?: number | null;
          start_date: string;
          end_date?: string | null;
          order_type?: OrderType;
          delivery_name: string;
          delivery_address?: string | null;
          delivery_phone?: string | null;
          delivery_email?: string | null;
          delivery_time_start?: string | null;
          delivery_time_end?: string | null;
          purpose?: string | null;
          message_card?: string | null;
          remarks?: string | null;
          is_active?: boolean;
          last_generated_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          title?: string;
          recurrence_type?: "weekly" | "monthly_date" | "monthly_weekday" | "interval";
          weekly_days?: number[] | null;
          monthly_day?: number | null;
          monthly_week?: number | null;
          monthly_weekday?: number | null;
          interval_days?: number | null;
          start_date?: string;
          end_date?: string | null;
          order_type?: OrderType;
          delivery_name?: string;
          delivery_address?: string | null;
          delivery_phone?: string | null;
          delivery_email?: string | null;
          delivery_time_start?: string | null;
          delivery_time_end?: string | null;
          purpose?: string | null;
          message_card?: string | null;
          remarks?: string | null;
          is_active?: boolean;
          last_generated_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recurring_order_template_items: {
        Row: {
          id: string;
          template_id: string;
          product_name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          product_name: string;
          description?: string | null;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          product_name?: string;
          description?: string | null;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number;
          sort_order?: number;
          created_at?: string;
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
      shift_requirements: {
        Row: {
          day_of_week: number;
          am_required: number;
          pm_required: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          day_of_week: number;
          am_required?: number;
          pm_required?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          day_of_week?: number;
          am_required?: number;
          pm_required?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      shift_preferences: {
        Row: {
          id: string;
          employee_id: string;
          preference_date: string;
          preference_type: ShiftPreferenceType;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          preference_date: string;
          preference_type: ShiftPreferenceType;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          preference_date?: string;
          preference_type?: ShiftPreferenceType;
          updated_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          employee_id: string;
          shift_date: string;
          time_slot: ShiftTimeSlot;
          status: ShiftStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_date: string;
          time_slot: ShiftTimeSlot;
          status?: ShiftStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          shift_date?: string;
          time_slot?: ShiftTimeSlot;
          status?: ShiftStatus;
          created_at?: string;
          updated_at?: string;
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
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
