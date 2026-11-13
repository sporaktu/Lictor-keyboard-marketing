// The 3D drawing of the Lictor. Everything is in millimetres; x is to the
// right, y is up and z is toward the typist. The models come from the board
// and case files (tools/site_build.py); keycaps, knobs and screens are drawn
// here, because the project has no model of them.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SIDES = ['left', 'right'];
const GAP = 34;                    // between the halves' inner top corners
const YAW = THREE.MathUtils.degToRad(7);
const CAP_BOTTOM = 11.8, CAP_HEIGHT = 7.8;      // keycap skirt above the board top, keycap height
const SOCKET_HEIGHT = 8.5;         // the screen stands this far above the board
const UNDERSIDE_ROOM = 4.8;        // tallest part under a bare board: it rests on that
const LED_TOWARD_TYPIST = 4.75;    // the key light's window, from the key's centre

export const STAGES = [
  { name: 'Bare board', note: 'As the board factory makes it: two layers, black, with gold pads. The figure is the logo, printed on both faces.' },
  { name: 'From the factory', note: 'Every part the factory solders is on the underside: radio module, sockets, lights, USB-C, charger. Turn it over to see them.' },
  { name: 'Switches', note: 'MX switches push into the sockets. No soldering, and no plate: use five-pin switches.' },
  { name: 'Keycaps', note: 'Forty one-unit keycaps. Any MX set has them.' },
  { name: 'In its case', note: 'A tray and a small cover over the electronics, printed or machined.' },
];

const M = {
  mask: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
  body: new THREE.MeshStandardMaterial({ color: 0x23211a, roughness: 0.7 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xe9e8e2, roughness: 0.8 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xcaa24a, roughness: 0.32, metalness: 1 }),
  plastic: new THREE.MeshPhysicalMaterial({ color: 0x3a3d42, roughness: 0.62 }),
  cover: new THREE.MeshPhysicalMaterial({ color: 0x2c2f33, roughness: 0.7 }),
  aluminium: new THREE.MeshStandardMaterial({ color: 0xc3c6c9, roughness: 0.36, metalness: 1 }),
  cap: new THREE.MeshPhysicalMaterial({ color: 0xe9e7e1, roughness: 0.74, sheen: 0.15, sheenRoughness: 0.8 }),
  capDark: new THREE.MeshPhysicalMaterial({ color: 0x2a2d31, roughness: 0.74, sheen: 0.15, sheenRoughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9bbbd, roughness: 0.38, metalness: 1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 1 }),
  knob: new THREE.MeshStandardMaterial({ color: 0xc4c6c8, roughness: 0.46, metalness: 0.55 }),
  screenBoard: new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.5 }),
  lcd: new THREE.MeshPhysicalMaterial({ color: 0x9aa398, roughness: 0.3, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 }),
};

// ---------------------------------------------------------------- drawn parts

function ring(hw, hd, r, y, k = 7) {
  const out = [], corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let q = 0; q < 4; q++) for (let i = 0; i <= k; i++) {
    const a = (q + i / k) * Math.PI / 2;
    out.push([corner[q][0] * (hw - r) + r * Math.cos(a), y, -(corner[q][1] * (hd - r) + r * Math.sin(a))]);
  }
  return out;
}

