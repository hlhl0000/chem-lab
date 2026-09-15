/* ============================================================
   중화 반응과 남은 이온 — neutralize/sim.js
   통합과학2 Ⅰ-2 · 6~7차시 · 반박 대상 M14

   ⚠ 성취기준 [10통과2-01-04] 해설 — 중화 반응 과정에서의 변화는
      「용액의 온도 변화와 지시약의 색 변화만」 다룬다.
      → pH 축·전기 전도도·양적 계산을 이 화면에 넣지 않는다.
   ============================================================ */
"use strict";

/* ================= 계산부 (모형) =================
   이 구역은 검증스크립트/neutralize_core.js 와 문자 단위로 같다.
   아래 절단 마커까지가 core 이며, 마커 주석을 지우거나 바꾸면 동기 검사가 깨진다. */

var NEU = {
  C:    1.0,    /* mol/L  지도서 116쪽 탐구 유의점 1 「적절한 온도 변화를 보려면 1 M이 적당」 */
  T0:   20.0,   /* ℃      실온 (가정 — 화면과 「가정과 한계」에 명시) */
  DH:   57.3,   /* kJ/mol 강산+강염기 중화열 문헌값 (H⁺(aq)+OH⁻(aq)→H₂O(l)) */
  CP:   4.18,   /* J/(g·K) 물의 비열 */
  RHO:  1.0,    /* g/mL   용액 밀도 가정 */
  PPML: 1,      /* 화면에 1 mL 를 입자 «몇 개»로 그리는가 (도식) */
  VMAX: 12,     /* mL     슬라이더 상한 */
  VTOT: 12      /* mL     홈판 절차의 총 부피 — 그래프에 올릴 수 있는 조합의 조건 */
};

/* 섞기 «전» 이온 개수 (도식). 완전 해리를 가정한다 */
function neuIonsBefore(va, vb) {
  return { H: va * NEU.PPML, Cl: va * NEU.PPML, Na: vb * NEU.PPML, OH: vb * NEU.PPML };
}

/* 섞은 «뒤» 남은 이온 개수 + 생긴 물 분자 수.
   H⁺ + OH⁻ → H₂O 만 일어나고, Na⁺·Cl⁻ 는 아무 일도 겪지 않는다(구경꾼) */
function neuIonsAfter(va, vb) {
  var b = neuIonsBefore(va, vb);
  var pair = Math.min(b.H, b.OH);
  return { H: b.H - pair, OH: b.OH - pair, Na: b.Na, Cl: b.Cl, W: pair };
}

/* 실제로 반응한 몰수 — 개수 도식이 아니라 «농도×부피»로 따로 계산한다 */
function neuMolReacted(va, vb) { return Math.min(va, vb) * NEU.C / 1000; }

/* 방출된 열 (J) */
function neuHeatJ(va, vb) { return NEU.DH * 1000 * neuMolReacted(va, vb); }

/* 온도 상승 (K) — 열손실 무시, 용액의 비열을 물과 같다고 본다 */
function neuDeltaT(va, vb) {
  var m = (va + vb) * NEU.RHO;
  if (m <= 0) return 0;
  return neuHeatJ(va, vb) / (m * NEU.CP);
}
function neuMaxTemp(va, vb) { return NEU.T0 + neuDeltaT(va, vb); }

/* 액성 — 남은 이온이 정한다. 「중화 반응이 일어났는가」가 아니라 「무엇이 남았는가」 */
function neuNature(va, vb) {
  var a = neuIonsAfter(va, vb);
  if (a.H  > 0) return "acid";
  if (a.OH > 0) return "base";
  if (a.W === 0 && a.Na === 0 && a.Cl === 0) return "none";
  return "neutral";
}
function neuNatureLabel(n) {
  return n === "acid" ? "산성" : n === "base" ? "염기성" : n === "neutral" ? "중성" : "—";
}

/* BTB 용액의 «실물» 색 — 사이트 테마 색이 아니다(매뉴얼 P6 예외 2).
   색만으로 알리지 않는다 — 화면에는 늘 글자 라벨을 함께 낸다(매뉴얼 §8) */
function neuBTB(n) {
  return n === "acid" ? "#e8cc16" : n === "base" ? "#17509e"
       : n === "neutral" ? "#46a03a" : "#eaf1f7";
}

/* 지시약 두 가지 (사용자 지시 2026-09-14). 성취기준 [01-04]의 「지시약의 색 변화」 안이다.
   페놀프탈레인은 염기성에서만 붉고 산성·중성에서는 «무색» — 그래서 무색이면 산성인지 중성인지
   이 지시약만으로는 가르지 못한다(로드맵 M5: 지시약마다 색이 변하는 범위가 다르다) */
var NEU_IND = [
  { id: "btb",  name: "BTB 용액" },
  { id: "phph", name: "페놀프탈레인 용액" }
];
function neuIndName(ind) {
  for (var i = 0; i < NEU_IND.length; i++) if (NEU_IND[i].id === ind) return NEU_IND[i].name;
  return "지시약";
}
/* 지시약을 넣은 뒤 용액의 «실물» 색 (P6 예외 2). 무색 = 지시약 넣기 전 물색과 같다 */
function neuIndColor(ind, n) {
  if (ind === "btb") return neuBTB(n);
  if (ind === "phph") return n === "base" ? "#e0407a" : neuBTB("none");
  return neuBTB("none");
}
/* 지시약이 «말해 줄 수 있는» 액성. determinate 가 거짓이면 판정·기록에 쓰지 않는다 */
function neuIndReading(ind, n) {
  if (n === "none") return { text: "—", color: "없음", determinate: false, nature: null };
  if (ind === "btb")
    return { text: neuNatureLabel(n),
             color: n === "acid" ? "노란색" : n === "base" ? "파란색" : "초록색",
             determinate: true, nature: n };
  if (ind === "phph")
    return n === "base" ? { text: "염기성", color: "붉은색", determinate: true, nature: "base" }
                        : { text: "산성 또는 중성", color: "무색", determinate: false, nature: null };
  return { text: "—", color: "", determinate: false, nature: null };
}

/* 전하 총합 — 섞기 전후 모두 0이어야 한다 (검산용) */
function neuCharge(o) { return (o.H + (o.Na || 0)) - (o.OH + (o.Cl || 0)); }

/* 홈판 A~E — 지도서 116쪽 탐구 절차 그대로 (총 부피 12 mL) */
var NEU_PRESET = [
  { k: "A", va: 2,  vb: 10 },
  { k: "B", va: 4,  vb: 8  },
  { k: "C", va: 6,  vb: 6  },
  { k: "D", va: 8,  vb: 4  },
  { k: "E", va: 10, vb: 2  }
];

/* 그래프에 올릴 수 있는 조합인가 — 아무것도 안 넣은 것만 뺀다.
   (2026-09-14: 총 부피 12 mL 제한을 풀었다 — 실험 조건을 자유로 바꾸고 「실험 종료」 때 전부 그린다.
   총 부피가 같을 때만 최고 온도끼리 비교가 뜻을 갖는다는 것은 그래프 아래 문구가 밝힌다) */
function neuPlottable(va, vb) { return (va + vb) > 0; }
/* 홈판처럼 총 부피가 같은 기록만 있는가 — 그래프 문구가 이것을 보고 「비교해도 된다/안 된다」를 말한다 */
function neuSameTotal(recs) {
  if (!recs.length) return true;
  var t = recs[0].va + recs[0].vb;
  for (var i = 1; i < recs.length; i++) if (recs[i].va + recs[i].vb !== t) return false;
  return true;
}

/* ================= UI + 렌더 ================= */

/* ───────── 도식·자세 모듈 — 코덱스 납품 2026-09-14 (검증스크립트/_neutralize_fx1/neutralize_design.js · 수정 없이 그대로 · gpt-5.6-sol) ─────────
   계약·검증 결과는 같은 폴더 README.md (Codex_디자인요청_중화반응관찰_v1.md §3·§4). 이 블록이 없으면 아래 FALLBACK_DESIGN 이 같은 계약으로 돈다.
   sha256 757a62abd3aed1a4 */
