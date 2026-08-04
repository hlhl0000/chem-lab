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
    }
  ],
  ZOOM: { min: 0, max: 100, step: 1 }   // 0 = 손에 든 크기, 100 = 입자 크기
};

const mById = id => MIN.LIST.find(m => m.id === id);

/* 확대 배율 — 슬라이더 0~100 을 1배 ~ 10⁹배로 (로그) */
function magnification(z) { return Math.pow(10, (z / 100) * 9); }
function zoomLabel(z) {
  const m = magnification(z);
  if (m < 1e4) return `×${Math.round(m).toLocaleString("ko-KR")}`;
  if (m < 1e8) return `×${(m / 1e4).toFixed(m < 1e6 ? 1 : 0)}만`;
  return `×${(m / 1e8).toFixed(1)}억`;
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




/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), ink: CSSV("--t1"),
  gray: CSSV("--d-gray"), t3: CSSV("--t3"), stageLight: CSSV("--stage-light"),
  green: CSSV("--d-green"), red: CSSV("--d-red"), violet: CSSV("--d-violet")
};
/* ⚠ 아래 두 가지는 토큰으로 바꾸면 안 된다.
   ① 광물의 색은 그 물질의 **실제 겉보기 색**이다 (사이트 테마 색이 아니다).
   ② 원자·이온 색은 CPK 국제 표준을 따른다 (매뉴얼 §4 "값 변경 금지").
      Na #AB5CF2 · Cl #1FF01F · O #FF0D0D · Si (관례) #F0C8A0 · Fe #E06633 · S #FFFF30 · Cu #C88033 · C #404040 · H #FFFFFF
      신규 3종은 C·O·Fe만 쓴다 — 새 CPK 색이 필요 없다(확-14). */
const CPK = {
  Na: "#AB5CF2", Cl: "#1FF01F", O: "#FF0D0D", Si: "#F0C8A0",
  Fe: "#E06633", S: "#FFFF30", Cu: "#C88033", H: "#FFFFFF", C: "#404040"
};
/* 각 광물의 격자에서 자리(s=0,1,…)에 놓이는 입자 */
const SITES = {
  quartz: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }],
  halite: [{ sym: "Na⁺", label: "나트륨 이온 Na⁺", cpk: CPK.Na, r: 0.62 }, { sym: "Cl⁻", label: "염화 이온 Cl⁻", cpk: CPK.Cl, r: 1.0 }],
  pyrite: [{ sym: "Fe", label: "철 Fe", cpk: CPK.Fe, r: 1.0 }, { sym: "S", label: "황 S", cpk: CPK.S, r: 0.80 }],
  copper: [{ sym: "Cu", label: "구리 원자 Cu (양이온 + 자유 전자)", cpk: CPK.Cu, r: 1.0 }],
  ice: [{ sym: "O", label: "산소 O (물 분자의 중심)", cpk: CPK.O, r: 1.0 }, { sym: "H", label: "수소 H", cpk: CPK.H, r: 0.50 }],
  obsidian: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }],
  diamond: [{ sym: "C", label: "탄소 C", cpk: CPK.C, r: 1.0 }],
  iron: [{ sym: "Fe", label: "철 Fe (양이온 + 자유 전자)", cpk: CPK.Fe, r: 1.0 }],
  dryice: [{ sym: "C", label: "탄소 C (분자 중심)", cpk: CPK.C, r: 0.66 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.74 }]
};

let mineral = MIN.LIST[0];
let zoomV = 0;
let lattice = null;
let picked = -1;
let spin = 0, spinning = true;
let rndSeed = 20260731;
const rnd = () => { rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff; return rndSeed / 0x7fffffff; };

/* ── 비교 모드 상태 ── */
let cmpOn = false;
let mineralL = mById("quartz"), mineralR = mById("obsidian");
let latticeL = null, latticeR = null;
let pickedL = -1, pickedR = -1;

