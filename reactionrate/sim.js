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
  var KINDS = ["NO", "O2", "NO2", "N2O4", "H2", "N2", "H2O", "N2O5", "HI", "I2"];
  function fallbackShape(kind) {   /* Astra 모듈이 없을 때만 — 시안 rr.js 공 모형과 같은 비율 */
    var H = 3.4, N = 4.5, O = 4.05, I = 5.5;
    function bent(c, o, b, deg, rc, ro) { var h = deg * Math.PI / 360, s = Math.sin(h), k = Math.cos(h); return [[c, 0, -b * k / 3, rc], [o, -b * s, b * k * 2 / 3, ro], [o, b * s, b * k * 2 / 3, ro]]; }
    var a, halves = null;
    if (kind === "NO") a = [["N", -3.3, 0, N], ["O", 3.3, 0, O]];
    else if (kind === "O2") a = [["O", -3.1, 0, O], ["O", 3.1, 0, O]];
    else if (kind === "N2") a = [["N", -3.3, 0, N], ["N", 3.3, 0, N]];
    else if (kind === "H2") a = [["H", -2.4, 0, H], ["H", 2.4, 0, H]];
    else if (kind === "HI") a = [["I", -3.4, 0, I], ["H", 3.4, 0, H]];
    else if (kind === "I2") a = [["I", -4, 0, I], ["I", 4, 0, I]];
    else if (kind === "N2O5") a = [["O", 0, 3.3, O], ["N", 5.7, 0.2, N], ["O", 5.1, -6, O], ["O", 10.6, 4.1, O], ["N", -5.7, 0.2, N], ["O", -10.6, 4.1, O], ["O", -5.1, -6, O]];
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
    var out = { atoms: a, R: R }; if (halves) out.halves = halves; if (kind === "HI") out.hEnd = { x: 3.4, y: 0 }; return out;
  }
  var shapeSrc = fallbackShape, usingArt = false, CACHE = {};
  function setShapes(art) {
    CACHE = {};
    if (art && art.contract >= 1 && typeof art.shape === "function") { shapeSrc = function (k) { return art.shape(k); }; usingArt = true; }
    else { shapeSrc = fallbackShape; usingArt = false; }
  }
  function shape(kind) { if (!CACHE[kind]) CACHE[kind] = shapeSrc(kind); return CACHE[kind]; }
  function atomCount(kind) { var c = { N: 0, O: 0, H: 0, I: 0 }; shape(kind).atoms.forEach(function (t) { c[t[0]]++; }); return c; }
  /* 분자 국소점 → 무대 */
  function local(m, lx, ly) { var k = m.s || 1, c = Math.cos(m.a), s = Math.sin(m.a); lx *= k; ly *= k; return [m.x + lx * c - ly * s, m.y + lx * s + ly * c]; }   /* m.s = 그리는 배율(탭 ③ 0.85) */
  function worldAtoms(m) { return shape(m.k).atoms.map(function (t) { var p = local(m, t[1], t[2]); return [t[0], p[0], p[1]]; }); }

  /* ── 엔진 ── o: W,H,seed,v0,kinds(이 무대에 나오는 종 — 격자 칸 유도) */
  function World(o) {
    this.W = o.W; this.H = o.H; this.r = rng(o.seed || 1); this.v0 = o.v0 || 70;
    this.mols = []; this.nextId = 1; this.t = 0; this.scale = o.scale || 1; this.rad = o.rad || {};   /* rad: 종별 충돌 반지름 덮어쓰기(탭 ④ HI — 그림과 판정의 틈 줄이기) */
    var mx = 0, self = this; (o.kinds || KINDS).forEach(function (k) { mx = Math.max(mx, self.radius(k)); });
    this.cell = Math.ceil(2 * mx);   /* 3×3 이웃 탐색이 놓치지 않는 최소 칸(B11 · 원칙 13) */
  }
  World.prototype.radius = function (k) { return this.rad[k] != null ? this.rad[k] : shape(k).R * this.scale; };
  World.prototype.add = function (k, x, y, vx, vy, a, w) {
    var m = { id: this.nextId++, k: k, R: this.radius(k), x: x, y: y, vx: vx, vy: vy, a: a || 0, w: w || 0, dead: false, born: this.t, life: null, inT: null };
    if (this.scale !== 1) m.s = this.scale;
    this.mols.push(m); return m;
  };
  World.prototype.randVel = function () { var s = this.v0 * (0.75 + 0.5 * this.r()), th = 2 * Math.PI * this.r(); return [s * Math.cos(th), s * Math.sin(th)]; };
  World.prototype.place = function (k) {
    var R = this.radius(k), g = 0, x, y, ok, i, m;
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
  World.prototype.atoms = function () { var c = { N: 0, O: 0, H: 0, I: 0 }; this.mols.forEach(function (m) { if (m.dead) return; var q = atomCount(m.k); c.N += q.N; c.O += q.O; c.H += q.H; c.I += q.I; }); return c; };
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
          if (p.pair === q.id && this.t < p.pairUntil) continue;
          if (p.grp && p.grp === q.grp && this.t < p.grpUntil) continue;   /* 한 분해에서 함께 생긴 분자들(탭 ③ NO₂·NO₂·O₂)도 잠깐 서로 밀어내지 않는다. 탭 ①②④는 grp 없음 */   /* 갈라진 짝은 잠깐 서로 밀어내지 않는다 — 다음 걸음에 ≈ 4 px 튀던 것(S-검토 C3) */
          if (p.ghost || q.ghost) continue;   /* 옅어지는 생성물은 부딪치지 않는다(탭 ③④ — 반응물 판정을 흐리지 않게) */
          var dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, s = p.R + q.R;
          if (d2 >= s * s || d2 === 0) continue;
          var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (s - d) / 2;
          if (this.narrow) { var nc = this.narrow(p, q); if (!nc) continue; nx = nc.nx; ny = nc.ny; ov = nc.pen / 2; }   /* 원자 공끼리 닿을 때만(탭 ④ — 테두리 원으로 판정하면 그림이 안 닿고 튕김 · S-검토 v2 B1). 탭 ①②는 없음 */
          p.x -= nx * ov; p.y -= ny * ov; q.x += nx * ov; q.y += ny * ov;
          var vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (vn < 0) {
            /* 충돌 갈고리(탭 ③④): 다가오는 충돌마다 한 번 — true 를 돌려주면 그 쌍은 반응으로 사라진 것(되튐 없음). 탭 ①②는 갈고리가 없어 그대로 */
            if (this.onHit && this.onHit(p, q, nx, ny, vn)) continue;
            p.vx += vn * nx; p.vy += vn * ny; q.vx -= vn * nx; q.vy -= vn * ny;
          }
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

  /* 열 운동 빠르기 — 2차원 레일리 분포(rms = v0). 탭 ④는 충돌 세기 판정이 분포에 달려 있어 처음부터 «다 섞인» 분포로 채운다 */
  function rayleighVel(w, v0) { var u = w.r(), sp = v0 * Math.sqrt(-Math.log(1 - u * 0.999999)), th = 2 * Math.PI * w.r(); return [sp * Math.cos(th), sp * Math.sin(th)]; }

  /* ════════ 탭 ③ — 2N₂O₅ → 4NO₂ + O₂ (1차 반응의 반감기) ════════
     분자 하나하나는 «언제든 같은 가능성»으로 사라진다(나이·주변 분자 수와 무관 — 고르는 것은 살아 있는 것 중 무작위).
     다만 분자 수가 적어 생기는 흔들림을 없애려고, 사라지는 «개수»는 매끈한 값 Ns(dNs = −k·Ns·dt — k 와 지금 값만 씀)를 따라간다:
     Ns 가 (지금 개수 − 1 + u) 밑으로 내려갈 때 하나를 지운다(u = 0~JIT 흔들림). 지시안 v2 §D1(Fable 논의) */
  var T3C = { W: 720, H: 400, S: 0.85, NS: [32, 64, 128], K: Math.LN2 / 6, T1: 6, TMAX: 36, REC: 0.1, JIT: 0.12, LIFE: 0.8, FADE: 0.5, SUB: 2, PROD_A: 0.4 };   /* LIFE·FADE 는 주입(prodFade) 전용 · PROD_A = 생성물을 그리는 불투명도(늘 같음) */
  function Tab3(seed) { this.seed = seed || 31; this.inject = null; this.reset(128); }
  Tab3.prototype.jit = function () { return this.w.r() * T3C.JIT; };   /* 0 ≤ u < JIT — 매끈한 값이 정수일 때 개수가 바로 그 정수(5t₁ 에 처음의 1/32 이 정확히 남음) */
  Tab3.prototype.reset = function (n0) {
    this.n0 = n0;
    this.w = new World({ W: T3C.W, H: T3C.H, seed: this.seed * 7 + n0, v0: 70, kinds: ["N2O5", "NO2", "O2"], scale: T3C.S });
    this.w.fill("N2O5", n0);
    this.started = false; this.rt = 0; this.Ns = n0; this.nA = n0; this.u = this.jit(); this.ev = 0; this.nNO2 = 0; this.nO2 = 0;
    this.rec = []; this.marks = [null, null, null, null, null]; this.events = []; this.picked = []; this.v0 = this.w.rmsSpeed();
  };
  Tab3.prototype.start = function () { if (this.started) return; this.started = true; this.rt = 0; this.record(); };
  Tab3.prototype.record = function () {
    var t = Math.round(this.rt / T3C.REC) * T3C.REC; this.rec.push({ t: t, n: this.nA, scan: this.w.count("N2O5") });
    for (var j = 0; j < 5; j++) if (this.marks[j] == null && this.nA <= this.n0 / Math.pow(2, j + 1)) this.marks[j] = t;
  };
  /* N₂O₅ 하나 → NO₂ 둘(제자리 — 부모의 N·O 원자 위에) + 두 번째 분해마다 O₂ 하나. 생성물은 닫힌 용기에 그대로 남아 다른 분자와 똑같이 부딪치며 움직인다
     (사용자 지시 2026-11-15: «NO₂ 분자와 산소 분자들이 사라지지 않게» — 이전 판 D3 «0.8 s에 옅어짐»을 대체). 빠르기는 부모의 빠르기 그대로(탭 ① 과 같은 규칙 — 분해가 용기를 데우지 않게) */
  Tab3.prototype.decompose = function (m) {
    var w = this.w, at = worldAtoms(m), cx = m.x, cy = m.y, cO = -1, bd = 1e9, i, j;
    for (i = 0; i < at.length; i++) if (at[i][0] === "O") { var d = (at[i][1] - cx) * (at[i][1] - cx) + (at[i][2] - cy) * (at[i][2] - cy); if (d < bd) { bd = d; cO = i; } }
    var used = [cO], kids = [];
    for (i = 0; i < at.length; i++) {
      if (at[i][0] !== "N") continue;
      var os = [];
      for (j = 0; j < at.length; j++) if (at[j][0] === "O" && used.indexOf(j) < 0) os.push([j, (at[j][1] - at[i][1]) * (at[j][1] - at[i][1]) + (at[j][2] - at[i][2]) * (at[j][2] - at[i][2])]);
      os.sort(function (a, b) { return a[1] - b[1]; }); var o1 = at[os[0][0]], o2 = at[os[1][0]]; used.push(os[0][0], os[1][0]);
      var px = (at[i][1] + o1[1] + o2[1]) / 3, py = (at[i][2] + o1[2] + o2[2]) / 3, mx = (o1[1] + o2[1]) / 2, my = (o1[2] + o2[2]) / 2;
      var ex = px - cx, ey = py - cy, L = Math.sqrt(ex * ex + ey * ey) || 1, S = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
      var vx = 0.6 * m.vx / S + 0.8 * ex / L, vy = 0.6 * m.vy / S + 0.8 * ey / L, V = Math.sqrt(vx * vx + vy * vy) || 1;
      var k = w.add("NO2", px, py, S * vx / V, S * vy / V, Math.atan2(my - at[i][2], mx - at[i][1]), m.w * 1.5);
      kids.push(k);
    }
    this.ev++; this.nNO2 += 2;
    if (this.ev % 2 === 0) { var o = w.add("O2", at[cO][1], at[cO][2], m.vx, m.vy, 2 * Math.PI * w.r(), m.w); this.nO2++; kids.push(o); }
    if (this.inject === "prodFade") kids.forEach(function (q) { q.ghost = true; q.life = T3C.LIFE; });   /* FAIL 주입: 이전 판(생성물이 옅어져 사라짐) */
    kids.forEach(function (q) { q.grp = m.id; q.grpUntil = w.t + 0.25; });
    this.events.push({ x: cx, y: cy, t: w.t, id: m.id });
    m.dead = true; this.nA--;
    return kids;
  };
  Tab3.prototype.step = function (dt) {
    var h = dt / T3C.SUB, w = this.w, i;
    for (var s = 0; s < T3C.SUB; s++) {
      w.step(h);
      for (i = 0; i < w.mols.length; i++) { var m = w.mols[i]; if (!m.dead && m.life != null) { m.life -= h; if (m.life <= 0) m.dead = true; } }
      if (this.started) {
        var k = this.inject === "kByN0" ? T3C.K * this.n0 / 64 : T3C.K;   /* FAIL 주입: k 가 처음 개수에 달리면 절반 시간이 개수마다 달라져야 한다 */
        this.Ns *= Math.exp(-k * h);
        while (this.nA > 0 && this.Ns <= this.nA - 1 + this.u) {
          var alive = []; for (i = 0; i < w.mols.length; i++) if (!w.mols[i].dead && w.mols[i].k === "N2O5") alive.push(w.mols[i]);
          var pick = this.inject === "oldestFirst" ? alive.reduce(function (a, b) { return a.id < b.id ? a : b; }) : alive[Math.floor(w.r() * alive.length)];
          this.picked.push(pick.id);
          this.decompose(pick); this.u = this.jit();
        }
        var before = this.rt; this.rt += h;
        if (this.rt <= T3C.TMAX + 1e-9 && Math.floor(this.rt / T3C.REC + 1e-6) > Math.floor(before / T3C.REC + 1e-6)) this.record();
      }
      w.compact();
    }
  };
  /* 절반이 된 구간의 걸린 시간 — 처음→1/2, 1/2→1/4, 1/4→1/8 */
  Tab3.prototype.intervals = function () { var m = this.marks, out = []; for (var j = 0; j < 3; j++) out.push(m[j] == null || (j && m[j - 1] == null) ? null : m[j] - (j ? m[j - 1] : 0)); return out; };
  Tab3.prototype.countAt = function (t) { var i = Math.round(t / T3C.REC); return i < this.rec.length ? this.rec[i].n : null; };

  /* ════════ 탭 ④ — 2HI → H₂ + I₂ (유효 충돌) ════════
     충돌마다 판정: 방향 — 두 분자의 I→H 가 중심선에 거의 수직이고 같은 쪽(교과서 그림 (가)) · 세기 — 중심선 방향 상대 빠르기 ≥ VTH.
     충돌은 원자 공(I·H)끼리 닿을 때만(hiNarrow) — VTH 는 그 판정에서 반응 비율 ≈ 4 % · 초당 ≈ 2번이 되게 정함(MF-2 · 의뢰서 B5 3~10 %).
     둘 다 맞으면 두 분자가 마저 다가가 I 끼리 닿은 뒤 H₂ + I₂ 로 바뀐다. 생성물은 옅어지고 둘레에서 HI 가 들어온다(탭 ②와 같은 열린 경계).
     다시 보기: 지나간 1 s 의 모든 분자 위치를 기록해 두고, 고른 종류의 «다음» 충돌을 붙잡아 그 기록을 느리게 다시 튼다(무대는 멈추지 않는다). */
  var T4C = { W: 720, H: 400, N: 80, V0: 105, ORI: 0.6, PAR: 0.5, VTH: 150, LIFE: 0.9, FADE: 0.5, INFADE: 0.5, SUB: 2, BUF: 1.1, TAU: 2, RVIEW: { x: 72, y: 48 }, PRE: 0.6, POST: 0.35, MERGE: 0.15,
    NA_ORI: 0.85, NA_FAST: 1.1, DA_ORI: 0.5, DA_PAR: 0.65, DA_SLOW: 0.55, DA_SP: 1.0 };   /* (다) 붙잡기: 방향은 판정 경계(0.6 · 0.5)보다 안쪽, 세기는 VTH 의 0.7 밑 — 경계 근처의 «애매한» 충돌은 붙잡지 않는다(Fable D5-1) */
  function judgeHI(p, q, nx, ny, vn, vth) {   /* vth: 세기 문턱(없으면 T4C.VTH — 탭 ⑤가 언덕 높이에 따라 바꿔 넘긴다 · T4C 는 고치지 않는다) */
    var VTH = vth || T4C.VTH;
    var upx = Math.cos(p.a), upy = Math.sin(p.a), uqx = Math.cos(q.a), uqy = Math.sin(q.a);   /* HI 국소 +x = I→H */
    var cp = upx * nx + upy * ny, cq = uqx * nx + uqy * ny, pp = upx * uqx + upy * uqy, s = -vn;
    var ori = Math.abs(cp) < T4C.ORI && Math.abs(cq) < T4C.ORI && pp > T4C.PAR, fast = s >= VTH;
    var cat = null;
    if (ori && fast) cat = "ga";
    else if (!ori && s >= T4C.NA_FAST * VTH && Math.abs(cp) > T4C.NA_ORI && Math.abs(cq) > T4C.NA_ORI && cp * cq > 0) cat = "na";   /* (나) = 교과서처럼 머리–꼬리(둘 다 중심선 방향 · 같은 쪽) — T자·반대쪽 나란히는 붙잡지 않음(S-검토 v2 B2) */
    else if (Math.abs(cp) < T4C.DA_ORI && Math.abs(cq) < T4C.DA_ORI && pp > T4C.DA_PAR && s < T4C.DA_SLOW * VTH &&
      Math.sqrt(p.vx * p.vx + p.vy * p.vy) < T4C.DA_SP * T4C.V0 && Math.sqrt(q.vx * q.vx + q.vy * q.vy) < T4C.DA_SP * T4C.V0) cat = "da";
    return { ori: ori, fast: fast, react: ori && fast, cat: cat, cp: cp, cq: cq, pp: pp, s: s };
  }
  function Tab4(seed) {
    this.seed = seed || 41; var self = this;
    this.w = new World({ W: T4C.W, H: T4C.H, seed: this.seed, v0: T4C.V0, kinds: ["HI", "H2", "I2"] });
    this.w.narrow = hiNarrow; this.maxBounceGap = -1e9; this.maxPen = 0;
    for (var i = 0; i < T4C.N; i++) { var m = this.w.place("HI"), v = rayleighVel(this.w, T4C.V0); m.vx = v[0]; m.vy = v[1]; }
    this.hits = 0; this.reacts = 0; this.byCat = { ga: 0, na: 0, da: 0 }; this.events = []; this.buf = []; this.want = null; this.cap = null; this.replay = null; this.inject = null;
    this.merging = []; this.maxGap = 0; this.lastReact = null;
    this.w.onHit = function (p, q, nx, ny, vn) { return self.hit(p, q, nx, ny, vn); };
  }
  Tab4.prototype.hit = function (p, q, nx, ny, vn) {
    if (p.k !== "HI" || q.k !== "HI" || p.merge || q.merge) return false;
    var J = judgeHI(p, q, nx, ny, vn, this.vth), w = this.w, sg = surfGap(p, q);
    if (sg > this.maxBounceGap) this.maxBounceGap = sg; if (-sg > this.maxPen) this.maxPen = -sg;   /* 검사용: 판정 순간 원자 공 사이 틈(+)·겹침(−) */
    if (this.inject === "noOrient") J.react = J.fast;   /* FAIL 주입: 방향을 보지 않으면 (나) 기하가 반응해야 한다 */
    this.hits++; if (J.cat) this.byCat[J.cat]++;
    var ev = { t: w.t, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, nx: nx, ny: ny, s: J.s, cat: J.cat, react: J.react, ids: [p.id, q.id] };
    if (this.onJudge) this.onJudge(J, ev);   /* 탭 ⑤: 방향이 맞은 충돌마다 언덕 위 점 하나 */
    if (this.want && !this.cap && J.cat === this.want) this.cap = { want: this.want, ev: ev, ids: [p.id, q.id], until: w.t + T4C.POST };
    if (!J.react) return false;
    this.reacts++;
    /* 반응: 되튀지 않고 마저 다가가 I 원자끼리 닿을 때 바꾼다(MERGE 안 — 테두리 원과 그림 사이 틈을 메움 · Fable D5-2) */
    p.merge = q.merge = { t0: w.t }; p.ghost = q.ghost = true;
    /* 마저 다가가기: 두 I 원자를 잇는 방향으로 곧장(옆으로 미끄러져 I 끼리 닿지 않던 것 — MF-2 틈 30 px) · 무게중심 속도와 다가오던 빠르기는 그대로 */
    var Ip = hiAtom(p, "I"), Iq = hiAtom(q, "I"), dx = Iq[0] - Ip[0], dy = Iq[1] - Ip[1], dL = Math.sqrt(dx * dx + dy * dy) || 1, cvx = (p.vx + q.vx) / 2, cvy = (p.vy + q.vy) / 2, cs = J.s / 2;
    p.vx = cvx + cs * dx / dL; p.vy = cvy + cs * dy / dL; q.vx = cvx - cs * dx / dL; q.vy = cvy - cs * dy / dL; p.w = q.w = 0;
    this.merging.push([p, q]);
    this.events.push({ x: ev.x, y: ev.y, t: w.t, s: J.s, react: true });
    this.inflow(); this.inflow();   /* 반응한 만큼 둘레에서 들어온다 — 화면의 HI 수 일정 */
    return true;
  };
  Tab4.prototype.inflow = function () {
    var w = this.w, R = w.radius("HI") + 0.5, side, u, x, y, nx, ny, W = T4C.W, H = T4C.H, v = rayleighVel(w, T4C.V0), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]), th = (w.r() - 0.5) * 2.2, g, i, free;
    /* 둘레의 빈자리 — 다른 분자 위에 놓이면 첫 충돌이 9 px 겹친 채 판정됐다(검사 실측) */
    for (g = 0; g < 40; g++) {
      side = Math.floor(w.r() * 4); u = w.r();
      if (side === 0) { x = R + 0.5; y = R + u * (H - 2 * R); nx = 1; ny = 0; } else if (side === 1) { x = W - R - 0.5; y = R + u * (H - 2 * R); nx = -1; ny = 0; }
      else if (side === 2) { y = R + 0.5; x = R + u * (W - 2 * R); nx = 0; ny = 1; } else { y = H - R - 0.5; x = R + u * (W - 2 * R); nx = 0; ny = -1; }
      free = true; for (i = 0; i < w.mols.length; i++) { var o = w.mols[i]; if (o.dead || o.ghost) continue; var dx = o.x - x, dy = o.y - y, ss = o.R + R + 1; if (dx * dx + dy * dy < ss * ss) { free = false; break; } }
      if (free) break;
    }
    var c = Math.cos(th), s = Math.sin(th), m = w.add("HI", x, y, sp * (nx * c - ny * s), sp * (nx * s + ny * c), 2 * Math.PI * w.r(), (w.r() - 0.5) * 2.4);
    m.inT = 0; return m;
  };
  /* 원자 공 두 쌍(I·H) 사이 가장 깊은 겹침 — 닿았으면 그 두 원자를 잇는 방향이 충돌 방향 */
  function hiNarrow(p, q) {
    if (p.k !== "HI" || q.k !== "HI") { var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1; return { nx: dx / d, ny: dy / d, pen: p.R + q.R - d }; }
    var A = worldAtomsR(p), B = worldAtomsR(q), best = null;
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++) {
      var ex = B[j][0] - A[i][0], ey = B[j][1] - A[i][1], dd = Math.sqrt(ex * ex + ey * ey) || 1e-9, pen = A[i][2] + B[j][2] - dd;
      if (pen > 0 && (!best || pen > best.pen)) best = { nx: ex / dd, ny: ey / dd, pen: pen };
    }
    return best;
  }
  function worldAtomsR(m) { return shape(m.k).atoms.map(function (t) { var p = local(m, t[1], t[2]); return [p[0], p[1], t[3] * (m.s || 1)]; }); }
  function surfGap(p, q) { var A = worldAtomsR(p), B = worldAtomsR(q), g = 1e9; A.forEach(function (a) { B.forEach(function (b) { g = Math.min(g, Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])) - a[2] - b[2]); }); }); return g; }
  function hiAtom(m, el) { var sh = shape("HI"); for (var i = 0; i < sh.atoms.length; i++) if (sh.atoms[i][0] === el) return local(m, sh.atoms[i][1], sh.atoms[i][2]); }
  function hiIr() { var r = 0; shape("HI").atoms.forEach(function (t) { if (t[0] === "I") r = t[3]; }); return r; }
  Tab4.prototype.convert = function (p, q) {
    var w = this.w, Ip = hiAtom(p, "I"), Iq = hiAtom(q, "I"), Hp = hiAtom(p, "H"), Hq = hiAtom(q, "H"), rI = hiIr();
    var gap = Math.sqrt((Ip[0] - Iq[0]) * (Ip[0] - Iq[0]) + (Ip[1] - Iq[1]) * (Ip[1] - Iq[1])) - 2 * rI; if (gap > this.maxGap) this.maxGap = gap;
    var hx = (Hp[0] + Hq[0]) / 2, hy = (Hp[1] + Hq[1]) / 2, ix = (Ip[0] + Iq[0]) / 2, iy = (Ip[1] + Iq[1]) / 2, ex = hx - ix, ey = hy - iy, L = Math.sqrt(ex * ex + ey * ey) || 1;
    var vx = (p.vx + q.vx) / 2, vy = (p.vy + q.vy) / 2, sep = 0.45 * T4C.V0;
    var h2 = w.add("H2", hx, hy, vx + sep * ex / L, vy + sep * ey / L, Math.atan2(Hq[1] - Hp[1], Hq[0] - Hp[0]), p.w);
    var i2 = w.add("I2", ix, iy, vx - sep * ex / L, vy - sep * ey / L, Math.atan2(Iq[1] - Ip[1], Iq[0] - Ip[0]), q.w);
    h2.ghost = i2.ghost = true; h2.life = i2.life = T4C.LIFE;
    p.dead = q.dead = true;
    this.lastReact = { before: [worldAtoms(p), worldAtoms(q)], after: [worldAtoms(h2), worldAtoms(i2)], t: w.t, gap: gap };
    if (this.cap) {
      var hp = this.cap.ids.indexOf(p.id) >= 0, hq = this.cap.ids.indexOf(q.id) >= 0;
      if (hp && hq && (this.cap.want === "ga" || this.inject === "keepProd")) this.cap.ids.push(h2.id, i2.id);   /* keepProd = FAIL 주입: (나)(다)도 생성물을 넣음(S-검토 v2 3라운드 C-r3-1) */
      else if (hp && hq) this.cap = null;   /* (나)(다)로 붙잡은 짝이 곧바로 다시 부딪쳐 반응 — «생기지 않음» 아래 생성물이 보이므로 버림(S-검토 v2 2라운드 A) */
      else if (hp || hq) this.cap = null;   /* 붙잡은 짝의 한 분자가 곧이어 «다른» 분자와 반응 — 문구와 그림이 엇갈리므로 버리고 다음 것을 기다림(want 유지) */
    }
  };
  Tab4.prototype.snapshot = function () {
    var a = []; this.w.mols.forEach(function (m) { if (!m.dead) a.push([m.id, m.k, m.x, m.y, m.a, m.life, m.inT]); });
    this.buf.push({ t: this.w.t, m: a });
    while (this.buf.length && this.buf[0].t < this.w.t - T4C.BUF) this.buf.shift();
  };
  Tab4.prototype.catchNext = function (cat) { this.want = cat; this.cap = null; };
  Tab4.prototype.step = function (dt) {
    var h = dt / T4C.SUB, w = this.w, i, rI = hiIr();
    for (var s = 0; s < T4C.SUB; s++) {
      w.step(h);
      for (i = this.merging.length - 1; i >= 0; i--) {
        var p = this.merging[i][0], q = this.merging[i][1], Ip = hiAtom(p, "I"), Iq = hiAtom(q, "I");
        var d = Math.sqrt((Ip[0] - Iq[0]) * (Ip[0] - Iq[0]) + (Ip[1] - Iq[1]) * (Ip[1] - Iq[1]));
        if (d <= 2 * rI + 0.5 || w.t - p.merge.t0 >= T4C.MERGE) { this.convert(p, q); this.merging.splice(i, 1); }
      }
      for (i = 0; i < w.mols.length; i++) {
        var m = w.mols[i]; if (m.dead) continue;
        if (m.inT != null) { m.inT += h; if (m.inT > T4C.INFADE) m.inT = null; }
        if (m.life != null) { m.life -= h; if (m.life <= 0) m.dead = true; }
      }
      /* 큰 용기와 맞닿은 열린 경계 — 빠른 쌍이 반응으로 빠지고 보통 빠르기 HI 가 들어와 무대가 식던 것(검사: 60 s 에 rms 83 %)을
         큰 용기가 되돌린다: HI 의 제곱평균 빠르기를 시간 상수 TAU 로 V0 에 천천히 맞춤(한 걸음 배율 ≈ 1 ± 0.002) */
      if (this.inject !== "noThermo") {
        var e2 = 0, nh = 0; for (i = 0; i < w.mols.length; i++) { var mh = w.mols[i]; if (!mh.dead && mh.k === "HI" && !mh.ghost) { e2 += mh.vx * mh.vx + mh.vy * mh.vy; nh++; } }
        if (nh && e2 > 0) { var lam = Math.sqrt(1 + (h / T4C.TAU) * (T4C.V0 * T4C.V0 * nh / e2 - 1)); for (i = 0; i < w.mols.length; i++) { var mt = w.mols[i]; if (!mt.dead && mt.k === "HI" && !mt.ghost) { mt.vx *= lam; mt.vy *= lam; } } }
      }
      w.compact();
      this.snapshot();
      if (this.cap && w.t >= this.cap.until) {
        var c = this.cap, ids = c.ids, t0 = c.ev.t - T4C.PRE;
        /* 짝 둘(과 그 생성물) + 다시 보기 창 근처의 다른 분자(흐리게 그림 — 짝이 다른 분자에 부딪쳐 꺾이는 까닭이 보이게 · S-검토 v2 B3) */
        var ex = c.ev.x, ey = c.ev.y, RV = T4C.RVIEW;
        this.replay = { cat: c.want, ev: c.ev, ids: ids.slice(), frames: this.buf.filter(function (f) { return f.t >= t0 - 1e-9; }).map(function (f) { return { t: f.t, m: f.m.filter(function (r) { return ids.indexOf(r[0]) >= 0 || (Math.abs(r[2] - ex) < RV.x && Math.abs(r[3] - ey) < RV.y); }) }; }) };
        this.cap = null; this.want = null;
      }
    }
  };
  Tab4.prototype.count = function (k) { var n = 0; this.w.mols.forEach(function (m) { if (!m.dead && m.k === k && !m.ghost) n++; }); return n; };

  /* ════════ 탭 ⑤ — 활성화 에너지 (2HI ⇄ H₂ + I₂) ════════
     정반응 상자 = 탭 ④ 엔진 그대로(Tab4 · 세기 문턱만 vth 로 넘김) · 역반응 상자 = 같은 World 위 H₂ + I₂(Tab5R).
     에너지 눈금: 교과서 장벽 183 kJ ↔ 탭 ④ 세기 문턱 VTH(150). 충돌 세기 E = 183·(s/VTH)² — 운동 에너지라 빠르기의 제곱.
     방향이 맞은 충돌마다 «점 하나»가 그 세기만큼 언덕을 오른다(onClimb). 넘음 ⇔ E ≥ 장벽 ⇔ 상자에서 반응 — 같은 판정에서 나온다. */
  var T5C = { DH: 13, EA_BOOK: 183, EMIN: 60, EMAX: 250, A: 0.24, B: 0.76, X0: 0.1, X1: 0.9 };
  function energyOf(s) { return T5C.EA_BOOK * (s / T4C.VTH) * (s / T4C.VTH); }
  function sThresh(E) { return T4C.VTH * Math.sqrt(Math.max(0, E) / T5C.EA_BOOK); }
  /* 언덕: x ∈ [0,1] 반응의 진행 · 반응물 0 · 생성물 DH · 꼭대기 정확히 Ea(x = 0.5) */
  function curveE(x, Ea) {
    if (x <= T5C.A) return 0; if (x >= T5C.B) return T5C.DH;
    var u = (x - T5C.A) / (T5C.B - T5C.A), s2 = Math.sin(Math.PI * u); s2 *= s2;
    return u <= 0.5 ? Ea * s2 : T5C.DH + (Ea - T5C.DH) * s2;
  }
  /* 높이 E(절대) 에 닿는 진행 자리 — 출발한 쪽 비탈 */
  function turnX(E, Ea, fromRight) {
    var base = fromRight ? T5C.DH : 0, uu = Math.asin(Math.sqrt(Math.max(0, Math.min(1, (E - base) / (Ea - base))))) / Math.PI;
    if (fromRight) uu = 1 - uu;
    return T5C.A + uu * (T5C.B - T5C.A);
  }
  function lamOf(x) { return Math.max(0, Math.min(1, (x - T5C.X0) / (T5C.X1 - T5C.X0))); }   /* 언덕 위 자리 → 원자 배열의 진행 */

  /* 역반응 상자: H₂ 40 + I₂ 40. 방향 — 두 분자 축이 중심선에 거의 수직이고 서로 나란함(네 원자가 사각형 · 동핵이라 앞뒤 없음) */
  function atomNarrow(p, q) {
    var A = worldAtomsR(p), B = worldAtomsR(q), best = null;
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++) {
      var ex = B[j][0] - A[i][0], ey = B[j][1] - A[i][1], dd = Math.sqrt(ex * ex + ey * ey) || 1e-9, pen = A[i][2] + B[j][2] - dd;
      if (pen > 0 && (!best || pen > best.pen)) best = { nx: ex / dd, ny: ey / dd, pen: pen };
    }
    return best;
  }
  function judgeRev(p, q, nx, ny, vn, vth) {
    var ux = Math.cos(p.a), uy = Math.sin(p.a), wx = Math.cos(q.a), wy = Math.sin(q.a);
    var cp = ux * nx + uy * ny, cq = wx * nx + wy * ny, pp = Math.abs(ux * wx + uy * wy), s = -vn;
    var ori = Math.abs(cp) < T4C.ORI && Math.abs(cq) < T4C.ORI && pp > T4C.PAR;
    return { ori: ori, s: s, react: ori && s >= vth };
  }
  function Tab5R(seed) {
    var self = this; this.w = new World({ W: T4C.W, H: T4C.H, seed: seed || 77, v0: T4C.V0, kinds: ["HI", "H2", "I2"] });
    this.w.narrow = atomNarrow; this.reacts = 0; this.vth = T4C.VTH; this.onJudge = null; this.inject = null;
    for (var i = 0; i < T4C.N / 2; i++) ["H2", "I2"].forEach(function (k) { var m = self.w.place(k), v = rayleighVel(self.w, T4C.V0); m.vx = v[0]; m.vy = v[1]; });
    this.w.onHit = function (p, q, nx, ny, vn) { return self.hit(p, q, nx, ny, vn); };
  }
  function dist2(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function tagged(m) { var sh = shape(m.k).atoms; return worldAtomsR(m).map(function (a, i) { return [a[0], a[1], a[2], sh[i][0]]; }); }
  Tab5R.prototype.hit = function (p, q, nx, ny, vn) {
    if (p.ghost || q.ghost) return false;
    if (!((p.k === "H2" && q.k === "I2") || (p.k === "I2" && q.k === "H2"))) return false;
    var J = judgeRev(p, q, nx, ny, vn, this.vth);
    if (this.onJudge) this.onJudge(J, { t: this.w.t, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    if (!J.react) return false;
    this.reacts++;
    var A = tagged(p).concat(tagged(q));
    var Hs = A.filter(function (a) { return a[3] === "H"; }), Is = A.filter(function (a) { return a[3] === "I"; });
    var d00 = dist2(Hs[0], Is[0]) + dist2(Hs[1], Is[1]), d01 = dist2(Hs[0], Is[1]) + dist2(Hs[1], Is[0]);
    var pairs = d00 <= d01 ? [[Hs[0], Is[0]], [Hs[1], Is[1]]] : [[Hs[0], Is[1]], [Hs[1], Is[0]]];
    function mid(pr) { return [(pr[0][0] + pr[1][0]) / 2, (pr[0][1] + pr[1][1]) / 2]; }
    var cvx = (p.vx + q.vx) / 2, cvy = (p.vy + q.vy) / 2, c0 = mid(pairs[0]), c1 = mid(pairs[1]), ex = c1[0] - c0[0], ey = c1[1] - c0[1], L = Math.sqrt(ex * ex + ey * ey) || 1, sep = 0.45 * T4C.V0, w = this.w;
    [[pairs[0], -1], [pairs[1], 1]].forEach(function (pr) {
      var c = mid(pr[0]), h = pr[0][0], i = pr[0][1];
      var m = w.add("HI", c[0], c[1], cvx + pr[1] * sep * ex / L, cvy + pr[1] * sep * ey / L, Math.atan2(h[1] - i[1], h[0] - i[0]), 0);
      m.ghost = true; m.life = T4C.LIFE;
    });
    p.dead = q.dead = true; this.inflow("H2"); this.inflow("I2");
    return true;
  };
  Tab5R.prototype.inflow = function (k) {
    var w = this.w, R = w.radius(k) + 0.5, W = T4C.W, H = T4C.H, v = rayleighVel(w, T4C.V0), sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]), th = (w.r() - 0.5) * 2.2, x, y, nx, ny, g, i;
    for (g = 0; g < 40; g++) {
      var side = Math.floor(w.r() * 4), u = w.r(), free = true;
      if (side === 0) { x = R + 0.5; y = R + u * (H - 2 * R); nx = 1; ny = 0; } else if (side === 1) { x = W - R - 0.5; y = R + u * (H - 2 * R); nx = -1; ny = 0; }
      else if (side === 2) { y = R + 0.5; x = R + u * (W - 2 * R); nx = 0; ny = 1; } else { y = H - R - 0.5; x = R + u * (W - 2 * R); nx = 0; ny = -1; }
      for (i = 0; i < w.mols.length; i++) { var o = w.mols[i]; if (o.dead || o.ghost) continue; if (dist2([o.x, o.y], [x, y]) < o.R + R + 1) { free = false; break; } }
      if (free) break;
    }
    var c = Math.cos(th), s = Math.sin(th), m = w.add(k, x, y, sp * (nx * c - ny * s), sp * (nx * s + ny * c), 2 * Math.PI * w.r(), (w.r() - 0.5) * 2.4); m.inT = 0;
  };
  Tab5R.prototype.step = function (dt) {
    var h = dt / T4C.SUB, w = this.w, i;
    for (var s = 0; s < T4C.SUB; s++) {
      w.step(h);
      for (i = 0; i < w.mols.length; i++) { var m = w.mols[i]; if (m.dead) continue; if (m.inT != null) { m.inT += h; if (m.inT > T4C.INFADE) m.inT = null; } if (m.life != null) { m.life -= h; if (m.life <= 0) m.dead = true; } }
      if (this.inject !== "noThermo") {
        var e2 = 0, n = 0; for (i = 0; i < w.mols.length; i++) { var a = w.mols[i]; if (!a.dead && !a.ghost) { e2 += a.vx * a.vx + a.vy * a.vy; n++; } }
        if (n && e2 > 0) { var lam = Math.sqrt(1 + (h / T4C.TAU) * (T4C.V0 * T4C.V0 * n / e2 - 1)); for (i = 0; i < w.mols.length; i++) { var b = w.mols[i]; if (!b.dead && !b.ghost) { b.vx *= lam; b.vy *= lam; } } }
      }
      w.compact();
    }
  };
  Tab5R.prototype.count = function (k) { var n = 0; this.w.mols.forEach(function (m) { if (!m.dead && m.k === k && !m.ghost) n++; }); return n; };

  function Tab5(seed) {
    var self = this; seed = seed || 57;
    this.fwd = new Tab4(seed); this.rev = new Tab5R(seed + 20); this.dir = "F"; this.ea = T5C.EA_BOOK;
    this.climbs = 0; this.crosses = 0; this.log = []; this.onClimb = null; this.inject = null;
    this.fwd.onJudge = function (J, ev) { if (self.dir === "F" && J.ori) self.climb(J.s, J.react, ev.x, ev.y); };
    this.rev.onJudge = function (J, ev) { if (self.dir === "R" && J.ori) self.climb(J.s, J.react, ev.x, ev.y); };
    this.setEa(T5C.EA_BOOK);
  }
  Tab5.prototype.box = function () { return this.dir === "F" ? this.fwd : this.rev; };
  Tab5.prototype.need = function () { return this.dir === "F" ? this.ea : this.ea - T5C.DH; };
  Tab5.prototype.setEa = function (E) { this.ea = E; this.fwd.vth = sThresh(E); this.rev.vth = sThresh(E - T5C.DH); this.resetCounts(); };
  Tab5.prototype.setDir = function (d) { this.dir = d; this.resetCounts(); };
  Tab5.prototype.resetCounts = function () { this.climbs = 0; this.crosses = 0; this.log = []; this.base = { f: this.fwd.reacts, r: this.rev.reacts }; };
  Tab5.prototype.boxReactsNow = function () { return this.dir === "F" ? this.fwd.reacts - this.base.f : this.rev.reacts - this.base.r; };
  Tab5.prototype.climb = function (s, react, x, y) {
    var E = energyOf(s), need = this.need(), cross = this.inject === "dotLoose" ? E >= 0.8 * need : E >= need;   /* dotLoose = FAIL 주입: 점 판정을 상자와 다르게 */
    this.climbs++; if (cross) this.crosses++;
    var r = { E: E, need: need, cross: cross, react: react, fromR: this.dir === "R", Ea: this.ea, x: x, y: y, t: this.box().w.t };
    this.log.push(r); if (this.log.length > 600) this.log.shift();
    if (this.onClimb) this.onClimb(r);
  };
  Tab5.prototype.step = function (dt) { this.box().step(dt); };
  /* 천천히 보기: 붙잡은 충돌 하나가 언덕 위를 지나는 길(구간 [초, 시작 x, 끝 x, 0 고르게 / 1 감속 / 2 가속]) */
  var T5W = { RUN: 2.0, UP: 4.2, HOLD: 1.8, DOWN: 3.2, OUT: 2.0, END: 1.4, UPF: 3.4, HOLDF: 1.2, BACK: 2.8 };
  function watchPath(r, inject) {
    var R = r.fromR, s0 = R ? T5C.X1 : T5C.X0, foot = R ? T5C.B : T5C.A, far = R ? T5C.A : T5C.B, end = R ? T5C.X0 : T5C.X1, W = T5W;
    var top = r.cross || inject === "failToTop" ? 0.5 : turnX((R ? T5C.DH : 0) + r.E, r.Ea, R);   /* failToTop = FAIL 주입: 못 넘는 충돌도 꼭대기까지 */
    var seg = r.cross ? [[W.RUN, s0, foot, 0], [W.UP, foot, 0.5, 1], [W.HOLD, 0.5, 0.5, 0], [W.DOWN, 0.5, far, 2], [W.OUT, far, end, 0], [W.END, end, end, 0]]
                      : [[W.RUN, s0, foot, 0], [W.UPF, foot, top, 1], [W.HOLDF, top, top, 0], [W.BACK, top, foot, 2], [W.OUT, foot, s0, 0], [W.END, s0, s0, 0]];
    var T = 0; seg.forEach(function (g) { T += g[0]; });
    return { seg: seg, T: T, top: top, cross: r.cross, fromR: R };
  }
  function watchAt(path, tau) {
    var t = Math.max(0, tau), i, g, k;
    for (i = 0; i < path.seg.length; i++) { g = path.seg[i]; if (t <= g[0] || i === path.seg.length - 1) { k = Math.max(0, Math.min(1, t / g[0])); if (g[3] === 1) k = 1 - (1 - k) * (1 - k); else if (g[3] === 2) k = k * k; return { x: g[1] + (g[2] - g[1]) * k, seg: i }; } t -= g[0]; }
  }

  /* ── 탭 ⑤ 원자 배열의 변화(교과서 그림 Ⅳ-7 꼭대기 그림: H···I 두 줄이 사각형 · 네 변 모두 점선) ──
     lam ∈ [0,1] = 반응의 진행. 0 = HI + HI(나란히 · 멀리) · 0.5 = 꼭대기 배열(옛 결합 H–I 와 새 결합 H–H·I–I 가 반씩) · 1 = H₂ + I₂(떨어짐).
     결합 길이는 분자 모양(shape)에서 유도한다(원칙 13). 늘어남 비율 STRETCH·떨어진 거리 FAR 만 화면용 상수.
     원자 순서: 0 H(위) 1 I(위) 2 H(아래) 3 I(아래). 결합 [i, j, 세기 0..1] — 세기 1 = 온전한 결합, 0.5 = 반쯤, 0 = 없음. */
  var T5G = { STRETCH: 1.32, FAR: 22, APPROACH: 0.3, PULL0: 0.2, PULL1: 0.5, BOND0: 0.25, BOND1: 0.75 };
  function sstep(k) { k = k < 0 ? 0 : (k > 1 ? 1 : k); return k * k * (3 - 2 * k); }
  function bondLen(kind) { var a = shape(kind).atoms; return Math.sqrt((a[1][1] - a[0][1]) * (a[1][1] - a[0][1]) + (a[1][2] - a[0][2]) * (a[1][2] - a[0][2])); }
  function complexGeom(lam) {
    lam = lam < 0 ? 0 : (lam > 1 ? 1 : lam);
    var dHI = bondLen("HI"), dHH = bondLen("H2"), dII = bondLen("I2"), S = T5G.STRETCH, F = T5G.FAR;
    var cHI = dHI * S, cHH = dHH * S, cII = dII * S;   /* 꼭대기 배열의 세 거리 */
    function near(m) { return sstep(m / T5G.APPROACH); }                                   /* 멀리 → 맞닿음 */
    function pull(m) { return sstep((m - T5G.PULL0) / (T5G.PULL1 - T5G.PULL0)); }          /* 맞닿음 → 꼭대기 배열 */
    var w, hH, hI;
    if (lam <= 0.5) { var a = near(lam), b = pull(lam); w = dHI + (cHI - dHI) * b; hH = F + (cHH - F) * a; hI = F + (cII - F) * a; }
    else { var mu = 1 - lam, a2 = near(mu), b2 = pull(mu); w = F + (cHI - F) * a2; hH = dHH + (cHH - dHH) * b2; hI = dII + (cII - dII) * b2; }
    var q = sstep((lam - T5G.BOND0) / (T5G.BOND1 - T5G.BOND0));
    return { lam: lam, atoms: [["H", -w / 2, -hH / 2], ["I", w / 2, -hI / 2], ["H", -w / 2, hH / 2], ["I", w / 2, hI / 2]],
      bonds: [[0, 1, 1 - q], [2, 3, 1 - q], [0, 2, q], [1, 3, q]], d: { HI: w, HH: hH, II: hI, HI0: dHI, HH0: dHH, II0: dII } };
  }

  return { rng: rng, KINDS: KINDS, fallbackShape: fallbackShape, setShapes: setShapes, shape: shape, usingArt: function () { return usingArt; }, local: local, worldAtoms: worldAtoms, atomCount: atomCount,
    World: World, T1C: T1C, Tab1: Tab1, tangentFit: tangentFit, snapT: snapT, T2C: T2C, RX: RX, Lab: Lab,
    rayleighVel: rayleighVel, T3C: T3C, Tab3: Tab3, T4C: T4C, Tab4: Tab4, judgeHI: judgeHI, T5G: T5G, complexGeom: complexGeom,
    T5C: T5C, T5W: T5W, energyOf: energyOf, sThresh: sThresh, curveE: curveE, turnX: turnX, lamOf: lamOf, Tab5R: Tab5R, Tab5: Tab5, judgeRev: judgeRev, watchPath: watchPath, watchAt: watchAt };
})();
/* ==== CORE END ==== */

