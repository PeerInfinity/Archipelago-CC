# Cloud report — `seedling-js-panel-look`

Branch: `claude/seedling-js-panel-look-qrckdv` (harness-pinned; based on `origin/main` @ `bf289081`).
Commits: `8cb073f2` (bootstrap), `930ea7c9` (panel look row), then this report.

## 1. The panel `look` row

**Files changed**
- `frontend/modules/flashPanel/flashSeedlingGenLibrary.js`
  - `SEEDLING_GEN_LOOK_KEY = 'seedlingGenLook'` (beside `seedlingGenFill`), `SEEDLING_GEN_LOOK_NONE_LABEL = '(none)'`.
  - A **Look** select row, drawn after Fill. Its options are `(none)` (value `''`), then the looks
    `procgenLook.GEN_LOOK_NAMES` lists, then the bag's own look if that list lacks it.
  - `buildSeedlingGenRegionParams` carries `look` **only when given** (the `require` pattern). `(none)`/absent →
    no `look` key, so the bare-bag pin (`look: undefined`) stays green and old regions are byte-identical.
  - `seedlingGenProcgenParamsFromPayload` reads `generation.look` back into `seedlingGenLook`.
  - Not added to `DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS` / `KNOB_OF`, because the G9 read-back row requires a
    built payload's keys to equal the defaults' keys. So the generated registry doesn't move.
- ⚠ **Design call: the names are INSTALLED, not imported.** A static import of `procgenLook.js` would add
  **21 files / 1,087,454 B** to `flashPanel/index.js`'s static closure (measured: 112 → 133 files), because it
  reaches `levelWorld.js`. That breaks the library's "light entry" law. Instead:
  - `installSeedlingGenLooks(module)` reads `GEN_LOOK_NAMES` off the module (it refuses by name a module
    without them). `seedlingGenLookNames()` / `seedlingGenLookOptions(current)` are its readers.
  - `flashSeedlingGenBuild.js` (headless door): imports `procgenLook.js` and installs it.
  - `flashPanel/index.js` `loadSeedlingGenerator`: after the room installs, it imports
    `SEEDLING_GEN_LOOK_MODULE_PATH` (`modules/seedlingDemo/procgenLook.js`) from the same computed base. The
    room module already statically holds it, so this is a cache hit. It is best effort: a failure logs a
    warning and the loader still returns `true`.
  - Before the install, the row offers `(none)` plus the region's own look, so a round trip never drops it.
- No change to `procgenLook.js`, `procgenPalette.js`, the gen-room modules, `jsRuntime*`, `watch*`, the solver,
  `levelRun`, wasm or `vendor`.

**Pins**
- In `flashSeedlingGenLook.test.js` (new, 4 rows):
  - The row lists `(none)` then **exactly** `GEN_LOOK_NAMES` (values and labels). The row is found by measuring
    which key it writes, not by its label.
  - A round trip **keeps** a set look: pick it in the row → bag → room → payload `generation.look` → bag →
    re-rendered row shows it → a second build gives an equal payload.
  - `(none)` → `''` in the bag → no `look` in `seedlingGen`, none in `generation`, none read back. The payload
    equals the one a bag without the key builds.
  - Before install: the options keep the region's own look; a bad install is refused by name; an installed
    name isn't listed twice.
- In `flashSeedlingGen.test.js`:
  - The bare-bag pin is unchanged (comment only).
  - The loader row now expects the room URL **then** the look URL, and installed names = `GEN_LOOK_NAMES`.
  - The static-closure row also forbids `/procgenLook.js`.
- **Mutant**: removing `seedlingGen.look = …` in `buildSeedlingGenRegionParams` → the round-trip row goes red
  (1 failed | 3 passed). Driven, then restored.

## 2. Cloud bootstrap: bulletml-dodge

- `scripts/cloud/session_bootstrap.sh`: the default `SUBS` is now `frontend/modules/shared
  frontend/modules/bulletml-dodge`, using the same mirror path. `CC/cloud-setup.md` says so; its stale "all
  seven submodule repos" now reads "every submodule repo `.gitmodules` names".
- **`env_setup.sh` needs NO re-paste.** It mirrors every `.gitmodules` URL (its §2 loop). This session's
  `/root/CC/SETUP_STATUS` shows `mirror bulletml-dodge: OK (15M)`.
- **Proof (this session):**
  1. `git submodule deinit -f frontend/modules/bulletml-dodge` → the directory is empty.
  2. `--check` → 4 FAILs: `registry.js`, `capabilities.js`, `substrate-registry.md` § capability-matrix and
     `procgen-substrates.md` § capability-chart.
  3. `bash scripts/cloud/session_bootstrap.sh` (default, no flag) → `submodule frontend/modules/bulletml-dodge:
     OK`, READY. It checked out `7423ee86` from the mirror.
  4. `--check` → **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**.

## Gates (bounded)
- `npx vitest run frontend/modules/flashPanel/flashSeedlingGen` (3 files: `flashSeedlingGen`, `…GenLook`,
  `…GenLibraryItems`) → **40 passed**.
- Neighbours that render every registered entry's form: `procgenCore/regionGenerationForm`,
  `apworldEditor/regionGenerationFlow`, `apworldEditor/readBackTarget` and `procgenPipeline/procgenPipelineUI`
  → **114 passed**.
- `generate-procgen-reference.mjs --check` → ALL MATCH, with the panel change in. The registry doesn't cite the
  look key, since it isn't a default, so no `--write` was needed.
- No unfiltered vitest (ruling 52). The suite number comes from CI at the pushed SHA.

## STOPPED / not done
- Nothing stopped.
- Not done: a browser check of the live row in the running app (no TT here; the coordinator dispatches it).
  The live loader path is covered headless by the loader row, using a stub importer.

## Landing

Landed by the local slice `seedling-js-cloud-landings` (gate: `seedling-js-planning-13`, then `seedling-js-planning-14`)
on 2026-10-31 UTC. It was a member of the COMBINED TRAIN `js-land/train-2026-10-31a`, which fast-forwarded `main` from
`39b4f05179` to **`f886ddcadf`** (⚖ user ruling: a combined landing).

- **History on `js-land/seedling-js-panel-look`:** the cloud tip `875c08337b` (based on `bf28908179`), then clean merges
  of `origin/main`: `a7d40b84cb`, `2ce525e323`, `0ebdd65b7f`, `9d790feb67`, `63101b5dee` and `3527b46f74`. The member
  SHA was **`47d0ec8bae`**, merged into the train cleanly (`4e2d9ae262`). No hand resolution was needed, no feature
  code changed in landing, and the gitlink count was 0.
- **Gates at the member's own tip `47d0ec8bae`:** JSUT 41160491600 ✅ and unittests 41160491595 ✅. The TT 41126156953 ✅
  was carried from `b6518ed124`.
- **Gates at the train `f886ddcadf`:** JSUT 41166403787 ✅ (13 jobs, attempt 1), unittests 41166403824 ✅, a fresh TT
  41166403518 ✅ (8 jobs) and `seedling-probe.yml` standard 41166405742 ✅. The lab-shard lines were
  `seedling-lab-load-in-js | 41/0`, `seedling-lab-art | 118/0`, `seedling-editor-manual | 63/0`,
  `seedling-editor-switch | 62/0` and `seedling-wasm-ship | 415/0`.
- One JSUT at `708f59ffba` went red on the known concept-trial Phase A flake (`concept-trial-play | 24/1`) before that
  fix landed. The failed job was rerun once, then superseded by the next main merge.
