# cloud report — er-e4b-mode-preset (ER step E4b)

Branch `claude/e4b-entrance-randomization-g9wf24`. **Base: `origin/land/er-e4a`** (tip `f08f0a36`; `origin/main` does
NOT contain it). `git merge-base HEAD origin/main` = `6473024aa824efe5c532d24e9f1bccb3942df205`. Shared gitlink
unmoved (`b7db6a2`); no submodule pointer moved; no `shared` patch needed.

## Verdict

Items 1–4 and 6 landed. Item 5 (F-D gate) is NOT done → **E4c** (below). Vanilla is byte-identical (measured, below).
No STOP fired: zero unclassified doorways, no solver/levelRun/`CONTACT_FIDELITY` change, no sphere move.

## What landed (commits, oldest first)

1. `2ca5f3f9` reach binding: `sweep: 'placed'` + `apExitNamesByEndpoint`.
2. `204d66f1` producer: `compilePlaythroughRules(doc, {table, rekey, roomsAtlas, gameName})` (main's post-atlas body,
   returned not printed; `main` is its vanilla caller) + the derived-rule table re-keyed by atlas endpoint.
3. `25f06374` E2 validator: **COUPLED-MIRROR** ({D,E} ⇒ {E,D}); fixture carries its mirror row; mutant.
4. `f2095fbe` the mode `procgenPipeline/entranceShuffleSteps.js` (`ENTRANCE_STEPS = pool/classify/shuffle/compile`),
   Seedling's classifier `flashPanel/seedlingEntranceClassifier.js`, the node hooks
   `scripts/procgen/seedlingEntranceShuffleHooks.mjs`, the registry declaration (`flash_seedling.entranceShuffle`),
   `VALID_MODES`/`PRESET_GROUPS`/`PRESET_GROUP_ORDER` (+`Entrance shuffle`), `buildRunFromState`/`runPresetHeadless`
   (`buildEntranceRun`), CLI `scripts/procgen/entrance-step.js`, docs (architecture.md, substrate-registry.md).
5. `c55fa01e` the `seedling_er` preset + README + `make-seedling-er-preset.mjs [--check]` + registration
   (`register-preset.py`, `preserved-dev-presets.txt`: dev only) + `seedlingErMode.test.js`.
6. `cc013b4c` generated procgen docs.
7. `24b2bf03` E2 prerequisites (editor cascade; relayout refusals).
8. `27bf1513`, `c7f498a0` roster enrolments.
9. `eb8f91e4` play-time references name the authored atlas; `seedling_er` is its own game (also adds the item-6 pin).

## Design decisions (measured, then chosen)

- **The mode never names a substrate.** Hooks come from `opts.hooks`, resolved by `entranceShuffleHooksFor(atlasId)`
  over the registry. Seedling's hooks are NODE-ONLY (the producer reads the map), so the mode is headless; the panel
  radio does not offer it.
- **Retries.** Draw `k` uses `rngFor(drawSeed(seed, k))` (draw 0 = the seed). An `EntranceRandomizationError` and a
  rejected layout (unbeatable / a substrate check) both take the next draw; every draw is logged with a verdict.
