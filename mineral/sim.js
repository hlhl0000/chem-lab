"use strict";
/* ================================================================
   고체 — 거시 관찰에서 입자 배열까지 (계산부)

   ★ 이 시뮬레이션이 깨려는 생각
     ① "결정 = 예쁘고 투명한 것"      → 판단 기준은 겉모습이 아니라 **입자 배열**이다.
                                        불투명한 황철석·구리·철도 결정성 고체다.
     ② "유리는 아주 느린 액체다"      → 상온에서 창유리의 이완 시간은 약 10²³년.
                                        우주 나이(약 10¹⁰년)를 압도적으로 넘는다.
                                        관측 가능한 흐름은 **원리적으로 불가능**하다.
     ③ "이온 결정은 전기가 통한다"    → 고체에서는 이온이 격자에 묶여 있어 통하지 않는다.
                                        융해액·수용액에서만 통한다.
     ④ "분자 결정은 분자 사이가 공유 결합" → 분자 **안**은 공유 결합, 분자 **사이**는 분자 간 힘
                                        (얼음=수소 결합 / 드라이아이스=분산력).
     ⑤ "금속 결정은 녹는점이 높다"    → 구리(1085 ℃)·철(1538 ℃)은 높지만, 금속의 녹는점은
                                        수은(−39 ℃)부터 텅스텐(3422 ℃)까지 매우 다양하다.

   ⚠ 성취기준 범위
     [12물에01-04] 해설: "결정 구조는 다루지 않고" 이온·공유·금속으로 분류하는 수준.
     → **결합의 종류까지는 본문**, 단위 세포·배위수·격자 상수는 화면에서 「심화(범위 밖)」로
       접어 두고 원하는 학생만 펼치게 한다. 시험 범위가 아님을 화면에 적는다.

   격자 상수는 문헌값이며, 그 값으로 **밀도를 계산해 문헌 밀도와 대조**해 검증했다
   (/tmp/work/_check/mineral_data_check.js — 0.3 % 이내. 드라이아이스는 별도 2조건).

   출처(신규 3종, WebSearch로 재확인 — C-11): 위키백과 Diamond·Iron·Dry ice 항목,
     lampx.tugraz.at 다이아몬드 물성표, solidstate3d.com 철 물성표.
     URL 전문은 /tmp/work/_check/mineral_data_check.js 주석에 있다(sim.js는 금지 패턴
     검사 대상이라 http/https 리터럴을 여기 두지 않는다 — §2 sim.js 판정 ⑥).
   ================================================================ */

const NA = 6.02214076e23;

/* 격자점 생성 범위를 화면(0~1)보다 넓힌다 — 확대 시 상자 가장자리가 비지 않게 한다.
   UI부(drawLat)가 이 상수를 그대로 읽어 뷰포트 매핑과 클리핑에 쓴다(F-1 단일 원천). */
const LAT_PAD = 0.12;

/* 금속의 녹는점은 매우 다양하다는 단서 — 구리·철 두 곳에서 같은 문장을 쓰므로
   상수 하나로 정의해 두 곳이 같은 문자열을 참조하게 한다(F-1). §5 금지-⑬ 대응. */
const METAL_MP_NOTE = " — 금속의 녹는점은 매우 다양하다(수은 −39 ℃ ~ 텅스텐 3422 ℃)";
/* 철의 강자성 단서 — §5 금지-③: 자성은 금속 결합의 판별 기준이 아니라는 단서를 반드시 붙인다 */
const IRON_MAGNET_NOTE = "자석에 붙는 성질(강자성)은 <b>퀴리점 770 ℃</b> 위에서는 사라지며, " +
  "<b>금속 결합의 판별 기준이 아니다</b> — 구리·알루미늄도 금속 결정이지만 자석에 붙지 않는다.";

const MIN = {
  LIST: [
    /* ── 기존 6종 — 값을 손대지 않는다(§5 금지-⑤). mpText만 새로 추가한다 ── */
    {
      id: "quartz", name: "석영", formula: "SiO₂", kind: "결정성",
      type: "공유(원자) 결정", bond: "공유 결합", look: "투명~반투명 · 육각기둥",
      mp: 1713, mpText: "1713 ℃", mpLabel: "녹는점",
      cond: { solid: "통하지 않음", melt: "통하지 않음" },
      density: 2.65, a: 4.913, c: 5.405, cellAtoms: 9, cellMass: 3 * 60.08,   // 삼방정 3 SiO₂/cell
      hex: true,
      note: "규소와 산소가 <b>끝없이 이어진 그물</b>이다. '분자'가 따로 없다. 그래서 녹는점이 아주 높다.",
      color: [0.86, 0.90, 0.93], metal: 0.0, rough: 0.10, opacity: 0.35, shape: "prism"
    },
    {
      id: "halite", name: "암염", formula: "NaCl", kind: "결정성",
      type: "이온 결정", bond: "이온 결합", look: "무색투명 · 정육면체",
      mp: 801, mpText: "801 ℃", mpLabel: "녹는점",
      cond: { solid: "통하지 않음 ★", melt: "통함" },
      density: 2.17, a: 5.640, cellAtoms: 8, cellMass: 4 * 58.44,             // 면심 4 NaCl/cell
      note: "Na⁺ 와 Cl⁻ 가 번갈아 놓인다. <b>고체에서는 이온이 격자에 묶여 있어 전기가 통하지 않는다.</b> 녹이거나 물에 녹이면 통한다.",
      color: [0.93, 0.94, 0.96], metal: 0.0, rough: 0.16, opacity: 0.30, shape: "cube"
    },
    {
      id: "pyrite", name: "황철석", formula: "FeS₂", kind: "결정성",
      type: "이온·공유가 섞인 결정 (심화)", bond: "이온성 + 공유성", look: "금속광택 · 불투명 · 정육면체",
      mp: 1188, mpText: "1188 ℃", mpLabel: "녹는점",
      cond: { solid: "조금 통함(반도체)", melt: "통함" },
      density: 5.01, a: 5.418, cellAtoms: 12, cellMass: 4 * 119.98,
      note: "금빛 금속광택이라 <b>'바보의 금'</b>이라 불린다. <b>불투명한데도 결정성 고체다</b> — 결정인지 아닌지는 겉모습이 정하지 않는다.",
      color: [0.85, 0.72, 0.32], metal: 0.85, rough: 0.20, opacity: 1.0, shape: "cube"
    },
    {
      id: "copper", name: "구리", formula: "Cu", kind: "결정성",
      type: "금속 결정", bond: "금속 결합", look: "붉은 금속광택 · 불투명",
      mp: 1085, mpText: "1085 ℃" + METAL_MP_NOTE, mpLabel: "녹는점",
      cond: { solid: "잘 통함", melt: "잘 통함" },
      density: 8.96, a: 3.615, cellAtoms: 4, cellMass: 4 * 63.55,             // 면심입방 4 Cu/cell
      note: "양이온 사이를 <b>자유 전자</b>가 돌아다닌다. 그래서 <b>고체에서도 액체에서도</b> 전기가 통한다. " +
        "같은 금속 결합이라도 철과는 <b>쌓인 방식이 다르다</b>(가장 촘촘하게 쌓임).",
      color: [0.85, 0.48, 0.30], metal: 1.0, rough: 0.28, opacity: 1.0, shape: "blob"
    },
    {
      id: "ice", name: "얼음", formula: "H₂O", kind: "결정성",
      type: "분자 결정", bond: "분자 안 = 공유 결합 / 분자 사이 = 수소 결합",
      look: "무색투명 · 육각형 · 서리질 반투명",
      mp: 0, mpText: "0 ℃", mpLabel: "녹는점",
      cond: { solid: "통하지 않음", melt: "거의 통하지 않음" },
      density: 0.917, a: 4.52, c: 7.36, cellAtoms: 4, cellMass: 4 * 18.015,   // 육방 Ih 4 H2O/cell
      hex: true, molecular: true,
      note: "<b>분자 안은 공유 결합, 분자 사이는 수소 결합</b>이다. 두 층위를 섞지 말 것. 분자 사이의 힘이 약해 녹는점이 낮다.",
      color: [0.90, 0.95, 0.98], metal: 0.0, rough: 0.22, opacity: 0.34, shape: "prism"
    },
    {
      id: "obsidian", name: "흑요석 (화산 유리)", formula: "주로 SiO₂", kind: "비결정성",
      type: "비결정성 고체", bond: "공유 결합 (그물이 불규칙)", look: "검고 유리질 광택 · 조개껍데기 모양 깨짐",
      mp: null, mpText: "녹는점 없음 — 점차 물러지는 연화 구간", mpLabel: "상태 변화",
      cond: { solid: "통하지 않음", melt: "통하지 않음" },
      density: 2.4, a: null,
      note: "녹는점이 <b>없다.</b> 대신 온도를 올리면 <b>점차 물러지는 연화 구간</b>이 있다. 유리와 같은 방식의 고체다. " +
        "상온에서 유리가 눈에 보일 만큼 흐르려면 계산상 약 <b>10²³년</b>(우주 나이 약 10¹⁰년)이 걸린다 — <b>흐르는 액체가 아니다.</b>",
      color: [0.05, 0.05, 0.065], metal: 0.05, rough: 0.06, opacity: 0.92, shape: "chip"
    },
    /* ── 신규 3종 — §1-1 확-10~확-12 문헌값. §5 금지-①②③④ 적용 ── */
    {
      id: "diamond", name: "다이아몬드", formula: "C", kind: "결정성",
      type: "공유(원자) 결정", bond: "공유 결합", look: "무색투명 · 팔면체 · 강한 정반사",
      mp: null, mpText: "1기압에서는 녹기 전에 흑연으로 변한다(측정된 녹는점은 고압 조건에서의 값)", mpLabel: "녹는점(조건)",
      cond: { solid: "통하지 않음", melt: "1기압에서는 액체가 되지 않는다" },
      density: 3.515, a: 3.567, cellAtoms: 8, cellMass: 8 * 12.011,           // 다이아몬드 입방 8 C/cell
      note: "탄소 원자 하나가 이웃 4개와 모두 공유 결합으로 이어진 그물이다. '분자'가 따로 없어 " +
        "석영처럼 녹는점이 매우 높다 — 다만 <b>1기압에서는 녹기 전에 흑연으로 바뀐다.</b>",
      color: [0.95, 0.96, 0.98], metal: 0.0, rough: 0.03, opacity: 0.22, shape: "octa"
    },
    {
      id: "iron", name: "철", formula: "Fe", kind: "결정성",
      type: "금속 결정", bond: "금속 결합", look: "회백색 금속광택 · 불투명 · 옅은 산화 얼룩",
      mp: null, mpText: "1538 ℃" + METAL_MP_NOTE, mpLabel: "녹는점",
      cond: { solid: "잘 통함", melt: "잘 통함" },
      density: 7.874, a: 2.8665, cellAtoms: 2, cellMass: 2 * 55.845,          // 체심입방 2 Fe/cell
      note: "구리와 <b>같은 금속인데 쌓인 방식이 다르다</b> — 둘 다 금속 결합(자유 전자)이지만, " +
        "구리는 원자가 가장 촘촘하게 쌓이고 철은 그보다 성기게 쌓인다(「심화」에서 차이를 볼 수 있다). " + IRON_MAGNET_NOTE,
      color: [0.70, 0.71, 0.73], metal: 0.9, rough: 0.34, opacity: 1.0, shape: "rcube"
    },
    {
      id: "dryice", name: "드라이아이스", formula: "CO₂", kind: "결정성",
      type: "분자 결정", bond: "분자 안 = 공유 결합 / 분자 사이 = 분산력(런던 분산력)",
      look: "흰 불투명 · 각진 조각 · 서리질 표면",
      mp: null, mpText: "승화 −78.5 ℃ (1기압에서 액체를 거치지 않는다)", mpLabel: "승화점",
      cond: { solid: "통하지 않음", melt: "1기압에서는 액체가 되지 않는다" },
      density: 1.64, a: 5.63, cellAtoms: 12, cellMass: 4 * 44.009,            // 입방 Pa3̄ 4 CO2/cell
      molecular: true, densityIsCalc: true,
      note: "이 밀도 값(1.64 g/cm³)의 출처는 측정 온도를 밝히지 않은 <b>저온 결정 상태의 자료</b>다. " +
        "그 자료 그대로 계산한 값을 쓴다 — 흔히 보는 통용값(약 1.56 g/cm³)과는 " +
        "<b>다른 온도의 값을 섞지 않는다.</b>(자세한 계산은 「심화」 참고) 분자 <b>안</b>은 공유 결합, 분자 <b>사이</b>는 분산력이다.",
      color: [0.97, 0.98, 0.99], metal: 0.0, rough: 0.42, opacity: 0.97, shape: "chunk"
    },
    /* ── 사슬 고분자 2종 (2026-08-26 신설) — 학습지 1-2-03 「비결정성 고체」 정합 ──
       학습지의 비결정성 3종(유리·고무·플라스틱)이 한 화면에 모인다. 다만 **구조가 같지 않다** —
       유리(흑요석)는 불규칙한 «그물»이고, 고무·플라스틱은 길게 이어진 «사슬»이 엉킨 것이다.
       그래서 배열도 따로 만든다(l3Chain ≠ l3Amorphous).

       문헌값 (2026-08-26 확인 · 격자 상수가 없어 밀도 역산 대조는 할 수 없다 — 흑요석과 같다):
         천연고무   밀도 0.91~0.93 g/cm³ · 늘리지 않은 상태에서 비결정성
         폴리스타이렌 밀도 1.05 g/cm³ · 어택틱이라 결정화하지 않는다 · 유리 전이 74~105 ℃ */
    {
      id: "rubber", name: "고무", formula: "(C₅H₈)ₙ", kind: "비결정성",
      type: "비결정성 고체 (사슬 고분자)",
      bond: "사슬 안 = 공유 결합 / 사슬 사이 = 분자 간 힘 + 가황 다리",
      look: "검은 회색 · 불투명 · 무광 · 잡아당기면 늘어났다 되돌아옴",
      mp: null, mpText: "녹는점 없음 — 하나로 정해지지 않고 넓은 구간에 걸쳐 서서히 물러진다", mpLabel: "상태 변화",
      cond: { solid: "통하지 않음", melt: "가열해도 녹지 않고 분해된다" },
      density: 0.92, a: null, polymer: true, chainCross: true,
      note: "길게 이어진 <b>사슬</b>이 불규칙하게 엉켜 있다 — 유리(흑요석)의 불규칙한 <b>그물</b>과는 다른 모습이다. " +
        "사슬 사이를 <b>황 다리</b>가 군데군데 이어 주어(가황), 잡아당기면 늘어났다가 <b>원래 모양으로 되돌아온다.</b> " +
        "타이어에 쓰는 고무가 이것이다. 되풀이되는 단위가 없어 <b>녹는점이 하나로 정해지지 않는다.</b>",
      /* 타이어 고무 — 카본블랙 때문에 검지만 «완전한 검정»이 아니라 짙은 회갈색이고,
         빛을 거의 되쏘지 않는 **무광**이다. 흑요석(유리질 광택의 검정)과 겹치지 않게
         한 단계 밝게 잡았다 — 화면 평균색 실측 거리 90(흑요석 15,15,17 ↔ 고무 74,66,61). */
      color: [0.24, 0.215, 0.195], metal: 0.0, rough: 0.78, opacity: 1.0, grain: 0.42, shape: "blob"
    },
    {
      id: "polystyrene", name: "플라스틱 (폴리스타이렌)", formula: "(C₈H₈)ₙ", kind: "비결정성",
      type: "비결정성 고체 (사슬 고분자)",
      bond: "사슬 안 = 공유 결합 / 사슬 사이 = 분자 간 힘",
      look: "무색투명~반투명 · 단단하고 잘 부러짐",
      mp: null, mpText: "녹는점 없음 — 약 100 ℃ 부근부터 넓은 구간에 걸쳐 서서히 물러진다", mpLabel: "상태 변화",
      cond: { solid: "통하지 않음", melt: "물러져도 통하지 않음" },
      density: 1.05, a: null, polymer: true,
      note: "길게 이어진 <b>사슬</b>이 불규칙하게 엉켜 있다. 사슬마다 <b>벤젠 고리</b>(곁가지)가 달려 있어 " +
        "사슬이 잘 돌아가지 못하고 뻣뻣하다 — 그래서 일회용 컵은 구부리면 <b>휘지 않고 부러진다.</b> " +
        "고무와 달리 사슬 사이를 잇는 다리가 없다. 되풀이되는 단위가 없어 <b>녹는점이 하나로 정해지지 않는다.</b>",
      /* 일회용 컵·포장재의 폴리스타이렌 — 반투명 «유백색»이고 아주 옅은 크림빛이 돈다
         (완전 무색이 아니며 시간이 지나면 더 누레진다). 화면의 다른 흰 표본(석영·암염·얼음·
         다이아몬드·드라이아이스)은 전부 «푸른» 기미(B > R)라, 유일하게 «따뜻한» 기미(R > B)로
         두면 색만으로 갈린다 — 바꾸기 전 드라이아이스와의 실측 거리는 4.1 이었다.
         표면은 매끈하므로 얼룩(grain)도 비결정 기본값 0.55 대신 낮춰 잡는다. */
      color: [0.95, 0.90, 0.76], metal: 0.0, rough: 0.20, opacity: 0.62, grain: 0.16, shape: "rcube"
    }
  ],
  ZOOM: { min: 0, max: 100, step: 1 }   // 0 = 손에 든 크기, 100 = 입자 크기
};

const mById = id => MIN.LIST.find(m => m.id === id);

/* 확대 배율 — 슬라이더 0~100 을 1배 ~ 10⁹배로 (로그) */
function magnification(z) { return Math.pow(10, (z / 100) * 9); }
/* ⚠ 이 숫자는 **광학 배율이 아니라 개념적 확대 단계**다. 맨눈에서 입자까지 가는
   길을 로그로 눌러 놓은 값이므로 "정확히 몇 배"로 읽히면 안 된다 —
   그래서 화면에는 「약」을 붙이고 옆에 "개념적 확대 단계"라고 못 박아 둔다. */
function zoomLabel(z) {
  const m = magnification(z);
  if (m < 1.5) return "×1 (맨눈 크기)";
  if (m < 1e4) return `약 ×${Math.round(m).toLocaleString("ko-KR")}`;
  if (m < 1e8) return `약 ×${(m / 1e4).toFixed(m < 1e6 ? 1 : 0)}만`;
  return `약 ×${(m / 1e8).toFixed(1)}억`;
}

/* 뷰 혼합 구간 — LATTICE_Z 경성 전환을 대체한다. z<시작 이면 표본 무대(0),
   z>끝 이면 격자 뷰(1), 그 사이는 smoothstep 보간(연속 크로스페이드). */
const ZOOM_BLEND_START = 55, ZOOM_BLEND_END = 70;
function blend(z) {
  if (z <= ZOOM_BLEND_START) return 0;
  if (z >= ZOOM_BLEND_END) return 1;
  const t = (z - ZOOM_BLEND_START) / (ZOOM_BLEND_END - ZOOM_BLEND_START);
  return t * t * (3 - 2 * t); // smoothstep
}

/* 격자 상수로부터 계산한 밀도 (g/cm³) — 문헌 밀도와 대조하는 검증용 */
function densityFromCell(m) {
  if (!m.a) return null;
  const a = m.a * 1e-8;                       // Å → cm
  const V = m.hex
    ? (Math.sqrt(3) / 2) * a * a * (m.c * 1e-8)   // 육방 단위 세포 부피
    : a * a * a;
  return m.cellMass / NA / V;
}

/* ── 입자 배열 만들기 ──
   결정성: 규칙적인 격자. 비결정성: 이어져 있으나 규칙이 없는 그물.
   화면 좌표(0~1, 가장자리는 LAT_PAD 만큼 더 넓게)로 돌려준다.
   실제 구조의 **평면 투영**이며 단위 세포가 아니다.

   반환: { pts, regular, centers, bonds? }
     pts     — 그릴 입자 전부(분자 결정은 중심+주변 원자 모두 포함)
     centers — orderIndex 계산에 쓰는 "격자점"만(분자 결정은 분자 중심만)
     bonds   — [i, j, "in"|"between"] 목록. 있으면 UI부가 이걸로 결합선을 그린다.
               없으면(비분자 결정) UI부가 기존처럼 근접 판정으로 그린다. */
function inLatBounds(p) {
  return p.x >= -LAT_PAD - 0.02 && p.x <= 1 + LAT_PAD + 0.02 &&
         p.y >= -LAT_PAD - 0.02 && p.y <= 1 + LAT_PAD + 0.02;
}

