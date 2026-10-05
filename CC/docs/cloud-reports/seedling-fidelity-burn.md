# Seedling fidelity BURN: a burnable tree as a reach-exit obstacle

**Slice:** `seedling-fidelity-burn`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`). ⚖ The user chose it on 2026-10-04: *"Burn as a reach-exit move."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/sf-f7` @ **`0aab89b`** (`0aab89b4d862b614143caf73014573825997bcc4`), as briefed |
| Head | the commit that adds this report (the last on the branch). The code head is **`c704a34`** (`burn` in `KNOWN_STRATEGY_VERBS`); `52b279f` is docs only |
| Harness branch | `claude/burnabletree-reach-exit-4rfen6`. The local branch is `seedling-fidelity-burn`, pushed to the harness branch only |
| Commits | D2 **`b493d45`** · D1 **`0eb681e`** · D3 records `52b279f` · D2 `c704a34` (the known-verb list) · this report |
| Dev server | `serve-nocache.py 9220` (`SEEDLING_PORT=9220`), this tree |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** (one banked red, below) |

## The one thing to know first

**Route step 93 now solves, and the game agrees: 124 t, L24 → L12, model = game for all 125 observations.** The solver leans `down` against the tree's top edge at (56,120), selects Fire's slot, presses on t60, waits out the burn, and selects the sword's slot again. Then it walks onto the uncovered teleporter.

- Step 102 (L44 → L45) also solves.
- Steps 30, 62 and 72 now refuse by a true name: the tree **needs Fire**, which the route does not hold yet.
- Step 101 burns its tree and stops at `watcher@104,264`.
- **The new first refusal past sphere 2.2 is step 95 (L37): `proximity-hazard:watcher (watcher@104,264)`, VERB-MISSING.** It is the same watcher that step 101 reaches after its burn. Step 94 is a TIMEOUT both before and after.

## W0 (at `0aab89b`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9220 bash scripts/procgen/identity-block.sh .`, primary tree, pristine, venv active | log md5 **`aa46950b5958b32136111155250dd253`**, the bank's value |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** |
| reference | the block's last row | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner | inside the bounded vitest, sorted `(fullName, status)` lines | **469/469**, md5 **`1999093a9c5df32b4b4d1f3582687aa4`** (F7's value) |
| surface / constants / profile / entities | the four `--check`s | **GREEN 194** · **PASS 4,966** · **PASS 138** (both JSONs) · **PASS 518** |
| roster | `fixtures/tapes/index.json` | **206** tapes |
| bounded vitest BEFORE | 38 files: `solverBot`, `solverBotLethalPit`, `solverDeadline`, `solverEncounter`, every test that names `burnabletree\|BurnableTree\|runFire\|applyFire` (`rg -al … --glob '*.test.*'`: 14 files), `fireVerb`, `burnableTree`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `tapeRunner`, `entityBlocks`, `jsRuntimeDeclarations` (read-only), `lintGateLabels`, `boxLock`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `surveyFamily`/`surveyGrants`/`surveyRoute`, `fidelityF7`, and F7's pin files (`rosterCategories`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `r8Acceptance`, `procgenWeigh`) | **38 files / 1,887 tests, 1 red**: `rosterCategories.test.js:175` *"expected 144 to be 146"*, F7's banked standing row (red at the base) |
| route survey | `node scripts/procgen/survey-seedling-route.mjs --through=end --out=…` | **142 SOLVED / 121 REFUSED / 2 TIMEOUT** (steps 84, 94) of 265 |

**The six refusals, reproduced at the base** (`--only=30,62,72,93,101,102`, all VERB-MISSING):

