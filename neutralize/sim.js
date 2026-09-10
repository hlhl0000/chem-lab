/* ============================================================
   중화 반응과 남은 이온 — neutralize/sim.js
   통합과학2 Ⅰ-2 · 6~7차시 · 반박 대상 M14

   ⚠ 성취기준 [10통과2-01-04] 해설 — 중화 반응 과정에서의 변화는
      「용액의 온도 변화와 지시약의 색 변화만」 다룬다.
      → pH 축·전기 전도도·양적 계산을 이 화면에 넣지 않는다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/neutralize_core.js 와 문자 단위로 같다.
   아래 절단 마커까지가 core 이며, 마커 주석을 지우거나 바꾸면 동기 검사가 깨진다. */

var NEU = {
  C:    1.0,    /* mol/L  지도서 116쪽 탐구 유의점 1 「적절한 온도 변화를 보려면 1 M이 적당」 */
  T0:   20.0,   /* ℃      실온 (가정 — 화면과 「가정과 한계」에 명시) */
  DH:   57.3,   /* kJ/mol 강산+강염기 중화열 문헌값 (H⁺(aq)+OH⁻(aq)→H₂O(l)) */
  CP:   4.18,   /* J/(g·K) 물의 비열 */
  RHO:  1.0,    /* g/mL   용액 밀도 가정 */
  PPML: 1,      /* 화면에 1 mL 를 입자 «몇 개»로 그리는가 (도식) */
  VMAX: 12,     /* mL     슬라이더 상한 */
  VTOT: 12      /* mL     홈판 절차의 총 부피 — 그래프에 올릴 수 있는 조합의 조건 */
};

/* 섞기 «전» 이온 개수 (도식). 완전 해리를 가정한다 */
function neuIonsBefore(va, vb) {
  return { H: va * NEU.PPML, Cl: va * NEU.PPML, Na: vb * NEU.PPML, OH: vb * NEU.PPML };
}

/* 섞은 «뒤» 남은 이온 개수 + 생긴 물 분자 수.
   H⁺ + OH⁻ → H₂O 만 일어나고, Na⁺·Cl⁻ 는 아무 일도 겪지 않는다(구경꾼) */
function neuIonsAfter(va, vb) {
  var b = neuIonsBefore(va, vb);
  var pair = Math.min(b.H, b.OH);
  return { H: b.H - pair, OH: b.OH - pair, Na: b.Na, Cl: b.Cl, W: pair };
}

/* 실제로 반응한 몰수 — 개수 도식이 아니라 «농도×부피»로 따로 계산한다 */
function neuMolReacted(va, vb) { return Math.min(va, vb) * NEU.C / 1000; }

/* 방출된 열 (J) */
function neuHeatJ(va, vb) { return NEU.DH * 1000 * neuMolReacted(va, vb); }

/* 온도 상승 (K) — 열손실 무시, 용액의 비열을 물과 같다고 본다 */
function neuDeltaT(va, vb) {
  var m = (va + vb) * NEU.RHO;
  if (m <= 0) return 0;
  return neuHeatJ(va, vb) / (m * NEU.CP);
}
function neuMaxTemp(va, vb) { return NEU.T0 + neuDeltaT(va, vb); }

/* 액성 — 남은 이온이 정한다. 「중화 반응이 일어났는가」가 아니라 「무엇이 남았는가」 */
function neuNature(va, vb) {
  var a = neuIonsAfter(va, vb);
  if (a.H  > 0) return "acid";
  if (a.OH > 0) return "base";
  if (a.W === 0 && a.Na === 0 && a.Cl === 0) return "none";
  return "neutral";
}
function neuNatureLabel(n) {
  return n === "acid" ? "산성" : n === "base" ? "염기성" : n === "neutral" ? "중성" : "—";
}

/* BTB 용액의 «실물» 색 — 사이트 테마 색이 아니다(매뉴얼 P6 예외 2).
   색만으로 알리지 않는다 — 화면에는 늘 글자 라벨을 함께 낸다(매뉴얼 §8) */
function neuBTB(n) {
  return n === "acid" ? "#e8cc16" : n === "base" ? "#17509e"
       : n === "neutral" ? "#46a03a" : "#eaf1f7";
}

