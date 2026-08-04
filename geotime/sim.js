"use strict";
/* ================================================================
   지질 시대의 바다 — 선캄브리아·고생대·중생대 (계산부)

   ★ 이 시뮬레이션이 반박하려는 생각
     ① M13(★ 이 차시 오개념) "화석이 거의 없다 = 그 시대에 생물이 거의 없었다"
        → 선캄브리아 해저에 이 화면에서 가장 큰 물체(스트로마톨라이트, 높이 1.8~2.6 m)가
          서 있다. 없는 것은 「단단한 부분」과 「헤엄치는 것」이지 생물 자체가 아니다.
     ② M2 "스트로마톨라이트는 남세균만 쌓인 화석이다" → 층상 구조로 "번갈아 쌓임"을 보인다.
     ③ M12 "네 시대의 길이가 비슷하다" → 지질 시대 길이 막대(88.2:6.3:4.1:1.4)로 반박한다.
     ④ M3(하늘을 나는 파충류를 공룡으로 오인) → 하늘을 나는 실루엣을 아예 그리지 않는다(§5 금지 5).

   데이터의 유일한 원천은 이 파일의 GEO 객체다. sim.js 는 이 파일의 마커 위쪽과
   바이트 단위로 같다(F-1). DOM·WebGL·CSS 를 참조하지 않으며 Node 에서 그대로 돈다.
   ================================================================ */

/* ---------------- 결정적 난수 (mineral/sim.js 와 같은 LCG 방식) ---------------- */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/* ---------------- 작은 벡터 도우미 ---------------- */
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]),
  norm: a => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};

/* ================================================================
   화면 문구 — §3 3-D·3-E 가 확정한 전문. 실행자가 임의로 만들지 않는다.
   고정 12 + 시대 도입 카드 3 + 정지점 안내 9 = 24, 그 밖은 각 절에 따로 확정.
   ================================================================ */
const TEXT = {
  h1: "지질 시대의 바다 — 선캄브리아·고생대·중생대",
  subhead: "정해진 길을 따라 세 시대의 바닷속을 지나갑니다. 길에서 벗어날 수는 없고, 고개만 돌릴 수 있습니다. 세 가지만 보세요.",
  tabHint: "순서대로 봅니다. 앞 시대를 다 봐야 다음 시대가 열립니다.",
  dragHint: "화면을 끌면 고개가 돌아갑니다. 화살표 키도 됩니다.",
  edgeHint: "여기까지 볼 수 있어요.",
  tutorial: [
    "① 화면을 좌우로 끌어 보세요.",
    "② 위아래로도 끌어 보세요. 수면이 보입니다.",
    "③ [일시정지]와 [10초 되감기]를 눌러 보세요. 놓친 것은 다시 볼 수 있습니다."
  ],
  glAriaTemplate: "정해진 길을 따라 바닷속을 1인칭으로 지나가는 3차원 그림. 지금은 {era}이고 {stop}번째 멈춘 자리입니다. 화면에는 {bottom}과 {swim}이 보입니다.",
  flatAriaTemplate: "{era} 바다의 단면 그림. 위는 수면과 육지, 아래는 바닷속입니다.",
  introCard: {
    precambrian: "선캄브리아시대의 바다입니다. 지금부터 4분. 세 가지만 보세요 — ① 생물이 얼마나 많은가 ② 몸에 단단한 부분이 있는가 ③ 바닥에 붙어 있는가, 헤엄치는가.",
    paleozoic: "고생대의 바다입니다. 같은 세 가지를 봅니다. 아까 그 바다와 무엇이 달라졌는지에 눈을 두세요.",
    mesozoic: "환경이 또 바뀌었습니다. 중생대의 바다입니다. 같은 세 가지를 봅니다. 이번에는 무엇이 달라졌나요?"
  },
  finishHint: "위를 올려다보세요. 물 밖에는 무엇이 있나요?",
  todayLine: "환경이 바뀌면 살아남는 생물이 바뀐다.",
  stopBriefing: {
    precambrian: [
      "멈췄습니다. 먼저 앞을 보세요. 물속에 무엇이 보이나요? 이제 아래를 내려다보세요. 바닥에는요?",
      "이 기둥이 이 바다에서 가장 큰 것입니다. 가로로 난 층을 세어 보세요. 초록은 지금 살아 있는 얇은 막이고, 그 아래 층은 쌓인 것입니다. 번갈아 생겼습니다.",
      "지금 보이는 것들 중에 헤엄치는 것이 몇 개나 되나요? 나머지는 어디에 있나요?"
    ],
    paleozoic: [
      "같은 자리, 다른 시대입니다. 앞을 보세요. 아까와 무엇이 다른가요? 아래도 보세요.",
      "가까이 왔습니다. 등에 가로 마디가 보이는 것이 있나요? 몸을 덮은 딱딱한 껍데기는요?",
      "바닥과 중간층을 번갈아 보세요. 아까 그 바다와 비교하면 어느 쪽이 달라졌나요?"
    ],
    mesozoic: [
      "환경이 또 바뀌었습니다. 앞을 보세요. 고생대와 견주면 어떤가요?",
      "나선으로 감긴 껍질을 찾아보세요. 큰 것들의 머리는 둥근가요, 각졌나요?",
      "이제 바닥을 보세요. 그리고 다시 중간층을 보세요. 어느 쪽에 더 많은가요?"
    ]
  },
  dirIndicator: {
    inView: "화면 안에 있어요.",
    left: "◀ 왼쪽을 보세요.",
    right: "오른쪽을 보세요. ▶",
    up: "▲ 위를 보세요."
  },
  lieCardFull: "이 화면의 생물과 바다는 사진이 아니라, 화석 증거를 바탕으로 한 추정을 컴퓨터로 그린 그림입니다. 색깔, 피부 무늬, 헤엄치는 모습, 물의 색은 화석에 남지 않으므로 대부분 만들어 넣은 것입니다. 여기에서 믿을 것은 「무엇이 얼마나 많은가 · 몸에 단단한 부분이 있는가 · 바닥에 붙어 있는가 헤엄치는가」 세 가지뿐입니다.",
  lieStripShort: "이 그림의 색·무늬·움직임은 추정입니다. 믿을 것은 관찰 포인트 세 가지입니다.",
  startButton: "관찰 시작",
  assumptions: [
    "① 생물의 색·피부 무늬·헤엄치는 모습은 화석에 남지 않는다. 이 화면의 색은 사이트 공통 색 세 가지를 뜻을 정해 배정한 것이다 — 주황 = 몸에 단단한 부분이 있음, 보라 = 부드러움, 초록 = 광합성을 하는 생물. 실제 색이 아니다.",
    "② 물의 색과 탁한 정도도 추정이다. 시대마다 다르게 그린 것은 「얕다 / 맑다 / 깊다」를 눈에 보이게 하려는 것이지 실제로 잰 값이 아니다.",
    "③ 개체 수는 화면에서 셀 수 있게 정한 수치다. 실제 바다의 밀도가 아니다. 시대 사이의 많고 적음의 방향만 실제 자료(지도서 78쪽·교과서 19쪽)를 따랐다.",
    "④ 시대마다 생물의 종류를 일곱 가지 이하로 줄였다. 실제로는 훨씬 많다. 이름을 붙인 것은 시대마다 두 가지뿐이다.",
    "⑤ 세 시대의 길이는 전혀 같지 않다. 화면에서는 각 4분씩 보지만, 지질 시대 전체에서 차지하는 길이는 선캄브리아 88.2 % · 고생대 6.3 % · 중생대 4.1 % · 신생대 1.4 %다. 화면 아래 막대가 그 비를 보여 준다.",
    "⑥ 하늘을 나는 생물을 그리지 않았다. 교과서 19쪽 그림에는 중생대 하늘에 익룡이 있다. 익룡은 공룡이 아니다 — 공룡과 같은 조상에서 따로 갈라진 무리이고, 중생대 말에 완전히 멸종했다. 그림이 그것을 말해 줄 수 없어서 그리지 않았다.",
    "⑦ 물속을 정해진 길로만 지나간다. 길 밖에는 아무것도 만들지 않았다. 보이지 않는 곳이 「없는 곳」은 아니다."
  ],
  fallbackNotice: "이 기기에서는 3D 그리기(WebGL)를 쓸 수 없습니다. 대신 시대별 단면도로 같은 세 가지를 그대로 관찰할 수 있습니다. 아래 그림에서 ① 생물이 얼마나 많은가 ② 몸에 단단한 부분이 있는가 ③ 바닥에 붙어 있는가 헤엄치는가 를 보세요.",
  degrade: [
    "화면을 조금 거칠게 그리는 중",
    "멀리 있는 것은 흐리게 그리는 중",
    "옆 칸은 멈춘 그림입니다"
  ],
  slowFirstFrame: "이 기기에서는 화면 준비가 느립니다",
  slowAllEras: "이 기기에서는 시대 전환이 느릴 수 있습니다",
  preparing: "준비 중",
  buildingNow: "만드는 중",
  sheetSummary: "탐구 활동지 — 수업 뒤·과제용 (수업 중에는 열지 마세요)",
  worksheet: [
    { tag: "예측", body: "관찰하기 전에 씁니다. 선캄브리아시대의 바다와 고생대의 바다, 어느 쪽이 더 북적북적했을까요? ① 선캄브리아 ② 고생대 ③ 모르겠음 — 하나 고르고 왜 그렇게 생각했는지 한 줄." },
    { tag: "관찰", body: "세 시대 중 헤엄치는 생물이 가장 적었던 시대는? 그렇게 판단한 근거를 화면에서 본 것으로 쓰세요." },
    { tag: "관찰", body: "단단한 껍질이 눈에 띄기 시작한 시대는 언제인가요?" },
    { tag: "관계", body: "선캄브리아시대 바다의 바닥은 비어 있었나요? 무엇이 있었나요?" },
    { tag: "설명", body: "지금까지 발견된 화석은 어느 시대 것이 훨씬 많을까요? 그리고 그 이유가 방금 본 것과 무슨 관계가 있을까요?" },
    { tag: "설명", body: "「화석이 거의 없다 = 그 시대에 생물이 거의 없었다」고 말할 수 있을까요? 그렇게 판단한 이유는?" },
    { tag: "한계", body: "이 화면이 실제와 다른 점을 두 가지 쓰세요." }
  ],
  lengthBarFootnote: "지질 시대 전체를 100으로 본 길이입니다.",
  teacherUnlockLink: "교사용: 모든 시대 열기",
  finishAllButton: "끝까지 보기",
  /* §3 3-E 「관찰 포인트 칩 3개」— 무대 안 상시 표시 칩의 확정 문구(24개 집계 표 밖에서 별도 확정) */
  observationChips: ["① 얼마나 많은가", "② 단단한 부분", "③ 붙어 있나 헤엄치나"],
  /* §3 3-E 무대 아래 버튼 3개 — ASCII 배치도의 대괄호 표기를 [관찰 시작]·[끝까지 보기]와 같은 방식으로 그대로 옮긴다 */
  pauseButton: "일시정지",
  rewindButton: "10초 되감기",
  restartButton: "처음부터",
  /* §3 3-E 탭 줄 4번째 탭과 잠금 표기, E13의 중생대 칸 축소 표기 — 전부 확정 인용 */
  tripleTabLabel: "세 시대 나란히 보기",
  lockedSuffix: "(잠김)",
  expandedObserve: "확장 관찰"
};

/* ================================================================
   §3 3-A 씬 데이터 — 값이 있는 유일한 곳
   ================================================================ */
const ERAS = ["precambrian", "paleozoic", "mesozoic"];

const ENV = {
  precambrian: {
    label: "선캄브리아", introLabel: "선캄브리아시대",
    seafloorY: -6, railY: -3.0,
    waterColor: [0.110, 0.145, 0.130], floorColor: [0.170, 0.155, 0.120],
    fogStart: 6, fogEnd: 22,
    lightDir: [0.15, -1.00, 0.10], ambient: 0.30, diffuse: 0.70,
    sunbeam: 1.0,
    envLine: "산소 ↑ (남세균 광합성), 오존층 아직 ✗",
    coastal: { plants: 0, animals: 0, sky: 0 }
  },
  paleozoic: {
    label: "고생대", introLabel: "고생대",
    seafloorY: -10, railY: -5.0,
    waterColor: [0.050, 0.135, 0.175], floorColor: [0.200, 0.185, 0.140],
    fogStart: 10, fogEnd: 38,
    lightDir: [0.25, -0.92, 0.30], ambient: 0.30, diffuse: 0.70,
    sunbeam: 0.6,
    envLine: "오존층 형성 ★ → 생물의 육상 진출",
    coastal: { plants: 3, animals: 2, sky: 0 }
  },
  mesozoic: {
    label: "중생대", introLabel: "중생대",
    seafloorY: -14, railY: -7.0,
    waterColor: [0.035, 0.085, 0.155], floorColor: [0.125, 0.125, 0.125],
    fogStart: 8, fogEnd: 30,
    lightDir: [0.10, -0.98, 0.18], ambient: 0.30, diffuse: 0.70,
    sunbeam: 0.35,
    envLine: "판게아 분리, 화산활동↑ CO₂↑ → 온난",
    coastal: { plants: 3, animals: 2, sky: 0 }
  }
};

/* 종 정의. triPerUnit(개체당 삼각형)은 §3 3-C 분해 표와 정확히 맞도록 정한 값이며
   손으로 옮기지 않고 buildEra() 가 실측을 그대로 낸다(검사 37 2단 검사로 대조). */
