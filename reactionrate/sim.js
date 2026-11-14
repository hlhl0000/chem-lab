/* 화학 반응 속도 (화학탐구실 reactionrate/) — 조립 산출물. 정본: 검증스크립트/reactionrate_core.js · _reactionrate_fx/rr_art.part.js(Astra) · _reactionrate_ui.part.js
   조립: node 검증스크립트/_reactionrate_assemble.js · 근거: 설계지시안_화학반응속도_v1.1.md */
/* ==== CORE BEGIN ==== */
var RRC = (function () {
  "use strict";

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ── 모양: [원소, x, y, r] · R · (N2O4) halves {x,y,a} ── */
  var KINDS = ["NO", "O2", "NO2", "N2O4", "H2", "N2", "H2O"];
  function fallbackShape(kind) {   /* Astra 모듈이 없을 때만 — 시안 rr.js 공 모형과 같은 비율 */
    var H = 3.4, N = 4.5, O = 4.05;
    function bent(c, o, b, deg, rc, ro) { var h = deg * Math.PI / 360, s = Math.sin(h), k = Math.cos(h); return [[c, 0, -b * k / 3, rc], [o, -b * s, b * k * 2 / 3, ro], [o, b * s, b * k * 2 / 3, ro]]; }
    var a, halves = null;
    if (kind === "NO") a = [["N", -3.3, 0, N], ["O", 3.3, 0, O]];
    else if (kind === "O2") a = [["O", -3.1, 0, O], ["O", 3.1, 0, O]];
    else if (kind === "N2") a = [["N", -3.3, 0, N], ["N", 3.3, 0, N]];
    else if (kind === "H2") a = [["H", -2.4, 0, H], ["H", 2.4, 0, H]];
    else if (kind === "NO2") a = bent("N", "O", 6.8, 134, N, O);
    else if (kind === "H2O") a = bent("O", "H", 5.9, 104.5, O, H);
    else if (kind === "N2O4") {
      /* NO2 두 개를 N–N 으로: 반쪽 i 는 NO2 를 각 a_i 로 돌려 (x_i, 0) 에 놓은 것 */
      var no2 = fallbackShape("NO2").atoms, d = 4.4 + 6.8 * Math.cos(67 * Math.PI / 180) / 3;   /* N 이 ±4.4 에 오도록 NO2 중심을 놓음 */
      halves = [{ x: d, y: 0, a: -Math.PI / 2 }, { x: -d, y: 0, a: Math.PI / 2 }];
      a = [];
      halves.forEach(function (hv) { var c = Math.cos(hv.a), s = Math.sin(hv.a); no2.forEach(function (t) { a.push([t[0], hv.x + t[1] * c - t[2] * s, hv.y + t[1] * s + t[2] * c, t[3]]); }); });
    } else throw new Error("모르는 분자 " + kind);
    var R = 0; a.forEach(function (t) { R = Math.max(R, Math.sqrt(t[1] * t[1] + t[2] * t[2]) + t[3]); });
    var out = { atoms: a, R: R }; if (halves) out.halves = halves; return out;
  }
  var shapeSrc = fallbackShape, usingArt = false, CACHE = {};
  function setShapes(art) {
    CACHE = {};
    if (art && art.contract >= 1 && typeof art.shape === "function") { shapeSrc = function (k) { return art.shape(k); }; usingArt = true; }
    else { shapeSrc = fallbackShape; usingArt = false; }
  }
  function shape(kind) { if (!CACHE[kind]) CACHE[kind] = shapeSrc(kind); return CACHE[kind]; }
  function atomCount(kind) { var c = { N: 0, O: 0, H: 0 }; shape(kind).atoms.forEach(function (t) { c[t[0]]++; }); return c; }
  /* 분자 국소점 → 무대 */
  function local(m, lx, ly) { var c = Math.cos(m.a), s = Math.sin(m.a); return [m.x + lx * c - ly * s, m.y + lx * s + ly * c]; }
  function worldAtoms(m) { return shape(m.k).atoms.map(function (t) { var p = local(m, t[1], t[2]); return [t[0], p[0], p[1]]; }); }

  /* ── 엔진 ── o: W,H,seed,v0,kinds(이 무대에 나오는 종 — 격자 칸 유도) */
  function World(o) {
    this.W = o.W; this.H = o.H; this.r = rng(o.seed || 1); this.v0 = o.v0 || 70;
    this.mols = []; this.nextId = 1; this.t = 0;
    var mx = 0; (o.kinds || KINDS).forEach(function (k) { mx = Math.max(mx, shape(k).R); });
    this.cell = Math.ceil(2 * mx);   /* 3×3 이웃 탐색이 놓치지 않는 최소 칸(B11 · 원칙 13) */
  }
  World.prototype.add = function (k, x, y, vx, vy, a, w) {
    var m = { id: this.nextId++, k: k, R: shape(k).R, x: x, y: y, vx: vx, vy: vy, a: a || 0, w: w || 0, dead: false, born: this.t, life: null, inT: null };
    this.mols.push(m); return m;
  };
  World.prototype.randVel = function () { var s = this.v0 * (0.75 + 0.5 * this.r()), th = 2 * Math.PI * this.r(); return [s * Math.cos(th), s * Math.sin(th)]; };
  World.prototype.place = function (k) {
    var R = shape(k).R, g = 0, x, y, ok, i, m;
    for (;;) {
      x = R + this.r() * (this.W - 2 * R); y = R + this.r() * (this.H - 2 * R); ok = true;
      if (++g < 3000) for (i = 0; i < this.mols.length; i++) { m = this.mols[i]; if (m.dead) continue; var dx = m.x - x, dy = m.y - y, s = m.R + R + 1; if (dx * dx + dy * dy < s * s) { ok = false; break; } }
      if (ok) break;
    }
    var v = this.randVel();
    return this.add(k, x, y, v[0], v[1], 2 * Math.PI * this.r(), (this.r() - 0.5) * 2.4);
  };
  World.prototype.fill = function (k, n) { for (var i = 0; i < n; i++) this.place(k); };
  World.prototype.compact = function () { this.mols = this.mols.filter(function (m) { return !m.dead; }); };
  World.prototype.clear = function () { this.mols = []; };
  World.prototype.count = function (k) { var n = 0; for (var i = 0; i < this.mols.length; i++) if (!this.mols[i].dead && this.mols[i].k === k) n++; return n; };
  World.prototype.atoms = function () { var c = { N: 0, O: 0, H: 0 }; this.mols.forEach(function (m) { if (m.dead) return; var q = atomCount(m.k); c.N += q.N; c.O += q.O; c.H += q.H; }); return c; };
  World.prototype.rmsSpeed = function () { var s = 0, n = 0; this.mols.forEach(function (m) { if (m.dead) return; s += m.vx * m.vx + m.vy * m.vy; n++; }); return n ? Math.sqrt(s / n) : 0; };
  World.prototype.nearest = function (x, y, k, ex) {
    var best = null, bd = 1e18;
    for (var i = 0; i < this.mols.length; i++) { var m = this.mols[i]; if (m.dead || m.k !== k || (ex && ex.indexOf(m) >= 0)) continue; var dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } }
    return best;
  };
  World.prototype.step = function (dt) {
    var ms = this.mols, W = this.W, H = this.H, i, j, n = ms.length, cell = this.cell;
    this.t += dt;
    for (i = 0; i < n; i++) {
      var m = ms[i]; if (m.dead) continue;
      m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.w * dt;
      if (m.x < m.R) { m.x = m.R; m.vx = Math.abs(m.vx); } else if (m.x > W - m.R) { m.x = W - m.R; m.vx = -Math.abs(m.vx); }
      if (m.y < m.R) { m.y = m.R; m.vy = Math.abs(m.vy); } else if (m.y > H - m.R) { m.y = H - m.R; m.vy = -Math.abs(m.vy); }
    }
    var cw = Math.ceil(W / cell) + 1, ch = Math.ceil(H / cell) + 1, head = new Int32Array(cw * ch), next = new Int32Array(n), k;
    for (k = 0; k < head.length; k++) head[k] = -1;
    for (i = 0; i < n; i++) { if (ms[i].dead) continue; k = Math.min(cw - 1, Math.max(0, ms[i].x / cell | 0)) + Math.min(ch - 1, Math.max(0, ms[i].y / cell | 0)) * cw; next[i] = head[k]; head[k] = i; }
    for (i = 0; i < n; i++) {
      var p = ms[i]; if (p.dead) continue;
      var cx = Math.min(cw - 1, Math.max(0, p.x / cell | 0)), cy = Math.min(ch - 1, Math.max(0, p.y / cell | 0)), gx, gy;
      for (gx = cx - 1; gx <= cx + 1; gx++) for (gy = cy - 1; gy <= cy + 1; gy++) {
        if (gx < 0 || gy < 0 || gx >= cw || gy >= ch) continue;
        for (j = head[gx + gy * cw]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          var q = ms[j]; if (q.dead) continue;
          if (p.pair === q.id && this.t < p.pairUntil) continue;   /* 갈라진 짝은 잠깐 서로 밀어내지 않는다 — 다음 걸음에 ≈ 4 px 튀던 것(S-검토 C3) */
          var dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, s = p.R + q.R;
          if (d2 >= s * s || d2 === 0) continue;
          var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (s - d) / 2;
          p.x -= nx * ov; p.y -= ny * ov; q.x += nx * ov; q.y += ny * ov;
          var vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (vn < 0) { p.vx += vn * nx; p.vy += vn * ny; q.vx -= vn * nx; q.vy -= vn * ny; }
        }
      }
    }
  };

  /* ════════ 탭 ① — N₂O₄ → 2NO₂ (1차 분해) ════════ */
  var T1C = { W: 720, H: 400, N0: 150, K: Math.LN2 / 8, TMAX: 40, T1: 8, T2: 20, REC: 0.1, SUB: 2 };
  function Tab1(seed) {
    this.seed = seed || 29; this.reset();
  }
  Tab1.prototype.reset = function () {
    this.w = new World({ W: T1C.W, H: T1C.H, seed: this.seed, v0: 70, kinds: ["N2O4", "NO2"] });
    this.w.fill("N2O4", T1C.N0);
    this.v0 = this.w.rmsSpeed(); this.nA = T1C.N0; this.nB = 0; this.rec = []; this.events = []; this.started = false; this.rt = 0;
    this.splitsBefore = 0; this.lastSplit = null; this.inject = null;
  };
  Tab1.prototype.start = function () { if (this.started) return; this.started = true; this.rt = 0; this.record(); };
  Tab1.prototype.record = function () { this.rec.push({ t: Math.round(this.rt / T1C.REC) * T1C.REC, a: this.nA, b: this.nB, scanA: this.w.count("N2O4"), scanB: this.w.count("NO2") }); };
  Tab1.prototype.split = function (m) {
    var w = this.w, hv = shape("N2O4").halves, S = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1, ux = Math.cos(m.a), uy = Math.sin(m.a), kids = [];
    for (var i = 0; i < 2; i++) {
      var h = hv[i], p = local(m, h.x, h.y), sg = h.x >= 0 ? 1 : -1;
      var vx = 0.6 * m.vx / S + sg * 0.8 * ux, vy = 0.6 * m.vy / S + sg * 0.8 * uy, L = Math.sqrt(vx * vx + vy * vy) || 1;
      kids.push(w.add("NO2", p[0], p[1], S * vx / L, S * vy / L, m.a + h.a, m.w * 1.5));
    }
    kids[0].pair = kids[1].id; kids[1].pair = kids[0].id; kids[0].pairUntil = kids[1].pairUntil = w.t + 0.15;
    if (this.inject === "extraNO2") { w.add("NO2", m.x, m.y, m.vx, m.vy, 0, 0); this.inject = null; }
    this.lastSplit = { parent: worldAtoms(m), kids: kids.map(worldAtoms) };
    this.events.push({ x: m.x, y: m.y, t: w.t });
    m.dead = true; this.nA--; this.nB += 2;
  };
  /* dt 만큼(하위 걸음 2) — 늘 움직인다. 반응은 started 일 때만. */
  Tab1.prototype.step = function (dt) {
    var h = dt / T1C.SUB, i;
    for (var s = 0; s < T1C.SUB; s++) {
      this.w.step(h);
      if (this.started) {
        var p = 1 - Math.exp(-T1C.K * h), ms = this.w.mols, n = ms.length;
        for (i = 0; i < n; i++) if (!ms[i].dead && ms[i].k === "N2O4" && this.w.r() < p) this.split(ms[i]);
        this.w.compact();
        var before = this.rt; this.rt += h;
        if (this.rt <= T1C.TMAX + 1e-9 && Math.floor(this.rt / T1C.REC + 1e-6) > Math.floor(before / T1C.REC + 1e-6)) this.record();
      } else if (this.nA !== T1C.N0) this.splitsBefore = T1C.N0 - this.nA;
    }
  };
  Tab1.prototype.recEnd = function () { return this.rec.length ? this.rec[this.rec.length - 1].t : -1; };
  Tab1.prototype.valAt = function (t) { var i = Math.round(t / T1C.REC); i = Math.max(0, Math.min(this.rec.length - 1, i)); return this.rec[i]; };
  /* 접선 — 기록 점(센 수 / N0)에 2차식 최소제곱. t0 = 0: c0 = 1 고정 · [0, 8 s] / t0 > 0: [t0−3, t0+3]. 거절: notyet · short */
  function tangentFit(rec, t0, N0, final) {   /* final: 기록이 끝났다(40 s) — 창이 기록 끝을 넘으면 거기서 자른다(S-검토 B3: 37 s 넘는 점이 «기다리면 된다»고 영원히 거절되던 것) */
    var end = rec.length ? rec[rec.length - 1].t : -1;
    if (t0 > end + 1e-9) return { err: "notyet" };
    if (t0 < 1e-9) {
      if (end < 8 - 1e-9) return { err: "short" };
      var a = 0, b = 0, c = 0, y1 = 0, y2 = 0, n = 0;
      rec.forEach(function (p) { if (p.t > 8 + 1e-9) return; var d = p.t, v = p.a / N0 - 1; a += d * d; b += d * d * d; c += d * d * d * d; y1 += v * d; y2 += v * d * d; n++; });
      if (n < 30) return { err: "short" };
      var D = a * c - b * b; return { t0: 0, c0: 1, slope: (y1 * c - y2 * b) / D };
    }
    if (end < t0 + 3 - 1e-9 && !final) return { err: "short" };
    var s = [0, 0, 0, 0, 0], y = [0, 0, 0], m = 0, lo = Math.max(0, t0 - 3), hi = Math.min(end, t0 + 3);
    rec.forEach(function (p) { var d = p.t - t0; if (p.t < lo - 1e-9 || d > 3 + 1e-9) return; var v = p.a / N0; s[0]++; s[1] += d; s[2] += d * d; s[3] += d * d * d; s[4] += d * d * d * d; y[0] += v; y[1] += v * d; y[2] += v * d * d; m++; });
    if (m < 30) return { err: "short" };
    /* 직선 맞춤 — 줄기만 하는 기록이면 기울기는 언제나 ≤ 0. 창이 기록 끝에서 잘렸거나 2차식 기울기가 + 로 나오면 이것을 쓴다
       (S-검토 2라운드 R2-B1: 잘린 창의 2차식이 39~40 s 에서 16~27 % 위로 올라가는 «순간 반응 속도» 선을 그렸다) */
    function linear() { var Sd = s[1] / s[0], Sy = y[0] / s[0], vdd = s[2] / s[0] - Sd * Sd, vdy = y[1] / s[0] - Sd * Sy, b = vdd > 1e-12 ? Math.min(0, vdy / vdd) : 0; return { t0: t0, c0: Sy - b * Sd, slope: b, fit: "linear" }; }   /* 평평한 구간의 부동소수 잡음(1e-17)까지 0 으로 */
    if (hi < t0 + 3 - 1e-9) return linear();
    var M = [[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]];
    function det(A) { return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]); }
    var Dm = det(M); if (Math.abs(Dm) < 1e-12) return { err: "short" };
    function col(k) { return M.map(function (r, i) { var q = r.slice(); q[k] = y[i]; return q; }); }
    var qs = det(col(1)) / Dm;
    if (qs > 0) return linear();
    return { t0: t0, c0: det(col(0)) / Dm, slope: qs, fit: "quad" };
  }
  function snapT(t) { var m = [0, T1C.T1, T1C.T2]; for (var i = 0; i < m.length; i++) if (Math.abs(t - m[i]) < 0.9) return m[i]; return Math.round(t * 10) / 10; }
  Tab1.prototype.tangent = function (t0) { return tangentFit(this.rec, snapT(t0), T1C.N0, this.rt >= T1C.TMAX - 1e-9); };
  Tab1.prototype.secant = function (ta, tb) {
    ta = snapT(ta); tb = snapT(tb); if (ta > tb) { var q = ta; ta = tb; tb = q; }
    if (tb > this.recEnd() + 1e-9) return { err: "notyet" };
    var A = this.valAt(ta), B = this.valAt(tb);
    return { ta: ta, tb: tb, ya: A.a / T1C.N0, yb: B.a / T1C.N0, lostA: A.a - B.a, gainB: B.b - A.b };
  };

  /* ════════ 탭 ② — 반응 속도식 (열린 경계 · 실험값 규칙) ════════ */
  var T2C = { W: 720, H: 400, N: 80, WIN: 2, GAP: 0.35, LAM: 8, REPS: 10, DS: 0.05, LIFE: 1.0, FADE: 0.4, INFADE: 0.5, SUB: 2 };
  T2C.NS = Math.round(T2C.WIN / T2C.DS) + 1;
  var RX = {
    R1: { A: "NO", B: "O2", P: "NO2", pPer: 2, inA: 2, inB: 1, exps: [[1, 1], [2, 1], [1, 2], [2, 2]], prods: ["NO2"] },
    R2: { A: "NO", B: "H2", P: "N2", pPer: 1, inA: 2, inB: 2, exps: [[1, 1], [1, 2], [2, 1]], prods: ["N2", "H2O"] }
  };
  function Lab(rx, seed) {
    this.rx = rx; this.R = RX[rx]; this.seed = seed;
    this.w = new World({ W: T2C.W, H: T2C.H, seed: seed, v0: 70, kinds: ["NO", "O2", "NO2", "H2", "N2", "H2O"] });
    this.k = T2C.LAM / (T2C.N * T2C.N * T2C.N * T2C.WIN);
    this.res = this.R.exps.map(function () { return []; });
    this.meas = null; this.win = null; this.idleExp = 0; this.events = []; this.lastRec = null; this.inject = null; this.maxCount = 0; this.v0r = 70;
    this.fillExp(0);
  }
  Lab.prototype.fillExp = function (i) { var e = this.R.exps[i]; this.w.clear(); this.w.fill(this.R.A, T2C.N * e[0]); this.w.fill(this.R.B, T2C.N * e[1]); this.v0r = this.w.rmsSpeed(); this.idleExp = i; };
  Lab.prototype.poisson = function (lam) { var L = Math.exp(-lam), k = 0, p = 1, r = this.w.r; do { k++; p *= r(); } while (p > L); return k - 1; };
  Lab.prototype.inflow = function (kind) {
    var w = this.w, R = shape(kind).R, side = Math.floor(w.r() * 4), u = w.r(), x, y, v = w.randVel(), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]), th = (w.r() - 0.5) * 2.2, nx, ny, W = T2C.W, H = T2C.H;
    if (side === 0) { x = R + 0.5; y = R + u * (H - 2 * R); nx = 1; ny = 0; } else if (side === 1) { x = W - R - 0.5; y = R + u * (H - 2 * R); nx = -1; ny = 0; }
    else if (side === 2) { y = R + 0.5; x = R + u * (W - 2 * R); nx = 0; ny = 1; } else { y = H - R - 0.5; x = R + u * (W - 2 * R); nx = 0; ny = -1; }
    var c = Math.cos(th), s = Math.sin(th), m = w.add(kind, x, y, sp * (nx * c - ny * s), sp * (nx * s + ny * c), 2 * Math.PI * w.r(), (w.r() - 0.5) * 2.4);
    m.inT = 0; return m;
  };
  Lab.prototype.prodLife = function (m) { if (!this.win) m.life = T2C.LIFE; };   /* 창 안에서 생긴 것은 창 끝까지 그대로(life=null) */
  Lab.prototype.react = function () {
    var w = this.w, R = this.R, bs = w.mols.filter(function (m) { return !m.dead && m.k === R.B; });
    if (!bs.length) return false;
    var b = bs[Math.floor(w.r() * bs.length)], a1 = w.nearest(b.x, b.y, R.A), a2 = a1 && w.nearest(b.x, b.y, R.A, [a1]), b2 = null, self = this, fx, fy;
    if (!a1 || !a2) return false;
    if (this.rx === "R2") { b2 = w.nearest(b.x, b.y, "H2", [b]); if (!b2) return false; }
    if (this.rx === "R1") {
      [a1, a2].forEach(function (a) { self.prodLife(w.add("NO2", a.x, a.y, a.vx, a.vy, a.a, a.w)); a.dead = true; });
      fx = (a1.x + a2.x + b.x) / 3; fy = (a1.y + a2.y + b.y) / 3; b.dead = true;
    } else {
      var vx = (a1.vx + a2.vx) / 2, vy = (a1.vy + a2.vy) / 2, S = Math.sqrt(a1.vx * a1.vx + a1.vy * a1.vy), L = Math.sqrt(vx * vx + vy * vy) || 1;
      this.prodLife(w.add("N2", (a1.x + a2.x) / 2, (a1.y + a2.y) / 2, S * vx / L, S * vy / L, Math.atan2(a2.y - a1.y, a2.x - a1.x), a1.w));
      [b, b2].forEach(function (hm) { self.prodLife(w.add("H2O", hm.x, hm.y, hm.vx, hm.vy, hm.a, hm.w)); hm.dead = true; });
      fx = (a1.x + a2.x + b.x + b2.x) / 4; fy = (a1.y + a2.y + b.y + b2.y) / 4; a1.dead = true; a2.dead = true;
    }
    var q; for (q = 0; q < R.inA; q++) this.inflow(R.A); for (q = 0; q < R.inB; q++) this.inflow(R.B);
    if (this.win) { this.win.E++; this.win.inA += R.inA; this.win.inB += R.inB; }
    w.compact(); this.events.push({ x: fx, y: fy, t: w.t });
    return true;
  };
  Lab.prototype.start = function (i) {
    if (this.meas) return false;
    this.res[i] = []; this.meas = { i: i, left: T2C.REPS, phase: "gap", tt: T2C.GAP }; this.idleExp = i; return true;
  };
  Lab.prototype.beginWindow = function () {
    var R = this.R; this.fillExp(this.meas.i);
    this.win = { nA: this.w.count(R.A), nB: this.w.count(R.B), nP: this.w.count(R.P), nW: this.w.count("H2O"), E: 0, inA: 0, inB: 0, s: [0] };
    this.meas.phase = "win"; this.meas.tt = T2C.WIN;
  };
  Lab.prototype.sampleTo = function (el) { var R = this.R, win = this.win; while (win.s.length < T2C.NS - 1 && win.s.length * T2C.DS <= el + 1e-9) win.s.push(this.w.count(R.P) - win.nP); };
  Lab.prototype.endWindow = function () {
    var R = this.R, win = this.win, counted = this.w.count(R.P) - win.nP;
    this.sampleTo(T2C.WIN); while (win.s.length < T2C.NS) win.s.push(counted);
    var s = win.s.slice(); if (this.inject === "lineEnd") s[T2C.NS - 1] += 1;
    this.res[this.meas.i].push(s);
    this.lastRec = { i: this.meas.i, lineEnd: s[T2C.NS - 1], counted: counted, usedNO: 2 * win.E, inNO: win.inA, E: win.E };
    this.w.mols.forEach(function (m) { if (!m.dead && R.prods.indexOf(m.k) >= 0 && m.life == null) m.life = T2C.LIFE; });
    this.win = null; this.meas.left--;
    if (this.meas.left > 0) { this.meas.phase = "gap"; this.meas.tt = T2C.GAP; } else this.meas = null;
  };
  Lab.prototype.step = function (dt) {
    var h = dt / T2C.SUB, R = this.R, w = this.w;
    for (var s = 0; s < T2C.SUB; s++) {
      w.step(h);
      for (var i = 0; i < w.mols.length; i++) {
        var m = w.mols[i]; if (m.dead) continue;
        if (m.inT != null) { m.inT += h; if (m.inT > T2C.INFADE) m.inT = null; }
        if (m.life != null) { m.life -= h; if (m.life <= 0) m.dead = true; }
      }
      w.compact();
      var nA = w.count(R.A), nB = w.count(R.B), n = this.poisson(this.k * nA * nA * nB * h);
      for (var j = 0; j < n; j++) this.react();
      if (this.meas) {
        this.meas.tt -= h;
        if (this.win) this.sampleTo(Math.min(T2C.WIN, T2C.WIN - this.meas.tt));
        if (this.meas.tt <= 1e-9) { if (this.meas.phase === "gap") this.beginWindow(); else this.endWindow(); }
      }
      if (w.mols.length > this.maxCount) this.maxCount = w.mols.length;
    }
  };
  Lab.prototype.avgSeries = function (i) { var r = this.res[i], a = [], k, j; for (k = 0; k < T2C.NS; k++) { var t = 0; for (j = 0; j < r.length; j++) t += r[j][k]; a.push(r.length ? t / r.length : 0); } return a; };
  Lab.prototype.avgEnd = function (i) { var r = this.res[i]; return r.length ? r.reduce(function (p, q) { return p + q[T2C.NS - 1]; }, 0) / r.length : null; };
  Lab.prototype.allDone = function () { var self = this; return !this.meas && this.res.every(function (r) { return r.length === T2C.REPS; }); };

  return { rng: rng, KINDS: KINDS, fallbackShape: fallbackShape, setShapes: setShapes, shape: shape, usingArt: function () { return usingArt; }, local: local, worldAtoms: worldAtoms, atomCount: atomCount,
    World: World, T1C: T1C, Tab1: Tab1, tangentFit: tangentFit, snapT: snapT, T2C: T2C, RX: RX, Lab: Lab };
})();
/* ==== CORE END ==== */

