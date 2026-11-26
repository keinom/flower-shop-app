import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { findIdByIdempotencyKey, isUniqueViolation, parseIdempotencyKey } from "@/lib/idempotency";

function generateInvoiceNumber(yearMonth: string, seq: number): string {
  return `INV-${yearMonth.replace("-", "")}-${String(seq).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json() as {
      customerId: string;
      invoiceType: "single" | "monthly";
      targetYearMonth: string | null;
      dueDate: string | null;
      remarks: string | null;
      orderIds: string[];
      idempotencyKey?: string | null;
    };

    const { customerId, invoiceType, targetYearMonth, dueDate, remarks, orderIds } = body;

    // 同じ送信（冪等キー）がすでに処理済みなら、作成済みの請求書を返す（二重作成しない）
    const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
    const doneId = await findIdByIdempotencyKey(supabase, "invoices", idempotencyKey);
    if (doneId) {
      return NextResponse.json({ invoiceId: doneId }, { status: 200 });
    }

    if (!customerId || !invoiceType || !orderIds || orderIds.length === 0) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // ── 注文情報を取得 ──
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, product_name, quantity, total_amount, delivery_date")
      .in("id", orderIds);

    if (ordersError) {
      return NextResponse.json({ error: `注文の取得に失敗: ${ordersError.message}` }, { status: 500 });
    }
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "注文情報が見つかりません" }, { status: 404 });
    }

    // ── order_items を取得 ──
    const { data: orderItemRows } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, unit_price, tax_rate")
      .in("order_id", orderIds);

    // ── 採番 ──
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `INV-${ym.replace("-", "")}-`;

    const { count, error: countError } = await supabase
      .from("invoices" as never)
      .select("id", { count: "exact", head: true })
      .like("invoice_number" as never, `${prefix}%`);

    if (countError) {
      return NextResponse.json({ error: `採番エラー: ${countError.message}` }, { status: 500 });
    }

    const seq = (count ?? 0) + 1;
    const invoiceNumber = generateInvoiceNumber(ym, seq);

    // ── 明細計算 ──
    let subtotal  = 0;
    let taxAmount = 0;

    const invoiceItems: Array<{
      order_id: string;
      description: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
    }> = [];

    for (const order of orders) {
      const typedOrder = order as {
        id: string;
        product_name: string | null;
        quantity: number;
        total_amount: number | null;
      };

      const ois = (orderItemRows ?? []).filter(
        (i) => (i as { order_id: string }).order_id === typedOrder.id
      );

      if (ois.length > 0) {
        for (const oi of ois) {
          const typedOi = oi as {
            order_id: string;
            product_name: string;
            quantity: number;
            unit_price: number;
            tax_rate: number;
          };
          const excl  = typedOi.quantity * typedOi.unit_price;
          const tax   = Math.round(excl * typedOi.tax_rate / 100);
          subtotal   += excl;
          taxAmount  += tax;
          invoiceItems.push({
            order_id:    typedOrder.id,
            description: typedOi.product_name,
            quantity:    typedOi.quantity,
            unit_price:  typedOi.unit_price,
            tax_rate:    typedOi.tax_rate,
          });
        }
      } else {
        const total = typedOrder.total_amount ?? 0;
        const excl  = Math.round(total / 1.1);
        const tax   = total - excl;
        subtotal   += excl;
        taxAmount  += tax;
        invoiceItems.push({
          order_id:    typedOrder.id,
          description: typedOrder.product_name ?? "商品",
          quantity:    typedOrder.quantity ?? 1,
          unit_price:  excl,
          tax_rate:    10,
        });
      }
    }

    const totalAmount = subtotal + taxAmount;

    // ── 請求書レコード作成 ──
    const { data: invoice, error: invError } = await supabase
      .from("invoices" as never)
      .insert({
        invoice_number:    invoiceNumber,
        customer_id:       customerId,
        invoice_type:      invoiceType,
        target_year_month: targetYearMonth || null,
        subtotal,
        tax_amount:        taxAmount,
        total_amount:      totalAmount,
        status:            "draft",
        due_date:          dueDate   || null,
        remarks:           remarks   || null,
        idempotency_key:   idempotencyKey,
      } as never)
      .select("id")
      .single();

    if (invError && isUniqueViolation(invError as { code?: string })) {
      // 並行して同じ送信が先に作成していた場合
      const existing = await findIdByIdempotencyKey(supabase, "invoices", idempotencyKey);
      if (existing) return NextResponse.json({ invoiceId: existing }, { status: 200 });
    }

    if (invError || !invoice) {
      return NextResponse.json(
        { error: `請求書の作成に失敗: ${invError?.message ?? "不明なエラー"}` },
        { status: 500 }
      );
    }

    const invoiceId = (invoice as { id: string }).id;

    // ── 明細レコード作成 ──
    if (invoiceItems.length > 0) {
      const { error: itemsError } = await supabase
        .from("invoice_items" as never)
        .insert(
          invoiceItems.map((item) => ({ ...item, invoice_id: invoiceId } as never))
        );

      if (itemsError) {
        // 請求書本体は作成済みなので invoiceId は返す（明細エラーは警告扱い）
        return NextResponse.json(
          { error: `明細の作成に失敗: ${itemsError.message}`, invoiceId },
          { status: 207 }
        );
      }
    }

    revalidatePath("/admin/invoices");
    return NextResponse.json({ invoiceId }, { status: 201 });

  } catch (e) {
    console.error("[POST /api/invoices/create] error:", e);
    return NextResponse.json(
      { error: `サーバーエラー: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
