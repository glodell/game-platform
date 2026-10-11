# 바이버후드(Viberhood) — AI로 만든 게임 플랫폼

**라이브: https://viberhood.io**

**바이브코딩으로 노는 이웃들.** 쇼츠에서 AI로 만든 게임을 모아두고, 구독자와 제한 시간 대결을
벌이고, 해커톤으로 구독자가 만든 게임까지 받는 플랫폼입니다.

- **게임 허브** — 공식 게임과 구독자 제작 게임을 한 곳에서 골라 플레이
- **대회** — 시작·마감 시각이 정해진 랭킹전. 마감 시점 1·2·3등에게 상품
- **해커톤** — 주제를 던지면 구독자가 직접 만든 HTML 게임을 제출. 검토 후 공개
- **좋아요 · 댓글** — 서로의 게임을 해보고 피드백
- **랭킹** — 게임별 전체 랭킹 + 대회별 실시간 랭킹 (1인 최고 기록 1건 반영)

> **지금은 체험관 모드입니다.** 쇼츠에서 소개한 게임을 링크 타고 들어와 바로 해보는 용도로만
> 열어 두었습니다. 대회 · 해커톤 · 구독자 제출(만들기 가이드 포함)은 코드는 그대로 두고 꺼 둔
> 상태이고, [`src/lib/site.ts`](src/lib/site.ts) 의 `FEATURES` 에서 `true` 로 바꾸면 메뉴 · 홈
> 섹션 · 페이지가 함께 돌아옵니다. 끄기 직전의 전체 버전은 `backup-full-platform-2026-10-11`
> 태그로 남겨 두었습니다.

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

> **기록 검증**은 [`supabase/run-verification.sql`](supabase/run-verification.sql) 을 실행해야
> 켜집니다 (`runs.flags` 컬럼 · 무효 처리 정책 · 랭킹 뷰). 여러 번 실행해도 안전하고,
> 지금 버전에는 예전 SDK 가 정상 플레이에 잘못 달았던 표시(`no-input` · `score-jump`)를
> 걷어내는 정리 쿼리도 들어 있습니다 — 검토 큐가 오탐으로 차 있다면 다시 한 번 실행하세요.

> **제작 노트**(`/notes`)는 [`supabase/notes.sql`](supabase/notes.sql) 을 실행해야 글을 쓸 수
> 있습니다. 실행 전에는 목록이 비어 보이고, 운영자 콘솔에 실행 안내가 뜹니다.

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

세 가지 방법이 있습니다.

1. **운영자 콘솔에서 게임 폴더 올리기** — 게임 등록 화면에 폴더를 끌어다 놓거나 "폴더 선택"으로
   고릅니다. 배포 없이 바로 올라갑니다.
2. `public/g/<이름>/index.html` 에 파일을 넣고, 운영자 콘솔에서 경로 `/g/<이름>/index.html` 입력
3. 운영자 콘솔의 **HTML 코드 직접 붙여넣기** 칸에 통째로 붙여넣기

모델 · 텍스처 · 모듈 스크립트처럼 **파일이 여러 개인 3D 게임은 1번이나 2번**을 쓰세요.
3번은 외부 요청이 전부 막혀 있어 CDN 의 three.js 같은 라이브러리도 불러오지 못합니다.

#### 1번 — 폴더 올리기가 하는 일

- 브라우저에서 먼저 검사합니다: `node_modules` · 소스맵 같은 잡파일을 빼고, 빌드가 필요한
  프로젝트를 통째로 골랐으면 그 안의 `dist` 를 쓰고, 올려도 안 뜨는 흔한 원인(`/` 로 시작하는
  경로)을 경고합니다. 한글 파일 이름과 너무 큰 파일은 여기서 막습니다.
- 파일은 저장소에 `<키>/<빌드>/…` 로 올라가고, 사이트에서는 `/g/<b 또는 u>/<키>/<빌드>/…` 로
  열립니다. 라우트가 파일을 받아 올바른 종류로 다시 내려주고(html · 스크립트가 게임과 같은
  주소에서 와야 Web Worker 가 동작합니다), 4MB 넘는 파일은 저장소 주소로 넘깁니다
  (`src/lib/serve-game-file.ts`).
- "기존 게임 파일 교체"를 고르면 그 게임이 새 빌드를 가리키게 바뀌고, 전에 쓰던 빌드는
  저장소에서 지웁니다. 다 올라간 뒤에 바뀌므로 올리는 도중의 상태는 방문자에게 보이지 않습니다.
- 누가 올릴 수 있는지는 서버 코드에서만 정해집니다. 저장소 쪽에 따로 권한을 설정할 것이 없습니다.

저장소는 두 가지이고, 콘솔의 업로드 칸 아래 "저장 위치"에 지금 어느 쪽인지 나옵니다.

