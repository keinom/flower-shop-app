// 立て札詳細 ローディングスケルトン
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ""}`} />;
}

export default function FudaDetailLoading() {
  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* PDFプレビュー + 抽出結果 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-[480px] w-full rounded-xl" />
        <div className="card p-5 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
