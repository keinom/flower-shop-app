import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateShiftRequirements } from "../actions";

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

const DOW_LABELS = [
  { dow: 1, label: "月曜日", color: "text-gray-700" },
  { dow: 2, label: "火曜日", color: "text-gray-700" },
  { dow: 3, label: "水曜日", color: "text-gray-700" },
  { dow: 4, label: "木曜日", color: "text-gray-700" },
  { dow: 5, label: "金曜日", color: "text-gray-700" },
  { dow: 6, label: "土曜日", color: "text-blue-600" },
  { dow: 0, label: "日曜日", color: "text-red-600" },
];

export default async function ShiftRequirementsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  const { data: reqRows } = await supabase
    .from("shift_requirements")
    .select("day_of_week, am_required, pm_required, am_start, am_end, pm_start, pm_end");

  const reqMap = new Map<number, { am: number; pm: number }>();
  for (const r of reqRows ?? []) {
    reqMap.set(r.day_of_week, { am: r.am_required, pm: r.pm_required });
  }

  // 時間設定は全曜日共通（最初の行を代表値として使用）
  const timesRow = reqRows?.[0] ?? null;
  const amStart  = timesRow?.am_start ?? "09:00";
  const amEnd    = timesRow?.am_end   ?? "13:00";
  const pmStart  = timesRow?.pm_start ?? "13:00";
  const pmEnd    = timesRow?.pm_end   ?? "18:00";

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin/shifts" className="text-sm text-gray-500 hover:text-gray-700">
          ← シフト管理
        </a>
        <h1 className="text-xl font-bold text-gray-900">シフト設定</h1>
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

      <form action={updateShiftRequirements} className="space-y-5">

        {/* ── 時間帯設定（全曜日共通） ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">時間帯設定（全曜日共通）</h2>
          <p className="text-xs text-gray-500 mb-4">
            シフト希望画面のプリセット時刻と、自動生成時のカバレッジ判定に使用されます。
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-sky-600 block mb-1">午前 開始</label>
                <input
                  type="time"
                  name="am_start"
                  defaultValue={amStart}
                  className="input text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-sky-600 block mb-1">午前 終了</label>
                <input
                  type="time"
                  name="am_end"
                  defaultValue={amEnd}
                  className="input text-sm"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-amber-600 block mb-1">午後 開始</label>
                <input
                  type="time"
                  name="pm_start"
                  defaultValue={pmStart}
                  className="input text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-amber-600 block mb-1">午後 終了</label>
                <input
                  type="time"
                  name="pm_end"
                  defaultValue={pmEnd}
                  className="input text-sm"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 曜日別必要人数 ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">曜日別必要人数</h2>
          <p className="text-xs text-gray-500 mb-4">
            曜日ごとの午前・午後の必要人数を設定します。シフト自動生成時に参照されます。
          </p>

          {/* ヘッダー */}
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="text-xs font-semibold text-gray-500 px-2">曜日</div>
            <div className="text-xs font-semibold text-sky-600 text-center">午前 必要人数</div>
            <div className="text-xs font-semibold text-amber-600 text-center">午後 必要人数</div>
          </div>

          {DOW_LABELS.map(({ dow, label, color }) => {
            const req = reqMap.get(dow) ?? { am: 1, pm: 1 };
            return (
              <div key={dow} className="grid grid-cols-3 gap-3 items-center py-2 border-b border-gray-100 last:border-0">
                <div className={`text-sm font-semibold px-2 ${color}`}>{label}</div>
                <div>
                  <input
                    type="number"
                    name={`am_${dow}`}
                    defaultValue={req.am}
                    min={0}
                    max={20}
                    className="input text-center"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    name={`pm_${dow}`}
                    defaultValue={req.pm}
                    min={0}
                    max={20}
                    className="input text-center"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button type="submit" className="btn-primary w-full">
          設定を保存する
        </button>
      </form>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-700">
        <p className="font-semibold mb-1">自動生成の仕組み</p>
        <ul className="space-y-1 text-xs">
          <li>・ 従業員の希望時間と必要人数を照合してシフトを作成します</li>
          <li>・ 午前・午後の両方をカバーできる人が優先的に終日割り当てになります</li>
          <li>・ 月全体で均等に割り当てられるよう調整されます</li>
          <li>・ 希望人数が必要人数に満たない場合、⚠ マークが表示されます</li>
        </ul>
      </div>
    </div>
  );
}
