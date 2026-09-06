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

/* ================= UI + 캔버스 렌더 ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   검증스크립트/raoult_core.js 와 문자 단위로 같은지 대조한다.
   ★ 이 줄을 지우거나 바꾸지 말 것. 바꾸면 raoult_check.js [G-6] 이 FAIL 한다.

   ── 렌더 방침 (사용자 확정 2026-09-07) ──────────────────────────────────
   거시 세계도, 분자 화면도 «2D 도식»이다. WebGL 을 쓰지 않는다.
   시각 언어는 같은 「용액」 칩의 waterdensity/ 를 따른다 —
     · 비커 : 평면 윤곽(stageLine) + 옅은 청색 유리 하이라이트 · 물은 rgba(37,99,235,0.42)
     · 돋보기 : 원형 클립 + 비커→돋보기 점선 연결선 + 회색 테두리 + ×배율 라벨
     · 물 분자 : CPK(O 빨강·H 흰색) 공-막대, H–O–H 104.5°
     · 용질   : 토큰 보라 단색 + 진한 테두리 (발광 없음 — 흰 무대에서 발광은 사라진다, 4부 ㉜)
   거시 관찰이 기본이고 돋보기는 학생이 켠다(매뉴얼 §14①). 두 배율이 «한 화면»에 같이 있다.
   ──────────────────────────────────────────────────────────────────── */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
["--t1","--t2","--t3","--line","--panel","--accent","--d-blue","--d-cyan","--d-red",
 "--d-green","--d-amber","--d-violet","--d-gray","--p-silver","--stage-line"].forEach(k => {
  C[k.slice(2)] = CSSV(k) || "#888";
});
const REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

/* CPK 는 토큰 예외다(매뉴얼 §4). 테두리는 waterdensity 와 같은 darker() 로 만든다 */
const CPK_O = "#FF0D0D", CPK_H = "#FFFFFF";
function darker(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return "rgb(" + Math.round((n >> 16 & 255) * f) + "," + Math.round((n >> 8 & 255) * f) + "," +
    Math.round((n & 255) * f) + ")";
}
const O_STROKE = darker(CPK_O, 0.5), H_STROKE = darker(CPK_H, 0.45);
const SOL_FILL = C["d-violet"], SOL_STROKE = darker(C["d-violet"].startsWith("#") ? C["d-violet"] : "#6d28d9", 0.55);
const HOH_DEG = 104.5;
const WATER_FILL = "rgba(37,99,235,0.42)", WATER_LINE = "rgba(29,78,216,0.9)";
const SOLN_FILL = "rgba(109,40,217,0.30)";

/* ── 단계 × 요소 가시성의 «단일 원천» (매뉴얼 §13①).
   applyStage() 만 display 를 건드린다. 다른 곳에서 display 를 대입하면 게이팅이 조용히 뚫린다. */
const SHOW = {
  1: { xsCtl:0, coverCtl:0, roDp:0, roX:0, roSurf:0, predictBox:0, modelBox:0, splitBtn:0, skipBtn:0, zoomBtn:1 },
  2: { xsCtl:1, coverCtl:0, roDp:1, roX:1, roSurf:0, predictBox:0, modelBox:0, splitBtn:1, skipBtn:0, zoomBtn:0 },
  3: { xsCtl:0, coverCtl:1, roDp:1, roX:1, roSurf:0, predictBox:1, modelBox:1, splitBtn:0, skipBtn:1, zoomBtn:1 }
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
  1: "밀폐한 그릇 속 물입니다. 온도를 바꿔 가며, 증발하는 분자 수와 응축하는 분자 수가 같아지는 순간을 찾아보세요. 「분자 수준으로 확대해 보기」를 누르면 액면을 돋보기로 확대해 표면에서 무슨 일이 일어나는지 보입니다.",
  2: "왼쪽은 순수한 물, 오른쪽은 비휘발성 용질을 녹인 용액입니다. 용질은 액체 «전체»에 고르게 퍼집니다. 「표면을 확대해 보기」로 액체 속 한 곳과 표면 한 곳을 돋보기로 각각 세어 비교해 보세요.",
  3: "이 탭은 세 가지 «가정»을 각각 돌려 봅니다. 먼저 예측을 고르면 「덮개가 양쪽을 함께 막는다」부터 돌아갑니다. 그다음 다른 가정도 눌러 보고, 아래 「프로그램 밖의 근거」와 견주어 보세요."
};
const NOTE = {
  1: "<b>증기 압력</b>은 동적 평형에 이르렀을 때 기체가 나타내는 압력입니다. 액체의 양이나 그릇의 부피와는 관계가 없습니다.",
  2: "용질이 있으면 용매는 그 액체를 <b>떠나기 어려워집니다.</b> 붙잡혀서가 아니라, <b>용액 전체에서</b> 용매 분자가 차지하는 비율이 줄었기 때문입니다.<br><span style=\"color:var(--t3)\">(더 정확히는 액체 쪽에 있을 때의 배치 가짓수가 늘어난 것입니다. 왜 그것이 증발을 줄이는지는 Ⅲ단원에서 다룹니다.)</span>",
  3: "<b>차단은 속도를 바꾸고, 평형을 바꾸지 않습니다.</b> 덮개를 많이 씌울수록 평형에 이르는 데 <b>오래 걸리지만</b>, 도달한 뒤의 압력은 같습니다."
};
const SIDE = {
  1: "온도를 올리면 증발하는 분자가 늘고, 그만큼 응축하는 분자도 늘어 더 높은 압력에서 다시 평형이 됩니다.",
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
  loupe: false,           // 돋보기 켜짐 (탭 1·3: 표면 하나 · 탭 2: 액체 속 + 표면 둘)
  nPure: 0,               // 순물질 쪽 기체 분자 수 (결정론)
  nSol: 0,                // 용액(또는 탭 3의 현재 가정) 쪽 기체 분자 수
  eqSince: null,          // 평형 밴드에 들어온 시각 (s)
  clock: 0,
  diffuse: 0,             // 탭 2 용질 확산 진행도 0~1
  sampA: 0, sampB: 0, sampPer: 40,  // 탭 2 돋보기에서 «따로» 센 두 곳의 용질 개수(이번 뽑기)
  cumA: 0, cumB: 0, cumN: 0, cumSeed: -1  // 누적 — 한 번만 뽑으면 요동이 신호보다 크다
};

