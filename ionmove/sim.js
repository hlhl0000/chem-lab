/* ============================================================
   이온의 이동과 전기 전도성 — ionmove/sim.js
   통합과학2 Ⅰ-2 · 4~5차시 · 반박 대상 M3 · M4 (+ 증류수 대조)

   ⚠ 지도서 113쪽 탐구 유의점 4 — 「전류의 세기는 이 교육과정 밖」
      → 전압 조절·전류 수치를 넣지 않는다. 전구는 «켜짐/꺼짐» 두 상태뿐이다.
   ⚠ 12~15 V 에서 실제로는 전극에서 전기 분해가 일어나지만 범위 밖이므로
      그리지 않는다 — 「가정과 한계」에 명시한다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/ionmove_core.js 와 문자 단위로 같다. */

/* 종이에 배어 있는 전해질 — 질산 칼륨 수용액 (지도서 114쪽) */
var ION_ELECTROLYTE = [{ k: "K", n: 6 }, { k: "NO3", n: 6 }];

var ION_KIND = {
  H:    { sym: "H⁺",   charge:  1, key: true,  cls: "ion" },
  OH:   { sym: "OH⁻",  charge: -1, key: true,  cls: "ion" },
  Na:   { sym: "Na⁺",  charge:  1, key: false, cls: "ion" },
  Cl:   { sym: "Cl⁻",  charge: -1, key: false, cls: "ion" },
  K:    { sym: "K⁺",   charge:  1, key: false, cls: "ion" },
  NO3:  { sym: "NO₃⁻", charge: -1, key: false, cls: "ion" },
  EtOH: { sym: "",     charge:  0, key: false, cls: "mol" },
  H2O:  { sym: "",     charge:  0, key: false, cls: "mol" }
};

/* 네 가지만 둔다 — 「전류의 세기」가 갈리는 약산·약염기를 넣으면 범위를 넘는다.
   src : 탐구 = 지도서 113쪽 탐구의 관찰 대상 6종에 들어 있음
         대조 = 지도서 113쪽 「좋은 수업을 위한 제안」 3의 증류수 대조
         밖   = 홈판 탐구표에 없는 물질 (M3 반박 스크립트의 손소독제) */
var ION_SOL = [
  { id: "water",   name: "증류수",               formula: "H₂O",    src: "대조",
    ions: [], mol: null,  lamp: 0, litmus: "none" },
  { id: "ethanol", name: "에탄올",               formula: "C₂H₅OH", src: "밖",
    ions: [], mol: "EtOH", lamp: 0, litmus: "none" },
  { id: "hcl",     name: "묽은 염산",            formula: "HCl",    src: "탐구",
    ions: [{ k: "H", n: 5 }, { k: "Cl", n: 5 }], mol: null, lamp: 1, litmus: "acid" },
  { id: "naoh",    name: "수산화 나트륨 수용액", formula: "NaOH",   src: "탐구",
    ions: [{ k: "Na", n: 5 }, { k: "OH", n: 5 }], mol: null, lamp: 1, litmus: "base" }
];

function ionSolute(id) {
  for (var i = 0; i < ION_SOL.length; i++) if (ION_SOL[i].id === id) return ION_SOL[i];
  return null;
}

/* 전기장에서 어느 극으로 가는가 — 전하의 부호가 정한다. 예외 없음 */
function ionMovesTo(k) {
  var c = ION_KIND[k].charge;
  return c > 0 ? "cathode" : c < 0 ? "anode" : "none";   /* 양이온 → (−)극 · 음이온 → (+)극 */
}

/* 탭 1 (전기 전도성) — 비커 속 입자. 전해질은 없고 물이 있다 */
function ionBeakerParticles(id) {
  var s = ionSolute(id), out = [{ k: "H2O", n: 8 }];
  if (s.ions.length) out = out.concat(s.ions);
  if (s.mol) out = out.concat([{ k: s.mol, n: 5 }]);
  return out;
}

/* 탭 2 (이온 이동) — 종이 위 입자. 전해질 K⁺·NO₃⁻ 는 «시약과 무관하게 늘 있다» */
function ionPaperParticles(id) {
  var s = ionSolute(id), out = ION_ELECTROLYTE.slice();
  if (s.ions.length) out = out.concat(s.ions);
  if (s.mol) out = out.concat([{ k: s.mol, n: 5 }]);
  return out;
}