| | Vercel Blob (`/g/b/…`) | Supabase Storage (`/g/u/…`) |
| --- | --- | --- |
| 쓰이는 조건 | Blob 저장소가 프로젝트에 연결돼 있을 때 | 연결돼 있지 않을 때 (기본값) |
| 전송량 | 사이트와 같은 Vercel 의 한도를 씀 | Supabase 의 한도를 씀 |
| 파일 하나 | 200MB | 50MB (무료 요금제 한도) |
| 업로드 허가 | `/api/game-upload` 가 파일마다 토큰 발급 | 서버 액션이 1회용 주소 발급 |

Blob 을 켜려면 Vercel 대시보드 → Storage 에서 Blob 저장소를 만들어 이 프로젝트에 연결하고
다시 배포합니다 (`BLOB_READ_WRITE_TOKEN` 환경 변수가 생깁니다). 그 뒤로 올리는 게임은 Blob 으로
가고, 전에 Supabase 에 올린 게임은 주소에 저장소가 남아 있어 원래 자리에서 그대로 열립니다.
옮기려면 그 게임을 "기존 게임 파일 교체"로 다시 올리면 됩니다.

#### 2번 — 명령어로 넣기

게임 파일이 저장소(Git)에 들어가 Vercel CDN 에서 바로 내려갑니다. 전송량 한도가 1번보다 훨씬
넉넉해서, 용량이 크거나 방문자가 많이 몰릴 게임에 맞습니다. 프로젝트 폴더에서 실행합니다.

```bash
node scripts/add-game.mjs "C:\경로\내-게임-폴더" my-game --deploy
```

- 폴더를 `public/g/my-game/` 로 복사하고(1번과 같은 검사), `--deploy` 가 있으면 그 폴더만
  커밋해서 올립니다. 작업 중인 다른 파일은 그 커밋에 섞이지 않습니다.
- 1~2분 뒤 배포가 끝나면 운영자 콘솔의 게임 등록 화면에 "아직 등록하지 않은 게임 폴더"로 뜹니다.
  게임 경로에 `/g/my-game/index.html` 을 넣고 이름을 적어 등록합니다 (처음 한 번만).
- 새 버전은 `--replace --deploy` 를 붙여 다시 실행하면 됩니다. 주소가 그대로라 등록을 다시 할
  필요가 없습니다.
- `--deploy` 없이 실행하면 복사만 합니다. `npm run dev` 로 띄워 먼저 확인할 때 씁니다.
- `/` 로 시작하는 경로처럼 올려도 안 뜨는 문제가 있으면 배포하지 않고 멈춥니다.

`npm run add-game -- …` 로도 되지만, Windows PowerShell 에서는 npm 이 `--replace` · `--deploy`
를 스크립트에 전달하지 못합니다. 위처럼 `node` 로 직접 실행하거나, 대시 없이
`npm run add-game "<폴더>" my-game replace deploy` 로 적으세요.

#### 어느 쪽을 쓸까 — 한도 (2026-10 공식 문서 기준, 무료 요금제)

| | 1번 웹 업로드 — Supabase | 1번 웹 업로드 — Vercel Blob | 2번 명령어 (Git + Vercel) |
| --- | --- | --- | --- |
| 파일 하나 | 50MB | 200MB | 100MB (GitHub 이 거부) |
| 전체 저장 공간 | 1GB | Hobby 1GB, Pro 는 쓴 만큼 | 저장소는 1GB 이하 권장 |
| 한 달 전송량 | 5GB + 캐시 전송 5GB | Hobby 10GB, Pro 는 1TB 에 포함 | Hobby 100GB, Pro 1TB |
| 파일 이름 | 영문 · 숫자만 | 영문 · 숫자만 | 제한 없음 |
| 반영 | 즉시 | 즉시 | 배포 1~2분 |

전송량이 실질적인 차이입니다. 웹 업로드는 4MB 넘는 파일을 방문자가 저장소에서 직접 받으므로,
무료 요금제에서는 큰 파일이 합쳐 20MB 인 게임이 새 방문자 250~500명쯤에서 한 달 치를 다 씁니다
(Supabase · Blob Hobby 모두 비슷한 수준). 무료 요금제로 사람이 몰릴 게임을 올릴 때는 2번이
맞고, Vercel Pro 로 올린 뒤에는 Blob 으로 가는 웹 업로드도 같은 1TB 를 씁니다.

같은 게임을 두 방식 사이에서 옮길 수 있고, 랭킹 · 댓글은 그대로 남습니다.

- 2번 → 1번: 콘솔의 폴더 올리기에서 "기존 게임 파일 교체"로 그 게임을 고릅니다.
- 1번 → 2번: 명령어로 넣어 배포한 뒤, 콘솔의 "아직 등록하지 않은 게임 폴더" 목록에서 그 게임에
  연결합니다. 전에 올렸던 빌드는 저장소에서 지워집니다.

