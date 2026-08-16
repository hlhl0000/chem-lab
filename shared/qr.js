/* ============================================================
   화학 탐구실 — QR 코드 버튼 (shared/qr.js)

   무엇을 하는가
     시뮬레이션 제목 오른쪽에 「QR 코드」 버튼을 하나 붙인다.
     누르면 이 페이지의 주소를 QR 코드로 크게 띄운다.
     학생은 휴대폰 카메라로 찍어 바로 들어온다.

   사용법 (각 페이지의 </body> 직전, sims.js·nav.js 뒤에):
     <script src="../shared/qr.js" data-base=".." data-current="liquid"></script>
   대문(index.html)에서는:
     <script src="shared/qr.js" data-base="." data-current=""></script>

   왜 라이브러리를 쓰지 않는가
     학교 망은 외부 CDN(cdnjs 등)을 막아 두는 경우가 많다.
     인터넷이 끊겨도 QR이 떠야 하므로 QR 인코더를 이 파일 안에 직접 넣었다.
     (ISO/IEC 18004 · 바이트 모드 · 오류정정 M · 버전 1~10)

   고칠 일이 생기면
     · 배포 주소가 바뀌면 → 아래 PUBLISHED_BASE 한 줄만 고친다.
     · 버튼 글자·색을 바꾸려면 → 「② 화면」 구역의 CSS 문자열.
   ============================================================ */
