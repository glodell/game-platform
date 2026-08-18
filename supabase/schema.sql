-- =====================================================================
--  게임 플랫폼 스키마  (Supabase / Postgres)
--  Supabase Dashboard > SQL Editor 에 통째로 붙여넣고 실행하세요.
--  여러 번 실행해도 안전하도록 작성했습니다 (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. 열거형
-- ---------------------------------------------------------------------
do $$ begin
  create type game_kind    as enum ('official', 'community');  -- 내가 만든 게임 / 구독자 제출작
  create type game_status  as enum ('draft', 'pending', 'published', 'rejected', 'hidden');
  create type game_source  as enum ('url', 'html');            -- 정적 경로 / DB에 저장된 HTML
  create type scoring_rule as enum ('high', 'low');            -- 높을수록 좋음 / 낮을수록 좋음(타임어택)
  create type user_role    as enum ('member', 'moderator', 'owner');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. 프로필
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  handle       text unique not null,
  display_name text not null,
  avatar_url   text,
  bio          text,
  role         user_role not null default 'member',
  created_at   timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  n int := 0;
begin
  base_handle := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'player'),
    '[^a-z0-9가-힣]', '', 'gi'));
  if base_handle = '' then base_handle := 'player'; end if;
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    n := n + 1;
    final_handle := base_handle || n::text;
  end loop;

  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data->>'name', final_handle),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 운영자 판별 헬퍼 (RLS 정책에서 사용)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'moderator')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. 해커톤
-- ---------------------------------------------------------------------
create table if not exists public.hackathons (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text,
  theme         text,                      -- 예: "한 화면 안에서 끝나는 게임"
  rules         text,
  banner_url    text,
  starts_at     timestamptz not null,
  submit_ends_at timestamptz not null,     -- 제출 마감
  vote_ends_at  timestamptz,               -- 좋아요 투표 마감 (null이면 제출 마감과 동일)
  prizes        jsonb not null default '[]'::jsonb,  -- [{"rank":1,"label":"1등","reward":"기프티콘 5만원"}]
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. 게임
-- ---------------------------------------------------------------------
create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  tagline       text,                      -- 카드에 한 줄로 보이는 설명
  description   text,
  thumbnail_url text,
  kind          game_kind   not null default 'official',
  status        game_status not null default 'draft',
  source        game_source not null default 'url',
  entry_url     text,                      -- source='url' 일 때: /games/xxx/index.html
  html          text,                      -- source='html' 일 때: 제출된 단일 HTML 문서
  author_id     uuid references public.profiles(id) on delete set null,
  hackathon_id  uuid references public.hackathons(id) on delete set null,
  scoring       scoring_rule not null default 'high',
  score_unit    text default '점',
  tags          text[] not null default '{}',
  play_count    integer not null default 0,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint games_source_check check (
    (source = 'url'  and entry_url is not null) or
    (source = 'html' and html is not null)
  )
);

create index if not exists games_status_idx    on public.games(status);
create index if not exists games_kind_idx      on public.games(kind);
create index if not exists games_hackathon_idx on public.games(hackathon_id);
create index if not exists games_author_idx    on public.games(author_id);

-- ---------------------------------------------------------------------
-- 4. 대회 (제한 시간 + 1·2·3등 시상)
-- ---------------------------------------------------------------------
create table if not exists public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  game_id       uuid not null references public.games(id) on delete cascade,
  title         text not null,
  description   text,
  banner_url    text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  prizes        jsonb not null default '[]'::jsonb,  -- [{"rank":1,"reward":"치킨 기프티콘"}]
  max_attempts  integer,                   -- null = 무제한 도전
  is_published  boolean not null default false,
  results_locked boolean not null default false,     -- 마감 후 최종 확정
  created_at    timestamptz not null default now(),
  constraint tournaments_period_check check (ends_at > starts_at)
);

create index if not exists tournaments_game_idx on public.tournaments(game_id);
create index if not exists tournaments_time_idx on public.tournaments(starts_at, ends_at);

-- ---------------------------------------------------------------------
-- 5. 플레이 기록 (점수)
-- ---------------------------------------------------------------------
create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  score         numeric not null,
  duration_ms   integer,
  meta          jsonb not null default '{}'::jsonb,
  nonce         text unique,      -- 서명된 플레이 토큰의 1회용 값 (중복 제출 차단)
  created_at    timestamptz not null default now()
);

