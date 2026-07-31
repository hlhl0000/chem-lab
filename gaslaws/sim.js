"use strict";
/* ================================================================
   기체 법칙 — 물리 엔진 (화면과 무관한 순수 계산부)

   ★ 이 모형은 **이상 기체 모형**이다. 일부러 그렇게 만들었다.
     로드맵 §4 「도구 사용 시 주의」:
       "PhET Gas Properties는 이상 기체 모형 구현체다. 이것으로 실제 기체의
        비이상성을 관찰시킬 수는 없다. 4차시에서는 '이 모형에서는 절대 일어나지
        않는 일 찾기'(액화가 없음)로 목적을 한정한다.
        비이상성은 PV/nRT 실측 데이터 표로 다룬다."
     → 그래서 이 시뮬레이션에서 보일·샤를·아보가드로는 **정확히** 성립한다.
       샤를 그래프를 외삽하면 **정확히 −273 ℃**가 나온다. 이것이 3차시의 목표다.
     ⚠ 실제 기체의 비이상성을 이 화면으로 가르치려 하지 말 것. 로드맵이 금지한다.

   단위계
     · 2차원이므로 "부피"는 상자의 **넓이**다. k_B = 1 인 임의 단위(a.u.).
     · 평균 운동 에너지 <½mv²> = k_B·T  →  v_rms = √(2kT/m)
     · 압력 P = (벽에 준 총 충격량) / (둘레 길이 × 시간)
     · 이상 기체(2D):  P × (넓이) = N × k_B × T

   이상 기체 가정을 코드에서 어떻게 지켰나 (로드맵 4차시 ⓐ~ⓓ)
     ⓐ 분자 자체의 부피 무시 → 벽 반사를 **점**으로 처리한다(반지름 0).
        입자끼리 충돌 반지름만 아주 작게(1.4) 남겨 충돌이 보이게 했다.
        그 결과 PV/NkT 는 1.00~1.02 로, 화면 눈금에서는 1이다.
     ⓑ 인력·척력 없음 → 어떤 인력 항도 없다. 그래서 **액화가 절대 일어나지 않는다.**
     ⓒ 완전 탄성 충돌 → 충돌에서 운동 에너지가 보존된다.
     ⓓ 평균 운동 에너지 ∝ 절대 온도 → 속도 되먹임(thermostat)이 이것을 유지한다.

   두 가지 모드
     · 등압 모드     : 바깥 압력을 정하면 피스톤이 **이상 기체 법칙이 정하는 자리**로
                      미끄러져 가서 멈춘다. 멈추는 조건 = 안쪽 압력 = 바깥 압력.
     · 부피 고정 모드 : 피스톤 위치를 직접 정하고 압력을 관찰한다.
   ================================================================ */

const GAS = {
  H: 300,                  // 상자 높이(고정)
  W_MIN: 100, W_MAX: 440,  // 피스톤 이동 범위
  M: 1,                    // 입자 질량
  R: 1.4,                  // ★ 입자끼리 충돌하는 반지름. 벽에는 점으로 부딪힌다(가정 ⓐ)
  PSCALE: 714.3,           // 표시용 압력 배율 — 기준 상태(N=35,T=300,W=250)에서 100.0 a.u.
  DT: 0.05, SUBSTEPS: 2,
  EASE: 0.055              // 피스톤이 새 자리로 미끄러지는 속도 (τ ≈ 18프레임 ≈ 0.3초)
};

