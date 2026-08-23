/* ============================================================
   anolis/sim.js — 「자연선택과 획득 형질」

   ★ 이 파일은 생성물이다. 직접 고치지 말 것.
     계산부 = 검증스크립트/anolis_core.js 의 CORE-BEGIN~CORE-END 를 그대로 복사한 것이고,
     UI = 검증스크립트/_설계보정_anolis_20260822/anolis_ui.part.js 다.
     고칠 곳을 고친 뒤 node _설계보정_anolis_20260822/build_sim.js 로 다시 만든다.
     anolis_check.js C24 가 계산부의 문자 단위 동일을 검사한다.
   ============================================================ */
(function () {
  "use strict";

/* ==== CORE-BEGIN ====
     ★ 이 줄부터 CORE-END 까지가 「계산부」다. anolis/sim.js 는 이 구간을 «문자 그대로»
       포함해야 하고, anolis_check.js 가 두 파일에서 이 구간을 잘라 대조한다.
       이 두 마커 줄을 지우거나 문구를 바꾸지 말 것. */

  /* ── 확정 파라미터 (설계지시안 §1-1) ── */
  var P = {
    N0: 10, CAP: 24, MU0: 1.00, SIG0: 0.14, SIGM: 0.06,
    K: 12,
    /* 폭풍 일정 — 4세대로 압축(2026-08-22 사용자 시간 제약 15~20분).
       6세대판은 _설계보정_anolis_20260822/anolis_core_6gen_backup.js 에 보존.
       ★ 3번째 폭풍부터 환경 변화. 압축해도 «바뀐 환경»을 두 세대 겪는다. */
    TH: [0.95, 1.03, 1.14, 1.20],
    GENS: 4, LIFE: 4, MUL: 1.5,
    PAD_MIN: 0.55, PAD_MAX: 1.80,
    TOUCH: 0.012, TOUCH_MAX: 6, BONUS: 0.03,
    MIN_BREED: 2
  };

  /* ── keyed 난수 — 순차 스트림이 아니라 (seed, gen, id, salt) 해시다.
       두 탭에서 개체군 크기가 갈려도 «같은 개체·같은 세대»는 같은 값을 받는다. ── */
  var SALT = { STORM: 1, MUT: 2, PA: 3, PB: 4, INIT: 5 };
  /* ⚠ 구판(2026-08-22 오후)은 seed 와 gen 을 «비선형 혼합 전에» XOR 로 합쳐
       keyed(s,0,id,salt) === keyed(s^0x0f,1,id,salt) 라는 별칭이 있었다.
       고정 id·salt 에서 seed 0..799 × gen 0..5 의 4,800 키가 800 값으로 붕괴했다(P-검토 3차 A-1).
       균등성 검사로는 «절대» 못 잡는다 — 충돌해도 균등하기 때문이다.
       그래서 좌표마다 avalanche 를 먼저 돌린 뒤 흡수한다. 회귀 검사는 충돌 수를 센다. */
  function mix32(x) {
    x = x >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7FEB352D) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846CA68B) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  function keyed(seed, gen, id, salt) {
    var h = mix32(seed);
    h = mix32(h ^ mix32((gen >>> 0) + 0x9E3779B9));
    h = mix32(h ^ mix32((id >>> 0) + 0x85EBCA6B));
    h = mix32(h ^ mix32((salt >>> 0) + 0xC2B2AE35));
    return h / 4294967296;
  }
  /* 표준정규 — 같은 키에서 두 균등난수를 뽑아 Box-Muller */
  function keyedGauss(seed, gen, id, salt, m, s) {
    if (s === 0) return m;
    var u = keyed(seed, gen, id, salt * 1000 + 1);
    var v = keyed(seed, gen, id, salt * 1000 + 2);
    if (u <= 0) u = 1e-9;
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /* 관찰용 순차 난수 — 생태에 «절대» 전달하지 않는다 */
  function LCG(seed) {
    var x = (seed >>> 0) || 1;
    return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  }
  function clampPad(x) { return Math.max(P.PAD_MIN, Math.min(P.PAD_MAX, x)); }

  /* ── 시나리오 — 두 탭이 같은 초기 개체군·같은 폭풍 난수를 쓴다는 보장이 여기 있다 ── */
  function makeScenario(seed, opt) {
    opt = opt || {};
    var sig0 = opt.sig0 !== undefined ? opt.sig0 : P.SIG0;
    var mu0 = opt.mu0 !== undefined ? opt.mu0 : P.MU0;
    var pop = [], i, pd;
    for (i = 0; i < P.N0; i++) {
      pd = clampPad(keyedGauss(seed, 0, i, SALT.INIT, mu0, sig0));
      pop.push({ id: i, padArea: pd, bornPad: pd, lineage: i + 1, age: 0, bornGen: 0 });
    }
    return {
      seed: seed, initialPop: pop, thresholds: P.TH.slice(),
      sigm: opt.sigm !== undefined ? opt.sigm : P.SIGM,
      label: opt.label || "보통 개체군"
    };
  }
  function clonePop(pop) {
    var out = [], i;
    for (i = 0; i < pop.length; i++) out.push({
      id: pop[i].id, padArea: pop[i].padArea, bornPad: pop[i].bornPad,
      lineage: pop[i].lineage, age: pop[i].age, bornGen: pop[i].bornGen
    });
    return out;
  }

  function newRun(scenario, mode) {
    if (mode !== "lamarck" && mode !== "natural") throw new Error("mode: lamarck|natural");
    return {
      mode: mode, scenario: scenario, gen: 0,
      pop: clonePop(scenario.initialPop), nextId: P.N0,
      rngObs: LCG(scenario.seed ^ 0x9e3779b9),   /* 관찰 전용 */
      /* 조작 예산과 예측은 «행위자별»이다 — 2~4인 조별 게임을 위해.
         혼자 할 때는 행위자 0 하나만 쓴다. 생태 계산에는 영향이 없다. */
      touchLeftBy: { 0: P.TOUCH_MAX },
      touchTarget: null,      /* 개입 대상 — 학생이 만지는 개체 */
      tracked: null,          /* 관찰 대상 — 기록카드를 남길 개체. 생태에 영향 없음 */
      predictBy: {},          /* 행위자 → 예측한 개체 id. 생태에 영향 없음 */
      predictLog: [],         /* {gen, id, survived} */
      lastStorm: null, cards: [], extinct: false, history: []
    };
  }

  function stats(pop) {
    var n = pop.length, i, m = 0, v = 0;
    if (!n) return { n: 0, mean: null, sd: null };
    for (i = 0; i < n; i++) m += pop[i].padArea;
    m /= n;
    for (i = 0; i < n; i++) v += (pop[i].padArea - m) * (pop[i].padArea - m);
    return { n: n, mean: m, sd: Math.sqrt(v / n) };
  }
  function find(run, id) {
    for (var i = 0; i < run.pop.length; i++) if (run.pop[i].id === id) return run.pop[i];
    return null;
  }

  /* ── 관찰·예측 — 생태에 영향 없음 ── */
  function track(run, id) { run.tracked = id; return find(run, id); }
  function predict(run, id, actor) {
    actor = actor === undefined ? 0 : actor;
    run.predictBy[actor] = id;
    return find(run, id) !== null;
  }

  /* ── 터치(개입) — 자연선택 탭에서는 의도적으로 무효다.
       false 를 돌려주고 UI 는 안내 문구만 띄운다. 보상을 주지 말 것. ── */
  function touchesLeftOf(run, actor) {
    actor = actor === undefined ? 0 : actor;
    return run.touchLeftBy[actor] === undefined ? P.TOUCH_MAX : run.touchLeftBy[actor];
  }
  function touch(run, id, actor) {
    actor = actor === undefined ? 0 : actor;
    if (touchesLeftOf(run, actor) <= 0) return false;
    var a = find(run, id);
    if (!a) return false;
    run.touchTarget = id;
    if (run.mode !== "lamarck") return false;
    run.touchLeftBy[actor] = touchesLeftOf(run, actor) - 1;
    a.padArea = clampPad(a.padArea + P.TOUCH);
    return true;
  }

  /* ── 폭풍 ── */
  function storm(run) {
    var seed = run.scenario.seed, gen = run.gen;
    var th = run.scenario.thresholds[gen], before = stats(run.pop);
    var surv = [], dead = [], i, a, p, preMean = 0, preSurv = 0;
    for (i = 0; i < run.pop.length; i++) {
      a = run.pop[i];
      a.prePadArea = a.padArea;                       /* 폭풍 «전» 값 보존 — shift 계산용 */
      p = 1 / (1 + Math.exp(-P.K * (a.padArea - th)));
      if (keyed(seed, gen, a.id, SALT.STORM) < p) surv.push(a); else dead.push(a);
    }
    for (i = 0; i < surv.length; i++) { preMean += surv[i].prePadArea; preSurv++; }
    preMean = preSurv ? preMean / preSurv : 0;

    for (i = 0; i < dead.length; i++) {
      if (run.tracked === dead[i].id) {
        run.cards.push({ id: dead[i].id, lineage: dead[i].lineage, born: dead[i].bornPad, died: dead[i].padArea,
                         gen: gen + 1, cause: "폭풍" });
        run.tracked = null;
      }
    }
    for (var act in run.predictBy) {
      var pid = run.predictBy[act], hit = false;
      if (pid === null || pid === undefined) continue;
      for (i = 0; i < surv.length; i++) if (surv[i].id === pid) hit = true;
      run.predictLog.push({ gen: gen + 1, actor: act, id: pid, survived: hit });
    }
    /* 라마르크 가설의 「폭풍을 겪고 살아남으면 넓어진다」 — lamarck 에서만 */
    if (run.mode === "lamarck") {
      for (i = 0; i < surv.length; i++) surv[i].padArea = clampPad(surv[i].padArea + P.BONUS);
    }
    run.lastStorm = {
      gen: gen + 1, threshold: th,
      strength: th <= 0.95 ? "약함" : (th <= 1.03 ? "보통" : "강함"),
      before: before, survivors: surv.slice(), dead: dead.slice(),
      survivalRate: before.n ? surv.length / before.n : 0,
      /* 폭풍 «전» 값으로만 계산한다 — 선택만의 효과. 보너스·터치가 섞이지 않는다 */
      shift: (preSurv && before.mean) ? (preMean / before.mean - 1) : null
    };
    run.pop = surv;
    return run.lastStorm;
  }

  /* ── 번식 — 부모는 «항상 생존자 전원». 학생 선택은 결과에 반영하지 않는다 ──
       ★ 두 번째 부모는 첫 번째와 다른 개체에서만 뽑는다(자가교배 금지). */
  function breed(run) {
    var surv = run.pop, seed = run.scenario.seed, gen = run.gen;
    if (surv.length < P.MIN_BREED) { run.extinct = true; return { extinct: true, born: [] }; }

    var want = Math.min(P.CAP, surv.length + Math.ceil(surv.length * P.MUL)) - surv.length;
    var kids = [], i, mi, fi, m, f, pd, cid;
    for (i = 0; i < want; i++) {
      cid = run.nextId + i;
      mi = Math.floor(keyed(seed, gen, cid, SALT.PA) * surv.length);
      if (mi >= surv.length) mi = surv.length - 1;
      /* 부계는 모계를 뺀 나머지에서 — m === f 를 구조적으로 불가능하게 만든다 */
      fi = Math.floor(keyed(seed, gen, cid, SALT.PB) * (surv.length - 1));
      if (fi >= surv.length - 1) fi = surv.length - 2;
      if (fi >= mi) fi += 1;
      m = surv[mi]; f = surv[fi];
      pd = clampPad((m.padArea + f.padArea) / 2
                    + keyedGauss(seed, gen, cid, SALT.MUT, 0, run.scenario.sigm));
      kids.push({ id: cid, padArea: pd, bornPad: pd, lineage: m.lineage, age: 0, bornGen: gen + 1 });
    }
    run.nextId += want;

    for (i = 0; i < surv.length; i++) surv[i].age++;
    var alive = [], retired = [];
    for (i = 0; i < surv.length; i++) (surv[i].age < P.LIFE ? alive : retired).push(surv[i]);
    for (i = 0; i < retired.length; i++) {
      if (run.tracked === retired[i].id) {
        run.cards.push({ id: retired[i].id, lineage: retired[i].lineage, born: retired[i].bornPad, died: retired[i].padArea,
                         gen: gen + 1, cause: "수명" });
        run.tracked = null;
      }
    }
    run.pop = alive.concat(kids);
    run.gen++;
    for (var k in run.touchLeftBy) run.touchLeftBy[k] = P.TOUCH_MAX;
    run.touchTarget = null;
    run.predictBy = {};
    run.history.push({ gen: run.gen, stats: stats(run.pop),
                       survivalRate: run.lastStorm ? run.lastStorm.survivalRate : null,
                       shift: run.lastStorm ? run.lastStorm.shift : null });
    if (!run.pop.length) run.extinct = true;
    return { extinct: run.extinct, born: kids };
  }

  function closeCards(run) {
    if (run.tracked === null) return;
    var a = find(run, run.tracked);
    if (a) run.cards.push({ id: a.id, lineage: a.lineage, born: a.bornPad, died: a.padArea, gen: run.gen, cause: "생존" });
    run.tracked = null;
  }

  /* ── 개입 대상 선택 정책 — 생태 계산이므로 «관찰 난수를 쓰지 않는다» ──
       실제 UI 에서는 학생이 고른다. 하네스는 이 정책으로 학생을 모사한다. */
  function policyPick(run, policy) {
    if (!run.pop.length) return null;
    var s = run.pop.slice().sort(function (a, b) { return a.padArea - b.padArea; });
    if (policy === "best") return s[s.length - 1].id;
    if (policy === "worst") return s[0].id;
    return s[s.length >> 1].id;                       /* 기본 median */
  }

  /* ── 테스트 하네스 ──
       touchPolicy: 개입 대상(생태) · trackPolicy: 관찰 대상(비생태, rngObs 사용) */
  function simulate(scenario, mode, opt) {
    opt = opt || {};
    var touches = opt.touches === undefined ? P.TOUCH_MAX : opt.touches;
    var touchPolicy = opt.touchPolicy || "median";
    var run = newRun(scenario, mode), i, tgt;

    if (run.pop.length) track(run, run.pop[Math.floor(run.rngObs() * run.pop.length)].id);
    while (run.gen < P.GENS && !run.extinct) {
      tgt = policyPick(run, touchPolicy);
      if (tgt !== null) {
        for (i = 0; i < touches; i++) touch(run, tgt);
        predict(run, tgt);
      }
      storm(run);
      breed(run);
      if (!run.extinct && run.tracked === null && run.pop.length) {
        track(run, run.pop[Math.floor(run.rngObs() * run.pop.length)].id);
      }
    }
    closeCards(run);
    return run;
  }

  /* ── 계보별 생존 개체 수 — 조별 게임의 점수. 순수 집계이고 생태에 영향 없음 ── */
  function countByLineage(pop) {
    var m = {}, i;
    for (i = 0; i < pop.length; i++) m[pop[i].lineage] = (m[pop[i].lineage] || 0) + 1;
    return m;
  }

  /* ==== CORE-END ==== */
/* ============================================================
   anolis/_assets_draft.js
   아놀도마뱀과 폭풍을 기존 Canvas 무대에 얹기 위한 순수 ES5 에셋 초안이다.
   ============================================================ */

/* 공통 스타일 토큰을 그때그때 읽어, 통합 위치가 바뀌어도 무대의 색 체계를 따른다. */
function anolisAssetToken(name) {
  var style, value = "";
  if (typeof document === "undefined" || !document.documentElement ||
      typeof getComputedStyle !== "function") return value;
  style = getComputedStyle(document.documentElement);
  if (style) value = style.getPropertyValue(name);
  return value ? value.replace(/^\s+|\s+$/g, "") : "";
}

/* 빈 토큰은 현재 Canvas 상태를 보존해, 스타일을 읽을 수 없는 검산 환경에서도 멈추지 않는다. */
function anolisAssetFill(ctx, color) {
  if (color) ctx.fillStyle = color;
}

/* 선에도 같은 토큰 규칙을 적용해 계보색 외의 임의 팔레트를 만들지 않는다. */
function anolisAssetStroke(ctx, color) {
  if (color) ctx.strokeStyle = color;
}

/* 잘못 들어온 범위를 무대가 견딜 수 있는 값으로 접어 Canvas 예외를 막는다. */
function anolisAssetClamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/* falling·holding이 배열이 아닐 때도 빈 목록으로 취급해 폭풍 장면을 안전하게 비운다. */
function anolisAssetArray(value) {
  return Object.prototype.toString.call(value) === "[object Array]" ? value : [];
}

/* 시작·끝이 조용하고 중반이 가장 큰 한 봉우리라서 별도 시간 상태 없이 폭풍의 호흡이 보인다. */
function anolisAssetStormProfile(progress) {
  return Math.sin(Math.PI * progress);
}

/* 잎의 시작 위치를 인덱스로 고정해 같은 입력이면 항상 같은 장면이 다시 그려진다. */
function anolisAssetStormUnit(index, salt) {
  var value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/* 폭풍 중 이동하는 개체는 넓은 흡착판을 남긴 간략 실루엣으로 그려, 색만으로도 누가 흔들리거나 떨어지는지 읽게 한다. */
function anolisAssetStormCreature(ctx, x, y, color, padArea, angle, alpha) {
  var root, padLong, padShort, ink;

  if (!ctx) return;
  padArea = Number(padArea);
  if (!isFinite(padArea)) padArea = 1;
  padArea = anolisAssetClamp(padArea, 0.55, 1.80);
  root = Math.sqrt(padArea);
  padLong = 4.7 * root;
  padShort = 1.9 * root;
  ink = anolisAssetToken("--t1");

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  ctx.globalAlpha = anolisAssetClamp(alpha, 0, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  anolisAssetFill(ctx, color);
  anolisAssetStroke(ctx, ink);
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 12.6, 5.9, 0, 0, Math.PI * 2);
  ctx.moveTo(8, -4.1);
  ctx.lineTo(17, 0);
  ctx.lineTo(8, 4.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(-10, -8, padLong, padShort, -0.55, 0, Math.PI * 2);
  ctx.ellipse(9, -8, padLong, padShort, 0.55, 0, Math.PI * 2);
  ctx.ellipse(-10, 8, padLong, padShort, 0.55, 0, Math.PI * 2);
  ctx.ellipse(9, 8, padLong, padShort, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/*
   도식형 아놀도마뱀: 작은 몸통·머리·꼬리보다 네 개의 타원형 흡착판이
   먼저 읽히게 했다. padArea는 면적 지수이므로 두 반지름 모두
   Math.sqrt(padArea)에 비례시킨다. 등에 직접 쓴 번호는 계보 색을
   읽기 어려운 상황에서도 남는 두 번째 구분 채널이다. 소유 표식과
   별명도 여기에서 끝내어 무대와 에셋의 시각 규격이 갈라지지 않게 한다.
*/
function drawLizard(ctx, x, y, opt) {
  var padArea, scale, facing, color, ink, paper, padRoot, padLong, padShort;
  var dead, owned, label, alpha, labelSize, ownerName, hasOwnerName, isTurn;
  var ownerSize, ownerY, ownerWidth, subLabel, hasSubLabel, subSize, subY;

  if (!ctx) return;
  opt = opt || {};

  padArea = Number(opt.padArea);
  if (!isFinite(padArea)) padArea = 1;
  padArea = anolisAssetClamp(padArea, 0.55, 1.80);
  scale = Number(opt.scale);
  if (!isFinite(scale) || scale <= 0) scale = 1;
  facing = opt.facing === -1 ? -1 : 1;
  color = opt.color || anolisAssetToken("--d-gray");
  ink = anolisAssetToken("--t1");
  paper = anolisAssetToken("--stage-light");
  dead = !!opt.dead;
  label = opt.label;
  hasOwnerName = opt.ownerName !== null && opt.ownerName !== undefined && opt.ownerName !== "";
  ownerName = hasOwnerName ? String(opt.ownerName).slice(0, 8) : "";
  isTurn = opt.isTurn === true;
  hasSubLabel = opt.subLabel !== null && opt.subLabel !== undefined && opt.subLabel !== "";
  subLabel = hasSubLabel ? String(opt.subLabel) : "";
  /* 이전 초안의 owned 호출도 받아, 통합 전후 어느 쪽에서도 소유 원이 사라지지 않게 한다. */
  owned = hasOwnerName || !!opt.owned || isTurn;
  alpha = dead ? 0.28 : 1;

  /* 면적 지수의 화면 면적도 같은 비율로 바뀌도록, 길이에는 제곱근을 쓴다. */
  padRoot = Math.sqrt(padArea);
  padLong = 6.6 * padRoot;
  padShort = 2.65 * padRoot;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* 1: 가는 꼬리. 몸통보다 가늘게 두어 형질 표식을 방해하지 않는다. */
  anolisAssetStroke(ctx, color);
  ctx.lineWidth = 3.1;
  ctx.beginPath();
  ctx.moveTo(-13, 1);
  ctx.quadraticCurveTo(-25, 5, -32, 0);
  ctx.quadraticCurveTo(-37, -4, -39, 1);
  ctx.stroke();

  /* 2: 네 다리는 한 경로에 묶어 경로 수와 재그리기 비용을 낮춘다. */
  anolisAssetStroke(ctx, ink);
  ctx.lineWidth = 1.65;
  ctx.beginPath();
  ctx.moveTo(-7, -4); ctx.lineTo(-13, -12);
  ctx.moveTo(8, -4); ctx.lineTo(13, -12);
  ctx.moveTo(-7, 4); ctx.lineTo(-13, 12);
  ctx.moveTo(8, 4); ctx.lineTo(13, 12);
  ctx.stroke();

  /* 3: 모든 흡착판을 한 경로에 넣는다. 넓이 차이가 네 곳에서 반복되어 보인다. */
  anolisAssetFill(ctx, color);
  anolisAssetStroke(ctx, ink);
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.ellipse(-13, -12, padLong, padShort, -0.55, 0, Math.PI * 2);
  ctx.ellipse(13, -12, padLong, padShort, 0.55, 0, Math.PI * 2);
  ctx.ellipse(-13, 12, padLong, padShort, 0.55, 0, Math.PI * 2);
  ctx.ellipse(13, 12, padLong, padShort, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  /* 4: 몸통과 삼각형 머리를 한 도식으로 묶는다. 질감·그림자는 넣지 않는다. */
  anolisAssetFill(ctx, color);
  anolisAssetStroke(ctx, ink);
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 15.5, 7.6, 0, 0, Math.PI * 2);
  ctx.moveTo(11, -5.2);
  ctx.lineTo(21, 0);
  ctx.lineTo(11, 5.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* 5: 진행 방향을 빠르게 읽게 하는 눈 하나다. */
  anolisAssetFill(ctx, ink);
  ctx.beginPath();
  ctx.arc(16, -1.4, 1.35, 0, Math.PI * 2);
  ctx.fill();

  /* 6: 소유 계보만 둘러싼다. 현재 차례는 굵은 실선, 다른 조원 것은 가는 파선으로 구별한다. */
  if (owned) {
    anolisAssetStroke(ctx, color);
    ctx.lineWidth = isTurn ? 3.1 : 1.35;
    if (!isTurn && typeof ctx.setLineDash === "function") ctx.setLineDash([3.2, 2.8]);
    ctx.beginPath();
    ctx.ellipse(-1, 0, 24, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  }
  ctx.restore();

  /* 글자는 좌향일 때도 뒤집히지 않도록 변환을 복원한 뒤 몸통 위에 쓴다. */
  if (label !== null && label !== undefined && label !== "") {
    labelSize = Math.max(10, Math.round(11 * scale));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold " + labelSize + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    anolisAssetStroke(ctx, ink);
    ctx.lineWidth = Math.max(1, scale * 1.25);
    ctx.strokeText(String(label), x, y);
    anolisAssetFill(ctx, paper);
    ctx.fillText(String(label), x, y);
    ctx.restore();
  }

  /* 발바닥 면적 지수를 몸 아래에 작게 적는다 — 스탯을 보고 훈련·예측 대상을
     고를 수 있어야 하므로(사용자 지시 2026-08-23 ①) 도마뱀을 그리는 모든 자리에 함께 나간다.
     소유 테두리 타원(세로 17)과 다리(12)를 피해 y+26 에 둔다. */
  if (hasSubLabel) {
    subSize = Math.max(10, Math.round(10 * scale));
    subY = y + Math.max(26, 26 * scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = subSize + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    anolisAssetStroke(ctx, paper);
    ctx.lineWidth = 2.4;
    ctx.strokeText(subLabel, x, subY);
    anolisAssetFill(ctx, ink);
    ctx.fillText(subLabel, x, subY);
    ctx.restore();
  }

  /* 최대 8자는 폭 86px 안에 축소한다. 최소 96px 격자에서 양옆 5px 이상의 여백을 남긴다. */
  if (hasOwnerName) {
    ownerSize = Math.max(10, Math.min(11, Math.round(11 * scale)));
    ownerY = y - Math.max(26, 27 * scale);
    ownerWidth = 86;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold " + ownerSize + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    anolisAssetStroke(ctx, ink);
    ctx.lineWidth = 2.1;
    ctx.strokeText(ownerName, x, ownerY, ownerWidth);
    anolisAssetFill(ctx, paper);
    ctx.fillText(ownerName, x, ownerY, ownerWidth);
    ctx.restore();
  }
}

/*
   폭풍 레이어: 빗줄기만 늘리지 않고, 같은 방향으로 휘는 가지·기울어진 풀·
   날리는 잎을 함께 그려 바람 자체가 읽히게 한다. t의 sin 곡선은 시작과 끝을
   잦아들게 하고, falling은 이동 궤적과 떨어지는 실루엣으로, holding은 작은
   흔들림과 발의 고정선으로 결과의 차이를 보인다. 모든 배치는 t와 인덱스로만
   계산하므로 같은 입력은 항상 같은 그림이 된다.
*/
function drawStorm(ctx, W, H, t, strength, opt) {
  var progress, storm, rainCount, gustCount, grassCount, leafCount;
  var windLean, swayMax, branchBend, veilMax, rainAlpha, rainWidth;
  var rainColor, windColor, plantColor, leafColor, darkColor, anchorColor, neutralColor;
  var falling, holding, i, item, x, y, color, padArea;
  var bandY, grassX, grassH, grassBend, leafX, leafY, leafAngle;
  var rainX, rainY, rainLength, release, fallX, fallY, fallAngle, fallAlpha;
  var sway, creatureLimit;

  if (!ctx || !isFinite(W) || !isFinite(H) || W <= 0 || H <= 0) return;
  opt = opt || {};
  progress = Number(t);
  if (!isFinite(progress)) progress = 0;
  progress = anolisAssetClamp(progress, 0, 1);
  storm = anolisAssetStormProfile(progress);
  falling = anolisAssetArray(opt.falling);
  holding = anolisAssetArray(opt.holding);

  /* 약함·보통·강함은 비의 수뿐 아니라 기울기, 식물 흔들림, 어두워짐을 함께 바꾼다. */
  rainCount = 24;
  gustCount = 2;
  grassCount = 8;
  leafCount = 3;
  windLean = 7;
  swayMax = 2.2;
  branchBend = 8;
  veilMax = 0.045;
  rainAlpha = 0.24;
  rainWidth = 0.85;
  if (strength === "보통") {
    rainCount = 48;
    gustCount = 3;
    grassCount = 12;
    leafCount = 6;
    windLean = 14;
    swayMax = 5.2;
    branchBend = 17;
    veilMax = 0.095;
    rainAlpha = 0.34;
    rainWidth = 1.1;
  } else if (strength === "강함") {
    rainCount = 72;
    gustCount = 4;
    grassCount = 16;
    leafCount = 8;
    windLean = 22;
    swayMax = 8.8;
    branchBend = 28;
    veilMax = 0.16;
    rainAlpha = 0.43;
    rainWidth = 1.35;
  }

  /* 정확한 양 끝점에서는 정적 장면을 건드리지 않아 조용한 시작과 마무리를 보장한다. */
  if (storm <= 0) return;

  rainColor = anolisAssetToken("--d-blue");
  windColor = anolisAssetToken("--t2");
  plantColor = anolisAssetToken("--d-green");
  leafColor = anolisAssetToken("--d-amber");
  darkColor = anolisAssetToken("--stage-dark");
  anchorColor = anolisAssetToken("--stage-line");
  neutralColor = anolisAssetToken("--d-gray");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* 투명한 어두움만 얹어 폭풍의 압박은 보이되, 이미 그려진 도마뱀을 가리지 않는다. */
  anolisAssetFill(ctx, darkColor);
  ctx.globalAlpha = veilMax * storm;
  ctx.fillRect(0, 0, W, H);

  /* 긴 바람 띠와 끝의 짧은 갈래는 좌→우 흐름을 수치 없이 읽게 한다. */
  anolisAssetStroke(ctx, windColor);
  ctx.globalAlpha = (0.15 + 0.10 * storm) * storm;
  ctx.lineWidth = 1 + storm * 0.45;
  ctx.beginPath();
  for (i = 0; i < gustCount; i++) {
    bandY = (i + 0.8) * H / (gustCount + 0.6);
    ctx.moveTo(-24, bandY + (i % 2 ? 5 : -3));
    ctx.bezierCurveTo(W * 0.25, bandY - windLean * 0.24, W * 0.62, bandY + windLean * 0.15, W + 18, bandY - windLean * 0.1);
    ctx.moveTo(W + 18, bandY - windLean * 0.1);
    ctx.lineTo(W + 10, bandY - windLean * 0.1 - 4);
    ctx.moveTo(W + 18, bandY - windLean * 0.1);
    ctx.lineTo(W + 10, bandY - windLean * 0.1 + 4);
  }
  ctx.stroke();

  /* 두 갈래의 가지가 같은 쪽으로 휘어, 비와 독립된 바람의 방향·세기를 알려 준다. */
  anolisAssetStroke(ctx, plantColor);
  ctx.globalAlpha = (0.26 + 0.16 * storm) * storm;
  ctx.lineWidth = 2.05;
  ctx.beginPath();
  ctx.moveTo(-24, H * 0.16 + 5);
  ctx.quadraticCurveTo(W * 0.10, H * 0.12, W * 0.28 + branchBend * storm, H * 0.18 + branchBend * 0.12 * storm);
  ctx.moveTo(W * 0.12, H * 0.14);
  ctx.quadraticCurveTo(W * 0.18 + branchBend * 0.48 * storm, H * 0.05, W * 0.27 + branchBend * 0.8 * storm, H * 0.09);
  ctx.moveTo(-20, H * 0.39 + 2);
  ctx.quadraticCurveTo(W * 0.11, H * 0.34, W * 0.24 + branchBend * 0.74 * storm, H * 0.40 + branchBend * 0.09 * storm);
  ctx.stroke();

  /* 바닥 풀은 세기가 커질수록 더 크게 기울어, 밀도 외의 두 번째 강도 단서가 된다. */
  ctx.globalAlpha = (0.22 + 0.12 * storm) * storm;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (i = 0; i < grassCount; i++) {
    grassX = (i + 0.5) * W / grassCount;
    grassH = 12 + (i % 4) * 4;
    grassBend = windLean * storm * (0.64 + (i % 3) * 0.12);
    ctx.moveTo(grassX, H - 3);
    ctx.quadraticCurveTo(grassX + grassBend * 0.34, H - grassH * 0.46, grassX + grassBend, H - grassH);
  }
  ctx.stroke();

  /* 잎은 최대 8개만 날려 72개 빗방울과 합쳐도 파티클이 80개를 넘지 않는다. */
  anolisAssetFill(ctx, leafColor);
  ctx.globalAlpha = (0.28 + 0.24 * storm) * storm;
  ctx.beginPath();
  for (i = 0; i < leafCount; i++) {
    leafX = (((i * 79) + anolisAssetStormUnit(i, 3) * 47 + progress * (W + 92) * (0.55 + windLean / 32)) % (W + 84)) - 42;
    leafY = H * (0.11 + 0.11 * (i % 5)) + anolisAssetStormUnit(i, 7) * 18 + Math.sin(progress * 9 + i * 1.7) * 5;
    leafAngle = 0.25 + windLean * 0.018 + Math.sin(progress * 11 + i) * 0.28;
    /* ★ moveTo 없이 ellipse 를 연속 호출하면 캔버스가 타원들을 선으로 이어 하나의
       닫힌 도형으로 만들고, fill() 이 그 전체를 칠한다 — 화면을 가로지르는 큰
       삼각형이 생긴다(렌더 확인으로 잡음). 잎마다 새 서브패스를 연다. */
    ctx.moveTo(leafX + 3.7, leafY);
    ctx.ellipse(leafX, leafY, 3.7, 1.45, leafAngle, 0, Math.PI * 2);
  }
  ctx.fill();

  /* 비는 한 경로로 묶고, 세기별 수·폭·기울기를 함께 달리해 폭우가 한눈에 갈리게 한다. */
  anolisAssetStroke(ctx, rainColor);
  ctx.globalAlpha = rainAlpha * storm;
  ctx.lineWidth = rainWidth;
  ctx.beginPath();
  for (i = 0; i < rainCount; i++) {
    rainX = (((i * 47) + progress * (W + 74) * (0.82 + windLean / 42)) % (W + 74)) - 37;
    rainY = (((i * 71) + progress * (H + 58) * 1.32) % (H + 58)) - 29;
    rainLength = 11 + (i % 4) * 2.6;
    ctx.moveTo(rainX, rainY);
    ctx.lineTo(rainX + windLean * 0.92, rainY + rainLength + windLean * 0.18);
  }
  ctx.stroke();

  /* 떨어질 개체는 원래 자리에서 바람 방향으로 휘어진 궤적을 남기고 아래로 이탈한다. */
  creatureLimit = Math.min(falling.length, 24);
  release = anolisAssetClamp((progress - 0.06) / 0.78, 0, 1);
  for (i = 0; i < creatureLimit; i++) {
    item = falling[i] || {};
    x = Number(item.x);
    y = Number(item.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    color = item.color || neutralColor;
    padArea = item.padArea;
    fallX = x + (16 + windLean * 2.45 + (i % 3) * 5) * release;
    fallY = y + (18 + windLean * 1.75 + (i % 4) * 4) * release * release;
    fallAngle = 0.12 + (0.18 + windLean * 0.011) * release;
    fallAlpha = 0.76 * storm;

    anolisAssetStroke(ctx, color);
    ctx.globalAlpha = (0.30 + 0.24 * storm) * storm;
    ctx.lineWidth = 1.35;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.quadraticCurveTo(x + (fallX - x) * 0.36, y - windLean * 0.26, fallX, fallY);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    anolisAssetStormCreature(ctx, fallX, fallY, color, padArea, fallAngle, fallAlpha);
  }

  /* 버티는 개체는 작은 잔상과 발의 고정선만 움직인다. 중심은 떠나지 않아 생존이 읽힌다. */
  creatureLimit = Math.min(holding.length, 24);
  for (i = 0; i < creatureLimit; i++) {
    item = holding[i] || {};
    x = Number(item.x);
    y = Number(item.y);
    if (!isFinite(x) || !isFinite(y)) continue;
    color = item.color || neutralColor;
    padArea = item.padArea;
    sway = Math.sin(progress * 14 + i * 1.91) * swayMax * storm;

    anolisAssetStroke(ctx, anchorColor);
    ctx.globalAlpha = (0.44 + 0.14 * storm) * storm;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(x - 13, y + 12);
    ctx.lineTo(x - 15 + sway * 0.16, y + 20);
    ctx.moveTo(x + 12, y + 12);
    ctx.lineTo(x + 10 + sway * 0.16, y + 20);
    ctx.stroke();

    anolisAssetStroke(ctx, color);
    ctx.globalAlpha = (0.36 + 0.18 * storm) * storm;
    ctx.lineWidth = 1.15;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([2.5, 3]);
    ctx.beginPath();
    ctx.arc(x, y, 23, -0.72, 0.68, false);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    anolisAssetStormCreature(ctx, x + sway, y + Math.abs(sway) * 0.16, color, padArea, sway * 0.025, 0.30 * storm);
  }
  ctx.restore();
}

/* 카탈로그의 20px 크기에서도 몸·꼬리와 넓은 발끝이 남도록 세 개의 굵은 path만 쓴다. */
/* ICON_ANOLIS 는 sims.js 의 ICONS.anolis 로 옮겼다 */
/* 자가 점검
   확인한 것
   - drawLizard의 몸통 15.5 / 7.6, 눈 1.35와 네 흡착판의 sqrt(padArea) 비례를 유지했다.
   - 소유 별명은 strokeText 외곽선을 쓰고, 최대 8자를 86px 폭에 맞춰 최소 96px 격자를 넘지 않게 했다.
   - 소유 테두리는 현재 차례에서 굵은 실선, 그 밖의 소유 계보에서 가는 파선이며 모두 opt.color를 쓴다.
   - drawStorm은 빈 opt·빈 배열·undefined 배열을 받아도 멈추지 않고, 임의 난수 호출 없이 t와 인덱스로만 배치한다.
   - 강한 폭풍의 입자는 비 72개와 잎 8개, 합계 80개이며, 수치·게이지·번쩍임은 넣지 않았다.
   - SVG는 64×64 viewBox, currentColor, 4.5px 선, path 3개로만 만들었다.

   확인하지 못한 것
   - 이 초안을 drawStage의 단일 프레임 루프에 실제 통합했을 때의 2.5초 애니메이션 전환.
   - 실제 교실 기기에서의 60fps와 20px 카탈로그 렌더의 최종 가독성.
*/

/* ================= UI ================= */
/* ↑ 위쪽(계산부)은 anolis_core.js 의 CORE-BEGIN~CORE-END 와 문자 그대로 동일해야 한다.
   anolis_check.js(C24) 가 두 파일에서 이 구간을 잘라 대조한다. 마커 줄을 건드리지 말 것.
   이 파일은 build_sim.js 가 생성한다 — sim.js 를 직접 손으로 고치지 말고
   _설계보정_anolis_20260822/anolis_ui.part.js 를 고친 뒤 다시 빌드한다.

   ★ 2~4인 조별 게임 (2026-08-22 사용자 확정)
     각 조원이 도마뱀 한 마리를 맡는다 → 그 도마뱀의 «계보»가 그 조원의 팀이다.
     자손이 모계 계보를 물려받으므로, 마지막에 계보별 생존 수가 곧 점수가 된다.
     조작 패널은 무대 «위에» 덮인다 — 여럿이 한 화면을 보므로 지시가 도마뱀 위에 있어야 한다. */

var $ = function (id) { return document.getElementById(id); };
var CSSV = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };

/* 계보 색 — 매뉴얼 §9: 4계열 이상은 색만으로 불가하므로 «등의 번호»가 두 번째 채널이다.
   색은 혈통을 알아보기 위한 표식일 뿐 실제 유전 형질이 아니다(도구의 거짓말). */
var LINE_COLORS = ["#1d4ed8", "#b45309", "#047857", "#7c2d12", "#4338ca",
                   "#0e7490", "#a16207", "#9d174d", "#3f6212", "#5b21b6"];
var MAX_PLAYERS = 4, MIN_PLAYERS = 2;

/* ── 판정 화면에 적히는 모형 수치 — 여기 한 곳이 원천이다(F-1). ──
   손으로 고치지 마라. anolis_check.js C27 이 이 값을 800회 실측과 대조한다.
   6세대판 수치(1.257 / 96.6% / 0.4% / 16.6%)가 4세대 빌드에 그대로 남아
   판정 화면이 틀린 숫자를 보여 주고 있었다(2026-08-23 실측·수정). */
var VERDICT = {
  zeroVarLamarckEnd: 1.166,   /* 「변이 없는 개체군」 재생(seed 20260822)의 용불용설 최종 평균 */
  zeroVarNaturalDead: 66.6,   /* 같은 조건 자연선택 소멸률 (800회) */
  deadLamarck: 1.4,           /* 통상 조건 용불용설 전멸률 (800회) */
  deadNatural: 12.3,          /* 통상 조건 자연선택 전멸률 (800회) */
  zeroVarNaturalMean: 1.030,  /* 변이 없는 개체군의 자연선택 평균 — 존속 세대 내내 고정 */
  cardChangeLamarck: 100.0,   /* 폭풍 생존 경험 개체의 기록카드 변화 — 용불용설 (800회) */
  cardChangeNatural: 0.0,     /* 같은 것 — 자연선택 (800회) */
  selShift: 5.8               /* 1세대 선택 상승률 중앙값 — 「도구의 거짓말」이 실제 9.2%와 대조한다 */
};
var SEATS = ["①", "②", "③", "④"];

/* innerHTML 에 넣기 전 반드시 통과시킨다 — 별명은 학생이 직접 친 문자열이다.
   (press/sim.js 296행의 esc() 를 그대로 승계) */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ── 국면 — 값은 이 열다섯뿐이다 (C23 이 길이를 검사한다) ── */
var PHASES = ["idle", "setup", "rules", "pick", "adopt", "act", "stormWarn", "storm",
              "stormResult", "breed", "genResult", "envChange", "extinct", "tabDone", "verdict"];

var G = {
  phase: "idle",
  tab: "lamarck",
  count: 2,
  players: [],                 /* [{name}] — 두 탭 공용. 별명은 «메모리에만» 존재한다 (저장·전송·URL 금지) */
  picks: { lamarck: [], natural: [] },   /* 탭별 — 뽑힌 순서대로 [소유 조원번호(1..count)] */
  scenario: null,
  runs: { lamarck: null, natural: null },
  phaseByTab: { lamarck: "idle", natural: "idle" },
  completed: { lamarck: false, natural: false },
  results: { lamarck: null, natural: null },
  lost: { lamarck: [], natural: [] },   /* 탭별 — 조원이 계보를 잃은 횟수 */
  reseeded: { lamarck: 0, natural: 0 }, /* 탭별 — 소멸 후 «새 무리»로 다시 시작한 횟수 */
  ghost: { lamarck: {}, natural: {} },  /* 탭별 — 자손 id → 어미의 {born, given} (유령 원, 지시 ②) */
  turn: 0,
  lastMsg: "",
  rafId: null,
  replayT: 0
};

function run() { return G.runs[G.tab]; }
function picks() { return G.picks[G.tab]; }
function playerColor(i) { return LINE_COLORS[i % LINE_COLORS.length]; }
function defaultName(i) { return (SEATS[i] || ("#" + (i + 1))) + "번"; }
/* 참가자 표시 이름 — 차례·점수판·순위·기록카드가 전부 이 함수 하나를 쓴다(F-1) */
function playerName(i) { return (G.players[i] && G.players[i].name) || defaultName(i); }

/* ── 표시 여부는 이 표 하나가 정한다 (매뉴얼 §13-①, F-1 단일 원천).
     display 를 대입하는 곳은 applyPhaseVisibility() 하나뿐이어야 한다. ── */
var SHOW = {
  ovIdle:        { on: "flex",  phases: ["idle"] },
  ovSetup:       { on: "flex",  phases: ["setup"] },
  ovRules:       { on: "flex",  phases: ["rules"] },
  ovPick:        { on: "flex",  phases: ["pick"] },
  ovAdopt:       { on: "flex",  phases: ["adopt"] },
  ovAct:         { on: "flex",  phases: ["act"] },
  ovStormWarn:   { on: "flex",  phases: ["stormWarn"] },
  ovStormResult: { on: "flex",  phases: ["stormResult"] },
  ovGenResult:   { on: "flex",  phases: ["genResult"] },
  ovEnv:         { on: "flex",  phases: ["envChange"] },
  ovExtinct:     { on: "flex",  phases: ["extinct"] },
  ovTabDone:     { on: "flex",  phases: ["tabDone"] },
  verdictBox:    { on: "block", phases: ["verdict"] },
  boardBox:      { on: "block", phases: ["pick", "adopt", "act", "stormWarn", "storm", "stormResult", "breed", "genResult", "envChange", "extinct", "tabDone"] },
  causalBox:     { on: "block", phases: ["rules", "pick", "adopt", "act", "stormWarn", "storm", "stormResult", "breed", "genResult", "envChange"] },
  lieBox:        { on: "block", phases: ["rules", "pick", "adopt", "act", "stormWarn", "storm", "stormResult", "breed", "genResult", "envChange", "extinct", "tabDone"] },
  btnTurnDone:   { on: "",      phases: ["act"] },
  btnStorm:      { on: "",      phases: ["act"] },
  btnVerdict:    { on: "",      phases: ["tabDone"] }
};
function applyPhaseVisibility() {
  var lastTurn = (G.phase === "act") && (nextActor(G.turn) === -1);
  for (var id in SHOW) {
    var rule = SHOW[id], el = $(id);
    if (!el) continue;
    var vis = rule.phases.indexOf(G.phase) >= 0;
    /* 국면 외의 추가 조건은 여기 한 곳에서만 판단한다 */
    if (id === "btnVerdict") vis = vis && G.completed.lamarck && G.completed.natural;
    if (id === "btnTurnDone") vis = vis && !lastTurn;
    if (id === "btnStorm") vis = vis && lastTurn;
    el.style.display = vis ? rule.on : "none";
  }
}

/* ── 문구 ── */
var TEXT = {
  tabdesc: {
    lamarck: "<b>용불용설 탭.</b> 각자 맡은 도마뱀을 <b>훈련</b>시킵니다. 이 가설이 맞다면 훈련한 만큼 발바닥이 넓어지고, 그 넓어진 발바닥이 자손에게 전달됩니다.",
    natural: "<b>자연선택 탭.</b> 각자 맡은 도마뱀이 살아남을지 <b>예측</b>합니다. 이 가설에서는 개체의 발바닥이 태어날 때 값 그대로입니다 — 훈련해도 변하지 않습니다."
  },
  causal: {
    lamarck: "이 탭은 <b>200년 전 가설</b>로 돌아가는 곳입니다. 이 가설이 맞다면, 노력한 만큼 발바닥이 넓어지고 그 넓어진 발바닥이 자손에게 전달됩니다. 정말 그런지 확인해 봅시다.",
    natural: "폭풍은 누군가를 고르지 않습니다. <b>이미 있던 차이 때문에</b> 생존과 번식 결과가 달라질 뿐입니다."
  },
  rules: {
    lamarck: "<p>① 각자 도마뱀을 한 마리씩 맡습니다. 그 도마뱀의 <b>계보(등의 번호)</b>가 내 팀입니다.</p>" +
             "<p>② 자기 차례에 내 계보 도마뱀을 <b>눌러서 훈련</b>시킵니다 — 사람마다 세대당 {T}회.</p>" +
             "<p>③ 폭풍이 옵니다. 발바닥이 넓을수록 살아남기 쉽습니다.</p>" +
             "<p>④ 살아남은 도마뱀은 <b>폭풍을 겪으며 발바닥이 더 넓어지고</b>, 그 값이 자손에게 전달됩니다.</p>" +
             "<p>⑤ {N}번의 폭풍 뒤, 점수는 <b>내 계보 마릿수 × 1점</b>입니다.</p>",
    natural: "<p>① 각자 도마뱀을 한 마리씩 맡습니다. 그 도마뱀의 <b>계보(등의 번호)</b>가 내 팀입니다.</p>" +
             "<p>② 자기 차례에 내 계보 도마뱀 하나를 눌러 <b>「살아남을 것 같다」고 예측</b>합니다 — 사람마다 세대당 1회.</p>" +
             "<p>③ 폭풍이 옵니다. 발바닥이 넓을수록 살아남기 쉽습니다.</p>" +
             "<p>④ 개체의 발바닥은 <b>태어날 때 값 그대로</b>입니다. 눌러도 훈련해도 변하지 않습니다.</p>" +
             "<p>⑤ {N}번의 폭풍 뒤, 점수는 <b>내 계보 마릿수 × 1점 + 예측 적중 × 3점</b>입니다.</p>"
  },
  lie: "<b>이 도구가 감추는 것</b><br>" +
    "형질을 발바닥 면적 하나로 줄였습니다. 실제로는 수십 가지가 함께 다르고, 폭풍 말고도 먹이·포식자·질병이 작용합니다.<br>" +
    "자손의 발바닥을 두 부모의 평균으로만 정했습니다. 실제로는 유전·환경·발달이 모두 작용합니다.<br>" +
    "색과 번호는 혈통을 알아보기 위한 화면 표시일 뿐, 실제 유전 형질이 아닙니다.<br>" +
    "여기서 '세대'는 폭풍과 번식 한 주기이고, 어른과 자손이 함께 살아갑니다.<br>" +
    "개체군이 얼마나 자주 사라지는지는 <b>우리가 정한 숫자가 정합니다.</b> 그것으로 어느 가설이 맞는지 판단할 수 없습니다.<br>" +
    "초기 변이와 폭풍 세기는 실제 연구와 비슷한 값이 나오도록 미리 맞춘 것입니다 — 다만 우리 모형의 상승률 중앙값은 <b>{S}%</b>로 실제 9.2%와 같지 않습니다. " +
    "<b>우리 결과가 실제와 비슷하다는 것은 이 모형이 옳다는 증거가 아니라, 그렇게 설정했다는 뜻입니다.</b>"
};

/* ── 조원·계보 도우미 ── */
/* 계보 배정 — 0 = 야생(임자 없음), 1..G.count = 조원.
   ★ 조원마다 «여러 마리»를 나눠 가진다. 1마리로 시작하면 6세대 생존 확률이
     자연선택 20%·용불용설 33%뿐이라 대부분이 1~2세대에 탈락해 구경만 하게 된다(실측 2,000회). */
function perPlayer() { return Math.floor(P.N0 / G.count); }
/* 조원 i 의 누적 예측 적중 — predictLog 하나에서만 센다(F-1).
   화면(stormResult·tabDone)과 검산(C30)이 이 함수 하나를 쓴다. */
function predAccuracy(r, i) {
  var n = 0, hit = 0, q;
  if (!r || !r.predictLog) return { n: 0, hit: 0 };
  for (q = 0; q < r.predictLog.length; q++) {
    if (String(r.predictLog[q].actor) !== String(i)) continue;
    n++; if (r.predictLog[q].survived) hit++;
  }
  return { n: n, hit: hit };
}
/* 점수 산식 — 도마뱀 1마리 = 1점, 예측 적중 1회 = 3점 (사용자 지시 2026-08-23 ③).
   용불용설 탭에는 예측 단계가 없어 hit = 0, 점수 = 마릿수 그대로다(사용자 확정 — 표기 통일).
   예측 점수는 «무리를 잘 관찰했는가»에 대한 보상이지 형질을 바꾸는 조작에 대한 보상이
   아니다 — 금지 2 에 저촉하지 않음을 사용자가 확정했다(2026-08-23).
   화면(점수판·순위)과 검산(C30)이 이 함수 하나를 쓴다(F-1).
   ★ C30 이 이 함수를 sim.js 에서 잘라내 실행하므로 한 줄로 줄이지 말 것(잘라내기가 「함수 시작~열 0 의 }」다). */
function scoreOf(n, hit) {
  return n * 1 + hit * 3;
}
/* 조원 i 의 «지금» 점수 — 마릿수는 현재 개체군, 적중은 predictLog 누적 */
function scoreNow(i) {
  var r = run();
  var hit = (G.tab === "natural" && r) ? predAccuracy(r, i).hit : 0;
  return scoreOf(aliveOf(i), hit);
}
/* 무리 «전체» 평균 발바닥 — 처음 무리 → 지금 (사용자 요청 2026-08-23).
   tabDone 과 verdict 가 이 함수 하나를 쓴다(F-1). 값은 stats() 실계산 — 손글씨 아님(금지 16). */
function meanSpanText(r) {
  if (!r) return "";
  var s0 = stats(r.scenario.initialPop), s1 = stats(r.pop);
  if (s0.mean === null || s1.mean === null) return "";
  return "무리 평균 발바닥 <b>" + s0.mean.toFixed(2) + " → " + s1.mean.toFixed(2) + "</b>";
}
function pickedCount(i) { var c = 0, ps = picks(); for (var k = 0; k < ps.length; k++) if (ps[k] === i + 1) c++; return c; }
function pickDone() { for (var i = 0; i < G.count; i++) if (pickedCount(i) < perPlayer()) return false; return true; }
function lineageOf(i) { return i + 1; }
function countsNow() { var r = run(); return r ? countByLineage(r.pop) : {}; }
function aliveOf(i) { return countsNow()[lineageOf(i)] || 0; }
function myLizards(i) {
  var r = run(), ln = lineageOf(i), out = [];
  if (!r || ln === null) return out;
  for (var k = 0; k < r.pop.length; k++) if (r.pop[k].lineage === ln) out.push(r.pop[k]);
  return out;
}
/* 아직 차례가 남은 «다음» 조원. 계보가 전멸한 사람은 건너뛴다. 없으면 -1 */
function nextActor(from) {
  for (var i = from + 1; i < G.count; i++) if (aliveOf(i) > 0) return i;
  return -1;
}
function firstActor() { return aliveOf(0) > 0 ? 0 : nextActor(0); }

/* ── 캔버스 ── */
function fitCanvas(cv, hCss) {
  var dpr = window.devicePixelRatio || 1;
  var w = cv.clientWidth || cv.parentNode.clientWidth || 600;
  cv.style.height = hCss + "px";
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(hCss * dpr);
  var ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: ctx, w: w, h: hCss };
}

var lizardBoxes = [];   /* 클릭 판정용 — 매 렌더마다 다시 만든다 */

function ownerOfLineage(ln) {
  return (ln >= 1 && ln <= G.count) ? ln - 1 : -1;   /* 0 = 야생 */
}

/* slim 패널의 «실제» 높이 — 고정 168 예약은 문구가 늘면 모자라서
   아랫줄 도마뱀이 패널에 덮여 터치가 안 된다(2026-08-23 사용자 실기기 보고).
   applyPhaseVisibility → renderBodies 가 먼저 돌므로 여기서 재면 최신 내용의 높이다. */
function slimPanelReserve() {
  var ids = { pick: "ovPick", adopt: "ovAdopt", act: "ovAct",
              stormResult: "ovStormResult", genResult: "ovGenResult" };
  var ov = ids[G.phase] ? $(ids[G.phase]) : null;
  var panel = ov ? ov.querySelector(".opanel") : null;
  var h = panel ? panel.offsetHeight : 0;
  return h > 0 ? h + 22 : 168;   /* 22 = 오버레이 padding 10 + 여유 12 */
}

function drawStage() {
  var cv = $("stage"); if (!cv) return;
  /* slim 국면에서는 패널이 커진 만큼 캔버스 자체를 키워, 도마뱀 배치 공간을
     항상 262px 이상으로 보장한다 — 배치 밀도가 변하지 않아 터치 판정도 그대로다 */
  var slim = (G.phase === "pick" || G.phase === "adopt" || G.phase === "act" ||
              G.phase === "stormResult" || G.phase === "genResult");
  var reserve = slim ? slimPanelReserve() : 0;
  var f = fitCanvas(cv, 430 + Math.max(0, reserve - 168)), ctx = f.ctx, W = f.w, H = f.h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CSSV("--stage-light") || "#f7f9fb";
  ctx.fillRect(0, 0, W, H);
  lizardBoxes = [];

  var r = run();
  if (!r) return;
  var pop = r.pop.slice();
  var dead = (G.phase === "stormResult" && r.lastStorm) ? r.lastStorm.dead : [];
  var all = pop.concat(dead);
  if (!all.length) {
    ctx.fillStyle = CSSV("--t3") || "#94a3b8";
    ctx.font = "14px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("남은 도마뱀이 없습니다", W / 2, H / 2);
    return;
  }

  /* slim 패널이 덮는 아래쪽을 비워 둔다 — 그 국면에서는 도마뱀을 눌러야 하므로 가리면 안 된다 */
  var usableH = slim ? H - reserve : H;
  var cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(all.length * 1.6))));
  var rows = Math.ceil(all.length / cols);
  var cw = W / cols, ch = Math.min(usableH / rows, 96);
  var top = Math.max(6, (usableH - rows * ch) / 2);
  var turnLine = (G.phase === "act" || G.phase === "pick" || G.phase === "adopt") ? lineageOf(G.turn) : null;
  var anyGhost = false;

  for (var i = 0; i < all.length; i++) {
    var a = all[i], isDead = pop.indexOf(a) < 0;
    var cx = (i % cols) * cw + cw / 2;
    var cy = top + Math.floor(i / cols) * ch + ch / 2;
    var owner = ownerOfLineage(a.lineage);
    var color = owner >= 0 ? LINE_COLORS[owner % LINE_COLORS.length] : (CSSV("--d-gray") || "#94a3b8");

    /* 어미 정보(지시 ②) — 이번 세대 신생아만 갖는다. 수치는 자손의 수치 라벨과 «한 줄»로 합친다
       (별도 줄로 두면 자손 라벨과 같은 y 에서 겹친다 — 2026-08-23 스크린샷 실측). */
    var gh = (!isDead && a.bornGen === r.gen) ? G.ghost[G.tab][a.id] : null;

    /* 도마뱀 한 마리 = drawLizard 한 번. 테두리·별명도 그 함수가 그린다(시각 규격 단일 원천)
       subLabel = 발바닥 면적 지수 — 스탯을 보고 고르게 한다(사용자 지시 2026-08-23 ①).
       값 자체는 확률·문턱이 아니므로 금지 9 에 저촉하지 않는다. 확률로 바꿔 주는 표시는 계속 금지. */
    drawLizard(ctx, cx, cy, {
      padArea: a.padArea, color: color, label: owner >= 0 ? String(a.lineage) : null,
      owned: owner >= 0, dead: isDead, facing: (a.id % 2) ? 1 : -1, scale: 1,
      ownerName: owner >= 0 ? playerName(owner) : null,
      isTurn: owner >= 0 && a.lineage === turnLine,
      subLabel: a.padArea.toFixed(2) +
        (gh ? " (어미 " + gh.born.toFixed(2) + "→" + gh.given.toFixed(2) + ")" : "")
    });
    /* 등의 계보 번호 — 색각 두 번째 채널 (매뉴얼 §9) */

    /* 어미 원 — 이번 세대에 태어난 자손 옆에 어미의 «태어날 때(점선)»와 «물려줄 때(실선)» 원을
       겹쳐 그린다(사용자 지시 2026-08-23 ②). 두 탭이 같은 요소를 그리므로 장식 대칭(금지 3)을
       지키고, 인과 차이만 남는다 — 자연선택 탭은 두 원이 정확히 겹치고(태어난 값 그대로 물려줌),
       용불용설 탭은 훈련·폭풍으로 커진 실선 원이 점선 원 밖으로 나온다(획득분까지 물려줌).
       반경 차이는 작으므로 수치(subLabel의 「어미 a→b」)가 주 채널이고 원은 시각 앵커다. */
    if (gh) {
      var gx = cx - Math.min(34, cw / 2 - 12), gy = cy + 6;
      var R = function (pad) { return 9 * Math.sqrt(pad); };
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = CSSV("--t2") || "#57606a";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(gx, gy, R(gh.given), 0, Math.PI * 2); ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([2.6, 2.4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(gx, gy, R(gh.born), 0, Math.PI * 2); ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      ctx.restore();
      anyGhost = true;
    }

    /* 예측 표식 — 자연선택 탭의 «유일한» 조작 성공 표시. 발바닥 수치(y+26)와 겹치지 않게 y+38 */
    if (!isDead && G.tab === "natural") {
      for (var q in r.predictBy) if (r.predictBy[q] === a.id) {
        ctx.globalAlpha = 1; ctx.fillStyle = CSSV("--t1") || "#1f2328";
        ctx.font = "bold 11px sans-serif"; ctx.fillText("예측", cx, cy + 38);
      }
    }
    ctx.globalAlpha = 1;
    lizardBoxes.push({ id: a.id, lineage: a.lineage, x: cx, y: cy, r: 32,
                       color: color, padArea: a.padArea, dead: isDead });
  }
  /* 어미 원 범례 — 유령 원이 하나라도 그려질 때만, 두 탭 «같은 문장»으로 (장식 대칭) */
  if (anyGhost) {
    ctx.save();
    ctx.fillStyle = CSSV("--t2") || "#57606a";
    ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("겹친 원 = 어미의 발바닥 — 점선: 태어날 때 · 실선: 물려줄 때. 두 원이 같으면 태어난 값 그대로 물려준 것입니다.", W / 2, 14);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
}

function drawDist() {
  var cv = $("dist"); if (!cv) return;
  var f = fitCanvas(cv, 150), ctx = f.ctx, W = f.w, H = f.h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CSSV("--stage-light") || "#f7f9fb"; ctx.fillRect(0, 0, W, H);
  var r = run(); if (!r || !r.pop.length) return;
  var lo = P.PAD_MIN, hi = P.PAD_MAX, nb = 20, i;
  var bins = new Array(nb); for (i = 0; i < nb; i++) bins[i] = 0;
  for (i = 0; i < r.pop.length; i++) {
    var k = Math.floor((r.pop[i].padArea - lo) / (hi - lo) * nb);
    if (k < 0) k = 0; if (k >= nb) k = nb - 1;
    bins[k]++;
  }
  var mx = 1; for (i = 0; i < nb; i++) if (bins[i] > mx) mx = bins[i];
  var padL = 34, padB = 22, bw = (W - padL - 8) / nb;
  ctx.strokeStyle = CSSV("--stage-line") || "#dbe3ea"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, H - padB); ctx.lineTo(W - 6, H - padB); ctx.stroke();
  ctx.fillStyle = CSSV("--d-gray") || "#64748b";
  for (i = 0; i < nb; i++) {
    if (!bins[i]) continue;
    var h = (H - padB - 12) * bins[i] / mx;
    ctx.fillRect(padL + i * bw + 1, H - padB - h, bw - 2, h);
  }
  ctx.fillStyle = CSSV("--t3") || "#94a3b8"; ctx.font = "10px sans-serif";
  ctx.textAlign = "left"; ctx.fillText(lo.toFixed(2), padL, H - 8);
  ctx.textAlign = "right"; ctx.fillText(hi.toFixed(2), W - 6, H - 8);
  ctx.textAlign = "center"; ctx.fillText("발바닥 면적 지수", (padL + W) / 2, H - 8);
  ctx.textAlign = "left"; ctx.fillText(String(mx), 4, 14);
}

/* ── 점수판 ── */
function renderBoard() {
  var box = $("boardRows");
  if (!G.players.length) { box.innerHTML = '<div class="empty">게임을 시작하면 표시됩니다</div>'; return; }
  var html = "";
  for (var i = 0; i < G.count; i++) {
    /* 아직 도마뱀을 안 고른 조원도 «자리»는 보여 준다 — 누구 차례인지 알아야 하므로 */
    var n = aliveOf(i), out = (G.phase !== "pick") && n === 0;
    var lost = G.lost[G.tab][i] || 0;
    var now = (G.phase === "act" || G.phase === "pick" || G.phase === "adopt") && G.turn === i;
    html += '<div class="prow' + (now ? " now" : "") + (out ? " out" : "") + '">' +
      '<span class="dot" style="background:' + playerColor(i) + '"></span>' +
      '<span class="nm">' + esc(playerName(i)) + '</span>' +
      '<span class="ct">' + n + '마리 · ' + scoreNow(i) + '점' + (lost ? '<span class="sub"> (계보 ' + lost + '회 소실)</span>' : '') + '</span></div>';
  }
  box.innerHTML = html;
  $("boardTitle").textContent = "우리 조 도마뱀 — " + (G.tab === "lamarck" ? "용불용설" : "자연선택");
}

function renderReadouts() {
  var r = run(), s = r ? stats(r.pop) : null;
  $("roGen").textContent = r ? (r.gen + " / " + P.GENS) : "–";
  $("roN").textContent = s && s.n ? s.n : "–";
  $("roMean").textContent = s && s.mean !== null ? s.mean.toFixed(3) : "–";
  $("roSd").textContent = s && s.sd !== null ? s.sd.toFixed(3) : "–";
  $("roSurv").textContent = (r && r.lastStorm) ? Math.round(r.lastStorm.survivalRate * 100) + "%" : "–";
  $("roStorm").textContent = (r && r.lastStorm) ? r.lastStorm.strength : "–";
}
function renderCards() {
  var r = run(), box = $("cardList");
  if (!r || !r.cards.length) { box.innerHTML = '<div class="empty">아직 카드가 없습니다</div>'; return; }
  var html = "";
  for (var i = r.cards.length - 1; i >= 0; i--) {
    var c = r.cards[i], same = Math.abs(c.born - c.died) < 1e-9;
    var ow = ownerOfLineage(c.lineage);
    html += '<div class="cardrow"><span class="no">#' + c.lineage + '</span>' +
      (ow >= 0 ? '<span style="color:' + playerColor(ow) + ';font-weight:700">' + esc(playerName(ow)) + '</span>' : '<span style="color:var(--t3)">야생</span>') +
      '<span>태어날 때 ' + c.born.toFixed(2) + ' → ' + (c.cause === "생존" ? "지금" : "죽을 때") + ' ' + c.died.toFixed(2) + '</span>' +
      '<span class="' + (same ? "tagsame" : "tagdiff") + '">' + (same ? "한 번도 변하지 않음" : "변함") + '</span></div>';
  }
  box.innerHTML = html;
}

/* ── 인원·별명 입력 ── */
function renderSetup() {
  var row = $("cntRow"), html = "", i;
  for (i = MIN_PLAYERS; i <= MAX_PLAYERS; i++)
    html += '<button class="cntbtn" data-n="' + i + '" aria-pressed="' + (G.count === i) + '">' + i + '명</button>';
  row.innerHTML = html;
  var nb = $("nickBox"); html = "";
  for (i = 0; i < G.count; i++)
    html += '<div class="nickrow"><span class="dot" style="background:' + LINE_COLORS[i % LINE_COLORS.length] + '"></span>' +
      '<input class="nick" data-i="' + i + '" type="text" maxlength="8" placeholder="' + defaultName(i) + ' 별명" value="' +
      ((G.players[i] && G.players[i].name) ? G.players[i].name.replace(/"/g, "&quot;") : "") + '"></div>';
  nb.innerHTML = html;
}

/* ── 국면별 본문 ── */
function renderBodies() {
  var r = run(), i;
  $("tabdesc").innerHTML = TEXT.tabdesc[G.tab];
  $("causalBox").innerHTML = TEXT.causal[G.tab];
  /* 「도구의 거짓말」의 상승률도 VERDICT 에서 뽑는다(금지 16). 9.2% 는 원논문 값이라 상수다. */
  var lieTxt = TEXT.lie.replace(/{S}/g, VERDICT.selShift.toFixed(1));
  $("lieBox").innerHTML = lieTxt;
  $("lieVerdict").innerHTML = lieTxt;
  /* 폭풍 횟수는 P.TH 에서 뽑는다 — 세대 수를 바꿔도 규칙 설명이 어긋나지 않는다 */
  $("rulesBody").innerHTML = TEXT.rules[G.tab].replace(/{N}/g, P.TH.length).replace(/{T}/g, P.TOUCH_MAX);
  /* 환경 변화 고지도 P.TH 에서 뽑는다 (P-검토 A-3).
     여기에 「지금부터 폭풍이 점점 커집니다」라고 적혀 있었는데, 6세대판의 계단형 일정
     (…1.03, 1.03 → 1.20, 1.20…)을 전제한 문장이었다. 4세대 일정은 매 폭풍 세지므로
     「지금부터」가 거짓이고, 도마뱀 평균이 오르는 것과 나란히 놓이면 오히려
     「도마뱀이 강해져서 폭풍이 세졌다」는 목적론을 부추긴다. */
  /* 제목도 본문과 «같은 사실»에서 나와야 한다. 「환경이 바뀝니다」(지금 바뀐다)와
     「처음부터 매번 세지고 있었다」가 한 화면에서 서로를 부정하고 있었다(P-검토 2차 B-22). */
  $("envTitle").textContent = envAllRising() ? "폭풍이 계속 세집니다" : "환경이 바뀝니다";
  $("envIntro").innerHTML = envIntroText();
  $("btnEnvNext").textContent = (ENV_STEP + 1) + "세대 시작";

  if (G.phase === "pick") {
    $("pickTitle").textContent = "3단계 — 도마뱀 고르기 (" + (G.tab === "lamarck" ? "용불용설" : "자연선택") + " 탭)";
    var per = perPlayer(), line = "";
    for (var q = 0; q < G.count; q++)
      line += '<span style="color:' + playerColor(q) + ';font-weight:700">' + esc(playerName(q)) + "</span> " +
              pickedCount(q) + "/" + per + "마리 &nbsp; ";
    $("pickBody").innerHTML = '<p class="big" style="color:' + playerColor(G.turn) + '">' +
      esc(playerName(G.turn)) + " 차례 — 회색 도마뱀을 한 마리 고르세요 (한 사람당 " + per + "마리)</p><p>" + line + "</p>" +
      '<p class="hint">도마뱀 아래 숫자는 <b>발바닥 면적 지수</b>입니다 — 숫자를 보고 고르세요.</p>';
  }

  if (G.phase === "adopt") {
    var wl = wildLizards().length;
    $("adoptBody").innerHTML = '<p class="big" style="color:' + playerColor(G.turn) + '">' +
      esc(playerName(G.turn)) + " — 맡은 계보가 모두 사라졌습니다</p>" +
      "<p>남은 야생 도마뱀 <b>" + wl + "마리</b> 중 하나를 새로 맡으세요.</p>";
  }

  if (G.phase === "act" && r) {
    var mine = myLizards(G.turn), col = playerColor(G.turn);
    var body = '<p class="big" style="color:' + col + '">' + esc(playerName(G.turn)) + " 차례</p>";
    if (G.tab === "lamarck") {
      $("actTitle").textContent = "훈련 (내 도마뱀만, 세대당 " + P.TOUCH_MAX + "회)";
      body += "<p>내 계보(#" + lineageOf(G.turn) + ") 도마뱀을 <b>반복해서 눌러</b> 훈련시키세요." +
              ' <span class="hint">아래 숫자(발바닥 면적 지수)를 보고 어느 도마뱀을 훈련할지 고르세요.</span></p>';
      body += '<p class="big">훈련 ' + (P.TOUCH_MAX - touchesLeftOf(r, G.turn)) + " / " + P.TOUCH_MAX + "회" +
              ' &nbsp; <span style="color:var(--t2);font-weight:400">내 도마뱀 ' + mine.length + "마리</span></p>";
    } else {
      $("actTitle").textContent = "예측 (내 도마뱀 하나, 세대당 1회)";
      body += "<p>내 계보(#" + lineageOf(G.turn) + ") 도마뱀 하나를 눌러 <b>살아남을지 예측</b>하세요." +
              ' <span class="hint">아래 숫자(발바닥 면적 지수)를 보고 예측하세요 — 적중하면 3점입니다.</span></p>';
      body += '<p class="big">예측 ' + (r.predictBy[G.turn] !== undefined ? 1 : 0) + " / 1회" +
              ' &nbsp; <span style="color:var(--t2);font-weight:400">내 도마뱀 ' + mine.length + "마리</span></p>";
    }
    if (G.lastMsg) body += '<p style="color:var(--t2)">' + G.lastMsg + "</p>";
    $("actBody").innerHTML = body;
  }

  if (G.phase === "stormWarn" && r) {
    var th = r.scenario.thresholds[r.gen];
    $("warnStrength").textContent = th <= 0.95 ? "약함" : (th <= 1.03 ? "보통" : "강함");
  }

  if (G.phase === "stormResult" && r && r.lastStorm) {
    var st = r.lastStorm, h = "";
    h += "<p>살아남은 도마뱀 <b>" + st.survivors.length + "마리</b> / 죽은 도마뱀 <b>" + st.dead.length + "마리</b>" +
         " (생존율 " + Math.round(st.survivalRate * 100) + "%)</p>";
    if (st.shift !== null)
      h += "<p>살아남은 무리의 평균 발바닥 면적은 폭풍 전보다 <b>" + (st.shift * 100).toFixed(1) + "%</b> 넓습니다.</p>";
    if (G.tab === "natural") {
      var hits = "";
      for (i = 0; i < G.count; i++) {
        var last = null;
        for (var q = r.predictLog.length - 1; q >= 0; q--)
          if (String(r.predictLog[q].actor) === String(i) && r.predictLog[q].gen === st.gen) { last = r.predictLog[q]; break; }
        /* ★ 누적 적중률을 함께 보인다 (설계지시안 §3 자연선택 탭 피드백 · §9 사후 검토가 이 값을 쓴다).
           빠져 있으면 자연선택 탭의 «유일한» 피드백이 한 판짜리가 되어,
           발바닥 원이 즉시 커지는 용불용설 탭보다 밋밋해진다 — X-1 방향이다. */
        var acc = predAccuracy(r, i);
        if (last) hits += '<span style="color:' + playerColor(i) + ';font-weight:700">' + esc(playerName(i)) + "</span> " +
                          (last.survived ? "적중" : "빗나감") +
                          ' <span class="sub">(누적 ' + acc.hit + "/" + acc.n +
                          (acc.n ? " · " + Math.round(acc.hit / acc.n * 100) + "%" : "") + ")</span> &nbsp; ";
      }
      if (hits) h += "<p>" + hits + "</p>";
    }
    $("stormResultBody").innerHTML = h;
  }

  if (G.phase === "genResult" && r) {
    var cur = r.history[r.history.length - 1], prev = r.history.length > 1 ? r.history[r.history.length - 2] : null;
    var d = function (a, b, dg) { if (b === null || b === undefined) return ""; var v = a - b; return ' <span style="color:var(--t3)">(' + (v >= 0 ? "+" : "") + v.toFixed(dg) + ")</span>"; };
    $("genResultTitle").textContent = r.gen + "세대 결산";
    var g = "<p>전체 개체수 <b>" + cur.stats.n + "</b>" + (prev ? d(cur.stats.n, prev.stats.n, 0) : "") + " &nbsp; " +
            "평균 <b>" + cur.stats.mean.toFixed(3) + "</b>" + (prev ? d(cur.stats.mean, prev.stats.mean, 3) : "") + " &nbsp; " +
            "표준편차 <b>" + cur.stats.sd.toFixed(3) + "</b>" + (prev ? d(cur.stats.sd, prev.stats.sd, 3) : "") + "</p>";
    g += "<p>";
    for (i = 0; i < G.count; i++)
      g += '<span style="color:' + playerColor(i) + ';font-weight:700">' + esc(playerName(i)) + "</span> " +
           aliveOf(i) + "마리 · " + scoreNow(i) + "점 &nbsp; ";
    g += "</p>";
    /* 유령 원 안내 — 캔버스 글자는 낭독기가 못 읽으므로 같은 문장을 글로도 남긴다.
       두 탭 «같은 문장»이다(장식 대칭) — 차이는 화면의 원이 스스로 말한다. */
    g += '<p class="hint">이번 세대 자손 옆의 겹친 원은 <b>어미의 발바닥</b>입니다 — 점선: 태어날 때 · 실선: 물려줄 때. ' +
         "두 원이 같으면 <b>태어난 값 그대로</b> 물려준 것입니다. " +
         "자손의 값은 <b>두 부모의 평균</b>에 작은 변이를 더한 것이라, 어미가 물려준 값과 똑같지는 않습니다.</p>";
    $("genResultBody").innerHTML = g;
    $("btnNextGen").textContent = (r.gen >= P.GENS) ? "이 탭 마치기" : "다음 세대";
  }

  if (G.phase === "extinct" && r) {
    $("extinctBody").innerHTML =
      "<p><b>" + (r.gen + 1) + "번째 폭풍</b>에서 남은 도마뱀이 2마리 미만이 되어 자손을 남길 수 없었습니다.</p>" +
      "<p>개체군이 사라지는 것도 결과입니다. 숨기지 않았습니다.</p>" +
      /* 재시작이 «새 무리»임을 미리 밝힌다 — 같은 무리를 다시 돌리는 것이 아니다 */
      '<p class="hint">다시 시작하면 <b>새 무리</b>로 시작합니다. 폭풍 일정은 그대로입니다.</p>';
  }

  if (G.phase === "tabDone") {
    $("tabDoneTitle").textContent = (G.tab === "lamarck" ? "용불용설" : "자연선택") + " 탭 결과";
    /* 자연선택 탭은 최종 «누적 적중률»을 남긴다 — 설계지시안 §9 사후 검토가 이 값을 회수한다 */
    var accHtml = "";
    if (G.tab === "natural" && r) {
      var parts = [];
      for (i = 0; i < G.count; i++) {
        var a = predAccuracy(r, i);
        if (!a.n) continue;
        parts.push('<span style="color:' + playerColor(i) + ';font-weight:700">' + esc(playerName(i)) + "</span> " +
          a.hit + "/" + a.n + " (" + Math.round(a.hit / a.n * 100) + "%)");
      }
      if (parts.length) accHtml = '<p class="hint">예측 적중률 — ' + parts.join(" · ") + "</p>";
    }
    $("tabDoneBody").innerHTML =
      (r && meanSpanText(r) ? "<p>" + meanSpanText(r) + "</p>" : "") +
      rankHtml(G.results[G.tab]) + accHtml +
      (!(G.completed.lamarck && G.completed.natural) ? '<p class="hint">다른 탭도 마치면 판정을 볼 수 있습니다.</p>' : "");
  }

  $("doneL").className = "tabdone" + (G.completed.lamarck ? " is-done" : "");
  $("doneN").className = "tabdone" + (G.completed.natural ? " is-done" : "");
}

/* ── 순위 — 점수(scoreOf)로 겨룬다 (사용자 지시 2026-08-23 ③) ── */
function makeResult() {
  var out = [], i, r = run();
  for (i = 0; i < G.count; i++) {
    var n = aliveOf(i);
    var hit = (G.tab === "natural" && r) ? predAccuracy(r, i).hit : 0;
    out.push({ i: i, name: playerName(i), color: playerColor(i), n: n, hit: hit,
               score: scoreOf(n, hit), lineage: lineageOf(i), lost: G.lost[G.tab][i] || 0 });
  }
  out.sort(function (a, b) { return b.score - a.score; });
  var pos = 0, prev = null;
  for (i = 0; i < out.length; i++) { if (out[i].score !== prev) { pos = i + 1; prev = out[i].score; } out[i].pos = pos; }
  return out;
}
function rankHtml(res) {
  if (!res) return "";
  var h = "";
  for (var i = 0; i < res.length; i++)
    h += '<div class="rank' + (res[i].pos === 1 ? " top" : "") + '">' +
      '<span class="pos">' + res[i].pos + "위</span>" +
      '<span class="dot" style="background:' + res[i].color + '"></span>' +
      '<span class="nm">' + esc(res[i].name) + ' 도마뱀</span>' +
      '<span class="ct">' + res[i].score + "점" +
      '<span class="sub"> (' + res[i].n + "마리 × 1" +
      (res[i].hit ? " + 적중 " + res[i].hit + "회 × 3" : "") + ")" +
      (res[i].lost ? " · 계보 " + res[i].lost + "회 소실" : "") + "</span></span></div>";
  return h;
}

function render() {
  applyPhaseVisibility();
  renderBodies();
  renderBoard();
  renderReadouts();
  renderCards();
  drawStage();
  drawDist();
  $("tabL").setAttribute("aria-selected", G.tab === "lamarck" ? "true" : "false");
  $("tabN").setAttribute("aria-selected", G.tab === "natural" ? "true" : "false");
}

/* ── 국면 전이 — 전부 가드를 둔다 ── */
function setPhase(p) { G.phase = p; G.phaseByTab[G.tab] = p; render(); }

function toSetup() { if (G.phase !== "idle") return; renderSetup(); setPhase("setup"); }
function toRules() {
  if (G.phase !== "setup") return;
  var inputs = $("nickBox").querySelectorAll(".nick");
  G.players = [];
  for (var i = 0; i < G.count; i++) {
    var v = inputs[i] ? inputs[i].value.trim() : "";
    G.players.push({ name: v || defaultName(i) });
  }
  setPhase("rules");
}
/* ★ 시드는 «매번 달라야» 한다.
   실측(2026-08-23, restart_probe): 자연선택 탭에서 전멸한 시드 55개를 같은 시나리오로
   5회씩 다시 돌렸더니 55/55 가 «똑같은 세대에 똑같이» 전멸했다. 자연선택 탭은 설계상
   학생 조작이 생태에 전혀 영향을 주지 않으므로(결정 #5), 같은 시드로 재시작하면
   학생은 빠져나올 수 없는 전멸 반복에 갇힌다. 그래서 재시작은 새 시드를 뽑는다.
   폭풍 «일정»은 P.TH 라 시드와 무관하게 같다 — 달라지는 것은 처음 무리뿐이다. */
var seedTick = 0;
function freshSeed() { seedTick++; return ((Date.now() + seedTick * 7919) % 100000) + 1; }

/* 환경 변화 고지 문장을 P.TH 에서 «만든다». 화면에 폭풍 일정을 손으로 적지 않는다(금지 16).
   envChange 는 gen===2 를 마친 뒤 1회 뜨므로, 그때 맞이할 폭풍은 P.TH[2] = ENV_STEP 번째다. */
var ENV_STEP = 2;
function thJumps() {
  var d = [], i;
  for (i = 1; i < P.TH.length; i++) d.push(P.TH[i] - P.TH[i - 1]);
  return d;
}
function envAllRising() {
  return thJumps().every(function (x) { return x > 0; });
}
function envIntroText() {
  var d = thJumps(), i, big = 0;
  for (i = 1; i < d.length; i++) if (d[i] > d[big] + 1e-12) big = i;
  /* d[k] 는 (k+1)번째 폭풍이 k번째보다 얼마나 센가다 */
  var allRising = envAllRising();
  var s = allRising
    ? "폭풍은 <b>처음부터 매번 조금씩 세지고 있었습니다.</b> "
    : "폭풍 세기는 미리 정해진 일정대로 오르내립니다. ";
  s += (big + 1 === ENV_STEP)
    ? "그리고 <b>이번 " + (ENV_STEP + 1) + "번째 폭풍이 그중 가장 크게 뛰는 때</b>입니다."
    : "다음 폭풍부터 더 큰 폭풍이 이어집니다.";
  return s;
}

function toPick() {
  if (G.phase !== "rules") return;
  if (!G.scenario) {
    G.scenario = makeScenario(freshSeed(), {});
    G.runs.lamarck = newRun(G.scenario, "lamarck");
    G.runs.natural = newRun(G.scenario, "natural");
  }
  var rr = run(), z;
  for (z = 0; z < rr.pop.length; z++) rr.pop[z].lineage = 0;   /* 전부 야생에서 시작 */
  G.picks[G.tab] = [];
  G.lost[G.tab] = [];
  G.turn = 0;
  setPhase("pick");
}
/* 야생(계보 0) 개체가 남아 있는가 — 입양 풀. 야생도 번식하므로 대개 유지된다 */
function wildLizards() {
  var r = run(), out = [], i;
  if (!r) return out;
  for (i = 0; i < r.pop.length; i++) if (r.pop[i].lineage === 0) out.push(r.pop[i]);
  return out;
}
/* 계보를 잃었고 입양할 야생이 남은 «다음» 조원. 없으면 -1 */
function nextAdopter(from) {
  if (!wildLizards().length) return -1;
  for (var i = from + 1; i < G.count; i++) if (aliveOf(i) === 0) return i;
  return -1;
}
function firstAdopter() { return (aliveOf(0) === 0 && wildLizards().length) ? 0 : nextAdopter(0); }

function beginGen() {
  if (G.phase !== "pick" && G.phase !== "adopt" && G.phase !== "genResult" && G.phase !== "envChange") return;
  /* 계보가 사라진 조원은 야생 도마뱀 하나를 새로 맡는다 (2026-08-22 사용자 확정).
     그대로 두면 4인 조에서 3세대쯤에 절반이 할 일이 없어진다(실측: 6세대 생존 42%). */
  var ad = firstAdopter();
  if (ad !== -1) { G.turn = ad; G.lastMsg = ""; setPhase("adopt"); return; }
  var r = run();
  for (var i = 0; i < G.count; i++) r.touchLeftBy[i] = P.TOUCH_MAX;
  G.turn = firstActor();
  G.lastMsg = "";
  if (G.turn === -1) { setPhase("stormWarn"); return; }   /* 전원 전멸 계보 — 조작 생략 */
  setPhase("act");
}
function turnDone() {
  if (G.phase !== "act") return;
  var nx = nextActor(G.turn);
  if (nx === -1) return;
  G.turn = nx; G.lastMsg = "";
  render();
}
function callStorm() { if (G.phase !== "act") return; setPhase("stormWarn"); }
/* 폭풍 연출 — 이 2.5초가 학생이 «누가 떨어지는지» 눈으로 읽는 유일한 순간이다.
   판정은 storm() 이 즉시 끝내고, 연출은 그 결과를 재생만 한다. */
var STORM_MS = 2500;
function faceStorm() {
  if (G.phase !== "stormWarn") return;
  var r = run();
  var pre = lizardBoxes.slice();               /* 폭풍 «전» 배치를 붙잡아 둔다 */
  var th = r.scenario.thresholds[r.gen];
  var st = storm(r);
  var live = {}, i;
  for (i = 0; i < st.survivors.length; i++) live[st.survivors[i].id] = true;
  G.stormAnim = {
    strength: st.strength, t0: 0,
    falling: pre.filter(function (b) { return !live[b.id]; }),
    holding: pre.filter(function (b) { return live[b.id]; })
  };
  setPhase("storm");
  G.stormAnim.t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  if (G.rafId) cancelAnimationFrame(G.rafId);
  loopStorm();
  setTimeout(afterStorm, STORM_MS);
}
function loopStorm() {
  G.rafId = null;
  if (G.phase !== "storm" || !G.stormAnim) return;
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  var t = Math.min(1, (now - G.stormAnim.t0) / STORM_MS);
  drawStormScene(t);
  if (t < 1 && !document.hidden) G.rafId = requestAnimationFrame(loopStorm);
}
function drawStormScene(t) {
  var cv = $("stage"); if (!cv) return;
  var f = fitCanvas(cv, 430), ctx = f.ctx, W = f.w, H = f.h, A = G.stormAnim, i, b;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CSSV("--stage-light") || "#f7f9fb"; ctx.fillRect(0, 0, W, H);
  /* 버티는 개체 — 바람에 흔들린다 */
  for (i = 0; i < A.holding.length; i++) {
    b = A.holding[i];
    var sway = Math.sin(t * 12 + i) * (2 + t * 3);
    drawLizard(ctx, b.x + sway, b.y, { padArea: b.padArea, color: b.color, label: null,
      owned: false, dead: false, facing: 1, scale: 1 });
  }
  /* 떨어지는 개체 — 붙잡지 못하고 밀려 난다 */
  for (i = 0; i < A.falling.length; i++) {
    b = A.falling[i];
    var p = Math.max(0, (t - 0.25 - (i % 5) * 0.05) / 0.6);
    if (p <= 0) {
      drawLizard(ctx, b.x + Math.sin(t * 14 + i) * 4, b.y, { padArea: b.padArea, color: b.color,
        label: null, owned: false, dead: false, facing: 1, scale: 1 });
    } else {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.translate(b.x + p * 90, b.y + p * p * 130); ctx.rotate(p * 1.8);
      drawLizard(ctx, 0, 0, { padArea: b.padArea, color: b.color, label: null,
        owned: false, dead: false, facing: 1, scale: 1 });
      ctx.restore();
    }
  }
  /* 날씨 층 — 도마뱀 위에 덧그린다 */
  drawStorm(ctx, W, H, t, A.strength, { falling: A.falling, holding: A.holding });
}
function afterStorm() { if (G.phase !== "storm") return; setPhase("stormResult"); }

/* ── 어미 유도 — 유령 원(지시 ②)의 데이터. ──
   코어는 자손에 부모 id 를 남기지 않고, 코어는 고칠 수 없다(금지 11).
   keyed 난수는 (seed, gen, id, salt) 결정론이므로 breed() 와 «같은 식»으로 부모를
   다시 뽑을 수 있다 — 단, 절차 복제는 원본이 바뀌면 조용히 틀리는 함정이라(C27 내력)
   재계산한 자손 값이 실제 자손과 다르면 그 자손의 유령 원은 «그리지 않는다»(fail-safe).
   C31 이 이 유도가 코어와 일치하는지를 검사한다. */
function computeGhosts(r) {
  var surv = r.pop, seed = r.scenario.seed, gen = r.gen;
  var out = {}, i, mi, fi, m, f, pd, cid;
  if (surv.length < P.MIN_BREED) return out;
  var want = Math.min(P.CAP, surv.length + Math.ceil(surv.length * P.MUL)) - surv.length;
  for (i = 0; i < want; i++) {
    cid = r.nextId + i;
    mi = Math.floor(keyed(seed, gen, cid, SALT.PA) * surv.length);
    if (mi >= surv.length) mi = surv.length - 1;
    fi = Math.floor(keyed(seed, gen, cid, SALT.PB) * (surv.length - 1));
    if (fi >= surv.length - 1) fi = surv.length - 2;
    if (fi >= mi) fi += 1;
    m = surv[mi]; f = surv[fi];
    pd = clampPad((m.padArea + f.padArea) / 2
                  + keyedGauss(seed, gen, cid, SALT.MUT, 0, r.scenario.sigm));
    out[cid] = { expect: pd, born: m.bornPad, given: m.padArea };
  }
  return out;
}

function doBreed() {
  if (G.phase !== "stormResult") return;
  setPhase("breed");
  var r = run();
  var gh = computeGhosts(r);       /* breed «전»의 생존자 배열로 유도한다 */
  var res = breed(r);              /* born = 이번 번식의 «진짜» 신생아 목록 — bornGen 비교보다 정확하다
                                      (소멸 시 gen 이 안 올라 기존 개체가 신생아로 오인될 수 있다) */
  G.ghost[G.tab] = {};
  for (var i = 0; i < res.born.length; i++) {
    var k = res.born[i];
    if (!gh[k.id]) continue;
    /* fail-safe — 재계산 값이 실제 자손과 같을 때만 채택한다 */
    if (Math.abs(gh[k.id].expect - k.padArea) < 1e-12)
      G.ghost[G.tab][k.id] = { born: gh[k.id].born, given: gh[k.id].given };
  }
  setTimeout(afterBreed, 1500);
}
function afterBreed() {
  if (G.phase !== "breed") return;
  var r = run();
  if (r.extinct) { closeCards(r); setPhase("extinct"); return; }
  if (r.gen >= P.GENS) { finishTab(); return; }
  if (r.gen === ENV_STEP) { setPhase("envChange"); return; }   /* 고지 문구와 같은 상수를 쓴다 */
  setPhase("genResult");
}
function finishTab() {
  var r = run();
  closeCards(r);
  G.results[G.tab] = makeResult();
  G.completed[G.tab] = true;
  setPhase("tabDone");
}
function nextGen() {
  if (G.phase !== "genResult") return;
  if (run().gen >= P.GENS) { finishTab(); return; }
  beginGen();
}
function envNext() { if (G.phase !== "envChange") return; beginGen(); }

/* 소멸 뒤 「다시 시작」 — «이 탭만» 되돌린다. 다른 탭의 결과를 지우지 않는다.
   ★ 반드시 «새 시드»로 다시 만든다 (freshSeed 주석의 실측 근거).
     같은 시나리오를 다시 돌리면 자연선택 탭은 같은 전멸을 무한 반복한다. */
function restartTab() {
  if (G.phase !== "extinct") return;
  G.reseeded[G.tab]++;
  G.runs[G.tab] = newRun(makeScenario(freshSeed(), {}), G.tab);
  var rt = G.runs[G.tab], zz;
  for (zz = 0; zz < rt.pop.length; zz++) rt.pop[zz].lineage = 0;
  G.picks[G.tab] = [];
  G.lost[G.tab] = [];
  G.ghost[G.tab] = {};
  G.completed[G.tab] = false;
  G.results[G.tab] = null;
  G.turn = 0; G.lastMsg = "";
  setPhase("pick");
}
function restartAll() {
  if (G.phase === "storm" || G.phase === "breed") return;
  G.runs = { lamarck: null, natural: null };
  G.picks = { lamarck: [], natural: [] };
  G.lost = { lamarck: [], natural: [] };
  G.completed = { lamarck: false, natural: false };
  G.results = { lamarck: null, natural: null };
  G.phaseByTab = { lamarck: "idle", natural: "idle" };
  G.reseeded = { lamarck: 0, natural: 0 };
  G.ghost = { lamarck: {}, natural: {} };
  G.scenario = null; G.players = []; G.turn = 0;
  setPhase("idle");
}
function openVerdict() {
  if (G.phase !== "tabDone") return;
  if (!(G.completed.lamarck && G.completed.natural)) return;
  renderVerdict();
  setPhase("verdict");
  showReplayStatic();
}
function switchTab(t) {
  if (G.phase === "storm" || G.phase === "breed") return;
  if (t === G.tab) return;
  G.tab = t;
  G.phase = G.phaseByTab[t];      /* ★ 다른 탭의 진행 상태를 보존한다 */
  if (G.phase === "idle" && G.players.length) { G.picks[t] = []; G.turn = 0; G.phase = "rules"; G.phaseByTab[t] = "rules"; }
  G.lastMsg = "";
  render();
}

/* ── 무대 클릭 ── */
function onStageClick(ev) {
  if (G.phase !== "act" && G.phase !== "pick" && G.phase !== "adopt") return;
  var r = run(); if (!r) return;
  var cv = $("stage"), rect = cv.getBoundingClientRect();
  var x = ev.clientX - rect.left, y = ev.clientY - rect.top, hit = null;
  for (var i = 0; i < lizardBoxes.length; i++) {
    var b = lizardBoxes[i], dx = x - b.x, dy = y - b.y;
    if (dx * dx + dy * dy <= b.r * b.r) { hit = b; break; }
  }
  if (!hit) return;

  if (G.phase === "pick") {
    if (hit.lineage !== 0) return;                 /* 이미 임자가 있는 도마뱀 */
    find(r, hit.id).lineage = G.turn + 1;          /* 이 조원의 계보로 편입 */
    picks().push(G.turn + 1);
    track(r, hit.id);
    if (pickDone()) { beginGen(); return; }
    /* 라운드 로빈 — 아직 몫이 남은 다음 조원에게 넘긴다 */
    for (var q = 1; q <= G.count; q++) {
      var cand = (G.turn + q) % G.count;
      if (pickedCount(cand) < perPlayer()) { G.turn = cand; break; }
    }
    render(); return;
  }

  if (G.phase === "adopt") {
    if (hit.lineage !== 0) return;                 /* 야생만 입양할 수 있다 */
    find(r, hit.id).lineage = G.turn + 1;
    G.lost[G.tab][G.turn] = (G.lost[G.tab][G.turn] || 0) + 1;
    track(r, hit.id);
    beginGen();                                    /* 다음 입양자 또는 조작 국면으로 */
    return;
  }

  /* act — 자기 계보만 조작할 수 있다 */
  if (hit.lineage !== lineageOf(G.turn)) {
    G.lastMsg = "내 계보(#" + lineageOf(G.turn) + ") 도마뱀만 고를 수 있습니다.";
    render(); return;
  }
  track(r, hit.id);
  if (G.tab === "lamarck") {
    var ok = touch(r, hit.id, G.turn);
    G.lastMsg = ok ? "" : "이 세대의 훈련 횟수를 다 썼습니다.";
  } else {
    predict(r, hit.id, G.turn);
    touch(r, hit.id, G.turn);   /* 의도적으로 무효 — false 를 돌려준다 */
    G.lastMsg = "이 도마뱀의 발바닥은 <b>태어날 때 정해졌습니다.</b> 눌러도 변하지 않습니다.";
  }
  render();
}

/* ── 판정 화면 ── */
function renderVerdict() {
  var h = "";
  h += '<div class="ranktitle">용불용설 탭 결과</div>';
  if (meanSpanText(G.runs.lamarck)) h += '<p class="hint">' + meanSpanText(G.runs.lamarck) + "</p>";
  h += rankHtml(G.results.lamarck);
  h += '<div class="ranktitle">자연선택 탭 결과</div>';
  if (meanSpanText(G.runs.natural)) h += '<p class="hint">' + meanSpanText(G.runs.natural) + "</p>";
  h += rankHtml(G.results.natural);

  /* 소멸로 다시 시작한 탭이 있으면 «두 탭의 처음 무리가 다르다»고 밝힌다.
     기본은 두 탭이 같은 무리·같은 폭풍이지만, 재시작은 새 무리를 뽑기 때문이다. */
  var re = [];
  if (G.reseeded.lamarck) re.push("용불용설 탭 " + G.reseeded.lamarck + "회");
  if (G.reseeded.natural) re.push("자연선택 탭 " + G.reseeded.natural + "회");
  /* ★ 상시 경고 (P-검토 v5 A-2).
     이 화면은 두 탭의 순위를 위아래로 나란히 놓으므로 «탭끼리 마릿수 비교»를 부추긴다.
     그런데 실측(800회) 최종 마릿수는 용불용설 평균 21.5 · 자연선택 16.5 로 «구조적으로»
     용불용설이 많다. 그것은 가설의 옳고 그름이 아니라 우리가 정한 숫자가 만든 차이다
     (§5 금지 5 — 전멸률·마릿수는 판정 근거가 아니다).
     그래서 재시작이 있을 때만 띄우던 경고를 «항상» 띄운다. */
  var warn = '<p class="hint"><b>순위는 «같은 탭 안에서만» 겨루는 것입니다.</b>' +
    ' 두 탭의 마릿수를 곧바로 견주지 마세요 — 어느 탭에서 더 많이 늘어나는지는' +
    ' <b>우리가 정한 숫자가 정합니다.</b> 그것으로 어느 가설이 맞는지 판단할 수 없습니다.' +
    ' 점수 계산도 두 탭이 다릅니다 — 예측 적중 점수는 자연선택 탭에만 있습니다.';
  if (re.length) warn += ' 또한 무리가 사라져 다시 시작했습니다(' + re.join(" · ") +
    ') — <b>그 탭은 처음 무리가 다른 무리입니다.</b> 폭풍 일정은 두 탭이 같습니다.';
  warn += '</p>';
  $("finalRanks").innerHTML = h + warn;

  /* 판정표 수치는 VERDICT 한 곳에서만 온다 — 화면에 숫자를 직접 적지 않는다 */
  var put = function (id, v) { var el = $(id); if (el) el.textContent = v; };
  put("vZeroL", VERDICT.zeroVarLamarckEnd.toFixed(3));
  put("vZeroNDead", VERDICT.zeroVarNaturalDead.toFixed(1) + "%");
  put("vDeadL", VERDICT.deadLamarck.toFixed(1) + "%");
  put("vDeadN", VERDICT.deadNatural.toFixed(1) + "%");
  put("vZeroNMean", VERDICT.zeroVarNaturalMean.toFixed(3));
  put("vCardL", VERDICT.cardChangeLamarck.toFixed(0) + "%");
  put("vCardN", VERDICT.cardChangeNatural.toFixed(0) + "%");

  /* ★ 2026-08-23 수정 (P-검토 A-5).
     여기에 「용불용설 탭에서 ○○이 앞선 것은 «훈련을 많이 시켰기 때문»」이라고 적혀 있었다.
     거짓이다 — beginGen() 이 매 세대 조원 «전원»의 touchLeftBy 를 P.TOUCH_MAX 로 되돌리므로
     조작 횟수는 조원마다 똑같다. 게다가 그 문장은 학생이 마지막으로 읽는 자리에서
     「노력을 더 하면 형질이 더 생긴다」 = M7 을 그대로 강화한다.
     C28 이 이 자리를 지킨다. */
  var wn = G.results.natural[0];
  /* 이긴 까닭의 두 번째 갈래(예측 적중)는 «실제로 적중이 있을 때만» 말한다 —
     화면 문장을 손으로 단정하면 데이터와 어긋나는 날이 온다(X-4). */
  var wnWhy = wn.hit
    ? "<b>처음에 고른 도마뱀이 이미 그런 도마뱀이었고, 살아남을 개체를 잘 맞혔기 때문</b>"
    : "<b>처음에 고른 도마뱀이 이미 그런 도마뱀이었기 때문</b>";
  $("winReason").innerHTML =
    "이긴 까닭 — 조작 횟수는 <b>조원마다 똑같았습니다</b>(용불용설 세대당 " + P.TOUCH_MAX + "회 · 자연선택 세대당 1회). " +
    "<b>더 많이 노력해서 이긴 사람은 어느 탭에도 없습니다.</b> " +
    "용불용설 탭에서는 그 훈련이 발바닥을 실제로 넓혔고, 그 값이 자손에게 전달됐습니다. " +
    "자연선택 탭의 점수는 <b>마릿수 × 1점 + 예측 적중 × 3점</b>입니다. <b>" + esc(wn.name) + "</b>이(가) 앞선 것은 " + wnWhy + "입니다 — " +
    "예측은 관찰일 뿐, 그 탭에서는 아무리 눌러도 발바닥이 변하지 않았습니다. " +
    /* ★ 자연선택 탭을 «아무 일도 안 일어난 쪽»으로 두면 M5 를 깨는 알맹이가 빠진다(P-검토 2차 B-21).
       개체는 그대로인데 무리의 구성이 바뀌었다 — 그것이 진화다. */
    "<b>그렇다고 아무 일도 없었던 것은 아닙니다.</b> 개체 하나하나는 그대로인데 " +
    "<b>무리의 «구성»이 바뀌었습니다</b> — 넓은 발바닥을 가진 계보가 더 많이 남았습니다. " +
    "<b>같은 승부인데 이긴 이유가 다릅니다.</b>";
}

/* ── 「변이 없는 개체군」 재생 ── */
var replayData = null;
function buildReplay() {
  var sc = makeScenario(20260822, { sig0: 0, sigm: 0, mu0: 1.03 });
  var out = {};
  ["lamarck", "natural"].forEach(function (m) {
    var r = newRun(sc, m), hist = [{ gen: 0, mean: 1.03, dead: false }];
    while (r.gen < P.GENS && !r.extinct) {
      var t = policyPick(r, "median");
      if (t !== null) for (var i = 0; i < P.TOUCH_MAX; i++) touch(r, t, 0);
      storm(r); breed(r);
      var s = stats(r.pop);
      hist.push({ gen: r.gen, mean: s.mean, dead: r.extinct });
    }
    out[m] = hist;
  });
  return out;
}
function showReplayStatic() {
  if (!replayData) replayData = buildReplay();
  if (G.rafId) { cancelAnimationFrame(G.rafId); G.rafId = null; }
  G.replayT = 999; drawReplay();
}
function startReplay() {
  if (!replayData) replayData = buildReplay();
  G.replayT = 0;
  if (G.rafId) cancelAnimationFrame(G.rafId);
  loopReplay();
}
function loopReplay() {
  G.rafId = null; drawReplay(); G.replayT += 1 / 60;
  if (G.replayT < 16 && G.phase === "verdict" && !document.hidden)
    G.rafId = requestAnimationFrame(loopReplay);
}
function drawReplay() {
  var cv = $("replay"); if (!cv || !replayData) return;
  var f = fitCanvas(cv, 190), ctx = f.ctx, W = f.w, H = f.h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CSSV("--stage-light") || "#f7f9fb"; ctx.fillRect(0, 0, W, H);
  var padL = 46, padB = 26, padT = 16, loY = 0.98, hiY = 1.35;
  var X = function (g) { return padL + (W - padL - 14) * g / P.GENS; };
  var Y = function (v) { return padT + (H - padT - padB) * (1 - (v - loY) / (hiY - loY)); };
  ctx.strokeStyle = CSSV("--stage-line") || "#dbe3ea"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - 14, H - padB); ctx.stroke();
  ctx.fillStyle = CSSV("--t3") || "#94a3b8"; ctx.font = "10px sans-serif";
  ctx.textAlign = "right"; ctx.fillText("1.35", padL - 5, Y(1.35) + 3); ctx.fillText("1.03", padL - 5, Y(1.03) + 3);
  ctx.textAlign = "center"; ctx.fillText("세대", (padL + W) / 2, H - 8);
  var shown = Math.min(P.GENS, Math.max(1, Math.floor(G.replayT / 2)));
  [["lamarck", CSSV("--d-amber") || "#b45309", "용불용설"], ["natural", CSSV("--d-blue") || "#1d4ed8", "자연선택"]]
  .forEach(function (row, k) {
    var hist = replayData[row[0]];
    ctx.strokeStyle = row[1]; ctx.lineWidth = 2.4;
    ctx.setLineDash(k === 1 ? [6, 4] : []);
    ctx.beginPath();
    var drew = false, last = null;
    for (var i = 0; i < hist.length && hist[i].gen <= shown; i++) {
      var p = hist[i];
      /* ★ 소멸한 세대는 개체수가 0이라 mean 이 null 이다.
         예전에는 여기서 그냥 break 해서 «소멸했다»는 사실이 통째로 사라졌다
         — 라벨이 한 번도 안 그려졌다(2026-08-23 S-검토 A-1).
         선은 여기서 끝내되 «죽었다»는 표시는 반드시 남긴다. */
      if (p.mean === null) { if (p.dead && last) last.dead = true; break; }
      var xx = X(p.gen), yy = Y(Math.max(loY, Math.min(hiY, p.mean)));
      if (!drew) { ctx.moveTo(xx, yy); drew = true; } else ctx.lineTo(xx, yy);
      last = { x: xx, y: yy, dead: p.dead };
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (last) {
      ctx.fillStyle = row[1];
      if (last.dead) {                              /* 끝점에 ✕ — 색만으로 알리지 않는다 */
        ctx.lineWidth = 2.2; ctx.strokeStyle = row[1];
        ctx.beginPath();
        ctx.moveTo(last.x - 5, last.y - 5); ctx.lineTo(last.x + 5, last.y + 5);
        ctx.moveTo(last.x + 5, last.y - 5); ctx.lineTo(last.x - 5, last.y + 5);
        ctx.stroke();
      }
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(replayEndLabel(row[2], hist), Math.min(last.x + 8, W - 128), last.y - 8);
    }
  });
  /* 캔버스 글자는 낭독기가 못 읽는다. 같은 결론을 글로도 남긴다(C29 가 이 문장을 검사한다). */
  if ($("replayNote")) {
    $("replayNote").textContent =
      replayEndLabel("용불용설", replayData.lamarck) + " · " +
      replayEndLabel("자연선택", replayData.natural);
  }
}

/* ── 재생 그래프의 «끝점»을 읽는다 — 순수 함수. ──
   anolis_check.js C29 가 이 함수를 sim.js 에서 잘라내 그대로 실행하고
   모형이 낸 이력과 대조한다. 그리는 코드와 검사하는 코드가 «같은 함수»여야
   「그래프는 틀렸는데 검사는 통과」가 생기지 않는다(F-1). */
function replayEnd(hist) {
  var lastMean = null, lastGen = 0, dead = false, deadGen = null, i;
  for (i = 0; i < hist.length; i++) {
    if (hist[i].mean === null) {
      if (hist[i].dead) { dead = true; deadGen = hist[i].gen; }
      break;
    }
    lastMean = hist[i].mean; lastGen = hist[i].gen;
    if (hist[i].dead) { dead = true; deadGen = hist[i].gen; }
  }
  return { mean: lastMean, gen: lastGen, dead: dead, storm: dead ? deadGen + 1 : null };
}
function replayEndLabel(name, hist) {
  var e = replayEnd(hist);
  if (e.dead) return name + " — " + e.storm + "번째 폭풍에서 소멸";
  return name + " — " + (e.mean === null ? "?" : e.mean.toFixed(3));
}

/* ── 배선 ── */
function bind() {
  $("btnToSetup").addEventListener("click", toSetup);
  $("btnSetupBack").addEventListener("click", function () { if (G.phase === "setup") setPhase("idle"); });
  $("btnToRules").addEventListener("click", toRules);
  $("btnRulesBack").addEventListener("click", function () { if (G.phase === "rules") { renderSetup(); setPhase("setup"); } });
  $("btnToPick").addEventListener("click", toPick);
  $("btnTurnDone").addEventListener("click", turnDone);
  $("btnStorm").addEventListener("click", callStorm);
  $("btnFace").addEventListener("click", faceStorm);
  $("btnBreed").addEventListener("click", doBreed);
  $("btnNextGen").addEventListener("click", nextGen);
  $("btnEnvNext").addEventListener("click", envNext);
  $("btnRestart").addEventListener("click", restartTab);
  $("btnOtherTab").addEventListener("click", function () { switchTab(G.tab === "lamarck" ? "natural" : "lamarck"); });
  $("btnVerdict").addEventListener("click", openVerdict);
  $("btnFromStart").addEventListener("click", restartAll);
  $("btnReplay").addEventListener("click", startReplay);
  $("tabL").addEventListener("click", function () { switchTab("lamarck"); });
  $("tabN").addEventListener("click", function () { switchTab("natural"); });
  $("stage").addEventListener("click", onStageClick);
  $("cntRow").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".cntbtn") : null;
    if (!b || G.phase !== "setup") return;
    G.count = parseInt(b.getAttribute("data-n"), 10);
    renderSetup();
  });
  window.addEventListener("resize", function () { drawStage(); drawDist(); if (G.phase === "verdict") drawReplay(); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (G.rafId) { cancelAnimationFrame(G.rafId); G.rafId = null; } }
    else if (!G.rafId && G.phase === "verdict" && G.replayT < 16) G.rafId = requestAnimationFrame(loopReplay);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { bind(); render(); });
else { bind(); render(); }

})();
