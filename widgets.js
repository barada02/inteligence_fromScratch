/* Interactive widgets. A scene or node with `widget: '<name>'` gets WIDGETS[name](container) mounted under its notes. */
const WIDGETS = {

  /* Temperature on softmax: fixed logits, drag T, watch the distribution sharpen/flatten. */
  softmax(el) {
    const toks = ['cat', 'dog', 'car', 'the', 'banana'], logits = [2.0, 1.4, 0.3, -0.5, -1.2];
    el.innerHTML = `<h3>Sampling: temperature on softmax</h3>
      <p class="hint">Logits are fixed. Only <code>logit / T</code> changes before softmax. Low T → near-greedy, high T → near-uniform.</p>
      <label>T = <span class="tv">1.0</span></label><input type="range" min="0.1" max="3" step="0.1" value="1">
      <div class="bars"></div>`;
    const r = el.querySelector('input'), bars = el.querySelector('.bars'), tv = el.querySelector('.tv');
    function draw() {
      const T = +r.value; tv.textContent = T.toFixed(1);
      const z = logits.map(l => l / T), m = Math.max(...z);
      const e = z.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b), p = e.map(v => v / s);
      bars.innerHTML = toks.map((t, i) => `<div class="bar"><span class="bt">${t} <small>(${logits[i]})</small></span><div class="bf"><div style="width:${p[i] * 100}%"></div></div><span class="bp">${(p[i] * 100).toFixed(1)}%</span></div>`).join('');
    }
    r.oninput = draw; draw();
  },

  /* One attention head, actually computed: random (untrained) W_Q, W_K on 6 tokens, d=4. */
  attention(el) {
    const toks = ['The', 'cat', 'sat', 'on', 'the', 'mat'], d = 4;
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
    const mat = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, rnd));
    const mul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
    const E = mat(toks.length, d), Wq = mat(d, d), Wk = mat(d, d);
    const Q = mul(E, Wq), K = mul(E, Wk);
    const S = Q.map(q => K.map(k => q.reduce((s, v, i) => s + v * k[i], 0) / Math.sqrt(d)));
    el.innerHTML = `<h3>One attention head, live</h3>
      <p class="hint">6 tokens, d_head = 4, random untrained weights. Row = query token (who is looking). Column = key token (who is being looked at). Each row of the right table sums to 1 — that is how much of each token's V gets mixed into this row's output.</p>
      <label><input type="checkbox" checked> causal mask — a token may not look at the future</label>
      <div class="hm-wrap">
        <div><div class="hm-title">scores = Q·Kᵀ / √d_head</div><div class="hm s"></div></div>
        <div><div class="hm-title">weights = softmax(each row)</div><div class="hm w"></div></div>
      </div>`;
    const cb = el.querySelector('input');
    function heat(box, M, fmt, color) {
      box.innerHTML = '<table><tr><th></th>' + toks.map(t => `<th>${t}</th>`).join('') + '</tr>' +
        M.map((row, i) => `<tr><th>${toks[i]}</th>` + row.map(v => `<td style="background:${color(v)}">${v === null ? '−∞' : fmt(v)}</td>`).join('') + '</tr>').join('') + '</table>';
    }
    function draw() {
      const masked = S.map((row, i) => row.map((v, j) => cb.checked && j > i ? null : v));
      const W = masked.map(row => {
        const vals = row.map(v => v === null ? -Infinity : v), m = Math.max(...vals);
        const e = vals.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b); return e.map(v => v / s);
      });
      heat(el.querySelector('.hm.s'), masked, v => v.toFixed(2), v => v === null ? '#1a1d25' : (v > 0 ? `rgba(76,141,255,${Math.min(1, v / 1.5)})` : `rgba(255,159,67,${Math.min(1, -v / 1.5)})`));
      heat(el.querySelector('.hm.w'), W, v => v.toFixed(2), v => `rgba(61,220,151,${v})`);
    }
    cb.onchange = draw; draw();
  },

  /* BPE trainer: step through merges on a tiny corpus and watch words collapse into pieces. */
  bpe_train(el) {
    el.innerHTML = `<h3>Train a BPE tokenizer, one merge at a time</h3>
      <p class="hint">Edit the corpus if you like, then press <b>next merge</b>. Base vocab = the distinct characters (stand-in for the 256 bytes). Spaces are kept on the front of words, GPT-style.</p>
      <textarea class="corpus" rows="3" spellcheck="false"></textarea>
      <div class="row"><button class="b-next">next merge</button><button class="b-ten">+10</button><button class="b-reset">reset</button><span class="stat"></span></div>
      <div class="last"></div>
      <div class="hm-title">top pairs right now</div><div class="pairs"></div>
      <div class="hm-title">corpus words as current pieces</div><div class="words"></div>
      <div class="hm-title">merge list (rank order)</div><div class="merges"></div>`;
    const ta = el.querySelector('.corpus'); ta.value = BPE.DEFAULT_CORPUS;
    let st = BPE.init(ta.value), last = null;
    const q = s => el.querySelector(s);
    function draw() {
      q('.stat').textContent = `vocab ${st.vocab.length} = ${st.base} base + ${st.merges.length} merges`;
      q('.last').innerHTML = last ? `merged <b>${BPE.chip(last.a)} + ${BPE.chip(last.b)}</b> → ${BPE.chip(last.a + last.b, st)} &nbsp;<small>(seen ${last.count}×)</small>` : '<small>no merges yet — every word is single characters</small>';
      const top = BPE.topPairs(st, 6);
      q('.pairs').innerHTML = top.length ? top.map(([a, b, c]) => `<span class="pair">${BPE.chip(a)}${BPE.chip(b)} <small>${c}</small></span>`).join('') : '<small>nothing left to merge</small>';
      q('.words').innerHTML = st.words.map(w => `<span class="word">${w.sym.map(s => BPE.chip(s, st)).join('')}<small>×${w.c}</small></span>`).join('');
      q('.merges').innerHTML = st.merges.map(([a, b], i) => `<span class="pair"><small>${i + 1}</small> ${BPE.chip(a)}+${BPE.chip(b)}</span>`).join('') || '<small>—</small>';
    }
    q('.b-next').onclick = () => { last = BPE.step(st) || last; draw(); };
    q('.b-ten').onclick = () => { for (let i = 0; i < 10; i++) { const r = BPE.step(st); if (!r) break; last = r; } draw(); };
    q('.b-reset').onclick = () => { st = BPE.init(ta.value); last = null; draw(); };
    ta.onchange = q('.b-reset').onclick;
    draw();
  },

  /* BPE encoder: type anything, see it chopped by merges learned from the built-in corpus. */
  bpe_encode(el) {
    const st = BPE.init(BPE.DEFAULT_CORPUS); for (let i = 0; i < 40; i++) BPE.step(st);
    el.innerHTML = `<h3>Encode with a tiny learned tokenizer</h3>
      <p class="hint">${st.merges.length} merges learned from: <i>${BPE.DEFAULT_CORPUS}</i>. Type something and watch it get chopped. Grey = a character the tokenizer never saw (a real one would fall back to bytes).</p>
      <input class="inp" type="text" spellcheck="false" value="The lowest cat sat on the newest mat">
      <div class="chips"></div><div class="stat"></div>`;
    const inp = el.querySelector('.inp'), chips = el.querySelector('.chips'), stat = el.querySelector('.stat');
    function draw() {
      const toks = BPE.encode(st, inp.value);
      chips.innerHTML = toks.map(t => BPE.chip(t.tok, st, t.id === null)).join('');
      stat.innerHTML = `<small>${inp.value.length} characters → <b>${toks.length}</b> tokens &nbsp; ids: [${toks.map(t => t.id === null ? '?' : t.id).join(', ')}]</small>`;
    }
    inp.oninput = draw; draw();
  },
};

