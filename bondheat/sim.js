/* ============================================================
   결합과 에너지의 흡수·방출 — bondheat/sim.js
   통합과학2 Ⅰ-2 · 8차시 · 반박 대상 M10 (이 단원 최대 오개념) · M11 · M12

   ★ 이 파일의 성립 조건 — 로드맵 §3-2 M10 주
     "결합에너지를 정량적으로 계산하는 수업은 하지 않습니다. …
      한 문장으로 차단하는 수준에서만 다루십시오."
     → 내부 계산은 «문헌 결합 에너지»로 정확히 하되,
       화면에는 kJ 값을 한 자리도 쓰지 않는다. 학생이 읽는 것은 «막대의 길이»뿐이다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/bondheat_core.js 와 문자 단위로 같다. */

/* 평균 결합 에너지 (kJ/mol) — 문헌값. ★ 화면에 표시하지 않는다 */
var BE = {
  "C-H": 413, "O=O": 498, "C=O": 799, "O-H": 463,
  "H-H": 436, "N≡N": 945, "N=O": 631
};

/* 결합 그림용 — 두 원자와 결합 차수. 색은 CPK 국제 표준(매뉴얼 §4) */
var BOND_ATOMS = {
  "C-H": { a: "C", z: "H", order: 1 }, "O=O": { a: "O", z: "O", order: 2 },
  "C=O": { a: "C", z: "O", order: 2 }, "O-H": { a: "O", z: "H", order: 1 },
  "H-H": { a: "H", z: "H", order: 1 }, "N≡N": { a: "N", z: "N", order: 3 },
  "N=O": { a: "N", z: "O", order: 2 }
};
var CPK = { H: "#FFFFFF", C: "#404040", N: "#3050F8", O: "#FF0D0D" };

/* 네 반응 — 발열 2 · 흡열 2. ②와 ③은 서로의 «역반응»이다 (M12 반박의 핵심)
   ⚠ J-N2 — 에너지 값에는 상태를 병기한다. 모두 «기체» 상태 결합 에너지다 */
var RXN = [
  { id: "ch4", name: "메테인의 연소", where: "도시가스가 타는 반응",
    eq: "CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(g)",
    reactants: [{ f: "CH₄", n: 1, atoms: { C: 1, H: 4 }, bonds: 4 },
                { f: "O₂",  n: 2, atoms: { O: 2 },       bonds: 1 }],
    products:  [{ f: "CO₂", n: 1, atoms: { C: 1, O: 2 }, bonds: 2 },
                { f: "H₂O", n: 2, atoms: { H: 2, O: 1 }, bonds: 2 }],
    brk:  [{ b: "C-H", n: 4 }, { b: "O=O", n: 2 }],
    form: [{ b: "C=O", n: 2 }, { b: "O-H", n: 4 }],
    lit: -802.3 },
  { id: "h2burn", name: "수소의 연소", where: "수소차의 연료 전지가 쓰는 반응",
    eq: "2H₂(g) + O₂(g) → 2H₂O(g)",
    reactants: [{ f: "H₂", n: 2, atoms: { H: 2 }, bonds: 1 },
                { f: "O₂", n: 1, atoms: { O: 2 }, bonds: 1 }],
    products:  [{ f: "H₂O", n: 2, atoms: { H: 2, O: 1 }, bonds: 2 }],
    brk:  [{ b: "H-H", n: 2 }, { b: "O=O", n: 1 }],
    form: [{ b: "O-H", n: 4 }],
    lit: -483.6 },
  { id: "split", name: "물의 전기 분해", where: "8차시 낱말 찾기의 「전기 분해」",
    eq: "2H₂O(g) → 2H₂(g) + O₂(g)",
    reactants: [{ f: "H₂O", n: 2, atoms: { H: 2, O: 1 }, bonds: 2 }],
    products:  [{ f: "H₂", n: 2, atoms: { H: 2 }, bonds: 1 },
                { f: "O₂", n: 1, atoms: { O: 2 }, bonds: 1 }],
    brk:  [{ b: "O-H", n: 4 }],
    form: [{ b: "H-H", n: 2 }, { b: "O=O", n: 1 }],
    lit: +483.6 },
  { id: "no", name: "질소와 산소의 반응", where: "자동차 엔진 속 높은 온도에서",
    eq: "N₂(g) + O₂(g) → 2NO(g)",
    reactants: [{ f: "N₂", n: 1, atoms: { N: 2 }, bonds: 1 },
                { f: "O₂", n: 1, atoms: { O: 2 }, bonds: 1 }],
    products:  [{ f: "NO", n: 2, atoms: { N: 1, O: 1 }, bonds: 1 }],
    brk:  [{ b: "N≡N", n: 1 }, { b: "O=O", n: 1 }],
    form: [{ b: "N=O", n: 2 }],
    lit: +180.6 }
];

