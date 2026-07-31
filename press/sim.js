"use strict";
/* ================================================================
   유압 프레스 도전 — 계산부 (화면과 무관)

   장치 구성
     ① 기체 실린더 : 학생이 n(몰수)·T(온도)·V(부피)를 정한다.
                     기체 압력  P = nRT / V     ← 이상 기체 방정식
     ② 유압유      : 기체가 누르는 압력이 액체를 통해 **모든 방향으로 같은 크기로**
                     전달된다 (파스칼 원리). 액체는 거의 압축되지 않는다.
     ③ 작은 피스톤 A₁ / 큰 피스톤 A₂
                     F₁ = P·A₁,  F₂ = P·A₂   →   F₂ / F₁ = A₂ / A₁
                     압력이 같기 때문에 **넓이가 넓은 쪽이 더 큰 힘**을 받는다.

   단위 — 이 시뮬레이션은 **실제 단위**를 쓴다 (gaslaws 는 임의 단위였다)
     R = 8.314 kPa·L/(mol·K)   ( = 8.314 J/(mol·K) )
     P [kPa] = n[mol] × R × T[K] / V[L]
     F [N]   = P[kPa] × 1000 [Pa/kPa] × A[m²],  A[m²] = A[cm²] × 1e-4
             = P[kPa] × A[cm²] × 0.1

   ⚠ 모형의 한계 (활동지 마지막 문항에서 학생에게 직접 묻는다)
     · 실제 유압 프레스는 대개 **펌프로 기름을 밀어** 압력을 만든다.
       여기서는 이상 기체 방정식을 쓰려고 **기체 실린더를 압력원**으로 삼았다.
       (공압-유압 증압기라는 실제 장치가 이 방식이다)
     · 기체는 **이상 기체라고 가정**했다. 실제 고압에서는 어긋난다.
     · 마찰·기름의 압축성·관의 압력 손실·피스톤 무게를 모두 무시했다.
   ================================================================ */

const PRESS = {
  R: 8.314,                                  // kPa·L/(mol·K)
  /* step = 슬라이더 눈금, fine = 숫자칸에 직접 칠 때의 정밀도.
     ★ 숫자칸을 둔 이유: 이 게임의 핵심은 슬라이더를 흔드는 것이 아니라
       **P = nRT/V 를 풀어 값을 계산해 넣는 것**이다. */
  N: { min: 0.10, max: 2.00, step: 0.01, fine: 0.001 },   // 몰수 (mol)
  T: { min: 250, max: 600, step: 1, fine: 1 },            // 온도 (K)
  V: { min: 0.50, max: 5.00, step: 0.01, fine: 0.001 },   // 부피 (L)
  A1: 12,                                    // 작은 피스톤 넓이 (cm²) — 고정
  A2LIST: [40, 80, 150, 300],                // 큰 피스톤 넓이 선택지 (cm²)
  /* 난이도 — 열리는 변인과 허용 오차 */
  LEVELS: [
    { id: 1, name: "1단계 · 변인 1개", open: ["V"], fix: { n: 1.00, T: 300 },
      goal: "P", tol: 0.02, hint: "부피만 조절한다. P = nRT/V 에서 V 를 거꾸로 구하면 된다." },
    { id: 2, name: "2단계 · 변인 2개", open: ["T", "V"], fix: { n: 1.00 },
      goal: "P", tol: 0.015, hint: "온도와 부피 둘 다 쓸 수 있다. 답이 여러 개다 — 하나만 찾으면 된다." },
    { id: 3, name: "3단계 · 변인 3개", open: ["n", "T", "V"], fix: {},
      goal: "P", tol: 0.01, hint: "몰수까지 열렸다. 허용 오차가 좁아졌으니 계산하고 넣자." },
    { id: 4, name: "4단계 · 파스칼 원리", open: ["n", "T", "V", "A2"], fix: {},
      goal: "F", tol: 0.01, hint: "이번 목표는 압력이 아니라 **큰 피스톤이 내는 힘**이다. 두 단계로 푼다 — ① A₂ 를 고르고 필요한 압력 P = F₂ /(A₂ × 0.1) 을 구한다 ② 그 압력이 나오는 n · T · V 를 정한다. **A₂ 를 넓게 고를수록 필요한 압력은 낮아진다.**" }
  ]
};

