import * as THREE from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

const MIN_WORLD_SIZE = 100;
const MAX_WORLD_SIZE = 10000;
const TARGET_FPS_DELTA = 1 / 60;
const STORAGE_KEY = "boids-sandbox-settings-v1";
const SHARE_PARAM = "s";
const SHARE_STATE_VERSION = 1;
const SHARE_STATE_BYTES = 37;
const MAX_BIRDS = 5000;
const MAX_HAWKS = 100;

const settings = {
  separationDistance: 6,
  alignmentDistance: 24,
  cohesionDistance: 36,
  separationWeight: 1.45,
  alignmentWeight: 0.9,
  cohesionWeight: 0.68,
  arcTurnStrength: 1.4,
  arcVerticalStrength: 0.35,
  arcNoiseScale: 0.012,
  minSpeed: 7,
  maxSpeed: 14,
  maxForce: 6,
  hawkFearDistance: 45,
  hawkFearWeight: 2.8,
  hawkMinSpeed: 9,
  hawkMaxSpeed: 20,
  hawkMaxForce: 8,
  hawkChaseDistance: 120,
  hawkScale: 0.7,
  hawkCount: 0,
  boidCount: 150,
  birdScale: 0.4,
  birdSizeMultiplier: 1,
  sandboxSize: 1000,
};

const app = document.getElementById("app");
const uiPanel = document.getElementById("ui");
const uiTitle = uiPanel.querySelector("h1");
const countSlider = document.getElementById("countSlider");
const countValue = document.getElementById("countValue");
const sandboxSlider = document.getElementById("sandboxSlider");
const sandboxValue = document.getElementById("sandboxValue");
const birdSizeSlider = document.getElementById("birdSizeSlider");
const birdSizeValue = document.getElementById("birdSizeValue");
const hawkCountSlider = document.getElementById("hawkCountSlider");
const hawkCountValue = document.getElementById("hawkCountValue");
const shareLink = document.getElementById("shareLink");

const HOVER_COLLAPSE_DELAY_MS = 900;
let collapseTimerId = null;
let uiPinned = false;
uiPanel.classList.remove("expanded");

function clearCollapseTimer() {
  if (collapseTimerId !== null) {
    clearTimeout(collapseTimerId);
    collapseTimerId = null;
  }
}

function expandSettingsPanel() {
  clearCollapseTimer();
  uiPanel.classList.add("expanded");
}

function scheduleCollapseSettingsPanel() {
  clearCollapseTimer();
  if (uiPinned) return;
  collapseTimerId = setTimeout(() => {
    if (!uiPanel.matches(":hover")) {
      uiPanel.classList.remove("expanded");
    }
    collapseTimerId = null;
  }, HOVER_COLLAPSE_DELAY_MS);
}

uiPanel.addEventListener("mouseenter", () => {
  expandSettingsPanel();
});

uiPanel.addEventListener("mouseleave", () => {
  scheduleCollapseSettingsPanel();
});

uiTitle.addEventListener("dblclick", () => {
  uiPinned = !uiPinned;
  if (uiPinned) {
    expandSettingsPanel();
  } else {
    scheduleCollapseSettingsPanel();
  }
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050910, 500, 2000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(700, 480, 700);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

const cameraControl = {
  yaw: 0,
  pitch: 0,
  lookSensitivity: 0.0022,
  moveSpeed: 220,
  sprintMultiplier: 2,
  active: false,
};

const autoOrbit = {
  enabled: false,
  forcedByUser: false,
  idleDelayMs: 3500,
  angularSpeed: 0.14,
  angle: Math.atan2(camera.position.z, camera.position.x),
  radius: Math.max(1, Math.hypot(camera.position.x, camera.position.z)),
  height: camera.position.y,
  desiredPosition: new THREE.Vector3(),
  focus: new THREE.Vector3(0, 0, 0),
};
let lastCameraInputMs = performance.now();

const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const moveVec = new THREE.Vector3();

function syncAnglesFromCamera() {
  cameraEuler.setFromQuaternion(camera.quaternion, "YXZ");
  cameraControl.pitch = cameraEuler.x;
  cameraControl.yaw = cameraEuler.y;
}

function updateCameraRotation() {
  cameraEuler.set(cameraControl.pitch, cameraControl.yaw, 0, "YXZ");
  camera.quaternion.setFromEuler(cameraEuler);
}

function noteCameraInput() {
  lastCameraInputMs = performance.now();
  if (autoOrbit.forcedByUser) return;
  if (!autoOrbit.enabled) return;
  autoOrbit.enabled = false;
  syncAnglesFromCamera();
}

syncAnglesFromCamera();

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
  noteCameraInput();
});

