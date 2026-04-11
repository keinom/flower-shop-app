import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const supabase = await createClient();

  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(20);

  return NextResponse.json(data ?? []);
}
