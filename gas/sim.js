"use strict";
/* ================= 기체 분자 운동 — 물리 엔진 =================
   단위계: k_B = 1 인 임의 단위(a.u.). 2차원 기체이므로
     평균 운동에너지 <½mv²> = k_B·T   →   v_rms = √(2kT/m)
     압력 P = (벽에 가해진 총 충격량) / (둘레 길이 × 시간)
     이상기체 상태방정식(2D):  P × (넓이) = N × k_B × T
============================================================== */
const H = 300;
const SPECIES = [
  { M:1, r:2.2, color:"#3b82f6", name:"가벼운 기체" },
  { M:4, r:3.0, color:"#ef4444", name:"무거운 기체" }
];
const DT = 0.035, SUBSTEPS = 2;

let W = 350, targetT = 300;
let particles = [], tracePath = [];

const $ = id => document.getElementById(id);
const boxCv = $("box"), bctx = boxCv.getContext("2d");
const hCv   = $("hist"), hctx = hCv.getContext("2d");

function makeParticle(sp){
  const s = SPECIES[sp];
  const v = Math.sqrt(2*targetT/s.M), a = Math.random()*Math.PI*2;
  return { sp,
    x: s.r + Math.random()*(W-2*s.r),
    y: s.r + Math.random()*(H-2*s.r),
    vx: v*Math.cos(a), vy: v*Math.sin(a) };
}
function setCount(sp, n){
  const cur = particles.filter(p=>p.sp===sp).length;
  if(n > cur){ for(let i=0;i<n-cur;i++) particles.push(makeParticle(sp)); }
  else if(n < cur){
    let left = cur-n;
    for(let i=particles.length-1;i>=0 && left>0;i--)
      if(particles[i].sp===sp){ particles.splice(i,1); left--; }
  }
}

let impulseAcc = 0, timeAcc = 0, pressure = 0;