document.addEventListener("pointerlockchange", () => {
  cameraControl.active = document.pointerLockElement === renderer.domElement;
  if (cameraControl.active) noteCameraInput();
});

document.addEventListener("mousemove", (event) => {
  if (!cameraControl.active) return;
  noteCameraInput();
  cameraControl.yaw -= event.movementX * cameraControl.lookSensitivity;
  cameraControl.pitch -= event.movementY * cameraControl.lookSensitivity;
  cameraControl.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraControl.pitch));
  updateCameraRotation();
});

function setMovementKey(code, pressed) {
  if (code === "KeyW") {
    moveState.forward = pressed;
    return true;
  }
  if (code === "KeyS") {
    moveState.backward = pressed;
    return true;
  }
  if (code === "KeyA") {
    moveState.left = pressed;
    return true;
  }
  if (code === "KeyD") {
    moveState.right = pressed;
    return true;
  }
  if (code === "ShiftLeft" || code === "ShiftRight") {
    moveState.sprint = pressed;
    return true;
  }
  return false;
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "Space") {
    event.preventDefault();
    autoOrbit.forcedByUser = !autoOrbit.forcedByUser;
    if (autoOrbit.forcedByUser) {
      autoOrbit.enabled = true;
      autoOrbit.radius = Math.max(1, Math.hypot(camera.position.x, camera.position.z));
      autoOrbit.height = camera.position.y;
      autoOrbit.angle = Math.atan2(camera.position.z, camera.position.x);
    } else {
      autoOrbit.enabled = false;
      syncAnglesFromCamera();
      lastCameraInputMs = performance.now();
    }
    return;
  }
  if (setMovementKey(event.code, true)) noteCameraInput();
});

document.addEventListener("keyup", (event) => {
  if (setMovementKey(event.code, false)) noteCameraInput();
});

function updateCameraPosition(deltaSeconds) {
  moveVec.set(0, 0, 0);

  camera.getWorldDirection(forwardVec);
  rightVec.crossVectors(forwardVec, camera.up).normalize();

  if (moveState.forward) moveVec.add(forwardVec);
  if (moveState.backward) moveVec.sub(forwardVec);
  if (moveState.right) moveVec.add(rightVec);
  if (moveState.left) moveVec.sub(rightVec);

  if (moveVec.lengthSq() === 0) return false;
  moveVec.normalize();

  const speed = cameraControl.moveSpeed * (moveState.sprint ? cameraControl.sprintMultiplier : 1);
  camera.position.addScaledVector(moveVec, speed * deltaSeconds);
  return true;
}

function updateAutoOrbitCamera(deltaSeconds) {
  autoOrbit.angle += autoOrbit.angularSpeed * deltaSeconds;
  autoOrbit.desiredPosition.set(
    Math.cos(autoOrbit.angle) * autoOrbit.radius,
    autoOrbit.height,
    Math.sin(autoOrbit.angle) * autoOrbit.radius
  );

  const blend = 1 - Math.exp(-deltaSeconds * 1.8);
  camera.position.lerp(autoOrbit.desiredPosition, blend);
  camera.lookAt(autoOrbit.focus);
}