function makeLattice(m, rnd) {
  if (m.polymer) {
    /* 사슬 고분자(2D 폴백) — 사슬 몇 가닥이 엉킨 모습. 골격만 그리고 곁가지는 생략한다.
       WebGL 을 쓸 수 없는 기기의 대체 화면이라 단순한 쪽이 읽힌다.
       3D 와 같은 사실을 말한다 — 사슬 «안»의 결합 길이는 일정하고 «배치»에는 규칙이 없다. */
    const step = 0.075, nChain = 6, nBack = 22;
    const jitter = m.id === "rubber" ? 0.75 : 0.42;   // 고무가 더 잘 구부러진다
    const lo = -LAT_PAD, hi = 1 + LAT_PAD, minD = step * 0.82;
    const pts = [], bonds = [];
    const okAt = (x, y) => {
      if (x < lo || x > hi || y < lo || y > hi) return false;
      for (let t = 0; t < pts.length; t++)
        if (Math.hypot(pts[t].x - x, pts[t].y - y) < minD) return false;
      return true;
    };
    for (let ch = 0; ch < nChain; ch++) {
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 120 && !ok; t++) {
        x = lo + rnd() * (hi - lo); y = lo + rnd() * (hi - lo);
        ok = okAt(x, y);
      }
      if (!ok) continue;
      let prev = pts.length;
      pts.push({ x, y, s: 0, mol: ch });
      let ang = rnd() * Math.PI * 2;
      for (let n = 1; n < nBack; n++) {
        let placed = false;
        for (let t = 0; t < 22 && !placed; t++) {
          const na = ang + (rnd() * 2 - 1) * jitter;
          const nx = pts[prev].x + Math.cos(na) * step, ny = pts[prev].y + Math.sin(na) * step;
          if (!okAt(nx, ny)) continue;
          const idx = pts.length;
          pts.push({ x: nx, y: ny, s: 0, mol: ch });
          bonds.push([prev, idx, "in"]);
          prev = idx; ang = na; placed = true;
        }
        if (!placed) break;
      }
    }
    /* 이어지지 못한 외톨이 점은 버린다 — 「떨어진 입자」로 읽혀 사슬이라는 뜻이 흐려진다 */
    const used = new Uint8Array(pts.length);
    for (let b = 0; b < bonds.length; b++) { used[bonds[b][0]] = 1; used[bonds[b][1]] = 1; }
    const remap = new Int32Array(pts.length).fill(-1);
    const keep = [];
    for (let i = 0; i < pts.length; i++) if (used[i]) { remap[i] = keep.length; keep.push(pts[i]); }
    const nb = [];
    for (let b = 0; b < bonds.length; b++) nb.push([remap[bonds[b][0]], remap[bonds[b][1]], bonds[b][2]]);
    return { pts: keep, regular: false, centers: keep, bonds: nb };
  }
  if (m.kind === "비결정성") {
    /* 비결정성 — 규칙 없는 그물. 최소 간격만 지켜 겹치지 않게 놓는다.
       생성 범위를 0~1보다 넓혀 확대해도 가장자리가 비지 않게 한다. */
    const target = 78, minD = 0.078;
    const lo = -LAT_PAD, hi = 1 + LAT_PAD;
    const pts = [];
    let guard = 0;
    while (pts.length < target && guard++ < 9000) {
      const p = { x: lo + rnd() * (hi - lo), y: lo + rnd() * (hi - lo), s: rnd() < 0.34 ? 0 : 1 };
      if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > minD)) pts.push(p);
    }
    /* bondNear를 돌려주지 않는다(재작업 v3 · 차단 수정) — minD는 거부 샘플링의 "최소" 간격일
       뿐이라 이 값을 결합선 판정 기준(near)으로 쓰면 실제 최근접 거리보다 훨씬 타이트해져
       근처 쌍조차 거의 못 잡는다(고립점 74~82%로 붕괴). UI부(near 계산)가 bondNear 없을 때
       쓰는 폴백 S*0.16으로 되돌려 원본 위상(불규칙하지만 이어진 그물)을 유지한다. */
    return { pts, regular: false, centers: pts };
  }

  if (m.id === "halite" || m.id === "pyrite") {
    /* 이온 결정 — 두 이온이 번갈아 놓인 정사각 격자.
       bondNear = 이 격자 좌표계(0~1, LAT_PAD 적용 전)에서의 최근접 이웃 거리.
       UI부가 이 값을 (1+2*LAT_PAD)로 나눠 화면 좌표로 환산해 결합선 판정에 쓴다(F-1 · A1). */
    const n = 9, d = 1 / n;
    const pts = [];
    for (let i = -1; i <= n + 1; i++) for (let j = -1; j <= n + 1; j++) {
      const p = { x: i * d, y: j * d, s: (i + j + 200) % 2 };
      if (inLatBounds(p)) pts.push(p);
    }
    return { pts, regular: true, centers: pts, bondNear: d };
  }

  if (m.id === "copper") {
    /* 금속 결정 — 가장 촘촘하게 쌓은 배열(육방 최밀 충전의 한 층). 최근접 이웃 거리 = d. */
    const n = 9, d = 1 / n;
    const pts = [];
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      const p = { x: i * d + (((j % 2) + 2) % 2 ? d / 2 : 0), y: j * d * 0.866, s: 0 };
      if (inLatBounds(p)) pts.push(p);
    }
    return { pts, regular: true, centers: pts, bondNear: d };
  }

  if (m.id === "iron") {
    /* 철 — 체심입방(BCC)의 평면 투영: 정사각 격자(모서리) + 각 칸 중심에 1개.
       구리(최밀 충전)와 같은 원소 없이도 "같은 금속인데 쌓인 방식이 다르다"를 보여준다.
       n을 구리(9)보다 작게(6) 잡아 구리보다 성기게 보이도록 한다(재작업 A2).
       최근접 이웃은 모서리↔칸 중심(대각선 절반) 거리 = d/√2. */
    const n = 6, d = 1 / n;
    const pts = [];
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      const p = { x: i * d, y: j * d, s: 0 };
      if (inLatBounds(p)) pts.push(p);
    }
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      const p = { x: (i + 0.5) * d, y: (j + 0.5) * d, s: 0 };
      if (inLatBounds(p)) pts.push(p);
    }
    return { pts, regular: true, centers: pts, bondNear: d / Math.SQRT2 };
  }

  if (m.id === "diamond") {
    /* 다이아몬드 — 별도 함수. 석영의 그물 함수를 부르지 않고, "석영에서 산소만 뺀 그림"도
       아니다(둘 다 §5 금지). 진짜 벌집(honeycomb) 위상으로 만든다 — 원자마다 면내 이웃이
       정확히 3개다(지그재그 육각 고리). 결합선은 근접 판정이 아니라 이 함수가 돌려주는
       명시 bonds 로만 그린다(재작업 A1 — 삼각 격자였던 예전 방식은 이웃이 6개라 위상이 틀렸다).
       4번째 결합 방향(지면 안쪽)은 UI부가 puck 값으로 방사선을 하나 더 그린다.
       표준 벌집 격자 벡터: a1=(1.5L,√3/2·L), a2=(1.5L,−√3/2·L), 기저 A=(0,0)·B=(L,0). */
    const L = 1 / 9;
    const a1x = 1.5 * L, a1y = Math.sqrt(3) / 2 * L;
    const idxA = new Map(), idxB = new Map();
    const pts = [];
    for (let mm = -9; mm <= 9; mm++) for (let nn = -9; nn <= 9; nn++) {
      const px = (mm + nn) * a1x, py = (mm - nn) * a1y;
      const A = { x: px, y: py, s: 0, puck: 0 };
      const B = { x: px + L, y: py, s: 0, puck: 1 };
      if (inLatBounds(A)) { idxA.set(mm + "," + nn, pts.length); pts.push(A); }
      if (inLatBounds(B)) { idxB.set(mm + "," + nn, pts.length); pts.push(B); }
    }
    const bonds = [];
    for (const [key, ai] of idxA) {
      const [mm, nn] = key.split(",").map(Number);
      const bHere = idxB.get(mm + "," + nn);
      const bLeft = idxB.get((mm - 1) + "," + nn);
      const bDown = idxB.get(mm + "," + (nn - 1));
      if (bHere !== undefined) bonds.push([ai, bHere, "in"]);
      if (bLeft !== undefined) bonds.push([ai, bLeft, "in"]);
      if (bDown !== undefined) bonds.push([ai, bDown, "in"]);
    }
    return { pts, bonds, regular: true, centers: pts };
  }

  if (m.molecular) {
    /* 분자 결정(얼음·드라이아이스) — 격자점마다 분자 하나를 통째로 놓는다.
       각 점에 mol(분자 번호)과 role(중심/주변)을 돌려주고, bonds 에 in(분자 안)/between(분자 사이)을
       구분해 명시한다. orderIndex 는 이 함수가 돌려주는 centers(분자 중심)만으로 계산한다. */
    const pts = [], bonds = [], centers = [];
    let molIdx = 0;
    if (m.id === "ice") {
      const n = 6, d = 1 / n;
      for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
        const cx = i * d + (((j % 2) + 2) % 2 ? d / 2 : 0);
        const cy = j * d * 0.866;
        if (!inLatBounds({ x: cx, y: cy })) continue;
        const oIdx = pts.length; pts.push({ x: cx, y: cy, s: 0, mol: molIdx, role: "O" });
        const h1Idx = pts.length; pts.push({ x: cx + d * 0.46, y: cy + d * 0.22, s: 1, mol: molIdx, role: "H" });
        const h2Idx = pts.length; pts.push({ x: cx - d * 0.10, y: cy + d * 0.38, s: 1, mol: molIdx, role: "H" });
        bonds.push([oIdx, h1Idx, "in"], [oIdx, h2Idx, "in"]);
        centers.push({ x: cx, y: cy, mol: molIdx, atomIdx: oIdx });
        molIdx++;
      }
    } else {
      /* 드라이아이스 — 격자점마다 O=C=O 3원자 덩어리. 짝수/홀수 자리에서 분자 방향을
         가로/세로로 번갈아 배치한다(Pa3̄ 구조가 실제로 분자 방향을 번갈아 두는 것을 단순화). */
      const n = 7, d = 1 / n;
      for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
        const cx = i * d, cy = j * d;
        if (!inLatBounds({ x: cx, y: cy })) continue;
        const horiz = (i + j) % 2 === 0;
        /* off 0.46→0.52 + SITES.dryice의 O 반지름 0.86→0.74(재작업 v3 권장3 — 계산 검증:
           off만 0.52로 올리면 in-분자 간격은 벌어지지만(여유 +1.5px) 이웃 분자의 C와 겹쳐
           버린다(여유 −1.7px). O 반지름도 함께 줄여야 둘 다 양수 여유(+4.6px / +1.4px,
           S≈680px 기준)가 나온다. 분자 간 결합(between) 판정에 쓰는 spacing(아래, 1/n 그대로)은
           바꾸지 않는다 — 분자 중심 간격은 격자 상수가 아니라 이 분자 안 결합 길이만 늘린다. */
        const off = d * 0.52;
        const cIdx = pts.length; pts.push({ x: cx, y: cy, s: 0, mol: molIdx, role: "C" });
        const o1Idx = pts.length;
        pts.push(horiz ? { x: cx - off, y: cy, s: 1, mol: molIdx, role: "O" } : { x: cx, y: cy - off, s: 1, mol: molIdx, role: "O" });
        const o2Idx = pts.length;
        pts.push(horiz ? { x: cx + off, y: cy, s: 1, mol: molIdx, role: "O" } : { x: cx, y: cy + off, s: 1, mol: molIdx, role: "O" });
        bonds.push([cIdx, o1Idx, "in"], [cIdx, o2Idx, "in"]);
        centers.push({ x: cx, y: cy, mol: molIdx, atomIdx: cIdx });
        molIdx++;
      }
    }
    /* between — 가장 가까운 이웃 분자 중심끼리 이어(수소 결합/분산력) */
    const spacing = m.id === "ice" ? (1 / 6) : (1 / 7);
    const near = spacing * 1.06;
    for (let a = 0; a < centers.length; a++) for (let b = a + 1; b < centers.length; b++) {
      const dd = Math.hypot(centers[a].x - centers[b].x, centers[a].y - centers[b].y);
      if (dd < near) bonds.push([centers[a].atomIdx, centers[b].atomIdx, "between"]);
    }
    return { pts, bonds, regular: true, centers };
  }

  /* 석영 — 육각 그물 (꼭짓점에 중심 원자, 사이에 이어 주는 원자).
     Si–O 최근접 거리 = d/2 (p0→p1, p0→p2 둘 다 이 거리). */
  const n = 6, d = 1 / n;
  const pts = [];
  for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
    const x = i * d + (((j % 2) + 2) % 2 ? d / 2 : 0), y = j * d * 0.866;
    const p0 = { x, y, s: 0 }; if (inLatBounds(p0)) pts.push(p0);
    const p1 = { x: x + d / 2, y, s: 1 }; if (inLatBounds(p1)) pts.push(p1);
    const p2 = { x: x + (((j % 2) + 2) % 2 ? -d / 4 : d / 4), y: y + d * 0.433, s: 1 };
    if (inLatBounds(p2)) pts.push(p2);
  }
  return { pts, regular: true, centers: pts, bondNear: d / 2 };
}

/* 규칙성 지표 — 최근접 이웃 거리의 상대 표준편차.
   결정이면 0에 가깝고, 비결정이면 크다. 이 수가 곧 "규칙적인가"의 정량적 답이다.
   분자 결정은 분자 중심(centers)만, 그 외는 격자점(centers===pts)만으로 계산한다. */
function orderIndex(pts) {
  if (pts.length < 4) return 1;
  const d = [];
  for (const p of pts) {
    let best = Infinity;
    for (const q of pts) if (q !== p) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    if (isFinite(best)) d.push(best);
  }
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length);
  return sd / m;
}




/* ── 3차원 공-막대 모형 데이터 ───────────────────────────────────────────
   확대 뷰에 실제로 그려지는 배열이다. 2D 함수(makeLattice)는 그대로 둔다 —
   WebGL을 못 쓰는 기기의 폴백과 검증 스크립트(orderIndex·topology)가 그것을 쓴다.

   반환 { atoms, bonds, nn, rref, style, cell, cellO, fill? }
     atoms — [{x,y,z,s,role?,mol?}]  반지름 L3_R 인 공 안쪽으로 잘라낸 덩어리
     bonds — [[i,j,kind]]  kind: "in"(공유 결합 — 실선) | "hb"(분자 사이 — 점선)
                                 | "nb"(**결합봉이 아니라 최근접 이웃 표시** — 기본 비표시)
     nn    — 가장 가까운 이웃 거리(모형 단위)
     rref  — 공 반지름을 정하는 기준 길이(가장 짧은 연결선 길이)
     style — "stick" 공+막대 / "pack" 공만(금속 결합은 방향이 정해진 연결선이 없다)
     cell  — 되풀이되는 최소 단위(단위 세포)의 모서리 길이. 「심화」 테두리에만 쓴다.
     cellO — 그 테두리 상자의 시작 모서리 좌표(격자점에 걸리도록 광물마다 다르다)
     fill  — 이웃 막대를 껐을 때 쓰는 **공간 채움** 반지름 기준(이온이 맞닿게)

   ⚠ 실제 결정에서 잘라낸 일부이며 되풀이되는 단위 자체가 아니다.
     공 크기 비는 보기 좋게 조정했고, 석영·얼음·황철석·흑요석은 이웃 관계만 같게 둔
     단순화 모형이다. 이 사실은 화면의 「이 모형의 가정과 한계」에 적는다. */

/* ★ 2026-08-12 개정 — "유한한 덩어리처럼 보이는 경계"를 없앤다.
   예전에는 반지름 1.0 짜리 공 안에서 약 150개만 잘라내 화면 한가운데 떠 있었다.
   그러면 배열이 **거기서 끝나는 완결된 물체**로 읽혀 "NaCl 거대 분자", "결정은 작은
   입자 큐브들의 집합" 같은 오개념을 만든다(교사 검토 지적). 그래서
     ① 잘라내는 공을 **화면보다 크게**(L3_R) 잡아 배열이 화면 밖으로 계속 나가게 하고,
     ② 그릴 때 화면 좌표 기준으로 가장자리를 옅게 지운다(UI부 FADE_IN/FADE_OUT).
   실제로 그리는 것은 화면 안에 들어오는 입자뿐이라(절두체 컬링) 개수가 늘어도 무겁지 않다. */
const L3_R = 1.90;        // 잘라내는 공의 반지름(모형 단위) — 화면 네 변보다 넉넉히 크게
const L3_CELL = 0.54;     // 되풀이 단위(입방 격자 모서리)의 모형 크기.
                          // 끝까지 확대해도 세로로 3회 이상 되풀이되어 보이도록 잡았다.
const L3_MAX = 4400;      // 한 판에 만들 원자 수 상한(안전판)

function l3InBall(x, y, z) { return x * x + y * y + z * z <= L3_R * L3_R + 1e-9; }

/* 되풀이 단위 크기는 광물마다 같게 두되(L3_CELL), 원자 수가 상한을 넘으면 간격을 늘려
   다시 만든다. 간격을 손으로 맞추면 잘라내는 경계에서 개수가 계단식으로 튄다. */
function l3Fit(build, u0, target) {
  const cap = target || L3_MAX;
  let u = u0 || L3_CELL, r = build(u);
  for (let t = 0; t < 12 && r.atoms.length > cap; t++) { u *= 1.10; r = build(u); }
  return r;
}

/* 거리로 연결선을 만든다. hetero=true 면 서로 다른 자리끼리만 잇는다
   (같은 종류 입자끼리는 실제로 직접 결합하지 않는다 — 2D와 같은 규칙). */
function l3BondsByDist(atoms, maxD, hetero) {
  const bonds = [], m2 = maxD * maxD;
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      if (hetero && atoms[i].s === atoms[j].s) continue;
      const dx = atoms[i].x - atoms[j].x, dy = atoms[i].y - atoms[j].y, dz = atoms[i].z - atoms[j].z;
      if (dx * dx + dy * dy + dz * dz <= m2) bonds.push([i, j, "in"]);
    }
  }
  return bonds;
}

/* 면을 가장 촘촘하게 채우는 쌓임(구리) — 이웃 12개 */
function l3Fcc(u) {
  const atoms = [], h = u / 2, n = Math.ceil(2 * L3_R / h) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    if (((i + j + k) % 2 + 2) % 2 !== 0) continue;
    const x = i * h, y = j * h, z = k * h;
    if (l3InBall(x, y, z)) atoms.push({ x, y, z, s: 0 });
  }
  const nn = u * Math.SQRT1_2;
  return { atoms, bonds: [], nn, rref: nn, style: "pack", cell: u, cellO: 0 };
}

/* 모서리 + 가운데 한 개짜리 쌓임(철) — 이웃 8개. 구리보다 성기다 */
function l3Bcc(u) {
  const atoms = [], n = Math.ceil(2 * L3_R / u) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const x = i * u, y = j * u, z = k * u;
    if (l3InBall(x, y, z)) atoms.push({ x, y, z, s: 0 });
    const cx = (i + 0.5) * u, cy = (j + 0.5) * u, cz = (k + 0.5) * u;
    if (l3InBall(cx, cy, cz)) atoms.push({ x: cx, y: cy, z: cz, s: 0 });
  }
  const nn = u * Math.sqrt(3) / 2;
  return { atoms, bonds: [], nn, rref: nn, style: "pack", cell: u, cellO: -u / 2 };
}

/* 두 이온이 번갈아 놓인 쌓임(암염)
   ★ 이온 사이의 막대는 **결합봉이 아니다.** 방향이 정해진 결합이 있는 것처럼 읽혀
     "NaCl 분자"라는 오개념을 만들기 때문에 kind를 "nb"(이웃 표시)로 달아 두고,
     기본 화면에서는 **막대 없이 이온이 맞닿은 공간 채움**으로 그린다(UI부 showNb).
     이온 반지름 비는 실제 그대로(Na⁺ 1.02 Å : Cl⁻ 1.81 Å)이고, 두 반지름의 합이 이온 사이
     거리의 0.94배가 되게 그린다 — 딱 맞붙여 놓으면 큰 Cl⁻ 뒤로 Na⁺ 가 거의 가려진다. */
function l3RockSalt(u) {
  const atoms = [], h = u / 2, n = Math.ceil(2 * L3_R / h) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const x = i * h, y = j * h, z = k * h;
    if (!l3InBall(x, y, z)) continue;
    atoms.push({ x, y, z, s: ((i + j + k) % 2 + 2) % 2 });
  }
  const nn = h;
  const bonds = l3BondsByDist(atoms, nn * 1.05, true).map(b => [b[0], b[1], "nb"]);
  return { atoms, bonds, nn, rref: nn, style: "stick", fill: nn * 0.60, cell: u, cellO: -u / 2 };
}

/* 황철석 — 철 자리와 S₂ 덩어리가 번갈아 놓인다(단순화 모형).
   S₂ 안의 결합이 이 광물을 순수한 이온 결정이 아니게 만든다 — 화면 「가정과 한계」 참조. */
function l3Pyrite(u) {
  const atoms = [], bonds = [], h = u / 2, n = Math.ceil(2 * L3_R / h) + 1;
  const AX = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => {
    const L = Math.sqrt(3); return [v[0] / L, v[1] / L, v[2] / L];
  });
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const x = i * h, y = j * h, z = k * h;
    if (!l3InBall(x, y, z)) continue;
    if (((i + j + k) % 2 + 2) % 2 === 0) { atoms.push({ x, y, z, s: 0 }); continue; }
    const ax = AX[(((i * 7 + j * 5 + k * 3) % 4) + 4) % 4], d = 0.20 * u;
    const a = atoms.length; atoms.push({ x: x + ax[0] * d, y: y + ax[1] * d, z: z + ax[2] * d, s: 1 });
    const b = atoms.length; atoms.push({ x: x - ax[0] * d, y: y - ax[1] * d, z: z - ax[2] * d, s: 1 });
    bonds.push([a, b, "in"]);
  }
  /* 철 자리 ↔ 황 — 서로 다른 자리끼리만 잇는다.
     이 선은 S₂ 안의 공유 결합("in")과 달리 **이웃 표시**일 뿐이므로 "nb"로 단다. */
  const cross = l3BondsByDist(atoms, h * 1.28, true).map(b => [b[0], b[1], "nb"]);
  return {
    atoms, bonds: bonds.concat(cross), nn: h, rref: 0.40 * u, style: "stick",
    fill: h * 0.43, cell: u, cellO: -u / 2
  };
}