const snap = (x, s) => Math.round(x / s) * s;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* 기체 압력 (kPa) */
function pressure(n, T, V) {
  if (!(V > 0)) return 0;
  return n * PRESS.R * T / V;
}
/* 피스톤이 받는 힘 (N) — 압력은 파스칼 원리로 어디서나 같다 */
function force(P_kPa, A_cm2) { return P_kPa * A_cm2 * 0.1; }

/* 그 단계에서 만들 수 있는 압력의 최소·최대 */
function reach(level) {
  const L = PRESS.LEVELS.find(l => l.id === level);
  const nR = L.fix.n !== undefined ? [L.fix.n, L.fix.n] : [PRESS.N.min, PRESS.N.max];
  const tR = L.fix.T !== undefined ? [L.fix.T, L.fix.T] : [PRESS.T.min, PRESS.T.max];
  const vR = [PRESS.V.min, PRESS.V.max];
  return { lo: pressure(nR[0], tR[0], vR[1]), hi: pressure(nR[1], tR[1], vR[0]) };
}

/* 슬라이더 눈금 위에서 목표에 얼마나 가까이 갈 수 있는가 (도달 가능성 보장용) */
function bestError(level, targetP) {
  const L = PRESS.LEVELS.find(l => l.id === level);
  const ns = L.fix.n !== undefined ? [L.fix.n]
    : Array.from({ length: Math.round((PRESS.N.max - PRESS.N.min) / PRESS.N.step) + 1 }, (_, i) => +(PRESS.N.min + i * PRESS.N.step).toFixed(2));
  const ts = L.fix.T !== undefined ? [L.fix.T]
    : Array.from({ length: Math.round((PRESS.T.max - PRESS.T.min) / PRESS.T.step) + 1 }, (_, i) => PRESS.T.min + i * PRESS.T.step);
  let best = Infinity;
  for (const n of ns) for (const T of ts) {
    // 목표 압력을 내는 이상적인 V 를 구한 뒤 눈금에 맞춘다
    const vIdeal = n * PRESS.R * T / targetP;
    if (vIdeal < PRESS.V.min - PRESS.V.fine || vIdeal > PRESS.V.max + PRESS.V.fine) continue;
    const V = clamp(snap(vIdeal, PRESS.V.fine), PRESS.V.min, PRESS.V.max);
    const e = Math.abs(pressure(n, T, V) - targetP) / targetP;
    if (e < best) best = e;
    if (best < 1e-5) return best;
  }
  return best;
}

/* 점수 — 오차율에 따라 계단식. 허용 오차 안이면 성공. */
function score(relErr, tol) {
  const r = Math.abs(relErr);
  if (r <= tol * 0.25) return 100;
  if (r <= tol * 0.5) return 90;
  if (r <= tol) return 80;
  if (r <= tol * 2) return 55;
  if (r <= tol * 5) return 30;
  if (r <= tol * 10) return 10;
  return 0;
}
function grade(relErr, tol) {
  const s = score(relErr, tol);
  return s >= 90 ? "완벽" : s >= 80 ? "성공" : s >= 55 ? "아쉬움" : s >= 10 ? "빗나감" : "실패";
}

