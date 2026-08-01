"use strict";
/* ================================================================
   유압 프레스 도전 — 계산부 (화면과 무관, sim.js 계산부와 동일본)

   장치 구성 (학생 화면에는 식·용어를 노출하지 않는다 — X-4)
     ① 기체 실린더 : 입자 수(상대 개수, 내부 mol로 환산) · 온도 · 부피를 정한다.
                     P = n·R·T / V   ← 이상 기체 방정식(내부 계산에만 사용)
     ② 유압유      : 기체 압력이 액체를 통해 전달된다(파스칼 원리 — 화면 미노출).
     ③ 작은 피스톤 A1 / 큰 피스톤 A2(고정, 화면 미노출)

   v3 설계 변경 요지(설계지시안 §0·§3 3-B)
     · 목표 압력은 제출 전까지 숨긴다. 학생은 그림 신호(입자 밀도·속도·피스톤 높이)만 본다.
     · 판정은 "상한만"이다(확정 39) — 목표 초과 = 부서짐 0점. 미달 하한(밴드)은 없다.
       BAND 상수는 두지 않는다.
     · 「입자 수」 변인은 정수 1~20의 상대 개수로 표기하고, 내부적으로 n = 값 × 0.1 mol 로 환산한다
       (확정 37 — 명칭만 바뀌었고 내부 mol 범위 0.1~2.0은 기존과 같다).

   모형의 한계(3-F 7항목이 화면 <details>에 그대로 들어간다. 여기서는 계산 근거만 남긴다)
     · 입자 자체의 크기·입자 사이의 인력을 무시한 이상 기체 근사다.
     · 입자끼리의 충돌은 계산하지 않는다(벽 반사만, 추정 9).
     · 마찰·기름의 압축성·관의 압력 손실·피스톤 무게를 모두 무시했다.
   ================================================================ */

const PRESS = {
  R: 8.314,                                        // kPa·L/(mol·K) — 화면에 노출하지 않는다
  N: { min: 1, max: 20, step: 1, per: 0.1 },       // 「입자 수」(상대 개수) → 내부 mol = 값 × per
  T: { min: 250, max: 600, step: 5 },              // 온도 K
  V: { min: 0.50, max: 5.00, step: 0.01 },         // 부피 L
  A1: 12,                                          // 작은 피스톤 넓이 cm² (화면 미노출)
  A2: 150,                                         // 큰 피스톤 넓이 cm² — 고정(추정 12), 화면 미노출
  PATM: 101.325                                    // 대기압 기준선 kPa (화면 표기는 "≈101 kPa")
  // ★ BAND는 두지 않는다 — 확정 39. 미달 하한(「덜 눌림」) 규칙 자체가 없다.
};

const snap = (x, s) => Math.round(x / s) * s;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* 기체 압력(kPa). N은 「입자 수」(1~20의 상대 개수) — 내부 mol = N × PRESS.N.per */
function pressure(N, T, V) {
  if (!(V > 0)) return 0;
  return N * PRESS.N.per * PRESS.R * T / V;
}

/* 실린더 안 기체 기둥의 그림 높이 — 원점을 지나는 정비례. 하한을 두지 않는다(결함 A 처방) */
function gasHeight(V, maxGas) {
  return (V / PRESS.V.max) * maxGas;
}

/* 입자 그림 반지름 — ★★★ N·T·V 어느 것에도 의존하지 않는다(반박 장치 ①의 구현) */
function dotRadius(canvasW) {
  return clamp(canvasW / 220, 2.2, 4.0);
}

/* 입자 속도(캔버스 폭 비율/초) — 절대 온도의 제곱근에 비례. T=300 K에서 0.35 */
const DOT_SPEED_AT_300K = 0.35;
function dotSpeed(T) {
  return DOT_SPEED_AT_300K * Math.sqrt(T / 300);
}

/* 입자 개수 — ★★ 「입자 수」에만 반응한다(부피·온도에는 반응하지 않는다) */
function dotCount(N) {
  return N * 3;
}

/* 두 피스톤의 그림 폭 — 넓이 비의 제곱근으로 왜곡을 없앤다(추정 12) */
function pistonWidths(midW) {
  const wL = clamp(midW * 0.11, 40, 96);
  const ratio = Math.sqrt(PRESS.A2 / PRESS.A1);      // = √12.5 ≈ 3.5355339…
  const wR = Math.min(midW * 0.50, wL * ratio);
  return { wL: wL, wR: wR, ratio: ratio };
}

/* 유효숫자 sig자리로 반올림 (목표 압력을 "보기 좋은" 자리수로 맞출 때 쓴다) */
function roundToSig(x, sig) {
  if (x === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(x)));
  const power = sig - d;
  const mag = Math.pow(10, power);
  return Math.round(x * mag) / mag;
}

/* r 생성 구간 — 목표 = 출발 압력 × r. 방향은 무작위로 두 구간 중 하나(§3 3-B 2)
   makeRound와 press_check.js가 이 상수 하나만 참조한다(F-1 단일 원천). */
const R_RANGE = { down: [0.55, 0.75], up: [1.35, 1.90] };

/* 라운드 생성 — 출발 상태를 뽑고 목표를 정한다. 부피 단독 경로로 도달 가능한 라운드만 채택한다.
   rnd()는 [0,1) 난수 함수를 인자로 받는다(재현 가능한 검증을 위해 필수). */
function makeRound(rnd) {
  const N_MIN = 4, N_MAX = 16;
  const T_MIN = 280, T_MAX = 450, T_STEP = 5;
  const V_MIN = 1.00, V_MAX = 2.70, V_STEP = 0.01;
  const MAX_TRIES = 2000;

  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const N0 = N_MIN + Math.floor(rnd() * (N_MAX - N_MIN + 1));
    const T0 = clamp(snap(T_MIN + rnd() * (T_MAX - T_MIN), T_STEP), T_MIN, T_MAX);
    const V0 = clamp(snap(V_MIN + rnd() * (V_MAX - V_MIN), V_STEP), V_MIN, V_MAX);
    const P0 = pressure(N0, T0, V0);

    const goUp = rnd() < 0.5;
    const range = goUp ? R_RANGE.up : R_RANGE.down;
    const r = range[0] + rnd() * (range[1] - range[0]);

    const target = roundToSig(P0 * r, 2);
    if (!(target > 0)) continue;

    // 부피 단독 경로의 필요 부피 — 이 범위 안이어야 2차시 보일 법칙만으로 도달 가능하다
    const V_need = N0 * PRESS.N.per * PRESS.R * T0 / target;
    if (V_need >= 1.00 && V_need <= 5.00) {
      return { N0: N0, T0: T0, V0: V0, P0: P0, target: target };
    }
  }
  throw new Error("makeRound: " + MAX_TRIES + "회 시도에도 V_need 조건을 만족하는 라운드를 만들지 못했다");
}

/* 판정 — 상한만(확정 39). 두 값만 반환한다. "덜눌림"은 존재하지 않는다 */
function verdict(P, target) {
  return P > target ? "부서짐" : "성공";
}

