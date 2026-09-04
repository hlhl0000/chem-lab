/* ================================================================
   waterdensity_core.js — 물의 밀도와 분자 배열 · 계산부 단일 원천

   ★ 이 파일은 화면과 무관하다. DOM 을 절대 참조하지 않는다.
   ★ waterdensity/sim.js 의 절단 마커 위쪽이 이 파일과 «문자 단위로» 같아야 한다
     (waterdensity_check.js 의 동기 검사가 본다).

   대응 학습지 : [학습지] 26-2 물에 2-1-01 (교사용)
                 「2. 온도에 따른 물의 부피와 밀도 변화 관찰하기」
   대응 교과서 : 고 물질과 에너지(임희준) 50쪽 · 그림 Ⅱ-4(물과 얼음의 분자 배열)
                 · 그림 Ⅱ-5(온도에 따른 물의 부피와 밀도 변화)
   대응 수업설계안 : Ⅱ_용액의성질_수업설계안_v2.md 【차시 9】
   ================================================================ */

const WATERD = {
  /* ── 온도 범위 ────────────────────────────────────────────────
     학습지 (2) 「−4 ℃인 얼음을 10 ℃까지 가열한다고 가정할 때」를 그대로 쓴다. */
  T_START: -4,
  T_MELT: 0,
  T_MID: 4,
  T_END: 10,

  /* ── 얼음 밀도 (0 ℃) ──────────────────────────────────────────
     교과서 50쪽 그림 Ⅱ-5 의 눈금값 0.9170 g/cm³ 를 쓴다.
     이 값이면 0 ℃ 얼음 1 g 의 부피가 1.0905 cm³ 로 나와 학습지 ① 과 일치한다.
     정밀 문헌값은 0.9167 g/cm³ (CRC 97판 · Feistel & Wagner 2006) 이고
     차이는 0.033 % 다 — 유효숫자 세 자리(0.917)에서는 같은 값이다. */
  RHO_ICE0: 0.9170,

  /* 얼음 Ih 의 부피 팽창 계수 (1/K, 0 ℃ 부근).
     선팽창 계수 5.5×10⁻⁵ /K (0 ℃ 부근) × 3 = 1.65×10⁻⁴.
     ⚠ 얼음의 팽창 계수는 온도 의존이 커서 −30 ℃ 아래에서는 크게 작아진다.
        이 모형이 유효한 구간은 −10~0 ℃ 뿐이다. */
  ALPHA_ICE: 1.65e-4,

  /* 비열·융해열 (CRC · 교과서 51쪽) */
  C_ICE: 2.09,          // J/(g·K)
  C_WATER: 4.20,        // J/(g·K)  0~10 ℃ 평균 (4.218@0 ℃ · 4.192@10 ℃)
  L_FUS: 333.5,         // J/g

  /* ── 두 경쟁 효과 분해에 쓰는 «가정» ───────────────────────────
     수소 결합 그물이 없다고 볼 때의 열팽창 계수. 보통 액체 수준(≈4×10⁻⁴ /K).
     ★ 이 값은 «가정»이고 두 몫의 «합»만 실측값이다.
       두 몫이 뒤집히는 온도(= 합이 0 인 온도)는 이 가정과 무관하게 3.98 ℃ 다. */
  ALPHA_THERM: 4.0e-4,

  /* ── 교과서·학습지가 쓴 값 (대조 표시용. 계산에는 쓰지 않는다) ──
     BOOK_V_W0 만 이 모형의 값(1.0002)과 다르다. 화면에 그 차이를 적는다. */
  BOOK_V_ICE0: 1.0905,     // 교과서 그림 Ⅱ-5 · 학습지 ① — 이 모형과 일치
  BOOK_V_W0: 1.0020,       // 교과서 그림 Ⅱ-5 · 학습지 ② — 실측값 1.0002 와 다르다
  BOOK_RHO_ICE0: 0.9170,   // 교과서 그림 Ⅱ-5 밀도 눈금 — 이 모형과 일치
  BOOK_RHO_MAX: 1.0000,    // 교과서 그림 Ⅱ-5 밀도 눈금 — 이 모형 0.99997 과 네 자리에서 일치

  /* ── 진행 s∈[0,1] 의 네 구간 경계 ─────────────────────────────
     학습지 표의 네 행과 1:1 로 맞춘다.
     ⚠ 열량에 비례하지 «않는다». 융해에 드는 열은 전체의 87 % 라서
        열량에 비례시키면 학습지의 나머지 세 행이 슬라이더의 13 % 안에 눌린다.
        실제 열량은 heatGiven() 으로 따로 보여 준다. */
  SEG: [0, 0.25, 0.5, 0.75, 1],

  /* ── 분자 배열 모형 (2 차원) ──────────────────────────────────
     길이 단위 = 얼음의 O···O 거리(결합 길이) 1.
     상자 넓이가 «1 g 의 부피»에 비례하도록 잡는다 — 같은 개수의 분자가
     차지하는 넓이가 곧 부피가 되게 하려는 것이다(M4 : 화면에 명시한다). */
  /* 상자 크기 (결합 길이 단위). 넓이 ÷ 1.299(벌집 한 자리의 넓이) ≈ 분자 수다.
     ★ 두 가지를 함께 정했다 —
       ① 가로:세로를 1.9 로 두어 «무대 비율»에 맞춘다. 1.45 였을 때는 넓은 화면에서
          상자가 무대 가로의 71 % 만 쓰고 나머지를 letterbox 로 버렸다.
       ② 넓이를 218 로 키워 분자를 78개 → 168개로 «촘촘»하게 했다. 배열이 성긴 상태에서는
          「규칙적 ↔ 무질서」의 차이가 눈에 덜 들어온다(사용자 지시 2026-09-04). */
  BOX_W: 20.4,           // 얼음 상태의 상자 가로
  BOX_H: 10.7,           // 〃 세로 (가로/세로 = 1.907)
  /* 공-막대 모형의 크기. 길이 단위는 얼음의 O···O 거리(2.76 Å)다.
     ★ 공을 «크게» 그리면 육각 고리의 빈 공간이 안 보인다 — 이 화면의 주인공이 사라진다.
       실측으로 정한 값: R_O 0.26(지름 0.52) 이면 이웃 사이에 결합선이 보이고
       고리 안쪽이 뚫려 보인다. 화면 최소 중심 거리(실측 0.81)의 «절반 이하»라 겹치지 않는다.
     O–H 는 실제 비(0.96/2.76 = 0.348)에 가깝게 0.36 으로 두어 H 가 이웃을 향해 뻗게 한다. */
  R_O: 0.26,             // 산소 원자 반지름
  R_H: 0.15,             // 수소 원자 반지름
  OH_LEN: 0.36,          // O–H 결합 길이 (실제 비 0.348 에 맞췄다)
  HOH_DEG: 104.5,        // 결합각
  D_MIN_WATER: 0.92,     // 액체 배열의 최소 중심 간 거리 (겹침 방지 · 원 지름 0.80)
  /* 0 ℃ 물에 남겨 그리는 「성긴 국소 배열」 최대 개수.
     분자가 168개로 늘어 상자가 넓어졌으므로 6 → 9 로 올렸다. 0~4 ℃ 에서 «아홉 번»
     풀리므로 재생 중에 하나씩 사라지는 것이 더 자주 보인다. */
  OPEN_MAX: 9,
  RING_JITTER: 0.09,     // 고리 중심을 칸 안에서 흔드는 폭 (칸 크기 대비)
  RING_WOBBLE: 0.05,     // 고리를 일그러뜨리는 폭 (±5 % — 정육각형으로 보이지 않게)
  RING_SPILL: 1.25,      // 고리가 풀릴 때 여섯 분자가 흩어지는 반지름
  SEED: 20260904,        // 배열 생성 씨앗 — 고정이라 언제나 같은 그림이 나온다

  /* 구간 하나를 «재생»하는 데 걸리는 시간 (초).
     사용자 지시: 「각 구간마다 7~8 초 동안 거시적·미시적 변화를 모두 관찰할 수 있도록」.
     전체 재생은 네 구간을 이어 붙여 SEG_SEC × 4 = 30 초다. */
  SEG_SEC: 7.5
};

/* ───────────────────────── 물성 ───────────────────────── */

/* 물의 밀도 (g/cm³) — Kell(1975) 1 atm 식. 유효 구간 0~150 ℃ */
function rhoWater(t) {
  const num = 999.83952 + t * (16.945176 + t * (-7.9870401e-3 + t * (-46.170461e-6
              + t * (105.56302e-9 + t * (-280.54253e-12)))));
  return num / (1 + 16.879850e-3 * t) / 1000;
}

/* 얼음 밀도 (g/cm³) — 0 ℃ 기준 선형 팽창. t ≤ 0 */
function rhoIce(t) {
  return WATERD.RHO_ICE0 / (1 + WATERD.ALPHA_ICE * t);
}

/* 물 1 g 의 부피 (cm³) */
function vWater(t) { return 1 / rhoWater(t); }
function vIce(t) { return 1 / rhoIce(t); }

/* 밀도가 가장 큰 온도 (℃) — 삼분 탐색으로 «찾는다». 상수로 박지 않는다.
   문헌값 3.98 ℃ (SMOW · 1 atm) 와 대조하는 것이 waterdensity_check.js 의 G-1 이다. */
function tMaxDensity() {
  let lo = 0, hi = 10;
  for (let i = 0; i < 200; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (rhoWater(m1) < rhoWater(m2)) lo = m1; else hi = m2;
  }
  return (lo + hi) / 2;
}
const T_RHOMAX = tMaxDensity();
const V_RHOMAX = vWater(T_RHOMAX);

/* ───────────────────────── 진행 → 상태 ───────────────────────── */

/* 진행 s (0~1) → 상태 객체.
   phase : "ice" | "melt" | "water"
   seg   : 0..3 — 학습지 표의 행 번호 그대로
   melt  : 0~1 — 융해된 «질량» 비율 */
function stateAt(s) {
  s = Math.max(0, Math.min(1, s));
  const G = WATERD.SEG;
  if (s < G[1]) {
    const u = (s - G[0]) / (G[1] - G[0]);
    return { seg: 0, phase: "ice", t: WATERD.T_START * (1 - u), melt: 0, u: u };
  }
  if (s < G[2]) {
    const u = (s - G[1]) / (G[2] - G[1]);
    return { seg: 1, phase: u <= 0 ? "ice" : "melt", t: 0, melt: u, u: u };
  }
  if (s < G[3]) {
    const u = (s - G[2]) / (G[3] - G[2]);
    return { seg: 2, phase: "water", t: WATERD.T_MID * u, melt: 1, u: u };
  }
  const u = (s - G[3]) / (G[4] - G[3]);
  return { seg: 3, phase: "water", t: WATERD.T_MID + (WATERD.T_END - WATERD.T_MID) * u,
           melt: 1, u: u };
}

/* 반대 방향 — 온도(와 상태)로부터 진행 s 를 되돌린다. 구간 버튼이 쓴다. */
function progressAt(seg, u) {
  const G = WATERD.SEG;
  u = Math.max(0, Math.min(1, u));
  return G[seg] + (G[seg + 1] - G[seg]) * u;
}

/* 물 1 g 의 부피 (cm³) — 세 상태를 하나의 함수로.
   융해 중에는 «질량 비례 혼합»이다: 1 g 중 melt g 가 물, (1−melt) g 가 얼음.
   비부피는 질량 가중 평균이므로 이 식이 정확하다(근사가 아니다). */
function specVolume(st) {
  if (st.phase === "ice") return vIce(st.t);
  if (st.phase === "melt") return st.melt * vWater(0) + (1 - st.melt) * vIce(0);
  return vWater(st.t);
}

/* 밀도 — 언제나 부피의 역수다. 두 값이 어긋날 길을 만들지 않는다 (F-1 단일 원천) */
function density(st) { return 1 / specVolume(st); }

/* 시작(−4 ℃ 얼음)부터 누적으로 가한 열 (J/g) */
function heatGiven(st) {
  const W = WATERD;
  if (st.phase === "ice") return W.C_ICE * (st.t - W.T_START);
  const qToMelt = W.C_ICE * (0 - W.T_START);
  if (st.phase === "melt") return qToMelt + W.L_FUS * st.melt;
  return qToMelt + W.L_FUS + W.C_WATER * st.t;
}
function heatTotal() {
  const W = WATERD;
  return W.C_ICE * (0 - W.T_START) + W.L_FUS + W.C_WATER * W.T_END;
}

/* ───────────────────────── 반박 장치용 수치 ───────────────────────── */

/* 한 분자당 수소 결합 수 — ★ 모형 값이다.
   얼음 4.00 : 개방 구조에서 주개 2 · 받개 2 가 «모두» 실현된다.
   액체      : 수업설계안 v2 【차시 9】 「액체 물에서는 평균 약 3.4~3.6개」.
               0 ℃ 3.60 → 10 ℃ 3.52 로 단조 감소시킨다.
   ⚠ 이 수는 「무엇을 수소 결합으로 셀 것인가」의 기준에 따라 3.2~3.9 로 달라진다.
      화면에서는 불확실 띠와 함께 그리고, 읽을 것은 두 가지뿐이다 —
      「얼음과 물의 차이가 크지 않다」 그리고 「온도가 오르면 계속 줄어든다」. */
function hbondPerMolecule(st) {
  const w = 3.60 + (3.52 - 3.60) * (st.t / WATERD.T_END);
  if (st.phase === "ice") return 4.00;
  if (st.phase === "melt") return 4.00 + (3.60 - 4.00) * st.melt;
  return w;
}
const HBOND_BAND = 0.10;   // 액체 구간에 함께 그리는 불확실 폭 (±)

/* 「성긴 국소 배열」 상대 지표 (0~1) — 관측된 부피 곡선에서 «유도»한다.
   0 ℃ 물을 1, 밀도가 가장 큰 온도(3.98 ℃)를 0 으로 정규화한 것이다.
   ⚠ 절대 비율이 아니다. 4 ℃ 위에도 실제로는 남아 있지만 이 지표는 0 으로 포화한다. */
function openIndex(st) {
  if (st.phase !== "water") return 1;
  if (st.t >= T_RHOMAX) return 0;
  const r = (vWater(st.t) - V_RHOMAX) / (vWater(0) - V_RHOMAX);
  return Math.max(0, Math.min(1, r));
}
function openClusterFloat(st) { return WATERD.OPEN_MAX * openIndex(st); }
function openClusterCount(st) { return Math.round(openClusterFloat(st)); }

/* 액체 구간의 부피 기울기 dv/dT (cm³/(g·K)) — 실측 곡선의 도함수 */
function dvdt(t) {
  const h = 1e-3;
  return (vWater(t + h) - vWater(t - h)) / (2 * h);
}

