import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateInvoiceStatus } from "./actions";
import { DeleteInvoiceButton } from "@/components/admin/DeleteInvoiceButton";

type InvoiceStatus = "draft" | "issued" | "sent" | "paid";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:  "下書き",
  issued: "発行済み",
  sent:   "送付済み",
  paid:   "入金済み",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:  "bg-gray-100 text-gray-600 border-gray-200",
  issued: "bg-blue-100 text-blue-700 border-blue-200",
  sent:   "bg-amber-100 text-amber-700 border-amber-200",
  paid:   "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// 次のステータスへの遷移定義
const NEXT_STATUS: Partial<Record<InvoiceStatus, { status: InvoiceStatus; label: string; color: string }>> = {
  draft:  { status: "issued", label: "発行する",  color: "bg-blue-600 hover:bg-blue-700 text-white" },
  issued: { status: "sent",   label: "送付済みにする", color: "bg-amber-500 hover:bg-amber-600 text-white" },
  sent:   { status: "paid",   label: "入金済みにする", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; success?: string; error?: string }>;
}

export default async function InvoiceDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices" as never)
    .select("*, customers(id, name, phone, email, address)")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const inv = invoice as {
    id: string; invoice_number: string; invoice_type: string;
    target_year_month: string | null; status: InvoiceStatus;
    subtotal: number; tax_amount: number; total_amount: number;
    issued_at: string | null; sent_at: string | null; due_date: string | null;
    remarks: string | null; created_at: string;
    customers: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null;
  };

  const { data: items } = await supabase
    .from("invoice_items" as never)
    .select("id, description, quantity, unit_price, tax_rate, order_id")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  type ItemRow = { id: string; description: string; quantity: number; unit_price: number; tax_rate: number; order_id: string | null };
  const invoiceItems = (items ?? []) as unknown as ItemRow[];

  const nextStep = NEXT_STATUS[inv.status];
  const TYPE_LABELS: Record<string, string> = { single: "個別請求", monthly: "月別まとめ請求" };

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/invoices" className="text-sm text-gray-500 hover:text-gray-700">
          ← 請求書一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{inv.invoice_number}</h1>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[inv.status]}`}>
          {STATUS_LABELS[inv.status]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/invoices/${id}/print`}
            target="_blank"
            className="text-xs font-medium px-3 py-1.5 rounded-md border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 transition-colors"
          >
            🖨 印刷・PDF
          </Link>
        </div>
      </div>

      {/* アラート */}
      {sp.created && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">請求書を作成しました</div>}
      {sp.success && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">{decodeURIComponent(sp.success)}</div>}
      {sp.error   && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{decodeURIComponent(sp.error)}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_256px] gap-5 items-start">
        {/* ── 左: メインコンテンツ ── */}
        <div className="space-y-5">
          {/* 基本情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">請求先</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">顧客名</dt>
                  <dd className="mt-0.5 font-medium">
                    {inv.customers ? (
                      <Link href={`/admin/customers/${inv.customers.id}`} className="text-brand-700 hover:underline">
                        {inv.customers.name}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                {inv.customers?.address && (
                  <div>
                    <dt className="text-xs text-gray-500">住所</dt>
                    <dd className="mt-0.5 text-gray-700">{inv.customers.address}</dd>
                  </div>
                )}
                {inv.customers?.phone && (
                  <div>
                    <dt className="text-xs text-gray-500">電話番号</dt>
                    <dd className="mt-0.5 text-gray-700">{inv.customers.phone}</dd>
                  </div>
                )}
                {inv.customers?.email && (
                  <div>
                    <dt className="text-xs text-gray-500">メール</dt>
                    <dd className="mt-0.5 text-gray-700">{inv.customers.email}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">請求情報</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">種別</dt>
                  <dd className="mt-0.5">{TYPE_LABELS[inv.invoice_type] ?? inv.invoice_type}
                    {inv.target_year_month && <span className="text-gray-500 ml-1">（{inv.target_year_month}）</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">作成日</dt>
                  <dd className="mt-0.5">{new Date(inv.created_at).toLocaleDateString("ja-JP")}</dd>
                </div>
                {inv.issued_at && (
                  <div>
                    <dt className="text-xs text-gray-500">発行日</dt>
                    <dd className="mt-0.5">{new Date(inv.issued_at).toLocaleDateString("ja-JP")}</dd>
                  </div>
                )}
                {inv.sent_at && (
                  <div>
                    <dt className="text-xs text-gray-500">送付日</dt>
                    <dd className="mt-0.5">{new Date(inv.sent_at).toLocaleDateString("ja-JP")}</dd>
                  </div>
                )}
                {inv.due_date && (
                  <div>
                    <dt className="text-xs text-gray-500">支払期限</dt>
                    <dd className={`mt-0.5 font-semibold ${new Date(inv.due_date) < new Date() && inv.status !== "paid" ? "text-red-600" : ""}`}>
                      {new Date(inv.due_date).toLocaleDateString("ja-JP")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* 明細 */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">明細</h2>
            <div className="table-container">
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th className="th">品名</th>
                    <th className="th text-right">数量</th>
                    <th className="th text-right">単価（税抜）</th>
                    <th className="th text-right">金額（税込）</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoiceItems.map((item) => {
                    const excl = (item.quantity ?? 0) * (item.unit_price ?? 0);
                    const tax  = Math.round(excl * (item.tax_rate ?? 10) / 100);
                    return (
                      <tr key={item.id}>
                        <td className="td font-medium">{item.description ?? "—"}</td>
                        <td className="td text-right">{item.quantity ?? 0}</td>
                        <td className="td text-right">¥{(item.unit_price ?? 0).toLocaleString("ja-JP")}</td>
                        <td className="td text-right font-medium">¥{(excl + tax).toLocaleString("ja-JP")}</td>
                        <td className="td text-right">
                          {item.order_id && (
                            <Link href={`/admin/orders/${item.order_id}`} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                              注文 →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-end gap-8 text-gray-600">
                <span>小計（税抜）</span>
                <span>¥{(inv.subtotal ?? 0).toLocaleString("ja-JP")}</span>
              </div>
              <div className="flex justify-end gap-8 text-gray-600">
                <span>消費税（10%）</span>
                <span>¥{(inv.tax_amount ?? 0).toLocaleString("ja-JP")}</span>
              </div>
              <div className="flex justify-end gap-8 font-bold text-base text-brand-700 pt-1 border-t">
                <span>合計（税込）</span>
                <span>¥{(inv.total_amount ?? 0).toLocaleString("ja-JP")}</span>
              </div>
            </div>
          </div>

          {/* 備考 */}
          {inv.remarks && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-3">備考</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{inv.remarks}</p>
            </div>
          )}
        </div>

        {/* ── 右: サイドバー ── */}
        <div className="sticky top-4 space-y-4">
          {/* ステータス更新 */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">ステータス</h2>
            <div className="flex items-center justify-center py-3 bg-gray-50 rounded-lg">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[inv.status]}`}>
                {STATUS_LABELS[inv.status]}
              </span>
            </div>

            {nextStep && (
              <form action={updateInvoiceStatus}>
                <input type="hidden" name="invoice_id" value={inv.id} />
                <input type="hidden" name="new_status"  value={nextStep.status} />
                <button type="submit" className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${nextStep.color}`}>
                  {nextStep.label}
                </button>
              </form>
            )}

            {inv.status === "paid" && (
              <p className="text-xs text-center text-emerald-600 font-medium">✓ 入金確認済み</p>
            )}
          </div>

          {/* 下書き削除 */}
          {inv.status === "draft" && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">削除</h2>
              <DeleteInvoiceButton invoiceId={inv.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
