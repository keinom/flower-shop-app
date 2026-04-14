"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShiftTimeSlot } from "@/types/database";

// ============================================================
// 従業員: シフト希望を保存
// ============================================================
export async function saveShiftPreferences(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawJson  = formData.get("preferences") as string | null;
  const yearStr  = formData.get("year") as string | null;
  const monthStr = formData.get("month") as string | null;

  if (!rawJson || !yearStr || !monthStr) {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("送信データが不完全です")}`);
  }

  type PrefEntry = { type: string; start_time: string | null; end_time: string | null };
  let prefs: Record<string, PrefEntry> = {};
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      prefs = parsed as Record<string, PrefEntry>;
    }
  } catch {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("データ形式が不正です")}`);
  }

  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("年月が不正です")}`);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const upsertRows = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pref    = prefs[dateStr] ?? { type: "off", start_time: null, end_time: null };
    const isAvail = pref.type === "available" && pref.start_time && pref.end_time;
    upsertRows.push({
      employee_id:     user.id,
      preference_date: dateStr,
      preference_type: isAvail ? "available" : "off",
      start_time:      isAvail ? pref.start_time : null,
      end_time:        isAvail ? pref.end_time   : null,
      updated_at:      new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from("shift_preferences")
    .upsert(upsertRows, { onConflict: "employee_id,preference_date" });

  if (error) {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("保存に失敗しました")}`);
  }

  revalidatePath("/admin/shifts");
  redirect(`/admin/shifts/my?success=${encodeURIComponent(`${year}年${month}月分のシフト希望を保存しました`)}`);
}

// ============================================================
// 管理者: 曜日別必要人数・時間帯を更新
// ============================================================
export async function updateShiftRequirements(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/shifts/requirements?error=" + encodeURIComponent("権限がありません"));
  }

  // グローバル時間設定（全曜日共通）
  const amStart = (formData.get("am_start") as string) || "09:00";
  const amEnd   = (formData.get("am_end")   as string) || "13:00";
  const pmStart = (formData.get("pm_start") as string) || "13:00";
  const pmEnd   = (formData.get("pm_end")   as string) || "18:00";

  const rows = [];
  for (let dow = 0; dow <= 6; dow++) {
    const amStr = (formData.get(`am_${dow}`) as string) || "0";
    const pmStr = (formData.get(`pm_${dow}`) as string) || "0";
    rows.push({
      day_of_week: dow,
      am_required: Math.max(0, parseInt(amStr, 10) || 0),
      pm_required: Math.max(0, parseInt(pmStr, 10) || 0),
      am_start:    amStart,
      am_end:      amEnd,
      pm_start:    pmStart,
      pm_end:      pmEnd,
      updated_at:  new Date().toISOString(),
      updated_by:  user.id,
    });
  }

  const { error } = await supabase
    .from("shift_requirements")
    .upsert(rows, { onConflict: "day_of_week" });

  if (error) {
    redirect("/admin/shifts/requirements?error=" + encodeURIComponent("保存に失敗しました"));
  }

  revalidatePath("/admin/shifts");
  redirect("/admin/shifts/requirements?success=" + encodeURIComponent("設定を更新しました"));
}

