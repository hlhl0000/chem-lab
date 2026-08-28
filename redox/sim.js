"use strict";
/* ================================================================
   산화와 환원 — 산화 구리(Ⅱ)와 탄소의 반응 계산부 (화면과 무관)

   반응식  2CuO + C → 2Cu + CO₂            (교과서 34쪽 본문 박스)
   「어떤 물질이 산소를 얻으려면 산소를 잃는 다른 물질이 있어야 한다.
     따라서 산화와 환원은 항상 동시에 일어난다.」 (교과서 34쪽 — 수업M7의 원문)

   모델 (설계지시안_산화환원_v1 §3 단계 1)
   ① 이벤트 단위 화학량론 — 1이벤트 = CuO 2개 + C 1개 소비 = 산소 2개 이동
      = CO₂ 1개 생성. 총 12이벤트(CuO 24·C 12, 화학량론 2:1)로 완결.
   ② 온도는 지수 해 — T = 목표 + (T−목표)·e^(−dt/τ). 오일러 적분 금지(§14 ③-1):
      큰 dt에서도 진동·발산이 구조적으로 불가능하다.
      ⚠ T_EQ·T_START·TAU_H 는 «임의 모형값»이다. 실제 개시 온도·불꽃 온도라
      주장하지 않으며 화면에 숫자로 표시하지 않는다 (지시안 §1-2 추정 1).
   ③ 진행률 p 가 단일 원천(F-1) — 이벤트 수·가루 색 전이 앞자리·단계 배지가
      전부 p 에서 유도된다. K_P = 1/40 s⁻¹: 활성 가열 시 40 s에 완결(시간 압축 —
      실물 수 분. 가정과 한계 목록 ⑵에 명시).
   ④ 산소 원자 24개를 «개별로» 추적한다. 미시 배치 함수 redoxLayout() 이
      렌더와 검증이 함께 쓰는 단일 원천이다 (CLAUDE.md 원칙 11 — 판정기는
      렌더가 쓰는 그 객체를 표본화한다).
   ⑤ 동시성 카운터 두 개는 «서로 다른 자료 구조»에서 독립적으로 센다:
      · 구리가 잃은 산소 = oxy 배열에서 state가 'cuo'가 아닌 원소 수
      · 탄소가 얻은 산소 = carbons 배열의 claimed 합
      같은 반응 이벤트가 둘을 함께 갱신하므로 물리적으로 항상 같아야 하고,
      한쪽 갱신이 빠지는 버그는 검사군 4가 즉시 잡는다 (P-검토 A-4 처방).
   ================================================================ */

const REDOX = {
  N_CUO: 24, N_C: 12, EVENTS: 12,          // 화학량론 2:1 (교과서 34쪽 계수)
  T_AMB: 20, T_EQ: 900, TAU_H: 8,          // 임의 모형값 — 화면 비표시
  T_START: 400,                            // 반응 개시 문턱(임의 모형값)
  K_P: 1 / 40,                             // 진행률/s — 활성 가열 40 s 완결
  TRANSIT: 2.5,                            // CO₂ 고무관 이동 지연 s
  FLIGHT: 1.2,                             // 미시 산소 비행 시간 s
  RISE: 2.0,                               // CO₂ 상승 속도 (배치 단위/s · 상한 없음 — 화면 위로 떠나
                                           //   거시의 「관을 지나 석회수로」와 이어진다. 같은 자리에
                                           //   여러 분자가 멈춰 겹치는 것을 상한이 만들었었다)
  M: { Cu: 63.546, O: 15.999, C: 12.011 }  // 몰질량 g/mol (문헌값)
};

/* 미시 배치 기하 — 렌더·검사 공용 (매직 넘버 금지: 원칙 13 — 검사가 이 표에서
   반지름 합·간격을 유도해 겹침 0을 확인한다).
   solid(mineral) 방식의 «연속 배열» (2026-08-27 사용자 지시 2차):
   산화 구리(Ⅱ)와 탄소를 «섞어» 한 격자에 배열한다 — 실제로 두 가루를 섞어 가열하므로.
   격자는 화면 가장자리 너머까지 이어 그린다(여분 고리 = 계속되는 가루). 가열이 왼쪽부터
   번지면서 CuO 자리의 산소가 떨어져 나가 그 자리에는 «구리만» 남고, 떨어진 산소는 이웃
   탄소와 CO₂를 이루어 표면 앞으로 빠져나와 위로 떠난다. */
const GEO = {
  R: { Cu: 1.0, O: 0.9, C: 0.85 },         // 공 반지름 (배치 단위)
  COLS: 6, ROWS: 6,                        // 앞줄(반응하는) 격자 6×6 = 셀 36 = CuO 24 + C 12
  DX: 4.4, DY: 3.0,                        // 셀 간격
  CUO_OFF: 2.2,                            // Cu → O (Cu–O 결합 길이)
  C_OFF: 1.1,                              // 셀 안 탄소의 x 치우침 — 양옆 간격이 3.3으로 대칭
  CO2_BOND: 1.9,                           // O=C=O 표시 간격 (> r_C+r_O = 1.75)
  Z_OUT: 4.5,                              // CO₂가 빠져나와 떠오르는 깊이(격자 표면 «앞»)
  Z_FLY: 7.0,                              // 산소 비행 고도 — 격자·CO₂ 어느 것보다 앞
  RING: 2                                  // 가장자리 너머로 이어 그리는 여분 셀 고리 수
};

/* 셀 종류 — 한 줄이 [CuO, CuO, C] 의 반복. 화학량론 2:1이 배열 자체에 들어 있다 */
function cellIsCarbon(col) { return ((col % 3) + 3) % 3 === 2; }

/* 이벤트 e 가 소비하는 삼각 조합(CuO 2 + C 1)의 셀 위치.
   왼쪽 무리(가열부) 먼저, 무리 안에서는 «윗줄부터» — 먼저 생긴 CO₂가 늘 위에 있어
   나중 것이 앞지르지 못한다(같은 속도로 오르므로 간격은 벌어지기만 한다) */
function triadCell(e) {
  const g = Math.floor(e / GEO.ROWS), r = (GEO.ROWS - 1) - (e % GEO.ROWS);
  return { g: g, r: r };
}
function cuSite(i) {
  const t = triadCell(Math.floor(i / 2)), col = t.g * 3 + (i % 2);
  return { x: col * GEO.DX, y: t.r * GEO.DY, z: 0 };
}
function oxySite(i) {
  const p = cuSite(i);
  return { x: p.x + GEO.CUO_OFF, y: p.y, z: 0 };
}
function cSite(k) {
  const t = triadCell(k), col = t.g * 3 + 2;
  return { x: col * GEO.DX + GEO.C_OFF, y: t.r * GEO.DY, z: 0 };
}

function redoxInit() {
  const oxy = [], carbons = [];
  for (let i = 0; i < REDOX.N_CUO; i++)
    oxy.push({ i: i, state: "cuo", cIdx: null, born: NaN });
  for (let k = 0; k < REDOX.N_C; k++)
    carbons.push({ k: k, claimed: 0, firedAt: NaN, formedAt: NaN });
  return {
    t: 0, T: REDOX.T_AMB, heat: false,
    p: 0, E: 0,
    oxy: oxy, carbons: carbons,
    tubeArrivals: [],        // CO₂가 석회수에 닿는 시각 (거시)
    absorbed: 0, turb: 0
  };
}

/* 반응 이벤트 — CuO 2개의 산소가 떠나(환원) 탄소 1개가 얻는다(산화). 한 사건이다. */
function redoxFireEvent(s) {
  const e = s.E;
  const a = s.oxy[2 * e], b = s.oxy[2 * e + 1], c = s.carbons[e];
  a.state = "transit"; a.cIdx = e; a.born = s.t;
  b.state = "transit"; b.cIdx = e; b.born = s.t;
  c.claimed = 2;                            // ← 독립 원천 ②: 탄소 쪽 장부
  c.firedAt = s.t;                          // 탄소가 격자를 떠나기 시작한 시각
  s.tubeArrivals.push(s.t + REDOX.FLIGHT + REDOX.TRANSIT);
  s.E = e + 1;
}

function redoxStep(s, dt) {
  const target = s.heat ? REDOX.T_EQ : REDOX.T_AMB;
  s.T = target + (s.T - target) * Math.exp(-dt / REDOX.TAU_H);
  if (s.T >= REDOX.T_START && s.p < 1)
    s.p = Math.min(1, s.p + REDOX.K_P * dt);
  const eTarget = Math.floor(s.p * REDOX.EVENTS + 1e-9);
  while (s.E < eTarget) redoxFireEvent(s);
  for (let i = 0; i < s.oxy.length; i++) {
    const o = s.oxy[i];
    if (o.state === "transit" && s.t - o.born >= REDOX.FLIGHT) {
      o.state = "co2";
      const c = s.carbons[o.cIdx];
      if (!isFinite(c.formedAt)) c.formedAt = o.born + REDOX.FLIGHT;
    }
  }
  let n = 0;
  for (let i = 0; i < s.tubeArrivals.length; i++)
    if (s.tubeArrivals[i] <= s.t) n++;
  s.absorbed = n;
  s.turb = n / REDOX.EVENTS;
  s.t += dt;
  return s;
}

/* ── 동시성 카운터 — 서로 다른 자료 구조에서 독립적으로 센다 (검사군 4·화면 카운터 공용) ── */
function redoxLostByCu(s) {
  let n = 0;
  for (let i = 0; i < s.oxy.length; i++) if (s.oxy[i].state !== "cuo") n++;
  return n;
}
function redoxGainedByC(s) {
  let n = 0;
  for (let k = 0; k < s.carbons.length; k++) n += s.carbons[k].claimed;
  return n;
}

/* 잔량·생성량 — 화면 표시·검사 공용 */
function redoxCounts(s) {
  return {
    cuoLeft: REDOX.N_CUO - 2 * s.E, cLeft: REDOX.N_C - s.E,
    cu: 2 * s.E, co2: s.E,
    lost: redoxLostByCu(s), gained: redoxGainedByC(s)
  };
}

/* CO₂(와 그 탄소)의 상승량 — 상한 없음: 화면 위로 떠나간다 */
function co2Rise(c, t) {
  if (!isFinite(c.formedAt)) return 0;
  return REDOX.RISE * Math.max(0, t - c.formedAt);
}
/* 탄소가 격자 표면 «앞»으로 빠져나온 깊이 — 산소가 날아오는 동안 함께 나온다 */
function cZ(c, t) {
  if (!isFinite(c.firedAt)) return 0;
  return GEO.Z_OUT * Math.min(1, Math.max(0, (t - c.firedAt) / REDOX.FLIGHT));
}
/* 주변 셀(여분 고리)의 반응 시점 — 왼쪽부터 번지되 셀마다 조금씩 흔들린다.
   결정적 해시를 쓴다(Math.random 금지 — 매 프레임 배열이 흔들리면 안 된다) */