| step | level | grant (Fire?) | words | ms |
|---|---|---|---|---|
| 30 | L44 @16,80 | sword only | *"no corridor for goal reach-exit toward (152,136) in level 44. Obstacle: solid:burnabletree (burnabletree@48,64) … No strategy row exists for this obstacle."* | 10 |
| 62 | L24 @96,80 | keys 0–1, torch | *"… toward (40,152) in level 24. Obstacle: solid:burnabletree (burnabletree@32,128) …"* | 11 |
| 72 | L37 @288,16 | keys 0–1, torch | *"… toward (40,312) in level 37. Obstacle: solid:burnabletree (burnabletree@128,192) …"* | 43 |
| 93 | L24 @96,80 | **Fire**, Shield, torch, keys 0–1 | *"… toward (40,152) in level 24. Obstacle: solid:burnabletree (burnabletree@32,128) …"* | 11 |
| 101 | L37 @288,16 | **Fire**, Shield, torch, keys 0–2 | *"… toward (8,264) in level 37. Obstacle: solid:burnabletree (burnabletree@128,192) …"* | 56 |
| 102 | L44 @128,128 | **Fire**, Shield, torch, keys 0–2 | *"… toward (72,8) in level 44. Obstacle: solid:burnabletree (burnabletree@48,64) …"* | 14 |

## D1 — the game's rule (PASS, measured; no model fix)

