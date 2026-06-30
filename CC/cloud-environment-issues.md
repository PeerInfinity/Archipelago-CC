# Cloud Environment Issues & Workarounds

Field notes from a Claude Code **cloud** session (The Witness exporter / spoiler-fuzz
work). These are environment/tooling obstacles that are *not* obvious from
`cloud-setup.md`, plus the workarounds that got things running. If you hit a
"this should just work but doesn't" wall in a cloud session, check here first.

> Scope: these are environment-setup and test-harness friction points, not bugs in
> the game logic. Most stem from the cloud sandbox's locked-down egress and from
> tools that assume an interactive TTY or a clean working tree.

---

## 1. Git submodules can't be cloned by default (egress policy)

**Symptom:** `git submodule update --init frontend/modules/shared` fails:

```
fatal: unable to access 'http://127.0.0.1:.../git/PeerInfinity/archipelago-shared.git/': The requested URL returned error: 403
```

The frontend rule engine / `StateManager` / `gameLogic` all live in the
`frontend/modules/shared` submodule (repo `PeerInfinity/archipelago-shared`), which
is a **separate repo** and therefore outside the session's default GitHub scope.
The agent proxy returns **403** for it. This blocks every frontend test
(`npm test --mode=test-spoilers`), because the code under test isn't present.

**Workaround:** bring the repo into session scope with `add_repo`, then init the
submodule at its pinned commit:

```
# (host tool) add_repo peerinfinity/archipelago-shared
git submodule update --init frontend/modules/shared   # generous timeout (~10 min)
```

Notes:
- `add_repo` requires explicit user request — it is not automatic.
- The submodule clone can look stalled during `git index-pack`; don't interrupt it.
- Only `frontend/modules/shared` is needed for spoiler tests. `textAdventureEngine`
  and `journey-to-ascension` are for other games and are not required.
- The other ~80 dirs under `frontend/modules/` are in-repo, **not** submodules
  (`.gitmodules` lists only three).

---

## 2. `pip install -r requirements.txt` fails on a git dependency

**Symptom:**

```
git clone --filter=blob:none --quiet https://github.com/kivymd/KivyMD ... exit code 128
```

`requirements.txt` pins `kivymd @ git+https://github.com/kivymd/KivyMD@<sha>`.
GitHub (non-`pypi.org`) git fetches go through the policy proxy and are blocked, so
the whole `pip install` aborts. `kivymd`/`kivy` are **GUI-only** (the Kivy client)
and are not needed for seed generation, export, or testing.

**Workaround:** install everything except the git line (PyPI is allowed directly):

```
grep -v 'kivymd' requirements.txt > /tmp/reqs-core.txt
pip install -r /tmp/reqs-core.txt
```

The egress proxy's `noProxy` list includes `pypi.org` and `files.pythonhosted.org`,
so normal PyPI installs work fine; only VCS (`git+https://github.com/...`)
dependencies are blocked.

---

## 3. Exporter dependencies missing from `requirements.txt`

**Symptom:** generation "succeeds" (exit 0) but the rules JSON is **not rewritten**
(its mtime never changes). The export step is a post-output hook
(`worlds/json_tools_installer/export_hook.py`) that imports `from exporter import
...`; if that import fails, the hook silently no-ops and the previously-committed
preset is left in place — easy to mistake for "deterministic regeneration."

The exporter imports modules that aren't in `requirements.txt`:

```
ModuleNotFoundError: No module named 'astunparse'   # exporter/analyzer/source_extraction.py
ModuleNotFoundError: No module named 'dill'         # exporter/pickle_exporter.py
```

**Workaround:**

```
pip install astunparse dill
```

(Also seen needed in some flows: `astor`, `networkx`.) **Verification tip:** after
regenerating, check the rules JSON mtime actually changed and the log contains
`Copied N files to preset directory` / `Preset content mismatch found`. If it
doesn't, the export hook silently failed — look for an import error.

---

## 4. `ModuleUpdate` interactive prompt → `EOFError` (non-interactive)

**Symptom:** `python Generate.py ...` aborts at startup:

```
Requirement pyevermizer==0.50.1 is not satisfied, press enter to install it
EOFError: EOF when reading a line
```

