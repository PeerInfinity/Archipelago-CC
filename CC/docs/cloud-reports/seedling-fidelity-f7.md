# Seedling fidelity F7: a latched publisher re-publishes on re-entry (the rope) + the apitem take writes its clear

**Slice:** `seedling-fidelity-f7`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`, its first launch).

⚖ **The standard** (the user, 2026-10-03): *"… the solver to be able to handle either state … and to have a way to know which state it's in. I don't want it to have to clear the save, and I don't want it to have to exit and reenter the room in order to solve it."*

| | |
|---|---|
| Started from | `origin/main` @ **`a2d10de28c`** (the p4f rebuild), as briefed |
| Head | see the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-f7-7yyxew` (the harness pins it; `seedling-fidelity-f7` was never created) |
| Commits | D2 `ddf85a5` · D3 **`a63b8cd`** · D4 records `ac4b022` · this report |
| Dev servers | `serve-nocache.py 9190` (this tree), `9191` (the pristine BEFORE worktree `Archipelago-CC-wt-f7-base` @ `a2d10de`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** |

## The one thing to know first

**The return leg `level_16 -> level_15__r1c5` now solves from the L17 arrival: 99 t, walk only, no death.** The fix is a re-publish at build that the game measures. Both witnesses are game-recorded, and the model reproduces them byte for byte. Both controls (without `{16,0}`) take a volley on the game: an unlatched trap fires from L16's first update, while a re-latched one never fires. **So the publish is visible on frame 1, and no one-update credit applies to a `shoot = 1` trap.** That is different from F6's fade, which needed one.

**For the JS arc:** D3 is `a63b8cd`. `run.takeApItem` exists, and the solver's observer calls it.

## W0 (at `a2d10de`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9191 bash scripts/procgen/identity-block.sh .` in a **pristine detached worktree** at `a2d10de` (`scripts/dev/new-worktree.sh --with-wasm f7-base a2d10de`, venv active, its own server) | exit 0, log md5 **`aa46950b5958b32136111155250dd253`** |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** (full digests in the bank section) |
| reference | `generate-procgen-reference.mjs --check` (the block's last row) | ALL 7 + 5 MATCH |
| tapeRunner | inside the bounded vitest | **465/465**; sorted `(fullName, status)` lines md5 `77472b1e…` |
| surface / constants / entities / profile | the four `--check`s, in the worktree | **GREEN 193** · **PASS 4,965** · **PASS 518 leaves** · **PASS 138 keys** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **204** tapes |
| bounded vitest BEFORE | 27 files: `activators`, `arrowTrap`, `dangerMap`, `entityBlocks`, `fallRock`, `fidelityF1/F1b/F1c/F2/F4/F6`, `jsRuntimeDeclarations` (read-only), `levelRun`, `levelWorld`, `pulser`, `ropeSword`, `r5Shaft`, `r5Totem`, `shoveWeighParity`, `solverBot`, `tapeRunner`, `wasmArrival`, `watchGenOverlay`, `boxLock`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface` | **27 files / 1,458 tests, all green** |
| the planner's evidence | `evidence/fidelity-planning-2` (checked out from the scratch branch, never staged): `probe-arm.mjs`, `replay.mjs l16back-{rope,norope}.json` | **reproduced word for word.** Both arms are armed at t0..t3 with `pulledRopes []` and `latchedGroups []`, and both refuse with *"the danger map forbids (120,56) — arrowLane:arrowtrap@112,32 (an ARMED trap's lane …"* |

⚠ The BEFORE block's first launch exited 2 (*"nothing listens on 127.0.0.1:9191"*): it started a moment before its server bound. I re-launched it once the port answered, and the values above are from that run.

## D1 — the census: every latched publisher whose `check()` re-publishes (PASS)

Read from the AS3 first, before any edit. `Game.update`'s first frame runs `check()` on **every** entity, above the `blackCover` gate and before `super.update()` (`Game.as:869-879`). I read every class with a `check()` override, and every `set activate` override, for a publish to `Activators` on that pass.

| class | AS3 | rooms (atlas) | the model before F7 | this slice's arm |
|---|---|---|---|---|
| **`RopeStart`** | `check()` `:31-38` → `hit()` `:40-49` (`if (!activate)`: shrink, `setPersistence(tag,false)`, `activate = true`) → `set activate` `:79-91` (every `Activators` with `t == t`) | **L16** `rope@32,16` t0 → `arrowtrap@96,32/112,32/128,32` (`shoot=1`); **L28** `rope@160,64` t1 → `fallrock@112,240` (tag 1); **L39** `rope@96,384` t6 → `fallrock@144,624` (tag 10), `pulser@64,96` | **geometry only.** The cleared rope built shrunk (`clearedHere2`), but it was not in `pulledRopes` and its group was not latched, so L16's traps were armed | **re-published at build** (D2): pulled set + `latchAtBuild`. L28 and L39: refused by name when the group holds an unfallen rock (below) |
| **`ButtonRoom`** | `check()` `:40-50` `_active = !checkPersistence(tag); activate = _active` → `set activate` `:67-98` (`if (a)`: `room == -1` publishes `persist` to the group; `room >= 0` writes `{room, t}`) | L20 {4}, L38 {0,3,4,5}, L40 {1,7,12}, L61 {1}, L63 {0}, L107 {1} | F6's `bootPress` (latch + the one-update fade credit) | **the same mechanism, confirmed from the source.** `bootPress` now latches through the shared `latchAtBuild`, unchanged in behaviour (F6's rows stay green) |
| `Wand` | `check()` `:43-51` removes itself with `doActions = false`; the group publish is in `removed()` `:53-73`, behind `if (doActions)` | L43 | the in-visit take latches tset 0 (`levelRun`'s wand arm) | **none needed:** a re-entry does NOT re-publish |
| `LightPole` | the constructor's `activate = !checkPersistence(tag)` (`:50`); `set activate` `:94` writes its own tag and its light, with no broadcast | L62–L109 (17 poles, all `tset = -1`) | the pole flag is read from persistence | **not a group publisher** |
| `FallRock` / `FallRockLarge` | the constructor reads its own tag: `y = fallTo`, `type = "Solid"`, `_active = true` (no publish) | L28, L29, L39, L43, L74, … | a cleared rock tag refuses (`REFUSED_CLEAR_RESPONSES.arm`) | a receiver, not a publisher |
| `Button` | no `check()`; `update()` publishes on overlap, every tick | many | `pressedGroups` per tick | not latched |
| `Lock`, `MagicalLock`, `BreakableRock`, `RockLock`, `BossLock`, `FinalDoor`, `BurnableTree` (`die()`: `type = ""`, remove), `Moonrock`, `MoonrockPile`, `Chest`, pickups, `APItem`, `Teleporter` | despawn / appear / trigger | — | their `PERSISTENCE_RESPONSE` rows | none publish to `Activators` at build |

**The ORDER question, measured on the game** (not from reading): is the published group visible to a trap on frame 1, or one update later (F6's offset)?
- `f7-l16-walkin` enters L16 from L17 on t7. Its arrival frame is L16's first `update()`, so a group published one update late would let each trap fire a volley onto the arrival tile. The game's stream equals the model's for all 61 observations, and the game's `hits` reads 0.
- The controls (the same tapes without `{16,0}`) leave the witness **6 rows after the world's first update in both arms**: row 6 for the boot, row 13 = 7 + 6 for the walk-in. So an **unlatched** trap does fire on the arrival frame, and that volley lands 6 rows later. The re-latched trap never fires.
- ⇒ **The publish is visible on frame 1.** The model latches in the activator state's constructor, before its first step, so it matches with no credit. F6's one-update offset concerns state that **accumulates** per update (a fade's alpha, a pulser's phase). A boolean that silences a trap has nothing to accumulate.

## D2 — D-A: the rope re-publishes at build (PASS, game-witnessed)

**The transcription** (`ddf85a5`):
- **`levelWorld`:** the rope solid carries `bootPulled = clearedHere2(…)`, the same predicate as the shrink. It plays the role the presser row's `bootPressed` plays for F6.
- **`activators.latchAtBuild(state, group, world)`:** the ONE latch a build's re-publish takes. It latches, then credits a fade row one update (F6's measured arrival-frame credit), and it never credits a group twice. `bootPress` now calls it, with identical behaviour.
- **`levelRun.publishRopeGroup(n, ropeSolid, act, {atBuild})`:** `pullRope`'s publish tail, hoisted **unchanged**, so the in-visit pull and the re-entry are one body:
  - the latch: `act.latched.set` in-visit, `latchAtBuild` at build;
  - the members whose own `set activate` does more than the latch: the FallRock drop (with its freeze, banked clear and pulser advance) and the snap refusal.
  - **At build, a rock member that has not fallen is refused by name:** *"`rope@…` in level N boots PULLED … `fallrock@…` (tag T) is in that group and has NOT fallen, so the game would drop it at the arrival … Declare both tags or neither."* The game never produces that state: `hit()` → `set activate` → `FallRock.fall()` writes the rock's tag on the pull frame. And the state the game does produce (both tags cleared) is already refused at build by `arm`.
- **`levelRun.bootPulledRopes(n, act)`:** every `bootPulled` rope joins the run's pulled set and goes through `publishRopeGroup(…, {atBuild: true})`.
  - A sword or fire press on it is now `hit()`'s `if (!activate)` no-op ("already pulled").
  - No `ropePulls` row and no banked clear: the tag is already cleared.
- **`levelRun.buildActivatorState(n)`:** the one constructor for both `activatorStateFor` (lazy) and `freshActivatorState` (the world swap), so a boot and a re-entry cannot build two different rooms.
- **`pulledRopeIdsNow`** builds the level's activator state before reading the set. Without that, a `pulledRopes` read ahead of the first activator read reported `[]` (mutant m3).

**The game witnesses** (`plan-seedling-f7-reentry.mjs` authors them from F6's frozen chain-end base `fixtures/witness-bases/r9-solve-32.f6.json`, which carries `{16,0}`; recorded with `check-seedling-bot-differential --record --only=…`, ALL CHECKS PASSED, *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"* on both):

| tape | walk | game | model |
|---|---|---|---|
| `f7-l16-reentry` | boots L16 at (112,48) (the L17 return arrival, in `arrowtrap@112,32`'s lane), stands 30 t, walks left 30 t | 61 obs, `hits` 0, ends (84.75, 56) | equal, 0 px |
| `f7-l16-walkin` | boots L17 at (48,48), steps onto `stairsup@32,48` and enters L16 on t7, then stands in the lane | 61 obs, 1 transition, `hits` 0, ends (114.85, 56) | equal, 0 px |

**The controls** (`probe-seedling-f7-reentry.mjs --record=fixtures/f7-reentry-oracle.json`, ALL CHECKS PASSED; the witness arms are re-played too, 0 px against the recording and against the model):

| arm | `{16,0}` | game | vs the witness |
|---|---|---|---|
| CONTROL-REENTRY | removed | ends (116.75, 56) | leaves it at **row 6**, worst 32 px |
| CONTROL-WALKIN | removed | ends (79.87, 34.15) | leaves it at **row 13** (= arrival 7 + 6), worst 35 px |

⚠ **The model does not replay a control.** An arrow hit shakes the camera, and the model refuses a bob whose on-screen test falls inside the shake band: *"whether bob bob@192,80 is on screen at tick 8 depends on where inside `Game.shake`'s jiggle the camera landed …"* (`camera.js`, "THE SHAKE, AND WHY IT IS A BAND"). So the controls are measured on the game against the witness, and the oracle records the model's refusal text.

**The solver rows** (`fidelityF7.test.js`):

| staging | `level_16 -> level_15__r1c5` (`reach-exit (16,64)`) |
|---|---|
| the chain-end staging at the L17 return arrival (`{16,0}` carried) | **solves: 99 t, verbs `[walk]`, ends in L15, no death** |
| the same arrival WITHOUT `{16,0}` (control) | **still refuses, by the old name:** *"the danger map forbids (120,56) — arrowLane:arrowtrap@112,32 (an ARMED trap's lane …"* |

The planner's own evidence at the head: `replay.mjs l16back-rope.json` gives `ok: true, ticks 99, verbs [walk], endLevel 15, deaths 0` (hash `2782ebeb85`). `l16back-norope.json` is unchanged. `probe-arm.mjs` with the rope: `pulledRopes [rope@32,16]`, `latchedGroups [0]`, armed `[]` at t0..t3.

**Mutants** (each predicted first, made by copy, restored md5-identical: `levelRun.js f8c5bc9a…`, `solverBot.js 1e49071b…`):

| mutant | predicted | measured |
|---|---|---|
| **m1**: `bootPulledRopes` returns at once (the re-publish reverted) | the return-arrival row, the solve row (red with the **old refusal**), the L28/L39 refusal rows, and both witnesses' tapeRunner rows | **8/487 red**, exactly those: the solve row reads *"the danger map forbids (120,56) — arrowLane:arrowtrap@112,32 …"*; both witnesses fail in the model by the shake band (2 rows each: differential + stepping) |
| **m3**: `pulledRopeIdsNow` without the build-first line | the return-arrival row only | **1/18 red**: `expected [] to deeply equal ['rope@32,16']` |

## D3 — D-B: the apitem take writes its clear (PASS)

**The game** (F2's committed bracket, quoted, not re-recorded): `fixtures/f2-apitem-oracle.json`, `seedling_generated_room` has `takenAt` **254**. A `hold` tape of **255** ticks has `persistence_cleared` carrying `{0,0}`, and one of 254 ticks does not. So the clear appears in the world update that follows the take tick's index, i.e. in the game's latch at tape tick `takenAt + 1`.

**The transcription** (`a63b8cd`):
- **`levelRun`: `run.takeApItem({level, id, tag})`.** It banks `APItem.removed()`'s `Game.setPersistence(tag, false)` the way a pickup's is banked:
  - a new `apItemFlags` family in `earnedClears` (`by: "apitem@x,y"`, `t` = the run's tick);
  - `pendingEarnedClears`, which the next build of the level cashes. `apitem` is `'despawn'` (F2), so the room builds without it.
  - A second report of the same take is a no-op, the way `doActions` makes a second `removed()` a no-op.
  - A `tag = -1` take returns `banked: false` and writes nothing, because `APItem` is not a registered out-of-band writer.
  - A take reported in another level than the run's refuses by name.
- **`solverBot`** (the only edit there, inside F2's observer): `inner.takeApItem({level, id, tag})` on the take tick. No ladder, dash, stance or `solveSegment` contract was touched.

**The witness** (`fidelityF7.test.js`, `seedling_generated_room`): take `apitem@64,16` in L0, leave by `teleporter@128,16` for L1, then come back by L1's `teleporter@64,48`. That is two segments on one run; the second declares the first's `perTick` as its `prefix`.
- The take record is `strategy apitem, takenAt 254`.
- Away in L1: `earnedClears = [{level 0, tag 0, by "apitem@64,16", t 255}]` and `bankedClears = [{0,0}]`. **Run t 255 = the game's `takenAt + 1` bracket.**
- Back in L0: **`world.apItems = []`**.

**Mutant m2** (the observer's `takeApItem` call removed): predicted 2 red (the banks row; the revisit row, which then sees the item). **Measured 2/18 red:** `earned []`, and `apItems [{id: 'apitem@64,16', …}]` on the revisit. Restored md5-identical.

## D4 — records (PASS)

**Refusal words, grepped** (`rg -a` over `frontend scripts docs/json CC`): the removed refusal's words (*"the danger map forbids (120,56)"*, `arrowtrap@112,32`, `level_16 -> level_15`) are pinned by **no** test except F7's own control row. `ropeSword.test.js:80/206` pin the in-visit pull's silencing, which is green. `flash.md:398` (the JS arc's prose) says *"every captured live leg but L16 solves in 1.4 s or less"* without dashes. That is a measurement of their captures, not a claim this slice moves, so it was not edited.

**Committed tapes that re-enter a pulled-rope room:** I ran all 204 roster tapes through the model and listed every tape that visits L16, L28 or L39.
- The visitors are `r9-solve-15`, `r9-solve-16`, `r8-hammer-arm` (L16) and the nine `r5-*` L39 tapes. **None declares `{16,0}`, `{28,0}` or `{39,9}`.**
- The 21 tapes that declare `{16,0}` never enter L16.
- ⇒ No committed tape's declaration or inputs move, and the tapeRunner comparison confirms it.

| Row | W0 (`a2d10de`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`, byte-identical** (`diff` of the two logs is empty) | **none** |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none: no committed walk or certification re-enters a pulled-rope room or takes an apitem |
| tapeRunner | 465, md5 `77472b1e…` | **469**; the 465 old `(name, status)` pairs are identical (`diff` adds 4 lines only); md5 `1999093a…` | +4: `f7-l16-reentry` and `f7-l16-walkin`, each a differential row and a stepping row |
| roster | 204 | **206** | `f7-l16-reentry`, `f7-l16-walkin` |
| solver surface | GREEN 193 | **GREEN 194** (`--write` → classify → `--check`) | + `run:takeApItem`, classified `seedling` / `function` |
| constants | PASS 4,965 | **PASS 4,966** (`--profile-rows` → `--write` → `--check`) | +1 structural (`takeApItem`'s `0`). `pullRope`'s seven field targets **re-anchored** on `publishRopeGroup`, where the hoist moved the literals; every class unchanged (`pushable block 16px box …`, `player hitbox Rectangle(2 2 4 5)`, the structurals) |
| entities / profile | 518 / 138 | **518 / 138** | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; both new instruments pass `check-procgen-help --in-place` | instruments **334 → 336** (the planner, the probe); the docs index (the log entry) |
| bounded vitest | 27 files / 1,458, all green | **38 files / 2,024 tests: 2,023 green, 1 red** (`rosterCategories:175`, the bank row below) | + `fidelityF7` (18), `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `rosterCategories`, `jsRuntimeSolver`, `jsRuntimeCore`, `wasmWalkTape`, `decisionTrace` |
| `boxLock`, `lintGateLabels` | green | **green** | `probe-seedling-f7-reentry.mjs` joins `boxLock.test`'s `guarded` list (static `playwright` import, the take behind `isEntryPoint`) |

**Pins** (unions, added by name, not rewritten):
- `tapeEnvelope`, `observationTolerance` (incl. `swapped`): 204 → 206.
- `dialogueAutoAdvance`: 204 → 206, inert 203 → 205.
- `R8_ENEMY_BRIDGE.exposedAdded` gets `f7-l16-reentry` (L16, 7 bobs) and `f7-l16-walkin` (L16 + L17, 10 bobs). Its test mirrors follow: the declared list, the measured list (exposed 44 → 46) and the right-name-wrong-rooms fixture. L16 and L17 were already in the synthetic bridged set.

**`rosterCategories.test.js:175`** (the composite standing-values row) is **red at the head: `expected 144 to be 146`**. It is green at `a2d10de`; the +2 is this slice's two tapes. Fixing it is `standing-values --write`, which is not licensed. **The coordinator banks it** (below).

`seedling-bot-log.md`: the entry `### Seedling fidelity F7 — latched publishers on re-entry + the apitem clear` follows F6's, with three trap candidates.

## The JS arc's pins that move at my head

**None.** At the head, `jsRuntimeDeclarations` (6), `jsRuntimeSolver` (14), `jsRuntimeCore` (12), `wasmArrival` (29) and `wasmWalkTape` (32) are all green, and no JS-arc file was edited. What they gain:
- `run.takeApItem` (D3, `a63b8cd`). A `location` solve through `solveSegment` now banks the take, so the next build of that level is the game's.
- ⚠ **`earnedClears` drops a row once the next build has cashed it.** The same is true of every family there: a row is skipped when `clearedByLevel` already holds it. A consumer that wants "what did this segment earn" reads it before the re-entry, or reads `bankedClears` while the clear is still pending.
- The L16 return arrival from a live capture now solves (99 t), where the l16-budget slice measured a refusal.

## What the brief got wrong (measured)

1. **"the RUN's scratch persistence ledger … through … `pendingEarnedClears`".** Those are two different ledgers in `levelRun`. `scratchClears` is the scratch layer's evidence list, and its docblock says *"NOTHING here reaches `pendingEarnedClears`"*. The take is written where a pickup's is: `earnedClears` (a new `apItemFlags` family) and `pendingEarnedClears`. It is written in every run, not only scratch ones, because the game writes it either way.
2. **"A latched re-publish can move any committed tape that RE-ENTERS a room with a pulled rope (L39's `{39,9}` is cited in the code)".** No committed tape re-enters L16, L28 or L39 with the rope's tag cleared, and none declares `{39,9}` or `{28,0}`. The L39 re-entry the code's docblock imagines is not buildable either: the pull's own `fall()` clears `{39,10}`, and a cleared rock tag refuses at build (`arm`).
3. **"F6's residue 'a latched Pulser/ArrowTrap starts one update late' … is THIS family".** It is the same family, but for an arrow trap the offset is not observable. The walk-in's game stream shows no volley on the arrival frame, and the model latches before its first step. The offset F6 measured lives in state that accumulates per update (a fade's alpha, a pulser's phase). The pulser case (L39) is unreachable at build here, so F6's residue 2 stands for pulsers only.
4. **"`pulledRopes` = [] … after the build".** True before the fix. A naive fix also reads `[]`, because the planner's own `probe-arm.mjs` reads `pulledRopes` **before** anything builds the level's activator state, and that state is lazy (m3). The set is now built first.
5. **"Then a solver row … from that staging SOLVES (or declines by a new, true name)".** It solves; no new name was needed.
6. **"surface `--write`/`--check`"** is `--write`, then a hand classification of the new row (the census writes `UNCLASSIFIED` and stays RED until a class, form and why are filled), then `--check`.

## Residue

1. **L28 and L39 cannot be re-entered after their pull.** The game's state carries the rock's tag too, and `REFUSED_CLEAR_RESPONSES.arm` refuses it at build. ⚠ When a later slice lifts `arm` (a rock built fallen), `fallRockStateFor` must build that rock `landed: true`. Today it hard-codes `landed: false` (*"a state no build reaches"*), and with that, F7's at-build refusal would fire on the game's own state instead of skipping a fallen rock.
2. **A latched `Pulser` at build** (L39's `pulser@64,96`, reachable only once residue 1 is closed) carries F6's one-update offset, unwitnessed.
3. **A `tag = -1` APItem** writes out of band in the game; `run.takeApItem` reports `banked: false`. Registering `APItem` in `OUT_OF_BAND_WRITERS` needs its write site classified (F2 residue 4's family).
4. **A second segment in the same visit** keeps the taken apitem in `world.apItems` until the next build. The run's ledger is idempotent, but the observer's per-segment `apItemsTaken` map could see the same take again. Unmeasured, and outside this slice's licensed `solverBot` edit.
5. **The model cannot replay the controls** (the shake band). They are game-only arms.
6. **`ropeStates` and `fallRockStates` are never reset on a world swap**, despite their "per visit" docblocks. For a rope that is the game's answer anyway (it is re-pulled at build); for a rock it is pre-existing and unmeasured here.
7. **`rosterCategories:175`**: standing value 144 → 146, which needs `standing-values --write` (the bank row).

## Byte-inertia

- **No committed tape, expectation or declaration moved.** Added only: two tapes, their two expectations, `fixtures/f7-reentry-oracle.json` (md5 `8e235c5f…`), and the regenerated `index.json` (+2 rows).
- **Not touched:** `campaign-frontier.json`; the AS3, the wasm and every gitlink; the JS arc's files (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s prefix admission, used as a caller only); SF's regions in `solverBot.js` (the only edit is the observer's one call).
- **No signature or contract moved** for `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was copy → edit → run → copy back, md5-checked.
- **Box:** the recording and the probe ran with the box free, while the BEFORE block was on its node-only census rows, well ahead of its first box-taking row (`generated set`). That row later passed. The AFTER block ran on this tree with no other box work alongside.
- **Tree dirt:**
  - The unscoped `check-procgen-help` pass (run once by mistake, before the scoped `--only=` runs) and the identity block's rows write `scripts/procgen/.atlas-sphere-*`, `.rl-*` and five `worlds/*_worldgen/` directories (untracked, not ignored). The ones that appeared in this tree were removed; none were staged.
  - `evidence/fidelity-planning-2` was checked out from the scratch branch and never staged.
- **Scratch** (`/tmp/claude-0/f7/`, not committed): the census, prototype and round-trip scripts, both identity logs, the vitest JSONs, and the mutant outputs.

## The identity rows the coordinator must BANK

- identity log md5: BEFORE **`aa46950b5958b32136111155250dd253`** (pristine `a2d10de` worktree); AFTER **`aa46950b5958b32136111155250dd253`** — byte-identical (`diff` empty) (head)
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, all exit 0 (BEFORE = AFTER)
- counts (movers, not digests): tapeRunner **469**, roster **206**, surface **GREEN 194**, constants **PASS 4,966**, instruments **336**, entities 518, profile 138
- **`rosterCategories:175`**: the composite standing row, green at base and **`144 vs 146`** at the head (+2 F7 tapes). Re-seal with `standing-values --write` when banking.
- **for the JS arc:** D3 = **`a63b8cd`** (`run.takeApItem`)
