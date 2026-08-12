/* 토리첼리 모의실험의 계산 단일 원천. */
(function exposeEngine(root) {
  "use strict";

  const ENGINE = Object.freeze({
    // mercury 값은 0 ℃ 정의값 기준이다.
    RHO: Object.freeze({ mercury: 13595.1, water: 998.2 }),
    G: 9.80665,
    ATM: 101325,
    MMHG_REF: 760,
    JT_L0: 100,
    TUBE_LENGTH: Object.freeze({ mercury: 1, water: 12 }),
    MERCURY_VAPOR_PRESSURE_PA: 0.16,
    // h = P / (rho * g). This relationship is intentionally not displayed to learners.
    height(pressurePa, liquid) {
      const density = this.RHO[liquid];
      if (!Number.isFinite(pressurePa) || !Number.isFinite(density) || pressurePa < 0) return NaN;
      return pressurePa / (density * this.G);
    },
    jtube(deltaHmm) {
      if (!Number.isFinite(deltaHmm) || deltaHmm < 0) return NaN;
      return this.MMHG_REF / (this.MMHG_REF + deltaHmm);
    },
    jtubeFromAdd(addedMm, initialLengthMm) {
      const length0 = initialLengthMm === undefined ? this.JT_L0 : initialLengthMm;
      if (!Number.isFinite(addedMm) || !Number.isFinite(length0) || addedMm < 0 || length0 <= 0) {
        return { dh: NaN, L: NaN, closedRise: NaN, openRise: NaN };
      }
      let low = 0;
      let high = addedMm;
      for (let iteration = 0; iteration < 80; iteration += 1) {
        const middle = (low + high) / 2;
        const predictedAdded = middle + (2 * length0 * middle) / (this.MMHG_REF + middle);
        if (predictedAdded > addedMm) high = middle;
        else low = middle;
      }
      const dh = (low + high) / 2;
      const L = length0 * this.jtube(dh);
      const closedRise = length0 - L;
      return { dh, L, closedRise, openRise: dh + closedRise };
    },
  });
  root.TORRICELLI_ENGINE = ENGINE;
  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
})(typeof globalThis !== "undefined" ? globalThis : this);