const SPECIES = {
  precambrian: [
    { id: "stromatolite", name: "스트로마톨라이트", n: 6, animal: false, hard: null, loc: "attached", mode: 1,
      color: "--p-mint", triPerUnit: 200, shape: "stromatolite", label: ["스트로마톨라이트", "남세균"], sizeM: 2.2,
      stopOverride: [0, 0, 0, 1, 1, 1] /* 정지점 B에 3개 반드시 배정 — §3 3-A */ },
    { id: "seaweed_pc", name: "해초", n: 10, animal: false, hard: null, loc: "attached", mode: 1,
      color: "--p-mint", triPerUnit: 40, shape: "frond", label: null, sizeM: 0.9 },
    { id: "soft_bottom", name: "부드러운 몸의 바닥 생물", n: 6, animal: true, hard: false, loc: "bottom", mode: 0,
      color: "--p-violet", triPerUnit: 60, shape: "capsule", label: null, sizeM: 0.30 },
    { id: "jelly_pc", name: "해파리 모양 헤엄치는 생물", n: 2, animal: true, hard: false, loc: "swim", mode: 2,
      color: "--p-violet", triPerUnit: 90, shape: "bell", label: null, sizeM: 0.28 }
  ],
  paleozoic: [
    { id: "trilobite", name: "삼엽충", n: 12, animal: true, hard: true, loc: "bottom", mode: 0,
      color: "--p-orange", triPerUnit: 90, shape: "ridged", label: "삼엽충", sizeM: 0.18 },
    { id: "bivalve", name: "조개 모양의 생물", n: 10, animal: true, hard: true, loc: "bottom", mode: 0,
      color: "--p-orange", triPerUnit: 40, shape: "shell", label: null, sizeM: 0.13 },
    { id: "squidshell", name: "껍데기를 가진 오징어 같은 생물", n: 6, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 90, shape: "cone", label: null, sizeM: 0.32 },
    { id: "coral_colony", name: "산호 군체", n: 14, animal: true, hard: true, loc: "attached", mode: 1,
      color: "--p-orange", triPerUnit: 140, shape: "coral", label: null, sizeM: 0.42, cluster: 4 },
    { id: "vert_swim_pz", name: "헤엄치는 척추동물", n: 20, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 70, shape: "fusiform", label: null, sizeM: 0.40 },
    { id: "jelly_pz", name: "해파리", n: 4, animal: true, hard: false, loc: "swim", mode: 2,
      color: "--p-violet", triPerUnit: 90, shape: "bell", label: null, sizeM: 0.26 },
    { id: "seaweed_pz", name: "해조류", n: 16, animal: false, hard: null, loc: "attached", mode: 1,
      color: "--p-mint", triPerUnit: 40, shape: "frond", label: null, sizeM: 0.85 }
  ],
  mesozoic: [
    { id: "ammonite", name: "암모나이트", n: 26, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 120, shape: "spiral", label: "암모나이트", sizeM: 0.30 },
    { id: "longneck", name: "목이 긴 헤엄치는 파충류", n: 4, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 220, shape: "fusiform", label: null, sizeM: 2.6 },
    { id: "fishshaped", name: "물고기 모양 헤엄치는 파충류", n: 6, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 160, shape: "fusiform", label: null, sizeM: 1.8 },
    { id: "vert_swim_mz", name: "헤엄치는 척추동물", n: 12, animal: true, hard: true, loc: "swim", mode: 2,
      color: "--p-orange", triPerUnit: 70, shape: "fusiform", label: null, sizeM: 0.40 },
    { id: "bottom_shell_mz", name: "바닥의 껍데기·산호", n: 10, animal: true, hard: true, loc: "bottom", mode: 0,
      color: "--p-orange", triPerUnit: 60, shape: "capsule", label: null, sizeM: 0.24 },
    { id: "jelly_mz", name: "해파리", n: 4, animal: true, hard: false, loc: "swim", mode: 2,
      color: "--p-violet", triPerUnit: 90, shape: "bell", label: null, sizeM: 0.26 },
    { id: "seaweed_mz", name: "해조류", n: 12, animal: false, hard: null, loc: "attached", mode: 1,
      color: "--p-mint", triPerUnit: 40, shape: "frond", label: null, sizeM: 0.75 }
  ]
};

/* 육상 실루엣 — §3 3-A 표. 하늘을 나는 실루엣은 세 시대 전부 0(§5 금지 5). */
/* 실루엣 = hard 로부터 파생시킨다(F-1 — 값을 두 곳에 따로 타이핑하지 않는다).
   동물 종만 해당(검사 22). 비동물(스트로마톨라이트·해초·해조류)은 서술 문자열을 따로 둔다. */
for (const era of ERAS) for (const sp of SPECIES[era]) {
  sp.silhouette = sp.animal ? (sp.hard ? "각짐" : "부드러움") : null;
}

const COASTAL_LABEL = { paleozoic: { kind: "plant", text: "양치식물" }, mesozoic: { kind: "animal", text: "공룡" } };

/* 레일 — 8 제어점의 Catmull-Rom, 길이 108 m, 속도 0.9 m/s, 정지점 36/72/108 m */
const RAIL = { length: 108, speed: 0.9, stops: [36, 72, 108] };

/* 지질 시대 길이 막대 — 지도서 98쪽 값(확정 26). 마지막 대(代)는 화면에 그리지 않지만
   막대 범례에 이름만 적는 것은 §5 금지 6이 허용한다. 숫자를 두 곳(막대 HTML·표)에
   따로 타이핑하지 않도록 여기 하나에만 둔다(B-6). */
const ERA_LENGTH_PERCENT = { precambrian: 88.2, paleozoic: 6.3, mesozoic: 4.1, cenozoic: 1.4 };
const CENOZOIC_LEGEND_LABEL = "신생대";

const GEO = {
  eras: ERAS, env: ENV, species: SPECIES, coastalLabel: COASTAL_LABEL, rail: RAIL, text: TEXT,
  eraLengthPercent: ERA_LENGTH_PERCENT, cenozoicLegendLabel: CENOZOIC_LEGEND_LABEL
};

/* ================================================================
   레일 — Catmull-Rom(8 제어점) → 정밀 샘플 → 호길이 LUT
   ================================================================ */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * ((2 * p1[k]) +
      (-p0[k] + p2[k]) * t +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return out;
}

function rawControlPoints(era) {
  const e = ENV[era];
  const seed = { precambrian: 1, paleozoic: 2, mesozoic: 3 }[era];
  const rnd = makeRng(9001 + seed * 77);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const x = t * 108;
    const z = 4.5 * Math.sin(t * Math.PI * 1.35 + seed) + (rnd() - 0.5) * 1.2;
    const y = e.railY + 0.85 * Math.sin(t * Math.PI * 1.6 + seed * 0.7);
    pts.push([x, y, z]);
  }
  return pts;
}

function sampleSpline(points, samplesPerSeg) {
  const n = points.length;
  const pos = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
    const steps = (i === n - 2) ? samplesPerSeg + 1 : samplesPerSeg;
    for (let s = 0; s < steps; s++) {
      const t = s / samplesPerSeg;
      pos.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return pos;
}

function cumulativeLength(pos) {
  const cum = [0];
  for (let i = 1; i < pos.length; i++) cum.push(cum[i - 1] + V.len(V.sub(pos[i], pos[i - 1])));
  return cum;
}

const _railCache = {};
function getRailLUT(era) {
  if (_railCache[era]) return _railCache[era];
  const raw = rawControlPoints(era);
  let pos = sampleSpline(raw, 300);
  let cum = cumulativeLength(pos);
  const k = 108 / cum[cum.length - 1];
  const e = ENV[era];
  const scaled = raw.map(p => [p[0] * k, e.railY + (p[1] - e.railY) * k, p[2] * k]);
  pos = sampleSpline(scaled, 300);
  cum = cumulativeLength(pos);
  const lut = { pos, cum, total: cum[cum.length - 1] };
  _railCache[era] = lut;
  return lut;
}

function railLength(era) { return getRailLUT(era).total; }

function railAt(era, s) {
  const lut = getRailLUT(era);
  const clamped = Math.max(0, Math.min(lut.total, s));
  const cum = lut.cum;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < clamped) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, lo);
  const c0 = cum[i - 1], c1 = cum[i];
  const t = c1 > c0 ? (clamped - c0) / (c1 - c0) : 0;
  const p0 = lut.pos[i - 1], p1 = lut.pos[i];
  const eye = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t];
  const j0 = Math.max(0, i - 3), j1 = Math.min(lut.pos.length - 1, i + 2);
  const dir = V.norm(V.sub(lut.pos[j1], lut.pos[j0]));
  return { eye, dir };
}

/* 그 정지점의 "기본 시선": 카메라 위치 = 정지점, 방향 = 그 지점의 레일 진행 방향 */
function stopFrame(era, stopIdx) {
  const s = RAIL.stops[stopIdx];
  const { eye, dir } = railAt(era, s);
  let ref = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = V.norm(V.cross(dir, ref));
  const up = V.norm(V.cross(right, dir));
  return { eye, dir, right, up };
}

/* ================================================================
   개체 배치 — placeIndividuals(era)
   ================================================================ */
const _placeCache = {};
function placeIndividuals(era) {
  if (_placeCache[era]) return _placeCache[era];
  const list = SPECIES[era];
  const e = ENV[era];
  const seedBase = { precambrian: 4001, paleozoic: 4002, mesozoic: 4003 }[era];
  const rnd = makeRng(seedBase);
  const individuals = [];
  const labeledLines = []; // {stopIdx, forward} 로 다른 개체와의 충돌(검사34) 회피용

  for (const sp of list) {
    const n = sp.n;
    const nA = Math.ceil(n * 0.5);
    const nB = Math.floor(n * 0.2);
    const nC = n - nA - nB;
    let stopOf;
    if (sp.stopOverride) {
      stopOf = sp.stopOverride.slice();
    } else {
      stopOf = [];
      for (let i = 0; i < nA; i++) stopOf.push(0);
      for (let i = 0; i < nB; i++) stopOf.push(1);
      for (let i = 0; i < nC; i++) stopOf.push(2);
    }
    // 이름표 개체(idx 0)는 정지점 B 근접 관찰 담당이므로 B 슬롯에 오도록 자리를 바꾼다
    // (스트로마톨라이트·삼엽충·암모나이트 안내 문장이 전부 정지점 B를 가리킨다 — §3 3-E).
    if (sp.label && stopOf[0] !== 1 && stopOf.indexOf(1) >= 0) {
      const bPos = stopOf.indexOf(1);
      stopOf[bPos] = stopOf[0]; stopOf[0] = 1;
    }

    for (let idx = 0; idx < n; idx++) {
      const stopIdx = stopOf[idx];
      const frame = stopFrame(era, stopIdx);
      const isLabeledInstance = Array.isArray(sp.label) ? idx === 0 : (sp.label && idx === 0);

      let forward, lateral, heightFrac, maxLatA = null;
      if (isLabeledInstance) {
        // 이름표 개체 — 검사 32(yaw ±40·거리≤14m, 정지점 B 위주 근접) 를 확정 배치로 만족시킨다
        forward = sp.id === "stromatolite" ? 5.5 : 6.0;
        lateral = 0;
      } else if (stopIdx === 0) {
        // 정지점 A — 검사 31: yaw ±30° 안 (안전 마진 25°)
        forward = 4 + rnd() * 12;
        maxLatA = forward * Math.tan(25 * Math.PI / 180);
        lateral = (rnd() * 2 - 1) * maxLatA;
      } else if (stopIdx === 1) {
        // 정지점 B — 3~8 m 근거리
        forward = 3 + rnd() * 5;
        lateral = (rnd() * 2 - 1) * 6;
        // 이름표 개체가 지나가는 정면 선(±3°) 은 비워 둔다 (검사 34 — 가려짐 방지)
        for (const L of labeledLines) {
          if (L.stopIdx === stopIdx && Math.abs(lateral) < 1.0 && forward < L.forward + 1.5) lateral += (lateral >= 0 ? 1 : -1) * 2.2;
        }
      } else {
        forward = -4 + rnd() * 20;
        lateral = (rnd() * 2 - 1) * 14;
      }

      // 자리 규칙: 바닥/바닥 고착 = 해저 + 0.8m ~ 해저 + 2m, 유영 = 해저+1.5 ~ 수면-2.0
      if (sp.loc === "swim") {
        heightFrac = rnd();
      } else {
        heightFrac = null;
      }

      // 정지점의 기본 시선 프레임(eye+dir+right)을 기준으로 앞뒤·좌우 오프셋을 준다.
      // 정지점 C(종점)는 곡선 끝을 넘어갈 수 없으므로 곡선을 따라가지 않고
      // 이 국소 프레임으로 바로 확장한다 — 세 정지점 모두 같은 방식이라 일관적이다.
      let railPos = V.add(frame.eye, V.scale(frame.dir, forward));
      let anchor = V.add(railPos, V.scale(frame.right, lateral));
      let y;
      if (sp.loc === "swim") {
        const lo = e.seafloorY + 1.5, hi = -2.0;
        y = lo + (hi - lo) * heightFrac;
      } else {
        y = e.seafloorY + 0.4 + rnd() * 1.6;
      }
      anchor = [anchor[0], y, anchor[2]];

      // 정지점 B는 "레일에서 3~8m 근거리"다(§3 3-A). forward·lateral·높이를 합친
      // 실제 3D 거리가 8m를 넘지 않도록 반경을 조인다(재작업 R8 — 이전에는 lateral만
      // 넓게 둬 최대 10.1m까지 벌어졌다).
      if (stopIdx === 1) {
        const dy = y - frame.eye[1];
        const capForward = Math.sqrt(Math.max(9, 64 - dy * dy));
        forward = Math.min(forward, capForward);
        const latCap = Math.sqrt(Math.max(0, 64 - forward * forward - dy * dy));
        lateral = Math.max(-latCap, Math.min(latCap, lateral));
        railPos = V.add(frame.eye, V.scale(frame.dir, forward));
        const p0 = V.add(railPos, V.scale(frame.right, lateral));
        anchor = [p0[0], y, p0[2]];
      }

      // 선캄브리아: 같은 종 두 개체 최소 간격 4m (§3 3-A "뭉치지 않는다").
      // 재작업 R7 — 12회 재시도로는 정지점 A의 좁은 yaw 안전 마진 안에서 5개체가
      // 4m 간격을 못 채우는 경우(해초 1쌍 1.61m)가 있었다. 60회로 늘리고, 막히면
      // forward 자체를 늘려(=maxLatA도 함께 커짐) 여유를 만든다.
      if (era === "precambrian") {
        let tries = 0;
        while (tries < 60) {
          let tooClose = false;
          for (const other of individuals) {
            if (other.speciesId === sp.id && V.len(V.sub(other.anchor, anchor)) < 4.0) { tooClose = true; break; }
          }
          if (!tooClose) break;
          if (stopIdx === 1) {
            // 정지점 B 재시도도 R8과 같은 반경 8m 원판 안에서만 다시 뽑는다.
            forward = 3 + rnd() * 5;
            const dy = y - frame.eye[1];
            const latCap = Math.sqrt(Math.max(0, 64 - forward * forward - dy * dy));
            lateral = (rnd() * 2 - 1) * latCap;
            railPos = V.add(frame.eye, V.scale(frame.dir, forward));
          } else {
            lateral += (rnd() - 0.5) * 5;
            // 정지점 A는 재시도로도 검사 31의 yaw 안전 마진(25°)을 벗어나면 안 된다.
            if (maxLatA !== null) {
              forward = Math.min(20, forward + 0.6);
              maxLatA = forward * Math.tan(25 * Math.PI / 180);
              railPos = V.add(frame.eye, V.scale(frame.dir, forward));
              lateral = Math.max(-maxLatA, Math.min(maxLatA, lateral));
            }
          }
          const p2 = V.add(railPos, V.scale(frame.right, lateral));
          anchor = [p2[0], y, p2[2]];
          tries++;
        }
      }
      // 고생대 산호 군체: 4덩이로 3~4개씩 뭉친다 — 같은 정지점 안에서만 뭉치고,
      // 자잘한 오프셋을 프레임의 right 축(=yaw 를 만드는 축)에 아주 작게만 주어
      // 정지점 A 의 yaw 안전 한계(검사 31)를 깨지 않는다.
      if (sp.id === "coral_colony") {
        const clusterIdx = idx % sp.cluster;
        const already = individuals.filter(o => o.speciesId === sp.id && o._cluster === clusterIdx && o.stop === stopIdx);
        if (already.length) {
          const jitter = (rnd() - 0.5) * 0.9;
          anchor = V.add(already[0].anchor, V.scale(frame.right, jitter));
          anchor[1] = y;
        }
      }

      const heading = rnd() * Math.PI * 2;
      const phase = rnd() * Math.PI * 2;
      const sizeScale = 0.86 + rnd() * 0.30;
      const orbitR = sp.loc === "swim" ? 1.2 + rnd() * 2.0 : 0;
      const orbitW = sp.loc === "swim" ? 0.10 + rnd() * 0.12 : 0;
      const sway = sp.loc === "attached" ? 0.10 + rnd() * 0.08 : 0;

      const ind = {
        era, speciesId: sp.id, name: sp.name, animal: sp.animal, hard: sp.hard, loc: sp.loc, mode: sp.mode,
        color: sp.color, stop: stopIdx, anchor, heading, phase, sizeScale, orbitR, orbitW, sway,
        label: isLabeledInstance ? sp.label : null, _cluster: sp.id === "coral_colony" ? (idx % sp.cluster) : undefined
      };
      individuals.push(ind);
      if (isLabeledInstance) labeledLines.push({ stopIdx, forward, speciesId: sp.id });
    }
  }

  // 육상 실루엣 라벨 개체(양치식물/공룡) — 종점(정지점 C, 마지막) 기준 배치, 검사 33
  const cl = COASTAL_LABEL[era];
  const coastalIndividuals = [];
  const coastal = e.coastal;
  const cframe = stopFrame(era, 2);
  const coastDist = 20; // 18~24m 범위 중앙값
  for (let i = 0; i < coastal.plants; i++) {
    const isLabel = cl && cl.kind === "plant" && i === 0;
    coastalIndividuals.push(makeCoastal("plant" + i, "plant", isLabel ? cl.text : null, cframe, coastDist, i, coastal.plants));
  }
  for (let i = 0; i < coastal.animals; i++) {
    const isLabel = cl && cl.kind === "animal" && i === 0;
    coastalIndividuals.push(makeCoastal("animal" + i, "animal", isLabel ? cl.text : null, cframe, coastDist, i, coastal.animals));
  }

  const result = { individuals, coastal: coastalIndividuals };
  _placeCache[era] = result;
  return result;
}

