/* 농도·온도·촉매와 반응 속도 (화학탐구실 ratefactors/) — 조립 산출물. 정본: 검증스크립트/ratefactors_core.js · _ratefactors_fx/rf_art.part.js(Astra) · _ratefactors_ui.part.js
   조립: node 검증스크립트/_ratefactors_assemble.js · 근거: _P0_반응속도요인.md */
/* ==== CORE BEGIN ==== */
var RFC = (function () {
  "use strict";

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ── 상자 하나 ──────────────────────────────────────────────
     벽은 «온도가 일정한 벽»: 부딪친 입자의 빠르기를 그 온도의 분포에서 다시 뽑는다(벽 쪽 성분은 들어오는 흐름 분포).
     그래서 입자 수가 1~2개여도 빠르기 분포가 그 온도의 분포이고(작은 계의 에너지 고정 함정 회피), 반응이 분포를 바꾸지 않는다(항온).
     vz = 화면에 보이지 않는 세 번째 빠르기 성분 — 운동 에너지를 3차원으로 셈(봉우리 있는 분포 · 의뢰서 §5 «2차원 함정»).
     입자끼리 충돌은 평면 성분만 주고받으므로 vz 는 벽에서만 바뀐다. */
  function Box(o) {
    this.W = o.W; this.H = o.H; this.x1 = o.W;   /* x1 = 오른쪽 벽(피스톤 면) */
    this.T = o.T || 1; this.S = o.S || 100;      /* S = 온도 1 에서 한 성분 빠르기의 표준편차(px/s) */
    this.r = rng(o.seed || 1); this.t = 0;
    this.ps = []; this.solids = []; this.events = []; this.ghosts = [];
    this.cnt = { coll: 0, react: 0, hit: 0, wall: 0 };
    this.count = o.count || "AB";                /* 무엇을 충돌로 세나: "AB"(A–B만) · "RR"(반응물끼리) · "BS"(B–고체) */
    this.Ea = o.Ea == null ? null : o.Ea;        /* 반응 문턱(kT₁ 단위 · null = 반응 없음) */
    this.inject = o.inject || null;
  }
  Box.prototype.sig = function () { return this.S * Math.sqrt(this.T); };
  Box.prototype.thermal = function (p) { var s = this.sig(); p.vx = gauss(this.r) * s; p.vy = gauss(this.r) * s; p.vz = gauss(this.r) * s; if (this.inject === "flat2D") p.vz = 0; };
  Box.prototype.free = function (x, y, R) {
    var i, q, dx, dy;
    for (i = 0; i < this.ps.length; i++) { q = this.ps[i]; dx = q.x - x; dy = q.y - y; if (dx * dx + dy * dy < (q.R + R + 2) * (q.R + R + 2)) return false; }
    for (i = 0; i < this.solids.length; i++) { q = this.solids[i]; if (x > q.x - R - 2 && x < q.x + q.w + R + 2 && y > q.y - R - 2 && y < q.y + q.h + R + 2) return false; }
    return true;
  };
  Box.prototype.add = function (k, R) {
    var g = 0, x, y;
    do { x = R + this.r() * (this.x1 - 2 * R); y = R + this.r() * (this.H - 2 * R); } while (!this.free(x, y, R) && ++g < 4000);
    var p = { k: k, R: R, x: x, y: y, vx: 0, vy: 0, vz: 0, id: this.ps.length + 1 };
    this.thermal(p); this.ps.push(p); return p;
  };
  /* 운동 에너지(kT₁ 단위): ½(vx²+vy²+vz²)/S² — 온도 T 에서 평균 1.5T */
  Box.prototype.ke = function (p) { var s2 = this.S * this.S; return 0.5 * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) / s2; };
  Box.prototype.wallKick = function (p, nx, ny) {   /* 벽 법선(nx,ny: 상자 안쪽) 방향으로 들어오는 흐름 분포 */
    this.cnt.wall++;
    var s = this.sig(), vn = s * Math.sqrt(-2 * Math.log(1 - this.r() * 0.999999)), vt = gauss(this.r) * s;
    if (this.inject === "elasticWall") { var d = p.vx * nx + p.vy * ny; if (d < 0) { p.vx -= 2 * d * nx; p.vy -= 2 * d * ny; } return; }
    p.vx = vn * nx - vt * ny; p.vy = vn * ny + vt * nx; p.vz = gauss(this.r) * s; if (this.inject === "flat2D") p.vz = 0;
  };
  Box.prototype.step = function (dt) {
    var ps = this.ps, n = ps.length, i, j, p, q, k, sd;
    this.t += dt;
    for (i = 0; i < n; i++) {
      p = ps[i]; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < p.R) { p.x = p.R; this.wallKick(p, 1, 0); } else if (p.x > this.x1 - p.R) { p.x = this.x1 - p.R; this.wallKick(p, -1, 0); }
      if (p.y < p.R) { p.y = p.R; this.wallKick(p, 0, 1); } else if (p.y > this.H - p.R) { p.y = this.H - p.R; this.wallKick(p, 0, -1); }
      for (k = 0; k < this.solids.length; k++) this.solidHit(p, this.solids[k]);
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      p = ps[i]; q = ps[j];
      var dx = q.x - p.x, dy = q.y - p.y, s = p.R + q.R, d2 = dx * dx + dy * dy;
      if (d2 >= s * s || d2 === 0) continue;
      var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (s - d) / 2;
      p.x -= nx * ov; p.y -= ny * ov; q.x += nx * ov; q.y += ny * ov;
      var vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
      if (vn >= 0) continue;
      this.onPair(p, q, p.x + nx * p.R, p.y + ny * p.R);
      p.vx += vn * nx; p.vy += vn * ny; q.vx -= vn * nx; q.vy -= vn * ny;
    }
    for (i = this.ghosts.length - 1; i >= 0; i--) { var g = this.ghosts[i]; g.x += g.vx * dt; g.y += g.vy * dt; g.age += dt; }
    sd = this.ghosts.length; if (sd > 60) this.ghosts.splice(0, sd - 60);
  };
  /* 고체 조각(축 정렬 사각형)과의 충돌 — 그 사각형이 곧 그리는 사각형(원칙 11) */
  Box.prototype.solidHit = function (p, b) {
    var cx = Math.max(b.x, Math.min(p.x, b.x + b.w)), cy = Math.max(b.y, Math.min(p.y, b.y + b.h)), dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= p.R * p.R) return;
    var d = Math.sqrt(d2), nx, ny;
    if (d === 0) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
    p.x = cx + nx * p.R; p.y = cy + ny * p.R;
    var vn = p.vx * nx + p.vy * ny;
    if (vn < 0) {
      p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny;
      if (this.count === "BS" && p.k === "B") { this.cnt.hit++; this.events.push({ t: this.t, x: cx, y: cy, kind: "hit" }); }
    }
  };
  Box.prototype.onPair = function (p, q, cx, cy) {
    if (this.count === "AB") { if ((p.k !== q.k || this.inject === "countAll") && (p.k === "A" || p.k === "B") && (q.k === "A" || q.k === "B")) { this.cnt.coll++; this.events.push({ t: this.t, x: cx, y: cy, kind: "hit" }); } return; }
    if (this.count !== "RR" || p.k !== "R" || q.k !== "R") return;
    this.cnt.coll++;
    if (this.Ea == null) return;
    var ep = this.ke(p), eq = this.ke(q), hot = ep >= this.Ea || eq >= this.Ea;
    if (this.inject === "oneSide") hot = (this.r() < 0.5 ? ep : eq) >= this.Ea;
    if (!hot) return;
    /* 반응: 두 반응물 → 생성물(옅어지며 빠져나감) · 반응물은 그 자리에 다시 채움(빠르기 그대로 — 분포를 바꾸지 않는 보충) */
    this.cnt.react += 2;
    this.events.push({ t: this.t, x: cx, y: cy, kind: "react" });
    this.ghosts.push({ x: cx, y: cy, vx: (p.vx + q.vx) / 2, vy: (p.vy + q.vy) / 2, age: 0 });
    if (this.inject === "noRefill") { this.thermal(p); this.thermal(q); var s = 0.55; p.vx *= s; p.vy *= s; p.vz *= s; q.vx *= s; q.vy *= s; q.vz *= s; }
  };
  Box.prototype.drain = function () { var e = this.events; this.events = []; return e; };
  Box.prototype.resetCount = function () { this.cnt = { coll: 0, react: 0, hit: 0, wall: 0 }; };
  Box.prototype.perim = function () { return 2 * (this.x1 + this.H); };
  Box.prototype.hotCount = function () { var n = 0, i; if (this.Ea == null) return 0; for (i = 0; i < this.ps.length; i++) if (this.ps[i].k === "R" && this.ke(this.ps[i]) >= this.Ea) n++; return n; };

  /* ── 측정: 정해진 시뮬 시간 동안 센다 ── */
  function Meter(dur) { this.dur = dur; this.on = false; this.t = 0; this.done = false; }
  Meter.prototype.start = function () { this.on = true; this.t = 0; this.done = false; };
  Meter.prototype.tick = function (dt) { if (!this.on) return false; this.t += dt; if (this.t >= this.dur) { this.t = this.dur; this.on = false; this.done = true; return true; } return false; };

  /* ════════ 탭 ① 농도와 충돌수 — A·B 입자 수 (1,1)(2,1)(2,2)(2,3) · A–B 충돌만 센다 · 반응 없음 ════════ */
  var C1 = { W: 440, H: 300, R: 18, S: 125, MEAS: 600, FF: 20, CONDS: [[1, 1], [2, 1], [2, 2], [2, 3]] };
  function Tab1(seed) { this.seed = seed || 11; this.set(0); }
  Tab1.prototype.set = function (ci) {
    this.ci = ci; var c = C1.CONDS[ci];
    this.box = new Box({ W: C1.W, H: C1.H, S: C1.S, seed: this.seed + ci * 101 + (this.round || 0) * 7, count: "AB", inject: this.inject });
    var i; for (i = 0; i < c[0]; i++) this.box.add("A", C1.R); for (i = 0; i < c[1]; i++) this.box.add("B", C1.R);
    this.meter = new Meter(C1.MEAS);
  };
  Tab1.prototype.pairs = function () { var a = [], b = [], ps = this.box.ps, i, j, out = []; ps.forEach(function (p) { (p.k === "A" ? a : b).push(p); }); for (i = 0; i < a.length; i++) for (j = 0; j < b.length; j++) out.push([a[i], b[j]]); return out; };
  Tab1.prototype.step = function (dt) { this.box.step(dt); if (this.meter.on) { var fin = this.meter.tick(dt); return fin; } return false; };

  /* ════════ 탭 ② 압력과 충돌수 — 같은 입자 수, 부피 절반(피스톤) ════════ */
  var C2 = { W: 560, H: 300, R: 11, S: 105, NA: 12, NB: 12, MEAS: 30, FF: 3, X1: [560, 280] };
  function Tab2(seed) { this.seed = seed || 21; this.set(0); }
  Tab2.prototype.set = function (vi) {
    this.vi = vi; this.box = new Box({ W: C2.W, H: C2.H, S: C2.S, seed: this.seed + vi * 101 + (this.round || 0) * 7, count: "AB", inject: this.inject });
    this.box.x1 = C2.X1[vi];
    var i; for (i = 0; i < C2.NA; i++) this.box.add("A", C2.R); for (i = 0; i < C2.NB; i++) this.box.add("B", C2.R);
    this.meter = new Meter(C2.MEAS);
  };
  /* 피스톤을 천천히 민다(입자는 계속 움직임) — 면이 입자를 밀어 넣는다 */
  Tab2.prototype.pushTo = function (vi) { this.target = C2.X1[vi]; this.vi = vi; this.meter = new Meter(C2.MEAS); };
  Tab2.prototype.step = function (dt) {
    if (this.target != null && this.box.x1 !== this.target) {
      var sp = 140 * dt, b = this.box; b.x1 = b.x1 > this.target ? Math.max(this.target, b.x1 - sp) : Math.min(this.target, b.x1 + sp);
      if (b.x1 === this.target) this.target = null;
    }
    this.box.step(dt); return this.meter.on ? this.meter.tick(dt) : false;
  };

  /* ════════ 탭 ③ 표면적과 충돌수 — 고체 반응물의 양은 같고 조각 수만 1·4·16 ════════ */
  var C3 = { W: 560, H: 330, R: 5, S: 105, NB: 36, SIDE: 120, MEAS: 20, FF: 2, CUTS: [1, 2, 4] };   /* CUTS = 한 변을 몇 조각으로(조각 수 1 · 4 · 16) */
  function solidLayout(cut) {
    var a = C3.SIDE / cut, gap = cut === 1 ? 0 : (cut === 2 ? 48 : 36), tot = cut * a + (cut - 1) * gap, x0 = (C3.W - tot) / 2, y0 = (C3.H - tot) / 2, out = [], i, j;
    for (i = 0; i < cut; i++) for (j = 0; j < cut; j++) out.push({ x: x0 + i * (a + gap), y: y0 + j * (a + gap), w: a, h: a });
    return out;
  }
  function Tab3(seed) { this.seed = seed || 31; this.set(0); }
  Tab3.prototype.set = function (ci) {
    this.ci = ci; var cut = C3.CUTS[ci];
    this.box = new Box({ W: C3.W, H: C3.H, S: C3.S, seed: this.seed + ci * 101 + (this.round || 0) * 7, count: "BS", inject: this.inject });
    this.box.solids = solidLayout(cut);
    for (var i = 0; i < C3.NB; i++) this.box.add("B", C3.R);
    this.meter = new Meter(C3.MEAS);
  };
  Tab3.prototype.area = function () { var s = 0; this.box.solids.forEach(function (b) { s += b.w * b.h; }); return s; };
  Tab3.prototype.edge = function () { var s = 0; this.box.solids.forEach(function (b) { s += 2 * (b.w + b.h); }); return s; };
  Tab3.prototype.step = function (dt) { this.box.step(dt); return this.meter.on ? this.meter.tick(dt) : false; };

  /* ════════ 탭 ④ 온도와 반응 — T₁ · T₂ 두 상자 나란히 · Eₐ 이상인 분자가 끼인 충돌만 반응 ════════
     T₂ = 2T₁ · Eₐ = 4kT₁ (몬테카를로: 충돌 ×1.41 · 반응 ×5.8 · T₁ 에서 Eₐ 이상 4.6 %) — «보이게 하려고 온도 차를 키우고 장벽을 낮춘 모형» */
  var C4 = { W: 340, H: 300, R: 7, S: 70, N: 70, T: [1, 2], EA: 4, MEAS: 20, FF: 1, BINS: 40, EMAX: 10 };
  function Hist() { this.n = 0; this.b = []; for (var i = 0; i < C4.BINS; i++) this.b.push(0); }
  Hist.prototype.add = function (box) { var w = C4.EMAX / C4.BINS, i, e; for (i = 0; i < box.ps.length; i++) { e = box.ke(box.ps[i]); var k = Math.floor(e / w); if (k < C4.BINS) this.b[k]++; } this.n++; };
  Hist.prototype.avg = function () { var n = this.n || 1; return this.b.map(function (v) { return v / n; }); };
  function Tab4(seed) { this.seed = seed || 41; this.inject = null; this.reset(); }
  Tab4.prototype.reset = function () {
    var self = this; this.round = (this.round || 0) + 1;
    this.boxes = C4.T.map(function (T, i) {
      var b = new Box({ W: C4.W, H: C4.H, S: C4.S, T: T, seed: self.seed + i * 1000 + self.round * 7, count: "RR", Ea: C4.EA, inject: self.inject });
      for (var k = 0; k < C4.N; k++) b.add("R", C4.R); return b;
    });
    this.hist = [new Hist(), new Hist()]; this.ht = 0; this.meter = new Meter(C4.MEAS);
  };
  Tab4.prototype.EaOf = function () { return this.inject === "EaFollowsT" ? null : C4.EA; };
  Tab4.prototype.step = function (dt) {
    var self = this; this.boxes.forEach(function (b, i) { if (self.inject === "EaFollowsT") b.Ea = C4.EA * C4.T[i]; b.step(dt); });
    this.ht += dt; if (this.ht >= 0.25) { this.ht = 0; this.hist[0].add(this.boxes[0]); this.hist[1].add(this.boxes[1]); }
    return this.meter.on ? this.meter.tick(dt) : false;
  };
  Tab4.prototype.eaLine = function (i) { return this.boxes[i].Ea; };   /* 그래프 세로선 = 그 상자의 판정 문턱(같은 원천) */

  /* ════════ 탭 ⑤ 촉매와 반응 — 같은 온도 · 왼쪽 촉매 없음 / 오른쪽 정촉매(Eₐ′) 또는 부촉매(Eₐ″) ════════ */
  var C5 = { W: 340, H: 300, R: 7, S: 70, N: 70, T: 1, EA: 4, EA_POS: 2.5, EA_NEG: 6, NC: 5, RC: 8, MEAS: 20, FF: 1 };
  function Tab5(seed) { this.seed = seed || 51; this.inject = null; this.mode = "pos"; this.reset(); }
  Tab5.prototype.eaCat = function () { return this.mode === "pos" ? C5.EA_POS : (this.mode === "neg" ? C5.EA_NEG : C5.EA); };
  Tab5.prototype.reset = function () {
    var self = this; this.round = (this.round || 0) + 1;
    this.boxes = [0, 1].map(function (i) {
      var b = new Box({ W: C5.W, H: C5.H, S: C5.S, T: C5.T, seed: self.seed + i * 1000 + self.round * 7, count: "RR", Ea: i ? self.eaCat() : C5.EA, inject: self.inject });
      for (var k = 0; k < C5.N; k++) b.add("R", C5.R);
      if (i) for (k = 0; k < C5.NC; k++) b.add("C", C5.RC);
      return b;
    });
    this.hist = new Hist(); this.ht = 0; this.meter = new Meter(C5.MEAS);
  };
  Tab5.prototype.setMode = function (m) { this.mode = m; this.boxes[1].Ea = this.eaCat(); this.meter = new Meter(C5.MEAS); this.boxes.forEach(function (b) { b.resetCount(); }); };
  Tab5.prototype.catCount = function () { return this.boxes[1].ps.filter(function (p) { return p.k === "C"; }).length; };
  Tab5.prototype.step = function (dt) {
    this.boxes.forEach(function (b) { b.step(dt); });
    this.ht += dt; if (this.ht >= 0.25) { this.ht = 0; this.hist.add(this.boxes[0]); }
    return this.meter.on ? this.meter.tick(dt) : false;
  };

  /* 이론 참고값(검사 전용): 3차원 운동 에너지 분포 f(E) = 2√(E/π)·T^(-3/2)·e^(-E/T) */
  function maxwellE(E, T) { return 2 * Math.sqrt(E / Math.PI) * Math.pow(T, -1.5) * Math.exp(-E / T); }

  return {
    rng: rng, gauss: gauss, Box: Box, Meter: Meter, solidLayout: solidLayout, maxwellE: maxwellE, Hist: Hist,
    C1: C1, C2: C2, C3: C3, C4: C4, C5: C5, Tab1: Tab1, Tab2: Tab2, Tab3: Tab3, Tab4: Tab4, Tab5: Tab5
  };
})();
/* ==== CORE END ==== */

