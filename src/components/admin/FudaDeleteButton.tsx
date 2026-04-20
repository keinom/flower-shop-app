"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFudaDocument } from "@/app/admin/fuda/actions";

interface Props {
  id:       string;
  fileName: string;
}

export function FudaDeleteButton({ id, fileName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    // リンク行のナビゲーションを止める
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`「${fileName}」を削除しますか？\nこの操作は元に戻せません。`)) return;

    startTransition(async () => {
      const res = await deleteFudaDocument(id);
      if (res.error) {
        alert(`削除に失敗しました: ${res.error}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="削除"
      className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {isPending ? (
        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 3.5 13 3.5" />
          <path d="M2.5 3.5V12a1 1 0 001 1h7a1 1 0 001-1V3.5" />
          <path d="M4.5 3.5V2a1 1 0 011-1h3a1 1 0 011 1v1.5" />
          <line x1="5.5" y1="6" x2="5.5" y2="10" />
          <line x1="8.5" y1="6" x2="8.5" y2="10" />
        </svg>
      )}
    </button>
  );
}