const hemiLight = new THREE.HemisphereLight(0xbcd8ff, 0x1a283a, 1.45);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
dirLight.position.set(300, 500, 250);
scene.add(dirLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(MAX_WORLD_SIZE, MAX_WORLD_SIZE, 16, 16),
  new THREE.MeshStandardMaterial({
    color: 0x0f1e2f,
    roughness: 0.88,
    metalness: 0.08,
    wireframe: false,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -(settings.sandboxSize * 0.5);
scene.add(floor);

const grid = new THREE.GridHelper(MAX_WORLD_SIZE, 20, 0x365275, 0x2a3f59);
grid.position.y = -(settings.sandboxSize * 0.5) + 0.2;
scene.add(grid);

const initialHalf = settings.sandboxSize * 0.5;
const box = new THREE.Box3(
  new THREE.Vector3(-initialHalf, -initialHalf, -initialHalf),
  new THREE.Vector3(initialHalf, initialHalf, initialHalf)
);
const boxHelper = new THREE.Box3Helper(box, 0x4c6d93);
scene.add(boxHelper);

let lastSerializedStateHex = "";

function clampInteger(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFinite(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function bytesToHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function encodeSceneStateToHex() {
  const bytes = new Uint8Array(SHARE_STATE_BYTES);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  view.setUint8(offset, SHARE_STATE_VERSION);
  offset += 1;

  view.setUint16(offset, clampInteger(settings.boidCount, 10, MAX_BIRDS, 150), true);
  offset += 2;
  view.setUint16(offset, clampInteger(settings.sandboxSize, MIN_WORLD_SIZE, MAX_WORLD_SIZE, 1000), true);
  offset += 2;
  view.setUint16(
    offset,
    clampInteger(Math.round(settings.birdSizeMultiplier * 100), 50, 300, 100),
    true
  );
  offset += 2;
  view.setUint16(offset, clampInteger(settings.hawkCount, 0, MAX_HAWKS, 0), true);
  offset += 2;

  view.setFloat32(offset, camera.position.x, true);
  offset += 4;
  view.setFloat32(offset, camera.position.y, true);
  offset += 4;
  view.setFloat32(offset, camera.position.z, true);
  offset += 4;
  view.setFloat32(offset, camera.quaternion.x, true);
  offset += 4;
  view.setFloat32(offset, camera.quaternion.y, true);
  offset += 4;
  view.setFloat32(offset, camera.quaternion.z, true);
  offset += 4;
  view.setFloat32(offset, camera.quaternion.w, true);

  return bytesToHex(bytes);
}

function decodeSceneStateFromHex(hex) {
  const bytes = hexToBytes(hex);
  if (!bytes || bytes.length !== SHARE_STATE_BYTES) return null;

  const view = new DataView(bytes.buffer);
  let offset = 0;
  const version = view.getUint8(offset);
  offset += 1;
  if (version !== SHARE_STATE_VERSION) return null;

  const parsed = {
    boidCount: view.getUint16(offset, true),
    sandboxSize: view.getUint16(offset + 2, true),
    birdSizePercent: view.getUint16(offset + 4, true),
    hawkCount: view.getUint16(offset + 6, true),
    cameraX: view.getFloat32(offset + 8, true),
    cameraY: view.getFloat32(offset + 12, true),
    cameraZ: view.getFloat32(offset + 16, true),
    quatX: view.getFloat32(offset + 20, true),
    quatY: view.getFloat32(offset + 24, true),
    quatZ: view.getFloat32(offset + 28, true),
    quatW: view.getFloat32(offset + 32, true),
  };

  const quaternionLengthSq =
    parsed.quatX * parsed.quatX +
    parsed.quatY * parsed.quatY +
    parsed.quatZ * parsed.quatZ +
    parsed.quatW * parsed.quatW;

  if (!Number.isFinite(quaternionLengthSq) || quaternionLengthSq < 1e-8) {
    return null;
  }

  return {
    boidCount: clampInteger(parsed.boidCount, 10, MAX_BIRDS, settings.boidCount),
    sandboxSize: clampInteger(parsed.sandboxSize, MIN_WORLD_SIZE, MAX_WORLD_SIZE, settings.sandboxSize),
    birdSizePercent: clampInteger(parsed.birdSizePercent, 50, 300, 100),
    hawkCount: clampInteger(parsed.hawkCount, 0, MAX_HAWKS, settings.hawkCount),
    cameraX: clampFinite(parsed.cameraX, -500000, 500000, camera.position.x),
    cameraY: clampFinite(parsed.cameraY, -500000, 500000, camera.position.y),
    cameraZ: clampFinite(parsed.cameraZ, -500000, 500000, camera.position.z),
    quatX: parsed.quatX,
    quatY: parsed.quatY,
    quatZ: parsed.quatZ,
    quatW: parsed.quatW,
  };
}

function loadSharedStateFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const hex = searchParams.get(SHARE_PARAM);
  if (!hex) return null;
  return decodeSceneStateFromHex(hex.trim());
}

function applySharedCameraState(sharedState) {
  camera.position.set(sharedState.cameraX, sharedState.cameraY, sharedState.cameraZ);
  camera.quaternion.set(sharedState.quatX, sharedState.quatY, sharedState.quatZ, sharedState.quatW).normalize();
  syncAnglesFromCamera();
  autoOrbit.enabled = false;
  lastCameraInputMs = performance.now();
}

function updateShareLink() {
  if (!shareLink) return;

  const stateHex = encodeSceneStateToHex();
  const textNeedsInit = shareLink.textContent !== "share";
  if (stateHex === lastSerializedStateHex && !textNeedsInit) return;
  lastSerializedStateHex = stateHex;

  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set(SHARE_PARAM, stateHex);
  const fullUrl = shareUrl.toString();

  shareLink.href = fullUrl;
  shareLink.textContent = "share";
  history.replaceState(null, "", shareUrl);
}

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedSettings() {
  try {
    const persisted = {
      boidCount: settings.boidCount,
      sandboxSize: settings.sandboxSize,
      birdSizePercent: Math.round(settings.birdSizeMultiplier * 100),
      hawkCount: settings.hawkCount,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Ignore storage failures.
  }
}

const beadGeometry = new THREE.SphereGeometry(1, 8, 6);
const boidMaterial = new THREE.MeshStandardMaterial({
  color: 0xf6fdff,
  emissive: 0x2f6fa8,
  emissiveIntensity: 0.95,
  roughness: 0.3,
  metalness: 0.02,
  vertexColors: true,
});
const boidMesh = new THREE.InstancedMesh(beadGeometry, boidMaterial, MAX_BIRDS);
boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
boidMesh.frustumCulled = false;
boidMesh.count = 0;
scene.add(boidMesh);

const hawkMaterial = new THREE.MeshStandardMaterial({ color: 0xff2d2d, roughness: 0.35, metalness: 0.08 });
const hawkMesh = new THREE.InstancedMesh(beadGeometry, hawkMaterial, MAX_HAWKS);
hawkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
hawkMesh.frustumCulled = false;
hawkMesh.count = 0;
scene.add(hawkMesh);

const sizeNoise = new ImprovedNoise();
const boids = [];
const hawks = [];

const instanceMatrix = new THREE.Matrix4();

const spatialHash = new Map();
const neighborOffsets = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      neighborOffsets.push([x, y, z]);
    }
  }
}

function cellKey(cx, cy, cz) {
  return `${cx},${cy},${cz}`;
}

function buildSpatialHash(cellSize) {
  spatialHash.clear();
  for (let i = 0; i < boids.length; i++) {
    const p = boids[i].position;
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const cz = Math.floor(p.z / cellSize);
    const key = cellKey(cx, cy, cz);
    let cell = spatialHash.get(key);
    if (!cell) {
      cell = [];
      spatialHash.set(key, cell);
    }
    cell.push(i);
  }
}

function getBirdVisualScale(baseSizeFactor) {
  return settings.birdScale * baseSizeFactor * settings.birdSizeMultiplier;
}

function getHawkVisualScale() {
  return settings.hawkScale * settings.birdSizeMultiplier;
}

function createBoidData() {
  const position = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.45),
    THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.45),
    THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.45)
  );

  const velocity = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2),
    THREE.MathUtils.randFloatSpread(2)
  ).normalize().multiplyScalar(THREE.MathUtils.randFloat(settings.minSpeed * 0.85, settings.maxSpeed));

  const n = sizeNoise.noise(
    position.x * 0.02 + 31.7,
    position.y * 0.02 + 53.1,
    position.z * 0.02 + 79.9
  );

  const baseSizeFactor = 1 + n * 0.1;
  const colorNoise = sizeNoise.noise(
    position.x * 0.014 + 111.3,
    position.y * 0.014 + 241.9,
    position.z * 0.014 + 77.4
  );
  const t = THREE.MathUtils.clamp(colorNoise * 0.5 + 0.5, 0, 1);
  const hue = 0.56 + (t - 0.5) * 0.03;
  const saturation = 0.32 + (1 - t) * 0.2;
  const lightness = 0.74 + t * 0.22;
  const color = new THREE.Color().setHSL(hue, saturation, lightness);

  return {
    position,
    velocity,
    acceleration: new THREE.Vector3(),
    baseSizeFactor,
    color,
    arcPhase: Math.random() * Math.PI * 2,
    arcRate: THREE.MathUtils.randFloat(0.7, 1.35),
    arcSeed: Math.random() * 1000,
  };
}

