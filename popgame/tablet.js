/* ============================================================
   popgame/tablet.js — 「개체군 생존 게임」 학생 태블릿 화면 (교실 모드 전용)
   
   ★ 생성물이다. popgame_tablet.part.js 를 고치고 build_sim.js 를 다시 돌린다.
     생존 판정은 서버가 아니라 이 파일이 «코어로» 직접 한다 — 모형이 두 벌이 되지 않게(F-1).
   ============================================================ */
(function () {
  "use strict";

/* ==== CORE-BEGIN ==== 여기부터 CORE-END 까지가 sim.js 에 그대로 복사된다 (C12) ==== */

/* ── 재사용 블록 — §2-C. 다른 단원에서 재사용할 때 여기«만» 바꾼다 (F-1 단일 원천) ── */
const CONFIG = {
  unit: "Ⅰ-1 5차시",
  trait: { name: "털 두께", short: "두께" },
  cards: [
    { key: "cold",  name: "한파",       lo: 4, hi: 19 },
    { key: "warm",  name: "온난화",     lo: 1, hi:  7 }
  ],
  // 3라운드는 교사가 그 자리에서 고른다(§1 확정 7). 두 벌을 다 준비한다.
  finalCards: [
    { key: "pred_thick", name: "새 포식자 — 두꺼운 털이 눈에 띈다", lo: 7, hi: 19 },
    { key: "pred_thin",  name: "새 포식자 — 얇은 털이 눈에 띈다",   lo: 1, hi:  6 }
  ]
};

/* ── 개체군 규격 ── */
const POP = {
  N: 20,        // 개체 수
  /* ★ v3.1 — 총합을 «고정»에서 «하한»으로 바꿨다(사용자 확정 2026-08-24).
     딱 맞추는 번거로움을 없애되, 하한이 없으면 겹침 구간(4~7mm)에 전원을 몰아넣은
     조가 2라운드를 무사 통과해 「다 똑같이 맞추면 위험하다」가 정확히 뒤집힌다(실측).
     겹침 몰빵의 총합은 최대 7×20 = 140 이므로 하한 150 이 그것을 구조적으로 막는다. */
  SUM_MIN: 150, // 형질값 총합 «하한»
  SUM: 200,     // 권장 총합 — 자동 채우기·안내에만 쓴다
  T_MIN: 1,
  T_MAX: 19,
  ROUNDS: 3     // ★ v5 §5 금지 8 과 동형: 바꾸면 C5·C7·§8-2 시간 예산이 전부 무효
};

/* ── 배분 검증 — 제출 버튼이 이 함수 하나만 부른다(C3′) ── */
function validateAllocation(alloc) {
  if (!Array.isArray(alloc)) return { ok: false, reason: "배분이 배열이 아니다" };
  if (alloc.length !== POP.N) return { ok: false, reason: "개체 수가 " + POP.N + "이 아니다: " + alloc.length };
  let s = 0;
  for (let i = 0; i < alloc.length; i++) {
    const t = alloc[i];
    if (!Number.isInteger(t)) return { ok: false, reason: (i + 1) + "번째 값이 정수가 아니다: " + t };
    if (t < POP.T_MIN || t > POP.T_MAX) return { ok: false, reason: (i + 1) + "번째 값이 범위 밖이다: " + t };
    s += t;
  }
  if (s < POP.SUM_MIN) return { ok: false, reason: "두께 총합이 " + POP.SUM_MIN + " 미만이다: " + s, sum: s };
  return { ok: true, sum: s };
}

/* 하한까지 얼마나 모자란가 — 0 이하면 충족 */
function remaining(alloc) {
  let s = 0;
  for (let i = 0; i < alloc.length; i++) s += (alloc[i] | 0);
  return POP.SUM_MIN - s;
}

/* ── 개체 생성 ──
   개체 = { id, t, gen, parentId }
   id 는 조(team) 안에서 1부터 오름차순으로 «한 번만» 부여되고 재사용되지 않는다. */
function makePopulation(alloc) {
  const v = validateAllocation(alloc);
  if (!v.ok) throw new Error("makePopulation: " + v.reason);
  const pop = [];
  for (let i = 0; i < alloc.length; i++) {
    pop.push({ id: i + 1, t: alloc[i], gen: 0, parentId: null });
  }
  return sortByTrait(pop);
}

/* 값 오름차순 정렬 — 학생이 배분표 칸에 적은 «순서»가 결과에 영향을 주지 않게 한다(§4-3).
   같은 값이면 id 오름차순으로 안정 정렬한다(결정론). */
function sortByTrait(pop) {
  return pop.slice().sort(function (a, b) {
    return a.t !== b.t ? a.t - b.t : a.id - b.id;
  });
}

/* ── 카드 판정 — 구간 안이면 산다. 난수를 쓰지 않는다 ── */
function survivesCard(t, card) {
  return t >= card.lo && t <= card.hi;
}

/* 한 라운드. 반환은 새 객체만 쓴다(입력 개체군을 변형하지 않는다). */
function applyCard(pop, card, nextId) {
  const survivors = [], dead = [];
  for (let i = 0; i < pop.length; i++) {
    (survivesCard(pop[i].t, card) ? survivors : dead).push(pop[i]);
  }
  // 번식 — 생존자 1마리당 자손 1마리. 값은 부모 값 그대로. 부모 세대는 여기서 끝난다.
  const children = [];
  let id = nextId;
  for (let i = 0; i < survivors.length; i++) {
    children.push({ id: id++, t: survivors[i].t, gen: survivors[i].gen + 1, parentId: survivors[i].id });
  }
  return {
    survivors: survivors,      // 이 카드를 넘긴 «부모» 개체들
    dead: dead,                // 이 카드에서 죽은 개체들
    next: sortByTrait(children), // 다음 라운드 개체군
    nextId: id
  };
}

/* 전체 진행. cards 는 길이 POP.ROUNDS 의 카드 배열(3번째는 교사가 고른 것).
   반환: 라운드별 기록 + 계보. 화면·검사가 이 하나만 부른다. */
function play(alloc, cards) {
  if (cards.length !== POP.ROUNDS) throw new Error("play: 카드 수가 " + POP.ROUNDS + "이 아니다: " + cards.length);
  let pop = makePopulation(alloc);
  let nextId = POP.N + 1;
  const all = [pop.slice()];           // 세대별 개체군 (0세대 포함)
  const rounds = [];
  const graves = [];                   // 죽은 개체 전부 — 추적기가 «마지막 값 동결»에 쓴다

  for (let r = 0; r < cards.length; r++) {
    if (pop.length === 0) break;       // 전멸 후에는 더 진행하지 않는다
    const res = applyCard(pop, cards[r], nextId);
    for (let i = 0; i < res.dead.length; i++) {
      graves.push({ id: res.dead[i].id, t: res.dead[i].t, diedRound: r + 1 });
    }
    rounds.push({
      round: r + 1,
      card: cards[r],
      before: pop.length,
      alive: res.survivors.length,
      wiped: res.survivors.length === 0,
      stats: stats(res.next)
    });
    nextId = res.nextId;
    pop = res.next;
    all.push(pop.slice());
  }
  return { rounds: rounds, generations: all, graves: graves, wiped: pop.length === 0, finalCount: pop.length };
}

/* ── 통계 — 화면의 «폭» 수치가 이 함수에서만 나온다(§5 금지 16) ── */
function stats(pop) {
  const n = pop.length;
  if (n === 0) return { n: 0, mean: null, sd: null };
  let s = 0;
  for (let i = 0; i < n; i++) s += pop[i].t;
  const mean = s / n;
  let q = 0;
  for (let i = 0; i < n; i++) q += (pop[i].t - mean) * (pop[i].t - mean);
  return { n: n, mean: mean, sd: Math.sqrt(q / n) };
}

/* 히스토그램 — 반박 장치 ① (배분 중 실시간). 값 t 별 개체 수. */
function histogram(pop) {
  const h = [];
  for (let t = POP.T_MIN; t <= POP.T_MAX; t++) h.push(0);
  for (let i = 0; i < pop.length; i++) h[pop[i].t - POP.T_MIN]++;
  return h;
}
/* 배분 배열(개체 객체가 아직 없는 입력 중)에서도 같은 그림을 낸다 */
function histogramOfAlloc(alloc) {
  const h = [];
  for (let t = POP.T_MIN; t <= POP.T_MAX; t++) h.push(0);
  for (let i = 0; i < alloc.length; i++) {
    const t = alloc[i] | 0;
    if (t >= POP.T_MIN && t <= POP.T_MAX) h[t - POP.T_MIN]++;
  }
  return h;
}
function sdOfAlloc(alloc) {
  const n = alloc.length;
  if (!n) return null;
  let s = 0;
  for (let i = 0; i < n; i++) s += alloc[i];
  const m = s / n;
  let q = 0;
  for (let i = 0; i < n; i++) q += (alloc[i] - m) * (alloc[i] - m);
  return Math.sqrt(q / n);
}

/* ── 개체 추적기 — 반박 장치 ③ (§4-3 개체 식별 규약) ──
   한 개체를 클릭하면 그 «계보»의 값을 세대순으로 돌려준다.
   ★ 추적 개체가 죽으면 마지막 값에서 «동결»되고 다른 개체 값으로 대체되지 않는다(C8). */
function lineage(result, id) {
  // 클릭한 개체가 속한 세대를 찾고, 거기서부터 자손을 따라 내려간다.
  const chain = [];
  let cur = null, curGen = -1;
  for (let g = 0; g < result.generations.length; g++) {
    const found = result.generations[g].filter(function (o) { return o.id === id; })[0];
    if (found) { cur = found; curGen = g; break; }
  }
  if (!cur) return null;
  chain.push({ gen: curGen, id: cur.id, t: cur.t, alive: true });
  // 자손 추적
  for (let g = curGen + 1; g < result.generations.length; g++) {
    const child = result.generations[g].filter(function (o) { return o.parentId === cur.id; })[0];
    if (!child) break;
    chain.push({ gen: g, id: child.id, t: child.t, alive: true });
    cur = child;
  }
  // 마지막 개체가 죽었는지 — 죽었으면 그 사실과 «마지막 값»을 붙인다. 값은 바뀌지 않는다.
  const grave = result.graves.filter(function (o) { return o.id === cur.id; })[0];
  const died = grave ? grave.diedRound : null;
  return { chain: chain, diedRound: died, lastValue: cur.t, changed: chain.some(function (o) { return o.t !== chain[0].t; }) };
}


/* ── v3 신설: 두께별 마릿수 표 ↔ 형질값 배열 (설계지시안 v3 §3) ──
   표는 19칸(두께 1~19)의 «마릿수»다. 코어는 늘 20칸 «형질값» 배열로 다룬다. */
function allocFromCounts(counts) {
  const out = [];
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i] | 0;
    for (let k = 0; k < n; k++) out.push(POP.T_MIN + i);
  }
  return out;
}
function countsFromAlloc(alloc) {
  const c = [];
  for (let t = POP.T_MIN; t <= POP.T_MAX; t++) c.push(0);
  for (let i = 0; i < alloc.length; i++) {
    const t = alloc[i] | 0;
    if (t >= POP.T_MIN && t <= POP.T_MAX) c[t - POP.T_MIN]++;
  }
  return c;
}
/* 표 단계의 두 합계 — 화면이 손으로 더하지 않는다 */
function countsTotals(counts) {
  let n = 0, sum = 0;
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i] | 0;
    n += c; sum += c * (POP.T_MIN + i);
  }
  return {
    animals: n, thickness: sum,
    okAnimals: n === POP.N,
    okThickness: sum >= POP.SUM_MIN,
    needThickness: Math.max(0, POP.SUM_MIN - sum),
    restAnimals: Math.max(0, POP.N - n)
  };
}