/* 이웃 4개가 사방으로 뻗은 그물(다이아몬드). 원자 하나가 이웃 4개와 모두 이어진다. */
function l3TetraNet(u) {
  const pts = [], h = u / 2, q = u / 4, n = Math.ceil(2 * L3_R / h) + 2;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    if (((i + j + k) % 2 + 2) % 2 !== 0) continue;
    const x = i * h, y = j * h, z = k * h;
    if (l3InBall(x, y, z)) pts.push({ x, y, z, s: 0 });
    const bx = x + q, by = y + q, bz = z + q;
    if (l3InBall(bx, by, bz)) pts.push({ x: bx, y: by, z: bz, s: 0 });
  }
  return { pts, nn: u * Math.sqrt(3) / 4 };
}
function l3Diamond(u) {
  const { pts, nn } = l3TetraNet(u);
  return {
    atoms: pts, bonds: l3BondsByDist(pts, nn * 1.08, false),
    nn, rref: nn, style: "stick", cell: u, cellO: 0
  };
}

/* 석영 — 규소 그물의 이웃 사이마다 산소를 하나씩 끼워 넣는다.
   그래서 규소는 이웃 4개, 산소는 이웃 2개가 되고 '분자'가 따로 없는 그물이 된다.
   (다이아몬드 그림을 그대로 쓰거나 "산소만 뺀 그림"으로 만들지 않는다 — 두 구조는 다르다) */
function l3Bridged(u) {
  const { pts, nn } = l3TetraNet(u);
  const links = l3BondsByDist(pts, nn * 1.08, false);
  const atoms = pts.map(p => ({ x: p.x, y: p.y, z: p.z, s: 0 })), bonds = [];
  for (const [i, j] of links) {
    const a = atoms[i], b = atoms[j];
    const mid = atoms.length;
    atoms.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, s: 1 });
    bonds.push([i, mid, "in"], [mid, j, "in"]);
  }
  return { atoms, bonds, nn: nn / 2, rref: nn / 2, style: "stick", cell: u, cellO: 0 };
}

/* 얼음 — 산소가 사방 이웃 4개와 이어진 그물. 산소마다 수소 2개를 붙인다.
   수소가 붙은 쪽은 분자 **안**(굵은 실선), 수소 건너편 이웃은 분자 **사이**(점선). */
function l3Ice(u) {
  const { pts, nn } = l3TetraNet(u);
  const links = l3BondsByDist(pts, nn * 1.08, false);
  const atoms = pts.map((p, i) => ({ x: p.x, y: p.y, z: p.z, s: 0, mol: i, role: "O" }));
  const bonds = [], have = new Array(pts.length).fill(0);
  for (const [i, j] of links) {
    /* 수소는 산소마다 2개 — 아직 덜 가진 쪽이 갖는다(같으면 번호가 작은 쪽) */
    const owner = (have[i] < have[j]) ? i : (have[j] < have[i] ? j : Math.min(i, j));
    const other = owner === i ? j : i;
    if (have[owner] >= 2) { bonds.push([i, j, "hb"]); continue; }   // 둘 다 수소가 찼으면 이웃 관계만 점선으로 남긴다
    have[owner]++;
    const a = atoms[owner], b = atoms[other];
    const t = 0.36;
    const h = atoms.length;
    atoms.push({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
      s: 1, mol: a.mol, role: "H"
    });
    bonds.push([owner, h, "in"], [h, other, "hb"]);
  }
  return { atoms, bonds, nn, rref: nn * 0.36, style: "stick", cell: u, cellO: 0 };
}

/* 드라이아이스 — 자리마다 O=C=O 하나를 통째로 놓는다. 분자 방향은 자리마다 번갈아 둔다.
   분자 사이는 방향이 정해진 연결선이 없다(분산력) — 사이를 잇는 선을 그리지 않고 틈으로 보여 준다. */
function l3DryIce(u) {
  const atoms = [], bonds = [], h = u / 2, n = Math.ceil(2 * L3_R / h) + 1;
  const AX = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => {
    const L = Math.sqrt(3); return [v[0] / L, v[1] / L, v[2] / L];
  });
  let mol = 0;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    if (((i + j + k) % 2 + 2) % 2 !== 0) continue;
    const x = i * h, y = j * h, z = k * h;
    if (!l3InBall(x, y, z)) continue;
    const ax = AX[(((i * 7 + j * 5 + k * 3) % 4) + 4) % 4], d = 0.206 * u;
    const c = atoms.length; atoms.push({ x, y, z, s: 0, mol, role: "C" });
    const o1 = atoms.length; atoms.push({ x: x + ax[0] * d, y: y + ax[1] * d, z: z + ax[2] * d, s: 1, mol, role: "O" });
    const o2 = atoms.length; atoms.push({ x: x - ax[0] * d, y: y - ax[1] * d, z: z - ax[2] * d, s: 1, mol, role: "O" });
    bonds.push([c, o1, "in"], [c, o2, "in"]);
    mol++;
  }
  return { atoms, bonds, nn: u * Math.SQRT1_2, rref: 0.206 * u, style: "stick", cell: u, cellO: 0 };
}

/* 흑요석 — 이어져 있으나 되풀이되는 규칙이 없는 그물.
   규소 자리를 규칙 없이 흩어 놓고, 가까운 이웃끼리 이어 그 사이마다 산소를 끼운다. */
function l3Amorphous(rnd) {
  /* 자리 사이 최소 거리는 석영의 규소-규소 거리(L3_CELL·√3/4)와 비슷하게 잡는다 —
     둘을 나란히 비교하므로 "비결정이 더 성기다/촘촘하다"는 딴 인상을 주면 안 된다.
     자리 수가 수백 개로 늘어 하나씩 전부 대조하면 느리므로 격자 칸에 나눠 담아 확인한다. */
  const nnQ = L3_CELL * Math.sqrt(3) / 4;              // 석영의 규소-규소 거리
  const minD = nnQ * 0.767;                            // 규칙 없이 놓으려면 최소 간격을 더 좁게 잡아야
  const target = Math.round(0.297 / (minD * minD * minD)   // 같은 **자리 밀도**에 닿는다
    * (4 / 3) * Math.PI * L3_R * L3_R * L3_R);
  const pts = [];
  const cs = minD, half = Math.ceil(L3_R / cs) + 1, side = half * 2 + 1;
  const cellOf = new Map();
  const ci = v => Math.min(side - 1, Math.max(0, Math.floor(v / cs) + half));
  let guard = 0;
  while (pts.length < target && guard++ < 400000) {
    const x = (rnd() * 2 - 1) * L3_R, y = (rnd() * 2 - 1) * L3_R, z = (rnd() * 2 - 1) * L3_R;
    if (!l3InBall(x, y, z)) continue;
    const gx = ci(x), gy = ci(y), gz = ci(z);
    let ok = true;
    for (let a = gx - 1; a <= gx + 1 && ok; a++)
      for (let b = gy - 1; b <= gy + 1 && ok; b++)
        for (let c = gz - 1; c <= gz + 1 && ok; c++) {
          const list = cellOf.get((a * side + b) * side + c);
          if (!list) continue;
          for (const qi of list) {
            const q = pts[qi], dx = q.x - x, dy = q.y - y, dz = q.z - z;
            if (dx * dx + dy * dy + dz * dz < minD * minD) { ok = false; break; }
          }
        }
    if (!ok) continue;
    const key = (gx * side + gy) * side + gz;
    if (!cellOf.has(key)) cellOf.set(key, []);
    cellOf.get(key).push(pts.length);
    pts.push({ x, y, z, s: 0 });
  }
  /* 가까운 이웃끼리 잇되, 이웃이 하나도 없는 자리는 가장 가까운 자리에 억지로 잇는다
     — 그물이 끊겨 점만 흩어져 보이면 "비결정 = 입자가 떨어져 있다"는 딴 뜻이 된다. */
  const cut = minD * 1.42, seen = new Set(), links = [];
  const key = (a, b) => Math.min(a, b) + ":" + Math.max(a, b);
  for (let i = 0; i < pts.length; i++) {
    let deg = 0, best = -1, bd = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bd) { bd = d; best = j; }
      if (d <= cut) { deg++; if (!seen.has(key(i, j))) { seen.add(key(i, j)); links.push([i, j]); } }
    }
    if (deg === 0 && best >= 0 && !seen.has(key(i, best))) { seen.add(key(i, best)); links.push([i, best]); }
  }
  const atoms = pts.map(p => ({ x: p.x, y: p.y, z: p.z, s: 0 })), bonds = [];
  for (const [i, j] of links) {
    const a = atoms[i], b = atoms[j], mid = atoms.length;
    atoms.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, s: 1 });
    bonds.push([i, mid, "in"], [mid, j, "in"]);
  }
  return { atoms, bonds, nn: minD, rref: minD / 2, style: "stick" };
}

/* ── 사슬 고분자(고무·플라스틱)의 3차원 배열 ─────────────────────────────
   결정도 아니고 유리의 «그물»도 아니다. **긴 사슬**이 제각기 구부러지며 엉켜 있다.
     · 사슬 «안»은 공유 결합으로 이어진다("in" — 굵은 실선)
     · 사슬 «사이»에는 방향이 정해진 결합이 없다 → 선을 그리지 않는다(드라이아이스와 같은 규칙)
     · 고무만 사슬 사이를 잇는 **가황 다리**(황)가 군데군데 있다 — 되돌아오는 성질의 원인이다
   사슬은 방향을 조금씩 틀며 나아가되(지속성) 이미 놓인 원자를 피한다(자기회피). 그래서
   사슬 «안»의 결합 길이는 일정한데 사슬의 «배치»에는 규칙이 없다 — 결정과 갈리는 지점이다.

   ⚠ 실제 사슬은 되풀이 단위가 수천~수만 개 이어져 있다. 화면에는 훨씬 짧게 그린다.
     곁가지도 실제 원자단(고무 메틸기 CH₃ · 폴리스타이렌 페닐기 C₆H₅)을 **공 하나**로 줄여
     그린다. 이 두 가지는 화면 「이 모형의 가정과 한계」 ⑨에 적는다. */
function l3Chain(rnd, opt) {
  const step = opt.step, jitter = opt.jitter, sideEvery = opt.sideEvery;
  /* 최소 간격은 **화면 반지름 합보다 크게** 잡는다 — 공이 겹쳐 보이면 안 된다
     (매뉴얼 1부 P1 겹침 검사 · 4부 ⑱). 곁가지는 벤젠 고리처럼 큰 것이 있어 더 넉넉히 둔다. */
  const minD = step * 0.72, minSide = step * 0.95, minCross = step * 0.60;
  const atoms = [], bonds = [];
  /* 격자 칸에 나눠 담아 이웃 칸만 대조한다 — 원자가 수백 개라 전수 대조는 느리다 */
  const cs = minD, half = Math.ceil(L3_R / cs) + 2, side = half * 2 + 1;
  const cellOf = new Map();
  const ci = v => Math.min(side - 1, Math.max(0, Math.floor(v / cs) + half));
  const put = (x, y, z, i) => {
    const k = (ci(x) * side + ci(y)) * side + ci(z);
    if (!cellOf.has(k)) cellOf.set(k, []);
    cellOf.get(k).push(i);
  };
  const clearAt = (x, y, z, dMin) => {
    const gx = ci(x), gy = ci(y), gz = ci(z), d2 = dMin * dMin;
    for (let a = gx - 1; a <= gx + 1; a++)
      for (let b = gy - 1; b <= gy + 1; b++)
        for (let c = gz - 1; c <= gz + 1; c++) {
          const list = cellOf.get((a * side + b) * side + c);
          if (!list) continue;
          for (let t = 0; t < list.length; t++) {
            const q = atoms[list[t]], dx = q.x - x, dy = q.y - y, dz = q.z - z;
            if (dx * dx + dy * dy + dz * dz < d2) return false;
          }
        }
    return true;
  };
  /* 방향 하나. flat < 1 이면 «위아래» 성분을 줄여 사슬이 대체로 옆으로 뻗는다.
     성형된 고분자에서 실제로 나타나는 정렬이고, 화면에서는 타격 때 위층·아래층이
     갈릴 수 있게 해 준다 — 완전 등방으로 두면 사슬이 세로로도 얽혀 절반만 움직일 때
     서로를 뚫고 지나간다(실측 — 21표본 중 19표본에서 공이 겹쳤다). */
  const flat = opt.flat === undefined ? 1 : opt.flat;
  const unit = () => {
    const u = rnd() * 2 - 1, t = rnd() * 2 * Math.PI, r = Math.sqrt(1 - u * u);
    const x = r * Math.cos(t), y = r * Math.sin(t) * flat, z = u;
    const L = Math.hypot(x, y, z) || 1;
    return [x / L, y / L, z / L];
  };

  const chainHeads = [];                  // 사슬마다 [시작 원자 번호, 골격 원자 수]
  for (let ch = 0; ch < opt.nChain; ch++) {
    /* 시작점은 공 «안쪽»에서 고른다 — 가장자리에서 시작하면 사슬이 곧 밖으로 나가 짧아진다 */
    let sx = 0, sy = 0, sz = 0, ok = false;
    for (let t = 0; t < 240 && !ok; t++) {
      sx = (rnd() * 2 - 1) * L3_R * 0.72;
      sy = (rnd() * 2 - 1) * L3_R * 0.72;
      sz = (rnd() * 2 - 1) * L3_R * 0.72;
      ok = l3InBall(sx, sy, sz) && clearAt(sx, sy, sz, minD);
    }
    if (!ok) continue;
    const first = atoms.length;
    let prev = first;
    atoms.push({ x: sx, y: sy, z: sz, s: 0, mol: ch, role: "C" });
    put(sx, sy, sz, prev);
    let d = unit();
    for (let n = 1; n < opt.nBack; n++) {
      const a = atoms[prev];
      let placed = false;
      for (let t = 0; t < 44 && !placed; t++) {
        /* 방향을 조금씩 튼다 — jitter 가 작을수록 뻣뻣한 사슬이 된다(폴리스타이렌).
           앞이 막히면 «점점 크게» 틀어 본다. 고정 각도로만 시도하면 사슬이 몇 칸 만에 끊겨
           짧은 토막들만 남는다(실측 — 56칸 중 4~8칸에서 멈추는 사슬이 절반이었다). */
        const jj = t < 24 ? jitter : jitter * (1 + (t - 24) * 0.35);
        const w = unit();
        let nx = d[0] + jj * w[0], ny = d[1] + jj * w[1], nz = d[2] + jj * w[2];
        const L = Math.hypot(nx, ny, nz) || 1;
        nx /= L; ny /= L; nz /= L;
        const x = a.x + nx * step, y = a.y + ny * step, z = a.z + nz * step;
        if (!l3InBall(x, y, z) || !clearAt(x, y, z, minD)) continue;
        const idx = atoms.length;
        atoms.push({ x, y, z, s: 0, mol: ch, role: "C" });
        put(x, y, z, idx);
        bonds.push([prev, idx, "in"]);
        prev = idx; d = [nx, ny, nz]; placed = true;
      }
      if (!placed) break;                 // 갈 곳이 막히면 이 사슬은 여기서 끝난다
    }
    chainHeads.push([first, atoms.length - first]);
  }

  /* 곁가지 — 골격에서 옆으로 뻗은 공 하나. 골격이 뻗은 방향과 수직인 쪽에 붙인다 */
  for (let c = 0; c < chainHeads.length; c++) {
    const first = chainHeads[c][0], len = chainHeads[c][1];
    for (let k = 1; k < len - 1; k += sideEvery) {
      const i = first + k, a = atoms[i], p = atoms[i - 1], q = atoms[i + 1];
      let tx = q.x - p.x, ty = q.y - p.y, tz = q.z - p.z;
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const w = unit();
      const dot = w[0] * tx + w[1] * ty + w[2] * tz;   // 골격 방향 성분을 빼면 수직 방향이 남는다
      let px = w[0] - dot * tx, py = w[1] - dot * ty, pz = w[2] - dot * tz;
      const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
      const x = a.x + px * step * 0.92, y = a.y + py * step * 0.92, z = a.z + pz * step * 0.92;
      if (!l3InBall(x, y, z) || !clearAt(x, y, z, minSide)) continue;
      const idx = atoms.length;
      atoms.push({ x, y, z, s: 1, mol: a.mol, role: "R" });
      put(x, y, z, idx);
      bonds.push([i, idx, "in"]);
    }
  }

  /* 가황 다리(고무만) — 서로 «다른» 사슬의 골격 원자 두 개를 황 하나로 잇는다.
     이 다리가 있어 사슬들이 통째로 하나의 그물이 되고, 당겨도 갈라지지 않고 되돌아온다. */
  let crossCount = 0;
  if (opt.cross > 0) {
    const backbone = [];
    for (let c = 0; c < chainHeads.length; c++)
      for (let k = 0; k < chainHeads[c][1]; k++) backbone.push(chainHeads[c][0] + k);
    const lo = step * 1.4, hi = step * 3.2;
    for (let t = 0; t < 30000 && crossCount < opt.cross && backbone.length > 1; t++) {
      const i = backbone[Math.floor(rnd() * backbone.length)];
      const j = backbone[Math.floor(rnd() * backbone.length)];
      if (i === j) continue;
      const A = atoms[i], B = atoms[j];
      if (A.mol === B.mol) continue;                   // 같은 사슬끼리는 잇지 않는다
      const dd = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
      if (dd < lo || dd > hi) continue;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, mz = (A.z + B.z) / 2;
      if (!clearAt(mx, my, mz, minCross)) continue;
      const idx = atoms.length;
      atoms.push({ x: mx, y: my, z: mz, s: 2, mol: A.mol, role: "S" });
      put(mx, my, mz, idx);
      bonds.push([i, idx, "in"], [idx, j, "in"]);
      crossCount++;
    }
  }

  /* 갈 곳이 막혀 몇 칸 만에 끊긴 사슬은 통째로 버린다 — 화면에서 «토막»으로 읽혀
     「길게 이어진 사슬」이라는 뜻이 흐려진다. 그 사슬에 걸린 가황 다리도 함께 사라진다. */
  const MIN_BACK = 6;
  const dropMol = new Set();
  let liveChains = 0;
  for (let c = 0; c < chainHeads.length; c++) {
    if (chainHeads[c][1] < MIN_BACK) dropMol.add(atoms[chainHeads[c][0]].mol);
    else liveChains++;
  }
  const dead = new Uint8Array(atoms.length);
  for (let i = 0; i < atoms.length; i++) if (dropMol.has(atoms[i].mol)) dead[i] = 1;

  /* 남은 것 중 결합이 하나도 없는 원자도 버린다 — 「떨어져 나온 입자」로 읽힌다 */
  const used = new Uint8Array(atoms.length);
  const liveB = [];
  for (let b = 0; b < bonds.length; b++) {
    const i = bonds[b][0], j = bonds[b][1];
    if (dead[i] || dead[j]) continue;
    liveB.push(bonds[b]); used[i] = 1; used[j] = 1;
  }
  const remap = new Int32Array(atoms.length).fill(-1);
  const keep = [];
  for (let i = 0; i < atoms.length; i++) if (used[i]) { remap[i] = keep.length; keep.push(atoms[i]); }
  const outB = [];
  let liveCross = 0;
  for (let b = 0; b < liveB.length; b++) {
    outB.push([remap[liveB[b][0]], remap[liveB[b][1]], liveB[b][2]]);
    if (keep[remap[liveB[b][1]]].role === "S") liveCross++;   // 황으로 «들어가는» 결합이 다리마다 하나
  }

  return {
    atoms: keep, bonds: outB, nn: step, rref: step, style: "stick",
    chains: liveChains, crossLinks: liveCross, polymer: true
  };
}

/* 되풀이 단위를 광물마다 같은 크기(L3_CELL)로 맞춘다 — 어느 광물을 골라도
   화면에 같은 횟수만큼 되풀이되어 보이고, 비교 모드에서 좌우 척도가 어긋나지 않는다. */
function makeLattice3D(m, rnd) {
  if (m.id === "copper") return l3Fit(l3Fcc, L3_CELL);
  if (m.id === "iron") return l3Fit(l3Bcc, L3_CELL);
  if (m.id === "halite") return l3Fit(l3RockSalt, L3_CELL);
  if (m.id === "pyrite") return l3Fit(l3Pyrite, L3_CELL);
  if (m.id === "diamond") return l3Fit(l3Diamond, L3_CELL);
  if (m.id === "quartz") return l3Fit(l3Bridged, L3_CELL);
  if (m.id === "ice") return l3Fit(l3Ice, L3_CELL);
  if (m.id === "dryice") return l3Fit(l3DryIce, L3_CELL);
  /* 사슬 고분자 — 결합 길이(step)는 같게 두고 **사슬의 뻣뻣함**과 곁가지 간격만 다르다.
     고무는 사슬이 잘 구부러지고(jitter 큼) 가황 다리가 있으며, 폴리스타이렌은 벤젠 고리가
     사슬의 회전을 막아 뻣뻣하고(jitter 작음) 다리가 없다. 이 차이가 곧 탄성과 취성의 차이다. */
  /* 사슬은 «여러 가닥»이어야 한다 — 가닥이 적으면 타격에서 「위쪽 절반」을 사슬 단위로 가를 때
     비율이 크게 튄다(실측: 10가닥에서 87 %가 한쪽으로 몰렸다). */
  if (m.id === "rubber")
    return l3Chain(rnd, { nChain: 30, nBack: 40, step: 0.13, jitter: 0.95, sideEvery: 4, cross: 44, flat: 0.45 });
  if (m.id === "polystyrene")
    return l3Chain(rnd, { nChain: 30, nBack: 40, step: 0.13, jitter: 0.80, sideEvery: 2, cross: 0, flat: 0.45 });
  return l3Amorphous(rnd);
}

