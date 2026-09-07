/* ================================================================
   raoult_core.js — 증기 압력 내림 · 계산부 단일 원천

   ★ 이 파일은 화면과 무관하다. DOM 을 절대 참조하지 않는다.
   ★ raoult/sim.js 의 절단 마커 위쪽이 이 파일과 «문자 단위로» 같아야 한다
     (raoult_check.js 의 동기 검사가 본다).

   설계지시안_증기압력내림_v3.md §2 를 구현한 것이다.
   검산: 검증스크립트/_raoult_mf1_v3.js (14 PASS)
   ================================================================ */

const RAOULT = {
  R: 8.314,
  MMHG_PER_ATM: 760,

  /* 물의 Antoine 상수 (mmHg·℃). liquid/sim.js LIQ.LIST water 와 같은 값이다.
     ⚠ 유효 구간 1~100 ℃. 이 시뮬의 조작 범위(25~60 ℃)는 그 안에 있다. */
  A: 8.07131, B: 1730.63, C: 233.426,
  M_WATER: 18.015,          // g/mol
  M_SUCROSE: 342.30,        // g/mol (자당)
  M_UREA: 60.06,            // g/mol (요소)

  /* ── 조작 범위와 그 물리적 근거 (매뉴얼 §13⑤ · P5 M8) ──────────────
     T   25~60 ℃ : 하한을 «교과서 57쪽 확인 문제의 25 ℃»에 맞춘다. 그 온도에서 ΔP 는
                   2.86개(막대로는 13.5 px)로 읽힌다. 20 ℃ 는 0.9개라 읽히지 않는다.
     X용질 ≤ 0.05 : 로드맵이 실제 수업에서 쓰는 최대 농도. 그 위는 자당 용해도와
                   묽은 용액 가정을 함께 벗어난다.
     cover 0.10~0.75 : f = 1 − cover 이고 t99 = ln100/(KC·f) 이므로 cover 0.75(f 0.25)에서
                   t99 = 14.7 s — 교실에서 기다릴 수 있는 상한.
                   ★ 하한 0.10 은 물리가 아니라 «판별» 때문이다. 막·증발만 모형은 P°·f 를,
                     조성 모형은 P°·X 를 주므로 cover 가 X용질 과 같아지면 두 모형이 «같은 수»를
                     낸다. 탭 3 의 X용질 을 0.05 로 고정하고 cover 를 0.10 이상으로 두어
                     두 값이 절대 겹치지 않게 한다.
     ------------------------------------------------------------------ */
  T: { min: 25, max: 60, step: 1, init: 45 },
  XS: { min: 0, max: 0.05, step: 0.001, init: 0.02 },
  COVER: { min: 0.10, max: 0.75, step: 0.01, init: 0.5 },

  /* 탭 3 에서 쓰는 «고정» 용질 몰분율. 슬라이더로 열지 않는다 (위 ★ 참조) */
  XS_TAB3: 0.05,

  /* 화면 기체 분자 1개가 대표하는 압력. 최고 온도(60 ℃)에서 360개가 되도록 잡았다.
     하한 25 ℃·X용질 0.05 에서 ΔP 는 2.86개다 — 「개수」로는 아슬아슬하나 막대로는 13.5 px 다.
     상한 400개는 매뉴얼 §10 의 교실 기기 성능 예산이다. 여유 40개는 요동 표현용. */
  SCALE: 360 / Math.pow(10, 8.07131 - 1730.63 / (233.426 + 60)),   // ≈ 2.4155 개/mmHg

  /* 응축 1차 상수 (1/s). 순물질 이완 시간 τ = 1/KC = 0.8 s.
     t99 = ln100·τ = 3.7 s — 조작하고 곧바로 결과를 보는 길이다. */
  KC: 1.25,

  /* 동적 평형 판정 밴드 — 목표값의 2 %. liquid/sim.js sealedAtEq 와 같은 기준. */
  EQ_BAND: 0.02,

  /* 「답 확인」 게이트가 풀리기까지 기다리는 추가 시간 (s).
     atEq(2 %) 성립 후 이만큼 더 지나면 cover 상한에서도 1 % 이내가 된다.
     ln2/(KC·0.25) = 2.22 s. */
  SETTLE_S: 2.22
};

/* 순물질의 포화 증기 압력 (mmHg) */
function pPure(t) {
  return Math.pow(10, RAOULT.A - RAOULT.B / (RAOULT.C + t));
}

/* 용매의 몰분율. 물 200 g 기준으로 용질 몰분율에서 되돌린다.
   ⚠ 「물 200 mL」가 아니라 «g»다 — 차시 13이 몰농도(부피)와 몰랄 농도(질량)를
      가르는 차시이므로 이 화면은 부피 단위를 질량처럼 쓰지 않는다. */
function xSolvent(xSolute) {
  return 1 - xSolute;
}

/* 몰랄 농도 (mol/kg) — 물 200 g 기준 */
function molality(xSolute) {
  const nW = 200 / RAOULT.M_WATER;
  const nS = nW * xSolute / (1 - xSolute);
  return nS / 0.200;
}

/* 용질 개수(화면용) — 몰분율에 비례한 정성 배율. 액체 분자 수를 고정하고 그 비율만큼 둔다 */
function soluteCount(xSolute, liquidDots) {
  return Math.round(liquidDots * xSolute / (1 - xSolute));
}

/* ── 세 계수 세트 ────────────────────────────────────────────────────
   model: "comp"  조성 — 증발 ∝ X용매, 응축 ∝ N            (참)
          "film2" 막·양방향 — 증발·응축 «둘 다» f 배        (참)
          "film1" 막·증발만 — 증발만 f 배, 응축은 그대로    (학생이 흔히 갖는 가설)

   ★ 응축 계수의 눈금은 «순물질»(pPure)로만 잡는다. 용액의 증기압으로 잡으면
     종단이 P°·X² 가 되어 라울 법칙이 «틀리게» 떠오른다
     (_to_delete/…/vapor/sim.js 가 실제로 그 결함을 갖고 있다).

   ★ 막이 양방향을 같은 비율로 막는 근거는 «세부 균형»이다 — 탈출을 f 배로 막는
     장벽은 포획도 f 배로 막는다. 평형은 경로가 아니라 상태의 성질이기 때문이다.
     그렇지 않다면 덮은 용기와 안 덮은 용기를 연결해 영구히 증류할 수 있다.
     ⚠ 흔한 오해 — 「덮개가 있으면 응축이 압력에 비례하지 않는다」가 아니다. 세 모형 «전부»
       응축 속도는 기체 분자 수(=압력)에 비례한다. 달라지는 것은 비례 «상수»뿐이다 —
       막·양방향은 증발 쪽과 «같은 f 배»로 함께 줄고, 막·증발만은 응축 쪽이 줄지 않는다.
       (차시 7 liquid/ 가 세운 「응축 속도는 증기 압력에 비례」 틀이 그대로 유지된다.)
   ------------------------------------------------------------------ */
function evapRate(t, xSolute, model, cover) {
  const f = 1 - cover;
  const base = RAOULT.KC * pPure(t) * RAOULT.SCALE;
  return model === "comp" ? base * xSolvent(xSolute) : base * f;
}
function condCoef(model, cover) {
  const f = 1 - cover;
  return model === "film2" ? RAOULT.KC * f : RAOULT.KC;
}

/* 종단(평형) 기체 분자 수. 이 값은 위 두 속도식의 «정상 상태»로 유도된 것이다.
   화면에서는 이 값 주위로 분자가 확률적으로 드나들지만, 판정은 이 값으로 한다. */
function terminalN(t, xSolute, model, cover) {
  return evapRate(t, xSolute, model, cover) / condCoef(model, cover);
}

/* 종단 증기 압력 (mmHg) */
function terminalP(t, xSolute, model, cover) {
  return terminalN(t, xSolute, model, cover) / RAOULT.SCALE;
}

/* 한 걸음 — 지수 해. 오일러 적분(N += (E − k·N)·dt)은 큰 dt 에서 진동한다. */
function stepN(n, t, xSolute, model, cover, dt) {
  const target = terminalN(t, xSolute, model, cover);
  const k = condCoef(model, cover);
  return target + (n - target) * Math.exp(-k * dt);
}

/* 동적 평형 판정 — 카운터·상태 문구·결론이 «이 함수 하나»를 같이 읽는다 */
function atEq(n, t, xSolute, model, cover) {
  const target = terminalN(t, xSolute, model, cover);
  if (target <= 0) return n <= 0;
  return Math.abs(n - target) <= RAOULT.EQ_BAND * target;
}

/* 표시용 — 순물질과 용액의 압력 차 (mmHg) */
function deltaP(t, xSolute) {
  return pPure(t) * xSolute;
}

/* 대기압까지의 배율 — 압력 막대 축이 자동(0~1.2·P°)이므로
   「대기압은 이 화면 축의 몇 배 위인가」를 함께 보인다 */
function atmTimesAbove(t) {
  return RAOULT.MMHG_PER_ATM / (1.2 * pPure(t));
}

/* ================= UI + 캔버스 렌더 ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   검증스크립트/raoult_core.js 와 문자 단위로 같은지 대조한다.
   ★ 이 줄을 지우거나 바꾸지 말 것. 바꾸면 raoult_check.js [G-6] 이 FAIL 한다.

   ── 렌더 방침 (사용자 확정 2026-09-07) ──────────────────────────────────
   거시 세계도, 분자 화면도 «2D 도식»이다. WebGL 을 쓰지 않는다. 시각 언어는 waterdensity/ 를 따른다.
   · 비커 : 평면 윤곽 + 옅은 청색 하이라이트 · 물은 rgba(37,99,235,0.42)
   · 압력계 : 뚜껑 위 «다이얼» + 비커 옆 «글자»로 대기압·증기 압력 값 (세로 막대는 증기 압력으로 읽히지 않았다)
   · 물 분자 : CPK(O 빨강·H 흰색) 공-막대 · 용질 : 노랑(교과서 그림과 같은 색) + 진한 테두리
   · 기체 분자는 «액면 근처에 몰려» 있다 — 차시 7 에서 학생이 받은 상(像)을 잇는 도식. 한계 목록에 적는다.
   · 입자의 «운동»과 압력계 «디자인»은 window.RAOULT_MOTION(코덱스 납품) 이 맡는다.
     없으면 아래 FALLBACK 이 같은 계약으로 돈다 — 화면이 멈추지 않게 하기 위한 최소 구현이다.
   ──────────────────────────────────────────────────────────────────── */