(function () {
  "use strict";

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function smooth(value) {
    var t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function easeOut(value) {
    var t = clamp01(value);
    return 1 - Math.pow(1 - t, 3);
  }

  function beakerPath(g, x, y, w, h, inset) {
    var left = x + inset;
    var right = x + w - inset;
    var top = y + inset;
    var bottom = y + h - inset;
    var radius = Math.min(10, (right - left) / 2, (bottom - top) / 2);
    g.beginPath();
    g.moveTo(left, top);
    g.lineTo(left, bottom - radius);
    g.quadraticCurveTo(left, bottom, left + radius, bottom);
    g.lineTo(right - radius, bottom);
    g.quadraticCurveTo(right, bottom, right, bottom - radius);
    g.lineTo(right, top);
    g.closePath();
  }

  function ellipsePath(g, cx, cy, rx, ry) {
    var k = 0.5522847498;
    g.beginPath();
    g.moveTo(cx + rx, cy);
    g.bezierCurveTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry);
    g.bezierCurveTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy);
    g.bezierCurveTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry);
    g.bezierCurveTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy);
    g.closePath();
  }

  function finishState(g) {
    g.globalAlpha = 1;
    g.setLineDash([]);
  }

  function beakerBack(g, spec) {
    var x = spec.x;
    var y = spec.y;
    var w = spec.w;
    var h = spec.h;
    var surface = spec.surface;
    var colors = spec.colors;
    var left = x + 1.5;
    var right = x + w - 1.5;
    var topLeft;
    var topRight;

    if (!surface) return;
    topLeft = y + surface.a * 1.5 + surface.b;
    topRight = y + surface.a * (w - 1.5) + surface.b;

    g.save();
    beakerPath(g, x, y, w, h, 1.5);
    g.clip();
    g.globalAlpha = clamp01(spec.alpha);
    g.fillStyle = spec.color;
    g.beginPath();
    g.moveTo(left, topLeft);
    g.lineTo(right, topRight);
    g.lineTo(right, y + h);
    g.lineTo(left, y + h);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = colors.waterLine;
    g.lineWidth = 1.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(left, topLeft);
    g.lineTo(right, topRight);
    g.stroke();
    finishState(g);
    g.restore();
  }

  function beakerFront(g, spec) {
    var x = spec.x;
    var y = spec.y;
    var w = spec.w;
    var h = spec.h;
    var ticks = spec.ticks || [];
    var colors = spec.colors;
    var i;
    var tick;
    var length;

    g.save();
    g.strokeStyle = colors.glassLine;
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + h - 10);
    g.quadraticCurveTo(x, y + h, x + 10, y + h);
    g.lineTo(x + w - 10, y + h);
    g.quadraticCurveTo(x + w, y + h, x + w, y + h - 10);
    g.lineTo(x + w, y);
    g.stroke();

    g.strokeStyle = colors.glassHi;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(x + 7, y + 12);
    g.lineTo(x + 7, y + h - 22);
    g.stroke();

    g.strokeStyle = colors.t3;
    g.lineCap = "butt";
    for (i = 0; i < ticks.length; i += 1) {
      tick = ticks[i];
      length = tick.major ? 12 : 7;
      g.lineWidth = tick.major ? 1.2 : 0.8;
      g.beginPath();
      if (spec.tickSide === "left") {
        g.moveTo(x, tick.y);
        g.lineTo(x + length, tick.y);
      } else {
        g.moveTo(x + w, tick.y);
        g.lineTo(x + w - length, tick.y);
      }
      g.stroke();
    }
    finishState(g);
    g.restore();
  }

  function stream(g, spec) {
    var dx = spec.x1 - spec.x0;
    var dy = spec.y1 - spec.y0;
    var distance = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / distance;
    var ny = dx / distance;
    var halfTop = spec.width * 0.34;
    var halfBottom = spec.width * 0.54;
    var c1x = spec.x0 + dx * 0.28;
    var c1y = spec.y0 + dy * 0.18;
    var c2x = spec.x0 + dx * 0.73;
    var c2y = spec.y0 + dy * 0.86;

    g.save();
    g.fillStyle = spec.color;
    g.strokeStyle = spec.colors.waterLine;
    g.lineWidth = Math.max(0.8, spec.width * 0.12);
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(spec.x0 + nx * halfTop, spec.y0 + ny * halfTop);
    g.bezierCurveTo(c1x + nx * halfTop, c1y + ny * halfTop,
      c2x + nx * halfBottom, c2y + ny * halfBottom,
      spec.x1 + nx * halfBottom, spec.y1 + ny * halfBottom);
    g.lineTo(spec.x1 - nx * halfBottom, spec.y1 - ny * halfBottom);
    g.bezierCurveTo(c2x - nx * halfBottom, c2y - ny * halfBottom,
      c1x - nx * halfTop, c1y - ny * halfTop,
      spec.x0 - nx * halfTop, spec.y0 - ny * halfTop);
    g.closePath();
    g.fill();
    g.stroke();
    finishState(g);
    g.restore();
  }

  function thermometer(g, spec) {
    var x = spec.x;
    var top = spec.top;
    var bottom = spec.bottom;
    var width = spec.width;
    var bulbR = spec.bulbR;
    var colors = spec.colors;
    var tubeBottom = bottom - bulbR * 0.45;
    var innerHalf = Math.max(1.2, width * 0.18);
    var innerTop = top + 5;
    var columnTop = tubeBottom - (tubeBottom - innerTop) * clamp01(spec.frac);
    var ticks = spec.ticks || [];
    var i;

    g.save();
    g.fillStyle = colors.h2oH;
    g.strokeStyle = colors.glassLine;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x - width / 2, top + width / 2);
    g.quadraticCurveTo(x - width / 2, top, x, top);
    g.quadraticCurveTo(x + width / 2, top, x + width / 2, top + width / 2);
    g.lineTo(x + width / 2, tubeBottom);
    g.lineTo(x - width / 2, tubeBottom);
    g.closePath();
    g.fill();
    g.stroke();

    g.beginPath();
    g.arc(x, bottom, bulbR, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    g.fillStyle = colors.mercury;
    g.beginPath();
    g.arc(x, bottom, Math.max(1, bulbR - 2.2), 0, Math.PI * 2);
    g.fill();
    if (spec.frac > 0) {
      g.fillRect(x - innerHalf, columnTop, innerHalf * 2, tubeBottom - columnTop + 1);
    }

    g.strokeStyle = colors.t3;
    g.lineCap = "butt";
    for (i = 0; i < ticks.length; i += 1) {
      g.lineWidth = ticks[i].major ? 1.2 : 0.8;
      g.beginPath();
      g.moveTo(x + width / 2, ticks[i].y);
      g.lineTo(spec.tickX1, ticks[i].y);
      g.stroke();
    }

    g.strokeStyle = colors.glassHi;
    g.lineWidth = Math.max(1, width * 0.13);
    g.beginPath();
    g.moveTo(x - width * 0.18, top + 5);
    g.lineTo(x - width * 0.18, tubeBottom - 3);
    g.stroke();
    finishState(g);
    g.restore();
  }

  function dropper(g, spec) {
    var x = spec.x;
    var tipY = spec.tipY;
    var colors = spec.colors;

    g.save();
    g.fillStyle = colors.t2;
    g.strokeStyle = colors.t1;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 6, tipY - 64);
    g.quadraticCurveTo(x - 10, tipY - 58, x - 8, tipY - 50);
    g.quadraticCurveTo(x - 7, tipY - 45, x - 4, tipY - 43);
    g.lineTo(x + 4, tipY - 43);
    g.quadraticCurveTo(x + 7, tipY - 45, x + 8, tipY - 50);
    g.quadraticCurveTo(x + 10, tipY - 58, x + 6, tipY - 64);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = colors.h2oH;
    g.strokeStyle = colors.glassLine;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x - 3.7, tipY - 44);
    g.lineTo(x - 2.3, tipY - 8);
    g.lineTo(x, tipY);
    g.lineTo(x + 2.3, tipY - 8);
    g.lineTo(x + 3.7, tipY - 44);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = spec.stockColor;
    g.globalAlpha = 0.82;
    g.beginPath();
    g.moveTo(x - 2.1, tipY - 36);
    g.lineTo(x - 1.3, tipY - 9);
    g.lineTo(x, tipY - 3);
    g.lineTo(x + 1.3, tipY - 9);
    g.lineTo(x + 2.1, tipY - 36);
    g.closePath();
    g.fill();
    finishState(g);
    g.restore();
  }

  function drop(g, spec) {
    var x = spec.x;
    var y = spec.y;
    var r = spec.r;

    g.save();
    g.fillStyle = spec.color;
    g.strokeStyle = spec.colors.waterLine;
    g.lineWidth = Math.max(0.7, r * 0.22);
    g.beginPath();
    g.moveTo(x, y - 1.6 * r);
    g.bezierCurveTo(x + 0.18 * r, y - 1.02 * r, x + r, y - 0.22 * r, x + r, y + 0.34 * r);
    g.bezierCurveTo(x + r, y + 0.91 * r, x + 0.56 * r, y + 1.2 * r, x, y + 1.2 * r);
    g.bezierCurveTo(x - 0.56 * r, y + 1.2 * r, x - r, y + 0.91 * r, x - r, y + 0.34 * r);
    g.bezierCurveTo(x - r, y - 0.22 * r, x - 0.18 * r, y - 1.02 * r, x, y - 1.6 * r);
    g.closePath();
    g.fill();
    g.stroke();
    finishState(g);
    g.restore();
  }

  function ripple(g, spec) {
    var t = clamp01(spec.t);
    var first = smooth(t);
    var second = smooth((t - 0.24) / 0.76);

    if (t >= 1) return;
    g.save();
    g.strokeStyle = spec.colors.waterLine;
    g.lineWidth = 1.4;
    g.globalAlpha = (1 - t) * 0.72;
    ellipsePath(g, spec.x, spec.y, spec.rx * first, spec.ry * first);
    g.stroke();
    if (second > 0) {
      g.lineWidth = 0.9;
      g.globalAlpha = (1 - t) * 0.42;
      ellipsePath(g, spec.x, spec.y, spec.rx * 0.68 * second, spec.ry * 0.68 * second);
      g.stroke();
    }
    finishState(g);
    g.restore();
  }

  function spread(g, spec) {
    var t = clamp01(spec.t);
    var left = spec.x + 1.5;
    var right = spec.x + spec.w - 1.5;
    var bottom = spec.y + spec.h - 1.5;
    var centerX = (left + right) / 2;
    var centerY = (spec.surfaceY + bottom) / 2;
    var p = smooth(t);
    var movingX = spec.cx + (centerX - spec.cx) * p;
    var movingY = spec.surfaceY + (centerY - spec.surfaceY) * p;
    var halfW = (right - left) / 2;
    var halfH = (bottom - spec.surfaceY) / 2;

    g.save();
    beakerPath(g, spec.x, spec.y, spec.w, spec.h, 1.5);
    g.clip();
    g.fillStyle = t >= 1 ? spec.to : spec.from;
    g.fillRect(left, spec.surfaceY, right - left, bottom - spec.surfaceY);
    if (t > 0 && t < 1) {
      g.fillStyle = spec.to;
      g.globalAlpha = 0.22 + 0.38 * t;
      ellipsePath(g, movingX, movingY, halfW * p, halfH * p);
      g.fill();
      g.globalAlpha = 0.18 + 0.24 * t;
      ellipsePath(g, movingX, movingY, halfW * p * 0.72, halfH * p * 0.72);
      g.fill();
      g.globalAlpha = 0.14 + 0.18 * t;
      ellipsePath(g, movingX, movingY, halfW * p * 0.44, halfH * p * 0.44);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = spec.colors.waterLine;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(left, spec.surfaceY);
    g.lineTo(right, spec.surfaceY);
    g.stroke();
    finishState(g);
    g.restore();
  }

  function ion(g, spec) {
    var scale = clamp01(spec.scale);
    var rr = spec.r * scale;
    var alpha = clamp01(spec.alpha);
    var positive = spec.kind === "H" || spec.kind === "Na";
    var reacting = spec.kind === "H" || spec.kind === "OH";
    var fillColor = spec.kind === "H" ? spec.colors.ionH :
      spec.kind === "OH" ? spec.colors.ionOH : spec.colors.ionSpec;
    var side = rr * 1.75;
    var fontSize = Math.max(9.5, spec.r * 0.78);
    var maxTextWidth = positive ? rr * 1.55 : side * 0.82;

    if (scale <= 0 || alpha <= 0) return;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = fillColor;
    g.strokeStyle = spec.colors.t2;
    g.lineWidth = reacting ? 1.8 : 1;
    g.beginPath();
    if (positive) {
      g.arc(spec.x, spec.y, rr, 0, Math.PI * 2);
    } else {
      g.moveTo(spec.x - side / 2 + rr * 0.34, spec.y - side / 2);
      g.lineTo(spec.x + side / 2 - rr * 0.34, spec.y - side / 2);
      g.quadraticCurveTo(spec.x + side / 2, spec.y - side / 2, spec.x + side / 2, spec.y - side / 2 + rr * 0.34);
      g.lineTo(spec.x + side / 2, spec.y + side / 2 - rr * 0.34);
      g.quadraticCurveTo(spec.x + side / 2, spec.y + side / 2, spec.x + side / 2 - rr * 0.34, spec.y + side / 2);
      g.lineTo(spec.x - side / 2 + rr * 0.34, spec.y + side / 2);
      g.quadraticCurveTo(spec.x - side / 2, spec.y + side / 2, spec.x - side / 2, spec.y + side / 2 - rr * 0.34);
      g.lineTo(spec.x - side / 2, spec.y - side / 2 + rr * 0.34);
      g.quadraticCurveTo(spec.x - side / 2, spec.y - side / 2, spec.x - side / 2 + rr * 0.34, spec.y - side / 2);
      g.closePath();
    }
    g.fill();
    g.stroke();

    g.fillStyle = spec.colors.h2oH;
    g.font = "600 " + fontSize + "px system-ui,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(spec.label, spec.x, spec.y + 0.04 * rr, maxTextWidth);
    g.textBaseline = "alphabetic";
    finishState(g);
    g.restore();
  }

  function water(g, spec) {
    var r = spec.r;
    var alpha = clamp01(spec.alpha);
    var halfAngle = 104.5 * Math.PI / 360;
    var bond = 0.95 * r;
    var hRadius = 0.62 * r;
    var a1 = spec.ang - Math.PI / 2 - halfAngle;
    var a2 = spec.ang - Math.PI / 2 + halfAngle;
    var h1x = spec.x + Math.cos(a1) * bond;
    var h1y = spec.y + Math.sin(a1) * bond;
    var h2x = spec.x + Math.cos(a2) * bond;
    var h2y = spec.y + Math.sin(a2) * bond;

    if (alpha <= 0 || r <= 0) return;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = spec.colors.t2;
    g.lineWidth = Math.max(1, r * 0.18);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(spec.x, spec.y);
    g.lineTo(h1x, h1y);
    g.moveTo(spec.x, spec.y);
    g.lineTo(h2x, h2y);
    g.stroke();

    g.fillStyle = spec.colors.h2oH;
    g.strokeStyle = spec.colors.t2;
    g.lineWidth = Math.max(1.1, r * 0.18);
    g.beginPath();
    g.arc(h1x, h1y, hRadius, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(h2x, h2y, hRadius, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    g.fillStyle = spec.colors.h2oO;
    g.strokeStyle = spec.colors.t2;
    g.lineWidth = Math.max(1, r * 0.14);
    g.beginPath();
    g.arc(spec.x, spec.y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    finishState(g);
    g.restore();
  }

  function burst(g, spec) {
    var t = clamp01(spec.t);
    var pulse;

    if (t >= 1) return;
    pulse = Math.sin(Math.PI * t);
    g.save();
    g.strokeStyle = spec.colors.glassHi;
    g.lineWidth = 1.4;
    g.globalAlpha = pulse * 0.78;
    g.beginPath();
    g.arc(spec.x, spec.y, spec.r * (0.45 + 1.25 * t), 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = spec.colors.waterLine;
    g.lineWidth = 0.9;
    g.globalAlpha = pulse * 0.34;
    g.beginPath();
    g.arc(spec.x, spec.y, spec.r * (0.22 + 0.82 * t), 0, Math.PI * 2);
    g.stroke();
    finishState(g);
    g.restore();
  }

  function pourPose(pp, spec) {
    var p = clamp01(pp);
    var travel = easeOut(p / 0.34);
    var tilt = smooth((p - 0.28) / 0.72);
    var contact = smooth((p - 0.28) / 0.20);
    var drain = smooth((p - 0.48) / 0.52);
    var finalAngle = Math.atan2(spec.sbh + spec.sbw, spec.sbw);
    var lift = Math.sin(Math.PI * travel) * spec.sbh * 0.16;
    var magnitude = finalAngle * tilt;
    var result = {
      x: spec.rest.x + (spec.target.x - spec.rest.x) * travel,
      y: spec.rest.y + (spec.target.y - spec.rest.y) * travel - lift,
      angle: -spec.side * magnitude,
      depth: 1 - contact,
      remain: 1 - drain,
      streamOn: p >= 0.48 && p < 1
    };
    if (p >= 1) {
      result.x = spec.target.x;
      result.y = spec.target.y;
      result.depth = 0;
      result.remain = 0;
      result.streamOn = false;
    }
    return result;
  }

  function dropTimeline(q, i, n) {
    var p = clamp01(q);
    var count = n > 0 ? n : 1;
    var index = i < 0 ? 0 : i >= count ? count - 1 : i;
    var slot = dropTimeline.spreadStart / count;
    var start = index * slot;
    var fallEnd = start + slot * 0.64;
    var end = start + slot;
    var fall = null;
    var rippleValue = null;
    var local;

    if (p >= start && p < fallEnd) {
      local = (p - start) / (fallEnd - start);
      fall = local * local;
    } else if (p >= fallEnd && p < end) {
      rippleValue = (p - fallEnd) / (end - fallEnd);
    }
    return { fall: fall, ripple: rippleValue };
  }
  dropTimeline.spreadStart = 0.72;
  Object.freeze(dropTimeline);

  function mergePose(e) {
    var p = clamp01(e);
    var meet = smooth(p / 0.90);
    var ionFade = smooth((p - 0.62) / 0.20);
    var waterGrow = smooth((p - 0.54) / 0.24);
    var burstValue = null;

    if (p >= 0.50 && p < 0.82) burstValue = (p - 0.50) / 0.32;
    if (p >= 1) {
      return {
        gap: 0,
        ionScale: 0,
        ionAlpha: 0,
        waterScale: 1,
        waterAlpha: 1,
        burst: null
      };
    }
    return {
      gap: 1 - meet,
      ionScale: 1 - 0.18 * meet - 0.82 * ionFade,
      ionAlpha: 1 - ionFade,
      waterScale: waterGrow,
      waterAlpha: waterGrow,
      burst: burstValue
    };
  }

  window.NEU_DESIGN = Object.freeze({
    beakerBack: beakerBack,
    beakerFront: beakerFront,
    stream: stream,
    thermometer: thermometer,
    dropper: dropper,
    drop: drop,
    ripple: ripple,
    spread: spread,
    ion: ion,
    water: water,
    burst: burst,
    pourPose: pourPose,
    dropTimeline: dropTimeline,
    mergePose: mergePose
  });
}());


if (typeof document !== "undefined") (function () {

var $ = function (id) { return document.getElementById(id); };
var CSSV = function (n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
};
var C = {
  t1: CSSV("--t1"), t2: CSSV("--t2"), t3: CSSV("--t3"), line: CSSV("--line"),
  amber: CSSV("--d-amber"), blue: CSSV("--d-blue"), gray: CSSV("--d-gray"),
  red: CSSV("--d-red"), green: CSSV("--d-green"), cyan: CSSV("--d-cyan"),
  glass: "rgba(160,200,228,0.75)"
};
var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

var FONT = '-apple-system,BlinkMacSystemFont,"Malgun Gothic","맑은 고딕",' +
           '"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/* 시간 상수 (초) — 붓기 → 옆 비커 사라짐 → (지시약) 방울 셋 → 색 퍼짐 */
var MIX_T = 3.8, POUR_END = 0.76;      /* 섞기 진행 p ∈ [0,1] · 0~0.76 붓기(왼쪽 → 오른쪽 차례로) · 0.76~1 옆 비커가 서서히 사라진다 */
var IND_T = 1.9, N_DROPS = 3;           /* 지시약 진행 q ∈ [0,1] · 방울 셋 (사용자 지시 2~3방울 → 3) */
/* 지시약 «원액»의 색 — 방울 색 (BTB 원액은 청록, 페놀프탈레인 원액은 무색) */
var STOCK = { btb: "#2f7f8f", phph: "#eaf1f7" };

/* 탭×요소 가시성 — 단일 원천 (매뉴얼 §13 ①) */
var SHOW = {
  macro: { macroOnly: true,  microOnly: false },
  micro: { macroOnly: false, microOnly: true  }
};

/* ---------- 상태 ---------- */
var st = {
  tab: "macro",
  va: 6, vb: 6,
  phase: "before",   /* before → mixing → after */
  p: 0,              /* 섞임 진행 0..1 */
  ind: null,         /* 고른 지시약 id ("btb" | "phph") · null = 아직 안 넣음 */
  indP: 0,           /* 지시약 방울·색 퍼짐 진행 0..1 — 1 이 돼야 판독값이 뜬다 (J-N5) */
  guess: null,
  parts: [],
  runs: [],          /* 「실험 조건 변경하기」마다 한 줄 {n, va, vb, T, ind, rd, color} */
  ended: false       /* 「실험 종료하기」 뒤 — 그래프가 보이고 조작이 잠긴다 */
};
/* 지시약 색이 «다 퍼졌는가» — 판독·채점·기록은 이것 하나를 본다 (단일 원천) */
function indReady() { return !!st.ind && st.indP >= 1; }
/* 지금 실험의 판독 (지시약을 안 넣었으면 null) */
function curReading() { return indReady() ? neuIndReading(st.ind, neuNature(st.va, st.vb)) : null; }

var cv = $("stageCv"), ctx = cv.getContext("2d");
var gcv = $("graphCv"), gctx = gcv.getContext("2d");
var rafId = null, lastT = 0;

/* ---------- 입자 만들기 ---------- */
function rnd(a, b) { return a + Math.random() * (b - a); }

function buildParts() {
  var b = neuIonsBefore(st.va, st.vb);
  var arr = [], i;
  /* 왼쪽 반 = 묽은 염산 (H⁺, Cl⁻) · 오른쪽 반 = 수산화 나트륨 수용액 (Na⁺, OH⁻) */
  function push(kind, n, x0, x1) {
    for (var j = 0; j < n; j++) {
      arr.push({
        kind: kind, x: rnd(x0, x1), y: rnd(0.10, 0.90),
        vx: 0, vy: 0, sx: 0, sy: 0, mx: 0, my: 0, pair: -1, water: false
      });
    }
  }
  push("H",  b.H,  0.06, 0.44);
  push("Cl", b.Cl, 0.06, 0.44);
  push("Na", b.Na, 0.56, 0.94);
  push("OH", b.OH, 0.56, 0.94);
  /* 겹침을 줄인다 — 같은 반쪽 안에서만 밀어낸다 */
  for (var pass = 0; pass < 26; pass++) {
    for (i = 0; i < arr.length; i++) for (var j2 = i + 1; j2 < arr.length; j2++) {
      var A = arr[i], B = arr[j2];
      var dx = B.x - A.x, dy = (B.y - A.y) * 0.45, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001 && d < 0.115) {
        var k = (0.115 - d) / d * 0.34;
        A.x -= dx * k; A.y -= dy * k / 0.45;
        B.x += dx * k; B.y += dy * k / 0.45;
      }
    }
    for (i = 0; i < arr.length; i++) {
      var left = (arr[i].kind === "H" || arr[i].kind === "Cl");
      arr[i].x = Math.max(left ? 0.05 : 0.55, Math.min(left ? 0.45 : 0.95, arr[i].x));
      arr[i].y = Math.max(0.09, Math.min(0.91, arr[i].y));
    }
  }
  st.parts = arr;
}

/* 섞기 — H⁺ 와 OH⁻ 를 짝짓고, 나머지는 흩어질 자리를 정한다 */
function startMix() {
  if (st.phase !== "before" || st.ended) return;
  var arr = st.parts, hs = [], os = [], i;
  for (i = 0; i < arr.length; i++) {
    arr[i].sx = arr[i].x; arr[i].sy = arr[i].y;
    if (arr[i].kind === "H")  hs.push(i);
    if (arr[i].kind === "OH") os.push(i);
  }
  var n = Math.min(hs.length, os.length);
  for (i = 0; i < n; i++) {
    var a = arr[hs[i]], c = arr[os[i]];
    var mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    mx = mx * 0.55 + 0.5 * 0.45;                 /* 만나는 자리를 가운데로 조금 당긴다 */
    a.pair = os[i]; c.pair = hs[i];
    a.mx = mx; a.my = my; c.mx = mx; c.my = my;
    a.ang = rnd(0, Math.PI * 2);                 /* 생길 물 분자의 회전 */
  }
  /* 짝을 못 찾은 것과 구경꾼 — 상자 전체로 흩어진다 */
  for (i = 0; i < arr.length; i++) {
    if (arr[i].pair < 0) { arr[i].mx = rnd(0.06, 0.94); arr[i].my = rnd(0.10, 0.90); }
  }
  st.phase = "mixing"; st.p = 0;
  if (RM) { st.p = 1; finishMix(); }
  sync();
}

function finishMix() {
  var arr = st.parts, i, out = [];
  for (i = 0; i < arr.length; i++) {
    var q = arr[i];
    q.x = q.mx; q.y = q.my;
    if (q.pair >= 0) {
      if (q.kind === "H") { q.water = true; q.kind = "W"; out.push(q); }   /* 짝당 물 1개 */
    } else out.push(q);
  }
  for (i = 0; i < out.length; i++) {
    out[i].pair = -1;
    out[i].vx = RM ? 0 : rnd(-0.055, 0.055);
    out[i].vy = RM ? 0 : rnd(-0.075, 0.075);
    if (out[i].ang === undefined) out[i].ang = rnd(0, Math.PI * 2);
  }
  st.parts = out;
  st.phase = "after";
}

/* 지시약 고르기 — 다 섞인 뒤에만, 한 번만 (홈판 4단계: 마지막에 1~2방울) */
function startInd(id) {
  if (st.phase !== "after" || st.ind || st.ended) return;
  st.ind = id; st.indP = RM ? 1 : 0;
  sync();
}

/* 이번 실험을 기록하고 조건을 바꿀 수 있게 되돌린다 — 「실험 조건 변경하기」 */
function recordRun() {
  var nat = neuNature(st.va, st.vb), rd = curReading();
  st.runs.push({ n: st.runs.length + 1, va: st.va, vb: st.vb, T: neuMaxTemp(st.va, st.vb),
                 ind: st.ind, rd: rd, color: st.ind ? neuIndColor(st.ind, nat) : neuBTB("none") });
}
function nextRun() {
  if (st.phase !== "after" || st.ended) return;
  if (st.ind && !indReady()) return;                 /* 방울이 떨어지는 중에는 기다린다 */
  recordRun();
  reset(true);
}
/* 「실험 종료하기」 — 끝나지 않은 실험이 있으면 그것도 기록한 뒤 그래프를 연다 */
function endExperiment() {
  if (st.ended) return;
  if (st.phase === "after" && !(st.ind && !indReady())) recordRun();
  if (!st.runs.length) return;
  st.ended = true;
  sync();
  var gcard = $("graphCard");
  if (gcard && gcard.scrollIntoView) gcard.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
}
function restartAll() {
  st.runs = []; st.ended = false;
  reset(true);
}

function reset(keepVol) {
  st.phase = "before"; st.p = 0; st.ind = null; st.indP = 0; st.guess = null;
  if (!keepVol) { st.va = 6; st.vb = 6; }
  $("va").value = st.va; $("vb").value = st.vb;
  buildParts(); sync();
}

/* ---------- 캔버스 크기 ---------- */
function fit(canvas, context, hCss) {
  var wrap = canvas.parentNode, w = wrap.clientWidth;
  if (w < 40) return 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hCss * dpr);
  canvas.style.height = hCss + "px";
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}
function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
function lerpColor(a, b, t) {
  var A = /^#?([0-9a-f]{6})$/i.exec(a), B = /^#?([0-9a-f]{6})$/i.exec(b);
  if (!A || !B) return t < 0.5 ? a : b;
  var x = parseInt(A[1], 16), y = parseInt(B[1], 16), out = "#";
  for (var s = 16; s >= 0; s -= 8) {
    var v = Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
    out += (v < 16 ? "0" : "") + v.toString(16);
  }
  return out;
}
function darker(hex, f) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "rgba(0,0,0,.5)";
  var n = parseInt(m[1], 16);
  var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f),
      b = Math.round((n & 255) * f);
  return "rgb(" + r + "," + g + "," + b + ")";
}

/* ══════════════════════════════════════════════════════════════════════
   도식·자세 모듈 — 계약: Codex_디자인요청_중화반응관찰_v1.md §3·§4
   코덱스 납품(window.NEU_DESIGN)이 있으면 그것, 없으면 아래 FALLBACK 이 같은 계약으로 돈다.
   FALLBACK 은 요청자 구현(화면이 멈추지 않게 하는 최소 판)이다.
   ══════════════════════════════════════════════════════════════════════ */
function beakerPathOn(g, x, y, bw, bh) {
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x, y + bh - 10);
  g.quadraticCurveTo(x, y + bh, x + 10, y + bh);
  g.lineTo(x + bw - 10, y + bh);
  g.quadraticCurveTo(x + bw, y + bh, x + bw, y + bh - 10);
  g.lineTo(x + bw, y);
}
var FALLBACK_DESIGN = {
  beakerBack: function (g, s) {
    if (!s.surface) return;
    var c = s.colors;
    g.save();
    beakerPathOn(g, s.x + 1.5, s.y, s.w - 3, s.h - 1.5); g.closePath(); g.clip();
    var xl = s.x - 60, xr = s.x + s.w + 60, a = s.surface.a, b = s.y + s.surface.b;   /* b 는 (x,y) 기준 로컬 */
    g.beginPath();
    g.moveTo(xl, a * xl + b); g.lineTo(xr, a * xr + b);
    g.lineTo(xr, s.y + s.h + 60); g.lineTo(xl, s.y + s.h + 60); g.closePath();
    g.globalAlpha = s.alpha; g.fillStyle = s.color; g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.moveTo(xl, a * xl + b); g.lineTo(xr, a * xr + b);
    g.strokeStyle = c.waterLine; g.lineWidth = 1.4; g.stroke();
    g.restore();
  },
  beakerFront: function (g, s) {
    var c = s.colors;
    g.save();
    beakerPathOn(g, s.x, s.y, s.w, s.h);
    g.strokeStyle = c.glassLine; g.lineWidth = 2.2; g.stroke();
    g.beginPath(); g.moveTo(s.x + 7, s.y + 12); g.lineTo(s.x + 7, s.y + s.h - 22);
    g.strokeStyle = c.glassHi; g.lineWidth = 2.6; g.stroke();
    g.strokeStyle = "rgba(40,45,52,0.30)"; g.lineWidth = 1;
    for (var i = 0; i < (s.ticks || []).length; i++) {
      var t = s.ticks[i], len = t.major ? 12 : 7;
      g.beginPath();
      if (s.tickSide === "right") { g.moveTo(s.x + s.w - len, t.y); g.lineTo(s.x + s.w, t.y); }
      else { g.moveTo(s.x, t.y); g.lineTo(s.x + len, t.y); }
      g.stroke();
    }
    g.restore();
  },
  stream: function (g, s) {
    g.save();
    g.beginPath(); g.moveTo(s.x0, s.y0);
    g.quadraticCurveTo(s.x0 + (s.x1 - s.x0) * 0.15, (s.y0 + s.y1) / 2, s.x1, s.y1);
    g.strokeStyle = s.color; g.lineWidth = s.width; g.lineCap = "round"; g.stroke();
    g.restore();
  },
  thermometer: function (g, s) {
    var c = s.colors, top = s.top, bot = s.bottom, tw = s.width, r = s.bulbR;
    var th = (bot - r + 2) - top;
    g.save();
    g.beginPath();
    if (g.roundRect) g.roundRect(s.x - tw / 2, top, tw, th, tw / 2); else g.rect(s.x - tw / 2, top, tw, th);
    g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "#8ea3b7"; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); g.arc(s.x, bot, r, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill(); g.stroke();
    var colTop = top + th - (th - 10) * clamp01(s.frac);
    g.beginPath(); g.arc(s.x, bot, r - 2.4, 0, Math.PI * 2); g.fillStyle = c.mercury; g.fill();
    g.fillRect(s.x - tw / 2 + 3, colTop, tw - 6, top + th - colTop);
    for (var i = 0; i < (s.ticks || []).length; i++) {
      var t = s.ticks[i];
      g.beginPath(); g.moveTo(s.x + tw / 2, t.y); g.lineTo(s.tickX1, t.y);
      g.strokeStyle = t.major ? "rgba(40,45,52,0.45)" : "rgba(40,45,52,0.22)"; g.lineWidth = 1; g.stroke();
    }
    g.restore();
  },
  dropper: function (g, s) {
    var x = s.x, tipY = s.tipY;
    g.save();
    g.strokeStyle = "#8ea3b7"; g.lineWidth = 1.4;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - 9, tipY - 54, 18, 18, 6); else g.rect(x - 9, tipY - 54, 18, 18);
    g.fillStyle = "#5b6b7a"; g.fill();
    g.beginPath(); g.moveTo(x - 5, tipY - 36); g.lineTo(x + 5, tipY - 36); g.lineTo(x + 2, tipY); g.lineTo(x - 2, tipY);
    g.closePath(); g.fillStyle = "#ffffff"; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 3.5, tipY - 26); g.lineTo(x + 3.5, tipY - 26);
    g.lineTo(x + 1.6, tipY - 4); g.lineTo(x - 1.6, tipY - 4); g.closePath();
    g.fillStyle = s.stockColor; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    g.restore();
  },
  drop: function (g, s) {
    g.save();
    g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * 1.35, 0, 0, Math.PI * 2);
    g.fillStyle = s.color; g.fill();
    g.strokeStyle = "rgba(40,45,52,0.35)"; g.lineWidth = 1; g.stroke();
    g.restore();
  },
  ripple: function (g, s) {
    g.save();
    g.beginPath(); g.ellipse(s.x, s.y, 4 + (s.rx - 4) * s.t, 1.6 + (s.ry - 1.6) * s.t, 0, 0, Math.PI * 2);
    g.strokeStyle = "rgba(40,45,52," + (0.45 * (1 - s.t)).toFixed(2) + ")"; g.lineWidth = 1.2; g.stroke();
    g.restore();
  },
  spread: function (g, s) {
    /* 최소 판: 색을 t 만큼 섞어 전체를 한 색으로 — 「가운데서 번짐」은 납품 모듈의 몫 */
    FALLBACK_DESIGN.beakerBack(g, { x: s.x, y: s.y, w: s.w, h: s.h, surface: { a: 0, b: s.surfaceY },
                                    color: lerpColor(s.from, s.to, s.t), alpha: 1, colors: s.colors });
  },
  ion: function (g, s) {
    var c = s.colors, r = s.r * (s.scale === undefined ? 1 : s.scale);
    if (r <= 0.3) return;
    var col = s.kind === "H" ? c.ionH : s.kind === "OH" ? c.ionOH : c.ionSpec;
    var key = (s.kind === "H" || s.kind === "OH");
    g.save();
    g.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
    g.beginPath();
    if (s.kind === "OH" || s.kind === "Cl") {
      var sd = r * 1.75;
      if (g.roundRect) g.roundRect(s.x - sd / 2, s.y - sd / 2, sd, sd, r * 0.5); else g.rect(s.x - sd / 2, s.y - sd / 2, sd, sd);
    } else g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = col; g.fill();
    g.lineWidth = key ? 1.8 : 1; g.strokeStyle = darker(col, key ? 0.55 : 0.7); g.stroke();
    if (s.label && r > 8) {
      g.fillStyle = "#fff"; g.font = "600 " + Math.max(9.5, r * 0.78).toFixed(1) + "px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(s.label, s.x, s.y + 0.5); g.textBaseline = "alphabetic";
    }
    g.restore();
  },
  water: function (g, s) {
    var c = s.colors, r = s.r;
    if (r <= 0.3) return;
    var half = 104.5 / 2 * Math.PI / 180, L = r * 0.95, rH = r * 0.62;
    g.save();
    g.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
    for (var k = 0; k < 2; k++) {
      var a = s.ang - Math.PI / 2 + (k ? half : -half);
      var hx = s.x + Math.cos(a) * L, hy = s.y + Math.sin(a) * L;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(hx, hy);
      g.strokeStyle = "rgba(90,100,112,0.85)"; g.lineWidth = Math.max(1, r * 0.22); g.stroke();
      g.beginPath(); g.arc(hx, hy, rH, 0, Math.PI * 2);
      g.fillStyle = c.h2oH; g.fill(); g.strokeStyle = "rgba(60,70,80,0.9)"; g.lineWidth = Math.max(1.1, rH * 0.25); g.stroke();
    }
    g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2);
    g.fillStyle = c.h2oO; g.fill(); g.strokeStyle = darker(c.h2oO, 0.6); g.lineWidth = Math.max(1, r * 0.16); g.stroke();
    g.restore();
  },
  burst: function (g, s) {
    if (s.t == null || s.t >= 1) return;
    g.save();
    g.beginPath(); g.arc(s.x, s.y, s.r * (0.6 + 1.2 * s.t), 0, Math.PI * 2);
    g.strokeStyle = "rgba(40,45,52," + (0.5 * (1 - s.t)).toFixed(2) + ")"; g.lineWidth = 1.4; g.stroke();
    g.restore();
  },
  pourPose: function (pp, s) {
    var e = ease(clamp01(pp / 0.35));
    var thEnd = Math.atan2(s.sbh, s.sbw) + 0.10;             /* 이 각도면 바닥 먼 모서리까지 비운다 */
    var th = thEnd * ease(clamp01((pp - 0.15) / 0.85));
    var depth = 1 - clamp01(pp / 0.40);
    return { x: s.rest.x + (s.target.x - s.rest.x) * e, y: s.rest.y + (s.target.y - s.rest.y) * e,
             angle: -s.side * th,                                 /* 왼쪽(side −1) = 시계 방향 양의 각 (계약 3-12) */
             depth: depth, remain: 1 - pp,
             streamOn: depth < 0.02 && th > 0.05 && pp < 1 };
  },
  dropTimeline: function (q, i, n) {
    /* 방울마다 한 칸(slot) — 낙하 0.6 · 파문 0.4. 칸이 서로 겹치지 않고 마지막 칸 끝 = spreadStart */
    var slot = FALLBACK_DESIGN.dropTimeline.spreadStart / Math.max(1, n), t0 = i * slot;
    var fall = (q - t0) / (slot * 0.6), rip = (q - t0 - slot * 0.6) / (slot * 0.4);
    return { fall: (fall >= 0 && fall < 1) ? fall * fall : null, ripple: (rip >= 0 && rip < 1) ? rip : null };
  },
  mergePose: function (e) {
    var gap = 1 - ease(e), near = clamp01((e - 0.6) / 0.4);
    if (e >= 1) return { gap: 0, ionScale: 0, ionAlpha: 0, waterScale: 1, waterAlpha: 1, burst: null };
    return { gap: gap, ionScale: (1 - 0.30 * ease(e)) * (1 - near), ionAlpha: 1 - near,
             waterScale: near, waterAlpha: near,
             burst: (e > 0.62 && e < 0.92) ? (e - 0.62) / 0.30 : null };
  }
};
FALLBACK_DESIGN.dropTimeline.spreadStart = 0.72;   /* 마지막 방울의 파문이 끝나는 q — 그 뒤로 색이 퍼진다 */
var DESIGN = (typeof window !== "undefined" && window.NEU_DESIGN) ? window.NEU_DESIGN : FALLBACK_DESIGN;
var SPREAD0 = (DESIGN.dropTimeline && DESIGN.dropTimeline.spreadStart) || FALLBACK_DESIGN.dropTimeline.spreadStart;
/* 색 묶음 — 도식 모듈에 넘기는 유일한 색 원천 (토큰 + 실물색 예외) */
var DC = {
  t1: C.t1, t2: C.t2, t3: C.t3, line: C.line,
  glassLine: "#b6c6d6", glassHi: C.glass, water: neuBTB("none"), waterLine: "rgba(40,45,52,0.30)",
  mercury: C.red, ionH: C.amber, ionOH: C.blue, ionSpec: C.gray, h2oO: "#e0453b", h2oH: "#ffffff",
  btbAcid: neuBTB("acid"), btbNeutral: neuBTB("neutral"), btbBase: neuBTB("base"), phphBase: neuIndColor("phph", "base")
};