function cellHash01(col, row) {
  const v = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function cellReacted(col, row, p) {
  const span = GEO.COLS + 2 * GEO.RING;
  const order = (col + GEO.RING) / span;
  return p > Math.min(0.985, Math.max(0.015, order * 0.88 + cellHash01(col, row) * 0.12));
}

/* ── 미시 배치 — 렌더와 검사가 함께 쓰는 단일 원천 (원칙 11) ──
   반환: { atoms: [{el,x,y,z,i}], bonds: [[a,b]] }  (bonds는 atoms 배열 인덱스 쌍) */
function redoxLayout(s) {
  const atoms = [], bonds = [];
  const oxyAt = new Array(REDOX.N_CUO), cuAt = new Array(REDOX.N_CUO),
        cAt = new Array(REDOX.N_C);
  for (let i = 0; i < REDOX.N_CUO; i++) {
    const p = cuSite(i);
    cuAt[i] = atoms.length;
    atoms.push({ el: "Cu", x: p.x, y: p.y, z: p.z, i: i });
  }
  for (let k = 0; k < REDOX.N_C; k++) {
    const p = cSite(k), c = s.carbons[k];
    cAt[k] = atoms.length;
    atoms.push({ el: "C", x: p.x, y: p.y + co2Rise(c, s.t), z: cZ(c, s.t), i: k });
  }
  for (let i = 0; i < REDOX.N_CUO; i++) {
    const o = s.oxy[i];
    let pos;
    if (o.state === "cuo") {
      pos = oxySite(i);
      bonds.push([cuAt[i], atoms.length]);            // Cu–O (자기 짝)
    } else {
      /* CO₂ 는 격자 «앞»(z = Z_OUT)에서 가로(x축)로 이룬다 — 섞인 격자 안에서 만들면
         이웃 원자를 뚫는다. 표면에서 기체가 빠져나와 앞을 지나 떠오르는 그림이다.
         짝수 산소는 왼쪽 자리, 홀수는 오른쪽 자리 — 두 비행 경로가 나란해 교차하지 않는다 */
      const from = oxySite(i), cp = cSite(o.cIdx), c = s.carbons[o.cIdx];
      const slot = (i % 2 === 0) ? -GEO.CO2_BOND : GEO.CO2_BOND;
      const tx = cp.x + slot, ty = cp.y + co2Rise(c, s.t);
      if (o.state === "transit") {
        const f = Math.min(1, Math.max(0, (s.t - o.born) / REDOX.FLIGHT));
        if (f < 0.18) {                               // ① 제자리에서 표면 앞으로 빠져나옴
          pos = { x: from.x, y: from.y, z: GEO.Z_FLY * (f / 0.18) };
        } else if (f < 0.82) {                        // ② 모든 것보다 앞에서 수평 이동
          const g = (f - 0.18) / 0.64;
          pos = { x: from.x + (tx - from.x) * g,
                  y: from.y + (ty - from.y) * g, z: GEO.Z_FLY };
        } else {                                      // ③ CO₂ 자리로 내려앉음
          const g = (f - 0.82) / 0.18;
          pos = { x: tx, y: ty, z: GEO.Z_FLY + (GEO.Z_OUT - GEO.Z_FLY) * g };
        }
      } else {                                        // co2 — 탄소에 결합해 함께 떠오른다
        pos = { x: tx, y: ty, z: GEO.Z_OUT };
        bonds.push([cAt[o.cIdx], atoms.length]);      // C–O
      }
    }
    oxyAt[i] = atoms.length;
    atoms.push({ el: "O", x: pos.x, y: pos.y, z: pos.z, i: i, state: o.state });
  }
  /* 여분 고리 — 화면 가장자리 너머로 이어지는 «계속되는 가루». 세는 대상이 아니라
     배경이므로 atoms 와 분리해 돌려준다(검사군 3·4는 앞줄 24·12만 센다).
     주변도 같은 반응을 하므로 p 에 따라 산소·탄소가 사라지고 구리만 남는다 */
  const back = [];
  for (let col = -GEO.RING; col < GEO.COLS + GEO.RING; col++) {
    for (let row = -GEO.RING; row < GEO.ROWS + GEO.RING; row++) {
      if (col >= 0 && col < GEO.COLS && row >= 0 && row < GEO.ROWS) continue;
      const ring = Math.max(-col, col - (GEO.COLS - 1), -row, row - (GEO.ROWS - 1));
      const dim = ring <= 1 ? 0.6 : 0.32;
      const done = cellReacted(col, row, s.p);
      const x0 = col * GEO.DX, y0 = row * GEO.DY;
      if (cellIsCarbon(col)) {
        if (!done) back.push({ el: "C", x: x0 + GEO.C_OFF, y: y0, z: 0, dim: dim });
      } else {
        back.push({ el: "Cu", x: x0, y: y0, z: 0, dim: dim });
        if (!done) back.push({ el: "O", x: x0 + GEO.CUO_OFF, y: y0, z: 0, dim: dim });
      }
    }
  }
  return { atoms: atoms, bonds: bonds, back: back };
}

/* 벌크 색 — 미시 화면의 «여백»은 흰 바탕이 아니라 지금 그 가루의 색이다(사용자 지시).
   거시 무대의 가루 색 전이와 같은 p 에서 유도한다(F-1) — 검은 산화물 → 구리 */
function bulkColor(p) {
  /* 완결 쪽(구리 벌크)을 구리 원자(#C88033)보다 충분히 어둡게 둔다 — 같은 색조라도
     명도가 갈려야 원자가 배경에서 떠오른다(프로브의 미시 대비 검사가 지킨다) */
  const a = [0.129, 0.122, 0.114], b = [0.212, 0.110, 0.062];
  const t = Math.min(1, Math.max(0, p));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* 단계 배지 — 전부 코어 값에서 유도 (J-N5: 화면 문구는 같은 화면 수치와 모순 금지) */
function redoxStage(s) {
  if (s.turb >= 1) return 6;                          // 완결
  if (s.absorbed > 0) return 5;                       // 석회수 흐려짐
  if (s.E > 0 && s.tubeArrivals.length > s.absorbed) return 4;  // 기체 이동
  if (s.p > 0) return 3;                              // 색 변화
  if (s.heat) return 2;                               // 가열 중
  return 1;                                           // 가열 전
}

/* 반응 개시 시각 해석해 — 검사군 1-⑸가 수치해와 대조한다 */
function redoxT1() {
  return REDOX.TAU_H *
    Math.log((REDOX.T_EQ - REDOX.T_AMB) / (REDOX.T_EQ - REDOX.T_START));
}

/* ================================================================
   마그네슘의 연소 — 탭2 계산부 (설계지시안_마그네슘연소_v1 v1.1 §3 단계 1)

   반응식  2Mg + O₂ → 2MgO                  (교과서 35쪽 반응식 박스)
   「마그네슘(Mg)은 전자를 잃어 마그네슘 이온(Mg²⁺)이 되고 산소(O)는 전자를
     얻어 산화 이온(O²⁻)이 되며, 두 이온이 결합하여 산화 마그네슘(MgO)이
     생성된다.」 (교과서 35쪽 본문 원문)

   모델
   ① 이벤트 단위 화학량론 — 1이벤트 = Mg 2개 + O₂ 1개 소비 = 전자 4개 이동
      (Mg 하나가 2개 잃고 O 하나가 2개 얻음) = MgO 2단위. 총 12이벤트
      (Mg 24 · O₂ 12, 화학량론 2:1).
   ② 점화 모형 — 토치 유지 중 T가 T_TORCH로 지수 수렴(§14 ③-1 오일러 금지).
      T≥T_IGN에서 개시. 개시 후에는 «자기 지속»(발열 산화 — 문헌 근거, 지시안
      §1-1 #10): 토치를 떼도 목표 T_BURN으로 완결까지 진행. 완결 후 냉각.
      ⚠ 온도·시간 상수는 전부 «임의 모형값»(실제 점화 온도 문헌값 ≈454~507 ℃
      와 다른 압축 연출값) — 화면에 숫자로 표시하지 않는다(지시안 추정 2).
   ③ 전자 48개를 «개별로» 추적한다. 미시 배치 함수 mgbLayout()이 렌더와 검증이
      함께 쓰는 단일 원천이다(원칙 11).
   ④ 동시성 카운터 두 원천 — 「마그네슘이 잃은 전자」는 mg 장부(lost 합),
      「산소가 얻은 전자」는 ⒜ mgbLayout()이 내는 O 입자 배열의 소유 상태(렌더
      원천)와 ⒝ oxy 장부, 두 축에서 독립적으로 센다(검사군 13 — P-검토 MF-1 ⑶).
      소유는 반응 사건 시점에 넘어간다(v1 §10 존치 결정과 같은 관례).
   ================================================================ */

const MGB = {
  N_MG: 24, N_O2: 12, EVENTS: 12,          // 화학량론 2:1 (교과서 35쪽 계수)
  E_PER_MG: 2, E_PER_EVENT: 4,             // Mg²⁺의 2+ = 전자 2개 잃음 (중2 선행)
  T_AMB: 20, T_TORCH: 1000, T_IGN: 600,    // 임의 모형값 — 화면 비표시
  T_BURN: 3000, TAU_H: 3, TAU_C: 6,
  K_P: 1 / 20,                             // 진행률/s — 개시 후 20 s 완결
  FLIGHT: 0.9,                             // 전자 비행 시간 s (미시)
  APPROACH: 1.8,                           // O₂ 접근→안착 시간 s (미시)
  M: { Mg: 24.305, O: 15.999 }             // 몰질량 g/mol (문헌값)
};

/* 미시 배치 기하 — 렌더·검사 공용 (원칙 13: 매직 넘버 금지 — 접촉 간격은
   반지름 합에서 유도). 좌측 Mg 금속 격자(4열×6행), 우측 공기 중 O₂ 분자(가로
   O=O, 2열×6행). 소비는 공기와 닿는 오른쪽 열부터 윗행 우선 — 표면부터 탄다. */
const GEO_MG = {
  R: { Mg: 1.0, O: 0.9, E: 0.28 },         // 공 반지름 (전자는 원자와 뚜렷이 작게 — 지시안 추정 3)
  COLS: 4, ROWS: 6,                        // Mg 격자 4×6 = 24
  DX: 2.2, DY: 2.2,                        // 격자 간격 (> 2×R.Mg — 겹침 0)
  O2_BOND: 1.85,                           // O=O 표시 간격 (> 2×R.O = 1.8)
  O2_X0: 12.6, O2_DX: 3.8, O2_DY: 2.2,     // O₂ 대기(공기) 영역 — 가로 분자 2열×6행
  Z_APPROACH: 4.0,                         // O₂ 이동 고도 (격자 앞·전자보다 뒤)
  Z_FLY: 6.0,                              // 전자 비행 고도 — 어느 것보다 앞
  E_OFF: { x: 0.5, y: 0.55, z: 0.7 }       // Mg 표면의 원자가 전자 2개 자리 (±y)
};
GEO_MG.MGO_Z = GEO_MG.R.Mg + GEO_MG.R.O;   // O²⁻ 안착 깊이 = 접촉 간격 (유도값 1.9)

/* Mg 자리 — i번째 원자. 오른쪽 열부터(공기 접촉면), 열 안에서는 윗행부터 소비 */
function mgSite(i) {
  const col = GEO_MG.COLS - 1 - Math.floor(i / GEO_MG.ROWS);
  const row = GEO_MG.ROWS - 1 - (i % GEO_MG.ROWS);
  return { x: col * GEO_MG.DX, y: row * GEO_MG.DY, z: 0 };
}
/* O₂ 분자 m의 대기(공기) 중심 자리 — 가로 분자, 2열×6행 */
function o2Home(m) {
  return {
    x: GEO_MG.O2_X0 + Math.floor(m / GEO_MG.ROWS) * GEO_MG.O2_DX,
    y: (m % GEO_MG.ROWS) * GEO_MG.O2_DY, z: 0
  };
}
/* O 원자 j(0~23)의 공기 중 자리 — 분자 m=⌊j/2⌋의 좌(짝수)/우(홀수) */
function oAirSite(j) {
  const h = o2Home(Math.floor(j / 2));
  const s = (j % 2 === 0) ? -GEO_MG.O2_BOND / 2 : GEO_MG.O2_BOND / 2;
  return { x: h.x + s, y: h.y, z: h.z };
}

function mgbInit() {
  const mg = [], oxy = [], elec = [];
  for (let i = 0; i < MGB.N_MG; i++)
    mg.push({ i: i, lost: 0, firedAt: NaN });          // 장부 ①: Mg가 잃은 전자
  for (let j = 0; j < 2 * MGB.N_O2; j++)
    oxy.push({ j: j, gained: 0, at: NaN });            // 장부 ②: O가 얻은 전자
  for (let k = 0; k < MGB.E_PER_MG * MGB.N_MG; k++)
    elec.push({ k: k, mgIdx: Math.floor(k / 2), oIdx: null, born: NaN });
  return {
    t: 0, T: MGB.T_AMB, torch: false, ignited: false, done: false,
    p: 0, E: 0, mg: mg, oxy: oxy, elec: elec
  };
}

/* 반응 이벤트 — Mg 2개가 전자를 2개씩 잃고(산화) O 2개가 2개씩 얻는다(환원).
   전자 k의 목적지: Mg(2e)의 전자 → O(2e), Mg(2e+1)의 전자 → O(2e+1). */
function mgbFireEvent(s) {
  const e = s.E;
  for (const i of [2 * e, 2 * e + 1]) {
    s.mg[i].lost = MGB.E_PER_MG; s.mg[i].firedAt = s.t;
    s.oxy[i].gained = MGB.E_PER_MG; s.oxy[i].at = s.t;
    for (const k of [2 * i, 2 * i + 1]) {
      s.elec[k].oIdx = i; s.elec[k].born = s.t;
    }
  }
  s.E = e + 1;
}

function mgbStep(s, dt) {
  const target = s.ignited && !s.done ? MGB.T_BURN
    : (s.torch && !s.done ? MGB.T_TORCH : MGB.T_AMB);
  const tau = target > s.T ? MGB.TAU_H : MGB.TAU_C;
  s.T = target + (s.T - target) * Math.exp(-dt / tau);   // 지수 해 (§14 ③-1)
  if (!s.ignited && s.T >= MGB.T_IGN) s.ignited = true;
  if (s.ignited && s.p < 1) s.p = Math.min(1, s.p + MGB.K_P * dt);
  const eTarget = Math.floor(s.p * MGB.EVENTS + 1e-9);
  while (s.E < eTarget) mgbFireEvent(s);
  if (s.p >= 1 && !s.done) s.done = true;
  s.t += dt;
  return s;
}

/* ── 동시성 카운터 — 서로 다른 원천에서 독립적으로 센다 (검사군 13·화면 공용) ── */
function mgbLostByMg(s) {
  let n = 0;
  for (let i = 0; i < s.mg.length; i++) n += s.mg[i].lost;
  return n;
}
function mgbGainedByO(s) {
  let n = 0;
  for (let j = 0; j < s.oxy.length; j++) n += s.oxy[j].gained;
  return n;
}
function mgbCounts(s) {
  return {
    mgLeft: MGB.N_MG - 2 * s.E, o2Left: MGB.N_O2 - s.E,
    mgIon: 2 * s.E, oIon: 2 * s.E, mgo: 2 * s.E,
    lost: mgbLostByMg(s), gained: mgbGainedByO(s)
  };
}

/* 빛 — 연소 중에만 1 (개시 전 0·완결 후 0). 세기 연출은 FX가 이 값을 평활한다 */
function mgbLight(s) { return s.ignited && s.p < 1 ? 1 : 0; }

/* ── 미시 배치 — 렌더와 검사가 함께 쓰는 단일 원천 (원칙 11) ──
   반환: { atoms: [{el:'Mg'|'O'|'E', x,y,z, …}], pairs: [[a,b,kind]] }
   pairs 는 «허용 접촉»(겹침 검사 면제)이자 표시선의 근거다:
     kind 'o2'  = O=O 분자 표시 (공기 중·접근 초반)
     kind 'mgo' = Mg²⁺–O²⁻ 이온쌍 «인접» (막대를 그리지 않는다 — §5-7 접촉 배열)
     kind 'eat' = 전자가 원자에 붙어 있음 (자기 원자와의 접촉 면제) */
function mgbLayout(s) {
  const atoms = [], pairs = [];
  const mgAt = new Array(MGB.N_MG), oAt = new Array(2 * MGB.N_O2);
  for (let i = 0; i < MGB.N_MG; i++) {
    const p = mgSite(i);
    mgAt[i] = atoms.length;
    atoms.push({ el: "Mg", x: p.x, y: p.y, z: p.z, i: i, ion: s.mg[i].lost > 0 });
  }
  for (let j = 0; j < 2 * MGB.N_O2; j++) {
    const o = s.oxy[j];
    let pos, phase;
    if (o.gained === 0) {
      pos = oAirSite(j); phase = "air";
    } else {
      /* 분자는 «강체»로 난다 — 두 O를 각자 선형 보간하면 중간에서 간격이 1.85→1.31로
         수렴해 겹친다(검사군 15-1이 잡은 실측). 분자 중심이 경로를 날고, 방향만
         가로(공기) → 세로(표적 Mg 쌍)로 회전한다: 간격은 내내 O2_BOND 그대로다. */
      const mp = mgSite(j);
      const tgt = { x: mp.x, y: mp.y, z: GEO_MG.MGO_Z };   // 자기 Mg²⁺ 바로 앞(접촉)
      const m = Math.floor(j / 2), h = o2Home(m), mpp = mgSite(j ^ 1);
      const cen = { x: mp.x, y: (mp.y + mpp.y) / 2 };      // 표적 Mg 쌍의 중앙
      const sSign = (j % 2 === 0) ? -1 : 1;                // 공기 중 좌/우
      const tSign = mp.y > mpp.y ? 1 : -1;                 // 표적이 위/아래
      const half = GEO_MG.O2_BOND / 2;
      const f = Math.min(1, Math.max(0, (s.t - o.at) / MGB.APPROACH));
      if (f >= 1) {
        pos = tgt; phase = "bound";
      } else if (f < 0.22) {                    // ① 제자리에서 이동 고도로
        pos = { x: h.x + sSign * half, y: h.y, z: GEO_MG.Z_APPROACH * (f / 0.22) };
        phase = "approach";
      } else if (f < 0.78) {                    // ② 고도에서 중심 이동 + 강체 회전
        const g = (f - 0.22) / 0.56, th = g * Math.PI / 2;
        const cx = h.x + (cen.x - h.x) * g, cy = h.y + (cen.y - h.y) * g;
        pos = { x: cx + sSign * half * Math.cos(th),
                y: cy + tSign * half * Math.sin(th), z: GEO_MG.Z_APPROACH };
        phase = "approach";
      } else {                                  // ③ 갈라지며 자기 Mg²⁺ 앞으로 내려앉음
        const g = (f - 0.78) / 0.22;
        const y0 = cen.y + tSign * half;
        pos = { x: tgt.x, y: y0 + (tgt.y - y0) * g,
                z: GEO_MG.Z_APPROACH + (GEO_MG.MGO_Z - GEO_MG.Z_APPROACH) * g };
        phase = "approach";
      }
    }
    oAt[j] = atoms.length;
    atoms.push({ el: "O", x: pos.x, y: pos.y, z: pos.z, j: j,
                 phase: phase, ion: o.gained > 0 });
  }
  /* O=O 표시 — 공기 중 + 전자가 도착하기 전(f<0.5·비행 0.9 s = 접근의 절반)까지.
     전자를 얻어 O²⁻가 되면 분자 표시를 끊는다. 강체 회전이라 표시 여부와 무관하게
     기하 간격은 내내 O2_BOND(1.85 > R합 1.8)다 — 겹침 검사에 면제가 필요 없다 */
  for (let m = 0; m < MGB.N_O2; m++) {
    const a = s.oxy[2 * m], b = s.oxy[2 * m + 1];
    const preSplit = t0 => !isFinite(t0) || (s.t - t0) / MGB.APPROACH < 0.5;
    if (a.gained === 0 && b.gained === 0) pairs.push([oAt[2 * m], oAt[2 * m + 1], "o2"]);
    else if (preSplit(a.at) && preSplit(b.at)) pairs.push([oAt[2 * m], oAt[2 * m + 1], "o2"]);
  }
  /* MgO 이온쌍 «인접» — 안착 완료(bound)만. 막대가 아니라 접촉의 표식이다 */
  for (let j = 0; j < 2 * MGB.N_O2; j++)
    if (atoms[oAt[j]].phase === "bound") pairs.push([mgAt[j], oAt[j], "mgo"]);
  /* 전자 — Mg 표면(원자가 전자 2개) → 비행 → O 표면. 상태는 배열이 원천(검사군 12) */
  for (let k = 0; k < s.elec.length; k++) {
    const e = s.elec[k], i = e.mgIdx, sy = (k % 2 === 0) ? 1 : -1;
    let pos, state, host = null;
    if (e.oIdx === null) {
      const p = mgSite(i);
      pos = { x: p.x + GEO_MG.E_OFF.x, y: p.y + sy * GEO_MG.E_OFF.y, z: p.z + GEO_MG.E_OFF.z };
      state = "mg"; host = mgAt[i];
    } else {
      const f = Math.min(1, Math.max(0, (s.t - e.born) / MGB.FLIGHT));
      const oa = atoms[oAt[e.oIdx]];
      const to = { x: oa.x + 0.4, y: oa.y + sy * 0.5, z: oa.z + 0.6 };
      if (f >= 1) { pos = to; state = "o"; host = oAt[e.oIdx]; }
      else {
        const p = mgSite(i);
        const fr = { x: p.x + GEO_MG.E_OFF.x, y: p.y + sy * GEO_MG.E_OFF.y, z: p.z + GEO_MG.E_OFF.z };
        /* 비행은 모든 것보다 앞(Z_FLY)에서 — 위상 3분할(이탈·수평·안착) */
        if (f < 0.2) pos = { x: fr.x, y: fr.y, z: fr.z + (GEO_MG.Z_FLY - fr.z) * (f / 0.2) };
        else if (f < 0.8) {
          const g = (f - 0.2) / 0.6;
          pos = { x: fr.x + (to.x - fr.x) * g, y: fr.y + (to.y - fr.y) * g, z: GEO_MG.Z_FLY };
        } else pos = { x: to.x, y: to.y, z: GEO_MG.Z_FLY + (to.z - GEO_MG.Z_FLY) * ((f - 0.8) / 0.2) };
        state = "flight";
      }
    }
    const idx = atoms.length;
    atoms.push({ el: "E", x: pos.x, y: pos.y, z: pos.z, k: k, state: state });
    if (host !== null) pairs.push([host, idx, "eat"]);
    /* 비행 중에는 출발 Mg를 «떠나는» 순간과 목표 O에 «내려앉는» 순간의 접촉이
       필연이다 — 두 끝점과의 접촉만 면제한다(그 외 원자와의 겹침은 그대로 검사) */
    if (state === "flight") {
      pairs.push([mgAt[i], idx, "eat"]);
      if (e.oIdx !== null) pairs.push([oAt[e.oIdx], idx, "eat"]);
    }
  }
  return { atoms: atoms, pairs: pairs };
}

/* 탭2 미시 배경 — Mg 금속 벌크(은회색) → MgO 흰 배열(명도 상한 RGB≤235: 지시안
   추정 6 — 전자·기호 대비 확보). 거시 재 축적과 같은 p에서 유도(F-1) */
function mgbBulkColor(p) {
  const a = [0.788, 0.812, 0.831], b = [0.906, 0.886, 0.851]; // #C9CFD4 → #E7E2D9
  const t = Math.min(1, Math.max(0, p));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* 단계 배지 — 전부 코어 값에서 유도 (J-N5). 0.5는 「흰 재가 눈에 띄게 쌓인」
   경계의 임의 모형값이다 */
function mgbStage(s) {
  if (s.p >= 1) return 5;                   // 완결
  if (s.ignited && s.p >= 0.5) return 4;    // 흰 재
  if (s.ignited) return 3;                  // 연소 — 밝은 빛
  if (s.torch) return 2;                    // 점화
  return 1;                                 // 점화 전
}

/* 점화 시각 해석해 — 검사군 11-⑸가 수치해와 대조한다 */
function mgbT1() {
  return MGB.TAU_H *
    Math.log((MGB.T_TORCH - MGB.T_AMB) / (MGB.T_TORCH - MGB.T_IGN));
}

/* ================================================================
   실험 등록 표 — 탭·배지·학생에게 닿는 문자열의 «단일 원천» (F-1 · P-검토 A-2).
   3번째 실험은 여기 항목 추가 + UI부 씬 빌더 연결만으로 성립해야 한다(확장 대비 —
   사용자 확정 4). 검사군 16이 이 표를 재귀 순회한다: id 'cuo' 항목의 문자열에는
   「전자」·「이온」이 없어야 한다(X-1 ⒝ — 로드맵 「산소 먼저」).
   ⚠ 씬 빌더·상태 연결은 UI부(마커 아래)에서 이 표를 참조해 배선한다 —
   여기는 데이터만 둔다(node 검사가 화면 없이 순회할 수 있어야 한다). */
const EXPERIMENTS_DATA = [
  {
    id: "cuo",
    tab: "1. 산화 구리(Ⅱ) 실험",
    sub: "검은 산화 구리(Ⅱ)와 탄소 가루를 섞어 가열한다. 산소는 구리를 떠나 탄소에게 간다 —\n      산소를 <b>잃는</b> 환원과 산소를 <b>얻는</b> 산화가 <b>항상 동시에</b> 일어나는 것을 눈으로 확인해 보자.",
    stages: ["", "① 가열 전", "② 가열 중", "③ 색 변화", "④ 기체 이동", "⑤ 석회수 흐려짐", "⑥ 완결"],
    chips: [
      { cls: "mh-red", sw: "#C88033", html: "구리는 산소를 <b>잃는다</b> = 환원" },
      { cls: "mh-ox", sw: "#404040", html: "탄소는 산소를 <b>얻는다</b> = 산화" }
    ],
    chipsDone: [
      { cls: "mh-red", sw: "#C88033", html: "구리 — 산소를 모두 <b>잃었다</b> (환원)" },
      { cls: "mh-ox", sw: "#404040", html: "탄소 — 산소를 <b>얻어</b> 떠났다 (산화)" }
    ],
    counterLabels: ["구리가 잃은 산소", "탄소가 얻은 산소"],
    concHtml: "산화가 있으면 환원이 반드시 있다 — 지금 잃은 산소 <span id=\"concL\">0</span>개 = 얻은 산소 <span id=\"concG\">0</span>개",
    heatBtnOn: "알코올램프 켜기", heatBtnOff: "알코올램프 끄기",
    heatNote: "가열해야 반응이 일어납니다. 램프를 켠 채 지켜보세요 — 램프를 끄면 잠시 뒤 반응도 멈춥니다.",
    trace: {
      none: "산소 원자를 누르면 그 원자를 따라갑니다.",
      wait: "선택한 산소 — 아직 산화 구리(Ⅱ) 안에 있습니다. 가열하면 떠나는 순간을 볼 수 있어요.",
      move: "선택한 산소 — 구리를 떠나(구리: 환원) 탄소에게 가는 중(탄소: 산화)입니다.",
      done: "선택한 산소 — 구리를 떠나(구리: 환원) 탄소에 붙어(탄소: 산화) 이산화 탄소가 되었습니다. 같은 원자가 두 사건의 주인공입니다."
    },
    ariaMacro: "산화 구리(Ⅱ)와 탄소 혼합 가루가 든 시험관을 스탠드에 고정하고 알코올램프로 가열하는 장치. 발생한 기체는 고무관을 지나 석회수가 든 비커로 갑니다.",
    ariaMicro: "시험관 속을 입자 크기로 확대한 모식 그림. 왼쪽 산화 구리(Ⅱ) 배열에서 산소가 떠나 오른쪽 탄소에 붙어 이산화 탄소가 되어 떠오릅니다. 산소 원자를 누르면 그 원자의 이동을 따라갑니다."
  },
  {
    id: "mgburn",
    tab: "2. 마그네슘의 연소",
    sub: "마그네슘 리본에 불을 붙이면 밝은 빛을 내며 타고 흰색 산화 마그네슘이 남는다.\n      산소와 결합하는 그 이면에서 — 마그네슘은 전자를 <b>잃고</b>(산화) 산소는 전자를 <b>얻는다</b>(환원)는 것을 눈으로 확인해 보자.",
    stages: ["", "① 점화 전", "② 점화", "③ 연소 — 밝은 빛", "④ 흰 재", "⑤ 완결"],
    chips: [
      { cls: "mh-red", sw: "#8AFF00", html: "마그네슘은 전자를 <b>잃는다</b> = 산화" },
      { cls: "mh-ox", sw: "#FF0D0D", html: "산소는 전자를 <b>얻는다</b> = 환원" }
    ],
    chipsDone: [
      { cls: "mh-red", sw: "#8AFF00", html: "마그네슘 — 전자를 모두 <b>잃었다</b> (산화)" },
      { cls: "mh-ox", sw: "#FF0D0D", html: "산소 — 전자를 <b>얻어</b> 산화 이온이 되었다 (환원)" }
    ],
    counterLabels: ["마그네슘이 잃은 전자", "산소가 얻은 전자"],
    concHtml: "전자를 잃으면 산화, 얻으면 환원 — 지금 잃은 전자 <span id=\"concLMg\">0</span>개 = 얻은 전자 <span id=\"concGMg\">0</span>개",
    heatBtnOn: "마그네슘에 불 붙이기", heatBtnOff: "연소 중…",
    heatBtnLighting: "점화 중…", heatBtnDone: "연소 완료 — 「처음부터」로 다시",
    heatNote: "한번 불이 붙으면 끌 수 없습니다 — 마그네슘은 스스로 계속 탑니다. 산화 구리(Ⅱ) 실험과 비교해 보세요.",
    trace: {
      none: "전자(⊖)를 누르면 그 전자를 따라갑니다.",
      wait: "선택한 전자 — 아직 마그네슘 원자에 있습니다. 불을 붙이면 떠나는 순간을 볼 수 있어요.",
      move: "선택한 전자 — 마그네슘을 떠나(마그네슘: 산화) 산소에게 가는 중(산소: 환원)입니다.",
      done: "선택한 전자 — 마그네슘을 떠나(마그네슘: 산화) 산소에 도착해(산소: 환원) 산화 이온의 일부가 되었습니다. 같은 전자가 두 사건의 주인공입니다."
    },
    ariaMacro: "접시 위 마그네슘 리본에 점화기로 불을 붙이는 장치. 리본이 밝은 빛을 내며 타고 흰색 산화 마그네슘이 남습니다.",
    ariaMicro: "마그네슘 조각과 공기 속 산소를 입자 크기로 확대한 모식 그림. 마그네슘이 전자를 잃어 마그네슘 이온이 되고 산소가 전자를 얻어 산화 이온이 되며, 두 이온이 결합해 산화 마그네슘이 됩니다. 전자를 누르면 그 전자의 이동을 따라갑니다."
  }
];

/* ================= UI + WebGL ================= */
/* ↑ 위쪽(계산부)은 화면과 무관하다. 검증 스크립트가 이 주석줄을 기준으로 잘라
   Node 에서 그대로 돌린다. 이 줄을 지우거나 바꾸지 말 것. */

/* ================= Codex FX 모듈 (조달: Codex 플러그인 2026-08-27 · 원본 보존:
   검증스크립트/_redox_fx/redox_fx.part.orig.js · 통합 보정 ①~③은 코드 내 주석) ==== */
(function (root) {
  "use strict";

  var MAX_FLAME_PARTICLES = 200;
  var MAX_BUBBLES = 60;
  var MAX_POWDER_PARTICLES = 600;

  function clamp01(value) {
    value = Number(value);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function limitedCount(value, fallback, maximum) {
    var count = value == null ? fallback : Math.floor(Number(value));
    if (!Number.isFinite(count)) count = fallback;
    return Math.max(1, Math.min(maximum, count));
  }

  function seededRandom(seed) {
    var state = (Number(seed) || 123456789) >>> 0;
    return function () {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function setGroupPosition(group, position) {
    if (!position) return;
    if (Array.isArray(position)) {
      group.position.set(Number(position[0]) || 0, Number(position[1]) || 0, Number(position[2]) || 0);
    } else if (position.isVector3) {
      group.position.copy(position);
    }
  }

  function makeFlame(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var count = limitedCount(opts.count, 128, MAX_FLAME_PARTICLES);
    var random = seededRandom(opts.seed == null ? 91021 : opts.seed);
    var positions = new Float32Array(count * 3);
    var seeds = new Float32Array(count * 2);
    var sizes = new Float32Array(count);
    var i;

    for (i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.5) * 0.34;
      positions[i * 3 + 1] = random();
      positions[i * 3 + 2] = (random() - 0.5) * 0.22;
      seeds[i * 2] = random();
      seeds[i * 2 + 1] = random();
      sizes[i] = 9 + random() * 18;
    }

    var timeUniform = { value: 0 };
    var onUniform = { value: 0 };
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 2));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    var particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uOn: onUniform,
        uHeight: { value: Number(opts.height) || 1.45 }
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uOn;",
        "uniform float uHeight;",
        "attribute vec2 aSeed;",
        "attribute float aSize;",
        "varying float vLife;",
        "varying float vHeat;",
        "void main() {",
        "  float life = fract(position.y + uTime * (0.55 + aSeed.x * 0.62) + aSeed.y);",
        "  vec3 p = position;",
        "  p.y = life * uHeight;",
        "  float taper = 1.0 - life;",
        "  p.x = p.x * (0.28 + taper * 0.9) + sin(uTime * 7.0 + aSeed.x * 31.0 + life * 9.0) * 0.07 * life;",
        "  p.z = p.z * (0.25 + taper * 0.8) + cos(uTime * 5.0 + aSeed.y * 27.0) * 0.035 * life;",
        "  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mvPosition;",
        "  gl_PointSize = aSize * (18.0 / max(1.0, -mvPosition.z)) * (0.3 + 0.7 * uOn) * (0.35 + taper);",
        "  vLife = life;",
        "  vHeat = aSeed.x;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uOn;",
        "varying float vLife;",
        "varying float vHeat;",
        "void main() {",
        "  vec2 q = gl_PointCoord - vec2(0.5);",
        "  float r = length(q) * 2.0;",
        "  if (r > 1.0) discard;",
        "  float soft = 1.0 - smoothstep(0.15, 1.0, r);",
        "  float fade = smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.62, 1.0, vLife));",
        "  vec3 hot = vec3(1.0, 0.88, 0.28);",
        "  vec3 warm = vec3(1.0, 0.19, 0.015);",
        "  vec3 color = mix(hot, warm, clamp(vLife * 0.92 + vHeat * 0.16, 0.0, 1.0));",
        "  gl_FragColor = vec4(color, soft * fade * uOn * 0.82);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending  /* [통합 보정 ②] 밝은 무대(흰 배경 §5)에서 가산 혼합은 흰색으로 소실된다 */
    });

    var particles = new THREE.Points(geometry, particleMaterial);
    particles.frustumCulled = false;
    particles.renderOrder = 4;
    group.add(particles);

    var coreGeometry = new THREE.SphereGeometry(0.5, 16, 20);
    coreGeometry.translate(0, 0.5, 0);
    var coreMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uOn: onUniform
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uOn;",
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  vec3 p = position;",
        "  float taper = 1.0 - clamp(p.y, 0.0, 1.0);",
        "  p.x *= 0.42 + taper * 0.32;",
        "  p.z *= 0.34 + taper * 0.28;",
        "  p.x += sin(uTime * 8.0 + p.y * 9.0) * 0.075 * p.y * uOn;",
        "  p.y *= 1.45;",
        "  p.y *= 0.35 + 0.65 * uOn;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uOn;",
        "varying vec2 vUv;",
        "void main() {",
        "  float edge = abs(vUv.x - 0.5) * 2.0;",
        "  float body = 1.0 - smoothstep(0.56, 0.98, edge);",
        "  float tip = 1.0 - smoothstep(0.73, 1.0, vUv.y);",
        "  float flicker = 0.91 + 0.09 * sin(uTime * 13.0 + vUv.y * 18.0);",
        "  vec3 color = mix(vec3(1.0, 0.92, 0.34), vec3(1.0, 0.12, 0.01), smoothstep(0.05, 0.88, vUv.y));",
        "  gl_FragColor = vec4(color, body * tip * flicker * uOn * 0.72);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending  /* [통합 보정 ②] 밝은 무대(흰 배경 §5)에서 가산 혼합은 흰색으로 소실된다 */,
      side: THREE.DoubleSide
    });

    var core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.renderOrder = 3;
    group.add(core);
    setGroupPosition(group, opts.position);

    var currentOn = 0;
    var lastTime = 0;
    var hasTime = false;

    function update(t, state) {
      var time = Number(t);
      if (!Number.isFinite(time)) time = 0;
      var target = clamp01(state && state.on);
      var dt = hasTime ? Math.max(0, Math.min(0.1, time - lastTime)) : 1 / 60;
      hasTime = true;
      lastTime = time;
      currentOn += (target - currentOn) * (1 - Math.exp(-7.5 * dt));
      if (currentOn < 0.0005 && target === 0) currentOn = 0;
      /* [S-검토 재검 A] prefers-reduced-motion: «장식 흔들림»만 멈춘다. 평활기의 dt 는
         실제 시간으로 계속 돌아야 점화·탁도가 목표에 도달한다 */
      timeUniform.value = (state && state.rm) ? 8 : time;
      onUniform.value = currentOn;
      group.visible = currentOn > 0.0001;
    }

    return { group: group, update: update };
  }

  function makeBubbles(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var count = limitedCount(opts.count, 42, MAX_BUBBLES);
    var height = Math.max(0.2, Number(opts.height) || 2.25);
    var radius = Math.max(0.05, Number(opts.radius) || 0.62);
    var random = seededRandom(opts.seed == null ? 42057 : opts.seed);
    var positions = new Float32Array(count * 3);
    var seeds = new Float32Array(count);
    var sizes = new Float32Array(count);
    var orders = new Float32Array(count);
    var i;

    for (i = 0; i < count; i += 1) {
      var angle = random() * Math.PI * 2;
      var radial = Math.sqrt(random()) * radius * 0.82;
      positions[i * 3] = Math.cos(angle) * radial;
      positions[i * 3 + 1] = random();
      positions[i * 3 + 2] = Math.sin(angle) * radial;
      seeds[i] = random();
      sizes[i] = 7 + random() * 13;
      orders[i] = (i + 0.5) / count;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aOrder", new THREE.BufferAttribute(orders, 1));

    var timeUniform = { value: 0 };
    var rateUniform = { value: 0 };
    var material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uRate: rateUniform,
        uHeight: { value: height }
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uRate;",
        "uniform float uHeight;",
        "attribute float aSeed;",
        "attribute float aSize;",
        "attribute float aOrder;",
        "varying float vActive;",
        "varying float vSeed;",
        "void main() {",
        "  float speed = (0.13 + uRate * 0.38) * (0.72 + aSeed * 0.64);",
        "  float cycle = fract(position.y + uTime * speed + aSeed * 1.37);",
        "  vec3 p = position;",
        "  p.y = (cycle - 0.5) * uHeight;",
        "  p.x += sin(uTime * 2.4 + aSeed * 37.0 + cycle * 7.0) * 0.045;",
        "  p.z += cos(uTime * 1.9 + aSeed * 29.0 + cycle * 5.0) * 0.035;",
        "  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mvPosition;",
        "  gl_PointSize = aSize * (18.0 / max(1.0, -mvPosition.z));",
        "  vActive = smoothstep(aOrder, aOrder + 0.11, uRate) * smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.88, 1.0, cycle));",
        "  vSeed = aSeed;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vActive;",
        "varying float vSeed;",
        "void main() {",
        "  vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;",
        "  float r = length(q);",
        "  if (r > 1.0 || vActive <= 0.001) discard;",
        "  float outer = 1.0 - smoothstep(0.82, 1.0, r);",
        "  float inner = 1.0 - smoothstep(0.56, 0.76, r);",
        "  float rim = max(0.0, outer - inner);",
        "  float highlight = 1.0 - smoothstep(0.0, 0.22, length(q - vec2(-0.34, 0.32)));",
        "  float fill = (1.0 - r) * 0.1;",
        "  vec3 color = mix(vec3(0.80, 0.82, 0.84), vec3(0.96, 1.0, 1.0), highlight);",
        "  gl_FragColor = vec4(color, (rim * 0.74 + highlight * 0.48 + fill) * vActive * (0.82 + vSeed * 0.18));",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false
    });

    var points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 6;
    group.add(points);
    setGroupPosition(group, opts.position);

    var currentRate = 0;
    var lastTime = 0;
    var hasTime = false;

    function update(t, state) {
      var time = Number(t);
      if (!Number.isFinite(time)) time = 0;
      var target = clamp01(state && state.rate);
      var dt = hasTime ? Math.max(0, Math.min(0.1, time - lastTime)) : 1 / 60;
      hasTime = true;
      lastTime = time;
      currentRate += (target - currentRate) * (1 - Math.exp(-4.5 * dt));
      if (currentRate < 0.0005 && target === 0) currentRate = 0;
      /* [S-검토 재검 A] prefers-reduced-motion: «장식 흔들림»만 멈춘다. 평활기의 dt 는
         실제 시간으로 계속 돌아야 점화·탁도가 목표에 도달한다 */
      timeUniform.value = (state && state.rm) ? 8 : time;
      rateUniform.value = currentRate;
      group.visible = currentRate > 0.0001;
    }

    return { group: group, update: update };
  }

  function makePowder(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var count = limitedCount(opts.count, 520, MAX_POWDER_PARTICLES);
    var length = Math.max(0.4, Number(opts.length) || 3.7);
    var width = Math.max(0.08, Number(opts.width) || 0.64);
    var height = Math.max(0.04, Number(opts.height) || 0.28);
    var random = seededRandom(opts.seed == null ? 73191 : opts.seed);
    var geometry = new THREE.IcosahedronGeometry(0.055, 0);
    var material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.08
    });  /* [통합 보정 ①] vertexColors:true 제거 — r147에서 지오메트리에 색 속성이 없으면
           정점색이 (0,0,0)으로 남아 인스턴스색과 곱해져 가루가 항상 검게 그려진다 */
    var mesh = new THREE.InstancedMesh(geometry, material, count);
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    var black = new THREE.Color(opts.unreactedColor == null ? 0x181716 : opts.unreactedColor);
    var copper = new THREE.Color(opts.reactedColor == null ? 0xb87333 : opts.reactedColor);
    var reactionOrder = new Float32Array(count);
    var brightness = new Float32Array(count);
    var heatFromRight = opts.heatFrom === "right";
    var i;

    for (i = 0; i < count; i += 1) {
      var x = (random() - 0.5) * length;
      var xUnit = x / length + 0.5;
      var endTaper = Math.sqrt(Math.max(0.04, 1 - Math.pow(xUnit * 2 - 1, 2)));
      var localHalfWidth = width * 0.5 * endTaper;
      var z = (random() - 0.5) * localHalfWidth * 2;
      var crown = Math.max(0.08, 1 - Math.abs(z) / Math.max(0.001, localHalfWidth));
      var y = -height * 0.53 + random() * height * crown;
      var scale = 0.62 + random() * 0.9;

      dummy.position.set(x, y, z);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      dummy.scale.set(scale * (0.72 + random() * 0.55), scale * (0.62 + random() * 0.42), scale * (0.72 + random() * 0.55));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      reactionOrder[i] = Math.max(0.025, Math.min(0.975, (heatFromRight ? 1 - xUnit : xUnit) + (random() - 0.5) * 0.055));
      brightness[i] = 0.72 + random() * 0.38;
      color.setRGB(black.r * brightness[i], black.g * brightness[i], black.b * brightness[i]).convertSRGBToLinear(); /* [통합 보정 ③] setColorAt은 색공간 변환이 없어 sRGB 출력에서 떠 보인다 */
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    setGroupPosition(group, opts.position);

    var lastFront = -1;

    function update(t, state) {
      var front = clamp01(state && state.front);
      if (Math.abs(front - lastFront) < 0.0005) return;
      lastFront = front;

      for (i = 0; i < count; i += 1) {
        var reacted = Math.max(0, Math.min(1, (front - reactionOrder[i] + 0.045) / 0.09));
        reacted = reacted * reacted * (3 - 2 * reacted);
        var glow = brightness[i] * (0.92 + reacted * 0.1);
        color.setRGB(
          (black.r + (copper.r - black.r) * reacted) * glow,
          (black.g + (copper.g - black.g) * reacted) * glow,
          (black.b + (copper.b - black.b) * reacted) * glow
        );
        color.convertSRGBToLinear(); /* [통합 보정 ③] */
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    return { group: group, update: update };
  }

  function makeTurbidity(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var radius = Math.max(0.05, Number(opts.radius) || 0.72);
    var height = Math.max(0.15, Number(opts.height) || 2.35);
    var geometry = new THREE.CylinderGeometry(radius, radius, height, 40, 4, false);
    var timeUniform = { value: 0 };
    var turbUniform = { value: 0 };
    var material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uTurb: turbUniform
      },
      vertexShader: [
        "varying vec3 vPosition;",
        "varying vec3 vNormal;",
        "void main() {",
        "  vPosition = position;",
        "  vNormal = normalize(normalMatrix * normal);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uTurb;",
        "varying vec3 vPosition;",
        "varying vec3 vNormal;",
        "void main() {",
        "  float n1 = sin(vPosition.x * 19.0 + vPosition.y * 7.0 + uTime * 0.34);",
        "  float n2 = sin(vPosition.z * 23.0 - vPosition.y * 11.0 - uTime * 0.27);",
        "  float cloud = 0.5 + 0.25 * n1 + 0.25 * n2;",
        "  cloud = smoothstep(0.12, 0.9, cloud);",
        "  float facing = 0.72 + 0.28 * abs(vNormal.z);",
        "  vec3 clearColor = vec3(0.50, 0.55, 0.59);",   /* [S-검토 재검 B-6/A-4] 맑은 액체는 «보이되» 뿌연 상태와 확실히 갈리도록 어둡게 */
        "  vec3 milkColor = vec3(0.94, 0.95, 0.96);",   /* [S-검토 A-4] 순백 무대에 수렴하지 않으면서 맑은 상태와 명도차를 크게 */
        "  vec3 color = mix(clearColor, milkColor, uTurb * (0.78 + cloud * 0.22));",
        "  float alpha = mix(0.30, 0.99, uTurb) * facing + cloud * uTurb * 0.08;",   /* [B-6] 맑아도 액면이 남고 [A-4] 변화폭은 되찾는다 */
        "  gl_FragColor = vec4(color, alpha);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    var liquid = new THREE.Mesh(geometry, material);
    liquid.renderOrder = 2;
    group.add(liquid);
    setGroupPosition(group, opts.position);

    var currentTurb = 0;
    var lastTime = 0;
    var hasTime = false;

    function update(t, state) {
      var time = Number(t);
      if (!Number.isFinite(time)) time = 0;
      var target = clamp01(state && state.turb);
      var dt = hasTime ? Math.max(0, Math.min(0.1, time - lastTime)) : 1 / 60;
      hasTime = true;
      lastTime = time;
      currentTurb += (target - currentTurb) * (1 - Math.exp(-3.2 * dt));
      if (currentTurb < 0.0005 && target === 0) currentTurb = 0;
      /* [S-검토 재검 A] prefers-reduced-motion: «장식 흔들림»만 멈춘다. 평활기의 dt 는
         실제 시간으로 계속 돌아야 점화·탁도가 목표에 도달한다 */
      timeUniform.value = (state && state.rm) ? 8 : time;
      turbUniform.value = currentTurb;
    }

    return { group: group, update: update };
  }

  root.REDOX_FX = Object.freeze({
    makeFlame: makeFlame,
    makeBubbles: makeBubbles,
    makePowder: makePowder,
    makeTurbidity: makeTurbidity
  });
}(window));

