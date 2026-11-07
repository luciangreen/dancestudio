// DanceStudio: build a LucianOS command by moving in front of the camera (or holding the
// cursor on a tile), then run it on the desktop, e.g. "grammar logic on meditation".
import { api } from '/shared/api.js';
import { activeCell, Dwell, luma, motionGrid } from './lib/motion.js';
import { action, COMMANDS, DEFAULT_TOPICS, describe, desktopUrl, layout, mergeTopics, paginate, scriptName, topicsFromFiles } from './lib/menu.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k.startsWith('aria-') || k === 'role' || k.startsWith('data-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  n.append(...kids.filter((k) => k !== null && k !== undefined));
  return n;
};

const INSIDE_DESKTOP = window.parent !== window;
const TEST = new URLSearchParams(location.search).has('test');
const NO_CURSOR = matchMedia('(hover: none)').matches;
const DEFAULTS = { topics: DEFAULT_TOPICS.slice(0, 6), hold: 1200, sensitivity: 0.12, mirror: true, camera: false, hover: true, speak: true, recent: [] };
let st = { ...DEFAULTS };
const save = () => api.state.set('dancestudio', st).catch(() => {});

// ------------------------------------------------------------ what can be chosen
const data = { topics: [], scripts: [], workflows: [], apps: [] };
async function loadChoices() {
  const gl = await Promise.all(['LucianOS/gl', 'LucianOS/gl/finished'].map((f) => api.files.list(f).then((r) => r.entries.map((e) => e.name), () => [])));
  const recentTopics = topicsFromFiles(gl.flat());
  data.topics = mergeTopics(st.topics, recentTopics);
  const scripts = await api.files.list('LucianOS/shellrun').catch(() => ({ entries: [] }));
  data.scripts = scripts.entries.filter((e) => /\.shellrun\.json$/i.test(e.name)).map((e) => scriptName(e.name));
  const wf = await api.state.get('workflows').catch(() => null);
  data.workflows = (wf?.items ?? []).filter((i) => !i.hidden);
  const info = await api.info();
  const { APP_INFO } = await import('/desktop/filetypes.js').catch(() => ({ APP_INFO: {} }));
  data.apps = info.apps.filter((a) => a !== 'dancestudio').map((a) => ({ id: a, ...(APP_INFO[a] ?? { name: a, glyph: '🧩' }) }));
}

// ------------------------------------------------------------ menus
// nav: { command, arg, page, typing }
let nav = { command: null, arg: undefined, page: 0 };
let cells = []; // cell → tile

function optionsFor(command) {
  if (command.ask === 'topic') return [...data.topics.map((t) => ({ id: `t:${t}`, label: t, glyph: '•', value: t })), { id: '__type', label: 'Type a topic', glyph: '⌨️', type: true }];
  if (command.ask === 'script') return data.scripts.map((s) => ({ id: `s:${s}`, label: s, glyph: '⚙️', value: s }));
  if (command.ask === 'app') return data.apps.map((a) => ({ id: `a:${a.id}`, label: a.name, glyph: a.glyph, value: a.name }));
  if (command.ask === 'workflow') return data.workflows.map((w) => ({ id: `w:${w.id}`, label: w.title, glyph: '📋', value: w }));
  return [];
}