그 밖에 알아둘 것: Supabase 무료 프로젝트는 일주일 동안 요청이 없으면 일시정지됩니다. Vercel
Hobby 는 초과하면 그 기능이 최대 30일 멈추고, 광고(애드센스)를 붙이는 순간 상업적 이용이라
Pro 가 필요합니다.

### 구독자 제출

구독자는 `/submit` 에서 코드를 붙여넣고 미리보기로 확인한 뒤 제출합니다. 상태는 `pending` 으로
들어오고, 운영자 콘솔에서 **공개** 를 눌러야 플랫폼에 노출됩니다.

---

### 제작 노트 · 정책 페이지

운영자 콘솔의 **제작 노트** 에서 글을 씁니다. 본문은 간단한 마크다운이고(지원 문법은
[`src/components/note-body.tsx`](src/components/note-body.tsx) 머리말), 비공개로 저장하면 운영자만
볼 수 있어 실제 화면에서 확인한 뒤 공개할 수 있습니다.

소개 · 이용약관 · 개인정보처리방침에 찍히는 문의 이메일은 [`src/lib/site.ts`](src/lib/site.ts) 의
`CONTACT_EMAIL` 한 곳에서 정합니다. 수집 항목이나 외부 서비스가 바뀌면(광고 시작, 분석 도구 추가
등) 개인정보처리방침 본문과 시행일도 같이 고쳐야 합니다.

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

### 게임 전용 주소

폴더 게임(`/g/…`)도 기본은 오리진 없는 샌드박스라서 `localStorage` · IndexedDB · 주소로 만드는
Web Worker 를 쓸 수 없습니다. 같은 배포에 두 번째 도메인(예: `play.viberhood.io`)을 붙이고
저장소의 `.env.production` 에 아래처럼 적어 두면, 폴더 게임을 그 주소에서 내려주면서 자기
오리진을 줍니다.

```
NEXT_PUBLIC_GAME_ORIGIN=https://play.viberhood.io
```

게임은 자기 주소의 저장소만 갖고 이 사이트의 쿠키 · 세션에는 닿지 못합니다. 그 주소에서는 게임
파일(`/g` · `/sdk`) 외에는 아무것도 내려가지 않고(`src/middleware.ts`), 반대로 이 사이트 주소로
열린 게임 파일은 서버 헤더가 항상 샌드박스로 강제합니다(`next.config.ts`). 도메인이 실제로
연결된 것을 확인한 뒤에 값을 넣으세요 — 먼저 넣으면 게임 화면이 빈 채로 뜹니다.

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
쓰는 곳은 점수 저장(`/api/runs/submit`), 플레이 수 · 요청 제한, 그리고 운영자 확인을 거친 게임
폴더 업로드(`src/app/actions/game-upload.ts`)입니다. Vercel Blob 을 연결했다면
`BLOB_READ_WRITE_TOKEN` 도 같은 급의 비밀값입니다 — 저장소의 모든 파일을 쓰고 지울 수 있습니다.

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
    notes/                   제작 노트 목록 · 글 (운영자 콘솔에서 작성)
    about/ terms/ privacy/   소개 · 이용약관 · 개인정보처리방침
    sitemap.ts robots.ts     /sitemap.xml · /robots.txt
    tournaments/             대회 목록 · 상세(카운트다운 + 시상대 + 실시간 랭킹)
    hackathons/              해커톤 목록 · 상세(출품작)
    submit/                  구독자 게임 제출
    admin/                   운영자 콘솔
    u/[handle]/              프로필 (최고 기록 + 만든 게임)
    docs/sdk/                게임 제작 가이드
    g/b/ · g/u/              운영자 콘솔에서 올린 게임 파일 서빙 (Vercel Blob · Supabase)
    api/game-upload/         Vercel Blob 업로드 허가 (운영자만)
    api/runs/                점수 토큰 발급 · 제출 검증
    actions/                 서버 액션 (좋아요·댓글·제출·운영)
  components/                UI
  lib/                       Supabase 클라이언트, 쿼리, 샌드박스, 토큰, 기능 스위치(site.ts)
public/
  sdk/arcade.js              게임이 불러가는 SDK
  g/                         기본 게임 (reflex, dodge)
  brand/                     로고 · 마크 · 채널아트 (README.md 에 사용 규칙)
scripts/
  brand/build-brand.mjs      브랜드 애셋 생성기 (색·문구 고치고 다시 실행)
supabase/
  schema.sql                 테이블 · 뷰 · 트리거 · RLS · 레이트리밋
  security-fixes.sql         운영 중인 DB 에 보안 패치만 따로 적용하는 스크립트
  run-verification.sql       기록 검증 컬럼 · 무효 처리 정책 · 랭킹 뷰
  notes.sql                  제작 노트 테이블 · 정책
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