/* ================= Codex FX 모듈 — 마그네슘 연소 (조달: Codex 플러그인 2026-08-28 ·
   원본 보존: 검증스크립트/_redox_fx/redox_mgfx.part.orig.js · 통합 보정 ①(GLSL 예약어)은
   코드 내 주석 · 발주서: _redox_fx/발주_마그네슘FX_v1.md · REDOX_MGFX «별도 동결 객체» —
   기존 REDOX_FX 동결 객체에 대입하지 않는다(P-검토 A-1) ==== */
(function (root) {
  "use strict";

  var MAX_FLAME_PARTICLES = 180;
  var MAX_ASH_PARTICLES = 360;
  var MAX_SMOKE_PARTICLES = 140;
  var TAU = Math.PI * 2;

  function clamp01(value) {
    value = Number(value);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function finiteOr(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function limitedCount(value, fallback, maximum) {
    var count = value == null ? fallback : Math.floor(Number(value));
    if (!Number.isFinite(count)) count = fallback;
    return Math.max(1, Math.min(maximum, count));
  }

  function seededRandom(seed) {
    var value = (Number(seed) || 2463534242) >>> 0;
    return function () {
      value = (1664525 * value + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function setGroupPosition(group, position) {
    if (!position) return;
    if (Array.isArray(position)) {
      group.position.set(finiteOr(position[0], 0), finiteOr(position[1], 0), finiteOr(position[2], 0));
    } else if (position.isVector3) {
      group.position.copy(position);
    }
  }

  function frameDelta(time, clock) {
    var dt = clock.ready ? Math.max(0, Math.min(0.1, time - clock.last)) : 1 / 60;
    clock.ready = true;
    clock.last = time;
    return dt;
  }

  function follow(current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  function makeRadialMaterial(THREE, color) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0 }
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor;",
        "uniform float uOpacity;",
        "varying vec2 vUv;",
        "void main() {",
        "  float r = length((vUv - vec2(0.5)) * 2.0);",
        "  if (r >= 1.0) discard;",
        "  float halo = pow(1.0 - smoothstep(0.04, 1.0, r), 2.2);",
        "  gl_FragColor = vec4(uColor, halo * uOpacity);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  function makeMgFlame(THREE, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    var height = Math.max(0.2, finiteOr(opts.height, 1.2));
    var radius = Math.max(0.05, finiteOr(opts.radius, 0.35));
    var count = limitedCount(opts.count, 112, MAX_FLAME_PARTICLES);
    var random = seededRandom(opts.seed == null ? 73129 : opts.seed);
    var positions = new Float32Array(count * 3);
    var phases = new Float32Array(count);
    var sizes = new Float32Array(count);
    var orders = new Float32Array(count);
    var i;

    for (i = 0; i < count; i += 1) {
      var angle = random() * TAU;
      var spread = Math.sqrt(random()) * radius;
      positions[i * 3] = Math.cos(angle) * spread;
      positions[i * 3 + 1] = random();
      positions[i * 3 + 2] = Math.sin(angle) * spread * 0.7;
      phases[i] = random();
      sizes[i] = 8 + random() * 18;
      orders[i] = (i + 0.5) / count;
    }

    var sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    sparkGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    sparkGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    sparkGeometry.setAttribute("aOrder", new THREE.BufferAttribute(orders, 1));

    var timeUniform = { value: 0 };
    var strengthUniform = { value: 0 };
    var sparkMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uStrength: strengthUniform,
        uHeight: { value: height },
        uRadius: { value: radius }
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uStrength;",
        "uniform float uHeight;",
        "uniform float uRadius;",
        "attribute float aPhase;",
        "attribute float aSize;",
        "attribute float aOrder;",
        "varying float vAlpha;",
        "varying float vCool;",
        "void main() {",
        "  float life = fract(aPhase + uTime * (0.22 + aPhase * 0.16));",
        "  vec3 p = position;",
        "  p.y = life * uHeight * (0.42 + aPhase * 0.75);",
        "  p.x *= 0.8 - life * 0.38;",
        "  p.z *= 0.75 - life * 0.3;",
        "  p.x += sin(uTime * 3.8 + aPhase * 31.0 + life * 5.0) * uRadius * 0.16 * life;",
        "  p.z += cos(uTime * 2.9 + aPhase * 23.0) * uRadius * 0.09 * life;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  gl_PointSize = aSize * (18.0 / max(1.0, -mv.z)) * (0.3 + uStrength * 0.7);",
        "  float envelope = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.62, 1.0, life));",
        "  vAlpha = envelope * smoothstep(aOrder * 0.55, aOrder * 0.55 + 0.22, uStrength);",
        "  vCool = life;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uStrength;",
        "varying float vAlpha;",
        "varying float vCool;",
        "void main() {",
        "  vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;",
        "  float r = length(q);",
        "  if (r >= 1.0 || vAlpha <= 0.001) discard;",
        "  float soft = 1.0 - smoothstep(0.12, 1.0, r);",
        "  vec3 whiteHot = vec3(1.0, 0.995, 0.96);",
        "  vec3 paleBlue = vec3(0.74, 0.9, 1.0);",
        "  vec3 color = mix(whiteHot, paleBlue, smoothstep(0.28, 0.9, vCool));",
        "  gl_FragColor = vec4(color, soft * vAlpha * uStrength * 0.82);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var sparks = new THREE.Points(sparkGeometry, sparkMaterial);
    sparks.frustumCulled = false;
    sparks.renderOrder = 6;
    group.add(sparks);

    var coreGeometry = new THREE.SphereGeometry(1, 18, 22);
    var outerMaterial = new THREE.MeshBasicMaterial({
      color: 0xcfeeff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffff4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var outerCore = new THREE.Mesh(coreGeometry, outerMaterial);
    var innerCore = new THREE.Mesh(coreGeometry, innerMaterial);
    outerCore.position.y = height * 0.38;
    innerCore.position.y = height * 0.26;
    outerCore.renderOrder = 4;
    innerCore.renderOrder = 5;
    group.add(outerCore, innerCore);

    var glowMaterial = makeRadialMaterial(THREE, 0xd9f3ff);
    var glow = new THREE.Sprite(glowMaterial);
    glow.position.y = height * 0.34;
    glow.renderOrder = 3;
    group.add(glow);

    var localLight = new THREE.PointLight(0xe9f7ff, 0, Math.max(1.2, radius * 7.2), 2);
    localLight.position.set(0, height * 0.34, radius * 0.4);
    group.add(localLight);
    setGroupPosition(group, opts.position);
    group.userData.particleCount = count;

    var currentOn = 0;
    var currentLight = 0;
    var clock = { ready: false, last: 0 };

    function update(t, state) {
      var time = finiteOr(t, 0);
      var dt = frameDelta(time, clock);
      var onTarget = clamp01(state && state.on);
      var lightTarget = clamp01(state && state.light) * onTarget;
      currentOn = follow(currentOn, onTarget, 9.0, dt);
      currentLight = follow(currentLight, lightTarget, 7.0, dt);
      if (currentOn < 0.0005 && onTarget === 0) currentOn = 0;
      if (currentLight < 0.0005 && lightTarget === 0) currentLight = 0;

      var decorativeTime = state && state.rm ? 2.75 : time;
      var pulse = 0.965 + 0.025 * Math.sin(decorativeTime * TAU * 1.2) + 0.01 * Math.sin(decorativeTime * TAU * 0.47 + 1.1);
      var strength = currentOn * (0.2 + currentLight * 0.8) * pulse;
      timeUniform.value = decorativeTime;
      strengthUniform.value = strength;

      outerCore.scale.set(radius * 0.92, height * (0.3 + strength * 0.18), radius * 0.7);
      innerCore.scale.set(radius * 0.54, height * (0.23 + strength * 0.13), radius * 0.42);
      outerMaterial.opacity = strength * 0.48;
      innerMaterial.opacity = strength * 0.86;
      glow.scale.set(radius * 4.0, radius * 4.0, 1);
      glowMaterial.uniforms.uOpacity.value = strength * 0.46;
      localLight.intensity = strength * 2.15;
      group.visible = strength > 0.0002 || currentOn > 0.0002;
    }

    return { group: group, update: update };
  }

  function makeMgBurnFront(THREE, opts) {
    opts = opts || {};
    var ribbon = opts.ribbon || {};
    var length = Math.max(0.4, finiteOr(ribbon.length, 3.2));
    var width = Math.max(0.06, finiteOr(ribbon.width, 0.35));
    var thickness = Math.max(0.015, finiteOr(ribbon.thickness, 0.06));
    var bandWidth = Math.min(length * 0.18, Math.max(0.08, finiteOr(opts.bandWidth, 0.15)));
    var group = new THREE.Group();

    var spent = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xd8d5ce, roughness: 0.96, metalness: 0.02 })
    );
    spent.position.y = thickness * 0.22;
    spent.receiveShadow = true;
    group.add(spent);

    var bandMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffdf0,
      emissive: 0xe8f5ff,
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0
    });
    var band = new THREE.Mesh(new THREE.BoxGeometry(bandWidth, thickness * 1.75, width * 1.14), bandMaterial);
    band.position.y = thickness * 0.7;
    band.renderOrder = 4;
    group.add(band);

    var glowMaterial = makeRadialMaterial(THREE, 0xe7f7ff);
    var glow = new THREE.Sprite(glowMaterial);
    glow.position.y = thickness * 1.5;
    glow.scale.set(width * 2.15, width * 2.15, 1);
    glow.renderOrder = 3;
    group.add(glow);
    setGroupPosition(group, opts.position);
    group.userData.particleCount = 0;

    var currentHeat = 0;
    var clock = { ready: false, last: 0 };

    function update(t, state) {
      var time = finiteOr(t, 0);
      var dt = frameDelta(time, clock);
      var p = clamp01(state && state.p);
      var active = p < 0.9995 && !!(state && (state.on || state.ignited)) && !(state && state.done);
      var heatTarget = active ? clamp01(state && state.light) : 0;
      currentHeat = follow(currentHeat, heatTarget, active ? 8.0 : 5.0, dt);
      if (currentHeat < 0.0005 && heatTarget === 0) currentHeat = 0;

      var spentLength = length * p;
      spent.visible = spentLength > 0.001;
      spent.scale.set(Math.max(0.0001, spentLength), thickness * 0.8, width * 1.035);
      spent.position.x = -length * 0.5 + spentLength * 0.5;

      var frontX = -length * 0.5 + length * p;
      var decorativeTime = state && state.rm ? 1.625 : time;
      var pulse = 0.975 + 0.025 * Math.sin(decorativeTime * TAU * 0.8 + 0.4);
      var heat = currentHeat * pulse;
      band.position.x = frontX;
      glow.position.x = frontX;
      band.visible = heat > 0.001;
      glow.visible = heat > 0.001;
      bandMaterial.emissiveIntensity = 1.35 + heat * 2.2;
      glowMaterial.uniforms.uOpacity.value = heat * 0.42;
    }

    return { group: group, update: update };
  }

  function makeMgAsh(THREE, opts) {
    opts = opts || {};
    var area = opts.area || {};
    var areaX = Math.max(0.3, finiteOr(area.x, 3.6));
    var areaZ = Math.max(0.12, finiteOr(area.z, 0.8));
    var count = limitedCount(opts.count, 248, MAX_ASH_PARTICLES);
    var random = seededRandom(opts.seed == null ? 98173 : opts.seed);
    var group = new THREE.Group();
    var pieces = [];
    var i;

    for (i = 0; i < count; i += 1) {
      var x = (random() - 0.5) * areaX;
      var z = (random() - 0.5) * areaZ;
      var edge = Math.max(0.12, 1 - Math.pow(Math.abs(z) / (areaZ * 0.5), 1.7));
      pieces.push({
        order: clamp01(x / areaX + 0.5 + (random() - 0.5) * 0.06),
        x: x,
        y: 0.015 + random() * 0.12 * edge,
        z: z,
        rx: random() * TAU,
        ry: random() * TAU,
        rz: random() * TAU,
        sx: 0.45 + random() * 1.15,
        sy: 0.3 + random() * 0.9,
        sz: 0.42 + random() * 1.1,
        shade: random()
      });
    }
    pieces.sort(function (a, b) { return a.order - b.order; });

    var geometry = new THREE.DodecahedronGeometry(0.062, 0);
    var material = new THREE.MeshStandardMaterial({
      color: 0xf2efe8,
      roughness: 0.98,
      metalness: 0.01
    });
    var mesh = new THREE.InstancedMesh(geometry, material, count);
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    var base = new THREE.Color(0xf2efe8);
    for (i = 0; i < count; i += 1) {
      var piece = pieces[i];
      dummy.position.set(piece.x, piece.y, piece.z);
      dummy.rotation.set(piece.rx, piece.ry, piece.rz);
      dummy.scale.set(piece.sx, piece.sy, piece.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      var shade = 0.9 + piece.shade * 0.1;
      color.setRGB(base.r * shade, base.g * shade, base.b * shade).convertSRGBToLinear();
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    setGroupPosition(group, opts.position);
    group.userData.particleCount = count;

    var lastVisible = -1;

    function update(t, state) {
      var visible = Math.max(0, Math.min(count, Math.ceil(count * clamp01(state && state.p))));
      if (visible === lastVisible) return;
      lastVisible = visible;
      mesh.count = visible;
      group.visible = visible > 0;
    }

    return { group: group, update: update };
  }

  function makeMgSmoke(THREE, opts) {
    opts = opts || {};
    var count = limitedCount(opts.count, 76, MAX_SMOKE_PARTICLES);
    var rate = clamp01(opts.rate == null ? 0.58 : opts.rate);
    var random = seededRandom(opts.seed == null ? 45077 : opts.seed);
    var group = new THREE.Group();
    var positions = new Float32Array(count * 3);
    var phases = new Float32Array(count);
    var sizes = new Float32Array(count);
    var orders = new Float32Array(count);
    var i;

    for (i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.5) * 0.28;
      positions[i * 3 + 1] = random();
      positions[i * 3 + 2] = (random() - 0.5) * 0.22;
      phases[i] = random();
      sizes[i] = 18 + random() * 30;
      orders[i] = (i + 0.5) / count;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aOrder", new THREE.BufferAttribute(orders, 1));

    var timeUniform = { value: 0 };
    var amountUniform = { value: 0 };
    var material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: timeUniform,
        uAmount: amountUniform
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uAmount;",
        "attribute float aPhase;",
        "attribute float aSize;",
        "attribute float aOrder;",
        "varying float vAlpha;",
        "varying float vTone;",
        "void main() {",
        "  float life = fract(aPhase + uTime * (0.11 + aPhase * 0.055));",
        "  vec3 p = position;",
        "  p.y = life * (1.0 + aPhase * 0.65);",
        "  p.x += sin(uTime * 0.72 + aPhase * 19.0 + life * 4.0) * (0.09 + life * 0.17);",
        "  p.z += cos(uTime * 0.58 + aPhase * 17.0) * (0.05 + life * 0.1);",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  gl_PointSize = aSize * (18.0 / max(1.0, -mv.z)) * (0.7 + life * 0.75);",
        "  float lifeFade = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.62, 1.0, life));",
        /* [통합 보정 ①] 'active' 는 GLSL 예약어 — 컴파일 실패(VALIDATE_STATUS)로 연기가
           통째로 사라졌다. 식별자만 개명. 원본: redox_mgfx.part.orig.js */
        "  float vis = 1.0 - smoothstep(uAmount, uAmount + 0.16, aOrder);",
        "  vAlpha = lifeFade * vis * uAmount;",
        "  vTone = aPhase;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vAlpha;",
        "varying float vTone;",
        "void main() {",
        "  vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;",
        "  float r = length(q);",
        "  if (r >= 1.0 || vAlpha <= 0.001) discard;",
        "  float soft = pow(1.0 - smoothstep(0.05, 1.0, r), 1.45);",
        "  vec3 color = mix(vec3(0.78, 0.8, 0.8), vec3(0.94, 0.93, 0.9), vTone);",
        "  gl_FragColor = vec4(color, soft * vAlpha * 0.2);",
        "}"
      ].join("\n"),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    var smoke = new THREE.Points(geometry, material);
    smoke.frustumCulled = false;
    smoke.renderOrder = 7;
    group.add(smoke);
    setGroupPosition(group, opts.position);
    group.userData.particleCount = count;

    var currentAmount = 0;
    var clock = { ready: false, last: 0 };

    function update(t, state) {
      var time = finiteOr(t, 0);
      var dt = frameDelta(time, clock);
      var target = state && state.on ? rate * (0.3 + 0.7 * clamp01(state.light)) : 0;
      currentAmount = follow(currentAmount, target, target > currentAmount ? 3.5 : 1.65, dt);
      if (currentAmount < 0.0005 && target === 0) currentAmount = 0;
      timeUniform.value = state && state.rm ? 4.25 : time;
      amountUniform.value = currentAmount;
      group.visible = currentAmount > 0.0002;
    }

    return { group: group, update: update };
  }

  root.REDOX_MGFX = Object.freeze({
    makeMgFlame: makeMgFlame,
    makeMgBurnFront: makeMgBurnFront,
    makeMgAsh: makeMgAsh,
    makeMgSmoke: makeMgSmoke
  });
}(window));

const $ = id => document.getElementById(id);
const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* CPK — 사이트 표준(mineral/sim.js와 동일 값). 토큰 아님이 정상(매뉴얼 P6 예외 1) */
const CPK = { Cu: "#C88033", O: "#FF0D0D", C: "#404040" };
const CPK_EDGE = { Cu: "#7a4e1f", O: "#990808", C: "#262626" };

let S = redoxInit();          // 탭1 모형 상태 — 쓰기 가능한 전역으로 유지(§5-15 프로브 계약)
let zoom = false;             // 거시 ↔ 미시 전환 플래그(§14 ①) — 렌더러 교체일 뿐 실험은 계속
let selectedO = -1;           // 추적 중인 산소 원자 index (반박 장치 · 탭1)
let heatVis = 0, bubbleVis = 0;

/* ================= 실험 탭 인프라 (설계지시안_마그네슘연소_v1 §3 단계 4) =================
   활성 탭만 시간이 흐른다(§5-13 — 숨은 탭은 일시정지·복귀 시 이어짐). 학생에게 닿는
   문자열은 EXPERIMENTS_DATA(계산부)가 단일 원천이다(F-1 · 검사군 16). 3번째 실험은
   EXPERIMENTS_DATA에 항목을 추가하고 아래 SCENES에 씬 빌더를 연결하면 성립한다 —
   연결이 없으면 기본값(빈 씬·빈 상태)으로 탭 자체는 뜬다(확장 대비 — 확정 4). */
let EXP = "cuo";              // 활성 실험 id
let SMG = mgbInit();          // 탭2 모형 상태
let selectedE = -1;           // 추적 중인 전자 index (반박 장치 · 탭2)
let lightVis = 0;             // 탭2 빛 세기 평활값 (FX·배지 공용)
function expData() {
  for (let i = 0; i < EXPERIMENTS_DATA.length; i++)
    if (EXPERIMENTS_DATA[i].id === EXP) return EXPERIMENTS_DATA[i];
  return EXPERIMENTS_DATA[0];
}
const CUO_D = EXPERIMENTS_DATA[0];   // 탭1 문자열 (setHeat 등 탭1 전용 경로가 읽는다)

/* ================= 거시 무대 (three.js r147 · 체험형 규범 §1-4) ================= */
let T3 = null;                // { renderer, scene, camera, fx, anchors }
const CAM0 = { yaw: -0.35, pitch: 0.26, dist: 4.6, tx: 0.15, ty: 0.95 };
let cam = Object.assign({}, CAM0);

function buildMacro() {
  const cv = $("macro");
  let ctx = null;
  try { ctx = cv.getContext("webgl", { antialias: true }); } catch (e) { ctx = null; }
  if (!ctx || typeof THREE === "undefined") return null;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, context: ctx, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");    // 밝은 무대 — 화면 유일 순백(§5)
  scene.add(new THREE.HemisphereLight("#f2f9ff", "#4c5a60", 0.95));
  const key = new THREE.DirectionalLight("#fff1d6", 1.5);
  key.position.set(5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#cfe8f6", 0.5); fill.position.set(-5, 6, 4); scene.add(fill);
  const front = new THREE.DirectionalLight("#ffffff", 0.55); front.position.set(0, 4, 8); scene.add(front);
  const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);

  const M = {
    table: new THREE.MeshStandardMaterial({ color: "#e7e2d8", roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: "#5b6570", metalness: 0.75, roughness: 0.35 }),
    metalDark: new THREE.MeshStandardMaterial({ color: "#3a4148", metalness: 0.7, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#bfe0ee", metalness: 0, roughness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    cork: new THREE.MeshStandardMaterial({ color: "#b98a5a", roughness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#c96f2f", roughness: 0.75 }),
    lampGlass: new THREE.MeshPhysicalMaterial({ color: "#cfe4ee", metalness: 0, roughness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    alcohol: new THREE.MeshPhysicalMaterial({ color: "#dfeef4", metalness: 0, roughness: 0.2, transparent: true, opacity: 0.5 }),
    wick: new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.95 })
  };

  const table = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.14, 4.2), M.table);
  table.position.set(0.3, -0.07, 0); table.receiveShadow = true; scene.add(table);

  /* 스탠드 — 교과서 34쪽 그림: 받침 + 세로 봉 + 클램프가 시험관을 문다 */
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 0.62), M.metalDark);
  base.position.set(-1.7, 0.05, 0); base.castShadow = true; scene.add(base);
  /* 봉 높이는 클램프 위 0.5 까지만 — 더 길면 중간 폭(744·820)에서 위끝이 화면 밖으로 잘린다
     (S-검토 A-3 재검에서 실측) */
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 20), M.metal);
  rod.position.set(-1.7, 1.0, 0); rod.castShadow = true; scene.add(rod);
  const clampArm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.07), M.metal);
  clampArm.position.set(-1.42, 1.42, 0); clampArm.castShadow = true; scene.add(clampArm);
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 18, 1, true), M.metalDark);
  jaw.rotation.z = Math.PI / 2; jaw.position.set(-1.16, 1.4, 0); scene.add(jaw);

  /* 시험관 — 수평(교과서 그림), 닫힌 끝 왼쪽·입구 오른쪽 */
  const TUBE = { y: 1.4, x0: -1.55, x1: 0.06, r: 0.165 };
  const tubeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(TUBE.r, TUBE.r, TUBE.x1 - TUBE.x0, 26, 1, true), M.glass);
  tubeBody.rotation.z = Math.PI / 2;
  tubeBody.position.set((TUBE.x0 + TUBE.x1) / 2, TUBE.y, 0); tubeBody.castShadow = true; scene.add(tubeBody);
  const tubeEnd = new THREE.Mesh(
    new THREE.SphereGeometry(TUBE.r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
  tubeEnd.rotation.z = Math.PI / 2; tubeEnd.position.set(TUBE.x0, TUBE.y, 0); scene.add(tubeEnd);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TUBE.r, 0.012, 10, 26), M.glass);
  rim.rotation.y = Math.PI / 2; rim.position.set(TUBE.x1, TUBE.y, 0); scene.add(rim);

  /* 고무마개 + 유리 유도관 + 고무관 → 석회수 비커 (교과서 그림의 경로) */
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.16, 18), M.cork);
  stopper.rotation.z = Math.PI / 2; stopper.position.set(TUBE.x1 + 0.05, TUBE.y, 0);
  stopper.castShadow = true; scene.add(stopper);
  const glassNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 12), M.glass);
  glassNeck.rotation.z = Math.PI / 2; glassNeck.position.set(TUBE.x1 + 0.3, TUBE.y, 0); scene.add(glassNeck);
  const BEAKER = { x: 1.62, r: 0.34, h: 0.6 };
  const hosePts = [
    new THREE.Vector3(TUBE.x1 + 0.5, TUBE.y, 0),
    new THREE.Vector3(TUBE.x1 + 0.85, TUBE.y - 0.02, 0),
    new THREE.Vector3(1.15, 1.12, 0),
    new THREE.Vector3(1.45, 0.78, 0),
    new THREE.Vector3(BEAKER.x - 0.05, 0.52, 0),
    new THREE.Vector3(BEAKER.x, 0.3, 0)
  ];
  const hoseCurve = new THREE.CatmullRomCurve3(hosePts);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 40, 0.032, 10, false), M.rubber);
  hose.castShadow = true; scene.add(hose);

  /* 알코올램프 — 가루의 왼쪽(닫힌 끝) 아래. 가루 색 전이가 왼쪽부터 번지므로(§5-9)
     가열부와 전이 시작점이 일치해야 한다. 미시 소비 순서(col 0 = 왼쪽)와도 일관 */
  const LAMP = { x: -1.3 };
  const lampBody = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), M.lampGlass);
  lampBody.scale.set(1, 0.72, 1); lampBody.position.set(LAMP.x, 0.19, 0); lampBody.castShadow = true; scene.add(lampBody);
  const fuel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), M.alcohol);
  fuel.scale.set(1, 0.5, 1); fuel.position.set(LAMP.x, 0.16, 0); scene.add(fuel);
  const lampNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 14), M.metal);
  lampNeck.position.set(LAMP.x, 0.4, 0); scene.add(lampNeck);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10), M.wick);
  wick.position.set(LAMP.x, 0.5, 0); scene.add(wick);

  /* 석회수 비커 */
  const beaker = new THREE.Mesh(new THREE.CylinderGeometry(BEAKER.r, BEAKER.r * 0.94, BEAKER.h, 26, 1, true), M.glass);
  beaker.position.set(BEAKER.x, BEAKER.h / 2, 0); beaker.castShadow = true; scene.add(beaker);
  const beakerBottom = new THREE.Mesh(new THREE.CylinderGeometry(BEAKER.r * 0.94, BEAKER.r * 0.94, 0.02, 26), M.glass);
  beakerBottom.position.set(BEAKER.x, 0.01, 0); scene.add(beakerBottom);

  /* ── Codex FX 접합점 (설계지시안 §3 단계 3 ② 인터페이스) ── */
  const fx = {};
  if (typeof window.REDOX_FX === "object" && window.REDOX_FX) {
    const F = window.REDOX_FX;
    try {
      if (F.makeFlame) {
        fx.flame = F.makeFlame(THREE, {});
        fx.flame.group.position.set(LAMP.x, 0.56, 0); fx.flame.group.scale.setScalar(0.5);
        scene.add(fx.flame.group);
      }
      if (F.makePowder) {
        /* S-검토 A-2: 원 치수에서 입자 56~70 %가 유리를 관통했다. 그룹 y·z 스케일 0.5 로
           입자까지 함께 눌러 단면 전체(입자 반지름 포함)가 관 내반지름 0.16 안에 들어온다
           (검산: 최악 반경 0.155). 붉은색을 살린 reactedColor 는 B-3 처방 */
        fx.powder = F.makePowder(THREE, { length: 1.0, width: 0.2, height: 0.09, reactedColor: 0xaf4e26 });
        fx.powder.group.scale.set(1, 0.5, 0.5);
        fx.powder.group.position.set(-1.0, TUBE.y - 0.065, 0);
        scene.add(fx.powder.group);
      }
      if (F.makeTurbidity) {
        fx.turb = F.makeTurbidity(THREE, { radius: BEAKER.r * 0.88, height: 0.4 });
        fx.turb.group.position.set(BEAKER.x, 0.21, 0);
        scene.add(fx.turb.group);
      }
      if (F.makeBubbles) {
        fx.bub = F.makeBubbles(THREE, { height: 0.34, radius: 0.12 });
        fx.bub.group.position.set(BEAKER.x, 0.1, 0);
        scene.add(fx.bub.group);
      }
    } catch (e) { console.error("REDOX_FX 접합 실패", e); }
  }

  const anchors = {
    powder: new THREE.Vector3(-1.0, TUBE.y + 0.26, 0),
    lime: new THREE.Vector3(BEAKER.x, 0.75, 0),
    lamp: new THREE.Vector3(LAMP.x, 0.06, 0.3)
  };
  return { renderer, scene, camera, fx, anchors, cv };
}

