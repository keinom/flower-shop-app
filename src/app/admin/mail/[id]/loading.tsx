// 受信メール詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function MailDetailLoading() {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* ヘッダ情報 */}
      <div className="card p-5 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>

      {/* 顧客・本文 */}
      <div className="card p-5">
        <Skeleton className="h-4 w-12 mb-3" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* 対応状況 */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-20" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}