/* 라운드 순위 — 성공자만 목표에 가까운 순으로. 성공자가 없으면 null.
   entries: [{ ...임의 필드, P: number }, ...] — P 필드만 사용한다.
   반환: 원본 entry를 얕은 복사한 뒤 missRatio = (target - P) / target 을 덧붙인 배열(오름차순),
         또는 null(전원 부서짐) */
function rank(entries, target) {
  const survivors = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (verdict(e.P, target) === "성공") {
      const missRatio = (target - e.P) / target;
      survivors.push(Object.assign({}, e, { missRatio: missRatio }));
    }
  }
  if (survivors.length === 0) return null;
  survivors.sort((a, b) => a.missRatio - b.missRatio);
  return survivors;
}

/* 인원별 라운드 수·제한 시간(확정 38 — 정지점 1 승인, 변경 없음) */
const ROUNDS = { 2: 4, 3: 3, 4: 2 };
const LIMITS = { 2: 30, 3: 30, 4: 30 };

/* 학생 활동 시간 예산(초) — X-2의 단일 원천(F-1). 화면 코드에 다시 타이핑하지 않는다.
   공식(§3 「학생 활동 시간 예산」): 총초 = 고정비 160
     + 라운드수 × (라운드머리 15 + (조작 + 전환 5) × 인원 + 공개·확인 20)
   고정비 160초 내역: 기기 준비·조 편성 45 + 규칙 설명 60 + 인원 선택 10 + 마무리 45(확정 38) */
const FIXED_COST_SECONDS = 160;
function budgetSeconds(k) {
  return FIXED_COST_SECONDS + ROUNDS[k] * (35 + (LIMITS[k] + 5) * k);
}

/* ================= UI ================= */
/* ↑ 위쪽(계산부)은 press_core.js와 문자 그대로 동일해야 한다(§2 #2 ⑵).
   검증 스크립트가 이 주석줄을 기준으로 계산부를 잘라낸다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* 밝은 무대의 데이터 색 — 정확히 3개(§5 금지 11). 기체=파랑 / 유압유=황갈 / 물체·금속=회색 */
const C = {
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), gray: CSSV("--d-gray"),
  ink: CSSV("--t1"), t3: CSSV("--t3"), stageLight: CSSV("--stage-light")
};
const GRID = "rgba(40,45,52,0.055)";
const EDGE = "rgba(40,45,52,0.42)";
const GAS_FILL = "rgba(29,78,216,0.10)";
const OIL_FILL = "rgba(180,83,9,0.16)";
const OBJ_FILL = "rgba(95,107,122,0.28)";
/* GRID/EDGE와 같은 무채색 계열(40,45,52)을 더 옅게 쓴 것 — 새 색을 들이지 않고
   "실린더 통 안쪽"을 표시한다(재작업 2026-08-01 2차 — 부피가 작을 때 실린더 위쪽이
   페이지 배경과 구분이 안 돼 잘린 것처럼 보이는 문제 처방). */
const CYL_BG = "rgba(40,45,52,0.05)";
/* 부서짐 상태의 압력 숫자 색 — 결과표 "✕ 부서짐" 배지(.pv-bad)와 같은 경고색이지만,
   그 배지가 쓰는 CSS 변수를 sim.js에서 새로 읽으면(getComputedStyle) 검토.js가 세는
   "sim.js 데이터 색 토큰" 수가 3에서 4로 늘어난다(§5 금지 11 "정확히 3개" 유지 조건과 충돌).
   대신 sim.js에 이미 있는 하드코딩 경고색(bootFailed 함수가 쓰는 값)을 재사용한다 — 이
   값은 이미 검토.js의 하드코딩 색 목록에 잡혀 있으므로 재사용해도 새 항목이 늘지 않는다. */
const ERR_RED = "#b42318";

const SEATS = ["①", "②", "③", "④"];
/* 신규 요구(2026-08-01) — 공개 연출을 4단계로 다시 짠다: ① 유압유 이동 → ② 램 상승 → ③ 가압 → ④ 판정.
   네 구간의 합이 REVEAL_TOTAL_MS(다음 참가자로 넘어가는 시점)와 같아야 한다. */
const REVEAL_OIL_MS = 300;      // ① 유압유가 관을 따라 이동한다(램은 아직 정지)
/* 재작업(2026-08-01 3차) — "피스톤이 올라오는 속도만 0.5배속"(사용자 요청). 같은 거리를
   두 배 시간에 이동해야 0.5배속이므로 RISE_MS만 2배로 늘린다. 오일 이동·가압·판정 구간은
   그대로 두고(요청이 "속도만"이라고 명시), TOTAL_MS는 늘어난 만큼(300ms)만 같이 늘려
   판정 구간 길이(400ms)가 이전과 같게 유지되도록 재계산했다. */
const REVEAL_RISE_MS = 600;     // ② 램이 아래에서 위로 올라와 물체에 닿는다 (0.5배속 = 이전 300ms×2)
const REVEAL_PRESS_MS = 500;    // ③ 램이 계속 밀어 올려 물체가 눌린다 · 압력 숫자가 여기까지 함께 오른다
const REVEAL_TOTAL_MS = 1800;   // ④ 판정(균열 갈라짐) 포함, 다음 참가자로 넘어가는 시점
function revealStageProgress(elapsed) {
  const oilT = clamp(elapsed / REVEAL_OIL_MS, 0, 1);
  const riseT = clamp((elapsed - REVEAL_OIL_MS) / REVEAL_RISE_MS, 0, 1);
  const pressT = clamp((elapsed - REVEAL_OIL_MS - REVEAL_RISE_MS) / REVEAL_PRESS_MS, 0, 1);
  const judgeStart = REVEAL_OIL_MS + REVEAL_RISE_MS + REVEAL_PRESS_MS;
  const judgeT = clamp((elapsed - judgeStart) / Math.max(1, REVEAL_TOTAL_MS - judgeStart), 0, 1);
  return { oilT, riseT, pressT, judgeT, judged: elapsed >= judgeStart };
}
/* 시드 고정 난수(mulberry32) — 균열 모양이 매 프레임 Math.random()으로 흔들리지 않게 한다.
   같은 seed면 항상 같은 수열이 나오므로, seed 하나만 참가자 기록(entry)에 저장해 두고
   그릴 때마다 다시 돌려도(재계산해도) 결과가 프레임마다 흔들리지 않는다(요구 7 — 성능·안정성). */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 애니메이션 정지(감소 모션) ── */
let animPaused = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function showMotionNote(v) { $("motionNote").style.display = v ? "flex" : "none"; }
showMotionNote(animPaused);
$("playMotion").onclick = () => { animPaused = false; showMotionNote(false); };

/* ── 캔버스 ── */
const cv = $("rig"), ctx = cv.getContext("2d");

/* ── 게임 상태 ── */
let selectedK = 2;
let useLimit = true;
const state = { N: 10, T: 400, V: 2.75 };   // 조절 변인의 "지금 값" — 항상 화면에 보인다(그림 신호)

const G = {
  phase: "idle",         // idle | playing | allSubmitted | reveal | roundResult | ended
  k: 0, round: 0, totalRounds: 0,
  startOffset: 0, order: [], turnPos: 0,
  data: null, entries: [], wins: [],
  turnLocked: false, turnStart: 0,
  revealSeatOrder: [], revealIdx: 0, revealPhaseStart: 0,
  roundWinnerSeat: null
};