function makeCoastal(id, kind, label, cframe, dist, i, total) {
  // 검사 33: yaw ±30°, 앙각 12°~45° (거리 18~24m·높이 y=+3m 중심이면 앙각 14~27°)
  const yawDeg = label ? 0 : (i - (total - 1) / 2) * 12;
  const yaw = yawDeg * Math.PI / 180;
  const fwd = V.add(V.scale(cframe.dir, Math.cos(yaw) * dist), V.scale(cframe.right, Math.sin(yaw) * dist));
  const pos = V.add(cframe.eye, fwd);
  pos[1] = 3.0 + (i % 2) * 0.4;
  return { id, kind, label, pos, sizeScale: 0.9 + (i % 3) * 0.08 };
}

/* placeIndividuals() 를 배열 하나(개체 전부)로 평탄화 — countBy/visibleAt 이 쓴다 */
function allIndividuals(era) { return placeIndividuals(era).individuals; }

function countBy(era, pred) { return allIndividuals(era).filter(pred).length; }

/* visibleAt — fovY 55°, aspect 1.28(검사 36 과 같은 기준) 프러스텀 안의 개체 */
function visibleAt(era, stopIdx) {
  const frame = stopFrame(era, RAIL.stops.indexOf(RAIL.stops[stopIdx]));
  const halfV = (55 / 2) * Math.PI / 180;
  const halfH = Math.atan(Math.tan(halfV) * 1.28);
  return allIndividuals(era).filter(ind => {
    const rel = V.sub(ind.anchor, frame.eye);
    const distF = V.dot(rel, frame.dir), distR = V.dot(rel, frame.right), distU = V.dot(rel, frame.up);
    if (distF <= 0.05) return false;
    const yaw = Math.atan2(distR, distF), pitch = Math.atan2(distU, distF);
    return Math.abs(yaw) <= halfH && Math.abs(pitch) <= halfV;
  });
}

/* ================================================================
   메시 생성 — sweepAlongPath (경로 스윕: 기둥·방추형·나선 전부 이걸로 만든다)
   ================================================================ */
function frameFromTangent(t) {
  const ref = Math.abs(t[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = V.norm(V.cross(ref, t));
  const up2 = V.norm(V.cross(t, right));
  return { right, up2 };
}

function sweepAlongPath(sides, path, radii, capB, capT) {
  const rings = path.length;
  const positions = new Array(rings * sides);
  const normals = new Array(rings * sides);
  for (let i = 0; i < rings; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(rings - 1, i + 1)];
    const tan = V.norm(V.sub(b, a));
    const { right, up2 } = frameFromTangent(tan);
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2;
      const dir = V.norm(V.add(V.scale(right, Math.cos(ang)), V.scale(up2, Math.sin(ang))));
      positions[i * sides + k] = V.add(path[i], V.scale(dir, radii[i]));
      normals[i * sides + k] = dir;
    }
  }
  const indices = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = i * sides + k, b = i * sides + k2, c = (i + 1) * sides + k, d = (i + 1) * sides + k2;
      indices.push(a, c, b, b, c, d);
    }
  }
  let tri = (rings - 1) * sides * 2;
  if (capB) { for (let k = 1; k < sides - 1; k++) indices.push(0, k, k + 1); tri += sides - 2; }
  if (capT) { const base = (rings - 1) * sides; for (let k = 1; k < sides - 1; k++) indices.push(base, base + k, base + k + 1); tri += sides - 2; }
  return { positions, normals, indices, triangles: tri, vertices: rings * sides };
}

function vpath(rings, height, wob) {
  const pts = [];
  for (let i = 0; i < rings; i++) {
    const t = rings > 1 ? i / (rings - 1) : 0;
    pts.push([wob * Math.sin(t * Math.PI * 1.3), t * height, wob * 0.6 * Math.cos(t * Math.PI * 1.7)]);
  }
  return pts;
}
function hpath(rings, length, bend) {
  const pts = [];
  for (let i = 0; i < rings; i++) {
    const t = rings > 1 ? i / (rings - 1) : 0;
    pts.push([(t - 0.5) * length, bend * Math.sin(t * Math.PI), 0]);
  }
  return pts;
}
function spath(rings, turns, growth, r0) {
  const pts = [];
  for (let i = 0; i < rings; i++) {
    const t = rings > 1 ? i / (rings - 1) : 0;
    const ang = t * turns * Math.PI * 2;
    const rad = r0 * Math.pow(growth, t * turns);
    pts.push([rad * Math.cos(ang), 0.06 * rad * Math.sin(ang * 2), rad * Math.sin(ang)]);
  }
  return pts;
}
const ones = n => new Array(n).fill(1);
const scaleArr = (a, k) => a.map(x => x * k);

/* 종별 「모양」 생성기 — 지역(local) 공간, 앵커 = (0,0,0) */
const SHAPE_BUILD = {
  stromatolite: sp => {
    /* 수평 층 7겹 — 조명(빛이 거의 수직으로 떨어져 옆면은 항상 0.78 하한에 눌린다)에
       기대지 않고 "실루엣 자체"에 잘록한 홈을 파서 층을 만든다(§3-A · §5 금지 9).
       층마다 3개 고리(넓게 2 + 잘록하게 1)를 써서 21고리 = 7층 × 3고리.
       (rings-1)*sides*2 = 20*5*2 = 200 — triPerUnit(검사 37)과 정확히 같다. */
    const sides = 5, layers = 7, ringsPerLayer = 3, rings = layers * ringsPerLayer;
    const path = vpath(rings, sp.sizeM, 0.03);
    const baseR = sp.sizeM * 0.34;
    const radii = [];
    for (let r = 0; r < rings; r++) {
      const layer = Math.min(layers - 1, Math.floor(r / ringsPerLayer));
      const posInLayer = r - layer * ringsPerLayer;
      const layerR = baseR * (1 - 0.16 * (layer / (layers - 1))) * (1 + 0.05 * (layer % 2 === 0 ? 1 : -1));
      const isNeck = posInLayer === ringsPerLayer - 1 && r !== rings - 1;
      radii.push(isNeck ? layerR * 0.55 : layerR);
    }
    return sweepAlongPath(sides, path, radii, false, false);
  },
  frond: sp => {
    const { sides, rings } = { sides: 10, rings: 3 };
    const path = vpath(rings, sp.sizeM, 0.10);
    const radii = [sp.sizeM * 0.07, sp.sizeM * 0.05, sp.sizeM * 0.02];
    return sweepAlongPath(sides, path, radii, false, false);
  },
  capsule: sp => {
    const { sides, rings } = { sides: 8, rings: 4 };
    const path = hpath(rings, sp.sizeM, sp.sizeM * 0.08);
    const radii = [sp.sizeM * 0.10, sp.sizeM * 0.30, sp.sizeM * 0.30, sp.sizeM * 0.10];
    return sweepAlongPath(sides, path, radii, true, true);
  },
  bell: sp => {
    const { sides, rings } = { sides: 9, rings: 6 };
    const path = vpath(rings, sp.sizeM, 0.02);
    const radii = [];
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); radii.push(sp.sizeM * 0.42 * Math.sin(Math.PI * (1 - t) * 0.9 + 0.05)); }
    return sweepAlongPath(sides, path.reverse(), radii.reverse(), false, false);
  },
  ridged: sp => {
    const { sides, rings } = { sides: 9, rings: 6 };
    const path = hpath(rings, sp.sizeM, sp.sizeM * 0.05);
    const radii = [];
    /* 재작업 1회차 「확인 필요」 처리 — 이전 값(±10% 사인 변조, 6샘플)은 정지점 B(6m)에서
       스크린샷으로 확인해도 화면에 사실상 안 보였다. 스트로마톨라이트와 같은 방식(§5 금지 9
       — "층 사이 홈을 실루엣 자체에 판다")으로 홀수 고리를 뚜렷이 좁혀 실루엣 요철을 만든다.
       sides·rings는 그대로이므로 triPerUnit = (rings-1)×sides×2 = 90(검사 37)도 그대로다. */
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const envelope = sp.sizeM * 0.30 * (0.35 + 0.65 * Math.sin(Math.PI * t));
      const notch = (i % 2 === 1) ? 0.55 : 1.0;
      radii.push(envelope * notch);
    }
    return sweepAlongPath(sides, path, radii, false, false);
  },
  shell: sp => {
    const { sides, rings } = { sides: 6, rings: 4 };
    const path = hpath(rings, sp.sizeM * 0.5, 0);
    const radii = [sp.sizeM * 0.05, sp.sizeM * 0.30, sp.sizeM * 0.30, sp.sizeM * 0.05];
    return sweepAlongPath(sides, path, radii, true, false);
  },
  cone: sp => {
    const { sides, rings } = { sides: 9, rings: 6 };
    const path = hpath(rings, sp.sizeM, 0.03);
    const radii = [];
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); radii.push(sp.sizeM * 0.28 * (1 - t) + sp.sizeM * 0.03); }
    return sweepAlongPath(sides, path, radii, false, false);
  },
  coral: sp => {
    const { sides, rings } = { sides: 10, rings: 8 };
    const path = vpath(rings, sp.sizeM, 0.10);
    const radii = [];
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); radii.push(sp.sizeM * 0.20 * (1 - 0.3 * t) * (1 + 0.15 * Math.sin(t * 13))); }
    return sweepAlongPath(sides, path, radii, false, false);
  },
  fusiform: sp => {
    // triPerUnit 이 70/160/220 으로 다르므로(3-A 표), (sides,rings) 를 개체당 삼각형 수에 맞춘다.
    // (rings-1)*sides*2 = triPerUnit 을 만족하는 조합(무캡).
    const FS = { 70: { sides: 7, rings: 6 }, 160: { sides: 8, rings: 11 }, 220: { sides: 10, rings: 12 } };
    const { sides, rings } = FS[sp.triPerUnit];
    const path = hpath(rings, sp.sizeM, sp.sizeM * 0.04);
    const radii = [];
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); radii.push(sp.sizeM * 0.14 * (0.15 + 0.85 * Math.sin(Math.PI * t))); }
    return sweepAlongPath(sides, path, radii, false, false);
  },
  spiral: sp => {
    const { sides, rings } = { sides: 10, rings: 7 };
    const path = spath(rings, 1.6, 1.9, sp.sizeM * 0.10);
    const radii = [];
    for (let i = 0; i < rings; i++) { const t = i / (rings - 1); radii.push(sp.sizeM * 0.045 * Math.pow(1.7, t * 1.6)); }
    return sweepAlongPath(sides, path, radii, false, false);
  }
};

