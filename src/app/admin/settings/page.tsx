import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTaxRate } from "./actions";

interface SettingsPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const sp = await searchParams;
  const supabase = await createClient();

  // 管理者のみアクセス可能
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/admin");

  // 現在の税率（最新の行）
  const { data: currentSetting } = await supabase
    .from("tax_settings")
    .select("rate, note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // 変更履歴（直近10件）
  const { data: history } = await supabase
    .from("tax_settings")
    .select("rate, note, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const currentRate = currentSetting?.rate ?? 10;

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-bold text-gray-900">設定</h1>

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

      {/* 消費税率設定 */}
      <div className="card p-5 space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-sm font-semibold text-gray-700">消費税率</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            変更しても、過去の注文に記録された税率・税額は変わりません。
          </p>
        </div>

        <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <span className="text-sm text-gray-600">現在の税率</span>
          <span className="text-2xl font-bold text-brand-700">{currentRate}%</span>
        </div>

        <form action={updateTaxRate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                新しい税率（%） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="rate"
                required
                min={0}
                max={100}
                defaultValue={currentRate}
                className="input"
              />
            </div>
            <div>
              <label className="label">
                変更メモ
                <span className="text-gray-400 text-xs font-normal ml-1">（任意）</span>
              </label>
              <input
                type="text"
                name="note"
                placeholder="例: 軽減税率対応"
                className="input"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            税率を更新する
          </button>
        </form>
      </div>

      {/* 変更履歴 */}
      {history && history.length > 1 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">変更履歴</h2>
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-800">{h.rate}%</span>
                  {h.note && (
                    <span className="text-gray-500 ml-2 text-xs">{h.note}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(h.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
