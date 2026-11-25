"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Gmail 連携が設定済み（フィクスチャ含む）か */
  configured: boolean;
  /** 最終同期成功日時（JST 整形済み文字列）。未同期なら null */
  lastSyncedLabel: string | null;
  /** 直近の同期エラー概要（DB の last_error。鍵・本文は含まれない） */
  lastError: string | null;
  fixtureMode: boolean;
}

type Phase =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; imported: number; hasMore: boolean }
  | { kind: "busy" }
  | { kind: "error"; message: string };

const MAX_AUTO_CONTINUE = 5;

/**
 * 画面表示後にバックグラウンドで差分同期を起動し、完了後に一覧を更新する
 * （一覧の表示は DB の取り込み済みデータで先に出る。Gmail 待ちでブロックしない）。
 * 「更新」ボタンで手動実行も可能。
 */
export function MailSyncBar({ configured, lastSyncedLabel, lastError, fixtureMode }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPhase({ kind: "syncing" });
    let total = 0;
    try {
      for (let i = 0; i < MAX_AUTO_CONTINUE; i++) {
        const res = await fetch("/api/mail/sync", { method: "POST", cache: "no-store" });
        if (!res.ok) {
          const msg = res.status === 403 ? "権限がありません" : "同期に失敗しました";
          setPhase({ kind: "error", message: msg });
          return;
        }
        const j = (await res.json()) as {
          status: "ok" | "busy" | "error";
          imported: number;
          hasMore: boolean;
          error: string | null;
        };
        if (j.status === "busy") {
          setPhase({ kind: "busy" });
          return;
        }
        if (j.status === "error") {
          setPhase({ kind: "error", message: j.error ?? "同期に失敗しました" });
          return;
        }
        total += j.imported;
        if (!j.hasMore || i === MAX_AUTO_CONTINUE - 1) {
          setPhase({ kind: "done", imported: total, hasMore: j.hasMore });
          return;
        }
      }
    } catch {
      setPhase({ kind: "error", message: "同期に失敗しました（通信エラー）" });
    } finally {
      running.current = false;
      router.refresh(); // 最終同期日時・エラー表示・一覧・ナビバッジを更新
    }
  }, [router]);

  // 画面を開いたとき 1 回だけ自動で同期
  useEffect(() => {
    if (configured) void sync();
  }, [configured, sync]);

  const syncing = phase.kind === "syncing";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
      <button
        type="button"
        className="btn-secondary !py-1.5 !px-3 text-xs"
        onClick={() => void sync()}
        disabled={!configured || syncing}
      >
        {syncing ? "同期中…" : "↻ 更新"}
      </button>
      <span>最終同期: {lastSyncedLabel ?? "未同期"}</span>
      {fixtureMode && (
        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
          フィクスチャ（架空データ）
        </span>
      )}
      {phase.kind === "done" && (
        <span className="text-brand-700">
          {phase.imported > 0 ? `${phase.imported} 件を取り込みました` : "新着はありません"}
          {phase.hasMore && "（続きがあります。「更新」で続きを取り込みます）"}
        </span>
      )}
      {phase.kind === "busy" && <span>他の同期が実行中です。しばらくして「更新」してください</span>}
      {phase.kind === "error" && (
        <span className="text-red-600" role="alert">
          同期エラー: {phase.message}（取り込み済みのメールは引き続き閲覧できます）
        </span>
      )}
      {phase.kind !== "error" && lastError && (
        <span className="text-red-600" role="alert">
          前回の同期エラー: {lastError}
        </span>
      )}
    </div>
  );
}
