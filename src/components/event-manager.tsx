"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  changeEventDeadline,
  deleteGameEvent,
  startGameEvent,
  type AdminResult,
} from "@/app/actions/admin";
import type { AdminEvent } from "@/lib/admin-events";
import { Countdown } from "./countdown";
import { Badge, RankMedal } from "./ui";

/**
 * 운영자 콘솔의 랭킹 이벤트 (src/lib/game-events.ts).
 *
 * 게임과 마감 시각만 정하면 시작됩니다. 끝난 이벤트에는 1·2·3위와 연락할 이메일이 나옵니다.
 */

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-2.5 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none";

/** datetime-local 칸에 넣는 글자 (이 기기의 시간대 기준 YYYY-MM-DDTHH:mm) */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local 칸의 글자를 서버로 보낼 시각으로. 비었거나 잘못됐으면 빈 글자 (서버가 안내합니다). */
function toIso(local: string) {
  const date = new Date(local);
  return local && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

/** 서버 액션을 부르고, 성공하면 목록을 새로 받습니다. */
function useRun() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  const router = useRouter();

  function run(action: () => Promise<AdminResult>, onDone?: () => void) {
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) {
        onDone?.();
        router.refresh();
      }
    });
  }

  return { pending, result, run };
}

function ResultText({ result }: { result: AdminResult | null }) {
  if (!result) return null;
  return (
    <span className={`text-sm ${result.ok ? "text-lime-glow" : "text-punch-400"}`}>
      {result.ok ? result.message : result.error}
    </span>
  );
}