`Generate.py` calls `ModuleUpdate.update()` at import, which scans **every** world's
`requirements.txt` and `input()`-prompts to install missing ones. In a
non-interactive shell `input()` raises `EOFError`. CI avoids this with
`python ModuleUpdate.py --yes`, but `--yes` then tries to `pip install` everything
— including the unsatisfiable `kivymd` git dep (issue #2) — so that path doesn't
work here either.

**Workaround:** a `sitecustomize.py` on `PYTHONPATH` that pre-sets the
"already ran" flag, so every Python subprocess (including `Generate.py` and
`fuzz.py` launched by the test harnesses) skips the check. Crucially it must
**remove the repo root from `sys.path` afterwards** (see issue #6):

```python
# scratchpad/sitecustomize.py
import sys
_root = '/home/user/Archipelago-CC'
_added = _root not in sys.path
if _added:
    sys.path.insert(0, _root)
try:
    import ModuleUpdate
    ModuleUpdate.update_ran = True
except Exception:
    pass
finally:
    if _added:
        try:
            sys.path.remove(_root)
        except ValueError:
            pass
```

Run with `PYTHONPATH=/path/to/scratchpad python ...`. Per-world deps that the
target game doesn't use (pyevermizer, zilliandomizer, metamathpy, …) emit harmless
"Could not load world" warnings and can be ignored.

---

## 5. `Generate.py` guard: "Worlds system should not be loaded before logging init"

**Symptom:** when invoking generation by importing `Generate` and calling
`main()` (e.g. from a custom driver), it raises:

```
Exception: Worlds system should not be loaded before logging init.
```

`Generate.main()` has `if __name__ == "__main__" and "worlds" in sys.modules:
raise ...`, and also only inits logging when run as `__main__`. Importing it (or
importing anything that pulls in `worlds`) before running trips the guard.

**Workaround:** run it as a real `__main__` via `runpy`, with `ModuleUpdate`
pre-flagged but `worlds` not yet imported:

```python
import sys, runpy, ModuleUpdate
ModuleUpdate.update_ran = True
sys.argv = ['Generate.py', '--weights_file_path', 'Templates/<Game>.yaml',
            '--multi', '1', '--seed', '1']
runpy.run_path('Generate.py', run_name='__main__')
```

For multi-step in-process inspection, prefer `test.general.setup_multiworld(World,
options=...)` (accepts an options dict) over driving `Generate.py`.

---

## 6. `setup.py` shadowing + its own `cx-Freeze` prompt

**Symptom:** importing some test harnesses (`test-all-ut-fuzz.py`, which does
`from setup.update_host_settings import update_host_yaml`) triggers the **root**
`setup.py`, which has its *own* requirement check separate from `ModuleUpdate`:

```
Requirement cx-Freeze==8.4.0 is not satisfied, press enter to install it
EOFError: ...
```

Two problems compound here:
1. The harness intends `setup` to resolve to the `scripts/setup/` package (it does
   `sys.path.insert(0, scripts_dir)`), but if the **repo root** is on `sys.path`,
   the root `setup.py` (a regular module) shadows the `scripts/setup` namespace
   package and wins. Root `setup.py` then runs its `cx-Freeze` check and prompts.
2. Even with `cx-Freeze` installed, the import would still resolve to the wrong
   `setup` and fail to find `update_host_settings`.

**Workaround:** keep the repo root **off** `PYTHONPATH` for these harnesses (the
`sitecustomize` in issue #4 removes it after use), so `setup` resolves to
`scripts/setup/`. Run the harness from `scripts/`'s own path setup:

```
PYTHONPATH=/path/to/scratchpad python scripts/test/test-all-ut-fuzz.py --help
```

(The harness adds `scripts/` itself; `fuzz.py` runs as a subprocess from the repo
root, so it still finds the root modules.)

---

## 7. Loose YAMLs in `Players/` silently change generated options

**Symptom:** "deterministic" generation suddenly produces a **different** world
(different options/items/sphere log) for the same seed — e.g. a default-template
seed-1 run unexpectedly has `shuffle_doors=panels`, laser items, etc.

`Generate.py` scans the **entire** `Players/` directory and treats every loose
`*.yaml` (other than the named weights file) as an additional player. A leftover
fuzz config or repro file (e.g. `Players/fuzz_repro.yaml`) gets pulled into the
generation and overrides the rolled options. This cost real debugging time — it
looked like a generation-determinism / hash-seed bug but was just pollution.

**Workaround:** clean `Players/` before every generation that should use only the
template:

```
rm -f Players/*.yaml          # keep Players/Templates/, only remove loose files
```

The fuzz harnesses create temp YAMLs in `Players/` (with `delete=False`) and clean
them in a `finally`; an interrupted run can leave them behind.

---

## 8. `compute_seed_id(1)` collides with the canonical preset

**Symptom:** after running a fuzz batch, the committed canonical preset
`frontend/presets/witness/AP_14089154938208861744/` is **overwritten** (and its
`sphere_log.jsonl` may be deleted) with a random-options config.

The fuzz harness computes the preset directory id from the **seed number only**
(`compute_seed_id(seed)`), not the rolled options. So fuzz seed 1 always writes to
`AP_14089154938208861744` — the same id as the canonical default seed-1 preset —
clobbering it.

**Workaround:** after any fuzz run, restore the canonical preset before committing:

```
rm -f Players/*.yaml
python <regen-seed-1-default>          # regenerate canonical
git checkout -- frontend/presets/<game>/AP_14089154938208861744/*.archipelago \
                frontend/presets/preset_files.json scripts/data/world-mapping.json
git clean -fdq frontend/presets scripts/output Players
```

Always `git status` / `git diff --stat` before committing to confirm only the
intended files changed.

---

## 9. Playwright wipes `test-results/` each run

**Symptom:** only the **last** spoiler test's `test-results/in-app-tests/*.json`
survives; per-seed divergence detail from a batch run is gone.

Playwright clears the output directory on each invocation, so when a harness runs
many `npm test` subprocesses, only the final one's detailed results remain on disk.

**Workaround:** to capture per-seed divergences, drive the tests yourself and read
each run's stdout (the browser-log mismatch lines:
`Sphere X: FAIL`, `Missing locations: ...`, `Extra locations: ...`) before the next
run overwrites them — e.g. reproduce one seed at a time and grab the output.

---

## 10. `test-world-generator.py` is destructive to the working tree

**Symptom:** running the world-generator round-trip harness deleted **974 tracked
files** (all committed `*_worldgen` presets and `worlds/*_worldgen` packages) as
part of its setup/cleanup, and reported `Total templates: 0` because the include
filter didn't match.

The harness deletes generated `_worldgen` artifacts at start and end; in a clean
checkout these are *committed* files, so the deletions show up as tracked changes.

**Workaround:** after running it, restore everything (your committed work is safe
in git history):

```
git checkout -- .
git clean -fdq frontend/presets worlds scripts/output Players
```

For a targeted, **non-destructive** worldgen check, build a single world manually
instead:

```
python -m world_generator <rules.json> -o worlds/<game>_worldgen \
    --game-name "<Game> WorldGen" --force --canonical-seed 1
```

---

## 11. CI workflow dispatch is blocked (403)

**Symptom:** dispatching a workflow via the GitHub API returns:

```
403 Resource not accessible by integration
```

The session's GitHub integration token lacks `workflow_dispatch` permission, so you
can't kick CI (`test-spoiler-fuzz-single-game.yml`, etc.) from the agent. Per the
proxy README, **403/407 are policy denials — report them, don't retry.**

**Workaround:** run the equivalent test locally (most are pure-Python or
Playwright; see `cloud-setup.md` + this doc), or ask the user to run the workflow
from the GitHub UI. The UT-fuzz path in particular is self-contained Python
(`scripts/test/test-all-ut-fuzz.py` → `fuzz.py`) and needs no frontend/dev-server.

---

## Quick setup recap for a fresh cloud session

What actually got the full test stack working here, beyond `cloud-setup.md`:

```
# Python (skip the kivymd git dep; add the exporter deps)
python -m venv .venv && source .venv/bin/activate
grep -v 'kivymd' requirements.txt > /tmp/reqs-core.txt
pip install -r /tmp/reqs-core.txt astunparse dill

# Frontend rule engine (requires add_repo peerinfinity/archipelago-shared first)
git submodule update --init frontend/modules/shared
npm install                       # Playwright browser is pre-installed at /opt/pw-browsers

# Templates + host settings
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
python scripts/setup/update_host_settings.py minimal-spoilers

# ModuleUpdate bypass for all subprocesses (see issue #4)
#   create scratchpad/sitecustomize.py, then prefix commands with:
#   PYTHONPATH=/path/to/scratchpad ...

# Dev server for spoiler tests
python -m http.server 8000 &
```

Then, before each generation: `rm -f Players/*.yaml`. After each fuzz batch:
restore the canonical preset and `git status` before committing.
