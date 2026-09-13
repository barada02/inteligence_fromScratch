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