const _localMeshCache = {};
function localMesh(era, sp) {
  const key = era + ":" + sp.id;
  if (_localMeshCache[key]) return _localMeshCache[key];
  const m = SHAPE_BUILD[sp.shape](sp);
  _localMeshCache[key] = m;
  return m;
}

function rotY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

function shadeFor(localPos) {
  // 정점별 밝기 계수 — [1.00, 1.20] 안, 위치의 결정적 함수(개체마다 동일 패턴이라도 무방 — 순수 변주용)
  const f = Math.sin(localPos[0] * 9.1) * Math.sin(localPos[1] * 7.3 + 1.7) * Math.sin(localPos[2] * 8.7 + 0.4);
  return 1.10 + 0.10 * f;
}

/* 개체 하나를 정점 버퍼로 펼친다 — a_pos/a_nrm/a_rel/a_ext(phase,shade) */
function emitIndividual(era, sp, ind, out) {
  const mesh = localMesh(era, sp);
  const base = out.vcount;
  for (let i = 0; i < mesh.positions.length; i++) {
    let p = mesh.positions[i].map(v => v * ind.sizeScale);
    let n = mesh.normals[i];
    p = rotY(p, ind.heading); n = rotY(n, ind.heading);
    const world = V.add(ind.anchor, p);
    out.pos.push(world[0], world[1], world[2]);
    out.nrm.push(n[0], n[1], n[2]);
    out.rel.push(p[0], p[1], p[2]);
    out.ext.push(ind.phase, shadeFor(p));
    out.vcount++;
  }
  for (const ix of mesh.indices) out.idx.push(base + ix);
  out.triangles += mesh.triangles;
}

/* ---------------- 지형·수면·해저 화산·육상 실루엣 ---------------- */
function buildGrid(cols, rows, sizeX, sizeZ, y0, noiseAmp, seed) {
  const rnd = makeRng(seed);
  const out = { pos: [], nrm: [], rel: [], ext: [], idx: [], vcount: 0, triangles: 0 };
  const W = cols + 1, H = rows + 1;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i / cols - 0.5) * sizeX + sizeX * 0.5 - 4; // -4..sizeX-4 정도로 레일 앞뒤 감싸게
      const z = (j / rows - 0.5) * sizeZ;
      const y = y0 + (noiseAmp ? noiseAmp * Math.sin(i * 0.7 + seed) * Math.sin(j * 0.9) : 0);
      out.pos.push(x, y, z); out.nrm.push(0, 1, 0); out.rel.push(0, 0, 0); out.ext.push(0, 1.0 + rnd() * 0.15);
      out.vcount++;
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * W + i, b = j * W + i + 1, c = (j + 1) * W + i, d = (j + 1) * W + i + 1;
      out.idx.push(a, c, b, b, c, d); out.triangles += 2;
    }
  }
  return out;
}

function buildVolcano(cx, cz, y0, height, radius, sides, seed) {
  const out = { pos: [], nrm: [], rel: [], ext: [], idx: [], vcount: 0, triangles: 0 };
  const apex = [cx, y0 + height, cz];
  out.pos.push(...apex); out.nrm.push(0, 1, 0); out.rel.push(0, 0, 0); out.ext.push(0, 1.05); out.vcount++;
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    const p = [cx + Math.cos(a) * radius, y0, cz + Math.sin(a) * radius];
    const n = V.norm([Math.cos(a), 0.6, Math.sin(a)]);
    out.pos.push(...p); out.nrm.push(...n); out.rel.push(0, 0, 0); out.ext.push(0, 1.0 + (k % 3) * 0.05); out.vcount++;
  }
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides;
    out.idx.push(0, 1 + k, 1 + k2); out.triangles++;
  }
  return out;
}

function buildCoastal(era) {
  const e = ENV[era];
  const { coastal } = placeIndividuals(era);
  const out = { pos: [], nrm: [], rel: [], ext: [], idx: [], vcount: 0, triangles: 0 };
  const push = (positions, normals, indices) => {
    const base = out.vcount;
    for (let i = 0; i < positions.length; i++) { out.pos.push(...positions[i]); out.nrm.push(...normals[i]); out.rel.push(0, 0, 0); out.ext.push(0, 1.05); out.vcount++; }
    for (const ix of indices) out.idx.push(base + ix);
    out.triangles += indices.length / 3;
  };
  /* 하늘 띠·암석 능선의 자리를 "절대 좌표"가 아니라 종점(정지점 C) 카메라 기준 상대 좌표로 잡는다.
     시대마다 레일 곡선 모양이 달라 절대 좌표를 쓰면 마무리(finish) 구간 — 안내문이
     "위를 올려다보세요. 물 밖에는 무엇이 있나요?" 라고 묻는 바로 그 순간 — 카메라가 이미
     그 좌표를 지나쳐 버려 능선·하늘이 카메라 "뒤"에 있게 되는 결함이 있었다(반환 보고 ⑤ 새 항목).
     이름표 붙은 육상 개체(makeCoastal)와 같은 cframe 을 써서 항상 종점 앞쪽에 오도록 고친다.
     거리도 세 시대 안개 범위(fogEnd 22/38/30, u_fogRange) 안쪽으로 당긴다 — 첫 수정에서
     기존 절대 좌표를 그대로 상대 좌표로 옮기기만 했더니 거리 44~70 m 로 세 시대 fogEnd를
     전부 넘어 v_fog=1(완전 안개색)이 되어 여전히 안 보이는 2차 결함이 있었다(반환 보고 ⑤ 새 항목). */
  const cframe = stopFrame(era, 2);
  function coastPt(dist, lateral, y) {
    const fwd = V.add(V.scale(cframe.dir, dist), V.scale(cframe.right, lateral));
    const p = V.add(cframe.eye, fwd);
    p[1] = y;
    return p;
  }
  // 하늘 띠(단색 판 1장, 2 삼각형) — 종점 앞 16 m·좌우 ±20 m(안개 범위 안)
  push(
    [coastPt(16, -20, 8), coastPt(16, 20, 8), coastPt(16, -20, 20), coastPt(16, 20, 20)],
    [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
    [0, 1, 2, 1, 3, 2]
  );
  // 암석 능선(지그재그 리본): 전체 budget - (sky 2) - (plants*8) - (animals*8) 를 segments*2 로 채운다
  const budgetTotal = era === "precambrian" ? 120 : 200;
  const plantTri = coastal.filter(c => c.kind === "plant").length * 8;
  const animalTri = coastal.filter(c => c.kind === "animal").length * 8;
  const skyTri = 2;
  const remain = budgetTotal - skyTri - plantTri - animalTri;
  const segs = Math.round(remain / 2);
  const ridgeBase = [], ridgeTop = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const lateral = -20 + t * 40;
    const jag = 1.6 + 1.4 * Math.sin(t * 23) + 0.8 * Math.sin(t * 61 + 1);
    ridgeBase.push(coastPt(14, lateral, -1)); ridgeTop.push(coastPt(14, lateral, 2.2 + jag));
  }
  const rp = [], rn = [], ri = [];
  for (let i = 0; i <= segs; i++) { rp.push(ridgeBase[i]); rn.push([0, 0, 1]); }
  for (let i = 0; i <= segs; i++) { rp.push(ridgeTop[i]); rn.push([0, 0, 1]); }
  for (let i = 0; i < segs; i++) {
    const a = i, b = i + 1, c = segs + 1 + i, d = segs + 1 + i + 1;
    ri.push(a, c, b, b, c, d);
  }
  push(rp, rn, ri);
  // 식물/동물 실루엣 — discFan(10) = 8 삼각형, 카메라 쪽(+z)을 보는 평면
  for (const c of coastal) {
    const sides = 10, R = 1.1 * c.sizeScale * (c.kind === "plant" ? 1.0 : 1.3);
    const pos = [], nrm = [], idx = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const yr = c.kind === "plant" ? [0, R, 0] : [0, R * 0.55, 0];
      pos.push([c.pos[0] + Math.cos(a) * R * (c.kind === "plant" ? 0.35 : 0.7), c.pos[1] + R * 0.55 + Math.sin(a) * (c.kind === "plant" ? R : R * 0.55), c.pos[2]]);
      nrm.push([0, 0, 1]);
    }
    for (let k = 1; k < sides - 1; k++) idx.push(0, k, k + 1);
    push(pos, nrm, idx);
  }
  return { mesh: out, coastalPlacements: coastal };
}

/* ================================================================
   buildEra — 시대 하나의 전체 정점/인덱스 버퍼 + 종별 묶음
   ================================================================ */
function buildEra(era) {
  const e = ENV[era];
  const list = SPECIES[era];
  const { individuals } = placeIndividuals(era);
  const speciesOut = [];
  let totalTri = 0, totalVert = 0;
  for (const sp of list) {
    const out = { pos: [], nrm: [], rel: [], ext: [], idx: [], vcount: 0, triangles: 0 };
    const ownIndividuals = individuals.filter(ind => ind.speciesId === sp.id);
    for (const ind of ownIndividuals) emitIndividual(era, sp, ind, out);
    totalTri += out.triangles; totalVert += out.vcount;
    speciesOut.push({
      id: sp.id, color: sp.color, mode: sp.mode, n: sp.n,
      triangles: out.triangles, vertices: out.vcount,
      positions: new Float32Array(out.pos), normals: new Float32Array(out.nrm),
      rel: new Float32Array(out.rel), ext: new Float32Array(out.ext),
      indices: new Uint16Array(out.idx)
    });
  }
  const terrain = buildGrid(40, 16, 108 + 8, 44, e.seafloorY, 0.5, era === "precambrian" ? 11 : era === "paleozoic" ? 12 : 13);
  const sea = buildGrid(24, 10, 108 + 24, 60, 0, 0, 21);
  let volcanoTri = 0, volcanoVert = 0;
  if (era === "precambrian") {
    const v1 = buildVolcano(14, -14, e.seafloorY, 4.2, 3.2, 64, 31);
    const v2 = buildVolcano(46, 15, e.seafloorY, 3.6, 2.8, 64, 32);
    // 화산은 지형과 같은 draw call(지형 색)에 합쳐 그린다 — 별도 draw call을 늘리지 않는다
    const off = terrain.vcount;
    for (let i = 0; i < v1.pos.length; i += 3) terrain.pos.push(v1.pos[i], v1.pos[i + 1], v1.pos[i + 2]);
    for (let i = 0; i < v1.nrm.length; i += 3) terrain.nrm.push(v1.nrm[i], v1.nrm[i + 1], v1.nrm[i + 2]);
    for (let i = 0; i < v1.ext.length; i += 2) terrain.ext.push(v1.ext[i], v1.ext[i + 1]);
    for (let i = 0; i < v1.rel.length; i += 3) terrain.rel.push(0, 0, 0);
    for (const ix of v1.idx) terrain.idx.push(off + ix);
    terrain.vcount += v1.vcount; terrain.triangles += v1.triangles;
    const off2 = terrain.vcount;
    for (let i = 0; i < v2.pos.length; i += 3) terrain.pos.push(v2.pos[i], v2.pos[i + 1], v2.pos[i + 2]);
    for (let i = 0; i < v2.nrm.length; i += 3) terrain.nrm.push(v2.nrm[i], v2.nrm[i + 1], v2.nrm[i + 2]);
    for (let i = 0; i < v2.ext.length; i += 2) terrain.ext.push(v2.ext[i], v2.ext[i + 1]);
    for (let i = 0; i < v2.rel.length; i += 3) terrain.rel.push(0, 0, 0);
    for (const ix of v2.idx) terrain.idx.push(off2 + ix);
    terrain.vcount += v2.vcount; terrain.triangles += v2.triangles;
    volcanoTri = v1.triangles + v2.triangles; volcanoVert = v1.vcount + v2.vcount;
  }
  const coastBuild = buildCoastal(era);
  const coast = coastBuild.mesh;

  totalTri += terrain.triangles + sea.triangles + coast.triangles;
  totalVert += terrain.vcount + sea.vcount + coast.vcount;

  const drawCalls = speciesOut.length + 1 /*terrain*/ + 1 /*sea*/ + 1 /*coast*/;

  return {
    era,
    species: speciesOut,
    terrain: { positions: new Float32Array(terrain.pos), normals: new Float32Array(terrain.nrm), rel: new Float32Array(terrain.rel), ext: new Float32Array(terrain.ext), indices: new Uint16Array(terrain.idx), triangles: terrain.triangles, vertices: terrain.vcount, color: e.floorColor },
    sea: { positions: new Float32Array(sea.pos), normals: new Float32Array(sea.nrm), rel: new Float32Array(sea.rel), ext: new Float32Array(sea.ext), indices: new Uint16Array(sea.idx), triangles: sea.triangles, vertices: sea.vcount },
    coast: { positions: new Float32Array(coast.pos), normals: new Float32Array(coast.nrm), rel: new Float32Array(coast.rel), ext: new Float32Array(coast.ext), indices: new Uint16Array(coast.idx), triangles: coast.triangles, vertices: coast.vcount, color: "--p-mint", coastalPlacements: coastBuild.coastalPlacements },
    triangles: totalTri, vertices: totalVert, drawCalls,
    volcanoTriangles: volcanoTri, volcanoVertices: volcanoVert
  };
}

/* ================================================================
   시간 예산 — §3 3-F 두 표를 코드로
   ================================================================ */
function timeBudget() {
  const eraSeconds = 10 + (40 + 20) * 3 + 20 + 30; // 240
  const inActivity = {
    startCard: 30,
    precambrian: eraSeconds,
    paleozoic: eraSeconds,
    mesozoic: eraSeconds,
    compare: 180,
    share: 240
  };
  const beforeLesson = { tabOpen: 30, controlPractice: 30 };
  return { inActivity, beforeLesson, eraSeconds };
}

/* ================================================================
   폴백 2D 단면도 — 크기 계산 (단일 원천). §6 J-2가 이 함수를 Node에서 그대로 부른다
   (재작업 R5·[5] — 이전에는 sim.js의 drawFlat() 안에만 있어 Node로 검사할 수 없었다).
   ================================================================ */