**Read from the AS3:**
- **What burns a tree.** `BurnableTree.hit(t)` is `if (t == "Fire" && !burn) { playSound; burn = true; play("burn") }` (`Scenery/BurnableTree.as:29-37`).
  - Only `Player.fire()` passes `"Fire"` (`genericHit(e, "Fire", …)`, `Player.as:1032`). It runs while `firing`, which `useItem` sets for case 1 (the Fire's slot) and case 5 (the Fire Wand fusion, which also sets `wanding`).
  - A sword, spear or wand press reaches the tree and does nothing.
  - The fire's reach is `fire()`'s 32x32 rect plus a 16 px radius cut (`:1025-1031`). The cut builds the target's box with the **player's** `originY`, a quirk the model transcribes (`fireRadiusDistance`).
- **The duration.** `hit()` removes nothing. The 20-frame `burn` animation at rate 15 ends in `burnEnd -> die()` (`:39-42, 65-69`), 41 updates later (`burnableTree.HIT_TO_GONE_TICKS`).
- **The persistence write.** It is in `removed()` (`:49-54`): `Game.setPersistence(tag, false)`, in-room for `tag >= 0`. All three route trees are `tag >= 0`: L24 tag 0, L44 tag 0, L37 tag 1.
- **Re-entry.** `check()` is `if (tag >= 0 && !Game.checkPersistence(tag)) die()` (`:56-63`), so a burned tree stays burned. The model builds the room without it (`treeBuiltIn`). `r5-l40-part5` (game-recorded) already boots L40 with the burn's `{40,0}` declared.

**Measured on the game** (`probe-seedling-burn-write.mjs --record=fixtures/burn-write-oracle.json`, ALL CHECKS PASSED, p4f, logic-only). Each witness is cut at the model's `goneAt` and at `goneAt + 1` ticks (`hold`), and the game's `persistence_cleared` is read:

| witness | first fire hit | model `goneAt` | game at `goneAt` | game at `goneAt + 1` |
|---|---|---|---|---|
| `burn-l24-reach-exit` (L24 tree, tag 0) | t64 | 105 | `{24,0}` **absent** | `{24,0}` **present** |
| `burn-l44-reach-exit` (L44 tree, tag 0) | t46 | 87 | `{44,0}` **absent** | `{44,0}` **present** |

Both brackets put the write on the model's `goneAt` update, 41 after the first hit (`goneAt − t = HIT_TO_GONE_TICKS`). The press is at t60 / t42, and the first hit lands at T+4 (`FIRE_WINDOW`).

The still-solid-then-gone half was already game-witnessed by `r5-l37-burn` (the L37 tree that steps 72 and 101 refuse on). The two new witnesses cross the tree's own cells only after the burn. **The model's `applyFire` arm agrees everywhere, so no model change was needed.** `fidelityBurn.test.js` holds the model to the oracle.

## D2 — the `burn` strategy (PASS, game-witnessed)

**The transcription** (`b493d45`):
- **`OBSTACLE_STRATEGIES['solid:burnabletree'] = 'burn'`**, registered as `STRATEGY_EXECUTORS.burn = execBurn`, dispatched from `resolveObstacleStrategy`.
  - The survey's three paths are all exercised: the mutants below give VERB-MISSING, VERB-SELECTED-NOT-REGISTERED and VERB-APPLY.
  - `decisionTrace.KNOWN_STRATEGY_VERBS` gains `burn`, as `break` and `apitem` did in the slices that first drove them (D3 commit). `summarizeTrace` is read only by the `show-seedling-trace` viewer, and no committed trace carries a `burn` row, so no output moves. The witness's summary now reads `unknownStrategyVerbs: []`.
- **The hoist.** `burnStanceCandidates(run, tree, tiles)` is the encounter's `burnStanceFor` loop, returning every candidate sorted by distance.
  - The sort is stable over the same (ty, tx) scan, so `burnStanceFor` (now `[best] = burnStanceCandidates(…)`) picks exactly the cell it did. `r9-solve-32`, `solverEncounter` and the identity rows are unchanged.
  - The encounter keeps its 12x12 bounds. The obstacle verb passes `burnWindowTiles(tree)`, because L37 is 40x20 and the old scan's last row is y 176..192.
  - `runFire` is reused **unchanged**, apart from one new declaration (below).
- **`resolveBurnStrategy`** — the gate first, then the stance:
  - **The gate:** no Fire returns `held: false`, *"this run does not hold FIRE … the tree NEEDS FIRE"*. The Fire Wand also returns `held: false`, naming `weaponForPress`'s case-5 refusal.
  - **The stance:** each candidate is asked of `presses.auditFire`. The tree must burn and no other responder may act (no push, no rope, no refused arm).
  - **The lean:** where the cell centre is cut by the radius, the resolver previews one key toward the tree on `run.previewStepper` until the box stops, then re-asks the audit from there. L24 needs it: the cell centre above the tree is 19 px from the radius box.
  - **Reachability:** `stanceReaches`, the shared stance derivation with the SF1 lazy hypothesis.
  - **The declarations:** `overPit` / `overExit` come from the world.
- **`execBurn`** — settle, then the lean (live), then re-ask the audit at the real position. Then:
  1. `equip(Fire's slot)` (a tape `equips` row, no key);
  2. `runFire(…, { burns, overPit, overExit })`;
  3. `equip(the old slot)`. **This restore is required:** `strikePolicyFor` reads the inventory's sword and presses `primary`.

  Executors now receive the segment's `equip` in their ctx (three call sites, one field each).
- **`runFire`** gains `fire.overExit`, the `overPit` case one exit kind over. Both L24 teleporters to L12 (`@32,144`, `@48,144`) sit under `burnabletree@32,128`, so the burned cell reads `teleporter`.
- **No `shouldStop` site** was added. The search is at most about 50 cells, each an audit, a ≤100-step preview and one `planWaypoints`. Measured whole solves: step 93 175 ms, step 102 240 ms.

**The game witnesses.** `plan-seedling-burn-witness.mjs` authors them. It uses the survey's staging (`r8-solve-11`'s block re-pointed at the atlas arrival, with the grant written out), and each tape is the solver's own plan. Its `--check` is byte-identical, and both tapes' staging equals the survey's step-93 / step-102 boot views field for field. They were recorded with `check-seedling-bot-differential --record --only=burn-l24-reach-exit,burn-l44-reach-exit`: **ALL CHECKS PASSED, "THE MODEL REPRODUCES THE RECORDING IT JUST MADE"** on both.

