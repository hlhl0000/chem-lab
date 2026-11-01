/* 엔트로피 (화학탐구실 entropy/) — 조립 산출물. 정본: 검증스크립트/entropy_core.js · _entropy_fx/entropy_art.part.js(Astra) · _entropy_ui.part.js
   조립: node 검증스크립트/_entropy_assemble.js · 근거: 설계지시안_엔트로피_v1.md */
/* ==== CORE BEGIN ==== */
var ENTROPY_CORE = (function () {
  'use strict';

  /* ───── 1. 세기 — BigInt(있으면) · 공식으로만 ───── */
  var HAS_BIG = typeof BigInt === 'function';
  function big(n) { return HAS_BIG ? BigInt(n) : n; }
  /* C(n,k) — 곱셈식(나눗셈이 매 단계 정확히 떨어진다) */
  function comb(n, k) {
    if (k < 0 || k > n) return big(0);
    if (k > n - k) k = n - k;
    var r = big(1);
    for (var i = 1; i <= k; i++) r = r * big(n - k + i) / big(i);
    return r;
  }
  function pow2(n) {
    if (!HAS_BIG) {   /* BigInt 가 없으면 10진 문자열로(Number 는 2¹⁰⁰을 «1.2676…e+30»으로 바꿔 표시를 망친다 — S-검토 C-6) */
      var d = [1]; for (var i = 0; i < n; i++) { var c = 0; for (var j = 0; j < d.length; j++) { var v = d[j] * 2 + c; d[j] = v % 10; c = v >= 10 ? 1 : 0; } if (c) d.push(1); }
      return d.reverse().join('');
    }
    var r = big(1); for (var k = 0; k < n; k++) r = r * big(2); return r;
  }
  /* 두 방: 이름 붙인 입자 n개 — 왼쪽 방 k개인 배치 수 = C(n,k), 전체 = 2ⁿ */
  function twoRoom(n) {
    var dist = [];
    for (var k = 0; k <= n; k++) dist.push(comb(n, k));
    return { n: n, total: pow2(n), allLeft: comb(n, n), dist: dist };
  }
  /* 탭 ② 36칸 격자 장면 — 의뢰서 §4 표 2(같은 입자 4개) */
  var GRID = { cols: 6, rows: 6, cells: 36 };
  function gridScenes() {
    return {
      solid: comb(4, 4),                                 // 2×2 고정 4칸
      liquid: comb(GRID.cols, 4),                        // 바닥 한 줄 6칸
      gas: comb(GRID.cells, 4)                           // 36칸 전체
    };
  }
  /* 탭 ③ 4 × 4 = 16칸 격자 장면 — 의뢰서 v1.1 §4 표 3(2026-11-01 · 36칸 값은 폐기)
     분자 1개 = 칸 1개 · 같은 종류끼리는 구별하지 않고 종류가 다르면 구별한다 */
  var GRID3 = { cols: 4, rows: 4, cells: 16, half: 8 };
  function grid3Scenes() {
    return {
      reactants: big(GRID3.cells) * comb(GRID3.cells - 1, 3),         // N₂ 1개 + H₂ 3개 = 16 × C(15,3)
      products: comb(GRID3.cells, 2),                                  // NH₃ 2개 = C(16,2)
      mixBefore: comb(GRID3.half, 2) * comb(GRID3.half, 2),            // ㉮ 2(왼 8칸) · ㉯ 2(오 8칸) = C(8,2)²
      mixAfter: comb(GRID3.cells, 2) * comb(GRID3.cells - 2, 2)        // 16칸에 ㉮ 2 + ㉯ 2 = C(16,2) × C(14,2)
    };
  }
  /* 4입자 16가지 배치 — 왼쪽 방 개수 4→0, 같은 개수 안에서는 사전순 */
  function arrangements4() {
    var L = ['A', 'B', 'C', 'D'], out = [];
    for (var k = 4; k >= 0; k--) {
      var sets = [];   /* 비트로 고른 뒤 사전순 정렬 */
      for (var mask = 0; mask < 16; mask++) {
        var left = '', right = '', c = 0;
        for (var i = 0; i < 4; i++) { if (mask & (8 >> i)) { left += L[i]; c++; } else right += L[i]; }
        if (c === k) sets.push([left || '–', right || '–']);
      }
      sets.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      out = out.concat(sets);
    }
    return out;
  }

  /* ───── 2. 표시 — 천 단위 쉼표 · 큰 수는 «약 m.mm × 10ᵉ» ───── */
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sup(s) { return String(s).split('').map(function (c) { return SUP[c]; }).join(''); }
  function commas(s) { return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var SCI_DIGITS = 10;   /* 10자리 이상(≥ 10⁹)이면 과학 표기 — 1,048,576(7자리)은 그대로 */
  function fmt(v) {
    var s = String(v);
    if (s.length < SCI_DIGITS) return commas(s);
    /* 유효숫자 3자리 반올림 — 문자열 정수 연산(정밀도 손실 없음) */
    var e = s.length - 1, head = parseInt(s.slice(0, 3), 10), next = parseInt(s.charAt(3), 10);
    if (next >= 5) head++;
    if (head >= 1000) { head = 100; e++; }
    var h = String(head);
    return '약 ' + h.charAt(0) + '.' + h.slice(1) + ' × 10' + sup(e);
  }

  /* ───── 3. 얼음 Ih — 주기 초격자 + 오일러 회로로 수소 배치 ─────
     산소 = 우르차이트 자리(육방, 이상 사면체 c/a = √(8/3)). 결합 길이 d = 1(장면 단위).
     오일러 회로: 4-정규 그래프의 모든 꼭짓점이 «나가는 변 2개»를 갖도록 방향을 정한다
     → 산소마다 수소 정확히 2개 · 결합마다 수소 정확히 1개(Bernal–Fowler). */
  function rng(seed) {
    var t = (seed >>> 0) || 1;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  var ICE = { d: 1, u: 3 / 8 };
  ICE.c = ICE.d / ICE.u;                 // d = u·c
  ICE.a = ICE.c / Math.sqrt(8 / 3);      // c/a = √(8/3)
  /* 단위 칸 안 산소 4개(분수 좌표) — 투영 자리 A(1/3,2/3)·B(2/3,1/3) */
  var ICE_BASIS = [[1 / 3, 2 / 3, 0, 'A'], [2 / 3, 1 / 3, 0.5, 'B'], [1 / 3, 2 / 3, 3 / 8, 'A'], [2 / 3, 1 / 3, 0.5 + 3 / 8, 'B']];
  function iceCart(fx, fy, fz) {
    /* a1 = (a,0,0) · a2 = (−a/2, a√3/2, 0) · c = z */
    return [ICE.a * (fx - fy / 2), ICE.a * (fy * Math.sqrt(3) / 2), ICE.c * fz];
  }
  function iceIh(opt) {
    opt = opt || {};
    var NX = opt.nx || 6, NY = opt.ny || 6, NZ = opt.nz || 2, R = opt.radius == null ? 2.6 : opt.radius;
    var rnd = rng(opt.seed || 7);
    /* 3-1 주기 초격자 */
    var O = [];
    for (var i = 0; i < NX; i++) for (var j = 0; j < NY; j++) for (var k = 0; k < NZ; k++)
      for (var b = 0; b < 4; b++) {
        var f = ICE_BASIS[b];
        O.push({ f: [i + f[0], j + f[1], k + f[2]], site: f[3], layer: 2 * k + (b >= 2 ? 1 : 0) + (b === 1 ? 0 : 0) });
      }
    /* 이웃 = 주기 경계 최소 상 거리가 d */
    function pdelta(p, q) {
      var dx = q.f[0] - p.f[0], dy = q.f[1] - p.f[1], dz = q.f[2] - p.f[2];
      dx -= NX * Math.round(dx / NX); dy -= NY * Math.round(dy / NY); dz -= NZ * Math.round(dz / NZ);
      return iceCart(dx, dy, dz);
    }
    var edges = [], adj = O.map(function () { return []; });
    for (var p = 0; p < O.length; p++) for (var q = p + 1; q < O.length; q++) {
      var v = pdelta(O[p], O[q]), dd = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (Math.abs(dd - ICE.d) < 1e-6) { adj[p].push(edges.length); adj[q].push(edges.length); edges.push({ a: p, b: q, v: v }); }
    }
    /* 3-2 오일러 회로(Hierholzer, 반복형) — 지나간 방향 = 수소 주개 */
    var used = edges.map(function () { return false; }), dir = edges.map(function () { return -1; });
    var ptr = adj.map(function (l) { return l.slice().sort(function () { return rnd() - 0.5; }); });
    for (var s0 = 0; s0 < O.length; s0++) {
      var stack = [s0];
      while (stack.length) {
        var x = stack[stack.length - 1], L = ptr[x];
        while (L.length && used[L[L.length - 1]]) L.pop();
        if (!L.length) { stack.pop(); continue; }
        var e = L.pop(); used[e] = true;
        var y = edges[e].a === x ? edges[e].b : edges[e].a;
        dir[e] = x;                                   // x → y : x의 수소가 y를 향한다
        stack.push(y);
      }
    }
    /* 3-3 원점 맞추기 — 장면 중심을 초격자 중앙 «빈 통로»(투영 자리 C)에 둔다 */
    var cen = iceCart(NX / 2, NY / 2, NZ / 2);
    var pos = O.map(function (o) { var c = iceCart(o.f[0], o.f[1], o.f[2]); return [c[0] - cen[0], c[1] - cen[1], c[2] - cen[2]]; });
    /* 3-4 육각 기둥으로 자르기(투영 반지름 R·d) — 주기 상 중 가장 가까운 것으로 감싸 넣는다 */
    var Lx = iceCart(NX, 0, 0), Ly = iceCart(0, NY, 0);
    function wrap(P) {
      var best = P, bd = 1e9;
      for (var a = -1; a <= 1; a++) for (var c = -1; c <= 1; c++) {
        var Q = [P[0] + a * Lx[0] + c * Ly[0], P[1] + a * Lx[1] + c * Ly[1], P[2]];
        var r = Q[0] * Q[0] + Q[1] * Q[1];
        if (r < bd) { bd = r; best = Q; }
      }
      return best;
    }
    /* waterdensity 2D 그림과 같은 방향으로 — 육각 고리의 꼭짓점이 ±x(통로 중심에서 0°·60°…)에 오게 z축으로 −30° 돌린다.
       돌리기 전 꼭짓점 방향 = 90°(자리 A가 통로 C 바로 위) */
    var RZ = -Math.PI / 6, cz = Math.cos(RZ), sz = Math.sin(RZ);
    pos = pos.map(wrap).map(function (P) { return [P[0] * cz - P[1] * sz, P[0] * sz + P[1] * cz, P[2]]; });
    function inHex(P) {   /* 꼭짓점이 ±x 방향인 육각형(밑변 수평) */
      var x = Math.abs(P[0]), y = Math.abs(P[1]), r = R * ICE.d * 1.5;
      return y <= r * Math.sqrt(3) / 2 + 1e-9 && x * Math.sqrt(3) / 2 + y / 2 <= r * Math.sqrt(3) / 2 + 1e-9;
    }
    var keep = O.map(function (o, i) { return inHex(pos[i]); });
    /* 표시 이웃이 1개 이하인 산소는 반복해서 쳐 낸다(매달린 분자 0) */
    for (var pass = 0; pass < 30; pass++) {
      var deg = O.map(function () { return 0; }), changed = false;
      edges.forEach(function (e) {
        if (!keep[e.a] || !keep[e.b]) return;
        var P = pos[e.a], Q = pos[e.b], dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2];
        if (Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - ICE.d) < 1e-6) { deg[e.a]++; deg[e.b]++; }
      });
      for (var t = 0; t < O.length; t++) if (keep[t] && deg[t] < 2) { keep[t] = false; changed = true; }
      if (!changed) break;
    }
    /* 3-5 출력 — 분자 = 산소 + 수소 2개(OH 길이 0.36 d — mineral l3Ice 비율 승계) */
    var idx = [], mols = [], hb = [];
    O.forEach(function (o, i) { if (keep[i]) { idx[i] = mols.length; mols.push({ O: pos[i], H: [], site: o.site, layer: o.layer, z: pos[i][2] }); } else idx[i] = -1; });
    var OH = 0.36 * ICE.d;
    edges.forEach(function (e, ei) {
      var don = dir[ei], acc = don === e.a ? e.b : e.a;
      if (idx[don] < 0) return;
      var v0 = don === e.a ? e.v : [-e.v[0], -e.v[1], -e.v[2]], v = [v0[0] * cz - v0[1] * sz, v0[0] * sz + v0[1] * cz, v0[2]];
      var M = mols[idx[don]];
      M.H.push([M.O[0] + v[0] * OH, M.O[1] + v[1] * OH, M.O[2] + v[2] * OH]);
      /* 수소 결합 = 두 산소가 모두 보이고 «실제로 이웃»(감싸 넣기로 떨어지지 않음) */
      if (idx[acc] >= 0) {
        var A = pos[don], B = pos[acc], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
        if (Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - ICE.d) < 1e-6) hb.push([idx[don], idx[acc]]);
      }
    });
    return { mols: mols, hbonds: hb, d: ICE.d, a: ICE.a, c: ICE.c, oh: OH };
  }

  /* ───── 4. 물(액체) — 같은 분자 수, 밀도는 얼음보다 «조금 높게» ─────
     ★ 물이 얼음보다 밀도가 크다(차시 「물의 밀도」). 부피 = 얼음 상자 부피 × 0.917.
     배치: 최소 간격을 지킨 무작위 채우기 → 규칙 없음. */
  function iceVolume(ice) {
    var xs = ice.mols.map(function (m) { return m.O[0]; }), ys = ice.mols.map(function (m) { return m.O[1]; }), zs = ice.mols.map(function (m) { return m.O[2]; });
    function span(a) { return Math.max.apply(null, a) - Math.min.apply(null, a) + ICE.d; }
    return { w: span(xs), h: span(ys), dep: span(zs) };
  }
  var LIQ = { densityRatio: 1 / 0.917, minGap: 0.86 };   /* 얼음 0.917 g/cm³ · 물 1.000 */
  /* 얼음 Ih 분자 하나당 부피 = 단위 칸 부피 / 4 = (a²·√3/2·c)/4 (이상 사면체면 8/(3√3) d³ ≈ 1.540 d³) */
  ICE.vmol = ICE.a * ICE.a * Math.sqrt(3) / 2 * ICE.c / 4;
  function liquid(n, box, seed) {
    /* 물 상자 부피 = n × 얼음 분자당 부피 × 0.917 — 얼음의 «외접 상자»를 줄이면 육각기둥 얼음보다 커져 물이 덜 빽빽해 보였다(S-검토 A-3).
       상자 모양(가로:세로:깊이)만 얼음 외접 상자를 따른다. */
    var rnd = rng(seed || 11), target = n * ICE.vmol / LIQ.densityRatio, f = Math.pow(target / (box.w * box.h * box.dep), 1 / 3);
    var W = box.w * f, H = box.h * f, D = box.dep * f, pts = [], tries = 0;
    while (pts.length < n && tries < 200000) {
      tries++;
      var p = [(rnd() - 0.5) * (W - 0.5), (rnd() - 0.5) * (H - 0.5), (rnd() - 0.5) * (D - 0.5)], ok = true;
      for (var i = 0; i < pts.length && ok; i++) {
        var dx = p[0] - pts[i][0], dy = p[1] - pts[i][1], dz = p[2] - pts[i][2];
        if (dx * dx + dy * dy + dz * dz < LIQ.minGap * LIQ.minGap) ok = false;
      }
      if (ok) pts.push(p);
    }
    return { pts: pts, box: { w: W, h: H, dep: D } };
  }

  /* ───── 5. 탭 1 분할 화면(의뢰 v2) — 한 칸 = 배치 1가지 ─────
     입자 k(1…n)는 칸 안 상자의 k번째 줄에 있고, 0 = 왼쪽 방 · 1 = 오른쪽 방.
     홀수 입자는 가로 자리(열 번호)의 비트, 짝수 입자는 세로 자리(행 번호)의 비트 — 입자 1이 가장 굵은 갈림.
     그래서 입자를 하나 늘리면 모든 칸이 둘로 쪼개지고(홀수 → 세로선, 짝수 → 가로선), 새 입자가 가장 가는 비트가 된다.
     열 수 = 2^⌈n/2⌉ · 행 수 = 2^⌊n/2⌋ (n 짝수: 2^(n/2) × 2^(n/2) · 홀수: 2^((n+1)/2) × 2^((n−1)/2)) */
  function splitDims(n) { var nx = Math.ceil(n / 2), ny = Math.floor(n / 2); return { nx: nx, ny: ny, cols: Math.pow(2, nx), rows: Math.pow(2, ny) }; }
  function cellBits(n, c, r) {   /* 칸(열 c, 행 r) → 줄마다 0/1 */
    var d = splitDims(n), bits = [];
    for (var k = 1; k <= n; k++) {
      if (k % 2) { var j = (k + 1) / 2; bits.push(Math.floor(c / Math.pow(2, d.nx - j)) % 2); }
      else { var i = k / 2; bits.push(Math.floor(r / Math.pow(2, d.ny - i)) % 2); }
    }
    return bits;
  }
  function cellOf(n, bits) {     /* 줄마다 0/1 → 칸 */
    var d = splitDims(n), c = 0, r = 0;
    for (var k = 1; k <= n; k++) { if (k % 2) c += bits[k - 1] * Math.pow(2, d.nx - (k + 1) / 2); else r += bits[k - 1] * Math.pow(2, d.ny - k / 2); }
    return { c: c, r: r };
  }
  function popc32(x) { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  function popc(x) { return x < 4294967296 ? popc32(x >>> 0) : popc32((x % 4294967296) >>> 0) + popc32(Math.floor(x / 4294967296) >>> 0); }   /* 2^53 미만 정수 — 질감을 픽셀마다 세므로 빠른 비트 세기 */
  function cellLeft(n, c, r) { return n - popc(c) - popc(r); }    /* 그 칸의 왼쪽 방 입자 수 */

  /* ───── 6. LED 표시 문자열 — 16자리까지 쉼표, 넘으면 가수 3자리 «m.mm×10^e» ───── */
  var LED_MAX_DIGITS = 16;
  function ledText(v) {
    var s = String(v);
    if (s.length <= LED_MAX_DIGITS) return { kind: 'int', text: commas(s) };
    var e = s.length - 1, head = parseInt(s.slice(0, 3), 10), next = parseInt(s.charAt(3), 10);
    if (next >= 5) head++;
    if (head >= 1000) { head = 100; e++; }
    var h = String(head);
    return { kind: 'sci', mant: h.charAt(0) + '.' + h.slice(1), exp: String(e) };
  }

  /* ───── 7. 탭 3 기체 반응 — 부딪쳐서 반응(사용자 결정 D-9 · 11-01) ─────
     분자 4개가 모일 자리(hit 바깥 APP칸)에서 빨라지며 다가가 맞닿고(t = hit), 맞닿은 채로 옛 결합이 옅어지는 것과
     새 결합이 짙어지는 것이 겹쳐 일어난다 — 결합이 충돌보다 먼저 끊어지지 않고, 원자가 모두 따로 떠 있는 순간이 없다.
     자리·경로·시점은 검증스크립트/_entropy_rx_collide_search2.js(무작위 탐색 → INIT 이어 다듬기 4회 · 최종 기록 검증로그/entropy_rx_search2_final.json)의 결과(S-검토 R3 A-1 처리 — v1은 맞닿은 «순간»만 맞춰
     결합이 바뀌기 전에 0.19칸 벌어졌다): 옛 결합이 남아 있는 동안 네 분자가 계속 맞닿아 한 덩어리 · 다 짙은 막대는 1.25배 이하로만 늘어남 ·
     원자 원끼리 겹침 없음 · 맞닿은 순간 네 분자가 칸 5·6·9·10에 하나씩(모형의 절반 넘게) · NH₃는 덩어리 안에서 만들어진 뒤 운동기가 떼어 놓는다.
     모일 자리 = 맞닿는 자리에서 바깥으로 0.9칸(0.8칸이면 600번 중 2번 운동기가 서로 막혀 도착하지 못했다 — 작성자 실측). 칸 폭 단위 · 격자 0…4 */
  var RXC = {
    T: { hit: 1000, end: 3400, a0: 1400, a1: 2775, b0: 1375, b1: 2525 },   /* 맞닿음 · 끝 · 옛 결합 옅어짐(a0–a1) · 새 결합 짙어짐(b0–b1) — ms · 어느 순간에도 원자마다 짙기 0.55 넘는 결합 막대가 있고 막대 길이 ≤ 0.65칸(검증스크립트/entropy_check.js I) */
    sp: ['N2', 'H2', 'H2', 'H2'], half: { N2: 0.21, H2: 0.14 }, rad: { N: 0.15, N1: 0.21, H: 0.1 }, nh: 0.26, app: 0.9,
    hit: [[1.737, 1.824], [2.306, 1.657], [1.637, 2.097], [2.161, 2.083]],
    prod: [[1.54, 1.627, 0.787], [2.213, 2.352, 0.618]],             /* NH₃ 중심 x, y, 방향 θ */
    pm: [2, 5, 1, 0, 4, 3],                                             /* H 원자 h → 생성물 자리(⌊k/3⌋번 NH₃의 k%3+1번째 H) */
    kb: [0.53, -0.171, 0.017, 0.556, 0.038, 0.229, -0.104, -0.06],   /* 원자마다 경로가 휘는 정도 */
    bu: -0.012                                                           /* 맞닿은 덩어리가 잠깐 부푸는 정도 */
  };
  /* 원자 목록: [원소, 반응물 번호, 분자 안 자리(0 왼쪽 · 1 오른쪽)] */
  RXC.atoms = [['N', 0, 0], ['N', 0, 1], ['H', 1, 0], ['H', 1, 1], ['H', 2, 0], ['H', 2, 1], ['H', 3, 0], ['H', 3, 1]];
  RXC.slot = RXC.hit.map(function (c) { var dx = c[0] - 2, dy = c[1] - 2, d = Math.sqrt(dx * dx + dy * dy); return [c[0] + dx / d * RXC.app, c[1] + dy / d * RXC.app]; });   /* 모일 자리 */
  function nh3At(pr, k) { var th = pr[2] + (k - 1) * 2 * Math.PI / 3; return k === 0 ? [pr[0], pr[1]] : [pr[0] + RXC.nh * Math.cos(th), pr[1] + RXC.nh * Math.sin(th)]; }
  RXC.dest = RXC.atoms.map(function (a, i) {   /* 원자 → [생성물 번호, 그 NH₃ 안 자리(0 = N)] */
    if (a[0] === 'N') return [a[2], 0]; var k = RXC.pm[i - 2]; return [Math.floor(k / 3), k % 3 + 1]; });
  RXC.p0 = RXC.atoms.map(function (a) { var c = RXC.hit[a[1]], h = RXC.half[RXC.sp[a[1]]]; return [c[0] + (a[2] ? h : -h), c[1]]; });
  RXC.p1 = RXC.dest.map(function (d) { return nh3At(RXC.prod[d[0]], d[1]); });
  RXC.cx = [0, 1].map(function (k) { var s = 0; RXC.p0.forEach(function (p) { s += p[k]; }); return s / 8; });
  function smooth(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  function rxAtoms(t) {   /* 시간(ms) → 원자 자리·반지름 · 옛/새 결합 옅기 · (맞닿기 전이면) 분자 중심 */
    var T = RXC.T, mols = null, fm = 0, pos;
    if (t < T.hit) { var u = Math.max(0, t) / T.hit; u = u * u;   /* 빨라지며 다가가 부딪친다 */
      mols = RXC.hit.map(function (c, m) { var s = RXC.slot[m]; return { sp: RXC.sp[m], x: s[0] + (c[0] - s[0]) * u, y: s[1] + (c[1] - s[1]) * u }; });
      pos = RXC.atoms.map(function (a) { var M = mols[a[1]], h = RXC.half[M.sp]; return [M.x + (a[2] ? h : -h), M.y]; });
    } else { fm = smooth((t - T.hit) / (T.end - T.hit));
      pos = RXC.p0.map(function (p, i) { var q = RXC.p1[i], ex = q[0] - p[0], ey = q[1] - p[1], bz = 4 * fm * (1 - fm) * RXC.kb[i], x = p[0] + ex * fm - ey * bz, y = p[1] + ey * fm + ex * bz;
        var dx = x - RXC.cx[0], dy = y - RXC.cx[1], d = Math.sqrt(dx * dx + dy * dy) || 1, b = RXC.bu * Math.sin(Math.PI * fm); return [x + dx / d * b, y + dy / d * b]; }); }
    return { mols: mols, fm: fm, whole: t < T.hit ? 'reac' : t >= T.end ? 'prod' : 'mid',
      atoms: RXC.atoms.map(function (a, i) { return { el: a[0], mol0: a[1], mol1: RXC.dest[i][0], x: pos[i][0], y: pos[i][1], r: a[0] === 'N' ? RXC.rad.N + (RXC.rad.N1 - RXC.rad.N) * fm : RXC.rad.H }; }),
      bondOld: t < T.a0 ? 1 : 1 - smooth((t - T.a0) / (T.a1 - T.a0)), bondNew: smooth((t - T.b0) / (T.b1 - T.b0)) };
  }

  /* ───── 8. 탭 3 분자 운동기 · 발자국 · 50 % 규칙(사용자 결정 D-8 · S-검토 R3 B-2로 화면 코드에서 옮김) ─────
     분자는 상자 안을 곧게 날다 벽·서로에게 튕긴다. 초록 칸 = 분자 모형(원자 원 넓이)의 GREEN_FRAC 넘게가 든 칸.
     한 칸 한 분자: 중심이 다른 분자 중심이 있는 칸으로 들어가려 하면 튕기고, 두 분자가 새로 같은 칸에 절반 넘게 들게 되면 그 걸음을 무른다. */
  var LOCAL = { N2: [[-0.21, 0], [0.21, 0]], H2: [[-0.14, 0], [0.14, 0]] };
  function nh3Local(th) { var o = [[0, 0]]; for (var k = 0; k < 3; k++) o.push([0.26 * Math.cos(th + k * 2 * Math.PI / 3), 0.26 * Math.sin(th + k * 2 * Math.PI / 3)]); return o; }
  var GREEN_FRAC = 0.5, MOV_SPEED = 0.9;
  var FOOT_CACHE = {};
  function discsOf(sp, th) {   /* 종류·방향별 원자 원 [x, y, r](분자 안 좌표 · 칸 폭 단위) — drawMol 과 같은 치수 */
    th = th == null ? Math.PI / 3 : th; var nl = nh3Local(th);
    return { N2: [[-LOCAL.N2[1][0], 0, 0.15], [LOCAL.N2[1][0], 0, 0.15]], H2: [[-LOCAL.H2[1][0], 0, 0.1], [LOCAL.H2[1][0], 0, 0.1]],
      NH3: [[0, 0, 0.21], [nl[1][0], nl[1][1], 0.1], [nl[2][0], nl[2][1], 0.1], [nl[3][0], nl[3][1], 0.1]], A: [[0, 0, 0.3]], B: [[0, 0, 0.3]] }[sp];
  }
  function footOf(sp, th) {   /* 둘레 반지름 R(충돌·벽용) */
    var key = sp + ':' + (sp === 'NH3' ? (th == null ? Math.PI / 3 : th).toFixed(4) : '0'); if (FOOT_CACHE[key]) return FOOT_CACHE[key];
    var R = 0; discsOf(sp, th).forEach(function (d) { R = Math.max(R, Math.sqrt(d[0] * d[0] + d[1] * d[1]) + d[2]); });
    return (FOOT_CACHE[key] = { R: R });
  }
  /* 원 (cx, cy, r) ∩ 사각형 [x0,x1]×[y0,y1] 넓이 — x 방향 중점 적분 64조각(현의 길이는 정확) · 오차 < 0.1 %p
     (0.01칸 점 표본은 원 중심이 칸 경계에서 0.003칸 떨어져도 50.0 %로 읽어 3~4 %p 틀렸다 — S-검토 R3 뒤 작성자 실측) */
  function discRect(cx, cy, r, x0, x1, y0, y1) {
    var a = Math.max(x0, cx - r), b = Math.min(x1, cx + r); if (b <= a) return 0;
    var n = 64, w = (b - a) / n, s = 0;
    for (var i = 0; i < n; i++) { var x = a + (i + 0.5) * w, h = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))), lo = Math.max(y0, cy - h), hi = Math.min(y1, cy + h); if (hi > lo) s += hi - lo; }
    return s * w;
  }
  function cellFracs(it) {   /* 칸 → 분자 모형(원자 원 넓이 합)의 몇 분의 몇 */
    var cnt = {}, tot = 0;
    discsOf(it.sp, it.th).forEach(function (d) { var cx = it.x + d[0], cy = it.y + d[1], r = d[2];
      for (var gx = Math.floor(cx - r); gx <= Math.floor(cx + r); gx++) for (var gy = Math.floor(cy - r); gy <= Math.floor(cy + r); gy++) {
        var ar = discRect(cx, cy, r, gx, gx + 1, gy, gy + 1); if (ar <= 0) continue; tot += ar;
        var c = Math.min(3, Math.max(0, gy)) * 4 + Math.min(3, Math.max(0, gx)); cnt[c] = (cnt[c] || 0) + ar; } });
    Object.keys(cnt).forEach(function (c) { cnt[c] /= tot; }); return cnt;
  }
  var FOOT = { N2: footOf('N2'), H2: footOf('H2'), NH3: footOf('NH3'), A: footOf('A'), B: footOf('B') };   /* 둘레 반지름 R(방향과 무관) */
  function mainCell(it) {   /* 분자 모형의 GREEN_FRAC 넘게가 든 칸(없으면 −1) — 초록 칸과 같은 규칙 */
    var f = cellFracs(it), best = -1;
    Object.keys(f).forEach(function (c) { if (f[c] > GREEN_FRAC + 1e-9) best = +c; }); return best;   /* «절반 넘게» — 정확히 반반(넓이 적분의 반올림 0.5000000000000001)은 초록 아님(S-검토 R4 B-1) */
  }
  function greenOf(items) { var cells = {}; items.forEach(function (it) { var c = mainCell(it); if (c >= 0) cells[c] = 1; }); return Object.keys(cells).map(Number); }
  function Mover(list, rnd) { this.rnd = rnd; this.set(list); }
  Mover.prototype.place = function (list) { this.items = list.map(function (it) { return { sp: it.sp, x: it.x, y: it.y, th: it.th, vx: it.vx || 0, vy: it.vy || 0 }; }); };
  Mover.prototype.set = function (list) { var self = this; this.items = list.map(function (it) { var a = self.rnd() * Math.PI * 2; return { sp: it.sp, x: it.c % 4 + 0.5, y: Math.floor(it.c / 4) + 0.5, vx: Math.cos(a) * MOV_SPEED, vy: Math.sin(a) * MOV_SPEED }; }); };
  Mover.prototype.shuffle = function (cells) { var self = this; this.items.forEach(function (it, i) { it.x = cells[i] % 4 + 0.5; it.y = Math.floor(cells[i] / 4) + 0.5; var a = self.rnd() * Math.PI * 2; it.vx = Math.cos(a) * MOV_SPEED; it.vy = Math.sin(a) * MOV_SPEED; }); };
  function cell4(x, y) { return Math.min(3, Math.max(0, Math.floor(y))) * 4 + Math.min(3, Math.max(0, Math.floor(x))); }
  /* opt.part: 칸막이(x = 2) — A는 왼쪽·B는 오른쪽에만 · opt.goal: 모이기(목표 좌표 [x, y]로 끌림 · 칸 배제 끔 — 그동안 가짓수는 «—») */
  Mover.prototype.step = function (dt, opt) {
    opt = opt || {}; var its = this.items, self = this, prev = its.map(function (it) { return [it.x, it.y]; });
    its.forEach(function (it, i) {
      var R = FOOT[it.sp].R, lo = R, hi = 4 - R, lx = lo, hx = hi;
      if (opt.part) { if (it.sp === 'A') hx = 2 - R; else lx = 2 + R; }
      if (opt.goal) { var g = opt.goal[i], gx = g[0], gy = g[1], dx = gx - it.x, dy = gy - it.y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < 0.04) { it.x = gx; it.y = gy; it.vx = it.vy = 0; return; }
        var sp = Math.min(1.6, dd * 4); it.vx += (dx / dd * sp - it.vx) * Math.min(1, dt * 6); it.vy += (dy / dd * sp - it.vy) * Math.min(1, dt * 6); }
      else { var a = Math.atan2(it.vy, it.vx) + (self.rnd() - 0.5) * 2.4 * dt; it.vx = Math.cos(a) * MOV_SPEED; it.vy = Math.sin(a) * MOV_SPEED; }
      var nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
      if (!opt.goal) { var cN = cell4(nx, ny), cO = cell4(it.x, it.y);
        if (cN !== cO && its.some(function (q) { return q !== it && cell4(q.x, q.y) === cN; })) { if (Math.floor(nx) !== Math.floor(it.x)) it.vx = -it.vx; if (Math.floor(ny) !== Math.floor(it.y)) it.vy = -it.vy; nx = it.x; ny = it.y; } }
      if (nx < lx) { nx = lx; it.vx = Math.abs(it.vx); } if (nx > hx) { nx = hx; it.vx = -Math.abs(it.vx); }
      if (ny < lo) { ny = lo; it.vy = Math.abs(it.vy); } if (ny > hi) { ny = hi; it.vy = -Math.abs(it.vy); }
      it.x = nx; it.y = ny;
    });
    for (var a2 = 0; a2 < its.length; a2++) for (var b2 = a2 + 1; b2 < its.length; b2++) {   /* 서로 겹치지 않게 — 같은 질량 탄성 충돌 */
      var P1 = its[a2], P2 = its[b2], ex = P2.x - P1.x, ey = P2.y - P1.y, d2 = Math.sqrt(ex * ex + ey * ey), mn = FOOT[P1.sp].R + FOOT[P2.sp].R;
      if (d2 < mn && d2 > 1e-6) { var ux = ex / d2, uy = ey / d2, push = (mn - d2) / 2; P1.x -= ux * push; P1.y -= uy * push; P2.x += ux * push; P2.y += uy * push;
        var v1 = P1.vx * ux + P1.vy * uy, v2 = P2.vx * ux + P2.vy * uy; if (v1 - v2 > 0) { P1.vx += (v2 - v1) * ux; P1.vy += (v2 - v1) * uy; P2.vx += (v1 - v2) * ux; P2.vy += (v1 - v2) * uy; } } }
    its.forEach(function (it) { var R = FOOT[it.sp].R, lx = R, hx = 4 - R; if (opt.part) { if (it.sp === 'A') hx = 2 - R; else lx = 2 + R; }   /* 충돌로 밀린 뒤에도 칸막이를 다시 지킨다 */
      it.x = Math.max(lx, Math.min(hx, it.x)); it.y = Math.max(R, Math.min(4 - R, it.y)); });
    /* 두 분자가 같은 칸을 초록으로 만들게 되면(모형의 절반 넘게가 한 칸 — 중심 칸 배제로 못 막는 NH₃·충돌 밀림) 이 걸음을 무르고 되튄다(S-검토 R2 B-1) */
    if (!opt.goal) { var mc = its.map(mainCell), mp = prev.map(function (q, k) { return mainCell({ sp: its[k].sp, th: its[k].th, x: q[0], y: q[1] }); });
      for (var a3 = 0; a3 < its.length; a3++) for (var b3 = a3 + 1; b3 < its.length; b3++) if (mc[a3] >= 0 && mc[a3] === mc[b3] && !(mp[a3] >= 0 && mp[a3] === mp[b3])) {
        [a3, b3].forEach(function (k) { var q = its[k]; q.x = prev[k][0]; q.y = prev[k][1]; q.vx = -q.vx; q.vy = -q.vy; }); } }
  };
  /* 초록 칸 — 분자마다 표본점이 칸별로 몇 % 들어갔는지 세어, GREEN_FRAC 를 넘는 칸 */
  Mover.prototype.green = function () { return greenOf(this.items); };
  Mover.prototype.atGoal = function (goal) { return this.items.every(function (it, i) { return Math.abs(it.x - goal[i][0]) < 1e-6 && Math.abs(it.y - goal[i][1]) < 1e-6; }); };

  /* ───── 9. 탭 3 기체 반응 진행 제어(S-검토 R4 B-2로 화면 코드에서 옮김 — check J가 프레임 단위로 직접 돌린다) ─────
     상태: reac(반응 전 자유 운동) → [반응시키기] gather(모일 자리로) ⇄ gpause(모이는 중 멈춤 — 그 자리) → play(시계 0 → end) ⇄ scrub(진행 막대)
           → prod(NH₃ 2개 자유 운동 — 만들어진 자리·방향 그대로 넘겨받음). RM: 반응 전 ↔ 반응 후로 바로 · 움직이지 않음. */
  function RxRun(rm) { this.RM = !!rm; this.dur = RXC.T.end; this.GATHER_MAX = 6; this.fallbacks = 0;
    this.movR = new Mover([], rng(31)); this.movP = new Mover([], rng(37)); this.reset('reac'); }
  RxRun.START = [{ sp: 'N2', c: 1 }, { sp: 'H2', c: 8 }, { sp: 'H2', c: 7 }, { sp: 'H2', c: 14 }];   /* 반응 전 처음 칸(열, 행) (1,0) (0,2) (3,1) (2,3) */
  RxRun.prototype.reset = function (mode) { this.mode = mode; this.playing = false; this.gatherT = 0;
    if (mode === 'reac') { this.t = 0; this.movR.set(RxRun.START); }
    if (mode === 'prod') { this.t = this.dur;   /* 생성물은 만들어진 자리·방향 그대로, 덩어리 중심에서 멀어지는 쪽으로 */
      this.movP.place(RXC.prod.map(function (q) { var dx = q[0] - RXC.cx[0], dy = q[1] - RXC.cx[1], d = Math.sqrt(dx * dx + dy * dy) || 1; return { sp: 'NH3', x: q[0], y: q[1], th: q[2], vx: dx / d * MOV_SPEED, vy: dy / d * MOV_SPEED }; })); } };
  RxRun.prototype.press = function () {   /* [반응시키기 / 멈춤 / 처음부터 다시] */
    if (this.mode === 'gather') this.mode = 'gpause';
    else if (this.mode === 'gpause') this.mode = 'gather';
    else if (this.playing) { this.playing = false; this.mode = 'scrub'; }
    else if (this.mode === 'prod' || this.t >= this.dur) this.reset('reac');
    else if (this.RM) this.reset('prod');
    else if (this.mode === 'reac') { this.mode = 'gather'; this.gatherT = 0; }
    else { this.mode = 'play'; this.playing = true; } };
  RxRun.prototype.scrub = function (v) { this.playing = false; this.t = v; if (v <= 0) this.reset('reac'); else if (v >= this.dur) this.reset('prod'); else this.mode = 'scrub'; };
  RxRun.prototype.hop = function () { return this.mode === 'reac' || this.mode === 'prod' || this.mode === 'gather' || this.mode === 'gpause'; };
  RxRun.prototype.mover = function () { return this.mode === 'prod' ? this.movP : this.movR; };
  RxRun.prototype.label = function () { return this.playing || this.mode === 'gather' ? '멈춤' : this.mode === 'prod' ? '처음부터 다시' : '반응시키기'; };
  RxRun.prototype.step = function (dt) {   /* 한 프레임(dt 초 — 화면은 0.05 s로 자른다) */
    if (!this.RM && this.mode === 'reac') this.movR.step(dt);
    if (!this.RM && this.mode === 'prod') this.movP.step(dt);
    if (this.mode === 'gather') { this.movR.step(dt, { goal: RXC.slot }); this.gatherT += dt;   /* 상한은 시뮬레이션 시간(S-검토 R3 C-1) */
      if (this.gatherT > this.GATHER_MAX) { this.movR.place(RXC.slot.map(function (q, i) { return { sp: RXC.sp[i], x: q[0], y: q[1] }; })); this.fallbacks++; }   /* 끼어서 못 모이면 모일 자리로 */
      if (this.movR.atGoal(RXC.slot)) { this.mode = 'play'; this.playing = true; this.t = 0; } }
    if (this.playing) { this.t = Math.min(this.dur, this.t + dt * 1000); if (this.t >= this.dur) this.reset('prod'); } };
  RxRun.prototype.atoms = function () {   /* 지금 화면에 그려지는 원자 8개(RXC.atoms 순서) — 상태가 바뀌어도 같은 원자끼리 이어 볼 수 있게 */
    if (!this.hop()) return rxAtoms(this.t).atoms.map(function (a) { return { el: a.el, x: a.x, y: a.y }; });
    var its = this.mover().items, prod = this.mode === 'prod';
    return RXC.atoms.map(function (a, i) {
      if (prod) { var d = RXC.dest[i], it = its[d[0]], l = nh3Local(it.th)[d[1]]; return { el: a[0], x: it.x + l[0], y: it.y + l[1] }; }
      var m = its[a[1]], h = LOCAL[m.sp][a[2]][0]; return { el: a[0], x: m.x + h, y: m.y }; }); };

  return {
    RxRun: RxRun,
    MOL: { LOCAL: LOCAL, nh3Local: nh3Local, discsOf: discsOf, cellFracs: cellFracs, GREEN_FRAC: GREEN_FRAC, MOV_SPEED: MOV_SPEED, footOf: footOf, FOOT: FOOT, mainCell: mainCell, greenOf: greenOf, Mover: Mover, cell4: cell4 },
    RXC: RXC, rxAtoms: rxAtoms,
    splitDims: splitDims, cellBits: cellBits, cellOf: cellOf, cellLeft: cellLeft, popc: popc, ledText: ledText, LED_MAX_DIGITS: LED_MAX_DIGITS,
    HAS_BIG: HAS_BIG, comb: comb, pow2: pow2, twoRoom: twoRoom, GRID: GRID, gridScenes: gridScenes,
    GRID3: GRID3, grid3Scenes: grid3Scenes, arrangements4: arrangements4, fmt: fmt, commas: commas, sup: sup,
    rng: rng, ICE: ICE, iceIh: iceIh, iceVolume: iceVolume, LIQ: LIQ, liquid: liquid,
    PARTICLE_COUNTS: [4, 10, 20, 100]
  };
})();
/* ==== CORE END ==== */