/* ── v3.1 신설: 자동 채우기 ──
   남은 마릿수를 «하한을 넘기는 데 필요한 최소 두께»로 채운다.
   이미 하한을 넘겼으면 중립값(권장 총합의 평균)으로 채운다.
   반환은 새 counts 배열이고, 채울 수 없으면 null 을 준다(화면이 안내를 낸다). */
function autoFill(counts) {
  const T = countsTotals(counts);
  const rest = T.restAnimals;
  if (rest <= 0) return null;                       // 이미 20마리
  const mid = Math.round(POP.SUM / POP.N);          // 중립값 10
  let per;
  if (T.needThickness > 0) {
    per = Math.ceil(T.needThickness / rest);
    if (per > POP.T_MAX) return null;               // 남은 마릿수로는 하한을 못 넘긴다
    per = Math.max(POP.T_MIN, Math.min(POP.T_MAX, per));
  } else {
    per = mid;
  }
  const out = counts.slice();
  out[per - POP.T_MIN] = (out[per - POP.T_MIN] | 0) + rest;
  return out;
}

/* ── v3 신설: 조별 색 (설계지시안 v3 §4-1) ──
   ★ hue 만 조마다 다르고 «두께 → 명도» 변환은 전 조가 «동일»하다.
     사용자 요구: 조별로 색은 달라도 «진해지는 정도»는 같아야 한다. */
