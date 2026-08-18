import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "게임 만들기 가이드" };

const API = [
  {
    sig: "Arcade.ready(콜백)",
    desc: "플랫폼과 연결되면 콜백이 실행됩니다. 콜백 인자로 플레이어 정보와 대회 정보가 들어옵니다.",
  },
  { sig: "Arcade.start()", desc: "한 판이 시작될 때 호출하세요. 플레이 시간 측정이 시작됩니다." },
  {
    sig: "Arcade.progress(점수)",
    desc: "진행 중 점수를 화면 왼쪽 위 오버레이에 표시합니다. 선택 사항입니다.",
  },
  {
    sig: "Arcade.gameOver(점수, 부가정보?)",
    desc: "한 판이 끝났을 때 호출하세요. 점수가 서버로 전송되고 랭킹에 반영됩니다.",
  },
  {
    sig: "Arcade.onResult(콜백)",
    desc: "점수 제출 결과를 받습니다. { ok, rank, best } 형태입니다.",
  },
  { sig: "Arcade.restart()", desc: "게임 안에서 다시하기를 눌렀을 때 호출하면 상태가 초기화됩니다." },
];

const EXAMPLE = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>클릭 러시</title>
  <style>
    body { margin:0; height:100vh; display:grid; place-items:center;
           background:#0c0e1a; color:#e7e9f7; font-family:system-ui; }
    button { font-size:24px; padding:20px 32px; border-radius:16px;
             border:0; cursor:pointer; }
  </style>
</head>
<body>
  <button id="btn">시작</button>

  <script src="/sdk/arcade.js"></script>
  <script>
    var score = 0;

    Arcade.ready(function (config) {
      // config.player.name  — 플레이어 이름
      // config.tournament   — 대회 정보 (없으면 null)
      // config.canSubmit    — 점수를 남길 수 있는 상태인지
      document.getElementById("btn").textContent =
        config.player.name + "님, 시작!";
    });

    Arcade.onResult(function (r) {
      if (r.ok) console.log("현재 순위:", r.rank);
    });

    document.getElementById("btn").onclick = function () {
      Arcade.start();
      score = 0;
      this.textContent = "5초 동안 최대한 많이!";

      this.onclick = function () {
        score++;
        Arcade.progress(score);
      };

      var self = this;
      setTimeout(function () {
        Arcade.gameOver(score);            // ← 이 한 줄이 랭킹 등록입니다
        self.textContent = score + "점! 다시 하기";
        self.onclick = null;
      }, 5000);
    };
  </script>
</body>
</html>`;

const AI_PROMPT = `단일 HTML 파일로 동작하는 웹 게임을 만들어 줘.

조건:
- HTML/CSS/JS 를 파일 하나에 전부 넣을 것 (외부 라이브러리·폰트·이미지 URL 금지)
- <script src="/sdk/arcade.js"></script> 를 포함할 것
- 한 판이 시작될 때 Arcade.start(), 끝날 때 Arcade.gameOver(점수) 를 호출할 것
- 진행 점수는 Arcade.progress(점수) 로 알릴 것
- 모바일 세로 화면과 데스크톱 모두에서 동작할 것 (터치 + 마우스)
- 한 판이 30초 안에 끝날 것
- 색은 어두운 배경에 밝은 포인트로

게임 아이디어: (여기에 아이디어를 적으세요)`;

export default function SdkDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">게임 만들기</h1>
      <p className="text-ink-400 mt-3 leading-relaxed">
        게임은 <strong className="text-ink-100">HTML 파일 하나</strong>입니다. 그 안에서 점수가
        정해지면 <code className="text-neon-400">Arcade.gameOver(점수)</code> 한 줄만 부르면
        랭킹까지 자동으로 연결됩니다.
      </p>

      <Section title="1. 규칙은 두 줄">
        <ol className="space-y-2 text-ink-300">
          <li>
            <span className="text-neon-400 font-mono">Arcade.start()</span> — 판이 시작될 때
          </li>
          <li>
            <span className="text-neon-400 font-mono">Arcade.gameOver(점수)</span> — 판이 끝났을 때
          </li>
        </ol>
        <p className="text-sm text-ink-400 mt-4">
          나머지(로그인, 점수 저장, 순위 계산, 부정 제출 차단)는 플랫폼이 처리합니다.
        </p>
      </Section>

      <Section title="2. 통째로 복사해서 쓰는 예제">
        <Code>{EXAMPLE}</Code>
      </Section>

      <Section title="3. API">
        <ul className="divide-y divide-ink-800">
          {API.map((item) => (
            <li key={item.sig} className="py-3">
              <code className="text-sm text-neon-400 font-mono">{item.sig}</code>
              <p className="text-sm text-ink-400 mt-1">{item.desc}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="4. AI에게 시킬 때 쓰는 프롬프트">
        <p className="text-sm text-ink-400 mb-3">
          이대로 붙여넣으면 플랫폼에 바로 올릴 수 있는 형태로 나옵니다.
        </p>
        <Code>{AI_PROMPT}</Code>
      </Section>

      <Section title="5. 샌드박스 제한">
        <p className="text-ink-300 leading-relaxed">
          제출된 게임은 격리된 iframe 안에서 실행됩니다. 다른 사람의 계정이나 이 사이트의 데이터에
          접근할 수 없고, 외부 네트워크 요청도 차단됩니다.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink-400">
          <li>· 이미지·소리는 코드 안에 data URI 로 넣거나 canvas 로 직접 그리세요</li>
          <li>· fetch, XMLHttpRequest, WebSocket 은 동작하지 않습니다</li>
          <li>· localStorage, cookie 는 쓸 수 없습니다 (점수는 플랫폼이 저장합니다)</li>
          <li>· 파일 크기는 400KB 까지</li>
        </ul>
      </Section>

      <div className="panel p-6 mt-12 text-center">
        <p className="font-bold">다 만들었나요?</p>
        <p className="text-sm text-ink-400 mt-1">
          제출 페이지에서 미리보기로 확인한 뒤 바로 올릴 수 있습니다.
        </p>
        <Link
          href="/submit"
          className="inline-block mt-5 rounded-xl bg-lime-glow text-ink-950 px-6 py-3 font-bold hover:brightness-110 transition-all"
        >
          게임 제출하러 가기
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-black tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="panel p-4 overflow-x-auto text-xs leading-relaxed font-mono text-ink-300">
      <code>{children}</code>
    </pre>
  );
}