function applyBoidInstance(i) {
  const b = boids[i];
  const s = getBirdVisualScale(b.baseSizeFactor);
  instanceMatrix.makeScale(s, s, s);
  instanceMatrix.setPosition(b.position);
  boidMesh.setMatrixAt(i, instanceMatrix);
}

function setBoidCount(target) {
  const desired = Math.max(10, Math.min(MAX_BIRDS, target));

  while (boids.length < desired) {
    const boid = createBoidData();
    boids.push(boid);
    const idx = boids.length - 1;
    boidMesh.setColorAt(idx, boid.color);
    applyBoidInstance(idx);
  }

  while (boids.length > desired) {
    boids.pop();
  }

  boidMesh.count = boids.length;
  boidMesh.instanceMatrix.needsUpdate = true;
  if (boidMesh.instanceColor) boidMesh.instanceColor.needsUpdate = true;

  settings.boidCount = desired;
  countValue.textContent = String(desired);
  savePersistedSettings();
}

function createHawkData() {
  return {
    position: new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.25),
      THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.25),
      THREE.MathUtils.randFloatSpread(settings.sandboxSize * 0.25)
    ),
    velocity: new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2),
      THREE.MathUtils.randFloatSpread(2),
      THREE.MathUtils.randFloatSpread(2)
    ).normalize().multiplyScalar(THREE.MathUtils.randFloat(settings.hawkMinSpeed, settings.hawkMaxSpeed)),
    acceleration: new THREE.Vector3(),
  };
}

