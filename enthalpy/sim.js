"use strict";
/* ================================================================
   엔탈피와 열화학 반응식 — 계산부 (화면과 무관 · 검증스크립트/enthalpy_core.js 와 문자 단위로 같다)
   설계지시안_엔탈피_v1.2 §3 단계 1 (P-검토 A-3~A-6·B-6 · S-검토 R1 A-1·A-2 · 사용자 결정 21~24 반영).

   ① 온도: 학습지 3-1-01-1 활동 1 표의 세 값(처음 · 나중 · 측정 시간)만 원자료다.
      그 사이 곡선 모양(지수형 접근 τ)은 «가정»이다(지시안 §1-2 추정 1 · 가정과 한계 ①).
   ② 열의 방향은 «온도 차» 하나로만 정한다 — 팩 종류(발열/흡열)로 정하지 않는다(지시안 §5-2).
      손에 쥐면 주변 = 손 33 ℃(사용자 확정), 아니면 주변 = 공기 20 ℃.
      불변식(S-검토 R1 A-1·A-2): 냉각 팩은 «열이 흐르면 온도가 변하고, 온도가 변하면 열이 흐른다».
      측정이 끝난 냉각 팩은 손에 쥐기 전까지 나중 온도에서 «정지 상태»로 멈춘다 — 온도·시계·열 화살표 모두(사용자 결정 26 · 결정 22 번복).
      쥔 뒤에는 손 쪽으로 다가가며, 온도 차가 0.5 ℃ 아래가 되면 «열평형»으로 시계를 멈춘다(결정 23). 손난로는 반응이 열을 계속 내어 45 ℃를 유지한다(가정 — 한계 ⑩).
   ③ 막대 값은 원자료 상수에서 계산한다(화면·문서·검사가 이 값 하나를 본다 — B-6 · F-1).
      손난로: JANAF Fe(g) 415.471 · 교과서 표 Ⅲ-2 O=O 498 · JANAF Fe₂O₃ −825.503
      냉각 팩: 교과서 76쪽 ΔH +26.2 · 끊기(격자 엔탈피)는 Born–Haber 경로 1차 자료 5값(P-검토 A-4):
        NH₃(g) −45.94(CODATA · NIST 직독) · NH₃ 양성자 친화도 853.6(Hunter & Lias) · HNO₃(g) −134.31(JANAF)
        · HNO₃ 기상 산도 1357.7(NIST) · NH₄NO₃(s) −365.56(NBS — 2차 표 −365.6 일치). H⁺ 생성 엔탈피는 소거된다.
        만들기(수화) = 끊기 − ΔH — 개별 이온 수화 값은 쓰지 않는다.
      ⚠ 손난로·냉각 팩의 막대는 교과서의 «결합 에너지»(기체 공유 결합만)가 아니다 — 그 이름을 쓰지 않는다.
   ④ 입자 배치는 렌더와 검증이 함께 쓰는 단일 원천이다(CLAUDE.md 원칙 11).
      금속·이온 결정은 «막대 없이 맞닿은 공 + 얇은 이웃선»으로 그린다(사용자 결정 10-24 · mineral l3RockSalt 규약).
      막대는 공유 결합(O=O)만. 결정 조각에는 «잘라 낸 일부» 표지(흐린 이웃 입자)를 붙인다(A-5) — 세기에서 뺀다.
      이웃선은 이웃 «전부»를 잇는다 — 일부만 이으면 분자로 읽힌다(시안 2 놓침).
   ================================================================ */

var ENTH = {
  PACK: {
    hw: { name: "손난로", sub: "철 가루", T0: 20, T1: 45, tm: 10, tau: 3, start: "흔들기" },
    cp: { name: "냉각 팩", sub: "질산 암모늄", T0: 20, T1: 2, tm: 2, tau: 0.6, start: "내부 주머니 터뜨리기" }
  },
  HAND: 33,            /* 손 피부 온도 ℃ — 사용자 확정(2026-10-24) */
  AIR: 20,             /* 공기 온도 ℃ — 학습지 처음 온도와 같다 */
  FLOW_MIN: 0.5,       /* 이 온도 차(℃) 미만이면 «열이 흐르지 않음»으로 그린다 */
  FLOW_BIG: 8,         /* 이 온도 차 이상이면 화살표·점 2단 */
  SEC_PER_MIN: 1,      /* 시간 압축: 화면 1초 = 1분(추정 5) */
  SRC: { FeG: 415.471, OO: 498, Fe2O3: -825.503, dHcp: 26.2,
         NH3g: -45.94, paNH3: 853.6, HNO3g: -134.31, acidHNO3: 1357.7, NH4NO3s: -365.56 },
  HOLD_TAU: 20,        /* 쥔 뒤 냉각 팩이 손 온도로 다가가는 시간 상수(분) — 가정(추정 9) */
  DEW: 10,             /* 이 온도(℃) 아래면 겉에 물방울 · 0 ℃ 아래면 성에(B-1 · 추정 10) */
  TICKS: [0, 0.5, 0.75, 1],
  SNAP: 0.04,
  THERM: [8, 16, 26, 38] /* 열화상 5구간 경계 ℃(추정 7) */
};

/* ── ① 온도 ── */
function packT(k, tMin) {
  var p = ENTH.PACK[k], t = Math.min(Math.max(tMin, 0), p.tm);
  return p.T0 + (p.T1 - p.T0) * (1 - Math.exp(-t / p.tau)) / (1 - Math.exp(-p.tm / p.tau));
}
function measureDone(k, tMin) { return tMin >= ENTH.PACK[k].tm; }
/* 주변 온도 Ts 쪽으로 다가가기(뉴턴 냉각 꼴 — 시간 상수 HOLD_TAU) */
function relaxT(T0, Ts, dt) { return Ts + (T0 - Ts) * Math.exp(-Math.max(dt, 0) / ENTH.HOLD_TAU); }
/* 반응이 계속 열을 내는 팩(손난로)인가 — 그 팩은 측정 끝 뒤에도 나중 온도를 유지한다(가정) */
function selfHeated(k) { return ENTH.PACK[k].T1 > ENTH.PACK[k].T0; }
/* 팩 온도(단일 원천) — t: 그 팩의 시계(분) · holdAt: 손에 쥔 순간의 그 팩 시계(쥐지 않았으면 null) · tHold: 쥔 뒤 시간(분)
   측정 중 packT → 측정 끝 뒤 나중 온도에서 정지(쥐기 전까지) → 쥔 뒤 손 쪽(냉각 팩). 손난로는 측정 끝 뒤 45 ℃ 유지 */
function tempAt(k, t, holdAt, tHold) {
  var p = ENTH.PACK[k], held = holdAt !== null && holdAt !== undefined;
  var tA = held ? holdAt : t;
  var T = packT(k, tA);   /* 측정 끝 뒤는 packT 가 나중 온도에 머문다 */
  return held && !selfHeated(k) ? relaxT(T, ENTH.HAND, tHold) : T;
}
/* 정지 상태(사용자 결정 26): 측정이 끝난 냉각 팩은 손에 쥐기 전까지 온도·시계·열 화살표가 멈춘다 */
function packPaused(k, t, held) { return !held && !selfHeated(k) && measureDone(k, t); }
/* 열평형에 닿았는가(시계를 멈출 때) — 냉각 팩만 · 측정 끝 뒤 */
function atEquilibrium(k, T, Ts) { return !selfHeated(k) && Math.abs(T - Ts) < ENTH.FLOW_MIN; }
/* 그 팩의 시계가 더 갈 수 있는가: 측정 중일 때만(측정 끝 뒤 손난로는 45 ℃ 유지 · 냉각 팩은 정지 상태) */
function packClockRuns(k, t) { return t < ENTH.PACK[k].tm; }
/* 쥔 뒤 시계가 더 갈 수 있는가: 쥔 냉각 팩이 아직 손과 평형이 아님 */
function holdClockRuns(holdAtCp, tHold) { return !atEquilibrium("cp", tempAt("cp", 0, holdAtCp, tHold), ENTH.HAND); }
function surfaceCue(T) { return T < 0 ? "frost" : (T < ENTH.DEW ? "dew" : "none"); }
function canHold(tHw, tCp) { return measureDone("hw", tHw) && measureDone("cp", tCp); }   /* P4 A */

/* ── ② 열의 방향: +1 팩 → 주변 · −1 주변 → 팩 · 0 흐르지 않음 ── */
function surroundT(held) { return held ? ENTH.HAND : ENTH.AIR; }
function flowDir(Tp, Ts) { var d = Tp - Ts; return Math.abs(d) < ENTH.FLOW_MIN ? 0 : (d > 0 ? 1 : -1); }
function flowLevel(Tp, Ts) { var d = Math.abs(Tp - Ts); return d < ENTH.FLOW_MIN ? 0 : (d < ENTH.FLOW_BIG ? 1 : 2); }
/* 화면에 그리는 열의 방향 — 정지 상태면 0(화살표·점 없음) */
function shownFlowDir(k, Tp, held, paused) { return paused ? 0 : flowDir(Tp, surroundT(held)); }
function flowLabel(k, Tp, held, paused) {
  if (paused) return "정지 상태";
  var dir = flowDir(Tp, surroundT(held)), who = held ? "손" : "공기";
  if (dir === 0) return Math.abs(Tp - surroundT(held)) < 0.05 ? "온도가 같음 → 열이 흐르지 않음" : "온도가 거의 같음 → 열이 거의 흐르지 않음";   /* 표시(0.1 ℃)로 같을 때만 «같음»(S-검토 R2 A-3) */
  return dir > 0 ? "열: " + ENTH.PACK[k].name + " → " + who : "열: " + who + " → " + ENTH.PACK[k].name;
}
function thermBucket(T) { var b = 0; while (b < ENTH.THERM.length && T >= ENTH.THERM[b]) b++; return b; }

/* ── ③ 막대(kJ) — 칸별. 기준 = 반응식대로 반응할 때(손난로: 철 4 mol · 냉각 팩: 1 mol) ── */
function latticeCP() {   /* Born–Haber: [NH₄⁺(g)] + [NO₃⁻(g)] − [NH₄NO₃(s)] — H⁺ 항은 서로 소거 */
  var S = ENTH.SRC;
  return (S.NH3g - S.paNH3) + (S.HNO3g + S.acidHNO3) - S.NH4NO3s;
}
function barsOf(k) {
  var S = ENTH.SRC, brk, frm, dH;
  if (k === "hw") {
    dH = 2 * S.Fe2O3;
    /* 칸 이름에 결합 «개수»가 드러나게(B-4): 철은 원자 떼어 놓기(원자화) · O=O 는 결합 3개 */
    brk = [{ kind: "FeFe", name: "철 원자 4개 떼어 놓기(금속 결합)", kj: 4 * S.FeG }, { kind: "OO", name: "O=O 결합 3개", kj: 3 * S.OO }];
    var sumB = brk[0].kj + brk[1].kj;
    frm = [{ kind: "FeO", name: "산화 철(Ⅲ) 2 mol의 Fe–O", kj: sumB - dH }];   /* 양 표기(S-검토 R1 B-10) */
    return { eq: "4Fe(s) + 3O₂(g) → 2Fe₂O₃(s)", eqIon: "", basis: "철 4 mol 기준", brk: brk, frm: frm, dH: dH, approx: false };
  }
  dH = S.dHcp;
  var L = latticeCP();
  return { eq: "NH₄NO₃(s) → NH₄NO₃(aq)", eqIon: "(aq) = NH₄⁺ 과 NO₃⁻ 이 물 분자에 둘러싸여 흩어진 상태", basis: "1 mol 기준",
           brk: [{ kind: "ion", name: "이온 사이 결합(이온 결정)", kj: L }],
           frm: [{ kind: "hyd", name: "이온–물 인력(수화)", kj: L - dH }], dH: dH, approx: true };
}
/* 계단 도표의 준위 — 수직 화살표로만 잇는다(교과서 그림 Ⅲ-6 꼴 · 비스듬한 연결선 금지 — A-6) */
function stepLevels(k) {
  var B = barsOf(k), up = sumKj(B.brk);
  var names = k === "hw" ? ["4Fe(s) + 3O₂(g)", "4Fe(g) + 6O(g)", "2Fe₂O₃(s)"] : ["NH₄NO₃(s)", "NH₄⁺(g) + NO₃⁻(g)", "NH₄⁺(aq) + NO₃⁻(aq)"];
  return [{ role: "R", label: names[0], H: 0 }, { role: "A", label: names[1], H: up, virtual: true }, { role: "P", label: names[2], H: B.dH }];
}
function sumKj(list) { var s = 0; for (var i = 0; i < list.length; i++) s += list[i].kj; return s; }
function kjText(v, approx) { return (approx ? "약 " : "") + Math.round(v); }

/* ── 진행도 p ∈ [0,1]: 0~0.5 끊기 · 0.5~1 만들기 (끊기가 끝나야 만들기가 시작 — bondheat 잠금) ── */
function progress(p) {
  p = Math.min(Math.max(p, 0), 1);
  var b = Math.min(p / 0.5, 1), f = Math.max(0, (p - 0.5) / 0.5), st;
  if (p <= 0) st = "반응 전";
  else if (p < 0.5) st = "반응물의 결합이 끊어지는 중 — 에너지가 들어옴";
  else if (p < 0.52) st = "결합이 다 끊어진 상태(가상)";
  else if (p < 1) st = "생성물의 결합이 생기는 중 — 에너지가 나감";
  else st = "반응 후";
  return { p: p, brk: b, frm: f, stage: st };
}
function snapP(p) {
  for (var i = 0; i < ENTH.TICKS.length; i++) if (Math.abs(p - ENTH.TICKS[i]) < ENTH.SNAP) return ENTH.TICKS[i];
  return Math.min(Math.max(p, 0), 1);
}
/* 탭 ② 자동 반응(사용자 결정 24·25): 정지점 = 결합이 다 끊어진 순간(0.5) · 새 결합이 다 생긴 순간(1).
   정지점마다 「계속 진행하기」를 눌러야 넘어가고, 마지막 「계속」 뒤에 ΔH 와 교과서 그림 Ⅲ-2 꼴을 공개한다 */
var PLAY = { stops: [0.5, 1], rate: 0.125 };   /* rate = 진행도/초 — 한 구간(0.5) 4초 */
function playStep(p, dt, phase) {   /* phase: "run1" | "run2" → {p, phase} — 정지점을 넘지 않는다 */
  var goal = phase === "run1" ? PLAY.stops[0] : PLAY.stops[1], np = Math.min(goal, p + PLAY.rate * Math.max(dt, 0));
  return { p: np, phase: np >= goal ? (phase === "run1" ? "stop1" : "stop2") : phase };
}
/* 계단 도표의 엔탈피(반응물 = 0 기준, kJ) */
function stepH(k, p) {
  var B = barsOf(k), g = progress(p);
  return sumKj(B.brk) * g.brk - sumKj(B.frm) * g.frm;
}

/* ── ④ 입자 배치(장면 단위 — 1 ≈ 원자 지름) ── */
var RAD = { Fe: 0.55, O: 0.42, NH4: 0.55, NO3: 0.6, H2O: 0.3 };
function lerp3(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
function dist3(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }
function bondsByDist(pts, lim, test) {           /* mineral l3BondsByDist 의 단순판 — 거리 기준 이웃 전부 */
  var out = [];
  for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++)
    if ((!test || test(i, j)) && dist3(pts[i], pts[j]) < lim) out.push([i, j]);
  return out;
}
function layoutHW() {
  /* 반응물: 철 4(금속 조각, 이웃 모두 금속 결합) + O₂ 3분자 · 생성물: Fe 4 · O 6 의 산화 철(Ⅲ) 이온 결정 조각 */
  /* 배정은 경로가 서로를 뚫지 않게 전수 탐색으로 고른 것(최소 간격 여유 1.38 — 검사 D-9) · A = 생성물 자리를 넓힌 «다 끊어진» 자리 */
  var fe = [
    { R: [-2.6, -0.7, 0], A: [2.205, -2.352, 1.8], P: [1.05, -0.7, 0] },
    { R: [-1.2, -0.7, 0], A: [3.675, 2.352, 1.8], P: [1.75, 0.7, 0] },
    { R: [-2.6, 0.7, 0], A: [-3.675, -2.352, 1.8], P: [-1.75, -0.7, 0] },
    { R: [-1.2, 0.7, 0], A: [-2.205, 2.352, 1.8], P: [-1.05, 0.7, 0] }
  ];
  var ox = [
    { R: [1.0, 1.6, 0], A: [-5.145, 2.352, -1.8], P: [-2.45, 0.7, 0] },
    { R: [2.1, 1.6, 0], A: [6.615, 2.352, -1.8], P: [3.15, 0.7, 0] },
    { R: [1.0, 0, 0], A: [0.735, 2.352, -1.8], P: [0.35, 0.7, 0] },
    { R: [2.1, 0, 0], A: [5.145, -2.352, -1.8], P: [2.45, -0.7, 0] },
    { R: [1.0, -1.6, 0], A: [-6.615, -2.352, -1.8], P: [-3.15, -0.7, 0] },
    { R: [2.1, -1.6, 0], A: [-0.735, -2.352, -1.8], P: [-0.35, -0.7, 0] }
  ];
  var atoms = [], i;
  for (i = 0; i < fe.length; i++) atoms.push({ el: "Fe", R: fe[i].R, A: fe[i].A, P: fe[i].P });
  for (i = 0; i < ox.length; i++) atoms.push({ el: "O", R: ox[i].R, A: ox[i].A, P: ox[i].P });
  var isFe = function (n) { return atoms[n].el === "Fe"; };
  var Rp = atoms.map(function (a) { return a.R; }), Pp = atoms.map(function (a) { return a.P; });
  /* 금속 결합 Fe–Fe(1.4) 와 O=O(1.1)는 거리 한계를 따로 — 한 한계로 이으면 이웃 O₂ 분자끼리 이어진다(검사 D-3) */
  var bR = bondsByDist(Rp, 1.5, function (a, b) { return isFe(a) && isFe(b); }).map(function (q) { return [q[0], q[1], "FeFe"]; })
    .concat(bondsByDist(Rp, 1.2, function (a, b) { return !isFe(a) && !isFe(b); }).map(function (q) { return [q[0], q[1], "OO"]; }));
  var bP = bondsByDist(Pp, 1.6, function (a, b) { return isFe(a) !== isFe(b); }).map(function (q) { return [q[0], q[1], "FeO"]; });
  return { atoms: atoms, bondsR: bR, bondsP: bP };
}
function layoutCP() {
  /* 반응물: NH₄NO₃ 이온 결정 3×2×2(이웃 모두 이온 사이 결합) · 생성물: 흩어진 이온 + 이온마다 물 4(수화) */
  var atoms = [], i, j, k, n;
  for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) for (k = 0; k < 2; k++) {
    var pos = (i + j + k) % 2 === 0;
    var R = [(i - 1) * 1.3, (j - 0.5) * 1.3, (k - 0.5) * 1.3], A = [(i - 1) * 3.8, (j - 0.5) * 5.0, (k - 0.5) * 5.0];   /* 흩어진 자리 — 물 자리가 결정과 겹치지 않을 만큼(검사 D-10) */
    atoms.push({ el: pos ? "NH4" : "NO3", R: R, A: A, P: A });
  }
  var nIon = atoms.length;
  /* 물 4개 = 정사면체. 한 꼭짓점을 «결정 중심 반대쪽(바깥)»으로 돌린다 — 그러면 나머지 셋은 이온이 결정에서
     걸어 나오는 길(안쪽)과 70.5°로 비켜나, 끊기 구간에 이온이 물을 뚫고 지나가지 않는다(검사 D-10) */
  function tetraOut(c) {
    var L = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]), u = [c[0] / L, c[1] / L, c[2] / L];
    var t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    var v = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]], vl = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    v = [v[0] / vl, v[1] / vl, v[2] / vl];
    var w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], out = [u], r = 2 * Math.SQRT2 / 3;
    for (var q = 0; q < 3; q++) { var th = q * 2 * Math.PI / 3, cs = Math.cos(th) * r, sn = Math.sin(th) * r;
      out.push([-u[0] / 3 + cs * v[0] + sn * w[0], -u[1] / 3 + cs * v[1] + sn * w[1], -u[2] / 3 + cs * v[2] + sn * w[2]]); }
    return out;
  }
  for (n = 0; n < nIon; n++) {
    var c = atoms[n].A, D = tetraOut(c);
    for (j = 0; j < 4; j++) {
      var P = [c[0] + D[j][0] * 0.95, c[1] + D[j][1] * 0.95, c[2] + D[j][2] * 0.95];
      /* 처음 자리: 수화 자리를 1.6 배 넓힌 바깥 «물» — 만들기 구간에서 안쪽으로만 다가간다 */
      var R0 = [c[0] + D[j][0] * 1.6, c[1] + D[j][1] * 1.6, c[2] + D[j][2] * 1.6];
      atoms.push({ el: "H2O", R: R0, A: R0, P: P, host: n });
    }
  }
  var ionPts = atoms.slice(0, nIon).map(function (a) { return a.R; });
  var bR = bondsByDist(ionPts, 1.4, function (a, b) { return atoms[a].el !== atoms[b].el; }).map(function (q) { return [q[0], q[1], "ion"]; });
  var bP = [];
  for (n = nIon; n < atoms.length; n++) bP.push([atoms[n].host, n, "hyd"]);
  return { atoms: atoms, bondsR: bR, bondsP: bP, nIon: nIon };
}
function layoutOf(k) { return k === "hw" ? layoutHW() : layoutCP(); }
/* 막대(결합봉)로 그리는 것은 공유 결합뿐 — 나머지는 맞닿은 공 + 얇은 이웃선 */
var ROD = { OO: true };
/* «잘라 낸 일부» 표지: 결정 조각 바깥으로 이어지는 흐린 이웃 입자(세기에서 뺀다 · A-5).
   R = 반응물 결정(손난로 철 · 냉각 팩 NH₄NO₃) · P = 생성물 결정(산화 철). 수용액(냉각 팩 생성물)은 결정이 아니므로 없음 */