/* ★ M4 의 판정기 — (−)극 쪽으로 가는 양이온을 «종류별로» 센다 */
function ionCationsToCathode(id) {
  var ps = ionPaperParticles(id), out = {};
  for (var i = 0; i < ps.length; i++)
    if (ionMovesTo(ps[i].k) === "cathode") out[ps[i].k] = (out[ps[i].k] || 0) + ps[i].n;
  return out;
}
function ionAnionsToAnode(id) {
  var ps = ionPaperParticles(id), out = {};
  for (var i = 0; i < ps.length; i++)
    if (ionMovesTo(ps[i].k) === "anode") out[ps[i].k] = (out[ps[i].k] || 0) + ps[i].n;
  return out;
}

/* 전구 — 0(꺼짐) 또는 1(켜짐) 두 값뿐이다. 세기 단계를 두지 않는다 */
function ionLampLevel(id) { return ionSolute(id).lamp; }

/* 리트머스 — "acid"(푸른 종이가 붉게) · "base"(붉은 종이가 푸르게) · "none"(변화 없음) */
function ionLitmus(id) { return ionSolute(id).litmus; }

/* ★ M3 의 판정기 — 「화학식에 OH 가 있는가」와 「염기인가」는 다른 질문이다 */
function ionHasOHinFormula(id) { return ionSolute(id).formula.indexOf("OH") >= 0; }
function ionIsAcid(id) {
  var s = ionSolute(id);
  for (var i = 0; i < s.ions.length; i++) if (s.ions[i].k === "H") return true;
  return false;
}
function ionIsBase(id) {
  var s = ionSolute(id);
  for (var i = 0; i < s.ions.length; i++) if (s.ions[i].k === "OH") return true;
  return false;
}

/* 전하 총합 — 어떤 조합에서도 0 이어야 한다 */
function ionTotalCharge(list) {
  var q = 0;
  for (var i = 0; i < list.length; i++) q += ION_KIND[list[i].k].charge * list[i].n;
  return q;
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
  cyan: CSSV("--d-cyan"), red: CSSV("--d-red"), green: CSSV("--d-green"),
  glass: "rgba(160,200,228,0.75)"
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/* 리트머스 종이의 «실물» 색 (매뉴얼 P6 예외 2 — 사이트 테마 색이 아니다) */
var PAPER = { blue: "#8fa9d8", red: "#dd9b9b", toRed: "#b3402f", toBlue: "#2f5da8" };

/* 단계×요소 가시성 — 단일 원천 (매뉴얼 §13 ①)
   micro(입자 상자)는 탭만으로 정해지지 않는다(◐) — showMicro() 하나가 판정한다 */
var SHOW = {
  cond: { condOnly: true, moveOnly: false, micro: null },
  move: { condOnly: false, moveOnly: true, micro: false }
};
function showMicro() { return SHOW[st.tab].micro !== false && st.zoom; }

var st = {
  tab: "cond",
  sol: "hcl",
  power: false,
  zoom: false,        /* 「입자로 보기」— 접힌 상태가 기본값 (사용자 지시 2026-09-13) */
  onlyColor: false,   /* 「색을 바꾸는 이온만 보기」 */
  lastR: 0,           /* 마지막으로 그린 입자 반지름 — 프로브가 판독성을 잰다 */
  p: 0,               /* 탭2 번짐 진행 0..1 */
  parts: []
};

var cv = $("stageCv"), ctx = cv.getContext("2d");       /* 장치 그림 (두 탭 공통) */
var mcv = $("microCv"), mctx = mcv.getContext("2d");    /* 탭 ① 입자 상자 — 단추줄 아래 별도 무대 */
var rafId = null, lastT = 0;

function rnd(a, b) { return a + Math.random() * (b - a); }
function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 2); }
function darker(hex, f) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "rgba(0,0,0,.5)";
  var n = parseInt(m[1], 16);
  return "rgb(" + Math.round(((n >> 16) & 255) * f) + "," +
                  Math.round(((n >> 8) & 255) * f) + "," +
                  Math.round((n & 255) * f) + ")";
}
function kindColor(k) {
  if (k === "H")    return C.amber;
  if (k === "OH")   return C.blue;
  if (k === "EtOH") return "#9fc6d8";
  if (k === "H2O")  return "#d7e2ec";
  return C.gray;
}

