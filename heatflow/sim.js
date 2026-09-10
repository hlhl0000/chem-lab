/* ============================================================
   변화와 에너지의 출입 — heatflow/sim.js
   통합과학2 Ⅰ-2 · 8차시 · 9~10차시 · 반박 대상 M13 · M11 · M12 (+ 안전)

   ⚠ 성취기준 [10통과2-01-05] 해설 — 열화학 반응식·엔탈피를 다루지 않는다.
      → 반응열 수치를 화면에 쓰지 않는다. 온도·시간·압력만 읽는다.
   ⚠ 지도서 126쪽 유의점 3 — 밀폐 용기 금지. 그 결과를 «화면에서» 보인다.
      폭발 그림을 그리지 않는다 — 압력계가 위험역에 들어가고 실험이 «중단»된다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/heatflow_core.js 와 문자 단위로 같다. */

/* ---- 탭 ① 여섯 가지 변화 — 교과서 46쪽 단어 찾기의 여섯 낱말 그대로 ---- */
var CHG = [
  { id: "freeze",  name: "응고",      ex: "물이 얼어 얼음이 된다",
    physical: true,  release: true },
  { id: "vapor",   name: "기화",      ex: "물이 증발해 수증기가 된다",
    physical: true,  release: false },
  { id: "burn",    name: "연소",      ex: "메테인(도시가스)이 탄다",
    physical: false, release: true },
  { id: "electro", name: "전기 분해", ex: "물에 전류를 흘려 수소와 산소로 나눈다",
    physical: false, release: false },
  { id: "photo",   name: "광합성",    ex: "식물이 빛을 받아 포도당을 만든다",
    physical: false, release: false },
  { id: "resp",    name: "세포호흡",  ex: "우리 몸이 포도당을 분해해 에너지를 얻는다",
    physical: false, release: true }
];
function chgById(id) {
  for (var i = 0; i < CHG.length; i++) if (CHG[i].id === id) return CHG[i];
  return null;
}
function chgIsPhysical(id) { return chgById(id).physical; }
function chgIsRelease(id)  { return chgById(id).release; }

/* ---- 탭 ② 발열 팩 조리 장치 ----
   CaO(s) + H₂O(l) → Ca(OH)₂(s)
   표준 생성 엔탈피 −635.1 / −285.8 / −986.1 kJ/mol → ΔH = −65.2 kJ/mol */
var HP = {
  M_CAO:  56.08,   /* g/mol  산화 칼슘 */
  DH:    -65.2,    /* kJ/mol 위 계산값 */
  PACK_G: 50,      /* g      발열 팩 1개당 산화 칼슘 (지도서 126쪽 「약 50 g 상당」) */
  CP_W:   4.18,    /* J/(g·K) */
  T0:     25,      /* ℃      실온 */
  TARGET: 70,      /* ℃      조리 기준 (지도서 126쪽) */
  NEED:   15,      /* 분      달걀·즉석식품 (지도서 126쪽) */
  CAP_OPEN:  100,  /* ℃      열린 계 — 끓으면 더 오르지 않는다 */
  CAP_SEAL:  130,  /* ℃      밀폐 — 압력이 올라 끓는점이 오른다. 모형 상한 */
  BURST:   0.35,   /* atm    게이지 압력 — 이 위는 「위험」. 가정값 */
  /* 무보온 냉각 상수는 지도서 126쪽 「70 ℃ 이상 약 15분」에 맞춰 역산한 값이다.
     나머지 둘은 그것을 기준으로 잡은 가정이다 */
  K_INS: { none: 0.0290, paper: 0.0195, foam: 0.0115 },
  INS_NAME: { none: "감싸지 않음", paper: "종이 상자", foam: "스타이로폼 보온 용기" }
};

function hpMolCaO(packs) { return packs * HP.PACK_G / HP.M_CAO; }
function hpHeatJ(packs)  { return -HP.DH * 1000 * hpMolCaO(packs); }