/* ---------- 거시 무대 기하 — 그리기·프로브가 같은 값을 읽는다 (원칙 11·13) ----------
   [묽은 염산 비커]   [가운데 비커 + 온도계(안쪽 오른쪽)]   [수산화 나트륨 수용액 비커]
   세 비커의 바닥을 맞추고, 옆 비커는 가운데 비커보다 낮다. 라벨은 각 비커 아래 */
function macroGeom(w, h) {
  /* top: 기울인 옆 비커(뒤 모서리가 입술 위로 sbw·sin66° ≈ 0.9·sbw)와 스포이트(끝 위 64 px)가 들어갈 머리 여백 */
  var top = Math.round(h * 0.34), lab = 58;
  var cbw = Math.min(150, w * 0.30), cbx = w * 0.5 - cbw / 2;
  var cby = top, cbh = h - top - lab;
  var sbw = Math.min(100, w * 0.20), sbh = Math.round(cbh * 0.62), sby = cby + cbh - sbh;
  return { w: w, h: h,
           cbx: cbx, cby: cby, cbw: cbw, cbh: cbh,
           sbw: sbw, sbh: sbh, sby: sby, lx: w * 0.16 - sbw / 2, rx: w * 0.84 - sbw / 2,
           tx: cbx + cbw - 13,                              /* 온도계 관 — 가운데 비커 «안쪽 오른쪽» */
           labY: cby + cbh + 16 };
}
function pourSpec(G, side) {
  return { side: side, sbw: G.sbw, sbh: G.sbh,
           rest: { x: side < 0 ? G.lx + G.sbw : G.rx, y: G.sby },
           target: { x: side < 0 ? G.cbx + 8 : G.cbx + G.cbw - 8, y: G.cby - 6 } };
}
/* 여러 줄 라벨 — 좁은 화면에서 「수산화 나트륨 수용액」이 옆 비커 폭을 넘치면 낱말 단위로 꺾는다 */
function wrapText(text, maxW) {
  var words = text.split(" "), lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var t = cur ? cur + " " + words[i] : words[i];
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------- 탭 ① 거시: 옆 비커 둘 → 가운데 비커로 붓기 → 사라짐 · 온도계 · 지시약 방울 ---------- */
function drawMacro(w, h) {
  var G = macroGeom(w, h);
  var vt = st.va + st.vb;
  var nat = neuNature(st.va, st.vb);
  var pp = st.phase === "before" ? 0 : st.phase === "after" ? 1 : clamp01(st.p / POUR_END);
  var fadeA = st.phase === "before" ? 1 : st.phase === "after" ? 0
            : 1 - clamp01((st.p - POUR_END) / (1 - POUR_END));
  var water = DC.water;

  /* 가운데 비커의 액체 — 부은 만큼 차오른다. 색은 지시약이 퍼진 만큼만 바뀐다(J-N5) */
  var inner = G.cbh - 10;
  var poured = st.va * clamp01(pp / 0.5) + st.vb * clamp01((pp - 0.5) / 0.5);   /* 차례로 붓는 순서대로 차오른다 */
  var lvl = Math.max(0, Math.min(1, poured / 24));
  var lh = inner * lvl, ly = G.cby + G.cbh - lh;
  if (lh > 1) {
    var sp = st.ind ? clamp01((st.indP - SPREAD0) / (1 - SPREAD0)) : 0;
    if (st.ind && sp > 0 && sp < 1)
      DESIGN.spread(ctx, { x: G.cbx, y: G.cby, w: G.cbw, h: G.cbh, surfaceY: ly, cx: G.cbx + G.cbw * 0.42,
                           t: sp, from: water, to: neuIndColor(st.ind, nat), colors: DC });
    else
      /* surface.b 는 비커 (x,y) 기준 로컬 y 다 (납품 README · 계약 3-1) — 절대 y 를 넘기면 액면이 비커 아래로 내려가 «보이지 않는다»(육안 실측) */
      DESIGN.beakerBack(ctx, { x: G.cbx, y: G.cby, w: G.cbw, h: G.cbh, surface: { a: 0, b: ly - G.cby },
                               color: (st.ind && sp >= 1) ? neuIndColor(st.ind, nat) : water, alpha: 1, colors: DC });
  }
  var cticks = [];
  for (var v = 6; v <= 24; v += 6) cticks.push({ y: G.cby + G.cbh - inner * (v / 24), major: v % 12 === 0 });
  DESIGN.beakerFront(ctx, { x: G.cbx, y: G.cby, w: G.cbw, h: G.cbh, ticks: cticks, tickSide: "left", colors: DC });

  /* 옆 비커 둘 — 섞기 전엔 제자리, 붓는 동안 가운데 비커 위로 옮겨 기울고, 다 부은 뒤 서서히 사라진다 */
  if (fadeA > 0.001) {
    ctx.save(); ctx.globalAlpha = fadeA;
    [[-1, st.va, "묽은 염산"], [1, st.vb, "수산화 나트륨 수용액"]].forEach(function (S) {
      var side = S[0], vol = S[1], name = S[2];
      /* 실물 절차처럼 «차례로» 붓는다 — 왼쪽 비커가 붓기 진행의 앞 절반, 오른쪽이 뒤 절반. 동시에 부으면 두 비커가 겹친다(육안 실측) */
      var ppS = clamp01((pp - (side < 0 ? 0 : 0.5)) / 0.5);
      var ps = DESIGN.pourPose(ppS, pourSpec(G, side));
      var fillH = (G.sbh - 8) * Math.max(0, Math.min(1, vol / 12));   /* 옆 비커는 12 mL 가 가득 */
      var remain = Math.round(vol * ps.remain);
      ctx.save();
      ctx.translate(ps.x, ps.y); ctx.rotate(ps.angle);
      var lx0 = side < 0 ? -G.sbw : 0;                     /* 로컬: 입술이 원점 */
      if (vol > 0 && remain > 0) {
        /* 세계 좌표에서 수평인 액면을 로컬 선으로 — y_w = x·sinθ + y·cosθ = d 에서 y = (d − x·sinθ)/cosθ */
        var d = ps.depth * (G.sbh - fillH);
        var sinT = Math.sin(ps.angle), cosT = Math.cos(ps.angle);
        DESIGN.beakerBack(ctx, { x: lx0, y: 0, w: G.sbw, h: G.sbh, surface: { a: -sinT / cosT, b: d / cosT },
                                 color: water, alpha: 1, colors: DC });
      }
      DESIGN.beakerFront(ctx, { x: lx0, y: 0, w: G.sbw, h: G.sbh, ticks: [], tickSide: "left", colors: DC });
      ctx.restore();
      if (vol > 0 && ps.streamOn)
        DESIGN.stream(ctx, { x0: ps.x, y0: ps.y, x1: side < 0 ? G.cbx + 22 : G.cbx + G.cbw - 22, y1: ly,
                             width: 4, color: "rgba(150,190,220,0.85)", colors: DC });
      /* 라벨 — 비커 «제자리» 아래 (붓는 동안 남은 양이 줄어든다) */
      var lxc = (side < 0 ? G.lx : G.rx) + G.sbw / 2;
      ctx.fillStyle = C.t2; ctx.font = "11px " + FONT; ctx.textAlign = "center";
      var lines = wrapText(name, G.sbw + 24), yl = G.labY;
      for (var i = 0; i < lines.length; i++) { ctx.fillText(lines[i], lxc, yl); yl += 13; }
      ctx.fillStyle = C.t1; ctx.font = "600 12px " + FONT;
      ctx.fillText(remain + " mL", lxc, yl + 1);
    });
    ctx.restore();
  }

  /* 온도계 — 가운데 비커 안쪽 오른쪽에 꽂혀 있다. 눈금 라벨은 비커 벽 바로 바깥 */
  var T = st.phase === "before" ? NEU.T0
        : NEU.T0 + neuDeltaT(st.va, st.vb) * (st.phase === "after" ? 1 : ease(pp));
  var lo = 18, hi = 30, ty = G.cby - 18, bulbR = 8, bulbY = G.cby + G.cbh - 14;
  var th = (bulbY - bulbR + 2) - ty, tticks = [];
  for (var t = lo; t <= hi; t += 2) tticks.push({ y: ty + th - (th - 10) * ((t - lo) / (hi - lo)), major: t % 4 === 0 });
  DESIGN.thermometer(ctx, { x: G.tx, top: ty, bottom: bulbY, width: 12, bulbR: bulbR,
                            frac: (T - lo) / (hi - lo), ticks: tticks, tickX1: G.cbx + G.cbw + 5, colors: DC });
  ctx.fillStyle = C.t3; ctx.font = "10px " + FONT; ctx.textAlign = "left";
  for (var k2 = 0; k2 < tticks.length; k2++) if (tticks[k2].major) ctx.fillText((lo + 2 * k2) + "", G.cbx + G.cbw + 8, tticks[k2].y + 3.5);
  ctx.fillStyle = C.t1; ctx.font = "600 14px " + FONT;
  ctx.fillText(T.toFixed(1) + " ℃", G.cbx + G.cbw + 8, G.cby - 8);
  ctx.fillStyle = C.t3; ctx.font = "11px " + FONT;
  ctx.fillText(st.phase === "before" ? "섞기 전" : st.phase === "mixing" ? "올라가는 중" : "최고 온도",
               G.cbx + G.cbw + 8, G.cby + 6);

  /* 지시약 스포이트 + 방울 — 고른 뒤 다 퍼질 때까지만 */
  if (st.ind && st.indP < 1) {
    var cx = G.cbx + G.cbw * 0.42, tipY = G.cby - 30, q = st.indP;
    DESIGN.dropper(ctx, { x: cx, tipY: tipY, stockColor: STOCK[st.ind], colors: DC });
    for (var k = 0; k < N_DROPS; k++) {
      var dp = DESIGN.dropTimeline(q, k, N_DROPS);
      if (dp.fall != null)
        DESIGN.drop(ctx, { x: cx, y: tipY + (ly - tipY) * (dp.fall * dp.fall), r: 3.2, color: STOCK[st.ind], colors: DC });
      if (dp.ripple != null && lh > 1)
        DESIGN.ripple(ctx, { x: cx, y: ly, t: dp.ripple, rx: 20, ry: 6.5, colors: DC });
    }
  }

  /* 가운데 비커 아래 설명 */
  var cxm = G.cbx + G.cbw / 2, capY = G.labY;
  ctx.fillStyle = C.t2; ctx.font = "11.5px " + FONT; ctx.textAlign = "center";
  /* 옆 비커 라벨과 겹치지 않게 가운데 비커 폭 근처에서 줄을 꺾는다 (360 px 육안 실측) */
  var capLines = wrapText(st.phase === "before" ? "빈 비커 — 「섞기」를 누르면 두 용액을 여기에 붓습니다"
             : st.phase === "mixing" ? ("붓는 중 — 혼합 용액 " + Math.round(poured) + " mL")
             : ("혼합 용액 " + vt + " mL"), G.cbw + 56);
  for (var c2 = 0; c2 < capLines.length; c2++) { ctx.fillText(capLines[c2], cxm, capY); capY += 13; }
  var rd = curReading();
  ctx.fillStyle = rd ? C.t1 : C.t3; ctx.font = "600 12px " + FONT;
  var indLines = wrapText(!st.ind ? (st.phase === "after" ? "지시약 아직 안 넣음" : "")
             : !rd ? (neuIndName(st.ind) + " 떨어뜨리는 중")
             : (neuIndName(st.ind) + " — " + rd.color + " → " + rd.text), G.cbw + 56);
  for (var c3 = 0; c3 < indLines.length; c3++) { ctx.fillText(indLines[c3], cxm, capY + 3); capY += 14; }
  return G;
}

/* ---------- 탭 ② 미시: 이온 상자 ---------- */
var ION = {
  H:  { sym: "H⁺",  cat: "양", key: true  },
  OH: { sym: "OH⁻", cat: "음", key: true  },
  Na: { sym: "Na⁺", cat: "양", key: false },
  Cl: { sym: "Cl⁻", cat: "음", key: false },
  W:  { sym: "",    cat: "물", key: false }
};

function drawIonBox(w, h) {
  var pad = 8;
  var bx = pad, by = 4, bw = w - pad * 2, bh = h - 8;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10);
  else ctx.rect(bx, by, bw, bh);
  ctx.fillStyle = "#fbfdff"; ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();

  /* 섞기 전 — 두 용액의 경계 */
  if (st.phase === "before") {
    ctx.beginPath(); ctx.setLineDash([5, 4]);
    ctx.moveTo(bx + bw / 2, by + 6); ctx.lineTo(bx + bw / 2, by + bh - 6);
    ctx.strokeStyle = "rgba(40,45,52,0.28)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "11.5px " + FONT; ctx.textAlign = "center"; ctx.fillStyle = C.t3;
    ctx.fillText("묽은 염산 " + st.va + " mL", bx + bw * 0.25, by + 15);
    ctx.fillText("수산화 나트륨 수용액 " + st.vb + " mL", bx + bw * 0.75, by + 15);
  } else {
    ctx.font = "11.5px " + FONT; ctx.textAlign = "center"; ctx.fillStyle = C.t3;
    ctx.fillText(st.phase === "mixing" ? "섞는 중 — H⁺ 와 OH⁻ 가 만나 물이 됩니다" : "섞은 뒤 — 남은 이온을 세어 보세요",
                 bx + bw / 2, by + 15);
  }

  var r = Math.max(9.5, Math.min(15, bw / 30));
  /* 이온은 «붓는 동안» 만난다 — 옆 비커가 사라지는 구간에는 이미 다 만났다 */
  var e = ease(clamp01(st.p / POUR_END));
  var mp = st.phase === "mixing" ? DESIGN.mergePose(e) : null;
  var PX = function (nx) { return bx + 6 + nx * (bw - 12); }, PY = function (ny) { return by + 8 + ny * (bh - 16); };
  var drawnPair = {};
  for (var i = 0; i < st.parts.length; i++) {
    var q = st.parts[i];
    if (q.kind === "W") {                                       /* 섞은 뒤의 물 분자 */
      DESIGN.water(ctx, { x: PX(q.x), y: PY(q.y), r: r * 0.5, ang: q.ang || 0, alpha: 1, colors: DC });
      continue;
    }
    if (st.phase === "mixing" && q.pair >= 0) {                 /* 짝지어 다가가는 H⁺·OH⁻ */
      var meetX = PX(q.mx), meetY = PY(q.my);
      var ix = meetX + (PX(q.sx) - meetX) * mp.gap, iy = meetY + (PY(q.sy) - meetY) * mp.gap;
      DESIGN.ion(ctx, { x: ix, y: iy, r: r, kind: q.kind, scale: mp.ionScale, alpha: mp.ionAlpha, label: ION[q.kind].sym, colors: DC });
      var pk = Math.min(i, q.pair);
      if (!drawnPair[pk]) {                                     /* 짝당 한 번: 물 분자 등장 + 만나는 순간 */
        drawnPair[pk] = true;
        if (mp.waterAlpha > 0)
          DESIGN.water(ctx, { x: meetX, y: meetY, r: r * 0.5 * mp.waterScale, ang: q.ang || 0, alpha: mp.waterAlpha, colors: DC });
        if (mp.burst != null) DESIGN.burst(ctx, { x: meetX, y: meetY, r: r, t: mp.burst, colors: DC });
      }
      continue;
    }
    var nx = q.x, ny = q.y;
    if (st.phase === "mixing") { nx = q.sx + (q.mx - q.sx) * e; ny = q.sy + (q.my - q.sy) * e; }
    DESIGN.ion(ctx, { x: PX(nx), y: PY(ny), r: r, kind: q.kind, scale: 1, alpha: 1, label: ION[q.kind].sym, colors: DC });
  }
  ctx.restore();
}

