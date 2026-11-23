# Cloud report: `seedling-fidelity-p4hport`: the JS model on the p4h build

One slice of the Seedling model-fidelity arc (planner `seedling-fidelity-planning-23`). ⚖ GO: Robert, 2026-11-22T23:40Z.

- **Start:** `e53aea23be3291b47c327ac16d2a4f6c6c4478f2` (P1, `seedling-p4h-beside`; wasm gitlink `a3352067`, not touched).
- **Harness branch:** `claude/seedling-js-p4h-port-0bnbbr`. There was no re-merge or rebase.
- **Commits:** `18ae2e27` port · `108eec2a` tests and Owl fixtures · `c3d94f9e` the carried page generator, census and surface · `06fbefdd` the TB plans (**the last code head**) · this report.
- **Verdict: PASS on the bossdraws port, STOP on the solid chest** (§D1.2). p4g is byte-identical. The p4h reds are measured and listed below (§D3). None is committed red.

## Answer table

| question | answer |
|---|---|
| The model asks the build | `modelBuild.js`: `declaresBossDraws(capabilities)`. `null` means the default build's list (`P4G_CAPABILITIES`, pinned equal to `builds.json`'s `role: default` row). `createLevelRun({capabilities})` and `createRunForStaging(…, {capabilities})` take it. No tape field reaches it |
| The 9 sites on `bossdraws` | `finalBossRng.OwlPatternStream` (5 site families) and `tentacleBeast.TentaclePatternStream` (2 site pairs), plus the patch's `break`. Every value equals the AS3 formula, evaluated independently in `fidelityP4hPort.test.js` |
| Every entry the same fight | **MODEL YES.** (a) An L112 walk-in from L111 (seed 7, `worldEntries` 1) plays the boot-room fight (seed 101) for 600 ticks, row for row. p4g refuses the same walk-in. (b) An L57 death rebuild restarts the beast: two drowns exactly one period apart (216 t), and the second build spawns the first build's candidates |
| p4g byte-inert | `batch-seedling-acceptance` md5 `391322d681b7aa0229d94b3f6906d024` at the base, at the head, **and at the head asked as p4h**. The fixture diff lists only the 5 new p4h files. The p4g battery is green (1598/1598) |
| A plans | `det-owl-{sword,spear}-A.json`: 0 hits, `112:0`+`112:1`, L113, the same fight on two seeds (2227 / 2200 t). On p4g they die in lava (t483 / t499) and refuse |
| L57 Sword | Pit / door / s2: **1491 / 1149 / 1491 t, 0 hits, `57:0`, L58, the same keys on two seeds**. This is rules-12's own numbers, reproduced on the committed model, not the scratch copy. They are emitted as the new fixtures `p4h-tb-plans/*` |
| Solid AP chest | **STOP** (§D1.2): the p4h AS3 is not reachable from here. Also, on this base no delivered set carries `kind="chest"`, so every AP location is still an APItem on p4h too |
| Hitless leg → hit-taking? | **No shipped leg flips.** Seed-1 acceptance is identical on p4h. The p4g TB witness TAPES do become hit-taking on p4h (below). They are p4g artifacts, and the p4h re-plans are hitless |

## D1. The AS3 and the model

### D1.1 The 9 sites (option A)

⚠ **The p4h AS3 is not fetchable here.** `builds.json`'s p4h `source` names `PeerInfinity/Seedling` `p4h-as3` @`169247c4c4ca0d1958b95c6ebe2d5f43f7ca9692`, and that is the commit to cite. `git ls-remote` does not list `p4h-as3`, and `git fetch origin 169247c4c4…` answers `not our ref`. `builds.json` says the boss draws are commit `0ea17b675a` "(a) … option A at all 9 sites". P1's `0451516252` is commit (b), the APChest. So the cites below are the **rules-12 patch applied to `ccdf189776`** (`git apply` is clean; `ev/patches/deterministic-boss-draws.patch`). That is the content `0ea17b675a` is described as. A byte comparison is UNVERIFIED, and the planner's local witness pass is the check.

