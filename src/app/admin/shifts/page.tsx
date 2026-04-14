import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShifts, confirmShifts } from "./actions";
import type { ShiftTimeSlot, ShiftStatus } from "@/types/database";

interface Props {
  searchParams: Promise<{
    year?: string; month?: string; success?: string; error?: string;
  }>;
}

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------
function prefBadge(
  type: string,
  startTime: string | null,
  endTime: string | null
): { label: string; style: string } {
  if (type !== "available" || !startTime || !endTime) {
    return { label: "―", style: "text-gray-300" };
  }
  const s = startTime.replace(/^0/, "");
  const e = endTime.replace(/^0/, "");
  return { label: `${s}-${e}`, style: "bg-emerald-100 text-emerald-700 text-xs" };
}
const SLOT_LABEL: Record<ShiftTimeSlot, string> = {
  FULL: "終日", AM: "午前", PM: "午後",
};
const SLOT_COLOR: Record<ShiftTimeSlot, string> = {
  FULL: "bg-emerald-500 text-white",
  AM:   "bg-sky-500 text-white",
  PM:   "bg-amber-500 text-white",
};
const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

export default async function ShiftsAdminPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();

  // 管理者のみ
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin/shifts/my");

  // 表示月（デフォルト: 翌月）
  const now = new Date();
  const defYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const year  = sp.year  ? parseInt(sp.year, 10)  : defYear;
  const month = sp.month ? parseInt(sp.month, 10) : defMonth;

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;

  // 日付リスト
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return {
      str: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      day: i + 1,
      dow: d.getDay(),
    };
  });

  // スタッフ情報
  const adminClient = createAdminClient();
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .in("role", ["admin", "employee"])
    .order("created_at", { ascending: true });
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const staff = (staffProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name ?? emailMap.get(p.id) ?? "不明",
    role: p.role,
  }));

  // 希望データ
  const { data: prefRows } = await supabase
    .from("shift_preferences")
    .select("employee_id, preference_date, preference_type, start_time, end_time")
    .gte("preference_date", startDate)
    .lte("preference_date", endDate);

  type PrefEntry = { type: string; start_time: string | null; end_time: string | null };
  // prefMap: employeeId → dateStr → PrefEntry
  const prefMap = new Map<string, Map<string, PrefEntry>>();
  for (const row of prefRows ?? []) {
    if (!prefMap.has(row.employee_id)) prefMap.set(row.employee_id, new Map());
    prefMap.get(row.employee_id)!.set(row.preference_date, {
      type:       row.preference_type,
      start_time: row.start_time,
      end_time:   row.end_time,
    });
  }

  // 生成済みシフト
  const { data: shiftRows } = await supabase
    .from("shifts")
    .select("employee_id, shift_date, time_slot, status")
    .gte("shift_date", startDate)
    .lte("shift_date", endDate);

  // shiftMap: dateStr → { slot → [employeeId] }
  const shiftMap = new Map<string, Map<ShiftTimeSlot, string[]>>();
  let hasShifts   = false;
  let hasDraft     = false;
  let hasConfirmed = false;
  for (const row of shiftRows ?? []) {
    hasShifts = true;
    if (row.status === "draft")     hasDraft = true;
    if (row.status === "confirmed") hasConfirmed = true;
    if (!shiftMap.has(row.shift_date)) shiftMap.set(row.shift_date, new Map());
    const slotMap = shiftMap.get(row.shift_date)!;
    const slot = row.time_slot as ShiftTimeSlot;
    if (!slotMap.has(slot)) slotMap.set(slot, []);
    slotMap.get(slot)!.push(row.employee_id);
  }

  // 曜日別必要人数
  const { data: reqRows } = await supabase
    .from("shift_requirements")
    .select("day_of_week, am_required, pm_required");
  const reqMap = new Map<number, { am: number; pm: number }>();
  for (const r of reqRows ?? []) {
    reqMap.set(r.day_of_week, { am: r.am_required, pm: r.pm_required });
  }

  // 希望提出人数（少なくとも1日でも「出勤可」を提出した人）
  const submittedCount = staff.filter((s) =>
    Array.from(prefMap.get(s.id)?.values() ?? []).some((v) => v.type === "available")
  ).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">シフト管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            希望提出状況の確認とシフト自動生成
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/admin/shifts?year=${prevYear}&month=${prevMonth}`} className="btn-secondary text-sm px-3 py-1.5">← 前月</a>
          <span className="font-semibold text-gray-800 text-sm px-2">{year}年{month}月</span>
          <a href={`/admin/shifts?year=${nextYear}&month=${nextMonth}`} className="btn-secondary text-sm px-3 py-1.5">翌月 →</a>
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

      {/* ステータスバー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-brand-700">{staff.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">スタッフ数</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{submittedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">希望提出済み</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-sky-600">{shiftRows?.filter(s => s.status === "draft").length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">下書きシフト数</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{shiftRows?.filter(s => s.status === "confirmed").length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">確定シフト数</p>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3 flex-wrap items-center">
        <form action={generateShifts}>
          <input type="hidden" name="year"  value={year} />
          <input type="hidden" name="month" value={month} />
          <button type="submit" className="btn-primary">
            🔄 シフトを自動生成（下書き）
          </button>
        </form>
        {hasDraft && (
          <form action={confirmShifts}>
            <input type="hidden" name="year"  value={year} />
            <input type="hidden" name="month" value={month} />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              ✅ 下書きを確定する
            </button>
          </form>
        )}
        <a href="/admin/shifts/requirements" className="btn-secondary text-sm">
          ⚙️ 必要人数の設定
        </a>
      </div>

      {/* ──────────────────────────────────────────────
          希望提出状況テーブル
      ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">希望提出状況</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(600, dates.length * 38 + 120)}px` }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[90px]">
                  従業員
                </th>
                {dates.map(({ day, dow, str }) => (
                  <th
                    key={str}
                    className={`px-1 py-1.5 text-center font-semibold border-b border-gray-200 min-w-[34px] ${
                      dow === 0 ? "text-red-500 bg-red-50" : dow === 6 ? "text-blue-500 bg-blue-50" : "text-gray-600"
                    }`}
                  >
                    <div>{day}</div>
                    <div className="font-normal opacity-70">{DOW_JP[dow]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {staff.map((s) => {
                const myPrefs = prefMap.get(s.id);
                const hasAny = myPrefs && Array.from(myPrefs.values()).some((v) => v.type === "available");
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[70px]">{s.name}</span>
                        {!hasAny && (
                          <span className="text-amber-500 text-xs" title="未提出">⚠</span>
                        )}
                      </div>
                    </td>
                    {dates.map(({ str, dow }) => {
                      const pref  = myPrefs?.get(str) ?? { type: "off", start_time: null, end_time: null };
                      const badge = prefBadge(pref.type, pref.start_time, pref.end_time);
                      return (
                        <td
                          key={str}
                          className={`px-0.5 py-1 text-center border-gray-100 ${
                            dow === 0 ? "bg-red-50/30" : dow === 6 ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {pref.type === "available" ? (
                            <span className={`inline-block font-semibold px-1 py-0.5 rounded ${badge.style}`}>
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-gray-200">―</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* 必要人数行 */}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="sticky left-0 bg-gray-50 z-10 px-3 py-2 border-r border-gray-200 font-semibold text-gray-700 text-xs">
                  必要人数<br />(前/後)
                </td>
                {dates.map(({ str, dow }) => {
                  const req = reqMap.get(dow) ?? { am: 0, pm: 0 };
                  return (
                    <td key={str} className={`px-0.5 py-1 text-center text-xs ${
                      dow === 0 ? "bg-red-50/30" : dow === 6 ? "bg-blue-50/30" : ""
                    }`}>
                      <div className="text-sky-600 font-semibold">{req.am}</div>
                      <div className="text-amber-600 font-semibold">{req.pm}</div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          生成済みシフト表
      ────────────────────────────────────────────── */}
      {hasShifts && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-sm font-semibold text-gray-700">生成済みシフト表</h2>
            {hasDraft && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">下書き</span>
            )}
            {hasConfirmed && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">確定済み含む</span>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(600, dates.length * 80 + 80)}px` }}>
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[60px]">
                    枠
                  </th>
                  {dates.map(({ day, dow, str }) => (
                    <th
                      key={str}
                      className={`px-1 py-1.5 text-center font-semibold border-b border-gray-200 min-w-[70px] ${
                        dow === 0 ? "text-red-500 bg-red-50" : dow === 6 ? "text-blue-500 bg-blue-50" : "text-gray-600"
                      }`}
                    >
                      <div>{day}({DOW_JP[dow]})</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {(["FULL", "AM", "PM"] as ShiftTimeSlot[]).map((slot) => (
                  <tr key={slot} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-3 py-2 border-r border-gray-200 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-xs ${SLOT_COLOR[slot]}`}>
                        {SLOT_LABEL[slot]}
                      </span>
                    </td>
                    {dates.map(({ str, dow }) => {
                      const assigned    = shiftMap.get(str)?.get(slot) ?? [];
                      const fullCount   = shiftMap.get(str)?.get("FULL")?.length ?? 0;
                      const req         = reqMap.get(dow) ?? { am: 0, pm: 0 };

                      // FULL勤務者はAM・PMの両方をカバーするため、充足チェックに加算
                      const covered =
                        slot === "AM"   ? assigned.length + fullCount :
                        slot === "PM"   ? assigned.length + fullCount :
                        /* FULL */        assigned.length;
                      const needed =
                        slot === "AM"   ? req.am :
                        slot === "PM"   ? req.pm :
                        /* FULL */        0;
                      const fulfilled = slot === "FULL" || needed === 0 || covered >= needed;

                      return (
                        <td
                          key={str}
                          className={`px-1 py-1.5 text-center border-gray-100 align-top ${
                            dow === 0 ? "bg-red-50/30" : dow === 6 ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {assigned.length > 0 ? (
                            <div className="space-y-0.5">
                              {assigned.map((empId) => {
                                const emp = staff.find((s) => s.id === empId);
                                return (
                                  <div
                                    key={empId}
                                    className={`text-xs px-1 py-0.5 rounded font-medium ${SLOT_COLOR[slot]} opacity-90`}
                                  >
                                    {emp?.name ?? "?"}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-200">―</span>
                          )}
                          {/* 不足表示: FULL勤務者を加味した上でも人数不足の場合のみ表示 */}
                          {slot !== "FULL" && needed > 0 && !fulfilled && (
                            <div className="text-red-500 font-bold mt-0.5 text-xs">
                              ⚠{covered}/{needed}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ※ ⚠ は必要人数に不足があることを示します（希望提出が少ない可能性があります）
          </p>
        </div>
      )}
    </div>
  );
}