function makeGas() {
  const st = {
    W: 250, Wshow: 250, T: 300, N: 0, Pext: 100 / GAS.PSCALE,
    parts: [], impulse: 0, tAcc: 0, P: 0, atStop: false
  };

  function spawn() {
    const v = Math.sqrt(2 * st.T / GAS.M), a = Math.random() * Math.PI * 2;
    return { x: Math.random() * st.W, y: Math.random() * GAS.H,
             vx: v * Math.cos(a), vy: v * Math.sin(a) };
  }
  function setN(n) {
    n = Math.max(0, Math.round(n));
    while (st.parts.length < n) st.parts.push(spawn());
    while (st.parts.length > n) st.parts.pop();
    st.N = st.parts.length;
  }
  function curT() {
    if (!st.parts.length) return st.T;
    let ke = 0;
    for (const p of st.parts) ke += 0.5 * GAS.M * (p.vx * p.vx + p.vy * p.vy);
    return ke / st.parts.length;
  }
  function thermostat() {
    const T = curT(); if (T <= 0) return;
    const lam = Math.sqrt(1 + 0.10 * (st.T / T - 1));
    for (const p of st.parts) { p.vx *= lam; p.vy *= lam; }
  }
  function step(dt) {
    const m = GAS.M, H = GAS.H, W = st.W;
    for (const p of st.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      /* 벽 반사 — 반지름 0 (가정 ⓐ: 분자 자체의 부피를 무시한다) */
      if (p.x < 0) { p.x = -p.x; st.impulse += 2 * m * Math.abs(p.vx); p.vx = Math.abs(p.vx); }
      else if (p.x > W) { p.x = 2 * W - p.x; st.impulse += 2 * m * Math.abs(p.vx); p.vx = -Math.abs(p.vx); }
      if (p.y < 0) { p.y = -p.y; st.impulse += 2 * m * Math.abs(p.vy); p.vy = Math.abs(p.vy); }
      else if (p.y > H) { p.y = 2 * H - p.y; st.impulse += 2 * m * Math.abs(p.vy); p.vy = -Math.abs(p.vy); }
      p.x = Math.min(W, Math.max(0, p.x));
      p.y = Math.min(H, Math.max(0, p.y));
    }
    /* 입자끼리는 부딪힌다 (가정 ⓒ). 반지름이 작아 압력 기여는 1~2 % 이내다. */
    const n = st.parts.length, r = GAS.R, R2 = (2 * r) * (2 * r);
    for (let i = 0; i < n; i++) {
      const a = st.parts[i];
      for (let j = i + 1; j < n; j++) {
        const b = st.parts[j];
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= R2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; }
        const ov = (2 * r - d) / 2 + 0.01;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      }
    }
    st.tAcc += dt;
  }
  /* 등압 모드에서 피스톤이 멈추는 자리 = 이상 기체 법칙이 정하는 부피
     P외부 × (W × H) = N k T   →   W = N T / (P외부 × H)  */
  function idealW() {
    if (!st.N || st.Pext <= 0) return st.W;
    return st.N * st.T / (st.Pext * GAS.H);
  }
  function pushParticles(W0) {
    if (st.W >= W0) return;
    for (const p of st.parts) if (p.x > st.W) { p.x = st.W; if (p.vx > 0) p.vx = -p.vx; }
  }
  function frame(movePiston) {
    for (let s = 0; s < GAS.SUBSTEPS; s++) step(GAS.DT);
    thermostat();
    if (st.tAcc > 2.0) {
      const p = st.impulse / (2 * (st.W + GAS.H) * st.tAcc);
      st.P = st.P ? st.P * 0.90 + p * 0.10 : p;      // 표시용 — 실측 흔들림 ±3.0 %. 슬라이더를 만지면 reset() 이 불려 새로 잰다
      st.impulse = 0; st.tAcc = 0;
    }
    if (movePiston) {
      const want = idealW();
      const target = Math.max(GAS.W_MIN, Math.min(GAS.W_MAX, want));
      st.atStop = Math.abs(target - want) > 0.5;
      const W0 = st.W;
      st.W += (target - st.W) * GAS.EASE;
      if (Math.abs(target - st.W) < 0.05) st.W = target;
      pushParticles(W0);
    } else st.atStop = false;
    st.Wshow += (st.W - st.Wshow) * 0.25;
  }
  function setW(w) {
    const W0 = st.W;
    st.W = Math.max(GAS.W_MIN, Math.min(GAS.W_MAX, w));
    st.Wshow = st.W;
    pushParticles(W0);
  }
  function measure() {
    const V = st.W * GAS.H, T = curT();
    const target = Math.max(GAS.W_MIN, Math.min(GAS.W_MAX, idealW()));
    return {
      W: st.W, V, N: st.N, T, Ttarget: st.T,
      P: st.P, Pdisp: st.P * GAS.PSCALE,
      PextDisp: st.Pext * GAS.PSCALE,
      Pideal: st.N && T ? st.N * T / V * GAS.PSCALE : 0,
      Z: (st.N && T) ? st.P * V / (st.N * T) : 0,
      /* 멈춤 판정: 목표 자리에 도착했는가. 결정적이라 흔들리지 않는다. */
      settled: Math.abs(st.W - target) / Math.max(1, target) < 0.006,
      atStop: st.atStop
    };
  }
  return {
    st, setN, setW, frame, measure, curT, idealW,
    setT: t => { st.T = t; },
    setPextDisp: p => { st.Pext = p / GAS.PSCALE; },
    reset: () => { st.P = 0; st.impulse = 0; st.tAcc = 0; }
  };
}


/* ================= UI ================= */
/* ↑ 위쪽(엔진)은 화면과 무관한 순수 계산부다. 검증 스크립트가 이 주석줄을 기준으로
   잘라 Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* 캔버스 안 색은 CSS 토큰을 읽어서 쓴다 — 하드코딩하면 사이트 색을 바꿔도 캔버스만 옛 색이 된다.
   ★ 어두운 무대에서 쓰는 데이터 색은 3개뿐이다 (매뉴얼 §9: 4개 이상이면 색만으로 구분 불가).
      입자=하늘 / 바깥 압력=주황 / 피스톤·눈금·글자=은색.  최악 색각 ΔE 28.9 로 안전. */
const C = {
  sky: CSSV("--p-sky"), orange: CSSV("--p-orange"), silver: CSSV("--p-silver"),
  stageDark: CSSV("--stage-dark"), stageLight: CSSV("--stage-light"), stageLine: CSSV("--stage-line"),
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), gray: CSSV("--d-gray"),
  t3: CSSV("--t3")
};
const GRID_DARK = "rgba(148,163,184,0.14)";   // 어두운 무대 격자 (매뉴얼 §5)
const GRID_LIGHT = "rgba(40,45,52,0.055)";    // 밝은 무대 격자
const AXIS_LIGHT = "rgba(40,45,52,0.30)";     // 밝은 무대 축
const BAND_LIGHT = "rgba(40,45,52,0.06)";     // 참고 구간 띠
const BOX_INNER = "rgba(148,163,184,0.13)";   // 상자 안쪽 — 바깥(무대)과 확실히 구분되게
const BOX_EDGE  = "rgba(203,213,225,0.55)";   // 상자 테두리

/* ── 탭 정의 ──
   세 법칙은 같은 엔진을 쓴다. 다른 것은 "무엇을 잠그고 무엇을 여는가"뿐이다. */