/* 최고 온도 — 물만 데운다고 보고, 열린 계는 100 ℃ 에서 멈춘다 */
function hpPeakTemp(packs, waterML, sealed) {
  if (waterML <= 0) return HP.T0;
  var dT = hpHeatJ(packs) / (waterML * HP.CP_W);
  var T  = HP.T0 + dT;
  return Math.min(T, sealed ? HP.CAP_SEAL : HP.CAP_OPEN);
}

/* 물의 포화 증기 압력 (mmHg) — Antoine 식, 1~100 ℃.
   100 ℃ 를 조금 넘겨 외삽해 쓴다(「가정과 한계」에 명시) */
function hpAntoinePmmHg(T) {
  return Math.pow(10, 8.07131 - 1730.63 / (233.426 + T));
}

/* 밀폐 용기 «안»의 절대 압력 (atm).
   갇힌 마른 공기(온도에 비례) + 물의 포화 증기 압력.
   25 ℃ 에서 정확히 1.000 atm 이 되도록 짜여 있다 */
function hpSealedPressureAtm(T) {
  var pSat0 = hpAntoinePmmHg(HP.T0) / 760;
  var pAir0 = 1 - pSat0;
  return pAir0 * (T + 273.15) / (HP.T0 + 273.15) + hpAntoinePmmHg(T) / 760;
}

/* 냉각 상수 (1/분) — 같은 모양이면 k ∝ 질량^(−1/3) */
function hpCoolK(insul, waterML) {
  var m = Math.max(1, waterML);
  return HP.K_INS[insul] * Math.pow(200 / m, 1 / 3);
}

/* 최고 온도에 이른 뒤 70 ℃ 아래로 내려가기까지 걸리는 시간 (분).
   Newton 냉각 : T(t) = 실온 + (최고 − 실온)·e^(−k·t) */
function hpHoldMinutes(packs, waterML, sealed, insul) {
  var peak = hpPeakTemp(packs, waterML, sealed);
  if (peak <= HP.TARGET) return 0;
  var k = hpCoolK(insul, waterML);
  return Math.log((peak - HP.T0) / (HP.TARGET - HP.T0)) / k;
}

/* 온도 곡선 — 올라가는 구간(선형)과 식는 구간(지수) */
function hpTempAt(packs, waterML, sealed, insul, minutes) {
  var peak = hpPeakTemp(packs, waterML, sealed), rise = 1.5;
  if (minutes <= 0) return HP.T0;
  if (minutes < rise) return HP.T0 + (peak - HP.T0) * (minutes / rise);
  return HP.T0 + (peak - HP.T0) *
         Math.exp(-hpCoolK(insul, waterML) * (minutes - rise));
}

