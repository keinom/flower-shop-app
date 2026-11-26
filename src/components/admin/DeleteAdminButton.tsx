"use client";

import { deleteAdminUser } from "@/app/admin/users/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

interface DeleteAdminButtonProps {
  userId: string;
  displayName: string | null;
}

export function DeleteAdminButton({ userId, displayName }: DeleteAdminButtonProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`「${displayName ?? "このユーザー"}」を削除しますか？`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteAdminUser} onSubmit={handleSubmit}>
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton className="text-sm text-red-500 hover:text-red-700" pendingText="削除中...">
        削除
      </SubmitButton>
    </form>
  );
}