| # | site (file:line, patched) | formula | counter: what it counts · where it resets |
|---|---|---|---|
| 1 | `FinalBoss.as:144` barrage | `rockfallTime % rockFrequency == 0` (6, `:138`) on the ALREADY-decremented time (`:136 rockfallTime--`) | `rockfallTime` 239…0 · set to 240 at the pod snap `:182`. So ticks 6, 12 … 240 drop a rock: exactly 40 |
| 2–3 | `FinalBoss.as:146-147` aim x, y | `p.x + p.v.x·stepsAhead + vdc(rockIndex,2)·radius·2 − radius`, and y with base 3 (`stepsAhead` −15, `radius` 20, `:139-140`) | `rockIndex` (field `:38`): `++` before the rock (the first rock is 1) · reset `:183` at the pod snap |
| 4 | `:147` → `RockFall.as:25,33` scale (the HIT box `:37` `32s × 16s`, int) | `vdc(rockIndex,5)/2 + 0.25` | the same `rockIndex` |
| 5 | `FinalBoss.as:161-162` grenade | `walkTicks++` then `walkTicks % 40 == 0`, inside `else if (v.length <= moveSpeed)` (so coast ticks do not count) | `walkTicks` (field `:39`), walk ticks of this leg · reset `:184` at the pod snap |
| 6–10 | `FinalBoss.as:222` 5 death rocks | x `120 + (i + 0.5)/n·8 − 4` → int 116, 118, 120, 121, 123; scale `vdc(i+1,5)/2 + 0.25` | the loop's `i` (0…4) |
| 11–12 | `TentacleBeast.as:140-142` whirlpool x, y; `:162` the `break` | `vdc(whirlIndex,2/3)·(rect − margins) + rect + margin` | `whirlIndex` (field `:33`), one per whirlpool candidate · per build (a new `TentacleBeast`) |
| 13–14 | `TentacleBeast.as:174-176` tentacle x, y | the same with `tentacleIndex` and the tentacle margins | `tentacleIndex` (field `:34`), one per tentacle candidate (passing or not) · per build |

`Pattern.vdc` is `src/Pattern.as` (new): `r += (n % b)·f; n = int(n/b); f /= b`. All four counters are instance fields, and `Game.loadlevel` builds a new boss on every entry, including a death's `restartLevel()`. So **every build is the same fight**. `Enemy.coins` still draws `Math.random()` (the boss's build, each grenade, the beast, each tentacle) and decides nothing.

### D1.2 The solid AP chest: STOP

The obstacle, exactly:

1. **The source is unreadable here.** `Pickups/APChest.as` is commit `0451516252` on the same unpublished `p4h-as3`. The only reading available is `claude/ap-chests-solid-below-gjlzor`'s report, whose session fetched it. That report gives `:57 type="Solid"`, `:58 setHitbox(16,16,8,8)`, `:75` opening on the line under it while `!collide("Solid")`, `:89 type=""`, `:92 setPersistence(tag,false)`, `:66-68 check()`, `:104` the fade, and `Cover.as:58`. It also says there is no SealPiece, no checkBySeal and no Rng draw. Several things are not in it, and they decide the model: whether opening freezes, how many frames the fade takes, and what blocks enemies, rocks, pushables and wand shots. The brief asks for cites from the AS3 itself, so I did not port from a second-hand reading.
2. **On this base nothing reaches it.** `apPlacementRewriter.apItemAttrs` writes `{tag, look}`. The `kind="chest"` emitter lives on `claude/ap-chests-solid-below-gjlzor` (not merged; the "rules chest slice"). So on p4h every delivered location is still `Pickups/APItem`, as `apChestRoster.js` says. The survey's `deliveredChestDocument` also writes no `kind`. **No walk on this base crosses an APChest.** The rooms with chest locations are the ledger's 16 (`R7_GOAL_LEDGER` kind `chest`). The chest slice found movers on L11, L25 and L38; L80 and L63 re-key with no route moving.
3. **The port, for when the source is in hand** (a hand-over):
   - `levelWorld` maps an `apitem` with `attrs.kind === 'chest'` on `apchest` to the `chest` row's geometry (Solid 16×16, the probe line under it);
   - `chest.js` gains an `ap` variant: no SealPiece, no seal draw, no `checkBySeal`, and the open writes the AP tag;
   - on p4g the attribute stays ignored.

### D1.3 The model map

