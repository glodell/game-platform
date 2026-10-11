import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { GAME_SANDBOX, isolatedGameOrigin, siteUrl } from "./src/lib/sandbox";

/**
 * 보안 헤더.
 *
 * frame-ancestors 를 'self' 로 두는 이유: 외부 사이트가 우리 페이지를 iframe 에 담아
 * 구글 로그인 버튼 위에 투명 레이어를 씌우는 클릭재킹을 막으려는 것입니다.
 *
 * script-src 까지 포함한 전체 CSP 는 일부러 넣지 않았습니다. srcdoc iframe 은 부모 문서의
 * CSP 를 물려받기 때문에, 부모에 엄격한 script-src 를 걸면 구독자가 제출한 게임의
 * 인라인 스크립트가 전부 막혀 게임이 통째로 죽습니다. 제출 게임은 이미 wrapUserGame() 이
 * 넣어주는 자체 CSP + allow-same-origin 없는 샌드박스로 격리돼 있습니다.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // autoplay·gamepad 는 게임 iframe 이 allow 속성으로 쓰므로 건드리지 않습니다.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

// 게임 파일(/g/…)은 프레임 규칙이 달라서 아래에서 따로 정합니다.
const NO_FRAMING_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

/**
 * 게임 파일(/g/…) 헤더.
 *
 * Access-Control-Allow-Origin — 샌드박스 iframe 은 오리진이 'null' 이라 게임이 자기 폴더의
 * 파일을 불러오는 것조차 교차 출처 요청이 됩니다. 이 헤더가 없으면 모듈 스크립트 · fetch(모델,
 * 소리) · WebGL 텍스처가 전부 CORS 로 막힙니다. /g 아래는 누구나 받아갈 수 있는 정적 파일뿐입니다.
 *
 * CSP sandbox — 이 사이트 주소로 열린 게임 문서는 iframe 속성이 어떻든, 주소창에 직접 쳐서
 * 열든, 항상 오리진 없는 샌드박스에서 돌게 강제합니다. 게임 코드가 이 사이트의 쿠키 · 세션을
 * 만질 길을 서버 쪽에서 한 번 더 막는 것입니다.
 *
 * 게임 전용 주소(NEXT_PUBLIC_GAME_ORIGIN)에서는 그 강제를 풀어 게임이 자기 오리진을 갖게 하고
 * (localStorage · IndexedDB · Web Worker 가 그래야 동작합니다), 대신 이 사이트만 그 문서를
 * 프레임에 담을 수 있게 합니다.
 */
function gameFileHeaders() {
  const rules = [
    {
      source: "/g/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        // 게임 파일 자체가 검색 결과에 따로 잡히지 않게 — 들어올 곳은 /games/… 페이지입니다.
        { key: "X-Robots-Tag", value: "noindex" },
        {
          key: "Content-Security-Policy",
          value: `frame-ancestors 'self'; sandbox ${GAME_SANDBOX}`,
        },
      ],
    },
  ];

  const games = isolatedGameOrigin();
  if (!games) return rules;

  // www 가 붙은 주소와 안 붙은 주소 어느 쪽으로 들어와도 게임이 뜨게 둘 다 허용합니다.
  const site = new URL(siteUrl());
  const twin = new URL(site.origin);
  twin.hostname = site.hostname.startsWith("www.")
    ? site.hostname.slice(4)
    : `www.${site.hostname}`;

  return [
    ...rules,
    {
      source: "/g/:path*",
      // has 의 host 는 포트 없는 호스트 이름과 정규식으로 비교됩니다.
      has: [{ type: "host" as const, value: new URL(games).hostname.replace(/\./g, "\\.") }],
      headers: [
        {
          key: "Content-Security-Policy",
          value: `frame-ancestors ${site.origin} ${twin.origin}`,
        },
      ],
    },
  ];
}

/** public/g 아래에서 index.html 을 가진 폴더 이름 — 운영자 콘솔의 게임 경로 자동완성에 씁니다. */
function gameFolders() {
  const root = path.join(process.cwd(), "public", "g");
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => fs.existsSync(path.join(root, name, "index.html")))
      .sort();
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  env: {
    // 빌드할 때(개발 서버는 켤 때) 한 번 읽습니다. 폴더를 새로 넣었으면 다시 배포해야 반영됩니다.
    GAME_FOLDERS: gameFolders().join(","),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/((?!g/).*)", headers: NO_FRAMING_HEADERS },
      ...gameFileHeaders(),
    ];
  },
  /**
   * 전체화면 플레이 전용 페이지(/play/…)를 없앴습니다 — 게임 화면 우상단의 전체화면
   * 버튼과 역할이 그대로 겹쳤습니다. 이미 공유된 링크가 죽지 않도록 게임 상세로 넘깁니다.
   */
  async redirects() {
    return [{ source: "/play/:slug", destination: "/games/:slug", permanent: false }];
  },
};

export default nextConfig;
