// Viberhood(바이버후드) 브랜드 애셋 생성기.
// SVG 를 코드로 그린 뒤 sharp 로 PNG 까지 내보냅니다. 색이나 문구를 바꾸고 다시 돌리면 전부 재생성됩니다.
//   node scripts/brand/build-brand.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "public", "brand");
mkdirSync(OUT, { recursive: true });

/* ─────────────────────────── 팔레트 ─────────────────────────── */

const RAINBOW = ["#FF3D6E", "#FF8A3D", "#FFD93D", "#3DE68A", "#35D6FF", "#5B7CFF", "#B45CFF"];
const INK = { 950: "#07080F", 900: "#0C0E1A", 800: "#171B31", 300: "#A6ADCD", 100: "#E7E9F7" };
const BODY = "#151A34"; // 게임기 본체
const SCREEN_DARK = "#080A15"; // 스크린 베젤 / 화면 속 V

const KO_FONT = "Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif";

const stops = (colors = RAINBOW) =>
  colors
    .map((c, i) => `<stop offset="${((i / (colors.length - 1)) * 100).toFixed(2)}%" stop-color="${c}"/>`)
    .join("");

const linear = (id, x1, y1, x2, y2, colors = RAINBOW) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops(
    colors
  )}</linearGradient>`;

/* ───────────────── 마크: 레인보우 스크린을 가진 휴대용 게임기 ───────────────── */
// 기기 자체는 400 x 240 크기, 중심 (256, 256) 인 좌표계에서 그립니다.

const DEVICE_W = 400;
const DEVICE_H = 240;

function markDefs(p) {
  return `
    ${linear(`${p}-screen`, 158, 205, 342, 307)}
    ${linear(`${p}-rim`, 60, 136, 452, 376)}
    <linearGradient id="${p}-gloss" x1="170" y1="180" x2="300" y2="330" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="52%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="${p}-blur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>`;
}

function markInner(p, { glow = true } = {}) {
  const halo = glow
    ? `<g filter="url(#${p}-blur)" opacity="0.75">
         <rect x="61" y="141" width="390" height="230" rx="62" fill="none" stroke="url(#${p}-rim)" stroke-width="18"/>
         <rect x="160" y="176" width="180" height="160" rx="26" fill="url(#${p}-screen)"/>
       </g>`
    : "";
  return `${halo}
    <rect x="56" y="136" width="400" height="240" rx="66" fill="${BODY}"/>
    <rect x="61" y="141" width="390" height="230" rx="61" fill="none" stroke="url(#${p}-rim)" stroke-width="10"/>
    <rect x="150" y="166" width="200" height="180" rx="34" fill="${SCREEN_DARK}"/>
    <rect x="160" y="176" width="180" height="160" rx="26" fill="url(#${p}-screen)"/>
    <rect x="160" y="176" width="180" height="160" rx="26" fill="url(#${p}-gloss)"/>
    <path d="M208 210 L250 300 L292 210" fill="none" stroke="${SCREEN_DARK}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="${INK[100]}">
      <rect x="75" y="244" width="72" height="24" rx="10"/>
      <rect x="99" y="220" width="24" height="72" rx="10"/>
    </g>
    <circle cx="373" cy="288" r="20" fill="#FF3D6E"/>
    <circle cx="417" cy="224" r="20" fill="#35D6FF"/>
    <g fill="#2B3159">
      <rect x="196" y="352" width="30" height="10" rx="5"/>
      <rect x="240" y="352" width="30" height="10" rx="5"/>
    </g>`;
}

// 기기 너비를 기준으로 배치합니다. (cx, cy) 는 기기의 중심.
function mark(p, { cx, cy, width, rotate = 0, glow = true }) {
  const s = width / DEVICE_W;
  return `<g transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${s}) translate(-256 -256)">${markInner(p, {
    glow,
  })}</g>`;
}

const markHeight = (width) => (width / DEVICE_W) * DEVICE_H;

/* ───────────── 워드마크: 폰트 없이 패스로 그린 라운드 지오메트릭 ───────────── */
// cap height 100, 획 두께 26. 어떤 환경에서도 동일하게 렌더됩니다.

const SW = 26;
const GAP = 18;
const LETTERS = {
  V: { w: 66, d: ["M13 0 L33 100 L53 0"] },
  I: { w: 26, d: ["M13 0 L13 100"] },
  B: { w: 72, d: ["M13 0 L13 100", "M13 0 H32 A25 25 0 0 1 32 50 H13", "M13 50 H34 A25 25 0 0 1 34 100 H13"] },
  E: { w: 65, d: ["M13 0 V100", "M13 0 H52", "M13 50 H44", "M13 100 H52"] },
  R: { w: 70, d: ["M13 0 V100", "M13 0 H32 A25 25 0 0 1 32 50 H13", "M32 50 L56 100"] },
  H: { w: 76, d: ["M13 0 V100", "M63 0 V100", "M13 50 H63"] },
  O: { w: 90, d: ["M45 0 A32 50 0 0 1 45 100 A32 50 0 0 1 45 0"] },
  D: { w: 81, d: ["M13 0 V100", "M13 0 H30 A38 50 0 0 1 30 100 H13"] },
};

const WORD = "VIBERHOOD";
const WORD_H = 100 + SW; // 126
const WORD_W = [...WORD].reduce((a, ch, i) => a + LETTERS[ch].w + (i ? GAP : 0), 0);

const wordmarkWidth = (height) => (WORD_W * height) / WORD_H;

function wordmark({ x = 0, y = 0, height, stroke = INK[100] }) {
  const s = height / WORD_H;
  let cursor = 0;
  const glyphs = [...WORD]
    .map((ch) => {
      const L = LETTERS[ch];
      const g = `<g transform="translate(${cursor} 0)">${L.d.map((d) => `<path d="${d}"/>`).join("")}</g>`;
      cursor += L.w + GAP;
      return g;
    })
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(0 ${SW / 2})" fill="none" stroke="${stroke}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${glyphs}</g>`;
}