function macroResize() {
  if (!T3) return;
  const w = T3.cv.clientWidth, h = T3.cv.clientHeight;
  if (w < 8 || h < 8) return;
  T3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  T3.renderer.setSize(w, h, false);
  const aspect = w / h;
  T3.camera.aspect = aspect;
  /* 세로 FOV 고정(38°)이면 좁은 화면에서 가로 시야가 줄어 램프·불꽃이 잘린다(S-검토 A-3).
     가로 FOV 하한 54°를 보장하도록 세로 FOV 를 올린다 */
  const MIN_H = 54 * Math.PI / 180, vBase = 38 * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vBase / 2) * aspect);
  T3.camera.fov = hFov >= MIN_H ? 38
    : 2 * Math.atan(Math.tan(MIN_H / 2) / aspect) * 180 / Math.PI;
  T3.camera.updateProjectionMatrix();
  if (T3MG) {                                  // 탭2 카메라도 같은 규칙(가로 FOV 하한 54°)
    T3MG.camera.aspect = T3.camera.aspect;
    T3MG.camera.fov = T3.camera.fov;
    T3MG.camera.updateProjectionMatrix();
  }
}
function macroRender(t) {
  if (!T3) return;
  const c = T3.camera;
  c.position.set(
    cam.tx + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch),
    cam.ty + cam.dist * Math.sin(cam.pitch),
    cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
  c.lookAt(cam.tx, cam.ty, 0);
  const st = {
    on: heatVis, front: S.p, turb: S.turb, rate: bubbleVis,
    rm: RM, t: t
  };
  /* prefers-reduced-motion 은 «FX 안에서» state.rm 으로 처리한다 — 여기서 시간을 상수로
     넘기면 FX 평활기의 dt 가 0이 되어 점화·탁도가 영원히 0에 머문다(S-검토 재검 A급 실측:
     화면은 맑은데 수치는 「뿌옇게 흐려짐 12/12」였다). 시간은 언제나 실제 시간을 넘긴다 */
  if (T3.fx.flame) T3.fx.flame.update(t, st);
  if (T3.fx.powder) T3.fx.powder.update(t, st);
  if (T3.fx.turb) T3.fx.turb.update(t, st);
  if (T3.fx.bub) T3.fx.bub.update(t, st);
  T3.renderer.render(T3.scene, T3.camera);
  placeLabel("lblPowder", T3.anchors.powder);
  placeLabel("lblLime", T3.anchors.lime);
  placeLabel("lblLamp", T3.anchors.lamp);
}
function placeLabel(id, v3) {
  const el = $(id); if (!el || !T3) return;
  const p = v3.clone().project(T3.camera);
  if (p.z > 1 || zoom) { el.classList.add("is-hidden"); return; }
  el.classList.remove("is-hidden");
  const w = T3.cv.clientWidth, h = T3.cv.clientHeight;
  const lx = (p.x * 0.5 + 0.5) * w - el.offsetWidth / 2;
  const ly = (-p.y * 0.5 + 0.5) * h - el.offsetHeight / 2;
  el.style.left = clamp(lx, 4, Math.max(4, w - el.offsetWidth - 4)) + "px";
  el.style.top = clamp(ly, 4, Math.max(4, h - el.offsetHeight - 4)) + "px";
}

