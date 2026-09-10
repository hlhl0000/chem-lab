/* ============================================================
   중화점 대결 게임 — neutralgame/sim.js
   통합과학2 Ⅰ-2 · 7차시 도입 또는 11차시 마무리 · 반박 대상 M5 · M14

   ★ 이 게임의 승패는 「중화점에 얼마나 가까이 멈췄는가」가 «아니다».
     지도서 116쪽 유의점 3 — 「양적 관계를 정량적으로 해석하지 않게 유의한다」
     6차시 경계 문장 — 「몇 mL 를 넣어야 정확히 중화되는가는 『화학』에서」
     → 부피·농도·적하량을 «한 번도» 숫자로 보이지 않는다.
       점수는 멈춘 뒤 «액성»을 맞혔는가로만 매긴다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/neutralgame_core.js 와 문자 단위로 같다. */

var NG = {
  C:     1.0,    /* mol/L   두 용액의 농도는 같지만 «값은 학생에게 알리지 않는다» */
  T0:    20.0,   /* ℃ */
  DH:    57.3,   /* kJ/mol  강산+강염기 중화열 */
  CP:    4.18,   /* J/(g·K) */
  LAG:   1.2,    /* 초      온도계의 1차 지연 — 지도서 117쪽 「정성적 분석에 적합」 */
  PINK:  0.8,    /* 단위    이만큼 «넘게» OH⁻ 가 남아야 페놀프탈레인이 분홍이 된다.
                            ⚠ 실제로는 훨씬 적은 양에서 변한다 — 보이게 하려고 과장했다 */
  TOL:   0.5,    /* 단위    이 안이면 「중성」으로 본다 (남은 이온이 0개로 보이는 범위) */
  VA_MIN: 16, VA_MAX: 28,   /* 단위  라운드마다 뽑는 미지 산의 양 */
  TURN:  12      /* 다이얼 한 바퀴가 넣는 양 (단위). 화면에 숫자로 나오지 않는다 */
};

/* 결정적 난수 — 같은 seed 면 언제나 같은 라운드가 나온다 (검산 재현성) */
function ngRand(seed) {
  var s = (seed >>> 0) || 1;
  function nx() {                       /* xorshift32 — 선형합동식은 연속값이 뭉쳐 나온다 */
    s ^= (s << 13); s >>>= 0;
    s ^= (s >>> 17);
    s ^= (s << 5);  s >>>= 0;
    return s / 4294967296;
  }
  for (var i = 0; i < 8; i++) nx();     /* 예열 */
  return nx;
}
function ngMakeRound(seed, players) {
  var r = ngRand(seed), out = [];
  for (var i = 0; i < players; i++)
    out.push({ va: NG.VA_MIN + Math.round(r() * (NG.VA_MAX - NG.VA_MIN)) });
  return out;
}

/* 넣은 양에 따른 «참» 이온 상태 (연속값) */
function ngIonsAfter(va, vb) {
  var pair = Math.min(va, vb);
  return { H: va - pair, OH: vb - pair, Na: vb, Cl: va, W: pair };
}

/* 액성 — 판정의 단일 원천 */
function ngNature(va, vb) {
  var d = vb - va;
  if (Math.abs(d) <= NG.TOL) return "neutral";
  return d < 0 ? "acid" : "base";
}
function ngNatureLabel(n) {
  return n === "acid" ? "산성" : n === "base" ? "염기성" : "중성";
}

/* 화면에 «세어 보라고» 그리는 개수 — 액성 판정과 어긋나지 않게 여기서 유도한다.
   (J-N5 — 「산성」이라고 써 놓고 남은 H⁺ 가 0개면 화면이 자기모순이다) */
function ngIonsShown(va, vb) {
  var n = ngNature(va, vb), d = vb - va;
  return {
    H:  n === "acid" ? Math.max(1, Math.round(-d)) : 0,
    OH: n === "base" ? Math.max(1, Math.round(d))  : 0,
    Na: Math.round(vb), Cl: Math.round(va),
    W:  Math.round(Math.min(va, vb))
  };
}

