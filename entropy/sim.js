/* ============================================================
   엔트로피 — 경우의 수 세기        (Ⅲ. 화학 변화의 자발성 / 차시 27·28·29)

   이 파일이 하는 일
     ① 위치의 경우의 수   : 입자 N개를 두 방에 넣는 배치의 가짓수 = 이항계수 C(N,k)
     ② 에너지의 경우의 수 : 입자 n개에 알갱이 q개를 나누는 방법의 수 = C(q+n-1, q)
     ③ 온도와 ΔS주위      : 같은 열이라도 이미 뜨거운 주위에서는 가짓수를 덜 늘린다

   수치는 만들기 전에 Node로 검증했다 (전부 통과):
     C(4,·) = 1,4,6,4,1 / 합 16 · C(10,5) = 252 · C(20,10) = 184,756
     W(n=3, q=1..4) = 3, 6, 10, 15
     알갱이 1개 추가 시 배수 = (q+n)/(q+1)    (n=20: q=10 → 2.727배, q=100 → 1.188배)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 0. 공통 도구 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var css = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };
  // 색은 하드코딩하지 않는다. shared/style.css 의 토큰을 읽어 쓴다.
  var COL = {};
  function loadColors() {
    COL.sky = css("--p-sky");  COL.yellow = css("--p-yellow");
    COL.orange = css("--p-orange"); COL.silver = css("--p-silver");
    COL.mint = css("--p-mint"); COL.violetP = css("--p-violet");
    COL.blue = css("--d-blue"); COL.amber = css("--d-amber");
    COL.gray = css("--d-gray"); COL.t1 = css("--t1"); COL.t3 = css("--t3");
    COL.red = css("--d-red");  COL.green = css("--d-green");
    COL.violet = css("--d-violet");
  }
  loadColors();

  var REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* 캔버스 준비 — dpr 처리를 빼면 태블릿에서 글자가 뭉개진다 */
  function makeCanvas(wrapId, cvId) {
    var wrap = $(wrapId), cv = $(cvId), ctx = cv.getContext("2d");
    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = wrap.clientWidth, h = wrap.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      cv.style.width = w + "px"; cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h };
    }
    var size = fit();
    if (window.ResizeObserver) new ResizeObserver(function () { size = fit(); }).observe(wrap);
    else window.addEventListener("resize", function () { size = fit(); });
    return { ctx: ctx, get w() { return size.w; }, get h() { return size.h; }, fit: fit };
  }
  var M = makeCanvas("wrapMain", "cvMain");     // 위쪽 무대
  var G = makeCanvas("wrapChart", "cvChart");   // 아래쪽 그래프

  /* ---------- 1. 조합 계산 ---------- */
  // C(n,k) — n이 작을 때만 쓴다(N ≤ 20). 곱셈 순서를 이렇게 잡아야 정수를 벗어나지 않는다.
  function C(n, k) {
    if (k < 0 || k > n) return 0;
    if (k > n - k) k = n - k;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }
  // 입자 n개에 (구별되지 않는) 알갱이 q개를 나누는 방법의 수 = 중복조합
  function Wq(n, q) { return C(q + n - 1, q); }
  // 알갱이를 1개 더 넣을 때 방법의 수가 몇 배가 되는가 → 정확히 (q+n)/(q+1)
  function stepMul(n, q) { return (q + n) / (q + 1); }
  // 알갱이를 dq개 넣었을 때 ln(배수). dq가 음수면 반대로 계산한다.
  function lnMul(n, q0, dq) {
    var s = 0, j;
    if (dq >= 0) { for (j = 0; j < dq; j++) s += Math.log(stepMul(n, q0 + j)); }
    else { for (j = 0; j < -dq; j++) { var q = q0 - 1 - j; if (q < 0) return NaN; s -= Math.log(stepMul(n, q)); } }
    return s;
  }
  function fmt(x, d) { return (Math.abs(x) >= 1e6) ? x.toExponential(2) : x.toFixed(d); }
  function comma(x) { return Math.round(x).toLocaleString("ko-KR"); }

  /* ---------- 2. 상태 ---------- */
  var tab = "A";
  var stA = { N: 4, side: [], speed: 3, running: !REDUCED, count: [], total: 0, t: 0, showNum: true };
  var stB = { n: 3, q: 3, give: [], running: !REDUCED, t: 0 };
  var stC = { n: 20, q0: 10, dq: 3 };
  var logRows = [];

  function initA() {
    stA.side = []; stA.count = [];
    for (var i = 0; i < stA.N; i++) stA.side.push(Math.random() < 0.5 ? 0 : 1);
    for (var k = 0; k <= stA.N; k++) stA.count.push(0);
    stA.total = 0;
  }
  function initB() {
    stB.give = [];
    for (var i = 0; i < stB.n; i++) stB.give.push(0);
    shuffleQuanta();
  }
  // 알갱이 q개를 n개 입자에 무작위로(모든 방법이 똑같이 나오도록) 흩뿌린다
  function shuffleQuanta() {
    var i;
    for (i = 0; i < stB.n; i++) stB.give[i] = 0;
    for (i = 0; i < stB.q; i++) stB.give[Math.floor(Math.random() * stB.n)]++;
  }
  initA(); initB();

  /* ---------- 3. 그리기 : ① 위치 ---------- */
  function drawA() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 14, boxY = 34, boxH = h - boxY - 40;
    var boxW = w - pad * 2, half = boxW / 2;

    // 방 두 칸
    ctx.strokeStyle = "rgba(148,163,184,0.45)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, boxY, boxW, boxH);
    ctx.beginPath(); ctx.moveTo(pad + half, boxY); ctx.lineTo(pad + half, boxY + boxH);
    ctx.strokeStyle = "rgba(148,163,184,0.70)"; ctx.setLineDash([5, 4]); ctx.stroke();
    ctx.setLineDash([]);

    var nL = 0, i;
    for (i = 0; i < stA.N; i++) if (stA.side[i] === 0) nL++;
    var nR = stA.N - nL;

    ctx.fillStyle = COL.silver; ctx.font = "600 13px inherit"; ctx.textAlign = "center";
    ctx.fillText("왼쪽 방 · " + nL + "개", pad + half / 2, boxY - 12);
    ctx.fillText("오른쪽 방 · " + nR + "개", pad + half + half / 2, boxY - 12);

    // 입자 — 방 안에서 격자로 배치한다(겹치지 않게)
    var r = stA.N > 12 ? 11 : (stA.N > 6 ? 14 : 17);
    var seenL = 0, seenR = 0;
    var perRow = Math.max(2, Math.floor((half - 24) / (r * 2.5)));
    // 방 안에서 세로 가운데로 모은다 (입자가 적을 때 위쪽에만 붙어 있으면 허전하다)
    var rowsMax = Math.ceil(Math.max(nL, nR, 1) / perRow);
    var gridH = (rowsMax - 1) * (r * 2.5) + r * 2;
    var yStart = boxY + Math.max(24, (boxH - 26 - gridH) / 2) + r;
    for (i = 0; i < stA.N; i++) {
      var left = stA.side[i] === 0;
      var idx = left ? seenL++ : seenR++;
      var col = idx % perRow, row = Math.floor(idx / perRow);
      var x0 = pad + (left ? 0 : half) + 20;
      var x = x0 + col * (r * 2.5), y = yStart + row * (r * 2.5);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
      ctx.fillStyle = left ? COL.sky : COL.yellow;
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.55)"; ctx.lineWidth = 1; ctx.stroke();
      if (stA.showNum) {
        ctx.fillStyle = "#0f172a"; ctx.font = "700 " + Math.round(r * 0.95) + "px inherit";
        ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), x, y + 0.5);
        ctx.textBaseline = "alphabetic";
      }
    }

    // 요약은 상자 '안' 아래쪽에 둔다 — 상자 밖 아래는 stage-note 가 쓰는 자리다
    var sy = boxY + boxH - 12;
    ctx.textAlign = "left"; ctx.font = "600 12.5px inherit"; ctx.fillStyle = COL.silver;
    var pAll = 1 / Math.pow(2, stA.N);
    ctx.fillText("지금 분포 " + nL + " : " + nR +
      "   ·   이 분포의 배치 가짓수 " + comma(C(stA.N, nL)) + " 가지", pad + 10, sy);
    ctx.textAlign = "right";
    ctx.fillStyle = stA.total ? COL.orange : COL.silver;
    ctx.fillText("한쪽에 전부 몰림 " + (stA.count[0] + stA.count[stA.N]) +
      " / " + stA.total + " 회 (이론 " + (100 * 2 * pAll).toFixed(pAll < 0.001 ? 4 : 2) + " %)", w - pad - 10, sy);
    ctx.textAlign = "left";
  }

  function drawChartA() {
    var ctx = G.ctx, w = G.w, h = G.h;
    ctx.clearRect(0, 0, w, h);
    var L = 40, R = 12, T = 14, B = 30, pw = w - L - R, ph = h - T - B;
    var N = stA.N, k;
    var theo = [], maxTheo = 0;
    for (k = 0; k <= N; k++) { theo.push(C(N, k)); if (theo[k] > maxTheo) maxTheo = theo[k]; }
    var tot = Math.pow(2, N);
    var maxObsFrac = 0;
    for (k = 0; k <= N; k++) {
      var f = stA.total ? stA.count[k] / stA.total : 0;
      if (f > maxObsFrac) maxObsFrac = f;
    }
    var scale = Math.max(maxTheo / tot, maxObsFrac, 1e-9) * 1.15;

    ctx.strokeStyle = "rgba(40,45,52,0.13)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();
    ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "right";
    ctx.fillText("비율", L - 6, T + 10);

    var bw = pw / (N + 1);
    for (k = 0; k <= N; k++) {
      var x = L + k * bw;
      var obs = stA.total ? stA.count[k] / stA.total : 0;
      var th = theo[k] / tot;
      // 관측 = 채운 막대
      var hh = (obs / scale) * ph;
      ctx.fillStyle = "rgba(29,78,216,0.75)";
      ctx.fillRect(x + bw * 0.18, T + ph - hh, bw * 0.64, hh);
      // 이론 = 굵은 가로선 (색 + 모양, 두 채널)
      var hy = T + ph - (th / scale) * ph;
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + bw * 0.08, hy); ctx.lineTo(x + bw * 0.92, hy); ctx.stroke();
      if (N <= 12 || k % 2 === 0) {
        ctx.fillStyle = COL.t3; ctx.font = "10.5px inherit"; ctx.textAlign = "center";
        ctx.fillText(k + ":" + (N - k), x + bw / 2, T + ph + 14);
      }
    }
    ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "center";
    ctx.fillText("왼쪽 : 오른쪽 분포", L + pw / 2, T + ph + 26);
    ctx.textAlign = "left";
  }

  /* ---------- 4. 그리기 : ② 에너지 ---------- */
  function drawB() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 16, baseY = h - 46;
    var n = stB.n, colW = (w - pad * 2) / n;
    var maxStack = 1; for (var i = 0; i < n; i++) maxStack = Math.max(maxStack, stB.give[i]);
    var unit = Math.min(20, (baseY - 56) / Math.max(4, maxStack));

    ctx.strokeStyle = "rgba(148,163,184,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, baseY + 22); ctx.lineTo(w - pad, baseY + 22); ctx.stroke();

    for (i = 0; i < n; i++) {
      var cx = pad + colW * (i + 0.5);
      // 입자 (구별된다 → 번호를 쓴다)
      ctx.beginPath(); ctx.arc(cx, baseY, 15, 0, 6.2832);
      ctx.fillStyle = COL.silver; ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.font = "700 13px inherit";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cx, baseY + 0.5);
      ctx.textBaseline = "alphabetic";
      // 에너지 알갱이 (구별되지 않는다 → 모두 같은 모양·같은 색)
      for (var j = 0; j < stB.give[i]; j++) {
        var y = baseY - 24 - j * unit;
        ctx.beginPath(); ctx.arc(cx, y, Math.min(8, unit * 0.42), 0, 6.2832);
        ctx.fillStyle = COL.orange; ctx.fill();
      }
      ctx.fillStyle = COL.silver; ctx.font = "11.5px inherit";
      ctx.fillText(stB.give[i] + "개", cx, baseY + 36);
    }

    ctx.textAlign = "left"; ctx.font = "600 12.5px inherit"; ctx.fillStyle = COL.silver;
    ctx.fillText("알갱이는 서로 구별되지 않는다 — 어느 알갱이인지가 아니라 " +
      "각 입자가 몇 개를 갖는지만 다르다", pad, 22);
    ctx.fillStyle = COL.mint; ctx.font = "700 13px inherit";
    ctx.fillText("나누는 방법의 수 W = " + comma(Wq(stB.n, stB.q)) + " 가지", pad, h - 12);
  }

  function drawChartB() {
    var ctx = G.ctx, w = G.w, h = G.h;
    ctx.clearRect(0, 0, w, h);
    var L = 46, R = 14, T = 16, B = 32, pw = w - L - R, ph = h - T - B;
    var n = stB.n, qmax = 12, vals = [], q;
    for (q = 0; q <= qmax; q++) vals.push(Wq(n, q));
    var maxV = vals[qmax];

    ctx.strokeStyle = "rgba(40,45,52,0.13)";
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();
    var bw = pw / (qmax + 1);
    for (q = 0; q <= qmax; q++) {
      var x = L + q * bw, hh = (vals[q] / maxV) * ph;
      ctx.fillStyle = (q === stB.q) ? COL.amber : "rgba(95,107,122,0.42)";
      ctx.fillRect(x + bw * 0.16, T + ph - hh, bw * 0.68, hh);
      ctx.fillStyle = COL.t3; ctx.font = "10.5px inherit"; ctx.textAlign = "center";
      ctx.fillText(String(q), x + bw / 2, T + ph + 14);
    }
    ctx.fillStyle = COL.t3; ctx.font = "11px inherit";
    ctx.fillText("에너지 알갱이 q", L + pw / 2, T + ph + 27);
    ctx.textAlign = "right"; ctx.fillText("방법의 수 W", L - 6, T + 10);
    ctx.textAlign = "left";
  }

  /* ---------- 5. 그리기 : ③ 온도와 ΔS주위 ---------- */
  function drawC() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var pad = 18;
    var n = stC.n, q0 = stC.q0, dq = stC.dq;

    // 주위를 "에너지 알갱이가 담긴 큰 통"으로 그린다 (개수는 상징적으로 축약)
    var boxX = pad, boxY = 46, boxW = w - pad * 2, boxH = h - boxY - 64;
    ctx.fillStyle = "rgba(148,163,184,0.08)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "rgba(148,163,184,0.45)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    var show = Math.min(q0, 240);
    var added = Math.min(Math.abs(dq), 40);
    var total = show + added;

    // 알갱이를 상자 가운데에 촘촘한 격자로 쌓는다.
    // 칸 크기를 제한하지 않으면 알갱이가 몇 개 안 될 때 화면에 흩뿌려져 "쌓였다"로 안 읽힌다.
    var cols = Math.max(1, Math.round(Math.sqrt(total * boxW / Math.max(boxH, 1))));
    var rows = Math.ceil(total / cols);
    var pitch = Math.min((boxW - 26) / cols, (boxH - 26) / rows, 30);
    var gw = cols * pitch, gh = rows * pitch;
    var gx = boxX + (boxW - gw) / 2, gy = boxY + (boxH - gh) / 2;
    var rr = Math.max(2.2, pitch * 0.30);

    function cellXY(i) {
      return [gx + (i % cols + 0.5) * pitch, gy + (Math.floor(i / cols) + 0.5) * pitch];
    }
    var i, p;
    for (i = 0; i < show; i++) {
      p = cellXY(i);
      ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, 6.2832);
      ctx.fillStyle = COL.orange; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    }
    // 새로 들어온 열 Δq 는 색과 <모양>을 함께 바꾼다 (색만으로 구분하지 않는다)
    for (i = 0; i < added; i++) {
      p = cellXY(show + i);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - rr * 1.35); ctx.lineTo(p[0] + rr * 1.25, p[1] + rr * 0.95);
      ctx.lineTo(p[0] - rr * 1.25, p[1] + rr * 0.95); ctx.closePath();
      ctx.fillStyle = dq >= 0 ? COL.mint : COL.violetP; ctx.fill();
    }

    ctx.fillStyle = COL.silver; ctx.font = "600 13px inherit"; ctx.textAlign = "left";
    ctx.fillText("주위 — 입자 " + n + "개가 에너지 알갱이 " + q0 + "개를 나눠 갖고 있다", pad, 26);

    // 요약은 상자 안 아래쪽 (상자 밖 아래는 stage-note 자리)
    var lm = lnMul(n, q0, dq);
    ctx.font = "700 13.5px inherit";
    ctx.fillStyle = dq >= 0 ? COL.mint : COL.violetP;
    ctx.fillText("경우의 수 " + (dq >= 0 ? "\u00d7" : "\u00f7") + " " + fmt(Math.exp(Math.abs(lm)), 3) +
      "   \u2192   \u0394S\uc8fc\uc704 " + (dq >= 0 ? "> 0 (\uc99d\uac00)" : "< 0 (\uac10\uc18c)"),
      boxX + 12, boxY + boxH - 12);
    if (q0 > 240) {
      ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "right";
      ctx.fillText("(알갱이는 240개까지만 그린다)", boxX + boxW - 12, boxY + boxH - 12);
    }
    ctx.textAlign = "left";
  }

  function drawChartC() {
    var ctx = G.ctx, w = G.w, h = G.h;
    ctx.clearRect(0, 0, w, h);
    var L = 46, R = 16, T = 16, B = 34, pw = w - L - R, ph = h - T - B;
    var n = stC.n, dq = Math.abs(stC.dq) || 1;
    var qmin = 1, qmax = 200, pts = [], q, maxY = 0;
    for (q = qmin; q <= qmax; q++) {
      var v = lnMul(n, q, dq);
      pts.push([q, v]); if (v > maxY) maxY = v;
    }
    maxY = maxY * 1.1 || 1;
    ctx.strokeStyle = "rgba(40,45,52,0.13)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();

    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = L + (pts[i][0] - qmin) / (qmax - qmin) * pw;
      var y = T + ph - (pts[i][1] / maxY) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COL.blue; ctx.lineWidth = 2.4; ctx.stroke();

    // 지금 고른 q0 위치
    var xn = L + (Math.min(Math.max(stC.q0, qmin), qmax) - qmin) / (qmax - qmin) * pw;
    var yn = T + ph - (Math.max(0, lnMul(n, stC.q0, dq)) / maxY) * ph;
    ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.red; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xn, T); ctx.lineTo(xn, T + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(xn, yn, 4.5, 0, 6.2832); ctx.fillStyle = COL.red; ctx.fill();

    ctx.fillStyle = COL.t3; ctx.font = "11px inherit"; ctx.textAlign = "center";
    ctx.fillText("주위가 이미 가진 에너지 q₀  (오른쪽일수록 뜨겁다)", L + pw / 2, T + ph + 26);
    ctx.textAlign = "right";
    ctx.fillText("ΔS주위 의 크기", L - 6, T + 10);
    ctx.textAlign = "left";
  }

  /* ---------- 6. 측정값 카드 ---------- */
  function readout(label, value, unit, cls) {
    return '<div class="readout ' + (cls || "") + '"><div class="label">' + label +
      '</div><div><span class="value">' + value + '</span>' +
      (unit ? '<span class="unit">' + unit + "</span>" : "") + "</div></div>";
  }
  function updateReadouts() {
    var html = "", N, tot;
    if (tab === "A") {
      N = stA.N; tot = Math.pow(2, N);
      var mid = Math.floor(N / 2);
      var pAll = 2 / tot;
      html += readout("전체 경우의 수 2<sup>N</sup>", comma(tot), "가지");
      html += readout("가장 많은 분포의 가짓수", comma(C(N, mid)), "가지");
      html += readout("한쪽에 전부 몰릴 확률",
        pAll < 0.0001 ? pAll.toExponential(2) : (100 * pAll).toFixed(3) + " %", "",
        pAll < 0.01 ? "is-bad" : "");
      html += readout("관측한 섞기 횟수", comma(stA.total), "회");
    } else if (tab === "B") {
      html += readout("나누는 방법의 수 W", comma(Wq(stB.n, stB.q)), "가지");
      html += readout("알갱이 1개 더 넣으면", "×" + stepMul(stB.n, stB.q).toFixed(3), "배", "is-ok");
      html += readout("알갱이 1개 빼면",
        stB.q > 0 ? "×" + (1 / stepMul(stB.n, stB.q - 1)).toFixed(3) : "—", "배",
        stB.q > 0 ? "is-warn" : "");
      html += readout("입자 · 알갱이", stB.n + " · " + stB.q, "개");
    } else {
      var lm = lnMul(stC.n, stC.q0, stC.dq);
      var mul = Math.exp(lm);
      html += readout("주위의 경우의 수 배수", (mul >= 1 ? "×" : "×") + fmt(mul, 3), "배",
        stC.dq === 0 ? "" : (stC.dq > 0 ? "is-ok" : "is-warn"));
      html += readout("ΔS<sub>주위</sub> 의 부호",
        stC.dq > 0 ? "+ 증가" : (stC.dq < 0 ? "− 감소" : "0"), "",
        stC.dq > 0 ? "is-ok" : (stC.dq < 0 ? "is-warn" : ""));
      html += readout("같은 Δq를 q₀=10에 줄 때", fmt(Math.exp(lnMul(stC.n, 10, Math.abs(stC.dq))), 3), "배");
      html += readout("같은 Δq를 q₀=100에 줄 때", fmt(Math.exp(lnMul(stC.n, 100, Math.abs(stC.dq))), 3), "배");
    }
    $("readouts").innerHTML = html;
  }

  /* ---------- 7. 표 · 결론 문구 ---------- */
  function updateTable() {
    var t = $("mainTbl"), html, k;
    if (tab === "A") {
      $("tblTitle").innerHTML = "분포별 배치의 가짓수 — N = " + stA.N;
      html = "<tr><th>분포 (왼 : 오)</th><th>배치의 가짓수</th><th>전체 중 비율</th><th>관측 횟수</th></tr>";
      var tot = Math.pow(2, stA.N);
      for (k = stA.N; k >= 0; k--) {
        var w = C(stA.N, k), big = (k === Math.floor(stA.N / 2) || k === Math.ceil(stA.N / 2));
        html += "<tr" + (big ? ' style="background:#f8fafc"' : "") + "><td>" +
          (big ? "<b>" : "") + k + " : " + (stA.N - k) + (big ? "</b>" : "") + "</td><td>" +
          comma(w) + "</td><td>" + (100 * w / tot).toFixed(2) + " %</td><td>" +
          comma(stA.count[k]) + "</td></tr>";
      }
      html += "<tr><th>합계</th><th>" + comma(tot) + "</th><th>100 %</th><th>" + comma(stA.total) + "</th></tr>";
      $("tblNote").innerHTML = "N = 4일 때 1 · 4 · 6 · 4 · 1 → 합 16. " +
        "가운데(2 : 2)가 6가지로 가장 많고, 한쪽에 전부 몰리는 배치는 각각 1가지뿐이다.";
    } else if (tab === "B") {
      $("tblTitle").innerHTML = "에너지 알갱이 수에 따른 방법의 수 — 입자 n = " + stB.n + "개";
      html = "<tr><th>에너지 알갱이 q</th><th>나누는 방법의 수 W</th><th>바로 앞보다 몇 배</th></tr>";
      for (k = 0; k <= 12; k++) {
        html += "<tr" + (k === stB.q ? ' style="background:#fff7ed"' : "") + "><td>" +
          (k === stB.q ? "<b>" + k + "</b>" : k) + "</td><td>" + comma(Wq(stB.n, k)) + "</td><td>" +
          (k === 0 ? "—" : "×" + stepMul(stB.n, k - 1).toFixed(3)) + "</td></tr>";
      }
      $("tblNote").innerHTML = "입자 3개일 때 q = 1, 2, 3, 4 → 3, 6, 10, 15가지. " +
        "<b>에너지가 들어오면 나누는 방법의 수가 늘어난다.</b> 이것이 ΔS<sub>주위</sub>의 정체다.";
    } else {
      $("tblTitle").innerHTML = "주위의 온도(q₀)에 따른 ΔS<sub>주위</sub> — 주위 입자 " + stC.n + "개, Δq = " + stC.dq + "개";
      html = "<tr><th>주위가 이미 가진 에너지 q₀</th><th>경우의 수 배수</th><th>ΔS<sub>주위</sub> 상대 크기</th></tr>";
      var base = lnMul(stC.n, 5, Math.abs(stC.dq)) || 1;
      var list = [5, 10, 20, 40, 60, 100, 150, 200];
      for (k = 0; k < list.length; k++) {
        var lm = lnMul(stC.n, list[k], Math.abs(stC.dq));
        html += "<tr" + (list[k] === stC.q0 ? ' style="background:#fef2f2"' : "") + "><td>" +
          list[k] + (list[k] <= 10 ? " (차갑다)" : (list[k] >= 150 ? " (뜨겁다)" : "")) +
          "</td><td>×" + fmt(Math.exp(lm), 3) + "</td><td>" + (100 * lm / base).toFixed(1) + " %</td></tr>";
      }
      $("tblNote").innerHTML = "같은 양의 열(Δq)인데도 <b>주위가 이미 뜨거우면 경우의 수가 덜 늘어난다.</b> " +
        "1,000원은 가진 게 1,000원인 사람에게는 큰 변화지만 100만 원인 사람에게는 아니다.";
    }
    t.innerHTML = html;
  }

  var CONCL = {
    A: '<b>결론 ①</b> 엔트로피가 증가한다는 것은 <b>다른 일이 금지되었다</b>는 뜻이 아니라, ' +
       '<b>경우의 수가 많은 쪽이 압도적으로 자주 일어난다</b>는 뜻이다.<br>' +
       '<b>결론 ②</b> 엔트로피는 <u>가짓수</u>이고, 확률은 그 가짓수를 전체로 나눈 것이다. 둘은 다르다.',
    B: '<b>결론 ③</b> <b>에너지가 들어오면 나누는 방법의 수가 늘어난다.</b> ← 이것이 ΔS<sub>주위</sub>의 정체다.<br>' +
       '경우의 수에는 두 종류가 있다 — <u>어디에 있는가</u>, 그리고 <u>에너지를 어떻게 나눠 갖는가</u>. ' +
       'ΔS<sub>계</sub>는 주로 앞의 것, ΔS<sub>주위</sub>는 오직 뒤의 것이다.',
    C: '<b>온도 의존성의 기제</b> 같은 양의 열이라도 <u>이미 뜨거운 주위</u>에 들어갈 때가 ' +
       '차가운 주위에 들어갈 때보다 경우의 수를 <b>덜</b> 늘린다. ' +
       '그래서 온도가 높으면 ΔS<sub>주위</sub>의 크기가 작아지고, 상대적으로 ΔS<sub>계</sub>가 판을 결정한다.<br>' +
       '<span style="color:var(--t3)">⚠ “에너지가 퍼진다”고 말하지 않는다. 계는 매 순간 단 하나의 상태에 있다. ' +
       '늘어나는 것은 <b>접근 가능한 경우의 수</b>다.</span>'
  };

  var LEGEND = {
    A: '<span class="item"><span class="swatch" style="background:' + "var(--p-sky)" + '"></span>왼쪽 방의 입자</span>' +
       '<span class="item"><span class="swatch" style="background:var(--p-yellow)"></span>오른쪽 방의 입자</span>',
    B: '<span class="item"><span class="swatch" style="background:var(--p-silver)"></span>입자(구별됨 · 번호 표시)</span>' +
       '<span class="item"><span class="swatch" style="background:var(--p-orange)"></span>에너지 알갱이(구별 안 됨)</span>',
    C: '<span class="item"><span class="swatch" style="background:var(--p-orange)"></span>주위가 이미 가진 에너지</span>' +
       '<span class="item"><span class="swatch tri" style="color:var(--p-mint)"></span>새로 들어온 열 Δq</span>'
  };
  var LEGEND_CHART = {
    A: '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>실제 관측 비율</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-amber)"></span>이론 가짓수 비율 C(N,k)/2<sup>N</sup></span>',
    B: '<span class="item"><span class="swatch sq" style="background:var(--d-amber)"></span>지금 고른 q</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-gray)"></span>다른 q</span>',
    C: '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>ΔS<sub>주위</sub>의 크기</span>' +
       '<span class="item"><span class="swatch" style="background:var(--d-red)"></span>지금 고른 q₀</span>'
  };

  /* ---------- 8. 애니메이션 루프 ---------- */
  var visible = true;
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    if (visible) loop();
  });

  var raf = null;
  function loop() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      raf = null;
      if (!visible) return;
      tick();
      loop();
    });
  }
  function tick() {
    if (tab === "A") {
      if (stA.running) {
        stA.t++;
        var every = [0, 40, 22, 12, 6, 3][stA.speed];
        if (stA.t % every === 0) shuffleA();
      }
      drawA(); drawChartA();
    } else if (tab === "B") {
      if (stB.running) {
        stB.t++;
        if (stB.t % 22 === 0) { shuffleQuanta(); }
      }
      drawB(); drawChartB();
    } else {
      drawC(); drawChartC();
    }
  }
  function shuffleA() {
    for (var i = 0; i < stA.N; i++) stA.side[i] = Math.random() < 0.5 ? 0 : 1;
    var nL = 0;
    for (i = 0; i < stA.N; i++) if (stA.side[i] === 0) nL++;
    stA.count[nL]++; stA.total++;
    if (stA.total % 5 === 0) updateReadouts();
    if (stA.total % 25 === 0) updateTable();
  }

  /* ---------- 9. 화면 전환 ---------- */
  function setTab(t) {
    tab = t;
    $("tabA").className = "tab" + (t === "A" ? " on" : "");
    $("tabB").className = "tab" + (t === "B" ? " on" : "");
    $("tabC").className = "tab" + (t === "C" ? " on" : "");
    $("ctlA").hidden = t !== "A"; $("ctlB").hidden = t !== "B"; $("ctlC").hidden = t !== "C";
    var wrapMain = $("wrapMain");
    // ③ 탭은 "값을 읽는" 화면이므로 밝은 무대가 더 맞다 — 라고 하고 싶지만
    // 한 페이지 안에서 무대 종류를 섞지 않는다(매뉴얼 §5). 전부 어두운 무대로 통일.
    wrapMain.className = "stage stage--dark stagewrap";
    $("stageTitle").innerHTML =
      t === "A" ? "입자가 두 방에 놓이는 배치" :
      t === "B" ? "에너지 알갱이를 나눠 갖는 방법" : "주위가 열을 받으면";
    $("chartTitle").innerHTML =
      t === "A" ? "분포별 가짓수와 실제 관측 횟수" :
      t === "B" ? "에너지가 늘어날 때 방법의 수" : "주위의 온도에 따른 ΔS주위";
    $("stageNote").textContent =
      t === "A" ? "모든 배치가 똑같이 일어나기 쉽다고 가정한다" :
      t === "B" ? "알갱이는 구별되지 않고, 입자만 구별된다" :
                  "알갱이 개수는 상징적으로 축약해 그린다";
    $("legendMain").innerHTML = LEGEND[t];
    $("legendChart").innerHTML = LEGEND_CHART[t];
    $("conclusion").innerHTML = CONCL[t];
    M.fit(); G.fit();
    updateReadouts(); updateTable(); tick();
  }

  /* ---------- 10. 입력 연결 ---------- */
  $("tabA").onclick = function () { setTab("A"); };
  $("tabB").onclick = function () { setTab("B"); };
  $("tabC").onclick = function () { setTab("C"); };

  $("sN").oninput = function () {
    stA.N = +this.value; $("vN").textContent = stA.N + " 개";
    initA(); updateReadouts(); updateTable();
  };
  $("sSpd").oninput = function () {
    stA.speed = +this.value;
    $("vSpd").textContent = ["", "아주 느리게", "느리게", "보통", "빠르게", "아주 빠르게"][stA.speed];
  };
  $("ckNum").onchange = function () { stA.showNum = this.checked; };
  $("btnRun").onclick = function () {
    stA.running = !stA.running; this.textContent = stA.running ? "일시정지" : "이어서 섞기";
  };
  $("btnStep").onclick = function () { shuffleA(); updateReadouts(); updateTable(); tick(); };
  $("btnReset").onclick = function () { initA(); updateReadouts(); updateTable(); };

  $("sn2").oninput = function () {
    stB.n = +this.value; $("vn2").textContent = stB.n + " 개";
    initB(); afterB();
  };
  $("sq2").oninput = function () {
    stB.q = +this.value; $("vq2").textContent = stB.q + " 개";
    shuffleQuanta(); afterB();
  };
  function afterB() {
    $("txtMul").textContent = stepMul(stB.n, stB.q).toFixed(2) + "배";
    updateReadouts(); updateTable();
  }
  $("btnRun2").onclick = function () {
    stB.running = !stB.running; this.textContent = stB.running ? "일시정지" : "이어서 나누기";
  };
  $("btnStep2").onclick = function () { shuffleQuanta(); tick(); };

  $("sn3").oninput = function () { stC.n = +this.value; $("vn3").textContent = stC.n + " 개"; updateReadouts(); updateTable(); };
  $("sq3").oninput = function () { stC.q0 = +this.value; $("vq3").textContent = stC.q0 + " 개"; updateReadouts(); updateTable(); };
  $("sdq").oninput = function () {
    stC.dq = +this.value;
    $("vdq").textContent = (stC.dq > 0 ? "+" : "") + stC.dq + " 개";
    updateReadouts(); updateTable();
  };

  /* ---------- 11. 기록 · CSV ---------- */
  function renderLog() {
    var t = $("logTbl");
    if (!logRows.length) { t.innerHTML = ""; $("logEmpty").hidden = false; return; }
    $("logEmpty").hidden = true;
    var html = "<tr><th>탭</th><th>조건</th><th>핵심 값</th></tr>";
    for (var i = 0; i < logRows.length; i++)
      html += "<tr><td>" + logRows[i][1] + "</td><td>" + logRows[i][2] + "</td><td>" + logRows[i][3] + "</td></tr>";
    t.innerHTML = html;
  }
  $("btnLog").onclick = function () {
    var who = $("who").value || "-";
    if (tab === "A") {
      logRows.push([who, "① 위치", "N=" + stA.N,
        "2^N=" + Math.pow(2, stA.N) + " / 최다분포=" + C(stA.N, Math.floor(stA.N / 2)) +
        " / 몰림관측 " + (stA.count[0] + stA.count[stA.N]) + "of" + stA.total]);
    } else if (tab === "B") {
      logRows.push([who, "② 에너지", "n=" + stB.n + ", q=" + stB.q,
        "W=" + Wq(stB.n, stB.q) + " / 1개추가 ×" + stepMul(stB.n, stB.q).toFixed(3)]);
    } else {
      logRows.push([who, "③ ΔS주위", "n=" + stC.n + ", q0=" + stC.q0 + ", dq=" + stC.dq,
        "배수 ×" + Math.exp(lnMul(stC.n, stC.q0, stC.dq)).toFixed(4)]);
    }
    renderLog();
  };
  $("btnClr").onclick = function () { logRows = []; renderLog(); };
  $("btnCsv").onclick = function () {
    if (!logRows.length) return;
    var csv = "﻿좌석번호,탭,조건,핵심값\n";
    for (var i = 0; i < logRows.length; i++)
      csv += logRows[i].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",") + "\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "엔트로피_경우의수_기록.csv";
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- 12. 시작 ---------- */
  $("vN").textContent = stA.N + " 개";
  $("vn2").textContent = stB.n + " 개";
  $("vq2").textContent = stB.q + " 개";
  $("vn3").textContent = stC.n + " 개";
  $("vq3").textContent = stC.q0 + " 개";
  $("vdq").textContent = "+" + stC.dq + " 개";
  $("txtMul").textContent = stepMul(stB.n, stB.q).toFixed(2) + "배";
  if (REDUCED) { $("btnRun").textContent = "이어서 섞기"; $("btnRun2").textContent = "이어서 나누기"; }
  setTab("A");
  renderLog();
  loop();
})();