const TEAM_HUES = [0, 220, 140, 275, 30, 190, 320, 95];   // 1~8조
/* 명도 폭은 전 조 공통. 상한을 66%로 둔다 — 78%에서는 얇은 개체가 흰 배경에 묻혔다(육안 실측). */
const L_LIGHT = 66, L_DARK = 26, SAT = 68;
function teamHue(teamIndex) { return TEAM_HUES[teamIndex % TEAM_HUES.length]; }
function lightnessFor(t) {
  const f = (t - POP.T_MIN) / (POP.T_MAX - POP.T_MIN);
  return L_LIGHT - f * (L_LIGHT - L_DARK);
}
function dotColor(teamIndex, t) {
  return "hsl(" + teamHue(teamIndex) + "," + SAT + "%," + lightnessFor(t).toFixed(1) + "%)";
}
/* ★ 두 번째 채널 — 색 농도 단독은 색각 이상에서 못 읽는다(매뉴얼 P6). 반지름을 함께 쓴다. */
const R_MIN = 4, R_MAX = 10;
function dotRadius(t) {
  const f = (t - POP.T_MIN) / (POP.T_MAX - POP.T_MIN);
  return R_MIN + f * (R_MAX - R_MIN);
}

/* ── v3 신설: 원형 배치의 «자리» (설계지시안 v3 §4-3) ──
   ★ 자리를 id 의 함수로 둔다. 개체가 죽어도 살아남은 개체는 «자기 자리»에 그대로 있다.
     재배치가 일어나면 그 자리의 값이 바뀐 것처럼 보여 M5 를 재이식한다(P-검토 A-4). */