/* ================= 탭2 거시 무대 — 마그네슘의 연소 (three.js · 렌더러 공유) =================
   캔버스·WebGL 컨텍스트는 탭1과 공유한다(§1-1 #14 — 탭은 씬 교체이지 캔버스 추가가 아님).
   교과서 35쪽 그림 I-12 구도: 접시 위 마그네슘 리본. 리본·접시·점화기는 절차적(에셋 manifest
   1·2), 불꽃·연소 전선·재·연기는 Codex FX(REDOX_MGFX — 단계 3 산출물, 없으면 기본 연출만). */
let T3MG = null;              // { scene, camera, fx, anchors, ribbon }
const RIBBON = { len: 1.6, w: 0.13, th: 0.022, y: 0.47, seg: 24 };
function buildMacroMg() {
  if (!T3) return null;                       // 렌더러가 없으면(폴백) 탭2 거시도 없다
  const scene = new THREE.Scene();
  /* 어두운 무대(§5 `--stage-dark`) — 이 실험의 관찰 대상은 «빛»이다. 밝은 무대에서는
     백열 글로우(가산 혼합)가 흰 배경에 씻겨 사라진다(통합 실측 — v1 보정 ②와 같은 유형).
     §5 「한 페이지 안에서 섞지 않는다」는 «동시 표시» 금지로 해석한다 — 탭은 한 번에
     하나만 보이고, 사용자가 승인한 FX 데모(정지점 1-B)도 어두운 무대였다(§7 판단 기록) */
  scene.background = new THREE.Color("#0f172a");
  scene.add(new THREE.HemisphereLight("#cfe0ec", "#1c232e", 0.5));
  const key = new THREE.DirectionalLight("#e8eef4", 0.85);
  key.position.set(5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#9fb6c8", 0.3); fill.position.set(-5, 6, 4); scene.add(fill);
  const front = new THREE.DirectionalLight("#dfe7ee", 0.25); front.position.set(0, 4, 8); scene.add(front);
  const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);

  const M = {
    table: new THREE.MeshStandardMaterial({ color: "#e7e2d8", roughness: 0.85 }),
    dish: new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.55 }),
    ribbon: new THREE.MeshStandardMaterial({ color: "#cdd4d8", metalness: 0.85, roughness: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: "#5b6570", metalness: 0.75, roughness: 0.35 }),
    metalDark: new THREE.MeshStandardMaterial({ color: "#3a4148", metalness: 0.7, roughness: 0.45 }),
    ember: new THREE.MeshStandardMaterial({ color: "#ffdba1", emissive: "#ff8c2e",
      emissiveIntensity: 0.0, roughness: 0.6 })   // 백열 — 흰 무대에서도 보이는 주황 계열
  };

  const table = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.14, 4.2), M.table);
  table.position.set(0.3, -0.07, 0); table.receiveShadow = true; scene.add(table);

  /* 도자기 접시 (그림 I-12 — 접시 위 리본). 개방 원통은 위에서 보면 «흰 고리»로만
     읽힌다(실측) — 몸통·바닥을 닫힌 메시로 만들고 배경과 살짝 톤을 가른다 */
  const dishM = new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.5 });
  const dishBody = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 0.2, 40), dishM);
  dishBody.position.set(0, 0.24, 0); dishBody.castShadow = true; dishBody.receiveShadow = true;
  scene.add(dishBody);
  const dishInner = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.68, 0.16, 40),
    new THREE.MeshStandardMaterial({ color: "#e2dbcb", roughness: 0.6 }));
  dishInner.position.set(0, 0.28, 0); dishInner.receiveShadow = true; scene.add(dishInner);
  const dishRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.035, 12, 44), dishM);
  dishRim.rotation.x = Math.PI / 2; dishRim.position.set(0, 0.345, 0); scene.add(dishRim);

  /* 마그네슘 리본 — 얇은 은백색 띠를 조각(seg)으로 나눠, 진행률 p 만큼 왼쪽부터 소진한다.
     소진 경계 조각은 백열(ember)로 빛난다 — Codex FX(makeMgBurnFront)가 오면 그 위에 얹는다 */
  const ribbonG = new THREE.Group();
  const slices = [];
  for (let i = 0; i < RIBBON.seg; i++) {
    const sl = new THREE.Mesh(
      new THREE.BoxGeometry(RIBBON.len / RIBBON.seg * 0.98, RIBBON.th, RIBBON.w), M.ribbon);
    sl.position.set(-RIBBON.len / 2 + (i + 0.5) * RIBBON.len / RIBBON.seg,
      0, Math.sin(i * 0.55) * 0.03);          // 살짝 물결진 띠 — 실물 리본의 감김 잔형
    sl.castShadow = true;
    ribbonG.add(sl); slices.push(sl);
  }
  const emberTip = new THREE.Mesh(new THREE.BoxGeometry(RIBBON.len / RIBBON.seg * 1.3, RIBBON.th * 2.2, RIBBON.w * 1.25), M.ember);
  emberTip.visible = false; ribbonG.add(emberTip);
  ribbonG.position.set(0, RIBBON.y, 0);
  scene.add(ribbonG);

  /* 점화기(토치) — 점화 유지 동안 리본 왼끝으로 다가간다 (대기 위치도 화면 안 왼쪽) */
  const torchG = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 14), M.metalDark);
  torchG.add(handle);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.22, 12), M.metal);
  nozzle.position.set(0, 0.38, 0); torchG.add(nozzle);
  torchG.rotation.z = 0.75;                   // 끝이 리본 왼끝(오른쪽 아래)을 향하게 기울임
  torchG.position.set(-1.75, 0.7, 0);         // 대기 위치 — 화면 안 왼쪽
  scene.add(torchG);

  /* ── Codex FX 접합점 (REDOX_MGFX — 설계지시안 §3 단계 3. 병합·교체 규격은 A-1) ── */
  const fx = {};
  if (typeof window.REDOX_MGFX === "object" && window.REDOX_MGFX) {
    const F = window.REDOX_MGFX;
    try {
      if (F.makeMgFlame) {
        fx.flame = F.makeMgFlame(THREE, { height: 1.2, radius: 0.35 });
        fx.flame.group.position.set(0, RIBBON.y + RIBBON.th, 0);
        scene.add(fx.flame.group);
      }
      if (F.makeMgBurnFront) {
        fx.front = F.makeMgBurnFront(THREE, { ribbon: { length: RIBBON.len, width: RIBBON.w, thickness: RIBBON.th } });
        fx.front.group.position.copy(ribbonG.position);
        scene.add(fx.front.group);
      }
      if (F.makeMgAsh) {
        fx.ash = F.makeMgAsh(THREE, { area: { x: RIBBON.len * 1.15, z: RIBBON.w * 3 } });
        fx.ash.group.position.set(0, RIBBON.y - 0.05, 0);
        scene.add(fx.ash.group);
      }
      if (F.makeMgSmoke) {
        fx.smoke = F.makeMgSmoke(THREE, {});
        fx.smoke.group.position.set(0, RIBBON.y + 0.3, 0);
        scene.add(fx.smoke.group);
      }
    } catch (e) { console.error("REDOX_MGFX 접합 실패", e); }
  }

  const anchors = {
    ribbon: new THREE.Vector3(0, RIBBON.y + 0.32, 0),
    dish: new THREE.Vector3(0.95, 0.12, 0.4)
  };
  return { scene, camera, fx, anchors, ribbonG, slices, emberTip, torchG, torchVis: 0 };
}

