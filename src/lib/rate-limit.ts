import { createAdminClient } from "@/lib/supabase/server";

/**
 * DB 기반 고정 창 레이트리밋.
 *
 * 서버리스에서는 인스턴스마다 메모리가 따로라 프로세스 안에 카운터를 두면
 * 한도가 인스턴스 수만큼 늘어납니다. 그래서 Postgres 의 rate_limit_hit() 을 씁니다.
 * 이 함수는 service_role 에게만 열려 있어 브라우저에서는 부를 수 없습니다.
 *
 * DB 가 잠깐 흔들려도 서비스가 멈추면 안 되므로, 호출이 실패하면 통과시킵니다(fail-open).
 * 막으려는 것은 스팸·조작이지 가용성이 아닙니다.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("레이트리밋 확인 실패:", error.message);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.warn("레이트리밋 확인 실패:", error);
    return true;
  }
}

/** 프록시 뒤(Vercel)에서 호출자 IP 를 최대한 정확히 뽑아냅니다. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export const TOO_MANY = "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
