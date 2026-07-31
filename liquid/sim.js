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
      force: "분산력만 (약한 극성)", colorHex: "#c9d8e8", tint: [0.86, 0.90, 0.95] },
    { id: "ethanol", name: "에탄올", formula: "C₂H₅OH", M: 46.07,
      A: 8.20417, B: 1642.89, C: 230.300, bpLit: 78.4,
      c: 2.44, dHvap: 846, rho: 0.789,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합", colorHex: "#d8e6f2", tint: [0.85, 0.92, 0.99] },
    { id: "water", name: "물", formula: "H₂O", M: 18.015,
      A: 8.07131, B: 1730.63, C: 233.426, bpLit: 100.0,
      c: 4.18, dHvap: 2257, rho: 1.000,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합 (가장 촘촘)", colorHex: "#bfe0f5", tint: [0.72, 0.88, 1.00] },
    { id: "acetic", name: "아세트산", formula: "CH₃COOH", M: 60.05,
      A: 7.38782, B: 1533.313, C: 222.309, bpLit: 118.1,
      /* ⚠ 아세트산의 기화 엔탈피는 자료마다 다르다.
         증기에서 두 분자가 수소 결합으로 **짝(이합체)** 을 이루기 때문에
         클라우지우스–클라페이론 관계가 그대로 성립하지 않는다.
         문헌표는 약 24 kJ/mol, 증기 압력 곡선의 기울기는 약 39 kJ/mol 이다.
         이 화면은 **곡선과 어긋나지 않도록** 곡선에서 얻은 값(646 J/g)을 쓴다.
         이 사정은 활동지 한계 항목에 그대로 적어 두었다. */
      c: 2.05, dHvap: 646, rho: 1.049,
      force: "분산력 + 쌍극자–쌍극자 + 수소 결합 (두 분자가 짝을 이룸)",
      colorHex: "#e6e3cf", tint: [0.95, 0.93, 0.82] }
  ],
  PEXT: { min: 0.20, max: 1.50, step: 0.01 },   // 외부 압력 (atm)
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
  if (mass <= 0.01) { st.t = st.tRoom; return st; }
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
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), ink: CSSV("--t1"),
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
  zctx.fillStyle = C.ink; zctx.font = "600 11.5px sans-serif";
  zctx.textAlign = "right";
  zctx.fillText("분자가 통째로 떠난다 — 분자 안의 결합은 그대로다", W - 8, H - 8);
  zctx.textAlign = "left";
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16 & 255) * f), g = Math.round((n >> 8 & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/* ── 그래프 ── */
const ccv = $("chart"), cctx = ccv.getContext("2d");
let chartMode = "heat";     // heat = 가열 곡선 / vp = 증기 압력 곡선
function drawChart() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = ccv.width / dpr, H = ccv.height / dpr;
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
    cctx.font = "10.5px sans-serif";
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

  if (chartMode === "heat") {
    const tmax = Math.max(60, ...trace.map(p => p.s)) * 1.05;
    const ymax = Math.max(130, ...trace.map(p => p.t)) * 1.1;
    const X = v => pad.l + v / tmax * PL, Y = v => (H - pad.b) - v / ymax * PH;
    frame("시간 (초)", "온도 (℃)");
    grid(0, tmax, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);
    // 끓는점 수평선
    const Tb = boilingPoint(liq, st.pext);
    if (Tb < ymax) {
      cctx.strokeStyle = C.amber; cctx.setLineDash([6, 4]); cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(pad.l, Y(Tb)); cctx.lineTo(W - pad.r, Y(Tb)); cctx.stroke();
      cctx.setLineDash([]);
      cctx.fillStyle = C.amber; cctx.font = "600 10.5px sans-serif";
      cctx.fillText(`끓는점 ${Tb.toFixed(1)} ℃ (외부 ${st.pext.toFixed(2)} atm)`, pad.l + 6, Y(Tb) - 5);
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
      cctx.fillText("가열 출력을 올리고 『실험 시작』을 누르면 곡선이 그려집니다", pad.l + 8, pad.t + 16);
    }
  } else {
    const x0 = -20, x1 = 140, ymax = 1400;
    const X = v => pad.l + (v - x0) / (x1 - x0) * PL, Y = v => (H - pad.b) - v / ymax * PH;
    frame("온도 (℃)", "증기 압력 (mmHg)");
    grid(x0, x1, 0, ymax, v => v.toFixed(0), v => v.toFixed(0), X, Y);
    // 외부 압력 수평선
    const pe = st.pext * 760;
    cctx.strokeStyle = C.ink; cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(pad.l, Y(pe)); cctx.lineTo(W - pad.r, Y(pe)); cctx.stroke();
    cctx.fillStyle = C.ink; cctx.font = "600 10.5px sans-serif";
    cctx.fillText(`외부 압력 ${pe.toFixed(0)} mmHg`, pad.l + 6, Y(pe) - 5);
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
      // 이름을 곡선 옆에 직접
      const tb = boilingPoint(l, 1);
      cctx.fillStyle = sel ? C.blue : C.t3;
      cctx.font = sel ? "700 10.5px sans-serif" : "10px sans-serif";
      const ly = Y(760);
      cctx.save(); cctx.translate(X(tb), ly - 8); cctx.rotate(-0.5);
      cctx.fillText(l.name, 0, 0); cctx.restore();
      // 교점 표시
      const bx = boilingPoint(l, st.pext);
      if (bx > x0 && bx < x1) {
        cctx.fillStyle = sel ? C.blue : "rgba(95,107,122,0.55)";
        cctx.beginPath(); cctx.arc(X(bx), Y(pe), sel ? 5 : 3, 0, 6.2832); cctx.fill();
      }
    });
    cctx.fillStyle = C.t3; cctx.font = "10.5px sans-serif";
    cctx.fillText("● 곡선과 외부 압력선이 만나는 온도 = 그 액체의 끓는점", pad.l + 6, pad.t + 12);
  }
}

