# Learning Pages — Three Views of LLM Internals

You now have **three separate pages**, each optimized for different learning modes:

---

## 1. **Canvas** (`index.html`)
**For**: Interactive exploration, visual understanding, step-by-step walkthroughs

- **Interactive SVG canvas** with pan/zoom
- **Drill-down scenes** from whole picture → model → embedding/positional/block → attention/MLP
- **Guided tours** (77 steps across scenes, keyboard navigation)
- **Side panel tabs**:
  - **Notes**: technical details, formulas, quick reference
  - **Story**: full narrative with simple English + analogy + math (short version)
  - **Map**: tree of all scenes, progress tracker
  - **Log**: session history of what we discussed

**When to use**: You want to *see* the architecture visually, click around, follow step-by-step tours, understand how pieces fit together.

---

## 2. **Stories** (`stories.html`)
**For**: Deep, uninterrupted reading of full explanations

- **Full-page layouts** with complete narratives
- **No side constraints** — full width for comfortable reading
- **Three stories currently**:
  - Token Embedding
  - Positional Encoding (3 schemes: learned, sinusoidal, RoPE)
  - Residual Streams

Each story follows the format: **Simple English → Analogy → Math**

- Simple English: what, why, the core insight
- Analogy: a concrete real-world comparison
- Math: formulas, examples, intuition for equations

**Table of contents** at the top for quick jumping.

**When to use**: You want to sit down and *read* a complete explanation without interruptions. Perfect for study sessions.

---

## 3. **Q&A** (`qa.html`)
**For**: Correcting misconceptions, reviewing key definitions, referencing questions

- **Misconceptions corrected**: things that seemed intuitive but were wrong
  - "Is tokenizer a dictionary?" → No, it's learned compression
  - "Does tokenizer output vectors?" → No, just IDs
  - "Is position optional?" → No, critical

- **Clarifications**: definitions and explanations of tricky concepts
  - What "frozen" means
  - Why residual stream is (T, d_model) not (d_model,)
  - How skip connections prevent vanishing gradients
  - What LayerNorm does
  - Multi-head attention mechanics

- **Definitions**: 
  - Tensor vs. weight
  - LayerNorm purpose
  - Attention heads

- **Questions asked during learning**: practical questions with answers
  - Can two tokens have the same embedding?
  - Why sqrt(d_head)?
  - Why is MLP 8d² vs Attention 4d²?
  - Why nonlinearity in MLP?

**Color-coded**:
- 🔴 Red = Misconceptions (❌ thing I was wrong about)
- 🟢 Green = Clarifications (✓ key concept)
- 🔵 Blue = Definitions (ℹ️ what it means)

**When to use**: You want to *reference* something you're unsure about, look up a correction you made, or review misconceptions before moving on.

---

## How They Connect

```
START HERE
    ↓
index.html (Canvas)
    ├─→ Explore visually with tours
    ├─→ Click a concept → Notes tab for quick ref
    ├─→ Click Story tab for narrative version
    └─→ Click links in header:
        ├─→ stories.html (full-page study)
        └─→ qa.html (reference & corrections)

stories.html (Stories)
    ├─→ Read complete narratives
    ├─→ Use table of contents to jump
    └─→ Links back to canvas and Q&A

qa.html (Q&A)
    ├─→ Find misconceptions you had
    ├─→ Review key definitions
    ├─→ Look up answers to questions
    └─→ Links back to canvas and stories
```

---

## Navigation Tips

- **All three pages have navigation links in the header** (📖 Stories, ❓ Q&A, ↩ Canvas)
- **Stories and Q&A have table of contents** for quick jumping to sections
- **Canvas has deep links**: `index.html#model/embedding` goes to embedding scene directly
- **All files are local** — no server needed. Open `index.html` in a browser and click around.

---

## Next: What to Add

As we discuss more topics, I'll add:

**Stories:**
- LayerNorm (what it does, why before not after)
- Attention (Q, K, V projections, softmax, causal mask, multi-head)
- MLP (4x expansion, nonlinearity, parameter breakdown)
- Training loop (forward pass, loss, backward pass, parameter updates)
- Inference loop (autoregressive generation, sampling, temperature)
- Post-training (RLHF, instruction tuning)

**Q&A:**
- New misconceptions as they arise
- New clarifications as we dig deeper
- Questions you ask in chat

The three-page system grows with your learning. 📚

---

## Preferences

You asked for:
- ✅ Full-page stories (not just side panels)
- ✅ Separate page for Q&A and misconceptions
- ✅ Place to review everything offline
- ✅ Easy navigation between Canvas, Stories, and Q&A

This is that system. Let me know if you want adjustments!
