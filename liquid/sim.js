"use strict";
/* ================================================================
   액체 — 끓음 실험 계산부 (화면과 무관)

   ① 증기 압력  Antoine 식      log₁₀ P[mmHg] = A − B / (C + t[℃])
      네 액체 모두 이 상수로 **기준 끓는점이 0.2 ℃ 안**, 기준 온도의 증기 압력이
      **문헌값과 2 % 안**으로 맞는 것을 확인했다 (t3.js ①②).

   ② 끓음의 조건   증기 압력 = 외부 압력
      → 외부 압력을 낮추면 끓는점이 내려간다. 높은 산에서 물이 100 ℃보다 낮은
        온도에서 끓는 이유이고, 그래서 **덜 뜨거운 상태로 끓는다.**

   ③ 가열 곡선
      · 끓는점에 닿기 전 : 넣어 준 열이 전부 온도를 올린다  dT/dt = Q /(m·c)
      · 끓는 동안       : 넣어 준 열이 전부 **분자 사이의 힘을 이겨내는 데** 쓰인다.
                          온도가 오르지 않는다(평평한 구간).  dm/dt = Q / ΔH기화
      ★ 이 평평한 구간이 "끓는점 = 분자 내 결합이 끊어지는 온도"라는 ★★★ 오개념을
        깨는 자리다. 결합이 끊어지는 것이 아니라 **분자째 떠나는** 것이고,
        그 에너지가 곧 ΔH기화다.

   ④ 액체의 양
      양을 바꿔도 **증기 압력과 끓는점은 변하지 않는다.** 달라지는 것은
      끓는점까지 걸리는 시간과 다 끓어 없어질 때까지의 시간뿐이다.
      (로드맵 10차시 ★★ 오개념 "액체가 많으면 증기 압력이 크다")
   ================================================================ */

const LIQ = {
  R: 8.314,          // J/(mol·K)
  G: 9.80665,
  /* Antoine 상수는 mmHg·℃ 기준. 유효 구간을 벗어나면 화면에 표시한다. */
  LIST: [
    { id: "ether", name: "다이에틸에터", formula: "C₄H₁₀O", M: 74.12,
      A: 6.92032, B: 1064.07, C: 228.799, bpLit: 34.6,
      c: 2.32, dHvap: 358, rho: 0.713,
      force: "분산력 + 쌍극자–쌍극자 힘 (에터 분자끼리는 수소 결합을 하지 않는다)",
      pextMin: 0.60, colorHex: "#c9d8e8", tint: [0.86, 0.90, 0.95] },
    { id: "ethanol", name: "에탄올", formula: "C₂H₅OH", M: 46.07,
      A: 8.20417, B: 1642.89, C: 230.300, bpLit: 78.4,
      c: 2.44, dHvap: 846, rho: 0.789,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합",
      pextMin: 0.20, colorHex: "#d8e6f2", tint: [0.85, 0.92, 0.99] },
    { id: "water", name: "물", formula: "H₂O", M: 18.015,
      A: 8.07131, B: 1730.63, C: 233.426, bpLit: 100.0,
      c: 4.18, dHvap: 2257, rho: 1.000,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합 (가장 촘촘)",
      pextMin: 0.20, colorHex: "#bfe0f5", tint: [0.72, 0.88, 1.00] },
    { id: "acetic", name: "아세트산", formula: "CH₃COOH", M: 60.05,
      A: 7.38782, B: 1533.313, C: 222.309, bpLit: 118.1,
      /* ⚠ 아세트산의 기화 엔탈피는 자료마다 다르다.
         증기에서 두 분자가 수소 결합으로 **짝(이합체)** 을 이루기 때문에
         클라우지우스–클라페이론 관계가 그대로 성립하지 않는다.
         문헌표는 약 24 kJ/mol, 증기 압력 곡선의 기울기는 약 39 kJ/mol 이다.
         이 화면은 **곡선과 어긋나지 않도록** 곡선에서 얻은 값(646 J/g)을 쓴다.
         이 사정은 활동지 한계 항목에 그대로 적어 두었다. */
      c: 2.05, dHvap: 646, rho: 1.049,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합 (증기에서는 두 분자가 짝을 이룸)",
      pextMin: 0.20, colorHex: "#e6e3cf", tint: [0.95, 0.93, 0.82] }
  ],
  /* 외부 압력 (atm). min 은 전역 하한이고, 액체마다 pextMin 이 그 위에 얹힌다.
     ★ pextMin = 그 액체가 실온(20 ℃) 이상에서 끓는 최저 외부 압력.
       다이에틸에터는 20 ℃ 포화 증기압이 0.579 atm이라 그 아래로 내리면
       "가열 중인데 온도가 실온보다 내려가는" 그림이 된다 — 이 화면의 열원 모형은
       감압 비등의 냉각을 다루지 않으므로 조작 범위에서 막는다.
       값이 틀리면 liquid_check.js ⑬이 잡는다 (vaporP(l,20)/760 <= pextMin). */
  PEXT: { min: 0.20, max: 1.50, step: 0.01 },
  VOL: { min: 20, max: 200, step: 5 },          // 액체의 양 (mL)
  HEAT: { min: 0, max: 600, step: 10 },         // 가열 출력 (W)
  MMHG_PER_ATM: 760
};

const byId = id => LIQ.LIST.find(l => l.id === id);

/* 증기 압력 (mmHg) */
function vaporP(liq, t) {
  return Math.pow(10, liq.A - liq.B / (liq.C + t));
}
/* 어떤 외부 압력에서의 끓는점 (℃) — Antoine 식을 t 에 대해 푼다 */
function boilingPoint(liq, pext_atm) {
  const P = pext_atm * LIQ.MMHG_PER_ATM;
  // log10 P = A − B/(C+t)  →  C + t = B / (A − log10 P)
  const d = liq.A - Math.log10(P);
  if (d <= 0) return Infinity;
  return liq.B / d - liq.C;
}
/* Antoine 곡선의 기울기에서 얻는 기화 엔탈피 (kJ/mol) — 문헌값과 맞는지 확인용
   Clausius–Clapeyron:  dlnP/dT = ΔH/(R T²),  Antoine:  dlnP/dT = ln10·B/(C+t)²  */
function dHfromAntoine(liq, t) {
  const T = t + 273.15;
  return LIQ.R * T * T * Math.LN10 * liq.B / Math.pow(liq.C + t, 2) / 1000;
}

/* 가열 한 걸음 (dt 초). 상태를 그대로 바꿔 돌려준다. */
function heatStep(st, liq, dt) {
  const Tb = boilingPoint(liq, st.pext);
  const mass = st.volume * liq.rho;                 // g
  st.boiling = false;
  if (mass <= 0.01) { st.volume = 0; st.boiling = false; st.t = st.tRoom; return st; }
  if (st.heat <= 0) {
    // 가열을 끄면 실온을 향해 아주 천천히 식는다 (정성적)
    st.t += (st.tRoom - st.t) * Math.min(1, 0.02 * dt);
    return st;
  }
  if (st.t < Tb - 1e-6) {
    const dT = st.heat * dt / (mass * liq.c);       // Q = m c ΔT
    st.t = Math.min(Tb, st.t + dT);
  } else {
    st.t = Tb;
    st.boiling = true;
    const dm = st.heat * dt / liq.dHvap;            // Q = m ΔH기화
    st.volume = Math.max(0, st.volume - dm / liq.rho);
    if (st.volume <= 0) { st.volume = 0; st.boiling = false; }
  }
  return st;
}

/* 다 끓어 없어질 때까지 걸리는 시간 (초) — 활동지 설계 단계에서 쓴다 */
function timeToBoilDry(st, liq) {
  if (st.heat <= 0) return Infinity;
  const Tb = boilingPoint(liq, st.pext);
  const mass = st.volume * liq.rho;
  const tHeat = Math.max(0, (Tb - st.t)) * mass * liq.c / st.heat;
  const tVap = mass * liq.dHvap / st.heat;
  return { toBoil: tHeat, toDry: tHeat + tVap };
}

/* ⑤ 열린 용기 vs 닫힌 용기 — 증발·응축의 동적 평형 (2단계 「닫힌 용기의 끓음」)
   증발 속도는 액체 표면 온도만의 함수(∝ 포화 증기 압력), 응축 속도는 용기 속
   증기 압력에 비례한다. 그래서 닫힌 용기의 증기 압력은
     dP/dt = KP · (Psat(T) − P)
   를 따라 포화 증기 압력으로 수렴하고, 그 자리에서 증발 = 응축(동적 평형)이 된다.
   열린 용기는 떠난 분자가 되돌아오지 않아 응축 항이 없다 — 액체가 끝까지 준다.
   ⚠ 수치 적분이 아니라 지수 해를 그대로 쓴다(어떤 dt 에서도 진동·overshoot 없음). */
const SEAL = {
  T: { min: 20, max: 80, step: 1, def: 40 },   // 조작 온도 (℃)
  V0: 100,                                     // 두 용기의 시작 액체 (mL)
  KP: 0.25,        // 닫힌 용기 압력 접근 속도 (1/s) — 평형까지 십수 초 (관찰 가능한 속도)
  KV: 0.020,       // 열린 용기 증발 속도 (mL/(s·mmHg)) — 40 ℃ 물 100 mL 가 약 90 초에 소진
  ALPHA: 0.02,     // 닫힌 용기 누적 증발량 환산 (mL/mmHg) — 헤드스페이스 부피 가정(한계 ⑭).
                   //   80 ℃ 평형에서도 감소가 7 mL 안이라 거시 화면에서 「거의 그대로」로 읽힌다
                   //   (2026-08-24 2차 지시 — 닫힌 용기는 온도를 올려도 물이 줄지 않는 모습이 먼저다)
  RATE: 0.08       // 분자 수 흐름 환산 (개/(s·mmHg)) — 화면 카운터·입자용 정성 배율
};
/* 증발·응축 속도 (개/초) — 증발은 T 만의 함수, 응축은 P 에 비례 */
function sealedRates(liq, T, P) {
  return { evap: SEAL.RATE * vaporP(liq, T), cond: SEAL.RATE * Math.max(0, P) };
}
/* 한 걸음 (dt 초). s = { T, P, volOpen, volClosed, t } 를 그대로 바꿔 돌려준다 */
function sealedStep(s, liq, dt) {
  const ps = vaporP(liq, s.T);
  s.P = ps + (s.P - ps) * Math.exp(-SEAL.KP * dt);      // 지수 수렴 — 진동 없음
  if (s.P < 0) s.P = 0;
  /* 닫힌 용기 액체 — 지금 증기로 나가 있는 양만큼 준다. 온도를 내려 P 가 내려가면
     응축으로 되돌아와 액체가 도로 는다(적분이 아니라 유도값이라 저절로 맞는다) */
  s.volClosed = Math.max(0, SEAL.V0 - SEAL.ALPHA * s.P);
  s.volOpen = Math.max(0, s.volOpen - SEAL.KV * ps * dt);
  s.t += dt;
  return s;
}
/* 동적 평형 판정 — 포화 증기 압력의 2 % 이내 */
function sealedAtEq(s, liq) {
  const ps = vaporP(liq, s.T);
  return ps > 0 && Math.abs(s.P - ps) < ps * 0.02;
}




/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {
  blue: CSSV("--d-blue"), red: CSSV("--d-red"), ink: CSSV("--t1"),
  gray: CSSV("--d-gray"), t3: CSSV("--t3"), stageLight: CSSV("--stage-light")
};
const GRID = "rgba(40,45,52,0.055)";
const AXIS = "rgba(40,45,52,0.30)";

let liq = byId("water");
let running = true;
let clock = 0;                     // 실험 경과 시간(초)
const st = { t: 20, tRoom: 20, volume: 100, pext: 1.00, heat: 300, boiling: false };
let trace = [];                    // 가열 곡선 {s, t, v, boiling}
let rows = [];
let zoom = false;                  // 분자 확대 보기
let stage = 1;                     // 지금 단계 (1~5) — 단일 원천 (2026-08-24 개편: 2단계 「닫힌 용기」 신설로 4→5단계)
let answerShown = false;           // 「답 확인」 게이트
let cursorT = null;                // 커서 추적 십자선이 가리키는 온도(℃). null = 화면 밖
/* ★ 답 확인 게이트의 단일 판정 (지시안 B-4 14경로).
   true = 지금 답을 감춰야 한다. 5단계(자유 탐구)에서만 잠근다 — 1~4단계는 그 단계의 노출 표가 정한다.
   (3단계의 #rTb·가열 곡선 끓는점 레이블은 그 단계의 증거이므로 잠그지 않는다) */