/* 온도 — 중화점에서 최고가 된다. 열손실은 지연으로만 대신한다 */
function ngTrueTemp(va, vb) {
  var m = va + vb;
  if (m <= 0) return NG.T0;
  return NG.T0 + NG.DH * 1000 * (Math.min(va, vb) * NG.C / 1000) / (m * NG.CP);
}
/* ★ 온도계는 «따라온다». 지연이 있어 최고점은 지나가 봐야 안다 */
function ngShownTemp(prev, target, dt) {
  return prev + (target - prev) * (1 - Math.exp(-dt / NG.LAG));
}

/* 페놀프탈레인 — pH 를 쓰지 않는다. 「OH⁻ 가 조금 남으면 분홍」으로만 정의한다 */
function ngPhphPink(va, vb) { return (vb - va) > NG.PINK; }
function ngPhph(va, vb) { return ngPhphPink(va, vb) ? "pink" : "clear"; }

/* ★ 중화점과 종말점 — 종말점은 «중화점을 지난 뒤»에 있다 (M5) */
function ngEquivDrops(va)    { return va; }
function ngEndpointDrops(va) { return va + NG.PINK; }

/* 점수 — 액성을 맞혔는가로만 매긴다. 「중성」은 실제로 도달했을 때만 2점 */
function ngScore(nature, guess) {
  if (guess !== nature) return 0;
  return nature === "neutral" ? 2 : 1;
}

/* ================= UI + 렌더 ================= */

