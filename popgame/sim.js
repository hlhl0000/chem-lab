/* ============================================================
   popgame/sim.js — 「개체군 생존 게임」 교사 화면
   
   ★ 이 파일은 생성물이다. 직접 고치지 말 것.
     계산부 = 검증스크립트/popgame_core.js 의 CORE-BEGIN~CORE-END 를 그대로 복사한 것이고,
     UI = 검증스크립트/_설계보정_popgame_20260824/popgame_ui.part.js 다.
     popgame_check.js C12 가 계산부의 문자 단위 동일을 검사한다.
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
   popgame UI — 화면부
   ★ sim.js 는 생성물이다. 이 파일을 고치고 build_sim.js 를 다시 돌린다.

   설계 근거: 설계지시안 v2 (개체군 생존 게임) · Codex 디자인 산출물 §1~§5
   ★ 규율 — 화면은 모형 수치를 «손으로» 적지 않는다(§5 금지 16).
     구간·개수·문구는 전부 CONFIG·POP 에서 읽고, 계산은 코어 함수만 부른다.
   ★ 가시성은 renderPhase() 첫머리에서 cardVisible()·peerVisible() 를 각각 «한 번»만 부른다.
     거짓이면 카드 자료가 그리기 함수의 인자·클로저·전역 상태에 들어가지 않는다(C15).
   ============================================================ */

var $ = function (id) { return document.getElementById(id); };
var el = function (tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
};

/* ── 상태 ── */
var S = {
  phase: "idle",
  teamCount: 0,
  teams: [],          // {name, alloc, pred, pop, nextId, generations, graves, rounds, wiped}
  turnPos: 0,         // design 국면에서 입력 중인 조
  viewTeamIndex: 0,   // judge·roundResult·trace·ended 에서 보고 있는 조
  round: 0,           // 0-based
  cards: [],          // 확정된 라운드 카드 (3라운드는 교사 선택 뒤에 들어온다)
  counts: [],         // 현재 조가 입력 중인 «두께별 마릿수» 19칸 (v3)
  traceId: null
};

function emptyCounts() {
  var c = [];
  for (var t = POP.T_MIN; t <= POP.T_MAX; t++) c.push(0);
  return c;
}

function newTeam(i) {
  return {
    name: (i + 1) + "조", alloc: null, pred: null,
    pop: null, nextId: POP.N + 1, generations: [], graves: [], rounds: [], wiped: false
  };
}
/* lineage() 가 요구하는 형태로 감싼다 */
function traceResultOf(team) { return { generations: team.generations, graves: team.graves }; }

/* ── 국면 이동 ── */
function setPhase(p) {
  if (PHASES.indexOf(p) < 0) throw new Error("알 수 없는 국면: " + p);
  S.phase = p;
  renderPhase(p);
}

/* ============================================================
   renderPhase — 표시 여부의 «유일한» 진입점 (Codex §4-1)
   ============================================================ */
function renderPhase(phase) {
  var allowCard = cardVisible(phase);
  var allowPeer = peerVisible(phase);

  show("setupPane", phase === "setup");
  show("rulesPane", phase === "rules");
  show("designPane", phase === "design");
  show("publicWaitPane", phase === "allSubmitted" || phase === "cardPick");
  show("singleResultPane", phase === "roundResult" || phase === "trace" || phase === "ended");
  show("tracePane", phase === "trace");
  show("historyCard", phase === "roundResult" || phase === "trace" || phase === "ended");
  var ctrl = document.querySelector(".control-card");
  if (ctrl) ctrl.style.display =
    (phase === "design" || phase === "allSubmitted" || phase === "cardPick" ||
     phase === "roundResult" || phase === "trace" || phase === "ended") ? "" : "none";

  /* ★ 카드 자료는 allowCard 가 참일 때만 «만든다». 거짓이면 마운트를 비우고
     카드 객체를 그리기 함수에 넘기지 않는다 — CSS 로 가리지 않는다. */
  var mount = $("environmentMount");
  while (mount.firstChild) mount.removeChild(mount.firstChild);
  if (allowCard && S.cards[S.round]) mount.appendChild(cardNode(S.cards[S.round]));

  /* ★ 타 조 자료도 마찬가지 */
  var peer = $("peerMount");
  while (peer.firstChild) peer.removeChild(peer.firstChild);

  renderRail(allowPeer);
  renderHead(phase);
  renderActions(phase);
  drawStage(allowCard ? S.cards[S.round] : null);
  renderControl(phase);
  renderAllTeams(phase);
  renderHistory(phase);
  if (typeof classroomPush === "function") classroomPush();
  if (typeof renderPins === "function") renderPins();
  if (typeof renderSetupWarn === "function") renderSetupWarn();
}

/* ★ 가시성은 .is-visible 클래스로만 전환한다 (Codex §4-1 · CSS 가 기본 숨김을 잡는다).
   인라인 style.display 로 조작하면 CSS 의 display:none 이 그대로 이겨 패널이 열리지 않는다. */
function show(id, on) {
  var n = $(id);
  if (!n) return;
  if (on) n.classList.add("is-visible"); else n.classList.remove("is-visible");
}

/* 환경 카드 DOM — allowCard 가 참인 국면에서만 호출된다 */
function cardNode(card) {
  var box = el("div", "environment-card");
  box.appendChild(el("p", "environment-kicker", "환경 변화"));
  box.appendChild(el("p", "environment-name", card.name));
  box.appendChild(el("p", "environment-range",
    "살아남는 " + CONFIG.trait.short + ": " + card.lo + " 이상 " + card.hi + " 이하"));
  return box;
}