/* ⚠ 아래 두 가지는 토큰으로 바꾸면 안 된다.
   ① 광물의 색은 그 물질의 **실제 겉보기 색**이다 (사이트 테마 색이 아니다).
   ② 원자·이온 색은 CPK 국제 표준을 따른다 (매뉴얼 §4 "값 변경 금지").
      Na #AB5CF2 · Cl #1FF01F · O #FF0D0D · Si (관례) #F0C8A0 · Fe #E06633 · S #FFFF30 · Cu #C88033 · C #404040 · H #FFFFFF
      신규 3종은 C·O·Fe만 쓴다 — 새 CPK 색이 필요 없다(확-14). */
const CPK = {
  Na: "#AB5CF2", Cl: "#1FF01F", O: "#FF0D0D", Si: "#F0C8A0",
  Fe: "#E06633", S: "#FFFF30", Cu: "#C88033", H: "#FFFFFF", C: "#404040"
};
/* 각 광물의 배열에서 자리(s=0,1,…)에 놓이는 입자 */
const SITES = {
  quartz: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }],
  /* Na⁺ 1.02 Å : Cl⁻ 1.81 Å = 0.56 : 1 — 막대를 끈 기본 화면에서 두 이온이 정확히 맞닿는다 */
  halite: [{ sym: "Na⁺", label: "나트륨 이온 Na⁺", cpk: CPK.Na, r: 0.56 }, { sym: "Cl⁻", label: "염화 이온 Cl⁻", cpk: CPK.Cl, r: 1.0 }],
  pyrite: [{ sym: "Fe", label: "철 Fe", cpk: CPK.Fe, r: 1.0 }, { sym: "S", label: "황 S", cpk: CPK.S, r: 0.80 }],
  copper: [{ sym: "Cu", label: "구리 원자 Cu (양이온 + 자유 전자)", cpk: CPK.Cu, r: 1.0 }],
  ice: [{ sym: "O", label: "산소 O (물 분자의 중심)", cpk: CPK.O, r: 1.0 }, { sym: "H", label: "수소 H", cpk: CPK.H, r: 0.50 }],
  obsidian: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }],
  diamond: [{ sym: "C", label: "탄소 C", cpk: CPK.C, r: 1.0 }],
  iron: [{ sym: "Fe", label: "철 Fe (양이온 + 자유 전자)", cpk: CPK.Fe, r: 1.0 }],
  dryice: [{ sym: "C", label: "탄소 C (분자 중심)", cpk: CPK.C, r: 0.66 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.74 }],
  /* 사슬 고분자 — 골격도 곁가지도 **탄소**라 CPK 색이 같다(임의 색을 새로 만들지 않는다).
     곁가지는 크기로 구분한다: 고무의 메틸기는 작고, 폴리스타이렌의 벤젠 고리는 크다.
     가황 다리만 황(CPK 노랑)이라 색으로 구분된다. */
  rubber: [
    { sym: "C", label: "탄소 C — 사슬의 뼈대", cpk: CPK.C, r: 1.0 },
    { sym: "CH₃", label: "곁가지 — 메틸기 CH₃ (공 하나로 줄여 그림)", cpk: CPK.C, r: 0.62 },
    { sym: "S", label: "황 S — 사슬 사이를 잇는 가황 다리", cpk: CPK.S, r: 0.78 }
  ],
  polystyrene: [
    { sym: "C", label: "탄소 C — 사슬의 뼈대", cpk: CPK.C, r: 1.0 },
    { sym: "C₆H₅", label: "곁가지 — 벤젠 고리 C₆H₅ (공 하나로 줄여 그림)", cpk: CPK.C, r: 1.30 }
  ]
};

/* ── 망치 타격(외부 힘) — 계산부 ────────────────────────────────────
   「외부 힘으로 층이 밀리면 어떻게 되는가」를 결합의 종류마다 다르게 계산한다.
   여기 있는 함수는 전부 **순수 함수**다 — DOM 도 전역 가변 상태도 건드리지 않는다.
   화면(UI부)은 이 함수가 돌려준 계획(plan)을 시간에 따라 보간해 그릴 뿐이고,
   검증 스크립트는 이 마커 위쪽만 잘라 Node 에서 같은 함수를 그대로 돌린다(F-1 단일 원천).

   ⚠ 슬립 벡터는 「격자를 보존하는 최소 밀림」이다 — 임의로 고른 값이 아니다.
     암염 (nn,0,0)  : 점 집합은 그대로지만 **자리 종류(Na⁺↔Cl⁻)가 교환**된다.
                      같은 전하가 마주 보게 되는 기하학적 원인이 바로 이것이다.
     구리 (u/2,0,u/2)·철 (u,0,0) : 자리가 한 종류뿐이라 교환이 없다 — 배열이 그대로 유지된다.
     분자 결정      : 층이 미끄러지는 것이 아니라 **분자 덩어리째** 떨어져 나간다(슬립 벡터 없음). */
const STRIKE_MODE = Object.freeze({
  halite: "ion", copper: "metal", iron: "metal", ice: "molecular", dryice: "molecular",
  /* 사슬 고분자 2종은 «다리가 있는가»로 갈린다.
     고무(elastic)   — 가황 다리가 사슬들을 하나의 그물로 묶어 두어, 갈라지지 않고 되돌아온다.
     폴리스타이렌(brittle) — 다리가 없어 금이 벌어지고, 갈라지는 자리에서 사슬이 뽑혀 길게
       늘어난다. 실제 폴리스타이렌이 깨질 때 나타나는 «크레이즈»가 그 모습이다.
     분자 결정(molecular)의 «조각내기»를 쓰지 않는 이유: 사슬은 서로 얽혀 있어 조각으로 갈라
       놓으면 사슬끼리 뚫고 지나간다(실측 — 21표본 중 18표본에서 공이 겹쳤다). */
  rubber: "elastic", polystyrene: "brittle"
});

/* 격자를 자기 자신으로 옮기는 최소 병진. 분자 결정은 없다(null). */
function strikeSlipVec(l3, mnrId) {
  if (mnrId === "halite") return [l3.nn, 0, 0];
  if (mnrId === "copper") return [l3.cell / 2, 0, l3.cell / 2];
  if (mnrId === "iron") return [l3.cell, 0, 0];
  return null;
}

/* 공 반지름의 기준 길이 — drawLattice3D 가 쓰던 식을 인자로 받는 순수 함수로 옮긴 것이다.
   nbOn(최근접 이웃 막대 표시)에 따라 값이 달라지므로 반드시 인자로 받는다.
   striking=true(타격 중인 이온 결정)면 공간 채움(fill)을 쓰지 않고 **공-막대 반지름**으로 줄인다 —
   슬립으로 같은 전하가 0.27 거리까지 다가오는데 공간 채움 반지름이면 두 공이 20 % 겹쳐
   붉은 반발 점선이 공 속에 파묻힌다. 줄여 그린다는 사실은 캡션과 「가정과 한계」 ⑧에 적는다. */
function strikeRenderRadiusUnit(l3, nbOn, striking) {
  return (l3.fill && !nbOn && striking !== true)
    ? l3.fill
    : (l3.style === "pack" ? l3.nn * 0.48 : l3.rref * 0.32);
}

/* 타격 계획 — 무엇이 움직이고, 어느 쌍이 반발하고, 어느 연결이 끊기는가.
   반환 { mode, planeY, moved, slipVec, repelPairs, brokenBonds, clusterOf, clusterOffsets }
     moved         — Uint8Array(원자 수). 1이면 외부 힘에 밀려 움직이는 원자
     repelPairs    — [[아래 원자, 위 원자], …] 슬립 후 같은 전하가 마주 보는 쌍(이온만)
     brokenBonds   — l3.bonds 의 **번호** 목록. 경계를 가로지르던 이웃 표시·분자 사이 힘.
                     분자 **안**의 공유 결합("in")은 절대 들어가지 않는다
     clusterOf     — Int32Array(원자 수). 분자 결정에서 떨어져 나가는 조각 번호(0~2), 아니면 −1
     clusterOffsets— 조각별 이동 방향 */
function strikePlan(l3, mnrId) {
  const mode = STRIKE_MODE[mnrId];
  if (!mode) return null;
  const atoms = l3.atoms, N = atoms.length, nn = l3.nn;
  const moved = new Uint8Array(N);
  const slipVec = strikeSlipVec(l3, mnrId);
  const repelPairs = [], brokenBonds = [];
  let planeY = 0, clusterOf = null, clusterOffsets = null;

  if (mode === "molecular" || mode === "elastic" || mode === "brittle") {
    /* 분자 중심(그 분자에 속한 원자들의 평균 자리)이 슬립면 위면 그 분자의 원자 전부가 움직인다 —
       분자를 원자 단위로 자르지 않기 위해서다. 분자 안의 공유 결합은 어떤 경우에도 끊기지 않는다.
       고분자에서는 «사슬 하나»가 곧 분자 하나이므로(mol = 사슬 번호) 사슬이 통째로 움직인다. */
    planeY = 0;
    const sx = new Map(), sy = new Map(), cn = new Map();
    for (let i = 0; i < N; i++) {
      const m = atoms[i].mol;
      sx.set(m, (sx.get(m) || 0) + atoms[i].x);
      sy.set(m, (sy.get(m) || 0) + atoms[i].y);
      cn.set(m, (cn.get(m) || 0) + 1);
    }
    const mols = [];
    for (const [m, c] of cn) mols.push({ mol: m, x: sx.get(m) / c, y: sy.get(m) / c });
    mols.sort((a, b) => a.mol - b.mol);
    const movedMols = mols.filter(o => o.y > planeY);
    if (mode === "elastic" || mode === "brittle") {
      /* 사슬 고분자 — 조각으로 나누지 않는다(얽힌 사슬은 조각내면 서로를 뚫고 지나간다).
         움직이는 범위만 사슬 단위로 표시해 두고, 실제 좌표 규칙은 strikeOffsetsAt 이 정한다. */
      const pick = new Set();
      for (let t = 0; t < movedMols.length; t++) pick.add(movedMols[t].mol);
      for (let i = 0; i < N; i++) if (pick.has(atoms[i].mol)) moved[i] = 1;
      return { mode, planeY, moved, slipVec, repelPairs, brokenBonds, clusterOf, clusterOffsets };
    }
    /* 조각 나누기 — 중심 x 로 정렬한 뒤 **개수**를 삼등분한다.
       x 범위를 삼등분하면 가운데 조각의 크기가 격자 위상에 따라 크게 흔들린다(판정 불안정). */
    movedMols.sort((a, b) => (a.x - b.x) || (a.mol - b.mol));
    const cluOfMol = new Map();
    const n3 = movedMols.length;
    for (let c = 0; c < 3; c++) {
      const lo = Math.floor(c * n3 / 3), hi = Math.floor((c + 1) * n3 / 3);
      for (let t = lo; t < hi; t++) cluOfMol.set(movedMols[t].mol, c);
    }
    clusterOf = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      const c = cluOfMol.get(atoms[i].mol);
      if (c === undefined) continue;
      moved[i] = 1; clusterOf[i] = c;
    }
    clusterOffsets = [
      [-0.9 * nn, 0.5 * nn, 0],
      [0, 0.5 * nn, 0],
      [0.9 * nn, 0.5 * nn, 0]
    ];
  } else {
    /* 이온·금속 — 슬립면 위 절반이 통째로 밀린다. 면은 층과 층 **사이**에 둔다(메시에서 유도). */
    planeY = nn / 2;
    for (let i = 0; i < N; i++) if (atoms[i].y > planeY) moved[i] = 1;
  }

  if (mode === "ion") {
    /* 완전히 밀린 뒤의 자리에서, 경계를 가로질러 맞닿는 쌍을 찾는다.
       슬립 전에는 이 쌍이 전부 이종(+/−)이고, 슬립 후에는 전부 동종이 된다 — 그것이 반발의 원인이다. */
    const lim = nn * 1.05, lim2 = lim * lim;
    const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      px[i] = atoms[i].x + (moved[i] ? slipVec[0] : 0);
      py[i] = atoms[i].y + (moved[i] ? slipVec[1] : 0);
      pz[i] = atoms[i].z + (moved[i] ? slipVec[2] : 0);
    }
    /* 슬립은 수평이므로 면에서 lim 보다 멀리 있는 원자는 어느 쌍에도 들어갈 수 없다 */
    const lowIdx = [], highIdx = [];
    for (let i = 0; i < N; i++) {
      if (Math.abs(atoms[i].y - planeY) > lim) continue;
      (moved[i] ? highIdx : lowIdx).push(i);
    }
    for (let a = 0; a < lowIdx.length; a++) {
      const i = lowIdx[a];
      for (let b = 0; b < highIdx.length; b++) {
        const j = highIdx[b];
        const dx = px[i] - px[j], dy = py[i] - py[j], dz = pz[i] - pz[j];
        if (dx * dx + dy * dy + dz * dz > lim2) continue;
        if (atoms[i].s !== atoms[j].s) continue;      // 같은 전하끼리만 반발한다
        repelPairs.push([i, j]);
      }
    }
  }

  /* 끊어지는 연결 — 경계를 가로지르던 것만. 분자 안의 공유 결합("in")은 넣지 않는다.
     층이 밀리거나 조각이 갈라지기 시작하면 그 경계를 가로지르던 이웃 관계·분자 사이 힘은
     더 이상 작용하지 않는다. 조각 **안쪽**의 힘은 그대로 남아 "표면에서만 끊어지고 속은 붙어 있다"가 된다. */
  const grp = i => (moved[i] ? (clusterOf ? clusterOf[i] : 0) : -1);
  for (let b = 0; b < l3.bonds.length; b++) {
    const bd = l3.bonds[b];
    if (bd[2] === "in") continue;
    if (grp(bd[0]) !== grp(bd[1])) brokenBonds.push(b);
  }

  return { mode, planeY, moved, slipVec, repelPairs, brokenBonds, clusterOf, clusterOffsets };
}

/* 한 순간의 원자 오프셋 — 「어느 진행에서 원자가 어디에 있는가」의 **단일 원천**(F-1).
   시간을 진행값(slipP·splitP·crumbleP)으로 바꾸는 일은 화면(UI부)이 하고,
   진행값을 좌표로 바꾸는 규칙은 여기 하나뿐이다. 검증 스크립트도 이 함수를 그대로 호출해
   대조한다 — 스크립트가 같은 식을 따로 적어 두면 「자기 자신과의 대조」가 되어 아무것도
   검사하지 못한다(원칙 11 · S-검토 B B-5).

   ⚠ 아치 들림 — 슬립 **중간**에는 밀리는 층이 `0.25·nn·sin(π·slipP)` 만큼 들렸다가 내려온다.
     끝점(진행 0·1)에서 sin 이 0 이므로 격자 보존 검산(정합 307/307·151/151)은 그대로 성립하고,
     중간 프레임에서만 두 층이 서로 **타고 넘는다**. 넣지 않으면 진행 0.10~0.90 내내
     구리 132쌍(최대 침투 9.8 %)·철 60쌍(14.9 %)이 겹친 공으로 화면에 나온다
     (S-검토 B A-1 실측 · 매뉴얼 4부 ⑱). 물리적으로도 층은 서로를 뚫고 가지 않는다. */
const STRIKE_SPLIT_GAP = 0.8;   // 쪼개진 두 조각이 벌어지는 간격(최근접 이웃 거리의 배수)
const STRIKE_ARCH = 0.25;       // 슬립 중 들림 높이(최근접 이웃 거리의 배수)
const STRIKE_STRETCH = 0.35;    // 고무가 당겨질 때 세로로 늘어나는 «비율»(높이에 비례)
const STRIKE_CRACK = 0.80;      // 폴리스타이렌에서 금 위쪽이 벌어지는 «비율»(높이에 비례)
function strikeOffsetsAt(l3, plan, slipP, splitP, crumbleP, out) {
  const N = l3.atoms.length, nn = l3.nn;
  const offs = (out && out.length >= N * 3) ? out : new Float64Array(N * 3);
  offs.fill(0, 0, N * 3);
  if (!plan) return offs;
  const mv = plan.moved;
  if (plan.mode === "elastic") {
    /* 고무 — 덩어리 «전체»가 세로로 고르게 늘어난다(affine 변형). 실제 고무도 당기면
       전 구간이 비례해 늘어나므로 물리적으로 옳고, 화면에서도 안전하다: 세로 간격이
       «벌어지기만» 하므로 두 원자가 가까워지는 일이 원리적으로 없다(겹침 0 보장).
       위쪽 절반만 통째로 들어올리는 방식은 얽힌 사슬이 서로를 뚫고 지나가 쓸 수 없었다.
       slipP 0 에서 오프셋이 정확히 0 이라 「되돌아옴」이 좌표로 보장된다. */
    const k = STRIKE_STRETCH * slipP, A = l3.atoms;
    for (let i = 0; i < N; i++) offs[i * 3 + 1] = A[i].y * k;
    return offs;
  }
  if (plan.mode === "brittle") {
    /* 폴리스타이렌 — 금(y = 0)이 벌어진다. 금 «위쪽»만 높이에 비례해 올라가므로 위로 갈수록
       크게 벌어지는 쐐기 모양 틈이 생기고, 갈라지는 자리에서는 사슬이 뽑혀 길게 늘어난다
       (실제 폴리스타이렌이 깨질 때의 «크레이즈»가 그 모습이다).
       위쪽 원자는 높은 것이 더 많이 움직이고 아래쪽은 가만히 있으므로, 두 원자의 세로 간격은
       벌어지기만 한다 — 조각으로 갈라 놓을 때 생기던 «사슬끼리 관통»이 원리적으로 없다. */
    const k = STRIKE_CRACK * (crumbleP > 0 ? crumbleP : slipP), A = l3.atoms;
    for (let i = 0; i < N; i++) if (A[i].y > 0) offs[i * 3 + 1] = A[i].y * k;
    return offs;
  }
  if (crumbleP > 0) {
    const co = plan.clusterOffsets, cf = plan.clusterOf;
    for (let i = 0; i < N; i++) {
      if (!mv[i]) continue;
      const o = co[cf[i]];
      offs[i * 3] = o[0] * crumbleP; offs[i * 3 + 1] = o[1] * crumbleP; offs[i * 3 + 2] = o[2] * crumbleP;
    }
  } else if (slipP > 0 || splitP > 0) {
    const v = plan.slipVec;
    const up = STRIKE_SPLIT_GAP * nn * splitP + STRIKE_ARCH * nn * Math.sin(Math.PI * slipP);
    for (let i = 0; i < N; i++) {
      if (!mv[i]) continue;
      offs[i * 3] = v[0] * slipP; offs[i * 3 + 1] = v[1] * slipP + up; offs[i * 3 + 2] = v[2] * slipP;
    }
  }
  return offs;
}

/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), ink: CSSV("--t1"),
  gray: CSSV("--d-gray"), t3: CSSV("--t3"), stageLight: CSSV("--stage-light"),
  green: CSSV("--d-green"), red: CSSV("--d-red"), violet: CSSV("--d-violet"),
  cyan: CSSV("--d-cyan")
};

let mineral = MIN.LIST[0];
let zoomV = 0;
let lattice = null;        // 폴백(2D)용
let lat3 = null;           // 확대 뷰(3D 공-막대)용
let picked = -1;
/* 최근접 이웃 막대(암염·황철석) — **기본은 끈다.**
   이온 사이의 막대는 방향이 정해진 결합봉처럼 읽혀 "NaCl 분자"라는 오개념을 만든다.
   기본 화면은 이온이 맞닿은 공간 채움이고, 필요한 사람만 직접 켠다. */
let showNb = false;
/* 단위 세포 테두리 — 「심화」에서만 켠다(교육과정 범위 밖). */
let showCell = false;
let spin = 0, tilt = -0.42, spinning = true;
/* 씨앗 고정 난수 — 흑요석의 "규칙 없음"을 만들 때만 쓴다(누가 열어도 같은 그림).
   ⚠ 예전 식 (seed*1103515245+12345)&0x7fffffff 은 자바스크립트에서 곱이 2⁵³을 넘어
     아래 자리가 잘려 나가 짧은 주기에 갇혔다. 자리 수가 수백 개로 늘어난 지금은
     그 결함이 그대로 "자리가 더 이상 놓이지 않는" 현상으로 드러나므로 32비트
     정수 연산(Math.imul)만 쓰는 mulberry32 로 바꾼다. */
