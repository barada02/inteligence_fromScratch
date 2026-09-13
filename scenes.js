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
    { id: 'tokenizer', label: 'Tokenizer',                    x: 240,  y: 200, w: 170, h: 80,  kind: 'op',      child: 'tokenizer' },
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
    { id: 'ids',   label: 'Token IDs',                   x: 0,    y: 200, w: 150, h: 70, kind: 'tensor',  sub: '(T)' },
    { id: 'emb',   label: 'Token embedding',             x: 210,  y: 200, w: 180, h: 70, kind: 'weights', sub: 'lookup: vocab × d_model' },
    { id: 'pos',   label: 'Positional info',             x: 210,  y: 330, w: 180, h: 70, kind: 'weights', sub: 'learned, or RoPE inside attention' },
    { id: 'add',   label: '+',                           x: 440,  y: 210, w: 50,  h: 50, kind: 'op' },
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
  nodes: [
    { id: 'text',  label: '"The cat sat"',              x: 0,    y: 200, w: 170, h: 70, kind: 'tensor' },
    { id: 'norm',  label: 'Normalise',                  x: 230,  y: 200, w: 150, h: 70, kind: 'op',      sub: 'unicode, whitespace' },
    { id: 'pre',   label: 'Pre-tokenise',               x: 440,  y: 200, w: 170, h: 70, kind: 'op',      sub: 'split on spaces / punct' },
    { id: 'bpe',   label: 'BPE merges',                 x: 670,  y: 200, w: 170, h: 70, kind: 'weights', sub: 'learned merge table' },
    { id: 'vocab', label: 'Vocabulary',                 x: 670,  y: 340, w: 170, h: 70, kind: 'weights', sub: '32k – 200k entries' },
    { id: 'ids',   label: '[464, 3290, 3332]',           x: 900,  y: 200, w: 180, h: 70, kind: 'tensor' },
  ],
  edges: [['text', 'norm'], ['norm', 'pre'], ['pre', 'bpe'], ['vocab', 'bpe'], ['bpe', 'ids']],
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