const GOLDEN_ANGLE = 137.508;
function seatOf(id, capacity) {
  const n = capacity || POP.N;
  const idx = (id - 1) % n;
  return {
    angleDeg: (id * GOLDEN_ANGLE) % 360,
    radiusRatio: Math.sqrt((idx + 0.5) / n)
  };
}

/* ── 국면 (§7) ── */
const PHASES = ["idle", "setup", "rules", "design", "allSubmitted",
  "cardPick", "cardReveal", "judge", "roundResult", "trace", "ended"];

/* ★ 카드 가시성 단일 원천 — 화면 코드는 조건을 다시 쓰지 않는다(§5 금지 18 · C15).
   design 에서는 «어느 라운드든» 카드가 보이지 않는다(확정 11 철회). */
function cardVisible(phase) {
  return phase === "cardReveal" || phase === "judge" || phase === "roundResult" ||
    phase === "trace" || phase === "ended";
}
/* ★ 타 조 배분 가시성 단일 원천 (§5 금지 21 · C16) */
function peerVisible(phase) {
  return phase !== "idle" && phase !== "setup" && phase !== "rules" && phase !== "design";
}

/* ── 시간 예산 (§8-2) — 화면 코드에 다시 타이핑하지 않는다(F-1) ──
   운영 (B): 종이에 동시 설계 → 기기에는 옮겨 적기만.
   ⚠ 아래 상수는 «추정»이다. 교실 실측이 나오면 이 블록만 고친다. */
