"use strict";
/* ============================================================================
   지질 시대의 바다 — 1인칭 라이드 (통합판)  · three.js r147
   ----------------------------------------------------------------------------
   한 페이지에서 선캄브리아 / 고생대 / 중생대 버튼으로 전환한다.
   렌더 품질 우선(교실 TV·PC 기준) — 성능 자동 강등 없음.

   렌더 파이프라인
     · HDR 씬 → 커스텀 블룸(밝은 부분 추출 → 분리형 가우시안 → 합성) → ACES 톤매핑
     · 수심 지수 안개(FogExp2) · 수면 프레넬+태양 스펙큘러 · 갓레이(빛기둥)
     · 코스틱스(해저·생물 윗면에 물결 빛무늬) · 부유물(marine snow) · 군영(school)

   교육 설계는 기존 geotime 을 그대로 승계
     ① M13 "화석이 거의 없다 = 생물이 거의 없었다" → 선캄브리아 해저에 가장 큰 물체
        (스트로마톨라이트)가 서 있다. 없는 것은 「단단한 부분」과 「헤엄치는 것」.
     ② 관찰 포인트 3: ① 얼마나 많은가 · ② 단단한 부분(발광 테두리 색) · ③ 고착/유영
     ③ 하늘을 나는 생물 0 (익룡≠공룡, M3)
     · 테두리 색: 주황=단단함 · 보라=부드러움 · 초록=광합성. 몸은 자연색.

   데이터의 유일한 원천은 이 파일의 GEO 다(F-1).
   ========================================================================== */