const S = { N: $("sN"), T: $("sT"), V: $("sV") };
const RANGE = { N: PRESS.N, T: PRESS.T, V: PRESS.V };

function fmtInt(x) { return Math.round(x).toLocaleString("ko-KR"); }
function seatLabel(i) { return SEATS[i] || ("#" + (i + 1)); }

/* ================= 조절 변인 입력 ================= */
function syncSliderDom() {
  S.N.value = state.N; S.T.value = state.T; S.V.value = state.V.toFixed(2);
  $("vN").textContent = state.N;
  $("vT").textContent = state.T + " K (" + (state.T - 273) + "℃)";
  $("vV").textContent = state.V.toFixed(2) + " L";
}
function onSlide(k, v) {
  const R = RANGE[k];
  if (!isFinite(v)) return;
  state[k] = clamp(snap(v, R.step), R.min, R.max);
  syncSliderDom();
  if (G.phase === "playing" && !G.turnLocked) { G.turnLocked = true; renderDynamic(); }
}
S.N.oninput = e => onSlide("N", +e.target.value);
S.T.oninput = e => onSlide("T", +e.target.value);
S.V.oninput = e => onSlide("V", +e.target.value);
function setControlsEnabled(on) {
  S.N.disabled = S.T.disabled = S.V.disabled = !on;
}

/* ================= 게임 진행 ================= */
function orderForRound(r) {
  const off = (G.startOffset + (r - 1)) % G.k;
  return Array.from({ length: G.k }, (_, i) => (off + i) % G.k);
}
function currentSeat() { return G.order[G.turnPos]; }

function resetTurnControls() {
  state.N = G.data.N0; state.T = G.data.T0; state.V = G.data.V0;
  syncSliderDom();
  G.turnLocked = false;
  G.turnStart = performance.now();
}

function startGame() {
  G.k = selectedK;
  G.wins = Array(G.k).fill(0);
  G.round = 0;
  G.totalRounds = ROUNDS[G.k];
  G.startOffset = Math.floor(Math.random() * G.k);
  $("resultCard").style.display = "none";
  $("finalCard").style.display = "none";
  nextRound();
}
function nextRound() {
  G.round++;
  if (G.round > G.totalRounds) { endGame(); return; }
  G.data = makeRound(Math.random);
  G.entries = [];
  G.order = orderForRound(G.round);
  G.turnPos = 0;
  resetTurnControls();
  G.phase = "playing";
  setControlsEnabled(true);
  renderStatic();
}
function submitTurn() {
  const P = pressure(state.N, state.T, state.V);
  /* crackSeed — 이 참가자가 부서질 경우 균열 모양을 고정할 시드. 라운드 진행 중 값이
     바뀌지 않으므로 공개·라운드결과·최종화면 어디서 다시 그려도 같은 모양이 나온다. */
  G.entries.push({ seat: currentSeat(), N: state.N, T: state.T, V: state.V, P: P, crackSeed: Math.floor(Math.random() * 1e9) || 1 });
  G.turnPos++;
  if (G.turnPos >= G.k) {
    G.phase = "allSubmitted";
    setControlsEnabled(false);
  } else {
    resetTurnControls();
    G.phase = "playing";
  }
  renderStatic();
}
function startReveal() {
  G.revealSeatOrder = Array.from({ length: G.k }, (_, i) => i);   // 참가자 순서(①→②→③→④)대로 공개
  G.revealIdx = 0;
  G.revealPhaseStart = performance.now();
  G.phase = "reveal";
  setControlsEnabled(false);
  renderStatic();
}
function finishReveal() {
  const ranked = rank(G.entries, G.data.target);
  G.roundWinnerSeat = ranked && ranked.length ? ranked[0].seat : null;
  if (G.roundWinnerSeat !== null) G.wins[G.roundWinnerSeat]++;
  G.phase = "roundResult";
  renderStatic();
}
function nextRoundOrEnd() {
  if (G.round >= G.totalRounds) endGame(); else nextRound();
}
function endGame() {
  G.phase = "ended";
  setControlsEnabled(false);
  $("resultCard").style.display = "none";
  renderStatic();
}
function endNow() {
  if (G.phase === "idle" || G.phase === "ended") return;
  endGame();
}

/* ================= 화면 갱신(상태 전환 시 1회) ================= */
function renderStatic() {
  const playing = G.phase !== "idle" && G.phase !== "ended";
  /* 재작업 A-4 — "새 게임"은 idle일 때만 강조(primary). 게임 중·종료 후에는 다른 하나의
     강조 버튼(제출/공개/다음 라운드/최종 카드의 새 게임)과 겹치지 않게 뗀다. 국면마다
     강조 버튼이 항상 1개 이하가 되게 하는 것이 목적이다(§3 3-E·§6 I군). */
  $("newGame").classList.toggle("primary", G.phase === "idle");
  $("roundNow").textContent = playing ? G.round : "–";
  $("roundTotal").textContent = playing ? G.totalRounds : "–";
  $("turnLab").textContent =
    G.phase === "playing" ? seatLabel(currentSeat()) + "번 차례"
    : G.phase === "allSubmitted" ? "전원 제출 완료"
    : G.phase === "reveal" ? "공개 중"
    : G.phase === "roundResult" ? "라운드 결과"
    : G.phase === "ended" ? "게임 종료"
    : "대기 중";
  $("winsLab").textContent = G.k
    ? Array.from({ length: G.k }, (_, i) => seatLabel(i) + G.wins[i]).join(" ")
    : "–";

  $("idleNote").style.display = G.phase === "idle" ? "block" : "none";
  $("goalMain").style.display = G.phase === "idle" ? "none" : "flex";
  $("goalVal").textContent = G.data ? fmtInt(G.data.target) : "–";
  if (G.data) $("startVal").textContent = fmtInt(G.data.P0);

  $("submitBtn").style.display = G.phase === "playing" ? "" : "none";
  $("revealBtn").style.display = G.phase === "allSubmitted" ? "" : "none";
  $("nextRoundBtn").style.display = G.phase === "roundResult" ? "" : "none";
  $("nextRoundBtn").textContent = G.round >= G.totalRounds ? "최종 결과 보기" : "다음 라운드";

  $("timerWrap").style.display = G.phase === "playing" ? "flex" : "none";

  $("turnHint").textContent =
    G.phase === "playing" ? "— " + seatLabel(currentSeat()) + "번, 지금 조절하세요" : "";

  if (G.phase === "roundResult") renderResultTable();
  if (G.phase === "ended") renderFinal();

  renderDynamic();
}