/* ---------- 입자 배치 ---------- */
function buildParts() {
  var spec = (st.tab === "cond") ? ionBeakerParticles(st.sol) : ionPaperParticles(st.sol);
  var arr = [];
  for (var i = 0; i < spec.length; i++) for (var j = 0; j < spec[i].n; j++) {
    var fromThread = (st.tab === "move") && (spec[i].k !== "K") && (spec[i].k !== "NO3");
    arr.push({
      k: spec[i].k,
      x: fromThread ? rnd(0.455, 0.545) : rnd(0.08, 0.92),   /* 시약은 «실» 자리에서 시작 */
      y: rnd(0.14, 0.86),
      x0: 0, y0: 0, stop: 0.2, lane: 0.5,   /* 전극 앞 자리 — buildParts 끝에서 격자로 배정 */
      vx: RM ? 0 : rnd(-0.03, 0.03), vy: RM ? 0 : rnd(-0.05, 0.05)
    });
  }
  for (var q = 0; q < arr.length; q++) { arr[q].x0 = arr[q].x; arr[q].y0 = arr[q].y; }
  /* ★ 전극 앞에 «줄과 열»을 미리 배정한다. 반지름을 키우면 겹쳐 쌓여
     「어느 이온이 어디로 갔는가」를 못 읽는다(P-검토 처방의 부작용을 여기서 막는다) */
  var dest = { cathode: [], anode: [] };
  for (var d = 0; d < arr.length; d++) {
    var to = ionMovesTo(arr[d].k);
    if (dest[to]) dest[to].push(arr[d]);
  }
  ["cathode", "anode"].forEach(function (key) {
    var g = dest[key], n = g.length, cols = 3, rows = Math.ceil(n / cols);
    for (var j = 0; j < n; j++) {
      var col = j % cols, row = Math.floor(j / cols);
      g[j].stop = 0.06 + 0.115 * col;                       /* 전극에서 떨어진 정도 */
      g[j].lane = 0.09 + 0.82 * ((row + 0.5) / rows);       /* 세로 줄 */
    }
  });
  st.parts = arr;
}

/* ---------- 캔버스 ---------- */
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
function stageH() {
  var w = cv.parentNode.clientWidth || 600;
  if (st.tab === "cond") return Math.round(Math.max(200, Math.min(250, w * 0.38)));
  return Math.round(Math.max(304, Math.min(344, w * 0.52)));
}
/* 탭 ① 입자 상자의 높이 — 장치 그림과 같은 폭 기준 */
function microH() {
  var w = cv.parentNode.clientWidth || 600;
  return Math.round(Math.max(180, Math.min(240, w * 0.36)));
}

/* ---------- 입자 그리기 (공통) ---------- */
/* 입자 반지름은 «폭»이 아니라 «넓이 ÷ 개수»에서 낸다.
   폭으로 나누면 360 px 에서 글자가 6 px 로 떨어져 원 안 기호를 못 읽는다(Codex 실측). */
function partRadius(w, h, n) {
  return Math.max(11, Math.min(14, 0.34 * Math.sqrt(w * h / Math.max(1, n))));
}
/* 첫 인수 ctx 는 그릴 캔버스다 — 탭 ②는 장치 무대(ctx), 탭 ①은 입자 상자(mctx)에 그린다 */
function drawParticle(ctx, px, py, r, k) {
  var kd = ION_KIND[k], col = kindColor(k);
  ctx.beginPath();
  if (kd.cls === "mol" && k === "EtOH") {
    var ww = r * 2.6, hh = r * 1.35;
    if (ctx.roundRect) ctx.roundRect(px - ww / 2, py - hh / 2, ww, hh, hh / 2);
    else ctx.rect(px - ww / 2, py - hh / 2, ww, hh);
  } else if (kd.cls === "mol") {
    ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
  } else if (kd.charge < 0) {
    var s = r * 1.75;
    if (ctx.roundRect) ctx.roundRect(px - s / 2, py - s / 2, s, s, r * 0.5);
    else ctx.rect(px - s / 2, py - s / 2, s, s);
  } else ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.globalAlpha = kd.cls === "mol" ? 0.88 : 0.93; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = kd.key ? 1.9 : 1;
  ctx.strokeStyle = darker(col, kd.key ? 0.55 : 0.72); ctx.stroke();
  if (kd.sym) {
    ctx.fillStyle = "#fff";
    ctx.font = "600 " + Math.max(9.5, r * 0.74).toFixed(1) + "px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(kd.sym, px, py + 0.5); ctx.textBaseline = "alphabetic";
  }
  if (k === "EtOH") {
    ctx.fillStyle = darker("#9fc6d8", 0.45);
    ctx.font = "600 " + Math.max(8.5, r * 0.60).toFixed(1) + "px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("에탄올", px, py + 0.5); ctx.textBaseline = "alphabetic";
  }
}
function hidden(k) { return st.onlyColor && !ION_KIND[k].key && ION_KIND[k].cls === "ion"; }

