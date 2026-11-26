import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffOrRedirect } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { isFixtureMode, isGmailConfigured } from "@/lib/gmail/config";
import { MAIL_PAGE_SIZE } from "@/lib/constants";
import { formatJstDateTime } from "@/lib/date";
import { oneLineName } from "@/lib/name";
import { buildMailQueryString, ilikeOrValue, mailStatusParam, parseMailQuery } from "@/lib/mailQuery";
import { MailSyncBar } from "@/components/admin/MailSyncBar";
import { MailList, type MailListRow } from "@/components/admin/MailList";
import type { InboundEmailAttachment, InboundEmailStatus } from "@/types";

interface MailPageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

type ListRow = {
  id: string;
  received_at: string;
  from_name: string | null;
  from_address: string;
  subject: string;
  snippet: string | null;
  attachments: InboundEmailAttachment[] | null;
  status: InboundEmailStatus;
  customers: { name: string } | null;
  assignee: { display_name: string | null } | null;
};

// 既定（URL に status が無いとき）は「未対応」。「すべて」は status=all
const FILTERS: { label: string; status: InboundEmailStatus | null }[] = [
  { label: "未対応", status: "未対応" },
  { label: "対応中", status: "対応中" },
  { label: "対応済み", status: "対応済み" },
  { label: "すべて", status: null },
];

export default async function MailPage({ searchParams }: MailPageProps) {
  await requireStaffOrRedirect();
  const query = parseMailQuery(await searchParams);
  const supabase = await createClient();
  const configured = isGmailConfigured();

  // ── 同期状態（最終同期・エラー）と一覧は DB の取り込み済みデータのみ。Gmail は待たない ──
  const fromIdx = (query.page - 1) * MAIL_PAGE_SIZE;
  let listQuery = supabase
    .from("inbound_emails")
    .select(
      "id, received_at, from_name, from_address, subject, snippet, attachments, status, customers(name), assignee:profiles!inbound_emails_assigned_to_fkey(display_name)",
      { count: "exact" },
    )
    .order("received_at", { ascending: false })
    .range(fromIdx, fromIdx + MAIL_PAGE_SIZE - 1);
  if (query.status) listQuery = listQuery.eq("status", query.status);
  if (query.q) {
    const v = ilikeOrValue(query.q);
    listQuery = listQuery.or(`subject.ilike.${v},from_name.ilike.${v},from_address.ilike.${v}`);
  }

  const [{ data, count, error }, { data: syncState }] = await Promise.all([
    listQuery,
    supabase
      .from("email_sync_state")
      .select("last_synced_at, last_error")
      .eq("mailbox_key", "primary")
      .maybeSingle(),
  ]);

  // 範囲外のページ（フィルタ変更後など）は 1 ページ目へ
  if (error?.code === "PGRST103" && query.page > 1) {
    const qs = buildMailQueryString({ ...query, page: 1 });
    redirect(`/admin/mail${qs ? `?${qs}` : ""}`);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / MAIL_PAGE_SIZE));
  const rows = ((data ?? []) as unknown as ListRow[]).map<MailListRow>((r) => ({
    id: r.id,
    receivedLabel: formatJstDateTime(r.received_at),
    senderLabel: r.from_name || r.from_address || "(送信者不明)",
    senderAddress: r.from_address,
    customerName: r.customers?.name ? oneLineName(r.customers.name) : null,
    subject: r.subject,
    snippet: r.snippet ?? "",
    hasAttachment: (r.attachments?.length ?? 0) > 0,
    status: r.status,
    assigneeName: r.assignee?.display_name ?? null,
  }));

  const hrefFor = (patch: Partial<typeof query>) => {
    const qs = buildMailQueryString({ ...query, ...patch });
    return `/admin/mail${qs ? `?${qs}` : ""}`;
  };
  const currentQs = buildMailQueryString(query);
  const statusParam = mailStatusParam(query.status);

  return (
    <div className="space-y-5">
      {/* ─── ヘッダー ─── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">受信メール</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          代表アドレス宛のメールを取り込み、対応状況を共有します。対応ステータスはこのシステム内だけの情報で、
          Gmail の既読・ラベルとは連動しません（Gmail で直接返信した場合は、こちらで「対応済み」に変更してください）
        </p>
      </div>

      <MailSyncBar
        configured={configured}
        lastSyncedLabel={syncState?.last_synced_at ? formatJstDateTime(syncState.last_synced_at) : null}
        lastError={syncState?.last_error ?? null}
        fixtureMode={isFixtureMode()}
      />

      {!configured && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          Gmail 連携が未設定です（設定手順は docs/GMAIL_SETUP.md）。
          {total > 0 && "取り込み済みのメールは引き続き表示されます。"}
        </div>
      )}

      {/* ─── フィルタ・検索 ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = f.status === query.status;
            return (
              <Link
                key={f.label}
                href={hrefFor({ status: f.status, page: 1 })}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? "bg-brand-600 text-white border-brand-600 font-semibold"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <form method="get" action="/admin/mail" className="flex gap-2 sm:w-80">
          {statusParam && <input type="hidden" name="status" value={statusParam} />}
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="件名・送信者名・アドレスで検索"
            className="input"
            maxLength={100}
          />
          <button type="submit" className="btn-secondary flex-shrink-0">検索</button>
        </form>
      </div>

      {error && error.code !== "PGRST103" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          データの取得に失敗しました
        </div>
      )}

      {/* ─── 件数 ─── */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-bold text-brand-700 text-lg">{total}</span>
        <span>件</span>
        {query.q && <span className="text-xs text-gray-400">（「{query.q}」で検索中）</span>}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-2">
          <span className="text-4xl">✉️</span>
          <p className="text-sm font-medium">
            {query.q
              ? "条件に一致するメールがありません"
              : query.status === "未対応"
                ? "未対応のメールはありません"
                : query.status
                  ? `「${query.status}」のメールはありません`
                  : "受信メールはまだありません"}
          </p>
        </div>
      ) : (
        <MailList rows={rows} fromQuery={currentQs} />
      )}

      {/* ─── ページング ─── */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="ページ送り">
          {query.page > 1 ? (
            <Link href={hrefFor({ page: query.page - 1 })} className="btn-secondary">← 前へ</Link>
          ) : (
            <span className="btn-secondary opacity-40 pointer-events-none">← 前へ</span>
          )}
          <span className="text-gray-600">
            {query.page} / {totalPages} ページ
          </span>
          {query.page < totalPages ? (
            <Link href={hrefFor({ page: query.page + 1 })} className="btn-secondary">次へ →</Link>
          ) : (
            <span className="btn-secondary opacity-40 pointer-events-none">次へ →</span>
          )}
        </nav>
      )}
    </div>
  );
}