/* ── 조 레일 — 이름과 상태«만». 수치·분포를 넣지 않는다(§5 금지 21·23) ── */
function renderRail(allowPeer) {
  var rail = $("teamRail");
  while (rail.firstChild) rail.removeChild(rail.firstChild);
  if (!S.teamCount) return;
  for (var i = 0; i < S.teamCount; i++) {
    var t = S.teams[i];
    var b = el("button", "team-tab");
    b.type = "button";
    b.appendChild(el("span", "team-tab-name", t.name));
    b.appendChild(el("span", "team-status", stateOf(i)));
    if (isCurrent(i)) { b.setAttribute("aria-current", "true"); b.classList.add("is-current"); }
    if (t.alloc) b.classList.add("is-complete");
    if (allowPeer && canJumpTo(i)) {
      b.addEventListener("click", (function (k) {
        return function () { S.viewTeamIndex = k; S.traceId = null; renderPhase(S.phase); };
      })(i));
    } else {
      b.disabled = true;
    }
    rail.appendChild(b);
  }
}
/* 레일에는 «진행 상태»만 넣는다. 생존 수·전멸 여부·폭은 넣지 않는다(§5 금지 21·23) */
function stateOf(i) {
  var t = S.teams[i];
  if (S.phase === "design") return i < S.turnPos ? "제출됨" : (i === S.turnPos ? "입력 중" : "대기");
  if (!t.alloc) return "대기";
  if (S.phase === "judge" || S.phase === "roundResult" || S.phase === "trace") {
    return i < S.viewTeamIndex ? "확인함" : (i === S.viewTeamIndex ? "보는 중" : "대기");
  }
  return "제출됨";
}
function isCurrent(i) { return S.phase === "design" ? i === S.turnPos : i === S.viewTeamIndex; }
function canJumpTo(i) {
  if (S.phase === "design" || S.phase === "setup" || S.phase === "rules" || S.phase === "idle") return false;
  return !!S.teams[i].alloc;
}

/* ── 머리말 ── */
function renderHead(phase) {
  var L = {
    idle: ["대기 중", "시작하면 조 수부터 정합니다."],
    setup: ["조 수 정하기", "참여하는 모둠 수를 고릅니다."],
    rules: ["규칙 확인", "게임 조작이 무엇을 비유하는지 먼저 맞춰 둡니다."],
    design: ["배분 입력", "종이에 적어 온 배분을 옮겨 적습니다. 환경은 아직 알려 주지 않습니다."],
    allSubmitted: ["전 조 제출 완료", "이제 환경 카드를 넘깁니다."],
    cardPick: ["다음 환경을 뽑는 중", "잠시 기다립니다."],
    cardReveal: ["환경 공개", "이번 환경에서 살아남는 범위를 봅니다."],
    judge: ["판정", "구간 밖의 개체가 사라집니다."],
    roundResult: ["결과", "예측과 실제를 나란히 봅니다."],
    trace: ["개체 추적", "한 개체를 골라 값이 바뀌었는지 확인합니다."],
    ended: ["마무리", "조를 골라 전체 기록을 봅니다."]
  }[phase] || ["", ""];
  $("phaseLabel").textContent = L[0];
  $("phaseHint").textContent = L[1];

  var t = currentTeam();
  $("stageTeamLabel").textContent = t ? t.name : "현재 조를 기다리는 중";
  var ctitle = document.querySelector(".control-card .section-title");
  if (ctitle) ctitle.textContent =
    phase === "design" ? "배분 입력" :
    (phase === "roundResult" || phase === "trace" || phase === "ended") ? "현재 조 결과" : "진행 중";
  $("controlTeamLabel").textContent = !t ? "현재 조의 종이 기록을 옮겨 적습니다."
    : (phase === "design" ? (t.name + "의 종이 기록을 옮겨 적습니다.") : (t.name));
  $("historyTeamLabel").textContent = t ? (t.name + "의 기록") : "선택한 한 조의 기록";
  var gen = t ? Math.max(0, t.generations.length - 1) : 0;
  $("generationLabel").textContent = gen + "세대";
}
function currentTeam() {
  if (!S.teamCount) return null;
  return S.phase === "design" ? S.teams[S.turnPos] : S.teams[S.viewTeamIndex];
}

/* ── 진행 버튼 ── */
function renderActions(phase) {
  var box = $("progressActions");
  while (box.firstChild) box.removeChild(box.firstChild);
  function add(label, fn, primary) {
    var b = el("button", "action" + (primary ? " action-primary" : ""), label);
    b.type = "button";
    b.addEventListener("click", fn);
    box.appendChild(b);
    return b;
  }
  if (phase === "idle") add("시작", function () { setPhase("setup"); }, true).id = "startButton";
  else if (phase === "setup") { if (S.teamCount) add("다음", function () { setPhase("rules"); }, true).id = "nextButton"; }
  else if (phase === "rules") add("배분 입력 시작", function () { startDesign(); }, true);
  else if (phase === "design") add("제출", function () { submitTeam(); }, true).id = "submitButton";
  else if (phase === "allSubmitted") add("환경 카드 넘기기", function () { toCardPick(); }, true);
  else if (phase === "cardPick") box.appendChild(el("p", "phase-hint", "교사 진행 중"));
  else if (phase === "cardReveal") add("판정 시작", function () { startJudge(); }, true);
  else if (phase === "judge") add(nextLabel(), function () { nextJudgeTeam(); }, true);
  else if (phase === "roundResult") add(nextLabel(), function () { nextResultTeam(); }, true);
  else if (phase === "trace") add(nextLabel(), function () { nextTraceTeam(); }, true);
  else if (phase === "ended") add("처음으로", function () { resetAll(); });
}
function nextLabel() { return S.viewTeamIndex < S.teamCount - 1 ? "다음 조" : "다음"; }