- **Owl.** `levelRun.owlStreamFor(n)` builds `OwlDrawStream` (`finalBossRng.js`), behind `assertOwlStreamPremises` and the boot-room / re-entry refusal (the throw names "would open in level …"). The stream is stepped by `stepFinalBoss` (`finalBossFight.js`: `barrageRoll`, `spawnX`/`spawnY`/`rockScale`, `grenadeRoll`/`enemyCoins`) and by levelRun's death arm (`deathRockX`, `rockScale`). The per-tick `owlTickDraws(phase)` assertion follows `stepOwlNow`. The death in L112 is refused separately (the "the player died … the Owl's room" throw).
- **Standalone room.** `createOwlRoom` / `stepOwlRoom` is the unit model.
- **TB.** `levelRun.tentacleFightFor` builds the fight, with `TentacleDrawStream` only on a valid seed. It carries the stream across rebuilds in `tentacleStreams`. `streamRefusal` (two sites) calls `tentacleStreamRefusal`, and `tentacleBeast.spawn` draws.
- **AP item.** An AP item at a chest location is `levelWorld`'s `apitem` row (an 8×8 overlap pickup, `world.apItems`). The solver resolves it as strategy `apitem`; `apChestDelivery.js` is the survey's substitution.

### D1.4 The design: how the build reaches each caller

| caller | how | default |
|---|---|---|
| `levelRun` | `createLevelRun({capabilities})` | `null` → p4g |
| tape replayer | `createRunForStaging(staging, src, {capabilities})` (new third-argument field, beside `scratchPersistence`) | p4g |
| solver worker / `solverBot` forks | they build runs through `createRunForStaging` with no capabilities → p4g. **Hand-over (JS arc):** pass the page build's manifest `capabilities` | p4g |
| route survey, acceptance batch, `botDriverV2` | they name no build → p4g | p4g |
| measurement only | `modelBuild.setModelBuildDefault(caps)` returns its restore. The D3 runs used it from an uncommitted vitest setup file and a `node --import` preload | — |

On `bossdraws`:

- **Owl.** One `OwlPatternStream` per BUILD of L112, keyed on the build's `finalBossStates` map. There is no premise, no boot-room or re-entry refusal, and no death refusal. The stream books the same sites in the same ledger, so `owlTickDraws` still holds tick for tick.
- **TB.** `TentaclePatternStream` per build, with no stream carry. `streamRefusal` is null.
- **The page generator.** It still turns for `Enemy.coins`, and it is kept apart from the patterns. Where p4g's seed premises hold (boot room, split, seed, only this room built), it is carried across builds and booked there, so `owlStreamState` / `rngState` stay the game's. Otherwise it is `null`; no gameplay reads it.
- Measured: on the p4g TB witnesses, the model's generator column now matches the game up to each fight's first spawn (where p4g starts drawing candidates).

## D2. The port, the rows, the mutants

### Files

- `modelBuild.js` (new).
- `finalBossRng.js`: `vdc`, `OwlPatternStream`, `owlStreamForBuild`. `OWL_DRAW_SITES` stays the ledger.
- `finalBossFight.js`:
  - `barrageRoll(b.rockfallTime)`, which the seeded stream ignores;
  - `stream.podSnap?.()` at the snap;
  - `createOwlRoom({bossDraws})`.
- `tentacleBeast.js`: `TentaclePatternStream`, the `break` (only on a pattern stream), and `createTentacleBeastFight({bossDraws, generator})`.
- `levelRun.js`: the `capabilities` option, the per-build Owl stream, no TB carry on bossdraws, the page generator carry, and the death refusal gated.
- `tapeRunner.js`: the pass-through.
- ⛔ Not touched: `solverBot.js`, `tentacleBeastPolicy.js`, and `wandShotBlockerAt`, which my change does not reach.

### `fidelityP4hPort.test.js` (fast tier, 20 rows)

- the build gate: the default equals the manifest's, and the measurement swap restores;
- each Owl site family against a hand-written `vdc` and the cited constants: barrage, aim and scale with the pod-snap reset, grenade per leg, death rocks;
- the ledger and the generator;
- the TB Halton points, the fight's first spawn, and the `break` (1 try against the shipped 101);
- the L112 walk-in, the L57 rebuild and the carried generator;
- the two Owl A plans and the three L57 plans, each on two seeds.

**New fixtures** (model-made or copied, nothing re-recorded):