let rndSeed = 20260731 >>> 0;
const rnd = () => {
  rndSeed = (rndSeed + 0x6D2B79F5) >>> 0;
  let t = rndSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ── 비교 모드 상태 ── */
let cmpOn = false;
let mineralL = mById("quartz"), mineralR = mById("obsidian");
let latticeL = null, latticeR = null;
let lat3L = null, lat3R = null;
let pickedL = -1, pickedR = -1;

const PRESETS = [
  { label: "석영 ↔ 흑요석", l: "quartz", r: "obsidian", note: "결정 ↔ 비결정" },
  { label: "얼음 ↔ 드라이아이스", l: "ice", r: "dryice", note: "분자 결정 2종 — 수소 결합 ↔ 분산력" },
  { label: "구리 ↔ 철", l: "copper", r: "iron", note: "금속 결정 2종 — 쌓인 방식" },
  { label: "석영 ↔ 다이아몬드", l: "quartz", r: "diamond", note: "공유 결정 2종" },
  { label: "암염 ↔ 드라이아이스", l: "halite", r: "dryice", note: "이온 ↔ 분자 — 결합 유형 교차 대비" },
  { label: "흑요석 ↔ 고무", l: "obsidian", r: "rubber", note: "비결정 2종 — 불규칙한 그물 ↔ 엉킨 사슬" },
  { label: "고무 ↔ 플라스틱", l: "rubber", r: "polystyrene", note: "사슬 고분자 2종 — 다리가 있다 ↔ 없다" }
];

/* ============================================================
   WebGL 프로그램 ① — 광물 표본 (거시)
   구·정육면체·육각기둥·팔면체·둥근육면체·불규칙 조각을 광선행진으로 그리고
   금속성·거칠기·투명도를 준다. 연속 줌: zoomScale 로 물체를 카메라 쪽으로
   "키우면서" 표면 결 주파수를 함께 올려 배율에 따라 연속으로 바뀌게 한다.
   확대가 더 진행되면 bgMix 로 무대 바탕색에 서서히 묻히고, 그 위에 프로그램 ②의
   공-막대 모형이 떠오른다 — 3차원에서 3차원으로 이어지며 평면 그림으로 바뀌지 않는다.
   ⚠ 실제 광물 사진이 아니라 **재질을 흉내 낸 그림**이다.
   ============================================================ */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }`;
const FRAG = `precision highp float;
varying vec2 uv;
uniform vec2 res; uniform float time; uniform float spin; uniform float tilt;
uniform vec3 base; uniform float metal; uniform float rough; uniform float opac;
uniform float shape;   // 0=cube 1=prism 2=blob 3=octa 4=rcube 5=chunk 6=chip
uniform float grain;   // 표면 거칠기(광택 반대)
uniform float zoomScale;  // 연속 줌 — 1(=배율 0)~4(=배율 55 이상)
uniform float maxSteps;   // 저사양 강하 시 광선행진 반복 수를 줄인다
uniform float bgMix;      // 확대가 진행되면 무대 바탕색에 묻힌다(0~1)
uniform vec3 stageBg;     // 무대 바탕색(토큰)

