/**
 * 기록 검증.
 *
 * 영상 녹화 대신 쓰는, 리더보드 플랫폼에서 흔한 방식입니다. 판마다 얇은 검증 데이터를
 * 함께 받아서 앞뒤가 맞는지 서버가 확인하고, 이상하면 표시를 달아 운영자 검토 큐로 보냅니다.
 *
 * 전제를 분명히 해둡니다 — 게임 로직이 브라우저에서 도는 이상 이 데이터도 위조할 수 있습니다.
 * 목표는 "위조 불가"가 아니라 다음 두 가지입니다.
 *   1) 콘솔에서 Arcade.gameOver(999999) 한 줄 치는 수준의 장난은 거의 다 걸러낸다
 *   2) 상품이 걸린 대회에서 운영자가 상위권을 눈으로 확인할 근거를 남긴다
 * 제대로 위조하려면 입력 횟수·점수 곡선·두 시계를 전부 앞뒤 맞게 지어내야 하는데,
 * 그 정도 수고를 들이는 사람은 어차피 영상도 만들어 냅니다.
 */

export type RunTrace = {
  sdk: number;
  inputs: number;
  firstInputMs: number | null;
  samples: [number, number][];
  hiddenMs: number;
  perfMs: number;
  wallMs: number;
  finalScore: number;
  startedGame: boolean;
};

export type RunFlag =
  | "no-trace"
  | "no-input"
  | "no-start"
  | "clock-drift"
  | "duration-lie"
  | "score-jump"
  | "instant-score"
  | "backgrounded";

/** 검토 화면에 그대로 쓰는 사람이 읽을 설명. */
export const FLAG_LABELS: Record<RunFlag, string> = {
  "no-trace": "검증 데이터 없음 — SDK 를 거치지 않고 제출됐습니다",
  "no-input": "입력이 한 번도 없었는데 점수가 나왔습니다",
  "no-start": "Arcade.start() 없이 gameOver() 만 호출됐습니다",
  "clock-drift": "두 시계가 어긋납니다 — 플레이 중 시스템 시각을 바꿨을 수 있습니다",
  "duration-lie": "신고한 플레이 시간이 실제 경과 시간보다 깁니다",
  "score-jump": "점수가 한 번에 튀었습니다",
  "instant-score": "플레이 시간에 비해 점수가 비현실적으로 높습니다",
  backgrounded: "판의 대부분을 탭이 백그라운드인 채로 보냈습니다",
};

/** 알 수 없는 모양이면 통째로 버립니다 — 신뢰할 수 없는 입력을 반쯤 믿는 게 제일 위험합니다. */
export function parseTrace(raw: unknown): RunTrace | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const perfMs = num(t.perfMs);
  const wallMs = num(t.wallMs);
  const inputs = num(t.inputs);
  if (perfMs === null || wallMs === null || inputs === null) return null;

  const samples = Array.isArray(t.samples)
    ? t.samples
        .filter(
          (s): s is [number, number] =>
            Array.isArray(s) && s.length === 2 && num(s[0]) !== null && num(s[1]) !== null,
        )
        .slice(0, 60)
    : [];

  return {
    sdk: num(t.sdk) ?? 0,
    inputs: Math.max(0, Math.round(inputs)),
    firstInputMs: num(t.firstInputMs),
    samples,
    hiddenMs: Math.max(0, Math.round(num(t.hiddenMs) ?? 0)),
    perfMs: Math.max(0, Math.round(perfMs)),
    wallMs: Math.max(0, Math.round(wallMs)),
    finalScore: num(t.finalScore) ?? 0,
    startedGame: t.startedGame === true,
  };
}

export type EvaluateInput = {
  trace: RunTrace | null;
  score: number;
  /** 클라이언트가 신고한 플레이 시간 */
  reportedDurationMs: number | null;
  /** 서버가 플레이 토큰을 발급한 시각 — 클라이언트가 못 건드리는 유일한 기준점 */
  tokenIssuedAt: number;
  /** 점수가 낮을수록 좋은 게임(타임어택 등)인지 */
  scoringLow: boolean;
};

/**
 * 이상 징후를 표시로 만들어 돌려줍니다. 여기서는 아무것도 거부하지 않습니다 —
 * 자동 거부는 오탐이 났을 때 억울한 사람을 만들기 때문에, 판단은 운영자가 합니다.
 */
export function evaluateRun(input: EvaluateInput): RunFlag[] {
  const { trace, score, reportedDurationMs, tokenIssuedAt, scoringLow } = input;
  const flags: RunFlag[] = [];

  // 토큰 발급 이후 실제로 흐른 시간. 클라이언트가 뭐라고 하든 이건 서버가 압니다.
  const serverElapsedMs = Date.now() - tokenIssuedAt;

  if (!trace) {
    flags.push("no-trace");
  } else {
    if (!trace.startedGame) flags.push("no-start");

    // 조작 없이 점수가 나왔다 — 스크립트로 gameOver 만 부른 전형적인 모양입니다.
    if (trace.inputs === 0 && score !== 0) flags.push("no-input");

    // 단조 시계(performance.now)와 시스템 시계(Date.now)가 어긋남.
    // 정상 브라우저에서는 몇 ms 차이라, 2초 넘게 벌어지면 시각을 건드린 것입니다.
    if (Math.abs(trace.perfMs - trace.wallMs) > 2000) flags.push("clock-drift");

    // 판의 70% 이상을 백그라운드로 보냄 — 사람이 플레이한 모양이 아닙니다.
    if (trace.perfMs > 0 && trace.hiddenMs > trace.perfMs * 0.7) flags.push("backgrounded");

    // 점수가 계단이 아니라 절벽. 마지막 표본 대비 최종 점수가 10배 넘게 뛰면 표시합니다.
    // (점수가 낮을수록 좋은 게임은 이 판단이 성립하지 않아 건너뜁니다.)
    if (!scoringLow && trace.samples.length >= 2) {
      const last = trace.samples[trace.samples.length - 1][1];
      if (last > 0 && score > last * 10) flags.push("score-jump");
    }

    // 클라이언트가 신고한 시간이 SDK 가 잰 시간보다 3초 넘게 길면 앞뒤가 안 맞습니다.
    if (reportedDurationMs !== null && reportedDurationMs > trace.perfMs + 3000) {
      flags.push("duration-lie");
    }
  }

  // 토큰 발급 후 흐른 시간보다 긴 플레이는 존재할 수 없습니다.
  // 5초는 네트워크 왕복과 시계 오차를 감안한 여유입니다.
  if (reportedDurationMs !== null && reportedDurationMs > serverElapsedMs + 5000) {
    if (!flags.includes("duration-lie")) flags.push("duration-lie");
  }

  // 플레이 시간 대비 점수. 점수 체계가 게임마다 달라서 임계는 넉넉하게 둡니다 —
  // 여기서 걸리는 건 "1초에 10만 점" 같은 명백한 경우뿐입니다.
  const playedMs = trace?.perfMs ?? reportedDurationMs ?? serverElapsedMs;
  if (!scoringLow && score > 0 && playedMs > 0) {
    const perSecond = score / (playedMs / 1000);
    if (perSecond > 100_000) flags.push("instant-score");
  }

  return flags;
}