const STROMATOLITE_FLAT_LAYERS = 7; // §3-A "수평 층 7겹" — 폴백에서도 층 경계선 ≥ 6개(금지 9)
function flatMinSizeFrac(sp) {
  if (sp.id === "stromatolite") return 0.22;
  if (sp.shape === "coral" || sp.sizeM >= 1.8) return 0.12;
  if (!sp.animal) return 0.10;
  return 0.045;
}
function flatSizeFrac(sp, gi) {
  return flatMinSizeFrac(sp) * (1.0 + 0.2 * ((gi * 37) % 10) / 10);
}

/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* 생물 3색 — sim.js 안에서 색 토큰(부록 A 접두 두 가지)으로 읽는 것은 이 3건뿐이다(§5 금지 14 · 검토.js 273행). */
function hex2rgb01(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const PALETTE = {
  "--p-orange": hex2rgb01(CSSV("--p-orange")),
  "--p-violet": hex2rgb01(CSSV("--p-violet")),
  "--p-mint": hex2rgb01(CSSV("--p-mint"))
};
const TXTCOL = { t1: CSSV("--t1"), t3: CSSV("--t3") };

/* ---------------- mat4 / 카메라 도우미 (열 우선, WebGL 관례) ---------------- */
function mat4Identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function mat4Perspective(fovyRad, aspect, near, far) {
  const f = 1 / Math.tan(fovyRad / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
function mat4LookAt(eye, center, up) {
  const z = V.norm(V.sub(eye, center));
  const x = V.norm(V.cross(up, z));
  const y = V.cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0;
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0;
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0;
  m[12] = -V.dot(x, eye); m[13] = -V.dot(y, eye); m[14] = -V.dot(z, eye); m[15] = 1;
  return m;
}
function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
  }
  return o;
}
/* 절대 yaw·pitch → 방향 벡터. 세계 좌표는 x=레일 진행 방향이므로 yaw=0·pitch=0 → (1,0,0). */
function dirFromYawPitch(yawRad, pitchRad) {
  return [Math.cos(yawRad) * Math.cos(pitchRad), Math.sin(pitchRad), Math.sin(yawRad) * Math.cos(pitchRad)];
}
/* 임의의 호길이 s 에서의 국소 프레임 — stopFrame() 과 같은 식, 정지점이 아닌 곳에도 쓴다. */
function frameAtS(era, s) {
  const { eye, dir } = railAt(era, s);
  const ref = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = V.norm(V.cross(dir, ref));
  const up = V.norm(V.cross(right, dir));
  return { eye, dir, right, up };
}
/* 카메라 기준 대상의 방향 — 검사 31~34 와 같은 식(yaw는 atan2, 부호 있는 각).
   pitchDeg는 재작업 R6에서 asin(u/dist)로 고쳤다 — 이전의 atan2(u,f)는 f(전방 성분)만
   보고 r(좌우 성분)을 무시해, 대상이 정면에서 벗어날수록(=r이 커질수록) 앙각이 실제보다
   크게 틀어졌다(중생대 정지점 C 대상: 참값 −5.3°인데 −170.7°로 계산되던 결함). */
function bearingTo(frame, pos) {
  const rel = V.sub(pos, frame.eye);
  const f = V.dot(rel, frame.dir), r = V.dot(rel, frame.right), u = V.dot(rel, frame.up);
  const dist = Math.hypot(f, r, u);
  return { yawDeg: Math.atan2(r, f) * 180 / Math.PI, pitchDeg: Math.asin(Math.max(-1, Math.min(1, u / (dist || 1)))) * 180 / Math.PI, dist };
}
function wrapDeg180(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
/* 방향 인디케이터 4상태 판정 — §3 3-E ⑶ 표 그대로. stopTargetFor()(대상 선정)와
   updateDirIndicator()(실시간 문구) 둘 다 이 하나의 판정으로 통일한다(재작업 R6). */
function dirStateFor(dYaw, dPitch) {
  if (Math.abs(dYaw) <= 25 && Math.abs(dPitch) <= 18) return "inView";
  if (Math.abs(dYaw) <= 25 && dPitch > 18) return "up";
  if (dYaw < -25) return "left"; // |Δyaw|>150°(뒤를 보는 중)에도 부호대로 좌/우 — "위"로 잘못 빠지지 않는다
  if (dYaw > 25) return "right";
  return null; // |Δyaw|≤25·Δpitch≤-18(대상이 아래) — 4상태 밖의 자리, 문구를 새로 만들지 않는다
}

/* ================================================================
   three.js 렌더러 — 코어(r147)만 쓴다(examples/jsm은 ES 모듈이라 못 씀). 그리는 "방식"만
   three.js로 교체한다 — 씬 데이터(buildEra)·확정 문자열·2D 폴백은 한 글자도 바꾸지 않는다.
   THREE 전역이 없거나 WebGLRenderer 생성이 throw하면 usingFallback으로 넘어간다(§3-H 방어선).
   ================================================================ */
const gcv = $("gl");
let usingFallback = false;
let renderer = null, camera = null;
const uTime = { value: 0 };   // sway·orbit·물결·갓레이 셰이더가 함께 쓰는 시간 uniform

/* 데이터 색(GEO.env·PALETTE)은 표시(sRGB) 값이므로 조명 계산 전에 선형으로 바꾼다 —
   출력에서 renderer가 다시 sRGB로 인코딩한다. hex 리터럴을 쓰지 않는다(§5). */
function colFromArr(a) { const c = new THREE.Color(); c.setRGB(a[0], a[1], a[2]); return c.convertSRGBToLinear(); }
function whiteC() { return new THREE.Color(1, 1, 1); }

function initGL() {
  if (typeof THREE === "undefined") return false;
  try { renderer = new THREE.WebGLRenderer({ canvas: gcv, antialias: true, alpha: false }); }
  catch (e) { console.error(e); renderer = null; }
  if (!renderer) return false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // 화질 위해 2까지 — 강등 없음
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 130); // fovY=55 확정값(수평 67.4°가 여기서 나온다)
  return true;
}

/* ---- 생물 재질(PBR) + 정점 변위(sway/orbit) + 프레넬 림라이트 ----
   원래 정점 셰이더(§3 3-B)의 운동식을 MeshStandardMaterial에 onBeforeCompile로 주입한다.
   부착=흔들림(mode 1) / 유영=궤도 헤엄(mode 2)의 구분(관찰 포인트 ③)을 그대로 보존한다.
   림라이트는 어두운 물속에서 생물 외곽을 base color의 밝은 틴트로 발광시켜, 색각과 무관한
   명도·외곽 채널을 하나 더 준다(Q2 확정). GLSL은 모든 생물이 동일 → 프로그램 1개 공유,
   운동값(u_mode/u_sway/u_orbit)만 재질별 uniform으로 달라진다. */
function makeCreatureMaterial(colorArr, hard, mode, sway, orbit) {
  const mat = new THREE.MeshStandardMaterial({
    color: colFromArr(colorArr),
    roughness: hard ? 0.42 : 0.8,
    metalness: hard ? 0.12 : 0.02
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.u_time = uTime;
    shader.uniforms.u_mode = { value: mode || 0 };
    shader.uniforms.u_sway = { value: sway || 0 };
    shader.uniforms.u_orbit = { value: new THREE.Vector2(orbit ? orbit[0] : 0, orbit ? orbit[1] : 0) };
    shader.uniforms.u_rim = { value: hard ? 0.95 : 1.25 };
    shader.vertexShader =
      "attribute vec3 aRel;\nattribute vec2 aExt;\n" +
      "uniform float u_time, u_mode, u_sway;\nuniform vec2 u_orbit;\nvarying float vShade;\n" +
      "vec3 gRotZ(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x*c-v.y*s,v.x*s+v.y*c,v.z);}\n" +
      "vec3 gRotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x*c+v.z*s,v.y,-v.x*s+v.z*c);}\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", [
      "float gPhase = aExt.x; vShade = aExt.y;",
      "vec3 gP; vec3 gN;",
      "if (u_mode > 1.5) {",                              // 유영 — 앵커 중심 수평 원 궤도
      "  vec3 gA = position - aRel;",
      "  float phi = u_time * u_orbit.y + gPhase;",
      "  vec3 gO = gA + vec3(u_orbit.x*cos(phi), 0.35*sin(2.0*phi+gPhase), u_orbit.x*sin(phi));",
      "  float psi = -phi + 1.5707963;",
      "  vec3 rel = aRel; rel.z += 0.10*aRel.x*sin(3.0*phi);",
      "  gP = gO + gRotY(rel, psi); gN = gRotY(normal, psi);",
      "} else if (u_mode > 0.5) {",                       // 고착 흔들림
      "  vec3 gA = position - aRel;",
      "  float theta = u_sway*sin(u_time*0.9+gPhase)*clamp(aRel.y/1.5,0.0,1.0);",
      "  gP = gA + gRotZ(aRel, theta); gN = gRotZ(normal, theta);",
      "} else { gP = position; gN = normal; }",
      "vec3 objectNormal = gN;",
      "#ifdef USE_TANGENT",
      "vec3 objectTangent = vec3( tangent.xyz );",
      "#endif"
    ].join("\n"));
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = gP;");
    shader.fragmentShader = "uniform float u_rim;\nvarying float vShade;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n" +
      "float gFres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.4);\n" +
      "totalEmissiveRadiance += diffuseColor.rgb * (u_rim * gFres + 0.06);\n" +   // 외곽 발광 + 바닥 자기발광
      "totalEmissiveRadiance *= clamp(vShade, 0.82, 1.28);");
  };
  return mat;
}

/* 반투명 수면 — 밝은 물빛 + 잔물결(정점 y sin 합) */
function makeSeaMaterial(env) {
  const mat = new THREE.MeshStandardMaterial({
    color: colFromArr(env.waterColor).lerp(whiteC(), 0.28),
    roughness: 0.14, metalness: 0.0, transparent: true, opacity: 0.5,
    depthWrite: false, side: THREE.DoubleSide
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.u_time = uTime;
    shader.vertexShader = "uniform float u_time;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "vec3 transformed = vec3( position );\n" +
      "transformed.y += 0.16*sin(position.x*0.5 + u_time*1.1) + 0.12*sin(position.z*0.7 + u_time*0.9);");
  };
  return mat;
}

/* BufferGeometry — buildEra()의 배열을 그대로 올린다(F-1: 수치 변형 없음) */
function geomFromChunk(chunk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(chunk.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(chunk.normals, 3));
  if (chunk.rel) g.setAttribute("aRel", new THREE.BufferAttribute(chunk.rel, 3));
  if (chunk.ext) g.setAttribute("aExt", new THREE.BufferAttribute(chunk.ext, 2));
  g.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
  return g;
}

/* 갓레이(빛기둥) — 수면에서 비스듬히 내려오는 additive 반투명 빛 몇 줄(수중 분위기의 핵심).
   콘의 세로 방향으로 알파를 부드럽게 떨어뜨려(위=수면 밝고 아래로 사라짐) 딱딱한 원뿔이 아니라
   퍼지는 빛기둥으로 보이게 한다. 과하지 않게 6줄, 낮은 opacity. */
function addGodrays(scene, env) {
  const tint = colFromArr(env.waterColor).lerp(whiteC(), 0.72);
  const H = 26;
  // 얇은 원기둥을 옆에서 보면 additive 경로 길이가 중심에서 가장 길어 "가운데 밝고 가장자리
  // 부드러운" 빛기둥이 자연스럽게 나온다. 세로 알파를 위·아래로 떨어뜨려 바닥 원반이 안 생기게.
  const mat = new THREE.MeshBasicMaterial({
    color: tint, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: true
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying float vGY;\n" +
      shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvGY = (position.y + " + (H / 2).toFixed(1) + ") / " + H.toFixed(1) + ";");
    shader.fragmentShader = "varying float vGY;\n" +
      shader.fragmentShader.replace("#include <output_fragment>",
        "gl_FragColor.a *= smoothstep(0.02, 0.5, vGY) * (1.0 - smoothstep(0.82, 1.0, vGY));\n#include <output_fragment>");
  };
  for (let i = 0; i < 5; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.0, H, 8, 1, true), mat);
    beam.position.set(16 + i * 22 + (i % 2 ? 5 : -4), 9, -9 + (i * 11) % 26 - 7);
    beam.rotation.z = 0.16 * (i % 2 ? 1 : -1);
    beam.rotation.x = 0.08;
    beam.renderOrder = 8;
    scene.add(beam);
  }
}

/* ================================================================
   시대별 three.js 씬 — buildEra() 의 결과를 그대로 BufferGeometry에 올린다(F-1: 수치 변형 없음)
   ================================================================ */
/* 종별 흔들림·궤도 진폭 — onBeforeCompile로 재질별 uniform이 되어 개체 phase(aExt.x)와 함께
   부착=흔들림 / 유영=헤엄을 만든다. 값 자체는 애니메이션 연출이며 §6 어떤 검사도 재지 않는다. */
function swayOf(sp) { return 0.16; }
function orbitOf(sp) { const r = Math.max(0.9, Math.min(3.2, sp.sizeM * 0.7 + 0.6)); const w = 0.20 + 0.9 / (sp.sizeM + 1.2); return [r, w]; }

const ERA_GPU = {};
const ERA_READY = { precambrian: false, paleozoic: false, mesozoic: false };
let firstFrameMs = null, allErasMs = null, buildStartMs = null;