function applyHawkInstance(i) {
  const h = hawks[i];
  const s = getHawkVisualScale();
  instanceMatrix.makeScale(s, s, s);
  instanceMatrix.setPosition(h.position);
  hawkMesh.setMatrixAt(i, instanceMatrix);
}

function setHawkCount(target) {
  const desired = Math.max(0, Math.min(MAX_HAWKS, target));

  while (hawks.length < desired) {
    hawks.push(createHawkData());
    applyHawkInstance(hawks.length - 1);
  }
  while (hawks.length > desired) {
    hawks.pop();
  }

  hawkMesh.count = hawks.length;
  hawkMesh.instanceMatrix.needsUpdate = true;

  settings.hawkCount = desired;
  hawkCountValue.textContent = String(desired);
  savePersistedSettings();
}

function setSandboxSize(target) {
  const desired = Math.max(MIN_WORLD_SIZE, Math.min(MAX_WORLD_SIZE, target));
  settings.sandboxSize = desired;

  const halfWorld = desired * 0.5;
  const scale = desired / MAX_WORLD_SIZE;

  box.min.set(-halfWorld, -halfWorld, -halfWorld);
  box.max.set(halfWorld, halfWorld, halfWorld);

  floor.position.y = -halfWorld;
  floor.scale.set(scale, scale, 1);

  grid.position.y = -halfWorld + 0.2;
  grid.scale.set(scale, 1, scale);

  sandboxValue.textContent = `${desired} m`;

  for (let i = 0; i < boids.length; i++) {
    boids[i].position.clamp(box.min, box.max);
    applyBoidInstance(i);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < hawks.length; i++) {
    hawks[i].position.clamp(box.min, box.max);
    applyHawkInstance(i);
  }
  hawkMesh.instanceMatrix.needsUpdate = true;

  savePersistedSettings();
}

function setBirdSize(percent) {
  const clamped = Math.max(50, Math.min(300, percent));
  settings.birdSizeMultiplier = clamped / 100;
  birdSizeValue.textContent = `${clamped}%`;

  for (let i = 0; i < boids.length; i++) {
    applyBoidInstance(i);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < hawks.length; i++) {
    applyHawkInstance(i);
  }
  hawkMesh.instanceMatrix.needsUpdate = true;

  savePersistedSettings();
}

function clampSteer(x, y, z, maxForce) {
  const m = Math.hypot(x, y, z);
  if (m > maxForce && m > 0) {
    const s = maxForce / m;
    return [x * s, y * s, z * s];
  }
  return [x, y, z];
}

