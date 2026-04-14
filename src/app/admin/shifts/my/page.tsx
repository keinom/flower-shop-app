import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShiftPreferenceCalendar } from "@/components/admin/ShiftPreferenceCalendar";

interface Props {
  searchParams: Promise<{ year?: string; month?: string; success?: string; error?: string }>;
}

export default async function MyShiftPreferencePage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "employee") redirect("/login");

  // 表示する月（デフォルト: 翌月）
  const now      = new Date();
  const defYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;

  const year  = sp.year  ? parseInt(sp.year, 10)  : defYear;
  const month = sp.month ? parseInt(sp.month, 10) : defMonth;

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  // 既存の希望を取得（時間情報を含む）
  const { data: existingRows } = await supabase
    .from("shift_preferences")
    .select("preference_date, preference_type, start_time, end_time")
    .eq("employee_id", user.id)
    .gte("preference_date", startDate)
    .lte("preference_date", endDate);

  const existing: Record<string, { start_time: string | null; end_time: string | null }> = {};
  for (const row of existingRows ?? []) {
    existing[row.preference_date] = {
      start_time: row.start_time,
      end_time:   row.end_time,
    };
  }

  const submitted = (existingRows ?? []).some((r) => r.preference_type === "available");

  // 時間プリセットを shift_requirements から取得（月曜の設定を代表値として使用）
  const { data: reqRows } = await supabase
    .from("shift_requirements")
    .select("am_start, am_end, pm_start, pm_end")
    .order("day_of_week", { ascending: true })
    .limit(1);

  const presetTimes = reqRows?.[0] ?? null;
  const amStart = presetTimes?.am_start ?? "09:00";
  const amEnd   = presetTimes?.am_end   ?? "13:00";
  const pmStart = presetTimes?.pm_start ?? "13:00";
  const pmEnd   = presetTimes?.pm_end   ?? "18:00";

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">シフト希望提出</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile?.display_name ?? user.email} さんの希望
          </p>
        </div>

        {/* 月ナビゲーション */}
        <div className="flex items-center gap-2">
          <a href={`/admin/shifts/my?year=${prevYear}&month=${prevMonth}`} className="btn-secondary text-sm px-3 py-1.5">
            ← 前月
          </a>
          <span className="text-sm font-semibold text-gray-800 px-2">
            {year}年{month}月
          </span>
          <a href={`/admin/shifts/my?year=${nextYear}&month=${nextMonth}`} className="btn-secondary text-sm px-3 py-1.5">
            翌月 →
          </a>
        </div>
      </div>

      {sp.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {decodeURIComponent(sp.success)}
        </div>
      )}
      {sp.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* 提出ステータス */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
        submitted
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}>
        <span>{submitted ? "✅" : "⚠️"}</span>
        <span>{submitted ? "この月の希望は提出済みです。変更後に再保存できます。" : "まだこの月の希望を提出していません。"}</span>
      </div>

      {/* 時間帯プリセット表示 */}
      <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
        <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 rounded-full text-sky-700 font-medium">
          午前: {amStart.replace(/^0/, "")}〜{amEnd.replace(/^0/, "")}
        </span>
        <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700 font-medium">
          午後: {pmStart.replace(/^0/, "")}〜{pmEnd.replace(/^0/, "")}
        </span>
        <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 font-medium">
          終日: {amStart.replace(/^0/, "")}〜{pmEnd.replace(/^0/, "")}
        </span>
      </div>

      {/* カレンダー */}
      <div className="card p-5">
        <ShiftPreferenceCalendar
          year={year}
          month={month}
          existing={existing}
          amStart={amStart}
          amEnd={amEnd}
          pmStart={pmStart}
          pmEnd={pmEnd}
        />
      </div>
    </div>
  );
}