/* 두 경쟁 효과로 나눈다.
     열팽창 몫   = +v·ALPHA_THERM        ← 가정
     구조 붕괴 몫 = 관측 − 열팽창 몫       ← 나머지
   ★ 합은 언제나 «관측값»이고, 두 몫이 뒤집히는 온도는 합이 0 인 온도라
     ALPHA_THERM 을 어떻게 잡아도 움직이지 않는다. 이 성질을 화면에 적는다. */
function volumeSplit(t) {
  const obs = dvdt(t);
  const therm = vWater(t) * WATERD.ALPHA_THERM;
  return { obs: obs, therm: therm, struct: obs - therm };
}

/* ───────────────────────── 결정적 난수 ───────────────────────── */
/* 씨앗이 같으면 언제나 같은 수열. 검사 스크립트와 화면이 «같은 배열»을 본다. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────── 얼음 격자 (2 차원 모형) ─────────────────────────
   ★ 화면은 2 차원 모형이다. 실제 얼음은 3 차원 정사면체 개방 구조이고,
     화면의 육각 고리는 그 한 단면이다 — 네 번째 수소 결합은 화면의 앞뒤 방향이다.
     이 사실을 화면 범례와 「가정과 한계」에 적는다. */

/* 결합 길이 1 의 벌집 격자. 상자 [0,W]×[0,H] 안의 꼭짓점만 남긴다. */
function iceLattice(W, H) {
  const seen = Object.create(null), sites = [];
  const S3 = Math.sqrt(3);
  function put(x, y) {
    if (x < -1e-6 || y < -1e-6 || x > W + 1e-6 || y > H + 1e-6) return;
    const k = Math.round(x * 1e4) + "|" + Math.round(y * 1e4);
    if (seen[k] !== undefined) return;
    seen[k] = sites.length;
    sites.push({ x: x, y: y });
  }
  for (let i = -2; 1.5 * i <= W + 3; i++) {
    for (let j = -2; S3 * j <= H + 3; j++) {
      const cx = 1.5 * i, cy = S3 * j + ((i % 2 !== 0) ? S3 / 2 : 0);
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k;
        put(cx + Math.cos(a), cy + Math.sin(a));
      }
    }
  }
  /* 결합 = 거리가 1 인 쌍 */
  let bonds = [];
  for (let i = 0; i < sites.length; i++)
    for (let j = i + 1; j < sites.length; j++) {
      const dx = sites[i].x - sites[j].x, dy = sites[i].y - sites[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - 1) < 0.02) bonds.push([i, j]);
    }
  /* 결합이 1개 이하인 가장자리 꼭짓점을 버린다 — 고립점 0 건, 매달린 분자 0 건.
     ★ 한 번만 쳐 내면 «그 때문에 새로 차수 1 이 된» 이웃이 남는다. 더 나올 것이 없을 때까지 반복한다. */
  let cur = sites;
  for (let pass = 0; pass < 20; pass++) {
    const deg = cur.map(function () { return 0; });
    bonds.forEach(function (b) { deg[b[0]]++; deg[b[1]]++; });
    if (deg.every(function (d) { return d >= 2; })) break;
    const keep = [], remap = new Array(cur.length).fill(-1);
    for (let i = 0; i < cur.length; i++) if (deg[i] >= 2) { remap[i] = keep.length; keep.push(cur[i]); }
    bonds = bonds.filter(function (b) { return remap[b[0]] >= 0 && remap[b[1]] >= 0; })
                 .map(function (b) { return [remap[b[0]], remap[b[1]]]; });
    cur = keep;
  }
  return { sites: cur, bonds: bonds, W: W, H: H };
}

/* 육각 고리(6-사이클) 목록. 고리 하나 = 한 육각형의 여섯 꼭짓점.
   격자를 만든 그 좌표에서 «찾아낸다» — 생성 규칙을 따로 적어 두지 않는다. */
function iceRings(lat) {
  const S3 = Math.sqrt(3), rings = [];
  const idx = Object.create(null);
  lat.sites.forEach(function (p, i) { idx[Math.round(p.x * 1e4) + "|" + Math.round(p.y * 1e4)] = i; });
  for (let i = -2; 1.5 * i <= lat.W + 3; i++) {
    for (let j = -2; S3 * j <= lat.H + 3; j++) {
      const cx = 1.5 * i, cy = S3 * j + ((i % 2 !== 0) ? S3 / 2 : 0);
      const ring = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k;
        const key = Math.round((cx + Math.cos(a)) * 1e4) + "|" + Math.round((cy + Math.sin(a)) * 1e4);
        if (idx[key] === undefined) { ring.length = 0; break; }
        ring.push(idx[key]);
      }
      if (ring.length === 6) rings.push({ cx: cx, cy: cy, sites: ring });
    }
  }
  return rings;
}

/* 얼음 규칙(Bernal–Fowler)의 2 차원 투영 —
     ① 결합 하나에 H 는 정확히 1개   ② 분자 하나에 H 는 2개
   화면의 육각 격자는 3 차원 구조의 한 단면이라 안쪽 분자의 «면내» 결합이 3개다.
   3-정규 그래프에서 출차수의 합 = 간선 수 = 3N/2 이므로 면내 주개 수는 1 또는 2가 되고,
   모자란 H 는 화면 앞뒤 방향이다(짧게 그린다).
   반환 : 각 결합의 방향(주개 index) 배열 */
function orientBonds(lat, rnd) {
  const n = lat.sites.length, bonds = lat.bonds;
  const dirs = bonds.map(function () { return rnd() < 0.5 ? 0 : 1; });   // 0: a→b, 1: b→a
  const inc = [];
  for (let i = 0; i < n; i++) inc.push([]);
  bonds.forEach(function (b, e) { inc[b[0]].push(e); inc[b[1]].push(e); });
  const donorOf = function (e) { return dirs[e] === 0 ? bonds[e][0] : bonds[e][1]; };
  const out = new Array(n).fill(0);
  bonds.forEach(function (b, e) { out[donorOf(e)]++; });
  const deg = inc.map(function (a) { return a.length; });

  for (let pass = 0; pass < 4000; pass++) {
    let bad = -1;
    for (let i = 0; i < n; i++) {
      if (out[i] > 2) { bad = i; break; }
      if (out[i] < deg[i] - 2) { bad = i; break; }   // 받개가 3개 이상이 되지 않게
    }
    if (bad < 0) break;
    const es = inc[bad];
    let done = false;
    if (out[bad] > 2) {                              // 나가는 것을 하나 줄인다
      for (let q = 0; q < es.length && !done; q++) {
        const e = es[q];
        if (donorOf(e) !== bad) continue;
        const other = bonds[e][0] === bad ? bonds[e][1] : bonds[e][0];
        if (out[other] + 1 <= 2) { dirs[e] ^= 1; out[bad]--; out[other]++; done = true; }
      }
    } else {                                         // 나가는 것을 하나 늘린다
      for (let q = 0; q < es.length && !done; q++) {
        const e = es[q];
        if (donorOf(e) === bad) continue;
        const other = bonds[e][0] === bad ? bonds[e][1] : bonds[e][0];
        if (out[other] - 1 >= deg[other] - 2) { dirs[e] ^= 1; out[bad]++; out[other]--; done = true; }
      }
    }
    if (!done) break;
  }
  return { dirs: dirs, out: out, deg: deg, donorOf: donorOf };
}

/* 각 분자의 «방향» — 두 O–H 의 이등분선 각도와, 면내 H 몇 개인지.
   면내 주개가 2개면 두 H 가 그 두 결합을 향하고,
   1개면 나머지 H 는 화면 앞뒤 방향이라 짧게 그린다. */
function moleculeOrient(lat, orient) {
  const half = WATERD.HOH_DEG / 2 * Math.PI / 180;
  const n = lat.sites.length, res = [];
  const donors = [];
  for (let i = 0; i < n; i++) donors.push([]);
  lat.bonds.forEach(function (b, e) {
    const d = orient.donorOf(e), a = b[0] === d ? b[1] : b[0];
    donors[d].push(a);
  });
  for (let i = 0; i < n; i++) {
    const p = lat.sites[i], tg = donors[i];
    if (tg.length >= 2) {
      const a0 = Math.atan2(lat.sites[tg[0]].y - p.y, lat.sites[tg[0]].x - p.x);
      const a1 = Math.atan2(lat.sites[tg[1]].y - p.y, lat.sites[tg[1]].x - p.x);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      res.push({ th: a0 + d / 2, inPlane: 2, flip: d < 0 });
    } else if (tg.length === 1) {
      const a0 = Math.atan2(lat.sites[tg[0]].y - p.y, lat.sites[tg[0]].x - p.x);
      res.push({ th: a0 + half, inPlane: 1, flip: false });
    } else {
      res.push({ th: Math.PI / 2, inPlane: 0, flip: false });
    }
  }
  return res;
}

/* ───────────────────────── 액체 배열 ─────────────────────────
   ★ 얼음과 «같은 개수»의 분자를 넓이가 줄어든 상자에 담는다.
     분자 수도 분자 지름도 변하지 않는다 — 변하는 것은 «배열»뿐이다.
     (진단 A1 ③ 「얼면서 물 분자 자체가 커진다」를 화면이 새로 심지 않게 한다) */

/* 최소 거리 제약 이완. pinned[i] 가 참이면 움직이지 않는다.
   voids : 살아 있는 고리의 중심 목록. «자유» 분자가 그 반지름 안에 들어오면 밖으로 밀어낸다.
   ★ 고리 «안쪽»에 갇힌 분자는 여섯 방향에서 같은 힘으로 눌려 영원히 빠져나오지 못한다 —
     처음 배치에서 고리 안쪽을 피하는 것(farFromRings)과 이 밀어내기가 그것을 막는다.
     FAIL 주입으로 확인한 것: 둘 «중 하나»만 있어도 충분하고, 둘 다 없애면 최소 중심 거리가
     0.55 까지 무너지면서 검사 3항목이 걸린다. 둘 다 남겨 둔다. */
function relax(pts, W, H, dMin, pinned, iters, rnd, voids, voidR, margin) {
  const n = pts.length, m = (margin === undefined) ? WATERD.R_O : margin;
  /* ★ 쌍을 전부 도는 O(N²) 는 분자 168개에서 매 프레임 126만 번이 되어 교실 기기에서 끊긴다.
     칸 크기를 최소 거리와 같게 잡은 «격자 분할»을 쓴다 — 최소 거리보다 가까운 쌍은
     반드시 3×3 이웃 칸 안에 있으므로 «놓치는 쌍이 없다»(근사가 아니다).
     매뉴얼 §10 은 「실기기에서 확인되기 전에는 최적화하지 마라」인데, 여기서는
     168개로 올린 «뒤에» 재어 보고 넣었다(브라우저 실측 프로브가 프레임을 확인한다). */
  const cs = Math.max(dMin, 1e-6);
  const nx = Math.max(1, Math.ceil(W / cs) + 1), ny = Math.max(1, Math.ceil(H / cs) + 1);
  const head = new Int32Array(nx * ny), nextIdx = new Int32Array(n);
  const cellOf = function (p) {
    const cx = Math.max(0, Math.min(nx - 1, Math.floor(p.x / cs)));
    const cy = Math.max(0, Math.min(ny - 1, Math.floor(p.y / cs)));
    return cy * nx + cx;
  };
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    /* 고리 밀어내기는 앞쪽 절반에서만 한다 — 뒤쪽은 최소 거리 이완에 맡긴다.
       끝까지 두면 「반지름으로 밀기」와 「쌍으로 밀기」가 서로 밀어 최소 거리에 못 닿는다. */
    if (voids && voids.length && it < iters * 0.5) {
      for (let i = 0; i < n; i++) {
        if (pinned[i]) continue;
        for (let q = 0; q < voids.length; q++) {
          let dx = pts[i].x - voids[q].x, dy = pts[i].y - voids[q].y;
          let d = Math.sqrt(dx * dx + dy * dy);
          if (d >= voidR) continue;
          if (d < 1e-9) { const a = rnd() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
          pts[i].x = voids[q].x + dx / d * voidR;
          pts[i].y = voids[q].y + dy / d * voidR;
          moved++;
        }
      }
    }
    head.fill(-1);
    for (let i = 0; i < n; i++) { const c = cellOf(pts[i]); nextIdx[i] = head[c]; head[c] = i; }
    for (let i = 0; i < n; i++) {
      const cx = Math.max(0, Math.min(nx - 1, Math.floor(pts[i].x / cs)));
      const cy = Math.max(0, Math.min(ny - 1, Math.floor(pts[i].y / cs)));
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        if (gy < 0 || gy >= ny) continue;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= nx) continue;
          for (let j = head[gy * nx + gx]; j !== -1; j = nextIdx[j]) {
            if (j <= i) continue;
            let dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d >= dMin) continue;
            if (d < 1e-9) { dx = (rnd() - 0.5) * 1e-3; dy = (rnd() - 0.5) * 1e-3; d = 1e-3; }
            const push = (dMin - d) / 2 * 1.02;
            const ux = dx / d * push, uy = dy / d * push;
            const pi = pinned[i], pj = pinned[j];
            if (!pi && !pj) { pts[i].x -= ux; pts[i].y -= uy; pts[j].x += ux; pts[j].y += uy; }
            else if (pi && !pj) { pts[j].x += ux * 2; pts[j].y += uy * 2; }
            else if (!pi && pj) { pts[i].x -= ux * 2; pts[i].y -= uy * 2; }
            moved++;
          }
        }
      }
      if (!pinned[i]) {
        pts[i].x = Math.max(m, Math.min(W - m, pts[i].x));
        pts[i].y = Math.max(m, Math.min(H - m, pts[i].y));
      }
    }
    if (!moved) break;
  }
  return pts;
}

/* 성긴 고리를 k 개 남긴 액체 배열을 «k = OPEN_MAX 에서 0 까지» 차례로 만든다.
   ① 분자 번호(정체)가 모든 배열에서 같다 — 사이를 보간해도 분자가 뒤바뀌지 않는다
   ② 고리 하나가 풀릴 때마다 그 여섯 분자가 풀려 나오고 «주변도 함께» 다시 자리를 잡는다
      (교과서 50쪽 「남아 있던 육각형 구조가 허물어지면서 공간이 물 분자로 채워지므로」) */
