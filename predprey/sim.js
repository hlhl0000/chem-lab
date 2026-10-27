/* 개체군 변동과 생태계평형 (predprey) — 설계지시안_개체군변동_v2.3
   구성: CORE(계산부 · 검증스크립트/predprey_core.js 와 문자 단위 동일) · ART(Astra 납품 그림 모듈 · 검증스크립트/_predprey_fx/predprey_art.part.js 와 바이트 동일 — 수정 금지) · UI(검증스크립트/_predprey_ui.part.js)
   이 파일은 검증스크립트/_predprey_assemble.js 의 산출물이다 — 고칠 때는 core·ui.part 를 고치고 다시 조립한다 */
/* ==== CORE BEGIN ==== */
/* 개체군 변동과 생태계평형 — 계산부(단일 원천 · 설계지시안_개체군변동_v2.3 §3 단계 1)
   풀 G' = u·K/K0 + rG(1−G/K) − cRs · 토끼 R' = (a+m0)sR − m0R − bRF · 여우 F' = dRF − gF · s = G/(G+h)
   RK4 하위 단계 0.005년 · 1마리 미만 = 0. 정본 = 이 파일 + _predprey_ui.part.js → _predprey_assemble.js 로 sim.js 조립(sim.js 를 직접 고치지 않는다) */
var PP_B = { r: 0.5, K: 10000, h: 300, c: 2, u: 20, a: 0.8, m0: 0.3, b: 0.8 / 30, d: 0.4 / 200, g: 0.4, R0: 150, F0: 15 };
var PP_DT = 0.005, PP_REC = 0.25;            /* 적분 하위 단계 · 기록 간격(년) */
var PP_T_BASE = 60, PP_AFTER = 40;          /* 개입이 없으면 60년 · 개입(잡기·가뭄) 뒤 40년 */
var PP_PER_ICON = 5, PP_RABBIT_CAP = 1600;  /* 그림 하나 = 5마리(두 종 같음) */
var PP_DRY = { weak: 1500, strong: 200, len: 8 };
/* ③ 변인 3단 — 각 변인에 기본값이 정확히 1칸(b·d는 첫 칸 · 나머지는 가운데) */
var PP_VARS = [
  { key: 'a', name: '토끼 출생률', vals: [0.2, 0.8, 1.2] },
  { key: 'b', name: '토끼가 먹히는 정도', vals: [0.8 / 30, 1.6 / 30, 2.4 / 30] },
  { key: 'R0', name: '처음 토끼 수', vals: [50, 150, 300] },
  { key: 'd', name: '여우 출생률', vals: [0.4 / 200, 0.8 / 200, 1.2 / 200] },
  { key: 'g', name: '여우 사망률', vals: [0.3, 0.4, 0.6] },
  { key: 'F0', name: '처음 여우 수', vals: [10, 15, 25] }
];