function updateBoids(deltaSeconds, simTime) {
  const sepDistSq = settings.separationDistance * settings.separationDistance;
  const aliDistSq = settings.alignmentDistance * settings.alignmentDistance;
  const cohDistSq = settings.cohesionDistance * settings.cohesionDistance;
  const fearDistSq = settings.hawkFearDistance * settings.hawkFearDistance;

  const maxSpeed = settings.maxSpeed;
  const minSpeed = settings.minSpeed;
  const maxForce = settings.maxForce;
  const halfWorld = settings.sandboxSize * 0.5;
  const margin = 20;
  const turn = maxForce * 2.5;
  const arcTurnStrength = settings.arcTurnStrength;
  const arcVerticalStrength = settings.arcVerticalStrength;
  const arcNoiseScale = settings.arcNoiseScale;

  const cellSize = settings.cohesionDistance;
  buildSpatialHash(cellSize);

  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    const p = b.position;
    const v = b.velocity;

    let sepX = 0;
    let sepY = 0;
    let sepZ = 0;
    let aliX = 0;
    let aliY = 0;
    let aliZ = 0;
    let cohX = 0;
    let cohY = 0;
    let cohZ = 0;
    let sepCount = 0;
    let aliCount = 0;
    let cohCount = 0;

    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const cz = Math.floor(p.z / cellSize);

    for (let n = 0; n < neighborOffsets.length; n++) {
      const off = neighborOffsets[n];
      const cell = spatialHash.get(cellKey(cx + off[0], cy + off[1], cz + off[2]));
      if (!cell) continue;

      for (let c = 0; c < cell.length; c++) {
        const j = cell[c];
        if (j === i) continue;
        const o = boids[j];

        const dx = p.x - o.position.x;
        const dy = p.y - o.position.y;
        const dz = p.z - o.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 1e-8) continue;

        if (distSq < sepDistSq) {
          const invDist = 1 / Math.sqrt(distSq);
          sepX += dx * invDist;
          sepY += dy * invDist;
          sepZ += dz * invDist;
          sepCount++;
        }

        if (distSq < aliDistSq) {
          aliX += o.velocity.x;
          aliY += o.velocity.y;
          aliZ += o.velocity.z;
          aliCount++;
        }

        if (distSq < cohDistSq) {
          cohX += o.position.x;
          cohY += o.position.y;
          cohZ += o.position.z;
          cohCount++;
        }
      }
    }

    let ax = 0;
    let ay = 0;
    let az = 0;

    if (sepCount > 0) {
      sepX /= sepCount;
      sepY /= sepCount;
      sepZ /= sepCount;
      const m = Math.hypot(sepX, sepY, sepZ);
      if (m > 0) {
        sepX = (sepX / m) * maxSpeed - v.x;
        sepY = (sepY / m) * maxSpeed - v.y;
        sepZ = (sepZ / m) * maxSpeed - v.z;
        [sepX, sepY, sepZ] = clampSteer(sepX, sepY, sepZ, maxForce);
        ax += sepX * settings.separationWeight;
        ay += sepY * settings.separationWeight;
        az += sepZ * settings.separationWeight;
      }
    }

    if (aliCount > 0) {
      aliX /= aliCount;
      aliY /= aliCount;
      aliZ /= aliCount;
      const m = Math.hypot(aliX, aliY, aliZ);
      if (m > 0) {
        aliX = (aliX / m) * maxSpeed - v.x;
        aliY = (aliY / m) * maxSpeed - v.y;
        aliZ = (aliZ / m) * maxSpeed - v.z;
        [aliX, aliY, aliZ] = clampSteer(aliX, aliY, aliZ, maxForce);
        ax += aliX * settings.alignmentWeight;
        ay += aliY * settings.alignmentWeight;
        az += aliZ * settings.alignmentWeight;
      }
    }

    if (cohCount > 0) {
      cohX = cohX / cohCount - p.x;
      cohY = cohY / cohCount - p.y;
      cohZ = cohZ / cohCount - p.z;
      const m = Math.hypot(cohX, cohY, cohZ);
      if (m > 0) {
        cohX = (cohX / m) * maxSpeed - v.x;
        cohY = (cohY / m) * maxSpeed - v.y;
        cohZ = (cohZ / m) * maxSpeed - v.z;
        [cohX, cohY, cohZ] = clampSteer(cohX, cohY, cohZ, maxForce);
        ax += cohX * settings.cohesionWeight;
        ay += cohY * settings.cohesionWeight;
        az += cohZ * settings.cohesionWeight;
      }
    }

    if (hawks.length > 0) {
      let nearest = null;
      let nearestDistSq = Infinity;
      for (let h = 0; h < hawks.length; h++) {
        const hx = p.x - hawks[h].position.x;
        const hy = p.y - hawks[h].position.y;
        const hz = p.z - hawks[h].position.z;
        const d2 = hx * hx + hy * hy + hz * hz;
        if (d2 < nearestDistSq) {
          nearestDistSq = d2;
          nearest = hawks[h];
        }
      }

      if (nearest && nearestDistSq > 1e-8 && nearestDistSq < fearDistSq) {
        const dx = p.x - nearest.position.x;
        const dy = p.y - nearest.position.y;
        const dz = p.z - nearest.position.z;
        const dist = Math.sqrt(nearestDistSq);
        const inv = 1 / dist;
        let fx = dx * inv * (maxSpeed * 1.5) - v.x;
        let fy = dy * inv * (maxSpeed * 1.5) - v.y;
        let fz = dz * inv * (maxSpeed * 1.5) - v.z;
        [fx, fy, fz] = clampSteer(fx, fy, fz, maxForce * 4.5);
        const panic = 1 - dist / settings.hawkFearDistance;
        ax += fx * settings.hawkFearWeight * panic;
        ay += fy * settings.hawkFearWeight * panic;
        az += fz * settings.hawkFearWeight * panic;
      }
    }

    // Add a smooth lateral curvature term so boids prefer arc-like paths.
    const vm = Math.hypot(v.x, v.y, v.z);
    if (vm > 1e-6) {
      let lx = -v.z / vm;
      let lz = v.x / vm;
      const lm = Math.hypot(lx, lz);
      if (lm > 1e-6) {
        lx /= lm;
        lz /= lm;
      } else {
        lx = 1;
        lz = 0;
      }

      const curveNoise = sizeNoise.noise(
        p.x * arcNoiseScale + b.arcSeed,
        p.y * arcNoiseScale,
        simTime * 0.35 + b.arcSeed
      );
      const curveWave = Math.sin(simTime * b.arcRate + b.arcPhase);
      const curve = curveWave * 0.68 + curveNoise * 0.32;

      ax += lx * arcTurnStrength * curve;
      az += lz * arcTurnStrength * curve;
      ay += Math.sin(simTime * b.arcRate * 0.6 + b.arcPhase) * arcVerticalStrength;
    }

    if (p.x > halfWorld - margin) ax -= turn;
    if (p.x < -halfWorld + margin) ax += turn;
    if (p.y > halfWorld - margin) ay -= turn;
    if (p.y < -halfWorld + margin) ay += turn;
    if (p.z > halfWorld - margin) az -= turn;
    if (p.z < -halfWorld + margin) az += turn;

    // Keep curvature smooth by blending new steering into existing acceleration.
    b.acceleration.x = b.acceleration.x * 0.4 + ax * 0.6;
    b.acceleration.y = b.acceleration.y * 0.4 + ay * 0.6;
    b.acceleration.z = b.acceleration.z * 0.4 + az * 0.6;
  }

  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    b.velocity.addScaledVector(b.acceleration, deltaSeconds);

    const speed = b.velocity.length();
    if (speed > settings.maxSpeed) b.velocity.multiplyScalar(settings.maxSpeed / speed);
    if (speed > 0 && speed < settings.minSpeed) b.velocity.multiplyScalar(settings.minSpeed / speed);

    b.position.addScaledVector(b.velocity, deltaSeconds);
    b.position.clamp(box.min, box.max);

    if (b.position.x === box.min.x || b.position.x === box.max.x) b.velocity.x *= -0.7;
    if (b.position.y === box.min.y || b.position.y === box.max.y) b.velocity.y *= -0.7;
    if (b.position.z === box.min.z || b.position.z === box.max.z) b.velocity.z *= -0.7;

    b.acceleration.multiplyScalar(0.25);
    applyBoidInstance(i);
  }

  boidMesh.instanceMatrix.needsUpdate = true;
}