const TABS = {
  A: {
    title: "보일 법칙", mode: "iso", open: ["P"], set: { T: 300, N: 35 },
    range: { P: [70, 200, 2] }, init: { P: 100 },
    cond: "[T 일정, N 일정]", law: "P × V = 일정",
    desc: "<b>바깥 압력만</b> 바꾼다. 피스톤이 스스로 움직여, 안쪽 압력이 바깥 압력과 같아지는 자리에서 멈춘다.",
    stage: "입자 상자 — 바깥 압력을 바꾸면 피스톤이 움직인다",
    graph: "보일 그래프 — 가로축을 1/V 로 바꾸면 직선이 된다"
  },
  B: {
    title: "샤를 법칙", mode: "iso", open: ["T"], set: { P: 100, N: 30 },
    range: { T: [180, 600, 5] }, init: { T: 300 },
    cond: "[P 일정, N 일정]", law: "V ∝ T (절대 온도)",
    desc: "<b>온도만</b> 바꾼다. 바깥 압력이 일정하므로 피스톤이 움직여 부피가 달라진다.",
    stage: "입자 상자 — 온도를 바꾸면 피스톤이 움직인다",
    graph: "V–T 그래프 — 실선은 측정 구간, 점선은 늘려 그린(외삽) 구간"
  },
  C: {
    title: "아보가드로 법칙", mode: "iso", open: ["N"], set: { T: 300, P: 150 },
    range: { N: [25, 90, 1] }, init: { N: 55 },
    cond: "[T 일정, P 일정]", law: "V ∝ N (입자 수)",
    desc: "<b>입자 수만</b> 바꾼다. 온도와 압력이 같으면 부피는 입자 수에만 비례한다.",
    stage: "입자 상자 — 입자를 넣으면 피스톤이 밀려난다",
    graph: "V–N 그래프 — 점선은 N = 0 까지 늘려 그린 구간"
  },
  D: {
    title: "이상 기체 방정식", mode: "fix", open: ["T", "N", "V"], set: {},
    range: { T: [150, 600, 5], N: [20, 110, 1], V: [100, 440, 2] },
    init: { T: 300, N: 45, V: 250 },
    cond: "[조건 없음 — 셋 다 바꾼다]", law: "P V = N k T   (= n R T)",
    desc: "세 법칙을 하나로 묶는다. 피스톤을 <b>직접 밀어</b> 부피를 정하고 압력을 읽는다. 어떻게 조작해도 <b>PV/NkT = 1</b> 이다 — 이 모형이 <b>이상 기체 모형</b>이기 때문이다.",
    stage: "입자 상자 — 피스톤을 직접 민다",
    graph: "PV = NkT 계산값 ↔ 입자가 벽에 부딪혀 만든 압력"
  }
};

let tab = "A";
const gas = makeGas();
let rows = [];
let axisMode = "V";
let running = true;
let lastChange = 0;      // 마지막으로 슬라이더를 만진 시각
/* 압력은 "벽에 부딪힌 횟수를 세어" 얻는 값이라 조작 직후에는 아직 정확하지 않다.
   피스톤이 도착했고 + 마지막 조작에서 2.5초가 지나야 「잰 값」으로 인정한다.
   실험에서 "눈금이 안정될 때까지 기다린다"와 같은 절차다. */
const measuring = () => (Date.now() - lastChange < 4000) || !gas.measure().settled;

const boxCv = $("box"), bctx = boxCv.getContext("2d");
const grCv = $("graph"), gctx = grCv.getContext("2d");

const S = { T: $("sT"), P: $("sP"), N: $("sN"), W: $("sW") };
const KEY2EL = { T: S.T, P: S.P, N: S.N, V: S.W };
const KEY2BOX = { T: $("cT"), P: $("cP"), N: $("cN"), V: $("cV") };
const KEY2LOCK = { T: $("lkT"), P: $("lkP"), N: $("lkN"), V: $("lkV") };

function applyTab() {
  const t = TABS[tab];
  document.querySelectorAll(".tab").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  $("tabdesc").innerHTML = `<span class="cond">${t.cond}</span><b>${t.law}</b> — ${t.desc}`;
  $("stageTitle").textContent = t.stage;
  $("graphTitle").textContent = t.graph;

  for (const k of ["T", "P", "N", "V"]) {
    const open = t.open.indexOf(k) >= 0;
    const el = KEY2EL[k];
    const used = open || (k in t.set);
    KEY2BOX[k].style.display = used ? "" : "none";
    KEY2BOX[k].classList.toggle("locked", !open);
    el.disabled = !open;
    KEY2LOCK[k].textContent = open ? "" : "잠김";
    if (t.range[k]) { el.min = t.range[k][0]; el.max = t.range[k][1]; el.step = t.range[k][2]; }
    if (k in t.set) el.value = t.set[k];
    if (t.init && k in t.init) el.value = t.init[k];
  }
  gas.setT(+S.T.value);
  gas.setN(+S.N.value);
  gas.setPextDisp(+S.P.value);
  gas.setW(t.mode === "fix" ? +S.W.value : 250);
  gas.reset(); lastChange = Date.now();

  $("fixnote").innerHTML = t.mode === "iso"
    ? "이 탭에서는 <b>피스톤이 스스로 움직인다.</b> 안쪽 압력과 바깥 압력이 같아지는 자리로 미끄러져 간 뒤 멈춘다. 무대 오른쪽 아래가 『평형』으로 바뀐 뒤에 기록하자."
    : "이 탭에서는 <b>피스톤을 직접 민다.</b> 부피를 정하고 압력을 읽는다.";
  $("recnote").textContent = "";
  syncLabels(); buildAxisBar(); buildLegend(); renderTable();
}

function syncLabels() {
  $("vT").textContent = S.T.value;
  $("vTc").textContent = (+S.T.value - 273);
  $("vP").textContent = S.P.value;
  $("vN").textContent = S.N.value;
  $("vV").textContent = (gas.st.Wshow * GAS.H / 1e4).toFixed(2);
}

