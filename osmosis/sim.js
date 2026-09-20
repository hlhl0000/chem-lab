/* ============================================================
   삼투 현상 (Ⅱ. 용액의 성질 / 차시 15 · 학습지 2-2-03)

   구획 (검증 스크립트가 아래 마커 주석줄 「================= SCENE / UI + WebGL / FALLBACK_FX =================」을 기준으로
        잘라 대조한다 — 지우거나 바꾸지 말 것)
     1) 계산부           : 이 줄부터 SCENE 마커 직전까지            → 검증스크립트/osmosis_core.js
     2) SCENE 구획       : 씬 상수·환경맵·조명                    → 검증스크립트/osmosis_scene.js
     3) UI + WebGL       : 화면 (마커 뒤)
     4) FALLBACK_FX 구획 : 코덱스 모듈이 없을 때의 최소 그림(시작·끝 마커) → 검증스크립트/osmosis_fallback.js

   모형 (설계지시안_삼투_v5 부록 A · MF-1 검산 _osmosis_spec_calc.js v5)
     탭 ①  무의 질량 변화 : 학습지 표(80 g · 포도당 · 20분) 구간 보간 × 질량 비례. 0 M 값은 추정치(+2.6 g)
     탭 ②  삼투 실험     : 반투막 U자관 · 희석 포함 · 압축 척도(평형 농도차 1 M = 8 cm · 실제의 1/3100)
   하지 않는 것
     「묽은 쪽에 물이 빽빽해서 더 자주 부딪힌다」·「농도를 맞추려고」 류 문장(수업설계안 §8 번역표 좌열)을 쓰지 않는다.
   ============================================================ */
"use strict";

/* ---------- 상수 (전부 근거 병기) ---------- */
var R_ATM = 0.082;          // L·atm/(mol·K) — 교과서 관행(학습지에는 수치 없음 · 지시안 A-6)
var T_C   = 20;             // ℃ — 학습지 활용 문제 (가)(나)의 온도. 고정
var T_K   = 273 + T_C;      // 293 K — 교과서 관행 T = 273 + t
var RHO_G_H2O = 9.80665e3;  // Pa/m  (ρ=1000 kg/m³ · g=9.80665) — 실제 척도 물기둥 환산에만 씀
var ATM_PA = 101325;
var N_A = 6.02214e23;

/* 탭 ① 무 — 학습지 2-2-03 2단계 1-(2) 표 (80 g · 포도당 · 20분) + 0 M 추정치 */
var RADISH_M0    = 80;       // g  표의 기준 질량
var RADISH_T_MIN = 20;       // min 담근 시간
var RADISH_TABLE = [         // [농도 M, 질량 변화 g] — 0 M 값만 추정(지시안 A-1 · 표 3점 직선 최소제곱 k=−5.2 g/M의 0 M 예측)
  [0.0, +2.6], [0.5, 0], [1.0, -2], [2.0, -8]
];
var RADISH_TURGOR_FULL = 0.10;   // |Δm/m| 가 이 비율이면 쪼글쪼글/팽팽 표현을 최대로 (표현 과장 계수 · 화면 고지)
var RADISH_T_END = 10;           // s — 화면 시간(20 min → 10 s · 1 s = 2 min · 동료교사 피드백 2026-09-20 · 지시안 A-3 개정)
var RADISH_MIN_PER_S = RADISH_T_MIN / RADISH_T_END;   // 가상 분/화면 s = 2 — 시계 표시가 이 값을 쓴다(단일 원천)
var RADISH_M_MIN = 40, RADISH_M_MAX = 160, RADISH_M_STEP = 10;   // g — 슬라이더(지시안 A-2)
var CONC_STEPS = [0, 0.5, 1.0, 2.0];                             // M — 탭 ① 농도 4단(K1)
var SOLUTES = [                                                   // 비전해질 3종 — 계산은 종류를 구별하지 않는다(지시안 F-16)
  { id: "sucrose", name: "설탕",   formula: "C<sub>12</sub>H<sub>22</sub>O<sub>11</sub>" },
  { id: "glucose", name: "포도당", formula: "C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>" },
  { id: "urea",    name: "요소",   formula: "(NH<sub>2</sub>)<sub>2</sub>CO" }
];
var BEAKER = { rIn: 4, rOut: 4.25, height: 12, floorY: 0.25, level: 8 };   // cm — 안지름 4 · 바깥 4.25 · 높이 12 · 안쪽 바닥 0.25 · 물 기둥 8 (≈402 mL)
var RADISH_BBOX = { hx: 2.6, h: 4.2, hz: 2.6, wrinkle: 1.1 };   // scale=1 경계 상자 반폭·높이(부록 B) · 주름 여유 10 %
var FLOOR = { beaker: { radius: 12, y: -0.02 }, utube: null };   // 바닥 판(ShadowMaterial) — 비커 씬만(A-35 · U자관 씬은 캐스터 없음)

/* 탭 ② U자관 — 형상은 중심선 점열에서 «유도»한다(원칙 11·13). 1 단위 = 1 cm */
var UT = {
  armX: 5,        // 팔 중심선 x = ±5
  rBend: 3,       // 굽이 반지름 (중심선)
  rIn: 1.0,       // 관 안지름 반지름
  rOut: 1.25,     // 유리 바깥 반지름(그림자 표본점·ROI 에 씀)
  armTop: 25,     // 팔 위 끝 y
  h0: 10,         // 초기 액면 y (양팔 같음)
  LM: 8,          // 압축 척도: 평형 농도차 1 M 당 액면차 8 cm (사용자 확정 · AI 제안 선택)
  hMin: 3,        // 굽이 상단 y — 액면이 이 아래로 오면 V(h) 식이 무효(스윕으로 절대 안 옴을 확인)
  bendSeg: 24,    // 굽이 분할 수 (렌더·판정이 같은 점열을 쓴다)
  cMin: 0, cMax: 2.0, cStep: 0.1, cL0: 0, cR0: 1.0   // 슬라이더(지시안 A-5)
};
UT.A = Math.PI * UT.rIn * UT.rIn;                         // 단면적 cm² = π

/* 중심선 점열: 왼팔 위 → 왼팔 아래 → 굽이 → 수평 → 굽이 → 오른팔 위. 렌더(LineCurve3 CurvePath)와 판정이 공유 */
function utubeCenterline() {
  var pts = [], i, a, X = UT.armX, R = UT.rBend;
  pts.push({ x: -X, y: UT.armTop });
  pts.push({ x: -X, y: R });
  for (i = 1; i <= UT.bendSeg; i++) {           // 왼 굽이: 중심 (−X+R, R), 각 π → 3π/2
    a = Math.PI + (Math.PI / 2) * i / UT.bendSeg;
    pts.push({ x: -X + R + R * Math.cos(a), y: R + R * Math.sin(a) });
  }
  pts.push({ x: X - R, y: 0 });
  for (i = 1; i <= UT.bendSeg; i++) {           // 오른 굽이: 중심 (X−R, R), 각 3π/2 → 2π
    a = 1.5 * Math.PI + (Math.PI / 2) * i / UT.bendSeg;
    pts.push({ x: X - R + R * Math.cos(a), y: R + R * Math.sin(a) });
  }
  pts.push({ x: X, y: UT.armTop });
  return pts;
}
/* 막(x=0,y=0)에서 오른팔 액면 y=h 까지의 중심선 경로 길이 (좌우 대칭이라 한 함수) */
function utubePathLen(h) {
  var pts = utubeCenterline(), len = 0, i, started = false;
  for (i = 1; i < pts.length; i++) {
    var p = pts[i - 1], q = pts[i];
    if (!started) { if (p.x < 0 && q.x >= 0) { started = true; len += Math.abs(q.x - 0); } continue; } // (0,0)→q
    if (q.y > h && p.x === q.x) { len += (h - p.y); break; }   // 오른팔 직선에서 액면까지
    len += Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y));
  }
  return len;
}
/* 막(0,0)→개구 순의 좌/우 반경로 점열 — FALLBACK·코덱스·하니스가 «이것»만 쓴다(원칙 11 · 원천 하나) */
function utubeHalfPaths() {
  var pts = utubeCenterline(), L = [], R = [], i, k = -1;
  for (i = 1; i < pts.length; i++) if (pts[i - 1].x < 0 && pts[i].x >= 0) { k = i; break; }
  L.push({ x: 0, y: 0 }); for (i = k - 1; i >= 0; i--) L.push(pts[i]);      // (0,0) → 왼 수평·굽이·팔 → 개구
  R.push({ x: 0, y: 0 }); for (i = k; i < pts.length; i++) R.push(pts[i]);  // (0,0) → 오른 수평·굽이·팔 → 개구
  return { pointsL: L, pointsR: R };
}
function polyLen(pts, yMax) {   // 반경로 점열의 누적 길이(y ≤ yMax 까지 · 팔 직선에서 절단)
  var len = 0, i;
  for (i = 1; i < pts.length; i++) {
    var p = pts[i - 1], q = pts[i];
    if (q.y > yMax && p.x === q.x) { len += (yMax - p.y); break; }
    len += Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y));
  }
  return len;
}
UT.hb = utubePathLen(UT.hMin) - UT.hMin;                  // 점열 유도값 (모형이 쓰는 값)
UT.hbClosed = (UT.armX - UT.rBend) + (Math.PI / 2) * UT.rBend - UT.rBend;   // 닫힌 식 2 + 3π/2 − 3 (G-9 대조용)
function utubeVol(h) { return UT.A * utubePathLen(h); }   // 한쪽 액체 부피 mL
UT.V0 = utubeVol(UT.h0);
UT.H  = UT.V0 / UT.A;                                     // = h0 + hb

/* ---------- 표기 함수 (단일 원천 · §14 ④) ---------- */
function fmtAtm(x) { return x.toFixed(1); }    // atm — 소수 1자리 고정 (12.0 / 24.0 / 48.1)
function fmtG(x)   { return x.toFixed(1); }    // g
function fmtCm(x)  { return x.toFixed(1); }    // cm
function fmtM(x)   { return x.toFixed(2); }    // M
function fmtClock(sec) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ":" + (s < 10 ? "0" : "") + s; }

/* ---------- 모형 함수 ---------- */
function piVH(C) { return C * R_ATM * T_K; }                              // 판트호프 π = CRT [atm]
function waterColumn_m(pi_atm) { return pi_atm * ATM_PA / RHO_G_H2O; }  // 실제 척도 물기둥 [m]

function radishDm(C, m) {            // 20분 뒤 질량 변화 g — 표 구간 선형보간 × (m/80)  (사용자 확정: 질량 비례)
  var t = RADISH_TABLE, i;
  if (C <= t[0][0]) return t[0][1] * m / RADISH_M0;
  for (i = 0; i < t.length - 1; i++) {
    if (C >= t[i][0] && C <= t[i + 1][0]) {
      var u = (C - t[i][0]) / (t[i + 1][0] - t[i][0]);
      return (t[i][1] + (t[i + 1][1] - t[i][1]) * u) * m / RADISH_M0;
    }
  }
  return t[t.length - 1][1] * m / RADISH_M0;
}
function radishInTable(C, m) { return m === RADISH_M0 && (C === 0.5 || C === 1.0 || C === 2.0); }   // 「표 값」 배지 조건 (0 M은 추정)
function radishBadge(C, m) {         // A-33 배지 4종 — readout 옆에 sync() 가 붙인다
  if (C === 0) return m === RADISH_M0 ? "추정치" : "추정치·외삽";
  return radishInTable(C, m) ? "표 값" : "외삽";
}
function radishProgress(u) {         // 시간 진행 0..1 → 변화 비율 0..1, 지수 접근이되 u=1 에서 정확히 1 (함정 54)
  var k = 3;
  if (u >= 1) return 1;
  if (u <= 0) return 0;
  return (1 - Math.exp(-k * u)) / (1 - Math.exp(-k));
}
function radishSettled(t) { return t / RADISH_T_END >= 1 - 1e-9; }   // 탭 ① 종료 판정(코어) — utubeSettled 와 같은 꼴
function radishScale(m, dm) { return Math.pow((m + dm) / RADISH_M0, 1 / 3); }  // 길이 배율 (부피 ∝ 질량, ρ≈1)
function radishTurgor(m, dm) {       // −1(쪼글) .. +1(팽팽) — 표현용, 비율 과장
  var v = (dm / m) / RADISH_TURGOR_FULL;
  return v < -1 ? -1 : (v > 1 ? 1 : v);
}
function soluteDots(C) { return Math.round(100 * C); }   // 1 M = 100 점, 상한 200 (2 M)
function soluteTint(C) { return C / UT.cMax; }           // 액체 색 혼합 0..1 = 초기 농도 ÷ 2 M (지시안 A-30 · 실험 중 고정)
/* 용질 종류별 «표시» 색(사용자 지시 2026-09-20 · 계산과 무관 · 시각 구별만) — 비커 2 M 끝색(0 M 은 셋 다 물색) / U자관 점 색·테두리 */
var SOLUTE_COLORS = {
  sucrose: { deep: "#0f4c7a", dot: "#dc2626", rim: "#7f1d1d" },   // 설탕: 파랑 계열이 짙어짐 / 점 빨강
  glucose: { deep: "#0891b2", dot: "#d97706", rim: "#7c2d12" },   // 포도당: 하늘색(청록) 계열 / 점 주황
  urea:    { deep: "#6b7a86", dot: "#eab308", rim: "#713f12" }    // 요소: 연한 회색 계열 / 점 노랑
};
function soluteColors(sol) { return SOLUTE_COLORS[sol] || SOLUTE_COLORS.sucrose; }
/* 용매(물) 입자 — 탭 ② 「용매 입자 표시하기」(사용자 지시 2026-09-20). 개수·속도는 «비율»만 의미한다(고지 ⑪).
   구동력 drive = ((C_R − C_L)·L_M − Δh) / (L_M·cMax) ∈ [−1, 1] — 평형식 (C_R−C_L)·L_M = Δh 의 잔차를 최대값(2 M·8 cm)으로 정규화. 평형에서 0.
   양방향 생성률(입자/s): 기본 FLOW_BASE 에 구동력 방향 쪽만 FLOW_GAIN 배 가산 → 순 이동 = 희박 → 진한 쪽 · 평형에서 두 방향 같음 */
/* 사용자 조정(2026-09-20 · 검토 뒤): 범위 6.5 → ×0.7 = 4.55 cm · 속도 ×1.3(시계 배속 — 모듈 무수정) · 눈에 보이는 입자 수 ×1.5.
   보이는 수 ≈ 생성률 × 수명(= 2·range / (2.2·1.3) = 3.18 s). (0|1) 시작 ≈ 14.5·1.3·3.18 + 2.4·1.3·3.18 ≈ 60 + 10 = 70개 · 평형 4/4 → 33개 */