| tape | step | plan | game | model |
|---|---|---|---|---|
| `burn-l24-reach-exit` | 93 | 124 t; lean `down` at (56,120); equips `[{t60,1},{t114,0}]`; press t60 | 125 obs, 1 transition 24→12 @124, `hits` 0, `Main.primary` 0 at the end | equal, 0 px |
| `burn-l44-reach-exit` | 102 | 212 t; tile-centre stance (88,104); equips `[{t42,1},{t96,0}]`; press t42 | 213 obs, 1 transition 44→45 @212, `hits` 0 | equal, 0 px |

The L37 tree (steps 72 and 101) needs no third witness: the rule is the same Fire gate, and `r5-l37-burn` already witnesses that tree on the game.

**`fidelityBurn.test.js`** (16 rows):
- the row and the executor;
- per witness:
  - the boot (Fire held, sword selected, one tree);
  - **SOLVES** (burns it, crosses, equips `[1, 0]` with the first on the press tick, the sword selected again, `earnedClears` carries the burn);
  - the trace names `burn`, a known verb, on the tree;
  - the committed tape IS the plan (spans and equips);
  - D1's game bracket;
  - **CONTROL without Fire**, which refuses by name;
  - **CONTROL with the Fire Wand**, which refuses by name;
- the L24 lean (`[(56,120), 'down']`).

**Mutants** (each predicted first, made by copy, restored md5-identical, `solverBot.js 7db902c7…`):

| mutant | predicted | measured |
|---|---|---|
| m1: the `'solid:burnabletree'` row removed | steps 93/102 back to VERB-MISSING with the **old words**; `fidelityBurn` 10/14 red (the boot rows and D1 rows stay green) | **10/14 red**; survey `--only=93,102`: VERB-MISSING, refusal text **byte-identical to the base survey's** |
| m2: the row kept, `burn: execBurn` removed | VERB-SELECTED-NOT-REGISTERED (*"Strategy 'burn' is SELECTED but not registered this slice"*); 10/14 red | **10/14 red**; both steps VERB-SELECTED-NOT-REGISTERED |
| m3: `resolveBurnStrategy` returns `null` | VERB-APPLY (*"Strategy 'burn' failed to apply"*); 9/14 red (the registry row stays green) | **9/14 red**; both steps VERB-APPLY |

**The survey, before → after** (`--through=end`, full, at `0aab89b` and at the code head). Every step whose verdict, ticks or refusal text changed is listed; families are recomputed with the new `surveyFamily`:

| step | level | before | after | ms |
|---|---|---|---|---|
| 30 | L44 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@48,64)` | REFUSED **ITEM-GATE** `burn burnabletree@48,64` — *"this run does not hold FIRE"* | 10 → 12 |
| 32 | L12 | REFUSED (unclassified) *"chest (320,816) stance -> keylock: bosslock@416,240 needs a key"* | REFUSED **ITEM-GATE** *"chest (320,816) stance -> burn: burnabletree@480,640 … does not hold FIRE"* | 164 → 96 |
| 34 | L44 | REFUSED VERB-MISSING `solid:rock2 (rock2@48,96)` (tree also on the frontier) | REFUSED **ITEM-GATE** `burn burnabletree@48,64` | 11 → 12 |
| 62 | L24 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@32,128)` | REFUSED **ITEM-GATE** `burn burnabletree@32,128` | 11 → 11 |
| 72 | L37 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@128,192)` | REFUSED **ITEM-GATE** `burn burnabletree@128,192` | 45 → 42 |
| **93** | L24 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@32,128)` | **SOLVED 124 t** | 16 → 175 |
| 101 | L37 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@128,192)` | REFUSED VERB-MISSING `proximity-hazard:watcher (watcher@104,264)`, after the burn (the planner now starts from tile (10,12), past the tree) | 47 → 947 |
| **102** | L44 | REFUSED VERB-MISSING `solid:burnabletree (burnabletree@48,64)` | **SOLVED 212 t** | 12 → 240 |

**Totals:** 142 / 121 / 2 → **144 SOLVED / 119 REFUSED / 2 TIMEOUT** (84 and 94, unchanged at ~120 s). The other 257 rows are identical in verdict, ticks and refusal text.

**The new first refusal past 2.2** (2.2 is step 88, the Bob Boss): **step 95, L37** — *"no corridor for goal reach-exit toward (296,8) in level 37. Obstacle: proximity-hazard:watcher (watcher@104,264) … No strategy row exists for this obstacle."* (VERB-MISSING). It refused the same way at the base. Step 94 (L12) is a TIMEOUT at both ends, so it is the first non-SOLVED row past 2.2. The watcher is now the obstacle that blocks both 95 and 101.

## D3 — records (PASS)

| Row | W0 (`0aab89b`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`, byte-identical** (`diff` of the two logs is empty). The block started at `52b279f`; `c704a34` (the known-verb list, read only by `summarizeTrace`) landed while it ran | **none** |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none: no committed walk or certification meets a `burnabletree` frontier (the encounter's burn leg in `r9-solve-32` picks the same stance through the hoist) |
| tapeRunner | 469, md5 `1999093a…` | **473**, md5 `699749b0…`; the 469 old `(name, status)` pairs are **identical** (`diff` adds 4 lines only) | +4: `burn-l24-reach-exit` and `burn-l44-reach-exit`, a differential row and a stepping row each |
| roster | 206 | **208** (`generate-tape-index.mjs`) | `burn-l24-reach-exit`, `burn-l44-reach-exit` |
| solver surface | GREEN 194 | **GREEN 195** (`--write`, classify, `--check`) | + `import:presses.js#auditFire`, classified `seedling` / `geometry-query`; the door (`solverView.js`) re-exports it; the rest is site-count drift (`run:*`, `world:burnableTrees/pitTiles/teleporters`, `state:*`) |
| constants | PASS 4,966 | **PASS 4,966** (`--profile-rows` → `--write` → `--check`, no file changed) | none |
| profile / entities | 138 / 518 | **138 / 518** | none (no new entity family: `burnedTrees` and `treeBurns` existed) |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; both new instruments pass `check-procgen-help --in-place --only=…` | instruments **336 → 338**; the docs index (the log entry) |
| bounded vitest | 38 files / 1,887, 1 red (`rosterCategories:175`, 144 vs 146) | **47 files / 2,398 tests, 2,397 green, 1 red**: `rosterCategories:175`, *"expected 144 to be 148"* | + `fidelityBurn` (14 at that run; 16 after the D3 trace row, green with `decisionTrace`: 41/41) and the 8 `procgenDocs` test files |
| `boxLock`, `lintGateLabels`, `entityBlocks`, `decisionTrace`, `shoveWeighParity`, `watchGenOverlay`, `jsRuntimeDeclarations` | green | **green** | `probe-seedling-burn-write.mjs` joins `boxLock.test`'s `guarded` list (static `playwright` import, the take inside `main()` behind `isEntryPoint`) |

**Pins** (unions, added by name):
- `tapeEnvelope` and `observationTolerance` (incl. `swapped`): 206 → 208.
- `dialogueAutoAdvance`: 206 → 208, inert 205 → 207.
- `R8_ENEMY_BRIDGE.exposedAdded` + `burn-l24-reach-exit`: levels [12], 1 chaser. Its last tick is L12's arrival, a bridged room with `puncher@416,256`. Its test mirrors follow (the declared list, the measured list (exposed 46 → 47), the right-name fixture). `burn-l44-reach-exit` visits no bridged room.
- `R8_STRATEGY_EXECUTORS.executorDerivations.burn`: five derivation rows (the gate, the stance, the lean, the slot, the press and wait). Without it, `assertExecutorParametersAreDerived` throws.

**`surveyFamily`** gains **ITEM-GATE**: `-> <verb>: <id> cannot be <…> by this run — `, asked before the VERB rows. Its witnesses are the five burn rows above and three `break` rows (252, 257, 261), which read `unclassified` at the base. `surveyFamily.test.js` has two new expectations.

**`seedling-bot-log.md`**: `### Seedling fidelity BURN — the tree as a reach-exit obstacle`, after F7, with three trap candidates:
1. the fire radius's transcribed origin decides stances (the lean);
2. a verb that switches the weapon must switch it back;
3. registering a verb reorders a frontier.

## For the rules arc (measured; no rules edit)

**AP_1's region graph routes three Fire-gated crossings as free:**
- **L24 → L12:** `level_24 → level_12__r40c4` is `True_` (both exits). In the atlas, **both** L24 teleporters to L12 (`@32,144`, `@48,144`) are inside `burnabletree@32,128`'s 32x32 solid. The room has no other way to L12, so the crossing needs Fire. Step 62 (leg 1.6, before Fire) is routed through it.
- **L44:** `level_44__r4c2` holds the L87 arrival (`teleporter@0,80`, arrival (16,80)) and the L37 exit (`teleporter@144,128`), and the rule between them is `True_`. In the model, `burnabletree@48,64` separates (1,5) from (9,8): *"different connected components"*. AP's only Fire rule in L44 is r0c4 ↔ r4c2 (`Fire` or `Progressive Swim`). Steps 30 and 34 are routed through it.
- **L37:** the r0c18 exits (L44, L12 r0c37, L38) are `True_`, while the model puts `burnabletree@128,192` between the L38 arrival and the L12/L44 exits (step 72).

Either the sub-room regions miss the tree, or the game has a path the model does not. A game witness of the Fire-less refusal would settle it, and that is the rules arc's to take.

## The JS arc's pins at my head

**None moved.** `jsRuntime*` (10 files), `solverDeadline`, `wasmArrival`, `wasmArrivalComposite` and `wasmWalkTape` are 14 files / 197 tests, all green. No JS-arc file was edited.

**What they gain:**
- A `reach-exit` whose frontier is a `burnabletree` now solves when the run holds Fire.
- The solve's `out.equips` can then carry **two** slot selections, Fire's and the old one back. A caller that folds `perTick` into a tape must apply `equips`, as swim U5 already requires.
- Without Fire, the refusal names the item.

## What the brief got wrong (measured)

1. **"265 steps: 140 SOLVE / 120 REFUSED / 5 TIMEOUT."** At `0aab89b` the survey reads **142 / 121 / 2** (TIMEOUTs 84 and 94). The six refusals and their words reproduce exactly.
2. **"step 93 … holding Fire/Shield/Torch + keys 0–1" is the first refusal past 2.2, and the class "refuses at steps 30, 62/93, 72/101, 102".** Only **93, 101 and 102** hold Fire. **30, 62 and 72 do not**, so the verb cannot solve them, and they now refuse by the true name (needs Fire). AP_1 routes them through the trees without Fire (above).
3. **"`burnStanceFor` … HOISTING".** `burnStanceFor` alone could not serve a corridor tree:
   - it tests the rect overlap only, so it admits cells the game's 16 px radius (with its transcribed `originY`) cuts;
   - it scans a fixed 12x12 room;
   - it asks nothing about reachability.

   What was hoisted is its candidate scan (`burnStanceCandidates`, with the encounter's pick unchanged). The obstacle verb adds the audit, the window, the lean and `stanceReaches`.
4. **"`runFire` … reuse unchanged".** Its gone-check refused a teleporter under the burned tree (*"STILL BLOCKED by teleporter"*). It needed `fire.overExit`, the `overPit` declaration's twin.
5. **"Register it the way … `KNOWN_STRATEGY_VERBS`".** `KNOWN_STRATEGY_VERBS` is `decisionTrace`'s report-only vocabulary, not the registry; it was extended anyway (above). The registry the solver reads is `OBSTACLE_STRATEGIES` + `STRATEGY_EXECUTORS`. A third table the brief does not name is required: `r8Acceptance`'s `executorDerivations`, which **throws** for a registered verb without a row.
6. **"⚠ `entityBlocks` for a new entity family".** No new family: `burnedTrees` (entities) and `treeBurns` (ledger) already existed. Profile 138 and entities 518 are unchanged.
7. **"A second witness for another tree if the rule differs by tree (L44/L37)."** The rule is the same Fire gate for every tree. The stance geometry differs (L24 leans, L44 does not), so L44 is the second witness. L37's tree was already game-witnessed (`r5-l37-burn`).

## Residue

1. **The frontier's registered-first sort now names a tree a Fire-less run cannot burn** ahead of other obstacles: step 32's keyed `bosslock@416,240`, and step 34's unregistered `rock2@48,96`. Both rows are still refusals with true words, but the subject moved. `break` has the same property for a swordless run. Demoting a `held: false` resolution to a wall in that sort would change it. Measured: no step that solved at the base refuses now (both movers refused before too).
2. **`runFire`'s stray check reads the whole run's `treeBurns` ledger.** A second burn in the same visit would read the first as a stray. No route step burns twice in a visit; this is unmeasured.
3. **The Fire Wand (case 5) is refused by the model** (`weaponForPress`), so a route that holds the fusion (from step 256, L109) cannot burn. This is named in the refusal.
4. **The watcher** (`proximity-hazard:watcher`, L37 `watcher@104,264`) is the next VERB-MISSING past 2.2 (steps 95, 101).
5. **The AP-rules findings above** belong to the rules arc.
6. **`rosterCategories:175`**: the composite standing value, 144 at the base (F7 already owed +2), **148 at my head** (+2 burn tapes). `standing-values --write` is not licensed here, so the coordinator banks it.

## Byte-inertia

- **No committed tape, expectation, trace or declaration moved.**
  - Added: two tapes, their two game expectations, `fixtures/burn-write-oracle.json` (md5 `7ee5a141…`), and the regenerated `index.json` (+2 rows).
  - tapes `bd3da7d5…` / `c53ab7e2…`; expectations `9c8d9e85…` / `6c3eb286…`.
- **Not touched:**
  - `campaign-frontier.json`;
  - the AS3, the wasm and every gitlink;
  - the AP rules;
  - the JS arc's files (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker);
  - `solveSegment`'s prefix admission and the contracts of `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`;
  - the STEP-OFF regions (`levelRun` transitions, the solver's arrival/exit handling) and the L14 harvest's `climbLadder` rung;
  - SF's deadline sites.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was copy → edit → run → copy back, md5-checked.
- **Box:** the recording and the probe ran while nothing else held the box. The AFTER identity block ran on this tree at the final code (the docs commit was in place first, so its reference row reads the regenerated docs).
- **Tree dirt:** the survey writes `.cache/seedling-survey/` (gitignored). `git status` after the AFTER block shows nothing untracked but this report. Scratch (`/tmp/burn/`, not committed): the prototype copy, the staging/map/compare scripts, both identity logs, both survey JSONs (and the three mutant surveys), the vitest JSONs.

## The identity rows the coordinator must BANK

- identity log md5: BEFORE **`aa46950b5958b32136111155250dd253`**; AFTER **`aa46950b5958b32136111155250dd253`**, byte-identical (head)
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90` BEFORE = AFTER, all exit 0
- counts (movers, not digests): tapeRunner **473** (pairs md5 `699749b09d6931cbaf5a171a89089034`), roster **208**, surface **GREEN 195**, constants **PASS 4,966**, instruments **338**, entities 518, profile 138
- **`rosterCategories:175`**: the composite standing row, 144 vs **148** at the head (+2 F7 tapes, +2 BURN tapes). Re-seal with `standing-values --write` when banking.
- the route survey (`--through=end`): **144 / 119 / 2**; the new first refusal past 2.2 is **step 95 (L37, `watcher@104,264`)**.