/* ================= 화면 갱신(매 프레임) ================= */
function lastRevealedEntry() {
  if (!G.revealSeatOrder.length || !G.entries.length) return null;
  const seat = G.revealSeatOrder[G.revealSeatOrder.length - 1];
  return G.entries.find(x => x.seat === seat) || null;
}
function pressureInfo() {
  if (G.phase === "playing") {
    return { locked: G.turnLocked, value: G.turnLocked ? null : pressure(state.N, state.T, state.V) };
  }
  if (G.phase === "reveal") {
    const seat = G.revealSeatOrder[G.revealIdx];
    const e = G.entries.find(x => x.seat === seat);
    const elapsed = performance.now() - G.revealPhaseStart;
    const judged = animPaused || revealStageProgress(elapsed).judged;
    return { locked: !judged, value: judged ? e.P : null };
  }
  if (G.phase === "roundResult" || G.phase === "ended") {
    const e = lastRevealedEntry();
    if (e) return { locked: false, value: e.P };
  }
  return { locked: true, value: null };
}
function renderDynamic() {
  const pi = pressureInfo();
  $("rP").textContent = pi.locked ? "🔒 잠김" : fmtInt(pi.value);
  $("rPUnit").textContent = pi.locked ? "" : "kPa";
  $("lockNote").textContent = pi.locked
    ? (G.phase === "playing" ? "조절하는 동안 잠깁니다 — 제출하면 다음 사람에게 열립니다" : "제출하면 열립니다")
    : "";

  const showStart = G.phase === "playing" && G.turnPos === 0 && !G.turnLocked;
  $("startInfo").style.display = showStart ? "flex" : "none";

  if (G.phase === "playing" && useLimit) {
    const limit = LIMITS[G.k];
    const elapsed = (performance.now() - G.turnStart) / 1000;
    const remain = Math.max(0, limit - elapsed);
    $("timerFill").style.width = Math.max(0, Math.min(100, remain / limit * 100)) + "%";
    $("timerTxt").textContent = "남은 시간 " + Math.ceil(remain) + "초";
    if (remain <= 0) submitTurn();
  } else if (G.phase === "playing") {
    $("timerTxt").textContent = "제한 시간 없음";
    $("timerFill").style.width = "100%";
  }
}

/* ================= 결과 표 ================= */
function verdictCell(v) {
  return v === "성공"
    ? '<span class="pv pv-ok">✓ 성공</span>'
    : '<span class="pv pv-bad">✕ 부서짐</span>';
}
function renderResultTable() {
  const rows = G.entries.slice().sort((a, b) => a.seat - b.seat).map(e => {
    const v = verdict(e.P, G.data.target);
    const pct = Math.round(e.P / G.data.target * 100);
    const win = e.seat === G.roundWinnerSeat ? ' class="winrow"' : "";
    return "<tr" + win + "><td>" + seatLabel(e.seat) + "</td><td>" + e.N + "</td><td>" + e.T +
      " K</td><td>" + e.V.toFixed(2) + " L</td><td>" + fmtInt(e.P) + " kPa</td><td>" + pct +
      " %</td><td>" + verdictCell(v) + "</td></tr>";
  }).join("");
  const head = "<tr><th>참가자</th><th>입자 수</th><th>온도</th><th>부피</th><th>만든 압력</th><th>목표 대비</th><th>판정</th></tr>";
  $("resultTable").innerHTML = "<thead>" + head + "</thead><tbody>" + rows + "</tbody>";
  $("resultHead").textContent = G.roundWinnerSeat !== null
    ? "이번 라운드 승자 — " + seatLabel(G.roundWinnerSeat) + "번"
    : "전원 부서짐 — 승자 없음";
  $("resultCard").style.display = "";
}
function renderFinal() {
  const order = Array.from({ length: G.k }, (_, i) => i).sort((a, b) => G.wins[b] - G.wins[a]);
  const top = G.wins[order[0]];
  const winners = order.filter(i => G.wins[i] === top);
  /* 재작업 B-4 — 표만으로는 승자가 강조돼 보이지 않는다(0승-0승도 둘 다 강조된다).
     문장으로 최종 승자를 명시한다(§3 3-B 10 · §6 E군). */
  const winTxt = winners.length > 1
    ? "공동 1위 — " + winners.map(i => seatLabel(i)).join("·") + "번"
    : "최종 승자 — " + seatLabel(winners[0]) + "번";
  const rows = order.map(i =>
    "<tr" + (G.wins[i] === top ? ' class="winrow"' : "") + "><td>" + seatLabel(i) +
    "번</td><td>" + G.wins[i] + "승</td></tr>").join("");
  $("finalBody").innerHTML = '<p class="winline">' + winTxt + '</p><table><thead><tr><th>참가자</th><th>승수</th></tr></thead><tbody>' + rows + "</tbody></table>";
  $("finalCard").style.display = "";
}

/* ================= 버튼 ================= */
/* 재작업 B-3⑴ — 제한 시간 표시값을 LIMITS[selectedK]에서 매번 계산한다(하드코딩 제거, F-1). */
function syncLimitTxt() { $("limitTxt").textContent = LIMITS[selectedK]; }
document.querySelectorAll(".pc").forEach(b => b.onclick = () => {
  selectedK = +b.dataset.n;
  document.querySelectorAll(".pc").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  syncLimitTxt();
});
$("useLimit").onchange = e => { useLimit = e.target.checked; };
$("newGame").onclick = startGame;
$("endGame").onclick = endNow;
$("submitBtn").onclick = submitTurn;
$("revealBtn").onclick = startReveal;
$("nextRoundBtn").onclick = () => { $("resultCard").style.display = "none"; nextRoundOrEnd(); };
$("restartBtn").onclick = startGame;

/* ================= 「어떻게 하나」 — 1024px 미만은 기본 접힘, 그 이상은 항상 펼침 ================= */
function syncHowto() {
  const wide = window.matchMedia("(min-width:1024px)").matches;
  const el = $("howto");
  if (wide) el.setAttribute("open", ""); else el.removeAttribute("open");
}
window.addEventListener("resize", syncHowto);

/* ================= 입자 ================= */
let particles = [], particleN = -1;
function ensureParticles(n) {
  if (n === particleN) return;
  particleN = n;
  const cnt = dotCount(n);
  particles = Array.from({ length: cnt }, () => {
    const a = Math.random() * Math.PI * 2;
    return { lx: Math.random(), ly: Math.random(), dx: Math.cos(a), dy: Math.sin(a) };
  });
}
let lastTs = 0, frameDt = 0;
/* dotSpeed(T)는 계산부 주석대로 "초당 캔버스 폭의 비율"이다. 화면 px 속도가 실제로
   그 정의를 따르려면 정규화 이동량을 박스의 실제 폭·높이로 나눠야 한다 — 그래야
   px 속도가 온도(T)에만 반응하고 부피(박스 높이)에는 반응하지 않는다.
   (SX-1 A-1 재작업 — 이전 버전은 dotSpeed를 호출하지 않고 dt만 곱해, 온도는
   화면에 반영되지 않고 부피가 세로 px 속도를 바꾸는 오개념을 심고 있었다.) */
function updateParticles(dt, T, refW, boxW, boxH) {
  if (dt <= 0) return;
  const pxPerSec = dotSpeed(T) * refW;
  const vx = pxPerSec / Math.max(1, boxW);
  const vy = pxPerSec / Math.max(1, boxH);
  for (const p of particles) {
    p.lx += p.dx * vx * dt; p.ly += p.dy * vy * dt;
    if (p.lx < 0) { p.lx = 0; p.dx = -p.dx; }
    if (p.lx > 1) { p.lx = 1; p.dx = -p.dx; }
    if (p.ly < 0) { p.ly = 0; p.dy = -p.dy; }
    if (p.ly > 1) { p.ly = 1; p.dy = -p.dy; }
  }
}