/* ---------- 탭 1 : 전기 전도성 ---------- */
function drawConductivity(w, h) {
  var lamp = ionLampLevel(st.sol) && st.power;
  var top = h;   /* 장치 그림이 무대 전부다 — 입자 상자는 단추줄 아래 별도 캔버스(drawMicro) */

  /* 비커 */
  var bw = Math.min(158, w * 0.36), bx = w * 0.50 - bw / 2, by = 46, bh = top - 82;
  ctx.save();
  ctx.lineWidth = 2.2; ctx.strokeStyle = "#b6c6d6";
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh - 10);
  ctx.quadraticCurveTo(bx, by + bh, bx + 10, by + bh);
  ctx.lineTo(bx + bw - 10, by + bh);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw, by + bh - 10);
  ctx.lineTo(bx + bw, by); ctx.stroke();
  var ly = by + bh * 0.26;
  ctx.beginPath();
  ctx.moveTo(bx + 1.5, ly); ctx.lineTo(bx + 1.5, by + bh - 11);
  ctx.quadraticCurveTo(bx + 1.5, by + bh - 1.5, bx + 11, by + bh - 1.5);
  ctx.lineTo(bx + bw - 11, by + bh - 1.5);
  ctx.quadraticCurveTo(bx + bw - 1.5, by + bh - 1.5, bx + bw - 1.5, by + bh - 11);
  ctx.lineTo(bx + bw - 1.5, ly); ctx.closePath();
  ctx.fillStyle = "#eaf3fa"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + 1.5, ly); ctx.lineTo(bx + bw - 1.5, ly);
  ctx.strokeStyle = "rgba(40,45,52,0.25)"; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + 7, by + 12); ctx.lineTo(bx + 7, by + bh - 22);
  ctx.strokeStyle = C.glass; ctx.lineWidth = 2.6; ctx.stroke();

  /* 전극 두 개 */
  var ex = [bx + bw * 0.30, bx + bw * 0.70];
  for (var i = 0; i < 2; i++) {
    ctx.fillStyle = "#4a5560";
    ctx.fillRect(ex[i] - 4, by - 26, 8, bh * 0.72 + 26);
    ctx.strokeStyle = "#333d46"; ctx.lineWidth = 1; ctx.strokeRect(ex[i] - 4, by - 26, 8, bh * 0.72 + 26);
  }
  /* 배선 + 전지 + 전구 */
  ctx.strokeStyle = C.t2; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex[0], by - 26); ctx.lineTo(ex[0], 24); ctx.lineTo(w * 0.30, 24);
  ctx.moveTo(ex[1], by - 26); ctx.lineTo(ex[1], 24); ctx.lineTo(w * 0.70, 24);
  ctx.stroke();
  /* 전지 */
  ctx.beginPath(); ctx.moveTo(w * 0.30, 16); ctx.lineTo(w * 0.30, 32);
  ctx.moveTo(w * 0.335, 11); ctx.lineTo(w * 0.335, 37); ctx.stroke();
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("전지", w * 0.317, 50);
  ctx.beginPath(); ctx.moveTo(w * 0.335, 24); ctx.lineTo(w * 0.63, 24); ctx.stroke();
  /* 전구 */
  var gx = w * 0.665, gy = 24;
  if (lamp) {
    var grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, 26);
    grad.addColorStop(0, "rgba(250,204,21,0.85)"); grad.addColorStop(1, "rgba(250,204,21,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(gx, gy, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(gx, gy, 11, 0, Math.PI * 2);
  ctx.fillStyle = lamp ? "#f3d64a" : "#e8ecf1"; ctx.fill();
  ctx.strokeStyle = lamp ? "#8a6d0b" : "#9aa5b1"; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx - 5, gy + 3); ctx.lineTo(gx, gy - 3); ctx.lineTo(gx + 5, gy + 3);
  ctx.strokeStyle = lamp ? "#7a5c05" : "#b3bcc6"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = lamp ? C.t1 : C.t3; ctx.font = "600 11.5px " + FONT; ctx.textAlign = "center";
  var lampTxt = st.power ? (lamp ? "불이 켜졌다" : "불이 안 켜진다") : "전원 꺼짐";
  /* 좁은 화면(360 px)에서는 이 글자가 오른쪽 전극 위에 걸려 「불」이 묻힌다(2026-09-13 육안 실측)
     — 전극과 겹치면 전극 오른쪽으로 비킨다. 넓은 화면에서는 그대로 전구 아래 가운데 */
  var lx = gx;
  if (gx - ctx.measureText(lampTxt).width / 2 < ex[1] + 8) { ctx.textAlign = "left"; lx = ex[1] + 8; }
  ctx.fillText(lampTxt, lx, gy + 30);
  ctx.restore();

  /* 용액 이름 */
  var s = ionSolute(st.sol);
  ctx.fillStyle = C.t1; ctx.font = "600 13px " + FONT; ctx.textAlign = "center";
  ctx.fillText(s.name + " (" + s.formula + ")", w / 2, top - 22);
}