function waterArrangements(nMol, W, H, seed) {
  const rnd = mulberry32(seed);
  const K = WATERD.OPEN_MAX, dMin = WATERD.D_MIN_WATER, m = WATERD.R_O;

  /* 고리 중심 — 상자를 K 칸으로 나눠 한 칸에 하나씩. 흔드는 폭을 칸의 9 % 로 묶어
     어떤 두 고리도 최소 거리 아래로 붙지 않게 한다(waterdensity_check.js 가 확인한다). */
  /* 칸 나누기는 「중심끼리 가장 멀어지는」 배치를 «고른다» — 상자 비율이 바뀌어도
     고리끼리 최소 거리 아래로 붙지 않는다(waterdensity_check.js 가 실제 간격을 잰다). */
  let cols = 1, bestSep = -1;
  for (let c = 1; c <= K; c++) {
    const r = Math.ceil(K / c), sep = Math.min(W / c, H / r);
    if (sep > bestSep) { bestSep = sep; cols = c; }
  }
  const rows = Math.ceil(K / cols), centers = [];
  const cw = W / cols, ch = H / rows;
  for (let k = 0; k < K; k++) {
    const c = k % cols, r = Math.floor(k / cols);
    centers.push({
      x: cw * (c + 0.5) + (rnd() - 0.5) * cw * WATERD.RING_JITTER * 2,
      y: ch * (r + 0.5) + (rnd() - 0.5) * ch * WATERD.RING_JITTER * 2
    });
  }

  /* 분자 번호 배정 : 0..6K−1 은 고리 소속, 나머지는 처음부터 무질서 */
  const pts = [], ringOf = new Array(nMol).fill(-1);
  for (let k = 0; k < K; k++) {
    const ph = rnd() * Math.PI / 3;
    for (let v = 0; v < 6; v++) {
      const a = ph + Math.PI / 3 * v;
      const rr = 1 + (rnd() - 0.5) * 2 * WATERD.RING_WOBBLE;
      pts.push({ x: centers[k].x + rr * Math.cos(a), y: centers[k].y + rr * Math.sin(a) });
      ringOf[k * 6 + v] = k;
    }
  }
  /* 자유 분자는 고리 «안쪽»을 피해서 놓는다.
     반지름 1 의 고리 안에서 최소 거리 0.92 를 지킬 수 있는 자리는 중심의 아주 작은
     원반뿐이라, 그 사이(0.1~1.64)에 놓이면 어디로도 못 간다. 처음부터 피한다. */
  const VOID_R = 1.66, PLACE_R = 1.95;
  const farFromRings = function (x, y, live) {
    for (let q = 0; q < live; q++) {
      const dx = x - centers[q].x, dy = y - centers[q].y;
      if (dx * dx + dy * dy < PLACE_R * PLACE_R) return false;
    }
    return true;
  };
  for (let i = 6 * K; i < nMol; i++) {
    let x = 0, y = 0;
    for (let tryN = 0; tryN < 400; tryN++) {
      x = m + rnd() * (W - 2 * m); y = m + rnd() * (H - 2 * m);
      if (farFromRings(x, y, K)) break;
    }
    pts.push({ x: x, y: y });
  }

  const snap = function (p) { return p.map(function (q) { return { x: q.x, y: q.y }; }); };
  const pinFor = function (k) {
    return ringOf.map(function (r) { return r >= 0 && r < k; });
  };
  const voidsFor = function (k) { return centers.slice(0, k); };

  /* k = K 배열 : 고리 K 개를 고정하고 나머지를 이완 */
  relax(pts, W, H, dMin, pinFor(K), 300, rnd, voidsFor(K), VOID_R);
  const out = new Array(K + 1);
  out[K] = { pos: snap(pts), rings: K };

  /* 고리를 하나씩 «허문다» — 큰 번호부터.
     여섯 분자를 고리 중심 둘레의 원반 안으로 흩뜨린다. 고리 «안쪽»에도 들어가므로
     「빈 공간이 다른 물 분자로 채워진다」(교과서 50쪽)가 그대로 그려진다.
     흩어지는 거리를 고리 반지름 정도로 묶어, 분자가 화면을 가로질러 날아가지 않게 한다. */
  for (let k = K - 1; k >= 0; k--) {
    for (let v = 0; v < 6; v++) {
      const i = k * 6 + v;
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * WATERD.RING_SPILL;
      pts[i].x = Math.max(m, Math.min(W - m, centers[k].x + rr * Math.cos(a)));
      pts[i].y = Math.max(m, Math.min(H - m, centers[k].y + rr * Math.sin(a)));
    }
    relax(pts, W, H, dMin, pinFor(k), 300, rnd, voidsFor(k), VOID_R);
    out[k] = { pos: snap(pts), rings: k };
  }
  return { arr: out, ringOf: ringOf, centers: centers, W: W, H: H };
}

/* 상자 크기 — 넓이가 「물 1 g 의 부피」에 비례한다.
   얼음 0 ℃ 를 기준으로 잡고, 다른 상태는 √(v/v얼음0) 만큼 선형으로 줄인다. */
function boxScale(st) {
  return Math.sqrt(specVolume(st) / vIce(0));
}

/* 성긴 고리 판정기 — 렌더가 쓰는 «그 좌표»를 그대로 본다 (원칙 11).
   고리이려면 세 가지가 모두 성립해야 한다.
     ① 여섯 분자가 한 점에서 반지름 0.86~1.16 안에 있다
     ② 그 여섯이 둘레를 «고르게» 나눈다 (이웃 각 간격 60°±20°)
     ③ ★ 가운데가 비어 있다 — 중심 0.72 안에 어떤 분자도 없다
   ③ 이 이 지표의 뜻(「성긴」)을 정하는 조건이다. 이것을 빼면 뭉친 6개도 고리로 세어진다. */
function detectRings(pos, ringOf, K) {
  let found = 0;
  for (let k = 0; k < K; k++) {
    const ids = [];
    for (let i = 0; i < ringOf.length; i++) if (ringOf[i] === k) ids.push(i);
    if (ids.length !== 6) continue;
    let cx = 0, cy = 0;
    ids.forEach(function (i) { cx += pos[i].x; cy += pos[i].y; });
    cx /= 6; cy /= 6;
    let ok = true;
    const angs = [];
    for (let q = 0; q < 6 && ok; q++) {
      const p = pos[ids[q]];
      const dx = p.x - cx, dy = p.y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 0.86 || r > 1.16) ok = false;
      angs.push(Math.atan2(dy, dx));
    }
    if (ok) {
      angs.sort(function (a, b) { return a - b; });
      for (let q = 0; q < 6; q++) {
        let d = (q === 5 ? angs[0] + 2 * Math.PI : angs[q + 1]) - angs[q];
        if (Math.abs(d - Math.PI / 3) > 20 * Math.PI / 180) { ok = false; break; }
      }
    }
    if (ok) {
      for (let i = 0; i < pos.length; i++) {
        const dx = pos[i].x - cx, dy = pos[i].y - cy;
        if (dx * dx + dy * dy < 0.72 * 0.72) { ok = false; break; }
      }
    }
    if (ok) found++;
  }
  return found;
}

/* ───────────────────────── 배열 모형 만들기 (한 번만) ───────────────────────── */
const LAT = iceLattice(WATERD.BOX_W, WATERD.BOX_H);
const RINGS = iceRings(LAT);
const ORIENT = orientBonds(LAT, mulberry32(WATERD.SEED));
const MOL = moleculeOrient(LAT, ORIENT);
const NMOL = LAT.sites.length;
const kW = Math.sqrt(vWater(0) / vIce(0));
const WATER = waterArrangements(NMOL, WATERD.BOX_W * kW, WATERD.BOX_H * kW, WATERD.SEED);

/* 얼음 → 액체 대응 : 가까운 것끼리 잇는다(선이 서로 꼬이지 않게).
   기준 배열은 0 ℃ 물(고리 6개)이다. */
const MATCH = (function () {
  const target = WATER.arr[WATERD.OPEN_MAX].pos;
  const used = new Array(NMOL).fill(false), map = new Array(NMOL).fill(-1);
  const order = LAT.sites.map(function (p, i) { return i; })
    .sort(function (a, b) { return LAT.sites[a].y - LAT.sites[b].y || LAT.sites[a].x - LAT.sites[b].x; });
  for (let q = 0; q < order.length; q++) {
    const i = order[q], p = LAT.sites[i];
    let best = -1, bd = Infinity;
    for (let j = 0; j < NMOL; j++) {
      if (used[j]) continue;
      const dx = target[j].x / kW - p.x, dy = target[j].y / kW - p.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = j; }
    }
    used[best] = true; map[i] = best;
  }
  return map;   // 얼음 site i ↔ 액체 분자 map[i]
})();

/* 융해 순서 (0~1 · 작을수록 먼저 녹는다).
   ★ «아래쪽부터» 녹는다 — 거시 화면이 물을 아래, 얼음을 위에 그리기 때문이다.
     방향을 반대로 두면 같은 실험의 두 배율이 서로 모순된 그림을 보인다(J-N5). */
const MELT_ORDER = (function () {
  const ys = LAT.sites.map(function (p) { return p.y; });
  const lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
  const rnd = mulberry32(WATERD.SEED + 7);
  return LAT.sites.map(function (p) {
    const base = (p.y - lo) / (hi - lo + 1e-9);            // y 가 작을수록(아래) 먼저
    return Math.max(0, Math.min(1, base * 0.82 + rnd() * 0.18));
  });
})();

/* ───────────────────────── 현재 배열 계산 ─────────────────────────
   ★ 거시 화면과 분자 화면은 «같은 상태 하나»를 읽는다 (§14①).
     전환은 렌더러를 바꾸는 것일 뿐 실험은 그대로 이어진다. */
/* 화면 겹침을 막는 최소 거리. 그린 원의 지름(2·R_O = 0.80)보다 넉넉하게 잡는다.
   완성된 배열들은 이미 0.89 이상이라 이 이완은 «보간 중»에만 실제로 움직인다. */
const D_RENDER = 0.86;

function arrangementAt(st) {
  const scale = boxScale(st);                     // 얼음 0 ℃ 기준 선형 배율
  const W = WATERD.BOX_W * scale, H = WATERD.BOX_H * scale;
  const pos = new Array(NMOL), phase = new Array(NMOL);
  const openF = openClusterFloat(st);
  const k0 = Math.max(0, Math.min(WATERD.OPEN_MAX, Math.floor(openF)));
  const k1 = Math.min(WATERD.OPEN_MAX, k0 + 1);
  const fk = openF - k0;
  const A = WATER.arr[k0].pos, B = WATER.arr[k1].pos;
  const wScale = scale / kW;                      // 액체 배열은 0 ℃ 물 상자 기준이다

  const WIN = 0.16;                               // 분자 하나가 옮겨 가는 데 쓰는 진행 폭
  for (let i = 0; i < NMOL; i++) {
    const j = MATCH[i];
    const wx = (A[j].x + (B[j].x - A[j].x) * fk) * wScale;
    const wy = (A[j].y + (B[j].y - A[j].y) * fk) * wScale;
    if (st.phase === "ice") {
      pos[i] = { x: LAT.sites[i].x * scale, y: LAT.sites[i].y * scale };
      phase[i] = 0;
    } else if (st.phase === "melt") {
      const m = st.melt * (1 + WIN) - WIN;
      let f = (m - MELT_ORDER[i]) / WIN + 1;
      f = Math.max(0, Math.min(1, f));
      const e = f * f * (3 - 2 * f);                                  // 부드럽게
      const ix = LAT.sites[i].x * scale, iy = LAT.sites[i].y * scale;
      pos[i] = { x: ix + (wx - ix) * e, y: iy + (wy - iy) * e };
      phase[i] = e;
    } else {
      pos[i] = { x: wx, y: wy };
      phase[i] = 1;
    }
  }

  /* ★ 보간한 «중간» 상태는 그 자체로는 겹칠 수 있다 —
       두 분자가 서로를 지나가면 화면에서 관통한다(매뉴얼 4부 ㊵ 와 같은 결함).
       그래서 중간 상태에도 최소 거리 이완을 건다. 입력이 같으면 출력도 같다(경로 의존 없음).

     ⚠ 예전에는 「아직 격자에 있는 분자」를 «고정»해 격자를 지키려 했는데, 그러면 녹은 분자가
       고정된 분자들 사이에 끼어 «어느 방향으로도 못 나가는» 자리가 생긴다 — 600번을 돌려도
       최소 거리가 0.095 에서 멈췄다(2026-09-04 실측). 고정은 필요하지도 않다:
       얼음 격자의 이웃 거리(1.0×배율 ≈ 0.97)가 D_RENDER(0.86)보다 «크므로» 격자 분자끼리는
       애초에 밀리지 않는다. 대신 상자 여백을 0 으로 주어 가장자리 분자가 안쪽으로
       당겨지지 않게 한다(그것이 고정을 넣었던 진짜 이유였다). */
  const nopin = phase.map(function () { return false; });
  relax(pos, W, H, D_RENDER, nopin, 120, mulberry32(WATERD.SEED + 11), null, 0, 0);

  return { pos: pos, phase: phase, W: W, H: H, scale: scale, rings: openF, k0: k0, k1: k1, fk: fk };
}
/* 같은 진행에서 배열을 두 번 계산하지 않는다. 진행을 1/800 로 잘라 열쇠로 쓴다
   (전 구간 800 칸 — 26 초 재생에서 초당 31 번). */
let ARR_CACHE = null, ARR_KEY = -1;
function arrangementCached(st, s) {
  const key = Math.round(s * 800);
  if (key !== ARR_KEY || !ARR_CACHE) { ARR_CACHE = arrangementAt(st); ARR_KEY = key; }
  return ARR_CACHE;
}

/* ── 「이 구간이 시작될 때의 자리」 ─────────────────────────────────────
   −4→0 ℃ 와 4→10 ℃ 에서는 «배열이 바뀌지 않는다» — 같은 격자·같은 무질서 배치가
   0.03 % · 0.01 % 만 넓어질 뿐이다. 화면에서는 각각 0.21 px · 0.09 px 라
   그냥 그리면 「고장 났나」로 읽힌다(2026-09-04 사용자 지적).
   그래서 네 구간 모두에 「구간이 시작될 때의 자리」를 회색 고스트로 겹쳐 그리고,
   그 «차이만» 배율을 건다. 배율은 구간 «끝»의 최대 이동에서 유도하므로
   구간 안에서 일정하고, 간격이 진행에 비례해 벌어진다. */
const SEG_START = [], SEG_MAXDISP = [];
function segStartArrangement(seg) {
  if (!SEG_START[seg]) SEG_START[seg] = arrangementAt(stateAt(progressAt(seg, 0)));
  return SEG_START[seg];
}
/* 구간 끝에서 분자가 가장 많이 옮겨 간 거리 (모형 단위). 화면 배율과 무관하다. */
function segMaxDisp(seg) {
  if (SEG_MAXDISP[seg] === undefined) {
    const A = segStartArrangement(seg), B = arrangementAt(stateAt(progressAt(seg, 0.9999)));
    /* ★ «상자 가운데를 맞춰» 잰다. 왼쪽 아래 원점 기준으로 재면 팽창이 「오른쪽으로 쏠린
       평행 이동」처럼 보이고, 「고르게 넓어진다」는 설명과 그림이 어긋난다(2026-09-04 실측). */
    let mx = 0;
    for (let i = 0; i < A.pos.length; i++) {
      const dx = (A.pos[i].x - A.W / 2) - (B.pos[i].x - B.W / 2);
      const dy = (A.pos[i].y - A.H / 2) - (B.pos[i].y - B.H / 2);
      mx = Math.max(mx, Math.sqrt(dx * dx + dy * dy));
    }
    SEG_MAXDISP[seg] = mx;
  }
  return SEG_MAXDISP[seg];
}

