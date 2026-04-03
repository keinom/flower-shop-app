import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * ルートページ: ログイン状態に応じてリダイレクト
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  } else {
    redirect("/customer");
  }
}