const FIXED_COST_SECONDS = 180;   // 기기 준비 60 + 규칙·비유 대응표 설명 120
const PAPER_DESIGN_SECONDS = 180; // 종이 동시 설계 (조 수와 무관 — 동시에 한다)
const TRANSCRIBE_SECONDS = 40;    // 조당 옮겨 적기
const PREDICT_SECONDS = 20;       // 조당 예측 입력 (반박 장치 ②)
const CARD_REVEAL_SECONDS = 20;   // 라운드당 카드 공개
const JUDGE_PER_TEAM_SECONDS = 8; // 조당 판정 연출
const RESULT_VIEW_SECONDS = 30;   // 라운드당 결과 확인
const TRACE_SECONDS = 30;         // 조당 개체 추적 (반박 장치 ③) — 1회만
const WRAPUP_SECONDS = 300;       // 마무리 발문·판서

function budgetFor(k, rounds) {
  return FIXED_COST_SECONDS + PAPER_DESIGN_SECONDS
    + (TRANSCRIBE_SECONDS + PREDICT_SECONDS) * k
    + rounds * (CARD_REVEAL_SECONDS + JUDGE_PER_TEAM_SECONDS * k + RESULT_VIEW_SECONDS)
    + TRACE_SECONDS * k
    + WRAPUP_SECONDS;
}
function budgetSeconds(k) { return budgetFor(k, POP.ROUNDS); }

const TEAMS = { min: 2, max: 8 };

/* ==== CORE-END ==== */

/* ============================================================
   태블릿 화면 — 교실 모드 전용
   PIN 을 넣으면 서버(SSE)가 그 조의 상태를 밀어 준다.
   ★ 이 파일은 교실 모드에서만 쓰인다. 정적 배포본의 단독 경로에는 들어가지 않는다.
   ============================================================ */
var $ = function (id) { return document.getElementById(id); };
var ST = { view: null, teamIndex: 0, traceId: null };

var TOK = null;
function tok() {
  if (TOK) return TOK;
  var cs = getComputedStyle(document.documentElement);
  var g = function (n, fb) { var v = cs.getPropertyValue(n); return (v && v.trim()) || fb; };
  TOK = { line: g("--line", "#e3e6ea"), gray: g("--d-gray", "#5f6b7a"),
    violet: g("--d-violet", "#6d28d9"), t3: g("--t3", "#5b636b") };
  return TOK;
}


/* ── 사망 연출 자산 (Codex 산출 · 교사 화면과 «같은» 함수) ── */
function deadClamp01(v) {
  v = Number(v);
  return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}

function deadHslParts(css) {
  var m = String(css || "").match(
    /hsla?\(\s*([-+]?\d*\.?\d+)(?:deg)?\s*,\s*([-+]?\d*\.?\d+)%\s*,\s*([-+]?\d*\.?\d+)%/i
  );
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : null;
}

function deadTokenLightness(css) {
  var s = String(css || "").trim();
  var hsl = deadHslParts(s);
  if (hsl) return deadClamp01(hsl.l / 100) * 100;

  var hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  var r, g, b;
  if (hex) {
    var h = hex[1];
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) +
      h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    var rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!rgb) return null;
    r = Math.max(0, Math.min(255, +rgb[1]));
    g = Math.max(0, Math.min(255, +rgb[2]));
    b = Math.max(0, Math.min(255, +rgb[3]));
  }
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 510) * 100;
}

function deadEaseOutCubic(u) {
  u = deadClamp01(u);
  return 1 - Math.pow(1 - u, 3);
}

