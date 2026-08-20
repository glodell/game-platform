"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createHackathon,
  createOfficialGame,
  createTournament,
  reviewSubmission,
  type AdminResult,
} from "@/app/actions/admin";
import { Badge } from "./ui";

/* ------------------------------------------------------------------ */
/* 제출작 심사                                                          */
/* ------------------------------------------------------------------ */

export function ReviewRow({
  game,
}: {
  game: {
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    authorHandle: string;
    createdAt: string;
    isHackathonEntry: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function decide(decision: "approve" | "reject") {
    startTransition(async () => {
      const res = await reviewSubmission(game.id, decision);
      setResult(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/games/${game.slug}`}
              target="_blank"
              className="font-bold hover:text-neon-400 transition-colors"
            >
              {game.title}
            </Link>
            {game.isHackathonEntry && <Badge tone="lime">해커톤</Badge>}
          </div>
          {game.tagline && <p className="text-sm text-ink-400 mt-1">{game.tagline}</p>}
          <p className="text-xs text-ink-600 mt-1.5">
            @{game.authorHandle} · {game.createdAt}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Link
            href={`/games/${game.slug}`}
            target="_blank"
            className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            플레이 확인
          </Link>
          <button
            onClick={() => decide("reject")}
            disabled={pending}
            className="rounded-lg border border-punch-500/40 text-punch-400 px-3 py-2 text-xs font-semibold hover:bg-punch-500/10 transition-colors disabled:opacity-50"
          >
            반려
          </button>
          <button
            onClick={() => decide("approve")}
            disabled={pending}
            className="rounded-lg bg-lime-glow text-ink-950 px-3 py-2 text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            공개
          </button>
        </div>
      </div>
      {result && <p className="text-xs text-ink-400 mt-2">{result}</p>}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 생성 폼 묶음                                                         */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "game", label: "게임 등록" },
  { key: "tournament", label: "대회 개설" },
  { key: "hackathon", label: "해커톤 개설" },
] as const;

export function AdminForms({ games }: { games: { id: string; title: string }[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("game");

  return (
    <section className="mt-14">
      <div className="flex gap-1.5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-ink-100 text-ink-950"
                : "border border-ink-700 text-ink-400 hover:text-ink-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "game" && <GameForm />}
      {tab === "tournament" && <TournamentForm games={games} />}
      {tab === "hackathon" && <HackathonForm />}
    </section>
  );
}

function useAction(action: (fd: FormData) => Promise<AdminResult>) {
  const [state, setState] = useState<AdminResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const res = await action(formData);
      setState(res);
      if (res.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  return { state, pending, onSubmit };
}

function GameForm() {
  const { state, pending, onSubmit } = useAction(createOfficialGame);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        내가 만든 게임을 등록합니다. <code className="text-neon-400">public/games/</code> 폴더에 넣은
        게임은 경로만 적으면 되고, 단일 HTML 은 코드를 그대로 붙여넣어도 됩니다.
      </p>

      <Row>
        <Input name="title" label="게임 이름" required />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>
      <Input name="tagline" label="한 줄 소개" />
      <Textarea name="description" label="설명" rows={3} />
      <Row>
        <Input name="entry_url" label="게임 경로" placeholder="/games/reflex/index.html" />
        <Input name="thumbnail_url" label="썸네일 URL" placeholder="비우면 자동 생성" />
      </Row>
      <Textarea
        name="html"
        label="또는 HTML 코드 직접 붙여넣기"
        rows={6}
        mono
        placeholder="경로를 적었다면 비워두세요"
      />
      <Row>
        <Select name="scoring" label="순위 기준">
          <option value="high">점수가 높을수록 좋음</option>
          <option value="low">기록이 낮을수록 좋음</option>
        </Select>
        <Input name="score_unit" label="점수 단위" defaultValue="점" />
      </Row>

      <Submit pending={pending} state={state} label="게임 등록" />
    </form>
  );
}

function TournamentForm({ games }: { games: { id: string; title: string }[] }) {
  const { state, pending, onSubmit } = useAction(createTournament);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        제한 시간이 있는 랭킹전을 엽니다. 마감 시점의 순위가 최종 결과가 됩니다.
      </p>

      <Row>
        <Input name="title" label="대회 이름" required placeholder="예: 3월 반응속도 챔피언십" />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>

      <Select name="game_id" label="대상 게임" required>
        <option value="">게임을 선택하세요</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </Select>

      <Textarea name="description" label="대회 설명" rows={3} />

      <Row>
        <Input name="starts_at" label="시작" type="datetime-local" required />
        <Input name="ends_at" label="마감" type="datetime-local" required />
      </Row>

      <Row>
        <Input
          name="max_attempts"
          label="1인 도전 횟수"
          type="number"
          min={1}
          placeholder="비우면 무제한"
        />
        <div />
      </Row>

      <Textarea
        name="prizes"
        label="상품"
        rows={3}
        placeholder={"1등: 치킨 기프티콘\n2등: 커피 기프티콘\n3등: 아이스크림"}
        hint="한 줄에 하나씩. '1등: 상품' 형식"
      />

      <Checkbox name="is_published" label="바로 공개하기" defaultChecked />
      <Submit pending={pending} state={state} label="대회 만들기" />
    </form>
  );
}

function HackathonForm() {
  const { state, pending, onSubmit } = useAction(createHackathon);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        구독자들이 직접 만든 게임을 제출하는 이벤트를 엽니다. 제출된 게임은 검토 후 공개됩니다.
      </p>

      <Row>
        <Input name="title" label="해커톤 이름" required placeholder="예: 1회 바이버후드 해커톤" />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>

      <Input name="theme" label="주제" placeholder="예: 한 화면 안에서 끝나는 게임" />
      <Textarea name="description" label="설명" rows={3} />
      <Textarea
        name="rules"
        label="참가 규칙"
        rows={4}
        placeholder={"- HTML 파일 하나로 제출\n- 외부 라이브러리 없이\n- 첫 판이 30초 안에 끝날 것"}
      />

      <Row>
        <Input name="starts_at" label="접수 시작" type="datetime-local" required />
        <Input name="submit_ends_at" label="제출 마감" type="datetime-local" required />
      </Row>
      <Input name="vote_ends_at" label="투표 마감" type="datetime-local" />

      <Textarea
        name="prizes"
        label="상품"
        rows={3}
        placeholder={"1등: 10만원 상당 기프티콘\n2등: 5만원\n3등: 3만원"}
        hint="한 줄에 하나씩"
      />

      <Checkbox name="is_published" label="바로 공개하기" defaultChecked />
      <Submit pending={pending} state={state} label="해커톤 열기" />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 폼 프리미티브                                                        */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-2.5 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none";

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function Label({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold block mb-1.5">
        {label}
        {required && <span className="text-punch-400 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-600 mt-1">{hint}</span>}
    </label>
  );
}

function Input({
  name,
  label,
  required,
  ...rest
}: { name: string; label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} required={required}>
      <input name={name} required={required} className={inputClass} {...rest} />
    </Label>
  );
}

function Textarea({
  name,
  label,
  rows = 3,
  mono,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  rows?: number;
  mono?: boolean;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label label={label} hint={hint}>
      <textarea
        name={name}
        rows={rows}
        spellCheck={false}
        className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
        {...rest}
      />
    </Label>
  );
}

function Select({
  name,
  label,
  required,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label label={label} required={required}>
      <select name={name} required={required} className={inputClass}>
        {children}
      </select>
    </Label>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-ink-700 bg-ink-900 accent-neon-500"
      />
      {label}
    </label>
  );
}

function Submit({
  pending,
  state,
  label,
}: {
  pending: boolean;
  state: AdminResult | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold hover:bg-white transition-colors disabled:opacity-50"
      >
        {pending ? "처리 중…" : label}
      </button>
      {state && (
        <span className={`text-sm ${state.ok ? "text-lime-glow" : "text-punch-400"}`}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </div>
  );
}