function keycapGeometry() {        // an invented uniform profile, 18 mm square at the skirt
  const rings = [], H = CAP_HEIGHT, rf = 1.1, Hs = H - rf, dish = 0.65, w0 = 9.0, wt = 6.95, dt = 7.35;
  rings.push(ring(w0 - 0.35, w0 - 0.35, 1.0, 0), ring(w0, w0, 1.3, 0.4));
  for (let i = 1; i <= 7; i++) {
    const t = i / 7, e = t + 0.10 * Math.sin(Math.PI * t) * (1 - t);
    rings.push(ring(w0 + (wt - w0) * e, w0 + (dt - w0) * e, 1.3 + 1.3 * t, 0.4 + (Hs - 0.4) * t));
  }
  let last;
  for (let i = 1; i <= 5; i++) {
    const a = i / 5 * Math.PI / 2, inn = rf * (1 - Math.cos(a));
    last = [wt - inn, dt - inn, 2.6 - inn * 0.6];
    rings.push(ring(last[0], last[1], last[2], Hs + rf * Math.sin(a)));
  }
  for (const s of [0.88, 0.74, 0.58, 0.42, 0.26, 0.12]) rings.push(ring(last[0] * s, last[1] * s, last[2] * s, H - dish * (1 - s * s)));
  const n = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(...p);
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = a + n, d = b + n;
    idx.push(a, b, d, a, d, c);
  }
  const top = pos.length / 3; pos.push(0, H - dish, 0);
  const lastRing = (rings.length - 1) * n;
  for (let i = 0; i < n; i++) idx.push(lastRing + i, lastRing + (i + 1) % n, top);
  const b0 = pos.length / 3; for (const p of rings[0]) pos.push(...p);
  const bc = pos.length / 3; pos.push(0, 0, 0);
  for (let i = 0; i < n; i++) idx.push(b0 + (i + 1) % n, b0 + i, bc);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function knobGeometry() {          // 15 mm across and tall
  const R = 7.5, H = 15, p = [[0, 0], [R - 0.5, 0], [R, 0.5], [R, 3.0], [R - 0.25, 3.25], [R - 0.25, 3.75], [R, 4.0], [R, H - 1.0]];
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; p.push([R - 1.0 + Math.cos(a), H - 1.0 + Math.sin(a)]); }
  p.push([4.5, H], [4.3, H - 0.25], [0, H - 0.25]);
  return new THREE.LatheGeometry(p.map(q => new THREE.Vector2(q[0], q[1])), 72);
}

const CAP = keycapGeometry(), KNOB = knobGeometry();

function box(w, h, d, y, mat) {    // centred in plan, from y to y + h
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y + h / 2; return m;
}
function cylinder(r, h, y, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mat); m.position.y = y + h / 2; return m;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- the viewer