/* 탭 3에서 「지금 무엇을 재고 있는가」 — 모형에 따라 계산부의 어느 세트를 쓰는지 */
function activeModel() { return st.stage === 3 ? st.model : "comp"; }
function activeCover() { return st.stage === 3 ? st.cover : 0; }
/* 탭 3 은 X용질 을 «고정»한다. 슬라이더로 열어 두면 덮인 넓이와 같아지는 순간
   막·증발만(P°·f)과 조성(P°·X)이 «비트 단위로 같은 수»를 내어 두 모형을 가릴 수 없다. */
function activeXs()    { return st.stage === 1 ? 0 : st.stage === 3 ? RAOULT.XS_TAB3 : st.xs; }
/* 덮개층을 «그리는가» — 막 가정 둘에서만. 조성 가정에는 덮개가 없다 */
function coverShown()  { return st.stage === 3 && !gated() && st.model !== "comp" ? st.cover : 0; }

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

/* ── 캔버스 ─────────────────────────────────────────────────── */
const stageCv = $("stage"), gaugeCv = $("gauge");
function sizeCanvas(cv, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = hCss + "px";
  const w = Math.max(1, Math.round(cv.clientWidth * dpr));
  const h = Math.max(1, Math.round(hCss * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: cv.clientWidth, h: hCss };
}

/* 결정론적 난수 — 그림이 프레임마다 흔들리지 않게(프로브 재현성) */
function rnd(seed) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

/* ── 원시 도형 — waterdensity 와 같은 모양 ────────────────────── */
/* 물 분자 하나. ang = 분자 축의 회전(라디안). r = O 반지름. */
function drawH2O(g, x, y, r, ang) {
  const half = HOH_DEG / 2 * Math.PI / 180, L = r * 0.95, rH = r * 0.60;
  for (let k = 0; k < 2; k++) {
    const a = ang - Math.PI / 2 + (k ? half : -half);
    const hx = x + Math.cos(a) * L, hy = y + Math.sin(a) * L;
    g.strokeStyle = "rgba(90,100,112,0.85)"; g.lineWidth = Math.max(1, r * 0.22);
    g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = CPK_H; g.strokeStyle = H_STROKE; g.lineWidth = Math.max(0.8, r * 0.12);
    g.beginPath(); g.arc(hx, hy, rH, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  g.fillStyle = CPK_O; g.strokeStyle = O_STROKE; g.lineWidth = Math.max(1, r * 0.16);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
}
/* 용질 입자 — 단색 + 진한 테두리. 크기는 «도식»이다(§7 L-4). 발광·후광 없음. */
function drawSolute(g, x, y, r) {
  g.fillStyle = SOL_FILL; g.strokeStyle = SOL_STROKE; g.lineWidth = Math.max(1.2, r * 0.18);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
}
function arrow(g, x0, y0, x1, y1, col, lw) {
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), hl = 6 + lw;
  g.beginPath(); g.moveTo(x1, y1);
  g.lineTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5));
  g.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
  g.closePath(); g.fill();
}

/* ── 기체 분자 (화면용) ────────────────────────────────────────
   개수는 계산부의 종단값을 향해 결정론적으로 가고, «자리»만 흩뿌린다.
   평형에 닿은 뒤에도 교환 사건을 계속 일으킨다 (매뉴얼 §14③-2 — 정지 = 평형 오독 방지). */
const gasP = [], gasS = [];
function syncGas(arr, want) {
  want = Math.max(0, Math.round(want));
  while (arr.length < want) arr.push({ x: rnd(arr.length * 3.1 + 1), y: rnd(arr.length * 7.7 + 2), a: 0, s: arr.length });
  while (arr.length > want) arr.splice(Math.floor(rnd(st.clock * 13 + arr.length) * arr.length), 1);
  for (const g of arr) g.a = Math.min(1, g.a + 0.08);
}
let swapTimer = 0;
function exchangeTick(dt) {
  swapTimer += dt;
  if (swapTimer < 0.35) return;
  swapTimer = 0;
  for (const arr of [gasP, gasS]) {
    if (arr.length > 2) {
      arr.splice(Math.floor(rnd(st.clock * 17) * arr.length), 1);
      arr.push({ x: rnd(st.clock * 5 + 3), y: rnd(st.clock * 9 + 4), a: 0, s: Math.floor(st.clock * 100) });
    }
  }
}

