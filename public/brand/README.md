# Viberhood 브랜드 애셋

바이브코딩으로 노는 이웃들. 마크는 **레인보우 화면을 켠 휴대용 게임기**, 화면 속 `V` 는 브랜드 이니셜입니다.

## 팔레트

| 이름 | HEX | 쓰임 |
| --- | --- | --- |
| Rainbow 1 | `#FF3D6E` | 무지개 시작 · A 버튼 |
| Rainbow 2 | `#FF8A3D` | |
| Rainbow 3 | `#FFD93D` | |
| Rainbow 4 | `#3DE68A` | |
| Rainbow 5 | `#35D6FF` | B 버튼 · 기본 강조색 |
| Rainbow 6 | `#5B7CFF` | |
| Rainbow 7 | `#B45CFF` | 무지개 끝 |
| Body | `#151A34` | 게임기 본체 |
| Screen dark | `#080A15` | 베젤 · 화면 속 V |
| Ink 950 | `#07080F` | 배경 (사이트 `--color-ink-950` 과 동일) |
| Ink 100 | `#E7E9F7` | 워드마크 · D-패드 |

## 파일

| 파일 | 용도 |
| --- | --- |
| `viberhood-logo.svg` / `-1600.png` | 기본 가로 로고 (어두운 배경) |
| `viberhood-logo-on-light.svg` / `-1600.png` | 밝은 배경용 (워드마크 잉크색) |
| `viberhood-logo-rainbow.svg` | 워드마크까지 무지개인 강조 버전 |
| `viberhood-logo-stacked.svg` / `-1200.png` | 세로 조합 (굿즈 · 정사각 썸네일) |
| `viberhood-mark.svg` / `-1024.png` | 마크 단독 (배경 투명, 파비콘 · 앱 아이콘) |
| `viberhood-avatar.svg` / `-800.png` | 유튜브 · SNS 프로필 (800×800) |
| `viberhood-youtube-banner-2560x1440.png` | 유튜브 채널아트 업로드용 |
| `viberhood-youtube-banner-safearea-guide.png` | 안전영역 확인용 (업로드 X) |

## 쓸 때

- 최소 크기: 마크 24px, 가로 로고 120px. 그 아래로는 마크만 쓰세요.
- 여백은 게임기 화면 높이의 절반 이상 확보.
- 워드마크는 폰트가 아니라 패스로 그려져 있어 어떤 환경에서도 같게 보입니다. 임의로 늘리거나 기울이지 마세요.
- 마크는 기본 수평. 정사각 아이콘(파비콘 · 프로필)에서만 -9° 기울여 씁니다.

## 채널아트 규격

2560×1440 업로드 → 기기별로 잘립니다.

- 모바일 안전영역: 가운데 **1546×423** (로고 · 태그라인 · 칩 전부 여기 안에 있음)
- 데스크톱: 2560×423
- TV: 2560×1440 전체

## 다시 만들기

색·문구·배치를 바꾸려면 [scripts/brand/build-brand.mjs](../../scripts/brand/build-brand.mjs) 를 고치고

```bash
node scripts/brand/build-brand.mjs
```

SVG 와 PNG 가 전부 다시 생성됩니다. (PNG 변환에 `sharp` 를 쓰며, Next.js 의존성으로 이미 설치돼 있습니다.)