/* ───────── 입자 운동·압력계 모듈 — 코덱스 납품 2026-09-07 (검증스크립트/_raoult_fx2/raoult_motion.js · 수정 없이 그대로) ─────────
   계약·검증 결과는 같은 폴더 README.md. 이 블록이 없으면 아래 FALLBACK_MOTION 이 같은 계약으로 돈다. */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;
  var MAX_PARTICLES = 400;

  function finiteNumber(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function fract(value) {
    return value - Math.floor(value);
  }

  function makeRng(seed) {
    var word = (finiteNumber(seed, 1) >>> 0) || 1;
    return function () {
      var t;
      word = (word + 0x6D2B79F5) | 0;
      t = Math.imul(word ^ (word >>> 15), 1 | word);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedController(opt) {
    var explicit = opt && finiteNumber(opt.seed, null) !== null;
    var rng = makeRng(explicit ? opt.seed : 1);
    var opened = false;
    return {
      open: function (state) {
        if (!opened) {
          if (!explicit && state && finiteNumber(state.seed, null) !== null) {
            rng = makeRng(state.seed);
          }
          opened = true;
        }
      },
      next: function () { return rng(); }
    };
  }

  function rectOf(state, surfaceBound) {
    var r = state && state.rect ? state.rect : {};
    var x = finiteNumber(r.x, 0);
    var y = finiteNumber(r.y, 0);
    var w = Math.max(4, finiteNumber(r.w, 4));
    var h = Math.max(4, finiteNumber(r.h, 4));
    var bottom = y + h;
    if (surfaceBound) bottom = finiteNumber(state.surfaceY, bottom) - 2;
    if (bottom < y + 2) bottom = y + 2;
    return { left: x, top: y, right: x + w, bottom: bottom };
  }

  function mapParticles(items, oldBounds, nextBounds) {
    var oldW;
    var oldH;
    var newW;
    var newH;
    var i;
    var p;
    if (!oldBounds) return;
    if (oldBounds.left === nextBounds.left && oldBounds.top === nextBounds.top &&
        oldBounds.right === nextBounds.right && oldBounds.bottom === nextBounds.bottom) return;
    oldW = Math.max(1, oldBounds.right - oldBounds.left);
    oldH = Math.max(1, oldBounds.bottom - oldBounds.top);
    newW = nextBounds.right - nextBounds.left;
    newH = nextBounds.bottom - nextBounds.top;
    for (i = 0; i < items.length; i += 1) {
      p = items[i];
      p.x = nextBounds.left + clamp((p.x - oldBounds.left) / oldW, 0, 1) * newW;
      p.y = nextBounds.top + clamp((p.y - oldBounds.top) / oldH, 0, 1) * newH;
    }
  }

  function cappedMove(p, dt, maxSpeed) {
    var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    var scale;
    if (speed > maxSpeed) {
      scale = maxSpeed / speed;
      p.vx *= scale;
      p.vy *= scale;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  function reflect(p, b) {
    if (p.x < b.left) { p.x = b.left + (b.left - p.x); p.vx = Math.abs(p.vx); }
    if (p.x > b.right) { p.x = b.right - (p.x - b.right); p.vx = -Math.abs(p.vx); }
    if (p.y < b.top) { p.y = b.top + (b.top - p.y); p.vy = Math.abs(p.vy); }
    if (p.y > b.bottom) { p.y = b.bottom - (p.y - b.bottom); p.vy = -Math.abs(p.vy); }
    p.x = clamp(p.x, b.left, b.right);
    p.y = clamp(p.y, b.top, b.bottom);
  }

  function vaporFactory(opt) {
    var random = seedController(opt || {});
    var particles = [];
    var serial = 0;
    var bounds = null;
    var trackCredit = 0;
    var exchangeCredit = 0;

    function spawn(b) {
      var width = b.right - b.left;
      var height = b.bottom - b.top;
      var phase = fract((serial + 0.5) * 0.61803398875 + random.next() * 0.035);
      var speed = 18 + random.next() * 18;
      var angle = -Math.PI * (0.22 + random.next() * 0.56);
      var p = {
        x: b.left + width * (0.04 + random.next() * 0.92),
        y: b.bottom,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        home: Math.pow(phase, 4),
        turn: 0.65 + random.next() * 1.35,
        mode: 0,
        ready: false
      };
      serial += 1;
      particles.push(p);
      return p;
    }

    function pending(mode) {
      var n = 0;
      var i;
      for (i = 0; i < particles.length; i += 1) {
        if (particles[i].mode === mode) n += 1;
      }
      return n;
    }

    function cancelModes() {
      var i;
      for (i = 0; i < particles.length; i += 1) {
        particles[i].mode = 0;
        particles[i].ready = false;
      }
    }

    function markTail(mode) {
      var i;
      for (i = particles.length - 1; i >= 0; i -= 1) {
        if (particles[i].mode === 0) {
          particles[i].mode = mode;
          return true;
        }
      }
      return false;
    }

    function moveParticle(p, dt, b) {
      var height = Math.max(1, b.bottom - b.top);
      var homeY;
      var angle;
      var speed;
      if (p.mode !== 0) {
        p.vy = Math.max(22, Math.abs(p.vy) + 22 * dt);
        p.vx *= Math.max(0, 1 - 1.5 * dt);
        cappedMove(p, dt, 52);
        if (p.x < b.left || p.x > b.right) reflect(p, b);
        if (p.y >= b.bottom) {
          p.y = b.bottom;
          p.ready = true;
        }
        return;
      }

      homeY = b.bottom - p.home * height;
      p.vy += (homeY - p.y) * 0.75 * dt;
      p.turn -= dt;
      if (p.turn <= 0) {
        angle = (random.next() - 0.5) * 0.66;
        speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        p.vx = Math.cos(Math.atan2(p.vy, p.vx) + angle) * speed;
        p.vy = Math.sin(Math.atan2(p.vy, p.vx) + angle) * speed;
        p.turn = 0.65 + random.next() * 1.35;
      }
      cappedMove(p, dt, 45);
      reflect(p, b);
    }

    function removeReady(b) {
      var removed = 0;
      var p;
      var exchange;
      while (removed < 3 && particles.length) {
        p = particles[particles.length - 1];
        if (p.mode === 0 || !p.ready) break;
        exchange = p.mode === 2;
        particles.pop();
        if (exchange && particles.length < MAX_PARTICLES) spawn(b);
        removed += 1;
        if (exchange) break;
      }
    }

    function step(dt, state) {
      var d = clamp(finiteNumber(dt, 0), 0, 0.1);
      var b = rectOf(state || {}, true);
      var desired = clamp(Math.round(finiteNumber(state && state.targetN, 0)), 0, MAX_PARTICLES);
      var reduced = !!(state && state.reduced);
      var removePending;
      var difference;
      var rate;
      var events;
      var i;
      var exchangeRate;

      random.open(state);
      mapParticles(particles, bounds, b);
      bounds = b;

      if (desired >= particles.length) {
        if (pending(1) || pending(2)) cancelModes();
        difference = desired - particles.length;
        if (difference > 0) {
          rate = Math.min(180, 10 + difference * 4);
          trackCredit += rate * d;
          events = Math.min(3, difference, Math.floor(trackCredit));
          trackCredit -= events;
          for (i = 0; i < events; i += 1) spawn(b);
        } else {
          trackCredit = 0;
        }
      } else {
        for (i = 0; i < particles.length; i += 1) {
          if (particles[i].mode === 2) particles[i].mode = 1;
        }
        removePending = pending(1);
        difference = particles.length - desired - removePending;
        if (difference > 0) {
          rate = Math.min(180, 10 + (particles.length - desired) * 4);
          trackCredit += rate * d;
          events = Math.min(3, difference, Math.floor(trackCredit));
          trackCredit -= events;
          for (i = 0; i < events; i += 1) markTail(1);
        }
      }

      if (particles.length === desired && pending(1) === 0 && pending(2) === 0 && desired > 0) {
        exchangeRate = Math.max(0, Math.min(
          finiteNumber(state && state.evapPerSec, 0),
          finiteNumber(state && state.condPerSec, 0)
        )) * 0.02;
        exchangeCredit += exchangeRate * d;
        if (exchangeCredit >= 1) {
          exchangeCredit -= 1;
          markTail(2);
        }
      } else if (particles.length !== desired) {
        exchangeCredit = 0;
      }

      if (reduced) {
        for (i = 0; i < particles.length; i += 1) {
          if (particles[i].mode !== 0) {
            particles[i].x = clamp(particles[i].x, b.left, b.right);
            particles[i].y = b.bottom;
            particles[i].ready = true;
          }
        }
      } else {
        for (i = 0; i < particles.length; i += 1) moveParticle(particles[i], d, b);
      }
      removeReady(b);
    }

    function draw(g, state, drawParticle) {
      var i;
      if (typeof drawParticle !== "function") return;
      for (i = 0; i < particles.length; i += 1) {
        drawParticle(g, particles[i].x, particles[i].y, i);
      }
    }

    return {
      step: step,
      draw: draw,
      count: function () { return particles.length; }
    };
  }

  function soluteFactory(opt) {
    var random = seedController(opt || {});
    var particles = [];
    var bounds = null;

    function makeParticle(index, b) {
      var quadrant = index % 4;
      var localIndex = Math.floor(index / 4);
      var u = fract((localIndex + 0.5) * 0.61803398875 + random.next() * 0.025);
      var v = fract((localIndex + 0.5) * 0.75487766625 + random.next() * 0.025);
      var homeU = (quadrant % 2) * 0.5 + (0.18 + u * 0.64) * 0.5;
      var homeV = Math.floor(quadrant / 2) * 0.5 + (0.18 + v * 0.64) * 0.5;
      var speed = 5 + random.next() * 5;
      var angle = random.next() * TAU;
      return {
        x: b.left + homeU * (b.right - b.left),
        y: b.top + homeV * (b.bottom - b.top),
        homeU: homeU,
        homeV: homeV,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        turn: 0.45 + random.next() * 1.1
      };
    }

    function step(dt, state) {
      var d = clamp(finiteNumber(dt, 0), 0, 0.1);
      var b = rectOf(state || {}, false);
      var desired = clamp(Math.round(finiteNumber(state && state.count, 0)), 0, MAX_PARTICLES);
      var reduced = !!(state && state.reduced);
      var p;
      var i;
      var homeX;
      var homeY;
      var angle;
      var speed;

      random.open(state);
      mapParticles(particles, bounds, b);
      bounds = b;
      while (particles.length < desired) particles.push(makeParticle(particles.length, b));
      while (particles.length > desired) particles.pop();
      if (reduced) return;

      for (i = 0; i < particles.length; i += 1) {
        p = particles[i];
        homeX = b.left + p.homeU * (b.right - b.left);
        homeY = b.top + p.homeV * (b.bottom - b.top);
        p.vx += (homeX - p.x) * 0.30 * d;
        p.vy += (homeY - p.y) * 0.30 * d;
        p.turn -= d;
        if (p.turn <= 0) {
          angle = (random.next() - 0.5) * 1.15;
          speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.vx = Math.cos(Math.atan2(p.vy, p.vx) + angle) * speed;
          p.vy = Math.sin(Math.atan2(p.vy, p.vx) + angle) * speed;
          p.turn = 0.45 + random.next() * 1.1;
        }
        cappedMove(p, d, 14);
        reflect(p, b);
      }
    }

    function draw(g, state, drawParticle) {
      var r = state && state.rect ? state.rect : {};
      var ix = state && state.injectXY ? finiteNumber(state.injectXY.x, finiteNumber(r.x, 0) + finiteNumber(r.w, 0) / 2) : finiteNumber(r.x, 0) + finiteNumber(r.w, 0) / 2;
      var iy = state && state.injectXY ? finiteNumber(state.injectXY.y, finiteNumber(r.y, 0)) : finiteNumber(r.y, 0);
      var diffuse = state && state.reduced ? 1 : clamp(finiteNumber(state && state.diffuse01, 0), 0, 1);
      var eased = 1 - Math.pow(1 - diffuse, 3);
      var i;
      var p;
      if (typeof drawParticle !== "function") return;
      for (i = 0; i < particles.length; i += 1) {
        p = particles[i];
        drawParticle(g, ix + (p.x - ix) * eased, iy + (p.y - iy) * eased, i);
      }
    }

    return {
      step: step,
      draw: draw,
      count: function () { return particles.length; }
    };
  }

  function tickText(value) {
    var a = Math.abs(value);
    if (a >= 100) return String(Math.round(value));
    if (a >= 10) return String(Math.round(value * 10) / 10);
    return String(Math.round(value * 100) / 100);
  }

  function gaugeFactory() {
    var shown = null;
    return {
      draw: function (g, state) {
        var cx = finiteNumber(state && state.cx, 0);
        var cy = finiteNumber(state && state.cy, 0);
        var r = Math.max(18, finiteNumber(state && state.r, 18));
        var max = Math.max(0.000001, finiteNumber(state && state.max, 1));
        var target = clamp(finiteNumber(state && state.value, 0), 0, max);
        var colors = state && state.colors ? state.colors : {};
        var start = Math.PI * 5 / 6;
        var sweep = Math.PI * 4 / 3;
        var fraction;
        var angle;
        var i;
        var a;
        var inner;
        var outer;
        var tx;
        var ty;

        if (!g) return;
        if (shown === null || (state && state.reduced)) shown = target;
        else {
          shown += (target - shown) * 0.18;
          if (Math.abs(target - shown) < max * 0.0005) shown = target;
        }
        fraction = clamp(shown / max, 0, 1);
        angle = start + sweep * fraction;

        g.save();
        g.lineCap = "round";
        g.lineJoin = "round";
        g.fillStyle = colors.face;
        g.strokeStyle = colors.rim;
        g.lineWidth = Math.max(2, r * 0.055);
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.fill();
        g.stroke();

        g.strokeStyle = colors.tick;
        g.lineWidth = Math.max(1, r * 0.018);
        g.beginPath();
        g.arc(cx, cy, r * 0.78, start, start + sweep);
        g.stroke();

        for (i = 0; i <= 20; i += 1) {
          a = start + sweep * i / 20;
          outer = r * 0.82;
          inner = r * (i % 5 === 0 ? 0.68 : 0.74);
          g.lineWidth = i % 5 === 0 ? Math.max(1.4, r * 0.025) : Math.max(0.8, r * 0.013);
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
          g.stroke();
        }

        g.fillStyle = colors.muted;
        g.font = "600 " + Math.max(8, r * 0.105) + "px system-ui,sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (i = 0; i <= 4; i += 1) {
          a = start + sweep * i / 4;
          tx = cx + Math.cos(a) * r * 0.57;
          ty = cy + Math.sin(a) * r * 0.57;
          g.fillText(tickText(max * i / 4), tx, ty);
        }

        g.strokeStyle = colors.needle;
        g.lineWidth = Math.max(2, r * 0.038);
        g.beginPath();
        g.moveTo(cx - Math.cos(angle) * r * 0.12, cy - Math.sin(angle) * r * 0.12);
        g.lineTo(cx + Math.cos(angle) * r * 0.62, cy + Math.sin(angle) * r * 0.62);
        g.stroke();
        g.fillStyle = colors.needle;
        g.beginPath();
        g.arc(cx, cy, r * 0.075, 0, TAU);
        g.fill();
        g.strokeStyle = colors.rim;
        g.lineWidth = Math.max(1, r * 0.018);
        g.stroke();

        g.fillStyle = colors.text;
        g.font = "700 " + Math.max(9, r * 0.125) + "px system-ui,sans-serif";
        g.fillText(state && state.label ? state.label : "", cx, cy + r * 0.42);
        g.fillStyle = colors.muted;
        g.font = "500 " + Math.max(8, r * 0.095) + "px system-ui,sans-serif";
        g.fillText(state && state.sub ? state.sub : "", cx, cy + r * 0.60);
        g.restore();
      }
    };
  }

  root.RAOULT_MOTION = {
    vapor: vaporFactory,
    solute: soluteFactory,
    gauge: gaugeFactory
  };
}(window));



/* ───────── 정적 2D 도식 모듈 — 코덱스 납품 v3 2026-09-07 (검증스크립트/_raoult_fx3/raoult_design.js · 수정 없이 그대로) ─────────
   계약·검증 결과는 같은 폴더 README.md. 이 블록이 없으면 아래 FALLBACK_DESIGN 이 같은 계약으로 돈다. */
(function () {
  "use strict";

  function beakerBack(g, spec) {
    const x = spec.x;
    const y = spec.y;
    const w = spec.w;
    const h = spec.h;
    const surfaceY = spec.surfaceY;
    const colors = spec.colors;

    g.save();
    g.fillStyle = colors.water;
    g.fillRect(x + 2, surfaceY, w - 4, y + h - surfaceY);
    if (spec.solnAlpha > 0) {
      g.globalAlpha = spec.solnAlpha;
      g.fillStyle = colors.soln;
      g.fillRect(x + 2, surfaceY, w - 4, y + h - surfaceY);
      g.globalAlpha = 1;
    }
    g.strokeStyle = colors.waterLine;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x + 2, surfaceY);
    g.lineTo(x + w - 2, surfaceY);
    g.stroke();
    g.restore();
  }

  function beakerFront(g, spec) {
    const x = spec.x;
    const y = spec.y;
    const w = spec.w;
    const h = spec.h;
    const surfaceY = spec.surfaceY;
    const colors = spec.colors;

    g.save();
    g.strokeStyle = colors.stageLine;
    g.lineWidth = 2.6;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y + 4);
    g.lineTo(x, y + h);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w, y + 4);
    g.stroke();

    g.strokeStyle = colors.glassHi;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(x + 7, y + 18);
    g.lineTo(x + 7, y + h - 12);
    g.stroke();

    g.fillStyle = colors.dGray;
    g.fillRect(x - 5, y - 2, w + 10, 6);
    g.fillRect(x + w / 2 - 3, y - 10, 6, 8);

    if (spec.label) {
      g.fillStyle = colors.t1;
      g.font = "600 12px system-ui,sans-serif";
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillText(spec.label, x + w / 2, surfaceY + (y + h - surfaceY) * 0.80);
    }
    g.restore();
  }

  function arrow(g, x0, y0, x1, y1, col, lw) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const headLength = 6 + lw;

    g.save();
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = lw;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(
      x1 - headLength * Math.cos(angle - 0.5),
      y1 - headLength * Math.sin(angle - 0.5)
    );
    g.lineTo(
      x1 - headLength * Math.cos(angle + 0.5),
      y1 - headLength * Math.sin(angle + 0.5)
    );
    g.closePath();
    g.fill();
    g.restore();
  }

  function arrowPair(g, spec) {
    const x = spec.x;
    const w = spec.w;
    const top = spec.top;
    const surfaceY = spec.surfaceY;
    const colors = spec.colors;
    const evapX = x + 0.28 * w;
    const condX = x + 0.72 * w;
    const length = Math.min(30, 0.28 * (surfaceY - top));

    g.save();
    arrow(g, evapX, surfaceY - 2, evapX, surfaceY - 2 - length, colors.t2, 2.2);
    arrow(g, condX, surfaceY - 2 - length, condX, surfaceY - 2, colors.t2, 2.2);
    g.fillStyle = colors.t1;
    g.font = "600 11px system-ui,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText((spec.numbered ? "① " : "") + spec.evapText, evapX, surfaceY + 16);
    g.fillText((spec.numbered ? "③ " : "") + spec.condText, condX, surfaceY + 16);
    if (spec.numbered) {
      g.fillStyle = colors.dBlue;
      g.font = "600 12px system-ui,sans-serif";
      g.fillText("②", x + w / 2, surfaceY - 0.45 * (surfaceY - top));
    }
    g.restore();
  }

  function h2o(g, x, y, r, ang, colors) {
    const halfAngle = 104.5 * Math.PI / 360;
    const bondLength = 0.95 * r;
    const hydrogenRadius = 0.62 * r;
    const angle1 = ang - Math.PI / 2 - halfAngle;
    const angle2 = ang - Math.PI / 2 + halfAngle;
    const h1x = x + Math.cos(angle1) * bondLength;
    const h1y = y + Math.sin(angle1) * bondLength;
    const h2x = x + Math.cos(angle2) * bondLength;
    const h2y = y + Math.sin(angle2) * bondLength;

    g.save();
    g.strokeStyle = colors.dGray;
    g.lineWidth = Math.max(1, 0.22 * r);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(h1x, h1y);
    g.moveTo(x, y);
    g.lineTo(h2x, h2y);
    g.stroke();

    g.fillStyle = colors.cpkH;
    g.strokeStyle = colors.hStroke;
    g.lineWidth = Math.max(1.1, 0.25 * r);
    g.beginPath();
    g.arc(h1x, h1y, hydrogenRadius, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(h2x, h2y, hydrogenRadius, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    g.fillStyle = colors.cpkO;
    g.strokeStyle = colors.oStroke;
    g.lineWidth = Math.max(1, 0.16 * r);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function solute(g, x, y, r, colors) {
    g.save();
    g.fillStyle = colors.solFill;
    g.strokeStyle = colors.solStroke;
    g.lineWidth = Math.max(1.2, 0.18 * r);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function loupe(g, spec, drawInside) {
    const cx = spec.cx;
    const cy = spec.cy;
    const R = spec.R;
    const src = spec.src;
    const colors = spec.colors;
    const loupeIsRight = cx >= src.x + src.w / 2;
    const sourceX = loupeIsRight ? src.x + src.w : src.x;
    const tangentX = cx + (loupeIsRight ? -0.72 : 0.72) * R;
    const surfaceY = spec.kind === "surface" ? cy - 0.05 * R : cy - R;

    g.save();
    g.strokeStyle = colors.dGray;
    g.globalAlpha = 0.75;
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(sourceX, src.y);
    g.lineTo(tangentX, cy - 0.72 * R);
    g.stroke();
    g.beginPath();
    g.moveTo(sourceX, src.y + src.h);
    g.lineTo(tangentX, cy + 0.72 * R);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    g.strokeStyle = colors.dBlue;
    g.lineWidth = 1.6;
    g.strokeRect(src.x, src.y, src.w, src.h);

    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = colors.cpkH;
    g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.fillStyle = colors.water;
    g.fillRect(cx - R, surfaceY, 2 * R, cy + R - surfaceY);
    if (spec.solnAlpha > 0) {
      g.globalAlpha = spec.solnAlpha;
      g.fillStyle = colors.soln;
      g.fillRect(cx - R, surfaceY, 2 * R, cy + R - surfaceY);
      g.globalAlpha = 1;
    }
    if (spec.kind === "surface") {
      g.strokeStyle = colors.waterLine;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(cx - R, surfaceY);
      g.lineTo(cx + R, surfaceY);
      g.stroke();
    }
    if (typeof drawInside === "function") {
      drawInside(g, { cx: cx, cy: cy, R: R, surfaceY: surfaceY });
    }
    g.restore();

    g.strokeStyle = colors.dGray;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    if (spec.title) {
      g.fillStyle = colors.t2;
      g.font = "600 10.5px system-ui,sans-serif";
      g.fillText(spec.title, cx, cy - R - 14);
    }
    if (spec.sub) {
      g.fillStyle = colors.dAmber;
      g.font = "600 10px system-ui,sans-serif";
      g.fillText(spec.sub, cx, cy - R - 3);
    }
    if (spec.foot) {
      g.fillStyle = colors.t3;
      g.font = "10px system-ui,sans-serif";
      g.fillText(spec.foot, cx, cy + R + 14);
    }
    g.setLineDash([]);
    g.restore();
  }

  function valueBlock(g, spec) {
    const colors = spec.colors;

    g.save();
    g.textBaseline = "alphabetic";
    if (spec.mode === "side") {
      g.textAlign = "left";
      g.fillStyle = colors.t3;
      g.font = "11px system-ui,sans-serif";
      g.fillText(spec.atmLabel, spec.x, spec.y - 30);
      g.fillStyle = colors.t1;
      g.font = "600 13px system-ui,sans-serif";
      g.fillText(spec.atmText, spec.x, spec.y - 14);
      g.fillStyle = colors.t3;
      g.font = "11px system-ui,sans-serif";
      g.fillText(spec.title, spec.x, spec.y + 12);
      g.fillStyle = colors.dBlue;
      g.font = "600 15px system-ui,sans-serif";
      g.fillText(spec.pressureText, spec.x, spec.y + 30);
      g.fillStyle = colors.t3;
      g.font = "10.5px system-ui,sans-serif";
      g.fillText(spec.atmEqText, spec.x, spec.y + 46);
    } else {
      g.textAlign = "center";
      g.fillStyle = colors.dBlue;
      g.font = "600 13px system-ui,sans-serif";
      g.fillText(spec.title + " " + spec.pressureText, spec.x, spec.y);
      g.fillStyle = colors.t3;
      g.font = "10.5px system-ui,sans-serif";
      g.fillText(spec.atmLabel + " " + spec.atmText, spec.x, spec.y + 15);
    }
    g.restore();
  }

  function legend(g, spec) {
    const centered = spec.align === "center";

    g.save();
    g.fillStyle = spec.colors.t2;
    g.font = "11px system-ui,sans-serif";
    g.textAlign = centered ? "center" : "left";
    g.textBaseline = "alphabetic";
    spec.lines.forEach(function (line, index) {
      g.fillText(centered ? line.trim() : line, spec.x, spec.y + index * 15);
    });
    g.restore();
  }

  function deltaP(g, spec) {
    g.save();
    g.fillStyle = spec.colors.dRed;
    g.font = "600 12px system-ui,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText("ΔP", spec.x, spec.y);
    g.fillText(spec.text, spec.x, spec.y + 15);
    g.restore();
  }

  function caption(g, spec) {
    g.save();
    g.fillStyle = spec.colors.t3;
    g.font = "11px system-ui,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(spec.text, spec.x, spec.y);
    g.restore();
  }

  window.RAOULT_DESIGN = Object.freeze({
    beakerBack: beakerBack,
    beakerFront: beakerFront,
    arrowPair: arrowPair,
    h2o: h2o,
    solute: solute,
    arrow: arrow,
    loupe: loupe,
    valueBlock: valueBlock,
    legend: legend,
    deltaP: deltaP,
    caption: caption
  });
}());



const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
["--t1","--t2","--t3","--line","--panel","--accent","--d-blue","--d-cyan","--d-red",
 "--d-green","--d-amber","--d-violet","--d-gray","--p-silver","--p-yellow","--stage-line"].forEach(k => {
  C[k.slice(2)] = CSSV(k) || "#888";
});
const REDUCED = matchMedia("(prefers-reduced-motion:reduce)").matches;

/* CPK 는 토큰 예외다(매뉴얼 §4). 테두리는 waterdensity 와 같은 darker() 로 만든다 */
const CPK_O = "#FF0D0D", CPK_H = "#FFFFFF";
function darker(hex, f) {
  if (!hex.startsWith("#") || hex.length < 7) return "rgb(80,80,80)";
  const n = parseInt(hex.slice(1, 7), 16);
  return "rgb(" + Math.round((n >> 16 & 255) * f) + "," + Math.round((n >> 8 & 255) * f) + "," +
    Math.round((n & 255) * f) + ")";
}
const O_STROKE = darker(CPK_O, 0.5), H_STROKE = darker(CPK_H, 0.45);
/* 용질 = 노랑 (사용자 확정 2026-09-07 · 교과서 그림 Ⅱ-10 의 용질 색). 빨강은 CPK O 와 겹친다 */
const SOL_FILL = C["p-yellow"], SOL_STROKE = darker(C["p-yellow"], 0.55);
const HOH_DEG = 104.5;
const WATER_FILL = "rgba(37,99,235,0.42)", WATER_LINE = "rgba(29,78,216,0.9)";
const SOLN_FILL = "rgba(250,204,21,0.22)";

/* ── 단계 × 요소 가시성의 «단일 원천» (매뉴얼 §13①). applyStep() 만 display 를 건드린다. */
const SHOW = {
  1: { tCtl:0, xsCtl:0, loupeBtn:1, injectBtn:0, recBtn:0, recWrap:0, roPpure:0, roDp:0, roX:0 },
  2: { tCtl:1, xsCtl:0, loupeBtn:1, injectBtn:0, recBtn:0, recWrap:0, roPpure:0, roDp:0, roX:0 },
  3: { tCtl:0, xsCtl:0, loupeBtn:0, injectBtn:1, recBtn:0, recWrap:0, roPpure:0, roDp:0, roX:1 },
  4: { tCtl:0, xsCtl:0, loupeBtn:1, injectBtn:0, recBtn:0, recWrap:0, roPpure:0, roDp:0, roX:1 },
  5: { tCtl:0, xsCtl:0, loupeBtn:0, injectBtn:0, recBtn:0, recWrap:0, roPpure:1, roDp:1, roX:1 },
  6: { tCtl:1, xsCtl:1, loupeBtn:0, injectBtn:0, recBtn:1, recWrap:1, roPpure:1, roDp:1, roX:1 }
};
/* ⚠ style.display = "" 는 .is-off 클래스를 못 이긴다 — 명시값을 쓴다(매뉴얼 §13④ · 실측) */
const SHOWVAL = { tCtl:"block", xsCtl:"block", loupeBtn:"inline-block", injectBtn:"inline-block",
  recBtn:"inline-block", recWrap:"block", roPpure:"block", roDp:"block", roX:"block", roSurf:"block" };

const TITLE = {
  1: "뚜껑을 덮은 직후 — 무슨 일이 일어나는가?",
  2: "증발하는 수 = 응축하는 수가 되면?",
  3: "용질을 넣으면 어디로 가는가?",
  4: "표면에는 용질이 더 많을까?",
  5: "압력계 두 개를 견주면?",
  6: "용질을 더 넣을수록?"
};
const DESC = {
  1: "밀폐한 비커 속 물입니다. ▶ 를 누르면 표면에서 분자가 떠나 액면 근처에 쌓이기 시작하고, 쌓인 분자 중 일부는 되돌아옵니다. 압력계 바늘이 어떻게 움직이는지 보세요.",
  2: "떠나는 수와 되돌아오는 수가 같아지면 바늘이 멈춥니다 — 그때가 동적 평형이고, 바늘이 가리키는 값이 증기 압력입니다. 온도를 바꿔 다시 평형을 찾아보세요.",
  3: "「용질 넣기」를 누르면 비휘발성 용질(노랑)이 액체 «전체»로 퍼집니다. 표면에 뜨지도, 바닥에 가라앉지도 않습니다.",
  4: "「분자 수준으로 확대해 보기」로 액체 «속» 한 곳과 «표면» 한 곳을 각각 세어 보세요. 뽑을 때마다 조금씩 다르지만 어느 쪽으로도 치우치지 않습니다.",
  5: "왼쪽은 순수한 물, 오른쪽은 용액입니다. 같은 온도에서 두 압력계를 견주세요.",
  6: "용질의 몰분율을 올려 가며 평형마다 「지금 값 기록」을 눌러 표를 채우세요. 내려간 값 ΔP 가 몰분율과 어떻게 이어지는지 찾아보세요."
};
const NOTE = {
  1: "표면을 떠난 분자는 <b>액면 근처에 머무르며</b> 표면에 부딪힙니다. 이 부딪힘이 압력계를 밀어 올립니다.",
  2: "<b>증기 압력</b>은 동적 평형에 이르렀을 때 기체가 나타내는 압력입니다. 액체의 양이나 그릇의 부피와는 관계가 없습니다.",
  3: "용질은 액체 <b>전체</b>에 고르게 퍼집니다. 용액 전체에서 물 분자가 차지하는 비율이 그만큼 줄어듭니다.",
  4: "표면의 조성은 <b>전체의 조성과 같습니다.</b> 표면이 특별한 곳이 아닙니다.",
  5: "용질이 있으면 용매는 그 액체를 <b>떠나기 어려워집니다.</b> 붙잡혀서가 아니라, <b>용액 전체에서</b> 용매 분자가 차지하는 비율이 줄었기 때문입니다.",
  6: "내려간 값 ΔP 는 <b>용질의 몰분율에 비례</b>합니다 — 용질의 종류나 크기가 아니라 «개수의 비율»만 봅니다."
};
const SIDE = {
  1: "바늘이 올라가는 동안은 떠나는 수가 되돌아오는 수보다 많습니다.",
  2: "온도를 올리면 떠나는 분자가 늘고, 그만큼 되돌아오는 분자도 늘어 더 높은 압력에서 다시 평형이 됩니다.",
  3: "몰분율은 «용액 전체»의 조성량입니다.",
  4: "두 돋보기는 서로 «따로» 뽑습니다. 여러 번 누적하면 두 비율이 가까워집니다.",
  5: "두 비커는 온도·부피·뚜껑이 같습니다. 다른 것은 용질뿐입니다.",
  6: "표의 ΔP 를 몰분율로 나눠 보세요 — 온도가 같으면 그 비가 거의 같습니다."
};

/* ── 상태 ─────────────────────────────────────────────────────── */
const st = {
  step: 1,
  t: RAOULT.T.init,
  xs: 0.03,
  running: false,          // 첫 진입은 «일시정지» (매뉴얼 §10)
  loupe: false,
  injected: false,         // 3단계에서 「용질 넣기」를 눌렀는가
  diffuse: 0,              // 용질 확산 진행 0~1
  nPure: 0, nSol: 0,       // 기체 분자 수 (결정론 · 계산부)
  eqSince: null, clock: 0,
  cumA: 0, cumB: 0, cumN: 0, cumSeed: -1,   // 4단계 두 돋보기 누적 표집
  rec: []                  // 6단계 기록 표
};
/* 용질이 «들어 있는» 단계인가 — 계산부에 넘길 X용질 */
function activeXs() { return (st.step >= 4 || (st.step === 3 && st.injected)) ? st.xs : 0; }
function twoBeakers() { return st.step >= 5; }
/* 그림에 용질이 «있는» 단계인가. 3단계는 「용질 넣기」를 누른 뒤부터다 — 누르기 전에 점 하나와
   「용액」 라벨이 먼저 보이면 「누르면 퍼진다」는 이 단계의 논지가 무너진다(390 px 육안 실측) */
function soluteShown() { return st.step === 3 ? st.injected : st.step >= 3; }

/* ── 압력 표기 단일 원천 (매뉴얼 §14④ · 유효숫자 3자리 — P5 M7) ─────────── */
function sig3(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
function setPress(mmHg) { return (mmHg / RAOULT.MMHG_PER_ATM).toFixed(3) + " atm (" + sig3(mmHg) + " mmHg)"; }

/* ── 캔버스 ─────────────────────────────────────────────────── */
const stageCv = $("stage");
function sizeCanvas(cv, hCss) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = hCss + "px";
  const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(hCss * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: cv.clientWidth, h: hCss };
}
/* 결정론적 난수 — 프로브 재현성 */
function rnd(seed) { return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1; }

/* ── 정적 2D 도식 — 코덱스 납품(window.RAOULT_DESIGN)이 있으면 그것, 없으면 FALLBACK ─────
   계약: Codex_디자인요청_증기압력내림_v3.md §3·§4 — 11 함수 · 순수 · 색·좌표·문자열은 전부 인자.
   FALLBACK 은 이 판까지 쓰던 요청자 구현(waterdensity 와 같은 모양)이다. */
const FALLBACK_DESIGN = {
  h2o(g, x, y, r, ang, c) {
    const half = HOH_DEG / 2 * Math.PI / 180, L = r * 0.95, rH = r * 0.62;
    for (let k = 0; k < 2; k++) {
      const a = ang - Math.PI / 2 + (k ? half : -half);
      const hx = x + Math.cos(a) * L, hy = y + Math.sin(a) * L;
      g.strokeStyle = "rgba(90,100,112,0.85)"; g.lineWidth = Math.max(1, r * 0.22);
      g.beginPath(); g.moveTo(x, y); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = c.cpkH; g.strokeStyle = c.hStroke; g.lineWidth = Math.max(1.1, r * 0.25);
      g.beginPath(); g.arc(hx, hy, rH, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = c.cpkO; g.strokeStyle = c.oStroke; g.lineWidth = Math.max(1, r * 0.16);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  solute(g, x, y, r, c) {
    g.fillStyle = c.solFill; g.strokeStyle = c.solStroke; g.lineWidth = Math.max(1.2, r * 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  arrow(g, x0, y0, x1, y1, col, lw) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0), hl = 6 + lw;
    g.beginPath(); g.moveTo(x1, y1);
    g.lineTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5));
    g.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
    g.closePath(); g.fill();
  },
  beakerBack(g, s) {
    const { x, y, w, h, surfaceY: sy, colors: c } = s, bot = y + h;
    g.fillStyle = c.water; g.fillRect(x + 2, sy, w - 4, bot - sy);
    if (s.solnAlpha > 0) { g.save(); g.globalAlpha = s.solnAlpha; g.fillStyle = c.soln; g.fillRect(x + 2, sy, w - 4, bot - sy); g.restore(); }
    g.strokeStyle = c.waterLine; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(x + 2, sy); g.lineTo(x + w - 2, sy); g.stroke();
  },
  beakerFront(g, s) {
    const { x, y: top, w, h, surfaceY: sy, colors: c } = s, bot = top + h;
    g.save();
    g.strokeStyle = c.stageLine; g.lineWidth = 2.6; g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, top + 4); g.lineTo(x, bot); g.lineTo(x + w, bot); g.lineTo(x + w, top + 4); g.stroke();
    g.fillStyle = c.dGray; g.fillRect(x - 5, top - 2, w + 10, 6);
    g.fillRect(x + w / 2 - 3, top - 10, 6, 8);          // 압력계 연결관
    g.strokeStyle = c.glassHi; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x + 7, top + 18); g.lineTo(x + 7, bot - 12); g.stroke();
    g.restore();
    if (s.label) { g.fillStyle = c.t1; g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center"; g.fillText(s.label, x + w / 2, sy + (bot - sy) * 0.80); }
  },
  arrowPair(g, s) {
    const { x, w, top, surfaceY: sy, colors: c } = s;
    const ax = x + w * 0.28, bx2 = x + w * 0.72, len = Math.min(30, (sy - top) * 0.28);
    FALLBACK_DESIGN.arrow(g, ax, sy - 2, ax, sy - 2 - len, c.t2, 2.2);
    FALLBACK_DESIGN.arrow(g, bx2, sy - 2 - len, bx2, sy - 2, c.t2, 2.2);
    g.fillStyle = c.t1; g.font = "600 11px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText((s.numbered ? "① " : "") + s.evapText, ax, sy + 16);
    g.fillText((s.numbered ? "③ " : "") + s.condText, bx2, sy + 16);
    if (s.numbered) { g.fillStyle = c.dBlue; g.font = "600 12px system-ui,sans-serif"; g.fillText("②", x + w / 2, sy - (sy - top) * 0.45); }
  },
  loupe(g, s, drawInside) {
    const { cx, cy, R, src, kind, colors: c } = s;
    g.save();
    g.strokeStyle = "rgba(120,132,148,0.75)"; g.lineWidth = 1; g.setLineDash([3, 3]);
    const sx = src.x + src.w, toLeft = cx > sx;
    const t1 = toLeft ? [cx - R * 0.72, cy - R * 0.72] : [cx + R * 0.72, cy - R * 0.72];
    const t2 = toLeft ? [cx - R * 0.72, cy + R * 0.72] : [cx + R * 0.72, cy + R * 0.72];
    g.beginPath(); g.moveTo(toLeft ? sx : src.x, src.y); g.lineTo(t1[0], t1[1]); g.stroke();
    g.beginPath(); g.moveTo(toLeft ? sx : src.x, src.y + src.h); g.lineTo(t2[0], t2[1]); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = c.dBlue; g.lineWidth = 1.6; g.strokeRect(src.x, src.y, src.w, src.h);
    g.restore();
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = "#ffffff"; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const surfaceY = kind === "surface" ? cy - R * 0.05 : cy - R - 10;
    g.fillStyle = c.water; g.fillRect(cx - R, surfaceY, 2 * R, cy + R - surfaceY);
    if (s.solnAlpha > 0) { g.save(); g.globalAlpha = s.solnAlpha; g.fillStyle = c.soln; g.fillRect(cx - R, surfaceY, 2 * R, cy + R - surfaceY); g.restore(); }
    if (kind === "surface") { g.strokeStyle = c.waterLine; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - R, surfaceY); g.lineTo(cx + R, surfaceY); g.stroke(); }
    if (typeof drawInside === "function") drawInside(g, { cx, cy, R, surfaceY });
    g.restore();
    g.strokeStyle = c.dGray; g.lineWidth = 2.4; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center";
    if (s.title) { g.fillStyle = c.t2; g.font = "600 10.5px system-ui,sans-serif"; g.fillText(s.title, cx, cy - R - 14); }
    if (s.sub) { g.fillStyle = c.dAmber; g.font = "600 10px system-ui,sans-serif"; g.fillText(s.sub, cx, cy - R - 3); }
    if (s.foot) { g.fillStyle = c.t3; g.font = "10px system-ui,sans-serif"; g.fillText(s.foot, cx, cy + R + 14); }
  },
  valueBlock(g, s) {
    const c = s.colors;
    if (s.mode === "side") {
      const tx = s.x, sy = s.y; g.textAlign = "left";
      g.fillStyle = c.t3; g.font = "11px system-ui,sans-serif"; g.fillText(s.atmLabel, tx, sy - 30);
      g.fillStyle = c.t1; g.font = "600 13px system-ui,sans-serif"; g.fillText(s.atmText, tx, sy - 14);
      g.fillStyle = c.t3; g.font = "11px system-ui,sans-serif"; g.fillText(s.title, tx, sy + 12);
      g.fillStyle = c.dBlue; g.font = "600 15px system-ui,sans-serif"; g.fillText(s.pressureText, tx, sy + 30);
      g.fillStyle = c.t3; g.font = "10.5px system-ui,sans-serif"; g.fillText(s.atmEqText, tx, sy + 46);
    } else {
      g.textAlign = "center";
      g.fillStyle = c.dBlue; g.font = "600 13px system-ui,sans-serif"; g.fillText(s.title + " " + s.pressureText, s.x, s.y);
      g.fillStyle = c.t3; g.font = "10.5px system-ui,sans-serif"; g.fillText(s.atmLabel + " " + s.atmText, s.x, s.y + 15);
    }
  },
  legend(g, s) {
    g.font = "11px system-ui,sans-serif"; g.fillStyle = s.colors.t2; g.textAlign = s.align === "center" ? "center" : "left";
    s.lines.forEach((t, i) => g.fillText(s.align === "center" ? t.trim() : t, s.x, s.y + i * 15));
  },
  deltaP(g, s) {
    g.fillStyle = s.colors.dRed; g.font = "600 12px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("ΔP", s.x, s.y); g.fillText(s.text, s.x, s.y + 15);
  },
  caption(g, s) {
    g.fillStyle = s.colors.t3; g.font = "11px system-ui,sans-serif"; g.textAlign = "center"; g.fillText(s.text, s.x, s.y);
  }
};
const DESIGN = (typeof window !== "undefined" && window.RAOULT_DESIGN) ? window.RAOULT_DESIGN : FALLBACK_DESIGN;
/* 색 묶음 — 도식 모듈에 넘기는 유일한 색 원천(토큰 + CPK 예외) */
const DC = { t1: C.t1, t2: C.t2, t3: C.t3, line: C.line, stageLine: C["stage-line"], dBlue: C["d-blue"], dRed: C["d-red"],
  dAmber: C["d-amber"], dGray: C["d-gray"], glassHi: "rgba(160,200,228,0.75)", water: WATER_FILL, waterLine: WATER_LINE,
  soln: SOLN_FILL, cpkO: CPK_O, cpkH: CPK_H, oStroke: O_STROKE, hStroke: H_STROKE, solFill: SOL_FILL, solStroke: SOL_STROKE };
function drawH2O(g, x, y, r, ang) { DESIGN.h2o(g, x, y, r, ang, DC); }
function drawSolute(g, x, y, r) { DESIGN.solute(g, x, y, r, DC); }
function arrow(g, x0, y0, x1, y1, col, lw) { DESIGN.arrow(g, x0, y0, x1, y1, col, lw); }
/* ── 운동·압력계 — 코덱스 납품(window.RAOULT_MOTION)이 있으면 그것, 없으면 FALLBACK ─────
   계약: vapor(opt)→{step(dt,state),draw(g,state,drawParticle),count()} · solute 동형 · gauge()→{draw(g,state)}
   FALLBACK 은 «화면이 멈추지 않게 하는 최소 구현»이다. 요구(표면에서 생성·소멸 · 표면 근처 밀도 ·
   깜빡임 없음 · 용질 자유 운동)는 같은 방향으로 만족시키되 정교함은 납품분이 맡는다. */
/* ⚠ 운동의 난수는 mulberry32 다(waterdensity 와 같다). rnd() 의 sin 해시를 «연속 호출»하면 값이 상관되어
   입자가 한쪽으로 흘렀다(10회 시간 평균 사분면 699/1487/474/690 — 실측). 정적 배치엔 rnd 를 써도 된다. */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const FALLBACK_MOTION = {
  vapor(opt) {
    const P = [], seed = (opt && opt.seed) || 1;
    let acc = 0;
    const R = mulberry32(seed * 7919);
    return {
      step(dt, s) {
        const r = s.rect, sy = s.surfaceY, cap = 400;
        const want = Math.min(cap, Math.max(0, s.targetN));
        /* 개수 추종 — 프레임당 최대 3건, 생성은 «표면에서», 소멸은 표면에 닿은 것만 */
        /* 초기 상승 속도와 아래 되돌림은 «공간 높이에 비례» — 절대 px/s 로 두면 낮은 비커(두 비커 판)에서
           뚜껑에 더 자주 닿아 분포가 평평해진다(실측 54 %). 생성은 프레임당 2건까지 — 3건이면 100 ms 창에서 23 % 튀었다 */
        /* 최대 도달 높이 ≈ up²/(2·되돌림). 0.20·h 로 두니 26 px 를 못 넘어 액면에 «막»처럼 붙었다(100 %).
           0.45·h 면 빠른 것은 공간의 절반쯤 올라가고 느린 것은 낮게 머문다 — «대부분» 근처, «전부» 아님 */
        const up = 20 + 0.45 * r.h;
        let diff = want - P.length, ops = 0;
        while (diff > 0.5 && ops < 2) { P.push({ x: r.x + 6 + R() * (r.w - 12), y: sy - 2, vx: (R() - 0.5) * 30, vy: -up * (0.6 + 0.8 * R()), dying: false }); diff--; ops++; }
        if (diff < -0.5) { for (const p of P) if (ops < 3 && !p.dying && p.y > sy - r.h * 0.35) { p.dying = true; p.vy = Math.abs(p.vy) + 20; ops++; if (++diff >= -0.5) break; } }
        /* 평형에서도 교환 — 초당 한 쌍 정도 */
        acc += dt; if (acc > 0.9 && P.length > 3 && Math.abs(diff) < 0.5) { acc = 0; const k = P.findIndex(p => !p.dying && p.y > sy - r.h * 0.3); if (k >= 0) { P[k].dying = true; P[k].vy = 30; } P.push({ x: r.x + 6 + R() * (r.w - 12), y: sy - 2, vx: (R() - 0.5) * 30, vy: -25 - R() * 25, dying: false }); }
        /* reduced: 운동은 멈추되 «개수»는 따라간다. 한 줄에 몰아 두지 않고 액면 근처 띠(아래 35 %)에 고정 배치 —
           한 줄이면 서로 겹쳐 한 개처럼 보이고 말풍선에 가려진다(육안 실측) */
        if (s.reduced) {
          for (let i = P.length - 1; i >= 0; i--) if (P[i].dying) P.splice(i, 1);
          for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.y > sy - 5 || p.y < r.y + 6) { p.y = sy - 5 - rnd(seed * 77 + i * 3) * r.h * 0.35; } }
          return;
        }
        const step = Math.min(dt, 0.05);
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i];
          p.vy += (18 + 0.25 * r.h) * step;                   // 액면 쪽 되돌림(공간 높이에 비례) → 표면 근처 밀도
          p.vx += (R() - 0.5) * 8 * step;
          const sp = Math.hypot(p.vx, p.vy); if (sp > 55) { p.vx *= 55 / sp; p.vy *= 55 / sp; }
          p.x += p.vx * step; p.y += p.vy * step;
          if (p.x < r.x + 4) { p.x = r.x + 4; p.vx = Math.abs(p.vx); }
          if (p.x > r.x + r.w - 4) { p.x = r.x + r.w - 4; p.vx = -Math.abs(p.vx); }
          if (p.y < r.y + 6) { p.y = r.y + 6; p.vy = Math.abs(p.vy) * 0.6; }
          if (p.y > sy - 3) { if (p.dying) { P.splice(i, 1); continue; } p.y = sy - 3; p.vy = -Math.abs(p.vy) * 0.9 - 8; }
        }
      },
      draw(g, s, dp) { for (let i = 0; i < P.length; i++) dp(g, P[i].x, P[i].y, i); },
      count() { return P.length; }
    };
  },
  solute(opt) {
    const P = [], seed = (opt && opt.seed) || 2;
    const R = mulberry32(seed * 104729);
    return {
      step(dt, s) {
        const r = s.rect;
        while (P.length < s.count) P.push({ u: R(), v: R(), vx: (R() - 0.5) * 12, vy: (R() - 0.5) * 12 });
        while (P.length > s.count) P.pop();
        if (s.reduced) return;
        const step = Math.min(dt, 0.05);
        for (const p of P) {
          p.vx += (R() - 0.5) * 20 * step; p.vy += (R() - 0.5) * 20 * step;
          const sp = Math.hypot(p.vx, p.vy); if (sp > 14) { p.vx *= 14 / sp; p.vy *= 14 / sp; }
          p.u += p.vx * step / r.w; p.v += p.vy * step / r.h;
          if (p.u < 0.03) { p.u = 0.03; p.vx = Math.abs(p.vx); } if (p.u > 0.97) { p.u = 0.97; p.vx = -Math.abs(p.vx); }
          if (p.v < 0.05) { p.v = 0.05; p.vy = Math.abs(p.vy); } if (p.v > 0.95) { p.v = 0.95; p.vy = -Math.abs(p.vy); }
        }
      },
      draw(g, s, dp) {
        const r = s.rect, e = 1 - Math.pow(1 - s.diffuse01, 3), ix = s.injectXY.x, iy = s.injectXY.y;
        for (let i = 0; i < P.length; i++) {
          const tx = r.x + P[i].u * r.w, ty = r.y + P[i].v * r.h;
          dp(g, ix + (tx - ix) * e, iy + (ty - iy) * e, i);
        }
      },
      count() { return P.length; }
    };
  },
  gauge() {
    return {
      draw(g, s) {
        const { cx, cy, r } = s, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        g.fillStyle = s.colors.face; g.strokeStyle = s.colors.rim; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = s.colors.tick; g.lineWidth = 1.2;
        for (let k = 0; k <= 4; k++) {
          const a = a0 + (a1 - a0) * k / 4;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); g.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); g.stroke();
        }
        g.fillStyle = s.colors.text; g.font = "9px system-ui,sans-serif"; g.textAlign = "center";
        g.fillText("0", cx + Math.cos(a0) * (r - 14), cy + Math.sin(a0) * (r - 14) + 3);
        g.fillText(sig3(s.max), cx + Math.cos(a1) * (r - 14), cy + Math.sin(a1) * (r - 14) + 3);
        const a = a0 + (a1 - a0) * Math.max(0, Math.min(1, s.value / s.max));
        g.strokeStyle = s.colors.needle; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.stroke();
        g.fillStyle = s.colors.needle; g.beginPath(); g.arc(cx, cy, 2.6, 0, Math.PI * 2); g.fill();
        /* 라벨은 알 «밖» 아래에 — 안에 쓰면 r=22 에서 바늘·눈금과 겹친다(육안 실측) */
        g.fillStyle = s.colors.muted; g.font = "600 9.5px system-ui,sans-serif";
        g.fillText(s.label, cx + r + 4, cy + 4);
        g.textAlign = "left";
      }
    };
  }
};
const MOTION = (typeof window !== "undefined" && window.RAOULT_MOTION) ? window.RAOULT_MOTION : FALLBACK_MOTION;
/* ⚠ reduced-motion 에서는 기체만 FALLBACK 을 쓴다. 납품 모듈은 RM 에서 「살아 있는 입자의 위치를 바꾸지
   않는다」를 문자 그대로 지켜, 액면 2 px 위에서 태어난 입자가 영영 그 자리에 남아 «한 줄 막»이 된다(프로브·육안).
   FALLBACK 은 RM 에서 입자를 액면 근처 «띠»에 정적으로 흩어 둔다 — 개수는 똑같이 상태를 따른다.
   납품 파일은 고치지 않는다(원본 보존 · N5-1). 이 분기는 통합 보정이며 README 에도 적었다. */