- **The reach's inventory (`sweep`) — a change from E4a's binding, for the mode only.** GER's all-state assumes a fill
  runs after the shuffle; under Q4 (vanilla items) none does. Measured, same seeds, maxAttempts 40:
  - `'events'` (GER all-state): seed 1 accepted at draw 13 (11 unbeatable, 1 check); seeds 2, 3, 4 **exhausted 40
    draws**; seed 5 at draw 6. **2 layouts / 139 draws.**
  - `'placed'` (start items, then each reached location's own item): seeds 1–10 → **10 layouts / 16 draws**:
    0 unbeatable, 5 EARLY-SPHERE rejections, 1 shuffle refusal.
  `'placed'` is the mode's default (`ER_SWEEP`); `'events'` stays `makeRulesDocReach`'s default (E4a unchanged).
- **Compile.** D placed at E → `conn(D).to = E.arrival` (= vanilla `conn(rev(E)).to`, E1's note). LANDING-SET:
  the shuffled connections land on exactly the vanilla arrival multiset (refused otherwise; mutant pinned). The shuffled
  doc is a different document, so it is **restamped** (`seedling-06e12d12` for seed 1); the compile's `provenance`
  names it. Its **play-time references** (`atlas_ref`, `region_atlas`) name the **authored** atlas
  (`compileRegionAtlas` new `roomsAtlasId`/`roomsAtlasOf`, refused unless regions/tile space/start/game are equal):
  before this, `seedlingReturnToMenu` failed with `no partition for seedling-06e12d12/level_0` — the partition is
  keyed by `atlas_ref`, and writing a partition for the shuffled id would be a vanilla byte move.
- **Game name.** `seedling_er` is `Seedling Playthrough ER`: `check-worldgen-package-sidecars` pairs presets to world
  packages by game, and the vanilla package does not generate this document.

## Item-by-item

**1. The mode.** As above. Shuffle step binds E3 over the vanilla compile (each doorway named by its compiled AP exit,
read from the compiled doc's sidecars). Compile writes `er` on all 52 classified exits (`shuffle: false` on the pinned
pair) and the block; E2's validator must be clean (a failure THROWS, it is a defect). Beatability = `generateSphereLog`
collects every location and the goal item. Timings (seed 1): pool 4.4 s, classify 4.4 s, shuffle 3.6 s (incl. the
vanilla compile), compile 3.4 s per draw. `entrance-step.js` and the preset producer both run ~16–20 s.

**Classifier** (rules C-SCOPE, C-ONE, C-PAIR, C-BESIDE, E1's PINS + PIN-PERMISSIVE; any doorway no rule classifies is a
Q5 STOP, thrown by name). Over E1's census RESULT (no second pairing rule): 52 stairs in scope, pinned
`L0:out_stairsdown_256_272` (PIN-CHAIN) + `L2:out_stairsup_48_16` (PIN-CHAIN coupled), **25 pairs / 50 exits
shuffled**; out of scope by class: pit 12, pit/chained 1, teleporter/door 23, teleporter/edge 191, warp 2. Mutants:
Q5 STOP, PIN-PERMISSIVE, a pin splitting a pair.

**2. Seedling's checks.**
- *Start / EARLY-SPHERE*: a layout is rejected unless spheres 0+1 collect ≥1 advancement location AND sphere 0's
  accessible set is ≥ vanilla's (vanilla's own sphere 0 is the floor, so nothing vanilla allows is refused). Measured
  rejecting 5 draws over seeds 1–10. Seed 1's preset: sphere 0 ≥ vanilla (pinned).
- *L51 permissive binding*: **gone on this base.** The census now lists 2 permissive bindings, `level_66/out_teleporter_72_64`
  and `level_89/Level 089 - Feather`, both SAFE (no stair lands in their level). No pin needed today; the classifier's
  PIN-PERMISSIVE rule pins any future AT-RISK one with its reverse (mutant pinned), and the PERMISSIVE check re-reads it.
- *L40 shared-exit FINDING*: **resolved, no split.** E4a counted connections by BASE name `<from> -> <to>`; the compiler
  suffixes duplicates, so AP_1 has 13 DISTINCT exits: the stair is `level_40__r23c29 -> level_43__r13c7`, the twelve edge
  teleporters `#2..#13`. The mode names every exit by the compiled doc's own sidecar record, never by base name.
- *R-A4*: proved by the LANDING-SET invariant (a coupled shuffle only permutes existing arrivals; none lands in
  `level_20__r1c12`), and re-asserted on the committed preset: every way into r1c12 is `level_20__r1c4`'s and costs the
  Shield. `seedlingInRoomPressGate.test.js` stays green on vanilla.
- *R-A3 (derived-rule table)*: on a shuffled doc it is applied by ATLAS ENDPOINT (`rekey`), and a row whose exit the
  shuffle MOVED is **skipped by name** (19 rows on seed 1's preset; the composed rule, re-derived over the shuffled doc,
  stands). composed ≠ table on the applied rows: 0. Mutant: the table applied by vanilla name on the shuffled doc refuses
  or lands a row on another edge.

**3. `seedling_er` preset.** Seed 1, draw 0 accepted, 50 placements, 48 exits moved (one pair drew its own reverse),
85 sphere states, beatable. Recipe in `frontend/presets/seedling_er/README.md`; `make-seedling-er-preset.mjs --check`
OK. Rosters (each decided):
- IN: `preset_files.json` (dev, `preserved-dev-presets.txt`; not in `preset_files.live.json`), `regionContent.test.js`
  ATLAS_ROOM_DOCS, `flashSeedlingAtlasRoom.test.js` PROJECTION, `mapDocumentPath.test.js` (9→10),
  `seedlingRestartWarp`/`seedlingReturnToMenu` covered lists, `eventKinds.test.js`, schema validation
  (`test_schema_validation.py`), every `frontend/presets/**` walker (rulesJsonWriters, documentBundle, presetRun,
  locationCapacity, ruleKindCensus) — green with it.
- OUT (by construction): spoiler tests (no `_sphere_log.jsonl`, no Generate.py seed), world-package pairing (own game,
  no package).

**4. E2 prerequisites.**
- Editor: a `set-exit-field` rename rewrites `er.reverse` and `placements[].exit/target`; `delete-exit` /
  `delete-region` drop the gone exits' references and **refuse by name** when the result breaks the shuffle (half a
  coupled pair). Only a name one exit carries is cascaded. The ⚠ row in `entranceRandomizationRoundTrip.test.js` is
  flipped (the bare rename is now the mutant).