function deadEaseInOutCubic(u) {
  u = deadClamp01(u);
  return u < 0.5
    ? 4 * u * u * u
    : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function deadEaseOutQuad(u) {
  u = deadClamp01(u);
  return 1 - (1 - u) * (1 - u);
}

function drawDeadDot(g, x, y, rad, teamIndex, t, p) {
  var TOTAL = 820;
  var ms = deadClamp01(p) * TOTAL;
  var base = dotColor(teamIndex, t);
  var hsl = deadHslParts(base);
  var gray = tok().gray;

  // tok() 자체가 캐시되므로, 여기서는 토큰 문자열이 바뀔 때만 명도를 다시 계산한다.
  if (drawDeadDot._grayToken !== gray) {
    drawDeadDot._grayToken = gray;
    drawDeadDot._grayL = deadTokenLightness(gray);
  }

  var fillStyle = base;
  var fillAlpha = 1;
  var outlineAlpha = 0.45;
  var crossAlpha = 0;
  var crossLength = 0;

  if (ms <= 460) {
    var e1 = deadEaseOutCubic(ms / 460);
    if (hsl) {
      // 토큰을 해석하지 못하면 새 회색을 발명하지 않고 원래 명도에서 채도만 뺀다.
      var grayL = drawDeadDot._grayL === null ? hsl.l : drawDeadDot._grayL;
      var s = hsl.s * (1 - e1);
      var l = hsl.l + (grayL - hsl.l) * e1;
      fillStyle = "hsl(" + hsl.h.toFixed(2) + "," +
        s.toFixed(2) + "%," + l.toFixed(2) + "%)";
    }
    outlineAlpha = 0.45 + 0.15 * e1;
  } else if (ms <= 700) {
    var e2 = deadEaseInOutCubic((ms - 460) / 240);
    if (hsl) {
      var settledL = drawDeadDot._grayL === null ? hsl.l : drawDeadDot._grayL;
      fillStyle = "hsl(" + hsl.h.toFixed(2) + ",0%," + settledL.toFixed(2) + "%)";
    }
    fillAlpha = 1 - e2;
    outlineAlpha = 0.60 + 0.28 * e2;
    crossAlpha = 0.88 * e2;
    crossLength = e2;
  } else {
    var e3 = deadEaseOutQuad((ms - 700) / 120);
    fillAlpha = 0;
    outlineAlpha = 0.88 + 0.12 * e3;
    crossAlpha = 0.88 + 0.12 * e3;
    crossLength = 1;
  }

  var line = Math.max(0.85, Math.min(1.4, rad * 0.20));
  var arm = rad * 0.62 * crossLength;

  g.save();
  if (fillAlpha > 0.001) {
    g.globalAlpha = fillAlpha;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = fillStyle;
    g.fill();
  }

  g.globalAlpha = outlineAlpha;
  g.beginPath();
  g.arc(x, y, rad, 0, Math.PI * 2);
  g.strokeStyle = gray;
  g.lineWidth = line;
  g.stroke();

  if (crossAlpha > 0.001 && arm > 0) {
    g.globalAlpha = crossAlpha;
    g.beginPath();
    g.moveTo(x - arm, y - arm);
    g.lineTo(x + arm, y + arm);
    g.moveTo(x + arm, y - arm);
    g.lineTo(x - arm, y + arm);
    g.strokeStyle = gray;
    g.lineWidth = line;
    g.lineCap = "round";
    g.stroke();
  }
  g.restore();
}

var DEAD_ANIM_MS = 820;
var DEAD_FX = {
  raf: 0,
  activeKey: null,
  startedAt: 0,
  pByKey: Object.create(null),
  redraw: null
};

var DEAD_MQ = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

function deathKey(teamIndex, roundIndex) {
  return String(teamIndex) + ":" + String(roundIndex);
}

function deadProgress(key) {
  var p = DEAD_FX.pByKey[key];
  return p === undefined ? 1 : deadClamp01(p);
}

function finishActiveDeadAnimation() {
  if (DEAD_FX.raf) window.cancelAnimationFrame(DEAD_FX.raf);
  DEAD_FX.raf = 0;
  if (DEAD_FX.activeKey !== null) DEAD_FX.pByKey[DEAD_FX.activeKey] = 1;
  var redraw = DEAD_FX.redraw;
  DEAD_FX.activeKey = null;
  DEAD_FX.redraw = null;
  if (redraw) redraw();
}

function startDeadAnimation(key, redraw) {
  // 다음 조를 즉시 눌러도 이전 시각 상태만 끝 프레임으로 보낸다.
  finishActiveDeadAnimation();
  DEAD_FX.pByKey[key] = 1;

  // 동작 축소에서는 중간 프레임을 만들지 않고 최종 상태를 정확히 한 번 그린다.
  if (DEAD_MQ.matches) {
    redraw();
    return;
  }

  DEAD_FX.activeKey = key;
  DEAD_FX.redraw = redraw;
  DEAD_FX.pByKey[key] = 0;
  DEAD_FX.startedAt = performance.now();

  function frame(now) {
    // 실행 도중 사용자가 동작 축소를 켠 경우에도 즉시 끝 프레임으로 간다.
    if (DEAD_MQ.matches) {
      finishActiveDeadAnimation();
      return;
    }
    var p = deadClamp01((now - DEAD_FX.startedAt) / DEAD_ANIM_MS);
    DEAD_FX.pByKey[key] = p;
    redraw();
    if (p < 1 && DEAD_FX.activeKey === key) {
      DEAD_FX.raf = window.requestAnimationFrame(frame);
    } else {
      DEAD_FX.raf = 0;
      DEAD_FX.activeKey = null;
      DEAD_FX.redraw = null;
    }
  }

  DEAD_FX.raf = window.requestAnimationFrame(frame);
}

function onDeadMotionPreferenceChange() {
  if (DEAD_MQ.matches) finishActiveDeadAnimation();
}
if (DEAD_MQ.addEventListener) {
  DEAD_MQ.addEventListener("change", onDeadMotionPreferenceChange);
} else if (DEAD_MQ.addListener) {
  DEAD_MQ.addListener(onDeadMotionPreferenceChange);
}


/* 원형 무대 — 교사 화면과 «같은 자리 규칙»을 쓴다(seatOf) */
function draw() {
  var cv = $("tabCanvas");
  if (!cv) return;
  var W = Math.max(220, cv.getBoundingClientRect().width || 320);
  var H = Math.min(W, 460);
  var D = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * D); cv.height = Math.round(H * D); cv.style.height = H + "px";
  var g = cv.getContext("2d"); g.setTransform(D, 0, 0, D, 0, 0); g.clearRect(0, 0, W, H);

  var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  g.strokeStyle = tok().line; g.lineWidth = 2; g.stroke();

  var v = ST.view;
  if (!v || !v.alloc) {
    g.fillStyle = tok().t3; g.font = "13px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("아직 배분이 제출되지 않았습니다", cx, cy);
    return;
  }
  var alive = v.alive || [];
  var dead = v.dead || [];
  var put = function (o, isDead) {
    var seat = seatOf(o.id, POP.N);
    var a = seat.angleDeg * Math.PI / 180;
    var rr = seat.radiusRatio * (R - 14);
    var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    var rad = dotRadius(o.t);
    if (isDead) {
      /* 사망 라운드별 키 — 여러 라운드의 사망자가 누적되므로 자기 라운드의 진행률을 넘긴다 */
      var dk = deathKey(v.teamIndex, (o.diedRound || 1) - 1);
      drawDeadDot(g, x, y, rad, v.teamIndex, o.t, deadProgress(dk));
      return;
    }
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = dotColor(v.teamIndex, o.t); g.fill();
    g.strokeStyle = "rgba(0,0,0,.38)"; g.lineWidth = 1.2; g.stroke();
  };
  dead.forEach(function (o) { put(o, true); });
  alive.forEach(function (o) { put(o, false); });
  if (!alive.length) {
    g.fillStyle = tok().gray; g.font = "bold 16px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("우리 무리는 전멸했습니다", cx, cy);
  }
}