/* ── 탭 A 전용 가로축 전환 ── */
function buildAxisBar() {
  const host = $("axisbar");
  host.innerHTML = "";
  if (tab !== "A") { host.style.display = "none"; return; }
  host.style.display = "";
  const lb = document.createElement("span");
  lb.className = "lb"; lb.textContent = "가로축";
  host.appendChild(lb);
  [["V", "부피 V", "곡선(반비례)"], ["INV", "1 / V", "직선이면 P ∝ 1/V"]].forEach(([k, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (axisMode === k) b.className = "primary";
    b.onclick = () => { axisMode = k; buildAxisBar(); };
    host.appendChild(b);
  });
  const note = document.createElement("span");
  note.className = "lb";
  note.textContent = axisMode === "V" ? "곡선(반비례) 모양" : "직선이면 P 는 1/V 에 비례";
  host.appendChild(note);
}
function buildLegend() {
  const items = {
    A: [["지금 상태", C.blue, "ring"], ["기록한 점", C.blue, "dot"], ["P·V = 일정 (기록의 평균)", C.gray, "dash"]],
    B: [["지금 상태", C.blue, "ring"], ["측정 구간", C.blue, "solid"],
        ["늘려 그린 구간(외삽)", C.amber, "dash"], ["실제 기체가 액체가 되는 구간", null, "band"]],
    C: [["지금 상태", C.blue, "ring"], ["측정 구간", C.blue, "solid"], ["N = 0 까지 외삽", C.amber, "dash"]],
    D: [["지금 상태", C.blue, "ring"], ["기록한 점", C.blue, "dot"], ["PV = NkT 인 자리 (기울기 1)", C.gray, "dash"]]
  }[tab];
  $("graphLegend").innerHTML = items.map(([label, col, kind]) => {
    const sw = kind === "dot" ? `<span class="swatch" style="background:${col}"></span>`
      : kind === "ring" ? `<span class="swatch" style="background:var(--stage-light);border:2.5px solid ${col}"></span>`
      : kind === "band" ? `<span class="swatch sq" style="background:rgba(40,45,52,.09);border-color:var(--line)"></span>`
      : `<span style="display:inline-block;width:18px;border-top:${kind === "dash" ? "2px dashed" : "3px solid"} ${col}"></span>`;
    return `<span class="item">${sw}${label}</span>`;
  }).join("");
}

/* ── 캔버스 크기 ── */
function fit(cv, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);   // 2 초과는 성능만 먹는다
  cv.style.height = hCss + "px";
  cv.width = Math.max(1, Math.round(cv.clientWidth * dpr));
  cv.height = Math.max(1, Math.round(hCss * dpr));
}
function resize() {
  const bw = boxCv.clientWidth || 300;
  fit(boxCv, Math.max(210, Math.min(340, bw * 0.68)));
  const gw = grCv.clientWidth || 300;
  fit(grCv, Math.max(230, Math.min(330, gw * 0.40)));
}

/* ── 무대 ── */
function drawBox() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = boxCv.width / dpr, ch = boxCv.height / dpr;
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bctx.fillStyle = C.stageDark; bctx.fillRect(0, 0, cw, ch);

  const pad = 8, rodRoom = 30;
  const s = Math.min((cw - pad * 2 - rodRoom) / GAS.W_MAX, (ch - pad * 2) / GAS.H);
  const ox = pad, oy = (ch - GAS.H * s) / 2, W = gas.st.W;
  const boxW = W * s, boxH = GAS.H * s;

  bctx.fillStyle = BOX_INNER; bctx.fillRect(ox, oy, boxW, boxH);
  bctx.strokeStyle = BOX_EDGE; bctx.lineWidth = 1.5;
  bctx.strokeRect(ox + 0.75, oy + 0.75, boxW - 1.5, boxH - 1.5);
  bctx.strokeStyle = GRID_DARK; bctx.lineWidth = 1;
  for (let gx = 50; gx < W; gx += 50) {
    bctx.beginPath(); bctx.moveTo(ox + gx * s, oy); bctx.lineTo(ox + gx * s, oy + boxH); bctx.stroke();
  }
  for (let gy = 50; gy < GAS.H; gy += 50) {
    bctx.beginPath(); bctx.moveTo(ox, oy + gy * s); bctx.lineTo(ox + boxW, oy + gy * s); bctx.stroke();
  }

  /* 입자 — 이상 기체 모형이므로 분자 자체의 부피는 무시한다(가정 ⓐ).
     그래서 동그라미는 "크기"가 아니라 **위치 표시**다.
     알맹이(충돌 반지름) + 후광(눈에 보이게 하는 장치) 두 겹으로 그린다. */
  const pr = Math.max(1.6, GAS.R * s);
  for (const p of gas.st.parts) {
    const X = ox + p.x * s, Y = oy + p.y * s;
    bctx.fillStyle = "rgba(86,180,233,0.28)";
    bctx.beginPath(); bctx.arc(X, Y, pr + 2.6, 0, 6.2832); bctx.fill();
    bctx.fillStyle = C.sky;
    bctx.beginPath(); bctx.arc(X, Y, pr, 0, 6.2832); bctx.fill();
  }

  // 피스톤 면
  const px = ox + boxW;
  bctx.fillStyle = C.silver; bctx.fillRect(px, oy, 10, boxH);

  // 바깥에서 누르는 압력 — 화살표 길이 ∝ P외부
  let rodX = px + 14;
  if (TABS[tab].mode === "iso") {
    const L = 9 + (+S.P.value / 200) * 15;
    bctx.strokeStyle = C.orange; bctx.fillStyle = C.orange; bctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = oy + boxH * (0.2 + i * 0.3);
      const x1 = px + 12, x0 = Math.min(cw - 3, x1 + L);
      bctx.beginPath(); bctx.moveTo(x0, y); bctx.lineTo(x1, y); bctx.stroke();
      bctx.beginPath(); bctx.moveTo(x1, y); bctx.lineTo(x1 + 6, y - 4.5); bctx.lineTo(x1 + 6, y + 4.5);
      bctx.closePath(); bctx.fill();
    }
    rodX = px + 14 + L;
  }
  // 피스톤 손잡이 — 화살표 뒤쪽에 둔다 (겹치지 않게)
  if (cw - rodX > 6) {
    bctx.fillStyle = C.stageLine;
    bctx.fillRect(rodX, oy + boxH / 2 - 7, cw - rodX - 2, 14);
  }

  /* ★★★ 오개념 반박 장치 ★★★
     "부피를 줄이면 분자가 찌그러진다 / 개수가 줄어든다"를 화면으로 막는다.
     아래 두 줄은 어떤 조작을 해도 절대 바뀌지 않는다.
     ⚠ 글자가 상자를 넘치지 않도록 **실제 글자 폭을 재서** 판을 만든다.
       좁은 화면(휴대폰)에서는 짧은 문구로 바꾼다. */
  bctx.font = "600 11.5px sans-serif"; bctx.textAlign = "left";
  const wide = ["입자 크기 — 어떤 조작에도 안 변함", "입자 수 N = " + gas.st.N + " 개 — 안 변함"];
  const narrow = ["크기 안 변함", "N = " + gas.st.N + " 개"];
  const need = t => Math.max(...t.map(x => bctx.measureText(x).width));
  let lines = wide, panW = need(wide) + pr * 2 + 30;
  if (panW > boxW - 12) { lines = narrow; panW = need(narrow) + pr * 2 + 30; }
  const panH = 44;
  if (panW <= boxW - 12 && boxH > panH + 16) {
    const bx = ox + 6, by = oy + 6;
    bctx.fillStyle = "rgba(6,12,26,0.80)";
    bctx.strokeStyle = "rgba(203,213,225,0.34)"; bctx.lineWidth = 1;
    bctx.beginPath();
    if (bctx.roundRect) bctx.roundRect(bx, by, panW, panH, 6); else bctx.rect(bx, by, panW, panH);
    bctx.fill(); bctx.stroke();
    const cx = bx + 10 + pr, cy = by + 13;
    bctx.fillStyle = "rgba(86,180,233,0.28)";
    bctx.beginPath(); bctx.arc(cx, cy, pr + 2.6, 0, 6.2832); bctx.fill();
    bctx.fillStyle = C.sky;
    bctx.beginPath(); bctx.arc(cx, cy, pr, 0, 6.2832); bctx.fill();
    bctx.fillStyle = C.silver;
    bctx.fillText(lines[0], cx + pr + 8, cy + 4);
    bctx.fillText(lines[1], bx + 9, by + 34);
  }

  // 피스톤 오른쪽은 "상자 바깥"이다 — 상자의 일부로 오해하지 않게 이름을 붙인다
  if (cw - (ox + boxW) > 78) {
    bctx.fillStyle = "rgba(203,213,225,0.42)"; bctx.font = "11px sans-serif"; bctx.textAlign = "center";
    bctx.fillText("상자 바깥", (ox + boxW + cw) / 2, oy + boxH - 10);
    bctx.textAlign = "left";
  }

  // 상태 (색이 아니라 문장으로 알린다 — 매뉴얼 §8)
  if (TABS[tab].mode === "iso") {
    const m = gas.measure();
    const txt = m.atStop ? "피스톤이 끝까지 이동했습니다"
      : !m.settled ? "피스톤 이동 중…"
      : measuring() ? "압력을 재는 중…" : "평형 — 안쪽 압력 = 바깥 압력";
    bctx.font = "600 11.5px sans-serif"; bctx.textAlign = "right";
    const tw = bctx.measureText(txt).width;
    if (boxW > tw + 24) {
      bctx.fillStyle = "rgba(6,12,26,0.78)";
      bctx.fillRect(ox + boxW - tw - 14, oy + boxH - 21, tw + 12, 18);
      bctx.fillStyle = C.silver;
      bctx.fillText(txt, ox + boxW - 8, oy + boxH - 8);
    }
    bctx.textAlign = "left";
  }
}