/* 탭 ① 입자 상자 — 「입자로 보기」를 눌렀을 때만 (showMicro) · 별도 캔버스 mctx */
function drawMicro(w, h) {
  var bx2 = 8, by2 = 6, bw2 = w - 16, bh2 = h - 12;
  mctx.save();
  mctx.beginPath();
  if (mctx.roundRect) mctx.roundRect(bx2, by2, bw2, bh2, 10); else mctx.rect(bx2, by2, bw2, bh2);
  mctx.fillStyle = "#fbfdff"; mctx.fill();
  mctx.strokeStyle = C.line; mctx.lineWidth = 1; mctx.stroke(); mctx.clip();
  mctx.fillStyle = C.t3; mctx.font = "11px " + FONT; mctx.textAlign = "left";
  mctx.fillText("용액 속을 분자·이온 크기로 확대한 것", bx2 + 10, by2 + 15);
  var r = partRadius(bw2 - 16, bh2 - 34, st.parts.length);
  st.lastR = r;
  for (var q = 0; q < st.parts.length; q++) {
    var pt = st.parts[q];
    if (hidden(pt.k)) continue;
    drawParticle(mctx, bx2 + 8 + pt.x * (bw2 - 16), by2 + 22 + pt.y * (bh2 - 34), r, pt.k);
  }
  mctx.restore();
}

/* ---------- 탭 2 : 이온 이동 ---------- */
function drawMigration(w, h) {
  var lit = ionLitmus(st.sol);
  var base = (lit === "base") ? PAPER.red : PAPER.blue;
  var stain = (lit === "base") ? PAPER.toBlue : PAPER.toRed;
  var px0 = w * 0.13, px1 = w * 0.87, py0 = 60, py1 = h - 74;
  var e = ease(st.p);

  /* 전극판 — 왼쪽 (+) · 오른쪽 (−) */
  ctx.save();
  ctx.fillStyle = "#4a5560";
  ctx.fillRect(px0 - 26, py0 - 8, 16, (py1 - py0) + 16);
  ctx.fillRect(px1 + 10, py0 - 8, 16, (py1 - py0) + 16);
  ctx.fillStyle = C.t1; ctx.font = "700 17px " + FONT; ctx.textAlign = "center";
  ctx.fillText("+", px0 - 18, py0 - 16);
  ctx.fillText("−", px1 + 18, py0 - 16);
  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT;
  ctx.fillText("(+)극", px0 - 18, py1 + 26);
  ctx.fillText("(−)극", px1 + 18, py1 + 26);

  /* 리트머스 종이 */
  ctx.fillStyle = base; ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
  /* 번진 자국 — 실에서 «색을 바꾸는 이온»이 간 쪽으로 */
  if (lit !== "none" && e > 0.001) {
    var mid = (px0 + px1) / 2, half = (px1 - px0) / 2;
    var dir = (lit === "base") ? -1 : 1;         /* 산 → (−)극(오른쪽) · 염기 → (+)극(왼쪽) */
    var span = half * e * 0.92;
    var g = ctx.createLinearGradient(mid, 0, mid + dir * span, 0);
    g.addColorStop(0, stain); g.addColorStop(0.75, stain); g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(dir > 0 ? mid : mid - span, py0, span, py1 - py0);
  }
  ctx.strokeStyle = "rgba(40,45,52,0.35)"; ctx.lineWidth = 1.2;
  ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);

  /* 실 */
  ctx.beginPath(); ctx.moveTo((px0 + px1) / 2, py0 + 2); ctx.lineTo((px0 + px1) / 2, py1 - 2);
  ctx.strokeStyle = "#8b7355"; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = "#6d5a44"; ctx.lineWidth = 1; ctx.stroke();

  /* 라벨 */
  ctx.fillStyle = C.t2; ctx.font = "11.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("질산 칼륨 수용액을 적신 " + (lit === "base" ? "붉은색" : "푸른색") + " 리트머스 종이",
               (px0 + px1) / 2, py0 - 16);
  ctx.fillText(ionSolute(st.sol).name + "을(를) 적신 실", (px0 + px1) / 2, py1 + 26);

  /* 이온 */
  if (st.zoom) {
    var r = partRadius(px1 - px0 - 20, py1 - py0 - 28, st.parts.length);
    st.lastR = r;
    for (var q = 0; q < st.parts.length; q++) {
      var pt = st.parts[q];
      if (hidden(pt.k)) continue;
      drawParticle(ctx, px0 + 10 + pt.x * (px1 - px0 - 20), py0 + 14 + pt.y * (py1 - py0 - 28), r, pt.k);
    }
  }
  ctx.restore();

  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT; ctx.textAlign = "center";
  ctx.fillText(st.power ? "전원 켜짐 — 12~15 V 직류" : "전원 꺼짐", w / 2, py1 + 46);
}