/* ── 분자 돋보기가 확대해 보일 「이웃 한 쌍」 ───────────────────────────
   −4→0 ℃ 와 4→10 ℃ 에서 달라지는 것은 «분자 사이 거리»뿐이다(0.033 % · 0.014 %).
   거시 화면이 액면을 원형 돋보기로 확대해 보이듯, 분자 화면도 «이웃 한 쌍»을 확대해
   그 사이가 벌어지는 것을 보인다(사용자 지시 2026-09-04).
   ★ 쌍은 상자 «가운데»에 가장 가까운 것을 고른다 — 가장자리 쌍은 상자 선에 겹친다.
   ★ 얼음 구간은 실제 수소 결합 쌍, 액체 구간은 가장 가까운 이웃 쌍이다.
   ★ 판정기·라벨이 쓰는 거리는 렌더가 쓰는 «그 좌표»에서 잰다(원칙 11). */
/* ⚠ 돋보기를 쓰는 구간은 «배열이 안 바뀌는» 0 과 3 뿐이다.
   0→4 ℃(구간 2)에서는 한 쌍의 거리가 성긴 고리가 풀리며 +9.6 % 나 벌어지는데
   «부피는 오히려 줄어든다». 그 구간에 한 쌍만 확대해 보이면 정반대로 읽힌다. */
function loupeSeg(seg) { return seg === 0 || seg === 3; }
const LOUPE_PAIR = [];
function loupePair(seg) {
  if (LOUPE_PAIR[seg] !== undefined) return LOUPE_PAIR[seg];
  if (!loupeSeg(seg)) { LOUPE_PAIR[seg] = null; return null; }
  const A = segStartArrangement(seg), cx = A.W / 2, cy = A.H / 2;
  let best = null;
  const consider = function (i, j) {
    const mx = (A.pos[i].x + A.pos[j].x) / 2, my = (A.pos[i].y + A.pos[j].y) / 2;
    const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
    if (!best || d2 < best.d2) best = { i: i, j: j, d2: d2 };
  };
  if (seg === 0) {
    LAT.bonds.forEach(function (b) { consider(b[0], b[1]); });
  } else {
    for (let i = 0; i < NMOL; i++)
      for (let j = i + 1; j < NMOL; j++) {
        const dx = A.pos[i].x - A.pos[j].x, dy = A.pos[i].y - A.pos[j].y;
        if (dx * dx + dy * dy > 1.05 * 1.05) continue;      // 맞닿은 이웃만
        consider(i, j);
      }
  }
  LOUPE_PAIR[seg] = best;
  return best;
}
/* 그 쌍의 중심 간 거리 (모형 단위) */
function pairDist(pos, pr) {
  const dx = pos[pr.i].x - pos[pr.j].x, dy = pos[pr.i].y - pos[pr.j].y;
  return Math.sqrt(dx * dx + dy * dy);
}
/* 구간 «끝»에서 그 거리가 얼마나 달라지는가 (모형 단위). 돋보기 배율의 근거다. */
const SEG_PAIR_SPAN = [];
function segPairSpan(seg) {
  if (SEG_PAIR_SPAN[seg] !== undefined) return SEG_PAIR_SPAN[seg];
  const pr = loupePair(seg);
  if (!pr) { SEG_PAIR_SPAN[seg] = 0; return 0; }
  const a = pairDist(segStartArrangement(seg).pos, pr);
  const b = pairDist(arrangementAt(stateAt(progressAt(seg, 0.9999))).pos, pr);
  SEG_PAIR_SPAN[seg] = b - a;
  return SEG_PAIR_SPAN[seg];
}

/* 분자 돋보기의 반지름 — 거시 화면의 액면 돋보기보다 «크게» 잡는다.
   분자 화면에서는 이 돋보기가 관찰의 중심이기 때문이다(사용자 지시 2026-09-04).
   거시 액면 돋보기는 rulerW/2−6 이라 최대 42 px 다. waterdensity_check.js 가 둘을 견준다. */
function microLoupeR(w) {
  const wide = w >= 560;
  return Math.round(Math.max(40, Math.min(84, w * (wide ? 0.118 : 0.150))));
}
/* 거시 액면 돋보기의 반지름 — drawMacro 가 쓰는 그 식 그대로 */
function macroLoupeR(w) {
  return Math.min(96, Math.max(66, w * 0.15)) / 2 - 6;
}

/* Node 에서 검증 스크립트가 쓸 수 있게 (브라우저에서는 무시된다) */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WATERD, rhoWater, rhoIce, vWater, vIce, tMaxDensity, T_RHOMAX, V_RHOMAX,
    stateAt, progressAt, specVolume, density, heatGiven, heatTotal,
    hbondPerMolecule, HBOND_BAND, openIndex, openClusterFloat, openClusterCount,
    dvdt, volumeSplit, mulberry32, iceLattice, iceRings, orientBonds,
    moleculeOrient, relax, waterArrangements, boxScale, detectRings,
    LAT, RINGS, ORIENT, MOL, NMOL, kW, WATER, MATCH, MELT_ORDER,
    arrangementAt, arrangementCached, D_RENDER, segStartArrangement, segMaxDisp,
    loupePair, pairDist, segPairSpan, loupeSeg, microLoupeR, macroLoupeR
  };
}

/* ================= UI + 캔버스 렌더 ================= */
(function () {
"use strict";
if (typeof document === "undefined") return;

const $ = function (id) { return document.getElementById(id); };
const CSSV = function (n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
};

/* 색은 토큰에서 읽는다 (§12③). CPK 원자색과 계측기 관습색만 예외다. */
const C = {
  blue: CSSV("--d-blue"), cyan: CSSV("--d-cyan"), green: CSSV("--d-green"),
  amber: CSSV("--d-amber"), red: CSSV("--d-red"), violet: CSSV("--d-violet"),
  gray: CSSV("--d-gray"), t1: CSSV("--t1"), t2: CSSV("--t2"), t3: CSSV("--t3"),
  line: CSSV("--line"), stageLine: CSSV("--stage-line")
};
const CPK_O = "#FF0D0D", CPK_H = "#FFFFFF";
const darker = function (hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16 & 255) * f), g = Math.round((n >> 8 & 255) * f), b = Math.round((n & 255) * f);
  return "rgb(" + r + "," + g + "," + b + ")";
};
const O_STROKE = darker(CPK_O, 0.5), H_STROKE = darker(CPK_H, 0.45);

/* ───────────────────────── 상태 ───────────────────────── */
const S = {
  s: 0,                 // 진행 0~1
  view: "macro",        // "macro" | "micro"
  data: "vol",          // "vol" | "rho" | "hb"
  running: false,
  playSeg: null,        // null = 네 구간 연속 재생 · 0~3 = 그 구간만 재생
  done: false,          // 방금 재생이 끝났는가 (「다시 보기」 안내를 띄운다)
  motion: false,        // 분자 진동·이동 보이기 (기본 꺼짐 — 배열에 집중)
  showBook: false,      // 교과서 그림 Ⅱ-5 값 함께 보기
  t0: 0
};
const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/* 진행 s 는 네 구간을 «같은 길이»로 나눈 값이라 구간 하나가 s 로 0.25 다.
   초당 진행을 0.25/SEG_SEC 로 두면 구간 하나가 정확히 SEG_SEC 초에 지나간다. */
const S_PER_SEC = 0.25 / WATERD.SEG_SEC;

/* 재생 시작. seg 가 null 이면 지금 자리에서 끝까지, 숫자면 그 구간을 «처음부터». */
function playFrom(seg) {
  S.playSeg = seg;
  S.done = false;
  if (seg === null) { if (S.s >= 1 - 1e-9) S.s = 0; }
  else S.s = WATERD.SEG[seg];
  S.running = true;
}
/* 지금 재생이 멈춰야 하는 지점 */
function playEnd() {
  return S.playSeg === null ? 1 : WATERD.SEG[S.playSeg + 1];
}

/* ───────────────────────── 캔버스 준비 ───────────────────────── */
function fitCanvas(cv, hCss) {
  const wrap = cv.parentElement;
  const wCss = Math.max(1, wrap.clientWidth);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(wCss * dpr);
  cv.height = Math.round(hCss * dpr);
  cv.style.height = hCss + "px";
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g: g, w: wCss, h: hCss };
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ───────────────────────── 거시 화면 ─────────────────────────
   비커 단면 · 온도계 · 가열판 · 액면 돋보기.
   ⚠ 그림은 얼음과 물을 위아래로 나누어 그린 도식이다. 전체 높이(= 전체 부피)는
     정확하지만, 실제로 물에 뜬 얼음은 부피의 약 92 % 가 물에 잠긴다 — 화면에 적는다. */
function drawMacro(st) {
  const cv = $("stageCv");
  if (!cv || cv.parentElement.clientWidth < 40) return;
  const H = macroHeight();
  const F = fitCanvas(cv, H), g = F.g, w = F.w, h = F.h;
  g.clearRect(0, 0, w, h);

  /* ── 배치 : [온도계][비커][액면 돋보기] 를 한 덩어리로 «가운데» 놓는다.
     왼쪽에 붙여 두면 넓은 화면에서 오른쪽 절반이 비어 허전하다(P4-B4). ── */
  const pad = 14;
  const narrow = w < 540;                       // 360 px 실측에서 아래 문구가 잘렸다
  const thermoW = 46, gap1 = 16, gap2 = 18;
  const rulerW = Math.min(104, Math.max(70, w * 0.15));
  const beakerW = Math.max(96, Math.min(320, w - thermoW - rulerW - gap1 - gap2 - pad * 2));
  const groupW = thermoW + gap1 + beakerW + gap2 + rulerW;
  const gx = Math.max(pad, (w - groupW) / 2);
  const bx = gx + thermoW + gap1;
  const bTop = pad + 20, bBot = h - pad - (narrow ? 40 : 28);
  const bh = bBot - bTop;

  /* ── 가열판 ── */
  const hpY = bBot + 4, hpH = 14;
  g.fillStyle = "#e2e8f0";
  roundRect(g, bx - 16, hpY, beakerW + 32, hpH, 4); g.fill();
  g.fillStyle = S.running ? C.red : C.gray;
  roundRect(g, bx - 8, hpY + 4.5, 20, 5, 2.5); g.fill();
  g.fillStyle = C.t3; g.font = "10.5px system-ui,sans-serif"; g.textAlign = "left";
  g.fillText(S.running ? "가열 중" : "가열기", bx + 18, hpY + 11);

  /* ── 담긴 것의 높이 ── */
  const A = 1;                                   // 비커 바닥 넓이 (단위)
  const MASS = 1;
  const vTot = specVolume(st) * MASS / A;
  const vRefMax = vIce(0);                       // 가장 클 때(0 ℃ 얼음)를 기준으로 화면에 맞춘다
  const fillMax = bh * 0.80;
  const pxPerV = fillMax / vRefMax;
  const hTot = vTot * pxPerV;
  const hWater = (st.phase === "water" ? vWater(st.t)
                 : st.phase === "melt" ? st.melt * vWater(0) : 0) * pxPerV;
  const hIce = Math.max(0, hTot - hWater);

  /* ── 비커 윤곽 (내용물 «뒤»가 아니라 «앞»에 그린다 — 안 그러면 바닥선이 물에 덮인다) ── */
  const drawGlass = function () {
    g.save();
    g.strokeStyle = C.stageLine; g.lineWidth = 2.6; g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath();
    g.moveTo(bx - 5, bTop); g.lineTo(bx, bTop + 7);
    g.lineTo(bx, bBot); g.lineTo(bx + beakerW, bBot);
    g.lineTo(bx + beakerW, bTop + 7); g.lineTo(bx + beakerW + 5, bTop);
    g.stroke();
    /* 유리 하이라이트 — 흰색이 아니라 옅은 청색(§5) */
    g.strokeStyle = "rgba(160,200,228,0.75)"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(bx + 7, bTop + 22); g.lineTo(bx + 7, bBot - 14); g.stroke();
    g.restore();
  };

  /* 물 — 얼음보다 «진한» 파랑. 두 상태가 색 하나로 갈려야 한다 */
  if (hWater > 0.3) {
    g.fillStyle = "rgba(37,99,235,0.42)";
    g.fillRect(bx + 2, bBot - hWater, beakerW - 4, hWater);
    g.strokeStyle = "rgba(29,78,216,0.9)"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(bx + 2, bBot - hWater); g.lineTo(bx + beakerW - 2, bBot - hWater); g.stroke();
  }
  /* 얼음 — 거의 흰 얼음빛 + 결정면 (색 말고 «무늬»가 두 번째 채널이다) */
  if (hIce > 0.3) {
    const iy = bBot - hWater - hIce;
    g.fillStyle = "rgba(224,243,252,0.96)";
    g.fillRect(bx + 2, iy, beakerW - 4, hIce);
    g.strokeStyle = "rgba(96,150,190,0.9)"; g.lineWidth = 1.5;
    g.strokeRect(bx + 2.5, iy + 0.5, beakerW - 5, Math.max(1, hIce - 1));
    g.save();
    g.beginPath(); g.rect(bx + 2, iy, beakerW - 4, hIce); g.clip();
    g.strokeStyle = "rgba(120,175,210,0.75)"; g.lineWidth = 1.2;
    for (let q = 1; q < 6; q++) {
      const xx = bx + 2 + (beakerW - 4) * q / 6;
      g.beginPath(); g.moveTo(xx, iy - 4); g.lineTo(xx - 14, iy + hIce + 4); g.stroke();
    }
    g.restore();
    g.fillStyle = C.t1; g.font = "600 12.5px system-ui,sans-serif"; g.textAlign = "center";
    if (hIce > 16) g.fillText("얼음", bx + beakerW / 2, iy + hIce / 2 + 4);
  }
  if (hWater > 16) {
    g.fillStyle = C.t1; g.font = "600 12.5px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("물", bx + beakerW / 2, bBot - hWater / 2 + 4);
  }

  drawGlass();

  /* 전체 높이 표시선 — 라벨은 «비커 안 오른쪽 위»에 둔다(자에 가리지 않게) */
  g.strokeStyle = C.amber; g.lineWidth = 1.6; g.setLineDash([5, 4]);
  g.beginPath(); g.moveTo(bx - 7, bBot - hTot); g.lineTo(bx + beakerW + 7, bBot - hTot); g.stroke();
  g.setLineDash([]);
  g.fillStyle = C.amber; g.font = "600 11px system-ui,sans-serif"; g.textAlign = "right";
  g.fillText(narrow ? "전체 부피" : "전체 부피 = 담긴 것의 높이", bx + beakerW - 22, bBot - hTot - 7);

  /* ── 온도계 ── */
  drawThermo(g, gx, bTop, thermoW, bh + 8, st);

  /* ── 액면 돋보기 ── */
  /* 돋보기가 확대해 보이는 것은 «담긴 것의 맨 위»다 — 얼음 구간이면 얼음빛으로 채운다 */
  drawLoupe(g, bx + beakerW + gap2 + rulerW / 2, bTop, bh, rulerW / 2 - 6,
            st, pxPerV, bx + beakerW, bBot - hTot, narrow,
            hIce > 0.3 ? "rgba(224,243,252,0.96)" : "rgba(37,99,235,0.42)");

  /* 바닥 설명 — 좁은 화면에서는 두 줄로 접는다 */
  g.fillStyle = C.t3; g.font = "11px system-ui,sans-serif"; g.textAlign = "center";
  if (narrow) {
    g.fillText("얼음과 물을 위아래로 나누어 그린 도식입니다.", w / 2, h - 21);
    g.fillText("실제로 뜬 얼음은 부피의 약 92 %가 잠깁니다.", w / 2, h - 7);
  } else {
    g.fillText("얼음과 물을 위아래로 나누어 그린 도식입니다 — 실제로 뜬 얼음은 부피의 약 92 %가 잠깁니다.",
               w / 2, h - 7);
  }
}
function macroHeight() {
  const w = $("stageCv") ? $("stageCv").parentElement.clientWidth : 600;
  return Math.round(Math.max(300, Math.min(410, w * 0.60)));
}

