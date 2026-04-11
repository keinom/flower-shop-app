import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

const TYPE_LABELS: Record<string, string> = {
  single:  "個別",
  monthly: "月別まとめ",
};

interface SearchParams {
  status?: string;
  q?: string;
  searched?: string;
}

interface InvoicesPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices" as never)
    .select("id, invoice_number, invoice_type, status, total_amount, issued_at, sent_at, due_date, target_year_month, created_at, customers(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (sp.status) {
    query = query.eq("status", sp.status);
  }

  const { data, error } = await query;

  type InvoiceRow = {
    id: string;
    invoice_number: string;
    invoice_type: string;
    status: InvoiceStatus;
    total_amount: number;
    issued_at: string | null;
    sent_at: string | null;
    due_date: string | null;
    target_year_month: string | null;
    created_at: string;
    customers: { id: string; name: string } | null;
  };

  const invoices = (data ?? []) as unknown as InvoiceRow[];

  // ステータス別件数
  const counts = (["draft", "issued", "sent", "paid"] as InvoiceStatus[]).reduce(
    (acc, s) => { acc[s] = invoices.filter(i => i.status === s).length; return acc; },
    {} as Record<InvoiceStatus, number>
  );

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">請求書</h1>
          <p className="text-xs text-gray-400 mt-0.5">振込請求の管理・発行</p>
        </div>
        <Link href="/admin/invoices/new" className="btn-primary">
          + 請求書を作成
        </Link>
      </div>

      {/* ステータスフィルタ */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/admin/invoices"
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            !sp.status ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          すべて
        </Link>
        {(["draft", "issued", "sent", "paid"] as InvoiceStatus[]).map((s) => (
          <Link
            key={s}
            href={`/admin/invoices?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              sp.status === s
                ? "bg-gray-800 text-white border-gray-800"
                : `${STATUS_COLORS[s]} hover:opacity-80`
            }`}
          >
            {STATUS_LABELS[s]}
            <span className="ml-1.5 text-xs opacity-70">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          データの取得に失敗しました
        </div>
      )}

      {/* 一覧テーブル */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="th"></th>
              <th className="th">請求書番号</th>
              <th className="th">顧客名</th>
              <th className="th">種別</th>
              <th className="th">ステータス</th>
              <th className="th text-right">金額</th>
              <th className="th">発行日</th>
              <th className="th">支払期限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="td text-center text-gray-400 py-14">
                  {sp.status ? "該当する請求書はありません" : "請求書がまだ作成されていません"}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="tr-hover">
                  <td className="td">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="text-sm text-brand-600 hover:underline font-medium whitespace-nowrap"
                    >
                      詳細
                    </Link>
                  </td>
                  <td className="td font-mono text-sm font-medium">{inv.invoice_number}</td>
                  <td className="td text-sm font-medium">
                    {inv.customers ? (
                      <Link href={`/admin/customers/${inv.customers.id}`} className="text-brand-700 hover:underline">
                        {inv.customers.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="td text-sm text-gray-600">
                    {TYPE_LABELS[inv.invoice_type] ?? inv.invoice_type}
                    {inv.target_year_month && (
                      <span className="ml-1 text-xs text-gray-400">（{inv.target_year_month}）</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="td text-right text-sm font-semibold text-gray-800">
                    ¥{(inv.total_amount ?? 0).toLocaleString("ja-JP")}
                  </td>
                  <td className="td text-sm text-gray-500 whitespace-nowrap">
                    {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("ja-JP") : "—"}
                  </td>
                  <td className="td text-sm text-gray-500 whitespace-nowrap">
                    {inv.due_date
                      ? <span className={new Date(inv.due_date) < new Date() && inv.status !== "paid" ? "text-red-600 font-semibold" : ""}>
                          {new Date(inv.due_date).toLocaleDateString("ja-JP")}
                        </span>
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
