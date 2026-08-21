# 바이버후드(Viberhood) — AI로 만든 게임 플랫폼

**라이브: https://viberhood.io**

**바이브코딩으로 노는 이웃들.** 쇼츠에서 AI로 만든 게임을 모아두고, 구독자와 제한 시간 대결을
벌이고, 해커톤으로 구독자가 만든 게임까지 받는 플랫폼입니다.

- **게임 허브** — 공식 게임과 구독자 제작 게임을 한 곳에서 골라 플레이
- **대회** — 시작·마감 시각이 정해진 랭킹전. 마감 시점 1·2·3등에게 상품
- **해커톤** — 주제를 던지면 구독자가 직접 만든 HTML 게임을 제출. 검토 후 공개
- **좋아요 · 댓글** — 서로의 게임을 해보고 피드백
- **랭킹** — 게임별 전체 랭킹 + 대회별 실시간 랭킹 (1인 최고 기록 1건 반영)

스택: Next.js 15 (App Router) · Supabase (Postgres / Auth / RLS) · Tailwind CSS v4

---

## 1. 처음 세팅

### 1-1. Supabase 프로젝트

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성 (리전은 **Northeast Asia (Seoul)** 권장)
2. **SQL Editor** 에서 [`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여넣고 실행
3. 이어서 [`supabase/seed.sql`](supabase/seed.sql) 도 실행하면 기본 게임 2개 + 샘플 대회·해커톤이 생깁니다

> **이미 운영 중인 프로젝트라면** [`supabase/security-fixes.sql`](supabase/security-fixes.sql) 을
> 한 번 실행하세요. `schema.sql` 을 처음 돌린 시점에는 없던 보안 패치가 들어 있습니다.
> 특히 `profiles.role` 컬럼 잠금은 이걸 실행해야만 적용됩니다 — 그 전까지는 로그인한
> 누구나 REST 로 자기 역할을 `owner` 로 바꿔 운영자가 될 수 있습니다.
> 새로 만드는 프로젝트는 `schema.sql` 에 이미 포함돼 있어 따로 실행할 필요가 없습니다.

### 1-2. 구글 로그인 켜기

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 에서 OAuth 클라이언트 ID 생성 (유형: 웹 애플리케이션)
2. 승인된 리디렉션 URI 에 Supabase 대시보드가 알려주는 주소를 그대로 입력
   (`https://<프로젝트>.supabase.co/auth/v1/callback`)
3. Supabase → **Authentication → Providers → Google** 을 켜고 클라이언트 ID/시크릿 입력
4. Supabase → **Authentication → URL Configuration** 의 Site URL 에 배포 주소를 넣고,
   Redirect URLs 에 `http://localhost:3000/**` 와 배포 주소 `/**` 를 추가

### 1-3. 환경 변수

```bash
cp .env.local.example .env.local
```

| 변수 | 어디서 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API | 프로젝트 주소 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API | 브라우저용 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API | **서버 전용.** 점수 기록 저장에만 사용 |
| `NEXT_PUBLIC_SITE_URL` | 직접 입력 | 로컬은 `http://localhost:3000` |
| `RUN_TOKEN_SECRET` | 직접 입력 | 아무 긴 랜덤 문자열 |

`RUN_TOKEN_SECRET` 은 아래로 하나 뽑아 쓰면 됩니다.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 1-4. 실행

```bash
npm install
npm run dev
```

### 1-5. 나를 운영자로 지정

한 번 로그인한 뒤, Supabase SQL Editor 에서:

```sql
update profiles set role = 'owner' where handle = '내핸들';
```

이제 헤더 계정 메뉴에 **운영자 콘솔** 이 생깁니다. 게임 등록, 대회 개설, 해커톤 개설,
제출작 심사를 전부 거기서 합니다.

---

## 2. 게임 만들어 올리기

게임은 **HTML 파일 하나**입니다. 규칙은 두 줄뿐입니다.

```html
<script src="/sdk/arcade.js"></script>
<script>
  Arcade.start();          // 한 판 시작
  Arcade.gameOver(1240);   // 한 판 끝 — 점수 제출 (랭킹 자동 반영)
</script>
```

전체 API와 복사해서 쓰는 예제, AI에게 시킬 프롬프트는 실행 후 `/docs/sdk` 페이지에 있습니다.

### 내 게임 (공식) 등록

두 가지 방법 중 편한 쪽을 쓰면 됩니다.

1. `public/games/<이름>/index.html` 에 파일을 넣고, 운영자 콘솔에서 경로 `/games/<이름>/index.html` 입력
2. 운영자 콘솔의 **HTML 코드 직접 붙여넣기** 칸에 통째로 붙여넣기

### 구독자 제출

구독자는 `/submit` 에서 코드를 붙여넣고 미리보기로 확인한 뒤 제출합니다. 상태는 `pending` 으로
들어오고, 운영자 콘솔에서 **공개** 를 눌러야 플랫폼에 노출됩니다.

---

## 3. 대회 운영 흐름

1. 운영자 콘솔 → **대회 개설** → 게임 선택, 시작·마감 시각, 상품(한 줄에 하나), 1인 도전 횟수 입력
2. 쇼츠에 대회 링크 공개
3. 참가자는 대회 페이지에서 바로 플레이 — 개인 최고 기록 1건만 랭킹에 반영
4. 마감되면 대회 페이지가 자동으로 **최종 시상대** 로 바뀝니다

해커톤도 같은 방식입니다. 제출 마감 후에는 좋아요 순으로 출품작이 정렬됩니다.

---

## 4. 보안에 대해 (읽어두면 좋습니다)

### 구독자 코드 실행

제출된 게임은 `allow-same-origin` 없는 iframe 샌드박스에서 실행됩니다. 게임 코드는 고유
오리진에서 돌기 때문에 이 사이트의 쿠키·세션·DOM 에 접근할 수 없고, CSP 로 외부 네트워크 요청도
막혀 있습니다 (`src/lib/sandbox.ts`).

### 점수 조작

**게임 로직이 브라우저에서 도는 이상 점수 조작을 100% 막을 수는 없습니다.** 이 플랫폼이 막는 것은:

- 남의 계정으로 점수 넣기 (서명 토큰이 사용자에 묶임)
- 같은 기록 반복 제출 (토큰 1회용, DB unique 제약)
- 대회 기간 밖 제출 (서버 시각으로 재검증)
- 비현실적으로 짧은 플레이 (최소 1.5초)
- 도전 횟수 초과

**상품이 걸린 대회라면 상위권은 플레이 영상을 따로 받아 확인하는 것을 권장합니다.**
1·2·3등만 확인하면 되니 부담이 크지 않습니다.

### service_role 키

`SUPABASE_SERVICE_ROLE_KEY` 는 RLS 를 전부 우회합니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
현재는 `/api/runs/submit` 한 곳에서만 사용합니다.

---

## 5. 배포 (Vercel)

1. 저장소를 GitHub 에 올리고 Vercel 에서 import
2. Environment Variables 에 `.env.local` 의 5개 값을 그대로 입력
   (`NEXT_PUBLIC_SITE_URL` 은 실제 배포 도메인 — 현재 `https://viberhood.io`)
3. 배포 후 Supabase → Authentication → URL Configuration 에 배포 도메인 추가
   - Site URL: `https://viberhood.io`
   - Redirect URLs: `https://viberhood.io/**` (이걸 빼먹으면 구글 로그인이 튕깁니다)

`NEXT_PUBLIC_SITE_URL` 은 빌드 시점에 코드로 박히므로, 값을 바꾼 뒤에는 반드시 Redeploy 하세요.
커스텀 도메인은 apex(`viberhood.io`) 와 `www` 중 하나를 Vercel 의 Primary 로 정하고,
`NEXT_PUBLIC_SITE_URL` 도 같은 쪽으로 맞춰야 리다이렉트가 한 번 더 도는 일이 없습니다.

---

## 6. 구조

```
src/
  app/
    page.tsx                 홈 (진행 중 대회 + 인기 게임 + 해커톤 배너)
    games/                   게임 목록 · 상세(플레이 + 랭킹 + 댓글)
    tournaments/             대회 목록 · 상세(카운트다운 + 시상대 + 실시간 랭킹)
    hackathons/              해커톤 목록 · 상세(출품작)
    submit/                  구독자 게임 제출
    admin/                   운영자 콘솔
    u/[handle]/              프로필 (최고 기록 + 만든 게임)
    docs/sdk/                게임 제작 가이드
    api/runs/                점수 토큰 발급 · 제출 검증
    actions/                 서버 액션 (좋아요·댓글·제출·운영)
  components/                UI
  lib/                       Supabase 클라이언트, 쿼리, 샌드박스, 토큰
public/
  sdk/arcade.js              게임이 불러가는 SDK
  games/                     기본 게임 (reflex, dodge)
  brand/                     로고 · 마크 · 채널아트 (README.md 에 사용 규칙)
scripts/
  brand/build-brand.mjs      브랜드 애셋 생성기 (색·문구 고치고 다시 실행)
supabase/
  schema.sql                 테이블 · 뷰 · 트리거 · RLS · 레이트리밋
  security-fixes.sql         운영 중인 DB 에 보안 패치만 따로 적용하는 스크립트
  seed.sql                   샘플 데이터
```

---

## 7. 브랜드 애셋

로고 · 파비콘 · 유튜브 채널아트는 [`public/brand/`](public/brand/README.md) 에 있습니다. 색이나 문구를
바꾸려면 [`scripts/brand/build-brand.mjs`](scripts/brand/build-brand.mjs) 를 고치고 다시 실행하면 SVG 와
PNG 가 전부 재생성됩니다.

```bash
node scripts/brand/build-brand.mjs
```

---

## 8. 다음에 붙이면 좋은 것

- 대회 마감 시 자동 알림 / 수상자 발표 (Supabase Edge Function + cron)
- 리플레이 기록 저장 (입력 시퀀스를 meta 에 남기면 상위권 검증이 쉬워집니다)
- 게임 썸네일 자동 캡처 (Storage 업로드)
- 유튜브 채널 멤버십 연동 (멤버 전용 대회)
