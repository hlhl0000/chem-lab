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
let stage = 1;                     // 지금 단계 (1~4) — 단일 원천
let answerShown = false;           // 「답 확인」 게이트
let cursorT = null;                // 커서 추적 십자선이 가리키는 온도(℃). null = 화면 밖
/* ★ 답 확인 게이트의 단일 판정 (지시안 B-4 14경로).
   true = 지금 답을 감춰야 한다. 4단계에서만 잠근다 — 1~3단계는 그 단계의 노출 표가 정한다.
   (2단계의 #rTb·가열 곡선 끓는점 레이블은 그 단계의 증거이므로 잠그지 않는다) */
const gated = () => stage === 4 && !answerShown;
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

  float liqTop = y0 + (y1 - y0) * (0.06 + 0.80 * fill);

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
    col = mix(col, vec3(0.97), clamp(v-0.42,0.0,1.0)*m*boilAmt*1.5);
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
  for (const n of ["res", "time", "fill", "boilAmt", "heatAmt", "hotAmt", "tint", "nLiq"])
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
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

/* ── 온도계 (§3-B) — 비커 무대 오른쪽 별도 2D 캔버스.
   WebGL 셰이더 안이 아니라 여기서 그린다(§5 금지10) — 폴백 시에도 계속 그려진다.
   데이터 색 정확히 3색: --d-blue(선택된 액체 마커) · --d-red(액주) · --t1(눈금·비선택 마커). */
const tcv = $("thermo"), tctx = tcv.getContext("2d");
/* 이름 표기 맵 — F-1이 허용한 유일한 예외(LIQ.LIST 순서 고정). 온도계·60 ℃ 줄이 함께 쓴다.
   mid = 중간명(온도계 풀 폭 · vp60line), ab = 1글자 약칭(온도계 좁은 폭) */