function buildEraGPU(era) {
  const raw = buildEra(era);
  const speciesList = GEO.species[era];
  const env = GEO.env[era];
  const scene = new THREE.Scene();
  scene.background = colFromArr(env.waterColor).multiplyScalar(0.55); // 사실적 어두운 물빛(rim으로 시인성 확보)
  scene.fog = new THREE.Fog(colFromArr(env.waterColor), env.fogStart, env.fogEnd); // 수심 큐 — 원래 u_fogRange 그대로

  /* 조명 — 사실적 수중 + 생물 시인성 */
  scene.add(new THREE.HemisphereLight(colFromArr(env.waterColor).lerp(whiteC(), 0.5), colFromArr(env.floorColor), 0.65));
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.95, 0.88), 2.4); // 따뜻한 흰빛 주광
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 72;
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0008;
  const sunTarget = new THREE.Object3D(); scene.add(sunTarget); sun.target = sunTarget;
  scene.add(sun);
  // 위-앞-옆에서 비스듬히 스치는 각도 — 스트로마톨라이트 층·삼엽충 마디에 층 그림자가 지게(M2 시각 증거)
  const sunDir = new THREE.Vector3(0.35, 1.0, 0.28).normalize();
  const spot = new THREE.PointLight(new THREE.Color(1.0, 0.97, 0.92), 0.5, 28, 2.0); // 관찰 대상 은근한 집중 조명
  scene.add(spot);
  addGodrays(scene, env);

  /* 해저+화산 — PBR, 그림자 받음/드리움 */
  const terrainMesh = new THREE.Mesh(geomFromChunk(raw.terrain),
    new THREE.MeshStandardMaterial({ color: colFromArr(env.floorColor), roughness: 0.95, metalness: 0.0 }));
  terrainMesh.castShadow = true; terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  /* 육상 실루엣 — 단색(--p-mint), 약한 자기발광으로 안개 안쪽 거리에서도 하늘띠·능선이 보이게 */
  const coastCol = colFromArr(PALETTE[raw.coast.color]);
  const coastMesh = new THREE.Mesh(geomFromChunk(raw.coast),
    new THREE.MeshStandardMaterial({ color: coastCol, roughness: 1.0, metalness: 0.0, emissive: coastCol, emissiveIntensity: 0.22 }));
  scene.add(coastMesh);

  /* 종별 병합 메시 — 부착/유영 운동 보존 */
  raw.species.forEach((s, i) => {
    const sp = speciesList[i];
    const mesh = new THREE.Mesh(geomFromChunk(s), makeCreatureMaterial(PALETTE[s.color], sp.hard, s.mode, swayOf(sp), orbitOf(sp)));
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
  });

  /* 수면 판 — 반투명, 마지막에(깊이 기록 X) */
  const seaMesh = new THREE.Mesh(geomFromChunk(raw.sea), makeSeaMaterial(env));
  seaMesh.renderOrder = 20;
  scene.add(seaMesh);

  ERA_GPU[era] = { scene, sun, sunTarget, sunDir, spot, coast: { placements: raw.coast.coastalPlacements }, raw };
  ERA_READY[era] = true;
}

/* ---------------- 세 시대를 로드 때 전부 만든다(§3 3-C) ---------------- */
function buildAllEras() {
  buildStartMs = performance.now();
  buildEraGPU("precambrian");
  firstFrameMs = performance.now() - buildStartMs;
  drawFrame(0);
  setTimeout(() => {
    buildEraGPU("paleozoic");
    setTimeout(() => {
      buildEraGPU("mesozoic");
      allErasMs = performance.now() - buildStartMs;
      onAllEraseReady();
    }, 0);
  }, 0);
  /* 상한 감시 — X-1 실패 경로(3-C 4). 화면을 멈추지 않고 문구만 띄운다. */
  setTimeout(() => { if (firstFrameMs !== null && firstFrameMs > 3000) showSlowNotice($("perfNote"), TEXT.slowFirstFrame); }, 3100);
  setTimeout(() => { if (!ERA_READY.mesozoic) showSlowNotice($("perfNote"), TEXT.slowAllEras); }, 12100);
}
function showSlowNotice(el, msg) { if (!el) return; el.textContent = msg; el.style.display = ""; }
function onAllEraseReady() {
  setTabDisabled("tabPaleo", false); // 선캄 완료 시 이미 열렸을 수 있음 — 아래 진행 로직에서 다시 판단
  $("perfNote").style.display = "none";
  refreshTabLocks();
}

/* ================================================================
   레일 주행 상태 기계 — §3 3-F 시간표를 코드로 그대로 옮긴다(손으로 다시 안 적는다)
   ================================================================ */
const TB = timeBudget();
const TIMELINE = [
  /* intro 의 s 를 0(레일 맨 앞)이 아니라 정지점 A로 둔다 — §2-④·P4-B3 "캔버스에는 이미
     선캄브리아 정지점 A의 정지 프레임이 그려져 있고 개체가 움직인다... 빈 무대로 시작하지
     않는다"의 정확한 구현. s=0 은 개체 군집(정지점 A/B/C 부근)에서 36~108 m 떨어져 있어
     안개(fogEnd 22/38/30)에 완전히 가려 첫 화면이 빈 무대가 되는 결함이 있었다
     (반환 보고 ⑤ 새 항목 — 이동0 은 그대로 두어 정지점A→A 로 되짚는 형태가 되지만,
     처음 10초 동안 학생 시선은 시작 카드 문구에 있어 자연스러운 장면 전환처럼 읽힌다). */
  { name: "intro", dur: 10, kind: "static", s: GEO.rail.stops[0] },
  { name: "travel0", dur: 40, kind: "travel", sFrom: 0, sTo: GEO.rail.stops[0] },
  { name: "stopA", dur: 20, kind: "static", stopIdx: 0 },
  { name: "travel1", dur: 40, kind: "travel", sFrom: GEO.rail.stops[0], sTo: GEO.rail.stops[1] },
  { name: "stopB", dur: 20, kind: "static", stopIdx: 1 },
  { name: "travel2", dur: 40, kind: "travel", sFrom: GEO.rail.stops[1], sTo: GEO.rail.stops[2] },
  { name: "stopC", dur: 20, kind: "static", stopIdx: 2 },
  { name: "finish", dur: TB.eraSeconds - (10 + 40 * 3 + 20 * 3), kind: "static", s: GEO.rail.stops[2] }
];
function timelineLookup(elapsed) {
  let t = Math.max(0, elapsed);
  for (const seg of TIMELINE) {
    if (t <= seg.dur || seg === TIMELINE[TIMELINE.length - 1]) {
      const frac = seg.dur > 0 ? Math.min(1, t / seg.dur) : 1;
      let s;
      if (seg.kind === "travel") s = seg.sFrom + (seg.sTo - seg.sFrom) * frac;
      else if (seg.stopIdx !== undefined) s = GEO.rail.stops[seg.stopIdx];
      else s = seg.s;
      return { phase: seg.name, s, stopIdx: seg.stopIdx !== undefined ? seg.stopIdx : null };
    }
    t -= seg.dur;
  }
  const last = TIMELINE[TIMELINE.length - 1];
  return { phase: last.name, s: last.s, stopIdx: null };
}
const RAIL_TRAVEL_END = 10 + 40 * 3 + 20 * 3; // 다음 시대 잠금 해제 조건(주행 완료)

const ERA_ORDER = GEO.eras.slice();
const state = {
  eraIdx: 0, mode: "single", // "single" | "triple"
  elapsed: 0, paused: false,
  started: false, // 재작업 R3 — [관찰 시작]을 누르기 전에는 elapsed가 늘지 않는다(레일만 정지)
  userYawDeg: 0, userPitchDeg: 0,
  teacherUnlocked: false, activeTriplePanel: 0,
  unlockedUpTo: 0, // 몇 번째 시대까지 잠금 해제됐는가(0=선캄만)
  perf: { frames: [], stage: 0, dprLow: false, fogCut: false, tripleFreeze: false }
};

function currentEra() { return ERA_ORDER[state.eraIdx]; }

function setTabDisabled(id, disabled) { const b = $(id); if (b) b.disabled = disabled; }
function refreshTabLocks() {
  setTabDisabled("tabPaleo", state.unlockedUpTo < 1 && !state.teacherUnlocked);
  setTabDisabled("tabMeso", state.unlockedUpTo < 2 && !state.teacherUnlocked);
  setTabDisabled("tabTriple", state.unlockedUpTo < 2 && !state.teacherUnlocked);
  $("tabPre").setAttribute("aria-pressed", String(state.mode === "single" && state.eraIdx === 0));
  $("tabPaleo").setAttribute("aria-pressed", String(state.mode === "single" && state.eraIdx === 1));
  $("tabMeso").setAttribute("aria-pressed", String(state.mode === "single" && state.eraIdx === 2));
  $("tabTriple").setAttribute("aria-pressed", String(state.mode === "triple"));
  const preLbl = $("tabPre"), paLbl = $("tabPaleo"), meLbl = $("tabMeso"), trLbl = $("tabTriple");
  if (preLbl) preLbl.textContent = GEO.env.precambrian.label;
  if (paLbl) paLbl.textContent = GEO.env.paleozoic.label + (paLbl.disabled ? TEXT.lockedSuffix : "");
  if (meLbl) meLbl.textContent = GEO.env.mesozoic.label + (meLbl.disabled ? TEXT.lockedSuffix : "");
  if (trLbl) trLbl.textContent = TEXT.tripleTabLabel + (trLbl.disabled ? TEXT.lockedSuffix : "");
  $("btnFinishAll").style.display = state.teacherUnlocked ? "" : "none";
}

function switchEra(idx) {
  state.mode = "single"; state.eraIdx = idx; state.elapsed = 0; state.paused = false;
  state.userYawDeg = 0; state.userPitchDeg = 0;
  // 재작업 R1 — 폴백에서는 drawFrame()이 즉시 return하므로 여기서 직접 다시 그린다.
  // 그러지 않으면 탭을 눌러도 flatEra가 안 바뀌어 화면이 항상 선캄브리아로 남는다.
  if (usingFallback) { flatEra = ERA_ORDER[idx]; drawFlat(); }
  refreshTabLocks(); updateReadout(); toggleTripleLabels();
}
function switchTriple() {
  state.mode = "triple";
  if (usingFallback) drawFlat(); // 재작업 R1 — 단면도 3장을 나란히(3-H ③)
  refreshTabLocks(); updateReadout(); toggleTripleLabels();
}

/* 「세 시대 나란히 보기」가 세로/가로 중 어느 쪽인지 — gl·flat 캔버스와 칸 이름 컨테이너가
   전부 이 하나의 판정을 같이 쓴다(재작업 R4). 이전에는 gcv.clientWidth(≤646px, .wrap
   max-width 탓)로 판정해 어느 해상도에서도 가로가 되지 않는 죽은 분기였다. */
function tripleIsVertical() { return window.innerWidth < 1024; }

/* 「세 시대 나란히 보기」 칸 이름 — 캔버스 위에 겹치지 않게 캔버스 아래 HTML로(§3 3-E) */
function buildTripleLabels() {
  const host = $("tripleLabels"); if (!host) return;
  host.innerHTML = "";
  ERA_ORDER.forEach(era => {
    const cell = document.createElement("div");
    cell.className = "triplecell";
    const name = document.createElement("span"); name.textContent = GEO.env[era].label;
    cell.appendChild(name);
    if (era === "mesozoic") {
      const sub = document.createElement("span"); sub.className = "triplesub"; sub.textContent = TEXT.expandedObserve;
      cell.appendChild(sub);
    }
    host.appendChild(cell);
  });
}
function toggleTripleLabels() {
  const host = $("tripleLabels"); if (!host) return;
  host.style.display = state.mode === "triple" ? "" : "none";
  // 재작업 R4 — 세로 3분할일 때는 칸 이름도 세로로 쌓아 칸과 이름 순서를 맞춘다
  // (선캄 칸이 맨 위인데 이름은 왼쪽, 중생 칸이 맨 아래인데 이름은 오른쪽이던 결함).
  host.classList.toggle("vcol", tripleIsVertical());
}

$("tabPre").onclick = () => switchEra(0);
$("tabPaleo").onclick = () => { if (!$("tabPaleo").disabled) switchEra(1); };
$("tabMeso").onclick = () => { if (!$("tabMeso").disabled) switchEra(2); };
$("tabTriple").onclick = () => { if (!$("tabTriple").disabled) switchTriple(); };

$("btnPause").onclick = () => { state.paused = !state.paused; };
$("btnRewind").onclick = () => { state.elapsed = Math.max(0, state.elapsed - 10); };
$("btnRestart").onclick = () => { state.elapsed = 0; state.paused = false; };
$("teacherLink").onclick = () => { state.teacherUnlocked = true; refreshTabLocks(); };
document.addEventListener("keydown", ev => {
  if (ev.shiftKey && (ev.key === "T" || ev.key === "t")) { state.teacherUnlocked = true; refreshTabLocks(); }
});
$("btnFinishAll").onclick = () => { state.elapsed = RAIL_TRAVEL_END; };

/* ================================================================
   입력 — Pointer Events 하나로 마우스·터치, 화살표 키
   ================================================================ */
const YAW_LIMIT = 100, PITCH_MIN = -40, PITCH_MAX = 60;
let dragging = false, lastX = 0, lastY = 0, edgeHintTimer = null;
function clampView() {
  let hitEdge = false;
  if (state.userYawDeg > YAW_LIMIT) { state.userYawDeg = YAW_LIMIT; hitEdge = true; }
  if (state.userYawDeg < -YAW_LIMIT) { state.userYawDeg = -YAW_LIMIT; hitEdge = true; }
  if (state.userPitchDeg > PITCH_MAX) { state.userPitchDeg = PITCH_MAX; hitEdge = true; }
  if (state.userPitchDeg < PITCH_MIN) { state.userPitchDeg = PITCH_MIN; hitEdge = true; }
  if (hitEdge) {
    $("dragNote").textContent = TEXT.edgeHint;
    clearTimeout(edgeHintTimer);
    edgeHintTimer = setTimeout(() => { $("dragNote").textContent = TEXT.dragHint; }, 1200);
  }
}
function onDragMove(dx, dy) {
  state.userYawDeg += dx * 0.28;
  state.userPitchDeg -= dy * 0.22;
  clampView();
}
gcv.style.touchAction = "none";
gcv.addEventListener("pointerdown", ev => { dragging = true; lastX = ev.clientX; lastY = ev.clientY; gcv.setPointerCapture(ev.pointerId); });
gcv.addEventListener("pointermove", ev => { if (!dragging) return; onDragMove(ev.clientX - lastX, ev.clientY - lastY); lastX = ev.clientX; lastY = ev.clientY; });
gcv.addEventListener("pointerup", () => { dragging = false; });
gcv.addEventListener("pointercancel", () => { dragging = false; });
gcv.setAttribute("tabindex", "0");
gcv.addEventListener("keydown", ev => {
  const step = 4;
  if (ev.key === "ArrowLeft") { state.userYawDeg -= step; clampView(); ev.preventDefault(); }
  else if (ev.key === "ArrowRight") { state.userYawDeg += step; clampView(); ev.preventDefault(); }
  else if (ev.key === "ArrowUp") { state.userPitchDeg += step; clampView(); ev.preventDefault(); }
  else if (ev.key === "ArrowDown") { state.userPitchDeg -= step; clampView(); ev.preventDefault(); }
});