/* ==== ART BEGIN (Astra RR_ART 1.3.1 — 원본 그대로 · 수정 금지) ==== */
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
  function ball(c,t,rs) {
    var p=colors[t[0]], x=t[1], y=t[2], r=t[3], g=c.createRadialGradient(x-r*0.32,y-r*0.38,r*0.04,x,y,r);
    g.addColorStop(0,p[0]); g.addColorStop(0.53,p[1]); g.addColorStop(1,p[2]);
    var rim=(t[0]==='H'?0.8:0.38)*(rs||1);
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
  function impact(ctx,x,y,t,s) {
    var size, radius, i, a, r, g;
    s=s||defaultOptions; t=Math.max(0,Math.min(1,number(t,0))); if(t===1){return;}
    size=Math.max(0.3,Math.min(1.6,number(s.size,1)));
    radius = s.reduced ? 20 : 14 + 10*t;
    ctx.save(); ctx.translate(x,y); ctx.rotate(number(s.angle,0));
    ctx.scale(size,size); ctx.globalAlpha*=0.85*(1-t);
    g=ctx.createRadialGradient(0,0,0,0,0,6);
    g.addColorStop(0,'rgba(255,251,231,0.8)'); g.addColorStop(1,'rgba(255,251,231,0)');
    circle(ctx,0,0,6); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath();
    for(i=0;i<12;i++){
      a=i*PI/6; r=radius*(i%2 ? 0.72 : 1);
      ctx.moveTo(2.4*Math.cos(a),2.4*Math.sin(a));
      ctx.lineTo(r*0.82*Math.cos(a),r*Math.sin(a));
    }
    ctx.lineCap='round'; ctx.lineWidth=1.25; ctx.strokeStyle='#b5b4ad'; ctx.stroke();
    ctx.lineWidth=0.65; ctx.strokeStyle='#f8f3dc'; ctx.stroke(); ctx.restore();
  }
  /* v1.3.1 — Astra: midpoint-anchored capsules grow symmetrically into rods.
     One path avoids a double-dark midpoint. No integer dot redistribution or
     pixel snapping: moving endpoints reveal the pattern underneath the balls.
     Rod light comes from the same upper-left direction as the ball shading. */
  var STRUCT={atomScale:0.45,lw:0.72,period:1.35,colour:'#5f6b7a'};
  function bondPath(c,half,dash) {
    var j, n=Math.ceil(half/STRUCT.period), p, lo, hi, r=STRUCT.lw/2;
    c.beginPath();
    for(j=-n;j<=n;j++){
      p=j*STRUCT.period; lo=Math.max(-half,p-dash/2); hi=Math.min(half,p+dash/2);
      if(lo>hi){continue;}
      c.moveTo(lo,-r); c.lineTo(hi,-r); c.arc(hi,0,r,-PI/2,PI/2);
      c.lineTo(lo,r); c.arc(lo,0,r,PI/2,3*PI/2); c.closePath();
    }
  }
  function bondTone(r,g,b,k){return 'rgb('+Math.round(95+(r-95)*k)+','+Math.round(107+(g-107)*k)+','+Math.round(122+(b-122)*k)+')';}
  function structure(ctx,atoms,bonds,x,y,s) {
    var scale, as, i, b, A, B, o, k, mx, my, dash, alpha, dx, dy, len, g, light, bridge;
    s=s||defaultOptions; scale=Math.max(0,number(s.scale,1)); if(!scale||!atoms){return;}
    as=Math.max(0.05,Math.min(1,number(s.atomScale,STRUCT.atomScale)));
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    if(s.alpha!==undefined){ctx.globalAlpha*=Math.max(0,Math.min(1,number(s.alpha,1)));}
    ctx.setLineDash([]); ctx.lineCap='round'; ctx.lineWidth=STRUCT.lw;
    for(i=0;bonds&&i<bonds.length;i++){
      b=bonds[i]; A=atoms[b[0]]; B=atoms[b[1]]; o=Math.max(0,Math.min(1,number(b[2],0)));
      if(!A||!B||o<=0.1){continue;}
      alpha=o<0.5?(o-0.1)/0.4:1; k=o>=0.9?1:(o>0.5?(o-0.5)/0.4:0);
      alpha=alpha*alpha*(3-2*alpha); k=k*(2-k);
      dash=k*(STRUCT.period-STRUCT.lw-0.08);
      bridge=Math.max(0,(k-0.35)/0.65); bridge=bridge*bridge*(3-2*bridge);
      dx=B[1]-A[1]; dy=B[2]-A[2]; len=Math.sqrt(dx*dx+dy*dy);
      if(!len){continue;}
      mx=(A[1]+B[1])/2; my=(A[2]+B[2])/2;
      ctx.save(); ctx.globalAlpha*=alpha; ctx.translate(mx,my); ctx.rotate(Math.atan2(dy,dx));
      ctx.fillStyle=STRUCT.colour;
      if(k>0){
        /* Cross-section shading fades in with the rod; dots stay high-contrast. */
        light=(dy-dx)/len/Math.sqrt(2);
        g=ctx.createLinearGradient(0,-STRUCT.lw/2,0,STRUCT.lw/2);
        g.addColorStop(0,bondTone(89-9*light,100.5-9.5*light,116-10*light,k));
        g.addColorStop(0.5+0.15*light,bondTone(172,182,195,k));
        g.addColorStop(1,bondTone(89+9*light,100.5+9.5*light,116+10*light,k));
        ctx.fillStyle=g;
      }
      bondPath(ctx,len/2,dash); ctx.fill();
      /* Fill the gaps without merging overlapping antialiased capsule edges.
         Both coverage and opacity only increase; there is no solid/dash switch. */
      if(bridge>0){ctx.globalAlpha*=bridge;ctx.fillRect(-len/2,-STRUCT.lw/2,len,STRUCT.lw);}
      ctx.restore();
    }
    ctx.setLineDash([]);
    for(i=0;i<atoms.length;i++){A=atoms[i]; if(!colors[A[0]]){continue;} ball(ctx,[A[0],A[1],A[2],radii[A[0]]*as],as);}
    ctx.restore();
  }
  function legendSwatch(el,size) {
    var p=colors[el], id='rr-ball-'+el;
    if(!p){throw new Error('Unknown element');}
    size=Math.max(1,number(size,24));
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="'+id+'" cx="34%" cy="30%" r="72%"><stop stop-color="'+p[0]+'"/><stop offset=".53" stop-color="'+p[1]+'"/><stop offset="1" stop-color="'+p[2]+'"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#'+id+')" stroke="'+p[3]+'" stroke-width=".8"/></svg>';
  }
  function icon(size) { size=Math.max(1,number(size,64)); return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><g fill="currentColor" fill-opacity=".12"><circle cx="18" cy="18" r="6"/><circle cx="11" cy="24" r="5"/><circle cx="25" cy="24" r="5"/><circle cx="44" cy="12" r="5"/><circle cx="51" cy="17" r="4"/><circle cx="39" cy="30" r="5"/><circle cx="47" cy="33" r="4"/></g><path d="M10 39v15h45M15 40c10 0 9 10 19 10h17"/></svg>'; }
  root.RR_ART={contract:1,version:'1.3.1',structure:structure,structureDefaults:function(){return {atomScale:STRUCT.atomScale,lineWidth:STRUCT.lw,period:STRUCT.period,colour:STRUCT.colour};},shape:shape,molecule:molecule,flash:flash,impact:impact,legendSwatch:legendSwatch,svg:{icon:icon},info:function(){return {cacheEntries:keys.length};}};
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
  /* 탭 ⑤ 색 — 활성화 에너지 화살표 빨강 · ΔH 파랑(설계안 §1-2 «한 그림에 두 화살표를 다른 색으로») · 넘은 점 호박 · 되돌아온 점 회색 */
  var COL5 = { ea: "#c62828", dh: "#1d4ed8", cross: "#f59e0b", back: "#64748b", dot: "#334155" };
  var T1C = RRC.T1C, T2C = RRC.T2C;
  function $(id) { return document.getElementById(id); }
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  function fit(cv, W, H) { var w = Math.round(W * DPR), h = Math.round(H * DPR); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } var c = cv.getContext("2d"); c.setTransform(DPR, 0, 0, DPR, 0, 0); return c; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  var ELC = { H: "#e5e7eb", N: "#3a5bd9", O: "#e0402e", I: "#7b3fa0" };
  function drawMol(c, m, alpha) {
    var sc = m.s || 1;
    if (ART) { ART.molecule(c, m.k, m.x, m.y, m.a, sc === 1 ? { alpha: alpha == null ? 1 : alpha } : { alpha: alpha == null ? 1 : alpha, scale: sc }); return; }
    var co = Math.cos(m.a), si = Math.sin(m.a); c.globalAlpha = alpha == null ? 1 : alpha;   /* FALLBACK(§15 ④⑤) */
    RRC.shape(m.k).atoms.forEach(function (t) { c.beginPath(); c.arc(m.x + sc * (t[1] * co - t[2] * si), m.y + sc * (t[1] * si + t[2] * co), t[3] * sc, 0, 2 * Math.PI); c.fillStyle = ELC[t[0]]; c.fill(); c.strokeStyle = "rgba(20,24,40,.55)"; c.lineWidth = 1; c.stroke(); });
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
    $("pane1").hidden = id !== "1"; $("pane2").hidden = id !== "2"; $("pane3").hidden = id !== "3"; $("pane4").hidden = id !== "4"; $("pane5").hidden = id !== "5";
    if (id === "2") T2.ensure(); if (id === "3") T3.ensure(); if (id === "4") T4.ensure(); if (id === "5") T5.ensure();
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

  /* ════════ 탭 ③ — 1차 반응의 반감기 ════════ */
  var T3C = RRC.T3C, T4C = RRC.T4C;
  var T3 = (function () {
    var tab = null, slow = false, inited = false, revealed = false, runs = {}, rings = [], RUNCOL = { 32: "#1f2937", 64: "#2563eb", 128: "#059669" };
    var G = { l: 40, r: 30, t: 12, b: 34 };
    function ensure() { if (inited) return; inited = true; tab = new RRC.Tab3(31); setN0(128); }
    function cur() { return tab; }
    /* 처음 개수 바꾸기 — 지금 실행이 시작됐으면 그 기록을 남기고 새 용기로(같은 개수를 다시 하면 그 줄을 바꿈) */
    function setN0(n0) {
      if (tab.started) runs[tab.n0] = { n0: tab.n0, rec: tab.rec, marks: tab.marks.slice() };
      tab.reset(n0); delete runs[n0]; rings = [];
      Array.prototype.forEach.call($("n03").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-n0") === n0)); });
      $("go3").disabled = false; buildTable(); updReveal();
    }
    function allRuns() { var a = []; T3C.NS.forEach(function (n) { if (runs[n]) a.push(runs[n]); else if (tab.n0 === n && tab.started) a.push({ n0: n, rec: tab.rec, marks: tab.marks, live: true }); }); return a; }
    function eighthDone() { var ok = false; allRuns().forEach(function (r) { if (r.marks[2] != null) ok = true; }); return ok; }
    function updReveal() {
      var on = eighthDone(), b = $("rev3"); b.disabled = !on && !revealed; $("revwhy3").hidden = on || revealed; b.textContent = revealed ? "이름 숨기기" : "이름 보기";
      $("revout3").hidden = !revealed;
      $("revout3").textContent = revealed ? "이렇게 반응물의 농도가 절반이 되는 데 걸리는 시간을 반감기(t₁/₂)라고 합니다." : ""; /*REVEAL*/
      $("th3").textContent = revealed ? "분자 수가 절반이 되는 데 걸린 시간(반감기)" : "분자 수가 절반이 되는 데 걸린 시간"; /*REVEAL*/
    }
    function sec(v) { return v == null ? "—" : Math.round(v) + " s"; }
    function buildTable() {
      var h = "<tr><th>처음<br>N₂O₅ 수</th><th>처음 → 1/2</th><th>1/2 → 1/4</th><th>1/4 → 1/8</th><th>30 s에<br>남은 수</th></tr>", rs = allRuns();
      if (!rs.length) h += "<tr><td colspan='5'>[반응 시작]을 누르면 기록됩니다.</td></tr>";
      rs.forEach(function (r) {
        var m = r.marks, iv = [m[0], m[1] != null && m[0] != null ? m[1] - m[0] : null, m[2] != null && m[1] != null ? m[2] - m[1] : null], i30 = Math.round(30 / T3C.REC), c30 = i30 < r.rec.length ? r.rec[i30].n + "개" : "—";
        h += "<tr" + (r.live ? " class='on'" : "") + "><td><span class='chip' style='background:" + RUNCOL[r.n0] + "'></span>" + r.n0 + "개</td><td>" + sec(iv[0]) + "</td><td>" + sec(iv[1]) + "</td><td>" + sec(iv[2]) + "</td><td class='avg'>" + c30 + "</td></tr>";
      });
      $("tbl3").innerHTML = h;
      var lg = ""; rs.forEach(function (r) { lg += "<span><span class='chip' style='background:" + RUNCOL[r.n0] + "'></span>처음 " + r.n0 + "개</span>"; }); lg += "<span>세로 점선 = 처음의 1/2 · 1/4 · 1/8이 된 때</span>";
      $("lgd3").innerHTML = lg;
    }
    function drawStage() {
      var W = T3C.W, H = T3C.H, c = fit($("st3"), W, H), now = tab.w.t;
      c.clearRect(0, 0, W, H);
      tab.w.mols.forEach(function (m) { var a = m.k === "N2O5" ? 1 : T3C.PROD_A; if (m.life != null) a = Math.min(1, Math.max(0, m.life / T3C.FADE)) * 0.85; drawMol(c, m, a); });   /* 생성물은 남아 움직이되 «늘 같은» 연한 색(시간에 따라 옅어지지 않음) — 남은 N₂O₅ 가 묻히지 않게. life 는 주입(prodFade)에서만 */
      flashes(c, tab.events, now, 0.7); noteFlashArea(tab.events, now, W, H, 0.7);
      /* 표시한 분자 — 살아 있으면 따라가는 고리, 분해되면 그 자리에 점선 고리가 1.5 s 남음 */
      rings.forEach(function (g) {
        var m = null; for (var i = 0; i < tab.w.mols.length; i++) if (tab.w.mols[i].id === g.id && !tab.w.mols[i].dead) { m = tab.w.mols[i]; break; }
        if (m) { g.x = m.x; g.y = m.y; g.gone = null; } else if (g.gone == null) g.gone = now;
        var a = g.gone == null ? 1 : Math.max(0, 1 - (now - g.gone) / 1.5); if (a <= 0) return;
        c.globalAlpha = a; c.strokeStyle = "#7c3aed"; c.lineWidth = 2.5; if (g.gone != null) c.setLineDash([4, 3]);
        c.beginPath(); c.arc(g.x, g.y, 17, 0, 2 * Math.PI); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      });
      $("clock3").textContent = tab.started ? "반응 시간 " + Math.min(tab.rt, T3C.TMAX).toFixed(1) + " s · N₂O₅ " + tab.nA + "개" + (tab.rt >= T3C.TMAX ? " · 기록 끝" : "") : "반응 전 · N₂O₅ " + tab.nA + "개";
      var alive = rings.filter(function (g) { return g.gone == null; }).length;
      $("tally3").innerHTML = "지금까지 분해된 N₂O₅ <b>" + tab.ev + "</b>개 → 생긴 NO₂ <b>" + tab.nNO2 + "</b>개 · O₂ <b>" + tab.nO2 + "</b>개" + (rings.length ? " &nbsp;|&nbsp; 표시한 분자 " + rings.length + "개 중 남은 것 " + alive + "개" : "");
    }
    function drawGraph() {
      var cv = $("g3"), Wd = cv.clientWidth, Hd = cv.clientHeight; if (!Wd || !Hd) return;
      var c = fit(cv, Wd, Hd), rs = allRuns(), ymx = 32;
      rs.forEach(function (r) { ymx = Math.max(ymx, r.n0); }); ymx = Math.max(ymx, tab.n0);
      c.clearRect(0, 0, Wd, Hd);
      var g = { l: G.l, r: Wd - G.r, t: G.t, b: Hd - G.b };
      function X(t) { return g.l + (g.r - g.l) * t / T3C.TMAX; } function Y(v) { return g.b - (g.b - g.t) * v / ymx; }
      c.strokeStyle = COL.axis; c.lineWidth = 1.3; c.beginPath(); c.moveTo(g.l, g.t); c.lineTo(g.l, g.b); c.lineTo(g.r, g.b); c.stroke();
      c.fillStyle = COL.text; c.font = "11.5px sans-serif"; c.textAlign = "center";
      for (var t = 0; t <= T3C.TMAX; t += 6) c.fillText(String(t), X(t), g.b + 13);
      c.fillText("반응 시간(s)", (g.l + g.r) / 2, g.b + 27);
      c.textAlign = "right"; [0, ymx / 2, ymx].forEach(function (v) { c.fillText(String(v), g.l - 4, Y(v) + 4); });
      /* 지금 용기의 1/2 · 1/4 · 1/8 가로 안내선 */
      c.setLineDash([3, 4]); c.strokeStyle = COL.mark; c.lineWidth = 1; c.textAlign = "left"; c.fillStyle = COL.text; c.font = "11px sans-serif";
      var lastY = -99; [2, 4, 8].forEach(function (d) { var y = Y(tab.n0 / d); c.beginPath(); c.moveTo(g.l, y); c.lineTo(g.r, y); c.stroke(); if (y - lastY >= 11) { c.fillText("1/" + d, g.r + 3, y + 4); lastY = y; } });   /* 글자가 겹치면 아래 것은 생략(32개 · 1366 육안) */
      c.setLineDash([]);
      rs.forEach(function (r) {
        var col = RUNCOL[r.n0];
        c.strokeStyle = col; c.lineWidth = r.live ? 2.6 : 2; c.beginPath(); r.rec.forEach(function (p, k) { var x = X(p.t), y = Y(p.n); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
        c.setLineDash([2, 3]); c.lineWidth = 1.2;
        for (var j = 0; j < 3; j++) if (r.marks[j] != null) { var mx = X(r.marks[j]), my = Y(r.n0 / Math.pow(2, j + 1)); c.beginPath(); c.moveTo(mx, my); c.lineTo(mx, g.b); c.stroke(); c.beginPath(); c.arc(mx, my, 3.5, 0, 2 * Math.PI); c.fillStyle = col; c.fill(); }
        c.setLineDash([]);
      });
      c.fillStyle = COL.text; c.textAlign = "left"; c.font = "11.5px sans-serif"; c.save(); c.translate(12, (g.t + g.b) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText("N₂O₅ 분자 수", 0, 0); c.restore();
    }
    var lastSig = "";
    $("n03").addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("button[data-n0]") : null; if (b) setN0(+b.getAttribute("data-n0")); });
    $("go3").addEventListener("click", function () { tab.start(); this.disabled = true; buildTable(); });
    $("slow3").addEventListener("click", function () { slow = !slow; this.setAttribute("aria-pressed", String(slow)); });
    $("rev3").addEventListener("click", function () { if (!eighthDone() && !revealed) return; revealed = !revealed; updReveal(); });
    $("st3").addEventListener("pointerdown", function (e) {
      var cv = $("st3"), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * T3C.W / r.width, y = (e.clientY - r.top) * T3C.H / r.height;
      var best = null, bd = 30 * 30; tab.w.mols.forEach(function (m) { if (m.dead || m.k !== "N2O5") return; for (var i = 0; i < rings.length; i++) if (rings[i].id === m.id) return; var d = (m.x - x) * (m.x - x) + (m.y - y) * (m.y - y); if (d < bd) { bd = d; best = m; } });
      if (!best) return; if (rings.length >= 5) rings.shift(); rings.push({ id: best.id, x: best.x, y: best.y, gone: null });
    });
    $("legend3").innerHTML = "원자 — " + swatch("N") + " N · " + swatch("O") + " O &nbsp;|&nbsp; 생긴 NO₂ · O₂는 용기에 남아 함께 움직입니다(N₂O₅가 잘 보이도록 연하게 그림)";
    return {
      ensure: ensure,
      frame: function (dt) {
        if (!inited) return;
        tab.step(dt * (slow ? TSCALE_SLOW : 1) * (RM ? TSCALE_RM : 1));
        var sig = tab.n0 + "|" + tab.started + "|" + tab.marks.join(",") + "|" + Math.round(Math.min(tab.rt, 31) * 10);
        if (sig !== lastSig) { lastSig = sig; buildTable(); updReveal(); }
        if (!$("pane3").hidden) { drawStage(); drawGraph(); }
      },
      state: function () { return { n0: tab.n0, started: tab.started, rt: tab.rt, nA: tab.nA, scan: tab.w.count("N2O5"), marks: tab.marks.slice(), runs: Object.keys(runs), revealed: revealed, rings: rings.length, mols: tab.w.mols.map(function (m) { return [m.x, m.y, m.id]; }) }; },
      setN0: function (n) { setN0(n); }, start: function () { $("go3").click(); }, tab: cur
    };
  })();

  /* ════════ 탭 ④ — 유효 충돌 ════════ */
  var T4 = (function () {
    var tab = null, slow = false, inited = false, revealed = false, want = null, rp = null, seen = { ga: false, na: false, da: false }, base = { h: 0, r: 0 };
    var RSLOW = 0.2, RZOOM = 3, RW = 360, RH = 220;
    var NAMECAT = { ga: "(가)", na: "(나)", da: "(다)" };
    function ensure() { if (inited) return; inited = true; tab = new RRC.Tab4(41); drawMinis(); updReveal(); }
    function impactSize(s) { return Math.max(0.3, Math.min(1.6, 0.3 + 0.9 * s / T4C.VTH)); }
    function drawImpact(c, x, y, t, size, ang) {
      if (ART && ART.impact) { ART.impact(c, x, y, t, { size: size, angle: ang, reduced: RM }); return; }
      c.strokeStyle = "rgba(160,150,120," + (1 - t).toFixed(2) + ")"; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, (RM ? 14 : 6 + 14 * t) * size, 0, 2 * Math.PI); c.stroke();   /* FALLBACK */
    }
    /* 고르기 단추의 작은 그림 — 교과서 그림 (가)(나)(다)의 배치(분자 그림은 Astra 의 molecule) · 빠르기는 잔상 간격으로 */
    function drawMinis() {
      [["ga", -Math.PI / 2, -Math.PI / 2, 1], ["na", Math.PI, Math.PI, 1], ["da", -Math.PI / 2, -Math.PI / 2, 0.35]].forEach(function (d) {
        var cv = $("mini_" + d[0]), c = fit(cv, 150, 56), y = 34;
        c.clearRect(0, 0, 150, 56);
        for (var k = 3; k >= 0; k--) {
          var off = k * 9 * d[3], al = k ? 0.12 + 0.06 * (3 - k) : 1;
          drawMolAt(c, "HI", 58 - off, y, d[1], 1.45, al); drawMolAt(c, "HI", 92 + off, y, d[2], 1.45, al);
        }
      });
    }
    function drawMolAt(c, k, x, y, a, sc, al) {
      if (ART) { ART.molecule(c, k, x, y, a, { scale: sc, alpha: al }); return; }
      var co = Math.cos(a), si = Math.sin(a); c.globalAlpha = al;
      RRC.shape(k).atoms.forEach(function (t) { c.beginPath(); c.arc(x + sc * (t[1] * co - t[2] * si), y + sc * (t[1] * si + t[2] * co), t[3] * sc, 0, 2 * Math.PI); c.fillStyle = ELC[t[0]]; c.fill(); c.strokeStyle = "rgba(20,24,40,.55)"; c.lineWidth = 1; c.stroke(); });
      c.globalAlpha = 1;
    }
    function updReveal() {
      var all = seen.ga && seen.na && seen.da, b = $("rev4"); b.disabled = !all && !revealed; $("revwhy4").hidden = all || revealed; b.textContent = revealed ? "이름 숨기기" : "이름 보기";
      $("revout4").hidden = !revealed;
      $("revout4").textContent = revealed ? "이렇게 생성물이 생기는 충돌을 유효 충돌이라고 합니다." : ""; /*REVEAL*/
      Array.prototype.forEach.call($("catch4").querySelectorAll("button"), function (bt) { var k = bt.getAttribute("data-cat"); bt.setAttribute("aria-pressed", String(want === k)); bt.classList.toggle("seen", seen[k]); });
    }
    function counters() {
      var h = tab.hits - base.h, r = tab.reacts - base.r;
      $("ctr4").innerHTML = "부딪친 횟수 <b>" + h + "</b> · " + (revealed ? "유효 충돌 횟수" : "생성물이 생긴 횟수") + " <b>" + r + "</b>"; /*REVEAL*/
    }
    function drawStage() {
      var W = T4C.W, H = T4C.H, c = fit($("st4"), W, H), now = tab.w.t;
      c.clearRect(0, 0, W, H);
      tab.w.mols.forEach(function (m) { var a = 1; if (m.inT != null && !RM) a = Math.min(1, 0.25 + 1.5 * m.inT); if (m.life != null && m.life < T4C.FADE) a = Math.min(a, Math.max(0, m.life / T4C.FADE)); drawMol(c, m, a); });
      /* 반응한 충돌 자리 표시 — 번쩍임(호박색 «에너지가 나옴»)이 아니라 중립 충돌 표시(이 반응은 흡열 · Fable D5-4) */
      for (var i = tab.events.length - 1; i >= 0; i--) { var e = tab.events[i], t = (now - e.t) / 0.45; if (t >= 1) { tab.events.splice(i, 1); continue; } drawImpact(c, e.x, e.y, t, impactSize(e.s), 0); }
      counters();
    }
    /* 다시 보기 — 기록(tab.replay.frames)에서만 그린다. 연출하지 않는다 */
    function startReplay() { if (!tab.replay) return; rp = { r: tab.replay, tau: tab.replay.frames[0].t, hold: 0 }; seen[rp.r.cat] = true; $("again4").disabled = false; updReveal(); }
    function frameAt(fr, t) { var lo = 0; for (var i = 0; i < fr.length; i++) if (fr[i].t <= t + 1e-9) lo = i; return fr[lo]; }
    function drawReplay(dt) {
      var c = fit($("rp4"), RW, RH); c.clearRect(0, 0, RW, RH);
      if (!rp) {
        c.fillStyle = "#94a3b8"; c.font = "14px sans-serif"; c.textAlign = "center";
        c.fillText(want ? "용기 속에서 " + NAMECAT[want] + "처럼 부딪치는 충돌을 기다리는 중…" : "", RW / 2, RH / 2); $("rpbar4").style.width = "0"; return;
      }
      var r = rp.r, fr = r.frames, t0 = fr[0].t, t1 = fr[fr.length - 1].t, ev = r.ev;
      if (rp.tau < t1) rp.tau = Math.min(t1, rp.tau + dt * RSLOW); else rp.hold += dt;
      var cx = ev.x, cy = ev.y;
      function P(x, y) { return [RW / 2 + (x - cx) * RZOOM, RH / 2 + (y - cy) * RZOOM]; }
      /* 잔상 — 0.1 s 간격으로 지나온 자리(빠르면 간격이 넓다) */
      function mine(q) { return r.ids.indexOf(q[0]) >= 0; }
      var fnow = frameAt(fr, rp.tau);
      /* 주변 분자 — 흐리게(잔상 없음). 짝이 다른 분자와 부딪쳐 꺾이는 까닭이 보이게(S-검토 v2 B3) */
      c.save(); try { c.filter = "grayscale(1)"; } catch (e) { /* 지원 안 하면 흐리게만 */ }
      fnow.m.forEach(function (q) { if (mine(q)) return; var p = P(q[2], q[3]); drawMolAt(c, q[1], p[0], p[1], q[4], RZOOM, 0.3); });   /* 회색조 — 짝의 잔상(보라)과 헷갈리지 않게(S-검토 v2 2라운드 C) */
      c.restore();
      /* 큰 용기와의 경계(점선) — 짝이 경계에서 되튀는 까닭이 보이게(2라운드 B) */
      c.save(); c.strokeStyle = "#94a3b8"; c.lineWidth = 2; c.setLineDash([6, 5]);
      var b0 = P(0, 0), b1 = P(T4C.W, T4C.H); c.strokeRect(b0[0], b0[1], b1[0] - b0[0], b1[1] - b0[1]); c.restore();
      for (var k = 3; k >= 1; k--) {
        var tt = rp.tau - 0.1 * k; if (tt < t0) continue; var f = frameAt(fr, tt);
        f.m.forEach(function (q) { if (!mine(q)) return; var p = P(q[2], q[3]); drawMolAt(c, q[1], p[0], p[1], q[4], RZOOM, 0.1 + 0.05 * (3 - k)); });
      }
      fnow.m.forEach(function (q) { if (!mine(q)) return; var p = P(q[2], q[3]), a = 1; if (q[5] != null && q[5] < T4C.FADE) a = Math.max(0, q[5] / T4C.FADE); drawMolAt(c, q[1], p[0], p[1], q[4], RZOOM, a); });
      var ti = (rp.tau - ev.t) / 0.25; if (ti >= 0 && ti < 1) drawImpact(c, RW / 2, RH / 2, ti, impactSize(ev.s) * 1.6, Math.atan2(ev.ny, ev.nx));
      $("rpbar4").style.width = (100 * (rp.tau - t0) / (t1 - t0)).toFixed(1) + "%";
      var after = rp.tau >= ev.t + 0.2;
      $("rpst4").innerHTML = "<b>" + NAMECAT[r.cat] + "</b>처럼 부딪친 충돌 — " + (rp.tau < ev.t ? "다가가는 중" : after ? (r.cat === "ga" ? "<b>생성물이 생김</b>(H₂ + I₂)" : "<b>생성물이 생기지 않음</b>(HI 그대로)") : "부딪침");
    }
    $("catch4").addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("button[data-cat]") : null; if (!b) return; want = b.getAttribute("data-cat"); tab.catchNext(want); tab.replay = null; rp = null; $("again4").disabled = true; $("rpst4").textContent = "기다리는 중…"; updReveal(); });
    $("again4").addEventListener("click", function () { if (rp) { rp.tau = rp.r.frames[0].t; rp.hold = 0; } });
    $("zero4").addEventListener("click", function () { base = { h: tab.hits, r: tab.reacts }; });
    $("slow4").addEventListener("click", function () { slow = !slow; this.setAttribute("aria-pressed", String(slow)); });
    $("rev4").addEventListener("click", function () { if (!(seen.ga && seen.na && seen.da) && !revealed) return; revealed = !revealed; updReveal(); });
    $("legend4").innerHTML = "원자 — " + swatch("H") + " H · " + swatch("I") + " I &nbsp;|&nbsp; HI는 큰 I 공에 작은 H 공이 붙은 모양";
    return {
      ensure: ensure,
      frame: function (dt) {
        if (!inited) return;
        tab.step(dt * (slow ? TSCALE_SLOW : 1) * (RM ? TSCALE_RM : 1));
        if (want && tab.replay && (!rp || rp.r !== tab.replay)) { want = null; startReplay(); }
        if (!$("pane4").hidden) { drawStage(); drawReplay(dt * (RM ? TSCALE_RM : 1)); }
      },
      state: function () { return { hits: tab.hits - base.h, reacts: tab.reacts - base.r, hi: tab.count("HI"), want: want, replaying: !!rp, rpCat: rp ? rp.r.cat : null, rpTau: rp ? rp.tau : null, rpEnd: rp ? rp.r.frames[rp.r.frames.length - 1].t : null, seen: seen, revealed: revealed, t: tab.w.t, mols: tab.w.mols.map(function (m) { return [m.x, m.y, m.id]; }) }; },
      tab: function () { return tab; }, rp: function () { return rp; }
    };
  })();

  /* ════════ 탭 ⑤ — 활성화 에너지 ════════
     시안 3·3-b 고름(원장): 나란히(L5 A) · 점이 충돌 자리에서 언덕으로 날아감(C5 B) · 점만(D5 B) · 밀대 60~250 kJ(S5 B) ·
     붙잡아 천천히 보기(M5 A) · 언덕 위 점을 따라다니는 말풍선(M6 B). 계산·판정은 RRC.Tab5, 원자 배열은 RRC.complexGeom, 그림은 RR_ART.structure.
   * «활성화 에너지»는 정·역반응 화면에서 처음부터 쓴다(P0 A3 — 표식 A3). 그 밖의 용어는 [이름 보기] 뒤(REVEAL). */
  var T5 = (function () {
    var tab = null, inited = false, slow = false, revealed = false, seen = { X: false, F: false };
    var C5 = RRC.T5C, DH = C5.DH, EA_BOOK = C5.EA_BOOK;
    var HG = { W: 600, H: 400, L: 62, R: 586, T: 22, B: 352, EMIN: -22, EMAX: 280 };
    var PH = { fly: 0.35, run: 0.3, up: 0.55, down: 0.55, out: 0.35 };
    var dots = [], rings = [], shownC = 0, shownX = 0, arm = null, watch = null;
    function yOf(E) { return HG.B - (E - HG.EMIN) / (HG.EMAX - HG.EMIN) * (HG.B - HG.T); }
    function xOf(u) { return HG.L + u * (HG.R - HG.L); }
    function ensure() {
      if (inited) return; inited = true; tab = new RRC.Tab5(57);
      tab.onClimb = function (r) {
        rings.push({ x: r.x, y: r.y, t: 0, react: r.react, s: Math.sqrt(r.E / EA_BOOK) * T4C.VTH });
        if (arm && r.cross === (arm === "X") && !watch) { arm = null; watch = { r: r, path: RRC.watchPath(r, tab.inject), tau: 0, playing: true }; lastSide = null; shownC++; if (r.cross) shownX++; syncWatch(); updReveal(); return; }
        dots.push({ t: 0, r: r });
      };
      setEa(EA_BOOK); syncDir(); updReveal();
    }
    /* [이름 보기]는 붙잡는 순간이 아니라, 붙잡은 충돌이 꼭대기를 지나거나 되돌아선 뒤에 켜진다(S-검토 v3 C) */
    function noteSeen() { if (!watch) return; var k0 = watch.r.cross ? "X" : "F"; if (!seen[k0] && RRC.watchAt(watch.path, watch.tau).seg >= 3) { seen[k0] = true; updReveal(); } }
    function clearView() { dots = []; rings = []; shownC = 0; shownX = 0; watch = null; arm = null; syncWatch(); }
    function setEa(E) { tab.setEa(E); clearView(); $("ea5").value = E; $("eaV5").textContent = E + " kJ"; counter(); }
    function syncDir() {
      var F = tab.dir === "F";
      $("eq5").textContent = F ? "정반응: 2HI(g) → H₂(g) + I₂(g)" : "역반응: H₂(g) + I₂(g) → 2HI(g)";
      $("dirF5").setAttribute("aria-pressed", String(F)); $("dirR5").setAttribute("aria-pressed", String(!F));
      $("legend5").innerHTML = "원자 — " + swatch("H") + " H · " + swatch("I") + " I &nbsp;|&nbsp; " + (F ? "용기 속 분자: HI" : "용기 속 분자: H₂와 I₂");
    }
    /* 점 하나: 날아감(충돌 자리 → 언덕 출발점) → 평지 → 오름 → (넘음: 반대편으로 / 못 넘음: 되돌아옴) → 사라짐 */
    function dotPos(d) {
      var r = d.r, t = d.t - PH.fly, x0 = r.fromR ? C5.X1 : C5.X0, foot = r.fromR ? C5.B : C5.A, base = r.fromR ? DH : 0, x, alpha = 1, phase;
      var top = r.cross ? 0.5 : RRC.turnX(base + r.E, r.Ea, r.fromR);
      if (t < 0) return { phase: "fly", k: 1 + t / PH.fly };
      if (t < PH.run) { x = x0 + (foot - x0) * (t / PH.run); phase = "run"; }
      else if ((t -= PH.run) < PH.up) { var e = 1 - (1 - t / PH.up) * (1 - t / PH.up); x = foot + (top - foot) * e; phase = "up"; }
      else if ((t -= PH.up) < PH.down) { var k = t / PH.down, e2 = k * k; if (r.cross) { var far = r.fromR ? C5.A : C5.B; x = 0.5 + (far - 0.5) * e2; } else x = top + (foot - top) * e2; phase = "down"; }
      else if ((t -= PH.down) < PH.out) { var k2 = t / PH.out, end = r.cross ? (r.fromR ? C5.X0 : C5.X1) : x0, s0 = r.cross ? (r.fromR ? C5.A : C5.B) : foot; x = s0 + (end - s0) * k2; alpha = 1 - k2; phase = "out"; }
      else return null;
      return { x: x, E: RRC.curveE(x, r.Ea), alpha: alpha, phase: phase };
    }
    function watchState() { if (!watch) return null; var a = RRC.watchAt(watch.path, watch.tau); return { x: a.x, seg: a.seg, r: watch.r, path: watch.path }; }
    /* 말풍선 글 — 그림의 실제 배열(geo)에서 정한다(진행만 보면 세기가 작은 충돌에 «늘어나며 약해짐»이 떴다 · S-검토 v3 B1). 공개 전 용어 없음 */
    var STR_MIN = 0.15;   /* 옛 결합 늘어남이 꼭대기 늘어남의 15 % 밑이면 «거의 늘어나지 않음» */
    function oldStretch(geo, F) { var d = geo.d, S = RRC.T5G.STRETCH; return F ? (d.HI / d.HI0 - 1) / (S - 1) : (d.HH / d.HH0 - 1) / (S - 1); }
    function caption(lam, ws, geo) {
      var F = !ws.r.fromR, back = !ws.r.cross && ws.seg >= 3, d = geo.d, S = RRC.T5G.STRETCH;
      var old = F ? "H–I" : "H–H · I–I", nw = F ? "H–H · I–I" : "H–I", a0 = F ? "HI 두 개" : "H₂와 I₂", a1 = F ? "H₂와 I₂" : "HI 두 개", p = F ? lam : 1 - lam;
      var st = oldStretch(geo, F), rowsFar = d.HH > d.HH0 * S * 1.6, colsFar = d.HI > d.HI0 * S * 1.6, startFar = F ? rowsFar : colsFar, endFar = F ? colsFar : rowsFar;
      var q = F ? geo.bonds[2][2] : geo.bonds[0][2];
      if (back) { var tst = oldStretch(RRC.complexGeom(RRC.lamOf(ws.path.top)), F); return tst < STR_MIN ? "충돌 세기가 작아 " + old + " 결합이 거의 늘어나지 않은 채 " + a0 + "로 되돌아감" : "꼭대기에 못 미쳐 " + old + " 결합이 다시 짧아짐 → " + a0 + "로 되돌아감"; }
      if (p <= 0.5 && startFar) return a0 + "가 다가감";
      if (p <= 0.5 && st < STR_MIN) return a0 + "가 맞닿음";
      if (q < 0.4 || !ws.r.cross) return old + " 결합이 늘어나며 약해지고, 새 짝(" + nw + ")이 가까워짐";
      if (q <= 0.6) return "꼭대기 — 옛 결합(" + old + ")과 새 결합(" + nw + ")이 반쯤씩 이어진 불안정한 배열";
      if (!endFar) return nw + " 결합이 생김";
      return a1 + "가 떨어져 나감";
    }
    function countLines(c, txt, maxW) { var n = 1, line = ""; txt.split(" ").forEach(function (wd) { var t = line ? line + " " + wd : wd; if (c.measureText(t).width > maxW && line) { n++; line = wd; } else line = t; }); return n; }
    function wrapText(c, txt, x, y, maxW, lh) {
      var words = txt.split(" "), line = "", lines = [];
      words.forEach(function (wd) { var t = line ? line + " " + wd : wd; if (c.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; });
      if (line) lines.push(line); lines.forEach(function (l, i) { c.fillText(l, x, y + i * lh); }); return lines.length;
    }
    function drawStage() {
      var b = tab.box(), W = T4C.W, H = T4C.H, c = fit($("st5"), W, H), now = b.w.t, i;
      c.clearRect(0, 0, W, H);
      b.w.mols.forEach(function (m) { if (m.dead) return; var a = 1; if (m.inT != null && !RM) a = Math.min(1, 0.25 + 1.5 * m.inT); if (m.life != null && m.life < T4C.FADE) a = Math.min(a, Math.max(0, m.life / T4C.FADE)); drawMol(c, m, a); });
      for (i = rings.length - 1; i >= 0; i--) {
        var g = rings[i], k = g.t / 0.6; if (k >= 1) { rings.splice(i, 1); continue; }
        if (g.react && ART && ART.impact) { ART.impact(c, g.x, g.y, k, { size: Math.max(0.3, Math.min(1.6, 0.3 + 0.9 * g.s / T4C.VTH)), angle: 0, reduced: RM }); continue; }   /* 반응한 충돌 = 탭 ④와 같은 충돌 표시 */
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = COL5.back; c.lineWidth = 1.6; c.beginPath(); c.arc(g.x, g.y, (RM ? 14 : 10 + 8 * k), 0, 2 * Math.PI); c.stroke(); c.restore();
      }
      var ws = watchState();
      if (ws && watch.tau < 3) { c.save(); c.globalAlpha = Math.max(0, 1 - watch.tau / 3); c.strokeStyle = "#334155"; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(ws.r.x, ws.r.y, 16, 0, 2 * Math.PI); c.stroke(); c.restore(); }
    }
    function arrow(c, x, y0, y1, col, w) {
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1 + (y1 < y0 ? 7 : -7)); c.stroke();
      var d = y1 < y0 ? 1 : -1; c.beginPath(); c.moveTo(x, y1); c.lineTo(x - 5, y1 + 9 * d); c.lineTo(x + 5, y1 + 9 * d); c.closePath(); c.fill();
    }
    function drawHill() {
      var cv = $("hill5"), c = fit(cv, HG.W, HG.H), Ea = tab.ea, i, x, F = tab.dir === "F";
      var k = (cv.clientWidth || HG.W) / HG.W, f = Math.max(1, Math.min(1.8, 0.95 / Math.max(0.3, k)));   /* 좁은 화면에서 글자·말풍선을 키운다(화면 글자 ≥ 약 12 px) */
      function font(w, px) { return w + " " + Math.round(px * f) + "px 'Noto Sans KR', sans-serif"; }
      c.clearRect(0, 0, HG.W, HG.H); c.textBaseline = "middle";
      c.strokeStyle = COL.axis; c.lineWidth = 1.6; c.beginPath(); c.moveTo(HG.L - 14, HG.T - 6); c.lineTo(HG.L - 14, HG.B + 18); c.lineTo(HG.R + 4, HG.B + 18); c.stroke();
      c.fillStyle = COL.axis; c.font = font("600", 15); c.textAlign = "center"; ["엔", "탈", "피"].forEach(function (ch, j) { c.fillText(ch, 24, 150 + j * 20 * f); });
      c.textAlign = "right"; c.fillText("반응의 진행", HG.R, HG.B + 34);
      if (Ea !== EA_BOOK) { c.setLineDash([5, 5]); c.strokeStyle = "#cbd5e1"; c.lineWidth = 2; c.beginPath(); for (i = 0; i <= 200; i++) { x = i / 200; c[i ? "lineTo" : "moveTo"](xOf(x), yOf(RRC.curveE(x, EA_BOOK))); } c.stroke(); c.setLineDash([]);
        c.fillStyle = "#94a3b8"; c.textAlign = "center"; c.font = font("500", 13); c.fillText("교과서 언덕", xOf(0.5), Ea > EA_BOOK ? yOf(EA_BOOK) + 14 * f : yOf(EA_BOOK) - 12); }   /* 새 언덕이 더 높으면 옛 꼭대기 아래(새 곡선 위에 얹히던 것 · S-검토 v3 C) */
      c.setLineDash([6, 5]); c.strokeStyle = "#9ca3af"; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(xOf(0.08), yOf(Ea)); c.lineTo(xOf(0.97), yOf(Ea)); c.stroke();
      c.beginPath(); c.moveTo(xOf(C5.A), yOf(0)); c.lineTo(xOf(0.97), yOf(0)); c.stroke(); c.setLineDash([]);
      c.strokeStyle = "#111827"; c.lineWidth = 3; c.beginPath(); for (i = 0; i <= 300; i++) { x = i / 300; c[i ? "lineTo" : "moveTo"](xOf(x), yOf(RRC.curveE(x, Ea))); } c.stroke();
      var xa = xOf(0.13), xb = xOf(0.82);
      arrow(c, xa, yOf(0), yOf(Ea), COL5.ea, F ? 3.2 : 1.6); arrow(c, xb, yOf(DH), yOf(Ea), COL5.ea, F ? 1.6 : 3.2);
      c.fillStyle = COL5.ea; c.textAlign = "left"; c.font = font(F ? "700" : "500", F ? 17 : 15); c.fillText("㉠ " + Ea + " kJ", xa + 8, yOf(Ea * 0.55)); var laW = c.measureText("㉠ " + Ea + " kJ").width, laEnd = xa + 8 + laW, laPx = (F ? 17 : 15) * f;
      /* ㉡ 글자: 캔버스 오른쪽에서 잘리면 줄이고(390 · S-검토 v3 B4), «H₂ + I₂»와 겹치지 않게 세로를 묶는다(낮은 언덕 · B3) */
      var lbT = "㉡ " + (Ea - DH) + " kJ", lbPx = (F ? 15 : 17) * f, lbAv = HG.W - 3 - (xb + 8), lh = 18 * f;
      c.font = (F ? "500 " : "700 ") + lbPx.toFixed(1) + "px 'Noto Sans KR', sans-serif"; var lbW = c.measureText(lbT).width;
      if (lbW > lbAv) { lbPx *= lbAv / lbW; c.font = (F ? "500 " : "700 ") + lbPx.toFixed(1) + "px 'Noto Sans KR', sans-serif"; lbW = c.measureText(lbT).width; }
      var prodY = yOf(DH) - 16 * f, yLo = yOf(Ea) + lh * 0.6, yHi = prodY - lh * 1.1, yLb = (yOf(DH) + yOf(Ea)) / 2;
      yLb = yLo <= yHi ? Math.max(yLo, Math.min(yHi, yLb)) : yOf(Ea) - lh * 0.7;
      c.fillText(lbT, xb + 8, yLb); layout = { W: HG.W, H: HG.H, k: k, lb: [xb + 8, yLb - lbPx / 2, lbW, lbPx], lbPx: lbPx * k, la: [xa + 8, yOf(Ea * 0.55) - laPx / 2, laW, laPx],
        arA: [xa - 6, yOf(Ea), 12, yOf(0) - yOf(Ea)], arB: [xb - 6, yOf(Ea), 12, yOf(DH) - yOf(Ea)] };
      var xd = xOf(0.985); c.strokeStyle = COL5.dh; c.lineWidth = 2.4; c.beginPath(); c.moveTo(xd, yOf(0)); c.lineTo(xd, yOf(DH)); c.stroke();
      c.beginPath(); c.moveTo(xd - 5, yOf(DH)); c.lineTo(xd + 5, yOf(DH)); c.moveTo(xd - 5, yOf(0)); c.lineTo(xd + 5, yOf(0)); c.stroke();
      c.fillStyle = COL5.dh; c.font = font("700", 15); c.textAlign = "right"; c.fillText("ΔH = " + DH + " kJ", xOf(0.97), yOf(0) + 18 * f); var dhW = c.measureText("ΔH = " + DH + " kJ").width;
      c.fillStyle = "#111827"; c.textAlign = "left"; c.font = font("700", 15); c.fillText("HI + HI", xOf(0.0), yOf(0) + 18 * f); c.fillText("H₂ + I₂", xOf(0.84), prodY); layout.prod = [xOf(0.84), prodY - 7.5 * f, c.measureText("H₂ + I₂").width, 15 * f];
      layout.dh = [xOf(0.97) - dhW, yOf(0) + 18 * f - 7.5 * f, dhW, 15 * f]; layout.hi = [xOf(0), yOf(0) + 18 * f - 7.5 * f, c.measureText("HI + HI").width, 15 * f];
      c.fillStyle = "rgba(29,78,216,.12)"; c.beginPath(); c.arc(xOf(F ? C5.X0 : C5.X1), yOf(F ? 0 : DH), 11, 0, 2 * Math.PI); c.fill();
      var ws = watchState(), dim = ws ? 0.25 : 1;
      dots.forEach(function (d) {
        var p = dotPos(d); if (!p || p.phase === "fly") return;
        var done = p.phase === "down" || p.phase === "out", col = done ? (d.r.cross ? COL5.cross : COL5.back) : COL5.dot;
        c.globalAlpha = p.alpha * dim; c.fillStyle = col; c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.beginPath(); c.arc(xOf(p.x), yOf(p.E) - 7, 7, 0, 2 * Math.PI); c.fill(); c.stroke(); c.globalAlpha = 1;
      });
      if (!ws) { magOff(); setCap(null, k < 0.75); layout.bubble = null; return; }
      var px = xOf(ws.x), py = yOf(RRC.curveE(ws.x, ws.r.Ea)) - 10, past = ws.seg >= 3;
      c.fillStyle = past ? (ws.r.cross ? COL5.cross : COL5.back) : COL5.dot; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 10, 0, 2 * Math.PI); c.fill(); c.stroke();
      var lam = RRC.lamOf(ws.x), geo = RRC.complexGeom(lam);
      lastCap = { cap: caption(lam, ws, geo), stretch: oldStretch(geo, !ws.r.fromR) };
      /* 좁은 화면(언덕 그림 < 450 px): 말풍선이 그림을 거의 덮고 점까지 가렸다(390 육안) → 그림 바로 아래 칸에 두고 꼭지가 점의 가로 자리를 따라감 */
      if (k < 0.75) { fontPx = 14; setCap(null, true); layout.bubble = null; drawMag(ws, lam, geo, px / HG.W); return; }
      magOff();
      /* 말풍선(M6 B) — 점을 따라다니며 그 자리의 원자 배열. ㉠ 글자와 ㉡ 화살표 사이에 들 수 있으면 그 사이로(꼭대기에서 «㉠ 183 kJ»를 가리던 것 · 1366 육안) */
      /* 말풍선 = 원자 그림만(작게) · 설명 글은 언덕 그림 바로 아래 고정 줄(#cap5). 글까지 담은 큰 말풍선은 높은 언덕(240~250 kJ)에서 어디에 두어도 ㉠·㉡·ΔH를 덮었다(S-검토 v3 3라운드 전 실측) */
      var band = xb - 6 - (laEnd + 6), bw = 136 * f, lo = 4, hi, capTxt = caption(lam, ws, geo);
      if (band >= 210 * f) { bw = Math.min(bw, band); lo = laEnd + 6; hi = xb - 6 - bw; } else hi = HG.W - bw - 4;   /* 띠가 좁으면(210 미만) 예전처럼 그림 안 어디든 */
      var bh = 128 * f;
      /* 자리 후보: 위 · 아래 · 오른쪽 · 왼쪽 — 그림 안에 들고 점(±13)을 가리지 않는 첫 후보(앞서 쓴 쪽 우선). 아래로 뒤집힌 뒤 바닥에 눌려 점을 덮던 것(S-검토 v3 B2) */
      var dotR = [px - 13, py - 13, 26, 26], bxC = Math.max(lo, Math.min(hi, px - bw / 2)), yC = Math.max(4, Math.min(HG.H - bh - 4, py - bh / 2));
      /* 후보마다 «가리는 넓이»(㉠·㉡·ΔH·H₂ + I₂·HI + HI 글자 ×50(㉠·㉡ 값 글자는 ×1000 — 사실상 절대 피함), ㉠·㉡ 화살표 ×1)를 재서 가장 적은 곳 — 옆으로 비킨 말풍선이 ㉠·㉡을 덮던 것(S-검토 v3 2라운드 R2-B1).
         점(±13)·그림 밖은 후보에서 뺀다. 앞서 쓴 자리는 덜 가리는 곳보다 40 px² 이내로만 나쁘면 그대로(자리 뛰기 줄임) */
      var bxF = Math.max(4, Math.min(HG.W - bw - 4, px - bw / 2)), xs = [bxC, bxF, Math.max(4, laEnd + 6), Math.max(4, xb - 6 - bw)];
      var cands = [];
      xs.forEach(function (x0, n) { cands.push({ s: "up" + n, x: x0, y: py - bh - 22 }); cands.push({ s: "down" + n, x: x0, y: py + 22 }); });
      var ys = [yC, 4, HG.H - bh - 4];
      ["la", "lb"].forEach(function (q) { var r0 = layout[q]; if (r0) { ys.push(r0[1] - bh - 4); ys.push(r0[1] + r0[3] + 4); } });
      ys.forEach(function (y0, n) { cands.push({ s: "right" + n, x: px + 22, y: y0 }); cands.push({ s: "left" + n, x: px - 22 - bw, y: y0 }); });
      function okC(o) { return o.x >= 4 && o.x + bw <= HG.W - 4 && o.y >= 4 && o.y + bh <= HG.H - 4 && !hit([o.x, o.y, bw, bh], dotR); }
      function cover(o) { var r = [o.x, o.y, bw, bh], t = 0; [["la", 1000], ["lb", 1000], ["dh", 50], ["prod", 50], ["hi", 50], ["arA", 1], ["arB", 1]].forEach(function (q) { var a = layout[q[0]]; if (a) { if (q[1] >= 1000) a = [a[0] - 4, a[1] - 4, a[2] + 8, a[3] + 8]; t += q[1] * area(r, a); }   /* ㉠·㉡ 글자는 4 px 띄움 */ }); return t; }
      var pick = null, best = 1e18, prev = null;
      cands.forEach(function (o) { if (!okC(o)) return; o.c = cover(o); if (o.c < best - 1e-9) { best = o.c; pick = o; } if (o.s === lastSide) prev = o; });
      if (prev && prev.c <= best + 40) pick = prev;
      if (!pick) pick = { s: "down0", x: bxC, y: Math.min(HG.H - bh - 4, py + 22) };
      layout.cover = pick.c || 0;
      lastSide = pick.s;
      var bx = pick.x, by = pick.y, side = pick.s.replace(/[0-9]/g, "");
      var cx = bx + bw / 2, cy = by + 72 * f, sc = 3.6 * f, tip = Math.max(bx + 10, Math.min(bx + bw - 10, px)), tipY = Math.max(by + 10, Math.min(by + bh - 10, py));
      layout.bubble = [bx, by, bw, bh]; layout.dot = dotR;
      fontPx = 15; setCap(capTxt);
      c.save(); c.fillStyle = "rgba(255,255,255,.97)"; c.strokeStyle = COL.axis; c.lineWidth = 1.5; c.beginPath(); c.rect(bx, by, bw, bh); c.fill(); c.stroke();
      c.beginPath();
      if (side === "down") { c.moveTo(tip - 8, by); c.lineTo(px, py + 12); c.lineTo(tip + 8, by); }
      else if (side === "up") { c.moveTo(tip - 8, by + bh); c.lineTo(px, py - 12); c.lineTo(tip + 8, by + bh); }
      else if (side === "right") { c.moveTo(bx, tipY - 8); c.lineTo(px + 12, py); c.lineTo(bx, tipY + 8); }
      else { c.moveTo(bx + bw, tipY - 8); c.lineTo(px - 12, py); c.lineTo(bx + bw, tipY + 8); }
      c.fill(); c.stroke();
      drawGeo(c, geo, cx, cy, sc);
      if (revealed && Math.abs(lam - 0.5) < 0.08) { c.fillStyle = COL5.ea; c.font = font("700", 14); c.textBaseline = "middle"; c.fillText("활성화물", cx, by + 13 * f); } /*REVEAL*/
      c.restore(); c.textBaseline = "middle";
    }
    var fontPx = 0, layout = {}, lastSide = null, lastCap = { cap: "", stretch: 0 };
    function area(a, b) { var w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? w * h : 0; }
    function hit(a, b) { return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]; }
    function drawGeo(c, geo, cx, cy, sc) {
      if (ART && ART.structure) { ART.structure(c, geo.atoms, geo.bonds, cx, cy, { scale: sc }); return; }
      geo.atoms.forEach(function (a) { c.beginPath(); c.arc(cx + a[1] * sc, cy + a[2] * sc, (a[0] === "H" ? 1.5 : 2.5) * sc, 0, 2 * Math.PI); c.fillStyle = ELC[a[0]]; c.fill(); });   /* FALLBACK */
    }
    function magOff() { var m = $("mag5"); if (!m.hidden) m.hidden = true; }
    /* 넓은 화면: 설명 줄은 늘 자리를 차지한다(붙잡을 때 아래 단추가 62 px 내려가던 것 · S-검토 v3 R3-C1) — 보는 중이 아니면 안내 글. 좁은 화면(아래 칸)에서는 숨김 */
    var CAP_HINT = "충돌 하나를 붙잡아 천천히 보면, 여기에 원자 배열이 어떻게 바뀌는지가 나옵니다.";
    function setCap(t, narrow) { var e = $("cap5"); if (narrow) { if (!e.hidden) e.hidden = true; return; } if (e.hidden) e.hidden = false; var v = t == null ? CAP_HINT : t; e.classList.toggle("hint", t == null); if (e.textContent !== v) e.textContent = v; }
    /* 좁은 화면의 말풍선 — 언덕 그림 바로 아래(같은 너비) · 위 꼭지가 점의 가로 자리(fx = 그림 너비에 대한 비)를 가리킴 */
    function drawMag(ws, lam, geo, fx) {
      var m = $("mag5"); if (m.hidden) m.hidden = false;
      var W = m.clientWidth || 320, H = 220, c; m.style.height = H + "px"; c = fit(m, W, H); c.clearRect(0, 0, W, H);
      var tip = Math.max(14, Math.min(W - 14, fx * W));
      c.fillStyle = "#fff"; c.strokeStyle = COL.axis; c.lineWidth = 1.5; c.beginPath(); c.rect(1, 12, W - 2, H - 13); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(tip - 9, 12.5); c.lineTo(tip, 1); c.lineTo(tip + 9, 12.5); c.fill(); c.stroke();
      drawGeo(c, geo, W / 2, 94, 5);
      c.fillStyle = "#1f2937"; c.font = "600 14px 'Noto Sans KR', sans-serif"; c.textAlign = "center"; c.textBaseline = "top"; wrapText(c, caption(lam, ws, geo), W / 2, 164, W - 24, 19);
      if (revealed && Math.abs(lam - 0.5) < 0.08) { c.fillStyle = COL5.ea; c.font = "700 15px 'Noto Sans KR', sans-serif"; c.textBaseline = "middle"; c.fillText("활성화물", W / 2, 94 - 7.5 * 5 - 14); } /*REVEAL*/
    }
    /* 날아가는 점(C5 B) — 탭 위 겹친 캔버스 */
    function drawFly() {
      var pane = $("pane5"), cv = $("fly5"), pr = pane.getBoundingClientRect(), W = Math.round(pr.width), H = Math.round(pr.height);
      cv.style.width = W + "px"; cv.style.height = H + "px"; var c = fit(cv, W, H); c.clearRect(0, 0, W, H);
      var br = $("st5").getBoundingClientRect(), hr = $("hill5").getBoundingClientRect(), bs = br.width / T4C.W, hs = hr.width / HG.W, dim = watch ? 0.25 : 1;
      dots.forEach(function (d) {
        var p = dotPos(d); if (!p || p.phase !== "fly") return;
        var k = Math.max(0, Math.min(1, p.k)), e = k * k * (3 - 2 * k), r = d.r;
        var x0 = br.left - pr.left + r.x * bs, y0 = br.top - pr.top + r.y * bs, x1 = hr.left - pr.left + xOf(r.fromR ? C5.X1 : C5.X0) * hs, y1 = hr.top - pr.top + (yOf(r.fromR ? DH : 0) - 7) * hs;
        c.globalAlpha = dim; c.fillStyle = COL5.dot; c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.beginPath(); c.arc(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e - Math.sin(Math.PI * e) * 40, 6, 0, 2 * Math.PI); c.fill(); c.stroke(); c.globalAlpha = 1;
      });
    }
    function counter() {
      var F = tab.dir === "F", need = tab.need(), pct = shownC ? Math.round(100 * shownX / shownC) : 0;
      $("ctr5").innerHTML = (F ? "정반응의 활성화 에너지 ㉠ = <b>" : "역반응의 활성화 에너지 ㉡ = <b>") + need + " kJ</b><br>언덕을 오른 충돌 <b>" + shownC + "</b>번 · 그중 꼭대기를 넘은 충돌 <b>" + shownX + "</b>번 (" + pct + " %)"; /*A3*/
    }
    function syncWatch() {
      $("wctl5").hidden = !watch;
      if (watch) { $("wPlay5").textContent = watch.playing ? "이 자리에 두기" : (watch.tau >= watch.path.T ? "처음부터 다시" : "이어 보기");   /* 말풍선만 세운다 — 용기 속 분자는 늘 움직임(«정지·멈춤» 단추 금지) */ $("wScrub5").value = String(Math.round(1000 * watch.tau / watch.path.T)); }
      $("arm5").textContent = arm ? (arm === "X" ? "꼭대기를 넘는 다음 충돌을 기다리는 중…" : "꼭대기를 넘지 못하는 다음 충돌을 기다리는 중…") : (watch ? "붙잡은 충돌 하나를 천천히 보는 중 — 밀대로 앞뒤로 옮겨 볼 수 있습니다." : "");
      $("catchX5").setAttribute("aria-pressed", String(arm === "X")); $("catchF5").setAttribute("aria-pressed", String(arm === "F"));
    }
    function updReveal() {
      var all = seen.X && seen.F, b = $("rev5"); b.disabled = !all && !revealed; $("revwhy5").hidden = all || revealed; b.textContent = revealed ? "이름 숨기기" : "이름 보기";
      $("revout5").hidden = !revealed;
      $("revout5").textContent = revealed ? "언덕 꼭대기처럼 반응물 사이의 결합이 약해지고 생성물 사이의 결합이 생기는 상태를 활성화 상태, 이 상태에 있는 불안정한 화합물을 활성화물이라고 합니다. 반응물과 활성화물의 에너지 차이가 활성화 에너지입니다." : ""; /*REVEAL*/
    }
    $("dirF5").addEventListener("click", function () { if (tab.dir === "F") return; tab.setDir("F"); clearView(); syncDir(); counter(); });
    $("dirR5").addEventListener("click", function () { if (tab.dir === "R") return; tab.setDir("R"); clearView(); syncDir(); counter(); });
    $("slow5").addEventListener("click", function () { slow = !slow; this.setAttribute("aria-pressed", String(slow)); });
    /* 183 붙음은 손가락·마우스로 끌 때만 — 키보드 ←/→ 가 183 에 갇히던 것(S-검토 v3 B5) */
    var eaDrag = false;
    $("ea5").addEventListener("pointerdown", function () { eaDrag = true; });
    ["pointerup", "pointercancel"].forEach(function (ev) { window.addEventListener(ev, function () { eaDrag = false; }); });
    $("ea5").addEventListener("input", function () { var v = +this.value; if (eaDrag && Math.abs(v - EA_BOOK) <= 3) v = EA_BOOK; setEa(v); });
    $("eaBook5").addEventListener("click", function () { setEa(EA_BOOK); });
    $("catchX5").addEventListener("click", function () { watch = null; arm = "X"; syncWatch(); });
    $("catchF5").addEventListener("click", function () { watch = null; arm = "F"; syncWatch(); });
    $("wPlay5").addEventListener("click", function () { if (!watch) return; if (watch.tau >= watch.path.T) watch.tau = 0; watch.playing = !watch.playing; syncWatch(); });
    $("wScrub5").addEventListener("input", function () { if (!watch) return; watch.playing = false; watch.tau = watch.path.T * (+this.value) / 1000; syncWatch(); noteSeen(); });
    $("wClose5").addEventListener("click", function () { watch = null; arm = null; syncWatch(); });
    $("rev5").addEventListener("click", function () { if (!(seen.X && seen.F) && !revealed) return; revealed = !revealed; updReveal(); });
    $("lgd5").innerHTML = "<span><i style='border-top-color:" + COL5.ea + "'></i>활성화 에너지</span><span><i style='border-top-color:" + COL5.dh + "'></i>반응 엔탈피(ΔH)</span><span><span class='chip' style='background:" + COL5.cross + ";border-radius:50%'></span>꼭대기를 넘은 충돌</span><span><span class='chip' style='background:" + COL5.back + ";border-radius:50%'></span>되돌아온 충돌</span>"; /*A3*/
    return {
      ensure: ensure,
      frame: function (dt) {
        if (!inited) return;
        var h = dt * (slow ? TSCALE_SLOW : 1) * (RM ? TSCALE_RM : 1);
        tab.step(h);
        rings.forEach(function (g) { g.t += h; });
        dots.forEach(function (d) { var before = dotPos(d); d.t += h; var p = dotPos(d); if (before && before.phase === "up" && (!p || p.phase !== "up")) { shownC++; if (d.r.cross) shownX++; } });
        dots = dots.filter(function (d) { return dotPos(d); });
        if (watch && watch.playing) { watch.tau = Math.min(watch.path.T, watch.tau + dt * (RM ? TSCALE_RM : 1)); if (watch.tau >= watch.path.T) watch.playing = false; syncWatch(); }
        noteSeen();
        if (!$("pane5").hidden) { drawStage(); drawHill(); drawFly(); counter(); }
      },
      state: function () {
        var ws = watchState(), b = tab.box();
        return { dir: tab.dir, ea: tab.ea, need: tab.need(), climbs: tab.climbs, crosses: tab.crosses, boxReacts: tab.boxReactsNow(), shownC: shownC, shownX: shownX, dots: dots.length,
          fontPx: fontPx, mag: !$("mag5").hidden, layout: JSON.parse(JSON.stringify(layout)), cap: lastCap, watch: ws ? { x: ws.x, seg: ws.seg, cross: ws.r.cross, fromR: ws.r.fromR, tau: watch.tau, T: watch.path.T, playing: watch.playing, lam: RRC.lamOf(ws.x) } : null, arm: arm, seen: seen, revealed: revealed,
          reactants: tab.dir === "F" ? b.count("HI") : b.count("H2") + b.count("I2"), t: b.w.t, mols: b.w.mols.filter(function (m) { return !m.dead; }).map(function (m) { return [m.x, m.y, m.id]; }) };
      },
      tab: function () { return tab; },
      seek: function (tau) { if (watch) { watch.tau = tau; watch.playing = false; syncWatch(); noteSeen(); } },
      /* 검사용: 정해 둔 충돌 하나로 천천히 보기(실제 붙잡기와 같은 길 · 화면 확인 전용) */
      watchWith: function (r) { watch = { r: r, path: RRC.watchPath(r, tab.inject), tau: 0, playing: false }; lastSide = null; syncWatch(); },
      setEaTest: function (E) { setEa(E); }
    };
  })();

  /* ════════ 시계 하나 ════════ */
  var last = 0, raf = 0;
  function loop(ts) { var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; T1.frame(dt); T2.frame(dt); T3.frame(dt); T4.frame(dt); T5.frame(dt); raf = requestAnimationFrame(loop); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } });
  window.__rr = { T1: T1, T2: T2, T3: T3, T4: T4, T5: T5, showTab: showTab, flashArea: flashArea, usingArt: function () { return RRC.usingArt(); },
    advance: function (sec) { for (var i = 0; i < Math.round(sec * 30); i++) { T1.frame(1 / 30); T2.frame(1 / 30); T3.frame(1 / 30); T4.frame(1 / 30); T5.frame(1 / 30); } } };
  showTab("1");
  raf = requestAnimationFrame(loop);
})();