/* Embedding lookup + what training does to the table. Toy vocab of 8, d_model = 4. */
WIDGETS.embedding = function (el) {
  const toks = ['the', 'a', 'cat', 'dog', 'kitten', 'car', 'truck', 'sat'], d = 4;
  let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return +(seed / 0x7fffffff * 2 - 1).toFixed(2); };
  const random = toks.map(() => Array.from({ length: d }, rnd));
  const trained = [[0.9, 0.1, 0.0, 0.1], [0.8, 0.2, 0.1, 0.0], [0.1, 0.9, 0.3, 0.1], [0.1, 0.8, 0.4, 0.1],
                   [0.2, 0.9, 0.2, 0.3], [0.0, 0.1, 0.9, 0.4], [0.1, 0.0, 0.8, 0.5], [0.3, 0.2, 0.1, 0.9]];
  let E = random, sel = 2;
  const cos = (a, b) => { const dot = a.reduce((s, v, i) => s + v * b[i], 0), na = Math.hypot(...a), nb = Math.hypot(...b); return dot / (na * nb); };
  el.innerHTML = `<h3>x = onehot(id) · E</h3>
    <p class="hint">vocab = 8, d_model = 4. Click a token to look it up. Then switch the table to the (toy) trained state and look at the similarity grid.</p>
    <div class="row"><label><input type="radio" name="emb" value="r" checked> random init</label><label><input type="radio" name="emb" value="t"> after training (toy)</label></div>
    <div class="toks"></div>
    <div class="hm-title">E — highlighted row is the one the lookup returns</div><div class="hm E"></div>
    <div class="last eq"></div>
    <div class="hm-title">cosine similarity between rows of E</div><div class="hm sim"></div>`;
  const q = s => el.querySelector(s);
  q('.toks').innerHTML = toks.map((t, i) => `<button class="tk" data-i="${i}">${i}: ${t}</button>`).join('');
  el.querySelectorAll('.tk').forEach(b => b.onclick = () => { sel = +b.dataset.i; draw(); });
  el.querySelectorAll('input[name=emb]').forEach(r => r.onchange = () => { E = r.value === 'r' ? random : trained; draw(); });
  function draw() {
    el.querySelectorAll('.tk').forEach(b => b.classList.toggle('on', +b.dataset.i === sel));
    q('.hm.E').innerHTML = '<table><tr><th></th>' + Array.from({ length: d }, (_, j) => `<th>d${j}</th>`).join('') + '</tr>' +
      E.map((row, i) => `<tr class="${i === sel ? 'hl' : ''}"><th>${i} ${toks[i]}</th>` + row.map(v => `<td style="background:${v > 0 ? `rgba(76,141,255,${Math.abs(v)})` : `rgba(255,159,67,${Math.abs(v)})`}">${v.toFixed(2)}</td>`).join('') + '</tr>').join('') + '</table>';
    const oh = toks.map((_, i) => i === sel ? 1 : 0);
    q('.eq').innerHTML = `onehot(${sel}) = [${oh.join(', ')}]<br>x = onehot · E = <b>[${E[sel].map(v => v.toFixed(2)).join(', ')}]</b> &nbsp;<small>= row ${sel}</small>`;
    q('.hm.sim').innerHTML = '<table><tr><th></th>' + toks.map(t => `<th>${t}</th>`).join('') + '</tr>' +
      E.map((a, i) => `<tr><th>${toks[i]}</th>` + E.map(b => { const c = cos(a, b); return `<td style="background:rgba(61,220,151,${Math.max(0, c)})">${c.toFixed(2)}</td>`; }).join('') + '</tr>').join('') + '</table>';
  }
  draw();
};

