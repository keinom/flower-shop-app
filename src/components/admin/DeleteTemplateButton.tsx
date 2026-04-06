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
        className="text-xs font-medium px-3 py-1.5 rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
      >
        🗑 削除
      </button>
    </form>
  );
}