float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z);
}
mat3 roty(float a){ float c=cos(a), s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotx(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }

float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r; }
float sdOcta(vec3 p, float s){ p=abs(p); float m=p.x+p.y+p.z-s; return m*0.57735027; }
float sdHexPrism(vec3 p, vec2 h){
  const vec3 k = vec3(-0.8660254,0.5,0.57735);
  p = abs(p);
  p.xz -= 2.0*min(dot(k.xy,p.xz),0.0)*k.xy;
  vec2 d = vec2(length(p.xz-vec2(clamp(p.x,-k.z*h.x,k.z*h.x),h.x))*sign(p.z-h.x), p.y-h.y);
  return min(max(d.x,d.y),0.0)+length(max(d,0.0));
}
float sdBlob(vec3 p){
  float d = length(p)-0.72;
  d += 0.10*sin(p.x*4.5)*sin(p.y*4.0)*sin(p.z*4.2);
  d += 0.05*sin(p.x*9.0+1.0)*sin(p.z*8.0);
  return d;
}
float sdChunk(vec3 p){
  /* 드라이아이스 — 각진 조각. 상자에 낮은 진폭 노이즈만 더해 모서리는 살리고
     표면만 서리질로 흔든다(조개껍데기형 곡면 blob과는 다른 인상). */
  float d = sdBox(p, vec3(0.58,0.54,0.60));
  d += 0.045*sin(p.x*6.4+1.3)*sin(p.y*5.3)*sin(p.z*6.1+0.6);
  return d;
}
float sdChip(vec3 p){
  /* 흑요석 — 조개껍데기형 깨짐면(conchoidal fracture). blob을 기본으로 하되
     동심 곡선 결을 강하게 넣어 매끈한 조가비 무늬가 표면에 드러나게 한다. */
  float d = length(p)-0.70;
  d += 0.09*sin(length(p.xy)*10.0 - p.z*3.0);
  d += 0.05*sin(p.x*7.0+0.6)*sin(p.z*6.0);
  return d;
}
float map(vec3 p){
  float zs = max(zoomScale, 0.0001);
  vec3 q = p / zs;
  float d;
  if (shape < 0.5) d = sdBox(q, vec3(0.60));
  else if (shape < 1.5) d = sdHexPrism(q, vec2(0.52, 0.72));
  else if (shape < 2.5) d = sdBlob(q);
  else if (shape < 3.5) d = sdOcta(q, 0.78);
  else if (shape < 4.5) d = sdRoundBox(q, vec3(0.52), 0.10);
  else if (shape < 5.5) d = sdChunk(q);
  else d = sdChip(q);
  return d * zs;
}
vec3 nrm(vec3 p){
  vec2 e = vec2(0.0012,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
}
void main(){
  vec2 q = (uv-0.5)*vec2(res.x/res.y,1.0)*2.4;
  /* 배경 — 실험대 위 */
  vec3 col = mix(vec3(0.88,0.89,0.91), vec3(0.975,0.978,0.984), smoothstep(-1.0,1.0,q.y));
  col = mix(col, vec3(0.80,0.77,0.72), smoothstep(-0.55,-1.2,q.y));

  vec3 ro = vec3(0.0,0.0,3.0), rd = normalize(vec3(q, -2.6));
  mat3 R = roty(spin)*rotx(tilt);
  float t=0.0; bool hit=false; vec3 pp;
  for(int i=0;i<80;i++){
    if(float(i) >= maxSteps) break;
    pp = R*(ro + rd*t);
    float d = map(pp);
    if(d < 0.0016){ hit=true; break; }
    t += d*0.85;
    if(t > 6.0) break;
  }
  if(hit){
    /* 법선은 **물체 좌표계**에서 나온다. 조명은 세상 좌표계에 고정돼 있어야
       표본을 돌려도 빛이 함께 돌지 않는다. 회전 행렬의 역행렬로 되돌린다.
       (회전 행렬이므로 역행렬 = 전치. GLSL ES 1.0 에는 transpose() 가 없어 직접 만든다) */
    mat3 Rinv = rotx(-tilt) * roty(-spin);
    vec3 n = normalize(Rinv * nrm(pp));
    vec3 L = normalize(vec3(-0.45,0.78,0.60));
    vec3 V = normalize(-rd);
    vec3 H = normalize(L+V);
    float dif = max(dot(n,L),0.0);
    float spe = pow(max(dot(n,H),0.0), mix(12.0, 90.0, 1.0-rough));
    float fres = pow(1.0-max(dot(n,V),0.0), 3.0);
    /* 표면 결 — 거칠수록 얼룩덜룩. 줌이 커질수록 결의 공간 주파수를 높여
       "가까이 다가갈수록 표면이 더 자세히 보인다"는 연속감을 준다 */
    float gf = mix(11.0, 34.0, clamp((zoomScale-1.0)/3.0, 0.0, 1.0));
    float g = noise(pp*gf)*0.62 + noise(pp*gf*2.6)*0.38;
    vec3 alb = base * (1.0 - grain*0.45 + grain*0.9*g);
    /* 반사광(하늘·실험대에서 되돌아오는 빛)까지 넣어야 그늘진 면이 새까매지지 않는다 */
    float bounce = max(dot(n, normalize(vec3(0.4,-0.85,0.3))), 0.0);
    vec3 c = alb*(0.34 + 0.72*dif + 0.16*bounce);
    c += mix(vec3(1.0), alb*1.8, metal) * spe * mix(0.40, 1.45, metal);
    c += fres * mix(0.28, 0.14, metal);
    /* 투명한 광물은 뒤가 비친다 */
    if(opac < 0.95){
      vec3 bg = mix(vec3(0.88,0.89,0.91), vec3(0.975,0.978,0.984), smoothstep(-1.0,1.0,q.y+0.25));
      float band = smoothstep(0.42,0.5,abs(fract((q.x - n.x*0.35)*4.0)-0.5));
      bg = mix(bg, vec3(0.55,0.63,0.74), band*0.30);
      c = mix(bg*alb, c, opac + 0.45);
    }
    col = c;
  }
  /* 아래 그림자 — 표본 바로 밑에 붙여 떠 있어 보이지 않게 */
  float sh = smoothstep(0.85,0.0,length(vec2(q.x*0.80,(q.y+0.78)*2.2)));
  if(!hit) col = mix(col, col*0.62, sh*0.70);
  /* 확대가 진행되면 표본 그림을 무대 바탕색에 묻힌다 — 그 위에 공-막대 모형이 떠오른다 */
  col = mix(col, stageBg, clamp(bgMix,0.0,1.0));
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}`;

/* ============================================================
   WebGL 프로그램 ② — 확대 뷰의 3차원 공-막대 모형
   공은 화면을 향한 사각형에 구의 법선을 계산해 그린다(임포스터). 막대는 두 원자를
   잇는 띠에 원기둥 음영을 준다. 둘 다 카메라에서 먼 것부터 그려(화가 알고리즘)
   앞뒤가 제대로 가려진다 — WebGL 1 에는 조각별 깊이 쓰기가 없기 때문이다.
   ============================================================ */
const VERT3 = `attribute vec3 aPos; attribute vec2 aLocal; attribute vec3 aCol;
attribute vec3 aPerp; attribute vec3 aParam;
uniform mat4 uProj;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
void main(){
  vLocal = aLocal; vCol = aCol; vPerp = aPerp; vParam = aParam;
  gl_Position = uProj * vec4(aPos, 1.0);
}`;
/* vParam.z — 이 입자 하나의 진하기(0~1). 화면 가운데는 1, 가장자리로 갈수록 0에
   가까워져 배열이 "끝난" 것이 아니라 "흐려지며 계속되는" 것으로 보이게 한다. */
const FRAG3 = `precision mediump float;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
uniform float uAlpha;
uniform vec3 uLight;
void main(){
  float kind = vParam.x;        // 0=공 1=막대(실선) 2=막대(점선)
  vec3 n; float edge = 1.0;
  if (kind < 0.5) {
    float r2 = dot(vLocal, vLocal);
    if (r2 > 1.0) discard;
    n = vec3(vLocal, sqrt(max(0.0, 1.0 - r2)));
    edge = mix(1.0, 0.58, smoothstep(0.78, 1.0, sqrt(r2)));   // 가장자리를 어둡게 — 밝은 무대에서 흰 원자가 사라지지 않게
  } else {
    if (kind > 1.5) {
      float t = (vLocal.x * 0.5 + 0.5) * vParam.y;
      if (fract(t) > 0.5) discard;                            // 점선 — 분자 사이의 힘
    }
    float y = clamp(vLocal.y, -0.999, 0.999);
    n = normalize(vPerp * y + vec3(0.0, 0.0, 1.0) * sqrt(1.0 - y*y));
    edge = mix(1.0, 0.66, smoothstep(0.72, 1.0, abs(y)));
  }
  float dif = max(dot(n, uLight), 0.0);
  float amb = 0.34 + 0.13 * max(n.y, 0.0);
  vec3 h = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float spe = pow(max(dot(n, h), 0.0), 26.0);
  vec3 c = vCol * (amb + 0.74 * dif) * edge + vec3(1.0) * spe * 0.30;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), uAlpha * vParam.z);
}`;

const gcv = $("gl");
let gl = null, prog = null, U = {}, quadBuf = null, aP = -1;
let prog3 = null, U3 = {}, A3 = {}, vbo3 = null, ibo3 = null;

function compile(src, ty) {
  const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}
function link(vsSrc, fsSrc) {
  const vs = compile(vsSrc, gl.VERTEX_SHADER), fs = compile(fsSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
  return p;
}
function initGL() {
  gl = gcv.getContext("webgl", { antialias: true, alpha: false }) || gcv.getContext("experimental-webgl");
  if (!gl) { $("glFallback").style.display = "block"; return false; }
  prog = link(VERT, FRAG);
  prog3 = link(VERT3, FRAG3);
  if (!prog || !prog3) { $("glFallback").style.display = "block"; gl = null; return false; }

  quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  aP = gl.getAttribLocation(prog, "p");
  for (const n of ["res", "time", "spin", "tilt", "base", "metal", "rough", "opac", "shape",
                   "grain", "zoomScale", "maxSteps", "bgMix", "stageBg"])
    U[n] = gl.getUniformLocation(prog, n);

  vbo3 = gl.createBuffer(); ibo3 = gl.createBuffer();
  for (const n of ["uProj", "uAlpha", "uLight"]) U3[n] = gl.getUniformLocation(prog3, n);
  for (const n of ["aPos", "aLocal", "aCol", "aPerp", "aParam"]) A3[n] = gl.getAttribLocation(prog3, n);
  return true;
}
function shapeNum(s) {
  return { cube: 0, prism: 1, blob: 2, octa: 3, rcube: 4, chunk: 5, chip: 6 }[s] ?? 2;
}
/* 표본은 크로스페이드가 끝나는 지점(70)까지 계속 커진다 — 55에서 멈춰 버리면
   그 구간에서 "다가가는 느낌"이 끊긴다. 70을 넘으면 표본은 이미 다 지워진 뒤다. */
function zoomScaleFor(z) { return 1 + Math.min(Math.max(z, 0), ZOOM_BLEND_END) / ZOOM_BLEND_END * 4.2; }
/* 확대 뷰의 모형 크기.
   ★ 예전에는 0.42에서 시작해 작은 덩어리가 화면 한가운데 떠 있었다. 이제는 크로스페이드가
     시작될 때 이미 **화면을 가득 채우는 크기**로 들어와, 배열이 화면 밖으로 이어져 보인다.
     (1.15 → 1.45. 끝까지 확대해도 되풀이 단위가 세로로 3회 이상 보인다.) */
function latScaleFor(z) {
  const t = Math.min(Math.max((z - ZOOM_BLEND_START) / (100 - ZOOM_BLEND_START), 0), 1);
  return 1.15 + t * 0.30;
}

function hexToRgb01(hex) {
  const s = hex.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map(c => c + c).join("") : s, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
const STAGE_RGB = hexToRgb01(C.stageLight || "#f6f8fa");

function drawOneGL(m, x, y, w, h) {
  gl.viewport(x, y, w, h);
  gl.scissor(x, y, w, h);
  gl.uniform2f(U.res, w, h);
  gl.uniform1f(U.time, spin);
  gl.uniform1f(U.spin, spin);
  gl.uniform1f(U.tilt, tilt);
  gl.uniform3f(U.base, m.color[0], m.color[1], m.color[2]);
  gl.uniform1f(U.metal, m.metal);
  gl.uniform1f(U.rough, m.rough);
  gl.uniform1f(U.opac, m.opacity);
  gl.uniform1f(U.shape, shapeNum(m.shape));
  /* 표면 얼룩 — 기본은 「비결정성이면 거칠게」이지만, 종이 스스로 값을 갖고 있으면 그것을 쓴다
     (폴리스타이렌은 비결정성이면서도 표면이 매끈하다). 기존 9종은 grain 필드가 없어 그대로다. */
  gl.uniform1f(U.grain, m.grain !== undefined ? m.grain : (m.kind === "비결정성" ? 0.55 : 0.30));
  gl.uniform1f(U.zoomScale, zoomScaleFor(zoomV));
  gl.uniform1f(U.maxSteps, raySteps);
  gl.uniform1f(U.bgMix, Math.min(1, blend(zoomV) * 1.18));
  gl.uniform3f(U.stageBg, STAGE_RGB[0], STAGE_RGB[1], STAGE_RGB[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ── 확대 뷰(3D) — 정점 만들기 ──────────────────────────────── */
const FPV = 14;                       // 정점 하나가 쓰는 float 수 (마지막 하나는 진하기)
let vArr = new Float32Array(0), iArr = new Uint16Array(0);
let vHead = 0, iHead = 0, primCount = 0;
function ensureCap(prims) {
  const needV = prims * 4 * FPV, needI = prims * 6;
  if (vArr.length < needV) vArr = new Float32Array(Math.ceil(needV * 1.6));
  if (iArr.length < needI) iArr = new Uint16Array(Math.ceil(needI * 1.6));
}
function putVert(px, py, pz, lx, ly, cr, cg, cb, ex, ey, ez, kind, dash, fade) {
  const o = vHead;
  vArr[o] = px; vArr[o + 1] = py; vArr[o + 2] = pz;
  vArr[o + 3] = lx; vArr[o + 4] = ly;
  vArr[o + 5] = cr; vArr[o + 6] = cg; vArr[o + 7] = cb;
  vArr[o + 8] = ex; vArr[o + 9] = ey; vArr[o + 10] = ez;
  vArr[o + 11] = kind; vArr[o + 12] = dash; vArr[o + 13] = fade;
  vHead += FPV;
}
function quadIndices() {
  const b = primCount * 4;
  iArr[iHead] = b; iArr[iHead + 1] = b + 1; iArr[iHead + 2] = b + 2;
  iArr[iHead + 3] = b; iArr[iHead + 4] = b + 2; iArr[iHead + 5] = b + 3;
  iHead += 6; primCount++;
}
function emitSphere(cx, cy, cz, r, col, fade) {
  putVert(cx - r, cy - r, cz, -1, -1, col[0], col[1], col[2], 0, 0, 0, 0, 0, fade);
  putVert(cx + r, cy - r, cz, 1, -1, col[0], col[1], col[2], 0, 0, 0, 0, 0, fade);
  putVert(cx + r, cy + r, cz, 1, 1, col[0], col[1], col[2], 0, 0, 0, 0, 0, fade);
  putVert(cx - r, cy + r, cz, -1, 1, col[0], col[1], col[2], 0, 0, 0, 0, 0, fade);
  quadIndices();
}
function emitStick(ax, ay, az, bx, by, bz, w, col, kind, dash, fade) {
  /* 화면에 놓이는 띠 — 축과 수직인 방향은 시선축(0,0,1)과의 외적으로 잡는다.
     축이 시선과 거의 나란하면(정면에서 본 막대) 띠가 사라지므로 그리지 않는다. */
  const dx = bx - ax, dy = by - ay;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-5) return;
  const ex = dy / L, ey = -dx / L;
  const ox = ex * w, oy = ey * w;
  putVert(ax + ox, ay + oy, az, -1, 1, col[0], col[1], col[2], ex, ey, 0, kind, dash, fade);
  putVert(bx + ox, by + oy, bz, 1, 1, col[0], col[1], col[2], ex, ey, 0, kind, dash, fade);
  putVert(bx - ox, by - oy, bz, 1, -1, col[0], col[1], col[2], ex, ey, 0, kind, dash, fade);
  putVert(ax - ox, ay - oy, az, -1, -1, col[0], col[1], col[2], ex, ey, 0, kind, dash, fade);
  quadIndices();
}

/* ── "그릴 것" 목록 ────────────────────────────────────────────────
   종류 0=원자, 1=막대(실선·공유 결합), 2=막대(점선·분자 사이), 3=막대(최근접 이웃 표시).
   ★ 원자 번호별로 **이어 붙여** 담는다. 그래야 화면 밖 원자를 걸러낼 때 그 원자의 막대까지
     한 번에 건너뛸 수 있다 — 원자 수가 수천 개로 늘어난 지금은 목록 전체를 매 프레임
     훑는 방식으로는 감당이 되지 않는다.
     _ps[i] ~ _ps[i+1] 이 원자 i 가 책임지는 구간(자기 공 하나 + 자기에게서 뻗는 막대들). */
function primsOf(l3) {
  if (l3._pk) return;
  const N = l3.atoms.length, deg = new Int32Array(N);
  for (const b of l3.bonds) { deg[b[0]]++; deg[b[1]]++; }
  const ps = new Int32Array(N + 1);
  let acc = 0;
  for (let i = 0; i < N; i++) { ps[i] = acc; acc += 1 + deg[i]; }
  ps[N] = acc;
  const pk = new Uint8Array(acc), pa = new Int32Array(acc), pb = new Int32Array(acc);
  const cur = new Int32Array(N);
  for (let i = 0; i < N; i++) { const o = ps[i]; pk[o] = 0; pa[o] = i; pb[o] = -1; cur[i] = o + 1; }
  for (const b of l3.bonds) {
    const i = b[0], j = b[1], kind = b[2];
    const k = kind === "hb" ? 2 : (kind === "nb" ? 3 : 1);
    let o = cur[i]++; pk[o] = k; pa[o] = i; pb[o] = j;
    o = cur[j]++; pk[o] = k; pa[o] = j; pb[o] = i;
  }
  l3._pk = pk; l3._pa = pa; l3._pb = pb; l3._ps = ps;
}
const COL_CACHE = {};
function colOf(mnr, s) {
  const site = SITES[mnr.id][Math.min(s, SITES[mnr.id].length - 1)];
  const key = site.cpk;
  if (!COL_CACHE[key]) COL_CACHE[key] = hexToRgb01(key);
  return COL_CACHE[key];
}
function siteOf(mnr, s) { const arr = SITES[mnr.id]; return arr[Math.min(s, arr.length - 1)]; }

/* 카메라를 멀리 두고 화각을 좁힌다(거의 평행 투영).
   ★ 예전 값(3.35 / 0.72)은 덩어리가 작을 때는 괜찮았지만, 배열을 화면 밖까지 넓힌 지금은
     카메라 쪽으로 튀어나온 앞줄 입자가 5배 넘게 부풀어 화면을 덮어 버린다.
     tan(FOVY/2)·CAM_Z 는 그대로 1.261 이라 화면에 담기는 범위(틀)는 예전과 같다. */
const CAM_Z = 9.0, FOVY = 0.2788;
const PROJ = new Float32Array(16);
function persp(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}
const BLUE_RGB = hexToRgb01(C.blue || "#2563eb");
/* 단위 세포 테두리 색 — CPK 색(보라 Na·초록 Cl·빨강 O·주황 Fe·노랑 S…) 어느 것과도
   겹치지 않는 짙은 청록을 쓴다. 입자 색으로 오해되면 안 된다. */
const CELL_RGB = hexToRgb01(C.cyan || "#0f5c8c");
let vpBuf = new Float32Array(0);      // 원자의 시점 좌표
let fadeBuf = new Float32Array(0);    // 원자별 진하기(화면 가장자리로 갈수록 0)
let zBuf = new Float32Array(0);       // 그릴 것들의 깊이
let aBuf = new Float32Array(0);       // 그릴 것들의 진하기
let primBuf = null;                   // 그릴 것들의 목록 번호
let ordBuf = null;                    // 깊이 순서

/* ── 화면 가장자리 지우기(비네트) ─────────────────────────────────
   화면 좌표(정규화 −1~1)에서 중심으로부터의 거리 rn 로 진하기를 정한다.
   거리는 max(|x|,|y|) 로 잰다 — 화면 틀과 같은 네모 모양으로 흐려져 네 변이 고르게 옅어지고,
   모서리만 뻥 뚫리지 않는다. rn ≤ FADE_IN 이면 그대로, FADE_OUT 이면 0.
   화면 네 변(rn=1)에서는 아직 0.5 쯤 남아 있어 배열이 **화면 밖으로 이어지는 것처럼** 보인다.
   모형 좌표가 아니라 화면 좌표로 재는 이유 — 화면이 가로로 길어도 네 변이 고르게 흐려진다. */
const FADE_IN = 0.45, FADE_OUT = 1.35;
/* 시선 방향(깊이)으로도 같은 식으로 지운다 — 뒤쪽 층이 끝없이 겹쳐 보이면
   배열이 아니라 얼룩으로 읽힌다. 화면 세로 절반 길이를 1로 잰 값이다. */
const DEPTH_IN = 0.35, DEPTH_OUT = 0.95;
const PICK_MIN = 0.55;                // 이만큼 선명한(=가운데) 입자만 고를 수 있다
const BOND_MIN = 0.12;                // 막대는 이보다 옅어지면 아예 그리지 않는다
const MAX_PRIMS = 15000;              // 정점 번호가 16비트라 그릴 것은 16383개가 한계
let farFloor = 0.045;                 // 저사양 기기에서는 이 값을 올려 주변부를 덜 그린다
function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ── 망치 타격 — 화면 쪽 상태기계 ──────────────────────────────────
   계산부의 strikePlan() 이 돌려준 「무엇이 어디로 움직이는가」를 시간에 따라 보간해 그린다.
   진행은 기존 loop() 의 dtSec 만 쓴다 — 새 requestAnimationFrame·setInterval 을 만들지 않는다.
   단계열  이온   swing → slip → repel → split → done
           금속   swing → slip → done
           분자   swing → crumble → done                                       */
const STRIKE_T = { swing: 0.45, slip: 0.6, repel: 0.9, split: 0.8, crumble: 0.8, stretch: 0.7, recoil: 0.9, crack: 0.8 };
/* 간격·아치 높이는 계산부(STRIKE_SPLIT_GAP·STRIKE_ARCH)에 하나만 둔다 — 여기 사본을 두지 않는다(F-1) */
const HAMMER_PRIMS = 4;            // 자루 1 + 머리 1 + 끝 구 2
const REDUCE_MOTION = matchMedia("(prefers-reduced-motion:reduce)").matches;
const strike = {
  on: false, mnrId: null, phase: "idle", t: 0,
  plan: null, l3: null, primMask: null, offs: null,
  maskOn: false, repelAlpha: 0
};
let strikeRepelDrawn = 0;          // 이번 프레임에 실제로 그린 반발 점선 수(훅 전용 — 화면에 표시하지 않는다)
let strikeRUnitNow = 0;

function easeOutCubic(t) { const u = 1 - Math.min(1, Math.max(0, t)); return 1 - u * u * u; }

/* 끊어진 결합의 **반쪽 막대 프림 2개 모두**에 1 을 세운다.
   primsOf 가 프림을 담은 순서(원자별 커서 ps[i]+1 부터)를 그대로 재현해야 번호가 맞는다. */
function strikeBuildMask(l3, brokenBonds) {
  primsOf(l3);
  const N = l3.atoms.length, ps = l3._ps;
  const mask = new Uint8Array(l3._pk.length);
  const cur = new Int32Array(N);
  for (let i = 0; i < N; i++) cur[i] = ps[i] + 1;
  const brk = new Uint8Array(l3.bonds.length);
  for (const b of brokenBonds) brk[b] = 1;
  for (let b = 0; b < l3.bonds.length; b++) {
    const oi = cur[l3.bonds[b][0]]++, oj = cur[l3.bonds[b][1]]++;
    if (brk[b]) { mask[oi] = 1; mask[oj] = 1; }
  }
  return mask;
}

/* 이 프레임의 원자 오프셋(모형 좌표). l3.atoms 원본은 절대 건드리지 않는다. */
function strikeComputeOffsets() {
  const p = strike.plan, l3 = strike.l3;
  if (!p || !l3) { strike.maskOn = false; strike.repelAlpha = 0; return; }
  const N = l3.atoms.length, ph = strike.phase;
  if (!strike.offs || strike.offs.length < N * 3) strike.offs = new Float32Array(N * 3);
  let slipP = 0, splitP = 0, crumbleP = 0;
  if (p.mode === "molecular") {
    if (ph === "crumble") crumbleP = easeOutCubic(strike.t / STRIKE_T.crumble);
    else if (ph === "done") crumbleP = 1;
  } else if (p.mode === "elastic") {
    /* 고무 — 당겨졌다가(stretch) 되돌아온다(recoil). done 에서 0 이라 원래 배열로 돌아간다. */
    if (ph === "stretch") slipP = easeOutCubic(strike.t / STRIKE_T.stretch);
    else if (ph === "recoil") slipP = 1 - easeOutCubic(strike.t / STRIKE_T.recoil);
    else if (ph === "done") slipP = 0;
  } else if (p.mode === "brittle") {
    /* 폴리스타이렌 — 금이 벌어지고 그대로 남는다(되돌아오지 않는다). */
    if (ph === "crack") slipP = easeOutCubic(strike.t / STRIKE_T.crack);
    else if (ph === "done") slipP = 1;
  } else {
    if (ph === "slip") slipP = easeOutCubic(strike.t / STRIKE_T.slip);
    else if (ph === "repel") slipP = 1;
    else if (ph === "split") { slipP = 1; splitP = easeOutCubic(strike.t / STRIKE_T.split); }
    else if (ph === "done") { slipP = 1; splitP = p.mode === "ion" ? 1 : 0; }
  }
  /* 좌표를 만드는 규칙은 계산부의 strikeOffsetsAt() 하나뿐이다 — 화면과 검증이 같은 함수를 쓴다.
     슬립 중 아치 들림도 그 안에 있다(끝점에서 0 이라 격자 보존 검산은 그대로 성립한다). */
  strikeOffsetsAt(l3, p, slipP, splitP, crumbleP, strike.offs);
  /* 마스크는 **moved 원자에 오프셋이 실제로 적용되기 시작한 순간부터** 건다.
     층이 밀리거나 조각이 갈라지기 시작하면 그 경계를 가로지르던 이웃 관계·분자 사이 힘은
     더 이상 작용하지 않는다 — 남겨 두면 늘어난 실선·점선이 조각 사이를 잇는 거짓 그림이 된다. */
  strike.maskOn = (slipP > 0 || splitP > 0 || crumbleP > 0);
  /* 반발 점선 — repel 단계에서 온전히, **split 초입**에 사라진다.
     조각이 벌어진 뒤에도 남겨 두면 두 조각을 잇는 「늘어난 줄」로 읽혀 반발 표시가 결합봉으로
     오독된다. 벌어진 거리가 아직 작을 때(0.3·0.8nn 안쪽) 다 없어지게 감쇠 폭을 좁힌다. */
  strike.repelAlpha = p.mode !== "ion" ? 0
    : (ph === "repel" ? 1 : (ph === "split" ? Math.max(0, 1 - splitP / 0.3) : 0));
}

function strikeOffsetsFor(l3) { return (strike.on && strike.l3 === l3) ? strike.offs : null; }

/* 망치 — 코드로 만든 메시(막대 2 + 구 2). 치수는 전부 최근접 이웃 거리 nn 에서 유도한다.
   swing 동안 z축으로 회전하며 내려오고, 층이 밀리기 시작하면(slip/crumble) 화면에서 빠진다.
   격자와 **같은 시점 변환**을 쓴다 — 따로 돌지 않는다. */
const HAMMER_T3 = hexToRgb01(C.t3 || "#5b636b");
const HAMMER_INK = hexToRgb01(C.ink || "#1f2328");
function strikeDrawHammer(l3, scale, yaw, pitch) {
  const nn = l3.nn;
  const a0 = -1.20, a1 = 0.0;                       // 들어 올린 각 → 내려친 각(라디안)
  const th = a0 + (a1 - a0) * easeOutCubic(strike.t / STRIKE_T.swing);
  const HANDLE = 6 * nn, HEAD_HALF = 1.2 * nn;
  const pivotY = 2.2 * nn + HANDLE;                 // 자루 끝(손) — 화면 위쪽 밖
  const dx = Math.sin(th), dy = -Math.cos(th);      // 자루가 뻗는 방향
  const hx = dx * HANDLE, hy = pivotY + dy * HANDLE;
  const px = Math.cos(th), py = Math.sin(th);       // 자루와 수직(머리가 뻗는 방향)
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpt = Math.cos(pitch), spt = Math.sin(pitch);
  const toView = (X, Y, Z) => {
    const x1 = cyw * X * scale + syw * Z * scale, z1 = -syw * X * scale + cyw * Z * scale;
    const y2 = cpt * Y * scale - spt * z1, z2 = spt * Y * scale + cpt * z1;
    return [x1, y2, z2 - CAM_Z];
  };
  const pv = toView(0, pivotY, 0), hd = toView(hx, hy, 0);
  const e1 = toView(hx + px * HEAD_HALF, hy + py * HEAD_HALF, 0);
  const e2 = toView(hx - px * HEAD_HALF, hy - py * HEAD_HALF, 0);
  ensureCap(HAMMER_PRIMS + 2);
  vHead = 0; iHead = 0; primCount = 0;
  emitStick(pv[0], pv[1], pv[2], hd[0], hd[1], hd[2], 0.35 * nn * scale, HAMMER_T3, 1, 0, 1);
  emitStick(e1[0], e1[1], e1[2], e2[0], e2[1], e2[2], 1.1 * nn * scale, HAMMER_INK, 1, 0, 1);
  emitSphere(e1[0], e1[1], e1[2], 1.1 * nn * scale, HAMMER_INK, 1);
  emitSphere(e2[0], e2[1], e2[2], 1.1 * nn * scale, HAMMER_INK, 1);
  gl.bufferData(gl.ARRAY_BUFFER, vArr.subarray(0, vHead), gl.DYNAMIC_DRAW);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, iArr.subarray(0, iHead), gl.DYNAMIC_DRAW);
  gl.drawElements(gl.TRIANGLES, iHead, gl.UNSIGNED_SHORT, 0);
}
const RED_RGB = hexToRgb01(C.red || "#b91c1c");

/* 한 판에 3차원 공-막대 모형을 그린다.
   x,y,w,h — 픽셀 뷰포트 / rect — 클릭 판정에 쓸 CSS 픽셀 사각형
   store — 원자의 화면 좌표를 담아 둘 배열(클릭 판정용)

   ★ 이 함수가 하는 일의 순서
     ① 원자를 시점 좌표로 옮기고, 화면 좌표에서의 진하기(fadeBuf)를 잰다.
        화면 밖으로 나간 것은 진하기 0 — 그리지 않는다(절두체 컬링).
     ② 진하기가 남아 있는 원자만, 그 원자가 책임지는 공·막대를 목록에 담는다.
     ③ 먼 것부터 그린다(화가 알고리즘).
     ④ 「심화」에서 켰다면 가운데 단위 세포 하나만 테두리로 덧그린다. */
function drawLattice3D(mnr, l3, x, y, w, h, alpha, pickedIdx, rect, store) {
  if (!l3 || w < 8 || h < 8) { if (store) store.length = 0; return; }
  primsOf(l3);
  const atoms = l3.atoms, N = atoms.length;
  const scale = latScaleFor(zoomV);
  /* 표본 무대는 광선을 돌린다(물체는 반대로 도는 것처럼 보인다). 두 무대가 같은 방향으로
     돌아야 하므로 모형에는 부호를 뒤집어 준다. */
  const yaw = -spin, pitch = -tilt;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpt = Math.cos(pitch), spt = Math.sin(pitch);
  const aspect = w / h, fp = 1 / Math.tan(FOVY / 2);
  const nbOn = showNb;
  /* 타격 중이면 이 판의 원자에 오프셋이 실린다. l3.atoms 원본은 건드리지 않는다. */
  const sOff = strikeOffsetsFor(l3);
  const sMask = (sOff && strike.maskOn) ? strike.primMask : null;
  const sRepel = (sOff && strike.plan.mode === "ion" && strike.repelAlpha > 0) ? strike.plan.repelPairs : null;
  const repelCount = sRepel ? sRepel.length : 0;

  /* ① 시점 좌표 + 진하기 */
  if (vpBuf.length < N * 3) vpBuf = new Float32Array(N * 3 * 2);
  if (fadeBuf.length < N) fadeBuf = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = atoms[i];
    const X = (a.x + (sOff ? sOff[i * 3] : 0)) * scale,
          Y = (a.y + (sOff ? sOff[i * 3 + 1] : 0)) * scale,
          Z = (a.z + (sOff ? sOff[i * 3 + 2] : 0)) * scale;
    const x1 = cyw * X + syw * Z, z1 = -syw * X + cyw * Z;
    const y2 = cpt * Y - spt * z1, z2 = spt * Y + cpt * z1;
    const vz = z2 - CAM_Z;
    vpBuf[i * 3] = x1; vpBuf[i * 3 + 1] = y2; vpBuf[i * 3 + 2] = vz;
    let f = 0;
    if (vz < -0.25) {
      const ndcX = (fp / aspect) * x1 / -vz, ndcY = fp * y2 / -vz;
      const ax = ndcX < 0 ? -ndcX : ndcX, ay = ndcY < 0 ? -ndcY : ndcY;
      const rn = ax > ay ? ax : ay;
      if (rn < FADE_OUT) {
        const dz = (z2 < 0 ? -z2 : z2) / 1.261;
        f = (1 - sstep(FADE_IN, FADE_OUT, rn)) * (1 - sstep(DEPTH_IN, DEPTH_OUT, dz));
      }
    }
    fadeBuf[i] = f;
  }

  /* ② 그릴 것 모으기 — 이웃 막대(kind 3)는 켰을 때만 */
  /* 공 반지름 — 막대를 끈 이온 결정은 fill(거의 맞닿게), 금속은 촘촘히 쌓인 모습,
     공-막대 모형은 이웃 거리의 0.32배(막대와 틈이 또렷하게 보이는 크기). */
  /* 타격 중인 이온 결정은 공간 채움 대신 공-막대 반지름으로 줄여 그린다 — 계산부의 단일 원천 함수(F-1).
     ⚠ 줄이기 시작하는 시점은 **슬립 시작 프레임**이다(swing 제외 — S-검토 B A-2).
       swing 부터 줄이면 망치가 닿기 0.45 s 전에 이온 부피가 15 %로 뛰는데, 왜 작아졌는지 말해 주는
       캡션은 1.05 s 뒤에야 뜬다 — 학생에게는 「망치도 안 닿았는데 이온이 쪼그라들었다」로 읽힌다.
     ⚠ 이 판이 정말 타격 중인 격자인지는 다른 strike 참조(sOff)와 **같은 격자 동일성 확인**으로 판정한다
       (B-4 — strike.on 만 보면 비교 판의 격자에도 축소가 걸릴 수 있다). */
  const rUnit = strikeRenderRadiusUnit(l3, showNb,
    !!sOff && strike.plan.mode === "ion" && strike.phase !== "swing");
  const stickW = Math.max(rUnit * 0.24, l3.rref * 0.085);
  const pk = l3._pk, pa = l3._pa, pb = l3._pb, ps = l3._ps, total = pk.length;
  const cap = Math.min(total + repelCount, MAX_PRIMS);
  if (zBuf.length < cap) { zBuf = new Float32Array(cap); aBuf = new Float32Array(cap); }
  if (!primBuf || primBuf.length < cap) { primBuf = new Int32Array(cap); ordBuf = new Int32Array(cap); }
  let M = 0;
  for (let i = 0; i < N && M < cap; i++) {
    const fi = fadeBuf[i];
    if (fi < farFloor) continue;
    const e = ps[i + 1];
    for (let o = ps[i]; o < e && M < cap; o++) {
      const k = pk[o];
      let al;
      if (k === 0) { al = fi; zBuf[M] = vpBuf[i * 3 + 2]; }
      else {
        if (k === 3 && !nbOn) continue;
        if (sMask && sMask[o]) continue;    // 끊어진 결합 — 늘어난 막대로 남기지 않는다
        const j = pb[o], fj = fadeBuf[j];
        const mn = fi < fj ? fi : fj;
        al = mn * mn;                       // 막대는 공보다 빨리 흐려진다 — 가운데만 또렷하게
        if (al < BOND_MIN) continue;
        zBuf[M] = vpBuf[i * 3 + 2] * 0.75 + vpBuf[j * 3 + 2] * 0.25;
      }
      aBuf[M] = al; primBuf[M] = o; M++;
    }
  }

  /* ②-2 반발 표시 — 같은 전하가 마주 본 쌍. **정렬 스트림 안에** 넣어 다른 프림과 같은 규칙으로
     앞뒤가 가려지게 한다. 목록 번호를 음수로 달아 두고 그릴 때 되돌린다. */
  if (sRepel) {
    for (let q = 0; q < repelCount && M < cap; q++) {
      const i = sRepel[q][0], j = sRepel[q][1];
      const fi = fadeBuf[i], fj = fadeBuf[j];
      const mn = fi < fj ? fi : fj;
      const al = mn * mn * strike.repelAlpha;
      if (al < BOND_MIN) continue;
      zBuf[M] = (vpBuf[i * 3 + 2] + vpBuf[j * 3 + 2]) * 0.5;
      aBuf[M] = al; primBuf[M] = -(q + 1); M++;
    }
  }

  /* ③ 먼 것(더 작은 z)부터 */
  const ord = ordBuf.subarray(0, M);
  for (let s = 0; s < M; s++) ord[s] = s;
  ord.sort((p, q) => zBuf[p] - zBuf[q]);

  ensureCap(M + 2 + repelCount + HAMMER_PRIMS);
  vHead = 0; iHead = 0; primCount = 0;
  let repelDrawn = 0;
  for (let s = 0; s < M; s++) {
    const sl = ord[s], o = primBuf[sl], al = aBuf[sl];
    if (o < 0) {
      /* 반발 표시 — 붉은 **점선**(dash 8). 얼음의 수소 결합 점선(dash 5)과 간격으로도 구분된다.
         이것은 결합봉이 아니라 「밀어내는 힘」의 표시다(캡션·범례·한계⑧에 명시). */
      const q = -o - 1, i = sRepel[q][0], j = sRepel[q][1];
      emitStick(vpBuf[i * 3], vpBuf[i * 3 + 1], vpBuf[i * 3 + 2],
                vpBuf[j * 3], vpBuf[j * 3 + 1], vpBuf[j * 3 + 2],
                stickW * 0.62 * scale, RED_RGB, 2, 8, al);
      repelDrawn++;
      continue;
    }
    const k = pk[o];
    if (k === 0) {
      const i = pa[o], a = atoms[i];
      const r = rUnit * siteOf(mnr, a.s).r * scale;
      if (i === pickedIdx) {
        emitSphere(vpBuf[i * 3], vpBuf[i * 3 + 1], vpBuf[i * 3 + 2], r * 1.34, BLUE_RGB, al);
      }
      emitSphere(vpBuf[i * 3], vpBuf[i * 3 + 1], vpBuf[i * 3 + 2], r, colOf(mnr, a.s), al);
    } else {
      const i = pa[o], j = pb[o];
      const axv = vpBuf[i * 3], ayv = vpBuf[i * 3 + 1], azv = vpBuf[i * 3 + 2];
      const bxv = (vpBuf[i * 3] + vpBuf[j * 3]) / 2;
      const byv = (vpBuf[i * 3 + 1] + vpBuf[j * 3 + 1]) / 2;
      const bzv = (vpBuf[i * 3 + 2] + vpBuf[j * 3 + 2]) / 2;
      const wOut = (k === 2 ? stickW * 0.62 : stickW) * scale;
      emitStick(axv, ayv, azv, bxv, byv, bzv, wOut, colOf(mnr, atoms[i].s), k === 2 ? 2 : 1,
        k === 2 ? 5 : 0, al);
    }
  }

  gl.viewport(x, y, w, h);
  gl.scissor(x, y, w, h);
  persp(PROJ, FOVY, aspect, 0.1, 30);
  gl.useProgram(prog3);
  gl.uniformMatrix4fv(U3.uProj, false, PROJ);
  gl.uniform1f(U3.uAlpha, alpha);
  gl.uniform3f(U3.uLight, -0.4104, 0.7113, 0.5472);   // normalize(-0.45,0.78,0.60) — 표본 무대와 같은 빛
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo3);
  gl.bufferData(gl.ARRAY_BUFFER, vArr.subarray(0, vHead), gl.DYNAMIC_DRAW);
  const st = FPV * 4;
  gl.enableVertexAttribArray(A3.aPos); gl.vertexAttribPointer(A3.aPos, 3, gl.FLOAT, false, st, 0);
  gl.enableVertexAttribArray(A3.aLocal); gl.vertexAttribPointer(A3.aLocal, 2, gl.FLOAT, false, st, 12);
  gl.enableVertexAttribArray(A3.aCol); gl.vertexAttribPointer(A3.aCol, 3, gl.FLOAT, false, st, 20);
  gl.enableVertexAttribArray(A3.aPerp); gl.vertexAttribPointer(A3.aPerp, 3, gl.FLOAT, false, st, 32);
  gl.enableVertexAttribArray(A3.aParam); gl.vertexAttribPointer(A3.aParam, 3, gl.FLOAT, false, st, 44);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo3);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, iArr.subarray(0, iHead), gl.DYNAMIC_DRAW);
  gl.drawElements(gl.TRIANGLES, iHead, gl.UNSIGNED_SHORT, 0);
  if (l3 === lat3) { strikeRepelDrawn = repelDrawn; strikeRUnitNow = rUnit; }

  /* ④-0 망치 — 내려치는 동안에만. 격자와 같은 시점 변환을 쓴다 */
  if (sOff && strike.phase === "swing") strikeDrawHammer(l3, scale, yaw, pitch);

  /* ④ 「심화」 — 되풀이되는 최소 단위 **하나만** 테두리로. 기본 화면에서는 그리지 않는다
     (교육과정상 단위 세포는 범위 밖이고, 기본 화면에서 강조하면 "결정 = 상자들의 집합"으로 읽힌다). */
  if (showCell && l3.cell) {
    const u = l3.cell, o0 = l3.cellO || 0, cs = [];
    for (let bx = 0; bx < 2; bx++) for (let by = 0; by < 2; by++) for (let bz = 0; bz < 2; bz++) {
      const X = (o0 + bx * u) * scale, Y = (o0 + by * u) * scale, Z = (o0 + bz * u) * scale;
      const x1 = cyw * X + syw * Z, z1 = -syw * X + cyw * Z;
      const y2 = cpt * Y - spt * z1, z2 = spt * Y + cpt * z1;
      cs.push([x1, y2, z2 - CAM_Z]);
    }
    const E = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    ensureCap(14);
    vHead = 0; iHead = 0; primCount = 0;
    const wCell = Math.max(l3.rref * 0.042, 0.004) * scale;
    for (const e of E) {
      const A = cs[e[0]], B = cs[e[1]];
      emitStick(A[0], A[1], A[2], B[0], B[1], B[2], wCell, CELL_RGB, 1, 0, 1);
    }
    gl.bufferData(gl.ARRAY_BUFFER, vArr.subarray(0, vHead), gl.DYNAMIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, iArr.subarray(0, iHead), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, iHead, gl.UNSIGNED_SHORT, 0);
  }

  gl.disableVertexAttribArray(A3.aPos); gl.disableVertexAttribArray(A3.aLocal);
  gl.disableVertexAttribArray(A3.aCol); gl.disableVertexAttribArray(A3.aPerp);
  gl.disableVertexAttribArray(A3.aParam);

  /* 클릭 판정용 화면 좌표(CSS 픽셀) — 또렷한 가운데 입자만 담는다.
     주변부는 "계속 이어진다"를 보여 주는 배경이므로 고르지 않는다. */
  if (store) {
    store.length = 0;
    for (let i = 0; i < N; i++) {
      if (fadeBuf[i] < PICK_MIN) continue;
      const vz = vpBuf[i * 3 + 2];
      const ndcX = (fp / aspect) * vpBuf[i * 3] / -vz;
      const ndcY = fp * vpBuf[i * 3 + 1] / -vz;
      const r = rUnit * siteOf(mnr, atoms[i].s).r * scale;
      store.push({
        i, z: vz,
        x: rect.x + (ndcX * 0.5 + 0.5) * rect.w,
        y: rect.y + (0.5 - ndcY * 0.5) * rect.h,
        r: Math.max(3, r * fp * 0.5 * rect.h / -vz)
      });
    }
  }
}

let pick3 = [], pick3L = [], pick3R = [];

function drawGL() {
  if (!gl) return;
  const dpr = dprCap;
  const w = Math.max(1, Math.round(gcv.clientWidth * dpr));
  const h = Math.max(1, Math.round((parseFloat(gcv.style.height) || 300) * dpr));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  const b = blend(zoomV);
  const cssW = gcv.clientWidth, cssH = parseFloat(gcv.style.height) || 300;

  /* ① 표본 무대(광선행진) — 배경이자 확대의 출발점.
     bgMix 가 1에 닿는 구간(b≥0.85)에서는 결과가 무대 바탕색과 같아지므로 아예 그리지 않는다.
     광선행진이 이 화면에서 가장 무거운 작업이라, 끝까지 확대한 상태의 프레임 시간이 크게 준다. */
  gl.disable(gl.BLEND);
  if (b >= 0.85) {
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, gcv.width, gcv.height);
    gl.clearColor(STAGE_RGB[0], STAGE_RGB[1], STAGE_RGB[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  } else {
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  if (!cmpOn) {
    gl.disable(gl.SCISSOR_TEST);
    drawOneGL(mineral, 0, 0, gcv.width, gcv.height);
  } else {
    /* ★ WebGL 컨텍스트는 이 파일 전체에서 하나뿐이다(§5 금지-⑧).
       캔버스 하나를 gl.viewport/gl.scissor 로 좌·우 절반으로 나눠 2회 그린다. */
    gl.enable(gl.SCISSOR_TEST);
    const halfW = Math.floor(gcv.width / 2);
    drawOneGL(mineralL, 0, 0, halfW, gcv.height);
    drawOneGL(mineralR, halfW, 0, gcv.width - halfW, gcv.height);
  }
  gl.disableVertexAttribArray(aP);
  }

  /* ② 확대 뷰(3차원 공-막대) — 같은 컨텍스트, 같은 캔버스 위에 겹쳐 그린다 */
  if (b > 0.002) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (!cmpOn) {
      gl.disable(gl.SCISSOR_TEST);
      drawLattice3D(mineral, lat3, 0, 0, gcv.width, gcv.height, b, picked,
        { x: 0, y: 0, w: cssW, h: cssH }, pick3);
    } else {
      gl.enable(gl.SCISSOR_TEST);
      const halfW = Math.floor(gcv.width / 2), halfCss = cssW / 2;
      drawLattice3D(mineralL, lat3L, 0, 0, halfW, gcv.height, b, pickedL,
        { x: 0, y: 0, w: halfCss, h: cssH }, pick3L);
      drawLattice3D(mineralR, lat3R, halfW, 0, gcv.width - halfW, gcv.height, b, pickedR,
        { x: halfCss, y: 0, w: cssW - halfCss, h: cssH }, pick3R);
    }
    gl.disable(gl.BLEND);
  }
  gl.disable(gl.SCISSOR_TEST);
}

/* ── 확대 뷰 조작 — 끌어서 돌리기 · 눌러서 입자 고르기 ── */
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
/* 입자가 겹쳐 보이는 자리에서는 **앞쪽 입자**를 고른다(공간 채움에서는 뒤쪽 입자의
   중심이 더 가까울 수 있다). 공 안을 누른 것이 하나도 없을 때만 가장 가까운 것을 고른다. */
function nearestAtom(list, x, y) {
  let best = -1, bd = 1e9, front = -1, fz = -1e9, fd = 1e9;
  for (const g of list) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d <= g.r && g.z > fz) { fz = g.z; front = g.i; fd = d; }
    if (d < g.r + 8 && d < bd) { bd = d; best = g.i; }
  }
  return front >= 0 ? { idx: front, d: fd } : { idx: best, d: bd };
}
function stagePointerDown(ev) {
  dragging = true; dragMoved = 0;
  lastX = ev.clientX; lastY = ev.clientY;
  if (ev.target.setPointerCapture && ev.pointerId !== undefined) {
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
  }
}
function stagePointerMove(ev) {
  if (!dragging) return;
  const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
  lastX = ev.clientX; lastY = ev.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 3) {
    spin -= dx * 0.0075;
    tilt = Math.max(-1.35, Math.min(1.35, tilt - dy * 0.0075));
    if (ev.cancelable) ev.preventDefault();
  }
}
function stagePointerUp(ev) {
  if (!dragging) return;
  dragging = false;
  if (dragMoved > 6 || !gl) return;                 // 돌린 것이면 고르지 않는다
  if (blend(zoomV) < 0.5) return;                   // 아직 표본 무대면 고를 입자가 없다
  const r = gcv.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (!cmpOn) {
    const a = nearestAtom(pick3, x, y);
    picked = a.idx;
  } else {
    const l = nearestAtom(pick3L, x, y), rr = nearestAtom(pick3R, x, y);
    if (l.idx >= 0 && l.d <= rr.d) { pickedL = l.idx; pickedR = -1; }
    else if (rr.idx >= 0) { pickedR = rr.idx; pickedL = -1; }
  }
  showPick();
}
$("stagePair").addEventListener("pointerdown", stagePointerDown);
$("stagePair").addEventListener("pointermove", stagePointerMove);
$("stagePair").addEventListener("pointerup", stagePointerUp);
$("stagePair").addEventListener("pointercancel", () => { dragging = false; });

/* ── 폴백(2D 캔버스) — WebGL 을 쓸 수 없는 기기에서만 쓴다 ──
   3D 경로가 살아 있으면 이 캔버스는 그리지 않는다. */
const lcv = $("lat"), lctx = lcv.getContext("2d");
let latGeom = [];
let latGeomL = [], latGeomR = [];

function drawLatticePanel(mnr, lat, ox, oy, S, pickedIdx) {
  if (S < 40 || !lat) return [];
  const sites0 = SITES[mnr.id];
  const nearestScreen = lat.bondNear ? lat.bondNear / (1 + 2 * LAT_PAD) : null;
  const rBase = nearestScreen ? S * Math.min(0.038, nearestScreen * 0.42) : S * 0.038;
  const geom = lat.pts.map(p => ({
    x: ox + (p.x + LAT_PAD) / (1 + 2 * LAT_PAD) * S,
    y: oy + (1 - (p.y + LAT_PAD) / (1 + 2 * LAT_PAD)) * S,
    r: rBase * siteOf(mnr, p.s).r, s: Math.min(p.s, sites0.length - 1)
  }));

  lctx.save();
  lctx.beginPath(); lctx.rect(ox, oy, S, S); lctx.clip();

  if (lat.bonds) {
    for (const [i, j, type] of lat.bonds) {
      const a = geom[i], b = geom[j];
      if (!a || !b) continue;
      lctx.beginPath();
      if (type === "in") { lctx.strokeStyle = "rgba(31,35,40,0.62)"; lctx.setLineDash([]); lctx.lineWidth = 2.4; }
      else { lctx.strokeStyle = "rgba(31,35,40,0.34)"; lctx.setLineDash([2, 3]); lctx.lineWidth = 1.1; }
      lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke();
    }
    lctx.setLineDash([]);
    /* 암염·황철석의 근접선은 결합봉이 아니라 이웃 표시다 — 3D 화면과 같게 기본은 그리지 않는다 */
  } else if (!((mnr.id === "halite" || mnr.id === "pyrite") && !showNb)) {
    lctx.strokeStyle = "rgba(40,45,52,0.28)"; lctx.lineWidth = 1.6; lctx.setLineDash([]);
    const near = lat.bondNear
      ? lat.bondNear / (1 + 2 * LAT_PAD) * S * 1.12
      : S * (mnr.kind === "비결정성" ? 0.16 : 0.145);
    const heteroOnly = mnr.id === "halite" || mnr.id === "pyrite" || mnr.id === "quartz";
    for (let i = 0; i < geom.length; i++) for (let j = i + 1; j < geom.length; j++) {
      const a = geom[i], b = geom[j];
      if (heteroOnly && a.s === b.s) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < near) { lctx.beginPath(); lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke(); }
    }
  }
  if (mnr.id === "diamond") {
    lctx.strokeStyle = "rgba(31,35,40,0.40)"; lctx.lineWidth = 1.4;
    geom.forEach((g, i) => {
      const ang = (lat.pts[i].puck ? 1 : -1) * 0.9 + 1.571;
      lctx.beginPath(); lctx.moveTo(g.x, g.y);
      lctx.lineTo(g.x + Math.cos(ang) * g.r * 1.5, g.y + Math.sin(ang) * g.r * 1.5); lctx.stroke();
    });
  }
  geom.forEach((g, i) => {
    const s = siteOf(mnr, g.s);
    lctx.fillStyle = s.cpk;
    lctx.strokeStyle = darken(s.cpk, 0.5); lctx.lineWidth = 1;
    lctx.beginPath(); lctx.arc(g.x, g.y, g.r, 0, 6.2832);
    lctx.fill(); lctx.globalAlpha = 0.85; lctx.stroke(); lctx.globalAlpha = 1;
    if (g.r >= 4.5) {
      const lum = cpkLuminance(s.cpk);
      lctx.fillStyle = lum > 0.6 ? "#1f2328" : "#ffffff";
      lctx.font = `700 ${Math.max(7, Math.min(g.r * 0.95, 15)).toFixed(0)}px sans-serif`;
      lctx.textAlign = "center"; lctx.textBaseline = "middle";
      lctx.fillText(s.sym.replace(/[⁺⁻]/g, ""), g.x, g.y + 0.5);
      lctx.textAlign = "left"; lctx.textBaseline = "alphabetic";
    }
    if (i === pickedIdx) {
      lctx.strokeStyle = C.blue; lctx.lineWidth = 3;
      lctx.beginPath(); lctx.arc(g.x, g.y, g.r + 6, 0, 6.2832); lctx.stroke();
    }
  });
  lctx.restore();
  return geom;
}
function cpkLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16 & 255) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`;
}
/* 토큰 색에 알파를 입힌다 — 새 UI 요소(비교 모드 구분선 등)는 하드코딩 색을 쓰지 않는다(§5 금지-⑦) */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function drawLat() {
  if (gl) return;                       // 3D 경로가 살아 있으면 폴백 캔버스는 쓰지 않는다
  const dpr = dprCap;
  const W = lcv.width / dpr, H = lcv.height / dpr;
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.fillStyle = C.stageLight; lctx.fillRect(0, 0, W, H);
  const M = 24;
  if (!cmpOn) {
    const S = Math.min(W - M * 2, H - M * 2);
    if (S < 40) { latGeom = []; return; }
    latGeom = drawLatticePanel(mineral, lattice, (W - S) / 2, (H - S) / 2, S, picked);
    lctx.fillStyle = C.t3; lctx.font = "10.5px sans-serif"; lctx.textAlign = "right";
    lctx.fillText("입자를 눌러 보세요", W - M + 8, H - 8); lctx.textAlign = "left";
  } else {
    const halfW = W / 2;
    const S = Math.min(halfW - M * 2, H - M * 2);
    if (S < 30) { latGeomL = []; latGeomR = []; return; }
    latGeomL = drawLatticePanel(mineralL, latticeL, (halfW - S) / 2, (H - S) / 2, S, pickedL);
    latGeomR = drawLatticePanel(mineralR, latticeR, halfW + (halfW - S) / 2, (H - S) / 2, S, pickedR);
    lctx.strokeStyle = hexA(C.t3, 0.35); lctx.beginPath();
    lctx.moveTo(halfW, 8); lctx.lineTo(halfW, H - 8); lctx.stroke();
    lctx.fillStyle = C.t3; lctx.font = "700 11px sans-serif"; lctx.textAlign = "center";
    lctx.fillText(mineralL.name, halfW / 2, H - 8);
    lctx.fillText(mineralR.name, halfW + halfW / 2, H - 8);
    lctx.textAlign = "left";
  }
}
lcv.addEventListener("click", ev => {
  if (gl) return;
  const b = lcv.getBoundingClientRect();
  const x = ev.clientX - b.left, y = ev.clientY - b.top;
  if (!cmpOn) {
    let best = -1, bd = 1e9;
    latGeom.forEach((g, i) => { const d = Math.hypot(g.x - x, g.y - y); if (d < g.r + 10 && d < bd) { bd = d; best = i; } });
    picked = best; showPick(); drawLat();
  } else {
    let bestL = -1, bdL = 1e9, bestR = -1, bdR = 1e9;
    latGeomL.forEach((g, i) => { const d = Math.hypot(g.x - x, g.y - y); if (d < g.r + 10 && d < bdL) { bdL = d; bestL = i; } });
    latGeomR.forEach((g, i) => { const d = Math.hypot(g.x - x, g.y - y); if (d < g.r + 10 && d < bdR) { bdR = d; bestR = i; } });
    if (bdL <= bdR && bestL >= 0) { pickedL = bestL; pickedR = -1; }
    else if (bestR >= 0) { pickedR = bestR; pickedL = -1; }
    showPick(); drawLat();
  }
});