/* 손난로 반응물 표지 = «주변 물질»(사용자 결정 27): 철 격자와 산소 분자를 화면 가장자리까지 흐리게 채운다.
   반응식 계수(안쪽 철 4 · O₂ 3)는 그대로 — 표지는 세지 않는다. 범위 = 세로 360 px 화면의 가장자리까지 덮는 크기.
   산소는 기체 — 격자로 줄 세우면 «고체 산소»로 읽히므로 자리·방향을 고정 시드로 흩뜨린다 */
var FIELD = { xMax: 13, yMax: 15, seed: 20261024, oMin: 1.35, feMin: 1.25, back: -1.4 };   /* back: 뒤층 z — 한 장이면 회전할 때 판이 비스듬히 «벽»으로 보이고 화면 한쪽이 빈다(S-검토 R2 B-6) */   /* oMin: 다른 분자의 O 끼리 — 1.2 아래면 이웃 분자가 O=O 로 이어져 보인다(검사 D-16) */
var fieldCache = null;
function fieldHW() {
  if (fieldCache) return fieldCache;
  var inner = layoutHW().atoms, R = [], c, r, i, j, zs = [0, FIELD.back], zi;
  for (zi = 0; zi < zs.length; zi++) for (c = 0; -1.2 - 1.4 * c >= -FIELD.xMax; c++) for (r = -11; r <= 11; r++) {   /* 철 격자(안쪽 철 4개와 같은 간격 1.4 · 앞층·뒤층) */
    var x = -1.2 - 1.4 * c, y = -0.7 + 1.4 * r, z = zs[zi];
    if (Math.abs(y) > FIELD.yMax) continue;
    var taken = false; for (i = 0; i < inner.length; i++) if (inner[i].el === "Fe" && dist3(inner[i].R, [x, y, z]) < 0.01) taken = true;
    if (!taken) R.push({ el: "Fe", pos: [x, y, z], link: -1 });
  }
  var s = FIELD.seed, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  var Os = inner.filter(function (a) { return a.el === "O"; }).map(function (a) { return a.R; });
  var Fes = inner.filter(function (a) { return a.el === "Fe"; }).map(function (a) { return a.R; }).concat(R.map(function (g) { return g.pos; }));
  var clear = function (p) {
    for (var q = 0; q < Os.length; q++) if (dist3(p, Os[q]) < FIELD.oMin) return false;
    for (q = 0; q < Fes.length; q++) if (dist3(p, Fes[q]) < FIELD.feMin) return false;
    return Math.abs(p[1]) <= FIELD.yMax && p[0] <= FIELD.xMax + 1.6;
  };
  var pairsO = [];
  for (zi = 0; zi < zs.length; zi++) for (c = 0; 1.55 + 2.4 * c <= FIELD.xMax + 1.2; c++) for (r = -9; r <= 9; r++) {   /* 산소 분자(O=O 1.1 · 앞층·뒤층) */
    var cx = 1.55 + 2.4 * c + (rnd() - 0.5) * 0.7, cy = 1.6 * r + (rnd() - 0.5) * 0.6, th = rnd() * Math.PI;
    var a = [cx - 0.55 * Math.cos(th), cy - 0.55 * Math.sin(th), zs[zi]], b = [cx + 0.55 * Math.cos(th), cy + 0.55 * Math.sin(th), zs[zi]];
    if (!clear(a) || !clear(b)) continue;
    pairsO.push(R.length); R.push({ el: "O", pos: a, link: -1 }, { el: "O", pos: b, link: -1 }); Os.push(a, b);
  }
  /* 이웃선: 표지끼리 + 표지–안쪽 철(안쪽 원자 n 은 −1−n 으로 적는다). O=O 는 같은 분자 짝만 */
  var bonds = [], nG = R.length;
  for (i = 0; i < nG; i++) {
    for (j = i + 1; j < nG; j++) {
      if (R[i].el === "Fe" && R[j].el === "Fe" && dist3(R[i].pos, R[j].pos) < 1.5) bonds.push([i, j, "FeFe"]);
    }
    if (R[i].el === "Fe") for (j = 0; j < inner.length; j++) if (inner[j].el === "Fe" && dist3(R[i].pos, inner[j].R) < 1.5) { bonds.push([i, -1 - j, "FeFe"]); if (R[i].link < 0) R[i].link = j; }
  }
  pairsO.forEach(function (q) { bonds.push([q, q + 1, "OO"]); });   /* O=O 는 같은 분자 짝만(거리로 잇지 않는다) */
  fieldCache = { R: R, bonds: bonds };
  return fieldCache;
}
function ghostsOf(k) {
  var R = [], P = [], j, i;
  if (k === "hw") {
    var F = fieldHW(); R = F.R;
    P.push({ el: "Fe", pos: [-4.55, -0.7, 0], link: 8 }, { el: "Fe", pos: [3.85, -0.7, 0], link: 7 }, { el: "Fe", pos: [-3.85, 0.7, 0], link: 4 }, { el: "Fe", pos: [4.55, 0.7, 0], link: 5 });
  } else {
    for (j = 0; j < 2; j++) for (var kk = 0; kk < 2; kk++) for (i = -1; i <= 3; i += 4) {
      var pos = (i + j + kk + 2) % 2 === 0, inner = (i < 0 ? 0 : 2) * 4 + j * 2 + kk;
      R.push({ el: pos ? "NH4" : "NO3", pos: [(i - 1) * 1.3, (j - 0.5) * 1.3, (kk - 0.5) * 1.3], link: inner });
    }
  }
  return k === "hw" ? { R: R, P: P, bondsR: fieldHW().bonds } : { R: R, P: P };
}
/* 표지는 결정이 온전한 «처음 장면»(반응물)·«끝 장면»(생성물)에서만 뜻이 있다 — 진행도 3 % 안에서 사라지고 나타난다
   (움직이는 입자의 길 위에 있으므로 오래 보이면 서로 뚫는다 — 검사 D-17) */
