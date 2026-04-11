import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const results: Record<string, unknown> = {};

  // invoicesテーブルの存在確認
  const { data: invData, error: invErr } = await supabase
    .from("invoices" as never)
    .select("id")
    .limit(1);
  results.invoices_table = invErr ? { error: invErr.message, code: invErr.code } : { ok: true, count: invData?.length };

  // invoice_itemsテーブルの存在確認
  const { data: itemData, error: itemErr } = await supabase
    .from("invoice_items" as never)
    .select("id")
    .limit(1);
  results.invoice_items_table = itemErr ? { error: itemErr.message, code: itemErr.code } : { ok: true, count: itemData?.length };

  // invoicesに1件insertしてみる（テスト用、すぐ削除）
  const { data: testInsert, error: insertErr } = await supabase
    .from("invoices" as never)
    .insert({
      invoice_number:    "TEST-000",
      customer_id:       "00000000-0000-0000-0000-000000000000",
      invoice_type:      "single",
      target_year_month: null,
      subtotal:          0,
      tax_amount:        0,
      total_amount:      0,
      status:            "draft",
      due_date:          null,
      remarks:           null,
    } as never)
    .select("id")
    .single();

  if (insertErr) {
    results.insert_test = { error: insertErr.message, code: insertErr.code };
  } else {
    // テストデータを削除
    const testId = (testInsert as { id: string }).id;
    await supabase.from("invoices" as never).delete().eq("id", testId);
    results.insert_test = { ok: true, created_id: testId };
  }

  return NextResponse.json(results, { status: 200 });
}
