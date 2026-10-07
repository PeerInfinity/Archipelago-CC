# [Core] Non-Deterministic `.archipelago` Bytes from the Multidata Sphere Sets

**Status:** Fixed in fork

**Files:** `Main.py` (the `spheres` block of the multidata, inside `main()`)

**Diff:** `docs/json/developer/diffs/diff-files/core-files.diff`

---

## Problem Summary

`Main.main()` builds `multidata["spheres"]` (one `dict[player, set[location id]]` per
sphere) by iterating each sphere that `MultiWorld.get_sendable_spheres()` yields:

```python
for sphere in multiworld.get_sendable_spheres():
    current_sphere: dict[int, set[int]] = collections.defaultdict(set)
    for sphere_location in sphere:
        current_sphere[sphere_location.player].add(sphere_location.address)
```

`sphere` is a `set[Location]`. `Location` defines no `__hash__`, so it hashes by
`id()`, and the set's iteration order follows the objects' memory addresses. Those
addresses change from one process to the next. The ids are then added to an
`int` set. When two ids land in the same slot of that set's hash table, their
relative order is their insertion order, so it changes from run to run. The pickled
`.archipelago` file then differs in those two values.

`PYTHONHASHSEED` does not control this. It covers `str`/`bytes` hashing, not `id()`.
Fixing it still gives both forms.

**Impact:** the same seed produces `.archipelago` files with different bytes on
different runs. They decode to equal data: only the iteration order of a set
differs. The Spoiler, the exported rules and the sphere log are not affected.
Nothing that loads the multidata behaves differently, but anything that compares or
caches the file by its bytes sees spurious changes.

### Measured (2026-10-06, this fork)

- `seedling_playthrough` seed 1: 12 consecutive runs gave two `.archipelago` md5s, 6
  of each. In `multidata["spheres"][5][1]`, ids `30000004` and `30000036` swap. Both
  are 4 mod 32, so they collide in a 32-slot table.
- `PYTHONHASHSEED=0` still produced both forms.
- `seedling` seed 1: 8 runs gave 5 distinct md5s (three order-dependent sets).
- A scan of the committed presets, which rebuilds each sphere set in sorted,
  reversed and shuffled insertion orders, found 104 of 162 committed `.archipelago`
  files prone to this drift, across all worlds.

---

## The Fix

Iterate each sphere in a stable order (one line):

```python
for sphere_location in sorted(sphere, key=lambda loc: (loc.player, loc.address)):
```

`get_sendable_spheres()` only yields locations whose `address` is an `int`, so the
key is always comparable. With the fix, `seedling_playthrough` gave 6/6 identical
runs, equal to the committed file (which the fix therefore does not re-pin), and
`seedling` gave 4/4 identical. Other committed `.archipelago` files settle to the
sorted form the next time their preset is regenerated. Nothing forces that.

Alternatives that were measured and rejected:

- **Re-pickle in the exporter with sorted sets:** a plain unpickle and re-pickle,
  with no other change, already alters 89 of the 162 committed files, so this would
  re-pin far more than it fixes.
- **Pin `PYTHONHASHSEED`:** ineffective, as shown above.

---

## Upstream Status

This bug exists in upstream Archipelago. It has not been reported or fixed upstream.
The one-line change above would make a natural upstream PR.

---

## Shipping

The fix lives in the fork's `Main.py`. The JSON Tools installer does not overlay
core files, so an installed environment keeps upstream's behaviour.
