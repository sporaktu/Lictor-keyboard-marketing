import { createLayers } from './layers.js';

const data = await (await fetch('data/lictor.json')).json();

// ---------------------------------------------------------------- layers
let viewer = null;
const form = document.querySelector('form.build');
const layers = createLayers(document.querySelector('[data-layers]'), data, i => {
  form.layer.value = String(Math.min(i, form.layer.options.length - 1));
  viewer && viewer.set({ layer: i });
});

// ---------------------------------------------------------------- layout comparison
const compare = document.querySelector('[data-compare]'), picture = document.querySelector('[data-compare-img]');
compare.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  compare.querySelectorAll('button').forEach(o => o.setAttribute('aria-selected', o === b));
  picture.src = `img/${b.dataset.img}.svg`;
  picture.alt = b.dataset.img === 'layout' ? 'The Lictor\'s key layout, both halves' : `The Lictor's left half drawn over the ${b.textContent}`;
});

// ---------------------------------------------------------------- the 3D drawing
const canvas = document.getElementById('view'), loading = document.querySelector('[data-loading]');
const steps = document.querySelector('[data-steps]'), note = document.querySelector('[data-step-note]');
const under = document.querySelector('[data-under]');

// The layer light has eight colours: layers past the seventh all show white.
const named = data.layers.map((l, i) => ({ i, name: l.name.replace(/_/g, ' '), light: l.light }));
const COLOURS = { '': 'dark', '#0000ff': 'blue', '#00ff00': 'green', '#ff0000': 'red', '#00ffff': 'cyan', '#ff00ff': 'magenta', '#ffff00': 'yellow', '#ffffff': 'white' };
named.forEach(l => {
  const o = document.createElement('option'); o.value = l.i; o.textContent = `${l.name}: ${COLOURS[l.light] || l.light}`;
  form.layer.append(o);
});

function fallback() {
  canvas.hidden = true; loading.hidden = true;
  document.querySelector('[data-still]').hidden = false;
  document.querySelector('.drag-hint').hidden = true;
  document.querySelector('[data-zoom]').hidden = true;
  form.hidden = true;
}

function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!supported()) fallback();
else {
  try {
    const { createViewer, STAGES } = await import('./viewer.js');
    viewer = createViewer(canvas, data, s => {
      loading.hidden = !s.loading && !s.message;
      if (s.message) loading.textContent = s.message;
    });
    STAGES.forEach((stage, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = stage.name; b.dataset.stage = i + 1;
      b.addEventListener('click', () => { viewer.set({ stage: i + 1 }); sync(); });
      li.append(b); steps.append(li);
    });
    const sync = () => {
      const s = viewer.state;
      steps.querySelectorAll('button').forEach(b => {
        const n = +b.dataset.stage;
        b.setAttribute('aria-current', n === s.stage ? 'step' : 'false');
        b.classList.toggle('done', n < s.stage);
      });
      note.textContent = STAGES[s.stage - 1].note;
      form.lights.value = s.lights ? '1' : '0'; form.lit.checked = s.lit;
      form.screen.value = s.screen ? '1' : '0'; form.inner.value = s.inner; form.tray.value = s.tray;
      under.setAttribute('aria-pressed', s.under);
      under.textContent = s.under ? 'Show the top' : 'Show the underside';
    };
    form.addEventListener('input', e => {
      const t = e.target;
      if (t.name === 'lights') viewer.set({ lights: t.value === '1' });
      else if (t.name === 'lit') viewer.set({ lit: t.checked });
      else if (t.name === 'screen') viewer.set({ screen: t.value === '1' });
      else if (t.name === 'inner') viewer.set({ inner: t.value });
      else if (t.name === 'tray') viewer.set({ tray: t.value });
      else if (t.name === 'explode') viewer.set({ explode: +t.value });
      else if (t.name === 'layer') { viewer.set({ layer: +t.value }); layers.select(+t.value, true); }
      sync();
    });
    document.querySelector('[data-zoom]').addEventListener('click', e => { const b = e.target.closest('button'); if (b) viewer.zoom(+b.dataset.factor); });
    under.addEventListener('click', () => { viewer.set({ under: !viewer.state.under }); sync(); });
    sync();
    window.lictor = viewer;        // for trying things from the console
  } catch (error) {
    console.error(error);
    fallback();
  }
}