if (typeof document !== "undefined") (function () {

var $ = function (id) { return document.getElementById(id); };
var CSSV = function (n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
};
var C = {
  t1: CSSV("--t1"), t2: CSSV("--t2"), t3: CSSV("--t3"), line: CSSV("--line"),
  amber: CSSV("--d-amber"), blue: CSSV("--d-blue"), gray: CSSV("--d-gray"),
  red: CSSV("--d-red"), green: CSSV("--d-green"), violet: CSSV("--d-violet"),
  glass: "rgba(160,200,228,0.75)"
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
var PHPH = "#e8579a";   /* 페놀프탈레인의 «실물» 분홍 (매뉴얼 P6 예외 2) */

var st = {
  phase: "setup",   /* setup → (연습) → turn → guess → pass → reveal → final */
  prac: false,      /* 연습 라운드인가 — 점수를 매기지 않는다 */
  players: 3,
  seed: 20260907,
  round: [],        /* [{va, vb, guess, nature, score}] */
  cur: 0,
  revealIdx: 0,
  vb: 0,
  shownT: NG.T0,
  dialAngle: 0,
  dragging: false,
  lastAng: 0
};

var cv = $("stageCv"), ctx = cv.getContext("2d");
var rafId = null, lastT = 0;

function me() { return st.round[st.cur]; }
function revealing() { return st.round[st.revealIdx]; }

/* ---------- 캔버스 ---------- */
function fit(hCss) {
  var w = cv.parentNode.clientWidth;
  if (w < 40) return 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(hCss * dpr);
  cv.style.height = hCss + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}
function stageH() {
  var w = cv.parentNode.clientWidth || 600;
  return Math.round(Math.max(340, Math.min(420, w * 0.66)));
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function dialGeom(w, h) {
  return { cx: w * 0.74, cy: h * 0.42, r: Math.min(62, w * 0.13) };
}

/* ---------- 장치 ---------- */
function drawRig(w, h, va, vb, pink, showDial) {
  var bx = w * 0.17;
  /* 뷰렛 */
  var buY = 12, buH = h * 0.44, buW = 16;
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2;
  ctx.strokeRect(bx - buW / 2, buY, buW, buH);
  var used = Math.max(0, Math.min(1, vb / (NG.VA_MAX + 14)));
  ctx.fillStyle = "rgba(190,215,235,0.85)";
  ctx.fillRect(bx - buW / 2 + 2, buY + 2 + (buH - 4) * used, buW - 4, (buH - 4) * (1 - used));
  /* 눈금은 «없다» — 부피를 읽을 수 없게 하는 것이 설계다 */
  ctx.beginPath();
  ctx.moveTo(bx - 4, buY + buH); ctx.lineTo(bx, buY + buH + 16); ctx.lineTo(bx + 4, buY + buH);
  ctx.closePath(); ctx.fillStyle = "#9fb0c0"; ctx.fill();
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("뷰렛 (눈금 없음)", bx, buY - 2);

  /* 삼각 플라스크 */
  var fy = buY + buH + 30, fh = h - fy - 44, fw = Math.min(120, w * 0.24);
  ctx.beginPath();
  ctx.moveTo(bx - 9, fy); ctx.lineTo(bx - 9, fy + 14);
  ctx.lineTo(bx - fw / 2, fy + fh); ctx.lineTo(bx + fw / 2, fy + fh);
  ctx.lineTo(bx + 9, fy + 14); ctx.lineTo(bx + 9, fy);
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2.2; ctx.stroke();
  /* 용액 */
  var lv = fy + fh - Math.max(16, fh * 0.55 * (1 + vb / (NG.VA_MAX + 14)) * 0.6);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(bx - 8, fy + 14); ctx.lineTo(bx - fw / 2 + 2, fy + fh - 2);
  ctx.lineTo(bx + fw / 2 - 2, fy + fh - 2); ctx.lineTo(bx + 8, fy + 14);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = pink ? PHPH : "rgba(228,240,250,0.95)";
  ctx.globalAlpha = pink ? 0.72 : 1;
  ctx.fillRect(bx - fw, lv, fw * 2, fh);
  ctx.globalAlpha = 1; ctx.restore();
  ctx.beginPath(); ctx.moveTo(bx - fw / 2 + 6, lv); ctx.lineTo(bx + fw / 2 - 6, lv);
  ctx.strokeStyle = "rgba(40,45,52,0.22)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = pink ? C.t1 : C.t3; ctx.font = "600 12px " + FONT; ctx.textAlign = "center";
  ctx.fillText(pink ? "분홍색" : "무색", bx, fy + fh + 20);

  /* 온도계 */
  var tx = w * 0.355, ty = 24, th = h * 0.56;
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx - 7, ty + th);
  ctx.moveTo(tx + 7, ty); ctx.lineTo(tx + 7, ty + th); ctx.arc(tx, ty, 7, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty + th + 10, 11, 0, Math.PI * 2); ctx.stroke();
  var f = Math.max(0, Math.min(1, (st.shownT - 18) / 12));
  ctx.beginPath(); ctx.arc(tx, ty + th + 10, 8.6, 0, Math.PI * 2);
  ctx.fillStyle = C.red; ctx.fill();
  ctx.fillRect(tx - 4.6, ty + th - (th - 8) * f, 9.2, (th - 8) * f);
  for (var v = 18; v <= 30; v += 2) {
    var yy = ty + th - (th - 8) * ((v - 18) / 12);
    ctx.beginPath(); ctx.moveTo(tx + 7, yy); ctx.lineTo(tx + 13, yy);
    ctx.strokeStyle = "rgba(40,45,52,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    if (v % 4 === 2) {
      ctx.fillStyle = C.t3; ctx.font = "10px " + FONT; ctx.textAlign = "left";
      ctx.fillText(v + "", tx + 16, yy + 3.5);
    }
  }
  ctx.fillStyle = C.t1; ctx.font = "600 14px " + FONT; ctx.textAlign = "center";
  ctx.fillText(st.shownT.toFixed(1) + " ℃", tx + 4, ty + th + 36);

  /* 다이얼 */
  if (showDial) {
    var d = dialGeom(w, h);
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fillStyle = "#eef2f7"; ctx.fill();
    ctx.strokeStyle = "#9fb0c0"; ctx.lineWidth = 3; ctx.stroke();
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(d.cx + Math.cos(a) * (d.r - 4), d.cy + Math.sin(a) * (d.r - 4));
      ctx.lineTo(d.cx + Math.cos(a) * (d.r - 11), d.cy + Math.sin(a) * (d.r - 11));
      ctx.strokeStyle = "rgba(40,45,52,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.save(); ctx.translate(d.cx, d.cy); ctx.rotate(st.dialAngle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -(d.r - 10));
    ctx.strokeStyle = C.violet; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -(d.r - 10), 6, 0, Math.PI * 2);
    ctx.fillStyle = C.violet; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(d.cx, d.cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#8a93a0"; ctx.fill();
    ctx.fillStyle = C.t2; ctx.font = "600 11.5px " + FONT; ctx.textAlign = "center";
    ctx.fillText("시계 방향으로 돌리세요", d.cx, d.cy + d.r + 18);
    ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT;
    ctx.fillText("(되돌릴 수 없습니다)", d.cx, d.cy + d.r + 32);
  }
}

/* ---------- 입자 모형 (결과 공개) ---------- */
var PION = {
  H:  { sym: "H⁺",  cat: "양", col: "amber", key: true },
  OH: { sym: "OH⁻", cat: "음", col: "blue",  key: true },
  Na: { sym: "Na⁺", cat: "양", col: "gray",  key: false },
  Cl: { sym: "Cl⁻", cat: "음", col: "gray",  key: false },
  W:  { sym: "",    cat: "물", col: "pale",  key: false }
};
function pcol(k) {
  return k === "H" ? C.amber : k === "OH" ? C.blue : k === "W" ? "#c8d4e0" : C.gray;
}
function shade(hex, f) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "rgba(0,0,0,.5)";
  var n = parseInt(m[1], 16);
  return "rgb(" + Math.round(((n >> 16) & 255) * f) + "," +
                  Math.round(((n >> 8) & 255) * f) + "," +
                  Math.round((n & 255) * f) + ")";
}
function drawParticles(w, h, io) {
  var bx = w * 0.47, by = 40, bw = w - bx - 14, bh = h - by - 30;
  rr(bx, by, bw, bh, 10);
  ctx.fillStyle = "#fbfdff"; ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT; ctx.textAlign = "left";
  ctx.fillText("멈춘 자리의 용액 속", bx + 10, by + 15);

  var list = [];
  function push(k, n) { for (var i = 0; i < n; i++) list.push(k); }
  /* ★ 세어야 할 것을 먼저 그린다 — 구경꾼 사이에 묻히면 이 화면의 요점이 사라진다 */
  push("H", io.H); push("OH", io.OH);
  push("W", Math.min(io.W, 18)); push("Na", Math.min(io.Na, 14));
  push("Cl", Math.min(io.Cl, 14));

  var cols = Math.max(5, Math.floor((bw - 20) / 30));
  var r = Math.max(9, Math.min(14, (bw - 20) / cols / 2.3));
  for (var i = 0; i < list.length; i++) {
    var k = list[i];
    var cxp = bx + 16 + (i % cols) * ((bw - 26) / cols);
    var cyp = by + 34 + Math.floor(i / cols) * (r * 2.5);
    if (cyp > by + bh - r) break;
    var col = pcol(k), isW = (k === "W");
    ctx.beginPath();
    if (PION[k].cat === "음") {
      var s = r * 1.75;
      if (ctx.roundRect) ctx.roundRect(cxp - s / 2, cyp - s / 2, s, s, r * 0.5);
      else ctx.rect(cxp - s / 2, cyp - s / 2, s, s);
    } else ctx.arc(cxp, cyp, isW ? r * 0.56 : r, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = PION[k].key ? 2.2 : 1;
    ctx.strokeStyle = shade(col, PION[k].key ? 0.5 : 0.72); ctx.stroke();
    if (!isW && r > 8) {
      ctx.fillStyle = "#fff"; ctx.font = "600 " + (r * 0.72).toFixed(1) + "px " + FONT;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(PION[k].sym, cxp, cyp + 0.5); ctx.textBaseline = "alphabetic";
    }
  }
  ctx.fillStyle = C.t2; ctx.font = "11.5px " + FONT; ctx.textAlign = "left";
  ctx.fillText("남은 H⁺ " + io.H + "개 · 남은 OH⁻ " + io.OH + "개",
               bx + 10, by + bh - 8);
}

/* ---------- 무대 ---------- */
function draw() {
  var w = fit(stageH()); if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);

  if (st.phase === "setup") {
    /* 시작 전에도 «무엇을 만질 화면인지»가 보이게 장치를 흐리게 깔아 둔다.
       조작만 잠겨 있고 그림은 있다 (매뉴얼 §2-④ — 빈 화면으로 시작하지 않는다) */
    ctx.save(); ctx.globalAlpha = 0.30;
    drawRig(w, h, 20, 5, false, true);
    ctx.restore();
    var by = h * 0.5, bxw = Math.min(w * 0.88, 470);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    rr((w - bxw) / 2, by - 34, bxw, 62, 10); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = C.t1; ctx.font = "700 15px " + FONT; ctx.textAlign = "center";
    ctx.fillText("조금 넣고 멈춘 뒤, 액성을 맞히세요", w / 2, by - 10);
    ctx.fillStyle = C.t2; ctx.font = "12.5px " + FONT;
    ctx.fillText("쓸 수 있는 정보는 온도계와 지시약의 색뿐입니다", w / 2, by + 10);
    ctx.fillStyle = C.t3; ctx.font = "11.5px " + FONT;
    ctx.fillText("사람마다 «다른» 미지의 산이 들어 있는 플라스크를 받습니다", w / 2, by + 26);
    return;
  }
  if (st.phase === "pass") {
    ctx.fillStyle = C.t1; ctx.font = "600 17px " + FONT; ctx.textAlign = "center";
    ctx.fillText("다음 사람에게 넘기세요", w / 2, h / 2 - 6);
    ctx.fillStyle = C.t3; ctx.font = "12.5px " + FONT;
    ctx.fillText("앞 사람의 결과를 보면 안 됩니다", w / 2, h / 2 + 18);
    return;
  }
  if (st.phase === "reveal" || st.phase === "final") {
    var p = revealing();
    if (!p) return;
    var pink = ngPhphPink(p.va, p.vb);
    st.shownT = ngTrueTemp(p.va, p.vb);
    drawRig(w, h, p.va, p.vb, pink, false);
    drawParticles(w, h, ngIonsShown(p.va, p.vb));
    return;
  }
  /* turn · guess */
  var m = me();
  drawRig(w, h, m.va, st.vb, ngPhphPink(m.va, st.vb), st.phase === "turn");
}

/* ---------- 다이얼 ---------- */
function ptr(ev) {
  var r = cv.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}
function addDose(units) {
  if (st.phase !== "turn") return;
  st.vb += units;
  sync();
}
cv.addEventListener("pointerdown", function (ev) {
  if (st.phase !== "turn") return;
  var w = cv.clientWidth, h = stageH(), d = dialGeom(w, h), p = ptr(ev);
  if (Math.hypot(p.x - d.cx, p.y - d.cy) > d.r + 8) return;
  st.dragging = true;
  st.lastAng = Math.atan2(p.y - d.cy, p.x - d.cx);
  if (cv.setPointerCapture) { try { cv.setPointerCapture(ev.pointerId); } catch (e) {} }
  ev.preventDefault();
});
cv.addEventListener("pointermove", function (ev) {
  if (!st.dragging) return;
  var w = cv.clientWidth, h = stageH(), d = dialGeom(w, h), p = ptr(ev);
  var a = Math.atan2(p.y - d.cy, p.x - d.cx);
  var delta = a - st.lastAng;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  st.lastAng = a;
  if (delta > 0) {                       /* 시계 방향만 액을 넣는다 */
    st.dialAngle += delta;
    /* 방울 크기는 조금씩 다르다 — 회전을 세어 부피를 알아내지 못하게 (실제 뷰렛도 그렇다) */
    addDose(delta / (Math.PI * 2) * NG.TURN * (0.9 + Math.random() * 0.2));
  }
  ev.preventDefault();
});
function endDrag() { st.dragging = false; }
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
window.addEventListener("pointerup", endDrag);

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }
function show(sel, on) {
  var el = document.querySelectorAll(sel);
  for (var i = 0; i < el.length; i++) el[i].style.display = on ? "block" : "none";
}

