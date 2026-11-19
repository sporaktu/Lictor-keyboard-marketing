// The layer explorer: the keymap in firmware/config/lictor.keymap, drawn on
// the Lictor's 40 positions. The data is written by tools/site_build.py.

const NS = 'http://www.w3.org/2000/svg';
const KEY = 17.2;                 // drawn key size, mm; the pitch is 19.05

// What each layer is for, in the order the keymap has them.
const ABOUT = {
  BASE: 'Letters. The thumbs hold the other layers: NAV and HOMELEFT on the left, HOMERIGHT and NUMBER on the right.',
  NAV: 'Arrows, Home, End and paging under both hands. The knobs step up and down.',
  MOUSE: 'Reached from NAV. It is mostly empty in this keymap, ready to be filled.',
  GAMING: 'WASD moved one column in, with a number pad under the right hand. It stays on until a combo returns to BASE.',
  GAMING2: 'A second set of game keys, held from GAMING.',
  GAMING3: 'A third set, with 1, 2 and 3 under the index finger.',
  NUMBER: 'A number pad under the right hand and brackets under the left. The knobs step right and left.',
  SYMBOL: 'The number pad\'s keys with Shift held.',
  HOMELEFT: 'Held by the left thumb: sticky modifiers on the home row, with Esc, Tab, Delete and Backspace above.',
  HOMERIGHT: 'The same under the right hand, held by the right thumb.',
  FUNCTION: 'F1 to F12, laid out as a number pad under each hand.',
  SYSTEM: 'Bluetooth profiles, USB or Bluetooth output, restart, the bootloader and the ZMK Studio unlock.',
  BASE_MAC: 'BASE for a Mac. It holds the Mac versions of the two home layers.',
  HOMELEFT_MAC: 'HOMELEFT with Ctrl and GUI swapped, for a Mac.',
  HOMERIGHT_MAC: 'HOMERIGHT with Ctrl and GUI swapped, for a Mac.',
};

// The colours on the map, for the key under them. Drawn when the page has a
// [data-key-legend] list.
const KINDS = [
  ['key', 'Types a letter, number or symbol'],
  ['layer', 'Changes layer: hold it, or tap it where it says so'],
  ['mod', 'Shift, Ctrl, Alt or GUI'],
  ['system', 'Bluetooth, USB and other settings'],
  ['trans', 'Left alone: does what the layer underneath does'],
  ['held', 'Held down to reach this layer'],
];

const FINGER = { pinky: 'little finger', ring: 'ring finger', middle: 'middle finger', index: 'index finger' };
const THUMB = { near: 'outer', home: 'middle', far: 'inner' };

// Where a key is, in words: "right thumb, outer key", "left index finger, top row".
export function where(p) {
  const [part, row] = p.name.split('_');
  if (part === 'thumb') return `${p.side} thumb, ${THUMB[row]} key`;
  if (part === 'extra') return `${p.side} index finger, two keys in, ${row} key`;
  if (part === 'inner') return `${p.side} index finger, one key in, ${row} row`;
  return `${p.side} ${FINGER[part]}, ${row} row`;
}

// How each layer is reached from BASE: the shortest run of layer keys and
// combos, each one held (gone again when it is let go) or switched to (stays).
export function routes(data) {
  const index = Object.fromEntries(data.layers.map((l, i) => [l.name, i]));
  const ways = data.layers.map(() => []);
  data.layers.forEach((layer, from) => layer.keys.forEach((k, pos) => {
    const to = index[k.to];
    if (to === undefined || to === from) return;
    ways[from].push({ from, to, pos, hold: /hold for the/i.test(k.d || ''), name: k.to });
  }));
  for (const c of data.combos) {
    if (c.does.k !== 'layer' || index[c.does.to] === undefined) continue;
    const on = c.layers.length ? c.layers.map(n => index[n]) : data.layers.map((_, i) => i);
    for (const from of on) {
      if (index[c.does.to] !== from) ways[from].push({ from, to: index[c.does.to], combo: c.keys, hold: false, name: c.does.to });
    }
  }
  // Held ways first, so a layer is reached by holding where it can be.
  ways.forEach(w => w.sort((a, b) => b.hold - a.hold));
  const route = data.layers.map(() => null);
  route[0] = [];
  const queue = [0];
  while (queue.length) {
    const at = queue.shift();
    for (const w of ways[at]) {
      if (route[w.to]) continue;
      route[w.to] = [...route[at], w];
      queue.push(w.to);
    }
  }
  return route;
}

// The keys still held down once a route is followed: the held keys after the
// last switch.
export function heldOn(route) {
  const after = route.findLastIndex(w => !w.hold);
  return route.slice(after + 1).filter(w => w.pos !== undefined);
}

