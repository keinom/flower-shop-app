import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldGenerateOnDate } from "@/lib/recurring";
import type { RecurrenceRule } from "@/lib/recurring";

function getJSTDate(offsetDays = 0): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setDate(jst.getDate() + offsetDays);
  return jst.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets Authorization header automatically)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const generated: string[] = [];
  const errors: string[] = [];

  // Active templates
  const { data: templates, error: tmplErr } = await supabase
    .from('recurring_order_templates')
    .select('*, recurring_order_template_items(*)')
    .eq('is_active', true);

  if (tmplErr || !templates) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  // Current tax rate
  const { data: taxSetting } = await supabase
    .from('tax_settings')
    .select('rate')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  const taxRate = taxSetting?.rate ?? 10;

  // Check 14 days window: today to today+13
  for (let offset = 0; offset < 14; offset++) {
    const targetDateStr = getJSTDate(offset);
    const targetDate = new Date(targetDateStr + 'T00:00:00');

    for (const template of templates) {
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

      if (!shouldGenerateOnDate(rule, targetDate)) continue;

      // Check duplicate
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('recurring_template_id', template.id)
        .eq('delivery_date', targetDateStr)
        .maybeSingle();

      if (existing) continue;

      // Build items
      const items = (template.recurring_order_template_items ?? []) as Array<{
        product_name: string; description: string | null;
        quantity: number; unit_price: number; tax_rate: number;
      }>;

      const totalExcl = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const totalAmount = totalExcl + Math.round(totalExcl * taxRate / 100);
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const summaryName = items.length === 1 ? items[0].product_name : null;

      // Create order
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
        errors.push(`template ${template.id} date ${targetDateStr}: ${oErr?.message}`);
        continue;
      }

      // Create order_items
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

      // Update last_generated_date
      await supabase
        .from('recurring_order_templates')
        .update({ last_generated_date: targetDateStr })
        .eq('id', template.id);

      generated.push(`${template.title} → ${targetDateStr}`);
    }
  }

  return NextResponse.json({ generated, errors, count: generated.length });
}