export function createViewer(canvas, data, onChange) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-160, 420, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 200, bottom: -200, near: 50, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 5;
  scene.add(sun);
  const below = new THREE.DirectionalLight(0xffffff, 1.7);       // so the underside can be seen when turned over
  below.position.set(140, -400, -120); scene.add(below);

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShadowMaterial({ opacity: 0.26 }));
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

  const camera = new THREE.PerspectiveCamera(26, 1, 20, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 120; controls.maxDistance = 1400;
  controls.enableZoom = false;       // the wheel scrolls the page; the two buttons zoom
  controls.enablePan = false;
  controls.target.set(0, 8, 30);
  camera.position.set(0, 560, 420);

  const C = data.case, TOP = C.board_bottom + C.board;      // heights above the desk, inside a case
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const glow = glowTexture();
  const state = { stage: 5, lights: true, lit: false, screen: true, inner: 'switch', tray: 'plastic', explode: 0, layer: 0, under: false };
  const halves = {};
  let pending = 0, dirty = true, explodeNow = 0;

  // Each half: a pivot at its inner top corner, a lift that sets it on the
  // desk, and one group per kind of part, which the exploded view moves apart.
  const SPREAD = { tray: -46, corner: -30, parts: -13, lights: -13, board: 0, socket: 9, switches: 16, inner: 16,
                   encoders: 16, caps: 38, knobs: 38, screen: 30, cover: 56, glow: 1, indicator: 0 };

  for (const side of SIDES) {
    const d = data.halves[side], sign = side === 'left' ? -1 : 1;
    const pivot = new THREE.Group(), lift = new THREE.Group(), frame = new THREE.Group();
    pivot.position.set(sign * GAP / 2, 0, 0); pivot.rotation.y = sign * YAW;
    frame.position.set(-d.inner_edge, 0, d.extent[3]);       // inner top corner to the pivot
    pivot.add(lift); lift.add(frame); scene.add(pivot);
    const groups = {};
    for (const name of Object.keys(SPREAD)) { groups[name] = new THREE.Group(); groups[name].visible = false; frame.add(groups[name]); }
    halves[side] = { d, lift, frame, groups, loaded: {}, liftNow: 0 };

    const at = (k, y) => { const g = new THREE.Group(); g.position.set(k.x, y, -k.y); g.rotation.y = THREE.MathUtils.degToRad(k.rot); return g; };
    for (const k of d.keys) {
      const isInner = k.name.startsWith('extra_');
      const cap = new THREE.Mesh(CAP, k.name === 'thumb_home' ? M.capDark : M.cap);
      const holder = at(k, TOP + CAP_BOTTOM); holder.add(cap);
      holder.userData.inner = isInner; groups.caps.add(holder);
      if (isInner) {
        const body = at(k, TOP);
        body.add(box(12.4, 6.5, 13.2, 0, M.metal), cylinder(3.5, 2.6, 6.5, M.metal), cylinder(3.0, 3, 7, M.steel));
        groups.encoders.add(body);
        const knob = at(k, TOP + 8); knob.add(new THREE.Mesh(KNOB, M.knob)); groups.knobs.add(knob);
      }
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(26, 26),
        new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
          color: new THREE.Color().setHSL((k.x * sign + 90) / 400 + 0.52, 0.9, 0.55) }));
      spot.rotation.x = -Math.PI / 2;
      const s = at(k, TOP + 0.6); s.add(spot); spot.position.z = LED_TOWARD_TYPIST; groups.glow.add(s);
    }
    // The screen: a small board on its socket, with the display on top.
    const xs = d.screen.map(p => p[0]), ys = d.screen.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const screen = new THREE.Group();
    screen.position.set((Math.max(...xs) + Math.min(...xs)) / 2, TOP + SOCKET_HEIGHT, -(Math.max(...ys) + Math.min(...ys)) / 2);
    screen.add(box(w, 1.2, h, 0, M.screenBoard), box(w - 1.6, 1.6, h - 7, 1.2, M.steel));
    const glass = box(w - 3.2, 0.25, h - 10.5, 2.8, M.lcd); screen.add(glass);
    groups.screen.add(screen);
    // The layer light, on the left half only: the right half does not know the layer.
    const dot = new THREE.Mesh(new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    dot.rotation.x = -Math.PI / 2; dot.position.set(d.lights.layer[0], TOP + 0.3, -d.lights.layer[1]);
    dot.renderOrder = 5; groups.indicator.add(dot); halves[side].dot = dot;
    for (const g of [groups.caps, groups.encoders, groups.knobs, groups.screen]) shadows(g);
  }

  function shadows(root) { root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }

  function boardMaterial(m) {       // KiCad's own colours tell the layers apart
    const c = m.color;
    if (c.r > 0.8 && c.g > 0.8 && c.b > 0.8) return M.silk;
    if (c.g > c.r * 1.5 && c.r < 0.3) return M.mask;
    if (Math.abs(c.r - c.g) < 0.02 && Math.abs(c.g - c.b) < 0.02) return M.body;
    return M.gold;
  }

  function load(side, file, kind, group, material) {
    const h = halves[side], key = file;
    if (h.loaded[key]) return h.loaded[key];
    pending++; status();
    const holder = new THREE.Group(); holder.visible = false; group.add(holder);
    h.loaded[key] = holder;
    loader.load(new URL(`models/${side}/${file}.glb`, import.meta.url).href, gltf => {
      const model = gltf.scene;
      if (kind === 'kicad') {       // metres, origin at the page corner, board from 0 up
        model.scale.setScalar(1000); model.position.set(-150, C.board_bottom, -100);
      }
      model.traverse(o => {
        if (!o.isMesh) return;
        if (material) o.material = material;
        else if (file === 'board') o.material = boardMaterial(o.material);
        else { o.material.transparent = false; o.material.opacity = 1; o.material.depthWrite = true; }
      });
      shadows(model); holder.add(model);
      pending--; status(); apply();
    }, undefined, () => { pending--; status('Part of the drawing did not load. Reload the page to try again.'); });
    return holder;
  }

  function status(message) {
    onChange && onChange({ loading: pending > 0, message });
  }

  function show(side, name, file, on, kind, material) {
    const h = halves[side];
    const holder = on ? load(side, file, kind, h.groups[name], material) : h.loaded[file];
    if (holder) holder.visible = on;
    return holder;
  }

  function apply() {
    const s = state.stage, metal = state.tray === 'metal';
    for (const side of SIDES) {
      const h = halves[side], g = h.groups;
      for (const name of Object.keys(g)) g[name].visible = true;
      show(side, 'board', 'board', true, 'kicad');
      show(side, 'parts', 'parts', s >= 2, 'kicad');
      show(side, 'lights', 'lights', s >= 2 && state.lights, 'kicad');
      show(side, 'socket', 'socket', s >= 3 && state.screen, 'kicad');
      show(side, 'switches', 'switches', s >= 3, 'kicad');
      show(side, 'inner', 'switches-inner', s >= 3 && state.inner === 'switch', 'kicad');
      show(side, 'tray', 'tray', s >= 5 && !metal, 'case', M.plastic);
      show(side, 'tray', 'tray-metal', s >= 5 && metal, 'case', M.aluminium);
      show(side, 'corner', 'antenna-corner', s >= 5 && metal, 'case', M.plastic);
      show(side, 'cover', 'cover-display', s >= 5 && state.screen, 'case', M.cover);
      show(side, 'cover', 'cover-plain', s >= 5 && !state.screen, 'case', M.cover);
      g.screen.visible = s >= 3 && state.screen;
      g.encoders.visible = s >= 3 && state.inner === 'knob';
      g.knobs.visible = s >= 4 && state.inner === 'knob';
      g.caps.visible = s >= 4;
      for (const c of g.caps.children) c.visible = !(c.userData.inner && state.inner === 'knob');
      g.glow.visible = s >= 2 && state.lights && state.lit;
      const colour = data.layers[state.layer].light;
      g.indicator.visible = side === 'left' && s >= 2 && !!colour;
      if (colour) h.dot.material.color.set(colour);
      h.dot.position.y = (s >= 5 ? C.cover_top : TOP) + 0.3;
      h.liftTo = s >= 5 ? 0 : s >= 2 ? UNDERSIDE_ROOM - C.board_bottom : -C.board_bottom;
    }
    dirty = true;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep both halves in view on a narrow screen by standing further back.
    const need = 385 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const dist = camera.position.distanceTo(controls.target);
    if (!resize.done || dist < need * 0.6) {
      camera.position.sub(controls.target).setLength(Math.max(need, 430)).add(controls.target);
      resize.done = true;
    }
    camera.updateProjectionMatrix(); dirty = true;
  }

  let flight = null;
  const ACROSS = new THREE.Vector3(1, 0, 0);
  function fly() {                  // turn the view over: swing the camera half way round, past the front edge
    // Asked again part way round, it turns back the way it came.
    if (flight) { flight.step = -flight.step; return; }
    flight = { from: camera.position.clone().sub(controls.target), t: 0, step: 0.03 };
  }

  function frame() {
    requestAnimationFrame(frame);
    let moving = controls.update();
    if (flight) {
      flight.t = Math.min(1, Math.max(0, flight.t + flight.step));
      const e = flight.t * flight.t * (3 - 2 * flight.t);
      const v = flight.from.clone().applyAxisAngle(ACROSS, Math.sign(flight.from.z || 1) * Math.sign(flight.from.y || 1) * e * Math.PI);
      camera.position.copy(controls.target).add(v); camera.lookAt(controls.target);
      if (flight.t >= 1 || flight.t <= 0) flight = null;
      moving = true;
    }
    if (Math.abs(explodeNow - state.explode) > 0.001) {
      // Stand further back as the parts move apart, so they stay in view.
      const was = 1 + 0.42 * explodeNow;
      explodeNow += (state.explode - explodeNow) * 0.18;
      const v = camera.position.clone().sub(controls.target).multiplyScalar((1 + 0.42 * explodeNow) / was);
      controls.target.y = 8 + 34 * explodeNow;
      camera.position.copy(controls.target).add(v);
      moving = true;
    }
    for (const side of SIDES) {
      const h = halves[side];
      if (Math.abs(h.liftNow - h.liftTo) > 0.01) { h.liftNow += (h.liftTo - h.liftNow) * 0.2; moving = true; }
      h.lift.position.y = h.liftNow + (state.stage >= 5 ? 46 : 14) * explodeNow;
      for (const [name, f] of Object.entries(SPREAD)) h.groups[name].position.y = f * explodeNow;
    }
    if (moving || dirty) { renderer.render(scene, camera); dirty = false; }
  }

  controls.addEventListener('change', () => { dirty = true; });
  new ResizeObserver(resize).observe(canvas);
  resize(); apply(); frame();

  return {
    state,
    zoom(factor) {
      const v = camera.position.clone().sub(controls.target);
      v.setLength(THREE.MathUtils.clamp(v.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(v); dirty = true;
    },
    set(change) {
      const before = state.under;
      Object.assign(state, change);
      // An option that shows only at a later stage moves the build on to it.
      if ('tray' in change || ('screen' in change && state.stage < 3)) state.stage = 'tray' in change ? 5 : Math.max(state.stage, 3);
      if ('inner' in change) state.stage = Math.max(state.stage, 3);
      if ('lights' in change || 'lit' in change) state.stage = Math.max(state.stage, 2);
      if (state.lit && !state.lights && 'lit' in change) state.lights = true;
      if ('lights' in change && !state.lights) state.lit = false;
      if (state.under !== before) fly();
      apply(); onChange && onChange({ loading: pending > 0 });
    },
  };
}