function draw() {
  var w = fit(cv, ctx, stageH());
  if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);
  if (st.tab === "cond") {
    drawConductivity(w, h);
    if (showMicro()) {
      var mh = microH(), mw = fit(mcv, mctx, mh);
      if (mw) { mctx.clearRect(0, 0, mw, mh); drawMicro(mw, mh); }
    }
  } else drawMigration(w, h);
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;
  var i, pt;

  if (st.tab === "move" && st.power && RM) {
    /* 동작 줄이기 — 끝 상태로 «즉시» 옮긴다. 값도 그림도 종단과 같아야 한다 */
    st.p = 1;
    for (var z = 0; z < st.parts.length; z++) {
      var zp = st.parts[z], zt = ionMovesTo(zp.k);
      if (zt === "cathode") { zp.x = 1 - zp.stop; zp.y = zp.lane; }
      else if (zt === "anode") { zp.x = zp.stop; zp.y = zp.lane; }
    }
    syncMoveRead();
  } else if (st.tab === "move" && st.power) {
    if (ionLitmus(st.sol) !== "none" && st.p < 1) {
      st.p = Math.min(1, st.p + dt / (RM ? 0.001 : 6.0));
      syncMoveRead();
    }
    /* 전기장 이동 — 양이온은 (−)극(오른쪽), 음이온은 (+)극(왼쪽) */
    for (i = 0; i < st.parts.length; i++) {
      pt = st.parts[i];
      var to = ionMovesTo(pt.k);
      var v = RM ? 0 : (to === "cathode" ? 0.19 : to === "anode" ? -0.19 : 0);
      var lim = to === "cathode" ? (1 - pt.stop) : to === "anode" ? pt.stop : 1;
      pt.x += v * dt;
      /* 자기 «줄»로 부드럽게 모인다 — 세로로 포개지지 않게 */
      if (to === "none") pt.y += (RM ? 0 : pt.vy) * dt * 0.35;
      else pt.y += (pt.lane - pt.y) * Math.min(1, dt * 1.6);
      if (to === "cathode" && pt.x > lim) pt.x = lim;
      if (to === "anode"   && pt.x < lim) pt.x = lim;
      if (pt.x < 0.03) pt.x = 0.03;
      if (pt.x > 0.97) pt.x = 0.97;
      if (pt.y < 0.05) { pt.y = 0.05; pt.vy = Math.abs(pt.vy); }
      if (pt.y > 0.95) { pt.y = 0.95; pt.vy = -Math.abs(pt.vy); }
    }
  } else if (st.tab === "cond" && !RM) {
    for (i = 0; i < st.parts.length; i++) {
      pt = st.parts[i];
      var drift = 0;
      if (st.power && ionLampLevel(st.sol)) {
        var t2 = ionMovesTo(pt.k);
        drift = t2 === "cathode" ? 0.030 : t2 === "anode" ? -0.030 : 0;
      }
      pt.x += (pt.vx + drift) * dt; pt.y += pt.vy * dt;
      if (pt.x < 0.05) { pt.x = 0.05; pt.vx = Math.abs(pt.vx); }
      if (pt.x > 0.95) { pt.x = 0.95; pt.vx = -Math.abs(pt.vx); }
      if (pt.y < 0.06) { pt.y = 0.06; pt.vy = Math.abs(pt.vy); }
      if (pt.y > 0.94) { pt.y = 0.94; pt.vy = -Math.abs(pt.vy); }
    }
  }
  draw();
}

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }
/* ★ 이온마다 «어디서 왔는지»를 함께 쓴다.
   K⁺·NO₃⁻ 는 시약이 아니라 종이에 배어 있던 질산 칼륨에서 온다 —
   이걸 안 쓰면 「에탄올이 K⁺ 를 낸다」는 새 오개념이 생긴다(매뉴얼 P5-M1). */
