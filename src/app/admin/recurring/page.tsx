import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { describeRecurrence } from "@/lib/recurring";
import { getNextOccurrences } from "@/lib/recurring";
import type { RecurrenceRule } from "@/lib/recurring";

export default async function RecurringOrdersPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("recurring_order_templates")
    .select("*, customers(id, name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">定期注文</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            繰り返し注文のテンプレートを管理します
          </p>
        </div>
        <Link href="/admin/recurring/new" className="btn-primary">
          ＋ 新規作成
        </Link>
      </div>

      {/* テンプレート一覧 */}
      {!templates || templates.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-sm">定期注文テンプレートがありません</p>
          <Link href="/admin/recurring/new" className="mt-4 inline-block btn-primary text-sm">
            最初のテンプレートを作成する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const customer = template.customers as { id: string; name: string } | null;
            const rule: RecurrenceRule = {
              recurrence_type: template.recurrence_type as RecurrenceRule['recurrence_type'],
              weekly_days: template.weekly_days,
              monthly_day: template.monthly_day,
              monthly_week: template.monthly_week,
              monthly_weekday: template.monthly_weekday,
              interval_days: template.interval_days,
              start_date: template.start_date,
              end_date: template.end_date,
            };
            const description = describeRecurrence(rule);
            const nextDates = getNextOccurrences(rule, new Date(), 1);
            const nextDate = nextDates[0];

            return (
              <div key={template.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 text-sm">
                        {template.title}
                      </h2>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          template.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {template.is_active ? "有効" : "停止中"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {customer && (
                        <span>
                          顧客:{" "}
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="text-brand-700 hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </span>
                      )}
                      <span>繰り返し: {description}</span>
                      {nextDate && (
                        <span>
                          次回:{" "}
                          {nextDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          })}
                        </span>
                      )}
                      <span>
                        注文種別:{" "}
                        <span className="font-medium text-gray-700">
                          {template.order_type}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/recurring/${template.id}`}
                    className="btn-secondary text-xs flex-shrink-0"
                  >
                    詳細 →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