function render() {
  let items;
  let back = false;
  let more = false;
  let pageInfo = '';
  if (!nav.command) {
    items = COMMANDS.map((c) => ({ ...c, command: c }));
  } else if (nav.arg !== undefined || !nav.command.ask) {
    items = [{ id: '__run', label: 'Run it', glyph: '✓', run: true }];
    back = true;
  } else {
    const all = optionsFor(nav.command);
    const p = paginate(all, nav.page);
    nav.page = p.page;
    items = p.items;
    back = true;
    more = p.pages > 1;
    if (more) pageInfo = ` · page ${p.page + 1} of ${p.pages}`;
    if (!all.length) items = [{ id: '__none', label: nav.command.ask === 'script' ? 'No scripts in LucianOS/shellrun yet' : 'Nothing to choose yet', glyph: '∅', none: true }];
  }
  cells = layout(items, { back, more });
  const grid = $('grid');
  grid.replaceChildren(...cells.map((t, i) => {
    if (i === 4) return middle(pageInfo);
    if (!t) return el('div', { className: 'cell empty' });
    const b = el('button', { className: `cell tile${t.run ? ' run' : ''}${t.back ? ' back' : ''}${t.none ? ' none' : ''}`, 'data-cell': String(i), disabled: !!t.none },
      el('span', { className: 'glyph', textContent: t.glyph ?? '' }),
      el('span', { className: 'label', textContent: t.label }),
      el('span', { className: 'ring', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => choose(i));
    b.addEventListener('pointerenter', () => (hoverCell = i));
    b.addEventListener('pointerleave', () => { if (hoverCell === i) hoverCell = null; });
    return b;
  }));
  hoverCell = null;
}

function middle(pageInfo) {
  const m = el('div', { className: 'cell middle', 'aria-live': 'polite' },
    el('div', { className: 'sentence', textContent: describe(nav.command, nav.arg) + pageInfo }),
    el('div', { className: 'quiet small hint', textContent: hintText() }));
  if (nav.typing) {
    const input = el('input', { type: 'text', placeholder: 'Topic', 'aria-label': 'Topic', autocapitalize: 'off' });
    const form = el('form', { className: 'typeform' }, input, el('button', { className: 'primary', textContent: 'OK' }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      nav.typing = false;
      nav.arg = v;
      if (!st.topics.some((t) => t.toLowerCase() === v.toLowerCase())) {
        st.topics = [v, ...st.topics].slice(0, 30);
        data.topics = mergeTopics(st.topics, data.topics);
        save();
      }
      render();
    });
    m.append(form);
    queueMicrotask(() => input.focus());
  }
  if (st.recent.length) m.append(el('div', { className: 'recent small', textContent: `Last: ${st.recent[0]}` }));
  return m;
}

function hintText() {
  const how = [camera.on ? 'move in a tile' : null, st.hover && !NO_CURSOR ? 'hold the cursor on one' : null, 'or tap it'].filter(Boolean).join(', ');
  return `To choose: ${how}.`;
}

function choose(i) {
  const t = cells[i];
  if (!t || t.none) return;
  blip(t.run ? 880 : 660);
  if (t.back) {
    if (nav.arg !== undefined && nav.command.ask) nav.arg = undefined;
    else nav = { command: null, arg: undefined, page: 0 };
    nav.typing = false;
  } else if (t.more) {
    nav.page++;
  } else if (t.run) {
    return run();
  } else if (t.command) {
    nav = { command: t.command, arg: undefined, page: 0 };
    say(t.command.ask ? `${t.command.label}. Choose ${t.command.ask === 'topic' ? 'a topic' : t.command.ask === 'script' ? 'a script' : t.command.ask === 'app' ? 'an app' : 'an item'}.` : `${t.command.label}. Choose Run it, or Back.`);
  } else if (t.type) {
    nav.typing = true;
  } else {
    nav.arg = t.value;
    say(`${typeof t.value === 'string' ? t.value : t.value.title}. Choose Run it, or Back.`);
  }
  render();
}

function run() {
  const msg = action(nav.command, nav.arg);
  const text = msg.type === 'lucianos.do' ? msg.text : `checklist: ${nav.arg.title}`;
  st.recent = [text, ...st.recent.filter((r) => r !== text)].slice(0, 20);
  save();
  if (INSIDE_DESKTOP) window.parent.postMessage(msg, location.origin);
  else window.open(desktopUrl(msg), 'lucianos');
  status(`Sent: ${text}`);
  nav = { command: null, arg: undefined, page: 0 };
  render();
}

// ------------------------------------------------------------ feedback
let audio = null;
function blip(freq) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.2);
  } catch {}
}