/* ── 배치 ──────────────────────────────────────────────────────
   [비커 …] 왼쪽 · [돋보기 …] 오른쪽. 좁은 화면(< 520 px)에서는 돋보기를 «아래»에 둔다
   (waterdensity 와 같은 규칙 — 옆에 두면 비커가 성냥갑이 된다). */
const H_BASE = 370;
function layout(w) {
  const narrow = w < 520;
  const nB = st.stage === 2 ? 2 : 1;
  const nL = st.loupe ? (st.stage === 2 ? 2 : 1) : 0;
  const pad = 12;
  let R = 0, loupeW = 0, loupeH = 0;
  if (nL) {
    /* 아래 배치: 제목(위 24) + 알(2R) + 부제(아래 30) + 바닥 설명 줄(20). 서로 겹치지 않게 «띠»로 잡는다 */
    if (narrow) { R = Math.max(40, Math.min(66, (w - pad * 2 - 24) / (nL * 2 + 0.6))); loupeH = 2 * R + 74; }
    else { R = nL === 2 ? Math.min(66, (H_BASE - 100) / 4) : 86; loupeW = 2 * R + 40; }
  }
  const H = H_BASE + loupeH;
  /* 비커 띠는 바닥 설명 한 줄(26 px)을 남긴다. 비커 라벨은 «액체 안»에 쓰므로 아래 여백이 더 필요 없다 */
  const area = { x: pad, y: pad + 22, w: w - pad * 2 - loupeW, h: H_BASE - pad - 22 - 26 };
  const bw = Math.max(70, Math.min(190, (area.w - (nB - 1) * 22) / nB));
  const bx0 = area.x + (area.w - (bw * nB + (nB - 1) * 22)) / 2;
  const beakers = [];
  for (let i = 0; i < nB; i++) beakers.push({ x: bx0 + i * (bw + 22), y: area.y, w: bw, h: area.h });
  const loupes = [];
  if (nL) {
    if (!narrow) {
      const cx = w - pad - R - 8;
      const ys = nL === 2 ? [area.y + R + 6, area.y + area.h - R - 4] : [area.y + area.h / 2 - 6];
      ys.forEach(cy => loupes.push({ cx, cy, R }));
    } else {
      const cy = H_BASE + 24 + R;                      // 위 24 px 는 돋보기 제목 자리
      const xs = nL === 2 ? [w / 2 - R - 12, w / 2 + R + 12] : [w / 2];
      xs.forEach(cx => loupes.push({ cx, cy, R }));
    }
  }
  return { H, narrow, beakers, loupes, R };
}

/* ── 비커 (2D 도식) ────────────────────────────────────────────
   b = {x,y,w,h} · opts = { label, solute(0~1), cover(0~1), gas(배열), evap, cond, dots }
   액면은 «고정»이다(§3-7 — 증발로 줄어드는 양은 0.01 % 수준이라 보이지 않는 것이 옳다). */
