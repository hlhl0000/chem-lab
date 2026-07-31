"use strict";
/* ================================================================
   고체 — 거시 관찰에서 입자 배열까지 (계산부)

   ★ 이 시뮬레이션이 깨려는 생각
     ① "결정 = 예쁘고 투명한 것"      → 판단 기준은 겉모습이 아니라 **입자 배열**이다.
                                        불투명한 황철석·구리도 결정성 고체다.
     ② "유리는 아주 느린 액체다"      → 상온에서 창유리의 이완 시간은 약 10²³년.
                                        우주 나이(약 10¹⁰년)를 압도적으로 넘는다.
                                        관측 가능한 흐름은 **원리적으로 불가능**하다.
     ③ "이온 결정은 전기가 통한다"    → 고체에서는 이온이 격자에 묶여 있어 통하지 않는다.
                                        융해액·수용액에서만 통한다.
     ④ "분자 결정은 분자 사이가 공유 결합" → 분자 **안**은 공유 결합, 분자 **사이**는 분자 간 힘.

   ⚠ 성취기준 범위
     [12물에01-04] 해설: "결정 구조는 다루지 않고" 이온·공유·금속으로 분류하는 수준.
     → **결합의 종류까지는 본문**, 단위 세포·배위수·격자 상수는 화면에서 「심화(범위 밖)」로
       접어 두고 원하는 학생만 펼치게 한다. 시험 범위가 아님을 화면에 적는다.

   격자 상수는 문헌값이며, 그 값으로 **밀도를 계산해 문헌 밀도와 대조**해 검증했다(t4.js).
   ================================================================ */

const NA = 6.02214076e23;

