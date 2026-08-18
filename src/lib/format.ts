const KST = "Asia/Seoul";

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: KST,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatScore(score: number, unit?: string | null) {
  const n = Number(score);
  const text = Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toFixed(2);
  return unit ? `${text}${unit}` : text;
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return formatDate(iso);
}

export function formatCompact(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}천`;
  return `${(n / 10000).toFixed(1)}만`;
}

/** 남은 시간을 일/시/분/초로 쪼갭니다. 음수면 전부 0. */
export function splitDuration(ms: number) {
  const t = Math.max(0, ms);
  return {
    days: Math.floor(t / 86400000),
    hours: Math.floor((t / 3600000) % 24),
    minutes: Math.floor((t / 60000) % 60),
    seconds: Math.floor((t / 1000) % 60),
    done: t <= 0,
  };
}