function drawThermo(g, x, y, w, h, st) {
  const tLo = -6, tHi = 14;
  const bulbR = 9;
  const cx = x + w / 2, top = y + 6, bot = y + h - bulbR * 2 - 4;
  g.strokeStyle = C.stageLine; g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx - 5, top); g.lineTo(cx - 5, bot); g.stroke();
  g.beginPath(); g.moveTo(cx + 5, top); g.lineTo(cx + 5, bot); g.stroke();
  g.beginPath(); g.arc(cx, top, 5, Math.PI, 0); g.stroke();
  g.beginPath(); g.arc(cx, bot + bulbR, bulbR, 0, Math.PI * 2); g.stroke();
  const yOf = function (t) { return bot - (t - tLo) / (tHi - tLo) * (bot - top); };
  /* 액주 — 계측기 지시부라 관습색(빨강)을 쓴다 (§4 예외 조항) */
  const yT = yOf(st.t);
  g.fillStyle = "#c62828";
  g.beginPath(); g.arc(cx, bot + bulbR, bulbR - 2, 0, Math.PI * 2); g.fill();
  g.fillRect(cx - 3, yT, 6, bot + bulbR - yT);
  /* 눈금 */
  g.strokeStyle = C.stageLine; g.lineWidth = 1;
  g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif"; g.textAlign = "right";
  [-4, 0, 4, 10].forEach(function (t) {
    const yy = yOf(t);
    g.beginPath(); g.moveTo(cx - 12, yy); g.lineTo(cx - 6, yy); g.stroke();
    g.fillText(t + "", cx - 14, yy + 3.5);
  });
  g.fillStyle = C.t1; g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center";
  g.fillText(fmt(st.t, 1) + " ℃", cx, top - 6);
}

/* ── 액면 돋보기 ────────────────────────────────────────────────────
   0~10 ℃ 액체 구간에서 물 1 g 의 부피는 0.03 % 만 변한다 — 200 px 액면에서 0.06 px 라
   비커에서는 절대 보이지 않는다. 그래서 «액면만» 원형 돋보기로 확대해 보인다.

   ★ 읽히게 만드는 것은 배율이 아니라 «견줄 대상»이다 —
     돋보기 안에 「이 구간이 시작될 때의 액면」을 회색 파선으로 함께 두어
     둘 사이가 벌어지는 것으로 변화를 읽게 한다(2026-09-04 사용자 선택).
   ★ 배율은 상수로 박지 않고 픽셀 기하에서 «유도»한다(원칙 13).
   ★ 융해 구간은 비커에서 그대로 보이므로 돋보기를 띄우지 않는다. */
const SEG_REF = [
  function () { return vIce(WATERD.T_START); },      // −4 ℃ 얼음
  null,                                              // 융해 — 돋보기 없음
  function () { return vWater(0); },                 // 0 ℃ 물
  function () { return vWater(WATERD.T_MID); }       // 4 ℃ 물
];
const SEG_REF_NAME = ["−4 ℃일 때", "", "0 ℃일 때", "4 ℃일 때"];
function segSpan(seg) {
  if (seg === 0) return Math.abs(vIce(0) - vIce(WATERD.T_START));
  if (seg === 2) return Math.abs(vWater(0) - V_RHOMAX);
  if (seg === 3) return Math.abs(vWater(WATERD.T_END) - vWater(WATERD.T_MID));
  return 0;
}

function drawLoupe(g, cx, colTop, colH, R, st, pxPerV, ax, ay, narrow, fillCol) {
  const seg = st.seg;
  if (seg === 1 || !SEG_REF[seg]) {
    g.fillStyle = C.t2; g.font = "600 11px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("융해 구간은", cx, colTop + colH / 2 - 8);
    g.fillText("비커에서", cx, colTop + colH / 2 + 6);
    g.fillText("그대로 보입니다", cx, colTop + colH / 2 + 20);
    return;
  }
  const ref = SEG_REF[seg](), span = segSpan(seg);
  const full = span * 2.6;                       // 돋보기 세로 전체가 나타내는 부피 폭
  const v = specVolume(st);
  const cy = Math.max(colTop + R + 26, Math.min(colTop + colH - R - 24, ay));
  const yOf = function (val) { return cy - (val - ref) / full * (2 * R); };
  const mag = (2 * R / full) / pxPerV;

  /* 비커 → 돋보기 연결선 (돋보기가 「저기를 확대한 것」임을 잇는다) */
  g.strokeStyle = "rgba(120,132,148,0.75)"; g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(ax, ay - 5); g.lineTo(cx - R * 0.72, cy - R * 0.72); g.stroke();
  g.beginPath(); g.moveTo(ax, ay + 5); g.lineTo(cx - R * 0.72, cy + R * 0.72); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = C.blue; g.lineWidth = 1.6;
  g.strokeRect(ax - 12, ay - 5, 12, 10);

  /* 돋보기 알 */
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#fff"; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const wallL = cx - R * 0.62, wallR = cx + R * 0.62;
  /* 확대된 물 */
  const yNow = yOf(v);
  g.fillStyle = fillCol;
  g.fillRect(wallL, yNow, wallR - wallL, cy + R - yNow);
  /* 확대된 비커 벽 */
  g.strokeStyle = C.stageLine; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(wallL, cy - R); g.lineTo(wallL, cy + R); g.stroke();
  g.beginPath(); g.moveTo(wallR, cy - R); g.lineTo(wallR, cy + R); g.stroke();
  /* 구간 시작 액면 */
  const yRef = yOf(ref);
  g.strokeStyle = "rgba(95,107,122,0.95)"; g.lineWidth = 1.6; g.setLineDash([5, 4]);
  g.beginPath(); g.moveTo(cx - R, yRef); g.lineTo(cx + R, yRef); g.stroke();
  g.setLineDash([]);
  /* 지금 액면 (얼음 구간이면 얼음 테두리색 — 비커의 그것과 같아야 이어져 읽힌다) */
  g.strokeStyle = (st.phase === "ice") ? "rgba(70,120,160,0.95)" : C.blue;
  g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(cx - R, yNow); g.lineTo(cx + R, yNow); g.stroke();
  /* 둘 사이 화살표 */
  if (Math.abs(yNow - yRef) > 7) {
    const dir = yNow > yRef ? 1 : -1;
    g.strokeStyle = C.amber; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx, yRef); g.lineTo(cx, yNow); g.stroke();
    g.beginPath();
    g.moveTo(cx, yNow); g.lineTo(cx - 4, yNow - 5 * dir); g.lineTo(cx + 4, yNow - 5 * dir);
    g.closePath(); g.fillStyle = C.amber; g.fill();
  }
  g.restore();
  g.strokeStyle = C.gray; g.lineWidth = 2.4;   /* 돋보기 테두리 — 토큰 */
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();

  /* 라벨 */
  g.textAlign = "center";
  g.fillStyle = C.t2; g.font = "600 10.5px system-ui,sans-serif";
  g.fillText("액면 돋보기", cx, cy - R - 15);
  g.fillStyle = C.amber; g.font = "600 11px system-ui,sans-serif";
  g.fillText("×" + Math.round(mag / 10) * 10, cx, cy - R - 3);
  const pct = (v / ref - 1) * 100;
  g.fillStyle = C.t2; g.font = "600 10.5px system-ui,sans-serif";
  g.fillText((pct >= 0 ? "+" : "−") + Math.abs(pct).toFixed(3) + " %", cx, cy + R + 14);
  g.fillStyle = C.t3; g.font = "9.5px system-ui,sans-serif";
  g.fillText("회색 = " + SEG_REF_NAME[seg], cx, cy + R + 27);
  if (!narrow) g.fillText((st.phase === "ice" ? "진한 선" : "파랑") + " = 지금", cx, cy + R + 39);
}

/* ───────────────────────── 분자 화면 ───────────────────────── */
/* ── 분자 돋보기 ────────────────────────────────────────────────────
   −4→0 ℃ 와 4→10 ℃ 에서 바뀌는 것은 «분자 사이 거리»뿐이다(0.033 % · 0.014 %).
   거시 화면이 액면을 원형 돋보기로 확대해 보이는 것과 «같은 방식»으로,
   이웃 한 쌍을 확대해 그 사이가 벌어지는 것을 보인다.
     · 회색 파선 원 = 이 구간이 시작될 때의 자리
     · 채운 분자   = 지금
     · 황갈 화살표 = 그 차이
   ★ 확대하는 것은 «차이»다. 두 분자를 통째로 수천 배 그릴 수는 없다 —
     그래서 왼쪽 분자를 고정하고 오른쪽 분자의 «어긋난 양»에만 배율을 건다.
     배율은 구간 끝의 거리 변화에서 유도한다(원칙 13). 화면에 적는다. */
