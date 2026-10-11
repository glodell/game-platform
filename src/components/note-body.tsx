import type { ReactNode } from "react";
import { parseYouTube, type YouTubeRef } from "@/lib/youtube";

/**
 * 제작 노트 본문 렌더러 — 간단한 마크다운만 알아듣습니다.
 *
 *   블록   ## 소제목 · - 목록 · 1. 번호 목록 · > 인용 · --- 구분선 · ``` 코드 ```
 *          유튜브 주소나 이미지 주소(또는 ![설명](주소))만 한 줄에 적으면 플레이어 · 그림
 *   글자   **굵게** · *기울임* · `코드` · [글자](주소) · 맨 주소는 자동 링크
 *
 * 문단은 빈 줄로 나누고, 문단 안의 줄바꿈은 그대로 살립니다.
 * 표 · 중첩 목록은 지원하지 않습니다 (적으면 글자 그대로 나옵니다).
 *
 * HTML 문자열을 만들지 않고 React 요소로만 조립합니다. 본문에 태그를 적어도 글자로 나오고,
 * 링크 · 이미지 주소는 스킴을 확인한 것만 속성에 들어갑니다.
 */
export function NoteBody({ body }: { body: string }) {
  return <div>{renderBlocks(body)}</div>;
}

export function YouTubeEmbed({ video, title }: { video: YouTubeRef; title: string }) {
  return (
    <div
      className={`my-6 overflow-hidden rounded-2xl border border-ink-700 bg-black ${
        video.vertical ? "mx-auto max-w-xs aspect-[9/16]" : "aspect-video"
      }`}
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 블록                                                                 */
/* ------------------------------------------------------------------ */

const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const BULLET = /^[-*]\s+(.+)$/;
const ORDERED = /^\d+[.)]\s+(.+)$/;
const QUOTE = /^>\s?(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\((\S+?)\)$/;
const IMAGE_URL = /^(https?:\/\/|\/)\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i;

/** 문단을 끊고 새 블록을 시작하는 줄인지 */
function startsBlock(line: string) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    IMAGE.test(line) ||
    IMAGE_URL.test(line) ||
    parseYouTube(line) !== null
  );
}

