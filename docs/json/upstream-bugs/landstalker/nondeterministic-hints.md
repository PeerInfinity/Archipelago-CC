# [Landstalker] Non-Deterministic Hint Ordering

**Status:** Fixed in fork

**Files:** `worlds/landstalker/Hints.py`

**Diff:** `docs/json/developer/diffs/diff-files/world-minor-fixes.diff`

---

## Problem Summary

`generate_random_hints()` deduplicated hint texts through a `set` before the
seeded shuffle:

```python
hint_texts = list(set(hint_texts))
random.shuffle(hint_texts)
```

`set` iteration order is non-deterministic across runs, so `list(set(...))`
produces a different starting order each time. The subsequent
`random.shuffle()` is seeded, but it permutes an already-unstable list, so the
same seed yields different hint-to-NPC assignments on different runs.

**Impact:** Hints assigned to Foxy NPCs differ between runs even for the same
seed, breaking reproducibility.

---

## The Fix

Sort after deduplication so the shuffle operates on a stable ordering:

```python
hint_texts = sorted(set(hint_texts))
random.shuffle(hint_texts)
```

---

## Upstream Status

This bug exists in upstream Archipelago. It has not been reported or fixed
upstream.

---

## Shipping

The fork's fixed `worlds/landstalker/Hints.py` is overlaid onto vanilla worlds by
the JSON Tools installer's opt-in `upstream_fixes` component (`--upstream-fixes`).
