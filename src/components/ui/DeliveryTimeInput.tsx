"use client";

import { useState } from "react";

const PRESETS = [
  { label: "午前中",   desc: "〜12:00",       start: "",      end: "12:00" },
  { label: "午後",     desc: "12:00〜17:00",  start: "12:00", end: "17:00" },
  { label: "夕方以降", desc: "17:00〜",       start: "17:00", end: ""      },
] as const;

interface Props {
  defaultStart?: string | null;
  defaultEnd?:   string | null;
}

// Supabase の TIME 型は "HH:MM:SS" で返るので先頭 5 文字だけ使う
function toHHMM(val: string | null | undefined) {
  if (!val) return "";
  return val.slice(0, 5);
}

export function DeliveryTimeInput({ defaultStart, defaultEnd }: Props) {
  const [start, setStart] = useState(toHHMM(defaultStart));
  const [end,   setEnd  ] = useState(toHHMM(defaultEnd));

  const activePreset = PRESETS.find((p) => p.start === start && p.end === end);

  function applyPreset(s: string, e: string) {
    // 同じプリセットを再クリックでリセット
    if (start === s && end === e) {
      setStart(""); setEnd("");
    } else {
      setStart(s); setEnd(e);
    }
  }

  const hasValue = start !== "" || end !== "";

  return (
    <div className="space-y-2">
      {/* プリセットボタン */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => {
          const isActive = activePreset?.label === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.start, p.end)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                isActive
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
              }`}
            >
              {p.label}
              <span className={`ml-1 text-xs ${isActive ? "opacity-80" : "text-gray-400"}`}>
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* 時刻レンジ入力 */}
      <div className="flex items-center gap-2">
        <input
          type="time"
          name="delivery_time_start"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="input w-32 text-sm"
        />
        <span className="text-gray-400 text-sm">〜</span>
        <input
          type="time"
          name="delivery_time_end"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="input w-32 text-sm"
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => { setStart(""); setEnd(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            クリア
          </button>
        )}
      </div>
      {hasValue && !activePreset && (
        <p className="text-xs text-gray-400">
          {start || "—"} 〜 {end || "—"}
        </p>
      )}
    </div>
  );
}