/* ── 압력 비교 막대 (HTML — 캔버스 글자와 겹칠 일이 없다) ── */
function drawEqBox() {
  const m = gas.measure(), t = TABS[tab];
  const bar = (label, v, max, col) =>
    `<div class="eqrow"><span class="k">${label}</span>
      <span class="track"><span class="fill" style="width:${Math.max(0, Math.min(100, v / max * 100)).toFixed(1)}%;background:${col}"></span></span>
      <span class="v">${v.toFixed(1)}</span></div>`;
  const busy = measuring();
  if (t.mode === "iso") {
    const max = Math.max(240, m.Pdisp * 1.08, m.PextDisp * 1.08);
    $("eqBox").innerHTML =
      bar("P<sub>안쪽</sub> (측정)", m.Pdisp, max, C.blue) +
      bar("P<sub>바깥</sub> (설정)", m.PextDisp, max, C.amber) +
      `<div style="margin-top:5px">피스톤이 멈추는 조건 = <b>두 압력이 같아지는 것</b> · 지금 ${
        busy ? '<span class="warn">압력을 재는 중 — 막대가 아직 맞지 않는다</span>'
             : '<span class="ok">같다 → 평형</span>'}</div>`;
  } else {
    const ideal = m.Pideal;
    const max = Math.max(220, m.Pdisp * 1.08, ideal * 1.08);
    $("eqBox").innerHTML =
      bar("벽에서 잰 압력", m.Pdisp, max, C.blue) +
      bar("PV = NkT 계산값", ideal, max, C.gray) +
      `<div style="margin-top:5px">${busy
        ? '<span class="warn">압력을 재는 중 — 4초쯤 뒤에 두 막대가 겹칩니다</span>'
        : '두 막대가 <b>겹친다.</b> 입자가 벽에 부딪혀 만든 압력이 곧 <b>PV = NkT</b> 다 — 식을 넣어 준 것이 아니라 <b>입자 운동에서 나온 결과</b>다.'}</div>`;
  }
}

