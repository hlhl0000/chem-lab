/* ============================================================
   삼투와 삼투압            (Ⅱ. 용액의 성질 / 차시 20)

   이 파일이 하는 일
     반투막을 사이에 둔 두 방에서 물 분자를 한 개씩 옮기며 <b>양방향 이동</b>을 센다.
     막을 건널 확률은 그 방의 <b>용매 몰분율</b>에 비례한다.
       ← "용질이 있으면 용매가 그 액체를 떠나기 어려워진다"는 단원의 한 문장을 그대로 규칙으로 삼은 것.
     걸어 준 압력 P는 반대 방향 확률에 exp(P·V̄/RT) 인자로 들어간다.
       → 순 이동이 0이 되는 압력 = −(RT/V̄)·ln X = 삼투압 (조작적 정의)
       → 묽은 용액에서 π = CRT (판트호프)로 수렴한다.

   ⚠ 하지 않는 것
     "묽은 쪽에 물이 빽빽해서 막에 더 자주 부딪힌다"는 설명은 쓰지 않는다.
     문헌이 오개념으로 특정한 설명이다(Kramer & Myers 2012).
     실제로 설탕물이 순수한 물보다 밀도가 크므로 학생의 즉각적 반문도 생긴다.

   Node 검증 통과
     0.1 M π = 2.447 atm / 1.2 M(해수) π = 29.36 atm  [판트호프]
     순 이동 0이 되는 압력 = 정확식 −(RT/V̄)lnX 와 완전히 일치
     정확식 vs CRT : 0.1 M 0.004 % · 1.2 M 1.0 % 차이 → "묽은 용액 근사"의 한계
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var COL = {};
  (function () {
    COL.sky = css("--p-sky"); COL.violetP = css("--p-violet"); COL.yellow = css("--p-yellow");
    COL.mint = css("--p-mint"); COL.silver = css("--p-silver"); COL.orange = css("--p-orange");
    COL.blue = css("--d-blue"); COL.red = css("--d-red"); COL.amber = css("--d-amber");
    COL.green = css("--d-green"); COL.violet = css("--d-violet"); COL.cyan = css("--d-cyan");
    COL.gray = css("--d-gray"); COL.t1 = css("--t1"); COL.t2 = css("--t2"); COL.t3 = css("--t3");
  })();
  var REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---------- 물리 ---------- */
  var R_Latm = 0.082057;       // L·atm/(mol·K)
  var VM = 0.018;              // 물의 몰부피 L/mol
  var N_WATER = 55.508;        // 물 1 L 안의 물의 몰수
  function Xsolv(C) { return N_WATER / (N_WATER + C); }            // 용매 몰분율
  function piVH(C, T) { return C * R_Latm * T; }                    // 판트호프 π = CRT
  function piExact(C, T) { return -(R_Latm * T / VM) * Math.log(Xsolv(C)); }
  // 두 방 사이의 삼투압 차 (진한 쪽 기준). 순 이동이 0이 되는 압력.
  function piBalance(CL, CR, T) {
    return (R_Latm * T / VM) * Math.log(Xsolv(CL) / Xsolv(CR));
  }
  // 순 이동 속도 (임의 단위) — 왼쪽 → 오른쪽이 양수
  function netRate(CL, CR, T, P) {
    var f = Math.exp(P * VM / (R_Latm * T));
    return Xsolv(CL) - Xsolv(CR) * f;
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
  var G = makeCanvas("wrapChart", "cvChart");

  /* ---------- 상태 ---------- */
  // 화면의 수위 1칸이 만드는 압력은 실제보다 크게 과장해 둔다(실제로는 1 atm = 물기둥 10.3 m).
  // 이 과장은 활동지 8번에서 "모형의 한계"로 직접 묻는다.
  var HYDRO_SCALE = 1.6;      // 수위차 1(임의 단위)당 atm
  var LEVEL_CAP = 6;          // 화면 밖으로 넘치지 않게 하는 상한
  var S = {
    CL: 0, CR: 0.3, T: 298.15, P: 0, hydro: false, running: !REDUCED,
    nLR: 0, nRL: 0, level: 0,           // level = 오른쪽이 왼쪽보다 높아진 정도 (임의 단위)
    waterL: [], waterR: [], solL: [], solR: [], flying: []
  };
  var logRows = [];

  function rebuild() {
    S.waterL = []; S.waterR = []; S.solL = []; S.solR = []; S.flying = [];
    var i;
    for (i = 0; i < 46; i++) S.waterL.push({ x: Math.random(), y: Math.random() });
    for (i = 0; i < 46; i++) S.waterR.push({ x: Math.random(), y: Math.random() });
    for (i = 0; i < Math.round(S.CL * 14); i++) S.solL.push({ x: Math.random(), y: Math.random() });
    for (i = 0; i < Math.round(S.CR * 14); i++) S.solR.push({ x: Math.random(), y: Math.random() });
  }
  rebuild();

  function effectiveP() { return S.P + (S.hydro ? S.level * HYDRO_SCALE : 0); }

  /* ---------- 한 걸음 ---------- */
  var acc = 0;
  function step() {
    var P = effectiveP();
    var f = Math.exp(P * VM / (R_Latm * S.T));
    var pLR = Xsolv(S.CL), pRL = Xsolv(S.CR) * f;
    // 매 프레임 평균 2.2회의 "건너기 시도"를 만든다
    acc += 2.2;
    while (acc >= 1) {
      acc -= 1;
      // 어느 방향의 시도인지 확률적으로 고른다
      var tot = pLR + pRL;
      if (tot <= 0) break;
      if (Math.random() < pLR / tot) {
        S.nLR++; S.level += 0.02;
        S.flying.push({ dir: 1, t: 0, y: 0.12 + Math.random() * 0.76 });
      } else {
        S.nRL++; S.level -= 0.02;
        S.flying.push({ dir: -1, t: 0, y: 0.12 + Math.random() * 0.76 });
      }
    }
    if (S.level > LEVEL_CAP) S.level = LEVEL_CAP;
    if (S.level < -LEVEL_CAP) S.level = -LEVEL_CAP;
    // 날아가는 표시 정리
    for (var i = S.flying.length - 1; i >= 0; i--) {
      S.flying[i].t += 0.055;
      if (S.flying[i].t > 1) S.flying.splice(i, 1);
    }
    if (S.flying.length > 40) S.flying.splice(0, S.flying.length - 40);
    // 입자 살짝 흔들기
    function jitter(arr) {
      for (var j = 0; j < arr.length; j++) {
        arr[j].x = Math.min(1, Math.max(0, arr[j].x + (Math.random() - 0.5) * 0.02));
        arr[j].y = Math.min(1, Math.max(0, arr[j].y + (Math.random() - 0.5) * 0.02));
      }
    }
    jitter(S.waterL); jitter(S.waterR); jitter(S.solL); jitter(S.solR);
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 14, bx = pad, by = 30, bw = w - pad * 2, bh = h - by - 40;
    var midx = bx + bw / 2;

    ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    // 수위 (오른쪽이 올라가면 왼쪽은 내려간다)
    var baseTop = by + bh * 0.30;
    var dl = S.level * (bh * 0.052);
    var topL = Math.min(by + bh - 18, Math.max(by + 6, baseTop + dl));
    var topR = Math.min(by + bh - 18, Math.max(by + 6, baseTop - dl));

    function fillRoom(x0, x1, top, colFill, colLine) {
      ctx.fillStyle = colFill;
      ctx.fillRect(x0, top, x1 - x0, by + bh - top - 1);
      ctx.strokeStyle = colLine; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x1, top); ctx.stroke();
    }
    fillRoom(bx + 1, midx - 3, topL, "rgba(86,180,233,0.14)", "rgba(86,180,233,0.75)");
    fillRoom(midx + 3, bx + bw - 1, topR, "rgba(167,139,250,0.14)", "rgba(167,139,250,0.8)");

    // 반투막
    ctx.fillStyle = "rgba(203,213,225,0.55)";
    ctx.fillRect(midx - 3, by + 1, 6, bh - 2);
    ctx.strokeStyle = COL.silver; ctx.lineWidth = 1;
    for (var g = 0; g < 26; g++) {
      var gy = by + 6 + g * (bh - 12) / 26;
      ctx.beginPath(); ctx.moveTo(midx - 3, gy); ctx.lineTo(midx + 3, gy); ctx.stroke();
    }
    ctx.fillStyle = COL.silver; ctx.font = "600 11.5px inherit"; ctx.textAlign = "center";
    ctx.fillText("반투막", midx, by - 10);

    function room(arr, x0, x1, top, color, r, outline) {
      ctx.fillStyle = color;
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        var px = x0 + 8 + p.x * (x1 - x0 - 16);
        var py = top + 10 + p.y * (by + bh - top - 20);
        ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832); ctx.fill();
        if (outline) { ctx.strokeStyle = "rgba(15,23,42,0.45)"; ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
    room(S.waterL, bx, midx, topL, COL.sky, 3.6, false);
    room(S.waterR, midx, bx + bw, topR, COL.sky, 3.6, false);
    room(S.solL, bx, midx, topL, COL.violetP, 7.5, true);
    room(S.solR, midx, bx + bw, topR, COL.violetP, 7.5, true);

    // 막을 건너는 물 분자 (방향을 화살표 색으로 구분)
    for (var k = 0; k < S.flying.length; k++) {
      var fl = S.flying[k];
      var t = fl.t;
      var fx = midx + fl.dir * (t - 0.5) * 52;
      var fy = Math.max(topL, topR) + 12 + fl.y * (by + bh - Math.max(topL, topR) - 24);
      ctx.beginPath(); ctx.arc(fx, fy, 4.2, 0, 6.2832);
      ctx.fillStyle = fl.dir > 0 ? COL.mint : COL.yellow;
      ctx.globalAlpha = 1 - Math.abs(t - 0.5) * 1.2; ctx.fill(); ctx.globalAlpha = 1;
    }

    // 걸어 준 압력 표시 (오른쪽 위에서 누르는 피스톤)
    var P = effectiveP();
    if (P > 0.05) {
      var pistonY = topR - 14;
      ctx.fillStyle = "rgba(251,146,60,0.85)";
      ctx.fillRect(midx + 8, pistonY - 8, bw / 2 - 20, 8);
      ctx.strokeStyle = COL.orange; ctx.lineWidth = 2;
      var arrN = 4;
      for (var a = 0; a < arrN; a++) {
        var ax = midx + 26 + a * (bw / 2 - 50) / (arrN - 1);
        ctx.beginPath(); ctx.moveTo(ax, pistonY - 26); ctx.lineTo(ax, pistonY - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax, pistonY - 9); ctx.lineTo(ax - 4, pistonY - 16);
        ctx.lineTo(ax + 4, pistonY - 16); ctx.closePath(); ctx.fillStyle = COL.orange; ctx.fill();
      }
      ctx.fillStyle = COL.orange; ctx.font = "700 12px inherit"; ctx.textAlign = "center";
      ctx.fillText(P.toFixed(1) + " atm", midx + bw / 4, pistonY - 30);
    }

    ctx.fillStyle = COL.silver; ctx.font = "600 12.5px inherit"; ctx.textAlign = "center";
    ctx.fillText("왼쪽 " + S.CL.toFixed(2) + " M", bx + bw / 4, by + 18);
    ctx.fillText("오른쪽 " + S.CR.toFixed(2) + " M", bx + bw * 3 / 4, by + 18);
    // 수위 차 눈금 (오른쪽이 얼마나 올라갔는지)
    if (Math.abs(S.level) > 0.15) {
      ctx.strokeStyle = "rgba(203,213,225,0.55)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(bx + 4, topL); ctx.lineTo(bx + bw - 4, topL); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL.silver; ctx.font = "11px inherit"; ctx.textAlign = "right";
      ctx.fillText("수위 차", bx + bw - 16, (topL + topR) / 2 + 4);
    }
    ctx.textAlign = "left";
  }

  /* ---------- 그래프: 압력 vs 순 이동 속도 ---------- */
  function drawChart() {
    var ctx = G.ctx, w = G.w, h = G.h;
    ctx.clearRect(0, 0, w, h);
    var L = 52, Rp = 16, T = 16, Bm = 36, pw = w - L - Rp, ph = h - T - Bm;
    var piB = piBalance(S.CL, S.CR, S.T);
    var pMax = Math.max(2, Math.abs(piB) * 1.7);
    var r0 = netRate(S.CL, S.CR, S.T, 0);
    var rMin = netRate(S.CL, S.CR, S.T, pMax);
    var yTop = Math.max(Math.abs(r0), Math.abs(rMin), 1e-9) * 1.15;

    var X = function (p) { return L + p / pMax * pw; };
    var Y = function (v) { return T + ph / 2 - (v / yTop) * (ph / 2); };

    ctx.strokeStyle = "rgba(40,45,52,0.13)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();
    // 0선
    ctx.strokeStyle = "rgba(40,45,52,0.30)"; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath();
    for (var i = 0; i <= 220; i++) {
      var p = pMax * i / 220, v = netRate(S.CL, S.CR, S.T, p);
      var xx = X(p), yy = Y(v);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = COL.blue; ctx.lineWidth = 2.4; ctx.stroke();

    // x절편 = 삼투압
    if (piB > 0 && piB < pMax) {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.red; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X(piB), T); ctx.lineTo(X(piB), T + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(X(piB), Y(0), 5, 0, 6.2832); ctx.fillStyle = COL.red; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = COL.red; ctx.font = "700 11.5px inherit"; ctx.textAlign = "center";
      ctx.fillText("π = " + piB.toFixed(2) + " atm", Math.min(X(piB), L + pw - 40), Y(0) - 10);
    }
    // 지금 걸어 준 압력
    var Pnow = effectiveP();
    if (Pnow >= 0 && Pnow <= pMax) {
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(Pnow), T + 2); ctx.lineTo(X(Pnow), T + ph); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(Pnow), Y(netRate(S.CL, S.CR, S.T, Pnow)), 4.5, 0, 6.2832);
      ctx.fillStyle = COL.amber; ctx.fill();
    }

    ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "center";
    for (var j = 0; j <= 4; j++) ctx.fillText((pMax * j / 4).toFixed(1), L + pw * j / 4, T + ph + 14);
    ctx.fillText("오른쪽(진한 쪽)에 걸어 준 압력 (atm)", L + pw / 2, T + ph + 28);
    ctx.textAlign = "right";
    ctx.fillStyle = COL.green; ctx.fillText("삼투 →", L - 6, Y(yTop * 0.6));
    ctx.fillStyle = COL.violet; ctx.fillText("← 역삼투", L - 6, Y(-yTop * 0.6));
    ctx.textAlign = "left";
  }

  /* ---------- 측정값 ---------- */
  function readout(label, value, unit, cls) {
    return '<div class="readout ' + (cls || "") + '"><div class="label">' + label +
      '</div><div><span class="value">' + value + '</span>' +
      (unit ? '<span class="unit">' + unit + "</span>" : "") + "</div></div>";
  }
  function updateReadouts() {
    var dC = S.CR - S.CL;
    var piB = piBalance(S.CL, S.CR, S.T);
    var vh = piVH(dC, S.T);
    var Pnow = effectiveP();
    var rate = netRate(S.CL, S.CR, S.T, Pnow);
    var state, cls;
    if (Math.abs(rate) < 2e-4) { state = "순 이동 0 (평형)"; cls = "is-ok"; }
    else if (rate > 0) { state = "삼투 (묽은 → 진한)"; cls = "is-warn"; }
    else { state = "역삼투 (반대로)"; cls = "is-bad"; }

    var html = "";
    html += readout("순 이동 방향", state, "", cls);
    html += readout("π = CRT (판트호프)", vh.toFixed(2), "atm");
    html += readout("순 이동이 0이 되는 압력", piB.toFixed(2), "atm", "is-ok");
    html += readout("지금 걸린 압력", Pnow.toFixed(2), "atm");
    if (S.hydro) html += readout("수위 차가 만드는 압력", (S.level * HYDRO_SCALE).toFixed(2), "atm");
    html += readout("농도 차 ΔC", dC.toFixed(2), "M");
    $("readouts").innerHTML = html;

    $("cLR").textContent = S.nLR.toLocaleString("ko-KR");
    $("cRL").textContent = S.nRL.toLocaleString("ko-KR");
    $("cNet").textContent = (S.nLR - S.nRL).toLocaleString("ko-KR");

    $("conclusion").innerHTML =
      '<b>삼투압의 정의</b> 삼투를 <u>멈추게 하려면</u> 용액 쪽에 걸어야 하는 <b>최소 압력.</b> ' +
      '“진한 용액이 미는 압력”이 아니다 — 화면에서 우리가 <b>눌러서 멈춘</b> 그 값이다.<br>' +
      '<b>왜 순 이동이 생기는가</b> 용질이 있으면 용매가 그 액체를 <b>떠나기 어려워진다.</b> ' +
      '증발로 떠나기도, 얼음이 되어 떠나기도, <b>막을 건너 떠나기도</b> 어려워진다. ' +
      '그래서 순 이동은 묽은 쪽 → 진한 쪽이다.<br>' +
      '<span style="color:var(--t3)">부연: 물 분자 하나하나가 붙잡힌 게 아니라, 액체 쪽 배치의 경우의 수가 늘어난 것이다. ' +
      '왜 그런지는 Ⅲ단원에서 “엔트로피”라는 이름으로 다시 만난다.</span><br>' +
      '<b>π = CRT를 읽는 법</b> 식이 이상 기체 방정식과 닮은 건 우연이 아니다. ' +
      '둘 다 <b>입자 수에만 비례하는 효과</b>라는 같은 뿌리에서 나온다. ' +
      '다만 <b>용질이 막을 두들겨서 생기는 압력이라고 읽으면 안 된다.</b>';
  }

  function updateTable() {
    var t = $("mainTbl");
    var html = "<tr><th>입자 총농도 (M)</th><th>X<sub>물</sub></th><th>π = CRT</th>" +
      "<th>정확식 −(RT/V̄)lnX</th><th>차이</th><th>예</th></tr>";
    var list = [
      [0.1, ""], [0.15, "생리식염수(0.9 % NaCl) ≈ 0.30 M 입자"], [0.3, "식물 세포의 등장 농도 부근"],
      [0.6, ""], [1.0, ""], [1.2, "해수 (0.6 M NaCl → 이온 1.2 M)"], [2.0, ""]
    ];
    for (var i = 0; i < list.length; i++) {
      var C = list[i][0], a = piVH(C, S.T), b = piExact(C, S.T);
      html += "<tr" + (Math.abs(C - (S.CR - S.CL)) < 0.03 ? ' style="background:#f8fafc"' : "") +
        "><td>" + C.toFixed(2) + "</td><td>" + Xsolv(C).toFixed(4) + "</td><td>" + a.toFixed(2) +
        " atm</td><td>" + b.toFixed(2) + " atm</td><td>" + (100 * (a - b) / b).toFixed(2) +
        " %</td><td style='text-align:left'>" + list[i][1] + "</td></tr>";
    }
    t.innerHTML = html;
  }

  /* ---------- 루프 ---------- */
  var visible = true, raf = null, frame = 0;
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) loop(); });
  function loop() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      raf = null; if (!visible) return;
      if (S.running) step();
      draw(); drawChart();
      if (++frame % 8 === 0) updateReadouts();
      loop();
    });
  }

  /* ---------- 입력 ---------- */
  function refresh() { rebuild(); updateReadouts(); updateTable(); drawChart(); }
  $("sCL").oninput = function () { S.CL = +this.value; $("vCL").textContent = S.CL.toFixed(2) + " M"; refresh(); };
  $("sCR").oninput = function () { S.CR = +this.value; $("vCR").textContent = S.CR.toFixed(2) + " M"; refresh(); };
  $("sT").oninput = function () {
    S.T = +this.value + 273.15; $("vT").textContent = this.value + " °C"; updateReadouts(); updateTable(); drawChart();
  };
  $("sP").oninput = function () { S.P = +this.value; $("vP").textContent = S.P.toFixed(1) + " atm"; updateReadouts(); drawChart(); };
  $("ckHydro").onchange = function () {
    S.hydro = this.checked;
    $("stageNote").innerHTML = S.hydro
      ? "수위 차가 만드는 압력까지 세는 중 — 저절로 멈춘다"
      : "막을 건너는 물 분자를 한 개씩 세고 있다";
    updateReadouts();
  };
  $("btnRun").onclick = function () { S.running = !S.running; this.textContent = S.running ? "일시정지" : "이어서 관찰"; };
  $("btnReset").onclick = function () { S.nLR = 0; S.nRL = 0; S.level = 0; rebuild(); updateReadouts(); };
  $("btnFind").onclick = function () {
    var piB = piBalance(S.CL, S.CR, S.T);
    if (piB <= 0) return;
    S.P = Math.round(Math.min(60, piB) * 2) / 2;
    S.hydro = false; $("ckHydro").checked = false;
    $("sP").value = S.P; $("vP").textContent = S.P.toFixed(1) + " atm";
    S.nLR = 0; S.nRL = 0; S.level = 0;
    updateReadouts(); drawChart();
  };
  var PRESETS = [
    { CL: 0, CR: 0.3, T: 25, P: 0, note: "순수한 물 ↔ 0.3 M 설탕물" },
    { CL: 0, CR: 1.2, T: 25, P: 35, note: "해수(입자 1.2 M)에 35 atm — 역삼투로 물을 뽑아낸다" },
    { CL: 0.30, CR: 0.30, T: 37, P: 0, note: "적혈구 안팎이 같은 농도(등장) — 순 이동 0" }
  ];
  Array.prototype.forEach.call($("pickPre").children, function (b) {
    b.onclick = function () {
      var p = PRESETS[+this.dataset.p];
      Array.prototype.forEach.call($("pickPre").children, function (x) { x.className = "opt"; });
      this.className = "opt on";
      S.CL = p.CL; S.CR = p.CR; S.T = p.T + 273.15; S.P = p.P; S.hydro = false; S.level = 0;
      S.nLR = 0; S.nRL = 0;
      $("sCL").value = p.CL; $("vCL").textContent = p.CL.toFixed(2) + " M";
      $("sCR").value = p.CR; $("vCR").textContent = p.CR.toFixed(2) + " M";
      $("sT").value = p.T; $("vT").textContent = p.T + " °C";
      $("sP").value = p.P; $("vP").textContent = p.P.toFixed(1) + " atm";
      $("ckHydro").checked = false;
      refresh();
    };
  });

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
    logRows.push([who,
      "왼 " + S.CL.toFixed(2) + " M / 오 " + S.CR.toFixed(2) + " M, " + (S.T - 273.15).toFixed(0) + " ℃, P " + effectiveP().toFixed(1) + " atm",
      "L→R " + S.nLR + " · R→L " + S.nRL + " · 순 " + (S.nLR - S.nRL) +
      " · π(정확) " + piBalance(S.CL, S.CR, S.T).toFixed(2) + " atm · CRT " + piVH(S.CR - S.CL, S.T).toFixed(2) + " atm"]);
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
    a.download = "삼투와삼투압_기록.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- 시작 ---------- */
  $("legendMain").innerHTML =
    '<span class="item"><span class="swatch" style="background:var(--p-sky)"></span>물 분자 (막을 건넌다)</span>' +
    '<span class="item"><span class="swatch" style="background:var(--p-violet)"></span>용질 입자 (막을 못 건넌다)</span>' +
    '<span class="item"><span class="swatch" style="background:var(--p-mint)"></span>왼쪽 → 오른쪽으로 건너는 중</span>' +
    '<span class="item"><span class="swatch" style="background:var(--p-yellow)"></span>오른쪽 → 왼쪽으로 건너는 중</span>';
  $("legendChart").innerHTML =
    '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>순 이동 속도</span>' +
    '<span class="item"><span class="swatch" style="background:var(--d-red)"></span>순 이동이 0이 되는 압력 = 삼투압</span>' +
    '<span class="item"><span class="swatch sq" style="background:var(--d-amber)"></span>지금 걸어 준 압력</span>';
  if (REDUCED) $("btnRun").textContent = "이어서 관찰";
  updateReadouts(); updateTable();
  loop();
})();