/* ============================================================
   개체 무대 — 점 누적도 (Codex §3)
   x 좌표가 형질값을 인코딩한다. 죽은 개체를 정리해도 같은 x 안에서만 다져지므로
   «값이 바뀐 자리»가 생기지 않는다 — M5 재이식 방지(A-4).
   ============================================================ */
function drawStage(card) {
  var cv = $("populationCanvas");
  if (!cv) return;
  var W = Math.max(240, cv.getBoundingClientRect().width || cv.clientWidth || 320);
  var H = Math.min(W, 420);
  var D = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * D); cv.height = Math.round(H * D);
  cv.style.height = H + "px";
  var g = cv.getContext("2d");
  g.setTransform(D, 0, 0, D, 0, 0);
  g.clearRect(0, 0, W, H);

  var t = currentTeam();
  var ti = teamIndexOf(t);
  var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26;

  drawCircle(g, cx, cy, R, ti, stagePopulation(), leavingThisRound(), card);

  /* 범례 대신 캔버스 아래 축약 안내 — 값은 색 «농도»와 «크기» 둘로 읽는다 */
  g.fillStyle = tok().t3; g.font = "11px system-ui,sans-serif"; g.textAlign = "center";
  g.fillText("점이 진하고 클수록 " + CONFIG.trait.name + "가 두껍습니다 (" +
    POP.T_MIN + "~" + POP.T_MAX + " mm · 이 게임의 범위)", cx, H - 6);
}

/* ★ 원형 무대 — 교사 격자와 태블릿이 같은 함수를 쓴다 (F-1 단일 원천).
   자리는 seatOf(id) 로 정해지므로 개체가 죽어도 살아남은 개체는 «자기 자리»에 그대로 있다.
   재배치가 일어나면 그 자리의 값이 바뀐 것처럼 보여 M5 를 재이식한다(P-검토 A-4 · C8-b). */
function drawCircle(g, cx, cy, R, teamIndex, pop, leaving, card) {
  /* 테두리 */
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  g.strokeStyle = tok().line; g.lineWidth = 2; g.stroke();

  /* ⚠ 원 전체를 칠하는 «생존 구간 밴드»는 두지 않는다 — 어느 개체가 구간 안인지 전혀
     보여주지 못하면서 화면만 물들인다(육안 실측). 구간은 카드에 숫자로 적히고,
     판정 결과는 회색 ⊗ 로 드러난다. */

  var put = function (o, dead) {
    var seat = seatOf(o.id, POP.N);
    var a = seat.angleDeg * Math.PI / 180;
    var rr = seat.radiusRatio * (R - 14);
    var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    var rad = dotRadius(o.t);
    if (dead) {
      drawDeadDot(g, x, y, rad, teamIndex, o.t, deadProgress(deathKey(teamIndex, S.round)));
      return;
    }
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = dotColor(teamIndex, o.t); g.fill();
    g.strokeStyle = "rgba(0,0,0,.38)"; g.lineWidth = 1.2; g.stroke();
    if (S.traceId !== null && o.id === S.traceId) {
      g.beginPath(); g.arc(x, y, rad + 4, 0, Math.PI * 2);
      g.strokeStyle = tok().violet; g.lineWidth = 2; g.stroke();
      g.beginPath();
      g.moveTo(x - 5, y - rad - 9); g.lineTo(x + 5, y - rad - 9); g.lineTo(x, y - rad - 4);
      g.closePath(); g.fillStyle = tok().violet; g.fill();
    }
  };
  (leaving || []).forEach(function (o) { put(o, true); });
  (pop || []).forEach(function (o) { put(o, false); });

  if (!(pop && pop.length) && !(leaving && leaving.length)) {
    var t0 = currentTeam();
    var wiped = t0 && t0.alloc && t0.wiped;
    g.fillStyle = wiped ? tok().gray : tok().t3;
    g.font = (wiped ? "bold 15px" : "13px") + " system-ui,sans-serif"; g.textAlign = "center";
    g.fillText(wiped ? "이 무리는 전멸했습니다" : "배분을 입력하면 여기에 나타납니다", cx, cy);
  }
}


/* ── 사망 연출 자산 (Codex 산출 · _codex_popgame_anim.md) ──
   3단계 820ms — ⑴ 색 빠짐 460 ⑵ 빈 표식 전환 240 ⑶ 정착 120.
   ★ x·y·rad 를 바꾸지 않는다 — 개체가 자기 자리를 벗어나면 그 자리의 «값»이
     바뀐 것처럼 보여 M5 를 재이식한다(P-검토 A-4 · C8-b).
   ★ 회색 명도를 손으로 적지 않고 --d-gray 토큰에서 계산한다. */
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

function teamIndexOf(t) {
  if (!t) return 0;
  for (var i = 0; i < S.teams.length; i++) if (S.teams[i] === t) return i;
  return 0;
}

function clampN(a, x, b) { return Math.max(a, Math.min(b, x)); }

