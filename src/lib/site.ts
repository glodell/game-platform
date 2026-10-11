/** 헤더·푸터가 함께 쓰는 사이트 링크 모음. 한 곳에서만 고치면 되도록 여기에 둡니다. */

/**
 * 지금 열어 둔 기능.
 *
 * 현재는 "체험관" 모드입니다 — 운영자가 만든 게임을 골라 바로 해보는 것만 남기고
 * 대회 · 해커톤 · 구독자 참여는 꺼 두었습니다. 코드는 지우지 않았으니, 다시 열 때는
 * 여기서 true 로 바꾸기만 하면 메뉴 · 홈 섹션 · 페이지가 함께 돌아옵니다.
 *
 * 해커톤은 출품이 /submit 을 거치므로 켤 때 community 도 같이 켜야 합니다.
 */
export const FEATURES: Record<"tournaments" | "hackathons" | "community", boolean> = {
  /** 대회 — /tournaments, 홈의 대회 섹션, 게임 페이지의 진행 중 대회 배너 */
  tournaments: false,
  /** 해커톤 — /hackathons, 홈의 해커톤 배너 */
  hackathons: false,
  /** 구독자 참여 — 게임 제출(/submit), 만들기 가이드(/docs/sdk), 구독자 제작 게임 노출 */
  community: false,
};

/**
 * 문의 · 개인정보 보호책임자 연락처. 소개 · 이용약관 · 개인정보처리방침에 그대로 찍힙니다.
 * 비워두면 이메일 대신 채널(유튜브 · 인스타그램)로 안내합니다.
 */
export const CONTACT_EMAIL = "glodellism@gmail.com";

/** 푸터에 항상 깔리는 안내 링크 — 정책 페이지는 어느 화면에서든 닿아야 합니다. */
export const FOOTER_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
];

export const NAV = [
  { href: "/games", label: "게임", on: true },
  { href: "/notes", label: "제작 노트", on: true },
  { href: "/tournaments", label: "대회", on: FEATURES.tournaments },
  { href: "/hackathons", label: "해커톤", on: FEATURES.hackathons },
  { href: "/docs/sdk", label: "만들기", on: FEATURES.community },
]
  .filter((item) => item.on)
  .map(({ href, label }) => ({ href, label }));

/** 꺼 둔 기능의 주소. 미들웨어가 홈으로 돌려보냅니다. */
export const HIDDEN_PATHS = [
  ...(FEATURES.tournaments ? [] : ["/tournaments"]),
  ...(FEATURES.hackathons ? [] : ["/hackathons"]),
  ...(FEATURES.community ? [] : ["/submit", "/docs/sdk"]),
];

export type SocialKey = "youtube" | "instagram" | "tiktok";

export const SOCIAL: { key: SocialKey; label: string; href: string; hover: string }[] = [
  {
    key: "youtube",
    label: "유튜브",
    href: "https://www.youtube.com/@viberhood",
    hover: "hover:text-[#ff4b4b] hover:border-[#ff4b4b]/40",
  },
  {
    key: "instagram",
    label: "인스타그램",
    href: "https://www.instagram.com/viberhood.io/",
    hover: "hover:text-[#e46bb0] hover:border-[#e46bb0]/40",
  },
  {
    key: "tiktok",
    label: "틱톡",
    href: "https://www.tiktok.com/@viberhood.io",
    hover: "hover:text-neon-400 hover:border-neon-400/40",
  },
];
