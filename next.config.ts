import type { NextConfig } from "next";

/**
 * 보안 헤더.
 *
 * frame-ancestors 를 'self' 로 두는 이유: 외부 사이트가 우리 페이지를 iframe 에 담아
 * 구글 로그인 버튼 위에 투명 레이어를 씌우는 클릭재킹을 막으면서도,
 * 우리 플레이 화면이 같은 오리진의 /games/... 게임을 담는 것은 그대로 되게 하려는 것입니다.
 *
 * script-src 까지 포함한 전체 CSP 는 일부러 넣지 않았습니다. srcdoc iframe 은 부모 문서의
 * CSP 를 물려받기 때문에, 부모에 엄격한 script-src 를 걸면 구독자가 제출한 게임의
 * 인라인 스크립트가 전부 막혀 게임이 통째로 죽습니다. 제출 게임은 이미 wrapUserGame() 이
 * 넣어주는 자체 CSP + allow-same-origin 없는 샌드박스로 격리돼 있습니다.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // autoplay·gamepad 는 게임 iframe 이 allow 속성으로 쓰므로 건드리지 않습니다.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      /**
       * 게임 iframe 은 allow-same-origin 없는 샌드박스라 오리진이 'null' 입니다. 그래서 게임이
       * 자기 폴더의 파일을 불러오는 것조차 교차 출처 요청이 되어, 이 헤더가 없으면 모듈 스크립트
       * · fetch(모델, 소리) · WebGL 텍스처가 전부 CORS 로 막힙니다 — 파일이 여러 개인 3D 게임이
       * 통째로 안 뜹니다. /g 아래는 누구나 받아갈 수 있는 정적 게임 파일뿐이라 열어도 무방합니다.
       */
      {
        source: "/g/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
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
