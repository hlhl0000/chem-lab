"use strict";
/* ============================================================================
   지질 시대의 바다 — 1인칭 라이드 엔진 (georide)  · three.js r147
   ----------------------------------------------------------------------------
   3개 시대 페이지(geotime-pre · geotime-paleo · geotime-meso)가 이 파일 하나를
   공유한다. 각 폴더의 sim.js 는 GeoRide.start("precambrian") 처럼 시대 키만 넘긴다.

   ★ 이 화면이 반박하려는 것 (기존 geotime 의 교육 설계를 그대로 승계)
     ① M13 "화석이 거의 없다 = 그 시대에 생물이 거의 없었다"
        → 선캄브리아 해저에 이 화면에서 가장 큰 물체(스트로마톨라이트)가 서 있다.
     ② 관찰 포인트 3: ① 얼마나 많은가 · ② 몸에 단단한 부분이 있는가 · ③ 붙어 있나 헤엄치나
     ③ 하늘을 나는 실루엣은 세 시대 어디에도 그리지 않는다(익룡≠공룡, M3).

   ★ 단단함(관찰 포인트 ②)은 "발광 테두리 색"으로 읽는다 — 사용자 확정.
        주황 테두리 = 몸에 단단한 부분 있음 · 보라 = 부드러움 · 초록 = 광합성 생물
        생물의 몸 자체는 자연스러운 색으로 그리고, 테두리 색만 뜻을 갖는다.

   데이터의 유일한 원천은 이 파일의 GEO 객체다(F-1). 수치를 두 곳에 타이핑하지 않는다.
   ========================================================================== */