/* 미션 목표값 만들기 — 반드시 **눈금 위에서 도달 가능한** 값만 낸다 */
function makeTarget(level, rnd) {
  const L = PRESS.LEVELS.find(l => l.id === level);
  const R = reach(level);
  for (let tries = 0; tries < 400; tries++) {
    // 로그 균등하게 뽑아 큰 값·작은 값이 골고루 나오게 한다
    const lo = Math.log(R.lo * 1.25), hi = Math.log(R.hi * 0.8);
    let P = Math.exp(lo + rnd() * (hi - lo));
    // 보기 좋은 자리수로 맞춘다
    const mag = Math.pow(10, Math.floor(Math.log10(P)) - 1);
    P = Math.round(P / mag) * mag;
    if (P < R.lo * 1.1 || P > R.hi * 0.9) continue;
    if (bestError(level, P) > L.tol * 0.3) continue;   // 만점을 노릴 수 있어야 한다
    if (L.goal === "P") return { P, A2: PRESS.A2LIST[1], F: null };
    const A2 = PRESS.A2LIST[Math.floor(rnd() * PRESS.A2LIST.length)];
    let F = force(P, A2);
    const fm = Math.pow(10, Math.floor(Math.log10(F)) - 1);
    F = Math.round(F / fm) * fm;
    return { P: null, A2: null, F };
  }
  return { P: Math.round(R.lo * 2), A2: PRESS.A2LIST[1], F: null };
}



/* ================= UI ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* 밝은 무대에서 쓰는 데이터 색은 3개다 (매뉴얼 §9 3색 조합, 최악 색각 ΔE 38.2)
   기체=파랑 / 유압유=황갈 / 금속·눈금=검정  */
const C = {
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), ink: CSSV("--t1"),
  gray: CSSV("--d-gray"), t3: CSSV("--t3"), stageLight: CSSV("--stage-light")
};
const GRID = "rgba(40,45,52,0.055)";
const EDGE = "rgba(40,45,52,0.42)";
const GAS_FILL = "rgba(29,78,216,0.10)";
const OIL_FILL = "rgba(180,83,9,0.16)";

const G = 9.80665;

let level = 1;
let target = null;          // { P | F, tol, goal }
let tries = 0;
let rows = [];
let submitted = false;
const state = { n: 1.000, T: 300, V: 2.000, A2: PRESS.A2LIST[1] };

const cv = $("rig"), ctx = cv.getContext("2d");
const S = { n: $("sN"), T: $("sT"), V: $("sV") };
const NU = { n: $("numN"), T: $("numT"), V: $("numV") };
const BOX = { n: $("cN"), T: $("cT"), V: $("cV"), A2: $("cA") };
const LK = { n: $("lkN"), T: $("lkT"), V: $("lkV"), A2: $("lkA") };
const RANGE = { n: PRESS.N, T: PRESS.T, V: PRESS.V };

/* ── 난이도 적용 ── */
function levelDef() { return PRESS.LEVELS.find(l => l.id === level); }

function applyLevel() {
  const L = levelDef();
  document.querySelectorAll(".lv").forEach(b =>
    b.setAttribute("aria-pressed", String(+b.dataset.lv === level)));
  for (const k of ["n", "T", "V", "A2"]) {
    const open = L.open.indexOf(k) >= 0;
    BOX[k].classList.toggle("locked", !open);
    LK[k].textContent = open ? "" : "잠김";
    if (k !== "A2") { S[k].disabled = !open; NU[k].disabled = !open; }
  }
  if (L.fix.n !== undefined) state.n = L.fix.n;
  if (L.fix.T !== undefined) state.T = L.fix.T;
  if (L.goal === "P") state.A2 = PRESS.A2LIST[1];
  buildAreas();
  syncInputs();
  newMission();
}

function buildAreas() {
  const L = levelDef(), open = L.open.indexOf("A2") >= 0;
  const host = $("areapick"); host.innerHTML = "";
  PRESS.A2LIST.forEach(a => {
    const b = document.createElement("button");
    b.className = "ab"; b.textContent = a; b.disabled = !open;
    b.setAttribute("aria-pressed", String(state.A2 === a));
    b.onclick = () => { state.A2 = a; buildAreas(); draw(); readouts(); };
    host.appendChild(b);
  });
}