- `fixtures/p4h-owl-plans/det-owl-{sword,spear}-A.json`, copied unchanged from rules-12 `ev/tapes/`;
- `fixtures/p4h-tb-plans/tb-hitless-{pit,door,s2}-p4h.json`: the solver's own TB verb asked as p4h at each witness's staging, emitted open-loop.

### Mutants (predicted, then shown; copy and restore, the tree clean after each)

| mutant | predicted | red |
|---|---|---|
| M1 barrage `=== 1` | barrage row + plans | barrage, sword-A, spear-A |
| M2 aim x base 3 | aim row + a plan | aim, spear-A |
| M3 scale base 3 | aim/scale + death rows | both |
| M4 no `walkTicks` reset | grenade row | grenade |
| M5 death x `i` for `i + 0.5` | death row | death |
| M6 TB `break` removed | break row | break |
| M7 whirl y base 5 | Halton + spawn rows | both |
| M8 levelRun bossdraws arm off | walk-in + plans | walk-in, both plans |
| M9 TB stream carried on bossdraws | rebuild row | rebuild |

There is no chest mutant: the chest is a STOP.

## D3. The measurement

### p4g byte-inertia

- `git diff --name-only e53aea23 HEAD | grep -aE 'fixtures/|golden|tapes/'` lists only the 5 new p4h files.
- The acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base and at the head. Asked as p4h it is the same bytes: **no seed-1 acceptance leg moves on p4h**.

### Committed tapes, p4g against p4h

Each tape was replayed by the model as p4g and as p4h. All 293 tapes under `fixtures/tapes` and every tape embedded in a `fixtures/*/` witness file (279) were screened. Only the ones visiting L57/L112 can move.

| tape | p4g (as committed) | p4h model |
|---|---|---|
| `tapes/r6-owl-control` | 727 t, 1 hit (`owlBody` t709) | **same verdict, hit and end**. The fight differs: 80 rocks against 88, and the generator is 754974726 against 377488969 |
| `tapes/r6-owl-kill` | 816 t, kill, 0 hits | **same verdict** (kill, 0 hits, same end position). 80 rocks against 88; 3 grenades against 1 |
| `tb-death-s3` | 3 hits, 1 death | 1 hit, 1 death |
| `tb-enter-cleared` | built dead | same |
| `tb-hitless-door` / `-pit` / `-s2` | 0 hits, L58 | **3 hits, 1 death, stays in L57** |
| `tb-idle-s1` | 1 hit | 1 hit, 1 death |
| `tb-policy-s2` | 1 hit | 3 hits, 1 death |
| `tb-solve-s2` | 1 hit, L58 | 3 hits, 1 death, L57 |
| `whirlpool-witness/whirlpool-drown-s15` | 1 hit, 1 death | 15 hits, 5 deaths |
| `p4h-owl-plans/*` (new) | lava death, refused at t483 / t499 | 0 hits, kill, L113 |

### The re-record list (measured on p4h; NOTHING re-recorded)

Run as p4h (the uncommitted setup file) over 28 files: **28 rows red in 4 files**. All else is green, including `finalBossRng`, `finalBossFight`, `fidelityShakeExact`, `seedlingOwlIntro`, `fidelityDarkSuitBosses`, `jsRuntimeBossWiring`, `r6Acceptance`, `r8Acceptance`, `levelRun*`, `tapeRunner` and `seedlingDivergenceLegs`.