function updateHawk(deltaSeconds) {
  if (hawks.length === 0 || boids.length === 0) return;

  const chaseDistSq = settings.hawkChaseDistance * settings.hawkChaseDistance;
  const margin = 40;
  const turn = settings.hawkMaxForce * 3.2;
  const halfWorld = settings.sandboxSize * 0.5;

  for (let h = 0; h < hawks.length; h++) {
    const hawk = hawks[h];
    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (let i = 0; i < boids.length; i++) {
      const dx = boids[i].position.x - hawk.position.x;
      const dy = boids[i].position.y - hawk.position.y;
      const dz = boids[i].position.z - hawk.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < nearestDistanceSq && distSq < chaseDistSq) {
        nearestDistanceSq = distSq;
        nearest = boids[i];
      }
    }

    if (nearest) {
      let dx = nearest.position.x - hawk.position.x;
      let dy = nearest.position.y - hawk.position.y;
      let dz = nearest.position.z - hawk.position.z;
      const m = Math.hypot(dx, dy, dz);
      if (m > 0) {
        dx = (dx / m) * settings.hawkMaxSpeed - hawk.velocity.x;
        dy = (dy / m) * settings.hawkMaxSpeed - hawk.velocity.y;
        dz = (dz / m) * settings.hawkMaxSpeed - hawk.velocity.z;
        [dx, dy, dz] = clampSteer(dx, dy, dz, settings.hawkMaxForce);
        hawk.acceleration.x += dx;
        hawk.acceleration.y += dy;
        hawk.acceleration.z += dz;
      }
    } else {
      hawk.acceleration.x += THREE.MathUtils.randFloatSpread(0.8) * settings.hawkMaxForce * 0.7;
      hawk.acceleration.y += THREE.MathUtils.randFloatSpread(0.6) * settings.hawkMaxForce * 0.7;
      hawk.acceleration.z += THREE.MathUtils.randFloatSpread(0.8) * settings.hawkMaxForce * 0.7;
    }

    if (hawk.position.x > halfWorld - margin) hawk.acceleration.x -= turn;
    if (hawk.position.x < -halfWorld + margin) hawk.acceleration.x += turn;
    if (hawk.position.y > halfWorld - margin) hawk.acceleration.y -= turn;
    if (hawk.position.y < -halfWorld + margin) hawk.acceleration.y += turn;
    if (hawk.position.z > halfWorld - margin) hawk.acceleration.z -= turn;
    if (hawk.position.z < -halfWorld + margin) hawk.acceleration.z += turn;

    hawk.velocity.addScaledVector(hawk.acceleration, deltaSeconds);
    const speed = hawk.velocity.length();
    if (speed > settings.hawkMaxSpeed) hawk.velocity.multiplyScalar(settings.hawkMaxSpeed / speed);
    if (speed > 0 && speed < settings.hawkMinSpeed) hawk.velocity.multiplyScalar(settings.hawkMinSpeed / speed);

    hawk.position.addScaledVector(hawk.velocity, deltaSeconds);
    hawk.position.clamp(box.min, box.max);

    if (hawk.position.x === box.min.x || hawk.position.x === box.max.x) hawk.velocity.x *= -0.65;
    if (hawk.position.y === box.min.y || hawk.position.y === box.max.y) hawk.velocity.y *= -0.65;
    if (hawk.position.z === box.min.z || hawk.position.z === box.max.z) hawk.velocity.z *= -0.65;

    hawk.acceleration.set(0, 0, 0);
    applyHawkInstance(h);
  }

  hawkMesh.instanceMatrix.needsUpdate = true;
}