function renderBlocks(body: string): ReactNode[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;

  /** 같은 종류의 줄이 이어지는 동안 모읍니다. */
  function collect(pattern: RegExp) {
    const items: string[] = [];
    for (; i < lines.length; i++) {
      const match = lines[i].trim().match(pattern);
      if (!match) break;
      items.push(match[1]);
    }
    return items;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    const key = `b${i}`;

    if (!line) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i].trim()); i++) code.push(lines[i]);
      i++; // 닫는 ``` — 없으면 글 끝까지가 코드입니다.
      out.push(
        <pre
          key={key}
          className="panel my-5 p-4 overflow-x-auto text-xs leading-relaxed font-mono text-ink-300"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      // 글 제목이 h1 이라 본문의 # · ## 는 h2, 그 아래는 h3 로 내립니다.
      out.push(
        heading[1].length <= 2 ? (
          <h2 key={key} className="text-xl sm:text-2xl font-black tracking-tight mt-10 mb-3">
            {inline(heading[2], key)}
          </h2>
        ) : (
          <h3 key={key} className="text-lg font-black tracking-tight mt-8 mb-2">
            {inline(heading[2], key)}
          </h3>
        ),
      );
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={key} className="my-8 border-ink-800" />);
      i++;
      continue;
    }

    const video = parseYouTube(line);
    if (video) {
      out.push(<YouTubeEmbed key={key} video={video} title="유튜브 영상" />);
      i++;
      continue;
    }

    const image = line.match(IMAGE);
    const imageSrc = safeImage(image ? image[2] : IMAGE_URL.test(line) ? line : "");
    if (imageSrc) {
      const alt = image?.[1] ?? "";
      out.push(
        <figure key={key} className="my-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={alt}
            loading="lazy"
            className="w-full rounded-xl border border-ink-800"
          />
          {alt && <figcaption className="text-xs text-ink-400 mt-2 text-center">{alt}</figcaption>}
        </figure>,
      );
      i++;
      continue;
    }

    if (BULLET.test(line)) {
      out.push(
        <ul key={key} className={`list-disc ${LIST}`}>
          {collect(BULLET).map((item, n) => (
            <li key={n}>{inline(item, `${key}-${n}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (ORDERED.test(line)) {
      out.push(
        <ol key={key} className={`list-decimal ${LIST}`}>
          {collect(ORDERED).map((item, n) => (
            <li key={n}>{inline(item, `${key}-${n}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (QUOTE.test(line)) {
      out.push(
        <blockquote
          key={key}
          className="my-5 border-l-2 border-neon-400/50 pl-4 text-ink-300 leading-relaxed"
        >
          {withBreaks(collect(QUOTE), key)}
        </blockquote>,
      );
      continue;
    }

    // 문단 — 다음 빈 줄이나 다른 블록이 나올 때까지
    const paragraph: string[] = [];
    for (; i < lines.length; i++) {
      const next = lines[i].trim();
      if (!next || (paragraph.length > 0 && startsBlock(next))) break;
      paragraph.push(next);
    }
    out.push(
      <p key={key} className="my-4 text-ink-300 leading-relaxed">
        {withBreaks(paragraph, key)}
      </p>,
    );
  }

  return out;
}

const LIST = "my-4 pl-5 space-y-1.5 text-ink-300 leading-relaxed marker:text-ink-600";

function withBreaks(lines: string[], key: string): ReactNode[] {
  return lines.flatMap((line, n) => [
    ...(n > 0 ? [<br key={`${key}-br${n}`} />] : []),
    ...inline(line, `${key}-l${n}`),
  ]);
}

/* ------------------------------------------------------------------ */
/* 글자                                                                 */
/* ------------------------------------------------------------------ */

// 순서대로: `코드` · **굵게** · [글자](주소) · 맨 주소 · *기울임*
// 링크 주소는 괄호 한 겹까지 받습니다 — 위키 주소처럼 (…) 가 들어간 주소가 중간에 잘리지 않게.
const INLINE =
  /(`[^`\n]+`)|(\*\*[^\n]+?\*\*)|(\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))+\))|(https?:\/\/[^\s<>"']+)|(\*[^*\s](?:[^*\n]*[^*\s])?\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;

    if (start > last) out.push(text.slice(last, start));
    last = start + token.length;

    if (match[1]) {
      out.push(
        <code
          key={key}
          className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.85em] font-mono text-ink-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      out.push(
        <strong key={key} className="font-bold text-ink-100">
          {inline(token.slice(2, -2), key)}
        </strong>,
      );
    } else if (match[3]) {
      const split = token.lastIndexOf("](");
      out.push(link(token.slice(split + 2, -1), inline(token.slice(1, split), key), key));
    } else if (match[4]) {
      // 문장 끝의 마침표 · 괄호가 주소에 딸려 들어가지 않게 떼어냅니다.
      const url = token.replace(/[.,!?;:)]+$/, "");
      out.push(link(url, url, key));
      if (url.length < token.length) out.push(token.slice(url.length));
    } else {
      out.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    }
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

function link(rawHref: string, label: ReactNode, key: string): ReactNode {
  const href = safeHref(rawHref);
  if (!href) return <span key={key}>{label}</span>;

  const external = !href.startsWith("/");
  return (
    <a
      key={key}
      href={href}
      className="text-neon-400 hover:underline break-words"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

/** 링크에 넣어도 되는 주소만 통과 — javascript: 같은 스킴을 걸러냅니다. */
function safeHref(url: string, protocols = ["http:", "https:", "mailto:"]): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return protocols.includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

function safeImage(url: string) {
  return url ? safeHref(url, ["http:", "https:"]) : null;
}