/* ==== ART BEGIN (Astra ENTROPY_ART v1 — 원본 그대로 · 수정 금지) ==== */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var cache = {};
  var cacheKeys = [];
  var cacheLimit = 12;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function number(v, fallback) {
    v = +v;
    return isFinite(v) ? v : fallback;
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

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.restore();
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.closePath();
  }

  function waterColor(temp) {
    if (temp > 0.12) {
      return '#eadfdf';
    }
    if (temp < -0.12) {
      return '#d8ecfa';
    }
    return '#dcebf1';
  }

  function waterLine(temp) {
    if (temp > 0.12) {
      return '#b98282';
    }
    if (temp < -0.12) {
      return '#5596c4';
    }
    return '#6e9eae';
  }

  function highlight(ctx, box, amount) {
    if (amount <= 0) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.16 + amount * 0.34;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2 + amount * 3;
    ctx.shadowColor = 'rgba(37,99,235,0.32)';
    ctx.shadowBlur = 8 + amount * 10;
    rounded(ctx, box.x + 3, box.y + 3, box.w - 6, box.h - 6, Math.min(box.w, box.h) * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawCup(ctx, kind, box, s) {
    var x = box.x;
    var y = box.y;
    var w = box.w;
    var h = box.h;
    var bottom = y + h;
    var top = y + h * 0.16;
    var outerL = x + w * 0.22;
    var outerR = x + w * 0.78;
    var bottomL = x + w * 0.14;
    var bottomR = x + w * 0.86;
    var innerL = x + w * 0.285;
    var innerR = x + w * 0.715;
    var innerTop = top + h * 0.035;
    var innerBottom = bottom - h * 0.075;
    var innerH = innerBottom - innerTop;
    var level = clamp(number(s.level, 0.62), 0, 1);
    var surface = innerBottom - innerH * level;
    var temp = clamp(number(s.temp, 0), -1, 1);
    var waterW = innerR - innerL;
    var waterH = innerBottom - surface;
    var walls = [
      {x0: outerL, y0: top, x1: bottomL, y1: bottom},
      {x0: bottomL, y0: bottom, x1: bottomR, y1: bottom},
      {x0: bottomR, y0: bottom, x1: outerR, y1: top}
    ];

    highlight(ctx, box, clamp(number(s.highlight, 0), 0, 1));

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.09)';
    ellipse(ctx, x + w * 0.5, bottom + 1, w * 0.38, h * 0.025);
    ctx.fill();

    ctx.fillStyle = '#e8eef2';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(outerL, top);
    ctx.lineTo(bottomL, bottom - h * 0.055);
    ctx.quadraticCurveTo(bottomL, bottom, bottomL + w * 0.06, bottom);
    ctx.lineTo(bottomR - w * 0.06, bottom);
    ctx.quadraticCurveTo(bottomR, bottom, bottomR, bottom - h * 0.055);
    ctx.lineTo(outerR, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbfdff';
    rounded(ctx, innerL, innerTop, innerR - innerL, innerBottom - innerTop, w * 0.045);
    ctx.fill();

    if (waterH > 0.1) {
      ctx.fillStyle = waterColor(temp);
      rounded(ctx, innerL, surface, waterW, waterH, Math.min(w * 0.035, waterH * 0.25));
      ctx.fill();
      ctx.strokeStyle = waterLine(temp);
      ctx.lineWidth = Math.max(1.2, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(innerL + 1, surface);
      ctx.bezierCurveTo(x + w * 0.42, surface - h * 0.008, x + w * 0.58, surface + h * 0.008, innerR - 1, surface);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rounded(ctx, innerL + w * 0.025, surface + h * 0.025, w * 0.028, Math.max(1, waterH - h * 0.06), w * 0.014);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.moveTo(outerL + w * 0.02, top + h * 0.03);
    ctx.lineTo(bottomL + w * 0.025, bottom - h * 0.08);
    ctx.lineTo(innerL + w * 0.018, bottom - h * 0.1);
    ctx.lineTo(innerL - w * 0.018, top + h * 0.04);
    ctx.closePath();
    ctx.fill();

    if (kind === 'open') {
      ctx.fillStyle = '#f8fbfd';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, w * 0.008);
      ellipse(ctx, x + w * 0.5, top, (outerR - outerL) * 0.5, h * 0.027);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#a6bac5';
      ctx.lineWidth = Math.max(1, w * 0.005);
      ellipse(ctx, x + w * 0.5, top, (innerR - innerL) * 0.5, h * 0.015);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, w * 0.008);
      rounded(ctx, x + w * 0.175, top - h * 0.038, w * 0.65, h * 0.082, h * 0.027);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      rounded(ctx, x + w * 0.41, top - h * 0.07, w * 0.18, h * 0.04, h * 0.012);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.22, top - h * 0.018);
      ctx.lineTo(x + w * 0.76, top - h * 0.018);
      ctx.stroke();
    }
    ctx.restore();

    return {
      water: {x: innerL, y: surface, w: waterW, h: waterH},
      surfaceY: surface,
      mouth: kind === 'open' ? {x0: innerL, x1: innerR, y: top} : null,
      wall: walls,
      inner: {x: innerL, y: innerTop, w: innerR - innerL, h: innerBottom - innerTop}
    };
  }

  function drawFlask(ctx, box, s) {
    var x = box.x;
    var y = box.y;
    var w = box.w;
    var h = box.h;
    var outerX = x + w * 0.15;
    var outerY = y + h * 0.11;
    var outerW = w * 0.70;
    var outerH = h * 0.89;
    var gapX = x + w * 0.215;
    var gapY = y + h * 0.17;
    var gapW = w * 0.57;
    var gapH = h * 0.76;
    var linerX = x + w * 0.27;
    var linerY = y + h * 0.20;
    var linerW = w * 0.46;
    var linerH = h * 0.70;
    var innerX = x + w * 0.315;
    var innerY = y + h * 0.225;
    var innerW = w * 0.37;
    var innerH = h * 0.64;
    var level = clamp(number(s.level, 0.62), 0, 1);
    var surface = innerY + innerH * (1 - level);
    var waterH = innerY + innerH - surface;
    var temp = clamp(number(s.temp, 0), -1, 1);
    var flaskWalls = [
      {x0: outerX, y0: outerY + h * 0.08, x1: outerX, y1: y + h * 0.91},
      {x0: outerX, y0: y + h, x1: outerX + outerW, y1: y + h},
      {x0: outerX + outerW, y0: y + h * 0.91, x1: outerX + outerW, y1: outerY + h * 0.08},
      {x0: outerX + outerW, y0: outerY, x1: outerX, y1: outerY}
    ];

    highlight(ctx, box, clamp(number(s.highlight, 0), 0, 1));

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.11)';
    ellipse(ctx, x + w * 0.5, y + h + 1, w * 0.36, h * 0.026);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.7, w * 0.009);
    rounded(ctx, outerX, outerY, outerW, outerH, w * 0.14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    rounded(ctx, gapX, gapY, gapW, gapH, w * 0.10);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.2, w * 0.006);
    ctx.stroke();

    ctx.fillStyle = '#a8b5c3';
    rounded(ctx, linerX, linerY, linerW, linerH, w * 0.075);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.fillStyle = '#fbfdff';
    rounded(ctx, innerX, innerY, innerW, innerH, w * 0.055);
    ctx.fill();

    if (waterH > 0.1) {
      ctx.fillStyle = waterColor(temp);
      rounded(ctx, innerX, surface, innerW, waterH, Math.min(w * 0.035, waterH * 0.25));
      ctx.fill();
      ctx.strokeStyle = waterLine(temp);
      ctx.lineWidth = Math.max(1.2, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(innerX + 1, surface);
      ctx.bezierCurveTo(x + w * 0.43, surface - h * 0.006, x + w * 0.57, surface + h * 0.006, innerX + innerW - 1, surface);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rounded(ctx, outerX + w * 0.025, outerY + h * 0.12, w * 0.035, h * 0.60, w * 0.018);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, w * 0.008);
    rounded(ctx, x + w * 0.285, y + h * 0.055, w * 0.43, h * 0.145, h * 0.035);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    rounded(ctx, x + w * 0.34, y + h * 0.025, w * 0.32, h * 0.06, h * 0.022);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.37, y + h * 0.048);
    ctx.lineTo(x + w * 0.61, y + h * 0.048);
    ctx.stroke();
    ctx.restore();

    return {
      water: {x: innerX, y: surface, w: innerW, h: waterH},
      surfaceY: surface,
      mouth: null,
      wall: flaskWalls,
      inner: {x: innerX, y: innerY, w: innerW, h: innerH}
    };
  }

  function shiftedGeometry(g, dx, dy) {
    var walls = [];
    var i;
    for (i = 0; i < g.wall.length; i += 1) {
      walls.push({x0:g.wall[i].x0 + dx,y0:g.wall[i].y0 + dy,x1:g.wall[i].x1 + dx,y1:g.wall[i].y1 + dy});
    }
    return {
      water:{x:g.water.x + dx,y:g.water.y + dy,w:g.water.w,h:g.water.h},
      surfaceY:g.surfaceY + dy,
      mouth:g.mouth ? {x0:g.mouth.x0 + dx,x1:g.mouth.x1 + dx,y:g.mouth.y + dy} : null,
      wall:walls,
      inner:{x:g.inner.x + dx,y:g.inner.y + dy,w:g.inner.w,h:g.inner.h}
    };
  }

  function cachedVessel(ctx, kind, box, s) {
    var transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    var scale = transform ? Math.max(1, Math.abs(transform.a), Math.abs(transform.d)) : 1;
    var temp = clamp(number(s.temp, 0), -1, 1);
    var level = clamp(number(s.level, 0.62), 0, 1);
    var key = kind + '|' + box.w + '|' + box.h + '|' + temp + '|' + level + '|' + scale;
    var entry = cache[key];
    var pad = 5;
    var canvas;
    var off;
    var localBox;
    if (!entry) {
      canvas = root.document.createElement('canvas');
      canvas.width = Math.ceil((box.w + pad * 2) * scale);
      canvas.height = Math.ceil((box.h + pad * 2) * scale);
      off = canvas.getContext('2d');
      off.scale(scale, scale);
      localBox = {x:pad,y:pad,w:box.w,h:box.h};
      entry = {
        canvas:canvas,
        geometry:kind === 'flask' ? drawFlask(off, localBox, {temp:temp,level:level,highlight:0}) : drawCup(off, kind, localBox, {temp:temp,level:level,highlight:0})
      };
      cache[key] = entry;
      cacheKeys.push(key);
      if (cacheKeys.length > cacheLimit) {
        delete cache[cacheKeys.shift()];
      }
    }
    ctx.drawImage(entry.canvas, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
    return shiftedGeometry(entry.geometry, box.x - pad, box.y - pad);
  }

  function vessel(ctx, kind, box, s) {
    s = s || {};
    box = box || {x: 0, y: 0, w: 240, h: 260};
    box = {
      x: number(box.x, 0),
      y: number(box.y, 0),
      w: Math.max(40, number(box.w, 240)),
      h: Math.max(60, number(box.h, 260))
    };
    kind = kind === 'flask' ? 'flask' : (kind === 'lid' ? 'lid' : 'open');
    if (clamp(number(s.highlight, 0), 0, 1) === 0 && root.document && typeof ctx.drawImage === 'function') {
      return cachedVessel(ctx, kind, box, s);
    }
    if (kind === 'flask') {
      return drawFlask(ctx, box, s);
    }
    return drawCup(ctx, kind, box, s);
  }

  function molecule(ctx, x, y, s) {
    var r;
    var a;
    var alpha;
    var bond;
    var spread = 52.25 * DEG;
    s = s || {};
    r = clamp(number(s.r, 6), 1, 40);
    a = number(s.angle, 0);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    bond = r * 1.58;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(1, r * 0.24);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-spread) * bond, Math.sin(-spread) * bond);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(spread) * bond, Math.sin(spread) * bond);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.9, r * 0.16);
    circle(ctx, Math.cos(-spread) * bond, Math.sin(-spread) * bond, r * 0.58);
    ctx.fill();
    ctx.stroke();
    circle(ctx, Math.cos(spread) * bond, Math.sin(spread) * bond, r * 0.58);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e53935';
    ctx.strokeStyle = '#8f2727';
    ctx.lineWidth = Math.max(0.8, r * 0.13);
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function steam(ctx, x, y, s) {
    var size;
    var phase;
    var alpha;
    var seed;
    var sway;
    s = s || {};
    size = clamp(number(s.size, 18), 4, 80);
    phase = clamp(number(s.phase, 0), 0, 1);
    seed = Math.abs(Math.floor(number(s.seed, 17)));
    sway = ((seed % 9) - 4) * size * 0.018;
    alpha = (1 - phase) * 0.86;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(148,163,184,0.76)';
    ctx.lineWidth = Math.max(1.2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.13, y + size * 0.5);
    ctx.bezierCurveTo(x - size * 0.58 + sway, y + size * 0.2, x + size * 0.45 + sway, y + size * 0.02, x + size * 0.05, y - size * 0.17);
    ctx.bezierCurveTo(x - size * 0.35 - sway, y - size * 0.37, x + size * 0.42, y - size * 0.55, x + size * 0.12, y - size * 0.76);
    ctx.stroke();
    ctx.restore();
  }

  function energy(ctx, x, y, s) {
    var r;
    var alpha;
    var pulse;
    var halo;
    s = s || {};
    r = clamp(number(s.r, 5), 1, 30);
    alpha = clamp(number(s.alpha, 1), 0, 1);
    pulse = clamp(number(s.pulse, 0), 0, 1);
    halo = r * (2.15 + pulse * 0.55);

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(252,211,77,0.10)';
    circle(ctx, x, y, halo);
    ctx.fill();
    ctx.fillStyle = 'rgba(252,211,77,0.28)';
    circle(ctx, x, y, halo * 0.56);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = Math.max(0.9, r * 0.18);
    circle(ctx, x, y, r * (1 + pulse * 0.08));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,247,194,0.78)';
    circle(ctx, x - r * 0.25, y - r * 0.28, r * 0.24);
    ctx.fill();
    ctx.restore();
  }

  function icon(size) {
    var n = Math.max(16, Math.round(number(size, 64)));
    return '<svg width="' + n + '" height="' + n + '" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<rect x="5" y="9" width="54" height="46" rx="7" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M32 11v42" stroke="currentColor" stroke-width="2" stroke-dasharray="3 4" opacity=".45"/>' +
      '<circle cx="14" cy="20" r="3.4" fill="currentColor"/>' +
      '<circle cx="24" cy="18" r="3.4" fill="currentColor"/>' +
      '<circle cx="18" cy="30" r="3.4" fill="currentColor"/>' +
      '<circle cx="27" cy="35" r="3.4" fill="currentColor"/>' +
      '<circle cx="14" cy="43" r="3.4" fill="currentColor"/>' +
      '<circle cx="39" cy="23" r="3.4" fill="currentColor"/>' +
      '<circle cx="49" cy="39" r="3.4" fill="currentColor"/>' +
      '<path d="M27 25c6 0 8 5 13 7M37 29l4 3-5 2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function info() {
    return {cacheEntries: cacheKeys.length};
  }

  root.ENTROPY_ART = {
    contract: 1,
    version: '1.0.0',
    vessel: vessel,
    molecule: molecule,
    steam: steam,
    energy: energy,
    svg: {icon: icon},
    info: info
  };
}(window));
/* ==== ART END ==== */