/* ---------- 무대 ---------- */
function stageH() {
  var w = cv.parentNode.clientWidth || 600;
  return st.tab === "macro" ? Math.round(Math.max(300, Math.min(380, w * 0.58)))
                            : Math.round(Math.max(240, Math.min(300, w * 0.44)));
}
function draw() {
  var w = fit(cv, ctx, stageH());
  if (!w) return;
  var h = stageH();
  ctx.clearRect(0, 0, w, h);
  if (st.tab === "macro") drawMacro(w, h); else drawIonBox(w, h);
}

/* ---------- 그래프 — 「실험 종료하기」 뒤에만 보인다. 가로축 = 각 실험의 두 부피 ---------- */
function drawGraph() {
  if (!st.ended) return;
  var w = fit(gcv, gctx, 290);
  if (!w) return;
  var h = 290, L = 46, R = 14, T = 16, B = 78;
  gctx.clearRect(0, 0, w, h);
  var x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  var recs = st.runs.slice().sort(function (a, b) { return (a.va - b.va) || (a.vb - b.vb); });
  var tmin = 19, tmax = 28;
  for (var i = 0; i < recs.length; i++) if (recs[i].T > tmax - 0.5) tmax = Math.ceil(recs[i].T + 1);
  var n = recs.length;
  var X = function (k) { return x0 + (x1 - x0) * ((k + 0.5) / Math.max(1, n)); };
  var Y = function (t) { return y1 - (y1 - y0) * ((t - tmin) / (tmax - tmin)); };

  gctx.strokeStyle = "rgba(40,45,52,0.055)"; gctx.lineWidth = 1;
  for (var t = tmin + 1; t < tmax; t++) {
    gctx.beginPath(); gctx.moveTo(x0, Y(t)); gctx.lineTo(x1, Y(t)); gctx.stroke();
  }
  gctx.strokeStyle = "rgba(40,45,52,0.35)"; gctx.lineWidth = 1.2;
  gctx.beginPath(); gctx.moveTo(x0, y0); gctx.lineTo(x0, y1); gctx.lineTo(x1, y1); gctx.stroke();

  gctx.fillStyle = C.t3; gctx.font = "10.5px " + FONT;
  gctx.textAlign = "right";
  for (var v = 20; v <= tmax; v += 2) gctx.fillText(v + "", x0 - 6, Y(v) + 3.5);
  gctx.textAlign = "center";
  var compact = ((x1 - x0) / Math.max(1, n)) < 64;             /* 눈금 간격이 좁으면(360 px·실험 많음) 「a+b」 한 줄로 */
  for (var j = 0; j < n; j++) {                               /* 가로축 눈금 — 각 실험의 두 부피 */
    gctx.fillStyle = C.t2;
    if (compact) gctx.fillText(recs[j].va + "+" + recs[j].vb, X(j), y1 + 15);
    else {
      gctx.fillText("HCl " + recs[j].va, X(j), y1 + 15);
      gctx.fillText("NaOH " + recs[j].vb, X(j), y1 + 28);
      gctx.fillStyle = C.t3; gctx.fillText("(mL)", X(j), y1 + 41);
    }
  }
  gctx.fillStyle = C.t2; gctx.font = "11.5px " + FONT;
  gctx.fillText(compact ? "묽은 염산 + 수산화 나트륨 수용액 (mL)" : "각 실험의 묽은 염산 · 수산화 나트륨 수용액 부피",
                (x0 + x1) / 2, h - 5);
  gctx.save(); gctx.translate(13, (y0 + y1) / 2); gctx.rotate(-Math.PI / 2);
  gctx.fillText("최고 온도 (℃)", 0, 0); gctx.restore();

  if (n >= 2) {
    gctx.beginPath();
    for (var m = 0; m < n; m++) { if (m === 0) gctx.moveTo(X(m), Y(recs[m].T)); else gctx.lineTo(X(m), Y(recs[m].T)); }
    gctx.strokeStyle = C.gray; gctx.lineWidth = 1.6; gctx.setLineDash([5, 4]); gctx.stroke(); gctx.setLineDash([]);
  }
  for (var k = 0; k < n; k++) {
    var rc = recs[k], cx = X(k), cy = Y(rc.T);
    gctx.beginPath(); gctx.arc(cx, cy, 6, 0, Math.PI * 2);
    gctx.fillStyle = rc.color; gctx.fill();                    /* 점 색 = 그때 «본» 지시약 색 (정직성) */
    gctx.strokeStyle = "rgba(40,45,52,0.55)"; gctx.lineWidth = 1.4; gctx.stroke();
    gctx.fillStyle = C.t1; gctx.font = "600 10.5px " + FONT; gctx.textAlign = "center";
    gctx.fillText(rc.T.toFixed(1), cx, cy - 11);
    gctx.fillStyle = C.t2; gctx.font = "10.5px " + FONT;
    gctx.fillText(rc.rd ? rc.rd.text : "지시약 안 넣음", cx, y1 + 56);
  }
}

