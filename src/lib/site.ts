/** 헤더·푸터가 함께 쓰는 사이트 링크 모음. 한 곳에서만 고치면 되도록 여기에 둡니다. */

export const NAV = [
  { href: "/games", label: "게임" },
  { href: "/tournaments", label: "대회" },
  { href: "/hackathons", label: "해커톤" },
  { href: "/docs/sdk", label: "만들기" },
] as const;

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