/* ── 누른 입자 카드 ── */
function pickCardHTML(mnr, l3, idx) {
  if (idx < 0 || !l3 || !l3.atoms[idx]) return null;
  const atom = l3.atoms[idx];
  const s = siteOf(mnr, atom.s);
  const molInfo = (atom.mol !== undefined) ? `<tr><th>분자 번호</th><td>#${atom.mol}</td></tr>` : "";
  return `<div class="pickhead"><span class="dot" style="background:${s.cpk}"></span><b>${s.label}</b></div>` +
    `<table class="picktab"><tbody>` +
    `<tr><th>이 고체의 분류</th><td><b>${mnr.type}</b></td></tr>` +
    `<tr><th>이웃과의 결합</th><td>${mnr.bond}</td></tr>` +
    `<tr><th>고체에서 전기</th><td>${mnr.cond.solid}</td></tr>` +
    `<tr><th>녹였을 때 전기</th><td>${mnr.cond.melt}</td></tr>` +
    `<tr><th>${mnr.mpLabel}</th><td>${mnr.mpText}</td></tr>` +
    molInfo +
    `</tbody></table><div class="picknote">${mnr.note}</div>`;
}
/* 폴백(2D)에서는 3D 배열이 없으므로 2D 배열의 자리 정보로 같은 카드를 만든다 */
function pickCardHTML2D(mnr, lat, geom, idx) {
  if (idx < 0 || !geom[idx]) return null;
  const fake = { atoms: lat.pts.map(p => ({ s: p.s, mol: p.mol })) };
  return pickCardHTML(mnr, fake, idx);
}
function showPick() {
  const host = $("pick");
  const use3D = !!gl;
  if (!cmpOn) {
    const html = use3D ? pickCardHTML(mineral, lat3, picked) : pickCardHTML2D(mineral, lattice, latGeom, picked);
    host.innerHTML = html || `<div class="pickempty">확대한 뒤 <b>입자를 하나 눌러 보세요.</b>
      그 자리에 무엇이 있고, 이웃과 무엇으로 이어져 있는지 나옵니다.</div>`;
  } else {
    const l = use3D ? pickCardHTML(mineralL, lat3L, pickedL) : pickCardHTML2D(mineralL, latticeL, latGeomL, pickedL);
    const r = use3D ? pickCardHTML(mineralR, lat3R, pickedR) : pickCardHTML2D(mineralR, latticeR, latGeomR, pickedR);
    if (!l && !r) {
      host.innerHTML = `<div class="pickempty">확대한 뒤 <b>왼쪽이나 오른쪽 입자를 하나 눌러 보세요.</b></div>`;
    } else {
      host.innerHTML = `<div class="cmpPickGrid">
        <div>${l || '<div class="pickempty">왼쪽 입자를 눌러 보세요.</div>'}</div>
        <div>${r || '<div class="pickempty">오른쪽 입자를 눌러 보세요.</div>'}</div>
      </div>`;
    }
  }
  updateBondLegend();
  updateStageNotes();
}
function updateBondLegend() {
  const el = $("bondLegend");
  const list = cmpOn ? [mineralL, mineralR] : [mineral];
  const mols = list.filter(m => m.molecular);
  const nbs = list.filter(hasNbSticks);
  const polys = list.filter(m => m.polymer);
  if (!mols.length && !nbs.length && !polys.length) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "block";
  const hasHb = mols.some(m => m.id === "ice");
  const hasNone = mols.some(m => m.id === "dryice");
  let html = "";
  if (mols.length) {
    html += `<b>막대 범례</b><br>
      <span class="bl-in"></span> 분자 <b>안</b>의 결합(공유 결합, 굵은 막대)` +
      (hasHb ? ` &nbsp; <span class="bl-between"></span> 분자 <b>사이</b>의 수소 결합(점선)` : "") +
      (hasNone ? `<br><span style="color:var(--t3)">드라이아이스는 분자 <b>사이</b>를 잇는 막대를 그리지 않았습니다 —
        분산력은 방향이 정해진 결합이 아니기 때문입니다. 분자 사이의 <b>틈</b>으로 보세요.</span>` : "");
  }
  if (nbs.length) {
    if (html) html += "<br>";
    html += `<span style="color:var(--t3)">${nbs.map(m => m.name).join("·")}는 이온이 <b>맞닿은 채 쌓인 모습</b>으로 그렸습니다 —
      이온 사이에는 <b>방향이 정해진 결합봉이 없습니다.</b> 「최근접 이웃 표시」를 켜면 어느 이온이
      서로 이웃인지 막대로 볼 수 있지만, 그 막대는 <b>결합봉이 아니라 이웃 표시</b>입니다.</span>`;
  }
  if (polys.length) {
    if (html) html += "<br>";
    html += `<span style="color:var(--t3)">${polys.map(m => m.name).join("·")}는 <b>긴 사슬</b>이 엉킨 모습입니다 —
      굵은 막대는 사슬 <b>안</b>의 공유 결합이고, 사슬 <b>사이</b>에는 방향이 정해진 결합이 없어
      막대를 그리지 않았습니다(드라이아이스와 같은 이유). 곁가지는 <b>크기</b>로 구분합니다.` +
      (polys.some(m => m.chainCross)
        ? ` <b>노란 공</b>은 사슬 사이를 잇는 <b>가황 다리</b>(황)입니다 — 고무가 되돌아오는 힘의 원천입니다.`
        : "") + `</span>`;
  }
  el.innerHTML = html;
}

