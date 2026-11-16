// 3D mezarlık sahnesi (Three.js). Dokular ve modeller: Poly Haven (CC0).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { hash, stoneLook } from "./core.js";

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch {
    return false;
  }
}

/* ---------- yardımcılar ---------- */

const ROW_GAP = 2.5;
const COLS = [-3.05, -1.65, 1.65, 3.05];
const FENCE_X = 4.4;
const GATE_Z = 3.2;
const PX_PER_M = 520;
const INK = "rgba(240,230,204,0.96)";
const MAX_STONES = 120;

/** Hash'ten 0..1 arası deterministik sayı üretir. */
const rnd = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function stoneSize(shape, look) {
  if (shape === "obelisk") return { w: 0.56, h: 1.55 * look.height };
  if (shape === "slab") return { w: 0.95, h: 0.95 * look.height };
  return { w: 0.82, h: 1.12 * look.height };
}

function stoneShape(kind, w, h) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  switch (kind) {
    case "arch":
      s.lineTo(hw, h - hw);
      s.absarc(0, h - hw, hw, 0, Math.PI, false);
      break;
    case "round":
      s.lineTo(hw, h - 0.24);
      s.bezierCurveTo(hw, h + 0.02, -hw, h + 0.02, -hw, h - 0.24);
      break;
    case "gothic":
      s.lineTo(hw, h - 0.34);
      s.quadraticCurveTo(hw, h - 0.1, 0, h);
      s.quadraticCurveTo(-hw, h - 0.1, -hw, h - 0.34);
      break;
    case "obelisk":
      s.lineTo(hw * 0.72, h - 0.22);
      s.lineTo(0, h);
      s.lineTo(-hw * 0.72, h - 0.22);
      break;
    default: {
      // slab: üst köşeleri hafif yuvarlak
      const r = 0.06;
      s.lineTo(hw, h - r);
      s.quadraticCurveTo(hw, h, hw - r, h);
      s.lineTo(-hw + r, h);
      s.quadraticCurveTo(-hw, h, -hw, h - r);
    }
  }
  s.lineTo(-hw, 0);
  return s;
}