/* 공개는 한 명씩이다 — upto 보다 뒤에 있는 사람의 실제 액성·점수는 아직 보이지 않는다 */
function scoreboardHTML(upto) {
  var out = "";
  for (var i = 0; i < st.round.length; i++) {
    var p = st.round[i];
    var known = (i <= upto) && p.nature;
    out += '<tr><th>' + (i + 1) + '번</th>' +
      '<td>' + (p.guess ? ngNatureLabel(p.guess) : "—") + '</td>' +
      '<td>' + (known ? ngNatureLabel(p.nature) : "—") + '</td>' +
      '<td>' + (known ? p.score : "—") + '</td></tr>';
  }
  return out;
}

function sync() {
  var ph = st.phase;
  show(".only-setup",  ph === "setup");
  show(".only-turn",   ph === "turn");
  show(".only-guess",  ph === "guess");
  show(".only-pass",   ph === "pass");
  show(".only-reveal", ph === "reveal" || ph === "final");
  show(".only-final",  ph === "final");

  setTxt("whoTxt", st.prac
    ? (ph === "reveal" ? "연습 결과 — 점수 없음" : "연습 &mdash; 점수가 걸리지 않습니다")
    : (ph === "reveal" || ph === "final") ? ((st.revealIdx + 1) + "번의 결과")
    : ((st.cur + 1) + "번 차례"));
  $("boardWrap").style.display = st.prac ? "none" : "block";
  $("nextBtn").textContent = st.prac ? "이제 본 게임 시작" : "다음 결과 보기";
  $("pracNote").style.display = st.prac ? "block" : "none";

  var gb = document.querySelectorAll(".gbtn");
  for (var i = 0; i < gb.length; i++) {
    var g = st.round[st.cur] ? st.round[st.cur].guess : null;
    gb[i].setAttribute("aria-pressed", g === gb[i].dataset.g ? "true" : "false");
  }
  $("okBtn").disabled = !(st.round[st.cur] && st.round[st.cur].guess);

  $("board").innerHTML = scoreboardHTML(
    ph === "final" ? st.round.length - 1 : ph === "reveal" ? st.revealIdx : -1);

  var rv = $("revealBox");
  if (ph === "reveal" || ph === "final") {
    var p = revealing();
    var okG = (p.guess === p.nature);
    rv.className = "note " + (okG ? "note--ok" : "note--warn");
    rv.innerHTML =
      "<b>" + (st.prac ? "연습" : (st.revealIdx + 1) + "번") +
      " — 멈춘 자리는 «" + ngNatureLabel(p.nature) + "»</b>" +
      (ngPhphPink(p.va, p.vb) ? " · 지시약은 <b>분홍색</b>" : " · 지시약은 <b>무색</b>") + "<br>" +
      "예측 «" + ngNatureLabel(p.guess) + "» → <b>" +
      (st.prac ? (okG ? "적중 (연습이라 점수 없음)" : "빗나감 (연습이라 감점 없음)")
               : (okG ? "적중 " + p.score + "점" : "빗나감 0점")) + "</b><br>" +
      (p.nature === "base" && ngPhphPink(p.va, p.vb)
        ? "<b>분홍이 보였다는 것은 이미 OH⁻ 가 남기 시작했다는 뜻입니다.</b> " +
          "색이 변한 순간은 중화점을 «지난» 뒤입니다."
        : p.nature === "base"
        ? "OH⁻ 가 남았는데도 <b>아직 무색</b>입니다 — 색이 변하기 «전»에 이미 염기성입니다."
        : p.nature === "acid"
        ? "아직 H⁺ 가 남아 있습니다. 무색은 «중성»이라는 뜻이 아닙니다."
        : "<b>남은 이온이 하나도 없습니다 — 완전한 중화입니다.</b> 아주 어려운 자리입니다.");
  }
  draw();
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;
  if (st.phase === "turn" || st.phase === "guess") {
    var m = me();
    if (m) {
      var target = ngTrueTemp(m.va, st.vb);
      st.shownT = RM ? target : ngShownTemp(st.shownT, target, dt);
    }
  }
  draw();
}