/* 서버가 보내는 것은 «배분»과 «카드»뿐이다 — 생존 판정은 태블릿이 코어로 직접 한다.
   그래야 서버가 모형을 두 벌 갖지 않는다(F-1). */
function computeView(raw) {
  var v = { teamIndex: raw.teamIndex, teamName: raw.teamName, alloc: raw.alloc,
    phase: raw.phase, round: raw.round, card: raw.card, alive: [], dead: [], history: [] };
  if (!raw.alloc) return v;
  var pop = makePopulation(raw.alloc);
  var nextId = POP.N + 1;
  var cards = raw.cardsSoFar || [];
  for (var r = 0; r < cards.length; r++) {
    var res = applyCard(pop, cards[r], nextId);
    v.history.push({ round: r + 1, card: cards[r], alive: res.survivors.length });
    res.dead.forEach(function (o) { v.dead.push({ id: o.id, t: o.t, diedRound: r + 1 }); });
    nextId = res.nextId; pop = res.next;
    if (!pop.length) break;
  }
  v.alive = pop;
  return v;
}

function render() {
  var v = ST.view;
  $("tabTeam").textContent = v && v.teamName ? v.teamName : "—";
  $("tabPhase").textContent = phaseText(v);
  var card = v && v.card;
  var cm = $("tabCard");
  while (cm.firstChild) cm.removeChild(cm.firstChild);
  if (card && v.phase !== "design") {
    var box = document.createElement("div"); box.className = "tab-card";
    var k = document.createElement("p"); k.className = "tab-card-kicker"; k.textContent = "환경 변화"; box.appendChild(k);
    var n = document.createElement("p"); n.className = "tab-card-name"; n.textContent = card.name; box.appendChild(n);
    var g2 = document.createElement("p"); g2.className = "tab-card-range";
    g2.textContent = "살아남는 " + CONFIG.trait.short + ": " + card.lo + " 이상 " + card.hi + " 이하";
    box.appendChild(g2);
    cm.appendChild(box);
  }
  $("tabCount").textContent = v && v.alloc ? (v.alive.length + " / " + POP.N + " 마리") : "—";
  var hb = $("tabHistory");
  while (hb.firstChild) hb.removeChild(hb.firstChild);
  (v && v.history || []).forEach(function (h) {
    var tr = document.createElement("tr"); tr.className = "history-row";
    [String(h.round), h.card.name, h.alive === 0 ? "전멸" : h.alive + "마리"].forEach(function (x) {
      var td = document.createElement("td"); td.className = "history-cell"; td.textContent = x; tr.appendChild(td);
    });
    hb.appendChild(tr);
  });
  draw();
}
function phaseText(v) {
  if (!v) return "연결을 기다립니다";
  return {
    idle: "곧 시작합니다", setup: "조 수를 정하는 중", rules: "규칙 확인 중",
    design: "배분을 입력하는 중 — 환경은 아직 비밀입니다",
    allSubmitted: "전 조 제출 완료", cardPick: "선생님이 다음 환경을 뽑는 중",
    cardReveal: "환경 공개", judge: "판정 중", roundResult: "결과",
    trace: "개체 추적", ended: "마무리"
  }[v.phase] || v.phase;
}