/* ★ P6 C1 — 캔버스 색은 shared/style.css 토큰에서 읽는다. 하드코딩하지 않는다.
   한 번 읽어 캐시한다(매 프레임 getComputedStyle 은 비싸다). */
var TOK = null;
function tok() {
  if (TOK) return TOK;
  var cs = getComputedStyle(document.documentElement);
  var g = function (n, fb) { var v = cs.getPropertyValue(n); return (v && v.trim()) || fb; };
  TOK = {
    blue: g("--d-blue", "#1d4ed8"),
    violet: g("--d-violet", "#6d28d9"),
    green: g("--d-green", "#15803d"),
    red: g("--d-red", "#b91c1c"),
    gray: g("--d-gray", "#5f6b7a"),
    line: g("--line", "#e3e6ea"),
    t3: g("--t3", "#5b636b")
  };
  return TOK;
}
/* 생존 구간 밴드 — --d-green 을 옅게 깐다 */
function bandFill(hex) {
  var h = hex.replace("#", "");
  if (h.length !== 6) return "rgba(21,128,61,.10)";
  return "rgba(" + parseInt(h.slice(0,2),16) + "," + parseInt(h.slice(2,4),16) + "," + parseInt(h.slice(4,6),16) + ",.10)";
}

/* judge 국면에서 «이번 라운드에 죽은» 개체 — graves 의 diedRound 로 고른다 */
function leavingThisRound() {
  if (S.phase !== "judge") return null;
  var t = currentTeam();
  if (!t || !t.graves.length) return null;
  var out = [];
  for (var i = 0; i < t.graves.length; i++)
    if (t.graves[i].diedRound === S.round + 1) out.push(t.graves[i]);
  return out;
}

function peakStack() {
  var pop = stagePopulation() || [];
  var lv = leavingThisRound() || [];
  var all = pop.concat(lv);
  if (!all.length) return 6;
  var c = {}, m = 0;
  for (var i = 0; i < all.length; i++) { c[all[i].t] = (c[all[i].t] || 0) + 1; if (c[all[i].t] > m) m = c[all[i].t]; }
  return m;
}
function stagePopulation() {
  var t = currentTeam();
  if (!t) return null;
  if (S.phase === "design") {
    var a = allocFromCounts(S.counts), out = [];
    for (var i = 0; i < a.length; i++) out.push({ id: i + 1, t: a[i] });
    return out;
  }
  return t.generations.length ? t.generations[t.generations.length - 1] : null;
}

/* ============================================================
   오른쪽 조작 패널
   ============================================================ */
function renderControl(phase) {
  if (phase === "design") { renderAllocationGrid(); refreshDesign(); }
  if (phase === "roundResult" || phase === "trace" || phase === "ended") renderSingleResult();
  if (phase === "trace") renderTrace();
}

/* 두께별 마릿수 표 (설계지시안 v3 §3) — 조가 넘어갈 때 자식을 비우고 다시 만든다 */
function renderAllocationGrid() {
  var grid = $("allocationGrid");
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  grid.className = "counts-table";
  for (var t = POP.T_MIN; t <= POP.T_MAX; t++) {
    var row = el("label", "counts-row");
    row.appendChild(el("span", "counts-thick", t + " mm"));
    var inp = el("input", "counts-input");
    inp.type = "number"; inp.min = 0; inp.max = POP.N; inp.step = 1;
    inp.inputMode = "numeric";
    var i = t - POP.T_MIN;
    inp.value = (S.counts[i] === undefined || S.counts[i] === 0) ? "" : S.counts[i];
    inp.addEventListener("input", (function (k) {
      return function (ev) { S.counts[k] = parseInt(ev.target.value, 10) || 0; refreshDesign(); };
    })(i));
    row.appendChild(inp);
    row.appendChild(el("span", "counts-unit", "마리"));
    grid.appendChild(row);
  }
}

/* 두 합계·폭·히스토그램 — 전부 코어 함수에서 나온다 (§5 금지 16) */
function refreshDesign() {
  var T = countsTotals(S.counts);
  $("remainingValue").textContent = T.animals + " / " + POP.N;
  var thickEl = $("spreadValue");
  var alloc = allocFromCounts(S.counts);

  var msg = [];
  if (!T.okAnimals) msg.push(POP.N + "마리를 채우세요 (" + T.animals + ")");
  if (!T.okThickness) msg.push("두께 총합이 " + T.needThickness + " 모자랍니다");
  $("remainingState").textContent = msg.length ? msg.join(" · ") : "제출할 수 있습니다";

  var v = (T.okAnimals && T.okThickness) ? validateAllocation(alloc) : { ok: false };
  var sub = $("submitButton");
  if (sub) sub.disabled = !v.ok;

  var sd = alloc.length ? sdOfAlloc(alloc) : null;
  if (thickEl) thickEl.textContent = sd === null ? "–" : sd.toFixed(1);
  var tot = $("thicknessTotal");
  if (tot) tot.textContent = String(T.thickness);
  var need = $("thicknessNeed");
  if (need) need.textContent = " / " + POP.SUM_MIN + " 이상" + (T.okThickness ? " ✔" : "");
  var af = $("autoFillButton");
  if (af) af.disabled = T.restAnimals <= 0;

  drawHistogram(alloc);
  drawStage(null);
}

