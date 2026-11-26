"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMailMeta } from "@/app/admin/mail/actions";
import { INBOUND_EMAIL_STATUSES } from "@/lib/constants";
import type { InboundEmailStatus } from "@/types";

interface Props {
  id: string;
  status: InboundEmailStatus;
  assignedTo: string | null;
  memo: string;
  staff: { id: string; name: string }[];
  /** 最終更新の表示用（整形済み） */
  statusUpdatedLabel: string | null;
}

export function MailMetaEditor({ id, status, assignedTo, memo, staff, statusUpdatedLabel }: Props) {
  const router = useRouter();
  const [s, setS] = useState<InboundEmailStatus>(status);
  const [a, setA] = useState<string>(assignedTo ?? "");
  const [m, setM] = useState(memo);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateMailMeta(id, { status: s, assignedTo: a || null, memo: m });
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: "保存しました" });
      router.refresh();
    });
  };

  return (
    <div className="card p-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-700 border-b pb-2">対応状況</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mail-status">ステータス</label>
          <select id="mail-status" className="input" value={s} onChange={(e) => setS(e.target.value as InboundEmailStatus)}>
            {INBOUND_EMAIL_STATUSES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          {statusUpdatedLabel && <p className="text-xs text-gray-400 mt-1">{statusUpdatedLabel}</p>}
        </div>
        <div>
          <label className="label" htmlFor="mail-assignee">担当者</label>
          <select id="mail-assignee" className="input" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">未割当</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="mail-memo">メモ（社内用）</label>
        <textarea
          id="mail-memo"
          className="input"
          rows={4}
          maxLength={5000}
          value={m}
          onChange={(e) => setM(e.target.value)}
          placeholder="対応内容・申し送りなど"
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={isPending}>
          {isPending ? "保存中…" : "保存"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-brand-700" : "text-red-600"}`} role={msg.ok ? "status" : "alert"}>
            {msg.text}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">
        ステータスはこのシステム内だけの情報です。Gmail の既読・ラベルとは連動しません。
      </p>
    </div>
  );
}