const gated = () => stage === 5 && !answerShown;
const REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ============================================================
   WebGL — 비커 속 액체
   원기둥 비커를 옆에서 보면 **원기둥 렌즈**가 된다. 그래서 뒤쪽 배경이
   좌우로 뒤집혀 보인다. 이 시뮬레이션은 그 굴절을 스넬 법칙으로 실제 계산한다.
     · 입사각 θi = asin(u),  굴절각 θt = asin(u/n)
     · 원기둥을 지나며 두 면에서 꺾이므로 총 꺾임 D = 2(θi − θt)
   ⚠ 세로 방향 굴절은 계산하지 않았다(가로 단면만). 화면 한계로 활동지에 적어 두었다.
   ============================================================ */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const FRAG = `precision highp float;
varying vec2 uv;
uniform vec2 res;
uniform float time;
uniform float fill;        // 액체 높이 0~1
uniform float boilAmt;     // 0=조용 1=격렬하게 끓음
uniform float heatAmt;     // 0~1 가열 세기 (바닥 불빛)
uniform float hotAmt;      // 0~1 액체가 얼마나 뜨거운가
uniform vec3  tint;        // 액체 색
uniform float nLiq;        // 액체 굴절률
uniform float lid;         // 1 = 뚜껑(밀폐) — 2단계 닫힌 용기
uniform float mist;        // 끓지 않아도 피어오르는 증발 김 (2단계 열린 용기 · 0~1)

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
/* 뒤쪽 벽 — 굴절이 보이도록 세로 줄무늬와 눈금을 그린다 */
vec3 backdrop(vec2 q){
  /* 뒤쪽 벽 — 줄무늬가 촘촘해야 굴절로 좌우가 뒤집히는 것이 눈에 보인다 */
  vec3 wall = mix(vec3(0.985,0.988,0.992), vec3(0.90,0.92,0.945), clamp(q.y*1.1-0.05,0.0,1.0));
  /* 줄무늬는 "굴절이 보이게 하는 장치"일 뿐이므로 옅게. 비커가 주인공이다(매뉴얼 §2①) */
  float st1 = smoothstep(0.33,0.47,abs(fract(q.x*11.0)-0.5));
  wall = mix(wall, vec3(0.46,0.57,0.71), st1*0.30);
  float rule = smoothstep(0.03,0.0,abs(fract(q.y*9.0)-0.5)-0.47);
  wall = mix(wall, vec3(0.62,0.66,0.72), rule*0.16);
  /* 아래쪽은 실험대 */
  float bench = smoothstep(0.19,0.05,q.y);
  wall = mix(wall, vec3(0.84,0.81,0.76), bench*0.85);
  return wall;
}
void main(){
  vec2 asp = vec2(res.x/res.y, 1.0);
  vec2 q = (uv - 0.5) * vec2(asp.x, 1.0) * 2.0;      // 화면 좌표 (-a..a, -1..1)

  vec3 col = backdrop(q*0.5+0.5);

  /* 비커 — 가운데 원기둥. 반지름 R, 바닥 y0, 입구 y1 */
  float R = 0.52, y0 = -0.80, y1 = 0.72;
  float u = q.x / R;                                  // -1..1 (원기둥 가로 위치)
  bool inCyl = abs(u) < 1.0 && q.y > y0 && q.y < y1;

  /* fill 0 이면 액면을 바닥 아래로 — 「모두 증발」에 물 조각이 남아 보이면 화면 수치와 어긋난다(J-N5) */
  float liqTop = fill <= 0.001 ? y0 - 0.01 : y0 + (y1 - y0) * (0.06 + 0.80 * fill);

  if (inCyl) {
    float shell = sqrt(max(0.0, 1.0 - u*u));          // 원기둥 표면의 깊이 성분
    bool inLiquid = q.y < liqTop;

    /* 메니스커스 — 벽 쪽에서 살짝 올라간다 */
    float men = 0.030 * pow(abs(u), 3.0);
    inLiquid = q.y < (liqTop + men);

    float n = inLiquid ? nLiq : 1.05;                 // 액체 / 유리+공기
    float ti = asin(clamp(abs(u),0.0,0.999));
    float tt = asin(clamp(abs(u)/n,0.0,0.999));
    float D  = 2.0*(ti-tt);                            // 총 꺾임각
    float off = tan(D) * 1.35 * sign(u);      // 배경까지의 거리 — 뒤집힘이 보이도록 넉넉히
    vec2 sq = vec2(q.x - off, q.y);                    // 굴절된 배경 표본 위치
    vec3 through = backdrop(sq*0.5+0.5);

    if (inLiquid) {
      /* 액체 색 — 지나온 두께만큼 물든다 (베르–람베르트 느낌) */
      float thick = shell * 1.5 + (liqTop - q.y)*0.25;
      through *= mix(vec3(1.0), tint, clamp(thick*0.72,0.0,0.90));
      /* 뜨거우면 아지랑이처럼 흔들린다 */
      float shimmer = noise(vec2(q.x*7.0, q.y*7.0 - time*1.2));
      through += (shimmer-0.5) * 0.05 * hotAmt;

      /* 기포 — 끓을 때 바닥에서 올라온다 */
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float seed = hash(vec2(fi, 3.0));
        float spd  = 0.28 + 0.5*seed;
        float ph   = fract(time*spd*(0.4+boilAmt) + seed);
        float bx   = (seed*2.0-1.0) * R * 0.72 + sin(time*1.5+fi)*0.02;
        float by   = y0 + 0.05 + ph * (liqTop - y0 - 0.05);
        float br   = (0.012 + 0.030*seed) * (0.25 + 0.95*boilAmt);
        float d    = length(vec2(q.x-bx, (q.y-by)));
        float edge = smoothstep(br, br*0.55, d);
        float rim  = smoothstep(br, br*0.86, d) - smoothstep(br*0.86, br*0.62, d);
        through = mix(through, vec3(0.99), edge*0.55*boilAmt);
        through = mix(through, vec3(0.40,0.52,0.68), rim*0.95*boilAmt);
      }
      col = through;
      /* 액면 — 밝은 띠 */
      float surf = smoothstep(0.016,0.0,abs(q.y-(liqTop+men)));
      col = mix(col, vec3(1.0), surf*0.55);
    } else {
      col = mix(col, through, 0.55);                  // 빈 유리 부분
    }

    /* 유리 — 가장자리로 갈수록 어두워지고(프레넬), 왼쪽에 길게 하이라이트가 선다 */
    float fres = pow(abs(u), 4.0);
    col = mix(col, vec3(0.42,0.50,0.60), fres*0.55);
    float hl = smoothstep(0.085,0.0,abs(u+0.60)) * smoothstep(y1+0.02,y0,q.y);
    col = mix(col, vec3(1.0), hl*0.70);
    float hl2 = smoothstep(0.045,0.0,abs(u-0.74)) * smoothstep(y1,y0,q.y);
    col = mix(col, vec3(1.0), hl2*0.35);
    float wall = smoothstep(0.955,1.0,abs(u));
    col = mix(col, vec3(0.40,0.47,0.56), wall*0.85);
    /* 액면 아래 벽 쪽에 빛이 모이는 밝은 띠 (코스틱 느낌) */
    if (q.y < liqTop) {
      float caus = smoothstep(0.22,0.0,abs(abs(u)-0.55)) * smoothstep(0.30,0.0, q.y - y0);
      col = mix(col, vec3(1.0), caus*0.20);
    }
  }

  /* 비커 바닥·입구 테두리 */
  float rimTop = smoothstep(0.012,0.0,abs(q.y-y1)) * step(abs(u),1.06);
  col = mix(col, vec3(0.62,0.68,0.76), rimTop*0.9);
  float base = smoothstep(0.016,0.0,abs(q.y-y0)) * step(abs(u),1.12);
  col = mix(col, vec3(0.55,0.60,0.68), base*0.9);

  /* 가열 장치 — 바닥에서 붉게 */
  float hp = smoothstep(0.16,0.0, abs(q.y-(y0-0.075))) * step(abs(q.x), R*1.22);
  col = mix(col, vec3(0.85,0.30,0.12), hp*heatAmt*0.75);

  /* 증기 — 액면 위로 피어오른다 */
  if (q.y > liqTop && abs(q.x) < R*1.5) {
    float v = 0.0;
    v += noise(vec2(q.x*3.0, q.y*2.2 - time*0.55));
    v += 0.5*noise(vec2(q.x*7.0, q.y*5.0 - time*0.9));
    v /= 1.5;
    float m = smoothstep(0.0,0.35,q.y-liqTop) * smoothstep(1.0,0.25,q.y-liqTop);
    col = mix(col, vec3(0.97), clamp(v-0.42,0.0,1.0)*m*(boilAmt*1.5+mist));
  }

  /* 뚜껑 — 2단계 닫힌 용기(밀폐). 입구를 판으로 덮고 손잡이를 얹는다 */
  if (lid > 0.5) {
    float plate = step(abs(q.x), R*1.18) * step(y1, q.y) * step(q.y, y1+0.055);
    col = mix(col, vec3(0.42,0.47,0.55), plate*0.92);
    float knob = step(abs(q.x), 0.09) * step(y1+0.055, q.y) * step(q.y, y1+0.135);
    col = mix(col, vec3(0.36,0.41,0.48), knob*0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const gcv = $("gl");
let gl = null, prog = null, U = {};
function initGL() {
  gl = gcv.getContext("webgl", { antialias: true, alpha: false })
    || gcv.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!gl) { $("glFallback").style.display = "block"; return false; }
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { $("glFallback").style.display = "block"; return false; }
  prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); $("glFallback").style.display = "block"; return false; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ["res", "time", "fill", "boilAmt", "heatAmt", "hotAmt", "tint", "nLiq", "lid", "mist"])
    U[n] = gl.getUniformLocation(prog, n);
  return true;
}
function drawGL() {
  if (!gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(gcv.clientWidth * dpr));
  const h = Math.max(1, Math.round((+gcv.style.height.replace("px", "") || 300) * dpr));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  gl.viewport(0, 0, gcv.width, gcv.height);
  const Tb = boilingPoint(liq, st.pext);
  gl.uniform2f(U.res, gcv.width, gcv.height);
  gl.uniform1f(U.time, clock);
  gl.uniform1f(U.fill, Math.max(0, Math.min(1, st.volume / LIQ.VOL.max)));
  gl.uniform1f(U.boilAmt, st.boiling ? 1.0 : Math.max(0, Math.min(0.35, (st.t - (Tb - 25)) / 25 * 0.35)));
  gl.uniform1f(U.heatAmt, Math.min(1, st.heat / LIQ.HEAT.max));
  gl.uniform1f(U.hotAmt, Math.max(0, Math.min(1, (st.t - st.tRoom) / 90)));
  gl.uniform3f(U.tint, liq.tint[0], liq.tint[1], liq.tint[2]);
  gl.uniform1f(U.nLiq, liq.id === "water" ? 1.333 : liq.id === "ethanol" ? 1.361 : liq.id === "ether" ? 1.353 : 1.372);
  gl.uniform1f(U.lid, 0.0);
  gl.uniform1f(U.mist, 0.0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ── 2단계 거시 화면 — 같은 비커 셰이더로 열린/닫힌 용기 두 개를 좌우에 그린다 (2026-08-24 2차 지시).
   1단계와 같은 거시 세계에서 「열린 쪽은 물이 줄고, 닫힌 쪽은 온도를 올려도 거의 그대로」를
   먼저 보인 뒤 『분자 크기로 확대해 보기』로 분자 화면과 전환한다.
   끓음이 아니므로 boilAmt = 0(기포·격렬한 증기 없음) — 열린 쪽만 mist 로 옅은 증발 김을 준다. */
function drawGLSeal() {
  if (!gl || !seal.st) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(gcv.clientWidth * dpr));
  const h = Math.max(1, Math.round((+gcv.style.height.replace("px", "") || 300) * dpr));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  if (gcv.clientWidth < 8) return;          // 숨은 캔버스 (매뉴얼 §5)
  const s = seal.st;
  gl.enable(gl.SCISSOR_TEST);
  const halfW = Math.floor(gcv.width / 2);
  const one = (x0, vw, vol, lidOn) => {
    gl.viewport(x0, 0, vw, gcv.height);
    gl.scissor(x0, 0, vw, gcv.height);
    gl.uniform2f(U.res, vw, gcv.height);
    gl.uniform1f(U.time, s.t);
    gl.uniform1f(U.fill, Math.max(0, Math.min(1, vol / LIQ.VOL.max)));   // 1단계와 같은 눈금
    gl.uniform1f(U.boilAmt, 0.0);            // 끓지 않는다 — 기포를 그리면 오개념(내부 기화)
    gl.uniform1f(U.heatAmt, 0.0);            // 열원 없음
    gl.uniform1f(U.hotAmt, Math.max(0, Math.min(1, (s.T - 20) / 90)));
    gl.uniform3f(U.tint, liq.tint[0], liq.tint[1], liq.tint[2]);
    gl.uniform1f(U.nLiq, 1.333);
    gl.uniform1f(U.lid, lidOn);
    gl.uniform1f(U.mist, (lidOn > 0.5 || vol <= 0) ? 0.0 : Math.min(0.5, 0.10 + (s.T - 20) * 0.006));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  one(0, halfW, s.volOpen, 0.0);
  one(halfW, gcv.width - halfW, s.volClosed, 1.0);
  gl.disable(gl.SCISSOR_TEST);
}

/* ── 분자 확대 보기 (2D 캔버스) — ★★★ '끓는점 = 결합 파괴' 오개념 반박 ──
   ⚠ 아래에 색 코드가 직접 적혀 있는 것은 두 가지뿐이며, 둘 다 토큰으로 바꾸면 안 된다.
     ① 원자색은 **CPK 국제 표준**이다 (매뉴얼 §4 "값 변경 금지").
        O #FF0D0D · H #FFFFFF · C #404040
     ② 액체별 색(LIQ.LIST 의 colorHex·tint)은 **그 물질의 실제 겉보기 색**이다.
        사이트 테마 색이 아니므로 토큰이 아니다. */
const zcv = $("zoom"), zctx = zcv.getContext("2d");
function drawZoom() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = zcv.width / dpr, H = zcv.height / dpr;
  if (W < 40 || H < 60) return;   // 매뉴얼 §5 — 숨은 캔버스는 clientWidth 가 0이다
  zctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  zctx.fillStyle = C.stageLight; zctx.fillRect(0, 0, W, H);
  const surf = H * 0.52;
  /* 가장자리에는 아무것도 그리지 않는다 — 무대 테두리와 겹치면 잘린 것처럼 보인다 */
  const MM = 4;
  zctx.fillStyle = "rgba(29,78,216,0.09)";
  zctx.fillRect(MM, surf, W - MM * 2, H - surf - MM);
  zctx.strokeStyle = AXIS; zctx.lineWidth = 1.2;
  zctx.beginPath(); zctx.moveTo(MM, surf); zctx.lineTo(W - MM, surf); zctx.stroke();
  zctx.fillStyle = C.t3; zctx.font = "600 11px sans-serif";
  zctx.fillText("액체 — 분자가 서로 닿아 있다", 8, surf + 15);
  zctx.fillText("증기 — 떠난 분자 (멀리 떨어져 있다)", 8, 15);

  /* 분자 하나를 그린다 — 물이면 H₂O 세 원자를 CPK 색으로.
     ★ 떠날 때 **원자로 쪼개지지 않는다.** 분자째 통째로 올라간다. */
  const drawMol = (x, y, s, ang) => {
    zctx.save(); zctx.translate(x, y); zctx.rotate(ang); zctx.scale(s, s);
    const atoms = liq.id === "water"
      ? [[0, 0, 8.5, "#FF0D0D", "O"], [-11.6, 8.9, 5.6, "#FFFFFF", "H"], [11.6, 8.9, 5.6, "#FFFFFF", "H"]]
      : liq.id === "ethanol"
        ? [[-9, 2, 7.5, "#404040", "C"], [0, -3, 7.5, "#404040", "C"], [9, 2, 8, "#FF0D0D", "O"], [16, -3, 5, "#FFFFFF", "H"]]
        : liq.id === "acetic"
          ? [[-9, 2, 7.5, "#404040", "C"], [0, -2, 7.5, "#404040", "C"], [7, -9, 8, "#FF0D0D", "O"], [7, 6, 8, "#FF0D0D", "O"], [15, 9, 5, "#FFFFFF", "H"]]
          : [[-10, 0, 7.5, "#404040", "C"], [-2, -4, 8, "#FF0D0D", "O"], [7, 0, 7.5, "#404040", "C"], [15, -4, 7.5, "#404040", "C"]];
    zctx.strokeStyle = "rgba(40,45,52,0.55)"; zctx.lineWidth = 2.4;
    for (let i = 1; i < atoms.length; i++) {
      zctx.beginPath(); zctx.moveTo(atoms[0][0], atoms[0][1]); zctx.lineTo(atoms[i][0], atoms[i][1]); zctx.stroke();
    }
    for (const [ax, ay, ar, col, sym] of atoms) {
      zctx.fillStyle = col;
      /* 밝은 무대에서 H·S·Cl 는 외곽선이 없으면 사라진다 (매뉴얼 §4) */
      zctx.strokeStyle = shade(col, 0.5); zctx.lineWidth = 1;
      zctx.globalAlpha = 1; zctx.beginPath(); zctx.arc(ax, ay, ar, 0, 6.2832); zctx.fill();
      zctx.globalAlpha = 0.85; zctx.stroke(); zctx.globalAlpha = 1;
      zctx.fillStyle = (col === "#FFFFFF" || col === "#FF0D0D") ? C.ink : C.stageLight;
      zctx.font = "600 " + Math.max(7, ar * 0.95) + "px sans-serif";
      zctx.textAlign = "center"; zctx.textBaseline = "middle";
      zctx.fillText(sym, ax, ay + 0.5);
    }
    zctx.restore(); zctx.textAlign = "left"; zctx.textBaseline = "alphabetic";
  };
  const Tb = boilingPoint(liq, st.pext);
  const act = Math.max(0.08, Math.min(1, (st.t - st.tRoom) / Math.max(1, Tb - st.tRoom)));
  const scale = Math.max(0.85, Math.min(1.45, W / 300));
  // 액체 속 분자들
  const seedy = i => ((i * 9301 + 49297) % 233280) / 233280;
  /* 액체 속 — 분자가 서로 닿을 만큼 촘촘하다. 증기 쪽과의 대비가 곧 설명이다. */
  const cols = 5, rowsN = 3;
  for (let r = 0; r < rowsN; r++) for (let cIdx = 0; cIdx < cols; cIdx++) {
    const i = r * cols + cIdx;
    const x = (W / (cols + 1)) * (cIdx + 1) + (r % 2 ? W / (cols + 1) / 2 : 0) - W / (cols + 1) / 4;
    const y = surf + 30 + r * ((H - surf - 46) / Math.max(1, rowsN - 1));
    if (x < 26 || x > W - 26) continue;
    drawMol(x + Math.sin(clock * 1.3 + i) * 3 * act, y + Math.cos(clock * 1.7 + i * 1.3) * 3 * act,
      scale, Math.sin(clock * 0.6 + i) * 0.6);
  }
  // 떠나는 분자 (증발/끓음) — 분자째 올라간다. 가열 전에도 증발은 일어난다.
  const nEsc = st.boiling ? 5 : Math.max(1, Math.round(act * 3));
  for (let i = 0; i < nEsc; i++) {
    const ph = ((clock * (0.35 + 0.2 * i) + seedy(i * 11 + 5)) % 1);
    const x = 40 + seedy(i * 7 + 3) * (W - 80);
    const y = surf - ph * (surf - 18);
    zctx.globalAlpha = 1 - ph * 0.5;
    drawMol(x, y, scale * (1 - ph * 0.12), ph * 2.2);
    zctx.globalAlpha = 1;
  }
  /* ★ 이월·최우선 — 이 캡션은 J-N4의 핵심 문장이다. 반드시 불투명 배경판 위에 올린다.
     떠나는 분자가 x = 40 + seed*(W-80) · y = surf − ph*(surf−18) 로 증기 영역 전체를 지나가므로
     위치를 옮기는 것만으로는 겹침이 사라지지 않는다(ph ≈ 0.05~0.13 구간에서 간헐적으로 겹친다).
     간헐적이라 스크린샷 1장으로는 통과해 버린다 — 위치가 아니라 배경판이 처방이다. */
  zctx.font = "600 11.5px sans-serif";
  const CAP = "분자가 통째로 떠난다 — 분자 안의 결합은 그대로다";
  const capW = zctx.measureText(CAP).width;
  zctx.textAlign = "left";
  zctx.fillStyle = C.stageLight;
  zctx.fillRect(W - 8 - capW - 4, H - 8 - 12, capW + 8, 16);   // 좌우 4 px 여백
  zctx.fillStyle = C.ink;
  zctx.fillText(CAP, W - 8 - capW, H - 8);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16 & 255) * f), g = Math.round((n >> 8 & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/* ============================================================
   3D 공-막대 렌더러 (M3D) — mineral/sim.js 「프로그램 ②」를 이식·축약한 것 (2026-08-24)
   공은 화면을 향한 사각형에 구의 법선을 계산해 그린다(임포스터). 막대는 원기둥 음영,
   판(panel)은 유리벽·액체면. 카메라에서 먼 것부터 그린다(화가 알고리즘 — WebGL 1 에는
   조각별 깊이 쓰기가 없다). 별도 캔버스 #mol 에 자기 WebGL 컨텍스트를 하나만 쓴다.
   쓰는 곳 ① 2단계 「닫힌 용기」의 열린/닫힌 용기 장면 ② 「분자 크기로 확대해 보기」.
   실패하면 m3d = null 로 남고, 확대 보기는 기존 2D(drawZoom)로 폴백한다(§1-2).
   ============================================================ */
const M3D_VERT = `attribute vec3 aPos; attribute vec2 aLocal; attribute vec3 aCol;
attribute vec3 aPerp; attribute vec3 aParam;
uniform mat4 uProj;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
void main(){ vLocal=aLocal; vCol=aCol; vPerp=aPerp; vParam=aParam;
  gl_Position = uProj * vec4(aPos,1.0); }`;
const M3D_FRAG = `precision mediump float;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
uniform vec3 uLight;
void main(){
  float kind = vParam.x; float al = vParam.z;
  vec3 n; float edge = 1.0;
  if (kind < 0.5) {                       /* 공 */
    float r2 = dot(vLocal, vLocal);
    if (r2 > 1.0) discard;
    n = vec3(vLocal, sqrt(max(0.0, 1.0 - r2)));
    edge = mix(1.0, 0.58, smoothstep(0.78, 1.0, sqrt(r2)));
  } else if (kind < 1.5) {                /* 막대 */
    float y = clamp(vLocal.y, -0.999, 0.999);
    n = normalize(vPerp * y + vec3(0.0,0.0,1.0) * sqrt(1.0 - y*y));
    edge = mix(1.0, 0.66, smoothstep(0.72, 1.0, abs(y)));
  } else {                                /* 판 — 유리벽·액체면. 음영 없이 색과 투명도만 */
    gl_FragColor = vec4(vCol, al);
    return;
  }
  float dif = max(dot(n, uLight), 0.0);
  float amb = 0.34 + 0.13 * max(n.y, 0.0);
  vec3 h = normalize(uLight + vec3(0.0,0.0,1.0));
  float spe = pow(max(dot(n, h), 0.0), 26.0);
  vec3 c = vCol * (amb + 0.74 * dif) * edge + vec3(1.0) * spe * 0.30;
  gl_FragColor = vec4(clamp(c,0.0,1.0), al);
}`;

const mcv = $("mol");
let m3d = null;
const M3D_CAM = { z: 6.0, fovy: 0.56 };
const M3D_PROJ = new Float32Array(16);
function m3dPersp(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}
function h2r(hex) {
  const s = hex.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map(c => c + c).join("") : s, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
const M3D_BG = h2r((C.stageLight || "#ffffff").trim().startsWith("#") ? C.stageLight.trim() : "#ffffff");
function initM3D() {
  if (!mcv) return;
  const g = mcv.getContext("webgl", { antialias: true, alpha: false })
    || mcv.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!g) return;
  const mk = (ty, src) => {
    const sh = g.createShader(ty); g.shaderSource(sh, src); g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) { console.error(g.getShaderInfoLog(sh)); return null; }
    return sh;
  };
  const vs = mk(g.VERTEX_SHADER, M3D_VERT), fs = mk(g.FRAGMENT_SHADER, M3D_FRAG);
  if (!vs || !fs) return;
  const p = g.createProgram(); g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) { console.error(g.getProgramInfoLog(p)); return; }
  g.useProgram(p);
  const U = {}, A = {};
  for (const nm of ["uProj", "uLight"]) U[nm] = g.getUniformLocation(p, nm);
  for (const nm of ["aPos", "aLocal", "aCol", "aPerp", "aParam"]) A[nm] = g.getAttribLocation(p, nm);
  g.enable(g.BLEND);
  g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
  m3d = { g, p, U, A, vbo: g.createBuffer(), ibo: g.createBuffer(),
          prims: [], v: new Float32Array(0), i: new Uint16Array(0) };
}
/* 시점 변환 — 프레임마다 m3dBegin 으로 세운다. 이후의 모든 좌표는 뷰 좌표다(mineral 방식) */
let m3dView = null;
function m3dBegin(yaw, pitch) {
  m3dView = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) };
  if (m3d) m3d.prims.length = 0;
}
function m3dV(x, y, z) {
  const v = m3dView;
  const x1 = v.cy * x + v.sy * z, z1 = -v.sy * x + v.cy * z;
  const y2 = v.cp * y - v.sp * z1, z2 = v.sp * y + v.cp * z1;
  return [x1, y2, z2 - M3D_CAM.z];
}
function m3dSphere(p, r, col, al) { if (m3d) m3d.prims.push({ z: p[2], k: 0, p, r, col, al }); }
function m3dStick(a, b, w, col, al) { if (m3d) m3d.prims.push({ z: (a[2] + b[2]) / 2, k: 1, a, b, w, col, al }); }
/* zBias — 배경판처럼 「무조건 맨 뒤」에 깔아야 하는 판에 큰 음수를 준다 */
function m3dPanel(c0, c1, c2, c3, col, al, zBias) {
  if (m3d) m3d.prims.push({ z: (c0[2] + c1[2] + c2[2] + c3[2]) / 4 + (zBias || 0), k: 2, cs: [c0, c1, c2, c3], col, al });
}
function m3dFlush() {
  if (!m3d) return;
  const g = m3d.g;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = mcv.clientWidth, ch = +mcv.style.height.replace("px", "") || 300;
  if (cw < 8) return;                       // 숨은 캔버스 — clientWidth 0 (매뉴얼 §5)
  const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
  if (mcv.width !== w || mcv.height !== h) { mcv.width = w; mcv.height = h; }
  const prims = m3d.prims;
  prims.sort((a, b) => a.z - b.z);          // 먼 것(더 음수)부터
  const P = Math.min(prims.length, 3800);   // 정점 번호 16비트 한계 안(3800×4 = 15200)
  const FPV = 14;
  const needV = P * 4 * FPV, needI = P * 6;
  if (m3d.v.length < needV) m3d.v = new Float32Array(Math.ceil(needV * 1.5));
  if (m3d.i.length < needI) m3d.i = new Uint16Array(Math.ceil(needI * 1.5));
  const V = m3d.v, I = m3d.i;
  let vh = 0, ih = 0, q = 0;
  const put = (px, py, pz, lx, ly, c, ex, ey, kind, al) => {
    V[vh] = px; V[vh + 1] = py; V[vh + 2] = pz;
    V[vh + 3] = lx; V[vh + 4] = ly;
    V[vh + 5] = c[0]; V[vh + 6] = c[1]; V[vh + 7] = c[2];
    V[vh + 8] = ex; V[vh + 9] = ey; V[vh + 10] = 0;
    V[vh + 11] = kind; V[vh + 12] = 0; V[vh + 13] = al;
    vh += FPV;
  };
  const quad = () => {
    const b = q * 4;
    I[ih] = b; I[ih + 1] = b + 1; I[ih + 2] = b + 2;
    I[ih + 3] = b; I[ih + 4] = b + 2; I[ih + 5] = b + 3;
    ih += 6; q++;
  };
  for (let s = 0; s < P; s++) {
    const pr = prims[s];
    if (pr.k === 0) {
      const [cx, cy, cz] = pr.p, r = pr.r;
      put(cx - r, cy - r, cz, -1, -1, pr.col, 0, 0, 0, pr.al);
      put(cx + r, cy - r, cz, 1, -1, pr.col, 0, 0, 0, pr.al);
      put(cx + r, cy + r, cz, 1, 1, pr.col, 0, 0, 0, pr.al);
      put(cx - r, cy + r, cz, -1, 1, pr.col, 0, 0, 0, pr.al);
      quad();
    } else if (pr.k === 1) {
      const [ax, ay, az] = pr.a, [bx, by, bz] = pr.b;
      const dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-5) continue;               // 시선과 나란한 막대 — 띠가 사라진다(mineral 방식 승계)
      const ex = dy / L, ey = -dx / L;
      const ox = ex * pr.w, oy = ey * pr.w;
      put(ax + ox, ay + oy, az, -1, 1, pr.col, ex, ey, 1, pr.al);
      put(bx + ox, by + oy, bz, 1, 1, pr.col, ex, ey, 1, pr.al);
      put(bx - ox, by - oy, bz, 1, -1, pr.col, ex, ey, 1, pr.al);
      put(ax - ox, ay - oy, az, -1, -1, pr.col, ex, ey, 1, pr.al);
      quad();
    } else {
      const cs = pr.cs;
      for (let ci = 0; ci < 4; ci++) put(cs[ci][0], cs[ci][1], cs[ci][2], 0, 0, pr.col, 0, 0, 2, pr.al);
      quad();
    }
  }
  g.viewport(0, 0, mcv.width, mcv.height);
  g.clearColor(M3D_BG[0], M3D_BG[1], M3D_BG[2], 1);
  g.clear(g.COLOR_BUFFER_BIT);
  if (!q) return;
  m3dPersp(M3D_PROJ, M3D_CAM.fovy, mcv.width / mcv.height, 0.1, 30);
  g.useProgram(m3d.p);
  g.uniformMatrix4fv(m3d.U.uProj, false, M3D_PROJ);
  g.uniform3f(m3d.U.uLight, -0.4104, 0.7113, 0.5472);   // mineral 과 같은 빛 방향
  g.bindBuffer(g.ARRAY_BUFFER, m3d.vbo);
  g.bufferData(g.ARRAY_BUFFER, V.subarray(0, vh), g.DYNAMIC_DRAW);
  const st4 = FPV * 4;
  g.enableVertexAttribArray(m3d.A.aPos); g.vertexAttribPointer(m3d.A.aPos, 3, g.FLOAT, false, st4, 0);
  g.enableVertexAttribArray(m3d.A.aLocal); g.vertexAttribPointer(m3d.A.aLocal, 2, g.FLOAT, false, st4, 12);
  g.enableVertexAttribArray(m3d.A.aCol); g.vertexAttribPointer(m3d.A.aCol, 3, g.FLOAT, false, st4, 20);
  g.enableVertexAttribArray(m3d.A.aPerp); g.vertexAttribPointer(m3d.A.aPerp, 3, g.FLOAT, false, st4, 32);
  g.enableVertexAttribArray(m3d.A.aParam); g.vertexAttribPointer(m3d.A.aParam, 3, g.FLOAT, false, st4, 44);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, m3d.ibo);
  g.bufferData(g.ELEMENT_ARRAY_BUFFER, I.subarray(0, ih), g.DYNAMIC_DRAW);
  g.drawElements(g.TRIANGLES, ih, g.UNSIGNED_SHORT, 0);
}

/* ── 분자 본 (3D) — 원자 상대 좌표(모형 단위)·반지름·CPK 색 (mineral 과 같은 국제 표준).
   결합 [i,j] 쌍을 명시한다. drawZoom(2D 폴백)의 본을 3D 로 옮긴 것 — 크기 비·결합 각은
   정확하지 않다(구조를 알아보게 하는 그림 · 「가정과 한계」 ⑦). */
const MOL3 = {
  water:   { atoms: [[0, 0, 0, .30, "#FF0D0D"], [-.29, .22, 0, .19, "#FFFFFF"], [.29, .22, 0, .19, "#FFFFFF"]],
             bonds: [[0, 1], [0, 2]] },
  ethanol: { atoms: [[-.24, .05, 0, .26, "#404040"], [0, -.08, 0, .26, "#404040"], [.24, .05, 0, .28, "#FF0D0D"], [.42, -.08, 0, .17, "#FFFFFF"]],
             bonds: [[0, 1], [1, 2], [2, 3]] },
  acetic:  { atoms: [[-.24, .05, 0, .26, "#404040"], [0, -.05, 0, .26, "#404040"], [.19, -.24, 0, .28, "#FF0D0D"], [.19, .16, 0, .28, "#FF0D0D"], [.40, .24, 0, .17, "#FFFFFF"]],
             bonds: [[0, 1], [1, 2], [1, 3], [3, 4]] },
  ether:   { atoms: [[-.36, 0, 0, .26, "#404040"], [-.12, -.11, 0, .28, "#FF0D0D"], [.12, 0, 0, .26, "#404040"], [.36, -.11, 0, .26, "#404040"]],
             bonds: [[0, 1], [1, 2], [2, 3]] }
};
for (const k3 in MOL3) for (const a3 of MOL3[k3].atoms) a3.push(h2r(a3[4]));

/* 분자 하나 — z축 회전(ang) + y축 자전으로 3차원 방향을 준다. ★ 원자로 쪼개지 않는다. */
function drawMol3(x, y, z, ang, seed, alpha, scale) {
  const mol = MOL3[liq.id] || MOL3.water;
  const sc = scale || 1;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const ty = Math.sin(seed * 2.1 + ang * 0.6) * 0.8;
  const cb = Math.cos(ty), sb = Math.sin(ty);
  const pts = [];
  for (const a of mol.atoms) {
    const x1 = (a[0] * ca - a[1] * sa) * sc, y1 = (a[0] * sa + a[1] * ca) * sc, z1 = a[2] * sc;
    const x2 = x1 * cb + z1 * sb, z2 = -x1 * sb + z1 * cb;
    pts.push(m3dV(x + x2, y + y1, z + z2));
  }
  for (const bd of mol.bonds) m3dStick(pts[bd[0]], pts[bd[1]], 0.05 * sc, [0.44, 0.47, 0.52], alpha);
  mol.atoms.forEach((a, i) => m3dSphere(pts[i], a[3] * sc, a[5], alpha));
}

/* ── 3D 분자 확대 보기 — drawZoom(2D)의 3D 판. 액체(닿아 있는 분자들)와
   떠나는 분자(분자째 통째로)를 같은 위상으로 그린다. 캡션은 #zoomCap(HTML)이 담당. */
function drawZoom3D() {
  if (!m3d) return;
  m3dBegin(0, -0.16);
  const Tb = boilingPoint(liq, st.pext);
  const act = Math.max(0.08, Math.min(1, (st.t - st.tRoom) / Math.max(1, Tb - st.tRoom)));
  // 액체 영역 배경판 — 2D 확대의 파란 영역과 같은 뜻. 맨 뒤에 깐다
  m3dPanel(m3dV(-3.4, -2.2, -1.5), m3dV(3.4, -2.2, -1.5), m3dV(3.4, 0, -1.5), m3dV(-3.4, 0, -1.5),
    [0.55, 0.68, 0.92], 0.14, -50);
  m3dStick(m3dV(-3.0, 0, -1.45), m3dV(3.0, 0, -1.45), 0.014, [0.35, 0.42, 0.55], 0.65);
  const seedy = i => ((i * 9301 + 49297) % 233280) / 233280;
  // 액체 — 분자가 서로 닿을 만큼 촘촘하다 (2겹). 증기 쪽과의 대비가 곧 설명이다
  let idx = 0;
  for (let L = 0; L < 2; L++) for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const i = idx++;
    const x = -2.18 + c * 0.97 + (r % 2 ? 0.48 : 0) + (L ? 0.24 : 0);
    const y = -0.38 - r * 0.52 - (L ? 0.20 : 0);
    const z = L ? -0.85 : -0.15;
    drawMol3(x + Math.sin(clock * 1.3 + i) * 0.09 * act, y + Math.cos(clock * 1.7 + i * 1.3) * 0.09 * act,
      z, Math.sin(clock * 0.6 + i) * 0.6, i, 1, 1);
  }
  // 떠나는 분자 (증발/끓음) — ★ 분자째 올라간다. 가열 전에도 증발은 일어난다
  const nEsc = st.boiling ? 5 : Math.max(1, Math.round(act * 3));
  for (let i = 0; i < nEsc; i++) {
    const ph = ((clock * (0.35 + 0.2 * i) + seedy(i * 11 + 5)) % 1);
    const x = -1.85 + seedy(i * 7 + 3) * 3.7;
    const y = 0.06 + ph * 1.52;
    drawMol3(x, y, -0.35, ph * 2.2, i * 3 + 1, 1 - ph * 0.5, 1 - ph * 0.12);
  }
  m3dFlush();
}

/* ============================================================
   2단계 — 열린 용기 vs 닫힌 용기 (학습지 「액체 관찰하기」 · 2026-08-24 신설)
   모형은 계산부 sealedStep/sealedRates 가 담당한다. 여기는 그 결과를 3D 로 보여 주는
   입자 표현(정성적 · 한계 ⑭)과 측정값 표시만 맡는다.
   ============================================================ */
const SEAL_N_MMHG = 12;   // 화면의 기체 분자 1개가 대표하는 압력(mmHg) — 카운터·입자 공용(F-1)
const seal = { st: null, trace: [], parts: [], escaped: [],
               adjAcc: 0, churnAcc: 0, spawnAcc: 0, lastTr: -1 };
function resetSealed() {
  seal.st = { T: $("sT2") ? +$("sT2").value : SEAL.T.def, P: 0,
              volOpen: SEAL.V0, volClosed: SEAL.V0, t: 0 };
  seal.trace = []; seal.parts = []; seal.escaped = [];
  seal.adjAcc = 0; seal.churnAcc = 0; seal.spawnAcc = 0; seal.lastTr = -1;
}
function sealTrace() {
  const s = seal.st;
  if (seal.lastTr < 0 || s.t - seal.lastTr > 0.4) {
    seal.lastTr = s.t;
    seal.trace.push({ s: s.t, p: s.P });
    if (seal.trace.length > 3000) seal.trace.shift();
  }
}

/* 용기 기하 — 두 용기의 유일한 원천. 화면 좌우 배치·액면 높이가 전부 여기서 나온다 */
const VES = { w: 0.88, y0: -1.30, y1: 0.85, d: 0.42, liqH: 0.85, cxO: -1.18, cxC: 1.18 };
const vesselLevel = vol => VES.y0 + VES.liqH * Math.max(0, vol) / SEAL.V0;

function spawnClosed(yL) {
  seal.parts.push({
    x: (Math.random() * 2 - 1) * (VES.w - 0.20), y: Math.min(yL + 0.12, VES.y1 - 0.16),
    z: (Math.random() * 2 - 1) * (VES.d - 0.10),
    vx: Math.random() * 2 - 1, vy: 0.6 + Math.random() * 0.6, vz: Math.random() * 2 - 1,
    ang: Math.random() * 6.2832, va: (Math.random() * 2 - 1) * 1.5
  });
}
function condenseOne() {
  let lo = -1, ly = Infinity;
  for (let i = 0; i < seal.parts.length; i++) if (seal.parts[i].y < ly) { ly = seal.parts[i].y; lo = i; }
  if (lo >= 0) seal.parts.splice(lo, 1);
}
function spawnOpen() {
  const yL = vesselLevel(seal.st.volOpen);
  seal.escaped.push({
    x: (Math.random() * 2 - 1) * (VES.w - 0.25), y: yL + 0.10,
    z: (Math.random() * 2 - 1) * (VES.d - 0.12),
    ph: Math.random() * 6.2832, ang: Math.random() * 6.2832, va: (Math.random() * 2 - 1) * 1.5
  });
}
/* 입자 갱신 — 개수·흐름은 모형(P·포화 증기 압력)을 따라간다. 개수 자체는 정성 배율(한계 ⑭) */
function sealParticles(dt) {
  const s = seal.st, ps = vaporP(liq, s.T);
  const yL = vesselLevel(s.volClosed);
  const target = Math.round(s.P / SEAL_N_MMHG);
  seal.adjAcc += dt;
  if (seal.adjAcc > 0.12) {
    seal.adjAcc = 0;
    if (seal.parts.length < target) spawnClosed(yL);       // 증발이 응축보다 많다 — 한 개 늘린다
    else if (seal.parts.length > target) condenseOne();    // 반대 — 액면 가까운 것이 응축한다
  }
  /* 평형에서도 증발·응축은 계속된다(M3 「정지 = 평형」 방지) — 교환 쌍을 주기적으로 일으킨다 */
  if (seal.parts.length === target && target > 0 && sealedAtEq(s, liq)) {
    seal.churnAcc += dt * Math.min(2.0, SEAL.RATE * ps * 0.25);
    if (seal.churnAcc >= 1) { seal.churnAcc = 0; condenseOne(); spawnClosed(yL); }
  }
  const spd = 0.55 + 0.008 * (s.T - 20);
  for (const p of seal.parts) {
    p.x += p.vx * spd * dt; p.y += p.vy * spd * dt; p.z += p.vz * spd * dt;
    p.ang += p.va * dt;
    const bx = VES.w - 0.16, bz = VES.d - 0.08;
    if (p.x > bx) { p.x = bx; p.vx = -Math.abs(p.vx); } else if (p.x < -bx) { p.x = -bx; p.vx = Math.abs(p.vx); }
    if (p.z > bz) { p.z = bz; p.vz = -Math.abs(p.vz); } else if (p.z < -bz) { p.z = -bz; p.vz = Math.abs(p.vz); }
    const top = VES.y1 - 0.14, bot = Math.min(yL + 0.10, top);   // 뚜껑·액면 사이에서 튕긴다
    if (p.y > top) { p.y = top; p.vy = -Math.abs(p.vy); } else if (p.y < bot) { p.y = bot; p.vy = Math.abs(p.vy); }
  }
  if (s.volOpen > 0) {
    seal.spawnAcc += SEAL.RATE * ps * dt * 0.35;           // 표시 밀도 배율(정성)
    while (seal.spawnAcc >= 1 && seal.escaped.length < 40) { seal.spawnAcc -= 1; spawnOpen(); }
  }
  for (let i = seal.escaped.length - 1; i >= 0; i--) {
    const p = seal.escaped[i];
    p.y += dt * (0.5 + 0.008 * (s.T - 20));
    p.x += Math.sin(s.t * 2 + p.ph) * dt * 0.25;
    p.ang += p.va * dt;
    if (p.y > VES.y1 + 0.65) seal.escaped.splice(i, 1);    // 입구 위로 흩어져 사라진다 — 되돌아오지 않는다
  }
}

function drawVessel(cx, closed) {
  const s = seal.st;
  const vol = closed ? s.volClosed : s.volOpen;
  const yL = vesselLevel(vol);
  const w = VES.w, d = VES.d, y0 = VES.y0, y1 = VES.y1;
  const glass = [0.42, 0.50, 0.62];
  // 뒷벽 유리판 — 맨 뒤
  m3dPanel(m3dV(cx - w, y0, -d), m3dV(cx + w, y0, -d), m3dV(cx + w, y1, -d), m3dV(cx - w, y1, -d),
    [0.72, 0.78, 0.86], 0.28);
  // 액체 몸통(뒤판) — 물질의 실제 겉보기 색 계열
  if (vol > 0)
    m3dPanel(m3dV(cx - w + 0.03, y0, -d + 0.02), m3dV(cx + w - 0.03, y0, -d + 0.02),
      m3dV(cx + w - 0.03, yL, -d + 0.02), m3dV(cx - w + 0.03, yL, -d + 0.02), [0.45, 0.66, 0.88], 0.30);
  // 액체 분자 — 개수는 남은 양에 비례(정성)
  const nL = Math.max(0, Math.round(vol / SEAL.V0 * 18));
  const jig = 0.06 + 0.0036 * (s.T - 20);
  for (let k = 0; k < nL; k++) {
    const r = Math.floor(k / 6), c = k % 6;
    const x = cx - w + 0.22 + c * (2 * (w - 0.22) / 5.6) + (r % 2 ? 0.10 : 0);
    const y = y0 + 0.16 + r * 0.27;
    const z = (k % 2 ? -0.16 : 0.14);
    drawMol3(x + Math.sin(s.t * 1.4 + k * 1.7) * jig, y + Math.cos(s.t * 1.8 + k) * jig, z,
      Math.sin(s.t * 0.5 + k) * 0.5, k, 1, 0.62);
  }
  // 증기 분자 (닫힌) / 흩어지는 분자 (열린)
  if (closed) for (const p of seal.parts) drawMol3(cx + p.x, p.y, p.z, p.ang, 3, 1, 0.62);
  else for (const p of seal.escaped) {
    const fade = p.y > y1 ? Math.max(0.22, 1 - (p.y - y1) / 0.7) : 1;
    drawMol3(cx + p.x, p.y, p.z, p.ang, 3, fade, 0.62);
  }
  // 액면 띠
  if (vol > 0) m3dStick(m3dV(cx - w + 0.05, yL, d * 0.4), m3dV(cx + w - 0.05, yL, d * 0.4),
    0.012, [0.35, 0.45, 0.60], 0.55);
  // 유리벽 모서리 12개
  const E = [
    [[-w, y0, -d], [w, y0, -d]], [[-w, y0, d], [w, y0, d]], [[-w, y0, -d], [-w, y0, d]], [[w, y0, -d], [w, y0, d]],
    [[-w, y0, -d], [-w, y1, -d]], [[w, y0, -d], [w, y1, -d]], [[-w, y0, d], [-w, y1, d]], [[w, y0, d], [w, y1, d]],
    [[-w, y1, -d], [w, y1, -d]], [[-w, y1, d], [w, y1, d]], [[-w, y1, -d], [-w, y1, d]], [[w, y1, -d], [w, y1, d]]
  ];
  for (const eg of E)
    m3dStick(m3dV(cx + eg[0][0], eg[0][1], eg[0][2]), m3dV(cx + eg[1][0], eg[1][1], eg[1][2]),
      0.022, glass, 0.85);
  // 앞면 유리판 — 가장 가까워 맨 나중에 그려진다. 아주 옅게
  m3dPanel(m3dV(cx - w, y0, d), m3dV(cx + w, y0, d), m3dV(cx + w, y1, d), m3dV(cx - w, y1, d),
    [0.80, 0.86, 0.93], 0.10);
  // 뚜껑 — 닫힌 용기에만. 열린 용기는 입구가 그대로 뚫려 있다
  if (closed) {
    m3dPanel(m3dV(cx - w - 0.06, y1 + 0.02, -d - 0.06), m3dV(cx + w + 0.06, y1 + 0.02, -d - 0.06),
      m3dV(cx + w + 0.06, y1 + 0.02, d + 0.06), m3dV(cx - w - 0.06, y1 + 0.02, d + 0.06),
      [0.38, 0.44, 0.53], 0.60);
    m3dSphere(m3dV(cx, y1 + 0.13, 0), 0.09, [0.38, 0.44, 0.53], 0.95);
  }
}
function drawSealed3D() {
  if (!m3d || !seal.st || stage !== 1) return;
  m3dBegin(0, -0.30);
  drawVessel(VES.cxO, false);
  drawVessel(VES.cxC, true);
  m3dFlush();
}

/* 2단계 측정값 — 압력은 전부 atm(mmHg) 병기(setPress). 상태는 색 + 글자(§8) */
function readoutsSealed() {
  const s = seal.st; if (!s) return;
  const ps = vaporP(liq, s.T);
  const r = sealedRates(liq, s.T, s.P);
  setPress("sPsat", "sPsatMm", ps);
  $("sO-Vol").textContent = s.volOpen.toFixed(1);
  $("sO-E").textContent = s.volOpen > 0 ? r.evap.toFixed(1) : "0.0";
  $("sO-C").textContent = "0.0";
  const ro = $("sO-roState"); ro.classList.remove("is-ok", "is-warn");
  if (s.volOpen <= 0) { $("sO-State").textContent = "모두 증발함"; ro.classList.add("is-warn"); }
  else $("sO-State").textContent = "증발 중 — 되돌아오지 않음";
  $("sC-Vol").textContent = s.volClosed.toFixed(1);
  $("sC-E").textContent = r.evap.toFixed(1);
  $("sC-C").textContent = r.cond.toFixed(1);
  $("sC-N").textContent = String(Math.round(s.P / SEAL_N_MMHG));
  setPress("sC-P", "sC-PMm", s.P);
  const rc = $("sC-roState"); rc.classList.remove("is-ok", "is-warn");
  if (sealedAtEq(s, liq)) { $("sC-State").textContent = "동적 평형 — 증발 ≈ 응축"; rc.classList.add("is-ok"); }
  else if (r.evap > r.cond) $("sC-State").textContent = "증발 > 응축 — 기체 분자 늘어남";
  else $("sC-State").textContent = "응축 > 증발 — 기체 분자 줄어듦";
}
/* 2단계 결론 — 지금 실제로 평형일 때만 띄운다(J-N5 — 화면 수치와 어긋나는 순간이 없다).
   온도를 바꾸면 잠시 사라졌다가 새 평형에서 다시 뜬다 — 평형이 「도달하면 끝」이 아님을 보인다 */
function sealConclusion() {
  const el = $("sealConc"); if (!el) return;
  const s = seal.st; if (!s) { el.style.display = "none"; return; }
  const out = [];
  if (sealedAtEq(s, liq) && s.t > 3) {
    const r = sealedRates(liq, s.T, s.P);
    out.push(`닫힌 용기 — 증발 <b>${r.evap.toFixed(1)}개/초</b> ≈ 응축 <b>${r.cond.toFixed(1)}개/초</b> → ` +
      `기체 분자 수와 증기 압력이 더 늘지 않습니다(<b>동적 평형</b>). ` +
      `이때의 증기 압력이 이 온도에서의 <b>포화 증기 압력</b>과 같습니다.`);
  }
  if (s.volOpen <= 0)
    out.push(`열린 용기 — 떠난 분자가 되돌아오지 못해 액체가 <b>모두 증발</b>했습니다.`);
  el.innerHTML = out.join("<br>");
  el.style.display = (stage === 1 && out.length) ? "" : "none";
}

/* ── 온도계 (§3-B) — 비커 무대 오른쪽 별도 2D 캔버스.
   WebGL 셰이더 안이 아니라 여기서 그린다(§5 금지10) — 폴백 시에도 계속 그려진다.
   데이터 색 정확히 3색: --d-blue(선택된 액체 마커) · --d-red(액주) · --t1(눈금·비선택 마커). */
const tcv = $("thermo"), tctx = tcv.getContext("2d");
/* 4단계 전용 왼쪽 온도계 — 비커 무대 왼쪽에 따로 선다 (2026-08-25 사용자 지시 재작업:
   반쪽 액주 하나가 아니라 「왼쪽에 하나, 오른쪽에 하나」). 그리기 코드는 같은 함수를 쓴다(F-1). */
const tcvL = $("thermoL"), tctxL = tcvL ? tcvL.getContext("2d") : null;
/* 이름 표기 맵 — F-1이 허용한 유일한 예외(LIQ.LIST 순서 고정). 온도계·60 ℃ 줄이 함께 쓴다.
   mid = 중간명(온도계 풀 폭 · vp60line), ab = 1글자 약칭(온도계 좁은 폭) */
const DISPLAY = {
  ether: { mid: "에터", ab: "에" }, ethanol: { mid: "에탄올", ab: "탄" },
  water: { mid: "물", ab: "물" }, acetic: { mid: "아세트산", ab: "산" }
};
/* 온도계 한 개를 그린다.
   spec = { t 지금 온도 · color 액주 색 · tag 액주 옆 이름표(없으면 null) · bp 끓는점 마커를 그리는가 }
   ★ 4단계는 이 함수를 두 번 부른다(왼쪽 캔버스 · 오른쪽 캔버스). 나머지 단계는 오른쪽 하나만. */
function paintThermo(cv, ctx, spec) {
  if (!cv || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.width / dpr, H = cv.height / dpr;
  if (W < 40 || H < 60) return;   // 매뉴얼 §5 — 숨은/작은 캔버스 방어(arc 반지름 음수 예외 회피)
  const tctx = ctx;               // 아래 본문은 기존 코드를 그대로 쓴다(오작성 위험을 줄인다)
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.clearRect(0, 0, W, H);
  tctx.fillStyle = C.stageLight; tctx.fillRect(0, 0, W, H);

  const TMIN = -10, TMAX = 140;   // 확정 22(검산 완료) — 손대지 않는다
  const pad = 8;                  // 상하좌우 8px 여백(P4-A2)
  const bulbR = 9;
  const y0 = H - pad - bulbR;     // TMIN 위치(구근 중심)
  const y1 = pad;                 // TMAX 위치
  const Y = t => y0 - (t - TMIN) / (TMAX - TMIN) * (y0 - y1);

  tctx.font = "13px sans-serif";
  const tickW = Math.max(tctx.measureText(String(TMIN)).width, tctx.measureText(String(TMAX)).width);
  const tubeW = 8;
  const tubeX = pad + tickW + 4 + tubeW / 2;    // 눈금 숫자 | 간격 4 | 유리관(중심)
  const afterTubeX = tubeX + tubeW / 2 + 4;     // 유리관 | 간격 4 | 마커 레이블
  const labelMaxW = Math.max(10, W - pad - afterTubeX);

  // 유리관 + 구근
  tctx.strokeStyle = C.ink; tctx.lineWidth = 1;
  tctx.strokeRect(tubeX - tubeW / 2, y1, tubeW, y0 - y1);
  tctx.beginPath(); tctx.arc(tubeX, y0, bulbR, 0, 6.2832); tctx.stroke();

  // 액주 — 구근에서 지금 온도까지 채운다. 범위 밖은 양끝에서 자른다
  const tClamped = Math.max(TMIN, Math.min(TMAX, spec.t));
  const colY = Y(tClamped);
  tctx.fillStyle = spec.color;
  tctx.beginPath(); tctx.arc(tubeX, y0, bulbR - 1, 0, 6.2832); tctx.fill();
  tctx.fillRect(tubeX - tubeW / 2 + 1, colY, tubeW - 2, y0 - colY + bulbR);
  /* 이름표 — 4단계에서 어느 비커의 온도계인지 액주 옆에 직접 적는다(§9 두 번째 채널).
     색만으로 구분하지 않는다. 액주 꼭대기가 눈금 위로 붙지 않게 y1+6 아래로 민다. */
  if (spec.tag) {
    tctx.font = "700 12px sans-serif"; tctx.textAlign = "left"; tctx.textBaseline = "middle";
    tctx.fillStyle = spec.color;
    tctx.fillText(spec.tag, afterTubeX, Math.max(y1 + 6, colY));
  }

  // 눈금선 10 ℃ 간격 + 숫자 20 ℃ 간격(눈금 숫자는 유리관 왼쪽)
  tctx.textAlign = "right"; tctx.textBaseline = "middle";
  for (let t = Math.ceil(TMIN / 10) * 10; t <= TMAX; t += 10) {
    const y = Y(t);
    tctx.strokeStyle = C.ink; tctx.globalAlpha = 0.55; tctx.lineWidth = 1;
    tctx.beginPath(); tctx.moveTo(tubeX - tubeW / 2 - 4, y); tctx.lineTo(tubeX - tubeW / 2, y); tctx.stroke();
    tctx.globalAlpha = 1;
    if (t % 20 === 0) {
      tctx.fillStyle = C.ink; tctx.font = "13px sans-serif";
      tctx.fillText(String(t), tubeX - tubeW / 2 - 6, y);
    }
  }

  // 네 액체의 끓는점 마커(유리관 오른쪽) — 선택된 액체는 --d-blue+▶+굵은 선, 나머지는 --t1+가는 선
  // 표기(중간명/약칭)는 레이블별이 아니라 캔버스 단위로 한 번만 판정한다 — ▶ 접두어를 포함한 최장 문자열로 잰다(§3-B, review A-1)
  // ★ 가장 불리한 조건(선택 상태 = 굵은 글꼴)으로 잰다 — 실기기 한글 볼드는 보통 굵기보다 넓다(review B-6)
  tctx.font = "700 13px sans-serif";
  // 넓은 폭에서는 "▶ 이름 끓는점" — 사용자 확정 U9. 좁은 폭에서는 약칭만(숫자는 어떤 방식으로도 안 들어간다)
  const wideLabel = l => "▶ " + DISPLAY[l.id].mid + " " + boilingPoint(l, st.pext).toFixed(1);
  const narrow = LIQ.LIST.some(l => tctx.measureText(wideLabel(l)).width > labelMaxW);
  /* ★ 마커와 범례는 같은 판정 하나를 읽는다 (매뉴얼 4부 ⑭ — 표기 판정을 두 곳에서 내리지 않는다).
     노출 표 B-3: 「4액체 끓는점 눈금·레이블」·「#thermolegend」는 5단계 「답 확인」 후에만.
     ★ 4단계의 두 온도계는 spec.bp = false 라 이 블록을 건너뛴다 — 범례 판정은 drawThermo() 가 맡는다. */
  const showBp = spec.bp && thermoBpShown();
  $("thermolegend").style.display = (narrow && showBp) ? "block" : "none";

  tctx.textAlign = "left"; tctx.textBaseline = "middle";
  if (showBp) LIQ.LIST.forEach(l => {
    const bp = boilingPoint(l, st.pext);
    if (!(bp >= TMIN && bp <= TMAX)) return;
    const y = Y(bp);
    const sel = l.id === liq.id;
    tctx.strokeStyle = sel ? C.blue : C.ink;
    tctx.lineWidth = sel ? 2.4 : 1;
    tctx.beginPath(); tctx.moveTo(tubeX - tubeW / 2 - 3, y); tctx.lineTo(tubeX + tubeW / 2 + 3, y); tctx.stroke();

    tctx.font = sel ? "700 13px sans-serif" : "13px sans-serif";
    const text = narrow ? ((sel ? "▶" : "") + DISPLAY[l.id].ab)
                        : ((sel ? "▶ " : "") + DISPLAY[l.id].mid + " " + boilingPoint(l, st.pext).toFixed(1));
    tctx.fillStyle = sel ? C.blue : C.ink;
    tctx.fillText(text, afterTubeX, y);
  });
  tctx.textAlign = "left"; tctx.textBaseline = "alphabetic";
}

/* 온도계 배치 판정 — 한 곳에서만 내린다(F-1).
   4단계: 왼쪽 캔버스 = 왼쪽 비커(--d-blue) · 오른쪽 캔버스 = 오른쪽 비커(--d-gray).
          색 배정은 가열 곡선의 두 선과 같다. 소진된 비커는 duoTemp() 가 붙잡아 둔 값을 준다.
   그 밖: 오른쪽 온도계 하나에 --d-red(계측기 관습색 · §4 예외). */
function drawThermo() {
  if (stage === 4 && duo.L && duo.R) {
    paintThermo(tcvL, tctxL, { t: duoTemp(duo.L), color: C.blue, tag: "왼", bp: false });
    paintThermo(tcv, tctx, { t: duoTemp(duo.R), color: C.gray, tag: "오", bp: false });
    const lg = $("thermolegend"); if (lg) lg.style.display = "none";
    return;
  }
  paintThermo(tcv, tctx, { t: st.t, color: C.red, tag: null, bp: true });
}

/* ── 그래프 ── */
const ccv = $("chart"), cctx = ccv.getContext("2d");
let chartMode = "heat";     // heat = 가열 곡선 / vp = 증기 압력 곡선
let vpGeo = null;           // 증기 압력 곡선의 화면 기하 — drawChart() 가 한 번만 적는다
function drawChart() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = ccv.width / dpr, H = ccv.height / dpr;
  if (W < 120 || H < 80) return;  // 매뉴얼 §5 — 카드가 숨겨진 단계에서는 그리지 않는다
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cctx.fillStyle = C.stageLight; cctx.fillRect(0, 0, W, H);
  const pad = { l: 54, r: 16, t: 30, b: 34 };
  const PL = W - pad.l - pad.r, PH = H - pad.t - pad.b;
  const frame = (xl, yl) => {
    cctx.strokeStyle = AXIS; cctx.lineWidth = 1;
    cctx.beginPath(); cctx.moveTo(pad.l, pad.t); cctx.lineTo(pad.l, H - pad.b); cctx.lineTo(W - pad.r, H - pad.b); cctx.stroke();
    cctx.fillStyle = C.t3; cctx.font = "11px sans-serif";
    cctx.textAlign = "left"; cctx.fillText(yl, 4, pad.t - 12);
    cctx.textAlign = "right"; cctx.fillText(xl, W - pad.r, H - 6);
    cctx.textAlign = "left";
  };
  const grid = (x0, x1, y0, y1, fx, fy, X, Y) => {
    cctx.font = "11px sans-serif";
    for (let i = 0; i <= 4; i++) {
      const xv = x0 + (x1 - x0) * i / 4, yv = y0 + (y1 - y0) * i / 4;
      if (i > 0) {
        cctx.strokeStyle = GRID; cctx.lineWidth = 1;
        cctx.beginPath(); cctx.moveTo(X(xv), pad.t); cctx.lineTo(X(xv), H - pad.b); cctx.stroke();
        cctx.beginPath(); cctx.moveTo(pad.l, Y(yv)); cctx.lineTo(W - pad.r, Y(yv)); cctx.stroke();
      }
      cctx.fillStyle = C.t3;
      cctx.textAlign = "center"; cctx.fillText(fx(xv), X(xv), H - pad.b + 15);
      cctx.textAlign = "right"; cctx.fillText(fy(yv), pad.l - 6, Y(yv) + 3.5);
    }
    cctx.textAlign = "left";
  };

  /* ── 1단계(증발) — 닫힌 용기의 증기 압력–시간 곡선 ──
     학습지 ①·②의 관찰 본체: 압력이 점점 늘다가(증발 > 응축) 포화 증기 압력에서
     일정해진다(동적 평형). 점선 = 이 온도에서의 포화 증기 압력. */
  if (stage === 1) {
    const s2 = seal.st;
    const tr = seal.trace;
    const ps = vaporP(liq, s2 ? s2.T : SEAL.T.def);
    const tmax = Math.max(30, ...tr.map(p => p.s)) * 1.05;
    const ymax = Math.max(ps * 1.35, ...tr.map(p => p.p * 1.2), 40);
    const X = v => pad.l + v / tmax * PL, Y = v => (H - pad.b) - v / ymax * PH;
    frame("시간 (초)", "닫힌 용기 증기 압력 (mmHg)");
    grid(0, tmax, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);
    // 포화 증기 압력 점선 — 온도 슬라이더를 밀면 함께 움직인다
    cctx.strokeStyle = C.red; cctx.setLineDash([6, 4]); cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(pad.l, Y(ps)); cctx.lineTo(W - pad.r, Y(ps)); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = C.red; cctx.font = "600 10.5px sans-serif";
    cctx.fillText(`이 온도에서의 포화 증기 압력 ${(ps / 760).toFixed(2)} atm (${ps.toFixed(0)} mmHg)`,
      pad.l + 6, Math.max(pad.t + 12, Y(ps) - 5));
    if (tr.length > 1) {
      cctx.lineWidth = 2.2; cctx.strokeStyle = C.blue;
      cctx.beginPath();
      tr.forEach((p, i) => i ? cctx.lineTo(X(p.s), Y(p.p)) : cctx.moveTo(X(p.s), Y(p.p)));
      cctx.stroke();
      const last = tr[tr.length - 1];
      cctx.fillStyle = C.stageLight; cctx.strokeStyle = C.blue; cctx.lineWidth = 2.6;
      cctx.beginPath(); cctx.arc(X(last.s), Y(last.p), 5, 0, 6.2832); cctx.fill(); cctx.stroke();
    } else {
      cctx.fillStyle = C.t3; cctx.font = "12.5px sans-serif";
      cctx.fillText("시간이 흐르면 닫힌 용기의 증기 압력 곡선이 그려집니다", pad.l + 8, pad.t + 16);
    }
    return;
  }

  /* ── C-5 4단계 가열 곡선 겹쳐 그리기 ──
     두 실험의 곡선을 한 그래프에. 실선 = 왼쪽(적은 쪽) / 파선 = 오른쪽(많은 쪽) +
     곡선 옆 직접 레이블(매뉴얼 §9 — 색만으로 구분하지 않는다).
     ★ 가로축은 4단계의 다른 시간 표기와 같은 「화면에서 지나간 시간」이다 (duoTime() 하나만 읽는다).
       S-검토 A-2: 1·3·5단계의 같은 축 이름은 「실험 시간」이고 「가정과 한계」 ⑤가 그것을 학생에게
       못 박는다. 4단계만 뜻이 다르므로 축 이름에 그 사실을 적는다. */
  if (stage === 4) {
    const all = duo.L.trace.concat(duo.R.trace);
    const tmax = Math.max(20, ...all.map(p => duoTime(p.s))) * 1.05;
    const ymax = Math.max(130, ...all.map(p => p.t)) * 1.1;
    const X = v => pad.l + v / tmax * PL, Y = v => (H - pad.b) - v / ymax * PH;
    frame("화면에서 지나간 시간 (초)", "온도 (℃)");
    grid(0, tmax, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);
    /* 끓는점 점선은 예측 게이트를 통과한 뒤에만 그린다 — 시작 전에 뜨면 #rTb 를 감춘 이유가 무너진다 */
    const Tb = boilingPoint(liq, duo.L.st.pext);
    if (duo.started && Tb < ymax) {
      cctx.strokeStyle = C.red; cctx.setLineDash([6, 4]); cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(pad.l, Y(Tb)); cctx.lineTo(W - pad.r, Y(Tb)); cctx.stroke();
      cctx.setLineDash([]);
      cctx.fillStyle = C.red; cctx.font = "600 10.5px sans-serif";
      cctx.fillText(`끓는점 ${Tb.toFixed(1)} ℃ (외부 ${duo.L.st.pext.toFixed(2)} atm)`, pad.l + 6, Y(Tb) - 5);
    }
    /* 레이블이 붙는 자리 — 「꺾이는 자리」(끓기 시작 지점), 아직 안 끓었으면 곡선 끝.
       ★ 이 규칙은 여기 한 곳에만 둔다(F-1) — 아래 one() 과 위아래 배치 판정이 같은 점을 읽는다. */
    const anchorOf = b => (b.trace.length < 2 ? null : (b.trace.find(p => p.b) || b.trace[b.trace.length - 1]));
    /* 소진된 뒤에는 그 곡선을 더 연장하지 않는다 — trace 가 done 시점에서 멈춘다(stepDuoOne) */
    const one = (b, dash, col, dy) => {
      if (b.trace.length < 2) return;
      cctx.strokeStyle = col; cctx.lineWidth = 2.2; cctx.setLineDash(dash);
      cctx.beginPath();
      b.trace.forEach((p, i) => i ? cctx.lineTo(X(duoTime(p.s)), Y(p.t)) : cctx.moveTo(X(duoTime(p.s)), Y(p.t)));
      cctx.stroke(); cctx.setLineDash([]);
      /* ★ 레이블은 곡선의 「꺾이는 자리」(끓기 시작 지점)에 붙인다. 곡선 끝에 붙이면
         양쪽이 함께 끓는 동안 두 끝점이 같은 자리(같은 시각·같은 온도)에 겹쳐
         나중에 그린 레이블이 앞의 것을 덮는다(실측 C2-boiling-1194 — 「50 mL」가 사라졌다).
         끓기 시작 시각은 두 비커가 서로 다르므로 겹치지 않는다. */
      const anchor = anchorOf(b);
      /* 2라운드는 다른 변인(가열 출력)이 레이블이다 (2026-08-25) */
      const lab = duo.round === 2 ? `${b.st.heat} W` : `${b.startVol} mL`;
      cctx.font = "700 12px sans-serif";
      const lw = cctx.measureText(lab).width;
      let lx = X(duoTime(anchor.s)) + 8;
      const ly = Math.min(H - pad.b - 4, Math.max(pad.t + 12, Y(anchor.t) + dy));
      if (lx + lw + 4 > W - pad.r) lx = X(duoTime(anchor.s)) - lw - 8;
      if (lx < pad.l + 2) lx = pad.l + 2;
      cctx.fillStyle = C.stageLight; cctx.fillRect(lx - 3, ly - 11, lw + 6, 15);
      cctx.fillStyle = col; cctx.fillText(lab, lx, ly);
    };
    /* dy 는 끓는점 점선 레이블(Y(Tb)−5 자리)과 겹치지 않도록 벌린 값이다 —
       −8 로 두면 먼저 끓는 쪽의 레이블 배경판이 「끓는점 … (외부 1.00 atm)」을 덮는다(실측).
       ★ 위/아래는 «그 순간 어느 곡선이 위에 있는가»로 정한다 (2026-08-25 실측 수정).
         위 곡선의 레이블은 위로, 아래 곡선의 레이블은 아래로 — 두 레이블이 가운데에서 만나지 않는다.
         2라운드(300 W vs 600 W)는 같은 시각에 두 곡선의 «높이»가 크게 벌어지는데, 고정 배치로 두면
         아래 곡선의 「위 레이블」과 위 곡선의 「아래 레이블」이 정면으로 겹친다(실측 r2-1194). */
    const aL = anchorOf(duo.L), aR = anchorOf(duo.R);
    const lUp = !(aL && aR) || aL.t >= aR.t;          // 왼쪽이 위에 있으면 왼쪽 레이블이 위
    one(duo.L, [], C.blue, lUp ? -24 : 18);
    one(duo.R, [5, 4], C.gray, lUp ? 18 : -24);
    if (!all.length) {
      /* 360 px 폭에서는 한 줄이 눈금 밖으로 넘친다 — 문구를 줄이지 않고 두 줄로 나눈다 */
      cctx.fillStyle = C.t3; cctx.font = "12.5px sans-serif";
      cctx.fillText("『예측했습니다 — 시작』을 누르면", pad.l + 8, pad.t + 16);
      cctx.fillText("두 곡선이 함께 그려집니다", pad.l + 8, pad.t + 33);
    }
    return;
  }

  if (chartMode === "heat") {
    const tmax = Math.max(60, ...trace.map(p => p.s)) * 1.05;
    const ymax = Math.max(130, ...trace.map(p => p.t)) * 1.1;
    const X = v => pad.l + v / tmax * PL, Y = v => (H - pad.b) - v / ymax * PH;
    frame("시간 (초)", "온도 (℃)");
    grid(0, tmax, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);
    // 끓는점 수평선
    const Tb = boilingPoint(liq, st.pext);
    if (Tb < ymax) {
      cctx.strokeStyle = C.red; cctx.setLineDash([6, 4]); cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(pad.l, Y(Tb)); cctx.lineTo(W - pad.r, Y(Tb)); cctx.stroke();
      cctx.setLineDash([]);
      /* ⑫ 답 확인 전에는 점선만 그리고 레이블을 생략한다 — 선택한 액체의 계산 끓는점이
         숫자로 캔버스에 찍히면 「답 확인」이 무의미해진다(지시안 B-4 ⑫) */
      if (!gated()) {
        cctx.fillStyle = C.red; cctx.font = "600 10.5px sans-serif";
        cctx.fillText(`끓는점 ${Tb.toFixed(1)} ℃ (외부 ${st.pext.toFixed(2)} atm)`, pad.l + 6, Y(Tb) - 5);
      }
    }
    if (trace.length > 1) {
      // 끓는 구간은 굵은 실선, 나머지는 보통 실선 (색 + 굵기 두 채널)
      cctx.lineWidth = 2.2; cctx.strokeStyle = C.blue;
      cctx.beginPath();
      trace.forEach((p, i) => i ? cctx.lineTo(X(p.s), Y(p.t)) : cctx.moveTo(X(p.s), Y(p.t)));
      cctx.stroke();
      cctx.lineWidth = 5; cctx.strokeStyle = C.blue; cctx.globalAlpha = 0.45;
      cctx.beginPath(); let pen = false;
      for (const p of trace) {
        if (p.b) { pen ? cctx.lineTo(X(p.s), Y(p.t)) : cctx.moveTo(X(p.s), Y(p.t)); pen = true; }
        else pen = false;
      }
      cctx.stroke(); cctx.globalAlpha = 1; cctx.lineWidth = 1;
      const last = trace[trace.length - 1];
      cctx.fillStyle = C.stageLight; cctx.strokeStyle = C.blue; cctx.lineWidth = 2.6;
      cctx.beginPath(); cctx.arc(X(last.s), Y(last.t), 5, 0, 6.2832); cctx.fill(); cctx.stroke();
    } else {
      cctx.fillStyle = C.t3; cctx.font = "12.5px sans-serif";
      cctx.fillText("『이어서 실험』을 누르면 곡선이 그려집니다", pad.l + 8, pad.t + 16);
    }
  } else {
    /* v2.2 3-F — 세로축 1400→1900(확정 23: 60 ℃ 에터 1721 mmHg가 눈금 안에 들어와야 한다).
       ⓐ 60 ℃ 세로선(양방향 발문 전반부) + ⓑ 760 mmHg 고정 수평선(후반부)을 한 화면에 동시 표시한다. */
    const x0 = -20, x1 = 140, ymax = 1900;
    const X = v => pad.l + (v - x0) / (x1 - x0) * PL, Y = v => (H - pad.b) - v / ymax * PH;
    /* 커서 추적선이 화면 좌표 → 온도를 되돌릴 때 쓰는 유일한 기하 원천(F-1).
       여기서 한 번만 적고, pointermove 핸들러는 이것을 읽는다 */
    vpGeo = { padL: pad.l, PL, x0, x1, W };
    frame("온도 (℃)", "포화 증기 압력 (mmHg)");
    grid(x0, x1, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);

    // 외부 압력 수평선(슬라이더로 조작한 현재 외부 압력) — 760과 8 mmHg 이내로 겹치면 생략(A3·B1 보호)
    const pe = st.pext * 760;
    const peNearRef = Math.abs(pe - 760) < 8;
    if (!peNearRef) {
      cctx.strokeStyle = C.ink; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(pad.l, Y(pe)); cctx.lineTo(W - pad.r, Y(pe)); cctx.stroke();
      cctx.fillStyle = C.ink; cctx.font = "600 11px sans-serif";
      cctx.fillText(`외부 압력 ${pe.toFixed(0)} mmHg`, pad.l + 6, Y(pe) - 5);
    }

    // ⓑ 760 mmHg 고정 수평선 — "각자의 기준 끓는점에서는 모두 760 mmHg로 같다"
    cctx.strokeStyle = C.ink; cctx.lineWidth = 1.6;
    cctx.beginPath(); cctx.moveTo(pad.l, Y(760)); cctx.lineTo(W - pad.r, Y(760)); cctx.stroke();
    cctx.fillStyle = C.ink; cctx.font = "600 11px sans-serif";
    cctx.fillText("760 mmHg = 1 atm", pad.l + 6, Y(760) - 5);

    // ⓐ 60 ℃ 세로 점선 — "같은 온도에서는 서로 다르다"
    cctx.strokeStyle = C.ink; cctx.setLineDash([4, 4]); cctx.lineWidth = 1.6;
    cctx.beginPath(); cctx.moveTo(X(60), pad.t); cctx.lineTo(X(60), H - pad.b); cctx.stroke();
    cctx.setLineDash([]);

    // 네 액체의 곡선 — 색 2개 + 파선/실선 + 이름 직접 붙이기 (매뉴얼 §9 두 번째 채널)
    LIQ.LIST.forEach((l, i) => {
      const sel = l.id === liq.id;
      cctx.strokeStyle = sel ? C.blue : C.gray;
      cctx.lineWidth = sel ? 3 : 1.4;
      cctx.setLineDash(sel ? [] : [5, 4]);
      cctx.beginPath();
      let started = false;
      for (let t = x0; t <= x1; t += 1) {
        const p = vaporP(l, t);
        if (p > ymax * 1.2) { started = false; continue; }
        const px = X(t), py = Y(Math.min(p, ymax));
        started ? cctx.lineTo(px, py) : cctx.moveTo(px, py); started = true;
      }
      cctx.stroke(); cctx.setLineDash([]);
      // 이름을 곡선 옆에 직접 (§6 H군: 12px 이상)
      const tb = boilingPoint(l, 1);
      cctx.fillStyle = sel ? C.blue : C.t3;
      cctx.font = sel ? "700 12px sans-serif" : "12px sans-serif";
      /* ⑬ 답 확인 전에는 이름을 760 교점 위에 앉히지 않는다.
         ⑤로 점을 지워도 이름이 교점 자리를 그대로 가리킨다 — 점을 지우고 이름을 남기면 답이 남는다.
         확인 전에는 「곡선의 오른쪽 끝」(눈금 안에 남아 있는 마지막 점)에 붙인다. */
      if (gated()) {
        let te = x0;
        for (let t = x0; t <= x1; t += 1) { if (vaporP(l, t) <= ymax) te = t; else break; }
        const ex = Math.min(X(te), W - pad.r - 2);
        const ey = Math.min(H - pad.b - 4, Math.max(pad.t + 16, Y(Math.min(vaporP(l, te), ymax)) + 16));
        /* ⚠ 곡선 오른쪽 끝은 곡선·60 ℃ 점선과 겹치는 자리다 — 배경판 없이 쓰면 이름이 읽히지 않는다
           (확대 캡션과 같은 처방: 불투명 배경판을 깔면 위치와 무관하게 판독이 보장된다) */
        const lw = cctx.measureText(l.name).width;
        const keep = cctx.fillStyle;
        cctx.fillStyle = C.stageLight;
        cctx.fillRect(ex - lw - 4, ey - 11, lw + 8, 15);
        cctx.fillStyle = keep;
        cctx.textAlign = "right";
        cctx.fillText(l.name, ex, ey);
        cctx.textAlign = "left";
      } else {
        const ly = Y(760);
        cctx.save(); cctx.translate(X(tb), ly - 8); cctx.rotate(-0.5);
        cctx.fillText(l.name, 0, 0); cctx.restore();
      }

      // ⓑ 교점 — 각자의 기준 끓는점(pext=1 atm)에서 760 mmHg와 만나는 점. 전부 760이므로 숫자는 쓰지 않는다
      // ⑤ 답 확인 전에는 그리지 않는다 (display:none 이 아니라 「그리지 않는 것」)
      if (!gated()) {
        cctx.fillStyle = sel ? C.blue : "rgba(95,107,122,0.6)";
        cctx.beginPath(); cctx.arc(X(tb), Y(760), sel ? 5 : 3, 0, 6.2832); cctx.fill();
      }

      // ⓐ 교점 — 60 ℃에서 곡선과 만나는 점. 값 숫자는 캔버스에 그리지 않는다(그래프 카드 아래 HTML 줄로 이전)
      const p60 = vaporP(l, 60);
      if (p60 <= ymax * 1.2) {
        cctx.fillStyle = sel ? C.blue : "rgba(95,107,122,0.6)";
        cctx.beginPath(); cctx.arc(X(60), Y(Math.min(p60, ymax)), sel ? 5 : 3, 0, 6.2832); cctx.fill();
      }

      /* 현재 외부 압력선과의 교점(기존 기능 — 슬라이더로 조작한 압력에서의 끓는점)
         ⑭ 기본 pext = 1.00 에서는 Y(pe) === Y(760) 이라 ⓑ 교점과 **같은 자리**에 두 번째 점이 찍힌다.
            ⑤만 지우면 답이 그대로 남는다. 답 확인 전에는 pext 가 760 에서 8 mmHg 이상 떨어졌을 때만 그린다
            (peNearRef 는 위의 외부 압력 수평선 판정과 같은 값을 읽는다 — 판정을 두 곳에서 내리지 않는다) */
      const bx = boilingPoint(l, st.pext);
      if (bx > x0 && bx < x1 && (!gated() || !peNearRef)) {
        cctx.fillStyle = sel ? C.blue : "rgba(95,107,122,0.55)";
        cctx.beginPath(); cctx.arc(X(bx), Y(pe), sel ? 5 : 3, 0, 6.2832); cctx.fill();
      }
    });
    // ③ 곡선 좌상단 정답 2줄 — 답 확인 전에는 그리지 않는다
    if (!gated()) {
      cctx.fillStyle = C.t3; cctx.font = "11px sans-serif";
      cctx.fillText("● 같은 온도(60 ℃)에서는 서로 다르다.", pad.l + 6, pad.t + 12);
      cctx.fillText("● 각자의 기준 끓는점에서는 모두 760 mmHg로 같다.", pad.l + 6, pad.t + 26);
    }

    /* ── 커서 추적 십자선 (지시안 B-5 · P0 ③ 「손으로 짚기」의 실행 장치) ──
       마우스 y 와 무관하게 **선택된 액체의 곡선 위 값**을 읽어 준다. */
    if (cursorT != null && stage === 5) {
      const t = Math.max(x0, Math.min(x1, cursorT));
      const p = vaporP(liq, t);
      const inRange = p <= ymax;
      const py = Y(Math.min(p, ymax));
      cctx.save();
      cctx.strokeStyle = C.blue; cctx.globalAlpha = 0.8;
      cctx.setLineDash([3, 3]); cctx.lineWidth = 1.2;
      cctx.beginPath(); cctx.moveTo(X(t), pad.t); cctx.lineTo(X(t), H - pad.b); cctx.stroke();
      if (inRange) { cctx.beginPath(); cctx.moveTo(pad.l, py); cctx.lineTo(W - pad.r, py); cctx.stroke(); }
      cctx.setLineDash([]); cctx.globalAlpha = 1;
      if (inRange) {
        cctx.fillStyle = C.stageLight; cctx.strokeStyle = C.blue; cctx.lineWidth = 2.4;
        cctx.beginPath(); cctx.arc(X(t), py, 4.5, 0, 6.2832); cctx.fill(); cctx.stroke();
      }
      const tip = `${t.toFixed(0)} ℃ · ${p.toFixed(0)} mmHg`;
      cctx.font = "700 12px sans-serif";
      const tw = cctx.measureText(tip).width;
      let bx2 = X(t) + 9, by2 = (inRange ? py : pad.t) - 26;
      if (bx2 + tw + 12 > W - pad.r) bx2 = X(t) - tw - 21;
      if (bx2 < pad.l) bx2 = pad.l;
      if (by2 < pad.t) by2 = (inRange ? py : pad.t) + 8;
      cctx.fillStyle = C.stageLight; cctx.fillRect(bx2, by2, tw + 12, 21);
      cctx.strokeStyle = C.blue; cctx.lineWidth = 1.2; cctx.strokeRect(bx2, by2, tw + 12, 21);
      cctx.fillStyle = C.ink; cctx.fillText(tip, bx2 + 6, by2 + 15);
      cctx.restore();
    }
  }
}

/* ── 측정값 ── */
/* 압력 병기 표기의 단일 원천 — 「1.00 atm (760 mmHg)」 (2026-08-24 사용자 지시 · F-1).
   value 칸에 atm, 뒤 unit 칸에 (mmHg) 를 쓴다. 두 자리·정수 유효숫자 고정(§8). */
function setPress(idV, idMm, mmhg) {
  const v = $(idV), m = $(idMm);
  if (v) v.textContent = mmhg == null ? "–" : (mmhg / 760).toFixed(2);
  if (m) m.textContent = mmhg == null ? "" : ` (${mmhg.toFixed(0)} mmHg)`;
}
function readouts() {
  const Tb = boilingPoint(liq, st.pext);
  const pv = vaporP(liq, st.t);
  $("rT").textContent = st.t.toFixed(1);
  /* ⑥ 5단계 답 확인 전에는 값 자체를 만들지 않는다. readout 째 숨기는 것은 노출 표(SHOW.roTb)가 한다 */
  $("rTb").textContent = gated() ? "–" : Tb.toFixed(1);
  /* 압력은 atm 을 앞세우고 mmHg 를 병기한다 — 「1 atm (760 mmHg)」 (2026-08-24 사용자 지시) */
  setPress("rPv", "rPvMm", pv);
  setPress("rPe", "rPeMm", st.pext * 760);
  $("rVol").textContent = st.volume.toFixed(0);
  const ro = $("roState");
  ro.classList.remove("is-ok", "is-warn");
  if (st.volume <= 0) { $("rState").textContent = "다 끓음"; ro.classList.add("is-warn"); }
  else if (st.boiling) { $("rState").textContent = "끓는 중"; ro.classList.add("is-ok"); }
  else if (st.heat > 0) { $("rState").textContent = "가열 중"; }
  else { $("rState").textContent = "정지"; }
  $("stateNote").innerHTML = st.volume <= 0
    ? "<b>⚠ 여기서부터는 모형이 실제와 다릅니다.</b> 액체가 다 증발하자 화면이 온도를 실온으로 되돌렸습니다. 실제 실험에서는 불을 끄지 않는 한 빈 비커가 계속 뜨거워집니다. <b>액체가 없으므로 위의 포화 증기 압력은 「그 온도의 액체가 가질 값」일 뿐, 빈 비커 안의 상태가 아닙니다.</b>"
    : st.boiling
    ? "포화 증기 압력이 외부 압력과 <b>같아졌습니다</b> → 액체 <b>속에서도</b> 기화가 일어납니다. 이것이 끓음입니다."
    : `포화 증기 압력 ${(pv / 760).toFixed(2)} atm (${pv.toFixed(0)} mmHg) &lt; 외부 압력 ${st.pext.toFixed(2)} atm (${(st.pext * 760).toFixed(0)} mmHg) → 아직 <b>표면에서만</b> 증발합니다.`;
  /* 3단계 결론 — ★ 끓기 시작한 뒤에만, 그리고 화면의 끓는점이 실제로 100 ℃보다 낮을 때만 (J-N5).
     설계안 v2 차시 7 ★ 오개념의 원문 처방이다 — 「빨리 끓는다」로 읽히게 쓰지 않는다. */
  const ar = $("altResult");
  if (ar && stage === 3) {
    const lowered = st.boiling && Tb < 99.95;
    ar.innerHTML = lowered
      ? "끓는점이 낮아졌습니다 — 물이 <b>빨리</b> 끓는 것이 아니라 <b>덜 뜨거운 채로</b> 끓습니다."
      : "";
    ar.style.display = lowered ? "" : "none";
  }
}

/* ── 기록 ── */
const HEADERS = ["학번", "액체", "외부 압력(atm)", "액체의 양(mL)", "가열 출력(W)",
  "측정한 끓는점(℃)", "이론 끓는점(℃)", "끓기까지 걸린 시간(초)", "그때의 포화 증기 압력(mmHg)"];
const TH_COL = 6;   // ⑩ HEADERS 의 「이론 끓는점(℃)」 자리 — 답 확인 전에는 이 열을 통째로 뺀다
function record() {
  const Tb = boilingPoint(liq, st.pext);
  if (!st.boiling) {
    $("recnote").innerHTML = '<span style="color:var(--d-red);font-weight:700">아직 끓지 않았습니다. 끓기 시작한 뒤에 기록하세요.</span>';
    return;
  }
  rows.push({
    seat: $("seat").value.trim() || "(무기명)", liq: liq.name, pext: st.pext,
    vol0: startVol, heat: st.heat, tb: st.t, tbTheory: Tb,
    time: boilStartAt >= 0 ? boilStartAt : clock, pv: vaporP(liq, st.t)
  });
  $("recnote").innerHTML = '<span style="color:var(--d-green);font-weight:700">기록했습니다.</span>';
  renderTable();
}
function renderTable() {
  $("recCount").textContent = rows.length ? `— ${rows.length}회` : "";
  const w = $("tableWrap");
  if (!rows.length) { w.innerHTML = '<div class="empty">아직 기록이 없습니다.</div>'; return; }
  /* 화면 기록표는 5열(§1-2 추정10 · 가독성 목적). CSV는 HEADERS 9열 그대로 유지한다(F-1과 별개).
     ⑨ 답 확인 전에는 「이론(℃)」 열을 **열째** 뺀다 — 빈 칸으로 두면 학생이 열 제목에서 답을 읽는다 */
  const th = !gated();
  w.innerHTML = "<table><thead><tr><th>#</th><th>액체</th><th>외부압(atm)</th>" +
    "<th>측정 끓는점(℃)</th>" + (th ? "<th>이론(℃)</th>" : "") + "</tr></thead><tbody>" +
    rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.liq}</td><td>${r.pext.toFixed(2)}</td>` +
      `<td>${r.tb.toFixed(1)}</td>` + (th ? `<td>${r.tbTheory.toFixed(1)}</td>` : "") + `</tr>`).join("") + "</tbody></table>";
}
$("rec").onclick = record;
$("clr").onclick = () => { rows = []; $("recnote").textContent = ""; renderTable(); };
$("csv").onclick = () => {
  if (!rows.length) { $("recnote").innerHTML = '<span style="color:var(--d-red);font-weight:700">먼저 기록하세요.</span>'; return; }
  /* ⑩ 답 확인 전에 내보낸 CSV 에는 「이론 끓는점(℃)」 열이 헤더째 없다.
     화면에서만 감추면 CSV 로 답이 새어 나간다(완료 기준 ⑤는 DOM·캔버스·CSV 전부를 본다) */
  const drop = gated();
  const heads = drop ? HEADERS.filter((_, i) => i !== TH_COL) : HEADERS;
  const body = rows.map(r => {
    const a = [r.seat, r.liq, r.pext.toFixed(2), r.vol0, r.heat,
      r.tb.toFixed(2), r.tbTheory.toFixed(2), r.time.toFixed(1), r.pv.toFixed(1)];
    if (drop) a.splice(TH_COL, 1);
    return a;
  });
  const csv = "﻿" + [heads, ...body].map(a => a.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = (($("seat").value.trim() || "무기명").replace(/[\\/:*?"<>|]/g, "")) + "_액체끓음.csv";
  a.click(); URL.revokeObjectURL(a.href);
};

/* ── 컨트롤 ── */
let startVol = 100, boilStartAt = -1;
function resetRun() {
  st.t = st.tRoom; st.volume = +$("sVol").value; st.boiling = false;
  startVol = st.volume; boilStartAt = -1; clock = 0; trace = [];
  $("recnote").textContent = "";
}
/* ★ 액체별 외부 압력 하한 (LIQ.LIST[].pextMin)
   그 액체가 실온 이상에서 끓는 최저 압력. 아래로 내리면 "가열 중인데 온도가
   실온보다 내려가는" 그림이 되는데, 이 화면의 열원 모형은 감압 비등의 냉각을
   다루지 않는다. 매뉴얼 §2-④(안전한 범위) · P5 M8(범위 = 세계) 대응.
   슬라이더 min 을 바꾸고, 현재값이 하한보다 낮으면 하한으로 끌어올린다. */
function applyPextMin() {
  const lo = liq.pextMin;
  const el = $("sPext");
  el.min = lo.toFixed(2);
  const endMin = $("pextEndMin");
  if (endMin) endMin.textContent = lo.toFixed(2) + " atm";   // 슬라이더 끝 표시도 같은 값을 읽는다
  if (st.pext < lo) {
    st.pext = lo;
    el.value = lo.toFixed(2);
    $("vPext").textContent = lo.toFixed(2);
  }
  const note = $("pextNote");
  if (lo > LIQ.PEXT.min) {
    note.innerHTML = `<b>${liq.name}</b>는 <b>${lo.toFixed(2)} atm</b>까지만 내릴 수 있습니다 — ` +
      `더 낮추면 <b>실온보다 낮은 온도</b>에서 끓어, 이 화면의 열원 모형이 다루지 못합니다.`;
    note.style.display = "";
  } else {
    note.style.display = "none";
  }
}

/* ★ 추정 6 — 액체별 권장 배속 (실행 B2 승계 · 어느 실행에도 배정되지 않았던 항목).
   실측(300 W · ×10): 에터 100 mL 는 끓기 시작 0.81 실시간초 · 소진 9.3초, 20 mL 는 0.16초로
   관찰이 불가능하다. 액체를 바꿀 때 값만 자동으로 맞추고 **슬라이더는 그대로 조작 가능**하게 둔다.
   ⚠ 자유 탐구인 5단계에서만 동작한다 — 1~4단계는 STAGE 표의 lock 이 ×10 으로 잠근다. */
const SPEED_BY_LIQ = { ether: 1, ethanol: 5, water: 10, acetic: 10 };
function applyLiqSpeed() {
  if (stage !== 5) return;
  const el = $("sSpeed"), note = $("speedNote");
  const next = SPEED_BY_LIQ[liq.id];
  if (next == null) return;
  const prev = +el.value;
  el.value = String(next); $("vSpeed").textContent = String(next);
  if (!note) return;
  /* 안내 문구는 「낮췄습니다」다 — 올릴 때 띄우면 화면 문구가 수치와 어긋난다(J-N5).
     ★ S-검토 A-1: `next < prev` 만으로는 배속을 ×40 으로 올려 둔 뒤 **물**을 고르면
       "이 액체는 매우 빨리 끓습니다"가 뜬다. 물은 네 액체 중 가장 느리게 끓고(11.15 화면초),
       이 시뮬 전체가 싸우는 문장이 「물이 빨리 끓는다」(설계안 v2 ★ 오개념 · 금지 6)다.
       권장 배속이 기본 ×10 미만인 액체(에터·에탄올)에만 띄운다. */
  const lowered = next < prev && next < 10;
  note.textContent = lowered ? "이 액체는 매우 빨리 끓습니다 — 배속을 낮췄습니다" : "";
  note.style.display = lowered ? "" : "none";
}
function buildLiquidPicker() {
  const host = $("liqpick"); host.innerHTML = "";
  LIQ.LIST.forEach(l => {
    const b = document.createElement("button");
    b.className = "lq"; b.setAttribute("aria-pressed", String(l.id === liq.id));
    /* ① 답 확인 전에는 이름 + 화학식만. 카드에 문헌 끓는점이 적혀 있으면 곡선을 짚을 이유가 없어진다 */
    let sub = l.formula;
    if (answerShown) sub += ` · 문헌 끓는점 ${l.bpLit} ℃`;
    b.innerHTML = `<b>${l.name}</b><span>${sub}</span>`;
    b.onclick = () => { liq = l; buildLiquidPicker(); applyPextMin(); applyLiqSpeed(); resetRun(); info(); };
    host.appendChild(b);
  });
}
function info() {
  /* ⑦ 상세 물성의 마지막 조각(문헌 끓는점)만 답 확인에 종속시킨다.
     앞의 세 줄은 실행 A가 확정한 문구다 — 한 글자도 바꾸지 않는다(금지 3) */
  const bp = gated() ? "" : ` · 문헌 끓는점 ${liq.bpLit} ℃`;
  $("liqInfo").innerHTML =
    `<b>${liq.name}</b> ${liq.formula} · 분자량 ${liq.M} · 밀도 ${liq.rho} g/mL<br>` +
    `분자 사이의 힘: <b>${liq.force}</b><br>` +
    `<span style="color:var(--t3)">모든 분자에 분산력이 작용한다. 셋 중 하나만 작용하는 물질은 없다.</span><br>` +
    `비열 ${liq.c} J/(g·K) · 기화 엔탈피 ${(liq.dHvap * liq.M / 1000).toFixed(1)} kJ/mol${bp}`;
}
/* ============================================================
   단계별 공개 — 지시안 §3 B-2·B-3
   ★ 아래 두 표(STAGE·SHOW)가 유일한 원천이다. 표 밖에서 요소를 숨기지 않는다(F-1).
   ★ 요소는 B1 → B2 → C 로 늘어난다. 없는 요소는 조용히 건너뛴다.
   ============================================================ */
const STAGE = {
  /* ★ 2026-08-25 피드백 반영: 증발 탭이 1단계로 왔다(끓음보다 증발이 먼저 — 학습지 순서).
     옛 1단계(끓음의 조건)는 2단계다. 「액체의 양」은 4단계 그대로. */
  1: { title: "관찰 — 열린 용기와 닫힌 용기, 시간이 지나면 어떻게 될까?",
       desc: "같은 물을 뚜껑 없는 용기와 밀폐한 용기에 담아 나란히 둡니다. 가열하지 않아도 증발은 일어납니다 — 온도를 올려 가며 두 용기의 액체의 양을 먼저 비교하고, 『분자 크기로 확대해 보기』로 분자 화면에서 그 이유를 찾으세요.",
       lock: { liq: "water" } },
  2: { title: "관찰 — 언제 액체 내부에서 기포가 생길까? (+ 온도계)",
       desc: "물을 가열하면서 온도와 포화 증기 압력이 어떻게 변하는지 봅니다. 포화 증기 압력이 외부 압력과 같아지는 순간을 놓치지 마세요.",
       lock: { liq: "water", vol: 100, pext: 1.00, heat: 300, speed: 10 } },
  3: { title: "외부 압력과 가열 출력을 바꾸면 — 끓는점은 어떻게 되는가? (+ 온도계)",
       desc: "같은 물, 같은 양. 외부 압력과 가열 출력을 한 번에 하나씩 바꿔 보세요 — 무엇이 끓는점을 바꾸고, 무엇이 시간만 바꾸는지 갈립니다.",
       lock: { liq: "water", vol: 100, heat: 300, speed: 10 } },
  4: { title: "두 비커를 나란히 — 무엇이 같고 무엇이 다른가? (+ 온도계)",
       desc: "두 비커를 동시에 끓입니다. 먼저 양을 다르게, 다음엔 불의 세기를 다르게 — 무엇이 끓는점을 바꾸고 무엇이 시간만 바꿀까요?",
       lock: { liq: "water", pext: 1.00, heat: 300, speed: 10 } },
  5: { title: "네 액체 — 자유 탐구 (+ 온도계)",
       desc: "네 액체의 곡선입니다. 60 ℃에서의 순서를 먼저 말해 보고, 각 곡선이 760 mmHg와 만나는 점을 찾으세요.",
       lock: {} }
};

/* 노출 표 (B-3) — [1단계, 2단계, 3단계, 4단계, 5단계]
   1 보임 · 0 숨김(display:none) · "A" 「답 확인」 후에만 · null 다른 코드가 판정(◐)
   ★ 2026-08-24 개편: 2단계(닫힌 용기) 열이 새로 끼었다. 옛 2·3·4단계는 지금의 3·4·5단계다.
   ★ 개선 지시(2026-08-24): 3단계에 가열 출력(ctlHeat)을 노출한다 — 외부 압력은 끓는점을
     바꾸고 가열 출력은 시간만 바꾼다는 것을 학생이 직접 갈라 보게 한다. */
const SHOW = {
  /* ★ 2026-08-25: 1열 = 증발 탭, 2열 = 끓음의 조건(옛 1열). 4단계는 온도계 노출 + 2라운드 신설 */
  namebar:      [0, 0, 0, 0, 1],   // ▣ <details> 안 — summary 문구가 지시안에 없어 접기는 보류(보고 ④)
  subLiq:       [0, 0, 0, 0, 1],   // .head .sub 의 "네 액체로 직접 확인해 보자."
  liqpick:      [0, 0, 0, 0, 1],
  glWrap:       [1, 1, 1, 0, 1],   // ZOOMDEP — 확대 중에는 숨는다. 1단계 거시(두 용기)도 이 캔버스다
  zoomWrap:     [null, null, null, null, null],  // ◐ syncMolVis() — 3D 불가일 때의 2D 확대 폴백
  molWrap:      [null, null, null, null, null],  // ◐ syncMolVis() — 1단계 3D + 3D 확대 보기
  zoomCap:      [null, null, null, null, null],  // ◐ syncMolVis() — 3D 확대 캡션(HTML)
  zoomNote:     [0, 1, 1, 0, 1],   // ZOOMDEP — 41·930 캡션
  duoWrap:      [0, 0, 0, 1, 0],   // 실행 C 신설
  duoPreset:    [0, 0, 0, null, 0],// ◐ syncDuoVis() — 1라운드(양)에서만
  gate:         [0, 0, 0, null, 0],// ◐ syncDuoVis() — 1라운드 예측 게이트(C-2)
  gate2:        [0, 0, 0, null, 0],// ◐ syncDuoVis() — 2라운드(열량) 예측 게이트 (2026-08-25 신설)
  round2Btn:    [0, 0, 0, null, 0],// ◐ syncDuoVis() — 1라운드 완료 후에만
  duoRo:        [0, 0, 0, 1, 0],   // 좌/우 readout 한 벌씩(A-8 2번)
  duoConc:      [0, 0, 0, null, 0],// 4단계 결론 — duoConclusion() 이 판정(C-4 · altResult 와 같은 방식)
  sealHead:     [1, 0, 0, 0, 0],   // 1단계 — 열린/닫힌 용기 머리글
  sealRo:       [1, 0, 0, 0, 0],   // 1단계 — 두 용기 측정값
  sealConc:     [null, 0, 0, 0, 0],// 1단계 결론 — sealConclusion() 이 판정(동적 평형 도달 후에만)
  ctlT2:        [1, 0, 0, 0, 0],   // 1단계 — 온도 슬라이더
  ctlSealSpd:   [1, 0, 0, 0, 0],   // 1단계 — 시간 배속 (2026-08-25 피드백)
  speedNote:    [0, 0, 0, 0, null],// 5단계 액체별 권장 배속 안내 — applyLiqSpeed() 가 판정(추정 6)
  thermoWrap:   [0, 1, 1, 1, 1],   // 오른쪽 온도계 — 4단계에서는 「오른쪽 비커」용(2026-08-25)
  thermoWrapL:  [0, 0, 0, 1, 0],   // ★ 왼쪽 온도계 — 4단계 전용(2026-08-25 재작업 지시)
  thermolegend: [null, null, null, null, null],  // drawThermo() 가 마커 노출과 함께 판정(매뉴얼 4부 ⑭)
  glFallback:   [null, null, null, null, null],  // ◐ initGL() 실패 시에만
  roTemp:       [0, 1, 1, 0, 1],   // 4단계는 좌·우 각각(실행 C)
  roTb:         [0, 0, 1, 0, "A"], // 4단계에 있으면 예측 게이트의 정답이 미리 뜬다
  roPv:         [0, 1, 1, 0, 1],
  roPe:         [0, 1, 1, 1, 1],
  roVol:        [0, 1, 1, 0, 1],
  roState:      [0, 1, 1, 0, 1],
  stateNote:    [0, 1, 1, 0, 1],   // 1·4단계는 용기·비커별 라벨이 담당(A-8 5번)
  volNote:      [0, 0, 0, 0, null],// 5단계에서 #sVol 조작 시 4초간(기존 타이머)
  zoomBtn:      [1, 1, 1, 0, 1],   // 1단계도 거시 ↔ 분자 전환(2026-08-24 2차 지시)
  zoomHint:     [0, 1, 1, 0, 1],
  clockWrap:    [0, 1, 1, 0, 1],   // 1단계는 그래프 가로축이, 4단계는 비커별 「끓기 시작한 시각」이 대신한다
  ctlPext:      [0, 0, 1, 0, 1],
  altNote:      [0, 0, 1, 0, 0],   // 높은 산 힌트
  altResult:    [0, 0, null, 0, 0],// 3단계 결론 — readouts() 가 끓기 시작·끓는점 하강을 함께 본다(J-N5)
  ctlVol:       [0, 0, 0, 0, 1],
  ctlHeat:      [0, 0, 1, 0, 1],   // ★ 3단계 노출 신설(2026-08-24 지시)
  ctlSpeed:     [0, 0, 0, 0, 1],
  cardDesign:   [0, 0, 0, 1, 1],
  cardReadout:  [1, 1, 1, 1, 1],
  cardRecord:   [0, 0, 0, 0, 1],
  recBtns:      [0, 0, 0, 0, 1],
  recnote:      [0, 0, 0, 0, 1],
  fixNote:      [0, 0, 0, 0, 1],
  liqInfo:      [0, 0, 0, 0, 1],
  cardChart:    [1, 0, 1, 1, 1],   // 1단계는 증기 압력–시간 곡선을 그린다
  cmodes:       [0, 0, 0, 0, 1],
  vp60line:     [null, null, null, null, null],  // updateVp60Line() 가 판정(곡선 모드 + 5단계 + 답 확인 후)
  answerBtn:    [0, 0, 0, 0, 1],   // 실행 B2 신설
  answerHint:   [0, 0, 0, 0, 1]    // 커서 추적선 사용 안내 — 곡선 전환 버튼과 같은 단계에만
};
/* true = 확대 중일 때만 보인다 / false = 확대 중에는 숨는다 */
const ZOOMDEP = { glWrap: false, zoomNote: true };
/* .is-hidden-A{display:none} 를 인라인으로 이겨야 하는 것들 — 빈 문자열은 클래스를 못 이긴다 */
const BLOCK = { ctlHeat: "block", ctlSpeed: "block" };

const thermoBpShown = () => stage === 5 && answerShown;
const thermoAria = () => stage === 4
  ? "오른쪽 비커의 온도계. 지금 온도를 표시합니다."
  : thermoBpShown()
  ? "온도계. 지금 온도와 네 액체의 끓는점 눈금이 함께 표시됩니다."
  : "온도계. 지금 온도를 표시합니다.";

/* ④ 60 ℃ 값 나열 — display:none 만으로는 개발자도구로 뚫린다.
   답 확인 전에는 **값 계산 자체를 미루고** 요소를 비워 둔다(지시안 B-4 ④ 「값 계산도 미루기」). */
function updateVp60Line() {
  const el = $("vp60line"); if (!el) return;
  const show = chartMode === "vp" && stage === 5 && answerShown;
  el.textContent = show
    ? "60 ℃에서의 포화 증기 압력 — " +
      LIQ.LIST.map(l => `${DISPLAY[l.id].mid} ${vaporP(l, 60).toFixed(0)}`).join(" · ") + " mmHg"
    : "";
  el.style.display = show ? "" : "none";
}

/* 「답 확인」 토글 — 14경로가 전부 이 한 곳에서 갱신된다(F-1).
   교사가 여러 반에서 새로고침 없이 되돌릴 수 있어야 한다(확정). */
function setAnswer(v) {
  answerShown = v;
  const b = $("answerBtn");
  if (b) { b.textContent = answerShown ? "답 숨기기" : "답 확인"; b.setAttribute("aria-pressed", String(answerShown)); }
  buildLiquidPicker();                                   // ①
  info();                                                // ⑦
  renderTable();                                         // ⑨
  updateVp60Line();                                      // ④
  applyShow();                                           // ⑥ readout 째 숨김 · 버튼 노출
  $("thermo").setAttribute("aria-label", thermoAria());  // ⑪
  readouts(); drawChart(); drawThermo();                 // ②③⑤⑫⑬⑭
}

function applyShow() {
  for (const id in SHOW) {
    const el = $(id); if (!el) continue;
    let v = SHOW[id][stage - 1];
    if (v === null) continue;
    if (v === "A") v = answerShown ? 1 : 0;
    if (id in ZOOMDEP) v = (v && (ZOOMDEP[id] ? zoom : !zoom)) ? 1 : 0;
    el.style.display = v ? (BLOCK[id] || "") : "none";
  }
  syncMolVis();
  syncDuoVis();
}

/* 3D 분자 캔버스(#molWrap)·2D 확대 폴백(#zoomWrap)·3D 캡션의 판정 — 한 곳에서만 내린다(F-1).
   확대 보기는 3D(m3d)가 있으면 3D 로, 없으면 기존 2D(drawZoom)로 그린다.
   1단계(증발)는 3D 가 없어도 #molWrap 을 열어 폴백 안내문(#molFallback)을 보인다 —
   측정값·그래프는 그대로 동작한다(매뉴얼 §1-2 폴백 조항). */
function syncMolVis() {
  /* 증발 탭도 확대 토글에 참여한다 — 거시(#glWrap · ZOOMDEP가 끔) ↔ 분자(#molWrap) */
  const zoomOn = zoom && stage !== 4;
  const mw = $("molWrap");
  if (mw) mw.style.display = (zoomOn && (m3d || stage === 1)) ? "" : "none";
  const zw = $("zoomWrap");
  if (zw) zw.style.display = (zoomOn && !m3d && stage !== 1) ? "" : "none";
  const zc = $("zoomCap");
  if (zc) zc.style.display = (zoomOn && m3d) ? "" : "none";
  const mf = $("molFallback");
  if (mf) mf.style.display = (stage === 1 && zoom && !m3d) ? "block" : "none";
}

/* 4단계 2라운드 요소의 판정 — 한 곳에서만 내린다(F-1 · 2026-08-25 신설).
   1라운드 = 액체의 양(프리셋 + 게이트 1), 2라운드 = 가열 출력(게이트 2).
   「다음 탐구」 버튼은 1라운드에서 두 비커가 모두 끓기 시작한 뒤에만 뜬다.
   primary(파란 채움)는 화면에 1개(§7) — 지금 눌러야 할 버튼 하나만 primary 로 옮긴다. */
function syncDuoVis() {
  const on = stage === 4;
  const r1 = on && duo.round === 1, r2 = on && duo.round === 2;
  const done1 = r1 && duo.L && duo.L.boilAt >= 0 && duo.R.boilAt >= 0;
  const p = $("duoPreset"); if (p) p.style.display = r1 ? "" : "none";
  const g1 = $("gate"); if (g1) g1.style.display = r1 ? "" : "none";
  const g2 = $("gate2"); if (g2) g2.style.display = r2 ? "" : "none";
  const rb = $("round2Btn"); if (rb) rb.style.display = done1 ? "" : "none";
  const gs = $("gateStart"), g2s = $("gate2Start");
  if (gs) gs.classList.toggle("primary", r1 && !done1);
  if (rb) rb.classList.toggle("primary", !!done1);
  if (g2s) g2s.classList.toggle("primary", r2 && !duo.started);
}

function setZoom(v) {
  zoom = v;
  $("zoomBtn").textContent = zoom
    ? (stage === 1 ? "← 용기로 돌아가기" : "← 비커로 돌아가기")
    : "분자 크기로 확대해 보기";
  applyShow();
  resize();
}

/* ⑴ lock 적용 — ★ DOM 입력값을 먼저 세운다.
   loop() 는 배속을 매 프레임 #sSpeed 에서 읽고, resetRun() 은 부피를 #sVol 에서 읽는다.
   st 에만 넣으면 고정이 풀린다(지시안 B-2 ⚠). */
function applyLock(n) {
  const lk = STAGE[n].lock;
  if (lk.liq && liq.id !== lk.liq) { liq = byId(lk.liq); buildLiquidPicker(); info(); }
  if (lk.vol != null) { $("sVol").value = String(lk.vol); $("vVol").textContent = String(lk.vol); }
  if (lk.speed != null) { $("sSpeed").value = String(lk.speed); $("vSpeed").textContent = String(lk.speed); }
  if (lk.heat != null) { $("sHeat").value = String(lk.heat); $("vHeat").textContent = String(lk.heat); st.heat = +$("sHeat").value; }
  if (lk.pext != null) { $("sPext").value = lk.pext.toFixed(2); $("vPext").textContent = lk.pext.toFixed(2); st.pext = +$("sPext").value; }
}

function applyStage(n) {
  stage = n;
  answerShown = false;
  zoom = false;
  cursorT = null;
  running = (n === 4) ? false : !REDUCED;     // 4단계는 예측 게이트를 통과해야 시작한다(실행 C)
  $("run").textContent = running ? "일시정지" : "이어서 실험";
  $("zoomBtn").textContent = "분자 크기로 확대해 보기";
  const ab = $("answerBtn");
  if (ab) { ab.textContent = "답 확인"; ab.setAttribute("aria-pressed", "false"); }
  applyLock(n);                                                            // ⑴
  /* answerShown 을 껐으니 답을 품고 있던 것들을 다시 그린다 —
     5단계에서 답을 켠 채 다른 단계로 갔다가 돌아오면 카드·물성·기록표에 답이 남는다 */
  buildLiquidPicker(); info(); renderTable();
  /* 1단계(증발)는 온도계 트랙이 없는 한 칸 배치.
     4단계는 「왼쪽 온도계 | 무대 | 오른쪽 온도계」 세 칸 배치다 (2026-08-25 재작업). */
  $("stageWrap").classList.toggle("stagewrap--duo", n === 1);
  $("stageWrap").classList.toggle("stagewrap--tri", n === 4);
  $("stageTitle").textContent = STAGE[n].title;
  $("designTitle").textContent = n === 4 ? "무엇을 비교할까?" : "실험 설계 — 무엇을 바꿀지 먼저 정한다";
  $("stageDesc").textContent = STAGE[n].desc;                              // ⑶
  $("thermo").setAttribute("aria-label", thermoAria());
  if (n !== 5) chartMode = "heat";            // 곡선 전환 버튼이 없는 단계에서는 가열 곡선만
  document.querySelectorAll(".cmode").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === chartMode)));
  updateVp60Line();
  document.querySelectorAll(".stg").forEach(b =>                           // ⑷
    b.setAttribute("aria-pressed", String(+b.dataset.stage === n)));
  resetRun();                                                              // ⑸
  if (n === 1) resetSealed();                // 1단계는 두 용기를 처음으로 되돌린다
  if (n === 4) { duo.round = 1; resetDuo(); }// 4단계는 1라운드(양)부터 다시
  applyShow();                               // ⑵ — duo.round 확정 뒤에 (syncDuoVis 가 round 를 읽는다)
  /* 매뉴얼 §7 — 화면에 primary(파란 채움) 버튼은 최대 1개.
     4단계의 primary 이동(게이트1→다음 탐구→게이트2)은 syncDuoVis() 가 맡는다 */
  $("run").classList.toggle("primary", n !== 4);
  /* 무대 캔버스의 aria-label — 1단계는 두 용기 그림이므로 설명을 바꾼다(J-N 적용 범위) */
  gcv.setAttribute("aria-label", n === 1
    ? "뚜껑 없는 용기와 밀폐한 용기에 같은 물을 담아 나란히 둔 그림. 시간이 지나면 열린 용기의 물은 줄어들고, 닫힌 용기의 물은 온도를 올려도 거의 그대로입니다."
    : GL_ARIA_DEFAULT);
  applyPextMin();                                                          // ⑹
  readouts(); drawChart(); drawThermo(); resize();                         // ⑺
  if (n === 1) { readoutsSealed(); sealConclusion(); }
  if (n === 4) { readoutsDuo(); duoConclusion(); drawDuo(); }
}
const GL_ARIA_DEFAULT = gcv.getAttribute("aria-label");

document.querySelectorAll(".stg").forEach(b => b.onclick = () => {
  if (b.disabled) return;
  applyStage(+b.dataset.stage);
});

/* ============================================================
   4단계 — 나란히 비교 (실행 C · 지시안 C-1 ~ C-5)
   ★ 여기서만 쓰는 독립 상태 2벌이다. 다른 단계는 전역 st·trace·clock 을 그대로 쓴다.
   ★ heatStep 은 상태를 인자로 받는 순수 함수라 손대지 않고 2벌을 돌린다(지시안 C-1 ⚠).
   ★ loop() 는 3단계에서 전역 heatStep 을 호출하지 않는다 — 보이지 않는 곳에서
     전역 실험이 계속 도는 것을 막는다(A-8 1번 · 매뉴얼 §10).
   ============================================================ */
const duo = {
  preset: 0,                                  // 0 = 20 vs 200, 1 = 50 vs 100
  presets: [[20, 200], [50, 100]],
  /* ★ 프리셋별 소진 역전 (300 W · ×10 · 물, 실측)
     [20, 200] : 20 mL 소진 17.3 실시간초  <  200 mL 끓기 시작 22.3 실시간초 → 역전 발생
                 (확정 20의 「그 자리에 멈춰 끓기 시작 시점의 값을 고정 표시」가 실제로 필요하다)
     [50, 100] : 50 mL 소진 43.2 실시간초  >  100 mL 끓기 시작 11.1 실시간초 → 역전 없음 */
  started: false,                             // 예측 게이트 통과 여부
  /* ★ 2026-08-25 피드백(동료 교사) — 2라운드 탐구.
     1라운드 = 액체의 양(기존), 2라운드 = 가열 출력: 같은 양(100 mL)에 왼쪽 300 W · 오른쪽 600 W.
     「불을 세게 하면 끓는점이 높아질까」를 양-무관성 확인 «다음» 질문으로 잇는다. */
  round: 1,
  HEATS: [300, 600], R2VOL: 100,
  L: null, R: null
};
/* 비커의 표시 온도 — 소진되면 붙잡아 둔 값(확정 20). duoFill·온도계가 같은 판정을 읽는다(F-1) */
const duoTemp = b => (b.done ? b.boilT : b.st.t);
/* 4단계는 STAGE 표가 배속을 ×10 으로 잠그고 #sSpeed 를 감춘다.
   ★ 4단계의 시간 표기(readout「끓기 시작한 시각」· 결론 문구 · 가열 곡선 가로축)는
     전부 이 한 함수를 지난다 — 한 화면 안에서 시간 단위가 어긋나지 않게 하는 단일 원천(F-1). */
const DUO_SPEED = STAGE[4].lock.speed;
const duoTime = s => s / DUO_SPEED;           // 실험 시간(초) → 화면에서 지나간 시간(초)

const duoBeaker = (v, heat) => ({
  st: { t: 20, tRoom: 20, volume: v, pext: STAGE[4].lock.pext,
        heat: heat || STAGE[4].lock.heat, boiling: false },
  trace: [], clock: 0, startVol: v,
  boilAt: -1, boilT: null, boilPv: null,      // 끓기 시작한 순간에 붙잡아 둔다 (확정 20)
  pv60: null, pv80: null,                     // 같은 온도를 지날 때의 포화 증기 압력 (C-4 ⑴)
  done: false
});
function resetDuo() {
  if (duo.round === 2) {
    /* 2라운드 — 같은 양, 다른 열원. 변인 통제: 양·압력·액체는 그대로, 가열 출력만 다르다 */
    duo.L = duoBeaker(duo.R2VOL, duo.HEATS[0]);
    duo.R = duoBeaker(duo.R2VOL, duo.HEATS[1]);
  } else {
    const [a, b] = duo.presets[duo.preset];
    duo.L = duoBeaker(a); duo.R = duoBeaker(b);
  }
  duo.started = false;
  duoSyncControls();
}
function duoSyncControls() {
  const tl = $("dL-Title"), tr = $("dR-Title");
  if (duo.round === 2) {
    if (tl) tl.textContent = `왼쪽 ${duo.R2VOL} mL · ${duo.HEATS[0]} W`;
    if (tr) tr.textContent = `오른쪽 ${duo.R2VOL} mL · ${duo.HEATS[1]} W`;
  } else {
    const [a, b] = duo.presets[duo.preset];
    if (tl) tl.textContent = `왼쪽 ${a} mL`;
    if (tr) tr.textContent = `오른쪽 ${b} mL`;
  }
  /* 프리셋은 시작 전에만 바꿀 수 있다 (C-2) — 「실험 처음부터」가 다시 연다 */
  document.querySelectorAll(".pst").forEach(x => {
    x.setAttribute("aria-pressed", String(+x.dataset.preset === duo.preset));
    x.disabled = duo.started;
  });
  const gs = $("gateStart");
  if (gs) gs.disabled = duo.started;
  const g2s = $("gate2Start");
  if (g2s) g2s.disabled = duo.started;
}

/* 한 비커의 한 걸음. 전역 st 와 완전히 분리돼 있다 */
function stepDuoOne(b, step) {
  if (b.done) return;
  if (b.st.heat > 0 && b.st.volume > 0) b.clock += step;
  const wasBoiling = b.st.boiling;
  heatStep(b.st, liq, step);
  /* ⑴ 같은 온도를 지나는 순간을 붙잡는다 (C-4 ⑴ — 양-무관성의 본체).
     값은 그 온도의 모형값을 읽는다. 표본 시각의 오버슈트가 두 비커에서 다르기 때문이다
     (많은 쪽이 천천히 데워져 한 걸음의 온도 상승 폭이 작다). 도달 「시각」은 서로 다르다. */
  if (b.pv60 === null && b.st.t >= 60) b.pv60 = vaporP(liq, 60);
  if (b.pv80 === null && b.st.t >= 80) b.pv80 = vaporP(liq, 80);
  if (b.st.boiling && !wasBoiling && b.boilAt < 0) {
    b.boilAt = b.clock; b.boilT = b.st.t; b.boilPv = vaporP(liq, b.st.t);
  }
  if (b.trace.length === 0 || b.clock - b.trace[b.trace.length - 1].s > 0.4)
    b.trace.push({ s: b.clock, t: b.st.t, b: b.st.boiling });
  /* 확정 20 — 다 끓으면 그 자리에 멈춘다. heatStep 은 다음 호출에서 온도를 실온으로
     되돌리므로(계산부 97행), 되돌아가기 전에 여기서 잡아 더 이상 전진시키지 않는다.
     heatStep 자체는 고치지 않는다(지시안 C-1 ⚠). */
  if (b.st.volume <= 0) b.done = true;
}
function stepDuo(dt) {
  const step = dt * DUO_SPEED;
  stepDuoOne(duo.L, step);
  stepDuoOne(duo.R, step);
}

/* 좌/우 readout — 매뉴얼 §8. 유효숫자 고정: 온도 1자리 · 압력 0자리 · 부피 0자리 · 시각 0자리 */
function duoFill(side, b) {
  const P = k => $(side + k);
  const held = b.done;                        // 소진된 비커는 붙잡아 둔 값을 계속 보인다 (확정 20)
  const t = duoTemp(b);                       // 온도계와 같은 판정 하나를 읽는다(F-1)
  const pv = held ? b.boilPv : vaporP(liq, b.st.t);
  P("-T").textContent = t == null ? "–" : t.toFixed(1);
  setPress(side + "-Pv", side + "-PvMm", pv);
  P("-Vol").textContent = b.st.volume.toFixed(0);
  P("-BoilAt").textContent = b.boilAt < 0 ? "–" : duoTime(b.boilAt).toFixed(0);
  const ro = P("-roState");
  ro.classList.remove("is-ok", "is-warn");
  let s;
  if (held) { s = "다 끓음 — 붙잡아 둔 값"; ro.classList.add("is-warn"); }
  else if (b.st.boiling) { s = "끓는 중"; ro.classList.add("is-ok"); }
  else if (!duo.started) { s = "시작 전"; }
  else { s = "가열 중"; }
  P("-State").textContent = s;
}
function readoutsDuo() { duoFill("dL", duo.L); duoFill("dR", duo.R); }

/* C-4 결론 — ★ 「같습니다」라고 단정하지 않고 두 값을 나란히 찍는다 (J-N5).
   ⑴ 양-무관성의 증거는 「같은 온도(60 ℃·80 ℃)를 지날 때의 포화 증기 압력 비교」다.
      끓기 시점의 값 비교는 vaporP(liq,Tb) = pext×760 으로 정의상 강제되는 항등식이라
      증거가 되지 않는다(2차 P-검토 A-10).
   ⑵ 는 양쪽이 끓기 시작을 기록한 뒤에만 뜬다.
   ⚠ 「다 없어질 때까지 걸리는 시간」은 결론에 쓰지 않는다 — 프리셋 ①의 200 mL 소진은
      172.8 실시간초라 화면에서 관측되지 않는다. 관측되지 않는 주장을 결론에 쓰지 않는다. */
function duoConclusion() {
  const el = $("duoConc"); if (!el) return;
  const L = duo.L, R = duo.R, out = [];
  if (duo.round === 2) {
    /* 2라운드(가열 출력) 결론 — 관찰이 끝난 값만 말한다(J-N5).
       「높아지지 않았다」는 두 온도가 실제로 같을 때만 쓴다 — 화면 수치가 그 문장의 증거다 */
    if (L.boilT !== null && R.boilT !== null) {
      out.push(`끓기 시작한 온도 — 왼쪽(${duo.HEATS[0]} W) <b>${L.boilT.toFixed(1)} ℃</b> · ` +
        `오른쪽(${duo.HEATS[1]} W) <b>${R.boilT.toFixed(1)} ℃</b>.`);
      if (Math.abs(L.boilT - R.boilT) < 0.05)
        out.push(`불을 두 배로 세게 해도 끓는 온도는 <b>높아지지 않았습니다</b> — 달라진 것은 ` +
          `끓기까지 걸린 <b>시간</b>입니다: 왼쪽 <b>${duoTime(L.boilAt).toFixed(1)}초</b> · ` +
          `오른쪽 <b>${duoTime(R.boilAt).toFixed(1)}초</b> (화면에서 지나간 시간).`);
    }
    el.innerHTML = out.join("<br>");
    el.style.display = (stage === 4 && out.length) ? "" : "none";
    return;
  }
  if (L.pv60 !== null && R.pv60 !== null)
    out.push(`60 ℃를 지날 때 — 왼쪽 <b>${L.pv60.toFixed(0)} mmHg</b> · 오른쪽 <b>${R.pv60.toFixed(0)} mmHg</b>`);
  if (L.pv80 !== null && R.pv80 !== null)
    out.push(`80 ℃를 지날 때 — 왼쪽 <b>${L.pv80.toFixed(0)} mmHg</b> · 오른쪽 <b>${R.pv80.toFixed(0)} mmHg</b>`);
  if (L.boilT !== null && R.boilT !== null) {
    out.push(`두 비커 모두 <b>포화 증기 압력이 외부 압력과 같아지는 순간</b>에 끓기 시작했습니다. ` +
      `그 온도는 왼쪽 <b>${L.boilT.toFixed(1)} ℃</b> · 오른쪽 <b>${R.boilT.toFixed(1)} ℃</b>.`);
    /* ★ S-검토 B-1: 「…시간뿐입니다」는 같은 화면의 「남은 액체 0 mL vs 198 mL」와 어긋난다.
       끓기 시작 온도는 같았고 시간은 달랐다 — 두 사실만 말한다. */
    out.push(`끓기 시작한 <b>온도</b>는 같았고, 끓기까지 걸린 <b>시간</b>은 달랐습니다 — ` +
      `왼쪽 <b>${duoTime(L.boilAt).toFixed(1)}초</b> · 오른쪽 <b>${duoTime(R.boilAt).toFixed(1)}초</b> (화면에서 지나간 시간).`);
  }
  el.innerHTML = out.join("<br>");
  el.style.display = (stage === 4 && out.length) ? "" : "none";
}

/* ── C-3 2D 이중 비커 ──
   WebGL 컨텍스트를 2개 쓰지 않는다. 밝은 무대 안의 2D 캔버스 하나에 비커 2개를 그린다(확정 C-1).
   ★ 액면 높이는 volume / LIQ.VOL.max(=200) 의 **공통 스케일**이다 —
     20 mL 와 200 mL 가 시각적으로 10배 차이 나야 한다. 다르면 매뉴얼 P5 M4(스케일 왜곡). */
const dcv = $("duo"), dctx = dcv ? dcv.getContext("2d") : null;
function drawDuo() {
  if (!dctx || !duo.L || !duo.R) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = dcv.width / dpr, H = dcv.height / dpr;
  if (W < 80 || H < 80) return;   // 매뉴얼 §5 — 숨은 캔버스는 clientWidth 가 0이다
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.fillStyle = C.stageLight; dctx.fillRect(0, 0, W, H);

  /* 비커 아래 라벨 자리 — 「다 끓음」 캡션이 두 줄로 접힐 수 있어야 한다.
     ★ 44 px 로는 둘째 줄이 캔버스 밖으로 잘린다(실측 C2-dryL-1194). */
  const capH = 60;
  const by1 = 16, by0 = H - capH;         // 비커 입구 / 바닥
  const innerH = by0 - by1 - 8;
  const bw = Math.min(W * 0.34, 150);     // 좌우 같은 폭

  const cap = (text, cx, y, maxW) => {
    /* 좁은 폭에서는 「—」에서 접는다. 문구를 줄이지 않고 줄만 나눈다 */
    dctx.textAlign = "center";
    if (dctx.measureText(text).width <= maxW) { dctx.fillText(text, cx, y); return; }
    const i = text.indexOf("— ");
    if (i < 0) { dctx.fillText(text, cx, y); return; }
    dctx.fillText(text.slice(0, i).trim(), cx, y);
    dctx.fillText(text.slice(i + 2), cx, y + 13);
  };

  const one = (b, cx) => {
    const fill = Math.max(0, Math.min(1, b.st.volume / LIQ.VOL.max));   // ★ 공통 스케일
    const top = by0 - innerH * fill;
    // 액체
    if (fill > 0) {
      dctx.fillStyle = liq.colorHex;
      dctx.fillRect(cx - bw / 2 + 2, top, bw - 4, by0 - top);
      dctx.strokeStyle = "rgba(40,45,52,0.45)"; dctx.lineWidth = 1.4;
      dctx.beginPath(); dctx.moveTo(cx - bw / 2 + 2, top); dctx.lineTo(cx + bw / 2 - 2, top); dctx.stroke();
    }
    // 기포 — 정성적 표현(「가정과 한계」 ④)
    if (b.st.boiling && top < by0 - 6) {
      for (let i = 0; i < 7; i++) {
        const seed = ((i * 9301 + 49297) % 233280) / 233280;
        const ph = (b.clock * (0.45 + 0.35 * seed) + seed) % 1;
        const bx = cx - bw * 0.34 + seed * bw * 0.68;
        const byy = by0 - 4 - ph * (by0 - 4 - top);
        const r = 1.8 + 2.4 * seed;
        dctx.beginPath(); dctx.arc(bx, byy, r, 0, 6.2832);
        dctx.fillStyle = "rgba(255,255,255,0.88)"; dctx.fill();
        dctx.strokeStyle = "rgba(40,45,52,0.35)"; dctx.lineWidth = 1; dctx.stroke();
      }
    }
    // 비커 — 옆벽 2개 + 바닥
    dctx.strokeStyle = "rgba(40,45,52,0.55)"; dctx.lineWidth = 2;
    dctx.beginPath();
    dctx.moveTo(cx - bw / 2, by1); dctx.lineTo(cx - bw / 2, by0);
    dctx.lineTo(cx + bw / 2, by0); dctx.lineTo(cx + bw / 2, by1);
    dctx.stroke();
    // 열원 — 바닥에서 붉게 (전역 화면의 가열 장치와 같은 뜻)
    if (b.st.heat > 0 && !b.done) {
      dctx.strokeStyle = C.red; dctx.globalAlpha = 0.55; dctx.lineWidth = 3;
      dctx.beginPath(); dctx.moveTo(cx - bw * 0.42, by0 + 5); dctx.lineTo(cx + bw * 0.42, by0 + 5); dctx.stroke();
      dctx.globalAlpha = 1;
    }
    // 라벨
    dctx.fillStyle = C.ink; dctx.font = "700 13px sans-serif"; dctx.textAlign = "center";
    dctx.fillText(`${b.startVol} mL`, cx, by0 + 20);
    if (b.done) {
      dctx.fillStyle = C.t3; dctx.font = "11px sans-serif";
      cap("다 끓음 — 이 순간의 값을 붙잡아 둡니다", cx, by0 + 36, bw + 24);
    }
    dctx.textAlign = "left";
  };
  one(duo.L, W * 0.27);
  one(duo.R, W * 0.73);
  dctx.textAlign = "left"; dctx.textBaseline = "alphabetic";
}

/* 예측 게이트 — 버튼을 누르기 전에는 실험이 시작되지 않는다.
   선택은 저장하지 않는다(익명·비채점). 고르지 않아도 시작 버튼은 눌린다 —
   버튼을 누르는 행위 자체가 게이트다. 정답은 화면에 쓰지 않는다(실험 결과가 답이다). */
document.querySelectorAll(".gopt").forEach(b => b.onclick = () => {
  document.querySelectorAll(".gopt").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
document.querySelectorAll(".pst").forEach(b => b.onclick = () => {
  if (duo.started) return;
  duo.preset = +b.dataset.preset;
  resetDuo(); readoutsDuo(); duoConclusion(); drawDuo(); drawChart();
});
$("gateStart").onclick = () => {
  duo.started = true;
  running = true;
  $("run").textContent = "일시정지";
  duoSyncControls();
};
/* 2라운드(가열 출력) 게이트 — 1라운드와 같은 방식: 고르지 않아도 시작은 눌리고, 정답은 실험이 말한다 */
document.querySelectorAll(".gopt2").forEach(b => b.onclick = () => {
  document.querySelectorAll(".gopt2").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
$("gate2Start").onclick = () => {
  duo.started = true;
  running = true;
  $("run").textContent = "일시정지";
  duoSyncControls(); syncDuoVis();
};
$("round2Btn").onclick = () => {
  duo.round = 2;
  resetDuo();
  running = false; $("run").textContent = "이어서 실험";
  readoutsDuo(); duoConclusion(); syncDuoVis(); drawDuo(); drawChart(); drawThermo();
};

/* ★ S-검토 A-3: 일시정지 상태에서 압력·출력을 바꾸면 heatStep 이 돌지 않아 st.boiling 이 굳는다.
   그러면 「포화 증기 압력이 외부 압력과 같아졌습니다」가 251 vs 1140 mmHg 위에 뜬다(J-N5).
   조작 즉시 다시 판정한다 — 계산부는 건드리지 않는다. */
/* 2단계 온도 슬라이더 — 모형은 계속 돌면서 새 온도의 포화 증기 압력을 향해 다시 평형을 찾는다
   (동적 평형이 「도달하면 끝」이 아니라 조건 변화에 반응하는 상태임을 보여 준다) */
$("sT2").oninput = e => {
  $("vT2").textContent = e.target.value;
  if (seal.st) { seal.st.T = +e.target.value; readoutsSealed(); sealConclusion(); drawChart(); }
};
/* 증발 탭 시간 배속 (2026-08-25 피드백) — loop 이 매 프레임 .value 를 직접 읽는다(§13-②) */
$("sSealSpd").oninput = e => { $("vSealSpd").textContent = e.target.value; };
function reBoil() {
  st.boiling = st.volume > 0 && st.heat > 0 && st.t >= boilingPoint(liq, st.pext) - 1e-6;
}
$("sPext").oninput = e => { st.pext = +e.target.value; $("vPext").textContent = st.pext.toFixed(2); reBoil(); readouts(); drawChart(); drawThermo(); };
/* ★★ 반박 장치의 인과 근접 보강(3-G-5-③) — #sVol을 조작한 순간 그 값을 무대 바로 아래에 4초간 찍는다 */
let volNoteTimer = null;
$("sVol").oninput = e => {
  const before = st.volume;
  const T = st.t, pvBefore = vaporP(liq, T), tbBefore = boilingPoint(liq, st.pext);
  st.volume = +e.target.value; startVol = st.volume; $("vVol").textContent = st.volume; readouts();
  const pvAfter = vaporP(liq, st.t), tbAfter = boilingPoint(liq, st.pext);
  const note = $("volNote");
  /* 지시안 2-9: <b> 태그를 살리려면 innerHTML 이라야 한다. 값은 전부 코드 계산값이라 외부 입력이 섞이지 않는다 */
  /* ⑧ 끓는점 항만 답 확인에 종속시킨다 — 양-무관성(포화 증기 압력이 그대로다)은 이 장치의 본체이므로 남긴다 */
  const tbTerm = gated() ? "" : ` · 끓는점 ${tbBefore.toFixed(1)} → ${tbAfter.toFixed(1)} ℃`;
  note.innerHTML = `액체의 양 ${before} → ${st.volume} mL · 같은 온도(${T.toFixed(1)} ℃)에서 <b>포화 증기 압력</b> ${pvBefore.toFixed(0)} → ${pvAfter.toFixed(0)} mmHg${tbTerm}`;
  note.style.display = "";
  if (volNoteTimer) clearTimeout(volNoteTimer);
  volNoteTimer = setTimeout(() => { note.style.display = "none"; }, 4000);
};
$("sHeat").oninput = e => { st.heat = +e.target.value; $("vHeat").textContent = st.heat; reBoil(); readouts(); };
/* 실행 B2 승계 — #sSpeed 에 핸들러가 없어 4단계에서 배속을 끌어도 ×N 라벨이 바뀌지 않았다.
   (loop() 이 매 프레임 .value 를 읽으므로 동작 자체는 하고 있었다) */
$("sSpeed").oninput = e => { $("vSpeed").textContent = e.target.value; };
$("run").onclick = () => { running = !running; $("run").textContent = running ? "일시정지" : "이어서 실험"; };
$("reset").onclick = () => {
  /* 1단계(증발)에서는 두 용기를 처음으로(액체 다시 채우기 · 증기 압력 0) */
  if (stage === 1) { resetSealed(); readoutsSealed(); sealConclusion();
                     if (zoom) drawSealed3D(); else drawGLSeal();
                     drawChart(); return; }
  /* 4단계에서는 1라운드(양)부터 다시 — 예측 게이트·프리셋이 도로 열린다 */
  if (stage === 4) { duo.round = 1; resetDuo(); running = false; $("run").textContent = "이어서 실험";
                     readoutsDuo(); duoConclusion(); syncDuoVis(); drawDuo(); drawChart(); drawThermo(); return; }
  resetRun(); readouts(); drawChart(); drawThermo();
};
/* 확대 보기의 노출도 노출 표가 정한다 — 여기서 직접 display 를 쓰지 않는다(F-1) */
$("zoomBtn").onclick = () => setZoom(!zoom);
document.querySelectorAll(".cmode").forEach(b => b.onclick = () => {
  chartMode = b.dataset.mode;
  document.querySelectorAll(".cmode").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  /* ⚠ 무조건 켜지 않는다 — 「답 숨기기」 뒤에 곡선 모드를 다시 눌러도 60 ℃ 정답 줄이
     되살아나면 완료 기준 ⑤가 깨진다(지시안 B-2 ⚠ · sim.js 구판 789행) */
  updateVp60Line();
  drawChart();
});
$("answerBtn").onclick = () => setAnswer(!answerShown);

/* ── 커서 추적 십자선 (지시안 B-5) ──
   확정 10이 「학생이 손으로 짚어 도달」을 요구한다. 설명 문구는 장치가 아니다.
   터치에서도 동작해야 하므로 mousemove 가 아니라 pointermove 를 쓴다.
   화면 좌표 → 온도 되돌리기는 drawChart() 가 적어 둔 vpGeo 하나만 읽는다(F-1). */
function trackCursor(e) {
  if (stage !== 5 || chartMode !== "vp" || !vpGeo) { cursorT = null; return; }
  const r = ccv.getBoundingClientRect();
  if (!r.width) { cursorT = null; return; }
  const x = (e.clientX - r.left) * (vpGeo.W / r.width);          // CSS px → 캔버스 좌표
  const t = vpGeo.x0 + (x - vpGeo.padL) / vpGeo.PL * (vpGeo.x1 - vpGeo.x0);
  cursorT = Math.max(vpGeo.x0, Math.min(vpGeo.x1, t));
  drawChart();
}
const clearCursor = () => { if (cursorT !== null) { cursorT = null; drawChart(); } };
ccv.addEventListener("pointermove", trackCursor);
ccv.addEventListener("pointerdown", trackCursor);
ccv.addEventListener("pointerleave", clearCursor);
ccv.addEventListener("pointercancel", clearCursor);

/* ── 크기 ── */
function fit2d(c, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.style.height = hCss + "px";
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  /* 3단계에서는 #glWrap·#zoomWrap 이 숨어 clientWidth 가 0이다 —
     그러면 무대 높이가 늘 320 기준(256 px)으로 고정돼 넓은 화면에서 비커가 작아진다.
     보이는 캔버스(#duo)의 폭을 마지막 대안으로 함께 읽는다 */
  const w = gcv.clientWidth || zcv.clientWidth || (dcv ? dcv.clientWidth : 0)
    || (mcv ? mcv.clientWidth : 0) || 320;
  const h = Math.max(240, Math.min(380, w * 0.80));
  gcv.style.height = h + "px";
  fit2d(zcv, h);
  fit2d(tcv, h);   // 온도계는 비커 캔버스와 높이를 공유한다(3-B)
  if (tcvL) fit2d(tcvL, h);   // 4단계 왼쪽 온도계도 같은 높이(2026-08-25)
  if (dcv) fit2d(dcv, h);   // 2D 이중 비커도 같은 높이를 쓴다(실행 C)
  if (mcv) mcv.style.height = h + "px";   // 3D 분자 캔버스 — 폭·버퍼는 m3dFlush 가 스스로 맞춘다
  fit2d(ccv, Math.max(220, Math.min(300, (ccv.clientWidth || 300) * 0.42)));
  if (stage === 1) drawGLSeal(); else drawGL();
  drawZoom(); drawChart(); drawThermo(); drawDuo();
  if (m3d && zoom) { if (stage === 1) drawSealed3D(); else drawZoom3D(); }
}

/* ── 루프 ── */
let rafId = null, lastT = 0;
function loop(ts) {
  const dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0;
  lastT = ts;
  /* ★ 1단계(증발) 분기 — 배속은 #sSealSpd 가 정한다(기본 ×1 · 2026-08-25 피드백).
     전역 heatStep 을 호출하지 않는다. 거시(두 용기) ↔ 분자(3D)는 zoom 이 가른다 —
     입자 상태는 화면과 무관하게 계속 돌려 전환 순간에도 이어진 상태가 보인다. */
  if (stage === 1) {
    if (running && seal.st) {
      const sdt = dt * (+$("sSealSpd").value || 1);
      sealedStep(seal.st, liq, sdt);
      sealTrace();
      sealParticles(sdt);
    }
    if (zoom) drawSealed3D(); else drawGLSeal();
    drawChart(); readoutsSealed(); sealConclusion();
    rafId = requestAnimationFrame(loop);
    return;
  }
  /* ★ 4단계 분기 (A-8 1번) — 전역 heatStep 을 호출하지 않는다.
     여기서 return 하지 않으면 보이지 않는 곳에서 전역 실험이 계속 돌고
     #vClock·#rT 가 4단계와 무관하게 전진한다(매뉴얼 §10). */
  if (stage === 4) {
    if (running && duo.started) stepDuo(dt);
    /* 온도계(왼/오 두 액주)와 「다음 탐구」 버튼도 매 프레임 갱신 (2026-08-25) */
    drawDuo(); drawChart(); drawThermo(); readoutsDuo(); duoConclusion(); syncDuoVis();
    rafId = requestAnimationFrame(loop);
    return;
  }
  if (running) {
    const speed = +$("sSpeed").value;
    const step = dt * speed;
    if (st.heat > 0 && st.volume > 0) clock += step;   // 경과 시간 = 가열한 시간
    const wasBoiling = st.boiling;
    heatStep(st, liq, step);
    if (st.boiling && !wasBoiling && boilStartAt < 0) boilStartAt = clock;
    if (trace.length === 0 || clock - trace[trace.length - 1].s > 0.4) {
      trace.push({ s: clock, t: st.t, v: st.volume, b: st.boiling });
      if (trace.length > 3000) trace.shift();
    }
  }
  if (zoom) { if (m3d) drawZoom3D(); else drawZoom(); } else drawGL();
  drawChart(); drawThermo(); readouts();
  $("vClock").textContent = clock.toFixed(0);
  rafId = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = 0; }
  else if (!rafId) rafId = requestAnimationFrame(loop);
});
/* #glWrap은 확대 모드에서 display:none이 되어 관찰이 무의미해지므로 .stagewrap 전체를 관찰한다(3-E) */
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("stageWrap"));
window.addEventListener("resize", resize);
/* prefers-reduced-motion 판정은 applyStage() 한 곳에서만 내린다(REDUCED · 매뉴얼 §10) */

/* 60 ℃ 값 HTML 줄(§3-F ⓐ)은 이제 updateVp60Line() 이 「답 확인」 후에만 채운다(⑭경로 ④).
   출고 시점에 미리 채워 두면 답 확인 전에 DOM 에 값이 남는다 — 그래서 여기서 계산하지 않는다. */

initGL();
initM3D();              // 3D 공-막대 (2단계 · 분자 확대) — 실패하면 m3d = null 로 폴백
buildLiquidPicker(); applyPextMin(); info(); resetRun(); resetDuo(); resetSealed(); readouts();
resize();
applyStage(1);          // 기본 진입 = 1단계
rafId = requestAnimationFrame(loop);