function el(name, attrs = {}, text) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createLayers(root, data, onLayer) {
  const tabs = root.querySelector('[data-tabs]'), svg = root.querySelector('svg');
  const about = root.querySelector('[data-about]'), knob = root.querySelector('[data-knob]');
  const combos = root.querySelector('[data-combos]'), hint = root.querySelector('[data-hint]');
  const reach = root.querySelector('[data-route]'), kinds = root.querySelector('[data-key-legend]');
  const P = data.positions, half = KEY / 2;
  const xs = P.map(p => p.x), ys = P.map(p => p.y);
  const box = [Math.min(...xs) - 16, Math.min(...ys) - 14, Math.max(...xs) + 16, Math.max(...ys) + 16];
  svg.setAttribute('viewBox', `${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`);
  let current = 0, marked = [];           // marked: keys a guide points at, on this layer
  const route = routes(data);

  const index = Object.fromEntries(data.layers.map((l, i) => [l.name, i]));
  // A see-through key shows what the BASE layer has there, faintly.
  const legend = (layer, i) => data.layers[layer].keys[i].t || data.layers[0].keys[i].t;

  data.layers.forEach((layer, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.role = 'tab'; b.dataset.layer = i;
    const dot = document.createElement('span'); dot.className = 'light';
    if (layer.light) dot.style.setProperty('--light', layer.light); else dot.classList.add('dark');
    b.append(dot, layer.name.replace(/_/g, ' '));
    b.addEventListener('click', () => select(i));
    tabs.append(b);
  });

  if (kinds) {
    kinds.replaceChildren(...KINDS.map(([kind, words]) => {
      const li = document.createElement('li');
      const swatch = document.createElement('span'); swatch.className = `swatch ${kind}`;
      li.append(swatch, words);
      return li;
    }));
  }

  // A key by its legend, and where it is when the legend alone is not enough.
  function named(layer, n) {
    const t = legend(layer, n);
    const twice = data.layers[layer].keys.filter((_, i) => legend(layer, i) === t).length > 1;
    return !t ? where(P[n]) : twice ? `${t} (${where(P[n])})` : t;
  }

  // What the route to a layer says, in a sentence or two.
  function describe(i) {
    const steps = route[i];
    if (!i) return 'Where you start, and where you come back to when you let go: the letters.';
    if (!steps) return 'No key in this keymap leads here.';
    const parts = steps.map(w => {
      if (w.combo) return `press ${w.combo.map(n => named(w.from, n)).join(' + ')} together`;
      return `${w.hold ? 'hold' : 'tap'} ${data.layers[w.from].keys[w.pos].t} (${where(P[w.pos])})`;
    });
    const words = parts.join(', then ');
    const last = steps[steps.length - 1];
    const stays = last.hold ? 'Let go and you are back where you were.' : 'It stays on until you switch back.';
    return `To get here from BASE: ${words}. ${stays}`;
  }

  function draw() {
    const layer = data.layers[current];
    const held = route[current] ? heldOn(route[current]) : [];
    const holding = Object.fromEntries(held.map(w => [w.pos, w]));
    svg.replaceChildren();
    P.forEach((p, i) => {
      const k = layer.keys[i], h = holding[i];
      const kind = h ? 'held' : k.k;
      const g = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})`, class: `key ${kind}`, 'data-pos': i });
      if (marked.includes(i)) g.classList.add('target');
      g.append(el('rect', { x: -half, y: -half, width: KEY, height: KEY, rx: 2.4 }));
      const text = h ? data.layers[h.from].keys[i].t : k.t || data.layers[0].keys[i].t;
      const size = text.length > 6 ? 3.1 : text.length > 3 ? 3.9 : text.length > 1 ? 5 : 6.6;
      g.append(el('text', { y: k.h || h ? -1.2 : 0.4, 'font-size': size, class: 'tap' }, text));
      if (h) g.append(el('text', { y: 5.4, 'font-size': 3, class: 'hold' }, 'held'));
      else if (k.h) g.append(el('text', { y: 5.4, 'font-size': 3, class: 'hold' }, k.h));
      const what = h ? `Held down: it keeps this layer on` : k.d || (k.k === 'mod' ? `${k.t} modifier` : `Types ${k.t}`);
      g.append(el('title', {}, what));
      if (!h && k.to !== undefined && index[k.to] !== undefined) {
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
        g.setAttribute('aria-label', `${what}. Show the ${k.to} layer`);
        const go = () => select(index[k.to]);
        g.addEventListener('click', go);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
      g.addEventListener('pointerenter', () => { hint.textContent = what; });
      g.addEventListener('pointerleave', () => { hint.textContent = ''; });
      svg.append(g);
    });

    about.textContent = ABOUT[layer.name] || '';
    if (reach) reach.textContent = describe(current);
    knob.textContent = `${layer.knob}.`;
    const active = data.combos.filter(c => !c.layers.length || c.layers.includes(layer.name));
    combos.replaceChildren();
    if (!active.length) {
      const li = document.createElement('li'); li.textContent = 'No combos on this layer.'; combos.append(li);
    }
    for (const c of active) {
      const li = document.createElement('li');
      const keys = document.createElement('span'); keys.className = 'chord';
      c.keys.forEach(i => { const kbd = document.createElement('kbd'); kbd.textContent = legend(current, i) || 'thumb'; keys.append(kbd); });
      const does = document.createElement('span');
      does.textContent = c.does.k === 'layer' ? `back to ${c.does.to}`.replace('back to GAMING', 'on to GAMING') : c.does.t;
      li.append(keys, does);
      const mark = on => c.keys.forEach(i => svg.querySelector(`[data-pos="${i}"]`)?.classList.toggle('chorded', on));
      li.addEventListener('pointerenter', () => mark(true)); li.addEventListener('pointerleave', () => mark(false));
      li.tabIndex = 0; li.addEventListener('focus', () => mark(true)); li.addEventListener('blur', () => mark(false));
      combos.append(li);
    }
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', i === current));
  }

  function select(i, quiet, keys = []) {
    current = i; marked = keys; draw();
    if (!quiet && onLayer) onLayer(i);
  }
  draw();
  // show: a layer with some of its keys pointed at, for a guide.
  return { select, show: (i, keys) => select(i, false, keys), route, index };
}
