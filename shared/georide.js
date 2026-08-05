"use strict";
/* ============================================================================
   지질 시대의 바다 — 1인칭 코스터 라이드 (통합판 v3)  · three.js r147
   ----------------------------------------------------------------------------
   레퍼런스: 롤러코스터 1인칭 관광 영상(스타일라이즈드 실시간 3D)

   v3에서 새로 들어간 것
     ① 눈에 보이는 레일 트랙 — Catmull-Rom 스플라인 위에 레일 2줄 + 침목 + 지지 기둥
        (이게 없어서 '떠다니는' 느낌이었다. 지나가는 기둥이 속도감을 만든다)
     ② 코스터 물리 — 경사에 따른 가·감속 v=√(v₀²+2gΔh), 곡률 기반 뱅킹 tanθ=v²/(rg),
        속도 비례 흔들림, 속도 비례 시야각(FOV) 확장
     ③ 평행 이송(parallel transport) 프레임 — 프레네 프레임의 급회전 뒤집힘을 막는다
     ④ 절차적 주행음 — 레일 럼블 + 바람소리(WebAudio, 외부 파일 없음). 끌 수 있다
     ⑤ 스타일라이즈드 아트 — 정돈된 색·선명한 실루엣·비네트. 생물 모델을 조형해 교체
        (삼엽충 마디, 암모나이트 나선 늑골, 해파리 촉수, 물고기 지느러미, 목긴 파충류)

   교육 설계 (수업설계안·지도서 78쪽 승계)
     · 관찰 포인트 3: ① 얼마나 많은가 ② 단단한 부분(발광 테두리) ③ 고착/유영
     · 테두리 색: 주황=단단함 · 보라=부드러움 · 초록=광합성  (몸은 자연색)
     · 하늘을 나는 생물 0 (익룡≠공룡, M3)
     · 선캄브리아: 스트로마톨라이트를 흩뿌리지 않고 정지점 2에서만 가까이 (사용자 확정)
       화면의 주인공은 기후 — 강한 햇빛(오존층 ✗) · 열수구(화산) · 산소 기포 · 텅 빈 물

   데이터의 유일한 원천은 이 파일의 GEO 다(F-1).
   ========================================================================== */

