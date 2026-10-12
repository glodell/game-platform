/**
 * 운영자 콘솔에서 올리는 게임 폴더에 관한 규칙.
 *
 * 브라우저(폴더 검사 · 업로드), 서버 액션(검증), 서빙 라우트(/g/u/…)가 함께 씁니다.
 * 세 곳에서 다 불러올 수 있도록 다른 모듈에 기대지 않습니다.
 *
 * 올린 게임은 파일 저장소에 <키>/<빌드>/<파일> 로 들어가고, 사이트에서는
 * /g/<저장소 표시>/<키>/<빌드>/<파일> 로 열립니다. 주소에 빌드 번호가 들어 있어서
 * 새 버전을 올려도 옛 주소의 내용은 바뀌지 않습니다 — 캐시를 오래 걸 수 있고,
 * 다 올라간 뒤에 게임의 경로만 바꾸므로 올리는 도중의 반쪽짜리 상태가 방문자에게 보이지 않습니다.
 *
 * 저장소는 두 가지입니다. 어디에 올렸는지가 주소에 남으므로, 저장소를 바꾼 뒤에도 전에
 * 올린 게임은 원래 자리에서 그대로 열립니다.
 *   blob     — Vercel Blob. 사이트와 같은 Vercel 의 전송량을 씁니다 (/g/b/…)
 *   supabase — Supabase Storage 의 games 버킷. Blob 을 연결하기 전의 기본값 (/g/u/…)
 */

export type GameStore = "blob" | "supabase";

export const GAME_BUCKET = "games";
const UPLOAD_PREFIXES: Record<GameStore, string> = { blob: "/g/b/", supabase: "/g/u/" };

const MB = 1024 * 1024;
export const MAX_FILES = 2000;

/** 저장소마다 받을 수 있는 크기가 다릅니다. Supabase 무료 요금제는 파일 하나가 50MB 까지입니다. */
export function uploadLimits(store: GameStore) {
  return store === "blob"
    ? { maxFileBytes: 200 * MB, maxTotalBytes: 600 * MB }
    : { maxFileBytes: 50 * MB, maxTotalBytes: 400 * MB };
}
/** 이보다 큰 파일은 방문자가 받는 데 오래 걸린다고 알려줍니다. */
const HEAVY_BYTES = 20 * MB;

/**
 * 썸네일 · 표지 이미지.
 *
 * 게임 빌드와 같은 저장소에, 같은 <키>/<빌드>/<파일> 모양으로 둡니다 (thumbs/<번호>/image.webp).
 * 그래서 업로드 허가 · 저장소 선택을 게임 폴더 업로드와 그대로 함께 씁니다.
 */
export const IMAGE_KEY = "thumbs";
export const IMAGE_MAX_BYTES = 5 * MB;
/** 받을 수 있는 이미지 종류 → 저장할 때 쓰는 확장자 */
export const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** 이미지 자리에 올릴 수 있는 파일 이름인지 (image.<확장자>) */
export function isImageFileName(name: string) {
  return Object.values(IMAGE_TYPES).some((ext) => name === `image.${ext}`);
}

