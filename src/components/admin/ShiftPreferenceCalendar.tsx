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
  amStart:  string; // e.g. "09:00"
  amEnd:    string; // e.g. "13:00"
  pmStart:  string; // e.g. "13:00"
  pmEnd:    string; // e.g. "18:00"
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

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAYS   = [1, 2, 3, 4, 5, 6]; // Mon–Sat for bulk setter

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
  // "09:00" → "9:00"
  return t.replace(/^0/, "");
}

export function ShiftPreferenceCalendar({
  year, month, existing, amStart, amEnd, pmStart, pmEnd,
}: Props) {
  // Build preset list from requirement times
  const PRESETS: Preset[] = [
    {
      id:        "full",
      label:     "終日",
      start:     amStart,
      end:       pmEnd,
      cellStyle: "bg-emerald-50 border-emerald-300",
      btnStyle:  "bg-emerald-500 text-white",
      badge:     `${fmt(amStart)}-${fmt(pmEnd)}`,
    },
    {
      id:        "am",
      label:     "午前",
      start:     amStart,
      end:       amEnd,
      cellStyle: "bg-sky-50 border-sky-300",
      btnStyle:  "bg-sky-500 text-white",
      badge:     `${fmt(amStart)}-${fmt(amEnd)}`,
    },
    {
      id:        "pm",
      label:     "午後",
      start:     pmStart,
      end:       pmEnd,
      cellStyle: "bg-amber-50 border-amber-300",
      btnStyle:  "bg-amber-500 text-white",
      badge:     `${fmt(pmStart)}-${fmt(pmEnd)}`,
    },
    {
      id:        "off",
      label:     "休み",
      start:     null,
      end:       null,
      cellStyle: "bg-gray-50 border-gray-200",
      btnStyle:  "bg-gray-400 text-white",
      badge:     "休",
    },
  ];

  const [prefs, setPrefs] = useState<Record<string, DayData>>(existing);
  const [pending, setPending] = useState(false);

  const days   = getDaysInMonth(year, month);
  const firstDow = days[0].getDay();
  const offset   = firstDow === 0 ? 6 : firstDow - 1; // Mon=0 base

  // Identify which preset matches a day
  function getPreset(day: DayData): Preset {
    if (!day.start_time || !day.end_time) return PRESETS[3]; // off
    const matched = PRESETS.find((p) => p.start === day.start_time && p.end === day.end_time);
    return matched ?? PRESETS[0]; // custom time → treat as "full" style
  }

  function apply(dateStr: string, preset: Preset) {
    setPrefs((prev) => ({ ...prev, [dateStr]: { start_time: preset.start, end_time: preset.end } }));
  }

  function cycle(dateStr: string) {
    const cur = prefs[dateStr] ?? { start_time: null, end_time: null };
    const idx  = PRESETS.findIndex((p) => p.id === getPreset(cur).id);
    apply(dateStr, PRESETS[(idx + 1) % PRESETS.length]);
  }

  function setAllDays(preset: Preset) {
    const all: Record<string, DayData> = {};
    days.forEach((d) => {
      const ds = toDateStr(d);
      if (d.getDay() === 0) {
        all[ds] = { start_time: null, end_time: null }; // Sundays always off
      } else {
        all[ds] = { start_time: preset.start, end_time: preset.end };
      }
    });
    setPrefs(all);
  }

  function setByDow(dow: number, preset: Preset) {
    setPrefs((prev) => {
      const updated = { ...prev };
      days.forEach((d) => {
        if (d.getDay() === dow) {
          updated[toDateStr(d)] = { start_time: preset.start, end_time: preset.end };
        }
      });
      return updated;
    });
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

  // Summary counts (exclude Sundays)
  const counts = PRESETS.map((preset) => ({
    ...preset,
    count: days.filter((d) => {
      if (d.getDay() === 0) return false;
      return getPreset(prefs[toDateStr(d)] ?? { start_time: null, end_time: null }).id === preset.id;
    }).length,
  }));

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
                  <th key={p.id} className="px-2 py-1 text-center text-gray-500 font-medium">
                    {p.label}
                  </th>
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
        <p className="text-xs font-semibold text-gray-500 mb-2">日別設定（セルをクリックで切り替え）</p>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {/* ヘッダー: 月曜始まり */}
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
              const dayColor =
                dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-800";

              if (dow === 0) {
                // 日曜: 定休日（操作不可）
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

              const preset = getPreset(prefs[ds] ?? { start_time: null, end_time: null });

              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => cycle(ds)}
                  className={`border rounded-lg p-1.5 text-left transition-all hover:opacity-80 active:scale-95 ${preset.cellStyle}`}
                >
                  <div className={`text-xs font-bold mb-1 ${dayColor}`}>{d.getDate()}</div>
                  <div className={`text-center text-xs font-semibold px-1 py-0.5 rounded ${preset.btnStyle}`}>
                    {preset.badge}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 集計サマリー ── */}
      <div className="flex gap-3 flex-wrap">
        {counts.map((opt) => (
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
        ※ 日別セルをクリックすると「終日 → 午前 → 午後 → 休み」の順に切り替わります。日曜日は定休日です。
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
