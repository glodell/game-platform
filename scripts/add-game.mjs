#!/usr/bin/env node
/**
 * 다른 도구에서 만든 게임 폴더를 이 사이트에 넣습니다.
 *
 *   node scripts/add-game.mjs "<게임 폴더>" [슬러그] [--replace] [--deploy]
 *
 * 하는 일
 *   1) 폴더에서 실제로 띄울 뿌리(html 이 있는 곳)를 찾습니다. 빌드가 필요한 프로젝트면
 *      dist · build 같은 빌드 결과 폴더를 씁니다.
 *   2) public/g/<슬러그>/ 로 복사합니다. node_modules · .git · 소스맵은 뺍니다.
 *   3) 올렸을 때 안 뜨는 흔한 원인(절대 경로, 너무 큰 파일)을 미리 검사합니다.
 *   4) --deploy 를 붙이면 그 폴더만 커밋해서 올립니다(배포). 작업 중인 다른 파일은 건드리지 않습니다.
 *
 *   --replace  이미 있는 게임을 새 버전으로 바꿉니다.
 *   --deploy   넣은 뒤 바로 커밋 · 푸시합니다.
 *
 * 사이트에 나오게 하려면 배포된 뒤 운영자 콘솔에서 게임으로 등록하세요 (처음 한 번만).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = path.join(PROJECT, "public", "g");

const BUILD_DIRS = ["dist", "build", "out", "www"];
const SKIP_NAMES = new Set(["node_modules", "Thumbs.db", "desktop.ini"]);
const MB = 1024 * 1024;
const WARN_BYTES = 50 * MB; // GitHub 이 경고하는 크기
const MAX_BYTES = 100 * MB; // GitHub 이 받지 않는 크기

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function size(bytes) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/* ------------------------------------------------------------------ */
/* 인자                                                                 */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);

// 옵션은 --replace · --deploy 로 줍니다. 폴더 뒤에 대시 없이 replace · deploy 라고 적어도 받습니다.
//
// Windows PowerShell 에서 "npm run add-game -- … --replace" 로 부르면 PowerShell 이 "--" 를
// 삼키고, npm 이 뒤의 --옵션을 자기 설정으로 가져가서 스크립트까지 오지 않습니다(확인함: npm 은
// "--replace --deploy" 를 replace-registry-host=--deploy 로 해석합니다). 대시 없는 단어는 그대로
// 전달되므로 그 길을 열어 둡니다. node scripts/add-game.mjs 로 직접 부르면 이런 문제가 없습니다.
const OPTIONS = ["replace", "deploy"];
const isOption = (arg, index) =>
  OPTIONS.some((name) => arg === `--${name}` || (index > 0 && arg === name));
const option = (name) => args.some((arg, index) => isOption(arg, index) && arg.endsWith(name));

const replace = option("replace");
const deploy = option("deploy");
const viaNpm = Boolean(process.env.npm_lifecycle_event);
const [sourceArg, slugArg] = args.filter((arg, index) => !arg.startsWith("--") && !isOption(arg, index));

if (!sourceArg || args.includes("--help")) {
  console.log(
    '사용법: node scripts/add-game.mjs "<게임 폴더>" [슬러그] [--replace] [--deploy]\n\n' +
      "  --replace  이미 있는 게임을 새 버전으로 바꿉니다\n" +
      "  --deploy   넣은 뒤 바로 커밋 · 푸시해서 배포합니다",
  );
  process.exit(sourceArg ? 0 : 1);
}

const source = path.resolve(sourceArg);
if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  fail(`폴더를 찾을 수 없습니다: ${source}`);
}

/* ------------------------------------------------------------------ */
/* 1. 띄울 뿌리 찾기                                                     */
/* ------------------------------------------------------------------ */

/** 폴더에서 시작 html 을 고릅니다 — index.html, 없으면 하나뿐인 html (Godot 내보내기 등). */
function entryOf(dir) {
  if (fs.existsSync(path.join(dir, "index.html"))) return "index.html";
  const htmls = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".html"));
  return htmls.length === 1 ? htmls[0] : null;
}

/** 번들러가 빌드해야 돌아가는 html 인지 — 소스 파일(/src/…, .ts, .tsx, .jsx)을 직접 가리킵니다. */
function needsBuild(dir, entry) {
  const html = fs.readFileSync(path.join(dir, entry), "utf8");
  return /<script[^>]+src\s*=\s*["'](?:\.?\/)?src\/|<script[^>]+src\s*=\s*["'][^"']+\.(?:tsx?|jsx)["']/i.test(
    html,
  );
}

function findRoot() {
  const entry = entryOf(source);
  if (entry && !needsBuild(source, entry)) return { dir: source, entry, built: null };

  for (const name of BUILD_DIRS) {
    const dir = path.join(source, name);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const builtEntry = entryOf(dir);
    if (builtEntry) return { dir, entry: builtEntry, built: name };
  }

  if (entry || fs.existsSync(path.join(source, "package.json"))) {
    fail(
      "빌드가 필요한 프로젝트인데 빌드 결과가 없습니다.\n" +
        "  그 폴더에서 아래를 실행한 뒤 다시 시도하세요.\n\n" +
        "    npm install\n    npm run build\n\n" +
        "  Vite 프로젝트라면 vite.config 에 base: './' 를 넣고 빌드해야 파일 경로가 맞습니다.",
    );
  }
  fail(`시작할 html 파일을 찾지 못했습니다: ${source}`);
}