/* ================================================================
   방향 인디케이터 — §3 3-E ⑶ 4상태. 후보 비교는 반드시 Math.abs().
   ================================================================ */
function coastalTargetFor(era) {
  const gpu = ERA_GPU[era]; if (!gpu) return null;
  const labeled = gpu.coast.placements.find(c => c.label);
  return labeled ? labeled.pos : null;
}
function stopTargetFor(era, stopIdx) {
  const { individuals } = placeIndividuals(era);
  const atStop = individuals.filter(ind => ind.stop === stopIdx);
  if (!atStop.length) return null;
  const frame = stopFrame(era, stopIdx);
  const labeled = atStop.find(ind => ind.label);
  // 이름표 개체가 기본 시선(0,0)에서 이미 4상태 중 하나에 걸리면 그것을 그대로 쓴다
  // (§3 3-E ⑶ "이름표 개체가 있으면 그것"). 재작업 R6 — 그렇지 않을 때만(예: 고생대
  // 정지점 B의 삼엽충처럼 앙각이 −26.5°로 4상태 어디에도 안 걸릴 때) 시점 한계 안
  // (|yaw|≤100·−40≤앙각≤60)의 다른 배정 개체 중 4상태가 걸리는 것을 가까운 순으로 고른다.
  if (labeled) {
    const lb = bearingTo(frame, labeled.anchor);
    if (dirStateFor(lb.yawDeg, lb.pitchDeg)) return labeled.anchor;
  }
  const inLimit = atStop.filter(ind => {
    const b = bearingTo(frame, ind.anchor);
    return Math.abs(b.yawDeg) <= YAW_LIMIT && b.pitchDeg >= PITCH_MIN && b.pitchDeg <= PITCH_MAX;
  });
  const withState = inLimit.filter(ind => { const b = bearingTo(frame, ind.anchor); return dirStateFor(b.yawDeg, b.pitchDeg); });
  const pool = withState.length ? withState : (inLimit.length ? inLimit : atStop);
  let best = null, bestD = Infinity;
  for (const ind of pool) { const d = V.len(V.sub(ind.anchor, frame.eye)); if (d < bestD) { bestD = d; best = ind; } }
  return best ? best.anchor : (labeled ? labeled.anchor : null);
}
function currentTargetAnchor(era, tl) {
  if (tl.phase === "finish") return coastalTargetFor(era);
  const idx = tl.stopIdx !== null ? tl.stopIdx : (tl.phase === "intro" ? 0 : (tl.phase.indexOf("travel1") === 0 ? 1 : (tl.phase.indexOf("travel2") === 0 ? 2 : 0)));
  return stopTargetFor(era, idx);
}
function updateDirIndicator(era, tl, frame) {
  const el = $("dirRow"); if (!el) return;
  const anchor = currentTargetAnchor(era, tl);
  if (!anchor) { el.textContent = ""; return; }
  const b = bearingTo(frame, anchor);
  const dYaw = wrapDeg180(b.yawDeg - state.userYawDeg);
  const dPitch = b.pitchDeg - state.userPitchDeg;
  const st = dirStateFor(dYaw, dPitch);
  el.textContent = st ? TEXT.dirIndicator[st] : "";
}

/* ================================================================
   렌더 — three.js 씬 그래프(그리기 순서는 재질 renderOrder/투명도로: 불투명→수면 반투명 마지막).
   조명·그림자·안개는 각 시대 씬에 들어 있고, 카메라만 매 프레임 레일 프레임으로 옮긴다.
   ================================================================ */
const clock = { simTime: 0, frozenTime: 0, lastTs: 0 };

/* 원래 computeViewMatrix와 같은 규칙(frame.dir 기준 절대 yaw/pitch + 사용자 오프셋)으로
   three.js 카메라를 배치한다 — 시야 보장(검사 31~36)은 데이터로 검증되고, 이 카메라 규칙을
   그대로 지키므로 화면도 그 시야를 그대로 담는다. 반환값은 최종 시선 방향(태양 focus 계산용). */
