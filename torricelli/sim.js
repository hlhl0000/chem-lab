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
  };
  if (!dom.canvas || !dom.stage) return;

  const state = { scene: "barometer", liquid: "mercury", atmosphere: 1, added: 0, standing: 1, standingAt: 0, quality: "high", yaw: 0.58, pitch: 0.25, zoom: 1 };
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

  const cssValue = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const liquidName = () => state.liquid === "mercury" ? "수은" : "물";
  const barometerHeight = () => ENGINE.height(ENGINE.ATM * state.atmosphere, state.liquid);
  const setHidden = (element, hidden) => element.classList.toggle("is-hidden", hidden);
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);

  function currentView() {
    if (assetPreview === "dish" || assetPreview === "mercury") return { target: [0, 0.48, 0], distance: 4.8 };
    if (assetPreview) return { target: [0, 2.2, 0], distance: 6.1 };
    if (state.scene === "jtube") return { target: [0, 2.55, 0], distance: 9.4 };
    if (state.liquid === "water") return { target: [0, 5.6, 0], distance: 17.2 };
    return { target: [0, 2.55, 0], distance: 9.6 };
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

  function makeMaterials() {
    const THREE = root.THREE;
    return {
      mercury: new THREE.MeshStandardMaterial({ color: "#34444c", metalness: 0.36, roughness: 0.17 }),
      mercuryCore: new THREE.MeshBasicMaterial({ color: "#40545e" }),
      water: new THREE.MeshPhysicalMaterial({ color: "#2f8fc1", metalness: 0, roughness: 0.12, transparent: true, opacity: 0.76 }),
      glass: assetPreview
        ? new THREE.MeshStandardMaterial({ color: "#478aab", metalness: 0.1, roughness: 0.24, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
        : new THREE.MeshPhysicalMaterial({ color: "#a6dded", metalness: 0, roughness: state.quality === "high" ? 0.12 : 0.22, transparent: true, opacity: 0.5, side: THREE.FrontSide, depthWrite: false }),
      glassInner: new THREE.MeshPhysicalMaterial({ color: "#3f7893", metalness: 0, roughness: 0.24, transparent: true, opacity: 0.34, side: THREE.BackSide, depthWrite: false }),
      glassEdge: new THREE.MeshStandardMaterial({ color: "#3d778f", metalness: 0.08, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false }),
      glassSilhouette: new THREE.MeshBasicMaterial({ color: "#4d8ba5", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
      glassHighlight: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.62, depthWrite: false }),
      ceramic: new THREE.MeshStandardMaterial({ color: assetPreview ? "#c8bda9" : "#e3e0d8", roughness: 0.5 }),
      ceramicEdge: new THREE.MeshStandardMaterial({ color: "#a8b2b5", metalness: 0.05, roughness: 0.55 }),
      stand: new THREE.MeshStandardMaterial({ color: "#26343c", metalness: 0.7, roughness: 0.32 }),
      wood: new THREE.MeshStandardMaterial({ color: "#bd895f", roughness: 0.72 }),
      gas: new THREE.MeshStandardMaterial({ color: "#2774a5", roughness: 0.26, transparent: true, opacity: 0.88 }),
      air: new THREE.MeshStandardMaterial({ color: "#5481b4", roughness: 0.38 }),
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
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, radius * 0.16, 40), materials.glass);
      cap.position.set(x, y + height / 2 + radius * 0.07, z); cap.renderOrder = 4; parent.add(cap);
    }
    return outer;
  }
  function addTubeGlass(parent, curve, radius, materials) {
    const THREE = root.THREE;
    const outer = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius, 28, false), materials.glass);
    outer.renderOrder = 4; parent.add(outer);
    const inner = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius * 0.8, 28, false), materials.glassInner);
    inner.renderOrder = 3; parent.add(inner);
    const silhouette = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius * 1.035, 28, false), materials.glassSilhouette);
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
    world.traverse((child) => { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); });
    visuals = {};
  }
  function buildBarometer() {
    const THREE = root.THREE;
    const materials = makeMaterials();
    const group = new THREE.Group();
    addBench(group, materials);
    const baseY = 0.31;
    const fluid = state.liquid === "mercury" ? materials.mercury : materials.water;
    const dishBase = cast(new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.04, 0.27, 64), materials.ceramic));
    dishBase.position.y = 0.135; group.add(dishBase);
    const dishInner = cast(new THREE.Mesh(new THREE.CylinderGeometry(1.94, 1.94, 0.07, 64), materials.ceramicEdge));
    dishInner.position.y = 0.285; group.add(dishInner);
    addCylinder(group, 1.86, 0.065, fluid, 0, baseY + 0.03, 0, 64);
    const fluidEdge = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.055, 12, 64), fluid);
    fluidEdge.rotation.x = Math.PI / 2; fluidEdge.position.y = baseY + 0.072; group.add(fluidEdge);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.13, 16, 64), materials.ceramic);
    rim.rotation.x = Math.PI / 2; rim.position.y = baseY + 0.12; group.add(rim);
    const tubeHeight = state.liquid === "water" ? 11.4 : 5.55;
    addGlassCylinder(group, 0.19, tubeHeight, materials, 0, baseY + tubeHeight / 2, 0, true);
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
    const arrows = [];
    for (let index = 0; index < 5; index += 1) {
      const arrow = new THREE.Group();
      const shaft = addCylinder(arrow, 0.026, 0.46, materials.air, 0, 0, 0, 12);
      const tip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 16), materials.air));
      tip.position.y = -0.32; tip.rotation.x = Math.PI; arrow.add(tip);
      arrow.position.set(-1.5 + index * 0.75, 3.15 + (index % 2) * 0.18, -0.26); group.add(arrow); arrows.push(arrow);
      shaft.castShadow = true;
    }
    visuals = { type: "barometer", group, baseY, tubeHeight, column, meniscus, arrows, currentHeight: tubeHeight };
    scene.add(group); world = group; updateBarometerVisual();
  }
  function updateBarometerVisual() {
    if (visuals.type !== "barometer") return;
    const height = barometerHeight();
    const tubeLength = ENGINE.TUBE_LENGTH[state.liquid];
    const targetHeight = Math.min(visuals.tubeHeight, visuals.tubeHeight * height / tubeLength);
    const currentHeight = visuals.tubeHeight + (targetHeight - visuals.tubeHeight) * state.standing;
    setColumn(visuals.column, visuals.baseY, currentHeight);
    visuals.meniscus.position.y = visuals.baseY + currentHeight;
    visuals.currentHeight = currentHeight;
    const scale = 0.78 + state.atmosphere * 0.34;
    visuals.arrows.forEach((arrow) => { arrow.scale.y = scale; });
  }
  function buildJTube() {
    const THREE = root.THREE;
    const materials = makeMaterials();
    materials.glass.opacity = 0.36;
    materials.glassInner.opacity = 0.26;
    const group = new THREE.Group();
    group.position.x = -0.1;
    addBench(group, materials);
    const baseY = 0.28;
    const leftX = -1.45;
    const rightX = 1.35;
    const topY = 5.25;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(leftX, topY, 0), new THREE.Vector3(leftX, 0.88, 0), new THREE.Vector3(leftX + 0.13, 0.34, 0), new THREE.Vector3(-0.45, 0.18, 0), new THREE.Vector3(0.54, 0.18, 0), new THREE.Vector3(rightX, 0.64, 0), new THREE.Vector3(rightX, 5.8, 0),
    ]);
    addTubeGlass(group, curve, 0.22, materials);
    [leftX, rightX].forEach((x) => {
      const opening = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 36), materials.glassEdge);
      opening.rotation.x = Math.PI / 2; opening.position.set(x, x === leftX ? topY : 5.8, 0); opening.renderOrder = 6; group.add(opening);
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.055, 36), materials.glass);
    cap.position.set(leftX, topY + 0.035, 0); cap.renderOrder = 5; group.add(cap);
    const left = addColumn(group, 0.142, materials.mercuryCore, leftX, baseY, 0);
    const right = addColumn(group, 0.142, materials.mercuryCore, rightX, baseY, 0);
    const liquidCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(leftX, baseY + 0.2, 0), new THREE.Vector3(leftX + 0.18, baseY - 0.03, 0),
      new THREE.Vector3(-0.45, baseY - 0.1, 0), new THREE.Vector3(0.5, baseY - 0.1, 0),
      new THREE.Vector3(rightX - 0.18, baseY + 0.15, 0), new THREE.Vector3(rightX, baseY + 0.34, 0),
    ]);
    const connector = cast(new THREE.Mesh(new THREE.TubeGeometry(liquidCurve, 72, 0.142, 24, false), materials.mercuryCore)); group.add(connector);
    const leftMeniscus = addMeniscus(group, 0.15, materials.mercuryCore, leftX, baseY, 0);
    const rightMeniscus = addMeniscus(group, 0.15, materials.mercuryCore, rightX, baseY, 0);
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 1, 28, 1, true), new THREE.MeshBasicMaterial({ color: "#a7d4ee", transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    gasTube.position.set(leftX, baseY, 0); group.add(gasTube);
    const particles = [];
    for (let index = 0; index < 12; index += 1) {
      const particle = cast(new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), materials.gas));
      particle.userData = { phase: index * 0.77, row: ((index * 7) % 11) / 10, x: (((index * 5) % 5) - 2) * 0.042, z: (((index * 3) % 5) - 2) * 0.042 };
      group.add(particle); particles.push(particle);
    }
    const standX = -2.55;
    const standZ = -0.62;
    const base = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.14, 36), materials.stand)); base.position.set(standX, 0.07, standZ); group.add(base);
    addCylinder(group, 0.075, 5.1, materials.stand, standX, 2.55, standZ, 18);
    const arm = cast(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.09, 0.09), materials.stand)); arm.position.set(-2.02, 3.75, standZ); group.add(arm);
    const holder = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 12, 32), materials.stand); holder.rotation.x = Math.PI / 2; holder.position.set(leftX, 3.75, 0); group.add(holder);
    const arrows = [];
    for (let index = 0; index < 3; index += 1) {
      const arrow = new THREE.Group();
      addCylinder(arrow, 0.025, 0.4, materials.air, 0, 0, 0, 12);
      const tip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 14), materials.air)); tip.position.y = -0.28; tip.rotation.x = Math.PI; arrow.add(tip);
      arrow.position.set(0.76 + index * 0.34, 5.3 + (index % 2) * 0.15, 0); group.add(arrow); arrows.push(arrow);
    }
    visuals = { type: "jtube", group, baseY, leftX, rightX, topY, left, right, leftMeniscus, rightMeniscus, gasTube, particles, arrows, gasBase: baseY, gasHeight: 1 };
    scene.add(group); world = group; updateJTubeVisual(0);
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
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.25, 4.3, 0), new THREE.Vector3(-1.25, 0.85, 0), new THREE.Vector3(-1.05, 0.35, 0), new THREE.Vector3(0.55, 0.35, 0), new THREE.Vector3(1.25, 0.85, 0), new THREE.Vector3(1.25, 4.7, 0)]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.2, 24, false), materials.glass); group.add(tube);
    }
    visuals = { type: "asset", group }; scene.add(group); world = group;
  }
  function updateJTubeVisual(now) {
    if (visuals.type !== "jtube") return;
    const data = ENGINE.jtubeFromAdd(state.added, ENGINE.JT_L0);
    const scale = 0.018;
    const leftHeight = 0.34 + data.closedRise * scale;
    const rightHeight = 0.34 + data.openRise * scale;
    visuals.leftHeight = leftHeight; visuals.rightHeight = rightHeight;
    setColumn(visuals.left, visuals.baseY, leftHeight);
    setColumn(visuals.right, visuals.baseY, rightHeight);
    visuals.leftMeniscus.position.y = visuals.baseY + leftHeight;
    visuals.rightMeniscus.position.y = visuals.baseY + rightHeight;
    const gasBase = visuals.baseY + leftHeight;
    const gasHeight = Math.max(0.45, visuals.topY - gasBase - 0.18);
    visuals.gasTube.scale.y = gasHeight; visuals.gasTube.position.y = gasBase + gasHeight / 2;
    visuals.gasBase = gasBase; visuals.gasHeight = gasHeight;
    visuals.particles.forEach((particle) => {
      const dataPoint = particle.userData;
      particle.position.set(visuals.leftX + dataPoint.x, gasBase + 0.14 + dataPoint.row * (gasHeight - 0.28) + Math.sin(now / 700 + dataPoint.phase) * 0.018, dataPoint.z);
    });
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
  function initRenderer() {
    const forced = query.get("fallback") === "1";
    const context = !forced && root.THREE && (dom.canvas.getContext("webgl2", { antialias: true }) || dom.canvas.getContext("webgl", { antialias: true }));
    useFallback = !context;
    if (useFallback) { dom.canvas.classList.add("is-hidden"); dom.fallback.style.display = "block"; drawFallback(); return; }
    const THREE = root.THREE;
    renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, context, antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.96; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color("#c8d8dd"); scene.fog = new THREE.Fog("#c8d8dd", 15, 31);
    camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100); camera.userData.lookAt = new THREE.Vector3();
    scene.add(new THREE.HemisphereLight("#eff9ff", "#465b63", 1.35));
    const key = new THREE.DirectionalLight("#fff1d6", 2.05); key.position.set(6, 11, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const glassLight = new THREE.DirectionalLight("#8fd8f4", 0.72); glassLight.position.set(-5, 7, 4); scene.add(glassLight);
    const frontFill = new THREE.DirectionalLight("#ffffff", 0.82); frontFill.position.set(0, 5, 8); scene.add(frontFill);
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
      [".outside-label", [visuals.rightX, 5.32, 0], [24, -14]],
      [".delta-label", [(visuals.leftX + visuals.rightX) / 2, visuals.baseY + (visuals.leftHeight + visuals.rightHeight) / 2, 0], [12, -14]],
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
  dom.moleculeToggle.addEventListener("click", () => { const isOpen = dom.moleculeToggle.getAttribute("aria-expanded") === "true"; dom.moleculeToggle.setAttribute("aria-expanded", String(!isOpen)); setHidden(dom.moleculeCaption, isOpen); });
  dom.directionToggle.addEventListener("click", () => { const isOpen = dom.directionToggle.getAttribute("aria-expanded") === "true"; dom.directionToggle.setAttribute("aria-expanded", String(!isOpen)); setHidden(dom.directionBadge, isOpen); });
  dom.canvas.addEventListener("pointerdown", (event) => { dragging = { x: event.clientX, y: event.clientY }; dom.canvas.setPointerCapture(event.pointerId); });
  dom.canvas.addEventListener("pointermove", (event) => { if (!dragging) return; state.yaw += (event.clientX - dragging.x) * 0.008; state.pitch = Math.max(-0.1, Math.min(0.65, state.pitch + (event.clientY - dragging.y) * 0.006)); dragging = { x: event.clientX, y: event.clientY }; cameraTween = null; placeCamera(false); });
  dom.canvas.addEventListener("pointerup", () => { dragging = null; }); dom.canvas.addEventListener("wheel", (event) => { event.preventDefault(); state.zoom = Math.max(0.72, Math.min(1.42, state.zoom + event.deltaY * 0.001)); cameraTween = null; placeCamera(false); }, { passive: false });
  root.addEventListener("resize", resize); if (root.ResizeObserver) new root.ResizeObserver(resize).observe(dom.stage);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopLoop(); else startLoop(); });

  initRenderer(); updateUI(); startLoop();
})(typeof globalThis !== "undefined" ? globalThis : this);
