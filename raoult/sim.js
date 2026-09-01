/* ================================================================
   raoult_core.js — 증기 압력 내림 · 계산부 단일 원천

   ★ 이 파일은 화면과 무관하다. DOM 을 절대 참조하지 않는다.
   ★ raoult/sim.js 의 절단 마커 위쪽이 이 파일과 «문자 단위로» 같아야 한다
     (raoult_check.js 의 동기 검사가 본다).

   설계지시안_증기압력내림_v3.md §2 를 구현한 것이다.
   검산: 검증스크립트/_raoult_mf1_v3.js (14 PASS)
   ================================================================ */

const RAOULT = {
  R: 8.314,
  MMHG_PER_ATM: 760,

  /* 물의 Antoine 상수 (mmHg·℃). liquid/sim.js LIQ.LIST water 와 같은 값이다.
     ⚠ 유효 구간 1~100 ℃. 이 시뮬의 조작 범위(25~60 ℃)는 그 안에 있다. */
  A: 8.07131, B: 1730.63, C: 233.426,
  M_WATER: 18.015,          // g/mol
  M_SUCROSE: 342.30,        // g/mol (자당)
  M_UREA: 60.06,            // g/mol (요소)

  /* ── 조작 범위와 그 물리적 근거 (매뉴얼 §13⑤ · P5 M8) ──────────────
     T   25~60 ℃ : 하한을 «교과서 57쪽 확인 문제의 25 ℃»에 맞춘다. 그 온도에서 ΔP 는
                   2.86개(막대로는 13.5 px)로 읽힌다. 20 ℃ 는 0.9개라 읽히지 않는다.
     X용질 ≤ 0.05 : 로드맵이 실제 수업에서 쓰는 최대 농도. 그 위는 자당 용해도와
                   묽은 용액 가정을 함께 벗어난다.
     cover 0.10~0.75 : f = 1 − cover 이고 t99 = ln100/(KC·f) 이므로 cover 0.75(f 0.25)에서
                   t99 = 14.7 s — 교실에서 기다릴 수 있는 상한.
                   ★ 하한 0.10 은 물리가 아니라 «판별» 때문이다. 막·증발만 모형은 P°·f 를,
                     조성 모형은 P°·X 를 주므로 cover 가 X용질 과 같아지면 두 모형이 «같은 수»를
                     낸다. 탭 3 의 X용질 을 0.05 로 고정하고 cover 를 0.10 이상으로 두어
                     두 값이 절대 겹치지 않게 한다.
     ------------------------------------------------------------------ */
  T: { min: 25, max: 60, step: 1, init: 45 },
  XS: { min: 0, max: 0.05, step: 0.001, init: 0.02 },
  COVER: { min: 0.10, max: 0.75, step: 0.01, init: 0.5 },

  /* 탭 3 에서 쓰는 «고정» 용질 몰분율. 슬라이더로 열지 않는다 (위 ★ 참조) */
  XS_TAB3: 0.05,

  /* 화면 기체 분자 1개가 대표하는 압력. 최고 온도(60 ℃)에서 360개가 되도록 잡았다.
     하한 25 ℃·X용질 0.05 에서 ΔP 는 2.86개다 — 「개수」로는 아슬아슬하나 막대로는 13.5 px 다.
     상한 400개는 매뉴얼 §10 의 교실 기기 성능 예산이다. 여유 40개는 요동 표현용. */
  SCALE: 360 / Math.pow(10, 8.07131 - 1730.63 / (233.426 + 60)),   // ≈ 2.4155 개/mmHg

  /* 응축 1차 상수 (1/s). 순물질 이완 시간 τ = 1/KC = 0.8 s.
     t99 = ln100·τ = 3.7 s — 조작하고 곧바로 결과를 보는 길이다. */
  KC: 1.25,

  /* 동적 평형 판정 밴드 — 목표값의 2 %. liquid/sim.js sealedAtEq 와 같은 기준. */
  EQ_BAND: 0.02,

  /* 「답 확인」 게이트가 풀리기까지 기다리는 추가 시간 (s).
     atEq(2 %) 성립 후 이만큼 더 지나면 cover 상한에서도 1 % 이내가 된다.
     ln2/(KC·0.25) = 2.22 s. */
  SETTLE_S: 2.22
};

/* 순물질의 포화 증기 압력 (mmHg) */
function pPure(t) {
  return Math.pow(10, RAOULT.A - RAOULT.B / (RAOULT.C + t));
}

/* 용매의 몰분율. 물 200 g 기준으로 용질 몰분율에서 되돌린다.
   ⚠ 「물 200 mL」가 아니라 «g»다 — 차시 13이 몰농도(부피)와 몰랄 농도(질량)를
      가르는 차시이므로 이 화면은 부피 단위를 질량처럼 쓰지 않는다. */
function xSolvent(xSolute) {
  return 1 - xSolute;
}

/* 몰랄 농도 (mol/kg) — 물 200 g 기준 */
function molality(xSolute) {
  const nW = 200 / RAOULT.M_WATER;
  const nS = nW * xSolute / (1 - xSolute);
  return nS / 0.200;
}

/* 용질 개수(화면용) — 몰분율에 비례한 정성 배율. 액체 분자 수를 고정하고 그 비율만큼 둔다 */
function soluteCount(xSolute, liquidDots) {
  return Math.round(liquidDots * xSolute / (1 - xSolute));
}

/* ── 세 계수 세트 ────────────────────────────────────────────────────
   model: "comp"  조성 — 증발 ∝ X용매, 응축 ∝ N            (참)
          "film2" 막·양방향 — 증발·응축 «둘 다» f 배        (참)
          "film1" 막·증발만 — 증발만 f 배, 응축은 그대로    (학생이 흔히 갖는 가설)

   ★ 응축 계수의 눈금은 «순물질»(pPure)로만 잡는다. 용액의 증기압으로 잡으면
     종단이 P°·X² 가 되어 라울 법칙이 «틀리게» 떠오른다
     (_to_delete/…/vapor/sim.js 가 실제로 그 결함을 갖고 있다).

   ★ 막이 양방향을 같은 비율로 막는 근거는 «세부 균형»이다 — 탈출을 f 배로 막는
     장벽은 포획도 f 배로 막는다. 평형은 경로가 아니라 상태의 성질이기 때문이다.
     그렇지 않다면 덮은 용기와 안 덮은 용기를 연결해 영구히 증류할 수 있다.
     ⚠ 흔한 오해 — 「덮개가 있으면 응축이 압력에 비례하지 않는다」가 아니다. 세 모형 «전부»
       응축 속도는 기체 분자 수(=압력)에 비례한다. 달라지는 것은 비례 «상수»뿐이다 —
       막·양방향은 증발 쪽과 «같은 f 배»로 함께 줄고, 막·증발만은 응축 쪽이 줄지 않는다.
       (차시 7 liquid/ 가 세운 「응축 속도는 증기 압력에 비례」 틀이 그대로 유지된다.)
   ------------------------------------------------------------------ */