/* 판정 — 안전이 «먼저»다 */
function hpVerdict(packs, waterML, sealed, insul) {
  var peak = hpPeakTemp(packs, waterML, sealed);
  var gauge = sealed ? (hpSealedPressureAtm(peak) - 1) : 0;
  var hold = hpHoldMinutes(packs, waterML, sealed, insul);
  if (sealed && gauge >= HP.BURST)
    return { code: "danger", peak: peak, hold: hold, gauge: gauge };
  if (peak < HP.TARGET)
    return { code: "cold",   peak: peak, hold: hold, gauge: gauge };
  if (hold < HP.NEED)
    return { code: "short",  peak: peak, hold: hold, gauge: gauge };
  return { code: "ok", peak: peak, hold: hold, gauge: gauge };
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
  green: CSSV("--d-green"), violet: CSSV("--d-violet"), gray: CSSV("--d-gray"),
  cyan: CSSV("--d-cyan")
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/* 단계×요소 가시성 — 단일 원천 (매뉴얼 §13 ①) */
var SHOW = { six: { six: true, cook: false }, cook: { six: false, cook: true } };

var st = {
  tab: "six",
  card: "freeze",
  answer: {},          /* id → {physical:bool, release:bool} — 제출한 것만 */
  pickPhys: null,      /* 지금 고른 값 (제출 전) */
  pickRel: null,
  flow: 0,             /* 화살표 애니메이션 위상 */
  packs: 1, water: 200, insul: "none", sealed: false,
  t: 0, running: false, tmax: 40
};

var cv = $("stageCv"), ctx = cv.getContext("2d");
var rafId = null, lastT = 0;

function answered(id) { return Object.prototype.hasOwnProperty.call(st.answer, id); }
function answeredCount() { return Object.keys(st.answer).length; }

/* ---------- 캔버스 ---------- */
function fit(hCss) {
  var wrap = cv.parentNode, w = wrap.clientWidth;
  if (w < 40) return 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(hCss * dpr);
  cv.style.height = hCss + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}
function stageH() {
  var w = cv.parentNode.clientWidth || 600;
  return Math.round(Math.max(300, Math.min(360, w * 0.56)));
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/* ---------- 탭 ① : 계 ↔ 주변 ---------- */
function drawSix(w, h) {
  var c = chgById(st.card), done = answered(st.card);
  var pad = 12, gap = Math.max(40, w * 0.12);
  var bw = (w - pad * 2 - gap) / 2, bh = h - 116, by = 58;

  ctx.fillStyle = C.t1; ctx.font = "600 15px " + FONT; ctx.textAlign = "center";
  ctx.fillText(c.name + " — " + c.ex, w / 2, 26);
  ctx.fillStyle = C.t3; ctx.font = "11.5px " + FONT;
  ctx.fillText(done ? "화살표는 에너지가 어디로 갔는지를 나타냅니다"
                    : "먼저 오른쪽에서 분류를 «제출»하면 화살표가 나타납니다", w / 2, 44);

  /* 계 상자 */
  rr(pad, by, bw, bh, 12);
  ctx.fillStyle = "#f7f9fc"; ctx.fill();
  ctx.strokeStyle = done ? C.violet : C.line; ctx.lineWidth = done ? 2 : 1; ctx.stroke();
  ctx.fillStyle = C.t2; ctx.font = "600 12.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("계 — 변화하는 물질", pad + bw / 2, by + 20);

  /* 주변 상자 */
  var ox = pad + bw + gap;
  rr(ox, by, bw, bh, 12);
  ctx.fillStyle = "#f7f9fc"; ctx.fill();
  ctx.strokeStyle = done ? C.red : C.line; ctx.lineWidth = done ? 2 : 1; ctx.stroke();
  ctx.fillStyle = C.t2; ctx.font = "600 12.5px " + FONT;
  ctx.fillText("주변 — 물질 바깥", ox + bw / 2, by + 20);

  if (!done) {
    ctx.fillStyle = C.t3; ctx.font = "12.5px " + FONT;
    ctx.fillText("?", pad + bw / 2, by + bh / 2 + 6);
    ctx.fillText("?", ox + bw / 2, by + bh / 2 + 6);
    return;
  }

  var rel = c.release;

  /* 계 안 : 물질에 저장된 에너지 막대 (M12) */
  var barX = pad + bw / 2 - 26, barY = by + 40, barW = 52, barH = bh - 74;
  rr(barX, barY, barW, barH, 7);
  ctx.fillStyle = "#eef1f5"; ctx.fill();
  ctx.strokeStyle = "rgba(40,45,52,0.2)"; ctx.lineWidth = 1; ctx.stroke();
  var lvl = rel ? 0.34 : 0.78;
  rr(barX + 3, barY + barH * (1 - lvl) + 1, barW - 6, barH * lvl - 4, 5);
  ctx.fillStyle = C.violet; ctx.fill();
  /* 변화 전 자리 */
  var before = rel ? 0.78 : 0.34;
  ctx.beginPath(); ctx.setLineDash([5, 4]);
  ctx.moveTo(barX - 5, barY + barH * (1 - before));
  ctx.lineTo(barX + barW + 5, barY + barH * (1 - before));
  ctx.strokeStyle = "rgba(40,45,52,0.45)"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.setLineDash([]);
  /* 「변화 전」은 막대 «옆»에 쓴다 — 막대 위에 겹치면 흡열일 때 보라 위 회색이 되어 읽히지 않는다 */
  ctx.fillStyle = C.t3; ctx.font = "9.5px " + FONT; ctx.textAlign = "left";
  ctx.fillText("변화 전", barX + barW + 7, barY + barH * (1 - before) + 3.5);
  ctx.fillStyle = C.t2; ctx.font = "600 11.5px " + FONT;
  ctx.fillText("물질 안에 저장된", pad + bw / 2, by + bh - 22);
  ctx.fillText("에너지", pad + bw / 2, by + bh - 9);

  /* 주변 : 온도계 */
  var tx = ox + bw / 2, ty = by + 44, th = bh - 92;
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx - 7, ty + th);
  ctx.moveTo(tx + 7, ty); ctx.lineTo(tx + 7, ty + th);
  ctx.arc(tx, ty, 7, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty + th + 9, 11, 0, Math.PI * 2); ctx.stroke();
  var f = rel ? 0.80 : 0.26;
  ctx.beginPath(); ctx.arc(tx, ty + th + 9, 8.6, 0, Math.PI * 2);
  ctx.fillStyle = rel ? C.red : C.blue; ctx.fill();
  ctx.fillRect(tx - 4.6, ty + th - (th - 8) * f, 9.2, (th - 8) * f);
  ctx.fillStyle = rel ? C.red : C.blue; ctx.font = "600 12.5px " + FONT;
  ctx.textAlign = "center";
  ctx.fillText(rel ? "주변이 뜨거워진다" : "주변이 차가워진다", ox + bw / 2, by + bh - 14);

  /* 화살표 — 계 ↔ 주변 */
  var ax0 = pad + bw + 8, ax1 = ox - 8, ay = by + bh / 2;
  var dir = rel ? 1 : -1;
  ctx.strokeStyle = rel ? C.red : C.blue; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(dir > 0 ? ax0 : ax1, ay); ctx.lineTo(dir > 0 ? ax1 - 9 : ax0 + 9, ay);
  ctx.stroke();
  ctx.beginPath();
  var hx = dir > 0 ? ax1 : ax0;
  ctx.moveTo(hx, ay); ctx.lineTo(hx - dir * 11, ay - 7); ctx.lineTo(hx - dir * 11, ay + 7);
  ctx.closePath(); ctx.fillStyle = rel ? C.red : C.blue; ctx.fill();
  /* 흐르는 점 — 방향을 애니메이션으로도 준다 */
  if (!RM) for (var i = 0; i < 3; i++) {
    var u = (st.flow + i / 3) % 1;
    var px = dir > 0 ? ax0 + (ax1 - ax0 - 9) * u : ax1 - (ax1 - ax0 - 9) * u;
    ctx.beginPath(); ctx.arc(px, ay - 13, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = rel ? C.red : C.blue; ctx.globalAlpha = 0.75; ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = C.t1; ctx.font = "600 12px " + FONT; ctx.textAlign = "center";
  ctx.fillText(rel ? "방출" : "흡수", (ax0 + ax1) / 2, ay + 26);

  /* 아래 요약 */
  ctx.fillStyle = C.t2; ctx.font = "12px " + FONT; ctx.textAlign = "center";
  ctx.fillText(c.physical ? "물리 변화 — 물질의 종류는 그대로다"
                          : "화학 변화 — 다른 물질이 된다", w / 2, h - 14);
}

/* ---------- 탭 ② : 조리 장치 ---------- */
function drawCook(w, h) {
  var v = hpVerdict(st.packs, st.water, st.sealed, st.insul);
  var T = st.running || st.t > 0
        ? hpTempAt(st.packs, st.water, st.sealed, st.insul, st.t) : HP.T0;
  var danger = (v.code === "danger");
  var stopped = danger && st.t >= 1.5;

  /* 보온 용기 */
  var bw = Math.min(300, w * 0.60), bx = w * 0.36 - bw / 2, by = 46, bh = h - 118;
  var insColor = st.insul === "foam" ? "#dfe7ee" : st.insul === "paper" ? "#e6dcc8" : "#f2f5f8";
  rr(bx - 10, by - 10, bw + 20, bh + 20, 12);
  ctx.fillStyle = insColor; ctx.fill();
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT; ctx.textAlign = "left";
  ctx.fillText(HP.INS_NAME[st.insul], bx - 10, by - 16);

  /* 발열 팩 (부직포 봉지) */
  var packH = 22, py = by + bh - packH - 6;
  for (var i = 0; i < st.packs; i++) {
    rr(bx + 12 + i * ((bw - 24) / 3 + 2), py, (bw - 30) / 3, packH, 6);
    ctx.fillStyle = "#cfd8e2"; ctx.fill();
    ctx.strokeStyle = "#93a1b0"; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("발열 팩 " + st.packs + "개 (산화 칼슘)", bx + bw / 2, py + packH + 14);

  /* 알루미늄 포일 그릇 + 물 */
  var dh = Math.max(34, Math.min(78, bh * 0.34 * (st.water / 250)));
  var dy = py - dh - 12, dw = bw - 40, dx = bx + 20;
  ctx.beginPath();
  ctx.moveTo(dx, dy); ctx.lineTo(dx + 9, dy + dh); ctx.lineTo(dx + dw - 9, dy + dh);
  ctx.lineTo(dx + dw, dy); ctx.closePath();
  ctx.fillStyle = "#dbe6f0"; ctx.fill();
  ctx.strokeStyle = "#9fb0c0"; ctx.lineWidth = 1.8; ctx.stroke();
  /* 물 색 — 온도에 따라 */
  var hot = Math.max(0, Math.min(1, (T - HP.T0) / 75));
  ctx.save(); ctx.clip();
  ctx.fillStyle = "rgba(" + Math.round(120 + 110 * hot) + "," +
                  Math.round(180 - 90 * hot) + "," + Math.round(225 - 130 * hot) + ",0.75)";
  ctx.fillRect(dx, dy + 5, dw, dh);
  ctx.restore();
  ctx.fillStyle = C.t3; ctx.font = "10.5px " + FONT; ctx.textAlign = "center";
  ctx.fillText("물 " + st.water + " mL + 재료", dx + dw / 2, dy - 7);

  /* 뚜껑 · 김 구멍 */
  var lidY = dy - 26;
  ctx.fillStyle = "#c3ccd6";
  ctx.fillRect(bx + 6, lidY, bw - 12, 9);
  ctx.strokeStyle = "#93a1b0"; ctx.lineWidth = 1; ctx.strokeRect(bx + 6, lidY, bw - 12, 9);
  if (!st.sealed) {
    ctx.clearRect(bx + bw / 2 - 7, lidY - 1, 14, 11);
    ctx.strokeStyle = "#93a1b0"; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 6, lidY, bw / 2 - 13, 9);
    ctx.strokeRect(bx + bw / 2 + 7, lidY, bw / 2 - 13, 9);
    /* 김 */
    if (T > 55 && !RM) for (var s = 0; s < 3; s++) {
      var u = (st.flow * 0.6 + s / 3) % 1;
      ctx.beginPath();
      ctx.arc(bx + bw / 2 + Math.sin(u * 6 + s) * 9, lidY - 6 - u * 26, 4 + u * 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(150,170,190," + (0.42 * (1 - u)).toFixed(3) + ")"; ctx.fill();
    }
    ctx.fillStyle = C.green; ctx.font = "600 10.5px " + FONT; ctx.textAlign = "center";
    ctx.fillText("김 빠짐 구멍", bx + bw / 2, lidY - 34);
  } else {
    ctx.fillStyle = danger ? C.red : C.t3; ctx.font = "600 10.5px " + FONT; ctx.textAlign = "center";
    ctx.fillText("밀폐 — 구멍 없음", bx + bw / 2, lidY - 9);
  }

  /* 온도계 */
  var tx = w * 0.775, ty = by + 6, th = bh - 54;
  ctx.strokeStyle = "#b6c6d6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx - 7, ty + th);
  ctx.moveTo(tx + 7, ty); ctx.lineTo(tx + 7, ty + th); ctx.arc(tx, ty, 7, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty + th + 10, 11, 0, Math.PI * 2); ctx.stroke();
  var f = Math.max(0, Math.min(1, (T - 20) / 110));
  ctx.beginPath(); ctx.arc(tx, ty + th + 10, 8.6, 0, Math.PI * 2);
  ctx.fillStyle = C.red; ctx.fill();
  ctx.fillRect(tx - 4.6, ty + th - (th - 8) * f, 9.2, (th - 8) * f);
  /* 70 ℃ 기준선 */
  var y70 = ty + th - (th - 8) * ((HP.TARGET - 20) / 110);
  ctx.beginPath(); ctx.setLineDash([4, 3]);
  ctx.moveTo(tx - 16, y70); ctx.lineTo(tx + 26, y70);
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.amber; ctx.font = "10px " + FONT; ctx.textAlign = "left";
  ctx.fillText("70 ℃", tx + 12, y70 - 4);
  ctx.fillStyle = C.t1; ctx.font = "600 15px " + FONT; ctx.textAlign = "center";
  ctx.fillText(T.toFixed(1) + " ℃", tx, ty + th + 36);

  /* 압력계 — 밀폐일 때만 */
  if (st.sealed) {
    var gx = w * 0.905, gy = by + 34, gr = 21;
    var gp = hpSealedPressureAtm(T) - 1;
    ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI, 0);
    ctx.strokeStyle = "#93a1b0"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(gx, gy, gr - 4,
      Math.PI + Math.PI * (HP.BURST / 1.2), 0);
    ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.stroke();
    var ang = Math.PI + Math.PI * Math.max(0, Math.min(1, gp / 1.2));
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(ang) * (gr - 5), gy + Math.sin(ang) * (gr - 5));
    ctx.strokeStyle = C.t1; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = gp >= HP.BURST ? C.red : C.t3; ctx.font = "600 10.5px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("용기 안 압력", gx, gy + 15);
    ctx.fillStyle = C.t3; ctx.font = "9.5px " + FONT;
    ctx.textAlign = "right"; ctx.fillText("안전", gx - gr - 3, gy + 4);
    ctx.textAlign = "left";  ctx.fillText("위험", gx + gr + 3, gy + 4);
    ctx.textAlign = "center";
  }

  /* 중단 안내 — 폭발 그림을 그리지 않는다 */
  if (stopped) {
    rr(w * 0.05, h - 92, Math.min(430, w * 0.62), 74, 10);
    ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.fill();
    ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.red; ctx.font = "700 14px " + FONT; ctx.textAlign = "left";
    ctx.fillText("실험을 중단했습니다", w * 0.05 + 14, h - 68);
    ctx.fillStyle = C.t2; ctx.font = "12px " + FONT;
    ctx.fillText("용기 안 압력이 안전 범위를 넘었습니다.", w * 0.05 + 14, h - 48);
    ctx.fillText("김이 빠질 구멍을 두세요.", w * 0.05 + 14, h - 31);
  }

  /* 시간축 */
  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT; ctx.textAlign = "left";
  ctx.fillText("지난 시간 " + st.t.toFixed(0) + "분", 10, h - 8);
}

function draw() {
  var w = fit(stageH()); if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);
  if (st.tab === "six") drawSix(w, h); else drawCook(w, h);
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;
  if (!RM) st.flow = (st.flow + dt * 0.45) % 1;
  if (st.tab === "cook" && st.running) {
    var v = hpVerdict(st.packs, st.water, st.sealed, st.insul);
    st.t += dt * 4.5;                 /* 1초 ≈ 4.5분 */
    if (v.code === "danger" && st.t >= 1.5) { st.t = 1.5; st.running = false; syncCook(); }
    else if (st.t >= st.tmax) { st.t = st.tmax; st.running = false; syncCook(); }
    else syncCook();
  }
  draw();
}

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }

function syncCook() {
  var v = hpVerdict(st.packs, st.water, st.sealed, st.insul);
  setTxt("kPeak", v.peak.toFixed(1));
  setTxt("kHold", v.code === "danger" ? "—" : v.hold.toFixed(1));
  setTxt("kPress", st.sealed ? (hpSealedPressureAtm(v.peak)).toFixed(2) : "1.00");
  var box = $("verdictBox"), txt = $("kVerdict");
  var msg = { danger: "위험 — 밀폐하면 안 됩니다",
              cold:   "실패 — 70 ℃ 에 못 미칩니다",
              short:  "실패 — 70 ℃ 이상이 15분을 못 넘깁니다",
              ok:     "성공 — 익힐 수 있습니다" }[v.code];
  txt.textContent = msg;
  box.className = "readout wide " +
    (v.code === "ok" ? "is-ok" : v.code === "danger" ? "is-bad" : "is-warn");
  setTxt("kWhy", v.code === "danger"
      ? "물이 끓으면 수증기가 생깁니다. 나갈 곳이 없으면 압력이 올라갑니다."
    : v.code === "cold" ? "물이 너무 많거나 발열 팩이 모자랍니다."
    : v.code === "short" ? "온도는 닿았지만 금방 식습니다. 보온을 바꿔 보세요."
    : "70 ℃ 이상이 " + v.hold.toFixed(0) + "분 유지됩니다.");
  setTxt("sPacks", st.packs + "개");
  setTxt("sWater", st.water + " mL");
}

