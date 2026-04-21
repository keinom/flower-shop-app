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
  | "キャンセル"
  | "履歴";

export type ShiftPreferenceType = "available" | "off";
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
          postal_code: string | null;
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
          postal_code?: string | null;
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
          postal_code?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          status: OrderStatus;
          order_type: OrderType;
          delivery_name: string;
          delivery_postal_code: string | null;
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
          delivery_postal_code?: string | null;
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
          delivery_postal_code?: string | null;
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
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_recurring_template_id_fkey";
            columns: ["recurring_template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_order_templates";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "recurring_order_templates_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "recurring_order_template_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_order_templates";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "order_status_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_logs_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      shift_requirements: {
        Row: {
          day_of_week: number;
          am_required: number;
          pm_required: number;
          am_start: string;
          am_end: string;
          pm_start: string;
          pm_end: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          day_of_week: number;
          am_required?: number;
          pm_required?: number;
          am_start?: string;
          am_end?: string;
          pm_start?: string;
          pm_end?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          day_of_week?: number;
          am_required?: number;
          pm_required?: number;
          am_start?: string;
          am_end?: string;
          pm_start?: string;
          pm_end?: string;
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
          start_time: string | null;
          end_time: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          preference_date: string;
          preference_type: ShiftPreferenceType;
          start_time?: string | null;
          end_time?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          preference_date?: string;
          preference_type?: ShiftPreferenceType;
          start_time?: string | null;
          end_time?: string | null;
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
          start_time: string | null;
          end_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_date: string;
          time_slot: ShiftTimeSlot;
          status?: ShiftStatus;
          start_time?: string | null;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          shift_date?: string;
          time_slot?: ShiftTimeSlot;
          status?: ShiftStatus;
          start_time?: string | null;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string;
          invoice_type: "single" | "monthly";
          target_year_month: string | null;
          status: "draft" | "issued" | "sent" | "paid";
          subtotal: number;
          tax_amount: number;
          total_amount: number;
          issued_at: string | null;
          sent_at: string | null;
          due_date: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          customer_id: string;
          invoice_type: "single" | "monthly";
          target_year_month?: string | null;
          status?: "draft" | "issued" | "sent" | "paid";
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          issued_at?: string | null;
          sent_at?: string | null;
          due_date?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          customer_id?: string;
          invoice_type?: "single" | "monthly";
          target_year_month?: string | null;
          status?: "draft" | "issued" | "sent" | "paid";
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          issued_at?: string | null;
          sent_at?: string | null;
          due_date?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          order_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          order_id?: string | null;
          description: string;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          order_id?: string | null;
          description?: string;
          quantity?: number;
          unit_price?: number;
          tax_rate?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
      fuda_documents: {
        Row: {
          id: string;
          file_name: string;
          storage_path: string;
          occasion: string | null;
          recipient: string | null;
          sender: string | null;
          all_text: string | null;
          ocr_raw: Record<string, unknown> | null;
          ocr_confidence: "high" | "medium" | "low" | null;
          ocr_done: boolean;
          ocr_error: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          storage_path: string;
          occasion?: string | null;
          recipient?: string | null;
          sender?: string | null;
          all_text?: string | null;
          ocr_raw?: Record<string, unknown> | null;
          ocr_confidence?: "high" | "medium" | "low" | null;
          ocr_done?: boolean;
          ocr_error?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          storage_path?: string;
          occasion?: string | null;
          recipient?: string | null;
          sender?: string | null;
          all_text?: string | null;
          ocr_raw?: Record<string, unknown> | null;
          ocr_confidence?: "high" | "medium" | "low" | null;
          ocr_done?: boolean;
          ocr_error?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fuda_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