// ============================================================
// 管理者: シフトを自動生成
// ============================================================
export async function generateShifts(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/shifts?error=" + encodeURIComponent("権限がありません"));
  }

  const year  = parseInt(formData.get("year") as string, 10);
  const month = parseInt(formData.get("month") as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    redirect("/admin/shifts?error=" + encodeURIComponent("年月が不正です"));
  }

  // 1. 曜日別必要人数・時間帯を取得
  const { data: reqRows } = await supabase
    .from("shift_requirements")
    .select("day_of_week, am_required, pm_required, am_start, am_end, pm_start, pm_end");

  type ReqEntry = { am: number; pm: number; amStart: string; amEnd: string; pmStart: string; pmEnd: string };
  const requirements = new Map<number, ReqEntry>();
  for (const r of reqRows ?? []) {
    requirements.set(r.day_of_week, {
      am:      r.am_required,
      pm:      r.pm_required,
      amStart: r.am_start ?? "09:00",
      amEnd:   r.am_end   ?? "13:00",
      pmStart: r.pm_start ?? "13:00",
      pmEnd:   r.pm_end   ?? "18:00",
    });
  }
  const defaultReq: ReqEntry = { am: 0, pm: 0, amStart: "09:00", amEnd: "13:00", pmStart: "13:00", pmEnd: "18:00" };

  // 2. 対象月の希望を全員分取得（時間情報を含む）
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const { data: prefRows } = await supabase
    .from("shift_preferences")
    .select("employee_id, preference_date, preference_type, start_time, end_time")
    .gte("preference_date", startDate)
    .lte("preference_date", endDate);

  type PrefData = { type: string; start_time: string | null; end_time: string | null };
  const prefMap = new Map<string, Map<string, PrefData>>();
  for (const p of prefRows ?? []) {
    if (!prefMap.has(p.preference_date)) prefMap.set(p.preference_date, new Map());
    prefMap.get(p.preference_date)!.set(p.employee_id, {
      type:       p.preference_type,
      start_time: p.start_time,
      end_time:   p.end_time,
    });
  }

  // 3. 全スタッフのIDを取得
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "employee"]);
  const staffIds = (staffProfiles ?? []).map((p) => p.id);

  // 4. 確定済みシフトを取得（UNIQUE制約保護）
  const { data: confirmedRows } = await supabase
    .from("shifts")
    .select("employee_id, shift_date")
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .eq("status", "confirmed");

  const confirmedSet = new Set(
    (confirmedRows ?? []).map((s) => `${s.employee_id}_${s.shift_date}`)
  );

  // 5. 各日のシフトを生成
  const daysInMonth = new Date(year, month, 0).getDate();
  const shiftRows: {
    employee_id: string;
    shift_date:  string;
    time_slot:   ShiftTimeSlot;
    start_time:  string;
    end_time:    string;
    status:      "draft";
    updated_at:  string;
  }[] = [];

  const workload = new Map<string, number>(staffIds.map((id) => [id, 0]));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const jsDate  = new Date(year, month - 1, d);
    const dow     = jsDate.getDay();

    const req = requirements.get(dow) ?? defaultReq;
    if (req.am === 0 && req.pm === 0) continue;

    const dayPrefs = prefMap.get(dateStr) ?? new Map<string, PrefData>();

    // 時間カバレッジによる出勤可否判定
    type AvailEntry = { id: string; coversAm: boolean; coversPm: boolean };
    const available: AvailEntry[] = [];
    for (const staffId of staffIds) {
      if (confirmedSet.has(`${staffId}_${dateStr}`)) continue;
      const pref = dayPrefs.get(staffId);
      if (!pref || pref.type !== "available" || !pref.start_time || !pref.end_time) continue;

      const s = pref.start_time;
      const e = pref.end_time;
      const coversAm = s <= req.amStart && e >= req.amEnd;
      const coversPm = s <= req.pmStart && e >= req.pmEnd;
      if (coversAm || coversPm) {
        available.push({ id: staffId, coversAm, coversPm });
      }
    }

    const sortByWorkload = (arr: AvailEntry[]) =>
      [...arr].sort((a, b) => (workload.get(a.id) ?? 0) - (workload.get(b.id) ?? 0));

    // FULL可能（AM・PM両方カバー）、AM専用、PM専用のプール
    const fullPool = sortByWorkload(available.filter((e) => e.coversAm && e.coversPm));
    const amPool   = sortByWorkload(available.filter((e) => e.coversAm && !e.coversPm));
    const pmPool   = sortByWorkload(available.filter((e) => e.coversPm && !e.coversAm));

    const assigned  = new Set<string>();
    const dayShifts: typeof shiftRows = [];

    const now = new Date().toISOString();

    // FULL割り当て
    const fullNeeded   = Math.min(req.am, req.pm);
    const fullAssigned = fullPool.slice(0, fullNeeded);
    for (const e of fullAssigned) {
      dayShifts.push({
        employee_id: e.id, shift_date: dateStr,
        time_slot: "FULL", start_time: req.amStart, end_time: req.pmEnd,
        status: "draft", updated_at: now,
      });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 2);
    }

    let remAm = req.am - fullAssigned.length;
    let remPm = req.pm - fullAssigned.length;
    const unusedFull = sortByWorkload(fullPool.filter((e) => !assigned.has(e.id)));

    // AM補充
    for (const e of [...amPool, ...unusedFull]) {
      if (remAm <= 0) break;
      if (assigned.has(e.id)) continue;
      dayShifts.push({
        employee_id: e.id, shift_date: dateStr,
        time_slot: "AM", start_time: req.amStart, end_time: req.amEnd,
        status: "draft", updated_at: now,
      });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 1);
      remAm--;
    }

    // PM補充
    for (const e of [...pmPool, ...unusedFull.filter((e) => !assigned.has(e.id))]) {
      if (remPm <= 0) break;
      if (assigned.has(e.id)) continue;
      dayShifts.push({
        employee_id: e.id, shift_date: dateStr,
        time_slot: "PM", start_time: req.pmStart, end_time: req.pmEnd,
        status: "draft", updated_at: now,
      });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 1);
      remPm--;
    }

    shiftRows.push(...dayShifts);
  }

  // 6. 既存の下書きシフトを削除
  await supabase
    .from("shifts")
    .delete()
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .eq("status", "draft");

  // 7. 新しい下書きシフトを挿入
  if (shiftRows.length > 0) {
    const { error } = await supabase.from("shifts").insert(shiftRows);
    if (error) {
      redirect(`/admin/shifts?year=${year}&month=${month}&error=` + encodeURIComponent("シフト生成に失敗しました: " + error.message));
    }
  }

  revalidatePath("/admin/shifts");
  redirect(
    `/admin/shifts?year=${year}&month=${month}&success=` +
    encodeURIComponent(
      shiftRows.length === 0
        ? "希望提出がないためシフトを生成できませんでした"
        : `${year}年${month}月のシフトを生成しました（${shiftRows.length}件・下書き）`
    )
  );
}

// ============================================================
// 管理者: シフトを確定（draft → confirmed）
// ============================================================
export async function confirmShifts(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/shifts?error=" + encodeURIComponent("権限がありません"));
  }

  const year  = formData.get("year") as string;
  const month = formData.get("month") as string;

  if (!year || !month) {
    redirect("/admin/shifts?error=" + encodeURIComponent("年月が不正です"));
  }

  const startDate = `${year}-${month.padStart(2, "0")}-01`;
  const endDate   = `${year}-${month.padStart(2, "0")}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;

  const { error } = await supabase
    .from("shifts")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .eq("status", "draft");

  if (error) {
    redirect(`/admin/shifts?year=${year}&month=${month}&error=` + encodeURIComponent("確定処理に失敗しました"));
  }

  revalidatePath("/admin/shifts");
  redirect(`/admin/shifts?year=${year}&month=${month}&success=` + encodeURIComponent("シフトを確定しました"));
}
