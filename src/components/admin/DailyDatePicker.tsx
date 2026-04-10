"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentDate: string; // YYYY-MM-DD
  view?: string;
  todayDate: string;
}

export function DailyDatePicker({ currentDate, view = "1", todayDate }: Props) {
  const router = useRouter();
  const isToday = currentDate === todayDate;

  const formatted = new Date(`${currentDate}T00:00:00`).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <label className="relative cursor-pointer inline-flex items-center gap-2.5 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-brand-50 hover:border-brand-400 transition-all shadow-sm group select-none">
      {/* カレンダーアイコン */}
      <svg
        className="w-4 h-4 text-brand-600 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>

      {/* 日付テキスト */}
      <span className="text-sm font-semibold text-gray-800 group-hover:text-brand-700 transition-colors whitespace-nowrap">
        {formatted}
      </span>

      {/* 今日バッジ */}
      {isToday && (
        <span className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-300 px-2 py-0.5 rounded-full leading-none">
          今日
        </span>
      )}

      {/* ▼ ドロップダウン示唆 */}
      <svg
        className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>

      {/* 実際のdate input（非表示・label全体がクリック領域） */}
      <input
        type="date"
        value={currentDate}
        onChange={(e) => {
          if (e.target.value) router.push(`/admin/daily?date=${e.target.value}&view=${view}`);
        }}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        aria-label="日付を選択"
      />
    </label>
  );
}