(function () {
"use strict";

/* 배포 주소 — 로컬(file://·localhost)에서 열었을 때 QR에 넣을 실제 공개 주소 */
var PUBLISHED_BASE = "https://hlhl0000.github.io/chem-lab/";

/* ============================================================
   ① QR 인코더  (ISO/IEC 18004, 바이트 모드, 오류정정 레벨 M)
   ============================================================ */

/* 버전별 표 — [전체 코드워드, 블록당 EC 코드워드, [[블록수, 블록당 데이터 코드워드], ...]] */
var VER = {
  1:  [26,  10, [[1, 16]]],
  2:  [44,  16, [[1, 28]]],
  3:  [70,  26, [[1, 44]]],
  4:  [100, 18, [[2, 32]]],
  5:  [134, 24, [[2, 43]]],
  6:  [172, 16, [[4, 27]]],
  7:  [196, 18, [[4, 31]]],
  8:  [242, 22, [[2, 38], [2, 39]]],
  9:  [292, 22, [[3, 36], [2, 37]]],
  10: [346, 26, [[4, 43], [1, 44]]]
};
/* 정렬 패턴 중심 좌표 */
var ALIGN = {
  1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
  6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50]
};

/* --- GF(256) 로그표 (원시 다항식 0x11D) --- */
var GEXP = new Uint8Array(512), GLOG = new Uint8Array(256);
(function () {
  var x = 1;
  for (var i = 0; i < 255; i++) {
    GEXP[i] = x; GLOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (var j = 255; j < 512; j++) GEXP[j] = GEXP[j - 255];
})();
function gmul(a, b) { return (a === 0 || b === 0) ? 0 : GEXP[GLOG[a] + GLOG[b]]; }

/* 오류정정 코드워드 계산 (Reed–Solomon) */
function rsEncode(data, ecLen) {
  var gen = [1], i, j;
  for (i = 0; i < ecLen; i++) {
    var next = new Array(gen.length + 1).fill(0);
    for (j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gmul(gen[j], GEXP[i]);
    }
    gen = next;
  }
  var rem = new Array(ecLen).fill(0);
  for (i = 0; i < data.length; i++) {
    var factor = data[i] ^ rem[0];
    rem.shift(); rem.push(0);
    if (factor !== 0) for (j = 0; j < ecLen; j++) rem[j] ^= gmul(gen[j + 1], factor);
  }
  return rem;
}

/* 문자열 → UTF-8 바이트 */
function utf8Bytes(str) {
  var out = [], i, c;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      var c2 = str.charCodeAt(++i);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/* BCH — 형식 정보(15비트) / 버전 정보(18비트) */
function bch(value, poly, polyBits) {
  var v = value << polyBits;
  var gBits = poly.toString(2).length;
  while (v.toString(2).length >= gBits) v ^= poly << (v.toString(2).length - gBits);
  return (value << polyBits) | v;
}

function encode(text) {
  var bytes = utf8Bytes(text), i, j, k;

  /* --- 버전 고르기 --- */
  var ver = 0;
  for (var v = 1; v <= 10; v++) {
    var cntBits = v < 10 ? 8 : 16;
    var dataCw = 0;
    VER[v][2].forEach(function (b) { dataCw += b[0] * b[1]; });
    if (dataCw * 8 >= 4 + cntBits + bytes.length * 8) { ver = v; break; }
  }
  if (!ver) throw new Error("QR: 주소가 너무 깁니다");

  var ecLen = VER[ver][1], groups = VER[ver][2];
  var totalData = 0;
  groups.forEach(function (b) { totalData += b[0] * b[1]; });
  var countBits = ver < 10 ? 8 : 16;

  /* --- 비트열 만들기 --- */
  var bits = [];
  function put(val, len) { for (var n = len - 1; n >= 0; n--) bits.push((val >> n) & 1); }
  put(4, 4);                       // 바이트 모드
  put(bytes.length, countBits);
  for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  for (i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0);   // 종료 패턴
  while (bits.length % 8) bits.push(0);
  var dataCodewords = [];
  for (i = 0; i < bits.length; i += 8) {
    var b8 = 0; for (j = 0; j < 8; j++) b8 = (b8 << 1) | bits[i + j];
    dataCodewords.push(b8);
  }
  var pad = [0xEC, 0x11], p = 0;
  while (dataCodewords.length < totalData) dataCodewords.push(pad[p++ % 2]);

  /* --- 블록으로 나누고 오류정정 붙이기 --- */
  var dBlocks = [], eBlocks = [], pos = 0;
  groups.forEach(function (g) {
    for (var n = 0; n < g[0]; n++) {
      var blk = dataCodewords.slice(pos, pos + g[1]); pos += g[1];
      dBlocks.push(blk); eBlocks.push(rsEncode(blk, ecLen));
    }
  });
  /* --- 인터리브 --- */
  var allCw = [], maxD = 0;
  dBlocks.forEach(function (b) { if (b.length > maxD) maxD = b.length; });
  for (i = 0; i < maxD; i++) for (j = 0; j < dBlocks.length; j++) if (i < dBlocks[j].length) allCw.push(dBlocks[j][i]);
  for (i = 0; i < ecLen; i++) for (j = 0; j < eBlocks.length; j++) allCw.push(eBlocks[j][i]);

  /* --- 빈 판 만들기 --- */
  var size = ver * 4 + 17;
  var m = [], fixed = [];
  for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); fixed.push(new Array(size).fill(0)); }
  function set(r, c, val) { m[r][c] = val; fixed[r][c] = 1; }

  /* 위치 검출 패턴 + 분리자 */
  function finder(r0, c0) {
    for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
      var rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
               (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
               (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      set(rr, cc, on ? 1 : 0);
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  /* 타이밍 패턴 */
  for (i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }

  /* 정렬 패턴 */
  var ac = ALIGN[ver];
  for (i = 0; i < ac.length; i++) for (j = 0; j < ac.length; j++) {
    var ar = ac[i], acx = ac[j];
    if ((ar <= 8 && acx <= 8) || (ar <= 8 && acx >= size - 9) || (ar >= size - 9 && acx <= 8)) continue;
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
      var on2 = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      set(ar + dr, acx + dc, on2 ? 1 : 0);
    }
  }

  /* 어두운 모듈 + 형식 정보 자리 예약 */
  set(size - 8, 8, 1);
  for (i = 0; i <= 8; i++) { if (!fixed[8][i]) set(8, i, 0); if (!fixed[i][8]) set(i, 8, 0); }
  for (i = 0; i < 8; i++) { if (!fixed[8][size - 1 - i]) set(8, size - 1 - i, 0); if (!fixed[size - 1 - i][8]) set(size - 1 - i, 8, 0); }

  /* 버전 정보 (버전 7 이상) */
  if (ver >= 7) {
    var vinfo = bch(ver, 0x1F25, 12);
    for (i = 0; i < 18; i++) {
      var bit = (vinfo >> i) & 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  /* --- 데이터 채우기 (지그재그) --- */
  var bitIdx = 0, total = allCw.length * 8;
  function dataBit(n) { return n < total ? (allCw[n >> 3] >> (7 - (n & 7))) & 1 : 0; }
  var up = true;
  for (var col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (var t = 0; t < size; t++) {
      var row = up ? size - 1 - t : t;
      for (k = 0; k < 2; k++) {
        var cc2 = col - k;
        if (fixed[row][cc2]) continue;
        m[row][cc2] = dataBit(bitIdx++);
      }
    }
    up = !up;
  }

  /* --- 마스크 8개를 다 그려 보고 벌점이 가장 낮은 것을 고른다 --- */
  var maskFn = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];
  var best = null, bestScore = Infinity, bestMask = 0;
  for (var mk = 0; mk < 8; mk++) {
    var cand = m.map(function (row) { return row.slice(); });
    for (i = 0; i < size; i++) for (j = 0; j < size; j++)
      if (!fixed[i][j] && maskFn[mk](i, j)) cand[i][j] ^= 1;
    /* 형식 정보 기록 (레벨 M = 00) */
    var fmt = bch((0 << 3) | mk, 0x537, 10) ^ 0x5412;
    for (i = 0; i < 15; i++) {
      var fb = (fmt >> i) & 1;
      if (i < 6) cand[i][8] = fb;
      else if (i < 8) cand[i + 1][8] = fb;
      else if (i === 8) cand[8][7] = fb;
      else cand[8][14 - i] = fb;
      if (i < 8) cand[8][size - 1 - i] = fb;
      else cand[size - 15 + i][8] = fb;
    }
    var sc = penalty(cand, size);
    if (sc < bestScore) { bestScore = sc; best = cand; bestMask = mk; }
  }
  return { size: size, modules: best, version: ver, mask: bestMask };
}

/* 마스크 벌점 (ISO/IEC 18004 §8.8.2) */
function penalty(g, size) {
  var score = 0, i, j, run, prev, dark = 0;
  /* 규칙 1 — 같은 색이 5칸 이상 이어짐 */
  for (i = 0; i < size; i++) {
    run = 1; prev = g[i][0];
    for (j = 1; j < size; j++) {
      if (g[i][j] === prev) { run++; } else { if (run >= 5) score += run - 2; run = 1; prev = g[i][j]; }
    }
    if (run >= 5) score += run - 2;
    run = 1; prev = g[0][i];
    for (j = 1; j < size; j++) {
      if (g[j][i] === prev) { run++; } else { if (run >= 5) score += run - 2; run = 1; prev = g[j][i]; }
    }
    if (run >= 5) score += run - 2;
  }
  /* 규칙 2 — 2×2 같은 색 덩어리 */
  for (i = 0; i < size - 1; i++) for (j = 0; j < size - 1; j++) {
    var a = g[i][j];
    if (a === g[i][j + 1] && a === g[i + 1][j] && a === g[i + 1][j + 1]) score += 3;
  }
  /* 규칙 3 — 위치 검출 패턴을 닮은 배열 */
  var p1 = [1,0,1,1,1,0,1,0,0,0,0], p2 = [0,0,0,0,1,0,1,1,1,0,1];
  function match(arr, off, pat) {
    for (var t = 0; t < 11; t++) if (arr[off + t] !== pat[t]) return false;
    return true;
  }
  for (i = 0; i < size; i++) {
    var rowArr = g[i], colArr = [];
    for (j = 0; j < size; j++) colArr.push(g[j][i]);
    for (j = 0; j + 11 <= size; j++) {
      if (match(rowArr, j, p1) || match(rowArr, j, p2)) score += 40;
      if (match(colArr, j, p1) || match(colArr, j, p2)) score += 40;
    }
  }
  /* 규칙 4 — 검은 칸 비율이 50%에서 멀수록 */
  for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (g[i][j]) dark++;
  var pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/* ============================================================
   ② 화면 — 버튼과 팝업
   ============================================================ */

var CSS = [
  '.qrx-btn{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;',
  '  margin-left:10px;font-family:inherit;font-size:12.5px;font-weight:600;line-height:1;',
  '  padding:6px 11px;border-radius:999px;border:1px solid var(--line,#e3e6ea);',
  '  background:var(--panel,#fff);color:var(--accent,#2563eb);cursor:pointer;',
  '  white-space:nowrap;letter-spacing:0;box-shadow:0 1px 2px rgba(16,24,40,.06)}',
  'html button.qrx-btn{min-height:32px;padding:6px 11px;font-size:12.5px}',
  '@media (pointer:coarse){html button.qrx-btn{min-height:40px;padding:9px 14px;font-size:13.5px}}',
  '@media (hover:hover){.qrx-btn:hover{background:var(--accent,#2563eb);color:#fff;',
  '  border-color:var(--accent,#2563eb)}}',
  '.qrx-btn svg{width:15px;height:15px;flex:none}',

  '.qrx-back{position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.55);',
  '  display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}',
  '.qrx-modal{background:#fff;color:#1f2328;border-radius:14px;width:min(360px,100%);',
  '  padding:20px 20px 16px;box-shadow:0 20px 45px rgba(15,23,42,.32);text-align:center;',
  '  font-family:inherit;line-height:1.5}',
  '.qrx-modal h2{margin:0 0 3px;font-size:16px;font-weight:700;color:#1f2328;letter-spacing:0}',
  '.qrx-modal .qrx-lead{margin:0 0 14px;font-size:12.5px;color:#5b636b}',
  '.qrx-code{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:8px;',
  '  display:inline-block;line-height:0}',
  '.qrx-code canvas{display:block;width:248px;height:248px;image-rendering:pixelated}',
  '.qrx-url{margin:13px 0 0;font-size:12px;color:#454b52;word-break:break-all;text-align:left;',
  '  background:#f8fafc;border:1px solid #e3e6ea;border-radius:8px;padding:8px 10px;',
  '  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
  '.qrx-row{display:flex;gap:8px;margin-top:13px}',
  '.qrx-row button{flex:1;font-family:inherit;font-size:13px;font-weight:600;padding:10px 12px;',
  '  border-radius:9px;border:1px solid #e3e6ea;background:#fff;color:#1f2328;cursor:pointer}',
  'html .qrx-row button{min-height:42px}',
  '.qrx-row .qrx-primary{background:#2563eb;color:#fff;border-color:#2563eb}',
  '@media (hover:hover){.qrx-row button:hover{background:#f3f4f6}',
  '  .qrx-row .qrx-primary:hover{background:#1d4ed8}}',
  '.qrx-msg{margin:9px 0 0;font-size:12px;color:#15803d;min-height:16px}',
  '@media (max-width:400px){.qrx-code canvas{width:212px;height:212px}}',
  '@media print{.qrx-btn{display:none}}'
].join('');

var ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5z"/>' +
  '<path d="M13 13h3v3h-3v-3zm5 0h3v2h-3v-2zm-5 5h2v3h-2v-3zm3 1h2v2h-2v-2zm3-1h2v4h-2v-4z"/></svg>';

function drawQR(canvas, text) {
  var qr = encode(text);
  var quiet = 4, n = qr.size + quiet * 2;
  var px = Math.max(4, Math.floor(560 / n));      /* 모듈 하나의 실제 픽셀 수 (정수라야 흐려지지 않는다) */
  var side = n * px;
  canvas.width = side; canvas.height = side;
  var g = canvas.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, side, side);
  g.fillStyle = "#000000";
  for (var r = 0; r < qr.size; r++) for (var c = 0; c < qr.size; c++)
    if (qr.modules[r][c]) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
  return qr;
}

/* 이 페이지가 학생에게 안내할 실제 주소 */
function pageUrl(current) {
  var h = location.hostname;
  var live = (location.protocol === "http:" || location.protocol === "https:") &&
             h && h !== "localhost" && h !== "127.0.0.1" && h !== "0.0.0.0";
  if (live) return (location.origin + location.pathname).replace(/index\.html?$/i, "");
  return PUBLISHED_BASE + (current ? current + "/" : "");
}

function copyText(text, done) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback()); });
    return;
  }
  done(fallback());
  function fallback() {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
}