function evapRate(t, xSolute, model, cover) {
  const f = 1 - cover;
  const base = RAOULT.KC * pPure(t) * RAOULT.SCALE;
  return model === "comp" ? base * xSolvent(xSolute) : base * f;
}
function condCoef(model, cover) {
  const f = 1 - cover;
  return model === "film2" ? RAOULT.KC * f : RAOULT.KC;
}

/* 종단(평형) 기체 분자 수. 이 값은 위 두 속도식의 «정상 상태»로 유도된 것이다.
   화면에서는 이 값 주위로 분자가 확률적으로 드나들지만, 판정은 이 값으로 한다. */
function terminalN(t, xSolute, model, cover) {
  return evapRate(t, xSolute, model, cover) / condCoef(model, cover);
}

/* 종단 증기 압력 (mmHg) */
function terminalP(t, xSolute, model, cover) {
  return terminalN(t, xSolute, model, cover) / RAOULT.SCALE;
}

/* 한 걸음 — 지수 해. 오일러 적분(N += (E − k·N)·dt)은 큰 dt 에서 진동한다. */
function stepN(n, t, xSolute, model, cover, dt) {
  const target = terminalN(t, xSolute, model, cover);
  const k = condCoef(model, cover);
  return target + (n - target) * Math.exp(-k * dt);
}

/* 동적 평형 판정 — 카운터·상태 문구·결론이 «이 함수 하나»를 같이 읽는다 */
function atEq(n, t, xSolute, model, cover) {
  const target = terminalN(t, xSolute, model, cover);
  if (target <= 0) return n <= 0;
  return Math.abs(n - target) <= RAOULT.EQ_BAND * target;
}

/* 표시용 — 순물질과 용액의 압력 차 (mmHg) */
function deltaP(t, xSolute) {
  return pPure(t) * xSolute;
}

/* 대기압까지의 배율 — 압력 막대 축이 자동(0~1.2·P°)이므로
   「대기압은 이 화면 축의 몇 배 위인가」를 함께 보인다 */
function atmTimesAbove(t) {
  return RAOULT.MMHG_PER_ATM / (1.2 * pPure(t));
}

/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   검증스크립트/raoult_core.js 와 문자 단위로 같은지 대조한다.
   ★ 이 줄을 지우거나 바꾸지 말 것. 바꾸면 raoult_check.js [G-6] 이 FAIL 한다. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
["--t1","--t2","--t3","--line","--panel","--accent","--d-blue","--d-cyan","--d-red",
 "--d-green","--d-amber","--d-violet","--d-gray","--p-silver","--stage-line"].forEach(k => {
  C[k.slice(2)] = CSSV(k) || "#888";
});
const REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ── 단계 × 요소 가시성의 «단일 원천» (매뉴얼 §13①).
   applyStage() 만 display 를 건드린다. 다른 곳에서 display 를 대입하면 게이팅이 조용히 뚫린다. */
const SHOW = {
  1: { xsCtl:0, coverCtl:0, roDp:0, roX:0, roSurf:0, predictBox:0, modelBox:0, splitBtn:0, skipBtn:0, zoomBtn:1 },
  2: { xsCtl:1, coverCtl:0, roDp:1, roX:1, roSurf:0, predictBox:0, modelBox:0, splitBtn:1, skipBtn:0, zoomBtn:0 },
  3: { xsCtl:0, coverCtl:1, roDp:1, roX:1, roSurf:0, predictBox:1, modelBox:1, splitBtn:0, skipBtn:1, zoomBtn:0 }
};
/* ⚠ 보일 때 쓸 display 값을 «명시»한다. style.display = "" 는 .is-off 같은 클래스 규칙을
   못 이겨서 요소가 숨은 채로 남는다 (매뉴얼 §13④ — 이 시뮬 제작 중 실제로 걸렸다). */
const SHOWVAL = {
  xsCtl: "block", coverCtl: "block", roDp: "block", roX: "block", roSurf: "block",
  predictBox: "block", modelBox: "block",
  splitBtn: "inline-block", skipBtn: "inline-block", zoomBtn: "inline-block"
};
const TITLE = {
  1: "무엇이 이 압력을 만드는가?",
  2: "용질을 넣으면 무엇이 달라지는가?",
  3: "정말 「막아서」 내려가는 것일까?"
};
const DESC = {
  1: "밀폐한 그릇 속 물입니다. 온도를 바꿔 가며, 떠나는 분자 수와 돌아오는 분자 수가 같아지는 순간을 찾아보세요. 「분자 수준으로 확대해 보기」를 누르면 표면에서 무슨 일이 일어나는지 보입니다.",
  2: "왼쪽은 순수한 물, 오른쪽은 비휘발성 용질을 녹인 용액입니다. 용질은 액체 «전체»에 고르게 퍼집니다. 「표면을 확대해 보기」로 액체 속 한 구획과 표면 한 구획의 조성을 각각 세어 비교해 보세요.",
  3: "이 탭은 세 가지 «가정»을 각각 돌려 봅니다. 먼저 예측을 고르면 「덮개가 양쪽을 함께 막는다」부터 돌아갑니다. 그다음 다른 가정도 눌러 보고, 아래 「프로그램 밖의 근거」와 견주어 보세요."
};
const NOTE = {
  1: "<b>증기 압력</b>은 동적 평형에 이르렀을 때 기체가 나타내는 압력입니다. 액체의 양이나 그릇의 부피와는 관계가 없습니다.",
  2: "용질이 있으면 용매는 그 액체를 <b>떠나기 어려워집니다.</b> 붙잡혀서가 아니라, <b>용액 전체에서</b> 용매 분자가 차지하는 비율이 줄었기 때문입니다.<br><span style=\"color:var(--t3)\">(더 정확히는 액체 쪽에 있을 때의 배치 가짓수가 늘어난 것입니다. 왜 그것이 증발을 줄이는지는 Ⅲ단원에서 다룹니다.)</span>",
  3: "<b>차단은 속도를 바꾸고, 평형을 바꾸지 않습니다.</b> 덮개를 많이 씌울수록 평형에 이르는 데 <b>오래 걸리지만</b>, 도달한 뒤의 압력은 같습니다."
};
const SIDE = {
  1: "온도를 올리면 떠나는 분자가 늘고, 그만큼 돌아오는 분자도 늘어 더 높은 압력에서 다시 평형이 됩니다.",
  2: "용질의 몰분율을 올려 가며 두 막대의 차이(ΔP)가 어떻게 변하는지 보세요.",
  3: "덮은 넓이를 바꿔 보세요. 어떤 가정에서는 평형값이 바뀌고, 어떤 가정에서는 바뀌지 않습니다."
};

