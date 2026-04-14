"use client";

import { useState } from "react";
import { saveShiftPreferences } from "@/app/admin/shifts/actions";
import type { ShiftPreferenceType } from "@/types/database";

interface Props {
  year: number;
  month: number;
  existing: Record<string, ShiftPreferenceType>; // { "2026-05-01": "full", ... }
}

const PREF_OPTIONS: { type: ShiftPreferenceType; label: string; short: string }[] = [
  { type: "full", label: "終日",   short: "終" },
  { type: "am",   label: "午前",   short: "前" },
  { type: "pm",   label: "午後",   short: "後" },
  { type: "off",  label: "出勤不可", short: "✕" },
];

const PREF_STYLE: Record<ShiftPreferenceType, { cell: string; btn: string }> = {
  full: { cell: "bg-emerald-50 border-emerald-300", btn: "bg-emerald-500 text-white" },
  am:   { cell: "bg-sky-50 border-sky-300",         btn: "bg-sky-500 text-white" },
  pm:   { cell: "bg-amber-50 border-amber-300",     btn: "bg-amber-500 text-white" },
  off:  { cell: "bg-gray-50 border-gray-200",       btn: "bg-gray-400 text-white" },
};

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_HEADER_STYLE = [
  "text-red-500",    // 日
  "text-gray-700",   // 月
  "text-gray-700",   // 火
  "text-gray-700",   // 水
  "text-gray-700",   // 木
  "text-gray-700",   // 金
  "text-blue-500",   // 土
];

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) {
    days.push(new Date(year, month - 1, d));
  }
  return days;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ShiftPreferenceCalendar({ year, month, existing }: Props) {
  const [prefs, setPrefs] = useState<Record<string, ShiftPreferenceType>>(existing);
  const [pending, setPending] = useState(false);

  const days = getDaysInMonth(year, month);

  // カレンダーグリッド用: 最初の日の曜日に合わせて空白を挿入（月曜始まり）
  const firstDow = days[0].getDay(); // 0=Sun
  const offset   = firstDow === 0 ? 6 : firstDow - 1; // 月曜を0基準に変換

  const cycle = (dateStr: string) => {
    const current = prefs[dateStr] ?? "off";
    const idx = PREF_OPTIONS.findIndex((o) => o.type === current);
    const next = PREF_OPTIONS[(idx + 1) % PREF_OPTIONS.length].type;
    setPrefs((prev) => ({ ...prev, [dateStr]: next }));
  };

  const setPrefAll = (type: ShiftPreferenceType) => {
    const all: Record<string, ShiftPreferenceType> = {};
    days.forEach((d) => { all[toDateStr(d)] = type; });
    setPrefs(all);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      // 全日付を確実に含めた prefs を送信（未操作の日は "off" として補完）
      const fullPrefs: Record<string, string> = {};
      days.forEach((d) => {
        const dateStr = toDateStr(d);
        fullPrefs[dateStr] = prefs[dateStr] ?? "off";
      });
      const fd = new FormData();
      fd.set("year", String(year));
      fd.set("month", String(month));
      fd.set("preferences", JSON.stringify(fullPrefs));
      await saveShiftPreferences(fd);
      // Server Action の redirect() が発火するため、以降は通常実行されない
    } finally {
      setPending(false);
    }
  }

  // 凡例のサマリー
  const counts = PREF_OPTIONS.map((opt) => ({
    ...opt,
    count: days.filter((d) => (prefs[toDateStr(d)] ?? "off") === opt.type).length,
  }));

  return (
    <form onSubmit={handleSubmit}>
      {/* hidden inputs は handleSubmit 内で FormData を直接構築するため不要 */}

      {/* 一括設定ボタン */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">一括設定:</span>
        {PREF_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => setPrefAll(opt.type)}
            className={`text-xs px-3 py-1 rounded-full font-medium ${PREF_STYLE[opt.type].btn}`}
          >
            全日 {opt.label}
          </button>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[560px]">
          {/* ヘッダー行（月曜始まり） */}
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <div key={dow} className={`text-center text-xs font-semibold py-1 ${DOW_HEADER_STYLE[dow]}`}>
              {DOW_LABELS[dow]}
            </div>
          ))}

          {/* オフセット空白 */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {/* 日付セル */}
          {days.map((d) => {
            const dateStr = toDateStr(d);
            const pref    = prefs[dateStr] ?? "off";
            const style   = PREF_STYLE[pref];
            const dow     = d.getDay();
            const dayColor = dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-800";

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => cycle(dateStr)}
                className={`border rounded-lg p-1.5 text-left transition-all hover:opacity-80 active:scale-95 ${style.cell}`}
              >
                <div className={`text-xs font-bold mb-1 ${dayColor}`}>{d.getDate()}</div>
                <div className={`text-center text-xs font-semibold px-1 py-0.5 rounded ${style.btn}`}>
                  {PREF_OPTIONS.find((o) => o.type === pref)?.short}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 集計サマリー */}
      <div className="mt-4 flex gap-3 flex-wrap">
        {counts.map((opt) => (
          <div key={opt.type} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${PREF_STYLE[opt.type].cell}`}>
            <span className={`font-bold ${PREF_STYLE[opt.type].btn} px-1.5 py-0.5 rounded text-white`}>{opt.short}</span>
            <span className="text-gray-700">{opt.label}</span>
            <span className="font-bold text-gray-900">{opt.count}日</span>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div className="mt-3 text-xs text-gray-400">
        ※ 各セルをクリックすると「終日 → 午前 → 午後 → 出勤不可」の順に切り替わります
      </div>

      {/* 送信ボタン */}
      <div className="mt-5">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary px-8"
        >
          {pending ? "保存中..." : "シフト希望を保存する"}
        </button>
      </div>
    </form>
  );
}