/* ---------- 진행 ---------- */
function newRound(seed, n) {
  return ngMakeRound(seed, n).map(function (r) {
    return { va: r.va, vb: 0, guess: null, nature: null, score: 0 };
  });
}
function startGame() {
  st.prac = false;
  st.round = newRound(st.seed, st.players);
  st.cur = 0; st.revealIdx = 0; st.vb = 0; st.shownT = NG.T0;
  st.dialAngle = 0; st.phase = "turn";
  sync();
}
/* 연습 — 다이얼이 되돌아가지 않는다는 것을 «점수가 걸리기 전에» 한 번 겪는다 */
function startPractice() {
  st.prac = true;
  st.round = newRound((st.seed ^ 0x5bf0) >>> 0, 1);
  st.cur = 0; st.revealIdx = 0; st.vb = 0; st.shownT = NG.T0;
  st.dialAngle = 0; st.phase = "turn";
  sync();
}
function stopHere() {
  if (st.phase !== "turn") return;
  me().vb = st.vb;
  st.phase = "guess"; sync();
}
function submitGuess() {
  var m = me();
  if (!m.guess) return;
  m.nature = ngNature(m.va, m.vb);
  m.score = st.prac ? 0 : ngScore(m.nature, m.guess);   /* 연습은 점수를 매기지 않는다 */
  if (!st.prac && st.cur < st.round.length - 1) { st.phase = "pass"; }
  else { st.revealIdx = 0; st.phase = "reveal"; }
  sync();
}
function nextPlayer() {
  st.cur++; st.vb = 0; st.shownT = NG.T0; st.dialAngle = 0;
  st.phase = "turn"; sync();
}
function nextReveal() {
  if (st.prac) { startGame(); return; }          /* 연습이 끝나면 본 게임으로 */
  if (st.revealIdx < st.round.length - 1) { st.revealIdx++; st.phase = "reveal"; }
  else st.phase = "final";
  sync();
}