const VAPOR_FACTORY = REDUCED ? FALLBACK_MOTION.vapor : MOTION.vapor;
const vapP = VAPOR_FACTORY({ seed: 7 }), vapS = VAPOR_FACTORY({ seed: 13 }), solM = MOTION.solute({ seed: 11 }), dial = MOTION.gauge();
const GAS_MMHG = 3;                                   // 그림의 기체 분자 1개 ≈ 3 mmHg (index.html 「다루지 않는 것」과 같은 수)
const GAS_SCALE = 1 / (GAS_MMHG * RAOULT.SCALE);      // 계산부 분자 수 → 화면 입자 수 (60 ℃ 에서 약 50개, 상한 400 안)
const SOL_DOTS = 24;                 // X용질 0.05 에서 24개. 개수는 도식이다(정직한 «비율»은 돋보기가 센다)
function soluteDots(xs) { return Math.round(SOL_DOTS * xs / RAOULT.XS.max); }
const MOTION_COLORS = { face: "#ffffff", rim: C["stage-line"], needle: C["d-red"], tick: C["d-gray"], text: C.t2, muted: C.t3 };

/* ── 배치 ────────────────────────────────────────────────────── */
const H_BASE = 440;
const DIAL_R = 34, DIAL_H = 84, DIAL_MAX = 200, GAP2 = 40;
/* 3단계 「용질 넣기」 단추 자리 — 무대 «안» 비커 오른쪽 (사용자 확정 2026-09-07:
   태블릿·휴대폰에서 그림 아래 단추줄까지 손이 가야 하는 것이 불편하다).
   너비는 «넣은 뒤» 글자(「용질을 넣었습니다」)가 한 줄로 들어가는 값이다. */
