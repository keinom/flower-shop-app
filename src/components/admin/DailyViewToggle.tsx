"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentView: string;
  currentDate: string;
}

export function DailyViewToggle({ currentView, currentDate }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
      {[
        { value: "1", label: "1日" },
        { value: "2", label: "2日" },
      ].map(({ value, label }) => (
        <button
          key={value}
          onClick={() => router.push(`/admin/daily?date=${currentDate}&view=${value}`)}
          className={`px-3.5 py-1.5 text-sm font-semibold rounded-md transition-all ${
            currentView === value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