function sync() {
  var vis = SHOW[st.tab], el, i;
  el = document.querySelectorAll(".only-six");
  for (i = 0; i < el.length; i++) el[i].style.display = vis.six ? "block" : "none";
  el = document.querySelectorAll(".only-cook");
  for (i = 0; i < el.length; i++) el[i].style.display = vis.cook ? "block" : "none";
  var tb = document.querySelectorAll(".tabb");
  for (i = 0; i < tb.length; i++)
    tb[i].setAttribute("aria-pressed", tb[i].dataset.tab === st.tab ? "true" : "false");

  /* 탭 ① */
  var cb = document.querySelectorAll(".cardb");
  for (i = 0; i < cb.length; i++) {
    cb[i].setAttribute("aria-pressed", cb[i].dataset.card === st.card ? "true" : "false");
    cb[i].className = "seg cardb" + (answered(cb[i].dataset.card) ? " is-done" : "");
  }
  var pb = document.querySelectorAll(".pickb");
  for (i = 0; i < pb.length; i++) {
    var g = pb[i].dataset.grp, vv = pb[i].dataset.val;
    var cur = (g === "phys") ? st.pickPhys : st.pickRel;
    pb[i].setAttribute("aria-pressed", cur === vv ? "true" : "false");
    pb[i].disabled = answered(st.card);
  }
  $("okBtn").disabled = answered(st.card) || st.pickPhys === null || st.pickRel === null;
  setTxt("doneCount", answeredCount() + "");

  /* ★ 정답 게이팅 — 제출 전에는 화면 어디에도 정답이 없다 (매뉴얼 §13 ③) */
  var c = chgById(st.card);
  var res = $("resultBox");
  if (st.tab === "six" && answered(st.card)) {
    var a = st.answer[st.card];
    var okP = (a.physical === c.physical), okR = (a.release === c.release);
    res.style.display = "block";
    res.className = "note " + (okP && okR ? "note--ok" : "note--warn");
    res.innerHTML =
      "<b>" + c.name + "</b> — " + (c.physical ? "물리 변화" : "화학 변화") + " · " +
      (c.release ? "에너지 방출" : "에너지 흡수") + "<br>" +
      "여러분의 답: " + (a.physical ? "물리" : "화학") + " · " + (a.release ? "방출" : "흡수") +
      " → <b>" + (okP && okR ? "맞았습니다" : (okP || okR ? "반만 맞았습니다" : "다시 보세요")) + "</b>";
  } else res.style.display = "none";

  /* 2×2 표 — 제출한 것만 채운다 */
  var cells = { pr: [], pa: [], cr: [], ca: [] };
  for (i = 0; i < CHG.length; i++) {
    var x = CHG[i];
    if (!answered(x.id)) continue;
    cells[(x.physical ? "p" : "c") + (x.release ? "r" : "a")].push(x.name);
  }
  ["pr", "pa", "cr", "ca"].forEach(function (k) {
    setTxt("cell_" + k, cells[k].length ? cells[k].join(" · ") : "—");
  });

  syncCook();
  setTxt("stageCap", st.tab === "six"
    ? (answered(st.card)
        ? "화살표의 «방향»을 보세요. 그리고 왼쪽 상자 안의 막대가 어느 쪽으로 움직였는지도."
        : "오른쪽에서 두 가지를 고르고 「제출」을 누르면 이 화면에 답이 나타납니다.")
    : "발열 팩·물·보온을 바꿔 가며 «불 없이» 70 ℃ 이상을 15분 유지할 방법을 찾아보세요.");
  draw();
}