function beRxnById(id) {
  for (var i = 0; i < RXN.length; i++) if (RXN[i].id === id) return RXN[i];
  return null;
}
function beSum(list) {
  var s = 0;
  for (var i = 0; i < list.length; i++) s += BE[list[i].b] * list[i].n;
  return s;
}
/* ★ 끊는 데 드는 에너지 — 언제나 «양수»다. 이것이 M10 의 전부다 */
function beBreakSum(id) { return beSum(beRxnById(id).brk); }
/* ★ 새 결합에서 나오는 에너지 — 역시 언제나 양수다 */
function beFormSum(id)  { return beSum(beRxnById(id).form); }

/* 반응 전체 = 둘의 «차이». 양수면 흡열, 음수면 발열 (ΔH 의 부호와 같다) */
function beNet(id) { return beBreakSum(id) - beFormSum(id); }
function beIsExo(id) { return beNet(id) < 0; }

/* 막대 길이 — 큰 쪽이 1.0 이 되도록 정규화한다.
   ⚠ 반응마다 따로 정규화하므로 «반응끼리» 길이를 견주면 안 된다 (화면에 명시) */
function beBars(id) {
  var b = beBreakSum(id), f = beFormSum(id), m = Math.max(b, f);
  return { brk: b / m, form: f / m };
}
/* 주변의 온도는 어느 쪽으로 움직이는가 — 계가 내놓으면 주변이 오른다 */
function beSurroundSign(id) { return beIsExo(id) ? 1 : -1; }
/* 물질(계) 안에 저장된 에너지는 어느 쪽으로 움직이는가 — 주변과 «반대»다 */
function beStoredSign(id) { return beIsExo(id) ? -1 : 1; }

/* 끊어야 할 결합·만들 결합을 «하나씩» 늘어놓은 배열 (단계 진행용) */
function beSteps(list) {
  var out = [];
  for (var i = 0; i < list.length; i++)
    for (var j = 0; j < list[i].n; j++) out.push(list[i].b);
  return out;
}

/* 원자 수 — 반응식이 실제로 맞는지 «독립»으로 검산하기 위한 것 */
function beAtomCount(side) {
  var out = {};
  for (var i = 0; i < side.length; i++) {
    var m = side[i], ks = Object.keys(m.atoms);
    for (var j = 0; j < ks.length; j++)
      out[ks[j]] = (out[ks[j]] || 0) + m.atoms[ks[j]] * m.n;
  }
  return out;
}
function beBondCount(side) {
  var s = 0;
  for (var i = 0; i < side.length; i++) s += side[i].bonds * side[i].n;
  return s;
}

/* ================= UI + 렌더 ================= */