- Relayouts: **refuse an ER source by name** — `procgenPipelineEngine.layoutTopDown` (covers `sourceMenuRegion`'s
  compile and the top-down mode) via `TOPDOWN_SOURCE_REFUSALS.entranceRandomized` / `entranceRandomizedFacts`, and the
  editor's initialise op first (`INITIALISE_BLOCKERS.ENTRANCE_RANDOMIZED`, so `returnExitsOf` never runs). Pinned with
  a stripped-ER mutant.

**6. E3's dead-end mutant on the real stairs graph** (40 seeds, AP_1 binding): the mutant is LIVE (places differently on
39/40 seeds under 'placed', 40/40 under 'events'), **invisible on correctness** (0 layouts lose a region/location, either
sweep), and visible only as a **refusal rate under 'placed': 7 → 9 of 40**; 0 → 0 under 'events'. Pinned in
`seedlingErMode.test.js` (exact counts: a rules move re-records them).

## E4c (named, not done)

- **F-D gate (item 5)**: the whole-game certifier on `seedling_er` needs an ER maze projection
  (`make-seedling-playthrough-maze.mjs` over the shuffled doc) and its own baseline; `test_reachability.py` needs an ER
  world package (world_generator over `seedling_er`, + Generate.py). Neither built here.
- An envelope JSON Schema for the entrance mode (`generate-envelope-schemas.mjs` list) and envelope serialize/resume
  (today the CLI writes PUBLIC fields; a run re-pools).
- Re-deriving `er` over a relayout (refused today).
- E5/E6 play-time redirect (out of scope): the preset plays vanilla rooms (Q3).

## Gates

- Vanilla byte-identity: `make-seedling-playthrough-rules.mjs --check` OK (atlas + AP_1);
  `make-seedling-subregion-partition.mjs --check` OK; `make-seedling-playthrough-maze.mjs --check` OK; world package
  regenerated to scratch (`world_generator … --canonical-seed 1`) = `worlds/seedling_playthrough` (`diff -rq` empty);
  AP_1 unchanged ⇒ seed 1 unchanged (not re-run). Vanilla through the mode's compile hook = AP_1 byte for byte (pinned).
- `make-seedling-er-preset.mjs --check` OK.
- `census-seedling-constants.mjs --write`: no change. `generate-procgen-reference.mjs` then `--check`: ALL 7 GENERATED
  MODULES AND 5 MARKDOWN REGIONS MATCH, 0 findings.
- `check-procgen-help.mjs --in-place --only=` on `make-seedling-er-preset.mjs` and `seedlingEntranceShuffleHooks.mjs`:
  ALL PASS (`entrance-step.js` is a `.js` file, outside that gate's `*.mjs` population; its `--help` prints and exits).
- pytest (installed into `.venv`, it was absent): `test_schema_validation.py` + `test_entrance_randomization_roundtrip.py`
  10 passed, 462 subtests. Tree clean afterwards (no Generate/pytest dirt).
- Bounded vitest, one run over: every test that reads the playthrough atlas / AP_1 / the maze preset or walks the
  committed presets (107 files, slow/train/calib excluded), all of `frontend/modules/apworldEditor/` and
  `frontend/modules/procgenPipeline/`, the E2 check + loader tests, `seedlingErMode.test.js`, `boxLock.test.js`,
  `checkProcgenHelp.test.js`, `seedlingConstantsCensus.test.js`, the banned-docs-name test: **186 files; 185 passed,
  1 failed** — the banned-docs-name test, which matched this report's own wording; reworded, then re-run alone: green.
  Also green separately: E3/E4a's ER tests (`seedlingErDoorCensus`, `seedlingErProducerDecoupling`,
  `seedlingErReachBinding`, `entranceRandomizationReach`), `seedlingInRoomPressGate`.
- ⚠ `scripts/procgen/standingValues.test.js` › "a gate that sleeps past the deadline is KILLED" fails here **with my
  changes stashed too** (environmental process-group kill; not this slice).
- The banned-docs-name test ((the banned-docs-name test)) is green (it first caught this report's own line).