function ionFrom(k) { return (k === "K" || k === "NO3") ? "종이의 " : "시약의 "; }
function listStr(o) {
  var ks = Object.keys(o), out = [];
  for (var i = 0; i < ks.length; i++)
    out.push(ionFrom(ks[i]) + ION_KIND[ks[i]].sym + " " + o[ks[i]] + "개");
  return out.length ? out.join(" · ") : "없음";
}

function syncMoveRead() {
  var cat = ionCationsToCathode(st.sol), an = ionAnionsToAnode(st.sol);
  setTxt("mCat", listStr(cat));
  setTxt("mAn",  listStr(an));
  var lit = ionLitmus(st.sol);
  setTxt("mLit", lit === "acid" ? "푸른색 → 붉은색  ((−)극 쪽으로)"
               : lit === "base" ? "붉은색 → 푸른색  ((+)극 쪽으로)" : "변화 없음");
  setTxt("mProg", !st.power ? "전원을 켜세요"
                : lit === "none" ? "종이의 이온은 움직이는데 색은 변하지 않습니다"
                : (st.p >= 1 ? "다 번졌습니다" : Math.round(st.p * 100) + " % 번짐"));
  /* 에탄올일 때 「그럼 움직이는 저건 뭔가」에 그 자리에서 답한다 */
  setTxt("mWhose", ionSolute(st.sol).ions.length
    ? "종이에는 질산 칼륨(KNO₃)이 배어 있습니다. 그래서 K⁺·NO₃⁻ 는 «어떤 시약을 올려도» 늘 있습니다."
    : "이 시약은 이온을 내놓지 않습니다. 움직이는 K⁺·NO₃⁻ 는 «전부» 종이의 질산 칼륨에서 온 것입니다.");
}