/* ---------- 화면 동기화 ---------- */
function setTxt(id, s) { var el = $(id); if (el) el.textContent = s; }
function setDisp(sel, on) {
  var el = document.querySelectorAll(sel);
  for (var i = 0; i < el.length; i++) el[i].style.display = on ? "" : "none";
}

function sync() {
  var before = neuIonsBefore(st.va, st.vb);
  var after  = neuIonsAfter(st.va, st.vb);
  var shown  = (st.phase === "after") ? after : before;
  var mixed  = (st.phase === "after");
  var i;

  /* 탭 가시성 — 단일 원천 표만 display 를 쓴다 (§13 ①) */
  var vis = SHOW[st.tab];
  setDisp(".only-macro", vis.macroOnly);
  setDisp(".only-micro", vis.microOnly);
  var tb = document.querySelectorAll(".tabb");
  for (i = 0; i < tb.length; i++) tb[i].setAttribute("aria-pressed", tb[i].dataset.tab === st.tab ? "true" : "false");

  setTxt("sVa", st.va + " mL"); setTxt("sVb", st.vb + " mL");
  setTxt("cH",  shown.H  + ""); setTxt("cOH", shown.OH + "");
  setTxt("cNa", shown.Na + ""); setTxt("cCl", shown.Cl + "");
  setTxt("cW",  (mixed ? after.W : 0) + "");
  setTxt("cntWhen", mixed ? "섞은 뒤" : "섞기 전");

  var T = mixed ? neuMaxTemp(st.va, st.vb) : NEU.T0;
  setTxt("vT", T.toFixed(1));
  setTxt("vRise", mixed ? ("+" + neuDeltaT(st.va, st.vb).toFixed(1)) : "—");

  /* 지시약 판독 — 색이 다 퍼진 뒤에만. 페놀프탈레인은 무색이면 산성·중성을 못 가른다 */
  var nat = neuNature(st.va, st.vb);
  var rd = curReading();
  setTxt("vNat", rd ? (rd.text + " (" + rd.color + ")") : "—");
  setTxt("indWhich", st.ind ? neuIndName(st.ind) + "으로 확인한 액성" : "지시약으로 확인한 액성");
  $("natBox").className = "readout" + (!rd ? "" : !rd.determinate ? " is-warn"
                                        : rd.nature === "neutral" ? " is-ok" : " is-warn");

  var lockCond = (st.phase !== "before") || st.ended;
  $("mixBtn").disabled = lockCond;
  var ib = document.querySelectorAll(".indb");
  for (i = 0; i < ib.length; i++) {
    ib[i].disabled = (st.phase !== "after") || !!st.ind || st.ended;
    ib[i].setAttribute("aria-pressed", st.ind === ib[i].dataset.ind ? "true" : "false");
  }
  $("nextBtn").disabled = !(st.phase === "after" && !(st.ind && !indReady()) && !st.ended);
  $("endBtn").disabled  = st.ended || !(st.runs.length || (st.phase === "after" && !(st.ind && !indReady())));
  $("va").disabled = $("vb").disabled = lockCond;
  var pv = document.querySelectorAll(".pv");
  for (i = 0; i < pv.length; i++) pv[i].disabled = lockCond;
  var gb = document.querySelectorAll(".gbtn");
  for (i = 0; i < gb.length; i++) {
    gb[i].disabled = (st.phase !== "after") || !!st.ind;
    gb[i].setAttribute("aria-pressed", st.guess === gb[i].dataset.g ? "true" : "false");
  }
  $("guessRow").style.display = (st.phase === "after" && !st.ind && !st.ended) ? "block" : "none";

  /* 예측 채점 — 지시약이 «말해 줄 수 있는» 범위에서만 */
  var gr = $("guessResult");
  if (rd && st.guess) {
    gr.style.display = "block";
    if (!rd.determinate) {
      var wrongBase = (st.guess === "base");
      gr.className = "note " + (wrongBase ? "note--warn" : "note--key");
      gr.innerHTML = wrongBase
        ? "<b>예측 «염기성»은 틀렸습니다 — 붉게 변하지 않았습니다.</b> 그런데 무색은 산성일 수도 중성일 수도 있습니다. " +
          "페놀프탈레인만으로는 둘을 가르지 못합니다 — 「실험 조건 변경하기」로 같은 부피를 다시 하고 BTB 로 확인해 보세요."
        : "<b>페놀프탈레인이 무색입니다 — «" + neuNatureLabel(st.guess) + "» 예측이 맞는지 이 지시약으로는 알 수 없습니다.</b> " +
          "무색은 산성일 수도 중성일 수도 있습니다(지시약마다 색이 변하는 범위가 다릅니다). 같은 부피를 BTB 로 다시 확인해 보세요.";
    } else {
      var ok = (st.guess === nat);
      gr.className = "note " + (ok ? "note--ok" : "note--warn");
      gr.innerHTML = ok
        ? "<b>예측이 맞았습니다.</b> 남은 이온이 " +
          (nat === "neutral" ? "하나도 없어서 <b>중성</b>입니다."
           : nat === "acid" ? ("H⁺ <b>" + after.H + "개</b>라서 <b>산성</b>입니다.")
           : ("OH⁻ <b>" + after.OH + "개</b>라서 <b>염기성</b>입니다."))
        : "<b>예측은 «" + neuNatureLabel(st.guess) + "»이었는데 결과는 «" +
          neuNatureLabel(nat) + "»입니다.</b> 남은 이온을 다시 세어 보세요 — " +
          (nat === "neutral" ? "H⁺ 도 OH⁻ 도 남지 않았습니다."
           : nat === "acid" ? ("H⁺ 가 " + after.H + "개 남았습니다.")
           : ("OH⁻ 가 " + after.OH + "개 남았습니다."));
    }
  } else gr.style.display = "none";

  /* 실험 기록 표 · 안내 */
  var tab = $("runsTab");
  while (tab.rows.length > 1) tab.deleteRow(1);
  for (i = 0; i < st.runs.length; i++) {
    var rr = st.runs[i], row = tab.insertRow(-1);
    row.insertCell(-1).textContent = rr.n + "";
    row.insertCell(-1).textContent = rr.va + " mL";
    row.insertCell(-1).textContent = rr.vb + " mL";
    row.insertCell(-1).textContent = rr.T.toFixed(1) + " ℃";
    var c4 = row.insertCell(-1), sw = document.createElement("span");
    sw.className = "sw"; sw.style.background = rr.color; c4.appendChild(sw);
    c4.appendChild(document.createTextNode(rr.rd ? (neuIndName(rr.ind).replace(" 용액", "") + " " + rr.rd.color + " → " + rr.rd.text) : "안 넣음"));
  }
  setTxt("recHint",
    st.ended ? "실험을 끝냈습니다. 아래 그래프를 보세요. 다시 하려면 「처음부터 다시」."
    : st.phase === "before" ? (st.runs.length ? "부피를 바꾸고 「섞기」를 누르세요. 다 했으면 「실험 종료하기」." : "부피를 정하고 「섞기」를 누르세요.")
    : st.phase === "mixing" ? "붓는 중입니다."
    : (st.ind && !rd) ? "지시약이 퍼지는 중입니다."
    : !st.ind ? "지시약을 넣어 색을 확인한 뒤 「실험 조건 변경하기」를 누르면 이번 실험이 기록됩니다."
    : !rd.determinate ? "무색이라 산성인지 중성인지 알 수 없습니다 — 그대로 기록되며, BTB 로 다시 확인할 수 있습니다."
    : "「실험 조건 변경하기」를 누르면 이번 실험이 기록되고 부피를 다시 정할 수 있습니다.");
  setTxt("recCount", st.runs.length + "");

  setTxt("stageCap",
    st.tab === "micro"
      ? (st.phase === "before" ? "아직 섞지 않았습니다. 왼쪽 반이 묽은 염산, 오른쪽 반이 수산화 나트륨 수용액 속 이온입니다."
        : st.phase === "mixing" ? "섞는 중입니다 — H⁺ 와 OH⁻ 가 만나 물 분자 H₂O 가 됩니다. Na⁺·Cl⁻ 는 그대로입니다."
        : "다 섞였습니다. 무엇이 몇 개 남았는지 세어 보세요 — 남은 이온이 액성을 정합니다.")
      : st.phase === "before"
        ? "아직 섞지 않았습니다. 왼쪽 비커가 묽은 염산, 오른쪽 비커가 수산화 나트륨 수용액입니다. 가운데 비커는 비어 있습니다."
        : st.phase === "mixing" ? "두 비커를 가운데 비커에 붓는 중입니다 — 온도계가 오르는 것을 보세요."
        : !st.ind ? "다 섞였습니다. 지시약을 골라 떨어뜨리세요 (탭 ②에서 남은 이온을 세어 먼저 예측해도 좋습니다)."
        : !rd ? (neuIndName(st.ind) + "을 떨어뜨리는 중입니다 — 세 방울.")
        : rd.determinate
          ? (neuIndName(st.ind) + "을 넣었습니다. 탭 ②에서 «남아 있는» 이온을 세어 색과 맞춰 보세요.")
          : "페놀프탈레인이 무색입니다. 무색은 산성일 수도 중성일 수도 있어 이 지시약만으로는 가르지 못합니다.");

  /* 그래프 카드 — 실험을 끝낸 뒤에만 */
  $("graphCard").style.display = st.ended ? "block" : "none";
  if (st.ended) {
    var same = neuSameTotal(st.runs), gn = $("graphNote");
    gn.className = "note" + (same ? "" : " note--warn");
    gn.innerHTML = same
      ? "<b>두 가지를 같이 보세요.</b> 온도가 가장 높이 올라간 조합과, BTB 가 초록색이 된 조합이 <b>같은 자리</b>인지 다른 자리인지. " +
        "서로 다른 두 관찰이 같은 곳을 가리킨다면 그것이 무엇을 뜻하는지 모둠에서 이야기해 보세요."
      : "<b>총 부피가 서로 다른 실험이 섞여 있습니다.</b> 최고 온도는 열이 퍼지는 용액의 양에 따라 달라지므로, 총 부피가 같은 실험끼리만 " +
        "높낮이를 비교하세요(홈판은 전부 12 mL 입니다).";
  }
  drawGraph();
}