/* Sinusoidal table heatmap + RoPE relative-position demo. */
WIDGETS.positional = function (el) {
  const T = 24, d = 16;
  const PE = Array.from({ length: T }, (_, t) => Array.from({ length: d }, (_, j) => { const f = Math.pow(10000, -Math.floor(j / 2) * 2 / d); return j % 2 ? Math.cos(t * f) : Math.sin(t * f); }));
  el.innerHTML = `<h3>Sinusoidal PE[t, j]</h3>
    <p class="hint">Rows = position t, columns = dimension j. Each column pair is a sin/cos "clock hand" at its own frequency: j=0,1 spin fastest, j=14,15 slowest.</p>
    <label>t = <span class="tv">0</span></label><input class="tsl" type="range" min="0" max="${T - 1}" value="0">
    <div class="hm pe"></div>
    <h3 style="margin-top:18px">RoPE on one 2-D pair</h3>
    <p class="hint">q at position m and k at position n are each rotated by their position × θ. Their dot product depends only on m − n. Shift both together and nothing changes.</p>
    <div class="row"><label>m = <span class="mv">3</span></label><input class="msl" type="range" min="0" max="20" value="3"><label>n = <span class="nv">1</span></label><input class="nsl" type="range" min="0" max="20" value="1"><button class="shift">shift both +1</button></div>
    <svg class="rope" viewBox="0 0 320 170" width="100%" style="max-width:320px;display:block"></svg>
    <div class="last ropeeq"></div>`;
  const q = s => el.querySelector(s);
  const tsl = q('.tsl'), msl = q('.msl'), nsl = q('.nsl');
  function drawPE() {
    const t = +tsl.value; q('.tv').textContent = t;
    q('.hm.pe').innerHTML = '<table>' + PE.map((row, i) => `<tr class="${i === t ? 'hl' : ''}"><th>${i}</th>` + row.map(v => `<td style="width:18px;background:${v > 0 ? `rgba(76,141,255,${v})` : `rgba(255,159,67,${-v})`}"></td>`).join('') + '</tr>').join('') + '</table>';
  }
  const theta = 0.35, q0 = [1.0, 0.3], k0 = [0.8, 0.6];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  function drawRope() {
    const m = +msl.value, n = +nsl.value; q('.mv').textContent = m; q('.nv').textContent = n;
    const qm = rot(q0, m * theta), kn = rot(k0, n * theta);
    const dot = qm[0] * kn[0] + qm[1] * kn[1];
    const cx = 160, cy = 85, S = 60;
    const arrow = (v, col, lab) => `<line x1="${cx}" y1="${cy}" x2="${cx + v[0] * S}" y2="${cy - v[1] * S}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><text x="${cx + v[0] * S * 1.18}" y="${cy - v[1] * S * 1.18}" fill="${col}" font-size="12" text-anchor="middle">${lab}</text>`;
    q('.rope').innerHTML = `<circle cx="${cx}" cy="${cy}" r="${S}" fill="none" stroke="#2a3140"/><line x1="${cx - 80}" y1="${cy}" x2="${cx + 80}" y2="${cy}" stroke="#2a3140"/><line x1="${cx}" y1="${cy - 80}" x2="${cx}" y2="${cy + 80}" stroke="#2a3140"/>` +
      arrow(q0, '#3a4152', 'q') + arrow(k0, '#3a4152', 'k') + arrow(qm, '#4c8dff', `q·R(${m}θ)`) + arrow(kn, '#ff9f43', `k·R(${n}θ)`);
    q('.ropeeq').innerHTML = `angle between them = (m − n)·θ = <b>${m - n}θ</b> &nbsp;→&nbsp; q'·k' = <b>${dot.toFixed(3)}</b>`;
  }
  tsl.oninput = drawPE; msl.oninput = drawRope; nsl.oninput = drawRope;
  q('.shift').onclick = () => { if (+msl.value < 20 && +nsl.value < 20) { msl.value = +msl.value + 1; nsl.value = +nsl.value + 1; drawRope(); } };
  drawPE(); drawRope();
};