function macroRenderMg(t) {
  if (!T3 || !T3MG) return;
  const c = T3MG.camera;
  c.position.set(
    cam.tx + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch),
    cam.ty + cam.dist * Math.sin(cam.pitch),
    cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
  c.lookAt(cam.tx, cam.ty, 0);
  /* 리본 소진 — 진행률 p 만큼 왼쪽부터 사라진다(코어 값 유도 — 함정 ③: 그림이 물리를
     배신하지 않게 렌더가 SMG.p 를 직접 읽는다) */
  const burned = SMG.p * RIBBON.seg;
  for (let i = 0; i < RIBBON.seg; i++) T3MG.slices[i].visible = i >= burned;
  const burning = SMG.ignited && SMG.p < 1;
  T3MG.emberTip.visible = burning;
  if (burning) {
    T3MG.emberTip.position.set(-RIBBON.len / 2 + clamp(burned, 0, RIBBON.seg - 0.5) * RIBBON.len / RIBBON.seg, 0, 0);
    /* 백열 세기 — 저주파(≤2 Hz) 숨쉬기만. 1초 3회 초과 점멸 금지(§5-6) · RM이면 고정 */
    T3MG.emberTip.material.emissiveIntensity =
      2.4 + (RM ? 0 : 0.4 * Math.sin(2 * Math.PI * 1.2 * t));
  } else T3MG.emberTip.material.emissiveIntensity = 0;
  /* 점화기 — 토치 유지 동안 리본 왼끝(-len/2)으로 접근, 점화 후 물러난다 */
  const wantTorch = SMG.torch && !SMG.ignited ? 1 : 0;
  T3MG.torchVis += (wantTorch - T3MG.torchVis) * Math.min(1, ((RM ? 1 : 0.08)));
  const tv = T3MG.torchVis;
  T3MG.torchG.position.set(-1.75 + tv * 0.62, 0.7 + tv * 0.12, 0);
  const st = { on: SMG.ignited && SMG.p < 1 ? 1 : 0, light: lightVis, p: SMG.p,
               ignited: SMG.ignited, done: SMG.done, rm: RM, t: t };
  if (T3MG.fx.flame) T3MG.fx.flame.update(t, st);
  if (T3MG.fx.front) T3MG.fx.front.update(t, st);
  if (T3MG.fx.ash) T3MG.fx.ash.update(t, st);
  if (T3MG.fx.smoke) T3MG.fx.smoke.update(t, st);
  T3.renderer.render(scene3(), T3MG.camera);
  placeLabelMg("lblPowder", null);            // 탭1 라벨은 탭2에서 숨긴다
  placeLabelMg("lblLime", null);
  placeLabelMg("lblLamp", null);
}
function scene3() { return T3MG.scene; }
function placeLabelMg(id, v3) {
  const el = $(id); if (!el) return;
  if (!v3) { el.classList.add("is-hidden"); return; }
}

/* ================= 미시 무대 (M3D — liquid/sim.js 이식 · raw WebGL) =================
   §14 ②: 새 임포스터를 쓰지 않고 liquid 의 축약판을 복사했다. 이해형 규범 —
   §1-4(ACES·그림자)는 미적용, 배경·조명 관례는 liquid 그대로. */
const M3D_VERT = `attribute vec3 aPos; attribute vec2 aLocal; attribute vec3 aCol;
attribute vec3 aPerp; attribute vec3 aParam;
uniform mat4 uProj;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
void main(){ vLocal=aLocal; vCol=aCol; vPerp=aPerp; vParam=aParam;
  gl_Position = uProj * vec4(aPos,1.0); }`;
const M3D_FRAG = `precision mediump float;
varying vec2 vLocal; varying vec3 vCol; varying vec3 vPerp; varying vec3 vParam;
uniform vec3 uLight;
void main(){
  float kind = vParam.x; float al = vParam.z;
  vec3 n; float edge = 1.0; float rim = 0.0;
  if (kind < 0.5) {
    float r2 = dot(vLocal, vLocal);
    if (r2 > 1.0) discard;
    n = vec3(vLocal, sqrt(max(0.0, 1.0 - r2)));
    /* 어두운 벌크 배경에서는 테두리를 «밝게» 준다 — 검은 탄소(#404040)가 배경에
       묻히지 않게 하는 두 번째 채널(매뉴얼 §9: 색 외 채널 필수). liquid 이식본은
       테두리를 어둡게 하지만 그 판(흰 무대)에서만 옳다.
       ⚠ 테두리가 «시작되는 반지름»도 어두운 원자일수록 안쪽으로 — 밝은 띠의 «면적»이
       넓어져야 원판 전체가 배경에서 떠오른다(S-검토 재검: 최댓값만으로는 부족) */
    float alum0 = dot(vCol, vec3(0.2126, 0.7152, 0.0722));
    float rimStart = mix(0.28, 0.62, smoothstep(0.04, 0.50, alum0));
    rim = smoothstep(rimStart, 1.0, sqrt(r2));
  } else if (kind < 1.5) {
    float y = clamp(vLocal.y, -0.999, 0.999);
    n = normalize(vPerp * y + vec3(0.0,0.0,1.0) * sqrt(1.0 - y*y));
    edge = mix(1.0, 0.66, smoothstep(0.72, 1.0, abs(y)));
  } else {
    gl_FragColor = vec4(vCol, al);
    return;
  }
  float dif = max(dot(n, uLight), 0.0);
  float amb = 0.34 + 0.13 * max(n.y, 0.0);
  vec3 h = normalize(uLight + vec3(0.0,0.0,1.0));
  float spe = pow(max(dot(n, h), 0.0), 26.0);
  vec3 c = vCol * (amb + 0.74 * dif) * edge + vec3(1.0) * spe * 0.30;
  /* 테두리 밝기는 «원자 색이 어두울수록» 세게 — 벌크 배경 대비를 색이 아니라 테두리로
     확보한다(매뉴얼 §9 두 번째 채널). 실측: 탄소 대비 1.58 → 4.6 */
  float alum = dot(vCol, vec3(0.2126, 0.7152, 0.0722));
  float assist = mix(0.74, 0.34, smoothstep(0.04, 0.42, alum));
  c = mix(c, vec3(0.90, 0.91, 0.93), rim * assist);
  gl_FragColor = vec4(clamp(c,0.0,1.0), al);
}`;
const mcv = $("micro");
let m3d = null;
const M3D_CAM = { z: 6.0, fovy: 0.56 };
const M3D_PROJ = new Float32Array(16);
function m3dPersp(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}
function h2r(hex) {
  const s = hex.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map(c => c + c).join("") : s, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
let M3D_BG = [1, 1, 1];   // 미시 화면 배경 = 지금 그 가루의 벌크 색(매 프레임 갱신)
function initM3D() {
  if (!mcv) return;
  let g = null;
  try {
    g = mcv.getContext("webgl", { antialias: true, alpha: false })
      || mcv.getContext("experimental-webgl", { antialias: true, alpha: false });
  } catch (e) { g = null; }
  if (!g) return;
  const mk = (ty, src) => {
    const sh = g.createShader(ty); g.shaderSource(sh, src); g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) { console.error(g.getShaderInfoLog(sh)); return null; }
    return sh;
  };
  const vs = mk(g.VERTEX_SHADER, M3D_VERT), fs = mk(g.FRAGMENT_SHADER, M3D_FRAG);
  if (!vs || !fs) return;
  const p = g.createProgram(); g.attachShader(p, vs); g.attachShader(p, fs); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) { console.error(g.getProgramInfoLog(p)); return; }
  g.useProgram(p);
  const U = {}, A = {};
  for (const nm of ["uProj", "uLight"]) U[nm] = g.getUniformLocation(p, nm);
  for (const nm of ["aPos", "aLocal", "aCol", "aPerp", "aParam"]) A[nm] = g.getAttribLocation(p, nm);
  g.enable(g.BLEND);
  g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
  m3d = { g, p, U, A, vbo: g.createBuffer(), ibo: g.createBuffer(),
          prims: [], v: new Float32Array(0), i: new Uint16Array(0) };
}
let m3dView = null;
function m3dBegin(yaw, pitch) {
  m3dView = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) };
  if (m3d) m3d.prims.length = 0;
}
function m3dV(x, y, z) {
  const v = m3dView;
  const x1 = v.cy * x + v.sy * z, z1 = -v.sy * x + v.cy * z;
  const y2 = v.cp * y - v.sp * z1, z2 = v.sp * y + v.cp * z1;
  return [x1, y2, z2 - M3D_CAM.z];
}
function m3dSphere(p, r, col, al) { if (m3d) m3d.prims.push({ z: p[2], k: 0, p, r, col, al }); }
function m3dStick(a, b, w, col, al) { if (m3d) m3d.prims.push({ z: (a[2] + b[2]) / 2, k: 1, a, b, w, col, al }); }
function m3dFlush() {
  if (!m3d) return;
  const g = m3d.g;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = mcv.clientWidth, ch = mcv.clientHeight || 300;
  if (cw < 8) return;
  const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
  if (mcv.width !== w || mcv.height !== h) { mcv.width = w; mcv.height = h; }
  const prims = m3d.prims;
  prims.sort((a, b) => a.z - b.z);
  const P = Math.min(prims.length, 3800);
  const FPV = 14;
  const needV = P * 4 * FPV, needI = P * 6;
  if (m3d.v.length < needV) m3d.v = new Float32Array(Math.ceil(needV * 1.5));
  if (m3d.i.length < needI) m3d.i = new Uint16Array(Math.ceil(needI * 1.5));
  const V = m3d.v, I = m3d.i;
  let vh = 0, ih = 0, q = 0;
  const put = (px, py, pz, lx, ly, c, ex, ey, kind, al) => {
    V[vh] = px; V[vh + 1] = py; V[vh + 2] = pz;
    V[vh + 3] = lx; V[vh + 4] = ly;
    V[vh + 5] = c[0]; V[vh + 6] = c[1]; V[vh + 7] = c[2];
    V[vh + 8] = ex; V[vh + 9] = ey; V[vh + 10] = 0;
    V[vh + 11] = kind; V[vh + 12] = 0; V[vh + 13] = al;
    vh += FPV;
  };
  const quad = () => {
    const b = q * 4;
    I[ih] = b; I[ih + 1] = b + 1; I[ih + 2] = b + 2;
    I[ih + 3] = b; I[ih + 4] = b + 2; I[ih + 5] = b + 3;
    ih += 6; q++;
  };
  for (let s = 0; s < P; s++) {
    const pr = prims[s];
    if (pr.k === 0) {
      const [cx, cy, cz] = pr.p, r = pr.r;
      put(cx - r, cy - r, cz, -1, -1, pr.col, 0, 0, 0, pr.al);
      put(cx + r, cy - r, cz, 1, -1, pr.col, 0, 0, 0, pr.al);
      put(cx + r, cy + r, cz, 1, 1, pr.col, 0, 0, 0, pr.al);
      put(cx - r, cy + r, cz, -1, 1, pr.col, 0, 0, 0, pr.al);
      quad();
    } else if (pr.k === 1) {
      const [ax, ay, az] = pr.a, [bx, by, bz] = pr.b;
      const dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-5) continue;
      const ex = dy / L, ey = -dx / L;
      const ox = ex * pr.w, oy = ey * pr.w;
      put(ax + ox, ay + oy, az, -1, 1, pr.col, ex, ey, 1, pr.al);
      put(bx + ox, by + oy, bz, 1, 1, pr.col, ex, ey, 1, pr.al);
      put(bx - ox, by - oy, bz, 1, -1, pr.col, ex, ey, 1, pr.al);
      put(ax - ox, ay - oy, az, -1, -1, pr.col, ex, ey, 1, pr.al);
      quad();
    }
  }
  g.viewport(0, 0, mcv.width, mcv.height);
  g.clearColor(M3D_BG[0], M3D_BG[1], M3D_BG[2], 1);
  g.clear(g.COLOR_BUFFER_BIT);
  if (!q) return;
  m3dPersp(M3D_PROJ, M3D_CAM.fovy, mcv.width / mcv.height, 0.1, 30);
  g.useProgram(m3d.p);
  g.uniformMatrix4fv(m3d.U.uProj, false, M3D_PROJ);
  g.uniform3f(m3d.U.uLight, -0.4104, 0.7113, 0.5472);
  g.bindBuffer(g.ARRAY_BUFFER, m3d.vbo);
  g.bufferData(g.ARRAY_BUFFER, V.subarray(0, vh), g.DYNAMIC_DRAW);
  const st4 = FPV * 4;
  g.enableVertexAttribArray(m3d.A.aPos); g.vertexAttribPointer(m3d.A.aPos, 3, g.FLOAT, false, st4, 0);
  g.enableVertexAttribArray(m3d.A.aLocal); g.vertexAttribPointer(m3d.A.aLocal, 2, g.FLOAT, false, st4, 12);
  g.enableVertexAttribArray(m3d.A.aCol); g.vertexAttribPointer(m3d.A.aCol, 3, g.FLOAT, false, st4, 20);
  g.enableVertexAttribArray(m3d.A.aPerp); g.vertexAttribPointer(m3d.A.aPerp, 3, g.FLOAT, false, st4, 32);
  g.enableVertexAttribArray(m3d.A.aParam); g.vertexAttribPointer(m3d.A.aParam, 3, g.FLOAT, false, st4, 44);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, m3d.ibo);
  g.bufferData(g.ELEMENT_ARRAY_BUFFER, I.subarray(0, ih), g.DYNAMIC_DRAW);
  g.drawElements(g.TRIANGLES, ih, g.UNSIGNED_SHORT, 0);
}

