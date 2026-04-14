"use client";

import { useState } from "react";
import { saveShiftPreferences } from "@/app/admin/shifts/actions";

interface DayData {
  start_time: string | null;
  end_time:   string | null;
}

interface Props {
  year:     number;
  month:    number;
  existing: Record<string, DayData>;
  amStart:  string;
  amEnd:    string;
  pmStart:  string;
  pmEnd:    string;
}

interface Preset {
  id:        string;
  label:     string;
  start:     string | null;
  end:       string | null;
  cellStyle: string;
  btnStyle:  string;
  badge:     string;
}

const DOW_LABELS    = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_FULLNAMES = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
const WEEKDAYS      = [1, 2, 3, 4, 5, 6]; // Mon–Sat

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(new Date(year, month - 1, d));
  return days;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(t: string) {
  return t.replace(/^0/, "");
}

export function ShiftPreferenceCalendar({
  year, month, existing, amStart, amEnd, pmStart, pmEnd,
}: Props) {
  const PRESETS: Preset[] = [
    {
      id: "full", label: "終日",
      start: amStart, end: pmEnd,
      cellStyle: "bg-emerald-50 border-emerald-300",
      btnStyle:  "bg-emerald-500 text-white",
      badge:     `${fmt(amStart)}-${fmt(pmEnd)}`,
    },
    {
      id: "am", label: "午前",
      start: amStart, end: amEnd,
      cellStyle: "bg-sky-50 border-sky-300",
      btnStyle:  "bg-sky-500 text-white",
      badge:     `${fmt(amStart)}-${fmt(amEnd)}`,
    },
    {
      id: "pm", label: "午後",
      start: pmStart, end: pmEnd,
      cellStyle: "bg-amber-50 border-amber-300",
      btnStyle:  "bg-amber-500 text-white",
      badge:     `${fmt(pmStart)}-${fmt(pmEnd)}`,
    },
    {
      id: "off", label: "休み",
      start: null, end: null,
      cellStyle: "bg-gray-50 border-gray-200",
      btnStyle:  "bg-gray-400 text-white",
      badge:     "休",
    },
  ];

  // カスタム時刻（プリセット以外）用スタイル
  const CUSTOM_STYLE = {
    cellStyle: "bg-violet-50 border-violet-300",
    btnStyle:  "bg-violet-500 text-white",
  };

  const [prefs, setPrefs]           = useState<Record<string, DayData>>(existing);
  const [pending, setPending]       = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStart, setEditStart]   = useState("");
  const [editEnd, setEditEnd]       = useState("");

  const days     = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();
  const offset   = firstDow === 0 ? 6 : firstDow - 1;

  // プリセット一致チェック
  function matchPreset(day: DayData): Preset | null {
    if (!day.start_time || !day.end_time) return PRESETS[3]; // off
    return PRESETS.find((p) => p.start === day.start_time && p.end === day.end_time) ?? null;
  }

  function isCustom(day: DayData): boolean {
    if (!day.start_time || !day.end_time) return false;
    return !PRESETS.some((p) => p.start === day.start_time && p.end === day.end_time);
  }

  function getCellStyle(day: DayData) {
    if (isCustom(day)) return CUSTOM_STYLE.cellStyle;
    return (matchPreset(day) ?? PRESETS[3]).cellStyle;
  }
  function getBtnStyle(day: DayData) {
    if (isCustom(day)) return CUSTOM_STYLE.btnStyle;
    return (matchPreset(day) ?? PRESETS[3]).btnStyle;
  }
  function getBadge(day: DayData): string {
    if (!day.start_time || !day.end_time) return "休";
    return `${fmt(day.start_time)}-${fmt(day.end_time)}`;
  }

  function applyPreset(dateStr: string, preset: Preset) {
    setPrefs((prev) => ({ ...prev, [dateStr]: { start_time: preset.start, end_time: preset.end } }));
  }

  function cyclePreset(dateStr: string) {
    const cur  = prefs[dateStr] ?? { start_time: null, end_time: null };
    const match = matchPreset(cur);
    if (isCustom(cur)) {
      // カスタム時刻の場合は最初のプリセット（終日）に戻す
      applyPreset(dateStr, PRESETS[0]);
      return;
    }
    const idx = PRESETS.findIndex((p) => p.id === (match?.id ?? "off"));
    applyPreset(dateStr, PRESETS[(idx + 1) % PRESETS.length]);
  }

  function setAllDays(preset: Preset) {
    const all: Record<string, DayData> = {};
    days.forEach((d) => {
      const ds = toDateStr(d);
      all[ds] = d.getDay() === 0
        ? { start_time: null, end_time: null }
        : { start_time: preset.start, end_time: preset.end };
    });
    setPrefs(all);
  }

  function setByDow(dow: number, preset: Preset) {
    setPrefs((prev) => {
      const updated = { ...prev };
      days.forEach((d) => {
        if (d.getDay() === dow)
          updated[toDateStr(d)] = { start_time: preset.start, end_time: preset.end };
      });
      return updated;
    });
  }

  // 時刻手動編集
  function openEdit(e: React.MouseEvent, dateStr: string) {
    e.stopPropagation();
    const day = prefs[dateStr] ?? { start_time: null, end_time: null };
    setEditStart(day.start_time ?? amStart);
    setEditEnd(day.end_time ?? pmEnd);
    setEditingDate(dateStr);
  }

  function applyEdit() {
    if (!editingDate) return;
    if (editStart && editEnd) {
      setPrefs((prev) => ({ ...prev, [editingDate]: { start_time: editStart, end_time: editEnd } }));
    }
    setEditingDate(null);
  }

  function cancelEdit() {
    setEditingDate(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const payload: Record<string, { type: string; start_time: string | null; end_time: string | null }> = {};
      days.forEach((d) => {
        const ds  = toDateStr(d);
        const day = prefs[ds] ?? { start_time: null, end_time: null };
        payload[ds] = {
          type:       day.start_time && day.end_time ? "available" : "off",
          start_time: day.start_time,
          end_time:   day.end_time,
        };
      });
      const fd = new FormData();
      fd.set("year",        String(year));
      fd.set("month",       String(month));
      fd.set("preferences", JSON.stringify(payload));
      await saveShiftPreferences(fd);
    } finally {
      setPending(false);
    }
  }

  // 集計サマリー（日曜除く）
  const counts = [
    ...PRESETS,
    { id: "custom", label: "カスタム", cellStyle: CUSTOM_STYLE.cellStyle, btnStyle: CUSTOM_STYLE.btnStyle },
  ].map((opt) => ({
    ...opt,
    count: days.filter((d) => {
      if (d.getDay() === 0) return false;
      const day = prefs[toDateStr(d)] ?? { start_time: null, end_time: null };
      if (opt.id === "custom") return isCustom(day);
      const match = matchPreset(day);
      return !isCustom(day) && (match?.id ?? "off") === opt.id;
    }).length,
  })).filter((c) => c.count > 0 || c.id !== "custom");

  // 編集対象日の情報
  const editingDay = editingDate ? days.find((d) => toDateStr(d) === editingDate) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── 全日一括設定 ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">全日一括設定（日曜除く）</p>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAllDays(p)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${p.btnStyle}`}
            >
              全日 {p.label}{p.id !== "off" ? ` (${p.badge})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* ── 曜日別一括設定 ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">曜日別一括設定</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th className="text-left pr-4 py-1 text-gray-500 font-semibold w-12">曜日</th>
                {PRESETS.map((p) => (
                  <th key={p.id} className="px-2 py-1 text-center text-gray-500 font-medium">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((dow) => (
                <tr key={dow} className="border-t border-gray-100">
                  <td className={`pr-4 py-1.5 font-semibold ${dow === 6 ? "text-blue-500" : "text-gray-700"}`}>
                    {DOW_LABELS[dow]}曜
                  </td>
                  {PRESETS.map((p) => (
                    <td key={p.id} className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setByDow(dow, p)}
                        className={`px-2.5 py-0.5 rounded text-xs font-medium ${p.btnStyle}`}
                      >
                        {p.id === "off" ? "休み" : p.badge}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── カレンダーグリッド ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          日別設定
          <span className="font-normal text-gray-400">（セルをクリック: プリセット切り替え　✏ ボタン: 時刻を手動入力）</span>
        </p>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {/* ヘッダー */}
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
              <div
                key={dow}
                className={`text-center text-xs font-semibold py-1 ${
                  dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-700"
                }`}
              >
                {DOW_LABELS[dow]}
              </div>
            ))}

            {/* オフセット空白 */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {/* 日付セル */}
            {days.map((d) => {
              const ds  = toDateStr(d);
              const dow = d.getDay();
              const dayColor = dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-800";
              const isEditing = editingDate === ds;

              if (dow === 0) {
                return (
                  <div
                    key={ds}
                    className="border rounded-lg p-1.5 text-left bg-red-50/40 border-red-100"
                  >
                    <div className={`text-xs font-bold mb-1 ${dayColor}`}>{d.getDate()}</div>
                    <div className="text-center text-xs text-red-400 font-medium px-1 py-0.5 rounded bg-red-100">
                      定休
                    </div>
                  </div>
                );
              }

              const day    = prefs[ds] ?? { start_time: null, end_time: null };
              const cell   = getCellStyle(day);
              const btn    = getBtnStyle(day);
              const badge  = getBadge(day);
              const custom = isCustom(day);

              return (
                <div
                  key={ds}
                  className={`border rounded-lg text-left transition-all relative ${cell} ${
                    isEditing ? "ring-2 ring-violet-400 ring-offset-1" : ""
                  }`}
                >
                  {/* クリックでプリセット切り替え */}
                  <button
                    type="button"
                    onClick={() => cyclePreset(ds)}
                    className="w-full p-1.5 text-left hover:opacity-80 active:scale-95 transition-all"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-xs font-bold ${dayColor}`}>{d.getDate()}</span>
                      {custom && (
                        <span className="text-xs text-violet-400 font-bold leading-none">★</span>
                      )}
                    </div>
                    <div className={`text-center text-xs font-semibold px-1 py-0.5 rounded ${btn}`}>
                      {badge}
                    </div>
                  </button>
                  {/* 時刻手動編集ボタン */}
                  <button
                    type="button"
                    onClick={(e) => openEdit(e, ds)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white/70 rounded transition-colors"
                    title="時刻を手動で編集"
                  >
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M8.5 1.5a1.5 1.5 0 0 1 2.121 2.121L9.5 4.75 7.25 2.5 8.5 1.5zm-1.75 1.75L1.5 8.5 1 11l2.5-.5 5.25-5.25L6.75 3.25z"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 手動時刻編集パネル ── */}
      {editingDate && editingDay && (
        <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-violet-800">
              {month}月{editingDay.getDate()}日（{DOW_FULLNAMES[editingDay.getDay()]}）の時刻を編集
            </span>
            <button
              type="button"
              onClick={cancelEdit}
              className="ml-auto text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5 rounded hover:bg-white/70 transition-colors"
            >
              ✕ キャンセル
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 w-12">開始</label>
              <input
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="input text-sm py-1 w-32"
              />
            </div>
            <span className="text-gray-400 font-medium">〜</span>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 w-12">終了</label>
              <input
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="input text-sm py-1 w-32"
              />
            </div>
          </div>

          {/* プリセットをクイック選択 */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">プリセット:</span>
            {PRESETS.filter((p) => p.id !== "off").map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setEditStart(p.start!); setEditEnd(p.end!); }}
                className={`text-xs px-2 py-0.5 rounded font-medium ${p.btnStyle}`}
              >
                {p.label} ({p.badge})
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={applyEdit}
              className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              この時刻を適用
            </button>
            <button
              type="button"
              onClick={() => {
                setPrefs((prev) => ({ ...prev, [editingDate]: { start_time: null, end_time: null } }));
                setEditingDate(null);
              }}
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              休みにする
            </button>
          </div>
        </div>
      )}

      {/* ── 集計サマリー ── */}
      <div className="flex gap-3 flex-wrap">
        {counts.filter((c) => c.count > 0).map((opt) => (
          <div
            key={opt.id}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${opt.cellStyle}`}
          >
            <span className={`font-bold ${opt.btnStyle} px-1.5 py-0.5 rounded`}>{opt.label}</span>
            <span className="font-bold text-gray-900">{opt.count}日</span>
          </div>
        ))}
      </div>

      {/* ── 注記 ── */}
      <p className="text-xs text-gray-400">
        ※ セルをクリック: 終日→午前→午後→休みの順に切り替え　✏ アイコン: 任意の時刻を手動入力　★ マーク: カスタム時刻設定済み
      </p>

      {/* ── 送信ボタン ── */}
      <div>
        <button type="submit" disabled={pending} className="btn-primary px-8">
          {pending ? "保存中..." : "シフト希望を保存する"}
        </button>
      </div>
    </form>
  );
}