const MIN = {
  LIST: [
    {
      id: "quartz", name: "석영", formula: "SiO₂", kind: "결정성",
      type: "공유(원자) 결정", bond: "공유 결합", look: "투명~반투명 · 육각기둥",
      mp: 1713, cond: { solid: "통하지 않음", melt: "통하지 않음" },
      density: 2.65, a: 4.913, c: 5.405, cellAtoms: 9, cellMass: 3 * 60.08,   // 삼방정 3 SiO₂/cell
      hex: true,
      note: "규소와 산소가 <b>끝없이 이어진 그물</b>이다. '분자'가 따로 없다. 그래서 녹는점이 아주 높다.",
      color: [0.86, 0.90, 0.93], metal: 0.0, rough: 0.10, opacity: 0.35, shape: "prism"
    },
    {
      id: "halite", name: "암염", formula: "NaCl", kind: "결정성",
      type: "이온 결정", bond: "이온 결합", look: "무색투명 · 정육면체",
      mp: 801, cond: { solid: "통하지 않음 ★", melt: "통함" },
      density: 2.17, a: 5.640, cellAtoms: 8, cellMass: 4 * 58.44,             // 면심 4 NaCl/cell
      note: "Na⁺ 와 Cl⁻ 가 번갈아 놓인다. <b>고체에서는 이온이 격자에 묶여 있어 전기가 통하지 않는다.</b> 녹이거나 물에 녹이면 통한다.",
      color: [0.93, 0.94, 0.96], metal: 0.0, rough: 0.16, opacity: 0.30, shape: "cube"
    },
    {
      id: "pyrite", name: "황철석", formula: "FeS₂", kind: "결정성",
      type: "이온·공유가 섞인 결정 (심화)", bond: "이온성 + 공유성", look: "금속광택 · 불투명 · 정육면체",
      mp: 1188, cond: { solid: "조금 통함(반도체)", melt: "통함" },
      density: 5.01, a: 5.418, cellAtoms: 12, cellMass: 4 * 119.98,
      note: "금빛 금속광택이라 <b>'바보의 금'</b>이라 불린다. <b>불투명한데도 결정성 고체다</b> — 결정인지 아닌지는 겉모습이 정하지 않는다.",
      color: [0.85, 0.72, 0.32], metal: 0.85, rough: 0.20, opacity: 1.0, shape: "cube"
    },
    {
      id: "copper", name: "구리", formula: "Cu", kind: "결정성",
      type: "금속 결정", bond: "금속 결합", look: "붉은 금속광택 · 불투명",
      mp: 1085, cond: { solid: "잘 통함", melt: "잘 통함" },
      density: 8.96, a: 3.615, cellAtoms: 4, cellMass: 4 * 63.55,             // 면심입방 4 Cu/cell
      note: "양이온 사이를 <b>자유 전자</b>가 돌아다닌다. 그래서 <b>고체에서도 액체에서도</b> 전기가 통한다.",
      color: [0.85, 0.48, 0.30], metal: 1.0, rough: 0.28, opacity: 1.0, shape: "blob"
    },
    {
      id: "ice", name: "얼음", formula: "H₂O", kind: "결정성",
      type: "분자 결정", bond: "분자 안 = 공유 결합 / 분자 사이 = 수소 결합",
      look: "무색투명 · 육각형",
      mp: 0, cond: { solid: "통하지 않음", melt: "거의 통하지 않음" },
      density: 0.917, a: 4.52, c: 7.36, cellAtoms: 4, cellMass: 4 * 18.015,   // 육방 Ih 4 H2O/cell
      hex: true,
      note: "<b>분자 안은 공유 결합, 분자 사이는 수소 결합</b>이다. 두 층위를 섞지 말 것. 분자 사이의 힘이 약해 녹는점이 낮다.",
      color: [0.88, 0.94, 0.98], metal: 0.0, rough: 0.08, opacity: 0.28, shape: "prism"
    },
    {
      id: "obsidian", name: "흑요석 (화산 유리)", formula: "주로 SiO₂", kind: "비결정성",
      type: "비결정성 고체", bond: "공유 결합 (그물이 불규칙)", look: "검고 유리질 광택 · 조개껍데기 모양 깨짐",
      mp: null, cond: { solid: "통하지 않음", melt: "통하지 않음" },
      density: 2.4, a: null,
      note: "녹는점이 <b>없다.</b> 대신 온도를 올리면 <b>점차 물러지는 연화 구간</b>이 있다. 유리와 같은 방식의 고체다.",
      color: [0.14, 0.13, 0.16], metal: 0.0, rough: 0.05, opacity: 1.0, shape: "blob"
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
/* 격자가 보이기 시작하는 지점 */
const LATTICE_Z = 62;

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
   화면 좌표(0~1)로 돌려준다. 실제 구조의 **평면 투영**이며 단위 세포가 아니다. */
function makeLattice(m, rnd) {
  const pts = [];
  if (m.kind === "비결정성") {
    /* 비결정성 — 규칙 없는 그물. 최소 간격만 지켜 겹치지 않게 놓는다. */
    const target = 62, minD = 0.085;
    let guard = 0;
    while (pts.length < target && guard++ < 6000) {
      const p = { x: rnd(), y: rnd(), s: rnd() < 0.34 ? 0 : 1 };
      if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > minD)) pts.push(p);
    }
    return { pts, regular: false };
  }
  if (m.id === "halite" || m.id === "pyrite") {
    /* 이온 결정 — 두 이온이 번갈아 놓인 정사각 격자 */
    const n = 8, d = 1 / n;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++)
      pts.push({ x: i * d, y: j * d, s: (i + j) % 2 });
    return { pts, regular: true };
  }
  if (m.id === "copper") {
    /* 금속 결정 — 가장 촘촘하게 쌓은 배열(육방 최밀 충전의 한 층) */
    const n = 8, d = 1 / n;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++)
      pts.push({ x: i * d + (j % 2 ? d / 2 : 0), y: j * d * 0.866, s: 0 });
    /* 화면 밖으로 나간 것은 버린다 — 잘린 입자는 "격자가 깨진 것"처럼 읽힌다 */
    return { pts: pts.filter(p => p.x <= 1.001 && p.y <= 1.001), regular: true };
  }
  /* 석영·얼음 — 육각 그물 (꼭짓점에 중심 원자, 사이에 이어 주는 원자) */
  const n = 5, d = 1 / n;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = i * d + (j % 2 ? d / 2 : 0), y = j * d * 0.866;
    pts.push({ x, y, s: 0 });
    if (i < n) pts.push({ x: x + d / 2, y, s: 1 });
    if (j < n) pts.push({ x: x + (j % 2 ? -d / 4 : d / 4), y: y + d * 0.433, s: 1 });
  }
  /* 화면 밖으로 나간 것은 버린다 — 잘린 입자가 보이면 "격자가 깨진 것"처럼 읽힌다 */
  return { pts: pts.filter(p => p.x >= -0.001 && p.x <= 1.001 && p.y >= -0.001 && p.y <= 1.001), regular: true };
}