/* ---------- 배선 ---------- */
var pbs = document.querySelectorAll(".plb");
for (var pi = 0; pi < pbs.length; pi++) pbs[pi].addEventListener("click", function () {
  st.players = parseInt(this.dataset.n, 10);
  var a = document.querySelectorAll(".plb");
  for (var j = 0; j < a.length; j++)
    a[j].setAttribute("aria-pressed", a[j].dataset.n === this.dataset.n ? "true" : "false");
});
$("startBtn").addEventListener("click", startGame);
$("pracBtn").addEventListener("click", startPractice);
$("stopBtn").addEventListener("click", stopHere);
$("dropS").addEventListener("click", function () { addDose(0.5 * (0.9 + Math.random() * 0.2)); });
$("dropL").addEventListener("click", function () { addDose(2.0 * (0.9 + Math.random() * 0.2)); });
var gbs = document.querySelectorAll(".gbtn");
for (var gi = 0; gi < gbs.length; gi++) gbs[gi].addEventListener("click", function () {
  if (st.phase !== "guess") return;
  me().guess = this.dataset.g; sync();
});
$("okBtn").addEventListener("click", submitGuess);
$("passBtn").addEventListener("click", nextPlayer);
$("nextBtn").addEventListener("click", nextReveal);
$("newBtn").addEventListener("click", function () {
  st.seed = (st.seed * 16807 + 7) >>> 0; st.prac = false; st.phase = "setup"; sync();
});

window.addEventListener("resize", draw);
if (window.ResizeObserver) new ResizeObserver(draw).observe(cv.parentNode);
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
});

if (RM) $("rmNote").style.display = "block";
sync();
rafId = requestAnimationFrame(loop);
window.NGVIEW = { st: st, sync: sync, startGame: startGame, startPractice: startPractice,
                  addDose: addDose,
                  stopHere: stopHere, submitGuess: submitGuess,
                  nextPlayer: nextPlayer, nextReveal: nextReveal };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    NG: NG, ngRand: ngRand, ngMakeRound: ngMakeRound, ngIonsAfter: ngIonsAfter,
    ngIonsShown: ngIonsShown, ngNature: ngNature, ngNatureLabel: ngNatureLabel,
    ngTrueTemp: ngTrueTemp, ngShownTemp: ngShownTemp, ngPhph: ngPhph,
    ngPhphPink: ngPhphPink, ngScore: ngScore,
    ngEndpointDrops: ngEndpointDrops, ngEquivDrops: ngEquivDrops
  };