function ghostAlpha(isProduct, p) { p = Math.min(Math.max(p, 0), 1); var d = isProduct ? 1 - p : p; return 0.35 * Math.max(0, 1 - d / 0.03); }   /* 3 % — 7.5 % 이면 냉각 팩 이온이 흐린 표지 속으로 조금 들어갔다(S-검토 R3 B-10 · D-17 기준 1.0 — 냉각 팩 이온이 진행 3.25 % 에서 표지에 닿는다) */
/* 진행도 p에서 입자 위치: 0~0.5 R→A · 0.5~1 A→P */
function atomPos(a, p) { var g = progress(p); return g.frm > 0 ? lerp3(a.A, a.P, g.frm) : lerp3(a.R, a.A, g.brk); }
/* 결합 불투명도: 끊어지는 결합은 1→0, 생기는 결합은 0→1 */
function bondAlpha(isProduct, p) { var g = progress(p); return isProduct ? g.frm : 1 - g.brk; }
function components(n, bonds) {
  var par = []; for (var i = 0; i < n; i++) par.push(i);
  var f = function (x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  bonds.forEach(function (b) { par[f(b[0])] = f(b[1]); });
  var roots = {}; for (i = 0; i < n; i++) roots[f(i)] = 1;
  return Object.keys(roots).length;
}

/* ── 탭 ③ 열화학 반응식 (학습지 활동 2 · 교과서 76쪽) ── */
var EQ3 = { l1: -285.8, l2: -571.6, g2: -483.6 };
function eq3(coef, phase) {
  var dH = coef === 2 ? (phase === "l" ? EQ3.l2 : EQ3.g2) : (phase === "l" ? EQ3.l1 : EQ3.g2 / 2);
  var lab = coef === 1 ? (phase === "l" ? "(가)" : "—") : (phase === "l" ? "(나)" : "(다)");
  var lhs = coef === 2 ? "2H₂(g) + O₂(g)" : "H₂(g) + ½O₂(g)", rhs = (coef === 2 ? "2" : "") + "H₂O(" + phase + ")";
  return { coef: coef, phase: phase, dH: dH, heat: -dH, label: lab, text: lhs + " → " + rhs, nWater: coef };
}
function fmtKJ(v) { return (v < 0 ? "−" : v > 0 ? "+" : "") + Math.abs(v).toFixed(1) + " kJ"; }

/* ── 탭 ③ 자동 반응(사용자 결정 28 · 시안 4: P14 A 크기 비례 · P15 A 둥근 빛 · P16 B ×1·×2) ──
   진행도 p: 0~0.5 수소가 타서 수증기(정지점 ①) · 0.5~1 수증기가 모여 물(정지점 ②). 정지점·빠르기는 탭 ② PLAY 를 그대로 쓴다 */
function heat3(coef, p) {   /* 지금까지 주위로 나간 «알짜» 열(kJ) — 정지점 ① = (다) 쪽 값 · 정지점 ② = (가)(나) 쪽 값 · 0~0.5 구간은 O–H 가 생긴 비율(atoms3At bondW)과 같은 꼴 */
  var g = eq3(coef, "g").heat, l = eq3(coef, "l").heat; p = Math.min(Math.max(p, 0), 1);
  return p <= 0.5 ? g * p / 0.5 : g + (l - g) * (p - 0.5) / 0.5;
}
function eq3At(coef, p) { return p < 0.5 ? null : eq3(coef, p < 1 ? "g" : "l"); }   /* 정지점 ① 전에는 반응식·ΔH 를 보이지 않는다 */
/* 주위로 나간 열의 빛(주황 · 계 바깥 · 둥근 빛) — 크기는 «과장 비례»(사용자 허용 10-24): 넓이 차이가 눈에 띄게 거듭제곱.
   척도는 탭 ③ 전체에 하나(최댓값 = (나)의 열) — 반응마다 따로 맞추면 ×1·×2 비교가 거짓이 된다 */
var GLOW3 = { base: 0.12, span: 2.1, pow: 1.6, s0: 0.45, s1: 0.5 };
function glow3(h) {
  if (h <= 0) return { extent: 0, strength: 0 };
  var r = h / eq3(2, "l").heat;
  return { extent: GLOW3.base + GLOW3.span * Math.pow(r, GLOW3.pow), strength: GLOW3.s0 + GLOW3.s1 * r };
}
/* 원자 자리(장면 단위 · 계 상자 BOX3 안). 순서 [O, H, H] × 물 분자 수. R 반응물 · G 수증기(흩어짐) · L 물(모임) */
var BOX3 = { w: 4.2, h: 2.6, d: 1.6 }, RAD3 = { O: 0.42, H: 0.27 }, OH3 = 0.95, HOH3 = 104.5;
function water3(c, rot) {
  var a = HOH3 * Math.PI / 360;
  return [[c[0], c[1], c[2]], [c[0] + OH3 * Math.cos(rot + a), c[1] + OH3 * Math.sin(rot + a), c[2]], [c[0] + OH3 * Math.cos(rot - a), c[1] + OH3 * Math.sin(rot - a), c[2]]];
}
function places3(n) {   /* ×2 반응물은 «H₂ | O₂ | H₂» — 물 분자마다 자기 쪽 H₂ 에 O 가 와서 붙어 경로가 엇갈리지 않는다(S-검토 R2 B-2).
     배치는 전수 탐색: 진행 내내 «모든» 원자 쌍(결합 짝 포함) ≥ 0.9·반지름 합(최소 여유 1.08 · ×1 1.52) · 수증기 O–O 2.34 · H 는 바깥(검사 E-10·E-12·E-12b) */
  if (n === 2) return {
    R: [[0, 0.58, 0], [-1.55, 0, 0], [-0.75, 0, 0], [0, -0.58, 0], [0.75, 0, 0], [1.55, 0, 0]],
    G: water3([-1.1, 0.2, 0.35], Math.PI).concat(water3([1.1, -0.2, -0.35], 0)),          /* 수증기: 두 O 2.34 떨어짐(위아래·앞뒤로도 흩음 · 상자 안 최대) */
    L: water3([-0.9, -0.3, 0.15], 2.9).concat(water3([0.9, -0.3, -0.15], 0.3)) };          /* 물: 나란히 O–O 1.82 · H 는 서로 반대쪽(다른 분자 H–O 2.33) — 1.0 이면 H–O–O–H 한 분자로 읽혔다(S-검토 R3 A-1 · 사용자 결정 37 · 검사 E-12b) */
  return { R: [[1.2, 0, 0], [-1.55, 0, 0], [-0.75, 0, 0]], G: water3([0, 0, 0], 2.9), L: water3([0, -0.3, 0], 2.9) };
}
function ease3(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
/* 진행도 p 의 장면 — 반응물 결합(H–H · O=O)이 사라지는 «동안» 물의 O–H 가 함께 생긴다(사용자 결정 33 · S-검토 R2 A-2):
   결합이 하나도 없는 순간이 없고, 주위로 나간 열(heat3 · 알짜)은 O–H 가 생긴 만큼(bondW)만 늘어난다(검사 E-13) */
function atoms3At(n, p) {
  var P = places3(n), u, from, to, i, pos = [];
  p = Math.min(Math.max(p, 0), 1);
  if (p <= 0.5) { from = P.R; to = P.G; u = ease3(p / 0.5); } else { from = P.G; to = P.L; u = ease3((p - 0.5) / 0.5); }
  for (i = 0; i < from.length; i++) pos.push(lerp3(from[i], to[i], u));
  var v = Math.min(p / 0.5, 1);
  return { pos: pos, bondR: 1 - v, bondW: v,
           halfO: n === 1 ? v : 1,   /* ½O₂ 는 분자로 그릴 수 없다 — 글자로 두고, 물의 O 는 O–H 가 생기는 만큼 나타난다 */
           blob: p > 0.5 ? 0.24 * (p - 0.5) / 0.5 : 0 };
}
function bonds3(n) {   /* [a, b, 종류] — 원자 번호는 places3 순서 */
  var B = [[1, 2, "HH"]]; if (n === 2) B.push([4, 5, "HH"], [0, 3, "OO"]);
  B.push([0, 1, "OH"], [0, 2, "OH"]); if (n === 2) B.push([3, 4, "OH"], [3, 5, "OH"]);
  return B;
}

/* ── 반응 전 분자 운동(사용자 결정 32): 기체·액체 분자는 제자리 근처를 떠돌며 돌다가, 반응을 시작하면 시작 자리로 모여 반응한다 ──
   대상: 탭 ② 손난로 O₂(흐린 것 포함) · 냉각 팩 물 분자 · 탭 ③ H₂·O₂. 고체(철·이온 결정)는 움직이지 않는다(사용자 범위).
   겹침 없음은 «구조로» 보장한다: 분자 i 의 원자는 집 자리에서 최대 D_i 만 벗어난다. D_i 는 이웃과 «반씩 나눈» 여유
   (움직이는 이웃: (거리 − 0.9·반지름 합)/2 · 고정된 이웃: 거리 − 0.9·반지름 합 · 계 상자 벽) 중 가장 작은 값이다.
   운동은 시간 t(초)의 결정적 함수(사인 합 · 분자마다 위상) — 난수·누적 상태가 없다. 진폭은 진행도 p 가 MOTION.settle 에 닿으면 0 */
var MOTION = { cap: 0.45, trans: 0.6, settle: 0.12, gap: 0.9 };   /* settle: 진행 12 %(약 1 s)에 걸쳐 부드럽게 0 — 0.04 이면 반응 시작 순간 원자가 제자리로 «튀었다»(S-검토 R3 B-5) */
function motionEnv(p) { var u = Math.min(Math.max(p, 0) / MOTION.settle, 1); return 1 - u * u * (3 - 2 * u); }
/* 분자 묶음: members = [[원천, 번호], …] (원천 "a" = 반응하는 원자 · "g" = 흐린 표지) · 고정 = 장애물 */
function motionSetup(key) {
  var groups = [], fixed = [], i, j, box = null;
  var add = function (members, pos, rad, L) { groups.push({ members: members, pos: pos, rad: rad, L: L || 0 }); };
  if (key === "hw") {
    var L = layoutHW(), G = ghostsOf("hw");
    L.bondsR.forEach(function (b) { if (b[2] === "OO") add([["a", b[0]], ["a", b[1]]], [L.atoms[b[0]].R, L.atoms[b[1]].R], [RAD.O, RAD.O], 0.55); });
    G.bondsR.forEach(function (b) { if (b[2] === "OO") add([["g", b[0]], ["g", b[1]]], [G.R[b[0]].pos, G.R[b[1]].pos], [RAD.O, RAD.O], 0.55); });
    L.atoms.forEach(function (a) { if (a.el === "Fe") fixed.push({ pos: a.R, rad: RAD.Fe }); });
    G.R.forEach(function (g) { if (g.el === "Fe") fixed.push({ pos: g.pos, rad: RAD.Fe }); });
  } else if (key === "cp") {
    var C = layoutCP(), GC = ghostsOf("cp");
    C.atoms.forEach(function (a, n) { if (a.el === "H2O") add([["a", n]], [a.R], [RAD.H2O], 0); else fixed.push({ pos: a.R, rad: RAD[a.el] }); });
    GC.R.forEach(function (g) { fixed.push({ pos: g.pos, rad: RAD[g.el] }); });
  } else {   /* "t3_1" · "t3_2" — 탭 ③ 반응 전(H₂ · O₂) · 계 상자 벽 */
    var n = +key.slice(3), P = places3(n).R;
    for (i = 0; i < n; i++) add([["a", i * 3 + 1], ["a", i * 3 + 2]], [P[i * 3 + 1], P[i * 3 + 2]], [RAD3.H, RAD3.H], 0.4);
    if (n === 2) add([["a", 0], ["a", 3]], [P[0], P[3]], [RAD3.O, RAD3.O], Math.max(0.58, dist3(P[0], P[3]) / 2));
    box = BOX3;
  }
  groups.forEach(function (g) { g.c = [0, 1, 2].map(function (k) { var s = 0; g.pos.forEach(function (q) { s += q[k]; }); return s / g.pos.length; }); });
  /* 최대 벗어남 D: 평면(xy) 이동·회전은 D 까지 · z 이동은 0.2·D 까지(아래 motionAt 과 같은 꼴) */
  groups.forEach(function (g, gi) {
    var D = MOTION.cap;
    g.pos.forEach(function (q, qi) {
      groups.forEach(function (h, hi) { if (hi === gi) return; h.pos.forEach(function (r, ri) { D = Math.min(D, (dist3(q, r) - MOTION.gap * (g.rad[qi] + h.rad[ri])) / 2); }); });
      fixed.forEach(function (f) { D = Math.min(D, dist3(q, f.pos) - MOTION.gap * (g.rad[qi] + f.rad)); });
      if (box) { D = Math.min(D, box.w / 2 - Math.abs(q[0]) - g.rad[qi], box.h / 2 - Math.abs(q[1]) - g.rad[qi], (box.d / 2 - Math.abs(q[2]) - g.rad[qi]) / 0.2); }
    });
    g.D = Math.max(0, D);
  });
  return { groups: groups, fixed: fixed, box: box };
}
var motionCache = {};
function motionOf(key) { return motionCache[key] || (motionCache[key] = motionSetup(key)); }
/* 분자 gi 의 시간 t 운동: 이동 T(|T| ≤ trans·D · z 는 그 1/5) + xy 회전 θ(L·|θ| ≤ (1−trans)·D) · e = 진폭 배율(motionEnv) */
function motionAt(key, gi, t, e) {
  var g = motionOf(key).groups[gi], D = g.D * e, ph = gi * 2.39996, s = Math.sin;
  var fx = 0.6 * s(0.9 * t + ph) + 0.4 * s(1.7 * t + 2.1 * ph), fy = 0.6 * s(1.1 * t + 1.3 * ph) + 0.4 * s(2.3 * t + 0.7 * ph), fz = s(0.7 * t + 3.1 * ph);
  var m = Math.sqrt(fx * fx + fy * fy), k = m > 1 ? 1 / m : 1;
  var T = [MOTION.trans * D * fx * k, MOTION.trans * D * fy * k, 0.2 * MOTION.trans * D * fz];
  var th = g.L > 0 ? (1 - MOTION.trans) * D / g.L * s(0.8 * t + 1.9 * ph) : 0;
  return { T: T, th: th, c: g.c, spin: [0.9 * s(0.6 * t + ph), 1.2 * s(0.5 * t + 2 * ph), 0.7 * s(0.4 * t + 3 * ph)] };   /* spin: 한 알갱이(물 분자) 자체 회전 — 경계 구 안이라 겹침과 무관 */
}
/* 집 자리 q 에 운동을 입힌 자리 */
function moveBy(q, M) { var dx = q[0] - M.c[0], dy = q[1] - M.c[1], cs = Math.cos(M.th), sn = Math.sin(M.th);
  return [M.c[0] + dx * cs - dy * sn + M.T[0], M.c[1] + dx * sn + dy * cs + M.T[1], q[2] + M.T[2]]; }

/* ================= UI + WebGL ================= */
/* ================= Codex FX 모듈 (조달: Astra = Codex 플러그인 2026-10-24 · 발주 검증스크립트/_enthalpy_fx/발주_엔탈피FX_v1.md ·
   원본 보존 _enthalpy_fx/enthalpy_fx.part.orig.js · selfcheck 30/30 + 요청자 독립 측정(전역 1 · 결합각 109.47/120.00/104.50 · 삼각형 예산) ·
   통합 보정 1건(띠 깊이 — 아래 주석). 이 블록은 그림만 그린다 — 위치·상태·시계는 아래 UI 가 정한다(매뉴얼 §15).
   3D 모형 제작: Codex(Astra) · 공개 배포 허용(사용자 2026-10-24) ================= */
(function (root) {
  "use strict";

  function seedValue(value) {
    var text = String(value === undefined || value === null ? 1194 : value);
    var hash = 2166136261;
    var i;
    for (i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  function randomSource(seed) {
    var state = seedValue(seed) || 2463534242;
    return function () {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function option(opts, name, fallback) {
    return opts && opts[name] !== undefined ? opts[name] : fallback;
  }

  function standardMaterial(T, color, roughness, opacity, side) {
    var alpha = opacity === undefined ? 1 : opacity;
    return new T.MeshStandardMaterial({
      color: color,
      roughness: roughness,
      metalness: 0,
      transparent: alpha < 1,
      opacity: alpha,
      depthWrite: alpha >= 1,
      side: side === undefined ? T.FrontSide : side
    });
  }

  function pillowGeometry(T, w, h, d, sx, sy, sz, seed, weave) {
    var geometry = new T.BoxGeometry(w, h, d, sx, sy, sz);
    var positions = geometry.attributes.position;
    var random = randomSource(seed);
    var i;
    var x;
    var y;
    var z;
    var nx;
    var ny;
    var edge;
    var fullness;
    var ripple;
    for (i = 0; i < positions.count; i += 1) {
      x = positions.getX(i);
      y = positions.getY(i);
      z = positions.getZ(i);
      nx = Math.abs(x) / (w * 0.5);
      ny = Math.abs(y) / (h * 0.5);
      edge = Math.max(nx, ny);
      fullness = Math.max(0.18, 1 - 0.78 * Math.pow(edge, 5));
      ripple = weave ? (random() - 0.5) * d * 0.018 : (random() - 0.5) * d * 0.007;
      if (Math.abs(z) > d * 0.35) {
        z = (z < 0 ? -1 : 1) * d * 0.5 * fullness + ripple;
      } else {
        z *= fullness;
      }
      if (nx > 0.84 && ny > 0.84) {
        x *= 1 - 0.045 * (ny - 0.84) / 0.16;
        y *= 1 - 0.045 * (nx - 0.84) / 0.16;
      }
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function thermalSetter(materials, normalColors, thermalColor) {
    var on = thermalColor !== null && thermalColor !== undefined;
    var i;
    for (i = 0; i < materials.length; i += 1) {
      materials[i].color.set(on ? thermalColor : normalColors[i]);
    }
    return on;
  }

  function addCrimpDashes(T, group, w, h, d, material) {
    var geometry = new T.BoxGeometry(w * 0.055, h * 0.008, d * 0.52);
    var count = 24;
    var mesh = new T.InstancedMesh(geometry, material, count);
    var dummy = new T.Object3D();
    var i;
    var row;
    var col;
    for (i = 0; i < count; i += 1) {
      row = i < count / 2 ? 0 : 1;
      col = i % (count / 2);
      dummy.position.set(-w * 0.40 + col * w * 0.80 / 11, row ? h * 0.955 : h * 0.045, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  function makeHandWarmer(T, opts) {
    opts = opts || {};
    var w = option(opts, "w", 2.6);
    var h = option(opts, "h", 3.4);
    var d = option(opts, "d", 0.5);
    var seed = option(opts, "seed", 1194);
    var group = new T.Group();
    var bodyMaterial = standardMaterial(T, 0xeee7d7, 0.93, 1);
    var seamMaterial = standardMaterial(T, 0xd8cebc, 0.88, 1);
    var bandMaterial = standardMaterial(T, 0x9c9488, 0.78, 1, T.DoubleSide);
    var stitchMaterial = standardMaterial(T, 0xbab09f, 0.86, 1);
    var materials = [bodyMaterial, seamMaterial, bandMaterial, stitchMaterial];
    var normalColors = [0xeee7d7, 0xd8cebc, 0x9c9488, 0xbab09f];
    var body = new T.Mesh(pillowGeometry(T, w, h, d, 16, 20, 3, seed, true), bodyMaterial);
    var topSeal = new T.Mesh(new T.BoxGeometry(w * 0.92, h * 0.035, d * 0.48), seamMaterial);
    var bottomSeal = topSeal.clone();
    var leftSeal = new T.Mesh(new T.BoxGeometry(w * 0.028, h * 0.84, d * 0.42), seamMaterial);
    var rightSeal = leftSeal.clone();
    var bandGeometry = new T.PlaneGeometry(w * 0.64, h * 0.115);
    var bandFront = new T.Mesh(bandGeometry, bandMaterial);
    var bandBack = new T.Mesh(bandGeometry, bandMaterial);
    var dashes;
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    topSeal.position.set(0, h * 0.955, 0);
    bottomSeal.position.set(0, h * 0.045, 0);
    leftSeal.position.set(-w * 0.465, h * 0.5, 0);
    rightSeal.position.set(w * 0.465, h * 0.5, 0);
    group.add(topSeal);
    group.add(bottomSeal);
    group.add(leftSeal);
    group.add(rightSeal);
    bandFront.position.set(0, h * 0.43, d * 0.5 + 0.035);   /* 통합 보정(요청자 2026-10-24): d*0.505 → 표면 요철(±0.0045)이 띠를 뚫어 «⚡»처럼 보였다 */
    bandBack.position.set(0, h * 0.43, -(d * 0.5 + 0.035));   /* 통합 보정(위와 같음) */
    bandBack.rotation.y = Math.PI;
    group.add(bandFront);
    group.add(bandBack);
    dashes = addCrimpDashes(T, group, w, h, d, stitchMaterial);
    group.userData.kind = "hand-warmer";
    return {
      group: group,
      setState: function (state) {
        state = state || {};
        thermalSetter(materials, normalColors, state.thermColor);
        dashes.visible = true;
      }
    };
  }

  function fillGranules(T, group, w, h, d, material, seed) {
    var count = 72;
    var geometry = new T.IcosahedronGeometry(Math.min(w, h) * 0.025, 0);
    var mesh = new T.InstancedMesh(geometry, material, count);
    var dummy = new T.Object3D();
    var random = randomSource(seed);
    var i;
    var scale;
    for (i = 0; i < count; i += 1) {
      dummy.position.set((random() - 0.5) * w * 0.72, h * (0.09 + random() * 0.31), (random() - 0.5) * d * 0.42);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      scale = 0.65 + random() * 0.72;
      dummy.scale.set(scale, scale * (0.75 + random() * 0.45), scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  function makeSurfaceInstances(T, group, w, h, d, seed, mode, material) {
    var dew = mode === "dew";
    var count = dew ? 32 : 64;
    var geometry = dew ? new T.SphereGeometry(1, 8, 5) : new T.CircleGeometry(1, 5);
    var mesh = new T.InstancedMesh(geometry, material, count);
    var dummy = new T.Object3D();
    var random = randomSource(seed);
    var i;
    var front;
    var size;
    for (i = 0; i < count; i += 1) {
      front = i % 2 === 0;
      size = (dew ? 0.030 : 0.018) + random() * (dew ? 0.033 : 0.019);
      dummy.position.set((random() - 0.5) * w * 0.78, h * (0.10 + random() * 0.78), (front ? 1 : -1) * (d * 0.505 + 0.014));
      dummy.rotation.set(0, front ? 0 : Math.PI, dew ? (random() - 0.5) * 0.4 : random() * Math.PI);
      dummy.scale.set(size * (0.78 + random() * 0.35), size * (dew ? 1.25 + random() * 0.55 : 0.65 + random() * 0.7), dew ? size * 0.34 : size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }

  function makeColdPack(T, opts) {
    opts = opts || {};
    var w = option(opts, "w", 3.0);
    var h = option(opts, "h", 3.6);
    var d = option(opts, "d", 0.6);
    var seed = option(opts, "seed", 1194);
    var group = new T.Group();
    var outerMaterial = standardMaterial(T, 0xe7eef2, 0.22, 0.34, T.DoubleSide);
    var sealMaterial = standardMaterial(T, 0xcbd5dc, 0.30, 0.68, T.DoubleSide);
    var innerMaterial = standardMaterial(T, 0xbfe3f4, 0.18, 0.70, T.DoubleSide);
    var burstMaterial = standardMaterial(T, 0xcdebf6, 0.32, 0.22, T.DoubleSide);
    var grainMaterial = standardMaterial(T, 0xf8fafc, 0.72, 1);
    var liquidMaterial = standardMaterial(T, 0xc9e8f4, 0.16, 0.24, T.DoubleSide);
    var levelMaterial = standardMaterial(T, 0x9fcddd, 0.24, 0.42, T.DoubleSide);
    var dewMaterial = standardMaterial(T, 0xd9f0f7, 0.08, 0.50, T.DoubleSide);
    var frostMaterial = standardMaterial(T, 0xffffff, 0.92, 0.72, T.DoubleSide);
    var thermalMaterials = [outerMaterial, sealMaterial];
    var normalColors = [0xe7eef2, 0xcbd5dc];
    var outer = new T.Mesh(pillowGeometry(T, w, h, d, 16, 20, 3, seed, false), outerMaterial);
    var topSeal = new T.Mesh(new T.BoxGeometry(w * 0.94, h * 0.055, d * 0.52), sealMaterial);
    var bottomSeal = topSeal.clone();
    var sideLeft = new T.Mesh(new T.BoxGeometry(w * 0.022, h * 0.84, d * 0.48), sealMaterial);
    var sideRight = sideLeft.clone();
    var intact = new T.Mesh(pillowGeometry(T, w * 0.68, h * 0.29, d * 0.43, 10, 7, 2, seedValue(seed) + 1, false), innerMaterial);
    var burst = new T.Mesh(pillowGeometry(T, w * 0.73, h * 0.15, d * 0.13, 12, 5, 1, seedValue(seed) + 2, true), burstMaterial);
    var liquid = new T.Mesh(pillowGeometry(T, w * 0.83, h * 0.66, d * 0.48, 12, 12, 2, seedValue(seed) + 3, false), liquidMaterial);
    var levelFront = new T.Mesh(new T.PlaneGeometry(w * 0.75, h * 0.012), levelMaterial);
    var levelBack = levelFront.clone();
    var granules;
    var dew;
    var frost;
    var thermalOn;
    outer.position.y = h * 0.5;
    outer.renderOrder = 3;
    group.add(outer);
    topSeal.position.set(0, h * 0.958, 0);
    bottomSeal.position.set(0, h * 0.042, 0);
    sideLeft.position.set(-w * 0.474, h * 0.5, 0);
    sideRight.position.set(w * 0.474, h * 0.5, 0);
    group.add(topSeal);
    group.add(bottomSeal);
    group.add(sideLeft);
    group.add(sideRight);
    intact.position.set(0, h * 0.70, 0);
    burst.position.set(0, h * 0.61, 0);
    burst.rotation.z = -0.04;
    liquid.position.set(0, h * 0.345, 0);
    liquid.visible = false;
    burst.visible = false;
    group.add(intact);
    group.add(burst);
    group.add(liquid);
    levelFront.position.set(0, h * 0.675, d * 0.49);
    levelBack.position.set(0, h * 0.675, -d * 0.49);
    levelBack.rotation.y = Math.PI;
    levelFront.visible = false;
    levelBack.visible = false;
    group.add(levelFront);
    group.add(levelBack);
    granules = fillGranules(T, group, w, h, d, grainMaterial, seedValue(seed) + 7);
    dew = makeSurfaceInstances(T, group, w, h, d, seedValue(seed) + 11, "dew", dewMaterial);
    frost = makeSurfaceInstances(T, group, w, h, d, seedValue(seed) + 19, "frost", frostMaterial);
    group.userData.kind = "cold-pack";
    return {
      group: group,
      setState: function (state) {
        var isBurst;
        var cue;
        state = state || {};
        isBurst = !!state.burst;
        cue = state.cue || "none";
        thermalOn = thermalSetter(thermalMaterials, normalColors, state.thermColor);
        outerMaterial.opacity = thermalOn ? 1 : 0.34;
        outerMaterial.transparent = !thermalOn;
        outerMaterial.depthWrite = thermalOn;
        outerMaterial.roughness = thermalOn ? 0.82 : 0.22;
        outerMaterial.needsUpdate = true;
        sealMaterial.opacity = thermalOn ? 1 : 0.68;
        sealMaterial.transparent = !thermalOn;
        sealMaterial.depthWrite = thermalOn;
        sealMaterial.needsUpdate = true;
        intact.visible = !thermalOn && !isBurst;
        burst.visible = !thermalOn && isBurst;
        granules.visible = !thermalOn && !isBurst;
        liquid.visible = !thermalOn && isBurst;
        levelFront.visible = !thermalOn && isBurst;
        levelBack.visible = !thermalOn && isBurst;
        dew.visible = !thermalOn && cue === "dew";
        frost.visible = !thermalOn && cue === "frost";
      }
    };
  }

  function handMaterial(T) {
    return new T.MeshStandardMaterial({
      color: 0xd7a27e,
      roughness: 0.68,
      metalness: 0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: T.DoubleSide
    });
  }

  function addCapsule(T, group, material, radius, length, x, y, z, angle, sx, sy, sz, name) {
    var mesh = new T.Mesh(new T.CapsuleGeometry(radius, length, 6, 10), material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = angle;
    mesh.scale.set(sx || 1, sy || 1, sz || 1);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  function makeHand(T, opts) {
    opts = opts || {};
    var w = option(opts, "w", 3.0);
    var h = option(opts, "h", 3.6);
    var material = handMaterial(T);
    var group = new T.Group();
    var wrist;
    var palm;
    var knuckle;
    var opacity;
    wrist = addCapsule(T, group, material, w * 0.15, h * 0.36, 0, w * 0.15 + h * 0.18, -0.24, 0, 1.0, 1.0, 0.72, "wrist");
    palm = new T.Mesh(new T.SphereGeometry(1, 18, 12), material);
    palm.name = "palm";
    palm.position.set(0, h * 0.43, -0.22);
    palm.scale.set(w * 0.43, h * 0.31, dScale(w));
    group.add(palm);
    knuckle = new T.Mesh(new T.SphereGeometry(1, 16, 10), material);
    knuckle.name = "knuckle-pad";
    knuckle.position.set(0, h * 0.61, -0.24);
    knuckle.scale.set(w * 0.42, h * 0.18, w * 0.105);
    group.add(knuckle);
    addCapsule(T, group, material, w * 0.074, h * 0.39, w * 0.31, h * 0.77, -0.22, -0.07, 0.92, 1, 0.88, "index-finger");
    addCapsule(T, group, material, w * 0.077, h * 0.43, w * 0.10, h * 0.80, -0.24, -0.02, 0.96, 1, 0.9, "middle-finger");
    addCapsule(T, group, material, w * 0.073, h * 0.40, -w * 0.12, h * 0.78, -0.23, 0.04, 0.93, 1, 0.88, "ring-finger");
    addCapsule(T, group, material, w * 0.064, h * 0.32, -w * 0.32, h * 0.73, -0.18, 0.10, 0.88, 1, 0.82, "little-finger");
    addCapsule(T, group, material, w * 0.095, h * 0.24, -w * 0.39, h * 0.47, 0.13, -0.88, 1, 1, 0.88, "thumb");
    addCapsule(T, group, material, w * 0.070, h * 0.16, w * 0.45, h * 0.47, 0.03, -0.42, 1, 1, 0.84, "edge-curl");
    group.userData.kind = "right-hand";
    function dScale(width) {
      return width * 0.115;
    }
    return {
      group: group,
      setState: function (state) {
        var thermal;
        state = state || {};
        opacity = state.opacity === undefined ? 0.35 : Math.max(0, Math.min(1, state.opacity));
        thermal = state.thermColor !== null && state.thermColor !== undefined;
        material.color.set(thermal ? state.thermColor : 0xd7a27e);
        material.opacity = opacity;
        material.transparent = opacity < 1;
        material.depthWrite = opacity >= 1;
        material.needsUpdate = true;
      }
    };
  }

  function addAtom(T, group, role, radius, color, x, y, z, segments) {
    var material = new T.MeshStandardMaterial({
      color: color,
      roughness: 0.24,
      metalness: role === "Fe" ? 0.30 : 0.04
    });
    var mesh = new T.Mesh(new T.SphereGeometry(radius, segments || 14, 10), material);
    mesh.position.set(x, y, z);
    mesh.name = "atom-" + role;
    mesh.userData.atomRole = role;
    group.add(mesh);
    return mesh;
  }

  function addBond(T, group, a, b, radius, material, name) {
    var direction = new T.Vector3().subVectors(b, a);
    var length = direction.length();
    var mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, length, 8, 1, false), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  function makeParticle(T, opts) {
    opts = opts || {};
    var el = option(opts, "el", "Fe");
    var radius = Math.max(0.001, option(opts, "radius", 0.5));
    var defaults = { Fe: 0xb7bbc2, O: 0xe45757, NH4: 0x5b8def, NO3: 0x9b72cf, H2O: 0x38a8d1 };
    var color = option(opts, "color", defaults[el] || 0xb7bbc2);
    var group = new T.Group();
    var bondMaterial = standardMaterial(T, 0x94a3b8, 0.45, 1);
    var atoms = [];
    var points = [];
    var i;
    var p;
    var angle;
    group.userData.kind = "particle";
    group.userData.species = el;
    group.userData.radius = radius;
    if (el === "Fe" || el === "O") {
      atoms.push(addAtom(T, group, el, radius, color, 0, 0, 0, 24));
    } else if (el === "NH4") {
      atoms.push(addAtom(T, group, "N", radius * 0.26, color, 0, 0, 0, 14));
      points = [
        new T.Vector3(1, 1, 1),
        new T.Vector3(1, -1, -1),
        new T.Vector3(-1, 1, -1),
        new T.Vector3(-1, -1, 1)
      ];
      for (i = 0; i < points.length; i += 1) {
        points[i].normalize().multiplyScalar(radius * 0.68);
        atoms.push(addAtom(T, group, "H" + (i + 1), radius * 0.17, 0xf8fafc, points[i].x, points[i].y, points[i].z, 14));
        addBond(T, group, new T.Vector3(0, 0, 0), points[i], radius * 0.043, bondMaterial, "bond-NH");
      }
    } else if (el === "NO3") {
      atoms.push(addAtom(T, group, "N", radius * 0.27, color, 0, 0, 0, 14));
      for (i = 0; i < 3; i += 1) {
        angle = i * Math.PI * 2 / 3;
        p = new T.Vector3(Math.cos(angle) * radius * 0.67, Math.sin(angle) * radius * 0.67, 0);
        points.push(p);
        atoms.push(addAtom(T, group, "O" + (i + 1), radius * 0.19, 0xf1f5f9, p.x, p.y, p.z, 14));
        addBond(T, group, new T.Vector3(0, 0, 0), p, radius * 0.045, bondMaterial, "bond-NO");
      }
    } else if (el === "H2O") {
      atoms.push(addAtom(T, group, "O", radius * 0.29, color, 0, 0, 0, 14));
      angle = 104.5 * Math.PI / 360;
      points = [
        new T.Vector3(Math.sin(angle), Math.cos(angle), 0).multiplyScalar(radius * 0.65),
        new T.Vector3(-Math.sin(angle), Math.cos(angle), 0).multiplyScalar(radius * 0.65)
      ];
      for (i = 0; i < points.length; i += 1) {
        atoms.push(addAtom(T, group, "H" + (i + 1), radius * 0.18, 0xf8fafc, points[i].x, points[i].y, points[i].z, 14));
        addBond(T, group, new T.Vector3(0, 0, 0), points[i], radius * 0.045, bondMaterial, "bond-OH");
      }
    } else {
      atoms.push(addAtom(T, group, el, radius, color, 0, 0, 0, 24));
    }
    return {
      group: group,
      setOpacity: function (alpha) {
        var a = Math.max(0, Math.min(1, alpha));
        group.traverse(function (object) {
          if (object.material) {
            object.material.opacity = a;
            object.material.transparent = a < 1;
            object.material.depthWrite = a >= 1;
            object.material.needsUpdate = true;
          }
        });
      }
    };
  }

  root.ENTH_FX = {
    contract: 1,
    version: "1.0.0",
    makeHandWarmer: makeHandWarmer,
    makeColdPack: makeColdPack,
    makeHand: makeHand,
    makeParticle: makeParticle
  };
}(window));

/* ================= Codex FX3 모듈 — 탭 ③(수소 연소 · 방출열) (조달: Astra = Codex 플러그인 2026-10-24 · 발주 검증스크립트/_enthalpy_fx3/발주_엔탈피FX3_v1.md ·
   원본 보존 _enthalpy_fx3/enthalpy_fx3.part.orig.js · selfcheck 13/13 + 요청자 재실행·금지 패턴 0 · 통합 보정 없음(원문 그대로 — 검사 H-3).
   3D 모형 제작: Codex(Astra) · 공개 배포 허용(사용자 2026-10-24) ================= */
(function (root) {
  "use strict";

  function option(opts, name, fallback) {
    return opts && opts[name] !== undefined ? opts[name] : fallback;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function seedValue(value) {
    var text = String(value === undefined || value === null ? 1194 : value);
    var hash = 2166136261;
    var i;
    for (i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  function randomSource(seed) {
    var state = seedValue(seed) || 2463534242;
    return function () {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function setMaterialOpacity(material, alpha) {
    material.opacity = alpha;
    material.transparent = alpha < 1;
    material.depthWrite = alpha >= 1;
    material.needsUpdate = true;
  }

  function makeAtom(T, opts) {
    opts = opts || {};
    var el = option(opts, "el", "H");
    var radius = Math.max(0.001, option(opts, "radius", el === "O" ? 0.42 : 0.27));
    var color = option(opts, "color", el === "O" ? 0xff0d0d : 0xffffff);
    var random = randomSource(option(opts, "seed", 1194));
    var group = new T.Group();
    var material = new T.MeshStandardMaterial({
      color: color,
      roughness: 0.24,
      metalness: 0.04
    });
    var sphere = new T.Mesh(new T.SphereGeometry(radius, 24, 16), material);
    var materials = [material];
    sphere.name = "atom-" + el;
    sphere.rotation.y = random() * Math.PI * 2;
    group.add(sphere);
    if (el === "H") {
      var rimMaterial = new T.MeshStandardMaterial({
        color: 0x8b95a3,
        roughness: 0.72,
        metalness: 0,
        side: T.BackSide
      });
      var rim = new T.Mesh(new T.SphereGeometry(radius * 1.045, 24, 16), rimMaterial);
      rim.name = "neutral-rim";
      rim.renderOrder = -1;
      materials.push(rimMaterial);
      group.add(rim);
    }
    group.userData.kind = "atom";
    group.userData.element = el;
    return {
      group: group,
      setOpacity: function (value) {
        var alpha = clamp(value, 0, 1);
        var i;
        for (i = 0; i < materials.length; i += 1) {
          setMaterialOpacity(materials[i], alpha);
        }
        group.visible = alpha > 0;
      }
    };
  }

  function makeBond(T, opts) {
    opts = opts || {};
    var order = option(opts, "order", 1) === 2 ? 2 : 1;
    var radius = Math.max(0.001, option(opts, "radius", 0.07));
    var color = option(opts, "color", 0x9aa4b2);
    var group = new T.Group();
    var material = new T.MeshStandardMaterial({
      color: color,
      roughness: 0.42,
      metalness: 0.02
    });
    var geometry = new T.CylinderGeometry(radius, radius, 1, 12, 1, false);
    var sticks = [];
    var i;
    var up = new T.Vector3(0, 1, 0);
    var direction = new T.Vector3();
    var midpoint = new T.Vector3();
    var unit = new T.Vector3();
    var perpendicular = new T.Vector3();
    var cameraAxis = new T.Vector3(0, 0, 1);
    var fallbackAxis = new T.Vector3(1, 0, 0);
    var offset = new T.Vector3();
    for (i = 0; i < order; i += 1) {
      var stick = new T.Mesh(geometry, material);
      stick.name = order === 2 ? "bond-stick-" + (i + 1) : "bond-stick";
      sticks.push(stick);
      group.add(stick);
    }
    function setEnds(a, b) {
      var length;
      direction.subVectors(b, a);
      length = direction.length();
      midpoint.copy(a).add(b).multiplyScalar(0.5);
      if (length < 0.000001) {
        for (i = 0; i < sticks.length; i += 1) {
          sticks[i].visible = false;
        }
        return;
      }
      unit.copy(direction).multiplyScalar(1 / length);
      perpendicular.crossVectors(unit, cameraAxis);
      if (perpendicular.lengthSq() < 0.0001) {
        perpendicular.crossVectors(unit, fallbackAxis);
      }
      perpendicular.normalize();
      for (i = 0; i < sticks.length; i += 1) {
        sticks[i].visible = true;
        sticks[i].scale.set(1, length, 1);
        sticks[i].quaternion.setFromUnitVectors(up, unit);
        if (order === 2) {
          offset.copy(perpendicular).multiplyScalar((i === 0 ? -1 : 1) * radius * 1.45);
          sticks[i].position.copy(midpoint).add(offset);
        } else {
          sticks[i].position.copy(midpoint);
        }
      }
    }
    group.userData.kind = "bond";
    setEnds(new T.Vector3(0, -0.5, 0), new T.Vector3(0, 0.5, 0));
    return {
      group: group,
      setEnds: setEnds,
      setOpacity: function (value) {
        var alpha = clamp(value, 0, 1);
        setMaterialOpacity(material, alpha);
        group.visible = alpha > 0;
      }
    };
  }

  function makeSystemBox(T, opts) {
    opts = opts || {};
    var w = Math.max(0.01, option(opts, "w", 4.2));
    var h = Math.max(0.01, option(opts, "h", 2.6));
    var d = Math.max(0.01, option(opts, "d", 1.6));
    var group = new T.Group();
    var fillMaterial = new T.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      side: T.DoubleSide
    });
    var edgeMaterial = new T.LineDashedMaterial({
      color: 0x5f6b7a,
      dashSize: 0.16,
      gapSize: 0.11,
      transparent: true,
      opacity: 0.82
    });
    var fill = new T.Mesh(new T.BoxGeometry(w, h, d), fillMaterial);
    var edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, h, d)), edgeMaterial);
    edges.computeLineDistances();
    fill.name = "system-glass";
    edges.name = "system-dashed-edges";
    fill.renderOrder = 3;
    edges.renderOrder = 4;
    group.add(fill);
    group.add(edges);
    group.userData.kind = "system-box";
    return {
      group: group,
      setOpacity: function (value) {
        var alpha = clamp(value, 0, 1);
        fillMaterial.opacity = 0.075 * alpha;
        edgeMaterial.opacity = 0.82 * alpha;
        fillMaterial.needsUpdate = true;
        edgeMaterial.needsUpdate = true;
        group.visible = alpha > 0;
      }
    };
  }

  function makeCircularRingGeometry(T, segments) {
    var positions = new Float32Array(segments * 2 * 3);
    var indices = [];
    var i;
    for (i = 0; i < segments; i += 1) {
      var next = (i + 1) % segments;
      indices.push(i * 2, next * 2, next * 2 + 1);
      indices.push(i * 2, next * 2 + 1, i * 2 + 1);
    }
    var geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
  }

  function updateCircularRing(geometry, innerRadius, outerRadius, z) {
    var position = geometry.attributes.position;
    var segments = position.count / 2;
    var i;
    var angle;
    for (i = 0; i < segments; i += 1) {
      angle = Math.PI * 2 * i / segments;
      position.setXYZ(i * 2, Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, z);
      position.setXYZ(i * 2 + 1, Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, z);
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  function roundedPoint(boxHalfW, boxHalfH, distance, index, steps, target) {
    var corner = Math.floor(index / (steps + 1));
    var step = index % (steps + 1);
    var start = corner * Math.PI * 0.5;
    var angle = start + step * Math.PI * 0.5 / steps;
    var cx = corner === 0 || corner === 3 ? boxHalfW : -boxHalfW;
    var cy = corner === 0 || corner === 1 ? boxHalfH : -boxHalfH;
    target.x = cx + Math.cos(angle) * distance;
    target.y = cy + Math.sin(angle) * distance;
  }

  function makeRoundedRingGeometry(T, steps) {
    var count = 4 * (steps + 1);
    var positions = new Float32Array(count * 2 * 3);
    var indices = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var next = (i + 1) % count;
      indices.push(i * 2, next * 2, next * 2 + 1);
      indices.push(i * 2, next * 2 + 1, i * 2 + 1);
    }
    var geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.userData.steps = steps;
    return geometry;
  }

  function updateRoundedRing(geometry, halfW, halfH, innerDistance, outerDistance, z) {
    var position = geometry.attributes.position;
    var steps = geometry.userData.steps;
    var count = position.count / 2;
    var inner = { x: 0, y: 0 };
    var outer = { x: 0, y: 0 };
    var i;
    for (i = 0; i < count; i += 1) {
      roundedPoint(halfW, halfH, innerDistance, i, steps, inner);
      roundedPoint(halfW, halfH, outerDistance, i, steps, outer);
      position.setXYZ(i * 2, inner.x, inner.y, z);
      position.setXYZ(i * 2 + 1, outer.x, outer.y, z);
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  function makeLineGeometry(T, count) {
    var geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(new Float32Array((count + 1) * 3), 3));
    return geometry;
  }

  function updateCircleLine(line, radius, z) {
    var position = line.geometry.attributes.position;
    var count = position.count - 1;
    var i;
    var angle;
    for (i = 0; i <= count; i += 1) {
      angle = Math.PI * 2 * (i % count) / count;
      position.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    }
    position.needsUpdate = true;
    line.computeLineDistances();
  }

  function updateRoundedLine(line, halfW, halfH, distance, z, steps) {
    var position = line.geometry.attributes.position;
    var count = position.count - 1;
    var point = { x: 0, y: 0 };
    var i;
    for (i = 0; i <= count; i += 1) {
      roundedPoint(halfW, halfH, distance, i % count, steps, point);
      position.setXYZ(i, point.x, point.y, z);
    }
    position.needsUpdate = true;
    line.computeLineDistances();
  }

  function makeHeatGlow(T, opts) {
    opts = opts || {};
    var shape = option(opts, "shape", "round");
    var box = option(opts, "box", {});
    var w = Math.max(0.01, option(box, "w", 4.2));
    var h = Math.max(0.01, option(box, "h", 2.6));
    var d = Math.max(0.01, option(box, "d", 1.6));
    var group = new T.Group();
    var layers = [];
    var layerCount = shape === "wave" ? 8 : 7;
    var z = -d * 0.5 - 0.055;
    var halfW = w * 0.5;
    var halfH = h * 0.5;
    var baseRadius = Math.sqrt(halfW * halfW + halfH * halfH) + 0.08;
    var i;
    var geometry;
    var material;
    var mesh;
    for (i = 0; i < layerCount; i += 1) {
      geometry = shape === "round" ? makeCircularRingGeometry(T, 64) : makeRoundedRingGeometry(T, 7);
      material = new T.MeshBasicMaterial({
        color: i % 2 ? 0xfb923c : 0xf97316,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide
      });
      mesh = new T.Mesh(geometry, material);
      mesh.name = "heat-" + shape + "-layer-" + (i + 1);
      mesh.visible = false;
      mesh.renderOrder = -4;
      group.add(mesh);
      layers.push(mesh);
    }
    var ringGeometry = shape === "round" ? makeCircularRingGeometry(T, 64) : makeRoundedRingGeometry(T, 7);
    var ringMaterial = new T.MeshBasicMaterial({
      color: 0xea6b0b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide
    });
    var ringMesh = new T.Mesh(ringGeometry, ringMaterial);
    var lineCount = shape === "round" ? 64 : 4 * (7 + 1);
    var ringEdgeMaterial = new T.LineDashedMaterial({
      color: 0xb45309,
      dashSize: 0.13,
      gapSize: 0.09,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    var ringInner = new T.Line(makeLineGeometry(T, lineCount), ringEdgeMaterial);
    var ringOuter = new T.Line(makeLineGeometry(T, lineCount), ringEdgeMaterial);
    ringMesh.name = "heat-added-ring";
    ringInner.name = "heat-added-ring-inner-edge";
    ringOuter.name = "heat-added-ring-outer-edge";
    ringMesh.visible = false;
    ringInner.visible = false;
    ringOuter.visible = false;
    ringMesh.renderOrder = -3;
    ringInner.renderOrder = -2;
    ringOuter.renderOrder = -2;
    group.add(ringMesh);
    group.add(ringInner);
    group.add(ringOuter);
    group.userData.kind = "heat-glow";
    group.userData.shape = shape;

    function hideAll() {
      for (i = 0; i < layers.length; i += 1) {
        layers[i].visible = false;
        layers[i].material.opacity = 0;
      }
      ringMesh.visible = false;
      ringInner.visible = false;
      ringOuter.visible = false;
      ringMaterial.opacity = 0;
      ringEdgeMaterial.opacity = 0;
    }

    function setState(state) {
      state = state || {};
      var extent = Math.max(0, option(state, "extent", 0));
      var strength = clamp(option(state, "strength", 0), 0, 1);
      var time = option(state, "t", 0);
      var activeCount;
      var phase;
      var distance;
      var innerDistance;
      var outerDistance;
      var width;
      var fade;
      var ring = state.ring;
      hideAll();
      if (extent > 0 && strength > 0) {
        if (shape === "wave") {
          activeCount = clamp(3 + Math.floor(extent / 0.42), 3, 8);
          phase = ((time * 0.24) % 1 + 1) % 1;
          for (i = 0; i < activeCount; i += 1) {
            distance = 0.05 + extent * ((i + phase) / activeCount);
            width = Math.min(0.115, 0.045 + extent * 0.018);
            innerDistance = distance;
            outerDistance = Math.min(extent + 0.08, distance + width);
            updateRoundedRing(layers[i].geometry, halfW, halfH, innerDistance, outerDistance, z);
            fade = 1 - distance / (extent + 0.12);
            layers[i].material.opacity = strength * clamp(fade, 0.08, 1) * 0.52;
            layers[i].visible = true;
          }
        } else {
          for (i = 0; i < layers.length; i += 1) {
            innerDistance = extent * i / layers.length;
            outerDistance = extent * (i + 1) / layers.length + 0.012;
            if (shape === "round") {
              updateCircularRing(layers[i].geometry, baseRadius + innerDistance, baseRadius + outerDistance, z);
            } else {
              updateRoundedRing(layers[i].geometry, halfW, halfH, 0.045 + innerDistance, 0.045 + outerDistance, z);
            }
            fade = 1 - (i + 0.45) / layers.length;
            layers[i].material.opacity = strength * (0.10 + 0.46 * fade * fade);
            layers[i].visible = true;
          }
        }
      }
      if (extent > 0 && ring && strength > 0) {
        innerDistance = Math.max(0.025, option(ring, "inner", 0));
        outerDistance = Math.max(innerDistance + 0.015, option(ring, "outer", innerDistance + 0.2));
        if (shape === "round") {
          updateCircularRing(ringMesh.geometry, baseRadius + innerDistance, baseRadius + outerDistance, z + 0.006);
          updateCircleLine(ringInner, baseRadius + innerDistance, z + 0.012);
          updateCircleLine(ringOuter, baseRadius + outerDistance, z + 0.012);
        } else {
          updateRoundedRing(ringMesh.geometry, halfW, halfH, innerDistance, outerDistance, z + 0.006);
          updateRoundedLine(ringInner, halfW, halfH, innerDistance, z + 0.012, 7);
          updateRoundedLine(ringOuter, halfW, halfH, outerDistance, z + 0.012, 7);
        }
        ringMaterial.opacity = strength * 0.34;
        ringEdgeMaterial.opacity = strength * 0.82;
        ringMesh.visible = true;
        ringInner.visible = true;
        ringOuter.visible = true;
      }
    }
    setState({ extent: 0, strength: 0, ring: null, t: 0 });
    return {
      group: group,
      setState: setState
    };
  }

  function makeLiquidBlob(T, opts) {
    opts = opts || {};
    var radius = Math.max(0.01, option(opts, "radius", 1));
    var random = randomSource(option(opts, "seed", 1194));
    var group = new T.Group();
    var geometry = new T.SphereGeometry(radius, 24, 12);
    var position = geometry.attributes.position;
    var i;
    var x;
    var y;
    var z;
    var ripple;
    for (i = 0; i < position.count; i += 1) {
      x = position.getX(i);
      y = position.getY(i);
      z = position.getZ(i);
      ripple = 0.96 + random() * 0.08;
      position.setXYZ(i, x * 1.18 * ripple, y * 0.30 * (0.94 + random() * 0.08), z * 0.88 * ripple);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    var material = new T.MeshStandardMaterial({
      color: 0x56b4e9,
      roughness: 0.42,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide
    });
    var blob = new T.Mesh(geometry, material);
    blob.name = "liquid-water-blob";
    blob.position.y = -radius * 0.13;
    blob.visible = false;
    group.add(blob);
    group.userData.kind = "liquid-blob";
    return {
      group: group,
      setState: function (state) {
        var alpha = clamp(option(state || {}, "opacity", 0), 0, 1);
        material.opacity = alpha;
        material.transparent = true;
        material.depthWrite = false;
        material.needsUpdate = true;
        blob.visible = alpha > 0;
      }
    };
  }

  root.ENTH_FX3 = {
    contract: 1,
    version: "1.0.0",
    makeAtom: makeAtom,
    makeBond: makeBond,
    makeSystemBox: makeSystemBox,
    makeHeatGlow: makeHeatGlow,
    makeLiquidBlob: makeLiquidBlob
  };
}(window));

/* 화면 — 설계지시안_엔탈피_v1.1 §3 단계 4. 시계·순서는 여기(호출자)가 갖고, 그림 함수는 상태를 인자로만 받는다(매뉴얼 §15).
   모든 수치·문구 상태는 위 계산부에서 유도한다(F-1). 입자 «모양»은 사용자 결정 ⑬(Astra)이지만 위치·결합각은 계산부(§14 ② 예외 사유).
   Astra 에셋(window.ENTH_MODELS)이 아직 없으면 자리 표시 모형을 쓴다 — 인터페이스 {group, setState} 동일. */
(function () {
  if (typeof document === "undefined") return;
  var $ = function (id) { return document.getElementById(id); };
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var QS = (function () { var o = {}; (location.search || "").replace(/^\?/, "").split("&").forEach(function (kv) { var a = kv.split("="); if (a[0]) o[a[0]] = a[1] || "1"; }); return o; })();

  /* 색 — 사이트 토큰(shared/style.css)의 값. 원자 O 는 CPK(#ff0d0d · 매뉴얼 §4 CPK 예외) · 팩 겉감은 실물색 예외 */
  var PAL = {
    Fe: "#cbd5e1", O: "#ff0d0d", NH4: "#a78bfa", NO3: "#fb923c", H2O: "#e2e8f0",          /* --p-silver · CPK · --p-violet · --p-orange · 밝은 회백 */
    bond: { FeFe: "#cbd5e1", OO: "#facc15", FeO: "#34d399", ion: "#facc15", hyd: "#34d399" }, /* P13 B(지시안 §1-1 #14): silver · yellow · mint */
    heat: "#b45309",                                                                        /* --d-amber — 열은 한 색(사용자 결정 15) */
    curve: { hw: "#0f5c8c", cp: "#6d28d9" },                                                 /* --d-cyan · --d-violet — 온도 비암시 색(B-7) */
    therm: ["#1d4ed8", "#56b4e9", "#cbd5e1", "#fb923c", "#b91c1c"],                          /* 열화상 5구간: d-blue · p-sky · p-silver · p-orange · d-red(표현) */
    up: "#fb923c", down: "#56b4e9",                                                          /* 교과서 그림 Ⅲ-2·Ⅲ-6 화살표: 흡수 주황 · 방출 하늘 */
    pouchHw: "#ece6da", pouchCp: "#f1f5f9", innerCp: "#bfdbee", stageDark: "#0f172a", hand: "#fb923c"
  };
  var TXT = {
    limits: [
      "온도 곡선의 모양(서서히 오르고 빠르게 내려가는 모양)은 가정입니다. 학습지에는 처음·나중 온도와 측정 시간만 있습니다.",
      "시간은 압축했습니다 — 화면의 1초가 1분입니다(손난로 10분 = 10초, 냉각 팩 2분 = 2초). 반응이 빨라지는 것이 아닙니다.",
      "손의 피부 온도는 33 ℃로 고정했습니다.",
      "실제 손난로 속에서는 철 가루 말고도 물·소금·활성탄이 반응을 돕습니다. 여기서는 교과서대로 철과 산소가 산화 철(Ⅲ)이 되는 반응만 보입니다.",
      "「결합이 다 끊어진 상태」는 실제 반응이 거치는 단계가 아니라, 엔탈피 변화를 나누어 생각하기 위한 가상의 상태입니다.",
      "막대의 값은 문헌값으로 계산한 근삿값입니다(손난로 = 철 4 mol 기준, 냉각 팩 = 1 mol 기준 · 냉각 팩은 «약»으로 표시).",
      "화면의 결정은 일부만 잘라 보인 것입니다(흐린 입자 = 바깥으로 이어지는 이웃 · 손난로는 둘레의 철과 산소). 실제 결정은 훨씬 크고, 산화 철(Ⅲ)의 Fe³⁺는 O²⁻ 6개에 둘러싸입니다. 흐린 산소는 실제로는 기체라 분자 사이가 화면보다 훨씬 멉니다.",
      "원자·이온의 크기는 실제와 다릅니다. 실제로는 Fe³⁺가 철 원자보다 작고, O²⁻가 산소 원자보다 큽니다.",
      "열화상 색·화살표 굵기·흐르는 점의 개수는 온도(차)를 보이게 한 표현이지 열의 양이 아닙니다.",
      "측정이 끝난 냉각 팩은 손에 쥐기 전까지 화면을 멈춰 둡니다(정지 상태). 실제로는 그동안에도 공기에서 열을 받아 천천히 데워집니다. 손에 쥐면 손 쪽으로 데워지고, 온도 차가 0.5 ℃보다 작아지면 «온도가 거의 같아 열이 거의 흐르지 않는다(열평형)»로 보고 시계를 멈춥니다. 데워지는 빠르기는 가정입니다. 손난로는 반응이 열을 계속 내어 온도가 유지되는 것으로 두었습니다.",
      "탭 ③의 방출 열은 «알짜»입니다 — 결합이 끊어질 때 드는 에너지와 새 결합이 생길 때 나오는 에너지가 함께 오가고, 그 차이만큼 주위로 나갑니다. 둘을 단계로 나눠 본 모습은 탭 ②에 있습니다.",
      "탭 ③의 주황 빛 크기는 차이가 잘 보이도록 과장했습니다(빛 넓이의 비 ≠ 열의 비). 양은 숫자로 비교하세요. 기체·액체 분자의 움직임도 보이기 위한 표현이며 실제 빠르기와 다릅니다."
    ],
    lim9Hidden: "탭 ①에서 [열 방향 보기]를 누르면 이 항목(측정이 끝난 뒤와 손에 쥔 뒤의 온도 변화에 대한 가정)이 보입니다.",
    note3: "수증기가 액체로 될 때 분자 사이 인력으로 모이며 열을 더 내놓습니다(물 1 mol당 44.0 kJ, 25 ℃). 그래서 같은 반응식이라도 물의 상태에 따라 반응 엔탈피가 다릅니다."
  };

  /* ---------- 상태(단일 원천: 시계와 진행도만 여기 · 나머지는 계산부에서 유도) ---------- */
  var st = {
    tab: 1,
    t1: { hw: { t: 0, on: false, shake: 0 }, cp: { t: 0, on: false }, held: false, holdAt: null, tHold: 0, therm: true, showFlow: false },   /* showFlow: 열 방향(화살표·방향 문구) — 처음엔 숨김(사용자 결정 36) */   /* 열화상 = 항상 켬(사용자 결정 21) */
    t2: { zoom: null, zf: 0, p: { hw: 0, cp: 0 }, play: { hw: "idle", cp: "idle" }, mt: 0 },   /* mt: 분자 운동 시계(초 · 결정 32) */   /* play: idle → run1 → stop1 → run2 → stop2 → done(사용자 결정 24·25) */
    t3: { coef: 2, p: 0, play: "idle", rec: {}, mt: 0 }   /* play: idle · run1 · stop1 · run2 · done(정지점 ②) */
  };
  function packNowT(k) { var s = st.t1; return tempAt(k, s[k].t, s.held ? s.holdAt[k] : null, s.tHold); }   /* 온도 단일 원천(계산부 tempAt) */
  function fmt1(x) { var v = Math.round(x * 10) / 10; return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1); }

  /* ---------- 탭 ---------- */
  function applyTab() {
    Array.prototype.forEach.call(document.querySelectorAll(".tabb"), function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-tab") === st.tab)); });
    var show = function (sel, on) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { el.style.display = on ? "" : "none"; }); };
    show(".only-t1", st.tab === 1); show(".only-t2", st.tab === 2); show(".only-t3", st.tab === 3); show(".only-t12", st.tab !== 3);
    if (st.tab === 3 && S3 === undefined) { S3 = buildStage3(); $("s3wrap").classList.toggle("is-hidden", !S3); $("mols3").classList.toggle("is-hidden", !!S3); }
    sync();
  }

  /* ================= 탭 ① 측정 · 그래프 · 표 ================= */
  function graphSVG() {
    var wd = 360, ht = 190, L = 40, R = wd - 12, Tp = 14, B = ht - 30, lo = Math.min(0, Math.floor(Math.min(ENTH.PACK.cp.T1, 0) / 10) * 10), hi = 50;
    var X = function (t) { return L + (R - L) * t / 10; }, Y = function (c) { return B - (B - Tp) * (c - lo) / (hi - lo); };
    var o = '<svg viewBox="0 0 ' + wd + " " + ht + '" role="img" aria-label="두 팩 안쪽 온도의 시간 변화 그래프">';
    o += '<line x1="' + L + '" y1="' + B + '" x2="' + R + '" y2="' + B + '" stroke="#94a3b8"/><line x1="' + L + '" y1="' + Tp + '" x2="' + L + '" y2="' + B + '" stroke="#94a3b8"/>';
    for (var c = lo; c <= hi; c += 10) o += '<text x="' + (L - 6) + '" y="' + (Y(c) + 4) + '" text-anchor="end" font-size="10" fill="#5b636b">' + c + "</text>";
    for (var t = 0; t <= 10; t += 2) o += '<text x="' + X(t) + '" y="' + (B + 14) + '" text-anchor="middle" font-size="10" fill="#5b636b">' + t + "</text>";
    o += '<text x="' + R + '" y="' + (ht - 2) + '" text-anchor="end" font-size="10.5" fill="#454b52">시간(분)</text><text x="44" y="10" font-size="10.5" fill="#454b52">온도(℃)</text>';
    if (st.t1.held) o += '<line x1="' + L + '" y1="' + Y(ENTH.HAND) + '" x2="' + R + '" y2="' + Y(ENTH.HAND) + '" stroke="#5f6b7a" stroke-dasharray="4 4"/><text x="' + (R - 2) + '" y="' + (Y(ENTH.HAND) - 4) + '" text-anchor="end" font-size="10" fill="#5f6b7a">손 33 ℃</text>';
    ["hw", "cp"].forEach(function (k) {
      var tEnd = Math.min(st.t1[k].t, 10), tm = ENTH.PACK[k].tm, d = "", d2 = "", col = PAL.curve[k], hAt = st.t1.held ? st.t1.holdAt[k] : null;
      for (var q = 0; q <= Math.min(tEnd, tm) + 1e-9; q += 0.1) d += (d ? " L" : "M") + X(q).toFixed(1) + "," + Y(packT(k, q)).toFixed(1);
      /* 측정 뒤는 그리지 않는다 — 시계가 측정 시간에서 멈춘다(냉각 팩 정지 상태 · 사용자 결정 26). 쥔 뒤도 넣지 않는다(시간축이 «측정 시간») */
      if (d) o += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.5"' + (k === "cp" ? ' stroke-dasharray="7 3"' : "") + "/>";
      if (st.t1[k].on || tEnd > 0) o += '<text x="' + (X(Math.min(tEnd, tm)) - 4) + '" y="' + (Y(packT(k, Math.min(tEnd, tm))) - 8) + '" text-anchor="end" font-size="11" font-weight="700" fill="' + col + '">' + ENTH.PACK[k].name + "</text>";
    });
    return o + "</svg>";
  }
  function wsTableHTML() {
    var r = "<tr><th>구분</th><th>처음 온도(℃)</th><th>나중 온도(℃)</th><th>온도 변화(℃)</th><th>측정 시간(분)</th></tr>";
    ["hw", "cp"].forEach(function (k) {
      var p = ENTH.PACK[k], done = measureDone(k, st.t1[k].t), dT = p.T1 - p.T0;
      r += "<tr><td>" + p.name + "</td><td>" + p.T0 + "</td><td>" + (done ? p.T1 : "—") + "</td><td>" + (done ? (dT > 0 ? "+" : "−") + Math.abs(dT) : "—") + "</td><td>" + (done ? p.tm : "—") + "</td></tr>";
    });
    return r;
  }

  /* ================= 탭 ② 막대 · 계단 도표 · Ⅲ-2 꼴 ================= */
  function barsHTML(k, p) {
    var B = barsOf(k), g = progress(p), mx = Math.max(sumKj(B.brk), sumKj(B.frm));
    function one(title, list, frac) {
      var full = sumKj(list), done = full * frac, acc = 0, fill = "", names = list.map(function (x) { return '<span style="color:' + PAL.bond[x.kind] + '">■</span> ' + x.name + " " + kjText(x.kj, B.approx); }).join(" + ");
      list.forEach(function (x) { var f = Math.max(0, Math.min(x.kj, done - acc)); acc += x.kj; fill += '<div class="seg-fill" style="width:' + (100 * f / mx).toFixed(2) + "%;background:" + PAL.bond[x.kind] + '"></div>'; });
      return '<div class="bar"><div class="top"><span><b>' + title + "</b> <small>" + names + '</small></span><span class="num">' + kjText(done, B.approx) + " / " + kjText(full, B.approx) + ' kJ</span></div><div class="track">' + fill + "</div></div>";
    }
    return '<p class="basis">반응식대로 반응할 때(' + B.basis + ") · 막대 길이는 이 팩 안에서만 비교</p>" + one("끊는 데 드는 에너지", B.brk, g.brk) + one("생길 때 나오는 에너지", B.frm, g.frm);
  }
  function arrowSVG(x1, y1, x2, y2, w, col) {
    var a = Math.atan2(y2 - y1, x2 - x1), hl = 6 + w * 1.4, hx = x2 - Math.cos(a) * hl, hy = y2 - Math.sin(a) * hl, hw = 3 + w;
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>' +
      '<path d="M' + (hx + Math.sin(a) * hw).toFixed(1) + "," + (hy - Math.cos(a) * hw).toFixed(1) + " L" + x2.toFixed(1) + "," + y2.toFixed(1) + " L" + (hx - Math.sin(a) * hw).toFixed(1) + "," + (hy + Math.cos(a) * hw).toFixed(1) + ' Z" fill="' + col + '"/>';
  }
  /* 계단 도표: 세 준위 수평선 + 수직 화살표 2개 — 비스듬한 연결선 없음 · 가로축 이름 없음(A-6) */
  function stepSVG(k, p, reveal) {
    var Lv = stepLevels(k), B = barsOf(k), g = progress(p), wd = 470, ht = 280, T0 = 36, Bt = ht - 34;
    var hiH = Lv[1].H, loH = Math.min(0, B.dH), Y = function (h) { return Bt - (Bt - T0) * (h - loH) / (hiH - loH); };
    var xR = [50, 116], xA = [138, 236], xP = [262, 334], xu = 127, xd = 247;   /* 오른쪽 330~440 = ΔH 표시·확대 원 자리(겹침 방지) */
    var o = '<svg viewBox="0 0 ' + wd + " " + ht + '" role="img" aria-label="엔탈피 계단 도표: 반응물, 결합이 다 끊어진 가상 상태, 생성물의 세 준위">';
    o += '<line x1="34" y1="' + (ht - 8) + '" x2="34" y2="14" stroke="#94a3b8"/><text x="14" y="' + ht / 2 + '" font-size="11" fill="#454b52" transform="rotate(-90 20 ' + ht / 2 + ')">엔탈피</text>';
    var lvl = function (x, h, col, dash, lab, sub, below, anchor) {   /* anchor: 라벨을 화살표 반대쪽으로(겹침 방지) */
      var y = Y(h), tx = anchor === "start" ? x[0] + 2 : (anchor === "end" ? x[1] : (x[0] + x[1]) / 2), an = anchor || "middle";
      return '<line x1="' + x[0] + '" y1="' + y.toFixed(1) + '" x2="' + x[1] + '" y2="' + y.toFixed(1) + '" stroke="' + col + '" stroke-width="3"' + (dash ? ' stroke-dasharray="6 4"' : "") + "/>" +
        '<text x="' + tx + '" y="' + (below ? y + 15 : y - 7).toFixed(1) + '" text-anchor="' + an + '" font-size="10.5" fill="#1f2328">' + lab + "</text>" +
        (sub ? '<text x="' + tx + '" y="' + (below ? y + 27 : y - 19).toFixed(1) + '" text-anchor="' + an + '" font-size="9.5" fill="#5b636b">' + sub + "</text>" : "");
    };
    o += lvl(xR, 0, "#1d4ed8", false, Lv[0].label, "반응물", true, "end");
    o += lvl(xA, Lv[1].H, "#5f6b7a", true, Lv[1].label, "결합이 다 끊어진 가상의 상태", false);
    o += lvl(xP, B.dH, "#b91c1c", false, Lv[2].label, "생성물", B.dH < 0, "start");
    if (g.brk > 0) o += arrowSVG(xu, Y(0), xu, Y(Lv[1].H * g.brk), 5, PAL.up) + '<text x="' + (xu - 6) + '" y="' + ((Y(0) + Y(Lv[1].H * g.brk)) / 2).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="#1f2328">흡수 ' + kjText(sumKj(B.brk) * g.brk, B.approx) + "</text>";
    if (g.frm > 0) o += arrowSVG(xd, Y(Lv[1].H), xd, Y(Lv[1].H - sumKj(B.frm) * g.frm), 5, PAL.down) + '<text x="' + (xd + 6) + '" y="' + ((Y(Lv[1].H) + Y(Lv[1].H - sumKj(B.frm) * g.frm)) / 2).toFixed(1) + '" font-size="10.5" fill="#1f2328">방출 ' + kjText(sumKj(B.frm) * g.frm, B.approx) + "</text>";
    if (p >= 1 && reveal) {
      if (k === "cp") {   /* ΔH 가 끊기의 3.8 % — 확대 원(축척 다름 · 도표 면적 6 %, 상한 15 % — B-17) */
        var ix = 414, iy = 118, rr = 42, a0 = Y(0), a1 = Y(B.dH);
        o += '<line x1="' + (xP[1] + 2) + '" y1="' + ((a0 + a1) / 2).toFixed(1) + '" x2="' + (ix - rr * 0.6).toFixed(1) + '" y2="' + (iy + rr * 0.8).toFixed(1) + '" stroke="#5b636b"/>' +
          '<circle cx="' + ix + '" cy="' + iy + '" r="' + rr + '" fill="#ffffff" stroke="#454b52" stroke-width="1.5"/>' +
          '<line x1="' + (ix - 34) + '" y1="' + (iy + 20) + '" x2="' + (ix - 6) + '" y2="' + (iy + 20) + '" stroke="#1d4ed8" stroke-width="3"/>' +
          '<line x1="' + (ix + 6) + '" y1="' + (iy - 16) + '" x2="' + (ix + 34) + '" y2="' + (iy - 16) + '" stroke="#b91c1c" stroke-width="3"/>' +
          arrowSVG(ix, iy + 20, ix, iy - 16, 2, "#1f2328") +
          '<text x="' + ix + '" y="' + (iy + rr + 14) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1f2328">ΔH = ' + fmtKJ(B.dH) + "</text>" +   /* 원 바깥(테두리 넘침 방지 — S-검토 R1 B-12) */
          '<text x="' + ix + '" y="' + (iy - rr - 4) + '" text-anchor="middle" font-size="9.5" fill="#5b636b">확대(축척 다름)</text>';
      } else {
        o += '<line x1="' + xR[1] + '" y1="' + Y(0).toFixed(1) + '" x2="' + (xP[1] + 18) + '" y2="' + Y(0).toFixed(1) + '" stroke="#94a3b8" stroke-dasharray="3 3"/>' +
          '<line x1="' + xP[1] + '" y1="' + Y(B.dH).toFixed(1) + '" x2="' + (xP[1] + 18) + '" y2="' + Y(B.dH).toFixed(1) + '" stroke="#94a3b8" stroke-dasharray="3 3"/>' +
          arrowSVG(xP[1] + 12, Y(0), xP[1] + 12, Y(B.dH), 2.5, "#1f2328") +
          '<text x="' + (xP[1] + 20) + '" y="' + ((Y(0) + Y(B.dH)) / 2 + 4).toFixed(1) + '" text-anchor="start" font-size="11.5" font-weight="700" fill="#1f2328">ΔH = ' + fmtKJ(B.dH) + "</text>";
      }
    }
    return o + "</svg>";
  }
  function foldSVG(k) {   /* 교과서 그림 Ⅲ-2 꼴 — 두 수평선 + ΔH · 이 도표에만 가로축 「반응의 진행」 */
    var B = barsOf(k), ex = B.dH < 0, wd = 360, ht = 170, Bt = ht - 26, hi = 36, lo = Bt - 26, yR = ex ? hi : lo, yP = ex ? lo : hi, L = 34;
    return '<svg viewBox="0 0 ' + wd + " " + ht + '" role="img" aria-label="교과서 그림 Ⅲ-2 꼴의 엔탈피 변화">' +
      '<line x1="' + L + '" y1="' + Bt + '" x2="' + L + '" y2="10" stroke="#94a3b8"/><line x1="' + L + '" y1="' + Bt + '" x2="' + (wd - 8) + '" y2="' + Bt + '" stroke="#94a3b8"/>' +
      '<text x="14" y="' + ht / 2 + '" font-size="11" fill="#454b52" transform="rotate(-90 20 ' + ht / 2 + ')">엔탈피</text><text x="' + (wd - 8) + '" y="' + (ht - 6) + '" text-anchor="end" font-size="10.5" fill="#454b52">반응의 진행</text>' +
      '<line x1="' + (L + 10) + '" y1="' + yR + '" x2="150" y2="' + yR + '" stroke="#1d4ed8" stroke-width="3"/><text x="' + (L + 12) + '" y="' + (yR - 6) + '" font-size="11" fill="#1f2328">반응물</text>' +
      '<line x1="205" y1="' + yP + '" x2="' + (wd - 12) + '" y2="' + yP + '" stroke="#b91c1c" stroke-width="3"/><text x="' + (wd - 12) + '" y="' + (yP - 6) + '" text-anchor="end" font-size="11" fill="#1f2328">생성물</text>' +
      arrowSVG(150, yR, 205, yP, 6, ex ? PAL.down : PAL.up) +
      '<text x="' + (L + 14) + '" y="' + ((yR + yP) / 2 + 4) + '" font-size="12" font-weight="700" fill="#1f2328">ΔH ' + (ex ? "&lt; 0" : "&gt; 0") + "</text>" +
      '<text x="218" y="' + ((yR + yP) / 2 + 4) + '" font-size="10.5" fill="#454b52">' + (ex ? "엔탈피 감소 · 열 방출" : "엔탈피 증가 · 열 흡수") + "</text></svg>";
  }

  /* ================= 탭 ③ ================= */
  function ballHTML(d, col) { return '<span class="ball" style="width:' + d + "px;height:" + d + "px;background:" + col + ';border:1px solid #94a3b8"></span>'; }
  function molHTML(kind) {
    if (kind === "H2") return '<span class="mol" title="H₂">' + ballHTML(14, "#f1f5f9") + ballHTML(14, "#f1f5f9") + "</span>";
    if (kind === "O2") return '<span class="mol" title="O₂">' + ballHTML(20, PAL.O) + ballHTML(20, PAL.O) + "</span>";
    return '<span class="mol" title="H₂O">' + ballHTML(12, "#f1f5f9") + ballHTML(20, PAL.O) + ballHTML(12, "#f1f5f9") + "</span>";
  }
  function tab3Diag(n, p) {   /* 엔탈피 도표 — 3D 무대 옆에 세로로 좁게(사용자 10-24: 좌우 배치). 정지점마다 한 칸씩 자란다. 주황 = 주위로 나간 열 */
    var wd = 270, ht = 230, B = ht - 26, top = 44, Y = function (v) { return top + (B - top) * v / eq3(2, "l").heat; };
    var g = eq3(n, "g").heat, l = eq3(n, "l").heat, h = heat3(n, p), w = n === 2 ? "2" : "";
    var o = '<svg viewBox="0 0 ' + wd + " " + ht + '" role="img" aria-label="수소 연소의 엔탈피 도표">' +
      '<line x1="18" y1="' + B + '" x2="18" y2="22" stroke="#94a3b8"/><text x="2" y="14" font-size="10.5" fill="#454b52">↑ 엔탈피</text>' +
      '<text x="' + (wd - 2) + '" y="12" text-anchor="end" font-size="10.5" fill="' + PAL.heat + '">주황 화살표 = 주위로 나간 열</text>' +
      '<line x1="26" y1="' + Y(0) + '" x2="116" y2="' + Y(0) + '" stroke="#1d4ed8" stroke-width="3"/><text x="26" y="' + (Y(0) - 7) + '" font-size="11" fill="#1f2328">' + (n === 2 ? "2H₂(g) + O₂(g)" : "H₂(g) + ½O₂(g)") + "</text>";
    if (p >= 0.5) o += '<line x1="146" y1="' + Y(g).toFixed(1) + '" x2="232" y2="' + Y(g).toFixed(1) + '" stroke="#b91c1c" stroke-width="' + (p <= 0.5 ? 3 : 1.6) + '"/><text x="232" y="' + (Y(g) - 6).toFixed(1) + '" text-anchor="end" font-size="11" fill="#1f2328">' + w + "H₂O(g)</text>";
    if (p > 0.5) o += '<line x1="146" y1="' + Y(l).toFixed(1) + '" x2="232" y2="' + Y(l).toFixed(1) + '" stroke="#b91c1c" stroke-width="3"/><text x="146" y="' + (Y(l) + 15).toFixed(1) + '" font-size="11" fill="#1f2328">' + w + "H₂O(l)</text>";
    var a1 = Math.min(h, g);
    if (a1 > 0.5) o += arrowSVG(130, Y(0), 130, Y(a1), 2.5, PAL.heat) + '<text x="124" y="' + (Y(a1) - Y(0) < 34 ? Y(a1) + 16 : (Y(0) + Y(a1)) / 2 + 4).toFixed(1) + '" text-anchor="end" font-size="12" font-weight="700" fill="' + PAL.heat + '">' + a1.toFixed(1) + " kJ</text>";
    if (h > g + 0.5) o += arrowSVG(248, Y(g), 248, Y(h), 2.5, PAL.heat) + '<text x="' + (wd - 2) + '" y="' + (Y(h) + 15).toFixed(1) + '" text-anchor="end" font-size="12" font-weight="700" fill="' + PAL.heat + '">+' + (h - g).toFixed(1) + "</text>";
    return o + "</svg>";
  }
  function tab3Mols(n, p) {   /* WebGL 이 없을 때의 평면 그림 */
    var lhs = n === 2 ? molHTML("H2") + molHTML("H2") + " + " + molHTML("O2") : molHTML("H2") + ' + <b title="반쪽 분자는 그림으로 그리지 않는다">½O₂</b>';
    if (p < 0.5) return "<span>" + lhs + '</span><span class="arrow">→</span><span>?</span>';
    var w = [], i; for (i = 0; i < n; i++) w.push(molHTML("H2O"));
    return "<span>" + lhs + '</span><span class="arrow">→</span><span style="display:inline-flex;gap:' + (p >= 1 ? 1 : 26) + 'px">' + w.join("") + "</span>";
  }
  function rec3HTML() {
    var rows = [[1, "l"], [2, "l"], [2, "g"], [1, "g"]], t3 = st.t3, cur = t3.play === "stop1" ? t3.coef + "g" : (t3.play === "done" ? t3.coef + "l" : "");
    var h = "<tr><th></th><th>열화학 반응식</th><th>방출하는 열</th></tr>";
    rows.forEach(function (r) {
      var E = eq3(r[0], r[1]), key = r[0] + r[1], seen = !!t3.rec[key];
      h += '<tr class="' + (key === cur ? "is-on" : "") + '"><td>' + E.label + '</td><td style="text-align:left">' + E.text + '</td><td class="heat">' + (seen ? E.heat.toFixed(1) + " kJ" : "해 보기 전") + "</td></tr>";
    });
    return h;
  }

  /* ================= 탭 ③ 3D 무대 — Codex(Astra) ENTH_FX3 · 자리·빛 크기는 계산부(atoms3At · glow3)만 읽는다 ================= */
  var S3, drawn3 = null;   /* S3: undefined = 아직 안 만듦 · null = WebGL 없음(평면 그림) */
  function buildStage3() {
    var cv = $("stage3c"), FX = window.ENTH_FX3, gl = null, i;
    if (QS.fallback === "1" || typeof THREE === "undefined" || !FX || FX.contract !== 1) return null;
    try { gl = cv.getContext("webgl", { antialias: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    THREE.ColorManagement.legacyMode = false;
    var r = new THREE.WebGLRenderer({ canvas: cv, context: gl, antialias: true });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95; r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    var sc = new THREE.Scene(); sc.background = new THREE.Color("#ffffff");
    sc.add(new THREE.HemisphereLight(0xffffff, 0xd8dee8, 1.35));
    var k1 = new THREE.DirectionalLight(0xffffff, 1.9); k1.position.set(4, 7, 8); sc.add(k1);
    var k2 = new THREE.DirectionalLight(0xbfd2f4, 0.55); k2.position.set(-5, 2, 4); sc.add(k2);
    var glow = FX.makeHeatGlow(THREE, { shape: "round", box: BOX3, seed: 1194 }); sc.add(glow.group);   /* P15 A 둥근 빛 */
    var box = FX.makeSystemBox(THREE, BOX3); sc.add(box.group);
    var blob = FX.makeLiquidBlob(THREE, { radius: 1.28, seed: 360 }); sc.add(blob.group);
    var atoms = [];
    for (i = 0; i < 6; i++) { var el = i % 3 === 0 ? "O" : "H", a = FX.makeAtom(THREE, { el: el, radius: RAD3[el], color: CPK[el], seed: 7 + i }); sc.add(a.group); atoms.push(a); }
    var bonds = { HH: [], OO: [], OH: [] };
    [["HH", 1, 2], ["OO", 2, 1], ["OH", 1, 4]].forEach(function (q) { for (var j = 0; j < q[2]; j++) { var b = FX.makeBond(THREE, { order: q[1], radius: 0.07, color: "#9aa4b2", seed: 3 }); sc.add(b.group); bonds[q[0]].push(b); } });
    return { cv: cv, r: r, sc: sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40), glow: glow, blob: blob, atoms: atoms, bonds: bonds, w: 0, v: new THREE.Vector3() };
  }
  function resize3() {
    var w = S3.cv.clientWidth; if (!w) return false;
    var h = Math.round(w * 420 / 640), hh = 4.2, c = S3.cam;   /* 좌우 배치(10-24)로 칸이 좁아져 당김 — 빛의 가장 바깥 흐린 테만 잘린다 */
    S3.cv.style.height = h + "px"; S3.r.setSize(w, h, false); S3.w = w;
    c.left = -hh * w / h; c.right = hh * w / h; c.top = hh; c.bottom = -hh; c.position.set(3.4, 2.3, 10.4); c.lookAt(0, 0, 0); c.updateProjectionMatrix();
    return true;
  }
  function scr3(p) { var v = S3.v.set(p[0], p[1], p[2]).project(S3.cam); return { x: (v.x + 1) / 2 * S3.cv.clientWidth, y: (1 - v.y) / 2 * S3.cv.clientHeight }; }
  function render3() {
    if (!S3 || st.tab !== 3) return;
    if (S3.cv.clientWidth !== S3.w && !resize3()) return;
    var n = st.t3.coef, p = st.t3.p, A = atoms3At(n, p), pos = A.pos, Bs = bonds3(n), V3 = function (q) { return new THREE.Vector3(q[0], q[1], q[2]); };
    var env3 = RM ? 0 : motionEnv(p), key3 = "t3_" + n;   /* 반응 전 분자 운동(결정 32) */
    if (env3 > 0) motionOf(key3).groups.forEach(function (g, gi) { var Mv = motionAt(key3, gi, st.t3.mt, env3);
      g.members.forEach(function (mb, qi) { var q = g.pos[qi], d = moveBy(q, Mv), a = pos[mb[1]]; pos[mb[1]] = [a[0] + d[0] - q[0], a[1] + d[1] - q[1], a[2] + d[2] - q[2]]; }); });
    S3.atoms.forEach(function (a, k) { var on = k < n * 3 && !(k === 0 && A.halfO < 0.02); a.group.visible = on; if (!on) return; a.group.position.set(pos[k][0], pos[k][1], pos[k][2]); a.setOpacity(k % 3 === 0 ? A.halfO : 1); });
    var used = { HH: 0, OO: 0, OH: 0 }, shown = { HH: 0, OO: 0, OH: 0 };
    Bs.forEach(function (b) {
      var obj = S3.bonds[b[2]][used[b[2]]++], al = b[2] === "OH" ? A.bondW : A.bondR;   /* O–H 불투명도 = 나간 열 비율(×1 도 — S-검토 R3 B-3) */
      obj.group.visible = al > 0.02; if (!obj.group.visible) return; shown[b[2]]++;
      obj.setEnds(V3(pos[b[0]]), V3(pos[b[1]])); obj.setOpacity(al);
    });
    Object.keys(S3.bonds).forEach(function (kind) { for (var j = used[kind]; j < S3.bonds[kind].length; j++) S3.bonds[kind][j].group.visible = false; });
    S3.blob.group.position.set(0, n === 2 ? -0.5 : -0.45, 0); S3.blob.group.scale.setScalar(n === 2 ? 1 : 0.72); S3.blob.setState({ opacity: A.blob });
    var gs = glow3(heat3(n, p)); S3.glow.setState({ extent: gs.extent, strength: gs.strength, ring: null, t: 0 });
    S3.r.render(S3.sc, S3.cam);
    /* 검사 창구 — 실제로 장면에 놓인 것(렌더 원천 표본화) */
    drawn3 = { glow: gs, atoms: S3.atoms.map(function (a) { return a.group.visible ? [a.group.position.x, a.group.position.y, a.group.position.z] : null; }), bonds: shown };
    var lh = $("lblHalf3"), ls = $("lblSys3");
    if (n === 1 && A.halfO < 1) { var qh = scr3(places3(1).R[0]); lh.classList.remove("is-hidden"); lh.style.opacity = String(1 - A.halfO); lh.style.left = (qh.x - lh.offsetWidth / 2) + "px"; lh.style.top = (qh.y - lh.offsetHeight / 2) + "px"; }
    else lh.classList.add("is-hidden");
    var qs = scr3([-BOX3.w / 2, BOX3.h / 2, BOX3.d / 2]); ls.style.left = qs.x + "px"; ls.style.top = (qs.y - 30) + "px";
  }

  /* ================= 3D 무대 ================= */
  var T3 = null, UP = null;
  function pillow(THREE, w, h, d) {   /* 자리 표시 파우치 — 가장자리로 갈수록 얇아지는 상자(Astra 에셋 도착 전) */
    var g = new THREE.BoxGeometry(w, h, d, 18, 22, 1), P = g.attributes.position, i;
    for (i = 0; i < P.count; i++) {
      var x = P.getX(i) / (w / 2), y = P.getY(i) / (h / 2), z = P.getZ(i), m = Math.max(Math.abs(x), Math.abs(y));
      P.setZ(i, z * Math.max(0.12, 1 - Math.pow(m, 6)));
    }
    g.computeVertexNormals(); return g;
  }
  function makePack(THREE, k) {   /* 인터페이스 {group, setState(s)} — Codex 모듈(window.ENTH_FX)이 있으면 그것을 쓰고, 없으면 자리 표시 */
    if (window.ENTH_FX && ENTH_FX.contract === 1) return makePackFX(THREE, k);
    var grp = new THREE.Group(), w = k === "hw" ? 2.6 : 3.0, h = k === "hw" ? 3.4 : 3.6, d = k === "hw" ? 0.5 : 0.6;
    var mat = new THREE.MeshStandardMaterial({ color: k === "hw" ? PAL.pouchHw : PAL.pouchCp, roughness: k === "hw" ? 0.95 : 0.35, metalness: 0,
      transparent: k === "cp", opacity: k === "cp" ? 0.55 : 1, depthWrite: k !== "cp" });
    var body = new THREE.Mesh(pillow(THREE, w, h, d), mat); body.castShadow = true; body.position.y = h / 2; grp.add(body);
    var inner = null, gran = null, drops = [], frost = [], i;
    if (k === "cp") {
      inner = new THREE.Mesh(pillow(THREE, w * 0.72, h * 0.34, d * 0.7), new THREE.MeshStandardMaterial({ color: PAL.innerCp, roughness: 0.2, transparent: true, opacity: 0.75 }));
      inner.position.set(0, h * 0.68, 0); grp.add(inner);
      var gm = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }), gg = new THREE.BoxGeometry(0.09, 0.09, 0.09);
      gran = new THREE.Group();
      for (i = 0; i < 70; i++) { var gr = new THREE.Mesh(gg, gm); gr.position.set((((i * 37) % 100) / 100 - 0.5) * w * 0.75, 0.25 + ((i * 53) % 100) / 100 * h * 0.35, (((i * 71) % 100) / 100 - 0.5) * d * 0.5); gr.rotation.set(i, i * 2, 0); gran.add(gr); }
      grp.add(gran);
    }
    var dm = new THREE.MeshStandardMaterial({ color: "#e0f2fe", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }), dg = new THREE.SphereGeometry(0.05, 8, 6);
    var fm = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), fg = new THREE.CircleGeometry(0.035, 6);
    for (i = 0; i < 26; i++) {
      var px = (((i * 41) % 100) / 100 - 0.5) * w * 0.8, py = 0.3 + ((i * 67) % 100) / 100 * h * 0.85;
      var dr = new THREE.Mesh(dg, dm); dr.position.set(px, py, d * 0.5 * 0.95 + 0.02); dr.scale.set(1, 1.3, 0.6); grp.add(dr); drops.push(dr);
      var fr = new THREE.Mesh(fg, fm); fr.position.set(px * 0.9 + 0.1, py * 0.97, d * 0.5 + 0.03); grp.add(fr); frost.push(fr);
    }
    /* 탐침 온도계(규칙적 형태 → 코드 생성 · §1-3 ③ 2순위): 위에서 비스듬히 팩 «안쪽»으로 */
    var therm = new THREE.Group();
    var probe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 10), new THREE.MeshStandardMaterial({ color: "#9aa4ae", metalness: 0.8, roughness: 0.3 }));
    probe.position.set(w * 0.22, h * 0.95, 0); therm.add(probe);
    var disp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.16), new THREE.MeshStandardMaterial({ color: "#1f2328", roughness: 0.5 }));
    disp.position.set(w * 0.22, h * 0.95 + 1.42, 0); therm.add(disp);
    grp.add(therm);
    var hand = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: PAL.hand, transparent: true, opacity: 0.22, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    hand.scale.set(w * 0.75, h * 0.62, 1); hand.position.set(0, h * 0.48, -d * 0.6); grp.add(hand);
    return {
      group: grp, w: w, h: h, d: d, disp: disp,
      setState: function (s) {
        var thermOn = !!s.thermColor;
        mat.color.set(thermOn ? s.thermColor : (k === "hw" ? PAL.pouchHw : PAL.pouchCp));
        mat.opacity = k === "cp" && !thermOn ? 0.55 : 1; mat.transparent = k === "cp" && !thermOn; mat.depthWrite = !mat.transparent;
        if (inner) { inner.scale.set(1, s.burst ? 0.18 : 1, s.burst ? 0.35 : 1); inner.material.opacity = s.burst ? 0.3 : 0.75; inner.visible = !thermOn; }
        if (gran) gran.visible = !thermOn && !s.burst;
        drops.forEach(function (m) { m.visible = s.cue === "dew" && !thermOn; });
        frost.forEach(function (m) { m.visible = s.cue === "frost" && !thermOn; });
        therm.visible = !!s.therm; hand.visible = !!s.held;
        hand.material.color.set(thermOn ? PAL.therm[thermBucket(ENTH.HAND)] : PAL.hand); hand.material.opacity = thermOn ? 0.5 : 0.22;
        grp.rotation.z = s.shake || 0;
      }
    };
  }
  /* Codex 팩 + 손 + (코드) 온도계 — makePack 과 같은 인터페이스 */
  function makePackFX(THREE, k) {
    var grp = new THREE.Group(), w = k === "hw" ? 2.6 : 3.0, h = k === "hw" ? 3.4 : 3.6, d = k === "hw" ? 0.5 : 0.6;
    var fx = k === "hw" ? ENTH_FX.makeHandWarmer(THREE, { w: w, h: h, d: d, seed: 1194 }) : ENTH_FX.makeColdPack(THREE, { w: w, h: h, d: d, seed: 1194 });
    grp.add(fx.group);
    var hand = ENTH_FX.makeHand(THREE, { w: w, h: h, seed: 7 });
    hand.group.position.set(0, -0.15, -0.35); if (k === "cp") hand.group.scale.x = -1;   /* 두 번째 손은 거울(발주 2.3) */
    grp.add(hand.group);
    var therm = new THREE.Group();
    var probe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 10), new THREE.MeshStandardMaterial({ color: "#9aa4ae", metalness: 0.8, roughness: 0.3 }));
    probe.position.set(w * 0.22, h * 0.95, 0); therm.add(probe);
    var disp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.16), new THREE.MeshStandardMaterial({ color: "#1f2328", roughness: 0.5 }));
    disp.position.set(w * 0.22, h * 0.95 + 1.42, 0); therm.add(disp); grp.add(therm);
    fx.group.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return {
      group: grp, w: w, h: h, d: d, disp: disp,
      setState: function (s) {
        fx.setState({ thermColor: s.thermColor || null, burst: !!s.burst, cue: s.cue || "none" });
        therm.visible = !!s.therm; hand.group.visible = !!s.held;
        hand.setState({ opacity: s.thermColor ? 0.55 : 0.35, thermColor: s.thermColor ? PAL.therm[thermBucket(ENTH.HAND)] : null });
        grp.rotation.z = s.shake || 0;
      }
    };
  }
  /* 입자 하나 — Codex makeParticle(모양·재질) + 다원자 이온에는 반투명 «이온 구»(맞닿은 공 — 사용자 결정 16 · 통합 판단 2026-10-24) */
  var particleProto = {};
  var CPK = { N: "#3050f8", O: "#ff0d0d", H: "#ffffff" };   /* 원소 관례색(CPK) — 이온 속 원자도 같은 색(S-검토 R1 A-4 · 매뉴얼 P6 C5) */
  function particleMesh(THREE, el, ghost) {
    var key = el + (ghost ? "g" : "");
    if (!particleProto[key]) {
      var g;
      if (window.ENTH_FX && ENTH_FX.contract === 1) {
        var P = ENTH_FX.makeParticle(THREE, { el: el, radius: RAD[el], color: PAL[el], seed: 11 }); g = P.group;
        if (el === "NH4" || el === "NO3" || el === "H2O") g.traverse(function (m) {   /* 호출부 재착색 — Codex 블록(H-2 잠금)은 건드리지 않는다 */
          var r = m.userData && m.userData.atomRole; if (!r || !m.material) return;
          var c = r === "N" ? CPK.N : (r.charAt(0) === "O" ? CPK.O : (r.charAt(0) === "H" ? CPK.H : null)); if (c) m.material.color.set(c);
        });
        if (el === "NH4" || el === "NO3") {
          var env = new THREE.Mesh(new THREE.SphereGeometry(RAD[el], 24, 16), new THREE.MeshStandardMaterial({ color: PAL[el], roughness: 0.35, transparent: true, opacity: 0.38, depthWrite: false }));
          env.name = "ion-envelope"; g.add(env);
        }
        if (ghost) P.setOpacity(0.3);
      } else {
        g = new THREE.Mesh(new THREE.SphereGeometry(RAD[el], 24, 16), new THREE.MeshStandardMaterial({ color: PAL[el], roughness: 0.45, metalness: el === "Fe" ? 0.35 : 0.05, transparent: !!ghost, opacity: ghost ? 0.3 : 1, depthWrite: !ghost }));
      }
      particleProto[key] = g;
    }
    var obj = particleProto[key].clone();   /* 지오메트리 공유(성능 §10) */
    if (ghost) obj.traverse(function (m) { if (m.material) m.material = m.material.clone(); });   /* 표지는 재질을 따로 — 공유하면 생성물 표지의 α 0 이 반응물 표지를 덮어쓴다(S-검토 R1 A-3) */
    return obj;
  }
  function setGhostAlpha(obj, a) { obj.traverse(function (m) { if (m.material) { m.material.opacity = m.name === "ion-envelope" ? Math.min(a, 0.1) : a;   /* 표지 이온 구는 실제(0.38)보다 훨씬 흐리게(B-3) */ m.material.transparent = true; m.material.depthWrite = false; } }); }

  /* 손난로 «주변 물질» 표지(결정 27) — 수백 개라 InstancedMesh 4개로 그린다(그리기 호출 4 · 성능 §10). 위치·이웃은 계산부 fieldHW */
  function makeField(THREE, sc, G) {
    var dm = new THREE.Object3D(), mats = [], ims = {}, dyn = [], tA = new THREE.Vector3(), tB = new THREE.Vector3(), tD = new THREE.Vector3(), perp = new THREE.Vector3(), Zv = new THREE.Vector3(0, 0, 1);
    function inst(name, geo, color, n) {
      var m = new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
      var im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.count = n; im.frustumCulled = false; im.name = "field-" + name; sc.add(im); mats.push(m); ims[name] = im; return im;
    }
    function setCyl(im, idx, a, b, r) {
      tA.set(a[0], a[1], a[2]); tB.set(b[0], b[1], b[2]); tD.subVectors(tB, tA); var len = tD.length();
      dm.position.copy(tA).addScaledVector(tD, 0.5); dm.quaternion.setFromUnitVectors(UP, tD.normalize()); dm.scale.set(r, len, r); dm.updateMatrix(); im.setMatrixAt(idx, dm.matrix);
    }
    ["Fe", "O"].forEach(function (el) {
      var list = G.R.filter(function (g) { return g.el === el; }), im = inst(el, new THREE.SphereGeometry(RAD[el], 12, 8), PAL[el], list.length);   /* 흐린 구 626개 — 분할 18×12 → 12×8(정점 약 ⅓ · S-검토 R3 B-9) */
      list.forEach(function (g, n) { dm.position.set(g.pos[0], g.pos[1], g.pos[2]); dm.quaternion.identity(); dm.scale.set(1, 1, 1); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); });
      im.instanceMatrix.needsUpdate = true;
    });
    var cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1), fe = G.bondsR.filter(function (b) { return b[2] === "FeFe"; }), oo = G.bondsR.filter(function (b) { return b[2] === "OO"; });
    var imL = inst("FeFe", cyl, PAL.bond.FeFe, fe.length), imO = inst("OO", cyl, PAL.bond.OO, oo.length * 2);
    fe.forEach(function (b, n) { if (b[1] < 0) dyn.push({ n: n, g: b[0], a: -1 - b[1] }); else setCyl(imL, n, G.R[b[0]].pos, G.R[b[1]].pos, 0.04); });
    function placeOO(n, a, c) {   /* O=O 이중 막대 — 안쪽 분자와 같은 모양 */
      tD.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); perp.crossVectors(tD, Zv).normalize().multiplyScalar(0.11);
      setCyl(imO, 2 * n, [a[0] + perp.x, a[1] + perp.y, a[2]], [c[0] + perp.x, c[1] + perp.y, c[2]], 0.06);
      setCyl(imO, 2 * n + 1, [a[0] - perp.x, a[1] - perp.y, a[2]], [c[0] - perp.x, c[1] - perp.y, c[2]], 0.06);
    }
    oo.forEach(function (b, n) { placeOO(n, G.R[b[0]].pos, G.R[b[1]].pos); });
    var oList = []; G.R.forEach(function (g, gi) { if (g.el === "O") oList.push(gi); });
    imL.instanceMatrix.needsUpdate = true; imO.instanceMatrix.needsUpdate = true;
    var moved = false;
    return {
      update: function (al, P, GP) {   /* al = 계산부 ghostAlpha · P = 안쪽 원자의 지금 자리 · GP = 움직인 표지 자리(분자 운동 · 없으면 null) */
        var vis = al > 0.01;
        if (vis && GP) {
          oList.forEach(function (gi, n) { var q = GP[gi]; dm.position.set(q[0], q[1], q[2]); dm.quaternion.identity(); dm.scale.set(1, 1, 1); dm.updateMatrix(); ims.O.setMatrixAt(n, dm.matrix); });
          oo.forEach(function (b, n) { placeOO(n, GP[b[0]], GP[b[1]]); }); ims.O.instanceMatrix.needsUpdate = true; imO.instanceMatrix.needsUpdate = true; moved = true;
        } else if (vis && moved) { oList.forEach(function (gi, n) { var q = G.R[gi].pos; dm.position.set(q[0], q[1], q[2]); dm.quaternion.identity(); dm.scale.set(1, 1, 1); dm.updateMatrix(); ims.O.setMatrixAt(n, dm.matrix); });
          oo.forEach(function (b, n) { placeOO(n, G.R[b[0]].pos, G.R[b[1]].pos); }); ims.O.instanceMatrix.needsUpdate = true; imO.instanceMatrix.needsUpdate = true; moved = false; }
        Object.keys(ims).forEach(function (k) { ims[k].visible = vis; });
        mats.forEach(function (m) { m.opacity = al; });
        if (vis && dyn.length) { dyn.forEach(function (d) { setCyl(imL, d.n, G.R[d.g].pos, P[d.a], 0.04); }); imL.instanceMatrix.needsUpdate = true; }
      },
      opacity: function () { return [ims.Fe, ims.O].map(function (im) { return im.visible ? im.material.opacity : 0; }); },
      count: function () { return { Fe: ims.Fe.count, O: ims.O.count, FeFe: ims.FeFe.count, OOsticks: ims.OO.count }; },
      oScene: function () { var o = [], m = new THREE.Matrix4(), v = new THREE.Vector3(); for (var n = 0; n < ims.O.count; n++) { ims.O.getMatrixAt(n, m); v.setFromMatrixPosition(m); o.push([v.x, v.y, v.z]); } return o; }
    };
  }
  function makeMicro(THREE, k) {   /* 입자 장면 — 위치는 계산부(atomPos · ghostsOf), 그림은 여기 */
    var L = layoutOf(k), G = ghostsOf(k), sc = new THREE.Scene(), i;
    sc.background = new THREE.Color(PAL.stageDark);
    sc.add(new THREE.HemisphereLight("#ffffff", "#334155", 0.85));
    var key = new THREE.DirectionalLight("#ffffff", 1.0); key.position.set(4, 8, 10); sc.add(key);
    var sph = new THREE.SphereGeometry(1, 24, 16), cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
    var matEl = {}, matGhost = {};
    ["Fe", "O", "NH4", "NO3", "H2O"].forEach(function (e) {
      matEl[e] = new THREE.MeshStandardMaterial({ color: PAL[e], roughness: 0.45, metalness: e === "Fe" ? 0.35 : 0.05 });
      matGhost[e] = new THREE.MeshStandardMaterial({ color: PAL[e], roughness: 0.6, transparent: true, opacity: 0.3, depthWrite: false });
    });
    var atoms = L.atoms.map(function (a) { var m = particleMesh(THREE, a.el, false); sc.add(m); return m; });
    var bondMat = {}, bondMeshes = [];
    function bmat(kind) { if (!bondMat[kind]) bondMat[kind] = new THREE.MeshStandardMaterial({ color: PAL.bond[kind], roughness: 0.5, transparent: true, opacity: 1, depthWrite: false }); return bondMat[kind]; }
    function addBond(b, isProduct) {
      var kind = b[2], pieces = kind === "hyd" ? 3 : (ROD[kind] ? 2 : 1), list = [];
      for (var q = 0; q < pieces; q++) { var m = new THREE.Mesh(cyl, bmat(kind)); sc.add(m); list.push(m); }
      bondMeshes.push({ a: b[0], b: b[1], kind: kind, prod: isProduct, meshes: list });
    }
    L.bondsR.forEach(function (b) { addBond(b, false); });
    L.bondsP.forEach(function (b) { addBond(b, true); });
    /* «잘라 낸 일부» 표지 — 흐린 이웃 입자 + 흐린 이웃선 */
    var ghostMeshes = [];
    function addGhosts(list, isProduct) {
      list.forEach(function (g) {
        var m = particleMesh(THREE, g.el, true); m.position.set(g.pos[0], g.pos[1], g.pos[2]); sc.add(m);
        var link = new THREE.Mesh(cyl, new THREE.MeshStandardMaterial({ color: PAL.bond[k === "hw" ? (isProduct ? "FeO" : "FeFe") : "ion"], transparent: true, opacity: 0.3, depthWrite: false })); sc.add(link);
        ghostMeshes.push({ g: g, prod: isProduct, mesh: m, link: link });
      });
    }
    var field = G.bondsR ? makeField(THREE, sc, G) : null;
    if (!field) addGhosts(G.R, false);
    addGhosts(G.P, true);
    var tA = new THREE.Vector3(), tB = new THREE.Vector3(), tD = new THREE.Vector3(), perp = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    function placeCyl(m, a, b, r) {
      tA.set(a[0], a[1], a[2]); tB.set(b[0], b[1], b[2]); tD.subVectors(tB, tA); var len = tD.length();
      if (len < 1e-6) { m.visible = false; return; }
      m.visible = true; m.position.copy(tA).addScaledVector(tD, 0.5); m.quaternion.setFromUnitVectors(UP, tD.clone().normalize()); m.scale.set(r, len, r);
    }
    return {
      scene: sc, L: L,
      bounds: k === "hw" ? { halfW: 7.4, halfH: 3.4 } : { halfW: 5.6, halfH: 4.4 },
      update: function (p, mt) {
        var P = L.atoms.map(function (a) { return atomPos(a, p); }), env = RM ? 0 : motionEnv(p), GP = null;
        /* 반응 전 분자 운동(결정 32) — 기체·액체 분자만 · 자리 차이(d − 집)를 더한다 · p ≥ MOTION.settle 이면 0 */
        if (env > 0) { GP = G.R.map(function (g) { return g.pos; });
          motionOf(k).groups.forEach(function (g, gi) { var Mv = motionAt(k, gi, mt || 0, env);
            g.members.forEach(function (mb, qi) { var q = g.pos[qi], d = moveBy(q, Mv);
              if (mb[0] === "a") P[mb[1]] = [P[mb[1]][0] + d[0] - q[0], P[mb[1]][1] + d[1] - q[1], P[mb[1]][2] + d[2] - q[2]]; else GP[mb[1]] = d; });
            if (k === "cp") atoms[g.members[0][1]].rotation.set(Mv.spin[0] * env, Mv.spin[1] * env, Mv.spin[2] * env); }); }
        else if (k === "cp") atoms.forEach(function (m) { m.rotation.set(0, 0, 0); });
        atoms.forEach(function (m, n) { m.position.set(P[n][0], P[n][1], P[n][2]); });
        Object.keys(bondMat).forEach(function (kind) { bondMat[kind].opacity = bondAlpha(kind === "FeO" || kind === "hyd", p); });
        bondMeshes.forEach(function (bm) {
          var a = P[bm.a], b = P[bm.b], al = bondAlpha(bm.prod, p);
          if (al < 0.02) { bm.meshes.forEach(function (m) { m.visible = false; }); return; }
          if (bm.meshes.length === 2) {   /* O=O 이중 막대(결합봉은 공유 결합뿐 — ROD) */
            tD.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); perp.crossVectors(tD, Z); if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0); perp.normalize().multiplyScalar(0.11);
            placeCyl(bm.meshes[0], [a[0] + perp.x, a[1] + perp.y, a[2] + perp.z], [b[0] + perp.x, b[1] + perp.y, b[2] + perp.z], 0.07);
            placeCyl(bm.meshes[1], [a[0] - perp.x, a[1] - perp.y, a[2] - perp.z], [b[0] - perp.x, b[1] - perp.y, b[2] - perp.z], 0.07);
          } else if (bm.meshes.length === 3) {   /* 수화 인력 — 짧은 점선 */
            for (var q = 0; q < 3; q++) { var u0 = 0.12 + q * 0.28, u1 = u0 + 0.16;
              placeCyl(bm.meshes[q], [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, a[2] + (b[2] - a[2]) * u0], [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, a[2] + (b[2] - a[2]) * u1], 0.035); }
          } else placeCyl(bm.meshes[0], a, b, 0.05);   /* 금속·이온 사이: 얇은 이웃선(막대 아님 — 사용자 결정 16) */
        });
        if (field) field.update(ghostAlpha(false, p), P, GP);
        ghostMeshes.forEach(function (gm) {
          var al = ghostAlpha(gm.prod, p), tgt = P[gm.g.link];
          gm.mesh.visible = gm.link.visible = al > 0.01;
          setGhostAlpha(gm.mesh, al); gm.link.material.opacity = al;
          if (al > 0.01) placeCyl(gm.link, gm.g.pos, tgt, 0.04);
        });
      },
      /* 검사 창구: 지금 장면에 «보이는» 결합 종류와 수(렌더 원천 표본화 — F-1) */
      atomPos: function () { return atoms.map(function (m) { return [m.position.x, m.position.y, m.position.z]; }); },
      fieldO: function () { return field ? field.oScene() : null; },
      visibleBonds: function () { var o = {}; bondMeshes.forEach(function (bm) { if (bm.meshes[0].visible) o[bm.kind] = (o[bm.kind] || 0) + 1; }); return o; },
      /* 원자 역할별 «실제» 재질 색(렌더 원천 표본화 — R1 A-4 재발 방지) */
      roleColors: function () { var o = {}; sc.traverse(function (m) { var r = m.userData && m.userData.atomRole; if (r && m.material) { var key = r.replace(/[0-9]/g, ""); (o[key] = o[key] || {})["#" + m.material.color.getHexString()] = 1; } }); Object.keys(o).forEach(function (k) { o[k] = Object.keys(o[k]); }); return o; },
      /* 표지 공의 «실제» 재질 불투명도(렌더 원천 표본화 — A-3 재발 방지) */
      ghostOpacity: function () { var o = { R: field ? field.opacity() : [], P: [] }; ghostMeshes.forEach(function (gm) { var a = 1; gm.mesh.traverse(function (m) { if (m.material && m.name !== "ion-envelope") a = Math.min(a, m.material.opacity); }); o[gm.prod ? "P" : "R"].push(gm.mesh.visible ? a : 0); }); return o; }
    };
  }
  function buildStage() {
    var cv = $("stage"), ctx = null;
    if (QS.fallback === "1" || typeof THREE === "undefined") return null;
    try { ctx = cv.getContext("webgl", { antialias: true }); } catch (e) { ctx = null; }
    if (!ctx) return null;
    UP = new THREE.Vector3(0, 1, 0);
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;   /* r147: hex 를 sRGB 로(4부 ㉜) */
    var renderer = new THREE.WebGLRenderer({ canvas: cv, context: ctx, antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var sc = new THREE.Scene(); sc.background = new THREE.Color("#ffffff");
    sc.add(new THREE.HemisphereLight("#ffffff", "#c9d6e2", 0.8));
    var key = new THREE.DirectionalLight("#ffffff", 1.1); key.position.set(6, 14, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -4; key.shadow.camera.near = 2; key.shadow.camera.far = 40; key.shadow.camera.updateProjectionMatrix();
    sc.add(key); var fill = new THREE.DirectionalLight("#dfe9f3", 0.45); fill.position.set(-8, 5, 6); sc.add(fill);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.ShadowMaterial({ opacity: 0.22 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    var packs = { hw: makePack(THREE, "hw"), cp: makePack(THREE, "cp") };
    packs.hw.group.position.set(-3.1, 0, 0); packs.cp.group.position.set(3.1, 0, 0);
    packs.hw.group.rotation.x = packs.cp.group.rotation.x = -0.08;
    sc.add(packs.hw.group); sc.add(packs.cp.group);
    var cam = new THREE.PerspectiveCamera(36, 1, 0.1, 200), mcam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    return { cv: cv, renderer: renderer, scene: sc, packs: packs, cam: cam, mcam: mcam, micro: { hw: makeMicro(THREE, "hw"), cp: makeMicro(THREE, "cp") },
             orbit: { yaw: 0, pitch: 0.28, dist: 13.6, target: [0, 2.3, 0] }, morbit: { yaw: 0.35, pitch: 0.25 } };
  }
  function resize() {
    if (!T3) return;
    var w = T3.cv.clientWidth, h = T3.cv.clientHeight; if (w < 8 || h < 8) return;
    T3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); T3.renderer.setSize(w, h, false);
    T3.cam.aspect = T3.mcam.aspect = w / h;
    /* 좁은 화면: 두 팩(가로 반폭 6.0)이 다 들어오게 세로 시야를 넓힌다(원칙 13 — 고정 각 아님) */
    var need = 2 * Math.atan(6.4 / T3.orbit.dist), hf = 2 * Math.atan(Math.tan(36 * Math.PI / 360) * w / h);
    T3.cam.fov = hf >= need ? 36 : 2 * Math.atan(Math.tan(need / 2) * h / w) * 180 / Math.PI;
    T3.cam.updateProjectionMatrix(); T3.mcam.updateProjectionMatrix();
    if (rafId === null) render(0);
  }
  function bindOrbit(cv) {   /* 드래그 회전(사용자 원 요청 · P-검토 A-1) — 좌우 ±40° · 확대 중 고정 */
    var down = null;
    cv.addEventListener("pointerdown", function (e) { if (st.tab === 3) return; down = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener("pointermove", function (e) {
      if (!down) return;
      var micro = st.tab === 2 && st.t2.zoom && st.t2.zf >= 1, o = micro ? T3.morbit : T3.orbit;
      if (st.tab === 2 && st.t2.zoom && !micro) return;
      var lim = micro ? 1.2 : 0.7;
      o.yaw = Math.max(-lim, Math.min(lim, o.yaw - (e.clientX - down.x) * 0.005));
      o.pitch = Math.max(micro ? -0.6 : 0.05, Math.min(micro ? 0.9 : 0.62, o.pitch - (e.clientY - down.y) * 0.004));
      down.x = e.clientX; down.y = e.clientY;
      if (rafId === null) render(0);
    });
    cv.addEventListener("pointerup", function () { down = null; });
    cv.addEventListener("pointercancel", function () { down = null; });
  }
  function proj(v3, cam) {
    var p = new THREE.Vector3(v3[0], v3[1], v3[2]).project(cam);
    return { x: (p.x * 0.5 + 0.5) * T3.cv.clientWidth, y: (-p.y * 0.5 + 0.5) * T3.cv.clientHeight, ok: p.z <= 1 };
  }
  function placeLbl(id, xy, dx, dy) {
    var el = $(id); if (!el) return;
    if (!xy || !xy.ok) { el.classList.add("is-hidden"); return; }
    el.classList.remove("is-hidden");
    var w = T3.cv.clientWidth, h = T3.cv.clientHeight, ofs = $("overbars").classList.contains("is-hidden") ? 0 : $("overbars").offsetHeight;
    el.style.left = Math.max(4, Math.min(w - el.offsetWidth - 4, xy.x + (dx || 0) - el.offsetWidth / 2)) + "px";
    el.style.top = Math.max(4, Math.min(h - el.offsetHeight - 4, xy.y + (dy || 0) - el.offsetHeight / 2)) + ofs + "px";
  }
  function hideLbls() { ["lblThw", "lblTcp", "lblNhw", "lblNcp", "lblFhw", "lblFcp", "lblHand"].forEach(function (id) { $(id).classList.add("is-hidden"); }); }

  /* ---------- 렌더(그림만 · 시계는 loop) ---------- */
  var tDecor = 0, lastOverlay = "", drawn = { arrows: [], micro: null };   /* drawn = 지금 화면에 실제로 그린 것(프로브가 표본화) */
  function heatArrows(k, packObj, Tp, held, paused) {   /* 열 화살표 + 흐르는 점 — 방향·단계는 계산부 shownFlowDir/flowLevel 만 읽는다 */
    var s = surroundT(held), dir = shownFlowDir(k, Tp, held, paused), lev = dir ? flowLevel(Tp, s) : 0, g = packObj.group.position, w = packObj.w, h = packObj.h, o = "";
    drawn.arrows.push({ pack: k, dir: dir, level: lev });
    if (!dir) return "";
    var sides = [[[-w / 2 - 0.25, h * 0.55, 0], [-w / 2 - 1.45, h * 0.55, 0]], [[w / 2 + 0.25, h * 0.32, 0], [w / 2 + 1.45, h * 0.32, 0]], [[-w * 0.22, h + 0.25, 0], [-w * 0.22, h + 1.3, 0]]];
    sides.forEach(function (sd) {
      var a = proj([g.x + sd[0][0], g.y + sd[0][1], g.z + sd[0][2]], T3.cam), b = proj([g.x + sd[1][0], g.y + sd[1][1], g.z + sd[1][2]], T3.cam);
      var from = dir > 0 ? a : b, to = dir > 0 ? b : a, wd = 2 + lev * 1.5;
      o += arrowSVG(from.x, from.y, to.x, to.y, wd, PAL.heat);
      if (!RM) for (var q = 0; q <= lev; q++) { var u = ((tDecor * 0.7) + q / (lev + 1)) % 1; o += '<circle cx="' + (from.x + (to.x - from.x) * u).toFixed(1) + '" cy="' + (from.y + (to.y - from.y) * u - 9).toFixed(1) + '" r="4" fill="' + PAL.heat + '"/>'; }
    });
    return o;
  }
  function render(dt) {
    if (!T3) return;
    tDecor += dt || 0;
    drawn.arrows = []; drawn.micro = null;
    var svg = "", z = st.t2;
    if (st.tab === 2 && z.zoom) {   /* 확대 전환: 카메라가 팩으로 다가간 뒤 입자 장면 */
      if (z.zf < 1) z.zf = RM ? 1 : Math.min(1, z.zf + (dt || 0) / 0.6);
    }
    var micro = st.tab === 2 && z.zoom && z.zf >= 1;
    $("stageWrap").classList.toggle("is-dark", !!micro);
    $("overbars").classList.toggle("is-hidden", !(st.tab === 2 && z.zoom));
    T3.cv.classList.toggle("is-fixed", !!(st.tab === 2 && z.zoom && !micro));
    if (micro) {
      var M = T3.micro[z.zoom], mo = T3.morbit, half = Math.tan(T3.mcam.fov * Math.PI / 360), dist = Math.max(M.bounds.halfH / half, M.bounds.halfW / (half * T3.mcam.aspect)) + 3;
      T3.mcam.position.set(dist * Math.sin(mo.yaw) * Math.cos(mo.pitch), dist * Math.sin(mo.pitch), dist * Math.cos(mo.yaw) * Math.cos(mo.pitch)); T3.mcam.position.y -= 1.0; T3.mcam.lookAt(0, -1.0, 0);   /* 장면을 화면 위쪽으로(아래 안내 상자와 덜 겹치게) */
      M.update(z.p[z.zoom], z.mt);
      T3.renderer.render(M.scene, T3.mcam);
      drawn.micro = { pack: z.zoom, p: z.p[z.zoom], bonds: M.visibleBonds() };
      hideLbls();
      /* 에너지 출입 화살표(네 귀퉁이) — 끊는 동안 안쪽 · 만드는 동안 바깥쪽 · 굵기 = 값 비례 */
      var p = z.p[z.zoom], B = barsOf(z.zoom), w = T3.cv.clientWidth, h = T3.cv.clientHeight;
      var phz = z.play[z.zoom], arrowPh = phz === "run1" ? "in" : phz === "run2" ? "out" : (phz === "done" && p > 0.02 && p < 0.48 ? "in" : (phz === "done" && p > 0.52 && p < 0.98 ? "out" : null));
      /* 에너지 출입 화살표는 «끊는 중(안쪽)»·«만드는 중(바깥쪽)»에만 — 정지점에서는 그리지 않는다(정지점 ① p=0.5 에 «방출»이 그려지던 결함 · MF 육안) */
      if (arrowPh) {
        var inPh = arrowPh === "in", mxB = Math.max(sumKj(B.brk), sumKj(B.frm)), sw = 2 + 8 * (inPh ? sumKj(B.brk) : sumKj(B.frm)) / mxB;   /* 그 팩 안에서의 비(B-5) */
        [[24, 70], [w - 24, 70], [24, h - 24], [w - 24, h - 24]].forEach(function (c) {   /* 위쪽은 안내·배지 아래(겹침 방지) */
          var ix = c[0] < w / 2 ? c[0] + 52 : c[0] - 52, iy = c[1] < h / 2 ? c[1] + 30 : c[1] - 30;
          svg += inPh ? arrowSVG(c[0], c[1], ix, iy, sw, PAL.heat) : arrowSVG(ix, iy, c[0], c[1], sw, PAL.heat);
        });
      }
    } else {
      var o = T3.orbit, cam = T3.cam, tgt = o.target.slice(), dist2 = o.dist, yaw = o.yaw, pitch = o.pitch;
      if (st.tab === 2 && z.zoom) {   /* 다가가는 중 */
        var pk = T3.packs[z.zoom].group.position, f = z.zf;
        tgt = [tgt[0] + (pk.x - tgt[0]) * f, tgt[1] + (1.8 - tgt[1]) * f, 0]; dist2 = o.dist + (3.2 - o.dist) * f; yaw = yaw * (1 - f); pitch = pitch * (1 - f);
      }
      cam.position.set(tgt[0] + dist2 * Math.sin(yaw) * Math.cos(pitch), tgt[1] + dist2 * Math.sin(pitch), tgt[2] + dist2 * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(tgt[0], tgt[1], tgt[2]);
      ["hw", "cp"].forEach(function (k) {
        var P = T3.packs[k], t1 = st.tab === 1, Tp = t1 ? packNowT(k) : ENTH.PACK[k].T0;
        var shake = (k === "hw" && t1 && st.t1.hw.shake > 0 && !RM) ? Math.sin(tDecor * 38) * 0.12 * st.t1.hw.shake : 0;
        P.setState({ therm: t1, held: t1 && st.t1.held, burst: k === "cp" && (t1 ? st.t1.cp.on : st.t2.p.cp > 0), cue: t1 ? surfaceCue(Tp) : "none",
                     thermColor: t1 ? PAL.therm[thermBucket(Tp)] : null, shake: shake });   /* 탭 ① 열화상 항상(사용자 결정 21) */
      });
      T3.renderer.render(T3.scene, cam);
      if (st.tab === 1) {
        ["hw", "cp"].forEach(function (k) {
          var P = T3.packs[k], g = P.group.position, Tp = packNowT(k), pz = packPaused(k, st.t1[k].t, st.t1.held);
          if (st.t1.showFlow) svg += heatArrows(k, P, Tp, st.t1.held, pz);   /* 열 방향은 [열 방향 보기] 뒤에만(결정 36) */
          $("lblT" + k).textContent = fmt1(Tp) + " ℃";
          placeLbl("lblT" + k, proj([g.x + P.w * 0.22, g.y + P.h * 0.95 + 1.42, 0.2], cam), 0, -22);
          var showF = st.t1.showFlow || pz;   /* 숨김 중에도 «정지 상태»는 보인다 · 숨길 때는 글자도 비운다(화면 낭독기에도 답이 새지 않게) */
          $("lblF" + k).textContent = showF ? flowLabel(k, Tp, st.t1.held, pz) : "";
          if (showF) placeLbl("lblF" + k, proj([g.x, 0, 0.6], cam), 0, 20); else $("lblF" + k).classList.add("is-hidden");
          $("lblN" + k).textContent = ENTH.PACK[k].name;
          placeLbl("lblN" + k, proj([g.x - P.w * 0.2, g.y + P.h + 0.2, 0], cam), -40, -10);
        });
        if (st.t1.held) placeLbl("lblHand", proj([0, 0.4, 0], cam), 0, 0); else $("lblHand").classList.add("is-hidden");
      } else {
        ["lblThw", "lblTcp", "lblFhw", "lblFcp", "lblHand"].forEach(function (id) { $(id).classList.add("is-hidden"); });
        ["hw", "cp"].forEach(function (k) { var P = T3.packs[k], g = P.group.position; $("lblN" + k).textContent = ENTH.PACK[k].name + (st.t2.p[k] >= 1 ? " · 반응 후" : (st.t2.p[k] > 0 ? " · 반응 중" : " · 반응 전"));
          if (z.zoom) $("lblN" + k).classList.add("is-hidden"); else placeLbl("lblN" + k, proj([g.x, g.y + P.h + 0.3, 0], cam), 0, -10); });
      }
    }
    var obH = $("overbars").classList.contains("is-hidden") ? 0 : $("overbars").offsetHeight;   /* 무대 위 막대 아래로 안내·배지를 내린다(겹침 방지) */
    $("camHint").style.top = (obH + 12) + "px"; $("assetBadge").style.top = (obH + 12) + "px";
    var ov = $("overlay"); ov.setAttribute("viewBox", "0 0 " + T3.cv.clientWidth + " " + T3.cv.clientHeight);
    ov.style.top = ($("overbars").classList.contains("is-hidden") ? 0 : $("overbars").offsetHeight) + "px";
    ov.style.height = T3.cv.clientHeight + "px";
    if (svg !== lastOverlay) { ov.innerHTML = svg; lastOverlay = svg; }
  }

  /* ---------- 문구·패널 동기 ---------- */
  function sync() {
    var s1 = st.t1, hwT = packNowT("hw"), cpT = packNowT("cp");
    $("vThw").textContent = fmt1(hwT); $("vTcp").textContent = fmt1(cpT);
    $("vChw").textContent = Math.min(s1.hw.t, 10).toFixed(1); $("vCcp").textContent = Math.min(s1.cp.t, 2).toFixed(1);
    $("holdRo").classList.toggle("is-hidden", !s1.held); $("vHold").textContent = s1.tHold.toFixed(1);
    $("graph1").innerHTML = graphSVG(); $("ws1").innerHTML = wsTableHTML();
    var can = canHold(s1.hw.t, s1.cp.t);
    $("holdBtn").disabled = !can || s1.held; $("holdBtn").setAttribute("aria-pressed", String(s1.held));
    var pzHw = packPaused("hw", s1.hw.t, s1.held), pzCp = packPaused("cp", s1.cp.t, s1.held);
    var dHw = shownFlowDir("hw", hwT, s1.held, pzHw), dCp = shownFlowDir("cp", cpT, s1.held, pzCp), who = s1.held ? "손" : "공기";
    var eq = s1.held ? !holdClockRuns(s1.holdAt.cp, s1.tHold) : false;
    $("holdHint").textContent = s1.held ? (eq ? "냉각 팩과 손의 온도 차가 0.5 ℃보다 작아져 시계를 멈췄습니다 — 이제 열이 거의 흐르지 않습니다(열평형으로 봄)." : (s1.showFlow ? "손에 쥔 채로 시간이 흐릅니다 — 냉각 팩은 손에서 열을 받아 데워집니다." : "손에 쥔 채로 시간이 흐릅니다.")) : (can ? "이제 두 팩을 손에 쥘 수 있습니다." : "두 팩의 측정이 끝나면 손에 쥘 수 있습니다.");
    $("startHw").disabled = s1.hw.on; $("startCp").disabled = s1.cp.on;

    $("flowNote").innerHTML = (s1.showFlow ? "<b>열의 이동</b> — " + (pzHw ? "손난로 " : "") + flowLabel("hw", hwT, s1.held, pzHw) + " · " + (pzCp ? "냉각 팩 " : "") + flowLabel("cp", cpT, s1.held, pzCp) +
      "<br>열의 방향은 팩과 " + who + "의 온도 차로만 정해집니다." + (dHw && dCp && dHw !== dCp ? " 두 화살표는 같은 색이고 방향만 다릅니다." : " 열 화살표는 한 가지 색입니다.") + "<br>"
      : "<b>열의 이동</b> — [열 방향 보기]를 누르면 열의 이동 방향이 보입니다." + (pzCp ? " · 냉각 팩: 정지 상태" : "") + "<br>") +
      "팩의 색은 열화상(온도를 보이게 한 표현)입니다 — 파랑 → 빨강 = 낮은 온도 → 높은 온도.";
    $("lim9").textContent = s1.showFlow ? TXT.limits[9] : TXT.lim9Hidden;   /* 한계 ⑩ 은 열 방향을 말한다 — 숨김 중에는 가림(사용자 결정 38 · S-검토 R4 B-1) */
    $("flowBtn").setAttribute("aria-pressed", String(s1.showFlow)); $("flowBtn").textContent = s1.showFlow ? "열 방향 숨기기" : "열 방향 보기";
    var capOf = function (k, d) { var n = ENTH.PACK[k].name; if (k === "cp" ? pzCp : pzHw) return n + "은(는) 정지 상태"; return d > 0 ? n + "이(가) " + who + "보다 뜨거워 열이 " + n + " → " + who : (d < 0 ? n + "이(가) " + who + "보다 차가워 열이 " + who + " → " + n : n + "과(와) " + who + "의 온도가 " + (Math.abs(packNowT(k) - surroundT(s1.held)) < 0.05 ? "같아 열이 흐르지 않음" : "거의 같아 열이 거의 흐르지 않음")); };
    if (st.tab === 1 && !s1.showFlow && (s1.held || s1.hw.t >= ENTH.PACK.hw.tm || s1.cp.t >= ENTH.PACK.cp.tm)) $("stageCap").textContent = (s1.held ? "손에 쥐었습니다." : "측정이 끝난 팩이 있습니다.") + " [열 방향 보기]로 열의 이동을 확인할 수 있습니다.";   /* 방향은 숨김(결정 36) */
    else if (st.tab === 1 && (s1.held || s1.hw.t >= ENTH.PACK.hw.tm || s1.cp.t >= ENTH.PACK.cp.tm)) $("stageCap").textContent = (s1.held ? "손에 쥐었습니다 — " : "") + capOf("hw", dHw) + " · " + capOf("cp", dCp) + ".";   /* 열 방향에서 유도(J-N5 · S-검토 R1 A-1) */
    else if (st.tab === 1) $("stageCap").textContent = s1.held ? "" :
      (s1.hw.on || s1.cp.on ? "팩 안쪽 온도계가 온도를 잽니다 — 주변(공기 20 ℃)과 온도 차가 생기면 열이 흐르기 시작합니다." : "팩 아래 단추로 반응을 시작하세요.");
    $("camHint").textContent = st.tab === 2 && st.t2.zoom ? "↔ 드래그: 회전 · 입자 모형" : "↔ 드래그: 회전";
    /* 탭 ② */
    var z = st.t2, k = z.zoom || "hw", p = z.p[k], B = barsOf(k);
    $("zoomRow").style.display = st.tab === 2 && !z.zoom ? "" : "none";
    $("progBox").style.display = st.tab === 2 && z.zoom ? "" : "none"; $("progBox").classList.toggle("is-hidden", !(st.tab === 2 && z.zoom));
    $("prog").value = Math.round(p * 100); $("progVal").textContent = Math.round(p * 100) + " %";
    var ph = z.play[k], done = ph === "done";
    $("prog").disabled = !done; $("progHint").textContent = done ? "막대를 움직여 다시 볼 수 있습니다." : "자동 반응이 끝나면 막대로 다시 볼 수 있습니다.";
    $("playBox").classList.toggle("is-hidden", !(st.tab === 2 && z.zoom));
    $("playStart").textContent = k === "hw" ? "흔들기" : "내부 주머니 터뜨리기";
    $("playStart").classList.toggle("is-hidden", ph !== "idle"); $("playNext").classList.toggle("is-hidden", !(ph === "stop1" || ph === "stop2"));
    $("playReset").classList.toggle("is-hidden", !done);
    var Bk = barsOf(k);
    $("playMsg").textContent = ph === "idle" ? (k === "hw" ? "손난로를 흔들면 철 가루가 공기 중 산소와 반응합니다." : "내부 주머니를 터뜨리면 질산 암모늄이 물에 녹습니다.")
      : ph === "stop1" ? "정지점 ① 반응물의 결합이 모두 끊어졌습니다 — 이때 에너지 " + kjText(sumKj(Bk.brk), Bk.approx) + " kJ를 흡수했습니다."
      : ph === "stop2" ? "정지점 ② 새 결합이 모두 생겼습니다 — 이때 에너지 " + kjText(sumKj(Bk.frm), Bk.approx) + " kJ를 방출했습니다."
      : ph === "done" ? "흡수와 방출의 차이가 반응 엔탈피(ΔH = " + fmtKJ(Bk.dH) + ")입니다." : "";
    $("playMsg").classList.toggle("is-hidden", ph === "run1" || ph === "run2");
    $("zoomOther").textContent = (k === "hw" ? "냉각 팩" : "손난로") + " 확대하기";
    var reveal = done && p >= 1;
    $("eq2").innerHTML = B.eq + '　<span class="nw">ΔH = ' + (done ? fmtKJ(B.dH) : "?") + "</span>";   /* 공개(done) 뒤에는 되돌려 봐도 유지 — 안내 문구와 같은 조건(S-검토 R3 B-1) */ $("eqIon2").textContent = B.eqIon;   /* 반응식 칸의 ΔH 도 공개 뒤에만(S-검토 R2 A-1) */   /* ΔH·Ⅲ-2 꼴은 정지점 ② 뒤 「계속」을 눌러야 공개(사용자 결정 24) */
    $("diag2").innerHTML = stepSVG(k, p, reveal) + (reveal ? '<p class="hint" style="text-align:left;margin:8px 0 2px"><b>교과서 그림 Ⅲ-2 꼴</b> (축척이 위 도표와 다름)</p>' + foldSVG(k) : "");
    $("diagNote2").innerHTML = "세로축 «엔탈피»에는 눈금이 없습니다 — 엔탈피 자체는 재지 못하고 «변화»만 잽니다. 가운데 준위(결합이 다 끊어진 상태)는 실제 반응이 거치는 단계가 아닙니다." + (z.zoom ? "" : "<br><b>팩 아래 「확대하기」를 누르세요.</b>");
    /* 무대 위 막대의 «보임»은 여기(sync)서 정한다 — render 는 WebGL 이 없으면 돌지 않는다(폴백에서 막대가 사라졌던 결함 · MF 육안) */
    $("overbars").classList.toggle("is-hidden", !(st.tab === 2 && z.zoom));
    if (st.tab === 2) {
      $("overbars").innerHTML = z.zoom ? barsHTML(k, p) : "";
      $("stageCap").textContent = z.zoom ? progress(p).stage : "두 팩 중 하나를 골라 확대하세요.";
      var ion = k === "hw" && p >= 1;
      var lg = k === "hw" ? '<span class="item"><span class="swatch" style="background:' + PAL.Fe + '"></span>' + (ion ? "철 이온(Fe³⁺)" : "철 원자") + '</span><span class="item"><span class="swatch" style="background:' + PAL.O + '"></span>' + (ion ? "산화 이온(O²⁻)" : "산소 원자") + '</span>' +
          '<span class="item" style="color:' + PAL.bond.FeFe + '"><span class="line"></span><span style="color:var(--t2)">철 사이(금속 결합 · 이웃선)</span></span><span class="item" style="color:' + PAL.bond.OO + '"><span class="line dbl"></span><span style="color:var(--t2)">O=O(공유 결합 · 막대)</span></span><span class="item" style="color:' + PAL.bond.FeO + '"><span class="line"></span><span style="color:var(--t2)">Fe–O(이온 결정 · 이웃선)</span></span>'
        : '<span class="item"><span class="swatch" style="background:' + PAL.NH4 + '"></span>NH₄⁺ 이온 구</span><span class="item"><span class="swatch" style="background:' + PAL.NO3 + '"></span>NO₃⁻ 이온 구</span><span class="item"><span class="swatch" style="background:' + CPK.O + '"></span>O</span><span class="item"><span class="swatch" style="background:' + CPK.N + '"></span>N</span><span class="item"><span class="swatch" style="background:' + CPK.H + ';box-shadow:inset 0 0 0 1px #94a3b8"></span>H</span>' +
          '<span class="item" style="color:' + PAL.bond.OO + '"><span class="line"></span><span style="color:var(--t2)">이온 사이(이온 결정 · 이웃선)</span></span><span class="item" style="color:' + PAL.bond.FeO + '"><span class="line dash"></span><span style="color:var(--t2)">이온–물 인력(점선)</span></span>';
      $("legend2").innerHTML = z.zoom ? lg + (k === "cp" ? '<span class="item note-item">이온·물 분자 속 막대 = 그 안의 공유 결합(녹아도 끊어지지 않음)</span>' : "") +
        '<span class="item note-item">' + (k === "hw" && p < 0.5 ? "흐린 입자 = 둘레의 철과 산소(반응식에 세지 않음)" : "흐린 입자 = 바깥으로 이어지는 결정(세지 않음)") + '</span><span class="item note-item">이온 구·결합선의 색은 임의 색 · O 빨강 · N 파랑 · H 흰색은 원소 관례색</span><span class="item note-item">귀퉁이 주황 화살표 = 에너지 출입(굵기 = 이 팩 안에서의 크기)</span>' : "";
    }
    /* 탭 ③ */
    var t3 = st.t3, n3 = t3.coef, p3 = t3.p, ph3 = t3.play, Eg = eq3(n3, "g"), El = eq3(n3, "l"), Eat = eq3At(n3, p3), w3 = n3 === 2 ? "2H₂O" : "H₂O", run3 = ph3 === "run1" || ph3 === "run2";
    $("eq3").innerHTML = Eat ? Eat.text + '　<span class="nw">ΔH = ' + fmtKJ(Eat.dH) + "</span>" : (n3 === 2 ? "2H₂(g) + O₂(g)" : "H₂(g) + ½O₂(g)") + " → ?";   /* 정지점 ① 전에는 ΔH 를 보이지 않는다 */
    $("diag3").innerHTML = tab3Diag(n3, p3); $("mols3").innerHTML = tab3Mols(n3, p3);
    $("vHeat3").textContent = heat3(n3, p3).toFixed(1);
    $("vSum3").textContent = ph3 === "done" ? Eg.heat.toFixed(1) + " + " + (El.heat - Eg.heat).toFixed(1) + " = " + El.heat.toFixed(1) + " kJ" : "";
    $("rec3").innerHTML = rec3HTML(); $("note3").textContent = TXT.note3;
    $("playMsg3").innerHTML = ph3 === "idle" ? "[반응 시작]을 누르면 수소와 산소가 반응해 물이 생깁니다."
      : ph3 === "stop1" ? "<b>정지점 ①</b> 수증기(" + w3 + "(g))가 생겼습니다 — 지금까지 주위로 나간 열 <b class=\"heat\">" + Eg.heat.toFixed(1) + " kJ</b>"
      : ph3 === "done" ? "<b>정지점 ②</b> 수증기가 물(" + w3 + "(l))로 되며 열을 <b class=\"heat\">" + (El.heat - Eg.heat).toFixed(1) + " kJ</b> 더 방출했습니다 — 모두 <b class=\"heat\">" + El.heat.toFixed(1) + " kJ</b>"
      : ph3 === "run1" ? "결합이 끊어지면서 새 결합이 생기는 중 — 생길 때 나오는 에너지가 더 커서, 그 차이(알짜)만큼 열이 주위로 나갑니다." : "수증기가 모여 물이 되는 중…";
    $("play3Start").classList.toggle("is-hidden", ph3 !== "idle"); $("play3Next").classList.toggle("is-hidden", ph3 !== "stop1"); $("play3Reset").classList.toggle("is-hidden", ph3 !== "done");
    Array.prototype.forEach.call(document.querySelectorAll("[data-coef]"), function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-coef") === n3)); b.disabled = run3; });
    if (rafId === null) render(0);
  }

  /* ---------- 조작 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".tabb"), function (b) { b.addEventListener("click", function () { st.tab = +b.getAttribute("data-tab"); applyTab(); }); });
  $("startHw").addEventListener("click", function () { st.t1.hw.on = true; st.t1.hw.shake = 1; sync(); });
  $("startCp").addEventListener("click", function () { st.t1.cp.on = true; sync(); });
  $("flowBtn").addEventListener("click", function () { st.t1.showFlow = !st.t1.showFlow; sync(); });
  $("holdBtn").addEventListener("click", function () { if (canHold(st.t1.hw.t, st.t1.cp.t)) { st.t1.held = true; st.t1.holdAt = { hw: st.t1.hw.t, cp: st.t1.cp.t }; st.t1.tHold = 0; sync(); } });
  $("reset1").addEventListener("click", function () { st.t1 = { hw: { t: 0, on: false, shake: 0 }, cp: { t: 0, on: false }, held: false, holdAt: null, tHold: 0, therm: true, showFlow: false }; sync(); });
  function zoomTo(k) { st.t2.zoom = k; st.t2.zf = RM || !T3 ? 1 : 0; T3 && (T3.morbit.yaw = k === "cp" ? 0.6 : 0.35, T3.morbit.pitch = k === "cp" ? 0.5 : 0.25); sync(); }   /* 냉각 팩은 앞뒤 이온이 겹쳐 보이지 않는 시점(B-11) */
  $("playStart").addEventListener("click", function () { var k = st.t2.zoom; if (!k) return; st.t2.p[k] = 0; st.t2.play[k] = "run1"; if (RM) { st.t2.p[k] = PLAY.stops[0]; st.t2.play[k] = "stop1"; } sync(); });
  $("playNext").addEventListener("click", function () { var k = st.t2.zoom; if (!k) return; var ph = st.t2.play[k];
    if (ph === "stop1") { st.t2.play[k] = "run2"; if (RM) { st.t2.p[k] = PLAY.stops[1]; st.t2.play[k] = "stop2"; } } else if (ph === "stop2") st.t2.play[k] = "done"; sync(); });
  $("playReset").addEventListener("click", function () { var k = st.t2.zoom; if (!k) return; st.t2.p[k] = 0; st.t2.play[k] = "idle"; sync(); });
  $("zoomHw").addEventListener("click", function () { zoomTo("hw"); });
  $("zoomCp").addEventListener("click", function () { zoomTo("cp"); });
  $("zoomBack").addEventListener("click", function () { st.t2.zoom = null; st.t2.zf = 0; sync(); });
  $("zoomOther").addEventListener("click", function () { zoomTo(st.t2.zoom === "hw" ? "cp" : "hw"); st.t2.zf = 1; sync(); });
  $("prog").addEventListener("input", function () { var k = st.t2.zoom; if (!k || st.t2.play[k] !== "done") return; var v = snapP(+$("prog").value / 100); st.t2.p[k] = v; if (Math.abs(v * 100 - +$("prog").value) > 0.5) $("prog").value = Math.round(v * 100); sync(); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-coef]"), function (b) { b.addEventListener("click", function () { var t3 = st.t3; if (t3.play === "run1" || t3.play === "run2") return; t3.coef = +b.getAttribute("data-coef"); t3.p = 0; t3.play = "idle"; sync(); }); });
  $("play3Start").addEventListener("click", function () { st.t3.p = 0; st.t3.play = "run1"; sync(); });
  $("play3Next").addEventListener("click", function () { if (st.t3.play === "stop1") st.t3.play = "run2"; sync(); });
  $("play3Reset").addEventListener("click", function () { st.t3.p = 0; st.t3.play = "idle"; sync(); });

  /* ---------- 루프(rAF 하나 · 숨으면 정지 · 시계는 «보이는 프레임» dt 누적) ---------- */
  var rafId = null, lastT = null;
  /* 한 걸음(시계·자동 반응) — loop 와 프로브(ENTHVIEW.tick)가 같은 함수를 쓴다 */
  function advance(dt) {
    var s1 = st.t1, changed = false;
    if (!s1.held) ["hw", "cp"].forEach(function (k) { if (s1[k].on && packClockRuns(k, s1[k].t)) { s1[k].t += dt * ENTH.SEC_PER_MIN; changed = true; } });
    if (s1.hw.shake > 0) s1.hw.shake = Math.max(0, s1.hw.shake - dt / 0.9);
    if (s1.held && holdClockRuns(s1.holdAt.cp, s1.tHold)) { s1.tHold += dt * ENTH.SEC_PER_MIN; changed = true; }   /* 열평형이면 멈춘다(사용자 결정 23) */
    var z = st.t2, k = z.zoom;
    /* 자동 반응은 그 탭이 보일 때만 진행(S-검토 R2 B-5) · 분자 운동 시계도 보이는 탭만(결정 32 · RM 이면 멈춤) */
    if (st.tab === 2 && k && (z.play[k] === "run1" || z.play[k] === "run2")) { var r = playStep(z.p[k], RM ? 99 : dt, z.play[k]); z.p[k] = r.p; z.play[k] = r.phase; changed = true; }
    if (!RM && st.tab === 2 && k) z.mt += dt;
    var t3 = st.t3;   /* 탭 ③ — 탭 ② 와 같은 PLAY(정지점 0.5 · 1). 정지점 ② 가 끝(done) */
    if (!RM && st.tab === 3) t3.mt += dt;
    if (st.tab === 3 && (t3.play === "run1" || t3.play === "run2")) { var r3 = playStep(t3.p, RM ? 99 : dt, t3.play); t3.p = r3.p; t3.play = r3.phase === "stop2" ? "done" : r3.phase;
      if (t3.play === "stop1") t3.rec[t3.coef + "g"] = true; if (t3.play === "done") t3.rec[t3.coef + "l"] = true; changed = true; }
    return changed;
  }
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (lastT === null) { lastT = now; render(0); return; }
    var dt = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (advance(dt)) sync();
    render(dt); render3();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; }
    else if (!rafId) rafId = requestAnimationFrame(loop);
  });

  /* ---------- 초기화 ---------- */
  $("limits").innerHTML = TXT.limits.map(function (t, i) { return '<li id="lim' + i + '">' + t + "</li>"; }).join("");
  T3 = buildStage();
  if (!T3) { $("stage").classList.add("is-hidden"); $("camHint").classList.add("is-hidden"); $("assetBadge").classList.add("is-hidden"); $("stageFallback").style.display = "block"; $("overlay").classList.add("is-hidden"); }
  else {
    if (window.ENTH_FX) $("assetBadge").classList.add("is-hidden");   /* Codex 모형이 실렸으면 «자리 표시» 배지를 내린다 */
    bindOrbit(T3.cv);
    if (window.ResizeObserver) new ResizeObserver(resize).observe($("stageWrap"));
    resize();
  }
  applyTab();
  rafId = requestAnimationFrame(loop);

  /* 프로브 창구 — 읽기·렌더 전용 */
  window.ENTHVIEW = {
    st: st, rm: RM, T3: !!T3, drawn: function () { return drawn; },
    tick: function (dt) { advance(dt); sync(); render(0); },
    adv: function (dt) { return advance(dt); },   /* 시계만(렌더 없음) — 프로브가 긴 구간을 빠르게 돈다 */
    orbit: function () { return T3 ? { yaw: T3.orbit.yaw, pitch: T3.orbit.pitch } : null; },
    ghostOpacity: function () { return T3 && st.t2.zoom ? T3.micro[st.t2.zoom].ghostOpacity() : null; },
    roleColors: function (k) { return T3 ? T3.micro[k].roleColors() : null; },
    canvasCenter: function () { return T3 ? { x: T3.cv.clientWidth / 2, y: T3.cv.clientHeight / 2 } : null; },
    packScreen: function () { if (!T3) return null; var o = {}; ["hw", "cp"].forEach(function (k) { var P = T3.packs[k], g = P.group.position; o[k] = proj([g.x, g.y + P.h * 0.5, g.z], T3.cam); }); return o; },
    renderOnce: function () { render(0); return !!T3; },
    render3: function () { render3(); return !!S3; }, drawn3: function () { return drawn3; },
    /* 탭 ③ 빛을 «장면에서» 잰다 — 보이는 층 메시 꼭짓점의 최대 반지름 · 재질 불투명도(S-검토 R2 A-4: 넘긴 값을 적어 두는 자기 스냅샷 금지) */
    glowScene: function () { if (!S3) return null; var mx = 0, vis = false, op = [], v = new THREE.Vector3(); S3.sc.updateMatrixWorld(true);
      S3.sc.traverseVisible(function (m) { if (!m.isMesh || !/heat-.*layer/.test(m.name) || m.material.opacity <= 0) return; vis = true; op.push(m.material.opacity);   /* 조상까지 보이는 것만(S-검토 R3 B-4) */
        var P = m.geometry.attributes.position; for (var i = 0; i < P.count; i++) { v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m.matrixWorld); mx = Math.max(mx, Math.sqrt(v.x * v.x + v.y * v.y)); } }); return { vis: vis, maxR: mx, op: op }; },
    fieldO: function () { return T3 && st.t2.zoom ? T3.micro[st.t2.zoom].fieldO() : null; },
    atomScene: function () { return T3 && st.t2.zoom ? T3.micro[st.t2.zoom].atomPos() : null; },
    freeze: function () { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; },
    thaw: function () { if (!rafId) rafId = requestAnimationFrame(loop); },
    sync: sync, applyTab: applyTab
  };
})();