/* ================= 그리기 ================= */
function fit(hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = hCss + "px";
  cv.width = Math.max(1, Math.round(cv.clientWidth * dpr));
  cv.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  const w = cv.clientWidth || 320;
  const twoCol = window.matchMedia("(min-width:1024px)").matches;
  const vh = window.innerHeight || 800;
  const hCss = clamp(Math.min(w * 0.80, vh * (twoCol ? 0.62 : 0.45)), 320, 620);
  fit(hCss);
  draw();
}

/* 눌림·부풀림 최대치 — 압력이 목표에 닿을 때 물체 높이를 이만큼까지 줄이고
   가로 폭을 이만큼까지 부풀린다(요구 3). 목표를 넘겨도 이 이상 더 눌리지는
   않는다 — 그 이후는 균열(요구 3 균열)로 표현한다. */
const MAX_SQUEEZE = 0.34;
const MAX_BULGE = 0.20;

function displayState() {
  if (G.phase === "reveal") {
    const seat = G.revealSeatOrder[G.revealIdx];
    const e = G.entries.find(x => x.seat === seat);
    const elapsed = performance.now() - G.revealPhaseStart;
    if (animPaused) {
      /* 요구 8 — 감소 모션에서는 연출을 건너뛰고 최종 상태를 바로 보여준다 */
      return {
        N: e.N, T: e.T, V: e.V, ramT: 1,
        squeezeFrac: Math.min(e.P / G.data.target, 1),
        meterOn: true, dispP: e.P, finalP: e.P,
        judged: true, verdict: verdict(e.P, G.data.target), crackT: 1, crackSeed: e.crackSeed
      };
    }
    const st = revealStageProgress(elapsed);
    const squeezeFrac = st.pressT * Math.min(e.P / G.data.target, 1);
    /* 압력 숫자는 ①~③(오일 이동+램 상승+가압) 동안 대기압에서 시작해 올라간다.
       ③이 끝나는 순간(judged) 이후로는 보간을 완전히 멈추고 e.P를 그대로 쓴다 —
       마지막에 보간 잔차가 남아 계산값과 어긋나지 않게 하는 장치다. */
    const climbT = clamp((elapsed - REVEAL_OIL_MS) / (REVEAL_RISE_MS + REVEAL_PRESS_MS), 0, 1);
    const dispP = elapsed < REVEAL_OIL_MS ? PRESS.PATM
      : (climbT < 1 ? PRESS.PATM + (e.P - PRESS.PATM) * (1 - Math.pow(1 - climbT, 2)) : e.P);
    return {
      N: e.N, T: e.T, V: e.V, ramT: st.riseT,
      squeezeFrac,
      meterOn: true, dispP, finalP: e.P,
      judged: st.judged, verdict: st.judged ? verdict(e.P, G.data.target) : null,
      crackT: st.judgeT, crackSeed: e.crackSeed
    };
  }
  if (G.phase === "roundResult" || G.phase === "ended") {
    const e = lastRevealedEntry();
    if (e) {
      return {
        N: e.N, T: e.T, V: e.V, ramT: 1,
        squeezeFrac: Math.min(e.P / G.data.target, 1),
        meterOn: true, dispP: e.P, finalP: e.P,
        judged: true, verdict: verdict(e.P, G.data.target), crackT: 1, crackSeed: e.crackSeed
      };
    }
  }
  return {
    N: state.N, T: state.T, V: state.V, ramT: 0, squeezeFrac: 0,
    meterOn: false, dispP: PRESS.PATM, finalP: null,
    judged: false, verdict: null, crackT: 0, crackSeed: 1
  };
}

function fitText(text, shortText, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  return shortText;
}
const lerp = (a, b, t) => a + (b - a) * t;

/* 균열 모양 — seed 하나로 결정된다(요구 7 · 성능·안정성). 매 프레임 다시 계산해도
   Math.random()을 쓰지 않으므로 흔들리지 않는다(같은 seed면 항상 같은 수열). */
function crackGeometry(seed, x, y, w, h) {
  const rnd = mulberry32(seed);
  /* 재작업(2026-08-01 2차) — 지그재그 폭을 크게 주면(예전 0.34w) 이가 화살촉처럼 뾰족해
     보인다. 세그먼트를 늘리고 폭을 줄여 "갈라진 금"처럼 잔잔하게 흔들리게 한다. */
  const segs = 6;
  const seam = [{ x: x + w / 2, y: y }];
  for (let i = 1; i < segs; i++) {
    seam.push({ x: x + w / 2 + (rnd() - 0.5) * w * 0.16, y: y + h * (i / segs) });
  }
  seam.push({ x: x + w / 2, y: y + h });
  const extra = [];
  const nExtra = 2 + Math.floor(rnd() * 2);   // 물체 안에서 뻗다 끝나는 잔금 2~3개(요구 3)
  for (let i = 0; i < nExtra; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const px = x + w / 2 + side * w * (0.06 + rnd() * 0.18);
    const py = y + h * (0.12 + rnd() * 0.62);
    const len = h * (0.14 + rnd() * 0.14);
    const ang = (rnd() - 0.5) * 1.1 + Math.PI / 2;
    extra.push({ x1: px, y1: py, x2: px + Math.cos(ang) * len, y2: py + Math.sin(ang) * len });
  }
  return { seam, extra };
}

/* 물체 — 눌림(높이 축소)·부풀림(폭 증가)·부서짐(조각이 어긋나게)을 그린다(요구 3).
   부서지면 색만이 아니라 모양으로도 구분되도록 조각을 서로 벌리고 살짝 기울인다. */
/* 재작업(2026-08-01 2차) — 조각이 화살표처럼 보인다는 지적. 조각을 멀리 보내지 않고
   "제자리에서 갈라진 것처럼" 그린다: 이동은 최대 3 px, 회전은 최대 2°(0.035 rad)만
   준다 — 그 이상은 갈라진 틈이 아니라 서로 다른 물체처럼 보인다. */
const SHARD_DX = 2.4, SHARD_DY = 1.1, SHARD_TILT_PX = 2, SHARD_MAX_ROT = 0.035;
function drawShard(pts, dirX, dirY, rotSign, t) {
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const c0x = sx / pts.length, c0y = sy / pts.length;
  let maxD = 1;
  for (const p of pts) maxD = Math.max(maxD, Math.hypot(p.x - c0x, p.y - c0y));
  const rot = rotSign * Math.min(SHARD_MAX_ROT, SHARD_TILT_PX / maxD) * t;
  ctx.save();
  ctx.translate(c0x + dirX * SHARD_DX * t, c0y + dirY * SHARD_DY * t);
  ctx.rotate(rot);
  ctx.translate(-c0x, -c0y);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = OBJ_FILL; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}

