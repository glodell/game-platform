-- =====================================================================
--  보안 패치 (2026-08-21)
--  Supabase Dashboard > SQL Editor 에 통째로 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전합니다 (idempotent).
--
--  1) profiles.role 권한 상승 차단   ← 치명적. 이것부터 꼭 실행하세요.
--  2) 레이트리밋 저장소
--  3) 플레이 카운트 직접 호출 차단
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. profiles: role 컬럼 잠그기
--
--    RLS 는 "어느 행을 고칠 수 있나"만 정하고 "어느 컬럼을 고칠 수 있나"는
--    정하지 못합니다. profiles_update 정책이 본인 행 전체를 열어주기 때문에,
--    로그인한 사람이 anon 키로 REST 에 {"role":"owner"} 를 PATCH 하면
--    그대로 운영자가 됩니다. 컬럼 단위 GRANT 로 막습니다.
--
--    service_role 과 postgres(SQL Editor) 는 영향을 받지 않으므로,
--    운영자 승격은 지금까지처럼 여기서 update 하면 됩니다.
-- ---------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant  update (handle, display_name, avatar_url, bio)
  on public.profiles to authenticated;

-- 혹시 다른 경로로 역할이 바뀌는 일이 없도록 한 겹 더 막습니다.
-- auth.uid() 가 없는 호출(service_role · SQL Editor)은 그대로 통과시킵니다.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception '역할은 직접 바꿀 수 없습니다.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();


-- ---------------------------------------------------------------------
-- 2. 레이트리밋
--
--    서버리스라 프로세스 메모리에 카운터를 둘 수 없습니다(인스턴스마다 따로 셈).
--    DB 에 고정 창(fixed window) 카운터를 두고 서버 라우트만 호출하게 합니다.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- 정책을 만들지 않습니다 → anon/authenticated 는 어떤 행도 읽거나 쓸 수 없습니다.

create index if not exists rate_limits_window_idx on public.rate_limits(window_start);

/**
 * 한 번 호출할 때마다 hits 를 1 올리고, 한도를 넘지 않았으면 true 를 돌려줍니다.
 * 창은 p_window_seconds 단위로 딱딱 끊어지는 고정 창입니다.
 */
create or replace function public.rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz;
  n integer;
begin
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into n;

  -- 오래된 창은 가끔씩만 청소합니다 (매번 하면 비쌉니다).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return n <= p_limit;
end $$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;
grant  execute on function public.rate_limit_hit(text, integer, integer) to service_role;


-- ---------------------------------------------------------------------
-- 3. 플레이 카운트: 브라우저에서 직접 못 부르게
--
--    지금까지는 anon 에게 열려 있어서 반복 호출로 얼마든지 부풀릴 수 있었습니다.
--    이제 /api/games/play 라우트가 IP·계정 기준으로 제한한 뒤 대신 호출합니다.
-- ---------------------------------------------------------------------
revoke execute on function public.increment_play_count(uuid) from anon, authenticated;
grant  execute on function public.increment_play_count(uuid) to service_role;


-- ---------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------
select
  'profiles 업데이트 가능 컬럼' as 항목,
  string_agg(column_name, ', ' order by column_name) as 값
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE';