/* 전하 총합 — 섞기 전후 모두 0이어야 한다 (검산용) */
function neuCharge(o) { return (o.H + (o.Na || 0)) - (o.OH + (o.Cl || 0)); }

/* 홈판 A~E — 지도서 116쪽 탐구 절차 그대로 (총 부피 12 mL) */
var NEU_PRESET = [
  { k: "A", va: 2,  vb: 10 },
  { k: "B", va: 4,  vb: 8  },
  { k: "C", va: 6,  vb: 6  },
  { k: "D", va: 8,  vb: 4  },
  { k: "E", va: 10, vb: 2  }
];

/* 그래프에 올릴 수 있는 조합인가 — 홈판과 같은 총 부피일 때만 */
function neuPlottable(va, vb) { return (va + vb) === NEU.VTOT && va > 0 && vb > 0; }

/* ================= UI + 렌더 ================= */

if (typeof document !== "undefined") (function () {

var $ = function (id) { return document.getElementById(id); };
var CSSV = function (n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
};
var C = {
  t1: CSSV("--t1"), t2: CSSV("--t2"), t3: CSSV("--t3"), line: CSSV("--line"),
  amber: CSSV("--d-amber"), blue: CSSV("--d-blue"), gray: CSSV("--d-gray"),
  red: CSSV("--d-red"), green: CSSV("--d-green"), cyan: CSSV("--d-cyan"),
  glass: "rgba(160,200,228,0.75)"
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/* ---------- 상태 ---------- */
var st = {
  va: 6, vb: 6,
  phase: "before",   /* before → mixing → after */
  p: 0,              /* 섞임 진행 0..1 */
  btb: false,
  guess: null,
  zoom: true,
  parts: [],
  records: []        /* {va, vb, T, nature} */
};

var cv = $("stageCv"), ctx = cv.getContext("2d");
var gcv = $("graphCv"), gctx = gcv.getContext("2d");
var rafId = null, lastT = 0;

/* ---------- 입자 만들기 ---------- */
function rnd(a, b) { return a + Math.random() * (b - a); }

function buildParts() {
  var b = neuIonsBefore(st.va, st.vb);
  var arr = [], i;
  /* 왼쪽 반 = 묽은 염산 (H⁺, Cl⁻) · 오른쪽 반 = 수산화 나트륨 수용액 (Na⁺, OH⁻) */
  function push(kind, n, x0, x1) {
    for (var j = 0; j < n; j++) {
      arr.push({
        kind: kind, x: rnd(x0, x1), y: rnd(0.10, 0.90),
        vx: 0, vy: 0, sx: 0, sy: 0, mx: 0, my: 0, pair: -1, water: false
      });
    }
  }
  push("H",  b.H,  0.06, 0.44);
  push("Cl", b.Cl, 0.06, 0.44);
  push("Na", b.Na, 0.56, 0.94);
  push("OH", b.OH, 0.56, 0.94);
  /* 겹침을 줄인다 — 같은 반쪽 안에서만 밀어낸다 */
  for (var pass = 0; pass < 26; pass++) {
    for (i = 0; i < arr.length; i++) for (var j2 = i + 1; j2 < arr.length; j2++) {
      var A = arr[i], B = arr[j2];
      var dx = B.x - A.x, dy = (B.y - A.y) * 0.45, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001 && d < 0.115) {
        var k = (0.115 - d) / d * 0.34;
        A.x -= dx * k; A.y -= dy * k / 0.45;
        B.x += dx * k; B.y += dy * k / 0.45;
      }
    }
    for (i = 0; i < arr.length; i++) {
      var left = (arr[i].kind === "H" || arr[i].kind === "Cl");
      arr[i].x = Math.max(left ? 0.05 : 0.55, Math.min(left ? 0.45 : 0.95, arr[i].x));
      arr[i].y = Math.max(0.09, Math.min(0.91, arr[i].y));
    }
  }
  st.parts = arr;
}

/* 섞기 — H⁺ 와 OH⁻ 를 짝짓고, 나머지는 흩어질 자리를 정한다 */
function startMix() {
  if (st.phase !== "before") return;
  var arr = st.parts, hs = [], os = [], i;
  for (i = 0; i < arr.length; i++) {
    arr[i].sx = arr[i].x; arr[i].sy = arr[i].y;
    if (arr[i].kind === "H")  hs.push(i);
    if (arr[i].kind === "OH") os.push(i);
  }
  var n = Math.min(hs.length, os.length);
  for (i = 0; i < n; i++) {
    var a = arr[hs[i]], c = arr[os[i]];
    var mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    mx = mx * 0.55 + 0.5 * 0.45;                 /* 만나는 자리를 가운데로 조금 당긴다 */
    a.pair = os[i]; c.pair = hs[i];
    a.mx = mx; a.my = my; c.mx = mx; c.my = my;
  }
  /* 짝을 못 찾은 것과 구경꾼 — 상자 전체로 흩어진다 */
  for (i = 0; i < arr.length; i++) {
    if (arr[i].pair < 0) { arr[i].mx = rnd(0.06, 0.94); arr[i].my = rnd(0.10, 0.90); }
  }
  st.phase = "mixing"; st.p = 0;
  if (RM) { st.p = 1; finishMix(); }
  sync();
}

function finishMix() {
  var arr = st.parts, i, out = [];
  for (i = 0; i < arr.length; i++) {
    var q = arr[i];
    q.x = q.mx; q.y = q.my;
    if (q.pair >= 0) {
      if (q.kind === "H") { q.water = true; q.kind = "W"; out.push(q); }   /* 짝당 물 1개 */
    } else out.push(q);
  }
  for (i = 0; i < out.length; i++) {
    out[i].pair = -1;
    out[i].vx = RM ? 0 : rnd(-0.055, 0.055);
    out[i].vy = RM ? 0 : rnd(-0.075, 0.075);
  }
  st.parts = out;
  st.phase = "after";
}

function reset(keepVol) {
  st.phase = "before"; st.p = 0; st.btb = false; st.guess = null;
  if (!keepVol) { st.va = 6; st.vb = 6; }
  $("va").value = st.va; $("vb").value = st.vb;
  buildParts(); sync();
}

/* ---------- 캔버스 크기 ---------- */
function fit(canvas, context, hCss) {
  var wrap = canvas.parentNode, w = wrap.clientWidth;
  if (w < 40) return 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hCss * dpr);
  canvas.style.height = hCss + "px";
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}

/* ---------- 거시: 비커 + 온도계 ---------- */
function drawBeaker(w, y0, y1) {
  var nat = st.btb ? neuNature(st.va, st.vb) : "none";
  var vt = st.va + st.vb;
  var bw = Math.min(140, w * 0.33), bx = w * 0.30 - bw / 2;
  var by = y0 + 12, bh = (y1 - y0) - 40;
  var inner = bh - 10;
  var lvl = Math.max(0, Math.min(1, vt / 24));
  var lh = inner * lvl;

  /* 유리 */
  ctx.save();
  ctx.lineWidth = 2.2; ctx.strokeStyle = "#b6c6d6";
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh - 10);
  ctx.quadraticCurveTo(bx, by + bh, bx + 10, by + bh);
  ctx.lineTo(bx + bw - 10, by + bh);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw, by + bh - 10);
  ctx.lineTo(bx + bw, by);
  ctx.stroke();

  /* 용액 */
  if (lh > 1) {
    var ly = by + bh - lh;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx + 1.5, ly); ctx.lineTo(bx + 1.5, by + bh - 11);
    ctx.quadraticCurveTo(bx + 1.5, by + bh - 1.5, bx + 11, by + bh - 1.5);
    ctx.lineTo(bx + bw - 11, by + bh - 1.5);
    ctx.quadraticCurveTo(bx + bw - 1.5, by + bh - 1.5, bx + bw - 1.5, by + bh - 11);
    ctx.lineTo(bx + bw - 1.5, ly); ctx.closePath();
    ctx.fillStyle = neuBTB(nat); ctx.globalAlpha = st.btb ? 0.80 : 1; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(bx + 1.5, ly); ctx.lineTo(bx + bw - 1.5, ly);
    ctx.strokeStyle = "rgba(40,45,52,0.30)"; ctx.lineWidth = 1.4; ctx.stroke();
  }
  /* 유리 하이라이트 (§5 — 흰색이 아니라 옅은 청색) */
  ctx.beginPath(); ctx.moveTo(bx + 7, by + 12); ctx.lineTo(bx + 7, by + bh - 22);
  ctx.strokeStyle = C.glass; ctx.lineWidth = 2.6; ctx.stroke();

  /* 눈금 */
  ctx.strokeStyle = "rgba(40,45,52,0.30)"; ctx.lineWidth = 1;
  ctx.fillStyle = C.t3; ctx.font = "10px " + FONT; ctx.textAlign = "left";
  for (var v = 6; v <= 24; v += 6) {
    var yy = by + bh - inner * (v / 24);
    ctx.beginPath(); ctx.moveTo(bx + bw - 12, yy); ctx.lineTo(bx + bw, yy); ctx.stroke();
  }
  ctx.restore();

  /* 비커 아래 설명 */
  ctx.fillStyle = C.t2; ctx.font = "11.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText(st.phase === "before"
    ? ("묽은 염산 " + st.va + " + 수산화 나트륨 " + st.vb + " mL (아직 안 섞음)")
    : ("혼합 용액 " + vt + " mL"), bx + bw / 2, by + bh + 16);
  ctx.fillStyle = st.btb ? C.t1 : C.t3; ctx.font = "600 12px " + FONT;
  ctx.fillText(st.btb ? ("BTB — " + neuNatureLabel(nat))
                      : "BTB 아직 안 넣음", bx + bw / 2, by + bh + 32);
  return { bx: bx, bw: bw, by: by, bh: bh };
}

