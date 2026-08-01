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

const SEATS = ["①", "②", "③", "④"];
const REVEAL_LATCH_MS = 260;     // 걸쇠가 열리는 시점
const REVEAL_SHOW_MS = 520;      // 압력·판정이 드러나는 시점
const REVEAL_TOTAL_MS = 1500;    // 다음 참가자로 넘어가는 시점

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
  G.entries.push({ seat: currentSeat(), N: state.N, T: state.T, V: state.V, P: P });
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
    const shown = elapsed > REVEAL_SHOW_MS || animPaused;
    return { locked: !shown, value: shown ? e.P : null };
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

function displayState() {
  if (G.phase === "reveal") {
    const seat = G.revealSeatOrder[G.revealIdx];
    const e = G.entries.find(x => x.seat === seat);
    const elapsed = performance.now() - G.revealPhaseStart;
    return {
      N: e.N, T: e.T, V: e.V,
      latched: elapsed < REVEAL_LATCH_MS && !animPaused,
      pistonT: animPaused ? 1 : clamp((elapsed - REVEAL_LATCH_MS) / (REVEAL_TOTAL_MS - REVEAL_LATCH_MS - 200), 0, 1),
      shown: elapsed > REVEAL_SHOW_MS || animPaused,
      verdict: (elapsed > REVEAL_SHOW_MS || animPaused) ? verdict(e.P, G.data.target) : null
    };
  }
  if (G.phase === "roundResult" || G.phase === "ended") {
    const e = lastRevealedEntry();
    if (e) return { N: e.N, T: e.T, V: e.V, latched: false, pistonT: 1, shown: true, verdict: verdict(e.P, G.data.target) };
  }
  return { N: state.N, T: state.T, V: state.V, latched: G.phase === "playing" || G.phase === "allSubmitted", pistonT: 0, shown: false, verdict: null };
}

function fitText(text, shortText, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  return shortText;
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
  const oilTopR = top + (bot - top) * 0.50;
  const xL = M + 8;
  const xR = Math.min(W - M - pw.wR - 6, xL + pw.wL + Math.max(56, midW * 0.28));

  /* ── 유압유 (ㄷ 자로 이어진 통 — 끊긴 두 기둥으로 그리지 않는다) ── */
  ctx.beginPath();
  ctx.moveTo(xL, oilTopL); ctx.lineTo(xL + pw.wL, oilTopL);
  ctx.lineTo(xL + pw.wL, floor - duct); ctx.lineTo(xR, floor - duct);
  ctx.lineTo(xR, oilTopR); ctx.lineTo(xR + pw.wR, oilTopR);
  ctx.lineTo(xR + pw.wR, floor); ctx.lineTo(xL, floor);
  ctx.closePath();
  ctx.fillStyle = OIL_FILL; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.amber; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center";
  const oilLabelY = floor - duct / 2 + 4;
  if (xR - (xL + pw.wL) > 30) ctx.fillText(fitText("유압유", "유압유", xR - (xL + pw.wL) - 6), (xL + pw.wL + xR) / 2, oilLabelY);

  /* ── 왼쪽: 기체 실린더 — 부피가 곧 기둥 높이(원점 지나는 정비례, 하한 없음) ── */
  const cylBot = oilTopL;
  const maxGas = cylBot - (top + 20);
  const gasH = gasHeight(ds.V, maxGas);
  const cylTop = cylBot - gasH;
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
  ctx.strokeRect(xL, top + 4, pw.wL, cylBot - (top + 4));
  if (gasH > 1) {
    ctx.fillStyle = GAS_FILL;
    ctx.fillRect(xL + 1, cylTop, pw.wL - 2, Math.max(1, gasH - 1));
  }

  /* ── 부피 눈금 0~5 L, 1 L 간격 (§3 3-C⑴·⑹ — 재작업 B-1) ── */
  ctx.strokeStyle = C.t3; ctx.fillStyle = C.t3; ctx.lineWidth = 1;
  ctx.font = "9px sans-serif"; ctx.textAlign = "left";
  const tickX = xL + pw.wL + 3;
  for (let v = 0; v <= PRESS.V.max; v++) {
    const ty = cylBot - gasHeight(v, maxGas);
    if (ty < top || ty > bot) continue;
    ctx.beginPath(); ctx.moveTo(tickX, ty); ctx.lineTo(tickX + 4, ty); ctx.stroke();
    const label = String(v);
    if (ctx.measureText(label).width <= Math.max(0, xR - (tickX + 6))) ctx.fillText(label, tickX + 6, ty + 3);
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

  /* ── 오른쪽: 큰 피스톤 + 눌리는 물체 (잠금 중엔 물체 위에 떠 있다) ── */
  const restY = oilTopR - 8;
  const floatY = restY - 34;
  const pistY = ds.latched ? floatY : floatY + (restY - floatY) * ds.pistonT;
  ctx.fillStyle = C.ink;
  ctx.fillRect(xR - 2, pistY, pw.wR + 4, 9);
  ctx.fillRect(xR + pw.wR / 2 - 4, pistY - 20, 8, 20);

  if (ds.latched) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(xR - 8, pistY + 1, 6, 7);
    ctx.fillRect(xR + pw.wR + 2, pistY + 1, 6, 7);
  }

  const objY = restY + 9, objH = 12;
  if (ds.shown && ds.verdict === "부서짐") {
    ctx.strokeStyle = EDGE; ctx.fillStyle = OBJ_FILL; ctx.lineWidth = 1.4;
    const midx = xR + pw.wR / 2;
    ctx.beginPath();
    ctx.moveTo(xR - 2, objY); ctx.lineTo(midx - 6, objY + 3); ctx.lineTo(midx - 2, objY + objH);
    ctx.lineTo(xR - 2, objY + objH); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midx + 2, objY + 2); ctx.lineTo(xR + pw.wR + 2, objY); ctx.lineTo(xR + pw.wR + 2, objY + objH);
    ctx.lineTo(midx + 4, objY + objH); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = OBJ_FILL; ctx.strokeStyle = EDGE; ctx.lineWidth = 1.4;
    const h = ds.shown ? objH * 0.7 : objH;
    ctx.fillRect(xR - 2, objY + (objH - h), pw.wR + 4, h);
    ctx.strokeRect(xR - 2, objY + (objH - h), pw.wR + 4, h);
  }

  /* ── 압력계(잠금) — 우상단, 캔버스 밖 HTML과 중복 표시(정직성) ── */
  ctx.textAlign = "right"; ctx.font = "700 13px sans-serif";
  const pi = pressureInfo();
  ctx.fillStyle = C.t3;
  const lockTxt = pi.locked ? "P = 🔒 잠김" : (pi.value != null ? "P = " + fmtInt(pi.value) + " kPa" : "");
  if (lockTxt) ctx.fillText(fitText(lockTxt, "🔒", midW - 4), W - M - 4, top + 12);

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
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
window.addEventListener("resize", resize);
syncSliderDom();
syncHowto();
syncLimitTxt();
renderStatic();
resize();
rafId = requestAnimationFrame(loop);
