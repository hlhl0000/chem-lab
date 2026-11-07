/* 반응의 자발성 (화학탐구실 spontaneity/) — 조립 산출물. 정본: 검증스크립트/spontaneity_core.js · _spontaneity_fx/spontaneity_art.part.js(Astra) · _spontaneity_ui.part.js
   조립: node 검증스크립트/_spontaneity_assemble.js · 근거: 설계지시안_반응의자발성_v1.2.md */
/* ==== CORE BEGIN ==== */
var SPONT = (function () {
  "use strict";

  /* ── 상수 단일 원천 ── T 단위: 입자 1개당 평균 운동 에너지 = T·unit (unit = vs²) · 2차원 기체 E = N·T
     온도 값(T)은 화면용 눈금이다 — 실제 −20 ℃·25 ℃의 ΔS주위 비는 약 1.18배인데 여기서는 약 3.1배로 과장했다(가정과 한계에 표시). */
  /* BK = 충돌·근접·박스 판정의 비커 사각형. ★ 그림의 벽과 같아야 한다(원칙 11·13): SPONT_ART.beaker(ctx, REQ, s).outer 가 BK 가 되도록 REQ 를 정했다.
     일치는 프로브가 그림 함수를 불러 ±0.05 px 로 대조한다(P-검토 A-1). */
  var C = {
    FPS: 30, SUB: 2, VS: 60, HIST: 45, TRAIL: 6, GHOST: 180,
    NEAR_D: 60,          /* 시안 2 C2 A — 입자 지름 약 5개 */
    OUT_MIN: 0.5,        /* 박스 상한: 바깥 면적이 비커 밖 면적의 50 % 이상(입자 수 흔들림 — P0 M-5) */
    BOX_MARGIN: 14,      /* 박스는 비커에서 최소 이만큼 떨어져 둘러싼다 */
    BINS: 30, YMAX: 0.0125,   /* T=1 봉우리 0.0101 + 흔들림. 잘리면 평평한 고원으로 보인다(매뉴얼 4부 ⑥) */
    T_MIN: 0.9,          /* 빼기 뒤 T 하한 — 가장 차가운 무대의 처음 값(T=1) 아래로 크게 내려가지 않게 */
    FLOOR: 0.15,         /* 벽이 입자 하나에서 빼는 상한 = 그 입자 에너지의 85 % — 입자를 멈춰 세우지 않는다 */
    T1: { W: 960, H: 560, BK: { x: 395, y: 180, w: 170, h: 200 }, REQ: { x: 377, y: 170, w: 206, h: 217.62 }, N: 320, R: 6, T0: 2, Q: 1, HEAT: 8, SETTLE: 13, VMAX: 400, SEED: 11 },
    T2: { W: 500, H: 460, BK: { x: 195, y: 160, w: 110, h: 140 }, REQ: { x: 177.63, y: 151.54, w: 144.74, h: 153.85 }, N: 200, R: 6, TC: 1, TH: 4, Q: 1, HEAT: 8, SETTLE: 6, VMAX: 520, SEEDC: 21, SEEDH: 22, BOX: { x: 150, y: 115, w: 200, h: 230 } },
    /* 탭 ③ = 장면 위 덧씌우기(사용자 결정 11-07 「장면 속 컵 자리에 그대로」). 무대 W×H = ART.scene 상자 {0,0,W,H}(장면 비 1.8).
       SC.*.BK = ART.scene(…).cup 그대로 · REQ = beaker(REQ).outer가 BK가 되도록 푼 값 · WATER = beaker(REQ, LEVEL).cavity·surfaceY 에서 8 px 안쪽.
       유도: 검증스크립트/_spontaneity_cup_geom.js — 프로브가 그림 함수로 ±0.05 px 대조. 물 분자 크기·결합은 컵이 작아진 만큼 2/3로 줄였다 */
    T3: { W: 900, H: 500, N: 300, R: 6, TF: 1, TC: 4, Q: 1, HEAT: 8, SETTLE: 9, VMAX: 520, SEEDF: 41, SEEDV: 42, SEEDR: 43, SYS: 0.40, LEVEL: 0.82, BOND: 20, WATER_R: 5.5, WATER_VS: 23, WATER_T: 3, WATER_MIN: 10,
      SC: {
        freezer:   { BK: { x: 482.4, y: 142.5, w: 151.2, h: 196 }, REQ: { x: 464.4, y: 132.5, w: 187.2, h: 213.47 }, WATER: { x: 495.04, y: 194.98, w: 125.92, h: 130.88 } },
        classroom: { BK: { x: 446.4, y: 205, w: 151.2, h: 196 }, REQ: { x: 428.4, y: 195, w: 187.2, h: 213.47 }, WATER: { x: 459.04, y: 257.48, w: 125.92, h: 130.88 } }
      } }
  };

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }

  /* ── 기체: 계속 도는 모형 ──
     열은 비커 벽에서만 드나들고, 벽에 부딪힌 입자의 운동 에너지를 바꾸는 것으로만 전해진다. 에너지를 따로 그릴 것이 없다.
     heat(q, dur): dur초 동안 입자 1개당 q만큼을 일정한 빠르기로 넣거나(+) 뺀다(−). 같은 q·dur면 두 무대의 열 유입 시각이 같다(P0 M-2).
     마지막 충돌까지 정한 양을 넘지 않는다(M-3 — 예산에서만 꺼내 쓴다). 벽 밖 무대 가장자리는 단열이다. */
  function gas(o) {
    var r = mulberry(o.seed || 1), W = o.W, H = o.H, N = o.N, R = o.R, b = o.beaker, vs = o.vs || C.VS, unit = vs * vs;
    var sub = C.SUB, dt = 1 / (C.FPS * sub), HIST = C.HIST;
    var x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
    var i, j, n = 0, guard = 0;
    while (n < N) {
      if (++guard > 400000) throw new Error("gas: 입자를 놓을 자리가 없다");
      var px = R + r() * (W - 2 * R), py = R + r() * (H - 2 * R);
      if (b && px > b.x - R && px < b.x + b.w + R && py > b.y - R && py < b.y + b.h + R) continue;
      var ok = true;
      for (j = 0; j < n; j++) { var ax = x[j] - px, ay = y[j] - py; if (ax * ax + ay * ay < 4 * R * R) { ok = false; break; } }
      if (!ok) continue;
      x[n] = px; y[n] = py; vx[n] = gauss(r); vy[n] = gauss(r); n++;
    }
    var e0 = 0; for (i = 0; i < N; i++) e0 += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i]);
    var sc = Math.sqrt(N * o.T0 * unit / e0); for (i = 0; i < N; i++) { vx[i] *= sc; vy[i] *= sc; }

    var cell = 2.2 * R, cw = Math.ceil(W / cell) + 1, ch = Math.ceil(H / cell) + 1;
    var head = new Int32Array(cw * ch), next = new Int32Array(N);
    var budget = 0, added = 0, rate = 0, rateLeft = 0, tSim = 0;
    /* 지난 몇 프레임의 자리·속력: 꼬리와 곡선이 같은 기록을 읽는다(단일 원천) */
    var hp = new Float32Array(HIST * N * 2), hs = new Float32Array(HIST * N), hHead = -1, hCount = 0;

    function wall(k) {
      if (!b) return;
      var dl = x[k] - (b.x - R), dr = (b.x + b.w + R) - x[k], dtp = y[k] - (b.y - R), db = (b.y + b.h + R) - y[k];
      if (dl <= 0 || dr <= 0 || dtp <= 0 || db <= 0) return;
      var m = Math.min(dl, dr, dtp, db), nx = 0, ny = 0;
      if (m === dl) { nx = -1; x[k] = b.x - R; } else if (m === dr) { nx = 1; x[k] = b.x + b.w + R; }
      else if (m === dtp) { ny = -1; y[k] = b.y - R; } else { ny = 1; y[k] = b.y + b.h + R; }
      var vn = vx[k] * nx + vy[k] * ny;
      if (vn >= 0) return;
      vx[k] -= 2 * vn * nx; vy[k] -= 2 * vn * ny;
      if (budget !== 0) {
        var ke = 0.5 * (vx[k] * vx[k] + vy[k] * vy[k]), de = budget > 0 ? budget : Math.max(budget, -(1 - C.FLOOR) * ke);
        if (ke > 0) { var f = Math.sqrt((ke + de) / ke); vx[k] *= f; vy[k] *= f; budget -= de; added += de; }
      }
    }
    function step() {
      if (rateLeft > 0) { var use = Math.min(dt, rateLeft); budget += rate * use; rateLeft -= use; }
      var k;
      for (k = 0; k < N; k++) {
        x[k] += vx[k] * dt; y[k] += vy[k] * dt;
        if (x[k] < R) { x[k] = 2 * R - x[k]; vx[k] = Math.abs(vx[k]); } else if (x[k] > W - R) { x[k] = 2 * (W - R) - x[k]; vx[k] = -Math.abs(vx[k]); }
        if (y[k] < R) { y[k] = 2 * R - y[k]; vy[k] = Math.abs(vy[k]); } else if (y[k] > H - R) { y[k] = 2 * (H - R) - y[k]; vy[k] = -Math.abs(vy[k]); }
      }
      for (k = 0; k < head.length; k++) head[k] = -1;
      for (k = 0; k < N; k++) {
        var c0 = Math.max(0, Math.min(cw - 1, x[k] / cell | 0)) + Math.max(0, Math.min(ch - 1, y[k] / cell | 0)) * cw;
        next[k] = head[c0]; head[c0] = k;
      }
      for (k = 0; k < N; k++) {
        var cx = Math.max(0, Math.min(cw - 1, x[k] / cell | 0)), cy = Math.max(0, Math.min(ch - 1, y[k] / cell | 0)), gx, gy, q;
        for (gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gx >= cw) continue;
          for (gy = cy - 1; gy <= cy + 1; gy++) {
            if (gy < 0 || gy >= ch) continue;
            for (q = head[gx + gy * cw]; q >= 0; q = next[q]) {
              if (q <= k) continue;
              var dx = x[q] - x[k], dy = y[q] - y[k], d2 = dx * dx + dy * dy;
              if (d2 >= 4 * R * R || d2 === 0) continue;
              var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, rel = (vx[k] - vx[q]) * nx + (vy[k] - vy[q]) * ny;
              if (rel > 0) { vx[k] -= rel * nx; vy[k] -= rel * ny; vx[q] += rel * nx; vy[q] += rel * ny; }
              var ov = (2 * R - d) / 2; x[k] -= nx * ov; y[k] -= ny * ov; x[q] += nx * ov; y[q] += ny * ov;
            }
          }
        }
      }
      for (k = 0; k < N; k++) {
        wall(k);
        x[k] = Math.max(R, Math.min(W - R, x[k])); y[k] = Math.max(R, Math.min(H - R, y[k]));
      }
      tSim += dt;
    }
    function push() {
      hHead = (hHead + 1) % HIST; if (hCount < HIST) hCount++;
      var a = hHead * N * 2, c = hHead * N, k;
      for (k = 0; k < N; k++) { hp[a + 2 * k] = x[k]; hp[a + 2 * k + 1] = y[k]; hs[c + k] = Math.sqrt(vx[k] * vx[k] + vy[k] * vy[k]); }
    }
    function frame() { var s; for (s = 0; s < sub; s++) step(); push(); }
    var pre = o.pre == null ? 240 : o.pre, f0;
    for (f0 = 0; f0 < pre; f0++) step();   /* 처음 배치를 섞는다 — 에너지는 그대로 */
    added = 0; budget = 0; tSim = 0; push();

    function energy() { var s = 0, k; for (k = 0; k < N; k++) s += 0.5 * (vx[k] * vx[k] + vy[k] * vy[k]); return s / unit; }
    var api = {
      W: W, H: H, N: N, R: R, vs: vs, unit: unit, beaker: b, x: x, y: y, vx: vx, vy: vy,
      step: step, frame: frame, energy: energy,
      time: function () { return tSim; },
      addedPerN: function () { return added / unit / N; },
      T: function () { return energy() / N; },
      /* dur초에 걸쳐 입자 1개당 q */
      heat: function (q, dur) {
        if (rateLeft > 0 || Math.abs(budget) > 1e-9 * unit) return false;   /* 진행 중에는 거부 — 남은 예산을 덮어쓰지 않는다 */
        if (energy() / N + q < C.T_MIN) return false;                        /* 입자가 거의 멈출 만큼은 빼지 않는다(P0 M-1) */
        rate = q * N * unit / dur; rateLeft = dur; return true;
      },
      /* 정한 양이 다 들어갈 때까지 참 — 빼기는 입자가 느려질수록 뒤처질 수 있다 */
      heating: function () { return rateLeft > 0 || Math.abs(budget) > 1e-9 * unit; },
      /* 프레임 k개 전의 자리(k = 0 지금). 꼬리가 읽는다 */
      histX: function (i2, k) { var h = (hHead - k + HIST * 2) % HIST; return hp[h * N * 2 + 2 * i2]; },
      histY: function (i2, k) { var h = (hHead - k + HIST * 2) % HIST; return hp[h * N * 2 + 2 * i2 + 1]; },
      histLen: function () { return hCount; },
      /* 곡선: 지난 window 프레임의 바깥 입자를 센다 */
      hist: function (box, bins, vmax, win) {
        var hh = new Float64Array(bins), cnt = 0, sv2 = 0, w = vmax / bins, used = 0, k2, q2, m = Math.min(win || HIST, hCount);
        for (k2 = 0; k2 < m; k2++) {
          var hf = (hHead - k2 + HIST * 2) % HIST, a2 = hf * N * 2, c2 = hf * N; used++;
          for (q2 = 0; q2 < N; q2++) {
            if (!isOutside(hp[a2 + 2 * q2], hp[a2 + 2 * q2 + 1], box)) continue;
            var v = hs[c2 + q2], bin = v / w | 0; if (bin >= bins) bin = bins - 1;
            hh[bin]++; cnt++; sv2 += v * v;
          }
        }
        if (cnt) for (k2 = 0; k2 < bins; k2++) hh[k2] /= cnt * w;
        return { h: hh, n: used ? cnt / used : 0, T: cnt ? 0.5 * sv2 / cnt / unit : 0 };
      }
    };
    return api;
  }

  /* 「처음 모습」 기록: 시작 전 움직임을 frames 프레임 찍는다. 앞뒤로 왕복 재생해 이음매에서 입자가 순간 이동하지 않게 한다
     (탄성 충돌은 시간을 뒤집어도 같은 법칙이므로 뒤로 도는 움직임도 물리적으로 맞다) */
  function recordGhost(sim, frames) {
    var N = sim.N, pos = new Float32Array(frames * N * 2), spd = new Float32Array(frames * N), f, i;
    for (f = 0; f < frames; f++) {
      sim.frame();
      for (i = 0; i < N; i++) { pos[f * N * 2 + 2 * i] = sim.x[i]; pos[f * N * 2 + 2 * i + 1] = sim.y[i]; spd[f * N + i] = Math.sqrt(sim.vx[i] * sim.vx[i] + sim.vy[i] * sim.vy[i]); }
    }
    return { N: N, frames: frames, pos: pos, spd: spd, unit: sim.unit };
  }
  function pingpong(tick, frames) { var p = 2 * (frames - 1), m = ((tick % p) + p) % p; return m < frames ? m : p - m; }
  function ghostHist(g, box, bins, vmax) {
    var hh = new Float64Array(bins), cnt = 0, sv2 = 0, w = vmax / bins, f, i;
    for (f = 0; f < g.frames; f++) {
      var a = f * g.N * 2, c = f * g.N;
      for (i = 0; i < g.N; i++) {
        if (!isOutside(g.pos[a + 2 * i], g.pos[a + 2 * i + 1], box)) continue;
        var v = g.spd[c + i], k = v / w | 0; if (k >= bins) k = bins - 1;
        hh[k]++; cnt++; sv2 += v * v;
      }
    }
    if (cnt) for (i = 0; i < bins; i++) hh[i] /= cnt * w;
    return { h: hh, T: cnt ? 0.5 * sv2 / cnt / g.unit : 0, n: cnt / g.frames };
  }

  /* ── 판정 단일 원천 ── 강조·곡선·점검이 같은 함수를 쓴다 */
  function isOutside(px, py, box) { return !box || px < box.x || px > box.x + box.w || py < box.y || py > box.y + box.h; }
  function gapTo(px, py, q) { var dx = Math.max(q.x - px, 0, px - q.x - q.w), dy = Math.max(q.y - py, 0, py - q.y - q.h); return Math.sqrt(dx * dx + dy * dy); }
  /* 계에 가까운 입자(사용자 결정 #1). ★ 자리로만 정한다 — 속력을 읽지 않는다 */
  function isNear(px, py, q) { var g = gapTo(px, py, q); return g > 0 && g <= C.NEAR_D; }

  /* 박스: 끈 두 점을 받아 항상 비커를 둘러싸게 만들고, 너무 크면 바깥 면적 하한까지만 넓힌다 */
  function boxOK(b, W, H, bk) { return (W * H - b.w * b.h) / (W * H - bk.w * bk.h) >= C.OUT_MIN; }
  function boxFrom(a, c, W, H, bk) {
    var M = C.BOX_MARGIN, x0 = Math.max(4, Math.min(a.x, c.x, bk.x - M)), y0 = Math.max(4, Math.min(a.y, c.y, bk.y - M));
    var x1 = Math.min(W - 4, Math.max(a.x, c.x, bk.x + bk.w + M)), y1 = Math.min(H - 4, Math.max(a.y, c.y, bk.y + bk.h + M));
    var nb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    if (boxOK(nb, W, H, bk)) return nb;
    var m0 = { x: bk.x - M, y: bk.y - M, w: bk.w + 2 * M, h: bk.h + 2 * M }, lo = 0, hi = 1, k;
    function mix(u) { return { x: m0.x + (nb.x - m0.x) * u, y: m0.y + (nb.y - m0.y) * u, w: m0.w + (nb.w - m0.w) * u, h: m0.h + (nb.h - m0.h) * u }; }
    for (k = 0; k < 14; k++) { var mid = (lo + hi) / 2; if (boxOK(mix(mid), W, H, bk)) lo = mid; else hi = mid; }
    return mix(lo);
  }

  /* 2차원 평형 속력 분포(레일리) — 검산의 «아는 정답» */
  function rayleigh(v, T, vs) { var a = T * vs * vs; return (v / a) * Math.exp(-v * v / (2 * a)); }

  /* 저울: 모형 값에서 유도(J-N5). ΔS주위/Nk = ln(T나중/T처음) · ΔS계는 고정 ∓SYS.
     SYS = Q/T_f 로 읽으면 어는점 T_f = 2.5(화면 단위) — 냉동실 1→2는 전 구간 아래, 교실 4→5는 전 구간 위라 서로 맞는다.
     왼쪽 접시 = 계, 오른쪽 접시 = 주위. 큰 쪽이 내려간다(tilt +1 = 오른쪽 내려감).
     11-07 사용자 결정: 저울 대신 값 상자(△S계 · △S주위, 부호 포함, 변화 중 실시간) — 끝값은 이 함수와 같다 */
  function balance(mode, T0, Tend) {
    var sur = Math.log(Tend / T0), sys = mode === "melt" ? C.T3.SYS : -C.T3.SYS, g = Math.abs(sur), l = Math.abs(sys);
    return { sur: sur, sys: sys, total: sur + sys, tilt: Math.max(-1, Math.min(1, (g - l) / Math.max(g, l) * 1.4)) };
  }
  /* 실시간 값: △S주위 = ln(T지금/T처음) · △S계 = ∓SYS × (지금까지 오간 열 / Q) — △S계 = −q/T_f 를 열이 오간 만큼 */
  function dsNow(mode, T0, Tnow, addedPerN) {
    var f = Math.min(1, Math.abs(addedPerN) / C.T3.Q);
    return { sys: (mode === "melt" ? 1 : -1) * C.T3.SYS * f, sur: Math.log(Tnow / T0) };
  }
  /* 부호 붙인 두 자리 글: +0.69 · −0.40(U+2212) · 0.00 */
  function signed(v) {
    var r = Math.round(v * 100) / 100;
    if (r === 0) return "0.00";
    return (r > 0 ? "+" : "−") + Math.abs(r).toFixed(2);
  }

  /* 용액 온도(−1…1)와 녹은 정도 — 한 시계 */
  function solution(sinceStart, heatDur, sign) {
    var u = Math.max(0, Math.min(1, sinceStart / heatDur)), rise = Math.max(0, Math.min(1, sinceStart / 1.2)), fall = sinceStart > heatDur ? Math.max(0, 1 - (sinceStart - heatDur) / 5) : 1;
    return { temp: sign * rise * fall, dissolved: u };
  }

  /* ── 탭 ③ 물 분자 ── 벌집 격자(결합 길이 a) · 매달린 자리 제거(waterdensity iceLattice와 같은 규칙) */
  function honeycomb(W, H, a) {
    var S3 = Math.sqrt(3), seen = {}, sites = [], bonds = [], i, j, k;
    function put(x, y) { if (x < 2 || y < 2 || x > W - 2 || y > H - 2) return; var key = Math.round(x * 100) + "|" + Math.round(y * 100); if (!seen[key]) { seen[key] = 1; sites.push({ x: x, y: y }); } }
    for (i = -2; 1.5 * a * i <= W + 3 * a; i++) for (j = -2; S3 * a * j <= H + 3 * a; j++) { var cx = 1.5 * a * i, cy = S3 * a * j + (i % 2 ? S3 * a / 2 : 0); for (k = 0; k < 6; k++) put(cx + a * Math.cos(Math.PI / 3 * k), cy + a * Math.sin(Math.PI / 3 * k)); }
    for (i = 0; i < sites.length; i++) for (j = i + 1; j < sites.length; j++) { var d = Math.sqrt(Math.pow(sites[i].x - sites[j].x, 2) + Math.pow(sites[i].y - sites[j].y, 2)); if (Math.abs(d - a) < 1) bonds.push([i, j]); }
    for (k = 0; k < 20; k++) {
      var deg = sites.map(function () { return 0; }); bonds.forEach(function (b) { deg[b[0]]++; deg[b[1]]++; });
      if (deg.every(function (v) { return v >= 2; })) break;
      var keep = [], map = {}; sites.forEach(function (q, n) { if (deg[n] >= 2) { map[n] = keep.length; keep.push(q); } });
      bonds = bonds.filter(function (b) { return map[b[0]] !== undefined && map[b[1]] !== undefined; }).map(function (b) { return [map[b[0]], map[b[1]]]; }); sites = keep;
    }
    return { sites: sites, bonds: bonds };
  }
  /* 분자 ↔ 격자 자리: 가까운 것부터 */
  function assign(px, py, sites) {
    var used = {}, out = [], i, j;
    for (i = 0; i < px.length; i++) { var best = -1, bd = 1e12; for (j = 0; j < sites.length; j++) { if (used[j]) continue; var d = Math.pow(px[i] - sites[j].x, 2) + Math.pow(py[i] - sites[j].y, 2); if (d < bd) { bd = d; best = j; } } used[best] = 1; out.push(best); }
    return out;
  }
  function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  /* 물 분자 표시 자리: 액체 자리 ↔ 격자 자리(진동)를 frozen으로 섞고, 겹치면 풀어 준다. 언 뒤에는 자리가 떨어져 있어 풀 것이 없다 */
  function waterPositions(lx, ly, sites, map, frozen, sec, w, h) {
    var n = lx.length, a = [], i, j, it, MIN = C.T3.WATER_MIN, vib = 1.6;
    for (i = 0; i < n; i++) {
      var st = sites[map[i]], sx = st.x + vib * Math.sin(sec * 9 + i * 1.7), sy = st.y + vib * Math.cos(sec * 7.3 + i * 2.3);
      a.push({ x: lx[i] + (sx - lx[i]) * frozen, y: ly[i] + (sy - ly[i]) * frozen, angle: (1 - frozen) * (sec * 1.1 + i) + frozen * (i * 1.05 + 0.08 * Math.sin(sec * 6 + i)) });
    }
    for (it = 0; it < 6; it++) for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var dx = a[j].x - a[i].x, dy = a[j].y - a[i].y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      if (d >= MIN) continue;
      var push = (MIN - d) / 2, ux = dx / d, uy = dy / d; a[i].x -= ux * push; a[i].y -= uy * push; a[j].x += ux * push; a[j].y += uy * push;
    }
    for (i = 0; i < n; i++) { a[i].x = Math.max(4, Math.min(w - 4, a[i].x)); a[i].y = Math.max(4, Math.min(h - 4, a[i].y)); }
    return a;
  }

  return { C: C, gas: gas, recordGhost: recordGhost, pingpong: pingpong, ghostHist: ghostHist, isOutside: isOutside, gapTo: gapTo, isNear: isNear, boxOK: boxOK, boxFrom: boxFrom, rayleigh: rayleigh, balance: balance, dsNow: dsNow, signed: signed, solution: solution, honeycomb: honeycomb, assign: assign, ease: ease, waterPositions: waterPositions };
}());
/* ==== CORE END ==== */