/* ── 광물 고르기 (단일 모드) ── */
function buildPicker() {
  const host = $("mpick"); host.innerHTML = "";
  MIN.LIST.forEach(m => {
    const b = document.createElement("button");
    b.className = "mp"; b.setAttribute("aria-pressed", String(m.id === mineral.id));
    b.innerHTML = `<b>${m.name}</b><span>${m.formula}</span><em class="${m.kind === "결정성" ? "cry" : "amo"}">${m.kind}</em>`;
    b.onclick = () => {
      mineral = m; picked = -1;
      lattice = makeLattice(m, rnd); lat3 = makeLattice3D(m, rnd);
      /* 타격 중에 광물을 바꾸면 즉시 되돌린다 — applyZoom() 이 노출·안내·리셋을 한 번에 다시 판정한다 */
      buildPicker(); info(); showPick(); applyZoom();
    };
    host.appendChild(b);
  });
}
function info() {
  $("mInfo").innerHTML =
    `<b>${mineral.name}</b> ${mineral.formula} · 겉모습: ${mineral.look} · 밀도 ${mineral.density} g/cm³<br>` +
    `분류: <b>${mineral.type}</b> · ${mineral.mpLabel}: ${mineral.mpText}`;
  const adv = $("adv");
  if (!mineral.a) {
    adv.innerHTML = `비결정성이라 <b>격자 상수가 없다.</b> 되풀이되는 단위가 없기 때문이다.`;
  } else if (mineral.densityIsCalc) {
    /* 드라이아이스 — 이 종의 density 필드 자체가 이 격자 상수로 계산한 값이다.
       "계산과 실측이 맞는다"고 쓰면 계산값을 문헌 실측값으로 둔갑시키는 순환 서술이 된다.
       대조할 단일 문헌 밀도가 없다는 사실을 그대로 적는다. */
    adv.innerHTML = `격자 상수 <b>a = ${mineral.a} Å</b> · 이 값으로 계산한 밀도 <b>${densityFromCell(mineral).toFixed(2)} g/cm³</b>. ` +
      `이 종은 대조할 단일 문헌 밀도가 없어(문헌 구간 1.55~1.7 g/cm³) 계산값을 그대로 쓴다.`;
  } else {
    adv.innerHTML = `격자 상수 <b>a = ${mineral.a} Å</b>${mineral.c ? ` · c = ${mineral.c} Å` : ""} · ` +
      `이 값으로 계산한 밀도 <b>${densityFromCell(mineral).toFixed(2)} g/cm³</b> (문헌 ${mineral.density}) — 계산과 실측이 맞는다.`;
  }
}

/* ── 비교 모드 UI ── */
function buildCmpSelectors() {
  const opts = MIN.LIST.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
  $("cmpLeftSel").innerHTML = opts; $("cmpRightSel").innerHTML = opts;
  $("cmpLeftSel").value = mineralL.id; $("cmpRightSel").value = mineralR.id;
}
function buildPresetChips() {
  const host = $("presetChips"); host.innerHTML = "";
  PRESETS.forEach(pr => {
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button";
    b.innerHTML = `<b>${pr.label}</b><span>${pr.note}</span>`;
    b.onclick = () => { setCmpPair(pr.l, pr.r); };
    host.appendChild(b);
  });
}
/* 비교 모드에서 좌·우가 무엇인지 알려 주는 이름표 — 판정이 아니라 식별용이다 */
function updateCmpNames() {
  $("cmpNameL").textContent = cmpOn ? mineralL.name : "";
  $("cmpNameR").textContent = cmpOn ? mineralR.name : "";
  $("cmpNames").className = "cmpnames" + (cmpOn ? " on" : "");
}
function setCmpPair(lId, rId) {
  mineralL = mById(lId); mineralR = mById(rId);
  latticeL = makeLattice(mineralL, rnd); latticeR = makeLattice(mineralR, rnd);
  lat3L = makeLattice3D(mineralL, rnd); lat3R = makeLattice3D(mineralR, rnd);
  pickedL = -1; pickedR = -1;
  $("cmpLeftSel").value = lId; $("cmpRightSel").value = rId;
  updateCmpNames();
  showPick(); drawGL(); drawLat();
}
$("cmpToggle").onchange = e => {
  cmpOn = e.target.checked;
  $("cmpPanel").style.display = cmpOn ? "" : "none";
  $("mpick").style.display = cmpOn ? "none" : "";
  /* 단일 모드의 표본 정보 줄(#mInfo)은 종 하나를 가리킨다 — 비교 모드에서 그대로 두면
     화면에 두 표본이 보이는데 정보는 이전 단일 종 것을 말해 거짓 안내가 된다(B-6). */
  $("mInfo").style.display = cmpOn ? "none" : "";
  dprCap = cmpOn ? Math.min(dprCapUser, 1.5) : dprCapUser;
  if (cmpOn && !lat3L) {
    latticeL = makeLattice(mineralL, rnd); latticeR = makeLattice(mineralR, rnd);
    lat3L = makeLattice3D(mineralL, rnd); lat3R = makeLattice3D(mineralR, rnd);
  }
  updateCmpNames();
  applyZoom(); showPick();
};
$("cmpLeftSel").onchange = e => setCmpPair(e.target.value, mineralR.id);
$("cmpRightSel").onchange = e => setCmpPair(mineralL.id, e.target.value);

/* ── 확대(연속) ── */
function applyZoom() {
  /* 3D 경로에서는 한 캔버스가 표본 무대와 공-막대 모형을 모두 그린다 — 무대를 갈아 끼우지
     않으므로 평면 그림으로 바뀌는 구간이 없다. 폴백(2D)일 때만 두 무대를 크로스페이드한다.
     display:none 을 쓰지 않는다(캔버스가 숨으면 clientWidth 가 0 이 되어 반지름이 음수가
     되는 예전 함정 — 작업매뉴얼 2부 §5 경고). */
  const b = blend(zoomV);
  const use3D = !!gl;
  $("glWrap").style.opacity = 1;
  $("latWrap").style.opacity = use3D ? 0 : b;
  $("glWrap").style.pointerEvents = "auto";
  $("latWrap").style.pointerEvents = (!use3D && b >= 0.5) ? "auto" : "none";
  $("vZoom").textContent = zoomLabel(zoomV);
  $("zoomState").innerHTML = zoomV >= ZOOM_BLEND_END
    ? "지금은 <b>입자 하나하나가 보이는 크기</b>입니다. 화면에 보이는 것은 고체 <b>안쪽의 한 자리</b>이고, " +
      "같은 배열이 <b>화면 밖으로도 계속</b>됩니다. 끌어서 돌려 보고, 가운데 입자를 눌러 보세요."
    : (zoomV > ZOOM_BLEND_START
      ? "배율이 커지는 중입니다 — 표본 <b>안쪽으로 들어가</b> 입자 배열이 떠오릅니다."
      : (zoomV > 30
        ? "표면의 결이 보이기 시작합니다. <b>약 ×" + Math.round(magnification(ZOOM_BLEND_START)).toLocaleString("ko-KR") + " 단계를 넘으면</b> 입자 배열이 나타납니다."
        : "<b>손에 들고 보는 크기</b>입니다. 이 겉모습만으로 결정인지 알 수 있을까요?"));
  $("pickCard").style.display = zoomV >= ZOOM_BLEND_START ? "" : "none";
  /* 버튼이 나타나는 순간을 배율 안내가 함께 말해 준다 — 판정은 strikeAvailable() 한 곳뿐이다 */
  if (strikeAvailable()) $("zoomState").innerHTML += STRIKE_ZOOM_HINT;
  strikeSync();
  updateStageNotes();
  resize();
}

/* ── 확대 그림 **바로 위에** 붙는 상시 표기 ────────────────────────────
   하단의 「가정과 한계」만으로는 늦다 — 그림이 먼저 주는 인상을 막지 못한다.
   그래서 같은 자리에서 세 가지를 말한다.
     ① 이것은 고체 내부에서 잘라 본 대표 부분이고 구조는 모든 방향으로 계속된다
     ② (막대를 켰다면) 그 막대는 결합봉이 아니라 이웃 표시다
     ③ (심화 테두리를 켰다면) 테두리는 되풀이되는 최소 단위 하나다 */
function hasNbSticks(m) { return m.id === "halite" || m.id === "pyrite"; }
function updateStageNotes() {
  const on = blend(zoomV) > 0.12;
  const list = cmpOn ? [mineralL, mineralR] : [mineral];
  const anyNb = list.some(hasNbSticks);
  const anyCell = !!gl && list.some(m => !!m.a);   // 폴백(2D)에서는 테두리를 그릴 수 없다
  $("latNote").style.display = on ? "flex" : "none";
  $("stickNote").style.display = (anyNb && showNb) ? "" : "none";
  $("cellNote").style.display = (showCell && anyCell) ? "" : "none";
  $("nbRow").style.display = anyNb ? "" : "none";
  $("cellRow").style.display = anyCell ? "" : "none";
}
$("nbToggle").onchange = e => { showNb = e.target.checked; updateStageNotes(); drawGL(); drawLat(); };
$("cellToggle").onchange = e => { showCell = e.target.checked; updateStageNotes(); drawGL(); };
$("sZoom").oninput = e => { zoomV = +e.target.value; applyZoom(); };
$("spinBtn").onclick = () => { spinning = !spinning; $("spinBtn").textContent = spinning ? "회전 멈추기" : "회전 시키기"; };

/* ── 망치 타격 — 단계열·노출 제어·캡션 ─────────────────────────────
   노출과 리셋의 판정은 **strikeAvailable() 하나**가 내린다(§5 금지-⑯ — 임계를 두 곳에 두면
   한쪽만 바뀌었을 때 타격 상태가 화면에 남는다). */
const STRIKE_SEQ = {
  ion: ["swing", "slip", "repel", "split", "done"],
  metal: ["swing", "slip", "done"],
  molecular: ["swing", "crumble", "done"],
  elastic: ["swing", "stretch", "recoil", "done"],  // 고무 — 늘어났다가 되돌아온다
  brittle: ["swing", "crack", "done"]               // 폴리스타이렌 — 금이 벌어진 채 남는다
};
/* 구리·철은 같은 문장을 쓴다 — 두 곳에 따로 적으면 한쪽만 고쳐지는 날이 온다(F-1 · METAL_MP_NOTE 와 같은 취지) */
const STRIKE_METAL_TEXT = "외부 힘으로 층이 밀려도 자유 전자가 양이온 사이를 계속 돌아다니며 결합을 유지합니다. 층이 밀린 뒤에도 배열과 결합이 그대로 유지되어 결정은 쪼개지지 않습니다 — 금속을 두드려 펼 수 있는 이유입니다.";
const STRIKE_TEXT = {
  halite: "외부 힘으로 층이 한 칸 밀리면 같은 전하의 이온이 마주 보게 됩니다. 마주 본 같은 전하 사이의 반발력(붉은 점선)으로 결정이 쪼개집니다.",
  copper: STRIKE_METAL_TEXT,
  iron: STRIKE_METAL_TEXT,
  ice: "외부 힘에 분자 사이의 수소 결합이 먼저 끊어져 부스러집니다. 분자 안의 공유 결합은 끊어지지 않아 물 분자는 통째로 떨어져 나갑니다.",
  dryice: "외부 힘에 분자 사이를 붙잡는 약한 힘(분산력)을 이겨내며 분자째 떨어져 나가 부스러집니다. 분자 안의 공유 결합은 끊어지지 않습니다.",
  haliteRepel: "같은 전하가 마주 보게 되었습니다 — 붉은 점선은 이온 사이의 반발력입니다(결합봉이 아닙니다). 반발을 보이기 위해 타격 중에는 이온을 작게 그립니다.",
  rubber: "고무는 사슬 사이를 잇는 다리(노란 황)가 잡아당겨, 늘어났다가 원래 모양으로 되돌아옵니다. 사슬도 다리도 끊어지지 않습니다 — 결정처럼 쪼개지지 않는 까닭입니다.",
  rubberStretch: "사슬이 당겨져 늘어나고 있습니다. 사슬 사이를 잇는 노란 다리(가황)가 함께 늘어나며 되돌리는 힘을 냅니다 — 끊어지지 않습니다.",
  polystyrene: "금이 벌어지며 갈라집니다. 사슬 사이를 붙잡는 약한 힘이 먼저 풀리고, 갈라지는 자리에서는 사슬이 뽑혀 길게 늘어납니다. 사슬 안의 공유 결합은 끊어지지 않지만, 고무와 달리 사슬을 이어 주는 다리가 없어 되돌아오지 못합니다.",
  polystyreneCrack: "금이 벌어지고 있습니다 — 사슬 사이가 먼저 풀리고, 갈라지는 자리에서 사슬이 뽑혀 늘어납니다."
};
const STRIKE_ZOOM_HINT = " 이제 「망치로 내려치기」를 쓸 수 있습니다 — 왼쪽 그림 아래 버튼을 보세요.";

function strikeAvailable() {
  return !cmpOn && gl && blend(zoomV) >= 0.85 && STRIKE_MODE[mineral.id];
}
function strikeReset() {
  strike.on = false; strike.mnrId = null; strike.phase = "idle"; strike.t = 0;
  strike.plan = null; strike.l3 = null; strike.primMask = null;
  strike.maskOn = false; strike.repelAlpha = 0;
  strikeRepelDrawn = 0;
  strikeShowNote();
  strikeButtons();
}
function strikeStart() {
  if (!strikeAvailable() || !lat3) return;
  const plan = strikePlan(lat3, mineral.id);
  if (!plan) return;
  strike.on = true; strike.mnrId = mineral.id; strike.plan = plan; strike.l3 = lat3;
  strike.primMask = strikeBuildMask(lat3, plan.brokenBonds);
  /* 움직임을 줄이도록 설정한 기기에서는 애니메이션을 생략하고 **곧바로 최종 상태**를 보여 준다.
     파문·점멸·흔들림은 어느 경우에도 쓰지 않는다(매뉴얼 §10). */
  strike.phase = REDUCE_MOTION ? "done" : "swing";
  strike.t = 0;
  strikeComputeOffsets();
  strikeShowNote(); strikeButtons();
}
/* 노출 조건이 무너졌거나(비교 모드·배율 하향·비대상 광물) 격자가 갈렸으면 즉시 되돌린다 */
function strikeSync() {
  if (strike.on && (!strikeAvailable() || strike.mnrId !== mineral.id || strike.l3 !== lat3)) strikeReset();
  strikeButtons();
}
function strikeButtons() {
  const av = !!strikeAvailable();
  $("strikeBtn").style.display = av ? "" : "none";
  $("strikeReset").style.display = (av && strike.phase !== "idle") ? "" : "none";
}
function strikeShowNote() {
  const el = $("strikeNote");
  let t = "";
  if (strike.on) {
    /* repel 문구는 **split 이 끝날 때까지** 그대로 둔다 — split 0.8 s 동안 캡션이 사라졌다가
       done 문구로 다시 뜨면 화면이 깜빡이고, 정작 조각이 갈라지는 순간에 설명이 없다(S-검토 B B-1) */
    if (strike.mnrId === "halite" && (strike.phase === "repel" || strike.phase === "split")) t = STRIKE_TEXT.haliteRepel;
    /* 고무는 늘어나는 동안에도 설명이 있어야 한다 — 되돌아오는 힘이 어디서 나오는지가
       그 구간에 보이기 때문이다(늘어난 노란 다리). */
    else if (strike.mnrId === "rubber" && (strike.phase === "stretch" || strike.phase === "recoil")) t = STRIKE_TEXT.rubberStretch;
    else if (strike.mnrId === "polystyrene" && strike.phase === "crack") t = STRIKE_TEXT.polystyreneCrack;
    else if (strike.phase === "done") t = STRIKE_TEXT[strike.mnrId] || "";
  }
  el.textContent = t;
  /* ⚠ 빈 문자열("")로 되돌리면 페이지 CSS 의 `#strikeNote{display:none}` 이 다시 이겨 캡션이
     화면에 뜨지 않는다(실측으로 잡은 결함). 켤 때는 반드시 값을 명시한다. */
  el.style.display = t ? "block" : "none";
}
function strikeStep(dt) {
  if (!strike.on) return;
  const seq = STRIKE_SEQ[strike.plan.mode];
  if (strike.phase !== "done") {
    strike.t += dt;
    let dur = STRIKE_T[strike.phase];
    while (strike.phase !== "done" && dur && strike.t >= dur) {
      strike.t -= dur;
      strike.phase = seq[seq.indexOf(strike.phase) + 1];
      dur = STRIKE_T[strike.phase];
      strikeShowNote(); strikeButtons();
    }
  }
  strikeComputeOffsets();
}
$("strikeBtn").onclick = strikeStart;
$("strikeReset").onclick = strikeReset;
/* 검증 전용 훅 — 화면에는 아무것도 표시하지 않는다(§5 금지-⑧) */
window.__MINERAL_STRIKE__ = function () {
  return {
    phase: strike.phase, mnrId: strike.mnrId,
    repelDrawn: strikeRepelDrawn, rUnitNow: strikeRUnitNow
  };
};

/* ── 성능: DPR 상한·저사양 자동 강하 ── */
let dprCapUser = Math.min(window.devicePixelRatio || 1, 2);
let dprCap = dprCapUser;
let raySteps = 80;
let frameTimes = [];
function trackPerf(dtMs) {
  frameTimes.push(dtMs);
  if (frameTimes.length > 30) frameTimes.shift();
  if (frameTimes.length === 30) {
    const avg = frameTimes.reduce((a, b) => a + b, 0) / 30;
    if (avg > 22 && (dprCap > 1 || raySteps > 48 || farFloor < 0.3)) {
      /* 저사양 기기 — 해상도와 광선 수를 낮추고, 이어짐을 보여 주는 **주변부**를
         옅은 쪽부터 덜 그린다. 가운데 선명한 부분과 화면 밖으로 이어지는 인상은 남는다. */
      dprCap = 1; raySteps = 48; farFloor = 0.20; resize();
    }
  }
}

/* ── 크기·루프 ── */
function fit2d(c, hCss) {
  const dpr = dprCap;
  c.style.height = hCss + "px";
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  /* #stagePair 의 자식(glWrap·latWrap)은 겹쳐 놓기 위해 position:absolute 다 —
     그러면 부모가 정상 흐름 자식이 없어 높이가 0으로 무너진다. 높이를 직접 지정한다. */
  const w = ($("stagePair").clientWidth || gcv.clientWidth || lcv.clientWidth || 320);
  const h = Math.max(250, Math.min(400, w * 0.78));
  $("stagePair").style.height = h + "px";
  gcv.style.height = h + "px";
  fit2d(lcv, h);
  drawGL(); drawLat();
}
let rafId = null, last = 0;
function loop(ts) {
  const dtSec = last ? Math.min(0.08, (ts - last) / 1000) : 0; last = ts;
  trackPerf(dtSec * 1000);
  if (spinning && !dragging) spin += dtSec * 0.35;
  strikeStep(dtSec);
  drawGL();
  rafId = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; last = 0; }
  else if (!rafId) rafId = requestAnimationFrame(loop);
});
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("glWrap"));
window.addEventListener("resize", resize);
if (matchMedia("(prefers-reduced-motion:reduce)").matches) { spinning = false; $("spinBtn").textContent = "회전 시키기"; }

initGL();
lattice = makeLattice(mineral, rnd);
lat3 = makeLattice3D(mineral, rnd);
buildPicker(); buildCmpSelectors(); buildPresetChips();
info(); showPick(); applyZoom();
rafId = requestAnimationFrame(loop);