window.GeoRide = (function () {
  const T = window.THREE;

  function makeRng(seed) { let s = seed >>> 0; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

  /* ===== 공유 유니폼(모든 커스텀 셰이더가 같은 시간값을 본다) ===== */
  const UNI = { time: { value: 0 } };

  /* ===== 화면 문구 (기존 geotime TEXT 승계, 활동지 제외) ===== */
  const TEXT = {
    title: "지질 시대의 바다",
    subheadRide: "정해진 길을 따라 바닷속을 1인칭으로 지나갑니다. 화면을 끌면 고개가 돌아갑니다. 위 버튼으로 시대를 바꿉니다.",
    tabs: { precambrian: "선캄브리아", paleozoic: "고생대", mesozoic: "중생대" },
    observationChips: ["① 얼마나 많은가", "② 단단한 부분(테두리 색)", "③ 붙어 있나 헤엄치나"],
    rimLegend: [
      { c: "--p-orange", t: "주황 테두리 = 몸에 단단한 부분 있음" },
      { c: "--p-violet", t: "보라 = 부드러움" },
      { c: "--p-mint", t: "초록 = 광합성 생물" }
    ],
    lieCardFull: "이 화면의 생물과 바다는 사진이 아니라, 화석 증거를 바탕으로 한 추정을 컴퓨터로 그린 그림입니다. 색깔, 피부 무늬, 헤엄치는 모습, 물의 색은 화석에 남지 않으므로 대부분 만들어 넣은 것입니다. 여기에서 믿을 것은 「무엇이 얼마나 많은가 · 몸에 단단한 부분이 있는가 · 바닥에 붙어 있는가 헤엄치는가」 세 가지뿐입니다. 테두리 색은 사실이 아니라, 그 세 가지를 읽게 하려고 입혀 놓은 표시입니다.",
    lieStripShort: "이 그림의 색·무늬·움직임은 추정입니다. 믿을 것은 관찰 포인트 세 가지입니다.",
    startButton: "관찰 시작",
    introCard: {
      precambrian: "선캄브리아시대의 바다입니다. 세 가지만 보세요 — ① 생물이 얼마나 많은가 ② 몸에 단단한 부분이 있는가(테두리 색) ③ 바닥에 붙어 있는가, 헤엄치는가.",
      paleozoic: "고생대의 바다입니다. 같은 세 가지를 봅니다. 아까 그 바다와 무엇이 달라졌는지에 눈을 두세요.",
      mesozoic: "중생대의 바다입니다. 같은 세 가지를 봅니다. 이번에는 무엇이 달라졌나요?"
    },
    stopBriefing: {
      precambrian: [
        "멈췄습니다. 먼저 앞을 보세요. 물속에 무엇이 보이나요? 이제 아래를 내려다보세요. 바닥에는요?",
        "이 기둥이 이 바다에서 가장 큰 것입니다(스트로마톨라이트). 가로로 난 층을 세어 보세요. 남세균이 자라는 것과 물속 입자가 쌓이는 것이 번갈아 일어나 생긴 층입니다.",
        "지금 보이는 것들 중에 헤엄치는 것이 몇 개나 되나요? 나머지는 어디에 있나요?"
      ],
      paleozoic: [
        "같은 자리, 다른 시대입니다. 앞을 보세요. 아까와 무엇이 다른가요? 아래도 보세요.",
        "가까이 왔습니다. 등에 가로 마디가 보이는 것(삼엽충)이 있나요? 테두리가 주황인 것들 — 몸을 덮은 단단한 껍데기입니다.",
        "바닥과 중간층을 번갈아 보세요. 아까 그 바다와 비교하면 어느 쪽이 달라졌나요?"
      ],
      mesozoic: [
        "환경이 또 바뀌었습니다. 앞을 보세요. 고생대와 견주면 어떤가요?",
        "나선으로 감긴 껍질(암모나이트)을 찾아보세요. 큰 것들 — 목이 길거나 물고기를 닮은 헤엄치는 것들이 보이나요?",
        "이제 바닥을 보세요. 그리고 다시 중간층을 보세요. 어느 쪽에 더 많은가요? 위도 한번 올려다보세요."
      ]
    },
    finishHint: "위를 올려다보세요. 물 밖에는 무엇이 있나요? 이 시대에서 본 세 가지를 떠올려 보세요.",
    lengthFoot: "지질 시대 전체를 100으로 본 길이입니다. 네 시대 길이는 전혀 같지 않습니다.",
    fallbackNotice: "이 기기에서는 3D 그리기(WebGL)를 쓸 수 없습니다. 대신 단면도로 같은 세 가지를 그대로 관찰하세요 — ① 생물이 얼마나 많은가 ② 몸에 단단한 부분이 있는가(테두리 색) ③ 바닥에 붙어 있는가 헤엄치는가.",
    continueButton: "계속 가기",
    pauseButton: "일시정지",
    restartButton: "처음부터",
    handsOn: "탑승 바 숨기기", handsOff: "탑승 바 보이기"
  };

  /* ===== 시대별 환경 ===== */
  const ENV = {
    precambrian: {
      label: "선캄브리아", introLabel: "선캄브리아시대",
      seafloorY: -6, railY: -3.0,
      water: 0x1f3f39, deep: 0x0b1a17, floor: 0x7a6c48,
      fogDensity: 0.042, sun: 0xcaf0df, sunI: 1.0, sunbeam: 1.1, caustic: 0.85,
      lightDir: [0.12, -1.0, 0.08], surfaceBright: 0.85, grade: [1.02, 1.03, 0.96],
      exposure: 1.02, ambient: 0.65,
      envLine: "산소 ↑ (남세균 광합성), 오존층 아직 ✗"
    },
    paleozoic: {
      label: "고생대", introLabel: "고생대",
      seafloorY: -9, railY: -5.0,
      water: 0x114050, deep: 0x061d28, floor: 0x82724d,
      fogDensity: 0.032, sun: 0xbfe6f5, sunI: 0.85, sunbeam: 0.72, caustic: 0.55,
      lightDir: [0.22, -0.94, 0.26], surfaceBright: 0.58, grade: [0.96, 1.0, 1.06],
      exposure: 0.88, ambient: 0.46,
      envLine: "오존층 형성 ★ → 생물의 육상 진출"
    },
    mesozoic: {
      label: "중생대", introLabel: "중생대",
      seafloorY: -12, railY: -6.5,
      water: 0x0c2c46, deep: 0x040f1c, floor: 0x4c483f,
      fogDensity: 0.040, sun: 0xa9cdec, sunI: 0.68, sunbeam: 0.5, caustic: 0.33,
      lightDir: [0.10, -0.98, 0.16], surfaceBright: 0.4, grade: [0.93, 0.98, 1.10],
      exposure: 0.72, ambient: 0.34,
      envLine: "판게아 분리, 화산활동↑ CO₂↑ → 온난"
    }
  };

  /* ===== 종 정의 (기존 geotime 승계 + 밀도·형태 보강) ===== */
  const SPECIES = {
    precambrian: [
      { id: "stromatolite", name: "스트로마톨라이트", n: 8, animal: false, hard: null, loc: "attached", shape: "stromatolite", body: 0x6f5c3c, sizeM: 2.3, hero: true },
      { id: "matpatch", name: "미생물 매트", n: 14, animal: false, hard: null, loc: "attached", shape: "mat", body: 0x4a5f3a, sizeM: 1.0 },
      { id: "seaweed_pc", name: "해초", n: 16, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x2f5137, sizeM: 1.0 },
      { id: "soft_bottom", name: "부드러운 바닥 생물", n: 12, animal: true, hard: false, loc: "bottom", shape: "blob", body: 0x9a8fa6, sizeM: 0.5 },
      { id: "jelly_pc", name: "해파리 모양", n: 4, animal: true, hard: false, loc: "swim", shape: "bell", body: 0xa8c0d8, sizeM: 0.34 }
    ],
    paleozoic: [
      { id: "trilobite", name: "삼엽충", n: 14, animal: true, hard: true, loc: "bottom", shape: "trilobite", body: 0x6f5636, sizeM: 0.42, label: "삼엽충" },
      { id: "bivalve", name: "조개 모양", n: 14, animal: true, hard: true, loc: "bottom", shape: "shell", body: 0xccb98d, sizeM: 0.30 },
      { id: "squidshell", name: "껍데기 오징어", n: 8, animal: true, hard: true, loc: "swim", shape: "orthocone", body: 0xc0a06a, sizeM: 0.6 },
      { id: "coral", name: "산호 군체", n: 16, animal: true, hard: true, loc: "attached", shape: "coral", body: 0xcf8a70, sizeM: 0.55 },
      { id: "fish_pz", name: "헤엄치는 척추동물", n: 26, animal: true, hard: true, loc: "swim", shape: "fish", body: 0x9aa7ad, sizeM: 0.42, school: true },
      { id: "jelly_pz", name: "해파리", n: 5, animal: true, hard: false, loc: "swim", shape: "bell", body: 0xa8c0d8, sizeM: 0.30 },
      { id: "seaweed_pz", name: "해조류", n: 20, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x2e5a3a, sizeM: 0.9 }
    ],
    mesozoic: [
      { id: "ammonite", name: "암모나이트", n: 30, animal: true, hard: true, loc: "swim", shape: "ammonite", body: 0xcdb389, sizeM: 0.36, label: "암모나이트" },
      { id: "longneck", name: "목이 긴 파충류", n: 3, animal: true, hard: true, loc: "swim", shape: "plesiosaur", body: 0x3f4a3c, sizeM: 2.7, hero: true },
      { id: "ichthyo", name: "물고기 모양 파충류", n: 6, animal: true, hard: true, loc: "swim", shape: "ichthyo", body: 0x3c4a58, sizeM: 1.9, hero: true },
      { id: "fish_mz", name: "헤엄치는 척추동물", n: 20, animal: true, hard: true, loc: "swim", shape: "fish", body: 0x9aa7ad, sizeM: 0.42, school: true },
      { id: "bottom_mz", name: "바닥 껍데기·산호", n: 10, animal: true, hard: true, loc: "bottom", shape: "shell", body: 0xc2b088, sizeM: 0.4 },
      { id: "jelly_mz", name: "해파리", n: 5, animal: true, hard: false, loc: "swim", shape: "bell", body: 0xa8c0d8, sizeM: 0.30 },
      { id: "seaweed_mz", name: "해조류", n: 14, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x2c5238, sizeM: 0.8 }
    ]
  };

  const ERAS = ["precambrian", "paleozoic", "mesozoic"];
  const STOPS_U = [0.30, 0.60, 0.92];
  const ERA_LENGTH_PERCENT = { precambrian: 88.2, paleozoic: 6.3, mesozoic: 4.1, cenozoic: 1.4 };
  const ERA_ORDER = ["precambrian", "paleozoic", "mesozoic", "cenozoic"];
  const ERA_KOR = { precambrian: "선캄브리아", paleozoic: "고생대", mesozoic: "중생대", cenozoic: "신생대" };
  const RIM = { photo: 0x34d399, hard: 0xfb923c, soft: 0xa78bfa };
  function rimFor(sp) { return !sp.animal ? RIM.photo : (sp.hard ? RIM.hard : RIM.soft); }
  const GEO = { eras: ERAS, env: ENV, species: SPECIES, eraLengthPercent: ERA_LENGTH_PERCENT, text: TEXT };

  /* ===== 코스틱스 GLSL (여러 셰이더에 주입) ===== */
  const CAUSTIC_GLSL = `
    float caustic(vec2 uv, float t){
      vec2 p = mod(uv*6.2831853, 6.2831853) - 250.0;
      vec2 i = vec2(p); float c = 1.0; float inten = 0.0045;
      for (int n = 0; n < 4; n++){
        float tt = t * (1.0 - (3.5 / float(n+1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten)));
      }
      c /= 4.0; c = 1.17 - pow(c, 1.4);
      float v = pow(abs(c), 8.0);
      return clamp(v, 0.0, 1.0);
    }`;

  /* ===== 생물 재질: 자연색 몸 + 프레넬 발광 테두리 + 윗면 코스틱스 ===== */
  function creatureMaterial(bodyHex, rimHex, opt) {
    opt = opt || {};
    const m = new T.MeshStandardMaterial({
      color: new T.Color(bodyHex),
      roughness: opt.rough != null ? opt.rough : 0.7,
      metalness: opt.metal != null ? opt.metal : 0.05,
      transparent: !!opt.transparent, opacity: opt.opacity != null ? opt.opacity : 1.0,
      side: opt.side || T.FrontSide, emissive: new T.Color(bodyHex).multiplyScalar(0.05)
    });
    m.userData.u = {
      uRim: { value: new T.Color(rimHex) },
      uRimStr: { value: opt.rimStr != null ? opt.rimStr : 1.0 },
      uRimPow: { value: opt.rimPow != null ? opt.rimPow : 2.3 },
      uCaustI: { value: opt.caustI != null ? opt.caustI : 0.0 },
      uTime: UNI.time
    };
    m.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, m.userData.u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGN;\nvarying vec3 vGP;")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\n #ifdef USE_INSTANCING\n vGP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n #else\n vGP=(modelMatrix*vec4(transformed,1.0)).xyz;\n #endif\n vGN=normalize(mat3(modelMatrix)*objectNormal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>",
          "#include <common>\nuniform vec3 uRim;uniform float uRimStr;uniform float uRimPow;uniform float uCaustI;uniform float uTime;\nvarying vec3 vGN;varying vec3 vGP;\n" + CAUSTIC_GLSL)
        .replace("#include <dithering_fragment>",
          "#include <dithering_fragment>\n vec3 Vd=normalize(cameraPosition-vGP);\n float rf=pow(1.0-clamp(dot(normalize(vGN),Vd),0.0,1.0),uRimPow);\n gl_FragColor.rgb+=uRim*rf*uRimStr;\n float up=clamp(vGN.y,0.0,1.0);\n if(uCaustI>0.001){ float ca=caustic(vGP.xz*0.09,uTime*0.35); gl_FragColor.rgb+=vec3(0.7,0.85,0.8)*ca*up*uCaustI; }");
    };
    return m;
  }

  /* ===== 형태 빌더 ===== */
  const G = {};
  function geomFor(shape) {
    if (G[shape]) return G[shape];
    let g;
    switch (shape) {
      case "stromatolite": {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const t = i / 20; const r = 0.5 * (1 - 0.32 * t) + 0.055 * Math.sin(t * Math.PI * 8); pts.push(new T.Vector2(Math.max(0.02, r), t * 2.0)); }
        g = new T.LatheGeometry(pts, 28); break;
      }
      case "mat": { g = new T.CircleGeometry(0.6, 18); g.rotateX(-Math.PI / 2); break; }
      case "frond": { g = new T.PlaneGeometry(0.32, 1.0, 1, 8); g.translate(0, 0.5, 0); break; }
      case "blob": { g = new T.SphereGeometry(0.5, 20, 14); g.scale(1.25, 0.7, 1.0); break; }
      case "bell": { g = new T.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6); g.scale(1.0, 0.9, 1.0); break; }
      case "trilobite": { g = new T.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(0.62, 0.34, 1.08); break; }
      case "shell": { g = new T.SphereGeometry(0.5, 18, 14); g.scale(1.0, 0.5, 0.85); break; }
      case "orthocone": { g = new T.ConeGeometry(0.26, 1.5, 20); g.rotateX(Math.PI * 0.5); break; }
      case "coral": { g = coralGeom(); break; }
      case "fish": { g = new T.SphereGeometry(0.5, 18, 14); g.scale(1.7, 0.5, 0.42); break; }
      case "ammonite": { g = new T.TubeGeometry(new T.CatmullRomCurve3(spiralPoints(1.05, 4.6, 70)), 90, 0.155, 12, false); break; }
      case "plesiosaur": { g = new T.SphereGeometry(0.5, 20, 16); g.scale(1.7, 0.7, 0.7); break; }
      case "ichthyo": { g = new T.SphereGeometry(0.5, 20, 14); g.scale(2.1, 0.5, 0.5); break; }
      default: g = new T.SphereGeometry(0.5, 14, 10);
    }
    g.computeVertexNormals(); G[shape] = g; return g;
  }
  function coralGeom() {
    const geos = []; const rng = makeRng(55);
    for (let i = 0; i < 6; i++) {
      const c = new T.CylinderGeometry(0.03, 0.09, 0.5 + rng() * 0.5, 6);
      c.translate((rng() - 0.5) * 0.3, 0.25 + rng() * 0.2, (rng() - 0.5) * 0.3);
      c.rotateZ((rng() - 0.5) * 0.6); c.rotateX((rng() - 0.5) * 0.6);
      geos.push(c);
    }
    return mergeGeos(geos);
  }
  function mergeGeos(list) {
    // 간단 병합(위치·법선만) — BufferGeometryUtils 없이 동작
    let vc = 0; for (const g of list) vc += g.attributes.position.count;
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
    let o = 0;
    for (const g of list) {
      const p = g.attributes.position.array, nn = g.attributes.normal.array;
      pos.set(p, o); nor.set(nn, o); o += p.length;
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nor, 3));
    return out;
  }
  function spiralPoints(turns, growth, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const a = t * turns * Math.PI * 2; const r = 0.05 * Math.pow(growth, t); pts.push(new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    return pts;
  }

  /* ===== 레일 ===== */
  function makeRail(env, seedBase) {
    const raw = []; const rnd = makeRng(9001 + seedBase * 77);
    for (let i = 0; i < 8; i++) {
      const t = i / 7; const x = t * 108;
      const z = 4.5 * Math.sin(t * Math.PI * 1.35 + seedBase) + (rnd() - 0.5) * 1.2;
      const y = env.railY + 0.85 * Math.sin(t * Math.PI * 1.6 + seedBase * 0.7);
      raw.push(new T.Vector3(x, y, z));
    }
    const curve = new T.CatmullRomCurve3(raw, false, "catmullrom", 0.5); curve.arcLengthDivisions = 1200;
    const total = 108;
    function at(s) {
      const u = Math.max(0, Math.min(1, s / total));
      const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      const right = new T.Vector3().crossVectors(tan, new T.Vector3(0, 1, 0)).normalize();
      return { pos: [p.x, p.y, p.z], tan: [tan.x, tan.y, tan.z], right: [right.x, right.y, right.z] };
    }
    return { curve, total, at };
  }

  /* ===== 환경 구성물 ===== */
  function buildWaterSurface(env) {
    const geo = new T.PlaneGeometry(360, 360, 100, 100); geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      transparent: true, side: T.DoubleSide, depthWrite: false,
      uniforms: {
        uTime: UNI.time, uColor: { value: new T.Color(env.water).lerp(new T.Color(0xffffff), 0.35) },
        uBright: { value: env.surfaceBright }, uSun: { value: new T.Vector3(-env.lightDir[0], -env.lightDir[1], -env.lightDir[2]).normalize() },
        uSunCol: { value: new T.Color(env.sun) }
      },
      vertexShader: `uniform float uTime; varying vec3 vWP; varying vec2 vUv;
        void main(){ vUv=uv; vec3 p=position;
          float w = sin(p.x*0.28+uTime*0.8)*0.22 + cos(p.z*0.33+uTime*1.0)*0.20 + sin((p.x+p.z)*0.15+uTime*0.5)*0.12;
          p.y += w; vWP=(modelMatrix*vec4(p,1.0)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `precision highp float; uniform vec3 uColor; uniform float uBright; uniform float uTime;
        uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vWP; varying vec2 vUv;
        void main(){
          vec3 V = normalize(cameraPosition - vWP);
          float fres = pow(1.0 - abs(V.y), 3.0);
          float sun = pow(max(dot(V, uSun), 0.0), 60.0);
          float rip = sin(vUv.x*160.0+uTime*1.6)*sin(vUv.y*160.0-uTime*1.3);
          float caustic = smoothstep(0.25,1.0, rip*0.5+0.5);
          vec3 c = uColor*(0.5+0.6*uBright) + caustic*0.22*uBright + uSunCol*sun*1.4*uBright;
          float a = clamp(0.32 + 0.42*uBright + fres*0.3, 0.0, 0.92);
          gl_FragColor = vec4(c, a);
        }`
    });
    const m = new T.Mesh(geo, mat); m.position.y = 0; m.renderOrder = 2;
    return m;
  }

  function buildGodrays(env) {
    const grp = new T.Group();
    const dir = new T.Vector3(env.lightDir[0], env.lightDir[1], env.lightDir[2]).normalize();
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uTime: UNI.time, uColor: { value: new T.Color(env.sun) }, uI: { value: env.sunbeam } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; uniform vec3 uColor; uniform float uI; uniform float uTime; varying vec2 vUv;
        void main(){ float edge=smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x);
          float fade=smoothstep(0.0,0.3,vUv.y)*smoothstep(1.0,0.5,vUv.y);
          float flick=0.8+0.2*sin(uTime*0.7+vUv.y*5.0+vUv.x*3.0);
          gl_FragColor=vec4(uColor, edge*fade*0.14*uI*flick); }`
    });
    const rng = makeRng(777);
    for (let i = 0; i < 6; i++) {
      const g = new T.PlaneGeometry(3.6 + rng() * 2.6, 30);
      const beam = new T.Mesh(g, mat);
      beam.position.set(8 + i * 16 + rng() * 8, env.seafloorY / 2, (rng() - 0.5) * 12);
      beam.lookAt(beam.position.clone().add(dir)); beam.rotateX(Math.PI / 2); beam.renderOrder = 1;
      grp.add(beam);
    }
    return grp;
  }

  function makeSandTexture(env) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d");
    const base = new T.Color(env.floor); c.fillStyle = "#" + base.getHexString(); c.fillRect(0, 0, 256, 256);
    const rng = makeRng(8080);
    for (let y = 0; y < 256; y += 4) {
      const shade = 0.7 + 0.3 * Math.sin(y * 0.16 + rng() * 0.6);
      c.strokeStyle = "rgba(0,0,0," + (0.11 * shade).toFixed(3) + ")"; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x * 0.05 + y * 0.1) * 3; x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke();
    }
    for (let i = 0; i < 1600; i++) { const x = rng() * 256, y = rng() * 256, r = rng() * 1.6; c.fillStyle = "rgba(" + (rng() < 0.5 ? "0,0,0," : "255,255,255,") + (0.05 + rng() * 0.06).toFixed(3) + ")"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(26, 26); tex.anisotropy = 8; tex.encoding = T.sRGBEncoding;
    return tex;
  }

  function buildSeafloor(env) {
    const geo = new T.PlaneGeometry(340, 340, 150, 150); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const rng = makeRng(4242);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = Math.sin(x * 0.15) * 0.5 + Math.cos(z * 0.18) * 0.5 + Math.sin(x * 0.5 + z * 0.3) * 0.16 + (rng() - 0.5) * 0.5;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, map: makeSandTexture(env), roughness: 1.0, metalness: 0.0 });
    mat.userData.u = { uTime: UNI.time, uCaustI: { value: env.caustic } };
    mat.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n vFP=(modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;uniform float uCaustI;varying vec3 vFP;\n" + CAUSTIC_GLSL)
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n float ca=caustic(vFP.xz*0.09,uTime*0.35);\n gl_FragColor.rgb+=vec3(0.75,0.9,0.85)*ca*uCaustI;");
    };
    const m = new T.Mesh(geo, mat); m.position.y = env.seafloorY;
    return m;
  }

  function makeSnowTexture() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 32; const c = cv.getContext("2d");
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    return new T.CanvasTexture(cv);
  }
  function buildMarineSnow(env) {
    const N = 1400; const geo = new T.BufferGeometry(); const arr = new Float32Array(N * 3); const rng = makeRng(9099);
    for (let i = 0; i < N; i++) { arr[i * 3] = rng() * 140 - 8; arr[i * 3 + 1] = env.seafloorY + rng() * (0 - env.seafloorY); arr[i * 3 + 2] = (rng() - 0.5) * 48; }
    geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const mat = new T.PointsMaterial({ map: makeSnowTexture(), color: 0xd6efe8, size: 0.14, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
    return new T.Points(geo, mat);
  }

  /* ===== 한 종 인스턴스 빌드 ===== */
  function buildSpecies(sp, env, railFn, seed, disposal) {
    const rng = makeRng(seed); const rim = rimFor(sp); const geom = geomFor(sp.shape);
    const transparent = sp.shape === "bell";
    const caustI = (sp.loc === "bottom" || sp.loc === "attached") ? env.caustic * 0.8 : env.caustic * 0.25;
    const mat = creatureMaterial(sp.body, rim, {
      transparent, opacity: transparent ? 0.5 : 1.0, rough: sp.animal ? 0.55 : 0.85,
      metal: sp.hard ? 0.25 : 0.05, side: transparent ? T.DoubleSide : T.FrontSide,
      rimStr: transparent ? 1.9 : (sp.hero ? 1.6 : 1.35), caustI
    });
    disposal.mats.push(mat);
    const insts = []; const total = railFn.total;
    const schoolCenters = [];
    if (sp.school) for (let k = 0; k < 4; k++) schoolCenters.push({ u: 0.15 + rng() * 0.7, side: rng() < 0.5 ? -1 : 1, y: env.railY + (rng() - 0.4) * 2.5 });
    for (let i = 0; i < sp.n; i++) {
      let u, lat, vy, sc = null;
      if (sp.school) {
        sc = schoolCenters[i % schoolCenters.length];
        u = Math.max(0.03, Math.min(0.98, sc.u + (rng() - 0.5) * 0.06));
      } else if (rng() < 0.45) { u = Math.max(0.03, Math.min(0.99, STOPS_U[i % 3] + (rng() - 0.5) * 0.10)); }
      else { u = 0.03 + 0.94 * (i + rng() * 0.6) / sp.n; }
      const at = railFn.at(u * total); const side = sc ? sc.side : (rng() < 0.5 ? -1 : 1);
      if (sp.loc === "swim") {
        const clear = 2.6 + sp.sizeM * 1.9 + (sp.hero ? 3.2 : 0);
        lat = side * (clear + rng() * (sc ? 2.5 : 6.0));
        const band = sc ? sc.y : env.railY + (rng() - 0.35) * 3.2;
        vy = Math.min(env.railY + 1.6, Math.max(env.seafloorY + 0.6, band + (sc ? (rng() - 0.5) * 1.5 : 0)));
      } else { lat = side * (1.1 + sp.sizeM * 0.6 + rng() * 6.5); vy = env.seafloorY + 0.02; }
      const px = at.pos[0] + at.right[0] * lat, pz = at.pos[2] + at.right[2] * lat;
      const s = sp.sizeM * (0.82 + rng() * 0.4);
      insts.push({ base: new T.Vector3(px, vy, pz), yaw: rng() * Math.PI * 2, scale: s, phase: rng() * Math.PI * 2, speed: 0.4 + rng() * 0.8 });
    }

    if (sp.shape === "plesiosaur") {
      const group = new T.Group();
      insts.forEach(it => group.add(buildPlesiosaur(mat, it, disposal)));
      return { kind: "group", node: group, sp, insts, anim: "swim" };
    }
    const mesh = new T.InstancedMesh(geom, mat, sp.n); mesh.frustumCulled = false;
    const dummy = new T.Object3D();
    insts.forEach((it, k) => { dummy.position.copy(it.base); dummy.rotation.set(0, it.yaw, 0); dummy.scale.setScalar(it.scale); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
    const anim = (sp.loc === "swim") ? (sp.shape === "bell" ? "jelly" : "swim") : (sp.shape === "frond" ? "sway" : "still");
    return { kind: "inst", node: mesh, mesh, sp, insts, anim };
  }

  function buildPlesiosaur(mat, it, disposal) {
    const g = new T.Group();
    const gBody = geomFor("plesiosaur");
    g.add(new T.Mesh(gBody, mat));
    const neckG = new T.CylinderGeometry(0.10, 0.16, 1.5, 12); neckG.translate(0, 0.75, 0);
    const neck = new T.Mesh(neckG, mat); neck.rotation.z = -0.5; neck.position.set(0.9, 0.1, 0); g.add(neck);
    const head = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), mat); head.position.set(1.55, 0.75, 0); g.add(head);
    for (const s of [-1, 1]) { const fin = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), mat); fin.scale.set(0.55, 0.09, 0.3); fin.position.set(0.1, -0.22, s * 0.45); g.add(fin); disposal.geos.push(fin.geometry); }
    disposal.geos.push(neckG, head.geometry);
    g.position.copy(it.base); g.rotation.y = it.yaw; g.scale.setScalar(it.scale); g.userData.it = it;
    return g;
  }

  /* ===== 커스텀 블룸 컴포저 (core three 만으로) ===== */
  function makeComposer(renderer, scene, camera) {
    const quad = new T.PlaneGeometry(2, 2);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    function pass(fs, uniforms) {
      const mat = new T.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}", fragmentShader: fs });
      const sc = new T.Scene(); sc.add(new T.Mesh(quad, mat));
      return { mat, render(t) { renderer.setRenderTarget(t || null); renderer.clear(); renderer.render(sc, cam); } };
    }
    const rtOpt = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
    let sceneRT, brightRT, blurA, blurB, W = 2, H = 2;
    function alloc(w, h) {
      W = w; H = h; const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      [sceneRT, brightRT, blurA, blurB].forEach(r => r && r.dispose());
      sceneRT = new T.WebGLRenderTarget(w, h, rtOpt);
      brightRT = new T.WebGLRenderTarget(hw, hh, rtOpt);
      blurA = new T.WebGLRenderTarget(hw, hh, rtOpt);
      blurB = new T.WebGLRenderTarget(hw, hh, rtOpt);
    }
    const bright = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThresh;
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(0.2126,0.7152,0.0722));
        float k=smoothstep(uThresh,uThresh+0.6,l); gl_FragColor=vec4(c*k,1.0);} `,
      { tDiffuse: { value: null }, uThresh: { value: 1.15 } });
    const blur = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes;
      void main(){ vec2 px=uDir/uRes; vec3 s=vec3(0.0);
        float w[5]; w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;
        s+=texture2D(tDiffuse,vUv).rgb*w[0];
        for(int i=1;i<5;i++){ s+=texture2D(tDiffuse,vUv+px*float(i)*1.5).rgb*w[i]; s+=texture2D(tDiffuse,vUv-px*float(i)*1.5).rgb*w[i]; }
        gl_FragColor=vec4(s,1.0);} `,
      { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uRes: { value: new T.Vector2(1, 1) } });
    const comp = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom;
      uniform float uBloom; uniform float uExposure; uniform vec3 uGrade;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      void main(){ vec3 c=texture2D(tScene,vUv).rgb; vec3 b=texture2D(tBloom,vUv).rgb;
        c+=b*uBloom; c*=uExposure; c=aces(c); c*=uGrade; c=pow(c,vec3(1.0/2.2)); gl_FragColor=vec4(c,1.0);} `,
      { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.6 }, uExposure: { value: 1.0 }, uGrade: { value: new T.Vector3(1, 1, 1) } });

    function setSize(w, h) { alloc(w, h); }
    function render() {
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      bright.mat.uniforms.tDiffuse.value = sceneRT.texture; bright.render(brightRT);
      const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
      let src = brightRT;
      for (let i = 0; i < 3; i++) {
        blur.mat.uniforms.tDiffuse.value = src.texture; blur.mat.uniforms.uDir.value.set(1, 0); blur.mat.uniforms.uRes.value.set(hw, hh); blur.render(blurA);
        blur.mat.uniforms.tDiffuse.value = blurA.texture; blur.mat.uniforms.uDir.value.set(0, 1); blur.render(blurB);
        src = blurB;
      }
      comp.mat.uniforms.tScene.value = sceneRT.texture; comp.mat.uniforms.tBloom.value = blurB.texture; comp.render(null);
    }
    alloc(2, 2);
    return { setSize, render, comp };
  }

  /* ===== 하단 UI 위젯 ===== */
  function buildLengthBar(curEra) {
    const bar = document.getElementById("lenBar"), leg = document.getElementById("lenLegend"), foot = document.getElementById("lenFoot");
    const cols = { precambrian: "--d-violet", paleozoic: "--d-blue", mesozoic: "--d-amber", cenozoic: "--d-gray" };
    bar.innerHTML = ""; leg.innerHTML = "";
    ERA_ORDER.forEach(k => {
      const seg = document.createElement("span"); seg.className = "lenseg" + (k === curEra ? " cur" : "");
      seg.style.flex = ERA_LENGTH_PERCENT[k] + " 0 0"; seg.style.background = `var(${cols[k]})`; bar.appendChild(seg);
      const row = document.createElement("div"); row.className = "lenrow" + (k === curEra ? " cur" : "");
      row.innerHTML = `<span class="lendot" style="background:var(${cols[k]})"></span>${ERA_KOR[k]} ${ERA_LENGTH_PERCENT[k]}%`; leg.appendChild(row);
    });
    foot.textContent = TEXT.lengthFoot;
  }

  /* ===== 2D 폴백 ===== */
  function drawFallback(eraKey) {
    const env = ENV[eraKey], sps = SPECIES[eraKey];
    const glc = document.getElementById("gl"); if (glc) glc.style.display = "none";
    const note = document.getElementById("glFallback"); note.style.display = "block"; note.textContent = TEXT.fallbackNotice;
    const cv = document.getElementById("flat"); cv.style.display = "block";
    const wrap = document.getElementById("stageWrap"); const W = wrap.clientWidth || 640, H = Math.round(W * 0.6);
    const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#" + new T.Color(env.water).getHexString()); g.addColorStop(1, "#" + new T.Color(env.deep).getHexString());
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = "rgba(200,230,240,.5)"; c.fillRect(0, 0, W, 10);
    const floorY = H - 34; c.fillStyle = "#" + new T.Color(env.floor).getHexString(); c.fillRect(0, floorY, W, H - floorY);
    const rimHex = t => "#" + new T.Color(RIM[t]).getHexString(); const rng = makeRng(11);
    sps.forEach(sp => { const rt = !sp.animal ? "photo" : (sp.hard ? "hard" : "soft"); const nShow = Math.min(sp.n, 16);
      for (let i = 0; i < nShow; i++) { const x = 24 + rng() * (W - 48); const y = sp.loc === "swim" ? (24 + rng() * (floorY - 60)) : (floorY - 4 - rng() * 6); const r = 5 + sp.sizeM * 5;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = "#" + new T.Color(sp.body).getHexString(); c.fill(); c.lineWidth = 2.4; c.strokeStyle = rimHex(rt); c.stroke(); } });
    c.fillStyle = "rgba(255,255,255,.9)"; c.font = "13px sans-serif"; c.fillText(env.introLabel + "의 바다 (단면도)", 12, 22);
  }

  /* ========================================================================
     메인 — 통합 페이지. 시대 버튼으로 buildEra() 를 다시 부른다.
     ======================================================================== */
  function start(firstEra) {
    firstEra = firstEra || "precambrian";
    document.getElementById("h1").textContent = TEXT.title + " — 1인칭 라이드";
    document.getElementById("subhead").textContent = TEXT.subheadRide;
    document.getElementById("startBody").textContent = TEXT.lieCardFull;
    document.getElementById("startBtn").textContent = TEXT.startButton;
    document.getElementById("lieStrip").textContent = TEXT.lieStripShort;
    document.getElementById("stopTotal").textContent = "3";
    // 칩
    const chipRow = document.getElementById("chipRow"); chipRow.innerHTML = "";
    TEXT.observationChips.forEach(t => { const s = document.createElement("span"); s.className = "chip"; s.textContent = t; chipRow.appendChild(s); });
    const rl = document.getElementById("rimLegend"); rl.innerHTML = "";
    TEXT.rimLegend.forEach(r => { const d = document.createElement("span"); d.className = "rimitem"; d.innerHTML = `<span class="rimdot" style="background:var(${r.c})"></span>${r.t}`; rl.appendChild(d); });
    // 시대 탭
    const tabbar = document.getElementById("eraTabs");
    const tabBtns = {};
    ERAS.forEach(k => { const b = document.createElement("button"); b.className = "erabtn"; b.textContent = TEXT.tabs[k]; b.onclick = () => switchEra(k); tabbar.appendChild(b); tabBtns[k] = b; });

    // WebGL 확인
    const canvas = document.getElementById("gl");
    let gl = null; try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) { gl = null; }
    if (!gl) { drawFallback(firstEra); document.getElementById("startCard").style.display = "none"; buildLengthBar(firstEra); return; }

    const wrap = document.getElementById("stageWrap");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.LinearEncoding;   // 최종 합성 셰이더에서 직접 감마
    renderer.toneMapping = T.NoToneMapping;        // 톤매핑도 합성에서
    renderer.autoClear = false;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(65, 1, 0.05, 400); scene.add(camera);
    const composer = makeComposer(renderer, scene, camera);
    const rig = buildRig(camera);

    // 카메라 근접 조명(생물 집중)
    const camLight = new T.PointLight(0xdff2ec, 0.35, 10, 2.2); camera.add(camLight);
    const hemi = new T.HemisphereLight(0xffffff, 0x404040, 0.8); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.0); scene.add(sun);

    // 시대 교체 상태
    let eraRoot = null, env = null, rail = null, seedBase = 1, eraKey = null;
    let disposal = null;
    let sIndex = 0, dist = 0, mode = "idle", paused = false, yaw = 0, pitch = 0;
    const speed = 1.7;
    const built = [];

    function disposeEra() {
      if (!eraRoot) return;
      scene.remove(eraRoot);
      eraRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      if (disposal) { disposal.mats.forEach(m => m.dispose()); disposal.geos.forEach(g => g.dispose()); }
      built.length = 0;
    }

    function buildEra(key) {
      disposeEra();
      eraKey = key; env = ENV[key]; seedBase = { precambrian: 1, paleozoic: 2, mesozoic: 3 }[key];
      disposal = { mats: [], geos: [] };
      eraRoot = new T.Group(); scene.add(eraRoot);
      scene.background = new T.Color(env.deep);
      scene.fog = new T.FogExp2(env.water, env.fogDensity);
      hemi.color = new T.Color(env.water).lerp(new T.Color(0xffffff), 0.4); hemi.groundColor = new T.Color(env.floor); hemi.intensity = env.ambient;
      sun.color = new T.Color(env.sun); sun.intensity = env.sunI;
      sun.position.set(-env.lightDir[0], -env.lightDir[1], -env.lightDir[2]).multiplyScalar(30);
      composer.comp.mat.uniforms.uGrade.value.set(env.grade[0], env.grade[1], env.grade[2]);
      composer.comp.mat.uniforms.uExposure.value = env.exposure;

      eraRoot.add(buildWaterSurface(env));
      eraRoot.add(buildGodrays(env));
      eraRoot.add(buildSeafloor(env));
      eraRoot.add(buildMarineSnow(env));
      rail = makeRail(env, seedBase);
      SPECIES[key].forEach((sp, i) => { const b = buildSpecies(sp, env, rail, 5000 + seedBase * 131 + i * 17, disposal); built.push(b); eraRoot.add(b.node); });

      // 사이드 텍스트
      document.getElementById("eraNow").textContent = env.introLabel;
      document.getElementById("envLineTxt").textContent = env.envLine;
      buildLengthBar(key);
      ERAS.forEach(k => tabBtns[k].setAttribute("aria-pressed", k === key ? "true" : "false"));
      // 라이드 리셋
      dist = 0; sIndex = 0; yaw = 0; pitch = 0; paused = false;
      document.getElementById("stopNow").textContent = "–";
      document.getElementById("btnPause").textContent = TEXT.pauseButton;
    }

    function switchEra(key) {
      buildEra(key);
      if (mode === "idle") { setGuide(TEXT.introCard[key]); }
      else { mode = "ride"; hideContinue(); setGuide(TEXT.introCard[key]); }
    }

    // 시선 조작
    let dragging = false, lx = 0, ly = 0;
    function ptc(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
    canvas.addEventListener("mousedown", e => { dragging = true; const p = ptc(e); lx = p.x; ly = p.y; });
    window.addEventListener("mousemove", e => { if (!dragging) return; const p = ptc(e); yaw -= (p.x - lx) * 0.005; pitch -= (p.y - ly) * 0.005; pitch = Math.max(-1.25, Math.min(1.25, pitch)); lx = p.x; ly = p.y; });
    window.addEventListener("mouseup", () => dragging = false);
    canvas.addEventListener("touchstart", e => { dragging = true; const p = ptc(e); lx = p.x; ly = p.y; }, { passive: true });
    canvas.addEventListener("touchmove", e => { if (!dragging) return; const p = ptc(e); yaw -= (p.x - lx) * 0.005; pitch -= (p.y - ly) * 0.005; pitch = Math.max(-1.25, Math.min(1.25, pitch)); lx = p.x; ly = p.y; e.preventDefault(); }, { passive: false });
    window.addEventListener("touchend", () => dragging = false);
    canvas.setAttribute("tabindex", "0");
    window.addEventListener("keydown", e => { const k = e.key; if (k === "ArrowLeft") yaw += 0.08; else if (k === "ArrowRight") yaw -= 0.08; else if (k === "ArrowUp") pitch = Math.min(1.25, pitch + 0.06); else if (k === "ArrowDown") pitch = Math.max(-1.25, pitch - 0.06); });

    function setGuide(t) { document.getElementById("guideText").textContent = t; }
    function showContinue(t) { const b = document.getElementById("btnContinue"); b.style.display = ""; b.textContent = TEXT.continueButton; b.onclick = onContinue; setGuide(t); }
    function hideContinue() { document.getElementById("btnContinue").style.display = "none"; }
    function onContinue() { if (mode === "stop") { mode = "ride"; hideContinue(); } else if (mode === "finish") { dist = 0; sIndex = 0; mode = "ride"; yaw = 0; pitch = 0; hideContinue(); setGuide(TEXT.introCard[eraKey]); } }

    document.getElementById("startBtn").onclick = () => { document.getElementById("startCard").style.display = "none"; mode = "ride"; setGuide(TEXT.introCard[eraKey]); };
    document.getElementById("btnPause").onclick = () => { paused = !paused; document.getElementById("btnPause").textContent = paused ? "재생" : TEXT.pauseButton; };
    document.getElementById("btnRestart").onclick = () => { dist = 0; sIndex = 0; mode = "ride"; paused = false; yaw = 0; pitch = 0; hideContinue(); document.getElementById("btnPause").textContent = TEXT.pauseButton; setGuide(TEXT.introCard[eraKey]); };
    document.getElementById("btnHands").onclick = () => { rig.group.visible = !rig.group.visible; document.getElementById("btnHands").textContent = rig.group.visible ? TEXT.handsOn : TEXT.handsOff; };
    document.getElementById("btnPause").textContent = TEXT.pauseButton; document.getElementById("btnHands").textContent = TEXT.handsOn;
    hideContinue();

    function resize() { const w = wrap.clientWidth || 640; const h = Math.max(340, Math.round(w * 0.60)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const dpr = renderer.getPixelRatio(); composer.setSize(Math.floor(w * dpr), Math.floor(h * dpr)); }

    buildEra(firstEra);
    setGuide(TEXT.introCard[firstEra]);
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener("resize", resize);

    const clock = new T.Clock(); let raf = null;
    function frame() {
      const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime; UNI.time.value = t;
      if (mode === "ride" && !paused) {
        dist += speed * dt;
        if (sIndex < STOPS_U.length && dist >= STOPS_U[sIndex] * rail.total) {
          dist = STOPS_U[sIndex] * rail.total; mode = "stop"; document.getElementById("stopNow").textContent = (sIndex + 1); showContinue(TEXT.stopBriefing[eraKey][sIndex]); sIndex++;
        } else if (dist >= rail.total) { dist = rail.total; mode = "finish"; const b = document.getElementById("btnContinue"); b.style.display = ""; b.textContent = TEXT.restartButton; b.onclick = onContinue; setGuide(TEXT.finishHint); }
      }
      const at = rail.at(dist);
      const eye = new T.Vector3(at.pos[0], at.pos[1] + 0.15, at.pos[2]);
      const fwd = new T.Vector3(at.tan[0], at.tan[1], at.tan[2]).normalize();
      const base = Math.atan2(fwd.x, fwd.z); const ry = base + yaw;
      const dirv = new T.Vector3(Math.sin(ry) * Math.cos(pitch), Math.sin(pitch) + fwd.y * 0.4, Math.cos(ry) * Math.cos(pitch));
      camera.position.copy(eye); camera.lookAt(eye.clone().add(dirv));
      document.getElementById("timeLeft").textContent = Math.round((dist / rail.total) * 100) + "%";
      for (const b of built) animateSpecies(b, t);
      composer.render();
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; } else if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } });
    clock.getDelta(); raf = requestAnimationFrame(frame);
  }

  const _d = new T.Object3D();
  function animateSpecies(b, t) {
    if (b.anim === "still") return;
    if (b.kind === "group") { b.node.children.forEach(ch => { const it = ch.userData.it; if (!it) return; ch.position.y = it.base.y + Math.sin(t * it.speed + it.phase) * 0.28; ch.position.x = it.base.x + Math.sin(t * it.speed * 0.5 + it.phase) * 0.5; ch.rotation.y = it.yaw + Math.sin(t * it.speed * 0.5 + it.phase) * 0.25; }); return; }
    const m = b.mesh;
    b.insts.forEach((it, k) => {
      _d.position.copy(it.base); let ry = it.yaw, sy = it.scale;
      if (b.anim === "swim") { _d.position.x += Math.sin(t * it.speed + it.phase) * 0.5; _d.position.y += Math.sin(t * it.speed * 0.8 + it.phase) * 0.2; ry = it.yaw + Math.sin(t * it.speed * 0.6 + it.phase) * 0.3; }
      else if (b.anim === "jelly") { const pulse = 1 + Math.sin(t * 1.6 + it.phase) * 0.14; _d.position.y += Math.sin(t * 0.6 + it.phase) * 0.32; _d.scale.set(sy * pulse, sy * (2 - pulse), sy * pulse); _d.rotation.set(0, ry, 0); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix); return; }
      else if (b.anim === "sway") { _d.rotation.set(Math.sin(t * 0.8 + it.phase) * 0.28, ry, Math.cos(t * 0.6 + it.phase) * 0.16); _d.scale.setScalar(sy); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix); return; }
      _d.rotation.set(0, ry, 0); _d.scale.setScalar(sy); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }

  function buildRig(camera) {
    const grp = new T.Group();
    const metal = new T.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.28, metalness: 0.95 });
    const skin = new T.MeshStandardMaterial({ color: 0xb98d63, roughness: 0.75, metalness: 0.0 });
    const sleeve = new T.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 0.9, metalness: 0.0 });
    const BAR = -0.50, Z = -0.62;
    const bar = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.92, 16), metal); bar.rotation.z = Math.PI / 2; bar.position.set(0, BAR, Z); grp.add(bar);
    for (const s of [-1, 1]) { const arm = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.34, 12), metal); arm.position.set(s * 0.42, BAR - 0.16, Z + 0.02); arm.rotation.x = 0.25; grp.add(arm); }
    for (const s of [-1, 1]) {
      const back = new T.Mesh(new T.SphereGeometry(0.05, 12, 9), skin); back.scale.set(1.5, 0.7, 1.15); back.position.set(s * 0.17, BAR + 0.035, Z + 0.015); grp.add(back);
      for (let f = 0; f < 4; f++) { const fing = new T.Mesh(new T.CapsuleGeometry(0.017, 0.05, 3, 6), skin); fing.rotation.x = Math.PI / 2; fing.position.set(s * 0.17 + (f - 1.5) * 0.032, BAR + 0.01, Z + 0.075); grp.add(fing); }
      const cuff = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.22, 12), sleeve); cuff.position.set(s * 0.2, BAR - 0.16, Z - 0.13); cuff.rotation.x = 1.05; grp.add(cuff);
    }
    grp.traverse(o => { o.renderOrder = 12; });
    camera.add(grp); return { group: grp };
  }

  return { start: start, GEO: GEO };
})();