create index if not exists runs_game_score_idx  on public.runs(game_id, score desc);
create index if not exists runs_tournament_idx  on public.runs(tournament_id, score desc);
create index if not exists runs_user_idx        on public.runs(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. 좋아요 / 댓글
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_game_idx on public.comments(game_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. 카운터 유지 트리거
-- ---------------------------------------------------------------------
create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.games set like_count = like_count + 1 where id = new.game_id;
  elsif tg_op = 'DELETE' then
    update public.games set like_count = greatest(like_count - 1, 0) where id = old.game_id;
  end if;
  return null;
end $$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.bump_like_count();

create or replace function public.bump_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.games set comment_count = comment_count + 1 where id = new.game_id;
  elsif tg_op = 'DELETE' then
    update public.games set comment_count = greatest(comment_count - 1, 0) where id = old.game_id;
  end if;
  return null;
end $$;

drop trigger if exists comments_count_trigger on public.comments;
create trigger comments_count_trigger
  after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

-- 게임 플레이 카운트 (익명 포함)
create or replace function public.increment_play_count(p_game_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.games set play_count = play_count + 1 where id = p_game_id;
$$;

-- ---------------------------------------------------------------------
-- 8. 랭킹 뷰 / 함수
-- ---------------------------------------------------------------------

-- 게임별 전체 기간 랭킹 (유저당 최고 기록 1개)
-- security_invoker: 뷰를 조회하는 사람의 권한으로 실행 → 비공개 게임 기록이 새지 않습니다.
create or replace view public.game_leaderboard
with (security_invoker = true) as
with best as (
  select distinct on (r.game_id, r.user_id)
         r.game_id, r.user_id, r.score, r.duration_ms, r.created_at
  from public.runs r
  join public.games g on g.id = r.game_id
  order by r.game_id, r.user_id,
           case when g.scoring = 'high' then r.score end desc nulls last,
           case when g.scoring = 'low'  then r.score end asc  nulls last,
           r.created_at asc
)
select
  b.game_id,
  b.user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  b.score,
  b.duration_ms,
  b.created_at,
  rank() over (
    partition by b.game_id
    order by case when g.scoring = 'high' then b.score end desc nulls last,
             case when g.scoring = 'low'  then b.score end asc  nulls last,
             b.created_at asc
  ) as rank
from best b
join public.games g    on g.id = b.game_id
join public.profiles p on p.id = b.user_id;

-- 대회별 랭킹 (대회 기간 안의 기록만)
create or replace view public.tournament_leaderboard
with (security_invoker = true) as
with valid as (
  select r.*, t.game_id as t_game_id
  from public.runs r
  join public.tournaments t on t.id = r.tournament_id
  where r.created_at >= t.starts_at and r.created_at <= t.ends_at
),
best as (
  select distinct on (v.tournament_id, v.user_id)
         v.tournament_id, v.user_id, v.score, v.duration_ms, v.created_at
  from valid v
  join public.games g on g.id = v.t_game_id
  order by v.tournament_id, v.user_id,
           case when g.scoring = 'high' then v.score end desc nulls last,
           case when g.scoring = 'low'  then v.score end asc  nulls last,
           v.created_at asc
)
select
  b.tournament_id,
  b.user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  b.score,
  b.duration_ms,
  b.created_at,
  rank() over (
    partition by b.tournament_id
    order by case when g.scoring = 'high' then b.score end desc nulls last,
             case when g.scoring = 'low'  then b.score end asc  nulls last,
             b.created_at asc
  ) as rank
from best b
join public.tournaments t on t.id = b.tournament_id
join public.games g       on g.id = t.game_id
join public.profiles p    on p.id = b.user_id;

-- 유저의 대회 도전 횟수 (max_attempts 체크용)
create or replace function public.tournament_attempt_count(p_tournament_id uuid, p_user_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.runs
  where tournament_id = p_tournament_id and user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.games       enable row level security;
alter table public.tournaments enable row level security;
alter table public.hackathons  enable row level security;
alter table public.runs        enable row level security;
alter table public.likes       enable row level security;
alter table public.comments    enable row level security;

-- profiles
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- games : 공개된 것 + 내 것 + 운영자
drop policy if exists games_read   on public.games;
drop policy if exists games_insert on public.games;
drop policy if exists games_update on public.games;
drop policy if exists games_delete on public.games;
create policy games_read on public.games for select
  using (status = 'published' or author_id = auth.uid() or public.is_staff());
create policy games_insert on public.games for insert to authenticated
  with check (
    public.is_staff()
    or (author_id = auth.uid() and kind = 'community' and status in ('draft','pending') and source = 'html')
  );
create policy games_update on public.games for update to authenticated
  using (public.is_staff() or (author_id = auth.uid() and status in ('draft','pending','rejected')))
  with check (public.is_staff() or (author_id = auth.uid() and status in ('draft','pending')));
create policy games_delete on public.games for delete to authenticated
  using (public.is_staff() or (author_id = auth.uid() and status in ('draft','pending','rejected')));

-- tournaments / hackathons : 읽기는 공개, 쓰기는 운영자
drop policy if exists tournaments_read  on public.tournaments;
drop policy if exists tournaments_write on public.tournaments;
create policy tournaments_read  on public.tournaments for select using (is_published or public.is_staff());
create policy tournaments_write on public.tournaments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists hackathons_read  on public.hackathons;
drop policy if exists hackathons_write on public.hackathons;
create policy hackathons_read  on public.hackathons for select using (is_published or public.is_staff());
create policy hackathons_write on public.hackathons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- runs : 읽기는 공개, 쓰기는 아무도 못 함.
--
-- INSERT 정책을 일부러 만들지 않습니다. 로그인 사용자에게 insert 를 열어주면
-- 게임을 플레이하지 않고도 REST API 로 원하는 점수를 직접 꽂아넣을 수 있어서
-- /api/runs/submit 의 서명 토큰 검증이 아무 의미가 없어집니다.
-- 기록은 오직 service_role 키를 쓰는 서버 라우트만 남길 수 있습니다 (RLS 우회).
drop policy if exists runs_read   on public.runs;
drop policy if exists runs_insert on public.runs;
drop policy if exists runs_delete on public.runs;
create policy runs_read   on public.runs for select using (true);
create policy runs_delete on public.runs for delete to authenticated using (public.is_staff());

-- likes
drop policy if exists likes_read   on public.likes;
drop policy if exists likes_insert on public.likes;
drop policy if exists likes_delete on public.likes;
create policy likes_read   on public.likes for select using (true);
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists comments_read   on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_update on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_read   on public.comments for select using (true);
create policy comments_insert on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- 뷰 / 함수 권한
grant select on public.game_leaderboard, public.tournament_leaderboard to anon, authenticated;
grant execute on function public.increment_play_count(uuid) to anon, authenticated;
grant execute on function public.tournament_attempt_count(uuid, uuid) to anon, authenticated;