/* 배치 좌표(계산부 GEO) → 미시 뷰 좌표.
   스케일·중심은 기하 상수에서 유도하고(원칙 13) 캔버스 종횡비에 맞춰 매 프레임 갱신 —
   격자·상승 CO₂가 어느 해상도에서도 가장자리에 잘리지 않게 한다(P4-A2). */
const MV = { s: 0.08, cx: 28, cy: 8.5, yaw: 0.5, pitch: 0.34, scale: 1.15 };
let mYaw = MV.yaw, mPitch = MV.pitch;
function updateMicroView() {
  const cw = mcv.clientWidth || 1, ch = mcv.clientHeight || 1;
  const aspect = cw / ch;
  let xMin, xMax, yMin, yMax;
  if (EXP === "mgburn") {
    /* 탭2 — 좌 Mg 격자부터 우 O₂ 공기 영역까지 전부 담는다. 가로로 긴 장면이라
       기본 yaw 회전(0.5 rad)이 깊이로 접는 몫을 여유 1.25배로 흡수한다(우측 잘림 방지) */
    xMin = -GEO_MG.R.Mg - 0.6;
    xMax = -GEO_MG.R.Mg - 0.6 +
      (GEO_MG.O2_X0 + GEO_MG.O2_DX + GEO_MG.O2_BOND / 2 + GEO_MG.R.O + 1.2 - (-GEO_MG.R.Mg - 0.6)) * 1.25;
    yMin = -GEO_MG.R.Mg - 0.6;
    yMax = (GEO_MG.ROWS - 1) * GEO_MG.DY + GEO_MG.R.Mg + 0.6;
  } else {
    /* 탭1 — 앞줄 격자(6×6)에 «꽉 차게» 맞춘다 — 여분 고리가 가장자리를 넘어가 잘리면서
       배열이 화면 밖으로 계속 이어지는 것으로 읽힌다(사용자 지시: solid 시뮬 방식) */
    xMin = -GEO.R.Cu - 0.4;
    xMax = (GEO.COLS - 1) * GEO.DX + GEO.CUO_OFF + GEO.R.O + 0.4;
    yMin = -GEO.R.Cu - 0.4;
    yMax = (GEO.ROWS - 1) * GEO.DY + GEO.R.Cu + 0.4;
  }
  MV.cx = (xMax + xMin) / 2;
  MV.cy = (yMax + yMin) / 2;
  const halfH = Math.tan(M3D_CAM.fovy / 2) * M3D_CAM.z;
  MV.s = Math.min(halfH * aspect / ((xMax - xMin) / 2), halfH / ((yMax - yMin) / 2));
}
function mView(x, y, z) { return m3dV((x - MV.cx) * MV.s, (y - MV.cy) * MV.s, z * MV.s); }
/* 캔버스 색은 토큰을 CSSV 로 읽어 쓴다(§12 ③). CPK 3색만 국제 표준 고정(P6 예외) */
const COL = { Cu: h2r(CPK.Cu), O: h2r(CPK.O), C: h2r(CPK.C),
              stick: h2r(CSSV("--d-gray") || "#5f6b7a"),
              halo: h2r(CSSV("--d-violet") || "#6d28d9"),
              trace: h2r(CSSV("--d-violet") || "#6d28d9") };

/* 여분 고리 원자의 색 — 벌크 배경 쪽으로 끌어당겨 「멀어지는 가루」로 읽히게 한다 */
function dimTo(col, bg, k) {
  return [bg[0] + (col[0] - bg[0]) * k, bg[1] + (col[1] - bg[1]) * k, bg[2] + (col[2] - bg[2]) * k];
}

function drawMicro() {
  if (!m3d) return;
  updateMicroView();
  M3D_BG = bulkColor(S.p);                  // 여백 = 지금 그 가루의 색(사용자 지시)
  m3dBegin(mYaw, mPitch);
  const lay = redoxLayout(S);
  /* ① 이어지는 가루 — 화면 가장자리를 넘어가며 잘린다 */
  for (let b = 0; b < lay.back.length; b++) {
    const q = lay.back[b];
    m3dSphere(mView(q.x, q.y, q.z), GEO.R[q.el] * MV.s * MV.scale,
              dimTo(COL[q.el], M3D_BG, q.dim), 1);
  }
  /* ② 앞줄 — 세는 대상 */
  const A = lay.atoms;
  const vp = new Array(A.length);
  for (let i = 0; i < A.length; i++) vp[i] = mView(A[i].x, A[i].y, A[i].z);
  for (let b = 0; b < lay.bonds.length; b++) {
    const [i, j] = lay.bonds[b];
    m3dStick(vp[i], vp[j], 0.016, COL.stick, 1);
  }
  let selIdx = -1;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    const r = GEO.R[a.el] * MV.s * MV.scale;
    m3dSphere(vp[i], r, COL[a.el], 1);
    if (a.el === "O" && a.i === selectedO) selIdx = i;
  }
  if (selIdx >= 0) {
    const a = A[selIdx];
    m3dSphere(vp[selIdx], GEO.R.O * MV.s * MV.scale * 1.7, COL.halo, 0.3);
    if (a.state !== "cuo") {         // 이동 경로 자취 — 반박 장치의 핵심 시각
      const o = S.oxy[selectedO];
      const from = oxySite(selectedO), cp = cSite(o.cIdx);
      const slot = (selectedO % 2 === 0) ? -GEO.CO2_BOND : GEO.CO2_BOND;
      const toY = cp.y + co2Rise(S.carbons[o.cIdx], S.t);
      const pts = [
        mView(from.x, from.y, 0), mView(from.x, from.y, GEO.Z_FLY),
        mView(cp.x + slot, toY, GEO.Z_FLY), vp[selIdx]
      ];
      for (let k = 0; k < pts.length - 1; k++)
        m3dStick(pts[k], pts[k + 1], 0.008, COL.trace, 0.55);
    }
  }
  m3dFlush();
}

/* 산소 원자 픽킹 — 화면 투영 최근접 (반박 장치: 산소 입자 추적) */
function pickOxy(px, py) {
  if (!m3d || !m3dView) return -1;
  updateMicroView();
  const w = mcv.clientWidth, h = mcv.clientHeight || 300;
  const aspect = w / h, f = 1 / Math.tan(M3D_CAM.fovy / 2);
  const lay = redoxLayout(S);
  let best = -1, bestD = 24;              // 24px 안에서 가장 가까운 산소
  for (let i = 0; i < lay.atoms.length; i++) {
    const a = lay.atoms[i];
    if (a.el !== "O") continue;
    const v = mView(a.x, a.y, a.z);
    if (v[2] > -0.1) continue;
    const sx = (v[0] * (f / aspect) / -v[2] * 0.5 + 0.5) * w;
    const sy = (-v[1] * f / -v[2] * 0.5 + 0.5) * h;
    const d = Math.hypot(sx - px, sy - py);
    if (d < bestD) { bestD = d; best = a.i; }
  }
  return best;
}

/* ================= 탭2 미시 — 전자 이동 (같은 M3D 렌더러) ================= */
/* 색 — Mg 는 Jmol CPK(사이트 8색이 전부 Jmol 값 — P-검토 확인), 전자는 원자와 다른
   시각 언어(작음 + 어두운 림 + 밝은 코어 + ⊖) — 지시안 추정 3 확정값 */
const CPK_MG = { Mg: "#8AFF00", O: "#FF0D0D" };
const COL_MG = {
  Mg: h2r(CPK_MG.Mg), O: h2r(CPK_MG.O),
  eCore: h2r("#FFE94D"), eRim: h2r("#6B5500"),
  ionTint: [0.93, 0.91, 0.87],               // MgO 로 수렴하는 흰 기운(명도 상한 안 — 추정 6)
  stick: h2r(CSSV("--d-gray") || "#5f6b7a"),
  halo: h2r(CSSV("--d-violet") || "#6d28d9"),
  trace: h2r(CSSV("--d-violet") || "#6d28d9")
};
function tint(col, k) {
  return [col[0] + (COL_MG.ionTint[0] - col[0]) * k,
          col[1] + (COL_MG.ionTint[1] - col[1]) * k,
          col[2] + (COL_MG.ionTint[2] - col[2]) * k];
}
function microProject(x, y, z) {
  const w = mcv.clientWidth, h = mcv.clientHeight || 300;
  const aspect = w / h, f = 1 / Math.tan(M3D_CAM.fovy / 2);
  const v = mView(x, y, z);
  if (v[2] > -0.1) return null;
  return [(v[0] * (f / aspect) / -v[2] * 0.5 + 0.5) * w,
          (-v[1] * f / -v[2] * 0.5 + 0.5) * h];
}
/* 대표 라벨 오버레이 — §9 «계열 4개↑는 두 번째 채널 필수»의 직접 레이블 채널.
   전 원자가 아니라 대표 입자 하나씩에 붙인다(하이브리드 도식 오버레이 — §0) */
function placeMgLabel(id, wx, wy, wz) {
  const el = $(id); if (!el) return;
  if (wx === null) { el.classList.add("is-hidden"); return; }
  const pt = microProject(wx, wy, wz);
  if (!pt) { el.classList.add("is-hidden"); return; }
  el.classList.remove("is-hidden");
  const w = mcv.clientWidth, h = mcv.clientHeight || 300;
  el.style.left = clamp(pt[0] + 10, 4, Math.max(4, w - el.offsetWidth - 4)) + "px";
  el.style.top = clamp(pt[1] - el.offsetHeight - 8, 4, Math.max(4, h - el.offsetHeight - 4)) + "px";
}
function drawMicroMg() {
  if (!m3d) return;
  updateMicroView();
  M3D_BG = mgbBulkColor(SMG.p);               // 여백 = Mg 금속 → MgO 흰 배열 (F-1)
  m3dBegin(mYaw, mPitch);
  const lay = mgbLayout(SMG);
  const A = lay.atoms;
  const vp = new Array(A.length);
  for (let i = 0; i < A.length; i++) vp[i] = mView(A[i].x, A[i].y, A[i].z);
  /* 표시선 — O=O 분자만. MgO 인접쌍(mgo)·전자 부착(eat)에는 막대를 그리지 않는다(§5-7) */
  for (let b = 0; b < lay.pairs.length; b++) {
    const pr = lay.pairs[b];
    if (pr[2] === "o2") m3dStick(vp[pr[0]], vp[pr[1]], 0.016, COL_MG.stick, 1);
  }
  let selIdx = -1;
  const rep = { mg: null, o2: null, mgo: null, e: null };
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (a.el === "E") {
      /* 전자 — 어두운 림(뒤) + 밝은 코어(앞) + ⊖ 가로줄 (추정 3) */
      const r = GEO_MG.R.E * MV.s * MV.scale;
      const rim = vp[i].slice(); rim[2] -= 0.006;
      m3dSphere(rim, r * 1.45, COL_MG.eRim, 1);
      m3dSphere(vp[i], r, COL_MG.eCore, 1);
      const m1 = vp[i].slice(), m2 = vp[i].slice();
      m1[0] -= r * 0.62; m2[0] += r * 0.62; m1[2] += 0.004; m2[2] += 0.004;
      m3dStick(m1, m2, 0.006, COL_MG.eRim, 1);
      if (a.k === selectedE) selIdx = i;
      if (rep.e === null && (a.state === "flight" || a.state === "mg")) rep.e = i;
    } else if (a.el === "Mg") {
      const k = a.ion ? 0.45 : 0;             // Mg²⁺ — 흰 기운으로 수렴(라벨은 칩·범례가 맡는다)
      m3dSphere(vp[i], GEO_MG.R.Mg * MV.s * MV.scale, k ? tint(COL_MG.Mg, k) : COL_MG.Mg, 1);
      if (rep.mg === null && !a.ion) rep.mg = i;
    } else {
      const bound = a.phase === "bound";
      const k = bound ? 0.55 : 0;
      m3dSphere(vp[i], GEO_MG.R.O * MV.s * MV.scale, k ? tint(COL_MG.O, k) : COL_MG.O, 1);
      if (rep.o2 === null && a.phase === "air") rep.o2 = i;
      if (rep.mgo === null && bound) rep.mgo = i;
    }
  }
  if (selIdx >= 0) {
    const a = A[selIdx];
    m3dSphere(vp[selIdx], GEO_MG.R.E * MV.s * MV.scale * 2.6, COL_MG.halo, 0.3);
    const e = SMG.elec[selectedE];
    if (e.oIdx !== null) {                    // 이동 경로 자취 — 반박 장치의 핵심 시각
      const mp = mgSite(e.mgIdx), sy = (selectedE % 2 === 0) ? 1 : -1;
      const fr = { x: mp.x + GEO_MG.E_OFF.x, y: mp.y + sy * GEO_MG.E_OFF.y, z: GEO_MG.E_OFF.z };
      const oa = A[24 + e.oIdx];              // atoms 배열: Mg 24 → O 24 → E 48
      const pts = [
        mView(fr.x, fr.y, fr.z), mView(fr.x, fr.y, GEO_MG.Z_FLY),
        mView(oa.x + 0.4, oa.y + sy * 0.5, GEO_MG.Z_FLY), vp[selIdx]
      ];
      for (let k2 = 0; k2 < pts.length - 1; k2++)
        m3dStick(pts[k2], pts[k2 + 1], 0.008, COL_MG.trace, 0.55);
    }
  }
  m3dFlush();
  /* 대표 라벨 — 대표 입자가 없으면 그 라벨은 숨긴다 */
  placeMgLabel("mgLblMg", rep.mg !== null ? A[rep.mg].x : null,
    rep.mg !== null ? A[rep.mg].y : 0, rep.mg !== null ? A[rep.mg].z : 0);
  placeMgLabel("mgLblO2", rep.o2 !== null ? A[rep.o2].x : null,
    rep.o2 !== null ? A[rep.o2].y : 0, rep.o2 !== null ? A[rep.o2].z : 0);
  placeMgLabel("mgLblMgO", rep.mgo !== null ? A[rep.mgo].x : null,
    rep.mgo !== null ? A[rep.mgo].y : 0, rep.mgo !== null ? A[rep.mgo].z : 0);
  placeMgLabel("mgLblE", rep.e !== null ? A[rep.e].x : null,
    rep.e !== null ? A[rep.e].y : 0, rep.e !== null ? A[rep.e].z : 0);
}
/* 전자 픽킹 — 화면 투영 최근접 (반박 장치: 전자 추적 · 탭2) */
function pickElec(px, py) {
  if (!m3d || !m3dView) return -1;
  updateMicroView();
  const lay = mgbLayout(SMG);
  let best = -1, bestD = 24;
  for (let i = 0; i < lay.atoms.length; i++) {
    const a = lay.atoms[i];
    if (a.el !== "E") continue;
    const pt = microProject(a.x, a.y, a.z);
    if (!pt) continue;
    const d = Math.hypot(pt[0] - px, pt[1] - py);
    if (d < bestD) { bestD = d; best = a.k; }
  }
  return best;
}

