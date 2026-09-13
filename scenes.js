/* Diagram tree. Each scene = { title, nodes, edges, notes, widget? }.
   node: { id, label, x, y, w, h, kind, sub?, child?, status?, notes?, widget? }
     kind:   tensor | weights | op | concept | group
     child:  id of the scene you enter when you double-click this box
     status: todo | done | revisit   (tracking of what we have actually discussed)
   edge: [from, to, label?]  or  { from, to, label?, arc: -140, dir: 'v'|'h' }
         arc = skip connection drawn over the top; dir forces vertical/horizontal routing
   notes: markdown (headings, lists, **bold**, *italic*, `code`, ``` fences). */

const SCENES = {

/* ------------------------------------------------------------------ */
root: {
  title: 'Whole picture',
  nodes: [
    { id: 'data',      label: 'Raw text\n(web, books, code)', x: 0,    y: 200, w: 180, h: 80,  kind: 'tensor' },
    { id: 'tokenizer', label: 'Tokenizer',                    x: 240,  y: 200, w: 170, h: 80,  kind: 'op',      child: 'tokenizer', status: 'done' },
    { id: 'ids',       label: 'Token IDs',                    x: 470,  y: 200, w: 170, h: 80,  kind: 'tensor',  sub: '[464, 3290, 3332, …]' },
    { id: 'model',     label: 'Model\n(Transformer)',         x: 700,  y: 180, w: 220, h: 120, kind: 'weights', child: 'model' },
    { id: 'logits',    label: 'Logits',                       x: 990,  y: 200, w: 180, h: 80,  kind: 'tensor',  sub: 'one score per vocab token' },
    { id: 'training',  label: 'Training loop',               x: 700,  y: 400, w: 220, h: 90,  kind: 'concept', child: 'training' },
    { id: 'inference', label: 'Inference loop\n(generation)', x: 990,  y: 400, w: 180, h: 90,  kind: 'concept', child: 'inference' },
    { id: 'posttrain', label: 'Post-training\nSFT · RLHF · DPO', x: 700, y: 560, w: 220, h: 80, kind: 'concept', child: 'posttrain' },
  ],
  edges: [
    ['data', 'tokenizer'], ['tokenizer', 'ids'], ['ids', 'model'], ['model', 'logits'],
    { from: 'logits', to: 'training', label: 'compare to true next token', dir: 'v' },
    { from: 'logits', to: 'inference', label: 'sample → append → repeat', dir: 'v' },
    ['training', 'posttrain', 'then'],
  ],
  notes: `
# The whole picture

An LLM is one function:

**token ids in → a score for every possible next token out.**

That's it. Everything else on this screen is machinery *around* that function.

## Two loops use the same function

- **Training loop** — feed it real text, see what it predicted for the next token, compare with what the next token actually was, nudge the weights so the true token scores a bit higher. Repeat for trillions of tokens.
- **Inference loop** — give a prompt, take the scores, pick one token, append it, feed everything back in. Repeat until it emits "end".

Training changes the orange box. Inference never does.

## How to read the colours

- **orange border** = has learned weights. These are the numbers that training moves, and that "freezing" locks.
- **blue** = a tensor (data) flowing through.
- **green** = a fixed operation with no weights (softmax, masking, adding).
- **purple** = a process/concept rather than a single tensor op.

Double-click any box marked ⤵ to zoom inside it.
`
},

/* ------------------------------------------------------------------ */
model: {
  title: 'Model',
  nodes: [
    { id: 'ids',   label: 'Token IDs',                   x: 0,    y: 200, w: 150, h: 70, kind: 'tensor',  sub: '(T)', status: 'done',
      notes: `Integers, one per position. Nothing else survives from the text. \`T\` = sequence length (context). The model has no idea that 464 was "The" — that meaning has to be learned into row 464 of the embedding table.` },
    { id: 'emb',   label: 'Token embedding',             x: 210,  y: 200, w: 180, h: 70, kind: 'weights', sub: 'lookup: vocab × d_model', child: 'embedding', status: 'done' },
    { id: 'pos',   label: 'Positional info',             x: 210,  y: 330, w: 180, h: 70, kind: 'weights', sub: 'learned, or RoPE inside attention', child: 'positional', status: 'done' },
    { id: 'add',   label: '+',                           x: 440,  y: 210, w: 50,  h: 50, kind: 'op', status: 'done',
      notes: `Plain vector addition, \`x_t = E[id_t] + P[t]\`. Both are \`d_model\` long, so this is a coordinate-wise sum. Why add and not concatenate? Adding keeps \`d_model\` fixed, and the network can learn to keep "what" and "where" in different sub-directions of the same vector. With RoPE this box does nothing.` },
    { id: 'grp',   label: '× N identical blocks, each with its own weights. The residual stream (T × d_model) runs straight through all of them.',
      x: 530, y: 120, w: 610, h: 230, kind: 'group' },
    { id: 'blk1',  label: 'Block 1',                     x: 560,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block' },
    { id: 'blk2',  label: 'Block 2',                     x: 750,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block' },
    { id: 'blkN',  label: 'Block N',                     x: 960,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block' },
    { id: 'ln',    label: 'Final LayerNorm',             x: 1200, y: 200, w: 160, h: 70, kind: 'weights' },
    { id: 'head',  label: 'LM head',                     x: 1420, y: 200, w: 180, h: 70, kind: 'weights', sub: 'd_model → vocab' },
    { id: 'logits', label: 'Logits',                     x: 1660, y: 200, w: 150, h: 70, kind: 'tensor',  sub: '(T × vocab)' },
  ],
  edges: [
    ['ids', 'emb'], ['emb', 'add'], ['pos', 'add'], ['add', 'blk1'], ['blk1', 'blk2'], ['blk2', 'blkN', '…'],
    ['blkN', 'ln'], ['ln', 'head'], ['head', 'logits'],
  ],
  notes: `
# Inside the model

The one idea to hold on to: there is a **residual stream** — one vector of size d_model *per token* — that flows left to right. Every block **reads** from it and **adds** something back. Nothing ever replaces the stream. Every layer is

\`x = x + f(x)\`

## Stages

- **Token embedding** — a lookup table. Row 464 of the table *is* the vector for token 464. Learned.
- **Positional info** — attention on its own doesn't know order, so we inject it. Old style: a second learned table added here. Modern (Llama, etc.): RoPE, applied to Q and K inside attention instead — so this box is sometimes empty.
- **N blocks** — identical *structure*, separate *weights*. GPT-2 small: N = 12, d_model = 768. Llama-3 70B: N = 80, d_model = 8192.
- **Final LayerNorm + LM head** — project d_model → vocab size. One number per vocabulary entry = the logits.

## Where the parameters live

Almost all of them are in the blocks. The embedding and LM head are often the *same* matrix (weight tying) — reading a token in and predicting a token out use the same geometry.

## Shape check

Input \`(T)\` ids → \`(T × d_model)\` all the way through → \`(T × vocab)\` at the end. During training we use all T rows of the logits (one prediction per position). During inference we only care about the last row.
`
},

/* ------------------------------------------------------------------ */
embedding: {
  title: 'Token embedding',
  widget: 'embedding',
  nodes: [
    { id: 'id',     label: 'token id',              x: 0,    y: 200, w: 140, h: 70, kind: 'tensor',  sub: 'e.g. 3', status: 'done',
      notes: `One integer. Its only job is to select a row.` },
    { id: 'onehot', label: 'one-hot',               x: 200,  y: 200, w: 150, h: 70, kind: 'tensor',  sub: '(vocab) · a 1 at index 3', status: 'done',
      notes: `
A vector as long as the vocabulary, all zeros except a single 1 at the token's index.

\`[0, 0, 0, 1, 0, 0, 0, 0]\`

This is the *mathematical* input to the model. In code nobody builds it — it would be 50k numbers to pick one row — but it makes the next step an ordinary matrix multiply, which is why gradients flow into the table exactly like any other weight.` },
    { id: 'E',      label: 'Embedding matrix E',    x: 420,  y: 340, w: 200, h: 70, kind: 'weights', sub: '(vocab × d_model)', status: 'done',
      notes: `
The table. GPT-2: \`50257 × 768\` ≈ 38M numbers. Llama-3 8B: \`128256 × 4096\` ≈ 525M.

- Initialised as small random noise.
- Each training step, only the rows of tokens present in the batch get a gradient. Frequent tokens' rows are updated millions of times; rare tokens' rows barely move.
- There is no rule about what the columns mean. Structure (cat ≈ dog, king − man + woman ≈ queen) *emerges* because it lowers the next-token loss.

Often the same matrix is reused as the LM head at the output (weight tying): predicting token \`i\` = dot product with row \`i\`.` },
    { id: 'mul',    label: 'onehot · E',            x: 420,  y: 200, w: 200, h: 70, kind: 'op',      sub: '= row 3 of E', status: 'done',
      notes: `
\`x = onehot(3) · E\`

Multiply a \`(1 × vocab)\` by a \`(vocab × d_model)\` → \`(1 × d_model)\`. Every term is zero except the one where the 1 sits, so the result is literally row 3 copied out. Implementations do \`E[3]\` directly (\`nn.Embedding\`) — same result, no multiply.` },
    { id: 'x',      label: 'x',                     x: 690,  y: 200, w: 140, h: 70, kind: 'tensor',  sub: '(d_model)', status: 'done',
      notes: `The token's vector. From here on the model works only with these — \`T\` of them stacked into \`(T × d_model)\`. This is the *start* of the residual stream.` },
    { id: 'learn',  label: 'What training does to E', x: 690, y: 340, w: 200, h: 70, kind: 'concept', status: 'done',
      notes: `
Nothing directly. The loss is about next-token prediction; \`E\` just receives whatever gradient flows back through the blocks. But the effect is systematic:

- tokens that appear in interchangeable contexts get pushed toward the same direction (their rows must produce similar downstream behaviour);
- directions become reusable features — a "plural-ness" direction, a "is-a-number" direction — because the blocks can only read linear-ish combinations.

Toggle the widget below between random init and the (toy) trained table and watch the cosine-similarity grid go from noise to blocks.` },
  ],
  edges: [
    ['id', 'onehot'], ['onehot', 'mul'], { from: 'E', to: 'mul', dir: 'v' }, ['mul', 'x'],
    { from: 'E', to: 'learn', label: 'gradients', dir: 'h' },
  ],
  notes: `
# Token embedding

**Correction to hold on to:** the tokenizer gives an *id*. The *vector* is produced here, by the model, from learned weights.

## Math

\`\`\`
E : (vocab × d_model)          learned
x_t = E[id_t]                  lookup   (≡ onehot(id_t) · E)
X   = [x_1; x_2; …; x_T]       (T × d_model)
\`\`\`

## Why a lookup and not a formula?

Because there is nothing about the *number* 3290 that relates to "cat". Ids are arbitrary labels from BPE. A lookup table is the most general function from an arbitrary label to a vector — every id gets its own free parameters.

## Where meaning comes from

The rows start random. Training never says "make cat close to dog". It only says "predict the next token better". But if \`cat\` and \`dog\` show up before similar words, the cheapest way to predict well is to give them similar vectors, so the rest of the network can treat them alike. Similarity is a *side-effect* of compression.

## Sizes

- GPT-2: 50257 × 768
- Llama-3 8B: 128256 × 4096 (≈ 6.5% of all params)
- \`d_model\` is chosen by the designer; vocab is fixed by the tokenizer.
`
},

/* ------------------------------------------------------------------ */
positional: {
  title: 'Positional information',
  widget: 'positional',
  nodes: [
    { id: 'x',      label: 'x_t = E[id_t]',           x: 0,    y: 200, w: 170, h: 70, kind: 'tensor',  sub: '(d_model) · order-free', status: 'done',
      notes: `The same token gives the same vector wherever it appears. \`"cat"\` at position 1 and at position 40 are identical at this point — that is the problem this scene solves.` },
    { id: 'why',    label: 'Why: attention is\norder-blind', x: 0, y: 360, w: 170, h: 90, kind: 'concept', status: 'done',
      notes: `
Attention computes \`softmax(Q·Kᵀ)·V\`. Permute the input rows and every output row is permuted the same way — the operation is **permutation-equivariant**. It sees a *set* of tokens, not a *sequence*. The MLP is per-token and doesn't help either.

So \`"dog bites man"\` and \`"man bites dog"\` would be indistinguishable. Position must be injected somewhere.` },
    { id: 'grp',    label: 'pick one — every model uses exactly one scheme', x: 240, y: 90, w: 380, h: 420, kind: 'group' },
    { id: 'learned', label: 'Learned table P',        x: 270,  y: 130, w: 320, h: 70, kind: 'weights', sub: '(T_max × d_model) · GPT-2', status: 'done',
      notes: `
A second lookup, indexed by position instead of id: \`P[t]\`. Free parameters, learned like \`E\`.

- Simple, works.
- Hard limit: no row for \`t > T_max\`. GPT-2 cannot see position 1025.
- No built-in notion that position 7 is "near" position 8 — it has to learn that too.` },
    { id: 'sin',    label: 'Sinusoidal (fixed)',     x: 270,  y: 250, w: 320, h: 70, kind: 'op',      sub: 'no weights · original Transformer', status: 'done',
      notes: `
\`\`\`
PE[t, 2i]   = sin( t / 10000^(2i/d) )
PE[t, 2i+1] = cos( t / 10000^(2i/d) )
\`\`\`

Each pair of dimensions is a clock hand turning at its own speed: dim 0/1 spins fast, the last pair barely moves. Together they form a unique "timestamp" per position — like reading hours, minutes, seconds.

Nice property: \`PE[t+k]\` is a fixed linear function of \`PE[t]\` (a rotation), so "k steps ahead" is easy to express. Green because there is nothing to learn.` },
    { id: 'rope',   label: 'RoPE (rotary)',          x: 270,  y: 370, w: 320, h: 70, kind: 'op',      sub: 'rotates Q, K inside attention · Llama', status: 'done',
      notes: `
Adds nothing to \`x\`. Instead, inside every attention layer, pair up the dimensions of \`q\` and \`k\` and rotate each pair by an angle \`t · θ_i\` (position × a per-pair frequency):

\`\`\`
q'_m = R(m·θ) q        k'_n = R(n·θ) k
q'_m · k'_n = qᵀ R((m−n)·θ) k       ← depends only on m − n
\`\`\`

So the attention score sees *relative* distance, never absolute position. Consequences: no \`T_max\` table, better length extrapolation, and the "+ Positional" box on the Model scene is empty. Play with it below.` },
    { id: 'add',    label: '+',                      x: 680,  y: 210, w: 50,  h: 50, kind: 'op', status: 'done',
      notes: `\`x_t + P[t]\` (learned or sinusoidal). Coordinate-wise. The network learns to keep "what" and "where" in separable directions of the same vector.` },
    { id: 'out',    label: 'x_t + P[t]',             x: 790,  y: 200, w: 170, h: 70, kind: 'tensor',  sub: '(d_model) → block 1', status: 'done',
      notes: `Now the same token at two positions gives two different vectors. Attention can tell them apart. With RoPE, this box is just \`x_t\` and the distinction is made later, inside each attention layer.` },
    { id: 'attn',   label: 'attention (Q, K)',       x: 790,  y: 370, w: 170, h: 70, kind: 'weights', sub: 'inside every block', status: 'done',
      notes: `Where RoPE does its work — see the Attention scene. The rotation is applied to Q and K after their projections, before the dot product. V is left alone.` },
  ],
  edges: [
    ['x', 'add'], ['learned', 'add'], ['sin', 'add'], ['add', 'out'],
    { from: 'rope', to: 'attn', label: 'rotate q, k by position', dir: 'h' },
    { from: 'why', to: 'x', dir: 'v' },
  ],
  notes: `
# Positional information

## The problem

Attention is a function of a *set*. Without position, \`"dog bites man"\` = \`"man bites dog"\`. Something has to break the symmetry.

## When it happens

- **Learned / sinusoidal:** once, right after the embedding lookup, before block 1. \`x_t ← E[id_t] + P[t]\`.
- **RoPE:** never added to \`x\`. Applied to \`q\` and \`k\` inside *every* attention layer.

## The three schemes in one line each

- **Learned table** — \`P[t]\` free parameters; simplest; hard length limit.
- **Sinusoidal** — fixed sin/cos "clock hands" at many frequencies; no weights; unbounded.
- **RoPE** — rotate \`q, k\` by \`t·θ\`; the score \`q_m·k_n\` then depends only on \`m − n\`. What almost everything uses now.

## Why the relative version wins

Language cares about "how far apart" far more than "absolute index". A verb attends to its subject two tokens back whether the sentence starts at position 0 or 900. RoPE bakes that in; the learned table has to discover it for every pair of positions separately.

## Widget below

Top: the sinusoidal table as a heatmap — slide the position and watch the fast dims flip while slow dims crawl. Bottom: RoPE on a 2-D pair. Move \`m\` and \`n\`; the dot product only changes when their *difference* does.
`
},

/* ------------------------------------------------------------------ */
block: {
  title: 'Transformer block',
  nodes: [
    { id: 'xin',  label: 'x_in',                  x: 0,    y: 200, w: 120, h: 70,  kind: 'tensor',  sub: '(T × d_model)' },
    { id: 'ln1',  label: 'LayerNorm',             x: 190,  y: 200, w: 140, h: 70,  kind: 'weights' },
    { id: 'attn', label: 'Multi-head\nattention', x: 390,  y: 180, w: 200, h: 110, kind: 'weights', child: 'attention' },
    { id: 'add1', label: '+',                     x: 650,  y: 210, w: 50,  h: 50,  kind: 'op' },
    { id: 'ln2',  label: 'LayerNorm',             x: 770,  y: 200, w: 140, h: 70,  kind: 'weights' },
    { id: 'mlp',  label: 'MLP\n(feed-forward)',   x: 970,  y: 180, w: 200, h: 110, kind: 'weights', child: 'mlp' },
    { id: 'add2', label: '+',                     x: 1230, y: 210, w: 50,  h: 50,  kind: 'op' },
    { id: 'xout', label: 'x_out',                 x: 1350, y: 200, w: 120, h: 70,  kind: 'tensor',  sub: '(T × d_model)' },
  ],
  edges: [
    ['xin', 'ln1'], ['ln1', 'attn'], ['attn', 'add1'], ['add1', 'ln2'], ['ln2', 'mlp'], ['mlp', 'add2'], ['add2', 'xout'],
    { from: 'xin',  to: 'add1', label: 'residual (skip)', arc: -150 },
    { from: 'add1', to: 'add2', label: 'residual (skip)', arc: -150 },
  ],
  notes: `
# One block

Two sub-layers, each wrapped the same way: **normalise → do something → add it back**.

- **Attention** mixes information *across tokens*. It's the only place tokens talk to each other.
- **MLP** processes each token *on its own*, the same function applied to every position. This is where most of the parameters (≈ 2/3) and, roughly, most of the "knowledge" sits.

## Why the skip connections matter

The dashed arcs are the residual stream passing *around* each sub-layer. Because of them:

- the block only has to learn a *correction* \`f(x)\`, not a whole new representation,
- gradients have a straight path from the loss back to layer 1 — this is what makes 80-layer stacks trainable at all.

## LayerNorm

Rescales each token's vector to have a stable mean/variance before the sub-layer sees it (has a small learned scale + shift, hence orange). Modern models use RMSNorm — same idea, skips the mean. "Pre-norm" (norm before the sub-layer, as drawn) is what everyone uses now.

Shapes never change inside a block: \`(T × d_model)\` in, \`(T × d_model)\` out. That's what lets you stack N of them.
`
},

/* ------------------------------------------------------------------ */
attention: {
  title: 'Attention',
  widget: 'attention',
  nodes: [
    { id: 'x',       label: 'x',                     x: 0,    y: 260, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)' },
    { id: 'grp',     label: 'one head — this whole path is repeated h times in parallel with different W_Q, W_K, W_V',
      x: 200, y: 50, w: 1100, h: 500, kind: 'group' },
    { id: 'wq',      label: 'W_Q',                   x: 240,  y: 100, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head' },
    { id: 'wk',      label: 'W_K',                   x: 240,  y: 260, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head' },
    { id: 'wv',      label: 'W_V',                   x: 240,  y: 420, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head' },
    { id: 'scores',  label: 'scores = Q·Kᵀ / √d',    x: 450,  y: 180, w: 200, h: 70, kind: 'op',      sub: '(T × T)' },
    { id: 'mask',    label: 'causal mask',           x: 710,  y: 180, w: 150, h: 70, kind: 'op',      sub: 'future → −∞' },
    { id: 'softmax', label: 'softmax\n(per row)',    x: 920,  y: 180, w: 150, h: 70, kind: 'op' },
    { id: 'wsum',    label: 'weights · V',           x: 1100, y: 340, w: 170, h: 70, kind: 'op',      sub: '(T × d_head)' },
    { id: 'concat',  label: 'concat heads',          x: 1360, y: 260, w: 160, h: 70, kind: 'op',      sub: '(T × h·d_head)' },
    { id: 'wo',      label: 'W_O',                   x: 1580, y: 260, w: 140, h: 70, kind: 'weights', sub: 'h·d_head → d_model' },
    { id: 'out',     label: 'out',                   x: 1780, y: 260, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)' },
  ],
  edges: [
    ['x', 'wq'], ['x', 'wk'], ['x', 'wv'],
    ['wq', 'scores', 'Q'], ['wk', 'scores', 'K'],
    ['scores', 'mask'], ['mask', 'softmax'], ['softmax', 'wsum'], ['wv', 'wsum', 'V'],
    ['wsum', 'concat'], ['concat', 'wo'], ['wo', 'out'],
  ],
  notes: `
# Attention

Every token builds three vectors from its own residual-stream vector:

- **Q (query)** — "what am I looking for?"
- **K (key)** — "what do I contain, for others to match against?"
- **V (value)** — "what do I hand over if someone attends to me?"

Then for each token (row) we compare its Q with *every* token's K. High dot product = strong match. That gives a T × T table of scores.

## The four steps after that

1. **Scale by √d_head** — otherwise dot products grow with dimension and softmax saturates to one-hot.
2. **Causal mask** — set every "future" cell to −∞ so token 3 can't peek at token 5. This is what makes it a *next-token* predictor and what lets one forward pass train all T positions at once.
3. **Softmax per row** — turn scores into weights that sum to 1.
4. **Weighted sum of V** — each token's output is a blend of other tokens' V, in those proportions.

## Heads

One head = one (W_Q, W_K, W_V) triple with a small d_head (e.g. 64). We run h of them in parallel (GPT-2: 12 heads × 64 = 768 = d_model), concatenate, and mix with W_O. Different heads learn different relations: previous token, matching brackets, subject↔verb, etc.

## What has weights, what doesn't

Only W_Q, W_K, W_V, W_O are learned. Scores, mask, softmax, the weighted sum — all fixed arithmetic. Attention has surprisingly few parameters; it's the *routing*, the MLP is the *storage*.

Play with the head below — it is really computing Q·Kᵀ on six tokens. Untick the mask and watch the upper triangle light up.
`
},

/* ------------------------------------------------------------------ */
mlp: {
  title: 'MLP',
  nodes: [
    { id: 'x',    label: 'x',            x: 0,   y: 200, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)' },
    { id: 'up',   label: 'W_up',         x: 200, y: 200, w: 170, h: 70, kind: 'weights', sub: 'd_model → 4·d_model' },
    { id: 'act',  label: 'GELU / SiLU',  x: 440, y: 200, w: 150, h: 70, kind: 'op',      sub: 'elementwise' },
    { id: 'down', label: 'W_down',       x: 660, y: 200, w: 170, h: 70, kind: 'weights', sub: '4·d_model → d_model' },
    { id: 'out',  label: 'out',          x: 900, y: 200, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)' },
  ],
  edges: [['x', 'up'], ['up', 'act'], ['act', 'down'], ['down', 'out']],
  notes: `
# MLP (feed-forward)

The simplest part and the biggest: expand each token's vector 4×, apply a nonlinearity, squeeze it back.

- Applied to **each token independently** — no mixing across positions. The same two matrices for every position.
- \`W_up\` and \`W_down\` together hold about **2/3 of all parameters** in a standard transformer.
- A useful mental model: \`W_up\` rows are "detectors" (does this token's vector look like X?), the nonlinearity gates them, \`W_down\` rows are what to add to the stream when a detector fires. That's why factual recall tends to show up here.

Modern variants (Llama) use a *gated* version — SwiGLU — with three matrices instead of two, but the shape story is the same.
`
},

/* ------------------------------------------------------------------ */
tokenizer: {
  title: 'Tokenizer',
  widget: 'bpe_encode',
  nodes: [
    { id: 'text',    label: '"The cat sat"',        x: 0,    y: 200, w: 170, h: 70, kind: 'tensor',  status: 'done',
      notes: `Plain text. Unicode, any language, code, emoji — the tokenizer has to handle *all* of it, which is why modern ones work on **bytes** underneath, not characters or words.` },
    { id: 'pre',     label: 'Pre-tokenise',         x: 230,  y: 200, w: 170, h: 70, kind: 'op',      sub: 'regex → "words"', status: 'done',
      notes: `
A fixed regex splits text into chunks that merges are *not allowed to cross*. GPT-style: a chunk is a run of letters, or a run of digits, or punctuation — **with its leading space attached**.

\`"The cat sat"\` → \`["The", " cat", " sat"]\`

That leading space is why \`"The"\` and \`" The"\` end up as different tokens. It also means a merge can never glue two words together, which keeps the vocabulary sane.` },
    { id: 'bytes',   label: 'Bytes',                x: 460,  y: 200, w: 150, h: 70, kind: 'tensor',  sub: 'UTF-8 · 256 base tokens', status: 'done',
      notes: `
Each chunk becomes its raw UTF-8 bytes. The 256 possible byte values are the **base vocabulary** — tokens 0–255 exist before any learning.

Consequence: there is no "unknown word". Anything at all can be represented, worst case as one token per byte. Rare words, typos, other scripts just cost *more* tokens.` },
    { id: 'merges',  label: 'Apply BPE merges',     x: 670,  y: 200, w: 190, h: 70, kind: 'weights', sub: 'learned merge table, by rank', child: 'bpe', status: 'done',
      notes: `
This is the real tokenizer. It holds an ordered list of merge rules learned from data, like

1. \`t\` + \`h\` → \`th\`
2. \`th\` + \`e\` → \`the\`
3. \` \` + \`the\` → \` the\`
…

To encode a chunk: start from its bytes, repeatedly find the pair with the **lowest rank** (earliest-learned) that appears, merge it, repeat until nothing matches. Same rules, same order, every time — it's deterministic.

Orange because it is *learned* — but learned by counting, not by gradient descent. Double-click to see how.` },
    { id: 'vocab',   label: 'Vocabulary',           x: 670,  y: 350, w: 190, h: 70, kind: 'weights', sub: 'token ↔ id · 50k–200k', status: 'done',
      notes: `
The dictionary you were thinking of. One entry per token: the 256 bytes plus one entry per merge. GPT-2: 50,257. Llama-3: 128,256. GPT-4o: ~200k.

It is a *by-product* of training the merges: every merge creates exactly one new vocabulary entry. So vocab size = 256 + number of merges + special tokens.

Only used at the very end, to swap each final piece for its integer.` },
    { id: 'ids',     label: '[464, 3290, 3332]',    x: 920,  y: 200, w: 180, h: 70, kind: 'tensor',  sub: 'token ids', status: 'done',
      notes: `Just integers. The model never sees text — from here on, 464 is a row index into the embedding table and nothing more. Whether 464 "means" \`The\` is entirely learned later.` },
    { id: 'special', label: 'Special tokens',       x: 230,  y: 350, w: 190, h: 70, kind: 'concept', sub: '<|endoftext|>, chat roles', status: 'done',
      notes: `
A handful of tokens that never come from text: \`<|endoftext|>\` (document boundary / stop), and in chat models the role markers (\`<|user|>\`, \`<|assistant|>\` …). They're added to the vocab by hand and the pre-tokeniser is told to match them literally.

Their embeddings are learned like any other token's — the model learns what "assistant turn starts here" means only from seeing it in training.` },
  ],
  edges: [
    ['text', 'pre'], ['pre', 'bytes'], ['bytes', 'merges'], ['merges', 'ids'],
    { from: 'vocab', to: 'ids', label: 'lookup', dir: 'h' },
    ['special', 'pre', 'matched literally'],
  ],
  notes: `
# Tokenizer

**Misconception check:** "is the tokenizer a dictionary of word → number?"

Half right. There *is* a dictionary at the end (the Vocabulary box). But:

- the entries are **learned pieces**, not words — chosen purely by frequency in the training text;
- **spaces belong to tokens** — \`"The"\`, \`" The"\`, \`"the"\` are three different ids;
- there is a **process** before the lookup: split → bytes → apply merges in learned order → then look up.

The dictionary is the *output* of the tokenizer's training, not the tokenizer.

## Why not just words?

- Vocab would be unbounded (every name, typo, number, language).
- Anything unseen would be \`<unk>\` — the model could never read it.
- Words share structure (\`walk / walked / walking\`) that sub-word pieces expose for free.

## Why not just characters / bytes?

It works, but sequences get 4–5× longer and attention cost grows with the *square* of length. Sub-words are the compromise: common things are one token, rare things are several.

## Things that fall out of this

- \`"tokenization"\` → \`token\` + \`ization\`. Common stems become single tokens; suffixes get their own.
- Numbers split arbitrarily: \`12345\` might be \`123\` + \`45\`. This is one reason arithmetic is hard for LLMs.
- English costs ~1 token per 4 characters; Hindi or code can cost 2–4× more for the same meaning, because the merges were learned mostly from English.
- The tokenizer is **frozen before the model is trained** and never changes. The model's first layer is a lookup table indexed by these ids, so changing the tokenizer means retraining the model.

Try the encoder below. It uses merges learned from a tiny built-in corpus (see the BPE scene), so it is *bad* at anything outside that corpus — which is exactly the lesson: a tokenizer only knows what it was trained on.
`
},

/* ------------------------------------------------------------------ */
bpe: {
  title: 'Training the tokenizer (BPE)',
  widget: 'bpe_train',
  nodes: [
    { id: 'corpus', label: 'Training corpus',          x: 0,    y: 200, w: 180, h: 70, kind: 'tensor',  sub: 'a sample of the LLM training text', status: 'done',
      notes: `Usually a few GB sampled from the same data the model will be trained on. Whatever is frequent *here* gets short tokens. That is why English is cheap and other languages are expensive.` },
    { id: 'split',  label: 'Pre-tokenise → bytes',    x: 240,  y: 200, w: 190, h: 70, kind: 'op', status: 'done',
      notes: `Same split as at encode time. Each chunk starts as a list of single bytes. Count how many times each distinct chunk occurs so the loop can work on unique chunks weighted by frequency.` },
    { id: 'count',  label: 'Count adjacent pairs',    x: 490,  y: 200, w: 190, h: 70, kind: 'op', status: 'done',
      notes: `For every chunk, for every neighbouring pair of current symbols, add the chunk's frequency to that pair's count. \`t,h\` in "the" (×1000) and "that" (×300) → 1300.` },
    { id: 'pick',   label: 'Pick most frequent pair', x: 740,  y: 200, w: 200, h: 70, kind: 'op', status: 'done',
      notes: `Greedy. No lookahead, no notion of meaning. The only signal is "these two symbols sit next to each other a lot".` },
    { id: 'merge',  label: 'Merge it everywhere',     x: 1000, y: 200, w: 190, h: 70, kind: 'op', status: 'done',
      notes: `Replace every occurrence of the pair with one new symbol. Append the rule to the merge list — its position in the list is its **rank**, which is what the encoder uses to decide order later.` },
    { id: 'add',    label: 'Add token to vocab',      x: 1250, y: 200, w: 180, h: 70, kind: 'weights', sub: 'vocab grows by 1', status: 'done',
      notes: `New symbol gets the next free id. The vocabulary and the merge list grow in lock-step: 256 bytes + one token per merge.` },
    { id: 'stop',   label: 'Stop at target vocab size', x: 1250, y: 380, w: 180, h: 70, kind: 'concept', sub: 'e.g. 50k, 128k', status: 'done',
      notes: `The vocab size is a design choice made *before* training. Bigger vocab → shorter sequences but a bigger embedding table and rarer, worse-trained tokens. 32k–200k is the usual range.` },
  ],
  edges: [
    ['corpus', 'split'], ['split', 'count'], ['count', 'pick'], ['pick', 'merge'], ['merge', 'add'], ['add', 'stop'],
    { from: 'add', to: 'count', label: 'repeat', arc: -150 },
  ],
  notes: `
# Byte-Pair Encoding

The whole algorithm is one loop:

\`\`\`
symbols = bytes of every chunk
repeat (vocab_size − 256) times:
    pair  = most frequent adjacent (a, b)
    merge every "a b" into "ab"
    merges.append((a, b));  vocab.append("ab")
\`\`\`

That's it. No neural network, no gradients. It is *learned* only in the sense that the result depends on the data.

## Why it produces sensible pieces

Frequent letter pairs merge first (\`t h\`), then frequent triples form from those (\`th e\`), then whole common words (\` the\`). Rare words never accumulate enough count to get their own token, so they stay as a few pieces. The vocabulary ends up matching the statistics of the text, which is precisely what you want for a next-token predictor.

## Watch it happen

Step through the trainer below. Watch \`l o w e s t\` collapse into \`low est\` as the merges accumulate, and notice which pair it picks each time — always the most common one, nothing smarter.

Modern tokenizers (GPT-4, Llama-3) are this exact algorithm plus a few engineering details: byte-level base vocab, the pre-tokeniser regex, and a handful of special tokens.
`
},

/* ------------------------------------------------------------------ */
training: {
  title: 'Training loop',
  nodes: [
    { id: 'batch',   label: 'Batch of token ids',            x: 0,    y: 200, w: 190, h: 70, kind: 'tensor',  sub: '(B × T)' },
    { id: 'fwd',     label: 'Forward pass',                  x: 250,  y: 200, w: 170, h: 70, kind: 'weights', sub: 'the model' },
    { id: 'logits',  label: 'Logits',                        x: 480,  y: 200, w: 140, h: 70, kind: 'tensor',  sub: '(B × T × vocab)' },
    { id: 'targets', label: 'Targets',                       x: 480,  y: 360, w: 140, h: 70, kind: 'tensor',  sub: 'same ids, shifted by 1' },
    { id: 'loss',    label: 'Cross-entropy loss',            x: 680,  y: 200, w: 180, h: 70, kind: 'op',      sub: 'one number' },
    { id: 'back',    label: 'Backward\n(gradients)',         x: 920,  y: 190, w: 160, h: 90, kind: 'op' },
    { id: 'opt',     label: 'AdamW update',                  x: 1140, y: 200, w: 160, h: 70, kind: 'concept' },
    { id: 'freeze',  label: 'Freezing / fine-tuning\nLoRA, adapters', x: 920, y: 400, w: 220, h: 90, kind: 'concept' },
    { id: 'sched',   label: 'LR schedule, batch size,\nmixed precision', x: 1180, y: 400, w: 220, h: 90, kind: 'concept' },
  ],
  edges: [
    ['batch', 'fwd'], ['fwd', 'logits'], ['logits', 'loss'], ['targets', 'loss'], ['loss', 'back'], ['back', 'opt'],
    { from: 'opt', to: 'fwd', label: 'update weights, next batch', arc: -170 },
  ],
},

/* ------------------------------------------------------------------ */
inference: {
  title: 'Inference loop',
  nodes: [
    { id: 'prompt',  label: 'Prompt ids',                     x: 0,    y: 200, w: 150, h: 70, kind: 'tensor' },
    { id: 'prefill', label: 'Prefill',                        x: 210,  y: 200, w: 190, h: 70, kind: 'op',      sub: 'all prompt tokens at once' },
    { id: 'logits',  label: 'Logits for\nnext token',         x: 460,  y: 190, w: 160, h: 90, kind: 'tensor',  sub: 'last row only' },
    { id: 'sample',  label: 'Sampling',                       x: 680,  y: 200, w: 200, h: 70, kind: 'op',      sub: 'temperature · top-k · top-p', widget: 'softmax' },
    { id: 'append',  label: 'Append token',                   x: 940,  y: 200, w: 150, h: 70, kind: 'tensor' },
    { id: 'decode',  label: 'Decode step',                    x: 1150, y: 200, w: 170, h: 70, kind: 'op',      sub: 'one new token' },
    { id: 'kv',      label: 'KV cache',                       x: 680,  y: 420, w: 170, h: 70, kind: 'tensor',  sub: 'K, V of every past token' },
    { id: 'stop',    label: 'Stop on EOS\nor max length',     x: 1150, y: 400, w: 170, h: 90, kind: 'concept' },
  ],
  edges: [
    ['prompt', 'prefill'], ['prefill', 'logits'], ['logits', 'sample'], ['sample', 'append'], ['append', 'decode'],
    { from: 'decode', to: 'logits', label: 'loop', arc: -160 },
    ['prefill', 'kv', 'write'], ['decode', 'kv', 'read + write'], ['decode', 'stop'],
  ],
},

/* ------------------------------------------------------------------ */
posttrain: {
  title: 'Post-training',
  nodes: [
    { id: 'base', label: 'Base model',        x: 0,   y: 200, w: 190, h: 70, kind: 'weights', sub: 'next-token predictor' },
    { id: 'sft',  label: 'SFT',               x: 260, y: 200, w: 190, h: 70, kind: 'weights', sub: 'supervised on chat examples' },
    { id: 'rm',   label: 'Reward model',      x: 520, y: 360, w: 190, h: 70, kind: 'weights', sub: 'scores answers' },
    { id: 'rl',   label: 'RLHF / DPO',        x: 520, y: 200, w: 190, h: 70, kind: 'weights', sub: 'preference tuning' },
    { id: 'chat', label: 'Chat model',        x: 780, y: 200, w: 190, h: 70, kind: 'weights' },
  ],
  edges: [['base', 'sft'], ['sft', 'rl'], ['rm', 'rl'], ['rl', 'chat']],
},

};