const KEY = /^[a-z0-9][a-z0-9-]{0,47}$/;
const BUILD = /^[a-z0-9]{6,24}$/;
// 저장소가 받는 글자만 허용합니다. 한글 등 그 밖의 글자가 든 이름은 저장소가 거부합니다.
const SEGMENT = /^[\w!\-.*'() &$@=;:+,]+$/;

export function isGameKey(value: string) {
  return KEY.test(value);
}

export function isBuildId(value: string) {
  return BUILD.test(value);
}

/** 게임 폴더 안의 상대 경로로 써도 되는지 — "..", 빈 조각, 저장소가 못 받는 글자를 걸러냅니다. */
export function isSafeFilePath(path: string) {
  if (!path || path.length > 300) return false;
  return path.split("/").every((seg) => seg !== "." && seg !== ".." && SEGMENT.test(seg));
}

/** 폴더 이름에서 저장소 키를 만듭니다. 쓸 만한 이름이 안 나오면 "game". */
export function gameKeyFrom(name: string) {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  // dist 같은 빌드 폴더 이름과, 이미지가 쓰는 자리는 게임 키로 쓰지 않습니다.
  return KEY.test(key) && !BUILD_DIRS.includes(key) && key !== IMAGE_KEY ? key : "game";
}

export function uploadedEntryUrl(store: GameStore, key: string, build: string) {
  return `${UPLOAD_PREFIXES[store]}${key}/${build}/index.html`;
}

/** 게임 경로가 올린 게임(/g/b/… 또는 /g/u/…)이면 어느 저장소의 어떤 빌드인지 돌려줍니다. */
export function parseUploadedEntry(
  entryUrl: string | null | undefined,
): { store: GameStore; key: string; build: string } | null {
  const match = entryUrl?.match(/^\/g\/([bu])\/([^/]+)\/([^/]+)\/index\.html$/);
  return match && KEY.test(match[2]) && BUILD.test(match[3])
    ? { store: match[1] === "b" ? "blob" : "supabase", key: match[2], build: match[3] }
    : null;
}

/** 서빙 라우트가 받은 경로 조각(<키>/<빌드>/<파일…>)을 풀고 검사합니다. */
export function parseGamePath(segments: string[]) {
  let decoded: string[];
  try {
    // 경로 조각은 인코딩된 채로 올 수 있습니다 (이름에 공백 · 괄호가 든 파일).
    decoded = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const [key, build, ...rest] = decoded;
  const file = rest.join("/");
  return key && build && KEY.test(key) && BUILD.test(build) && isSafeFilePath(file)
    ? { key, build, file }
    : null;
}

/* ------------------------------------------------------------------ */
/* 파일 종류                                                            */
/* ------------------------------------------------------------------ */

const TEXT = "; charset=utf-8";
const TYPES: Record<string, string> = {
  html: `text/html${TEXT}`,
  htm: `text/html${TEXT}`,
  js: `text/javascript${TEXT}`,
  mjs: `text/javascript${TEXT}`,
  css: `text/css${TEXT}`,
  json: `application/json${TEXT}`,
  txt: `text/plain${TEXT}`,
  xml: `application/xml${TEXT}`,
  csv: `text/csv${TEXT}`,
  wasm: "application/wasm",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  ktx2: "image/ktx2",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const ENCODINGS: Record<string, string> = { br: "br", gz: "gzip" };

/**
 * 확장자로 Content-Type 을 정합니다. 모르는 확장자(.bin · .data · .pck 등)는 일반 바이너리입니다.
 *
 * Unity 처럼 미리 압축해 둔 파일(game.wasm.br)은 안쪽 확장자로 종류를 정하고, 브라우저가
 * 풀어 읽도록 압축 방식을 함께 돌려줍니다.
 */
export function contentTypeOf(path: string): { type: string; encoding: string | null } {
  const parts = path.toLowerCase().split("/").pop()!.split(".");
  let ext = parts.length > 1 ? parts.pop()! : "";
  let encoding: string | null = null;

  if (ENCODINGS[ext] && parts.length > 1) {
    encoding = ENCODINGS[ext];
    ext = parts.pop()!;
  }
  return { type: TYPES[ext] ?? "application/octet-stream", encoding };
}

/* ------------------------------------------------------------------ */
/* 폴더 검사 (브라우저)                                                   */
/* ------------------------------------------------------------------ */

/** 고른 파일 하나. path 는 고른 폴더부터의 경로입니다 (예: my-game/assets/ship.glb). */
export type PickedFile = { path: string; file: File };

export type GameFile = { path: string; file: File; type: string };

export type FolderAnalysis =
  | { ok: false; error: string }
  | {
      ok: true;
      /** 고른 폴더 이름 (화면 표시와 저장소 키에 씁니다) */
      name: string;
      files: GameFile[];
      totalBytes: number;
      /** 알아두면 되는 것 (dist 를 썼다, 시작 파일 이름을 바꿨다 등) */
      notes: string[];
      /** 올려도 안 뜰 수 있는 문제 */
      warnings: string[];
      hasSdk: boolean;
    };

const BUILD_DIRS = ["dist", "build", "out", "www"];
const SKIP_NAMES = new Set(["node_modules", "Thumbs.db", "desktop.ini"]);

/** 게임에 필요 없는 파일 — 점으로 시작하는 것(.git · .DS_Store), node_modules, 소스맵 */
export function isJunkPath(path: string) {
  return (
    path.endsWith(".map") ||
    path.split("/").some((seg) => seg.startsWith(".") || SKIP_NAMES.has(seg))
  );
}

export function formatBytes(bytes: number) {
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** 폴더 맨 위의 시작 파일 — index.html, 없으면 하나뿐인 html (Godot 내보내기 등). */
function entryOf(files: PickedFile[]) {
  const htmls = files.filter((f) => !f.path.includes("/") && /\.html?$/i.test(f.path));
  return htmls.find((f) => f.path === "index.html") ?? (htmls.length === 1 ? htmls[0] : null);
}

/** 번들러가 빌드해야 돌아가는 html 인지 — 소스 파일(/src/…, .ts, .tsx, .jsx)을 직접 가리킵니다. */
function needsBuild(html: string) {
  return /<script[^>]+src\s*=\s*["'](?:\.?\/)?src\/|<script[^>]+src\s*=\s*["'][^"']+\.(?:tsx?|jsx)["']/i.test(
    html,
  );
}

function under(files: PickedFile[], dir: string) {
  return files
    .filter((f) => f.path.startsWith(`${dir}/`))
    .map((f) => ({ ...f, path: f.path.slice(dir.length + 1) }));
}

function sample(paths: string[]) {
  const shown = paths.slice(0, 5).join(", ");
  return paths.length > 5 ? `${shown} 외 ${paths.length - 5}개` : shown;
}

/**
 * 고른 폴더를 올릴 수 있는 모양으로 정리하고, 안 뜨는 흔한 원인을 미리 찾습니다.
 *
 *   1) 잡파일을 빼고, 실제로 띄울 뿌리(html 이 있는 곳)를 찾습니다. 빌드가 필요한 프로젝트를
 *      통째로 골랐으면 그 안의 dist · build 를 씁니다.
 *   2) 저장소가 못 받는 이름 · 너무 큰 파일은 여기서 막습니다 (올리다 중간에 실패하지 않게).
 *   3) / 로 시작하는 경로처럼 "올라가긴 하지만 안 뜨는" 문제는 경고로 알려줍니다.
 */
export async function analyzeGameFolder(
  picked: PickedFile[],
  limits = uploadLimits("supabase"),
): Promise<FolderAnalysis> {
  let files = picked
    .map((p) => ({ path: p.path.replace(/\\/g, "/").replace(/^\/+/, ""), file: p.file }))
    .filter((f) => f.path && !isJunkPath(f.path));

  if (files.length === 0) return { ok: false, error: "폴더에 올릴 파일이 없습니다." };

  // 폴더째 고르면 모든 경로가 "폴더이름/…" 으로 시작합니다. 그 한 겹을 벗깁니다.
  let name = "game";
  const top = files[0].path.split("/")[0];
  if (files.every((f) => f.path.startsWith(`${top}/`))) {
    name = top;
    files = under(files, top);
  }

  const notes: string[] = [];
  let entry = entryOf(files);

  if (!entry || needsBuild(await entry.file.text())) {
    const built = BUILD_DIRS.map((dir) => ({ dir, files: under(files, dir) })).find((candidate) =>
      entryOf(candidate.files),
    );
    if (!built) {
      return {
        ok: false,
        error:
          entry || files.some((f) => f.path === "package.json")
            ? "빌드가 필요한 프로젝트인데 빌드 결과가 없습니다. 그 폴더에서 npm install, npm run build 를 실행한 뒤 생기는 dist 폴더를 올려주세요. (Vite 라면 vite.config 에 base: './' 를 넣고 빌드해야 파일 경로가 맞습니다.)"
            : "시작할 html 파일을 찾지 못했습니다. index.html 이 들어 있는 폴더를 골라주세요.",
      };
    }
    files = built.files;
    entry = entryOf(files)!;
    notes.push(`빌드 결과 폴더(${built.dir}/)를 사용합니다.`);
  }

  // 시작 파일 이름을 index.html 로 맞춥니다 — 게임 경로가 늘 같은 모양이 되게.
  if (entry.path !== "index.html") {
    notes.push(`시작 파일 ${entry.path} 을 index.html 로 올립니다.`);
    const renamed = { ...entry, path: "index.html" };
    files = files.map((f) => (f === entry ? renamed : f));
    entry = renamed;
  }

  const badNames = files.filter((f) => !isSafeFilePath(f.path)).map((f) => f.path);
  if (badNames.length > 0) {
    return {
      ok: false,
      error: `파일 · 폴더 이름에 한글이나 일부 특수문자가 있으면 올릴 수 없습니다. 영문 · 숫자로 바꾼 뒤 다시 골라주세요: ${sample(badNames)}`,
    };
  }

  const tooBig = files.filter((f) => f.file.size > limits.maxFileBytes);
  if (tooBig.length > 0) {
    return {
      ok: false,
      error: `파일 하나는 ${formatBytes(limits.maxFileBytes)} 까지 올릴 수 있습니다. 용량을 줄여주세요: ${sample(
        tooBig.map((f) => `${f.path} (${formatBytes(f.file.size)})`),
      )}`,
    };
  }

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  if (files.length > MAX_FILES) {
    return { ok: false, error: `파일이 너무 많습니다 (${files.length}개, 최대 ${MAX_FILES}개).` };
  }
  if (totalBytes > limits.maxTotalBytes) {
    return {
      ok: false,
      error: `전체 용량이 너무 큽니다 (${formatBytes(totalBytes)}, 최대 ${formatBytes(limits.maxTotalBytes)}).`,
    };
  }

  const warnings: string[] = [];
  const html = await entry.file.text();

  // 사이트 뿌리 기준 경로(/assets/…)는 게임 폴더 아래에서 찾지 못합니다. SDK 만 예외입니다.
  const absolute = [...html.matchAll(/(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*)["']/gi)]
    .map((match) => match[1])
    .filter((url) => url !== "/sdk/arcade.js");
  if (absolute.length > 0) {
    warnings.push(
      `index.html 이 / 로 시작하는 경로를 씁니다 (${sample([...new Set(absolute)])}). 이 사이트에서는 그 파일을 찾지 못해 게임이 안 뜹니다. 상대 경로(./…)로 바꿔야 하고, Vite 라면 vite.config 에 base: './' 를 넣고 다시 빌드하면 됩니다.`,
    );
  }

  const absoluteInCode: string[] = [];
  for (const f of files) {
    if (!/\.(m?js|css)$/.test(f.path) || f.file.size > 5 * MB) continue;
    if (/["'`(]\/assets\//.test(await f.file.text())) absoluteInCode.push(f.path);
  }
  if (absoluteInCode.length > 0) {
    warnings.push(
      `코드 안에 /assets/… 로 시작하는 경로가 있습니다 (${sample(absoluteInCode)}). 모델 · 그림이 안 불러와질 수 있습니다. 위와 같은 원인입니다.`,
    );
  }

  const heavy = files.filter((f) => f.file.size > HEAVY_BYTES);
  if (heavy.length > 0) {
    warnings.push(
      `큰 파일이 있어 방문자가 받는 데 오래 걸릴 수 있습니다: ${sample(
        heavy.map((f) => `${f.path} (${formatBytes(f.file.size)})`),
      )}`,
    );
  }

  return {
    ok: true,
    name,
    files: files.map((f) => ({ ...f, type: contentTypeOf(f.path).type })),
    totalBytes,
    notes,
    warnings,
    hasSdk: html.includes("sdk/arcade.js"),
  };
}