/* ── 그래프 ── */
function drawGraph() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = grCv.width / dpr, ch = grCv.height / dpr;
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.fillStyle = C.stageLight; gctx.fillRect(0, 0, cw, ch);
  const pad = { l: 52, r: 16, t: 22, b: 34 };
  const mine = rows.filter(r => r.tab === tab);
  const m = gas.measure();
  const now = { T: Math.round(m.T), V: m.V, P: m.Pdisp, N: m.N,
                Pideal: m.N && m.T ? m.N * m.T / m.V * GAS.PSCALE : 0 };

  const PL = cw - pad.l - pad.r, PH = ch - pad.t - pad.b;
  const X = (v, a, b) => pad.l + (v - a) / (b - a || 1) * PL;
  const Y = (v, a, b) => (ch - pad.b) - (v - a) / (b - a || 1) * PH;
  const inside = y => y >= pad.t - 0.5 && y <= ch - pad.b + 0.5;
  const fitLine = (xs, ys) => {
    const n = xs.length; if (n < 2) return null;
    const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const den = n * sxx - sx * sx; if (!den) return null;
    const k = (n * sxy - sx * sy) / den;
    return { m: k, c: (sy - k * sx) / n };
  };
  const frame = (xlab, ylab) => {
    gctx.strokeStyle = AXIS_LIGHT; gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(pad.l, pad.t); gctx.lineTo(pad.l, ch - pad.b); gctx.lineTo(cw - pad.r, ch - pad.b);
    gctx.stroke();
    gctx.fillStyle = C.t3; gctx.font = "11px sans-serif";
    gctx.textAlign = "left"; gctx.fillText(ylab, 4, pad.t - 6);
    gctx.textAlign = "right"; gctx.fillText(xlab, cw - pad.r, ch - 6);
    gctx.textAlign = "left";
  };
  const grid = (x0, x1, y0, y1, fx, fy) => {
    gctx.font = "10.5px sans-serif";
    for (let i = 0; i <= 4; i++) {
      const xv = x0 + (x1 - x0) * i / 4, yv = y0 + (y1 - y0) * i / 4;
      gctx.strokeStyle = GRID_LIGHT; gctx.lineWidth = 1;
      if (i > 0) {
        gctx.beginPath(); gctx.moveTo(X(xv, x0, x1), pad.t); gctx.lineTo(X(xv, x0, x1), ch - pad.b); gctx.stroke();
        gctx.beginPath(); gctx.moveTo(pad.l, Y(yv, y0, y1)); gctx.lineTo(cw - pad.r, Y(yv, y0, y1)); gctx.stroke();
      }
      gctx.fillStyle = C.t3;
      gctx.textAlign = "center"; gctx.fillText(fx(xv), X(xv, x0, x1), ch - pad.b + 15);
      gctx.textAlign = "right"; gctx.fillText(fy(yv), pad.l - 6, Y(yv, y0, y1) + 3.5);
    }
    gctx.textAlign = "left";
  };
  const dot = (x, y, filled) => {
    if (!inside(y)) return;
    gctx.beginPath(); gctx.arc(x, y, filled ? 4.2 : 5.4, 0, 6.2832);
    if (filled) { gctx.fillStyle = C.blue; gctx.fill(); gctx.strokeStyle = C.stageLight; gctx.lineWidth = 1.5; gctx.stroke(); }
    else { gctx.fillStyle = C.stageLight; gctx.fill(); gctx.strokeStyle = C.blue; gctx.lineWidth = 2.6; gctx.stroke(); }
  };
  const seg = (x0, y0, x1, y1, col, dash, w) => {
    gctx.strokeStyle = col; gctx.lineWidth = w; gctx.setLineDash(dash);
    gctx.beginPath(); gctx.moveTo(x0, y0); gctx.lineTo(x1, y1); gctx.stroke(); gctx.setLineDash([]);
  };
  const hint = txt => {
    gctx.fillStyle = C.t3; gctx.font = "11px sans-serif";
    gctx.fillText(txt, pad.l + 6, pad.t + 13);
  };

  if (tab === "A") {
    const useInv = axisMode === "INV";
    const xv = r => useInv ? 1e4 / r.V : r.V / 1e4;
    const all = [...mine, now];
    const x1 = Math.max(...all.map(xv)) * 1.25, y1 = Math.max(...all.map(r => r.P)) * 1.25;
    frame(useInv ? "1 / V   (×10⁻⁴)" : "부피 V   (×10⁴)", "압력 P (a.u.)");
    grid(0, x1, 0, y1, v => v.toFixed(useInv ? 2 : 1), v => v.toFixed(0));
    const pvMean = mine.length ? mine.reduce((a, r) => a + r.P * r.V, 0) / mine.length : now.P * now.V;
    gctx.strokeStyle = C.gray; gctx.setLineDash([5, 4]); gctx.lineWidth = 1.8;
    gctx.beginPath();
    let started = false;
    for (let i = 1; i <= 110; i++) {
      const x = x1 * i / 110;
      const p = useInv ? pvMean * x * 1e-4 : pvMean / (x * 1e4);
      const py = Y(p, 0, y1), pxx = X(x, 0, x1);
      if (!inside(py)) { started = false; continue; }
      started ? gctx.lineTo(pxx, py) : gctx.moveTo(pxx, py); started = true;
    }
    gctx.stroke(); gctx.setLineDash([]);
    mine.forEach(r => dot(X(xv(r), 0, x1), Y(r.P, 0, y1), true));
    dot(X(xv(now), 0, x1), Y(now.P, 0, y1), false);
    if (!mine.length) hint("속이 빈 점이 『지금 상태』입니다. 기록하면 속이 찬 점으로 남습니다.");

  } else if (tab === "B") {
    const all = [...mine, now];
    const x1 = 640, y1 = Math.max(...all.map(r => r.V / 1e4)) * 1.25;
    frame("온도 T (K)", "부피 V (×10⁴)");
    gctx.fillStyle = BAND_LIGHT;
    gctx.fillRect(X(0, 0, x1), pad.t, X(90, 0, x1) - X(0, 0, x1), PH);
    grid(0, x1, 0, y1, v => v.toFixed(0), v => v.toFixed(1));
    gctx.fillStyle = C.t3; gctx.font = "9.5px sans-serif";
    gctx.save(); gctx.translate(X(46, 0, x1) + 3, pad.t + 5); gctx.rotate(Math.PI / 2);
    gctx.fillText("실제 N₂ 77 K · O₂ 90 K 액화", 0, 0); gctx.restore();
    gctx.font = "10px sans-serif"; gctx.textAlign = "center";
    [0, 273, 573].forEach(k => gctx.fillText("(" + (k - 273) + "℃)", X(k, 0, x1), ch - pad.b + 27));
    gctx.textAlign = "left";
    const f = fitLine(mine.map(r => r.T), mine.map(r => r.V / 1e4));
    if (f) {
      const t0 = Math.min(...mine.map(r => r.T)), t1 = Math.max(...mine.map(r => r.T));
      seg(X(0, 0, x1), Y(f.c, 0, y1), X(t0, 0, x1), Y(f.m * t0 + f.c, 0, y1), C.amber, [6, 4], 2);
      seg(X(t0, 0, x1), Y(f.m * t0 + f.c, 0, y1), X(t1, 0, x1), Y(f.m * t1 + f.c, 0, y1), C.blue, [], 3);
      const xint = -f.c / f.m;
      if (isFinite(xint) && Math.abs(xint) < 250) {
        gctx.fillStyle = C.amber; gctx.font = "600 11px sans-serif";
        gctx.fillText(`외삽선이 V = 0 과 만나는 곳: ${xint.toFixed(0)} K = ${(xint - 273).toFixed(0)} ℃`, pad.l + 6, pad.t + 13);
      }
    } else hint("온도를 바꿔 가며 2개 이상 기록하면 직선과 외삽선이 그려집니다.");
    mine.forEach(r => dot(X(r.T, 0, x1), Y(r.V / 1e4, 0, y1), true));
    dot(X(now.T, 0, x1), Y(now.V / 1e4, 0, y1), false);

  } else if (tab === "C") {
    const all = [...mine, now];
    const x1 = Math.max(...all.map(r => r.N)) * 1.25, y1 = Math.max(...all.map(r => r.V / 1e4)) * 1.25;
    frame("입자 수 N", "부피 V (×10⁴)");
    grid(0, x1, 0, y1, v => v.toFixed(0), v => v.toFixed(1));
    const f = fitLine(mine.map(r => r.N), mine.map(r => r.V / 1e4));
    if (f) {
      const n0 = Math.min(...mine.map(r => r.N)), n1 = Math.max(...mine.map(r => r.N));
      seg(X(0, 0, x1), Y(f.c, 0, y1), X(n0, 0, x1), Y(f.m * n0 + f.c, 0, y1), C.amber, [6, 4], 2);
      seg(X(n0, 0, x1), Y(f.m * n0 + f.c, 0, y1), X(n1, 0, x1), Y(f.m * n1 + f.c, 0, y1), C.blue, [], 3);
      gctx.fillStyle = C.amber; gctx.font = "600 11px sans-serif";
      gctx.fillText(`외삽선의 세로축 절편: ${f.c.toFixed(2)} — 0 에 가까울수록 V ∝ N`, pad.l + 6, pad.t + 13);
    } else hint("입자 수를 바꿔 가며 2개 이상 기록하면 직선이 그려집니다.");
    mine.forEach(r => dot(X(r.N, 0, x1), Y(r.V / 1e4, 0, y1), true));
    dot(X(now.N, 0, x1), Y(now.V / 1e4, 0, y1), false);

  } else {
    const all = [...mine, now];
    const hi = Math.max(...all.map(r => Math.max(r.P, r.Pideal))) * 1.2 || 1;
    frame("PV = NkT 로 계산한 압력 (a.u.)", "실제 측정 압력 (a.u.)");
    grid(0, hi, 0, hi, v => v.toFixed(0), v => v.toFixed(0));
    seg(X(0, 0, hi), Y(0, 0, hi), X(hi, 0, hi), Y(hi, 0, hi), C.gray, [5, 4], 1.8);
    hint("점이 이 선 위에 놓인다 = 입자 운동에서 나온 압력이 PV=NkT 와 같다");
    mine.forEach(r => dot(X(r.Pideal, 0, hi), Y(r.P, 0, hi), true));
    dot(X(now.Pideal, 0, hi), Y(now.P, 0, hi), false);
  }
}