/* ================= UI + WebGL ================= */
/* 화면 — 시안 3(탭 ①②) · 시안 2(탭 ③④)에서 고른 형태(설계지시안_엔트로피 §1-1 #11). 숫자는 전부 ENTROPY_CORE 에서. */
(function () {
  'use strict';
  var C = ENTROPY_CORE, ART = window.ENTROPY_ART;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DPR = function () { return Math.min(2, window.devicePixelRatio || 1); };
  var $ = function (id) { return document.getElementById(id); };
  function fit(cv, W, H) {
    var d = DPR(); if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.height = H + 'px'; }
    var g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return g;
  }
  function rd(label, val, big, id) { return '<div class="readout' + (big ? ' big' : '') + '"><div class="label">' + label + '</div><div class="value"' + (id ? ' id="' + id + '"' : '') + '>' + val + '</div></div>'; }
  function hasWebGL() { try { var c = document.createElement('canvas'); return !!(window.THREE && window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  var GL = hasWebGL();

  var DESC = {
    1: '입자 수를 바꿔 보세요. 「퍼짐」 상자에서는 입자가 두 방으로 퍼지고, 「경우의 수」 화면의 한 칸은 입자들이 두 방에 놓이는 배치 한 가지입니다.',
    2: '같은 용기에 같은 수의 입자가 들어 있습니다. 세 상자의 움직임을 비교하고, 상자를 눌러 그 상태의 경우의 수를 확인하세요.',
    3: '기체 분자 수가 바뀌거나 서로 다른 기체가 섞일 때 배치의 가짓수가 어떻게 바뀌는지 보세요.',
    4: '용기를 눌러 용기 안과 바깥 사이에 물질(물 분자)과 에너지(주황 알갱이)가 드나드는지 확인하세요.'
  };
  var LIMITS = [
    '두 방과 격자 용기는 입자가 놓이는 «자리»만 셉니다. 입자가 에너지를 나누어 갖는 경우의 수는 세지 않습니다.',
    '세는 규칙이 탭마다 다릅니다. 탭 ①에서는 입자 하나하나를 구별해 셉니다(2ⁿ가지) — 입자 8개까지는 입자마다 색이 다르고, 칸 안 작은 상자의 위에서 k번째 줄이 k번째 입자의 자리입니다. 그래서 왼쪽 방 입자 수가 같아도 어느 입자가 어느 방에 있는지가 다르면 다른 배치입니다.',
    '기체 반응 장면은 단순화한 모형입니다. 실제 반응은 분자 4개가 한꺼번에 부딪쳐 일어나는 것이 아니라 여러 단계를 거쳐 일어나며, 분자끼리 부딪친다고 모두 반응하지는 않습니다.',
    '탭 ②와 탭 ③(4 × 4 격자)에서는 한 칸에 입자 하나만 놓고, 같은 종류끼리 자리를 바꾸면 같은 배치로, 종류가 다른 입자끼리 바꾸면 다른 배치로 셉니다.',
    '탭 ②에서 고체·액체·기체마다 입자가 갈 수 있는 칸을 정해 둔 것은 단순화한 모형입니다. 실제 물질의 가짓수와 다릅니다.',
    '분자 3D 모형의 크기·속력은 과장했고, 수증기 용기는 줄여 그렸습니다(실제 수증기 분자 사이는 훨씬 더 멉니다).',
    '보온병은 이상적인 단열 용기로 가정했습니다. 실제 보온병은 에너지가 아주 조금씩 빠져나갑니다.',
    '물의 온도 막대는 눈금 없는 정성 표시입니다.'
  ];

  /* ═══════════════ LED 7세그먼트 (SVG · 웹폰트 없음) ═══════════════ */
  var SEG = { a: '3,1 21,1 18,5 6,5', b: '22,2 22,21 19,19 19,6', c: '22,25 22,44 19,40 19,27', d: '3,45 21,45 18,41 6,41', e: '2,25 2,44 5,40 5,27', f: '2,2 2,21 5,19 5,6', g: '3,23 6,21 18,21 21,23 18,25 6,25' };
  var DIG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
  function digitSVG(ch, x, s, y) {
    var on = DIG[ch] || '', o = '<g data-d="' + ch + '" transform="translate(' + x + ',' + (y || 0) + ') scale(' + s + ')">';
    'abcdefg'.split('').forEach(function (k) { o += '<polygon class="' + (on.indexOf(k) >= 0 ? 'on' : 'off') + '" points="' + SEG[k] + '"/>'; });
    return o + '</g>';
  }
  /* 쉼표 = 꼬리 있는 불빛(동그란 점은 소수점과 헷갈린다 — 사용자 결정 v2-6) */
  function ledSVG(led, roll) {
    var x = 0, o = '';
    function digits(str, s, y) { str.split('').forEach(function (ch, i) {
      if (ch === ',') { o += '<g data-d="," transform="translate(' + (x + 1) + ',' + (40 * s + (y || 0)) + ')"><circle class="on" cx="3.5" cy="4" r="3.2"/><polygon class="on" points="5.8,5 3.5,12 1.4,11.2 2.6,5.4"/></g>'; x += 9 * s; return; }
      if (ch === '.') { o += '<circle data-d="." class="on" cx="' + (x + 4) + '" cy="' + (43 * s + (y || 0)) + '" r="' + 3.2 * s + '"/>'; x += 9 * s; return; }
      o += digitSVG(roll && roll[i] != null ? roll[i] : ch, x, s, y); x += 26 * s;
    }); }
    if (led.kind === 'int') digits(led.text, 1);
    else {
      digits(led.mant, 1);
      o += '<g data-d="×" transform="translate(' + (x + 4) + ',16)"><polygon class="on" points="0,2 2,0 16,14 14,16"/><polygon class="on" points="14,0 16,2 2,16 0,14"/></g>'; x += 24;
      digits('10', 1); var ex = x; x += 2; digits(led.exp, 0.55, -6); x = Math.max(x, ex + 30);
    }
    return '<svg viewBox="-2 -8 ' + (Math.max(26, x + 2) + 4) + ' 62" aria-hidden="true">' + o + '</svg>';
  }
  /* 값이 바뀌면 약 0.7 s 굴러가다 정확한 값에서 멈춘다(RM이면 바로 멈춘다) */
  function Led(el) { this.el = el; this.val = null; this.t0 = 0; this.done = true; }
  Led.prototype.set = function (v) { var s = String(v); if (s === this.val) return; this.val = s; this.t0 = performance.now(); this.done = false; this.draw(); };
  Led.prototype.draw = function () {
    if (!this.el || !this.el.isConnected || this.val == null || this.done) return;
    var led = C.ledText(this.val), u = RM ? 1 : (performance.now() - this.t0) / 700, roll = null;
    if (u < 1 && led.kind === 'int') { roll = {}; var t = led.text, nd = 0; for (var i = t.length - 1; i >= 0; i--) if (t[i] !== ',') { nd++; if (u < 0.25 + 0.75 * nd / 12) roll[i] = String(Math.floor(performance.now() / 45 + i * 3) % 10); } }
    this.done = !roll || !Object.keys(roll).length;
    this.el.innerHTML = '<p class="cap">경우의 수</p>' + ledSVG(led, roll);
    var txt = led.kind === 'int' ? led.text : led.mant + ' × 10^' + led.exp;
    this.el.setAttribute('data-value', txt); this.el.setAttribute('data-settled', this.done ? '1' : '0');
    this.el.setAttribute('aria-label', '경우의 수 ' + (led.kind === 'int' ? led.text : led.mant + ' 곱하기 10의 ' + led.exp + '제곱'));
  };

  /* ═══════════════ 탭 ① 분할 화면 ═══════════════ */
  var T1 = { n: 4, anim: null, group: false, zoomL: 0, cache: {}, S: 0 };
  function shade(f) { var a = [238, 242, 255], b = [30, 58, 138]; return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]; }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  /* 입자마다 고유한 색(사용자 결정 2026-11-01 — «분포되는 입자 수는 같지만 서로 다른 경우의 수임을 드러내도록»)
     k번째 입자 = k번째 줄 = k번째 색 · 모든 칸에서 같은 입자는 같은 색. 색각 구별용 Okabe–Ito 8색(빨강은 「모두 왼쪽」 테두리라 뺌).
     9개 이상은 칸 속 입자를 그리지 않는 구간이라 한 색(색이 되풀이되면 «같은 입자»로 오해한다). */
  var PCOL = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#1f2937', '#9ca3af'], PCOL_ONE = '#2563eb';
  function pcol(k, n) { return n <= PCOL.length ? PCOL[k] : PCOL_ONE; }
  function miniBox(g, x, y, w, h, bits, newRowU) {   /* 칸 안의 작은 상자 — 가운데 칸막이 선 · 위에서 k번째 줄 = k번째 입자 */
    var n = bits.length, p = Math.max(1.5, Math.min(w, h) * 0.08), bx = x + p, by = y + p, bw = w - 2 * p, bh = h - 2 * p;
    g.fillStyle = '#fff'; g.fillRect(bx, by, bw, bh); g.strokeStyle = '#64748b'; g.lineWidth = 1; g.strokeRect(bx, by, bw, bh);
    g.beginPath(); g.moveTo(bx + bw / 2, by); g.lineTo(bx + bw / 2, by + bh); g.stroke();
    var rh = bh / n, r = Math.max(1, Math.min(rh * 0.36, bw * 0.12));
    for (var k = 0; k < n; k++) {
      var cx = bits[k] ? bx + bw * 0.75 : bx + bw * 0.25;
      if (k === n - 1 && newRowU != null) cx = bx + bw / 2 + (cx - (bx + bw / 2)) * newRowU;
      g.beginPath(); g.arc(cx, by + rh * (k + 0.5), r, 0, 7); g.fillStyle = pcol(k, n); g.fill(); if (r >= 2) { g.lineWidth = r >= 3 ? 1 : 0.6; g.strokeStyle = '#1e293b'; g.stroke(); }
    }
  }
  /* 픽셀 질감 — 화면 픽셀마다 그 자리 칸의 «왼쪽 방 입자 비율» 명암(칸을 하나씩 그리지 않는다) */
  function texture(n, S, spanC, spanR) {
    var dd = DPR(), P = Math.ceil(S * dd), oc = document.createElement('canvas'); oc.width = oc.height = P;
    var og = oc.getContext('2d'), im = og.createImageData(P, P), a = im.data;
    for (var y = 0; y < P; y++) { var pr = C.popc(Math.floor((y + 0.5) / P * spanR));
      for (var x = 0; x < P; x++) { var s = shade((n - C.popc(Math.floor((x + 0.5) / P * spanC)) - pr) / n), q = 4 * (y * P + x); a[q] = s[0]; a[q + 1] = s[1]; a[q + 2] = s[2]; a[q + 3] = 255; } }
    og.putImageData(im, 0, 0); return oc;
  }
  /* 칸 크기에 따라 단계를 줄인다(설계지시안 E-1): ① 상자+입자 ② 칸 명암(+테두리) ③ 픽셀 질감 */
  var TIER = { box: 24, row: 3, cell: 2, grid: 5, zoom: 14 };
  function drawSplit(g, X, Y, S, n, opt) {
    var d = C.splitDims(n), cw = S / d.cols, ch = S / d.rows;
    if (cw >= TIER.box && ch * 0.84 / n >= TIER.row) {
      for (var c = 0; c < d.cols; c++) for (var r = 0; r < d.rows; r++) {
        g.fillStyle = rgb(shade(C.cellLeft(n, c, r) / n * 0.35)); g.fillRect(X + c * cw, Y + r * ch, cw, ch);
        miniBox(g, X + c * cw, Y + r * ch, cw, ch, C.cellBits(n, c, r), opt && opt.newRowU);
        g.strokeStyle = '#94a3b8'; g.lineWidth = 1; g.strokeRect(X + c * cw, Y + r * ch, cw, ch);
      }
      return 1;
    }
    if (cw >= TIER.cell) {
      var key = 't2_' + n + '_' + S;
      if (!T1.cache[key]) {
        var oc = document.createElement('canvas'), dd = DPR(); oc.width = Math.ceil(S * dd); oc.height = Math.ceil(S * dd);
        var og = oc.getContext('2d'); og.setTransform(dd, 0, 0, dd, 0, 0);
        for (var c2 = 0; c2 < d.cols; c2++) for (var r2 = 0; r2 < d.rows; r2++) { og.fillStyle = rgb(shade(C.cellLeft(n, c2, r2) / n)); og.fillRect(c2 * cw, r2 * ch, cw + 0.3, ch + 0.3); }
        if (cw >= TIER.grid) { og.strokeStyle = 'rgba(255,255,255,.75)'; og.lineWidth = 0.8; og.beginPath(); for (var i = 0; i <= d.cols; i++) { og.moveTo(i * cw, 0); og.lineTo(i * cw, S); } for (var j = 0; j <= d.rows; j++) { og.moveTo(0, j * ch); og.lineTo(S, j * ch); } og.stroke(); }
        T1.cache[key] = oc;
      }
      g.drawImage(T1.cache[key], X, Y, S, S); return 2;
    }
    var k3 = 't3_' + n + '_' + S;
    if (!T1.cache[k3]) T1.cache[k3] = texture(n, S, d.cols, d.rows);
    g.drawImage(T1.cache[k3], X, Y, S, S); return 3;
  }
  /* 분포별로 모아 보기 — 무리(왼쪽 방 입자 수)마다 세로 기둥 · 기둥 넓이 = 칸 수(숫자는 띄우지 않는다) */
  var BAND = ['#fde2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#ede9fe'];
  function groupCells(n) { var d = C.splitDims(n), gs = [], k, r, c; for (k = 0; k <= n; k++) gs.push([]); for (r = 0; r < d.rows; r++) for (c = 0; c < d.cols; c++) gs[n - C.cellLeft(n, c, r)].push([c, r]); return gs; }
  function drawGrouped(g, X, Y, W, H, n) {
    var cnt = [], k; for (k = 0; k <= n; k++) cnt.push(Number(C.comb(n, n - k)));
    var mx = Math.max.apply(null, cnt), colW = W / (n + 1), cw = colW * 0.86, chh = Math.min(cw, (H - 8) / mx), gs = n <= 12 ? groupCells(n) : null;
    for (k = 0; k <= n; k++) {
      var x = X + k * colW + (colW - cw) / 2, h = cnt[k] * chh;
      g.fillStyle = BAND[k % BAND.length]; g.fillRect(x - 3, Y + H - h - 4, cw + 6, h + 4);
      if (gs && chh >= 2) {
        gs[k].forEach(function (cr, i) {
          var yy = Y + H - (i + 1) * chh;
          if (cw >= TIER.box && chh * 0.84 / n >= TIER.row) { g.fillStyle = '#fff'; g.fillRect(x, yy, cw, chh); miniBox(g, x, yy, cw, chh, C.cellBits(n, cr[0], cr[1])); g.strokeStyle = '#94a3b8'; g.strokeRect(x, yy, cw, chh); }
          else { g.fillStyle = rgb(shade((n - k) / n)); g.fillRect(x, yy, cw, chh); if (chh >= 4) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.strokeRect(x, yy, cw, chh); } }
        });
      } else { g.fillStyle = rgb(shade((n - k) / n)); g.fillRect(x, Y + H - h, cw, h); }
      if (k === 0) { g.strokeStyle = '#dc2626'; g.lineWidth = Math.max(0.2, Math.min(3, chh / 4)); g.strokeRect(x, Y + H - chh, cw, chh); g.lineWidth = 1; }
    }
    g.fillStyle = '#475569'; g.font = '12px sans-serif'; g.textAlign = 'center';
    var st = n <= 10 ? 1 : n <= 20 ? 2 : 10;
    for (var q = 0; q <= n; q += st) g.fillText(String(n - q), X + (q + 0.5) * colW, Y + H + 14);
    g.fillText('왼쪽 방에 있는 입자 수(개)', X + W / 2, Y + H + 30); g.textAlign = 'left';
  }
  /* 돋보기 — 「모두 왼쪽」 칸(맨 왼쪽 위 구석) */
  function drawZoom(cv, n, level) {
    var Z = 168, g = fit(cv, Z, Z), d = C.splitDims(n); g.clearRect(0, 0, Z, Z);
    if (n === 100) {
      var span = Math.pow(2, 50 - 5 * level), key = 'z100_' + level;
      if (!T1.cache[key]) T1.cache[key] = texture(100, Z, span, span);
      g.drawImage(T1.cache[key], 0, 0, Z, Z);
      g.strokeStyle = '#dc2626'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 10); g.lineTo(6, 6); g.lineTo(10, 26); g.stroke();
      return 0;
    }
    var cw = 30, ch = cw * d.cols / d.rows, sc = Math.min(d.cols, Math.ceil(Z / cw)), sr = Math.min(d.rows, Math.ceil(Z / ch));
    for (var c = 0; c < sc; c++) for (var r = 0; r < sr; r++) {
      g.fillStyle = rgb(shade(C.cellLeft(n, c, r) / n * 0.6)); g.fillRect(c * cw, r * ch, cw, ch);
      if (ch * 0.84 / n >= 1.2) miniBox(g, c * cw, r * ch, cw, ch, C.cellBits(n, c, r));
      g.strokeStyle = '#94a3b8'; g.lineWidth = 1; g.strokeRect(c * cw, r * ch, cw, ch);
    }
    g.strokeStyle = '#dc2626'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, cw - 3, ch - 3);
    return cw / (T1.S / d.cols);
  }
  function drawT1(now) {
    var cv = $('cvSplit'); if (!cv || cv.clientWidth < 60) return;
    var W = cv.clientWidth, H = T1.group ? Math.round(W * 0.78) : Math.min(W, 640), g = fit(cv, W, H);
    g.clearRect(0, 0, W, H);
    var S = Math.min(W, H) - 16, X = Math.round((W - S) / 2), Y = 8, n = T1.n, tier; T1.S = S;
    if (T1.group) { drawGrouped(g, 12, 10, W - 24, H - 52, n); tier = 0; }
    else if (T1.anim && now - T1.anim.t0 < T1.anim.dur) {
      var A = T1.anim, u = (now - A.t0) / A.dur, lo = Math.min(A.from, A.to), hi = Math.max(A.from, A.to), d = C.splitDims(lo), grow = A.to > A.from;
      var sp = grow ? Math.min(1, u / 0.6) : 1 - Math.min(1, u / 0.6);
      if (grow && u > 0.6) tier = drawSplit(g, X, Y, S, hi, { newRowU: Math.min(1, (u - 0.6) / 0.35) });
      else {
        tier = drawSplit(g, X, Y, S, lo, {});
        var vert = hi % 2 === 1, cw = S / d.cols, ch = S / d.rows;   /* 새 입자가 홀수 번째 → 세로선(열이 두 배) · 짝수 → 가로선 */
        if (d.cols * d.rows <= 4096) {
          g.strokeStyle = '#f59e0b'; g.lineWidth = Math.max(2, Math.min(5, Math.min(cw, ch) * 0.05)); g.lineCap = 'round'; g.beginPath();   /* 주황 굵은 선 — 칸 안 상자의 회색 칸막이 선과 구별 */
          for (var c = 0; c < d.cols; c++) for (var r = 0; r < d.rows; r++) {
            if (vert) { var x = X + (c + 0.5) * cw, y0 = Y + (r + 0.5) * ch, L = ch * sp * 0.55; g.moveTo(x, y0 - L); g.lineTo(x, y0 + L); }
            else { var y = Y + (r + 0.5) * ch, x0 = X + (c + 0.5) * cw, L2 = cw * sp * 0.55; g.moveTo(x0 - L2, y); g.lineTo(x0 + L2, y); }
          } g.stroke(); g.lineCap = 'butt';
        } else { g.globalAlpha = sp * 0.5; drawSplit(g, X, Y, S, hi, {}); g.globalAlpha = 1; }
      }
    } else { T1.anim = null; tier = drawSplit(g, X, Y, S, n, {}); }
    var dN = C.splitDims(n);
    if (!T1.group) {   /* 「모두 왼쪽」 칸 — 늘 맨 왼쪽 위 · 참 크기(작아지면 사라진다) */
      var dd2 = C.splitDims(T1.anim ? Math.min(T1.anim.from, T1.anim.to) : n), cw2 = S / dd2.cols, ch2 = S / dd2.rows, lw = Math.min(3, cw2 / 5);
      g.strokeStyle = '#dc2626'; g.lineWidth = lw; g.strokeRect(X + lw / 2, Y + lw / 2, cw2 - lw, ch2 - lw); g.lineWidth = 1;
    }
    cv.setAttribute('data-tier', String(tier)); cv.setAttribute('data-n', String(n));
    cv.setAttribute('data-cells', T1.anim ? '' : (n <= 20 ? String(dN.cols * dN.rows) : '2^' + n));
    var zb = $('zb'); if (!zb) return;
    var need = !T1.group && (S / dN.cols < TIER.zoom || n === 100); zb.hidden = !need; if (!need) return;
    g.strokeStyle = '#dc2626'; g.lineWidth = 2.5; g.beginPath(); g.arc(X, Y, 14, 0, Math.PI * 2); g.stroke();
    var zt = $('zt'), bZ = $('bZ');
    if (n === 100) {
      drawZoom($('cvZ'), 100, T1.zoomL); bZ.hidden = T1.zoomL >= 5;
      zt.innerHTML = '빨간 동그라미(맨 왼쪽 위 구석) 확대 ×' + C.commas(String(Math.pow(32, T1.zoomL))) + '<br>이 창 안의 배치: <b>' + C.fmt(C.pow2(100 - 10 * T1.zoomL)) + '</b>가지<br>' + (T1.zoomL >= 5 ? '여기까지 확대해도 「모두 왼쪽」 칸은 보이지 않습니다.' : '「모두 왼쪽」 칸은 이 구석에 있습니다.');
    } else { var mag = drawZoom($('cvZ'), n, 0); bZ.hidden = true; zt.innerHTML = '빨간 동그라미(맨 왼쪽 위 구석) 확대 ×' + Math.round(mag) + ' — 빨간 테두리가 「모두 왼쪽」 칸'; }
  }
  /* 퍼짐 상자 — 속력은 늘 같고 방향만 무작위로 꺾인다(온도 일정) */
  var SP = { open: false, ps: [] };
  function spReset() { var r = C.rng(500 + T1.n); SP.open = false; SP.ps = []; for (var i = 0; i < T1.n; i++) SP.ps.push({ x: 0.04 + r() * 0.42, y: 0.06 + r() * 0.88, a: r() * 6.28 }); }
  function spStep(dt) { SP.ps.forEach(function (p) { p.a += (Math.random() - 0.5) * 7 * dt; var nx = p.x + Math.cos(p.a) * 0.55 * dt, ny = p.y + Math.sin(p.a) * 1.1 * dt, m = 0.02;
    if (ny < m || ny > 1 - m) { p.a = -p.a; ny = p.y; } if (nx < m || nx > 1 - m) { p.a = Math.PI - p.a; nx = p.x; } if (!SP.open && (p.x < 0.5) !== (nx < 0.5)) { p.a = Math.PI - p.a; nx = p.x; } p.x = nx; p.y = ny; }); }
  function spDraw(cv) {
    var W = cv.clientWidth; if (W < 60) return; var H = Math.round(W * 0.52), g = fit(cv, W, H); g.clearRect(0, 0, W, H);
    var x0 = 8, y0 = 8, w = W - 16 - 46, h = H - 16;
    g.fillStyle = '#f8fafc'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#334155'; g.lineWidth = 2.5; g.strokeRect(x0, y0, w, h);
    g.lineWidth = 3; g.strokeStyle = SP.open ? 'rgba(51,65,85,.2)' : '#334155'; if (SP.open) g.setLineDash([5, 6]); g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h); g.stroke(); g.setLineDash([]);
    var rad = T1.n <= 10 ? 7 : T1.n <= 20 ? 5.5 : 3.6;
    SP.ps.forEach(function (p, k) { g.beginPath(); g.arc(x0 + p.x * w, y0 + p.y * h, rad, 0, 7); g.fillStyle = pcol(k, T1.n); g.fill(); g.lineWidth = 0.8; g.strokeStyle = '#1e293b'; g.stroke(); });   /* 퍼짐 상자도 분할 화면과 같은 색(8개 이하) */
    var tx = W - 22, ty = y0 + 26; g.fillStyle = '#334155'; g.font = '600 12px sans-serif'; g.textAlign = 'center'; g.fillText('25 ℃', tx, ty - 8); g.textAlign = 'left';
    g.fillStyle = '#fff'; g.strokeStyle = '#334155'; g.lineWidth = 1.3; g.beginPath(); g.rect(tx - 5, ty, 10, 56); g.fill(); g.stroke(); g.beginPath(); g.arc(tx, ty + 63, 8, 0, 7); g.fillStyle = '#ef4444'; g.fill(); g.stroke(); g.fillStyle = '#ef4444'; g.fillRect(tx - 2.5, ty + 26, 5, 34);
    var k = 0; SP.ps.forEach(function (p) { if (p.x < 0.5) k++; }); var e = $('spK'); if (e) e.textContent = '왼쪽 방 ' + k + '개 · 오른쪽 방 ' + (T1.n - k) + '개';
  }

  /* ═══════════════ 탭 ② 2D 운동 + 3D 보조 ═══════════════ */
  var ST = ['solid', 'liquid', 'gas'], SNAME = { solid: '고체', liquid: '액체', gas: '기체' }, sel = 'solid', view2 = '2d', trailOn = true;
  var ALLOW = { solid: [27, 28, 33, 34], liquid: [30, 31, 32, 33, 34, 35] };
  function allowed(s) { if (ALLOW[s]) return ALLOW[s]; var a = []; for (var i = 0; i < 36; i++) a.push(i); return a; }
  function count2(s) { var g = C.gridScenes(); return s === 'solid' ? g.solid : s === 'liquid' ? g.liquid : g.gas; }
  var M2 = {};
  function m2Reset() {
    var r = C.rng(77);
    ST.forEach(function (s) { var al = allowed(s), st = al.length > 4 ? Math.floor(al.length / 4) : 1, ps = [];
      for (var i = 0; i < 4; i++) { var c = al[i * st]; ps.push({ x: c % 6 + 0.5, y: Math.floor(c / 6) + 0.5, hx: c % 6 + 0.5, hy: Math.floor(c / 6) + 0.5, a: r() * 6.28 }); }
      M2[s] = { ps: ps, trail: [] }; });
  }
  function m2Step(dt, t) {
    ST.forEach(function (s) {
      var m = M2[s];
      if (s === 'solid') m.ps.forEach(function (p, i) { p.x = p.hx + 0.07 * Math.sin(t * 19 + i * 2.1); p.y = p.hy + 0.07 * Math.sin(t * 16.3 + i * 1.3); });
      else if (s === 'liquid') {
        /* 액체: 바닥 한 줄(갈 수 있는 6칸) 안에서만 — 서로 붙은 채 미끄러지고, 부딪히면 튕긴다(겹치지 않는다).
           (전 판은 2차원 밀어내기와 벽 고정이 싸워 구석에 뭉치고 줄 위로 삐져나왔다 — 사용자 지적 11-01) */
        var LQ_MIN = 1.0, LQ_L = 0.36, LQ_R = 5.64;   /* 중심 간격 1칸 이상 = 늘 서로 다른 칸(«한 칸에 입자 하나» — S-검토 B-1) · 벽 안쪽 */
        m.ps.forEach(function (p, i) {
          if (p.v == null) p.v = (i % 2 ? 1 : -1) * 0.8;
          p.v += (Math.random() - 0.5) * 3 * dt; p.v *= 1 - 0.15 * dt; p.v = Math.max(-1.4, Math.min(1.4, p.v));
          if (Math.abs(p.v) < 0.35) p.v = (p.v < 0 ? -1 : 1) * 0.35;   /* 멈춰 서지 않게 — 늘 조금씩 움직인다 */
          p.x += p.v * dt; p.y = 5.5 + 0.05 * Math.sin(t * 13 + i * 2.3);
        });
        var srt = m.ps.slice().sort(function (u, w) { return u.x - w.x; });
        for (var it = 0; it < 4; it++) {
          if (srt[0].x < LQ_L) { srt[0].x = LQ_L; srt[0].v = Math.abs(srt[0].v); }
          if (srt[3].x > LQ_R) { srt[3].x = LQ_R; srt[3].v = -Math.abs(srt[3].v); }
          for (var q = 0; q < 3; q++) { var A = srt[q], B = srt[q + 1], gap = B.x - A.x;
            if (gap < LQ_MIN) { var mid = (A.x + B.x) / 2; A.x = mid - LQ_MIN / 2; B.x = mid + LQ_MIN / 2; var tv = A.v; A.v = B.v; B.v = tv; } }   /* 같은 질량 1차원 충돌 = 속도 교환 */
        }
        m.ps.forEach(function (p) { p.x = Math.max(LQ_L, Math.min(LQ_R, p.x)); });
      } else {
        /* 기체: 용기 전체를 빠르게 곧게 날다 벽·서로에게 튕긴다(겹쳐 지나가지 않는다 — «한 칸에 입자 하나»와 맞게 · 11-01) */
        m.ps.forEach(function (p) { if (p.vx == null) { p.vx = Math.cos(p.a) * 4.2; p.vy = Math.sin(p.a) * 4.2; }
          var ox = p.x, oy = p.y, nx2 = p.x + p.vx * dt, ny2 = p.y + p.vy * dt, cNew = Math.floor(ny2) * 6 + Math.floor(nx2), cOld = Math.floor(oy) * 6 + Math.floor(ox);
          if (cNew !== cOld && m.ps.some(function (q) { return q !== p && Math.floor(q.y) * 6 + Math.floor(q.x) === cNew; })) { if (Math.floor(nx2) !== Math.floor(ox)) p.vx = -p.vx; if (Math.floor(ny2) !== Math.floor(oy)) p.vy = -p.vy; }   /* 칸 배제(S-검토 B-1) */
          else { p.x = nx2; p.y = ny2; }
          if (p.x < 0.3) { p.x = 0.3; p.vx = Math.abs(p.vx); } if (p.x > 5.7) { p.x = 5.7; p.vx = -Math.abs(p.vx); } if (p.y < 0.3) { p.y = 0.3; p.vy = Math.abs(p.vy); } if (p.y > 5.7) { p.y = 5.7; p.vy = -Math.abs(p.vy); } });
        for (var gi = 0; gi < 4; gi++) for (var gj = gi + 1; gj < 4; gj++) { var P1 = m.ps[gi], P2 = m.ps[gj], ddx = P2.x - P1.x, ddy = P2.y - P1.y, dd2 = Math.sqrt(ddx * ddx + ddy * ddy), GMIN = 0.66;
          if (dd2 < GMIN && dd2 > 1e-6) { var nx = ddx / dd2, ny = ddy / dd2, push = (GMIN - dd2) / 2; P1.x -= nx * push; P1.y -= ny * push; P2.x += nx * push; P2.y += ny * push;
            var v1 = P1.vx * nx + P1.vy * ny, v2 = P2.vx * nx + P2.vy * ny; if (v1 - v2 > 0) { P1.vx += (v2 - v1) * nx; P1.vy += (v2 - v1) * ny; P2.vx += (v1 - v2) * nx; P2.vy += (v1 - v2) * ny; } } }   /* 같은 질량 탄성 충돌 — 법선 방향 속도 교환 */
        m.ps.forEach(function (p) { p.x = Math.max(0.3, Math.min(5.7, p.x)); p.y = Math.max(0.3, Math.min(5.7, p.y)); });   /* 충돌로 밀린 뒤 벽 한 번 더(C-3) */
      }
      m.trail.push([m.ps[0].x, m.ps[0].y]); if (m.trail.length > 260) m.trail.shift();
    });
  }
  function m2Draw(cv, s) {
    var W = cv.clientWidth; if (W < 60) return; var g = fit(cv, W, W), mm = 6, cs = (W - 2 * mm) / 6, al = {};
    allowed(s).forEach(function (c) { al[c] = 1; }); g.clearRect(0, 0, W, W);
    for (var c = 0; c < 36; c++) { var x = mm + (c % 6) * cs, y = mm + Math.floor(c / 6) * cs; g.fillStyle = al[c] ? '#d1fae5' : '#f8fafc'; g.fillRect(x, y, cs, cs); g.strokeStyle = '#d5dde8'; g.lineWidth = 1; g.strokeRect(x, y, cs, cs); }
    g.strokeStyle = '#334155'; g.lineWidth = 2.5; g.strokeRect(mm, mm, 6 * cs, 6 * cs);
    if (trailOn) { var T = M2[s].trail; g.strokeStyle = '#f59e0b'; g.lineWidth = 2; g.beginPath(); T.forEach(function (p, i) { var X = mm + p[0] * cs, Y = mm + p[1] * cs; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); }
    M2[s].ps.forEach(function (p, i) { g.beginPath(); g.arc(mm + p.x * cs, mm + p.y * cs, cs * 0.3, 0, 7); g.fillStyle = '#2563eb'; g.fill(); var hl = i === 0 && trailOn; g.lineWidth = hl ? 3 : 1.3; g.strokeStyle = hl ? '#b45309' : '#1e293b'; g.stroke(); });
    cv.setAttribute('data-particles', String(M2[s].ps.length));
  }
  var V3 = null, sel3 = 'ice';
  function build3D() {
    if (V3) return V3;
    var THREE = window.THREE; THREE.ColorManagement.legacyMode = false;
    var ice = C.iceIh({ seed: 7 }), vol = C.iceVolume(ice), N = ice.mols.length, liq = C.liquid(N, vol, 11), R = { O: 0.3, H: 0.17 };
    function mkView() { var cv = document.createElement('canvas'), ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); ren.setPixelRatio(DPR()); ren.setClearColor(0xffffff, 1); ren.outputEncoding = THREE.sRGBEncoding;
      var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(12, 1, 0.1, 2000); sc.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9)); var dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(3, 5, 8); sc.add(dl);
      var root = new THREE.Group(); sc.add(root); return { cv: cv, ren: ren, sc: sc, cam: cam, root: root }; }
    var sphO = new THREE.SphereGeometry(1, 16, 12), sphH = new THREE.SphereGeometry(1, 10, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
    /* 원자 색 = CPK 관례(O 빨강 · H 흰색 — 교과서 그림 Ⅲ-10 확대 원과 같은 표현) */
    var mO = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.45 }), mH = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 }), mB = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, roughness: 0.6 });
    function molSet(v, n) { var o = new THREE.InstancedMesh(sphO, mO, n), h = new THREE.InstancedMesh(sphH, mH, 2 * n), b = new THREE.InstancedMesh(cyl, mB, 2 * n); v.root.add(o); v.root.add(h); v.root.add(b); v.im = { o: o, h: h, b: b }; }
    var M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), D = new THREE.Vector3();
    function setMol(v, i, O, H1, H2) { var im = v.im; M4.compose(P.set(O[0], O[1], O[2]), Q.identity(), S.set(R.O, R.O, R.O)); im.o.setMatrixAt(i, M4);
      [H1, H2].forEach(function (Hh, j) { M4.compose(P.set(Hh[0], Hh[1], Hh[2]), Q.identity(), S.set(R.H, R.H, R.H)); im.h.setMatrixAt(2 * i + j, M4); D.set(Hh[0] - O[0], Hh[1] - O[1], Hh[2] - O[2]); var len = D.length(); D.normalize(); Q.setFromUnitVectors(UP, D); M4.compose(P.set((Hh[0] + O[0]) / 2, (Hh[1] + O[1]) / 2, (Hh[2] + O[2]) / 2), Q, S.set(0.06, len, 0.06)); im.b.setMatrixAt(2 * i + j, M4); }); }
    function flush(v) { v.im.o.instanceMatrix.needsUpdate = v.im.h.instanceMatrix.needsUpdate = v.im.b.instanceMatrix.needsUpdate = true; }
    var OH = ice.oh, HALF = 104.5 / 2 * Math.PI / 180;
    function molAtoms(c, q) { var h1 = new THREE.Vector3(Math.sin(HALF) * OH, Math.cos(HALF) * OH, 0).applyQuaternion(q), h2 = new THREE.Vector3(-Math.sin(HALF) * OH, Math.cos(HALF) * OH, 0).applyQuaternion(q); return [c, [c[0] + h1.x, c[1] + h1.y, c[2] + h1.z], [c[0] + h2.x, c[1] + h2.y, c[2] + h2.z]]; }
    var views = { ice: mkView(), liq: mkView(), gas: mkView() };
    molSet(views.ice, N); var hp = [];
    ice.hbonds.forEach(function (e) { var A = ice.mols[e[0]], B = ice.mols[e[1]], best = null, bd = 1e9; A.H.forEach(function (Hh) { var dd = Math.pow(B.O[0] - Hh[0], 2) + Math.pow(B.O[1] - Hh[1], 2) + Math.pow(B.O[2] - Hh[2], 2); if (dd < bd) { bd = dd; best = Hh; } }); hp.push(best[0], best[1], best[2], B.O[0], B.O[1], B.O[2]); });
    var hbG = new THREE.BufferGeometry(); hbG.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); var hbL = new THREE.LineSegments(hbG, new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.09, gapSize: 0.07 })); hbL.computeLineDistances(); views.ice.root.add(hbL);
    var rq = C.rng(99); function rq4() { return new THREE.Quaternion().setFromEuler(new THREE.Euler(rq() * 6.28, rq() * 6.28, rq() * 6.28)); }
    molSet(views.liq, N); var LQ = liq.pts.map(function (p) { return { p: p.slice(), q: rq4(), w: new THREE.Vector3(rq() - 0.5, rq() - 0.5, rq() - 0.5).normalize() }; });
    var GB = vol.w * 3; molSet(views.gas, N);   /* 같은 분자 수 — 수증기 용기 한 변 3배로 줄여 그림(설계지시안 E-9) */
    views.gas.root.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(GB, GB, GB * 0.5)), new THREE.LineBasicMaterial({ color: 0x94a3b8 })));
    var gr = C.rng(5), GAS = []; for (var i = 0; i < N; i++) { var a = gr() * 6.28, b = Math.acos(2 * gr() - 1); GAS.push({ p: [(gr() - 0.5) * GB * 0.9, (gr() - 0.5) * GB * 0.9, (gr() - 0.5) * GB * 0.45], v: [Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)], q: rq4(), w: new THREE.Vector3(gr() - 0.5, gr() - 0.5, gr() - 0.5).normalize() }); }
    views.ice.size = views.liq.size = Math.max(vol.w, vol.h) * 1.1; views.gas.size = GB * 1.1;
    var rot = { yaw: 0, pitch: 0 };
    Object.keys(views).forEach(function (k) { var v = views[k], drag = null, moved = 0;
      v.cv.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY]; moved = 0; });
      v.cv.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag[0], dy = e.clientY - drag[1]; moved += Math.abs(dx) + Math.abs(dy); rot.yaw += dx * 0.01; rot.pitch = Math.max(-1.5, Math.min(1.5, rot.pitch + dy * 0.01)); drag = [e.clientX, e.clientY]; });
      v.cv.addEventListener('pointerup', function () { drag = null; if (moved < 6 && sel3 !== k) { sel3 = k; place3D(); } }); });
    function step(dt, t) {
      var amp = RM ? 0.012 : 0.035;
      ice.mols.forEach(function (m, i) { var ox = amp * Math.sin(t * 9 + i * 1.7), oy = amp * Math.sin(t * 8.3 + i * 2.3), oz = amp * Math.sin(t * 7.7 + i * 0.9); setMol(views.ice, i, [m.O[0] + ox, m.O[1] + oy, m.O[2] + oz], [m.H[0][0] + ox, m.H[0][1] + oy, m.H[0][2] + oz], [m.H[1][0] + ox, m.H[1][1] + oy, m.H[1][2] + oz]); }); flush(views.ice);
      var bw = liq.box.w / 2 - 0.3, bh = liq.box.h / 2 - 0.3, bd = liq.box.dep / 2 - 0.3, gg = C.LIQ.minGap;
      LQ.forEach(function (m) { for (var k = 0; k < 3; k++) m.p[k] += (Math.random() - 0.5) * 0.9 * dt; });
      for (var i = 0; i < LQ.length; i++) for (var j = i + 1; j < LQ.length; j++) { var A = LQ[i].p, B = LQ[j].p, dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], dd = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dd < gg && dd > 1e-6) { var f = (gg - dd) / dd * 0.5; A[0] -= dx * f; A[1] -= dy * f; A[2] -= dz * f; B[0] += dx * f; B[1] += dy * f; B[2] += dz * f; } }
      LQ.forEach(function (m, i) { m.p[0] = Math.max(-bw, Math.min(bw, m.p[0])); m.p[1] = Math.max(-bh, Math.min(bh, m.p[1])); m.p[2] = Math.max(-bd, Math.min(bd, m.p[2])); m.q.multiply(new THREE.Quaternion().setFromAxisAngle(m.w, dt * 1.5)); var at = molAtoms(m.p, m.q); setMol(views.liq, i, at[0], at[1], at[2]); }); flush(views.liq);
      var hb = GB / 2 - 0.3; GAS.forEach(function (m, i) { for (var k = 0; k < 3; k++) { m.p[k] += m.v[k] * 3.2 * dt; var lim = k === 2 ? GB * 0.25 - 0.3 : hb; if (m.p[k] > lim) { m.p[k] = lim; m.v[k] = -Math.abs(m.v[k]); } if (m.p[k] < -lim) { m.p[k] = -lim; m.v[k] = Math.abs(m.v[k]); } } m.q.multiply(new THREE.Quaternion().setFromAxisAngle(m.w, dt * 4)); var at = molAtoms(m.p, m.q); setMol(views.gas, i, at[0], at[1], at[2]); }); flush(views.gas);
    }
    function draw() { Object.keys(views).forEach(function (k) { var v = views[k]; if (!v.cv.isConnected || v.cv.clientWidth < 60) return; var W = v.cv.clientWidth, H = Math.round(W * 0.76);
      if (v.w !== W) { v.w = W; v.ren.setSize(W, H, false); v.cam.aspect = W / H; v.cam.updateProjectionMatrix(); v.cv.style.height = H + 'px'; }
      var dist = v.size / (2 * Math.tan(v.cam.fov * Math.PI / 360)) * 1.12; v.cam.position.set(dist * Math.sin(rot.yaw) * Math.cos(rot.pitch), dist * Math.sin(rot.pitch), dist * Math.cos(rot.yaw) * Math.cos(rot.pitch)); v.cam.lookAt(0, 0, 0); v.ren.render(v.sc, v.cam); }); }
    V3 = { views: views, step: step, draw: draw, rot: rot, N: N }; return V3;
  }
  function place3D() { var host = $('v3'); if (!host || !V3) return; host.innerHTML = ''; var lab = { ice: '얼음', liq: '물', gas: '수증기' };
    [sel3].concat(['ice', 'liq', 'gas'].filter(function (k) { return k !== sel3; })).forEach(function (k, i) { var d = document.createElement('div'); d.className = 'vw' + (i === 0 ? ' main' : ''); d.appendChild(V3.views[k].cv); var l = document.createElement('span'); l.className = 'lab'; l.textContent = lab[k] + (i ? ' — 눌러서 크게' : ''); d.appendChild(l); host.appendChild(d); V3.views[k].w = 0; }); }

  /* ═══════════════ 탭 ③ 기체 반응(한 시계) + 혼합 ═══════════════ */
  /* 반응 연출 = core RXC(사용자 결정 D-9 · 11-01): 분자 4개가 모여 부딪치고, 맞닿은 동안 옛 결합이 옅어지며 새 결합이 생긴다 */
  /* 4 × 4 = 16칸 격자(의뢰서 v1.1 §3 탭 3 — 학습지 활동 3과 같은 격자) · 진행 제어 = core §9 RxRun(모이기·멈춤·넘겨주기) */
  var RX = new C.RxRun(RM);
  var LOCAL = C.MOL.LOCAL, nh3Local = C.MOL.nh3Local;   /* 분자 치수 = core §8(운동기 발자국과 한 원천) */
  function rxSample(t) {   /* 시간 → 원자 자리·결합 막대·분자 수·가짓수·문장(전부 같은 시계 — core rxAtoms) */
    var s = C.rxAtoms(t), g = C.grid3Scenes(), T = C.RXC.T;
    /* 가짓수는 분자가 칸에 하나씩 흩어져 돌아다닐 때만 — [반응시키기]를 누른 뒤(모이기·다가가기·충돌)는 «—» */
    s.mols4 = t >= T.end ? 2 : t < T.hit ? 4 : null; s.count = t >= T.end ? g.products : null;
    s.phase = t >= T.end ? '반응 후 — 기체 분자 2개' : t < Math.min(T.a0, T.b0) ? '분자들이 한곳으로 모여 부딪칩니다' : '부딪친 채로 결합이 끊어지면서 새 결합이 생깁니다';   /* 결합이 실제로 바뀌기 시작할 때 문장도 바뀜(S-검토 R4 C-2) */
    return s;
  }
  var REAC_SNAP = { mols4: 4, count: null, phase: '반응 전 — 기체 분자 4개', whole: 'reac' };   /* 반응 전(자유 운동) 표시 — 가짓수는 아래에서 */
  REAC_SNAP.count = C.grid3Scenes().reactants;
  function atom(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 1.3; g.strokeStyle = '#1e293b'; g.stroke(); }
  /* 4 × 4 격자 · 칸막이는 2열과 3열 사이(양쪽 8칸 — 의뢰서 v1.1) */
  function grid4(g, m, s, partitionY) {
    for (var c = 0; c < 16; c++) { var x = m + (c % 4) * s, y = m + Math.floor(c / 4) * s; g.fillStyle = '#f8fafc'; g.fillRect(x, y, s, s); g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.strokeRect(x, y, s, s); }
    g.strokeStyle = '#334155'; g.lineWidth = 2.5; g.strokeRect(m, m, 4 * s, 4 * s);
    if (partitionY != null) { g.lineWidth = 5; g.beginPath(); g.moveTo(m + 2 * s, m + partitionY); g.lineTo(m + 2 * s, m + 4 * s); g.stroke(); }
  }
  /* 분자 기호 = 학습지 그림과 같게(의뢰서 v1.1): N₂ 검은 원 2개 · H₂ 흰 작은 원 2개 · NH₃ 회색 큰 원 + 흰 작은 원 3개 · ㉮ 검은 원 · ㉯ 흰 원
     (원소 색(CPK)이 아니라 흑백 학습지 기호 — 학생이 지면 그림과 1:1로 맞춰 본다) */
  var SYM = { N: '#1f2937', NH3: '#9ca3af', H: '#ffffff', A: '#1f2937', B: '#ffffff' };
  function mixHex(a, b, u) { var p = function (h, i) { return parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16); }; var o = '#'; for (var i = 0; i < 3; i++) { var v = Math.round(p(a, i) + (p(b, i) - p(a, i)) * u).toString(16); o += v.length < 2 ? '0' + v : v; } return o; }
  function rxRender(snap, now) {
    now = now || performance.now();
    var hop = RX.hop(), H = RX.mover();
    if (RX.mode === 'reac') snap = REAC_SNAP; else if (RX.mode === 'gather' || RX.mode === 'gpause') snap = rxSample(0);
    var cv = $('cvRx'); if (cv && cv.clientWidth >= 60) {
      var W = cv.clientWidth, g = fit(cv, W, W), m = 10, s = (W - 2 * m) / 4; g.clearRect(0, 0, W, W); grid4(g, m, s, null);
      var P = function (a) { return [m + a.x * s, m + a.y * s]; };
      /* 초록 칸 = 온전한 분자 모형의 50 % 넘게가 들어간 칸(결합이 끊긴 중간에는 비운다 — 숫자가 «—»인 것과 같은 규칙) */
      var occ = hop ? H.green() : snap.mols ? greenOf(snap.mols) : [];
      greenCells(g, m, s, occ); cv.setAttribute('data-green', String(occ.length)); cv.setAttribute('data-occ', occ.slice().sort(function (a, b) { return a - b; }).join(','));
      if (hop) { H.items.forEach(function (it) { drawMol(g, it.sp, m + it.x * s, m + it.y * s, s, it.th); }); }
      else if (snap.mols) { snap.mols.forEach(function (it) { drawMol(g, it.sp, m + it.x * s, m + it.y * s, s); }); }   /* 맞닿기 전 — 온전한 분자가 다가간다 */
      else {
      function stick(i, j, al) { if (al <= 0.02) return; var a = P(snap.atoms[i]), b = P(snap.atoms[j]); g.globalAlpha = al; g.strokeStyle = '#64748b'; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.globalAlpha = 1; }
        /* 옛 결합(같은 반응물 분자) · 새 결합(같은 NH₃의 N–H) — 맞닿은 동안 둘이 겹쳐 바뀐다 */
        snap.atoms.forEach(function (a, i) { snap.atoms.forEach(function (c, j) { if (j <= i) return; if (a.mol0 === c.mol0) stick(i, j, snap.bondOld); if (a.mol1 === c.mol1 && (a.el === 'N') !== (c.el === 'N')) stick(i, j, snap.bondNew); }); });
        /* N 원자: 반응 전 N₂의 검은 원 → 생성물이 만들어지는 동안 NH₃의 회색 큰 원으로(학습지 기호) */
        snap.atoms.forEach(function (a) { var p = P(a); atom(g, p[0], p[1], s * a.r, a.el === 'N' ? mixHex(SYM.N, SYM.NH3, snap.fm) : SYM.H); });
      }
    }
    var e1 = $('eqL'), e2 = $('eqR'); if (e1) { e1.className = RX.mode === 'reac' ? 'on' : ''; e2.className = RX.mode === 'prod' ? 'on' : ''; }
    if ($('rxPhase')) $('rxPhase').textContent = snap.phase;   /* 모이는 중에도 «분자들이 한곳으로 모여 부딪칩니다» */
    if ($('rxMols')) { $('rxMols').textContent = snap.mols4 == null ? '—' : snap.mols4 + '개'; $('rxCnt').textContent = snap.count == null ? '—' : C.fmt(snap.count); }
    if ($('rxT')) $('rxT').value = String(Math.round(RX.t));
    var bl = RX.label(), bb = $('bRx'); if (bb && bb.textContent !== bl) bb.textContent = bl;   /* 모이는 중·반응 중 = 멈춤 */
    if (cv) cv.setAttribute('data-mols', hop ? JSON.stringify(H.items.map(function (it) { return [it.sp, +it.x.toFixed(4), +it.y.toFixed(4), it.th == null ? null : +it.th.toFixed(4)]; })) : '');   /* 프로브가 50 % 규칙을 따로 계산해 초록 칸과 견준다 */
  }
  /* 한 칸에 그린 분자 기호(정지 배치 · 혼합용) */
  function drawMol(g, sp, x, y, s, th) {
    function bar(x0, y0, x1, y1) { g.strokeStyle = '#64748b'; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    if (sp === 'N2') { var a = LOCAL.N2[1][0] * s; bar(x - a, y, x + a, y); atom(g, x - a, y, s * 0.15, SYM.N); atom(g, x + a, y, s * 0.15, SYM.N); }
    if (sp === 'H2') { var b = LOCAL.H2[1][0] * s; bar(x - b, y, x + b, y); atom(g, x - b, y, s * 0.1, SYM.H); atom(g, x + b, y, s * 0.1, SYM.H); }
    if (sp === 'NH3') { var loc = nh3Local(th == null ? Math.PI / 3 : th), k; for (k = 1; k < 4; k++) bar(x, y, x + loc[k][0] * s, y + loc[k][1] * s); for (k = 1; k < 4; k++) atom(g, x + loc[k][0] * s, y + loc[k][1] * s, s * 0.1, SYM.H); atom(g, x, y, s * 0.21, SYM.NH3); }
    if (sp === 'A') atom(g, x, y, s * 0.3, SYM.A);
    if (sp === 'B') atom(g, x, y, s * 0.3, SYM.B);
  }
  /* 연속 운동기 — 분자는 상자 안을 곧게 날다 벽·서로에게 튕긴다(사용자 지시 11-01: «체스말처럼 말고 자유롭게»)
     초록 칸 = 그 칸에 분자 모형(원자 원들의 넓이)의 GREEN_FRAC 넘게가 들어간 칸 — 원자 원 안에 미리 깐 표본점의 비율로 잰다.
     50 %는 분자 하나가 두 칸을 동시에 초록으로 만들 수 없는 가장 낮은 기준이다. 경계를 지나는 중이면 잠깐 초록이 없다.
     분자 중심이 이미 다른 분자 중심이 있는 칸으로 들어가려 하면 튕긴다 → 한 칸에 분자 하나(초록 칸 수 ≤ 분자 수). */
  var CELL_GREEN = '#bbf7d0', GREEN_FRAC = C.MOL.GREEN_FRAC, MOV_SPEED = C.MOL.MOV_SPEED;
  var FOOT_CACHE = null, footOf = C.MOL.footOf, FOOT = C.MOL.FOOT, mainCell = C.MOL.mainCell, greenOf = C.MOL.greenOf, Mover = C.MOL.Mover, cellOf = C.MOL.cell4;   /* 운동기·50 % 규칙 = core §8 */
  function greenCells(g, m, s, cells) { g.fillStyle = CELL_GREEN; cells.forEach(function (c) { g.fillRect(m + (c % 4) * s + 1, m + Math.floor(c / 4) * s + 1, s - 2, s - 2); }); }
  /* 「다른 배치 보기」 — 같은 규칙(한 칸에 한 개)의 무작위 배치 하나(의뢰서 v1.1 권장 · 학생이 지면에 그린 배치와 견준다) */
  var RND = C.rng(2026);
  function randomCells(k, pool) { var a = pool.slice(), o = []; for (var i = 0; i < k; i++) { var j = Math.floor(RND() * a.length); o.push(a[j]); a.splice(j, 1); } return o; }
  var ALL16 = []; for (var q16 = 0; q16 < 16; q16++) ALL16.push(q16);
  var LEFT8 = ALL16.filter(function (c) { return c % 4 < 2; }), RIGHT8 = ALL16.filter(function (c) { return c % 4 >= 2; });
  function Grid() { this.phase = 0; this.liftAt = 0; this.mov = new Mover([], C.rng(41)); this.reset(); }
  Grid.prototype.reset = function () { this.mov.set([{ c: 0, sp: 'A' }, { c: 9, sp: 'A' }, { c: 3, sp: 'B' }, { c: 14, sp: 'B' }]); };
  Grid.prototype.count = function () { var g = C.grid3Scenes(); return this.phase === 0 ? g.mixBefore : g.mixAfter; };
  Grid.prototype.shuffle = function () { this.mov.shuffle(this.phase === 0 ? randomCells(2, LEFT8).concat(randomCells(2, RIGHT8)) : randomCells(4, ALL16)); };
  Grid.prototype.step = function (dt, partitionUp) { this.mov.step(dt, { part: partitionUp }); };   /* 칸막이(2열·3열 사이)가 서 있으면 못 넘는다 */
  var GM = new Grid(), sub3 = 'rx';

  function drawMix(cv, now) {
    if (cv.clientWidth < 60) return; var W = cv.clientWidth, g = fit(cv, W, W), m = 10, s = (W - 2 * m) / 4; g.clearRect(0, 0, W, W);
    var lift = GM.phase === 0 ? 0 : (RM ? 1 : Math.min(1, (now - GM.liftAt) / 600));
    grid4(g, m, s, null); var occ = GM.mov.green(); greenCells(g, m, s, occ);
    if (lift < 1) { g.strokeStyle = '#334155'; g.lineWidth = 5; g.beginPath(); g.moveTo(m + 2 * s, m + lift * 4 * s); g.lineTo(m + 2 * s, m + 4 * s); g.stroke(); }
    GM.mov.items.forEach(function (it) { drawMol(g, it.sp, m + it.x * s, m + it.y * s, s); });
    cv.setAttribute('data-green', String(occ.length)); cv.setAttribute('data-occ', occ.slice().sort(function (a, b) { return a - b; }).join(','));
    cv.setAttribute('data-mols', JSON.stringify(GM.mov.items.map(function (it) { return [it.sp, +it.x.toFixed(4), +it.y.toFixed(4), null]; })));
  }

  /* ═══════════════ 탭 ④ 세 용기 — Astra 그림(ENTROPY_ART) + 상태는 여기서 ═══════════════ */
  /* 순서·표지 = 학습지 활동 4 표(의뢰서 v1.1): (가) 보온병 · (나) 뚜껑을 닫은 컵 · (다) 뚜껑을 열어 둔 컵 — 화면에 O/X 글자는 띄우지 않는다(사용자 결정 11-01) */
  var KINDS = ['flask', 'lid', 'open'], VNAME = { flask: '(가) 보온병', lid: '(나) 뚜껑을 닫은 컵', open: '(다) 뚜껑을 열어 둔 컵' };
  var T4 = { hot: true, run: { open: null, lid: null, flask: null }, stopAt: { open: 0, lid: 0, flask: 0 } };
  function frac(x) { return x - Math.floor(x); }
  function hsh(i) { return frac(Math.sin(i * 127.1 + 311.7) * 43758.5453); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function wallX(geo, y, side) { var best = null; geo.wall.forEach(function (s) { var y0 = Math.min(s.y0, s.y1), y1 = Math.max(s.y0, s.y1); if (y < y0 || y > y1 || y1 - y0 < 1) return; var x = s.x0 + (s.x1 - s.x0) * (y - s.y0) / (s.y1 - s.y0); if (best == null || (side < 0 ? x < best : x > best)) best = x; }); return best; }
  /* 한 용기의 입자 — 경과 시간 el(초)만으로 정해진다(§15 상태·표현 분리: 이 함수는 그림 자리만 낸다) */
  function vesselSample(kind, geo, box, el, hot) {
    var W = geo.water, inn = geo.inner, mols = [], steams = [], grains = [], i;
    for (i = 0; i < 6; i++) mols.push({ x: W.x + W.w * (0.5 + 0.36 * Math.sin(el * 0.7 + i * 2.1) * Math.cos(el * 0.31 + i)), y: W.y + W.h * (0.52 + 0.36 * Math.sin(el * 0.53 + i * 1.3)), a: el * 0.8 + i });
    if (el <= 0) return { mols: mols, steams: steams, grains: grains };
    for (i = 0; i < 3; i++) {   /* 물질: 수면을 떠나는 분자 */
      var u = frac(el / 3.2 + i / 3), x0 = W.x + W.w * (0.25 + 0.5 * hsh(i + Math.floor(el / 3.2 + i / 3) * 7));
      if (kind === 'open') { var yTop = geo.mouth.y;
        if (u < 0.62) mols.push({ x: x0 + 6 * Math.sin(u * 9), y: lerp(geo.surfaceY - 4, yTop - 34, u / 0.62), a: u * 5 });
        if (hot && u > 0.45) steams.push({ x: x0 + 4, y: lerp(yTop - 10, yTop - 70, (u - 0.45) / 0.55), phase: (u - 0.45) / 0.55, size: 22, seed: i + 1 });
      } else { var top = inn.y + 10, yy = u < 0.45 ? lerp(geo.surfaceY - 4, top, u / 0.45) : u < 0.9 ? lerp(top, geo.surfaceY - 4, (u - 0.45) / 0.45) : -1; if (yy > 0) mols.push({ x: x0 + 6 * Math.sin(u * 9), y: yy, a: u * 5 }); }
    }
    for (i = 0; i < 6; i++) {   /* 에너지 알갱이 */
      var v = frac(el / 2.6 + i / 6), side = i % 2 ? 1 : -1, yW = W.y + W.h * (0.2 + 0.6 * hsh(i * 3 + Math.floor(el / 2.6 + i / 6)));
      var xin = W.x + W.w * (0.5 + side * 0.18), wx = wallX(geo, yW, side); if (wx == null) wx = side < 0 ? box.x : box.x + box.w;
      var p, alpha = 1;
      if (hot) {
        if (kind === 'flask') { var ix = side < 0 ? inn.x + 6 : inn.x + inn.w - 6; p = v < 0.5 ? [lerp(xin, ix, v / 0.5), yW] : [lerp(ix, xin, (v - 0.5) / 0.5), yW + 10 * (v - 0.5)]; }
        else if (kind === 'open' && i % 3 === 0) { p = [xin + 10 * Math.sin(v * 6), lerp(geo.surfaceY, geo.mouth.y - 60, v)]; alpha = v < 0.75 ? 1 : (1 - v) / 0.25; }
        else { p = v < 0.5 ? [lerp(xin, wx, v / 0.5), yW] : [lerp(wx, wx + side * 60, (v - 0.5) / 0.5), yW]; alpha = v < 0.7 ? 1 : (1 - v) / 0.3; }
      } else {
        if (kind === 'flask') { var ox = side < 0 ? box.x - 4 : box.x + box.w + 4; p = v < 0.5 ? [lerp(ox + side * 60, ox, v / 0.5), yW] : [lerp(ox, ox + side * 60, (v - 0.5) / 0.5), yW]; alpha = v < 0.15 ? v / 0.15 : v > 0.85 ? (1 - v) / 0.15 : 1; }
        else { p = v < 0.5 ? [lerp(wx + side * 60, wx, v / 0.5), yW] : [lerp(wx, xin, (v - 0.5) / 0.5), yW]; alpha = v < 0.15 ? v / 0.15 : v > 0.8 ? (1 - v) / 0.2 : 1; }
      }
      grains.push({ x: p[0], y: p[1], alpha: Math.max(0, Math.min(1, alpha)) });
    }
    return { mols: mols, steams: steams, grains: grains };
  }
  function elapsed(k, now) { var r = T4.run[k]; return r == null ? T4.stopAt[k] : T4.stopAt[k] + (now - r) / 1000; }
  function tempLevel(k, el) { if (k === 'flask') return T4.hot ? 0.85 : 0.15; var f = 1 - Math.exp(-el * (k === 'open' ? 1 / 25 : 1 / 40)); return T4.hot ? 0.85 - 0.45 * f : 0.15 + 0.45 * f; }
  function drawVessels(cv, now) {
    if (cv.clientWidth < 60) return null;
    var narrow = cv.clientWidth < 520, W = cv.clientWidth, H = Math.round(W * (narrow ? 3.45 : 0.6)), g = fit(cv, W, H), boxes = [], meas = { e: {}, m: {}, i: {} };
    g.clearRect(0, 0, W, H);
    KINDS.forEach(function (k, i) { var bw = narrow ? Math.min(200, W * 0.55) : Math.min(230, W / 3 - 44), bh = bw * 1.25; boxes.push({ x: narrow ? (W - bw) / 2 : W * (i + 0.5) / 3 - bw / 2, y: narrow ? (H / 3) * i + (H / 3 - bh) / 2 + 16 : H - bh - 14, w: bw, h: bh }); });
    KINDS.forEach(function (k, i) {
      var box = boxes[i], el = elapsed(k, now), lvl = k === 'open' ? 0.62 - 0.08 * (1 - Math.exp(-el / 60)) : 0.62;
      var temp = T4.hot ? lerp(0.15, 1, (tempLevel(k, el) - 0.15) / 0.7) : lerp(-1, -0.2, (tempLevel(k, el) - 0.15) / 0.45);
      var geo = ART.vessel(g, k, box, { temp: temp, level: lvl, highlight: T4.run[k] != null ? 1 : 0, seed: i + 1 });
      var smp = vesselSample(k, geo, box, el, T4.hot);
      smp.steams.forEach(function (s) { ART.steam(g, s.x, s.y, s); });
      smp.mols.forEach(function (m) { ART.molecule(g, m.x, m.y, { r: 6, angle: m.a, alpha: 1 }); });
      smp.grains.forEach(function (e) { ART.energy(g, e.x, e.y, { r: 6, alpha: e.alpha, pulse: 0.5 }); });
      var oe = 0, om = 0, ie = 0; smp.grains.forEach(function (e) { if (e.alpha > 0.05 && (e.x < box.x - 2 || e.x > box.x + box.w + 2 || e.y < box.y - 2)) oe++; if (e.alpha > 0.05 && e.x > geo.inner.x && e.x < geo.inner.x + geo.inner.w && e.y > geo.inner.y && e.y < geo.inner.y + geo.inner.h) ie++; }); smp.mols.forEach(function (m) { if (m.y < box.y - 2) om++; }); smp.steams.forEach(function (s) { if (s.y < box.y - 2) om++; });
      meas.e[k] = oe; meas.m[k] = om; meas.i[k] = ie;
      if (T4.run[k] == null && el === 0) { g.fillStyle = 'rgba(15,23,42,.72)'; g.font = '600 13px sans-serif'; g.textAlign = 'center'; g.fillText('눌러서 시작', box.x + box.w / 2, box.y + box.h * 0.45); g.textAlign = 'left'; }
    });
    cv._boxes = boxes;
    /* 프로브용 측정(화면에 보이지 않음) — 바깥에 있는 에너지 알갱이 · 용기 위로 나간 물 분자·김 */
    cv.setAttribute('data-out-energy', KINDS.map(function (k) { return meas.e[k]; }).join(','));
    cv.setAttribute('data-out-matter', KINDS.map(function (k) { return meas.m[k]; }).join(','));
    cv.setAttribute('data-in-energy', KINDS.map(function (k) { return meas.i[k]; }).join(','));
    cv.setAttribute('data-order', KINDS.join(','));
    /* 표지 (가)(나)(다) — 용기 바로 위 */
    g.fillStyle = '#0f172a'; g.font = '700 16px sans-serif'; g.textAlign = 'center';
    KINDS.forEach(function (k, i) { g.fillText(VNAME[k].slice(0, 3), boxes[i].x + boxes[i].w / 2, boxes[i].y - 10); }); g.textAlign = 'left';
    return meas;
  }

  /* ═══════════════ 화면 짜기 ═══════════════ */
  var cur = 1, LED1 = null, LED2 = null, body = $('body');
  function render() {
    [].forEach.call(document.querySelectorAll('.tabb'), function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-tab') === cur)); });
    $('tabdesc').textContent = DESC[cur];
    var h = '', g = C.gridScenes();
    if (cur === 1) {
      h = '<div class="lay"><div class="card"><h2>경우의 수</h2>' +
        '<div class="stage1"><canvas class="cv" id="cvSplit" aria-label="배치 한 가지를 한 칸으로 나타낸 화면"></canvas><div class="zoombox" id="zb" hidden><canvas id="cvZ"></canvas><p class="zt" id="zt"></p><button class="tg" id="bZ" hidden>더 확대</button></div></div>' +
        '<div class="ledrow"><label class="chk"><input type="checkbox" id="cGrp"' + (T1.group ? ' checked' : '') + '> 분포별로 모아 보기</label><div class="led" id="led1"></div></div>' +
        '<p class="ent-note">한 칸 = 입자들이 두 방에 놓이는 배치 한 가지 · 같은 색 = 같은 입자(위에서 k번째 줄 = k번째 입자의 자리 · 8개까지 색으로 구별) · 빨간 테두리 = 모두 왼쪽 방에 있는 배치 · 칸이 진할수록 왼쪽 방 입자가 많음</p></div>' +
        '<div class="side"><div class="card"><h2>입자 수</h2><div class="nrow"><button class="tg" id="bMinus" aria-label="입자 하나 줄이기">−</button><input type="range" id="rN" min="1" max="20" step="1" value="' + Math.min(20, T1.n) + '" aria-label="입자 수"' + (T1.n === 100 ? ' disabled' : '') + '><button class="tg" id="bPlus" aria-label="입자 하나 늘리기">+</button></div>' +
        '<div class="nrow" style="margin-top:6px"><span class="nval">n = <span id="nV">' + T1.n + '</span></span><button class="tg" id="b100" aria-pressed="' + (T1.n === 100) + '">100</button></div></div>' +
        '<div class="card"><h2>퍼짐</h2><canvas class="cv" id="cvSp" aria-label="두 방 상자"></canvas><p class="ent-note" id="spK"></p><div class="btnrow"><button class="primary" id="bSp">' + (SP.open ? '처음으로(칸막이 다시)' : '칸막이 치우기') + '</button></div><p class="ent-note">단순화한 모형 — 입자는 아무 방향으로나 움직이고, 속력은 변하지 않습니다.</p></div></div></div>';
    }
    if (cur === 2) {
      var boxes = '<div class="three">' + ST.map(function (s) { return '<button class="box" data-s="' + s + '" aria-pressed="' + (sel === s) + '"><canvas class="cv" id="m2_' + s + '" style="border:none"></canvas><b>' + SNAME[s] + '</b></button>'; }).join('') + '</div>';
      h = '<div class="lay"><div class="card"><div class="sw"><button class="tg" data-v="2d" aria-pressed="' + (view2 === '2d') + '">움직임과 자리</button><button class="tg" data-v="3d" aria-pressed="' + (view2 === '3d') + '"' + (GL ? '' : ' disabled') + '>분자 모습(3D)</button></div>' +
        (view2 === '2d' ? boxes + '<div class="btnrow"><label class="chk"><input type="checkbox" id="cTr"' + (trailOn ? ' checked' : '') + '> 입자 하나의 지나간 길</label></div><p class="ent-note">단순화한 모형 — 같은 용기에 같은 입자 4개 · 연두색 칸 = 입자가 갈 수 있는 칸 · 상자를 누르면 경우의 수가 그 상태로 바뀝니다</p><div class="ledrow"><span></span><div class="led" id="led2"></div></div>'
          : '<div class="vw3" id="v3"></div><p class="ent-note">끌어서 돌려 보세요 · 세 상태 모두 물 분자 ' + (V3 ? V3.N : 126) + '개 · 처음 시점 = 얼음의 육각 통로가 보이는 방향 · 점선 = 분자 사이의 수소 결합 · 수증기 용기는 줄여 그림(실제로는 분자 사이가 훨씬 더 멀다)</p><div class="btnrow"><button class="tg" id="bRot">처음 시점으로</button></div>') +
        (GL ? '' : '<p class="ent-note">이 기기에서는 3D를 쓸 수 없습니다 — 「움직임과 자리」로 비교하세요.</p>') + '</div>' +
        '<div class="side"><div class="card"><h2>지금 보는 상태</h2>' + (view2 === '2d' ? '<p style="font-size:22px;font-weight:700;margin:0;color:var(--t1)">' + SNAME[sel] + '</p><p class="ent-note">세 상태 모두 같은 용기 · 같은 입자 4개</p>' : '<p style="font-size:22px;font-weight:700;margin:0;color:var(--t1)">' + { ice: '얼음', liq: '물', gas: '수증기' }[sel3] + '</p><p class="ent-note">분자 모습 — 세 상태 모두 물 분자 ' + (V3 ? V3.N : 126) + '개</p>') + '</div></div></div>';
    }
    if (cur === 3) {
      var rxH = '<h2>기체 반응</h2><p class="eq"><span id="eqL">N₂(g) + 3H₂(g)</span> → <span id="eqR">2NH₃(g)</span></p><div style="max-width:380px;margin:0 auto"><canvas class="cv" id="cvRx" aria-label="기체 반응 격자"></canvas></div><p class="phase" id="rxPhase"></p>' +
        '<div class="rxbar"><button class="primary" id="bRx">' + RX.label() + '</button><input type="range" id="rxT" min="0" max="' + RX.dur + '" step="10" value="' + Math.round(RX.t) + '" aria-label="반응 진행"><button class="tg" id="bRxRnd">다른 배치 보기</button></div>' +
        '<p class="ent-note">분자는 상자 안을 자유롭게 움직입니다 · 초록 칸 = 분자 모형의 절반 넘게가 들어간 칸 · 분자들이 어느 칸에 있는지가 배치 한 가지입니다</p>' +
        '<p class="ent-note">검은 원 2개 = N₂(g) · 흰 원 2개 = H₂(g) · 회색 원과 흰 원 3개 = NH₃(g) · 모든 물질은 기체(g) · 한 칸에 분자 1개 · 같은 종류끼리 자리를 바꾸면 같은 배치, 종류가 다르면 다른 배치로 셉니다 · 기호는 학습지 그림과 같은 분자 기호입니다 — 반응 중 검은 원이 회색 원으로 바뀌는 것은 N₂(g) 기호가 NH₃(g) 기호로 바뀌는 것이고, 질소 원자 자체가 바뀌는 것이 아닙니다</p>';
      var mxH = '<h2>서로 다른 기체의 혼합</h2><div style="max-width:380px;margin:0 auto"><canvas class="cv" id="cvMx" aria-label="혼합 격자"></canvas></div><div class="btnrow" style="justify-content:center"><button class="primary" id="bMx">' + (GM.phase === 0 ? '칸막이 치우기' : '처음으로(칸막이 다시)') + '</button><button class="tg" id="bMxRnd">다른 배치 보기</button></div><p class="ent-note">단순화한 모형 — 검은 원 = 기체 ㉮ 2개 · 흰 원 = 기체 ㉯ 2개 · 칸막이 양쪽 8칸씩 · 초록 칸 = 분자 모형의 절반 넘게가 들어간 칸</p>';
      h = '<div class="lay"><div class="card"><div class="sw"><button class="tg" data-v3="rx" aria-pressed="' + (sub3 === 'rx') + '">기체 반응</button><button class="tg" data-v3="mx" aria-pressed="' + (sub3 === 'mx') + '">혼합</button></div>' + (sub3 === 'rx' ? rxH : mxH) + '</div><div class="side">' +
        (sub3 === 'rx' ? '<div class="card rd"><h2>기체 반응</h2>' + rd('기체 분자 수', '4개', false, 'rxMols') + rd('배치의 가짓수', C.fmt(C.grid3Scenes().reactants), true, 'rxCnt') + '</div>'
          : '<div class="card rd"><h2>혼합</h2>' + rd('입자가 움직일 수 있는 칸', GM.phase === 0 ? '8칸 + 8칸' : '16칸', false, 'mxCells') + rd('배치의 가짓수', C.fmt(GM.count()), true, 'mxCnt') + '</div>') + '</div></div>';
    }
    if (cur === 4) {
      h = '<div class="lay"><div class="card"><h2>세 용기 — ' + (T4.hot ? '뜨거운 물' : '찬 물') + '</h2><canvas class="cv" id="cvV" style="touch-action:manipulation" aria-label="세 용기"></canvas>' +
        '<div class="vlabs">' + KINDS.map(function (k) { return '<div class="vl"><button class="tg" data-k="' + k + '" aria-pressed="' + (T4.run[k] != null) + '">' + VNAME[k] + (T4.run[k] != null ? ' ■ 멈춤' : ' ▶') + '</button><div class="temp"><i id="tp_' + k + '"></i></div><small>물의 온도' + (k === 'flask' ? ' · 이상적인 단열 용기로 가정' : '') + '</small></div>'; }).join('') + '</div>' +
        '<div class="btnrow"><button class="tg" id="bHot" aria-pressed="' + T4.hot + '">뜨거운 물</button><button class="tg" id="bCold" aria-pressed="' + !T4.hot + '">찬 물</button><button class="tg" id="bAll">처음으로</button></div>' +
        '<p class="ent-note">빨강·흰 공 = 물 분자 · 김 = 수증기가 식어 생긴 작은 물방울 · 주황 알갱이 = 에너지 · 물의 온도 막대는 눈금 없는 정성 표시</p></div>' +
        '<div class="side"><div class="card"><h2>무엇이 드나드는지 보세요</h2><p class="ent-note" style="font-size:14px;line-height:1.8">빨강·흰 공 = 물 분자(물질)<br>김 = 수증기가 식어 생긴 작은 물방울(물질)<br>주황 알갱이 = 에너지<br>용기 안 ↔ 용기 바깥</p></div></div></div>';
    }
    body.innerHTML = h; wire();
  }
  function setN(n, animate) {
    n = Math.max(1, Math.min(100, n)); if (n === T1.n) return;
    var old = T1.n; T1.n = n; T1.zoomL = 0;
    T1.anim = animate && !RM && Math.abs(n - old) === 1 && n <= 20 && old <= 20 ? { from: old, to: n, t0: performance.now(), dur: n > old ? 1100 : 700 } : null;
    spReset(); render();
  }
  function wire() {
    if (cur === 1) {
      LED1 = new Led($('led1')); LED1.set(C.pow2(T1.n));
      $('rN').oninput = function () { setN(+this.value, true); };
      $('bMinus').onclick = function () { setN(T1.n === 100 ? 20 : T1.n - 1, true); };
      $('bPlus').onclick = function () { setN(T1.n >= 20 ? 20 : T1.n + 1, true); };
      $('b100').onclick = function () { setN(T1.n === 100 ? 20 : 100, false); };
      $('cGrp').onchange = function () { T1.group = this.checked; };
      $('bSp').onclick = function () { if (SP.open) spReset(); else SP.open = true; render(); };
      $('bZ').onclick = function () { T1.zoomL = Math.min(5, T1.zoomL + 1); };
    }
    if (cur === 2) {
      [].forEach.call(document.querySelectorAll('[data-v]'), function (b) { b.onclick = function () { view2 = b.getAttribute('data-v'); render(); }; });
      [].forEach.call(document.querySelectorAll('.three .box'), function (b) { b.onclick = function () { sel = b.getAttribute('data-s'); render(); }; });
      if ($('cTr')) $('cTr').onchange = function () { trailOn = this.checked; };
      if ($('led2')) { LED2 = new Led($('led2')); LED2.set(count2(sel)); }
      if (view2 === '3d' && GL) { build3D(); place3D(); $('bRot').onclick = function () { V3.rot.yaw = 0; V3.rot.pitch = 0; }; }
    }
    if (cur === 3) {
      [].forEach.call(document.querySelectorAll('[data-v3]'), function (b) { b.onclick = function () { sub3 = b.getAttribute('data-v3'); render(); }; });
      if ($('bRx')) {
        /* RM: 움직임 없이 반응 전 ↔ 반응 후(최종 상태·최종 값)로 바로 */
        /* [반응시키기]: 반응 전(돌아다님) → 모일 자리로(운동기) → 빨라지며 다가가 맞닿음(1 s) → 맞닿은 채 결합이 바뀜(2.4 s) → 반응 후(NH₃ 2개가 날아가 돌아다님). RM: 반응 전 ↔ 반응 후 바로 */
        $('bRx').onclick = function () { RX.press();   /* 모이는 중 멈춤 = 그 자리에 · RM은 반응 전 ↔ 반응 후 바로(core RxRun.press) */
          render(); };
        $('rxT').oninput = function () { RX.scrub(+this.value); $('bRx').textContent = RX.label(); rxRender(rxSample(RX.t)); };
        /* 다른 배치 보기 — 지금 분자들(반응 전 4개 / 반응 후 2개)을 무작위 칸으로 한 번에 옮긴다 */
        $('bRxRnd').onclick = function () { if (RX.mode !== 'reac' && RX.mode !== 'prod') RX.reset(RX.t >= RX.dur ? 'prod' : 'reac'); var M = RX.mover(); M.shuffle(randomCells(M.items.length, ALL16)); render(); };
        rxRender(rxSample(RX.t));
      }
      if ($('bMx')) { $('bMx').onclick = function () { if (GM.phase === 0) { GM.phase = 1; GM.liftAt = performance.now(); if (RM) GM.shuffle(); } else { GM.phase = 0; GM.reset(); } render(); };
        $('bMxRnd').onclick = function () { GM.shuffle(); GM.liftAt = 0; render(); }; }
    }
    if (cur === 4) {
      var cvV = $('cvV');
      function toggle(k) { var now = performance.now(); if (T4.run[k] != null) { T4.stopAt[k] = elapsed(k, now); T4.run[k] = null; } else T4.run[k] = now; render(); }
      [].forEach.call(document.querySelectorAll('.vlabs .tg'), function (b) { b.onclick = function () { toggle(b.getAttribute('data-k')); }; });
      cvV.onclick = function (e) { var r = cvV.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; (cvV._boxes || []).forEach(function (bx, i) { if (x >= bx.x - 20 && x <= bx.x + bx.w + 20 && y >= bx.y - 30 && y <= bx.y + bx.h + 10) toggle(KINDS[i]); }); };
      function reset4() { KINDS.forEach(function (k) { T4.run[k] = null; T4.stopAt[k] = 0; }); }
      $('bHot').onclick = function () { T4.hot = true; reset4(); render(); };
      $('bCold').onclick = function () { T4.hot = false; reset4(); render(); };
      $('bAll').onclick = function () { reset4(); render(); };
    }
  }
  [].forEach.call(document.querySelectorAll('.tabb'), function (b) { b.addEventListener('click', function () { cur = +b.getAttribute('data-tab'); render(); }); });
  $('limits').innerHTML = LIMITS.map(function (t) { return '<li>' + t + '</li>'; }).join('');

  /* ═══════════════ 시계 하나 ═══════════════ */
  spReset(); m2Reset();
  var last = performance.now(), tt = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);   /* 먼저 예약 — 그리기 예외가 나도 시계는 멈추지 않는다 */
    var dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt; acc += dt; var hop = acc > 0.45; if (hop) acc = 0;
    if (cur === 1) { drawT1(now); if (LED1) LED1.draw(); var sp = $('cvSp'); if (sp) { if (SP.open) spStep(dt); spDraw(sp); } }
    if (cur === 2) {
      if (view2 === '2d') { m2Step(dt, tt); ST.forEach(function (s) { var c = $('m2_' + s); if (c) m2Draw(c, s); }); if (LED2) LED2.draw(); }
      else if (V3) { V3.step(dt, tt); V3.draw(); }
    }
    if (cur === 3) {
      if (sub3 === 'rx') {
        RX.step(dt);   /* 자유 운동 · 모이기 · 시계 · 넘겨주기 = core RxRun.step(RM이면 움직이지 않음) */
        rxRender(rxSample(RX.t), now);
      }
      else { if (!RM) GM.step(dt, GM.phase === 0 || now - GM.liftAt < 600); var mx = $('cvMx'); if (mx) drawMix(mx, now); }
    }
    if (cur === 4) {
      var cv = $('cvV'); if (cv) { drawVessels(cv, now); KINDS.forEach(function (k) { var tp = $('tp_' + k); if (tp) tp.style.width = Math.round(tempLevel(k, elapsed(k, now)) * 100) + '%'; }); }
    }
  }
  render(); requestAnimationFrame(frame);
})();