const INJ_W = 142, INJ_GAP = 12;   // 압력계 반지름 · 뚜껑 위 자리 · 눈금 끝(mmHg, 온도를 바꿔도 같은 계기) · 두 비커 사이
function layout(w) {
  const narrow = w < 520;
  const nB = twoBeakers() ? 2 : 1;
  const nL = st.loupe ? (st.step === 4 ? 2 : 1) : 0;
  const pad = 12, dialH = DIAL_H;
  let R = 0, loupeW = 0, loupeH = 0;
  if (nL) {
    if (narrow) { R = Math.max(40, Math.min(66, (w - pad * 2 - 24) / (nL * 2 + 0.6))); loupeH = 2 * R + 74; }
    else { R = nL === 2 ? 56 : 82; loupeW = 2 * R + 40; }
  }
  const H = H_BASE + loupeH;
  const textW = (!narrow && nB === 1) ? 150 : 0;   // 비커 옆 글자 칸 (비커 하나일 때)
  const textLeft = textW > 0 && nL > 0;            // 돋보기가 켜지면 글자 칸을 «왼쪽»으로 — 연결 점선이 글자를 가로지르지 않게(육안)
  /* 비커 «아래» 글자: 비커가 둘이거나 화면이 좁으면 값 두 줄. 1단계 좁은 화면이면 범례 네 줄 더 */
  const under = (nB === 2 || narrow) ? 34 + ((narrow && st.step === 1) ? 62 : 0) : 0;
  const injCol = (st.step === 3 && narrow) ? INJ_W + INJ_GAP * 2 : 0;   // 좁은 화면은 단추 칸을 따로 비운다(넓으면 글자 칸을 함께 쓴다)
  const area = { x: pad + (textLeft ? textW : 0), y: pad + dialH, w: w - pad * 2 - loupeW - textW - injCol, h: H_BASE - pad - dialH - 26 - under };
  const bw = Math.max(70, Math.min(nB === 2 ? 210 : 250, (area.w - (nB - 1) * GAP2) / nB));
  const bx0 = area.x + (area.w - (bw * nB + (nB - 1) * GAP2)) / 2;
  const beakers = [];
  for (let i = 0; i < nB; i++) beakers.push({ x: bx0 + i * (bw + GAP2), y: area.y, w: bw, h: area.h });
  const loupes = [];
  if (nL) {
    if (!narrow) {
      const cx = w - pad - R - 8;
      const ys = nL === 2 ? [area.y + R + 4, area.y + area.h - R - 14] : [area.y + area.h / 2];
      ys.forEach(cy => loupes.push({ cx, cy, R }));
    } else {
      const cy = H_BASE + 24 + R;
      const xs = nL === 2 ? [w / 2 - R - 12, w / 2 + R + 12] : [w / 2];
      xs.forEach(cx => loupes.push({ cx, cy, R }));
    }
  }
  let inj = null;
  if (st.step === 3) {
    const b0 = beakers[0], sy0 = beakerSurfaceY(b0), bot0 = b0.y + b0.h;
    inj = narrow
      ? { x: b0.x + b0.w + INJ_GAP, y: sy0 + (bot0 - sy0) / 2 - 22, w: INJ_W }   // 액체 높이 가운데
      : { x: b0.x + b0.w + 16, y: sy0 + 66, w: INJ_W };                          // 값 글자 다섯 줄 «아래»
  }
  return { H, narrow, beakers, loupes, R, textW, textLeft, under, inj };
}