var SOLVENT_RANGE = 4.55, SOLVENT_CLOCK = 1.3;
/* 사용자 지시 8(2026-09-20): 두 방향 개수 차이를 더 과장 — 순 이동 쪽 = BASE·(1 + GAIN·vis), 반대쪽 = BASE·(1 − DAMP·vis)(하한 0.2·BASE). 평형(drive 0)에서는 둘 다 BASE.
   vis = √(|drive| / |drive0|): 남은 구동력을 «시작 구동력»으로 정규화하고 제곱근을 취해, 액면이 움직이는 동안 차이가 너무 빨리 1:1 로 무너지지 않게 한다(τ 3 s 지수 감쇠 그대로면 3 s 뒤 2:1 → 이제 ≈ 5:1 · 9 s 뒤 ≈ 2.6:1 · 평형 1:1).
   시작: 14.5(상한) / 2.4 ≈ 6:1(ΔC 와 무관 — 방향만 과장). 상한 RATE_CAP = 모듈 슬롯 60 ÷ 모듈 시계 수명(2·range/2.2 cm/s) — 넘기면 모듈이 슬롯을 재활용해 입자가 조기 소멸한다 */
var FLOW_BASE = 4.0, FLOW_GAIN = 6, FLOW_DAMP = 0.4, SOLVENT_MAX_PER_DIR = 60, SOLVENT_MODULE_SPEED = 2.2;
var SOLVENT_RATE_CAP = SOLVENT_MAX_PER_DIR / (2 * SOLVENT_RANGE / SOLVENT_MODULE_SPEED);   // 60 / 4.136 s = 14.5 입자/s(모듈 시계)
function solventRates(CL, CR, dh, drive0) {
  var drive = ((CR - CL) * UT.LM - dh) / (UT.LM * UT.cMax);
  drive = Math.max(-1, Math.min(1, drive));
  var ref = drive0 === undefined ? Math.abs(drive) : Math.min(1, Math.abs(drive0));                 // drive0 = 시작 구동력((C_R0 − C_L0)/cMax) · 없으면 현재값(= vis 1 또는 0)
  var vis = ref > 1e-12 ? Math.sqrt(Math.min(1, Math.abs(drive) / ref)) : 0;
  var withF = Math.min(SOLVENT_RATE_CAP, FLOW_BASE * (1 + FLOW_GAIN * vis)), against = FLOW_BASE * Math.max(0.2, 1 - FLOW_DAMP * vis);
  return { LR: drive >= 0 ? withF : against, RL: drive >= 0 ? against : withF, drive: drive, vis: vis };
}
/* 용매 입자 색(사용자 지시 2026-09-20 · 검토 뒤): 묽은 쪽은 «연한 파랑», 진한 쪽은 «진한 파랑» — HSL h 224° · s 0.75 고정 · 명도 l 0.68(0 M) → 0.32(2 M) 선형. 입자는 생성 쪽 색을 막을 건너도 유지 */
function solventColor(C) {
  var h = 224 / 360, sat = 0.75, l = 0.68 - 0.36 * Math.max(0, Math.min(1, C / UT.cMax));
  function hue(pp, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return pp + (q - pp) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6; return pp; }
  var q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
  var r = hue(pp, q, h + 1 / 3), g = hue(pp, q, h), b = hue(pp, q, h - 1 / 3);
  function hx(v) { var k = Math.round(v * 255).toString(16); return k.length < 2 ? "0" + k : k; }
  return "#" + hx(r) + hx(g) + hx(b);
}

