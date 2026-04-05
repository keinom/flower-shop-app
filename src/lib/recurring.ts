export type RecurrenceType = 'weekly' | 'monthly_date' | 'monthly_weekday' | 'interval';

export interface RecurrenceRule {
  recurrence_type: RecurrenceType;
  weekly_days: number[] | null;
  monthly_day: number | null;
  monthly_week: number | null;
  monthly_weekday: number | null;
  interval_days: number | null;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function shouldGenerateOnDate(rule: RecurrenceRule, date: Date): boolean {
  const start = new Date(rule.start_date + 'T00:00:00');
  const check = new Date(date); check.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  if (check < start) return false;
  if (rule.end_date) {
    const end = new Date(rule.end_date + 'T00:00:00'); end.setHours(0,0,0,0);
    if (check > end) return false;
  }
  const dow = check.getDay();
  const dom = check.getDate();
  switch (rule.recurrence_type) {
    case 'weekly':
      return (rule.weekly_days ?? []).includes(dow);
    case 'monthly_date': {
      if (rule.monthly_day == null) return false;
      const daysInMonth = new Date(check.getFullYear(), check.getMonth() + 1, 0).getDate();
      return dom === Math.min(rule.monthly_day, daysInMonth);
    }
    case 'monthly_weekday': {
      if (rule.monthly_week == null || rule.monthly_weekday == null) return false;
      if (dow !== rule.monthly_weekday) return false;
      if (rule.monthly_week === -1) {
        const next = new Date(check); next.setDate(dom + 7);
        return next.getMonth() !== check.getMonth();
      }
      return Math.floor((dom - 1) / 7) + 1 === rule.monthly_week;
    }
    case 'interval': {
      if (!rule.interval_days || rule.interval_days < 1) return false;
      const diff = Math.round((check.getTime() - start.getTime()) / 86400000);
      return diff >= 0 && diff % rule.interval_days === 0;
    }
    default: return false;
  }
}

export function getNextOccurrences(rule: RecurrenceRule, from: Date, count: number): Date[] {
  const results: Date[] = [];
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  let i = 0;
  while (results.length < count && i < 400) {
    if (shouldGenerateOnDate(rule, cur)) results.push(new Date(cur));
    cur.setDate(cur.getDate() + 1); i++;
  }
  return results;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  switch (rule.recurrence_type) {
    case 'weekly':
      return '毎週 ' + (rule.weekly_days ?? []).sort((a,b)=>a-b).map(d => DAY_NAMES[d]+'曜日').join('・');
    case 'monthly_date':
      return `毎月 ${rule.monthly_day}日`;
    case 'monthly_weekday': {
      const wl = rule.monthly_week === -1 ? '最終' : `第${rule.monthly_week}`;
      return `毎月 ${wl}${DAY_NAMES[rule.monthly_weekday ?? 1]}曜日`;
    }
    case 'interval':
      return `${rule.interval_days}日ごと`;
    default: return '';
  }
}