function placeCamera(frame, yawDeg, pitchDeg) {
  const yawBase = Math.atan2(frame.dir[2], frame.dir[0]);
  const pitchBase = Math.asin(Math.max(-1, Math.min(1, frame.dir[1])));
  const yaw = yawBase + yawDeg * Math.PI / 180;
  const pitch = pitchBase + pitchDeg * Math.PI / 180;
  const dir = dirFromYawPitch(yaw, pitch);
  camera.position.set(frame.eye[0], frame.eye[1], frame.eye[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(frame.eye[0] + dir[0], frame.eye[1] + dir[1], frame.eye[2] + dir[2]);
  return dir;
}
/* 태양(그림자)·집중광을 시선 앞 관찰 지점으로 옮겨 그림자 절두체가 늘 보이는 곳을 덮게 한다. */
function updateSun(gpu, fx, fy, fz) {
  gpu.sunTarget.position.set(fx, fy, fz);
  gpu.sun.position.set(fx + gpu.sunDir.x * 34, fy + gpu.sunDir.y * 34, fz + gpu.sunDir.z * 34);
  if (gpu.spot) gpu.spot.position.set(fx, fy + 6, fz + 2);
}

function drawFrame(dtSec) {
  if (usingFallback || !renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 강등 없음 — 최대 화질
  const cssW = gcv.clientWidth || 320, cssH = parseFloat(gcv.style.height) || 300;
  if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
  const sz = renderer.getSize(new THREE.Vector2());
  if (Math.round(sz.x) !== Math.round(cssW) || Math.round(sz.y) !== Math.round(cssH)) renderer.setSize(cssW, cssH, false);
  uTime.value = clock.simTime;

  if (state.mode === "single") {
    const era = currentEra();
    const gpu = ERA_GPU[era];
    if (!gpu) return;
    // 재작업 R3 — [관찰 시작]을 누르기 전에는 elapsed가 늘지 않는다. 그래도 첫 프레임은
    // timelineLookup(0) = "intro" 단계(정지점 A의 정지 프레임)라서 §3 3-E 첫 화면과 그대로 맞는다.
    if (!state.paused && state.started) state.elapsed += dtSec;
    const tl = timelineLookup(state.elapsed);
    if (tl.s >= GEO.rail.stops[GEO.rail.stops.length - 1] - 1e-6 && state.elapsed >= RAIL_TRAVEL_END) {
      state.unlockedUpTo = Math.max(state.unlockedUpTo, state.eraIdx + 1);
    }
    const frame = frameAtS(era, tl.s);
    const dir = placeCamera(frame, state.userYawDeg, state.userPitchDeg);
    camera.aspect = cssW / cssH; camera.fov = 55; camera.updateProjectionMatrix();
    updateSun(gpu, frame.eye[0] + dir[0] * 8, frame.eye[1] + dir[1] * 8, frame.eye[2] + dir[2] * 8);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cssW, cssH);
    renderer.render(gpu.scene, camera); // autoClear로 배경(물빛)·깊이 초기화 후 렌더
    updateDirIndicator(era, tl, frame);
    updateReadoutLive(era, tl);
  } else {
    /* 세 시대 나란히 보기 — 같은 캔버스를 scissor/viewport 로 3분할(§3 3-C ③) */
    if (!state.paused && state.started) state.elapsed += dtSec; // 재작업 R3
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, cssW, cssH); renderer.setScissor(0, 0, cssW, cssH);
    renderer.setClearColor(new THREE.Color(0.03, 0.04, 0.06), 1); renderer.clear(); // 칸 사이 여백은 어두운 무대
    const vertical = tripleIsVertical();
    const n = 3, gap = 2;
    for (let i = 0; i < n; i++) {
      const era = ERA_ORDER[i];
      const gpu = ERA_GPU[era];
      if (!gpu) continue;
      const shrink = era === "mesozoic" ? 0.8 : 1.0;
      let vx, vy, vw, vh;
      if (!vertical) {
        const cellW = (cssW - gap * (n - 1)) / n;
        vw = cellW * shrink; vh = cssH * shrink;
        vx = i * (cellW + gap) + (cellW - vw) / 2; vy = (cssH - vh) / 2;
      } else {
        const cellH = (cssH - gap * (n - 1)) / n;
        vh = cellH * shrink; vw = cssW * shrink;
        vy = cssH - (i + 1) * cellH - i * gap + (cellH - vh) / 2; vx = (cssW - vw) / 2;
      }
      renderer.setViewport(vx, vy, vw, vh); renderer.setScissor(vx, vy, vw, vh);
      const frame = stopFrame(era, 0);
      camera.position.set(frame.eye[0], frame.eye[1], frame.eye[2]);
      camera.up.set(frame.up[0], frame.up[1], frame.up[2]);
      camera.lookAt(frame.eye[0] + frame.dir[0], frame.eye[1] + frame.dir[1], frame.eye[2] + frame.dir[2]);
      camera.aspect = vw / vh; camera.fov = 55; camera.updateProjectionMatrix();
      updateSun(gpu, frame.eye[0] + frame.dir[0] * 8, frame.eye[1] + frame.dir[1] * 8, frame.eye[2] + frame.dir[2] * 8);
      renderer.render(gpu.scene, camera); // autoClear가 이 칸(scissor)만 그 시대 물빛으로 초기화
    }
    renderer.setScissorTest(false);
    updateReadoutTriple();
  }
}

/* ================================================================
   성능 자동 강등 제거 — 사용자 확정 ①(성능 되는 기기에서 화질을 낮추지 않는다).
   loop()가 이 함수를 계속 부르므로 시그니처는 유지하되 아무 것도 강등하지 않는다.
   (WebGL 자체가 안 되는 기기용 2D 단면 폴백은 그대로 유지 — 치명 게이트 X-1 안전망.)
   ================================================================ */
function trackPerf(frameMs) { /* no-op: 화질 강등 없음 */ }

/* ================================================================
   읽음/문구 갱신 — 확정 문구는 TEXT 에서만 읽는다(§5 금지 28)
   ================================================================ */
function mmss(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m + ":" + String(s).padStart(2, "0"); }

function meanAcrossEras(fn) { const vs = GEO.eras.map(fn); return vs.reduce((a, b) => a + b, 0) / vs.length; }
const BOTTOM_MEAN = meanAcrossEras(e => countBy(e, i => i.loc !== "swim") + (GEO.species[e].filter(s => !s.animal).reduce((a, s) => a + s.n, 0)));
const SWIM_MEAN = meanAcrossEras(e => countBy(e, i => i.loc === "swim"));

function updateAriaLabel(era, stopIdxForLabel) {
  const bottomCount = allIndividuals(era).filter(i => i.loc !== "swim").length;
  const swimCount = allIndividuals(era).filter(i => i.loc === "swim").length;
  const bottomWord = bottomCount >= BOTTOM_MEAN ? "많음" : "적음";
  const swimWord = swimCount >= SWIM_MEAN ? "많음" : "적음";
  const label = TEXT.glAriaTemplate
    .replace("{era}", GEO.env[era].introLabel)
    .replace("{stop}", String((stopIdxForLabel === null ? 0 : stopIdxForLabel) + 1))
    .replace("{bottom}", "바닥에 붙은 것 " + bottomWord)
    .replace("{swim}", "헤엄치는 것 " + swimWord);
  gcv.setAttribute("aria-label", label);
  const flatCv = $("flat");
  if (flatCv) flatCv.setAttribute("aria-label", TEXT.flatAriaTemplate.replace("{era}", GEO.env[era].introLabel));
}

function guideTextFor(era, tl) {
  if (tl.phase === "intro") return TEXT.introCard[era];
  if (tl.phase === "finish") return era === "mesozoic" ? TEXT.finishHint + " " + TEXT.todayLine : TEXT.finishHint;
  if (tl.stopIdx !== null) return TEXT.stopBriefing[era][tl.stopIdx];
  return "";
}

/* 재작업 R5 — 이름표 6개(§3 3-A가 이미 확정한 문자열)를 캔버스 밖에 표시한다.
   label 필드는 그동안 방향 인디케이터의 대상 선정과 drawFlat(폴백 전용)에서만 쓰여,
   3D 경로에서는 화면 어디에도 "스트로마톨라이트"·"삼엽충"·"암모나이트"·"양치식물"·
   "공룡" 글자가 없었다(§5 금지 28에 걸리지 않는다 — 문자열은 신설이 아니라 이미 확정된 것). */
function currentEraLabels(era) {
  const seaLabels = GEO.species[era].filter(sp => sp.label).flatMap(sp => Array.isArray(sp.label) ? sp.label : [sp.label]);
  const cl = GEO.coastalLabel[era];
  return cl ? seaLabels.concat(cl.text) : seaLabels;
}

function updateReadoutLive(era, tl) {
  $("eraNow").textContent = GEO.env[era].introLabel;
  $("envLineTxt").textContent = GEO.env[era].envLine;
  const stopShown = tl.stopIdx !== null ? tl.stopIdx + 1 : (tl.phase === "intro" ? 0 : (tl.phase === "finish" ? 3 : (tl.phase === "travel1" ? 1 : tl.phase === "travel2" ? 2 : 0)));
  $("stopNow").textContent = String(stopShown);
  $("timeLeft").textContent = mmss(TB.eraSeconds - state.elapsed);
  $("guideText").textContent = guideTextFor(era, tl);
  updateAriaLabel(era, tl.stopIdx);
  updateChips(tl.stopIdx);
  const sl = $("sceneLabelsLine"); if (sl) sl.textContent = currentEraLabels(era).join(" · ");
}
function updateReadoutTriple() {
  $("eraNow").textContent = TEXT.tripleTabLabel;
  $("envLineTxt").textContent = "";
  $("stopNow").textContent = "–";
  $("timeLeft").textContent = "–:–";
  $("guideText").textContent = "";
  updateChips(null);
  const sl = $("sceneLabelsLine"); if (sl) sl.textContent = "";
}
function updateReadout() {
  if (state.mode === "triple") { updateReadoutTriple(); return; }
  const era = currentEra();
  const tl = timelineLookup(state.elapsed);
  updateReadoutLive(era, tl);
}
function updateChips(stopIdx) {
  const chips = $("chipRow"); if (!chips) return;
  Array.from(chips.children).forEach((c, i) => { c.classList.toggle("on", stopIdx !== null && i === stopIdx); });
}

/* ================================================================
   길이 막대 — 칸 안에 글자를 넣지 않는다. 범례는 막대 아래.
   ================================================================ */
function buildLengthBar() {
  const bar = $("lenBar"), legend = $("lenLegend");
  if (!bar || !legend) return;
  const order = [["precambrian", GEO.env.precambrian.label], ["paleozoic", GEO.env.paleozoic.label],
  ["mesozoic", GEO.env.mesozoic.label], ["cenozoic", GEO.cenozoicLegendLabel]];
  bar.innerHTML = ""; legend.innerHTML = "";
  order.forEach(([key, label]) => {
    const pct = GEO.eraLengthPercent[key];
    const seg = document.createElement("span");
    seg.className = "lenseg"; seg.style.width = pct + "%"; seg.dataset.key = key;
    bar.appendChild(seg);
    const row = document.createElement("div");
    row.className = "lenrow"; row.dataset.key = key;
    const dot = document.createElement("span"); dot.className = "lendot";
    row.appendChild(dot);
    const txt = document.createElement("span"); txt.textContent = label + " " + pct + "%";
    row.appendChild(txt);
    legend.appendChild(row);
  });
  $("lenFoot").textContent = TEXT.lengthBarFootnote;
}
function highlightLengthBar() {
  const key = state.mode === "triple" ? null : currentEra();
  Array.from($("lenBar").children).forEach(seg => seg.classList.toggle("cur", seg.dataset.key === key));
  Array.from($("lenLegend").children).forEach(row => row.classList.toggle("cur", row.dataset.key === key));
}

/* ================================================================
   정적 문구 채우기 — 전부 TEXT/GEO 에서만 읽는다
   ================================================================ */
function fillStaticText() {
  $("h1").textContent = TEXT.h1;
  $("subhead").textContent = TEXT.subhead;
  $("tabHint").textContent = TEXT.tabHint;
  $("dragNote").textContent = TEXT.dragHint;
  $("btnPause").textContent = TEXT.pauseButton;
  $("btnRewind").textContent = TEXT.rewindButton;
  $("btnRestart").textContent = TEXT.restartButton;
  $("teacherLink").textContent = TEXT.teacherUnlockLink;
  $("btnFinishAll").textContent = TEXT.finishAllButton;
  $("lieStrip").textContent = TEXT.lieStripShort;
  $("startBody").textContent = TEXT.lieCardFull;
  $("startBtn").textContent = TEXT.startButton;
  $("sheetSummaryEl").textContent = TEXT.sheetSummary;
  $("limitsIntro").textContent = TEXT.lieCardFull;

  const chips = $("chipRow"); chips.innerHTML = "";
  TEXT.observationChips.forEach(txt => { const s = document.createElement("span"); s.className = "chip"; s.textContent = txt; chips.appendChild(s); });

  const wl = $("worksheetList"); wl.innerHTML = "";
  TEXT.worksheet.forEach(item => {
    const li = document.createElement("li");
    const tag = document.createElement("span"); tag.className = "tagq"; tag.textContent = item.tag;
    li.appendChild(tag); li.appendChild(document.createTextNode(" " + item.body));
    wl.appendChild(li);
  });
  const al = $("assumptionsList"); al.innerHTML = "";
  TEXT.assumptions.forEach(txt => { const li = document.createElement("li"); li.textContent = txt; al.appendChild(li); });

  buildLengthBar();
  $("glFallback").textContent = TEXT.fallbackNotice;
  $("perfNote").style.display = "none";
}

$("startBtn").onclick = () => { $("startCard").style.display = "none"; state.started = true; state.elapsed = 0; };

/* ================================================================
   폴백 2D 단면도 — WebGL 이 없을 때 같은 geotime_core.js 데이터로 그린다(§3 3-H)
   ================================================================ */
const flatCv = $("flat"); const flatCtx = flatCv ? flatCv.getContext("2d") : null;
let flatEra = "precambrian";
/* 시대 하나의 단면도를 (0,0)~(W,H) 안에 그린다 — drawFlat()이 단일 시대에서는 캔버스
   전체로, 「세 시대 나란히 보기」에서는 3분할된 각 칸에 translate 해서 부른다(재작업 R1). */
function drawFlatEra(era, W, H) {
  const e = GEO.env[era];
  const seaFrac = 0.62;
  const skyH = H * (1 - seaFrac);
  flatCtx.fillStyle = "rgb(" + [176, 210, 230].join(",") + ")"; flatCtx.fillRect(0, 0, W, skyH);
  const wc = e.waterColor.map(v => Math.round(v * 255 * 1.6 + 20));
  flatCtx.fillStyle = "rgb(" + wc.join(",") + ")"; flatCtx.fillRect(0, skyH, W, H - skyH);
  const fc = e.floorColor.map(v => Math.round(v * 255));
  flatCtx.fillStyle = "rgb(" + fc.join(",") + ")"; flatCtx.fillRect(0, H - 14, W, 14);

  const shortSide = Math.min(W, H);
  const list = GEO.species[era];
  const { individuals } = placeIndividuals(era);
  const byId = {}; list.forEach(sp => byId[sp.id] = sp);
  const layers = [0.30, 0.55, 0.82];
  let cursor = list.map(() => 0);
  const shapes = [];
  individuals.forEach((ind, gi) => {
    const sp = byId[ind.speciesId];
    const size = shortSide * flatSizeFrac(sp, gi); // §6 J-2 — geotime_core.js와 같은 원천(재작업 [5])
    const li = list.indexOf(sp);
    const layer = layers[cursor[li] % layers.length]; cursor[li]++;
    const x = 24 + ((gi * 53) % (W - 48));
    const y = ind.loc === "swim" ? skyH + (H - 14 - skyH) * (0.15 + 0.55 * layer) : H - 14 - size * 0.5;
    shapes.push({ sp, x, y, size, hard: sp.hard, animal: sp.animal, label: ind.label });
  });
  shapes.forEach(s => {
    const col = PALETTE[s.sp.color];
    flatCtx.fillStyle = "rgb(" + col.map(v => Math.round(v * 255)).join(",") + ")";
    flatCtx.strokeStyle = "rgba(0,0,0,0.35)"; flatCtx.lineWidth = 1;
    if (s.sp.id === "stromatolite") {
      /* 재작업 R7(금지 9) — 매끄러운 타원 1개는 M2의 시각 증거가 0이다. 3D와 같은
         "가로 층 겹침"을 가로 7층 사각형 더미로 그려 층 경계선이 최소 6개(§6 J-2) 나오게 한다. */
      const layersN = STROMATOLITE_FLAT_LAYERS, lh = s.size / layersN, top = s.y - s.size / 2;
      for (let L = 0; L < layersN; L++) {
        const w = s.size * (0.55 + 0.06 * (layersN - L));
        const shade = L % 2 === 0 ? 1.0 : 0.6;
        flatCtx.fillStyle = "rgb(" + col.map(v => Math.round(v * 255 * shade)).join(",") + ")";
        flatCtx.fillRect(s.x - w / 2, top + L * lh, w, lh);
        flatCtx.strokeRect(s.x - w / 2, top + L * lh, w, lh);
      }
    } else if (s.hard) {
      flatCtx.beginPath();
      flatCtx.moveTo(s.x, s.y - s.size / 2); flatCtx.lineTo(s.x + s.size / 2, s.y);
      flatCtx.lineTo(s.x, s.y + s.size / 2); flatCtx.lineTo(s.x - s.size / 2, s.y);
      flatCtx.closePath(); flatCtx.fill(); flatCtx.stroke();
    } else {
      flatCtx.beginPath(); flatCtx.ellipse(s.x, s.y, s.size / 2, s.size / 2.6, 0, 0, 6.2832); flatCtx.fill(); flatCtx.stroke();
    }
    if (s.label) {
      flatCtx.fillStyle = TXTCOL.t1; flatCtx.font = "700 12px sans-serif"; flatCtx.textAlign = "center";
      const lbl = Array.isArray(s.label) ? s.label[0] : s.label;
      /* x = 24 + ((gi*53) % (W-48)) 는 개체 전체 인덱스로 흩어 놓은 값이라 캔버스 가장자리
         가까이 떨어질 수 있다. textAlign="center" 그대로 두면 "스트로마톨라이트"처럼 긴
         확정 문구가 왼쪽으로 잘려 "로마톨라이트"로 보이는 결함이 있었다(반환 보고 ⑤ 새 항목).
         측정한 글자 폭만큼 안쪽으로 밀어 넣어 항상 캔버스 안에 온전히 들어오게 한다. */
      const half = flatCtx.measureText(lbl).width / 2;
      const lx = Math.max(half + 4, Math.min(W - half - 4, s.x));
      flatCtx.fillText(lbl, lx, s.y - s.size / 2 - 6);
    }
  });
  const cl = GEO.coastalLabel[era];
  if (cl) {
    flatCtx.fillStyle = TXTCOL.t3; flatCtx.font = "11px sans-serif"; flatCtx.textAlign = "left";
    flatCtx.fillText(cl.text, 10, skyH - 8);
  }
  flatCtx.fillStyle = TXTCOL.t3; flatCtx.font = "11px sans-serif"; flatCtx.textAlign = "right";
  flatCtx.fillText(GEO.env[era].introLabel, W - 8, 16);
}
function drawFlat() {
  if (!flatCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = flatCv.clientWidth || 320, cssH = parseFloat(flatCv.style.height) || 300;
  flatCv.width = Math.max(1, Math.round(cssW * dpr)); flatCv.height = Math.max(1, Math.round(cssH * dpr));
  flatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH;
  if (state.mode === "triple") {
    // 재작업 R1(3-H ③) — 「세 시대 나란히 보기」에서는 단면도 3장을 나란히 놓는다.
    // R4와 같은 판정(tripleIsVertical)을 그대로 써서 gl 캔버스·칸 이름과 어긋나지 않게 한다.
    const vertical = tripleIsVertical(), n = 3, gap = 4;
    ERA_ORDER.forEach((era, i) => {
      let x0, y0, w, h;
      if (!vertical) { w = (W - gap * (n - 1)) / n; h = H; x0 = i * (w + gap); y0 = 0; }
      else { h = (H - gap * (n - 1)) / n; w = W; y0 = i * (h + gap); x0 = 0; }
      flatCtx.save(); flatCtx.translate(x0, y0); flatCtx.beginPath(); flatCtx.rect(0, 0, w, h); flatCtx.clip();
      drawFlatEra(era, w, h);
      flatCtx.restore();
    });
    return;
  }
  drawFlatEra(flatEra, W, H);
}
function initFallback() {
  usingFallback = true;
  $("glFallback").style.display = "block";
  gcv.style.display = "none";
  flatCv.style.display = "block";
  flatEra = currentEra();
  drawFlat();
  updateReadout(); // 재작업 R2 — drawFrame()이 폴백에서 즉시 return해 초기 우측 열이 비어 있던 결함
}
/* 재작업 R2 — 폴백에서도 타임라인(도입 카드·정지점 안내·잠금 해제)을 돌린다. drawFrame()은
   usingFallback에서 즉시 return하므로 loop()가 이 함수를 대신 부른다. 그림 자체(drawFlat)는
   이미 그 시대 개체 전부를 한 번에 보여 주므로 정지점마다 다시 그릴 필요는 없고, 문구만
   시간에 따라 넘어가면 된다 — 잠금 해제 조건은 3D와 같은 예산(RAIL_TRAVEL_END)을 쓴다. */
function updateFallbackProgress(dtSec) {
  if (state.mode === "triple") { updateReadoutTriple(); return; }
  const era = currentEra();
  if (!state.paused && state.started) state.elapsed += dtSec;
  const tl = timelineLookup(state.elapsed);
  if (tl.s >= GEO.rail.stops[GEO.rail.stops.length - 1] - 1e-6 && state.elapsed >= RAIL_TRAVEL_END) {
    const before = state.unlockedUpTo;
    state.unlockedUpTo = Math.max(state.unlockedUpTo, state.eraIdx + 1);
    if (state.unlockedUpTo !== before) refreshTabLocks();
  }
  updateReadoutLive(era, tl);
}

/* ================================================================
   크기 조정 · 루프
   ================================================================ */
function stageHeightPx(w) { return Math.max(280, Math.min(420, w * 0.62)); }
function resize() {
  const w = gcv.clientWidth || flatCv.clientWidth || 320;
  const h = stageHeightPx(w);
  gcv.style.height = h + "px";
  if (flatCv) flatCv.style.height = h + "px";
  if (usingFallback) drawFlat();
  toggleTripleLabels(); // 재작업 R4 — 창 폭이 바뀌면 가로/세로 판정도 다시 확인
}
let rafId = null, lastTs = 0;
function loop(ts) {
  const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (!usingFallback) {
    clock.simTime += (state.paused && state.mode === "single") ? 0 : dt;
    const t0 = performance.now();
    drawFrame(dt);
    trackPerf(performance.now() - t0);
    highlightLengthBar();
  } else {
    updateFallbackProgress(dt); // 재작업 R2 — 폴백에서도 시간 예산·잠금 해제가 돈다
    highlightLengthBar();
  }
  rafId = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastTs = 0; }
  else if (!rafId) rafId = requestAnimationFrame(loop);
});
window.addEventListener("resize", resize);
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("stageWrap"));

/* ================================================================
   시작
   ================================================================ */
fillStaticText();
buildTripleLabels();
toggleTripleLabels();
refreshTabLocks();
resize();
if (matchMedia("(prefers-reduced-motion:reduce)").matches) { state.paused = true; }

if (initGL()) {
  buildAllEras();
} else {
  initFallback();
}
rafId = requestAnimationFrame(loop);