window.GeoRide = (function () {
  const T = window.THREE;

  /* ===== 결정적 난수 (기존 geotime 과 같은 LCG) ===== */
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* ==========================================================================
     화면 문구 — 기존 geotime TEXT 에서 그대로 가져온다(내용 정확성·F-1).
     활동지(7문항)와 별도 「가정과 한계」 목록은 사용자 확정(Q3)으로 뺐다.
     '추정입니다' 카드와 그 안의 색·움직임 경고는 유지한다(F9 방어선).
     ========================================================================== */
  const TEXT = {
    subheadRide: "정해진 길을 따라 바닷속을 1인칭으로 지나갑니다. 화면을 끌면 고개가 돌아갑니다. 세 가지만 보세요.",
    tutorial: "화면을 끌어 좌우·위아래로 고개를 돌려 보세요. 멈추는 자리에서는 천천히 둘러볼 수 있습니다.",
    observationChips: ["① 얼마나 많은가", "② 단단한 부분(테두리 색)", "③ 붙어 있나 헤엄치나"],
    rimLegend: [
      { c: "--p-orange", t: "주황 테두리 = 몸에 단단한 부분 있음" },
      { c: "--p-violet", t: "보라 = 부드러움" },
      { c: "--p-mint",   t: "초록 = 광합성 생물" }
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
    dir: { inView: "화면 안에 있어요.", left: "◀ 왼쪽을 보세요.", right: "오른쪽을 보세요. ▶", up: "▲ 위를 보세요.", down: "▼ 아래를 보세요." },
    lengthFoot: "지질 시대 전체를 100으로 본 길이입니다. 네 시대 길이는 전혀 같지 않습니다.",
    fallbackNotice: "이 기기에서는 3D 그리기(WebGL)를 쓸 수 없습니다. 대신 단면도로 같은 세 가지를 그대로 관찰하세요 — ① 생물이 얼마나 많은가 ② 몸에 단단한 부분이 있는가(테두리 색) ③ 바닥에 붙어 있는가 헤엄치는가.",
    continueButton: "계속 가기",
    pauseButton: "일시정지",
    restartButton: "처음부터",
    handsOn: "탑승 바 숨기기",
    handsOff: "탑승 바 보이기"
  };

  /* ==========================================================================
     시대별 환경 — 기존 geotime ENV 값을 승계하되 라이드 스케일에 맞게 확장.
     seafloorY/railY/색/안개 방향은 그대로 유지(교과 서사: 얕다→깊다).
     ========================================================================== */
  const ENV = {
    precambrian: {
      label: "선캄브리아", introLabel: "선캄브리아시대",
      seafloorY: -6, railY: -3.0,
      water: 0x1b3330, deep: 0x0a1614, floor: 0x6f6446,
      fogDensity: 0.044, sun: 0xbfe8d8, sunI: 1.05, sunbeam: 1.0,
      lightDir: [0.15, -1.0, 0.10], surfaceBright: 0.85,
      envLine: "산소 ↑ (남세균 광합성), 오존층 아직 ✗"
    },
    paleozoic: {
      label: "고생대", introLabel: "고생대",
      seafloorY: -9, railY: -5.0,
      water: 0x0f3a4a, deep: 0x061c26, floor: 0x7a6b4a,
      fogDensity: 0.032, sun: 0xa9d8ef, sunI: 0.95, sunbeam: 0.7,
      lightDir: [0.25, -0.92, 0.30], surfaceBright: 0.62,
      envLine: "오존층 형성 ★ → 생물의 육상 진출"
    },
    mesozoic: {
      label: "중생대", introLabel: "중생대",
      seafloorY: -12, railY: -6.5,
      water: 0x0a2740, deep: 0x04121f, floor: 0x4a4640,
      fogDensity: 0.038, sun: 0x9bc6e6, sunI: 0.85, sunbeam: 0.45,
      lightDir: [0.10, -0.98, 0.18], surfaceBright: 0.5,
      envLine: "판게아 분리, 화산활동↑ CO₂↑ → 온난"
    }
  };

  /* ==========================================================================
     종 정의 — 기존 geotime SPECIES 를 그대로 승계(개체 수·loc·hard·이름).
     추가: body(자연색), shape(형태 빌더 키). rim 은 아래 규칙으로 파생(F-1).
       rim = photosynth(초록) if !animal ; hard(주황) if hard===true ; soft(보라) else
     ========================================================================== */
  const SPECIES = {
    precambrian: [
      { id: "stromatolite", name: "스트로마톨라이트", n: 6,  animal: false, hard: null,  loc: "attached", shape: "stromatolite", body: 0x6d5a3a, sizeM: 2.2, label: "스트로마톨라이트", hero: true },
      { id: "seaweed_pc",   name: "해초",           n: 10, animal: false, hard: null,  loc: "attached", shape: "frond",        body: 0x2f5137, sizeM: 0.9 },
      { id: "soft_bottom",  name: "부드러운 바닥 생물", n: 8, animal: true, hard: false, loc: "bottom",   shape: "blob",         body: 0x8a7f92, sizeM: 0.5 },
      { id: "jelly_pc",     name: "해파리 모양",     n: 3,  animal: true,  hard: false, loc: "swim",     shape: "bell",         body: 0x9fb6cf, sizeM: 0.30 }
    ],
    paleozoic: [
      { id: "trilobite",  name: "삼엽충",           n: 12, animal: true, hard: true,  loc: "bottom",   shape: "trilobite", body: 0x6b5334, sizeM: 0.40, label: "삼엽충" },
      { id: "bivalve",    name: "조개 모양",         n: 10, animal: true, hard: true,  loc: "bottom",   shape: "shell",     body: 0xcbb98e, sizeM: 0.30 },
      { id: "squidshell", name: "껍데기 오징어",     n: 6,  animal: true, hard: true,  loc: "swim",     shape: "orthocone", body: 0xbfa06a, sizeM: 0.55 },
      { id: "coral",      name: "산호 군체",         n: 12, animal: true, hard: true,  loc: "attached", shape: "coral",     body: 0xc98a72, sizeM: 0.5,  cluster: true },
      { id: "fish_pz",    name: "헤엄치는 척추동물", n: 18, animal: true, hard: true,  loc: "swim",     shape: "fish",      body: 0x9aa7ad, sizeM: 0.40 },
      { id: "jelly_pz",   name: "해파리",           n: 4,  animal: true, hard: false, loc: "swim",     shape: "bell",      body: 0x9fb6cf, sizeM: 0.28 },
      { id: "seaweed_pz", name: "해조류",           n: 16, animal: false, hard: null, loc: "attached", shape: "frond",     body: 0x2e5a3a, sizeM: 0.85 }
    ],
    mesozoic: [
      { id: "ammonite",   name: "암모나이트",       n: 24, animal: true, hard: true,  loc: "swim",   shape: "ammonite", body: 0xcbb08a, sizeM: 0.34, label: "암모나이트" },
      { id: "longneck",   name: "목이 긴 파충류",   n: 3,  animal: true, hard: true,  loc: "swim",   shape: "plesiosaur", body: 0x3f4a3c, sizeM: 2.6, hero: true },
      { id: "ichthyo",    name: "물고기 모양 파충류", n: 5, animal: true, hard: true,  loc: "swim",   shape: "ichthyo",  body: 0x3c4a58, sizeM: 1.8, hero: true },
      { id: "fish_mz",    name: "헤엄치는 척추동물", n: 12, animal: true, hard: true,  loc: "swim",   shape: "fish",     body: 0x9aa7ad, sizeM: 0.40 },
      { id: "bottom_mz",  name: "바닥 껍데기·산호", n: 10, animal: true, hard: true,  loc: "bottom", shape: "shell",    body: 0xc0b088, sizeM: 0.4 },
      { id: "jelly_mz",   name: "해파리",           n: 4,  animal: true, hard: false, loc: "swim",   shape: "bell",     body: 0x9fb6cf, sizeM: 0.28 },
      { id: "seaweed_mz", name: "해조류",           n: 12, animal: false, hard: null, loc: "attached", shape: "frond",  body: 0x2c5238, sizeM: 0.75 }
    ]
  };
  const ERAS = ["precambrian", "paleozoic", "mesozoic"];
  const STOPS_U = [0.30, 0.60, 0.92]; // 정지점 위치(레일 비율) — 배치·주행에서 함께 쓴다
  const ERA_LENGTH_PERCENT = { precambrian: 88.2, paleozoic: 6.3, mesozoic: 4.1, cenozoic: 1.4 };
  const ERA_ORDER = ["precambrian", "paleozoic", "mesozoic", "cenozoic"];
  const ERA_KOR = { precambrian: "선캄브리아", paleozoic: "고생대", mesozoic: "중생대", cenozoic: "신생대" };

  const RIM = { photo: 0x34d399, hard: 0xfb923c, soft: 0xa78bfa };
  function rimFor(sp) { return !sp.animal ? RIM.photo : (sp.hard ? RIM.hard : RIM.soft); }

  const GEO = { eras: ERAS, env: ENV, species: SPECIES, eraLengthPercent: ERA_LENGTH_PERCENT, text: TEXT };

  /* ===== CSS 토큰 읽기(발광 계열은 style.css 토큰과 맞춘다) ===== */
  const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ========================================================================
     생물 재질 — 자연색 몸 + 발광 테두리(Fresnel). MeshStandardMaterial 에
     onBeforeCompile 로 rim 을 주입한다. 안개·조명은 three 가 자동 처리.
     ======================================================================== */
  function creatureMaterial(bodyHex, rimHex, opt) {
    opt = opt || {};
    const m = new T.MeshStandardMaterial({
      color: new T.Color(bodyHex),
      roughness: opt.rough != null ? opt.rough : 0.72,
      metalness: opt.metal != null ? opt.metal : 0.04,
      transparent: !!opt.transparent,
      opacity: opt.opacity != null ? opt.opacity : 1.0,
      side: opt.side || T.FrontSide,
      emissive: new T.Color(bodyHex).multiplyScalar(0.06)
    });
    m.userData.rim = new T.Color(rimHex);
    m.userData.rimStr = opt.rimStr != null ? opt.rimStr : 0.9;
    m.userData.rimPow = opt.rimPow != null ? opt.rimPow : 2.4;
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uRim = { value: m.userData.rim };
      sh.uniforms.uRimStr = { value: m.userData.rimStr };
      sh.uniforms.uRimPow = { value: m.userData.rimPow };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGN;\nvarying vec3 vGP;")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\n vGP = (modelMatrix * vec4(transformed,1.0)).xyz;\n vGN = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uRim;uniform float uRimStr;uniform float uRimPow;\nvarying vec3 vGN;varying vec3 vGP;")
        .replace("#include <dithering_fragment>",
          "#include <dithering_fragment>\n vec3 Vd = normalize(cameraPosition - vGP);\n float rf = pow(1.0 - clamp(dot(normalize(vGN), Vd),0.0,1.0), uRimPow);\n gl_FragColor.rgb += uRim * rf * uRimStr;");
    };
    return m;
  }

  /* ========================================================================
     형태 빌더 — 각 shape 키에 대한 BufferGeometry(원점 기준, +z 전방).
     크기는 뒤에서 sizeM 으로 스케일한다.
     ======================================================================== */
  const G = {};
  function geomFor(shape) {
    if (G[shape]) return G[shape];
    let g;
    switch (shape) {
      case "stromatolite": {
        // 층상으로 쌓인 둥근 기둥 — 여러 개의 납작한 원기둥을 위로 쌓아 병합 대신 그룹 대용 단일 lathe
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const r = 0.5 * (1 - 0.35 * t) + 0.05 * Math.sin(t * Math.PI * 7); // 층 굴곡
          pts.push(new T.Vector2(Math.max(0.02, r), t * 2.0));
        }
        g = new T.LatheGeometry(pts, 24);
        break;
      }
      case "frond": {
        g = new T.PlaneGeometry(0.35, 1.0, 1, 6);
        g.translate(0, 0.5, 0);
        break;
      }
      case "blob": {
        g = new T.SphereGeometry(0.5, 16, 12);
        g.scale(1.2, 0.7, 1.0);
        break;
      }
      case "bell": {
        // 해파리 갓 — 반구 + 살짝 눌림
        g = new T.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
        g.scale(1.0, 0.85, 1.0);
        break;
      }
      case "trilobite": {
        g = new T.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        g.scale(0.6, 0.35, 1.05); // 납작하고 길쭉
        break;
      }
      case "shell": {
        g = new T.SphereGeometry(0.5, 16, 12);
        g.scale(1.0, 0.55, 0.85);
        break;
      }
      case "orthocone": {
        g = new T.ConeGeometry(0.28, 1.4, 18);
        g.rotateX(Math.PI * 0.5); // 전방으로 눕힘
        break;
      }
      case "coral": {
        g = new T.CylinderGeometry(0.06, 0.14, 0.9, 8);
        g.translate(0, 0.45, 0);
        break;
      }
      case "fish": {
        g = new T.SphereGeometry(0.5, 16, 12);
        g.scale(1.6, 0.5, 0.5); // 방추형
        break;
      }
      case "ammonite": {
        // 로그 나선 튜브
        const curve = new T.CatmullRomCurve3(spiralPoints(1.0, 4.5, 60));
        g = new T.TubeGeometry(curve, 80, 0.16, 10, false);
        break;
      }
      case "plesiosaur": {
        // 몸통(방추) 은 별도, 여기선 몸통만; 목/지느러미는 buildMeshFor 에서 그룹으로
        g = new T.SphereGeometry(0.5, 18, 14);
        g.scale(1.7, 0.7, 0.7);
        break;
      }
      case "ichthyo": {
        g = new T.SphereGeometry(0.5, 18, 12);
        g.scale(2.0, 0.5, 0.5);
        break;
      }
      default:
        g = new T.SphereGeometry(0.5, 12, 8);
    }
    g.computeVertexNormals();
    G[shape] = g;
    return g;
  }

  function spiralPoints(turns, growth, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      const r = 0.05 * Math.pow(growth, t);
      pts.push(new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    // 중심을 원점 근처로
    return pts;
  }

  /* ========================================================================
     한 종의 인스턴스 묶음 만들기. hero 종(스트로마톨라이트·목긴파충류)은
     개별 Mesh, 그 외는 InstancedMesh. 애니메이션 정보는 반환 객체에 담는다.
     ======================================================================== */
  function buildSpecies(sp, env, railFn, seed) {
    const rng = makeRng(seed);
    const rim = rimFor(sp);
    const geom = geomFor(sp.shape);
    const transparent = sp.shape === "bell";
    const mat = creatureMaterial(sp.body, rim, {
      transparent: transparent, opacity: transparent ? 0.62 : 1.0,
      rough: sp.animal ? 0.6 : 0.85, side: transparent ? T.DoubleSide : T.FrontSide,
      rimStr: transparent ? 1.2 : (sp.hero ? 1.05 : 0.95)
    });

    const insts = [];
    const total = railFn.total;
    for (let i = 0; i < sp.n; i++) {
      // 45%는 정지점 근처에 모아, 학생이 멈춰 둘러볼 때 볼 것이 있게 한다.
      let u;
      if (rng() < 0.45) {
        const su = STOPS_U[i % 3];
        u = Math.max(0.03, Math.min(0.99, su + (rng() - 0.5) * 0.10));
      } else {
        u = (0.03 + 0.94 * (i + rng() * 0.6) / sp.n);
      }
      const at = railFn.at(u * total);
      const side = (rng() < 0.5 ? -1 : 1);
      // 통로 반경: 경로 중심선에서 최소 간격을 두어 카메라 바로 위에 스폰되지 않게 한다.
      // 큰 헤엄 생물일수록·hero 일수록 더 멀리 둔다(시야 가림·과노출 방지).
      let lat, vy;
      if (sp.loc === "swim") {
        let clear = 2.6 + sp.sizeM * 1.9 + (sp.hero ? 3.2 : 0);
        lat = side * (clear + rng() * 6.0);
        const band = env.railY + (rng() - 0.35) * 3.2;
        vy = Math.min(env.railY + 1.6, Math.max(env.seafloorY + 0.6, band));
      } else { // bottom / attached
        let clear = 1.1 + sp.sizeM * 0.6;
        lat = side * (clear + rng() * 6.5);
        vy = env.seafloorY + 0.02;
      }
      const px = at.pos[0] + at.right[0] * lat;
      const pz = at.pos[2] + at.right[2] * lat;
      const s = sp.sizeM * (0.82 + rng() * 0.4);
      insts.push({
        base: new T.Vector3(px, vy, pz),
        yaw: rng() * Math.PI * 2,
        scale: s,
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 0.8
      });
    }

    let mesh, group = null;
    if (sp.shape === "plesiosaur") {
      // 목 긴 파충류: 몸통 + 목 + 머리 + 지느러미 4장을 그룹으로, 개체마다 복제
      group = new T.Group();
      insts.forEach(it => { group.add(buildPlesiosaur(mat, it)); });
      return { kind: "group", node: group, mat, sp, insts, anim: "swim" };
    } else {
      mesh = new T.InstancedMesh(geom, mat, sp.n);
      mesh.frustumCulled = false;
      const dummy = new T.Object3D();
      insts.forEach((it, k) => {
        dummy.position.copy(it.base);
        dummy.rotation.set(0, it.yaw, 0);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      const anim = (sp.loc === "swim") ? (sp.shape === "bell" ? "jelly" : "swim")
                 : (sp.shape === "frond" ? "sway" : "still");
      return { kind: "inst", node: mesh, mesh, mat, sp, insts, anim, dummy };
    }
  }

  function buildPlesiosaur(mat, it) {
    const g = new T.Group();
    const body = new T.Mesh(geomFor("plesiosaur"), mat); g.add(body);
    const neck = new T.Mesh(new T.CylinderGeometry(0.10, 0.16, 1.4, 10), mat);
    neck.geometry.translate(0, 0.7, 0); neck.rotation.z = -0.5; neck.position.set(0.85, 0.1, 0); g.add(neck);
    const head = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), mat); head.position.set(1.45, 0.7, 0); g.add(head);
    for (const s of [-1, 1]) {
      const fin = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), mat);
      fin.scale.set(0.5, 0.08, 0.28); fin.position.set(0.1, -0.2, s * 0.42); g.add(fin);
    }
    g.position.copy(it.base); g.rotation.y = it.yaw; g.scale.setScalar(it.scale);
    g.userData.it = it;
    return g;
  }

  /* ========================================================================
     레일 — 기존 geotime 과 같은 8 제어점 Catmull-Rom, 길이 108.
     ======================================================================== */
  function makeRail(env, seedBase) {
    const raw = [];
    const rnd = makeRng(9001 + seedBase * 77);
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = t * 108;
      const z = 4.5 * Math.sin(t * Math.PI * 1.35 + seedBase) + (rnd() - 0.5) * 1.2;
      const y = env.railY + 0.85 * Math.sin(t * Math.PI * 1.6 + seedBase * 0.7);
      raw.push(new T.Vector3(x, y, z));
    }
    const curve = new T.CatmullRomCurve3(raw, false, "catmullrom", 0.5);
    curve.arcLengthDivisions = 1200;
    const total = 108;
    function at(s) {
      const u = Math.max(0, Math.min(1, s / total));
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const up = new T.Vector3(0, 1, 0);
      const right = new T.Vector3().crossVectors(tan, up).normalize();
      return { pos: [p.x, p.y, p.z], tan: [tan.x, tan.y, tan.z], right: [right.x, right.y, right.z] };
    }
    return { curve, total, at };
  }

  /* ========================================================================
     환경 구성물 — 수면, 갓레이, 해저, 부유물.
     ======================================================================== */
  function buildWaterSurface(env) {
    const geo = new T.PlaneGeometry(300, 300, 60, 60);
    geo.rotateX(-Math.PI / 2);
    const mat = new T.ShaderMaterial({
      transparent: true, side: T.DoubleSide, depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new T.Color(env.water).lerp(new T.Color(0xffffff), 0.25) },
        uBright: { value: env.surfaceBright }
      },
      vertexShader: `
        uniform float uTime; varying vec2 vUv; varying float vH;
        void main(){ vUv=uv; vec3 p=position;
          float w = sin(p.x*0.35+uTime*0.9)*0.18 + cos(p.z*0.42+uTime*1.1)*0.16 + sin((p.x+p.z)*0.2+uTime*0.6)*0.1;
          p.y += w; vH = w;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `
        precision highp float; uniform vec3 uColor; uniform float uBright; uniform float uTime;
        varying vec2 vUv; varying float vH;
        void main(){
          float cell = sin(vUv.x*120.0+uTime*1.5)*sin(vUv.y*120.0-uTime*1.2);
          float caustic = smoothstep(0.2,1.0, cell*0.5+0.5);
          vec3 c = uColor*(0.55+0.55*(vH+0.3));
          c += caustic*0.25*uBright;
          float a = (0.42 + 0.30*uBright) ;
          gl_FragColor = vec4(c, a);
        }`
    });
    const m = new T.Mesh(geo, mat);
    m.position.y = 0;
    m.renderOrder = 2;
    return { mesh: m, mat };
  }

  function buildGodrays(env) {
    const grp = new T.Group();
    const dir = new T.Vector3(env.lightDir[0], env.lightDir[1], env.lightDir[2]).normalize();
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new T.Color(env.sun) }, uI: { value: env.sunbeam } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; uniform vec3 uColor; uniform float uI; uniform float uTime; varying vec2 vUv;
        void main(){ float edge = smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x);
          float fade = smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.55,vUv.y);
          float flick = 0.82+0.18*sin(uTime*0.8+vUv.y*6.0);
          gl_FragColor = vec4(uColor, edge*fade*0.11*uI*flick); }`
    });
    const rng = makeRng(777);
    for (let i = 0; i < 5; i++) {
      const g = new T.PlaneGeometry(3.4 + rng() * 2.4, 26);
      const beam = new T.Mesh(g, mat);
      beam.position.set(10 + i * 14 + rng() * 6, env.seafloorY / 2, (rng() - 0.5) * 10);
      beam.lookAt(beam.position.clone().add(dir));
      beam.rotateX(Math.PI / 2);
      beam.renderOrder = 1;
      grp.add(beam);
    }
    return { group: grp, mat };
  }

  function makeSandTexture(env) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const c = cv.getContext("2d");
    const base = new T.Color(env.floor);
    c.fillStyle = "#" + base.getHexString(); c.fillRect(0, 0, 256, 256);
    // 잔물결(모래 무늬)
    const rng = makeRng(8080);
    for (let y = 0; y < 256; y += 4) {
      const shade = 0.72 + 0.28 * Math.sin(y * 0.16 + rng() * 0.6);
      c.strokeStyle = "rgba(0,0,0," + (0.10 * shade).toFixed(3) + ")";
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const yy = y + Math.sin(x * 0.05 + y * 0.1) * 3;
        x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
      }
      c.stroke();
    }
    // 알갱이 반점
    for (let i = 0; i < 1400; i++) {
      const x = rng() * 256, y = rng() * 256, r = rng() * 1.6;
      c.fillStyle = "rgba(" + (rng() < 0.5 ? "0,0,0," : "255,255,255,") + (0.05 + rng() * 0.06).toFixed(3) + ")";
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    const tex = new T.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(24, 24);
    tex.anisotropy = 4;
    return tex;
  }

  function buildSeafloor(env) {
    const geo = new T.PlaneGeometry(320, 320, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const rng = makeRng(4242);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = Math.sin(x * 0.15) * 0.45 + Math.cos(z * 0.18) * 0.45
              + Math.sin(x * 0.5 + z * 0.3) * 0.15 + (rng() - 0.5) * 0.5;
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, map: makeSandTexture(env), roughness: 1.0, metalness: 0.0 });
    const m = new T.Mesh(geo, mat);
    m.position.y = env.seafloorY;
    return m;
  }

  function buildMarineSnow(env) {
    const N = 900;
    const geo = new T.BufferGeometry();
    const arr = new Float32Array(N * 3);
    const rng = makeRng(9099);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = rng() * 130 - 5;
      arr[i * 3 + 1] = env.seafloorY + rng() * (0 - env.seafloorY);
      arr[i * 3 + 2] = (rng() - 0.5) * 40;
    }
    geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const mat = new T.PointsMaterial({ color: 0xcfe6e0, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false });
    return new T.Points(geo, mat);
  }

  /* ========================================================================
     하단 UI 위젯 — 길이 막대·칩·테두리 범례 생성
     ======================================================================== */
  function buildLengthBar(host, curEra) {
    const bar = host.querySelector("#lenBar");
    const leg = host.querySelector("#lenLegend");
    const foot = host.querySelector("#lenFoot");
    const cols = { precambrian: "--d-violet", paleozoic: "--d-blue", mesozoic: "--d-amber", cenozoic: "--d-gray" };
    bar.innerHTML = ""; leg.innerHTML = "";
    ERA_ORDER.forEach(k => {
      const seg = document.createElement("span");
      seg.className = "lenseg" + (k === curEra ? " cur" : "");
      seg.style.flex = ERA_LENGTH_PERCENT[k] + " 0 0";
      seg.style.background = `var(${cols[k]})`;
      bar.appendChild(seg);
      const row = document.createElement("div");
      row.className = "lenrow" + (k === curEra ? " cur" : "");
      row.innerHTML = `<span class="lendot" style="background:var(${cols[k]})"></span>${ERA_KOR[k]} ${ERA_LENGTH_PERCENT[k]}%`;
      leg.appendChild(row);
    });
    foot.textContent = TEXT.lengthFoot;
  }

  /* ========================================================================
     2D 폴백 — WebGL 불가 기기용 단면도(관찰 포인트 3개 유지)
     ======================================================================== */
  function drawFallback(host, eraKey) {
    const env = ENV[eraKey], sps = SPECIES[eraKey];
    const glc = host.querySelector("#gl"); if (glc) glc.style.display = "none";
    const note = host.querySelector("#glFallback");
    note.style.display = "block";
    note.textContent = TEXT.fallbackNotice;
    const cv = host.querySelector("#flat");
    cv.style.display = "block";
    const wrap = host.querySelector("#stageWrap");
    const W = wrap.clientWidth || 640, H = Math.round(W * 0.6);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 배경(물)
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#" + new T.Color(env.water).getHexString());
    g.addColorStop(1, "#" + new T.Color(env.deep).getHexString());
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // 수면
    c.fillStyle = "rgba(200,230,240,.5)"; c.fillRect(0, 0, W, 10);
    // 해저
    const floorY = H - 34;
    c.fillStyle = "#" + new T.Color(env.floor).getHexString(); c.fillRect(0, floorY, W, H - floorY);
    const rimHex = t => "#" + new T.Color(RIM[t]).getHexString();
    const rng = makeRng(11);
    sps.forEach(sp => {
      const rt = !sp.animal ? "photo" : (sp.hard ? "hard" : "soft");
      const nShow = Math.min(sp.n, 14);
      for (let i = 0; i < nShow; i++) {
        const x = 24 + rng() * (W - 48);
        const y = sp.loc === "swim" ? (24 + rng() * (floorY - 60)) : (floorY - 4 - rng() * 6);
        const r = 5 + sp.sizeM * 5;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = "#" + new T.Color(sp.body).getHexString(); c.fill();
        c.lineWidth = 2.4; c.strokeStyle = rimHex(rt); c.stroke();
      }
    });
    c.fillStyle = "rgba(255,255,255,.9)"; c.font = "13px sans-serif";
    c.fillText(env.introLabel + "의 바다 (단면도)", 12, 22);
  }

  /* ========================================================================
     메인
     ======================================================================== */
  function start(eraKey) {
    const env = ENV[eraKey];
    const host = document; // 페이지 전체에서 요소를 찾는다
    const $ = id => host.getElementById(id);
    const seedBase = { precambrian: 1, paleozoic: 2, mesozoic: 3 }[eraKey];

    // 헤더/사이드 텍스트
    $("h1").textContent = "지질 시대의 바다 — " + env.introLabel;
    $("subhead").textContent = TEXT.subheadRide;
    $("eraNow").textContent = env.introLabel;
    $("envLineTxt").textContent = env.envLine;
    $("startBody").textContent = TEXT.lieCardFull;
    $("startBtn").textContent = TEXT.startButton;
    $("lieStrip").textContent = TEXT.lieStripShort;
    $("guideText").textContent = TEXT.tutorial;
    $("stopTotal").textContent = "3";

    // 칩
    const chipRow = $("chipRow"); chipRow.innerHTML = "";
    TEXT.observationChips.forEach(t => {
      const s = document.createElement("span"); s.className = "chip"; s.textContent = t; chipRow.appendChild(s);
    });
    // 테두리 범례
    const rl = $("rimLegend"); rl.innerHTML = "";
    TEXT.rimLegend.forEach(r => {
      const d = document.createElement("span"); d.className = "rimitem";
      d.innerHTML = `<span class="rimdot" style="background:var(${r.c})"></span>${r.t}`;
      rl.appendChild(d);
    });
    buildLengthBar(host, eraKey);

    // WebGL 지원 확인
    const canvas = $("gl");
    let gl = null;
    try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) { gl = null; }
    if (!gl) { drawFallback(host, eraKey); $("startCard").style.display = "none"; wireFallbackButtons(); return; }

    // ===== three 초기화 =====
    const wrap = $("stageWrap");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    const scene = new T.Scene();
    scene.background = new T.Color(env.deep);
    scene.fog = new T.FogExp2(env.water, env.fogDensity);

    const camera = new T.PerspectiveCamera(64, 1, 0.05, 400);
    scene.add(camera);

    // 조명
    const hemi = new T.HemisphereLight(new T.Color(env.water).lerp(new T.Color(0xffffff), 0.4).getHex(), env.floor, 0.75);
    scene.add(hemi);
    const sun = new T.DirectionalLight(env.sun, env.sunI);
    sun.position.set(-env.lightDir[0], -env.lightDir[1], -env.lightDir[2]).multiplyScalar(30);
    scene.add(sun);
    const camLight = new T.PointLight(0xdff2ec, 0.3, 9, 2.2); // 근처 생물 집중 조명
    camera.add(camLight);

    // 환경물
    const water = buildWaterSurface(env); scene.add(water.mesh);
    const rays = buildGodrays(env); scene.add(rays.group);
    scene.add(buildSeafloor(env));
    const snow = buildMarineSnow(env); scene.add(snow);

    // 레일 + 생물
    const rail = makeRail(env, seedBase);
    const sceneCurvePts = rail.curve.getSpacedPoints(200);
    const built = [];
    SPECIES[eraKey].forEach((sp, i) => {
      const b = buildSpecies(sp, env, rail, 5000 + seedBase * 131 + i * 17);
      built.push(b); scene.add(b.node);
    });

    // (육상 실루엣은 크루드 박스로 오독되어 제거 — 하늘·수면 위는 비워 둔다. 익룡 등 하늘 생물 없음 = M3)

    // 탑승 바 + 손 (1인칭)
    const rig = buildRig(camera);

    // ===== 라이드 상태 =====
    const STOPS = STOPS_U;
    let sIndex = 0;              // 다음 정지점
    let dist = 0;               // 진행 거리(m)
    const speed = 1.7;          // m/s
    let mode = "idle";          // idle | ride | stop | finish
    let paused = false;
    let yaw = 0, pitch = 0;     // 자유 시선 오프셋
    let clock = new T.Clock();

    // 시선 드래그
    let dragging = false, lx = 0, ly = 0;
    function pd(e) { dragging = true; const p = pt(e); lx = p.x; ly = p.y; }
    function pm(e) {
      if (!dragging) return;
      const p = pt(e); const dx = p.x - lx, dy = p.y - ly; lx = p.x; ly = p.y;
      yaw -= dx * 0.005; pitch -= dy * 0.005;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      e.preventDefault();
    }
    function pu() { dragging = false; }
    function pt(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
    canvas.addEventListener("mousedown", pd); window.addEventListener("mousemove", pm); window.addEventListener("mouseup", pu);
    canvas.addEventListener("touchstart", pd, { passive: true }); canvas.addEventListener("touchmove", pm, { passive: false }); window.addEventListener("touchend", pu);
    canvas.setAttribute("tabindex", "0");
    window.addEventListener("keydown", e => {
      const k = e.key;
      if (k === "ArrowLeft") yaw += 0.08;
      else if (k === "ArrowRight") yaw -= 0.08;
      else if (k === "ArrowUp") pitch = Math.min(1.2, pitch + 0.06);
      else if (k === "ArrowDown") pitch = Math.max(-1.2, pitch - 0.06);
    });

    // 버튼
    $("startBtn").onclick = () => { $("startCard").style.display = "none"; mode = "ride"; setGuide(TEXT.introCard[eraKey]); };
    $("btnContinue").onclick = () => { if (mode === "stop") { mode = "ride"; yaw *= 0.0; pitch *= 0.0; hideContinue(); } };
    $("btnPause").onclick = () => { paused = !paused; $("btnPause").textContent = paused ? "재생" : TEXT.pauseButton; };
    $("btnRestart").onclick = () => { dist = 0; sIndex = 0; mode = "ride"; paused = false; yaw = 0; pitch = 0; hideContinue(); $("btnPause").textContent = TEXT.pauseButton; setGuide(TEXT.introCard[eraKey]); };
    $("btnHands").onclick = () => { rig.group.visible = !rig.group.visible; $("btnHands").textContent = rig.group.visible ? TEXT.handsOn : TEXT.handsOff; };
    $("btnPause").textContent = TEXT.pauseButton;
    $("btnHands").textContent = TEXT.handsOn;
    hideContinue();

    function setGuide(t) { $("guideText").textContent = t; }
    function showContinue(t) { const b = $("btnContinue"); b.style.display = ""; setGuide(t); }
    function hideContinue() { $("btnContinue").style.display = "none"; }

    // ===== 리사이즈 =====
    function resize() {
      const w = wrap.clientWidth || 640;
      const h = Math.max(320, Math.round(w * 0.60));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    else window.addEventListener("resize", resize);

    // ===== 루프 =====
    let raf = null;
    function frame() {
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      water.mat.uniforms.uTime.value = t;
      rays.mat.uniforms.uTime.value = t;

      if (mode === "ride" && !paused) {
        dist += speed * dt;
        if (sIndex < STOPS.length && dist >= STOPS[sIndex] * rail.total) {
          dist = STOPS[sIndex] * rail.total;
          mode = "stop";
          $("stopNow").textContent = (sIndex + 1);
          showContinue(TEXT.stopBriefing[eraKey][sIndex]);
          sIndex++;
        } else if (dist >= rail.total) {
          dist = rail.total; mode = "finish"; setGuide(TEXT.finishHint);
          const b = $("btnContinue"); b.style.display = "";
          b.textContent = TEXT.restartButton;
          b.onclick = () => { dist = 0; sIndex = 0; mode = "ride"; yaw = 0; pitch = 0; hideContinue(); b.textContent = TEXT.continueButton; b.onclick = () => { if (mode === "stop") { mode = "ride"; hideContinue(); } }; setGuide(TEXT.introCard[eraKey]); };
        }
      }

      // 카메라 배치
      const at = rail.at(dist);
      const eye = new T.Vector3(at.pos[0], at.pos[1] + 0.15, at.pos[2]);
      const fwd = new T.Vector3(at.tan[0], at.tan[1], at.tan[2]).normalize();
      // 기본 전방 + 자유 시선(yaw/pitch)
      const base = Math.atan2(fwd.x, fwd.z);
      const ry = base + yaw;
      const dirv = new T.Vector3(Math.sin(ry) * Math.cos(pitch), Math.sin(pitch) + fwd.y * 0.4, Math.cos(ry) * Math.cos(pitch));
      camera.position.copy(eye);
      camera.lookAt(eye.clone().add(dirv));

      // 진행률 표시
      $("timeLeft").textContent = Math.round((dist / rail.total) * 100) + "%";

      // 생물 애니메이션
      for (const b of built) animateSpecies(b, t);

      // 부유물 살짝 흐르게
      snow.rotation.y = t * 0.005;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); }
    });
    clock.getDelta(); raf = requestAnimationFrame(frame);

    function wireFallbackButtons() {
      ["btnContinue", "btnPause", "btnRestart", "btnHands"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "none"; });
    }
  }

  const _dummy = new T.Object3D();
  function animateSpecies(b, t) {
    if (b.anim === "still") return;
    if (b.kind === "group") {
      b.node.children.forEach(ch => {
        const it = ch.userData.it; if (!it) return;
        ch.position.y = it.base.y + Math.sin(t * it.speed + it.phase) * 0.25;
        ch.rotation.y = it.yaw + Math.sin(t * it.speed * 0.5 + it.phase) * 0.2;
      });
      return;
    }
    const m = b.mesh;
    b.insts.forEach((it, k) => {
      _dummy.position.copy(it.base);
      let ry = it.yaw, sy = it.scale;
      if (b.anim === "swim") {
        _dummy.position.x += Math.sin(t * it.speed + it.phase) * 0.4;
        _dummy.position.y += Math.sin(t * it.speed * 0.8 + it.phase) * 0.18;
        ry = it.yaw + Math.sin(t * it.speed * 0.6 + it.phase) * 0.3;
      } else if (b.anim === "jelly") {
        const pulse = 1 + Math.sin(t * 1.6 + it.phase) * 0.12;
        _dummy.position.y += Math.sin(t * 0.6 + it.phase) * 0.3;
        _dummy.scale.set(sy * pulse, sy * (2 - pulse), sy * pulse); _dummy.rotation.set(0, ry, 0); _dummy.updateMatrix(); m.setMatrixAt(k, _dummy.matrix); return;
      } else if (b.anim === "sway") {
        _dummy.rotation.set(Math.sin(t * 0.8 + it.phase) * 0.25, ry, Math.cos(t * 0.6 + it.phase) * 0.15);
        _dummy.scale.setScalar(sy); _dummy.updateMatrix(); m.setMatrixAt(k, _dummy.matrix); return;
      }
      _dummy.rotation.set(0, ry, 0);
      _dummy.scale.setScalar(sy);
      _dummy.updateMatrix();
      m.setMatrixAt(k, _dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }

  function addShoreSilhouettes(scene, env, eraKey) {
    // 수면 위 먼 곳에 낮은 실루엣 무리. 하늘엔 아무것도 두지 않는다(M3).
    const grp = new T.Group();
    const mat = new T.MeshBasicMaterial({ color: 0x10202a, fog: true });
    const rng = makeRng(321 + (eraKey === "mesozoic" ? 9 : 3));
    for (let i = 0; i < 7; i++) {
      let g;
      if (eraKey === "paleozoic") { g = new T.ConeGeometry(0.6, 2.2 + rng() * 1.5, 6); } // 양치식물 실루엣
      else { g = new T.BoxGeometry(1.4 + rng(), 1.6 + rng() * 1.2, 0.6); } // 공룡 몸통 실루엣(단순)
      const m = new T.Mesh(g, mat);
      m.position.set(20 + i * 12 + rng() * 6, 1.2, -22 - rng() * 6);
      grp.add(m);
    }
    scene.add(grp);
  }

  function buildRig(camera) {
    // 1인칭 라이드 손잡이 바 + 두 손. 시야를 최소로 가리도록 작고 낮게 둔다.
    const grp = new T.Group();
    const metal = new T.MeshStandardMaterial({ color: 0x262c33, roughness: 0.3, metalness: 0.92, fog: false });
    const skin = new T.MeshStandardMaterial({ color: 0xb98d63, roughness: 0.75, metalness: 0.0, fog: false });
    const sleeve = new T.MeshStandardMaterial({ color: 0x6b4f2c, roughness: 0.9, metalness: 0.0, fog: false });
    const BAR = -0.50, Z = -0.62;
    // 손잡이 바
    const bar = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.92, 16), metal);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, BAR, Z); grp.add(bar);
    for (const s of [-1, 1]) {
      const arm = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.34, 12), metal);
      arm.position.set(s * 0.42, BAR - 0.16, Z + 0.02); arm.rotation.x = 0.25; grp.add(arm);
    }
    // 손 — 손등(작은 타원) + 손가락 4개
    for (const s of [-1, 1]) {
      const back = new T.Mesh(new T.SphereGeometry(0.05, 12, 9), skin);
      back.scale.set(1.5, 0.7, 1.15); back.position.set(s * 0.17, BAR + 0.035, Z + 0.015); grp.add(back);
      for (let f = 0; f < 4; f++) {
        const fing = new T.Mesh(new T.CapsuleGeometry(0.017, 0.05, 3, 6), skin);
        fing.rotation.x = Math.PI / 2;
        fing.position.set(s * 0.17 + (f - 1.5) * 0.032, BAR + 0.01, Z + 0.075);
        grp.add(fing);
      }
      const cuff = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.22, 12), sleeve);
      cuff.position.set(s * 0.2, BAR - 0.16, Z - 0.13); cuff.rotation.x = 1.05; grp.add(cuff);
    }
    grp.traverse(o => { o.renderOrder = 12; });
    camera.add(grp);
    return { group: grp };
  }

  return { start: start, GEO: GEO };
})();