/* ── 측정값 ── */
function readouts() {
  const Tb = boilingPoint(liq, st.pext);
  const pv = vaporP(liq, st.t);
  $("rT").textContent = st.t.toFixed(1);
  $("rTb").textContent = Tb.toFixed(1);
  $("rPv").textContent = pv.toFixed(0);
  $("rPe").textContent = (st.pext * 760).toFixed(0);
  $("rVol").textContent = st.volume.toFixed(0);
  const ro = $("roState");
  ro.classList.remove("is-ok", "is-warn");
  if (st.volume <= 0) { $("rState").textContent = "다 끓음"; ro.classList.add("is-warn"); }
  else if (st.boiling) { $("rState").textContent = "끓는 중"; ro.classList.add("is-ok"); }
  else if (st.heat > 0) { $("rState").textContent = "가열 중"; }
  else { $("rState").textContent = "정지"; }
  $("stateNote").innerHTML = st.boiling
    ? "증기 압력이 외부 압력과 <b>같아졌습니다</b> → 액체 <b>속에서도</b> 기화가 일어납니다. 이것이 끓음입니다."
    : `증기 압력 ${pv.toFixed(0)} mmHg &lt; 외부 압력 ${(st.pext * 760).toFixed(0)} mmHg → 아직 표면에서만 증발합니다.`;
}

/* ── 기록 ── */
const HEADERS = ["좌석번호", "액체", "외부 압력(atm)", "액체의 양(mL)", "가열 출력(W)",
  "측정한 끓는점(℃)", "이론 끓는점(℃)", "끓기까지 걸린 시간(초)", "그때의 증기 압력(mmHg)"];