function step(dt){
  for(const p of particles){
    const r = SPECIES[p.sp].r, m = SPECIES[p.sp].M;
    p.x += p.vx*dt;  p.y += p.vy*dt;
    if(p.x < r){        p.x = r;   impulseAcc += 2*m*Math.abs(p.vx); p.vx =  Math.abs(p.vx); }
    else if(p.x > W-r){ p.x = W-r; impulseAcc += 2*m*Math.abs(p.vx); p.vx = -Math.abs(p.vx); }
    if(p.y < r){        p.y = r;   impulseAcc += 2*m*Math.abs(p.vy); p.vy =  Math.abs(p.vy); }
    else if(p.y > H-r){ p.y = H-r; impulseAcc += 2*m*Math.abs(p.vy); p.vy = -Math.abs(p.vy); }
  }
  const n = particles.length;
  for(let i=0;i<n;i++){
    const a = particles[i], ra = SPECIES[a.sp].r, ma = SPECIES[a.sp].M;
    for(let j=i+1;j<n;j++){
      const b = particles[j], rb = SPECIES[b.sp].r, mb = SPECIES[b.sp].M;
      const dx = b.x-a.x, dy = b.y-a.y, R = ra+rb, d2 = dx*dx+dy*dy;
      if(d2 >= R*R || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx/d, ny = dy/d;
      const vn = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
      if(vn < 0){                                   // 서로 가까워질 때만 충돌 처리
        const imp = -2*vn / (1/ma + 1/mb);
        a.vx -= imp*nx/ma;  a.vy -= imp*ny/ma;
        b.vx += imp*nx/mb;  b.vy += imp*ny/mb;
      }
      const ov = (R-d)/2 + 0.01;                    // 겹침 분리
      a.x -= nx*ov; a.y -= ny*ov;  b.x += nx*ov; b.y += ny*ov;
    }
  }
  timeAcc += dt;
}

function currentT(){
  if(!particles.length) return targetT;
  let ke = 0;
  for(const p of particles) ke += 0.5*SPECIES[p.sp].M*(p.vx*p.vx+p.vy*p.vy);
  return ke/particles.length;
}
function thermostat(){
  const T = currentT();
  if(T <= 0) return;
  const lambda = Math.sqrt(1 + 0.08*(targetT/T - 1));   // 목표 온도로 부드럽게 수렴
  for(const p of particles){ p.vx *= lambda; p.vy *= lambda; }
}

const BINS = 40, vMax = 60;
const histA = new Float64Array(BINS), histB = new Float64Array(BINS);
function accumulateHist(){
  const tA = new Float64Array(BINS), tB = new Float64Array(BINS);
  for(const p of particles){
    const v = Math.hypot(p.vx,p.vy);
    let k = Math.floor(v/vMax*BINS);
    k = k >= BINS ? BINS-1 : (k < 0 ? 0 : k);
    (p.sp===0 ? tA : tB)[k] += 1;
  }
  const a = 0.03;
  for(let i=0;i<BINS;i++){
    histA[i] = histA[i]*(1-a) + tA[i]*a;
    histB[i] = histB[i]*(1-a) + tB[i]*a;
  }
}
function resetHist(){ histA.fill(0); histB.fill(0); }

function fit(cv, hCss){
  const dpr = window.devicePixelRatio || 1;
  cv.style.height = hCss+"px";
  cv.width  = Math.round(cv.clientWidth*dpr);
  cv.height = Math.round(hCss*dpr);
}

function drawBox(){
  const dpr = window.devicePixelRatio || 1;
  const cw = boxCv.width/dpr, ch = boxCv.height/dpr, scale = ch/H;
  bctx.setTransform(dpr,0,0,dpr,0,0);
  bctx.fillStyle = "#0f172a"; bctx.fillRect(0,0,cw,ch);

  bctx.save(); bctx.scale(scale,scale);
  bctx.fillStyle = "#111827"; bctx.fillRect(0,0,W,H);

  if($("trace").checked && tracePath.length>1){
    bctx.strokeStyle = "rgba(250,204,21,.75)";
    bctx.lineWidth = 1.6/scale;
    bctx.beginPath(); bctx.moveTo(tracePath[0][0], tracePath[0][1]);
    for(let i=1;i<tracePath.length;i++){
      const [x0,y0] = tracePath[i-1], [x1,y1] = tracePath[i];
      if(Math.hypot(x1-x0,y1-y0) > 30) bctx.moveTo(x1,y1); else bctx.lineTo(x1,y1);
    }
    bctx.stroke();
  }
  for(const p of particles){
    const s = SPECIES[p.sp];
    bctx.fillStyle = s.color;
    bctx.beginPath(); bctx.arc(p.x,p.y,s.r,0,6.2832); bctx.fill();
  }
  if($("trace").checked && particles.length){
    const p = particles[0];
    bctx.strokeStyle="#facc15"; bctx.lineWidth=2/scale;
    bctx.beginPath(); bctx.arc(p.x,p.y,SPECIES[p.sp].r+3.5,0,6.2832); bctx.stroke();
  }
  bctx.restore();

  const px = W*scale;                                  // 피스톤
  bctx.fillStyle = "#94a3b8"; bctx.fillRect(px,0,10,ch);
  bctx.fillStyle = "#64748b"; bctx.fillRect(px+10,ch/2-26,Math.max(0,cw-px-10),52);
  if(cw-px > 62){
    bctx.fillStyle = "#e2e8f0"; bctx.font = "600 11px sans-serif";
    bctx.fillText("피스톤", px+16, ch/2+4);
  }
}

function drawHist(){
  const dpr = window.devicePixelRatio || 1;
  const cw = hCv.width/dpr, ch = hCv.height/dpr;
  hctx.setTransform(dpr,0,0,dpr,0,0);
  hctx.clearRect(0,0,cw,ch);

  const pad = {l:38,r:10,t:10,b:26};
  const pw = cw-pad.l-pad.r, ph = ch-pad.t-pad.b, bw = pw/BINS;
  const T = currentT();

  let ymax = 1e-6;
  for(let i=0;i<BINS;i++) ymax = Math.max(ymax, histA[i], histB[i]);
  ymax *= 1.25;

  hctx.strokeStyle="#cbd5e1"; hctx.lineWidth=1; hctx.beginPath();
  hctx.moveTo(pad.l,pad.t); hctx.lineTo(pad.l,pad.t+ph); hctx.lineTo(pad.l+pw,pad.t+ph);
  hctx.stroke();
  hctx.fillStyle="#94a3b8"; hctx.font="11px sans-serif";
  hctx.fillText("입자 수", 4, pad.t+10);
  for(let s=0;s<=vMax;s+=20) hctx.fillText(String(s), pad.l + s/vMax*pw - 6, ch-10);
  hctx.fillText("속력 →", pad.l+pw-42, ch-10);

  for(const [h,c] of [[histA,"rgba(59,130,246,.62)"],[histB,"rgba(239,68,68,.62)"]]){
    hctx.fillStyle = c;
    for(let i=0;i<BINS;i++){
      const y = h[i]/ymax*ph;
      if(y>0.4) hctx.fillRect(pad.l+i*bw+0.5, pad.t+ph-y, bw-1, y);
    }
  }
  // 2D 맥스웰–볼츠만 이론 곡선: f(v) = (M/kT)·v·exp(−Mv²/2kT)
  const binV = vMax/BINS;
  for(let sp=0; sp<2; sp++){
    const N = particles.filter(p=>p.sp===sp).length;
    if(!N) continue;
    const M = SPECIES[sp].M;
    hctx.strokeStyle = sp===0 ? "#1d4ed8" : "#b91c1c";
    hctx.setLineDash([4,3]); hctx.lineWidth=1.6; hctx.beginPath();
    for(let i=0;i<=160;i++){
      const v = i/160*vMax;
      const y = (M/T)*v*Math.exp(-M*v*v/(2*T))*binV*N;
      const X = pad.l + v/vMax*pw;
      const Y = pad.t + ph - Math.min(y/ymax*ph, ph);
      i ? hctx.lineTo(X,Y) : hctx.moveTo(X,Y);
    }
    hctx.stroke(); hctx.setLineDash([]);
  }
}

function stats(){
  const T = currentT(), N = particles.length, V = W*H;
  let sA=0,nA=0,sB=0,nB=0;
  for(const p of particles){
    const v = Math.hypot(p.vx,p.vy);
    if(p.sp===0){sA+=v;nA++;} else {sB+=v;nB++;}
  }
  return { T, N, V, P: pressure,
           Z: (N&&T) ? pressure*V/(N*T) : 0,
           vA: nA?sA/nA:0, vB: nB?sB/nB:0 };
}
function updateReadouts(){
  const s = stats();
  $("rP").textContent  = (s.P*1000).toFixed(1);
  $("rN").textContent  = s.N;
  $("rZ").textContent  = s.Z ? s.Z.toFixed(3) : "–";
  $("rT").textContent  = s.T.toFixed(0);
  $("rVA").textContent = s.vA ? s.vA.toFixed(1) : "–";
  $("rVB").textContent = s.vB ? s.vB.toFixed(1) : "–";
}

function loop(){
  if(!$("pause").checked){
    for(let s=0;s<SUBSTEPS;s++) step(DT);
    if($("isoT").checked) thermostat();
    accumulateHist();
    if($("trace").checked && particles.length){
      tracePath.push([particles[0].x, particles[0].y]);
      if(tracePath.length > 900) tracePath.shift();
    }
    if(timeAcc > 0.4){
      const p = impulseAcc/(2*(W+H)*timeAcc);
      pressure = pressure ? pressure*0.75 + p*0.25 : p;
      impulseAcc = 0; timeAcc = 0;
    }
  }
  drawBox(); drawHist(); updateReadouts();
  requestAnimationFrame(loop);
}

/* ---------- 컨트롤 ---------- */
$("sT").oninput = e => { targetT = +e.target.value; $("vT").textContent = targetT; resetHist(); };
$("sW").oninput = e => {
  W = +e.target.value;
  $("vV").textContent = (W*H/1e4).toFixed(2);
  for(const p of particles){                     // 피스톤이 입자를 밀어냄
    const r = SPECIES[p.sp].r;
    if(p.x > W-r){ p.x = W-r; if(p.vx>0) p.vx = -p.vx; }
  }
  tracePath.length = 0;
};
$("sNA").oninput = e => { $("vNA").textContent = e.target.value; setCount(0,+e.target.value); resetHist(); };
$("sNB").oninput = e => { $("vNB").textContent = e.target.value; setCount(1,+e.target.value); resetHist(); };
$("trace").onchange = () => { tracePath.length = 0; };

/* ---------- 데이터 기록 / CSV ---------- */
let rows = [];
const HEADERS = ["이름","온도 T (K)","부피 V","N(가벼움)","N(무거움)","전체 N",
                 "압력 P (a.u.)","P·V","PV/NkT","평균속력(가벼움)","평균속력(무거움)"];
$("rec").onclick = () => {
  const s = stats(), nA = particles.filter(p=>p.sp===0).length;
  rows.push([ $("sname").value.trim() || "(이름없음)",
    Math.round(s.T), s.V, nA, s.N-nA, s.N,
    +(s.P*1000).toFixed(2), +(s.P*1000*s.V/1e4).toFixed(2),
    +s.Z.toFixed(3), +s.vA.toFixed(2), +s.vB.toFixed(2) ]);
  renderTable();
};
$("clr").onclick = () => { rows = []; renderTable(); };
$("csv").onclick = () => {
  if(!rows.length){ alert("먼저 데이터를 기록하세요."); return; }
  const csv = "﻿" + [HEADERS, ...rows].map(r=>r.join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
  a.download = (($("sname").value.trim() || "기체실험").replace(/[\\/:*?"<>|]/g,"")) + "_기체분자운동.csv";
  a.click(); URL.revokeObjectURL(a.href);
};
function renderTable(){
  const wrap = $("tableWrap");
  if(!rows.length){ wrap.innerHTML = '<div class="empty">아직 기록이 없습니다.</div>'; return; }
  const show = [1,2,6,7,8,9,10];
  wrap.innerHTML = "<table><thead><tr><th>#</th>" +
    show.map(i=>`<th>${HEADERS[i]}</th>`).join("") + "</tr></thead><tbody>" +
    rows.map((r,k)=>`<tr><td>${k+1}</td>` + show.map(i=>`<td>${r[i]}</td>`).join("") + "</tr>").join("") +
    "</tbody></table>";
}

/* ---------- 시작 ---------- */
function resize(){
  fit(boxCv, Math.max(240, Math.min(360, boxCv.clientWidth*0.6)));
  fit(hCv, 200);
}
window.addEventListener("resize", resize);
setCount(0, 60); setCount(1, 30);
$("vV").textContent = (W*H/1e4).toFixed(2);
resize();
loop();
