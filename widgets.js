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
};