function drawHistogram(alloc) {
  var cv = $("histogramCanvas");
  if (!cv) return;
  var W = Math.max(200, cv.getBoundingClientRect().width || 280), H = 96;
  var D = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * D); cv.height = Math.round(H * D); cv.style.height = H + "px";
  var g = cv.getContext("2d"); g.setTransform(D, 0, 0, D, 0, 0); g.clearRect(0, 0, W, H);
  var h = histogramOfAlloc(alloc);
  var maxv = 1;
  for (var i = 0; i < h.length; i++) if (h[i] > maxv) maxv = h[i];
  var bw = W / h.length, base = H - 16;
  g.fillStyle = tok().blue;
  for (var j = 0; j < h.length; j++) {
    if (!h[j]) continue;
    var bh = (h[j] / maxv) * (base - 6);
    g.fillRect(j * bw + 1, base - bh, Math.max(2, bw - 2), bh);
  }
  g.strokeStyle = tok().line; g.beginPath(); g.moveTo(0, base + .5); g.lineTo(W, base + .5); g.stroke();
  g.fillStyle = tok().t3; g.font = "10px system-ui,sans-serif"; g.textAlign = "center";
  g.fillText(String(POP.T_MIN), bw / 2, H - 3);
  g.fillText(String(POP.T_MAX), W - bw / 2, H - 3);
}

/* ── 결과 — 한 조씩. 조 간 수치를 같은 화면에 나란히 놓지 않는다(§5 금지 23) ── */
function renderSingleResult() {
  var t = currentTeam();
  if (!t) return;
  var last = t.rounds.length ? t.rounds[t.rounds.length - 1] : null;
  $("predictionSummary").textContent = (t.pred === null || t.pred === undefined) ? "–" : (t.pred + "마리");
  $("actualSummary").textContent = last ? (last.alive + "마리") : "–";
  $("survivalLine").textContent = last ? (last.alive === 0 ? "전멸" : "생존 " + last.alive + "마리") : "–";
}

/* ── 개체 추적기 (반박 장치 ③) ── */
function renderTrace() {
  var t = currentTeam();
  var sel = $("traceSelect");
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  if (!t || !t.generations.length) return;
  var first = t.generations[0];
  for (var i = 0; i < first.length; i++) {
    var o = el("option", null, first[i].id + "번 (" + CONFIG.trait.short + " " + first[i].t + ")");
    o.value = String(first[i].id);
    sel.appendChild(o);
  }
  if (S.traceId === null) S.traceId = defaultTraceId(t, first);
  sel.value = String(S.traceId);
  sel.onchange = function () { S.traceId = parseInt(sel.value, 10); showLineage(); drawStage(null); };
  showLineage();
}
/* 세대를 가장 멀리 간 개체 — 반박 장치 ③ 이 「값 불변 + 세대 전달」을 보이려면
   살아남은 개체가 기본이어야 한다. 전멸한 조는 가장 오래 산 개체를 고른다. */
function defaultTraceId(team, first) {
  var best = first[0].id, bestLen = -1;
  for (var i = 0; i < first.length; i++) {
    var L = lineage(traceResultOf(team), first[i].id);
    var len = L ? L.chain.length : 0;
    if (len > bestLen) { bestLen = len; best = first[i].id; }
  }
  return best;
}

function showLineage() {
  var t = currentTeam();
  var L = lineage(traceResultOf(t), S.traceId);
  if (!L) { $("lineageLine").textContent = ""; $("lineageNote").textContent = ""; return; }
  var parts = [];
  for (var i = 0; i < L.chain.length; i++) parts.push(L.chain[i].gen + "세대 " + L.chain[i].t);
  $("lineageLine").textContent = parts.join("  →  ");
  $("lineageNote").textContent = L.diedRound !== null
    ? ("이 개체는 " + L.diedRound + "라운드에서 죽었습니다 — 값은 끝까지 " + L.lastValue + "이었습니다.")
    : ("값이 한 번도 바뀌지 않았습니다. 바뀐 것은 무리의 분포입니다.");
}


/* ── v3: 전 조 격자 (설계지시안 v3 §5) ──
   ⚠ §5 금지 23(조 간 나란히 놓기)은 «사용자 확정으로 해제»됐다. 로드맵 원칙 4(비경쟁)와
     부딪히는 결정임을 검증보고에 기록한다. 금지 17(줄 세우기 표기)은 그대로 살아 있다 —
     조 순서를 «고정»하고 마릿수로 정렬하지 않는다. */