const PRESETS = [
  { label: "석영 ↔ 흑요석", l: "quartz", r: "obsidian", note: "결정 ↔ 비결정" },
  { label: "얼음 ↔ 드라이아이스", l: "ice", r: "dryice", note: "분자 결정 2종 — 수소 결합 ↔ 분산력" },
  { label: "구리 ↔ 철", l: "copper", r: "iron", note: "금속 결정 2종 — 쌓인 방식" },
  { label: "석영 ↔ 다이아몬드", l: "quartz", r: "diamond", note: "공유 결정 2종" },
  { label: "암염 ↔ 드라이아이스", l: "halite", r: "dryice", note: "이온 ↔ 분자 — 결합 유형 교차 대비" }
];

/* ============================================================
   WebGL — 광물 표본 (거시)
   구·정육면체·육각기둥·팔면체·둥근육면체·불규칙 조각을 광선행진으로 그리고
   금속성·거칠기·투명도를 준다. 연속 줌: zoomScale 로 물체를 카메라 쪽으로
   "키우면서" 표면 결 주파수를 함께 올려 배율에 따라 연속으로 바뀌게 한다.
   ⚠ 실제 광물 사진이 아니라 **재질을 흉내 낸 그림**이다. 활동지에 적어 두었다.
   ============================================================ */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }`;
const FRAG = `precision highp float;
varying vec2 uv;
uniform vec2 res; uniform float time; uniform float spin;
uniform vec3 base; uniform float metal; uniform float rough; uniform float opac;
uniform float shape;   // 0=cube 1=prism 2=blob 3=octa 4=rcube 5=chunk
uniform float grain;   // 표면 거칠기(광택 반대)
uniform float zoomScale;  // 연속 줌 — 1(=배율 0)~4(=배율 55 이상)
uniform float maxSteps;   // 저사양 강하 시 광선행진 반복 수를 줄인다

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
  mat3 R = roty(spin)*rotx(-0.42);
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
    mat3 Rinv = rotx(0.42) * roty(-spin);
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
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}`;

const gcv = $("gl");
let gl = null, prog = null, U = {};
function initGL() {
  gl = gcv.getContext("webgl", { antialias: true, alpha: false }) || gcv.getContext("experimental-webgl");
  if (!gl) { $("glFallback").style.display = "block"; return false; }
  const mk = (ty, src) => {
    const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { $("glFallback").style.display = "block"; return false; }
  prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { $("glFallback").style.display = "block"; return false; }
  gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ["res", "time", "spin", "base", "metal", "rough", "opac", "shape", "grain", "zoomScale", "maxSteps"])
    U[n] = gl.getUniformLocation(prog, n);
  return true;
}
function shapeNum(s) {
  return { cube: 0, prism: 1, blob: 2, octa: 3, rcube: 4, chunk: 5, chip: 6 }[s] ?? 2;
}
function zoomScaleFor(z) { return 1 + Math.min(Math.max(z, 0), ZOOM_BLEND_START) / ZOOM_BLEND_START * 3; }

function drawOneGL(m, x, y, w, h, fullW, fullH) {
  gl.viewport(x, y, w, h);
  gl.scissor(x, y, w, h);
  gl.uniform2f(U.res, w, h);
  gl.uniform1f(U.time, spin);
  gl.uniform1f(U.spin, spin);
  gl.uniform3f(U.base, m.color[0], m.color[1], m.color[2]);
  gl.uniform1f(U.metal, m.metal);
  gl.uniform1f(U.rough, m.rough);
  gl.uniform1f(U.opac, m.opacity);
  gl.uniform1f(U.shape, shapeNum(m.shape));
  gl.uniform1f(U.grain, m.kind === "비결정성" ? 0.55 : 0.30);
  gl.uniform1f(U.zoomScale, zoomScaleFor(zoomV));
  gl.uniform1f(U.maxSteps, raySteps);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function drawGL() {
  if (!gl) return;
  const dpr = dprCap;
  const w = Math.max(1, Math.round(gcv.clientWidth * dpr));
  const h = Math.max(1, Math.round((parseFloat(gcv.style.height) || 300) * dpr));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  if (!cmpOn) {
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, gcv.width, gcv.height);
    drawOneGL(mineral, 0, 0, gcv.width, gcv.height);
  } else {
    /* ★ WebGL 컨텍스트는 이 파일 전체에서 하나뿐이다(§5 금지-⑧).
       캔버스 하나를 gl.viewport/gl.scissor 로 좌·우 절반으로 나눠 2회 그린다. */
    gl.enable(gl.SCISSOR_TEST);
    const halfW = Math.floor(gcv.width / 2);
    drawOneGL(mineralL, 0, 0, halfW, gcv.height);
    drawOneGL(mineralR, halfW, 0, gcv.width - halfW, gcv.height);
    gl.disable(gl.SCISSOR_TEST);
  }
}

/* ── 격자 (2D 캔버스) ── */
const lcv = $("lat"), lctx = lcv.getContext("2d");
let latGeom = [];      // 단일 모드
let latGeomL = [], latGeomR = [];   // 비교 모드

function siteOf(mnr, s) { const arr = SITES[mnr.id]; return arr[Math.min(s, arr.length - 1)]; }

/* 한 판(box) 안에 한 표본의 격자를 그린다. ox,oy,S 는 이 판의 좌표계.
   반환값은 클릭 판정 등에 쓸 latGeom 배열. */
function drawLatticePanel(mnr, lat, ox, oy, S, pickedIdx) {
  if (S < 40 || !lat) return [];
  const sites0 = SITES[mnr.id];
  /* 반지름을 최근접 이웃 거리(화면 좌표)에서 유도한다. 이전에는 S*0.050 고정값이라
     지름(0.10S)이 구리 간격(0.0896S)보다 커서 원자가 겹쳤다(재작업 A2). 0.42배 상한으로
     여유(≥ 16 %)를 둔다(요구: 반지름 ≤ 0.45×최근접거리). v3 — 구리·철에만 한정했던 것을
     bondNear가 있는 모든 종(이온·금속·석영)으로 넓힌다 — 석영은 간격(≈6.6px)이 고정
     0.038S보다 좁아 Si·O 원이 서로 파고들어 결합선이 원 밑에 완전히 묻혔다(재작업 v3 권장2).
     min()으로 묶어 간격이 넓은 종은 그대로 0.038S를 쓴다(halite·pyrite는 거의 변화 없음).
     흑요석은 bondNear를 돌려주지 않으므로(위 amorphous 분기) 이 확장과 충돌하지 않고
     그대로 S*0.038을 쓴다. */
  const nearestScreen = lat.bondNear ? lat.bondNear / (1 + 2 * LAT_PAD) : null;
  const rBase = nearestScreen
    ? S * Math.min(0.038, nearestScreen * 0.42)
    : S * 0.038;
  const geom = lat.pts.map(p => ({
    x: ox + (p.x + LAT_PAD) / (1 + 2 * LAT_PAD) * S,
    y: oy + (1 - (p.y + LAT_PAD) / (1 + 2 * LAT_PAD)) * S,
    r: rBase * siteOf(mnr, p.s).r, s: Math.min(p.s, sites0.length - 1)
  }));

  lctx.save();
  lctx.beginPath(); lctx.rect(ox, oy, S, S); lctx.clip();

  /* 결합선 */
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
  } else {
    lctx.strokeStyle = "rgba(40,45,52,0.28)"; lctx.lineWidth = 1.6; lctx.setLineDash([]);
    /* near — 예전에는 화면 좌표계 압축(LAT_PAD)을 반영하지 않은 고정 배율(0.145/0.16)이라
       원본 격자보다 먼 쌍(대각선 이웃 등)까지 이어져 위상이 틀렸다(재작업 A1).
       lat.bondNear(원 격자 좌표의 최근접 거리)를 같은 방식으로 압축해 1.12배 여유만 둔다. */
    const near = lat.bondNear
      ? lat.bondNear / (1 + 2 * LAT_PAD) * S * 1.12
      : S * (mnr.kind === "비결정성" ? 0.16 : 0.145);
    /* 이종 전용 결합선 — 같은 종류 입자끼리는 실제로 직접 결합하지 않는다.
       이온 결정(암염·황철석): Na⁺–Na⁺·Cl⁻–Cl⁻ 없음, Na⁺–Cl⁻만.
       석영: Si–Si·O–O 없음, Si–O만 (재작업 — 오케스트레이터 지적, ⑤-1). 실측(topology_check.js):
       필터 적용 후 고립 원자 0.5%(경계 클리핑 1개/192, 그물 위상은 그대로 유지)로 확인.
       흑요석은 같은 SITES(Si/O)를 쓰지만 이 필터를 적용하지 않는다 — 무작위 배치라
       적용 시 그물이 더 끊겨 보이고(§7 ⑤ 참조), "불규칙하지만 이어져 있다"는 그림 목적에
       역행하므로 미적용으로 판단했다(topology_check.js 실측 참조). */
    const heteroOnly = mnr.id === "halite" || mnr.id === "pyrite" || mnr.id === "quartz";
    for (let i = 0; i < geom.length; i++) for (let j = i + 1; j < geom.length; j++) {
      const a = geom[i], b = geom[j];
      if (heteroOnly && a.s === b.s) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < near) { lctx.beginPath(); lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke(); }
    }
  }
  /* 다이아몬드 — 4번째 결합 방향(지면 안쪽)을 짧은 방사 표시로 덧그려
     "원자마다 결합 방향이 4개"라는 것을 읽을 수 있게 한다 */
  if (mnr.id === "diamond") {
    lctx.strokeStyle = "rgba(31,35,40,0.40)"; lctx.lineWidth = 1.4;
    geom.forEach((g, i) => {
      const ang = (lat.pts[i].puck ? 1 : -1) * 0.9 + 1.571;
      lctx.beginPath(); lctx.moveTo(g.x, g.y);
      lctx.lineTo(g.x + Math.cos(ang) * g.r * 1.5, g.y + Math.sin(ang) * g.r * 1.5); lctx.stroke();
    });
  }
  /* 입자 — CPK 색 + 외곽선 (밝은 무대에서 흰 원자가 사라지지 않게, 매뉴얼 §4) */
  geom.forEach((g, i) => {
    const s = siteOf(mnr, g.s);
    lctx.fillStyle = s.cpk;
    lctx.strokeStyle = darken(s.cpk, 0.5); lctx.lineWidth = 1;
    lctx.beginPath(); lctx.arc(g.x, g.y, g.r, 0, 6.2832);
    lctx.fill(); lctx.globalAlpha = 0.85; lctx.stroke(); lctx.globalAlpha = 1;
    /* 색각 2번째 채널 — 원 안에 원소 기호를 직접 쓴다(디자인매뉴얼 §9).
       임계 9px→6px→4.5px로 낮춘다 — 비교 모드는 화면에 CPK 색이 4개를 넘을 수 있어 이 채널이
       필수인데, 6px 상한에서도 비교 모드(S≈230px)의 석영 O처럼 반지름 4.7px인 원자는 기호가
       빠져 같은 화면의 흑요석 O(기호 있음)와 비일관했다(S-검토 조건부 1건). 폰트는
       Math.max(7, …)로 하한을 유지하므로 4.5px 반지름에서도 글자가 7px 밑으로 줄지 않는다. */
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
  /* 규칙성 안내 — 입자가 상자 가장자리까지 채워져 있어 글자와 겹칠 수 있다
     (작업매뉴얼 4부 ⑦ "캔버스 글자가 오버레이와 겹쳤다"와 같은 함정).
     텍스트 폭만큼만 판을 깔면 같은 줄의 오른쪽 입자가 판 밖으로 삐져나와 겹쳐 보인다
     (실측으로 발견 — 재발 방지). 정사각형 상단 전체 폭에 띠를 깔아 그 줄의 입자를
     전부 가린다. */
  const label = mnr.kind === "결정성" ? "규칙적으로 되풀이된다 → 결정성 고체" : "되풀이되는 규칙이 없다 → 비결정성 고체";
  lctx.font = "700 12px sans-serif"; lctx.textAlign = "left"; lctx.textBaseline = "alphabetic";
  lctx.fillStyle = C.stageLight;   // 완전 불투명 — 첫 줄 입자가 글자와 겹쳐 보이지 않게 한다(재작업 B7)
  lctx.fillRect(ox, oy, S, 26);
  lctx.fillStyle = mnr.kind === "결정성" ? C.blue : C.amber;
  lctx.fillText(label, ox + 9, oy + 18);
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
/* 토큰 색에 알파를 입힌다 — 새 UI 요소(비교 모드 구분선 등)는 하드코딩 색을 쓰지 않는다
   (§5 금지-⑦, 재작업 B5). */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function drawLat() {
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

function pickCardHTML(mnr, lat, geom, idx) {
  if (idx < 0 || !geom[idx]) return null;
  const s = siteOf(mnr, geom[idx].s);
  const molInfo = lat.bonds ? `<tr><th>분자 번호</th><td>#${lat.pts[idx].mol}</td></tr>` : "";
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
function showPick() {
  const host = $("pick");
  if (!cmpOn) {
    const html = pickCardHTML(mineral, lattice, latGeom, picked);
    host.innerHTML = html || `<div class="pickempty">확대한 뒤 <b>입자를 하나 눌러 보세요.</b>
      그 자리에 무엇이 있고, 이웃과 무엇으로 이어져 있는지 나옵니다.</div>`;
  } else {
    const l = pickCardHTML(mineralL, latticeL, latGeomL, pickedL);
    const r = pickCardHTML(mineralR, latticeR, latGeomR, pickedR);
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
}
function updateBondLegend() {
  const el = $("bondLegend");
  const relevant = cmpOn ? (mineralL.molecular || mineralR.molecular) : mineral.molecular;
  if (!relevant) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "block";
  el.innerHTML = `<b>결합선 범례</b><br>
    <span class="bl-in"></span> 분자 <b>안</b>의 결합(공유 결합, 굵은 실선) &nbsp;
    <span class="bl-between"></span> 분자 <b>사이</b>의 힘(가는 점선)`;
}

/* ── 광물 고르기 (단일 모드) ── */
function buildPicker() {
  const host = $("mpick"); host.innerHTML = "";
  MIN.LIST.forEach(m => {
    const b = document.createElement("button");
    b.className = "mp"; b.setAttribute("aria-pressed", String(m.id === mineral.id));
    b.innerHTML = `<b>${m.name}</b><span>${m.formula}</span><em class="${m.kind === "결정성" ? "cry" : "amo"}">${m.kind}</em>`;
    b.onclick = () => {
      mineral = m; picked = -1; lattice = makeLattice(m, rnd);
      buildPicker(); info(); showPick(); drawGL(); drawLat();
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
       "계산과 실측이 맞는다"고 쓰면 계산값을 문헌 실측값으로 둔갑시키는 순환 서술이 된다
       (재작업 A4). 대조할 단일 문헌 밀도가 없다는 사실을 그대로 적는다. */
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
function setCmpPair(lId, rId) {
  mineralL = mById(lId); mineralR = mById(rId);
  latticeL = makeLattice(mineralL, rnd); latticeR = makeLattice(mineralR, rnd);
  pickedL = -1; pickedR = -1;
  $("cmpLeftSel").value = lId; $("cmpRightSel").value = rId;
  showPick(); drawGL(); drawLat();
}
$("cmpToggle").onchange = e => {
  cmpOn = e.target.checked;
  $("cmpPanel").style.display = cmpOn ? "" : "none";
  $("mpick").style.display = cmpOn ? "none" : "";
  /* 단일 모드의 표본 정보 줄(#mInfo)은 종 하나를 가리킨다 — 비교 모드에서 그대로 두면
     화면에 두 표본이 보이는데 정보는 이전 단일 종 것을 말해 거짓 안내가 된다(B-6).
     스크롤 없이 볼 수 있는 자리이므로 통째로 숨긴다. */
  $("mInfo").style.display = cmpOn ? "none" : "";
  dprCap = cmpOn ? Math.min(dprCapUser, 1.5) : dprCapUser;
  if (cmpOn && !latticeL) { latticeL = makeLattice(mineralL, rnd); latticeR = makeLattice(mineralR, rnd); }
  applyZoom(); showPick();
};
$("cmpLeftSel").onchange = e => setCmpPair(e.target.value, mineralR.id);
$("cmpRightSel").onchange = e => setCmpPair(mineralL.id, e.target.value);

/* ── 확대(연속) ── */
function applyZoom() {
  /* ★ 무대는 하나씩만 있다(#glWrap · #latWrap) — 단일 모드든 비교 모드든 같은 캔버스를
     그대로 쓴다. display:none 을 쓰지 않는다(캔버스가 숨으면 clientWidth 가 0 이 되어
     반지름이 음수가 되는 예전 함정 — 작업매뉴얼 2부 §5 경고). opacity 만 교차시키고,
     opacity 0 인 쪽은 그리기(무거운 작업)만 건너뛴다. */
  const b = blend(zoomV);
  $("glWrap").style.opacity = (1 - b);
  $("latWrap").style.opacity = b;
  $("glWrap").style.pointerEvents = b < 0.5 ? "auto" : "none";
  $("latWrap").style.pointerEvents = b >= 0.5 ? "auto" : "none";
  $("vZoom").textContent = zoomLabel(zoomV);
  $("zoomState").innerHTML = zoomV >= ZOOM_BLEND_END
    ? "지금은 <b>입자 하나하나가 보이는 크기</b>입니다. 배열이 규칙적인지 보세요."
    : (zoomV > ZOOM_BLEND_START
      ? "배율이 커지는 중입니다 — 표본이 <b>서서히 입자 배열로 바뀝니다.</b>"
      : (zoomV > 30
        ? "표면의 결이 보이기 시작합니다. <b>배율이 ×" + Math.round(magnification(ZOOM_BLEND_START)).toLocaleString("ko-KR") + "을 넘으면</b> 입자 배열이 나타납니다."
        : "<b>손에 들고 보는 크기</b>입니다. 이 겉모습만으로 결정인지 알 수 있을까요?"));
  $("pickCard").style.display = zoomV >= ZOOM_BLEND_START ? "" : "none";
  resize();
}
$("sZoom").oninput = e => { zoomV = +e.target.value; applyZoom(); };
$("spinBtn").onclick = () => { spinning = !spinning; $("spinBtn").textContent = spinning ? "회전 멈추기" : "회전 시키기"; };

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
    if (avg > 22 && (dprCap > 1 || raySteps > 48)) {
      dprCap = 1; raySteps = 48; resize();
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
  /* #stagePair 의 자식(glWrap·latWrap)은 크로스페이드를 위해 position:absolute 다 —
     그러면 부모가 정상 흐름 자식이 없어 높이가 0으로 무너진다(§5 경고와 같은 종류의 함정,
     다만 이번엔 display:none 이 아니라 absolute 높이 붕괴다). #stagePair 에 높이를
     직접 지정해 두 무대가 같은 상자를 채우게 한다. */
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
  if (spinning) spin += dtSec * 0.35;
  const b = blend(zoomV);
  const glActive = cmpOn ? true : b < 0.999;
  if (glActive) drawGL();     // opacity 0인 무대는 그려도 안 보이지만, 큰 배율 전환 순간의 끊김을 없애려고 계속 그린다
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
buildPicker(); buildCmpSelectors(); buildPresetChips();
info(); showPick(); applyZoom();
rafId = requestAnimationFrame(loop);
