/* ============================================================
   증기 압력 내림과 총괄성       (Ⅱ. 용액의 성질 / 차시 17·19·20, Ⅰ 차시 11)

   이 파일이 하는 일
     ① 밀폐 용기 속 동적 평형을 입자로 돌린다.
        증발 확률 ∝ X용매(용액 <b>전체</b>의 조성) , 응축 확률 ∝ 기체 분자 수
        → 평형에서 저절로  P = P° × X용매  (라울 법칙)이 나온다.
        "수면 덮기"를 켜면 증발·응축이 <b>같은 비율로</b> 줄어 평형은 그대로다.
        → 판서: "차단은 속도를 바꾸고, 평형을 바꾸지 않는다."
     ② 증기 압력 곡선의 교점 이동으로 끓는점 오름·어는점 내림을 <b>직접 푼다.</b>
     ③ 밀폐 용기 장기 시연 — 반투막 없이 증기상으로 물이 옮겨 간다.

   쓰는 식 (Node 검증 통과)
     순수한 물  log₁₀P(mmHg) = 8.07131 − 1730.63/(233.426 + t℃)   [Antoine]
        → 100 ℃ 760.1 / 25 ℃ 23.69 / 0 ℃ 4.542 mmHg
     얼음      P_ice(T) = P_liq(T)·exp[(ΔH융해/R)(1/273.15 − 1/T)],  ΔH융해 = 6008 J/mol
        → −10 ℃ 1.91 mmHg (실측 1.95)
     교점 풀이 결과 : ΔTb = 0.499 (Kb·m = 0.512) , ΔTf = 1.83 (Kf·m = 1.86)  [m = 1]
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var COL = {};
  (function () {
    COL.sky = css("--p-sky"); COL.yellow = css("--p-yellow"); COL.orange = css("--p-orange");
    COL.mint = css("--p-mint"); COL.violetP = css("--p-violet"); COL.silver = css("--p-silver");
    COL.blue = css("--d-blue"); COL.red = css("--d-red"); COL.amber = css("--d-amber");
    COL.green = css("--d-green"); COL.violet = css("--d-violet"); COL.cyan = css("--d-cyan");
    COL.gray = css("--d-gray"); COL.t1 = css("--t1"); COL.t2 = css("--t2"); COL.t3 = css("--t3");
  })();
  var REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---------- 물리 계산 ---------- */
  var R = 8.314, DHFUS = 6008, T0 = 273.15;
  var N_WATER = 55.508;                                   // 물 1 kg 안의 물의 몰수
  function Pliq(tC) { return Math.pow(10, 8.07131 - 1730.63 / (233.426 + tC)); }   // mmHg
  function Pice(tC) { return Pliq(tC) * Math.exp((DHFUS / R) * (1 / T0 - 1 / (tC + 273.15))); }
  function Xw(molParticles) { return N_WATER / (N_WATER + molParticles); }
  // 용액의 끓는점 : 용액의 증기 압력이 외부 압력과 같아지는 온도
  function boilPoint(x, Pext) {
    var lo = 20, hi = 200, mid, i;
    for (i = 0; i < 120; i++) { mid = (lo + hi) / 2; if (Pliq(mid) * x < Pext) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // 용액의 어는점 : 액체 곡선과 얼음 곡선이 만나는 온도 (얼음에는 용질이 들어가지 못한다)
  function freezePoint(x) {
    var lo = -40, hi = 0.001, mid, i;
    for (i = 0; i < 120; i++) { mid = (lo + hi) / 2; if (Pliq(mid) * x < Pice(mid)) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }

  /* ---------- 캔버스 ---------- */
  function makeCanvas(wrapId, cvId) {
    var wrap = $(wrapId), cv = $(cvId), ctx = cv.getContext("2d");
    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = wrap.clientWidth, h = wrap.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      cv.style.width = w + "px"; cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h };
    }
    var s = fit();
    if (window.ResizeObserver) new ResizeObserver(function () { s = fit(); }).observe(wrap);
    else window.addEventListener("resize", function () { s = fit(); });
    return { ctx: ctx, get w() { return s.w; }, get h() { return s.h; }, fit: fit };
  }
  var M = makeCanvas("wrapMain", "cvMain");

  /* ---------- 상태 ---------- */
  var tab = "A";
  var SOLUTES = [
    { name: "설탕", full: "설탕 (자당, M = 342)", hb: "물과 수소 결합을 <b>한다</b>", r: 9, col: "violetP" },
    { name: "요소", full: "요소 (M = 60)", hb: "물과 수소 결합을 <b>한다</b>", r: 6, col: "mint" },
    { name: "무극성 용질", full: "무극성 용질", hb: "물과 수소 결합을 <b>전혀 하지 않는다</b>", r: 7, col: "orange" }
  ];
  var A = {
    mol: 0, T: 25, solute: 0, block: false, running: !REDUCED,
    vapor: [], liquid: [], sol: [], evap: 0, cond: 0, t: 0
  };
  var B = { m: 1, i: 1, Pext: 760, zoom: 0 };
  var C = { conc: 4, day: 0, playing: false, vL: 20, vR: 20 };
  var logRows = [];

  /* ── ① 입자 초기화 ── */
  var LIQ_N = 74;      // 액체 속에 그릴 물 분자 (보이는 것만; 계산은 몰분율로 한다)
  function initA() {
    A.vapor = []; A.liquid = []; A.sol = []; A.evap = 0; A.cond = 0; A.t = 0;
    var i;
    for (i = 0; i < LIQ_N; i++) A.liquid.push({ x: Math.random(), y: Math.random() });
    rebuildSolute();
  }
  function rebuildSolute() {
    A.sol = [];
    // 용질 입자는 액체 "전체"에 고르게 흩어 놓는다 — 수면에 깔지 않는다(오개념 방지)
    var n = Math.round(A.mol * 3);
    for (var i = 0; i < n; i++) A.sol.push({ x: Math.random(), y: Math.random() });
  }
  initA();

  /* ---------- ① 그리기 · 계산 ---------- */
  var VAP_SCALE = 0.62;   // 화면에 그릴 기체 분자 수 = 증기 압력(mmHg) × 이 값
  function stepA() {
    var x = Xw(A.mol), Ppure = Pliq(A.T), Psol = Ppure * x;
    var target = Psol * VAP_SCALE;                 // 평형에서 도달해야 할 기체 분자 수
    var blockF = A.block ? 0.25 : 1;               // 막으로 덮으면 양쪽 다 같은 비율로 줄어든다
    var kE = 0.020 * blockF, kC = kE / Math.max(target, 0.001);

    // 증발 : 확률 ∝ X용매 (용액 전체의 조성)  ※ "표면이 몇 %나 덮였는가"가 아니다
    var nEvapTry = kE * 60 * x * 2.4;
    var i;
    for (i = 0; i < Math.floor(nEvapTry) + (Math.random() < (nEvapTry % 1) ? 1 : 0); i++) {
      if (A.vapor.length > 400) break;
      A.vapor.push({ x: Math.random() * 0.9 + 0.05, y: 0.98, vx: (Math.random() - 0.5) * 0.012, vy: -0.006 - Math.random() * 0.008 });
      A.evap++;
    }
    // 응축 : 확률 ∝ 기체 분자 수
    var nCondTry = kC * 60 * A.vapor.length * 2.4;
    for (i = 0; i < Math.floor(nCondTry) + (Math.random() < (nCondTry % 1) ? 1 : 0); i++) {
      if (!A.vapor.length) break;
      A.vapor.splice(Math.floor(Math.random() * A.vapor.length), 1);
      A.cond++;
    }
    // 기체 분자 움직이기
    for (i = 0; i < A.vapor.length; i++) {
      var p = A.vapor[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0.02 || p.x > 0.98) p.vx *= -1;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -1; }
      if (p.y > 0.99) { p.y = 0.99; p.vy = -Math.abs(p.vy); }
    }
    // 액체 속 분자 살짝 흔들기
    for (i = 0; i < A.liquid.length; i++) {
      A.liquid[i].x += (Math.random() - 0.5) * 0.006;
      A.liquid[i].y += (Math.random() - 0.5) * 0.006;
      A.liquid[i].x = Math.min(1, Math.max(0, A.liquid[i].x));
      A.liquid[i].y = Math.min(1, Math.max(0, A.liquid[i].y));
    }
  }

  function drawA() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 14, bx = pad, by = 26, bw = w - pad * 2, bh = h - by - 34;
    var liqTop = by + bh * 0.56;

    ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    // 액체
    ctx.fillStyle = "rgba(86,180,233,0.13)";
    ctx.fillRect(bx + 1, liqTop, bw - 2, by + bh - liqTop - 1);
    ctx.strokeStyle = "rgba(86,180,233,0.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + 1, liqTop); ctx.lineTo(bx + bw - 1, liqTop); ctx.stroke();

    // 막 (켰을 때만)
    if (A.block) {
      ctx.fillStyle = "rgba(203,213,225,0.75)";
      ctx.fillRect(bx + 1, liqTop - 5, bw - 2, 5);
      ctx.fillStyle = COL.silver; ctx.font = "600 11px inherit"; ctx.textAlign = "right";
      ctx.fillText("덮개(막)", bx + bw - 6, liqTop - 9);
    }

    var i, p;
    // 액체 속 물 분자
    ctx.fillStyle = COL.sky;
    for (i = 0; i < A.liquid.length; i++) {
      p = A.liquid[i];
      ctx.beginPath();
      ctx.arc(bx + 8 + p.x * (bw - 16), liqTop + 8 + p.y * (by + bh - liqTop - 16), 3.6, 0, 6.2832);
      ctx.fill();
    }
    // 용질 — 액체 전체에 흩어져 있다 (수면에 깔지 않는다)
    var s = SOLUTES[A.solute];
    ctx.fillStyle = COL[s.col];
    for (i = 0; i < A.sol.length; i++) {
      p = A.sol[i];
      ctx.beginPath();
      ctx.arc(bx + 10 + p.x * (bw - 20), liqTop + 10 + p.y * (by + bh - liqTop - 20), s.r * 0.62, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.45)"; ctx.lineWidth = 1; ctx.stroke();
    }
    // 기체
    ctx.fillStyle = COL.yellow;
    for (i = 0; i < A.vapor.length; i++) {
      p = A.vapor[i];
      ctx.beginPath();
      ctx.arc(bx + 6 + p.x * (bw - 12), by + 6 + p.y * (liqTop - by - 12), 3.2, 0, 6.2832);
      ctx.fill();
    }

    ctx.fillStyle = COL.silver; ctx.font = "600 12.5px inherit"; ctx.textAlign = "left";
    ctx.fillText("기체 (증기)", bx + 8, by + 16);
    ctx.fillText("액체 — 용질은 액체 <전체>에 퍼져 있다", bx + 8, liqTop + 18);
    ctx.textAlign = "right"; ctx.fillStyle = COL.mint; ctx.font = "700 13px inherit";
    ctx.fillText("증기 분자 " + A.vapor.length + " 개", bx + bw - 8, by + 16);
    ctx.textAlign = "left";
  }

  /* ---------- ② 증기 압력 곡선 ---------- */
  function drawB() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var L = 56, Rp = 16, T = 18, Bm = 44, pw = w - L - Rp, ph = h - T - Bm;
    var mp = B.m * B.i, x = Xw(mp);
    var tb0 = boilPoint(1, B.Pext), tb = boilPoint(x, B.Pext);
    var tf0 = freezePoint(1), tf = freezePoint(x);

    var t1, t2, p1, p2;
    if (B.zoom === 1) { t1 = Math.min(tb0, tb) - 3; t2 = Math.max(tb0, tb) + 3; p1 = B.Pext * 0.86; p2 = B.Pext * 1.14; }
    // 어는점 부근은 압력이 4 mmHg 안팎이라 0부터 그리면 곡선이 위쪽에 눌린다.
    // 보이는 구간의 최솟값 근처부터 그려야 교점이 눈에 들어온다.
    else if (B.zoom === 2) {
      t1 = Math.min(tf0, tf) - 4; t2 = 3;
      p1 = Math.max(0, Pice(t1) * 0.72); p2 = Pliq(t2) * 1.06;
    }
    else { t1 = -25; t2 = 110; p1 = 0; p2 = 900; }

    var X = function (t) { return L + (t - t1) / (t2 - t1) * pw; };
    var Y = function (P) { return T + ph - (P - p1) / (p2 - p1) * ph; };

    // 격자
    ctx.strokeStyle = "rgba(40,45,52,0.055)"; ctx.lineWidth = 1;
    var i;
    for (i = 1; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(L, T + ph * i / 6); ctx.lineTo(L + pw, T + ph * i / 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L + pw * i / 6, T); ctx.lineTo(L + pw * i / 6, T + ph); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(40,45,52,0.18)";
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();

    function curve(fn, color, dash, lw) {
      ctx.beginPath();
      var started = false;
      for (i = 0; i <= 320; i++) {
        var t = t1 + (t2 - t1) * i / 320, P = fn(t);
        if (P < p1 - 1 || P > p2 * 1.5) { started = false; continue; }
        var xx = X(t), yy = Y(P);
        if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy);
      }
      ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    }
    // 얼음(고체) 곡선 — 용질을 넣어도 <b>변하지 않는다</b>
    if (B.zoom !== 1) curve(function (t) { return t <= 0.5 ? Pice(t) : NaN; }, COL.violet, [], 2.6);
    curve(function (t) { return Pliq(t); }, COL.blue, [], 2.6);
    if (mp > 0) curve(function (t) { return Pliq(t) * x; }, COL.red, [7, 4], 2.6);

    // 외부 압력 수평선
    if (B.zoom !== 2) {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(L, Y(B.Pext)); ctx.lineTo(L + pw, Y(B.Pext)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL.amber; ctx.font = "700 11.5px inherit"; ctx.textAlign = "left";
      ctx.fillText("외부 압력 " + B.Pext + " mmHg", L + 6, Y(B.Pext) - 6);
    }

    // 교점 표시
    // 순수한 물 표시는 점 위에, 용액 표시는 점 아래에 둔다.
    // "전체" 구간에서는 두 점이 거의 붙으므로 위아래로 갈라야 글자가 겹치지 않는다.
    function mark(t, P, color, label, below) {
      if (t < t1 || t > t2 || P < p1 || P > p2) return;
      ctx.beginPath(); ctx.arc(X(t), Y(P), 5, 0, 6.2832);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = "700 11.5px inherit"; ctx.textAlign = "center";
      var tw = ctx.measureText(label).width, ly = Y(P) + (below ? 20 : -11);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillRect(X(t) - tw / 2 - 3, ly - 11, tw + 6, 15);
      ctx.fillStyle = color; ctx.fillText(label, X(t), ly);
    }
    if (B.zoom !== 2) {
      mark(tb0, B.Pext, COL.blue, "순수 " + tb0.toFixed(2) + " ℃", false);
      if (mp > 0) mark(tb, B.Pext, COL.red, "용액 " + tb.toFixed(2) + " ℃", true);
    }
    if (B.zoom !== 1) {
      mark(tf0, Pice(tf0), COL.violet, "순수 " + tf0.toFixed(2) + " ℃", false);
      if (mp > 0) mark(tf, Pice(tf), COL.red, "용액 " + tf.toFixed(2) + " ℃", true);
    }

    // 축
    ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "center";
    for (i = 0; i <= 6; i++) ctx.fillText((t1 + (t2 - t1) * i / 6).toFixed(B.zoom ? 1 : 0), L + pw * i / 6, T + ph + 15);
    ctx.fillText("온도 (℃)", L + pw / 2, T + ph + 31);
    ctx.textAlign = "right";
    for (i = 0; i <= 3; i++) ctx.fillText((p1 + (p2 - p1) * i / 3).toFixed(B.zoom === 2 ? 1 : 0), L - 6, T + ph - ph * i / 3 + 4);
    ctx.save(); ctx.translate(15, T + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillText("증기 압력 (mmHg)", 0, 0); ctx.restore();
    ctx.textAlign = "left";
  }

  /* ---------- ③ 밀폐 용기 장기 시연 ---------- */
  function stepC() {
    // 물 부피(mL) 두 접시. 오른쪽에는 설탕이 녹아 있다(설탕의 몰수는 변하지 않는다).
    // 증기상을 통한 이동 속도 ∝ (왼쪽 증기압 − 오른쪽 증기압) ∝ (X왼 − X오)
    var day = C.day;
    var nS = C.conc * 0.020;                       // 오른쪽 접시(20 mL)에 녹은 용질 몰수
    var total = 40;                                 // 두 접시 물 부피 합 (mL)
    // 수치적분 (하루를 0.5일 간격으로)
    var vL = 20, vR = 20, k = 1.1, i, dt = 0.5;
    for (i = 0; i * dt < day; i++) {
      var nL = vL / 18.0, nR = vR / 18.0;            // 물의 몰수 (밀도 1 g/mL, M = 18)
      var xL = 1, xR = nR / (nR + nS);
      var flow = k * (xL - xR) * dt;
      if (flow > vL) flow = vL;
      vL -= flow; vR += flow;
      if (vL <= 0.001) { vL = 0; vR = total; break; }
    }
    C.vL = vL; C.vR = vR;
  }
  function drawC() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 16, bx = pad, by = 24, bw = w - pad * 2, bh = h - by - 30;
    ctx.strokeStyle = "rgba(148,163,184,0.55)"; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = COL.silver; ctx.font = "600 12px inherit"; ctx.textAlign = "center";
    ctx.fillText("밀폐 용기 (뚜껑을 닫아 두었다)", bx + bw / 2, by - 8);

    // 증기 분자 몇 개 (왼쪽 → 오른쪽 흐름을 상징)
    var t = Date.now() / 1000;
    for (var i = 0; i < 22; i++) {
      var ph2 = (t * 0.28 + i / 22) % 1;
      var xx = bx + 40 + ph2 * (bw - 80);
      var yy = by + 34 + Math.sin(i * 2.1 + t * 1.3) * 16 + (i % 3) * 12;
      ctx.beginPath(); ctx.arc(xx, yy, 3.1, 0, 6.2832);
      ctx.fillStyle = COL.yellow; ctx.globalAlpha = C.vL > 0 ? 0.9 : 0.25; ctx.fill(); ctx.globalAlpha = 1;
    }
    if (C.vL > 0) {
      ctx.strokeStyle = COL.mint; ctx.lineWidth = 2; ctx.textAlign = "center";
      var ay = by + 26;
      ctx.beginPath(); ctx.moveTo(bx + bw * 0.34, ay); ctx.lineTo(bx + bw * 0.66, ay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw * 0.66, ay); ctx.lineTo(bx + bw * 0.66 - 9, ay - 5);
      ctx.lineTo(bx + bw * 0.66 - 9, ay + 5); ctx.closePath(); ctx.fillStyle = COL.mint; ctx.fill();
    }

    // 접시 두 개
    function dish(cx, vol, isSol, label) {
      var dw = bw * 0.30, dh = bh * 0.42, dx = cx - dw / 2, dy = by + bh - dh - 22;
      ctx.strokeStyle = "rgba(203,213,225,0.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx, dy + dh); ctx.lineTo(dx + dw, dy + dh);
      ctx.lineTo(dx + dw, dy); ctx.stroke();
      var frac = Math.min(1, vol / 40);
      var lh = dh * frac * 1.6;
      lh = Math.min(lh, dh - 4);
      ctx.fillStyle = isSol ? "rgba(167,139,250,0.30)" : "rgba(86,180,233,0.28)";
      ctx.fillRect(dx + 2, dy + dh - lh, dw - 4, lh);
      ctx.strokeStyle = isSol ? COL.violetP : COL.sky; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dx + 2, dy + dh - lh); ctx.lineTo(dx + dw - 2, dy + dh - lh); ctx.stroke();
      if (isSol) {
        ctx.fillStyle = COL.violetP;
        for (var j = 0; j < 14; j++) {
          var px = dx + 8 + ((j * 37) % Math.max(1, (dw - 16)));
          var py = dy + dh - 6 - ((j * 23) % Math.max(1, lh - 8));
          ctx.beginPath(); ctx.arc(px, py, 3.4, 0, 6.2832); ctx.fill();
        }
      }
      ctx.fillStyle = COL.silver; ctx.font = "600 12.5px inherit"; ctx.textAlign = "center";
      ctx.fillText(label, cx, dy + dh + 16);
      ctx.fillStyle = isSol ? COL.violetP : COL.sky; ctx.font = "700 14px inherit";
      ctx.fillText(vol.toFixed(1) + " mL", cx, dy - 8);
    }
    dish(bx + bw * 0.25, C.vL, false, "순수한 물");
    dish(bx + bw * 0.75, C.vR, true, "진한 설탕물");
    ctx.textAlign = "left";
  }

  /* ---------- 측정값 ---------- */
  function readout(label, value, unit, cls) {
    return '<div class="readout ' + (cls || "") + '"><div class="label">' + label +
      '</div><div><span class="value">' + value + '</span>' +
      (unit ? '<span class="unit">' + unit + "</span>" : "") + "</div></div>";
  }
  function updateReadouts() {
    var html = "";
    if (tab === "A") {
      var x = Xw(A.mol), P0 = Pliq(A.T), P = P0 * x;
      html += readout("용매의 몰분율 X<sub>물</sub>", x.toFixed(4), "");
      html += readout("순수한 물의 증기 압력 P°", P0.toFixed(1), "mmHg");
      html += readout("용액의 증기 압력 P°·X", P.toFixed(1), "mmHg", A.mol > 0 ? "is-warn" : "");
      html += readout("증기 압력 내림 ΔP", (P0 - P).toFixed(2), "mmHg", A.mol > 0 ? "is-bad" : "");
      $("cEvap").textContent = A.evap.toLocaleString("ko-KR");
      $("cCond").textContent = A.cond.toLocaleString("ko-KR");
      $("cVap").textContent = A.vapor.length;
    } else if (tab === "B") {
      var mp = B.m * B.i, xx = Xw(mp);
      var tb0 = boilPoint(1, B.Pext), tb = boilPoint(xx, B.Pext);
      var tf0 = freezePoint(1), tf = freezePoint(xx);
      html += readout("끓는점 (순수 → 용액)", tb0.toFixed(2) + " → " + tb.toFixed(2), "℃");
      html += readout("끓는점 오름 ΔT<sub>b</sub>", (tb - tb0).toFixed(3), "℃", "is-warn");
      html += readout("어는점 (순수 → 용액)", tf0.toFixed(2) + " → " + tf.toFixed(2), "℃");
      html += readout("어는점 내림 ΔT<sub>f</sub>", (tf0 - tf).toFixed(3), "℃", "is-bad");
      html += readout("K<sub>b</sub>·m (0.512)", (0.512 * mp).toFixed(3), "℃");
      html += readout("K<sub>f</sub>·m (1.86)", (1.86 * mp).toFixed(3), "℃");
    } else {
      var nS = C.conc * 0.020, nR = C.vR / 18.0;
      var xR = nR / (nR + nS);
      html += readout("순수한 물 (왼쪽)", C.vL.toFixed(1), "mL", C.vL < 5 ? "is-bad" : "");
      html += readout("설탕물 (오른쪽)", C.vR.toFixed(1), "mL", "is-ok");
      html += readout("왼쪽의 증기 압력", Pliq(25).toFixed(2), "mmHg");
      html += readout("오른쪽의 증기 압력", (Pliq(25) * xR).toFixed(2), "mmHg", "is-warn");
    }
    $("readouts").innerHTML = html;
  }

  /* ---------- 표 · 결론 ---------- */
  function updateTable() {
    var t = $("mainTbl"), html = "", k;
    if (tab === "A") {
      $("tblTitle").innerHTML = "같은 몰수의 서로 다른 용질 — " + A.T + " ℃";
      html = "<tr><th>용질</th><th>분자량</th><th>수소 결합</th><th>넣은 몰수</th><th>X<sub>물</sub></th><th>증기 압력</th></tr>";
      var P0 = Pliq(A.T), x = Xw(A.mol);
      var rows = [["설탕(자당)", 342, "함", A.mol], ["요소", 60, "함", A.mol], ["무극성 용질", "—", "안 함", A.mol]];
      for (k = 0; k < rows.length; k++) {
        html += "<tr" + (k === A.solute ? ' style="background:#f8fafc"' : "") + "><td>" + rows[k][0] +
          "</td><td>" + rows[k][1] + "</td><td>" + rows[k][2] + "</td><td>" + A.mol.toFixed(1) +
          " mol</td><td>" + x.toFixed(4) + "</td><td><b>" + (P0 * x).toFixed(2) + " mmHg</b></td></tr>";
      }
      $("tblNote").innerHTML = "세 줄의 증기 압력이 <b>완전히 같다.</b> " +
        "분자량도 수소 결합 여부도 다른데 결과가 같다 → " +
        "<b>총괄성의 뿌리는 수소 결합이 아니라 입자 수(몰분율)다.</b>";
    } else if (tab === "B") {
      $("tblTitle").innerHTML = "몰랄 농도에 따른 끓는점 오름·어는점 내림 — 입자 수 배수 " + B.i;
      html = "<tr><th>m (mol/kg)</th><th>입자 몰랄 농도</th><th>X<sub>물</sub></th><th>ΔT<sub>b</sub> 교점풀이</th>" +
        "<th>K<sub>b</sub>·m</th><th>ΔT<sub>f</sub> 교점풀이</th><th>K<sub>f</sub>·m</th></tr>";
      var list = [0, 0.25, 0.5, 1, 1.5, 2, 3];
      var tb0 = boilPoint(1, B.Pext), tf0 = freezePoint(1);
      for (k = 0; k < list.length; k++) {
        var m = list[k], mp = m * B.i, xx = Xw(mp);
        html += "<tr" + (Math.abs(m - B.m) < 0.05 ? ' style="background:#f8fafc"' : "") + "><td>" + m.toFixed(2) +
          "</td><td>" + mp.toFixed(2) + "</td><td>" + xx.toFixed(4) +
          "</td><td>" + (boilPoint(xx, B.Pext) - tb0).toFixed(3) + "</td><td>" + (0.512 * mp).toFixed(3) +
          "</td><td>" + (tf0 - freezePoint(xx)).toFixed(3) + "</td><td>" + (1.86 * mp).toFixed(3) + "</td></tr>";
      }
      $("tblNote").innerHTML = "교점 풀이 값이 K·m 보다 조금 작다. <b>K를 쓰는 식이 묽은 용액 근사이기 때문</b>이며, " +
        "농도가 진해질수록 차이가 커진다 — <b>법칙에는 성립 조건이 있다.</b>";
    } else {
      $("tblTitle").innerHTML = "시간에 따른 두 접시의 물 부피";
      html = "<tr><th>지난 시간(일)</th><th>순수한 물 (mL)</th><th>설탕물 (mL)</th><th>왼쪽 증기압</th><th>오른쪽 증기압</th></tr>";
      var save = C.day, days = [0, 2, 5, 10, 14, 21, 30];
      for (k = 0; k < days.length; k++) {
        C.day = days[k]; stepC();
        var nS2 = C.conc * 0.020, nR2 = C.vR / 18.0, xR2 = nR2 / (nR2 + nS2);
        html += "<tr" + (Math.abs(days[k] - save) < 1 ? ' style="background:#f8fafc"' : "") + "><td>" + days[k] +
          "</td><td>" + C.vL.toFixed(1) + "</td><td>" + C.vR.toFixed(1) +
          "</td><td>" + Pliq(25).toFixed(2) + "</td><td>" + (Pliq(25) * xR2).toFixed(2) + "</td></tr>";
      }
      C.day = save; stepC();
      $("tblNote").innerHTML = "왼쪽과 오른쪽의 증기 압력이 다른 한, 이동은 멈추지 않는다. " +
        "<b>순수한 물이 다 마를 때까지</b> 계속된다.";
    }
    t.innerHTML = html;
  }

  var CONCL = {
    A: '<b>판서 ①</b> 차단은 <u>속도</u>를 바꾸고, <u>평형</u>을 바꾸지 않는다. ' +
       '수면을 덮으면 나가는 것도 들어오는 것도 똑같이 막힌다.<br>' +
       '<b>판서 ②</b> 표면의 문제가 아니라 <u>조성</u>의 문제다. ' +
       'X<sub>용매</sub>는 <b>용액 전체</b>에서 물 분자가 차지하는 비율이다.<br>' +
       '<b>라울 법칙</b> <span style="color:var(--t3)">[비휘발성·비전해질 용질, 묽은 용액]</span> ' +
       '<b>P<sub>용액</sub> = P°<sub>용매</sub> × X<sub>용매</sub></b>',
    B: '<b>끓는점 오름의 인과 사슬</b> 용질 첨가 → 증기 압력 내림 → 같은 온도에서 외부 압력에 못 미침 → ' +
       '<b>더 가열해야</b> 도달 → 끓는점 상승.<br>' +
       '<b>어는점 내림 (대칭 구조)</b> <b>얼음(순수한 고체)에는 용질이 들어가지 못한다.</b> ' +
       '그래서 <u>액체 곡선만</u> 내려가고 고체 곡선은 그대로다. ' +
       '두 곡선이 만나는 온도가 더 낮은 쪽으로 옮겨간다.',
    C: '<b>반투막도 없고 두 액체가 닿지도 않았는데 물이 옮겨 갔다.</b> ' +
       '증기 압력이 낮은 쪽(설탕물)으로 증기상을 통해 물이 이동한 것이다.<br>' +
       '→ ⓐ 증기 압력 내림과 삼투가 <b>같은 뿌리</b>임을 물리적으로 보여 준다<br>' +
       '→ ⓑ “반투막은 구멍 크기로 거르는 체”라는 오개념을 미리 무너뜨린다 (막이 아예 없다)<br>' +
       '→ ⓒ “삼투는 액체에서만 일어난다”도 함께 처리된다'
  };
  var LEG = {
    A: '<span class="item"><span class="swatch" style="background:var(--p-sky)"></span>액체 속 물 분자</span>' +
       '<span class="item"><span class="swatch" style="background:var(--p-yellow)"></span>기체가 된 물 분자</span>' +
       '<span class="item"><span class="swatch" id="legSol" style="background:var(--p-violet)"></span><span id="legSolT">용질(설탕)</span></span>',
    B: '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>순수한 물(액체)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-red)"></span>용액(파선)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-violet)"></span>얼음(고체) — <b>용질과 무관</b></span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-amber)"></span>외부 압력</span>',
    C: '<span class="item"><span class="swatch" style="background:var(--p-sky)"></span>순수한 물</span>' +
       '<span class="item"><span class="swatch" style="background:var(--p-violet)"></span>설탕물</span>' +
       '<span class="item"><span class="swatch" style="background:var(--p-yellow)"></span>증기상의 물 분자</span>'
  };

  /* ---------- 루프 ---------- */
  var visible = true, raf = null;
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) loop(); });
  function loop() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { raf = null; if (!visible) return; tick(); loop(); });
  }
  function tick() {
    if (tab === "A") {
      if (A.running) { stepA(); A.t++; if (A.t % 6 === 0) updateReadouts(); }
      drawA();
    } else if (tab === "B") {
      drawB();
    } else {
      if (C.playing) {
        C.day = Math.min(140, C.day + 0.5);
        $("sDay").value = C.day; $("vDay").textContent = C.day.toFixed(1) + " 일";
        if (C.day >= 140) { C.playing = false; $("btnPlay").textContent = "시간 빨리 돌리기"; }
        stepC(); updateReadouts();
      }
      drawC();
    }
  }

  /* ---------- 화면 전환 ---------- */
  function setTab(t) {
    tab = t;
    $("tabA").className = "tab" + (t === "A" ? " on" : "");
    $("tabB").className = "tab" + (t === "B" ? " on" : "");
    $("tabC").className = "tab" + (t === "C" ? " on" : "");
    $("ctlA").hidden = t !== "A"; $("ctlB").hidden = t !== "B"; $("ctlC").hidden = t !== "C";
    $("boxCount").hidden = t !== "A";
    var wrap = $("wrapMain");
    // ② 탭은 그래프이므로 밝은 무대, 나머지는 입자를 보는 어두운 무대
    wrap.className = "stage stagewrap " + (t === "B" ? "stage--light" : "stage--dark");
    $("stageTitle").innerHTML = t === "A" ? "밀폐 용기 안의 동적 평형"
      : t === "B" ? "증기 압력 곡선 — 액체 곡선만 내려간다" : "밀폐 용기 장기 시연 (차시 17 설치 → 차시 20 회수)";
    $("stageNote").innerHTML = t === "A" ? "증발과 응축은 <b>둘 다</b> 계속 일어난다"
      : t === "B" ? "곡선이 만나는 점을 손으로 짚어 보자" : "두 액체는 서로 닿아 있지 않다";
    $("legendMain").innerHTML = LEG[t];
    if (t === "A") syncSoluteLegend();
    $("conclusion").innerHTML = CONCL[t];
    M.fit(); updateReadouts(); updateTable(); tick();
  }
  function syncSoluteLegend() {
    var el = $("legSol"), tx = $("legSolT");
    if (!el) return;
    el.style.background = "var(--p-" + (A.solute === 0 ? "violet" : A.solute === 1 ? "mint" : "orange") + ")";
    tx.textContent = "용질(" + SOLUTES[A.solute].name + ")";
  }

  /* ---------- 입력 ---------- */
  $("tabA").onclick = function () { setTab("A"); };
  $("tabB").onclick = function () { setTab("B"); };
  $("tabC").onclick = function () { setTab("C"); };

  $("sMol").oninput = function () {
    A.mol = +this.value; $("vMol").textContent = A.mol.toFixed(2) + " mol";
    rebuildSolute(); updateReadouts(); updateTable();
  };
  $("sT").oninput = function () { A.T = +this.value; $("vT").textContent = A.T + " °C"; updateReadouts(); updateTable(); };
  Array.prototype.forEach.call($("pickSolute").children, function (b) {
    b.onclick = function () {
      A.solute = +this.dataset.s;
      Array.prototype.forEach.call($("pickSolute").children, function (x) { x.className = "opt"; });
      this.className = "opt on";
      $("vSolute").textContent = SOLUTES[A.solute].name;
      $("hintSolute").innerHTML = SOLUTES[A.solute].full + " — " + SOLUTES[A.solute].hb +
        ". 그래도 <b>같은 몰수면 결과가 같다.</b>";
      syncSoluteLegend(); updateTable();
    };
  });
  $("ckBlock").onchange = function () {
    A.block = this.checked;
    $("stageNote").innerHTML = A.block
      ? "덮개를 씌웠다 — 증발도 응축도 <b>같은 비율로</b> 줄어든다"
      : "증발과 응축은 <b>둘 다</b> 계속 일어난다";
  };
  $("btnRun").onclick = function () { A.running = !A.running; this.textContent = A.running ? "일시정지" : "이어서 관찰"; };
  $("btnReset").onclick = function () { initA(); updateReadouts(); };

  $("sM2").oninput = function () { B.m = +this.value; $("vM2").textContent = B.m.toFixed(2) + " m"; updateReadouts(); updateTable(); drawB(); };
  Array.prototype.forEach.call($("pickI").children, function (b) {
    b.onclick = function () {
      B.i = +this.dataset.i;
      Array.prototype.forEach.call($("pickI").children, function (x) { x.className = "opt"; });
      this.className = "opt on";
      $("vI").textContent = B.i + " 개" + (B.i === 1 ? " (비전해질)" : " (전해질)");
      updateReadouts(); updateTable(); drawB();
    };
  });
  $("sPext").oninput = function () { B.Pext = +this.value; $("vPext").textContent = B.Pext + " mmHg"; updateReadouts(); updateTable(); drawB(); };
  Array.prototype.forEach.call($("pickZoom").children, function (b) {
    b.onclick = function () {
      B.zoom = +this.dataset.z;
      Array.prototype.forEach.call($("pickZoom").children, function (x) { x.className = "opt"; });
      this.className = "opt on";
      $("vZoom").textContent = ["전체", "끓는점 부근", "어는점 부근"][B.zoom];
      drawB();
    };
  });

  $("sMolC").oninput = function () {
    C.conc = +this.value; $("vMolC").textContent = C.conc.toFixed(1) + " mol/L";
    stepC(); updateReadouts(); updateTable();
  };
  $("sDay").oninput = function () {
    C.day = +this.value; $("vDay").textContent = C.day.toFixed(1) + " 일";
    stepC(); updateReadouts(); updateTable();
  };
  $("btnPlay").onclick = function () { C.playing = !C.playing; this.textContent = C.playing ? "멈추기" : "시간 빨리 돌리기"; };
  $("btnResetC").onclick = function () {
    C.day = 0; C.playing = false; $("btnPlay").textContent = "시간 빨리 돌리기";
    $("sDay").value = 0; $("vDay").textContent = "0.0 일"; stepC(); updateReadouts(); updateTable();
  };

  /* ---------- 기록 · CSV ---------- */
  function renderLog() {
    var t = $("logTbl");
    if (!logRows.length) { t.innerHTML = ""; $("logEmpty").hidden = false; return; }
    $("logEmpty").hidden = true;
    var html = "<tr><th>조건</th><th>측정값</th></tr>";
    for (var i = 0; i < logRows.length; i++) html += "<tr><td>" + logRows[i][1] + "</td><td>" + logRows[i][2] + "</td></tr>";
    t.innerHTML = html;
  }
  $("btnLog").onclick = function () {
    var who = $("who").value || "-";
    if (tab === "A") {
      var x = Xw(A.mol), P0 = Pliq(A.T);
      logRows.push([who, SOLUTES[A.solute].name + " " + A.mol.toFixed(1) + " mol, " + A.T + " ℃" + (A.block ? ", 덮개" : ""),
        "X물 " + x.toFixed(4) + " · P " + (P0 * x).toFixed(2) + " mmHg · ΔP " + (P0 - P0 * x).toFixed(2) +
        " · 증발 " + A.evap + "/응축 " + A.cond]);
    } else if (tab === "B") {
      var mp = B.m * B.i, xx = Xw(mp);
      logRows.push([who, "m " + B.m.toFixed(2) + " × 입자 " + B.i + ", 외부압 " + B.Pext,
        "ΔTb " + (boilPoint(xx, B.Pext) - boilPoint(1, B.Pext)).toFixed(3) +
        " ℃ · ΔTf " + (freezePoint(1) - freezePoint(xx)).toFixed(3) + " ℃"]);
    } else {
      logRows.push([who, "설탕 " + C.conc.toFixed(1) + " mol/L, " + C.day.toFixed(1) + "일 경과",
        "순수한 물 " + C.vL.toFixed(1) + " mL · 설탕물 " + C.vR.toFixed(1) + " mL"]);
    }
    renderLog();
  };
  $("btnClr").onclick = function () { logRows = []; renderLog(); };
  $("btnCsv").onclick = function () {
    if (!logRows.length) return;
    var csv = "﻿좌석번호,조건,측정값\n";
    for (var i = 0; i < logRows.length; i++)
      csv += logRows[i].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",") + "\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "증기압력내림_총괄성_기록.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- 시작 ---------- */
  if (REDUCED) $("btnRun").textContent = "이어서 관찰";
  stepC();
  setTab("A");
  renderLog();
  loop();
})();
