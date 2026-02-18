# Preset Directory Naming System

This document explains how preset directories are named under `frontend/presets/`, why some
directories have suffixes like `_c` or `_vc`, and how code should resolve the correct directory
when reading or writing preset files.

---

## Overview

When a seed is generated and exported, the exporter creates a subdirectory under
`frontend/presets/<game>/` to hold the output files (`.archipelago`, `_rules.json`,
`_sphere_log.jsonl`, `_Spoiler.txt`).

The subdirectory name is derived from the seed ID (e.g. `AP_14089154938208861744`) **plus an
optional suffix** that encodes whether the world used *canonical* and/or *vanilla* item
placements.

---

## Suffix Meaning

| Suffix | Meaning | When applied |
|--------|---------|--------------|
| *(none)* | Standard preset — no special placement constraints | Default for all original Archipelago worlds |
| `_c` | **Canonical** placement — items are placed at their "correct" locations for that game | WorldGen worlds built with `--canonical-seed 1` |
| `_vc` | **Vanilla + Canonical** — both vanilla *and* canonical placements are active | Vanilla WorldGen worlds (e.g. `alttp_vanilla_worldgen`) |
| `_v` | **Vanilla** — items placed at their original in-game locations | Rarely used on its own |

### Examples

```
frontend/presets/ahit/AP_14089154938208861744/          ← standard (no suffix)
frontend/presets/ahit_worldgen/AP_14089154938208861744_c/  ← canonical worldgen
frontend/presets/alttp_vanilla_worldgen/AP_14089154938208861744_vc/  ← vanilla + canonical
```

---

## How the Suffix Is Applied

The exporter (`exporter/exporter.py`) inspects every world in the multiworld for two class
attributes:

```python
is_vanilla   # True → adds 'v' to the suffix
is_canonical # True → adds 'c' to the suffix
```

If **any** player's world sets `is_canonical = True`, the entire preset directory gets `_c`.
If **any** player's world sets `is_vanilla = True` as well, it becomes `_vc`.

WorldGen worlds that are generated with the `--canonical-seed 1` flag have
`is_canonical = True` set on their world class, so their presets always land in a `_c`
directory.

---

## File Names Are Not Affected

Only the **directory** name changes. The files inside keep the plain seed ID in their names:

```
frontend/presets/ahit_worldgen/
└── AP_14089154938208861744_c/        ← directory has _c suffix
    ├── AP_14089154938208861744.archipelago   ← file names have NO suffix
    ├── AP_14089154938208861744_rules.json
    ├── AP_14089154938208861744_sphere_log.jsonl
    └── AP_14089154938208861744_Spoiler.txt
```

---

## Resolving the Correct Directory in Code

Because the suffix depends on world flags that are only known at export time, code must not
assume the directory is named `{seed_id}` — it may be `{seed_id}_c`, `{seed_id}_vc`, etc.

### Python: `find_seed_subdir`

The canonical helper lives in `scripts/lib/seed_utils.py`:

```python
from lib.seed_utils import find_seed_subdir

seed_subdir = find_seed_subdir(project_root, preset_dir, seed_id)
# e.g. "AP_14089154938208861744_c" for a worldgen world,
#      "AP_14089154938208861744"   for a standard world

rules_path = os.path.join(
    project_root, 'frontend', 'presets', preset_dir,
    seed_subdir, f'{seed_id}_rules.json'
)
```

The function tries the exact `seed_id` first (no suffix), then `_c`, `_vc`, `_v` in order. If
nothing is found it falls back to the bare `seed_id` so that downstream "file not found"
errors remain informative.

**Important:** `seed_id` is the full `AP_`-prefixed string (e.g. `AP_14089154938208861744`),
not just the digits. The directory always starts with `AP_`; `find_seed_subdir` does not add
or remove the prefix.

**Callers with a possibly-`None` seed_id** should guard the call:
```python
seed_subdir = find_seed_subdir(project_root, preset_dir, seed_id) if seed_id else seed_id
```

### JavaScript: `findSeedSubdir`

The same logic is available in `tests/e2e/multiclient.spec.js`:

```javascript
function findSeedSubdir(game, seedId) {
  const baseDir = `./frontend/presets/${game}`;
  if (fs.existsSync(`${baseDir}/${seedId}`)) return seedId;
  for (const suffix of ['_c', '_vc', '_v']) {
    const candidate = `${seedId}${suffix}`;
    if (fs.existsSync(`${baseDir}/${candidate}`)) return candidate;
  }
  return seedId;
}
```

---

## Preset Index (`preset_files.json`)

The preset index at `frontend/presets/preset_files.json` records the actual folder names
(including suffix) under the `"folders"` key for each game, along with a boolean flag:

```json
"ahit_worldgen": {
  "folders": {
    "AP_14089154938208861744_c": {
      "seed": 1,
      "is_canonical": true,
      "files": ["AP_14089154938208861744_rules.json", ...]
    }
  }
}
```

The frontend reads this index to locate preset files; it is always authoritative about the
actual directory name.

---

## Files That Use `find_seed_subdir`

The following scripts all call `find_seed_subdir` (or the equivalent inline logic) to resolve
the correct directory:

| File | Context |
|------|---------|
| `scripts/lib/test_runner.py` | Single-seed and multiworld spoiler/multiclient tests |
| `scripts/test/test-world-generator.py` | Spoiler tests and cross-validation |
| `scripts/test/test-all-templates.py` | Multiworld preset directory cleanup |
| `scripts/setup/setup_ap_server.py` | `.apsave` cleanup and `.archipelago` server startup |
| `scripts/test/run_multiclient_test.py` | Preset directory lookup (inline suffix loop) |
| `scripts/docs/chart_generators/utils.py` | `_rules.json` file-size lookup for charts |
| `scripts/test/export-pickle-to-json.py` | Pickle → JSON export |
| `scripts/test/compare-pickle-json-export.py` | Pickle vs JSON comparison |
| `tests/e2e/multiclient.spec.js` | `.apsave` cleanup and `.archipelago` server startup |