/** Taş yüzeyine kazınmış yazı dokusu. */
function engravingTexture(info, shape, w, h, maxAniso) {
  const W = Math.round(w * PX_PER_M);
  const H = Math.round(h * PX_PER_M);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");

  // yazılar taş şeklinin dışına taşmasın
  g.save();
  g.translate(W / 2, H);
  g.scale(PX_PER_M, -PX_PER_M);
  const sh = stoneShape(shape, w * 0.9, h * 0.94);
  const pts = sh.getPoints(32);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y + h * 0.03) : g.moveTo(p.x, p.y + h * 0.03)));
  g.closePath();
  g.restore();
  g.clip();

  const narrow = shape === "obelisk";
  const maxW = W * (narrow ? 0.62 : 0.8);
  const topPad = { arch: 0.2, round: 0.17, gothic: 0.27, obelisk: 0.26, slab: 0.1 }[shape] ?? 0.18;
  let y = H * topPad;

  const carve = (text, font, size, x, yy) => {
    g.font = `${font.replace("{s}", size)}`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    // oyuk gölgesi (üst-sol), sonra krem boya dolgusu
    g.fillStyle = "rgba(0,0,0,0.75)";
    g.fillText(text, x - size * 0.03, yy - size * 0.035);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillText(text, x + size * 0.02, yy + size * 0.03);
    g.fillStyle = INK;
    g.fillText(text, x, yy);
  };
  const fit = (text, font, size, min) => {
    let s = size;
    g.font = font.replace("{s}", s);
    while (g.measureText(text).width > maxW && s > min) {
      s -= 2;
      g.font = font.replace("{s}", s);
    }
    if (g.measureText(text).width > maxW) {
      while (text.length > 2 && g.measureText(text + "…").width > maxW) text = text.slice(0, -1);
      text += "…";
    }
    return { text, size: s };
  };
  const wrap = (text, font, size, lines) => {
    g.font = font.replace("{s}", size);
    const words = text.split(/\s+/);
    const out = [];
    let line = "";
    for (const w2 of words) {
      const test = line ? `${line} ${w2}` : w2;
      if (g.measureText(test).width <= maxW) line = test;
      else {
        out.push(line);
        line = w2;
        if (out.length === lines) break;
      }
    }
    if (out.length < lines && line) out.push(line);
    if (out.length === lines && words.join(" ") !== out.join(" ")) {
      let last = out[lines - 1];
      while (last.length > 2 && g.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      out[lines - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
    }
    return out;
  };

  const cx = W / 2;
  const serif = `700 {s}px "Cormorant Garamond", Georgia, serif`;
  const italic = `italic 500 {s}px "Cormorant Garamond", Georgia, serif`;
  const mono = `600 {s}px "JetBrains Mono", Menlo, monospace`;
  const sans = `600 {s}px Inter, system-ui, sans-serif`;

  if (info.blank) {
    carve("R · I · P", serif, 34, cx, y + 34);
  } else {
    carve("R · I · P", serif, narrow ? 26 : 32, cx, y + 30);
    y += narrow ? 84 : 96;
    const name = fit(info.name, serif, narrow ? 58 : 76, 30);
    carve(name.text, serif, name.size, cx, y);
    y += name.size * 0.42 + 30;
    carve(info.years, mono, narrow ? 26 : 30, cx, y);
    y += 40;
    // süs çizgisi
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 60, y);
    g.lineTo(cx - 14, y);
    g.moveTo(cx + 14, y);
    g.lineTo(cx + 60, y);
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(cx, y - 7);
    g.lineTo(cx + 7, y);
    g.lineTo(cx, y + 7);
    g.lineTo(cx - 7, y);
    g.fill();
    y += 40;
    carve(info.lived.toLocaleUpperCase(info.lang), sans, narrow ? 19 : 22, cx, y);
    y += 52;
    for (const line of wrap(info.epitaph, italic, narrow ? 28 : 34, narrow ? 4 : 3)) {
      carve(line, italic, narrow ? 28 : 34, cx, y);
      y += narrow ? 32 : 38;
    }
  }

  if (info.cracked) {
    const r = rnd(hash(info.name || "x"));
    g.strokeStyle = "rgba(10,10,12,0.8)";
    g.lineWidth = 2.6;
    g.beginPath();
    let x = W * (0.25 + r() * 0.5);
    let yy = 0;
    g.moveTo(x, yy);
    for (let i = 0; i < 7; i++) {
      x += (r() - 0.5) * 40;
      yy += 20 + r() * 34;
      g.lineTo(x, yy);
    }
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function softTexture(size = 128, inner = "rgba(255,255,255,1)") {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const r = rnd(7);
  for (let i = 0; i < 26; i++) {
    const x = 10 + r() * 108;
    const h = 50 + r() * 76;
    const lean = (r() - 0.5) * 40;
    const shade = 150 + Math.round(r() * 105);
    g.fillStyle = `rgb(${shade},${shade},${shade})`;
    g.beginPath();
    g.moveTo(x - 3, 128);
    g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h);
    g.quadraticCurveTo(x + lean * 0.3 + 2, 128 - h * 0.6, x + 3, 128);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function moonTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const glow = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2);
  glow.addColorStop(0, "rgba(255,246,220,0.55)");
  glow.addColorStop(0.35, "rgba(200,210,255,0.12)");
  glow.addColorStop(1, "rgba(200,210,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, s, s);
  const disc = g.createRadialGradient(s * 0.46, s * 0.45, 2, s / 2, s / 2, s * 0.15);
  disc.addColorStop(0, "#fffaf0");
  disc.addColorStop(1, "#e3d8b8");
  g.fillStyle = disc;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(170,160,130,0.35)";
  for (const [x, y, r] of [[0.45, 0.44, 0.03], [0.55, 0.53, 0.022], [0.5, 0.58, 0.015], [0.43, 0.54, 0.012]]) {
    g.beginPath();
    g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Yapraksız, dallı ağaç geometrisi (siluet). */
function bareTreeGeometry(seed) {
  const r = rnd(seed);
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (start, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, 6, 1, true);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    parts.push(g);
    if (depth === 0) return;
    const end = start.clone().add(dir.clone().normalize().multiplyScalar(len));
    const n = depth > 2 ? 2 + Math.round(r()) : 2 + Math.round(r() * 2);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().normalize();
      d.x += (r() - 0.5) * 1.3;
      d.z += (r() - 0.5) * 1.3;
      d.y += 0.15 + r() * 0.4;
      grow(end, d, len * (0.6 + r() * 0.2), rad * 0.62, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3((r() - 0.5) * 0.2, 1, 0), 2.4 + r(), 0.22, 4);
  return mergeGeometries(parts);
}

/* ---------- sahne ---------- */

export class Graveyard {
  constructor(canvas, { onHover, onSelect, onProgress } = {}) {
    this.canvas = canvas;
    this.onHover = onHover || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onProgress = onProgress || (() => {});
    this.stones = [];
    this.lanterns = [];
    this.mode = "landing";
    this.yaw = 0;
    this.pitch = 0;
    this.pointerYaw = 0;
    this.camZ = 9;
    this.targetZ = 9;
    this.minZ = -10;
    this.focus = null;
    this.hovered = null;
    this.clock = new THREE.Clock();
    this.disposables = [];
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async init() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.aniso = Math.min(8, r.capabilities.getMaxAnisotropy());

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0a0d1b);
    scene.fog = new THREE.FogExp2(0x111528, 0.05);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    this.camera.position.set(0, 2.6, 11);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    await this.loadAssets();
    this.buildWorld();
    this.resize();
    addEventListener("resize", () => this.resize());
    this.bindInput();
    r.setAnimationLoop(() => this.tick());
  }

  async loadAssets() {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, done, total) => this.onProgress(done / total);
    const tl = new THREE.TextureLoader(manager);
    const tex = (name, srgb, rep = 1) => {
      const t = tl.load(`assets/tex/${name}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = this.aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const set = (id, rep) => ({
      map: tex(`${id}_diff`, true, rep),
      normalMap: tex(`${id}_nor`, false, rep),
      roughnessMap: tex(`${id}_rough`, false, rep),
    });
    this.tex = {
      clean: set("plaster_grey_04", 1),
      mossy: set("worn_mossy_plasterwall", 1),
      ground: set("forest_ground_04", 1),
      path: set("leaf_scattered_gravel", 1),
    };
    const gl = new GLTFLoader(manager);
    const load = (id) => gl.loadAsync(`assets/models/${id}/${id}.gltf`).catch(() => null);
    const [log, lantern, rocks] = await Promise.all([
      load("dead_tree_trunk"),
      load("wooden_lantern_01"),
      load("rock_moss_set_01"),
    ]);
    this.models = { log, lantern, rocks };
    await Promise.all([
      document.fonts.load('700 40px "Cormorant Garamond"'),
      document.fonts.load('italic 500 28px "Cormorant Garamond"'),
      document.fonts.load('600 24px "JetBrains Mono"'),
      document.fonts.load("600 16px Inter"),
    ]).catch(() => {});
  }

  buildWorld() {
    const s = this.scene;

    // gökyüzü kubbesi
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x05060f) }, bottom: { value: new THREE.Color(0x1b1a38) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), skyMat);
    s.add(this.sky);

    // yıldızlar
    const r = rnd(42);
    const starPos = [];
    for (let i = 0; i < 1400; i++) {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(0.15 + r() * 0.85);
      starPos.push(Math.sin(ph) * Math.cos(th) * 110, Math.cos(ph) * 110, Math.sin(ph) * Math.sin(th) * 110);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe4ff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    s.add(this.stars);

    // ay
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false, transparent: true }));
    this.moon.scale.set(22, 22, 1);
    s.add(this.moon);

    // ışıklar
    s.add(new THREE.HemisphereLight(0x7d89c8, 0x15121a, 0.9));
    const moonLight = (this.moonLight = new THREE.DirectionalLight(0xc4d0ff, 2.1));
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    const sc = moonLight.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 60;
    moonLight.shadow.bias = -0.0004;
    moonLight.shadow.normalBias = 0.02;
    s.add(moonLight, moonLight.target);

    // ziyaretçinin elindeki fener: yakındaki taşların yüzünü aydınlatır
    this.carryLight = new THREE.PointLight(0xffc98a, 0, 7.5, 1.6);
    s.add(this.carryLight);

    // fener ışık havuzu (en yakın fenerlere atanır)
    this.lightPool = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffa24a, 0, 7, 1.8);
      s.add(l);
      this.lightPool.push(l);
    }

    // zemin
    const groundGeo = new THREE.PlaneGeometry(80, 80, 120, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      const onPath = Math.abs(x) < 1.1 ? 0.3 : 1;
      gp.setY(i, (Math.sin(x * 0.7) * Math.cos(z * 0.5) * 0.06 + Math.sin(x * 2.3 + z * 1.7) * 0.025) * onPath);
    }
    groundGeo.computeVertexNormals();
    for (const k of ["map", "normalMap", "roughnessMap"]) this.tex.ground[k].repeat.set(26, 26);
    this.groundMat = new THREE.MeshStandardMaterial({ ...this.tex.ground, color: 0x8c8a86, normalScale: new THREE.Vector2(1.2, 1.2) });
    this.ground = new THREE.Mesh(groundGeo, this.groundMat);
    this.ground.receiveShadow = true;
    s.add(this.ground);

    // patika (kenarları yumuşak)
    const ac = document.createElement("canvas");
    ac.width = 64; ac.height = 4;
    const ag = ac.getContext("2d");
    const grad = ag.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, "#000"); grad.addColorStop(0.22, "#fff"); grad.addColorStop(0.78, "#fff"); grad.addColorStop(1, "#000");
    ag.fillStyle = grad; ag.fillRect(0, 0, 64, 4);
    this.pathMat = new THREE.MeshStandardMaterial({ ...this.tex.path, alphaMap: new THREE.CanvasTexture(ac), transparent: true, depthWrite: false, color: 0xbab2a6, polygonOffset: true, polygonOffsetFactor: -2 });
    this.path = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), this.pathMat);
    this.path.rotation.x = -Math.PI / 2;
    this.path.receiveShadow = true;
    this.path.renderOrder = 1;
    s.add(this.path);

    // taş malzemeleri
    this.stoneMats = {
      clean: new THREE.MeshStandardMaterial({ ...this.tex.clean, color: 0xb7b6b2, roughness: 1 }),
      mossy: new THREE.MeshStandardMaterial({ ...this.tex.mossy, color: 0xa8aaa0, roughness: 1 }),
    };
    this.ironMat = new THREE.MeshStandardMaterial({ color: 0x1b1c20, metalness: 0.7, roughness: 0.55 });
    this.barkMat = new THREE.MeshStandardMaterial({ color: 0x17141a, roughness: 1 });
    this.moundMat = new THREE.MeshStandardMaterial({ ...this.tex.ground, color: 0x6d6560 });

    // sis bulutları
    this.fogTex = softTexture(128, "rgba(210,215,240,1)");
    this.fogSprites = [];

    // çimen
    this.grassTex = grassTexture();
    this.time = { value: 0 };

    // kapı
    this.gate = new THREE.Group();
    s.add(this.gate);

    this.world = new THREE.Group();
    s.add(this.world);

    this.layout({ user: null, graves: this.placeholderGraves() });
  }

  placeholderGraves() {
    const shapes = ["arch", "round", "gothic", "slab", "obelisk"];
    return Array.from({ length: 16 }, (_, i) => ({
      key: `ph-${i}`,
      shape: shapes[(i * 7 + 3) % 5],
      info: { blank: true, name: `ph-${i}`, cracked: i % 3 === 0 },
      look: { tilt: ((i * 37) % 7) - 3, moss: (i % 4) / 3, cracked: i % 3 === 0, height: 0.9 + ((i * 13) % 20) / 100 },
    }));
  }

  /** Mezarlığı (yeniden) kurar. graves: [{key, shape, look, info, repo}] */
  layout({ user, gateLines, graves }) {
    for (const d of this.disposables) d.dispose?.();
    this.disposables = [];
    this.world.clear();
    this.gate.clear();
    this.stones = [];
    this.lanterns = [];
    this.focus = null;
    this.hovered = null;

    graves = graves.slice(0, MAX_STONES);
    const rows = Math.max(3, Math.ceil(graves.length / COLS.length));
    const endZ = -1 - rows * ROW_GAP;
    this.minZ = endZ + 3.2;
    this.length = -endZ + 6;

    // patikayı boya göre uzat
    const pathLen = this.length + 8;
    this.path.scale.set(2.1, pathLen, 1);
    this.path.position.set(0, 0.012, GATE_Z + 4 - pathLen / 2);
    for (const k of ["map", "normalMap", "roughnessMap"]) this.tex.path[k].repeat.set(1.2, pathLen / 1.8);

    // taşlar
    graves.forEach((gv, i) => {
      const row = Math.floor(i / COLS.length);
      const col = i % COLS.length;
      const r = rnd(hash(gv.key));
      const x = COLS[col] + (r() - 0.5) * 0.35;
      const z = -1.2 - row * ROW_GAP + (r() - 0.5) * 0.5;
      this.addStone(gv, i, x, z, r);
    });

    // çit
    this.buildFence(endZ - 1.5);

    // kapı ve tabela
    this.buildGate(gateLines || (user ? [user, ""] : null));

    // fenerler: patika boyunca dönüşümlü
    for (let z = GATE_Z - 1.2, k = 0; z > endZ; z -= 5.5, k++) {
      this.addLantern(k % 2 ? 1.25 : -1.25, z);
    }

    // dekor: kütükler, kayalar, ağaçlar
    this.decorate(endZ);

    // çimen ve sis
    this.buildGrass(endZ, graves.length);
    this.buildFog(endZ);
  }

  addStone(gv, index, x, z, r) {
    const { shape, look } = gv;
    const { w, h } = stoneSize(shape, look);
    const depth = shape === "obelisk" ? 0.3 : 0.15;
    const geo = new THREE.ExtrudeGeometry(stoneShape(shape, w, h), {
      depth, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 24,
    });
    geo.translate(0, 0, -depth / 2);
    this.disposables.push(geo);
    // UV'leri taş boyutuna göre ölçekle ve rastgele kaydır
    const uv = geo.attributes.uv;
    const ox = r() * 3, oy = r() * 3;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + ox, uv.getY(i) * 0.9 + oy);

    const mossy = look.moss > 0.45;
    const mat = (mossy ? this.stoneMats.mossy : this.stoneMats.clean).clone();
    const tone = 0.5 + r() * 0.16 - look.moss * 0.06;
    mat.color.multiplyScalar(tone);
    this.disposables.push(mat);

    const group = new THREE.Group();
    const body = new THREE.Mesh(geo, mat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // kaide
    if (shape !== "obelisk" && r() > 0.35) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.12, depth + 0.24), mat);
      base.position.y = 0.04;
      base.castShadow = base.receiveShadow = true;
      group.add(base);
      body.position.y = 0.09;
      this.disposables.push(base.geometry);
    } else if (shape === "obelisk") {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, 0.22, depth + 0.26), mat);
      base.position.y = 0.09;
      base.castShadow = base.receiveShadow = true;
      group.add(base);
      body.position.y = 0.19;
      this.disposables.push(base.geometry);
    }

    // yazı
    const tex = engravingTexture({ ...gv.info, cracked: look.cracked }, shape, w, h, this.aniso);
    const plateMat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 1, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4,
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), plateMat);
    plate.position.set(0, body.position.y + h / 2, depth / 2 + 0.0195);
    plate.receiveShadow = true;
    group.add(plate);
    this.disposables.push(tex, plateMat, plate.geometry);

    // toprak tümseği
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.moundMat);
    mound.scale.set(w * 0.62 + 0.08, 0.13 + r() * 0.05, 0.85);
    mound.position.set(0, -0.02, 1.0);
    mound.receiveShadow = true;
    group.add(mound);
    this.disposables.push(mound.geometry);

    group.position.set(x, -0.04, z);
    group.rotation.set(-(r() * 0.06), (r() - 0.5) * 0.14, (look.tilt * Math.PI) / 180);
    group.userData = { index, h: h + body.position.y, gv };
    body.userData.stone = group;
    plate.userData.stone = group;
    this.world.add(group);
    this.stones.push(group);
  }

  buildGate(lines) {
    const g = this.gate;
    const mat = this.stoneMats.mossy;
    const pillarGeo = new THREE.BoxGeometry(0.55, 2.7, 0.55);
    const capGeo = new THREE.BoxGeometry(0.72, 0.16, 0.72);
    const ballGeo = new THREE.SphereGeometry(0.2, 20, 14);
    this.disposables.push(pillarGeo, capGeo, ballGeo);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, mat);
      p.position.set(sx * 1.55, 1.35, GATE_Z);
      const cap = new THREE.Mesh(capGeo, mat);
      cap.position.set(sx * 1.55, 2.78, GATE_Z);
      const ball = new THREE.Mesh(ballGeo, mat);
      ball.position.set(sx * 1.55, 3.04, GATE_Z);
      for (const m of [p, cap, ball]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    }
    // demir kemer
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.035, 8, 48, Math.PI), this.ironMat);
    arch.position.set(0, 2.55, GATE_Z);
    arch.scale.y = 0.42;
    g.add(arch);
    this.disposables.push(arch.geometry);

    // tabela
    if (lines) {
      const c = document.createElement("canvas");
      c.width = 1024; c.height = 220;
      const x = c.getContext("2d");
      x.fillStyle = "#1a1b20";
      x.fillRect(0, 0, 1024, 220);
      x.strokeStyle = "#6e6a5e"; x.lineWidth = 6; x.strokeRect(12, 12, 1000, 196);
      x.textAlign = "center";
      let size = 96;
      x.font = `700 ${size}px "Cormorant Garamond", serif`;
      while (x.measureText(lines[0]).width > 900 && size > 40) { size -= 4; x.font = `700 ${size}px "Cormorant Garamond", serif`; }
      x.fillStyle = "#e9dcb6";
      x.fillText(lines[0], 512, 112);
      x.font = `600 34px Inter, sans-serif`;
      x.fillStyle = "#b4a984";
      x.fillText(lines[1].toLocaleUpperCase(), 512, 178);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.aniso;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.54), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.2, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.08 }));
      sign.position.set(0, 2.62, GATE_Z + 0.02);
      sign.castShadow = true;
      g.add(sign);
      this.disposables.push(t, sign.geometry, sign.material);
    }
  }

  buildFence(endZ) {
    const posts = [];
    const add = (x, z) => posts.push([x, z]);
    for (let z = GATE_Z; z > endZ; z -= 0.22) { add(-FENCE_X, z); add(FENCE_X, z); }
    for (let x = -FENCE_X; x <= -1.9; x += 0.22) add(x, GATE_Z);
    for (let x = 1.9; x <= FENCE_X; x += 0.22) add(x, GATE_Z);
    for (let x = -FENCE_X; x <= FENCE_X; x += 0.22) add(x, endZ);

    const barGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.25, 5);
    barGeo.translate(0, 0.62, 0);
    const tipGeo = new THREE.ConeGeometry(0.028, 0.09, 5);
    tipGeo.translate(0, 1.29, 0);
    const geo = mergeGeometries([barGeo, tipGeo]);
    this.disposables.push(barGeo, tipGeo, geo);
    const inst = new THREE.InstancedMesh(geo, this.ironMat, posts.length);
    const m = new THREE.Matrix4();
    posts.forEach(([x, z], i) => {
      m.makeTranslation(x, -0.03 + ((i * 7) % 5) * 0.004, z);
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    this.world.add(inst);

    // yatay korkuluklar
    const rail = (x1, z1, x2, z2, y) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len), this.ironMat);
      r.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      r.lookAt(x2, y, z2);
      this.world.add(r);
      this.disposables.push(r.geometry);
    };
    for (const y of [0.25, 1.05]) {
      rail(-FENCE_X, GATE_Z, -FENCE_X, endZ, y);
      rail(FENCE_X, GATE_Z, FENCE_X, endZ, y);
      rail(-FENCE_X, GATE_Z, -1.9, GATE_Z, y);
      rail(1.9, GATE_Z, FENCE_X, GATE_Z, y);
      rail(-FENCE_X, endZ, FENCE_X, endZ, y);
    }
  }

  addLantern(x, z) {
    const g = new THREE.Group();
    if (this.models.lantern) {
      const m = this.models.lantern.scene.clone(true);
      m.scale.setScalar(1.5);
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(m);
    } else {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), this.ironMat);
      b.position.y = 0.2;
      g.add(b);
    }
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    flame.position.y = 0.26;
    flame.scale.y = 1.5;
    g.add(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fogTex, color: 0xffa64d, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(1.2, 1.2, 1);
    halo.position.y = 0.28;
    g.add(halo);
    this.disposables.push(flame.geometry, flame.material, halo.material);
    g.position.set(x, 0, z);
    g.rotation.y = x > 0 ? -0.4 : 0.4;
    this.world.add(g);
    this.lanterns.push({ group: g, flame, halo, seed: Math.random() * 100 });
  }

  decorate(endZ) {
    const r = rnd(99);
    if (this.models.log) {
      for (let z = -3; z > endZ; z -= 9 + r() * 6) {
        const m = this.models.log.scene.clone(true);
        m.scale.setScalar(0.7 + r() * 0.4);
        m.position.set((r() > 0.5 ? 1 : -1) * (3.7 + r() * 0.3), 0, z);
        m.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.6;
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.world.add(m);
      }
    }
    if (this.models.rocks) {
      const pieces = this.models.rocks.scene.children.filter((c) => c.isMesh || c.children.length);
      for (let i = 0; i < Math.min(40, 8 + Math.abs(endZ) * 1.2); i++) {
        const src = pieces[Math.floor(r() * pieces.length)];
        if (!src) break;
        const m = src.clone(true);
        m.position.set((r() > 0.5 ? 1 : -1) * (1.05 + r() * 3.2), -0.05, GATE_Z - r() * (GATE_Z - endZ));
        m.scale.setScalar(0.08 + r() * 0.14);
        m.rotation.set(0, r() * Math.PI * 2, 0);
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.world.add(m);
      }
    }
    // çit dışında çıplak ağaç siluetleri
    const treeGeos = [bareTreeGeometry(3), bareTreeGeometry(11), bareTreeGeometry(27)];
    this.disposables.push(...treeGeos);
    for (let z = GATE_Z - 0.5; z > endZ - 6; z -= 3.5 + r() * 3) {
      for (const side of [-1, 1]) {
        if (r() < 0.35) continue;
        const t = new THREE.Mesh(treeGeos[Math.floor(r() * 3)], this.barkMat);
        t.position.set(side * (6.4 + r() * 6), 0, z - r() * 2);
        t.scale.setScalar(0.9 + r() * 0.9);
        t.rotation.y = r() * Math.PI * 2;
        t.castShadow = true;
        this.world.add(t);
      }
    }
    // mezarlığın sonunda büyük bir ağaç
    const big = new THREE.Mesh(treeGeos[0], this.barkMat);
    big.position.set(1.8, 0, endZ - 3);
    big.scale.setScalar(2.1);
    big.castShadow = true;
    this.world.add(big);
  }

  buildGrass(endZ, count) {
    const r = rnd(5);
    const n = Math.min(9000, 2200 + Math.abs(endZ) * 140);
    const p1 = new THREE.PlaneGeometry(0.34, 0.26);
    p1.translate(0, 0.13, 0);
    const p2 = p1.clone().rotateY(Math.PI / 2);
    const geo = mergeGeometries([p1, p2]);
    this.disposables.push(p1, p2, geo);
    const mat = new THREE.MeshStandardMaterial({
      map: this.grassTex, alphaTest: 0.45, side: THREE.DoubleSide, color: 0x56683f, roughness: 1,
    });
    const time = this.time;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
         transformed.x += sin(uTime * 1.3 + ph) * 0.035 * uv.y;
         transformed.z += cos(uTime * 1.1 + ph) * 0.02 * uv.y;`,
      );
    };
    this.disposables.push(mat);
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    let i = 0;
    while (i < n) {
      const x = (r() - 0.5) * 2 * (FENCE_X + 3);
      const z = GATE_Z + 3 - r() * (GATE_Z + 3 - endZ + 2);
      if (Math.abs(x) < 1.05 && r() > 0.08) continue; // patikada az çimen
      const sc = 0.6 + r() * 0.9;
      q.setFromEuler(e.set(0, r() * Math.PI, 0));
      m.compose(new THREE.Vector3(x, -0.02, z), q, new THREE.Vector3(sc, sc * (0.7 + r() * 0.7), sc));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHSL(0.2 + r() * 0.08, 0.3 + r() * 0.2, 0.32 + r() * 0.2));
      i++;
    }
    inst.receiveShadow = true;
    this.world.add(inst);
  }

  buildFog(endZ) {
    const r = rnd(13);
    this.fogSprites = [];
    const n = Math.min(60, 18 + Math.abs(endZ) * 1.2);
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fogTex, transparent: true, opacity: 0.035 + r() * 0.05, depthWrite: false, color: 0xc4c8e6 }));
      const w = 4 + r() * 5;
      sp.scale.set(w, w * 0.32, 1);
      sp.position.set((r() - 0.5) * 14, 0.2 + r() * 0.4, GATE_Z - r() * (GATE_Z - endZ));
      sp.userData.speed = 0.05 + r() * 0.12;
      this.world.add(sp);
      this.fogSprites.push(sp);
      this.disposables.push(sp.material);
    }
  }

  /* ---------- durumlar ---------- */

  setGraves(user, gateSub, graves) {
    this.layout({ user, gateLines: [user, gateSub], graves });
    this.mode = "intro";
    this.camZ = 11;
    this.targetZ = GATE_Z + 2.4;
    this.camera.position.set(0, 3.4, 12);
    this.introT = 0;
  }

  showLanding() {
    this.layout({ user: null, graves: this.placeholderGraves() });
    this.mode = "landing";
    this.focus = null;
  }

  focusIndex(i) {
    if (!this.stones.length) return;
    i = (i + this.stones.length) % this.stones.length;
    this.focus = this.stones[i];
    this.mode = "focus";
    this.onSelect(this.focus.userData.gv, i);
  }

  unfocus() {
    if (!this.focus) return;
    this.targetZ = Math.min(GATE_Z + 2.4, this.focus.position.z + 3.2);
    this.focus = null;
    this.mode = "walk";
    this.onSelect(null);
  }

  walk(delta) {
    if (this.mode === "landing") return;
    if (this.mode === "focus") this.unfocus();
    if (this.mode === "intro") this.mode = "walk";
    this.targetZ = THREE.MathUtils.clamp(this.targetZ + delta, this.minZ, GATE_Z + 2.4);
  }

  /* ---------- girdi ---------- */

  bindInput() {
    const c = this.canvas;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(9, 9);
    c.addEventListener("wheel", (e) => {
      if (this.mode === "landing") return;
      e.preventDefault();
      this.walk(-Math.sign(e.deltaY) * Math.min(1.4, Math.abs(e.deltaY) * 0.006));
    }, { passive: false });

    let drag = null;
    c.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId, type: e.pointerType };
    });
    addEventListener("pointermove", (e) => {
      const rect = c.getBoundingClientRect();
      this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerYaw = -this.ndc.x * 0.28;
      this.pointerPitch = this.ndc.y * 0.08;
      this.pointerPx = { x: e.clientX, y: e.clientY };
      if (drag && drag.id === e.pointerId && drag.type !== "mouse") {
        const dy = e.clientY - drag.y;
        const dx = e.clientX - drag.x;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        this.walk(dy * 0.02);
        this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.004, -0.7, 0.7);
        drag.x = e.clientX;
        drag.y = e.clientY;
      } else if (drag && drag.id === e.pointerId) {
        drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      }
    });
    addEventListener("pointerup", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const click = drag.moved < 8;
      drag = null;
      if (!click || this.mode === "landing") return;
      const rect = c.getBoundingClientRect();
      if (e.target !== c) return;
      this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const hit = this.pick();
      if (hit) this.focusIndex(hit.userData.index);
      else if (this.mode === "focus") this.unfocus();
    });
    c.addEventListener("pointerleave", () => this.ndc.set(9, 9));
  }

  pick() {
    if (!this.stones.length || this.ndc.x > 2) return null;
    this.ray.setFromCamera(this.ndc, this.camera);
    const meshes = [];
    for (const s of this.stones) meshes.push(s.children[0]);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    if (!hit || hit.distance > 14) return null;
    return hit.object.userData.stone || hit.object.parent;
  }

  /* ---------- döngü ---------- */

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  placeSky(cam) {
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
    this.moon.position.set(cam.position.x - 30, cam.position.y + 30, cam.position.z - 70);
    // ay ışığı kameranın etrafında gölge üretsin
    const tz = cam.position.z - 5;
    this.moonLight.position.set(-12, 20, tz + 16);
    this.moonLight.target.position.set(0, 0, tz);
  }

  updateLights(z, t) {
    const near = this.lanterns
      .map((l) => ({ l, d: Math.abs(l.group.position.z - z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lightPool.length);
    this.lightPool.forEach((light, i) => {
      const n = near[i];
      if (!n) { light.intensity = 0; return; }
      const { group, seed } = n.l;
      light.position.set(group.position.x, 0.5, group.position.z);
      const flick = this.reduceMotion ? 1 : 0.86 + Math.sin(t * 9 + seed) * 0.06 + Math.sin(t * 23.7 + seed * 2) * 0.05 + Math.random() * 0.04;
      light.intensity = 2.6 * flick;
    });
    for (const l of this.lanterns) {
      const f = this.reduceMotion ? 1 : 0.9 + Math.sin(t * 11 + l.seed) * 0.08;
      l.halo.material.opacity = 0.3 * f;
      l.flame.scale.set(1, 1.5 * f, 1);
    }
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.time.value = t;
    const cam = this.camera;

    // hover
    if (this.mode !== "landing") {
      const hit = this.pick();
      if (hit !== this.hovered) {
        if (this.hovered) this.hovered.children[0].material.emissive.setHex(0x000000);
        this.hovered = hit;
        if (hit) hit.children[0].material.emissive.setHex(0x1c1206);
        this.canvas.style.cursor = hit ? "pointer" : "";
        this.onHover(hit ? hit.userData.gv : null, this.pointerPx);
      } else if (hit) {
        this.onHover(hit.userData.gv, this.pointerPx);
      }
    }

    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const k = this.reduceMotion ? 8 : 2.6;

    if (this.mode === "landing") {
      const z = 10.5 + Math.sin(t * 0.12) * 0.8;
      pos.set(Math.sin(t * 0.09) * 0.6, 2.2, z);
      look.set(0, 1.2, -4);
    } else if (this.mode === "focus" && this.focus) {
      const s = this.focus;
      const side = s.position.x > 0 ? 1 : -1;
      const h = s.userData.h;
      pos.set(s.position.x - side * 0.35, Math.max(1.0, h * 0.72 + 0.35), s.position.z + 1.55 + h * 0.35);
      look.set(s.position.x, h * 0.55, s.position.z);
      this.camZ = pos.z;
      this.targetZ = pos.z;
    } else {
      if (this.mode === "intro") {
        this.introT += dt;
        if (this.introT > 3.5) this.mode = "walk";
      }
      this.camZ = damp(this.camZ, this.targetZ, this.mode === "intro" ? 1.1 : 3, dt);
      const bob = this.reduceMotion ? 0 : Math.sin(this.camZ * 2.4) * 0.025;
      this.yaw = damp(this.yaw, 0, 0.6, dt);
      const yaw = this.yaw + this.pointerYaw;
      pos.set(Math.sin(t * 0.3) * 0.04, 1.62 + bob, this.camZ);
      look.set(pos.x + Math.sin(yaw) * 4, 1.25 + (this.pointerPitch || 0) * 4, pos.z - Math.cos(yaw) * 4);
    }

    if (!this.lookAt) this.lookAt = look.clone();
    cam.position.x = damp(cam.position.x, pos.x, k, dt);
    cam.position.y = damp(cam.position.y, pos.y, this.mode === "intro" ? 1.2 : k, dt);
    cam.position.z = damp(cam.position.z, pos.z, this.mode === "intro" ? 1.4 : k, dt);
    this.lookAt.x = damp(this.lookAt.x, look.x, k, dt);
    this.lookAt.y = damp(this.lookAt.y, look.y, k, dt);
    this.lookAt.z = damp(this.lookAt.z, look.z, k, dt);
    cam.lookAt(this.lookAt);

    // sis sürüklenmesi
    if (!this.reduceMotion) {
      for (const f of this.fogSprites) {
        f.position.x += f.userData.speed * dt;
        if (f.position.x > 8) f.position.x = -8;
      }
    }

    this.placeSky(cam);
    this.updateLights(cam.position.z - 2, t);
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    this.carryLight.position.copy(cam.position).addScaledVector(fwd, 0.6).add(new THREE.Vector3(0.25, -0.35, 0));
    const want = this.mode === "landing" ? 0 : this.mode === "focus" ? 3.4 : 2.6;
    this.carryLight.intensity = damp(this.carryLight.intensity, want * (this.reduceMotion ? 1 : 0.95 + Math.sin(t * 7) * 0.03), 2, dt);
    this.composer.render();
  }

  /* ---------- poster ---------- */

  /** Sahneyi verilen boyutta (poster için) render eder ve canvas döner. */
  capture(w, h) {
    const r = this.renderer;
    const cam = this.camera;
    const prev = { pr: r.getPixelRatio(), pos: cam.position.clone(), q: cam.quaternion.clone(), aspect: cam.aspect, fov: cam.fov };
    const hovered = this.hovered;
    if (hovered) hovered.children[0].material.emissive.setHex(0);

    r.setPixelRatio(1);
    r.setSize(w, h, false);
    this.composer.setPixelRatio?.(1);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    const portrait = h > w;
    cam.aspect = w / h;
    cam.fov = portrait ? 62 : 48;
    cam.updateProjectionMatrix();
    cam.position.set(0.0, portrait ? 2.3 : 2.05, GATE_Z + (portrait ? 5.4 : 4.6));
    cam.lookAt(0, portrait ? 1.35 : 1.55, GATE_Z - 6);
    this.placeSky(cam);
    this.updateLights(GATE_Z - 2, 0);
    this.composer.render();

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d").drawImage(r.domElement, 0, 0, w, h);

    cam.position.copy(prev.pos);
    cam.quaternion.copy(prev.q);
    r.setPixelRatio(prev.pr);
    this.resize();
    if (hovered) hovered.children[0].material.emissive.setHex(0x1c1206);
    return out;
  }
}