const FILL_FRAC = 0.58;
function beakerSurfaceY(b) { return b.y + b.h - b.h * FILL_FRAC; }
function drawBeaker(g, b, o) {
  const x = b.x, w = b.w, top = b.y, bot = b.y + b.h;
  const sy = beakerSurfaceY(b);
  /* 액체 — 물색을 용질 짙기만큼 보라 쪽으로 (「전체에 퍼져 있다」를 색으로) */
  g.fillStyle = WATER_FILL;
  g.fillRect(x + 2, sy, w - 4, bot - sy);
  if (o.solute > 0.001) {
    g.fillStyle = SOLN_FILL; g.globalAlpha = o.solute; g.fillRect(x + 2, sy, w - 4, bot - sy); g.globalAlpha = 1;
  }
  /* 용질 입자 — 액체 «전체»에 고르게. 투입 직후에는 위에서 퍼져 내려온다(diffuse) */
  if (o.dots && o.dots.length) {
    const rS = Math.max(2.2, w * 0.017);
    for (const d of o.dots) {
      const tx = x + 6 + d.u * (w - 12), ty = sy + 6 + d.v * (bot - sy - 12);
      const e = 1 - Math.pow(1 - o.diffuse, 3);                    // 감속
      const px = (x + w / 2) + (tx - (x + w / 2)) * e;
      const py = (sy + 8) + (ty - (sy + 8)) * e;
      drawSolute(g, px, py, rS);
    }
  }
  /* 액면 선 */
  g.strokeStyle = WATER_LINE; g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(x + 2, sy); g.lineTo(x + w - 2, sy); g.stroke();
  /* 덮개층 — 탭 3 막 가정에서만. 왼쪽에서부터 cover 비율만큼 */
  if (o.cover > 0.001) {
    g.fillStyle = "rgba(120,105,80,0.85)";
    g.fillRect(x + 2, sy - 5, (w - 4) * o.cover, 5);
  }
  /* 기체 분자 — 액면 위 공간에 작은 H₂O */
  if (o.gas) {
    const hs = { x: x + 8, y: top + 16, w: w - 16, h: sy - top - 26 };
    const rO = Math.max(1.6, Math.min(2.6, w * 0.014));
    for (const p of o.gas) {
      g.globalAlpha = 0.45 + 0.55 * p.a;
      drawH2O(g, hs.x + p.x * hs.w, hs.y + p.y * hs.h, rO, rnd(p.s) * 6.28);
    }
    g.globalAlpha = 1;
  }
  /* 증발·응축 화살표 — «같은 굵기». 교과서 그림 Ⅱ-10 에는 응축 화살표가 없다(검토자 실측).
     둘을 같은 굵기로 나란히 두는 것이 이 그림의 요점이다. 개수는 옆 숫자가 말한다. */
  if (o.evap !== undefined) {
    const ax = x + w * 0.36, bx2 = x + w * 0.64, len = Math.min(26, (sy - top) * 0.32);
    arrow(g, ax, sy - 2, ax, sy - 2 - len, C.t2, 2.2);
    arrow(g, bx2, sy - 2 - len, bx2, sy - 2, C.t2, 2.2);
    g.fillStyle = C.t2; g.font = "600 10px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("증발 " + o.evap, ax, sy - 4 - len - 4);
    g.fillText("응축 " + o.cond, bx2, sy - 4 - len - 4);
  }
  /* 유리 윤곽 — 내용물 «앞»에 그린다(안 그러면 바닥선이 물에 덮인다). 밀폐 뚜껑 포함 */
  g.save();
  g.strokeStyle = C["stage-line"]; g.lineWidth = 2.6; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, top + 4); g.lineTo(x, bot); g.lineTo(x + w, bot); g.lineTo(x + w, top + 4);
  g.stroke();
  /* 뚜껑 — 판 + 손잡이 */
  g.fillStyle = "rgba(107,114,128,0.95)";
  g.fillRect(x - 5, top - 2, w + 10, 6);
  g.fillRect(x + w / 2 - 6, top - 10, 12, 8);
  /* 유리 하이라이트 — 흰색이 아니라 옅은 청색(§5) */
  g.strokeStyle = "rgba(160,200,228,0.75)"; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(x + 7, top + 18); g.lineTo(x + 7, bot - 12); g.stroke();
  g.restore();
  /* 라벨 — 비커 «아래»가 아니라 «액체 안»에 쓴다 (waterdensity 의 「물」「얼음」과 같은 자리).
     아래에 쓰면 바닥 설명·돋보기 제목과 겹친다 — 육안에서 실제로 잡혔다. */
  if (o.label) {
    g.fillStyle = C.t1; g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText(o.label, x + w / 2, sy + (bot - sy) * 0.58);
  }
}

/* ── 돋보기 ─────────────────────────────────────────────────────
   L = {cx,cy,R} · src = {x,y,w,h} 비커 위의 «확대 대상» 사각형 · kind = "surface" | "bulk"
   opts = { xs, cover, evapAnim, sampleIdx, label, sub, gasN }
   ★ 격자 칸 수는 «여기 상수 하나»가 원천이다. 표집(sampleSolute)도 같은 수를 써야
     「용질 n / 칸수」 표기와 그림이 일치한다(J-N5). 7 열 × 표면 4 행 / 속 6 행.              */