function drawThermo(w, y0, y1) {
  var T = st.phase === "before" ? NEU.T0
        : NEU.T0 + neuDeltaT(st.va, st.vb) * (st.phase === "after" ? 1 : ease(st.p));
  var lo = 18, hi = 30;
  var tx = w * 0.66, ty = y0 + 16, th = (y1 - y0) - 56, tw = 13;
  var bulbR = 11, bulbY = ty + th + bulbR - 2;

  ctx.save();
  /* 관 */
  ctx.beginPath();
  ctx.moveTo(tx - tw / 2, ty + 6);
  ctx.arc(tx, ty + 6, tw / 2, Math.PI, 0);
  ctx.lineTo(tx + tw / 2, ty + th);
  ctx.moveTo(tx - tw / 2, ty + 6); ctx.lineTo(tx - tw / 2, ty + th);
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, bulbY, bulbR, 0, Math.PI * 2);
  ctx.strokeStyle = "#b6c6d6"; ctx.stroke();

  /* 액주 (계측기 지시부 — 관습색 빨강. §4 예외) */
  var f = Math.max(0, Math.min(1, (T - lo) / (hi - lo)));
  var colTop = ty + th - (th - 12) * f;
  ctx.beginPath(); ctx.arc(tx, bulbY, bulbR - 2.4, 0, Math.PI * 2);
  ctx.fillStyle = C.red; ctx.fill();
  ctx.fillRect(tx - tw / 2 + 2.4, colTop, tw - 4.8, ty + th - colTop);

  /* 눈금 */
  ctx.font = "10px " + FONT; ctx.textAlign = "left";
  for (var v = lo; v <= hi; v += 2) {
    var yy = ty + th - (th - 12) * ((v - lo) / (hi - lo));
    ctx.beginPath(); ctx.moveTo(tx + tw / 2, yy); ctx.lineTo(tx + tw / 2 + 5, yy);
    ctx.strokeStyle = "rgba(40,45,52,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    if (v % 4 === 0) { ctx.fillStyle = C.t3; ctx.fillText(v + "", tx + tw / 2 + 8, yy + 3.5); }
  }
  ctx.restore();

  ctx.fillStyle = C.t1; ctx.font = "600 14px " + FONT; ctx.textAlign = "center";
  ctx.fillText(T.toFixed(1) + " ℃", tx + 6, bulbY + bulbR + 17);
  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT;
  ctx.fillText(st.phase === "before" ? "섞기 전" : "최고 온도", tx + 6, bulbY + bulbR + 32);
}

