import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateInvoiceDetails } from "../actions";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function InvoiceEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices" as never)
    .select("*, customers(id, name)")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const inv = invoice as {
    id: string; invoice_number: string; invoice_type: string;
    target_year_month: string | null;
    subtotal: number; tax_amount: number; total_amount: number;
    due_date: string | null; remarks: string | null; created_at: string;
    customers: { id: string; name: string } | null;
  };

  const { data: items } = await supabase
    .from("invoice_items" as never)
    .select("id, description, quantity, unit_price, tax_rate, order_id")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  type ItemRow = { id: string; description: string; quantity: number; unit_price: number; tax_rate: number; order_id: string | null };
  const invoiceItems = (items ?? []) as unknown as ItemRow[];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/admin/invoices/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← 請求書詳細
        </Link>
        <h1 className="text-xl font-bold text-gray-900">請求書を編集</h1>
        <span className="text-sm text-gray-500">— {inv.invoice_number}</span>
      </div>

      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={updateInvoiceDetails} className="space-y-5">
        <input type="hidden" name="invoice_id" value={inv.id} />

        {/* 請求先（表示のみ） */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-3">請求先</h2>
          <p className="text-sm font-medium text-gray-900">
            {inv.customers?.name ?? "—"}
          </p>
        </div>

        {/* 支払期限・備考 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">基本情報</h2>
          <div>
            <label className="label">支払期限</label>
            <input
              type="date"
              name="due_date"
              defaultValue={inv.due_date ?? ""}
              className="input w-48"
            />
          </div>
          <div>
            <label className="label">
              備考
              <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
            </label>
            <textarea
              name="remarks"
              defaultValue={inv.remarks ?? ""}
              rows={3}
              className="input"
              placeholder="振込先案内など"
            />
          </div>
        </div>

        {/* 明細 */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">明細</h2>
          <div className="space-y-3">
            {invoiceItems.map((item, idx) => {
              const excl = item.quantity * item.unit_price;
              const tax  = Math.round(excl * (item.tax_rate ?? 10) / 100);
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                  <input type="hidden" name="item_id" value={item.id} />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-500">明細 {idx + 1}</span>
                    {item.order_id && (
                      <Link
                        href={`/admin/orders/${item.order_id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        注文 →
                      </Link>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      現在の金額（税込）: ¥{(excl + tax).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div>
                    <label className="label text-xs">品名・内容</label>
                    <input
                      type="text"
                      name="item_description"
                      defaultValue={item.description ?? ""}
                      className="input text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div>
                      <label className="label text-xs">数量</label>
                      <input
                        type="number"
                        name="item_quantity"
                        defaultValue={item.quantity}
                        min={1}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">単価（税抜）</label>
                      <input
                        type="number"
                        name="item_unit_price"
                        defaultValue={item.unit_price}
                        min={0}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">税率（%）</label>
                      <input
                        type="number"
                        name="item_tax_rate"
                        defaultValue={item.tax_rate ?? 10}
                        min={0}
                        max={100}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            ※ 保存すると数量・単価・税率をもとに合計金額が自動再計算されます
          </p>
        </div>

        {/* ボタン */}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary px-8">
            保存する
          </button>
          <Link href={`/admin/invoices/${id}`} className="btn-secondary">
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
