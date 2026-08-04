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




/* ── 3차원 공-막대 모형 데이터 ───────────────────────────────────────────
   확대 뷰에 실제로 그려지는 배열이다. 2D 함수(makeLattice)는 그대로 둔다 —
   WebGL을 못 쓰는 기기의 폴백과 검증 스크립트(orderIndex·topology)가 그것을 쓴다.

   반환 { atoms, bonds, nn, rref, style }
     atoms — [{x,y,z,s,role?,mol?}]  반지름 L3_R 인 공 안쪽으로 잘라낸 덩어리
     bonds — [[i,j,kind]]  kind: "in"(공유·이온 연결선) | "hb"(분자 사이 — 점선)
     nn    — 가장 가까운 이웃 거리(모형 단위)
     rref  — 공 반지름을 정하는 기준 길이(가장 짧은 연결선 길이)
     style — "stick" 공+막대 / "pack" 공만(금속 결합은 방향이 정해진 연결선이 없다)

   ⚠ 실제 결정에서 잘라낸 일부이며 되풀이되는 단위 자체가 아니다.
     공 크기 비는 보기 좋게 조정했고, 석영·얼음·황철석·흑요석은 이웃 관계만 같게 둔
     단순화 모형이다. 이 사실은 화면의 「이 모형의 가정과 한계」에 적는다. */

const L3_R = 1.0;         // 잘라내는 공의 반지름(모형 단위)
const L3_TARGET = 150;    // 한 판에 그릴 원자 수 목표

function l3InBall(x, y, z) { return x * x + y * y + z * z <= L3_R * L3_R + 1e-9; }

/* 같은 골격을 간격만 바꿔 다시 만들어, 원자 수가 목표 이하가 되는 첫 결과를 쓴다.
   간격을 손으로 맞추면 잘라내는 경계에서 개수가 계단식으로 튀어 조절이 되지 않는다. */
function l3Fit(build, u0, target) {
  const cap = target || L3_TARGET;
  let u = u0, r = build(u);
  for (let t = 0; t < 12 && r.atoms.length > cap; t++) { u *= 1.13; r = build(u); }
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
  return { atoms, bonds: [], nn, rref: nn, style: "pack" };
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
  return { atoms, bonds: [], nn, rref: nn, style: "pack" };
}

/* 두 이온이 번갈아 놓인 쌓임(암염) */
function l3RockSalt(u) {
  const atoms = [], h = u / 2, n = Math.ceil(2 * L3_R / h) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const x = i * h, y = j * h, z = k * h;
    if (!l3InBall(x, y, z)) continue;
    atoms.push({ x, y, z, s: ((i + j + k) % 2 + 2) % 2 });
  }
  const nn = h;
  return { atoms, bonds: l3BondsByDist(atoms, nn * 1.05, true), nn, rref: nn, style: "stick" };
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
  /* 철 자리 ↔ 황 — 서로 다른 자리끼리만 잇는다 */
  const cross = l3BondsByDist(atoms, h * 1.28, true);
  return { atoms, bonds: bonds.concat(cross), nn: h, rref: 0.40 * u, style: "stick" };
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
  return { atoms: pts, bonds: l3BondsByDist(pts, nn * 1.08, false), nn, rref: nn, style: "stick" };
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
  return { atoms, bonds, nn: nn / 2, rref: nn / 2, style: "stick" };
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
  return { atoms, bonds, nn, rref: nn * 0.36, style: "stick" };
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
  return { atoms, bonds, nn: u * Math.SQRT1_2, rref: 0.206 * u, style: "stick" };
}

/* 흑요석 — 이어져 있으나 되풀이되는 규칙이 없는 그물.
   규소 자리를 규칙 없이 흩어 놓고, 가까운 이웃끼리 이어 그 사이마다 산소를 끼운다. */