function sync() {
  var s = ionSolute(st.sol);
  /* 탭 가시성 — 단일 원천 표만 display 를 쓴다 (§13 ①) */
  var vis = SHOW[st.tab];
  var el;
  el = document.querySelectorAll(".only-cond");
  for (var i = 0; i < el.length; i++) el[i].style.display = vis.condOnly ? "block" : "none";
  el = document.querySelectorAll(".only-move");
  for (i = 0; i < el.length; i++) el[i].style.display = vis.moveOnly ? "block" : "none";
  $("microBox").style.display = showMicro() ? "block" : "none";

  var tb = document.querySelectorAll(".tabb");
  for (i = 0; i < tb.length; i++)
    tb[i].setAttribute("aria-pressed", tb[i].dataset.tab === st.tab ? "true" : "false");
  var sb = document.querySelectorAll(".solb");
  for (i = 0; i < sb.length; i++) {
    sb[i].setAttribute("aria-pressed", sb[i].dataset.sol === st.sol ? "true" : "false");
    /* 탭 2 에서는 실에 적실 시약 3종만 — 증류수는 실물 절차에 없다 */
    sb[i].style.display = (st.tab === "move" && sb[i].dataset.sol === "water") ? "none" : "";
  }

  setTxt("sName", s.name);
  setTxt("sForm", s.formula);
  setTxt("sSrc", s.src === "탐구" ? "홈판 탐구 6종에 있음"
               : s.src === "대조" ? "지도서가 권한 대조 물질"
               : "홈판 탐구표에 없음 (손소독제 성분)");
  setTxt("cLamp", !st.power ? "—" : (ionLampLevel(st.sol) ? "켜짐" : "꺼짐"));
  setTxt("cIon", (s.ions.length ? "있음" : "없음"));
  var lampBox = $("lampBox");
  lampBox.className = "readout" + (!st.power ? "" : (ionLampLevel(st.sol) ? " is-ok" : " is-warn"));

  /* ★ M3 대조표 — 「화학식에 OH 가 있는가」 ↔ 「염기인가」 */
  setTxt("m3f", ionHasOHinFormula(st.sol) ? "있다" : "없다");
  setTxt("m3b", ionIsBase(st.sol) ? "염기다" : "염기가 아니다");
  var m3 = $("m3box");
  m3.className = "note " +
    (ionHasOHinFormula(st.sol) && !ionIsBase(st.sol) ? "note--warn" : "note--key");

  $("powBtn").textContent = st.power ? "전원 끄기" : "전원 켜기";
  $("powBtn").setAttribute("aria-pressed", st.power ? "true" : "false");
  $("zoomBtn").textContent = st.zoom ? "입자 화면 접기" : "입자로 보기";
  $("zoomBtn").setAttribute("aria-pressed", st.zoom ? "true" : "false");
  $("onlyChk").disabled = !st.zoom;

  syncMoveRead();
  /* 캡션은 입자가 접혀 있는지 안다 — 접힌 채 「아래 상자」를 가리키면 안 된다 */
  setTxt("stageCap", st.tab === "cond"
    ? (st.power
        ? (ionLampLevel(st.sol)
            ? (st.zoom ? "전구에 불이 켜졌습니다. 아래 상자에 «이온»이 있는지 보세요."
                       : "전구에 불이 켜졌습니다. 「입자로 보기」를 눌러 용액 속에 «이온»이 있는지 보세요.")
            : (st.zoom ? "전구에 불이 켜지지 않습니다. 아래 상자에 이온이 하나도 없습니다 — 분자로만 녹아 있습니다."
                       : "전구에 불이 켜지지 않습니다. 「입자로 보기」를 눌러 용액 속에 이온이 있는지 보세요."))
        : "전원을 켜면 이 용액에 전류가 흐르는지 알 수 있습니다.")
    : (st.power
        ? (st.zoom ? "전원이 켜졌습니다. 색이 번지는 쪽과, 이온이 가는 쪽을 «따로» 보세요."
                   : "전원이 켜졌습니다. 색이 번지는 쪽을 본 뒤, 「입자로 보기」를 눌러 이온이 가는 쪽도 «따로» 보세요.")
        : "전원을 켜기 전입니다. 종이에는 질산 칼륨의 K⁺·NO₃⁻가 이미 배어 있습니다."));
  draw();
}

function resetRun() {
  st.p = 0; buildParts(); sync();
}

/* ---------- 배선 ---------- */
var tbs = document.querySelectorAll(".tabb");
for (var ti = 0; ti < tbs.length; ti++) tbs[ti].addEventListener("click", function () {
  st.tab = this.dataset.tab;
  if (st.tab === "move" && st.sol === "water") st.sol = "hcl";
  st.power = false; resetRun();
});
var sbs = document.querySelectorAll(".solb");
for (var si = 0; si < sbs.length; si++) sbs[si].addEventListener("click", function () {
  st.sol = this.dataset.sol; st.power = false; resetRun();
});
$("powBtn").addEventListener("click", function () { st.power = !st.power; sync(); });
$("zoomBtn").addEventListener("click", function () { st.zoom = !st.zoom; sync(); });
$("onlyChk").addEventListener("change", function () { st.onlyColor = this.checked; draw(); });
$("againBtn").addEventListener("click", function () { st.power = false; resetRun(); });

window.addEventListener("resize", draw);
if (window.ResizeObserver) new ResizeObserver(draw).observe(cv.parentNode);
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
});

if (RM) $("rmNote").style.display = "block";
resetRun();
rafId = requestAnimationFrame(loop);
window.IONVIEW = { st: st, sync: sync, resetRun: resetRun };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    ION_SOL: ION_SOL, ION_KIND: ION_KIND, ION_ELECTROLYTE: ION_ELECTROLYTE,
    ionSolute: ionSolute, ionParticles: ionPaperParticles,
    ionBeakerParticles: ionBeakerParticles, ionPaperParticles: ionPaperParticles,
    ionMovesTo: ionMovesTo, ionLampLevel: ionLampLevel, ionLitmus: ionLitmus,
    ionIsBase: ionIsBase, ionIsAcid: ionIsAcid, ionHasOHinFormula: ionHasOHinFormula,
    ionCationsToCathode: ionCationsToCathode, ionAnionsToAnode: ionAnionsToAnode,
    ionTotalCharge: ionTotalCharge
  };