function syncInputs() {
  for (const k of ["n", "T", "V"]) {
    const dec = k === "T" ? 0 : 3;
    S[k].value = clamp(state[k], RANGE[k].min, RANGE[k].max);
    NU[k].value = (+state[k]).toFixed(dec);
  }
}

/* ── 미션 ── */
function newMission() {
  const L = levelDef();
  target = makeTarget(level, Math.random);
  target.goal = L.goal; target.tol = L.tol;
  tries = 1; submitted = false;
  $("goalLab").textContent = L.goal === "P" ? "목표 압력" : "목표 힘 (큰 피스톤)";
  $("goalUnit").textContent = L.goal === "P" ? "kPa" : "N";
  $("goalVal").textContent = (L.goal === "P" ? target.P : target.F).toLocaleString("ko-KR");
  $("tolVal").textContent = (L.tol * 100).toFixed(1);
  $("triesVal").textContent = tries;
  $("missNote").innerHTML = "<b>힌트</b> — " + L.hint.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") +
    "<br>제출은 <b>딱 한 번</b>입니다. 먼저 계산하고 값을 넣은 뒤에 누르세요. " +
    "<em>R</em> = 8.314 kPa·L/(mol·K)";
  $("result").className = "result";
  $("submit").disabled = false;
  draw(); readouts();
}

function submit() {
  if (submitted || !target) return;
  const L = levelDef();
  const P = pressure(state.n, state.T, state.V);
  const got = L.goal === "P" ? P : force(P, state.A2);
  const want = L.goal === "P" ? target.P : target.F;
  const err = (got - want) / want;
  const sc = score(err, L.tol), gr = grade(err, L.tol);
  submitted = true; tries = 0;
  $("triesVal").textContent = "0";
  $("submit").disabled = true;

  const box = $("result");
  box.className = "result on " + (sc >= 80 ? "ok" : sc >= 30 ? "mid" : "bad");
  box.innerHTML =
    `<div class="g">${gr} · ${sc}점</div>` +
    `<div style="margin-top:5px">목표 <b>${want.toLocaleString("ko-KR")}</b> ${L.goal === "P" ? "kPa" : "N"} · ` +
    `내가 만든 값 <b>${got.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</b> · ` +
    `오차 <b>${(err * 100).toFixed(2)} %</b> (허용 ${(L.tol * 100).toFixed(1)} %)</div>` +
    `<div style="margin-top:4px;color:var(--t2)">쓴 값 — n = ${state.n.toFixed(3)} mol · T = ${state.T} K · V = ${state.V.toFixed(3)} L` +
    (L.goal === "F" ? ` · A₂ = ${state.A2} cm²` : "") + `</div>` +
    (sc < 80 ? `<div style="margin-top:5px;color:var(--t2)">다시 하려면 <b>새 미션 받기</b>를 누르세요. 계산부터 하고 넣는 것이 빠릅니다.</div>` : "");

  rows.push({
    seat: $("seat").value.trim() || "(무기명)", level, goal: L.goal,
    want, got, err, score: sc, grade: gr,
    n: state.n, T: state.T, V: state.V, A2: state.A2, P
  });
  renderTable();
  draw();
}

/* ── 그리기 ── */
function fit(hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = hCss + "px";
  cv.width = Math.max(1, Math.round(cv.clientWidth * dpr));
  cv.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  const w = cv.clientWidth || 320;
  fit(Math.max(260, Math.min(400, w * 0.62)));
  draw();
}