/* ── 비커 (2D 도식) — 그리기는 DESIGN(계약 §3), 배치·개수·운동은 여기 ─────────── */
const FILL_FRAC = 0.58;
function beakerSurfaceY(b) { return b.y + b.h - b.h * FILL_FRAC; }
function headspace(b) { return { x: b.x + 6, y: b.y + 8, w: b.w - 12, h: beakerSurfaceY(b) - b.y - 8 }; }
function liquidRect(b) { const sy = beakerSurfaceY(b); return { x: b.x + 8, y: sy + 8, w: b.w - 16, h: b.y + b.h - sy - 14 }; }

function drawBeaker(g, b, o) {
  const x = b.x, w = b.w, top = b.y, sy = beakerSurfaceY(b);
  /* 뒤: 액체(용질이 있으면 노랑을 옅게 — 전체에 퍼져 있음) + 액면 선 */
  DESIGN.beakerBack(g, { x, y: top, w, h: b.h, surfaceY: sy, solnAlpha: o.soluteAmt > 0.001 ? o.soluteAmt : 0, colors: DC });
  /* 용질 입자(운동은 팩토리) */
  if (o.solute) {
    const rS = Math.max(2.4, w * 0.02);
    o.solute.draw(g, { rect: liquidRect(b), count: o.soluteCount, injectXY: { x: x + w / 2, y: sy + 10 }, diffuse01: o.diffuse, reduced: REDUCED, colors: MOTION_COLORS },
      (gg, px, py) => drawSolute(gg, px, py, rS));
  }
  /* 증발·응축 화살표 한 쌍 — 분자보다 «먼저» 그려 분자가 그 앞을 지나가게 한다. 개수 글자는 액면 «아래»
     (기체 띠 위에 글자를 얹으면 지나가는 분자가 글자 밑에서 사라졌다 나타나 깜빡임으로 보인다 — 실측 · _raoult_diag.js) */
  if (o.evap !== undefined) DESIGN.arrowPair(g, { x, w, top, surfaceY: sy, evapText: "증발 " + o.evap, condText: "응축 " + o.cond, numbered: !!o.numbered, colors: DC });
  /* 기체 분자(운동은 팩토리) — H₂O. 눈으로 하나하나 따라갈 수 있는 크기 */
  if (o.vapor) {
    const rO = Math.max(2.6, Math.min(4.2, w * 0.017));
    o.vapor.draw(g, o.vaporState, (gg, px, py, i) => drawH2O(gg, px, py, rO, rnd(i + 3) * 6.28));
  }
  /* 앞: 유리 윤곽·뚜껑·연결관·라벨(액체 안 아래쪽 — 4단계 표본 상자·개수 글자와 겹치지 않게) */
  DESIGN.beakerFront(g, { x, y: top, w, h: b.h, surfaceY: sy, label: o.label || "", colors: DC });
  /* 압력계 다이얼 — 뚜껑 위 (v2 납품 gauge) */
  dial.draw(g, { cx: x + w / 2, cy: top - (DIAL_H - 38), r: DIAL_R, value: o.pressure, max: o.pmax, label: "압력계", sub: "mmHg", colors: MOTION_COLORS, reduced: REDUCED });
}
/* 비커 옆(또는 아래) 글자 — 대기압·증기 압력 값. 세로 막대 대신 이것이 «값»의 자리다 */
function drawValues(g, b, L, o) {
  const pt = sig3(o.pressure) + " mmHg", eq = "= " + (o.pressure / 760).toFixed(3) + " atm";
  if (L.textW) DESIGN.valueBlock(g, { mode: "side", x: L.textLeft ? b.x - L.textW + 4 : b.x + b.w + 16, y: beakerSurfaceY(b),
    atmLabel: "대기압", atmText: "760 mmHg", title: o.title, pressureText: pt, atmEqText: eq, colors: DC });
  else DESIGN.valueBlock(g, { mode: "below", x: b.x + b.w / 2, y: b.y + b.h + 16,
    atmLabel: "대기압", atmText: "760 mmHg", title: o.title, pressureText: pt, atmEqText: eq, colors: DC });
}

