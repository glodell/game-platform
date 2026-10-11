-- =====================================================================
--  제작 노트 (2026-10-11)
--  Supabase Dashboard > SQL Editor 에 통째로 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전합니다 (idempotent).
--
--  게임을 어떻게 만들었는지 남기는 글입니다. 운영자 콘솔에서 쓰고,
--  /notes 에 블로그처럼 쌓입니다. 새로 만드는 프로젝트는 schema.sql 에
--  같은 내용이 들어 있어 따로 실행할 필요가 없습니다.
-- =====================================================================

create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null check (char_length(title) between 1 and 120),
  summary      text,                      -- 목록 카드와 검색 결과에 나오는 한두 줄
  body         text not null,             -- 간단한 마크다운 (src/components/note-body.tsx)
  cover_url    text,                      -- 비우면 영상 썸네일 → 그라디언트 순으로 대신 나옴
  video_url    text,                      -- 쇼츠 · 유튜브 주소. 본문 위에 플레이어로 들어감
  game_id      uuid references public.games(id) on delete set null,
  author_id    uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,               -- 처음 공개한 시각 (다시 비공개로 돌려도 유지)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists notes_published_idx on public.notes(published_at desc) where is_published;
create index if not exists notes_game_idx      on public.notes(game_id);

-- 읽기는 공개된 글만(운영자는 전부), 쓰기는 운영자만 — 대회 · 해커톤과 같은 규칙입니다.
alter table public.notes enable row level security;

drop policy if exists notes_read  on public.notes;
drop policy if exists notes_write on public.notes;
create policy notes_read  on public.notes for select using (is_published or public.is_staff());
create policy notes_write on public.notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