/* ==== ART BEGIN (Astra RF_ART 1.0.0 — 원본 그대로 · 수정 금지) ==== */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var EMPTY = {};
  var PALETTE = {
    A: ['#fff0a5', '#f2c230', '#c99520', '#937019'],
    B: ['#dcc4ed', '#985fc8', '#754399', '#5e357e'],
    R: ['#b9e5eb', '#359abb', '#237c99', '#205e73'],
    P: ['#c3ebce', '#50b878', '#308c57', '#276d46'],
    C: ['#f0f3f5', '#b7c1ca', '#7a8794', '#53616e']
  };
  /* Shared FIFO: 128 sprites AND 4,194,304 backing pixels (16 MiB RGBA).
     Positions, opacity and time never enter the cache. */
  var CACHE_CAP = 128, PIXEL_CAP = 4194304;
  var cache = {}, keys = [], pixelCount = 0;

  function number(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }
  function unit(v, fallback) { return Math.max(0, Math.min(1, number(v, fallback))); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function density(ctx) {
    var t = ctx.getTransform ? ctx.getTransform() : null;
    var d = t ? Math.max(Math.sqrt(t.a * t.a + t.b * t.b), Math.sqrt(t.c * t.c + t.d * t.d)) : number(root.devicePixelRatio, 1);
    return Math.max(1, Math.min(4, Math.ceil(d * 4) / 4));
  }
  function remember(key, sprite) {
    var old;
    if (sprite.pixels > PIXEL_CAP) { return sprite; }
    while (keys.length && (keys.length >= CACHE_CAP || pixelCount + sprite.pixels > PIXEL_CAP)) {
      old = keys.shift(); pixelCount -= cache[old].pixels; delete cache[old];
    }
    keys.push(key); cache[key] = sprite; pixelCount += sprite.pixels;
    return sprite;
  }
  function surface(w, h, d) {
    var cv = root.document.createElement('canvas');
    cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d);
    return { canvas: cv, width: cv.width / d, height: cv.height / d, pixels: cv.width * cv.height };
  }
  function hex(c, r) {
    var points = [], i, a, p, before, after, trim = 0.13;
    for (i = 0; i < 6; i++) {
      a = i * Math.PI / 3;
      points.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    c.beginPath();
    for (i = 0; i < 6; i++) {
      p = points[i]; before = points[(i + 5) % 6]; after = points[(i + 1) % 6];
      if (!i) { c.moveTo(p[0] + (before[0] - p[0]) * trim, p[1] + (before[1] - p[1]) * trim); }
      else { c.lineTo(p[0] + (before[0] - p[0]) * trim, p[1] + (before[1] - p[1]) * trim); }
      c.quadraticCurveTo(p[0], p[1], p[0] + (after[0] - p[0]) * trim, p[1] + (after[1] - p[1]) * trim);
    }
    c.closePath();
  }
  function hotRing(c, r, hot) {
    var g;
    if (hot <= 0) { return; }
    c.save(); c.globalAlpha *= hot;
    g = c.createRadialGradient(0, 0, r + 0.65, 0, 0, r + 4);
    g.addColorStop(0, 'rgba(239,151,26,0)');
    g.addColorStop(0.48, 'rgba(239,151,26,0.25)');
    g.addColorStop(0.72, 'rgba(239,151,26,0.13)');
    g.addColorStop(1, 'rgba(239,151,26,0)');
    circle(c, 0, 0, r + 4); c.fillStyle = g; c.fill();
    circle(c, 0, 0, r + 2.4); c.strokeStyle = 'rgba(220,134,19,0.85)'; c.lineWidth = 1.05; c.stroke();
    c.restore();
  }
  function paintBall(c, kind, r, hot) {
    var p = PALETTE[kind], g, i, a;
    hotRing(c, r, hot);
    g = c.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.035, r * 0.08, r * 0.10, r * 1.08);
    g.addColorStop(0, p[0]); g.addColorStop(0.49, p[1]); g.addColorStop(0.88, p[2]); g.addColorStop(1, p[3]);
    if (kind === 'C') { hex(c, Math.max(r - 0.35, r * 0.6)); }
    else { circle(c, 0, 0, Math.max(r - 0.9, r * 0.6)); }
    c.fillStyle = g; c.fill(); c.strokeStyle = p[3]; c.lineWidth = Math.min(0.7, r * 0.25); c.stroke();
    if (kind === 'C') {
      hex(c, r * 0.66); c.strokeStyle = 'rgba(255,255,255,0.57)'; c.lineWidth = 0.65; c.stroke();
      c.beginPath();
      for (i = 0; i < 6; i++) {
        a = i * Math.PI / 3;
        c.moveTo(r * 0.67 * Math.cos(a), r * 0.67 * Math.sin(a));
        c.lineTo(r * 0.89 * Math.cos(a), r * 0.89 * Math.sin(a));
      }
      c.strokeStyle = 'rgba(69,82,94,0.31)'; c.lineWidth = 0.6; c.stroke();
    } else {
      c.save(); c.translate(-r * 0.31, -r * 0.39); c.scale(1, 0.65);
      circle(c, 0, 0, r * 0.22); c.fillStyle = 'rgba(255,255,255,0.16)'; c.fill(); c.restore();
    }
  }
  function ball(ctx, kind, x, y, r, s) {
    var d, key, sprite, c, extent, alpha, oldAlpha;
    if (!PALETTE[kind]) { throw new Error('Unknown particle: ' + kind); }
    s = s || EMPTY; r = number(r, 0); alpha = unit(s.alpha, 1);
    if (r <= 0 || !alpha) { return; }
    var hot = unit(s.hot, 0);
    d = density(ctx); key = 'b|' + kind + '|' + r + '|' + d + '|' + hot;
    sprite = cache[key];
    if (!sprite) {
      extent = r + 5;
      if (extent * 2 * d > 2048) {
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= alpha; paintBall(ctx, kind, r, hot); ctx.restore(); return;
      }
      sprite = surface(extent * 2, extent * 2, d);
      c = sprite.canvas.getContext('2d'); c.scale(d, d); c.translate(sprite.width / 2, sprite.height / 2);
      paintBall(c, kind, r, hot); remember(key, sprite);
    }
    oldAlpha = ctx.globalAlpha;
    if (alpha !== 1) { ctx.globalAlpha = oldAlpha * alpha; }
    ctx.drawImage(sprite.canvas, x - sprite.width / 2, y - sprite.height / 2, sprite.width, sprite.height);
    if (alpha !== 1) { ctx.globalAlpha = oldAlpha; }
  }
  function flash(ctx, x, y, t, s) {
    var radius, size, i, a, start;
    s = s || EMPTY; t = unit(t, 0); size = Math.max(0, number(s.size, 1));
    if (t === 1 || !size) { return; }
    radius = s.reduced ? 19 : 8 + 16 * t;
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.globalAlpha *= 1 - t;
    ctx.setLineDash([]); ctx.lineCap = 'round';
    circle(ctx, 0, 0, radius); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(245,158,11,0.17)'; ctx.stroke();
    circle(ctx, 0, 0, radius); ctx.lineWidth = 1.25; ctx.strokeStyle = '#ed9a13'; ctx.stroke();
    if (!s.reduced) {
      circle(ctx, 0, 0, radius - 2.8); ctx.lineWidth = 0.65; ctx.strokeStyle = 'rgba(242,177,60,0.52)'; ctx.stroke();
      start = radius - 5.4; ctx.beginPath();
      for (i = 0; i < 6; i++) {
        a = (i + 0.25) * Math.PI / 3;
        ctx.moveTo(start * Math.cos(a), start * Math.sin(a));
        ctx.lineTo((start + 1.5) * Math.cos(a), (start + 1.5) * Math.sin(a));
      }
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(224,146,23,0.65)'; ctx.stroke();
    }
    ctx.restore();
  }
  function hit(ctx, x, y, t, s) {
    var size, radius;
    s = s || EMPTY; t = unit(t, 0); size = Math.max(0, number(s.size, 1));
    if (t === 1 || !size) { return; }
    radius = s.reduced ? 4.5 : 3.2 + 3 * t;
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.globalAlpha *= 0.64 * (1 - t);
    ctx.setLineDash([]); circle(ctx, 0, 0, radius);
    ctx.lineWidth = 1; ctx.strokeStyle = '#334155'; ctx.stroke(); ctx.restore();
  }
  function paintSolid(c, w, h) {
    var g, i, j, px, py, tone, pitch = 9, rows = Math.ceil(h / 7.8), cols = Math.ceil(w / pitch);
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#568e91'); g.addColorStop(0.5, '#397276'); g.addColorStop(1, '#28585e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    /* A fixed packed-grain lattice, clipped to the physical collision box. */
    for (j = -1; j <= rows; j++) {
      for (i = -1; i <= cols; i++) {
        px = 4 + i * pitch + (j % 2 ? pitch / 2 : 0); py = 4 + j * 7.8;
        tone = ((i * 13 + j * 7 + Math.round(w) + Math.round(h)) % 5 + 5) % 5;
        circle(c, px, py, 3.3); c.fillStyle = ['#477f82', '#4b8588', '#4e8587', '#53898a', '#487d81'][tone]; c.fill();
        c.beginPath(); c.arc(px, py, 2.85, Math.PI * 1.07, Math.PI * 1.72);
        c.strokeStyle = 'rgba(206,232,224,0.24)'; c.lineWidth = 0.65; c.stroke();
        c.beginPath(); c.arc(px, py, 3.2, Math.PI * 0.06, Math.PI * 0.64);
        c.strokeStyle = 'rgba(14,53,59,0.22)'; c.lineWidth = 0.65; c.stroke();
      }
    }
    c.fillStyle = 'rgba(207,233,224,0.22)'; c.fillRect(0, 0, w, 2.2); c.fillRect(0, 0, 2.2, h);
    c.fillStyle = 'rgba(15,49,55,0.25)'; c.fillRect(0, h - 2.2, w, 2.2); c.fillRect(w - 2.2, 0, 2.2, h);
    c.strokeStyle = '#28565c'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1); c.restore();
  }
  function solid(ctx, x, y, w, h, s) {
    var d, key, sprite, c, alpha, oldAlpha;
    s = s || EMPTY; alpha = unit(s.alpha, 1); w = number(w, 0); h = number(h, 0);
    if (w <= 0 || h <= 0 || !alpha) { return; }
    d = density(ctx); key = 's|' + w + '|' + h + '|' + d; sprite = cache[key];
    if (!sprite) {
      if (Math.max(w, h) * d > 2048) {
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= alpha; paintSolid(ctx, w, h); ctx.restore(); return;
      }
      sprite = surface(w, h, d); c = sprite.canvas.getContext('2d'); c.scale(d, d);
      paintSolid(c, w, h); remember(key, sprite);
    }
    oldAlpha = ctx.globalAlpha;
    if (alpha !== 1) { ctx.globalAlpha = oldAlpha * alpha; }
    ctx.drawImage(sprite.canvas, x, y, sprite.width, sprite.height);
    if (alpha !== 1) { ctx.globalAlpha = oldAlpha; }
  }
  function piston(ctx, x, top, bottom, right, s) {
    var g, middle = (top + bottom) / 2, height = bottom - top, alpha, d, layer, c;
    s = s || EMPTY;
    alpha = unit(s.alpha, 1);
    if (height <= 0 || !alpha) { return; }
    /* Fade the complete metal assembly as one layer, without dark overlaps. */
    if (alpha < 1) {
      d = density(ctx); layer = surface(Math.max(12, right - x), height, d);
      c = layer.canvas.getContext('2d'); c.scale(d, d);
      piston(c, 0, 0, height, right - x);
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.drawImage(layer.canvas, x, top, layer.width, layer.height); ctx.restore(); return;
    }
    ctx.save(); ctx.setLineDash([]);
    if (right > x + 12) {
      g = ctx.createLinearGradient(0, middle - 5, 0, middle + 5);
      g.addColorStop(0, '#87939e'); g.addColorStop(0.3, '#eef1f3'); g.addColorStop(0.52, '#c6ced5'); g.addColorStop(1, '#84919d');
      ctx.fillStyle = g; ctx.fillRect(x + 12, middle - 5, right - x - 12, 10);
      ctx.strokeStyle = '#6a7885'; ctx.lineWidth = 0.8; ctx.strokeRect(x + 12.4, middle - 4.6, Math.max(0, right - x - 12.8), 9.2);
    }
    g = ctx.createLinearGradient(x, 0, x + 12, 0);
    g.addColorStop(0, '#647481'); g.addColorStop(0.17, '#cbd4da'); g.addColorStop(0.39, '#edf0f2'); g.addColorStop(0.7, '#b2bdc6'); g.addColorStop(1, '#73828e');
    ctx.fillStyle = g; ctx.fillRect(x, top, 12, height);
    ctx.strokeStyle = '#576976'; ctx.lineWidth = 0.8; ctx.strokeRect(x + 0.4, top + 0.4, 11.2, Math.max(0, height - 0.8));
    ctx.fillStyle = 'rgba(62,79,91,0.23)'; ctx.fillRect(x + 2.2, top + 3, 1, Math.max(0, height - 6));
    ctx.fillStyle = 'rgba(255,255,255,0.67)'; ctx.fillRect(x + 4.2, top + 2, 0.8, Math.max(0, height - 4));
    ctx.restore();
  }
  function legendSwatch(kind, size) {
    var p = PALETTE[kind], id, shape, facets = '';
    if (!p) { throw new Error('Unknown particle: ' + kind); }
    size = Math.max(1, number(size, 24)); id = 'rf-swatch-' + kind + '-' + String(size).replace('.', '-');
    if (kind === 'C') {
      shape = '<path d="M21.4 11.2Q22 12 21.4 12.8L17.4 19.1Q17 19.8 16.1 19.8H7.9Q7 19.8 6.6 19.1L2.6 12.8Q2 12 2.6 11.2L6.6 4.9Q7 4.2 7.9 4.2H16.1Q17 4.2 17.4 4.9Z"';
      facets = '<path d="M18.5 12L15.25 17.63H8.75L5.5 12L8.75 6.37H15.25Z" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width=".65"/>';
    } else { shape = '<circle cx="12" cy="12" r="10"'; }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="34%" cy="31%" r="75%"><stop stop-color="' + p[0] + '"/><stop offset=".49" stop-color="' + p[1] + '"/><stop offset=".88" stop-color="' + p[2] + '"/><stop offset="1" stop-color="' + p[3] + '"/></radialGradient></defs>' + shape + ' fill="url(#' + id + ')" stroke="' + p[3] + '" stroke-width=".7"/>' + facets + '</svg>';
  }
  var cardGlyph = '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="52" height="33" rx="4"/><g fill="currentColor" fill-opacity=".12"><circle cx="18" cy="18" r="4.5"/><circle cx="30" cy="29" r="4"/><circle cx="45" cy="18" r="4.5"/></g><circle cx="45" cy="18" r="8" stroke-width="2" opacity=".55"/><path d="M11 28l4-2M25 14l4-2M39 30l4-2M8 45v12h49M13 53c7 0 8-8 14-8s8 9 25 9M39 43v14"/></g>';
  root.RF_ART = {
    contract: 1, version: '1.0.0', ball: ball, flash: flash, hit: hit,
    solid: solid, piston: piston, legendSwatch: legendSwatch, cardGlyph: cardGlyph,
    info: function () { return { cacheEntries: keys.length }; }
  };
})(window);
/* ==== ART END ==== */