/* ---------- 미시: 이온 상자 ---------- */
var ION = {
  H:  { col: null, sym: "H⁺",  cat: "양", key: true  },
  OH: { col: null, sym: "OH⁻", cat: "음", key: true  },
  Na: { col: null, sym: "Na⁺", cat: "양", key: false },
  Cl: { col: null, sym: "Cl⁻", cat: "음", key: false },
  W:  { col: null, sym: "",    cat: "물", key: false }
};
function ionColor(k) {
  return k === "H" ? C.amber : k === "OH" ? C.blue : k === "W" ? "#c8d4e0" : C.gray;
}
function darker(hex, f) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "rgba(0,0,0,.5)";
  var n = parseInt(m[1], 16);
  var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f),
      b = Math.round((n & 255) * f);
  return "rgb(" + r + "," + g + "," + b + ")";
}
function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }

function drawIonBox(w, y0, y1) {
  var pad = 8;
  var bx = pad, by = y0, bw = w - pad * 2, bh = y1 - y0;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10);
  else ctx.rect(bx, by, bw, bh);
  ctx.fillStyle = "#fbfdff"; ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();

  /* 섞기 전 — 두 용액의 경계 */
  if (st.phase === "before") {
    ctx.beginPath(); ctx.setLineDash([5, 4]);
    ctx.moveTo(bx + bw / 2, by + 6); ctx.lineTo(bx + bw / 2, by + bh - 6);
    ctx.strokeStyle = "rgba(40,45,52,0.28)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "11.5px " + FONT; ctx.textAlign = "center"; ctx.fillStyle = C.t3;
    ctx.fillText("묽은 염산 " + st.va + " mL", bx + bw * 0.25, by + 15);
    ctx.fillText("수산화 나트륨 수용액 " + st.vb + " mL", bx + bw * 0.75, by + 15);
  }

  var r = Math.max(9, Math.min(15, bw / 30));
  var e = ease(st.p);
  for (var i = 0; i < st.parts.length; i++) {
    var q = st.parts[i], nx = q.x, ny = q.y;
    if (st.phase === "mixing") { nx = q.sx + (q.mx - q.sx) * e; ny = q.sy + (q.my - q.sy) * e; }
    var px = bx + 6 + nx * (bw - 12), py = by + 8 + ny * (bh - 16);
    var isW = (q.kind === "W");
    var rr = isW ? r * 0.56 : r;
    var col = ionColor(q.kind);
    /* 짝지어 다가가는 동안 조금씩 작아진다 — 「물이 되어 사라진다」의 예고 */
    if (st.phase === "mixing" && q.pair >= 0) rr = r * (1 - 0.30 * e);

    ctx.beginPath();
    if (ION[q.kind].cat === "음") {
      var s = rr * 1.75;
      if (ctx.roundRect) ctx.roundRect(px - s / 2, py - s / 2, s, s, rr * 0.5);
      else ctx.rect(px - s / 2, py - s / 2, s, s);
    } else ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.globalAlpha = isW ? 0.9 : 0.92; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = ION[q.kind].key ? 1.8 : 1;
    ctx.strokeStyle = darker(col, ION[q.kind].key ? 0.55 : 0.7); ctx.stroke();

    if (!isW && rr > 8) {
      ctx.fillStyle = "#fff"; ctx.font = "600 " + (rr * 0.78).toFixed(1) + "px " + FONT;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ION[q.kind].sym, px, py + 0.5);
      ctx.textBaseline = "alphabetic";
    }
  }
  ctx.restore();
}