export function EventManager({
  games,
  events,
}: {
  games: { id: string; title: string }[];
  events: AdminEvent[];
}) {
  // 이벤트가 열려 있는 게임은 새로 열 수 없습니다 (한 게임에 하나씩).
  const busy = new Set(events.filter((event) => event.live).map((event) => event.gameId));
  const available = games.filter((game) => !busy.has(game.id));

  return (
    <section className="mt-10">
      <h2 className="font-black text-lg mb-2">랭킹 이벤트</h2>
      <p className="text-sm text-ink-400 mb-5">
        게임과 마감 시각만 정하면, 그때까지의 기록으로 1·2·3위가 정해집니다. 게임 페이지에 마감
        타이머와 이벤트 순위가 붙고, 로그인하고 그 게임을 플레이한 사람은 자동으로 참가됩니다.
        이벤트를 시작한 뒤의 기록만 세며, 끝나면 참가자는 자기 최종 순위를 볼 수 있습니다.
      </p>

      <StartForm games={available} hasGames={games.length > 0} />

      <h3 className="font-bold mt-10 mb-3">진행 중 · 지난 이벤트</h3>
      {events.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-sm text-ink-400">아직 연 이벤트가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

const PRESETS = [
  { label: "하루 뒤", days: 1 },
  { label: "3일 뒤", days: 3 },
  { label: "일주일 뒤", days: 7 },
];

function StartForm({
  games,
  hasGames,
}: {
  games: { id: string; title: string }[];
  hasGames: boolean;
}) {
  const [gameId, setGameId] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const { pending, result, run } = useRun();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () => startGameEvent(gameId, toIso(endsAt), note),
      () => {
        setGameId("");
        setEndsAt("");
        setNote("");
      },
    );
  }

  if (games.length === 0) {
    return (
      <p className="panel px-5 py-6 text-sm text-ink-400">
        {hasGames
          ? "공개된 게임 모두에 이벤트가 진행 중입니다. 마감 시각은 아래 목록에서 바꿀 수 있습니다."
          : "먼저 게임을 등록해 주세요. 공개된 게임에 이벤트를 열 수 있습니다."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold block mb-1.5">게임</span>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">게임을 선택하세요</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
      </label>

      <div>
        <label className="block">
          <span className="text-sm font-semibold block mb-1.5">마감 시각</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => setEndsAt(toLocalInput(new Date(Date.now() + preset.days * 86_400_000)))}
              className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-300 hover:border-neon-400/50 hover:text-ink-100 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold block mb-1.5">안내 문구 (선택)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="예: 1등 치킨 · 2등 커피 · 3등 아이스크림"
          className={inputClass}
        />
        <span className="block text-xs text-ink-600 mt-1">
          게임 페이지의 이벤트 안내에 함께 나옵니다. 비워도 됩니다.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold hover:bg-white transition-colors disabled:opacity-50"
        >
          {pending ? "처리 중…" : "이벤트 시작"}
        </button>
        <ResultText result={result} />
      </div>
    </form>
  );
}

function EventRow({ event }: { event: AdminEvent }) {
  const { pending, result, run } = useRun();
  // 시간대가 서버와 다를 수 있어, 마감 칸의 처음 값은 화면이 뜬 뒤에 채웁니다.
  const [endsAt, setEndsAt] = useState("");
  useEffect(() => setEndsAt(toLocalInput(new Date(event.endsAt))), [event.endsAt]);

  function endNow() {
    if (!window.confirm("지금 마감할까요? 이 시점의 순위가 최종 결과가 됩니다.")) return;
    run(() => changeEventDeadline(event.id, null));
  }

  function remove() {
    const confirmed = window.confirm(
      [
        `「${event.gameTitle}」 이벤트를 지울까요?`,
        "",
        event.live
          ? "게임 페이지의 타이머와 이벤트 순위가 사라집니다."
          : "게임 페이지의 이벤트 결과가 사라지고, 최종 순위를 다시 볼 수 없습니다.",
        "플레이 기록 자체는 전체 랭킹에 남습니다.",
      ].join("\n"),
    );
    if (!confirmed) return;
    run(() => deleteGameEvent(event.id));
  }

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {event.live ? (
          <Badge tone="punch">
            <span className="live-dot size-1.5 rounded-full bg-punch-400" />
            진행 중
          </Badge>
        ) : (
          <Badge>종료</Badge>
        )}
        {event.gameSlug ? (
          <Link
            href={`/games/${event.gameSlug}`}
            target="_blank"
            className="font-bold hover:text-neon-400 transition-colors"
          >
            {event.gameTitle}
          </Link>
        ) : (
          <span className="font-bold">{event.gameTitle}</span>
        )}
        <span className="text-xs text-ink-400">참가 {event.participants.toLocaleString("ko-KR")}명</span>
        {event.live && (
          <span className="ml-auto text-sm text-ink-300">
            <Countdown target={event.endsAt} compact prefix="남은 시간" />
          </span>
        )}
      </div>

      <p className="text-xs text-ink-400 mt-2">
        {event.startsLabel} 시작 — {event.endsLabel} 마감
      </p>
      {event.note && <p className="text-sm text-ink-300 mt-1 whitespace-pre-wrap">{event.note}</p>}

      <div className="mt-4">
        <p className="text-xs font-semibold text-ink-400 mb-2">
          {event.live ? "지금 1·2·3위" : "최종 1·2·3위"}
        </p>
        {event.top.length === 0 ? (
          <p className="text-sm text-ink-600">
            {event.live ? "아직 참가자가 없습니다." : "참가자가 없었습니다."}
          </p>
        ) : (
          <ol className="space-y-2">
            {event.top.map((winner) => (
              <li key={`${winner.rank}-${winner.handle}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <RankMedal rank={winner.rank} />
                <Link
                  href={`/u/${winner.handle}`}
                  target="_blank"
                  className="text-sm font-semibold hover:text-neon-400 transition-colors"
                >
                  {winner.name}
                  <span className="text-ink-400 font-normal"> @{winner.handle}</span>
                </Link>
                <span className="text-sm font-black tabular-nums">{winner.score}</span>
                {!event.live &&
                  (winner.email ? (
                    <a
                      href={`mailto:${winner.email}`}
                      className="text-sm text-neon-400 hover:underline break-all"
                    >
                      {winner.email}
                    </a>
                  ) : (
                    <span className="text-xs text-ink-600">이메일 확인 불가</span>
                  ))}
              </li>
            ))}
          </ol>
        )}
        {!event.live && event.top.length > 0 && (
          <p className="text-xs text-ink-600 mt-2">
            이메일은 상품 안내용으로 운영자에게만 보입니다. 의심스러운 기록은 게임 관리 탭의 기록
            검토에서 무효 처리하면 순위에서 빠집니다.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-ink-800">
        {event.live && (
          <>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              aria-label="마감 시각"
              className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-sm focus:border-neon-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => run(() => changeEventDeadline(event.id, toIso(endsAt)))}
              disabled={pending}
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold hover:border-neon-400/50 transition-colors disabled:opacity-50"
            >
              마감 시각 변경
            </button>
            <button
              type="button"
              onClick={endNow}
              disabled={pending}
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold hover:border-neon-400/50 transition-colors disabled:opacity-50"
            >
              지금 마감
            </button>
          </>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-lg border border-punch-500/40 text-punch-400 px-3 py-2 text-xs font-semibold hover:bg-punch-500/10 transition-colors disabled:opacity-50"
        >
          {pending ? "처리 중…" : "이벤트 삭제"}
        </button>
        <ResultText result={result} />
      </div>
    </li>
  );
}