const root = findRoot();

/* ------------------------------------------------------------------ */
/* 2. 슬러그 · 대상 폴더                                                 */
/* ------------------------------------------------------------------ */

const slug = (slugArg ?? path.basename(source))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

if (!slug) {
  fail(
    "주소로 쓸 이름을 정하지 못했습니다. 영문 · 숫자로 직접 적어주세요.\n" +
      '  예: npm run add-game -- "<게임 폴더>" space-runner',
  );
}

// /g/u/… 는 운영자 콘솔에서 올린 게임이 쓰는 주소입니다. 같은 이름의 폴더가 생기면 겹칩니다.
if (slug === "u") {
  fail('"u" 는 웹에서 올린 게임이 쓰는 주소라 쓸 수 없습니다. 다른 이름을 주세요.');
}

const target = path.join(GAMES_DIR, slug);
const existed = fs.existsSync(target);

// --replace 는 대상 폴더를 먼저 지웁니다. 원본이 그 안에 있으면 원본째 사라지므로 막습니다.
if (`${root.dir}${path.sep}`.startsWith(`${target}${path.sep}`)) {
  fail(`원본 폴더가 넣을 자리(public/g/${slug}) 안에 있습니다. 다른 위치의 폴더를 지정하세요.`);
}

if (fs.existsSync(target) && !replace) {
  fail(
    `이미 있는 게임입니다: public/g/${slug}\n` +
      "  새 버전으로 바꾸려면 끝에 --replace 를 붙이고, 다른 게임이면 슬러그를 다르게 주세요." +
      (viaNpm
        ? "\n\n  --replace 를 붙였는데도 이 메시지가 나왔다면: PowerShell 에서는 npm run 이 --옵션을\n" +
          "  전달하지 못합니다. 아래처럼 node 로 직접 실행하세요.\n\n" +
          `    node scripts/add-game.mjs "${sourceArg}" ${slug} --replace`
        : ""),
  );
}

/* ------------------------------------------------------------------ */
/* 3. 복사할 파일 모으기                                                  */
/* ------------------------------------------------------------------ */

/** @returns {{ rel: string, abs: string, bytes: number }[]} */
function collect(dir, base = "") {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    // 점으로 시작하는 것(.git · .vite · .DS_Store 등)과 바로가기는 게임에 필요 없습니다.
    if (item.name.startsWith(".") || SKIP_NAMES.has(item.name) || item.isSymbolicLink()) continue;

    const abs = path.join(dir, item.name);
    const rel = base ? `${base}/${item.name}` : item.name;
    if (item.isDirectory()) files.push(...collect(abs, rel));
    else if (item.isFile() && !item.name.endsWith(".map")) {
      files.push({ rel, abs, bytes: fs.statSync(abs).size });
    }
  }
  return files;
}

const files = collect(root.dir);
const total = files.reduce((sum, file) => sum + file.bytes, 0);

const tooBig = files.filter((file) => file.bytes > MAX_BYTES);
if (tooBig.length > 0) {
  fail(
    "100MB 를 넘는 파일은 GitHub 이 받지 않아 올릴 수 없습니다. 용량을 줄여주세요.\n" +
      tooBig.map((file) => `  - ${file.rel} (${size(file.bytes)})`).join("\n"),
  );
}

/* ------------------------------------------------------------------ */
/* 4. 복사                                                              */
/* ------------------------------------------------------------------ */

if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });

for (const file of files) {
  // 시작 파일 이름이 index.html 이 아니면 index.html 로 맞춥니다 — 경로가 늘 같은 모양이 되게.
  const rel = file.rel === root.entry ? "index.html" : file.rel;
  const dest = path.join(target, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file.abs, dest);
}

/* ------------------------------------------------------------------ */
/* 5. 검사                                                              */
/* ------------------------------------------------------------------ */

const warnings = []; // 알아둘 것
const blocking = []; // 올려도 게임이 뜨지 않는 문제
const html = fs.readFileSync(path.join(target, "index.html"), "utf8");

