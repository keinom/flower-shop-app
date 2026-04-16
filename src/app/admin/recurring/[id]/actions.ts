"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldGenerateOnDate } from "@/lib/recurring";
import type { RecurrenceRule } from "@/lib/recurring";

export async function toggleTemplateActive(formData: FormData) {
  const templateId = formData.get("template_id") as string;
  const currentActive = formData.get("is_active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_order_templates")
    .update({ is_active: !currentActive })
    .eq("id", templateId);

  if (error) {
    redirect(`/admin/recurring/${templateId}?error=` + encodeURIComponent("ステータスの更新に失敗しました"));
  }

  revalidatePath(`/admin/recurring/${templateId}`);
  revalidatePath("/admin/recurring");
  redirect(`/admin/recurring/${templateId}?success=` + encodeURIComponent(!currentActive ? "テンプレートを有効にしました" : "テンプレートを停止しました"));
}

export async function deleteTemplate(formData: FormData) {
  const templateId = formData.get("template_id") as string;

  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_order_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    redirect(`/admin/recurring/${templateId}?error=` + encodeURIComponent("削除に失敗しました: " + error.message));
  }

  revalidatePath("/admin/recurring");
  redirect("/admin/recurring");
}

export async function runManualGeneration(formData: FormData) {
  const templateId = formData.get("template_id") as string;

  const supabase = createAdminClient();

  const { data: template, error: tmplErr } = await supabase
    .from("recurring_order_templates")
    .select("*, recurring_order_template_items(*)")
    .eq("id", templateId)
    .single();

  if (tmplErr || !template) {
    redirect(`/admin/recurring/${templateId}?error=` + encodeURIComponent("テンプレートの取得に失敗しました"));
  }

  const { data: taxSetting } = await supabase
    .from("tax_settings")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const taxRate = taxSetting?.rate ?? 10;

  const rule: RecurrenceRule = {
    recurrence_type: template.recurrence_type as RecurrenceRule['recurrence_type'],
    weekly_days: template.weekly_days,
    monthly_day: template.monthly_day,
    monthly_week: template.monthly_week,
    monthly_weekday: template.monthly_weekday,
    interval_days: template.interval_days,
    start_date: template.start_date,
    end_date: template.end_date,
  };

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jstNow.toISOString().split('T')[0];

  const generated: string[] = [];
  const errors: string[] = [];

  for (let offset = 0; offset < 30; offset++) {
    const jstDate = new Date(jstNow);
    jstDate.setDate(jstDate.getDate() + offset);
    const targetDateStr = jstDate.toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr + 'T00:00:00');

    if (!shouldGenerateOnDate(rule, targetDate)) continue;

    // Check duplicate
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('recurring_template_id', template.id)
      .eq('delivery_date', targetDateStr)
      .maybeSingle();

    if (existing) continue;

    const items = (template.recurring_order_template_items ?? []) as Array<{
      product_name: string; description: string | null;
      quantity: number; unit_price: number; tax_rate: number;
    }>;

    const totalExcl = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const totalAmount = totalExcl + Math.round(totalExcl * taxRate / 100);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const summaryName = items.length === 1 ? items[0].product_name : null;

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        customer_id: template.customer_id,
        status: '受付',
        order_type: template.order_type,
        recurring_template_id: template.id,
        delivery_name: template.delivery_name,
        delivery_address: template.delivery_address,
        delivery_phone: template.delivery_phone,
        delivery_email: template.delivery_email,
        delivery_date: targetDateStr,
        delivery_time_start: template.delivery_time_start,
        delivery_time_end: template.delivery_time_end,
        purpose: template.purpose,
        message_card: template.message_card,
        remarks: template.remarks,
        product_name: summaryName,
        quantity: Math.max(totalQty, 1),
        total_amount: totalAmount,
      })
      .select('id')
      .single();

    if (oErr || !order) {
      errors.push(`${targetDateStr}: ${oErr?.message}`);
      continue;
    }

    if (items.length > 0) {
      await supabase.from('order_items').insert(
        items.map(item => ({
          order_id: order.id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        }))
      );
    }

    await supabase
      .from('recurring_order_templates')
      .update({ last_generated_date: targetDateStr })
      .eq('id', template.id);

    generated.push(targetDateStr);
  }

  revalidatePath(`/admin/recurring/${templateId}`);
  revalidatePath("/admin/orders");

  if (errors.length > 0) {
    redirect(`/admin/recurring/${templateId}?error=` + encodeURIComponent(`一部エラー: ${errors.join(', ')}`));
  }

  const msg = generated.length > 0
    ? `${generated.length}件の注文を生成しました (${generated.slice(0, 3).join(', ')}${generated.length > 3 ? '...' : ''})`
    : "新たに生成する注文はありませんでした";

  redirect(`/admin/recurring/${templateId}?success=` + encodeURIComponent(msg));
}