countSlider.addEventListener("input", () => {
  setBoidCount(Number(countSlider.value));
});
countSlider.addEventListener("change", () => {
  setBoidCount(Number(countSlider.value));
});

sandboxSlider.addEventListener("input", () => {
  setSandboxSize(Number(sandboxSlider.value));
});
sandboxSlider.addEventListener("change", () => {
  setSandboxSize(Number(sandboxSlider.value));
});

birdSizeSlider.addEventListener("input", () => {
  setBirdSize(Number(birdSizeSlider.value));
});
birdSizeSlider.addEventListener("change", () => {
  setBirdSize(Number(birdSizeSlider.value));
});

hawkCountSlider.addEventListener("input", () => {
  setHawkCount(Number(hawkCountSlider.value));
});
hawkCountSlider.addEventListener("change", () => {
  setHawkCount(Number(hawkCountSlider.value));
});

const persisted = loadPersistedSettings();
const sharedState = loadSharedStateFromUrl();
const initialBoidCount = Number.isFinite(sharedState?.boidCount)
  ? sharedState.boidCount
  : Number.isFinite(persisted?.boidCount)
    ? persisted.boidCount
    : settings.boidCount;
const initialSandboxSize = Number.isFinite(sharedState?.sandboxSize)
  ? sharedState.sandboxSize
  : Number.isFinite(persisted?.sandboxSize)
    ? persisted.sandboxSize
    : settings.sandboxSize;
const initialBirdSizePercent = Number.isFinite(sharedState?.birdSizePercent)
  ? sharedState.birdSizePercent
  : Number.isFinite(persisted?.birdSizePercent)
    ? persisted.birdSizePercent
    : 100;
const initialHawkCount = Number.isFinite(sharedState?.hawkCount)
  ? sharedState.hawkCount
  : Number.isFinite(persisted?.hawkCount)
    ? persisted.hawkCount
    : settings.hawkCount;

countSlider.value = String(Math.max(10, Math.min(MAX_BIRDS, Math.round(initialBoidCount))));
sandboxSlider.value = String(Math.max(MIN_WORLD_SIZE, Math.min(MAX_WORLD_SIZE, Math.round(initialSandboxSize))));
birdSizeSlider.value = String(Math.max(50, Math.min(300, Math.round(initialBirdSizePercent))));
hawkCountSlider.value = String(Math.max(0, Math.min(MAX_HAWKS, Math.round(initialHawkCount))));
hawkCountValue.textContent = hawkCountSlider.value;

setBirdSize(Number(birdSizeSlider.value));
setSandboxSize(Number(sandboxSlider.value));
setBoidCount(Number(countSlider.value));
setHawkCount(Number(hawkCountSlider.value));
if (sharedState) applySharedCameraState(sharedState);
updateShareLink();

const clock = new THREE.Clock();
let simulationTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const deltaSeconds = Math.min(clock.getDelta(), TARGET_FPS_DELTA * 2);
  simulationTime += deltaSeconds;

  updateBoids(deltaSeconds, simulationTime);
  updateHawk(deltaSeconds);

  const nowMs = performance.now();
  const hasMoveInput = moveState.forward || moveState.backward || moveState.left || moveState.right;
  const idleTooLong = nowMs - lastCameraInputMs > autoOrbit.idleDelayMs;
  const shouldOrbit = autoOrbit.forcedByUser || (idleTooLong && !hasMoveInput);

  if (shouldOrbit) {
    if (!autoOrbit.enabled) {
      autoOrbit.enabled = true;
      autoOrbit.radius = Math.max(1, Math.hypot(camera.position.x, camera.position.z));
      autoOrbit.height = camera.position.y;
      autoOrbit.angle = Math.atan2(camera.position.z, camera.position.x);
    }
    updateAutoOrbitCamera(deltaSeconds);
  } else {
    const moved = updateCameraPosition(deltaSeconds);
    if (moved) noteCameraInput();
  }

  updateShareLink();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
