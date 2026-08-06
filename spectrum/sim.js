/* ============================================================
   별빛 스펙트럼 분석기 — 계산 코어 + 화면
   화학 탐구실 / 통합과학1 「물질과 규칙성」

   구조
     1부  계산 코어 (순수 함수).  window.SpectrumCore 로 노출한다.
          DOM·Canvas 를 한 줄도 쓰지 않는다 — Node 에서 그대로 검산된다.
     2부  화면 (DOM·Canvas·이벤트).  document 가 있을 때만 실행된다.

   단일 원천 (F-1)
     GASES · UNKNOWN · ALL · STARS  네 개가 파장·세기·색·별 구성의 유일한 원천이다.
     화면 코드에 파장 숫자를 다시 적지 않는다.
   ============================================================ */
(function () {
  "use strict";

  /* ==========================================================
     1부 · 계산 코어
     ========================================================== */

  /* 파장은 전부 "공기 중" 값(nm).
     rel = 화면용 상대 세기 0~1 (교육용 임의 가중, a.u.) */
  var GASES = {
    H : { name:"수소",   symbol:"H",  color:"#56b4e9",
          note:"우주에서 가장 흔한 원소. 별빛 스펙트럼에 거의 항상 나타난다.",
          lines:[ {nm:656.279, rel:1.00, label:"빨강"},
                  {nm:486.135, rel:0.62, label:"청록"},
                  {nm:434.047, rel:0.38, label:"파랑"},
                  {nm:410.174, rel:0.24, label:"보라"} ] },
    He: { name:"헬륨",   symbol:"He", color:"#facc15",
          note:"방전관에 넣으면 빨강·노랑·초록·파랑 선이 함께 나온다.",
          story:"태양의 스펙트럼에서 먼저 발견되고 나중에 지구에서 찾아낸 원소.",
          lines:[ {nm:667.815, rel:0.55, label:"빨강"},
                  {nm:587.562, rel:1.00, label:"노랑"},
                  {nm:501.568, rel:0.62, label:"초록"},
                  {nm:492.193, rel:0.30, label:"청록"},
                  {nm:471.315, rel:0.34, label:"파랑"},
                  {nm:447.148, rel:0.55, label:"청자"} ] },
    Na: { name:"나트륨", symbol:"Na", color:"#ef4444",
          note:"아주 가까이 붙은 노란 선 두 줄. 확대해야 갈라져 보인다.",
          story:"터널의 주황색 나트륨등이 내는 빛이 바로 이 두 줄이다.",
          lines:[ {nm:588.995, rel:1.00, label:"노랑 D2"},
                  {nm:589.592, rel:0.50, label:"노랑 D1"} ] }
  };

  /* 「별 판별」 탭 전용. 학생에게 원소명을 보이지 않는다. */
  var UNKNOWN = { name:"미확인 원소", symbol:"?", color:"#cbd5e1",
          note:"우리 지문 3종 어느 것과도 맞지 않는 선.",
          lines:[ {nm:393.366, rel:1.00}, {nm:396.847, rel:0.80}, {nm:422.673, rel:0.45} ] };

  /* linesOf()·starLines() 는 GASES 가 아니라 이 합본을 본다 */
  var ALL = Object.assign({}, GASES, { UNKNOWN: UNKNOWN });

  var STARS = {
    A: { label:"별 A", has:["H","He","Na"] },
    B: { label:"별 B", has:["H","UNKNOWN"] }
  };

  /* 화면에 띄우는 것은 관찰 지시뿐이다. 깨야 할 생각을 문장으로 보여 주지 않는다. */
  var PROMPTS = [
    "온도를 바꿔도 선의 자리가 그대로인지 확인해 보세요.",
    "같은 기체를 저온·고온으로 바꿔 두 스펙트럼을 겹쳐 보세요.",
    "광원을 끄고 기체만 가열하면 무엇이 보이는지 확인해 보세요."
  ];

  var VIEW_FULL = { nmMin:380, nmMax:750 };   /* 표시 파장 범위 */
  var ABS_DEPTH = 0.92;                       /* 흡수 깊이 계수 */
  var EMIT_GAIN = 1.00;

  /* ---------- 상태 판정 : 단일 원천 resolveRow() ---------- */

  var ROW = {
    1:{ mode:"continuous", path:{ beam:true,  cloudGlow:false, toPrism:"star",  scene:"space" } },
    2:{ mode:"absorption", path:{ beam:true,  cloudGlow:false, toPrism:"star",  scene:"space" } },
    3:{ mode:"emission",   path:{ beam:true,  cloudGlow:true,  toPrism:"cloud", scene:"space" } },
    4:{ mode:"emission",   path:{ beam:false, cloudGlow:true,  toPrism:"cloud", scene:"tube"  } },
    5:{ mode:"none",       path:{ beam:false, cloudGlow:false, toPrism:null,    scene:"tube"  } },
    6:{ mode:"none",       path:{ beam:false, cloudGlow:false, toPrism:null,    scene:"space" } }
  };

  /* 1~6. 프리즘은 보지 않는다. */
  function resolveRow(s) {
    var st = s || {};
    var hasGas = !!(st.gas && ALL[st.gas]);
    if (st.lightOn) {
      if (!hasGas) return 1;
      return st.hot ? 3 : 2;
    }
    if (!hasGas) return 6;
    return st.hot ? 4 : 5;
  }

  function mode(s) {
    return (s && s.prism) ? ROW[resolveRow(s)].mode : "none";
  }

  function stagePath(s) {
    var p = ROW[resolveRow(s)].path;
    return { beam:p.beam, cloudGlow:p.cloudGlow, scene:p.scene,
             toPrism: (s && s.prism) ? p.toPrism : null };
  }

  /* ---------- 연속 스펙트럼 (표면 온도) ---------- */

  var C2 = 1.4387768775e7;   /* 제2 복사 상수, nm·K */
  var WIEN = 2.8977719e6;    /* nm·K */

  function radiance(nm, T) {
    var x = C2 / (nm * T);
    var e = Math.exp(x) - 1;
    if (!(e > 0) || !isFinite(e)) return 0;
    return 1 / (Math.pow(nm, 5) * e);
  }

  /* 380~750 nm 구간 최대값으로 정규화한 0~1 */
  function planckRel(nm, T) {
    if (!(T > 0) || !isFinite(nm)) return 0;
    var peak = WIEN / T;
    if (peak < VIEW_FULL.nmMin) peak = VIEW_FULL.nmMin;
    if (peak > VIEW_FULL.nmMax) peak = VIEW_FULL.nmMax;
    var top = radiance(peak, T);
    if (!(top > 0)) return 0;
    var v = radiance(nm, T) / top;
    if (!isFinite(v) || v < 0) return 0;
    return v > 1 ? 1 : v;
  }

  /* ---------- 뷰 의존 선폭 ---------- */

  function sigmaRender(nmMin, nmMax, cssWidth) {
    var w = cssWidth || 40;
    if (!(w > 40)) w = 40;
    var v = 1.1 * (nmMax - nmMin) / w;
    if (!isFinite(v)) return 2.0;
    if (v < 0.18) return 0.18;
    if (v > 2.0) return 2.0;
    return v;
  }

  /* ---------- 파장 → 화면 색 (Bruton 계열 근사) ---------- */

  function wavelengthToRGB(nm) {
    var r = 0, g = 0, b = 0, f = 1;
    if (nm < 380 || nm > 750) return { r:0, g:0, b:0 };
    if (nm < 440)      { r = -(nm - 440) / 60; g = 0; b = 1; }
    else if (nm < 490) { r = 0; g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { r = 0; g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; b = 0; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; b = 0; }
    else               { r = 1; g = 0; b = 0; }
    if (nm < 420)      f = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 700) f = 0.3 + 0.7 * (750 - nm) / 50;
    return { r: Math.pow(r * f, 0.8), g: Math.pow(g * f, 0.8), b: Math.pow(b * f, 0.8) };
  }

  /* ---------- 선 커널 : 흡수·방출이 같은 함수·같은 배열·같은 σ ---------- */

  function lineSum(nm, lines, sigma, coef) {
    var s = 0;
    for (var i = 0; i < lines.length; i++) {
      var d = (nm - lines[i].nm) / sigma;
      s += coef * lines[i].rel * Math.exp(-(d * d));
    }
    return s;
  }

  /* 흡수 깊이 = 1 − 투과율.  투과율은 선마다 곱한다 — 더하지 않는다.
     Π(1 − 0.92·rel_i·exp(...)) 이므로 선이 겹쳐도 0(완전한 검정)이 되지 않는다.
     중심 파장·σ 는 emit 과 같은 배열·같은 값을 받는다 (위치 동일성). */
  function absDepth(nm, lines, sigma) {
    var t = 1;
    for (var i = 0; i < lines.length; i++) {
      var d = (nm - lines[i].nm) / sigma;
      t *= 1 - ABS_DEPTH * lines[i].rel * Math.exp(-(d * d));
    }
    if (!(t > 0)) t = 0;
    return 1 - t;
  }

  /* 표시 구간 안에서 Σ emit 의 최대값. 같은 인자면 다시 계산하지 않는다. */
  var peakCache = { key:null, val:1 };
  function peakSumOf(lines, sigma, nmMin, nmMax) {
    var key = sigma + "|" + nmMin + "|" + nmMax + "|" +
              lines.map(function (l) { return l.nm + ":" + l.rel; }).join(",");
    if (peakCache.key === key) return peakCache.val;
    var step = Math.max(sigma / 8, (nmMax - nmMin) / 4000);
    var best = -1, bx = nmMin;
    for (var x = nmMin; x <= nmMax + 1e-9; x += step) {
      var v = lineSum(x, lines, sigma, EMIT_GAIN);
      if (v > best) { best = v; bx = x; }
    }
    /* 격자 사이를 삼분 탐색으로 좁힌다 (값이 1을 넘지 않게) */
    var lo = Math.max(nmMin, bx - step), hi = Math.min(nmMax, bx + step);
    for (var k = 0; k < 60; k++) {
      var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (lineSum(m1, lines, sigma, EMIT_GAIN) < lineSum(m2, lines, sigma, EMIT_GAIN)) lo = m1;
      else hi = m2;
    }
    var top = Math.max(best, lineSum((lo + hi) / 2, lines, sigma, EMIT_GAIN));
    peakCache.key = key; peakCache.val = top;
    return top;
  }

  /* 어떤 선 배열이든 같은 커널로 밝기를 낸다 (관찰 탭·별 판별 탭 공용) */
  function bandIntensity(nm, lines, m, T, sigma, nmMin, nmMax) {
    if (m === "none") return 0;
    if (m === "continuous") return planckRel(nm, T);
    if (m === "absorption") {
      return planckRel(nm, T) * (1 - absDepth(nm, lines, sigma));
    }
    if (m === "emission") {
      var ps = peakSumOf(lines, sigma, nmMin, nmMax);
      return lineSum(nm, lines, sigma, EMIT_GAIN) / Math.max(1, ps);
    }
    return 0;
  }

  /* 화면 밝기 0~1.  state 에 nmMin·nmMax 가 있으면 그 구간을 쓴다. */
  function intensity(nm, state, T, sigma) {
    var st = state || {};
    var m = mode(st);
    if (m === "none") return 0;
    var lines = (st.gas && ALL[st.gas]) ? ALL[st.gas].lines : [];
    var lo = (typeof st.nmMin === "number") ? st.nmMin : VIEW_FULL.nmMin;
    var hi = (typeof st.nmMax === "number") ? st.nmMax : VIEW_FULL.nmMax;
    var s = (typeof sigma === "number" && sigma > 0) ? sigma : sigmaRender(lo, hi, 0);
    return bandIntensity(nm, lines, m, T, s, lo, hi);
  }

  function linesOf(id) {
    return (ALL[id] && ALL[id].lines) ? ALL[id].lines.slice() : [];
  }

  function wavelengthAt(x, x0, x1, nmMin, nmMax) {
    if (x1 === x0) return nmMin;
    return nmMin + (x - x0) / (x1 - x0) * (nmMax - nmMin);
  }

  /* STARS[starId].has 를 ALL 로 펼친 전체 선 배열 */
  function starLines(starId) {
    var st = STARS[starId];
    if (!st) return [];
    var out = [];
    for (var i = 0; i < st.has.length; i++) {
      var id = st.has[i], src = ALL[id];
      if (!src) continue;
      for (var j = 0; j < src.lines.length; j++) {
        out.push({ nm: src.lines[j].nm, rel: src.lines[j].rel,
                   label: src.lines[j].label, src: id });
      }
    }
    out.sort(function (a, b) { return a.nm - b.nm; });
    return out;
  }

  window.SpectrumCore = {
    GASES: GASES, UNKNOWN: UNKNOWN, ALL: ALL, STARS: STARS,
    PROMPTS: PROMPTS, ROW: ROW, VIEW_FULL: VIEW_FULL,
    ABS_DEPTH: ABS_DEPTH,
    resolveRow: resolveRow, mode: mode, stagePath: stagePath,
    planckRel: planckRel, sigmaRender: sigmaRender,
    wavelengthToRGB: wavelengthToRGB, intensity: intensity,
    bandIntensity: bandIntensity, lineSum: lineSum, absDepth: absDepth,
    linesOf: linesOf, wavelengthAt: wavelengthAt, starLines: starLines
  };

  /* Node 검산 환경에는 document 가 없다. 여기서 끝낸다. */
  if (typeof document === "undefined") return;

  /* ==========================================================
     2부 · 화면 (DOM · Canvas · 이벤트)
     파장 숫자는 이 아래에 한 번도 다시 적지 않는다. 전부 위 자료구조에서 온다.
     ========================================================== */

  function $(id) { return document.getElementById(id); }
  function CSSV(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }
  var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
             '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  var COL = {};
  function readTokens() {
    COL.stage  = CSSV("--stage-dark") || "#0f172a";
    COL.silver = CSSV("--p-silver")   || "#cbd5e1";
    COL.sky    = CSSV("--p-sky")      || "#56b4e9";
    COL.line   = CSSV("--stage-line") || "#94a3b8";
  }

  var DEFAULT_T = 5800;
  var ZOOM_VIEW = { nmMin:585, nmMax:595 };

  var st = { lightOn:true, gas:null, hot:false, prism:true,
             T:DEFAULT_T, zoom:false, overlay:false };
  var pointerNm = null;
  var tab = "obs";
  var starPick = null;          /* "H"|"He"|"Na"|"UNKNOWN"|null */
  var seen = {};                /* 학생이 맞대어 본 원소 */
  var prismTimer = null;
  var rafId = null, phase = 0, reduceMotion = false;

  function view() { return st.zoom ? ZOOM_VIEW : VIEW_FULL; }

  /* ---------- 캔버스 공통 ---------- */

  function fit(cv, hCss) {
    var box = cv.parentNode;
    var w = box.clientWidth;
    if (!(w >= 40)) return null;              /* 숨은 캔버스 · 너무 좁은 캔버스 */
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(w * dpr);
    cv.height = Math.round(hCss * dpr);
    cv.style.height = hCss + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hCss);
    return { ctx:ctx, w:w, h:hCss, dpr:dpr };
  }

  /* 띠는 장치 픽셀로 직접 채운다 (열 사이에 이음선이 생기지 않게) */
  function paintBand(f, yCss, hCss, lines, m, sigma, lo, hi) {
    var wD = Math.round(f.w * f.dpr), hD = Math.round(hCss * f.dpr);
    if (wD < 1 || hD < 1) return;
    var img = f.ctx.createImageData(wD, hD), d = img.data;
    for (var x = 0; x < wD; x++) {
      var nm = lo + (x + 0.5) * (hi - lo) / wD;
      var v = bandIntensity(nm, lines, m, st.T, sigma, lo, hi);
      var c = wavelengthToRGB(nm);
      var r = Math.round(255 * c.r * v), g = Math.round(255 * c.g * v), b = Math.round(255 * c.b * v);
      for (var y = 0; y < hD; y++) {
        var i = (y * wD + x) * 4;
        d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
      }
    }
    f.ctx.putImageData(img, 0, Math.round(yCss * f.dpr));
  }

  /* 화면에 실제로 그려진 열의 밝기 배열 (CSS 픽셀 열 기준) */
  function columnValues(w, lines, m, sigma, lo, hi) {
    var out = [];
    for (var px = 0; px < w; px++) {
      out.push(bandIntensity(lo + (px + 0.5) * (hi - lo) / w, lines, m, st.T, sigma, lo, hi));
    }
    return out;
  }

  /* 배열에서 극값이 있는 열을 찾는다. sign=+1 극대, -1 극소. 평탄 구간은 가운데를 쓴다. */
  function extremaCols(arr, sign) {
    var out = [], n = arr.length, i = 1;
    while (i < n - 1) {
      var b = arr[i] * sign;
      if (b > arr[i-1] * sign) {
        var j = i;
        while (j < n - 1 && arr[j+1] * sign === b) j++;
        if (j < n - 1 && arr[j+1] * sign < b) out.push((i + j) / 2);
        i = j + 1;
      } else i++;
    }
    return out;
  }

  function drawRuler(cv, lo, hi) {
    var f = fit(cv, 30);
    if (!f) return;
    var ctx = f.ctx, w = f.w, h = f.h;
    ctx.fillStyle = COL.stage; ctx.fillRect(0, 0, w, h);
    ctx.font = "700 11px " + FONT;
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.fillStyle = COL.silver;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var range = hi - lo;
    var cand = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200];
    var slot = ctx.measureText("0000.0").width + 16;   /* 굵은 글꼴 기준 폭 */
    var step = cand[cand.length - 1];
    for (var k = 0; k < cand.length; k++) {
      if (range / cand[k] <= w / slot) { step = cand[k]; break; }
    }
    var dec = step < 1 ? 1 : 0;
    var first = Math.ceil(lo / step) * step;
    for (var t = first; t <= hi + 1e-9; t += step) {
      var x = (t - lo) / range * w;
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, 7); ctx.stroke();
      var lab = t.toFixed(dec);
      var half = ctx.measureText(lab).width / 2;
      if (x - half > 1 && x + half < w - 1) ctx.fillText(lab, x, 9);
    }
  }

  /* ---------- 무대 ---------- */

  /* 무대의 별·빛줄기 색.
     스펙트럼 띠의 wavelengthToRGB(관찰 대상 자체 — 손대지 않는다)와 달리,
     여기는 "그 온도의 빛 전체를 눈이 보면 무슨 색인가"이므로
     사람 눈의 색대응함수(CIE 1931)로 적분해 sRGB 로 옮긴다.
     검산: 3000K 255,185,110 / 5800K 255,241,235 / 11400K 196,211,255 / 15000K 181,201,255 */
  function cmfLobe(nm, mu, s1, s2) {
    var t = (nm - mu) / (nm < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
  }
  function cmfX(nm) { return 1.056 * cmfLobe(nm, 599.8, 37.9, 31.0) +
                             0.362 * cmfLobe(nm, 442.0, 16.0, 26.7) -
                             0.065 * cmfLobe(nm, 501.1, 20.4, 26.2); }
  function cmfY(nm) { return 0.821 * cmfLobe(nm, 568.8, 46.9, 40.5) +
                             0.286 * cmfLobe(nm, 530.9, 16.3, 31.1); }
  function cmfZ(nm) { return 1.217 * cmfLobe(nm, 437.0, 11.8, 36.0) +
                             0.681 * cmfLobe(nm, 459.0, 26.0, 13.8); }
  function srgbEncode(v) {
    if (v <= 0) return 0;
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }
  var contCache = { T:null, val:null };
  function continuumColor(T) {
    if (contCache.T === T) return contCache.val;
    var X = 0, Y = 0, Z = 0;
    for (var nm = VIEW_FULL.nmMin; nm <= VIEW_FULL.nmMax + 1e-9; nm += 5) {
      var p = radiance(nm, T);
      X += p * cmfX(nm); Y += p * cmfY(nm); Z += p * cmfZ(nm);
    }
    var r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    var g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    var b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    if (r < 0) r = 0; if (g < 0) g = 0; if (b < 0) b = 0;
    var mx = Math.max(r, g, b) || 1;
    var out = { r: srgbEncode(r / mx), g: srgbEncode(g / mx), b: srgbEncode(b / mx) };
    contCache.T = T; contCache.val = out;
    return out;
  }

  /* 가열된 기체가 실제로 내는 빛의 색 — 그 기체의 방출선에서 계산한다.
     버튼 dot·안내선의 "식별색"과 다르다(식별색은 화면에서 구분하려고 붙인 표시다). */
  var emitColCache = {};
  function emissionColor(lines) {
    var key = lines.map(function (l) { return l.nm + ":" + l.rel; }).join(",");
    if (emitColCache[key]) return emitColCache[key];
    /* ⚠ wavelengthToRGB(Bruton)를 합산하지 마라. 그것은 "파장 하나"를 화면 색으로 바꾸는
       근사이고, 합산해 광대역 색을 얻는 것은 유효한 계산이 아니다 — 별 색이 분홍으로 나왔던
       것이 정확히 그 범주 오류였다. 광대역 색은 continuumColor()와 같은 CIE 경로를 쓴다.
       (검증: 이 식이면 He가 연분홍으로 나와 실제 헬륨 방전관 색과 맞는다. Bruton 합산은 연녹백이었다) */
    var X = 0, Y = 0, Z = 0;
    for (var i = 0; i < lines.length; i++) {
      var nm = lines[i].nm, w = lines[i].rel;
      X += w * cmfX(nm); Y += w * cmfY(nm); Z += w * cmfZ(nm);
    }
    var r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    var g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    var b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    if (r < 0) r = 0; if (g < 0) g = 0; if (b < 0) b = 0;
    var mx = Math.max(r, g, b) || 1;
    var out = { r: srgbEncode(r / mx), g: srgbEncode(g / mx), b: srgbEncode(b / mx) };
    emitColCache[key] = out;
    return out;
  }
  function rgba(c, a) {
    return "rgba(" + Math.round(255*c.r) + "," + Math.round(255*c.g) + "," +
           Math.round(255*c.b) + "," + (a == null ? 1 : a) + ")";
  }

  var STARFIELD = null;
  function starfield(w, h) {
    if (STARFIELD && STARFIELD.w === w && STARFIELD.h === h) return STARFIELD.pts;
    var pts = [], s = 20250806;
    for (var i = 0; i < 46; i++) {
      s = (s * 1103515245 + 12345) % 2147483648;
      var a = s / 2147483648;
      s = (s * 1103515245 + 12345) % 2147483648;
      var b = s / 2147483648;
      s = (s * 1103515245 + 12345) % 2147483648;
      pts.push({ x:a * w, y:b * h, r:0.6 + (s / 2147483648) * 1.1 });
    }
    STARFIELD = { w:w, h:h, pts:pts };
    return pts;
  }

  function arrowHead(ctx, x, y, ang, color, size) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.55); ctx.lineTo(-size, size * 0.55);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function stageLabel(ctx, text, alt, x, y, maxW) {
    ctx.font = "700 11px " + FONT;
    var t = text;
    if (ctx.measureText(t).width > maxW) t = alt;
    if (ctx.measureText(t).width > maxW) return;
    ctx.fillStyle = COL.silver;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(t, x, y);
  }

  function drawStage() {
    var cv = $("stage-canvas");
    if (!cv) return;
    var wBox = cv.parentNode.clientWidth;
    var hCss = Math.max(200, Math.min(300, Math.round(wBox * 0.56)));
    var f = fit(cv, hCss);
    if (!f) return;
    var ctx = f.ctx, w = f.w, h = f.h;
    var p = stagePath(st);
    var sc = continuumColor(st.T);
    var gasCol = st.gas ? GASES[st.gas].color : COL.silver;
    /* 빛으로 그리는 색은 방출선에서 계산한다 — 식별색을 빛의 색으로 쓰지 않는다 */
    var glowTri = st.gas ? rgbTriple(emissionColor(GASES[st.gas].lines)) : hexRGB(COL.silver);
    var hasGas = !!st.gas;

    ctx.fillStyle = COL.stage; ctx.fillRect(0, 0, w, h);

    if (p.scene === "space") {
      var pts = starfield(w, h);
      ctx.fillStyle = "rgba(" + hexRGB(COL.silver) + ",0.55)";
      for (var i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, 6.2832); ctx.fill();
      }
    } else {
      ctx.fillStyle = "rgba(" + hexRGB(COL.line) + ",0.10)";
      ctx.fillRect(0, h * 0.80, w, h * 0.20);
      ctx.strokeStyle = "rgba(" + hexRGB(COL.line) + ",0.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h * 0.80 + 0.5); ctx.lineTo(w, h * 0.80 + 0.5); ctx.stroke();
    }

    var yAx = h * 0.30, yPr = h * 0.64;
    var xStar = w * 0.11, xCloud = w * 0.40, xPrism = w * 0.70, xSpec = w * 0.90;
    var rStar = Math.max(11, Math.min(24, w * 0.05));
    var lw = Math.max(3, Math.round(h * 0.022));
    var srcX = hasGas ? xCloud : xStar + rStar;

    /* 빛줄기 : 별 → 기체 (고온이어도 끊지 않는다) */
    if (p.beam && p.scene === "space") {
      ctx.save();
      ctx.strokeStyle = rgba(sc, 0.9); ctx.lineWidth = lw; ctx.lineCap = "round";
      if (hasGas) {
        ctx.beginPath(); ctx.moveTo(xStar + rStar, yAx); ctx.lineTo(xCloud, yAx); ctx.stroke();
        if (p.toPrism !== "star") {
          /* 별빛은 구름 뒤로도 계속 나아간다 — 관측 대상만 바뀐다 */
          ctx.globalAlpha = 0.40;
          ctx.beginPath(); ctx.moveTo(xCloud, yAx); ctx.lineTo(w - 4, yAx); ctx.stroke();
        }
      } else if (p.toPrism !== "star") {
        /* 기체도 프리즘 경로도 없다 — 빛은 그대로 무대를 지나간다 */
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(xStar + rStar, yAx); ctx.lineTo(w - 4, yAx); ctx.stroke();
      }
      ctx.restore();
    }

    /* 분광기로 들어가는 경로 */
    if (p.toPrism) {
      var col = (p.toPrism === "cloud") ? "rgb(" + glowTri + ")" : rgba(sc, 0.95);
      var x0 = (p.toPrism === "cloud") ? xCloud : srcX;
      var y0 = (p.toPrism === "cloud" && p.scene === "tube") ? h * 0.42 : yAx;
      var x1 = xPrism - 16, y1 = yPr - 6;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
      arrowHead(ctx, x1, y1, Math.atan2(y1 - y0, x1 - x0), col, Math.max(7, lw * 2.2));
    }

    /* 기체 구름 / 방전관 */
    if (hasGas) {
      var pulse = (p.cloudGlow && !reduceMotion) ? 0.16 * Math.sin(phase * 2.618) : 0;
      if (p.scene === "tube") {
        var tw = Math.max(60, w * 0.22), th = Math.max(16, h * 0.10);
        var tx = xCloud - tw / 2, ty = h * 0.42 - th / 2;
        ctx.save();
        ctx.fillStyle = p.cloudGlow
          ? "rgba(" + glowTri + "," + (0.55 + pulse) + ")"
          : "rgba(" + hexRGB(COL.line) + ",0.16)";
        ctx.strokeStyle = COL.silver; ctx.lineWidth = 2;
        roundRect(ctx, tx, ty, tw, th, th / 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = COL.silver;
        ctx.fillRect(tx - 7, ty + th * 0.25, 7, th * 0.5);
        ctx.fillRect(tx + tw, ty + th * 0.25, 7, th * 0.5);
        ctx.restore();
        stageLabel(ctx, "방전관", "방전", xCloud, ty + th + 7, w * 0.3);
      } else {
        ctx.save();
        var rx = Math.max(22, w * 0.085), ry = Math.max(20, h * 0.16);
        var grd = ctx.createRadialGradient(xCloud, yAx, 1, xCloud, yAx, rx);
        /* 차가운 구름은 빛을 내지 않으므로 무채색으로 그린다 — 같은 기체가 저온에서 하늘색,
           고온에서 자홍색이면 "온도가 기체의 색을 바꾼다"로 읽힌다(매뉴얼 P5-M6).
           어느 기체인지는 무대 라벨과 기체 정보 패널이 이미 알린다. */
        var cloudTri = p.cloudGlow ? glowTri : hexRGB(COL.silver);
        grd.addColorStop(0, "rgba(" + cloudTri + "," + (p.cloudGlow ? 0.80 + pulse : 0.34) + ")");
        grd.addColorStop(1, "rgba(" + cloudTri + ",0)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(xCloud, yAx, rx, ry, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        stageLabel(ctx, p.cloudGlow ? "가열된 기체" : "차가운 기체", "기체",
                   xCloud, yAx + ry + 4, w * 0.34);
      }
    }

    /* 별 */
    if (p.scene === "space") {
      ctx.save();
      if (st.lightOn) {
        var g2 = ctx.createRadialGradient(xStar, yAx, 1, xStar, yAx, rStar * 2.4);
        g2.addColorStop(0, rgba(sc, 0.95));
        g2.addColorStop(1, rgba(sc, 0));
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(xStar, yAx, rStar * 2.4, 0, 6.2832); ctx.fill();
        ctx.fillStyle = rgba(sc, 1);
      } else {
        ctx.fillStyle = "rgba(" + hexRGB(COL.line) + ",0.38)";
      }
      ctx.beginPath(); ctx.arc(xStar, yAx, rStar, 0, 6.2832); ctx.fill();
      ctx.restore();
      stageLabel(ctx, st.lightOn ? "별 (광원)" : "별 (꺼짐)", "별",
                 xStar, yAx + rStar + 6, w * 0.2);
    }

    /* 프리즘 */
    var ps = Math.max(24, Math.min(46, w * 0.085));
    ctx.save();
    ctx.lineWidth = 2; ctx.strokeStyle = COL.silver;
    if (!st.prism) ctx.setLineDash([5, 4]);
    ctx.fillStyle = "rgba(" + hexRGB(COL.silver) + (st.prism ? ",0.16)" : ",0.04)");
    ctx.beginPath();
    ctx.moveTo(xPrism, yPr - ps * 0.62);
    ctx.lineTo(xPrism + ps * 0.58, yPr + ps * 0.45);
    ctx.lineTo(xPrism - ps * 0.58, yPr + ps * 0.45);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    stageLabel(ctx, st.prism ? "프리즘" : "프리즘 없음", "프리즘",
               xPrism, yPr + ps * 0.45 + 5, w * 0.26);

    /* 분광기 */
    ctx.save();
    var bw = Math.max(20, w * 0.05), bh = Math.max(26, h * 0.14);
    ctx.strokeStyle = COL.silver; ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(" + hexRGB(COL.line) + ",0.12)";
    roundRect(ctx, xSpec - bw / 2, yPr - bh / 2, bw, bh, 4);
    ctx.fill(); ctx.stroke();
    if (mode(st) !== "none") {
      var lines = st.gas ? ALL[st.gas].lines : [];
      var sg = sigmaRender(VIEW_FULL.nmMin, VIEW_FULL.nmMax, bw);
      for (var q = 0; q < bh - 8; q++) {
        var nmq = VIEW_FULL.nmMin + q / (bh - 8) * (VIEW_FULL.nmMax - VIEW_FULL.nmMin);
        var vq = bandIntensity(nmq, lines, mode(st), st.T, sg, VIEW_FULL.nmMin, VIEW_FULL.nmMax);
        var cq = wavelengthToRGB(nmq);
        ctx.fillStyle = "rgb(" + Math.round(255*cq.r*vq) + "," + Math.round(255*cq.g*vq) +
                        "," + Math.round(255*cq.b*vq) + ")";
        ctx.fillRect(xSpec - bw / 2 + 4, yPr - bh / 2 + 4 + q, bw - 8, 1);
      }
    }
    ctx.restore();
    stageLabel(ctx, "분광기", "분광", xSpec, yPr + bh / 2 + 5, w * 0.2);
  }

  function hexRGB(hex) {
    var h2 = hex.replace("#", "");
    return parseInt(h2.substr(0,2),16) + "," + parseInt(h2.substr(2,2),16) + "," +
           parseInt(h2.substr(4,2),16);
  }
  function rgbTriple(c) {
    return Math.round(255 * c.r) + "," + Math.round(255 * c.g) + "," + Math.round(255 * c.b);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 분석창 ---------- */

  var MODE_TEXT = {
    none:       ["대기 중", ""],
    continuous: ["연속 스펙트럼",
                 "별의 표면에서 나온 빛이 그대로 들어와, 색의 띠가 끊긴 데 없이 이어집니다."],
    absorption: ["흡수 스펙트럼",
                 "별빛보다 온도가 낮은 기체를 지나면서 일부 파장의 빛이 빠져, 이어진 띠 위에 어두운 선이 생깁니다."],
    emission:   ["방출 스펙트럼",
                 "고온으로 가열된 기체에서 나온 빛만 관측하면, 검은 바탕에 밝은 선이 보입니다."]
  };

  function noneReason() {
    if (!st.prism) return "프리즘을 놓아야 색이 나뉩니다 — 빛은 파장에 따라 굴절되는 정도가 다릅니다.";
    if (!st.lightOn && !st.gas) return "광원이 꺼져 있고 기체도 없습니다.";
    if (!st.lightOn && st.gas && !st.hot) return "광원이 꺼져 있고 기체도 차갑습니다. 기체를 가열해 보세요.";
    return "";
  }

  function renderAnalyzer() {
    var v = view(), m = mode(st);
    var cv = $("spec-canvas");
    var wBox = cv.parentNode.clientWidth;
    if (!(wBox >= 40)) return;
    var sigma = sigmaRender(v.nmMin, v.nmMax, wBox);
    var lines = st.gas ? ALL[st.gas].lines : [];
    /* 겹쳐 보기도 mode() 를 지킨다 — 광원을 끄거나 프리즘을 빼면 띠가 없다 */
    /* 겹쳐 보기는 흡수 띠(= 연속광 배경 + 어두운 선)를 함께 그린다. 광원이 꺼져 있으면
       그 배경이 물리적으로 존재하지 않으므로 st.lightOn 까지 요구한다.
       (PROMPTS 2번 → 3번 순서로 따라오면 겹쳐 보기를 켠 채 광원을 끄게 된다 — 설계된 동선이다) */
    var overlay = st.overlay && !!st.gas && m !== "none" && st.lightOn;
    var bandH = 84, gapH = 16;
    var f = fit(cv, overlay ? bandH * 2 + gapH : bandH);
    if (!f) return;
    var ctx = f.ctx, w = f.w;

    ctx.fillStyle = COL.stage; ctx.fillRect(0, 0, w, f.h);

    var gapTxt = "—", noteTxt = "";
    if (overlay) {
      paintBand(f, 0, bandH, lines, "absorption", sigma, v.nmMin, v.nmMax);
      paintBand(f, bandH + gapH, bandH, lines, "emission", sigma, v.nmMin, v.nmMax);
      /* 화면에 그려진 두 띠에서 선의 열을 직접 검출해 비교한다.
         흡수 쪽은 띠를 그린 바로 그 열 격자에서 연속광을 나눠 없앤 흡수 깊이를 본다 —
         배경이 든 raw 밝기의 극소는 플랑크 기울기만으로 한 열 끌려간다. */
      var depCols = [];
      for (var px = 0; px < w; px++) {
        depCols.push(absDepth(v.nmMin + (px + 0.5) * (v.nmMax - v.nmMin) / w, lines, sigma));
      }
      var aCols = extremaCols(depCols, 1);
      var eCols = extremaCols(columnValues(w, lines, "emission", sigma, v.nmMin, v.nmMax), 1);
      var n = Math.min(aCols.length, eCols.length), dPx = 0;
      for (var i = 0; i < n; i++) dPx = Math.max(dPx, Math.abs(aCols[i] - eCols[i]));
      var nmPerPx = (v.nmMax - v.nmMin) / w;
      /* 선을 하나도 검출하지 못했으면 재지 않은 값을 잰 값처럼 쓰지 않는다.
         또한 이 폭에서 두 선이 뭉쳐 검출 개수가 모자라면 "선 위치"라는 양 자체가 성립하지
         않는다 — 수치를 내지 말고 확대로 유도한다. (Na 전체 보기가 좁은 폭에서 여기 걸린다) */
      var inView = 0;
      for (var q = 0; q < lines.length; q++) {
        if (lines[q].nm >= v.nmMin && lines[q].nm <= v.nmMax) inView++;
      }
      var resolved = inView > 0 && aCols.length === inView && eCols.length === inView;
      gapTxt = resolved ? (dPx * nmPerPx).toFixed(3) : "—";
      ctx.save();
      ctx.strokeStyle = "rgba(" + hexRGB(COL.silver) + ",0.75)"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (var k = 0; k < n; k++) {
        var x = aCols[k] + 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, f.h); ctx.stroke();
      }
      ctx.restore();
      noteTxt = "위 = 흡수(저온) · 아래 = 방출(고온). 두 띠에서 검출한 선 — 어두운 선 " +
                aCols.length + "개 · 밝은 선 " + eCols.length + "개 · 열 차이 " +
                dPx.toFixed(1) + " px. 두 스펙트럼은 같은 파장 목록과 같은 선폭으로 그려집니다.";
      if (!resolved && inView > 1) {
        noteTxt = "이 폭에서는 " + inView + "개 선이 서로 뭉쳐 보입니다 — 「나트륨 D선 확대」로 갈라 보세요. " +
                  "선이 갈려야 자리를 견줄 수 있습니다.";
      }
      if (n === 0) noteTxt = "이 구간에는 선이 없습니다. 전체 보기로 돌아가 보세요.";
    } else if (m === "none") {
      noteTxt = noneReason();
    } else {
      paintBand(f, 0, bandH, lines, m, sigma, v.nmMin, v.nmMax);
      /* 저온에서는 보랏빛 배경 자체가 어두워져 보라 쪽 흡수선이 안 보인다.
         "선이 사라졌다"로 읽히면 오개념 ②를 오히려 강화하므로 그렇지 않다고 밝힌다. */
      if (m === "absorption" && st.T <= 4000) {
        noteTxt = "온도를 낮추면 보랏빛 배경 자체가 어두워집니다 — 보라 쪽 선이 없어진 것이 아니라 " +
                  "배경이 사라진 것입니다. 포인터로 파장을 짚어 확인해 보세요.";
      }
    }

    /* 포인터 표시선 */
    if (pointerNm != null && pointerNm >= v.nmMin && pointerNm <= v.nmMax && m !== "none") {
      var px = (pointerNm - v.nmMin) / (v.nmMax - v.nmMin) * w;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, f.h); ctx.stroke();
      ctx.restore();
    }

    drawRuler($("ruler-canvas"), v.nmMin, v.nmMax);

    var mt = MODE_TEXT[m];
    $("an-mode").textContent = mt[0];
    $("an-desc").textContent = (m === "none") ? noneReason() : mt[1];
    /* 유효숫자를 화면 분해능에 맞춘다 — 전체 보기는 0.3~1.1 nm/px 이므로 소수 자리가 과장이다 */
    $("rd-nm").textContent = (pointerNm == null) ? "—"
      : pointerNm.toFixed(st.zoom ? 1 : 0);
    $("rd-view").textContent = v.nmMin.toFixed(0) + "–" + v.nmMax.toFixed(0);
    $("rd-gap").textContent = gapTxt;
    $("an-note").textContent = noteTxt;
    $("zoom-btn").textContent = st.zoom ? "전체 보기로" : "나트륨 D선 확대";
    $("overlay-btn").textContent = st.overlay ? "겹쳐 보기 끄기" : "흡수·방출 겹쳐 보기";
    $("overlay-btn").disabled = !st.gas;
  }

  /* ---------- 조절 변인 · 정보 패널 ---------- */

  function stageLine() {
    var p = stagePath(st);
    var s;
    if (p.scene === "tube") {
      s = p.cloudGlow
        ? "광원을 껐습니다. 실험실 방전관 속 기체가 스스로 빛을 냅니다."
        : "광원을 껐고, 방전관의 기체도 차갑습니다.";
    } else if (!p.beam) {
      s = "광원을 껐습니다. 무대에 빛이 없습니다.";
    } else if (!st.prism) {
      /* 프리즘을 뺐어도 빛은 그대로 있다 — 나뉘지 않을 뿐이다 */
      s = st.gas
        ? (p.cloudGlow ? "별빛이 가열된 기체 구름을 지나갑니다."
                       : "별빛이 차가운 기체 구름을 지나갑니다.")
        : "별빛이 무대를 그대로 지나갑니다.";
      s += " 프리즘이 없어 빛이 색으로 나뉘지 않습니다.";
    } else if (p.toPrism === "cloud") {
      s = "별빛은 구름 뒤로도 그대로 나아갑니다. 지금 분광기가 보는 것은 가열된 기체에서 나온 빛입니다.";
    } else if (st.gas) {
      s = "별빛이 차가운 기체 구름을 지나 프리즘으로 들어갑니다.";
    } else {
      s = "별빛이 곧바로 프리즘으로 들어갑니다.";
    }
    $("stage-line").textContent = s;
  }

  function renderControls() {
    $("temp-val").textContent = st.T + " K";
    var btns = $("gas-btns").children;
    for (var i = 0; i < btns.length; i++) {
      var id = btns[i].getAttribute("data-gas");
      btns[i].className = "gbtn" + ((id === "" ? null : id) === st.gas ? " is-on" : "");
    }
    $("cold-btn").className = "sbtn" + (st.hot ? "" : " is-on");
    $("hot-btn").className  = "sbtn" + (st.hot ? " is-on" : "");
    $("light-on").checked = st.lightOn;
    $("temp").value = st.T;

    var g = st.gas ? GASES[st.gas] : null;
    $("gi-name").textContent = g ? (g.name + " (" + g.symbol + ")") : "기체 없음";
    $("gi-note").textContent = g ? g.note : "기체를 놓으면 여기에 설명이 나옵니다.";
  }

  function buildGasButtons() {
    var host = $("gas-btns");
    host.innerHTML = "";
    var items = [{ id:"", name:"없음", color:null }];
    Object.keys(GASES).forEach(function (k) {
      items.push({ id:k, name:GASES[k].symbol + " " + GASES[k].name, color:GASES[k].color });
    });
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "gbtn";
      b.setAttribute("data-gas", it.id);
      if (it.color) {
        b.innerHTML = '<span class="dot"></span>' + it.name;
        b.firstChild.style.background = it.color;
      } else {
        b.textContent = it.name;
      }
      b.onclick = function () {
        st.gas = it.id || null;
        if (!st.gas) { st.overlay = false; }
        renderObs();
      };
      host.appendChild(b);
    });
  }

  function buildSheet() {
    var host = $("sheet");
    host.innerHTML = "";
    Object.keys(GASES).forEach(function (k) {
      var g = GASES[k];
      var row = document.createElement("div");
      row.className = "sheet-row";
      var head = document.createElement("div");
      var sym = document.createElement("span");
      sym.className = "sym"; sym.textContent = g.symbol; sym.style.background = g.color;
      var nm = document.createElement("span");
      nm.className = "sheet-name"; nm.textContent = g.name;
      head.appendChild(sym); head.appendChild(nm);
      var chips = document.createElement("div");
      chips.className = "chips";
      g.lines.forEach(function (l) {
        var c = wavelengthToRGB(l.nm);
        var ch = document.createElement("span");
        ch.className = "chip";
        var bar = document.createElement("span");
        bar.className = "bar";
        bar.style.background = "rgb(" + Math.round(255*c.r) + "," + Math.round(255*c.g) +
                               "," + Math.round(255*c.b) + ")";
        ch.appendChild(bar);
        ch.appendChild(document.createTextNode(l.nm.toFixed(1) + " nm " + (l.label || "")));
        chips.appendChild(ch);
      });
      row.appendChild(head); row.appendChild(chips);
      host.appendChild(row);
    });
  }

  function buildStatic() {
    var pl = $("prompts");
    pl.innerHTML = "";
    PROMPTS.forEach(function (t) {
      var li = document.createElement("li"); li.textContent = t; pl.appendChild(li);
    });
    var sl = $("story-list");
    sl.innerHTML = "";
    Object.keys(GASES).forEach(function (k) {
      if (!GASES[k].story) return;
      var li = document.createElement("li");
      li.textContent = GASES[k].name + " — " + GASES[k].story;
      sl.appendChild(li);
    });
  }

  /* ---------- 별 판별 탭 ---------- */

  /* 별 판별 탭 띠의 실제 CSS 폭 */
  function starCanvasWidth() {
    var cv = $("starA-canvas");
    var w = cv ? cv.parentNode.clientWidth : 0;
    return (w >= 40) ? w : 400;
  }

  /* 이 선들이 별 스펙트럼 안에서 가장 가까이 붙어 있는 이웃과의 간격 */
  function minSeparation(lines) {
    var others = [];
    Object.keys(STARS).forEach(function (s) {
      starLines(s).forEach(function (l) { others.push(l.nm); });
    });
    var m = Infinity;
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < others.length; j++) {
        var d = Math.abs(lines[i].nm - others[j]);
        if (d > 1e-9 && d < m) m = d;
      }
    }
    return isFinite(m) ? m : 50;
  }

  /* 선 전부를 담되, 화면 폭이 좁으면 이웃한 선이 뭉치지 않을 만큼 좁힌다.
     σ ≤ (최소 이격)/2 가 되도록 구간 폭에 상한을 건다. */
  function windowFor(lines) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].nm < lo) lo = lines[i].nm;
      if (lines[i].nm > hi) hi = lines[i].nm;
    }
    if (!isFinite(lo)) return VIEW_FULL;
    var c = (lo + hi) / 2;
    var want = Math.max((hi - lo) * 1.2 + 10, 10);
    var cap  = Math.max(minSeparation(lines) / 2 * starCanvasWidth() / 1.1, 10);
    var range = Math.min(want, cap);
    var a = c - range / 2, b = c + range / 2;
    if (a < VIEW_FULL.nmMin) { b += VIEW_FULL.nmMin - a; a = VIEW_FULL.nmMin; }
    if (b > VIEW_FULL.nmMax) { a -= b - VIEW_FULL.nmMax; b = VIEW_FULL.nmMax; }
    if (a < VIEW_FULL.nmMin) a = VIEW_FULL.nmMin;
    return { nmMin: a, nmMax: b };
  }

  function zoomFor(id) { return windowFor(ALL[id].lines); }

  /* 지문 3종 어느 선과도 맞지 않는, 별 B에 남는 선 */
  function leftoverLines(starId) {
    var known = [];
    Object.keys(GASES).forEach(function (k) {
      GASES[k].lines.forEach(function (l) { known.push(l.nm); });
    });
    return starLines(starId).filter(function (l) {
      for (var i = 0; i < known.length; i++) if (Math.abs(l.nm - known[i]) < 0.5) return false;
      return true;
    });
  }

  function starView() {
    if (!starPick) return VIEW_FULL;
    if (starPick === "UNKNOWN") {
      var L = leftoverLines("B");
      return L.length ? windowFor(L) : VIEW_FULL;
    }
    return zoomFor(starPick);
  }

  function guideLines(f, v, hCss) {
    if (!starPick) return;
    var ctx = f.ctx, w = f.w;
    var src = (starPick === "UNKNOWN") ? leftoverLines("B") : ALL[starPick].lines;
    var col = (starPick === "UNKNOWN") ? UNKNOWN.color : ALL[starPick].color;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    src.forEach(function (l) {
      if (l.nm < v.nmMin || l.nm > v.nmMax) return;
      var x = (l.nm - v.nmMin) / (v.nmMax - v.nmMin) * w;
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, hCss); ctx.stroke();
    });
    ctx.restore();
  }

  function buildFingerprints() {
    var host = $("fp-rows");
    host.innerHTML = "";
    Object.keys(GASES).forEach(function (k) {
      var g = GASES[k];
      var item = document.createElement("div");
      item.className = "fpitem";
      var b = document.createElement("button");
      b.className = "ebtn"; b.setAttribute("data-el", k);
      b.innerHTML = '<span class="dot"></span>' + g.symbol + " " + g.name;
      b.firstChild.style.background = g.color;
      b.firstChild.style.display = "inline-block";
      b.firstChild.style.width = "11px"; b.firstChild.style.height = "11px";
      b.firstChild.style.borderRadius = "50%"; b.firstChild.style.marginRight = "7px";
      b.onclick = function () {
        starPick = (starPick === k) ? null : k;
        seen[k] = true;
        renderStar();
      };
      var col = document.createElement("div");
      var wrap = document.createElement("div");
      wrap.className = "stage stage--dark";
      var cvs = document.createElement("canvas");
      cvs.id = "fp-" + k;
      cvs.setAttribute("aria-label", g.name + "의 방출 스펙트럼");
      wrap.appendChild(cvs);
      var note = document.createElement("p");
      note.className = "fp-note"; note.id = "fpnote-" + k;
      col.appendChild(wrap); col.appendChild(note);
      item.appendChild(b); item.appendChild(col);
      host.appendChild(item);
    });
  }

  /* 표의 행은 지문 3종 + 「미확인 원소」.  ALL 이 유일한 원천이다. */
  function tableKeys() { return Object.keys(ALL); }

  function buildStarTable() {
    var tb = $("star-tbody");
    tb.innerHTML = "";
    $("th-a").textContent = STARS.A.label;
    $("th-b").textContent = STARS.B.label;
    tableKeys().forEach(function (k) {
      var tr = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.textContent = ALL[k].symbol + " " + ALL[k].name;
      tr.appendChild(td0);
      ["A", "B"].forEach(function (s) {
        var td = document.createElement("td");
        td.id = "cell-" + s + "-" + k;
        td.textContent = "—";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function renderStar() {
    var v = starView();
    var T = DEFAULT_T;
    var oldT = st.T; st.T = T;

    ["A", "B"].forEach(function (s) {
      var cv = $("star" + s + "-canvas");
      var wBox = cv.parentNode.clientWidth;
      if (!(wBox >= 40)) return;
      var f = fit(cv, 62);
      if (!f) return;
      var sigma = sigmaRender(v.nmMin, v.nmMax, f.w);
      f.ctx.fillStyle = COL.stage; f.ctx.fillRect(0, 0, f.w, f.h);
      paintBand(f, 0, 62, starLines(s), "absorption", sigma, v.nmMin, v.nmMax);
      guideLines(f, v, 62);
      $("star" + s + "-lab").textContent = STARS[s].label + " — 흡수 스펙트럼";
    });

    Object.keys(GASES).forEach(function (k) {
      var cv = $("fp-" + k);
      if (!cv) return;
      var wBox = cv.parentNode.clientWidth;
      if (!(wBox >= 40)) return;
      var f = fit(cv, 40);
      if (!f) return;
      var sigma = sigmaRender(v.nmMin, v.nmMax, f.w);
      f.ctx.fillStyle = COL.stage; f.ctx.fillRect(0, 0, f.w, f.h);
      paintBand(f, 0, 40, ALL[k].lines, "emission", sigma, v.nmMin, v.nmMax);
      var inView = ALL[k].lines.filter(function (l) {
        return l.nm >= v.nmMin && l.nm <= v.nmMax;
      });
      var np = $("fpnote-" + k);
      if (np) np.textContent = inView.length
        ? ""
        : "이 구간에는 " + ALL[k].name + " 선이 없습니다.";
      if (!inView.length) {
        /* 선이 하나도 없는 구간에서도 띠가 있다는 것은 보이게 한다 */
        f.ctx.save();
        f.ctx.strokeStyle = "rgba(" + hexRGB(COL.line) + ",0.30)"; f.ctx.lineWidth = 1;
        f.ctx.beginPath(); f.ctx.moveTo(0, 20.5); f.ctx.lineTo(f.w, 20.5); f.ctx.stroke();
        f.ctx.restore();
      }
      if (starPick === k) guideLines(f, v, 40);
    });

    drawRuler($("star-ruler"), v.nmMin, v.nmMax);
    st.T = oldT;

    var btns = $("fp-rows").querySelectorAll(".ebtn");
    for (var i = 0; i < btns.length; i++) {
      var k2 = btns[i].getAttribute("data-el");
      btns[i].className = "ebtn" + (starPick === k2 ? " is-on" : "");
    }
    $("unknown-btn").className = "btn" + (starPick === "UNKNOWN" ? " is-on" : "");

    var note = "표시 구간 " + v.nmMin.toFixed(0) + "–" + v.nmMax.toFixed(0) + " nm.";
    if (starPick && starPick !== "UNKNOWN") {
      var tot = ALL[starPick].lines.length;
      var shown = ALL[starPick].lines.filter(function (l) {
        return l.nm >= v.nmMin && l.nm <= v.nmMax;
      }).length;
      note += " " + ALL[starPick].name + "의 선 주변으로 확대했습니다.";
      if (shown < tot) {
        note += " 이 구간에 " + tot + "개 중 " + shown +
                "개가 들어옵니다 — 화면이 좁아 나머지는 「전체 보기로」에서 확인하세요.";
      }
    } else if (starPick === "UNKNOWN") {
      var lv = leftoverLines("B");
      note += " 지문 3종 어느 것과도 맞지 않는 선 " + lv.length +
              "개가 " + STARS.B.label + "에만 있습니다.";
    } else {
      note += " 원소 지문을 누르면 그 선 주변으로 확대됩니다.";
    }
    $("star-view-note").textContent = note;

    tableKeys().forEach(function (k) {
      ["A", "B"].forEach(function (s) {
        var cell = $("cell-" + s + "-" + k);
        if (!cell) return;
        cell.textContent = seen[k] ? (STARS[s].has.indexOf(k) >= 0 ? "있음" : "없음") : "—";
      });
    });

    $("rotate-hint").className = "rotate-hint" +
      (window.innerWidth < 1024 ? "" : " hid");

    /* STARS 를 바꾸면 표뿐 아니라 마무리 문구도 따라 바뀌어야 한다(단일 원천, 체크리스트 27) */
    buildWrapup();
  }

  function buildWrapup() {
    /* 공통 원소는 STARS 에서 계산한다 — 이름을 다시 타이핑하지 않는다 */
    var common = STARS.A.has.filter(function (k) {
      return STARS.B.has.indexOf(k) >= 0;
    }).map(function (k) { return ALL[k] ? ALL[k].name : k; }).join("·");
    var pct = document.createElement("p");
    pct.textContent =
      "우주에 존재하는 원소는 수소가 약 74 %, 헬륨이 약 24 %입니다. " +
      (common ? "두 별의 공통 원소는 " + common + "입니다. " : "두 별에 공통으로 있는 원소는 없습니다. ") +
      STARS.B.label + "에는 우리 지문 3종 어디에도 없는 선이 남습니다 — " +
      "스펙트럼은 아직 지문을 갖고 있지 않은 원소의 존재도 알려 줍니다.";
    var box = document.createElement("div");
    box.className = "card story";
    var h = document.createElement("div");
    h.className = "sumline"; h.textContent = "알아 두면 좋은 이야기";
    var ul = document.createElement("ul");
    var li = document.createElement("li");
    li.textContent = GASES.He.name + " — " + GASES.He.story;
    ul.appendChild(li);
    box.appendChild(h); box.appendChild(ul);
    var host = $("wrapup");
    host.textContent = "";
    host.appendChild(pct);
    host.appendChild(box);
  }

  /* ---------- 그리기 묶음 ---------- */

  function renderObs() {
    renderControls();
    drawStage();
    stageLine();
    renderAnalyzer();
    kickAnim();
  }
  function renderAll() {
    if (tab === "obs") renderObs(); else renderStar();
  }

  /* ---------- 애니메이션 ---------- */

  function needAnim() {
    return tab === "obs" && !reduceMotion && stagePath(st).cloudGlow && !document.hidden;
  }
  function loop(ts) {
    phase = ts / 1000;
    drawStage();
    rafId = needAnim() ? requestAnimationFrame(loop) : null;
  }
  function kickAnim() {
    if (!rafId && needAnim()) rafId = requestAnimationFrame(loop);
  }

  /* ---------- 시작 ---------- */

  function switchTab(name) {
    tab = name;
    $("panel-obs").className  = (name === "obs")  ? "" : "hid";
    $("panel-star").className = (name === "star") ? "" : "hid";
    $("tab-obs").className  = "tab" + (name === "obs"  ? " is-on" : "");
    $("tab-star").className = "tab" + (name === "star" ? " is-on" : "");
    $("tab-desc").textContent = (name === "obs")
      ? "광원·온도·기체를 바꿔 가며, 세 가지 스펙트럼이 각각 어떤 조건에서 나타나는지 봅니다."
      : "미지의 별 두 개의 스펙트럼을, 우리가 아는 원소의 지문과 맞대어 봅니다.";
    renderAll();
  }

  function resetAll() {
    st.lightOn = true; st.gas = null; st.hot = false; st.prism = true;
    st.T = DEFAULT_T; st.zoom = false; st.overlay = false;
    pointerNm = null;
    if (prismTimer) { clearTimeout(prismTimer); prismTimer = null;
      $("prism-btn").disabled = false; $("prism-btn").textContent = "프리즘 빼 보기"; }
    renderObs();
  }

  function bind() {
    $("tab-obs").onclick  = function () { switchTab("obs"); };
    $("tab-star").onclick = function () { switchTab("star"); };

    $("light-on").onchange = function () { st.lightOn = this.checked; renderObs(); };
    $("temp").oninput = function () { st.T = parseInt(this.value, 10); renderObs(); };
    $("cold-btn").onclick = function () { st.hot = false; renderObs(); };
    $("hot-btn").onclick  = function () { st.hot = true;  renderObs(); };
    $("reset-btn").onclick = resetAll;

    $("prism-btn").onclick = function () {
      if (prismTimer) return;
      st.prism = false; renderObs();
      this.disabled = true; this.textContent = "프리즘을 뺐습니다 — 곧 되돌아옵니다";
      prismTimer = setTimeout(function () {
        st.prism = true; prismTimer = null;
        $("prism-btn").disabled = false;
        $("prism-btn").textContent = "프리즘 빼 보기";
        renderObs();
      }, 2600);
    };

    $("zoom-btn").onclick = function () { st.zoom = !st.zoom; pointerNm = null; renderAnalyzer(); };
    $("overlay-btn").onclick = function () {
      if (!st.gas) return;
      st.overlay = !st.overlay; renderAnalyzer();
    };

    var cv = $("spec-canvas");
    function movePointer(clientX) {
      var r = cv.getBoundingClientRect();
      var v = view();
      var nm = wavelengthAt(clientX - r.left, 0, r.width, v.nmMin, v.nmMax);
      pointerNm = Math.max(v.nmMin, Math.min(v.nmMax, nm));
      renderAnalyzer();
    }
    cv.addEventListener("mousemove", function (e) { movePointer(e.clientX); });
    cv.addEventListener("mouseleave", function () { pointerNm = null; renderAnalyzer(); });
    cv.addEventListener("touchmove", function (e) {
      if (e.touches.length) { movePointer(e.touches[0].clientX); e.preventDefault(); }
    }, { passive:false });
    cv.addEventListener("touchstart", function (e) {
      if (e.touches.length) movePointer(e.touches[0].clientX);
    });

    $("unknown-btn").onclick = function () {
      starPick = (starPick === "UNKNOWN") ? null : "UNKNOWN";
      seen.UNKNOWN = true;
      renderStar();
    };
    $("star-reset").onclick = function () { starPick = null; renderStar(); };

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else kickAnim();
    });

    var pending = false;
    function onResize() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; renderAll(); });
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(onResize);
      ro.observe(document.querySelector("main.wrap"));
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
  }

  function start() {
    readTokens();
    try {
      reduceMotion = window.matchMedia &&
                     window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { reduceMotion = false; }
    buildGasButtons();
    buildSheet();
    buildStatic();
    buildFingerprints();
    buildStarTable();
    buildWrapup();
    bind();
    switchTab("obs");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

})();