**`fidelityTentacleBeast.test.js`: 17 of 37 red** (the brief expected 20; rules-12's scratch copy also carried the solverBot/policy hunks).

- The 7 game-witness rows (`tb-death-s3`, `-hitless-door/pit/s2`, `-idle-s1`, `-policy-s2`, `-solve-s2`):
  - why: the p4g witness's tentacles differ from the first spawn tick (t47 or t137), and the generator differs there too;
  - new value: a p4h game recording.
- Solver ON (hitless true): 1850 → **1491**.
- Solver ON (hitless false): 1047 → **1325**.
- "ON, unsplit refuses": **no refusal** on p4h, because there is no premise.
- bossfork D1b `from t789`: the beast is still `under` at t789.
- HITLESS seed 2: OFF gives 1325 t with no swipe, against 1047 t with `393:tentacle`.
- seed 7: no variant drowns.
- door seed 35: hitless, against `fewest-hits`.
- HITLESS D2 re-plans: pit 1389 → **1491**, door 977 → **1149**, s2 1850 → **1491**.

**`fidelityOwlSuit.test.js`: 2 red.**

- "the pod snap": the off run's Owl log is 440 rows long, not 424. The snap tick moves with the pattern's rocks.
- "a rock-spawn tick: OFF refuses": the staged tick is no rock tick on p4h, so nothing throws.
- Both stagings must be re-chosen on the p4h schedule.

**`fidelityResidue.test.js`: 6 red** (the seed-15 L57 drown family).

- whirlpool#78 at (107,116) no longer exists: one whirlpool remains;
- the WAIT disc: `[]`;
- "OFF throws the drown": there is no throw;
- "ON solves": 2416 → **1071** t, L58, 0 hits;
- the game-witness row: tentacles differ at t47;
- "OFF refuses at t2183": no refusal.

**`seedlingSoundCues.test.js`: 3 red.**

- The `r6-owl-kill` cue golden: 91 cue ticks against 97 (fewer rock landings).
- `sound-cue-goldens/tentaclebeast-witness__tb-policy-s2.txt`: 48 against 56.
- "the Tentacled Beast: one wake, one dying…": the dying count is 0, because the player dies first.

**Not red on the model, but re-records owed with the p4h game:**

| file | why |
|---|---|
| `fixtures/owl-rng-oracle.json`, `owl-prefix-oracle.json`, `probe-seedling-r6-owl-{rng,prefix}.mjs` | Their rows test `OwlDrawStream`, which p4g keeps. A p4h game's `rng.state` counts only `coins` |
| `plan-seedling-r6-wowl.mjs` | It plans per seed |
| `dead-frame-observations.json` Owl rows | No row red. Re-observe only if the p4h r6-owl re-record moves a freeze |
| `r6Acceptance.GAMEPLAY_DRAW_CONSUMERS` | Green. Its text ("1 draw/tick while walking") is p4g's; a p4h row is owed when p4h is the default |
| the constants CSVs | Regenerated here: new rows appended; one row re-keyed because `createOwlRoom` gained a parameter; one rule row retired by `--write`, named in `c3d94f9e`. This is not a fixture |
| `surveyGrants.stagedRng`'s L57 premise comment | Still true for p4g |

### The witness table (for the planner's local pass)

| witness file | tape to record on p4h | tool | the model's predicted p4h verdict |
|---|---|---|---|
| `tentaclebeast-witness/tb-hitless-pit.json` | `fixtures/p4h-tb-plans/tb-hitless-pit-p4h.json` | `probe-seedling-bosskills.mjs` | 1491 t, 0 hits, `57:0`, L58 |
| `…/tb-hitless-door.json` | `p4h-tb-plans/tb-hitless-door-p4h.json` | `probe-seedling-bosskills.mjs` | 1149 t, 0 hits, `57:0`, L58 |
| `…/tb-hitless-s2.json` | `p4h-tb-plans/tb-hitless-s2-p4h.json` | `probe-seedling-bosskills.mjs` | 1491 t, 0 hits, `57:0`, L58 |
| `…/tb-solve-s2.json` | its own tape (hitless off) | `probe-seedling-bosskills.mjs` | 3 hits, 1 death, L57 (re-plan: 1325 t, 0 hits, L58) |
| `…/tb-policy-s2.json` and the `tb-policy-s2` cue golden | its own tape | `probe-seedling-bosskills.mjs` | 3 hits, 1 death |
| `…/tb-death-s3.json` | its own tape | `probe-seedling-bosskills.mjs` | 1 hit, 1 death |
| `…/tb-idle-s1.json` | its own tape | `probe-seedling-bosskills.mjs` | 1 hit, 1 death |
| `…/tb-enter-cleared.json` | its own tape | `probe-seedling-bosskills.mjs` | unchanged (built dead) |
| `whirlpool-witness/whirlpool-drown-s15.json` | its own tape | its probe (`fidelityResidue` D-B) | 15 hits, 5 deaths |
| r6-owl-control / r6-owl-kill and their oracles | `tapes/r6-owl-{control,kill}.json` | `judge.mjs` (rules-12 `ev/tools/`) | control 727 t, 1 hit at t709; kill 0 hits, both flags |
| (new) Owl A | `fixtures/p4h-owl-plans/det-owl-{sword,spear}-A.json` | `judge.mjs` | 0 hits, `112:0`+`112:1`, L113 (2227 / 2200 t), on two seeds |

### The census

- **Seed-1 legs.** The acceptance batch is the same bytes on p4h. The committed campaign route fixtures name neither L57 nor L112. So no seed-1 leg in it fights there, and none turns hit-taking.
- **Survey steps.** Step 234 (L112) is `ENCOUNTER-GATE (rocklock@112,16)`: `solverBot` has no Owl executor. The "L112 skip" is therefore a missing solver verb (hammer's), not the stream, and this port does not lift it.
- **L57 survey steps on p4h: NOT MEASURED.** I did not run the route survey (hours). The L57 verb's plans on p4h are the three rows above.
- **AP chest crossings: none on this base** (§D1.2).

## What the brief got wrong (measured)

- **The AS3.** The p4h AS3 cannot be read: `p4h-as3` / `169247c4c4` is not on the remote. `0451516252` is the APChest commit, and the boss draws are `0ea17b675a`.
- **`fidelityTentacleBeast` reds.** 17 of 37, not 20.
- **`finalBossRng.test.js` / `finalBossFight.test.js`.** They do not go red: they test p4g's `OwlDrawStream`, which stays. The p4h rows sit beside them.
- **The survey's L112 skip.** It is not a stream refusal (above).
- **The r6-owl tapes.** They keep their verdicts on p4h.
- **The "seed premises" do not simply go away.** `Enemy.coins` still turns the page LFSR at p4h. So the model keeps a carried generator for the `state` readout. Without it, a p4h TB re-record's generator column could never match.

## Hand-overs

- **Hammer** (`seedling-hammer-phase-planning-13`). The Spear and Wand verbs for L57:
  - the resolver accepts no Spear;
  - the policy's press gap (7) falls inside the Spear's 11-tick window;
  - there is no Wand arm.
  - The Owl executor (step 234) is also hammer's.
  - The solver-dependent rows above (the HITLESS re-plans) are hammer's to re-pin on p4h.
- **The JS arc.** The solver worker and the page should pass the page build's manifest `capabilities` into `createRunForStaging` / `createLevelRun`. Until then every page answers p4g.
- **Rules** (the chest logic slice). The `kind="chest"` emitter, then the chest port in §D1.2.3 once `APChest.as` is readable.
- **P2 (the default flip).** Change `modelBuild.P4G_CAPABILITIES` and the default row together; the row in `fidelityP4hPort` pins them equal.

## Gates

- **Bounded vitest before** (the base, 25 files): 907/907.
- **Bounded vitest after** (28 files: the brief's list, every `grep -a -l` hit, `tapeRunner`, and the new file): **1598/1598 green on p4g**.
- **Generators and checks:**
  - `ci-producer-checks.mjs --jobs=3`: 99 run, 0 red, 1 skipped (`plan-seedling-r7-ends-meet`, a browser check);
  - `check-procgen-docs.mjs`: ALL CHECKS PASSED;
  - `generate-procgen-reference.mjs --check`: 7 modules and 5 regions match;
  - the constants census `--check`: PASS (after `--write` and `--profile-rows`);
  - the solver surface `--check`: GREEN, 374 rows.
- **CI.** The `JavaScript Unit Tests` push run 45087521252 at `06fbefdd` (the last code head) is **GREEN**: the unfiltered vitest suite passed 29752, skipped 0 and failed 0 (shards 1–3 all `success`); the slow tier passed 438 and failed 0.
- **For the planner (I cannot dispatch, 403).** `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-js-p4h-port-0bnbbr -f train_only=true` at `06fbefdd`. The slice touches `levelRun`, `tentacleBeast` and the fidelity models, so the train tier's solverBot hammer/fidelity pins should be quoted.

## Residue

- **The chest:** a STOP (§D1.2).
- **L57 survey steps on p4h:** not measured.
- **Byte comparison:** UNVERIFIED between `0ea17b675a` and the rules-12 patch.
- **`owlPageRng` across a walk-out and a walk back in:** it is reset to null when the premises fail, and that is honest. A p4h game witness of a death rebuild in L112 would pin the carried generator there; none exists.
