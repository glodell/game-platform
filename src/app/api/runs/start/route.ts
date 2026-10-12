import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findLiveEvent } from "@/lib/game-events";
import { issueRunToken } from "@/lib/run-token";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "점수를 남기려면 로그인이 필요합니다." }, { status: 401 });
  }

  // 토큰을 미리 쌓아두는 것 자체를 막습니다.
  // (실제 도전 횟수 확인은 기록이 쌓이는 /api/runs/submit 에서 합니다.)
  if (!(await rateLimit(`run-start:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  let body: { gameId?: string; tournamentId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { gameId, tournamentId } = body;
  if (!gameId) return NextResponse.json({ error: "gameId 가 필요합니다." }, { status: 400 });

  const { data: game } = await supabase
    .from("games")
    .select("id, status")
    .eq("id", gameId)
    .single();

  if (!game || game.status !== "published") {
    return NextResponse.json({ error: "플레이할 수 없는 게임입니다." }, { status: 404 });
  }

  // 이 판의 기록이 들어갈 대회 · 랭킹 이벤트
  let eventId: string | null = tournamentId ?? null;

  if (!tournamentId) {
    // 게임 페이지에서 그냥 시작한 판 — 이 게임에 진행 중인 랭킹 이벤트가 있으면 거기에 넣습니다.
    // 참가 버튼 없이 "로그인하고 플레이하면 참가" 가 되게 하려는 것이고, 화면이 아니라 서버가
    // 정하므로 페이지를 열어 둔 사이에 이벤트가 시작되거나 끝나도 어긋나지 않습니다.
    eventId = (await findLiveEvent(supabase, gameId))?.id ?? null;
  } else {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, game_id, starts_at, ends_at, max_attempts, is_published")
      .eq("id", tournamentId)
      .single();

    if (!tournament || !tournament.is_published || tournament.game_id !== gameId) {
      return NextResponse.json({ error: "대회 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const now = Date.now();
    if (now < new Date(tournament.starts_at).getTime()) {
      return NextResponse.json({ error: "아직 시작하지 않은 대회입니다." }, { status: 409 });
    }
    if (now > new Date(tournament.ends_at).getTime()) {
      return NextResponse.json({ error: "이미 종료된 대회입니다." }, { status: 409 });
    }

    if (tournament.max_attempts) {
      const { count } = await supabase
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id);

      if ((count ?? 0) >= tournament.max_attempts) {
        return NextResponse.json(
          { error: `도전 횟수를 모두 사용했습니다. (최대 ${tournament.max_attempts}회)` },
          { status: 409 },
        );
      }
    }
  }

  const { token } = issueRunToken({
    sub: user.id,
    gid: gameId,
    tid: eventId,
  });

  return NextResponse.json({ token });
}
