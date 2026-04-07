import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecurringTemplateEditFormClient } from "./RecurringTemplateEditFormClient";
import type { OrderType } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function RecurringTemplateEditPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  // Load template
  const { data: template, error: templateError } = await supabase
    .from("recurring_order_templates")
    .select("*, customers(id, name, phone, email, address)")
    .eq("id", id)
    .single();

  if (templateError) {
    console.error("[recurring/[id]/edit] template error:", JSON.stringify(templateError));
  }
  if (!template) notFound();

  // Load template items
  const { data: rawItems } = await supabase
    .from("recurring_order_template_items")
    .select("*")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  // Load all customers for the search dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true });

  // Load current tax rate
  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const taxRate = taxSetting?.rate ?? 10;
  const allCustomers = customers ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [];

  const customer = template.customers as {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/recurring/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 詳細に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          定期注文テンプレートを編集
        </h1>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <RecurringTemplateEditFormClient
        templateId={id}
        customers={allCustomers}
        taxRate={taxRate}
        defaultTitle={template.title}
        defaultCustomer={customer}
        defaultRecurrenceType={
          template.recurrence_type as
            | "weekly"
            | "monthly_date"
            | "monthly_weekday"
            | "interval"
        }
        defaultWeeklyDays={template.weekly_days}
        defaultMonthlyDay={template.monthly_day}
        defaultMonthlyWeek={template.monthly_week}
        defaultMonthlyWeekday={template.monthly_weekday}
        defaultIntervalDays={template.interval_days}
        defaultStartDate={template.start_date}
        defaultEndDate={template.end_date}
        defaultOrderType={template.order_type as OrderType}
        defaultDeliveryName={template.delivery_name}
        defaultDeliveryAddress={template.delivery_address}
        defaultDeliveryPhone={template.delivery_phone}
        defaultDeliveryEmail={template.delivery_email}
        defaultDeliveryTimeStart={template.delivery_time_start}
        defaultDeliveryTimeEnd={template.delivery_time_end}
        defaultPurpose={template.purpose}
        defaultMessageCard={template.message_card}
        defaultRemarks={template.remarks}
        defaultItems={items}
      />
    </div>
  );
}
