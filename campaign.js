// The campaign page: the button and rewards from data/campaign.json, and a 3D
// drawing that follows the story as it scrolls.

import { createLayers, where, heldOn } from './layers.js';

const HERE = new URL('.', import.meta.url);
const json = async name => (await fetch(new URL(`data/${name}.json`, HERE))).json();
const [data, campaign] = await Promise.all([json('lictor'), json('campaign')]);

// ---------------------------------------------------------------- the button
// With no address yet, the button leads to the rewards and says so.
const open = !!campaign.button.url;
document.querySelector('[data-status]').textContent = campaign.status;
document.querySelectorAll('[data-back]').forEach(a => {
  a.textContent = campaign.button.label;
  if (open) a.href = campaign.button.url;
});
document.querySelector('[data-back-note]').hidden = open;

// ---------------------------------------------------------------- rewards
const tiers = document.querySelector('[data-tiers]');
for (const tier of campaign.tiers) {
  const li = document.createElement('li');
  const name = document.createElement('h3'); name.textContent = tier.name;
  const price = document.createElement('p'); price.className = 'price';
  price.textContent = tier.price || 'Price to be announced';
  if (!tier.price) price.classList.add('unset');
  const summary = document.createElement('p'); summary.textContent = tier.summary;
  const list = document.createElement('ul');
  for (const item of tier.includes) { const i = document.createElement('li'); i.textContent = item; list.append(i); }
  li.append(name, price, summary, list);
  if (open) {
    const a = document.createElement('a'); a.className = 'back'; a.href = campaign.button.url;
    a.textContent = campaign.button.label; li.append(a);
  }
  tiers.append(li);
}
document.querySelector('[data-tiers-note]').hidden = campaign.tiers.every(t => t.price);

// ---------------------------------------------------------------- the layer map and its guide
// Each task is the keys to press, in order, each found on its layer by its
// legend. The keys held to reach that layer come from the keymap's own route.
const TASKS = [
  { label: 'Type 7', presses: [{ layer: 'NUMBER', t: '7' }] },
  { label: 'Type (', presses: [{ layer: 'NUMBER', t: '(' }] },
  { label: 'Move the cursor up', presses: [{ layer: 'NAV', t: '↑' }] },
  { label: 'Press Esc', presses: [{ layer: 'HOMELEFT', t: 'Esc' }] },
  { label: 'Copy: Ctrl+C', presses: [{ layer: 'HOMERIGHT', t: 'Ctrl' }, { layer: 'BASE', t: 'C' }] },
  { label: 'Press F5', presses: [{ layer: 'FUNCTION', t: 'F5' }] },
  { label: 'Switch to another computer', presses: [{ layer: 'SYSTEM', t: 'BT next' }] },
];

const map = createLayers(document.querySelector('[data-layers]'), data, () => clearTask());
const P = data.positions;
const tasks = document.querySelector('[data-tasks]'), moves = document.querySelector('[data-moves]');

// One press: the layer, the keys held to get there, and the key itself, on
// the other hand from the held keys where the layer has it twice.
function plan(press) {
  const layer = map.index[press.layer], route = map.route[layer];
  if (layer === undefined || !route) return null;
  const found = data.layers[layer].keys.flatMap((k, i) => (k.t === press.t ? [i] : []));
  if (!found.length) return null;
  const held = heldOn(route);
  const busy = new Set(held.map(w => P[w.pos].side));
  const key = found.find(i => !busy.has(P[i].side)) ?? found[0];
  return { layer, route, held, key, k: data.layers[layer].keys[key] };
}

function sentence(text) {
  const li = document.createElement('li'); li.textContent = text; return li;
}

function clearTask() {
  tasks.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  moves.replaceChildren();
}