function draw() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.width / dpr, H = cv.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.stageLight; ctx.fillRect(0, 0, W, H);

  const P = pressure(state.n, state.T, state.V);
  const F1 = force(P, PRESS.A1), F2 = force(P, state.A2);

  /* 화면을 두 구역으로 나눈다 — 위: 장치 / 아래: 목표 게이지.
     겹치지 않도록 경계를 먼저 정한다. */
  const M = 10;                       // 바깥 여백 (가장자리에 아무것도 그리지 않는다)
  const gaugeH = 40;
  const top = M, bot = H - gaugeH - M;
  const midW = W - M * 2;

  // 격자 — 가장자리에서 안쪽으로 들여 그린다
  ctx.save();
  ctx.beginPath(); ctx.rect(M, top, midW, bot - top); ctx.clip();
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (let x = M; x < W - M; x += 26) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
  for (let y = top; y < bot; y += 26) { ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); }
  ctx.restore();

  /* ── 치수 ──
     ⚠ 두 피스톤의 그림 폭은 넓이 비를 **그대로** 그리지 않았다.
       A₂/A₁ 이 최대 25배라 화면을 벗어나기 때문이다. A^0.55 로 줄여 그리고,
       정확한 비는 숫자(A₂/A₁)로 따로 보여 준다. (매뉴얼 §2③ · 오개념 M4) */
  const shrink = a => Math.pow(a / PRESS.A1, 0.55);
  const unit = Math.min(30, midW * 0.075);
  const wL = unit;                                  // 작은 피스톤(= 기체 실린더) 폭
  const wR = Math.min(midW * 0.34, unit * shrink(state.A2));   // 큰 피스톤 폭

  const duct = 20;                                  // 아래 연결관 높이
  const floor = bot - 6;                            // 장치 바닥
  const oilTopL = top + (bot - top) * 0.62;         // 왼쪽 기름면
  const oilTopR = top + (bot - top) * 0.52;         // 오른쪽 기름면
  const xL = M + 14;
  const xR = Math.min(W - M - wR - 6, xL + wL + Math.max(70, midW * 0.32));

  /* ── 유압유 (ㄷ 자 통) ── */
  ctx.beginPath();
  ctx.moveTo(xL, oilTopL); ctx.lineTo(xL + wL, oilTopL);
  ctx.lineTo(xL + wL, floor - duct); ctx.lineTo(xR, floor - duct);
  ctx.lineTo(xR, oilTopR); ctx.lineTo(xR + wR, oilTopR);
  ctx.lineTo(xR + wR, floor); ctx.lineTo(xL, floor);
  ctx.closePath();
  ctx.fillStyle = OIL_FILL; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.amber; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("유압유", (xL + wL + xR) / 2, floor - duct / 2 + 4);

  /* 압력이 모든 방향으로 같음 — 화살표 4개 (한 점에서 사방으로) */
  const ax = Math.min(xR - 26, (xL + wL + xR) / 2 + 42), ay = floor - duct / 2;
  if (ax > xL + wL + 34) {
    ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 1.6;
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const len = ang % Math.PI === 0 ? 12 : 7;
      const ex = ax + Math.cos(ang) * len, ey = ay + Math.sin(ang) * len;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 4, ey + Math.sin(ang) * 4);
      ctx.lineTo(ex - Math.sin(ang) * 3, ey + Math.cos(ang) * 3);
      ctx.lineTo(ex + Math.sin(ang) * 3, ey - Math.cos(ang) * 3);
      ctx.closePath(); ctx.fill();
    }
  }

  /* ── 왼쪽: 기체 실린더 (기름 위에 얹혀 기름을 누른다) ──
     실린더 높이가 곧 부피다 — 위에 빈 공간을 남기지 않는다. */
  const cylBot = oilTopL;
  const frac = (state.V - PRESS.V.min) / (PRESS.V.max - PRESS.V.min);
  const maxGas = cylBot - (top + 26);
  const gasH = (0.22 + 0.78 * frac) * maxGas;
  const cylTop = cylBot - gasH;
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
  ctx.strokeRect(xL, cylTop, wL, cylBot - cylTop);
  ctx.fillStyle = GAS_FILL;
  ctx.fillRect(xL + 1, cylTop + 1, wL - 2, gasH - 2);
  ctx.fillStyle = C.blue;
  const seedy = i => ((i * 9301 + 49297) % 233280) / 233280;
  const nDots = Math.round(5 + state.n * 9);
  for (let i = 0; i < nDots; i++) {
    const x = xL + 5 + seedy(i * 3 + 1) * (wL - 10);
    const y = cylBot - gasH + 5 + seedy(i * 7 + 2) * (gasH - 10);
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill();
  }
  // 기체를 누르는 뚜껑
  ctx.fillStyle = C.ink;
  ctx.fillRect(xL - 2, cylTop - 7, wL + 4, 7);
  // 기름과 맞닿는 면 = 작은 피스톤 A₁
  ctx.fillRect(xL - 2, oilTopL - 5, wL + 4, 5);

  /* ── 오른쪽: 큰 피스톤 + 눌리는 물체 ── */
  const pistTop = oilTopR - 9;
  ctx.fillStyle = C.ink;
  ctx.fillRect(xR - 2, pistTop, wR + 4, 9);
  ctx.fillRect(xR + wR / 2 - 4, pistTop - 22, 8, 22);
  ctx.fillStyle = "rgba(40,45,52,0.10)";
  ctx.fillRect(xR - 2, pistTop - 40, wR + 4, 18);
  ctx.strokeStyle = "rgba(40,45,52,0.30)"; ctx.lineWidth = 1.2;
  ctx.strokeRect(xR - 2, pistTop - 40, wR + 4, 18);
  ctx.fillStyle = C.t3; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("눌리는 물체", xR + wR / 2, pistTop - 27);

  /* ── 라벨 (서로 겹치지 않게 구역을 나눠 배치) ── */
  ctx.textAlign = "left";
  ctx.font = "600 10.5px sans-serif"; ctx.fillStyle = C.blue;
  ctx.fillText(`기체`, xL + wL + 8, cylTop + 12);
  ctx.font = "10px sans-serif"; ctx.fillStyle = C.t3;
  ctx.fillText(`n = ${state.n.toFixed(3)} mol`, xL + wL + 8, cylTop + 25);
  ctx.fillText(`T = ${state.T} K`, xL + wL + 8, cylTop + 37);
  ctx.fillText(`V = ${state.V.toFixed(3)} L`, xL + wL + 8, cylTop + 49);
  // A₁ · F₁ — 기름면 바로 위 (작은 피스톤 옆)
  ctx.font = "600 10.5px sans-serif"; ctx.fillStyle = C.ink;
  ctx.fillText(`A₁ = ${PRESS.A1} cm²`, xL + wL + 8, oilTopL - 12);
  ctx.font = "10px sans-serif"; ctx.fillStyle = C.t3;
  ctx.fillText(`F₁ = ${F1.toFixed(0)} N`, xL + wL + 8, oilTopL);
  // A₂ · F₂ — 큰 피스톤 위
  ctx.textAlign = "center"; ctx.font = "600 10.5px sans-serif"; ctx.fillStyle = C.ink;
  ctx.fillText(`A₂ = ${state.A2} cm²`, xR + wR / 2, pistTop - 46);
  ctx.fillStyle = C.t3; ctx.font = "10px sans-serif";
  ctx.fillText(`F₂ = ${F2.toFixed(0)} N`, xR + wR / 2, pistTop - 56 < top + 10 ? pistTop - 46 + 12 : pistTop - 56);
  // 압력 — 오른쪽 위 (다른 글자와 겹치지 않는 구역)
  ctx.textAlign = "right";
  ctx.font = "700 13px sans-serif"; ctx.fillStyle = C.amber;
  ctx.fillText(`P = ${P.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} kPa`, W - M - 4, top + 14);
  ctx.font = "10px sans-serif"; ctx.fillStyle = C.t3;
  ctx.fillText("기름 어디서나 같은 압력", W - M - 4, top + 27);

  /* ── 목표 게이지 (전용 구역, 장치와 겹치지 않는다) ── */
  const gy = H - M - gaugeH / 2 + 4, gx0 = M + 4, gx1 = W - M - 4;
  ctx.fillStyle = "rgba(40,45,52,0.035)";
  ctx.fillRect(M, H - M - gaugeH, midW, gaugeH);
  if (target) {
    const L = levelDef();
    const want = L.goal === "P" ? target.P : target.F;
    const got = L.goal === "P" ? P : F2;
    const hi = Math.max(want * 2, got * 1.08, 1);
    const X = v => gx0 + Math.min(1, v / hi) * (gx1 - gx0);
    ctx.fillStyle = "rgba(40,45,52,0.10)";
    ctx.fillRect(gx0, gy - 6, gx1 - gx0, 12);
    // 허용 오차 띠 — 초록 + 위아래 검은 눈금(색만으로 알리지 않는다)
    const bx0 = X(want * (1 - L.tol)), bx1 = X(want * (1 + L.tol));
    ctx.fillStyle = "rgba(21,128,61,0.30)";
    ctx.fillRect(bx0, gy - 6, Math.max(2.5, bx1 - bx0), 12);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(X(want), gy - 10); ctx.lineTo(X(want), gy + 10); ctx.stroke();
    ctx.fillStyle = C.blue;
    ctx.beginPath(); ctx.arc(X(got), gy, 5.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = C.stageLight; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.font = "600 10px sans-serif"; ctx.fillStyle = C.ink; ctx.textAlign = "center";
    const tx = Math.max(gx0 + 16, Math.min(gx1 - 16, X(want)));
    ctx.fillText("목표", tx, gy - 13);
    ctx.textAlign = "left"; ctx.fillStyle = C.t3; ctx.font = "10px sans-serif";
    ctx.fillText("지금 값 ●", gx0, gy + 18);
    ctx.textAlign = "right";
    ctx.fillText("초록 띠 = 허용 오차 안", gx1, gy + 18);
  }
  ctx.textAlign = "left";
}