/* ================= 조작 · 판독 ================= */
function setHeat(on) {
  S.heat = on;
  const b = $("heatBtn");
  b.textContent = on ? CUO_D.heatBtnOff : CUO_D.heatBtnOn;
  b.setAttribute("aria-pressed", on ? "true" : "false");
}
/* 점화 버튼 상태(탭2) — 문자열은 등록 표에서. 매 프레임 DOM 쓰기를 피하는 캐시 키 */
let heatBtnKey = "";
function updateHeatBtn() {
  const b = $("heatBtn"), d = expData();
  let key, txt, dis, pressed;
  if (EXP === "cuo") {
    key = "cuo:" + (S.heat ? 1 : 0);
    txt = S.heat ? d.heatBtnOff : d.heatBtnOn; dis = false; pressed = S.heat;
  } else if (EXP !== "mgburn") {                // 미지 id — 조작 없음(확장 대비 기본값)
    key = "x:" + EXP; txt = d.heatBtnOn || "—"; dis = true; pressed = false;
  } else if (SMG.done) { key = "mg:done"; txt = d.heatBtnDone; dis = true; pressed = false; }
  else if (SMG.ignited) { key = "mg:burn"; txt = d.heatBtnOff; dis = true; pressed = true; }
  else if (SMG.torch) { key = "mg:torch"; txt = d.heatBtnLighting; dis = true; pressed = true; }
  else { key = "mg:idle"; txt = d.heatBtnOn; dis = false; pressed = false; }
  if (key === heatBtnKey) return;
  heatBtnKey = key;
  b.textContent = txt; b.disabled = dis;
  b.setAttribute("aria-pressed", pressed ? "true" : "false");
}
$("heatBtn").onclick = () => {
  if (EXP === "cuo") setHeat(!S.heat);
  else if (!SMG.torch && !SMG.ignited && !SMG.done) { SMG.torch = true; updateHeatBtn(); }
};
$("resetBtn").onclick = () => {                 // 활성 탭만 초기화 — 숨은 탭 상태는 §5-13
  if (EXP === "cuo") {
    S = redoxInit(); selectedO = -1; heatVis = 0; bubbleVis = 0;
    setHeat(false);
  } else {
    SMG = mgbInit(); selectedE = -1; lightVis = 0;
    heatBtnKey = ""; updateHeatBtn();
  }
  updateTrace();
};

/* ── 탭 전환 (가시성은 이 함수 하나가 쓴다 — §13 ①. 숨은 탭은 loop 가 시간을 멈춘다) ── */
function applyExp() {
  const d = expData();
  document.querySelectorAll("#expTabs .stg").forEach(b => {
    b.setAttribute("aria-pressed", b.getAttribute("data-expid") === EXP ? "true" : "false");
  });
  document.querySelectorAll("[data-exp]").forEach(el => {
    const mine = el.getAttribute("data-exp") === EXP;
    el.style.display = mine ? (el.getAttribute("data-disp") || "block") : "none";
  });
  /* 진행 배지 — 등록 표가 원천(F-1). 초기 정적 마크업(탭1)과 같은 문자열을 다시 그린다 */
  const bwrap = $("stageBadges");
  bwrap.innerHTML = "";
  for (let n = 1; n < d.stages.length; n++) {
    const sp = document.createElement("span");
    sp.className = "stagebadge";
    sp.setAttribute("data-stage", String(n));
    sp.textContent = d.stages[n];
    bwrap.appendChild(sp);
  }
  document.querySelector(".redox-head .sub").innerHTML = d.sub;
  $("macro").setAttribute("aria-label", d.ariaMacro);
  $("micro").setAttribute("aria-label", d.ariaMicro);
  $("heatNote").textContent = d.heatNote;
  heatBtnKey = ""; updateHeatBtn();
  updateTrace();
  applyZoom();
  updateReadouts();
}
/* 탭 클릭 배선은 initAll 이 등록 표 순회로 단다(생성 버튼 포함) */
$("camBtn").onclick = () => {
  zAnim = null; camPre = null;
  cam = Object.assign({}, CAM0); mYaw = MV.yaw; mPitch = MV.pitch;
};

/* 거시 ↔ 미시 전환. 들어갈 때는 카메라가 시험관 속 가루를 향해 «줌 인»한 뒤 입자 화면으로
   바뀐다 — 지금 보는 배열이 산화 구리(Ⅱ) 가루의 속임을 시점 연속으로 알린다(2026-08-27
   사용자 지시). prefers-reduced-motion 이면 연출 없이 즉시 전환(§10). */
let zAnim = null, camPre = null;
const ZOOM_CAM = { yaw: -0.08, pitch: 0.14, dist: 1.35, tx: -1.0, ty: 1.38 };
function applyZoom() {
  $("microWrap").style.display = zoom ? "block" : "none";
  $("microCaption").classList.toggle("is-hidden", !(zoom && EXP === "cuo"));
  $("microCaptionMg").classList.toggle("is-hidden", !(zoom && EXP === "mgburn"));
  $("traceCard").classList.toggle("is-hidden", !zoom);
  $("zoomBtn").textContent = zoom ? "실험 장치로 돌아가기" : "분자 크기로 확대해 보기";
  $("zoomBtn").setAttribute("aria-pressed", zoom ? "true" : "false");
  $("camHint").classList.toggle("is-hidden", zoom || !T3);
  ["lblPowder", "lblLime", "lblLamp"].forEach(id => {
    if (zoom || EXP !== "cuo") $(id).classList.add("is-hidden");   // 거시 라벨은 미시·타 탭에 남기지 않는다
  });
  if (!zoom || EXP !== "mgburn")
    ["mgLblMg", "mgLblO2", "mgLblMgO", "mgLblE"].forEach(id => $(id).classList.add("is-hidden"));
  if (zoom && !m3d) $("microFallback").style.display = "block";
}
function finishZoomAnim() {
  if (!zAnim) return;
  const a = zAnim; zAnim = null;
  for (const f of ["yaw", "pitch", "dist", "tx", "ty"]) cam[f] = a.to[f];
  if (a.then) a.then();
}
$("zoomBtn").onclick = () => {
  finishZoomAnim();                                 // 연타에도 상태가 결정적이게
  const target = !zoom;
  if (target) {
    if (T3 && !RM) {
      camPre = Object.assign({}, cam);
      zAnim = { t: 0, dur: 0.65, from: Object.assign({}, cam),
                to: Object.assign({}, ZOOM_CAM),
                then: () => { zoom = true; applyZoom(); } };
    } else { zoom = true; applyZoom(); }
  } else {
    zoom = false; applyZoom();
    if (T3 && camPre) {
      if (RM) cam = Object.assign({}, camPre);
      else zAnim = { t: 0, dur: 0.5, from: Object.assign({}, cam),
                     to: Object.assign({}, camPre), then: null };
      camPre = null;
    }
  }
};

/* 드래그 회전 + 휠 확대 (거시) / 드래그 회전 + 클릭 픽킹 (미시) */
function bindOrbit(cv, isMicro) {
  let down = null;
  cv.addEventListener("pointerdown", e => {
    down = { x: e.clientX, y: e.clientY, moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
    if (!down.moved) return;
    if (isMicro) {
      mYaw = clamp(mYaw + dx * 0.005, -0.4, 1.1);
      mPitch = clamp(mPitch + dy * 0.005, -0.1, 0.9);
    } else {
      cam.yaw = clamp(cam.yaw + dx * 0.005, -1.4, 1.4);
      cam.pitch = clamp(cam.pitch + dy * 0.005, -0.05, 1.1);
    }
    down.x = e.clientX; down.y = e.clientY;
  });
  cv.addEventListener("pointerup", e => {
    if (isMicro && down && !down.moved) {
      const r = cv.getBoundingClientRect();
      if (EXP === "cuo") {
        const hit = pickOxy(e.clientX - r.left, e.clientY - r.top);
        if (hit >= 0) { selectedO = hit; updateTrace(); }
      } else {
        const hit = pickElec(e.clientX - r.left, e.clientY - r.top);
        if (hit >= 0) { selectedE = hit; updateTrace(); }
      }
    }
    down = null;
  });
  cv.addEventListener("pointercancel", () => { down = null; });
  if (!isMicro)
    cv.addEventListener("wheel", e => {
      e.preventDefault();
      cam.dist = clamp(cam.dist + (e.deltaY > 0 ? 0.3 : -0.3), 2.6, 7.5);
    }, { passive: false });
}

function updateTrace() {
  const el = $("traceCard"), tr = expData().trace || { none: "" };  // 문자열은 등록 표가 원천(F-1)
  if (EXP !== "cuo" && EXP !== "mgburn") { el.textContent = tr.none; return; }
  if (EXP === "cuo") {
    if (selectedO < 0) { el.textContent = tr.none; return; }
    const o = S.oxy[selectedO];
    el.textContent = o.state === "cuo" ? tr.wait : (o.state === "transit" ? tr.move : tr.done);
  } else {
    if (selectedE < 0) { el.textContent = tr.none; return; }
    const e = SMG.elec[selectedE];
    el.textContent = e.oIdx === null ? tr.wait
      : ((SMG.t - e.born) < MGB.FLIGHT ? tr.move : tr.done);
  }
}

const STAGE_TXT = ["", "가열 전", "가열 중", "색 변화", "기체 이동", "석회수 흐려짐", "완결"];
function setBadges(stg) {
  document.querySelectorAll("#stageBadges .stagebadge").forEach(b => {
    const n = +b.getAttribute("data-stage");
    b.classList.toggle("is-on", n === stg);
    b.classList.toggle("is-done", n < stg);
  });
}
function setChips(done) {                       // 미시 칩 — 문자열은 등록 표가 원천(F-1 · J-N5)
  const d = expData(), arr = (done ? d.chipsDone : d.chips) || [];
  const hl = $("microHeadline");
  /* 루프 상한은 «배열 길이»까지 묶는다 — chips: [] 인 확장 항목에서 arr[0].cls가 매 프레임
     throw 하던 결함(S-검토 A-1 실측: 3탭 스모크 명제 ⓑ 오류 57건). 칩이 모자라면 남는
     칩 요소는 숨긴다 — 빈 칩 실험도 등록 표 추가만으로 성립해야 한다(확장 대비) */
  const n = Math.min(2, arr.length, hl.children.length);
  for (let i = 0; i < hl.children.length; i++) {
    if (i < n) {
      hl.children[i].style.display = "";
      hl.children[i].className = arr[i].cls;
      hl.children[i].innerHTML = '<i class="sw" style="background:' + arr[i].sw + '"></i>' + arr[i].html;
    } else hl.children[i].style.display = "none";
  }
}
function updateReadouts() {
  if (EXP === "cuo") {
    const lost = redoxLostByCu(S), gained = redoxGainedByC(S);
    $("lostVal").textContent = lost;
    $("gainVal").textContent = gained;
    $("co2Val").textContent = S.absorbed;
    $("limeState").textContent =
      S.turb >= 1 ? "뿌옇게 흐려짐" : (S.absorbed > 0 ? "흐려지는 중" : "맑음");
    setBadges(redoxStage(S));
    $("eqOxBk").classList.toggle("is-hot", gained > 0);
    $("eqOxLbl").classList.toggle("is-hot", gained > 0);
    $("eqRedBk").classList.toggle("is-hot", lost > 0);
    $("eqRedLbl").classList.toggle("is-hot", lost > 0);
    const conc = $("concLine");
    if (zoom && lost >= 2 && lost === gained) { // J-N5 — 미시 화면에서, 지금 수치가 근거일 때만
      conc.classList.remove("is-hidden");
      $("concL").textContent = lost; $("concG").textContent = gained;
    } else conc.classList.add("is-hidden");
    $("concLineMg").classList.add("is-hidden");
    /* 미시 칩도 화면 상태와 모순되지 않게(J-N5) — 완결이면 남은 것은 구리뿐이다 */
    setChips(lost >= REDOX.N_CUO);
    if (selectedO >= 0) updateTrace();
  } else if (EXP !== "mgburn") {                // 미지 id(확장 대비 기본값) — 배지·칩만
    setBadges(1);
    setChips(false);                            // 빈 chips도 setChips가 안전 처리(S-검토 A-1)
    $("concLine").classList.add("is-hidden");
    $("concLineMg").classList.add("is-hidden");
    updateHeatBtn();
  } else {
    const c = mgbCounts(SMG);
    $("mgLostVal").textContent = c.lost;
    $("mgGainVal").textContent = c.gained;
    $("mgLeftState").textContent = c.mgLeft + "개";
    $("mgoState").textContent = c.mgo + "단위";
    setBadges(mgbStage(SMG));
    $("mgOxBk").classList.toggle("is-hot", c.lost > 0);
    $("mgOxLbl").classList.toggle("is-hot", c.lost > 0);
    $("mgRedBk").classList.toggle("is-hot", c.gained > 0);
    $("mgRedLbl").classList.toggle("is-hot", c.gained > 0);
    const conc = $("concLineMg");
    if (zoom && c.lost >= 4 && c.lost === c.gained) {   // J-N5 — n≥4(이벤트 1회분)부터
      conc.classList.remove("is-hidden");
      $("concLMg").textContent = c.lost; $("concGMg").textContent = c.gained;
    } else conc.classList.add("is-hidden");
    $("concLine").classList.add("is-hidden");
    setChips(c.lost >= MGB.E_PER_MG * MGB.N_MG);
    updateHeatBtn();
    if (selectedE >= 0) updateTrace();
  }
}

/* CSV — 학번 + 활동지 답 (liquid 방식) */
$("csvBtn").onclick = () => {
  const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
  const heads = ["학번", "문항1", "문항2", "문항3", "문항4", "문항5", "문항6", "문항7",
                 "마그네슘1", "마그네슘2", "마그네슘3", "마그네슘4"];
  const row = [$("seat").value.trim() || "무기명"];
  for (let i = 1; i <= 7; i++) row.push($("q" + i).value);
  for (let i = 1; i <= 4; i++) row.push($("mgq" + i).value);
  const csv = "﻿" + heads.map(esc).join(",") + "\r\n" + row.map(esc).join(",");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = (($("seat").value.trim() || "무기명").replace(/[\\/:*?"<>|]/g, "")) + "_산화와환원.csv";
  document.body.appendChild(a); a.click(); a.remove();
};

/* ================= 루프 (§10 — raf 하나 · 숨으면 정지) ================= */
let rafId = null, lastT = null;
function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (lastT === null) { lastT = now; return; }
  const dt = clamp((now - lastT) / 1000, 0, 0.06);
  lastT = now;
  if (zAnim) {                                      // 줌 인·아웃 카메라 연출 — 벽시계 기준
    if (zAnim.t0 === undefined) zAnim.t0 = now;     //   (느린 기기의 낮은 fps에서도 제 시간에 끝난다)
    const k = Math.min(1, (now - zAnim.t0) / 1000 / zAnim.dur), e = 1 - Math.pow(1 - k, 3);
    for (const f of ["yaw", "pitch", "dist", "tx", "ty"])
      cam[f] = zAnim.from[f] + (zAnim.to[f] - zAnim.from[f]) * e;
    if (k >= 1) finishZoomAnim();
  }
  /* 활성 탭만 시간이 흐른다(§5-13) — 숨은 탭은 일시정지, 복귀하면 이어진다 */
  if (EXP === "cuo") {
    redoxStep(S, dt);
    heatVis += ((S.heat ? 1 : 0) - heatVis) * Math.min(1, dt * 4);
    /* 기포는 CO₂가 석회수에 «도달한 뒤» 3초 동안 — 도달 전에 미리 솟지 않는다(S-검토 B-2) */
    const wantBub = S.tubeArrivals.some(a => a <= S.t && a > S.t - 3) ? 1 : 0;
    bubbleVis += (wantBub - bubbleVis) * Math.min(1, dt * 3);
  } else if (EXP === "mgburn") {
    mgbStep(SMG, dt);
    if (SMG.ignited && SMG.torch) { SMG.torch = false; heatBtnKey = ""; }  // 점화되면 토치 회수
    lightVis += (mgbLight(SMG) - lightVis) * Math.min(1, dt * 5);
  }                                             // 미지 id(확장 대비 기본값) — 빈 상태·시간 정지
  updateReadouts();
  if (zoom) { if (EXP === "cuo") drawMicro(); else if (EXP === "mgburn") drawMicroMg(); }
  else { if (EXP === "cuo") macroRender(now / 1000); else if (EXP === "mgburn") macroRenderMg(now / 1000); }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; lastT = null; }
  else if (!rafId) rafId = requestAnimationFrame(loop);
});

/* ================= 초기화 ================= */
(function initAll() {
  try { T3 = buildMacro(); } catch (e) { console.error(e); T3 = null; }
  try { T3MG = buildMacroMg(); } catch (e) { console.error(e); T3MG = null; }
  if (!T3) {
    $("macroFallback").style.display = "block";
    $("macro").style.display = "none";
    $("camHint").classList.add("is-hidden");
  } else {
    macroResize();
    if (typeof ResizeObserver !== "undefined")
      new ResizeObserver(macroResize).observe($("macro"));
    bindOrbit($("macro"), false);
  }
  initM3D();
  if (mcv && m3d) bindOrbit(mcv, true);
  /* 탭 버튼 — 등록 표가 원천(F-1). 정적 버튼(2개)을 라벨링하고, 등록 표가 더 길면
     «부족분을 생성»한다 — 3번째 실험은 EXPERIMENTS_DATA 항목 추가만으로 탭이 성립한다
     (확장 대비 — 확정 4. 씬·상태 연결이 없는 항목은 기본값: 빈 무대·빈 상태) */
  const tabWrap = $("expTabs");
  const btns = tabWrap.querySelectorAll(".stg");
  for (let i = 0; i < EXPERIMENTS_DATA.length; i++) {
    let b = btns[i];
    if (!b) {
      b = document.createElement("button");
      b.className = "stg tab";
      b.setAttribute("data-tab", String(i + 1));
      b.setAttribute("aria-pressed", "false");
      tabWrap.appendChild(b);
    }
    b.textContent = EXPERIMENTS_DATA[i].tab;
    b.setAttribute("data-expid", EXPERIMENTS_DATA[i].id);
    b.onclick = () => {
      const id = b.getAttribute("data-expid");
      if (id === EXP) return;
      EXP = id;
      applyExp();
    };
  }
  applyExp();
  rafId = requestAnimationFrame(loop);
})();
