/** 유튜브 영상 하나. 쇼츠는 세로 영상이라 플레이어 비율을 다르게 잡아야 해서 따로 표시합니다. */
export type YouTubeRef = { id: string; vertical: boolean };

/**
 * 유튜브 주소에서 영상 ID 를 뽑습니다. 유튜브 주소가 아니면 null.
 *
 * 받는 형태: youtu.be/ID · youtube.com/watch?v=ID · /shorts/ID · /embed/ID · /live/ID
 */
export function parseYouTube(raw: string | null | undefined): YouTubeRef | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;
  let vertical = false;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts") {
      id = second ?? null;
      vertical = true;
    } else if (first === "embed" || first === "live") id = second ?? null;
  }

  return id && /^[\w-]{6,20}$/.test(id) ? { id, vertical } : null;
}

/** 표지를 따로 정하지 않은 노트에 쓰는 영상 썸네일. */
export function youTubeThumbnail(video: YouTubeRef) {
  return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}