/* ==== UI BEGIN ==== */
(function () {
  "use strict";
  var ART = (window.RF_ART && window.RF_ART.contract >= 1) ? window.RF_ART : null;
  /* 색 단일 원천 */
  var COL = { A: "#f2c230", B: "#8a4fc0", R: "#2b8fb3", P: "#3fa66a", C: "#8b95a3", T1: "#2563eb", T2: "#dc2626", ea: "#111827", dh: "#1d4ed8", pair: "#64748b", hot: "#f59e0b", wall: "#94a3b8", ink: "#1f2937", sub: "#64748b" };
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DT = 1 / 120, FX_LIFE = { hit: 0.45, react: 0.6 }, GHOST_LIFE = 0.7, SWN = 0;
  function $(id) { return document.getElementById(id); }
  var FS = 1;   /* 좁은 화면에서 캔버스 글자가 너무 작아지지 않게 — 화면 글자 크기 ≥ 약 0.8 × 지정값 */
  function font(w, px) { return w + " " + (px * FS).toFixed(1) + "px system-ui, -apple-system, 'Malgun Gothic', sans-serif"; }

  /* ── 캔버스: 논리 크기 W×H 를 폭에 맞춰 dpr 로 그림 ── */
  function Stage(cv, W, H) { this.cv = cv; this.W = W; this.H = H; this.cw = 0; this.dpr = 0; cv.style.aspectRatio = W + "/" + H; this.ctx = cv.getContext("2d"); }
  Stage.prototype.begin = function () {
    var cw = this.cv.clientWidth || this.W, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw !== this.cw || dpr !== this.dpr) { this.cw = cw; this.dpr = dpr; this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(cw * this.H / this.W * dpr); }
    var k = this.cv.width / this.W, c = this.ctx; c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, this.W, this.H);
    FS = Math.max(1, Math.min(2.2, 0.8 * this.W / cw)); return c;
  };

  /* ── 그림: Astra(RF_ART) 우선, 없을 때만 간단한 공 ── */
  function ball(c, k, x, y, r, o) {
    if (ART) { ART.ball(c, k, x, y, r, o); return; }
    o = o || {}; c.save(); c.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    if (o.hot) { c.beginPath(); c.arc(x, y, r + 3.5, 0, 7); c.strokeStyle = COL.hot; c.lineWidth = 2.5; c.stroke(); }
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = COL[k]; c.fill(); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1; c.stroke(); c.restore();
  }
  function flash(c, x, y, t) { if (ART) { ART.flash(c, x, y, t, { reduced: RM }); return; } c.save(); c.globalAlpha = 1 - t; c.beginPath(); c.arc(x, y, RM ? 16 : 6 + 18 * t, 0, 7); c.strokeStyle = COL.hot; c.lineWidth = 3; c.stroke(); c.restore(); }
  function hit(c, x, y, t) { if (ART) { ART.hit(c, x, y, t, { reduced: RM }); return; } c.save(); c.globalAlpha = 1 - t; c.beginPath(); c.arc(x, y, RM ? 8 : 4 + 6 * t, 0, 7); c.strokeStyle = "#334155"; c.lineWidth = 2; c.stroke(); c.restore(); }
  function solid(c, b) { if (ART) { ART.solid(c, b.x, b.y, b.w, b.h, {}); return; } c.fillStyle = "#2f5d6b"; c.fillRect(b.x, b.y, b.w, b.h); }
  function piston(c, x, top, bot, right) { if (ART) { ART.piston(c, x, top, bot, right, {}); return; } c.fillStyle = "#9aa4b1"; c.fillRect(x, top, 12, bot - top); c.fillRect(x + 12, (top + bot) / 2 - 5, right - x - 12, 10); }
  function swatch(k) {
    if (ART && ART.legendSwatch) { var sfx = "_sw" + (++SWN), h = ART.legendSwatch(k, 16); return h.replace(/id="([^"]+)"/g, 'id="$1' + sfx + '"').replace(/url\(#([^)]+)\)/g, "url(#$1" + sfx + ")").replace(/href="#([^"]+)"/g, 'href="#$1' + sfx + '"'); } return '<i class="sw" style="background:' + COL[k] + ';border-radius:50%"></i>'; }

  /* 상자 하나를 (ox, oy)에 그림 — 충돌 표시는 실제 시간으로 옅어진다 */
  function FX() { this.list = []; }
  FX.prototype.take = function (evs, ox, oy) { var self = this; evs.forEach(function (e) { self.list.push({ x: e.x + ox, y: e.y + oy, kind: e.kind, age: 0 }); }); if (this.list.length > 40) this.list.splice(0, this.list.length - 40); };
  FX.prototype.draw = function (c, dt) {
    var keep = [];
    this.list.forEach(function (f) { f.age += dt; var L = FX_LIFE[f.kind]; if (f.age >= L) return; (f.kind === "react" ? flash : hit)(c, f.x, f.y, f.age / L); keep.push(f); });
    this.list = keep;
  };
  function drawBox(c, box, ox, oy, o) {
    o = o || {};
    c.save(); c.translate(ox, oy);
    c.fillStyle = o.tint || "#ffffff"; c.fillRect(0, 0, box.x1, box.H);
    c.beginPath(); c.rect(0, 0, box.x1, box.H); c.clip();
    box.solids.forEach(function (b) { solid(c, b); });
    box.ghosts = box.ghosts.filter(function (g) { return g.age < GHOST_LIFE; }); if (box.ghosts.length > 24) box.ghosts.splice(0, box.ghosts.length - 24);
    box.ghosts.forEach(function (g) { ball(c, "P", g.x, g.y, o.pr || 7, { alpha: 0.85 * (1 - g.age / GHOST_LIFE) }); });
    if (o.pairs) { c.save(); c.setLineDash([5, 5]); c.strokeStyle = COL.pair; c.lineWidth = 1.6; o.pairs.forEach(function (pq) { c.beginPath(); c.moveTo(pq[0].x, pq[0].y); c.lineTo(pq[1].x, pq[1].y); c.stroke(); }); c.restore(); }
    box.ps.forEach(function (p) { ball(c, p.k, p.x, p.y, p.R, { hot: (o.hot && p.k === "R" && box.Ea != null && box.ke(p) >= box.Ea) ? 1 : 0, reduced: RM }); });
    c.lineWidth = 2; c.strokeStyle = COL.wall; c.strokeRect(1, 1, box.x1 - 2, box.H - 2);
    c.restore();
  }
  function label(c, t, x, y, o) { o = o || {}; c.save(); c.font = font(o.w || "700", o.px || 15); c.textAlign = o.align || "left"; c.textBaseline = "top"; var w = c.measureText(t).width; c.fillStyle = "rgba(255,255,255,.9)"; var x0 = o.align === "center" ? x - w / 2 : x; c.fillRect(x0 - 5, y - 3, w + 10, (o.px || 15) + 7); c.fillStyle = o.col || COL.ink; c.fillText(t, x, y); c.restore(); }

  /* ── 측정 표시 공통 ── */
  function measUI(n, meter, ff) {
    var on = meter.on, done = meter.done;
    $("ml" + n).textContent = on ? "세는 중" : (done ? "세기 끝 — 표에 적었습니다" : "세기 전");
    $("mf" + n).textContent = on && ff > 1 ? "빨리 감기 ×" + ff : "";
    $("mb" + n).style.width = (100 * meter.t / meter.dur).toFixed(1) + "%";
  }
  function segBtns(host, labels, onPick) {
    var bs = labels.map(function (t, i) { var b = document.createElement("button"); b.type = "button"; b.textContent = t; b.setAttribute("aria-pressed", i === 0 ? "true" : "false"); b.addEventListener("click", function () { onPick(i); }); host.appendChild(b); return b; });
    return { set: function (i) { bs.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); }); }, dis: function (d) { bs.forEach(function (b) { b.disabled = d; }); }, bs: bs };
  }
  /* 시간을 돌린다: 측정 중이면 ×ff, 끝나는 순간에 정확히 멈춘다 */
  function run(tab, dtReal, ff) {
    var sim = Math.min(0.05, dtReal) * ff, n = Math.max(1, Math.ceil(sim / DT - 1e-9)), h = sim / n, fin = false;
    for (var i = 0; i < n && !fin; i++) fin = tab.step(h);
    return fin;
  }

  /* ════════ 탭 ① ════════ */
  var T1 = (function () {
    var C = RFC.C1, tab = new RFC.Tab1(11), st = new Stage($("st1"), C.W, C.H), fx = new FX(), rows = {}, cur = 0, ff = 1;
    var seg = segBtns($("cond1"), C.CONDS.map(function (c) { return "(" + c[0] + ", " + c[1] + ")"; }), function (i) { if (tab.meter.on) return; cur = i; tab.set(i); seg.set(i); fx.list = []; $("c1").textContent = "0"; table(); });
    function table() {
      var h = '<tr><th scope="row">A의 입자 수</th>' + C.CONDS.map(function (c) { return "<td>" + c[0] + "</td>"; }).join("") + "</tr>";
      h += '<tr><th scope="row">B의 입자 수</th>' + C.CONDS.map(function (c) { return "<td>" + c[1] + "</td>"; }).join("") + "</tr>";
      h += '<tr><th scope="row">단위 시간당 충돌수</th>' + C.CONDS.map(function (c, i) { return rows[i] != null ? '<td class="v">' + rows[i] + "</td>" : '<td class="e">—</td>'; }).join("") + "</tr>";
      $("tb1").innerHTML = h;
      var cells = $("tb1").querySelectorAll("tr"); for (var r = 0; r < cells.length; r++) { var tds = cells[r].querySelectorAll("td"); for (var j = 0; j < tds.length; j++) if (j === cur) tds[j].parentNode.className = ""; }
      var tds2 = $("tb1").querySelectorAll("td"); for (var q = 0; q < tds2.length; q++) tds2[q].style.background = (q % 4 === cur) ? "#eff6ff" : "";
    }
    $("go1").addEventListener("click", function () { tab.box.resetCount(); tab.meter.start(); ff = C.FF; fx.list = []; });
    $("clr1").addEventListener("click", function () { if (tab.meter.on) return; rows = {}; table(); });
    $("lgd1").innerHTML = "<span>" + swatch("A") + " A</span> · <span>" + swatch("B") + " B</span> · 작은 고리 = A와 B가 부딪친 자리";
    table();
    return {
      frame: function (dt) {
        if (run(tab, dt, ff)) { rows[cur] = tab.box.cnt.coll; ff = 1; table(); }
        fx.take(tab.box.drain().filter(function () { return true; }), 0, 0);
        var c = st.begin(); drawBox(c, tab.box, 0, 0, { pairs: $("pair1").checked ? tab.pairs() : null }); fx.draw(c, dt);
        $("c1").textContent = tab.meter.on ? tab.box.cnt.coll : (tab.meter.done && rows[cur] != null ? rows[cur] : 0); measUI(1, tab.meter, ff);
        seg.dis(tab.meter.on); $("go1").disabled = tab.meter.on; $("clr1").disabled = tab.meter.on;
      },
      state: function () { return { cur: cur, rows: rows, coll: tab.box.cnt.coll, meas: tab.meter.on, done: tab.meter.done, ff: ff, n: tab.box.ps.length, pairs: tab.pairs().length }; },
      tab: tab, pick: function (i) { seg.bs[i].click(); }
    };
  })();

  /* ════════ 탭 ② ════════ */
  var T2 = (function () {
    var C = RFC.C2, M = 64, tab = new RFC.Tab2(21), st = new Stage($("st2"), C.W + M, C.H), fx = new FX(), rows = {}, ff = 1, p0 = null, pNow = null;
    var seg = segBtns($("cond2"), ["처음 부피", "부피를 절반으로"], function (i) { if (tab.meter.on || tab.target != null) return; tab.pushTo(i); seg.set(i); fx.list = []; $("c2").textContent = "0"; table(); });
    function table() {
      var names = ["처음 부피", "부피 절반"], h = "<tr><th>피스톤</th><th>A·B 입자 수</th><th>압력</th><th>단위 시간당 충돌수</th></tr>";
      [0, 1].forEach(function (i) { var r = rows[i]; h += "<tr" + (i === tab.vi ? ' class="now"' : "") + "><td>" + names[i] + "</td><td>" + C.NA + " · " + C.NB + "</td>" + (r ? '<td class="v">' + r.p + '</td><td class="v">' + r.c + "</td>" : '<td class="e">—</td><td class="e">—</td>') + "</tr>"; });
      $("tb2").innerHTML = h;
    }
    function pText(v) { return p0 ? "처음의 " + (v / p0).toFixed(1) + "배" : "—"; }
    $("go2").addEventListener("click", function () { if (tab.target != null) return; tab.box.resetCount(); tab.meter.start(); ff = C.FF; fx.list = []; });
    $("clr2").addEventListener("click", function () { if (tab.meter.on) return; rows = {}; p0 = null; table(); $("p2").textContent = "—"; });
    $("lgd2").innerHTML = "<span>" + swatch("A") + " A</span> · <span>" + swatch("B") + " B</span> · 작은 고리 = A와 B가 부딪친 자리";
    table();
    return {
      frame: function (dt) {
        if (run(tab, dt, ff)) {
          var b = tab.box, pw = b.cnt.wall / b.perim(); if (tab.vi === 0) p0 = pw; pNow = pw;
          rows[tab.vi] = { c: b.cnt.coll, p: tab.vi === 0 ? "처음 압력" : (p0 ? "처음의 " + (pw / p0).toFixed(1) + "배" : "—") }; ff = 1; table();
          $("p2").textContent = tab.vi === 0 ? "처음" : pText(pw);
        }
        fx.take(tab.box.drain(), 0, 0);
        var c = st.begin(), b2 = tab.box;
        c.fillStyle = "#f1f5f9"; c.fillRect(b2.x1, 0, C.W + M - b2.x1, C.H);
        drawBox(c, b2, 0, 0, {}); fx.draw(c, dt);
        piston(c, b2.x1, 2, C.H - 2, C.W + M - 2);
        $("c2").textContent = tab.meter.on ? b2.cnt.coll : (tab.meter.done && rows[tab.vi] ? rows[tab.vi].c : 0); measUI(2, tab.meter, ff);
        var busy = tab.meter.on || tab.target != null; seg.dis(busy); $("go2").disabled = busy; $("clr2").disabled = tab.meter.on;
      },
      state: function () { return { vi: tab.vi, x1: tab.box.x1, rows: rows, coll: tab.box.cnt.coll, meas: tab.meter.on, n: tab.box.ps.length, p0: p0, pNow: pNow }; },
      tab: tab, pick: function (i) { seg.bs[i].click(); }
    };
  })();

  /* ════════ 탭 ③ ════════ */
  var T3 = (function () {
    var C = RFC.C3, tab = new RFC.Tab3(31), st = new Stage($("st3"), C.W, C.H), fx = new FX(), rows = {}, cur = 0, ff = 1, e0 = null;
    var names = ["덩어리 1개", "4조각", "16조각"];
    var seg = segBtns($("cond3"), names, function (i) { if (tab.meter.on) return; cur = i; tab.set(i); seg.set(i); fx.list = []; $("c3").textContent = "0"; table(); });
    function edgeTxt() { return (tab.edge() / e0).toFixed(0) + "배"; }
    function table() {
      var h = "<tr><th>고체</th><th>고체의 양</th><th>겉면 길이</th><th>단위 시간당 충돌수</th></tr>", save = cur;
      names.forEach(function (nm, i) { var L = RFC.solidLayout(C.CUTS[i]), e = 0; L.forEach(function (b) { e += 2 * (b.w + b.h); }); h += "<tr" + (i === save ? ' class="now"' : "") + "><td>" + nm + "</td><td>같음</td><td>" + (e / e0).toFixed(0) + "배</td>" + (rows[i] != null ? '<td class="v">' + rows[i] + "</td>" : '<td class="e">—</td>') + "</tr>"; });
      $("tb3").innerHTML = h; $("e3").textContent = edgeTxt();
    }
    e0 = (function () { var e = 0; RFC.solidLayout(1).forEach(function (b) { e += 2 * (b.w + b.h); }); return e; })();
    $("go3").addEventListener("click", function () { tab.box.resetCount(); tab.meter.start(); ff = C.FF; fx.list = []; });
    $("clr3").addEventListener("click", function () { if (tab.meter.on) return; rows = {}; table(); });
    $("lgd3").innerHTML = "<span>" + swatch("B") + " 기체 B</span> · 가운데 = 고체 반응물 · 작은 고리 = B가 고체 표면에 부딪친 자리";
    table();
    return {
      frame: function (dt) {
        if (run(tab, dt, ff)) { rows[cur] = tab.box.cnt.hit; ff = 1; table(); }
        fx.take(tab.box.drain(), 0, 0);
        var c = st.begin(); drawBox(c, tab.box, 0, 0, {}); fx.draw(c, dt);
        $("c3").textContent = tab.meter.on ? tab.box.cnt.hit : (tab.meter.done && rows[cur] != null ? rows[cur] : 0); measUI(3, tab.meter, ff);
        seg.dis(tab.meter.on); $("go3").disabled = tab.meter.on; $("clr3").disabled = tab.meter.on;
      },
      state: function () { return { cur: cur, rows: rows, hit: tab.box.cnt.hit, meas: tab.meter.on, area: tab.area(), edge: tab.edge(), pieces: tab.box.solids.length, solids: tab.box.solids }; },
      tab: tab, pick: function (i) { seg.bs[i].click(); }
    };
  })();

  /* ── 운동 에너지 막대그래프 (탭 ④⑤ 공통) ── */
  function distGraph(st, series, lines, emax, ymaxHint) {
    var c = st.begin(), W = st.W, H = st.H, L = 52, R = 14, T = 16, B = 40, gw = W - L - R, gh = H - T - B, bins = series[0].v.length, bw = gw / bins, i;
    var ym = ymaxHint || 1; series.forEach(function (s) { s.v.forEach(function (v) { ym = Math.max(ym, v); }); }); ym *= 1.12;
    function X(e) { return L + e / emax * gw; } function Y(v) { return T + gh - v / ym * gh; }
    c.strokeStyle = "#cbd5e1"; c.lineWidth = 1; c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + gh); c.lineTo(L + gw, T + gh); c.stroke();
    series.forEach(function (s) {
      var ea = s.ea;
      for (i = 0; i < bins; i++) { var e0 = i * emax / bins, v = s.v[i]; if (v <= 0) continue; c.fillStyle = s.col; c.globalAlpha = (ea != null && e0 >= ea - 1e-9) ? 0.62 : 0.16; c.fillRect(X(e0) + 0.5, Y(v), bw - 1, T + gh - Y(v)); }
      c.globalAlpha = 1; c.strokeStyle = s.col; c.lineWidth = 2.2; c.beginPath();
      for (i = 0; i < bins; i++) { var y = Y(s.v[i]); if (i === 0) c.moveTo(X(0), y); else c.lineTo(X(i * emax / bins), y); c.lineTo(X((i + 1) * emax / bins), y); }
      c.stroke();
    });
    lines.forEach(function (ln) {
      var x = X(ln.e); c.save(); c.setLineDash(ln.dash || [6, 4]); c.strokeStyle = ln.col || COL.ea; c.lineWidth = 2; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + gh); c.stroke(); c.restore();
      c.font = font("700", 14); c.fillStyle = ln.col || COL.ea; c.textAlign = "center"; c.textBaseline = "top"; c.fillText(ln.t, x, T + gh + 4 + (ln.row || 0) * 0);
    });
    c.fillStyle = COL.sub; c.font = font("600", 13); c.textAlign = "right"; c.textBaseline = "bottom"; c.fillText("운동 에너지 →", L + gw, H - 2);
    c.save(); c.translate(16, T + gh / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("분자 수 →", 0, 0); c.restore();
    return { X: X, Y: Y, ym: ym };
  }

  /* ════════ 탭 ④ ════════ */
  var T4 = (function () {
    var C = RFC.C4, tab = new RFC.Tab4(41), GAP = 20, st = new Stage($("st4"), C.W * 2 + GAP, C.H + 34), g = new Stage($("g4"), 960, 330), fx = [new FX(), new FX()], rows = null, ff = 1;
    function table() {
      var h = "<tr><th>조건</th><th>충돌수</th><th>반응한 분자 수</th></tr>";
      ["T₁", "T₂"].forEach(function (nm, i) { var r = rows && rows[i]; h += "<tr><td>" + nm + "</td>" + (r ? '<td class="v">' + r.c + '</td><td class="v">' + r.r + "</td>" : '<td class="e">—</td><td class="e">—</td>') + "</tr>"; });
      $("tb4").innerHTML = h;
    }
    $("go4").addEventListener("click", function () { tab.boxes.forEach(function (b) { b.resetCount(); }); tab.meter.start(); ff = C.FF; });
    $("clr4").addEventListener("click", function () { if (tab.meter.on) return; rows = null; table(); });
    $("lgd4").innerHTML = "<span>" + swatch("R") + " 반응물</span> · <span>" + swatch("P") + " 생성물(옅어지며 빠져나감)</span> · 주황 테두리 = 활성화 에너지(Eₐ) 이상의 운동 에너지를 가진 분자 · 번쩍임 = 반응";
    $("gl4").innerHTML = '<span><i class="sw" style="background:' + COL.T1 + '"></i> T₁</span><span><i class="sw" style="background:' + COL.T2 + '"></i> T₂</span><span>점선 = 활성화 에너지(Eₐ)</span>';
    table();
    return {
      frame: function (dt) {
        if (run(tab, dt, ff)) { rows = tab.boxes.map(function (b) { return { c: b.cnt.coll, r: b.cnt.react }; }); ff = 1; table(); }
        var c = st.begin(), hot = $("hot4").checked;
        tab.boxes.forEach(function (b, i) {
          var ox = i * (C.W + GAP); fx[i].take(b.drain(), ox, 34);
          drawBox(c, b, ox, 34, { hot: hot, pr: C.R });
          label(c, i ? "T₂ (더 높은 온도)" : "T₁", ox + 6, 6, { col: i ? COL.T2 : COL.T1 });
        });
        fx[0].draw(c, dt); fx[1].draw(c, dt);
        var sh4 = tab.meter.on ? tab.boxes.map(function (b) { return { c: b.cnt.coll, r: b.cnt.react }; }) : (tab.meter.done && rows ? rows : [{ c: 0, r: 0 }, { c: 0, r: 0 }]);
        $("c4a").textContent = sh4[0].c; $("c4b").textContent = sh4[1].c; $("r4a").textContent = sh4[0].r; $("r4b").textContent = sh4[1].r;
        measUI(4, tab.meter, ff); $("go4").disabled = tab.meter.on; $("clr4").disabled = tab.meter.on;
        var h0 = tab.hist[0].avg(), h1 = tab.hist[1].avg();
        distGraph(g, [{ v: h0, col: COL.T1, ea: tab.eaLine(0) }, { v: h1, col: COL.T2, ea: tab.eaLine(1) }], (function () { var e0 = tab.eaLine(0), e1 = tab.eaLine(1); return e0 === e1 ? [{ e: e0, t: "Eₐ" }] : [{ e: e0, t: "Eₐ(T₁)", col: COL.T1 }, { e: e1, t: "Eₐ(T₂)", col: COL.T2 }]; })(), C.EMAX, 6);
      },
      state: function () { return { rows: rows, meas: tab.meter.on, cnt: tab.boxes.map(function (b) { return b.cnt; }), ea: [tab.eaLine(0), tab.eaLine(1)], hist: [tab.hist[0].avg(), tab.hist[1].avg()], histN: tab.hist[0].n, hot: tab.boxes.map(function (b) { return b.hotCount(); }), n: tab.boxes.map(function (b) { return b.ps.length; }) }; },
      tab: tab
    };
  })();

  /* ════════ 탭 ⑤ ════════ */
  var T5 = (function () {
    var C = RFC.C5, tab = new RFC.Tab5(51), GAP = 20, st = new Stage($("st5"), C.W * 2 + GAP, C.H + 34), g = new Stage($("g5"), 560, 300), hs = new Stage($("h5"), 460, 300), fx = [new FX(), new FX()], rows = {}, ff = 1, modes = ["pos", "neg"];
    var seg = segBtns($("cond5"), ["정촉매", "부촉매"], function (i) { if (tab.meter.on) return; tab.setMode(modes[i]); seg.set(i); fx.forEach(function (f) { f.list = []; }); table(); });
    function nm() { return tab.mode === "pos" ? "정촉매" : "부촉매"; }
    function table() {
      var h = "<tr><th>용기</th><th>충돌수</th><th>반응한 분자 수</th></tr>";
      [["none", "촉매 없음"], ["pos", "정촉매"], ["neg", "부촉매"]].forEach(function (k) { var r = rows[k[0]]; h += "<tr" + (k[0] === tab.mode ? ' class="now"' : "") + "><td>" + k[1] + "</td>" + (r ? '<td class="v">' + r.c + '</td><td class="v">' + r.r + "</td>" : '<td class="e">—</td><td class="e">—</td>') + "</tr>"; });
      $("tb5").innerHTML = h;
    }
    function path(c, X, Y, ea, base, prod, col, dash, lw) {
      c.save(); c.strokeStyle = col; c.lineWidth = lw || 2.6; if (dash) c.setLineDash(dash); c.beginPath();
      for (var i = 0; i <= 60; i++) { var x = i / 60, y; if (x < 0.5) y = base + (ea) * Math.pow(Math.sin(Math.PI * x), 2); else y = prod + (base + ea - prod) * Math.pow(Math.sin(Math.PI * x), 2); var px = X(x), py = Y(y); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke(); c.restore();
    }
    function arrow(c, x, y0, y1, col, txt, side) {
      c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
      var d = y1 < y0 ? 1 : -1; c.beginPath(); c.moveTo(x, y1); c.lineTo(x - 5, y1 + 8 * d); c.lineTo(x + 5, y1 + 8 * d); c.closePath(); c.fill();
      c.font = font("700", 16); c.textAlign = side < 0 ? "right" : "left"; c.textBaseline = "middle"; c.fillText(txt, x + 8 * side, (y0 + y1) / 2); c.restore();
    }
    function hill() {
      var c = hs.begin(), W = hs.W, H = hs.H, L = 40, R = 16, T = 16, B = 34, gw = W - L - R, gh = H - T - B, base = 3, prod = 1.6, top = base + C.EA_NEG + 0.8;
      function X(x) { return L + (0.06 + 0.88 * x) * gw; } function Y(y) { return T + gh - y / top * gh; }
      c.strokeStyle = "#cbd5e1"; c.lineWidth = 1; c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + gh); c.lineTo(L + gw, T + gh); c.stroke();
      var e2 = tab.eaCat();
      path(c, X, Y, C.EA, base, prod, "#334155", null, 2.6);
      path(c, X, Y, e2, base, prod, tab.mode === "pos" ? "#059669" : "#b45309", [7, 5], 2.6);
      c.save(); c.strokeStyle = "#94a3b8"; c.setLineDash([3, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(X(0), Y(base)); c.lineTo(X(1), Y(base)); c.moveTo(X(0.5), Y(base + Math.max(C.EA, e2))); c.lineTo(X(0.5), Y(base + Math.max(C.EA, e2))); c.moveTo(X(0.62), Y(prod)); c.lineTo(X(1), Y(prod)); c.stroke(); c.restore();
      arrow(c, X(0.5) - 34, Y(base), Y(base + C.EA), COL.ea, "Eₐ", -1);
      arrow(c, X(0.5) + 34, Y(base), Y(base + e2), tab.mode === "pos" ? "#059669" : "#b45309", tab.mode === "pos" ? "Eₐ′" : "Eₐ″", 1);
      arrow(c, X(0.8), Y(base), Y(prod), COL.dh, "ΔH", -1);
      c.font = font("600", 13); c.fillStyle = COL.ink; c.textAlign = "left"; c.textBaseline = "bottom"; c.fillText("반응물", X(0) - 2, Y(base) - 4);
      c.textAlign = "right"; c.textBaseline = "top"; c.fillText("생성물", X(1) + 2, Y(prod) + 5);
      c.fillStyle = COL.sub; c.textAlign = "right"; c.textBaseline = "bottom"; c.fillText("반응 경로 →", L + gw, H - 2);
      c.save(); c.translate(14, T + gh / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("엔탈피 →", 0, 0); c.restore();
      $("hl5").innerHTML = '<span><i class="sw" style="background:#334155"></i> 촉매 없음</span><span><i class="sw" style="background:' + (tab.mode === "pos" ? "#059669" : "#b45309") + '"></i> ' + nm() + '</span><span><i class="sw" style="background:' + COL.dh + '"></i> 반응 엔탈피(ΔH)</span>';
    }
    $("go5").addEventListener("click", function () { tab.boxes.forEach(function (b) { b.resetCount(); }); tab.meter.start(); ff = C.FF; });
    $("clr5").addEventListener("click", function () { if (tab.meter.on) return; rows = {}; table(); });
    $("lgd5").innerHTML = "<span>" + swatch("R") + " 반응물</span> · <span>" + swatch("P") + " 생성물</span> · <span>" + swatch("C") + " 촉매</span> · 주황 테두리 = 그 용기의 활성화 에너지 이상인 분자 · 번쩍임 = 반응";
    table();
    return {
      frame: function (dt) {
        if (run(tab, dt, ff)) { var a = tab.boxes[0].cnt, b = tab.boxes[1].cnt; rows.none = { c: a.coll, r: a.react }; rows[tab.mode] = { c: b.coll, r: b.react }; ff = 1; table(); }
        var c = st.begin(), hot = $("hot5").checked;
        tab.boxes.forEach(function (bx, i) {
          var ox = i * (C.W + GAP); fx[i].take(bx.drain(), ox, 34);
          drawBox(c, bx, ox, 34, { hot: hot, pr: C.R, tint: i ? "#fbfaf6" : "#ffffff" });
          label(c, i ? "촉매 넣음 (" + nm() + ")" : "촉매 없음", ox + 6, 6, { col: i ? (tab.mode === "pos" ? "#047857" : "#92400e") : COL.ink });
        });
        fx[0].draw(c, dt); fx[1].draw(c, dt);
        var z = { c: 0, r: 0 }, sh5 = tab.meter.on ? tab.boxes.map(function (b) { return { c: b.cnt.coll, r: b.cnt.react }; }) : (tab.meter.done ? [rows.none || z, rows[tab.mode] || z] : [z, z]);
        $("c5a").textContent = sh5[0].c; $("c5b").textContent = sh5[1].c; $("r5a").textContent = sh5[0].r; $("r5b").textContent = sh5[1].r; $("k5").textContent = tab.catCount();
        measUI(5, tab.meter, ff); seg.dis(tab.meter.on); $("go5").disabled = tab.meter.on; $("clr5").disabled = tab.meter.on;
        var e2 = tab.eaCat(), col2 = tab.mode === "pos" ? "#059669" : "#b45309";
        distGraph(g, [{ v: tab.hist.avg(), col: "#475569", ea: Math.min(C.EA, e2) }], [{ e: C.EA, t: "Eₐ" }, { e: e2, t: tab.mode === "pos" ? "Eₐ′" : "Eₐ″", col: col2 }], RFC.C4.EMAX, 6);
        $("gl5").innerHTML = '<span>검은 점선 Eₐ = 촉매 없음</span><span style="color:' + col2 + '">' + (tab.mode === "pos" ? "Eₐ′ = 정촉매" : "Eₐ″ = 부촉매") + "</span><span>진한 막대 = 더 낮은 쪽 문턱 이상인 분자</span>";
        hill();
      },
      state: function () { return { mode: tab.mode, rows: rows, meas: tab.meter.on, cnt: tab.boxes.map(function (b) { return b.cnt; }), ea: tab.boxes.map(function (b) { return b.Ea; }), cat: tab.catCount(), hot: tab.boxes.map(function (b) { return b.hotCount(); }) }; },
      tab: tab, pick: function (i) { seg.bs[i].click(); }
    };
  })();

  /* ── 탭 전환 · 고리 ── */
  var TABS = { 1: T1, 2: T2, 3: T3, 4: T4, 5: T5 }, cur = "1";
  function showTab(n) {
    cur = String(n);
    Array.prototype.forEach.call(document.querySelectorAll(".tabb"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-tab") === cur ? "true" : "false"); });
    Array.prototype.forEach.call(document.querySelectorAll(".pane"), function (p) { p.hidden = p.getAttribute("data-pane") !== cur; });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tabb"), function (b) { b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); }); });
  var last = 0, frozen = false;
  function loop(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60; last = ts;
    if (!frozen) TABS[cur].frame(dt);
    requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", function () { last = 0; });
  requestAnimationFrame(loop);
  /* 검사용 고리(화면 동작은 바꾸지 않음) */
  window.__rf = {
    showTab: showTab, T: TABS, art: function () { return ART ? ART.version : null; },
    advance: function (sec, step) { frozen = true; step = step || 1 / 60; for (var t = 0; t < sec - 1e-9; t += step) TABS[cur].frame(step); return TABS[cur].state(); },
    thaw: function () { frozen = false; last = 0; }
  };
})();
