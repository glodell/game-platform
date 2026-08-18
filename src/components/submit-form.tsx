"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { submitGame } from "@/app/actions/submit-game";
import { GAME_SANDBOX, wrapUserGame } from "@/lib/sandbox";

const STARTER = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>내 게임</title></head>
<body style="display:grid;place-items:center;height:100vh;font-family:system-ui">
  <button id="btn" style="font-size:20px;padding:16px 24px">눌러서 시작</button>
  <script>
    let score = 0, timer = null;
    Arcade.ready(function () {
      btn.onclick = function () {
        Arcade.start();                 // 판 시작
        score = 0;
        btn.textContent = "빨리 눌러!";
        clearTimeout(timer);
        timer = setTimeout(function () {
          Arcade.gameOver(score);       // 판 종료 → 점수 제출
          btn.textContent = "다시 하기 (" + score + "점)";
        }, 5000);
        btn.onclick = function () {
          score++;
          Arcade.progress(score);       // 진행 점수 표시 (선택)
        };
      };
    });
  </script>
</body>
</html>`;

type Props = {
  hackathons: { slug: string; title: string }[];
  defaultHackathon: string;
  siteUrl: string;
};

export function SubmitForm({ hackathons, defaultHackathon, siteUrl }: Props) {
  const [html, setHtml] = useState("");
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setError("파일이 400KB를 넘습니다.");
      return;
    }
    file.text().then((text) => {
      setHtml(text);
      setError(null);
    });
  }

  function preview() {
    if (!html.trim()) {
      setError("먼저 코드를 넣어주세요.");
      return;
    }
    setError(null);
    setPreviewDoc(wrapUserGame(html, siteUrl));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("html", html);
    setError(null);

    startTransition(async () => {
      const result = await submitGame(formData);
      if (result.ok) {
        setDone(result.slug);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="panel p-8 mt-8 text-center">
        <p className="text-2xl mb-3">🎉</p>
        <h2 className="font-black text-xl">제출 완료!</h2>
        <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">
          운영자 검토가 끝나면 플랫폼에 공개됩니다. 아래 내 제출 목록에서 상태를 확인할 수 있습니다.
        </p>
        <button
          onClick={() => {
            setDone(null);
            setHtml("");
            setPreviewDoc(null);
          }}
          className="mt-6 rounded-lg border border-ink-700 px-5 py-2.5 text-sm font-semibold hover:border-neon-400/50 hover:text-neon-400 transition-colors"
        >
          하나 더 제출하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 mt-8">
      <Field label="게임 이름" required>
        <input
          name="title"
          required
          maxLength={60}
          placeholder="예: 3초 반응속도 테스트"
          className={inputClass}
        />
      </Field>

      <Field label="한 줄 소개" hint="게임 카드에 표시됩니다">
        <input
          name="tagline"
          maxLength={80}
          placeholder="예: 화면이 초록으로 바뀌는 순간 누르세요"
          className={inputClass}
        />
      </Field>

      <Field label="설명" hint="조작법, 규칙, 만든 계기 등">
        <textarea name="description" rows={3} className={inputClass} />
      </Field>

      {hackathons.length > 0 && (
        <Field label="해커톤 참가" hint="접수 중인 해커톤이 있으면 선택하세요">
          <select name="hackathon" defaultValue={defaultHackathon} className={inputClass}>
            <option value="">참가 안 함 (일반 게임으로 제출)</option>
            {hackathons.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="순위 기준">
          <select name="scoring" defaultValue="high" className={inputClass}>
            <option value="high">점수가 높을수록 좋음</option>
            <option value="low">기록이 낮을수록 좋음 (타임어택)</option>
          </select>
        </Field>
        <Field label="점수 단위">
          <input name="score_unit" defaultValue="점" maxLength={8} className={inputClass} />
        </Field>
      </div>

      <Field
        label="게임 코드 (HTML 한 파일)"
        required
        hint="Arcade.gameOver(점수) 를 호출하면 랭킹에 반영됩니다"
      >
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            .html 파일 불러오기
          </button>
          <button
            type="button"
            onClick={() => setHtml(STARTER)}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-lime-glow/50 transition-colors"
          >
            예제 코드 넣기
          </button>
          <button
            type="button"
            onClick={preview}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            미리보기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            onChange={loadFile}
            className="hidden"
          />
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder="<!doctype html> ..."
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <p className="text-xs text-ink-600 mt-1.5 tabular-nums">
          {new Blob([html]).size.toLocaleString("ko-KR")} / 400,000 바이트
        </p>
      </Field>

      {previewDoc && (
        <div>
          <p className="text-sm font-semibold mb-2">미리보기</p>
          <iframe
            title="미리보기"
            srcDoc={previewDoc}
            sandbox={GAME_SANDBOX}
            className="w-full aspect-video rounded-xl border border-ink-700 bg-black"
          />
          <p className="text-xs text-ink-600 mt-2">
            실제 플랫폼과 동일한 샌드박스에서 실행됩니다. 외부 네트워크 요청은 차단되니 필요한 자원은
            코드 안에 포함해 주세요.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-punch-500/40 bg-punch-500/10 px-4 py-3 text-sm text-punch-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-lime-glow text-ink-950 px-6 py-3.5 font-bold hover:brightness-110 transition-all disabled:opacity-50"
      >
        {pending ? "제출하는 중…" : "제출하기"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-punch-400 ml-1">*</span>}
      </span>
      {hint && <span className="block text-xs text-ink-600 mt-0.5 mb-2">{hint}</span>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </label>
  );
}
