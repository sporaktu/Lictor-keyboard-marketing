// The campaign page: the button and rewards from data/campaign.json, and a 3D
// drawing that follows the story as it scrolls.

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