/* ── SSE 연결 ── */
var es = null;
function connect(pin) {
  if (es) { es.close(); es = null; }
  $("tabStatus").textContent = "연결 중…";
  es = new EventSource("/api/state?pin=" + encodeURIComponent(pin));
  es.addEventListener("state", function (ev) {
    var raw = JSON.parse(ev.data);
    var prev = ST.view;
    ST.view = computeView(raw);
    $("tabStatus").textContent = "연결됨";
    $("pinPane").style.display = "none";
    $("gamePane").style.display = "";
    /* 이번 판정으로 «새로» 죽은 개체가 생겼을 때만 연출을 시작한다 */
    var grew = prev && ST.view && ST.view.dead.length > prev.dead.length;
    render();
    if (grew) startDeadAnimation(deathKey(ST.view.teamIndex, ST.view.round), render);
  });
  es.onerror = function () {
    $("tabStatus").textContent = "연결이 끊겼습니다 — 다시 시도합니다";
  };
}

function init() {
  $("pinForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pin = ($("pinInput").value || "").trim();
    if (!/^\d{4}$/.test(pin)) { $("pinError").textContent = "네 자리 숫자를 넣으세요"; return; }
    $("pinError").textContent = "";
    connect(pin);
  });
  window.addEventListener("resize", draw);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
