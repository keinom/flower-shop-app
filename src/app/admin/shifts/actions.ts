"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShiftPreferenceType, ShiftTimeSlot } from "@/types/database";

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

  // redirect() は never を返すので TypeScript はここに到達しないと分かるが
  // 念のため型を明示してデフォルト値を設定
  let prefs: Record<string, ShiftPreferenceType> = {};
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      prefs = parsed as Record<string, ShiftPreferenceType>;
    }
  } catch {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("データ形式が不正です")}`);
  }

  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    redirect(`/admin/shifts/my?error=${encodeURIComponent("年月が不正です")}`);
  }

  // 対象月の全日付を列挙してupsert
  const daysInMonth = new Date(year, month, 0).getDate(); // month は 1-12 なので正しい
  const upsertRows = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const type = (prefs[dateStr] ?? "off") as ShiftPreferenceType;
    upsertRows.push({
      employee_id:     user.id,
      preference_date: dateStr,
      preference_type: type,
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
// 管理者: 曜日別必要人数を更新
// ============================================================
export async function updateShiftRequirements(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    redirect("/admin/shifts/requirements?error=" + encodeURIComponent("権限がありません"));
  }

  const rows = [];
  for (let dow = 0; dow <= 6; dow++) {
    const amStr = (formData.get(`am_${dow}`) as string) || "0";
    const pmStr = (formData.get(`pm_${dow}`) as string) || "0";
    rows.push({
      day_of_week: dow,
      am_required: Math.max(0, parseInt(amStr, 10) || 0),
      pm_required: Math.max(0, parseInt(pmStr, 10) || 0),
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
  redirect("/admin/shifts/requirements?success=" + encodeURIComponent("必要人数を更新しました"));
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

  // 1. 曜日別必要人数を取得
  const { data: reqRows } = await supabase
    .from("shift_requirements")
    .select("day_of_week, am_required, pm_required");

  const requirements = new Map<number, { am: number; pm: number }>();
  for (const r of reqRows ?? []) {
    requirements.set(r.day_of_week, { am: r.am_required, pm: r.pm_required });
  }

  // 2. 対象月の希望を全員分取得
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate   = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const { data: prefRows } = await supabase
    .from("shift_preferences")
    .select("employee_id, preference_date, preference_type")
    .gte("preference_date", startDate)
    .lte("preference_date", endDate);

  // 希望マップ: date → employee_id → type
  const prefMap = new Map<string, Map<string, ShiftPreferenceType>>();
  for (const p of prefRows ?? []) {
    if (!prefMap.has(p.preference_date)) prefMap.set(p.preference_date, new Map());
    prefMap.get(p.preference_date)!.set(p.employee_id, p.preference_type as ShiftPreferenceType);
  }

  // 3. 全スタッフ（admin + employee）のIDを取得
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "employee"]);
  const staffIds = (staffProfiles ?? []).map((p) => p.id);

  // 4. 確定済みシフトを取得（これらの日付・従業員は生成から除外する）
  //    UNIQUE制約 (employee_id, shift_date, time_slot) 違反を防ぐため
  const { data: confirmedRows } = await supabase
    .from("shifts")
    .select("employee_id, shift_date")
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .eq("status", "confirmed");

  // 確定済みセット: "employee_id_date" → true
  const confirmedSet = new Set(
    (confirmedRows ?? []).map((s) => `${s.employee_id}_${s.shift_date}`)
  );

  // 5. 各日のシフトを生成
  const daysInMonth = new Date(year, month, 0).getDate();
  const shiftRows: {
    employee_id: string;
    shift_date: string;
    time_slot: ShiftTimeSlot;
    status: "draft";
    updated_at: string;
  }[] = [];

  // 均等配分のため、今月の累計割り当て数を追跡
  const workload = new Map<string, number>(staffIds.map((id) => [id, 0]));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const jsDate  = new Date(year, month - 1, d);
    const dow     = jsDate.getDay(); // 0=日, 1=月 ... 6=土

    const req = requirements.get(dow) ?? { am: 0, pm: 0 };
    if (req.am === 0 && req.pm === 0) continue; // 人数不要な曜日はスキップ

    const dayPrefs = prefMap.get(dateStr) ?? new Map<string, ShiftPreferenceType>();

    // この日に出勤可能なスタッフを抽出
    // - off/未提出は除外
    // - 確定済みシフトがある日は除外（UNIQUE制約保護）
    const available: { id: string; type: "full" | "am" | "pm" }[] = [];
    for (const staffId of staffIds) {
      if (confirmedSet.has(`${staffId}_${dateStr}`)) continue; // 確定済み → スキップ
      const pref = dayPrefs.get(staffId) ?? "off";
      if (pref === "off") continue;
      available.push({ id: staffId, type: pref as "full" | "am" | "pm" });
    }

    // 割り当てアルゴリズム（workloadが少ない順に優先 = 均等配分）
    const sortByWorkload = (arr: typeof available) =>
      [...arr].sort((a, b) => (workload.get(a.id) ?? 0) - (workload.get(b.id) ?? 0));

    const fullPool = sortByWorkload(available.filter((e) => e.type === "full"));
    const amPool   = sortByWorkload(available.filter((e) => e.type === "am"));
    const pmPool   = sortByWorkload(available.filter((e) => e.type === "pm"));

    const assigned = new Set<string>();
    const dayShifts: typeof shiftRows = [];

    // FULL割り当て: AM/PMの両方を一人でカバー（少ない方の需要数だけ）
    const fullNeeded    = Math.min(req.am, req.pm);
    const fullAssigned  = fullPool.slice(0, fullNeeded);
    for (const e of fullAssigned) {
      dayShifts.push({ employee_id: e.id, shift_date: dateStr, time_slot: "FULL", status: "draft", updated_at: new Date().toISOString() });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 2); // 終日 = 2カウント
    }

    let remAm = req.am - fullAssigned.length;
    let remPm = req.pm - fullAssigned.length;
    const unusedFull = sortByWorkload(fullPool.filter((e) => !assigned.has(e.id)));

    // AM補充: AM専用 → 余剰のFULL可能者
    for (const e of [...amPool, ...unusedFull]) {
      if (remAm <= 0) break;
      if (assigned.has(e.id)) continue;
      dayShifts.push({ employee_id: e.id, shift_date: dateStr, time_slot: "AM", status: "draft", updated_at: new Date().toISOString() });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 1);
      remAm--;
    }

    // PM補充: PM専用 → 余剰のFULL可能者
    for (const e of [...pmPool, ...unusedFull.filter((e) => !assigned.has(e.id))]) {
      if (remPm <= 0) break;
      if (assigned.has(e.id)) continue;
      dayShifts.push({ employee_id: e.id, shift_date: dateStr, time_slot: "PM", status: "draft", updated_at: new Date().toISOString() });
      assigned.add(e.id);
      workload.set(e.id, (workload.get(e.id) ?? 0) + 1);
      remPm--;
    }

    shiftRows.push(...dayShifts);
  }

  // 6. 既存の下書きシフトのみ削除（確定済みは保持）
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

  const generatedCount = shiftRows.length;
  revalidatePath("/admin/shifts");
  redirect(
    `/admin/shifts?year=${year}&month=${month}&success=` +
    encodeURIComponent(
      generatedCount === 0
        ? "希望提出がないためシフトを生成できませんでした"
        : `${year}年${month}月のシフトを生成しました（${generatedCount}件・下書き）`
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