if (typeof document !== "undefined") (function () {

var $ = function (id) { return document.getElementById(id); };
var CSSV = function (n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
};
var C = {
  t1: CSSV("--t1"), t2: CSSV("--t2"), t3: CSSV("--t3"), line: CSSV("--line"),
  blue: CSSV("--d-blue"), amber: CSSV("--d-amber"), red: CSSV("--d-red"),
  green: CSSV("--d-green"), violet: CSSV("--d-violet"), gray: CSSV("--d-gray")
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

var st = {
  rxn: "ch4",
  phase: "idle",   /* idle → breaking → formed(만드는 중) → done */
  nBrk: 0,         /* 끊은 결합 수 */
  nForm: 0,        /* 만든 결합 수 */
  flow: 0
};

var cv = $("stageCv"), ctx = cv.getContext("2d");
var rafId = null, lastT = 0;

function R() { return beRxnById(st.rxn); }
function brkSteps() { return beSteps(R().brk); }
function formSteps() { return beSteps(R().form); }
function allBroken() { return st.nBrk >= brkSteps().length; }
function allFormed() { return st.nForm >= formSteps().length; }

/* 지금까지 쌓인 «몫» — 개수 비가 아니라 실제 에너지 비로 쌓는다 */
function brkProgress() {
  var s = brkSteps(), t = 0;
  for (var i = 0; i < st.nBrk; i++) t += BE[s[i]];
  return t / beBreakSum(st.rxn);
}
function formProgress() {
  var s = formSteps(), t = 0;
  for (var i = 0; i < st.nForm; i++) t += BE[s[i]];
  return t / beFormSum(st.rxn);
}

/* ---------- 결합 아이콘 (인라인 SVG — 외부 이미지 금지 §1) ---------- */
function bondSVG(b, dim) {
  var p = BOND_ATOMS[b], w = 46, h = 20, r = 7;
  var x1 = 10, x2 = 36, y = 10, lines = "";
  var off = p.order === 1 ? [0] : p.order === 2 ? [-2.6, 2.6] : [-3.6, 0, 3.6];
  for (var i = 0; i < off.length; i++)
    lines += '<line x1="' + (x1 + r) + '" y1="' + (y + off[i]) + '" x2="' + (x2 - r) +
             '" y2="' + (y + off[i]) + '" stroke="#5b636b" stroke-width="1.6"/>';
  function ball(cx, el) {
    var f = CPK[el];
    return '<circle cx="' + cx + '" cy="' + y + '" r="' + r + '" fill="' + f +
           '" stroke="' + shade(f, 0.5) + '" stroke-width="1" opacity="0.85"/>' +
           '<text x="' + cx + '" y="' + (y + 3.4) + '" text-anchor="middle" font-size="9" ' +
           'font-weight="700" fill="' + (el === "H" ? "#404040" : "#fff") + '">' + el + '</text>';
  }
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
         '" aria-hidden="true" style="vertical-align:-5px;opacity:' + (dim ? 0.35 : 1) + '">' +
         lines + ball(x1, p.a) + ball(x2, p.z) + '</svg>';
}
function shade(hex, f) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "#666";
  var n = parseInt(m[1], 16);
  return "rgb(" + Math.round(((n >> 16) & 255) * f) + "," +
                  Math.round(((n >> 8) & 255) * f) + "," +
                  Math.round((n & 255) * f) + ")";
}

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
  return Math.round(Math.max(310, Math.min(390, w * 0.60)));
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function draw() {
  var w = fit(stageH()); if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);
  var r = R();
  var bars = beBars(st.rxn);
  var pB = bars.brk * brkProgress();      /* 지금 화면의 왼쪽 막대 */
  var pF = bars.form * formProgress();    /* 오른쪽 막대 */
  var exo = beIsExo(st.rxn);

  /* 반응식 */
  ctx.fillStyle = C.t1; ctx.font = "600 15px " + FONT; ctx.textAlign = "center";
  ctx.fillText(r.eq, w * 0.36, 24);
  ctx.fillStyle = C.t3; ctx.font = "11.5px " + FONT;
  ctx.fillText(r.where, w * 0.36, 41);

  /* ---- 저울 ---- */
  var cx = w * 0.36, top = 58;
  var half = Math.min(120, w * 0.15);
  var maxBar = h - top - 152;
  var tilt = (pF - pB) * 0.26;            /* 오른쪽(방출)이 무거우면 오른쪽이 내려간다 */
  ctx.save();
  ctx.translate(cx, top);
  ctx.rotate(tilt);
  ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0);
  ctx.strokeStyle = C.t2; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
  ctx.beginPath(); ctx.arc(-half, 0, 5, 0, Math.PI * 2); ctx.arc(half, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.t2; ctx.fill();
  ctx.restore();
  /* 받침 */
  ctx.beginPath();
  ctx.moveTo(cx, top - 6); ctx.lineTo(cx - 11, top + 16); ctx.lineTo(cx + 11, top + 16);
  ctx.closePath(); ctx.fillStyle = C.t2; ctx.fill();

  /* ---- 두 막대 ---- */
  var bw = Math.min(58, w * 0.09), by0 = h - 108;
  function bar(x, frac, col, label, sub) {
    rr(x - bw / 2, by0 - maxBar, bw, maxBar, 7);
    ctx.fillStyle = "#eef1f5"; ctx.fill();
    ctx.strokeStyle = "rgba(40,45,52,0.16)"; ctx.lineWidth = 1; ctx.stroke();
    var hgt = maxBar * Math.max(0, Math.min(1, frac));
    if (hgt > 2) {
      rr(x - bw / 2 + 3, by0 - hgt + 1, bw - 6, hgt - 4, 5);
      ctx.fillStyle = col; ctx.fill();
    }
    ctx.fillStyle = C.t1; ctx.font = "600 12px " + FONT; ctx.textAlign = "center";
    ctx.fillText(label, x, by0 + 18);
    ctx.fillStyle = C.t3; ctx.font = "11px " + FONT;
    ctx.fillText(sub, x, by0 + 33);
  }
  bar(cx - half, pB, C.blue,  "흡수", "결합을 끊는 데 든 것");
  bar(cx + half, pF, C.red,   "방출", "새 결합에서 나온 것");

  /* ---- 차액 → 주변 ---- */
  var sx = w * 0.80;
  if (st.phase === "done") {
    var ay = top + 44;
    ctx.strokeStyle = exo ? C.red : C.blue; ctx.lineWidth = 3;
    var x0 = cx + half + 16, x1 = sx - 34;
    var dir = exo ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(dir > 0 ? x0 : x1, ay); ctx.lineTo(dir > 0 ? x1 - 8 : x0 + 8, ay); ctx.stroke();
    var hx = dir > 0 ? x1 : x0;
    ctx.beginPath();
    ctx.moveTo(hx, ay); ctx.lineTo(hx - dir * 10, ay - 6); ctx.lineTo(hx - dir * 10, ay + 6);
    ctx.closePath(); ctx.fillStyle = exo ? C.red : C.blue; ctx.fill();
    if (!RM) for (var i = 0; i < 3; i++) {
      var u = (st.flow + i / 3) % 1;
      var px = dir > 0 ? x0 + (x1 - x0 - 8) * u : x1 - (x1 - x0 - 8) * u;
      ctx.beginPath(); ctx.arc(px, ay - 11, 3, 0, Math.PI * 2);
      ctx.fillStyle = exo ? C.red : C.blue; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.t2; ctx.font = "600 11.5px " + FONT; ctx.textAlign = "center";
    ctx.fillText(exo ? "차액이 주변으로" : "차액을 주변에서", (x0 + x1) / 2, ay + 22);
  }

  /* ---- 주변 온도계 ---- */
  var ty = top + 16, th = h - ty - 130;
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx - 7, ty); ctx.lineTo(sx - 7, ty + th);
  ctx.moveTo(sx + 7, ty); ctx.lineTo(sx + 7, ty + th); ctx.arc(sx, ty, 7, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(sx, ty + th + 10, 11, 0, Math.PI * 2); ctx.stroke();
  var f0 = 0.5, f1 = st.phase === "done" ? (exo ? 0.84 : 0.20) : 0.5;
  ctx.beginPath(); ctx.arc(sx, ty + th + 10, 8.6, 0, Math.PI * 2);
  ctx.fillStyle = C.red; ctx.fill();
  ctx.fillRect(sx - 4.6, ty + th - (th - 8) * f1, 9.2, (th - 8) * f1);
  ctx.beginPath(); ctx.setLineDash([4, 3]);
  ctx.moveTo(sx - 15, ty + th - (th - 8) * f0); ctx.lineTo(sx + 15, ty + th - (th - 8) * f0);
  ctx.strokeStyle = "rgba(40,45,52,0.45)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.t2; ctx.font = "600 11.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("주변", sx, ty + th + 34);
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT;
  ctx.fillText("(반응 물질 바깥)", sx, ty + th + 48);

  /* ---- 계 : 물질 안에 저장된 에너지 ---- */
  var stx = w * 0.055, sty = h - 44;
  ctx.fillStyle = C.t2; ctx.font = "600 11px " + FONT; ctx.textAlign = "left";
  ctx.fillText("계 — 물질 안에 저장된 에너지", stx, sty - 6);
  rr(stx, sty, Math.min(220, w * 0.36), 14, 7);
  ctx.fillStyle = "#eef1f5"; ctx.fill();
  ctx.strokeStyle = "rgba(40,45,52,0.16)"; ctx.lineWidth = 1; ctx.stroke();
  var sw = Math.min(220, w * 0.36);
  var lvl = st.phase === "done" ? (exo ? 0.34 : 0.80) : 0.58;
  rr(stx + 2, sty + 2, (sw - 4) * lvl, 10, 5);
  ctx.fillStyle = C.violet; ctx.fill();
  if (st.phase === "done") {
    ctx.beginPath(); ctx.setLineDash([4, 3]);
    ctx.moveTo(stx + 2 + (sw - 4) * 0.58, sty - 3);
    ctx.lineTo(stx + 2 + (sw - 4) * 0.58, sty + 17);
    ctx.strokeStyle = "rgba(40,45,52,0.5)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.t3; ctx.font = "10px " + FONT; ctx.textAlign = "left";
    ctx.fillText("반응 전", stx + 6 + (sw - 4) * 0.58, sty - 5);
  }

  /* ---- 아래 한 줄 ---- */
  ctx.textAlign = "left"; ctx.font = "11px " + FONT; ctx.fillStyle = C.t3;
  ctx.fillText("두 막대의 길이는 이 반응 «안에서만» 견줍니다. 다른 반응과는 견주지 마세요.",
               stx, h - 8);
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;
  if (!RM) st.flow = (st.flow + dt * 0.5) % 1;
  draw();
}

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }

function listHTML(steps, doneN, kind) {
  var out = "";
  for (var i = 0; i < steps.length; i++) {
    var dim = (i >= doneN);
    out += '<span class="bchip' + (dim ? " is-dim" : " is-on") + '">' +
           bondSVG(steps[i], dim) + '<b>' + steps[i].replace(/-/g, "–") + '</b></span>';
  }
  return out;
}

function sync() {
  var r = R(), bs = brkSteps(), fs = formSteps();
  var rb = document.querySelectorAll(".rxnb");
  for (var i = 0; i < rb.length; i++)
    rb[i].setAttribute("aria-pressed", rb[i].dataset.rxn === st.rxn ? "true" : "false");

  $("brkList").innerHTML  = listHTML(bs, st.nBrk, "brk");
  $("formList").innerHTML = listHTML(fs, st.nForm, "form");
  setTxt("brkCount",  st.nBrk + " / " + bs.length);
  setTxt("formCount", st.nForm + " / " + fs.length);

  $("brkBtn").disabled  = allBroken();
  $("brkAll").disabled  = allBroken();
  $("formBtn").disabled = !allBroken() || allFormed();
  $("formAll").disabled = !allBroken() || allFormed();

  /* ★ 순서 강제 — 다 끊기 전에는 만들 수 없다 (P0 ③ 반박 장치) */
  $("gateNote").style.display = allBroken() ? "none" : "block";

  var res = $("resultBox");
  if (st.phase === "done") {
    var exo = beIsExo(st.rxn);
    res.style.display = "block";
    res.className = "note " + (exo ? "note--warn" : "note--key");
    res.innerHTML =
      "<b>" + (exo ? "방출 쪽이 더 길다 → 발열 반응" : "흡수 쪽이 더 길다 → 흡열 반응") + "</b><br>" +
      (exo
        ? "새 결합이 만들어지며 나온 에너지가 <b>결합을 끊는 데 든 에너지보다 크다.</b> " +
          "그 <b>차액</b>이 주변으로 나가 <b>주변의 온도가 오른다.</b> " +
          "에너지를 내놓은 것은 <b>물질</b>이고, 뜨거워진 것은 <b>주변</b>이다."
        : "결합을 끊는 데 든 에너지가 새 결합에서 나온 에너지보다 크다. " +
          "모자란 만큼을 <b>주변에서 가져오므로 주변의 온도가 내려간다.</b> " +
          "가져온 에너지는 <b>사라지지 않고 물질 안에 저장</b>된다 — 왼쪽 아래 막대를 보라.");
  } else res.style.display = "none";

  setTxt("stageCap",
    st.phase === "idle"     ? "「① 결합 끊기」부터 누르세요. 결합 하나를 끊을 때마다 에너지가 «듭니다»."
  : st.phase === "breaking" ? "결합을 끊는 중입니다. 왼쪽 막대(흡수)가 쌓이고 있습니다."
  : st.phase === "forming"  ? "새 결합을 만드는 중입니다. 오른쪽 막대(방출)가 쌓이고 있습니다."
  : "두 막대의 길이를 견주세요. 그 차이가 주변으로 나가거나 주변에서 들어옵니다.");
  draw();
}

function resetRxn() {
  st.nBrk = 0; st.nForm = 0; st.phase = "idle"; sync();
}

/* ---------- 배선 ---------- */
var rbs = document.querySelectorAll(".rxnb");
for (var ri = 0; ri < rbs.length; ri++) rbs[ri].addEventListener("click", function () {
  st.rxn = this.dataset.rxn; resetRxn();
});
$("brkBtn").addEventListener("click", function () {
  if (allBroken()) return;
  st.nBrk++; st.phase = allBroken() ? "forming" : "breaking"; sync();
});
$("brkAll").addEventListener("click", function () {
  st.nBrk = brkSteps().length; st.phase = "forming"; sync();
});
$("formBtn").addEventListener("click", function () {
  if (!allBroken() || allFormed()) return;
  st.nForm++; st.phase = allFormed() ? "done" : "forming"; sync();
});
$("formAll").addEventListener("click", function () {
  if (!allBroken()) return;
  st.nForm = formSteps().length; st.phase = "done"; sync();
});
$("againBtn").addEventListener("click", resetRxn);

window.addEventListener("resize", draw);
if (window.ResizeObserver) new ResizeObserver(draw).observe(cv.parentNode);
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
});

if (RM) $("rmNote").style.display = "block";
resetRxn();
rafId = requestAnimationFrame(loop);
window.BHVIEW = { st: st, sync: sync, resetRxn: resetRxn };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    BE: BE, RXN: RXN, BOND_ATOMS: BOND_ATOMS, CPK: CPK,
    beRxnById: beRxnById, beBreakSum: beBreakSum, beFormSum: beFormSum, beNet: beNet,
    beIsExo: beIsExo, beBars: beBars, beSurroundSign: beSurroundSign,
    beStoredSign: beStoredSign, beSteps: beSteps,
    beAtomCount: beAtomCount, beBondCount: beBondCount
  };
