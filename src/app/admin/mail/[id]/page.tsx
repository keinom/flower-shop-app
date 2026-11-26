import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffOrRedirect } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { formatJstDateTime } from "@/lib/date";
import { oneLineName } from "@/lib/name";
import { sanitizeFromParam } from "@/lib/mailQuery";
import { INBOUND_EMAIL_STATUS_COLORS } from "@/lib/constants";
import { htmlToPlainText, prepareHtmlForViewer } from "@/lib/gmail/html";
import { MailBodyViewer } from "@/components/admin/MailBodyViewer";
import { MailMetaEditor } from "@/components/admin/MailMetaEditor";
import { MailAttachmentLink } from "@/components/admin/MailAttachmentLink";
import type { InboundEmail } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function MailDetailPage({ params, searchParams }: Props) {
  await requireStaffOrRedirect();
  const { id } = await params;
  const { from } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: mail } = await supabase.from("inbound_emails").select("*").eq("id", id).maybeSingle();
  if (!mail) notFound();
  const m = mail as InboundEmail;

  // ── 顧客照合（送信元アドレス＝小文字化・trim 済み と customers.email の lower(btrim()) を照合） ──
  // 取り込み後に顧客が登録／メール変更された場合に備え、詳細表示のたびに再照合する。
  const { data: matchRows } = m.from_address
    ? await supabase.rpc("match_customers_by_email", { p_emails: [m.from_address] })
    : { data: [] };
  const matches = (matchRows ?? []) as { customer_id: string; customer_name: string }[];

  let linked: { id: string; name: string } | null = null;
  if (matches.length === 1) {
    linked = { id: matches[0].customer_id, name: matches[0].customer_name };
    if (m.customer_id !== linked.id) {
      // 未紐付けだったメールを 1 件一致で紐付け（失敗しても表示には影響させない）
      await supabase.from("inbound_emails").update({ customer_id: linked.id }).eq("id", m.id);
    }
  } else if (matches.length === 0 && m.customer_id) {
    // 以前の紐付け（アドレス変更などで今は一致しない）。顧客が残っていれば表示のみ
    const { data: c } = await supabase.from("customers").select("id, name").eq("id", m.customer_id).maybeSingle();
    if (c) linked = c;
  }
  // 複数一致は自動確定せず候補を列挙する（matches.length > 1）

  // ── 担当者候補（staff のみ）と現在の担当者 ──
  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("role", ["admin", "employee"])
    .order("display_name");
  const staff = (staffRows ?? []).map((u) => ({ id: u.id, name: u.display_name || "(名称未設定)" }));

  // ステータス最終更新者の名前
  const updaterName = m.status_updated_by
    ? (staff.find((u) => u.id === m.status_updated_by)?.name ?? "（退職・削除済みユーザー）")
    : null;
  const statusUpdatedLabel = m.status_updated_at
    ? `最終更新: ${formatJstDateTime(m.status_updated_at)}${updaterName ? `（${updaterName}）` : ""}`
    : null;

  // ── 本文（HTML は信頼できない入力。サーバーでサニタイズし、表示は sandbox iframe） ──
  const viewer = m.body_html ? prepareHtmlForViewer(m.body_html) : null;
  const text = m.body_text ?? (m.body_html ? htmlToPlainText(m.body_html) : "");

  const backQs = sanitizeFromParam(from);
  const backHref = `/admin/mail${backQs ? `?${backQs}` : ""}`;
  const colors = INBOUND_EMAIL_STATUS_COLORS[m.status];
  const attachments = m.attachments ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ─── ヘッダー ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="text-sm text-brand-600 hover:underline">
          ← 受信メール一覧
        </Link>
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
          {m.status}
        </span>
      </div>

      <div className="card p-5 space-y-3">
        <h1 className="text-lg font-bold text-gray-900 break-words">{m.subject || "(件名なし)"}</h1>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-gray-400">送信者</dt>
          <dd className="break-all">
            <span className="font-medium">{m.from_name || m.from_address}</span>
            {m.from_name && <span className="text-gray-500"> &lt;{m.from_address}&gt;</span>}
          </dd>
          <dt className="text-gray-400">宛先</dt>
          <dd className="break-all">{m.to_addresses || "—"}</dd>
          {m.cc_addresses && (
            <>
              <dt className="text-gray-400">CC</dt>
              <dd className="break-all">{m.cc_addresses}</dd>
            </>
          )}
          <dt className="text-gray-400">受信日時</dt>
          <dd>{formatJstDateTime(m.received_at)}</dd>
        </dl>
      </div>

      {/* ─── 顧客紐付け ─── */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 border-b pb-2">顧客</h2>
        {matches.length > 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              同じメールアドレスの顧客が {matches.length} 件登録されています。対象の顧客を選んで操作してください。
            </p>
            <ul className="divide-y divide-gray-100">
              {matches.map((c) => (
                <li key={c.customer_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                  <span className="font-medium text-sm">{oneLineName(c.customer_name)}</span>
                  <Link href={`/admin/customers/${c.customer_id}`} className="text-sm text-brand-600 hover:underline">
                    顧客詳細
                  </Link>
                  <Link href={`/admin/orders/new?customer_id=${c.customer_id}`} className="btn-primary !py-1 !px-3 text-xs">
                    この顧客で注文登録
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : linked ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href={`/admin/customers/${linked.id}`} className="font-medium text-sm text-brand-700 hover:underline">
              {oneLineName(linked.name)}
            </Link>
            <Link href={`/admin/orders/new?customer_id=${linked.id}`} className="btn-primary !py-1.5 !px-3 text-xs">
              この顧客で注文登録
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-500">未登録の送信者です（送信元アドレスに一致する顧客がいません）</p>
        )}
      </div>

      {/* ─── 本文 ─── */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 border-b pb-2">本文</h2>
        <MailBodyViewer
          sanitizedHtml={viewer?.html ?? null}
          text={text}
          hasRemoteImages={viewer?.hasRemoteImages ?? false}
        />
      </div>

      {/* ─── 添付 ─── */}
      {attachments.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2">添付ファイル（{attachments.length}）</h2>
          <ul className="space-y-2">
            {attachments.map((a, i) => (
              <MailAttachmentLink key={`${a.part_id}-${i}`} mailId={m.id} index={i} filename={a.filename} size={a.size} />
            ))}
          </ul>
        </div>
      )}

      {/* ─── 対応状況（ステータス・担当者・メモ） ─── */}
      <MailMetaEditor
        key={`${m.status}|${m.assigned_to}|${m.updated_at}`}
        id={m.id}
        status={m.status}
        assignedTo={m.assigned_to}
        memo={m.memo ?? ""}
        staff={staff}
        statusUpdatedLabel={statusUpdatedLabel}
      />
    </div>
  );
}
