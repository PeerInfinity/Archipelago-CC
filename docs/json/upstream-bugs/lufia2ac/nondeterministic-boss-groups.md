# [Lufia II AC] Non-Deterministic Boss Random-Group Ordering

**Status:** Fixed in fork

**Files:** `worlds/lufia2ac/Options.py`

**Diff:** `docs/json/developer/diffs/diff-files/world-minor-fixes.diff`

---

## Problem Summary

`Boss.extra_options` was built from a `set`:

```python
extra_options = set(random_groups)
```

`AssembleCustomizableChoices.__new__` later calls `enumerate()` over these
options to assign each random-group name an integer key. Because `set` iteration
order is non-deterministic across runs (hash randomization), the `boss` option's
`name_lookup` maps different integers to different group names on each run.

**Impact:** The exported JSON for the `boss` option is non-deterministic — the
same seed/config can produce different option encodings between runs, breaking
reproducibility of exported rules.

---

## The Fix

Use a `list` so ordering is stable:

```python
extra_options = list(random_groups)
```

`random_groups` is a dict, whose insertion order is deterministic, so
`enumerate()` assigns stable keys.

---

## Upstream Status

This bug exists in upstream Archipelago. It has not been reported or fixed
upstream.

---

## Shipping

The fork's fixed `worlds/lufia2ac/Options.py` is overlaid onto vanilla worlds by
the JSON Tools installer's opt-in `upstream_fixes` component (`--upstream-fixes`).
