import { createClient } from "@/lib/supabase/server";

/** 요청한 사람이 운영자(owner · moderator)인지 — 서버 액션이 맨 먼저 확인합니다. */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, staff: false };

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, staff: data?.role === "owner" || data?.role === "moderator" };
}