function record() {
  const Tb = boilingPoint(liq, st.pext);
  if (!st.boiling) {
    $("recnote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">아직 끓지 않았습니다. 끓기 시작한 뒤에 기록하세요.</span>';
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
  w.innerHTML = "<table><thead><tr><th>#</th><th>액체</th><th>외부압(atm)</th><th>양(mL)</th>" +
    "<th>출력(W)</th><th>측정 끓는점(℃)</th><th>이론(℃)</th><th>걸린 시간(초)</th></tr></thead><tbody>" +
    rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.liq}</td><td>${r.pext.toFixed(2)}</td>` +
      `<td>${r.vol0}</td><td>${r.heat}</td><td>${r.tb.toFixed(1)}</td><td>${r.tbTheory.toFixed(1)}</td>` +
      `<td>${r.time.toFixed(0)}</td></tr>`).join("") + "</tbody></table>";
}
$("rec").onclick = record;
$("clr").onclick = () => { rows = []; $("recnote").textContent = ""; renderTable(); };
$("csv").onclick = () => {
  if (!rows.length) { $("recnote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">먼저 기록하세요.</span>'; return; }
  const body = rows.map(r => [r.seat, r.liq, r.pext.toFixed(2), r.vol0, r.heat,
    r.tb.toFixed(2), r.tbTheory.toFixed(2), r.time.toFixed(1), r.pv.toFixed(1)]);
  const csv = "﻿" + [HEADERS, ...body].map(a => a.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = (($("seat").value.trim() || "끓음실험").replace(/[\\/:*?"<>|]/g, "")) + "_끓음실험.csv";
  a.click(); URL.revokeObjectURL(a.href);
};

/* ── 컨트롤 ── */
let startVol = 100, boilStartAt = -1;
function resetRun() {
  st.t = st.tRoom; st.volume = +$("sVol").value; st.boiling = false;
  startVol = st.volume; boilStartAt = -1; clock = 0; trace = [];
  $("recnote").textContent = "";
}
function buildLiquidPicker() {
  const host = $("liqpick"); host.innerHTML = "";
  LIQ.LIST.forEach(l => {
    const b = document.createElement("button");
    b.className = "lq"; b.setAttribute("aria-pressed", String(l.id === liq.id));
    b.innerHTML = `<b>${l.name}</b><span>${l.formula} · ${l.bpLit} ℃</span>`;
    b.onclick = () => { liq = l; buildLiquidPicker(); resetRun(); info(); };
    host.appendChild(b);
  });
}
function info() {
  $("liqInfo").innerHTML =
    `<b>${liq.name}</b> ${liq.formula} · 분자량 ${liq.M} · 밀도 ${liq.rho} g/mL<br>` +
    `분자 사이의 힘: <b>${liq.force}</b><br>` +
    `비열 ${liq.c} J/(g·K) · 기화 엔탈피 ${(liq.dHvap * liq.M / 1000).toFixed(1)} kJ/mol · 기준 끓는점 ${liq.bpLit} ℃`;
}
$("sPext").oninput = e => { st.pext = +e.target.value; $("vPext").textContent = st.pext.toFixed(2); readouts(); drawChart(); };
$("sVol").oninput = e => { st.volume = +e.target.value; startVol = st.volume; $("vVol").textContent = st.volume; readouts(); };
$("sHeat").oninput = e => { st.heat = +e.target.value; $("vHeat").textContent = st.heat; };
$("run").onclick = () => { running = !running; $("run").textContent = running ? "일시정지" : "이어서 실험"; };
$("reset").onclick = () => { resetRun(); readouts(); drawChart(); };
$("zoomBtn").onclick = () => {
  zoom = !zoom;
  $("zoomWrap").style.display = zoom ? "" : "none";
  $("glWrap").style.display = zoom ? "none" : "";
  $("zoomBtn").textContent = zoom ? "← 비커로 돌아가기" : "분자 크기로 확대해 보기";
  resize();
};
document.querySelectorAll(".cmode").forEach(b => b.onclick = () => {
  chartMode = b.dataset.mode;
  document.querySelectorAll(".cmode").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  drawChart();
});

/* ── 크기 ── */
function fit2d(c, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.style.height = hCss + "px";
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  const w = gcv.clientWidth || zcv.clientWidth || 320;
  const h = Math.max(240, Math.min(380, w * 0.80));
  gcv.style.height = h + "px";
  fit2d(zcv, h);
  fit2d(ccv, Math.max(220, Math.min(300, (ccv.clientWidth || 300) * 0.42)));
  drawGL(); drawZoom(); drawChart();
}

/* ── 루프 ── */
let rafId = null, lastT = 0;
function loop(ts) {
  const dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0;
  lastT = ts;
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
  drawChart(); readouts();
  $("vClock").textContent = clock.toFixed(0);
  rafId = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = 0; }
  else if (!rafId) rafId = requestAnimationFrame(loop);
});
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("glWrap"));
window.addEventListener("resize", resize);
if (matchMedia("(prefers-reduced-motion:reduce)").matches) { running = false; $("run").textContent = "이어서 실험"; }

initGL();
buildLiquidPicker(); info(); resetRun(); readouts();
resize();
rafId = requestAnimationFrame(loop);