/* ── 측정값 ── */
function readouts() {
  const P = pressure(state.n, state.T, state.V);
  const F1 = force(P, PRESS.A1), F2 = force(P, state.A2);
  $("rP").textContent = P.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  $("rF1").textContent = F1.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  $("rF2").textContent = F2.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  $("rRatio").textContent = (state.A2 / PRESS.A1).toFixed(1);
  $("rTon").textContent = (F2 / G / 1000).toFixed(2);
  const L = target ? levelDef() : null;
  if (target && L) {
    const want = L.goal === "P" ? target.P : target.F;
    const got = L.goal === "P" ? P : F2;
    const err = (got - want) / want;
    let msg = `목표까지 <b style="color:${Math.abs(err) <= L.tol ? "var(--d-green)" : "var(--d-amber)"}">` +
      `${err >= 0 ? "+" : ""}${(err * 100).toFixed(2)} %</b>` +
      (Math.abs(err) <= L.tol ? " — 허용 오차 안입니다." : " — 아직 허용 오차 밖입니다.");
    /* ★ 암묵적 안내 (매뉴얼 §2④)
       힘이 목표일 때는 고른 A₂ 에 따라 **필요한 압력**이 정해진다.
       그 압력이 이 단계에서 만들 수 없는 값이면, 학생은 아무리 슬라이더를 밀어도 못 맞힌다.
       그럴 때 무엇을 바꿔야 하는지 화면이 먼저 알려 준다. */
    if (L.goal === "F") {
      const needP = target.F / (state.A2 * 0.1);
      const R = reach(level);
      if (needP < R.lo || needP > R.hi) {
        msg += `<br><b style="color:var(--d-red)">지금 고른 A₂ = ${state.A2} cm² 로는 닿을 수 없습니다.</b> ` +
          `필요한 압력이 ${needP.toFixed(0)} kPa 인데, 이 단계에서 만들 수 있는 압력은 ` +
          `${R.lo.toFixed(0)} ~ ${R.hi.toFixed(0)} kPa 입니다. → <b>A₂ 를 ${needP < R.lo ? "좁은" : "넓은"} 쪽으로 바꾸세요.</b>`;
      } else {
        msg += `<br>고른 A₂ = ${state.A2} cm² 이면 필요한 압력은 <b>${needP.toFixed(1)} kPa</b> 입니다. ` +
          `이제 그 압력이 나오도록 n · T · V 를 정하세요.`;
      }
    }
    $("devNote").innerHTML = msg;
  } else $("devNote").textContent = "";
  draw();
}