function l3Amorphous(rnd) {
  const pts = [], minD = 0.30;
  let guard = 0;
  while (pts.length < 46 && guard++ < 9000) {
    const x = (rnd() * 2 - 1) * L3_R, y = (rnd() * 2 - 1) * L3_R, z = (rnd() * 2 - 1) * L3_R;
    if (!l3InBall(x, y, z)) continue;
    let ok = true;
    for (const q of pts) { const dx = q.x - x, dy = q.y - y, dz = q.z - z; if (dx * dx + dy * dy + dz * dz < minD * minD) { ok = false; break; } }
    if (ok) pts.push({ x, y, z, s: 0 });
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

function makeLattice3D(m, rnd) {
  if (m.id === "copper") return l3Fit(l3Fcc, 0.34, 430);
  if (m.id === "iron") return l3Fit(l3Bcc, 0.30, 430);
  if (m.id === "halite") return l3Fit(l3RockSalt, 0.60);
  if (m.id === "pyrite") return l3Fit(l3Pyrite, 0.86);
  if (m.id === "diamond") return l3Fit(l3Diamond, 0.52);
  if (m.id === "quartz") return l3Fit(l3Bridged, 0.80);
  if (m.id === "ice") return l3Fit(l3Ice, 0.86);
  if (m.id === "dryice") return l3Fit(l3DryIce, 0.66);
  return l3Amorphous(rnd);
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
/* 각 광물의 배열에서 자리(s=0,1,…)에 놓이는 입자 */
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
let lattice = null;        // 폴백(2D)용
let lat3 = null;           // 확대 뷰(3D 공-막대)용
let picked = -1;
let spin = 0, tilt = -0.42, spinning = true;
let rndSeed = 20260731;
const rnd = () => { rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff; return rndSeed / 0x7fffffff; };

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
  { label: "암염 ↔ 드라이아이스", l: "halite", r: "dryice", note: "이온 ↔ 분자 — 결합 유형 교차 대비" }
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
attribute vec3 aPerp; attribute vec2 aParam;
uniform mat4 uProj;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec2 vParam;
void main(){
  vLocal = aLocal; vCol = aCol; vPerp = aPerp; vParam = aParam;
  gl_Position = uProj * vec4(aPos, 1.0);
}`;
const FRAG3 = `precision mediump float;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec2 vParam;
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
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), uAlpha);
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
function zoomScaleFor(z) { return 1 + Math.min(Math.max(z, 0), ZOOM_BLEND_START) / ZOOM_BLEND_START * 3; }
/* 확대 뷰의 모형 크기 — 크로스페이드가 시작될 때 작게 들어와 배율과 함께 계속 커진다.
   표본(zoomScale)이 55에서 멈추고 그 뒤로는 이 값이 이어받아 확대가 끊기지 않는다. */
function latScaleFor(z) {
  const t = Math.min(Math.max((z - ZOOM_BLEND_START) / (100 - ZOOM_BLEND_START), 0), 1);
  return 0.42 + t * 1.05;
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
  gl.uniform1f(U.grain, m.kind === "비결정성" ? 0.55 : 0.30);
  gl.uniform1f(U.zoomScale, zoomScaleFor(zoomV));
  gl.uniform1f(U.maxSteps, raySteps);
  gl.uniform1f(U.bgMix, Math.min(1, blend(zoomV) * 1.18));
  gl.uniform3f(U.stageBg, STAGE_RGB[0], STAGE_RGB[1], STAGE_RGB[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ── 확대 뷰(3D) — 정점 만들기 ──────────────────────────────── */
const FPV = 13;                       // 정점 하나가 쓰는 float 수
let vArr = new Float32Array(0), iArr = new Uint16Array(0);
let vHead = 0, iHead = 0, primCount = 0;
function ensureCap(prims) {
  const needV = prims * 4 * FPV, needI = prims * 6;
  if (vArr.length < needV) vArr = new Float32Array(Math.ceil(needV * 1.6));
  if (iArr.length < needI) iArr = new Uint16Array(Math.ceil(needI * 1.6));
}
function putVert(px, py, pz, lx, ly, cr, cg, cb, ex, ey, ez, kind, dash) {
  const o = vHead;
  vArr[o] = px; vArr[o + 1] = py; vArr[o + 2] = pz;
  vArr[o + 3] = lx; vArr[o + 4] = ly;
  vArr[o + 5] = cr; vArr[o + 6] = cg; vArr[o + 7] = cb;
  vArr[o + 8] = ex; vArr[o + 9] = ey; vArr[o + 10] = ez;
  vArr[o + 11] = kind; vArr[o + 12] = dash;
  vHead += FPV;
}
function quadIndices() {
  const b = primCount * 4;
  iArr[iHead] = b; iArr[iHead + 1] = b + 1; iArr[iHead + 2] = b + 2;
  iArr[iHead + 3] = b; iArr[iHead + 4] = b + 2; iArr[iHead + 5] = b + 3;
  iHead += 6; primCount++;
}
function emitSphere(cx, cy, cz, r, col) {
  putVert(cx - r, cy - r, cz, -1, -1, col[0], col[1], col[2], 0, 0, 0, 0, 0);
  putVert(cx + r, cy - r, cz, 1, -1, col[0], col[1], col[2], 0, 0, 0, 0, 0);
  putVert(cx + r, cy + r, cz, 1, 1, col[0], col[1], col[2], 0, 0, 0, 0, 0);
  putVert(cx - r, cy + r, cz, -1, 1, col[0], col[1], col[2], 0, 0, 0, 0, 0);
  quadIndices();
}
function emitStick(ax, ay, az, bx, by, bz, w, col, kind, dash) {
  /* 화면에 놓이는 띠 — 축과 수직인 방향은 시선축(0,0,1)과의 외적으로 잡는다.
     축이 시선과 거의 나란하면(정면에서 본 막대) 띠가 사라지므로 그리지 않는다. */
  const dx = bx - ax, dy = by - ay;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-5) return;
  const ex = dy / L, ey = -dx / L;
  const ox = ex * w, oy = ey * w;
  putVert(ax + ox, ay + oy, az, -1, 1, col[0], col[1], col[2], ex, ey, 0, kind, dash);
  putVert(bx + ox, by + oy, bz, 1, 1, col[0], col[1], col[2], ex, ey, 0, kind, dash);
  putVert(bx - ox, by - oy, bz, 1, -1, col[0], col[1], col[2], ex, ey, 0, kind, dash);
  putVert(ax - ox, ay - oy, az, -1, -1, col[0], col[1], col[2], ex, ey, 0, kind, dash);
  quadIndices();
}

/* 원자·막대를 한 덩어리의 "그릴 것" 목록으로 만들어 lat3 에 붙여 둔다.
   [종류, a, b] — 종류 0=원자, 1=막대(실선) 2=막대(점선). 막대는 두 쪽으로 나눠
   각각 자기 쪽 원자 색으로 그린다(양쪽 색이 다른 표준 공-막대 그림). */
function primsOf(l3) {
  if (l3._prims) return l3._prims;
  const P = [];
  for (let i = 0; i < l3.atoms.length; i++) P.push([0, i, -1]);
  for (const [i, j, kind] of l3.bonds) {
    const k = kind === "hb" ? 2 : 1;
    P.push([k, i, j], [k, j, i]);
  }
  l3._prims = P;
  return P;
}
const COL_CACHE = {};
function colOf(mnr, s) {
  const site = SITES[mnr.id][Math.min(s, SITES[mnr.id].length - 1)];
  const key = site.cpk;
  if (!COL_CACHE[key]) COL_CACHE[key] = hexToRgb01(key);
  return COL_CACHE[key];
}
function siteOf(mnr, s) { const arr = SITES[mnr.id]; return arr[Math.min(s, arr.length - 1)]; }

const CAM_Z = 3.35, FOVY = 0.72;
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
let vpBuf = new Float32Array(0);      // 원자의 시점 좌표
let zBuf = new Float32Array(0);       // 그릴 것들의 깊이
let ordBuf = null;                    // 깊이 순서

/* 한 판에 3차원 공-막대 모형을 그린다.
   x,y,w,h — 픽셀 뷰포트 / rect — 클릭 판정에 쓸 CSS 픽셀 사각형
   store — 원자의 화면 좌표를 담아 둘 배열(클릭 판정용) */
function drawLattice3D(mnr, l3, x, y, w, h, alpha, pickedIdx, rect, store) {
  if (!l3 || w < 8 || h < 8) { if (store) store.length = 0; return; }
  const atoms = l3.atoms, N = atoms.length;
  const P = primsOf(l3);
  /* 판이 좁으면(비교 모드·좁은 화면) 덩어리가 좌우로 잘린다 — 판의 가로세로 비에 맞춰 줄인다 */
  const scale = latScaleFor(zoomV) * Math.min(1, (w / h) / 1.9);
  /* 표본 무대는 광선을 돌린다(물체는 반대로 도는 것처럼 보인다). 두 무대가 같은 방향으로
     돌아야 하므로 모형에는 부호를 뒤집어 준다. */
  const yaw = -spin, pitch = -tilt;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);

  if (vpBuf.length < N * 3) vpBuf = new Float32Array(N * 3 * 2);
  for (let i = 0; i < N; i++) {
    const a = atoms[i];
    const X = a.x * scale, Y = a.y * scale, Z = a.z * scale;
    const x1 = cy * X + sy * Z, z1 = -sy * X + cy * Z;
    const y2 = cx * Y - sx * z1, z2 = sx * Y + cx * z1;
    vpBuf[i * 3] = x1; vpBuf[i * 3 + 1] = y2; vpBuf[i * 3 + 2] = z2 - CAM_Z;
  }

  if (zBuf.length < P.length) { zBuf = new Float32Array(P.length * 2); }
  if (!ordBuf || ordBuf.length < P.length) ordBuf = new Int32Array(P.length * 2);
  const ord = ordBuf.subarray(0, P.length);
  for (let k = 0; k < P.length; k++) {
    const p = P[k];
    if (p[0] === 0) zBuf[k] = vpBuf[p[1] * 3 + 2];
    else zBuf[k] = (vpBuf[p[1] * 3 + 2] * 0.75 + vpBuf[p[2] * 3 + 2] * 0.25);
    ord[k] = k;
  }
  ord.sort((a, b) => zBuf[a] - zBuf[b]);   // 먼 것(더 작은 z)부터

  const rUnit = l3.style === "pack" ? l3.nn * 0.50 : l3.rref * 0.40;
  const stickW = Math.max(rUnit * 0.24, l3.rref * 0.085);
  ensureCap(P.length + 2);
  vHead = 0; iHead = 0; primCount = 0;

  for (let n = 0; n < P.length; n++) {
    const p = P[ord[n]];
    if (p[0] === 0) {
      const i = p[1], a = atoms[i];
      const r = rUnit * siteOf(mnr, a.s).r * scale;
      const col = colOf(mnr, a.s);
      if (i === pickedIdx) {
        emitSphere(vpBuf[i * 3], vpBuf[i * 3 + 1], vpBuf[i * 3 + 2], r * 1.34, BLUE_RGB);
      }
      emitSphere(vpBuf[i * 3], vpBuf[i * 3 + 1], vpBuf[i * 3 + 2], r, col);
    } else {
      const i = p[1], j = p[2];
      const axv = vpBuf[i * 3], ayv = vpBuf[i * 3 + 1], azv = vpBuf[i * 3 + 2];
      const bxv = (vpBuf[i * 3] + vpBuf[j * 3]) / 2;
      const byv = (vpBuf[i * 3 + 1] + vpBuf[j * 3 + 1]) / 2;
      const bzv = (vpBuf[i * 3 + 2] + vpBuf[j * 3 + 2]) / 2;
      const col = colOf(mnr, atoms[i].s);
      const wOut = (p[0] === 2 ? stickW * 0.62 : stickW) * scale;
      emitStick(axv, ayv, azv, bxv, byv, bzv, wOut, col, p[0], p[0] === 2 ? 5 : 0);
    }
  }

  gl.viewport(x, y, w, h);
  gl.scissor(x, y, w, h);
  persp(PROJ, FOVY, w / h, 0.1, 30);
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
  gl.enableVertexAttribArray(A3.aParam); gl.vertexAttribPointer(A3.aParam, 2, gl.FLOAT, false, st, 44);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo3);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, iArr.subarray(0, iHead), gl.DYNAMIC_DRAW);
  gl.drawElements(gl.TRIANGLES, iHead, gl.UNSIGNED_SHORT, 0);
  gl.disableVertexAttribArray(A3.aPos); gl.disableVertexAttribArray(A3.aLocal);
  gl.disableVertexAttribArray(A3.aCol); gl.disableVertexAttribArray(A3.aPerp);
  gl.disableVertexAttribArray(A3.aParam);

  /* 클릭 판정용 화면 좌표(CSS 픽셀) */
  if (store) {
    store.length = 0;
    const f = 1 / Math.tan(FOVY / 2);
    for (let i = 0; i < N; i++) {
      const vz = vpBuf[i * 3 + 2];
      if (vz > -0.2) continue;
      const ndcX = (f / (w / h)) * vpBuf[i * 3] / -vz;
      const ndcY = f * vpBuf[i * 3 + 1] / -vz;
      const r = rUnit * siteOf(mnr, atoms[i].s).r * scale;
      store.push({
        i, z: vz,
        x: rect.x + (ndcX * 0.5 + 0.5) * rect.w,
        y: rect.y + (0.5 - ndcY * 0.5) * rect.h,
        r: Math.max(3, r * f * 0.5 * rect.h / -vz)
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
function nearestAtom(list, x, y) {
  let best = -1, bd = 1e9;
  for (const g of list) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < g.r + 8 && d < bd) { bd = d; best = g.i; }
  }
  return { idx: best, d: bd };
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
  } else {
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
}
function updateBondLegend() {
  const el = $("bondLegend");
  const list = cmpOn ? [mineralL, mineralR] : [mineral];
  const mols = list.filter(m => m.molecular);
  if (!mols.length) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "block";
  const hasHb = mols.some(m => m.id === "ice");
  const hasNone = mols.some(m => m.id === "dryice");
  el.innerHTML = `<b>막대 범례</b><br>
    <span class="bl-in"></span> 분자 <b>안</b>의 결합(공유 결합, 굵은 막대)` +
    (hasHb ? ` &nbsp; <span class="bl-between"></span> 분자 <b>사이</b>의 수소 결합(점선)` : "") +
    (hasNone ? `<br><span style="color:var(--t3)">드라이아이스는 분자 <b>사이</b>를 잇는 막대를 그리지 않았습니다 —
      분산력은 방향이 정해진 결합이 아니기 때문입니다. 분자 사이의 <b>틈</b>으로 보세요.</span>` : "");
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
    ? "지금은 <b>입자 하나하나가 보이는 크기</b>입니다. 끌어서 돌려 보고, 입자를 눌러 보세요."
    : (zoomV > ZOOM_BLEND_START
      ? "배율이 커지는 중입니다 — 표본 안쪽의 <b>입자 배열</b>이 떠오릅니다."
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