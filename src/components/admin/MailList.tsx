"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateMailStatus } from "@/app/admin/mail/actions";
import { INBOUND_EMAIL_STATUSES, INBOUND_EMAIL_STATUS_COLORS } from "@/lib/constants";
import type { InboundEmailStatus } from "@/types";

export interface MailListRow {
  id: string;
  receivedLabel: string;
  senderLabel: string;
  senderAddress: string;
  customerName: string | null;
  subject: string;
  snippet: string;
  hasAttachment: boolean;
  status: InboundEmailStatus;
  assigneeName: string | null;
}

interface Props {
  rows: MailListRow[];
  /** 詳細から一覧に戻るための現在の検索条件（status / q / page） */
  fromQuery: string;
}

export function MailList({ rows, fromQuery }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<InboundEmailStatus>("対応済み");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const apply = () => {
    setError(null);
    setNotice(null);
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateMailStatus(ids, bulkStatus);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`${res.count ?? ids.length} 件を「${bulkStatus}」にしました`);
      setSelected(new Set());
      router.refresh();
    });
  };

  const detailHref = (id: string) =>
    `/admin/mail/${id}${fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : ""}`;

  return (
    <div className="space-y-3">
      {/* 一括操作バー */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 accent-[var(--color-brand-600)]"
            aria-label="このページのメールをすべて選択"
          />
          <span className="text-gray-600">このページをすべて選択</span>
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-3">
            <span className="font-semibold text-brand-700">{selected.size} 件選択中</span>
            <select
              className="input !w-auto !py-1.5"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as InboundEmailStatus)}
              aria-label="変更後のステータス"
            >
              {INBOUND_EMAIL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="button" className="btn-primary !py-1.5" onClick={apply} disabled={isPending}>
              {isPending ? "更新中…" : "選択したメールのステータスを変更"}
            </button>
          </div>
        )}
        {notice && <span className="text-brand-700">{notice}</span>}
        {error && <span className="text-red-600" role="alert">{error}</span>}
      </div>

      {/* 一覧（モバイルでも横スクロールが出ないよう、テーブルではなく行カードで構成） */}
      <ul className="card divide-y divide-gray-100 overflow-hidden">
        {rows.map((r) => {
          const colors = INBOUND_EMAIL_STATUS_COLORS[r.status];
          return (
            <li
              key={r.id}
              className={`flex items-start gap-3 px-3 py-3 sm:px-4 hover:bg-brand-50 transition-colors ${
                r.status === "未対応" ? "bg-white" : "bg-gray-50/40"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="mt-1 w-4 h-4 flex-shrink-0 accent-[var(--color-brand-600)]"
                aria-label={`${r.subject || "(件名なし)"} を選択`}
              />
              <Link href={detailHref(r.id)} className="flex-1 min-w-0 block">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  <span className={`font-semibold truncate max-w-full ${r.status === "未対応" ? "text-gray-900" : "text-gray-700"}`}>
                    {r.senderLabel}
                  </span>
                  {r.customerName && (
                    <span className="px-1.5 py-0.5 rounded bg-brand-100 text-brand-800 font-medium">
                      {r.customerName}
                    </span>
                  )}
                  <span className="text-gray-400 truncate">&lt;{r.senderAddress}&gt;</span>
                </div>
                <p className={`mt-0.5 text-sm break-words ${r.status === "未対応" ? "font-semibold text-gray-900" : "text-gray-800"}`}>
                  {r.hasAttachment && <span title="添付あり" aria-label="添付あり">📎 </span>}
                  {r.subject || "(件名なし)"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 line-clamp-1 break-all">{r.snippet}</p>
              </Link>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                <span className="text-xs text-gray-500 whitespace-nowrap">{r.receivedLabel}</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {r.status}
                </span>
                <span className="text-xs text-gray-400 max-w-[7rem] truncate">
                  {r.assigneeName ? `担当: ${r.assigneeName}` : "担当者なし"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
