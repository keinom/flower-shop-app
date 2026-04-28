"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  currentDate: string; // YYYY-MM-DD
  view?: string;
  todayDate: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function DailyDatePicker({ currentDate, view = "1", todayDate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(() => parseInt(currentDate.split("-")[0]));
  const [displayMonth, setDisplayMonth] = useState(() => parseInt(currentDate.split("-")[1])); // 1-12
  const containerRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isToday = currentDate === todayDate;
  const formatted = new Date(`${currentDate}T00:00:00`).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  const handleSelect = (dateStr: string) => {
    setOpen(false);
    router.push(`/admin/daily?date=${dateStr}&view=${view}`);
  };

  const goToPrevMonth = () => {
    if (displayMonth === 1) { setDisplayYear(y => y - 1); setDisplayMonth(12); }
    else setDisplayMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (displayMonth === 12) { setDisplayYear(y => y + 1); setDisplayMonth(1); }
    else setDisplayMonth(m => m + 1);
  };
  const goToToday = () => {
    const [ty, tm] = todayDate.split("-").map(Number);
    setDisplayYear(ty);
    setDisplayMonth(tm);
  };

  // カレンダーグリッドを生成（42マス = 6週）
  const firstDayOfWeek = new Date(displayYear, displayMonth - 1, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();
  const daysInPrevMonth = new Date(displayYear, displayMonth - 1, 0).getDate();

  type Cell = { date: string; day: number; inMonth: boolean };
  const cells: Cell[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    const d = daysInPrevMonth - firstDayOfWeek + 1 + i;
    const pm = displayMonth === 1 ? 12 : displayMonth - 1;
    const py = displayMonth === 1 ? displayYear - 1 : displayYear;
    cells.push({ date: `${py}-${String(pm).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${displayYear}-${String(displayMonth).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = displayMonth === 12 ? 1 : displayMonth + 1;
    const ny = displayMonth === 12 ? displayYear + 1 : displayYear;
    cells.push({ date: `${ny}-${String(nm).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d, inMonth: false });
  }

  return (
    <div ref={containerRef} className="relative">
      {/* ── トリガーボタン ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white hover:bg-brand-50 hover:border-brand-400 active:scale-95 transition-all shadow-sm select-none"
      >
        <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{formatted}</span>
        {isToday && (
          <span className="text-xs font-bold text-white bg-brand-600 px-2 py-0.5 rounded-full">今日</span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── カレンダーポップアップ ── */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-80">

          {/* 月ナビゲーション */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">{displayYear}年{displayMonth}月</p>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-semibold py-1 ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, i) => {
              const isSelected = cell.date === currentDate;
              const isTodayCell = cell.date === todayDate;
              const dow = i % 7;
              const isSun = dow === 0;
              const isSat = dow === 6;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => handleSelect(cell.date)}
                  className={`
                    mx-auto w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all font-medium
                    ${isSelected
                      ? "bg-brand-600 text-white font-bold shadow-md scale-105"
                      : isTodayCell
                      ? "bg-brand-100 text-brand-700 font-bold ring-2 ring-brand-300"
                      : cell.inMonth
                      ? `hover:bg-gray-100 ${isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-800"}`
                      : "text-gray-300 hover:bg-gray-50"
                    }
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* 今日ボタン */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { goToToday(); handleSelect(todayDate); }}
              className="w-full py-2 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
            >
              今日に移動
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