/* ==== ART BEGIN (Astra RR_ART 1.1.0 — 원본 그대로 · 수정 금지) ==== */
(function (root) {
  'use strict';
  var PI = Math.PI, radii = {H: 3.2, N: 4.5, O: 4.05, I: 5.45};
  var colors = {H: ['#f7f9fc', '#e1e7ef', '#b2bdcc', '#626d7d'], N: ['#9eaff5', '#3a5bd9', '#293a91', '#25377b'], O: ['#f8a294', '#e0402e', '#a62b27', '#842823'], I: ['#c6a0db', '#7b3fa0', '#51256d', '#47215d']};
  var shapes = {}, cache = {}, keys = [], LIMIT = 96, defaultOptions = {};
  function atom(el, x, y) { return [el, x, y, radii[el]]; }
  function define(k, atoms) {
    var x = 0, y = 0, R = 0, i, t;
    for (i = 0; i < atoms.length; i++) { x += atoms[i][1]; y += atoms[i][2]; }
    x /= atoms.length; y /= atoms.length;
    for (i = 0; i < atoms.length; i++) { t = atoms[i]; t[1] -= x; t[2] -= y; R = Math.max(R, Math.sqrt(t[1]*t[1]+t[2]*t[2])+t[3]); }
    shapes[k] = {atoms: atoms, R: R};
  }
  function bent(c, e, b, degrees) { var a = degrees*PI/360; return [atom(c,0,0),atom(e,b*Math.cos(a),-b*Math.sin(a)),atom(e,b*Math.cos(a),b*Math.sin(a))]; }
  define('NO2', bent('N','O',6.3,134));
  define('H2O', bent('O','H',5.1,104.5));
  define('NO',[atom('N',-3.1,0),atom('O',3.1,0)]);
  define('O2',[atom('O',-3,0),atom('O',3,0)]);
  define('N2',[atom('N',-3.05,0),atom('N',3.05,0)]);
  define('H2',[atom('H',-3.1,0),atom('H',3.1,0)]);
  define('HI',[atom('I',-3.35,0),atom('H',3.35,0)]);
  shapes.HI.hEnd = {x: 3.35, y: 0};
  define('I2',[atom('I',-4,0),atom('I',4,0)]);
  function transformed(atoms,x,y,a) { return atoms.map(function (t) { return [t[0], x+t[1]*Math.cos(a)-t[2]*Math.sin(a),y+t[1]*Math.sin(a)+t[2]*Math.cos(a),t[3]]; }); }
  var halfX = 4.4 - shapes.NO2.atoms[0][1];
  define('N2O4',transformed(shapes.NO2.atoms,halfX,0,0).concat(transformed(shapes.NO2.atoms,-halfX,0,PI)));
  shapes.N2O4.halves = [{x: halfX, y: 0, a: 0}, {x: -halfX, y: 0, a: PI}];
  var shift = -shapes.NO2.atoms[0][1];
  define('N2O5',[atom('O',0,0)].concat(transformed(shapes.NO2.atoms,5.7+shift*Math.cos(-0.5),-3.1+shift*Math.sin(-0.5),-0.5),transformed(shapes.NO2.atoms,-5.7+shift*Math.cos(PI+0.5),-3.1+shift*Math.sin(PI+0.5),PI+0.5)));
  function shape(kind) {
    var g = shapes[kind], o;
    if (!g) { throw new Error('Unknown molecule: '+kind); }
    o = {atoms:g.atoms.map(function(t){return t.slice();}),R:g.R};
    if (g.halves) { o.halves=g.halves.map(function(h){return {x:h.x,y:h.y,a:h.a};}); }
    if (g.hEnd) { o.hEnd={x:g.hEnd.x,y:g.hEnd.y}; }
    return o;
  }
  function circle(c,x,y,r) { c.beginPath(); c.arc(x,y,r,0,2*PI); }
  function ball(c,t) {
    var p=colors[t[0]], x=t[1], y=t[2], r=t[3], g=c.createRadialGradient(x-r*0.32,y-r*0.38,r*0.04,x,y,r);
    g.addColorStop(0,p[0]); g.addColorStop(0.53,p[1]); g.addColorStop(1,p[2]);
    var rim=t[0]==='H'?0.8:0.38;
    circle(c,x,y,r-rim/2); c.fillStyle=g; c.fill(); c.strokeStyle=p[3]; c.lineWidth=rim; c.stroke();
  }
  function number(v,d) { return typeof v==='number' && isFinite(v) ? v : d; }
  function molecule(ctx,kind,x,y,a,s) {
    var g=shapes[kind], scale, dpr, tr, key, entry, cv, c, side, i;
    if (!g) { throw new Error('Unknown molecule: '+kind); }
    s=s||defaultOptions; scale=Math.max(0,number(s.scale,1)); if (!scale) {return;}
    tr=ctx.getTransform ? ctx.getTransform() : null;
    dpr=tr ? Math.sqrt(tr.a*tr.a+tr.b*tr.b) : (root.devicePixelRatio||1);
    dpr=Math.max(1,Math.min(8,Math.ceil(dpr*4)/4));
    key=kind+'|'+scale+'|'+dpr; entry=cache[key];
    if (!entry) {
      side=2*(g.R*scale+1); cv=root.document.createElement('canvas');
      cv.width=cv.height=Math.ceil(side*dpr); side=cv.width/dpr;
      c=cv.getContext('2d'); c.scale(dpr,dpr); c.translate(side/2,side/2); c.scale(scale,scale);
      for(i=0;i<g.atoms.length;i++){ball(c,g.atoms[i]);}
      entry={canvas:cv,side:side}; cache[key]=entry; keys.push(key);
      if(keys.length>LIMIT){delete cache[keys.shift()];}
    }
    ctx.save(); ctx.translate(x,y); ctx.rotate(number(a,0));
    if(s.alpha!==undefined){ctx.globalAlpha*=Math.max(0,Math.min(1,number(s.alpha,1)));}
    ctx.drawImage(entry.canvas,-entry.side/2,-entry.side/2,entry.side,entry.side); ctx.restore();
  }
  function flash(ctx,x,y,t,s) {
    var radius, size;
    s=s||{}; t=Math.max(0,Math.min(1,number(t,0))); if(t===1){return;}
    size=Math.max(0,number(s.size,1)); if(!size){return;}
    radius = s.reduced ? 17 : 7 + 19*t;
    ctx.save(); ctx.translate(x,y); ctx.scale(size,size); ctx.globalAlpha*=1-t;
    circle(ctx,0,0,radius); ctx.lineWidth=4; ctx.strokeStyle='rgba(245,158,11,0.12)'; ctx.stroke();
    circle(ctx,0,0,radius); ctx.lineWidth=1.35; ctx.strokeStyle='#f59e0b'; ctx.stroke();
    circle(ctx,0,0,radius-1.15); ctx.lineWidth=0.6; ctx.strokeStyle='rgba(255,249,226,0.9)'; ctx.stroke(); ctx.restore();
  }
  function legendSwatch(el,size) {
    var p=colors[el], id='rr-ball-'+el;
    if(!p){throw new Error('Unknown element');}
    size=Math.max(1,number(size,24));
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="'+id+'" cx="34%" cy="30%" r="72%"><stop stop-color="'+p[0]+'"/><stop offset=".53" stop-color="'+p[1]+'"/><stop offset="1" stop-color="'+p[2]+'"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#'+id+')" stroke="'+p[3]+'" stroke-width=".8"/></svg>';
  }
  function icon(size) { size=Math.max(1,number(size,64)); return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><g fill="currentColor" fill-opacity=".12"><circle cx="18" cy="18" r="6"/><circle cx="11" cy="24" r="5"/><circle cx="25" cy="24" r="5"/><circle cx="44" cy="12" r="5"/><circle cx="51" cy="17" r="4"/><circle cx="39" cy="30" r="5"/><circle cx="47" cy="33" r="4"/></g><path d="M10 39v15h45M15 40c10 0 9 10 19 10h17"/></svg>'; }
  root.RR_ART={contract:1,version:'1.1.0',shape:shape,molecule:molecule,flash:flash,legendSwatch:legendSwatch,svg:{icon:icon},info:function(){return {cacheEntries:keys.length};}};
})(window);
/* ==== ART END ==== */

/* ==== UI BEGIN ==== */
/* 화학 반응 속도 — 화면 (설계지시안_화학반응속도_v1.1.md §3~§5 · 부록 A). 계산은 RRC(core), 그림은 RR_ART(Astra).
   공개 전 용어(§4 금지어)가 든 줄에는 반드시 REVEAL 표식을 단다 — reactionrate_check.js 가 소스 전수로 확인한다. */
(function () {
  "use strict";
  var ART = (typeof window !== "undefined" && window.RR_ART && window.RR_ART.contract >= 1) ? window.RR_ART : null;
  RRC.setShapes(ART);
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var TSCALE_RM = 0.6, TSCALE_SLOW = 0.3;
  /* 색 상수 표 — 이 표에서만 정한다(지시안 §5) */
  var COL = { a: "#334155", b: "#a0461e", line: ["#2563eb", "#059669", "#ca8a04"], exp: ["#1f2937", "#2563eb", "#059669", "#c2410c"], tint: "160,70,30", axis: "#334155", grid: "#e2e8f0", mark: "#cbd5e1", text: "#454b52" };
  var T1C = RRC.T1C, T2C = RRC.T2C;
  function $(id) { return document.getElementById(id); }
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  function fit(cv, W, H) { var w = Math.round(W * DPR), h = Math.round(H * DPR); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } var c = cv.getContext("2d"); c.setTransform(DPR, 0, 0, DPR, 0, 0); return c; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  var ELC = { H: "#e5e7eb", N: "#3a5bd9", O: "#e0402e", I: "#7b3fa0" };
  function drawMol(c, m, alpha) {
    if (ART) { ART.molecule(c, m.k, m.x, m.y, m.a, { alpha: alpha == null ? 1 : alpha }); return; }
    var co = Math.cos(m.a), si = Math.sin(m.a); c.globalAlpha = alpha == null ? 1 : alpha;   /* FALLBACK(§15 ④⑤) */
    RRC.shape(m.k).atoms.forEach(function (t) { c.beginPath(); c.arc(m.x + t[1] * co - t[2] * si, m.y + t[1] * si + t[2] * co, t[3], 0, 2 * Math.PI); c.fillStyle = ELC[t[0]]; c.fill(); c.strokeStyle = "rgba(20,24,40,.55)"; c.lineWidth = 1; c.stroke(); });
    c.globalAlpha = 1;
  }
  /* 번쩍임 크기: 탭 ② 실험 4는 초당 ≈ 32회라 고리가 겹쳐 넓이 비가 13 %까지 올랐다(probe 실측) → 탭 ②는 0.6배(넓이 0.36배 · 0.7배에서 360폭 9.9 %로 기준에 너무 가까웠음) */
  function flashR(t, size) { return (RM ? 17 : 7 + 19 * t) * size; }
  function drawFlash(c, x, y, t, size) {
    if (ART) { ART.flash(c, x, y, t, { reduced: RM, size: size }); return; }
    c.beginPath(); c.arc(x, y, flashR(t, size), 0, 2 * Math.PI); c.strokeStyle = "rgba(245,158,11," + (1 - t).toFixed(2) + ")"; c.lineWidth = 3; c.stroke();
  }
  /* 범례 원자 — Astra SVG 의 id(그라데이션)가 두 탭에서 겹치면 숨은 탭 쪽 정의를 참조해 빈 동그라미가 된다(탭 ② 육안) → 사본마다 id 를 새로 붙인다 */
  var swN = 0;
  function swatch(el) {
    if (!ART) return "<span class='chip' style='background:" + ELC[el] + ";border-radius:50%'></span>";
    var sfx = "_sw" + (++swN), svg = ART.legendSwatch(el, 14);
    return svg.replace(/id="([^"]+)"/g, function (m0, id) { return 'id="' + id + sfx + '"'; }).replace(/url\(#([^)]+)\)/g, function (m0, id) { return "url(#" + id + sfx + ")"; }).replace(/href="#([^"]+)"/g, function (m0, id) { return 'href="#' + id + sfx + '"'; });
  }
  var FLASH_LIFE = 0.6;
  function flashes(c, events, now, size) { for (var i = events.length - 1; i >= 0; i--) { var e = events[i], t = (now - e.t) / FLASH_LIFE; if (t >= 1) { events.splice(i, 1); continue; } drawFlash(c, e.x, e.y, t, size); } }
  /* 번쩍임 넓이 비(probe 가 읽음 — 지시안 §4 B9 ④) */
  var flashArea = { max: 0 };
  function noteFlashArea(events, now, W, H, size) { var a = 0; events.forEach(function (e) { var t = (now - e.t) / FLASH_LIFE; if (t < 1) { var r = flashR(t, size) + 4 * size; a += Math.PI * r * r; } }); var f = a / (W * H); if (f > flashArea.max) flashArea.max = f; }

  /* ════════ 탭 바 ════════ */
  var cur = "1";
  function showTab(id) {
    cur = id;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tab") === id)); });
    $("pane1").hidden = id !== "1"; $("pane2").hidden = id !== "2"; $("paneL").hidden = id === "1" || id === "2";
    if (id === "2") T2.ensure();
  }
  $("tabbar").addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("[data-tab]") : null; if (b) showTab(b.getAttribute("data-tab")); });

  /* ════════ 탭 ① ════════ */
  var T1 = (function () {
    var tab, slow = false, lines = [], drag = null, revealed = false, hasTan = false, hasSec = false;
    var G = { l: 46, r: 14, t: 14, b: 34 };
    var HINT0 = "그래프를 <b>한 번 누르면</b> 그 점에서 곡선에 닿는 직선, <b>끌면</b> 두 점을 잇는 직선이 그려집니다(0 · t₁ · t₂ 가까이에서는 그 자리로 붙음).";
    function reset() { tab = new RRC.Tab1(29); lines = []; hasTan = hasSec = false; revealed = false; $("go1").disabled = false; $("ctr1").innerHTML = HINT0; updReveal(); }
    function updReveal() { var b = $("rev1"); b.disabled = !(hasTan && hasSec); b.textContent = revealed ? "이름 숨기기" : "이름 보기"; $("revwhy1").hidden = hasTan && hasSec; names(); }
    /* 선 이름 — 공개 뒤에만 그래프 아래 목록으로(캔버스 범례 상자가 NO₂ 곡선을 가리던 것 · S-검토 B2) */
    function names() {
      var box = $("names1");
      if (gated() || !lines.length) { box.hidden = true; box.innerHTML = ""; return; }
      box.hidden = false;
      box.innerHTML = lines.map(function (L) { return "<li><i style='border-top-color:" + COL.line[(L.n - 1) % 3] + "'></i><b>" + L.n + "</b> " + esc(lineName(L)) + "</li>"; }).join("");
    }
    function gated() { return !revealed; }
    function lineName(L) {
      if (gated()) return "선 " + L.n;
      if (L.kind === "sec") return "평균 반응 속도"; /*REVEAL*/
      return L.t0 === 0 ? "초기 반응 속도(t = 0의 순간 반응 속도)" : "순간 반응 속도"; /*REVEAL*/
    }
    var nLine = 0;
    function addLine(ta, tb) {
      var r, tname;
      if (tb == null) {
        r = tab.tangent(ta);
        if (r.err) { $("ctr1").textContent = r.err === "notyet" ? "아직 기록되지 않은 시간입니다." : "이 점 앞뒤가 다 기록된 뒤에 그을 수 있습니다."; return; }
        if (lines.length >= 3) lines.shift();
        lines.push({ n: ++nLine, kind: "tan", t0: r.t0, pts: [[r.t0, r.c0]], x0: r.t0 - 7, y0: r.c0 - 7 * r.slope, x1: r.t0 + 7, y1: r.c0 + 7 * r.slope });
        hasTan = true;
        tname = r.t0 === 0 ? "0" : r.t0 === T1C.T1 ? "t₁" : r.t0 === T1C.T2 ? "t₂" : r.t0.toFixed(1) + " s";
        $("ctr1").innerHTML = "t = " + tname + "에서 곡선에 닿는 직선을 그렸습니다.";
      } else {
        r = tab.secant(ta, tb);
        if (r.err) { $("ctr1").textContent = "아직 기록되지 않은 시간입니다."; return; }
        if (r.tb - r.ta < 0.5) return addLine(ta, null);
        if (lines.length >= 3) lines.shift();
        var sl = (r.yb - r.ya) / (r.tb - r.ta);
        lines.push({ n: ++nLine, kind: "sec", pts: [[r.ta, r.ya], [r.tb, r.yb]], x0: r.ta - 2, y0: r.ya - 2 * sl, x1: r.tb + 2, y1: r.yb + 2 * sl });
        hasSec = true;
        $("ctr1").innerHTML = "두 점을 잇는 직선을 그렸습니다. <b>이 동안</b> 사라진 N₂O₄ <b>" + r.lostA + "</b>개 · 생긴 NO₂ <b>" + r.gainB + "</b>개";
      }
      updReveal();
    }
    function gsize() { var cv = $("g1"); return { W: cv.clientWidth, H: cv.clientHeight }; }
    function ymax() { return $("showNO2").checked ? 2 : 1; }
    function X(t, s) { return G.l + (s.W - G.l - G.r) * t / T1C.TMAX; }
    function Y(v, s) { return s.H - G.b - (s.H - G.t - G.b) * v / ymax(); }
    function tOf(x, s) { return Math.max(0, Math.min(T1C.TMAX, (x - G.l) / (s.W - G.l - G.r) * T1C.TMAX)); }
    function drawStage() {
      var W = T1C.W, H = T1C.H, c = fit($("st1"), W, H), frac = tab.w.count("NO2") / (2 * T1C.N0);
      c.clearRect(0, 0, W, H);
      c.fillStyle = "rgba(" + COL.tint + "," + (0.32 * frac).toFixed(3) + ")"; c.fillRect(0, 0, W, H);
      tab.w.mols.forEach(function (m) { drawMol(c, m); });
      flashes(c, tab.events, tab.w.t, 1); noteFlashArea(tab.events, tab.w.t, W, H, 1);
      $("clock1").textContent = tab.started ? "반응 시간 " + Math.min(tab.rt, T1C.TMAX).toFixed(1) + " s" + (tab.rt >= T1C.TMAX ? " · 기록 끝" : "") : "반응 전";
      $("cnt1").innerHTML = "용기 속 — N₂O₄ <b>" + tab.w.count("N2O4") + "</b>개 · NO₂ <b>" + tab.w.count("NO2") + "</b>개";
    }
    function drawGraph() {
      var cv = $("g1"), s = gsize(); if (!s.W || !s.H) return;
      var c = fit(cv, s.W, s.H);
      c.clearRect(0, 0, s.W, s.H);
      c.strokeStyle = COL.axis; c.lineWidth = 1.5; c.beginPath(); c.moveTo(G.l, G.t); c.lineTo(G.l, s.H - G.b); c.lineTo(s.W - G.r, s.H - G.b); c.stroke();
      c.fillStyle = COL.text; c.font = "12px sans-serif"; c.textAlign = "center";
      [[0, "0"], [T1C.T1, "t₁"], [T1C.T2, "t₂"]].forEach(function (m) { var x = X(m[0], s); c.fillText(m[1], x, s.H - G.b + 15); if (m[0]) { c.strokeStyle = COL.mark; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x, G.t); c.lineTo(x, s.H - G.b); c.stroke(); c.setLineDash([]); } });
      c.fillText("반응 시간", (G.l + s.W - G.r) / 2, s.H - 4);
      c.save(); c.translate(13, (G.t + s.H - G.b) / 2); c.rotate(-Math.PI / 2); c.fillText("몰농도", 0, 0); c.restore();
      function series(key, col) { c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); tab.rec.forEach(function (p, k) { var x = X(p.t, s), y = Y(p[key] / T1C.N0, s); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); }
      if ($("showNO2").checked) series("b", COL.b);
      series("a", COL.a);
      c.save(); c.beginPath(); c.rect(G.l, G.t, s.W - G.l - G.r, s.H - G.t - G.b); c.clip();
      lines.forEach(function (L, k) {
        var col = COL.line[(L.n - 1) % 3];
        c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(X(L.x0, s), Y(L.y0, s)); c.lineTo(X(L.x1, s), Y(L.y1, s)); c.stroke();
        L.pts.forEach(function (p) { c.beginPath(); c.arc(X(p[0], s), Y(p[1], s), 4, 0, 2 * Math.PI); c.fillStyle = col; c.fill(); });
      });
      c.restore();
      /* 이름표 — 선 옆에는 번호만, 이름은 오른쪽 빈자리의 범례 상자에(공개 뒤 긴 이름이 겹치고 잘리던 결함 · 1366 육안).
         공개 전에는 «선 n»만 그린다(gated) */
      c.font = "700 12px sans-serif"; c.textAlign = "center";
      lines.forEach(function (L) {
        var col = COL.line[(L.n - 1) % 3], p0 = L.pts[0], px = Math.min(s.W - G.r - 9, Math.max(G.l + 9, X(p0[0], s) + (L.kind === "sec" ? -10 : 10))), py = Math.max(G.t + 9, Y(p0[1], s) - 10);   /* 위 끝에서 잘리지 않게(S-검토 C1) */
        c.beginPath(); c.arc(px, py, 8, 0, 2 * Math.PI); c.fillStyle = "#fff"; c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = col; c.fillText(String(L.n), px, py + 4);
      });
      c.textAlign = "center";
      if (drag) { c.strokeStyle = "#94a3b8"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(drag.t0, s), G.t); c.lineTo(X(drag.t0, s), s.H - G.b); c.moveTo(X(drag.t1, s), G.t); c.lineTo(X(drag.t1, s), s.H - G.b); c.stroke(); c.setLineDash([]); }
    }
    var cvg = $("g1");
    cvg.addEventListener("pointerdown", function (e) { var r = cvg.getBoundingClientRect(), t = tOf(e.clientX - r.left, gsize()); drag = { t0: t, t1: t, x: e.clientX }; try { cvg.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ } });
    cvg.addEventListener("pointermove", function (e) { if (!drag) return; var r = cvg.getBoundingClientRect(); drag.t1 = tOf(e.clientX - r.left, gsize()); });
    cvg.addEventListener("pointerup", function (e) { if (!drag) return; var d = drag; drag = null; if (Math.abs(e.clientX - d.x) < 12) addLine(d.t0, null); else addLine(d.t0, d.t1); });
    cvg.addEventListener("pointercancel", function () { drag = null; });
    $("clr1").addEventListener("click", function () { lines = []; names(); });
    $("go1").addEventListener("click", function () { tab.start(); this.disabled = true; });
    $("reset1").addEventListener("click", reset);
    $("slow1").addEventListener("click", function () { slow = !slow; this.setAttribute("aria-pressed", String(slow)); });
    $("rev1").addEventListener("click", function () { if (!(hasTan && hasSec)) return; revealed = !revealed; updReveal(); });
    $("legend1").innerHTML = "원자 — " + swatch("N") + " N · " + swatch("O") + " O &nbsp;|&nbsp; N₂O₄ = NO₂ 두 개가 붙은 모양";
    reset();
    return {
      frame: function (dt) { tab.step(dt * (slow ? TSCALE_SLOW : 1) * (RM ? TSCALE_RM : 1)); if (!$("pane1").hidden) { drawStage(); drawGraph(); } },
      state: function () { return { started: tab.started, rt: tab.rt, nA: tab.w.count("N2O4"), nB: tab.w.count("NO2"), rec: tab.rec.length, lines: lines.map(function (L) { return L.kind + ":" + lineName(L); }), revealed: revealed, ctr: $("ctr1").textContent, mols: tab.w.mols.map(function (m) { return [m.x, m.y, m.id]; }) }; },
      addLine: addLine, reset: reset, tab: function () { return tab; }
    };
  })();

  /* ════════ 탭 ② ════════ */
  var T2 = (function () {
    var EQ = { R1: "2NO(g) + O₂(g) → 2NO₂(g)", R2: "2NO(g) + 2H₂(g) → N₂(g) + 2H₂O(g)" };
    var NAME = { R1: { Bn: "O₂", Pn: "NO₂" }, R2: { Bn: "H₂", Pn: "N₂" } };
    var REVEAL = { R1: "이렇게 반응물의 농도와 반응 속도의 관계를 나타낸 식을 반응 속도식이라고 합니다: v = k[NO]ᵐ[O₂]ⁿ — m, n(반응 차수)은 실험으로 정합니다.", /*REVEAL*/
      R2: "이렇게 반응물의 농도와 반응 속도의 관계를 나타낸 식을 반응 속도식이라고 합니다: v = k[NO]ᵐ[H₂]ⁿ — m, n(반응 차수)은 실험으로 정합니다." }; /*REVEAL*/
    var LIM_AFTER = "반응이 일어나는 빈도는 실험으로 구한 반응 속도식을 따르게 했습니다. 이 반응이 실제로 어떤 단계를 거쳐 일어나는지는 다루지 않습니다 — 실험값을 따릅니다."; /*REVEAL*/
    var LIM_BEFORE = "반응이 일어나는 빈도는 실제 실험에서 잰 결과와 같아지도록 정했습니다. 이 반응이 실제로 어떤 단계를 거쳐 일어나는지는 다루지 않습니다 — 실험값을 따릅니다.";
    var labs = {}, rx = "R1", slow = false, inited = false, revealed = { R1: false, R2: false };
    function L() { return labs[rx]; }
    function ensure() { if (inited) return; inited = true; labs.R1 = new RRC.Lab("R1", 30); labs.R2 = new RRC.Lab("R2", 37); setRx("R1"); }
    function setRx(r) {
      rx = r; $("rx2").value = r; var lab = L(); if (!lab.meas) lab.fillExp(0);
      $("eq2").textContent = EQ[r]; $("gt2").textContent = "반응 시간에 따른 생긴 " + NAME[r].Pn + " 수";
      $("legend2").innerHTML = "원자 — " + swatch("N") + " N · " + swatch("O") + " O" + (r === "R2" ? " · " + swatch("H") + " H" : "") + " &nbsp;|&nbsp; 점선 = 큰 용기와 이어진 경계";
      buildTable(); updReveal();
    }
    function updReveal() {
      var lab = L(), done = lab.allDone(), b = $("rev2"), out = $("revout2");
      b.disabled = !done && !revealed[rx]; $("revwhy2").hidden = done || revealed[rx]; b.textContent = revealed[rx] ? "이름 숨기기" : "이름 보기";
      out.hidden = !revealed[rx]; out.textContent = revealed[rx] ? REVEAL[rx] : "";
      $("lim2a").textContent = revealed[rx] ? LIM_AFTER : LIM_BEFORE;
    }
    function buildTable() {
      var lab = L(), R = RRC.RX[rx], n = NAME[rx], h = "<tr><th>실험</th><th>NO<br>처음 수</th><th>" + n.Bn + "<br>처음 수</th><th></th><th>2초 동안 생긴<br>" + n.Pn + " 수(10번 평균)</th></tr>";
      R.exps.forEach(function (e, i) {
        var busy = !!lab.meas, done = lab.res[i].length, av = lab.avgEnd(i);
        var cell = done === T2C.REPS ? av.toFixed(1) + "개" : (lab.meas && lab.meas.i === i) ? "재는 중" : "—";
        var on = (lab.meas && lab.meas.i === i) || (!lab.meas && lab.idleExp === i);
        h += "<tr" + (on ? " class='on'" : "") + "><td><span class='chip' style='background:" + COL.exp[i] + "'></span>" + (i + 1) + "</td><td>" + T2C.N * e[0] + "</td><td>" + T2C.N * e[1] + "</td><td><button type='button' data-run='" + i + "'" + (busy ? " disabled" : "") + ">재기</button></td><td class='avg'>" + cell + "</td></tr>";
      });
      $("tbl2").innerHTML = h;
      $("rx2").disabled = !!lab.meas;
      var lg = ""; R.exps.forEach(function (e, j) { lg += "<span><span class='chip' style='background:" + COL.exp[j] + "'></span>실험 " + (j + 1) + "</span>"; }); lg += "<span>굵은 선 = 10번 평균</span>";
      $("lgd2").innerHTML = lg;
    }
    function nice(v) { var c = [10, 20, 30, 40, 60, 80, 100, 120, 160, 200, 250, 300]; for (var i = 0; i < c.length; i++) if (v <= c[i]) return c[i]; return Math.ceil(v / 100) * 100; }
    var ymaxSeen = { R1: 10, R2: 10 };   /* 반응마다 따로(R1 뒤 R2 선이 바닥에 눌리던 것 · S-검토 B1) */
    function drawGraph() {
      var cv = $("g2"), Wd = cv.clientWidth, Hd = cv.clientHeight; if (!Wd || !Hd) return;
      var c = fit(cv, Wd, Hd), lab = L(), R = RRC.RX[rx];
      c.clearRect(0, 0, Wd, Hd);
      var m = 10; lab.res.forEach(function (r, i) { if (r.length) m = Math.max(m, lab.avgEnd(i)); }); if (lab.win) m = Math.max(m, lab.win.s[lab.win.s.length - 1]);
      ymaxSeen[rx] = Math.max(ymaxSeen[rx], nice(m * 1.05)); var ymx = ymaxSeen[rx];
      var g = { l: 40, r: Wd - 10, t: 12, b: Hd - 30 };
      function X(t) { return g.l + (g.r - g.l) * t / T2C.WIN; } function Y(v) { return g.b - (g.b - g.t) * v / ymx; }
      c.strokeStyle = COL.axis; c.lineWidth = 1.3; c.beginPath(); c.moveTo(g.l, g.t); c.lineTo(g.l, g.b); c.lineTo(g.r, g.b); c.stroke();
      c.fillStyle = COL.text; c.font = "11.5px sans-serif"; c.textAlign = "right";
      [0, ymx / 2, ymx].forEach(function (v) { c.fillText(String(v), g.l - 4, Y(v) + 4); if (v) { c.strokeStyle = COL.grid; c.beginPath(); c.moveTo(g.l + 1, Y(v)); c.lineTo(g.r, Y(v)); c.stroke(); } });
      c.textAlign = "center"; c.fillText("0", g.l, g.b + 13); c.fillText(T2C.WIN + " s", g.r - 8, g.b + 13); c.fillText("반응 시간", (g.l + g.r) / 2, g.b + 25);
      function line(s, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); s.forEach(function (v, k) { var x = X(k * T2C.DS), y = Y(v); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); }
      var tags = [];
      R.exps.forEach(function (e, j) {
        if (!lab.res[j].length) return;
        var av = lab.avgSeries(j); line(av, COL.exp[j], 3.2); tags.push({ j: j, y: Y(av[T2C.NS - 1]) - 6 });
      });
      /* 선 끝 이름표가 겹치지 않게 14 px 간격으로 위로 밀어 올림 */
      tags.sort(function (a, b) { return b.y - a.y; });
      for (var q = 1; q < tags.length; q++) if (tags[q - 1].y - tags[q].y < 14) tags[q].y = tags[q - 1].y - 14;
      c.font = "700 12px sans-serif"; c.textAlign = "right";
      tags.forEach(function (t) { c.fillStyle = COL.exp[t.j]; c.fillText("실험 " + (t.j + 1), X(T2C.WIN) - 2, Math.max(g.t + 10, t.y)); });
      if (lab.win) line(lab.win.s, COL.exp[lab.meas.i], 1.6);
    }
    function drawStage() {
      var W = T2C.W, H = T2C.H, c = fit($("st2"), W, H), lab = L();
      c.clearRect(0, 0, W, H);
      lab.w.mols.forEach(function (m) { var a = 1; if (m.inT != null && !RM) a = Math.min(1, 0.25 + 1.5 * m.inT); if (m.life != null && m.life < T2C.FADE) a = Math.min(a, Math.max(0, m.life / T2C.FADE)); drawMol(c, m, a); });
      flashes(c, lab.events, lab.w.t, 0.6); noteFlashArea(lab.events, lab.w.t, W, H, 0.6);
      if (lab.win) { c.strokeStyle = COL.exp[lab.meas.i]; c.globalAlpha = 0.75; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); c.globalAlpha = 1; }
      var n = NAME[rx];
      $("clock2").textContent = lab.meas ? "실험 " + (lab.meas.i + 1) + " · " + (T2C.REPS - lab.meas.left + (lab.win ? 1 : 0)) + "/" + T2C.REPS + "번째 · " +
        (lab.win ? "재는 중 " + (T2C.WIN - lab.meas.tt).toFixed(1) + " s · 생긴 " + n.Pn + " " + (lab.w.count(lab.R.P) - lab.win.nP) + "개 · 쓰인 NO " + 2 * lab.win.E + "개" : "새로 채우는 중")
        : "실험 " + (lab.idleExp + 1) + "의 분자 — 반응은 계속됩니다";
    }
    var lastSig = "";
    $("tbl2").addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("button[data-run]") : null; if (b && !b.disabled) { if (L().start(+b.getAttribute("data-run"))) buildTable(); } });
    $("rx2").addEventListener("change", function () { if (L().meas) { this.value = rx; return; } setRx(this.value); });
    $("slow2").addEventListener("click", function () { slow = !slow; this.setAttribute("aria-pressed", String(slow)); });
    $("rev2").addEventListener("click", function () { if (!L().allDone() && !revealed[rx]) return; revealed[rx] = !revealed[rx]; updReveal(); });
    return {
      ensure: ensure,
      frame: function (dt) {
        if (!inited) return;
        var lab = L(); lab.step(dt * (slow ? TSCALE_SLOW : 1) * (RM ? TSCALE_RM : 1));
        var sig = (lab.meas ? lab.meas.i + ":" + lab.meas.left : "-") + "|" + lab.res.map(function (r) { return r.length; }).join(",");
        if (sig !== lastSig) { lastSig = sig; buildTable(); updReveal(); }
        if (!$("pane2").hidden) { drawStage(); drawGraph(); }
      },
      state: function () { var lab = L(); return { rx: rx, reps: lab.res.map(function (r) { return r.length; }), ends: lab.res.map(function (r, i) { return r.length ? lab.avgEnd(i) : null; }), meas: !!lab.meas, phase: lab.meas ? lab.meas.phase : "idle", n: lab.w.mols.length, maxCount: lab.maxCount, revealed: revealed[rx], lastRec: lab.lastRec, mols: lab.w.mols.map(function (m) { return [m.x, m.y, m.id]; }) }; },
      run: function (i) { if (L().start(i)) buildTable(); }, setRx: function (r) { if (!L().meas) setRx(r); }, lab: function (r) { return labs[r || rx]; }
    };
  })();

  /* ════════ 시계 하나 ════════ */
  var last = 0, raf = 0;
  function loop(ts) { var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; T1.frame(dt); T2.frame(dt); raf = requestAnimationFrame(loop); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } });
  window.__rr = { T1: T1, T2: T2, showTab: showTab, flashArea: flashArea, usingArt: function () { return RRC.usingArt(); },
    advance: function (sec) { for (var i = 0; i < Math.round(sec * 30); i++) { T1.frame(1 / 30); T2.frame(1 / 30); } } };
  showTab("1");
  raf = requestAnimationFrame(loop);
})();