function renderAllTeams(phase) {
  var card = $("allTeamsCard");
  if (!card) return;
  var on = (phase === "judge" || phase === "roundResult" || phase === "trace" || phase === "ended");
  card.style.display = on ? "" : "none";
  if (!on) return;
  var grid = $("allTeamsGrid");
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  for (var i = 0; i < S.teamCount; i++) {          // ★ 조 순서 고정 — 마릿수로 재배열하지 않는다(금지 17)
    var t = S.teams[i];
    var cell = el("div", "allteam-cell");
    var cv = document.createElement("canvas");
    cv.className = "allteam-canvas";
    cell.appendChild(cv);
    cell.appendChild(el("div", "allteam-name", t.name));
    var last = t.rounds.length ? t.rounds[t.rounds.length - 1] : null;
    var n = last ? last.alive : (t.alloc ? POP.N : 0);
    var cnt = el("div", "allteam-count" + (n === 0 ? " is-wiped" : ""), n === 0 ? "전멸" : n + "마리");
    cell.appendChild(cnt);
    grid.appendChild(cell);
    drawTeamCell(cv, i, t);
  }
}
function drawTeamCell(cv, teamIndex, team) {
  var W = Math.max(80, cv.getBoundingClientRect().width || 140);
  var H = W;
  var D = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * D); cv.height = Math.round(H * D);
  cv.style.height = H + "px";
  var g = cv.getContext("2d");
  g.setTransform(D, 0, 0, D, 0, 0); g.clearRect(0, 0, W, H);
  var pop = team.generations.length ? team.generations[team.generations.length - 1] : null;
  var lv = null;
  if (S.phase === "judge" && team.graves.length) {
    lv = team.graves.filter(function (o) { return o.diedRound === S.round + 1; });
  }
  drawCircleMini(g, W / 2, H / 2, Math.min(W, H) / 2 - 6, teamIndex, pop, lv);
}
/* 작은 원 — 큰 무대와 «같은 자리 규칙»을 쓴다(F-1). 추적 마커는 그리지 않는다. */
function drawCircleMini(g, cx, cy, R, teamIndex, pop, leaving) {
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  g.strokeStyle = tok().line; g.lineWidth = 1.5; g.stroke();
  var scale = R / 190;
  var put = function (o, dead) {
    var seat = seatOf(o.id, POP.N);
    var a = seat.angleDeg * Math.PI / 180;
    var rr = seat.radiusRatio * (R - 6);
    var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    var rad = Math.max(1.6, dotRadius(o.t) * Math.max(0.34, scale));
    if (dead) {
      drawDeadDot(g, x, y, rad, teamIndex, o.t, deadProgress(deathKey(teamIndex, S.round)));
    } else {
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
      g.fillStyle = dotColor(teamIndex, o.t); g.fill();
    }
  };
  (leaving || []).forEach(function (o) { put(o, true); });
  (pop || []).forEach(function (o) { put(o, false); });
}

/* ── 기록표 — 선택한 한 조만 ── */
function renderHistory(phase) {
  var body = $("historyBody");
  while (body.firstChild) body.removeChild(body.firstChild);
  var t = currentTeam();
  if (!t || (phase !== "roundResult" && phase !== "trace" && phase !== "ended")) return;
  for (var i = 0; i < t.rounds.length; i++) {
    var r = t.rounds[i];
    var tr = el("tr", "history-row");
    tr.appendChild(el("td", "history-cell", String(r.round)));
    tr.appendChild(el("td", "history-cell", r.card.name));
    tr.appendChild(el("td", "history-cell", (i === 0 && t.pred !== null) ? (t.pred + "마리") : "–"));
    tr.appendChild(el("td", "history-cell", r.alive === 0 ? "전멸" : r.alive + "마리"));
    body.appendChild(tr);
  }
}

/* ============================================================
   흐름
   ============================================================ */
function startDesign() {
  S.turnPos = 0; S.round = 0;
  S.cards = [CONFIG.cards[0], CONFIG.cards[1]];   // 3라운드는 교사가 고른 뒤 들어온다
  S.counts = emptyCounts();
  setPhase("design");
}
function submitTeam() {
  var nums = allocFromCounts(S.counts);
  var v = validateAllocation(nums);
  if (!v.ok) return;
  var t = S.teams[S.turnPos];
  t.alloc = nums.slice();
  var p = parseInt($("survivorPrediction").value, 10);
  t.pred = (isNaN(p) || p < 0 || p > POP.N) ? null : p;
  t.pop = makePopulation(nums);
  t.generations = [t.pop.slice()];
  $("survivorPrediction").value = "";
  S.counts = emptyCounts();
  S.turnPos++;
  if (S.turnPos >= S.teamCount) { S.viewTeamIndex = 0; setPhase("allSubmitted"); }
  else setPhase("design");
}
function toCardPick() {
  if (S.round === POP.ROUNDS - 1) setPhase("cardPick");   // 3라운드만 교사 선택
  else { S.viewTeamIndex = 0; setPhase("cardReveal"); }
}
/* ★ 교사 선택은 키보드로만 받는다 — 선택지를 DOM 에 만들지 않는다(사용자 확정 2026-08-24) */
function onKey(ev) {
  if (S.phase !== "cardPick") return;
  var i = ev.key === "1" ? 0 : (ev.key === "2" ? 1 : -1);
  if (i < 0) return;
  S.cards[S.round] = CONFIG.finalCards[i];
  S.viewTeamIndex = 0;
  setPhase("cardReveal");
}
function startJudge() {
  S.viewTeamIndex = 0; judgeTeam(); setPhase("judge");
  kickDeadAnimation();
}
/* 판정 상태는 judgeTeam() 이 «먼저» 확정한다. 여기서는 시각 효과만 시작한다. */
function kickDeadAnimation() {
  startDeadAnimation(deathKey(S.viewTeamIndex, S.round), function () {
    drawStage(cardVisible(S.phase) ? S.cards[S.round] : null);
    renderAllTeams(S.phase);
  });
}
function judgeTeam() {
  var t = S.teams[S.viewTeamIndex];
  if (!t.pop || t.wiped) return;
  var res = applyCard(t.pop, S.cards[S.round], t.nextId);
  for (var i = 0; i < res.dead.length; i++)
    t.graves.push({ id: res.dead[i].id, t: res.dead[i].t, diedRound: S.round + 1 });
  t.rounds.push({
    round: S.round + 1, card: S.cards[S.round],
    alive: res.survivors.length, wiped: res.survivors.length === 0, stats: stats(res.next)
  });
  t.nextId = res.nextId; t.pop = res.next; t.generations.push(res.next.slice());
  if (!res.survivors.length) t.wiped = true;
}
function nextJudgeTeam() {
  if (S.viewTeamIndex < S.teamCount - 1) { S.viewTeamIndex++; judgeTeam(); renderPhase("judge"); kickDeadAnimation(); }
  else { S.viewTeamIndex = 0; setPhase("roundResult"); }
}
function nextResultTeam() {
  if (S.viewTeamIndex < S.teamCount - 1) { S.viewTeamIndex++; renderPhase("roundResult"); }
  else { S.viewTeamIndex = 0; S.traceId = null; setPhase("trace"); }
}
function nextTraceTeam() {
  if (S.viewTeamIndex < S.teamCount - 1) { S.viewTeamIndex++; S.traceId = null; renderPhase("trace"); }
  else {
    S.round++;
    if (S.round >= POP.ROUNDS) { S.viewTeamIndex = 0; setPhase("ended"); }
    else { S.viewTeamIndex = 0; setPhase("allSubmitted"); }
  }
}
function resetAll() {
  S.teamCount = 0; S.teams = []; S.turnPos = 0; S.viewTeamIndex = 0;
  S.round = 0; S.cards = []; S.counts = emptyCounts(); S.traceId = null;
  setPhase("idle");
}