const DISPLAY = {
  ether: { mid: "에터", ab: "에" }, ethanol: { mid: "에탄올", ab: "탄" },
  water: { mid: "물", ab: "물" }, acetic: { mid: "아세트산", ab: "산" }
};
function drawThermo() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = tcv.width / dpr, H = tcv.height / dpr;
  if (W < 40 || H < 60) return;   // 매뉴얼 §5 — 숨은/작은 캔버스 방어(arc 반지름 음수 예외 회피)
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

  // 액주 — 구근에서 현재 온도까지 --d-red로 채움. 범위 밖은 양끝에서 자른다
  const tClamped = Math.max(TMIN, Math.min(TMAX, st.t));
  const colY = Y(tClamped);
  tctx.fillStyle = C.red;
  tctx.beginPath(); tctx.arc(tubeX, y0, bulbR - 1, 0, 6.2832); tctx.fill();
  tctx.fillRect(tubeX - tubeW / 2 + 1, colY, tubeW - 2, y0 - colY + bulbR);

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
     노출 표 B-3: 「4액체 끓는점 눈금·레이블」·「#thermolegend」는 1~3단계 —, 4단계는 「답 확인」 후. */
  const showBp = thermoBpShown();
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

  /* ── C-5 3단계 가열 곡선 겹쳐 그리기 ──
     두 실험의 곡선을 한 그래프에. 실선 = 왼쪽(적은 쪽) / 파선 = 오른쪽(많은 쪽) +
     곡선 옆 직접 레이블(매뉴얼 §9 — 색만으로 구분하지 않는다).
     ★ 가로축은 3단계의 다른 시간 표기와 같은 「화면에서 지나간 시간」이다 (duoTime() 하나만 읽는다).
       S-검토 A-2: 1·2·4단계의 같은 축 이름은 「실험 시간」이고 「가정과 한계」 ⑤가 그것을 학생에게
       못 박는다. 3단계만 뜻이 다르므로 축 이름에 그 사실을 적는다. */
  if (stage === 3) {
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
      const anchor = b.trace.find(p => p.b) || b.trace[b.trace.length - 1];
      const lab = `${b.startVol} mL`;
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
       −8 로 두면 먼저 끓는 쪽의 레이블 배경판이 「끓는점 … (외부 1.00 atm)」을 덮는다(실측) */
    one(duo.L, [], C.blue, -24);       // 왼쪽(적은 쪽) 레이블은 곡선 위
    one(duo.R, [5, 4], C.gray, 18);    // 오른쪽(많은 쪽) 레이블은 곡선 아래
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
    if (cursorT != null && stage === 4) {
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
function readouts() {
  const Tb = boilingPoint(liq, st.pext);
  const pv = vaporP(liq, st.t);
  $("rT").textContent = st.t.toFixed(1);
  /* ⑥ 4단계 답 확인 전에는 값 자체를 만들지 않는다. readout 째 숨기는 것은 노출 표(SHOW.roTb)가 한다 */
  $("rTb").textContent = gated() ? "–" : Tb.toFixed(1);
  $("rPv").textContent = pv.toFixed(0);
  $("rPe").textContent = (st.pext * 760).toFixed(0);
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
    : `포화 증기 압력 ${pv.toFixed(0)} mmHg &lt; 외부 압력 ${(st.pext * 760).toFixed(0)} mmHg → 아직 <b>표면에서만</b> 증발합니다.`;
  /* 2단계 결론 — ★ 끓기 시작한 뒤에만, 그리고 화면의 끓는점이 실제로 100 ℃보다 낮을 때만 (J-N5).
     설계안 v2 차시 7 ★ 오개념의 원문 처방이다 — 「빨리 끓는다」로 읽히게 쓰지 않는다. */
  const ar = $("altResult");
  if (ar && stage === 2) {
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
   ⚠ 자유 탐구인 4단계에서만 동작한다 — 1~3단계는 STAGE 표의 lock 이 ×10 으로 잠근다. */
const SPEED_BY_LIQ = { ether: 1, ethanol: 5, water: 10, acetic: 10 };
function applyLiqSpeed() {
  if (stage !== 4) return;
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
  1: { title: "관찰 — 언제 액체 내부에서 기포가 생길까? (+ 온도계)",
       desc: "물을 가열하면서 온도와 포화 증기 압력이 어떻게 변하는지 봅니다. 포화 증기 압력이 외부 압력과 같아지는 순간을 놓치지 마세요.",
       lock: { liq: "water", vol: 100, pext: 1.00, heat: 300, speed: 10 } },
  2: { title: "외부 압력을 바꾸면 — 끓는점은 어떻게 되는가? (+ 온도계)",
       desc: "같은 물, 같은 양, 같은 열원. 외부 압력만 바꿉니다.",
       lock: { liq: "water", vol: 100, heat: 300, speed: 10 } },
  3: { title: "두 비커를 나란히 — 무엇이 같고 무엇이 다른가?",
       desc: "두 비커를 동시에 끓입니다. 무엇이 같고 무엇이 다를까요?",
       lock: { liq: "water", pext: 1.00, heat: 300, speed: 10 } },
  4: { title: "네 액체 — 자유 탐구 (+ 온도계)",
       desc: "네 액체의 곡선입니다. 60 ℃에서의 순서를 먼저 말해 보고, 각 곡선이 760 mmHg와 만나는 점을 찾으세요.",
       lock: {} }
};

/* 노출 표 (B-3) — [1단계, 2단계, 3단계, 4단계]
   1 보임 · 0 숨김(display:none) · "A" 「답 확인」 후에만 · null 다른 코드가 판정(◐) */
const SHOW = {
  namebar:      [0, 0, 0, 1],   // ▣ <details> 안 — summary 문구가 지시안에 없어 접기는 보류(보고 ④)
  subLiq:       [0, 0, 0, 1],   // .head .sub 의 "네 액체로 직접 확인해 보자."
  liqpick:      [0, 0, 0, 1],
  glWrap:       [1, 1, 0, 1],   // ZOOMDEP — 확대 중에는 숨는다
  zoomWrap:     [1, 1, 0, 1],   // ZOOMDEP — 확대 중일 때만 보인다
  zoomNote:     [1, 1, 0, 1],   // ZOOMDEP — 41·930 캡션
  duoWrap:      [0, 0, 1, 0],   // 실행 C 신설
  duoPreset:    [0, 0, 1, 0],   // 양 프리셋 2개 — 시작 전에만 조작 가능(C-2)
  gate:         [0, 0, 1, 0],   // 예측 게이트(C-2)
  duoRo:        [0, 0, 1, 0],   // 좌/우 readout 한 벌씩(A-8 2번)
  duoConc:      [0, 0, null, 0],// 3단계 결론 — duoConclusion() 이 판정(C-4 · altResult 와 같은 방식)
  speedNote:    [0, 0, 0, null],// 4단계 액체별 권장 배속 안내 — applyLiqSpeed() 가 판정(추정 6)
  thermoWrap:   [1, 1, 0, 1],
  thermolegend: [null, null, null, null],  // drawThermo() 가 마커 노출과 함께 판정(매뉴얼 4부 ⑭)
  glFallback:   [null, null, null, null],  // ◐ initGL() 실패 시에만. 3단계는 #glWrap 이 함께 감춘다
  roTemp:       [1, 1, 0, 1],   // 3단계는 좌·우 각각(실행 C)
  roTb:         [0, 1, 0, "A"], // 3단계에 있으면 예측 게이트의 정답이 미리 뜬다
  roPv:         [1, 1, 0, 1],
  roPe:         [1, 1, 1, 1],
  roVol:        [1, 1, 0, 1],
  roState:      [1, 1, 0, 1],
  stateNote:    [1, 1, 0, 1],   // 3단계는 비커별 라벨이 담당(A-8 5번)
  volNote:      [0, 0, 0, null],// 4단계에서 #sVol 조작 시 4초간(기존 타이머)
  zoomBtn:      [1, 1, 0, 1],
  zoomHint:     [1, 1, 0, 1],
  clockWrap:    [1, 1, 0, 1],   // 3단계는 비커별 「끓기 시작한 시각」이 대신한다(A-8 3번)
  ctlPext:      [0, 1, 0, 1],
  altNote:      [0, 1, 0, 0],   // 높은 산 힌트
  altResult:    [0, null, 0, 0],// 2단계 결론 — readouts() 가 끓기 시작·끓는점 하강을 함께 본다(J-N5)
  ctlVol:       [0, 0, 0, 1],
  ctlHeat:      [0, 0, 0, 1],
  ctlSpeed:     [0, 0, 0, 1],
  cardDesign:   [0, 0, 1, 1],
  cardReadout:  [1, 1, 1, 1],
  cardRecord:   [0, 0, 0, 1],
  recBtns:      [0, 0, 0, 1],
  recnote:      [0, 0, 0, 1],
  fixNote:      [0, 0, 0, 1],
  liqInfo:      [0, 0, 0, 1],
  cardChart:    [0, 1, 1, 1],
  cmodes:       [0, 0, 0, 1],
  vp60line:     [null, null, null, null],  // updateVp60Line() 가 판정(곡선 모드 + 4단계 + 답 확인 후)
  answerBtn:    [0, 0, 0, 1],   // 실행 B2 신설
  answerHint:   [0, 0, 0, 1]    // 커서 추적선 사용 안내 — 곡선 전환 버튼과 같은 단계에만
};
/* true = 확대 중일 때만 보인다 / false = 확대 중에는 숨는다 */
const ZOOMDEP = { glWrap: false, zoomWrap: true, zoomNote: true };
/* .is-hidden-A{display:none} 를 인라인으로 이겨야 하는 것들 — 빈 문자열은 클래스를 못 이긴다 */
const BLOCK = { ctlHeat: "block", ctlSpeed: "block" };

const thermoBpShown = () => stage === 4 && answerShown;
const thermoAria = () => thermoBpShown()
  ? "온도계. 지금 온도와 네 액체의 끓는점 눈금이 함께 표시됩니다."
  : "온도계. 지금 온도를 표시합니다.";

/* ④ 60 ℃ 값 나열 — display:none 만으로는 개발자도구로 뚫린다.
   답 확인 전에는 **값 계산 자체를 미루고** 요소를 비워 둔다(지시안 B-4 ④ 「값 계산도 미루기」). */
function updateVp60Line() {
  const el = $("vp60line"); if (!el) return;
  const show = chartMode === "vp" && stage === 4 && answerShown;
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
}

function setZoom(v) {
  zoom = v;
  $("zoomBtn").textContent = zoom ? "← 비커로 돌아가기" : "분자 크기로 확대해 보기";
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
  running = (n === 3) ? false : !REDUCED;     // 3단계는 예측 게이트를 통과해야 시작한다(실행 C)
  $("run").textContent = running ? "일시정지" : "이어서 실험";
  $("zoomBtn").textContent = "분자 크기로 확대해 보기";
  const ab = $("answerBtn");
  if (ab) { ab.textContent = "답 확인"; ab.setAttribute("aria-pressed", "false"); }
  applyLock(n);                                                            // ⑴
  /* answerShown 을 껐으니 답을 품고 있던 것들을 다시 그린다 —
     4단계에서 답을 켠 채 다른 단계로 갔다가 돌아오면 카드·물성·기록표에 답이 남는다 */
  buildLiquidPicker(); info(); renderTable();
  applyShow();                                                             // ⑵
  $("stageWrap").classList.toggle("stagewrap--duo", n === 3);
  $("stageTitle").textContent = STAGE[n].title;
  $("designTitle").textContent = n === 3 ? "무엇을 비교할까?" : "실험 설계 — 무엇을 바꿀지 먼저 정한다";
  $("stageDesc").textContent = STAGE[n].desc;                              // ⑶
  $("thermo").setAttribute("aria-label", thermoAria());
  if (n !== 4) chartMode = "heat";            // 곡선 전환 버튼이 없는 단계에서는 가열 곡선만
  document.querySelectorAll(".cmode").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === chartMode)));
  updateVp60Line();
  document.querySelectorAll(".stg").forEach(b =>                           // ⑷
    b.setAttribute("aria-pressed", String(+b.dataset.stage === n)));
  resetRun();                                                              // ⑸
  if (n === 3) resetDuo();                   // 3단계는 좌/우 비커도 함께 처음으로 되돌린다
  /* 매뉴얼 §7 — 화면에 primary(파란 채움) 버튼은 최대 1개.
     3단계에서는 「예측했습니다 — 시작」이 primary 이고 #run 은 일반 버튼이다 */
  $("run").classList.toggle("primary", n !== 3);
  const gs = $("gateStart");
  if (gs) gs.classList.toggle("primary", n === 3);
  applyPextMin();                                                          // ⑹
  readouts(); drawChart(); drawThermo(); resize();                         // ⑺
  if (n === 3) { readoutsDuo(); duoConclusion(); drawDuo(); }
}

document.querySelectorAll(".stg").forEach(b => b.onclick = () => {
  if (b.disabled) return;
  applyStage(+b.dataset.stage);
});

/* ============================================================
   3단계 — 나란히 비교 (실행 C · 지시안 C-1 ~ C-5)
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
  L: null, R: null
};
/* 3단계는 STAGE 표가 배속을 ×10 으로 잠그고 #sSpeed 를 감춘다.
   ★ 3단계의 시간 표기(readout「끓기 시작한 시각」· 결론 문구 · 가열 곡선 가로축)는
     전부 이 한 함수를 지난다 — 한 화면 안에서 시간 단위가 어긋나지 않게 하는 단일 원천(F-1). */
const DUO_SPEED = STAGE[3].lock.speed;
const duoTime = s => s / DUO_SPEED;           // 실험 시간(초) → 화면에서 지나간 시간(초)

const duoBeaker = v => ({
  st: { t: 20, tRoom: 20, volume: v, pext: STAGE[3].lock.pext, heat: STAGE[3].lock.heat, boiling: false },
  trace: [], clock: 0, startVol: v,
  boilAt: -1, boilT: null, boilPv: null,      // 끓기 시작한 순간에 붙잡아 둔다 (확정 20)
  pv60: null, pv80: null,                     // 같은 온도를 지날 때의 포화 증기 압력 (C-4 ⑴)
  done: false
});
function resetDuo() {
  const [a, b] = duo.presets[duo.preset];
  duo.L = duoBeaker(a); duo.R = duoBeaker(b);
  duo.started = false;
  duoSyncControls();
}
function duoSyncControls() {
  const [a, b] = duo.presets[duo.preset];
  const tl = $("dL-Title"), tr = $("dR-Title");
  if (tl) tl.textContent = `왼쪽 ${a} mL`;
  if (tr) tr.textContent = `오른쪽 ${b} mL`;
  /* 프리셋은 시작 전에만 바꿀 수 있다 (C-2) — 「실험 처음부터」가 다시 연다 */
  document.querySelectorAll(".pst").forEach(x => {
    x.setAttribute("aria-pressed", String(+x.dataset.preset === duo.preset));
    x.disabled = duo.started;
  });
  const gs = $("gateStart");
  if (gs) gs.disabled = duo.started;
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
  const t = held ? b.boilT : b.st.t;
  const pv = held ? b.boilPv : vaporP(liq, b.st.t);
  P("-T").textContent = t == null ? "–" : t.toFixed(1);
  P("-Pv").textContent = pv == null ? "–" : pv.toFixed(0);
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
  el.style.display = (stage === 3 && out.length) ? "" : "none";
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

/* ★ S-검토 A-3: 일시정지 상태에서 압력·출력을 바꾸면 heatStep 이 돌지 않아 st.boiling 이 굳는다.
   그러면 「포화 증기 압력이 외부 압력과 같아졌습니다」가 251 vs 1140 mmHg 위에 뜬다(J-N5).
   조작 즉시 다시 판정한다 — 계산부는 건드리지 않는다. */
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
  /* 3단계에서는 좌/우 비커를 되돌리고 예측 게이트를 다시 연다(프리셋도 다시 고를 수 있다) */
  if (stage === 3) { resetDuo(); running = false; $("run").textContent = "이어서 실험";
                     readoutsDuo(); duoConclusion(); drawDuo(); drawChart(); return; }
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
  if (stage !== 4 || chartMode !== "vp" || !vpGeo) { cursorT = null; return; }
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
  const w = gcv.clientWidth || zcv.clientWidth || (dcv ? dcv.clientWidth : 0) || 320;
  const h = Math.max(240, Math.min(380, w * 0.80));
  gcv.style.height = h + "px";
  fit2d(zcv, h);
  fit2d(tcv, h);   // 온도계는 비커 캔버스와 높이를 공유한다(3-B)
  if (dcv) fit2d(dcv, h);   // 2D 이중 비커도 같은 높이를 쓴다(실행 C)
  fit2d(ccv, Math.max(220, Math.min(300, (ccv.clientWidth || 300) * 0.42)));
  drawGL(); drawZoom(); drawChart(); drawThermo(); drawDuo();
}

/* ── 루프 ── */
let rafId = null, lastT = 0;
function loop(ts) {
  const dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0;
  lastT = ts;
  /* ★ 3단계 분기 (A-8 1번) — 전역 heatStep 을 호출하지 않는다.
     여기서 return 하지 않으면 보이지 않는 곳에서 전역 실험이 계속 돌고
     #vClock·#rT 가 3단계와 무관하게 전진한다(매뉴얼 §10). */
  if (stage === 3) {
    if (running && duo.started) stepDuo(dt);
    drawDuo(); drawChart(); readoutsDuo(); duoConclusion();
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
  if (zoom) drawZoom(); else drawGL();
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
buildLiquidPicker(); applyPextMin(); info(); resetRun(); resetDuo(); readouts();
resize();
applyStage(1);          // 기본 진입 = 1단계
rafId = requestAnimationFrame(loop);
