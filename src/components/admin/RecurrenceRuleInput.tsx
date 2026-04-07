"use client";
import { useState, useMemo } from "react";

type RecurrenceType = 'weekly' | 'monthly_date' | 'monthly_weekday' | 'interval';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const DAY_SHORT = ['日', '月', '火', '水', '木', '金', '土'];

// Inline recurrence calculation for client-side preview
function shouldOccurOn(
  type: RecurrenceType,
  weeklyDays: number[],
  monthlyDay: number,
  monthlyWeek: number,
  monthlyWeekday: number,
  intervalDays: number,
  startDate: string,
  date: Date
): boolean {
  if (!startDate) return false;
  const start = new Date(startDate + 'T00:00:00');
  const check = new Date(date); check.setHours(0,0,0,0); start.setHours(0,0,0,0);
  if (check < start) return false;
  const dow = check.getDay();
  const dom = check.getDate();
  switch (type) {
    case 'weekly': return weeklyDays.includes(dow);
    case 'monthly_date': {
      const daysInMonth = new Date(check.getFullYear(), check.getMonth()+1, 0).getDate();
      return dom === Math.min(monthlyDay, daysInMonth);
    }
    case 'monthly_weekday': {
      if (dow !== monthlyWeekday) return false;
      if (monthlyWeek === -1) {
        const next = new Date(check); next.setDate(dom + 7);
        return next.getMonth() !== check.getMonth();
      }
      return Math.floor((dom - 1) / 7) + 1 === monthlyWeek;
    }
    case 'interval': {
      if (intervalDays < 1) return false;
      const diff = Math.round((check.getTime() - start.getTime()) / 86400000);
      return diff >= 0 && diff % intervalDays === 0;
    }
  }
}

interface Props {
  defaultStartDate?: string;
  defaultType?: RecurrenceType;
  defaultWeeklyDays?: number[];
  defaultMonthlyDay?: number;
  defaultMonthlyWeek?: number;
  defaultMonthlyWeekday?: number;
  defaultIntervalDays?: number;
  defaultEndDate?: string | null;
}

export function RecurrenceRuleInput({
  defaultStartDate,
  defaultType,
  defaultWeeklyDays,
  defaultMonthlyDay,
  defaultMonthlyWeek,
  defaultMonthlyWeekday,
  defaultIntervalDays,
  defaultEndDate,
}: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [type, setType] = useState<RecurrenceType>(defaultType ?? 'weekly');
  const [weeklyDays, setWeeklyDays] = useState<number[]>(defaultWeeklyDays ?? [1]);
  const [monthlyDay, setMonthlyDay] = useState(defaultMonthlyDay ?? 1);
  const [monthlyWeek, setMonthlyWeek] = useState(defaultMonthlyWeek ?? 1);
  const [monthlyWeekday, setMonthlyWeekday] = useState(defaultMonthlyWeekday ?? 1);
  const [intervalDays, setIntervalDays] = useState(defaultIntervalDays ?? 7);
  const [startDate, setStartDate] = useState(defaultStartDate ?? today);
  const [hasEndDate, setHasEndDate] = useState(!!defaultEndDate);
  const [endDate, setEndDate] = useState(defaultEndDate ?? '');

  function toggleWeekday(d: number) {
    setWeeklyDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  }

  // Preview: next 5 occurrences
  const preview = useMemo(() => {
    const results: Date[] = [];
    if (!startDate) return results;
    const cur = new Date(startDate + 'T00:00:00');
    let i = 0;
    while (results.length < 5 && i < 400) {
      if (shouldOccurOn(type, weeklyDays, monthlyDay, monthlyWeek, monthlyWeekday, intervalDays, startDate, cur)) {
        results.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1); i++;
    }
    return results;
  }, [type, weeklyDays, monthlyDay, monthlyWeek, monthlyWeekday, intervalDays, startDate]);

  const tabClass = (t: RecurrenceType) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition-all ${
      type === t
        ? 'bg-brand-600 text-white shadow-sm'
        : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'
    }`;

  return (
    <div className="space-y-5">
      {/* Hidden inputs */}
      <input type="hidden" name="recurrence_type" value={type} />
      <input type="hidden" name="weekly_days" value={JSON.stringify(weeklyDays)} />
      <input type="hidden" name="monthly_day" value={monthlyDay} />
      <input type="hidden" name="monthly_week" value={monthlyWeek} />
      <input type="hidden" name="monthly_weekday" value={monthlyWeekday} />
      <input type="hidden" name="interval_days" value={intervalDays} />
      <input type="hidden" name="start_date" value={startDate} />
      <input type="hidden" name="end_date" value={hasEndDate ? endDate : ''} />

      {/* Type tabs */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass('weekly')} onClick={() => setType('weekly')}>毎週</button>
        <button type="button" className={tabClass('monthly_date')} onClick={() => setType('monthly_date')}>毎月（日付）</button>
        <button type="button" className={tabClass('monthly_weekday')} onClick={() => setType('monthly_weekday')}>毎月（曜日）</button>
        <button type="button" className={tabClass('interval')} onClick={() => setType('interval')}>N日ごと</button>
      </div>

      {/* Type-specific inputs */}
      {type === 'weekly' && (
        <div>
          <p className="label mb-2">繰り返す曜日（複数選択可）</p>
          <div className="flex gap-2">
            {[1,2,3,4,5,6,0].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                className={`w-10 h-10 rounded-full text-sm font-semibold transition-all ${
                  weeklyDays.includes(d)
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
                }`}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === 'monthly_date' && (
        <div>
          <label className="label">毎月 何日</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={31}
              value={monthlyDay}
              onChange={e => setMonthlyDay(parseInt(e.target.value) || 1)}
              className="input w-24"
            />
            <span className="text-gray-600 text-sm">日</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">月末より日数が少ない月は、その月の最終日に生成されます</p>
        </div>
      )}

      {type === 'monthly_weekday' && (
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">週</label>
            <select
              value={monthlyWeek}
              onChange={e => setMonthlyWeek(parseInt(e.target.value))}
              className="input w-28"
            >
              <option value={1}>第1週</option>
              <option value={2}>第2週</option>
              <option value={3}>第3週</option>
              <option value={4}>第4週</option>
              <option value={-1}>最終週</option>
            </select>
          </div>
          <div>
            <label className="label">曜日</label>
            <select
              value={monthlyWeekday}
              onChange={e => setMonthlyWeekday(parseInt(e.target.value))}
              className="input w-28"
            >
              {[1,2,3,4,5,6,0].map(d => (
                <option key={d} value={d}>{DAY_NAMES[d]}曜日</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {type === 'interval' && (
        <div>
          <label className="label">繰り返し間隔</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={365}
              value={intervalDays}
              onChange={e => setIntervalDays(parseInt(e.target.value) || 1)}
              className="input w-24"
            />
            <span className="text-gray-600 text-sm">日ごと</span>
          </div>
        </div>
      )}

      {/* Start / End date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">開始日 <span className="text-red-500">*</span></label>
          <input
            type="date" required
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">終了日</label>
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={!hasEndDate} onChange={() => setHasEndDate(false)} />
              なし
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={hasEndDate} onChange={() => setHasEndDate(true)} />
              日付を指定
            </label>
          </div>
          {hasEndDate && (
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="input"
            />
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-brand-700 mb-3">📅 次回の予定（直近5回）</p>
        {preview.length === 0 ? (
          <p className="text-sm text-gray-400">条件に一致する日程がありません</p>
        ) : (
          <ul className="space-y-1.5">
            {preview.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-brand-800">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                {d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