/* 1단계 범례 — 그림 안 번호 ①②③ 의 설명. 비커 옆 글자 칸(넓을 때) 또는 비커 아래(좁을 때) */
const LEGEND1 = ["① 표면을 떠난다 ↑", "② 액면 근처에 머무르며", "    표면에 부딪힌다", "③ 되돌아온다 ↓"];
function drawLegend(g, b, L) {
  if (L.textW) DESIGN.legend(g, { x: L.textLeft ? b.x - L.textW + 4 : b.x + b.w + 16, y: beakerSurfaceY(b) + 72, lines: LEGEND1, align: "left", colors: DC });
  else DESIGN.legend(g, { x: b.x + b.w / 2, y: b.y + b.h + 16 + 34, lines: LEGEND1, align: "center", colors: DC });
}

/* ── 돋보기 ───────────────────────────────────────────────────── */
const LOUPE_COLS = 7, LOUPE_ROWS_SURF = 4, LOUPE_ROWS_BULK = 6;
const LOUPE_SURF = LOUPE_COLS * LOUPE_ROWS_SURF, LOUPE_BULK = LOUPE_COLS * LOUPE_ROWS_BULK;
function drawLoupe(g, L, src, kind, o) {
  const { cx, cy, R } = L;
  DESIGN.loupe(g, { cx, cy, R, src, kind, solnAlpha: o.xs > 0 ? o.xs / RAOULT.XS.max : 0,
    title: o.label, sub: "분자 크기로 확대 · 도식", foot: o.sub || "", colors: DC }, (gg, clip) => {
    /* 돋보기 «안»은 요청자 몫 — 격자 표집(4단계)·기체·증발/응축 애니메이션. 클립은 DESIGN 이 유지한다 */
    const surfY = kind === "surface" ? (Number.isFinite(clip && clip.surfaceY) ? clip.surfaceY : cy - R * 0.05) : cy - R - 10;
    const cols = LOUPE_COLS, rows = kind === "surface" ? LOUPE_ROWS_SURF : LOUPE_ROWS_BULK;
    const gx0 = cx - R * 0.92, gw = R * 1.84;
    const gy0 = kind === "surface" ? surfY + R * 0.10 : cy - R * 0.85, gh = kind === "surface" ? (cy + R - gy0) : R * 1.7;
    const cw = gw / cols, ch = gh / rows, rO = Math.min(cw, ch) * 0.30;
    const jit = REDUCED ? 0 : 1.6, marks = o.sampleIdx || new Set();
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      const x = gx0 + (i + 0.5) * cw + jit * Math.sin(st.clock * 1.3 + idx * 1.7), y = gy0 + (j + 0.5) * ch + jit * Math.cos(st.clock * 1.1 + idx * 2.3);
      if (marks.has(idx)) drawSolute(gg, x, y, rO * 1.45);
      else drawH2O(gg, x, y, rO, rnd(idx + 11) * 6.28 + (REDUCED ? 0 : 0.15 * Math.sin(st.clock + idx)));
    }
    if (kind === "surface") {
      const nG = o.gasN || 5;
      for (let k = 0; k < nG; k++) {
        const x = cx - R * 0.8 + rnd(k * 3 + 5) * R * 1.6;
        const y = surfY - 8 - rnd(k * 5 + 7) * (surfY - (cy - R * 0.9) - 10) * 0.55;    // 액면 «근처»에 몰린다
        drawH2O(gg, x, y, rO * 0.9, rnd(k + 41) * 6.28);
      }
      if (o.evapAnim) {
        const ph = REDUCED ? 0.5 : (st.clock % 1.6) / 1.6;
        const up = surfY - ph * (surfY - (cy - R * 0.75));
        drawH2O(gg, cx - R * 0.35, up, rO, 0.3);
        arrow(gg, cx - R * 0.35 + rO * 2.2, surfY - 4, cx - R * 0.35 + rO * 2.2, cy - R * 0.55, C.t2, 1.6);
        const dn = (cy - R * 0.75) + ph * (surfY - (cy - R * 0.75));
        drawH2O(gg, cx + R * 0.35, dn, rO, -0.4);
        arrow(gg, cx + R * 0.35 - rO * 2.2, cy - R * 0.55, cx + R * 0.35 - rO * 2.2, surfY - 4, C.t2, 1.6);
      }
    }
  });
}
/* 두 돋보기는 «따로» 뽑는다 — 같은 수를 두 곳에 찍으면 동어반복이다(4부 ㉕) */
function sampleSolute(cells, pTrue, k, seedBase) {
  const set = new Set(); let n = 0;
  for (let i = 0; i < cells; i++) if (rnd(seedBase * 97 + k * 131 + i * 17) < pTrue) { set.add(i); n++; }
  return { set, n };
}