/* ── 기록 ── */
const HEADERS = ["좌석번호", "단계", "목표종류", "목표값", "내가 만든 값", "오차(%)", "점수", "등급",
  "n (mol)", "T (K)", "V (L)", "A2 (cm²)", "압력 P (kPa)"];
function renderTable() {
  $("recCount").textContent = rows.length ? `— ${rows.length}회 · 최고 ${Math.max(...rows.map(r => r.score))}점` : "";
  const w = $("tableWrap");
  if (!rows.length) { w.innerHTML = '<div class="empty">아직 도전 기록이 없습니다.</div>'; return; }
  const best = Math.max(...rows.map(r => r.score));
  w.innerHTML = "<table class='rank'><thead><tr><th>#</th><th>단계</th><th>목표</th><th>만든 값</th>" +
    "<th>오차(%)</th><th>점수</th><th>등급</th></tr></thead><tbody>" +
    rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.level}</td>` +
      `<td>${r.want.toLocaleString("ko-KR")} ${r.goal === "P" ? "kPa" : "N"}</td>` +
      `<td>${r.got.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</td>` +
      `<td>${(r.err * 100).toFixed(2)}</td>` +
      `<td class="${r.score === best ? "me" : ""}">${r.score}</td><td>${r.grade}</td></tr>`).join("") +
    "</tbody></table>";
}
$("clr").onclick = () => { rows = []; renderTable(); };
$("csv").onclick = () => {
  if (!rows.length) { $("devNote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">먼저 도전을 한 번 이상 하세요.</span>'; return; }
  const body = rows.map(r => [r.seat, r.level, r.goal === "P" ? "압력(kPa)" : "힘(N)",
    r.want, r.got.toFixed(2), (r.err * 100).toFixed(3), r.score, r.grade,
    r.n.toFixed(3), r.T, r.V.toFixed(3), r.A2, r.P.toFixed(2)]);
  const csv = "﻿" + [HEADERS, ...body].map(a => a.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = (($("seat").value.trim() || "유압프레스").replace(/[\\/:*?"<>|]/g, "")) + "_유압프레스.csv";
  a.click(); URL.revokeObjectURL(a.href);
};

/* ── 입력 ── */
function setVal(k, v) {
  const R = RANGE[k];
  if (!isFinite(v)) return;
  state[k] = clamp(snap(v, R.fine), R.min, R.max);
  syncInputs(); readouts();
}
for (const k of ["n", "T", "V"]) {
  S[k].oninput = e => setVal(k, +e.target.value);
  NU[k].oninput = e => {
    const v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    state[k] = clamp(snap(v, RANGE[k].fine), RANGE[k].min, RANGE[k].max);
    S[k].value = state[k];
    readouts();
  };
  NU[k].onblur = () => syncInputs();
}
document.querySelectorAll(".lv").forEach(b => b.onclick = () => { level = +b.dataset.lv; applyLevel(); });
$("newMission").onclick = newMission;
$("submit").onclick = submit;

if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
window.addEventListener("resize", resize);

applyLevel();
resize();
renderTable();