(function mountSimulation(root) {
  "use strict";
  if (typeof document === "undefined") return;

  const ENGINE = root.TORRICELLI_ENGINE;
  const query = new URLSearchParams(root.location.search);
  const assetPreview = query.get("asset");
  if (assetPreview) document.body.classList.add("asset-preview");
  const $ = (id) => document.getElementById(id);
  const dom = {
    stage: $("sceneStage"), canvas: $("sceneCanvas"), fallback: $("fallbackPanel"), flat: $("fallbackCanvas"),
    tabBarometer: $("tabBarometer"), tabJtube: $("tabJtube"), barometerControls: $("barometerControls"), jtubeControls: $("jtubeControls"),
    controlTitle: $("controlTitle"), atmRange: $("atmRange"), atmNow: $("atmNow"), mercuryButton: $("mercuryButton"), waterButton: $("waterButton"), liquidNow: $("liquidNow"), waterNote: $("waterNote"),
    standButton: $("standButton"), cameraReset: $("cameraReset"), cameraResetJ: $("cameraResetJ"), addRange: $("addRange"), addNow: $("addNow"), addMercury: $("addMercury"), resetJtube: $("resetJtube"),
    heightValue: $("heightValue"), heightUnit: $("heightUnit"), heightLabel: $("heightLabel"), conditionReadout: $("conditionReadout"), conversionReadout: $("conversionReadout"),
    barometerReadouts: $("barometerReadouts"), jtubeReadouts: $("jtubeReadouts"), dhValue: $("dhValue"), deltaLabel: $("deltaLabel"), gasPressureValue: $("gasPressureValue"), gasLengthReadout: $("gasLengthReadout"), moleculeReadout: $("moleculeReadout"),
    guideCurrent: $("guideCurrent"), qualityButton: $("qualityButton"), moleculeToggle: $("moleculeToggle"), moleculeCaption: $("moleculeCaption"), directionToggle: $("directionToggle"), directionBadge: $("directionBadge"), tubeWarning: $("tubeWarning"),
    airToggle: $("airToggle"), airToggleJ: $("airToggleJ"),
  };
  if (!dom.canvas || !dom.stage) return;

  const state = { scene: "barometer", liquid: "mercury", atmosphere: 1, added: 0, standing: 1, standingAt: 0, quality: "high", showAir: false, yaw: 0.58, pitch: 0.25, zoom: 1 };
  const MOTION = Object.freeze({ STAND_MS: 6500, CAMERA_MS: 520 });
  const reducedMotion = root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer = null;
  let scene = null;
  let camera = null;
  let world = null;
  let visuals = {};
  let rafId = null;
  let lastTime = 0;
  let cameraTween = null;
  let dragging = null;
  let useFallback = false;
  let jtubePath = null;   // B-3 중심선 CurvePath — 패키지 C 판정기가 «이 객체 그대로» 재사용한다(§5 금지 11-d)

  const cssValue = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const liquidName = () => state.liquid === "mercury" ? "수은" : "물";
  const barometerHeight = () => ENGINE.height(ENGINE.ATM * state.atmosphere, state.liquid);
  const setHidden = (element, hidden) => element.classList.toggle("is-hidden", hidden);
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);

  function currentView() {
    if (assetPreview === "dish" || assetPreview === "mercury") return { target: [0, 0.48, 0], distance: 4.8 };
    if (assetPreview) return { target: [0, 2.2, 0], distance: 6.1 };
    if (state.scene === "jtube") return { target: [-0.30, 3.42, 0], distance: 10.7 };   // B-3 topR 연장 + 구도 재조정(관을 무대 중앙·세로 가득)
    if (state.liquid === "water") return { target: [0, 5.6, 0], distance: 17.2 };
    return { target: [0, 2.75, 0], distance: 10.2 };   // B-4 반구 마감(관 상단 5.86)이 프레임에 들어오도록
  }
  function orbitPosition() {
    const view = currentView();
    const distance = view.distance * state.zoom;
    const horizontal = Math.cos(state.pitch) * distance;
    return new root.THREE.Vector3(Math.sin(state.yaw) * horizontal, view.target[1] + Math.sin(state.pitch) * distance, Math.cos(state.yaw) * horizontal);
  }
  function placeCamera(animate) {
    if (!camera) return;
    const next = orbitPosition();
    const view = currentView();
    const target = new root.THREE.Vector3(view.target[0], view.target[1], view.target[2]);
    if (animate && !reducedMotion) {
      cameraTween = { started: performance.now(), from: camera.position.clone(), to: next, fromTarget: camera.userData.lookAt ? camera.userData.lookAt.clone() : target.clone(), toTarget: target };
    } else {
      camera.position.copy(next);
      camera.userData.lookAt = target;
      camera.lookAt(target);
    }
  }
  function resetCamera() {
    state.yaw = 0.58;
    state.pitch = 0.25;
    state.zoom = 1;
    placeCamera(true);
  }

  /* C-4 모양 채널 — 대기 입자는 «빈 고리»다. 고정 TorusGeometry는 카메라를 돌리면 선분으로 보여
     각도 의존 표지가 되므로(2차 P-검토 N-6), 절차적 canvas 고리를 Sprite 텍스처로 써서
     «항상 화면을 정면으로» 보게 한다. 외부 이미지 파일을 쓰지 않는다(§5 금지 13). */
  let airRingTexture = null;
  function getAirRingTexture() {
    if (airRingTexture) return airRingTexture;
    const source = document.createElement("canvas");
    source.width = 64; source.height = 64;
    const paint = source.getContext("2d");
    if (!paint) return null;
    paint.clearRect(0, 0, 64, 64);
    paint.strokeStyle = "rgba(22,28,32,0.55)"; paint.lineWidth = 14;   // 어떤 배경에서도 고리 «가장자리»가 살아남게
    paint.beginPath(); paint.arc(32, 32, 22, 0, Math.PI * 2); paint.stroke();
    paint.strokeStyle = "#ffffff"; paint.lineWidth = 8;                // 본체는 흰색 → SpriteMaterial.color로 착색
    paint.beginPath(); paint.arc(32, 32, 22, 0, Math.PI * 2); paint.stroke();
    airRingTexture = new root.THREE.CanvasTexture(source);
    return airRingTexture;
  }
  function makeMaterials() {
    const THREE = root.THREE;
    return {
      // 수은은 두 장면이 «같은» PBR 재질을 쓴다(합의문 ③ · 완료 기준 ④). MeshBasicMaterial 금지.
      mercury: new THREE.MeshPhysicalMaterial({ color: "#7f8c95", metalness: 0.92, roughness: 0.19, envMapIntensity: 0.92, side: THREE.DoubleSide }),
      // 액면·액주의 세로 하이라이트 «장식» 판. 본체 재질이 아니다(§6 S-⑥ 변수명 구분).
      mercurySheen: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      // 액면 경계 표시용 정적 링. mercurySheen 계열 장식이며 본체 재질이 아니다(§6 S-⑥ 이름으로 구분).
      mercurySheenRing: new THREE.MeshBasicMaterial({ color: "#f4f9fc", transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide }),
      water: new THREE.MeshPhysicalMaterial({ color: "#2f8fc1", metalness: 0, roughness: 0.12, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
      glass: assetPreview
        ? new THREE.MeshStandardMaterial({ color: "#478aab", metalness: 0.1, roughness: 0.24, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
        : new THREE.MeshPhysicalMaterial({ color: "#a6dded", metalness: 0, roughness: state.quality === "high" ? 0.12 : 0.22, transparent: true, opacity: 0.34, side: THREE.FrontSide, depthWrite: false, envMapIntensity: 1.1 }),
      glassInner: new THREE.MeshPhysicalMaterial({ color: "#3f7893", metalness: 0, roughness: 0.24, transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false }),
      glassEdge: new THREE.MeshStandardMaterial({ color: "#3d778f", metalness: 0.08, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false }),
      glassSilhouette: new THREE.MeshBasicMaterial({ color: "#4d8ba5", transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false }),
      // 매뉴얼 2부 §5 — 밝은 무대의 «유리 하이라이트는 흰색이 아니라 옅은 청색» rgba(160,200,228,0.75)
      glassHighlight: new THREE.MeshBasicMaterial({ color: "#a0c8e4", transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
      ceramic: new THREE.MeshStandardMaterial({ color: assetPreview ? "#c8bda9" : "#e3e0d8", roughness: 0.5 }),
      ceramicEdge: new THREE.MeshStandardMaterial({ color: "#a8b2b5", metalness: 0.05, roughness: 0.55 }),
      stand: new THREE.MeshStandardMaterial({ color: "#26343c", metalness: 0.7, roughness: 0.32 }),
      wood: new THREE.MeshStandardMaterial({ color: "#bd895f", roughness: 0.72 }),
      gas: new THREE.MeshStandardMaterial({ color: "#2774a5", roughness: 0.26, transparent: true, opacity: 0.88 }),
      // 갇힌 기체 «영역» 표시용 옅은 통. 수은·유리 본체 재질이 아니다(§6 S-⑥).
      gasColumnTint: new THREE.MeshBasicMaterial({ color: "#a7d4ee", transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
      air: new THREE.MeshStandardMaterial({ color: "#5481b4", roughness: 0.38 }),
      /* 대기 입자 — 갇힌 기체(#2774a5 실구)와 «색 + 모양» 두 채널로 구분한다(C-4 · 매뉴얼 P6-C3).
         색은 shared/style.css 토큰 --d-amber를 읽어 쓴다(P6-C1). 색각 ΔE76 최악값 실측 77.45(≥ 20). */
      airParticle: new THREE.SpriteMaterial({ map: getAirRingTexture(), color: cssValue("--d-amber", "#b45309"), transparent: true, depthWrite: false }),
      /* 액면 접촉 «상시» 표지 — 밝기가 변하지 않는다. 파문·점멸 섬광이 아니다(§5 금지 11-c). */
      airContact: new THREE.MeshBasicMaterial({ color: cssValue("--d-amber", "#b45309"), transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
      ruler: new THREE.MeshStandardMaterial({ color: "#e8eceb", metalness: 0.22, roughness: 0.38 }),
      rulerMark: new THREE.MeshBasicMaterial({ color: "#354c57" }),
    };
  }
  function cast(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  function addCylinder(parent, radius, height, material, x, y, z, segments) {
    const mesh = cast(new root.THREE.Mesh(new root.THREE.CylinderGeometry(radius, radius, height, segments || 28), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function addColumn(parent, radius, material, x, baseY, z) {
    const mesh = cast(new root.THREE.Mesh(new root.THREE.CylinderGeometry(radius, radius, 1, 32), material));
    mesh.position.set(x, baseY, z); parent.add(mesh); return mesh;
  }
  function setColumn(mesh, baseY, height) { mesh.scale.y = Math.max(height, 0.001); mesh.position.y = baseY + height / 2; }
  function addGlassCylinder(parent, radius, height, materials, x, y, z, closedTop) {
    const THREE = root.THREE;
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40, 1, true), materials.glass);
    outer.position.set(x, y, z); outer.renderOrder = 4; parent.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, height * 0.985, 40, 1, true), materials.glassInner);
    inner.position.set(x, y, z); inner.renderOrder = 3; parent.add(inner);
    [-1, 1].forEach((side) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.91, radius * 0.09, 10, 40), materials.glassEdge);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y + side * height / 2, z); ring.renderOrder = 5; parent.add(ring);
    });
    const shine = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.12, height * 0.9, 0.012), materials.glassHighlight);
    shine.position.set(x - radius * 0.43, y, z + radius * 0.92); shine.renderOrder = 6; parent.add(shine);
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.07, height * 0.96, radius * 0.035), materials.glassEdge);
      rail.position.set(x + Math.sin(angle) * radius * 0.98, y, z + Math.cos(angle) * radius * 0.98); rail.renderOrder = 5; parent.add(rail);
    });
    if (closedTop) {
      // 기준물 전사 — 관 상단은 «둥근 반구형 마감»이다(B-4 표 3행).
      const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), materials.glass);
      dome.position.set(x, y + height / 2, z); dome.renderOrder = 4; parent.add(dome);
      const domeInner = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.82, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), materials.glassInner);
      domeInner.position.set(x, y + height / 2, z); domeInner.renderOrder = 3; parent.add(domeInner);
    }
    return outer;
  }
  function addTubeGlass(parent, curve, radius, materials) {
    const THREE = root.THREE;
    const outer = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius, 28, false), materials.glass);
    outer.renderOrder = 4; parent.add(outer);
    const inner = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius * 0.8, 28, false), materials.glassInner);
    inner.renderOrder = 3; parent.add(inner);
    const silhouette = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius * 1.05, 28, false), materials.glassSilhouette);
    silhouette.renderOrder = 2; parent.add(silhouette);
    return outer;
  }
  function addMeniscus(parent, radius, material, x, y, z) {
    const mesh = cast(new root.THREE.Mesh(new root.THREE.SphereGeometry(radius, 32, 14), material));
    mesh.scale.y = 0.18; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function addRuler(parent, materials, height) {
    const THREE = root.THREE;
    const ruler = cast(new THREE.Mesh(new THREE.BoxGeometry(0.18, height, 0.05), materials.ruler));
    ruler.position.set(0.48, 0.31 + height / 2, -0.26); parent.add(ruler);
    const tickCount = 20;
    for (let index = 0; index <= tickCount; index += 1) {
      const major = index % 5 === 0;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(major ? 0.16 : 0.095, 0.012, 0.012), materials.rulerMark);
      tick.position.set(0.48 - (major ? 0 : 0.03), 0.31 + height * index / tickCount, -0.225); parent.add(tick);
    }
  }
  function addBench(parent, materials) {
    const top = cast(new root.THREE.Mesh(new root.THREE.BoxGeometry(11, 0.3, 5.4), materials.wood));
    top.position.y = -0.15; parent.add(top);
    const wall = new root.THREE.Mesh(new root.THREE.PlaneGeometry(14, 9), new root.THREE.MeshStandardMaterial({ color: "#d8e2e1", roughness: 0.94 }));
    wall.position.set(0, 4.4, -2.72); parent.add(wall);
  }
  function addHuman(parent) {
    const silhouette = new root.THREE.Group();
    const clothing = new root.THREE.MeshStandardMaterial({ color: "#456979", roughness: 0.72 });
    const body = cast(new root.THREE.Mesh(new root.THREE.CapsuleGeometry(0.18, 0.62, 8, 16), clothing));
    body.position.y = 0.95; silhouette.add(body);
    [-1, 1].forEach((side) => {
      const arm = cast(new root.THREE.Mesh(new root.THREE.CylinderGeometry(0.055, 0.055, 0.62, 12), clothing));
      arm.position.set(side * 0.23, 0.94, 0); arm.rotation.z = side * 0.22; silhouette.add(arm);
      const leg = cast(new root.THREE.Mesh(new root.THREE.CylinderGeometry(0.065, 0.07, 0.62, 12), clothing));
      leg.position.set(side * 0.09, 0.32, 0); leg.rotation.z = -side * 0.07; silhouette.add(leg);
    });
    const head = cast(new root.THREE.Mesh(new root.THREE.SphereGeometry(0.18, 18, 12), new root.THREE.MeshStandardMaterial({ color: "#d5a889", roughness: 0.75 })));
    head.position.y = 1.56; silhouette.add(head);
    silhouette.position.set(-2.4, 0.02, 0.32); parent.add(silhouette);
  }
  function clearWorld() {
    if (!world) return;
    scene.remove(world);
    // ⚠ Sprite는 three r147에서 «모듈 공용» geometry를 쓴다 — dispose하면 다른 Sprite까지 함께 무너진다.
    world.traverse((child) => { if (child.geometry && !child.isSprite) child.geometry.dispose(); if (child.material) child.material.dispose(); });
    visuals = {};
  }
  function buildBarometer() {
    const THREE = root.THREE;
    const materials = makeMaterials();
    const group = new THREE.Group();
    addBench(group, materials);
    const baseY = 0.31;
    const fluid = state.liquid === "mercury" ? materials.mercury : materials.water;
    // 사다리꼴 단면(바깥벽이 벌어지는 대접) 한 바퀴 — 안쪽 바닥은 접시 액체 아래 0.30에 둔다.
    const bowlProfile = [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(2.04, 0.00),
      new THREE.Vector2(2.18, 0.56), new THREE.Vector2(2.06, 0.56),
      new THREE.Vector2(1.92, 0.30), new THREE.Vector2(0.00, 0.30),
      new THREE.Vector2(0.00, 0.00),
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 64), materials.glass);
    bowl.position.y = 0.006; bowl.renderOrder = 4; bowl.receiveShadow = true; group.add(bowl);
    const bowlShell = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 64), materials.glassSilhouette);
    bowlShell.position.y = 0.012; bowlShell.scale.set(1.025, 1, 1.025); bowlShell.renderOrder = 2; group.add(bowlShell);
    const dishLiquid = addCylinder(group, 1.86, 0.065, fluid, 0, baseY + 0.03, 0, 64);
    const fluidEdge = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.055, 12, 64), fluid);
    fluidEdge.rotation.x = Math.PI / 2; fluidEdge.position.y = baseY + 0.072; group.add(fluidEdge);
    // 두꺼운 테두리 링 — 같은 유리 계열에 «약간 높은 불투명도»(glassEdge 0.8)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.13, 0.075, 16, 64), materials.glassEdge);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.56; rim.renderOrder = 5; group.add(rim);
    // B-4 ⑤ 접시 액면의 밝은 은색 «사선» 광택 2장
    [[-0.55, 0.62, 0.9], [0.62, -0.35, 0.6]].forEach(([sx, sz, len]) => {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.5 * len), materials.mercurySheen);
      streak.rotation.x = -Math.PI / 2; streak.rotation.z = Math.atan2(sz, sx);
      streak.position.set(sx * 0.72, baseY + 0.066, sz * 0.72); streak.renderOrder = 6; group.add(streak);
    });
    const tubeHeight = state.liquid === "water" ? 11.4 : 5.55;
    const tubeRadius = 0.19;
    addGlassCylinder(group, tubeRadius, tubeHeight, materials, 0, baseY + tubeHeight / 2, 0, true);
    addRuler(group, materials, tubeHeight * 0.94);
    const standHeight = Math.max(5.4, tubeHeight * 0.82);
    const standX = -1.82;
    const standZ = -0.58;
    const clampBase = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.14, 36), materials.stand));
    clampBase.position.set(standX, 0.07, standZ); group.add(clampBase);
    addCylinder(group, 0.075, standHeight, materials.stand, standX, standHeight / 2, standZ, 20);
    const clampY = Math.min(tubeHeight - 0.35, 4.08);
    const arm = cast(new THREE.Mesh(new THREE.BoxGeometry(Math.abs(standX) - 0.18, 0.09, 0.09), materials.stand));
    arm.position.set(standX / 2 - 0.08, clampY, standZ); group.add(arm);
    const clampRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 12, 32), materials.stand);
    clampRing.rotation.x = Math.PI / 2; clampRing.position.set(0, clampY, 0); group.add(clampRing);
    [-1, 1].forEach((side) => {
      const jaw = cast(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.12), materials.stand));
      jaw.position.set(side * 0.23, clampY, -0.02); group.add(jaw);
    });
    if (state.liquid === "water") addHuman(group);
    const column = addColumn(group, 0.132, fluid, 0, baseY, 0);
    const meniscus = addMeniscus(group, 0.145, fluid, 0, baseY, 0);
    // B-2 세로 하이라이트 띠 — 폭 radius×0.18. 액주와 함께 스케일한다.
    const meniscusRing = new THREE.Mesh(new THREE.TorusGeometry(0.145 * 0.97, 0.014, 8, 36), materials.mercurySheenRing);
    meniscusRing.rotation.x = Math.PI / 2; meniscusRing.position.set(0, baseY, 0); meniscusRing.renderOrder = 5; group.add(meniscusRing);
    const columnSheen = new THREE.Mesh(new THREE.BoxGeometry(0.132 * 0.18, 1, 0.01), materials.mercurySheen);
    columnSheen.position.set(-0.132 * 0.34, baseY, 0.132 * 1.06); columnSheen.renderOrder = 5; group.add(columnSheen);
    const arrows = [];
    for (let index = 0; index < 5; index += 1) {
      const arrow = new THREE.Group();
      const shaft = addCylinder(arrow, 0.026, 0.46, materials.air, 0, 0, 0, 12);
      const tip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 16), materials.air));
      tip.position.y = -0.32; tip.rotation.x = Math.PI; arrow.add(tip);
      arrow.position.set(-1.5 + index * 0.75, 3.15 + (index % 2) * 0.18, -0.26); group.add(arrow); arrows.push(arrow);
      shaft.castShadow = true;
    }
    /* ★ 접시 액체의 상·하한을 «접시 액체 메시»에서 유도한다(§3 C-1 · §6 O-⑥ · 3차 P-검토 N-6).
       매직 넘버로 두면 접시 형상이 바뀔 때 조용히 틀어진다. 관 반지름도 같은 값을 재사용한다(F-1). */
    const dishParams = dishLiquid.geometry.parameters;
    const dish = {
      radius: dishParams.radiusTop,
      top: dishLiquid.position.y + dishParams.height / 2,
      bottom: dishLiquid.position.y - dishParams.height / 2,
    };
    visuals = {
      type: "barometer", group, baseY, tubeHeight, column, meniscus, meniscusRing, columnSheen, arrows, currentHeight: tubeHeight,
      dish, dishLiquid, tubeOuter: tubeRadius, tubeInner: tubeRadius * 0.82,
    };
    scene.add(group); world = group; updateBarometerVisual();
    buildAirParticles(group, materials);
  }
  function updateBarometerVisual() {
    if (visuals.type !== "barometer") return;
    const height = barometerHeight();
    const tubeLength = ENGINE.TUBE_LENGTH[state.liquid];
    const targetHeight = Math.min(visuals.tubeHeight, visuals.tubeHeight * height / tubeLength);
    const currentHeight = visuals.tubeHeight + (targetHeight - visuals.tubeHeight) * state.standing;
    setColumn(visuals.column, visuals.baseY, currentHeight);
    visuals.meniscus.position.y = visuals.baseY + currentHeight;
    if (visuals.meniscusRing) visuals.meniscusRing.position.y = visuals.baseY + currentHeight;
    if (visuals.columnSheen) {
      visuals.columnSheen.visible = state.liquid === "mercury";
      setColumn(visuals.columnSheen, visuals.baseY, Math.max(0.001, currentHeight * 0.95));
    }
    visuals.currentHeight = currentHeight;
    const scale = 0.78 + state.atmosphere * 0.34;
    visuals.arrows.forEach((arrow) => { arrow.scale.y = scale; });
  }
  /* ── B-3. J자관 형상 상수 ────────────────────────────────────────────
     ⚠ CatmullRomCurve3 금지(§5 금지 11-d). 중심선은 LineCurve3 3 + QuadraticBezierCurve3 엘보 2의
       CurvePath다 — 직선 팔 구간의 축 이탈이 «정확히 0»이고, 패키지 C의 판정기가 이 «같은 객체»를
       표본화해 쓴다(근사 금지). R은 «엘보 접선 폭»이지 곡률반지름이 아니다(실제 최소 곡률반지름 0.4384). */
  const JT = Object.freeze({
    s: 0.018,          // 씬단위/mm — 액체·기체·Δh가 전부 이 축척 하나를 쓴다
    yB: 0.18,          // 바닥 수평부 중심 y
    R: 0.62,           // 엘보 접선 폭
    leftX: -1.45, rightX: 1.35,
    topL: 5.25,        // 닫힌 팔 상단
    topR: 6.80,        // 열린 팔 상단
    c: 0.12,           // 닫힌 팔 상단 여유(마개 두께 포함)
    capT: 0.055,       // 마개 두께
    rOuter: 0.22, innerFactor: 0.8, rLiquid: 0.170,
  });
  const jtubeYArm = () => JT.yB + JT.R;                              // 0.80
  const jtubeY0 = () => JT.topL - JT.c - ENGINE.JT_L0 * JT.s;        // 초기 액면 — ENGINE에서 유도(F-1)
  const jtubeVec = (x, y) => new root.THREE.Vector3(x, y, 0);
  function buildJTubePath() {
    const THREE = root.THREE;
    const yArm = jtubeYArm();
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(jtubeVec(JT.leftX, JT.topL), jtubeVec(JT.leftX, yArm)));
    path.add(new THREE.QuadraticBezierCurve3(jtubeVec(JT.leftX, yArm), jtubeVec(JT.leftX, JT.yB), jtubeVec(JT.leftX + JT.R, JT.yB)));
    path.add(new THREE.LineCurve3(jtubeVec(JT.leftX + JT.R, JT.yB), jtubeVec(JT.rightX - JT.R, JT.yB)));
    path.add(new THREE.QuadraticBezierCurve3(jtubeVec(JT.rightX - JT.R, JT.yB), jtubeVec(JT.rightX, JT.yB), jtubeVec(JT.rightX, yArm)));
    path.add(new THREE.LineCurve3(jtubeVec(JT.rightX, yArm), jtubeVec(JT.rightX, JT.topR)));
    return path;
  }
  /* 액체 경로 — 원 PATH와 «같은 제어점»을 쓰고 양 끝 LineCurve3의 끝점만 액면으로 갈아 끼운다.
     새 보간 곡선을 만들지 않는다(단일 형상 원천). 액면 yC·yO는 전 조작 범위에서 항상 수직 팔 위다. */
  function buildLiquidPath(yC, yO) {
    const THREE = root.THREE;
    const yArm = jtubeYArm();
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(jtubeVec(JT.leftX, yC), jtubeVec(JT.leftX, yArm)));
    path.add(new THREE.QuadraticBezierCurve3(jtubeVec(JT.leftX, yArm), jtubeVec(JT.leftX, JT.yB), jtubeVec(JT.leftX + JT.R, JT.yB)));
    path.add(new THREE.LineCurve3(jtubeVec(JT.leftX + JT.R, JT.yB), jtubeVec(JT.rightX - JT.R, JT.yB)));
    path.add(new THREE.QuadraticBezierCurve3(jtubeVec(JT.rightX - JT.R, JT.yB), jtubeVec(JT.rightX, JT.yB), jtubeVec(JT.rightX, yArm)));
    path.add(new THREE.LineCurve3(jtubeVec(JT.rightX, yArm), jtubeVec(JT.rightX, yO)));
    return path;
  }
  // 얕은 «오목» 원반 액면. 구가 아니다. 액체와 같은 재질을 그대로 쓴다.
  function addMeniscusDisc(parent, radius, depth, material, x, y, z) {
    const THREE = root.THREE;
    const profile = [];
    const steps = 14;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      profile.push(new THREE.Vector2(radius * t, -depth * Math.cos(t * Math.PI / 2)));
    }
    const mesh = cast(new THREE.Mesh(new THREE.LatheGeometry(profile, 40), material));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function buildJTube() {
    const THREE = root.THREE;
    const materials = makeMaterials();
    const group = new THREE.Group();
    group.position.x = -0.1;
    addBench(group, materials);
    const yArm = jtubeYArm();
    const y0 = jtubeY0();
    const path = buildJTubePath();
    jtubePath = path;
    addTubeGlass(group, path, JT.rOuter, materials);
    [[JT.leftX, JT.topL], [JT.rightX, JT.topR]].forEach(([x, y]) => {
      const opening = new THREE.Mesh(new THREE.TorusGeometry(JT.rOuter * 0.91, 0.025, 10, 36), materials.glassEdge);
      opening.rotation.x = Math.PI / 2; opening.position.set(x, y, 0); opening.renderOrder = 6; group.add(opening);
    });
    // 마개: y = topL 에서 시작해 두께 capT 만큼 «위로». 판정기의 끝단 평면 배제와 같은 상수를 쓴다.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(JT.rOuter, JT.rOuter, JT.capT, 36), materials.glass);
    cap.position.set(JT.leftX, JT.topL + JT.capT / 2, 0); cap.renderOrder = 5; group.add(cap);
    // B-4 유리 세로 하이라이트 — 기압계와 같은 장치를 J자관 두 팔에도 둔다.
    [[JT.leftX, yArm, JT.topL], [JT.rightX, yArm, JT.topR]].forEach(([x, from, to]) => {
      const shine = new THREE.Mesh(new THREE.BoxGeometry(JT.rOuter * 0.12, (to - from) * 0.92, 0.012), materials.glassHighlight);
      shine.position.set(x - JT.rOuter * 0.43, (from + to) / 2, JT.rOuter * 0.92); shine.renderOrder = 6; group.add(shine);
    });
    // 액체: 하나의 이어진 TubeGeometry. 첨가량이 바뀔 때만 다시 만든다(매 프레임 재생성 금지).
    const liquid = cast(new THREE.Mesh(new THREE.TubeGeometry(buildLiquidPath(y0, y0), 180, JT.rLiquid, 24, false), materials.mercury));
    group.add(liquid);
    const leftMeniscus = addMeniscusDisc(group, JT.rLiquid, JT.rLiquid * 0.28, materials.mercury, JT.leftX, y0, 0);
    const rightMeniscus = addMeniscusDisc(group, JT.rLiquid, JT.rLiquid * 0.28, materials.mercury, JT.rightX, y0, 0);
    // 액면 «경계»를 눈으로 읽히게 하는 정적 링(밝기 불변 — 점멸·파문이 아니다)
    const meniscusRings = [JT.leftX, JT.rightX].map((x) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(JT.rLiquid * 0.97, 0.016, 8, 36), materials.mercurySheenRing);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y0, 0); ring.renderOrder = 5; group.add(ring); return ring;
    });
    // 액주 세로 하이라이트 띠 — 폭 rLiquid×0.18. 액면과 함께 스케일한다.
    const sheens = [JT.leftX, JT.rightX].map((x) => {
      const sheen = new THREE.Mesh(new THREE.BoxGeometry(JT.rLiquid * 0.18, 1, 0.01), materials.mercurySheen);
      sheen.position.set(x - JT.rLiquid * 0.34, y0, JT.rLiquid * 1.06); sheen.renderOrder = 5; group.add(sheen); return sheen;
    });
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(JT.rOuter * JT.innerFactor * 0.86, JT.rOuter * JT.innerFactor * 0.86, 1, 28, 1, true), materials.gasColumnTint);
    gasTube.position.set(JT.leftX, y0, 0); group.add(gasTube);
    const particles = [];
    for (let index = 0; index < 12; index += 1) {
      const particle = cast(new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), materials.gas));
      particle.userData = { phase: index * 0.77, row: ((index * 7) % 11) / 10, x: (((index * 5) % 5) - 2) * 0.042, z: (((index * 3) % 5) - 2) * 0.042 };
      group.add(particle); particles.push(particle);
    }
    const standX = -2.55;
    const standZ = -0.62;
    const base = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.14, 36), materials.stand)); base.position.set(standX, 0.07, standZ); group.add(base);
    addCylinder(group, 0.075, 6.4, materials.stand, standX, 3.2, standZ, 18);
    const arm = cast(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.09, 0.09), materials.stand)); arm.position.set(-2.02, 4.35, standZ); group.add(arm);
    const holder = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 12, 32), materials.stand); holder.rotation.x = Math.PI / 2; holder.position.set(JT.leftX, 4.35, 0); group.add(holder);
    const arrows = [];
    for (let index = 0; index < 3; index += 1) {
      const arrow = new THREE.Group();
      addCylinder(arrow, 0.025, 0.4, materials.air, 0, 0, 0, 12);
      const tip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 14), materials.air)); tip.position.y = -0.28; tip.rotation.x = Math.PI; arrow.add(tip);
      // topR가 6.80으로 올라가 «관 입구 위»에 두면 프레임 밖으로 나간다 — 열린 팔 옆 같은 높이에 둔다.
      arrow.position.set(JT.rightX + 0.48 + index * 0.34, JT.topR - 0.45 + (index % 2) * 0.16, 0); group.add(arrow); arrows.push(arrow);
    }
    visuals = {
      type: "jtube", group, baseY: JT.yB, leftX: JT.leftX, rightX: JT.rightX, topY: JT.topL,
      path, liquid, leftMeniscus, rightMeniscus, meniscusRings, sheens, gasTube, particles, arrows,
      liquidAdded: null, gasBase: y0, gasHeight: ENGINE.JT_L0 * JT.s,
      // ★ 판정용 polyline — «렌더되는 그 CurvePath 객체»를 그대로 표본화한 것이다(§5 금지 11-d).
      airPoly: buildClassifyPolyline(path),
    };
    scene.add(group); world = group; updateJTubeVisual(0);
    buildAirParticles(group, materials);
  }
  function buildAssetPreview(kind) {
    const THREE = root.THREE;
    const materials = makeMaterials();
    const group = new THREE.Group();
    const plinth = cast(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.25, 48), materials.ceramic));
    plinth.position.y = 0.02; group.add(plinth);
    if (kind === "glass") {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.6, 36, 1, true), materials.glass);
      tube.position.y = 2.45; group.add(tube);
      addCylinder(group, 0.292, 0.1, materials.glass, 0, 4.8, 0, 36);
    } else if (kind === "dish") {
      addCylinder(group, 1.75, 0.36, materials.ceramic, 0, 0.26, 0, 64);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.09, 16, 64), materials.ceramic); rim.rotation.x = Math.PI / 2; rim.position.y = 0.47; group.add(rim);
    } else if (kind === "mercury") {
      addCylinder(group, 1.45, 0.22, materials.mercury, 0, 0.28, 0, 64);
      const meniscus = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), materials.mercury); meniscus.scale.y = 0.1; meniscus.position.y = 0.39; group.add(meniscus);
    } else {
      // 미리보기도 «본 장면과 같은» CurvePath를 쓴다 — 형상 단일 원천(§5 금지 11-d).
      const tube = new THREE.Mesh(new THREE.TubeGeometry(buildJTubePath(), 180, JT.rOuter, 24, false), materials.glass); group.add(tube);
    }
    visuals = { type: "asset", group }; scene.add(group); world = group;
  }
  function updateJTubeVisual(now) {
    if (visuals.type !== "jtube") return;
    /* ★ 축척 일치 — 전부 ENGINE.jtubeFromAdd 반환값에서 «유도»한다(F-1 · R-⑤).
       검증표(a = 0/25/50/100/150/200)의 숫자를 코드에 상수로 박지 않는다. */
    const data = ENGINE.jtubeFromAdd(state.added, ENGINE.JT_L0);
    const y0 = jtubeY0();
    const yC = y0 + data.closedRise * JT.s;      // 닫힌 팔 액면
    const yO = y0 + data.openRise * JT.s;        // 열린 팔 액면
    const gasLen = data.L * JT.s;                // 기체 기둥 «물리값 × 축척» — 남는 공간이 아니다
    visuals.yC = yC; visuals.yO = yO;
    visuals.leftHeight = yC - visuals.baseY; visuals.rightHeight = yO - visuals.baseY;
    if (visuals.liquidAdded !== state.added) {
      const previous = visuals.liquid.geometry;
      visuals.liquid.geometry = new root.THREE.TubeGeometry(buildLiquidPath(yC, yO), 180, JT.rLiquid, 24, false);
      if (previous) previous.dispose();
      visuals.liquidAdded = state.added;
    }
    visuals.leftMeniscus.position.y = yC;
    visuals.rightMeniscus.position.y = yO;
    visuals.meniscusRings[0].position.y = yC;
    visuals.meniscusRings[1].position.y = yO;
    visuals.sheens[0].scale.y = Math.max(0.001, yC - jtubeYArm());
    visuals.sheens[0].position.y = (jtubeYArm() + yC) / 2;
    visuals.sheens[1].scale.y = Math.max(0.001, yO - jtubeYArm());
    visuals.sheens[1].position.y = (jtubeYArm() + yO) / 2;
    visuals.gasTube.scale.y = gasLen; visuals.gasTube.position.y = yC + gasLen / 2;
    visuals.gasBase = yC; visuals.gasHeight = gasLen;
    visuals.particles.forEach((particle) => {
      const dataPoint = particle.userData;
      // C-5 · §1-1 확정 21 — prefers-reduced-motion이면 갇힌 기체 12개도 «정지»한다(v1의 기존 결함 해소).
      const wobble = reducedMotion ? 0 : Math.sin(now / 700 + dataPoint.phase) * 0.018;
      particle.position.set(visuals.leftX + dataPoint.x, yC + 0.14 + dataPoint.row * Math.max(0.02, gasLen - 0.28) + wobble, dataPoint.z);
    });
  }
  /* ══ 패키지 C — 공기 입자 ═══════════════════════════════════════════════════════
     X-1 치명 게이트의 전부가 여기 있다. 대기 입자가 존재할 수 있는 곳은
     classifyPoint(p) === "atmosphere" «하나뿐»이다.
       · 장면 1 관 안 진공부 · 장면 2 닫힌 팔에는 그리지 않는다(§5 금지 11).
       · 거꾸로 장면 2 «열린 팔 관 안»에는 반드시 그린다 — 비우면 「열린 팔도 밀봉」이라는
         역방향 오개념이 된다(§5 금지 11-b · §6 J-③-b).
     ⚠ 입자끼리는 충돌시키지 않는다 — 상호작용을 두지 않아 갱신이 O(N)이다(매뉴얼 §10의 O(N²) 상한 회피).
     ⚠ 충돌 지점에 수면 파문·점멸 섬광을 만들지 않는다(§5 금지 11-c). 보이는 것은
        ⑴ 반사 운동 자체와 ⑵ 밝기가 «변하지 않는» 저휘도 상시 접촉 표지뿐이다.
     ⚠ 속력·온도·운동에너지의 수치·범례·조작 변인·상태별 속력 변화 인코딩을 붙이지 않는다(§5 금지 11-e·12). */
  const AIR = Object.freeze({
    COUNT: { high: 72, normal: 36 },      // 장면당 개수. 두 장면은 탭 전환이라 동시에 뜨지 않는다
    RADIUS: 0.030,                        // 빈 고리 반지름 (갇힌 기체 실구 0.048보다 «작다»)
    SPEED: { barometer: 1.15, jtube: 1.0 },
    MAX_RESAMPLE: 4,                      // C-2 되돌림 규칙의 재표본 상한
    DT_MAX: 0.05,
    SPAWN_TRIES: 40,
  });

  /* 판정용 polyline — B-3이 만든 «그 CurvePath 객체»를 400점으로 표본화한다.
     400보다 줄이지 않는다(표본화 오차 실측 3.502×10⁻⁴ = 내벽 0.176의 0.2%).
     직선 원기둥 근사를 새로 만들지 않는다 — v2가 그것으로 반려됐다(§5 금지 11-d). */
  function buildClassifyPolyline(path) {
    const points = path.getSpacedPoints(400);
    const segments = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const vx = b.x - a.x, vy = b.y - a.y, vz = b.z - a.z;
      segments.push({ ax: a.x, ay: a.y, az: a.z, vx, vy, vz, inv: 1 / (vx * vx + vy * vy + vz * vz || 1) });
    }
    return segments;
  }
  function distToPolyline(point, segments) {
    const pz = point.z || 0;
    let best = Infinity;
    for (let index = 0; index < segments.length; index += 1) {
      const s = segments[index];
      const wx = point.x - s.ax, wy = point.y - s.ay, wz = pz - s.az;
      let t = (wx * s.vx + wy * s.vy + wz * s.vz) * s.inv;
      if (t < 0) t = 0; else if (t > 1) t = 1;      // 축방향 클램프 — 끝단 평면은 «먼저» 배제했다
      const dx = wx - t * s.vx, dy = wy - t * s.vy, dz = wz - t * s.vz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < best) best = distance;
    }
    return best;
  }
  function classifyBarometerPoint(point) {
    const z = point.z || 0;
    const radial = Math.hypot(point.x, z);                       // 관 축은 (0, 0)
    const tubeTop = visuals.baseY + visuals.tubeHeight;
    // ★ 끝단 평면을 먼저 배제한다 — 안 그러면 관 끝에 반구 캡이 생긴다(§5 금지 11-d-b)
    if (point.y > tubeTop) return "atmosphere";
    if (radial >= visuals.tubeInner && radial <= visuals.tubeOuter && point.y >= visuals.baseY) return "glass";
    // 기둥 상단은 상수가 아니라 ENGINE.height()에서 유도된 currentHeight다(F-1)
    if (radial < visuals.tubeInner && point.y >= visuals.baseY) return point.y <= visuals.baseY + visuals.currentHeight ? "liquid" : "vacuum";
    if (radial < visuals.dish.radius && point.y >= visuals.dish.bottom && point.y <= visuals.dish.top) return "liquid";
    return "atmosphere";
  }
  function classifyJTubePoint(point) {
    const z = point.z || 0;
    const distLeft = Math.hypot(point.x - JT.leftX, z);
    const distRight = Math.hypot(point.x - JT.rightX, z);
    // ★ 끝단 평면 먼저(§5 금지 11-d-b) — 관은 y = topL(닫힘)·y = topR(열림)에서 «끝난다».
    if (point.y > JT.topL && distLeft <= distRight) return (distLeft <= JT.rOuter && point.y <= JT.topL + JT.capT) ? "glass" : "atmosphere";
    if (point.y > JT.topR) return "atmosphere";
    const distance = distToPolyline(point, visuals.airPoly);
    if (distance > JT.rOuter) return "atmosphere";
    if (distance >= JT.rOuter * JT.innerFactor) return "glass";
    if (point.y <= jtubeYArm()) return "liquid";                          // 엘보·바닥은 항상 액체로 차 있다
    if (point.x < 0) return point.y <= visuals.yC ? "liquid" : "sealedGas";
    return point.y <= visuals.yO ? "liquid" : "atmosphere";               // ★ 열린 팔 관 «안»은 대기다
  }
  /* 순수 함수 — 점 하나를 5분류 중 하나로 돌려준다. 렌더링과 검증 훅이 «같은» 이 함수를 쓴다(F-1 · C-6). */
  function classifyPoint(point) {
    if (visuals.type === "barometer") return classifyBarometerPoint(point);
    if (visuals.type === "jtube") return classifyJTubePoint(point);
    return "atmosphere";
  }

  const airTmpA = { x: 0, y: 0, z: 0 };
  const airTmpB = { x: 0, y: 0, z: 0 };
  const setPoint = (target, x, y, z) => { target.x = x; target.y = y; target.z = z; return target; };
  const copyPoint = (target, source) => setPoint(target, source.x, source.y, source.z);
  function randomizeVelocity(velocity, speed) {
    const azimuth = Math.random() * Math.PI * 2;
    const cosine = Math.random() * 2 - 1;
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    velocity.x = Math.cos(azimuth) * sine * speed;
    velocity.y = cosine * speed;
    velocity.z = Math.sin(azimuth) * sine * speed * 0.5;   // z는 얕게 — 화면 깊이로 흩어지지 않게
    return velocity;
  }
  /* 대기 쪽 면 법선의 수치 추정 — 6점 탐침. 충돌한 프레임에만 호출된다. */
  function airSurfaceNormal(point) {
    const step = 0.055;
    let nx = 0, ny = 0, nz = 0;
    for (let axis = 0; axis < 6; axis += 1) {
      const sign = axis % 2 === 0 ? 1 : -1;
      const dx = axis < 2 ? sign * step : 0;
      const dy = axis >= 2 && axis < 4 ? sign * step : 0;
      const dz = axis >= 4 ? sign * step : 0;
      if (classifyPoint(setPoint(airTmpB, point.x + dx, point.y + dy, point.z + dz)) === "atmosphere") { nx += dx; ny += dy; nz += dz; }
    }
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-6) return null;
    return { x: nx / length, y: ny / length, z: nz / length };
  }
  function reflectVelocity(velocity, normal) {
    const dot = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
    if (dot >= 0) return velocity;
    velocity.x -= 2 * dot * normal.x; velocity.y -= 2 * dot * normal.y; velocity.z -= 2 * dot * normal.z;
    return velocity;
  }
  /* 생성 영역 — 장면 1은 접시 액면 위 반구 셸, 장면 2는 열린 팔 관 내부와 관 입구 위 대기가 «연속»된 통로 + 주변 대기 */
  function makeDomeDomain(dish) {
    const rMin = dish.radius * 1.05;
    const rMax = dish.radius * 2.6;
    const floorY = dish.top;
    const ceilY = dish.top + 2.2;
    return {
      sample(out) {
        const radius = rMin + Math.random() * (rMax - rMin);
        const azimuth = Math.random() * Math.PI * 2;
        const elevation = Math.random() * Math.asin(Math.min(1, (ceilY - floorY) / radius));
        const horizontal = Math.cos(elevation) * radius;
        return setPoint(out, Math.cos(azimuth) * horizontal, floorY + Math.sin(elevation) * radius, Math.sin(azimuth) * horizontal);
      },
      confine(point, velocity) {
        if (point.y < floorY) { point.y = floorY + 0.004; if (velocity.y < 0) velocity.y = -velocity.y; }
        if (point.y > ceilY) { point.y = ceilY - 0.004; if (velocity.y > 0) velocity.y = -velocity.y; }
        const dy = point.y - floorY;
        const distance = Math.hypot(point.x, dy, point.z);
        if (distance > rMax) {
          const normal = { x: point.x / distance, y: dy / distance, z: point.z / distance };
          const scale = (rMax - 0.01) / distance;
          setPoint(point, point.x * scale, floorY + dy * scale, point.z * scale);
          const dot = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
          if (dot > 0) { velocity.x -= 2 * dot * normal.x; velocity.y -= 2 * dot * normal.y; velocity.z -= 2 * dot * normal.z; }
        }
        return point;
      },
    };
  }
  function makeColumnDomain(radius, topY) {
    const lowY = () => visuals.yO + 0.055;
    const highY = () => Math.max(lowY() + 0.03, topY);
    return {
      sample(out) {
        const low = lowY(), high = highY();
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * radius;
        return setPoint(out, JT.rightX + Math.cos(angle) * spread, low + Math.random() * (high - low), Math.sin(angle) * spread);
      },
      confine(point, velocity) {
        const low = lowY(), high = highY();
        if (point.y < low) { point.y = low + 0.004; if (velocity.y < 0) velocity.y = -velocity.y; }
        if (point.y > high) { point.y = high - 0.004; if (velocity.y > 0) velocity.y = -velocity.y; }
        const dx = point.x - JT.rightX;
        const dz = point.z;
        const radial = Math.hypot(dx, dz);
        if (radial > radius) {
          const nx = dx / radial, nz = dz / radial;
          const scale = (radius - 0.004) / radial;
          point.x = JT.rightX + dx * scale; point.z = dz * scale;
          const dot = velocity.x * nx + velocity.z * nz;
          if (dot > 0) { velocity.x -= 2 * dot * nx; velocity.z -= 2 * dot * nz; }
        }
        return point;
      },
    };
  }
  function makeBoxDomain(box) {
    return {
      sample(out) {
        return setPoint(out, box.x0 + Math.random() * (box.x1 - box.x0), box.y0 + Math.random() * (box.y1 - box.y0), box.z0 + Math.random() * (box.z1 - box.z0));
      },
      confine(point, velocity) {
        if (point.x < box.x0) { point.x = box.x0 + 0.004; if (velocity.x < 0) velocity.x = -velocity.x; }
        if (point.x > box.x1) { point.x = box.x1 - 0.004; if (velocity.x > 0) velocity.x = -velocity.x; }
        if (point.y < box.y0) { point.y = box.y0 + 0.004; if (velocity.y < 0) velocity.y = -velocity.y; }
        if (point.y > box.y1) { point.y = box.y1 - 0.004; if (velocity.y > 0) velocity.y = -velocity.y; }
        if (point.z < box.z0) { point.z = box.z0 + 0.004; if (velocity.z < 0) velocity.z = -velocity.z; }
        if (point.z > box.z1) { point.z = box.z1 - 0.004; if (velocity.z > 0) velocity.z = -velocity.z; }
        return point;
      },
    };
  }
  function makeAirPlan(count) {
    if (visuals.type === "barometer") {
      return [{ domain: makeDomeDomain(visuals.dish), share: count, fallback: { x: 0, y: visuals.dish.top + 1.4, z: 2.4 } }];
    }
    const inside = Math.max(4, Math.round(count * 0.11));       // 열린 팔 관 «내부»에만 머무는 몫 — J-③-b를 구조적으로 보장한다
    const channel = Math.max(4, Math.round(count * 0.14));      // 관 내부 ↔ 입구 위 대기를 «연속»으로 잇는 몫
    const armFallback = { x: JT.rightX, y: JT.topR - 0.12, z: 0 };
    return [
      { domain: makeColumnDomain(JT.rOuter * JT.innerFactor * 0.55, JT.topR - 0.05), share: inside, fallback: armFallback },
      { domain: makeColumnDomain(JT.rOuter * JT.innerFactor * 0.62, JT.topR + 0.95), share: channel, fallback: armFallback },
      { domain: makeBoxDomain({ x0: -2.45, x1: 2.45, y0: 0.30, y1: JT.topR + 0.95, z0: -0.62, z1: 0.62 }), share: count - inside - channel, fallback: { x: 0, y: 4.5, z: 0 } },
    ];
  }
  function spawnAirParticle(sprite) {
    const data = sprite.userData;
    for (let attempt = 0; attempt < AIR.SPAWN_TRIES; attempt += 1) {
      data.domain.sample(airTmpA);
      if (classifyPoint(airTmpA) === "atmosphere") { copyPoint(data.position, airTmpA); copyPoint(data.lastValid, airTmpA); randomizeVelocity(data.velocity, data.speed); sprite.position.set(airTmpA.x, airTmpA.y, airTmpA.z); return true; }
    }
    copyPoint(data.position, data.fallback); copyPoint(data.lastValid, data.fallback);
    randomizeVelocity(data.velocity, data.speed);
    sprite.position.set(data.fallback.x, data.fallback.y, data.fallback.z);
    return classifyPoint(data.position) === "atmosphere";
  }
  function seedAirParticles() {
    if (!visuals.air) return;
    visuals.air.list.forEach(spawnAirParticle);
    visuals.air.lastTime = 0;
  }
  function buildAirParticles(group, materials) {
    const THREE = root.THREE;
    if (visuals.type !== "barometer" && visuals.type !== "jtube") return;
    const count = AIR.COUNT[state.quality] || AIR.COUNT.high;
    const speed = AIR.SPEED[visuals.type];
    const plan = makeAirPlan(count);
    const list = [];
    let planIndex = 0;
    let used = 0;
    for (let index = 0; index < count; index += 1) {
      while (planIndex < plan.length - 1 && used >= plan[planIndex].share) { planIndex += 1; used = 0; }
      used += 1;
      const sprite = new THREE.Sprite(materials.airParticle);
      sprite.scale.set(AIR.RADIUS * 2, AIR.RADIUS * 2, 1);
      sprite.visible = state.showAir;
      sprite.userData = { domain: plan[planIndex].domain, fallback: plan[planIndex].fallback, speed, position: { x: 0, y: 0, z: 0 }, lastValid: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
      group.add(sprite); list.push(sprite);
    }
    // 저휘도 «상시» 접촉 표지 — 액면 위치만 따라가고 밝기는 변하지 않는다(§5 금지 11-c)
    const bands = [];
    if (visuals.type === "barometer") {
      const band = new THREE.Mesh(new THREE.RingGeometry(visuals.dish.radius * 0.86, visuals.dish.radius * 0.98, 56), materials.airContact);
      band.rotation.x = -Math.PI / 2; band.position.set(0, visuals.dish.top + 0.005, 0); band.renderOrder = 6; group.add(band); bands.push(band);
    } else {
      const band = new THREE.Mesh(new THREE.RingGeometry(JT.rLiquid * 0.34, JT.rLiquid * 0.96, 40), materials.airContact);
      band.rotation.x = -Math.PI / 2; band.position.set(JT.rightX, visuals.yO + 0.006, 0); band.renderOrder = 6; group.add(band); bands.push(band);
    }
    bands.forEach((band) => { band.visible = state.showAir; });
    visuals.air = { list, bands, lastTime: 0 };
    seedAirParticles();
  }
  /* C-2 되돌림 규칙 — 검사 순서가 규정의 핵심이다. «확인 전에 렌더하지 않는다». */
  function stepAirParticle(sprite, dt) {
    const data = sprite.userData;
    const velocity = data.velocity;
    copyPoint(airTmpA, data.position);
    airTmpA.x += velocity.x * dt; airTmpA.y += velocity.y * dt; airTmpA.z += velocity.z * dt;
    data.domain.confine(airTmpA, velocity);
    if (classifyPoint(airTmpA) === "atmosphere") {
      copyPoint(data.position, airTmpA);
      copyPoint(data.lastValid, airTmpA);                      // atmosphere → lastValid 갱신
    } else {
      copyPoint(data.position, data.lastValid);                // ⑴ lastValid로 «복귀»
      let settled = false;
      for (let attempt = 0; attempt < AIR.MAX_RESAMPLE; attempt += 1) {
        if (attempt === 0) {                                   // ⑵ 면 법선 반사
          const normal = airSurfaceNormal(airTmpA);
          if (normal) reflectVelocity(velocity, normal);
          else { velocity.x = -velocity.x; velocity.y = -velocity.y; velocity.z = -velocity.z; }
        } else {                                               // ⑶ 재표본 — 최대 4회
          randomizeVelocity(velocity, data.speed);
        }
        copyPoint(airTmpA, data.lastValid);
        airTmpA.x += velocity.x * dt; airTmpA.y += velocity.y * dt; airTmpA.z += velocity.z * dt;
        data.domain.confine(airTmpA, velocity);
        if (classifyPoint(airTmpA) === "atmosphere") { copyPoint(data.position, airTmpA); copyPoint(data.lastValid, airTmpA); settled = true; break; }
      }
      if (!settled) copyPoint(data.position, data.lastValid);  // 못 찾으면 lastValid에 «정지» — 위반 위치를 렌더하느니 멈춘다
    }
    // ★ 어느 경로든 «렌더 전»에 classifyPoint === "atmosphere"를 다시 확인한다
    if (classifyPoint(data.position) !== "atmosphere") spawnAirParticle(sprite);
    else sprite.position.set(data.position.x, data.position.y, data.position.z);
  }
  function updateAirParticles(now) {
    const air = visuals.air;
    if (!air) return;
    if (!state.showAir) return;                                // C-5: 토글 OFF면 갱신을 «완전히» 건너뛴다
    if (air.bands) air.bands.forEach((band) => { if (visuals.type === "jtube") band.position.y = visuals.yO + 0.006; });
    if (reducedMotion) return;                                 // C-5: reduced-motion이면 «정지 배치» 그대로 둔다
    const previous = air.lastTime;
    air.lastTime = now;
    const dt = previous ? Math.min(AIR.DT_MAX, Math.max(0.001, (now - previous) / 1000)) : 0.016;
    for (let index = 0; index < air.list.length; index += 1) stepAirParticle(air.list[index], dt);
  }
  function applyAirVisibility() {
    if (!visuals.air) return;
    visuals.air.list.forEach((sprite) => { sprite.visible = state.showAir; });
    if (visuals.air.bands) visuals.air.bands.forEach((band) => { band.visible = state.showAir; });
  }
  function toggleAir() {
    state.showAir = !state.showAir;
    if (state.showAir) seedAirParticles();
    applyAirVisibility();
    updateUI();
  }

  function buildWorld() { if (!scene) return; clearWorld(); if (assetPreview) buildAssetPreview(assetPreview); else if (state.scene === "barometer") buildBarometer(); else buildJTube(); }

  function drawFallback() {
    const canvas = dom.flat;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = bounds.width; const height = bounds.height;
    const line = cssValue("--line", "#e3e6ea"); const text = cssValue("--t1", "#1f2328"); const blue = cssValue("--d-blue", "#1d4ed8"); const cyan = cssValue("--d-cyan", "#0f5c8c");
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = line; ctx.lineWidth = 2;
    if (state.scene === "barometer") {
      const liquid = state.liquid === "mercury" ? "#aeb8c4" : "#2f8fc1";
      const x = width * 0.51; const base = height * 0.8; const tubeTop = height * 0.12; const tubeHeight = base - tubeTop;
      const hRatio = Math.min(1, barometerHeight() / ENGINE.TUBE_LENGTH[state.liquid]);
      ctx.strokeStyle = "#87bdd6"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, tubeTop); ctx.stroke();
      ctx.fillStyle = liquid; ctx.fillRect(x - 20, base - tubeHeight * hRatio, 40, tubeHeight * hRatio); ctx.beginPath(); ctx.ellipse(x, base + 16, width * 0.25, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blue; ctx.font = "700 14px sans-serif"; ctx.fillText("대기압", width * 0.14, height * 0.45); for (let index = 0; index < 4; index += 1) { const ax = width * (0.27 + index * 0.13); ctx.fillText("↓", ax, height * 0.5); }
      ctx.fillStyle = cyan; ctx.fillText(state.liquid === "mercury" ? `${Math.round(barometerHeight() * 1000)} mm` : `${barometerHeight().toFixed(3)} m`, x + 34, base - tubeHeight * hRatio / 2);
      ctx.fillStyle = text; ctx.fillText("진공", x + 32, tubeTop + 22);
    } else {
      const left = width * 0.34; const right = width * 0.7; const base = height * 0.78; const top = height * 0.16; const data = ENGINE.jtubeFromAdd(state.added, ENGINE.JT_L0); const scale = (base - top) / 240;
      const leftY = base - (35 + data.closedRise) * scale; const rightY = base - (35 + data.openRise) * scale;
      ctx.strokeStyle = "#87bdd6"; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, base); ctx.quadraticCurveTo(left, base + 22, left + 25, base + 22); ctx.lineTo(right - 25, base + 22); ctx.quadraticCurveTo(right, base + 22, right, base); ctx.lineTo(right, top); ctx.stroke();
      ctx.strokeStyle = "#aeb8c4"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(left, base); ctx.lineTo(left, leftY); ctx.moveTo(left, base + 10); ctx.lineTo(right, base + 10); ctx.moveTo(right, base); ctx.lineTo(right, rightY); ctx.stroke();
      ctx.fillStyle = cyan; ctx.font = "700 14px sans-serif"; ctx.fillText("P기체", left - 40, top + 22); ctx.fillStyle = blue; ctx.fillText("대기압", right - 20, top + 22); ctx.fillStyle = text; ctx.fillText(`Δh ${data.dh.toFixed(0)} mm`, right + 14, (leftY + rightY) / 2);
      for (let index = 0; index < 12; index += 1) { ctx.fillStyle = cyan; ctx.beginPath(); ctx.arc(left + ((index % 3) - 1) * 7, leftY - 14 - Math.floor(index / 3) * 22, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  /* B-1. 절차적 환경맵 — 외부 HDRI·이미지 파일을 쓰지 않는다(§5 금지 13).
     512x256 오프스크린 캔버스에 실험실 창·천장 형광등을 코드로 그려
     PMREMGenerator로 구운 뒤 scene.environment에만 넣는다. scene.background는 건드리지 않는다.
     ⚠ 이 함수는 renderer가 있을 때만 호출된다 — WebGL 폴백 경로에서는 실행되지 않는다. */
  function buildEnvironment() {
    const THREE = root.THREE;
    if (!renderer || !scene) return null;
    const source = document.createElement("canvas");
    source.width = 512; source.height = 256;
    const paint = source.getContext("2d");
    if (!paint) return null;
    const sky = paint.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#f2f7fa"); sky.addColorStop(0.47, "#b9c6cd"); sky.addColorStop(0.54, "#6d7b83"); sky.addColorStop(1, "#5d6b72");
    paint.fillStyle = sky; paint.fillRect(0, 0, 512, 256);
    paint.fillStyle = "rgba(255,255,255,0.92)";      // 천장 형광등 가로 띠
    paint.fillRect(0, 14, 512, 22);
    /* 수평 방향 대비가 «수직 원기둥의 금속감»을 만든다 — 어두운 실험실 벽 띠 위에 밝은 창을 얹는다.
       세로 방향만 있는 그라데이션은 수직 관에서 평평한 회색 한 장으로 보인다(실측 확인). */
    paint.fillStyle = "#414e56"; paint.fillRect(0, 78, 512, 96);
    paint.fillStyle = "rgba(255,255,255,0.98)";      // 실험실 창 2개
    paint.fillRect(48, 84, 104, 84);
    paint.fillRect(302, 88, 92, 76);
    paint.fillStyle = "rgba(120,150,168,0.55)";      // 창틀
    paint.fillRect(96, 84, 6, 84); paint.fillRect(344, 88, 6, 76);
    paint.fillStyle = "rgba(236,244,248,0.5)";       // 반대편 밝은 벽면 1장(반사에 방향감을 준다)
    paint.fillRect(196, 92, 40, 70);
    paint.fillStyle = "rgba(30,42,50,0.45)";         // 바닥 쪽 어두운 띠
    paint.fillRect(0, 214, 512, 42);
    const texture = new THREE.CanvasTexture(source);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const environment = pmrem.fromEquirectangular(texture).texture;
    scene.environment = environment;
    pmrem.dispose(); texture.dispose();
    return environment;
  }
  function initRenderer() {
    const forced = query.get("fallback") === "1";
    const context = !forced && root.THREE && (dom.canvas.getContext("webgl2", { antialias: true }) || dom.canvas.getContext("webgl", { antialias: true }));
    useFallback = !context;
    if (useFallback) { dom.canvas.classList.add("is-hidden"); dom.fallback.style.display = "block"; drawFallback(); return; }
    const THREE = root.THREE;
    renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, context, antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color("#c8d8dd"); scene.fog = new THREE.Fog("#c8d8dd", 18, 38);
    camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100); camera.userData.lookAt = new THREE.Vector3();
    buildEnvironment();
    // 기존 조명 4종은 삭제하지 않는다(§3 B-1). 환경맵이 들어온 만큼 세기만 낮춘다.
    scene.add(new THREE.HemisphereLight("#eff9ff", "#465b63", 0.95));
    const key = new THREE.DirectionalLight("#fff1d6", 1.55); key.position.set(6, 11, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const glassLight = new THREE.DirectionalLight("#8fd8f4", 0.55); glassLight.position.set(-5, 7, 4); scene.add(glassLight);
    const frontFill = new THREE.DirectionalLight("#ffffff", 0.62); frontFill.position.set(0, 5, 8); scene.add(frontFill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: "#c2cbd0", roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    buildWorld(); resize(); placeCamera(false);
  }
  function resize() {
    if (useFallback) { drawFallback(); return; }
    if (!renderer) return;
    const width = dom.stage.clientWidth; const height = dom.canvas.clientHeight || 560;
    if (width < 2 || height < 2) return;
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, state.quality === "high" ? 2 : 1)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function updateUI() {
    const isBarometer = state.scene === "barometer";
    dom.tabBarometer.setAttribute("aria-selected", String(isBarometer)); dom.tabJtube.setAttribute("aria-selected", String(!isBarometer));
    dom.barometerControls.hidden = !isBarometer; dom.jtubeControls.hidden = isBarometer; dom.controlTitle.textContent = isBarometer ? "장면 1 · 조절 변인" : "장면 2 · 조절 변인";
    document.querySelectorAll("[data-scene]").forEach((element) => {
      if (element.dataset.scene !== state.scene) setHidden(element, true);
      else if (element !== dom.moleculeCaption && element !== dom.directionBadge) setHidden(element, false);
    });
    setHidden(dom.barometerReadouts, !isBarometer); setHidden(dom.jtubeReadouts, isBarometer); setHidden(dom.gasLengthReadout, isBarometer); setHidden(dom.moleculeReadout, isBarometer); setHidden(dom.conditionReadout, !isBarometer); setHidden(dom.conversionReadout, !isBarometer);
    dom.atmRange.value = state.atmosphere.toFixed(2); dom.atmNow.textContent = `${state.atmosphere.toFixed(2)} atm`; dom.liquidNow.textContent = liquidName();
    dom.mercuryButton.setAttribute("aria-pressed", String(state.liquid === "mercury")); dom.waterButton.setAttribute("aria-pressed", String(state.liquid === "water")); setHidden(dom.waterNote, state.liquid !== "water");
    if (isBarometer) {
      const height = barometerHeight(); const isMercury = state.liquid === "mercury"; const value = isMercury ? Math.round(height * 1000).toString() : height.toFixed(3); const unit = isMercury ? "mm" : "m";
      dom.heightValue.textContent = value; dom.heightUnit.textContent = unit; dom.heightLabel.textContent = `${value} ${unit}`; dom.conditionReadout.innerHTML = `<strong>[대기압 ${state.atmosphere.toFixed(2)} atm · ${liquidName()}]</strong> h = ${value} ${unit}`;
      dom.tubeWarning.classList.toggle("is-hidden", height <= ENGINE.TUBE_LENGTH[state.liquid]); dom.guideCurrent.textContent = state.liquid === "water" ? "③ 물 기둥의 높이를 사람 실루엣과 비교합니다." : "① 다시 세우기를 눌러 수은 기둥이 멈추는 모습을 봅니다.";
    } else {
      const data = ENGINE.jtubeFromAdd(state.added, ENGINE.JT_L0); dom.addRange.value = String(state.added); dom.addNow.textContent = `${state.added} mm`; dom.dhValue.textContent = data.dh.toFixed(0); dom.deltaLabel.textContent = `Δh ${data.dh.toFixed(0)} mm`; dom.gasPressureValue.textContent = (ENGINE.MMHG_REF + data.dh).toFixed(0); dom.gasLengthReadout.innerHTML = `기체 기둥 길이: <strong>${data.L.toFixed(1)} mm</strong>`; dom.guideCurrent.textContent = "④ 수은을 더 넣어 높이차와 기체 기둥 길이를 비교합니다.";
    }
    dom.qualityButton.textContent = `화질: ${state.quality === "high" ? "높음" : "보통"}`; dom.qualityButton.setAttribute("aria-pressed", String(state.quality === "high"));
    // 두 장면의 버튼이 state.showAir «하나»를 공유한다 — 탭을 옮겨도 상태가 유지된다(C-3)
    if (dom.airToggle) dom.airToggle.setAttribute("aria-pressed", String(state.showAir));
    if (dom.airToggleJ) dom.airToggleJ.setAttribute("aria-pressed", String(state.showAir));
  }
  function refreshScene(rebuild) { if (rebuild && !useFallback) buildWorld(); if (useFallback) drawFallback(); updateUI(); }
  function switchScene(next) { if (state.scene === next) return; state.scene = next; state.atmosphere = 1; state.standing = 1; buildWorld(); resetCamera(); refreshScene(false); }
  function setLiquid(next) { if (state.liquid === next) return; state.liquid = next; state.standing = 1; buildWorld(); resetCamera(); refreshScene(false); }
  function setQuality() { state.quality = state.quality === "high" ? "normal" : "high"; if (renderer) { renderer.shadowMap.enabled = state.quality === "high"; resize(); } buildWorld(); refreshScene(false); }
  function startStanding() { if (state.scene !== "barometer") return; state.standing = 0; state.standingAt = performance.now(); dom.guideCurrent.textContent = "① 관 속 액체가 내려가며 기둥 위에 진공부가 남습니다."; }
  function updateSceneLabels() {
    if (!camera || !visuals.group || assetPreview) return;
    const THREE = root.THREE;
    const isBarometer = visuals.type === "barometer";
    const specs = isBarometer ? [
      [".vacuum-label", [0, visuals.baseY + visuals.tubeHeight - 0.4, 0], [20, -18]],
      [".height-label", [0, visuals.baseY + visuals.currentHeight * 0.56, 0], [28, -12]],
      [".pressure-label", [-1.5, 3.15, -0.26], [-82, 8]],
      [".column-label", [0, visuals.baseY + visuals.currentHeight * 0.72, 0], [72, -16]],
    ] : [
      [".gas-label", [visuals.leftX, visuals.gasBase + visuals.gasHeight * 0.68, 0], [-84, -14]],
      [".outside-label", [visuals.rightX, JT.topR - 0.30, 0], [24, -14]],
      [".delta-label", [(visuals.leftX + visuals.rightX) / 2, (visuals.yC + visuals.yO) / 2, 0], [12, -14]],
    ];
    const width = dom.stage.clientWidth;
    const height = dom.canvas.clientHeight;
    specs.forEach(([selector, coordinates, offset]) => {
      const element = dom.stage.querySelector(selector);
      if (!element) return;
      const point = new THREE.Vector3(coordinates[0], coordinates[1], coordinates[2]);
      visuals.group.localToWorld(point); point.project(camera);
      const rawX = (point.x * 0.5 + 0.5) * width + offset[0];
      const rawY = (-point.y * 0.5 + 0.5) * height + offset[1];
      const x = Math.max(8, Math.min(width - element.offsetWidth - 8, rawX));
      const y = Math.max(8, Math.min(height - element.offsetHeight - 8, rawY));
      element.style.left = `${x}px`; element.style.top = `${y}px`; element.classList.add("is-anchored");
    });
  }
  function animate(now) {
    if (cameraTween && camera) { const progress = Math.min(1, (now - cameraTween.started) / MOTION.CAMERA_MS); const eased = easeOut(progress); camera.position.lerpVectors(cameraTween.from, cameraTween.to, eased); camera.userData.lookAt = cameraTween.fromTarget.clone().lerp(cameraTween.toTarget, eased); camera.lookAt(camera.userData.lookAt); if (progress === 1) cameraTween = null; }
    if (state.scene === "barometer" && state.standing < 1) { state.standing = Math.min(1, (now - state.standingAt) / MOTION.STAND_MS); updateBarometerVisual(); if (state.standing === 1) { dom.guideCurrent.textContent = "① 기둥은 멈추고 관 위에는 진공부가 남았습니다."; } }
    if (state.scene === "jtube") updateJTubeVisual(now);
    updateAirParticles(now);
    updateSceneLabels();
    if (renderer) renderer.render(scene, camera);
    rafId = root.requestAnimationFrame(animate);
  }
  function startLoop() { if (!rafId) rafId = root.requestAnimationFrame(animate); }
  function stopLoop() { if (rafId) root.cancelAnimationFrame(rafId); rafId = null; lastTime = 0; }

  dom.tabBarometer.addEventListener("click", () => switchScene("barometer")); dom.tabJtube.addEventListener("click", () => switchScene("jtube"));
  dom.atmRange.addEventListener("input", (event) => { state.atmosphere = Number(event.target.value); state.standing = 1; updateBarometerVisual(); refreshScene(false); dom.guideCurrent.textContent = "② 접시 수면을 미는 대기압을 바꾸면 기둥 높이가 함께 바뀝니다."; });
  dom.mercuryButton.addEventListener("click", () => setLiquid("mercury")); dom.waterButton.addEventListener("click", () => setLiquid("water")); dom.standButton.addEventListener("click", startStanding); dom.cameraReset.addEventListener("click", resetCamera); dom.cameraResetJ.addEventListener("click", resetCamera);
  dom.addRange.addEventListener("input", (event) => { state.added = Number(event.target.value); updateJTubeVisual(performance.now()); refreshScene(false); });
  dom.addMercury.addEventListener("click", () => { state.added = Math.min(200, state.added + 25); updateJTubeVisual(performance.now()); refreshScene(false); }); dom.resetJtube.addEventListener("click", () => { state.added = 0; updateJTubeVisual(performance.now()); refreshScene(false); });
  dom.qualityButton.addEventListener("click", setQuality);
  if (dom.airToggle) dom.airToggle.addEventListener("click", toggleAir);
  if (dom.airToggleJ) dom.airToggleJ.addEventListener("click", toggleAir);
  dom.moleculeToggle.addEventListener("click", () => { const isOpen = dom.moleculeToggle.getAttribute("aria-expanded") === "true"; dom.moleculeToggle.setAttribute("aria-expanded", String(!isOpen)); setHidden(dom.moleculeCaption, isOpen); });
  dom.directionToggle.addEventListener("click", () => { const isOpen = dom.directionToggle.getAttribute("aria-expanded") === "true"; dom.directionToggle.setAttribute("aria-expanded", String(!isOpen)); setHidden(dom.directionBadge, isOpen); });
  dom.canvas.addEventListener("pointerdown", (event) => { dragging = { x: event.clientX, y: event.clientY }; dom.canvas.setPointerCapture(event.pointerId); });
  dom.canvas.addEventListener("pointermove", (event) => { if (!dragging) return; state.yaw += (event.clientX - dragging.x) * 0.008; state.pitch = Math.max(-0.1, Math.min(0.65, state.pitch + (event.clientY - dragging.y) * 0.006)); dragging = { x: event.clientX, y: event.clientY }; cameraTween = null; placeCamera(false); });
  dom.canvas.addEventListener("pointerup", () => { dragging = null; }); dom.canvas.addEventListener("wheel", (event) => { event.preventDefault(); state.zoom = Math.max(0.72, Math.min(1.42, state.zoom + event.deltaY * 0.001)); cameraTween = null; placeCamera(false); }, { passive: false });
  root.addEventListener("resize", resize); if (root.ResizeObserver) new root.ResizeObserver(resize).observe(dom.stage);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopLoop(); else startLoop(); });

  root.__TORRICELLI_GEOM__ = {
    JT,
    yArm: jtubeYArm,
    y0: jtubeY0,
    buildJTubePath,
    buildLiquidPath,
    path: () => jtubePath,
    levels: () => ({ yC: visuals.yC, yO: visuals.yO, gasLen: visuals.gasHeight }),
    // O-④ 대조용 — 렌더링·검증 훅과 «같은» classifyPoint를 그대로 노출한다(별도 구현이 아니다)
    classify: (x, y, z) => classifyPoint({ x, y, z: z || 0 }),
    // J-③-c 검사용 — 갇힌 기체 입자군은 대기 입자와 «별개 배열 · 별개 모양»이다
    gas: () => {
      const list = visuals.type === "jtube" ? visuals.particles : [];
      const first = list[0];
      const airList = visuals.air ? visuals.air.list : [];
      return {
        count: list.length,
        radius: first ? first.geometry.parameters.radius : null,
        color: first ? `#${first.material.color.getHexString()}` : null,
        shape: first ? first.geometry.type : null,
        positions: list.map((mesh) => [mesh.position.x, mesh.position.y, mesh.position.z]),
        airCount: airList.length,
        airShape: airList[0] ? airList[0].type : null,
        airScale: airList[0] ? airList[0].scale.x : null,
        airColor: airList[0] ? `#${airList[0].material.color.getHexString()}` : null,
        separateArray: airList !== list,
      };
    },
  };
  /* C-6 검증 훅 — byClass는 대기 입자를 classifyPoint 결과별로 센 것,
     violations는 "atmosphere"가 아닌 것의 합이다(X-1 치명 게이트 J-③). */
  root.__TORRICELLI_AIR__ = () => {
    const byClass = { atmosphere: 0, liquid: 0, vacuum: 0, sealedGas: 0, glass: 0 };
    const positions = [];
    const list = state.showAir && visuals.air ? visuals.air.list : [];
    for (let index = 0; index < list.length; index += 1) {
      const point = list[index].userData.position;
      const kind = classifyPoint(point);
      byClass[kind] = (byClass[kind] || 0) + 1;
      positions.push([point.x, point.y, point.z]);
    }
    return { scene: state.scene, count: list.length, byClass, violations: list.length - byClass.atmosphere, positions };
  };
  initRenderer(); updateUI(); startLoop();
})(typeof globalThis !== "undefined" ? globalThis : this);
