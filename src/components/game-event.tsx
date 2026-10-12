import { formatDateTime } from "@/lib/format";
import type { EventStanding, GameEvent } from "@/lib/types";
import { Countdown } from "./countdown";
import { Podium } from "./leaderboard";

/**
 * 게임 페이지에 붙는 랭킹 이벤트 안내 (src/lib/game-events.ts).
 *
 * 진행 중일 때는 마감 타이머를, 끝난 뒤에는 1·2·3위와 보고 있는 사람의 최종 순위를 보여줍니다.
 */

/** 진행 중 — 게임 바로 위에 놓는 한 줄 안내 */
export function LiveEventBanner({ event }: { event: GameEvent }) {
  return (
    <div className="rounded-xl border border-punch-500/40 bg-punch-500/10 px-4 py-3 break-keep">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="live-dot size-2 rounded-full bg-punch-400 shrink-0" />
        <span className="font-bold text-punch-400">랭킹 이벤트 진행 중</span>
        <span className="ml-auto text-sm text-ink-300">
          <Countdown target={event.ends_at} compact prefix="마감까지" />
        </span>
      </div>
      <p className="text-sm text-ink-300 mt-2">
        {formatDateTime(event.ends_at)}까지의 기록으로 1·2·3위를 가립니다.
      </p>
      {event.description && (
        <p className="text-sm text-ink-100 mt-1 whitespace-pre-wrap">{event.description}</p>
      )}
      <p className="text-xs text-ink-400 mt-2">
        로그인하고 플레이하면 자동으로 참가됩니다. 1~3위에게는 로그인한 계정의 이메일로
        연락드립니다.
      </p>
    </div>
  );
}

/** 종료 — 시상대와 내 최종 순위 */
export function EndedEventPanel({
  event,
  standing,
  scoreUnit,
  signedIn,
}: {
  event: GameEvent;
  standing: EventStanding;
  scoreUnit: string | null;
  signedIn: boolean;
}) {
  const { rows, total, mine } = standing;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 className="font-black text-lg">🏆 랭킹 이벤트 결과</h2>
        <p className="text-xs text-ink-400">
          {formatDateTime(event.ends_at)} 마감 · 참가 {total.toLocaleString("ko-KR")}명
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-ink-400 py-6 text-center">이번 이벤트에는 참가자가 없었습니다.</p>
      ) : (
        <Podium rows={rows} scoreUnit={scoreUnit} />
      )}

      {total > 0 && (
        <div className="mt-5 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm break-keep">
          {mine ? (
            <>
              <p>
                내 최종 순위{" "}
                <span className="text-lg font-black text-neon-400 tabular-nums">{mine.rank}위</span>
                <span className="text-ink-400"> / {total.toLocaleString("ko-KR")}명</span>
              </p>
              {mine.rank <= 3 && (
                <p className="text-lime-glow mt-1">
                  축하합니다! 로그인한 계정의 이메일로 상품 안내를 드립니다.
                </p>
              )}
            </>
          ) : signedIn ? (
            <p className="text-ink-400">이번 이벤트에는 남긴 기록이 없습니다.</p>
          ) : (
            <p className="text-ink-400">참가했다면 로그인해서 내 최종 순위를 확인하세요.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** 진행 중인 이벤트 순위 위에 놓는 "내 순위" 칸 */
export function MyEventRank({ standing }: { standing: EventStanding }) {
  if (!standing.mine) return null;
  return (
    <div className="mb-4 rounded-xl border border-neon-400/30 bg-neon-400/8 px-4 py-3">
      <p className="text-xs text-ink-400">내 이벤트 순위</p>
      <p className="text-2xl font-black text-neon-400 tabular-nums">
        {standing.mine.rank}위
        <span className="text-sm font-semibold text-ink-400">
          {" "}
          / {standing.total.toLocaleString("ko-KR")}명
        </span>
      </p>
    </div>
  );
}