/* ---------- 무대 ---------- */
function draw() {
  var w = fit(cv, ctx, stageH());
  if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);
  var split = st.zoom ? Math.round(h * 0.44) : h;
  drawBeaker(w, 0, split);
  drawThermo(w, 0, split);
  if (st.zoom) {
    ctx.beginPath(); ctx.moveTo(8, split - 3); ctx.lineTo(w - 8, split - 3);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    drawIonBox(w, split + 4, h - 2);
  }
}
function stageH() {
  var w = cv.parentNode.clientWidth || 600;
  var base = Math.round(Math.max(210, Math.min(280, w * 0.42)));
  return st.zoom ? base + Math.round(Math.max(200, Math.min(270, w * 0.40))) : base;
}

/* ---------- 그래프 ---------- */
function drawGraph() {
  var w = fit(gcv, gctx, 272);
  if (!w) return;
  var h = 272, L = 46, R = 14, T = 16, B = 64;
  gctx.clearRect(0, 0, w, h);
  var x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  var tmin = 19, tmax = 28;
  var X = function (va) { return x0 + (x1 - x0) * ((va - 1) / 10); };
  var Y = function (t) { return y1 - (y1 - y0) * ((t - tmin) / (tmax - tmin)); };

  gctx.strokeStyle = "rgba(40,45,52,0.055)"; gctx.lineWidth = 1;
  for (var t = tmin + 1; t < tmax; t++) {
    gctx.beginPath(); gctx.moveTo(x0, Y(t)); gctx.lineTo(x1, Y(t)); gctx.stroke();
  }
  gctx.strokeStyle = "rgba(40,45,52,0.35)"; gctx.lineWidth = 1.2;
  gctx.beginPath(); gctx.moveTo(x0, y0); gctx.lineTo(x0, y1); gctx.lineTo(x1, y1); gctx.stroke();

  gctx.fillStyle = C.t3; gctx.font = "10.5px " + FONT;
  gctx.textAlign = "right";
  for (var v = 20; v <= 28; v += 2) gctx.fillText(v + "", x0 - 6, Y(v) + 3.5);
  gctx.textAlign = "center";
  for (var i = 0; i < NEU_PRESET.length; i++) {
    var pr = NEU_PRESET[i];
    gctx.fillText(pr.va + "", X(pr.va), y1 + 15);
    gctx.fillStyle = C.t3; gctx.fillText(pr.k, X(pr.va), y1 + 28); gctx.fillStyle = C.t3;
  }
  gctx.fillStyle = C.t2; gctx.font = "11.5px " + FONT;
  gctx.fillText("묽은 염산의 부피 (mL) — 총 부피는 12 mL 로 같다", (x0 + x1) / 2, h - 5);
  gctx.save(); gctx.translate(13, (y0 + y1) / 2); gctx.rotate(-Math.PI / 2);
  gctx.fillText("최고 온도 (℃)", 0, 0); gctx.restore();

  /* 기록한 점만 그린다 (매뉴얼 §13 ③ — 기록 전에는 화면 어디에도 값이 없다) */
  var recs = st.records.slice().sort(function (a, b) { return a.va - b.va; });
  if (recs.length >= 2) {
    gctx.beginPath();
    for (var j = 0; j < recs.length; j++) {
      var px = X(recs[j].va), py = Y(recs[j].T);
      if (j === 0) gctx.moveTo(px, py); else gctx.lineTo(px, py);
    }
    gctx.strokeStyle = C.gray; gctx.lineWidth = 1.6; gctx.setLineDash([5, 4]);
    gctx.stroke(); gctx.setLineDash([]);
  }
  for (var k = 0; k < recs.length; k++) {
    var rc = recs[k], cx = X(rc.va), cy = Y(rc.T);
    gctx.beginPath(); gctx.arc(cx, cy, 6, 0, Math.PI * 2);
    gctx.fillStyle = neuBTB(rc.nature); gctx.fill();
    gctx.strokeStyle = "rgba(40,45,52,0.55)"; gctx.lineWidth = 1.4; gctx.stroke();
    gctx.fillStyle = C.t1; gctx.font = "600 10.5px " + FONT; gctx.textAlign = "center";
    gctx.fillText(rc.T.toFixed(1), cx, cy - 11);
    gctx.fillStyle = C.t2; gctx.font = "10.5px " + FONT;
    gctx.fillText(neuNatureLabel(rc.nature), cx, y1 + 44);
  }
  if (!recs.length) {
    gctx.fillStyle = C.t3; gctx.font = "12.5px " + FONT; gctx.textAlign = "center";
    gctx.fillText("아직 기록한 조합이 없습니다 — A~E 를 하나씩 해 보고 「이 조합 기록」을 누르세요",
                  (x0 + x1) / 2, (y0 + y1) / 2);
  }
}

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }

