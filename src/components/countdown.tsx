"use client";

import { useEffect, useState } from "react";
import { splitDuration } from "@/lib/format";

/**
 * 서버/클라이언트 시각 차이로 hydration 이 깨지지 않도록,
 * 첫 렌더는 서버가 계산한 값을 그대로 쓰고 마운트 후부터 1초마다 갱신합니다.
 */
export function Countdown({
  target,
  label,
  compact = false,
}: {
  target: string;
  label?: string;
  compact?: boolean;
}) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? targetMs - targetMs : targetMs - now;
  const t = splitDuration(now === null ? 0 : remaining);

  if (now !== null && t.done) {
    return <span className="text-ink-400 text-sm">마감됨</span>;
  }

  if (compact) {
    const text =
      now === null
        ? "—"
        : t.days > 0
          ? `${t.days}일 ${t.hours}시간`
          : `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}:${String(t.seconds).padStart(2, "0")}`;
    return <span className="tabular-nums font-semibold">{text}</span>;
  }

  const cells = [
    { value: t.days, unit: "일" },
    { value: t.hours, unit: "시간" },
    { value: t.minutes, unit: "분" },
    { value: t.seconds, unit: "초" },
  ];

  return (
    <div>
      {label && <p className="text-xs text-ink-400 mb-2">{label}</p>}
      <div className="flex gap-2">
        {cells.map((c) => (
          <div
            key={c.unit}
            className="rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2 text-center min-w-16"
          >
            <div className="text-2xl font-black tabular-nums leading-none">
              {now === null ? "--" : String(c.value).padStart(2, "0")}
            </div>
            <div className="text-[10px] text-ink-400 mt-1">{c.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