const LOUPE_COLS = 7, LOUPE_ROWS_SURF = 4, LOUPE_ROWS_BULK = 6;
const LOUPE_SURF = LOUPE_COLS * LOUPE_ROWS_SURF, LOUPE_BULK = LOUPE_COLS * LOUPE_ROWS_BULK;
function drawLoupe(g, L, src, kind, o) {
  const { cx, cy, R } = L;
  /* 비커 → 돋보기 연결선 (돋보기가 「저기를 확대한 것」임을 잇는다) */
  g.strokeStyle = "rgba(120,132,148,0.75)"; g.lineWidth = 1; g.setLineDash([3, 3]);
  const sx = src.x + src.w, sy0 = src.y, sy1 = src.y + src.h;
  const toLeft = cx > sx;
  const t1 = toLeft ? [cx - R * 0.72, cy - R * 0.72] : [cx - R * 0.70, cy - R * 0.71];
  const t2 = toLeft ? [cx - R * 0.72, cy + R * 0.72] : [cx + R * 0.70, cy - R * 0.71];
  g.beginPath(); g.moveTo(toLeft ? sx : src.x, sy0); g.lineTo(t1[0], t1[1]); g.stroke();
  g.beginPath(); g.moveTo(toLeft ? sx : src.x + src.w, toLeft ? sy1 : sy0); g.lineTo(t2[0], t2[1]); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = C["d-blue"]; g.lineWidth = 1.6;
  g.strokeRect(src.x, src.y, src.w, src.h);

  /* 알 */
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#ffffff"; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  const surfY = kind === "surface" ? cy - R * 0.05 : cy - R - 10;   // bulk 는 액면이 알 밖
  /* 액체 */
  g.fillStyle = WATER_FILL; g.fillRect(cx - R, surfY, 2 * R, cy + R - surfY);
  if (o.xs > 0) { g.fillStyle = SOLN_FILL; g.globalAlpha = o.xs / RAOULT.XS.max; g.fillRect(cx - R, surfY, 2 * R, cy + R - surfY); g.globalAlpha = 1; }
  if (kind === "surface") {
    g.strokeStyle = WATER_LINE; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - R, surfY); g.lineTo(cx + R, surfY); g.stroke();
  }

  /* 액체 속 분자 격자 — 8 × 5. 용질은 표집한 칸에 «대신» 들어간다(전체 조성과 같은 비율) */
  /* 7 열 × (표면 4 / 속 6) 행. 반지름을 칸의 0.30 으로 잡아야 H 두 개가 «V 자»로 읽힌다 —
     0.24 면 빨간 점으로만 보였다(육안 실측). 표집 칸 수(sampleSolute 의 cells)와 같아야 한다 */
  const cols = LOUPE_COLS, rows = kind === "surface" ? LOUPE_ROWS_SURF : LOUPE_ROWS_BULK;
  const gx0 = cx - R * 0.92, gw = R * 1.84;
  const gy0 = kind === "surface" ? surfY + R * 0.10 : cy - R * 0.85, gh = kind === "surface" ? (cy + R - gy0) : R * 1.7;
  const cw = gw / cols, ch = gh / rows, rO = Math.min(cw, ch) * 0.30;
  const jit = REDUCED ? 0 : 1.6;
  const marks = o.sampleIdx || new Set();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const idx = j * cols + i;
    const jx = jit * Math.sin(st.clock * 1.3 + idx * 1.7), jy = jit * Math.cos(st.clock * 1.1 + idx * 2.3);
    const x = gx0 + (i + 0.5) * cw + jx, y = gy0 + (j + 0.5) * ch + jy;
    if (marks.has(idx)) drawSolute(g, x, y, rO * 1.45);
    else drawH2O(g, x, y, rO, rnd(idx + 11) * 6.28 + (REDUCED ? 0 : 0.15 * Math.sin(st.clock + idx)));
  }

  if (kind === "surface") {
    /* 기체 쪽 분자 — 몇 개만 흩뿌린다(개수는 압력 막대가 말한다) */
    const nG = o.gasN || 5;
    for (let k = 0; k < nG; k++) {
      const x = cx - R * 0.8 + rnd(k * 3 + 5) * R * 1.6, y = cy - R * 0.9 + rnd(k * 5 + 7) * (surfY - (cy - R * 0.9) - 10);
      drawH2O(g, x, y, rO * 0.9, rnd(k + 41) * 6.28);
    }
    /* 탈출·복귀 사건 — 한 쌍이 번갈아 움직인다. 평형에서도 멈추지 않는다(§14③-2) */
    if (o.evapAnim) {
      const ph = REDUCED ? 0.5 : (st.clock % 1.6) / 1.6;
      const up = surfY - ph * (surfY - (cy - R * 0.75));
      drawH2O(g, cx - R * 0.35, up, rO, 0.3);
      arrow(g, cx - R * 0.35 + rO * 2.2, surfY - 4, cx - R * 0.35 + rO * 2.2, cy - R * 0.55, C.t2, 1.6);
      const dn = (cy - R * 0.75) + ph * (surfY - (cy - R * 0.75));
      drawH2O(g, cx + R * 0.35, dn, rO, -0.4);
      arrow(g, cx + R * 0.35 - rO * 2.2, cy - R * 0.55, cx + R * 0.35 - rO * 2.2, surfY - 4, C.t2, 1.6);
    }
    /* 덮개층 (탭 3 막 가정) */
    if (o.cover > 0.001) {
      g.fillStyle = "rgba(120,105,80,0.85)";
      g.fillRect(cx - R, surfY - 7, 2 * R * o.cover, 7);
      g.fillStyle = C.t2; g.font = "600 10px system-ui,sans-serif"; g.textAlign = "left";
      g.fillText("덮개 " + Math.round(o.cover * 100) + " %", cx - R + 6, surfY - 11);
    }
  }
  g.restore();
  g.strokeStyle = C["d-gray"]; g.lineWidth = 2.4;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();

  /* 라벨. ⚠ 「×N」 배율은 쓰지 않는다 — 이 비커는 도식이라 물리적 배율이 없다.
     waterdensity 의 ×1070 은 실제 부피 눈금(pxPerV)에서 유도한 값이고, 여기는 그런 눈금이 없다.
     숫자를 붙이면 지어낸 정밀도가 된다(P5 M7). */
  g.textAlign = "center";
  g.fillStyle = C.t2; g.font = "600 10.5px system-ui,sans-serif";
  g.fillText(o.label, cx, cy - R - 14);
  g.fillStyle = C["d-amber"]; g.font = "600 10px system-ui,sans-serif";
  g.fillText("분자 크기로 확대 · 도식", cx, cy - R - 3);
  if (o.sub) { g.fillStyle = C.t3; g.font = "10px system-ui,sans-serif"; g.fillText(o.sub, cx, cy + R + 14); }
}

/* 용질 자리 표집 — 두 돋보기는 «따로» 뽑는다. 같은 수를 두 곳에 그대로 찍으면
   「달랐을 수도 있었는가」의 답이 아니오가 되어 증거가 아니라 동어반복이다(매뉴얼 4부 ㉕). */
function sampleSolute(cells, pTrue, k, seedBase) {
  const set = new Set(); let n = 0;
  for (let i = 0; i < cells; i++) {
    const r = rnd(seedBase * 97 + k * 131 + i * 17);
    if (r < pTrue) { set.add(i); n++; }
  }
  return { set, n };
}