/* ── 측정값 ── */
function updateReadouts() {
  const m = gas.measure();
  $("rP").textContent = m.Pdisp ? m.Pdisp.toFixed(1) : "–";
  $("rV").textContent = (m.V / 1e4).toFixed(2);
  $("rT").textContent = m.T.toFixed(0);
  $("rN").textContent = m.N;
  const z = m.Z, ro = $("roZ"), busy = measuring();
  ro.classList.remove("is-ok", "is-warn");
  if (busy) {
    $("rP").textContent = m.Pdisp ? m.Pdisp.toFixed(1) : "–";
    $("rZ").textContent = "…";
    $("rZnote").textContent = "압력을 재는 중 — 잠시 기다리세요";
  } else if (z) {
    ro.classList.add("is-ok");
    $("rZ").textContent = z.toFixed(3);
    /* 이 모형은 이상 기체 모형이므로 이 값은 **언제나 1**이다. 그것이 요점이다.
       다만 슬라이더로 갈 수 있는 가장 붐비는 상태에서는 입자끼리 부딪히는 몫이
       조금 남아 1.0x 가 된다. 그때는 문구를 정직하게 바꾼다. */
    $("rZnote").textContent = z > 1.04
      ? "거의 1 — 가장 붐비는 극단 상태라 조금 벗어남"
      : "언제나 1 — 이상 기체 모형이니까";
  } else { $("rZ").textContent = "–"; $("rZnote").textContent = ""; }
}