/* 규칙성 지표 — 최근접 이웃 거리의 상대 표준편차.
   결정이면 0에 가깝고, 비결정이면 크다. 이 수가 곧 "규칙적인가"의 정량적 답이다. */
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
  green: CSSV("--d-green"), red: CSSV("--d-red")
};
/* ⚠ 아래 두 가지는 토큰으로 바꾸면 안 된다.
   ① 광물의 색은 그 물질의 **실제 겉보기 색**이다 (사이트 테마 색이 아니다).
   ② 원자·이온 색은 CPK 국제 표준을 따른다 (매뉴얼 §4 "값 변경 금지").
      Na #AB5CF2 · Cl #1FF01F · O #FF0D0D · Si (관례) #F0C8A0 · Fe #E06633 · S #FFFF30 · Cu #C88033 */
const CPK = {
  Na: "#AB5CF2", Cl: "#1FF01F", O: "#FF0D0D", Si: "#F0C8A0",
  Fe: "#E06633", S: "#FFFF30", Cu: "#C88033", H: "#FFFFFF", C: "#404040"
};
/* 각 광물의 격자에서 두 자리(s=0, s=1)에 놓이는 입자 */
const SITES = {
  quartz: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }],
  halite: [{ sym: "Na⁺", label: "나트륨 이온 Na⁺", cpk: CPK.Na, r: 0.62 }, { sym: "Cl⁻", label: "염화 이온 Cl⁻", cpk: CPK.Cl, r: 1.0 }],
  pyrite: [{ sym: "Fe", label: "철 Fe", cpk: CPK.Fe, r: 1.0 }, { sym: "S", label: "황 S", cpk: CPK.S, r: 0.80 }],
  copper: [{ sym: "Cu", label: "구리 원자 Cu (양이온 + 자유 전자)", cpk: CPK.Cu, r: 1.0 }],
  ice: [{ sym: "O", label: "산소 O (물 분자의 중심)", cpk: CPK.O, r: 1.0 }, { sym: "H", label: "수소 H", cpk: CPK.H, r: 0.55 }],
  obsidian: [{ sym: "Si", label: "규소 Si", cpk: CPK.Si, r: 1.0 }, { sym: "O", label: "산소 O", cpk: CPK.O, r: 0.72 }]
};

let mineral = MIN.LIST[0];
let zoomV = 0;
let lattice = null;
let picked = -1;
let spin = 0, spinning = true;
let rndSeed = 20260731;
const rnd = () => { rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff; return rndSeed / 0x7fffffff; };

/* ============================================================
   WebGL — 광물 표본 (거시)
   구·정육면체·육각기둥을 광선행진으로 그리고 금속성·거칠기·투명도를 준다.
   ⚠ 실제 광물 사진이 아니라 **재질을 흉내 낸 그림**이다. 활동지에 적어 두었다.
   ============================================================ */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }`;
const FRAG = `precision highp float;
varying vec2 uv;
uniform vec2 res; uniform float time; uniform float spin;
uniform vec3 base; uniform float metal; uniform float rough; uniform float opac;
uniform float shape;   // 0=cube 1=prism 2=blob
uniform float grain;   // 표면 거칠기(광택 반대)

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
float map(vec3 p){
  if (shape < 0.5) return sdBox(p, vec3(0.60));
  if (shape < 1.5) return sdHexPrism(p, vec2(0.52, 0.72));
  return sdBlob(p);
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
    /* 표면 결 — 거칠수록 얼룩덜룩 */
    float g = noise(pp*11.0)*0.62 + noise(pp*29.0)*0.38;
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
  for (const n of ["res", "time", "spin", "base", "metal", "rough", "opac", "shape", "grain"])
    U[n] = gl.getUniformLocation(prog, n);
  return true;
}
function drawGL() {
  if (!gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(gcv.clientWidth * dpr));
  const h = Math.max(1, Math.round((parseFloat(gcv.style.height) || 300) * dpr));
  if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; }
  gl.viewport(0, 0, gcv.width, gcv.height);
  gl.uniform2f(U.res, gcv.width, gcv.height);
  gl.uniform1f(U.time, spin);
  gl.uniform1f(U.spin, spin);
  gl.uniform3f(U.base, mineral.color[0], mineral.color[1], mineral.color[2]);
  gl.uniform1f(U.metal, mineral.metal);
  gl.uniform1f(U.rough, mineral.rough);
  gl.uniform1f(U.opac, mineral.opacity);
  gl.uniform1f(U.shape, mineral.shape === "cube" ? 0 : mineral.shape === "prism" ? 1 : 2);
  gl.uniform1f(U.grain, mineral.kind === "비결정성" ? 0.55 : 0.30);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ── 격자 (2D 캔버스) ── */