/* 용질 점(거시) — 몰분율에 비례한 개수, 자리는 고정 시드.
   ⚠ 상한 24개. 64개로 두니 X=0.05 인데 액체가 «보라색 덩어리»로 읽혔다(육안 실측) —
   검토자가 경고한 M1(은유 오염): 화면에 용질이 많아 보일수록 「막는다」가 그럴듯해진다.
   정직한 «개수»는 돋보기가 센다(1/32 등). 거시 점은 「전체에 퍼져 있다」만 말하면 된다. */
const DOTS = [];
for (let i = 0; i < 24; i++) DOTS.push({ u: rnd(i * 2 + 1), v: rnd(i * 2 + 2) });
function dotsFor(xs) { return DOTS.slice(0, Math.round(24 * xs / RAOULT.XS.max)); }

/* ── 무대 그리기 ──────────────────────────────────────────────── */
function drawStage() {
  const w0 = stageCv.clientWidth;
  if (w0 < 40) return;
  const L = layout(w0);
  const { g, w, h } = sizeCanvas(stageCv, L.H);
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);

  const m = activeModel(), cv = activeCover(), xs = activeXs();
  const ev = gated() ? undefined : evapRate(st.t, xs, m, cv).toFixed(0);
  const co = gated() ? undefined : (condCoef(m, cv) * st.nSol).toFixed(0);

  /* 비커들 */
  if (st.stage === 2) {
    const b0 = L.beakers[0], b1 = L.beakers[1];
    drawBeaker(g, b0, { label: "순수한 물", solute: 0, cover: 0, gas: gasP,
      evap: evapRate(st.t, 0, "comp", 0).toFixed(0), cond: (condCoef("comp", 0) * st.nPure).toFixed(0) });
    drawBeaker(g, b1, { label: "용액", solute: st.diffuse * st.xs / RAOULT.XS.max, cover: 0, gas: gasS,
      evap: ev, cond: co, dots: dotsFor(st.xs), diffuse: st.diffuse });
  } else {
    const b = L.beakers[0];
    drawBeaker(g, b, { label: st.stage === 3 ? "용액 (용질 몰분율 0.05)" : "순수한 물",
      solute: st.stage === 3 ? 1 : 0, cover: coverShown(), gas: gated() ? [] : gasS,
      evap: ev, cond: co, dots: st.stage === 3 ? dotsFor(RAOULT.XS_TAB3) : null, diffuse: 1 });
  }

  /* 돋보기 */
  if (st.loupe) {
    if (st.stage === 2) {
      const b1 = L.beakers[1];
      const sy = beakerSurfaceY(b1);
      const seedBase = Math.floor(st.clock / 2);
      const pTrue = st.xs;
      const A = sampleSolute(LOUPE_BULK, pTrue, 0, seedBase);
      const B = sampleSolute(LOUPE_SURF, pTrue, 1, seedBase);
      st.sampA = A.n; st.sampB = B.n; st.sampPer = LOUPE_BULK;
      if (seedBase !== st.cumSeed) { st.cumSeed = seedBase; st.cumA += A.n / LOUPE_BULK; st.cumB += B.n / LOUPE_SURF; st.cumN += 1; }
      drawLoupe(g, L.loupes[0], { x: b1.x + b1.w * 0.42, y: sy + (b1.y + b1.h - sy) * 0.55 - 7, w: 14, h: 14 },
        "bulk", { xs: st.xs, sampleIdx: A.set, label: "액체 속 한 곳",
          sub: "용질 " + A.n + " / " + LOUPE_BULK });
      drawLoupe(g, L.loupes[1], { x: b1.x + b1.w * 0.42, y: sy - 7, w: 14, h: 14 },
        "surface", { xs: st.xs, sampleIdx: B.set, label: "표면 한 곳", evapAnim: false,
          sub: "용질 " + B.n + " / " + LOUPE_SURF });
    } else {
      const b = L.beakers[0];
      const sy = beakerSurfaceY(b);
      const marks = st.stage === 3 ? sampleSolute(LOUPE_SURF, RAOULT.XS_TAB3, 2, 7).set : null;
      drawLoupe(g, L.loupes[0], { x: b.x + b.w * 0.42, y: sy - 7, w: 14, h: 14 }, "surface",
        { xs: st.stage === 3 ? RAOULT.XS_TAB3 : 0, sampleIdx: marks, cover: coverShown(),
          label: "액면 돋보기", evapAnim: !gated(),
          gasN: gated() ? 0 : Math.max(2, Math.min(9, Math.round(st.nSol / 30))),
          sub: gated() ? "예측을 고르면 보입니다" : "왼쪽 ↑ 증발 · 오른쪽 ↓ 응축 — 둘 다 계속" });
    }
  }

  /* 바닥 설명 — 캔버스 «맨 아래» 한 줄. 돋보기가 아래에 있으면 그 밑으로 내려간다.
     길면 잘린다(390 px 실측) — 좁은 화면에서는 더 짧은 문장을 쓴다 */
  g.fillStyle = C.t3; g.font = "11px system-ui,sans-serif"; g.textAlign = "center";
  const foot = L.narrow
    ? "밀폐 비커 · 평면 도식 · 액면 고정"
    : (st.stage === 2 ? "두 비커 모두 밀폐 · 평면 도식 — 분자 그림의 크기·개수는 실제 비가 아닙니다"
                      : "밀폐 비커 · 평면 도식 — 액면은 고정입니다(증발로 주는 양은 0.01 % 수준)");
  g.fillText(foot, w / 2, h - 8);
}

