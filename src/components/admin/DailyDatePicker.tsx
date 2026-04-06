"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentDate: string; // YYYY-MM-DD
  view?: string;
}

export function DailyDatePicker({ currentDate, view = "1" }: Props) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={currentDate}
      onChange={(e) => {
        if (e.target.value) {
          router.push(`/admin/daily?date=${e.target.value}&view=${view}`);
        }
      }}
      className="input w-40 text-sm"
    />
  );
}