// Inside the desktop, the desktop's character speaks. On its own, DanceStudio speaks in
// the character's voice without showing the character, so nothing covers the tiles.
let voice = { name: '', rate: 1 };
function say(text) {
  if (!st.speak) return;
  if (INSIDE_DESKTOP) return window.parent.postMessage({ type: 'lucianos.say', text }, location.origin);
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find((x) => x.name === voice.name);
  if (v) u.voice = v;
  u.rate = voice.rate || 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function status(text) {
  $('status').textContent = text;
}

// ------------------------------------------------------------ choosing by holding still on a tile
let hoverCell = null;
const hoverDwell = new Dwell({ hold: st.hold });
const moveDwell = new Dwell({ hold: st.hold });

function showProgress(cell, progress, kind) {
  for (const b of document.querySelectorAll('.tile')) {
    const mine = Number(b.dataset.cell) === cell && progress > 0;
    b.style.setProperty(`--${kind}`, mine ? String(progress) : '0');
  }
}

// ------------------------------------------------------------ the camera
const camera = { on: false, stream: null, prev: null, last: 0 };
const SW = 48;
const SH = 36;
const sample = document.createElement('canvas');
sample.width = SW;
sample.height = SH;
const sctx = sample.getContext('2d', { willReadFrequently: true });

async function startCamera() {
  try {
    camera.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (err) {
    status(err.name === 'NotAllowedError' ? 'Camera not allowed. Allow it in the browser, or use the cursor.' : `No camera: ${err.message}`);
    return false;
  }
  const v = $('video');
  v.srcObject = camera.stream;
  await v.play().catch(() => {});
  camera.on = true;
  camera.prev = null;
  document.body.classList.add('camera');
  status('Camera on. Move a hand in a tile to choose it.');
  return true;
}

function stopCamera() {
  camera.stream?.getTracks().forEach((t) => t.stop());
  camera.stream = null;
  camera.on = false;
  $('video').srcObject = null;
  document.body.classList.remove('camera');
  for (const b of document.querySelectorAll('.tile')) b.style.setProperty('--e', '0');
  status('Camera off.');
}

function cameraEnergy() {
  const v = $('video');
  if (!camera.on || v.readyState < 2) return null;
  sctx.drawImage(v, 0, 0, SW, SH);
  const cur = luma(sctx.getImageData(0, 0, SW, SH).data);
  const prev = camera.prev;
  camera.prev = cur;
  if (!prev) return null;
  return motionGrid(prev, cur, SW, SH, { mirror: st.mirror });
}

let fedEnergy = null; // test hook
function handleEnergy(energy, now) {
  for (const b of document.querySelectorAll('.tile')) b.style.setProperty('--e', String(Math.min(1, (energy[Number(b.dataset.cell)] ?? 0) / (st.sensitivity * 2))));
  const usable = cells.map((t, i) => (t && !t.none && i !== 4 ? i : -1)).filter((i) => i >= 0);
  const cell = activeCell(energy, { cells: usable, min: st.sensitivity });
  const r = moveDwell.update(cell, now);
  showProgress(r.target, r.progress, 'm');
  if (r.chosen !== null) choose(r.chosen);
}

function loop(now) {
  if (st.hover && !nav.typing) {
    const r = hoverDwell.update(hoverCell, now);
    showProgress(r.target, r.progress, 'h');
    if (r.chosen !== null) choose(r.chosen);
  }
  if (now - camera.last > 66) {
    camera.last = now;
    const energy = fedEnergy ?? cameraEnergy();
    fedEnergy = null;
    if (energy && !nav.typing) handleEnergy(energy, now);
  }
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------ settings
function settings() {
  $('topicsInput').value = st.topics.join(', ');
  $('holdInput').value = st.hold;
  $('sensInput').value = st.sensitivity;
  $('mirrorInput').checked = st.mirror;
  $('speakInput').checked = st.speak;
  const outs = () => {
    $('holdOut').textContent = `${(Number($('holdInput').value) / 1000).toFixed(1)} s`;
    $('sensOut').textContent = `${Math.round(Number($('sensInput').value) * 100)}% of a tile`;
  };
  outs();
  $('holdInput').oninput = outs;
  $('sensInput').oninput = outs;
  $('settings').showModal();
}
$('settings').addEventListener('close', async () => {
  st.topics = $('topicsInput').value.split(',').map((t) => t.trim()).filter(Boolean);
  st.hold = Number($('holdInput').value);
  st.sensitivity = Number($('sensInput').value);
  st.mirror = $('mirrorInput').checked;
  st.speak = $('speakInput').checked;
  hoverDwell.hold = moveDwell.hold = st.hold;
  document.body.classList.toggle('nomirror', !st.mirror);
  save();
  await loadChoices();
  render();
});

function setToggles() {
  $('cameraBtn').setAttribute('aria-pressed', String(camera.on));
  $('hoverBtn').setAttribute('aria-pressed', String(st.hover));
}
$('cameraBtn').addEventListener('click', async () => {
  if (camera.on) stopCamera();
  else await startCamera();
  st.camera = camera.on;
  save();
  setToggles();
  render();
});
$('hoverBtn').addEventListener('click', () => {
  st.hover = !st.hover;
  hoverDwell.reset();
  showProgress(null, 0, 'h');
  save();
  setToggles();
  render();
});
$('settingsBtn').addEventListener('click', settings);

// ------------------------------------------------------------ start
async function init() {
  st = { ...DEFAULTS, ...((await api.state.get('dancestudio').catch(() => null)) ?? {}) };
  hoverDwell.hold = moveDwell.hold = st.hold;
  document.body.classList.toggle('nomirror', !st.mirror);
  await loadChoices();
  render();
  setToggles();
  status(INSIDE_DESKTOP ? 'Commands run on the desktop.' : 'Commands open on the LucianOS desktop.');
  if (st.camera && !TEST) await startCamera();
  setToggles();
  render();
  requestAnimationFrame(loop);
  if (TEST) window.__dance = { energy: (e) => (fedEnergy = e), nav: () => ({ ...nav, command: nav.command?.id }), sent: [] };
  const c = await api.state.get('character').catch(() => null);
  voice = { name: c?.voice ?? '', rate: c?.rate ?? 1 };
}

init().catch((err) => status(err.message));