/* ---------- 배선 ---------- */
var tbs = document.querySelectorAll(".tabb");
for (var ti = 0; ti < tbs.length; ti++) tbs[ti].addEventListener("click", function () {
  st.tab = this.dataset.tab; sync();
});
var cbs = document.querySelectorAll(".cardb");
for (var ci = 0; ci < cbs.length; ci++) cbs[ci].addEventListener("click", function () {
  st.card = this.dataset.card; st.pickPhys = null; st.pickRel = null; sync();
});
var pbs = document.querySelectorAll(".pickb");
for (var pi = 0; pi < pbs.length; pi++) pbs[pi].addEventListener("click", function () {
  if (this.dataset.grp === "phys") st.pickPhys = this.dataset.val;
  else st.pickRel = this.dataset.val;
  sync();
});
$("okBtn").addEventListener("click", function () {
  st.answer[st.card] = { physical: st.pickPhys === "phys", release: st.pickRel === "rel" };
  sync();
});
$("clrBtn").addEventListener("click", function () {
  st.answer = {}; st.pickPhys = null; st.pickRel = null; sync();
});

$("packs").addEventListener("input", function () {
  st.packs = parseInt(this.value, 10); st.t = 0; st.running = false; sync();
});
$("water").addEventListener("input", function () {
  st.water = parseInt(this.value, 10); st.t = 0; st.running = false; sync();
});
var ibs = document.querySelectorAll(".insb");
for (var ii = 0; ii < ibs.length; ii++) ibs[ii].addEventListener("click", function () {
  st.insul = this.dataset.ins; st.t = 0; st.running = false;
  var a = document.querySelectorAll(".insb");
  for (var j = 0; j < a.length; j++)
    a[j].setAttribute("aria-pressed", a[j].dataset.ins === st.insul ? "true" : "false");
  sync();
});
$("sealChk").addEventListener("change", function () {
  st.sealed = this.checked; st.t = 0; st.running = false; sync();
});
$("runBtn").addEventListener("click", function () {
  if (st.t >= st.tmax || (!st.running && st.t > 0)) { st.t = 0; }
  st.running = !st.running;
  if (RM && st.running) {
    var v = hpVerdict(st.packs, st.water, st.sealed, st.insul);
    st.t = (v.code === "danger") ? 1.5 : st.tmax; st.running = false;
  }
  this.textContent = st.running ? "멈춤" : "실험 시작";
  sync();
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
window.HFVIEW = { st: st, sync: sync };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    CHG: CHG, chgById: chgById, chgIsPhysical: chgIsPhysical, chgIsRelease: chgIsRelease,
    HP: HP, hpMolCaO: hpMolCaO, hpHeatJ: hpHeatJ, hpPeakTemp: hpPeakTemp,
    hpAntoinePmmHg: hpAntoinePmmHg, hpSealedPressureAtm: hpSealedPressureAtm,
    hpHoldMinutes: hpHoldMinutes, hpTempAt: hpTempAt, hpVerdict: hpVerdict, hpCoolK: hpCoolK
  };