function drawMicroLoupe(g, cx, cy, R, st, AR, U, ax, ay, bx2, by2, below) {
  const rL = R * 0.185;
  /* 알과 테두리 */
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#fff"; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  const pr = loupePair(st.seg);
  const span = segPairSpan(st.seg);
  let mag = 0, pct = 0, ok = false;
  if (pr && Math.abs(span) > 1e-12) {
    ok = true;
    const dRef = pairDist(segStartArrangement(st.seg).pos, pr);
    const dNow = pairDist(AR.pos, pr);
    const full = Math.abs(span) * 1.35;                 // 돋보기가 담는 거리 변화 폭
    const arm = R * 0.50;                               // 그 폭에 주는 화면 길이
    const shift = (dNow - dRef) / full * arm;
    mag = (arm / full) / U;
    pct = (dNow / dRef - 1) * 100;

    const yC = cy + R * 0.05;
    const axm = cx - R * 0.40, bxRef = cx + R * 0.40, bxNow = bxRef + shift;
    /* 수소 결합 점선 */
    g.strokeStyle = "rgba(80,120,160,0.75)"; g.lineWidth = 2; g.setLineDash([4, 3.5]);
    g.beginPath(); g.moveTo(axm, yC); g.lineTo(bxNow, yC); g.stroke();
    g.setLineDash([]);
    /* 구간 시작 자리 (회색 파선 원) */
    g.strokeStyle = "rgba(95,107,122,0.95)"; g.lineWidth = 1.8; g.setLineDash([4, 3]);
    g.beginPath(); g.arc(bxRef, yC, rL, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    /* 두 분자 (공-막대 · 왼쪽은 고정) */
    const mole = function (mx) {
      const half = WATERD.HOH_DEG / 2 * Math.PI / 180, L = rL * 0.85, rHh = rL * 0.60;
      for (let k = 0; k < 2; k++) {
        const a = -Math.PI / 2 + (k ? half : -half);
        const hx = mx + Math.cos(a) * L, hy = yC + Math.sin(a) * L;
        g.strokeStyle = "rgba(90,100,112,0.85)"; g.lineWidth = Math.max(1.4, rL * 0.22);
        g.beginPath(); g.moveTo(mx, yC); g.lineTo(hx, hy); g.stroke();
        g.fillStyle = CPK_H; g.strokeStyle = H_STROKE; g.lineWidth = 1.1;
        g.beginPath(); g.arc(hx, hy, rHh, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.fillStyle = CPK_O; g.strokeStyle = O_STROKE; g.lineWidth = 1.4;
      g.beginPath(); g.arc(mx, yC, rL, 0, Math.PI * 2); g.fill(); g.stroke();
    };
    mole(axm); mole(bxNow);
    /* 벌어진 양 — 황갈 화살표 */
    if (Math.abs(shift) > 6) {
      const dir = shift > 0 ? 1 : -1, ya = yC + rL + 13;
      g.strokeStyle = C.amber; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bxRef, ya); g.lineTo(bxNow, ya); g.stroke();
      g.beginPath();
      g.moveTo(bxNow, ya); g.lineTo(bxNow - 6 * dir, ya - 4); g.lineTo(bxNow - 6 * dir, ya + 4);
      g.closePath(); g.fillStyle = C.amber; g.fill();
      g.strokeStyle = "rgba(95,107,122,0.6)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(bxRef, yC + rL + 2); g.lineTo(bxRef, ya + 5); g.stroke();
    }
    /* 「분자 사이 거리」 치수선 */
    const yd = yC - rL - 12;
    g.strokeStyle = C.t3; g.lineWidth = 1;
    g.beginPath(); g.moveTo(axm, yd + 4); g.lineTo(axm, yd - 4); g.stroke();
    g.beginPath(); g.moveTo(bxNow, yd + 4); g.lineTo(bxNow, yd - 4); g.stroke();
    g.beginPath(); g.moveTo(axm, yd); g.lineTo(bxNow, yd); g.stroke();
    /* 라벨은 알 «가운데»에 맞춘다 — 치수선 가운데에 맞추면 알 밖으로 나가 잘린다(360 px 실측) */
    g.fillStyle = C.t3; g.font = "9.5px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("분자 사이 거리", cx, yd - 7);
  } else {
    g.fillStyle = C.t2; g.font = "600 11.5px system-ui,sans-serif"; g.textAlign = "center";
    const msg = st.seg === 1
      ? ["융해 구간은", "육각 고리가 무너지는 것이", "화면에 그대로 보입니다"]
      : ["성긴 배열이 풀리는 것이", "화면에 그대로 보입니다"];
    msg.forEach(function (line, q) {
      g.fillText(line, cx, cy - (msg.length - 1) * 8 + q * 16);
    });
  }
  g.restore();
  g.strokeStyle = C.gray; g.lineWidth = 2.6;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();

  /* 무대 → 돋보기 연결선. 아래에 놓인 배치에서는 «위쪽 호»로 받아야 알을 가로지르지 않는다 */
  if (ok && ax !== null) {
    g.strokeStyle = "rgba(120,132,148,0.75)"; g.lineWidth = 1; g.setLineDash([3, 3]);
    const t1 = below ? [cx - R * 0.70, cy - R * 0.71] : [cx - R * 0.72, cy - R * 0.72];
    const t2 = below ? [cx + R * 0.70, cy - R * 0.71] : [cx - R * 0.72, cy + R * 0.72];
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(t1[0], t1[1]); g.stroke();
    g.beginPath(); g.moveTo(bx2, by2); g.lineTo(t2[0], t2[1]); g.stroke();
    g.setLineDash([]);
  }

  /* 라벨 — 상자 «아래»에 놓인 배치(좁은 화면)에서는 연결선이 위에서 내려오므로
     제목을 위가 아니라 알의 «왼쪽»에 둔다. 위에 두면 연결선이 글자를 가로지른다(실측). */
  g.textAlign = below ? "right" : "center";
  const tx = below ? cx - R - 9 : cx;
  g.fillStyle = C.t2; g.font = "600 11px system-ui,sans-serif";
  g.fillText("분자 돋보기", tx, below ? cy - 3 : cy - R - 16);
  if (ok) {
    g.fillStyle = C.amber; g.font = "600 11.5px system-ui,sans-serif";
    g.fillText("×" + (Math.round(mag / 100) * 100).toLocaleString("en-US"),
               tx, below ? cy + 13 : cy - R - 3);
    g.textAlign = "center";
    g.fillStyle = C.t1; g.font = "600 12px system-ui,sans-serif";
    g.fillText((pct >= 0 ? "+" : "−") + Math.abs(pct).toFixed(3) + " %", cx, cy + R + 15);
    g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif";
    g.fillText("회색 = " + SEG_REF_NAME[st.seg] + " · 지금 = 채운 분자", cx, cy + R + 29);
    g.fillText("두 분자의 «어긋난 양»만 확대했습니다", cx, cy + R + 42);
  } else {
    g.textAlign = "center";
    g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif";
    g.fillText("이 구간은 확대가 필요 없습니다", cx, cy + R + 15);
  }
}

/* 좁은 화면에서는 돋보기를 상자 «아래»에 두므로 캔버스가 그만큼 높아야 한다 */
function microHeight() {
  const w = $("stageCv") ? $("stageCv").parentElement.clientWidth : 600;
  return macroHeight() + (w >= 560 ? 0 : 2 * microLoupeR(w) + 66);
}

function drawMicro(st, time) {
  const cv = $("stageCv");
  if (!cv || cv.parentElement.clientWidth < 40) return;
  const H = microHeight();
  const F = fitCanvas(cv, H), g = F.g, w = F.w, h = F.h;
  g.clearRect(0, 0, w, h);

  const AR = arrangementCached(st, S.s);
  /* 위쪽 26 px 은 상자 라벨 자리, 아래는 참조 눈금 + 범례 자리다.
     좁게 두면 가장자리 분자가 잘리고 글자끼리 겹친다(360 px 실측으로 잡았다).
     좁은 화면에서는 범례를 두 줄로 접고 그만큼 아래 여백을 늘린다. */
  const narrow = w < 540;
  const LEG = narrow
    ? ["점선 = 수소 결합 · 짧은 H = 화면 앞뒤 방향", "노란 면 = 고리 안쪽 빈 공간"]
    : ["점선 = 수소 결합 · 짧은 H = 화면 앞뒤 방향(네 번째 결합) · 노란 면 = 고리 안쪽 빈 공간"];
  /* 고스트를 그리는 구간이면 설명이 «한 줄 더» 필요하다 — 아래 여백을 그만큼 늘린다.
     융해 구간(seg 1)은 이동이 커서(최대 447 px) 고스트를 겹치면 지저분하기만 하다. */
  const useGhost = (st.seg !== 1 && st.u > 1e-4);
  if (useGhost) LEG.push("");                       // 자리만 잡아 두고 배율을 안 뒤에 채운다
  const padL = 14, padR = 14, padT = 26, padB = 44 + LEG.length * 15;
  /* ★ 돋보기 자리는 «구간과 무관하게» 늘 비워 둔다. 구간마다 자리를 뺐다 넣었다 하면
     배율 U 가 달라져 「상자가 줄어드는 것」을 견줄 수 없게 된다. */
  const wideLoupe = w >= 560;
  const lpR = microLoupeR(w);
  const lpW = wideLoupe ? 2 * lpR + 30 : 0;
  const lpH = wideLoupe ? 0 : 2 * lpR + 66;
  const availW = w - padL - padR - lpW, availH = h - padT - padB - lpH;
  /* 기준 배율 — 얼음(가장 큰 상자)이 꼭 들어가게. 상태마다 배율을 바꾸면
     상자가 줄어드는 것이 안 보인다. */
  const U = Math.min(availW / WATERD.BOX_W, availH / WATERD.BOX_H);
  const boxW = AR.W * U, boxH = AR.H * U;
  const ox = padL + (availW - boxW) / 2, oy = padT + (availH - boxH) / 2;
  const X = function (v) { return ox + v * U; };
  const Y = function (v) { return oy + boxH - v * U; };

  /* 상자 — 「같은 개수의 분자가 차지하는 넓이」 */
  g.strokeStyle = C.amber; g.lineWidth = 1.6; g.setLineDash([6, 4]);
  g.strokeRect(ox, oy, boxW, boxH);
  g.setLineDash([]);
  g.fillStyle = C.amber; g.font = "600 10.5px system-ui,sans-serif"; g.textAlign = "left";
  const boxLbl = narrow ? "분자 " + NMOL + "개의 넓이"
                        : "같은 분자 " + NMOL + "개가 차지하는 넓이 (= 1 g의 부피)";
  g.fillText(boxLbl, ox, oy - 8);
  const boxLblW = g.measureText(boxLbl).width;

  /* 흔들림 — 기본은 꺼져 있다(사용자 지시: 배열 변화에 집중) */
  /* ── 영하 구간의 팽창을 «보이게» 한다 ────────────────────────────────
     −4 → 0 ℃ 에서 얼음은 부피가 0.066 % 늘고 밀도가 0.066 % 떨어진다. 길이로는 0.033 %,
     화면에서는 0.1 px 라 그냥 그리면 «아무 일도 안 일어나는 것»으로 보인다.
     그래서 진짜 그림은 그대로 두고, «−4 ℃ 일 때의 자리»를 회색 고스트로 겹쳐 그리되
     그 «차이만» 배율을 걸어 벌린다. 배율은 상수로 박지 않고 화면 기하에서 유도한다(원칙 13) —
     0 ℃ 에서 가장 많이 밀려난 분자의 간격이 GHOST_PX 가 되도록 잡는다.
     ★ 고스트는 «주석»이고 분자 자체는 참값이다. 배율을 화면에 적는다. */
  /* 고스트 = 「이 구간이 시작될 때의 자리」. 배율은 구간 끝의 최대 이동에서 «유도»한다 —
     이미 크게 움직이는 구간(0→4 ℃)에서는 1배가 되어 참값 그대로 그려진다. */
  const GHOST_PX = 11;
  let ghostMag = 1, ghostRef = null;
  if (useGhost) {
    const maxPx = segMaxDisp(st.seg) * U;
    ghostMag = maxPx > 1e-9 ? Math.max(1, GHOST_PX / maxPx) : 1;
    ghostRef = segStartArrangement(st.seg).pos;
    /* ⚠ 시작 배열의 좌표는 이미 «그때의 상자 배율»이 들어간 절대 좌표다.
       여기에 배율 비를 한 번 더 곱하면 지금 좌표와 정확히 같아져 고스트가 사라진다
       (실제로 4→10 ℃ 에서 그렇게 터졌다 — 2026-09-04). 그대로 쓴다. */
  }

  /* 흔들림 진폭은 온도에 따라 커진다 — 교과서 50쪽 「분자 운동이 활발해지면서
     분자 사이의 거리가 멀어져 부피가 증가한다」가 고체 구간에서 실제로 일어나는 일이다.
     기본은 꺼져 있다(사용자 지시: 배열 변화에 집중). */
  const amp = (S.motion && !RM)
    ? (st.phase === "ice"
        ? 0.020 + 0.030 * (st.t - WATERD.T_START) / 4        // −4 ℃ 0.020 → 0 ℃ 0.050
        : 0.055 + 0.030 * (st.t / WATERD.T_END))             // 0 ℃ 0.055 → 10 ℃ 0.085
    : 0;
  const jit = function (i, k) {
    if (!amp) return 0;
    return Math.sin(time * (1.1 + (i % 7) * 0.13) + i * 2.4 + k * 1.7) * amp;
  };

  /* 수소 결합 — 얼음에서만 격자 결합을 그린다. 액체는 가까운 쌍을 잇는다. */
  g.lineWidth = 1.7;
  if (st.phase !== "water") {
    LAT.bonds.forEach(function (b) {
      const e = Math.max(AR.phase[b[0]], AR.phase[b[1]]);
      if (e > 0.55) return;
      const a = 0.92 * (1 - e / 0.55);
      g.strokeStyle = "rgba(56,100,145," + a.toFixed(3) + ")";
      g.setLineDash([3.2, 2.6]);
      g.beginPath();
      g.moveTo(X(AR.pos[b[0]].x + jit(b[0], 0)), Y(AR.pos[b[0]].y + jit(b[0], 1)));
      g.lineTo(X(AR.pos[b[1]].x + jit(b[1], 0)), Y(AR.pos[b[1]].y + jit(b[1], 1)));
      g.stroke();
    });
    g.setLineDash([]);
  }
  if (st.phase !== "ice") {
    const lim = 1.22, lim2 = lim * lim;
    g.setLineDash([3.2, 2.6]);
    for (let i = 0; i < NMOL; i++) {
      if (AR.phase[i] < 0.75) continue;
      for (let j = i + 1; j < NMOL; j++) {
        if (AR.phase[j] < 0.75) continue;
        const dx = AR.pos[i].x - AR.pos[j].x, dy = AR.pos[i].y - AR.pos[j].y;
        if (dx * dx + dy * dy > lim2) continue;
        g.strokeStyle = "rgba(56,100,145,0.55)";
        g.beginPath();
        g.moveTo(X(AR.pos[i].x + jit(i, 0)), Y(AR.pos[i].y + jit(i, 1)));
        g.lineTo(X(AR.pos[j].x + jit(j, 0)), Y(AR.pos[j].y + jit(j, 1)));
        g.stroke();
      }
    }
    g.setLineDash([]);
  }

  /* 빈 공간 — 얼음의 육각 고리 «안쪽»을 칠한다. 이것이 이 화면의 주인공이다. */
  if (st.phase !== "water") {
    RINGS.forEach(function (r) {
      let e = 0;
      r.sites.forEach(function (i) { e = Math.max(e, AR.phase[i]); });
      if (e > 0.35) return;
      const a = 0.55 * (1 - e / 0.35);
      /* ★ 육각형을 «그대로» 칠하면 고리가 평면을 덮으므로 화면 전체가 노래진다 —
         빈 공간이 강조되지 않는다. 무게중심 쪽으로 0.55 배 줄여 「구멍」으로 보이게 한다. */
      let cx = 0, cy = 0;
      r.sites.forEach(function (i) { cx += AR.pos[i].x; cy += AR.pos[i].y; });
      cx /= 6; cy /= 6;
      g.fillStyle = "rgba(250,204,21," + a.toFixed(3) + ")";
      g.beginPath();
      r.sites.forEach(function (i, q) {
        const p = AR.pos[i];
        const px = X(cx + (p.x - cx) * 0.55), py = Y(cy + (p.y - cy) * 0.55);
        if (q === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.closePath(); g.fill();
    });
  }
  /* 성긴 국소 배열 — 액체 쪽. 「얼음 조각」이 아니다. */
  if (st.phase === "water" || (st.phase === "melt" && st.melt > 0.5)) {
    const kk = Math.round(AR.rings);
    for (let k = 0; k < kk; k++) {
      const ids = [];
      for (let i = 0; i < NMOL; i++) if (WATER.ringOf[MATCH[i]] === k) ids.push(i);
      if (ids.length !== 6) continue;
      let cx = 0, cy = 0;
      ids.forEach(function (i) { cx += AR.pos[i].x; cy += AR.pos[i].y; });
      cx /= 6; cy /= 6;
      g.fillStyle = "rgba(250,204,21,0.30)";
      g.strokeStyle = "rgba(180,83,9,0.70)"; g.lineWidth = 1.4;
      g.setLineDash([4, 3]);
      g.beginPath(); g.arc(X(cx), Y(cy), 1.12 * U, 0, Math.PI * 2); g.fill(); g.stroke();
      g.setLineDash([]);
    }
    if (kk > 0) {
      g.fillStyle = C.amber; g.font = "600 10.5px system-ui,sans-serif"; g.textAlign = "right";
      /* 왼쪽 라벨과 겹치지 않는 가장 긴 문구를 고른다 (360 px 에서 실제로 겹쳤다) */
      const cands = ["성긴 국소 배열 " + kk + "곳 — 얼음 조각이 아닙니다",
                     "성긴 국소 배열 " + kk + "곳", "성긴 배열 " + kk + "곳"];
      let lbl = cands[cands.length - 1];
      for (let q = 0; q < cands.length; q++)
        if (boxLblW + g.measureText(cands[q]).width + 16 <= boxW) { lbl = cands[q]; break; }
      g.fillText(lbl, ox + boxW, oy - 8);
    }
  }

  /* 「구간 시작」 고스트 — 상자 외곽선과 분자 자리 */
  const rO = WATERD.R_O * U, rH = WATERD.R_H * U, lOH = WATERD.OH_LEN * U;
  if (ghostRef) {
    /* 상자 «가운데»를 맞춰 겹친다 — 원점 기준으로 겹치면 팽창이 한쪽으로 쏠려 보인다 */
    const R0 = segStartArrangement(st.seg);
    const bcx = ox + boxW / 2, bcy = oy + boxH / 2;
    const gp = function (i) {                       // 고스트 화면 좌표 (차이에만 배율)
      const px = X(AR.pos[i].x), py = Y(AR.pos[i].y);
      const rx = bcx + (ghostRef[i].x - R0.W / 2) * U;
      const ry = bcy - (ghostRef[i].y - R0.H / 2) * U;
      return [px + (rx - px) * ghostMag, py + (ry - py) * ghostMag, px, py];
    };
    const bw0 = R0.W * U, bh0 = R0.H * U;
    const gw2 = boxW + (bw0 - boxW) * ghostMag, gh2 = boxH + (bh0 - boxH) * ghostMag;
    if (Math.abs(gw2 - boxW) > 1.5 || Math.abs(gh2 - boxH) > 1.5) {
      g.strokeStyle = "rgba(120,132,148,0.6)"; g.lineWidth = 1.3; g.setLineDash([3, 3]);
      g.strokeRect(ox + (boxW - gw2) / 2, oy + (boxH - gh2) / 2, gw2, gh2);
      g.setLineDash([]);
    }
    g.lineWidth = 1;
    for (let i = 0; i < NMOL; i++) {
      const q = gp(i);
      if ((q[0] - q[2]) * (q[0] - q[2]) + (q[1] - q[3]) * (q[1] - q[3]) < 2.2) continue;
      g.strokeStyle = "rgba(120,132,148,0.55)"; g.setLineDash([2.5, 2.5]);
      g.beginPath(); g.arc(q[0], q[1], rO, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = "rgba(120,132,148,0.45)";
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke();
    }
  }

  /* 분자 */
  const half = WATERD.HOH_DEG / 2 * Math.PI / 180;
  const rnd = mulberry32(WATERD.SEED + 3);
  const waterTh = [];
  for (let i = 0; i < NMOL; i++) waterTh.push(rnd() * Math.PI * 2);
  for (let i = 0; i < NMOL; i++) {
    const p = AR.pos[i];
    const px = X(p.x + jit(i, 0)), py = Y(p.y + jit(i, 1));
    const e = AR.phase[i];
    const thIce = -MOL[i].th;                       // 캔버스 y 가 뒤집혀 있다
    let d = waterTh[i] - thIce;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const th = thIce + d * e;
    const shortH = MOL[i].inPlane < 2 && e < 0.5;    // 앞뒤 방향 H 는 짧게
    for (let k = 0; k < 2; k++) {
      const a = th + (k ? half : -half);
      const L = (shortH && k === 1) ? lOH * 0.58 : lOH;
      const hx = px + Math.cos(a) * L, hy = py + Math.sin(a) * L;
      g.strokeStyle = "rgba(90,100,112,0.85)"; g.lineWidth = Math.max(1.2, rO * 0.24);
      g.beginPath(); g.moveTo(px, py); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = CPK_H; g.strokeStyle = H_STROKE; g.lineWidth = 1;
      g.globalAlpha = (shortH && k === 1) ? 0.6 : 0.85;
      g.beginPath(); g.arc(hx, hy, rH, 0, Math.PI * 2); g.fill(); g.stroke();
      g.globalAlpha = 1;
    }
    g.fillStyle = CPK_O; g.strokeStyle = O_STROKE; g.lineWidth = 1.1;
    g.globalAlpha = 0.92;
    g.beginPath(); g.arc(px, py, rO, 0, Math.PI * 2); g.fill(); g.stroke();
    g.globalAlpha = 1;
  }

  /* 분자 지름은 변하지 않는다 — 참조 눈금 (★★★ 오개념 「분자가 커진다」 차단).
     두 줄로 나눠 놓는다: 위 = 참조 눈금, 아래 = 범례. 한 줄에 몰면 글자가 겹친다(실측). */
  const refY = h - 20 - LEG.length * 14, refX = padL;
  g.fillStyle = CPK_O; g.strokeStyle = O_STROKE; g.lineWidth = 1.1;
  g.beginPath(); g.arc(refX + rO, refY, rO, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = C.t3; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(refX, refY + rO + 3); g.lineTo(refX, refY + rO + 7);
  g.lineTo(refX + rO * 2, refY + rO + 7); g.lineTo(refX + rO * 2, refY + rO + 3);
  g.stroke();
  g.fillStyle = C.t2; g.font = "600 10.5px system-ui,sans-serif"; g.textAlign = "left";
  g.fillText(narrow ? "분자 지름 — 변하지 않습니다" : "분자 지름 — 어느 온도에서도 변하지 않습니다",
             refX + rO * 2 + 9, refY + 4);
  g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif";
  if (useGhost) {
    const dv = (specVolume(st) / specVolume(stateAt(progressAt(st.seg, 0))) - 1) * 100;
    LEG[LEG.length - 1] = "회색 = " + SEG_REF_NAME[st.seg] + "의 자리" +
      (ghostMag > 1.05 ? " (차이를 ×" + Math.round(ghostMag) + "배로 그림)" : "") +
      " — 부피 " + (dv >= 0 ? "+" : "−") + Math.abs(dv).toFixed(3) + " %" +
      (narrow ? ""
              : st.seg === 2 ? " · 성긴 배열이 풀리며 자리를 옮깁니다"
                             : " · 배열은 그대로, 사이가 «고르게» 넓어집니다");
  }
  LEG.forEach(function (line, q) {
    g.fillText(line, padL, h - 9 - (LEG.length - 1 - q) * 14);
  });

  /* ── 분자 돋보기 ── 확대해 보는 쌍을 무대에서 먼저 표시하고, 그 다음 알을 그린다 */
  const pr = loupePair(st.seg);
  let lax = null, lay = 0, lbx = 0, lby = 0;
  if (pr && loupeSeg(st.seg) && Math.abs(segPairSpan(st.seg)) > 1e-12) {
    const p1 = AR.pos[pr.i], p2 = AR.pos[pr.j];
    const mx = X((p1.x + p2.x) / 2), my = Y((p1.y + p2.y) / 2);
    const rr = Math.max(rO * 2.2, U * 0.85);
    g.strokeStyle = C.amber; g.lineWidth = 2;
    g.beginPath(); g.arc(mx, my, rr, 0, Math.PI * 2); g.stroke();
    if (wideLoupe) { lax = mx + rr * 0.7; lay = my - rr * 0.7;
                     lbx = mx + rr * 0.7; lby = my + rr * 0.7; }
    else           { lax = mx - rr * 0.7; lay = my + rr * 0.7;
                     lbx = mx + rr * 0.7; lby = my + rr * 0.7; }
  }
  const lpCx = wideLoupe ? (w - padR - lpW / 2) : (ox + boxW / 2);
  const lpCy = wideLoupe ? (padT + availH / 2) : (h - padB - lpH + lpR + 20);
  drawMicroLoupe(g, lpCx, lpCy, lpR, st, AR, U, lax, lay, lbx, lby, !wideLoupe);
}

/* ───────────────────────── 그래프 ─────────────────────────
   세로 축을 끊어 두 띠로 그린다 — 교과서 그림 Ⅱ-5 와 같은 방식이다.
   두 띠의 세로 배율이 다르다는 것을 물결 표시와 글자로 함께 알린다. */
const DATA = {
  vol: {
    label: "물 1 g의 부피", unit: "cm³",
    of: function (st) { return specVolume(st); },
    ice: function (t) { return vIce(t); },
    water: function (t) { return vWater(t); },
    dp: 4
  },
  rho: {
    label: "밀도", unit: "g/cm³",
    of: function (st) { return density(st); },
    ice: function (t) { return rhoIce(t); },
    water: function (t) { return rhoWater(t); },
    dp: 4
  },
  hb: {
    label: "분자 1개당 수소 결합 수 (모형 값)", unit: "개",
    of: function (st) { return hbondPerMolecule(st); },
    ice: function () { return 4.00; },
    water: function (t) { return 3.60 + (3.52 - 3.60) * (t / WATERD.T_END); },
    dp: 2
  }
};

function drawGraph(st) {
  const cv = $("graphCv");
  if (!cv || cv.parentElement.clientWidth < 40) return;
  const w0 = cv.parentElement.clientWidth;
  const H = Math.round(Math.max(280, Math.min(340, w0 * 0.30 + 210)));
  const F = fitCanvas(cv, H), g = F.g, w = F.w, h = F.h;
  g.clearRect(0, 0, w, h);

  const D = DATA[S.data];
  const L = 76, R = 16, T = 26, B = 40;
  const gw = w - L - R, gh = h - T - B;
  const xOf = function (t) { return L + (t - WATERD.T_START) / (WATERD.T_END - WATERD.T_START) * gw; };

  /* ★ 축을 끊을지 말지는 데이터가 정한다.
       부피·밀도 : 얼음 가지와 물 가지의 «자릿수»가 달라(0.09 vs 0.0003) 끊지 않으면
                   물 가지가 선 굵기 안에 눌린다. 교과서 그림 Ⅱ-5 도 같은 이유로 끊었다.
       수소 결합 수 : 4.00 과 3.5x 는 한 축에 들어간다. 여기서 축을 끊으면 「개수 차가 크지
                   않다」는 이 화면의 논지를 «축이 뒤집는다» — 그래서 끊지 않는다. */
  const broken = (S.data !== "hb");
  const gap = 16;
  const bandH = broken ? (gh - gap) / 2 : gh;
  const topY = T, botY = broken ? T + bandH + gap : T;

  let iceLo, iceHi, watLo, watHi;
  if (!broken) {
    iceLo = watLo = 3.20; iceHi = watHi = 4.20;
  } else {
    const iA = D.ice(WATERD.T_START), iB = D.ice(0);
    const wVals = [];
    for (let t = 0; t <= WATERD.T_END + 1e-9; t += 0.25) wVals.push(D.water(t));
    const wMin = Math.min.apply(null, wVals), wMax = Math.max.apply(null, wVals);
    const iMin = Math.min(iA, iB), iMax = Math.max(iA, iB);
    const iPad = (iMax - iMin) * 0.22 || 1e-4, wPad = (wMax - wMin) * 0.30 || 1e-5;
    iceLo = iMin - iPad; iceHi = iMax + iPad;
    watLo = wMin - wPad; watHi = wMax + wPad;
  }
  /* 부피는 얼음이 위, 밀도는 얼음이 아래 — 값의 크기가 정한다 */
  const iceOnTop = (S.data !== "rho");
  const iceTop = iceOnTop ? topY : botY, watTop = iceOnTop ? botY : topY;
  const yIce = function (v) { return iceTop + bandH - (v - iceLo) / (iceHi - iceLo) * bandH; };
  const yWat = function (v) { return watTop + bandH - (v - watLo) / (watHi - watLo) * bandH; };

  /* 구간 배경 띠 — 학습지 표의 네 행 */
  const segs = [
    { a: WATERD.T_START, b: 0, name: "−4 → 0 ℃  고체" },
    { a: 0, b: 0, name: "0 ℃  융해" },
    { a: 0, b: WATERD.T_MID, name: "0 → 4 ℃  액체" },
    { a: WATERD.T_MID, b: WATERD.T_END, name: "4 → 10 ℃  액체" }
  ];
  segs.forEach(function (sg, i) {
    if (i === 1) return;
    const x1 = xOf(sg.a), x2 = xOf(sg.b);
    g.fillStyle = (i === st.seg) ? "rgba(37,99,235,0.075)" : "rgba(148,163,184,0.055)";
    g.fillRect(x1, T, x2 - x1, gh);
  });
  if (st.seg === 1) {
    g.fillStyle = "rgba(37,99,235,0.10)";
    g.fillRect(xOf(0) - 9, T, 18, gh);
  }

  /* 격자·축 */
  g.strokeStyle = "rgba(40,45,52,0.10)"; g.lineWidth = 1;
  for (let t = -4; t <= 10; t += 2) {
    g.beginPath(); g.moveTo(xOf(t), T); g.lineTo(xOf(t), T + gh); g.stroke();
  }
  g.strokeStyle = C.line; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + gh); g.lineTo(L + gw, T + gh); g.stroke();

  /* 축 끊김 물결 */
  const brY = T + bandH + gap / 2;
  if (broken) {
    g.strokeStyle = C.t3; g.lineWidth = 1.4;
    for (let q = 0; q < 2; q++) {
      g.beginPath();
      for (let x = L - 6; x <= L + gw; x += 4) {
        const yy = brY + (q ? 4 : -4) + Math.sin(x * 0.35) * 2.4;
        if (x === L - 6) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.fillStyle = "#fff"; g.fillRect(L - 6, brY - 1.6, gw + 6, 3.2);
    g.fillStyle = C.t3; g.font = "9.5px system-ui,sans-serif"; g.textAlign = "right";
    g.fillText("축 끊김 — 위·아래 배율이 다릅니다", L + gw - 8, brY - 8);
  }

  /* 눈금 값 */
  g.fillStyle = C.t2; g.font = "10.5px system-ui,sans-serif"; g.textAlign = "right";
  const ticks = broken
    ? [[iceLo, yIce(iceLo)], [iceHi, yIce(iceHi)], [watLo, yWat(watLo)], [watHi, yWat(watHi)]]
    : [[3.2, yWat(3.2)], [3.6, yWat(3.6)], [4.0, yWat(4.0)], [4.2, yWat(4.2)]];
  ticks.forEach(function (p) { g.fillText(fmt(p[0], D.dp), L - 7, p[1] + 3.5); });
  g.textAlign = "center"; g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif";
  for (let t = -4; t <= 10; t += 2) g.fillText(t + "", xOf(t), T + gh + 14);
  g.fillText("온도 (℃)", L + gw / 2, T + gh + 30);
  g.save();
  g.translate(13, T + gh / 2); g.rotate(-Math.PI / 2);
  g.fillStyle = C.t2; g.font = "600 11px system-ui,sans-serif"; g.textAlign = "center";
  g.fillText(D.label + " (" + D.unit + ")", 0, 0);
  g.restore();

  /* 곡선 — 진행한 데까지만 그린다 */
  const prog = st;
  const drawn = { ice: prog.seg >= 0, melt: prog.seg >= 1, water: prog.seg >= 2 };
  g.lineWidth = 2.6; g.lineJoin = "round"; g.lineCap = "round";

  /* 얼음 가지 */
  g.strokeStyle = C.cyan;
  g.beginPath();
  const tIceEnd = prog.seg === 0 ? prog.t : 0;
  for (let t = WATERD.T_START; t <= tIceEnd + 1e-9; t += 0.1) {
    const yy = yIce(D.ice(t));
    if (t === WATERD.T_START) g.moveTo(xOf(t), yy); else g.lineTo(xOf(t), yy);
  }
  g.stroke();
  if (S.data === "hb" && prog.seg === 0) { /* 얼음 4.00 은 수평선이다 */ }

  /* 융해 — 세로 이동 */
  if (drawn.melt) {
    const yA = yIce(D.ice(0));
    const yB = yWat(D.water(0));
    const f = prog.seg === 1 ? prog.melt : 1;
    g.strokeStyle = C.red; g.setLineDash([7, 5]); g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(xOf(0), yA);
    g.lineTo(xOf(0), yA + (yB - yA) * f);
    g.stroke();
    g.setLineDash([]);
    if (f > 0.15) {
      g.fillStyle = C.red; g.font = "600 11px system-ui,sans-serif"; g.textAlign = "left";
      const jump = S.data === "hb" ? "개수가 줄어든다" :
        (S.data === "vol" ? "급격히 감소 −8.3 %" : "급격히 증가 +9.1 %");
      g.fillText(jump, xOf(0) + 7, yA + (yB - yA) * f * 0.5);
    }
  }

  /* 액체 가지 */
  if (drawn.water) {
    const tEnd = prog.seg >= 2 ? prog.t : 0;
    g.strokeStyle = C.blue; g.lineWidth = 2.6;
    if (S.data === "hb") {
      /* 불확실 띠를 함께 그린다 — 정밀도 과장 방지 (P5 M7) */
      g.fillStyle = "rgba(29,78,216,0.14)";
      g.beginPath();
      for (let t = 0; t <= tEnd + 1e-9; t += 0.1) g.lineTo(xOf(t), yWat(D.water(t) + HBOND_BAND));
      for (let t = tEnd; t >= -1e-9; t -= 0.1) g.lineTo(xOf(t), yWat(D.water(t) - HBOND_BAND));
      g.closePath(); g.fill();
    }
    g.beginPath();
    for (let t = 0; t <= tEnd + 1e-9; t += 0.1) {
      const yy = yWat(D.water(t));
      if (t === 0) g.moveTo(xOf(t), yy); else g.lineTo(xOf(t), yy);
    }
    g.stroke();
    /* 밀도가 가장 큰 온도 */
    if (tEnd >= T_RHOMAX - 1e-9 && S.data !== "hb") {
      const xm = xOf(T_RHOMAX), ym = yWat(D.water(T_RHOMAX));
      g.strokeStyle = C.violet; g.lineWidth = 1.4; g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(xm, ym);
      g.lineTo(xm, S.data === "vol" ? watTop + 4 : watTop + bandH - 4);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = C.violet;
      g.beginPath();
      g.moveTo(xm, ym - 5); g.lineTo(xm + 5, ym); g.lineTo(xm, ym + 5); g.lineTo(xm - 5, ym);
      g.closePath(); g.fill();
      g.font = "600 10.5px system-ui,sans-serif"; g.textAlign = "center";
      g.fillText(S.data === "vol" ? "부피 최소 3.98 ℃" : "밀도 최대 3.98 ℃",
                 xm, S.data === "vol" ? ym - 11 : ym + 16);
    }
  }

  /* 교과서 값 대조 */
  if (S.showBook && S.data !== "hb") {
    /* 회색을 쓴다 — 황갈(--d-amber)과 빨강(--d-red)은 청색약 ΔE 2.9 로 한 화면에 두지 않는다(§4) */
    g.setLineDash([2, 3]); g.lineWidth = 1.3; g.strokeStyle = C.gray;
    const bookIce = S.data === "vol" ? WATERD.BOOK_V_ICE0 : WATERD.BOOK_RHO_ICE0;
    const yi = yIce(bookIce);
    g.beginPath(); g.moveTo(L, yi); g.lineTo(L + gw, yi); g.stroke();
    g.setLineDash([]);
    g.fillStyle = C.gray; g.font = "600 10px system-ui,sans-serif"; g.textAlign = "right";
    g.fillText("교과서 " + fmt(bookIce, 4) + " — 이 모형과 같습니다", L + gw - 5, yi - 5);
    if (S.data === "vol") {
      g.fillStyle = C.gray; g.textAlign = "right";
      g.fillText("교과서·학습지의 1.0020 은 이 확대 띠 «밖»입니다 (실측 1.0002)",
                 L + gw - 5, watTop + bandH - 6);
    }
  }

  /* 지금 위치 */
  const v = D.of(st);
  const yNow = st.phase === "ice" ? yIce(v)
             : st.phase === "melt" ? yIce(D.ice(0)) + (yWat(D.water(0)) - yIce(D.ice(0))) * st.melt
             : yWat(v);
  g.fillStyle = C.t1;
  g.beginPath(); g.arc(xOf(st.t), yNow, 5.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 2;
  g.beginPath(); g.arc(xOf(st.t), yNow, 5.2, 0, Math.PI * 2); g.stroke();

  /* 띠 설명 */
  g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif"; g.textAlign = "left";
  if (broken) {
    g.fillText(iceOnTop ? "위 = 얼음" : "위 = 물", L + 4, T + 12);
    g.fillText(iceOnTop ? "아래 = 물" : "아래 = 얼음", L + 4, botY + 12);
  } else {
    g.fillText("축을 끊지 않았습니다 — 얼음 4.00 과 물 약 3.6 의 차이를 있는 그대로 봅니다.",
               L + 4, T + 12);
  }
}

/* ───────────────────────── 값 표시 ───────────────────────── */
function fmt(v, d) {
  const s = v.toFixed(d);
  return s === "-0" || /^-0\.0*$/.test(s) ? s.slice(1) : s;
}
const SEGNAME = ["−4 → 0 ℃  고체", "0 ℃  고체 → 액체", "0 → 4 ℃  액체", "4 → 10 ℃  액체"];
const SEGVOL = ["증가", "급격히 감소", "감소", "증가"];
const SEGRHO = ["감소", "급격히 증가", "증가", "감소"];
const PHASE = { ice: "고체 (얼음)", melt: "고체 → 액체 (융해 중)", water: "액체 (물)" };

function update() {
  const st = stateAt(S.s);
  const v = specVolume(st), r = density(st);

  $("vT").textContent = fmt(st.t, 1);
  $("vPhase").textContent = st.phase === "melt"
    ? "융해 중 " + Math.round(st.melt * 100) + " %" : PHASE[st.phase];
  $("vVol").textContent = fmt(v, 4);
  $("vRho").textContent = fmt(r, 4);
  $("vHb").textContent = fmt(hbondPerMolecule(st), 2);
  $("vQ").textContent = fmt(heatGiven(st), 0);
  $("vOpen").textContent = st.phase === "water" ? openClusterCount(st) + "" : (st.phase === "ice" ? "—" : "—");

  $("segName").textContent = SEGNAME[st.seg];
  $("segVol").textContent = SEGVOL[st.seg];
  $("segRho").textContent = SEGRHO[st.seg];
  $("sVal").textContent = SEGNAME[st.seg];

  /* 구간 칩 — 지금 구간을 눌린 상태로 두고, 재생 중이면 그 구간 안의 진행을 칩에 채운다 */
  const chips = document.querySelectorAll(".seg");
  for (let i = 0; i < chips.length; i++) {
    const on = (+chips[i].dataset.seg === st.seg);
    chips[i].setAttribute("aria-pressed", on ? "true" : "false");
    const playing = on && S.running;
    chips[i].classList.toggle("is-playing", playing);
    chips[i].style.setProperty("--fill", playing ? (st.u * 100).toFixed(1) + "%" : "0%");
  }

  /* 두 경쟁 효과 */
  const box = $("splitBox");
  if (st.phase === "water") {
    box.style.display = "block";
    const sp = volumeSplit(st.t);
    const scale = 4.6e-4;
    const wS = Math.min(100, Math.abs(sp.struct) / scale * 100);
    const wT = Math.min(100, Math.abs(sp.therm) / scale * 100);
    $("barStruct").style.width = wS.toFixed(1) + "%";
    $("barTherm").style.width = wT.toFixed(1) + "%";
    const net = sp.obs;
    $("splitNet").textContent = (net < 0 ? "구조 붕괴가 이긴다 → 부피 감소" : "열팽창이 이긴다 → 부피 증가");
    $("splitNet").className = "splitnet " + (net < 0 ? "is-down" : "is-up");
    $("splitVal").textContent = (net >= 0 ? "+" : "−") + Math.abs(net * 1e5).toFixed(1) + " ×10⁻⁵ cm³/(g·K)";
  } else {
    box.style.display = "none";
  }

  /* 슬라이더·버튼 */
  const sl = $("prog");
  if (Math.abs(+sl.value / 1000 - S.s) > 1e-6) sl.value = Math.round(S.s * 1000);
  $("playBtn").textContent = S.running ? "❚❚ 멈춤" : (S.s >= 1 - 1e-9 ? "▶ 처음부터 가열" : "▶ 이어서 가열");
  $("playBtn").setAttribute("aria-pressed", S.running ? "true" : "false");
  $("againBtn").textContent = "⟲ 이 구간 다시 (" + WATERD.SEG_SEC + "초)";
  $("viewBtn").textContent = S.view === "macro" ? "분자 배열로 보기" : "비커로 돌아가기";
  $("viewBtn").setAttribute("aria-pressed", S.view === "micro" ? "true" : "false");

  /* 무대 아래 안내 — 구간마다 「지금 어디를 보아야 하는가」가 다르다.
     0.03 % 밖에 안 변하는 구간에서 「분자를 보라」고 하면 학생이 헛본다. */
  const hint = (S.view === "macro" ? MACRO_HINT : MICRO_HINT)[st.seg];
  $("stageCap").textContent =
    (S.running ? "▶ 재생 중 (" + (st.u * WATERD.SEG_SEC).toFixed(1) + " / " + WATERD.SEG_SEC + "초) — " : "") +
    hint + (S.done && !S.running ? "  ✓ 이 구간이 끝났습니다 — 배율을 바꿔 한 번 더 보세요." : "");

  const mo = $("motionRow");
  mo.style.display = S.view === "micro" ? "flex" : "none";
  /* 배열이 바뀌지 않는 두 구간에서는 이 체크박스가 「유일하게 움직이는 것」이라 강조한다 */
  mo.classList.toggle("is-key", S.view === "micro" && (st.seg === 0 || st.seg === 3));
  $("motionWhy").style.display = (S.view === "micro" && (st.seg === 0 || st.seg === 3)) ? "inline" : "none";
  $("openRow").style.display = (S.view === "micro" && st.phase === "water") ? "flex" : "none";

  draw();
}

let rafId = null, lastT = 0;
function draw() {
  const st = stateAt(S.s);
  const time = performance.now() / 1000;
  if (S.view === "macro") drawMacro(st); else drawMicro(st, time);
  drawGraph(st);
}
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  const dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;
  if (S.running) {
    S.s += dt * S_PER_SEC;
    const end = playEnd();
    if (S.s >= end - 1e-9) { S.s = end; S.running = false; S.done = true; }
    update();
  } else if (S.motion && !RM && S.view === "micro") {
    draw();
  }
}

/* ───────────────────────── 이벤트 ───────────────────────── */
function bind() {
  $("prog").addEventListener("input", function () {
    S.s = +this.value / 1000; S.running = false; S.playSeg = null; S.done = false; update();
  });
  $("playBtn").addEventListener("click", function () {
    if (S.running) { S.running = false; }
    else playFrom(null);
    update();
  });
  /* ⟲ 이 구간 다시 — 지금 있는 구간을 «처음부터» 7.5 초에 걸쳐 재생한다.
     같은 구간을 거시로 한 번, 분자로 한 번 보게 하려는 버튼이다. */
  $("againBtn").addEventListener("click", function () {
    playFrom(stateAt(S.s).seg); update();
  });
  $("resetBtn").addEventListener("click", function () {
    S.s = 0; S.running = false; S.playSeg = null; S.done = false; update();
  });
  $("viewBtn").addEventListener("click", function () {
    S.view = S.view === "macro" ? "micro" : "macro"; update();   // 재생 중이면 그대로 이어진다
  });
  /* 구간 칩 = 그 구간의 «재생» 버튼이다 (예전처럼 건너뛰기만 하지 않는다) */
  const chips = document.querySelectorAll(".seg");
  for (let i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      playFrom(+this.dataset.seg); update();
    });
  }
  const dbtn = document.querySelectorAll(".datab");
  for (let i = 0; i < dbtn.length; i++) {
    dbtn[i].addEventListener("click", function () {
      S.data = this.dataset.data;
      for (let q = 0; q < dbtn.length; q++)
        dbtn[q].setAttribute("aria-pressed", dbtn[q] === this ? "true" : "false");
      $("dataNote").textContent = DATANOTE[S.data];
      update();
    });
  }
  $("motionChk").addEventListener("change", function () { S.motion = this.checked; update(); });
  $("bookChk").addEventListener("change", function () { S.showBook = this.checked; update(); });

  window.addEventListener("resize", update);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(function () { update(); });
    ro.observe($("stageCv").parentElement);
    ro.observe($("graphCv").parentElement);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
    else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
  });
}

/* 구간별 관찰 안내 — 학습지 표의 네 행 순서 그대로.
   ★ 「보이지 않는 것」을 보라고 하지 않는다. 0~4·4~10 ℃ 의 부피 변화는 0.03 % 라
     비커에서는 보이지 않으므로 액면 돋보기·그래프·막대로 안내한다. */
const MACRO_HINT = [
  "얼음이 아주 조금 팽창합니다(0.07 %). 비커에서는 보이지 않으니 온도계와 오른쪽 «액면 돋보기»를 보세요 — 회색 파선이 −4 ℃일 때의 액면입니다.",
  "얼음이 녹으면서 물이 차오르고 «전체 높이»가 내려갑니다 — 이 구간만 눈으로 바로 보입니다(−8.3 %).",
  "물이 더 «촘촘»해집니다. 변화가 0.01 %라 «액면 돋보기» 안에서만 회색 파선 아래로 내려가는 것이 보입니다.",
  "이제 열팽창이 이겨 다시 늘어납니다. «액면 돋보기»의 화살표가 방향을 바꿔 위를 가리킵니다."
];
const MICRO_HINT = [
  "★ 이 구간에서는 «배열이 바뀌지 않습니다» — 같은 육각 격자가 0.03 %만 넓어집니다(화면에서 0.2 px). " +
    "그래서 <분자 돋보기>가 이웃 한 쌍을 골라 «사이가 벌어지는 것»을 확대해 보입니다 — " +
    "거시 화면의 액면 돋보기와 같은 방식입니다. 실제로 활발해지는 것은 분자의 «흔들림»이니 " +
    "아래 체크박스도 켜 보세요.",
  "육각 고리가 아래부터 «무너지고», 고리 안쪽 빈 공간이 다른 물 분자로 채워집니다. 네 구간 중 배열이 가장 크게 바뀝니다.",
  "남아 있던 «성긴 국소 배열»이 하나씩 풀립니다. 회색 고스트가 0 ℃일 때의 자리입니다 — 표의 「성긴 국소 배열」 수를 함께 세어 보세요.",
  "★ 이 구간에서도 «배열은 바뀌지 않습니다» — 무질서한 채로 0.01 %만 넓어집니다(화면에서 0.1 px). " +
    "<분자 돋보기>에서 이웃 한 쌍의 사이가 벌어지는 것을 보세요. 여기서 이기는 것은 열팽창이니 " +
    "오른쪽 «겨루는 두 가지» 막대와 흔들림 체크박스도 함께 보세요."
];

const DATANOTE = {
  vol: "학습지 표의 「물 1 g의 부피 변화」 열입니다. 세로 축이 끊겨 있습니다 — 위 띠와 아래 띠의 배율이 다릅니다.",
  rho: "학습지 표의 「밀도 변화」 열입니다. 밀도는 부피의 역수라 위아래가 뒤집힙니다.",
  hb: "★ 수소 결합 «개수»는 온도가 오르면 계속 줄어듭니다(단조). 그런데 부피는 줄었다가 늘어납니다. " +
      "단조로운 양은 단조롭지 않은 양을 설명할 수 없습니다 — 개수는 원인이 아닙니다."
};

/* ───────────────────────── 시작 ───────────────────────── */
function init() {
  $("dataNote").textContent = DATANOTE.vol;
  $("bookGap").textContent = fmt(vWater(0), 4);
  bind();
  update();
  rafId = requestAnimationFrame(loop);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
