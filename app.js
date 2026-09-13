/* LLM canvas engine: pan/zoom SVG, drill-down scenes, side panel.
   Content lives in scenes.js (diagram tree) and log.js (sessions). */
(() => {
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const world = document.getElementById('world');
const $ = s => document.querySelector(s);

let view = { x: 0, y: 0, k: 1 };      // screen = world * k + (x, y)
let stack = ['root'];                 // scene ids from root to current
let selected = null;
let lastMoved = false;

const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cur = () => SCENES[stack[stack.length - 1]];
const byId = (sc, id) => sc.nodes.find(n => n.id === id);

/* ---------- view math ---------- */
function applyView() { world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`); }
function bounds(sc) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const n of sc.nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function fitTo(b, pad = 80) {
  const r = svg.getBoundingClientRect();
  const k = Math.min((r.width - 2 * pad) / b.w, (r.height - 2 * pad) / b.h, 2.5);
  return { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k };
}
function scaleAboutCenter(v, s) {
  const r = svg.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
  return { k: v.k * s, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
}
function animate(to, ms, done) {
  const from = { ...view }, t0 = performance.now();
  (function step(t) {
    let p = Math.min(1, (t - t0) / ms); p = 1 - Math.pow(1 - p, 3);
    view = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, k: from.k + (to.k - from.k) * p };
    applyView();
    if (p < 1) requestAnimationFrame(step); else if (done) done();
  })(t0);
}

/* ---------- pan & zoom ---------- */
let drag = null;
svg.addEventListener('mousedown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; });
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  view.x = drag.vx + dx; view.y = drag.vy + dy; applyView();
});
window.addEventListener('mouseup', () => { if (drag) lastMoved = drag.moved; drag = null; });
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = Math.min(8, Math.max(0.1, view.k * Math.exp(-e.deltaY * 0.0015)));
  const s = k / view.k;
  view = { k, x: mx - (mx - view.x) * s, y: my - (my - view.y) * s }; applyView();
}, { passive: false });
svg.addEventListener('click', e => { if (e.target === svg && !lastMoved) select(null); });

/* ---------- rendering ---------- */
function render() {
  const sc = cur(); world.innerHTML = ''; selected = null;
  for (const n of sc.nodes.filter(n => n.kind === 'group')) world.appendChild(nodeEl(n));
  for (const e of sc.edges || []) world.appendChild(edgeEl(sc, e));
  for (const n of sc.nodes.filter(n => n.kind !== 'group')) world.appendChild(nodeEl(n));
}

function nodeEl(n) {
  const kind = n.kind || 'op';
  const g = el('g', { class: `node kind-${kind}${n.child ? ' has-child' : ''}`, 'data-id': n.id });
  g.appendChild(el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }));
  if (kind === 'group') {
    const t = el('text', { x: n.x + 12, y: n.y + 20 }); t.textContent = n.label; g.appendChild(t);
    return g;
  }
  const lines = n.label.split('\n');
  const cy = n.y + n.h / 2 - (lines.length - 1) * 9 - (n.sub ? 7 : 0);
  const t = el('text', { x: n.x + n.w / 2, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
  lines.forEach((l, i) => { const ts = el('tspan', { x: n.x + n.w / 2, dy: i ? 18 : 0 }); ts.textContent = l; t.appendChild(ts); });
  g.appendChild(t);
  if (n.sub) { const s = el('text', { x: n.x + n.w / 2, y: cy + lines.length * 18 - 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'sub' }); s.textContent = n.sub; g.appendChild(s); }
  if (n.child) { const b = el('text', { x: n.x + n.w - 8, y: n.y + n.h - 7, 'text-anchor': 'end', class: 'badge' }); b.textContent = '⤵ open'; g.appendChild(b); }
  g.appendChild(el('circle', { cx: n.x + n.w - 10, cy: n.y + 10, r: 5, class: 'st st-' + (n.status || 'todo') }));
  g.addEventListener('click', () => { if (lastMoved) return; if (tour) { const j = tour.steps.findIndex(st => st.node === n.id); if (j >= 0) { tour.i = j; showStep(); return; } } select(n); });
  g.addEventListener('dblclick', e => { e.preventDefault(); drill(n); });
  return g;
}

function edgeEl(sc, e) {
  const o = Array.isArray(e) ? { from: e[0], to: e[1], label: e[2] } : e;
  const A = byId(sc, o.from), B = byId(sc, o.to);
  if (!A || !B) { console.warn('edge references missing node', o); return el('g'); }
  const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, cb = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  let p1, p2, d, lx, ly;
  if (o.arc) {                       // skip connection: leave from top (or bottom) and arc over
    const up = o.arc < 0;
    p1 = { x: ca.x, y: up ? A.y : A.y + A.h }; p2 = { x: cb.x, y: up ? B.y : B.y + B.h };
    d = `M${p1.x},${p1.y} C${p1.x},${p1.y + o.arc} ${p2.x},${p2.y + o.arc} ${p2.x},${p2.y}`;
    lx = (p1.x + p2.x) / 2; ly = p1.y + o.arc * 0.75 + (up ? -4 : 14);
  } else if (o.dir === 'h' || (o.dir !== 'v' && Math.abs(dx) >= Math.abs(dy))) {
    p1 = { x: dx > 0 ? A.x + A.w : A.x, y: ca.y }; p2 = { x: dx > 0 ? B.x : B.x + B.w, y: cb.y };
    const mx = (p1.x + p2.x) / 2;
    d = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
    lx = mx; ly = (p1.y + p2.y) / 2 - 8;
  } else {
    p1 = { x: ca.x, y: dy > 0 ? A.y + A.h : A.y }; p2 = { x: cb.x, y: dy > 0 ? B.y : B.y + B.h };
    const my = (p1.y + p2.y) / 2;
    d = `M${p1.x},${p1.y} C${p1.x},${my} ${p2.x},${my} ${p2.x},${p2.y}`;
    lx = (p1.x + p2.x) / 2 + 8; ly = my;
  }
  const g = el('g', { class: 'edge' + (o.arc ? ' skip' : '') });
  g.appendChild(el('path', { d, 'marker-end': 'url(#arrow)' }));
  if (o.label) { const t = el('text', { x: lx, y: ly, 'text-anchor': 'middle', class: 'elbl' }); t.textContent = o.label; g.appendChild(t); }
  return g;
}

/* ---------- navigation ---------- */
function load(mode, fromNode) {
  endTour(); render();
  const target = fitTo(bounds(cur()));
  if (mode === 'in') { view = scaleAboutCenter(target, 0.45); applyView(); animate(target, 420); }
  else if (mode === 'out' && fromNode) { view = fitTo(fromNode, 10); applyView(); animate(target, 420); }
  else { view = target; applyView(); }
  crumbs(); showNotes(null); renderMap();
  history.replaceState(null, '', '#' + stack.slice(1).join('/'));
}
function drill(n) {
  if (!n.child || !SCENES[n.child]) return;
  animate(fitTo(n, 10), 380, () => { stack.push(n.child); load('in'); });
}
function up() {
  if (stack.length < 2) return;
  animate(scaleAboutCenter(view, 0.7), 220, () => {
    const childId = stack.pop();
    const from = cur().nodes.find(n => n.child === childId);
    load('out', from);
  });
}
function select(n) {
  selected = n ? n.id : null;
  world.querySelectorAll('.node').forEach(g => g.classList.toggle('sel', g.dataset.id === selected));
  showNotes(n);
}
function crumbs() {
  const c = $('#crumbs'); c.innerHTML = '';
  stack.forEach((id, i) => {
    if (i) { const s = document.createElement('span'); s.textContent = '›'; c.appendChild(s); }
    const b = document.createElement('button'); b.textContent = SCENES[id].title;
    b.onclick = () => { if (i < stack.length - 1) { stack = stack.slice(0, i + 1); load(null); } };
    c.appendChild(b);
  });
}

/* ---------- guided tour ---------- */
let tour = null;                      // { steps, i } while a walkthrough is running
const tourBox = $('#tour');
function startTour() {
  const sc = cur(); if (!sc.tour || !sc.tour.length) return;
  tour = { steps: sc.tour, i: 0 }; world.classList.add('touring'); tourBox.hidden = false; showStep();
}
function endTour() {
  if (!tour) return;
  tour = null; world.classList.remove('touring'); tourBox.hidden = true; select(null);
}
function showStep() {
  const sc = cur(), st = tour.steps[tour.i], n = st.node ? byId(sc, st.node) : null;
  selected = n ? n.id : null;
  world.querySelectorAll('.node').forEach(g => g.classList.toggle('sel', !!n && g.dataset.id === n.id));
  if (n) { const m = 1.1; animate(fitTo({ x: n.x - n.w * m, y: n.y - n.h * 1.6, w: n.w * (1 + 2 * m), h: n.h * 4.2 }, 30), 450); }
  else animate(fitTo(bounds(sc)), 450);
  tourBox.querySelector('.tour-step').textContent = `step ${tour.i + 1} / ${tour.steps.length}`;
  tourBox.querySelector('.tour-title').textContent = st.title || (n ? n.label.replace(/\n/g, ' ') : sc.title);
  tourBox.querySelector('.tour-body').innerHTML = md(st.text);
  tourBox.querySelector('.tour-prev').disabled = tour.i === 0;
  tourBox.querySelector('.tour-next').textContent = tour.i === tour.steps.length - 1 ? 'finish ✓' : 'next →';
  if (n) showNotes(n, true);
}
function tourStep(dir) {
  if (!tour) return;
  const j = tour.i + dir;
  if (j >= tour.steps.length) { endTour(); return; }
  if (j < 0) return;
  tour.i = j; showStep();
}
tourBox.querySelector('.tour-prev').onclick = () => tourStep(-1);
tourBox.querySelector('.tour-next').onclick = () => tourStep(1);
tourBox.querySelector('.tour-end').onclick = endTour;

/* ---------- side panel ---------- */
function showNotes(n, quiet) {
  const sc = cur(), t = n || sc, box = $('#tab-notes'); box.innerHTML = '';
  const head = document.createElement('div'); head.className = 'nhead';
  head.innerHTML = `<div class="kicker">${n ? 'box · ' + (n.kind || 'op') : 'scene'}</div><h1>${esc(n ? n.label.replace(/\n/g, ' ') : sc.title)}</h1>`;
  if (n) { const st = n.status || 'todo'; head.innerHTML += `<span class="pill ${st}">${st === 'done' ? 'discussed' : st === 'revisit' ? 'revisit' : 'not discussed yet'}</span>`; }
  if (n && n.sub) head.innerHTML += `<span class="pill">${esc(n.sub)}</span>`;
  box.appendChild(head);
  if (!n && sc.tour && sc.tour.length) { const b = document.createElement('button'); b.className = 'tourbtn'; b.textContent = '▶ Walk me through (' + sc.tour.length + ' steps)'; b.onclick = startTour; box.appendChild(b); }
  if (n && n.child && SCENES[n.child]) { const b = document.createElement('button'); b.className = 'openbtn'; b.textContent = 'Open ' + SCENES[n.child].title + ' ▸'; b.onclick = () => drill(n); box.appendChild(b); }
  const body = document.createElement('div'); body.className = 'md';
  body.innerHTML = md(t.notes || '*Not discussed yet.* Ask me to open this one up and I will fill it in.');
  box.appendChild(body);
  if (t.widget && WIDGETS[t.widget]) { const w = document.createElement('div'); w.className = 'widget'; box.appendChild(w); WIDGETS[t.widget](w); }
  if (!quiet) activateTab('notes');
}

function renderMap() {
  const box = $('#tab-map'); box.innerHTML = '';
  function item(id, path) {
    const sc = SCENES[id], li = document.createElement('li'), b = document.createElement('button');
    b.textContent = sc.title; if (id === stack[stack.length - 1]) b.className = 'here';
    b.onclick = () => { stack = path; load(null); };
    li.appendChild(b);
    const kids = [...new Map(sc.nodes.filter(n => n.child && SCENES[n.child]).map(n => [n.child, n])).values()];
    if (kids.length) { const ul = document.createElement('ul'); kids.forEach(n => ul.appendChild(item(n.child, path.concat(n.child)))); li.appendChild(ul); }
    return li;
  }
  let tot = 0, done = 0, rev = 0;
  for (const id in SCENES) for (const n of SCENES[id].nodes) { if (n.kind === 'group') continue; tot++; if (n.status === 'done') done++; if (n.status === 'revisit') rev++; }
  const p = document.createElement('div'); p.className = 'progress';
  p.innerHTML = `<b>${done}</b> / ${tot} boxes discussed · <b>${rev}</b> marked revisit`;
  box.appendChild(p);
  const ul = document.createElement('ul'); ul.appendChild(item('root', ['root'])); box.appendChild(ul);
}

function renderLog() {
  $('#tab-log').innerHTML = LOG.sessions.map(s =>
    `<div class="sess"><div class="kicker">${esc(s.date)}</div><h3>${esc(s.title)}</h3><ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');
}

function activateTab(name) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => activateTab(b.dataset.tab));

/* ---------- minimal markdown (headings, lists, bold/italic/code, fenced code) ---------- */
function md(src) {
  const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
  const out = []; let para = [], list = null, code = null;
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const l = raw.replace(/^\s{0,3}/, '');
    if (l.startsWith('```')) { if (code !== null) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; } else { flushPara(); flushList(); code = []; } continue; }
    if (code !== null) { code.push(raw); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { flushPara(); flushList(); const h = m[1].length + 1; out.push(`<h${h}>${inline(m[2])}</h${h}>`); continue; }
    if ((m = l.match(/^[-*]\s+(.*)/))) { flushPara(); if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = l.match(/^\d+\.\s+(.*)/))) { flushPara(); if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if (l.trim() === '') { flushPara(); flushList(); continue; }
    flushList(); para.push(l);
  }
  flushPara(); flushList();
  return out.join('\n');
}

/* ---------- keys & buttons ---------- */
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (tour && (e.key === 'ArrowRight' || e.key === ' ')) { e.preventDefault(); tourStep(1); return; }
  if (tour && e.key === 'ArrowLeft') { e.preventDefault(); tourStep(-1); return; }
  if (tour && e.key === 'Escape') { e.preventDefault(); endTour(); return; }
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); up(); }
  if (e.key === 'f' || e.key === 'F') animate(fitTo(bounds(cur())), 300);
});
$('#btn-up').onclick = up;
$('#btn-fit').onclick = () => animate(fitTo(bounds(cur())), 300);

let tourAt = null;
(function initFromHash() {
  const [path0, query] = location.hash.slice(1).split('?');
  const m = /tour=(\d+)/.exec(query || ''); if (m) tourAt = +m[1];
  const ids = path0.split('/').filter(Boolean);
  const path = ['root'];
  for (const id of ids) { if (SCENES[id] && SCENES[path[path.length - 1]].nodes.some(n => n.child === id)) path.push(id); else break; }
  stack = path;
})();
load(null); renderLog();
if (tourAt !== null && cur().tour) { startTour(); tour.i = Math.min(Math.max(0, tourAt - 1), tour.steps.length - 1); showStep(); }
})();