/* ---------- 루프 ---------- */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
  lastT = ts;

  if (st.phase === "mixing") {
    st.p += dt / MIX_T;
    if (st.p >= 1) { st.p = 1; finishMix(); sync(); }
  } else if (st.phase === "after") {
    if (st.ind && st.indP < 1) {
      st.indP += dt / IND_T;
      if (st.indP >= 1) { st.indP = 1; sync(); }        /* 색이 다 퍼진 순간 판독값이 뜬다 */
    }
    if (!RM) for (var i = 0; i < st.parts.length; i++) {
      var q = st.parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < 0.05) { q.x = 0.05; q.vx = Math.abs(q.vx); }
      if (q.x > 0.95) { q.x = 0.95; q.vx = -Math.abs(q.vx); }
      if (q.y < 0.09) { q.y = 0.09; q.vy = Math.abs(q.vy); }
      if (q.y > 0.91) { q.y = 0.91; q.vy = -Math.abs(q.vy); }
    }
  }
  draw();
}

/* ---------- 배선 ---------- */
var tbs = document.querySelectorAll(".tabb");
for (var ti = 0; ti < tbs.length; ti++) tbs[ti].addEventListener("click", function () {
  st.tab = this.dataset.tab; sync();
});
$("va").addEventListener("input", function () {
  st.va = parseInt(this.value, 10); buildParts(); sync();
});
$("vb").addEventListener("input", function () {
  st.vb = parseInt(this.value, 10); buildParts(); sync();
});
var pvs = document.querySelectorAll(".pv");
for (var pi = 0; pi < pvs.length; pi++) pvs[pi].addEventListener("click", function () {
  st.va = parseInt(this.dataset.va, 10); st.vb = parseInt(this.dataset.vb, 10);
  $("va").value = st.va; $("vb").value = st.vb;
  buildParts(); sync();
});
$("mixBtn").addEventListener("click", startMix);
var ibs = document.querySelectorAll(".indb");
for (var ii = 0; ii < ibs.length; ii++) ibs[ii].addEventListener("click", function () {
  startInd(this.dataset.ind);
});
$("nextBtn").addEventListener("click", nextRun);
$("endBtn").addEventListener("click", endExperiment);
$("clrBtn").addEventListener("click", restartAll);
var gbs = document.querySelectorAll(".gbtn");
for (var gi = 0; gi < gbs.length; gi++) gbs[gi].addEventListener("click", function () {
  st.guess = this.dataset.g; sync();
});

