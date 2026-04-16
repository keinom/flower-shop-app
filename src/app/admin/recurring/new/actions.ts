"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderType } from "@/types";

export async function createRecurringTemplate(formData: FormData) {
  const supabase = await createClient();

  const title = (formData.get("title") as string)?.trim();
  const customerId = formData.get("customer_id") as string;

  if (!title) {
    redirect("/admin/recurring/new?error=" + encodeURIComponent("管理名称を入力してください"));
  }
  if (!customerId) {
    redirect("/admin/recurring/new?error=" + encodeURIComponent("顧客を選択してください"));
  }

  // Recurrence rule
  const recurrenceType = formData.get("recurrence_type") as "weekly" | "monthly_date" | "monthly_weekday" | "interval";
  const weeklyDaysRaw = formData.get("weekly_days") as string;
  const weeklyDays = weeklyDaysRaw ? JSON.parse(weeklyDaysRaw) : null;
  const monthlyDay = formData.get("monthly_day") ? parseInt(formData.get("monthly_day") as string) : null;
  const monthlyWeek = formData.get("monthly_week") ? parseInt(formData.get("monthly_week") as string) : null;
  const monthlyWeekday = formData.get("monthly_weekday") ? parseInt(formData.get("monthly_weekday") as string) : null;
  const intervalDays = formData.get("interval_days") ? parseInt(formData.get("interval_days") as string) : null;
  const startDate = formData.get("start_date") as string;
  const endDateRaw = formData.get("end_date") as string;
  const endDate = endDateRaw || null;

  // Order info
  const orderType = ((formData.get("order_type") as string) || "配達") as OrderType;
  const deliveryName = (formData.get("delivery_name") as string)?.trim();
  const deliveryAddress = (formData.get("delivery_address") as string)?.trim() || null;
  const deliveryPhone = (formData.get("delivery_phone") as string)?.trim() || null;
  const deliveryEmail = (formData.get("delivery_email") as string)?.trim() || null;
  const deliveryTimeStart = (formData.get("delivery_time_start") as string) || null;
  const deliveryTimeEnd = (formData.get("delivery_time_end") as string) || null;
  const purpose = (formData.get("purpose") as string)?.trim() || null;
  const messageCard = (formData.get("message_card") as string)?.trim() || null;
  const remarks = (formData.get("remarks") as string)?.trim() || null;

  if (!deliveryName) {
    redirect("/admin/recurring/new?error=" + encodeURIComponent("お届け先名を入力してください"));
  }

  // Insert template
  const { data: template, error: tmplErr } = await supabase
    .from("recurring_order_templates")
    .insert({
      customer_id: customerId,
      title,
      recurrence_type: recurrenceType,
      weekly_days: recurrenceType === "weekly" ? weeklyDays : null,
      monthly_day: recurrenceType === "monthly_date" ? monthlyDay : null,
      monthly_week: recurrenceType === "monthly_weekday" ? monthlyWeek : null,
      monthly_weekday: recurrenceType === "monthly_weekday" ? monthlyWeekday : null,
      interval_days: recurrenceType === "interval" ? intervalDays : null,
      start_date: startDate,
      end_date: endDate,
      order_type: orderType,
      delivery_name: deliveryName,
      delivery_address: deliveryAddress,
      delivery_phone: deliveryPhone,
      delivery_email: deliveryEmail,
      delivery_time_start: deliveryTimeStart,
      delivery_time_end: deliveryTimeEnd,
      purpose,
      message_card: messageCard,
      remarks,
    })
    .select("id")
    .single();

  if (tmplErr || !template) {
    redirect("/admin/recurring/new?error=" + encodeURIComponent("テンプレートの作成に失敗しました: " + (tmplErr?.message ?? "")));
  }

  // Insert order items
  const productNames = formData.getAll("item_product_name") as string[];
  const descriptions = formData.getAll("item_description") as string[];
  const quantities = formData.getAll("item_quantity") as string[];
  const unitPrices = formData.getAll("item_unit_price") as string[];
  const taxRates = formData.getAll("item_tax_rate") as string[];

  if (productNames.length > 0) {
    const items = productNames.map((name, i) => ({
      template_id: template.id,
      product_name: name,
      description: descriptions[i] || null,
      quantity: parseInt(quantities[i]) || 1,
      unit_price: parseInt(unitPrices[i]) || 0,
      tax_rate: parseFloat(taxRates[i]) || 10,
      sort_order: i,
    }));

    await supabase.from("recurring_order_template_items").insert(items);
  }

  redirect(`/admin/recurring/${template.id}`);
}