/* ==== ART BEGIN (Astra SPONT_ART v1.2.0 — 원본 그대로 · 수정 금지) ==== */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var beakerCache = {};
  var beakerKeys = [];
  var airCache = {};
  var airKeys = [];
  var trailCache = {};
  var trailKeys = [];
  var beakerLimit = 18;
  var airLimit = 16;
  var trailLimit = 48;

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function number(value, fallback) {
    value = +value;
    return isFinite(value) ? value : fallback;
  }

  function colorValue(value) {
    var match;
    if (typeof value !== 'string') {
      return null;
    }
    match = /^#([0-9a-f]{6})$/i.exec(value);
    if (!match) {
      return null;
    }
    return {
      hex: '#' + match[1].toLowerCase(),
      r: parseInt(match[1].substr(0, 2), 16),
      g: parseInt(match[1].substr(2, 2), 16),
      b: parseInt(match[1].substr(4, 2), 16)
    };
  }

  function mixedColor(color, target, amount) {
    var inverse = 1 - amount;
    return 'rgb(' +
      Math.round(color.r * inverse + target * amount) + ',' +
      Math.round(color.g * inverse + target * amount) + ',' +
      Math.round(color.b * inverse + target * amount) + ')';
  }

  function rounded(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    circle(ctx, 0, 0, 1);
    ctx.restore();
  }

  function prng(seed) {
    var state = (Math.floor(number(seed, 137)) >>> 0) || 137;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function scaleOf(ctx) {
    var transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    if (!transform) {
      return 1;
    }
    return Math.max(1, Math.abs(transform.a), Math.abs(transform.d));
  }

  function rgb(r, g, b) {
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function liquidFill(temp) {
    var neutral = [218, 235, 241];
    var target;
    var amount;
    temp = clamp(temp, -1, 1);
    target = temp < 0 ? [181, 220, 244] : [242, 190, 202];
    amount = Math.abs(temp);
    return rgb(
      neutral[0] + (target[0] - neutral[0]) * amount,
      neutral[1] + (target[1] - neutral[1]) * amount,
      neutral[2] + (target[2] - neutral[2]) * amount
    );
  }

  function liquidLine(temp) {
    var neutral = [92, 141, 158];
    var target;
    var amount;
    temp = clamp(temp, -1, 1);
    target = temp < 0 ? [54, 130, 184] : [176, 86, 109];
    amount = Math.abs(temp);
    return rgb(
      neutral[0] + (target[0] - neutral[0]) * amount,
      neutral[1] + (target[1] - neutral[1]) * amount,
      neutral[2] + (target[2] - neutral[2]) * amount
    );
  }

  function sanitizeBox(box, fallbackW, fallbackH) {
    box = box || {};
    return {
      x: number(box.x, 0),
      y: number(box.y, 0),
      w: Math.max(24, number(box.w, fallbackW)),
      h: Math.max(24, number(box.h, fallbackH))
    };
  }

  function drawSolid(ctx, cavity, kind, dissolved, seed) {
    var remaining = 1 - clamp(dissolved, 0, 1);
    var random;
    var count;
    var i;
    var size;
    var px;
    var py;
    var jitter;
    if (kind === 'none' || remaining <= 0.001) {
      return;
    }
    random = prng(seed);
    count = kind === 'pellet' ? 7 : 13;
    size = Math.max(1.1, Math.min(cavity.w * (kind === 'pellet' ? 0.075 : 0.046), cavity.h * 0.06)) * remaining;
    if (size < 0.35) {
      return;
    }
    ctx.save();
    rounded(ctx, cavity.x, cavity.y, cavity.w, cavity.h, Math.min(4, cavity.w * 0.04));
    ctx.clip();
    ctx.fillStyle = '#fbfdff';
    ctx.strokeStyle = '#7b8794';
    ctx.lineWidth = Math.max(0.65, size * 0.18);
    for (i = 0; i < count; i += 1) {
      px = cavity.x + cavity.w * (0.12 + random() * 0.76);
      py = cavity.y + cavity.h - size * (0.72 + random() * 1.25) - (i % 2) * size * 0.35;
      if (kind === 'pellet') {
        rounded(ctx, px - size * 0.82, py - size * 0.48, size * 1.64, size * 0.96, size * 0.44);
        ctx.fill();
        ctx.stroke();
      } else {
        jitter = size * (0.78 + random() * 0.45);
        ctx.beginPath();
        ctx.moveTo(px - jitter, py + size * 0.15);
        ctx.lineTo(px - size * 0.38, py - size * 0.72);
        ctx.lineTo(px + size * 0.48, py - size * 0.58);
        ctx.lineTo(px + jitter, py + size * 0.24);
        ctx.lineTo(px + size * 0.08, py + size * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawIce(ctx, cavity, surfaceY, frozen) {
    var bottom = cavity.y + cavity.h;
    var dome = Math.min(cavity.w * 0.055, cavity.h * 0.055) * frozen;
    var left = cavity.x;
    var right = cavity.x + cavity.w;
    var center = cavity.x + cavity.w * 0.5;
    if (frozen <= 0.001 || surfaceY >= bottom) {
      return;
    }
    ctx.save();
    ctx.globalAlpha *= 0.35 + frozen * 0.65;
    ctx.fillStyle = '#c4dfed';
    ctx.beginPath();
    ctx.moveTo(left, surfaceY + dome * 0.35);
    ctx.quadraticCurveTo(center, surfaceY - dome, right, surfaceY + dome * 0.35);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78a9c2';
    ctx.lineWidth = Math.max(0.7, cavity.w * 0.009);
    ctx.beginPath();
    ctx.moveTo(left, surfaceY + dome * 0.35);
    ctx.quadraticCurveTo(center, surfaceY - dome, right, surfaceY + dome * 0.35);
    ctx.stroke();
    ctx.globalAlpha *= 0.48;
    ctx.strokeStyle = '#7ba9be';
    ctx.lineWidth = Math.max(0.55, cavity.w * 0.006);
    ctx.beginPath();
    ctx.moveTo(left + cavity.w * 0.12, surfaceY + cavity.h * 0.19);
    ctx.lineTo(left + cavity.w * 0.34, surfaceY + cavity.h * 0.35);
    ctx.lineTo(left + cavity.w * 0.52, surfaceY + cavity.h * 0.22);
    ctx.lineTo(left + cavity.w * 0.74, surfaceY + cavity.h * 0.42);
    ctx.moveTo(left + cavity.w * 0.28, bottom - cavity.h * 0.08);
    ctx.lineTo(left + cavity.w * 0.45, surfaceY + cavity.h * 0.35);
    ctx.lineTo(left + cavity.w * 0.66, bottom - cavity.h * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  function drawBeakerDirect(ctx, box, s) {
    var w = box.w;
    var h = box.h;
    var side = Math.max(5, Math.min(18, w * 0.12));
    var topInset = Math.max(3, Math.min(10, h * 0.055));
    var bottomInset = Math.max(3, Math.min(8, h * 0.035));
    var outer = {
      x: box.x + side,
      y: box.y + topInset,
      w: w - side * 2,
      h: h - topInset - bottomInset
    };
    var wall = Math.max(1.4, Math.min(3.2, outer.w * 0.034));
    var lidH = Math.max(4, Math.min(10, outer.h * 0.072));
    var cavity = {
      x: outer.x + wall * 1.45,
      y: outer.y + lidH + wall * 0.7,
      w: outer.w - wall * 2.9,
      h: outer.h - lidH - wall * 2.15
    };
    var content = s.content === 'empty' ? 'empty' : (s.content === 'water' ? 'water' : 'solution');
    var level = clamp(number(s.level, 0.62), 0, 1);
    var temp = clamp(number(s.temp, 0), -1, 1);
    var frozen = clamp(number(s.frozen, 0), 0, 1);
    var dissolved = clamp(number(s.dissolved, 0), 0, 1);
    var solid = s.solid === 'pellet' ? 'pellet' : (s.solid === 'granule' ? 'granule' : 'none');
    var surfaceY = content === 'empty' ? cavity.y + cavity.h : cavity.y + cavity.h * (1 - level);
    var liquidH = cavity.y + cavity.h - surfaceY;
    var baseY = outer.y + outer.h;

    ctx.save();
    ctx.fillStyle = 'rgba(51,65,85,0.11)';
    ellipse(ctx, outer.x + outer.w * 0.5, baseY + Math.min(2, bottomInset * 0.25), outer.w * 0.43, Math.max(1, h * 0.018));
    ctx.fill();

    ctx.fillStyle = '#eef4f7';
    ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
    ctx.fillStyle = '#fbfdff';
    rounded(ctx, cavity.x, cavity.y, cavity.w, cavity.h, Math.min(4, cavity.w * 0.045));
    ctx.fill();

    if (content !== 'empty' && liquidH > 0.2) {
      ctx.save();
      rounded(ctx, cavity.x, cavity.y, cavity.w, cavity.h, Math.min(4, cavity.w * 0.045));
      ctx.clip();
      ctx.fillStyle = liquidFill(temp);
      ctx.fillRect(cavity.x, surfaceY, cavity.w, liquidH);
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.fillRect(cavity.x + cavity.w * 0.08, surfaceY + liquidH * 0.08, Math.max(1, cavity.w * 0.045), liquidH * 0.72);
      ctx.restore();
      ctx.strokeStyle = liquidLine(temp);
      ctx.lineWidth = Math.max(0.9, outer.w * 0.012);
      ctx.beginPath();
      ctx.moveTo(cavity.x, surfaceY);
      ctx.bezierCurveTo(cavity.x + cavity.w * 0.32, surfaceY - h * 0.006, cavity.x + cavity.w * 0.68, surfaceY + h * 0.006, cavity.x + cavity.w, surfaceY);
      ctx.stroke();
      drawIce(ctx, cavity, surfaceY, frozen);
      drawSolid(ctx, cavity, solid, dissolved, number(s.seed, 137));
    }

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(outer.x + wall * 1.05, outer.y + lidH + wall, Math.max(1, wall * 0.75), outer.h - lidH - wall * 2.6);
    ctx.fillStyle = 'rgba(139,169,184,0.15)';
    ctx.fillRect(outer.x + outer.w - wall * 1.25, outer.y + lidH, Math.max(1, wall * 0.55), outer.h - lidH - wall);

    ctx.strokeStyle = '#3f5060';
    ctx.lineWidth = wall;
    ctx.lineJoin = 'round';
    ctx.strokeRect(outer.x, outer.y, outer.w, outer.h);

    ctx.fillStyle = '#dce6eb';
    rounded(ctx, outer.x - 1, outer.y, outer.w + 2, lidH, Math.min(3, lidH * 0.24));
    ctx.fill();
    ctx.strokeStyle = '#3f5060';
    ctx.lineWidth = Math.max(1.2, wall * 0.82);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = Math.max(0.7, wall * 0.4);
    ctx.beginPath();
    ctx.moveTo(outer.x + outer.w * 0.12, outer.y + lidH * 0.32);
    ctx.lineTo(outer.x + outer.w * 0.88, outer.y + lidH * 0.32);
    ctx.stroke();
    ctx.restore();

    return {outer: outer, cavity: cavity, surfaceY: surfaceY};
  }

  function shiftedGeometry(g, dx, dy) {
    return {
      outer: {x: g.outer.x + dx, y: g.outer.y + dy, w: g.outer.w, h: g.outer.h},
      cavity: {x: g.cavity.x + dx, y: g.cavity.y + dy, w: g.cavity.w, h: g.cavity.h},
      surfaceY: g.surfaceY + dy
    };
  }

  function beaker(ctx, box, s) {
    var scale;
    var key;
    var entry;
    var canvas;
    var off;
    var localBox;
    var pad = 5;
    s = s || {};
    box = sanitizeBox(box, 150, 180);
    scale = scaleOf(ctx);
    key = [box.w, box.h, number(s.temp, 0), s.content || 'solution', s.solid || 'none', number(s.dissolved, 0), number(s.frozen, 0), number(s.level, 0.62), number(s.seed, 137), scale].join('|');
    entry = beakerCache[key];
    if (!entry) {
      canvas = root.document.createElement('canvas');
      canvas.width = Math.ceil((box.w + pad * 2) * scale);
      canvas.height = Math.ceil((box.h + pad * 2) * scale);
      off = canvas.getContext('2d');
      off.scale(scale, scale);
      localBox = {x: pad, y: pad, w: box.w, h: box.h};
      entry = {canvas: canvas, geometry: drawBeakerDirect(off, localBox, s)};
      beakerCache[key] = entry;
      beakerKeys.push(key);
      if (beakerKeys.length > beakerLimit) {
        delete beakerCache[beakerKeys.shift()];
      }
    }
    ctx.drawImage(entry.canvas, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
    return shiftedGeometry(entry.geometry, box.x - pad, box.y - pad);
  }

  function makeAirSprite(r, tone, scale, color) {
    var pad = 1.8;
    var logical = (r + pad) * 2;
    var canvas = root.document.createElement('canvas');
    var ctx;
    var center = r + pad;
    var gradient;
    canvas.width = Math.ceil(logical * scale);
    canvas.height = Math.ceil(logical * scale);
    ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    gradient = ctx.createRadialGradient(center - r * 0.28, center - r * 0.34, Math.max(0.2, r * 0.08), center, center, r);
    if (color) {
      gradient.addColorStop(0, mixedColor(color, 255, 0.54));
      gradient.addColorStop(0.54, color.hex);
      gradient.addColorStop(1, mixedColor(color, 0, 0.28));
      ctx.strokeStyle = mixedColor(color, 0, 0.42);
    } else if (tone === 'muted') {
      gradient.addColorStop(0, '#b7c0ca');
      gradient.addColorStop(0.55, '#8793a0');
      gradient.addColorStop(1, '#64707d');
      ctx.strokeStyle = '#52606d';
    } else {
      gradient.addColorStop(0, '#a9bdd4');
      gradient.addColorStop(0.54, '#6f89aa');
      gradient.addColorStop(1, '#465f82');
      ctx.strokeStyle = '#3f536e';
    }
    ctx.fillStyle = gradient;
    ctx.lineWidth = Math.max(0.65, r * 0.13);
    circle(ctx, center, center, r);
    ctx.fill();
    ctx.stroke();
    return {canvas: canvas, logical: logical};
  }

  function air(ctx, x, y, s) {
    var r;
    var alpha;
    var tone;
    var oldAlpha;
    var color;
    var scale;
    var bucket;
    var key;
    var entry;
    s = s || {};
    r = clamp(number(s.r, 4.5), 1, 20);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    tone = s.tone === 'muted' ? 'muted' : 'main';
    color = s.color ? colorValue(s.color) : null;
    oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = oldAlpha * alpha;
    if (color) {
      scale = scaleOf(ctx);
      bucket = Math.round(r * 2) / 2;
      key = color.hex + '|' + bucket + '|' + scale;
      entry = airCache[key];
      if (!entry) {
        entry = makeAirSprite(bucket, tone, scale, color);
        airCache[key] = entry;
        airKeys.push(key);
        if (airKeys.length > airLimit) {
          delete airCache[airKeys.shift()];
        }
      }
      ctx.drawImage(entry.canvas, x - r - 1.8, y - r - 1.8, (r + 1.8) * 2, (r + 1.8) * 2);
      ctx.globalAlpha = oldAlpha;
      return;
    }
    ctx.fillStyle = tone === 'muted' ? '#8793a0' : '#6f89aa';
    ctx.strokeStyle = tone === 'muted' ? '#52606d' : '#3f536e';
    ctx.lineWidth = Math.max(0.65, r * 0.13);
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = oldAlpha;
  }

  function makeTrailSprite(width, alpha, tone, dx, dy, scale) {
    var pad = width + 2;
    var minX = Math.min(0, dx) - pad;
    var minY = Math.min(0, dy) - pad;
    var maxX = Math.max(0, dx) + pad;
    var maxY = Math.max(0, dy) + pad;
    var logicalW = Math.max(2, maxX - minX);
    var logicalH = Math.max(2, maxY - minY);
    var canvas = root.document.createElement('canvas');
    var ctx;
    var ox = -minX;
    var oy = -minY;
    var length = Math.sqrt(dx * dx + dy * dy);
    var px = -dy / length;
    var py = dx / length;
    var gradient;
    var color = tone === 'muted' ? [126, 137, 149] : [99, 125, 159];
    canvas.width = Math.ceil(logicalW * scale);
    canvas.height = Math.ceil(logicalH * scale);
    ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    gradient = ctx.createLinearGradient(ox, oy, ox + dx, oy + dy);
    gradient.addColorStop(0, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0)');
    gradient.addColorStop(0.36, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha * 0.2 + ')');
    gradient.addColorStop(1, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha * 0.68 + ')');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(ox + px * width * 0.05, oy + py * width * 0.05);
    ctx.lineTo(ox + dx + px * width * 0.5, oy + dy + py * width * 0.5);
    ctx.lineTo(ox + dx - px * width * 0.5, oy + dy - py * width * 0.5);
    ctx.lineTo(ox - px * width * 0.05, oy - py * width * 0.05);
    ctx.closePath();
    ctx.fill();
    return {canvas: canvas, x: minX, y: minY, w: logicalW, h: logicalH};
  }

  function trail(ctx, pts, s) {
    var count = pts && pts.length ? Math.min(8, pts.length) : 0;
    var width;
    var alpha;
    var tone;
    var color;
    var first;
    var last;
    var dx;
    var dy;
    var length;
    var px;
    var py;
    var oldAlpha;
    var i;
    var amount;
    var half;
    if (count < 2) {
      return;
    }
    s = s || {};
    width = clamp(number(s.width, 2), 0.4, 16);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    tone = s.tone === 'muted' ? 'muted' : 'main';
    color = s.color ? colorValue(s.color) : null;
    first = pts[0];
    last = pts[count - 1];
    dx = Math.round((number(last[0], 0) - number(first[0], 0)) * 10) / 10;
    dy = Math.round((number(last[1], 0) - number(first[1], 0)) * 10) / 10;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) {
      return;
    }
    length = Math.sqrt(dx * dx + dy * dy);
    px = -dy / length;
    py = dx / length;
    oldAlpha = ctx.globalAlpha;
    ctx.globalAlpha = oldAlpha * alpha * 0.64;
    ctx.fillStyle = color ? color.hex : (tone === 'muted' ? '#7e8995' : '#637d9f');
    ctx.beginPath();
    for (i = 0; i < count; i += 1) {
      amount = i / (count - 1);
      half = width * 0.5 * amount;
      if (i === 0) {
        ctx.moveTo(number(pts[i][0], 0) + px * half, number(pts[i][1], 0) + py * half);
      } else {
        ctx.lineTo(number(pts[i][0], 0) + px * half, number(pts[i][1], 0) + py * half);
      }
    }
    for (i = count - 1; i >= 0; i -= 1) {
      amount = i / (count - 1);
      half = width * 0.5 * amount;
      ctx.lineTo(number(pts[i][0], 0) - px * half, number(pts[i][1], 0) - py * half);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = oldAlpha;
  }

  function water(ctx, x, y, s) {
    var r;
    var angle;
    var alpha;
    var spread = 52.25 * DEG;
    var bond;
    var hx1;
    var hy1;
    var hx2;
    var hy2;
    s = s || {};
    r = clamp(number(s.r, 6), 1.5, 30);
    angle = number(s.angle, 0);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    bond = r * 1.62;
    hx1 = Math.cos(-spread) * bond;
    hy1 = Math.sin(-spread) * bond;
    hx2 = Math.cos(spread) * bond;
    hy2 = Math.sin(spread) * bond;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(1, r * 0.24);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(hx1, hy1);
    ctx.moveTo(0, 0);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#687685';
    ctx.lineWidth = Math.max(0.8, r * 0.15);
    circle(ctx, hx1, hy1, r * 0.56);
    ctx.fill();
    ctx.stroke();
    circle(ctx, hx2, hy2, r * 0.56);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dc3f45';
    ctx.strokeStyle = '#8f2930';
    ctx.lineWidth = Math.max(0.8, r * 0.13);
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function sceneCupBody(ctx, cup, inset) {
    var top = cup.y + cup.h * (0.055 + inset * 0.25);
    var bottom = cup.y + cup.h * (0.965 - inset * 0.2);
    var leftTop = cup.x + cup.w * (0.105 + inset);
    var rightTop = cup.x + cup.w * (0.895 - inset);
    var leftBottom = cup.x + cup.w * (0.185 + inset * 0.7);
    var rightBottom = cup.x + cup.w * (0.815 - inset * 0.7);
    ctx.beginPath();
    ctx.moveTo(leftTop, top);
    ctx.lineTo(leftBottom, bottom - cup.h * 0.045);
    ctx.quadraticCurveTo(leftBottom + cup.w * 0.01, bottom, leftBottom + cup.w * 0.085, bottom);
    ctx.lineTo(rightBottom - cup.w * 0.085, bottom);
    ctx.quadraticCurveTo(rightBottom - cup.w * 0.01, bottom, rightBottom, bottom - cup.h * 0.045);
    ctx.lineTo(rightTop, top);
    ctx.closePath();
  }

  function drawSceneCup(ctx, cup, frozen, seed) {
    var top = cup.y + cup.h * 0.055;
    var bottom = cup.y + cup.h * 0.965;
    var leftTop = cup.x + cup.w * 0.105;
    var rightTop = cup.x + cup.w * 0.895;
    var leftBottom = cup.x + cup.w * 0.185;
    var rightBottom = cup.x + cup.w * 0.815;
    var surface = cup.y + cup.h * 0.335;
    var innerLeft = cup.x + cup.w * 0.145;
    var innerRight = cup.x + cup.w * 0.855;
    var innerBottom = cup.y + cup.h * 0.91;
    var dome;
    var center = cup.x + cup.w * 0.5;
    var ice;
    var random;
    var bubbleCount;
    var i;
    var bx;
    var by;
    var br;
    frozen = clamp(frozen, 0, 1);
    dome = cup.h * 0.052 * frozen;
    ctx.save();
    sceneCupBody(ctx, cup, 0.025);
    ctx.clip();
    ctx.fillStyle = 'rgba(116,190,220,' + (0.2 - frozen * 0.1) + ')';
    ctx.fillRect(innerLeft, surface, innerRight - innerLeft, innerBottom - surface);
    ctx.fillStyle = 'rgba(226,244,250,' + (0.09 * (1 - frozen)) + ')';
    ctx.fillRect(innerLeft, surface + cup.h * 0.035, (innerRight - innerLeft) * 0.42, innerBottom - surface);
    if (frozen > 0.001) {
      ice = ctx.createRadialGradient(center, surface + cup.h * 0.29, cup.w * 0.04, center, surface + cup.h * 0.29, cup.w * 0.46);
      ice.addColorStop(0, 'rgba(250,253,254,' + (0.12 * frozen + 0.86 * frozen * frozen) + ')');
      ice.addColorStop(0.54, 'rgba(235,247,251,' + (0.26 * frozen + 0.66 * frozen * frozen) + ')');
      ice.addColorStop(1, 'rgba(205,233,245,' + (0.88 * frozen) + ')');
      ctx.fillStyle = ice;
      ctx.beginPath();
      ctx.moveTo(innerLeft, surface + dome * 0.35);
      ctx.quadraticCurveTo(center, surface - dome, innerRight, surface + dome * 0.35);
      ctx.lineTo(innerRight - cup.w * 0.055, innerBottom);
      ctx.lineTo(innerLeft + cup.w * 0.055, innerBottom);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(128,178,201,' + (0.42 * frozen) + ')';
      ctx.lineWidth = Math.max(0.7, cup.w * 0.012);
      ctx.beginPath();
      ctx.moveTo(innerLeft, surface + dome * 0.35);
      ctx.quadraticCurveTo(center, surface - dome, innerRight, surface + dome * 0.35);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(247,252,254,' + (0.58 * frozen) + ')';
      ctx.lineWidth = Math.max(1, cup.w * 0.024);
      ctx.beginPath();
      ctx.moveTo(innerLeft + cup.w * 0.018, surface + cup.h * 0.055);
      ctx.lineTo(innerLeft + cup.w * 0.055, innerBottom - cup.h * 0.035);
      ctx.moveTo(innerRight - cup.w * 0.018, surface + cup.h * 0.055);
      ctx.lineTo(innerRight - cup.w * 0.055, innerBottom - cup.h * 0.035);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    if (frozen < 0.999) {
      ctx.globalAlpha *= 1 - frozen * 0.78;
      ctx.strokeStyle = '#699caf';
      ctx.lineWidth = Math.max(0.8, cup.w * 0.014);
      ctx.beginPath();
      ctx.moveTo(innerLeft, surface);
      ctx.lineTo(innerRight, surface);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = Math.max(0.6, cup.w * 0.009);
      ctx.beginPath();
      ctx.moveTo(innerLeft + cup.w * 0.04, surface - cup.h * 0.008);
      ctx.lineTo(center + cup.w * 0.09, surface - cup.h * 0.008);
      ctx.stroke();
    }
    if (frozen > 0.08) {
      ctx.globalAlpha *= frozen * frozen;
      ctx.strokeStyle = '#7aa8bc';
      ctx.lineWidth = Math.max(0.65, cup.w * 0.011);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cup.x + cup.w * 0.31, surface + cup.h * 0.055);
      ctx.lineTo(cup.x + cup.w * 0.39, surface + cup.h * 0.15);
      ctx.lineTo(cup.x + cup.w * 0.35, surface + cup.h * 0.235);
      ctx.lineTo(cup.x + cup.w * 0.46, surface + cup.h * 0.33);
      ctx.lineTo(cup.x + cup.w * 0.43, surface + cup.h * 0.45);
      ctx.moveTo(cup.x + cup.w * 0.39, surface + cup.h * 0.15);
      ctx.lineTo(cup.x + cup.w * 0.49, surface + cup.h * 0.2);
      ctx.moveTo(cup.x + cup.w * 0.69, surface + cup.h * 0.09);
      ctx.lineTo(cup.x + cup.w * 0.61, surface + cup.h * 0.2);
      ctx.lineTo(cup.x + cup.w * 0.66, surface + cup.h * 0.3);
      ctx.lineTo(cup.x + cup.w * 0.56, surface + cup.h * 0.4);
      ctx.moveTo(cup.x + cup.w * 0.61, surface + cup.h * 0.2);
      ctx.lineTo(cup.x + cup.w * 0.52, surface + cup.h * 0.24);
      ctx.stroke();
      random = prng(number(seed, 137) + 701);
      bubbleCount = 7;
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.strokeStyle = 'rgba(116,164,184,0.52)';
      ctx.lineWidth = Math.max(0.45, cup.w * 0.006);
      for (i = 0; i < bubbleCount; i += 1) {
        bx = cup.x + cup.w * (0.29 + random() * 0.42);
        by = surface + cup.h * (0.14 + random() * 0.38);
        br = cup.w * (0.011 + random() * 0.015);
        circle(ctx, bx, by, br);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(238,248,252,0.105)';
    sceneCupBody(ctx, cup, 0);
    ctx.fill();
    ctx.strokeStyle = '#4f6574';
    ctx.lineWidth = Math.max(1.25, cup.w * 0.024);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(leftTop, top);
    ctx.lineTo(leftBottom, bottom - cup.h * 0.045);
    ctx.quadraticCurveTo(leftBottom + cup.w * 0.01, bottom, leftBottom + cup.w * 0.085, bottom);
    ctx.lineTo(rightBottom - cup.w * 0.085, bottom);
    ctx.quadraticCurveTo(rightBottom - cup.w * 0.01, bottom, rightBottom, bottom - cup.h * 0.045);
    ctx.lineTo(rightTop, top);
    ctx.stroke();
    ctx.strokeStyle = '#738b99';
    ctx.lineWidth = Math.max(0.95, cup.w * 0.017);
    ellipse(ctx, center, top, (rightTop - leftTop) * 0.5, cup.h * 0.026);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = Math.max(1, cup.w * 0.018);
    ctx.beginPath();
    ctx.moveTo(leftTop + cup.w * 0.055, top + cup.h * 0.065);
    ctx.lineTo(leftBottom + cup.w * 0.052, bottom - cup.h * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  function drawFreezerFrost(ctx, x, y, w, h, seed) {
    var random = prng(number(seed, 137) + 311);
    var i;
    var side;
    var px;
    var py;
    var rx;
    var ry;
    var len;
    ctx.save();
    ctx.fillStyle = 'rgba(248,253,255,0.7)';
    for (i = 0; i < 46; i += 1) {
      side = i % 4;
      if (side === 0) {
        px = x + w * (0.03 + random() * 0.94);
        py = y + h * (0.005 + random() * 0.035);
        rx = w * (0.017 + random() * 0.026);
        ry = h * (0.018 + random() * 0.027);
      } else if (side === 1) {
        px = x + w * (0.03 + random() * 0.94);
        py = y + h * (0.965 + random() * 0.028);
        rx = w * (0.018 + random() * 0.03);
        ry = h * (0.014 + random() * 0.025);
      } else if (side === 2) {
        px = x + w * (0.006 + random() * 0.035);
        py = y + h * (0.04 + random() * 0.9);
        rx = w * (0.016 + random() * 0.024);
        ry = h * (0.019 + random() * 0.034);
      } else {
        px = x + w * (0.96 + random() * 0.034);
        py = y + h * (0.04 + random() * 0.9);
        rx = w * (0.016 + random() * 0.024);
        ry = h * (0.019 + random() * 0.034);
      }
      ellipse(ctx, px, py, rx, ry);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(148,190,210,0.52)';
    ctx.lineWidth = Math.max(0.55, w * 0.0014);
    ctx.lineCap = 'round';
    for (i = 0; i < 34; i += 1) {
      side = i % 4;
      if (side < 2) {
        px = x + w * (0.055 + random() * 0.89);
        py = side === 0 ? y + h * 0.028 : y + h * 0.972;
        len = h * (0.012 + random() * 0.018) * (side === 0 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + w * (random() - 0.5) * 0.012, py + len);
        ctx.lineTo(px + w * (random() - 0.5) * 0.018, py + len * 1.55);
        ctx.stroke();
      } else {
        px = side === 2 ? x + w * 0.025 : x + w * 0.975;
        py = y + h * (0.06 + random() * 0.88);
        len = w * (0.008 + random() * 0.014) * (side === 2 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + len, py + h * (random() - 0.5) * 0.018);
        ctx.lineTo(px + len * 1.55, py + h * (random() - 0.5) * 0.025);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function scene(ctx, kind, box, s) {
    var x;
    var y;
    var w;
    var h;
    var frozen;
    var cupW;
    var cupH;
    var cup;
    var shelfY;
    var deskY;
    var gradient;
    var random;
    var i;
    var backX;
    var backY;
    var backW;
    var backH;
    var shelfBackY;
    var shelfFrontY;
    s = s || {};
    box = sanitizeBox(box, 560, 360);
    x = box.x;
    y = box.y;
    w = box.w;
    h = box.h;
    frozen = clamp(number(s.frozen, 0), 0, 1);
    cupW = w * 0.168;
    cupH = h * 0.392;
    ctx.save();
    rounded(ctx, x, y, w, h, Math.min(14, w * 0.03));
    ctx.clip();
    if (kind === 'freezer') {
      ctx.fillStyle = '#adc3d1';
      ctx.fillRect(x, y, w, h);
      gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, '#f6fbfd');
      gradient.addColorStop(0.48, '#e0eef5');
      gradient.addColorStop(1, '#bed4e0');
      ctx.fillStyle = gradient;
      rounded(ctx, x + w * 0.04, y + h * 0.045, w * 0.92, h * 0.875, Math.min(11, w * 0.022));
      ctx.fill();
      ctx.strokeStyle = '#6f8999';
      ctx.lineWidth = Math.max(2.2, w * 0.007);
      ctx.stroke();
      backX = x + w * 0.145;
      backY = y + h * 0.145;
      backW = w * 0.71;
      backH = h * 0.635;
      ctx.fillStyle = 'rgba(111,142,158,0.16)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.045, y + h * 0.05);
      ctx.lineTo(backX, backY);
      ctx.lineTo(backX, backY + backH);
      ctx.lineTo(x + w * 0.045, y + h * 0.915);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.955, y + h * 0.05);
      ctx.lineTo(backX + backW, backY);
      ctx.lineTo(backX + backW, backY + backH);
      ctx.lineTo(x + w * 0.955, y + h * 0.915);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.56)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.045, y + h * 0.05);
      ctx.lineTo(x + w * 0.955, y + h * 0.05);
      ctx.lineTo(backX + backW, backY);
      ctx.lineTo(backX, backY);
      ctx.closePath();
      ctx.fill();
      gradient = ctx.createLinearGradient(backX, backY, backX, backY + backH);
      gradient.addColorStop(0, '#eef8fc');
      gradient.addColorStop(0.58, '#deedf5');
      gradient.addColorStop(1, '#d0e3ed');
      ctx.fillStyle = gradient;
      rounded(ctx, backX, backY, backW, backH, Math.min(7, w * 0.012));
      ctx.fill();
      ctx.strokeStyle = '#91aebb';
      ctx.lineWidth = Math.max(1.2, w * 0.003);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rounded(ctx, backX + w * 0.025, backY + h * 0.025, backW - w * 0.05, h * 0.045, Math.min(6, h * 0.018));
      ctx.fill();
      drawFreezerFrost(ctx, backX, backY, backW, backH, number(s.seed, 137));
      shelfBackY = y + h * 0.665;
      shelfFrontY = y + h * 0.755;
      ctx.strokeStyle = 'rgba(66,87,101,0.18)';
      ctx.lineWidth = Math.max(2.4, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.155, shelfBackY + h * 0.012);
      ctx.lineTo(x + w * 0.845, shelfBackY + h * 0.012);
      ctx.moveTo(x + w * 0.075, shelfFrontY + h * 0.012);
      ctx.lineTo(x + w * 0.925, shelfFrontY + h * 0.012);
      ctx.stroke();
      ctx.strokeStyle = '#617c8c';
      ctx.lineWidth = Math.max(1.1, w * 0.0032);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, shelfBackY);
      ctx.lineTo(x + w * 0.85, shelfBackY);
      ctx.moveTo(x + w * 0.07, shelfFrontY);
      ctx.lineTo(x + w * 0.93, shelfFrontY);
      for (i = 0; i < 11; i += 1) {
        ctx.moveTo(x + w * (0.16 + i * 0.068), shelfBackY);
        ctx.lineTo(x + w * (0.085 + i * 0.083), shelfFrontY);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,251,254,0.72)';
      ctx.lineWidth = Math.max(0.65, w * 0.0015);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, shelfBackY - h * 0.006);
      ctx.lineTo(x + w * 0.85, shelfBackY - h * 0.006);
      ctx.moveTo(x + w * 0.07, shelfFrontY - h * 0.006);
      ctx.lineTo(x + w * 0.93, shelfFrontY - h * 0.006);
      ctx.stroke();
      shelfY = shelfBackY;
      ctx.fillStyle = 'rgba(57,79,92,0.18)';
      ellipse(ctx, x + w * 0.62, shelfY + h * 0.017, cupW * 0.47, h * 0.022);
      ctx.fill();
      cup = {x: x + w * 0.62 - cupW * 0.5, y: shelfY - cupH + h * 0.012, w: cupW, h: cupH};
    } else {
      ctx.fillStyle = '#eee9e2';
      ctx.fillRect(x, y, w, h);
      gradient = ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, '#f6f0e8');
      gradient.addColorStop(1, '#e8ded2');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h * 0.82);
      ctx.fillStyle = '#b9cbd3';
      ctx.fillRect(x + w * 0.055, y + h * 0.085, w * 0.32, h * 0.44);
      gradient = ctx.createLinearGradient(x + w * 0.07, y + h * 0.1, x + w * 0.34, y + h * 0.51);
      gradient.addColorStop(0, '#d8edf5');
      gradient.addColorStop(1, '#f4eadb');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + w * 0.07, y + h * 0.1, w * 0.29, h * 0.41);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.07, y + h * 0.1);
      ctx.lineTo(x + w * 0.2, y + h * 0.1);
      ctx.lineTo(x + w * 0.34, y + h * 0.51);
      ctx.lineTo(x + w * 0.21, y + h * 0.51);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7f929d';
      ctx.lineWidth = Math.max(2, w * 0.006);
      ctx.strokeRect(x + w * 0.055, y + h * 0.085, w * 0.32, h * 0.44);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.215, y + h * 0.085);
      ctx.lineTo(x + w * 0.215, y + h * 0.525);
      ctx.moveTo(x + w * 0.055, y + h * 0.305);
      ctx.lineTo(x + w * 0.375, y + h * 0.305);
      ctx.stroke();
      ctx.fillStyle = '#435b55';
      rounded(ctx, x + w * 0.49, y + h * 0.105, w * 0.42, h * 0.285, Math.min(5, w * 0.01));
      ctx.fill();
      ctx.strokeStyle = '#65736d';
      ctx.lineWidth = Math.max(4, w * 0.012);
      ctx.stroke();
      ctx.fillStyle = '#a28b78';
      ctx.fillRect(x + w * 0.47, y + h * 0.405, w * 0.46, h * 0.025);
      ctx.fillStyle = '#d8c8b8';
      ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
      gradient = ctx.createLinearGradient(x + w * 0.12, y + h * 0.32, x + w * 0.7, y + h * 0.83);
      gradient.addColorStop(0, 'rgba(255,244,213,0.36)');
      gradient.addColorStop(1, 'rgba(255,235,196,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.075, y + h * 0.31);
      ctx.lineTo(x + w * 0.36, y + h * 0.31);
      ctx.lineTo(x + w * 0.77, y + h * 0.82);
      ctx.lineTo(x + w * 0.26, y + h * 0.82);
      ctx.closePath();
      ctx.fill();
      deskY = y + h * 0.79;
      ctx.fillStyle = '#8a6651';
      rounded(ctx, x + w * 0.27, deskY, w * 0.61, h * 0.085, Math.min(7, h * 0.018));
      ctx.fill();
      ctx.strokeStyle = '#5c4a40';
      ctx.lineWidth = Math.max(1.5, w * 0.004);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,224,181,0.62)';
      ctx.lineWidth = Math.max(1, h * 0.006);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.31, deskY + h * 0.012);
      ctx.lineTo(x + w * 0.72, deskY + h * 0.012);
      ctx.stroke();
      ctx.fillStyle = '#6e5849';
      ctx.fillRect(x + w * 0.32, deskY + h * 0.075, w * 0.035, h * 0.18);
      ctx.fillRect(x + w * 0.79, deskY + h * 0.075, w * 0.035, h * 0.18);
      ctx.fillStyle = 'rgba(58,48,43,0.14)';
      ellipse(ctx, x + w * 0.58, deskY + h * 0.028, cupW * 0.5, h * 0.022);
      ctx.fill();
      cup = {x: x + w * 0.58 - cupW * 0.5, y: deskY - cupH + h * 0.012, w: cupW, h: cupH};
    }
    drawSceneCup(ctx, cup, frozen, number(s.seed, 137));
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#435465';
    ctx.lineWidth = Math.max(1.2, w * 0.004);
    rounded(ctx, x, y, w, h, Math.min(14, w * 0.03));
    ctx.stroke();
    ctx.restore();
    return {cup: cup};
  }

  function balance(ctx, box, s) {
    var x;
    var y;
    var w;
    var h;
    var tilt;
    var alpha;
    var cx;
    var pivotY;
    var half;
    var angle;
    var dx;
    var dy;
    var leftHook;
    var rightHook;
    var chain;
    var panW;
    var panH;
    var left;
    var right;
    s = s || {};
    box = sanitizeBox(box, 360, 230);
    x = box.x;
    y = box.y;
    w = box.w;
    h = box.h;
    tilt = clamp(number(s.tilt, 0), -1, 1);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    cx = x + w * 0.5;
    pivotY = y + h * 0.34;
    half = w * 0.34;
    angle = tilt * 0.17;
    dx = Math.cos(angle) * half;
    dy = Math.sin(angle) * half;
    leftHook = {x: cx - dx, y: pivotY - dy};
    rightHook = {x: cx + dx, y: pivotY + dy};
    chain = h * 0.18;
    panW = w * 0.22;
    panH = h * 0.07;
    left = {x: leftHook.x, y: leftHook.y + chain + panH * 0.4};
    right = {x: rightHook.x, y: rightHook.y + chain + panH * 0.4};
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(51,65,85,0.12)';
    ellipse(ctx, cx, y + h * 0.91, w * 0.2, h * 0.025);
    ctx.fill();
    ctx.fillStyle = '#66788a';
    ctx.strokeStyle = '#344454';
    ctx.lineWidth = Math.max(1.3, w * 0.006);
    rounded(ctx, cx - w * 0.15, y + h * 0.84, w * 0.3, h * 0.065, h * 0.025);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.055, y + h * 0.84);
    ctx.lineTo(cx - w * 0.018, pivotY + h * 0.02);
    ctx.lineTo(cx + w * 0.018, pivotY + h * 0.02);
    ctx.lineTo(cx + w * 0.055, y + h * 0.84);
    ctx.closePath();
    ctx.fillStyle = '#8292a2';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#344454';
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftHook.x, leftHook.y);
    ctx.lineTo(rightHook.x, rightHook.y);
    ctx.stroke();
    ctx.fillStyle = '#dfe6eb';
    circle(ctx, cx, pivotY, Math.max(4, w * 0.019));
    ctx.fill();
    ctx.strokeStyle = '#344454';
    ctx.lineWidth = Math.max(1.1, w * 0.005);
    ctx.stroke();
    function pan(hook, center) {
      ctx.strokeStyle = '#536575';
      ctx.lineWidth = Math.max(1, w * 0.004);
      ctx.beginPath();
      ctx.moveTo(hook.x, hook.y + 2);
      ctx.lineTo(center.x - panW * 0.38, center.y - panH * 0.36);
      ctx.moveTo(hook.x, hook.y + 2);
      ctx.lineTo(center.x + panW * 0.38, center.y - panH * 0.36);
      ctx.stroke();
      ctx.fillStyle = '#eef2f5';
      ctx.strokeStyle = '#435566';
      ctx.lineWidth = Math.max(1.1, w * 0.005);
      ctx.beginPath();
      ctx.moveTo(center.x - panW * 0.5, center.y - panH * 0.32);
      ctx.quadraticCurveTo(center.x, center.y + panH, center.x + panW * 0.5, center.y - panH * 0.32);
      ctx.quadraticCurveTo(center.x, center.y + panH * 0.05, center.x - panW * 0.5, center.y - panH * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    pan(leftHook, left);
    pan(rightHook, right);
    ctx.restore();
    return {left: left, right: right};
  }

  function icon(size) {
    var n = Math.max(16, Math.round(number(size, 64)));
    return '<svg width="' + n + '" height="' + n + '" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<rect x="8" y="8" width="48" height="48" rx="5" stroke="currentColor" stroke-width="2.4" stroke-dasharray="4 4" opacity=".55"/>' +
      '<rect x="22" y="19" width="20" height="27" rx="2" stroke="currentColor" stroke-width="2.6"/>' +
      '<rect x="21" y="17" width="22" height="5" rx="1.5" fill="currentColor"/>' +
      '<path d="M24 36h16v8H24z" fill="currentColor" opacity=".28"/>' +
      '<path d="M5 22h6M3 25h7M53 38h6M55 41h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>' +
      '<circle cx="14" cy="19" r="2.5" fill="currentColor"/>' +
      '<circle cx="50" cy="35" r="2.5" fill="currentColor"/>' +
      '</svg>';
  }

  function info() {
    return {cacheEntries: beakerKeys.length + airKeys.length + trailKeys.length};
  }

  root.SPONT_ART = {
    contract: 1,
    version: '1.2.0',
    beaker: beaker,
    air: air,
    trail: trail,
    water: water,
    scene: scene,
    balance: balance,
    svg: {icon: icon},
    info: info
  };
}(window));
/* ==== ART END ==== */

/* ==== UI BEGIN ==== */
/* 반응의 자발성 — 화면. 계산은 SPONT(CORE), 그림은 SPONT_ART(Astra)만 부른다. 근거: 설계지시안_반응의자발성_v1.3.md(v1.3 절 U-1~U-5) · §3-A
   ES5 전용. rAF 루프 하나 · 보이는 탭의 모형만 돈다 · 표시 여부는 SHOW 표 하나(apply)가 정한다(매뉴얼 §13 ①). */
(function () {
  "use strict";
  var ART = window.SPONT_ART, C = SPONT.C, DT = 1 / C.FPS;
  var $ = function (id) { return document.getElementById(id); };
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var SHOWFPS = /[?&]fps=1/.test(location.search);
  /* 화면 상수(지시안 E-4·E-6·§3-A) — 모형 값은 CORE의 C에만 있다 */
  var NEAR_COLOR = "#059669",   /* 사용자 결정 #1 · 시안 C1 A */
    ADD_WAIT = 6,                /* 탭 ②: 넣음 → 빼기 열림 */
    VBOX_MIN = 600,              /* 탭 ③: 무대 css 폭이 이보다 좁으면 값 상자를 무대 아래로(U-2 배치) */
    HOLD_MIN = 0.5,             /* 처음 모습: 변화 시작 뒤 이만큼 지나야 누를 수 있다 */
    W_SAMPLE = 0.28, W_TRAIL = 8, /* 물 분자 잔상: 0.28초 간격 8점 */
    WATER_SEED = 31;

  var cur = 1, curveOn = false, hold = null, needDraw = true;
  function dprNow() { return Math.min(window.devicePixelRatio || 1, 2); }
  function dirty() { needDraw = true; }

  /* 사용자 결정 #1 — 계에 가까운 입자의 색. 자리로만 정한다(속력·온도를 읽지 않는다) */
  function nearColor(px, py, q) {
    return SPONT.isNear(px, py, q) ? NEAR_COLOR : undefined;
  }

  /* ── 캔버스: 논리 크기 W×H를 폭에 맞춘다. 배율은 setTransform 하나로만(v1.2 B-3) ── */
  function fit(cv, W, H) {
    var cw = cv.clientWidth; if (cw < 40) return null;
    var d = dprNow(), hh = Math.round(cw * H / W), pw = Math.round(cw * d), ph = Math.round(hh * d);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.height = hh + "px"; }
    var s = cw / W, g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pw, ph);
    g.setTransform(d * s, 0, 0, d * s, 0, 0);
    return { g: g, s: s, d: d };
  }
  function blank(cv) { var g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }

  /* ── 입자 자리·꼬리의 세 원천: 계속 도는 모형 / 처음 모습 기록 / 움직임 줄이기(정지 화면) ── */
  function liveSrc(m) {
    return {
      N: m.N,
      x: function (i) { return m.histX(i, 0); },
      y: function (i) { return m.histY(i, 0); },
      pts: function (i) { var a = [], k, n = Math.min(C.TRAIL, m.histLen() - 1); for (k = n; k >= 0; k--) a.push([m.histX(i, k), m.histY(i, k)]); return a; }
    };
  }
  function stillSrc(m) {
    var L = C.TRAIL * DT;
    return {
      N: m.N,
      x: function (i) { return m.x[i]; },
      y: function (i) { return m.y[i]; },
      pts: function (i) { return [[m.x[i] - m.vx[i] * L, m.y[i] - m.vy[i] * L], [m.x[i], m.y[i]]]; }
    };
  }
  /* 처음 모습: 누를 때마다 tick 0부터 · 꼬리는 재생 순서상의 과거(pingpong(tick − k)) */
  function ghostSrc(gh, tick) {
    var N = gh.N, P = gh.pos, f = SPONT.pingpong(tick, gh.frames), fr = [], k, n = Math.min(C.TRAIL, tick);
    for (k = n; k >= 0; k--) fr.push(SPONT.pingpong(tick - k, gh.frames));
    return {
      N: N,
      x: function (i) { return P[f * N * 2 + 2 * i]; },
      y: function (i) { return P[f * N * 2 + 2 * i + 1]; },
      pts: function (i) { var a = [], j; for (j = 0; j < fr.length; j++) a.push([P[fr[j] * N * 2 + 2 * i], P[fr[j] * N * 2 + 2 * i + 1]]); return a; }
    };
  }
  function srcOf(m, gh, k) { return isHeld(k) ? ghostSrc(gh, hold.tick) : (RM ? stillSrc(m) : liveSrc(m)); }

  /* 공기 입자 + 꼬리. 박스 안 = 같은 색 옅게(0.3). 색 입자는 나중에 그려 위로 올린다 */
  function drawGas(g, src, box, q, s) {
    var r = Math.max(5, 1.7 / s), pass, i;
    for (pass = 0; pass < 2; pass++) {
      for (i = 0; i < src.N; i++) {
        var px = src.x(i), py = src.y(i), col = nearColor(px, py, q);
        if ((col !== undefined) !== (pass === 1)) continue;
        var alpha = SPONT.isOutside(px, py, box) ? 1 : 0.3, pts = src.pts(i);
        if (pts.length > 1) ART.trail(g, pts, { width: r * 1.5, alpha: alpha * (col ? 0.9 : 0.75), tone: "main", color: col });
        ART.air(g, px, py, { r: r, alpha: alpha, tone: "main", color: col });
      }
    }
  }
  function nearCount(src, q) { var n = 0, i; for (i = 0; i < src.N; i++) if (nearColor(src.x(i), src.y(i), q) !== undefined) n++; return n; }
  /* 박스(점선 · 모서리 손잡이) — 데이터 표시 */
  function drawBox(g, b, s) {
    var k = 1 / Math.max(s, 0.5), hs = 9 * k, c = [[0, 0], [1, 0], [0, 1], [1, 1]], j;
    g.save(); g.setLineDash([9 * k, 6 * k]); g.strokeStyle = "#0f172a"; g.lineWidth = 2 * k;
    g.strokeRect(b.x, b.y, b.w, b.h); g.setLineDash([]); g.fillStyle = "#0f172a";
    for (j = 0; j < 4; j++) g.fillRect(b.x + c[j][0] * b.w - hs / 2, b.y + c[j][1] * b.h - hs / 2, hs, hs);
    g.restore();
  }
  function q2(v) { return Math.round(v * 50) / 50; }   /* 비커 그림 캐시가 매 프레임 바뀌지 않게 0.02 단위로 */

  /* ── 곡선(접어 둠 · 열었을 때만 센다) ── */
  function smooth(h) { var n = h.length, o = new Float64Array(n), i; for (i = 0; i < n; i++) o[i] = (h[Math.max(0, i - 1)] + 2 * h[i] + h[Math.min(n - 1, i + 1)]) / 4; return o; }
  function drawCurve(cv, curH, refH) {
    var cw = cv.clientWidth, ch = cv.clientHeight; if (cw < 40 || !ch) return;
    var d = dprNow(), pw = Math.round(cw * d), ph = Math.round(ch * d);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    var g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, cw, ch);
    var pad = 3, base = ch - 3;
    function path(h) { var n = h.length, i; g.beginPath(); g.moveTo(pad, base); for (i = 0; i < n; i++) g.lineTo(pad + (cw - 2 * pad) * (i + 0.5) / n, base - (base - 4) * Math.min(1, h[i] / C.YMAX)); g.lineTo(cw - pad, base); }
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, base); g.lineTo(cw - pad, base); g.stroke();
    if (curH) { path(curH); g.fillStyle = "rgba(37,99,235,.20)"; g.fill(); g.strokeStyle = "#2563eb"; g.lineWidth = 2.6; g.stroke(); }
    if (refH) { path(refH); g.setLineDash([6, 5]); g.strokeStyle = "#334155"; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }
  }
  function ghostRef(gh, box, vmax) {
    var key = JSON.stringify(box) + "|" + vmax;
    if (gh.refKey !== key) { gh.ref = SPONT.ghostHist(gh, box, C.BINS, vmax); gh.refKey = key; }
    return gh.ref;
  }
  function curveOf(cv, m, gh, box, vmax) { drawCurve(cv, smooth(m.hist(box, C.BINS, vmax, C.HIST).h), smooth(ghostRef(gh, box, vmax).h)); }

  /* ── 모형 만들기: 같은 옵션·씨앗의 사본으로 처음 모습을 기록하고, 모형은 같은 상태에서 출발한다 ── */
  function makeRun(o) { var gh = SPONT.recordGhost(SPONT.gas(o), C.GHOST); return { m: SPONT.gas(o), ghost: gh }; }
  function gasOpts(t, T0, seed) { return { W: t.W, H: t.H, beaker: t.BK, N: t.N, R: t.R, T0: T0, seed: seed }; }
  function copyBox(b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; }

  /* ── 박스 끌기: 비어 있는 곳에서 끌면 새로 · 모서리에서 끌면 크기 조절 · 항상 비커를 둘러쌈(SPONT.boxFrom) ── */
  function wireBox(cv, cfg) {
    var drag = null;
    function toL(e) { var r = cv.getBoundingClientRect(), s = r.width / cfg.W; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s, s: s }; }
    cv.addEventListener("pointerdown", function (e) {
      if (hold) return;
      var p = toL(e), b = cfg.get(), hit = 26 / p.s, j, c = [[0, 0], [1, 0], [0, 1], [1, 1]];
      drag = null;
      if (b) for (j = 0; j < 4; j++) { var cx = b.x + c[j][0] * b.w, cy = b.y + c[j][1] * b.h; if (Math.abs(p.x - cx) < hit && Math.abs(p.y - cy) < hit) drag = { anchor: { x: b.x + (1 - c[j][0]) * b.w, y: b.y + (1 - c[j][1]) * b.h }, moved: true }; }
      if (!drag) drag = { anchor: { x: p.x, y: p.y }, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      e.preventDefault();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var p = toL(e);
      if (!drag.moved && Math.abs(p.x - drag.anchor.x) + Math.abs(p.y - drag.anchor.y) < 8 / p.s) return;   /* 살짝 누른 것만으로 박스가 생기지 않게 */
      drag.moved = true;
      cfg.set(SPONT.boxFrom(drag.anchor, { x: p.x, y: p.y }, cfg.W, cfg.H, cfg.BK)); dirty();
      e.preventDefault();
    });
    function up() { drag = null; }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("lostpointercapture", up);
  }

  /* ━━ 탭 ① 열과 주위 ━━ */
  var T1 = C.T1, s1 = { box: null };
  function init1() { var r = makeRun(gasOpts(T1, T1.T0, T1.SEED)); s1.m = r.m; s1.ghost = r.ghost; s1.clock = 0; s1.mode = null; s1.sign = 0; s1.start = 0; }
  function start1(sign) {
    holdEnd(); init1();   /* 언제 눌러도 처음 상태에서 새로 시작(v1.2 B-5) */
    if (s1.m.heat(sign * T1.Q, T1.HEAT)) { s1.mode = sign > 0 ? "exo" : "endo"; s1.sign = sign; s1.start = s1.clock; }
    if (RM) runToEnd(1);
    dirty();
  }
  function tick1() { s1.m.frame(); s1.clock += DT; }
  function phase1() { return !s1.mode ? "idle" : s1.m.heating() ? "running" : "done"; }
  function sol1() {
    if (!s1.mode || isHeld(1)) return { temp: 0, dissolved: 0, solid: "none" };   /* heat()가 거부되면 용액 색도 시작하지 않는다(J-N5) */
    var S = SPONT.solution(s1.clock - s1.start, T1.HEAT, s1.sign);
    return { temp: S.temp, dissolved: S.dissolved, solid: s1.sign > 0 ? "pellet" : "granule" };
  }
  function render1() {
    var f = fit($("st1"), T1.W, T1.H); if (!f) return;
    var g = f.g, so = sol1();
    drawGas(g, srcOf(s1.m, s1.ghost, 1), s1.box, s1.box || T1.BK, f.s);
    ART.beaker(g, T1.REQ, { temp: q2(so.temp), content: "solution", solid: so.solid, dissolved: q2(so.dissolved), frozen: 0 });
    if (s1.box) drawBox(g, s1.box, f.s);
    if (curveOn && !hold) { if (s1.box) curveOf($("cv1"), s1.m, s1.ghost, s1.box, T1.VMAX); else drawCurve($("cv1"), null, null); }
  }

  /* ━━ 탭 ② 주위의 온도 ━━ 상태표: idle(대기) → adding(넣는 중) → added(넣음) → open(빼기 열림) → removing(빼는 중) → idle */
  var T2 = C.T2, s2 = { box: copyBox(T2.BOX) };
  function init2() {
    var a = makeRun(gasOpts(T2, T2.TC, T2.SEEDC)), b = makeRun(gasOpts(T2, T2.TH, T2.SEEDH));
    s2.c = a.m; s2.gc = a.ghost; s2.h = b.m; s2.gh = b.ghost;
    s2.phase = "idle"; s2.clock = 0; s2.chg = null; s2.sign = 0; s2.addedAt = 0;
  }
  /* 두 모형 모두 거부되지 않을 때만 둘 다 부른다(v1.2 B-4) */
  function both2(q) {
    var a = s2.c, b = s2.h;
    if (a.heating() || b.heating()) return false;
    if (a.T() + q < C.T_MIN || b.T() + q < C.T_MIN) return false;
    a.heat(q, T2.HEAT); b.heat(q, T2.HEAT); return true;
  }
  function in2() { holdEnd(); if (s2.phase !== "idle" || !both2(T2.Q)) return; s2.phase = "adding"; s2.chg = s2.clock; s2.sign = 1; if (RM) runToEnd(2); dirty(); }
  function out2() { holdEnd(); if (s2.phase !== "open" || !both2(-T2.Q)) return; s2.phase = "removing"; s2.chg = s2.clock; s2.sign = -1; if (RM) runToEnd(2); dirty(); }
  function tick2() {
    s2.c.frame(); s2.h.frame(); s2.clock += DT;
    /* 넣는 중·빼는 중은 두 모형이 모두 heating() === false 인 프레임에서만 끝난다 — 시계로 넘기지 않는다 */
    if ((s2.phase === "adding" || s2.phase === "removing") && !s2.c.heating() && !s2.h.heating()) {
      if (s2.phase === "adding") { s2.phase = "added"; s2.addedAt = s2.clock; } else s2.phase = "idle";
    }
    if (s2.phase === "added" && (RM || s2.clock - s2.addedAt >= ADD_WAIT)) s2.phase = "open";   /* 움직임 줄이기: 빼기 잠금 대기 없음(C-7) */
  }
  function sol2() {
    if (s2.chg === null || isHeld(2)) return { temp: 0, dissolved: 0, solid: "none" };
    var S = SPONT.solution(s2.clock - s2.chg, T2.HEAT, s2.sign);
    return { temp: S.temp, dissolved: S.dissolved, solid: s2.sign > 0 ? "pellet" : "granule" };
  }
  function render2() {
    var so = sol2(), st = [[$("st2a"), s2.c, s2.gc], [$("st2b"), s2.h, s2.gh]], j;
    for (j = 0; j < 2; j++) {
      var f = fit(st[j][0], T2.W, T2.H); if (!f) continue;
      drawGas(f.g, srcOf(st[j][1], st[j][2], 2), s2.box, s2.box, f.s);
      ART.beaker(f.g, T2.REQ, { temp: q2(so.temp), content: "solution", solid: so.solid, dissolved: q2(so.dissolved), frozen: 0 });
      drawBox(f.g, s2.box, f.s);
    }
    if (curveOn && !hold) { curveOf($("cv2a"), s2.c, s2.gc, s2.box, T2.VMAX); curveOf($("cv2b"), s2.h, s2.gh, s2.box, T2.VMAX); }
  }

  /* ━━ 탭 ③ 계와 주위 ━━ mode: freezer(냉동실 얼리기) · classV(교실 가상 얼리기) · classR(교실 실제 — 얼음이 녹음)
     무대는 캔버스 하나(U-1): 늘 장면을 바탕으로 그리고, 「입자로 보기」를 열면 같은 캔버스 위 장면 속 컵 자리(SC[kind].BK)에 입자를 덧그린다. 장면은 흐리게 하지 않는다 */
  var T3 = C.T3, s3 = { scene: "freezer", zoom: false }, LATS = {};
  function kindOf(mode) { return mode === "freezer" ? "freezer" : "classroom"; }
  function lat3(kind) { var wa = T3.SC[kind].WATER; if (!LATS[kind]) LATS[kind] = SPONT.honeycomb(wa.w, wa.h, T3.BOND); return LATS[kind]; }
  function airOf(mode) {
    if (mode === "freezer") return { T0: T3.TF, seed: T3.SEEDF, q: T3.Q };
    if (mode === "classV") return { T0: T3.TC, seed: T3.SEEDV, q: T3.Q };
    return { T0: T3.TC, seed: T3.SEEDR, q: -T3.Q };
  }
  function init3(mode) {
    var p = airOf(mode), kind = kindOf(mode), sc = T3.SC[kind], lat = lat3(kind);
    var a = makeRun({ W: T3.W, H: T3.H, beaker: sc.BK, N: T3.N, R: T3.R, T0: p.T0, seed: p.seed });
    var w = makeRun({ W: sc.WATER.w, H: sc.WATER.h, beaker: null, N: lat.sites.length, R: T3.WATER_R, vs: T3.WATER_VS, T0: T3.WATER_T, seed: WATER_SEED });
    s3.mode = mode; s3.kind = kind; s3.sc = sc; s3.lat = lat; s3.m = a.m; s3.gm = a.ghost; s3.w = w.m; s3.gw = w.ghost; s3.T0 = p.T0; s3.q = p.q;
    s3.phase = "ready"; s3.clock = 0; s3.start = 0; s3.endAt = null; s3.wh = []; s3.nextSample = 0;
    s3.map = SPONT.assign(s3.w.x, s3.w.y, lat.sites);
  }
  function sceneMode() { return s3.scene === "freezer" ? "freezer" : "classV"; }
  function start3(mode) {
    holdEnd(); init3(mode);
    if (s3.m.heat(s3.q, T3.HEAT)) { s3.phase = "running"; s3.start = s3.clock; }
    if (RM) runToEnd(3);
    dirty();
  }
  function frozen3(initial) {
    var melt = s3.mode === "classR";
    if (initial || s3.phase === "ready") return melt ? 1 : 0;
    var u = SPONT.ease((s3.clock - s3.start) / T3.HEAT);
    return melt ? 1 - u : u;
  }
  function waterAt(lx, ly, fz, sec) { var wa = s3.sc.WATER; return SPONT.waterPositions(lx, ly, s3.lat.sites, s3.map, fz, sec, wa.w, wa.h); }
  function tick3() {
    s3.m.frame(); s3.w.frame(); s3.clock += DT;
    /* 끝 = heating() false 그리고 HEAT 경과 — 「실제로 일어나는 변화 보기」는 바로 이 프레임에 나타난다(U-3) */
    if (s3.phase === "running" && !s3.m.heating() && s3.clock - s3.start >= T3.HEAT) { s3.phase = "done"; s3.endAt = s3.clock; }
    if (s3.clock >= s3.nextSample) {
      s3.wh.push(waterAt(s3.w.x, s3.w.y, frozen3(false), s3.clock));
      while (s3.wh.length > W_TRAIL - 1) s3.wh.shift();
      s3.nextSample += W_SAMPLE;
    }
  }
  function virtual3() { return s3.mode === "classV" && s3.phase !== "ready"; }
  /* VBOX BEGIN — 값 상자(U-2): 글은 SPONT.signed, 값은 SPONT.dsNow 만. 시작 전·처음 모습 = 처음 상태 값(T지금 = T처음 · 오간 열 0) */
  function ds3() {
    if (!s3.m) return SPONT.dsNow("freeze", 1, 1, 0);
    var mode = s3.mode === "classR" ? "melt" : "freeze";
    if (s3.phase === "ready" || isHeld(3)) return SPONT.dsNow(mode, s3.T0, s3.T0, 0);
    return SPONT.dsNow(mode, s3.T0, s3.m.T(), s3.m.addedPerN());
  }
  function vbox3() {
    var d = ds3(), cv = $("st3");
    put($("vsys"), "text", SPONT.signed(d.sys));
    put($("vsur"), "text", SPONT.signed(d.sur));
    if (cv.clientWidth > 0) $("vbox3").classList.toggle("below", cv.clientWidth < VBOX_MIN);
  }
  /* VBOX END */
  /* 장면 캐시: 종류 · frozen(0.02 단위) · 크기 · dpr 이 바뀔 때만 다시 그린다 */
  function sceneImg(kind, fz, pw, ph, d, s) {
    var key = kind + "|" + fz + "|" + pw + "x" + ph + "|" + d;
    if (key !== s3.sceneKey || !s3.off) {
      var off = s3.off || document.createElement("canvas"), g;
      off.width = pw; off.height = ph; g = off.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pw, ph); g.setTransform(d * s, 0, 0, d * s, 0, 0);
      ART.scene(g, kind, { x: 0, y: 0, w: T3.W, h: T3.H }, { frozen: fz });
      s3.off = off; s3.sceneKey = key;
    }
    return s3.off;
  }
  function drawWater(g) {
    var held = isHeld(3), wa0 = s3.sc.WATER, lat = s3.lat, i, j, k, wa, trails = [], fz, sec;
    if (held) {
      var gw = s3.gw, N = gw.N, frames = [], tk = hold.tick, n = Math.min(W_TRAIL - 1, Math.floor(tk / 8));
      fz = frozen3(true); sec = tk * DT;
      for (k = n; k >= 0; k--) frames.push(SPONT.pingpong(tk - 8 * k, gw.frames));
      for (j = 0; j < frames.length; j++) {
        var lx = new Float64Array(N), ly = new Float64Array(N);
        for (i = 0; i < N; i++) { lx[i] = gw.pos[frames[j] * N * 2 + 2 * i]; ly[i] = gw.pos[frames[j] * N * 2 + 2 * i + 1]; }
        trails.push(waterAt(lx, ly, fz, (tk - 8 * (frames.length - 1 - j)) * DT));
      }
      wa = trails[trails.length - 1];
    } else {
      fz = frozen3(false); sec = s3.clock;
      wa = waterAt(s3.w.x, s3.w.y, fz, sec);
      if (!RM) { for (j = 0; j < s3.wh.length; j++) trails.push(s3.wh[j]); }
      trails.push(wa);
    }
    g.save(); g.translate(wa0.x, wa0.y);
    if (fz > 0.02) {   /* 얼음 격자 결합선(옅게) — 데이터 표시 */
      g.globalAlpha = fz * 0.5; g.strokeStyle = "#64748b"; g.lineWidth = 1.2; g.beginPath();
      for (j = 0; j < lat.bonds.length; j++) { var b = lat.bonds[j]; g.moveTo(lat.sites[b[0]].x, lat.sites[b[0]].y); g.lineTo(lat.sites[b[1]].x, lat.sites[b[1]].y); }
      g.stroke(); g.globalAlpha = 1;
    }
    for (i = 0; i < wa.length; i++) {
      var pts = [];
      if (RM && !held) { var u = (1 - fz) * 0.3; pts = [[wa[i].x - s3.w.vx[i] * u, wa[i].y - s3.w.vy[i] * u], [wa[i].x, wa[i].y]]; }   /* 움직임 줄이기: 꼬리 = 속도 방향 */
      else for (j = 0; j < trails.length; j++) pts.push([trails[j][i].x, trails[j][i].y]);
      if (pts.length > 1) ART.trail(g, pts, { width: T3.WATER_R * 1.2, alpha: 0.5, tone: "main" });
    }
    for (i = 0; i < wa.length; i++) ART.water(g, wa[i].x, wa[i].y, { r: T3.WATER_R, angle: wa[i].angle, alpha: 1 });
    g.restore();
  }
  function render3() {
    var cv = $("st3"), f = fit(cv, T3.W, T3.H);
    if (f) {
      var fz = Math.round(frozen3(isHeld(3)) * 50) / 50, off = sceneImg(s3.kind, fz, cv.width, cv.height, f.d, f.s);
      f.g.setTransform(1, 0, 0, 1, 0, 0); f.g.drawImage(off, 0, 0); f.g.setTransform(f.d * f.s, 0, 0, f.d * f.s, 0, 0);
      if (s3.zoom) {   /* 접혀 있어도 모형은 돈다(값 상자가 읽는다) — 그리기만 건너뛴다 */
        drawGas(f.g, srcOf(s3.m, s3.gm, 3), null, s3.sc.BK, f.s);
        ART.beaker(f.g, s3.sc.REQ, { temp: 0, content: "water", solid: "none", dissolved: 1, frozen: 0, level: T3.LEVEL });
        drawWater(f.g);
      }
    }
    if (curveOn && !hold) curveOf($("cv3"), s3.m, s3.gm, null, T3.VMAX);
  }

  /* ━━ 처음 모습 보기(누르는 동안) ━━ 모형과 시계를 멈추고 기록을 tick 0부터 왕복 재생 */
  function isHeld(k) { return !!hold && hold.k === k; }
  function holdAvail(k) {
    if (k === 1) return !!s1.m && !!s1.mode && s1.clock - s1.start >= HOLD_MIN;
    if (k === 2) return !!s2.c && s2.chg !== null && s2.clock - s2.chg >= HOLD_MIN;
    return !!s3.m && s3.phase !== "ready" && s3.clock - s3.start >= HOLD_MIN;
  }
  function holdStart(k) { if (hold || k !== cur || !holdAvail(k)) return; hold = { k: k, tick: RM ? C.TRAIL : 0 }; dirty(); apply(); }
  function holdEnd() { if (!hold) return; hold = null; acc = 0; dirty(); apply(); }

  /* ━━ 시계: 고정 1/30초 프레임(SUB 2 = 1/60초 단계) · 한 rAF 최대 2프레임(느린 기기는 느려질 뿐 건너뛰지 않음) ━━ */
  function tickTab(n) { if (n === 1) tick1(); else if (n === 2) tick2(); else tick3(); }
  function advanceFrames(n) { var i; for (i = 0; i < n; i++) { if (hold) hold.tick++; else tickTab(cur); } }
  function busy(n) {
    if (n === 1) return !!s1.mode && s1.m.heating();
    if (n === 2) return s2.phase === "adding" || s2.phase === "removing" || s2.phase === "added";
    return s3.phase === "running";
  }
  /* 움직임 줄이기: 시작 단추 = 끝까지 동기로 돌려 끝 모습을 정지 화면으로(SPONT_TEST.advance 와 같은 함수) */
  function runToEnd(n) { var guard = 0; while (busy(n) && guard < 60 * C.FPS) { advanceFrames(1); guard++; } }
  function render() { if (cur === 1) render1(); else if (cur === 2) render2(); else render3(); }

  /* ━━ 표시 단일 원천(SHOW) — apply()만 display 를 쓴다 ━━ */
  var SHOW = [
    ["pane1", "block", function () { return cur === 1; }],
    ["pane2", "block", function () { return cur === 2; }],
    ["pane3", "block", function () { return cur === 3; }],
    ["side1", "block", function () { return curveOn; }],
    ["side2", "block", function () { return curveOn; }],
    ["side3", "block", function () { return curveOn; }],
    ["nb1", "block", function () { return !s1.box; }],
    ["hint1", "block", function () { return !s1.box && !isHeld(1); }],
    ["ghost1", "block", function () { return isHeld(1); }],
    ["ghost2a", "block", function () { return isHeld(2); }],
    ["ghost2b", "block", function () { return isHeld(2); }],
    ["ghost3", "block", function () { return isHeld(3); }],
    ["lg1bn", "inline-flex", function () { return !!s1.box; }],
    ["lg1bo", "inline-flex", function () { return !!s1.box; }],
    ["lg1bi", "inline-flex", function () { return !!s1.box; }],
    ["lg1kn", "inline-flex", function () { return !s1.box; }],
    ["lg1ka", "inline-flex", function () { return !s1.box; }],
    ["micro3", "block", function () { return s3.zoom; }],
    ["virt3m", "block", function () { return virtual3(); }],
    ["virt3c", "block", function () { return virtual3(); }],
    ["vbox3", "block", function () { return cur === 3; }],
    ["virt3b", "block", function () { return virtual3(); }],
    ["real3", "block", function () { return s3.mode === "classV" && s3.phase === "done"; }]
  ];
  var last = {}, autoId = 0;
  function put(el, prop, v) { if (!el.id) el.id = "spx" + (++autoId); var k = el.id + "." + prop; if (last[k] !== v) { last[k] = v; if (prop === "display") el.style.display = v; else if (prop === "text") el.textContent = v; else if (prop === "disabled") el.disabled = v; else el.setAttribute(prop, v); } }
  function apply() {
    var i, el;
    for (i = 0; i < SHOW.length; i++) { el = $(SHOW[i][0]); if (el) put(el, "display", SHOW[i][2]() ? SHOW[i][1] : "none"); }
    var lays = document.querySelectorAll(".lay"), tb = document.querySelectorAll(".tabb"), cb = document.querySelectorAll(".curvebtn");
    for (i = 0; i < lays.length; i++) lays[i].classList.toggle("curve-on", curveOn);
    for (i = 0; i < tb.length; i++) put(tb[i], "aria-pressed", String(+tb[i].getAttribute("data-tab") === cur));
    for (i = 0; i < cb.length; i++) { put(cb[i], "aria-pressed", String(curveOn)); put(cb[i], "text", curveOn ? "분포 곡선 접기" : "분포 곡선 보기"); }
    for (i = 1; i <= 3; i++) { el = $("hold" + i); put(el, "disabled", !isHeld(i) && !holdAvail(i)); put(el, "aria-pressed", String(isHeld(i))); }
    if (s2.c) { put($("in2"), "disabled", s2.phase !== "idle"); put($("out2"), "disabled", s2.phase !== "open"); }
    put($("zoom3"), "aria-pressed", String(s3.zoom)); put($("zoom3"), "text", s3.zoom ? "입자 접기" : "입자로 보기");
    put($("sFreezer"), "aria-pressed", String(s3.scene === "freezer")); put($("sClass"), "aria-pressed", String(s3.scene === "classroom"));
    put($("temp3"), "text", s3.scene === "freezer" ? "−20 ℃" : "25 ℃");   /* 장면 온도(사용자 지시 11-07 · 의뢰서 §5 ③) — 화면 눈금 T와 별개인 실제 장면 온도 */
    vbox3();
  }

  /* ━━ 입력 ━━ */
  function ensure(n) { if (n === 1 && !s1.m) init1(); if (n === 2 && !s2.c) init2(); if (n === 3 && !s3.m) init3(sceneMode()); }
  function setTab(n) { holdEnd(); ensure(n); cur = n; acc = 0; dirty(); apply(); }
  var ACT = {
    exo: function () { start1(1); },
    endo: function () { start1(-1); },
    reset1: function () { holdEnd(); init1(); dirty(); },
    clear1: function () { holdEnd(); s1.box = null; dirty(); },
    in2: in2,
    out2: out2,
    reset2: function () { holdEnd(); init2(); dirty(); },
    freeze3: function () { start3(sceneMode()); },
    real3: function () { start3("classR"); },
    reset3: function () { holdEnd(); init3(sceneMode()); dirty(); },
    zoom3: function () { s3.zoom = !s3.zoom; dirty(); },
    sFreezer: function () { holdEnd(); s3.scene = "freezer"; init3("freezer"); dirty(); },
    sClass: function () { holdEnd(); s3.scene = "classroom"; init3("classV"); dirty(); },
    curve: function () { curveOn = !curveOn; dirty(); }
  };
  function wire() {
    var k, i;
    for (k in ACT) if (ACT.hasOwnProperty(k) && $(k)) $(k).addEventListener("click", (function (f) { return function () { f(); apply(); render(); }; }(ACT[k])));
    var cb = document.querySelectorAll(".curvebtn"); for (i = 0; i < cb.length; i++) cb[i].addEventListener("click", function () { ACT.curve(); apply(); });
    var tb = document.querySelectorAll(".tabb"); for (i = 0; i < tb.length; i++) tb[i].addEventListener("click", function () { setTab(+this.getAttribute("data-tab")); });
    for (i = 1; i <= 3; i++) (function (n) {
      var b = $("hold" + n);
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } holdStart(n); });
      b.addEventListener("pointerup", holdEnd); b.addEventListener("pointercancel", holdEnd); b.addEventListener("lostpointercapture", holdEnd);
      b.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); holdStart(n); } });
      b.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") holdEnd(); });
      b.addEventListener("blur", holdEnd);
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }(i));
    wireBox($("st1"), { W: T1.W, H: T1.H, BK: T1.BK, get: function () { return s1.box; }, set: function (b) { s1.box = b; } });
    wireBox($("st2a"), { W: T2.W, H: T2.H, BK: T2.BK, get: function () { return s2.box; }, set: function (b) { s2.box = b; } });
    wireBox($("st2b"), { W: T2.W, H: T2.H, BK: T2.BK, get: function () { return s2.box; }, set: function (b) { s2.box = b; } });
    window.addEventListener("blur", holdEnd);
    window.addEventListener("resize", dirty);
    if (window.ResizeObserver) { var ro = new ResizeObserver(dirty); ro.observe(document.body); }
  }

  /* ━━ rAF 루프 하나 · 탭이 안 보이면 멈춤 ━━ */
  var raf = null, lastTs = 0, acc = 0, fpsN = 0, fpsT = 0;
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    var dt = lastTs ? Math.min(0.25, (ts - lastTs) / 1000) : 0; lastTs = ts;
    if (!RM) {
      acc += dt;
      var n = 0; while (acc >= DT && n < 2) { advanceFrames(1); acc -= DT; n++; }
      if (acc > DT) acc = 0;
      if (n) needDraw = true;
    }
    apply();   /* 보이기 → 그리기 순서(숨은 캔버스는 폭이 0이라 그려지지 않는다) */
    if (needDraw) { needDraw = false; render(); }
    if (SHOWFPS) { fpsN++; fpsT += dt; if (fpsT >= 1) { $("fps").textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; } }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; holdEnd(); }
    else if (!raf) { lastTs = 0; acc = 0; dirty(); raf = requestAnimationFrame(loop); }
  });

  /* ━━ 시험 손잡이(B-8) ━━ */
  function stateOf() {
    var o = { tab: cur, rm: RM, curveOn: curveOn, zoom: s3.zoom, ghostHeld: !!hold, ghostTab: hold ? hold.k : 0, ghostTick: hold ? hold.tick : 0,
      values: { sys: $("vsys").textContent, sur: $("vsur").textContent }, valueBoxShown: $("vbox3").style.display !== "none" && $("vbox3").offsetWidth > 0, holdEnabled: [holdAvail(1), holdAvail(2), holdAvail(3)] };
    if (s1.m) o.t1 = { phase: phase1(), mode: s1.mode, clock: s1.clock, T: s1.m.T(), addedPerN: s1.m.addedPerN(), heating: s1.m.heating(), box: s1.box, near: nearCount(liveSrc(s1.m), s1.box || T1.BK) };
    if (s2.c) o.t2 = { phase: s2.phase, clock: s2.clock, T: [s2.c.T(), s2.h.T()], addedPerN: [s2.c.addedPerN(), s2.h.addedPerN()], heating: [s2.c.heating(), s2.h.heating()], box: s2.box, near: [nearCount(liveSrc(s2.c), s2.box), nearCount(liveSrc(s2.h), s2.box)] };
    if (s3.m) o.t3 = { phase: s3.phase, scene: s3.scene, mode: s3.mode, clock: s3.clock, T: s3.m.T(), T0: s3.T0, addedPerN: s3.m.addedPerN(), heating: s3.m.heating(), frozen: frozen3(false), kind: s3.kind, endAt: s3.endAt,
      virtual: virtual3(), realShown: s3.mode === "classV" && s3.phase === "done", near: nearCount(liveSrc(s3.m), s3.sc.BK), nWater: s3.lat.sites.length };
    var t = cur === 1 ? o.t1 : cur === 2 ? o.t2 : o.t3;
    if (t) { o.phase = t.phase; o.T = t.T; o.addedPerN = t.addedPerN; o.box = t.box || null; o.near = t.near; }
    return o;
  }
  window.SPONT_TEST = {
    advance: function (sec) { advanceFrames(Math.round(sec * C.FPS)); apply(); render(); },
    state: stateOf,
    press: function (name) { if (ACT[name]) { ACT[name](); apply(); render(); } },
    setBox: function (tab, b) { if (tab === 1) s1.box = b ? copyBox(b) : null; else s2.box = copyBox(b); apply(); render(); },
    hold: function (k, on) { if (on) holdStart(k); else holdEnd(); apply(); render(); },
    render: function () { apply(); render(); },
    _s: { s1: s1, s2: s2, s3: s3 }
  };

  init1(); wire(); apply();
  raf = requestAnimationFrame(loop);
}());
