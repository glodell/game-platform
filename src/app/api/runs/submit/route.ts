import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { verifyRunToken } from "@/lib/run-token";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_SCORE = 1e12;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { token?: string; score?: number; durationMs?: number; meta?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { token, score, durationMs, meta } = body;
  if (!token) return NextResponse.json({ error: "플레이 토큰이 없습니다." }, { status: 400 });

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || Math.abs(numericScore) > MAX_SCORE) {
    return NextResponse.json({ error: "점수 값이 올바르지 않습니다." }, { status: 400 });
  }

  const verified = verifyRunToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  const payload = verified.payload;
  if (payload.sub !== user.id) {
    return NextResponse.json({ error: "토큰의 주인이 아닙니다." }, { status: 403 });
  }

  // 사람이 실제로 게임을 하는 속도를 훨씬 넘는 제출은 막습니다.
  if (!(await rateLimit(`run-submit:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const admin = createAdminClient();

  // 대회 기록이면 마감 시간과 도전 횟수를 저장 직전에 다시 확인합니다.
  //
  // 횟수를 /api/runs/start 에서만 세면 우회할 수 있습니다. 토큰은 발급될 때
  // 소비되지 않고 3시간 유효하므로, 하나도 제출하지 않은 채 start 를 여러 번
  // 부르면 매번 "0회 사용"으로 통과해 토큰이 무제한으로 나옵니다.
  // 그래서 실제로 기록이 쌓이는 이 지점의 확인이 유일하게 믿을 수 있는 확인입니다.
  if (payload.tid) {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("starts_at, ends_at, max_attempts")
      .eq("id", payload.tid)
      .single();

    if (!tournament) {
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }
    const now = Date.now();
    if (now < new Date(tournament.starts_at).getTime()) {
      return NextResponse.json({ error: "아직 시작하지 않은 대회입니다." }, { status: 409 });
    }
    if (now > new Date(tournament.ends_at).getTime()) {
      return NextResponse.json(
        { error: "대회가 마감되어 이 기록은 랭킹에 반영되지 않습니다." },
        { status: 409 },
      );
    }

    if (tournament.max_attempts) {
      // runs 는 RLS 로 클라이언트 INSERT 가 막혀 있어 admin 으로 세야 정확합니다.
      const { count } = await admin
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", payload.tid)
        .eq("user_id", user.id);

      if ((count ?? 0) >= tournament.max_attempts) {
        return NextResponse.json(
          { error: `도전 횟수를 모두 사용했습니다. (최대 ${tournament.max_attempts}회)` },
          { status: 409 },
        );
      }
    }
  }

  const { data: run, error } = await admin
    .from("runs")
    .insert({
      game_id: payload.gid,
      tournament_id: payload.tid,
      user_id: user.id,
      score: numericScore,
      duration_ms: Number.isFinite(Number(durationMs)) ? Math.round(Number(durationMs)) : null,
      meta: meta && typeof meta === "object" ? meta : {},
      nonce: payload.nonce,
    })
    .select("id")
    .single();

  if (error) {
    // unique_violation — 같은 토큰으로 두 번 제출
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 제출된 기록입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "기록 저장에 실패했습니다." }, { status: 500 });
  }

  // 갱신된 순위 조회
  const view = payload.tid ? "tournament_leaderboard" : "game_leaderboard";
  const column = payload.tid ? "tournament_id" : "game_id";
  const target = payload.tid ?? payload.gid;

  const { data: row } = await supabase
    .from(view)
    .select("rank, score")
    .eq(column, target)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    runId: run.id,
    rank: row?.rank ?? null,
    best: row?.score ?? numericScore,
  });
}
