"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

interface MonthPillsScrollerProps {
  months: string[];
  selectedMonth: string;
  buildHref: (month: string) => string;
  formatMonth: (ym: string) => string;
}

/**
 * 月ラベルの横スクロールピル。
 * - months は 昇順（古い→新しい）で並ぶ
 * - 初期描画時に selectedMonth を可視領域にスクロール（通常は右端付近）
 */
export function MonthPillsScroller({
  months,
  selectedMonth,
  buildHref,
  formatMonth,
}: MonthPillsScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = selectedRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" as ScrollBehavior });
  }, [selectedMonth]);

  return (
    <div ref={containerRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {months.map((ym) => {
        const isSelected = ym === selectedMonth;
        return (
          <Link
            key={ym}
            ref={isSelected ? selectedRef : null}
            href={buildHref(ym)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isSelected
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
            }`}
          >
            {formatMonth(ym)}
          </Link>
        );
      })}
    </div>
  );
}
