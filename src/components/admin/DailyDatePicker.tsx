"use client";

import { useRouter } from "next/navigation";

interface Props {
  currentDate: string; // YYYY-MM-DD
}

export function DailyDatePicker({ currentDate }: Props) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={currentDate}
      onChange={(e) => {
        if (e.target.value) {
          router.push(`/admin/daily?date=${e.target.value}`);
        }
      }}
      className="input w-40 text-sm"
    />
  );
}