window.GeoRide = (function () {
  const T = window.THREE;
  const UNI = { time: { value: 0 } };
  function makeRng(seed) { let s = seed >>> 0; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

  /* ★ 색 공간 — r147은 legacy 모드라 sRGB 색값을 선형으로 바꿔 주지 않는다.
     최종 합성에서 우리가 직접 감마를 적용하므로, 재질·안개·배경 색은 반드시
     선형으로 변환해 넣어야 한다. 안 하면 화면 전체가 뿌옇게 들뜬다(실측). */
  function COL(hex) { return new T.Color(hex).convertSRGBToLinear(); }

  /* ======================================================================
     화면 문구
     ====================================================================== */
  const TEXT = {
    title: "지질 시대의 바다",
    subheadRide: "레일을 따라 바닷속을 1인칭으로 지나갑니다. 화면을 끌면 고개가 돌아갑니다. 위 버튼으로 시대를 바꿉니다.",
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
        "멈췄습니다. 앞을 보세요. 물속에 무엇이 보이나요? 거의 비어 있지요. 위를 보면 햇빛이 그대로 내리꽂힙니다 — 아직 오존층이 없습니다.",
        "아래를 내려다보세요. 바닥은 비어 있지 않습니다. 이 기둥이 이 바다에서 가장 큰 것입니다(스트로마톨라이트). 가로로 난 층은 남세균이 자라는 것과 물속 입자가 쌓이는 것이 번갈아 일어나 생겼습니다. 올라오는 기포는 남세균이 만든 산소입니다.",
        "바닥에서 뜨거운 물이 솟는 곳이 보입니다. 지금 보이는 것들 중 헤엄치는 것이 몇 개나 되나요? 나머지는 어디에 있나요?"
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
    continueButton: "계속 가기", pauseButton: "일시정지", restartButton: "처음부터",
    handsOn: "탑승 바 숨기기", handsOff: "탑승 바 보이기",
    soundOn: "소리 끄기", soundOff: "소리 켜기"
  };

  /* ======================================================================
     시대별 환경. 수심은 「얕다 → 깊다」 서사를 지키면서 코스터가 오르내릴
     여유를 갖도록 잡았다.
     ====================================================================== */
  const ENV = {
    /* 색·밀도는 사용자가 준 영상 캡처 14장에 맞췄다.
       선캄브리아 = 짙은 청록 + 기포 기둥 + 강한 역광 / 고생대 = 맑고 밝은 청록 + 노랑올리브 암초
       중생대 = 청회색 깊은 바다 */
    precambrian: {
      label: "선캄브리아", introLabel: "선캄브리아시대",
      seafloorY: -11.5, railY: -8.0, amp: 2.6,
      water: 0x1d4a44, deep: 0x08201e, floor: 0x353524,
      fogDensity: 0.052, sun: 0xf6ffe4, sunI: 0.9, sunbeam: 1.9, caustic: 0.42,
      lightDir: [0.08, -1.0, 0.05], surfaceBright: 0.85, grade: [0.95, 1.06, 0.99],
      exposure: 0.84, ambient: 0.30, sat: 1.24,
      vents: 6, bubbles: true, harshSun: true,
      turf: { n: 2600, color: 0x54732f, size: 0.85 },
      envLine: "산소 ↑ (남세균 광합성), 오존층 아직 ✗"
    },
    paleozoic: {
      label: "고생대", introLabel: "고생대",
      seafloorY: -15, railY: -11.0, amp: 3.2,
      water: 0x0f6a86, deep: 0x073847, floor: 0x9c9670,
      fogDensity: 0.030, sun: 0xdcf6ff, sunI: 0.9, sunbeam: 1.05, caustic: 0.4,
      lightDir: [0.20, -0.95, 0.22], surfaceBright: 0.6, grade: [0.96, 1.02, 1.06],
      exposure: 0.9, ambient: 0.38, sat: 1.26,
      vents: 0, bubbles: false, harshSun: false,
      turf: { n: 3200, color: 0x6f8a2e, size: 0.75 },
      envLine: "오존층 형성 ★ → 생물의 육상 진출"
    },
    mesozoic: {
      label: "중생대", introLabel: "중생대",
      seafloorY: -18, railY: -13.0, amp: 4.0,
      water: 0x14496b, deep: 0x051726, floor: 0x4e5145,
      fogDensity: 0.036, sun: 0xbcdcf5, sunI: 0.62, sunbeam: 0.62, caustic: 0.2,
      lightDir: [0.10, -0.98, 0.16], surfaceBright: 0.34, grade: [0.94, 0.99, 1.09],
      exposure: 0.8, ambient: 0.27, sat: 1.2,
      vents: 0, bubbles: false, harshSun: false,
      turf: { n: 1800, color: 0x3f5c46, size: 0.65 },
      envLine: "판게아 분리, 화산활동↑ CO₂↑ → 온난"
    }
  };

  /* ======================================================================
     종 정의
       precambrian — 개체 수를 크게 줄였다(사용자 확정: 「적은 생물 수」가 드러나야).
         스트로마톨라이트는 clusterAt 으로 정지점 2 근처에만 모은다.
     ====================================================================== */
  const SPECIES = {
    /* 선캄브리아 — 물속은 거의 비어 있고(유영 3), 바닥에는 있다(M13).
       동물은 전부 「부드러운 몸」= 보라 테두리. 단단한 것이 하나도 없다. */
    precambrian: [
      { id: "stromatolite", name: "스트로마톨라이트", n: 7, animal: false, hard: null, loc: "attached", shape: "stromatolite", body: 0x8a7550, sizeM: 2.4, hero: true, clusterAt: 1 },
      { id: "matpatch", name: "미생물 매트", n: 40, animal: false, hard: null, loc: "attached", shape: "mat", body: 0x55702f, sizeM: 1.4 },
      { id: "algae_pc", name: "조류", n: 18, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x3b6b3c, sizeM: 1.0 },
      { id: "edia_disc", name: "원반 모양 부드러운 생물", n: 18, animal: true, hard: false, loc: "bottom", shape: "ediaDisc", body: 0x9a8a76, sizeM: 0.75 },
      { id: "edia_frond", name: "깃털 모양 부드러운 생물", n: 16, animal: true, hard: false, loc: "attached", shape: "ediaFrond", body: 0x8d7f92, sizeM: 1.3 },
      { id: "jelly_pc", name: "해파리 모양", n: 3, animal: true, hard: false, loc: "swim", shape: "jelly", body: 0xb8cfe0, sizeM: 0.40 }
    ],
    /* 고생대 — 단단한 껍데기가 등장하고 바닥이 암초로 빽빽해진다 */
    paleozoic: [
      { id: "trilobite", name: "삼엽충", n: 18, animal: true, hard: true, loc: "bottom", shape: "trilobite", body: 0x7d5f3c, sizeM: 0.46, label: "삼엽충" },
      { id: "anomalo", name: "큰 마디 절지동물", n: 3, animal: true, hard: true, loc: "swim", shape: "anomalo", body: 0x2f6a93, sizeM: 1.5, hero: true },
      { id: "bivalve", name: "조개 모양", n: 20, animal: true, hard: true, loc: "bottom", shape: "shell", body: 0xd6c194, sizeM: 0.30 },
      { id: "squidshell", name: "껍데기 오징어", n: 8, animal: true, hard: true, loc: "swim", shape: "orthocone", body: 0xcaa96f, sizeM: 0.7 },
      { id: "platecoral", name: "판 모양 산호", n: 42, animal: true, hard: true, loc: "attached", shape: "plateCoral", body: 0xd6b96a, sizeM: 1.0 },
      { id: "seafan", name: "부채 모양 군체", n: 46, animal: true, hard: true, loc: "attached", shape: "seaFan", body: 0x2b3a33, sizeM: 1.5 },
      { id: "sponge", name: "관 모양 해면", n: 38, animal: true, hard: true, loc: "attached", shape: "tubeSponge", body: 0xbfa15c, sizeM: 0.8 },
      { id: "armorfish", name: "갑옷을 두른 물고기", n: 20, animal: true, hard: true, loc: "swim", shape: "armorFish", body: 0xc0a173, sizeM: 0.55, school: true },
      { id: "jelly_pz", name: "해파리", n: 4, animal: true, hard: false, loc: "swim", shape: "jelly", body: 0xb8cfe0, sizeM: 0.32 },
      { id: "algae_pz", name: "해조류", n: 40, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x5d8a2c, sizeM: 1.1 }
    ],
    /* 중생대 — 중간 수층을 헤엄치는 것이 지배한다 */
    mesozoic: [
      { id: "ammonite", name: "암모나이트", n: 30, animal: true, hard: true, loc: "swim", shape: "ammonite", body: 0xd8bd90, sizeM: 0.42, label: "암모나이트" },
      { id: "longneck", name: "목이 긴 파충류", n: 4, animal: true, hard: true, loc: "swim", shape: "plesiosaur", body: 0x4a5a48, sizeM: 3.0, hero: true },
      { id: "ichthyo", name: "물고기 모양 파충류", n: 5, animal: true, hard: true, loc: "swim", shape: "ichthyo", body: 0x415465, sizeM: 2.2, hero: true },
      { id: "fish_mz", name: "헤엄치는 척추동물", n: 24, animal: true, hard: true, loc: "swim", shape: "fish", body: 0xa3b2ba, sizeM: 0.44, school: true },
      { id: "bottom_mz", name: "바닥 껍데기", n: 10, animal: true, hard: true, loc: "bottom", shape: "shell", body: 0xcbb890, sizeM: 0.4 },
      { id: "coral_mz", name: "판 모양 산호", n: 24, animal: true, hard: true, loc: "attached", shape: "plateCoral", body: 0xa89a72, sizeM: 0.9 },
      { id: "jelly_mz", name: "해파리", n: 5, animal: true, hard: false, loc: "swim", shape: "jelly", body: 0xb8cfe0, sizeM: 0.32 },
      { id: "algae_mz", name: "해조류", n: 24, animal: false, hard: null, loc: "attached", shape: "frond", body: 0x35603d, sizeM: 0.9 }
    ]
  };

  const ERAS = ["precambrian", "paleozoic", "mesozoic"];
  const STOPS_U = [0.30, 0.60, 0.92];
  const ERA_LENGTH_PERCENT = { precambrian: 88.2, paleozoic: 6.3, mesozoic: 4.1, cenozoic: 1.4 };
  const ERA_ORDER = ["precambrian", "paleozoic", "mesozoic", "cenozoic"];
  const ERA_KOR = { precambrian: "선캄브리아", paleozoic: "고생대", mesozoic: "중생대", cenozoic: "신생대" };
  const RIM = { photo: 0x34d399, hard: 0xfb923c, soft: 0xa78bfa };
  function rimFor(sp) { return !sp.animal ? RIM.photo : (sp.hard ? RIM.hard : RIM.soft); }
  const GEO = { eras: ERAS, env: ENV, species: SPECIES, eraLengthPercent: ERA_LENGTH_PERCENT, text: TEXT, stops: STOPS_U };

  /* 트랙 제어점 — [x, yNorm(-1..1), z]. 언덕·강하·좌우 선회가 번갈아 오도록 설계. */
  const TRACK_CP = [
    [0, 0.60, 0], [13, 0.82, 1], [26, 0.25, -1], [39, -0.55, -4],
    [52, -0.82, -7], [65, -0.30, -6], [78, 0.42, -2], [91, 0.72, 3],
    [104, 0.20, 6], [117, -0.52, 5], [130, -0.78, 0], [143, -0.25, -4],
    [156, 0.46, -5], [169, 0.66, -1], [182, 0.10, 3], [195, 0.45, 2]
  ];
  const G_EFF = 2.2;      // 물속 유효 중력(부력·저항 반영) — 속도 변화를 완만하게
  const V_MIN = 2.7;      // 최저 속도 m/s (전체 주행 약 60~70초)

  /* ===== 코스틱스 GLSL ===== */
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
      return clamp(pow(abs(c), 8.0), 0.0, 1.0);
    }`;

  /* ===== 생물 재질 — 자연색 + 프레넬 발광 테두리 + 윗면 코스틱스 ===== */
  function creatureMaterial(bodyHex, rimHex, opt) {
    opt = opt || {};
    const m = new T.MeshStandardMaterial({
      color: COL(bodyHex),
      roughness: opt.rough != null ? opt.rough : 0.68,
      metalness: opt.metal != null ? opt.metal : 0.05,
      transparent: !!opt.transparent, opacity: opt.opacity != null ? opt.opacity : 1.0,
      side: opt.side || T.FrontSide, emissive: COL(bodyHex).multiplyScalar(0.06)
    });
    m.userData.u = {
      uRim: { value: COL(rimHex) }, uRimStr: { value: opt.rimStr != null ? opt.rimStr : 1.3 },
      uRimPow: { value: opt.rimPow != null ? opt.rimPow : 2.2 },
      uCaustI: { value: opt.caustI != null ? opt.caustI : 0.0 }, uTime: UNI.time
    };
    m.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, m.userData.u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGN;\nvarying vec3 vGP;")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\n #ifdef USE_INSTANCING\n vGP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n vGN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal);\n #else\n vGP=(modelMatrix*vec4(transformed,1.0)).xyz;\n vGN=normalize(mat3(modelMatrix)*objectNormal);\n #endif");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>",
          "#include <common>\nuniform vec3 uRim;uniform float uRimStr;uniform float uRimPow;uniform float uCaustI;uniform float uTime;\nvarying vec3 vGN;varying vec3 vGP;\n" + CAUSTIC_GLSL)
        .replace("#include <dithering_fragment>",
          "#include <dithering_fragment>\n vec3 Vd=normalize(cameraPosition-vGP);\n float rf=pow(1.0-clamp(dot(normalize(vGN),Vd),0.0,1.0),uRimPow);\n gl_FragColor.rgb+=uRim*rf*uRimStr;\n float up=clamp(vGN.y,0.0,1.0);\n if(uCaustI>0.001){ float ca=caustic(vGP.xz*0.09,uTime*0.35); gl_FragColor.rgb+=vec3(0.72,0.88,0.82)*ca*up*uCaustI; }");
    };
    return m;
  }

  /* ===== 지오메트리 병합 도우미 ===== */
  function mergeParts(parts) {
    const gs = parts.map(p => {
      let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (p.m) g.applyMatrix4(p.m);
      return g;
    });
    let n = 0; gs.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    gs.forEach(g => { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; g.dispose(); });
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.BufferAttribute(nor, 3));
    return out;
  }
  function M(x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new T.Matrix4();
    const q = new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0));
    m.compose(new T.Vector3(x || 0, y || 0, z || 0), q, new T.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
    return m;
  }

  /* ===== 조형된 생물 형태 (스타일라이즈드 — 실루엣이 분명하게) ===== */
  const G = {};
  function geomFor(shape) {
    if (G[shape]) return G[shape];
    let g;
    switch (shape) {
      case "stromatolite": {
        const pts = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24; const r = 0.5 * (1 - 0.30 * t) + 0.06 * Math.sin(t * Math.PI * 9); pts.push(new T.Vector2(Math.max(0.03, r), t * 2.0)); }
        g = new T.LatheGeometry(pts, 30); break;
      }
      case "mat": { g = new T.SphereGeometry(0.6, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(1, 0.12, 1); break; }
      case "frond": {
        // 잎 여러 장이 밑동에서 갈라지는 리본
        const parts = []; const rng = makeRng(31);
        for (let i = 0; i < 4; i++) {
          const p = new T.PlaneGeometry(0.16, 1.0, 1, 8); p.translate(0, 0.5, 0);
          parts.push({ geo: p, m: M((rng() - .5) * .15, 0, (rng() - .5) * .15, 0, rng() * 3.1, (rng() - .5) * .5, 1, 0.7 + rng() * 0.6, 1) });
        }
        g = mergeParts(parts); break;
      }
      case "blob": { g = new T.SphereGeometry(0.5, 22, 16); g.scale(1.3, 0.62, 1.0); break; }
      case "jelly": {
        // 갓 + 촉수 6개
        const parts = [];
        const bell = new T.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58);
        parts.push({ geo: bell, m: M(0, 0, 0, 0, 0, 0, 1, 0.95, 1) });
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          const t = new T.CylinderGeometry(0.012, 0.03, 0.85, 5); t.translate(0, -0.42, 0);
          parts.push({ geo: t, m: M(Math.cos(a) * 0.3, -0.05, Math.sin(a) * 0.3, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2) });
        }
        g = mergeParts(parts); break;
      }
      case "trilobite": {
        // 머리방패 + 마디 등판 + 꼬리
        const parts = [];
        const head = new T.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        parts.push({ geo: head, m: M(0, 0, 0.42, 0, 0, 0, 0.62, 0.34, 0.42) });
        for (let i = 0; i < 6; i++) {
          const seg = new T.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
          const k = 1 - i * 0.10;
          parts.push({ geo: seg, m: M(0, 0, 0.16 - i * 0.15, 0, 0, 0, 0.58 * k, 0.30 * k, 0.10) });
        }
        const tail = new T.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
        parts.push({ geo: tail, m: M(0, 0, -0.76, 0, 0, 0, 0.34, 0.20, 0.26) });
        g = mergeParts(parts); break;
      }
      case "shell": {
        const parts = [];
        const a = new T.SphereGeometry(0.5, 20, 14); parts.push({ geo: a, m: M(0, 0.04, 0, 0, 0, 0, 1.0, 0.46, 0.85) });
        const b = new T.SphereGeometry(0.5, 20, 14); parts.push({ geo: b, m: M(0, -0.04, 0, Math.PI, 0, 0, 1.0, 0.46, 0.85) });
        g = mergeParts(parts); break;
      }
      case "orthocone": {
        const parts = [];
        const cone = new T.ConeGeometry(0.26, 1.5, 20); parts.push({ geo: cone, m: M(0, 0, -0.1, Math.PI * 0.5, 0, 0) });
        for (let i = 0; i < 5; i++) { const r = new T.TorusGeometry(0.2 - i * 0.03, 0.018, 6, 16); parts.push({ geo: r, m: M(0, 0, -0.35 - i * 0.2) }); }
        for (let i = 0; i < 5; i++) { const t = new T.CylinderGeometry(0.012, 0.02, 0.3, 5); t.translate(0, -0.15, 0); parts.push({ geo: t, m: M((i - 2) * 0.06, 0, 0.72, Math.PI * 0.5, 0, 0) }); }
        g = mergeParts(parts); break;
      }
      case "coral": {
        const parts = []; const rng = makeRng(55);
        for (let i = 0; i < 7; i++) {
          const c = new T.CylinderGeometry(0.035, 0.1, 0.55 + rng() * 0.55, 7); c.translate(0, 0.3, 0);
          parts.push({ geo: c, m: M((rng() - .5) * .34, 0, (rng() - .5) * .34, (rng() - .5) * .7, 0, (rng() - .5) * .7) });
          const tip = new T.SphereGeometry(0.06, 8, 6);
          parts.push({ geo: tip, m: M((rng() - .5) * .34, 0.6 + rng() * 0.3, (rng() - .5) * .34) });
        }
        g = mergeParts(parts); break;
      }
      case "fish": {
        const parts = [];
        const body = new T.SphereGeometry(0.5, 20, 14); parts.push({ geo: body, m: M(0, 0, 0, 0, 0, 0, 0.45, 0.42, 1.5) });
        const tail = new T.ConeGeometry(0.3, 0.45, 4); parts.push({ geo: tail, m: M(0, 0, -0.86, Math.PI * 0.5, 0, 0, 0.5, 1, 1) });
        const dors = new T.ConeGeometry(0.16, 0.34, 4); parts.push({ geo: dors, m: M(0, 0.22, 0.05, 0, 0, 0, 0.35, 1, 1.4) });
        g = mergeParts(parts); break;
      }
      case "ammonite": {
        const parts = [];
        parts.push({ geo: new T.TubeGeometry(new T.CatmullRomCurve3(spiralPoints(1.15, 4.8, 80)), 96, 0.155, 12, false) });
        // 늑골
        for (let i = 0; i < 14; i++) {
          const t = i / 14; const a = t * 1.15 * Math.PI * 2; const r = 0.05 * Math.pow(4.8, t);
          const rib = new T.TorusGeometry(0.155, 0.016, 5, 10);
          parts.push({ geo: rib, m: M(Math.cos(a) * r, Math.sin(a) * r, 0, 0, Math.PI * 0.5, a) });
        }
        // 촉수
        for (let i = 0; i < 5; i++) { const t = new T.CylinderGeometry(0.012, 0.022, 0.3, 5); t.translate(0, -0.15, 0); parts.push({ geo: t, m: M(0.2 + (i - 2) * 0.03, -0.16, 0, 0, 0, 0.5 + (i - 2) * 0.16) }); }
        g = mergeParts(parts); break;
      }
      case "plesiosaur": {
        const parts = [];
        parts.push({ geo: new T.SphereGeometry(0.5, 22, 16), m: M(0, 0, 0, 0, 0, 0, 0.62, 0.6, 1.6) });
        // 목(마디로 굽게)
        for (let i = 0; i < 7; i++) {
          const s = 1 - i * 0.07; const zz = 0.85 + i * 0.22; const yy = i * i * 0.028;
          parts.push({ geo: new T.SphereGeometry(0.5, 12, 10), m: M(0, yy, zz, 0, 0, 0, 0.2 * s, 0.2 * s, 0.16) });
        }
        parts.push({ geo: new T.SphereGeometry(0.5, 14, 10), m: M(0, 1.4, 2.5, 0, 0, 0, 0.19, 0.17, 0.32) });
        // 꼬리
        for (let i = 0; i < 4; i++) { const s = 1 - i * 0.2; parts.push({ geo: new T.SphereGeometry(0.5, 10, 8), m: M(0, 0, -0.9 - i * 0.22, 0, 0, 0, 0.2 * s, 0.18 * s, 0.16) }); }
        // 지느러미 4장
        for (const sx of [-1, 1]) for (const sz of [0.42, -0.42]) {
          parts.push({ geo: new T.SphereGeometry(0.5, 12, 8), m: M(sx * 0.55, -0.12, sz, 0, sx * 0.4, 0, 0.75, 0.09, 0.3) });
        }
        g = mergeParts(parts); break;
      }
      case "ichthyo": {
        const parts = [];
        parts.push({ geo: new T.SphereGeometry(0.5, 22, 14), m: M(0, 0, 0, 0, 0, 0, 0.44, 0.46, 1.5) });
        parts.push({ geo: new T.ConeGeometry(0.2, 0.9, 10), m: M(0, 0, 1.05, Math.PI * 0.5, 0, 0, 0.7, 1, 0.7) }); // 주둥이
        parts.push({ geo: new T.ConeGeometry(0.34, 0.5, 4), m: M(0, 0.1, -0.95, Math.PI * 0.5, 0, 0, 0.35, 1, 1) }); // 꼬리 상엽
        parts.push({ geo: new T.ConeGeometry(0.3, 0.42, 4), m: M(0, -0.12, -0.92, -Math.PI * 0.5, 0, 0, 0.32, 1, 1) });
        parts.push({ geo: new T.ConeGeometry(0.2, 0.42, 4), m: M(0, 0.3, -0.1, 0, 0, 0, 0.3, 1, 1.5) }); // 등지느러미
        for (const sx of [-1, 1]) parts.push({ geo: new T.SphereGeometry(0.5, 10, 8), m: M(sx * 0.4, -0.16, 0.2, 0, sx * 0.35, 0, 0.55, 0.08, 0.24) });
        g = mergeParts(parts); break;
      }
      /* ── 선캄브리아: 에디아카라형 부드러운 생물 (레퍼런스 캡처) ── */
      case "ediaDisc": {   // 디킨소니아형 — 납작한 타원 원반에 좌우 마디
        const parts = [];
        parts.push({ geo: new T.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m: M(0, 0, 0, 0, 0, 0, 1.0, 0.16, 0.66) });
        for (let i = 0; i < 11; i++) {
          const z = (i / 10 - 0.5) * 1.05; const w = Math.sqrt(Math.max(0, 1 - (z / 0.55) * (z / 0.55) * 0.9));
          parts.push({ geo: new T.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), m: M(0, 0.02, z * 0.62, 0, 0, 0, 0.92 * w, 0.16, 0.045) });
        }
        g = mergeParts(parts); break;
      }
      case "ediaFrond": {  // 카르니아형 — 자루 + 깃털 잎
        const parts = [];
        parts.push({ geo: new T.CylinderGeometry(0.035, 0.075, 0.42, 8), m: M(0, 0.21, 0) });
        parts.push({ geo: new T.SphereGeometry(0.5, 10, 8), m: M(0, 0.06, 0, 0, 0, 0, 0.3, 0.14, 0.3) });
        for (let i = 0; i < 9; i++) {
          const t = i / 8; const y = 0.42 + t * 0.95; const s = Math.sin((1 - t * 0.85) * Math.PI * 0.7) * 0.42 + 0.08;
          for (const sx of [-1, 1]) parts.push({ geo: new T.SphereGeometry(0.5, 8, 6), m: M(sx * s * 0.5, y, 0, 0, 0, sx * -0.5, s, 0.075, 0.055) });
        }
        parts.push({ geo: new T.CylinderGeometry(0.02, 0.035, 1.0, 6), m: M(0, 0.92, 0) });
        g = mergeParts(parts); break;
      }
      /* ── 고생대 암초 구성물 ── */
      case "seaFan": {     // 부채 모양 가지 군체 — 실루엣이 화면을 채운다
        const parts = []; const rng = makeRng(71);
        parts.push({ geo: new T.CylinderGeometry(0.035, 0.075, 0.3, 7), m: M(0, 0.15, 0) });
        const branch = (x, y, ang, len, w, d) => {
          if (d > 3 || len < 0.09) return;
          const nx = x + Math.sin(ang) * len, ny = y + Math.cos(ang) * len;
          parts.push({ geo: new T.CylinderGeometry(w * 0.62, w, len, 5), m: M((x + nx) / 2, (y + ny) / 2, 0, 0, 0, -ang) });
          branch(nx, ny, ang + 0.42 + rng() * 0.2, len * 0.72, w * 0.66, d + 1);
          branch(nx, ny, ang - 0.42 - rng() * 0.2, len * 0.72, w * 0.66, d + 1);
        };
        branch(0, 0.3, 0.32, 0.45, 0.05, 0); branch(0, 0.3, -0.32, 0.45, 0.05, 0); branch(0, 0.3, 0, 0.5, 0.05, 0);
        g = mergeParts(parts); break;
      }
      case "tubeSponge": { // 관 모양 해면 다발
        const parts = []; const rng = makeRng(83);
        for (let i = 0; i < 6; i++) {
          const h = 0.4 + rng() * 0.75, r = 0.09 + rng() * 0.07;
          const outer = new T.CylinderGeometry(r, r * 0.72, h, 10, 1, true);
          parts.push({ geo: outer, m: M((rng() - .5) * .5, h / 2, (rng() - .5) * .5, (rng() - .5) * .3, 0, (rng() - .5) * .3) });
          parts.push({ geo: new T.TorusGeometry(r * 0.92, 0.022, 5, 12), m: M((rng() - .5) * .0 + 0, h, 0, Math.PI / 2, 0, 0) });
        }
        g = mergeParts(parts); break;
      }
      case "plateCoral": { // 판상 산호 — 겹친 원반
        const parts = []; const rng = makeRng(97);
        for (let i = 0; i < 3; i++) {
          const r = 0.55 - i * 0.12;
          parts.push({ geo: new T.CylinderGeometry(r, r * 0.86, 0.06, 16), m: M((rng() - .5) * .3, 0.08 + i * 0.19, (rng() - .5) * .3, (rng() - .5) * .28, 0, (rng() - .5) * .28) });
        }
        parts.push({ geo: new T.CylinderGeometry(0.09, 0.14, 0.3, 8), m: M(0, 0.15, 0) });
        g = mergeParts(parts); break;
      }
      case "anomalo": {    // 큰 마디 절지동물 — 옆지느러미 쌍 + 눈자루 + 앞다리
        const parts = [];
        parts.push({ geo: new T.SphereGeometry(0.5, 20, 12), m: M(0, 0, 0, 0, 0, 0, 0.34, 0.3, 1.25) });
        for (let i = 0; i < 9; i++) {   // 좌우 옆지느러미
          const z = 0.7 - i * 0.19, s = 1 - Math.abs(i - 3) * 0.09;
          for (const sx of [-1, 1]) parts.push({ geo: new T.SphereGeometry(0.5, 8, 6), m: M(sx * 0.34, -0.03, z, 0, sx * 0.2, 0, 0.42 * s, 0.035, 0.1) });
        }
        parts.push({ geo: new T.SphereGeometry(0.5, 12, 10), m: M(0, 0.05, 0.78, 0, 0, 0, 0.3, 0.26, 0.2) }); // 머리
        for (const sx of [-1, 1]) {   // 눈자루
          parts.push({ geo: new T.CylinderGeometry(0.03, 0.04, 0.22, 6), m: M(sx * 0.24, 0.16, 0.8, 0, 0, sx * -0.5) });
          parts.push({ geo: new T.SphereGeometry(0.085, 10, 8), m: M(sx * 0.32, 0.25, 0.82) });
        }
        for (const sx of [-1, 1]) for (let k = 0; k < 4; k++)  // 앞다리 마디
          parts.push({ geo: new T.SphereGeometry(0.5, 8, 6), m: M(sx * 0.1, -0.05 - k * 0.06, 0.95 + k * 0.16, 0, 0, 0, 0.09, 0.07, 0.11) });
        for (let i = 0; i < 3; i++)   // 꼬리 갈래
          parts.push({ geo: new T.SphereGeometry(0.5, 8, 6), m: M((i - 1) * 0.12, 0, -0.78 - Math.abs(i - 1) * 0.06, 0, 0, 0, 0.05, 0.035, 0.3) });
        g = mergeParts(parts); break;
      }
      case "armorFish": {  // 갑주어 — 머리 갑옷판이 뚜렷하다
        const parts = [];
        parts.push({ geo: new T.SphereGeometry(0.5, 18, 12), m: M(0, 0, -0.1, 0, 0, 0, 0.4, 0.4, 1.1) });
        parts.push({ geo: new T.SphereGeometry(0.5, 16, 10), m: M(0, 0.02, 0.55, 0, 0, 0, 0.46, 0.36, 0.55) });  // 갑옷 머리
        parts.push({ geo: new T.ConeGeometry(0.26, 0.42, 4), m: M(0, 0, -0.82, Math.PI * 0.5, 0, 0, 0.45, 1, 1) });
        parts.push({ geo: new T.ConeGeometry(0.14, 0.28, 4), m: M(0, 0.2, -0.15, 0, 0, 0, 0.35, 1, 1.4) });
        for (const sx of [-1, 1]) parts.push({ geo: new T.SphereGeometry(0.5, 8, 6), m: M(sx * 0.32, -0.1, 0.3, 0, sx * 0.4, 0, 0.4, 0.06, 0.2) });
        g = mergeParts(parts); break;
      }
      case "turf": {       // 해저 카펫 — 작은 조류 다발
        const parts = []; const rng = makeRng(131);
        for (let i = 0; i < 5; i++) {
          const h = 0.5 + rng() * 0.7;
          parts.push({ geo: new T.ConeGeometry(0.05, h, 4), m: M((rng() - .5) * .3, h / 2, (rng() - .5) * .3, (rng() - .5) * .5, rng() * 3, (rng() - .5) * .5) });
        }
        g = mergeParts(parts); break;
      }
      default: g = new T.SphereGeometry(0.5, 14, 10);
    }
    g.computeVertexNormals(); G[shape] = g; return g;
  }
  function spiralPoints(turns, growth, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const a = t * turns * Math.PI * 2; const r = 0.05 * Math.pow(growth, t); pts.push(new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    return pts;
  }

  /* ======================================================================
     트랙 — 스플라인 + 평행 이송 프레임 + 곡률
     ====================================================================== */
  function makeTrack(env) {
    const cps = TRACK_CP.map(p => new T.Vector3(p[0], env.railY + p[1] * env.amp, p[2]));
    const curve = new T.CatmullRomCurve3(cps, false, "catmullrom", 0.5);
    curve.arcLengthDivisions = 2000;
    const N = 700;
    const pos = [], tan = [], up = [], side = [], cum = [0];
    for (let i = 0; i <= N; i++) { const u = i / N; pos.push(curve.getPointAt(u)); tan.push(curve.getTangentAt(u).normalize()); }
    for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + pos[i].distanceTo(pos[i - 1]));
    const total = cum[N];
    // 평행 이송(parallel transport): 프레네 프레임의 뒤집힘을 막는다
    let n = new T.Vector3(0, 1, 0);
    n.sub(tan[0].clone().multiplyScalar(n.dot(tan[0]))).normalize();
    for (let i = 0; i <= N; i++) {
      if (i > 0) {
        const axis = new T.Vector3().crossVectors(tan[i - 1], tan[i]); const l = axis.length();
        if (l > 1e-7) { axis.divideScalar(l); n.applyAxisAngle(axis, Math.asin(Math.min(1, l))); }
        n.sub(tan[i].clone().multiplyScalar(n.dot(tan[i]))).normalize();
      }
      up.push(n.clone()); side.push(new T.Vector3().crossVectors(tan[i], n).normalize());
    }
    // 곡률 κ (부호: side 방향 성분)
    const curv = [];
    for (let i = 0; i <= N; i++) {
      const a = Math.max(1, i) - 1, b = Math.min(N, i + 1);
      const ds = cum[b] - cum[a];
      if (ds < 1e-6) { curv.push(0); continue; }
      const dT = tan[b].clone().sub(tan[a]).divideScalar(ds);
      curv.push(dT.dot(side[i]));
    }
    let yMax = -1e9; pos.forEach(p => { if (p.y > yMax) yMax = p.y; });

    function idxAt(s) {
      const c = Math.max(0, Math.min(total, s));
      let lo = 0, hi = N; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < c) lo = mid + 1; else hi = mid; }
      const i = Math.max(1, lo); const t = (cum[i] - cum[i - 1]) > 0 ? (c - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
      return { i, t };
    }
    function at(s) {
      const { i, t } = idxAt(s);
      const p = pos[i - 1].clone().lerp(pos[i], t);
      const tg = tan[i - 1].clone().lerp(tan[i], t).normalize();
      const u = up[i - 1].clone().lerp(up[i], t).normalize();
      const sd = new T.Vector3().crossVectors(tg, u).normalize();
      const k = curv[i - 1] * (1 - t) + curv[i] * t;
      return { pos: p, tan: tg, up: u, side: sd, curv: k };
    }
    function speedAt(y) { return Math.sqrt(Math.max(V_MIN * V_MIN, V_MIN * V_MIN + 2 * G_EFF * (yMax - y))); }
    return { curve, total, at, speedAt, N, pos, tan, up, side, yMax };
  }

  /* 레일·침목·지지 기둥 */
  function buildTrackMesh(track, env) {
    const grp = new T.Group();
    const GAUGE = 0.60;
    const railMat = new T.MeshStandardMaterial({ color: COL(0xb9c6cf), roughness: 0.32, metalness: 0.9 });
    const tieMat = new T.MeshStandardMaterial({ color: COL(0x4a3f33), roughness: 0.92, metalness: 0.02 });
    const colMat = new T.MeshStandardMaterial({ color: COL(0x394049), roughness: 0.6, metalness: 0.5 });
    // 레일 2줄
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= track.N; i += 2) pts.push(track.pos[i].clone().addScaledVector(track.side[i], s * GAUGE));
      const c = new T.CatmullRomCurve3(pts);
      grp.add(new T.Mesh(new T.TubeGeometry(c, 480, 0.045, 8, false), railMat));
    }
    // 중앙 보 (스파인)
    {
      const pts = [];
      for (let i = 0; i <= track.N; i += 2) pts.push(track.pos[i].clone().addScaledVector(track.up[i], -0.22));
      grp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 400, 0.06, 8, false), railMat));
    }
    // 침목 — 일정 간격
    const tieGap = 1.15, nTies = Math.floor(track.total / tieGap);
    const tieGeo = new T.BoxGeometry(GAUGE * 2 + 0.34, 0.055, 0.15);
    const ties = new T.InstancedMesh(tieGeo, tieMat, nTies); ties.frustumCulled = false;
    const d = new T.Object3D(); const mtx = new T.Matrix4();
    for (let i = 0; i < nTies; i++) {
      const f = track.at(i * tieGap + 0.4);
      mtx.makeBasis(f.side, f.up, f.tan);
      d.position.copy(f.pos).addScaledVector(f.up, -0.08);
      d.quaternion.setFromRotationMatrix(mtx); d.scale.set(1, 1, 1); d.updateMatrix();
      ties.setMatrixAt(i, d.matrix);
    }
    ties.instanceMatrix.needsUpdate = true; grp.add(ties);
    // 지지 기둥 — 지나갈 때 속도감을 만든다
    const colGap = 6.0, nCol = Math.floor(track.total / colGap);
    const colGeo = new T.CylinderGeometry(0.11, 0.16, 1, 9);
    const cols = new T.InstancedMesh(colGeo, colMat, nCol); cols.frustumCulled = false;
    for (let i = 0; i < nCol; i++) {
      const f = track.at(i * colGap + 3);
      const h = Math.max(0.4, f.pos.y - 0.35 - env.seafloorY);
      d.position.set(f.pos.x, env.seafloorY + h / 2, f.pos.z);
      d.quaternion.identity(); d.scale.set(1, h, 1); d.updateMatrix();
      cols.setMatrixAt(i, d.matrix);
    }
    cols.instanceMatrix.needsUpdate = true; grp.add(cols);
    // 기둥 받침
    const baseGeo = new T.CylinderGeometry(0.42, 0.5, 0.2, 10);
    const bases = new T.InstancedMesh(baseGeo, colMat, nCol); bases.frustumCulled = false;
    for (let i = 0; i < nCol; i++) {
      const f = track.at(i * colGap + 3);
      d.position.set(f.pos.x, env.seafloorY + 0.1, f.pos.z); d.quaternion.identity(); d.scale.set(1, 1, 1); d.updateMatrix();
      bases.setMatrixAt(i, d.matrix);
    }
    bases.instanceMatrix.needsUpdate = true; grp.add(bases);
    grp.userData.mats = [railMat, tieMat, colMat];
    grp.userData.geos = [tieGeo, colGeo, baseGeo];
    return grp;
  }

  /* ===== 환경 구성물 ===== */
  function buildWaterSurface(env) {
    const geo = new T.PlaneGeometry(460, 460, 190, 190); geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      transparent: true, side: T.DoubleSide, depthWrite: false,
      uniforms: {
        uTime: UNI.time, uColor: { value: COL(env.water).lerp(COL(0xffffff), 0.16) },
        uBright: { value: env.surfaceBright }, uSun: { value: new T.Vector3(-env.lightDir[0], -env.lightDir[1], -env.lightDir[2]).normalize() },
        uSunCol: { value: COL(env.sun) }
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
          float rip = sin(vWP.x*0.30+uTime*1.1)*sin(vWP.z*0.34-uTime*0.9) + 0.5*sin((vWP.x+vWP.z)*0.19+uTime*1.5);
          float caustic = smoothstep(0.15,1.0, rip*0.35+0.5);
          vec3 c = uColor*(0.5+0.6*uBright) + caustic*0.12*uBright + uSunCol*sun*1.5*uBright;
          gl_FragColor = vec4(c, clamp(0.32 + 0.42*uBright + fres*0.3, 0.0, 0.92));
        }`
    });
    const m = new T.Mesh(geo, mat); m.position.x = 97; m.renderOrder = 2; return m;
  }

  function buildGodrays(env) {
    const grp = new T.Group();
    const dir = new T.Vector3(env.lightDir[0], env.lightDir[1], env.lightDir[2]).normalize();
    const sharp = env.harshSun ? 0.62 : 0.4;   // 오존층 없음 → 더 선명하고 강한 빛기둥
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uTime: UNI.time, uColor: { value: COL(env.sun) }, uI: { value: env.sunbeam }, uS: { value: sharp } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; uniform vec3 uColor; uniform float uI; uniform float uTime; uniform float uS; varying vec2 vUv;
        void main(){ float e=smoothstep(0.0,uS,vUv.x)*smoothstep(1.0,1.0-uS,vUv.x);
          float f=smoothstep(0.0,0.28,vUv.y)*smoothstep(1.0,0.45,vUv.y);
          float k=0.82+0.18*sin(uTime*0.7+vUv.y*5.0+vUv.x*3.0);
          gl_FragColor=vec4(uColor, e*f*0.15*uI*k); }`
    });
    const rng = makeRng(777); const nB = env.harshSun ? 14 : 9;
    for (let i = 0; i < nB; i++) {
      const beam = new T.Mesh(new T.PlaneGeometry(2.8 + rng() * 2.4, Math.abs(env.seafloorY) * 2.6), mat);
      beam.position.set(6 + i * 15 + rng() * 8, env.seafloorY * 0.5, (rng() - 0.5) * 26);
      beam.lookAt(beam.position.clone().add(dir)); beam.rotateX(Math.PI / 2); beam.renderOrder = 1;
      grp.add(beam);
    }
    grp.userData.mats = [mat];
    return grp;
  }

  function makeSandTexture(env) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d");
    c.fillStyle = "#" + new T.Color(env.floor).getHexString(); c.fillRect(0, 0, 256, 256);
    const rng = makeRng(8080);
    for (let y = 0; y < 256; y += 4) {
      c.strokeStyle = "rgba(0,0,0," + (0.10 * (0.7 + 0.3 * Math.sin(y * 0.16 + rng() * 0.6))).toFixed(3) + ")";
      c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x * 0.05 + y * 0.1) * 3; x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke();
    }
    for (let i = 0; i < 1600; i++) { const x = rng() * 256, y = rng() * 256, r = rng() * 1.6; c.fillStyle = "rgba(" + (rng() < 0.5 ? "0,0,0," : "255,255,255,") + (0.05 + rng() * 0.06).toFixed(3) + ")"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(13, 13); tex.anisotropy = 8; tex.encoding = T.sRGBEncoding;
    return tex;
  }

  function buildSeafloor(env) {
    const geo = new T.PlaneGeometry(420, 420, 170, 170); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const rng = makeRng(4242);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 0.14) * 0.55 + Math.cos(z * 0.17) * 0.55 + Math.sin(x * 0.5 + z * 0.3) * 0.18 + (rng() - 0.5) * 0.5);
    }
    geo.computeVertexNormals();
    const tex = makeSandTexture(env);
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 1.0, metalness: 0.0 });
    mat.userData.u = { uTime: UNI.time, uCaustI: { value: env.caustic } };
    mat.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vFP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n vFP=(modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;uniform float uCaustI;varying vec3 vFP;\n" + CAUSTIC_GLSL)
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n float ca=caustic(vFP.xz*0.09,uTime*0.35);\n gl_FragColor.rgb+=vec3(0.78,0.92,0.86)*ca*uCaustI;");
    };
    const m = new T.Mesh(geo, mat); m.position.set(97, env.seafloorY, 0);
    m.userData.tex = tex; return m;
  }

  function makeDotTexture(soft) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 32; const c = cv.getContext("2d");
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    if (soft) { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); }
    else { g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.6, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); }
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    return new T.CanvasTexture(cv);
  }

  function buildMarineSnow(env) {
    const N = 1600; const geo = new T.BufferGeometry(); const arr = new Float32Array(N * 3); const rng = makeRng(9099);
    for (let i = 0; i < N; i++) { arr[i * 3] = rng() * 210 - 8; arr[i * 3 + 1] = env.seafloorY + rng() * (0 - env.seafloorY); arr[i * 3 + 2] = (rng() - 0.5) * 60; }
    geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const tex = makeDotTexture(true);
    const mat = new T.PointsMaterial({ map: tex, color: COL(0xd6efe8), size: 0.13, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Points(geo, mat); p.userData.tex = tex; return p;
  }

  /* 해저 카펫 — 레퍼런스 영상은 바닥이 조류·군체로 빽빽하다. 관찰 대상 개체 수와
     무관한 환경 장식이므로 SPECIES 에 넣지 않는다(교육 데이터 오염 방지). */
  function buildTurf(env, track) {
    const cfg = env.turf; if (!cfg) return null;
    const geo = geomFor("turf");
    const mat = new T.MeshStandardMaterial({ color: COL(cfg.color), roughness: 0.9, metalness: 0.0 });
    mat.userData.u = { uTime: UNI.time, uCaustI: { value: env.caustic * 0.7 } };
    mat.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, mat.userData.u);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vTP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n vTP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;uniform float uCaustI;varying vec3 vTP;\n" + CAUSTIC_GLSL)
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n float ca=caustic(vTP.xz*0.09,uTime*0.35);\n gl_FragColor.rgb+=vec3(0.7,0.9,0.8)*ca*uCaustI;");
    };
    const im = new T.InstancedMesh(geo, mat, cfg.n); im.frustumCulled = false;
    const rng = makeRng(606); const d = new T.Object3D();
    for (let i = 0; i < cfg.n; i++) {
      const f = track.at(rng() * track.total);
      const lat = (rng() < 0.5 ? -1 : 1) * (1.2 + rng() * 15);
      d.position.set(f.pos.x + f.side.x * lat + (rng() - .5) * 3, env.seafloorY + 0.02, f.pos.z + f.side.z * lat + (rng() - .5) * 3);
      d.rotation.set(0, rng() * 6.28, 0);
      d.scale.setScalar(cfg.size * (0.6 + rng() * 0.85));
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.userData.mats = [mat];
    return im;
  }

  /* 산소 기포 — 선캄브리아(남세균 광합성).
     레퍼런스 캡처의 핵심 장면이 「해저 몇 지점에서 곧게 솟는 기포 기둥」이므로
     흩뿌리지 않고 분출 지점을 정해 기둥으로 세운다. */
  function buildBubbles(env, track) {
    const COLS = 26, PER = 46, N = COLS * PER;
    const geo = new T.BufferGeometry();
    const arr = new Float32Array(N * 3); const spd = new Float32Array(N); const src = new Int32Array(N);
    const spots = []; const rng = makeRng(1717);
    for (let c = 0; c < COLS; c++) {
      const f = track.at((0.04 + 0.93 * (c + rng() * 0.6) / COLS) * track.total);
      const side = rng() < 0.5 ? -1 : 1; const lat = side * (3.0 + rng() * 13);
      spots.push({ x: f.pos.x + f.side.x * lat, z: f.pos.z + f.side.z * lat, w: 0.10 + rng() * 0.16 });
    }
    for (let i = 0; i < N; i++) {
      const c = i % COLS; const sp = spots[c]; src[i] = c;
      const h = rng() * Math.abs(env.seafloorY);
      arr[i * 3] = sp.x + (rng() - .5) * sp.w * (1 + h * 0.35);
      arr[i * 3 + 1] = env.seafloorY + 0.1 + h;
      arr[i * 3 + 2] = sp.z + (rng() - .5) * sp.w * (1 + h * 0.35);
      spd[i] = 0.75 + rng() * 0.75;
    }
    geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const tex = makeDotTexture(false);
    const mat = new T.PointsMaterial({ map: tex, color: COL(0xe8fbff), size: 0.3, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Points(geo, mat);
    p.userData = { spd, spots, src, floorY: env.seafloorY, tex, kind: "bubbles" };
    return p;
  }

  /* 열수구(화산 활동) — 선캄브리아. 굴뚝 + 연기 기둥 + 붉은 빛 */
  function buildVents(env, track, n) {
    const grp = new T.Group(); const rng = makeRng(2929);
    const rockMat = new T.MeshStandardMaterial({ color: COL(0x2f2723), roughness: 0.95, metalness: 0.1, emissive: 0x2a0d04, emissiveIntensity: 0.5 });
    const chimGeo = new T.CylinderGeometry(0.16, 0.55, 1.6, 9);
    const chim = new T.InstancedMesh(chimGeo, rockMat, n); chim.frustumCulled = false;
    const d = new T.Object3D(); const spots = [];
    for (let i = 0; i < n; i++) {
      const f = track.at((0.1 + 0.85 * (i + rng() * 0.5) / n) * track.total);
      const side = rng() < 0.5 ? -1 : 1;
      const x = f.pos.x + f.side.x * side * (5 + rng() * 9), z = f.pos.z + f.side.z * side * (5 + rng() * 9);
      const s = 0.8 + rng() * 1.1;
      d.position.set(x, env.seafloorY + 0.8 * s, z); d.rotation.set((rng() - .5) * .2, rng() * 3, (rng() - .5) * .2); d.scale.setScalar(s); d.updateMatrix();
      chim.setMatrixAt(i, d.matrix); spots.push({ x, z, s });
    }
    chim.instanceMatrix.needsUpdate = true; grp.add(chim);
    // 연기 기둥
    const PN = 60 * n; const geo = new T.BufferGeometry(); const arr = new Float32Array(PN * 3);
    const meta = new Float32Array(PN * 2);
    for (let i = 0; i < PN; i++) {
      const sp = spots[i % n]; const h = rng() * 5.5;
      arr[i * 3] = sp.x + (rng() - .5) * (0.4 + h * 0.35); arr[i * 3 + 1] = env.seafloorY + 1.4 * sp.s + h; arr[i * 3 + 2] = sp.z + (rng() - .5) * (0.4 + h * 0.35);
      meta[i * 2] = i % n; meta[i * 2 + 1] = 0.35 + rng() * 0.5;
    }
    geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const tex = makeDotTexture(true);
    const smat = new T.PointsMaterial({ map: tex, color: COL(0x9c8f86), size: 0.5, transparent: true, opacity: 0.3, depthWrite: false });
    const smoke = new T.Points(geo, smat);
    smoke.userData = { kind: "smoke", spots, meta, floorY: env.seafloorY, tex };
    grp.add(smoke);
    // 빛
    for (let i = 0; i < Math.min(4, n); i++) {
      const sp = spots[i]; const L = new T.PointLight(0xff5a1e, 1.6, 9, 2.0);
      L.position.set(sp.x, env.seafloorY + 1.5 * sp.s, sp.z); L.userData.flick = rng() * 6; grp.add(L);
    }
    grp.userData.mats = [rockMat, smat]; grp.userData.geos = [chimGeo];
    return { group: grp, smoke };
  }

  /* ===== 종 인스턴스 배치 ===== */
  function buildSpecies(sp, env, track, seed, disposal) {
    const rng = makeRng(seed); const rim = rimFor(sp); const geom = geomFor(sp.shape);
    const transparent = (sp.shape === "jelly");
    const caustI = (sp.loc === "bottom" || sp.loc === "attached") ? env.caustic * 0.8 : env.caustic * 0.25;
    const mat = creatureMaterial(sp.body, rim, {
      transparent, opacity: transparent ? 0.5 : 1.0, rough: sp.animal ? 0.55 : 0.85,
      metal: sp.hard ? 0.22 : 0.05, side: transparent ? T.DoubleSide : T.FrontSide,
      rimStr: transparent ? 1.9 : (sp.hero ? 1.6 : 1.35), caustI
    });
    disposal.mats.push(mat);
    const insts = []; const total = track.total;
    const schoolCenters = [];
    if (sp.school) for (let k = 0; k < 5; k++) schoolCenters.push({ u: 0.12 + rng() * 0.78, side: rng() < 0.5 ? -1 : 1, y: env.railY + (rng() - 0.4) * env.amp });
    for (let i = 0; i < sp.n; i++) {
      let u, lat, vy, sc = null;
      if (sp.clusterAt != null) {          // 특정 정지점 근처에만 모은다
        u = Math.max(0.03, Math.min(0.99, STOPS_U[sp.clusterAt] + (rng() - 0.5) * 0.075));
      } else if (sp.school) {
        sc = schoolCenters[i % schoolCenters.length];
        u = Math.max(0.03, Math.min(0.98, sc.u + (rng() - 0.5) * 0.05));
      } else if (rng() < 0.42) { u = Math.max(0.03, Math.min(0.99, STOPS_U[i % 3] + (rng() - 0.5) * 0.09)); }
      else { u = 0.03 + 0.94 * (i + rng() * 0.6) / sp.n; }
      const f = track.at(u * total); const side = sc ? sc.side : (rng() < 0.5 ? -1 : 1);
      if (sp.loc === "swim") {
        const clear = 3.0 + sp.sizeM * 2.0 + (sp.hero ? 3.5 : 0);
        lat = side * (clear + rng() * (sc ? 3.0 : 7.0));
        const band = sc ? sc.y : env.railY + (rng() - 0.35) * env.amp * 1.1;
        vy = Math.min(-0.8, Math.max(env.seafloorY + 0.8, band + (sc ? (rng() - 0.5) * 1.6 : 0)));
      } else { lat = side * ((sp.hero ? 4.2 : 1.5) + sp.sizeM * 0.6 + rng() * (sp.hero ? 5.0 : 9.5)); vy = env.seafloorY + 0.02; }
      const px = f.pos.x + f.side.x * lat, pz = f.pos.z + f.side.z * lat;
      insts.push({ base: new T.Vector3(px, vy, pz), yaw: rng() * Math.PI * 2, scale: sp.sizeM * (0.82 + rng() * 0.4), phase: rng() * Math.PI * 2, speed: 0.4 + rng() * 0.8 });
    }
    const mesh = new T.InstancedMesh(geom, mat, sp.n); mesh.frustumCulled = false;
    const d = new T.Object3D();
    insts.forEach((it, k) => { d.position.copy(it.base); d.rotation.set(0, it.yaw, 0); d.scale.setScalar(it.scale); d.updateMatrix(); mesh.setMatrixAt(k, d.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
    const anim = (sp.loc === "swim") ? (sp.shape === "jelly" ? "jelly" : "swim") : (sp.shape === "frond" ? "sway" : "still");
    return { node: mesh, mesh, sp, insts, anim };
  }

  /* ======================================================================
     포스트프로세싱 — 블룸 + ACES + 채도/그레이드 + 비네트
     ====================================================================== */
  function makeComposer(renderer, scene, camera) {
    const quad = new T.PlaneGeometry(2, 2);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    function pass(fs, uniforms) {
      const mat = new T.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}", fragmentShader: fs });
      const sc = new T.Scene(); sc.add(new T.Mesh(quad, mat));
      return { mat, render(t) { renderer.setRenderTarget(t || null); renderer.clear(); renderer.render(sc, cam); } };
    }
    const opt = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
    let sceneRT, brightRT, blurA, blurB, W = 2, H = 2;
    function alloc(w, h) {
      W = w; H = h; const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      [sceneRT, brightRT, blurA, blurB].forEach(r => r && r.dispose());
      sceneRT = new T.WebGLRenderTarget(w, h, opt); brightRT = new T.WebGLRenderTarget(hw, hh, opt);
      blurA = new T.WebGLRenderTarget(hw, hh, opt); blurB = new T.WebGLRenderTarget(hw, hh, opt);
    }
    const bright = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThresh;
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(0.2126,0.7152,0.0722));
        gl_FragColor=vec4(c*smoothstep(uThresh,uThresh+0.6,l),1.0);} `, { tDiffuse: { value: null }, uThresh: { value: 1.15 } });
    const blur = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes;
      void main(){ vec2 px=uDir/uRes; vec3 s=vec3(0.0); float w[5];
        w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;
        s+=texture2D(tDiffuse,vUv).rgb*w[0];
        for(int i=1;i<5;i++){ s+=texture2D(tDiffuse,vUv+px*float(i)*1.5).rgb*w[i]; s+=texture2D(tDiffuse,vUv-px*float(i)*1.5).rgb*w[i]; }
        gl_FragColor=vec4(s,1.0);} `, { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uRes: { value: new T.Vector2(1, 1) } });
    const comp = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom;
      uniform float uBloom; uniform float uExposure; uniform vec3 uGrade; uniform float uSat;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      void main(){ vec3 c=texture2D(tScene,vUv).rgb + texture2D(tBloom,vUv).rgb*uBloom;
        c*=uExposure; c=aces(c);
        float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,uSat);   // 채도
        c=mix(c, c*c*(3.0-2.0*c), 0.18);                                    // 완만한 대비 S커브
        c*=uGrade;
        float d=distance(vUv,vec2(0.5)); c*= (smoothstep(0.92,0.32,d)*0.30+0.70);  // 비네트
        gl_FragColor=vec4(pow(clamp(c,0.0,1.0),vec3(1.0/2.2)),1.0);} `,
      { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.62 }, uExposure: { value: 1.0 }, uGrade: { value: new T.Vector3(1, 1, 1) }, uSat: { value: 1.08 } });
    function render() {
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      bright.mat.uniforms.tDiffuse.value = sceneRT.texture; bright.render(brightRT);
      const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1); let src = brightRT;
      for (let i = 0; i < 3; i++) {
        blur.mat.uniforms.tDiffuse.value = src.texture; blur.mat.uniforms.uDir.value.set(1, 0); blur.mat.uniforms.uRes.value.set(hw, hh); blur.render(blurA);
        blur.mat.uniforms.tDiffuse.value = blurA.texture; blur.mat.uniforms.uDir.value.set(0, 1); blur.render(blurB); src = blurB;
      }
      comp.mat.uniforms.tScene.value = sceneRT.texture; comp.mat.uniforms.tBloom.value = blurB.texture; comp.render(null);
    }
    alloc(2, 2);
    return { setSize: alloc, render, comp };
  }

  /* ======================================================================
     절차적 주행음 — 레일 럼블 + 바람. 외부 파일 없음(WebAudio 합성)
     ====================================================================== */
  function makeAudio() {
    let ctx = null, rumbleG = null, windG = null, master = null, ok = false;
    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const dat = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; dat[i] = last * 3.5; }
        master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);
        // 럼블
        const s1 = ctx.createBufferSource(); s1.buffer = buf; s1.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220; lp.Q.value = 3;
        rumbleG = ctx.createGain(); rumbleG.gain.value = 0.0;
        s1.connect(lp); lp.connect(rumbleG); rumbleG.connect(master); s1.start();
        // 바람
        const s2 = ctx.createBufferSource(); s2.buffer = buf; s2.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
        windG = ctx.createGain(); windG.gain.value = 0.0;
        s2.connect(bp); bp.connect(windG); windG.connect(master); s2.start();
        ok = true; return true;
      } catch (e) { ctx = null; return false; }
    }
    return {
      start() { if (!init()) return; if (ctx.state === "suspended") ctx.resume(); master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4); },
      setEnabled(on) { if (!ok) return; master.gain.setTargetAtTime(on ? 0.5 : 0.0, ctx.currentTime, 0.15); },
      update(v, moving) {
        if (!ok) return;
        const k = Math.min(1, Math.max(0, (v - 1.2) / 5.0)) * (moving ? 1 : 0.12);
        rumbleG.gain.setTargetAtTime(0.30 * k + 0.02, ctx.currentTime, 0.12);
        windG.gain.setTargetAtTime(0.13 * k * k, ctx.currentTime, 0.12);
      },
      available() { return ok || !!(window.AudioContext || window.webkitAudioContext); }
    };
  }

  /* ===== 하단 UI ===== */
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
    sps.forEach(sp => {
      const rt = !sp.animal ? "photo" : (sp.hard ? "hard" : "soft"); const nShow = Math.min(sp.n, 16);
      for (let i = 0; i < nShow; i++) {
        const x = 24 + rng() * (W - 48); const y = sp.loc === "swim" ? (24 + rng() * (floorY - 60)) : (floorY - 4 - rng() * 6); const r = 5 + sp.sizeM * 5;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = "#" + new T.Color(sp.body).getHexString(); c.fill(); c.lineWidth = 2.4; c.strokeStyle = rimHex(rt); c.stroke();
      }
    });
    c.fillStyle = "rgba(255,255,255,.9)"; c.font = "13px sans-serif"; c.fillText(env.introLabel + "의 바다 (단면도)", 12, 22);
  }

  /* ======================================================================
     메인
     ====================================================================== */
  function start(firstEra) {
    firstEra = firstEra || "precambrian";
    const $ = id => document.getElementById(id);
    $("h1").textContent = TEXT.title + " — 1인칭 라이드";
    $("subhead").textContent = TEXT.subheadRide;
    $("startBody").textContent = TEXT.lieCardFull;
    $("startBtn").textContent = TEXT.startButton;
    $("lieStrip").textContent = TEXT.lieStripShort;
    $("stopTotal").textContent = "3";
    const chipRow = $("chipRow"); chipRow.innerHTML = "";
    TEXT.observationChips.forEach(t => { const s = document.createElement("span"); s.className = "chip"; s.textContent = t; chipRow.appendChild(s); });
    const rl = $("rimLegend"); rl.innerHTML = "";
    TEXT.rimLegend.forEach(r => { const d = document.createElement("span"); d.className = "rimitem"; d.innerHTML = `<span class="rimdot" style="background:var(${r.c})"></span>${r.t}`; rl.appendChild(d); });
    const tabbar = $("eraTabs"); const tabBtns = {};
    ERAS.forEach(k => { const b = document.createElement("button"); b.className = "erabtn"; b.textContent = TEXT.tabs[k]; b.onclick = () => switchEra(k); tabbar.appendChild(b); tabBtns[k] = b; });

    const canvas = $("gl");
    let gl = null; try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) { gl = null; }
    if (!gl) { drawFallback(firstEra); $("startCard").style.display = "none"; buildLengthBar(firstEra); return; }

    const wrap = $("stageWrap");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.LinearEncoding; renderer.toneMapping = T.NoToneMapping; renderer.autoClear = false;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(66, 1, 0.05, 500); scene.add(camera);
    const composer = makeComposer(renderer, scene, camera);
    const rig = buildRig(camera);
    const audio = makeAudio(); let soundOn = true;

    const camLight = new T.PointLight(0xdff2ec, 0.3, 11, 2.2); camera.add(camLight);
    const hemi = new T.HemisphereLight(0xffffff, 0x404040, 0.8); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.0); scene.add(sun);

    let eraRoot = null, env = null, track = null, eraKey = null, disposal = null, vents = null, bubbles = null;
    let sIndex = 0, dist = 0, vel = V_MIN, mode = "idle", paused = false, yaw = 0, pitch = 0, roll = 0, shake = 0;
    const built = [];

    function disposeEra() {
      if (!eraRoot) return;
      scene.remove(eraRoot);
      eraRoot.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.userData && o.userData.tex) o.userData.tex.dispose();
        if (o.userData && o.userData.mats) o.userData.mats.forEach(m => m.dispose());
        if (o.userData && o.userData.geos) o.userData.geos.forEach(g => g.dispose());
        if (o.material && o.material.map) o.material.map.dispose();
        if (o.material && !Array.isArray(o.material)) o.material.dispose();
      });
      if (disposal) { disposal.mats.forEach(m => m.dispose()); }
      built.length = 0; vents = null; bubbles = null;
    }

    function buildEra(key) {
      disposeEra();
      eraKey = key; env = ENV[key];
      const seedBase = { precambrian: 1, paleozoic: 2, mesozoic: 3 }[key];
      disposal = { mats: [] };
      eraRoot = new T.Group(); scene.add(eraRoot);
      scene.background = COL(env.water);
      scene.fog = new T.FogExp2(COL(env.water).getHex(), env.fogDensity);
      hemi.color = COL(env.water).lerp(COL(0xffffff), 0.4); hemi.groundColor = COL(env.floor); hemi.intensity = env.ambient;
      sun.color = COL(env.sun); sun.intensity = env.sunI;
      sun.position.set(-env.lightDir[0], -env.lightDir[1], -env.lightDir[2]).multiplyScalar(40);
      composer.comp.mat.uniforms.uGrade.value.set(env.grade[0], env.grade[1], env.grade[2]);
      composer.comp.mat.uniforms.uExposure.value = env.exposure;
      composer.comp.mat.uniforms.uSat.value = env.sat;

      track = makeTrack(env);
      eraRoot.add(buildWaterSurface(env));
      eraRoot.add(buildGodrays(env));
      eraRoot.add(buildSeafloor(env));
      eraRoot.add(buildMarineSnow(env));
      eraRoot.add(buildTrackMesh(track, env));
      const turf = buildTurf(env, track); if (turf) eraRoot.add(turf);
      if (env.vents > 0) { vents = buildVents(env, track, env.vents); eraRoot.add(vents.group); }
      if (env.bubbles) { bubbles = buildBubbles(env, track); eraRoot.add(bubbles); }
      SPECIES[key].forEach((sp, i) => { const b = buildSpecies(sp, env, track, 5000 + seedBase * 131 + i * 17, disposal); built.push(b); eraRoot.add(b.node); });

      $("eraNow").textContent = env.introLabel;
      $("envLineTxt").textContent = env.envLine;
      buildLengthBar(key);
      ERAS.forEach(k => tabBtns[k].setAttribute("aria-pressed", k === key ? "true" : "false"));
      dist = 0; vel = track.speedAt(track.at(0).pos.y); sIndex = 0; yaw = 0; pitch = 0; roll = 0; paused = false;
      $("stopNow").textContent = "–"; $("btnPause").textContent = TEXT.pauseButton;
    }

    function switchEra(key) {
      buildEra(key);
      setGuide(TEXT.introCard[key]);
      if (mode !== "idle") { mode = "ride"; hideContinue(); }
    }

    // 시선
    let dragging = false, lx = 0, ly = 0;
    const ptc = e => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
    const look = p => { yaw -= (p.x - lx) * 0.005; pitch -= (p.y - ly) * 0.005; pitch = Math.max(-1.25, Math.min(1.25, pitch)); lx = p.x; ly = p.y; };
    canvas.addEventListener("mousedown", e => { dragging = true; const p = ptc(e); lx = p.x; ly = p.y; });
    window.addEventListener("mousemove", e => { if (dragging) look(ptc(e)); });
    window.addEventListener("mouseup", () => dragging = false);
    canvas.addEventListener("touchstart", e => { dragging = true; const p = ptc(e); lx = p.x; ly = p.y; }, { passive: true });
    canvas.addEventListener("touchmove", e => { if (dragging) { look(ptc(e)); e.preventDefault(); } }, { passive: false });
    window.addEventListener("touchend", () => dragging = false);
    canvas.setAttribute("tabindex", "0");
    window.addEventListener("keydown", e => {
      const k = e.key;
      if (k === "ArrowLeft") yaw += 0.08; else if (k === "ArrowRight") yaw -= 0.08;
      else if (k === "ArrowUp") pitch = Math.min(1.25, pitch + 0.06); else if (k === "ArrowDown") pitch = Math.max(-1.25, pitch - 0.06);
    });

    function setGuide(t) { $("guideText").textContent = t; }
    function showContinue(t) { const b = $("btnContinue"); b.style.display = ""; b.textContent = TEXT.continueButton; b.onclick = onContinue; setGuide(t); }
    function hideContinue() { $("btnContinue").style.display = "none"; }
    function onContinue() {
      if (mode === "stop") { mode = "ride"; hideContinue(); }
      else if (mode === "finish") { dist = 0; sIndex = 0; mode = "ride"; yaw = 0; pitch = 0; hideContinue(); setGuide(TEXT.introCard[eraKey]); }
    }
    $("startBtn").onclick = () => { $("startCard").style.display = "none"; mode = "ride"; setGuide(TEXT.introCard[eraKey]); if (soundOn) audio.start(); };
    $("btnPause").onclick = () => { paused = !paused; $("btnPause").textContent = paused ? "재생" : TEXT.pauseButton; };
    $("btnRestart").onclick = () => { dist = 0; sIndex = 0; mode = "ride"; paused = false; yaw = 0; pitch = 0; hideContinue(); $("btnPause").textContent = TEXT.pauseButton; setGuide(TEXT.introCard[eraKey]); };
    $("btnHands").onclick = () => { rig.group.visible = !rig.group.visible; $("btnHands").textContent = rig.group.visible ? TEXT.handsOn : TEXT.handsOff; };
    const bs = $("btnSound");
    if (bs) bs.onclick = () => { soundOn = !soundOn; bs.textContent = soundOn ? TEXT.soundOn : TEXT.soundOff; if (soundOn) audio.start(); else audio.setEnabled(false); };
    $("btnPause").textContent = TEXT.pauseButton; $("btnHands").textContent = TEXT.handsOn;
    if (bs) bs.textContent = TEXT.soundOn;
    hideContinue();

    function resize() {
      const w = wrap.clientWidth || 640; const h = Math.max(340, Math.round(w * 0.58));
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const dpr = renderer.getPixelRatio(); composer.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
    }
    buildEra(firstEra); setGuide(TEXT.introCard[firstEra]); resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener("resize", resize);

    const clock = new T.Clock(); let raf = null;
    const mBasis = new T.Matrix4(), qTrack = new T.Quaternion(), qUser = new T.Quaternion(), eUser = new T.Euler();
    function frame() {
      const dt = Math.min(0.12, clock.getDelta()); const t = clock.elapsedTime; UNI.time.value = t;
      const moving = (mode === "ride" && !paused);

      if (moving) {
        vel = track.speedAt(track.at(dist).pos.y);           // 경사에 따른 가·감속
        dist += vel * dt;
        if (sIndex < STOPS_U.length && dist >= STOPS_U[sIndex] * track.total) {
          dist = STOPS_U[sIndex] * track.total; mode = "stop";
          $("stopNow").textContent = (sIndex + 1); showContinue(TEXT.stopBriefing[eraKey][sIndex]); sIndex++;
        } else if (dist >= track.total) {
          dist = track.total; mode = "finish";
          const b = $("btnContinue"); b.style.display = ""; b.textContent = TEXT.restartButton; b.onclick = onContinue; setGuide(TEXT.finishHint);
        }
      }
      const f = track.at(dist);
      // 뱅킹 — tanθ = v²κ/g
      const targetRoll = Math.max(-0.62, Math.min(0.62, Math.atan(vel * vel * f.curv / (G_EFF * 5.5))));
      roll += (targetRoll - roll) * Math.min(1, dt * 3.2);
      // 흔들림 — 속도에 비례
      const sAmp = moving ? Math.min(1, (vel - 1.2) / 5) * 0.022 : 0;
      shake += dt;
      const sx = Math.sin(shake * 37.0) * sAmp + Math.sin(shake * 23.3) * sAmp * 0.6;
      const sy = Math.cos(shake * 41.0) * sAmp + Math.sin(shake * 19.7) * sAmp * 0.5;

      // 카메라: 트랙 기저 → 롤 → 사용자 시선
      const up = f.up.clone().applyAxisAngle(f.tan, roll);
      const side = new T.Vector3().crossVectors(f.tan, up).normalize();
      mBasis.makeBasis(side, up, f.tan.clone().negate());  // three 카메라는 -Z 를 본다
      qTrack.setFromRotationMatrix(mBasis);
      eUser.set(pitch + sy, yaw + sx, 0, "YXZ"); qUser.setFromEuler(eUser);
      camera.quaternion.copy(qTrack).multiply(qUser);
      camera.position.copy(f.pos).addScaledVector(up, 1.02);
      camera.fov = 66 + Math.min(12, Math.max(0, (vel - 2.2)) * 1.9);       // 속도감
      camera.updateProjectionMatrix();

      $("timeLeft").textContent = Math.round((dist / track.total) * 100) + "%";
      if (soundOn) audio.update(vel, moving);

      for (const b of built) animateSpecies(b, t);
      if (bubbles) animateBubbles(bubbles, dt);
      if (vents) animateVents(vents, dt, t);

      composer.render();
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; audio.setEnabled(false); }
      else if (!raf) { clock.getDelta(); if (soundOn) audio.setEnabled(true); raf = requestAnimationFrame(frame); }
    });
    clock.getDelta(); raf = requestAnimationFrame(frame);
  }

  /* ===== 애니메이션 ===== */
  const _d = new T.Object3D();
  function animateSpecies(b, t) {
    if (b.anim === "still") return;
    const m = b.mesh;
    b.insts.forEach((it, k) => {
      _d.position.copy(it.base); let ry = it.yaw; const sy = it.scale;
      if (b.anim === "swim") {
        _d.position.x += Math.sin(t * it.speed + it.phase) * 0.55;
        _d.position.y += Math.sin(t * it.speed * 0.8 + it.phase) * 0.22;
        ry = it.yaw + Math.sin(t * it.speed * 0.6 + it.phase) * 0.3;
        _d.rotation.set(Math.sin(t * it.speed * 1.6 + it.phase) * 0.08, ry, Math.sin(t * it.speed + it.phase) * 0.1);
        _d.scale.setScalar(sy); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix); return;
      }
      if (b.anim === "jelly") {
        const p = 1 + Math.sin(t * 1.6 + it.phase) * 0.14;
        _d.position.y += Math.sin(t * 0.6 + it.phase) * 0.34;
        _d.scale.set(sy * p, sy * (2 - p), sy * p); _d.rotation.set(0, ry, 0); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix); return;
      }
      if (b.anim === "sway") {
        _d.rotation.set(Math.sin(t * 0.8 + it.phase) * 0.3, ry, Math.cos(t * 0.6 + it.phase) * 0.18);
        _d.scale.setScalar(sy); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix); return;
      }
      _d.rotation.set(0, ry, 0); _d.scale.setScalar(sy); _d.updateMatrix(); m.setMatrixAt(k, _d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }
  function animateBubbles(p, dt) {
    const a = p.geometry.attributes.position.array; const u = p.userData;
    for (let i = 0; i < u.spd.length; i++) {
      a[i * 3 + 1] += u.spd[i] * dt;
      const sp = u.spots[u.src[i]];
      const h = a[i * 3 + 1] - u.floorY;
      // 위로 갈수록 살짝 벌어지며 흔들린다
      a[i * 3] += Math.sin(a[i * 3 + 1] * 1.9 + i) * dt * 0.10;
      a[i * 3 + 2] += Math.cos(a[i * 3 + 1] * 1.6 + i * 0.7) * dt * 0.10;
      if (a[i * 3 + 1] > -0.15) {
        a[i * 3 + 1] = u.floorY + 0.1;
        a[i * 3] = sp.x + (Math.random() - .5) * sp.w;
        a[i * 3 + 2] = sp.z + (Math.random() - .5) * sp.w;
      }
    }
    p.geometry.attributes.position.needsUpdate = true;
  }
  function animateVents(v, dt, t) {
    const p = v.smoke; const a = p.geometry.attributes.position.array; const u = p.userData;
    for (let i = 0; i < u.meta.length / 2; i++) {
      const sp = u.spots[u.meta[i * 2]]; const rate = u.meta[i * 2 + 1];
      a[i * 3 + 1] += rate * dt;
      a[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.22;
      if (a[i * 3 + 1] > u.floorY + 7.0) { a[i * 3 + 1] = u.floorY + 1.4 * sp.s; a[i * 3] = sp.x + (Math.random() - 0.5) * 0.5; a[i * 3 + 2] = sp.z + (Math.random() - 0.5) * 0.5; }
    }
    p.geometry.attributes.position.needsUpdate = true;
    v.group.children.forEach(c => { if (c.isPointLight) c.intensity = 1.2 + Math.sin(t * 3.1 + c.userData.flick) * 0.5; });
  }

  /* ===== 1인칭 탑승 리그 — 손잡이 바 + 손 + 차체 앞부분 ===== */
  function buildRig(camera) {
    const grp = new T.Group();
    const metal = new T.MeshStandardMaterial({ color: COL(0x2a3038), roughness: 0.26, metalness: 0.95 });
    const carMat = new T.MeshStandardMaterial({ color: COL(0x8c3a24), roughness: 0.42, metalness: 0.35 });
    const skin = new T.MeshStandardMaterial({ color: COL(0xc0916a), roughness: 0.72, metalness: 0.0 });
    const sleeve = new T.MeshStandardMaterial({ color: COL(0x6b4f2c), roughness: 0.9, metalness: 0.0 });
    const BAR = -0.46, Z = -0.60;
    grp.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.96, 16), metal, 0, BAR, Z, 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) grp.add(mesh(new T.CylinderGeometry(0.024, 0.024, 0.36, 12), metal, s * 0.44, BAR - 0.17, Z + 0.02, 0.25, 0, 0));
    // 차체 앞부분 — 화면 아래 가장자리에 살짝만 걸치게. 시야를 막지 않는다.
    grp.add(mesh(new T.BoxGeometry(1.02, 0.2, 0.4), carMat, 0, BAR - 0.28, Z - 0.02));
    for (const s of [-1, 1]) {
      grp.add(mesh(new T.SphereGeometry(0.052, 12, 9), skin, s * 0.18, BAR + 0.036, Z + 0.015, 0, 0, 0, 1.5, 0.7, 1.15));
      for (let f = 0; f < 4; f++) {
        const fg = new T.CapsuleGeometry(0.017, 0.05, 3, 6);
        grp.add(mesh(fg, skin, s * 0.18 + (f - 1.5) * 0.033, BAR + 0.008, Z + 0.076, Math.PI / 2, 0, 0));
      }
      grp.add(mesh(new T.CylinderGeometry(0.057, 0.062, 0.24, 12), sleeve, s * 0.21, BAR - 0.17, Z - 0.14, 1.05, 0, 0));
    }
    grp.traverse(o => { o.renderOrder = 12; if (o.material) o.material.fog = false; });
    camera.add(grp);
    return { group: grp };
    function mesh(g, m, x, y, z, rx, ry, rz, sx, sy, sz) {
      const o = new T.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0);
      if (sx != null) o.scale.set(sx, sy, sz); return o;
    }
  }

  return { start: start, GEO: GEO };
})();
