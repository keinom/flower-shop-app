import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customer_id") ?? "";
  const type       = req.nextUrl.searchParams.get("type") ?? "single";
  const ym         = req.nextUrl.searchParams.get("ym") ?? ""; // YYYY-MM

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, created_at, delivery_date, product_name, quantity, total_amount, payment_plan, status")
    .eq("customer_id", customerId)
    .eq("payment_status" as never, "代未")
    .not("status", "eq", "キャンセル")
    .in("payment_plan" as never, ["請求書送付", "月末まとめて請求書送付"])
    .order("delivery_date", { ascending: true });

  // 月別の場合は対象月のみ絞り込み
  if (type === "monthly" && ym) {
    const from = `${ym}-01`;
    // 月末日を正確に算出（例: 4月→30日, 2月→28/29日）
    const [y, m] = ym.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // 翌月0日 = 当月末日
    const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("delivery_date", from).lte("delivery_date", to);
  }

  const { data } = await query;
  return NextResponse.json(data ?? []);
}
