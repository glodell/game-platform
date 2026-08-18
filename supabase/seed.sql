-- =====================================================================
--  샘플 데이터 — schema.sql 을 먼저 실행한 뒤 돌리세요.
--  기본으로 들어 있는 게임 2개와, 바로 볼 수 있는 대회·해커톤을 만듭니다.
--  여러 번 실행해도 중복되지 않습니다.
-- =====================================================================

-- 1. 기본 게임 (public/games/ 에 들어 있는 정적 게임)
insert into public.games
  (slug, title, tagline, description, kind, status, source, entry_url, scoring, score_unit, tags, published_at)
values
  (
    'reflex',
    '반응속도 테스트',
    '초록으로 바뀌는 순간 누르세요. 5회 평균 기록으로 승부.',
    E'규칙\n1. 화면을 눌러 시작합니다.\n2. 빨강에서 초록으로 바뀌는 순간 최대한 빨리 누르세요.\n3. 5번의 평균 반응속도가 기록이 됩니다.\n\n초록 전에 누르면 그 라운드는 다시 합니다. 사람의 평균은 250ms 안팎입니다.',
    'official', 'published', 'url', '/games/reflex/index.html',
    'low', 'ms', array['반응속도','간단'], now()
  ),
  (
    'dodge',
    '운석 피하기',
    '점점 빨라지는 운석 사이에서 얼마나 오래 버틸 수 있나.',
    E'조작\n- 마우스 / 터치: 좌우로 움직이기\n- 키보드: ← → 또는 A D\n\n생존 시간과 피한 운석 수가 점수에 반영됩니다. 시간이 지날수록 운석이 빨라집니다.',
    'official', 'published', 'url', '/games/dodge/index.html',
    'high', '점', array['액션','생존'], now()
  )
on conflict (slug) do nothing;

-- 2. 샘플 대회 — 지금부터 7일간, 반응속도 테스트로
insert into public.tournaments
  (slug, game_id, title, description, starts_at, ends_at, prizes, max_attempts, is_published)
select
  'reflex-week-1',
  g.id,
  '1회 반응속도 챔피언십',
  E'일주일 동안 가장 빠른 반응속도를 남긴 세 명에게 상품을 드립니다.\n한 사람당 10번까지 도전할 수 있고, 그중 가장 좋은 기록만 랭킹에 올라갑니다.',
  now(),
  now() + interval '7 days',
  '[{"rank":1,"reward":"치킨 기프티콘"},{"rank":2,"reward":"커피 기프티콘"},{"rank":3,"reward":"아이스크림 기프티콘"}]'::jsonb,
  10,
  true
from public.games g
where g.slug = 'reflex'
on conflict (slug) do nothing;

-- 3. 샘플 해커톤 — 지금부터 14일간 접수
insert into public.hackathons
  (slug, title, theme, description, rules, starts_at, submit_ends_at, vote_ends_at, prizes, is_published)
values (
  'arcade-hack-1',
  '1회 아케이드 해커톤',
  '한 화면 안에서 끝나는 게임',
  E'AI를 써도 좋고, 직접 짜도 좋습니다. 중요한 건 "30초 안에 한 판이 끝나는가" 하나입니다.\n제출된 게임은 검토 후 플랫폼에 공개되고, 좋아요가 가장 많은 작품이 우승합니다.',
  E'- HTML 파일 하나로 제출 (외부 라이브러리·이미지 URL 금지)\n- Arcade.gameOver(점수) 를 반드시 호출할 것\n- 모바일 세로 화면에서도 플레이 가능할 것\n- 한 판이 30초 안에 끝날 것\n- 본인이 만든 코드일 것 (AI 사용은 허용)',
  now(),
  now() + interval '14 days',
  now() + interval '17 days',
  '[{"rank":1,"reward":"10만원 상당 기프티콘","note":"+ 채널에서 플레이 영상 제작"},{"rank":2,"reward":"5만원 상당 기프티콘"},{"rank":3,"reward":"3만원 상당 기프티콘"}]'::jsonb,
  true
)
on conflict (slug) do nothing;
