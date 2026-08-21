import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * 플레이 수 집계.
 *
 * 전에는 브라우저가 increment_play_count RPC 를 직접 불렀는데, 그 함수가 anon 에게
 * 열려 있어서 반복 호출만으로 카운트를 얼마든지 부풀릴 수 있었습니다. 이제 함수는
 * service_role 전용이 되었고, 여기서 IP(로그인했다면 계정) 기준으로 제한한 뒤 대신 부릅니다.
 *
 * 집계는 실패해도 플레이에는 지장이 없어야 하므로 항상 200 을 돌려줍니다.
 */
export async function POST(request: Request) {
  let gameId: string | undefined;
  try {
    ({ gameId } = await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!gameId || typeof gameId !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 같은 사람이 같은 게임을 몇 분 사이에 여러 번 새로고침해도 한 번만 셉니다.
  const who = user?.id ?? `ip:${clientIp(request)}`;
  if (!(await rateLimit(`play:${who}:${gameId}`, 1, 300))) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("increment_play_count", { p_game_id: gameId });
  if (error) {
    console.warn("플레이 수 집계 실패:", error.message);
    return NextResponse.json({ ok: true, counted: false });
  }

  return NextResponse.json({ ok: true, counted: true });
}
