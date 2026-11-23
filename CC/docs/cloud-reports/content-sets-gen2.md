# Content sets GEN-2: the `furniture` pack and the "Randomly placed tiles" demo preset

Branch `content-gen2`, based on the frozen GEN-1 tip `origin/content-gen1` `1d54d0808d`. The design is GEN-D's § 4
GEN-2. The brief is the planner's GEN-2 prompt, plus the queue owner's addition (a preset train: the rosters base →
tip, the preset-identity proof, and one merge of main after train 195).

⚖ Rulings in force (Robert, 2026-11-22):
- Q2: the first demo uses a new small pack that a demo world names under "what exists"; the `meta` theme is unchanged.
- Q3: `generate: true` only. Q4: "what exists" packs only, never a theme. Q8: a per-room mix.

## Commits

| # | SHA | What |
|---|---|---|
| 1 | `179394b7fe` | The `furniture` pack: `structure` (rug `walkable`, pillar `blocked`, both `generate: true`), `concepts` (base `marker` / `wall`, an `art` key each), `art` (two shape recipes in the meta theme's format). `packs.json` row (no `content` stack: never a theme). `frontend/packs/README.md`. `mazeRoom/mazeFurniturePack.test.js` |
| 2 | `10b02a66b1` | The play views' art stack takes the world's recorded `exists` packs: `mazeRoomUI._tileArtStack` and `mazeCompositeMap.mazeCompositeStackOf` |
| 3 | `8b2d718e4e` | `TILE_KINDS_DEMO_STATE` + `shipped:tile-kinds-demo`; the producer's `--state=tile-kinds-demo`; the committed `frontend/presets/tile_kinds_demo/AP_1`; registration; `tileKindsDemoWorld.test.js`; `wordsStack.test.js` restated; docs (`pipeline-presets.md`, `maze.md`) |
| 4 | `b12240f28d` | The in-app row `playback-bot-tile-kinds-demo` (batch `playback-bot`) |
| 5 | `aed5e95796` | The generated reference, regenerated (docs-index word counts; the producer's instrument row) |
| 6 | `5ddff90d4e` | The preset's description names the LOADED world (`presetDefs.test.js`'s top-down pin; red in JSUT at `aed5e95796`) |

## 1. The pack

`frontend/packs/furniture/` is the first committed "what exists" pack whose kinds the generator places.

- **structure**: `furniture:terrain/rug` (`walkable`) and `furniture:terrain/pillar` (`blocked`), both `generate: true`.
- **concepts**: one presenting concept per entry, kind `terrain`. Bases are `marker` (rug) and `wall` (pillar), so a
  view with no art still draws an honest look. Each names its art key.
- **art**: shapes only, no image file, 20×20 (the maze's `TILE_PX`). Both are drawn over the cell by the tile-kind
  overlay, so neither fills its box:
  - the rug is a deep red oblong with a gold border, a gold diamond and cream fringe;
  - the pillar is a stone disc ringed in ink with a lighter top, standing on the wall the generator lowered.
- **Registered** in `packs.json` (`packs` only). No `content` stack names it, so it can never be picked as a theme (Q4).
- **Original content**: generic furniture, drawn from basic shapes for this repository. Provenance: model
  `claude-opus-5-5`, 2026-11-22, no approval recorded.

**Its pins** (`mazeRoom/mazeFurniturePack.test.js`, 15 rows; every expectation is read off the pack):
- parse, registration, no image file, never a theme;
- every entry a terrain, walkable or blocked, `generate: true`, and both passes present;
- one presenting concept per entry, with a base (a blocked kind's base is `wall`) and an art key the art layer draws;
  no orphan shape;
- each shape inside its box;
- `generatedTileKinds`: `exists: [furniture]` gives exactly the two kinds with their passes, and `content: [furniture]`
  gives none;
- the seam: `loadMazeTileArt([maze, furniture])` resolves each kind's art key, and `drawMazeTile` draws it `as: 'art'`;
- the play views' stack (commit 2): a document recording `exists: [furniture]` gives `[maze, furniture]`, under a theme
  `[maze, furniture, meta]`, and a document recording neither is unchanged.

**What the code overturned: the play views did not read `exists`.** `effectiveContentStack` (the one stack rule)
orders defaults, then `exists`, then `content`. But the Maze Room panel and the composite map called it with `content`
only, so a kind placed from an `exists` pack resolved no art and drew as its base. Commit 2 passes the slot's recorded
`procgen_metadata[p].exists` (`documentWorldSettingsOf`) in both. No committed world recorded `exists` before this
preset, so no stack moved.

## 2. The preset

`TILE_KINDS_DEMO_STATE` (`presetDefs.js`) is the shipped preset `shipped:tile-kinds-demo`.

- **Mode**: top-down. It realises the LOADED world, which is Adventure on a plain page load, as
  `topdown-maze-ta-demo` does.
- **Rooms**: every region is a maze room (`substrateMix: {maze: 1}`), sized 16×12.
- **Settings**: `exists: ['furniture']`, and `mazeBiome: [{id: 'scattered', weight: 2}, {id: 'classic', weight: 1}]`.
- **Committed** as `frontend/presets/tile_kinds_demo/AP_1/AP_1_rules.json`.

**Why top-down at 16×12.** Measured with the pack and the mix (`probe` in the session's scratchpad; numbers per room):

| Candidate | Rooms | Placed |
|---|---|---|
| `maze-sphere-demo` (8×6) | 7 | 4 rugs, 0 pillars |
| `maze-sphere-demo`, 16×12 / 20×14 | 7 | 4 / 5 rugs, 0 pillars (carved corridors: no pillar holds the law) |
| top-down, maze only, 8×6 | 9 | 6 rugs, 6 pillars (2 slots a room) |
| **top-down, maze only, 16×12** | **9** | **24 rugs, 24 pillars (the cap: 8 slots a room)** |

On Adventure, seed 3, the 9 rooms are:
- **`scattered`, 4 rugs + 4 pillars each**: Overworld, WhiteCastle, BlackCastle, WhiteCastleVault,
  WhiteCastlePreVaultPeek, CreditsRoomFarSide;
- **`classic`, bare**: YellowCastle, CreditsRoom, BlackCastleVault.

**The record.** `procgen_metadata['1']` records `exists: ['furniture']`, the `mazeBiome` list and `mazeBiomeSeed: 3`.
Each room's sidecar `biome` is `{id: 'scattered'}` or `{id: 'classic'}`. The world embeds its sphere log (11 entries).

**The recipe.** `make-seedling-spiral-room-preset.mjs --state=tile-kinds-demo` builds it.
- This is the recipe's first top-down row. The row names its source, Adventure's committed seed-1 preset, and
  `topDownContextOf` reads the `_sphere_log.jsonl` beside it.
- So the committed world is the one the panel builds over Adventure. `check-procgen-presets` asserts that the panel's
  world equals the headless one.
- Registered with `register-preset.py --game-id tile_kinds_demo --seed-id 1`. The row's `seed` field is 1, so
  `?game=tile_kinds_demo&seed=1` resolves to it. It is listed in `preserved-dev-presets.txt` as a dev preset, not
  public.
- **The recipe reads no `host.yaml`.** It is the JS pipeline (`prepareRunFromState` → `runPresetHeadless`), not
  `Generate.py`, so the minimal-spoilers setting does not enter it. The tree's `host.yaml` is minimal-spoilers
  (`extend_sphere_log_to_all_locations: false`) all the same.

**Its `--check` is enrolled** the way `meta_trial`'s is: as the byte pin in `procgenPipeline/tileKindsDemoWorld.test.js`
(the default vitest tier, so every JSUT run). `ci-producer-checks.mjs`'s globs (`plan-seedling-*`,
`regenerate-*-tapes`, `regenerate-*-presets`) do not take this producer, and did not before.

**Preset identity** (at the tip): `node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=tile-kinds-demo
--check` → `OK: … matches a fresh build`; md5 `99b1c64f6ca07712533155b438619edc`. _(re-measured after the main merge:
see § 8)_

## 3. The roster delta (base `1d54d0808d` → tip)

| Roster | Base → tip | How it enrols |
|---|---|---|
| `preset_files.json` games | 143 → 144 | the new row `tile_kinds_demo` |
| `preset_files.live.json` | 106 → 106 | dev preset, not `public` |
| `preserved-dev-presets.txt` | 35 → 36 | the new line |
| `SHIPPED_PRESETS` | 26 → 27 | `shipped:tile-kinds-demo` (it enrols in `presetDefs.generate.slow.test.js` and `check-procgen-presets.mjs`, both read off the list) |
| Substrates config rows / Playback Bot category | 458 → 459 / 9 → 10 | `playback-bot-tile-kinds-demo` |
| `check-sidecar-fields` documents | 227 (58 with sidecars) → 228 (59) | `git ls-files frontend/presets` |
| `check-sidecar-fields` entries | 2,424 → 2,433 (maze 1,378 → 1,387) | the 9 rooms |
| `check-sidecar-fields` maze RULES (the region probe) | 1,185 → 1,194 regions; 2,392 → 2,404 gated; 4,260 → 4,301 endpoints, 3,468 → 3,509 reproduced, 792 → 792 not | the 9 rooms; every new endpoint reproduced |
| `wordsStack.test.js` (every committed maze / TA / JtA world) | +1 world, and the one red the sweep found | its pin said no world records `exists`; restated: a world recording none resolves as C3 did; a recorder is named in `RECORDS_EXISTS` with why, and gets its packs under its content |
| `presetDefs.test.js` (every `SHIPPED_PRESETS` entry; the top-down rows' label/description words) | +1 preset, and one red, caught by JSUT at `aed5e95796` | ⚠ not in the preset sweep: the file names no `frontend/presets` path. Its pin wants a top-down description to say "LOADED world"; fixed in commit 6 (`procgenPipeline/` whole re-run: 61 files, 1,472 passed). A new SHIPPED preset is its own enrolment, beside the committed one |
| `test-regression` | 60 → 60 | a fixed roster |
| `test-spoilers` | per `--game` | no roster |
| `test-all-templates` | unchanged | template-driven; a pipeline preset has no template |
| Seedling derived-rule / atlas / survey rosters | n/a | not a Seedling-family preset (maze only) |

**The sweep** (memory note: a new committed preset enrols): 380 files, then 382 at the tip.
- It covered the grep sweep over `*.test.js` (246 files), `scripts/**/*.test.js` whole (167 files) and
  `sidecarFieldsRegistry.test.js`, plus the two new files.
- The first run, with the preset untracked, found the one real enrolment: `wordsStack.test.js`.
- ⚠ The first run could not see `git ls-files` rosters, because the preset was untracked. `check-sidecar-fields` read
  227 documents until the preset was staged. The sweep was therefore re-run at the tip, after the commit.
- At the tip: green except:
  - 13 files that fail at import with `ENOENT … flashPanel/wasm/builds.json`. This worktree was made without
    `--with-wasm` (the known family); JSUT runs them with the submodule.
  - Load timeouts (60 s, 6 CPU-bound files under the 382-file run), each green re-run alone: `certifyEventLocations`,
    `seedlingSolverSurface`, `fidelityLightPole`, `mazeInputOutputSplit`, `seedlingWasmPlayback`.

## 4. The proof

| Claim | Where | Result |
|---|---|---|
| Spoiler test on the RIGHT preset | `npm test -- --mode=test-spoilers --game=tile_kinds_demo --seed=1` | PASSED; `sourceName: ./presets/tile_kinds_demo/AP_1/AP_1_rules.json`; `processedEvents=10/10` |
| A playback-bot row walks it to the end | `playback-bot-tile-kinds-demo` (batch `playback-bot`) | PASSED 72.2 s: `finished — 9 locations visited`, every sphere-log location checked; the maze panel's art stack `["maze","furniture"]`, 2 sheets, 0 failed |
| The law, world-wide: `rules.json` minus `preset_sidecars` and the maze setting keys equals the same state built all-`classic` | `tileKindsDemoWorld.test.js` | ✅ |
| The law, room by room, on the FINAL rooms: floor reach = the control room's less the pillar cells; `longestShortestPath` and the region's compiled rules equal; a rug changes no tile; a pillar is a wall on control floor | same | ✅ 6 rooms; rug 24, pillar 24 |
| The mix: each room's biome is `pickMazeBiome(setting, seed, region)`; both occur | same | ✅ |
| The committed preset IS a fresh build, byte for byte | same, and the producer's `--check` | ✅ |
| `?game=tile_kinds_demo&seed=1` resolves to its own rules | same | ✅ |
| The composite map's stack for its rooms is `[maze, furniture]` | same | ✅ |

**Mutation checks.**
- **Pillars walled round a room's entrance** (recorded as pillars): the room-by-room pin turns red (`Overworld: no floor
  cut off`), and so does the byte pin. The world-wide equality stays green, as it should: it excludes the sidecars.
- **The generator's law switched off**: the world is **byte-identical**. In these open 16×12 rooms every slot's first
  ranked cell is already legal, so the law refused nothing here. Its guard stays GEN-1's unit pins (Light World (2,1)
  `changes-rules`, carved `region_1_0` `cuts-off-floor`).

**The bot row's time.** Measured twice on the box, 72.2 s and 72.3 s, for 25 legs (9 checks + 16 routing hops), about
2.9 s a leg. The time was the same with the Maze panel focused or not; the visualizer's `instant()` is instant, so the
time is per leg, not per step. The row's bot budget is 180 s (2.5×).

## 5. The screenshots

`CC/docs/cloud-reports/content-sets-gen2-shots/`, taken in the maze lab (`lab.html?preset=tile_kinds_demo&region=<room>
&packs=maze,furniture`, the default maze look, 2× device pixels):
- `side-by-side.png`: Overworld (scattered: 4 rugs, 4 pillars), WhiteCastle (scattered), YellowCastle (classic: bare);
- `Overworld.png`, `WhiteCastle.png`, `CreditsRoomFarSide.png` (scattered), `YellowCastle.png` (classic).

The lab line reads `packs maze, furniture: 2 placeable tile kinds`, with 0 page errors.

⚠ **A pre-existing lab gap, not GEN-2's.** The lab's `?preset=&region=` reads a sidecar's region `biome` as its
PALETTE id (`?biome=`), so it refuses every pipeline maze room whose sidecar records one. That includes `{id:
'classic'}`, measured on `meta_trial` `region_2_3`, which is committed on main: *"mazeLab: biome {"id":"classic"} is
not one of [maze-v1]"*. This is GEN-D § 9.1's "one word, two meanings". The shot script therefore drops that one
field from the served rules (`page.route`); the payload is untouched. The fix belongs to the lab (follow-up).

## 6. Gates (local, at `aed5e95796`)

| Instrument | Result |
|---|---|
| `--print-engine-closure` | `74ae60f575531492ed9eaec1839e1fe3`, 42 files, unchanged; closure ∩ diff = ∅ |
| `refresh-seedling-derived-rules.mjs --check` | fresh and on count (rows 99, regions 47, excluded 6) |
| `ci-producer-checks.mjs --jobs=6` | 99 run, 0 red, 1 skipped (its named exclusion) |
| `check-sidecar-fields` | ALL PASS, 2,433 entries, 0 issues; rule agreement 0 FAIL |
| `generate-procgen-reference --check` | ALL 7 MODULES AND 5 MARKDOWN REGIONS MATCH (after commit 5) |
| `check-procgen-docs` / `check-maze-lab` | ALL CHECKS PASSED / ALL CHECKS PASSED |
| `check-procgen-presets` (every shipped preset through the panel) | ALL CHECKS PASSED, 199. `shipped:tile-kinds-demo`: the grid at Adventure's derived 4×4, `stop: all_placed`, the panel's world = the headless one. (Needed the Cloudberry site: `fetch-cloudberry-site.mjs` into the worktree's gitignored `frontend/external/`) |
| Bounded vitest | the sweep (§ 3); `procgenDocs` + `lintGateLabels` 511 passed; the new files 13 + 9 + the stack rows |
| Committed presets moved | none besides the new one (`git diff --stat origin/content-gen1 -- frontend/presets` = `tile_kinds_demo` + its `preset_files.json` row) |
| Gitlinks changed | 0 |

## 7. Follow-ups

1. **The maze lab's `?preset=&region=` refuses every pipeline maze room** whose sidecar records a region `biome`. It is
   pre-existing (measured on `meta_trial` `region_2_3`) and is noted in the planner's plan. The lab reads the sidecar's
   region `biome` as its palette `biome`. GEN-2's shot script works round it with `page.route`, dropping that field from
   the served rules (§ 5).
2. **The law refused nothing in the demo world** (law-off build byte-identical). A world where the law visibly refuses
   (a pillar kept off an exit's approach) would make the demo show the rule, not only the result. It would need smaller
   or walled rooms, which GEN-1 measured place no pillar at all; the two pull against each other.
3. **The bot's per-leg cost** in a maze-controller direct play is about 2.9 s a leg, whatever the room size. The row
   takes 72 s; worth a look if the `playback-bot` batch's headroom tightens.

## 8. The merge of main, and CI at the tip

**The merge.** Train 195 landed as `origin/main` `5634df8868` (with GEN-1 `1d54d0808d` an ancestor, verified with
`git merge-base --is-ancestor`). It was merged ONCE, in `f16dd58161`, bringing region-view-dedup and
region-map-zoom-links. Two files conflicted, both generated regions (`procgen/README.md`'s docs-index block and
`procgenDocs/generated/docsIndex.js`, word counts). Both were resolved by regenerating.

After the merge (`f16dd58161`):
- the closure is `74ae60f575531492ed9eaec1839e1fe3`, 42 files, ∩ diff = ∅;
- `refresh-seedling-derived-rules --check` OK;
- `generate-procgen-reference --check` ALL MATCH;
- `check-sidecar-fields` ALL PASS (228 documents, 2,433 entries);
- `check-procgen-docs` and `check-maze-lab` ALL CHECKS PASSED;
- **preset identity**: `make-seedling-spiral-room-preset.mjs --state=tile-kinds-demo --check` OK, md5
  `99b1c64f6ca07712533155b438619edc` (unchanged from before the merge);
- bounded vitest: `procgenPipeline/` whole, plus the GEN-1/GEN-2 maze files, `contentPacks`, `packStructure`,
  `packConcepts`, `procgenDocs`, `lintGateLabels` and `sidecarFieldsRegistry`: 81 files, 2,319 passed;
- the merge's own test files that read presets (`regionMapLinks`, `jsRuntimeSave`): 36 passed;
- gitlinks 0;
- `git diff --stat 5634df8868 HEAD`: 23 files (GEN-1 + GEN-2), no other preset.

**CI at the exact final tip**: the ids and head SHAs are in the report-back message (this commit is the tip they ran
at).
