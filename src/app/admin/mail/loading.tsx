// 受信メール一覧 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function MailLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      {/* 同期バー・フィルタ */}
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-wrap gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* 一覧 */}
      <div className="card divide-y divide-gray-100 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