/* ── 무대 ────────────────────────────────────────────────────── */
function drawStage() {
  const w0 = stageCv.clientWidth; if (w0 < 40) return;
  const L = layout(w0);
  const { g, w, h } = sizeCanvas(stageCv, L.H);
  g.clearRect(0, 0, w, h); g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);

  const xs = activeXs();
  const P0 = pPure(st.t), pSol = st.nSol / RAOULT.SCALE, pPureNow = st.nPure / RAOULT.SCALE;
  const pmax = DIAL_MAX;   // 눈금 고정 — 온도를 올리면 «같은 계기»에서 바늘이 더 올라간다
  const evS = evapRate(st.t, xs, "comp", 0), coS = condCoef("comp", 0) * st.nSol;
  const evP = evapRate(st.t, 0, "comp", 0), coP = condCoef("comp", 0) * st.nPure;

  if (twoBeakers()) {
    const b0 = L.beakers[0], b1 = L.beakers[1];
    drawBeaker(g, b0, { label: "순수한 물", soluteAmt: 0, vapor: vapP, vaporState: vapStateFor(b0, st.nPure, evP, coP),
      evap: evP.toFixed(0), cond: coP.toFixed(0), pressure: pPureNow, pmax });
    drawBeaker(g, b1, { label: "용액", soluteAmt: st.xs / RAOULT.XS.max, solute: solM, soluteCount: soluteDots(st.xs), diffuse: 1,
      vapor: vapS, vaporState: vapStateFor(b1, st.nSol, evS, coS), evap: evS.toFixed(0), cond: coS.toFixed(0), pressure: pSol, pmax });
    drawValues(g, b0, L, { title: "증기 압력", pressure: pPureNow });
    drawValues(g, b1, L, { title: "증기 압력", pressure: pSol });
    /* ΔP — 두 비커 사이 */
    DESIGN.deltaP(g, { x: (b0.x + b0.w + b1.x) / 2, y: b0.y + 30, text: sig3(Math.max(0, pPureNow - pSol)), colors: DC });
  } else {
    const b = L.beakers[0];
    const inj = soluteShown();
    drawBeaker(g, b, { label: inj ? "용액" : "순수한 물", soluteAmt: inj ? (st.diffuse * st.xs / RAOULT.XS.max) : 0,
      solute: inj ? solM : null, soluteCount: inj ? soluteDots(st.xs) : 0, diffuse: st.diffuse,
      vapor: vapS, vaporState: vapStateFor(b, st.nSol, evS, coS), evap: evS.toFixed(0), cond: coS.toFixed(0), pressure: pSol, pmax,
      numbered: st.step === 1 });
    drawValues(g, b, L, { title: "증기 압력", pressure: pSol });
    /* 1단계 도식 범례 — 번호는 그림 안(①③은 화살표 글자, ②는 기체 띠), 설명은 그림 «밖».
       설명 상자를 기체 띠 위에 얹으면 지나가는 분자를 덮어 깜빡임으로 보인다(실측). */
    if (st.step === 1) drawLegend(g, b, L);
  }

  if (st.loupe) {
    if (st.step === 4) {
      const b1 = L.beakers[0], sy = beakerSurfaceY(b1), seedBase = Math.floor(st.clock / 2);
      const A = sampleSolute(LOUPE_BULK, st.xs, 0, seedBase), B = sampleSolute(LOUPE_SURF, st.xs, 1, seedBase);
      if (seedBase !== st.cumSeed) { st.cumSeed = seedBase; st.cumA += A.n / LOUPE_BULK; st.cumB += B.n / LOUPE_SURF; st.cumN += 1; }
      drawLoupe(g, L.loupes[0], { x: b1.x + b1.w * 0.42, y: sy + (b1.y + b1.h - sy) * 0.55 - 7, w: 14, h: 14 }, "bulk",
        { xs: st.xs, sampleIdx: A.set, label: "액체 속 한 곳", sub: "용질 " + A.n + " / " + LOUPE_BULK });
      drawLoupe(g, L.loupes[1], { x: b1.x + b1.w * 0.42, y: sy - 7, w: 14, h: 14 }, "surface",
        { xs: st.xs, sampleIdx: B.set, label: "표면 한 곳", evapAnim: false, sub: "용질 " + B.n + " / " + LOUPE_SURF });
    } else {
      const b = L.beakers[0], sy = beakerSurfaceY(b);
      drawLoupe(g, L.loupes[0], { x: b.x + b.w * 0.42, y: sy - 7, w: 14, h: 14 }, "surface",
        { xs: 0, label: "액면 돋보기", evapAnim: true, gasN: Math.max(2, Math.min(9, Math.round(st.nSol / 30))),
          sub: "왼쪽 ↑ 증발 · 오른쪽 ↓ 응축 — 둘 다 계속" });
    }
  }
  positionInject(L);
  DESIGN.caption(g, { x: w / 2, y: h - 8, colors: DC,
    text: L.narrow ? "밀폐 비커 · 평면 도식 · 액면 고정" : "밀폐 비커 · 평면 도식 — 액면은 고정이고, 기체 분자를 액면 근처에 몰리게 그렸습니다" });
}
/* 「용질 넣기」를 무대 좌표에 맞춘다. 캔버스에 «그리지» 않는다 — 진짜 button 이라야
   초점·확대·읽어주기가 그대로 된다(매뉴얼 §12 · 최소 44 px 는 .btn 이 지킨다) */
