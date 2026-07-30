/* ============================================================
   온도와 반응 속도 — 문턱을 넘는 분자의 비율   (Ⅳ. 반응 속도 / 차시 34·36·37)

   이 파일이 하는 일
     ① 3차원 맥스웰–볼츠만 에너지 분포를 두 온도에서 그리고,
        활성화 에너지 Ea 오른쪽 "꼬리 넓이"를 실제로 계산해 배율을 보여 준다.
     ② 반응 경로 에너지 도표에서 Ea(빨강)와 ΔH(파랑)를 다른 색 화살표로 구분한다.

   쓰는 식
     f(E) = 2/√π · (1/RT)^{3/2} · √E · e^(−E/RT)          (E, RT 단위: kJ/mol)
     문턱을 넘는 비율  F(≥Ea) = erfc(√x) + 2√(x/π)·e^(−x),  x = Ea/RT
     충돌 빈도 배율 = √(T₂/T₁)
     ΔH = Ea(정) − Ea(역)

   Node 검증 통과 (수치적분 ↔ 해석해 오차 < 0.2 %):
     Ea=50 kJ/mol, 300→310 K : 꼬리 1.88배 × 충돌 1.0165배 = 1.91배  (교과서 "약 2배")
     Ea=100 kJ/mol            : 아레니우스 3.64배  (로드맵 교사 참고값 3.6배)
     충돌 빈도 √(310/300) = +1.65 %  (교과서 "약 2 %")
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var COL = {};
  (function () {
    COL.blue = css("--d-blue"); COL.red = css("--d-red"); COL.amber = css("--d-amber");
    COL.green = css("--d-green"); COL.violet = css("--d-violet"); COL.gray = css("--d-gray");
    COL.cyan = css("--d-cyan"); COL.t1 = css("--t1"); COL.t2 = css("--t2"); COL.t3 = css("--t3");
  })();

  var R = 8.314;                    // J/(mol·K)
  var RT = function (T) { return R * T / 1000; };   // kJ/mol

  /* ---------- 계산 ---------- */
  // erfc 근사 (Numerical Recipes, 상대오차 < 1.2e-7)
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + z / 2);
    var a = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? a : 2 - a;
  }
  // 분포 함수 (E, T) — 넓이의 합이 1이 되도록 정규화되어 있다
  function mb(E, T) {
    var rt = RT(T);
    if (E <= 0) return 0;
    return 2 / Math.sqrt(Math.PI) * Math.pow(1 / rt, 1.5) * Math.sqrt(E) * Math.exp(-E / rt);
  }
  // 문턱 Ea 오른쪽 꼬리의 넓이 = 반응할 수 있는 분자의 비율
  function tail(Ea, T) {
    var x = Ea * 1000 / (R * T);
    return erfc(Math.sqrt(x)) + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x);
  }
  function collisionRatio(T1, T2) { return Math.sqrt(T2 / T1); }

  // 1.02e-8 → "1.02×10⁻⁸" 처럼 읽기 좋게
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  function sci(v, digits) {
    if (v === 0) return "0";
    if (v >= 0.001) return (100 * v).toPrecision(digits || 3) + " %";
    var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    var s = String(e).split("").map(function (c) { return SUP[c] || c; }).join("");
    return m.toFixed(2) + "×10" + s;
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
    if (window.ResizeObserver) new ResizeObserver(function () { s = fit(); draw(); }).observe(wrap);
    else window.addEventListener("resize", function () { s = fit(); draw(); });
    return { ctx: ctx, get w() { return s.w; }, get h() { return s.h; }, fit: fit };
  }
  var M = makeCanvas("wrapMain", "cvMain");

  /* ---------- 상태 ---------- */
  var tab = "A";
  var A = { T1: 300, dT: 10, Ea: 50, zoom: true, cat: false, Ec: 30 };
  var B = { Ef: 183, dH: 13, cat: false, Efc: 110 };
  var logRows = [];

  /* ---------- ① 분포 곡선 ---------- */
  function drawA() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var L = 52, Rp = 16, T = 18, Bm = 42, pw = w - L - Rp, ph = h - T - Bm;
    var T1 = A.T1, T2 = A.T1 + A.dT;
    var EaNow = A.cat ? A.Ec : A.Ea;

    // 보는 범위
    //  · 확대 끄면 : 0 ~ 전체. 곡선 전체가 "조금밖에 안 움직인 것"을 본다.
    //  · 확대 켜면 : 문턱 부근만. 가로·세로를 함께 확대해야 꼬리가 실제로 보인다.
    //                (세로만 늘이면 봉우리가 화면 위로 잘려 분포처럼 보이지 않는다)
    var Efull = Math.max(A.Ea * 1.55, A.cat ? A.Ec * 1.9 : 0, RT(T2) * 9);
    var E0, E1;
    if (A.zoom) {
      // 문턱 바로 앞뒤만 잘라 본다. 창을 넓게 잡으면 지수적으로 떨어져 꼬리가 다시 안 보인다.
      E0 = Math.max(0, EaNow - RT(T2) * 1.5);
      E1 = EaNow + RT(T2) * 6;
    } else { E0 = 0; E1 = Efull; }

    var N = 340, i, E, y;
    var peak = 0;
    for (i = 0; i <= N; i++) { E = E0 + (E1 - E0) * i / N; peak = Math.max(peak, mb(E, T1), mb(E, T2)); }
    var yMax = peak * 1.12 || 1;

    var X = function (e) { return L + (e - E0) / (E1 - E0) * pw; };
    var Y = function (v) { return T + ph - Math.min(v / yMax, 1.02) * ph; };

    // 축
    ctx.strokeStyle = "rgba(40,45,52,0.16)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();
    ctx.strokeStyle = "rgba(40,45,52,0.055)";
    for (i = 1; i <= 5; i++) {
      var gx = L + pw * i / 6;
      ctx.beginPath(); ctx.moveTo(gx, T); ctx.lineTo(gx, T + ph); ctx.stroke();
    }

    // 꼬리 색칠 (문턱 오른쪽) — 낮은 온도 먼저, 높은 온도를 위에
    function fillTail(Temp, color, alpha) {
      ctx.beginPath(); ctx.moveTo(X(EaNow), T + ph);
      for (i = 0; i <= 160; i++) {
        E = EaNow + (E1 - EaNow) * i / 160;
        ctx.lineTo(X(E), Y(mb(E, Temp)));
      }
      ctx.lineTo(X(E1), T + ph); ctx.closePath();
      ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    }
    if (EaNow < E1) { fillTail(T2, COL.red, 0.30); fillTail(T1, COL.blue, 0.32); }

    // 곡선 — 색 + 선 모양 두 채널 (색각 대응)
    function curve(Temp, color, dash) {
      ctx.beginPath();
      for (i = 0; i <= N; i++) { E = E0 + (E1 - E0) * i / N; y = Y(mb(E, Temp)); if (i === 0) ctx.moveTo(X(E), y); else ctx.lineTo(X(E), y); }
      ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.stroke(); ctx.setLineDash([]);
    }
    curve(T1, COL.blue, []);
    curve(T2, COL.red, [7, 4]);

    // 문턱선
    ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.t1; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(EaNow), T - 2); ctx.lineTo(X(EaNow), T + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.t1; ctx.font = "700 12px inherit";
    var eaTxt = "Ea = " + EaNow + " kJ/mol" + (A.cat ? " (촉매)" : "");
    var eaW = ctx.measureText(eaTxt).width;
    var eaX = X(EaNow) + 6;
    if (eaX + eaW > L + pw) { ctx.textAlign = "right"; eaX = X(EaNow) - 6; } else ctx.textAlign = "left";
    ctx.fillText(eaTxt, eaX, T + 12);
    if (A.cat && X(A.Ea) <= L + pw) {  // 촉매를 켰을 때 원래 문턱도 회색으로 남겨 "옮겨갔음"을 보인다
      ctx.setLineDash([2, 4]); ctx.strokeStyle = COL.gray; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(A.Ea), T); ctx.lineTo(X(A.Ea), T + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL.gray; ctx.font = "11px inherit"; ctx.textAlign = "left";
      ctx.fillText("촉매 없을 때 " + A.Ea, Math.min(X(A.Ea) + 5, L + pw - 90), T + ph - 8);
    }

    // 축 이름
    ctx.fillStyle = COL.t3; ctx.font = "11.5px inherit"; ctx.textAlign = "center";
    ctx.fillText("분자의 운동 에너지 (kJ/mol)", L + pw / 2, T + ph + 30);
    for (i = 0; i <= 6; i++) {
      var e0 = E0 + (E1 - E0) * i / 6;
      ctx.fillText(e0.toFixed(E1 - E0 < 30 ? 1 : 0), L + pw * i / 6, T + ph + 15);
    }
    ctx.save(); ctx.translate(14, T + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillText("그 에너지를 가진 분자의 수", 0, 0); ctx.restore();
    if (A.zoom) {
      ctx.textAlign = "right"; ctx.fillStyle = COL.amber; ctx.font = "600 11px inherit";
      ctx.fillText("문턱 부근만 확대해서 보는 중 — 세로축 눈금은 확대 전보다 훨씬 작다", L + pw, T + ph - 6);
    }
    ctx.textAlign = "left";
  }

  /* ---------- ② 활성화 에너지 도표 ---------- */
  function drawB() {
    var ctx = M.ctx, w = M.w, h = M.h;
    ctx.clearRect(0, 0, w, h);
    var L = 58, Rp = 20, T = 26, Bm = 44, pw = w - L - Rp, ph = h - T - Bm;
    var Ef = B.Ef, dH = B.dH, Er = Ef - dH;
    var topAll = Math.max(Ef, Ef - dH + Math.max(0, dH), B.cat ? B.Efc : 0, Math.abs(dH));
    var lo = Math.min(0, dH) - topAll * 0.18;
    var hi = Math.max(Ef, dH + Math.max(0, 0), B.cat ? B.Efc : 0) + topAll * 0.16;
    var Y = function (v) { return T + ph - (v - lo) / (hi - lo) * ph; };
    var xR = L + pw * 0.13, xP = L + pw * 0.87, xTop = L + pw * 0.50;

    ctx.strokeStyle = "rgba(40,45,52,0.16)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, T + ph); ctx.lineTo(L + pw, T + ph); ctx.stroke();

    // 반응 경로 곡선 (반응물 평평 → 봉우리 → 생성물 평평)
    function path(peak, color, dash, lw) {
      ctx.beginPath();
      ctx.moveTo(L + 6, Y(0)); ctx.lineTo(xR, Y(0));
      var steps = 90;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = xR + (xP - xR) * t;
        // 좌우 비대칭 봉우리: 정상이 xTop에 오도록 코사인 두 조각을 잇는다
        var v;
        if (x <= xTop) { var u = (x - xR) / (xTop - xR); v = peak * (1 - Math.cos(Math.PI * u)) / 2; }
        else { var u2 = (x - xTop) / (xP - xTop); v = dH + (peak - dH) * (1 + Math.cos(Math.PI * u2)) / 2; }
        ctx.lineTo(x, Y(v));
      }
      ctx.lineTo(L + pw - 6, Y(dH));
      ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    }
    if (B.cat) path(B.Efc, COL.green, [7, 5], 2.2);
    path(Ef, COL.t1, [], 2.6);

    // 수평 기준선
    ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(40,45,52,0.28)"; ctx.lineWidth = 1;
    [0, dH, Ef].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + pw, Y(v)); ctx.stroke();
    });
    ctx.setLineDash([]);

    // 화살표 (Ea 빨강 / ΔH 파랑 — 이 단원 최대의 시각적 함정 대응)
    function arrow(x, y1, y2, color, label, side) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      [[y1, y1 < y2 ? 1 : -1], [y2, y2 < y1 ? 1 : -1]].forEach(function (p) {
        ctx.beginPath(); ctx.moveTo(x, p[0]); ctx.lineTo(x - 5, p[0] + 8 * p[1]);
        ctx.lineTo(x + 5, p[0] + 8 * p[1]); ctx.closePath(); ctx.fill();
      });
      ctx.font = "700 12px inherit"; ctx.textAlign = side === "L" ? "right" : "left";
      ctx.fillText(label, side === "L" ? x - 8 : x + 8, (y1 + y2) / 2 + 4);
    }
    arrow(xR + (xTop - xR) * 0.44, Y(0), Y(Ef), COL.red, "Ea(정) " + Ef + " kJ", "L");
    arrow(xP - (xP - xTop) * 0.44, Y(dH), Y(Ef), COL.amber, "Ea(역) " + Er + " kJ", "R");
    // ΔH 화살표는 오른쪽 끝에. 값이 작으면 화살표가 짧아지므로 레이블은 위쪽으로 빼고
    // 흰 배경을 깔아 "생성물" 글자와 겹쳐 읽히지 않게 한다.
    var xdh = L + pw * 0.975;
    arrow(xdh, Y(0), Y(dH), COL.blue, "", "L");
    var dhTxt = "ΔH " + (dH > 0 ? "+" : "") + dH + " kJ";
    ctx.font = "700 12px inherit"; ctx.textAlign = "right";
    var tw = ctx.measureText(dhTxt).width;
    var dhy = Math.min(Y(0), Y(dH)) - 8;
    ctx.fillStyle = "#fff"; ctx.fillRect(xdh - 6 - tw - 3, dhy - 12, tw + 8, 16);
    ctx.fillStyle = COL.blue; ctx.fillText(dhTxt, xdh - 6, dhy);

    if (B.cat) {
      ctx.fillStyle = COL.green; ctx.font = "700 12px inherit"; ctx.textAlign = "center";
      ctx.fillText("촉매 경로 Ea(정) " + B.Efc + " / Ea(역) " + (B.Efc - dH), xTop, Y(B.Efc) - 10);
    }

    ctx.fillStyle = COL.t2; ctx.font = "12.5px inherit"; ctx.textAlign = "center";
    ctx.fillText("반응물", xR - 4, Y(0) + 18);
    ctx.fillText("생성물", xP - 20, Y(dH) + 18);
    ctx.fillStyle = COL.t3; ctx.font = "11.5px inherit";
    ctx.fillText("반응의 진행 →", L + pw / 2, T + ph + 30);
    ctx.save(); ctx.translate(16, T + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("에너지 (kJ)", 0, 0); ctx.restore();
    ctx.textAlign = "left";
  }

  function draw() { if (tab === "A") drawA(); else drawB(); }

  /* ---------- 측정값 ---------- */
  function readout(label, value, unit, cls) {
    return '<div class="readout ' + (cls || "") + '"><div class="label">' + label +
      '</div><div><span class="value">' + value + '</span>' +
      (unit ? '<span class="unit">' + unit + "</span>" : "") + "</div></div>";
  }
  function updateA() {
    var T1 = A.T1, T2 = A.T1 + A.dT, EaNow = A.cat ? A.Ec : A.Ea;
    var f1 = tail(EaNow, T1), f2 = tail(EaNow, T2);
    var rTail = f2 / f1, rCol = collisionRatio(T1, T2), rAll = rTail * rCol;
    $("mCol").textContent = rCol.toFixed(4);
    $("mTail").textContent = rTail < 100 ? rTail.toFixed(2) : rTail.toPrecision(3);
    $("mAll").textContent = rAll < 100 ? rAll.toFixed(2) : rAll.toPrecision(3);

    var html = "";
    html += readout("T₁에서 문턱을 넘는 비율", sci(f1), "");
    html += readout("T₂에서 문턱을 넘는 비율", sci(f2), "");
    html += readout("문턱을 넘는 비율의 배율", "×" + (rTail < 100 ? rTail.toFixed(2) : rTail.toPrecision(3)), "배", "is-ok");
    html += readout("충돌 수의 배율 √(T₂/T₁)", "×" + rCol.toFixed(4), "배", "is-warn");
    if (A.cat) {
      var noCat = tail(A.Ea, T1);
      html += readout("촉매의 효과 (T₁ 기준)", "×" + (f1 / noCat).toPrecision(3), "배", "is-ok");
    }
    $("readouts").innerHTML = html;

    $("conclusion").innerHTML =
      '<b>결론 판서 — 덧셈이 아니라 곱셈.</b> 속도 ≈ <b>충돌 수 × 문턱을 넘는 비율.</b> ' +
      '앞은 ' + rCol.toFixed(3) + '배, 뒤는 약 ' + (rTail < 100 ? rTail.toFixed(2) : rTail.toPrecision(3)) +
      '배. 두 값은 <u>더하는 게 아니라 곱한다.</u><br>' +
      '<b>역방향 가드</b> 충돌이 없으면 반응은 아예 없다. 충돌은 <b>필요조건</b>이다. ' +
      '다만 <u>온도</u> 효과의 주된 원인은 아니다. <u>농도·압력·표면적</u> 효과는 여전히 충돌 수로 설명된다.';
  }
  function updateB() {
    var Er = B.Ef - B.dH;
    var html = "";
    html += readout("Ea(정반응)", B.Ef, "kJ");
    html += readout("Ea(역반응)", Er, "kJ");
    html += readout("ΔH = Ea(정) − Ea(역)", (B.dH > 0 ? "+" : "") + B.dH, "kJ",
      B.dH < 0 ? "is-ok" : "is-warn");
    html += readout("반응의 성격", B.dH < 0 ? "발열" : (B.dH > 0 ? "흡열" : "0"), "",
      B.dH < 0 ? "is-ok" : "is-warn");
    if (B.cat) html += readout("촉매 경로의 ΔH", (B.dH > 0 ? "+" : "") + B.dH, "kJ", "is-ok");
    $("readouts").innerHTML = html;

    $("conclusion").innerHTML =
      '<b>자발성은 출발점과 도착점의 문제(ΔH·ΔS)이고, 속도는 그 사이에 있는 <u>산의 높이</u>(Ea)의 문제다.</b><br>' +
      (B.cat
        ? '촉매를 넣어도 <b>ΔH는 그대로다.</b> 촉매는 산을 깎는 게 아니라, ' +
          '더 낮은 고개로 넘어가는 <b>다른 길</b>을 열어 준다. 출발점과 도착점은 그대로다. ' +
          '그래서 <b>최종적으로 도달하는 지점은 같고, 도달하는 시간만 짧아진다.</b>'
        : '⚠ ΔH를 안다고 Ea를 알 수는 없다. 같은 ΔH를 갖는 반응도 Ea는 천차만별이다. ' +
          '<b>연소는 크게 발열이지만 Ea가 높아 점화가 필요하다.</b>');
  }
  function updateReadouts() { if (tab === "A") updateA(); else updateB(); }

  /* ---------- 표 ---------- */
  function updateTable() {
    var t = $("mainTbl");
    var T1 = A.T1, T2 = A.T1 + 10;
    var html = "<tr><th>E<sub>a</sub> (kJ/mol)</th><th>" + T1 + " K에서 넘는 비율</th>" +
      "<th>" + T2 + " K에서 넘는 비율</th><th>꼬리 배율</th><th>충돌 배율</th><th>속도 배율</th></tr>";
    var list = [20, 30, 40, 50, 60, 80, 100, 120, 150];
    var rc = collisionRatio(T1, T2);
    for (var i = 0; i < list.length; i++) {
      var Ea = list[i], f1 = tail(Ea, T1), f2 = tail(Ea, T2), rt = f2 / f1;
      var mark = (Ea === 50);
      html += "<tr" + (mark ? ' style="background:#f8fafc"' : "") + "><td>" +
        (mark ? "<b>" + Ea + "</b>" : Ea) + "</td><td>" + sci(f1) + "</td><td>" + sci(f2) +
        "</td><td>×" + rt.toFixed(2) + "</td><td>×" + rc.toFixed(4) +
        "</td><td><b>×" + (rt * rc).toFixed(2) + "</b></td></tr>";
    }
    t.innerHTML = html;
  }

  /* ---------- 화면 전환 ---------- */
  var LEG = {
    A: '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>낮은 온도 T₁ (실선)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-red)"></span>높은 온도 T₂ (파선)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--t1)"></span>활성화 에너지 문턱 Ea</span>',
    B: '<span class="item"><span class="swatch sq" style="background:var(--d-red)"></span>Ea(정반응)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-amber)"></span>Ea(역반응)</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-blue)"></span>반응 엔탈피 ΔH</span>' +
       '<span class="item"><span class="swatch sq" style="background:var(--d-green)"></span>촉매 경로(파선)</span>'
  };
  function setTab(t) {
    tab = t;
    $("tabA").className = "tab" + (t === "A" ? " on" : "");
    $("tabB").className = "tab" + (t === "B" ? " on" : "");
    $("ctlA").hidden = t !== "A"; $("ctlB").hidden = t !== "B";
    $("boxMul").hidden = t !== "A"; $("boxTable").hidden = t !== "A";
    $("stageTitle").innerHTML = t === "A"
      ? "분자의 운동 에너지 분포 (맥스웰–볼츠만)"
      : "반응 경로 에너지 도표 — Ea와 ΔH는 다른 것이다";
    $("stageNote").textContent = t === "A"
      ? "Ea 오른쪽 꼬리의 넓이 = 반응할 수 있는 분자의 비율"
      : "두 화살표의 시작점과 끝점이 다르다";
    $("legendMain").innerHTML = LEG[t];
    M.fit(); updateReadouts(); updateTable(); draw();
  }

  /* ---------- 입력 ---------- */
  function reA() { updateReadouts(); updateTable(); draw(); }
  function reB() { updateReadouts(); draw(); }

  $("tabA").onclick = function () { setTab("A"); };
  $("tabB").onclick = function () { setTab("B"); };

  $("sT1").oninput = function () { A.T1 = +this.value; $("vT1").textContent = A.T1 + " K"; reA(); };
  $("sDT").oninput = function () { A.dT = +this.value; $("vDT").textContent = "+" + A.dT + " K"; reA(); };
  $("sEa").oninput = function () { A.Ea = +this.value; $("vEa").textContent = A.Ea + " kJ/mol"; reA(); };
  $("ckZoom").onchange = function () { A.zoom = this.checked; draw(); };
  $("ckCat").onchange = function () { A.cat = this.checked; $("ctlCat").hidden = !this.checked; reA(); };
  $("sEc").oninput = function () { A.Ec = +this.value; $("vEc").textContent = A.Ec + " kJ/mol"; reA(); };
  $("btnPre1").onclick = function () {
    A.T1 = 300; A.dT = 10; A.Ea = 50; A.cat = false;
    $("sT1").value = 300; $("sDT").value = 10; $("sEa").value = 50; $("ckCat").checked = false;
    $("vT1").textContent = "300 K"; $("vDT").textContent = "+10 K"; $("vEa").textContent = "50 kJ/mol";
    $("ctlCat").hidden = true; reA();
  };

  $("sEf").oninput = function () { B.Ef = +this.value; $("vEf").textContent = B.Ef + " kJ"; reB(); };
  $("sDH").oninput = function () {
    B.dH = +this.value; $("vDH").textContent = (B.dH > 0 ? "+" : "") + B.dH + " kJ"; reB();
  };
  $("ckCat2").onchange = function () { B.cat = this.checked; $("ctlCat2").hidden = !this.checked; reB(); };
  $("sEfc").oninput = function () { B.Efc = +this.value; $("vEfc").textContent = B.Efc + " kJ"; reB(); };
  $("btnPre2").onclick = function () {
    B.Ef = 183; B.dH = 13; $("sEf").value = 183; $("sDH").value = 13;
    $("vEf").textContent = "183 kJ"; $("vDH").textContent = "+13 kJ"; reB();
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
      var T1 = A.T1, T2 = A.T1 + A.dT, Ea = A.cat ? A.Ec : A.Ea;
      var rt = tail(Ea, T2) / tail(Ea, T1), rc = collisionRatio(T1, T2);
      logRows.push([who, "T " + T1 + "→" + T2 + " K, Ea " + Ea + " kJ/mol" + (A.cat ? " (촉매)" : ""),
        "꼬리 ×" + rt.toFixed(3) + " · 충돌 ×" + rc.toFixed(4) + " · 속도 ×" + (rt * rc).toFixed(3)]);
    } else {
      logRows.push([who, "Ea정 " + B.Ef + " kJ, ΔH " + B.dH + " kJ",
        "Ea역 " + (B.Ef - B.dH) + " kJ" + (B.cat ? " · 촉매 Ea정 " + B.Efc : "")]);
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
    a.download = "온도와반응속도_기록.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- 시작 ---------- */
  setTab("A");
  renderLog();
})();
