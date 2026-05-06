"use client";

import { deleteTemplate } from "@/app/admin/recurring/[id]/actions";

interface Props {
  templateId: string;
}

export function DeleteTemplateButton({ templateId }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("このテンプレートを削除しますか？\n\n関連する注文のテンプレートリンクは外れますが、注文自体は削除されません。")) {
      e.preventDefault();
    }
  };

  return (
    <form action={deleteTemplate} onSubmit={handleSubmit}>
      <input type="hidden" name="template_id" value={templateId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold transition-colors"
      >
        <span>🗑</span>
        <span>削除</span>
      </button>
    </form>
  );
}