function utubeEq(CL0, CR0) {         // 평형 ξ = x/V0 (x: 왼→오 넘어간 물 부피) — 이분법
  var LM = UT.LM, H = UT.H;
  var F = function (xi) { return (CR0 / (1 + xi) - CL0 / (1 - xi)) * LM - 2 * xi * H; };
  var lo = -1 + 1e-9, hi = 1 - 1e-9, mid, i;
  if (CL0 === CR0) return 0;
  for (i = 0; i < 120; i++) { mid = (lo + hi) / 2; if (F(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function utubeState(CL0, CR0, xi) {  // ξ 에서의 관측값
  var x = xi * UT.V0;                                    // mL
  var VL = UT.V0 - x, VR = UT.V0 + x;
  return {
    hL: VL / UT.A - UT.hb, hR: VR / UT.A - UT.hb,        // 액면 y (cm)
    dh: 2 * x / UT.A,                                    // hR − hL (cm)
    CL: CL0 * UT.V0 / VL, CR: CR0 * UT.V0 / VR,          // 희석·농축 반영 (n 고정)
    VL: VL, VR: VR
  };
}
var UT_TAU = 3;                       // s — 화면 시간상수(지시안 A-4). 종단 T_END = 5τ = 15 s
var UT_T_END = 5 * UT_TAU;
function utubeProgress(t) {           // 0..1, 지수 접근 재정규화 — u=1 에서 정확히 1 (radishProgress 와 같은 꼴)
  var u = t / UT_T_END, k = 5;
  if (u >= 1) return 1;
  if (u <= 0) return 0;
  return (1 - Math.exp(-k * u)) / (1 - Math.exp(-k));
}
function utubeXi(t, xiEq) { return xiEq * utubeProgress(t); }
function utubeSettled(t) { return t / UT_T_END >= 1 - 1e-9; }   // 탭 ② 종단 판정(코어) — 화면은 래퍼 OSMOVIEW.settled(tab) 만 부른다

/* ---------- 그림자 기하 — 씬 표본점에서 프러스텀을 «유도»(원칙 13) · G-11 이 이 함수로 재검사 ---------- */
function scenePoints() {              // 두 씬 «합집합»의 형상 표본점(보수적 — 캐스터는 무뿐이지만 리시버·가림 형상까지 덮는다) · 1 단위 = 1 cm
  var pts = [], i, a, k;
  var cl = utubeCenterline(), ro = UT.rOut;   // U자관 유리: 중심선 점마다 8모서리
  for (i = 0; i < cl.length; i++) for (k = 0; k < 8; k++)
    pts.push([cl[i].x + (k & 1 ? ro : -ro), cl[i].y + (k & 2 ? ro : -ro), (k & 4 ? ro : -ro)]);
  for (i = 0; i < 16; i++) {           // 비커 유리 rOut · y 0..height
    a = Math.PI * 2 * i / 16;
    pts.push([BEAKER.rOut * Math.cos(a), 0, BEAKER.rOut * Math.sin(a)]); pts.push([BEAKER.rOut * Math.cos(a), BEAKER.height, BEAKER.rOut * Math.sin(a)]);
  }
  var sMax = radishScale(RADISH_M_MAX, radishDm(0, RADISH_M_MAX)) * RADISH_BBOX.wrinkle;   // 무 최대 자세 (스윕 최대 × 주름 여유) · 안쪽 바닥 위
  for (k = 0; k < 8; k++) pts.push([(k & 1 ? RADISH_BBOX.hx : -RADISH_BBOX.hx) * sMax, BEAKER.floorY + (k & 2 ? RADISH_BBOX.h * sMax : 0), (k & 4 ? RADISH_BBOX.hz : -RADISH_BBOX.hz) * sMax]);
  if (FLOOR.beaker) for (i = 0; i < 16; i++) { a = Math.PI * 2 * i / 16; pts.push([FLOOR.beaker.radius * Math.cos(a), FLOOR.beaker.y, FLOOR.beaker.radius * Math.sin(a)]); }   // 비커 씬 바닥 판
  return pts;
}
function lightSpace(p, pos, target) { // three.js lookAt 규약: 카메라 −z 가 시선 · up (0,1,0)
  var zx = pos[0] - target[0], zy = pos[1] - target[1], zz = pos[2] - target[2], zl = Math.sqrt(zx * zx + zy * zy + zz * zz);
  zx /= zl; zy /= zl; zz /= zl;
  var xx = 1 * zz - 0 * zy, xy = 0 * zx - 0 * zz, xz = 0 * zy - 1 * zx, xl = Math.sqrt(xx * xx + xy * xy + xz * xz);   // up × z
  xx /= xl; xy /= xl; xz /= xl;
  var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;                                     // z × x
  var qx = p[0] - pos[0], qy = p[1] - pos[1], qz = p[2] - pos[2];
  return { x: xx * qx + xy * qy + xz * qz, y: yx * qx + yy * qy + yz * qz, depth: -(zx * qx + zy * qy + zz * qz) };
}
function shadowFrustumFromScene(K) {  // K = {pos, target, shadow:{margin}} · 표본점 광원공간 경계상자 ± margin → key.shadow.camera 값
  var pts = scenePoints(), b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, d0: 1e9, d1: -1e9 }, i, q;
  for (i = 0; i < pts.length; i++) {
    q = lightSpace(pts[i], K.pos, K.target);
    b.x0 = Math.min(b.x0, q.x); b.x1 = Math.max(b.x1, q.x); b.y0 = Math.min(b.y0, q.y); b.y1 = Math.max(b.y1, q.y);
    b.d0 = Math.min(b.d0, q.depth); b.d1 = Math.max(b.d1, q.depth);
  }
  var m = K.shadow.margin, r = function (v) { return Math.round(v * 2) / 2; };   // 0.5 cm 단위로 바깥쪽 반올림
  return { bbox: b, camera: { left: r(Math.floor((b.x0 - m) * 2) / 2), right: r(Math.ceil((b.x1 + m) * 2) / 2),
           top: r(Math.ceil((b.y1 + m) * 2) / 2), bottom: r(Math.floor((b.y0 - m) * 2) / 2),
           near: r(Math.floor((b.d0 - m) * 2) / 2), far: r(Math.ceil((b.d1 + m) * 2) / 2) } };
}
function shadowFrustumCovers(key) {   // G-11: key = OSMO_SCENE.key — pos·target·shadow.camera 를 «그 객체»에서 읽는다 · 프러스텀 ⊇ 씬 표본점 전부
  var cam = key.shadow.camera, pts = scenePoints(), i, q;
  for (i = 0; i < pts.length; i++) {
    q = lightSpace(pts[i], key.pos, key.target);
    if (q.x < cam.left || q.x > cam.right || q.y < cam.bottom || q.y > cam.top || q.depth < cam.near || q.depth > cam.far) return false;
  }
  return true;
}

/* ---------- 가시성 단일 원천(§13) — 탭 × 요소. applyTab()/sync() 만 display 를 대입한다 ---------- */
var SHOW = {
  radish: { tabRadish: true,  tabUtube: false },
  utube:  { tabRadish: false, tabUtube: true }
};

/* ---------- 문구 — 캡션·고지·각주·범례·배지 전부 여기(J-5 grep 대상 · 단일 원천) ---------- */
var TXT = {
  title: "삼투 현상",                                                              // 사용자 확정(2026-09-20 S1) — sims.js·<title>·<h1> 셋이 하나의 값
  sub: "용액의 농도에 따른 삼투 현상과 삼투압을 확인합니다.",
  tabs: { radish: "① 무의 질량 변화", utube: "② 삼투 실험" },
  soluteNote: "용질을 바꿔도 결과는 같습니다 — 입자 수만 셉니다.",
  ureaNote: "실제 투석막·세포막은 요소처럼 작은 분자를 통과시킵니다(이 시뮬의 막은 물만 통과하는 이상 반투막입니다).",
  scaleNote: "이 U자관의 높이차는 실제의 약 1/3100로 줄여 그린 것입니다(1 M 농도 차 ≈ 물기둥 248 m). 높이차가 농도 차에 비례한다는 관계만 그대로이고, 농도·높이 수치는 이 척도의 모형값입니다.",
  scaleTag: "척도 1/3100",
  legendRadish: "수용액의 색은 농도가 진할수록 짙게 그린 임의 색입니다(설탕 파랑·포도당 하늘색·요소 회색 계열 — 실제 세 수용액은 모두 무색입니다).",   // 탭 ① — 용질 점 없음 · 용질별 색(사용자 지시 2026-09-20)
  legendUtube: "용질 점(설탕 빨강·포도당 주황·요소 노랑)·용매 입자(묽은 쪽 연한 파랑 · 진한 쪽 진한 파랑)·막의 색은 임의 색입니다. 용질 점 1개는 실제 분자 약 3×10²⁰개를 대표합니다.",   // 탭 ②
  solventBtn: "용매 입자 표시하기",
  solventNote: "막을 건너는 물 분자 — 위쪽 반은 오른쪽→왼쪽, 아래쪽 반은 왼쪽→오른쪽(위·아래로 나눈 것은 두 방향을 구별해 보이려는 그림 규칙일 뿐, 실제 물 분자는 막의 어느 부분으로든 양쪽으로 건넙니다). 두 방향 개수의 차이가 순 이동이고, 평형에서는 두 방향이 같습니다. 입자는 출발한 쪽 색을 유지합니다(「실험 시작」 뒤에 움직입니다).",
  limitTag: "여기까지만 조작 가능(교육적 제한)",
  measuring: "재는 중",
  eqBadge: "평형",
  doneBadge: "20분 경과",
  virtualClock: "(가상 시간 · 1 s = 2분)",
  fallbackBadge: "기본 그림",
  webglNote: "이 기기에서는 3D 그림을 그릴 수 없습니다(WebGL 사용 불가). 조작과 수치는 그대로 쓸 수 있습니다.",
  /* 평형 캡션 2종 — 분기는 CL0 === CR0 하나(fmtM 문자열이 같으면서 CL0≠CR0인 조합 0건 · 지시안 A-20) */
  eqCaption: {
    a: function (cl, cr) { return "액면이 멈췄습니다(물 분자는 계속 양쪽으로 오가지만 순 이동이 0입니다). 왼쪽 " + fmtM(cl) + " M, 오른쪽 " + fmtM(cr) + " M — 농도는 같아지지 않았습니다. 높이차가 만드는 압력이 순 이동을 0으로 만든 것입니다. ※ 농도 수치는 이 척도의 모형값입니다."; },
    b: function (c) { return "액면이 움직이지 않았습니다(물 분자는 계속 양쪽으로 오가지만 순 이동이 0입니다). 처음부터 양쪽 농도가 같아 높이차가 생기지 않습니다 — 왼쪽 " + fmtM(c) + " M, 오른쪽 " + fmtM(c) + " M."; }
  },
  radishCaption: function (dm) { return dm > 0 ? "무가 부풀었습니다 — 물이 무 안으로 순 이동했습니다." : (dm < 0 ? "무가 쪼글쪼글해졌습니다 — 무 안의 물이 수용액 쪽으로 순 이동했습니다." : "질량이 변하지 않았습니다 — 무 안팎으로 오가는 물의 양이 같습니다."); },
  /* 「가정과 한계」 10항목(지시안 단계 4) */
  limits: [
    "증류수(0 M)에서의 질량 변화 +2.6 g은 추정치입니다 — 학습지에는 「부풀었다」만 있습니다.",
    "학습지 표(0.5 M에서 변화 0)는 이상화된 값입니다. 실제 식물 조직의 등장 농도는 0.3 M 전후라 0.5·1·2 M에서는 모두 질량이 줄어듭니다.",
    "U자관의 평형 농도와 높이차는 압축 척도(1/3100 · 1 M ≈ 물기둥 248 m)의 모형값입니다. 높이차가 농도 차에 비례한다는 관계만 그대로입니다.",
    "이 시뮬의 막은 물만 통과하는 «이상 반투막»으로 두었습니다. 실제 막이 무엇을 통과시키는지는 크기만으로 정해지지 않습니다. 요소: 실제 투석막·세포막은 요소처럼 작은 분자를 통과시킵니다.",
    "무의 쪼글쪼글함·팽팽함은 질량 변화 비율 10 %에서 최대가 되도록 과장해 표현했습니다. 무의 크기(길이 배율)는 질량 변화를 그대로 따릅니다.",
    "80 g이 아닌 무의 질량 변화는 표를 질량에 비례해 늘린 값(외삽)입니다.",
    "비커 수용액의 농도는 실험 중 변하지 않는 것으로 근사했습니다(최대 4 %).",
    "온도는 20 ℃로 고정했고, π = CRT는 묽은 용액에서의 근사식입니다.",
    "U자관의 용질 점 1개는 실제 분자 약 3×10²⁰개(한 팔)를 대표하며, 막 양쪽 액체 전 구간에 고르게 그렸습니다. 비커 수용액의 색 짙기와 용질별 색은 농도·종류를 나타내는 임의 표현입니다.",
    "무 담그기 20분은 화면에서 10초로(1초 = 2분), U자관의 15초는 화면 시간입니다.",
    "용매 입자는 막 양쪽 4.6 cm 구간에만 그렸습니다. 위쪽 반은 오른쪽→왼쪽, 아래쪽 반은 왼쪽→오른쪽으로 건너고, 두 방향 개수의 차이가 순 이동입니다(평형에서는 같음). 개수·속도는 실제 값이 아니고 두 방향의 차이도 크게 과장한 것입니다 — 실제로는 두 방향 흐름이 거의 같고 그 작은 차이가 순 이동입니다. «어느 쪽이 더 많은가»와 «평형에서 같아짐»만 의미합니다."
  ]
};

/* ================= SCENE ================= */
/* 씬 상수·환경맵·조명 — 검증스크립트/osmosis_scene.js 로 잘라내어 하니스·코덱스 visual_check 도 «같은 코드»를 실행한다(지시안 A-29).
   key.shadow.camera 6값은 _osmosis_spec_calc.js [E] 가 씬 표본점에서 유도한 값 — 손으로 고치지 않는다(G-11 이 대조). */
var OSMO_SCENE = {
  bg: "#ffffff",
  toneMapping: "ACESFilmic", exposure: 0.9, outputEncoding: "sRGB", dprMax: 2, colorManagement: "sRGB(legacyMode=false)",
  hemi: { sky: "#ffffff", ground: "#c9d6e2", intensity: 0.75 },
  key:  { color: "#ffffff", intensity: 1.2, pos: [12, 30, 20], target: [0, 12, 0], castShadow: true,
          shadow: { mapSize: 1024, type: "PCFSoft", margin: 1.0,
                    camera: { left: -13, right: 13, top: 15, bottom: -18, near: 16, far: 47.5 } } },
  fill: { color: "#dfe9f3", intensity: 0.4, pos: [-8, 6, -4] },
  front:{ color: "#ffffff", intensity: 0.45, pos: [0, 4, 14] },
  floor:{ beaker: { radius: 12, y: -0.02, material: "ShadowMaterial", opacity: 0.28, receiveShadow: true },
          utube: null },
  env:  { w: 512, h: 256, sky: "#eef3f8", floor: "#d9dee4", wall: "#414e56", wallBand: [78, 96],
          windows: [[48, 84, 104, 84], [302, 88, 92, 76]], windowColor: "#f7fbff",
          frames: [[96, 84, 6, 84], [344, 88, 6, 76]], frameColor: "rgba(120,150,168,0.55)",
          lamp: [0, 14, 512, 22], lampColor: "rgba(255,255,255,0.92)",
          floorBand: [214, 42], floorBandColor: "rgba(30,42,50,0.45)" },
  camera: { beaker: { fov: 38, dist: 34, yaw0: 0, pitch0: 18, pitchMin: -10, pitchMax: 40, target: [0, 6, 0] },
            utube:  { fov: 36, pos: [0, 11, 50], target: [0, 11, 0], orbit: false } },   // 가시 높이 2·50·tan18° = 32.5 cm(y −5.25~27.25) ⊃ 관 −4.25~25 + 위 라벨 1.6 + 아래 반투막 라벨(−2.4, 반높이 ≈1)
  fog: null
};
/* env 값으로 512×256 캔버스에 실험실 창·형광등을 그려 PMREM 환경맵으로 굽는다(torricelli buildEnvironment ES5 이식 · HDRI 파일 금지) */
function buildEnvTexture(THREE, renderer, doc) {
  var E = OSMO_SCENE.env, source = doc.createElement("canvas");
  source.width = E.w; source.height = E.h;
  var paint = source.getContext("2d");
  if (!paint) return null;
  var sky = paint.createLinearGradient(0, 0, 0, E.h);
  sky.addColorStop(0, E.sky); sky.addColorStop(0.5, "#b9c6cd"); sky.addColorStop(1, E.floor);
  paint.fillStyle = sky; paint.fillRect(0, 0, E.w, E.h);
  paint.fillStyle = E.lampColor; paint.fillRect(E.lamp[0], E.lamp[1], E.lamp[2], E.lamp[3]);       // 천장 형광등
  paint.fillStyle = E.wall; paint.fillRect(0, E.wallBand[0], E.w, E.wallBand[1]);                   // 어두운 벽 띠(수평 대비 → 유리·액체의 하이라이트)
  var i;
  paint.fillStyle = E.windowColor;
  for (i = 0; i < E.windows.length; i++) paint.fillRect(E.windows[i][0], E.windows[i][1], E.windows[i][2], E.windows[i][3]);
  paint.fillStyle = E.frameColor;
  for (i = 0; i < E.frames.length; i++) paint.fillRect(E.frames[i][0], E.frames[i][1], E.frames[i][2], E.frames[i][3]);
  paint.fillStyle = E.floorBandColor; paint.fillRect(0, E.floorBand[0], E.w, E.floorBand[1]);
  var texture = new THREE.CanvasTexture(source);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  var pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  var environment = pmrem.fromEquirectangular(texture).texture;
  pmrem.dispose(); texture.dispose();
  return environment;
}
/* 렌더러·씬에 OSMO_SCENE 을 적용한다. which ∈ {"beaker","utube"} — 바닥 판은 해당 씬 것만. 반환 {key, floor} */
function applyScene(THREE, renderer, scene, S, which, doc) {
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;   // r147: hex 색을 sRGB 로 해석해 의도한 색대로 그린다(legacy 는 선형 취급 → 전부 바래 보임 · 4부 ㉜)
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = S.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(S.bg);
  scene.add(new THREE.HemisphereLight(S.hemi.sky, S.hemi.ground, S.hemi.intensity));
  var key = new THREE.DirectionalLight(S.key.color, S.key.intensity);
  key.position.set(S.key.pos[0], S.key.pos[1], S.key.pos[2]);
  key.target.position.set(S.key.target[0], S.key.target[1], S.key.target[2]);
  scene.add(key.target);                       // r147: 그림자 카메라는 target.matrixWorld 를 읽는다 — 씬 자식이어야 한다(지시안 A-35)
  key.castShadow = !!S.key.castShadow;
  key.shadow.mapSize.set(S.key.shadow.mapSize, S.key.shadow.mapSize);
  var C = S.key.shadow.camera;                 // 첫 렌더 «전»에 대입(뒤에 바꾸면 updateProjectionMatrix 필요)
  key.shadow.camera.left = C.left; key.shadow.camera.right = C.right;
  key.shadow.camera.top = C.top; key.shadow.camera.bottom = C.bottom;
  key.shadow.camera.near = C.near; key.shadow.camera.far = C.far;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  var fill = new THREE.DirectionalLight(S.fill.color, S.fill.intensity); fill.position.set(S.fill.pos[0], S.fill.pos[1], S.fill.pos[2]); scene.add(fill);
  var front = new THREE.DirectionalLight(S.front.color, S.front.intensity); front.position.set(S.front.pos[0], S.front.pos[1], S.front.pos[2]); scene.add(front);
  var floor = null, F = S.floor[which];
  if (F) {                                     // 그림자만 칠하는 판 — 무대는 순백 유지(§5)
    floor = new THREE.Mesh(new THREE.CircleGeometry(F.radius, 48), new THREE.ShadowMaterial({ opacity: F.opacity }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = F.y; floor.receiveShadow = !!F.receiveShadow;
    scene.add(floor);
  }
  var env = buildEnvTexture(THREE, renderer, doc || document);
  if (env) scene.environment = env;
  return { key: key, floor: floor, env: env };
}

/* ================= UI + WebGL ================= */
/* 검증 스크립트가 위 마커 주석줄들을 기준으로 계산부·SCENE·FALLBACK_FX 구획을 잘라 대조한다 — 지우거나 바꾸지 말 것 */

/* ================= OSMO_FX 납품 (_osmosis_fx5 · 2026-09-20 · 코덱스 gpt-5.6-sol · 통합 보정 있음(.part.js 주석 · G-7 대조) · sha256 cbf3dc0d3f6b1c41) ================= */
(function (root) {
  "use strict";

  function value(v, fallback) {
    return v == null ? fallback : v;
  }

  function clamp(v, a, b) {
    return v < a ? a : (v > b ? b : v);
  }

  function colorValue(colors, key, fallback) {
    return colors && colors[key] ? colors[key] : fallback;
  }

  function colorMix(THREE, a, b, amount, target) {
    target.set(a);
    target.lerp(new THREE.Color(b), clamp(amount, 0, 1));
  }

  function seeded(seed) {
    var s = (value(seed, 1) | 0) >>> 0;
    if (!s) s = 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function curveFrom(THREE, points) {
    var path = new THREE.CurvePath();
    var i;
    for (i = 1; i < points.length; i += 1) {
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(points[i - 1].x, points[i - 1].y, 0),
        new THREE.Vector3(points[i].x, points[i].y, 0)
      ));
    }
    return path;
  }

  function cutAtArm(points, yMax) {
    var out = [];
    var i;
    for (i = 0; i < points.length; i += 1) {
      if (i > 0 && points[i].y > yMax && points[i].x === points[i - 1].x) {
        out.push({ x: points[i].x, y: yMax });
        break;
      }
      out.push({ x: points[i].x, y: points[i].y });
    }
    return out;
  }

  function noShadow(object) {
    object.traverse(function (child) {
      if (child.isMesh || child.isPoints || child.isLine) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }

  function shadowPolicy(object, castValue, receiveValue) {
    object.traverse(function (child) {
      if (child.isMesh || child.isPoints || child.isLine) {
        child.castShadow = castValue;
        child.receiveShadow = receiveValue;
      }
    });
  }

  function disposeGroup(group) {
    var geometries = [];
    var materials = [];
    group.traverse(function (child) {
      var list;
      var i;
      if (child.geometry && geometries.indexOf(child.geometry) < 0) geometries.push(child.geometry);
      if (child.material) {
        list = child.material instanceof Array ? child.material : [child.material];
        for (i = 0; i < list.length; i += 1) {
          if (materials.indexOf(list[i]) < 0) materials.push(list[i]);
        }
      }
    });
    for (var g = 0; g < geometries.length; g += 1) geometries[g].dispose();
    for (var m = 0; m < materials.length; m += 1) materials[m].dispose();
  }

  function glassMaterials(THREE, colors) {
    var glass = colorValue(colors, "glass", "#a6dded");
    var edge = colorValue(colors, "glassEdge", "#3f7893");
    return {
      outer: new THREE.MeshPhysicalMaterial({
        color: glass,
        metalness: 0,
        roughness: 0.14,
        transparent: true,
        opacity: 0.30,
        side: THREE.FrontSide,
        depthWrite: false,
        envMapIntensity: 1.05,
        blending: THREE.NormalBlending
      }),
      inner: new THREE.MeshPhysicalMaterial({
        color: edge,
        metalness: 0,
        roughness: 0.24,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.NormalBlending
      }),
      silhouette: new THREE.MeshBasicMaterial({
        color: edge,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        blending: THREE.NormalBlending
      }),
      edge: new THREE.MeshStandardMaterial({
        color: edge,
        metalness: 0.04,
        roughness: 0.28,
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
        blending: THREE.NormalBlending
      }),
      highlight: new THREE.MeshBasicMaterial({
        color: "#a0c8e4",
        transparent: true,
        opacity: 0.54,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending
      })
    };
  }

  function liquidMaterial(THREE, color) {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0,
      roughness: 0.18,
      transparent: true,
      opacity: 0.70,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.65,
      blending: THREE.NormalBlending
    });
  }

  function meniscusGeometry(THREE, radius, depth) {
    var profile = [];
    var steps = 14;
    var i;
    var u;
    for (i = 0; i <= steps; i += 1) {
      u = i / steps;
      profile.push(new THREE.Vector2(radius * u, -depth * (1 - u * u)));
    }
    return new THREE.LatheGeometry(profile, 32);
  }

  function makeBeaker(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var rIn = value(opts.rIn, 4);
    var rOut = value(opts.rOut, 4.25);
    var height = value(opts.height, 12);
    var tickEvery = value(opts.tickEveryMl, 100);
    var colors = opts.colors || {};
    var mats = glassMaterials(THREE, colors);
    var outerGeo = new THREE.CylinderGeometry(rOut, rOut, height, 48, 1, true);
    var innerGeo = new THREE.CylinderGeometry(rIn, rIn, height - 0.18, 48, 1, true);
    var outer = new THREE.Mesh(outerGeo, mats.outer);
    var inner = new THREE.Mesh(innerGeo, mats.inner);
    var silhouette = new THREE.Mesh(outerGeo, mats.silhouette);
    outer.position.y = height / 2;
    inner.position.y = 0.25 + (height - 0.25) / 2;
    silhouette.position.y = height / 2;
    outer.renderOrder = 4;
    inner.renderOrder = 3;
    silhouette.renderOrder = 2;
    group.add(silhouette);
    group.add(inner);
    group.add(outer);

    var bottom = new THREE.Mesh(new THREE.CylinderGeometry(rOut, rOut, 0.25, 48, 1, false), mats.outer);
    bottom.position.y = 0.125;
    bottom.renderOrder = 4;
    group.add(bottom);

    var rimOuter = new THREE.Mesh(new THREE.TorusGeometry((rOut + rIn) / 2, (rOut - rIn) / 2 + 0.045, 10, 48), mats.edge);
    var rimInner = new THREE.Mesh(new THREE.TorusGeometry(rIn + 0.025, 0.035, 8, 48), mats.highlight);
    rimOuter.rotation.x = Math.PI / 2;
    rimInner.rotation.x = Math.PI / 2;
    rimOuter.position.y = height;
    rimInner.position.y = height + 0.015;
    rimOuter.renderOrder = 7;
    rimInner.renderOrder = 8;
    group.add(rimOuter);
    group.add(rimInner);

    var tickMat = new THREE.MeshBasicMaterial({
      color: colorValue(colors, "tick", "#454b52"),
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    var stepY = tickEvery / (Math.PI * rIn * rIn);
    var y;
    var index = 1;
    while ((y = 0.25 + stepY * index) < height - 0.35) {
      var longTick = index % 2 === 0;
      var tick = new THREE.Mesh(new THREE.BoxGeometry(longTick ? 0.72 : 0.46, 0.035, 0.018), tickMat);
      tick.position.set(rOut * 0.58, y, rOut * 0.82);
      tick.rotation.z = -0.05;
      tick.renderOrder = 9;
      group.add(tick);
      index += 1;
    }
    group.userData.parts = { outer: outer, inner: inner, rim: rimOuter };
    noShadow(group);
    return {
      group: group,
      update: function () {},
      dispose: function () { disposeGroup(group); }
    };
  }

  function makeBeakerLiquid(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var radius = value(opts.rIn, 3.95);
    var floorY = value(opts.floorY, 0.25);
    var colors = opts.colors || {};
    var waterColor = colorValue(colors, "water", "#2f8fc1");
    var waterDeepColor = colorValue(colors, "waterDeep", "#0f4c7a");
    var material = liquidMaterial(THREE, waterColor);
    var side = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 40, 1, true), material);
    var base = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), material);
    var meniscus = new THREE.Mesh(meniscusGeometry(THREE, radius, 0.18), material);
    base.rotation.x = -Math.PI / 2;
    base.position.y = floorY + 0.004;
    side.renderOrder = -10;
    base.renderOrder = -10;
    meniscus.renderOrder = -9;
    group.add(side);
    group.add(base);
    group.add(meniscus);
    var currentLevel = null;
    var currentTint = null;
    var currentDeepColor = null;
    var mixed = new THREE.Color(waterColor);
    function update(t, state) {
      state = state || {};
      var level = Math.max(floorY + 0.01, value(state.level, floorY + 0.01));
      var tint = clamp(value(state.tint, 0), 0, 1);
      var deepColor = state.deepColor || waterDeepColor;
      var h;
      if (level !== currentLevel) {
        h = level - floorY;
        side.scale.y = h;
        side.position.y = floorY + h / 2;
        meniscus.position.y = level;
        currentLevel = level;
      }
      if (tint !== currentTint || deepColor !== currentDeepColor) {
        colorMix(THREE, waterColor, deepColor, tint, mixed);
        material.color.copy(mixed);
        material.opacity = 0.38 + tint * 0.03;
        currentTint = tint;
        currentDeepColor = deepColor;
      }
    }
    group.userData.parts = { column: side, base: base, meniscus: meniscus };
    shadowPolicy(group, false, true);
    return { group: group, update: update, dispose: function () { disposeGroup(group); } };
  }

  function radishGeometry(THREE) {
    var ys = [0, 0.12, 0.35, 0.80, 1.50, 2.30, 3.00, 3.65, 4.00, 4.20];
    var rs = [2.30, 2.50, 2.58, 2.58, 2.58, 2.58, 2.58, 2.58, 2.45, 1.65];
    var radial = 48;
    var positions = [];
    var indices = [];
    var baseRadius = [];
    var baseY = [];
    var baseAngle = [];
    var i;
    var j;
    var angle;
    for (j = 0; j < ys.length; j += 1) {
      for (i = 0; i <= radial; i += 1) {
        angle = Math.PI * 2 * i / radial;
        positions.push(rs[j] * Math.cos(angle), ys[j], rs[j] * Math.sin(angle));
        baseRadius.push(rs[j]);
        baseY.push(ys[j]);
        baseAngle.push(angle);
      }
    }
    var bottomCenter = positions.length / 3;
    positions.push(0, 0, 0);
    baseRadius.push(0);
    baseY.push(0);
    baseAngle.push(0);
    var topCenter = positions.length / 3;
    positions.push(0, 4.2, 0);
    baseRadius.push(0);
    baseY.push(4.2);
    baseAngle.push(0);
    for (j = 0; j < ys.length - 1; j += 1) {
      for (i = 0; i < radial; i += 1) {
        var a = j * (radial + 1) + i;
        var b = a + 1;
        var c = a + radial + 1;
        var d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    for (i = 0; i < radial; i += 1) indices.push(bottomCenter, i, i + 1);
    var topStart = (ys.length - 1) * (radial + 1);
    for (i = 0; i < radial; i += 1) indices.push(topCenter, topStart + i + 1, topStart + i);
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.userData.baseRadius = baseRadius;
    geometry.userData.baseY = baseY;
    geometry.userData.baseAngle = baseAngle;
    geometry.userData.radial = radial;
    geometry.userData.bodyClosed = true;
    return geometry;
  }

  function setRadishColors(THREE, geometry, flesh, skin, shade) {
    var by = geometry.userData.baseY;
    var fleshColor = new THREE.Color(flesh);
    var skinColor = new THREE.Color(skin);
    var shadeColor = new THREE.Color(shade);
    var array = new Float32Array(by.length * 3);
    var chosen;
    var i;
    for (i = 0; i < by.length; i += 1) {
      if (by[i] >= 2.80) chosen = skinColor;
      else if (by[i] <= 1.05) chosen = shadeColor;
      else chosen = fleshColor;
      array[i * 3] = chosen.r;
      array[i * 3 + 1] = chosen.g;
      array[i * 3 + 2] = chosen.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(array, 3));
    geometry.userData.baseColors = new Float32Array(array);
    geometry.userData.skinBandY = 2.80;
    geometry.userData.shadeBandY = 1.05;
  }

  function makeRadish(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var colors = opts.colors || {};
    var flesh = colorValue(colors, "flesh", "#efe4c4");
    var skin = colorValue(colors, "skin", "#9ec27a");
    var shade = colorValue(colors, "shade", "#c9b98f");
    var topColor = colorValue(colors, "top", "#7fb069");
    var fleshProbe = new THREE.Color(flesh);
    var skinProbe = new THREE.Color(skin);
    if ((fleshProbe.r + fleshProbe.g + fleshProbe.b) / 3 > 0.88) flesh = "#efe4c4";
    if ((skinProbe.r + skinProbe.g + skinProbe.b) / 3 > 0.88 || skinProbe.g <= skinProbe.r) skin = "#9ec27a";
    var bodyMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.55, metalness: 0, blending: THREE.NormalBlending });
    var geometry = radishGeometry(THREE);
    setRadishColors(THREE, geometry, flesh, skin, shade);
    var body = new THREE.Mesh(geometry, bodyMaterial);
    body.name = "radishBody";
    body.userData.role = "radishBody";
    group.add(body);

    var topMaterial = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.48, metalness: 0, blending: THREE.NormalBlending });
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 2.50, 0.26, 32, 1, true), topMaterial);
    collar.position.y = 4.07;
    collar.name = "radishSkinCollar";
    group.add(collar);
    var leafGeo = new THREE.SphereGeometry(1, 16, 8);
    var leafA = new THREE.Mesh(leafGeo, topMaterial);
    var leafB = new THREE.Mesh(leafGeo, topMaterial);
    var leafC = new THREE.Mesh(leafGeo, topMaterial);
    leafA.scale.set(0.72, 0.05, 0.22);
    leafB.scale.set(0.58, 0.05, 0.20);
    leafC.scale.set(0.62, 0.05, 0.18);
    leafA.position.set(-1.22, 4.12, 0.10);
    leafB.position.set(1.26, 4.12, 0.18);
    leafC.position.set(0.02, 4.12, -1.40);
    leafA.rotation.y = -0.45;
    leafB.rotation.y = 0.65;
    leafC.rotation.y = 1.55;
    group.add(leafA);
    group.add(leafB);
    group.add(leafC);

    var highlightMaterial = new THREE.MeshBasicMaterial({
      color: "#fffdf5",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    var highlight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.9, 0.025), highlightMaterial);
    highlight.position.set(-1.34, 2.08, 2.18);
    highlight.rotation.z = 0.04;
    highlight.name = "radishHighlight";
    group.add(highlight);

    var currentTurgor = null;
    var currentScale = null;
    var currentRm = null;
    function shape(turgor) {
      var attr = geometry.attributes.position;
      var arr = attr.array;
      var br = geometry.userData.baseRadius;
      var by = geometry.userData.baseY;
      var ba = geometry.userData.baseAngle;
      var baseColors = geometry.userData.baseColors;
      var colorArray = geometry.attributes.color.array;
      var wrinkle = Math.max(0, -turgor) * 0.18;
      var bend = Math.max(0, -turgor) * 0.08;
      var wrinkleStrength = Math.max(0, -turgor);
      var i;
      var radius;
      var phase;
      var offset;
      var shadeFactor;
      for (i = 0; i < br.length; i += 1) {
        if (br[i] === 0) {
          arr[i * 3] = bend * Math.sin(Math.PI * by[i] / 4.2);
          arr[i * 3 + 1] = by[i];
          arr[i * 3 + 2] = 0;
        } else {
          phase = Math.sin(ba[i] * 12 + by[i] * 0.65) * Math.sin(Math.PI * by[i] / 4.2);
          radius = br[i] + wrinkle * phase;
          offset = bend * Math.sin(Math.PI * by[i] / 4.2);
          arr[i * 3] = radius * Math.cos(ba[i]) + offset;
          arr[i * 3 + 1] = by[i];
          arr[i * 3 + 2] = radius * Math.sin(ba[i]);
        }
        phase = br[i] === 0 ? 1 : Math.sin(ba[i] * 12 + by[i] * 0.65) * Math.sin(Math.PI * by[i] / 4.2);
        shadeFactor = 1 - wrinkleStrength * 0.45 * Math.pow(Math.max(0, -phase), 0.60);
        colorArray[i * 3] = baseColors[i * 3] * shadeFactor;
        colorArray[i * 3 + 1] = baseColors[i * 3 + 1] * shadeFactor;
        colorArray[i * 3 + 2] = baseColors[i * 3 + 2] * shadeFactor;
      }
      attr.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    function update(t, state) {
      state = state || {};
      var scale = Math.max(0.01, value(state.scale, 1));
      var turgor = clamp(value(state.turgor, 0), -1, 1);
      var rm = state.rm === true;
      if (scale !== currentScale) {
        group.scale.set(scale, scale, scale);
        currentScale = scale;
      }
      if (turgor !== currentTurgor) {
        shape(turgor);
        bodyMaterial.roughness = 0.55 - Math.max(0, turgor) * 0.27 + Math.max(0, -turgor) * 0.17;
        currentTurgor = turgor;
      }
      if (rm) {
        highlightMaterial.opacity = 0.20 + Math.max(0, turgor) * 0.10;
      } else {
        highlightMaterial.opacity = 0.20 + Math.max(0, turgor) * 0.10 + 0.035 * Math.sin(value(t, 0) * Math.PI * 2 * 1.15);
      }
      currentRm = rm;
    }
    group.userData.parts = { body: body, collar: collar, highlight: highlight };
    shadowPolicy(group, true, true);
    shape(0);
    return { group: group, update: update, dispose: function () { disposeGroup(group); } };
  }

  function makeSolutePoints(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var maximum = Math.min(200, Math.max(0, value(opts.max, 200) | 0));
    var colors = opts.colors || {};
    var defaultDot = colorValue(colors, "dot", "#d97706");
    var defaultRim = colorValue(colors, "rim", "#7c2d12");
    var dotColor = new THREE.Color(defaultDot);
    var rimColor = new THREE.Color(defaultRim);
    var positions = new Float32Array(maximum * 3);
    var particleSeeds = new Float32Array(maximum);
    var particleSizes = new Float32Array(maximum);
    var random = seeded(opts.seed);
    var offsetA = random();
    var offsetR = random();
    var offsetY = random();
    var i;
    for (i = 0; i < maximum; i += 1) {
      particleSeeds[i] = random();
      particleSizes[i] = 6.5 + random() * 4.0;
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
    geometry.setDrawRange(0, 0);
    var timeUniform = { value: 0 };
    var motionUniform = { value: 1 };
    var material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uMotion: motionUniform,
        uDot: { value: dotColor },
        uRim: { value: rimColor }
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uMotion;",
        "attribute float aSeed;",
        "attribute float aSize;",
        "varying float vSeed;",
        "void main() {",
        "  vec3 p = position;",
        "  float w = uMotion * 0.045;",
        "  p.x += sin(uTime * 1.6 + aSeed * 31.0) * w;",
        "  p.z += cos(uTime * 1.35 + aSeed * 23.0) * w;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  gl_PointSize = aSize * (26.0 / max(1.0, -mv.z));",
        "  vSeed = aSeed;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uMotion;",
        "uniform vec3 uDot;",
        "uniform vec3 uRim;",
        "varying float vSeed;",
        "void main() {",
        "  vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;",
        "  float r = length(q);",
        "  if (r > 1.0) discard;",
        "  float rim = smoothstep(0.56, 0.79, r);",
        "  float shine = 1.0 - smoothstep(0.04, 0.28, length(q - vec2(-0.30, 0.30)));",
        "  float pulse = 0.92 + uMotion * 0.08 * sin(uTime * 6.2831853 * 1.2 + vSeed * 17.0);",
        "  vec3 c = mix(uDot, uRim, rim);",
        "  c = mix(c, vec3(1.0), shine * 0.62);",
        "  gl_FragColor = vec4(c * pulse, 0.96);",
        "  #include <encodings_fragment>",   /* 통합 보정 1/2 (2026-09-20 · S-검토 A-1): legacyMode=false 에서 uDot 은 선형값 — 출력 인코딩이 없으면 점 색이 어둡게 왜곡된다. .orig.js 는 무수정 보존 · G-7 이 이 2줄만 허용 */
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending
    });
    var points = new THREE.Points(geometry, material);
    points.name = "solutePoints";
    points.frustumCulled = false;
    points.renderOrder = 6;
    group.add(points);
    var currentDot = defaultDot;
    var currentRim = defaultRim;

    function frac(v) { return v - Math.floor(v); }
    function inExclude(x, y, z, ex) {
      var dx;
      var dz;
      var safeRadius;
      if (!ex || y < ex.y0 || y > ex.y1) return false;
      dx = x - ex.cx;
      dz = z - ex.cz;
      safeRadius = ex.r + 0.06;
      return dx * dx + dz * dz < safeRadius * safeRadius;
    }
    function pathLengths(path) {
      var lengths = [0];
      var total = 0;
      var i;
      var dx;
      var dy;
      for (i = 1; i < path.length; i += 1) {
        dx = path[i].x - path[i - 1].x;
        dy = path[i].y - path[i - 1].y;
        total += Math.sqrt(dx * dx + dy * dy);
        lengths.push(total);
      }
      return lengths;
    }
    function pathFrame(path, lengths, s) {
      var last = lengths.length - 1;
      var total = lengths[last];
      var target = clamp(s, 0, total);
      var i = 1;
      var span;
      var q;
      var dx;
      var dy;
      var len;
      while (i < lengths.length - 1 && lengths[i] < target) i += 1;
      span = Math.max(0.000001, lengths[i] - lengths[i - 1]);
      q = (target - lengths[i - 1]) / span;
      dx = path[i].x - path[i - 1].x;
      dy = path[i].y - path[i - 1].y;
      len = Math.max(0.000001, Math.sqrt(dx * dx + dy * dy));
      return {
        x: path[i - 1].x + dx * q,
        y: path[i - 1].y + dy * q,
        nx: -dy / len,
        ny: dx / len
      };
    }
    function update(t, state) {
      state = state || {};
      var region = state.region || { cx: 0, cz: 0, r: 1, y0: 0, y1: 1 };
      var ex = state.exclude || null;
      var count = Math.min(maximum, Math.max(0, value(state.count, 0) | 0));
      var height = Math.max(0, region.y1 - region.y0);
      var k;
      var tries;
      var angle;
      var radial;
      var y;
      var x;
      var z;
      var candidate;
      var path;
      var lengths;
      var frame;
      var s0;
      var s1;
      var s;
      var crossA;
      var crossB;
      var nextDot = state.color || defaultDot;
      var nextRim = state.rim || defaultRim;
      if (region.path && region.path.length > 1) {
        path = region.path;
        lengths = pathLengths(path);
        s0 = clamp(value(region.s0, 0), 0, lengths[lengths.length - 1]);
        s1 = clamp(value(region.s1, lengths[lengths.length - 1]), s0, lengths[lengths.length - 1]);
        for (k = 0; k < count; k += 1) {
          s = s0 + (s1 - s0) * frac((k + 0.5 + offsetY) / Math.max(1, count) + offsetY);
          frame = pathFrame(path, lengths, s);
          angle = Math.PI * 2 * frac(offsetA + k * 0.61803398875);
          radial = Math.max(0, region.r - 0.06) * Math.sqrt(frac(offsetR + k * 0.754877666));
          crossA = radial * Math.cos(angle);
          crossB = radial * Math.sin(angle);
          positions[k * 3] = frame.x + frame.nx * crossA;
          positions[k * 3 + 1] = frame.y + frame.ny * crossA;
          positions[k * 3 + 2] = crossB;
        }
      } else {
        for (k = 0; k < count; k += 1) {
          y = region.y0 + height * frac((k + 0.5 + offsetY) / Math.max(1, count) + offsetY);
          tries = 0;
          do {
            candidate = k + tries * Math.max(1, count);
            angle = Math.PI * 2 * frac(offsetA + candidate * 0.61803398875);
            radial = Math.max(0, region.r - 0.06) * Math.sqrt(frac(offsetR + candidate * 0.754877666));
            x = region.cx + radial * Math.cos(angle);
            z = region.cz + radial * Math.sin(angle);
            tries += 1;
          } while (inExclude(x, y, z, ex) && tries < 512);
          if (inExclude(x, y, z, ex)) {
            angle = Math.PI * 2 * frac(offsetA + k * 0.61803398875);
            radial = Math.max(0, region.r - 0.06);
            x = region.cx + radial * Math.cos(angle);
            z = region.cz + radial * Math.sin(angle);
          }
          positions[k * 3] = x;
          positions[k * 3 + 1] = y;
          positions[k * 3 + 2] = z;
        }
      }
      if (nextDot !== currentDot) {
        material.uniforms.uDot.value.set(nextDot);
        currentDot = nextDot;
      }
      if (nextRim !== currentRim) {
        material.uniforms.uRim.value.set(nextRim);
        currentRim = nextRim;
      }
      geometry.setDrawRange(0, count);
      geometry.attributes.position.needsUpdate = true;
      timeUniform.value = state.rm === true ? 0 : value(t, 0);
      motionUniform.value = state.rm === true ? 0 : 1;
    }
    group.userData.parts = { points: points };
    noShadow(group);
    return { group: group, update: update, dispose: function () { disposeGroup(group); } };
  }

  function makeSolventFlow(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var pointsL = opts.pointsL || [];
    var pointsR = opts.pointsR || [];
    var range = Math.max(0.1, value(opts.range, 6.5));
    var maximum = Math.min(60, Math.max(1, value(opts.maxPerDir, 60) | 0));
    var totalMaximum = maximum * 2;
    var colors = opts.colors || {};
    var defaultL = colorValue(colors, "solventL", "#1648b8");
    var defaultR = colorValue(colors, "solventR", "#284f9e");
    var random = seeded(opts.seed);
    var positions = new Float32Array(totalMaximum * 3);
    var vertexColors = new Float32Array(totalMaximum * 3);
    var alphas = new Float32Array(totalMaximum);
    var sizes = new Float32Array(totalMaximum);
    var particles = [];
    var lengthsL = pathLengths(pointsL);
    var lengthsR = pathLengths(pointsR);
    var accLR = 0;
    var accRL = 0;
    var currentT = null;
    var cursorLR = 0;
    var cursorRL = 0;
    var totalLR = 0;
    var totalRL = 0;
    var i;

    function pathLengths(path) {
      var out = [0];
      var sum = 0;
      var k;
      var dx;
      var dy;
      for (k = 1; k < path.length; k += 1) {
        dx = path[k].x - path[k - 1].x;
        dy = path[k].y - path[k - 1].y;
        sum += Math.sqrt(dx * dx + dy * dy);
        out.push(sum);
      }
      return out;
    }

    function frameAt(path, lengths, distance, sign) {
      var target = clamp(distance, 0, lengths[lengths.length - 1]);
      var k = 1;
      var span;
      var q;
      var dx;
      var dy;
      var len;
      var tx;
      var ty;
      while (k < lengths.length - 1 && lengths[k] < target) k += 1;
      span = Math.max(0.000001, lengths[k] - lengths[k - 1]);
      q = (target - lengths[k - 1]) / span;
      dx = path[k].x - path[k - 1].x;
      dy = path[k].y - path[k - 1].y;
      len = Math.max(0.000001, Math.sqrt(dx * dx + dy * dy));
      tx = sign * dx / len;
      ty = sign * dy / len;
      return {
        x: path[k - 1].x + dx * q,
        y: path[k - 1].y + dy * q,
        nx: -ty,
        ny: tx
      };
    }

    for (i = 0; i < totalMaximum; i += 1) {
      var direction = i < maximum ? "LR" : "RL";
      var sign = direction === "LR" ? -1 : 1;
      var uMagnitude = 0.12 + random() * 0.64;
      var wLimit = Math.sqrt(Math.max(0, 0.64 - uMagnitude * uMagnitude));
      particles.push({
        active: false,
        direction: direction,
        sigma: direction === "LR" ? -range : range,
        u: sign * uMagnitude,
        w: (random() * 2 - 1) * wLimit * 0.94,
        speed: 2.2 * (0.85 + random() * 0.30),
        seed: random(),
        alpha: 0,
        color: direction === "LR" ? defaultL : defaultR
      });
      sizes[i] = 6.5 + random() * 4.0;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(vertexColors, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setDrawRange(0, totalMaximum);
    var material = new THREE.ShaderMaterial({
      vertexShader: [
        "attribute vec3 aColor;",
        "attribute float aAlpha;",
        "attribute float aSize;",
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main() {",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  gl_PointSize = aSize * (26.0 / max(1.0, -mv.z));",
        "  vColor = aColor;",
        "  vAlpha = aAlpha;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main() {",
        "  vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;",
        "  float r = length(q);",
        "  if (r > 1.0 || vAlpha <= 0.001) discard;",
        "  float rim = smoothstep(0.56, 0.79, r);",
        "  float shine = 1.0 - smoothstep(0.04, 0.28, length(q - vec2(-0.30, 0.30)));",
        "  vec3 dark = vColor * 0.48;",
        "  vec3 c = mix(vColor, dark, rim);",
        "  c = mix(c, vec3(1.0), shine * 0.62);",
        "  gl_FragColor = vec4(c, vAlpha * 0.96);",
        "  #include <encodings_fragment>",   /* 통합 보정 2/2 (2026-09-20 · S-검토 A-1): 용매 입자 색도 같은 이유 */
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending
    });
    var points = new THREE.Points(geometry, material);
    points.name = "solventFlow";
    points.frustumCulled = false;
    points.renderOrder = 8;
    group.add(points);

    function clearAll() {
      var k;
      for (k = 0; k < particles.length; k += 1) {
        particles[k].active = false;
        particles[k].alpha = 0;
        alphas[k] = 0;
      }
      accLR = 0;
      accRL = 0;
      totalLR = 0;
      totalRL = 0;
    }

    function slotFor(direction) {
      var base = direction === "LR" ? 0 : maximum;
      var k;
      for (k = 0; k < maximum; k += 1) {
        if (!particles[base + k].active) return base + k;
      }
      if (direction === "LR") {
        k = base + cursorLR;
        cursorLR = (cursorLR + 1) % maximum;
      } else {
        k = base + cursorRL;
        cursorRL = (cursorRL + 1) % maximum;
      }
      return k;
    }

    function setParticleColor(index, text) {
      var color = new THREE.Color(text);
      vertexColors[index * 3] = color.r;
      vertexColors[index * 3 + 1] = color.g;
      vertexColors[index * 3 + 2] = color.b;
      particles[index].color = text;
    }

    function spawn(direction, age, colorText) {
      var index = slotFor(direction);
      var particle = particles[index];
      particle.active = true;
      particle.direction = direction;
      particle.sigma = direction === "LR" ? -range + particle.speed * age : range - particle.speed * age;
      if (Math.abs(particle.sigma) > range) {
        particle.active = false;
        particle.alpha = 0;
        alphas[index] = 0;
      } else {
        setParticleColor(index, colorText);
      }
      if (direction === "LR") totalLR += 1;
      else totalRL += 1;
    }

    function emit(direction, rate, dt, colorText) {
      var old = direction === "LR" ? accLR : accRL;
      var amount;
      var count;
      var k;
      var birthOffset;
      rate = Math.max(0, value(rate, 0));
      amount = old + rate * dt;
      count = Math.floor(amount + 0.000000001);
      if (rate > 0) {
        for (k = 0; k < count; k += 1) {
          birthOffset = (k + 1 - old) / rate;
          spawn(direction, Math.max(0, dt - birthOffset), colorText);
        }
      }
      if (direction === "LR") accLR = amount - count;
      else accRL = amount - count;
    }

    function place(index, t, rm) {
      var particle = particles[index];
      var signed = particle.sigma;
      var left = signed < 0;
      var frame = left ? frameAt(pointsL, lengthsL, -signed, -1) : frameAt(pointsR, lengthsR, signed, 1);
      var wobble = rm ? 0 : Math.sin(t * 1.45 + particle.seed * 31) * 0.035;
      var edge = clamp((range - Math.abs(signed)) / 1.3, 0, 1);
      var alpha = edge * edge * (3 - 2 * edge);
      positions[index * 3] = frame.x + frame.nx * particle.u;
      positions[index * 3 + 1] = frame.y + frame.ny * particle.u;
      positions[index * 3 + 2] = particle.w + wobble;
      particle.alpha = alpha;
      alphas[index] = alpha;
    }

    function refresh(t, rm) {
      var k;
      for (k = 0; k < particles.length; k += 1) {
        if (particles[k].active) place(k, t, rm);
        else alphas[k] = 0;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aColor.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
    }

    function update(t, state) {
      state = state || {};
      var now = value(t, 0);
      var on = state.on === true;
      var moving = state.moving === true;
      var dt;
      var k;
      group.visible = on;
      if (currentT === null || now < currentT) {
        clearAll();
        currentT = now;
        refresh(now, state.rm === true);
        return;
      }
      dt = Math.max(0, now - currentT);
      if (!on || !moving || dt === 0) {
        currentT = now;
        return;
      }
      for (k = 0; k < particles.length; k += 1) {
        if (particles[k].active) {
          particles[k].sigma += (particles[k].direction === "LR" ? 1 : -1) * particles[k].speed * dt;
          if (Math.abs(particles[k].sigma) > range) particles[k].active = false;
        }
      }
      emit("LR", state.rateLR, dt, state.colorL || defaultL);
      emit("RL", state.rateRL, dt, state.colorR || defaultR);
      refresh(now, state.rm === true);
      currentT = now;
      group.userData.stats.totalLR = totalLR;
      group.userData.stats.totalRL = totalRL;
      group.userData.stats.accLR = accLR;
      group.userData.stats.accRL = accRL;
    }

    group.userData.parts = { points: points };
    group.userData.particles = particles;
    group.userData.stats = { totalLR: 0, totalRL: 0, accLR: 0, accRL: 0, range: range, maxPerDir: maximum };
    noShadow(group);
    return { group: group, update: update, dispose: function () { disposeGroup(group); } };
  }

  function makeUTube(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var colors = opts.colors || {};
    var rIn = value(opts.rIn, 1);
    var rOut = value(opts.rOut, 1.25);
    var points = opts.points || [];
    var membraneAt = opts.membraneAt || { x: 0, y: 0 };
    var mats = glassMaterials(THREE, colors);
    var path = curveFrom(THREE, points);
    var tubeGeometry = new THREE.TubeGeometry(path, 216, rOut, 20, false);
    var silhouette = new THREE.Mesh(tubeGeometry, mats.silhouette);
    var inner = new THREE.Mesh(tubeGeometry, mats.inner);
    var outer = new THREE.Mesh(tubeGeometry, mats.outer);
    silhouette.name = "glassSilhouette";
    inner.name = "glassInner";
    outer.name = "glassOuter";
    silhouette.renderOrder = 2;
    inner.renderOrder = 3;
    outer.renderOrder = 4;
    group.add(silhouette);
    group.add(inner);
    group.add(outer);

    var first = points[0];
    var last = points[points.length - 1];
    var ringGeo = new THREE.TorusGeometry((rOut + rIn) / 2, (rOut - rIn) / 2 + 0.04, 10, 40);
    var ringL = new THREE.Mesh(ringGeo, mats.edge);
    var ringR = new THREE.Mesh(ringGeo, mats.edge);
    ringL.rotation.x = Math.PI / 2;
    ringR.rotation.x = Math.PI / 2;
    ringL.position.set(first.x, first.y, 0);
    ringR.position.set(last.x, last.y, 0);
    ringL.renderOrder = 7;
    ringR.renderOrder = 7;
    group.add(ringL);
    group.add(ringR);

    var membraneMat = new THREE.MeshStandardMaterial({
      color: colorValue(colors, "membrane", "#5f6b7a"),
      roughness: 0.76,
      metalness: 0,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });
    var membrane = new THREE.Mesh(new THREE.CylinderGeometry(rOut + 0.05, rOut + 0.05, 0.35, 32, 1, false), membraneMat);
    membrane.rotation.z = Math.PI / 2;
    membrane.position.set(membraneAt.x, membraneAt.y, 0);
    membrane.name = "membrane";
    membrane.userData.role = "membrane";
    membrane.renderOrder = 6;
    group.add(membrane);
    group.userData.parts = { outer: outer, inner: inner, silhouette: silhouette, ringL: ringL, ringR: ringR, membrane: membrane };
    noShadow(group);
    return { group: group, update: function () {}, dispose: function () { disposeGroup(group); } };
  }

  function makeUTubeLiquid(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var colors = opts.colors || {};
    var waterColor = colorValue(colors, "water", "#2f8fc1");
    var soluteColor = colorValue(colors, "solute", "#b45309");
    var rIn = value(opts.rIn, 0.97);
    var armStart = value(opts.armStartY, 3);
    var pointsL = opts.pointsL || [];
    var pointsR = opts.pointsR || [];
    var materialL = liquidMaterial(THREE, waterColor);
    var materialR = liquidMaterial(THREE, waterColor);
    var staticGeoL = new THREE.TubeGeometry(curveFrom(THREE, cutAtArm(pointsL, armStart)), 48, rIn, 20, false);
    var staticGeoR = new THREE.TubeGeometry(curveFrom(THREE, cutAtArm(pointsR, armStart)), 48, rIn, 20, false);
    var bendL = new THREE.Mesh(staticGeoL, materialL);
    var bendR = new THREE.Mesh(staticGeoR, materialR);
    bendL.name = "staticLiquidL";
    bendR.name = "staticLiquidR";
    bendL.userData.role = "staticLiquid";
    bendR.userData.role = "staticLiquid";
    group.add(bendL);
    group.add(bendR);
    var xL = pointsL[pointsL.length - 1].x;
    var xR = pointsR[pointsR.length - 1].x;
    var armGeo = new THREE.CylinderGeometry(rIn, rIn, 1, 24, 1, true);
    var armL = new THREE.Mesh(armGeo, materialL);
    var armR = new THREE.Mesh(armGeo, materialR);
    armL.name = "liquidArmL";
    armR.name = "liquidArmR";
    group.add(armL);
    group.add(armR);
    var meniscusGeo = meniscusGeometry(THREE, rIn, 0.14);
    var meniscusL = new THREE.Mesh(meniscusGeo, materialL);
    var meniscusR = new THREE.Mesh(meniscusGeo, materialR);
    meniscusL.name = "meniscusL";
    meniscusR.name = "meniscusR";
    group.add(meniscusL);
    group.add(meniscusR);
    var current = { hL: null, hR: null, tintL: null, tintR: null };
    var mixedL = new THREE.Color(waterColor);
    var mixedR = new THREE.Color(waterColor);
    function setArm(mesh, meniscus, x, h) {
      var length = Math.max(0.001, h - armStart);
      mesh.scale.y = length;
      mesh.position.set(x, armStart + length / 2, 0);
      meniscus.position.set(x, h, 0);
    }
    function update(t, state) {
      state = state || {};
      var hL = clamp(value(state.hL, armStart), armStart, 25);
      var hR = clamp(value(state.hR, armStart), armStart, 25);
      var tintL = clamp(value(state.tintL, 0), 0, 1);
      var tintR = clamp(value(state.tintR, 0), 0, 1);
      if (hL !== current.hL) { setArm(armL, meniscusL, xL, hL); current.hL = hL; }
      if (hR !== current.hR) { setArm(armR, meniscusR, xR, hR); current.hR = hR; }
      if (tintL !== current.tintL) {
        colorMix(THREE, waterColor, soluteColor, 0.22 * tintL, mixedL);
        materialL.color.copy(mixedL);
        materialL.opacity = 0.66 + tintL * 0.08;
        current.tintL = tintL;
      }
      if (tintR !== current.tintR) {
        colorMix(THREE, waterColor, soluteColor, 0.22 * tintR, mixedR);
        materialR.color.copy(mixedR);
        materialR.opacity = 0.66 + tintR * 0.08;
        current.tintR = tintR;
      }
    }
    group.userData.parts = { armL: armL, armR: armR, bendL: bendL, bendR: bendR, meniscusL: meniscusL, meniscusR: meniscusR };
    noShadow(group);
    return { group: group, update: update, dispose: function () { disposeGroup(group); } };
  }

  root.OSMO_FX = Object.freeze({
    contract: 2,
    makeBeaker: makeBeaker,
    makeBeakerLiquid: makeBeakerLiquid,
    makeRadish: makeRadish,
    makeSolutePoints: makeSolutePoints,
    makeSolventFlow: makeSolventFlow,
    makeUTube: makeUTube,
    makeUTubeLiquid: makeUTubeLiquid
  });
})(window);
/* ================= /OSMO_FX 납품 ================= */

/* ================= FALLBACK_FX ================= */
/* 코덱스 모듈(window.OSMO_FX)이 없을 때의 최소 그림 — 같은 계약(지시안 부록 B) · 전역 하나 · THREE 는 전역 참조 · DOM 접근 0.
   검증스크립트/osmosis_fallback.js 로 잘라내어 납품 모듈과 «같은 하니스»를 돌린다(㊽). */
var FALLBACK_FX = (function () {
  function mat(THREE, color, opacity) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1 });
  }
  function curveFrom(THREE, pts) {              // 점열 → LineCurve3 CurvePath (스플라인 재보간 금지 · 원칙 11)
    var cp = new THREE.CurvePath(), i;
    for (i = 1; i < pts.length; i++)
      cp.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1].x, pts[i - 1].y, 0), new THREE.Vector3(pts[i].x, pts[i].y, 0)));
    return cp;
  }
  function cutBelow(pts, yMax) {               // 반경로에서 y ≤ yMax 구간만(팔 직선에서 절단)
    var out = [], i;
    for (i = 0; i < pts.length; i++) {
      if (i > 0 && pts[i].y > yMax && pts[i].x === pts[i - 1].x) { out.push({ x: pts[i].x, y: yMax }); break; }
      out.push(pts[i]);
    }
    return out;
  }
  function makeBeaker(THREE, o) {
    var g = new THREE.Group();
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(o.rOut, o.rOut, o.height, 32, 1, true), mat(THREE, "#9fb3bf", 0.35));
    wall.position.y = o.height / 2; g.add(wall);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(o.rOut, o.rOut, 0.25, 32), mat(THREE, "#9fb3bf", 0.5));
    base.position.y = 0.125; g.add(base);
    return { group: g, update: function () {}, dispose: function () {} };
  }
  function makeBeakerLiquid(THREE, o) {
    var g = new THREE.Group(), floorY = o.floorY || 0.25;
    var m = new THREE.MeshBasicMaterial({ color: "#2f8fc1", transparent: true, opacity: 0.5, depthWrite: false }), water = new THREE.Color("#2f8fc1"), deep = new THREE.Color("#0f4c7a");   // 농도 ↑ → 같은 청색이 짙어짐(탭 ① 규칙) · 무광(조명 무관 · 용질별 색이 그대로 보이게)
    var col = new THREE.Mesh(new THREE.CylinderGeometry(o.rIn, o.rIn, 1, 32), m);
    col.receiveShadow = true; g.add(col);
    var cur = { level: null, tint: null };
    return { group: g, update: function (t, s) {
      if (s.level !== cur.level) { var h = Math.max(0.01, s.level - floorY); col.scale.y = h; col.position.y = floorY + h / 2; cur.level = s.level; }
      var key = s.tint + "|" + (s.deepColor || "");
      if (key !== cur.tint) { if (s.deepColor) deep.set(s.deepColor); m.color.copy(water).lerp(deep, s.tint); cur.tint = key; }   // 용질별 끝색(contract 2 · 선택 키)
    }, dispose: function () { col.geometry.dispose(); m.dispose(); } };
  }
  function makeRadish(THREE, o) {
    var g = new THREE.Group(), m = mat(THREE, "#a08f55", 1);          // 흰 무대·옅은 액체 속에서 실루엣이 읽히게 황갈색(하니스 무 존재 ≥ 40 % · «제자리» ≥ 28 % — 상아색은 조명에 눌려 배경과 섞인다)
    var body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 4.2, 24), m);
    body.position.y = 2.1; body.castShadow = true; body.receiveShadow = true; g.add(body);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 0.6, 16), mat(THREE, "#7fb069", 1));
    top.position.y = 4.2 + 0.3; g.add(top);
    return { group: g, update: function (t, s) {
      g.scale.set(s.scale, s.scale, s.scale);
      m.color.setStyle(s.turgor < 0 ? "#86753f" : "#a08f55");   // 최소 표현: 쪼글이면 어둡게(밝게 하면 조명에 눌려 흰색으로 날아간다 — 하니스 #13 40 %)
    }, dispose: function () {} };
  }
  function makeSolutePoints(THREE, o) {
    var g = new THREE.Group(), max = o.max || 200, geo = new THREE.BufferGeometry();
    var pos = new Float32Array(max * 3), i, seed = (o.seed || 1) * 9301 + 49297;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var home = [];
    for (i = 0; i < max; i++) home.push([rnd(), rnd(), rnd()]);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var pm = new THREE.PointsMaterial({ color: "#b45309", size: 0.45, sizeAttenuation: true, transparent: false });
    var pts = new THREE.Points(geo, pm); pts.frustumCulled = false; g.add(pts);
    return { group: g, update: function (t, s) {
      var n = Math.min(max, s.count | 0), r = s.region, ex = s.exclude, k = 0, w = s.rm ? 0 : 0.06 * Math.sin(t * 2.1);
      if (s.color) pm.color.set(s.color);                                             // 용질별 색(contract 2 · 선택 키)
      for (i = 0; i < max && k < n; i++) {
        var a = home[i][0] * Math.PI * 2, rr = Math.sqrt(home[i][1]) * r.r, x, y, z;
        if (r.path) {                                                                  // 경로 관: 호 길이 s ∈ [s0, s1] 균일 · 단면 원판(접선 직교)
          var q = pathPoint(r.path, r.s0 + home[i][2] * (r.s1 - r.s0)), ux = -q.ty, uy = q.tx;   // 평면 법선(접선을 90° 돌림) · z 축
          x = q.x + ux * rr * Math.cos(a); y = q.y + uy * rr * Math.cos(a); z = rr * Math.sin(a);
        } else { y = r.y0 + home[i][2] * (r.y1 - r.y0); x = r.cx + rr * Math.cos(a); z = r.cz + rr * Math.sin(a); }
        if (ex && (x - ex.cx) * (x - ex.cx) + (z - ex.cz) * (z - ex.cz) < ex.r * ex.r && y >= ex.y0 && y <= ex.y1) continue;
        pos[k * 3] = x + w; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; k++;
      }
      geo.setDrawRange(0, k); geo.attributes.position.needsUpdate = true;
    }, dispose: function () { geo.dispose(); pm.dispose(); } };
  }
  function pathPoint(path, s) {                                                        // 점열 위 호 길이 s 의 위치·접선(폴백 · 원칙 11: 렌더가 쓰는 그 점열)
    var i, acc = 0;
    for (i = 1; i < path.length; i++) {
      var dx = path[i].x - path[i - 1].x, dy = path[i].y - path[i - 1].y, L = Math.sqrt(dx * dx + dy * dy);
      if (acc + L >= s || i === path.length - 1) { var f = L > 0 ? Math.max(0, Math.min(1, (s - acc) / L)) : 0; return { x: path[i - 1].x + dx * f, y: path[i - 1].y + dy * f, tx: L > 0 ? dx / L : 1, ty: L > 0 ? dy / L : 0 }; }
      acc += L;
    }
    return { x: path[0].x, y: path[0].y, tx: 1, ty: 0 };
  }
  function makeSolventFlow(THREE, o) {                                                 // 최소 표현: 막 양쪽 ±range 를 오가는 점 · 위쪽 반 R→L · 아래쪽 반 L→R · 색 고정
    var g = new THREE.Group(), max = o.maxPerDir || 60, geo = new THREE.BufferGeometry(), range = o.range || 6.5;
    var pos = new Float32Array(max * 2 * 3), col = new Float32Array(max * 2 * 3), i, seed = (o.seed || 1) * 9301 + 49297;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var P = [];                                                                        // 입자: direction("LR"/"RL") · sigma(호 길이 · 막 기준 부호) · u · w · v · active · color · alpha — 하니스가 userData 로 읽는 이름
    for (i = 0; i < max * 2; i++) P.push({ dir: i < max ? 1 : -1, direction: i < max ? "LR" : "RL", sigma: 0, u: 0, w: 0, v: 2.2 * (0.85 + 0.3 * rnd()), active: false, color: "", alpha: 0, r: 0, gg: 0, b: 0 });
    var stats = { totalLR: 0, totalRL: 0, range: range, maxPerDir: max }; g.userData.particles = P; g.userData.stats = stats;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var pm = new THREE.PointsMaterial({ size: 0.6, sizeAttenuation: true, vertexColors: true, transparent: false });
    var pts = new THREE.Points(geo, pm); pts.frustumCulled = false; g.add(pts);
    var acc = { LR: 0, RL: 0 }, last = null, cL = new THREE.Color("#1641b6"), cR = new THREE.Color("#1641b6");
    function spawn(dir) { for (i = 0; i < P.length; i++) { var q = P[i]; if (q.dir === dir && !q.active) { q.active = true; q.sigma = -dir * range; q.u = (dir > 0 ? -1 : 1) * (0.12 + 0.68 * rnd()); q.w = (rnd() - 0.5) * 1.2; var c = dir > 0 ? cL : cR; q.r = c.r; q.gg = c.g; q.b = c.b; q.color = "#" + c.getHexString(); if (dir > 0) stats.totalLR++; else stats.totalRL++; return; } } }
    return { group: g, update: function (t, s) {
      g.visible = !!s.on; if (!s.on) return;
      if (s.colorL) cL.set(s.colorL); if (s.colorR) cR.set(s.colorR);
      if (last !== null && t < last) { P.forEach(function (q) { q.active = false; q.alpha = 0; }); stats.totalLR = 0; stats.totalRL = 0; acc.LR = 0; acc.RL = 0; }   // 시계가 되감기면 초기화(납품 모듈과 같은 규약)
      var dt = last === null ? 0 : Math.max(0, Math.min(0.1, t - last)); last = t;
      if (s.moving) {
        acc.LR += (s.rateLR || 0) * dt; acc.RL += (s.rateRL || 0) * dt;
        while (acc.LR >= 1) { spawn(1); acc.LR -= 1; } while (acc.RL >= 1) { spawn(-1); acc.RL -= 1; }
      }
      for (i = 0; i < P.length; i++) { var q = P[i];                                     // 버퍼 칸 = 입자 번호(납품 모듈과 같은 배치 · 하니스가 userData 번호로 position 을 읽는다)
        if (q.active && s.moving) q.sigma += q.dir * q.v * dt;
        if (q.active && Math.abs(q.sigma) > range) { q.active = false; q.alpha = 0; }
        if (!q.active) { pos[i * 3] = 0; pos[i * 3 + 1] = -999; pos[i * 3 + 2] = 0; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; continue; }   // 비활성 = 화면 밖
        var path = q.sigma < 0 ? o.pointsL : o.pointsR, pt = pathPoint(path, Math.abs(q.sigma)), sg = q.sigma < 0 ? -1 : 1, ux = -pt.ty * sg, uy = pt.tx * sg;   // 왼쪽 반경로는 접선이 −x 라 법선 부호를 뒤집어야 «위/아래»가 좌우에서 같다(S-검토 B-1)
        var fade = Math.min(1, (range - Math.abs(q.sigma)) / 1.3), jitter = s.rm ? 0 : 0.05 * Math.sin(t * 3 + i); q.alpha = fade;
        pos[i * 3] = pt.x + ux * q.u * 0.97; pos[i * 3 + 1] = pt.y + uy * q.u * 0.97 + jitter; pos[i * 3 + 2] = q.w * 0.97;
        col[i * 3] = q.r * fade + (1 - fade); col[i * 3 + 1] = q.gg * fade + (1 - fade); col[i * 3 + 2] = q.b * fade + (1 - fade);   // 스르륵: 흰색으로 섞여 사라짐(폴백)
      }
      geo.setDrawRange(0, P.length); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    }, dispose: function () { geo.dispose(); pm.dispose(); } };
  }
  function makeUTube(THREE, o) {
    var g = new THREE.Group(), path = curveFrom(THREE, o.points);
    var tube = new THREE.Mesh(new THREE.TubeGeometry(path, 192, o.rOut, 24, false), mat(THREE, "#9fb3bf", 0.3));
    g.add(tube);
    var mem = new THREE.Mesh(new THREE.CylinderGeometry(o.rIn, o.rIn, 0.12, 24), mat(THREE, "#5f6b7a", 0.9));
    mem.rotation.z = Math.PI / 2; mem.position.set(o.membraneAt.x, o.membraneAt.y, 0); g.add(mem);
    return { group: g, update: function () {}, dispose: function () { tube.geometry.dispose(); } };
  }
  function makeUTubeLiquid(THREE, o) {
    var g = new THREE.Group(), y3 = o.armStartY || 3, cur = { hL: null, hR: null, tL: null, tR: null };
    var water = new THREE.Color("#2f8fc1"), sol = new THREE.Color("#b45309");
    var mL = mat(THREE, "#2f8fc1", 0.85), mR = mat(THREE, "#2f8fc1", 0.85);
    var baseL = new THREE.Mesh(new THREE.TubeGeometry(curveFrom(THREE, cutBelow(o.pointsL, y3)), 64, o.rIn, 24, false), mL);
    var baseR = new THREE.Mesh(new THREE.TubeGeometry(curveFrom(THREE, cutBelow(o.pointsR, y3)), 64, o.rIn, 24, false), mR);
    g.add(baseL); g.add(baseR);
    var xL = o.pointsL[o.pointsL.length - 1].x, xR = o.pointsR[o.pointsR.length - 1].x;
    var armL = new THREE.Mesh(new THREE.CylinderGeometry(o.rIn, o.rIn, 1, 24), mL);
    var armR = new THREE.Mesh(new THREE.CylinderGeometry(o.rIn, o.rIn, 1, 24), mR);
    g.add(armL); g.add(armR);
    function setArm(arm, x, h) { var len = Math.max(0.01, h - y3); arm.scale.y = len; arm.position.set(x, y3 + len / 2, 0); }
    return { group: g, update: function (t, s) {
      if (s.hL !== cur.hL) { setArm(armL, xL, s.hL); cur.hL = s.hL; }
      if (s.hR !== cur.hR) { setArm(armR, xR, s.hR); cur.hR = s.hR; }
      if (s.tintL !== cur.tL) { mL.color.copy(water).lerp(sol, s.tintL * 0.35); cur.tL = s.tintL; }
      if (s.tintR !== cur.tR) { mR.color.copy(water).lerp(sol, s.tintR * 0.35); cur.tR = s.tintR; }
    }, dispose: function () { baseL.geometry.dispose(); baseR.geometry.dispose(); } };
  }
  return Object.freeze({ contract: 2, fallback: true,
    makeBeaker: makeBeaker, makeBeakerLiquid: makeBeakerLiquid, makeRadish: makeRadish,
    makeSolutePoints: makeSolutePoints, makeUTube: makeUTube, makeUTubeLiquid: makeUTubeLiquid, makeSolventFlow: makeSolventFlow });
})();
/* ================= /FALLBACK_FX ================= */