function positionInject(L) {
  if (!L.inj) return;
  const el = $("injectBtn");
  el.style.left = L.inj.x + "px"; el.style.top = L.inj.y + "px"; el.style.width = L.inj.w + "px";
}
function vapStateFor(b, n, ev, co) {
  return { rect: headspace(b), surfaceY: beakerSurfaceY(b) - 2, targetN: n * GAS_SCALE, evapPerSec: ev, condPerSec: co, reduced: REDUCED, colors: MOTION_COLORS };
}

/* ── 측정값 갱신 ─────────────────────────────────────────────── */
function updateReadouts() {
  const P0 = pPure(st.t), xs = activeXs();
  const pNow = st.nSol / RAOULT.SCALE;
  $("vAtm").textContent = "1.000";
  $("vP").textContent = setPress(pNow);
  $("vPpure").textContent = setPress(st.nPure / RAOULT.SCALE);
  $("vX").textContent = xSolvent(xs).toFixed(3);
  $("vDp").textContent = sig3(Math.max(0, (st.nPure - st.nSol) / RAOULT.SCALE));
  const ev = evapRate(st.t, xs, "comp", 0), co = condCoef("comp", 0) * st.nSol;
  $("vEvap").textContent = ev.toFixed(0); $("vCond").textContent = co.toFixed(0);

  const eq = atEq(st.nSol, st.t, xs, "comp", 0);
  const roState = $("roState"); roState.classList.remove("is-ok", "is-warn");
  if (!st.running) $("vState").textContent = "멈춤 — ▶ 를 누르세요";
  else if (eq) { $("vState").textContent = "동적 평형"; roState.classList.add("is-ok"); }
  else { $("vState").textContent = "재는 중"; roState.classList.add("is-warn"); }
  /* 「재는 중」과 결론은 «같은 판정»(eq)을 읽는다 — 다르면 J-N5 위반(육안 실측) */
  const settled = eq && st.eqSince !== null && (st.clock - st.eqSince) >= RAOULT.SETTLE_S;
  $("measuring").classList.toggle("is-off", !(st.running && !eq));
  const vd = $("verdict"); vd.classList.toggle("is-off", !settled);
  if (settled) {
    if (st.step <= 2) vd.innerHTML = "증발하는 분자 수 = 응축하는 분자 수. <b>지금이 동적 평형</b>이고, 압력계가 가리키는 <b>" + sig3(pNow) + " mmHg</b> 가 이 온도에서 물의 증기 압력입니다.";
    else if (st.step <= 4) vd.innerHTML = "용액도 동적 평형에 이르렀습니다. 증기 압력은 <b>" + sig3(pNow) + " mmHg</b> — 순수한 물(" + sig3(P0) + " mmHg)보다 낮습니다.";
    else vd.innerHTML = "용액의 증기 압력이 순물질보다 <b>" + sig3((st.nPure - st.nSol) / RAOULT.SCALE) + " mmHg 낮습니다.</b> 용매의 몰분율 " + xSolvent(st.xs).toFixed(3) + " 을 순물질의 증기 압력에 곱한 값입니다.";
  }
  $("recBtn").disabled = !settled;
  if (st.step === 4 && st.loupe) {
    const a = st.cumN ? (st.cumA / st.cumN * 100).toFixed(1) : "0.0", b = st.cumN ? (st.cumB / st.cumN * 100).toFixed(1) : "0.0";
    $("vSurf").textContent = "액체 속 " + a + " % · 표면 " + b + " %  (" + st.cumN + "번 누적)";
  }
}

/* ── 단계 전환 (표시 여부의 단일 원천) ───────────────────────── */
function applyStep() {
  const s = SHOW[st.step];
  for (const id in s) { const el = $(id); if (el) el.style.display = s[id] ? SHOWVAL[id] : "none"; }
  $("roSurf").style.display = (st.step === 4 && st.loupe) ? SHOWVAL.roSurf : "none";
  $("stageTitle").textContent = TITLE[st.step];
  $("stageDesc").textContent = DESC[st.step];
  $("mainNote").innerHTML = NOTE[st.step];
  $("sideNote").textContent = SIDE[st.step];
  for (const b of document.querySelectorAll(".stg")) b.setAttribute("aria-pressed", String(+b.dataset.step === st.step));
  const lb = $("loupeBtn");
  lb.setAttribute("aria-pressed", String(st.loupe));
  lb.textContent = st.loupe ? "돋보기 닫기" : (st.step === 4 ? "두 곳을 확대해 보기" : "분자 수준으로 확대해 보기");
  $("injectBtn").disabled = st.injected;
  $("injectBtn").textContent = st.injected ? "용질을 넣었습니다" : "용질 넣기";
  drawStage(); updateReadouts();
}
function renderRec() {
  const tb = $("recBody");
  if (!st.rec.length) { tb.innerHTML = '<tr><td class="empty" colspan="3">평형이 되면 「지금 값 기록」을 눌러 표를 채우세요.</td></tr>'; return; }
  tb.innerHTML = st.rec.map(r => "<tr><td>" + r.x.toFixed(3) + "</td><td>" + sig3(r.p) + "</td><td>" + sig3(r.dp) + "</td></tr>").join("");
}

/* ── 루프 ─────────────────────────────────────────────────────── */
let raf = null, last = 0;
function frame(ts) {
  raf = requestAnimationFrame(frame);
  /* dt 캡 0.25 s — 느린 기기에서 물리 시간이 화면 속도에 끌려가지 않게. stepN 은 지수 해라 정확하다 */
  const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0;
  last = ts;
  const xs = activeXs();
  if (st.running) {
    st.clock += dt;
    st.nSol = stepN(st.nSol, st.t, xs, "comp", 0, dt);
    st.nPure = stepN(st.nPure, st.t, 0, "comp", 0, dt);
    if (st.injected) st.diffuse = Math.min(1, st.diffuse + dt / (REDUCED ? 0.001 : 2.6));
    if (atEq(st.nSol, st.t, xs, "comp", 0)) { if (st.eqSince === null) st.eqSince = st.clock; } else st.eqSince = null;
  }
  /* 입자 운동은 «멈춤»에서도 돈다(개수는 고정) — 화면이 얼어 보이지 않게. reduced 면 팩토리가 알아서 멈춘다 */
  const L = layout(stageCv.clientWidth || 480);
  const b0 = L.beakers[0], b1 = L.beakers[1] || L.beakers[0];
  const evS = evapRate(st.t, xs, "comp", 0), coS = condCoef("comp", 0) * st.nSol;
  vapS.step(dt, vapStateFor(twoBeakers() ? b1 : b0, st.nSol, evS, coS));
  if (twoBeakers()) vapP.step(dt, vapStateFor(b0, st.nPure, evapRate(st.t, 0, "comp", 0), condCoef("comp", 0) * st.nPure));
  if (soluteShown()) {
    const bb = twoBeakers() ? b1 : b0;
    /* 투입점은 step 에도 «실제 좌표»로 넘긴다 — 납품 모듈은 확산 원점을 step 에서 읽는다 */
    solM.step(dt, { rect: liquidRect(bb), count: soluteDots(st.xs), injectXY: { x: bb.x + bb.w / 2, y: beakerSurfaceY(bb) + 10 }, diffuse01: st.diffuse, reduced: REDUCED, colors: MOTION_COLORS });
  }
  drawStage(); updateReadouts();
}
function startLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

/* ── 조작 배선 ───────────────────────────────────────────────── */
function bind() {
  for (const b of document.querySelectorAll(".stg")) b.addEventListener("click", () => {
    const next = +b.dataset.step;
    st.step = next; st.loupe = false; st.eqSince = null;
    if (next === 1) { st.nSol = 0; st.nPure = 0; st.clock = 0; st.injected = false; st.diffuse = 0; st.running = false; $("pauseBtn").textContent = "▶ 시작"; }
    if (next === 3) { st.injected = false; st.diffuse = 0; }
    if (next >= 4 && !st.injected) { st.injected = true; st.diffuse = 1; }   // 뒤 단계로 건너뛰면 «이미 넣은» 상태
    if (next >= 5) st.nPure = Math.max(st.nPure, st.nSol);                    // 순물질 쪽도 이미 평형 근처에서 출발
    st.cumA = st.cumB = st.cumN = 0; st.cumSeed = -1;
    applyStep();
  });
  $("tSl").addEventListener("input", e => { st.t = +e.target.value; $("tVal").textContent = st.t + " ℃"; st.eqSince = null; });
  $("xsSl").addEventListener("input", e => { st.xs = +e.target.value; $("xsVal").textContent = st.xs.toFixed(3); st.eqSince = null; st.cumA = st.cumB = st.cumN = 0; st.cumSeed = -1; });
  $("loupeBtn").addEventListener("click", () => { st.loupe = !st.loupe; applyStep(); });
  $("injectBtn").addEventListener("click", () => { if (st.injected) return; st.injected = true; st.diffuse = 0; st.eqSince = null; if (!st.running) { st.running = true; $("pauseBtn").textContent = "⏸ 잠시 멈춤"; $("pauseBtn").setAttribute("aria-pressed", "false"); } applyStep(); });
  $("pauseBtn").addEventListener("click", () => {
    st.running = !st.running;
    $("pauseBtn").textContent = st.running ? "⏸ 잠시 멈춤" : "▶ 시작";
    $("pauseBtn").setAttribute("aria-pressed", String(!st.running));
  });
  $("recBtn").addEventListener("click", () => {
    const p = st.nSol / RAOULT.SCALE, dp = (st.nPure - st.nSol) / RAOULT.SCALE;
    st.rec.push({ x: xSolvent(st.xs), p, dp }); renderRec();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopLoop(); else startLoop(); });
  window.addEventListener("resize", () => drawStage());
}

/* ── 시작 ─────────────────────────────────────────────────────── */
bind();
$("tVal").textContent = st.t + " ℃";
$("xsVal").textContent = st.xs.toFixed(3);
renderRec();
applyStep();
startLoop();