/* ── 상태 ─────────────────────────────────────────────────────── */
const st = {
  stage: 1,
  t: RAOULT.T.init,
  xs: RAOULT.XS.init,
  cover: RAOULT.COVER.init,
  model: "film2",
  predicted: null,        // 탭 3 예측 게이트 — null 이면 결과를 그리지 않는다
  running: false,         // 첫 진입은 «일시정지» (매뉴얼 §10)
  zoom: false,            // 탭 1 분자 확대
  split: false,           // 탭 2 전체+표면 분할
  nPure: 0,               // 순물질 쪽 기체 분자 수 (결정론)
  nSol: 0,                // 용액(또는 탭 3의 현재 가정) 쪽 기체 분자 수
  eqSince: null,          // 평형 밴드에 들어온 시각 (s)
  clock: 0,
  diffuse: 0,             // 탭 2 용질 확산 진행도 0~1
  sampA: 0, sampB: 0, sampPer: 40,  // 탭 2 분할에서 «따로» 센 두 구획의 용질 개수(이번 뽑기)
  cumA: 0, cumB: 0, cumN: 0, cumSeed: -1  // 누적 — 한 번만 뽑으면 요동이 신호보다 크다
};

/* 탭 3에서 「지금 무엇을 재고 있는가」 — 모형에 따라 계산부의 어느 세트를 쓰는지 */
function activeModel() { return st.stage === 3 ? st.model : "comp"; }
function activeCover() { return st.stage === 3 ? st.cover : 0; }
/* 탭 3 은 X용질 을 «고정»한다. 슬라이더로 열어 두면 덮인 넓이와 같아지는 순간
   막·증발만(P°·f)과 조성(P°·X)이 «비트 단위로 같은 수»를 내어 두 모형을 가릴 수 없다. */
function activeXs()    { return st.stage === 1 ? 0 : st.stage === 3 ? RAOULT.XS_TAB3 : st.xs; }

/* 탭 3의 결과를 감추는 게이트 (매뉴얼 §13③ — 그리는 코드 자체를 건너뛴다) */
function gated() { return st.stage === 3 && st.predicted === null; }

/* ── 압력 표기 단일 원천 (매뉴얼 §14④) ───────────────────────── */
/* ★ 자릿수가 아니라 «유효숫자»로 고정한다. Antoine 이 문헌 대비 0.24~0.31 % 어긋나므로
   60 ℃ 에서 「149.0」으로 쓰면 0.03 % 정밀도를 주장하게 되어 모형보다 7배 정밀하다
   (매뉴얼 P5 M7 정밀도 과장). 3자리면 상대 정밀도가 모형 오차와 같은 자릿수가 된다. */
