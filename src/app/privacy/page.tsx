import type { Metadata } from "next";
import { Contact, DocLink, DocList, DocPage, DocSection } from "@/components/doc";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "바이버후드가 어떤 정보를 왜 수집하고, 얼마나 보관하며, 쿠키와 광고를 어떻게 다루는지 안내합니다.",
};

/**
 * 여기 적힌 내용은 실제 동작과 맞아야 합니다. 수집 항목이나 외부 서비스가 바뀌면
 * (분석 도구 추가, 광고 시작, 로그인 방식 추가 등) 이 페이지와 시행일을 함께 고치세요.
 */
export default function PrivacyPage() {
  return (
    <DocPage
      title="개인정보처리방침"
      effective="2026년 10월 12일"
      lead="바이버후드(viberhood.io, 이하 '서비스')는 꼭 필요한 정보만 수집하고, 아래에 적은 목적으로만 씁니다."
    >
      <DocSection title="1. 수집하는 정보">
        <p>
          <strong className="text-ink-100">로그인하지 않으면</strong> 이름 · 이메일 같은 정보는
          수집하지 않습니다. 게임은 로그인 없이 플레이할 수 있습니다.
        </p>
        <p>
          <strong className="text-ink-100">구글 계정으로 로그인하면</strong> 구글이 전달하는 아래
          정보를 받습니다.
        </p>
        <DocList
          items={[
            "이름, 프로필 사진 — 닉네임 · 핸들 · 프로필로 쓰이며 랭킹과 댓글에 공개됩니다.",
            "이메일 주소 — 계정을 구분하는 데 쓰이고, 랭킹 이벤트에서 1~3위에 오른 분께는 상품 안내를 드리려고 운영자가 확인합니다. 다른 이용자에게는 보이지 않습니다.",
          ]}
        />
        <p>
          <strong className="text-ink-100">서비스를 이용하면서</strong> 아래 정보가 생깁니다.
        </p>
        <DocList
          items={[
            "게임 기록 — 점수, 플레이 시간, 기록한 시각",
            "기록 검증 정보 — 한 판 동안의 조작 횟수, 점수 변화, 시간 정보, 탭 전환 여부. 부정 기록을 가려내는 데 쓰이며 개인을 식별하는 값은 들어 있지 않습니다.",
            "좋아요, 댓글",
            "IP 주소 등 접속 정보 — 플레이 수 중복 집계와 과도한 요청을 막는 데 잠시 쓰이고, 호스팅 사업자의 접속 기록에 남을 수 있습니다.",
          ]}
        />
      </DocSection>

      <DocSection title="2. 이용 목적">
        <DocList
          items={[
            "로그인 상태 유지와 계정 구분",
            "랭킹 · 프로필 · 댓글 표시",
            "랭킹 이벤트 결과 확인과 1~3위 상품 안내",
            "기록 조작과 서비스 악용 방지",
            "문의 · 삭제 요청 처리",
          ]}
        />
      </DocSection>

      <DocSection title="3. 보관 기간">
        <p>
          계정 정보와 기록 · 댓글은 계정 삭제를 요청할 때까지 보관하고, 요청을 받으면 지체 없이
          지웁니다. 요청 제한에 쓰는 접속 정보는 짧은 기간 뒤 주기적으로 삭제합니다. 법령에서
          보관을 정한 경우에는 그 기간 동안 보관합니다.
        </p>
      </DocSection>

      <DocSection title="4. 제3자 제공과 처리 위탁">
        <p>
          수집한 정보를 판매하거나 광고 목적으로 제3자에게 넘기지 않습니다. 법령에 따른 요청이 있는
          경우는 예외입니다. 서비스 운영을 위해 아래 사업자의 서비스를 이용하며, 이들의 서버가
          국외에 있어 정보가 국외에서 처리될 수 있습니다.
        </p>
        <DocList
          items={[
            "Supabase Inc. — 데이터베이스와 로그인 인증 (계정 정보, 기록, 댓글)",
            "Vercel Inc. — 웹사이트 호스팅 (IP 주소 등 접속 기록)",
            "Google LLC — 구글 계정 로그인",
          ]}
        />
      </DocSection>

      <DocSection title="5. 쿠키">
        <p>
          로그인하면 로그인 상태를 유지하기 위한 쿠키가 브라우저에 저장됩니다. 로그아웃하거나
          브라우저 설정에서 쿠키를 지우면 사라집니다. 쿠키를 차단해도 게임은 플레이할 수 있지만
          로그인은 유지되지 않습니다.
        </p>
      </DocSection>

      <DocSection title="6. 광고">
        <p>
          서비스에는 Google 애드센스 광고가 게재될 수 있습니다. 광고가 게재되는 경우 다음이
          적용됩니다.
        </p>
        <DocList
          items={[
            "Google을 포함한 제3자 광고 사업자는 쿠키를 사용해, 이용자가 이 사이트나 다른 사이트를 방문한 기록을 바탕으로 광고를 게재합니다.",
            <>
              이용자는{" "}
              <DocLink href="https://adssettings.google.com">Google 광고 설정</DocLink>에서 맞춤
              광고를 끌 수 있고,{" "}
              <DocLink href="https://www.aboutads.info/choices">aboutads.info</DocLink>에서 다른
              광고 사업자의 맞춤 광고용 쿠키 사용을 거부할 수 있습니다.
            </>,
            <>
              Google이 파트너 사이트에서 정보를 사용하는 방식은{" "}
              <DocLink href="https://policies.google.com/technologies/partner-sites">
                Google 정책 페이지
              </DocLink>
              에서 확인할 수 있습니다.
            </>,
          ]}
        />
      </DocSection>

      <DocSection title="7. 이용자의 권리">
        <p>
          이용자는 언제든 자신의 정보를 보여 달라거나, 고치거나, 지워 달라고 요청할 수 있습니다.
          계정을 삭제하면 프로필, 기록, 좋아요, 댓글이 함께 지워집니다. 아래 문의처로 요청해
          주세요.
        </p>
      </DocSection>

      <DocSection title="8. 아동의 개인정보">
        <p>
          만 14세 미만 아동은 회원으로 가입할 수 없으며, 만 14세 미만 아동의 개인정보를 알면서
          수집하지 않습니다.
        </p>
      </DocSection>

      <DocSection title="9. 안전하게 지키기 위한 조치">
        <DocList
          items={[
            "모든 통신은 암호화(HTTPS)됩니다.",
            "데이터베이스는 행 단위 접근 제어로 본인과 운영자만 수정할 수 있게 잠겨 있습니다.",
            "비밀번호는 받지 않습니다. 로그인은 구글이 처리합니다.",
          ]}
        />
      </DocSection>

      <DocSection title="10. 개인정보 보호책임자와 문의">
        <p>
          개인정보 보호책임자: 바이버후드 운영자
          <br />
          연락처: <Contact />
        </p>
      </DocSection>

      <DocSection title="11. 방침의 변경">
        <p>이 방침을 바꿀 때는 시행일과 함께 이 페이지에 올립니다.</p>
      </DocSection>
    </DocPage>
  );
}