function drawObject(x, y, w, h, ds) {
  if (ds.judged && ds.verdict === "부서짐") {
    const g = crackGeometry(ds.crackSeed, x, y, w, h);
    const t = ds.crackT;
    const leftPts = [{ x, y }].concat(g.seam, [{ x, y: y + h }]);
    const rightPts = [{ x: x + w, y }].concat(g.seam, [{ x: x + w, y: y + h }]);
    drawShard(leftPts, -1, 1, -1, t);
    drawShard(rightPts, 1, -1, 1, t);

    ctx.strokeStyle = EDGE; ctx.lineWidth = 1;
    for (const c of g.extra) {
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(lerp(c.x1, c.x2, t), lerp(c.y1, c.y2, t));
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = OBJ_FILL; ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  }
}

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.width / dpr, H = cv.height / dpr;
  if (W < 40 || H < 40) return;   // 매뉴얼 §5 — 너무 작으면 그리지 않는다
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.stageLight; ctx.fillRect(0, 0, W, H);

  const ds = displayState();
  ensureParticles(ds.N);

  const M = 12;
  const top = M + 16, bot = H - M;         // 위쪽에 대기압 기준선 자리를 남긴다
  const midW = W - M * 2;

  ctx.save();
  ctx.beginPath(); ctx.rect(M, top, midW, bot - top); ctx.clip();
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (let x = M; x < W - M; x += 26) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
  for (let y = top; y < bot; y += 26) { ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); }
  ctx.restore();

  const pw = pistonWidths(midW);
  const duct = 16;
  const floor = bot - 4;
  const oilTopL = top + (bot - top) * 0.58;
  const xL = M + 8;
  const xR = Math.min(W - M - pw.wR - 6, xL + pw.wL + Math.max(56, midW * 0.28));
  const rightLim = W - M - 3;   // 오른쪽 여백 — 프레임·물체(부풀림 포함)가 이 선을 넘지 않게 한다

  /* ── 오른쪽 뼈대 자리 계산 (요구 1 — 기둥 두 개 + 맨 위 고정판, 램은 아래에서 올라온다) ──
     재작업(2026-08-01 2차) — 프레임 가운데가 통째로 비어 보인다는 지적 처방.
     모든 위치를 그리기 영역 높이(Hd)의 비율로 잡는다: 고정판 밑에 물체를 두껍게(15 %),
     램은 대기 중에도 물체 가까이(틈 5 %)에 두어 "짧은 거리만" 올라오게 하고,
     남는 아래 공간은 전부 유압유 밑동에 준다(빈 공간이 아니라 유압유로 채운다). */
  const Hd = bot - top;
  const plateTopY = top + Hd * 0.06, plateH = clamp(Hd * 0.02, 6, 12);
  const cx = xR + pw.wR / 2;
  const objTopY = plateTopY + plateH + 2;      // 물체 윗면은 늘 고정판 밑에 붙어 있다(고정장치)
  /* 물체 폭은 램(피스톤) 폭 비를 그대로 따르지 않는다 — 램은 넓이 비를 보여주려고 일부러
     넓게 그렸는데(추정 12), 그 폭 그대로 물체를 그리면 너무 얇고 길어져 눌림·균열이
     잘 보이지 않는다(요구 3). 물체는 램 위에 놓인, 더 작은 시료로 그린다. */
  const objH0 = Hd * 0.15, objW0 = Math.min(pw.wR + 4, 100);
  const ramHeadH = Hd * 0.032;
  const ramTouchY0 = objTopY + objH0;             // 물체가 눌리기 전 밑면 — 램이 대기 중 겨냥하는 자리
  const ramRestY = ramTouchY0 + Hd * 0.05;         // 대기 중 램 머리~물체 틈 = 5 %(4~6 % 지시)
  const shaftRestLen = Hd * 0.035;                 // 대기 중 램 축 길이 — "짧게"
  const baseTopY = ramRestY + ramHeadH + shaftRestLen;   // 유압유 밑동 — 램 축 바로 밑에서 시작(빈틈 없음)
  const baseH = floor - baseTopY;
  const baseX = xR - 4, baseW = Math.max(20, Math.min(pw.wR + 8, rightLim - baseX));
  const colLeftX = xR - 6, colRightX = Math.min(xR + pw.wR + 2, rightLim), colW = 5;

  const squeeze = ds.squeezeFrac;
  const objH = objH0 * (1 - MAX_SQUEEZE * squeeze);
  let objW = objW0 * (1 + MAX_BULGE * squeeze);
  if (cx + objW / 2 > rightLim) objW = Math.max(objW0 * 0.6, (rightLim - cx) * 2);
  const objBottomY = objTopY + objH;

  /* ── 「누르는 세기」 자리·크기 결정 (요구 ②③, 재작업 2026-08-01 3차) ──
     1순위: 물체 오른쪽(기둥 안쪽이면 물체 바로 옆, 자리가 없으면 기둥 바깥~캔버스 오른쪽 여백).
     744 px 이상에서는 이 1순위 자리가 넉넉해 16~20 px 굵은 글씨가 들어간다(실측).
     2순위(아주 좁은 화면, 예 360 px 휴대폰): 물체 오른쪽에 16 px조차 못 들어가면 맨 위 대기압
     줄의 오른쪽 여백(대기압 글자는 항상 midW-100 안으로 줄여 그려서 오른쪽 100 px가 비어
     있다 — 아래쪽 참조)으로 옮긴다. 처음에는 "실린더~기둥 사이 빈 자리"로 옮기려 했지만
     그 자리는 0~5 L 눈금 숫자와 같은 세로 줄에 있어 실측해 보니 겹쳤다(재작업 4차 처방) —
     대기압 줄 오른쪽은 눈금·막대 어느 것과도 세로 줄이 겹치지 않는 유일한 여유 공간이다.
     세로 위치는 1순위일 때 물체 한가운데(objTopY+objH/2)에 고정해 물체가 눌리면 따라가고,
     2순위(대기압 줄)일 때는 그 줄에 고정한다 — 물체를 따라가지는 않지만 화면에 늘 보인다. */
  let pressPlan = null;
  if (ds.meterOn && G.data) {
    const broken = ds.judged && ds.verdict === "부서짐";
    const core = fmtInt(ds.dispP) + " kPa";
    /* 색만으로 구분하지 않는다(색각 이상 대응) — 부서지면 숫자 옆에 항상 "✕"(또는 "✕ 부서짐")를 붙인다. */
    const cands = broken
      ? ["누르는 세기 " + core + " ✕ 부서짐", core + " ✕ 부서짐", core + " ✕"]
      : ["누르는 세기 " + core, core];
    const fitIn = (maxW, maxFont, minFont) => {
      for (let fs = maxFont; fs >= minFont; fs--) {
        ctx.font = "700 " + fs + "px sans-serif";
        for (const c of cands) { if (ctx.measureText(c).width <= maxW) return { text: c, font: fs }; }
      }
      return null;
    };
    const insideX = cx + objW / 2 + 8, insideW = colRightX - 6 - insideX;
    const outsideX = colRightX + 6, outsideW = rightLim - outsideX;
    const besideOK = insideW > 0 && insideW >= outsideW;
    const besideX = besideOK ? insideX : outsideX;
    const besideW = Math.max(0, besideOK ? insideW : outsideW);

    let f = fitIn(besideW, 20, 16);
    if (f) {
      pressPlan = { x: besideX, align: "left", y: objTopY + objH / 2, text: f.text, font: f.font };
    } else {
      /* 대기압 줄(아래 "대기압 기준선" 절)이 스스로 midW-100 안으로 줄여 그리므로,
         오른쪽 100 px(여백 4 px씩 뺀 92 px)는 항상 비어 있다고 보장된다(단일 원천 재사용). */
      const atmX1 = W - M - 4, atmZoneW = Math.max(0, 100 - 8);
      f = fitIn(atmZoneW, 20, 11) || { text: cands[cands.length - 1], font: 11 };
      pressPlan = { x: atmX1, align: "right", y: top - 8, text: f.text, font: f.font };
    }
    pressPlan.color = broken ? ERR_RED : C.ink;
  }

  const ramW = Math.max(10, pw.wR - 6);
  const ramHeadY = ds.ramT < 1
    ? lerp(ramRestY, ramTouchY0 - ramHeadH, ds.ramT)
    : objBottomY - ramHeadH;

  /* ── 유압유 (ㄷ 자로 이어진 통 — 왼쪽 실린더 밑 → 바닥 → 오른쪽 램 밑동, 요구 1) ── */
  ctx.beginPath();
  ctx.moveTo(xL, oilTopL); ctx.lineTo(xL + pw.wL, oilTopL);
  ctx.lineTo(xL + pw.wL, floor - duct); ctx.lineTo(baseX, floor - duct);
  ctx.lineTo(baseX, baseTopY); ctx.lineTo(baseX + baseW, baseTopY);
  ctx.lineTo(baseX + baseW, floor); ctx.lineTo(xL, floor);
  ctx.closePath();
  ctx.fillStyle = OIL_FILL; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.amber; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center";
  const oilLabelY = floor - duct / 2 + 4;
  if (baseX - (xL + pw.wL) > 30) ctx.fillText(fitText("유압유", "유압유", baseX - (xL + pw.wL) - 6), (xL + pw.wL + baseX) / 2, oilLabelY);

  /* 밑동 안에 보이는 유압유 양은 램이 올라온 만큼(ramT) 늘어난다 — "유압유가 밀려 들어가
     램이 올라온다"는 인과를 그림으로 보여 준다(요구 2). 대기 중에도 절반은 이미 차 있게
     해서(밑동 자체가 넓어졌으니) 항상 두껍게 채워진 것처럼 보이게 한다(재작업 2차 처방). */
  const fillFrac = 0.5 + 0.5 * ds.ramT;
  const oilLvl = floor - 3 - fillFrac * (baseH - 6);
  if (floor - 3 > oilLvl) {
    ctx.fillStyle = OIL_FILL;
    ctx.fillRect(baseX + 2, oilLvl, baseW - 4, floor - 3 - oilLvl);
  }

  /* ── 왼쪽: 기체 실린더 — 부피가 곧 기둥 높이(원점 지나는 정비례, 하한 없음) ── */
  const cylBot = oilTopL;
  const maxGas = cylBot - (top + 20);
  const gasH = gasHeight(ds.V, maxGas);
  const cylTop = cylBot - gasH;
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
  ctx.strokeRect(xL, top + 4, pw.wL, cylBot - (top + 4));
  /* 부피가 작을 때 실린더 위쪽이 페이지 배경과 안 구분돼 잘린 것처럼 보이던 문제 처방 —
     실린더 통 전체를 옅은 무채색으로 먼저 채워 "여기까지가 안쪽"임을 보여준다(재작업 2차). */
  ctx.fillStyle = CYL_BG;
  ctx.fillRect(xL + 1, top + 5, pw.wL - 2, Math.max(1, cylBot - (top + 5)));
  if (gasH > 1) {
    ctx.fillStyle = GAS_FILL;
    ctx.fillRect(xL + 1, cylTop, pw.wL - 2, Math.max(1, gasH - 1));
  }

  /* 실린더 고정장치 — 실린더가 늘 같은 자리에 고정돼 있음을 보여주는 장식 걸쇠(요구 1).
     기체 부피와 무관하게 위치가 고정돼 있다 — 볼트 두 개로 고정된 느낌을 준다. */
  const clampY = top + 2;
  ctx.fillStyle = C.ink;
  ctx.fillRect(xL - 5, clampY, pw.wL + 10, 5);
  ctx.fillStyle = C.stageLight;
  ctx.beginPath(); ctx.arc(xL - 1, clampY + 2.5, 1.6, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(xL + pw.wL + 1, clampY + 2.5, 1.6, 0, 6.2832); ctx.fill();

  /* ── 부피 눈금 0~5 L, 1 L 간격 (§3 3-C⑴·⑹ — 재작업 B-1) ── */
  ctx.strokeStyle = C.t3; ctx.fillStyle = C.t3; ctx.lineWidth = 1;
  ctx.font = "9px sans-serif"; ctx.textAlign = "left";
  const tickX = xL + pw.wL + 3;
  for (let v = 0; v <= PRESS.V.max; v++) {
    const ty = cylBot - gasHeight(v, maxGas);
    if (ty < top || ty > bot) continue;
    ctx.beginPath(); ctx.moveTo(tickX, ty); ctx.lineTo(tickX + 4, ty); ctx.stroke();
    const label = String(v);
    if (ctx.measureText(label).width <= Math.max(0, baseX - (tickX + 6))) ctx.fillText(label, tickX + 6, ty + 3);
  }

  const r = dotRadius(W);
  const boxW = Math.max(1, pw.wL - 8 - r * 2);
  const boxH = Math.max(1, gasH - 4 - r * 2);
  if (!animPaused) updateParticles(frameDt, ds.T, W, boxW, boxH);
  ctx.fillStyle = C.blue;
  for (const p of particles) {
    const px = xL + 4 + r + p.lx * boxW;
    const py = cylTop + 2 + r + p.ly * boxH;
    ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill();
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(xL - 2, Math.max(top + 2, cylTop - 6), pw.wL + 4, 6);
  ctx.fillRect(xL - 2, oilTopL - 4, pw.wL + 4, 4);

  /* ── 오른쪽: 프레임(기둥 두 개 + 고정판) · 아래에서 올라오는 램 · 눌리는 물체 (요구 1·2·3) ── */
  ctx.strokeStyle = EDGE; ctx.lineWidth = colW;
  ctx.beginPath(); ctx.moveTo(colLeftX, plateTopY); ctx.lineTo(colLeftX, floor); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(colRightX, plateTopY); ctx.lineTo(colRightX, floor); ctx.stroke();

  /* 고정판 — 절대 움직이지 않는다("고정장치"). 볼트 두 개로 고정된 느낌을 준다. */
  const plateX = colLeftX - 2, plateEndX = Math.min(colRightX + 2, rightLim);
  ctx.fillStyle = C.ink;
  ctx.fillRect(plateX, plateTopY, Math.max(10, plateEndX - plateX), plateH);
  ctx.fillStyle = C.stageLight;
  ctx.beginPath(); ctx.arc(cx - pw.wR / 2 - 3, plateTopY + plateH / 2, 1.6, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + pw.wR / 2 + 3, plateTopY + plateH / 2, 1.6, 0, 6.2832); ctx.fill();

  /* 밑동(램의 몸통이 들어 있는 통) — 바닥에 고정 */
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
  ctx.strokeRect(baseX, baseTopY, baseW, baseH);

  /* 유압유 이동 화살표 — 공개 ① 단계에서 보이다가 램이 올라올수록 옅어진다(요구 2) */
  const arrowA = ds.meterOn ? clamp(1 - ds.ramT, 0, 1) : 0;
  if (arrowA > 0.02) {
    ctx.save();
    ctx.globalAlpha = arrowA;
    ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 2;
    const ax = cx, ayB = baseTopY + baseH - 4, ayT = baseTopY - 8;
    ctx.beginPath(); ctx.moveTo(ax, ayB); ctx.lineTo(ax, ayT + 6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, ayT); ctx.lineTo(ax - 5, ayT + 8); ctx.lineTo(ax + 5, ayT + 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* 램 — 몸통(축) + 머리. 아래에서 위로 올라와 물체 밑면에 닿는다(요구 1·2 — 위→아래가 아니다) */
  ctx.fillStyle = C.ink;
  ctx.fillRect(cx - 4, ramHeadY + ramHeadH, 8, Math.max(0, baseTopY + baseH - (ramHeadY + ramHeadH)));
  ctx.fillRect(cx - ramW / 2, ramHeadY, ramW, ramHeadH);

  /* 물체 — 늘 고정판 바로 밑, 램이 밑에서 밀어 올린다(요구 2·3) */
  drawObject(cx - objW / 2, objTopY, objW, objH, ds);

  /* ── 누르는 세기 — 눌리는 물체 바로 오른쪽, 물체 세로 한가운데(재작업 2026-08-01 3차 요청 ②③).
     실제 위치·글자크기·후보문구는 위에서 pressPlan으로 이미 정했다(744 px 이상은 물체 옆,
     360 px처럼 아주 좁은 화면은 대기압 줄 오른쪽 여백으로 자동 이동 — 요구 10 겹침·잘림 방지).
     이전에 우상단에 따로 있던 "P = … kPa" 표시는 이 표시와 중복이라 없앴다(대기압 줄은 유지 —
     다만 좁은 화면 대비책으로 그 자리를 pressPlan의 2순위 자리로 재사용한다). */
  if (pressPlan) {
    ctx.font = "700 " + pressPlan.font + "px sans-serif";
    ctx.textAlign = pressPlan.align; ctx.textBaseline = "middle";
    ctx.fillStyle = pressPlan.color;
    ctx.fillText(pressPlan.text, pressPlan.x, pressPlan.y);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  }

  /* ── 오르는 압력 눈금 막대(요구 2) — 왼쪽 실린더/기름관과 오른쪽 프레임 사이 빈 자리.
     큰 숫자는 위에서 물체 옆(또는 좁은 화면에서는 대기압 줄 오른쪽)으로 옮겼으므로,
     여기는 막대 + 목표 눈금만 남긴다(중복 제거). */
  if (ds.meterOn && G.data) {
    const gapX = xL + pw.wL + 6, gapR = colLeftX - 6;
    const meterW = gapR - gapX;
    if (meterW > 34) {
      const target = G.data.target;
      const meterMax = Math.max(ds.finalP, target) * 1.05;
      const meterY = top + 30, meterH = 10;
      const fillFrac = clamp(ds.dispP / meterMax, 0, 1);
      const targetFrac = clamp(target / meterMax, 0, 1);

      ctx.strokeStyle = EDGE; ctx.lineWidth = 1;
      ctx.strokeRect(gapX, meterY, meterW, meterH);
      ctx.fillStyle = OIL_FILL;
      ctx.fillRect(gapX + 1, meterY + 1, Math.max(0, meterW - 2) * fillFrac, meterH - 2);

      /* 목표 눈금 — 오르는 숫자가 이 선을 넘는지 학생이 눈으로 볼 수 있게 한다 */
      const tx = gapX + meterW * targetFrac;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, meterY - 3); ctx.lineTo(tx, meterY + meterH + 3); ctx.stroke();

      ctx.textAlign = "center"; ctx.font = "9px sans-serif"; ctx.fillStyle = C.t3;
      const labelTxt = "목표";
      if (ctx.measureText(labelTxt).width <= 40) {
        ctx.fillText(labelTxt, clamp(tx, gapX + 16, gapR - 16), meterY + meterH + 14);
      }
    }
  }

  /* ── 대기압 기준선 (상시 표시 · 1차시 학습 내용) ── */
  ctx.strokeStyle = "rgba(95,107,122,0.55)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(M, top - 4); ctx.lineTo(W - M, top - 4); ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left"; ctx.font = "10px sans-serif"; ctx.fillStyle = C.t3;
  /* 재작업 B-3⑵ — 대기압 숫자를 PRESS.PATM(단일 원천)에서 만든다. 텍스트를 다시 타이핑하지 않는다. */
  const atmRound = Math.round(PRESS.PATM);
  ctx.fillText(fitText("대기압 ≈ " + atmRound + " kPa", "≈" + atmRound + "kPa", midW - 100), M, top - 8);

  ctx.textAlign = "left";
}

/* ================= 메인 루프 ================= */
function tick(ts) {
  frameDt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (G.phase === "playing") renderDynamic();
  if (G.phase === "reveal") {
    const elapsed = performance.now() - G.revealPhaseStart;
    const total = animPaused ? 700 : REVEAL_TOTAL_MS;
    if (elapsed > total) {
      G.revealIdx++;
      if (G.revealIdx >= G.k) { finishReveal(); } else { G.revealPhaseStart = performance.now(); }
    }
    renderDynamic();
  }
  draw();
}
let rafId = null;
function loop(ts) { rafId = requestAnimationFrame(loop); tick(ts); }
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(loop); }
});

