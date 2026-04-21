"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export interface MonthPillItem {
  ym: string;
  label: string;
  href: string;
}

interface MonthPillsScrollerProps {
  items: MonthPillItem[];
  selectedMonth: string;
}

/**
 * 月ラベルの横スクロールピル（Client Component）。
 * - items は 昇順（古い→新しい）で並ぶ
 * - 初期描画時に selectedMonth を可視領域にスクロール（通常は右端付近）
 *
 * ※ Server→Client 境界を越える props は serializable である必要があるため、
 *    関数（buildHref / formatMonth 等）は受け取らず、整形済みデータを渡す。
 */
export function MonthPillsScroller({
  items,
  selectedMonth,
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
      {items.map((it) => {
        const isSelected = it.ym === selectedMonth;
        return (
          <Link
            key={it.ym}
            ref={isSelected ? selectedRef : null}
            href={it.href}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isSelected
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