/* Minimal byte-pair encoding, character-level (characters stand in for bytes). Shared by the two widgets. */
const BPE = {
  DEFAULT_CORPUS: 'the cat sat on the mat. the cat ate the rat. low lower lowest. new newer newest. slow slower slowest. the newest cat is the slowest cat',
  pretok(text) { return text.match(/ ?[A-Za-z]+| ?[0-9]+| ?[^\sA-Za-z0-9]+|\s+/g) || []; },
  init(text) {
    const freq = new Map();
    for (const w of BPE.pretok(text)) freq.set(w, (freq.get(w) || 0) + 1);
    const base = [...new Set(text)].sort();
    return { base: base.length, vocab: [...base], merges: [], words: [...freq].map(([w, c]) => ({ sym: [...w], c })) };
  },
  pairCounts(st) {
    const m = new Map();
    for (const w of st.words) for (let i = 0; i < w.sym.length - 1; i++) { const k = w.sym[i] + ' ' + w.sym[i + 1]; m.set(k, (m.get(k) || 0) + w.c); }
    return m;
  },
  topPairs(st, n) { return [...BPE.pairCounts(st)].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, c]) => [...k.split(' '), c]); },
  step(st) {
    const pc = BPE.pairCounts(st); if (!pc.size) return null;
    let best = null, bc = 0; for (const [k, c] of pc) if (c > bc) { bc = c; best = k; }
    const [a, b] = best.split(' ');
    for (const w of st.words) {
      const out = [];
      for (let i = 0; i < w.sym.length; i++) { if (i < w.sym.length - 1 && w.sym[i] === a && w.sym[i + 1] === b) { out.push(a + b); i++; } else out.push(w.sym[i]); }
      w.sym = out;
    }
    st.merges.push([a, b]); st.vocab.push(a + b);
    return { a, b, count: bc };
  },
  encode(st, text) {
    const rank = new Map(st.merges.map(([a, b], i) => [a + ' ' + b, i])), id = new Map(st.vocab.map((t, i) => [t, i]));
    const out = [];
    for (const w of BPE.pretok(text)) {
      const sym = [...w];
      for (;;) {                                   // always apply the earliest-learned merge that is present
        let bi = -1, br = Infinity;
        for (let i = 0; i < sym.length - 1; i++) { const r = rank.get(sym[i] + ' ' + sym[i + 1]); if (r !== undefined && r < br) { br = r; bi = i; } }
        if (bi < 0) break;
        sym.splice(bi, 2, sym[bi] + sym[bi + 1]);
      }
      for (const s of sym) out.push({ tok: s, id: id.has(s) ? id.get(s) : null });
    }
    return out;
  },
  chip(tok, st, unknown) {
    const shown = tok.replace(/ /g, '␣').replace(/\n/g, '⏎');
    const hue = st ? ((st.vocab.indexOf(tok) * 47) % 360) : 210;
    const style = unknown ? 'background:#2a2f3a;color:#8b94a7' : `background:hsl(${hue} 45% 28%)`;
    return `<span class="chip" style="${style}">${shown.replace(/</g, '&lt;')}</span>`;
  },
};
