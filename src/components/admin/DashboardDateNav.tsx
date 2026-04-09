"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentDate: string; // "YYYY-MM-DD"
  prevDate: string;
  nextDate: string;
  todayDate: string;
}

export function DashboardDateNav({ currentDate, prevDate, nextDate, todayDate }: Props) {
  const router = useRouter();

  const isToday = currentDate === todayDate;

  const fmt = (d: string) => {
    const dt = new Date(`${d}T00:00:00`);
    return dt.toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric", weekday: "short",
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 前日 */}
      <button
        onClick={() => router.push(`/admin?date=${prevDate}`)}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
      >
        ← 前日
      </button>

      {/* 日付テキスト */}
      <span className="text-lg font-bold text-gray-900 min-w-[220px] text-center">
        {fmt(currentDate)}
        {isToday && (
          <span className="ml-2 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
            今日
          </span>
        )}
      </span>

      {/* 翌日 */}
      <button
        onClick={() => router.push(`/admin?date=${nextDate}`)}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
      >
        翌日 →
      </button>

      {/* カレンダー選択 */}
      <input
        type="date"
        value={currentDate}
        onChange={(e) => {
          if (e.target.value) router.push(`/admin?date=${e.target.value}`);
        }}
        className="input w-auto text-sm"
        title="日付を選択"
      />

      {/* 今日に戻る */}
      {!isToday && (
        <button
          onClick={() => router.push("/admin")}
          className="px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          今日に戻る
        </button>
      )}
    </div>
  );
}