function sync() {
  var before = neuIonsBefore(st.va, st.vb);
  var after  = neuIonsAfter(st.va, st.vb);
  var shown  = (st.phase === "after") ? after : before;
  var mixed  = (st.phase === "after");

  setTxt("sVa", st.va + " mL"); setTxt("sVb", st.vb + " mL");
  setTxt("cH",  shown.H  + ""); setTxt("cOH", shown.OH + "");
  setTxt("cNa", shown.Na + ""); setTxt("cCl", shown.Cl + "");
  setTxt("cW",  (mixed ? after.W : 0) + "");
  setTxt("cntWhen", mixed ? "섞은 뒤" : "섞기 전");

  var T = mixed ? neuMaxTemp(st.va, st.vb) : NEU.T0;
  setTxt("vT", T.toFixed(1));
  setTxt("vRise", mixed ? ("+" + neuDeltaT(st.va, st.vb).toFixed(1)) : "—");

  var nat = neuNature(st.va, st.vb);
  setTxt("vNat", st.btb ? neuNatureLabel(nat) : "—");
  var natEl = $("natBox");
  natEl.className = "readout" + (st.btb ? (nat === "neutral" ? " is-ok" : " is-warn") : "");

  $("mixBtn").disabled  = (st.phase !== "before");
  $("btbBtn").disabled  = (st.phase !== "after") || st.btb;
  $("va").disabled = $("vb").disabled = (st.phase !== "before");
  var pv = document.querySelectorAll(".pv");
  for (var i = 0; i < pv.length; i++) pv[i].disabled = (st.phase !== "before");
  var gb = document.querySelectorAll(".gbtn");
  for (i = 0; i < gb.length; i++) {
    gb[i].disabled = (st.phase !== "after") || st.btb;
    gb[i].setAttribute("aria-pressed", st.guess === gb[i].dataset.g ? "true" : "false");
  }
  $("guessRow").style.display = (st.phase === "after" && !st.btb) ? "block" : "none";

  /* 예측 채점 */
  var gr = $("guessResult");
  if (st.btb && st.guess) {
    var ok = (st.guess === nat);
    gr.style.display = "block";
    gr.className = "note " + (ok ? "note--ok" : "note--warn");
    gr.innerHTML = ok
      ? "<b>예측이 맞았습니다.</b> 남은 이온이 " +
        (nat === "neutral" ? "하나도 없어서 <b>중성</b>입니다."
         : nat === "acid" ? ("H⁺ <b>" + after.H + "개</b>라서 <b>산성</b>입니다.")
         : ("OH⁻ <b>" + after.OH + "개</b>라서 <b>염기성</b>입니다."))
      : "<b>예측은 «" + neuNatureLabel(st.guess) + "»이었는데 결과는 «" +
        neuNatureLabel(nat) + "»입니다.</b> 남은 이온을 다시 세어 보세요 — " +
        (nat === "neutral" ? "H⁺ 도 OH⁻ 도 남지 않았습니다."
         : nat === "acid" ? ("H⁺ 가 " + after.H + "개 남았습니다.")
         : ("OH⁻ 가 " + after.OH + "개 남았습니다."));
  } else gr.style.display = "none";

  /* 기록 버튼 — 막다른 선택은 화면이 먼저 알린다 (§2 ④) */
  var canPlot = neuPlottable(st.va, st.vb);
  var already = st.records.some(function (r) { return r.va === st.va && r.vb === st.vb; });
  $("recBtn").disabled = !(st.phase === "after" && st.btb && canPlot && !already);
  setTxt("recHint",
    !canPlot ? "그래프에는 총 부피가 12 mL 인 조합만 올릴 수 있습니다 (홈판 절차와 같게)."
    : already ? "이 조합은 이미 기록했습니다."
    : (st.phase !== "after") ? "먼저 「섞기」를 누르세요."
    : !st.btb ? "BTB 를 넣어 색을 확인한 뒤에 기록할 수 있습니다."
    : "이 조합을 그래프에 올릴 수 있습니다.");

  setTxt("stageCap",
    st.phase === "before"
      ? "아직 섞지 않았습니다. 왼쪽 반이 묽은 염산, 오른쪽 반이 수산화 나트륨 수용액입니다."
      : st.phase === "mixing" ? "섞는 중입니다 — H⁺ 와 OH⁻ 가 만나 물이 됩니다."
      : (st.btb ? "BTB 를 넣었습니다. 아래 상자에 «남아 있는» 이온을 세어 색과 맞춰 보세요."
                : "다 섞였습니다. 아래 상자에 무엇이 몇 개 남았는지 세어 보세요."));

  setTxt("recCount", st.records.length + "");
  drawGraph();
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;

  if (st.phase === "mixing") {
    st.p += dt / 1.4;
    if (st.p >= 1) { st.p = 1; finishMix(); sync(); }
  } else if (st.phase === "after" && !RM) {
    for (var i = 0; i < st.parts.length; i++) {
      var q = st.parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < 0.05) { q.x = 0.05; q.vx = Math.abs(q.vx); }
      if (q.x > 0.95) { q.x = 0.95; q.vx = -Math.abs(q.vx); }
      if (q.y < 0.09) { q.y = 0.09; q.vy = Math.abs(q.vy); }
      if (q.y > 0.91) { q.y = 0.91; q.vy = -Math.abs(q.vy); }
    }
  }
  draw();
}

