-- =====================================================================
--  기록 검증 (2026-08-21)
--  Supabase Dashboard > SQL Editor 에 통째로 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전합니다 (idempotent).
--
--  영상 녹화 대신 쓰는, 리더보드 플랫폼에서 보편적인 방식입니다.
--    1) 판마다 검증 데이터(입력 횟수 · 점수 곡선 · 시계 정합성)를 함께 남기고
--    2) 서버가 앞뒤가 안 맞는 기록에 자동으로 표시를 달고
--    3) 운영자가 검토해서 무효 처리하면 랭킹에서 빠집니다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. runs 에 검증용 컬럼 추가
--
--    flags       : 서버가 자동으로 단 의심 표시 (빈 배열이면 이상 없음)
--    voided_*    : 운영자가 무효 처리한 기록. 지우지 않고 남겨둡니다 —
--                  지우면 대회 도전 횟수가 도로 늘어나고 기록도 사라집니다.
-- ---------------------------------------------------------------------
alter table public.runs add column if not exists flags         text[] not null default '{}';
alter table public.runs add column if not exists voided_at     timestamptz;
alter table public.runs add column if not exists voided_reason text;
alter table public.runs add column if not exists voided_by     uuid references public.profiles(id) on delete set null;

-- 검토 큐가 보는 건 "표시가 달렸고 아직 무효가 아닌 기록" 뿐이라 부분 인덱스로 충분합니다.
create index if not exists runs_flagged_idx
  on public.runs (created_at desc)
  where voided_at is null and array_length(flags, 1) > 0;


-- ---------------------------------------------------------------------
-- 2. 운영자가 무효 처리할 수 있게 (지금은 UPDATE 정책이 아예 없습니다)
-- ---------------------------------------------------------------------
drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs for update to authenticated
  using (public.is_staff()) with check (public.is_staff());


-- ---------------------------------------------------------------------
-- 3. 랭킹 뷰에서 무효 기록 제외
--
--    무효 처리가 랭킹에 바로 반영되려면 뷰가 걸러야 합니다.
--    나머지 정의는 그대로이고 voided_at 조건만 추가했습니다.
-- ---------------------------------------------------------------------
create or replace view public.game_leaderboard
with (security_invoker = true) as
with best as (
  select distinct on (r.game_id, r.user_id)
         r.game_id, r.user_id, r.score, r.duration_ms, r.created_at
  from public.runs r
  join public.games g on g.id = r.game_id
  where r.voided_at is null
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

create or replace view public.tournament_leaderboard
with (security_invoker = true) as
with valid as (
  select r.*, t.game_id as t_game_id
  from public.runs r
  join public.tournaments t on t.id = r.tournament_id
  where r.created_at >= t.starts_at and r.created_at <= t.ends_at
    and r.voided_at is null
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

grant select on public.game_leaderboard, public.tournament_leaderboard to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. 오탐 정리 — SDK 1 이 잘못 단 표시 걷어내기
--
--    아래 두 가지는 검증 데이터를 모으는 쪽의 문제였습니다. 대상은 SDK 1 형식으로
--    남은 기록(meta.trace.moves 가 없는 기록)뿐이고, 다른 표시와 이미 한 무효
--    처리는 건드리지 않습니다.
--
--    (1) no-input — SDK 1 은 누름(pointerdown · keydown · touchstart)만 셌습니다.
--        마우스를 따라 움직이는 조종(운석 피하기)은 누름이 한 번도 없어서
--        정상 플레이가 통째로 "조작이 한 번도 없었다"로 표시됐습니다.
--
--    (2) score-jump — SDK 1 은 점수 곡선을 앞에서부터 40개만 담았습니다. 60fps
--        게임에서는 첫 0.6초에서 곡선이 끊겨, 오래 버틸수록 "곡선 끝 대비 최종
--        점수가 몇십 배"가 됐습니다. 곡선이 판의 절반도 못 덮은 기록만 지웁니다.
-- ---------------------------------------------------------------------
update public.runs
set flags = array_remove(flags, 'no-input')
where 'no-input' = any (flags)
  and meta -> 'trace' -> 'moves' is null;

update public.runs
set flags = array_remove(flags, 'score-jump')
where 'score-jump' = any (flags)
  and meta -> 'trace' -> 'moves' is null
  and coalesce((meta -> 'trace' -> 'samples' -> -1 ->> 0)::numeric, 0)
      < coalesce((meta -> 'trace' ->> 'perfMs')::numeric, 0) * 0.5;


-- ---------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------
select
  count(*) filter (where array_length(flags, 1) > 0) as 표시된_기록,
  count(*) filter (where voided_at is not null)      as 무효_기록,
  count(*)                                            as 전체_기록
from public.runs;
