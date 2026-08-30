# [shapez] UT Regeneration Forces early_balancer_tunnel_and_trash to 0

**Status:** Fixed in fork

**Files:** `worlds/shapez/__init__.py`

**Diff:** `docs/json/developer/diffs/diff-files/world-minor-fixes.diff`

---

## Problem Summary

When Universal Tracker regenerates a shapez world from slot data, the world's
`generate_early()` unconditionally forced the player's
`early_balancer_tunnel_and_trash` option to `0`:

```python
# Forces balancers, tunnel, and trash to not appear in regen to make UT more accurate
self.options.early_balancer_tunnel_and_trash.value = 0
```

The comment claims this makes UT *more* accurate, but it does the opposite. The
option controls whether balancer/tunnel/trash requirements are attached to
region transitions (the `includeuseful` flag). Forcing it to `0` during UT
regeneration **removes** those requirements, so UT's region-connection logic
becomes *more permissive than the server* whenever the player's YAML set the
option to `3_buildings` or `5_buildings`.

**Impact:** UT marks regions/locations reachable that the server's logic does
not, producing UT-vs-server mismatches in worldgen tracking (and UT-fuzz
failures) for affected seeds.

---

## The Fix

Preserve the option from the player's YAML instead of zeroing it, so the
regenerated world's region rules match the original generation:

```python
# Preserve the early_balancer_tunnel_and_trash option from the player's YAML
# so that region connection rules (includeuseful flag) match the original
# generation.
return
```

---

## Detection

Same family as the [ALttP bunny rules](../alttp/bunny-rules.md) and
[Satisfactory belt speed](../satisfactory/belt-speed-dead-code.md) issues: a
discrepancy between the server's authoritative logic and an independent
recomputation, surfaced by the Worldgen Universal Tracker fuzz test.

---

## Upstream Status

This bug exists in upstream Archipelago. It has not been reported or fixed
upstream.

---

## Shipping

The fork's fixed `worlds/shapez/__init__.py` is overlaid onto vanilla worlds by
the JSON Tools installer's opt-in `upstream_fixes` component (`--upstream-fixes`).
