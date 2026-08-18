import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueRunToken } from "@/lib/run-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "점수를 남기려면 로그인이 필요합니다." }, { status: 401 });
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

  if (tournamentId) {
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
    tid: tournamentId ?? null,
  });

  return NextResponse.json({ token });
}