function choose(task, button) {
  const steps = task.presses.map(plan);
  tasks.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  moves.replaceChildren();
  steps.forEach((step, n) => {
    const group = document.createElement('li');
    const list = document.createElement('ol');
    for (const w of step.route) {
      // Keys switched to earlier in a route are taps; the held ones stay down.
      const name = data.layers[w.from].keys[w.pos]?.t;
      if (w.combo) list.append(sentence(`Press ${w.combo.map(i => where(P[i])).join(' and ')} together, for ${w.name}.`));
      else list.append(sentence(`${w.hold ? 'Hold' : 'Tap'} ${name}: ${where(P[w.pos])}.`));
    }
    const sticky = /^Sticky/.test(step.k.d || '');
    const what = step.held.length ? 'Still holding, press' : 'Press';
    list.append(sentence(`${what} ${step.k.t}: ${where(P[step.key])}.`));
    if (sticky) list.append(sentence(`Let go of everything. ${step.k.t} stays down for the next key.`));
    else if (step.held.length) list.append(sentence('Let go, and the keys are letters again.'));
    if (steps.length > 1) {
      const show = document.createElement('button');
      show.type = 'button';
      show.textContent = `Step ${n + 1}: ${step.k.t}`;
      show.addEventListener('click', () => pick(n));
      group.append(show);
    } else {
      const name = document.createElement('p'); name.className = 'task-name'; name.textContent = task.label;
      group.append(name);
    }
    group.append(list);
    moves.append(group);
  });
  const pick = n => {
    const step = steps[n];
    // Selecting a layer by hand clears the task; showing one for it does not.
    map.select(step.layer, true, [step.key]);
    moves.querySelectorAll(':scope > li').forEach((li, i) => li.classList.toggle('now', i === n));
  };
  pick(0);
}

for (const task of TASKS) {
  if (task.presses.some(press => !plan(press))) continue;   // the keymap has moved on
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = task.label; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => choose(task, b));
  tasks.append(b);
}

// ---------------------------------------------------------------- the drawing
const canvas = document.getElementById('view'), loading = document.querySelector('[data-loading]');
const beats = [...document.querySelectorAll('[data-beats] > li')];

function fallback() {
  canvas.hidden = true; loading.hidden = true;
  document.querySelector('[data-still]').hidden = false;
  document.querySelector('.drag-hint').hidden = true;
  beats.forEach(b => b.classList.add('now'));
}

function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!supported()) fallback();
else {
  try {
    const { createViewer } = await import('./viewer.js');
    const viewer = createViewer(canvas, data, s => {
      loading.hidden = !s.loading && !s.message;
      if (s.message) loading.textContent = s.message;
    });
    if (matchMedia('(min-width: 56rem)').matches) viewer.zoom(0.8);   // the wide layout has room to stand closer
    let current = null;
    const show = beat => {
      if (beat === current) return;
      current = beat;
      beats.forEach(b => b.classList.toggle('now', b === beat));
      // Options first: some of them move the build on a stage, and the
      // stage this part of the story wants is set after them.
      const options = JSON.parse(beat.dataset.options || '{}');
      if ('screen' in options) options.screen = !!options.screen;
      viewer.set(options);
      viewer.set(JSON.parse(beat.dataset.view));
    };
    // The part of the story nearest the middle of the window is the one shown.
    const nearest = () => {
      // On a narrow screen the drawing covers the top of the window, so the
      // story is read in what is left beneath it.
      const frame = canvas.parentElement.getBoundingClientRect();
      const stacked = frame.width > window.innerWidth * 0.8;
      const middle = stacked ? (Math.max(frame.bottom, 0) + window.innerHeight) / 2 : window.innerHeight * 0.55;
      let best = beats[0], distance = Infinity;
      for (const b of beats) {
        const r = b.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - middle);
        if (d < distance) { best = b; distance = d; }
      }
      show(best);
    };
    let queued = false;
    addEventListener('scroll', () => {
      if (queued) return;
      queued = true; requestAnimationFrame(() => { queued = false; nearest(); });
    }, { passive: true });
    addEventListener('resize', nearest);
    beats.forEach(b => b.addEventListener('click', () => show(b)));
    nearest();
    window.lictor = viewer;        // for trying things from the console
  } catch (error) {
    console.error(error);
    fallback();
  }
}