/* ─────────────────────────── 문서 조립 ─────────────────────────── */

const svgDoc = (w, h, defs, body, bg = null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
<defs>${defs}</defs>
${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}
${body}
</svg>`;

// 1) 마크 단독 (정사각, 배경 투명) — 기기를 살짝 기울여 정사각 화면을 채웁니다.
function markOnlySvg({ size = 512, bg = null, rotate = -9, pad = 0.1 } = {}) {
  const rad = (Math.abs(rotate) * Math.PI) / 180;
  const bw = DEVICE_W * Math.cos(rad) + DEVICE_H * Math.sin(rad);
  const width = ((size * (1 - pad * 2)) / bw) * DEVICE_W;
  return svgDoc(size, size, markDefs("m"), mark("m", { cx: size / 2, cy: size / 2, width, rotate }), bg);
}

// 1-b) 컴팩트 마크 — 정사각 여백 없이 기기에 딱 맞춘 수평 버전 (헤더용)
function markCompactSvg({ pad = 34 } = {}) {
  const w = DEVICE_W + pad * 2;
  const h = DEVICE_H + pad * 2;
  return svgDoc(w, h, markDefs("c"), mark("c", { cx: w / 2, cy: h / 2, width: DEVICE_W }));
}

// 2) 가로 로고 (마크 + 워드마크)
function lockupSvg({ wordColor = INK[100], rainbowWord = false, bg = null } = {}) {
  const mw = 300;
  const mh = markHeight(mw); // 180
  const wh = 132;
  const ww = wordmarkWidth(wh);
  const gap = 34;
  const padX = 26;
  const padY = 26; // 글로우 여유
  const w = Math.round(padX * 2 + mw + gap + ww);
  const h = Math.round(padY * 2 + mh);
  const wx = padX + mw + gap;
  const defs = markDefs("l") + (rainbowWord ? linear("l-word", wx, 0, wx + ww, h) : "");
  const body = `${mark("l", { cx: padX + mw / 2, cy: h / 2, width: mw })}
${wordmark({ x: wx, y: (h - wh) / 2, height: wh, stroke: rainbowWord ? "url(#l-word)" : wordColor })}`;
  return svgDoc(w, h, defs, body, bg);
}

// 3) 세로 로고
function stackedSvg({ wordColor = INK[100], bg = null } = {}) {
  const mw = 400;
  const mh = markHeight(mw);
  const wh = 104;
  const ww = wordmarkWidth(wh);
  const w = Math.round(Math.max(mw, ww) + 60);
  const h = Math.round(mh + 46 + wh + 52);
  const body = `${mark("s", { cx: w / 2, cy: 26 + mh / 2, width: mw })}
${wordmark({ x: (w - ww) / 2, y: 26 + mh + 46, height: wh, stroke: wordColor })}`;
  return svgDoc(w, h, markDefs("s"), body, bg);
}

// 4) 프로필/앱 아이콘 (정사각 다크 배경 + 레인보우 링)
function avatarSvg({ size = 800 } = {}) {
  const r = size * 0.24;
  const defs =
    markDefs("a") +
    linear("a-ring", 0, 0, size, size) +
    `<radialGradient id="a-bg" cx="50%" cy="30%" r="80%">
       <stop offset="0%" stop-color="#141935"/>
       <stop offset="100%" stop-color="${INK[950]}"/>
     </radialGradient>`;
  const inset = size * 0.02;
  const body = `<rect width="${size}" height="${size}" rx="${r}" fill="url(#a-bg)"/>
<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${
    r - inset
  }" fill="none" stroke="url(#a-ring)" stroke-width="${size * 0.028}" opacity="0.9"/>
${mark("a", { cx: size / 2, cy: size / 2, width: size * 0.7, rotate: -9 })}`;
  return svgDoc(size, size, defs, body);
}

/* ─────────────────── 유튜브 채널아트 (2560 x 1440) ─────────────────── */
// 안전 영역(모든 기기 공통): 가운데 1546 x 423

const BW = 2560;
const BH = 1440;
const SAFE = { x: (BW - 1546) / 2, y: (BH - 423) / 2, w: 1546, h: 423 };

// 폰트 메트릭이 없으므로 글자폭을 어림잡습니다. (칩 크기 계산용)
function textWidth(s, fs) {
  let u = 0;
  for (const ch of s) {
    if (/[가-힣]/.test(ch)) u += 1.0;
    else if (ch === " ") u += 0.32;
    else if (/[0-9]/.test(ch)) u += 0.56;
    else if (/[A-Z]/.test(ch)) u += 0.66;
    else if (/[a-z]/.test(ch)) u += 0.55;
    else u += 0.45;
  }
  return u * fs;
}

function bannerSvg({ guides = false } = {}) {
  const tagline = "바이브코딩으로 노는 이웃들";
  const chips = [
    { label: "AI로 만든 게임", color: RAINBOW[0] },
    { label: "구독자 랭킹 대결", color: RAINBOW[2] },
    { label: "해커톤", color: RAINBOW[3] },
    { label: "매주 신작", color: RAINBOW[4] },
  ];

  // 로고 락업
  const mw = 300;
  const mh = markHeight(mw);
  const wh = 142;
  const ww = wordmarkWidth(wh);
  const gap = 38;
  const lockW = mw + gap + ww;
  const lockX = BW / 2 - lockW / 2;
  const lockCy = 615;

  // 칩 배치
  const chipH = 60;
  const chipPad = 30;
  const chipGap = 20;
  const chipFs = 30;
  const sized = chips.map((c) => ({ ...c, w: Math.round(textWidth(c.label, chipFs) + chipPad * 2) }));
  const chipsW = sized.reduce((a, c, i) => a + c.w + (i ? chipGap : 0), 0);
  let cx = BW / 2 - chipsW / 2;
  const chipY = 852;
  const chipSvg = sized
    .map((c) => {
      const g = `<g>
        <rect x="${cx}" y="${chipY}" width="${c.w}" height="${chipH}" rx="${chipH / 2}" fill="${c.color}" fill-opacity="0.12" stroke="${c.color}" stroke-opacity="0.55" stroke-width="2"/>
        <text x="${cx + c.w / 2}" y="${chipY + chipH / 2 + 11}" text-anchor="middle" font-family="${KO_FONT}" font-size="${chipFs}" font-weight="700" fill="${c.color}">${c.label}</text>
      </g>`;
      cx += c.w + chipGap;
      return g;
    })
    .join("");

  // 배경 장식: 안전 영역 밖에 떠 있는 픽셀 블록들
  const blocks = [
    [180, 250, 96, -14, 0], [330, 980, 132, 12, 1], [90, 700, 64, 22, 4],
    [470, 190, 56, 8, 2], [250, 1180, 74, -20, 5], [560, 1230, 46, 16, 6],
    [2380, 300, 110, 14, 6], [2180, 1120, 128, -12, 4], [2460, 830, 68, 24, 0],
    [2050, 200, 58, -8, 2], [2300, 1290, 80, 18, 3], [1980, 1300, 50, -16, 5],
    [700, 120, 44, 10, 3], [1850, 110, 52, -18, 1], [1300, 1330, 60, 12, 2],
  ]
    .map(([x, y, s, rot, ci]) => {
      const c = RAINBOW[ci];
      return `<g transform="translate(${x} ${y}) rotate(${rot})" opacity="0.5">
        <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.28}" fill="none" stroke="${c}" stroke-width="${Math.max(3, s * 0.09)}"/>
      </g>`;
    })
    .join("");

  const defs = `
    ${markDefs("b")}
    ${linear("b-arc", 0, 0, BW, BH)}
    ${linear("b-underline", BW / 2 - 400, 0, BW / 2 + 400, 0)}
    <radialGradient id="b-g1" cx="0%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#5B7CFF" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#5B7CFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b-g2" cx="100%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#FF3D6E" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#FF3D6E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b-g3" cx="50%" cy="100%" r="65%">
      <stop offset="0%" stop-color="#35D6FF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#35D6FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b-center" cx="50%" cy="45%" r="42%">
      <stop offset="0%" stop-color="#B45CFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#B45CFF" stop-opacity="0"/>
    </radialGradient>
    <pattern id="b-dots" width="46" height="46" patternUnits="userSpaceOnUse">
      <circle cx="2.4" cy="2.4" r="2.4" fill="#ffffff" fill-opacity="0.055"/>
    </pattern>
    <filter id="b-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="46"/>
    </filter>`;

  const body = `
<rect width="${BW}" height="${BH}" fill="${INK[950]}"/>
<rect width="${BW}" height="${BH}" fill="url(#b-dots)"/>
<rect width="${BW}" height="${BH}" fill="url(#b-g1)"/>
<rect width="${BW}" height="${BH}" fill="url(#b-g2)"/>
<rect width="${BW}" height="${BH}" fill="url(#b-g3)"/>
<g filter="url(#b-soft)" opacity="0.7">
  <path d="M-120 1180 C 520 900, 1000 1180, 1420 940 S 2260 620, 2700 800" fill="none" stroke="url(#b-arc)" stroke-width="26" stroke-linecap="round"/>
  <path d="M-120 340 C 460 120, 980 420, 1500 250 S 2300 80, 2700 300" fill="none" stroke="url(#b-arc)" stroke-width="18" stroke-linecap="round" opacity="0.8"/>
</g>
${blocks}
<rect width="${BW}" height="${BH}" fill="url(#b-center)"/>
${mark("b", { cx: lockX + mw / 2, cy: lockCy, width: mw })}
${wordmark({ x: lockX + mw + gap, y: lockCy - wh / 2, height: wh, stroke: INK[100] })}
<rect x="${BW / 2 - 320}" y="748" width="640" height="6" rx="3" fill="url(#b-underline)" opacity="0.9"/>
<text x="${BW / 2}" y="824" text-anchor="middle" font-family="${KO_FONT}" font-size="52" font-weight="700" fill="${INK[100]}" letter-spacing="1">${tagline}</text>
${chipSvg}
${
  guides
    ? `<g fill="none">
        <rect x="${SAFE.x}" y="${SAFE.y}" width="${SAFE.w}" height="${SAFE.h}" stroke="#00FF88" stroke-width="4" stroke-dasharray="18 12"/>
        <rect x="0" y="${SAFE.y}" width="${BW}" height="${SAFE.h}" stroke="#FFD93D" stroke-width="4" stroke-dasharray="18 12" opacity="0.7"/>
        <text x="${SAFE.x + 12}" y="${SAFE.y - 18}" font-family="${KO_FONT}" font-size="30" font-weight="700" fill="#00FF88">모바일 안전영역 1546 x 423</text>
        <text x="24" y="${SAFE.y - 18}" font-family="${KO_FONT}" font-size="30" font-weight="700" fill="#FFD93D">데스크톱 2560 x 423</text>
      </g>`
    : ""
}`;
  return svgDoc(BW, BH, defs, body);
}

/* ─────────────────────────── 출력 ─────────────────────────── */

const APP = join(ROOT, "src", "app");
const written = [];
const svgWidth = (svg) => Number(/width="([\d.]+)"/.exec(svg)[1]);

// SVG 를 원하는 픽셀 폭으로 렌더합니다. 1.5배로 그린 뒤 줄여 가장자리를 매끈하게 만듭니다.
async function render(svg, targetWidth) {
  const w = svgWidth(svg);
  const density = Math.min(2400, Math.max(72, Math.round((72 * targetWidth * 1.5) / w)));
  const buf = await sharp(Buffer.from(svg), { density }).png().toBuffer();
  return sharp(buf).resize({ width: targetWidth }).png({ compressionLevel: 9 }).toBuffer();
}

function emit(path, label, data) {
  writeFileSync(path, data);
  written.push(label);
}
const emitSvg = (name, svg) => emit(join(OUT, name), "public/brand/" + name, svg);
const emitPng = async (name, svg, targetWidth) =>
  emit(join(OUT, name), "public/brand/" + name, await render(svg, targetWidth));

const markSvg = markOnlySvg();
const markCompact = markCompactSvg();
const logo = lockupSvg();
const logoLight = lockupSvg({ wordColor: INK[900] });
const logoRainbow = lockupSvg({ rainbowWord: true });
const logoStacked = stackedSvg();
const avatar = avatarSvg();
const banner = bannerSvg();
const bannerGuide = bannerSvg({ guides: true });

emitSvg("viberhood-mark.svg", markSvg);
emitSvg("viberhood-mark-compact.svg", markCompact);
emitSvg("viberhood-logo.svg", logo);
emitSvg("viberhood-logo-on-light.svg", logoLight);
emitSvg("viberhood-logo-rainbow.svg", logoRainbow);
emitSvg("viberhood-logo-stacked.svg", logoStacked);
emitSvg("viberhood-avatar.svg", avatar);
emitSvg("viberhood-youtube-banner.svg", banner);

await emitPng("viberhood-mark-1024.png", markSvg, 1024);
await emitPng("viberhood-logo-1600.png", logo, 1600);
await emitPng("viberhood-logo-on-light-1600.png", logoLight, 1600);
await emitPng("viberhood-logo-stacked-1200.png", logoStacked, 1200);
await emitPng("viberhood-avatar-800.png", avatar, 800);
await emitPng("viberhood-youtube-banner-2560x1440.png", banner, 2560);
await emitPng("viberhood-youtube-banner-safearea-guide.png", bannerGuide, 2560);

// OG / 링크 미리보기 (1200 x 630) — 채널아트 가운데를 1.9:1 로 잘라 재사용합니다.
const bannerPng = await render(banner, 2560);
emit(
  join(OUT, "viberhood-og.png"),
  "public/brand/viberhood-og.png",
  await sharp(bannerPng)
    .extract({ left: 80, top: 90, width: 2400, height: 1260 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toBuffer()
);

// 파비콘 · 앱 아이콘 — Next.js App Router 파일 규칙에 맞춰 src/app 에 바로 씁니다.
// icon.png 하나만 둡니다. icon.svg 를 같이 두면 Next 가 png 만 링크하고 svg 는 버려집니다.
emit(join(APP, "icon.png"), "src/app/icon.png", await render(markSvg, 256));
emit(join(APP, "apple-icon.png"), "src/app/apple-icon.png", await render(avatar, 180));

console.log(["생성 완료:", ...written.map((f) => "  " + f)].join("\n"));
