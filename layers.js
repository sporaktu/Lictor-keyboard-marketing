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
  const P = data.positions, half = KEY / 2;
  const xs = P.map(p => p.x), ys = P.map(p => p.y);
  const box = [Math.min(...xs) - 16, Math.min(...ys) - 14, Math.max(...xs) + 16, Math.max(...ys) + 16];
  svg.setAttribute('viewBox', `${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`);
  let current = 0;

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

  function draw() {
    const layer = data.layers[current];
    svg.replaceChildren();
    P.forEach((p, i) => {
      const k = layer.keys[i];
      const g = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.rot})`, class: `key ${k.k}`, 'data-pos': i });
      g.append(el('rect', { x: -half, y: -half, width: KEY, height: KEY, rx: 2.4 }));
      const text = k.t || data.layers[0].keys[i].t;
      const size = text.length > 6 ? 3.1 : text.length > 3 ? 3.9 : text.length > 1 ? 5 : 6.6;
      g.append(el('text', { y: k.h ? -1.2 : 0.4, 'font-size': size, class: 'tap' }, text));
      if (k.h) g.append(el('text', { y: 5.4, 'font-size': 3, class: 'hold' }, k.h));
      const what = k.d || (k.k === 'mod' ? `${k.t} modifier` : `Types ${k.t}`);
      g.append(el('title', {}, what));
      if (k.to !== undefined && index[k.to] !== undefined) {
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

  function select(i, quiet) {
    current = i; draw();
    if (!quiet && onLayer) onLayer(i);
  }
  draw();
  return { select };
}