/* ── 기록 ── */
const HEADERS = ["좌석번호", "법칙", "온도 T (K)", "온도 t (℃)", "압력 P (a.u.)",
  "부피 V (×10⁴)", "입자 수 N", "P·V (×10⁴)", "PV/NkT", "PV=NkT 예측 압력 (a.u.)"];
$("rec").onclick = () => {
  const m = gas.measure(), iso = TABS[tab].mode === "iso";
  if (iso && !m.settled) {
    $("recnote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">피스톤이 아직 움직이고 있습니다. 멈춘 뒤에 기록하세요.</span>';
    return;
  }
  if (!iso && measuring()) {
    $("recnote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">압력을 재는 중입니다. 4초쯤 뒤에 기록하세요.</span>';
    return;
  }
  /* 등압 탭에서 압력은 **우리가 정한 값**이다(조작 변인). 벽에서 잰 값은 옆에 확인용으로만 띄운다.
     부피 고정 탭에서 압력은 **관찰 변인**이므로 실제로 잰 값을 기록한다. */
  rows.push({
    tab, seat: $("seat").value.trim() || "(무기명)", law: TABS[tab].title,
    T: Math.round(m.T), V: m.V, P: iso ? m.PextDisp : m.Pdisp, N: m.N, Z: m.Z,
    Pideal: m.Pideal
  });
  $("recnote").innerHTML = '<span style="color:var(--d-green);font-weight:700">기록했습니다.</span>';
  renderTable();
};
$("clr").onclick = () => { rows = rows.filter(r => r.tab !== tab); $("recnote").textContent = ""; renderTable(); };
$("csv").onclick = () => {
  if (!rows.length) { $("recnote").innerHTML = '<span style="color:var(--d-amber);font-weight:700">먼저 데이터를 기록하세요.</span>'; return; }
  const body = rows.map(r => [r.seat, r.law, r.T, r.T - 273, r.P.toFixed(2),
    (r.V / 1e4).toFixed(3), r.N, (r.P * r.V / 1e4).toFixed(1), r.Z.toFixed(4), r.Pideal.toFixed(2)]);
  const csv = "﻿" + [HEADERS, ...body].map(a => a.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = (($("seat").value.trim() || "기체법칙").replace(/[\\/:*?"<>|]/g, "")) + "_기체법칙.csv";
  a.click(); URL.revokeObjectURL(a.href);
};
function renderTable() {
  const mine = rows.filter(r => r.tab === tab);
  $("recCount").textContent = rows.length ? `— 이 탭 ${mine.length}개 · 전체 ${rows.length}개` : "";
  const w = $("tableWrap");
  if (!mine.length) { w.innerHTML = '<div class="empty">아직 기록이 없습니다.</div>'; return; }
  const cols = {
    A: [["P (a.u.)", r => r.P.toFixed(1)], ["V (×10⁴)", r => (r.V / 1e4).toFixed(2)],
        ["P·V", r => (r.P * r.V / 1e4).toFixed(0)]],
    B: [["T (K)", r => r.T], ["t (℃)", r => r.T - 273], ["V (×10⁴)", r => (r.V / 1e4).toFixed(2)],
        ["V/T ×100", r => (r.V / 1e4 / r.T * 100).toFixed(2)]],
    C: [["N", r => r.N], ["V (×10⁴)", r => (r.V / 1e4).toFixed(2)],
        ["V/N ×100", r => (r.V / 1e4 / r.N * 100).toFixed(2)]],
    D: [["T (K)", r => r.T], ["N", r => r.N], ["V (×10⁴)", r => (r.V / 1e4).toFixed(2)],
        ["P (a.u.)", r => r.P.toFixed(1)], ["PV/NkT", r => r.Z.toFixed(3)]]
  }[tab];
  w.innerHTML = "<table><thead><tr><th>#</th>" + cols.map(c => `<th>${c[0]}</th>`).join("") +
    "</tr></thead><tbody>" +
    mine.map((r, i) => `<tr><td>${i + 1}</td>` + cols.map(c => `<td>${c[1](r)}</td>`).join("") + "</tr>").join("") +
    "</tbody></table>";
}

/* ── 컨트롤 ── */
S.T.oninput = e => { lastChange = Date.now(); gas.reset(); gas.setT(+e.target.value); syncLabels(); $("recnote").textContent = ""; };
S.P.oninput = e => { lastChange = Date.now(); gas.reset(); gas.setPextDisp(+e.target.value); syncLabels(); $("recnote").textContent = ""; };
S.N.oninput = e => { lastChange = Date.now(); gas.reset(); gas.setN(+e.target.value); syncLabels(); $("recnote").textContent = ""; };
S.W.oninput = e => { lastChange = Date.now(); gas.reset(); if (TABS[tab].mode === "fix") gas.setW(+e.target.value); syncLabels(); $("recnote").textContent = ""; };
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { tab = b.dataset.tab; applyTab(); });
$("pause").onchange = e => { running = !e.target.checked; };

/* ── 루프 ── */
let rafId = null;
function loop() {
  if (running) gas.frame(TABS[tab].mode === "iso");
  if (TABS[tab].mode === "iso") syncLabels();     // 피스톤이 움직이면 부피 표시도 따라간다
  drawBox(); drawGraph(); drawEqBox(); updateReadouts();
  rafId = requestAnimationFrame(loop);
}
document.addEventListener("visibilitychange", () => {     // 안 보이면 멈춘다 (배터리)
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
  else if (!rafId) loop();
});
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => resize());
  ro.observe(boxCv.parentElement); ro.observe(grCv.parentElement);
}
window.addEventListener("resize", resize);
/* 애니메이션 최소화를 켠 사용자는 일시정지로 시작한다 (매뉴얼 §10) */
if (matchMedia("(prefers-reduced-motion:reduce)").matches) { $("pause").checked = true; running = false; }

applyTab();
resize();
loop();
