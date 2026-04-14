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
  badgeStyle: string;
  editBtnStyle: string;
  badge:     string;
}

const DOW_LABELS    = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_FULLNAMES = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
const WEEKDAYS      = [1, 2, 3, 4, 5, 6, 0];

// 30分刻みの時刻選択肢 (06:00〜22:30)
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

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
      cellStyle:    "bg-emerald-50 border-emerald-300",
      badgeStyle:   "bg-emerald-500 text-white",
      editBtnStyle: "border-emerald-200 text-emerald-600 hover:bg-emerald-100",
      badge: `${fmt(amStart)}-${fmt(pmEnd)}`,
    },
    {
      id: "am", label: "午前",
      start: amStart, end: amEnd,
      cellStyle:    "bg-sky-50 border-sky-300",
      badgeStyle:   "bg-sky-500 text-white",
      editBtnStyle: "border-sky-200 text-sky-600 hover:bg-sky-100",
      badge: `${fmt(amStart)}-${fmt(amEnd)}`,
    },
    {
      id: "pm", label: "午後",
      start: pmStart, end: pmEnd,
      cellStyle:    "bg-amber-50 border-amber-300",
      badgeStyle:   "bg-amber-500 text-white",
      editBtnStyle: "border-amber-200 text-amber-600 hover:bg-amber-100",
      badge: `${fmt(pmStart)}-${fmt(pmEnd)}`,
    },
    {
      id: "off", label: "休み",
      start: null, end: null,
      cellStyle:    "bg-gray-50 border-gray-200",
      badgeStyle:   "bg-gray-300 text-gray-600",
      editBtnStyle: "border-gray-200 text-gray-400 hover:bg-gray-100",
      badge: "休",
    },
  ];

  const CUSTOM = {
    cellStyle:    "bg-violet-50 border-violet-300",
    badgeStyle:   "bg-violet-500 text-white",
    editBtnStyle: "border-violet-200 text-violet-600 hover:bg-violet-100",
  };

  const [prefs,       setPrefs]       = useState<Record<string, DayData>>(existing);
  const [pending,     setPending]     = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStart,   setEditStart]   = useState(amStart);
  const [editEnd,     setEditEnd]     = useState(pmEnd);

  const days     = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();
  const offset   = firstDow === 0 ? 6 : firstDow - 1;

  function matchPreset(day: DayData): Preset {
    if (!day.start_time || !day.end_time) return PRESETS[3];
    return PRESETS.find((p) => p.start === day.start_time && p.end === day.end_time) ?? PRESETS[0];
  }

  function isCustom(day: DayData): boolean {
    if (!day.start_time || !day.end_time) return false;
    return !PRESETS.some((p) => p.start === day.start_time && p.end === day.end_time);
  }

  function getStyle(day: DayData) {
    return isCustom(day) ? CUSTOM : matchPreset(day);
  }

  function getBadge(day: DayData): string {
    if (!day.start_time || !day.end_time) return "休";
    return `${fmt(day.start_time)}-${fmt(day.end_time)}`;
  }

  function applyPreset(dateStr: string, preset: Preset) {
    setPrefs((prev) => ({ ...prev, [dateStr]: { start_time: preset.start, end_time: preset.end } }));
  }

  function cyclePreset(dateStr: string) {
    const cur = prefs[dateStr] ?? { start_time: null, end_time: null };
    if (isCustom(cur)) { applyPreset(dateStr, PRESETS[0]); return; }
    const idx = PRESETS.findIndex((p) => p.id === matchPreset(cur).id);
    applyPreset(dateStr, PRESETS[(idx + 1) % PRESETS.length]);
  }

  function setAllDays(preset: Preset) {
    const all: Record<string, DayData> = {};
    days.forEach((d) => {
      all[toDateStr(d)] = { start_time: preset.start, end_time: preset.end };
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

  function openEdit(e: React.MouseEvent, dateStr: string) {
    e.stopPropagation();
    const day = prefs[dateStr] ?? { start_time: null, end_time: null };
    setEditStart(day.start_time ?? amStart);
    setEditEnd(day.end_time ?? pmEnd);
    setEditingDate(dateStr);
    // 少し待ってからスクロール
    setTimeout(() => {
      document.getElementById("time-edit-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function applyEdit() {
    if (!editingDate || !editStart || !editEnd) return;
    setPrefs((prev) => ({ ...prev, [editingDate]: { start_time: editStart, end_time: editEnd } }));
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

  const counts = [
    ...PRESETS,
    { id: "custom", label: "カスタム", cellStyle: CUSTOM.cellStyle, badgeStyle: CUSTOM.badgeStyle },
  ].map((opt) => ({
    ...opt,
    count: days.filter((d) => {
      const day = prefs[toDateStr(d)] ?? { start_time: null, end_time: null };
      if (opt.id === "custom") return isCustom(day);
      return !isCustom(day) && matchPreset(day).id === opt.id;
    }).length,
  }));

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
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${p.badgeStyle}`}
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
                <th className="text-left pr-4 py-1.5 text-gray-500 font-semibold w-14">曜日</th>
                {PRESETS.map((p) => (
                  <th key={p.id} className="px-2 py-1.5 text-center text-gray-500 font-medium">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((dow) => (
                <tr key={dow} className="border-t border-gray-100">
                  <td className={`pr-4 py-2 font-semibold ${dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-700"}`}>
                    {DOW_LABELS[dow]}曜
                  </td>
                  {PRESETS.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setByDow(dow, p)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${p.badgeStyle}`}
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
          <span className="font-normal text-gray-400 ml-1">
            （上半分クリック: 種別切替　「時刻編集」ボタン: 時刻を直接指定）
          </span>
        </p>

        {/* 7列グリッド: overflow-x-auto で小画面対応 */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1.5" style={{ minWidth: "560px" }}>

            {/* 曜日ヘッダー (月始まり) */}
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
              <div
                key={dow}
                className={`text-center text-xs font-semibold py-1.5 ${
                  dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-600"
                }`}
              >
                {DOW_LABELS[dow]}
              </div>
            ))}

            {/* オフセット空白 */}
            {Array.from({ length: offset }).map((_, i) => <div key={`b${i}`} />)}

            {/* 日付セル */}
            {days.map((d) => {
              const ds  = toDateStr(d);
              const dow = d.getDay();
              const dayColor =
                dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-800";
              const isEditing = editingDate === ds;
              const day   = prefs[ds] ?? { start_time: null, end_time: null };
              const style = getStyle(day);
              const badge = getBadge(day);
              const custom = isCustom(day);

              return (
                <div
                  key={ds}
                  className={`border rounded-xl flex flex-col overflow-hidden transition-all ${style.cellStyle} ${
                    isEditing ? "ring-2 ring-violet-400 ring-offset-1 shadow-md" : ""
                  }`}
                >
                  {/* 上部: クリックでプリセット切り替え */}
                  <button
                    type="button"
                    onClick={() => cyclePreset(ds)}
                    className="flex-1 px-2 pt-2 pb-1.5 text-left hover:brightness-95 active:scale-95 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-bold leading-none ${dayColor}`}>{d.getDate()}</span>
                      {custom && (
                        <span className="text-violet-500 text-xs leading-none font-bold">★</span>
                      )}
                    </div>
                    <div className={`text-center text-xs font-semibold py-1 rounded-lg ${style.badgeStyle}`}>
                      {badge}
                    </div>
                  </button>

                  {/* 下部: 時刻編集ボタン */}
                  <button
                    type="button"
                    onClick={(e) => openEdit(e, ds)}
                    className={`w-full text-center text-xs font-medium py-1.5 border-t transition-colors ${style.editBtnStyle}`}
                  >
                    ✏ 時刻編集
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 時刻手動編集パネル ── */}
      {editingDate && editingDay && (
        <div id="time-edit-panel" className="border-2 border-violet-300 bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-violet-800">
              {month}月{editingDay.getDate()}日（{DOW_FULLNAMES[editingDay.getDay()]}）の時刻を編集
            </h3>
            <button
              type="button"
              onClick={() => setEditingDate(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
            >
              ✕
            </button>
          </div>

          {/* 時刻セレクト */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">開始時刻</label>
              <select
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/^0/, "")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">終了時刻</label>
              <select
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/^0/, "")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 設定プレビュー */}
          {editStart && editEnd && (
            <div className="mb-4 px-3 py-2 bg-violet-50 rounded-lg text-sm text-violet-700 font-medium text-center">
              {fmt(editStart)} 〜 {fmt(editEnd)} で設定
            </div>
          )}

          {/* プリセットクイック選択 */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">プリセットから選ぶ</p>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.filter((p) => p.id !== "off").map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setEditStart(p.start!); setEditEnd(p.end!); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${p.badgeStyle}`}
                >
                  {p.label}（{p.badge}）
                </button>
              ))}
            </div>
          </div>

          {/* 操作ボタン */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={applyEdit}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors"
            >
              この時刻を適用する
            </button>
            <button
              type="button"
              onClick={() => {
                setPrefs((prev) => ({ ...prev, [editingDate]: { start_time: null, end_time: null } }));
                setEditingDate(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 transition-colors"
            >
              休みにする
            </button>
            <button
              type="button"
              onClick={() => setEditingDate(null)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ── 集計サマリー ── */}
      <div className="flex gap-2 flex-wrap">
        {counts.filter((c) => c.count > 0).map((opt) => (
          <div
            key={opt.id}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${opt.cellStyle}`}
          >
            <span className={`font-bold ${opt.badgeStyle} px-1.5 py-0.5 rounded-full`}>{opt.label}</span>
            <span className="font-bold text-gray-900">{opt.count}日</span>
          </div>
        ))}
      </div>

      {/* ── 注記 ── */}
      <p className="text-xs text-gray-400">
        ※ セル上部クリック: 終日→午前→午後→休みの順に切り替え　✏ 時刻編集ボタン: 任意の時刻を指定　★: カスタム時刻設定済み（日曜も設定可）
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
