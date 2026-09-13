/* Session log. Newest first. Box-level progress lives on `status` in scenes.js. */
const LOG = {
  sessions: [
    {
      date: '2026-09-13',
      title: 'Session 4 — guided tours + transformer block',
      points: [
        'Added "Walk me through" tour mode: every scene now has an ordered box-by-box walkthrough with a card, ← → keys, dimming of everything except the current box.',
        'Transformer block: x = x + Attn(LN(x)); x = x + MLP(LN(x)). LayerNorm formula and why (stable scale across 80 layers). Residual = shared bus, blocks only add.',
        'Attention math end to end: Q K V projections, S = QKᵀ/√d (why √d: variance), causal mask (−∞ → 0, gives T training examples per pass), row softmax, A·V, concat heads (h·d_head = d_model), W_O. 4·d² params, T²·d compute.',
        'MLP: act(x·W_up)·W_down, 4× expansion, nonlinearity is what stops the two matrices collapsing into one. 8·d² params, ~2/3 of the model. Key-value-memory picture.',
        'Parameter calculator widget on the block scene: 12·d²·N + vocab·d reproduces GPT-2 small = 124M.',
        'All Model / Block / Attention / MLP boxes marked discussed.',
      ],
    },
    {
      date: '2026-09-13',
      title: 'Session 3 — embedding and position',
      points: [
        'Correction: the tokenizer outputs an id only. The vector is made by the model: x = E[id] (≡ onehot · E), E is learned (vocab × d_model).',
        'E starts random; similarity structure (cat ≈ dog) emerges as a side-effect of next-token loss, not by design.',
        'Position: attention is permutation-equivariant, so position must be injected. Learned table (GPT-2) or sinusoidal are added once before block 1; RoPE adds nothing and rotates q,k inside every attention layer so scores depend on m − n.',
        'Added Embedding and Positional scenes under Model with widgets: lookup + random-vs-trained similarity grid; sinusoidal heatmap + RoPE rotation demo.',
      ],
    },
    {
      date: '2026-09-13',
      title: 'Session 2 — tokenizer',
      points: [
        'Question: is the tokenizer a word → number dictionary? Answer: the dictionary exists but is the *output*; the real work is pre-tokenise → bytes → apply learned merges in rank order → lookup.',
        'Key corrections: pieces not words; leading space is part of the token ("The" / " The" / "the" differ); byte base vocab means nothing is unknown.',
        'Added the BPE training sub-scene (count pairs → merge most frequent → add to vocab → repeat) with a step-through trainer widget and a live encoder widget.',
        'Tokenizer is frozen before the model trains; changing it means retraining the embedding table.',
        'Tokenizer + BPE boxes marked discussed. Say "revisit X" for anything that did not land.',
      ],
    },
    {
      date: '2026-09-13',
      title: 'Session 1 — set up the canvas',
      points: [
        'Decided: local HTML/JS canvas with drill-down zoom instead of markdown diagrams (md diagrams are not zoomable).',
        'Built the map: Whole picture → Model → Block → Attention / MLP, plus Tokenizer, Training, Inference, Post-training scenes.',
        'Wrote first-pass notes for the Model → Block → Attention → MLP path. Everything else is placeholder.',
        'Nothing discussed in depth yet — all boxes are still "not yet".',
        'Open questions you raised: training vs inference, what "frozen" means.',
      ],
    },
  ],
};
