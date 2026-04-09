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
    <div className="flex items-center gap-2">
      {/* 日付表示テキスト（クリックでinputを開く） */}
      <label className="relative cursor-pointer flex items-center gap-2 group">
        <span className="text-base font-bold text-gray-800 group-hover:text-brand-700 transition-colors">
          {formatted}
        </span>
        {isToday && (
          <span className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
            今日
          </span>
        )}
        <span className="text-gray-400 group-hover:text-brand-500 transition-colors text-sm">📅</span>
        {/* 実際のinputは非表示だが、labelのクリックで開く */}
        <input
          type="date"
          value={currentDate}
          onChange={(e) => {
            if (e.target.value) router.push(`/admin/daily?date=${e.target.value}&view=${view}`);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          aria-label="日付を選択"
        />
      </label>
    </div>
  );
}