function openModal(title, url, opener) {
  var back = document.createElement("div");
  back.className = "qrx-back";
  back.setAttribute("role", "dialog");
  back.setAttribute("aria-modal", "true");
  back.setAttribute("aria-label", "QR 코드로 접속하기");
  back.innerHTML =
    '<div class="qrx-modal">' +
      '<h2></h2>' +
      '<p class="qrx-lead">휴대폰 카메라로 아래 QR 코드를 비추면 바로 열립니다.</p>' +
      '<div class="qrx-code"><canvas></canvas></div>' +
      '<p class="qrx-url"></p>' +
      '<p class="qrx-msg" role="status"></p>' +
      '<div class="qrx-row">' +
        '<button type="button" class="qrx-copy">링크 복사</button>' +
        '<button type="button" class="qrx-close qrx-primary">닫기</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(back);

  back.querySelector("h2").textContent = title;
  back.querySelector(".qrx-url").textContent = url;
  var msg = back.querySelector(".qrx-msg");
  try {
    drawQR(back.querySelector("canvas"), url);
  } catch (e) {
    back.querySelector(".qrx-code").innerHTML =
      '<p style="font-size:12.5px;color:#b91c1c;line-height:1.6;padding:14px">' +
      'QR 코드를 만들지 못했습니다. 아래 주소를 직접 입력해 주세요.</p>';
  }

  function close() {
    document.removeEventListener("keydown", onKey);
    back.remove();
    if (opener && opener.focus) opener.focus();
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
  back.querySelector(".qrx-close").onclick = close;
  back.querySelector(".qrx-copy").onclick = function () {
    copyText(url, function (ok) {
      msg.style.color = ok ? "#15803d" : "#b91c1c";
      msg.textContent = ok ? "주소를 복사했습니다." : "복사하지 못했습니다. 위 주소를 길게 눌러 복사하세요.";
    });
  };
  back.querySelector(".qrx-close").focus();
}

/* 콘솔에서 확인·검증할 수 있도록 밖으로 꺼내 둔다 (window.ChemLabQR.encode("...")) */
(typeof globalThis !== "undefined" ? globalThis : window).ChemLabQR =
  { encode: encode, draw: drawQR, url: pageUrl, base: PUBLISHED_BASE };

/* ============================================================
   ③ 붙이기
   ============================================================ */
if (typeof document !== "undefined") (function init() {
  var me = document.currentScript;
  var current = (me && me.dataset.current) || "";
  var sel = (me && me.dataset.titleSel) || "";

  function start() {
    /* 제목 찾기 — 페이지마다 구조가 조금씩 다르므로 순서대로 시도한다 */
    var h = sel ? document.querySelector(sel) : null;
    if (!h) {
      var order = [".head h1", ".pg-head .pg-title", ".pg-title", "header h1", "#header h1", "main h1", "h1"];
      for (var i = 0; i < order.length && !h; i++) {
        var found = document.querySelector(order[i]);
        if (found && !found.closest(".site-nav")) h = found;
      }
    }
    if (!h) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var url = pageUrl(current);
    var name = (h.textContent || "케미랩").replace(/\s+/g, " ").trim();

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qrx-btn";
    btn.innerHTML = ICON + "<span>QR 코드</span>";
    btn.title = "이 화면의 주소를 QR 코드로 보기";
    btn.setAttribute("aria-label", "이 화면의 주소를 QR 코드로 보기");
    btn.onclick = function () { openModal(name, url, btn); };

    h.appendChild(document.createTextNode(" "));
    h.appendChild(btn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

})();