/* ---------- 배선 ---------- */
$("va").addEventListener("input", function () {
  st.va = parseInt(this.value, 10); buildParts(); sync();
});
$("vb").addEventListener("input", function () {
  st.vb = parseInt(this.value, 10); buildParts(); sync();
});
var pvs = document.querySelectorAll(".pv");
for (var pi = 0; pi < pvs.length; pi++) pvs[pi].addEventListener("click", function () {
  st.va = parseInt(this.dataset.va, 10); st.vb = parseInt(this.dataset.vb, 10);
  $("va").value = st.va; $("vb").value = st.vb;
  buildParts(); sync();
});
$("mixBtn").addEventListener("click", startMix);
$("btbBtn").addEventListener("click", function () { st.btb = true; sync(); });
$("resetBtn").addEventListener("click", function () { reset(true); });
$("zoomBtn").addEventListener("click", function () {
  st.zoom = !st.zoom;
  this.setAttribute("aria-pressed", st.zoom ? "true" : "false");
  this.textContent = st.zoom ? "입자 화면 접기" : "입자로 보기";
  draw();
});
var gbs = document.querySelectorAll(".gbtn");
for (var gi = 0; gi < gbs.length; gi++) gbs[gi].addEventListener("click", function () {
  st.guess = this.dataset.g; sync();
});
$("recBtn").addEventListener("click", function () {
  st.records.push({ va: st.va, vb: st.vb, T: neuMaxTemp(st.va, st.vb),
                    nature: neuNature(st.va, st.vb) });
  sync();
});
$("clrBtn").addEventListener("click", function () { st.records = []; sync(); });

window.addEventListener("resize", function () { draw(); drawGraph(); });
if (window.ResizeObserver) {
  new ResizeObserver(function () { draw(); drawGraph(); }).observe(cv.parentNode);
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
});

if (RM) $("rmNote").style.display = "block";
reset(false);
rafId = requestAnimationFrame(loop);

/* 검증 프로브가 읽는 창구 */
window.NEUVIEW = { st: st, sync: sync, draw: draw, startMix: startMix, reset: reset };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    NEU: NEU, NEU_PRESET: NEU_PRESET,
    neuIonsBefore: neuIonsBefore, neuIonsAfter: neuIonsAfter,
    neuMolReacted: neuMolReacted, neuHeatJ: neuHeatJ, neuDeltaT: neuDeltaT,
    neuMaxTemp: neuMaxTemp, neuNature: neuNature, neuNatureLabel: neuNatureLabel,
    neuBTB: neuBTB, neuCharge: neuCharge, neuPlottable: neuPlottable
  };