window.addEventListener("resize", function () { draw(); drawGraph(); });
if (window.ResizeObserver) {
  new ResizeObserver(function () { draw(); drawGraph(); }).observe(cv.parentNode);
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (!rafId) { lastT = 0; rafId = requestAnimationFrame(loop); }
});

if (RM) $("rmNote").style.display = "block";
reset(false);
rafId = requestAnimationFrame(loop);

/* 검증 프로브가 읽는 창구 — 기하는 그리기가 쓰는 그 함수(macroGeom·pourPose)로 낸다 */
window.NEUVIEW = { st: st, sync: sync, draw: draw, startMix: startMix, startInd: startInd, reset: reset,
                   nextRun: nextRun, endExperiment: endExperiment, restartAll: restartAll, indReady: indReady,
                   design: function () { return DESIGN === FALLBACK_DESIGN ? "fallback" : "codex"; },
                   geom: function () { var w = cv.parentNode.clientWidth; return macroGeom(w, stageH()); },
                   pourPose: function (side, pp) { var w = cv.parentNode.clientWidth; var G = macroGeom(w, stageH()); return DESIGN.pourPose(pp, pourSpec(G, side)); },
                   K: { MIX_T: MIX_T, POUR_END: POUR_END, IND_T: IND_T, N_DROPS: N_DROPS, SPREAD0: SPREAD0 } };

})();

if (typeof module !== "undefined" && module.exports)
  module.exports = {
    NEU: NEU, NEU_PRESET: NEU_PRESET, NEU_IND: NEU_IND,
    neuIonsBefore: neuIonsBefore, neuIonsAfter: neuIonsAfter,
    neuMolReacted: neuMolReacted, neuHeatJ: neuHeatJ, neuDeltaT: neuDeltaT,
    neuMaxTemp: neuMaxTemp, neuNature: neuNature, neuNatureLabel: neuNatureLabel,
    neuBTB: neuBTB, neuCharge: neuCharge, neuPlottable: neuPlottable, neuSameTotal: neuSameTotal,
    neuIndName: neuIndName, neuIndColor: neuIndColor, neuIndReading: neuIndReading
  };
