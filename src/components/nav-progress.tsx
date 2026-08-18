"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * 페이지 이동 중임을 알리는 상단 진행 바.
 *
 * App Router 에는 라우터 이벤트가 없어서, 내부 링크 클릭을 가로채 시작하고
 * 실제로 경로(또는 쿼리)가 바뀌면 끝냅니다. 서버 렌더가 끝날 때까지 걸리는
 * 시간 동안 화면이 멈춘 것처럼 보이는 문제를 없애는 게 목적입니다.
 */
function NavProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // 링크 클릭 감지 → 진행 바 시작
  useEffect(() => {
    function onClick(event: MouseEvent) {
      // 새 탭/다운로드/수정키 조합은 페이지 이동이 아니므로 무시
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // 같은 주소면 이동이 없으니 바를 띄우지 않습니다.
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;

      start();
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    clearTimers();
    setVisible(true);
    setProgress(8);
    // 실제 진행률을 알 수 없으므로 90%까지 점점 느리게 채웁니다.
    const steps = [
      [90, 30],
      [400, 55],
      [900, 72],
      [1600, 82],
      [2600, 90],
    ] as const;
    steps.forEach(([delay, value]) => {
      timers.current.push(setTimeout(() => setProgress(value), delay));
    });
  }

  // 경로가 실제로 바뀌면 완료 처리
  useEffect(() => {
    if (!visible) return;
    clearTimers();
    setProgress(100);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
    return () => clearTimeout(hide);
    // visible 은 의도적으로 제외 — 경로 변경에만 반응해야 합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => clearTimers, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 top-0 h-0.5 pointer-events-none"
      role="progressbar"
      aria-label="페이지 이동 중"
      aria-hidden={!visible}
    >
      <div
        className="h-full bg-gradient-to-r from-neon-400 to-punch-400 transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}

export function NavProgress() {
  // useSearchParams 는 Suspense 경계가 필요합니다.
  return (
    <Suspense fallback={null}>
      <NavProgressInner />
    </Suspense>
  );
}
