// シフト希望提出 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function ShiftsMyLoading() {
  return (
    <div className="space-y-6">
      {/* ヘッダー + 月ナビゲーション */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      {/* 提出ステータス */}
      <Skeleton className="h-11 w-full rounded-lg" />

      {/* 時間帯プリセット */}
      <div className="flex gap-3 flex-wrap">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-32 rounded-full" />
        ))}
      </div>

      {/* カレンダー */}
      <div className="card p-5">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-6 mx-auto" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(35)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