function ppParams(over) {
  var P = {}, k;
  for (k in PP_B) if (PP_B.hasOwnProperty(k)) P[k] = PP_B[k];
  if (over) for (k in over) if (over.hasOwnProperty(k)) P[k] = over[k];
  return P;
}
function PPEco(over) { this.P = ppParams(over); this.reset(); }
PPEco.prototype.reset = function () {
  this.t = 0; this.G = this.P.K; this.R = this.P.R0; this.F = this.P.F0;
  this.hist = [[0, this.G, this.R, this.F]]; this.killed = false; this.killT = null; this.drought = null; this.maxR = this.R;
};
PPEco.prototype.Kt = function () { var d = this.drought; return d && this.t >= d.t0 - 1e-9 && this.t < d.t1 - 1e-9 ? d.K : this.P.K; };
PPEco.prototype.inDrought = function () { var d = this.drought; return !!(d && this.t >= d.t0 - 1e-9 && this.t < d.t1 - 1e-9); };
PPEco.prototype.rhs = function (G, R, F, K) {
  var P = this.P, s = G / (G + P.h);
  return [P.u * K / P.K + P.r * G * (1 - G / K) - P.c * R * s, (P.a + P.m0) * s * R - P.m0 * R - P.b * R * F, P.d * R * F - P.g * F];
};
PPEco.prototype.flux = function () {
  var P = this.P, s = this.G / (this.G + P.h);
  return { s: s, bR: (P.a + P.m0) * s * this.R, pred: P.b * this.R * this.F, dR: P.m0 * this.R, bF: P.d * this.R * this.F, dF: P.g * this.F };
};
PPEco.prototype.kill = function () { if (!this.killed) { this.F = 0; this.killed = true; this.killT = this.t; } };
PPEco.prototype.startDrought = function (K) { if (!this.drought) this.drought = { t0: this.t, t1: this.t + PP_DRY.len, K: K }; };
/* 끝 시각: 개입이 있으면 개입 해 + 40년(사용자 결정) · 없으면 60년 */
PPEco.prototype.endT = function () {
  if (this.killT != null) return this.killT + PP_AFTER;
  if (this.drought) return this.drought.t0 + PP_AFTER;
  return PP_T_BASE;
};
PPEco.prototype.step = function (yrs) {
  var end = this.endT(), n, dt, i, K, G, R, F, k1, k2, k3, k4, last;
  yrs = Math.min(yrs, end - this.t); if (yrs <= 1e-12) return;
  n = Math.max(1, Math.ceil(yrs / PP_DT - 1e-9)); dt = yrs / n;
  for (i = 0; i < n; i++) {
    K = this.Kt(); G = this.G; R = this.R; F = this.F;
    k1 = this.rhs(G, R, F, K); k2 = this.rhs(G + dt / 2 * k1[0], R + dt / 2 * k1[1], F + dt / 2 * k1[2], K);
    k3 = this.rhs(G + dt / 2 * k2[0], R + dt / 2 * k2[1], F + dt / 2 * k2[2], K); k4 = this.rhs(G + dt * k3[0], R + dt * k3[1], F + dt * k3[2], K);
    this.G = Math.max(0, G + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
    this.R = R + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    this.F = F + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (this.R < 1) this.R = 0; if (this.F < 1) this.F = 0;
    this.t += dt; this.maxR = Math.max(this.maxR, this.R);
    last = this.hist[this.hist.length - 1];
    if (this.t - last[0] >= PP_REC - 1e-9) this.hist.push([Math.round(this.t * 1000) / 1000, this.G, this.R, this.F]);
  }
};
PPEco.prototype.done = function () { return this.t >= this.endT() - 1e-9; };

/* 봉우리 = 기록에서 앞뒤보다 큰 점(다음 기록이 있어야 확정) · i: 2 토끼 3 여우 */
function ppPeaks(hist, i) {
  var p = [], k;
  for (k = 1; k < hist.length - 1; k++) if (hist[k][i] > hist[k - 1][i] && hist[k][i] >= hist[k + 1][i] && hist[k][i] >= 1) p.push(hist[k]);
  return p;
}
/* 그림 수 = 올림(마릿수/5) · 1마리라도 있으면 그림 1 */
function ppIcons(n, cap) { return n >= 1 ? Math.min(cap, Math.ceil(n / PP_PER_ICON)) : 0; }
/* ① 잡기 하한: 첫 토끼 봉우리가 지난 뒤부터(사용자 결정) */
function ppCanKill(e) { return !e.killed && ppPeaks(e.hist, 2).length >= 1; }
/* 기준선 = 여우 있는 섬(기본값) 토끼 평균 20~100년 */
var ppBaselineCache = null;
function ppBaseline() {
  if (ppBaselineCache != null) return ppBaselineCache;
  var e = new PPEco(), s = 0, n = 0, i;
  e.endT = function () { return 100; }; e.step(100);
  for (i = 0; i < e.hist.length; i++) if (e.hist[i][0] > 20) { s += e.hist[i][2]; n++; }
  ppBaselineCache = s / n; return ppBaselineCache;
}
/* 개입 뒤 마지막 15년 토끼 평균(결과 창 · 미션 ①) — from = 개입 시각 */
function ppTailMean(e, yrs, from) {
  var t1 = Math.max(e.t - (yrs || 15), from == null ? -1 : from), s = 0, n = 0, i;   /* 창은 개입 시각 앞으로 넘어가지 않는다 */
  for (i = 0; i < e.hist.length; i++) if (e.hist[i][0] >= t1) { s += e.hist[i][2]; n++; }
  return n ? s / n : NaN;
}
/* 여우 0 이 이어진 가장 긴 기간(년) — 기준 시각 이후 */
function ppZeroRun(e, from) {
  var run = 0, best = 0, i;
  for (i = 0; i < e.hist.length; i++) { if (e.hist[i][0] < from) continue; run = e.hist[i][3] === 0 ? run + PP_REC : 0; if (run > best) best = run; }
  return best;
}

/* 단서 표(§3 단계 1) — 문구는 무대 상태 서술 · 술어는 상태만(시간 술어 0) · ctx.base = 기준 섬(③) */
var PP_CLUES = [
  [ { text: '여우가 섬에서 모두 사라졌다', test: function (e) { return e.killed && e.F === 0; } },
    { text: '토끼가 2000마리 넘게 불어났다', test: function (e) { return e.killed && e.R > 2000; } },
    { text: '풀이 거의 다 없어졌다', test: function (e) { return e.killed && e.G < 0.05 * e.P.K; } },
    { text: '토끼 수가 가장 많을 때의 절반 아래로 줄었다', test: function (e) { return e.killed && e.maxR > 2000 && e.R < 0.5 * e.maxR; } } ],
  [ { text: '토끼 수가 가장 많아졌다가 줄기 시작했다', test: function (e) { return ppPeaks(e.hist, 2).length >= 1; } },
    { text: '토끼가 가장 많아진 뒤에 여우가 가장 많아졌다', test: function (e) { var a = ppPeaks(e.hist, 2), b = ppPeaks(e.hist, 3), i; if (!a.length) return false; for (i = 0; i < b.length; i++) if (b[i][0] > a[0][0]) return true; return false; } },
    { text: '여우가 많아지자 토끼가 줄었다', test: function (e) { var a = ppPeaks(e.hist, 2), b = ppPeaks(e.hist, 3), i, j; if (!a.length) return false; for (i = 0; i < b.length; i++) if (b[i][0] > a[0][0]) { for (j = 0; j < e.hist.length; j++) if (e.hist[j][0] > b[i][0] && e.hist[j][2] < 0.6 * a[0][2]) return true; return false; } return false; } },
    { text: '토끼 수가 늘었다 줄기를 세 번 되풀이했다', test: function (e) { return ppPeaks(e.hist, 2).length >= 3; } } ],
  [ { text: '바꾼 섬에서 토끼 수가 처음으로 가장 많아졌다', test: function (e) { return ppPeaks(e.hist, 2).length >= 1; } },
    { text: '바꾼 섬에서 토끼 수가 두 번째로 가장 많아졌다 — 그 사이 시간이 주기다', test: function (e) { return ppPeaks(e.hist, 2).length >= 2; } },
    { text: '바꾼 섬에서 여우 수도 두 번 가장 많아졌다', test: function (e) { return ppPeaks(e.hist, 3).length >= 2; } },
    { text: '기준 섬에서도 토끼 수가 두 번 가장 많아졌다 — 두 섬을 비교할 수 있다', test: function (e, ctx) { return !!(ctx && ctx.base) && ppPeaks(ctx.base.hist, 2).length >= 2; } } ],
  [ { text: '가뭄 동안 풀이 크게 줄었다', test: function (e) { return e.inDrought() && e.G < 0.3 * e.P.K; } },
    { text: '가뭄이 끝난 뒤 토끼 수가 다시 가장 많아졌다', test: function (e) { var d = e.drought, p, i; if (!d) return false; p = ppPeaks(e.hist, 2); for (i = 0; i < p.length; i++) if (p[i][0] > d.t1) return true; return false; } },
    /* 약·강 둘 다 해야 미션 완료(사용자 결정 10-25) — ④ 수첩은 [처음부터] 뒤에도 남는다(UI) */
    { text: '약한 가뭄 뒤 여우 수가 다시 늘었다', test: function (e) { var d = e.drought, i; if (!d || d.K !== PP_DRY.weak || e.t < d.t1 + 3) return false; for (i = 0; i < e.hist.length; i++) if (e.hist[i][0] >= d.t1 + 3 && e.hist[i][3] > 20) return true; return false; } },
    { text: '센 가뭄 뒤 여우가 사라지고 돌아오지 않았다', test: function (e) { var d = e.drought; return !!d && d.K === PP_DRY.strong && e.t >= d.t1 + 3 && ppZeroRun(e, d.t1 + 3) >= 10; } } ]
];
/* 단서 판정: found 에 처음 참이 된 시각을 적는다(한 번 찾으면 유지) */
function ppCheckClues(m, e, found, ctx) {
  var list = PP_CLUES[m], ch = false, i;
  for (i = 0; i < list.length; i++) if (found[i] == null && list[i].test(e, ctx)) { found[i] = Math.round(e.t * 10) / 10; ch = true; }
  return ch;
}
/* 미션 ④ 결과 창의 갈림 — 단서 ④-3·④-4와 같은 상태 술어(가뭄 세기를 보지 않음 · S-검토 2R A1).
   'gone' = 여우 0(1마리 규칙 — 다시 늘지 않는다) · 'back' = 가뭄 끝 3년 뒤 여우 > 20 기록 있음 · 'wait' = 아직 판단 못 함 · null = 가뭄 전·중 */
function ppDroughtVerdict(e) {
  var d = e.drought, i; if (!d) return null;
  if (e.F === 0) return 'gone';
  if (e.t < d.t1) return null;
  for (i = 0; i < e.hist.length; i++) if (e.hist[i][0] >= d.t1 + 3 && e.hist[i][3] > 20) return 'back';
  return 'wait';
}
/* 미션 ① 평균 비교 — 실행이 끝났을 때만 값(잡은 뒤 25~40년 = 검사군 C 의 창 · S-검토 2R A2 · 사용자 결정 27) */
function ppKillCompare(e) {
  if (!e.killed || !e.done()) return null;
  return { post: ppTailMean(e, 15, e.killT), base: ppBaseline() };
}
/* ==== CORE END ==== */

/* ==== ART BEGIN ==== */
(function () {
  'use strict';

  var TAU = 6.283185307179586;
  var rabbitCache = {};
  var foxCache = {};
  var rabbitCount = 0;
  var foxCount = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function hash(seed) {
    var x = (num(seed, 0) * 9301 + 49297) % 233280;
    return x < 0 ? x + 233280 : x;
  }
  function variant(seed) { return hash(seed) % 4; }
  function bucket(size) {
    var s = clamp(num(size, 16), 6, 96);
    if (s <= 18) return Math.round(s / 2) * 2;
    if (s <= 40) return Math.round(s / 4) * 4;
    return Math.round(s / 8) * 8;
  }
  function qtime(t) { return Math.round(clamp(num(t, 0), 0, 1) * 5); }
  function ellipse(c, x, y, rx, ry, rot) {
    c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); c.fill();
  }
  function line(c, x1, y1, x2, y2) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  function poly(c, p) {
    var i;
    c.beginPath(); c.moveTo(p[0], p[1]);
    for (i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.closePath(); c.fill();
  }
  function mix(a, b, t) {
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    var r = ((A >> 16) * (1 - t) + (B >> 16) * t) | 0;
    var g = (((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t) | 0;
    var bl = ((A & 255) * (1 - t) + (B & 255) * t) | 0;
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function makeCanvas(w, h) {
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(w); cv.height = Math.ceil(h);
    return cv;
  }

  function background(ctx, W, H, s) {
    var t = num(s && s.t, 0), g, i, y, drift;
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#d8eef1'); g.addColorStop(0.44, '#b9dfe4'); g.addColorStop(1, '#8fc7cf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = '#eef9f7'; ctx.lineWidth = 1.3;
    for (i = 0; i < 7; i++) {
      y = H * (0.14 + i * 0.115); drift = Math.sin(t * 0.25 + i * 1.7) * 7;
      ctx.beginPath(); ctx.moveTo(W * 0.04 + drift, y);
      ctx.bezierCurveTo(W * 0.28, y - 4, W * 0.45, y + 5, W * 0.66, y);
      ctx.bezierCurveTo(W * 0.78, y - 3, W * 0.88, y + 3, W * 0.96, y); ctx.stroke();
    }
    ctx.restore();
  }

  function island(ctx, cx, cy, rx, ry, s) {
    var grass = clamp(num(s && s.grass, 0.7), 0, 1);
    var dry = clamp(num(s && s.dry, 0), 0, 1), thick = rx * 0.045;
    var topBare = mix('#cbb684', '#d4ad68', dry), lush = mix('#72a75b', '#a7904e', dry);
    var sideTop = mix('#8d7048', '#9c7044', dry), sideBottom = mix('#65513b', '#6e4932', dry);
    var g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry + thick), i, a, px, py, len;
    g.addColorStop(0, sideTop); g.addColorStop(1, sideBottom);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + thick, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = topBare; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
    if (grass > 0.01) {
      g = ctx.createRadialGradient(cx - rx * 0.18, cy - ry * 0.22, rx * 0.08, cx, cy, rx);
      g.addColorStop(0, mix('#91bd68', '#c2a662', dry)); g.addColorStop(1, lush);
      ctx.save(); ctx.globalAlpha = 0.14 + grass * 0.76; ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.985, ry * 0.975, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = dry > 0.35 ? '#715238' : '#536e42';
    for (i = 0; i < 18; i++) {
      a = i * 2.39996; px = cx + Math.cos(a) * rx * (0.18 + (i % 7) * 0.095);
      py = cy + Math.sin(a) * ry * (0.15 + (i % 5) * 0.13);
      ellipse(ctx, px, py, 1.6 + i % 3, 0.7 + i % 2, a);
    }
    ctx.restore();
    if (dry > 0.3) {
      ctx.save(); ctx.globalAlpha = (dry - 0.3) * 0.65; ctx.strokeStyle = '#775335'; ctx.lineWidth = Math.max(0.8, rx / 230);
      for (i = 0; i < 13; i++) {
        a = i * 2.12; px = cx + Math.cos(a) * rx * (0.12 + (i % 5) * 0.13);
        py = cy + Math.sin(a * 1.31) * ry * 0.62; len = rx * (0.035 + (i % 4) * 0.008);
        ctx.beginPath(); ctx.moveTo(px - len, py - len * 0.12); ctx.lineTo(px, py + len * 0.17);
        ctx.lineTo(px + len * 0.55, py - len * 0.07); ctx.moveTo(px, py + len * 0.17);
        ctx.lineTo(px - len * 0.12, py + len * 0.48); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#fff7d6'; ctx.lineWidth = Math.max(1, rx / 180);
    ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.03, rx * 0.985, ry * 0.96, 0, Math.PI * 1.08, Math.PI * 1.87); ctx.stroke(); ctx.restore();
  }

  function grass(ctx, x, y, size, s) {
    var amount = clamp(num(s && s.amount, 1), 0, 1);
    var dry = clamp(num(s && s.dry, 0), 0, 1), seed = num(s && s.seed, 0), t = num(s && s.t, 0);
    var i, off, h, sway, base = mix('#2f7d43', '#a27a35', dry), light = mix('#64a950', '#c39b4e', dry);
    if (amount <= 0) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, size * 0.105);
    for (i = 0; i < 6; i++) {
      off = (i - 2.5) * size * 0.13; h = size * amount * (0.54 + ((hash(seed + i * 17) % 39) / 100));
      sway = Math.sin(t * 0.8 + i + seed * 0.13) * size * 0.055 + (i - 2.5) * size * 0.045;
      ctx.strokeStyle = i % 2 ? light : base; ctx.beginPath(); ctx.moveTo(x + off, y);
      ctx.quadraticCurveTo(x + off + sway * 0.35, y - h * 0.52, x + off + sway, y - h); ctx.stroke();
    }
    ctx.fillStyle = dry > 0.55 ? '#8a6735' : '#386b38'; ellipse(ctx, x, y, size * 0.44, Math.max(0.8, size * 0.08), 0); ctx.restore();
  }

  function rabbitSprite(size, state, frame, seed, qt) {
    var v = variant(seed), key = state + '|' + frame + '|' + size + '|' + v + '|' + qt;
    var cv = rabbitCache[key], c, S, baseY, p, thin, lie, fade, hop, born, crouch, body, dark, earDroop;
    if (cv) return cv;
    S = size; cv = makeCanvas(S * 2.5, S * 2.45); c = cv.getContext('2d'); baseY = cv.height - S * 0.15;
    p = qt / 5; thin = state === 'starve' ? clamp(p / 0.65, 0, 1) : 0;
    lie = state === 'starve' && p >= 0.6; fade = state === 'caught' ? 1 - p : state === 'starve' && p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;
    hop = state === 'walk' ? frame * S * 0.09 : 0; born = state === 'born' ? 0.78 + p * 0.22 : 1;
    crouch = state === 'caught' ? 1 - p * 0.34 : 1;
    body = state === 'caught' ? '#7d7d7d' : mix(v % 2 ? '#8f806d' : '#9c8b76', '#777b7a', thin * 0.82);
    dark = state === 'caught' ? '#626262' : mix('#665b50', '#626868', thin);
    c.save(); c.globalAlpha = clamp(fade, 0, 1); c.translate(cv.width * 0.5, baseY - hop); c.scale(born, born * crouch);
    if (lie) c.rotate(1.18);
    c.fillStyle = 'rgba(38,48,42,0.18)'; ellipse(c, 0, hop, S * 0.49, S * 0.11, 0);
    c.fillStyle = body;
    if (state === 'eat') {
      ellipse(c, -S * 0.08, -S * 0.39, S * 0.46, S * (0.27 - thin * 0.06), -0.06);
      ellipse(c, S * 0.41, -S * 0.27, S * 0.21, S * 0.19, 0.28);
    } else {
      ellipse(c, -S * 0.08, -S * 0.42, S * 0.47, S * (0.29 - thin * 0.075), -0.04);
      ellipse(c, S * 0.34, -S * 0.64, S * 0.22, S * 0.21, 0);
    }
    c.fillStyle = state === 'caught' ? '#d8d8d8' : '#e7e1d4'; ellipse(c, -S * 0.5, -S * 0.43, S * 0.125, S * 0.12, 0);
    c.fillStyle = dark; earDroop = state === 'starve' ? 0.68 + p * 0.35 : 0;
    if (state === 'eat') {
      ellipse(c, S * 0.42, -S * 0.55, S * 0.07, S * 0.23, 1.02);
      ellipse(c, S * 0.53, -S * 0.51, S * 0.065, S * 0.21, 1.12);
    } else {
      ellipse(c, S * 0.25, -S * 0.98, S * 0.075, S * 0.29, -0.13 + earDroop);
      ellipse(c, S * 0.43, -S * 0.96, S * 0.072, S * 0.28, 0.14 + earDroop);
    }
    c.fillStyle = '#383b38'; ellipse(c, S * 0.43, state === 'eat' ? -S * 0.3 : -S * 0.68, Math.max(1, S * 0.034), Math.max(1, S * 0.038), 0);
    c.strokeStyle = dark; c.lineWidth = Math.max(1, S * 0.075); c.lineCap = 'round';
    if (!lie) {
      line(c, -S * 0.22, -S * 0.22, -S * 0.28 - frame * S * 0.08, 0);
      line(c, S * 0.2, -S * 0.22, S * 0.32 + frame * S * 0.07, 0);
    }
    c.restore(); rabbitCache[key] = cv; rabbitCount += 1; return cv;
  }

  function rabbit(ctx, x, y, size, s) {
    var state = s && s.state ? s.state : 'walk', frame = s && s.frame ? 1 : 0, dir = s && s.dir < 0 ? -1 : 1;
    var b = bucket(size), cv = rabbitSprite(b, state, frame, s && s.seed, qtime(s && s.t)), scale = size / b;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * scale, scale); ctx.drawImage(cv, -cv.width * 0.5, -cv.height + b * 0.15); ctx.restore();
  }

  function foxSprite(size, state, frame, seed, qt) {
    var v = variant(seed), key = state + '|' + frame + '|' + size + '|' + v + '|' + qt;
    var cv = foxCache[key], c, S, by, p, thin, lie, fade, lift, born, body, dark, white, stretch, step;
    if (cv) return cv;
    S = size; cv = makeCanvas(S * 3.1, S * 2.25); c = cv.getContext('2d'); by = cv.height - S * 0.16; p = qt / 5;
    thin = state === 'starve' ? clamp(p / 0.65, 0, 1) : 0; lie = state === 'starve' && p >= 0.6;
    fade = state === 'starve' && p > 0.82 ? 1 - (p - 0.82) / 0.18 : state === 'captured' ? 1 - p * 0.65 : 1;
    lift = state === 'captured' ? p * S * 0.52 : 0; born = state === 'born' ? 0.76 + p * 0.24 : 1;
    body = mix(v % 2 ? '#c96f32' : '#d77b35', '#797d7b', thin * 0.86); dark = mix('#754632', '#626766', thin); white = '#eee8d8';
    stretch = state === 'pounce' ? 1.26 : 1; step = state === 'walk' ? (frame ? S * 0.1 : -S * 0.07) : state === 'pounce' ? -S * 0.13 : 0;
    c.save(); c.globalAlpha = clamp(fade, 0, 1); c.translate(cv.width * 0.5, by - lift); c.scale(born, born); if (lie) c.rotate(1.2);
    c.fillStyle = 'rgba(42,45,38,0.19)'; ellipse(c, 0, lift, S * 0.66, S * 0.1, 0);
    c.strokeStyle = body; c.lineWidth = Math.max(2, S * 0.22); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-S * 0.32, -S * 0.49); c.quadraticCurveTo(-S * 0.88, -S * 0.78, -S * 1.0, -S * 0.39); c.stroke();
    c.strokeStyle = white; c.lineWidth = Math.max(1.8, S * 0.15); line(c, -S * 0.89, -S * 0.52, -S * 1.0, -S * 0.39);
    if (state === 'captured') {
      c.fillStyle = body; ellipse(c, -S * 0.05, -S * 0.4, S * 0.31, S * 0.4, -0.08);
      ellipse(c, S * 0.08, -S * 0.78, S * 0.25, S * 0.22, 0);
      poly(c, [S * 0.2, -S * 0.84, S * 0.49, -S * 0.76, S * 0.2, -S * 0.64]);
      c.fillStyle = dark;
      poly(c, [-S * 0.06, -S * 0.91, S * 0.01, -S * 1.16, S * 0.12, -S * 0.91]);
      poly(c, [S * 0.13, -S * 0.92, S * 0.27, -S * 1.13, S * 0.3, -S * 0.86]);
      c.strokeStyle = dark; c.lineWidth = Math.max(1.5, S * 0.08); c.lineCap = 'round';
      line(c, -S * 0.04, -S * 0.32, -S * 0.04, -S * 0.02); line(c, S * 0.18, -S * 0.31, S * 0.18, -S * 0.02);
    } else {
      c.fillStyle = body; ellipse(c, -S * 0.05, -S * 0.48, S * 0.52 * stretch, S * (0.22 - thin * 0.055), -0.03);
      ellipse(c, S * (state === 'pounce' ? 0.55 : 0.42), -S * 0.68, S * 0.25, S * 0.22, 0);
      poly(c, [S * 0.56, -S * 0.73, S * 0.92, -S * 0.62, S * 0.58, -S * 0.5]);
      c.fillStyle = dark;
      poly(c, [S * 0.29, -S * 0.83, S * 0.35, -S * 1.14, S * 0.48, -S * 0.83]);
      poly(c, [S * 0.48, -S * 0.83, S * 0.61, -S * 1.09, S * 0.66, -S * 0.77]);
      c.strokeStyle = dark; c.lineWidth = Math.max(1.5, S * 0.1); c.lineCap = 'round';
      if (!lie) {
        line(c, -S * 0.28, -S * 0.31, -S * 0.34 + step, 0);
        line(c, S * 0.26, -S * 0.3, S * 0.3 - step, 0);
      }
    }
    c.fillStyle = '#343733';
    if (state === 'captured') {
      ellipse(c, S * 0.49, -S * 0.76, Math.max(1, S * 0.036), Math.max(1, S * 0.033), 0);
      ellipse(c, S * 0.16, -S * 0.81, Math.max(1, S * 0.032), Math.max(1, S * 0.037), 0);
    } else {
      ellipse(c, S * 0.92, -S * 0.62, Math.max(1, S * 0.036), Math.max(1, S * 0.033), 0);
      ellipse(c, S * 0.54, -S * 0.71, Math.max(1, S * 0.032), Math.max(1, S * 0.037), 0);
    }
    if (state === 'captured') {
      c.strokeStyle = '#725333'; c.lineWidth = Math.max(1.5, S * 0.055); c.strokeRect(-S * 0.82, -S * 1.18, S * 1.75, S * 1.18);
      c.strokeStyle = '#59646a'; c.lineWidth = Math.max(1, S * 0.035);
      line(c, -S * 0.54, -S * 1.15, -S * 0.54, -S * 0.03); line(c, -S * 0.24, -S * 1.15, -S * 0.24, -S * 0.03);
      line(c, S * 0.06, -S * 1.15, S * 0.06, -S * 0.03); line(c, S * 0.36, -S * 1.15, S * 0.36, -S * 0.03); line(c, S * 0.66, -S * 1.15, S * 0.66, -S * 0.03);
    }
    c.restore(); foxCache[key] = cv; foxCount += 1; return cv;
  }

  function fox(ctx, x, y, size, s) {
    var state = s && s.state ? s.state : 'walk', frame = s && s.frame ? 1 : 0, dir = s && s.dir < 0 ? -1 : 1;
    var b = bucket(size), cv = foxSprite(b, state, frame, s && s.seed, qtime(s && s.t)), scale = size / b;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * scale, scale); ctx.drawImage(cv, -cv.width * 0.5, -cv.height + b * 0.16); ctx.restore();
  }

  function puff(ctx, x, y, size, t) {
    var p = clamp(num(t, 0), 0, 1), i, a, r = size * (0.2 + p * 0.58);
    ctx.save(); ctx.globalAlpha = (1 - p) * 0.58; ctx.fillStyle = '#a9aaa5';
    for (i = 0; i < 7; i++) { a = i * TAU / 7; ellipse(ctx, x + Math.cos(a) * r * 0.55, y - r * 0.3 + Math.sin(a) * r * 0.35, r * 0.34, r * 0.28, a); }
    ctx.restore();
  }
  function sparkle(ctx, x, y, size, t) {
    var p = clamp(num(t, 0), 0, 1), i, a, r = size * (0.25 + p * 0.55);
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#f2b94b'; ctx.lineWidth = Math.max(1, size * 0.06); ctx.lineCap = 'round';
    for (i = 0; i < 6; i++) { a = i * TAU / 6; line(ctx, x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.restore();
  }
  function sun(ctx, x, y, size, t) {
    var i, a, wobble = Math.sin(num(t, 0) * 0.7) * size * 0.025;
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#d89a2b'; ellipse(ctx, x, y, size * 0.66 + wobble, size * 0.66 + wobble, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = '#edb83e'; ellipse(ctx, x, y, size * 0.42, size * 0.42, 0);
    ctx.strokeStyle = '#d28b24'; ctx.lineWidth = Math.max(1.5, size * 0.075); ctx.lineCap = 'round';
    for (i = 0; i < 8; i++) { a = i * TAU / 8; line(ctx, x + Math.cos(a) * size * 0.56, y + Math.sin(a) * size * 0.56, x + Math.cos(a) * size * 0.78, y + Math.sin(a) * size * 0.78); }
    ctx.restore();
  }

  function escDigit(n) { var s = String(n); return /^[0-9]+$/.test(s) ? s : ''; }
  function clue(n, found) {
    var d = escDigit(n);
    if (found) return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#15803d"/><text x="12" y="16" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">' + d + '</text></svg>';
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#5f6b7a" stroke-width="2" stroke-dasharray="3 2"/><text x="12" y="16" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#5f6b7a">?</text></svg>';
  }
  function lock() { return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" fill="#5f6b7a"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#5f6b7a" stroke-width="2.3"/><circle cx="12" cy="15" r="1.6" fill="#fff"/></svg>'; }
  function done() { return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="10" r="8" fill="#b45309"/><path d="M8 10l2.5 2.5L16.5 7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 17l-1 6 5-3 5 3-1-6" fill="#1d4ed8"/></svg>'; }
  function notebook() { return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="3" width="13" height="18" rx="2" fill="#eef2ff" stroke="#1d4ed8" stroke-width="1.8"/><path d="M7 7h6M7 11h5M7 15h3" stroke="#5f6b7a" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="16" r="4" fill="none" stroke="#b45309" stroke-width="2"/><path d="M20 19l3 3" stroke="#b45309" stroke-width="2" stroke-linecap="round"/></svg>'; }

  window.PREDPREY_ART = {
    contract: 1,
    version: '1.0.0',
    background: background,
    island: island,
    grass: grass,
    rabbit: rabbit,
    fox: fox,
    puff: puff,
    sparkle: sparkle,
    sun: sun,
    svg: { clue: clue, lock: lock, done: done, notebook: notebook },
    info: function () { return { rabbitCacheEntries: rabbitCount, foxCacheEntries: foxCount }; }
  };
}());
/* ==== ART END ==== */

/* ================= UI — 무대·수첩·그래프 (설계지시안_개체군변동_v2.3 §3 단계 4) ================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var ART = window.PREDPREY_ART || null;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  /* 결정적 난수(배치·변형만 — 사건 수는 모형에서) */
  var seedS = 12345;
  function rnd() { seedS = (seedS * 1103515245 + 12345) & 0x7fffffff; return seedS / 0x7fffffff; }
  function inside(u, v) { var d = u * u + v * v; if (d < 0.6) return [u, v]; var k = Math.sqrt(0.6 / d); return [u * k, v * k]; }
  function inIsle() { for (;;) { var u = rnd() * 2 - 1, v = rnd() * 2 - 1; if (u * u + v * v < 0.66) return [u, v]; } }

  /* ---------------- 무대: 그림 = 모형의 값 · 사건 = 모형의 흐름 ---------------- */
  function World(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.rab = []; this.fox = []; this.fx = []; this.k = 2;
    this.acc = 0; this.stats = { predShown: 0, predReached: 0, minHold: 1e9, shortHold: 0, flushed: 0, holds: [] };
    this.tufts = []; for (var i = 0; i < 340; i++) { var p = inIsle(); this.tufts.push({ u: p[0], v: p[1], th: rnd(), seed: (rnd() * 1e6) | 0 }); }
  }
  function mkR(u, v, born) { return { u: u, v: v, hd: rnd() * 6.283, sp: 0.05 + rnd() * 0.04, grow: born ? 0.35 : 1, die: 0, why: '', ph: rnd() * 6, seed: (rnd() * 1e6) | 0 }; }
  function mkF(u, v, born) { return { u: u, v: v, hd: rnd() * 6.283, sp: 0.1 + rnd() * 0.05, grow: born ? 0.4 : 1, die: 0, why: '', chase: null, chT: 0, chB: 0, chV: 0, q: [], cage: 0, ph: rnd() * 6, seed: (rnd() * 1e6) | 0 }; }
  function liveR(r) { return !r.die && !r.doomed; }
  function liveF(f) { return !f.die && !f.cage; }
  World.prototype.count = function (arr, fn) { var n = 0; for (var i = 0; i < arr.length; i++) if (fn(arr[i])) n++; return n; };
  World.prototype.seed = function (e) {
    this.rab = []; this.fox = []; this.fx = []; this.acc = 0; this.stats = { predShown: 0, predReached: 0, minHold: 1e9, shortHold: 0, flushed: 0, holds: [] };
    var nR = ppIcons(e.R, PP_RABBIT_CAP), nF = ppIcons(e.F, 1e9), i, p;
    for (i = 0; i < nR; i++) { p = inIsle(); this.rab.push(mkR(p[0], p[1])); }
    for (i = 0; i < nF; i++) { p = inIsle(); this.fox.push(mkF(p[0], p[1])); }
  };
  /* 먹힘 한 건 = 먼지 하나(reached = 여우가 표적에 닿은 뒤) */
  World.prototype.puff = function (r, reached) { r.gone = true; this.fx.push({ u: r.u, v: r.v, a: 1 }); this.stats.predShown++; if (reached) this.stats.predReached++; };
  /* 여우가 잡히거나 굶어 죽는 순간 그 여우의 몫 = 모형이 이미 뺀 먹힘 → 먼지로 한꺼번에(flushed 로 따로 셈) */
  World.prototype.dropPrey = function (f) { var self = this; if (f.chase) { if (!f.chase.gone) { self.puff(f.chase); self.stats.flushed++; } f.chase = null; } f.q.forEach(function (r) { if (!r.gone) { self.puff(r); self.stats.flushed++; } }); f.q = []; };
  World.prototype.pending = function () { var n = 0; this.fox.forEach(function (f) { n += (f.chase && !f.chase.gone ? 1 : 0) + f.q.filter(function (r) { return !r.gone; }).length; }); return n; };
  /* 여우가 0이 되는 순간: 쫓던 표적·대기 표적은 모형이 이미 뺀 먹힘 몫 → 먼지와 함께 즉시 */
  World.prototype.flushPred = function () { var self = this; this.fox.forEach(function (f) { self.dropPrey(f); }); };
  World.prototype.sync = function (e) {
    var fl = e.flux(), tR = ppIcons(e.R, PP_RABBIT_CAP), tF = ppIcons(e.F, 1e9), i, p;
    var aR = this.count(this.rab, liveR), aF = this.count(this.fox, liveF);
    if (e.killed && e.F === 0) { var me = this; this.fox.forEach(function (f) { if (!f.cage && !f.die) { me.dropPrey(f); f.cage = 0.001; } }); }   /* 포획 순간 쫓던·기다리던 표적은 먼지로(모형이 이미 뺀 몫) */
    for (i = aR; i < tR; i++) { p = inIsle(); this.rab.push(mkR(p[0], p[1], true)); }   /* 새끼 토끼는 섬 아무 곳에서나 — 부모 곁에서만 태어나면 무리가 한쪽에 뭉친다(S-검토 3R B2 · 위치는 계산과 무관 — LIMITS ②) */
    var pr = fl.pred + fl.dR > 0 ? fl.pred / (fl.pred + fl.dR) : 0, starving = fl.s < 0.35;
    for (i = tR; i < aR; i++) {
      this.acc += pr;
      if (this.acc >= 1 - 1e-9) { this.acc -= 1; if (!this.prey()) break; }   /* 먹힘(누적 배정 — 속도와 무관) */
      else { var vic = this.pickR(); if (!vic) break; vic.die = 1; vic.why = starving ? 'starve' : 'old'; }
    }
    for (i = aF; i < tF; i++) { var pf = this.pickF(); p = pf ? inside(pf.u + (rnd() - 0.5) * 0.2, pf.v + (rnd() - 0.5) * 0.2) : inIsle(); this.fox.push(mkF(p[0], p[1], true)); }
    for (i = tF; i < aF; i++) { var fv = this.pickF(); if (!fv) break; fv.die = 1; fv.why = 'starve'; this.dropPrey(fv); }
    this.assign();
  };
  /* 먹힘 한 건 배정(S-검토 2R A3): 가장 한가한 여우 + 그 여우에 가장 가까운 토끼(무대 위치는 표현일 뿐 — LIMITS ②).
     한 여우가 맡는 몫은 «쫓는 1 + 기다리는 1»까지 — 넘치면 그 자리에서 먼지로 */
  World.prototype.prey = function () {
    var h = null, bl = 1e9, i, f, l;
    for (i = 0; i < this.fox.length; i++) { f = this.fox[i]; if (!liveF(f)) continue; l = (f.chase ? 1 : 0) + f.q.length; if (l < bl) { bl = l; h = f; } }
    var vic = h ? this.nearR(h.u, h.v) : this.pickR();
    if (!vic) return false;
    vic.doomed = true;
    if (!h || bl >= 2) { this.puff(vic, false); return true; }
    h.q.push(vic); this.assign(); return true;
  };
  /* 여우 곁(반경 0.18) 살아 있는 토끼 중 무작위 — 없으면 가장 가까운 토끼. 늘 «가장 가까운»만 고르면 무리가 한쪽으로 몰린다(S-검토 3R B2) */
  World.prototype.nearR = function (u, v) { var b = null, bd = 1e9, near = []; for (var i = 0; i < this.rab.length; i++) { var r = this.rab[i]; if (!liveR(r)) continue; var d = (r.u - u) * (r.u - u) + (r.v - v) * (r.v - v); if (d < 0.0324) near.push(r); if (d < bd) { bd = d; b = r; } } return near.length ? near[(rnd() * near.length) | 0] : b; };
  /* 추격 시간(실시간 초) = 느리게 0.5 · 보통·빠르게 0.3 — 그 안에 닿도록 속력을 거리 ÷ 시간으로.
     쫓기는 토끼는 모형에서 이미 빠진 그림이라 오래 보이면 «보이는 그림 수»가 모형보다 많아진다(capGhosts) */
  function chaseBudget(k) { return Math.max(0.3, Math.min(0.5, 0.6 / k)); }
  World.prototype.assign = function () {
    var live = this.count(this.fox, liveF), B = chaseBudget(this.k);
    if (live === 0) { this.flushPred(); return; }
    this.fox.forEach(function (f) { while (liveF(f) && !f.chase && f.q.length) { var r = f.q.shift(); if (r.gone) continue;
      if (RM) { f.u = r.u - 0.03; f.v = r.v; }   /* 움직임 줄이기: 이동 없이 표적 옆으로(S-검토 3R B4) */
      var du = r.u - f.u, dv = r.v - f.v; f.chase = r; f.chT = 0; f.chB = B; f.chV = Math.max(0.3, Math.sqrt(du * du + dv * dv) / (0.6 * B)); } });
  };
  World.prototype.pickR = function () { for (var k = 0; k < 40; k++) { var r = this.rab[(rnd() * this.rab.length) | 0]; if (r && liveR(r)) return r; } for (var i = 0; i < this.rab.length; i++) if (liveR(this.rab[i])) return this.rab[i]; return null; };
  World.prototype.pickF = function () { for (var i = 0; i < this.fox.length; i++) if (liveF(this.fox[i]) && !this.fox[i].chase) return this.fox[i]; for (i = 0; i < this.fox.length; i++) if (liveF(this.fox[i])) return this.fox[i]; return null; };
  /* dts = 실시간 초 · spd = 속도 배율(추격은 이동 포함 «실시간 ÷ 속도») · RM: 위치 갱신만 멈추고 사건 타이머는 진행 */
  World.prototype.move = function (dts, spd) {
    var self = this, k = spd || 1; this.k = k;
    function wander(a) { a.hd += (rnd() - 0.5) * 2.4 * dts; if (a.u * a.u + a.v * a.v > 0.66) a.hd = Math.atan2(-a.v, -a.u) + (rnd() - 0.5); a.u += Math.cos(a.hd) * a.sp * dts; a.v += Math.sin(a.hd) * a.sp * dts; a.ph += dts * 8; }
    /* 연출 시간 = 모형 0.3·0.4·0.6년, 단 실시간 0.25·0.8·0.3초보다 짧아지지 않게(S-검토 2R A3 — 빠르게에서도 보이도록) */
    var dieR = 1 / Math.max(0.3 / k, 0.25), cageR = 1.6 / Math.max(0.4 / k, 0.8), growR = 0.65 / Math.max(0.6 / k, 0.3);
    this.rab.forEach(function (r) { if (r.grow < 1) r.grow = Math.min(1, r.grow + dts * growR); if (r.die) r.die -= dts * dieR; else if (!r.doomed && !RM) wander(r); });
    this.fox.forEach(function (f) {
      if (f.grow < 1) f.grow = Math.min(1, f.grow + dts * growR); if (f.die) { f.die -= dts * dieR; return; } if (f.cage) { f.cage += dts * cageR; return; }
      if (f.chase) { var t = f.chase; f.chT += dts; var du = t.u - f.u, dv = t.v - f.v, dd = Math.sqrt(du * du + dv * dv) || 1e-6; f.hd = Math.atan2(dv, du);
        if (t.gone) f.chase = null;
        else if (f.chT >= f.chB) { var hit = dd < 0.05; if (hit) { self.stats.minHold = Math.min(self.stats.minHold, f.chT); self.stats.holds.push(f.chT); } self.puff(t, hit); f.chase = null; }   /* 덮치기는 정해진 시간 동안 보인다 */
        else if (!RM && dd > 0.02) { var st = Math.min(dd - 0.02, f.chV * dts); f.u += du / dd * st; f.v += dv / dd * st; f.ph += dts * 14; } }
      else if (!RM) wander(f);
    });
    this.assign();
    this.capGhosts();
    this.rab = this.rab.filter(function (r) { return !r.gone && !(r.die && r.die <= 0); });
    this.fox = this.fox.filter(function (f) { return !(f.die && f.die <= 0) && !(f.cage && f.cage > 1.6); });
    this.fx.forEach(function (x) { x.a -= dts * 1.8; }); this.fx = this.fx.filter(function (x) { return x.a > 0; });
  };
  /* 모형에서 이미 사라진 몫(죽어 가는·잡히는 그림)은 살아 있는 그림의 30 %까지만 동시에 보인다(S-검토 1R A3 · 검사 F «총수 ≤ 1.3배»와 같은 값) —
     넘치면 먹힘 몫은 먼지로(먹힘 연출 수 보존), 그 밖의 죽음은 바로 지운다 */
  World.prototype.capGhosts = function () {
    var live = this.count(this.rab, liveR), cap = Math.max(2, Math.floor(live * 0.3)), self = this;
    var ghosts = this.rab.filter(function (r) { return !r.gone && (r.die > 0 || r.doomed); });
    if (ghosts.length <= cap) return;
    /* 늙음·굶주림 중 거의 끝난 것부터 → 먹힘은 맨 나중, 그중에서도 여우가 이미 다가간 것부터(S-검토 2R B8·A3) */
    var gap = function (g) { var d = 1; self.fox.forEach(function (f) { if (f.chase === g) { d = Math.sqrt((f.u - g.u) * (f.u - g.u) + (f.v - g.v) * (f.v - g.v)); g.hold = f.chT; } }); return d; };
    ghosts.forEach(function (g) { var d; if (!g.doomed) { g.key = g.die; return; } d = gap(g); g.key = d < 0.05 ? 2 + 0.05 * (1 - Math.min(1, (g.hold || 0) / chaseBudget(self.k))) : 2.05 + (1 - Math.min(1, d)); });   /* 닿은 것 중 오래 덮친 것부터 → 못 닿은 것은 먼 것부터(S-검토 3R B6) */
    ghosts.sort(function (a, b) { return a.key - b.key; });
    for (var i = 0; i < ghosts.length - cap; i++) { var g = ghosts[i];
      if (g.doomed) { this.fox.forEach(function (f) { if (f.chase === g) f.chase = null; f.q = f.q.filter(function (q) { return q !== g; }); }); var hit = g.key < 2.05; if (hit) self.stats.holds.push(g.hold); self.puff(g, hit); }   /* 닿았지만 정해진 시간보다 일찍 끝난 덮치기도 시간을 기록 */
      else g.die = -1; }
  };
  World.prototype.drawnLive = function () { return { R: this.count(this.rab, liveR), F: this.count(this.fox, liveF) }; };
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  World.prototype.draw = function (e, opt) {
    opt = opt || {};
    var cv = this.cv, c = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (W < 20 || H < 20) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var cx = W / 2, rx = W * 0.46, ry = Math.min(rx * 0.40, H * 0.36), cy = H * 0.47, sc = Math.max(0.75, Math.min(1.35, W / 760));
    var P = function (u, v) { return [cx + u * rx / 0.9, cy + v * ry / 0.9]; };
    var g = Math.min(1, e.G / e.P.K), dry = e.inDrought(), now = (window.performance ? performance.now() : 0) / 1000, A = ART;
    if (A) { A.background(c, W, H, { t: RM ? 0 : now }); A.island(c, cx, cy, rx, ry, { grass: g, dry: dry ? 1 : 0 }); }
    else { c.fillStyle = '#cfe6f3'; c.fillRect(0, 0, W, H); c.fillStyle = '#e7d9b4'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 6.283); c.fill(); }
    var items = [], self = this;
    this.tufts.forEach(function (t) { if (g > t.th * 0.98) items.push({ v: t.v, k: 'g', o: t, s: Math.min(1, (g - t.th * 0.98) / 0.12) }); });
    this.rab.forEach(function (r) { items.push({ v: r.v, k: 'r', o: r }); });
    this.fox.forEach(function (f) { items.push({ v: f.v, k: 'f', o: f }); });
    items.sort(function (a, b) { return a.v - b.v; });
    items.forEach(function (it) { self.drawItem(c, it, P, sc, dry, now); });
    this.fx.forEach(function (x) { var p = P(x.u, x.v); if (A) A.puff(c, p[0], p[1], 18 * sc, Math.min(1, 1 - x.a)); });
    /* HUD — 모형 값 그대로 */
    var small = W < 320;
    c.font = '700 ' + (small ? 10 : Math.round(14 * Math.min(1.15, sc))) + 'px system-ui, sans-serif';
    var hud = Math.round(e.t) + '년   토끼 ' + Math.round(e.R) + '   여우 ' + Math.round(e.F) + '   풀 ' + Math.round(Math.min(100, e.G / 100)) + '%';
    var tw = c.measureText(hud).width; c.fillStyle = 'rgba(15,23,42,.78)';
    if (small) { roundRect(c, 4, 4, tw + 10, 16, 5); c.fill(); c.fillStyle = '#fff'; c.fillText(hud, 9, 16); return; }
    roundRect(c, 10, 10, tw + 20, 30, 8); c.fill(); c.fillStyle = '#fff'; c.fillText(hud, 20, 31);
    c.font = '12px system-ui, sans-serif'; var lg = '그림 하나 = 5마리(토끼·여우 같음)', lw = c.measureText(lg).width;
    c.fillStyle = 'rgba(255,255,255,.88)'; roundRect(c, 10, 46, lw + 16, 22, 6); c.fill(); c.fillStyle = '#454b52'; c.fillText(lg, 18, 61);   /* 왼쪽 위(수치 표시 아래) — 왼쪽 아래는 작은 그래프 */
    var ban = null;
    if (dry) ban = '가뭄 ' + Math.min(PP_DRY.len, Math.floor(e.t - e.drought.t0) + 1) + ' / ' + PP_DRY.len + '년 — 풀이 덜 자람';
    else if (e.killed && e.t - e.killT < 3) ban = '여우를 모두 잡아냈다';
    if (ban) { c.font = '700 14px system-ui, sans-serif'; var bw = c.measureText(ban).width; c.fillStyle = dry ? 'rgba(180,83,9,.92)' : 'rgba(29,78,216,.92)';
      roundRect(c, W - bw - 30, 10, bw + 20, 30, 8); c.fill(); c.fillStyle = '#fff'; c.fillText(ban, W - bw - 20, 31);
      if (dry && A) A.sun(c, W - bw - 52, 25, 26, RM ? 0 : now % 1); }
    if (opt.cover) { c.fillStyle = 'rgba(15,23,42,.55)'; c.fillRect(0, 0, W, H); c.font = '700 ' + Math.round(18 * sc) + 'px system-ui, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(opt.cover, W / 2, H / 2); c.textAlign = 'start'; }
  };
  /* 모형 상태 → 그림 모듈 상태(발주 계약 §2) · s.live = 살아 있는 그림(검사군 F 의 계수 기준) */
  World.prototype.drawItem = function (c, it, P, sc, dry, now) {
    var A = ART, o = it.o, p = P(o.u, o.v);
    if (!A) { /* 그림 모듈이 없을 때의 대체 점(실물색 예외 — 정상 경로에서는 쓰이지 않음) */ c.fillStyle = it.k === 'g' ? '#3f9a4a' : it.k === 'r' ? '#9a8672' : '#d9772b'; c.beginPath(); c.arc(p[0], p[1], it.k === 'f' ? 6 : 3, 0, 6.283); c.fill(); return; }
    if (it.k === 'g') { A.grass(c, p[0], p[1], 11 * sc, { amount: it.s, dry: dry ? 1 : 0, seed: o.seed, t: RM ? 0 : now }); return; }
    var dir = Math.cos(o.hd) >= 0 ? 1 : -1, frame = RM ? 0 : Math.floor(o.ph) % 2, st = 'walk', t = 0, live;
    if (it.k === 'r') {
      live = liveR(o);
      if (o.die) { st = 'starve'; t = o.why === 'starve' ? Math.min(1, 1 - o.die) : Math.min(1, 0.6 + 0.4 * (1 - o.die)); }   /* 늙음: 걷는 자세가 아니라 누운 자세에서 사라짐 */
      else if (o.doomed) { st = 'caught'; t = 0.3; }
      else if (o.grow < 1) { st = 'born'; t = (o.grow - 0.35) / 0.65; }
      else if (Math.floor(o.ph / 3) % 3 === 0) st = 'eat';
      A.rabbit(c, p[0], p[1], 15 * sc * o.grow, { state: st, t: t, frame: frame, dir: dir, seed: o.seed, live: live });
      c.globalAlpha = 1; return;
    }
    live = liveF(o);
    if (o.die) { st = 'starve'; t = Math.min(1, 1 - o.die); }
    else if (o.cage) { st = 'captured'; t = Math.min(1, o.cage / 1.6); }
    else if (o.chase) st = 'pounce';
    else if (o.grow < 1) { st = 'born'; t = (o.grow - 0.4) / 0.6; }
    A.fox(c, p[0], p[1], 26 * sc * o.grow, { state: st, t: t, frame: frame, dir: dir, seed: o.seed, live: live });
  };

  /* ---------------- 미션 정의 ---------------- */
  var MIS = [
    { tab: '① 포식자 제거', desc: '토끼와 여우가 함께 사는 섬을 기르다가 [여우 모두 잡기]를 눌러 여우를 없앱니다. 그 뒤 토끼와 풀이 어떻게 변하는지 보세요.',
      q: '여우를 모두 잡아내면, 토끼는 어떻게 될까?', rows: [['① 계속 늘어난다', '② 늘었다가 줄어든다', '③ 별 변화 없다', '④ 모르겠음']] },
    { tab: '② 평형 변화', desc: '아무것도 바꾸지 않은 섬을 60년 동안 기릅니다. 토끼와 여우의 수가 언제 늘고 언제 줄어드는지 보세요.',
      q: '토끼와 여우 중 어느 쪽이 먼저 가장 많아질까?', rows: [['① 동시에', '② 토끼가 먼저', '③ 여우가 먼저', '④ 모르겠음']] },
    { tab: '③ 모의 실험', desc: '조건(변인) 하나만 바꾼 섬을 기릅니다. 구석의 기준 섬은 아무것도 바꾸지 않은 섬입니다. 두 섬에서 토끼 수가 늘었다 줄었다 하는 주기와 토끼가 가장 많을 때의 마릿수를 비교하세요.',
      q: '고른 조건을 바꾸면, 토끼 수는 기준 섬과 어떻게 달라질까?',
      rq: ['토끼 수가 늘었다 줄었다 하는 주기(한 번 오르내리는 데 걸리는 시간)는?', '토끼가 가장 많을 때의 마릿수는?'], rk: ['주기', '가장 많을 때'],
      rows: [['기준 섬보다 길어진다', '기준 섬보다 짧아진다', '기준 섬과 같다'], ['기준 섬보다 많다', '기준 섬보다 적다', '기준 섬과 같다']] },
    { tab: '④ 평형 파괴', desc: '섬에 가뭄이 8년 동안 듭니다. 약한 가뭄과 센 가뭄을 한 번씩 일으키고, 가뭄이 끝난 뒤 토끼와 여우가 어떻게 되는지 비교하세요.',
      q: '가뭄이 8년 이어진 뒤, 토끼와 여우는 예전처럼 다시 오르내릴까?', rows: [['① 약해도 세도 되돌아온다', '② 약하면 되돌아오고 세면 안 돌아온다', '③ 약해도 세도 무너진다', '④ 모르겠음']] }
  ];
  var LIMITS = [
    '이 섬에는 풀·토끼·여우만 산다. 다른 먹이, 질병, 계절 변화, 섬 밖에서 들어오거나 나가는 동물은 없다.',
    '섬 전체의 수만 계산한다. 무대에서 동물이 어디에 있는지는 계산과 관계없다.',
    '같은 조건이면 언제나 같은 결과가 나온다. 실제 생태계에서는 우연한 일도 일어난다.',
    '수가 1마리보다 적어지면 그 동물은 섬에서 사라진 것으로 본다.',
    '개체수, 풀의 양, 시간은 수업을 위해 만든 값이다. 카이바브고원에서 실제로 잰 자료가 아니며, 카이바브고원 사례는 학자들 사이에서도 다시 검토되고 있다.',
    '그림 하나는 5마리를 나타낸다. 토끼와 여우 모두 같다.',
    '수가 오르내리는 순환이 이어져도, 오르내리는 폭이 매번 똑같지는 않다.',
    '풀이 다시 자라는 빠르기는 «황폐해진 땅은 빨리 회복되지 않는다»를 보여 주도록 정했다.',
    '무대에는 늘어난 수만큼 태어나고, 줄어든 수만큼 먹히거나 죽는 모습이 나온다. 실제로는 토끼 수가 늘 때도 여우에게 먹히고, 줄 때도 새끼가 태어난다.',
    '«빠르게»에서는 먹히거나 죽는 모습이 짧게 지나가거나 생략된다. 무대를 자세히 보려면 «느리게»나 «보통»으로 보자.'
  ];

  /* ---------------- 상태 ---------------- */
  var S = { m: 0, eco: null, base: null, world: null, mworld: null, playing: false, speed: 2, sev: PP_DRY.weak, varIdx: 0, valIdx: 0,
    pred: [null, null, [null, null], null], found: {}, runFound: {}, found4: {}, lock4: false, started: false, lastEnd: 0, done: {}, unlockAll: false, tv: false, lastG: 0, lastT: 0, lastYmax: 0, flashUntil: 0, raf: 0 };
  function predReady() { var p = S.pred[S.m]; return S.m === 2 ? p[0] != null && p[1] != null : p != null; }
  function locked(i) { if (S.unlockAll) return false; for (var k = 0; k < i; k++) if (!S.done[k]) return true; return false; }
  function overOf() { if (S.m !== 2) return null; var v = PP_VARS[S.varIdx], o = {}; o[v.key] = v.vals[S.valIdx]; return o; }
  function fmt(x) { return +(+x).toPrecision(3); }

  function build() {
    seedS = 12345;   /* 섬을 새로 만들 때마다 같은 배치 — 같은 조작이면 같은 무대(S-검토 3R 조건 3) */
    S.eco = new PPEco(overOf()); S.base = S.m === 2 ? new PPEco() : null; S.found = S.m === 3 ? S.found4 : {}; S.runFound = {}; S.playing = false; S.started = S.m === 3 && S.lock4; S.lastYmax = 0; S.lastEnd = 0;
    renderTabs(); $('tabdesc').textContent = MIS[S.m].desc; $('mbar').innerHTML = '<b>미션 ' + (S.m + 1) + '</b>' + esc(MIS[S.m].q);
    renderPred(); renderVars(); renderNote();
    var mini = $('mini'); mini.hidden = S.m !== 2;
    S.world = new World($('cv')); S.world.seed(S.eco);
    S.mworld = S.m === 2 ? new World($('mcv')) : null; if (S.mworld) S.mworld.seed(S.base);
    syncCtl(); drawGraph(); drawStage();
  }
  function renderTabs() {
    var h = MIS.map(function (x, i) { var lk = locked(i) && i !== S.m, b = S.done[i] ? '<span class="bdg ok">완료</span>' : lk ? '<span class="bdg">잠김</span>' : '';
      return '<button type="button" class="tabb' + (lk ? ' locked' : '') + '" data-i="' + i + '" aria-pressed="' + (i === S.m) + '"' + (lk ? ' aria-disabled="true"' : '') + '>' + x.tab + b + '</button>'; }).join('');
    $('tabs').innerHTML = h;
    $('unlock').textContent = S.unlockAll ? '미션 잠금 다시 걸기' : '모든 미션 열기(교사)';
    $('tvbtn').setAttribute('aria-pressed', String(S.tv));
  }
  function renderPred() {
    var mi = MIS[S.m], p = S.pred[S.m];
    $('pred').innerHTML = '<p class="q"><b>예측 먼저</b> ' + esc(mi.q) + '</p>' + mi.rows.map(function (row, ri) {
      return (mi.rq ? '<p class="rq">' + (ri + 1) + '. ' + esc(mi.rq[ri]) + '</p>' : '') + '<div class="chips" role="group" aria-label="' + (mi.rq ? esc(mi.rq[ri]) : '예측 ' + (ri + 1)) + '">' + row.map(function (c, ci) { var on = S.m === 2 ? p[ri] === ci : p === ci;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-pr="' + ri + '" data-pc="' + ci + '" aria-pressed="' + on + '"' + (S.started ? ' disabled' : '') + '>' + esc(c) + '</button>'; }).join('') + '</div>'; }).join('') +
      (S.started ? '<p class="hint">' + (S.m === 3 ? '예측이 고정되었습니다. 약한 가뭄과 센 가뭄 모두 이 예측으로 기록됩니다.' : '예측이 고정되었습니다. 다시 고르려면 [처음부터]를 누르세요.') + '</p>' : '');
  }
  function renderVars() {
    var box = $('vars'); if (S.m !== 2) { box.hidden = true; box.innerHTML = ''; return; } box.hidden = false;
    box.innerHTML = '<p class="q"><b>바꿀 조건 하나</b> <span class="hint">(나머지 조건은 기준 섬과 같습니다)</span></p><div class="vgrid">' + PP_VARS.map(function (v, i) {
      return '<button type="button" class="btn sm" data-var="' + i + '" aria-pressed="' + (i === S.varIdx) + '">' + esc(v.name) + '</button>'; }).join('') + '</div>' +
      '<div class="seg" role="group" aria-label="값">' + PP_VARS[S.varIdx].vals.map(function (x, j) { var isBase = Math.abs(x - PP_B[PP_VARS[S.varIdx].key]) < 1e-12;
        return '<button type="button" class="btn sm" data-val="' + j + '" aria-pressed="' + (j === S.valIdx) + '"' + (isBase ? ' disabled title="기준 섬과 같은 값"' : '') + '>' + fmt(x) + (isBase ? ' (기준 섬과 같음)' : '') + '</button>'; }).join('') + '</div>';
  }
  function clueText(i) { return PP_CLUES[S.m][i].text; }
  function say(msg) { var l = $('live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); } }
  function renderNote() {
    var el = $('note'), n = Object.keys(S.found).length;
    if (!predReady()) { el.innerHTML = '<h2>탐정 수첩 <span class="cnt">단서 0 / 4</span></h2><p class="concl">예측을 먼저 골라야 섬을 기를 수 있습니다.</p>'; return; }
    el.innerHTML = '<h2>탐정 수첩 <span class="cnt' + (n === 4 ? ' ok' : '') + '">단서 ' + n + ' / 4</span></h2>' + (S.m === 2 ? '<p class="q small">' + esc(PP_VARS[S.varIdx].name) + ' = ' + fmt(PP_VARS[S.varIdx].vals[S.valIdx]) + '</p>' : '') +
      '<ul class="clues">' + PP_CLUES[S.m].map(function (c, i) { var got = S.found[i] != null;
        return '<li class="' + (got ? 'got' : '') + '"><span class="mk">' + (got ? (i + 1) : '?') + '</span><span>' + (got ? esc(clueText(i)) : '아직 찾지 못한 단서') + '</span>' + (got ? '<span class="tm">' + (S.m !== 3 ? S.found[i] + '년' : S.runFound[i] != null ? S.runFound[i] + '년' : '지난 판') + '</span>' : '') + '</li>'; }).join('') + '</ul>' +
      (n === 4 ? '<p class="done">' + ([0, 1, 2, 3].every(function (k) { return S.done[k] || k === S.m; }) ? '모든 미션 완료!' : S.m === 3 ? '미션 완료!' : '미션 완료! 다음 미션이 열렸습니다.') + '</p><p class="concl">왜 그렇게 되었는지 활동지에 한 줄로 적어 보세요.</p>' :
        '');
    if (n === 4 && !S.done[S.m]) { S.done[S.m] = true; renderTabs(); }
  }
  var KILL_WAIT = '토끼 수가 한 번 가장 많아진 뒤부터 여우를 잡을 수 있습니다.';
  function toast(msg, good) { var t = $('toast'); t.textContent = msg || ''; t.className = 'toast' + (good ? ' ok' : ''); }
  function syncCtl() {
    var ready = predReady(), e = S.eco, fin = e.done();
    var play = $('play'); play.disabled = !ready || fin; play.textContent = fin ? '끝 (' + Math.round(e.t) + '년)' : S.playing ? '❚❚ 멈춤' : '▶ 기르기 시작';
    var kill = $('kill'); kill.hidden = S.m !== 0; kill.disabled = !ready || fin || e.killed || !ppCanKill(e) || e.t <= 0;
    var drow = $('drow'); drow.hidden = S.m !== 3;
    $('dry').disabled = !ready || fin || !!e.drought || e.t <= 0 && !S.playing;
    [].forEach.call(document.querySelectorAll('[data-sev]'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.sev === S.sev)); b.disabled = !ready || !!e.drought; });
    [].forEach.call(document.querySelectorAll('[data-spd]'), function (b) { b.setAttribute('aria-pressed', String(+b.dataset.spd === S.speed)); b.disabled = !ready; });
    $('result').hidden = !ready;
    if (!ready) toast('먼저 예측을 고르세요.');
    else if (S.m === 0 && !e.killed && !fin && !ppCanKill(e)) toast(e.t > 0 ? KILL_WAIT : '');
    else if ($('toast').textContent.indexOf('먼저') === 0 || $('toast').textContent === KILL_WAIT) toast('');   /* 잡을 수 있게 되면 안내를 지운다 */
  }
  /* ---------------- 그래프 ---------------- */
  function nice(v) { var e = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), m = v / e, st = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10], i; for (i = 0; i < st.length; i++) if (m <= st[i] + 1e-9) return st[i] * e; return 10 * e; }   /* 6·8 계단 추가(5208 → 6000 · S-검토 B14) */
  function graphSvg(o) {
    var hist = o.hist, ref = o.ref, pins = o.pins || [], ymax = o.ymax, Tm = o.T, W = o.W || 1100, Hh = 300, L = 54, Rm = 30, Tp = 28, gH = 30, ph = Hh - Tp - 30 - gH - 14, pw = W - L - Rm;
    var X = function (t) { return L + pw * t / Tm; }, Y = function (v) { return Tp + ph * (1 - Math.min(v, ymax) / ymax); }, gy0 = Tp + ph + 24, YG = function (v) { return gy0 + gH * (1 - Math.min(1, v / PP_B.K)); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="시간에 따른 토끼·여우 개체수와 풀의 양"><rect x="' + L + '" y="' + Tp + '" width="' + pw + '" height="' + ph + '" fill="#fff" stroke="var(--line)"/>';
    s += '<text x="' + L + '" y="' + (Tp - 10) + '" font-size="12" fill="var(--t2)" font-weight="700">개체수(마리)</text>';
    for (var i = 0; i <= 4; i++) { var y = Y(ymax * i / 4); s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" font-size="12" text-anchor="end" fill="var(--t3)">' + Math.round(ymax * i / 4) + '</text>'; }
    var step = Tm > 70 ? 20 : 10;
    for (var tt = 0; tt <= Tm + 1e-9; tt += step) s += '<text x="' + X(tt) + '" y="' + (Tp + ph + 16) + '" font-size="12" text-anchor="middle" fill="var(--t3)">' + tt + '</text>';
    s += '<text x="' + (L + pw + 4) + '" y="' + (Tp + ph + 16) + '" font-size="12" fill="var(--t3)">년</text>';
    if (o.dry) s += '<rect x="' + X(o.dry.t0) + '" y="' + Tp + '" width="' + (X(Math.min(o.dry.t1, Tm)) - X(o.dry.t0)) + '" height="' + ph + '" fill="var(--d-amber)" opacity=".12"/>' +
      '<text x="' + (X(o.dry.t0) + 4) + '" y="' + (Tp + ph - 6) + '" font-size="12" font-weight="700" fill="var(--d-amber)">가뭄</text>';   /* 색각: 색 말고 글자로도(풀 띠와 ΔE 14) */
    s += '<text x="' + (L - 6) + '" y="' + (gy0 + 12) + '" font-size="11" text-anchor="end" fill="var(--d-green)">풀</text><rect x="' + L + '" y="' + gy0 + '" width="' + pw + '" height="' + gH + '" fill="#fff" stroke="var(--line)"/>';
    function line(h, k, col, dash, w, op) { if (h.length < 2) return ''; return '<path d="' + h.map(function (x, j) { return (j ? 'L' : 'M') + X(x[0]).toFixed(1) + ' ' + Y(x[k]).toFixed(1); }).join('') + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="8 5"' : '') + ' opacity="' + op + '"/>'; }
    if (ref) s += line(ref, 2, 'var(--d-blue)', false, 2, .3) + line(ref, 3, 'var(--p-orange)', true, 2, .3);
    if (o.baseline != null) { var by = Y(o.baseline); s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + by + '" y2="' + by + '" stroke="var(--t2)" stroke-width="2" stroke-dasharray="3 4"/><text x="' + (L + pw - 6) + '" y="' + (by - 6) + '" font-size="12" text-anchor="end" fill="var(--t2)" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="4">여우가 있을 때 토끼 평균 약 ' + Math.round(o.baseline) + '</text>'; }
    if (hist.length > 1) s += '<path d="M' + X(0) + ' ' + (gy0 + gH) + hist.map(function (x) { return 'L' + X(x[0]).toFixed(1) + ' ' + YG(x[1]).toFixed(1); }).join('') + 'L' + X(hist[hist.length - 1][0]) + ' ' + (gy0 + gH) + 'Z" fill="var(--d-green)" opacity=".35"/>';
    s += line(hist, 2, 'var(--d-blue)', false, 3, 1) + line(hist, 3, 'var(--p-orange)', true, 3, 1);
    var used = [];
    pins.forEach(function (p) { var x = X(p[1]), row = 0; while (used.some(function (u) { return u[1] === row && Math.abs(u[0] - x) < 22; })) row++; used.push([x, row]); var py = Tp + 11 + row * 24;
      s += '<line x1="' + x + '" x2="' + x + '" y1="' + Tp + '" y2="' + (Tp + ph) + '" stroke="var(--d-green)" stroke-dasharray="2 3"/><circle cx="' + x + '" cy="' + py + '" r="10" fill="var(--d-green)"/><text x="' + x + '" y="' + (py + 4) + '" font-size="12" fill="#fff" text-anchor="middle" font-weight="700">' + p[0] + '</text>'; });
    return s + '</svg>';
  }
  /* 무대 왼쪽 아래 작은 개체수 기록(사용자 요청 10-27) — 큰 그래프와 같은 눈금·색 · 글자 크기는 화면 폭에 맞춤 */
  function miniSvg(o) {
    var W = o.W, H = Math.round(W * 0.46), L = 6, Rm = 6, Tp = 20, B = 6, pw = W - L - Rm, ph = H - Tp - B;
    var X = function (t) { return L + pw * t / o.T; }, Y = function (v) { return Tp + ph * (1 - Math.min(v, o.ymax) / o.ymax); };
    function line(h, k, col, dash, w, op) { if (h.length < 2) return ''; return '<path d="' + h.map(function (x, j) { return (j ? 'L' : 'M') + X(x[0]).toFixed(1) + ' ' + Y(x[k]).toFixed(1); }).join('') + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="5 3"' : '') + ' opacity="' + op + '"/>'; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="개체수 기록(작은 그래프)">';
    var wide = W >= 230;   /* 좁으면 제목을 빼고 범례만(글자 겹침 방지) */
    if (wide) s += '<text x="' + L + '" y="13" font-size="12" font-weight="700" fill="var(--t1)">개체수 기록</text>';
    s += '<text x="' + (wide ? W - Rm : L) + '" y="13" font-size="12" font-weight="700" text-anchor="' + (wide ? 'end' : 'start') + '"><tspan fill="var(--d-blue)">━ 토끼</tspan><tspan fill="var(--p-orange)" dx="8">┅ 여우</tspan></text>';
    s += '<rect x="' + L + '" y="' + Tp + '" width="' + pw + '" height="' + ph + '" fill="#fff" stroke="var(--line)"/>';
    if (o.dry) s += '<rect x="' + X(o.dry.t0) + '" y="' + Tp + '" width="' + (X(Math.min(o.dry.t1, o.T)) - X(o.dry.t0)) + '" height="' + ph + '" fill="var(--d-amber)" opacity=".15"/>';
    if (o.baseline != null) { var by = Y(o.baseline); s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + by + '" y2="' + by + '" stroke="var(--t2)" stroke-width="1.5" stroke-dasharray="2 3"/>'; }
    if (o.ref) s += line(o.ref, 2, 'var(--d-blue)', false, 1.5, .3) + line(o.ref, 3, 'var(--p-orange)', true, 1.5, .3);
    s += line(o.hist, 2, 'var(--d-blue)', false, 2.2, 1) + line(o.hist, 3, 'var(--p-orange)', true, 2.2, 1);
    s += '<text x="' + (L + 3) + '" y="' + (Tp + 11) + '" font-size="10" fill="var(--t3)">' + o.ymax + '</text>';
    return s + '</svg>';
  }
  function drawGraph() {
    var e = S.eco, mx = 0, ym, T;
    e.hist.forEach(function (x) { mx = Math.max(mx, x[2], x[3]); }); if (S.m === 2) S.base.hist.forEach(function (x) { mx = Math.max(mx, x[2], x[3]); });
    if (S.m === 0) mx = Math.max(mx, ppBaseline());
    ym = nice(Math.max(mx, 300) * 1.05); T = e.endT();
    if ((S.lastYmax && ym !== S.lastYmax) || (S.lastEnd && T !== S.lastEnd)) S.flashUntil = Date.now() + 2500; S.lastYmax = ym; S.lastEnd = T;
    $('flash').textContent = Date.now() < S.flashUntil ? '눈금이 바뀌었습니다 (0~' + ym + '마리 · 0~' + Math.round(T) + '년)' : '';
    $('gr').innerHTML = graphSvg({ hist: e.hist, ref: S.m === 2 ? S.base.hist : null, pins: Object.keys(S.runFound).map(function (k) { return [+k + 1, S.runFound[k]]; }),
      ymax: ym, T: T, dry: e.drought, baseline: S.m === 0 ? ppBaseline() : null,
      W: Math.max(420, Math.min(1100, $('gr').clientWidth || 1100)) });   /* 좁은 화면: 글씨가 줄지 않게 viewBox 폭을 화면 폭에 맞춤 */
    var gm = $('gmini'); if (gm) gm.innerHTML = miniSvg({ hist: e.hist, ref: S.m === 2 ? S.base.hist : null, ymax: ym, T: T, dry: e.drought, baseline: S.m === 0 ? ppBaseline() : null, W: Math.max(150, Math.min(340, gm.clientWidth || 300)) });
    $('legref').hidden = S.m !== 2; $('legbase').hidden = S.m !== 0;
    $('bars').innerHTML = barsHtml();
  }
  /* 미션 ① 평균 막대 — 값은 실행이 끝났을 때만(ppKillCompare · 잡은 뒤 25~40년). 그 전에는 안내만 */
  function barsData() {
    var e = S.eco; if (S.m !== 0 || !e.killed) return null;
    var c = ppKillCompare(e); return c ? [['잡은 뒤 25~40년 평균', c.post], ['여우가 있을 때 평균', c.base]] : [];
  }
  function barsHtml() {
    var d = barsData(); if (!d) return '';
    if (!d.length) return '<h3 class="barsh">토끼 평균 비교</h3><p class="bnote">잡은 뒤 40년이 다 지나면 보입니다.</p>';
    return '<h3 class="barsh">토끼 평균 비교</h3>' + d.map(function (r, i) {
      return '<div class="brow"><span class="bl">' + r[0] + '</span><span class="bt"><span class="bf' + (i ? ' base' : '') + '" style="width:' + (80 * Math.min(1, r[1] / 500)).toFixed(1) + '%"></span><b>약 ' + Math.round(r[1]) + '마리</b></span></div>'; }).join('') +
      '<p class="bnote">막대 눈금 0~500마리(위 그래프와 눈금이 다름)</p>';
  }
  function drawStage() { if (S.world) S.world.draw(S.eco, { cover: predReady() ? null : '먼저 예측을 고르세요' }); if (S.mworld) S.mworld.draw(S.base); }
  function advance(yrs) {
    var e = S.eco, ctx = { base: S.base };
    e.step(Math.min(yrs, e.endT() - e.t));
    if (S.base) S.base.step(Math.min(yrs, S.base.endT() - S.base.t));
    S.world.sync(e); if (S.mworld) S.mworld.sync(S.base);
    if (ppCheckClues(S.m, e, S.runFound, ctx)) {
      Object.keys(S.runFound).forEach(function (k) { if (S.found[k] == null) { S.found[k] = S.runFound[k]; say('단서 ' + (+k + 1) + ': ' + clueText(+k)); } });
      renderNote(); drawGraph();
    }
  }
  function frame(now) {
    var dt = Math.min(0.05, (now - (S.lastT || now)) / 1000); S.lastT = now;
    if (S.playing && S.eco) {
      advance(dt * S.speed);
      if (S.eco.done()) { S.playing = false; }
      if (now - S.lastG > 200 || !S.playing) { drawGraph(); S.lastG = now; }
      syncCtl();
    }
    if (S.world) S.world.move(dt, S.speed); if (S.mworld) S.mworld.move(dt, S.speed); drawStage();
    if (S.eco && now - (S.lastRd || 0) > 500) { S.lastRd = now; var e2 = S.eco; $('readout').textContent = '현재 수치: ' + Math.round(e2.t) + '년 · 토끼 ' + Math.round(e2.R) + '마리 · 여우 ' + Math.round(e2.F) + '마리 · 풀 ' + Math.round(Math.min(100, e2.G / 100)) + '%'; }
    S.raf = requestAnimationFrame(frame);
  }
  function openResult() {
    var e = S.eco, cv = $('cv'), img = cv.toDataURL('image/png'), mi = MIS[S.m], p = S.pred[S.m], ptxt;
    ptxt = S.m === 2 ? mi.rk[0] + ' — ' + (p[0] != null ? mi.rows[0][p[0]] : '—') + ', ' + mi.rk[1] + ' — ' + (p[1] != null ? mi.rows[1][p[1]] : '—') : (p != null ? mi.rows[0][p] : '—');   /* ③은 무엇에 대한 답인지 붙여서 */
    var cmp = '';
    if (S.m === 3 && e.drought) { var vd = ppDroughtVerdict(e);   /* 단서 ④-3·④-4와 같은 상태 술어(S-검토 2R A1) */
      cmp = vd === 'gone' ? ' · 여우가 사라져 토끼만 남았다' : vd === 'back' ? ' · 여우가 살아남아 토끼와 함께 다시 오르내린다' : vd === 'wait' ? ' · 여우가 다시 늘어날지 사라질지 아직 알 수 없다 — 더 지켜보세요' : ' · 아직 가뭄 중이다'; }
    $('ovl').innerHTML = '<div class="ovl" data-close="1"><div class="obox" role="dialog" aria-modal="true" aria-labelledby="otitle"><h2 id="otitle" tabindex="-1">결과 — 미션 ' + (S.m + 1) + ' ' + esc(mi.tab.slice(2)) + (S.m === 2 ? ' · ' + esc(PP_VARS[S.varIdx].name) + ' = ' + fmt(PP_VARS[S.varIdx].vals[S.valIdx]) : '') + '</h2>' +
      '<p class="q">' + Math.round(e.t) + '년 · 토끼 ' + Math.round(e.R) + ' · 여우 ' + Math.round(e.F) + ' · 풀 ' + Math.round(Math.min(100, e.G / 100)) + '%' + cmp + ' · 단서 ' + Object.keys(S.found).length + '/4 · 내 예측: ' + esc(ptxt) + '</p>' +
      '<div class="two"><img alt="섬의 마지막 장면" src="' + img + '"><div class="note">' + $('note').innerHTML + '</div></div><div class="gr">' + $('gr').innerHTML + '</div>' + (S.m === 0 ? '<div class="bars">' + barsHtml() + '</div>' : '') +
      '<div class="btnrow"><span class="q">이 화면을 캡처해 활동지에 붙입니다.</span><button type="button" class="btn" id="oclose" data-close="1">닫기</button></div></div></div>';
    $('otitle').focus();   /* 제목부터(«내 예측» 줄이 화면 밖으로 밀리지 않게 · S-검토 2R B2) */
  }

  /* ---------------- 조작 ---------------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('button,[data-close]') : null; if (!t) return;
    if (t.dataset.close) { if (t === ev.target || t.tagName === 'BUTTON') closeOvl(); return; }
    if (t.dataset.i != null) { var i = +t.dataset.i; if (locked(i) && i !== S.m) { toast('앞 미션을 끝내면 열립니다.'); return; } S.m = i; build(); return; }
    if (t.dataset.pr != null) { if (S.started) return; var r = +t.dataset.pr, c = +t.dataset.pc; if (S.m === 2) S.pred[2][r] = c; else S.pred[S.m] = c; renderPred(); renderNote(); syncCtl(); drawStage(); return; }
    if (t.dataset.var != null) { if (+t.dataset.var === S.varIdx) return; S.varIdx = +t.dataset.var; S.valIdx = PP_VARS[S.varIdx].vals.indexOf(PP_VARS[S.varIdx].vals.filter(function (x) { return Math.abs(x - PP_B[PP_VARS[S.varIdx].key]) > 1e-12; })[0]); S.pred[2] = [null, null]; build(); return; }
    if (t.dataset.val != null) { if (+t.dataset.val === S.valIdx || t.disabled) return; S.valIdx = +t.dataset.val; S.pred[2] = [null, null]; build(); return; }
    if (t.dataset.sev != null) { S.sev = +t.dataset.sev; syncCtl(); return; }
    if (t.dataset.spd != null) { S.speed = +t.dataset.spd; syncCtl(); return; }
    switch (t.id) {
      case 'play': if (!predReady() || S.eco.done()) return; S.playing = !S.playing; if (!S.started) { S.started = true; if (S.m === 3) S.lock4 = true; renderPred(); } syncCtl(); break;
      case 'kill': if (!predReady() || !ppCanKill(S.eco)) return; S.eco.kill(); S.world.sync(S.eco); drawGraph(); syncCtl(); break;
      case 'dry': if (!predReady() || S.eco.drought) return; S.eco.startDrought(S.sev); if (!S.playing && !S.eco.done()) S.playing = true; if (!S.started) { S.started = true; if (S.m === 3) S.lock4 = true; renderPred(); } drawGraph(); syncCtl(); break;
      case 'reset': build(); break;
      case 'result': openResult(); break;
      case 'oclose': closeOvl(); break;
      case 'unlock': S.unlockAll = !S.unlockAll; renderTabs(); break;
      case 'tvbtn': S.tv = !S.tv; document.body.classList.toggle('tv', S.tv); renderTabs(); break;
    }
  });
  function closeOvl() { if (!$('ovl').innerHTML) return; $('ovl').innerHTML = ''; var b = $('result'); if (b && !b.hidden) b.focus(); }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeOvl();
    else if (ev.key === 'Tab' && $('ovl').innerHTML) { ev.preventDefault(); $('oclose').focus(); } });   /* 결과 창이 열려 있으면 초점이 창 밖으로 나가지 않는다 */
  var rzT = 0; window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { if (S.eco) drawGraph(); }, 150); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { cancelAnimationFrame(S.raf); S.raf = 0; } else if (!S.raf) { S.lastT = 0; S.raf = requestAnimationFrame(frame); } });
  $('limits').innerHTML = LIMITS.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  /* 검사 훅(읽기 전용) — 검증스크립트/_predprey_probe.js · predprey_check.js 화면 군 */
  window.PP_DEBUG = { S: S, World: World, advance: advance, build: build, drawGraph: drawGraph, syncCtl: syncCtl, openResult: openResult, closeOvl: closeOvl, ART: function () { return ART; } };
  build(); S.raf = requestAnimationFrame(frame);
})();