/* ── 「이 게임이 하지 않는 것」 — §3-④ 7항목 ── */
var LIMITS = [
  "형질이 " + CONFIG.trait.name + " 하나뿐입니다. 실제 생물은 여러 형질이 함께 작용합니다.",
  "자손은 부모의 값을 그대로 물려받습니다 — 돌연변이로 «새로운» 값이 생기지 않습니다.",
  "생존이 값 하나로만 갈립니다. 실제로는 냄새·움직임·크기·운이 함께 작용합니다.",
  "개체 " + POP.N + "마리는 실제 개체군보다 훨씬 작습니다.",
  "환경 카드가 «사람이» 정한 순서로 옵니다. 자연에는 그런 의도가 없습니다.",
  "형질값 총합이 " + POP.SUM + "으로 고정된 것은 게임 규칙이지 생물학적 제약이 아닙니다.",
  "구간 안이면 반드시 살고 밖이면 반드시 죽습니다. 실제 생존은 확률적입니다.",
  /* P5-M8 범위=세계 */
  CONFIG.trait.name + " " + POP.T_MIN + "~" + POP.T_MAX + "은 «임의 단위»이고 이 게임이 정한 범위입니다 — " +
    "실제 생물의 형질이 이 범위 안에만 있다는 뜻이 아닙니다.",
  /* P5-M6 색의 오해 */
  "점의 색은 개체의 «상태»(살아 있음·사라짐·추적 중)를 나타내는 임의 색입니다 — 생물의 실제 색이 아닙니다.",
  /* P5-M1 은유 오염 */
  "점이 위로 쌓인 것은 «같은 값을 가진 개체 수»일 뿐이고, 위아래는 좋고 나쁨이 아닙니다."
];


/* ==== CLASSROOM-BEGIN ==== */
/* ── 교실 모드 — Firebase Realtime Database (설계지시안 v4) ──
   ★ SDK 를 쓰지 않는다. REST + EventSource 만으로 실시간 구독이 된다
     → 외부 CDN·ES 모듈 없이 이 프로젝트의 규약을 지킨다.
   ★ 통신 코드는 «전부» 이 블록 안에 있다. C20 이 「블록을 뺀 단독 경로」에
     fetch·EventSource·localStorage 가 0건인지 검사한다.
   ★ 설치 전에는 placeholder 가 남아 조용히 단독 모드로 동작한다(C24). */

var FB = {
  /* ↓↓↓ 설치 시 이 한 줄만 바꾼다 (설계지시안 v4 §4) ↓↓↓ */
  databaseURL: "<DATABASE_URL>"
  /* ↑↑↑ 예: https://popgame-default-rtdb.asia-southeast1.firebasedatabase.app ↑↑↑ */
};
function fbReady() {
  return typeof FB.databaseURL === "string" &&
    FB.databaseURL.indexOf("<") < 0 && FB.databaseURL.indexOf("http") === 0;
}
function fbUrl(path) { return FB.databaseURL.replace(/\/+$/, "") + path + ".json"; }

var CLASSROOM = { on: false, room: null, pins: [], sending: false, queued: false };

/* 방 코드 — 교사 화면이 만든다. 시드는 시각이 아니라 «조 수 + 난수»로 뽑는다. */
function makeRoomCode() {
  var s = "";
  for (var i = 0; i < 4; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

/* 교실 모드 켜기 — 조 수를 고른 «뒤»에 부른다(그때 PIN 을 발급하므로) */
function classroomStart() {
  if (!fbReady() || !S.teamCount) return;
  CLASSROOM.room = makeRoomCode();
  var pins = [], body = { pins: {}, rooms: {} };
  var teams = {};
  for (var i = 0; i < S.teamCount; i++) {
    var pin = makeRoomCode();
    pins.push({ name: (i + 1) + "조", pin: pin });
    teams[i] = { name: (i + 1) + "조", counts: null, alloc: null, pred: null, submitted: false };
  }
  CLASSROOM.pins = pins;
  /* pins 는 전역 경로에 따로 올린다 — 학생은 PIN 만 알고 방 코드는 모른다 */
  var pinPatch = {};
  pins.forEach(function (p, i) { pinPatch[p.pin] = { room: CLASSROOM.room, team: i }; });
  fbPatch("/pins", pinPatch);
  fbPut("/rooms/" + CLASSROOM.room, { meta: metaNow(), teams: teams });
  CLASSROOM.on = true;
  renderPins();
}

function metaNow() {
  return {
    phase: S.phase, round: S.round, teamCount: S.teamCount,
    cardsSoFar: cardsRevealed(), rev: Math.floor(Math.random() * 1e9)
  };
}

/* ★ 태블릿에 보낼 «공개된» 카드만 — 아직 안 낸 카드를 올리면 M7 반박 장치가 죽는다 */
function cardsRevealed() {
  var n = S.round;
  if (S.phase === "cardReveal" || S.phase === "judge" || S.phase === "roundResult" ||
      S.phase === "trace" || S.phase === "ended") n = S.round + 1;
  return S.cards.slice(0, Math.max(0, n));
}

function fbPut(path, data) {
  if (!fbReady()) return;
  try {
    fetch(fbUrl(path), { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data) }).catch(function () {});
  } catch (e) {}
}
function fbPatch(path, data) {
  if (!fbReady()) return;
  try {
    fetch(fbUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data) }).catch(function () {});
  } catch (e) {}
}