// 사이트 뿌리 기준 경로(/assets/…)는 /g/<슬러그>/ 아래에서 찾지 못합니다. SDK 만 예외입니다.
const absolute = [...html.matchAll(/(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*)["']/gi)]
  .map((match) => match[1])
  .filter((url) => url !== "/sdk/arcade.js");
if (absolute.length > 0) {
  blocking.push(
    "index.html 이 / 로 시작하는 경로를 씁니다. 이 사이트에서는 그 파일을 찾지 못해 게임이 안 뜹니다.\n" +
      [...new Set(absolute)].slice(0, 5).map((url) => `      ${url}`).join("\n") +
      "\n    → 상대 경로(./…)로 바꿔야 합니다. Vite 라면 vite.config 에 base: './' 를 넣고 다시 빌드하세요.",
  );
}

const scripts = files.filter((file) => /\.(m?js|css)$/.test(file.rel) && file.bytes < 20 * MB);
const absoluteInCode = scripts.filter((file) =>
  /["'`(]\/assets\//.test(fs.readFileSync(file.abs, "utf8")),
);
if (absoluteInCode.length > 0) {
  blocking.push(
    "코드 안에 /assets/… 로 시작하는 경로가 있습니다. 모델 · 그림이 안 불러와질 수 있습니다.\n" +
      absoluteInCode.slice(0, 5).map((file) => `      ${file.rel}`).join("\n") +
      "\n    → 위와 같은 원인입니다 (Vite 의 base 설정).",
  );
}

const heavy = files.filter((file) => file.bytes > WARN_BYTES);
if (heavy.length > 0) {
  warnings.push(
    "50MB 를 넘는 파일이 있습니다. 올라가기는 하지만 방문자가 받는 데 오래 걸립니다.\n" +
      heavy.map((file) => `      ${file.rel} (${size(file.bytes)})`).join("\n"),
  );
}

const hasSdk = html.includes("sdk/arcade.js");

/* ------------------------------------------------------------------ */
/* 6. 결과                                                              */
/* ------------------------------------------------------------------ */

console.log(`\n✔ public/g/${slug}/ 에 넣었습니다 — 파일 ${files.length}개, ${size(total)}`);
if (root.built) console.log(`  빌드 결과 폴더(${root.built}/)를 사용했습니다.`);
if (root.entry !== "index.html") console.log(`  시작 파일 ${root.entry} 을 index.html 로 복사했습니다.`);

for (const warning of [...blocking, ...warnings]) console.log(`\n⚠ ${warning}`);

if (!hasSdk) {
  console.log(
    "\nℹ 이 게임은 사이트 SDK 를 쓰지 않아 랭킹 없이 체험만 됩니다.\n" +
      '  점수를 올리려면 index.html 에 <script src="/sdk/arcade.js"></script> 를 넣고,\n' +
      "  판이 시작될 때 Arcade.start(), 끝날 때 Arcade.gameOver(점수) 를 부르면 됩니다.",
  );
}

/* ------------------------------------------------------------------ */
/* 7. 배포 (--deploy)                                                   */
/* ------------------------------------------------------------------ */

const folder = `public/g/${slug}`;
const register =
  '운영자 콘솔 → 게임 등록 화면에 "아직 등록하지 않은 게임 폴더"로 뜹니다.\n' +
  `     게임 경로에  /g/${slug}/index.html  을 넣고 이름을 적어 등록하세요 (처음 한 번만).`;

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: PROJECT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

if (!deploy) {
  console.log(
    "\n다음 순서\n" +
      `  1) 로컬에서 확인:  npm run dev  →  http://localhost:3000/g/${slug}/index.html\n` +
      "  2) 배포:  아래 명령을 실행\n\n" +
      `       node scripts/add-game.mjs "${sourceArg}" ${slug} --replace --deploy\n\n` +
      `  3) ${register}\n`,
  );
} else if (blocking.length > 0) {
  // 안 뜨는 게임을 올려 봐야 소용이 없으니, 파일만 넣어 두고 배포는 하지 않습니다.
  fail(
    "위 문제 때문에 올려도 게임이 뜨지 않습니다. 배포하지 않았습니다.\n" +
      "  게임 쪽을 고친 뒤 같은 명령(--replace --deploy)으로 다시 실행하세요.",
  );
} else {
  let committed = false;
  try {
    git("add", "--all", "--", folder);
    if (!git("status", "--porcelain", "--", folder)) {
      console.log("\n✔ 이미 같은 내용이 올라가 있어 새로 배포할 것이 없습니다.\n");
    } else {
      // 경로를 지정해 커밋하므로, 작업 중인 다른 파일은 이 커밋에 섞이지 않습니다.
      git("commit", "--quiet", "-m", `게임 ${existed ? "갱신" : "추가"}: ${slug}`, "--", folder);
      committed = true;
      git("push", "--quiet");
      console.log(
        `\n✔ 커밋하고 올렸습니다 (${git("rev-parse", "--abbrev-ref", "HEAD")}). 1~2분 뒤 사이트에 반영됩니다.\n\n` +
          (existed
            ? "이미 등록된 게임이면 더 할 일이 없습니다 — 같은 주소에 새 버전이 뜹니다.\n"
            : `다음 순서\n  1) ${register}\n`),
      );
    }
  } catch (cause) {
    const detail = String(cause?.stderr || cause?.message || cause).trim();
    fail(
      (committed
        ? "커밋은 됐지만 올리지(push) 못했습니다. 인터넷 연결을 확인하고 git pull 뒤에 git push 를 실행하세요."
        : "배포하지 못했습니다.") + (detail ? `\n  ${detail.split("\n").join("\n  ")}` : ""),
    );
  }
}