/* ── 압력 막대 (메인이 직접 그린다) ─────────────────────────────
   축은 0 ~ 1.2·P°(T) 로 «자동»이다. 고정 0~800 이면 ΔP 가 1 px 미만이 되어 읽히지 않는다.
   대기압은 축 밖이므로 수치와 「몇 배 위」 표기로 늘 보인다. */
const PLOT_H = 324;
function drawGauge() {
  const { g, w: W, h: H } = sizeCanvas(gaugeCv, PLOT_H + 46);
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);

  const top = 26, bottom = top + PLOT_H;
  const P0 = pPure(st.t), axisMax = 1.2 * P0;
  const yFor = v => bottom - Math.max(0, Math.min(v, axisMax)) / axisMax * PLOT_H;

  g.strokeStyle = C.line; g.lineWidth = 1; g.fillStyle = C.t3;
  g.font = "10.5px system-ui,sans-serif"; g.textAlign = "left";
  const stepT = axisMax > 120 ? 40 : axisMax > 60 ? 20 : 10;
  for (let v = 0; v <= axisMax; v += stepT) {
    const y = yFor(v);
    g.beginPath(); g.moveTo(34, y); g.lineTo(W - 6, y); g.stroke();
    g.fillText(String(v), 6, y + 3.5);
  }
  /* 축 단위 「mmHg」 글자는 뺀다 — 대기압 라벨과 겹쳤다(육안). 단위는 오른쪽 readout 이 병기한다 */

  if (gated()) {
    g.fillStyle = C.t3; g.font = "12px system-ui,sans-serif";
    g.fillText("예측을 고르면", 44, top + 130);
    g.fillText("결과가 나옵니다", 44, top + 148);
    return;
  }

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
    g.fillStyle = C.t1; g.font = "600 11.5px system-ui,sans-serif"; g.textAlign = "left";
    g.fillText(fmtP(b.v), x, y - 5);
    g.fillStyle = C.t2; g.font = "11px system-ui,sans-serif";
    g.fillText(b.label, x, bottom + 15);
  });

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

  g.strokeStyle = C["d-red"]; g.setLineDash([5, 4]); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(34, top - 6); g.lineTo(W - 6, top - 6); g.stroke();
  g.setLineDash([]);
  g.fillStyle = C["d-red"]; g.font = "600 10.5px system-ui,sans-serif";
  /* 폭 200 px(데스크톱)·128 px(모바일) 안에 들어가야 한다 — 긴 문장은 오른쪽이 잘렸다(육안 실측).
     「760 mmHg」는 오른쪽 readout 이 늘 병기하므로 여기서는 «몇 배 위»만 말하면 된다 */
  const times = atmTimesAbove(st.t).toFixed(0);
  g.fillText(W < 160 ? "↑ 대기압 " + times + "배 위" : "↑ 대기압 760 · 이 축의 " + times + "배 위", 36, top - 10);
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
     ⚠ 「재는 중」의 조건은 상태 칸과 «같은 판정»(eq)을 써야 한다 — 다르면 J-N5 위반(육안 실측). */
  const settled = eq && st.eqSince !== null && (st.clock - st.eqSince) >= RAOULT.SETTLE_S;
  $("measuring").classList.toggle("is-off", !(st.running && !eq));
  const vd = $("verdict");
  vd.classList.toggle("is-off", !settled);
  /* ★ 결론 상자의 «색»이 옳고 그름을 말한다. 학생 자신의 틀린 가정(film1)의 결과를
     초록(성공색)으로 띄우면 「내 예측이 맞았다」로 읽힌다. film1 은 주황(가정)으로. */
  vd.classList.toggle("verdict--assume", st.stage === 3 && st.model === "film1");
  if (settled) {
    if (st.stage === 1) vd.innerHTML = "증발하는 분자 수 = 응축하는 분자 수. <b>지금이 동적 평형</b>이고, 이때 기체가 나타내는 압력이 <b>증기 압력</b>입니다.";
    else if (st.stage === 2) vd.innerHTML = "용액의 증기 압력이 순물질보다 <b>" + fmtDp((st.nPure - st.nSol) / RAOULT.SCALE) + " mmHg 낮습니다.</b> 용매의 몰분율 " + xSolvent(st.xs).toFixed(3) + " 를 순물질의 증기 압력에 곱한 값입니다.";
    else if (st.model === "film2") vd.innerHTML = "덮개를 " + Math.round(st.cover * 100) + " % 씌웠는데 평형 증기 압력은 <b>순물질과 같습니다.</b> 달라진 것은 <b>여기까지 오는 데 걸린 시간</b>뿐입니다.";
    else if (st.model === "film1") vd.innerHTML = "<b>이것은 「덮개가 나가는 것만 막는다」고 «가정»했을 때의 결과입니다.</b> 덮개를 " + Math.round(st.cover * 100) + " % 씌우면 증기 압력도 " + Math.round(st.cover * 100) + " % 내려갑니다.<br>그런데 <b>실제 저수지 실측에서는 단분자막을 깔아도 평형 증기 압력이 변하지 않습니다.</b> 아래 「프로그램 밖의 근거」를 읽고, 옆 단추로 <b>「덮개가 양쪽을 함께 막는다」</b>도 눌러 보세요.";
    else vd.innerHTML = "용질이 액체 <b>전체</b>에 퍼져 있을 때의 결과입니다. 덮개를 아무리 바꿔도 이 값은 <b>용매의 몰분율</b>만 따라갑니다.";
  }

  if (st.stage === 2 && st.loupe) {
    /* 돋보기가 «따로» 표집한 값을 그대로 읽는다 — 두 곳이 다른 계산을 하면 어긋난다(F-1) */
    const a = st.cumN ? (st.cumA / st.cumN * 100).toFixed(1) : "0.0";
    const b = st.cumN ? (st.cumB / st.cumN * 100).toFixed(1) : "0.0";
    $("vSurf").textContent = "액체 속 " + a + " % · 표면 " + b + " %  (" + st.cumN + "번 누적)";
  }
}

