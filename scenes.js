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
  tour: [
    { node: null, title: 'The whole system', text: 'Follow the arrows: text → ids → model → scores, then the two loops that use those scores. Orange = learned weights, blue = data, green = fixed math, purple = a process.' },
    { node: 'data', text: 'Trillions of tokens of text. This is the only teacher the model ever has: no labels, no rules — just "what came next".' },
    { node: 'tokenizer', text: 'Chops text into pieces from a fixed vocabulary and outputs integers. Built by counting (BPE), then frozen forever. No neural network here.' },
    { node: 'ids', text: 'Plain integers. From here on the model has no access to letters — "cat" is just 3290.' },
    { node: 'model', text: 'The transformer: embedding table → N identical blocks → LM head. This box holds essentially all the learned weights.' },
    { node: 'logits', text: 'One score per vocabulary entry, for each position: "how likely is each token to come next". Softmax turns these into probabilities.' },
    { node: 'training', text: 'Compare the scores with the token that actually came next, compute a loss, push gradients back, nudge every orange box. Repeat for months on thousands of GPUs.' },
    { node: 'inference', text: 'Pick a token from the scores, append it, run again. Weights never change here — only the text grows.' },
    { node: 'posttrain', text: 'After pretraining: teach the next-token predictor to behave like an assistant. Same architecture, small extra training on curated examples and preferences.' },
  ],
  nodes: [
    { id: 'data',      label: 'Raw text\n(web, books, code)', x: 0,    y: 200, w: 180, h: 80,  kind: 'tensor' },
    { id: 'tokenizer', label: 'Tokenizer',                    x: 240,  y: 200, w: 170, h: 80,  kind: 'op',      child: 'tokenizer', status: 'done' },
    { id: 'ids',       label: 'Token IDs',                    x: 470,  y: 200, w: 170, h: 80,  kind: 'tensor',  sub: '[464, 3290, 3332, …]' },
    { id: 'model',     label: 'Model\n(Transformer)',         x: 700,  y: 180, w: 220, h: 120, kind: 'weights', child: 'model', status: 'done' },
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
  tour: [
    { node: null, title: 'Inside the model', text: 'One tensor — the residual stream, `(T × d_model)` — flows left to right. Every stage *adds* to it. Nothing replaces it.' },
    { node: 'ids', text: 'T integers in. This is where the tokenizer hands over.' },
    { node: 'emb', text: 'Lookup table `E: vocab × d_model`. Row `id` is the token\'s vector. Learned. Double-click to see it as `onehot · E`.' },
    { node: 'pos', text: 'Attention cannot see order, so position is injected: a learned table or sinusoids added here, or RoPE rotations inside attention (in which case this box is empty). Double-click for the three schemes.' },
    { node: 'add', text: '`x_t = E[id_t] + P[t]`. The residual stream is born.' },
    { node: 'blk1', text: 'The first of N identical blocks: attention (mix across tokens) then MLP (per-token computation), each added onto the stream. Double-click any block to go inside — they all have the same structure, only the weights differ.' },
    { node: 'ln', text: 'One last normalisation so the LM head sees a stable scale.' },
    { node: 'head', text: '`logits = x · W_headᵀ`, `d_model → vocab`. Often the same matrix as the embedding (weight tying): predicting token i = dot product with row i of E.' },
    { node: 'logits', text: '`(T × vocab)`. During training all T rows are used; during generation only the last one.' },
  ],
  nodes: [
    { id: 'ids',   label: 'Token IDs',                   x: 0,    y: 200, w: 150, h: 70, kind: 'tensor',  sub: '(T)', status: 'done',
      notes: `Integers, one per position. Nothing else survives from the text. \`T\` = sequence length (context). The model has no idea that 464 was "The" — that meaning has to be learned into row 464 of the embedding table.` },
    { id: 'emb',   label: 'Token embedding',             x: 210,  y: 200, w: 180, h: 70, kind: 'weights', sub: 'lookup: vocab × d_model', child: 'embedding', status: 'done' },
    { id: 'pos',   label: 'Positional info',             x: 210,  y: 330, w: 180, h: 70, kind: 'weights', sub: 'learned, or RoPE inside attention', child: 'positional', status: 'done' },
    { id: 'add',   label: '+',                           x: 440,  y: 210, w: 50,  h: 50, kind: 'op', status: 'done',
      notes: `Plain vector addition, \`x_t = E[id_t] + P[t]\`. Both are \`d_model\` long, so this is a coordinate-wise sum. Why add and not concatenate? Adding keeps \`d_model\` fixed, and the network can learn to keep "what" and "where" in different sub-directions of the same vector. With RoPE this box does nothing.` },
    { id: 'grp',   label: '× N identical blocks, each with its own weights. The residual stream (T × d_model) runs straight through all of them.',
      x: 530, y: 120, w: 610, h: 230, kind: 'group' },
    { id: 'blk1',  label: 'Block 1',                     x: 560,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block', status: 'done' },
    { id: 'blk2',  label: 'Block 2',                     x: 750,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block', status: 'done' },
    { id: 'blkN',  label: 'Block N',                     x: 960,  y: 200, w: 150, h: 70, kind: 'weights', child: 'block', status: 'done' },
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
  tour: [
    { node: null, title: 'id → vector', text: 'The tokenizer gave an integer. Here the model turns it into a vector — by looking up a learned table.' },
    { node: 'id', text: 'One integer. Its only role is to pick a row.' },
    { node: 'onehot', text: 'Mathematically, a vector of length `vocab` with a single 1. Nobody materialises it, but it makes the next step a matmul, and matmuls get gradients.' },
    { node: 'E', text: 'The table: `vocab × d_model` free parameters. Starts as noise. GPT-2: 50257 × 768.' },
    { node: 'mul', text: '`onehot · E` = exactly row `id` of E. Implementations just index: `E[id]`.' },
    { node: 'x', text: 'The token\'s vector, `(d_model)`. Stack T of them → `(T × d_model)`: the residual stream begins.' },
    { node: 'learn', text: 'Gradients from the next-token loss flow back into the rows that were used. Over training, tokens used in similar contexts drift together. Flip the widget to "after training" and compare the similarity grids.' },
  ],
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
  tour: [
    { node: null, title: 'Breaking the symmetry', text: 'Attention treats its input as a *set*. Position has to be injected. Three schemes; every model picks exactly one.' },
    { node: 'why', text: 'Permute the rows going into attention and the outputs permute identically. "dog bites man" = "man bites dog". The MLP is per-token and cannot help.' },
    { node: 'x', text: 'Right after embedding, the same token gives the same vector wherever it sits.' },
    { node: 'learned', text: 'A second table `P: T_max × d_model`, indexed by position. Simple, learned, hard length limit. GPT-2.' },
    { node: 'sin', text: 'Fixed sin/cos at geometrically spaced frequencies — a clock with many hands. No parameters, unbounded length. The original Transformer.' },
    { node: 'add', text: 'For the first two schemes: `x_t + P[t]`, coordinate-wise. Done once, before block 1.' },
    { node: 'out', text: 'Now identical tokens at different positions have different vectors.' },
    { node: 'rope', text: 'RoPE adds nothing here. Instead each attention layer rotates q and k by `position × θ`, so `q_m · k_n` depends only on `m − n`. Relative distance for free; what Llama and most modern models use.' },
    { node: 'attn', text: 'Where RoPE acts: after the Q, K projections, before the dot product. Try the 2-D rotation in the widget — shift m and n together and the dot product does not move.' },
  ],
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
  widget: 'params',
  tour: [
    { node: null, title: 'One block, two halves', text: 'Every block does the same two things in the same order: **attention** (tokens exchange information) then **MLP** (each token thinks on its own). Both are wrapped as `x = x + f(LayerNorm(x))`. Shape in = shape out, so you can stack as many as you like.' },
    { node: 'xin', text: 'The residual stream arriving from the previous block (or from embedding + position for block 1). `T` rows, `d_model` columns. Think of each row as that token\'s running "notebook" — every block will write a little more into it.' },
    { node: 'ln1', text: 'Per token, rescale the vector to mean 0, variance 1, then apply a learned scale γ and shift β. This does not change *what* the token says, only how loud. It keeps the numbers going into attention at a stable scale no matter how much the residual stream has grown.' },
    { node: 'attn', text: 'The only place tokens interact. Each token asks a question (Q), every token advertises what it holds (K), and the answer is a weighted blend of what they offer (V). Output is again `(T × d_model)`. Double-click later to go inside.' },
    { node: 'add1', text: '`x ← x + attention_output`. The dashed arc is the original x bypassing attention entirely. So attention can only *add* to the notebook, never erase it. This is what keeps 80-layer stacks trainable: the gradient has a straight highway back to the input.' },
    { node: 'ln2', text: 'Same normalisation, separate γ, β. Normalise before the MLP sees the stream.' },
    { node: 'mlp', text: 'Two matrices with a nonlinearity between: expand to `4·d_model`, squash, project back. Applied to each token independently — no cross-token mixing here. This is where ~2/3 of all parameters live and where most factual knowledge is stored.' },
    { node: 'add2', text: 'Second residual add. Note the arc starts *after* the first add — the MLP sees the stream *with* attention\'s contribution already in it.' },
    { node: 'xout', text: 'Same shape as x_in, richer content. Off to the next block. After the last block: final LayerNorm → LM head → logits. Use the widget in the notes panel to count the parameters in a block for real model sizes.' },
  ],
  nodes: [
    { id: 'xin',  label: 'x_in',                  x: 0,    y: 200, w: 120, h: 70,  kind: 'tensor',  sub: '(T × d_model)', status: 'done',
      notes: `The residual stream. \`T\` rows (tokens) × \`d_model\` columns. Every block receives and returns exactly this shape — that is the whole reason blocks can be stacked without thinking about it.` },
    { id: 'ln1',  label: 'LayerNorm',             x: 190,  y: 200, w: 140, h: 70,  kind: 'weights', sub: 'γ, β · 2·d_model params', status: 'done',
      notes: `
Applied to **each token's vector separately**, across its \`d_model\` entries:

\`\`\`
μ  = mean(x)                 one number per token
σ² = var(x)
y  = (x − μ) / √(σ² + ε) · γ + β
\`\`\`

\`γ, β\` are learned vectors of length \`d_model\` (so 2·d_model parameters — tiny). \`ε\` ≈ 1e-5 just avoids divide-by-zero.

**RMSNorm** (Llama and most modern models) drops the mean: \`y = x / √(mean(x²) + ε) · γ\`. Cheaper, works as well.

**Why:** the residual stream grows as blocks keep adding to it. Without normalisation, block 40 would see vectors 40× larger than block 1 and its weights could never be tuned for both. Pre-norm (normalise *before* the sub-layer, as drawn) is what everyone uses now.` },
    { id: 'attn', label: 'Multi-head\nattention', x: 390,  y: 180, w: 200, h: 110, kind: 'weights', sub: '4·d_model² params', child: 'attention', status: 'done',
      notes: `
Reads all \`T\` rows, lets every token gather information from earlier tokens, writes \`T\` rows back. The only cross-token operation in the whole model.

\`\`\`
Attn(X) = concat_h( softmax( Q_h K_hᵀ / √d_head + mask ) V_h ) · W_O
\`\`\`

Parameters: \`W_Q, W_K, W_V, W_O\`, each \`d_model × d_model\` → **4·d_model²**. Double-click to walk the math.` },
    { id: 'add1', label: '+',                     x: 650,  y: 210, w: 50,  h: 50,  kind: 'op', status: 'done',
      notes: `
\`x ← x + Attn(LN(x))\`

Element-wise add of two \`(T × d_model)\` tensors. The dashed arc is the "skip": the *un-normalised* x goes straight through. Consequences:

- a block only learns a **correction**, not a whole new representation;
- if a block is useless, it can learn to add ≈ 0 and do no harm;
- gradients flow back along the arc unchanged, so early layers still get a clean signal 80 layers deep.` },
    { id: 'ln2',  label: 'LayerNorm',             x: 770,  y: 200, w: 140, h: 70,  kind: 'weights', sub: 'separate γ, β', status: 'done',
      notes: `Same operation as the first LayerNorm with its own \`γ, β\`. Normalises the stream (now including attention's contribution) before the MLP.` },
    { id: 'mlp',  label: 'MLP\n(feed-forward)',   x: 970,  y: 180, w: 200, h: 110, kind: 'weights', sub: '8·d_model² params', child: 'mlp', status: 'done',
      notes: `
\`MLP(x) = act(x · W_up) · W_down\`, with \`W_up: d_model × 4·d_model\`, \`W_down: 4·d_model × d_model\`.

Applied to each of the \`T\` rows independently — no mixing across tokens. **8·d_model²** parameters, twice attention's. Double-click to see why the nonlinearity is essential.` },
    { id: 'add2', label: '+',                     x: 1230, y: 210, w: 50,  h: 50,  kind: 'op', status: 'done',
      notes: `\`x ← x + MLP(LN(x))\`. The arc starts after the first add, so the MLP's input already contains what attention gathered.` },
    { id: 'xout', label: 'x_out',                 x: 1350, y: 200, w: 120, h: 70,  kind: 'tensor',  sub: '(T × d_model)', status: 'done',
      notes: `Same shape as \`x_in\`. Goes straight into the next block's \`x_in\`. Nothing is reset between blocks — it is literally the same tensor with two things added to it.` },
  ],
  edges: [
    ['xin', 'ln1'], ['ln1', 'attn'], ['attn', 'add1'], ['add1', 'ln2'], ['ln2', 'mlp'], ['mlp', 'add2'], ['add2', 'xout'],
    { from: 'xin',  to: 'add1', label: 'residual (skip)', arc: -150 },
    { from: 'add1', to: 'add2', label: 'residual (skip)', arc: -150 },
  ],
  notes: `
# One block

\`\`\`
x = x + Attn( LN₁(x) )      tokens talk to each other
x = x + MLP ( LN₂(x) )      each token thinks alone
\`\`\`

That is the entire block. Two sub-layers, each wrapped the same way: **normalise → do something → add it back**.

## Division of labour

- **Attention** = *routing*. Moves information between positions. Few parameters (4·d²).
- **MLP** = *storage / computation*. Per-token. Most parameters (8·d²).

A useful picture: attention decides *which* earlier tokens matter for this one and copies their content over; the MLP then looks at what's been gathered and adds conclusions.

## Why the residual stream matters

Because every sub-layer is \`x + f(x)\`, the stream is a shared bus that all 12–80 blocks read from and write to. Early blocks write simple features (is-this-a-verb), later blocks write abstract ones (this-sentence-is-a-question). Nothing is ever overwritten, so a late block can still read what an early one wrote.

## Parameters per block

\`\`\`
attention   4 · d²          (W_Q, W_K, W_V, W_O)
MLP         8 · d²          (W_up d×4d, W_down 4d×d)
LayerNorm   4 · d           (2 norms × γ, β)
≈ 12 · d²   per block
\`\`\`

Whole model ≈ \`12 · d² · N + vocab · d\`. GPT-2 small: 12 · 768² · 12 ≈ 85M + 50257 · 768 ≈ 39M → 124M. Try the calculator below.
`
},

/* ------------------------------------------------------------------ */
attention: {
  title: 'Attention',
  widget: 'attention',
  tour: [
    { node: null, title: 'The idea in one sentence', text: 'Each token produces a **query** ("what am I looking for?"), a **key** ("what do I contain?") and a **value** ("what do I give if chosen?"). Every query is compared with every key; the matches decide how much of each value gets mixed into the output.' },
    { node: 'x', text: 'Input after LayerNorm, `(T × d_model)`. Every arrow leaving this box is the *same* matrix going into three different projections.' },
    { node: 'wq', text: '`Q = X·W_Q` → `(T × d_head)`. Row *i* is what token *i* is looking for. In practice one big `d_model × d_model` matrix produces all heads at once and is reshaped into `h` slices of width `d_head`.' },
    { node: 'wk', text: '`K = X·W_K` → `(T × d_head)`. Row *j* is how token *j* advertises itself to others. Q and K live in the same space so that `q·k` is meaningful.' },
    { node: 'wv', text: '`V = X·W_V` → `(T × d_head)`. What token *j* hands over if it is attended to. Note V goes *around* the scoring — it never affects who attends to whom, only what is delivered.' },
    { node: 'scores', text: '`S = Q·Kᵀ / √d_head` → `(T × T)`. Entry `S[i,j]` = how well query *i* matches key *j*. The `√d_head` is not optional: a dot product of `d_head` unit-variance terms has variance `d_head`, so without it scores for `d_head = 128` would be ±11 and softmax would collapse to a hard argmax with vanishing gradients.' },
    { node: 'mask', text: 'Set `S[i,j] = −∞` for every `j > i`. Token 3 may look at tokens 0–3, never 4+. After softmax those cells become exactly 0. This single line is what makes the model a *next-token* predictor and lets one forward pass train all T positions simultaneously.' },
    { node: 'softmax', text: 'Row-wise: `A[i,j] = exp(S[i,j]) / Σ_k exp(S[i,k])`. Each row now sums to 1 — a probability distribution over "which earlier token do I read from". Toggle the mask in the widget and watch the upper triangle go to 0.' },
    { node: 'wsum', text: '`O = A·V` → `(T × d_head)`. Row *i* of the output is a weighted average of the V rows, using row *i* of A as weights. This is the actual information transfer: token *i*\'s output is built from *other* tokens\' content.' },
    { node: 'concat', text: 'All `h` heads ran the same steps in parallel with different W_Q, W_K, W_V. Concatenate their outputs side by side: `(T × h·d_head)` = `(T × d_model)` since `h·d_head = d_model` by design (GPT-2: 12 × 64 = 768).' },
    { node: 'wo', text: '`out = concat · W_O`, `W_O: d_model × d_model`. Lets heads combine — head 3\'s output can be scaled or rotated before it is added to the stream. Fourth and last weight matrix of attention.' },
    { node: 'out', text: '`(T × d_model)`, back to the block to be added onto the residual stream. Total attention parameters: `4·d_model²`. Total compute: dominated by `Q·Kᵀ`, which is `T² · d` — the reason long contexts are expensive.' },
  ],
  nodes: [
    { id: 'x',       label: 'x',                     x: 0,    y: 260, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)', status: 'done',
      notes: `The LayerNorm'd residual stream. Each of the three projections below multiplies this *same* matrix by a different learned matrix.` },
    { id: 'grp',     label: 'one head — this whole path is repeated h times in parallel with different W_Q, W_K, W_V',
      x: 200, y: 50, w: 1100, h: 500, kind: 'group' },
    { id: 'wq',      label: 'W_Q',                   x: 240,  y: 100, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head', status: 'done',
      notes: `
\`Q = X · W_Q\` &nbsp; \`(T × d_model)·(d_model × d_head) → (T × d_head)\`

The **query**: what each token is looking for. Implementation detail: one \`d_model × d_model\` matrix produces all \`h\` heads at once; the result is reshaped to \`(h, T, d_head)\`.` },
    { id: 'wk',      label: 'W_K',                   x: 240,  y: 260, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head', status: 'done',
      notes: `
\`K = X · W_K\` → \`(T × d_head)\`

The **key**: what each token advertises. Q and K are projected into the *same* \`d_head\`-dimensional space so that a dot product between them measures compatibility.

With RoPE, both Q and K are rotated by position right here, before scoring.

Modern models (Llama-3, Mistral) use **GQA**: several query heads share one K/V head, shrinking the KV cache at inference.` },
    { id: 'wv',      label: 'W_V',                   x: 240,  y: 420, w: 140, h: 70, kind: 'weights', sub: 'd_model → d_head', status: 'done',
      notes: `
\`V = X · W_V\` → \`(T × d_head)\`

The **value**: the content a token delivers when attended to. V takes no part in deciding *who* attends to *whom* — it only supplies what gets copied.` },
    { id: 'scores',  label: 'scores = Q·Kᵀ / √d',    x: 450,  y: 180, w: 200, h: 70, kind: 'op',      sub: '(T × T)', status: 'done',
      notes: `
\`S = Q · Kᵀ / √d_head\` &nbsp; \`(T × d_head)·(d_head × T) → (T × T)\`

\`S[i, j]\` = similarity of query *i* to key *j*. One number for every (token, token) pair — this \`T²\` is where the cost of long context comes from.

**Why √d_head:** if the entries of q and k have variance 1, then \`q·k = Σ q_i k_i\` over \`d_head\` terms has variance \`d_head\`. For \`d_head = 64\` scores would have std ≈ 8; softmax of numbers that spread apart is nearly one-hot, and its gradient is nearly zero. Dividing by \`√d_head\` restores variance 1.` },
    { id: 'mask',    label: 'causal mask',           x: 710,  y: 180, w: 150, h: 70, kind: 'op',      sub: 'future → −∞', status: 'done',
      notes: `
\`S[i, j] ← −∞  for all j > i\`

Upper triangle removed. \`exp(−∞) = 0\`, so after softmax a token puts exactly zero weight on anything after it.

Why it matters beyond "no cheating": with the mask, position *i*'s output depends only on tokens ≤ *i*, so one forward pass over a \`T\`-token text gives \`T\` independent next-token predictions to train on. Without it we could only train on the last position.

Encoder models like BERT skip this mask — they see both directions and are not generators.` },
    { id: 'softmax', label: 'softmax\n(per row)',    x: 920,  y: 180, w: 150, h: 70, kind: 'op', status: 'done',
      notes: `
\`A[i, j] = exp(S[i, j]) / Σ_k exp(S[i, k])\`

Applied to each row independently. Row *i* becomes a probability distribution over which earlier tokens *i* reads from. Sharp peaks = "copy from one token"; flat = "average many".

No parameters. This is also the step that makes attention *soft* (differentiable) instead of a hard lookup.` },
    { id: 'wsum',    label: 'weights · V',           x: 1100, y: 340, w: 170, h: 70, kind: 'op',      sub: '(T × d_head)', status: 'done',
      notes: `
\`O = A · V\` &nbsp; \`(T × T)·(T × d_head) → (T × d_head)\`

Row *i*: \`O[i] = Σ_j A[i, j] · V[j]\` — a weighted average of value vectors. This is the moment information moves between positions. Everything before was deciding the weights.` },
    { id: 'concat',  label: 'concat heads',          x: 1360, y: 260, w: 160, h: 70, kind: 'op',      sub: '(T × h·d_head)', status: 'done',
      notes: `
Stack the \`h\` head outputs side by side: \`(T × h·d_head)\`. By convention \`h · d_head = d_model\` — GPT-2 small: 12 heads × 64 = 768.

Why several small heads instead of one big one? Each head has its own Q/K space and can specialise: one tracks "previous token", one "matching open bracket", one "the subject of this verb". A single head would have to average those.` },
    { id: 'wo',      label: 'W_O',                   x: 1580, y: 260, w: 140, h: 70, kind: 'weights', sub: 'h·d_head → d_model', status: 'done',
      notes: `
\`out = concat · W_O\` &nbsp; \`W_O: d_model × d_model\`

Mixes the heads. Without it each head could only write into its own slice of the residual stream; \`W_O\` lets head 3's finding be written anywhere.

Parameter count for the whole attention sub-layer: \`W_Q, W_K, W_V, W_O\` = **4 · d_model²** (plus small biases in older models).` },
    { id: 'out',     label: 'out',                   x: 1780, y: 260, w: 120, h: 70, kind: 'tensor',  sub: '(T × d_model)', status: 'done',
      notes: `Same shape as the input. Goes back to the block to be added to the residual stream: \`x ← x + out\`.` },
  ],
  edges: [
    ['x', 'wq'], ['x', 'wk'], ['x', 'wv'],
    ['wq', 'scores', 'Q'], ['wk', 'scores', 'K'],
    ['scores', 'mask'], ['mask', 'softmax'], ['softmax', 'wsum'], ['wv', 'wsum', 'V'],
    ['wsum', 'concat'], ['concat', 'wo'], ['wo', 'out'],
  ],
  notes: `
# Attention

\`\`\`
Q = X W_Q      K = X W_K      V = X W_V              (T × d_head) each
S = Q Kᵀ / √d_head                                   (T × T)
S[i, j] = −∞   for j > i                              causal mask
A = softmax_rows(S)                                   rows sum to 1
O = A V                                               (T × d_head)
out = concat(O₁ … O_h) · W_O                          (T × d_model)
\`\`\`

## Reading it as a story

Every token builds three vectors from its own residual-stream vector:

- **Q (query)** — "what am I looking for?"
- **K (key)** — "what do I contain, for others to match against?"
- **V (value)** — "what do I hand over if someone attends to me?"

For each token (row) compare its Q with *every* token's K. High dot product = strong match. Softmax turns the matches into weights; the output is the weighted blend of V's.

## The four non-obvious details

1. **√d_head** keeps scores at variance ≈ 1 so softmax stays soft and trainable.
2. **Causal mask** makes position *i* depend only on ≤ *i*, which is what turns one text into T training examples.
3. **Heads** are independent Q/K/V spaces run in parallel and concatenated; \`h · d_head = d_model\`.
4. **W_O** mixes the heads back into the shared stream.

## What has weights, what doesn't

Only \`W_Q, W_K, W_V, W_O\` — **4·d_model²**. Scores, mask, softmax, the weighted sum are fixed arithmetic. Attention is the *routing*; the MLP is the *storage*.

## Cost

\`Q Kᵀ\` is \`T² · d\`. Double the context → 4× the attention compute and a \`T × T\` matrix per head per layer. This is why KV caching, GQA and FlashAttention exist.

The widget below is a real head on six tokens with random weights. Untick the mask and watch the upper triangle light up.
`
},

/* ------------------------------------------------------------------ */
mlp: {
  title: 'MLP',
  tour: [
    { node: null, title: 'Per-token computation', text: 'Two matrix multiplies with a nonlinearity between them, applied to **each token on its own**. Nothing crosses positions here. Boring-looking, but it holds most of the parameters and most of the knowledge.' },
    { node: 'x', text: 'One row of the (normalised) residual stream at a time — the same function is applied to all T rows independently, so you can think of it as a per-token operation.' },
    { node: 'up', text: '`H = x·W_up`, expanding `d_model → 4·d_model`. Each of the 4·d_model output units is a **detector**: a direction in residual space it responds to. GPT-2 small: 768 → 3072.' },
    { node: 'act', text: 'GELU or SiLU: roughly `max(0, x)` with a smooth corner. Detectors that did not fire are zeroed. **This is why the MLP is not just one big matrix** — without a nonlinearity, `W_up·W_down` would collapse into a single `d×d` matrix and the 4× expansion would buy nothing.' },
    { node: 'down', text: '`out = act(H)·W_down`, back to `d_model`. Each row of W_down is what to *write into the stream* when the corresponding detector fires. Detector "this is the capital of France" fires → write the "Paris" direction.' },
    { node: 'out', text: '`(d_model)` per token, added to the residual stream by the block. Parameters: `2 · d · 4d = 8·d²` — twice attention. Llama-style SwiGLU uses three matrices (`gate`, `up`, `down`) with a smaller hidden size; same story.' },
  ],
  nodes: [
    { id: 'x',    label: 'x',            x: 0,   y: 200, w: 120, h: 70, kind: 'tensor',  sub: '(d_model) per token', status: 'done',
      notes: `The normalised residual stream. Although the tensor is \`(T × d_model)\`, every row goes through the MLP separately — position *i* never sees position *j* here.` },
    { id: 'up',   label: 'W_up',         x: 200, y: 200, w: 170, h: 70, kind: 'weights', sub: 'd_model → 4·d_model', status: 'done',
      notes: `
\`H = x · W_up\` &nbsp; \`(d_model) → (4·d_model)\`

Each output unit computes a dot product with one row of \`W_up\`: "how much does this token point in *my* direction?" 4·d_model such detectors. GPT-2 small: 3072 of them per layer.` },
    { id: 'act',  label: 'GELU / SiLU',  x: 440, y: 200, w: 150, h: 70, kind: 'op',      sub: 'elementwise', status: 'done',
      notes: `
\`GELU(h) = h · Φ(h)\` (Φ = normal CDF) — smooth ReLU. \`SiLU(h) = h · σ(h)\` — similar, used by Llama.

Both ≈ 0 for negative input, ≈ identity for positive. So a detector that scored below zero contributes nothing.

**Why it's essential:** two linear maps in a row are one linear map: \`x W_up W_down = x (W_up W_down)\`, a single \`d × d\` matrix. The nonlinearity is what makes 4× width meaningful and lets the MLP implement "if this pattern then write that".` },
    { id: 'down', label: 'W_down',       x: 630, y: 200, w: 170, h: 70, kind: 'weights', sub: '4·d_model → d_model', status: 'done',
      notes: `
\`out = act(H) · W_down\` &nbsp; \`(4·d_model) → (d_model)\`

Row *k* of \`W_down\` is the vector written into the residual stream when detector *k* fires, scaled by how strongly it fired. Interpretability work finds many of these are readable: a detector for "text about basketball", a row that boosts "NBA", "dunk", ….` },
    { id: 'out',  label: 'out',          x: 860, y: 200, w: 120, h: 70, kind: 'tensor',  sub: '(d_model) per token', status: 'done',
      notes: `Back to \`d_model\`, added onto the stream by the block. **8·d_model²** parameters for the two matrices; roughly 2/3 of the whole model.` },
  ],
  edges: [['x', 'up'], ['up', 'act'], ['act', 'down'], ['down', 'out']],
  notes: `
# MLP (feed-forward)

\`\`\`
MLP(x) = act( x · W_up ) · W_down
W_up   : d_model × 4·d_model
W_down : 4·d_model × d_model
\`\`\`

The simplest part and the biggest: expand each token's vector 4×, apply a nonlinearity, squeeze it back.

## Facts

- Applied to **each token independently** — no mixing across positions. Same two matrices for every position.
- **8·d_model²** parameters — about 2/3 of a standard transformer.
- Without the nonlinearity the two matrices would collapse into one \`d × d\` matrix; the expansion would be pointless.

## Mental model: key–value memory

\`W_up\` rows are *keys* (patterns to detect in the stream), \`W_down\` rows are *values* (what to add when a pattern is found). Activation gates them. That's why factual recall — "Eiffel Tower is in …" → "Paris" — tends to live in MLP layers, and why "knowledge editing" research targets \`W_down\`.

## Modern variant

Llama, Mistral, Qwen use **SwiGLU**: \`(SiLU(x W_gate) ⊙ x W_up) W_down\`, three matrices with hidden size ≈ 2.7·d instead of 4·d so the parameter count stays similar. Same shape story, slightly better loss.
`
},

/* ------------------------------------------------------------------ */
tokenizer: {
  title: 'Tokenizer',
  tour: [
    { node: null, title: 'Text → integers', text: 'Not a dictionary lookup — a pipeline: split, bytes, learned merges, *then* lookup. Follow the arrows.' },
    { node: 'text', text: 'Any text, any language. The tokenizer must never fail on input.' },
    { node: 'pre', text: 'A fixed regex cuts text into chunks: runs of letters, digits, punctuation — with the **leading space attached**. Merges will never cross a chunk boundary.' },
    { node: 'special', text: 'A few tokens that mean structure, not text: end-of-document, chat role markers. Matched literally by the pre-tokeniser, added to the vocab by hand.' },
    { node: 'bytes', text: 'Each chunk → its UTF-8 bytes. 256 base tokens exist before any learning. Anything is representable, so there is no `<unk>`.' },
    { node: 'merges', text: 'The learned part: an ordered list of "these two adjacent pieces become one". Apply from rank 1 upward until nothing matches. Same rules, same order, every time. Double-click to see how the list is built.' },
    { node: 'vocab', text: 'The dictionary — 256 bytes + one entry per merge + specials. It is a *by-product* of learning the merges, and it is only used at the very last step.' },
    { node: 'ids', text: 'Each final piece swapped for its integer. Done — the model never sees letters. Try the encoder in the notes panel.' },
  ],
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
  tour: [
    { node: null, title: 'Building the vocabulary', text: 'One loop, no gradients: count adjacent pairs, merge the most frequent, repeat until the vocabulary is the size you asked for.' },
    { node: 'corpus', text: 'A sample of the same text the LLM will train on. Whatever is frequent here gets short tokens.' },
    { node: 'split', text: 'Same pre-tokeniser as at runtime. Every chunk starts as single bytes; identical chunks are counted once with a frequency.' },
    { node: 'count', text: 'For every chunk, every neighbouring pair of current symbols, add the chunk\'s frequency to that pair\'s count.' },
    { node: 'pick', text: 'Take the pair with the highest count. Greedy — no lookahead, no meaning.' },
    { node: 'merge', text: 'Replace that pair with a new single symbol everywhere. Append the rule to the merge list; its position is its rank.' },
    { node: 'add', text: 'The new symbol gets the next free id. Vocab and merge list grow together, one per iteration.' },
    { node: 'stop', text: 'Stop when the vocab hits the chosen size (32k–200k). Step through the trainer in the notes panel and watch words collapse into pieces.' },
  ],
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