/* ================= 화면 (ES5 · 계산부의 함수만 부른다 · display 대입은 applyTab()/sync() 안에서만) ================= */
(function () {
  if (typeof document === "undefined") return;                    // node 에서 계산부만 require 될 때
  var $ = function (id) { return document.getElementById(id); };
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var FX = (window.OSMO_FX && window.OSMO_FX.contract === 2) ? window.OSMO_FX : FALLBACK_FX;   // 납품 모듈(계약 2 · 7팩토리)이 아니면 최소 그림(화면에 배지)
  var QS = (function () { var q = {}; (location.search || "").replace(/^\?/, "").split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); }); return q; })();
  var COL = (function () {                                          // 토큰은 CSS 에서 읽는다(§4) · 실물색 예외는 여기 명시
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { water: "#2f8fc1", solute: g("--d-amber") || "#b45309", dot: "#d97706", rim: "#7c2d12", glass: "#a6dded", glassEdge: "#3f7893",
             membrane: g("--d-gray") || "#5f6b7a", tick: g("--t2") || "#454b52", flesh: "#f6f2e9", skin: "#e9e2d2", top: "#7fb069",
             waterDeep: "#0f4c7a" };                                        // 탭 ① 2 M 수용액 색(같은 청색 계열 · 짙음) — 코덱스 v4 makeBeakerLiquid 가 water→waterDeep 를 tint 로 섞는다
  })();

  /* ---------- 상태 단일 원천(탭별 · 지시안 A-28) ---------- */
  var st = {
    tab: "radish",
    radish: { phase: "idle", t: 0, m: 80, sol: "sucrose", C: 0 },
    utube:  { phase: "idle", t: 0, sol: "sucrose", cL0: UT.cL0, cR0: UT.cR0, xiEq: 0, solvent: false }   // solvent = 「용매 입자 표시하기」 토글(사용자 지시 2026-09-20)
  };
  function settled(tab) {                                          // 래퍼 — 캡션·배지·잠금 해제는 이것만 부른다(코어 직접 호출은 여기 1곳)
    var s = st[tab]; if (s.phase === "idle") return false;
    return tab === "radish" ? radishSettled(s.t) : utubeSettled(s.t);
  }
  function radishNow() {                                           // 탭 ① 현재 관측값(phase 에 따라)
    var s = st.radish, dmEnd = radishDm(s.C, s.m), u = s.phase === "idle" ? 0 : Math.min(1, s.t / RADISH_T_END);
    var dm = dmEnd * radishProgress(u);
    return { dmEnd: dmEnd, dm: dm, scale: radishScale(s.m, dm), turgor: radishTurgor(s.m, dm), u: u };
  }
  function utubeNow() {                                            // 탭 ② 현재 관측값
    var s = st.utube, xi = s.phase === "idle" ? 0 : utubeXi(s.t, s.xiEq);
    return utubeState(s.cL0, s.cR0, xi);
  }

  /* ---------- 가시성(§13) ---------- */
  function setDisp(sel, on) { var els = document.querySelectorAll(sel), i; for (i = 0; i < els.length; i++) els[i].style.display = on ? "" : "none"; }
  function applyTab() {
    var vis = SHOW[st.tab];
    setDisp(".only-tab-radish", vis.tabRadish); setDisp(".only-tab-utube", vis.tabUtube);
    var tabs = document.querySelectorAll(".tabb"), i;
    for (i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-pressed", tabs[i].getAttribute("data-tab") === st.tab ? "true" : "false");
    if (T3) T3.cv.className = "scene-canvas" + (st.tab === "utube" ? " is-fixed" : "");
  }

  /* ---------- readout·캡션·잠금 — 전부 상태에서 다시 쓴다 ---------- */
  function each(sel, fn) { var els = document.querySelectorAll(sel), i; for (i = 0; i < els.length; i++) fn(els[i]); }
  function tag(t, on) { return '<span class="tag' + (on ? " is-on" : "") + '">' + t + "</span>"; }
  function sync() {
    var r = st.radish, R = radishNow(), rs = settled("radish");
    $("sMass").textContent = r.m + " g";
    $("vM0").textContent = fmtG(r.m);
    $("vM1").textContent = r.phase === "idle" ? "—" : fmtG(r.m + R.dm);
    $("vDm").textContent = r.phase === "idle" ? "—" : (R.dm > 0 ? "+" : "") + fmtG(R.dm);
    $("vClock").textContent = fmtClock(Math.min(RADISH_T_END, r.phase === "idle" ? 0 : r.t) * RADISH_MIN_PER_S * 60);   // 화면 s × 2 분/s × 60 = 가상 초
    var b = $("dmBadge");
    if (rs) { var bt = radishBadge(r.C, r.m); b.textContent = bt; b.className = "badge " + (bt === "표 값" ? "is-table" : "is-est"); }
    else if (r.phase === "running") { b.textContent = TXT.measuring; b.className = "badge is-est"; }
    else b.className = "badge is-hidden";
    $("radishCap").style.display = rs ? "" : "none";
    if (rs) $("radishCap").textContent = TXT.radishCaption(R.dmEnd);
    var lock1 = r.phase === "running";
    $("mass").disabled = lock1; each(".sol1", function (el) { el.disabled = lock1; }); each(".conc", function (el) { el.disabled = lock1; });
    $("soakBtn").disabled = r.phase !== "idle";
    each(".sol1", function (el) { el.setAttribute("aria-pressed", el.getAttribute("data-sol") === r.sol ? "true" : "false"); });
    each(".conc", function (el) { el.setAttribute("aria-pressed", Number(el.getAttribute("data-c")) === r.C ? "true" : "false"); });

    var u = st.utube, U = utubeNow(), us = settled("utube");
    $("sCL").textContent = fmtM(u.cL0) + " M"; $("sCR").textContent = fmtM(u.cR0) + " M";
    $("vCL").textContent = fmtM(U.CL); $("vCR").textContent = fmtM(U.CR); $("vDh").textContent = fmtCm(U.dh);
    $("dhMeasuring").className = "badge is-est" + (u.phase === "running" ? "" : " is-hidden");
    $("eqCap").style.display = us ? "" : "none";
    if (us) $("eqCap").textContent = u.cL0 === u.cR0 ? TXT.eqCaption.b(U.CL) : TXT.eqCaption.a(U.CL, U.CR);
    var lock2 = u.phase === "running";
    $("cL").disabled = lock2; $("cR").disabled = lock2; each(".sol2", function (el) { el.disabled = lock2; });
    $("runBtn").disabled = u.phase !== "idle";
    $("solventBtn").setAttribute("aria-pressed", u.solvent ? "true" : "false"); $("solventBtn").className = "btn" + (u.solvent ? " is-on" : "");
    $("solventNote").style.display = u.solvent ? "" : "none"; if (u.solvent) $("solventNote").textContent = TXT.solventNote;
    each(".sol2", function (el) { el.setAttribute("aria-pressed", el.getAttribute("data-sol") === u.sol ? "true" : "false"); });
    /* 탭 ① 범례 스와치: 현재 용질의 1 M(중간)·2 M(끝) 색 — 코어 SOLUTE_COLORS 가 원천 */
    var sc = soluteColors(r.sol); $("swDeep").style.background = sc.deep; $("swMid").style.background = mixHex(COL.water, sc.deep, 0.5);
    each("[data-sw]", function (el) { var k = el.getAttribute("data-sw"); el.style.background = k === "water" ? COL.water : k === "membrane" ? COL.membrane : k === "solventLo" ? solventColor(Math.min(u.cL0, u.cR0)) : k === "solventHi" ? solventColor(Math.max(u.cL0, u.cR0)) : soluteColors(k).dot; });   // 용매 스와치 = 실제 묽은/진한 쪽 색   // 탭 ② 스와치도 코어가 원천(S-검토 B-7)

    var cap = $("stageCap");
    if (st.tab === "radish") cap.innerHTML = tag(r.phase === "idle" ? "대기" : (rs ? TXT.doneBadge : TXT.measuring), rs) + (r.phase === "idle" ? "조건을 정하고 「20분 담그기」를 누르세요." : (rs ? "20분이 지났습니다 — 저울 값을 읽으세요." : "무를 담가 두고 있습니다…"));
    else cap.innerHTML = tag(u.phase === "idle" ? "대기" : (us ? TXT.eqBadge : TXT.measuring), us) + (u.phase === "idle" ? "양쪽 농도를 정하고 「실험 시작」을 누르세요." : (us ? "액면이 멈췄습니다." : "물이 막을 건너는 중입니다…"));
  }

  /* ---------- 조작 ---------- */
  var solventReset = false;                                          // 「초기화」·settled 뒤 조작 → 다음 프레임에 용매 시계를 되감아 모듈이 입자를 비운다(S-검토 B-5)
  function toIdle(tab) { var s = st[tab]; s.phase = "idle"; s.t = 0; if (tab === "utube") solventReset = true; }
  function onInput(tab) { if (st[tab].phase === "settled") toIdle(tab); sync(); }   // settled 뒤 조작 → idle(§14 ③-3) · running 중엔 disabled 라 오지 않는다
  $("mass").addEventListener("input", function () { st.radish.m = Number(this.value); onInput("radish"); });
  each(".sol1", function (el) { el.addEventListener("click", function () { st.radish.sol = el.getAttribute("data-sol"); onInput("radish"); }); });
  each(".conc", function (el) { el.addEventListener("click", function () { st.radish.C = Number(el.getAttribute("data-c")); onInput("radish"); }); });
  $("soakBtn").addEventListener("click", function () { if (st.radish.phase !== "idle") return; st.radish.phase = "running"; st.radish.t = 0; sync(); });
  $("soakReset").addEventListener("click", function () { toIdle("radish"); sync(); });
  $("cL").addEventListener("input", function () { st.utube.cL0 = Number(this.value); onInput("utube"); });
  $("cR").addEventListener("input", function () { st.utube.cR0 = Number(this.value); onInput("utube"); });
  each(".sol2", function (el) { el.addEventListener("click", function () { st.utube.sol = el.getAttribute("data-sol"); onInput("utube"); }); });
  $("runBtn").addEventListener("click", function () { var u = st.utube; if (u.phase !== "idle") return; u.xiEq = utubeEq(u.cL0, u.cR0); u.phase = "running"; u.t = 0; sync(); });
  $("runReset").addEventListener("click", function () { toIdle("utube"); sync(); });
  $("solventBtn").addEventListener("click", function () { st.utube.solvent = !st.utube.solvent; sync(); });   // 언제든 켜고 끔 · 실험 상태와 무관
  each(".tabb", function (el) { el.addEventListener("click", function () { st.tab = el.getAttribute("data-tab"); lastT = null; applyTab(); sync(); }); });
  (function () { var ol = $("limits"), i; for (i = 0; i < TXT.limits.length; i++) { var li = document.createElement("li"); li.textContent = TXT.limits[i]; ol.appendChild(li); } })();
  $("legendNoteRadish").textContent = "— " + TXT.legendRadish; $("legendNoteUtube").textContent = "— " + TXT.legendUtube;   // 범례 문구도 TXT 가 원천
  if (RM) $("rmNote").classList.remove("is-hidden");

  /* ---------- three.js 무대 — 렌더러 1개 · 씬 2개(탭 = 씬 교체) ---------- */
  var HP = utubeHalfPaths();                                        // 막(0,0)→개구 반경로 27점 × 2 — 유리·액체·점·용매 흐름이 «같은 점열»을 쓴다(원칙 11)
  var DOT_S0 = 0.35, DOT_S_END = 0.15;                             // cm · 점: 막 원판 바로 옆부터 액면 조금 아래까지 (용매 범위 SOLVENT_RANGE 는 계산부)
  function mixHex(a, b, t) { var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), o = 0, i; for (i = 0; i < 3; i++) { var sh = 16 - 8 * i, x = (A >> sh) & 255, y = (B >> sh) & 255; o |= Math.round(x + (y - x) * t) << sh; } return "#" + ("000000" + o.toString(16)).slice(-6); }
  var T3 = null;
  function buildStage() {
    var cv = $("stage"), ctx = null;
    if (QS.fallback === "1" || typeof THREE === "undefined") return null;
    try { ctx = cv.getContext("webgl", { antialias: true }); } catch (e) { ctx = null; }
    if (!ctx) return null;
    var renderer = new THREE.WebGLRenderer({ canvas: cv, context: ctx, antialias: true });
    var scenes = {}, cams = {}, fx = {}, applied = {};
    function build(which) {
      var sc = new THREE.Scene(); scenes[which] = sc;
      applied[which] = applyScene(THREE, renderer, sc, OSMO_SCENE, which, document);
      var C = OSMO_SCENE.camera[which], cam = new THREE.PerspectiveCamera(C.fov, 1, 0.1, 200); cams[which] = cam;
      var g = {};
      if (which === "beaker") {
        g.beaker = FX.makeBeaker(THREE, { rIn: BEAKER.rIn, rOut: BEAKER.rOut, height: BEAKER.height, tickEveryMl: 100, colors: COL });
        g.beakerLiquid = FX.makeBeakerLiquid(THREE, { rIn: 3.95, floorY: BEAKER.floorY, colors: COL });
        g.radish = FX.makeRadish(THREE, { colors: COL, seed: 7 }); g.radish.group.position.set(0, BEAKER.floorY, 0);
        sc.add(g.beaker.group); sc.add(g.beakerLiquid.group); sc.add(g.radish.group);   // 탭 ① 용질 점 없음 — 농도는 액체 색으로(사용자 지시 2026-09-20)
      } else {
        var hp = HP;
        g.utube = FX.makeUTube(THREE, { points: utubeCenterline(), rIn: UT.rIn, rOut: UT.rOut, membraneAt: { x: 0, y: 0 }, colors: COL });
        g.utubeLiquid = FX.makeUTubeLiquid(THREE, { pointsL: hp.pointsL, pointsR: hp.pointsR, rIn: 0.97, armStartY: UT.hMin, colors: COL });
        g.dotsL = FX.makeSolutePoints(THREE, { max: 200, colors: COL, seed: 21 });
        g.dotsR = FX.makeSolutePoints(THREE, { max: 200, colors: COL, seed: 22 });
        g.solvent = FX.makeSolventFlow(THREE, { pointsL: hp.pointsL, pointsR: hp.pointsR, rIn: 0.97, range: SOLVENT_RANGE, maxPerDir: 60, seed: 31,
                                                colors: { solventL: solventColor(0), solventR: solventColor(0) } });   // 「용매 입자 표시하기」(contract 2)
        sc.add(g.utube.group); sc.add(g.utubeLiquid.group); sc.add(g.dotsL.group); sc.add(g.dotsR.group); sc.add(g.solvent.group);
      }
      fx[which] = g;
    }
    try { build("beaker"); build("utube"); } catch (e) { console.error("OSMO_FX 접합 실패", e); return null; }
    var C0 = OSMO_SCENE.camera.beaker;
    return { cv: cv, renderer: renderer, scenes: scenes, cams: cams, fx: fx, applied: applied,
             orbit: { yaw: C0.yaw0 * Math.PI / 180, pitch: C0.pitch0 * Math.PI / 180, dist: C0.dist, target: C0.target } };
  }
  var SIDE_MARGIN = 1.6;                                           // cm · 라벨·테두리 여유(가로 시야 하한 유도용)
  function resize() {
    if (!T3) return;
    var w = T3.cv.clientWidth, h = T3.cv.clientHeight; if (w < 8 || h < 8) return;
    T3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, OSMO_SCENE.dprMax));
    T3.renderer.setSize(w, h, false);
    ["beaker", "utube"].forEach(function (k) {
      var C = OSMO_SCENE.camera[k], cam = T3.cams[k], base = C.fov, aspect = w / h;
      /* 좁은(세로) 화면 가로 시야 하한 — 고정 각이 아니라 «그 씬이 가로로 필요한 폭»에서 유도(원칙 13):
         비커 = 바깥 반지름 + 라벨 여유 / U자관 = 팔 간격 + 바깥 반지름 + 여유.  거리는 카메라 상수에서. */
      var halfW = k === "beaker" ? BEAKER.rOut + SIDE_MARGIN : UT.armX + UT.rOut + SIDE_MARGIN;
      var dist = k === "beaker" ? C.dist : Math.sqrt(Math.pow(C.pos[0] - C.target[0], 2) + Math.pow(C.pos[1] - C.target[1], 2) + Math.pow(C.pos[2] - C.target[2], 2));
      var MIN_H = 2 * Math.atan(halfW / dist), vBase = base * Math.PI / 180, hFov = 2 * Math.atan(Math.tan(vBase / 2) * aspect);
      cam.aspect = aspect; cam.fov = hFov >= MIN_H ? base : 2 * Math.atan(Math.tan(MIN_H / 2) / aspect) * 180 / Math.PI; cam.updateProjectionMatrix();
    });
    if (rafId === null && typeof render === "function") render(0);   // 루프가 멈춰 있을 때(숨김·프로브 freeze) 크기가 바뀌면 setSize 가 지운 캔버스를 바로 다시 그린다
  }
  function placeCamera(which) {
    var cam = T3.cams[which];
    if (which === "beaker") {
      var o = T3.orbit;
      cam.position.set(o.target[0] + o.dist * Math.sin(o.yaw) * Math.cos(o.pitch), o.target[1] + o.dist * Math.sin(o.pitch), o.target[2] + o.dist * Math.cos(o.yaw) * Math.cos(o.pitch));
      cam.lookAt(o.target[0], o.target[1], o.target[2]);
    } else { var u = OSMO_SCENE.camera.utube; cam.position.set(u.pos[0], u.pos[1], u.pos[2]); cam.lookAt(u.target[0], u.target[1], u.target[2]); }
  }
  function bindOrbit(cv) {                                          // 탭 ①만 회전(A-10) · 탭 ②는 정면 고정(K1)
    var down = null, C = OSMO_SCENE.camera.beaker;
    cv.addEventListener("pointerdown", function (e) { if (st.tab !== "radish") return; down = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", function (e) {
      if (!down) return; var o = T3.orbit;
      o.yaw -= (e.clientX - down.x) * 0.005;                        // 반전(사용자 지시 2026-09-20): 커서가 가는 반대쪽으로 시선이 돈다 — 이후 360° 시뮬 공통 규약 후보
      o.pitch = Math.max(C.pitchMin * Math.PI / 180, Math.min(C.pitchMax * Math.PI / 180, o.pitch - (e.clientY - down.y) * 0.005));
      down.x = e.clientX; down.y = e.clientY;
    });
    cv.addEventListener("pointerup", function () { down = null; });
    cv.addEventListener("pointercancel", function () { down = null; });
  }
  function placeLabel(id, x, y, z, which) {
    var el = $(id); if (!el || !T3) return;
    var p = new THREE.Vector3(x, y, z).project(T3.cams[which]);
    if (p.z > 1) { el.classList.add("is-hidden"); return; }
    el.classList.remove("is-hidden");
    var w = T3.cv.clientWidth, h = T3.cv.clientHeight;
    var lx = (p.x * 0.5 + 0.5) * w - el.offsetWidth / 2, ly = (-p.y * 0.5 + 0.5) * h - el.offsetHeight / 2;
    el.style.left = Math.max(4, Math.min(w - el.offsetWidth - 4, lx)) + "px";
    el.style.top = Math.max(4, Math.min(h - el.offsetHeight - 4, ly)) + "px";
  }
  function hideLabels(ids) { ids.forEach(function (id) { $(id).classList.add("is-hidden"); }); if (ids.indexOf("lblRadish") >= 0) $("leader").classList.add("is-hidden"); }
  /* 무의 질량 콜아웃 — 무 오른쪽 허리(x = 반폭·배율, y = 높이·배율·0.55)에 닿는 지시선 «_/» + 라벨. 값 = 처음 질량 + 현재 Δm(진행 중이면 실시간) */
  function placeMassCallout(mass, scale) {
    var el = $("lblRadish"), sv = $("leader"), pl = $("leaderLine"); if (!el || !T3) return;
    el.textContent = "무의 질량 " + fmtG(mass) + " g";
    var a = new THREE.Vector3(RADISH_BBOX.hx * scale * 0.92, BEAKER.floorY + RADISH_BBOX.h * scale * 0.55, 0).project(T3.cams.beaker);
    if (a.z > 1) { el.classList.add("is-hidden"); sv.classList.add("is-hidden"); return; }
    el.classList.remove("is-hidden"); sv.classList.remove("is-hidden");
    var w = T3.cv.clientWidth, h = T3.cv.clientHeight, ax = (a.x * 0.5 + 0.5) * w, ay = (-a.y * 0.5 + 0.5) * h;
    var dx = Math.round(Math.min(34, w * 0.06)), dy = -dx;                                   // 대각선 «/» 한 토막(위·오른쪽)
    var lx = ax + dx + 6, ly = ay + dy - el.offsetHeight / 2;                                 // 라벨 왼쪽 가운데가 수평선 «_» 끝에 닿는다
    lx = Math.max(4, Math.min(w - el.offsetWidth - 4, lx)); ly = Math.max(4, Math.min(h - el.offsetHeight - 4, ly));
    el.style.left = lx + "px"; el.style.top = ly + "px";
    var ex = lx - 3, ey = ly + el.offsetHeight / 2, kx = Math.min(ax + dx, ex - 2), ky = ey;  // 꺾임점: 수평선 높이
    pl.setAttribute("points", ax.toFixed(1) + "," + ay.toFixed(1) + " " + kx.toFixed(1) + "," + ky.toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1));
    sv.setAttribute("viewBox", "0 0 " + w + " " + h);
  }
  function solName(id) { var i; for (i = 0; i < SOLUTES.length; i++) if (SOLUTES[i].id === id) return SOLUTES[i].name; return ""; }
  function shortM(c) { return fmtM(c).replace(/\.?0+$/, ""); }

  /* ---------- FX 상태 갱신 + 렌더(시계는 여기 · 모듈은 그림만 · §15) ---------- */
  var tFx = 0;
  function render(dtDecor) {
    if (!T3) return;
    tFx += dtDecor;
    if (st.tab === "radish") {
      var r = st.radish, R = radishNow(), g = T3.fx.beaker;
      g.beakerLiquid.update(tFx, { level: BEAKER.floorY + BEAKER.level, tint: soluteTint(r.C), deepColor: soluteColors(r.sol).deep, rm: RM });   // tint = C/2 → 용질별 끝색으로 짙어진다(코덱스 v5)
      g.radish.update(tFx, { scale: R.scale, turgor: R.turgor, rm: RM });
      placeCamera("beaker"); T3.renderer.render(T3.scenes.beaker, T3.cams.beaker);
      $("lblLiquid").textContent = r.C === 0 ? "증류수" : shortM(r.C) + " M " + solName(r.sol) + " 수용액";
      placeLabel("lblLiquid", -3.2, BEAKER.floorY + BEAKER.level + 1.2, 0, "beaker");
      placeMassCallout(r.m + R.dm, R.scale);                            // 무의 질량 «화면 안» 콜아웃(지시선 _/ · 실시간 · 사용자 지시 2026-09-20)
      hideLabels(["lblMembrane", "lblLeft", "lblRight"]);
    } else {
      var u = st.utube, U = utubeNow(), q = T3.fx.utube;
      q.utubeLiquid.update(tFx, { hL: U.hL, hR: U.hR, tintL: soluteTint(u.cL0), tintR: soluteTint(u.cR0), rm: RM });
      var dc = soluteColors(u.sol), hp2 = HP;                                        // 점 = 막 옆 바닥·굽이·팔 «전 구간»(경로 관 · 사용자 지시 2026-09-20) · 용질별 색
      q.dotsL.update(tFx, { count: soluteDots(u.cL0), region: { path: hp2.pointsL, r: 0.9, s0: DOT_S0, s1: utubePathLen(U.hL) - DOT_S_END }, exclude: null, rm: RM, color: dc.dot, rim: dc.rim });
      q.dotsR.update(tFx, { count: soluteDots(u.cR0), region: { path: hp2.pointsR, r: 0.9, s0: DOT_S0, s1: utubePathLen(U.hR) - DOT_S_END }, exclude: null, rm: RM, color: dc.dot, rim: dc.rim });
      var fr = solventRates(U.CL, U.CR, U.dh, (u.cR0 - u.cL0) / UT.cMax);           // 구동력(시작값으로 정규화) → 양방향 생성률(입자/s) · 평형에서 같음
      if (solventReset) { q.solvent.update(-1, { on: u.solvent, moving: false, rateLR: 0, rateRL: 0, rm: RM }); solventReset = false; }   // 시계 되감기(now < currentT) = clearAll
      q.solvent.update(tFx * SOLVENT_CLOCK, { on: u.solvent, moving: u.phase !== "idle" && !RM, rateLR: fr.LR, rateRL: fr.RL, colorL: solventColor(u.cL0), colorR: solventColor(u.cR0), rm: RM });   // 시계 ×1.3 = 속도·생성률 ×1.3 · RM 이면 정지
      placeCamera("utube"); T3.renderer.render(T3.scenes.utube, T3.cams.utube);
      $("lblLeft").textContent = u.cL0 === 0 ? "물" : shortM(u.cL0) + " M " + solName(u.sol) + " 수용액";     // 용질 이름 병기(색각 두 번째 채널 · 탭 ①과 통일 · S-검토 B-4)
      $("lblRight").textContent = u.cR0 === 0 ? "물" : shortM(u.cR0) + " M " + solName(u.sol) + " 수용액";
      placeLabel("lblLeft", -UT.armX, UT.armTop + 1.6, 0, "utube"); placeLabel("lblRight", UT.armX, UT.armTop + 1.6, 0, "utube");
      placeLabel("lblMembrane", 0, -2.4, 0, "utube");
      hideLabels(["lblLiquid", "lblRadish"]);
    }
  }

  /* ---------- 루프(§10 — rAF 하나 · 숨으면 정지 · t 는 «보이는 프레임» dt 누적 · A-4) ---------- */
  var rafId = null, lastT = null;
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (lastT === null) { lastT = now; render(0); return; }
    var dt = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); lastT = now;
    var s = st[st.tab];
    if (s.phase === "running") {
      s.t += dt;
      if (settled(st.tab)) { s.phase = "settled"; s.t = st.tab === "radish" ? RADISH_T_END : UT_T_END; }   // 종단 값으로 고정(함정 54)
      sync();
    }
    render(RM ? 0 : dt);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; }
    else if (!rafId) rafId = requestAnimationFrame(loop);
  });

  /* ---------- 초기화 ---------- */
  T3 = buildStage();
  if (!T3) { $("stage").classList.add("is-hidden"); $("camHint").classList.add("is-hidden"); $("stageFallback").style.display = "block"; }
  else {
    if (FX.fallback) $("fxBadge").classList.remove("is-hidden");
    bindOrbit(T3.cv);
    if (window.ResizeObserver) new ResizeObserver(resize).observe($("stageWrap"));
    resize();
  }
  applyTab(); sync();
  rafId = requestAnimationFrame(loop);

  /* 프로브 창구 — 읽기·렌더 전용(제품 코드는 fx·renderOnce 를 부르지 않는다) */
  window.OSMOVIEW = {
    st: st, settled: settled, fmt: { g: fmtG, cm: fmtCm, m: fmtM, atm: fmtAtm, clock: fmtClock },
    geom: function () { return { radish: radishNow(), utube: utubeNow(), T3: !!T3, fallback: !!FX.fallback, rm: RM }; },
    fx: T3 ? T3.fx : null, cams: T3 ? T3.cams : null, scenes: T3 ? T3.scenes : null, renderer: T3 ? T3.renderer : null, orbit: T3 ? T3.orbit : null,
    soluteColors: soluteColors, hp: HP,
    renderOnce: function () { if (!T3) return false; var which = st.tab === "radish" ? "beaker" : "utube"; placeCamera(which); T3.renderer.render(T3.scenes[which], T3.cams[which]); return true; },
    freeze: function () { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; },
    thaw: function () { if (!rafId) rafId = requestAnimationFrame(loop); }
  };
})();