/* ── 단계 전환 (표시 여부의 단일 원천) ───────────────────────── */
function applyStage() {
  const s = SHOW[st.stage];
  for (const id in s) {
    const el = $(id);
    if (el) el.style.display = s[id] ? SHOWVAL[id] : "none";
  }
  $("roSurf").style.display = (st.stage === 2 && st.loupe) ? SHOWVAL.roSurf : "none";
  $("stageTitle").textContent = TITLE[st.stage];
  $("stageDesc").textContent = DESC[st.stage];
  /* ⚠ 탭 3 의 안내 문구는 «지금 고른 가정»에 따라 달라져야 한다 — 고정하면 화면과 어긋난다(J-N5) */
  $("mainNote").innerHTML = st.stage === 3
    ? (gated() ? "먼저 위에서 <b>예측</b>을 고르세요. 고르기 전에는 결과를 보여 주지 않습니다."
      : st.model === "film1"
        ? "지금은 <b>「덮개가 나가는 것만 막는다」</b>고 가정한 결과입니다. 이 가정이 옳은지는 <b>프로그램이 아니라 실측</b>이 정합니다."
      : st.model === "film2"
        ? "<b>차단은 속도를 바꾸고, 평형을 바꾸지 않습니다.</b> 덮개를 많이 씌울수록 평형에 이르는 데 <b>오래 걸리지만</b>, 도달한 뒤의 압력은 같습니다."
        : "용질이 액체 <b>전체</b>에 퍼져 있을 때입니다. 덮개와 무관하게 <b>용매의 몰분율</b>만 압력을 정합니다.")
    : NOTE[st.stage];
  $("sideNote").textContent = SIDE[st.stage];
  for (const b of document.querySelectorAll(".stg"))
    b.setAttribute("aria-pressed", String(+b.dataset.stage === st.stage));
  const zb = $("zoomBtn"), sb = $("splitBtn");
  zb.setAttribute("aria-pressed", String(st.loupe));
  zb.textContent = st.loupe ? "돋보기 닫기" : "분자 수준으로 확대해 보기";
  sb.setAttribute("aria-pressed", String(st.loupe));
  sb.textContent = st.loupe ? "돋보기 닫기" : "표면을 확대해 보기";
  /* ⚠ 여기서 eqSince 를 지우지 않는다 — 돋보기를 켜고 끄는 것은 물리를 바꾸는 조작이 아니다 */
  drawStage(); drawGauge(); updateReadouts();
}

/* ── 루프 ─────────────────────────────────────────────────────── */
let raf = null, last = 0;
function frame(ts) {
  raf = requestAnimationFrame(frame);
  /* ⚠ dt 캡은 0.25 s 다. 0.05 로 두면 느린 기기(교실 태블릿·소프트웨어 렌더)에서 물리 시간이
     «화면 속도에 끌려가» 평형 도달이 늦어진다 — 프로브에서 실제로 잡혔다(6 s 에 71.4/71.7).
     stepN 은 지수 해라 dt 가 커도 정확하다. 캡은 탭 복귀 직후의 큰 점프만 막으면 된다. */
  const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0;
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
  drawStage();
  drawGauge();
  updateReadouts();
}
function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

/* ── 조작 배선 ───────────────────────────────────────────────── */
function bind() {
  for (const b of document.querySelectorAll(".stg")) b.addEventListener("click", () => {
    st.stage = +b.dataset.stage;
    st.loupe = false; st.eqSince = null;
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

  const toggleLoupe = () => { st.loupe = !st.loupe; applyStage(); };
  $("zoomBtn").addEventListener("click", toggleLoupe);
  $("splitBtn").addEventListener("click", toggleLoupe);

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
       화면에 그대로 재현되는 것을 먼저 보게 된다 — 상충 단계에서 상충이 사라진다. */
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
    applyStage();
  });

  /* 탭에서 벗어나면 rAF 를 멈추고, 돌아오면 «반드시» 되살린다 (복구 누락이 흔한 함정) */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLoop(); else startLoop();
  });
  window.addEventListener("resize", () => { drawStage(); drawGauge(); });
}

/* ── 시작 ─────────────────────────────────────────────────────── */
bind();
$("tVal").textContent = st.t + " ℃";
$("xsVal").textContent = st.xs.toFixed(3);
$("coverVal").textContent = Math.round(st.cover * 100) + " %";
st.nPure = 0; st.nSol = 0;
applyStage();
startLoop();