const lcv = $("lat"), lctx = lcv.getContext("2d");
let latGeom = [];
function drawLat() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = lcv.width / dpr, H = lcv.height / dpr;
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.fillStyle = C.stageLight; lctx.fillRect(0, 0, W, H);
  if (!lattice) return;
  const M = 26;
  const S = Math.min(W - M * 2, H - M * 2);
  /* 캔버스가 숨어 있거나(display:none) 너무 작으면 그리지 않는다.
     크기가 음수면 반지름이 음수가 되어 arc() 가 예외를 던진다. */
  if (S < 40) { latGeom = []; return; }
  const ox = (W - S) / 2, oy = (H - S) / 2;
  const sites = SITES[mineral.id];
  const rBase = S * (mineral.id === "copper" ? 0.055 : 0.040);

  latGeom = lattice.pts.map(p => ({
    x: ox + p.x * S, y: oy + (1 - p.y) * S,
    r: rBase * sites[Math.min(p.s, sites.length - 1)].r, s: Math.min(p.s, sites.length - 1)
  }));

  /* 결합선 — 가까운 이웃끼리 이어 준다 */
  lctx.strokeStyle = "rgba(40,45,52,0.28)"; lctx.lineWidth = 1.6;
  const near = S * (mineral.kind === "비결정성" ? 0.20 : 0.17);
  for (let i = 0; i < latGeom.length; i++) for (let j = i + 1; j < latGeom.length; j++) {
    const a = latGeom[i], b = latGeom[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < near) { lctx.beginPath(); lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke(); }
  }
  /* 입자 — CPK 색 + 외곽선 (밝은 무대에서 흰 원자가 사라지지 않게, 매뉴얼 §4) */
  latGeom.forEach((g, i) => {
    const s = sites[g.s];
    lctx.fillStyle = s.cpk;
    lctx.strokeStyle = darken(s.cpk, 0.5); lctx.lineWidth = 1;
    lctx.beginPath(); lctx.arc(g.x, g.y, g.r, 0, 6.2832);
    lctx.fill(); lctx.globalAlpha = 0.85; lctx.stroke(); lctx.globalAlpha = 1;
    if (i === picked) {
      lctx.strokeStyle = C.blue; lctx.lineWidth = 3;
      lctx.beginPath(); lctx.arc(g.x, g.y, g.r + 6, 0, 6.2832); lctx.stroke();
    }
  });
  /* 규칙성 안내 */
  lctx.fillStyle = mineral.kind === "결정성" ? C.blue : C.amber;
  lctx.font = "700 12px sans-serif"; lctx.textAlign = "left";
  lctx.fillText(mineral.kind === "결정성"
    ? "규칙적으로 되풀이된다 → 결정성 고체"
    : "되풀이되는 규칙이 없다 → 비결정성 고체", M - 8, 18);
  lctx.fillStyle = C.t3; lctx.font = "10.5px sans-serif"; lctx.textAlign = "right";
  lctx.fillText("입자를 눌러 보세요", W - M + 8, H - 8);
  lctx.textAlign = "left";
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16 & 255) * f)},${Math.round((n >> 8 & 255) * f)},${Math.round((n & 255) * f)})`;
}
lcv.addEventListener("click", ev => {
  const b = lcv.getBoundingClientRect();
  const x = ev.clientX - b.left, y = ev.clientY - b.top;
  let best = -1, bd = 1e9;
  latGeom.forEach((g, i) => { const d = Math.hypot(g.x - x, g.y - y); if (d < g.r + 10 && d < bd) { bd = d; best = i; } });
  picked = best; showPick(); drawLat();
});

function showPick() {
  const host = $("pick");
  if (picked < 0 || !latGeom[picked]) {
    host.innerHTML = `<div class="pickempty">확대한 뒤 <b>입자를 하나 눌러 보세요.</b>
      그 자리에 무엇이 있고, 이웃과 무엇으로 이어져 있는지 나옵니다.</div>`;
    return;
  }
  const s = SITES[mineral.id][latGeom[picked].s];
  host.innerHTML =
    `<div class="pickhead"><span class="dot" style="background:${s.cpk}"></span><b>${s.label}</b></div>` +
    `<table class="picktab"><tbody>` +
    `<tr><th>이 고체의 분류</th><td><b>${mineral.type}</b></td></tr>` +
    `<tr><th>이웃과의 결합</th><td>${mineral.bond}</td></tr>` +
    `<tr><th>고체에서 전기</th><td>${mineral.cond.solid}</td></tr>` +
    `<tr><th>녹였을 때 전기</th><td>${mineral.cond.melt}</td></tr>` +
    `<tr><th>녹는점</th><td>${mineral.mp === null ? "없음 — 점차 물러지는 <b>연화 구간</b>만 있다" : mineral.mp + " ℃"}</td></tr>` +
    `</tbody></table><div class="picknote">${mineral.note}</div>`;
}

/* ── 광물 고르기 ── */
function buildPicker() {
  const host = $("mpick"); host.innerHTML = "";
  MIN.LIST.forEach(m => {
    const b = document.createElement("button");
    b.className = "mp"; b.setAttribute("aria-pressed", String(m.id === mineral.id));
    b.innerHTML = `<b>${m.name}</b><span>${m.formula}</span><em class="${m.kind === "결정성" ? "cry" : "amo"}">${m.kind}</em>`;
    b.onclick = () => { mineral = m; picked = -1; lattice = makeLattice(m, rnd); buildPicker(); info(); showPick(); drawGL(); drawLat(); };
    host.appendChild(b);
  });
}
function info() {
  $("mInfo").innerHTML =
    `<b>${mineral.name}</b> ${mineral.formula} · 겉모습: ${mineral.look} · 밀도 ${mineral.density} g/cm³<br>` +
    `분류: <b>${mineral.type}</b> · ${mineral.mp === null ? "녹는점 없음(연화 구간)" : "녹는점 " + mineral.mp + " ℃"}`;
  const adv = $("adv");
  adv.innerHTML = mineral.a
    ? `격자 상수 <b>a = ${mineral.a} Å</b>${mineral.c ? ` · c = ${mineral.c} Å` : ""} · ` +
      `이 값으로 계산한 밀도 <b>${densityFromCell(mineral).toFixed(2)} g/cm³</b> (문헌 ${mineral.density}) — 계산과 실측이 맞는다.`
    : `비결정성이라 <b>격자 상수가 없다.</b> 되풀이되는 단위가 없기 때문이다.`;
}

/* ── 확대 ── */
function applyZoom() {
  const showLat = zoomV >= LATTICE_Z;
  $("glWrap").style.display = showLat ? "none" : "";
  $("latWrap").style.display = showLat ? "" : "none";
  $("vZoom").textContent = zoomLabel(zoomV);
  $("zoomState").innerHTML = showLat
    ? "지금은 <b>입자 하나하나가 보이는 크기</b>입니다. 배열이 규칙적인지 보세요."
    : (zoomV > 35
      ? "표면의 결이 보이기 시작합니다. 더 확대하면 <b>입자 배열</b>이 나타납니다."
      : "<b>손에 들고 보는 크기</b>입니다. 이 겉모습만으로 결정인지 알 수 있을까요?");
  $("pickCard").style.display = showLat ? "" : "none";
  resize();
}
$("sZoom").oninput = e => { zoomV = +e.target.value; applyZoom(); };
$("spinBtn").onclick = () => { spinning = !spinning; $("spinBtn").textContent = spinning ? "회전 멈추기" : "회전 시키기"; };

/* ── 크기·루프 ── */
function fit2d(c, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.style.height = hCss + "px";
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  const w = (gcv.clientWidth || lcv.clientWidth || 320);
  const h = Math.max(250, Math.min(400, w * 0.78));
  gcv.style.height = h + "px";
  fit2d(lcv, h);
  drawGL(); drawLat();
}
let rafId = null, last = 0;
function loop(ts) {
  const dt = last ? Math.min(0.08, (ts - last) / 1000) : 0; last = ts;
  if (spinning) spin += dt * 0.35;
  if (zoomV < LATTICE_Z) drawGL();
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
buildPicker(); info(); showPick(); applyZoom();
rafId = requestAnimationFrame(loop);