/* 상태를 올린다 — 국면이 바뀔 때마다 renderPhase() 가 부른다.
   연속 호출이 몰리면 마지막 것만 보낸다(교실 진행을 붙잡지 않는다). */
function classroomPush() {
  if (!CLASSROOM.on || !CLASSROOM.room) return;
  if (CLASSROOM.sending) { CLASSROOM.queued = true; return; }
  CLASSROOM.sending = true;
  var base = "/rooms/" + CLASSROOM.room;
  fbPatch(base + "/meta", metaNow());
  var t = currentTeam();
  if (t) {
    fbPatch(base + "/teams/" + teamIndexOf(t), {
      name: t.name,
      counts: t.alloc ? countsFromAlloc(t.alloc) : null,
      alloc: t.alloc, pred: t.pred, submitted: !!t.alloc
    });
  }
  window.setTimeout(function () {
    CLASSROOM.sending = false;
    if (CLASSROOM.queued) { CLASSROOM.queued = false; classroomPush(); }
  }, 250);
}

/* 방 지우기 — 이전 수업 자료를 남기지 않는다(설계지시안 v4 §5) */
function classroomClear() {
  if (!CLASSROOM.on || !CLASSROOM.room) return;
  fbPut("/rooms/" + CLASSROOM.room, null);
  CLASSROOM.pins.forEach(function (p) { fbPut("/pins/" + p.pin, null); });
  CLASSROOM.on = false; CLASSROOM.room = null; CLASSROOM.pins = [];
  renderPins();
}

function renderSetupWarn() {
  var w = $("clsSetupWarn");
  if (!w) return;
  if (fbReady()) {
    w.textContent = "설치됨 — 조 수를 고르면 조별 PIN이 위에 나타납니다.";
    w.className = "cls-note";
  }
}

function renderPins() {
  var mount = $("peerMount");
  if (!mount) return;
  while (mount.firstChild) mount.removeChild(mount.firstChild);
  if (!fbReady()) return;                       /* 미설치 — 조용히 단독 모드 */
  if (!CLASSROOM.on) return;
  if (S.phase !== "design" && S.phase !== "setup" && S.phase !== "rules") return;
  var box = el("div", "pin-list");
  box.appendChild(el("p", "pin-list-title", "학생 태블릿 접속 — 조별 PIN (방 " + CLASSROOM.room + ")"));
  var row = el("div", "pin-row");
  CLASSROOM.pins.forEach(function (p) {
    var chip = el("span", "pin-chip");
    chip.appendChild(el("span", "pin-chip-name", p.name));
    chip.appendChild(el("span", "pin-chip-code", p.pin));
    row.appendChild(chip);
  });
  box.appendChild(row);
  mount.appendChild(box);
}
/* ==== CLASSROOM-END ==== */

/* ── 초기화 ── */
function init() {
  var lc = $("limitsContent");
  if (lc) {
    var ul = el("ul", "limits-list");
    for (var i = 0; i < LIMITS.length; i++) ul.appendChild(el("li", "limits-item", LIMITS[i]));
    lc.appendChild(ul);
  }
  var btns = document.querySelectorAll(".team-count");
  for (var k = 0; k < btns.length; k++) {
    btns[k].addEventListener("click", (function (b) {
      return function () {
        S.teamCount = parseInt(b.getAttribute("data-count"), 10);
        S.teams = [];
        for (var i = 0; i < S.teamCount; i++) S.teams.push(newTeam(i));
        for (var m = 0; m < btns.length; m++) btns[m].setAttribute("aria-pressed", btns[m] === b ? "true" : "false");
        renderPhase("setup");
        if (typeof classroomStart === "function") classroomStart();
      };
    })(btns[k]));
  }
  var af = $("autoFillButton");
  if (af) af.addEventListener("click", function () {
    var next = autoFill(S.counts);          /* 규칙은 코어가 갖는다(F-1) */
    if (!next) {
      $("remainingState").textContent = "남은 마릿수로는 두께 총합 " + POP.SUM_MIN + "을 넘길 수 없습니다 — 두꺼운 쪽을 늘리세요";
      return;
    }
    S.counts = next;
    renderAllocationGrid(); refreshDesign();
  });
  var cb = $("clearButton");
  if (cb) cb.addEventListener("click", function () {
    S.counts = emptyCounts();
    renderAllocationGrid(); refreshDesign();
  });
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", function () { drawStage(cardVisible(S.phase) ? S.cards[S.round] : null); });
  setPhase("idle");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