function sig3(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
function fmtP(mmHg) { return sig3(mmHg); }
function fmtDp(mmHg) { return sig3(mmHg); }
/* atm 우선 병기 — 차시 7 liquid/ 와 교과서 57쪽이 모두 atm 을 앞에 쓴다 (매뉴얼 §14④) */
function setPress(mmHg) { return (mmHg / RAOULT.MMHG_PER_ATM).toFixed(3) + " atm (" + sig3(mmHg) + " mmHg)"; }

/* ── WebGL 비커 — liquid/sim.js 의 FRAG 를 이식하고 uniform 두 개를 더했다 ── */
const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const FRAG = `precision highp float;
varying vec2 uv;
uniform vec2 res;
uniform float time;
uniform float fill;
uniform vec3  tint;
uniform float nLiq;
uniform float lid;
uniform float mist;
uniform float solute;   // 신설 — 용액의 짙기 0~1 (용질이 «전체»에 퍼져 있음을 색으로)
uniform float cover;    // 신설 — 액면 덮개층 두께 0~1 (탭 3 「막」 가정에서만)

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
vec3 backdrop(vec2 q){
  vec3 wall = mix(vec3(0.985,0.988,0.992), vec3(0.90,0.92,0.945), clamp(q.y*1.1-0.05,0.0,1.0));
  float st1 = smoothstep(0.33,0.47,abs(fract(q.x*11.0)-0.5));
  wall = mix(wall, vec3(0.46,0.57,0.71), st1*0.30);
  float rule = smoothstep(0.03,0.0,abs(fract(q.y*9.0)-0.5)-0.47);
  wall = mix(wall, vec3(0.62,0.66,0.72), rule*0.16);
  float bench = smoothstep(0.19,0.05,q.y);
  wall = mix(wall, vec3(0.84,0.81,0.76), bench*0.85);
  return wall;
}
void main(){
  vec2 asp = vec2(res.x/res.y, 1.0);
  vec2 q = (uv - 0.5) * vec2(asp.x, 1.0) * 2.0;
  vec3 col = backdrop(q*0.5+0.5);

  float R = 0.52, y0 = -0.80, y1 = 0.72;
  float u = q.x / R;
  bool inCyl = abs(u) < 1.0 && q.y > y0 && q.y < y1;
  float liqTop = y0 + (y1 - y0) * (0.06 + 0.80 * fill);

  if (inCyl) {
    float shell = sqrt(max(0.0, 1.0 - u*u));
    float men = 0.030 * pow(abs(u), 3.0);
    bool inLiquid = q.y < (liqTop + men);

    float n = inLiquid ? nLiq : 1.05;
    float ti = asin(clamp(abs(u),0.0,0.999));
    float tt = asin(clamp(abs(u)/n,0.0,0.999));
    float D  = 2.0*(ti-tt);
    float off = tan(D) * 1.35 * sign(u);
    vec2 sq = vec2(q.x - off, q.y);
    vec3 through = backdrop(sq*0.5+0.5);

    if (inLiquid) {
      float thick = shell * 1.5 + (liqTop - q.y)*0.25;
      vec3 liqTint = mix(tint, vec3(0.80,0.74,0.90), solute*0.85);
      through *= mix(vec3(1.0), liqTint, clamp(thick*0.72,0.0,0.90));
      col = through;
      float surf = smoothstep(0.016,0.0,abs(q.y-(liqTop+men)));
      col = mix(col, vec3(1.0), surf*0.55);
    } else {
      col = mix(col, through, 0.55);
    }

    float fres = pow(abs(u), 4.0);
    col = mix(col, vec3(0.42,0.50,0.60), fres*0.55);
    float hl = smoothstep(0.085,0.0,abs(u+0.60)) * smoothstep(y1+0.02,y0,q.y);
    col = mix(col, vec3(1.0), hl*0.70);
    float hl2 = smoothstep(0.045,0.0,abs(u-0.74)) * smoothstep(y1,y0,q.y);
    col = mix(col, vec3(1.0), hl2*0.35);
    float wall = smoothstep(0.955,1.0,abs(u));
    col = mix(col, vec3(0.40,0.47,0.56), wall*0.85);

    /* 덮개층 — 액면 바로 위에 얇은 판. cover 가 0 이면 아무것도 그리지 않는다 */
    if (cover > 0.001) {
      float band = smoothstep(0.030*cover,0.0,abs(q.y-(liqTop+men+0.018)));
      col = mix(col, vec3(0.55,0.50,0.42), band*0.92*cover);
    }
  }

  float rimTop = smoothstep(0.012,0.0,abs(q.y-y1)) * step(abs(u),1.06);
  col = mix(col, vec3(0.62,0.68,0.76), rimTop*0.9);
  float base = smoothstep(0.016,0.0,abs(q.y-y0)) * step(abs(u),1.12);
  col = mix(col, vec3(0.55,0.60,0.68), base*0.9);

  if (q.y > liqTop && abs(q.x) < R*1.5 && mist > 0.001) {
    float v = noise(vec2(q.x*3.0, q.y*2.2 - time*0.55));
    float m = smoothstep(0.0,0.35,q.y-liqTop) * smoothstep(1.0,0.25,q.y-liqTop);
    col = mix(col, vec3(0.97), clamp(v-0.42,0.0,1.0)*m*mist);
  }

  if (lid > 0.5) {
    float plate = step(abs(q.x), R*1.18) * step(y1, q.y) * step(q.y, y1+0.055);
    col = mix(col, vec3(0.42,0.47,0.55), plate*0.92);
    float knob = step(abs(q.x), 0.09) * step(y1+0.055, q.y) * step(q.y, y1+0.135);
    col = mix(col, vec3(0.36,0.41,0.48), knob*0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const gcv = $("gl"), zcv = $("zoom"), gaugeCv = $("gauge");
let gl = null, prog = null, U = {}, glOK = false;

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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ["res","time","fill","tint","nLiq","lid","mist","solute","cover"])
    U[n] = gl.getUniformLocation(prog, n);
  return true;
}

function sizeCanvas(cv, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = hCss + "px";
  const w = Math.max(1, Math.round(cv.clientWidth * dpr));
  const h = Math.max(1, Math.round(hCss * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return dpr;
}

/* ⚠ 새 uniform 은 «모든» 호출부에서 명시로 준다 — 안 주면 이전 프레임 값이 남아 화면이 오염된다 */
function setBeakerUniforms(soluteAmt, coverAmt) {
  gl.uniform1f(U.time, st.clock);
  gl.uniform1f(U.fill, 0.62);               // 액면은 «고정»이다 (§2 — 증발로 줄어드는 양은 0.01 % 수준)
  gl.uniform3f(U.tint, 0.72, 0.88, 1.00);
  gl.uniform1f(U.nLiq, 1.333);
  gl.uniform1f(U.lid, 1.0);                 // 이 시뮬은 늘 밀폐다
  gl.uniform1f(U.mist, 0.0);
  gl.uniform1f(U.solute, soluteAmt);
  gl.uniform1f(U.cover, coverAmt);
}

function drawGL() {
  if (!glOK) return;
  sizeCanvas(gcv, 330);
  const W = gcv.width, H = gcv.height;
  gl.enable(gl.SCISSOR_TEST);
  if (st.stage === 2) {
    const half = Math.floor(W / 2);
    gl.viewport(0, 0, half, H); gl.scissor(0, 0, half, H);
    gl.uniform2f(U.res, half, H); setBeakerUniforms(0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.viewport(half, 0, W - half, H); gl.scissor(half, 0, W - half, H);
    gl.uniform2f(U.res, W - half, H); setBeakerUniforms(st.diffuse * st.xs / RAOULT.XS.max, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else {
    gl.viewport(0, 0, W, H); gl.scissor(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
    const showCover = st.stage === 3 && !gated() && st.model !== "comp" ? st.cover : 0;
    setBeakerUniforms(st.stage === 3 ? st.xs / RAOULT.XS.max : 0, showCover);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  gl.disable(gl.SCISSOR_TEST);
}

/* ── 기체 분자 (화면용) ────────────────────────────────────────
   개수는 계산부의 종단값을 향해 결정론적으로 가고, «자리»만 확률적으로 흩뿌린다.
   평형에 닿은 뒤에도 교환 사건을 계속 일으킨다 (매뉴얼 §14③-2 — 정지 = 평형 오독 방지). */
const gasP = [], gasS = [];
function syncGas(arr, want) {
  want = Math.max(0, Math.round(want));
  while (arr.length < want) arr.push({ x: Math.random(), y: Math.random(), a: 0 });
  while (arr.length > want) arr.splice(Math.floor(Math.random() * arr.length), 1);
  for (const g of arr) { g.a = Math.min(1, g.a + 0.08); }
}
let swapTimer = 0;
function exchangeTick(dt) {
  swapTimer += dt;
  if (swapTimer < 0.35) return;
  swapTimer = 0;
  for (const arr of [gasP, gasS]) {
    if (arr.length > 2) {
      arr.splice(Math.floor(Math.random() * arr.length), 1);
      arr.push({ x: Math.random(), y: Math.random(), a: 0 });
    }
  }
}

/* ── 2D 분자 확대 화면 ───────────────────────────────────────── */
function drawZoom() {
  const dpr = sizeCanvas(zcv, 330);
  const g = zcv.getContext("2d");
  const W = zcv.width, H = zcv.height;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = W / dpr, h = H / dpr;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);

  if (st.stage === 2 && st.split) { drawSplit(g, w, h); return; }

  const surfY = h * 0.55;
  /* 기체 영역 */
  g.fillStyle = "rgba(148,163,184,0.10)"; g.fillRect(0, 0, w, surfY);
  /* 액체 영역 */
  g.fillStyle = "rgba(59,130,246,0.13)"; g.fillRect(0, surfY, w, h - surfY);
  g.strokeStyle = C["stage-line"]; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, surfY); g.lineTo(w, surfY); g.stroke();

  g.fillStyle = C.t3; g.font = "12px system-ui,sans-serif";
  g.fillText("기체", 10, 18); g.fillText("액체", 10, surfY + 18);

  /* 액체 속 물 분자 — 격자 + 흔들림 */
  const cols = 16, rows = 4, r = Math.min(w / cols, (h - surfY) / rows) * 0.30;
  const xsNow = activeXs();
  let sIdx = new Set();
  const total = cols * rows;
  const nSolute = Math.round(total * xsNow / (1 - xsNow));
  for (let i = 0; i < nSolute; i++) sIdx.add((i * 7 + 3) % total);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const idx = j * cols + i;
    const jitter = REDUCED ? 0 : Math.sin(st.clock * 1.3 + idx) * 2.2;
    const x = (i + 0.5) * w / cols + jitter;
    const y = surfY + (j + 0.6) * (h - surfY) / rows + jitter * 0.5;
    if (sIdx.has(idx)) { g.fillStyle = C["d-violet"]; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill(); }
    else { g.fillStyle = C["d-blue"]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }
  /* 덮개층 (탭 3 막 가정) */
  if (st.stage === 3 && !gated() && st.model !== "comp" && st.cover > 0.001) {
    g.fillStyle = "rgba(120,105,80,0.75)";
    g.fillRect(0, surfY - 7, w * st.cover, 7);
    g.fillStyle = C.t2; g.font = "11px system-ui,sans-serif";
    g.fillText("덮개 " + Math.round(st.cover * 100) + " %", 8, surfY - 11);
  }
  /* 기체 분자 */
  const arr = st.stage === 1 ? gasP : gasS;
  g.fillStyle = C["d-cyan"];
  for (const p of arr) {
    const x = p.x * w, y = p.y * surfY * 0.92 + 6;
    g.globalAlpha = 0.35 + 0.55 * p.a;
    g.beginPath(); g.arc(x, y, r * 0.85, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

/* 탭 2 — 「액체 속 한 구획」과 「표면 한 구획」을 나란히 세어 보인다.
   주장 명제는 «표면의 조성 = 전체의 조성» 하나뿐이다. */
function drawSplit(g, w, h) {
  const pad = 10, boxW = (w - pad * 3) / 2, boxH = h - 56;
  const xsNow = st.xs;
  const per = 40;                                   // 구획마다 세는 분자 수
  /* ★ 두 구획을 «따로» 표집한다. 같은 수를 두 상자에 그대로 찍으면 「달랐을 수도 있었는가」의
     답이 아니오가 되어, 결론이 증거가 아니라 동어반복이 된다(매뉴얼 4부 ㉕).
     시각(seed)은 clock 을 느리게 끊어 쓰되 화면이 깜빡이지 않게 2 s 단위로 고정한다. */
  const pTrue = xsNow / (1 - xsNow) * per / (per + xsNow / (1 - xsNow) * per);
  const seedBase = Math.floor(st.clock / 2);
  const sample = k => {
    let n = 0;
    for (let i = 0; i < per; i++) {
      const r = Math.abs(Math.sin((seedBase * 97 + k * 131 + i * 17) * 12.9898) * 43758.5453) % 1;
      if (r < pTrue) n++;
    }
    return n;
  };
  const nSa = sample(0), nSb = sample(1);
  const nS = nSa;
  st.sampA = nSa; st.sampB = nSb; st.sampPer = per;
  /* ★ 한 번 뽑은 값만 보이면 요동이 신호보다 크다 — X용질 0.02 에서 40개 표본의 기댓값은
     0.8개라 「표면 0 %」가 예사로 나온다. 그래서 뽑을 때마다 «누적»해 평균이 조성으로
     수렴하는 것을 보인다. 두 구획이 «같은 조성의 같은 모집단»임을 이 수렴이 보인다. */
  if (seedBase !== st.cumSeed) {
    st.cumSeed = seedBase;
    st.cumA += nSa; st.cumB += nSb; st.cumN += per;
  }
  const boxes = [
    { x: pad, label: "액체 속 한 구획", sub: "속에서 아무 데나" },
    { x: pad * 2 + boxW, label: "표면 한 구획", sub: "액체와 기체가 맞닿은 곳" }
  ];
  boxes.forEach((b, bi) => {
    g.strokeStyle = C.line; g.lineWidth = 1.4;
    g.fillStyle = "rgba(59,130,246,0.10)";
    g.fillRect(b.x, 40, boxW, boxH); g.strokeRect(b.x, 40, boxW, boxH);
    g.fillStyle = C.t1; g.font = "600 13px system-ui,sans-serif";
    g.fillText(b.label, b.x, 22);
    g.fillStyle = C.t3; g.font = "11px system-ui,sans-serif";
    g.fillText(b.sub, b.x, 35);
    const cols = 8, rows = 5, cw = boxW / cols, ch = boxH / rows, r = Math.min(cw, ch) * 0.26;
    const mark = new Set();
    const nThis = bi === 0 ? nSa : nSb;
    for (let i = 0; i < nThis; i++) mark.add((i * 7 + 3 + bi * 11) % (cols * rows));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      const x = b.x + (i + 0.5) * cw, y = 40 + (j + 0.5) * ch;
      if (mark.has(idx)) { g.fillStyle = C["d-violet"]; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill(); }
      else { g.fillStyle = C["d-blue"]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }
  });
  g.fillStyle = C.t2; g.font = "600 12px system-ui,sans-serif";
  const ca = st.cumN ? (st.cumA / st.cumN * 100).toFixed(1) : "0.0";
  const cb = st.cumN ? (st.cumB / st.cumN * 100).toFixed(1) : "0.0";
  g.fillText("이번 뽑기 " + nSa + " : " + nSb + "   ·   " + Math.round(st.cumN / per) +
    "번 누적 — 액체 속 " + ca + " %, 표면 " + cb + " %", pad, h - 22);
  g.fillStyle = C.t3; g.font = "11px system-ui,sans-serif";
  g.fillText("뽑을 때마다 다르지만 어느 쪽으로도 치우치지 않는다", pad, h - 7);
}

/* ── 압력 막대 (메인이 직접 그린다) ─────────────────────────────
   축은 0 ~ 1.2·P°(T) 로 «자동»이다. 고정 0~800 이면 ΔP 가 1 px 미만이 되어 읽히지 않는다.
   대기압은 축 밖이므로 수치와 「몇 배 위」 표기로 늘 보인다. */
const PLOT_H = 324;
function drawGauge() {
  const dpr = sizeCanvas(gaugeCv, PLOT_H + 46);
  const g = gaugeCv.getContext("2d");
  const W = gaugeCv.width / dpr, H = gaugeCv.height / dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);

  const top = 26, bottom = top + PLOT_H;
  const P0 = pPure(st.t), axisMax = 1.2 * P0;
  const yFor = v => bottom - Math.max(0, Math.min(v, axisMax)) / axisMax * PLOT_H;

  /* 눈금 */
  g.strokeStyle = C.line; g.lineWidth = 1; g.fillStyle = C.t3;
  g.font = "10.5px system-ui,sans-serif";
  const stepT = axisMax > 120 ? 40 : axisMax > 60 ? 20 : 10;
  for (let v = 0; v <= axisMax; v += stepT) {
    const y = yFor(v);
    g.beginPath(); g.moveTo(34, y); g.lineTo(W - 6, y); g.stroke();
    g.fillText(String(v), 6, y + 3.5);
  }
  g.fillStyle = C.t3; g.fillText("mmHg", 6, top - 12);

  if (gated()) {
    g.fillStyle = C.t3; g.font = "12px system-ui,sans-serif";
    g.fillText("예측을 고르면", 44, top + 130);
    g.fillText("결과가 나옵니다", 44, top + 148);
    return;
  }

  /* 막대 */
  const bars = st.stage === 2
    ? [{ label: "순물질", v: st.nPure / RAOULT.SCALE, col: C["d-blue"] },
       { label: "용액",   v: st.nSol  / RAOULT.SCALE, col: C["d-cyan"] }]
    : [{ label: st.stage === 3 ? "지금" : "증기 압력", v: st.nSol / RAOULT.SCALE, col: C["d-blue"] }];
  if (st.stage === 3) bars.unshift({ label: "순물질", v: P0, col: C["p-silver"] });

  const bw = Math.min(46, (W - 52) / bars.length - 10);
  bars.forEach((b, i) => {
    const x = 42 + i * (bw + 14);
    const y = yFor(b.v);
    g.fillStyle = b.col; g.fillRect(x, y, bw, bottom - y);
    g.fillStyle = C.t1; g.font = "600 11.5px system-ui,sans-serif";
    g.fillText(fmtP(b.v), x, y - 5);
    g.fillStyle = C.t2; g.font = "11px system-ui,sans-serif";
    g.fillText(b.label, x, bottom + 15);
  });

  /* ΔP 화살표 — 막대가 둘일 때 */
  if (bars.length === 2 && Math.abs(bars[0].v - bars[1].v) > 1e-9) {
    const x0 = 42 + bw + 6, y1 = yFor(bars[0].v), y2 = yFor(bars[1].v);
    g.strokeStyle = C["d-red"]; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y2); g.stroke();
    for (const [yy, dir] of [[y1, 1], [y2, -1]]) {
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 - 3.5, yy + 5 * dir);
      g.lineTo(x0 + 3.5, yy + 5 * dir); g.closePath(); g.fillStyle = C["d-red"]; g.fill();
    }
    g.fillStyle = C["d-red"]; g.font = "600 11px system-ui,sans-serif";
    g.fillText("ΔP " + fmtDp(Math.abs(bars[0].v - bars[1].v)), x0 + 6, (y1 + y2) / 2 + 3);
  }

  /* 대기압 — 축 밖이므로 늘 «수치와 배율»로 알린다 */
  g.strokeStyle = C["d-red"]; g.setLineDash([5, 4]); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(34, top - 6); g.lineTo(W - 6, top - 6); g.stroke();
  g.setLineDash([]);
  g.fillStyle = C["d-red"]; g.font = "600 10.5px system-ui,sans-serif";
  g.fillText("↑ 대기압 760 (이 축의 " + atmTimesAbove(st.t).toFixed(0) + "배 위)", 36, top - 10);
}

/* ── 측정값 갱신 ─────────────────────────────────────────────── */
function updateReadouts() {
  const P0 = pPure(st.t);
  $("vAtm").textContent = "1.000";
  $("vPpure").textContent = setPress(P0);
  $("vX").textContent = xSolvent(activeXs()).toFixed(3);

  if (gated()) {
    for (const id of ["vP", "vEvap", "vCond", "vDp"]) $(id).textContent = "—";
    $("vState").textContent = "예측을 기다리는 중";
    return;
  }

  const m = activeModel(), cv = activeCover(), xs = activeXs();
  const pNow = st.nSol / RAOULT.SCALE;
  $("vP").textContent = setPress(pNow);
  $("vDp").textContent = fmtDp(st.stage === 2 ? (st.nPure - st.nSol) / RAOULT.SCALE : Math.max(0, P0 - pNow));

  const ev = evapRate(st.t, xs, m, cv);
  const co = condCoef(m, cv) * st.nSol;
  $("vEvap").textContent = ev.toFixed(0);
  $("vCond").textContent = co.toFixed(0);

  const eq = atEq(st.nSol, st.t, xs, m, cv);
  const roState = $("roState");
  roState.classList.remove("is-ok", "is-warn");
  if (!st.running) { $("vState").textContent = "멈춤 — ▶ 를 누르세요"; }
  else if (eq) { $("vState").textContent = "동적 평형"; roState.classList.add("is-ok"); }
  else { $("vState").textContent = "재는 중"; roState.classList.add("is-warn"); }

  /* 「재는 중」과 결론 문구는 «지금 실제로 평형인 순간»에만 갈린다 (매뉴얼 §14③-3).
     ⚠ 「재는 중」의 조건은 상태 칸과 «같은 판정»(eq)을 써야 한다. settled(2.2 s 대기)로 걸면
        상태 칸이 「동적 평형」인데 아래에 「아직 평형이 아닙니다」가 함께 뜬다 — J-N5 위반이다.
        (전수 육안에서 실제로 잡혔다.) */
  const settled = eq && st.eqSince !== null && (st.clock - st.eqSince) >= RAOULT.SETTLE_S;
  $("measuring").classList.toggle("is-off", !(st.running && !eq));
  const vd = $("verdict");
  vd.classList.toggle("is-off", !settled);
  /* ★ 결론 상자의 «색»이 옳고 그름을 말한다. 학생 자신의 틀린 가정(film1)의 결과를
     초록(성공색)으로 띄우면 「내 예측이 맞았다」로 읽힌다 — 이 시뮬이 막으려는 바로 그 오독이다.
     film1 은 주황(가정) 으로, 참인 결과(film2·comp·탭1·2)만 초록으로 낸다. */
  const asAssumption = st.stage === 3 && st.model === "film1";
  vd.classList.toggle("verdict--assume", asAssumption);
  if (settled) {
    if (st.stage === 1) vd.innerHTML = "떠나는 분자 수 = 돌아오는 분자 수. <b>지금이 동적 평형</b>이고, 이때 기체가 나타내는 압력이 <b>증기 압력</b>입니다.";
    else if (st.stage === 2) vd.innerHTML = "용액의 증기 압력이 순물질보다 <b>" + fmtDp((st.nPure - st.nSol) / RAOULT.SCALE) + " mmHg 낮습니다.</b> 용매의 몰분율 " + xSolvent(st.xs).toFixed(3) + " 를 순물질의 증기 압력에 곱한 값입니다.";
    else if (st.model === "film2") vd.innerHTML = "덮개를 " + Math.round(st.cover * 100) + " % 씌웠는데 평형 증기 압력은 <b>순물질과 같습니다.</b> 달라진 것은 <b>여기까지 오는 데 걸린 시간</b>뿐입니다.";
    else if (st.model === "film1") vd.innerHTML = "<b>이것은 「덮개가 나가는 것만 막는다」고 «가정»했을 때의 결과입니다.</b> 덮개를 " + Math.round(st.cover * 100) + " % 씌우면 증기 압력도 " + Math.round(st.cover * 100) + " % 내려갑니다.<br>그런데 <b>실제 저수지 실측에서는 단분자막을 깔아도 평형 증기 압력이 변하지 않습니다.</b> 아래 「프로그램 밖의 근거」를 읽고, 옆 단추로 <b>「덮개가 양쪽을 함께 막는다」</b>도 눌러 보세요.";
    else vd.innerHTML = "용질이 액체 <b>전체</b>에 퍼져 있을 때의 결과입니다. 덮개를 아무리 바꿔도 이 값은 <b>용매의 몰분율</b>만 따라갑니다.";
  }

  if (st.stage === 2 && st.split) {
    /* 캔버스가 «따로» 표집한 그 값을 그대로 읽는다 — 두 곳이 다른 계산을 하면 어긋난다(F-1) */
    const a = st.cumN ? (st.cumA / st.cumN * 100).toFixed(1) : "0.0";
    const b = st.cumN ? (st.cumB / st.cumN * 100).toFixed(1) : "0.0";
    $("vSurf").textContent = "액체 속 " + a + " % · 표면 " + b + " %  (" +
      Math.round(st.cumN / st.sampPer) + "번 누적)";
  }
}

/* ── 단계 전환 (표시 여부의 단일 원천) ───────────────────────── */
function applyStage() {
  const s = SHOW[st.stage];
  for (const id in s) {
    const el = $(id);
    if (el) el.style.display = s[id] ? SHOWVAL[id] : "none";
  }
  $("roSurf").style.display = (st.stage === 2 && st.split) ? SHOWVAL.roSurf : "none";
  $("stageTitle").textContent = TITLE[st.stage];
  $("stageDesc").textContent = DESC[st.stage];
  /* ⚠ 탭 3 의 안내 문구는 «지금 고른 가정»에 따라 달라져야 한다. 늘 「차단은 평형을 바꾸지
     않는다」를 띄우면, 화면이 그 반대를 보이는 film1 가정에서 문구와 그림이 어긋난다(J-N5). */
  $("mainNote").innerHTML = st.stage === 3
    ? (gated() ? "먼저 아래에서 <b>예측</b>을 고르세요. 고르기 전에는 결과를 보여 주지 않습니다."
      : st.model === "film1"
        ? "지금은 <b>「덮개가 나가는 것만 막는다」</b>고 가정한 결과입니다. 이 가정이 옳은지는 <b>프로그램이 아니라 실측</b>이 정합니다."
      : st.model === "film2"
        ? "<b>차단은 속도를 바꾸고, 평형을 바꾸지 않습니다.</b> 덮개를 많이 씌울수록 평형에 이르는 데 <b>오래 걸리지만</b>, 도달한 뒤의 압력은 같습니다."
        : "용질이 액체 <b>전체</b>에 퍼져 있을 때입니다. 덮개와 무관하게 <b>용매의 몰분율</b>만 압력을 정합니다.")
    : NOTE[st.stage];
  $("sideNote").textContent = SIDE[st.stage];
  for (const b of document.querySelectorAll(".stg"))
    b.setAttribute("aria-pressed", String(+b.dataset.stage === st.stage));
  zcv.style.display = (st.zoom || st.split) ? "block" : "none";
  gcv.style.display = (st.zoom || st.split) ? "none" : "block";
  /* ⚠ 여기서 eqSince 를 지우지 않는다. 화면을 확대·축소하는 것은 «물리를 바꾸는 조작»이 아닌데,
     지우면 평형에 이미 도달해 있는데도 결론이 사라졌다가 다시 뜬다(육안에서 잡힌 결함).
     평형 판정을 되돌리는 것은 온도·농도·덮개·가정·단계를 바꿀 때뿐이다. */
  drawGauge(); updateReadouts();
}

/* ── 루프 ─────────────────────────────────────────────────────── */
let raf = null, last = 0;
function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  if (st.running) {
    st.clock += dt;
    const m = activeModel(), cv = activeCover(), xs = activeXs();
    st.nSol = stepN(st.nSol, st.t, xs, m, cv, dt);
    st.nPure = stepN(st.nPure, st.t, 0, "comp", 0, dt);
    st.diffuse = Math.min(1, st.diffuse + dt / (REDUCED ? 0.001 : 2.6));
    if (atEq(st.nSol, st.t, xs, m, cv)) { if (st.eqSince === null) st.eqSince = st.clock; }
    else st.eqSince = null;
    exchangeTick(dt);
  }
  syncGas(gasP, st.nPure * 0.16);
  syncGas(gasS, st.nSol * 0.16);
  if (st.zoom || st.split) drawZoom(); else drawGL();
  drawGauge();
  updateReadouts();
}
function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

/* ── 조작 배선 ───────────────────────────────────────────────── */
function bind() {
  for (const b of document.querySelectorAll(".stg")) b.addEventListener("click", () => {
    st.stage = +b.dataset.stage;
    st.zoom = false; st.split = false; st.eqSince = null;
    $("zoomBtn").setAttribute("aria-pressed", "false");
    $("splitBtn").setAttribute("aria-pressed", "false");
    if (st.stage === 2) { st.diffuse = 0; st.cumA = st.cumB = st.cumN = 0; st.cumSeed = -1; }
    applyStage();
  });

  $("tSl").addEventListener("input", e => {
    st.t = +e.target.value; $("tVal").textContent = st.t + " ℃"; st.eqSince = null;
  });
  $("xsSl").addEventListener("input", e => {
    st.xs = +e.target.value; $("xsVal").textContent = st.xs.toFixed(3); st.eqSince = null;
    st.cumA = st.cumB = st.cumN = 0; st.cumSeed = -1;      // 조성이 바뀌면 누적을 비운다
  });
  $("coverSl").addEventListener("input", e => {
    st.cover = +e.target.value; $("coverVal").textContent = Math.round(st.cover * 100) + " %"; st.eqSince = null;
  });

  $("zoomBtn").addEventListener("click", () => {
    st.zoom = !st.zoom;
    $("zoomBtn").setAttribute("aria-pressed", String(st.zoom));
    $("zoomBtn").textContent = st.zoom ? "비커 전체로 돌아가기" : "분자 수준으로 확대해 보기";
    applyStage();
  });
  $("splitBtn").addEventListener("click", () => {
    st.split = !st.split;
    $("splitBtn").setAttribute("aria-pressed", String(st.split));
    $("splitBtn").textContent = st.split ? "비커 전체로 돌아가기" : "표면을 확대해 보기";
    applyStage();
  });
  $("pauseBtn").addEventListener("click", () => {
    st.running = !st.running;
    $("pauseBtn").textContent = st.running ? "⏸ 잠시 멈춤" : "▶ 시작";
    $("pauseBtn").setAttribute("aria-pressed", String(!st.running));
  });
  $("skipBtn").addEventListener("click", () => {
    st.nSol = terminalN(st.t, activeXs(), activeModel(), activeCover());
    st.nPure = terminalN(st.t, 0, "comp", 0);
    st.eqSince = st.clock - RAOULT.SETTLE_S;
  });

  for (const b of document.querySelectorAll(".pop")) b.addEventListener("click", () => {
    st.predicted = b.dataset.pred;
    for (const o of document.querySelectorAll(".pop"))
      o.setAttribute("aria-pressed", String(o === b));
    /* ★ 예측이 무엇이든 «첫 실행은 항상 막·양방향»이다.
       예측에 대응하는 모형을 곧바로 돌리면, ⓐ(★★★ 오개념)를 고른 학생만 자기 예측이
       화면에 그대로 재현되는 것을 먼저 보게 된다 — 상충 단계에서 상충이 사라진다.
       먼저 「덮어도 그대로」를 겪게 하고, 다른 가정은 그 뒤에 스스로 눌러 보게 한다. */
    st.model = "film2";
    for (const o of document.querySelectorAll(".mdl"))
      o.setAttribute("aria-pressed", String(o.dataset.model === st.model));
    st.eqSince = null;
    applyStage();
  });
  for (const b of document.querySelectorAll(".mdl")) b.addEventListener("click", () => {
    if (gated()) return;
    st.model = b.dataset.model;
    for (const o of document.querySelectorAll(".mdl"))
      o.setAttribute("aria-pressed", String(o === b));
    st.eqSince = null;
    applyStage();                       // 가정이 바뀌면 안내 문구도 함께 바뀐다
  });

  /* 탭에서 벗어나면 rAF 를 멈추고, 돌아오면 «반드시» 되살린다 (복구 누락이 흔한 함정) */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLoop(); else startLoop();
  });
  window.addEventListener("resize", () => { drawGauge(); });
}

/* ── 시작 ─────────────────────────────────────────────────────── */
glOK = initGL();
bind();
$("tVal").textContent = st.t + " ℃";
$("xsVal").textContent = st.xs.toFixed(3);
$("coverVal").textContent = Math.round(st.cover * 100) + " %";
st.nPure = 0; st.nSol = 0;
applyStage();
startLoop();
