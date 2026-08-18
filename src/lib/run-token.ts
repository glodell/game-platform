import crypto from "node:crypto";

/**
 * 플레이 시작 시 서버가 발급하는 1회용 서명 토큰.
 *
 * 주의: 게임 로직 자체가 브라우저에서 돌기 때문에 이 토큰만으로 치팅을 완전히 막을 수는 없습니다.
 * 막아주는 것은 (1) 남의 이름으로 점수 넣기 (2) 같은 기록 여러 번 제출
 * (3) 대회 기간 밖 제출 (4) 비현실적으로 짧은 플레이 시간입니다.
 * 상품이 걸린 대회는 상위권 영상/리플레이를 별도로 확인하는 것을 권장합니다.
 */

export type RunTokenPayload = {
  sub: string; // user id
  gid: string; // game id
  tid: string | null; // tournament id
  iat: number; // 발급 시각 (ms)
  nonce: string;
};

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // 3시간
const MIN_PLAY_MS = 1500; // 1.5초 미만 플레이는 반려

function secret() {
  const s = process.env.RUN_TOKEN_SECRET;
  if (!s) throw new Error("RUN_TOKEN_SECRET 이 설정되지 않았습니다.");
  return s;
}

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

function sign(body: string) {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issueRunToken(input: Omit<RunTokenPayload, "iat" | "nonce">) {
  const payload: RunTokenPayload = {
    ...input,
    iat: Date.now(),
    nonce: crypto.randomUUID(),
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, payload };
}

export type VerifyResult =
  | { ok: true; payload: RunTokenPayload }
  | { ok: false; reason: string };

export function verifyRunToken(token: string): VerifyResult {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "토큰 형식이 올바르지 않습니다." };

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "토큰 서명이 유효하지 않습니다." };
  }

  let payload: RunTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "토큰을 해석할 수 없습니다." };
  }

  const age = Date.now() - payload.iat;
  if (age > TOKEN_TTL_MS) return { ok: false, reason: "플레이 세션이 만료됐습니다. 새로고침 후 다시 도전해 주세요." };
  if (age < MIN_PLAY_MS) return { ok: false, reason: "플레이 시간이 너무 짧습니다." };

  return { ok: true, payload };
}
