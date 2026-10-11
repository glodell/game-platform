import Link from "next/link";
import type { Metadata } from "next";
import { Contact, DocLink, DocList, DocPage, DocSection } from "@/components/doc";
import { SOCIAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "소개",
  description:
    "바이버후드는 쇼츠에서 AI로 만든 게임을 브라우저에서 바로 해볼 수 있게 모아 둔 체험관입니다.",
};

export default function AboutPage() {
  return (
    <DocPage
      title="바이버후드 소개"
      lead="바이버후드는 쇼츠에서 AI와 함께 만든 게임을 직접 해볼 수 있게 모아 둔 체험관입니다. 영상으로만 보던 게임을 설치 없이, 가입 없이, 브라우저에서 바로 플레이할 수 있습니다."
    >
      <DocSection title="무엇을 할 수 있나요">
        <DocList
          items={[
            <>
              <Link href="/games" className="text-neon-400 hover:underline">
                게임
              </Link>{" "}
              — 쇼츠에 나온 게임을 골라 바로 해봅니다. PC와 모바일 모두 됩니다.
            </>,
            "랭킹 — 구글 계정으로 로그인하면 기록이 게임별 랭킹에 올라갑니다. 로그인하지 않아도 연습으로 얼마든지 플레이할 수 있습니다.",
            "좋아요 · 댓글 — 해본 게임에 감상이나 버그, 개선 아이디어를 남길 수 있습니다.",
            <>
              <Link href="/notes" className="text-neon-400 hover:underline">
                제작 노트
              </Link>{" "}
              — 게임을 어떻게 만들었는지, 어떤 지점에서 막혔고 어떻게 풀었는지 기록합니다.
            </>,
          ]}
        />
      </DocSection>

      <DocSection title="어떻게 만들어지나요">
        <p>
          이곳의 게임은 코드를 직접 한 줄씩 짜는 대신, AI에게 만들고 싶은 것을 설명하고 결과를
          다듬어 가는 방식(바이브코딩)으로 만듭니다. 만드는 과정은 쇼츠로 공개하고, 완성된 게임은
          이곳에 올립니다.
        </p>
      </DocSection>

      <DocSection title="채널">
        <DocList
          items={SOCIAL.map((item) => (
            <DocLink key={item.key} href={item.href}>
              {item.label}
            </DocLink>
          ))}
        />
      </DocSection>

      <DocSection title="문의">
        <p>
          게임 오류 제보, 제휴, 계정 · 기록 삭제 요청은 <Contact /> 로 보내주세요.
        </p>
        <p>
          <Link href="/terms" className="text-neon-400 hover:underline">
            이용약관
          </Link>
          {" · "}
          <Link href="/privacy" className="text-neon-400 hover:underline">
            개인정보처리방침
          </Link>
        </p>
      </DocSection>
    </DocPage>
  );
}