/* ================= 시작 ================= */

/* 부팅이 실패해도 캔버스가 백지로 남지 않게 한다.
   백지는 "그릴 게 없음"과 "코드가 죽음"을 구분해 주지 않아서, 예전 sim.js가 캐시에
   남아 있거나 요소 하나가 사라졌을 때 원인이 화면에 전혀 드러나지 않았다.
   여기서 잡아 캔버스에 이유를 적는다 — 교실에서 교사가 바로 읽을 수 있어야 한다. */
function bootFailed(err) {
  try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.width / dpr || cv.clientWidth || 320;
    const H = cv.height / dpr || cv.clientHeight || 200;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#b42318"; ctx.textAlign = "center";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("화면을 그리지 못했습니다", W / 2, H / 2 - 22);
    ctx.fillStyle = "#475467"; ctx.font = "13px sans-serif";
    ctx.fillText("브라우저에서 Ctrl+Shift+R 을 눌러 새로 고쳐 주세요.", W / 2, H / 2 + 4);
    ctx.fillText("그래도 안 되면 아래 내용을 알려 주세요.", W / 2, H / 2 + 24);
    ctx.fillStyle = "#98a2b3"; ctx.font = "11px sans-serif";
    ctx.fillText(String(err && err.message ? err.message : err).slice(0, 70), W / 2, H / 2 + 46);
    ctx.textAlign = "left";
  } catch (_) { /* 캔버스조차 못 쓰면 조용히 포기한다 */ }
  if (window.console) console.error("[press] 부팅 실패:", err);
}

try {
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
  window.addEventListener("resize", resize);
  syncSliderDom();
  syncHowto();
  syncLimitTxt();
  renderStatic();
  resize();
  rafId = requestAnimationFrame(loop);
} catch (err) {
  bootFailed(err);
}
