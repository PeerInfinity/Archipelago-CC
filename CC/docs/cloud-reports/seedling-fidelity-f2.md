# Seedling fidelity F2: the `apitem` goal + its persistence response · the lone keyup at window boundaries

**Slice:** `seedling-fidelity-f2`, an Opus build session run in the cloud (planner `seedling-fidelity-planning`). ⚖ The user, 2026-10-02: the `apitem` goal kind is its own slice, it carries the lone-keyup measurement with it, and it runs alongside F1b. I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js` and its test, the solver worker, `solveSegment`'s `prefix` admission), any AS3, the wasm, or a gitlink. I also left alone everything F1/F1b touch: the kill-lock ledger, `twoPassSolve`, `levelRun.js`, the chain tapes, `playthroughWalk.js` and `campaign-frontier.json`. In `solverBot.js`, no signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved. The goal *shape* is unchanged: `collect-placement` now resolves one more kind of target.

| | |
|---|---|
| Started from | `origin/main` @ `d6069d7de6` (the harness branch carried F1's commits; I reset it to `main`, and F1's work is safe on `origin/fidelity-harvest/f1`) |
| Head | this report's commit, on top of `14fb2b5` |
| Harness branch | `claude/seedling-fidelity-f2-5r3w32` (the harness pins it, not `seedling-fidelity-f2`) |
| Commits | D1 `02f98f1` · D2 `c3f3ec2` · D3 records `14fb2b5` · this report |
| Dev server | `scripts/serve-nocache.py 9120` (`SEEDLING_PORT=9120`, build `seedling_bot_ap_p4e`, headless logic-only). The worker restarted once mid-D2; the server was restarted and nothing else was lost |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Identity log md5 `771ff8ba…` (equal to F1's W0). The six `--check`s are `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0. tapeRunner 449/449; surface GREEN 191; constants PASS 4,937; profile 138 (both tiers); entities 518; roster 196; bounded vitest 21 files / 1,382 green. |
| D1a | **PASS** | `collect-placement` at an APItem resolves as strategy `apitem`. Success is the game's contact rule, `solverBot.apItemTakenOnTick`, observed on every `run.advance`. It is pinned EQUAL to the JS page's own report, tick for tick, over the solver's keys on all three rooms. |
| D1b | **PASS** | `PERSISTENCE_RESPONSE.apitem = 'despawn'` (`APItem.as:135-143`). A cleared-tag staging now boots with no apitem, and the game's room holds none either. |
| D1c | **PASS** (game-witnessed) | Three generated presets solve: room taken on tick 254, leaf 127, host 95. On the game, a `hold` tape of `takenAt + 1` ticks clears the slot and `takenAt` ticks do not, with positions 0 px off. Recorded twice, identically. Mutants: 2/2 red as predicted. |
| D2 | **PASS, outcome (i): the lone keyup is inert. Closed with no tool change.** | At `r4-walk-1-sword`'s latch the game's edge echo reads `released [up]`, `held []`. Two seconds of free-running world show no drift. The real driver gives `moved_at_boundary false` both with and without its release, and window 1 is byte-identical to its recording both ways. |
| D3 | **PASS, with 2 explained reds in the JS arc's file** | Identity log AFTER is **byte-identical** to W0 (md5 `771ff8ba…`, the six `--check`s unmoved). tapeRunner pairs identical (449). Surface GREEN **192** (+`world.apItems`). Constants PASS 4,937. Instruments 317 → 319. Reference ALL 7 + 5 MATCH. |

**The one thing to know first.** The solver now solves a generated room's apitem, and the game agrees on the tick. But the JS arc's `wasmWalkTape.test.js` has **two pins that red by construction**, because both assert the old gaps (the refusal and the "resolves to NOTHING"). The file is theirs, so I did not edit it. The patch is under *For the JS arc*. The unfiltered CI vitest at this head will show those two reds and no others that I know of.

## W0 (at `d6069d7`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9120 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `fce3ad42…` · c6 `8e59dec8…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Log md5 **`771ff8baa769ff4e4d0940ffb24a0541`** |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **449/449**; (name, status) pairs md5 `fb3b59f8…` (sorted `name\tstatus` lines) |
| surface / constants / profile / entities | the four `--check`s | GREEN 191 / PASS 4,937 / 138 keys (both tiers) / 518 leaves |
| roster | `fixtures/tapes/index.json` | 196 tapes |
| bounded vitest BEFORE | solverBot, botDriverV2, tapeRunner, levelWorld, the 14 files `rg -al "PERSISTENCE_RESPONSE\|checkPersistence"` names (incl. `wasmWalkTape`), jsRuntimeSolver, seedlingConstantsCensus, seedlingSolverSurface, lintGateLabels | **21 files / 1,382 green** |

## D1: the `apitem` goal (`02f98f1`)

### D1a: the goal kind, and why it is not a new kind

I chose **`collect-placement` resolving an apitem** (strategy `apitem`) over a new `collect-apitem` kind, for three reasons:

- `assertGoal`'s own contract is that *which verb collects it is the solver's strategy selection, not the goal's*. Nothing about what is wanted differs from a pickup.
- The JS arc's mapping already produces exactly this goal (`jsRuntimeSolver.solverGoalFor`: a `location` → `collect-placement {placement}`), so the switch on their side needs no new vocabulary.
- A refusal for an absent placement keeps its words (*"resolves to NOTHING"*), so no pin on it moves except the one that asserted the apitem gap.

**What was added:**

- **`levelWorld`: `world.apItems`.** Each row is `{id, tag, x, y, look, rect}`, in `.oel` order. `rect` is the `apitem` class row's `apItem` box, the same `entityRect` call `jsRuntimeCore.apItemsOf` makes (pinned equal). A cleared apitem is not listed. Nothing that steps a tick reads the list: no role entry was added, so no physics or planner list changes.
- **`solverBot.resolveCollectStrategy`: a third arm.** An APItem at the placement resolves as `apitem`, rejecting `collect` (no `special`, so there is no ceremony for `runCollect` to wait on) and `chest`.
- **`solverBot.apItemTakenOnTick(apItems, pre, post)`, the contact rule.** It takes the box the PREVIOUS tick left (`playerBoxAt(pre)`), strictly overlapping an `apItem` box. Nothing is taken on a tick that changed level, fired a transition, recorded a death, or began in a ceremony (`run.progress('inCeremony')`). Those are `jsRuntimeCore.tickOnce`'s own exclusions, and as on the page, at most one apitem is taken per tick. The citations are `Pickup.as:63-84` (`collide("Player", x, y)` from `update`), `:120-123` (the `removeSelf()` arm) and `APItem.as:127-133` (`removed()` clears the slot in the same frame).
- **The observer.** In `solveSegment`, `run` is re-bound to `Object.create(run, {advance})`, so **every** executor's tick passes through one observer (walks, dwells, holds, verbs). A take in passing is therefore seen, and the goal reads it (`arm: 'collected-in-passing'`). Every other member is the run's own: its getters close over the run and not `this`. A caller's recording Proxy (`jsRuntimeSolver.solveFromTape`) still sees exactly one advance per tick, so its `solution.length === expected.length − 1` assertion holds. With no apitem in the level the observer reads three fields and changes nothing.
- **The executor.** It writes a trace row (`verb: 'apitem'`, with its rejections), calls `walkTo(goal, centre)` with the loop's own planner, danger gate and ladder, and reads the take. If the walk arrives without a take, the solver refuses by name (*"the contact rule never fired"*). The record is `{strategy: 'apitem', arm, apItem, level, takenAt}`, where `takenAt` is the TAPE index of the advancing tick. `apitem` joins `decisionTrace.KNOWN_STRATEGY_VERBS`.

**Witness: ONE contact rule** (`fidelityF2.test.js`, which imports `jsRuntimeCore` read-only). The JS page (`createJsRuntime`, the set delivered through `botLoadLevels`) is driven over the solver's own keys. It stands on the solver's expected row on every tick, and it reports its single `check` on exactly `takenAt`: room 254, leaf 127, host 95. Unit rows cover the four exclusions, first-in-order, and strict overlap (a box touching the edge takes nothing; one pixel in takes it).

### D1b: the persistence response

`APItem.check()` is `if (tag >= 0 && !Game.checkPersistence(tag)) { doActions = false; FP.world.remove(this); }` (`Pickups/APItem.as:135-143`). `Game.update`'s first frame runs `check()` on every entity (`Game.as:869-879`), and `doActions = false` keeps `removed()` from writing the slot again. That makes it `'despawn'`, the vanilla pickups' row. `persistenceClearsFor` now neither refuses an apitem tag nor offers one (it removes nothing in the way: no collider, no hazard).

**The game agrees** (the probe's ROOM and CLEARED arms, each a zero-tick `hold` boot on a fresh page). With no clear, `botMobiles` holds exactly one `Pickups::APItem` at the placement + 8: room (72,24), leaf (88,56), host (72,56). With `{0,0}` cleared it holds **none**, and `persistence_cleared` is `[{tag 0, level 0}]`. The model builds the same room, with `world.apItems` empty.

### D1c: the solver row, on the game

`probe-seedling-f2-apitem.mjs` (committed; takes the box lock; `--record`) mounts each generated set through `planLevelSetChunks` → `botLoadLevels` on a fresh p4e page per arm. It plays the solver's tape through `wasmPlayback.shippedTape(…, hold: true)` (read-only import). `hold` freezes the world at the latch, so a tape of N ticks runs exactly N world updates.

| preset | solve ticks | `takenAt` | game: `takenAt + 1` ticks | game: `takenAt` ticks | positions (TAKE arm) |
|---|---|---|---|---|---|
| `seedling_generated_room` | 266 | **254** | `{0,0}` cleared | not cleared | 256 rows, worst **0** |
| `seedling_generated_leaf` | 140 | **127** | cleared | not cleared | 129 rows, worst **0** |
| `seedling_generated_host` | 106 | **95** | cleared | not cleared | 97 rows, worst **0** |
| `seedling_generated_swim` | refused: *"no corridor for goal collect-placement toward (40,56)"* (the apitem is across water; the J2 walker refuses it too) | | | | |

The two runs recorded identical JSON (`fixtures/f2-apitem-oracle.json`, md5 `07d69bcf…`). The node rows hold the solver to it.

**Mutants** (predicted first, from a copy, restored md5-identical):

- **m1**: the contact rule returns null. Predicted: the cases cannot be built, because every solve refuses with *"the contact rule never fired"*, so the whole file reds at collection. **Measured exactly that.** Restored `9cde3ce1…`.
- **m2**: the `apitem` response is removed. Predicted 5 red / 19 green: the `despawn` row, the three cleared-boot rows (with the old refusal) and the clear-offer row. **Measured 5 red / 19 green, with the old words:** *"…carried by "apitem" at (64,16) — a class with NO declared persistence response…"*. Restored `b138b261…`.

**The refusals' words in the test tree** (`rg -a` over `frontend scripts docs CC`):

- **`wasmWalkTape.test.js:194`** (*"apitem.*NO declared persistence response"*) and **`:221-227`** (*"(b) lost … resolves to NOTHING"*): both red. Both are the JS arc's, and the patch is below.
- `wasmArrival.test.js:202` (a chest already open) and `check-seedling-editor-refusal.mjs:184` (placement 999,999): unaffected, because those are still absent placements. The bounded run is green on `wasmArrival`.
- `docs/json/developer/procgen/flash.md:435` says the solver has no goal kind for an apitem. It is the JS arc's prose, now stale, and I did not edit it.
- `r2-route.json`'s refused-clear `why`s name no apitem.

## D2: the lone keyup at window boundaries (`c3f3ec2`): outcome (i)

`probe-seedling-f2-boundary.mjs` (committed, measure-only) works on the boundary the driver's own comment names: `r4-walk-1-sword` holds `up` 591..641 against `tick_count` 641, followed by `r4-walk-2-feather`.

**B, the game's own readout** (direct page, window 0 alone):

| reading | value |
|---|---|
| the latch's edge echo (`status.input`) | `t 641`, `released [up]`, `held []`, `pressed []`; totals: `up` 7 presses, 7 releases |
| position over 2 s of free-running world, NO release | (264,264) at 0 / 300 / 1000 / 2000 ms |
| control: a full DOM keydown of `up` on the canvas (a key the runtime does see go down) | (264,264) → (264,259.9) in 150 ms: **it drifts**, so the readout can see a held key |
| then the tools' lone keyup (keyCode only, at document, window and canvas) | 255.40 → 255.25 in 400 ms (a coast tail; a held key moves about 11 px in that time) |
| then the full keyup | no further motion |

**A, the tool** (the real `seedling-bot-replay-win.py --headless --tapes`, through `seedlingDriver.driverChannel`):

| arm | `moved_at_boundary` | window 0 end → window 1 boot | window 1 vs `expectations/r4-walk-2-feather` |
|---|---|---|---|
| LONE (`releaseKeyCodes`, the tool as it ships) | **false** | (264,264) → (264,264) | **byte-identical** |
| NONE (no release) | **false** | (264,264) → (264,264) | **byte-identical** |

**Why.** `Bot.update` dispatches every span's KEY_UP on the tick where `spanTo == tick`. For a span that runs to the end, that is the finish tick, **before** the latch (`Bot.as` ~3131-3135, then `recordEdges`, then the latch). The dispatch is AS3's own `FP.stage.dispatchEvent`, so the runtime's physical-key filter (the one that drops a DOM keyup for a key it never saw go down) is never involved. At a window boundary nothing is held, so the lone keyup has nothing to release. Neither `watchWasm.releaseKeysInFrame` nor the driver changes, and no pair is sent. Recorded twice, identical but for wall clock and the boot fade's dead-frame count (318–320).

## Deltas

| Row | W0 (`d6069d7`) | head | movers |
|---|---|---|---|
| identity log (all rows, six `--check`s, reference) | md5 `771ff8ba…` | **md5 `771ff8ba…`, `diff` empty** | none |
| tapeRunner | 449 pairs, md5 `fb3b59f8…` | **identical** | none |
| solver surface | GREEN 191 | **GREEN 192** | + `world:apItems` (classified `seedling` / `constant`); site-count drift from the observer's reads (it uses the folded `run.progress('inCeremony')` and `run.ledger('playerDeaths')`) |
| constants | PASS 4,937 | **PASS 4,937** | line shifts only (`--profile-rows` → `--write` → `--check`) |
| profile / entities | 138 / 518 | **138 / 518** | none (not re-written; the model's per-tape keys and leaves did not move) |
| roster / tape index | 196 | **196** | none: the witnesses are a fixture JSON plus a probe, not tapes (the differential cannot mount a level set) |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | instruments **317 → 319** (the two F2 probes); docs index; `check-procgen-docs` ALL PASSED; both probes pass `check-procgen-help --in-place` (HELP + IMPORT) |
| bounded vitest | 21 files / 1,382 | **42 files / 2,177: 2,175 green, 2 red (explained)** | + `fidelityF2` (24), `decisionTrace`, `wasmArrival`, every `jsRuntime*`, `seedlingWasm*`, `procgenDocs`, `director`, `rosterCategories`. The 2 reds are `wasmWalkTape.test.js`'s pins |

## What the brief got wrong (measured)

1. **`PERSISTENCE_RESPONSE.APItem`.** The table is keyed by the `.oel` element tag, so the row is `apitem`.
2. **`createRunForStaging`** lives in `tapeRunner.js`, not `levelWorld.js`. The refusal at `levelWorld.js:~4252` is `buildLevelWorld`'s, and the words at `~3186` are `persistenceClearsFor`'s offer list, not a throw.
3. **`APItem.as:98-104`** (the brief, and the `apitem` class row's own `src` string). At the pinned vendor commit (`e1e6b24`), the ctor is `:110-117`, `removed()` is `:127-133` and `check()` is `:135-143`. I did not edit the row's string (residue 5).
4. **"Which holds is open" (D2).** R9 slice RR had already answered it from the code and the tape census (*"the game does release them … on the tape's final tick"*). What was open was a measurement at a real boundary with both tools, and that is D2.
5. **"Find a committed chain window that does … with and without the release."** The cited bridge (`r4-walk-1-sword` → `r4-walk-2-feather`, as `director.windowsFrom(…, {strip: true})` builds it) is **refused by today's driver**: *"window 1 … declares a persistence set that is NOT the live world's: declared [] vs live [10:0, …]"*. That is the R9 slice 6 boundary guard. The probe declares exactly the latch's `persistence_cleared`, so the game names the inheritance (residue 6).
6. **The W3 premise "a lone keyup is dropped"** holds for a key the runtime never saw go down, which is the bot's case. For a key it did see go down (my control's DOM keydown), the tools' keyCode-only lone keyup released it (0.15 px of coast in 400 ms, against about 11 px held).
7. **"`pendingCheck` / the persistence flip read from the game."** The p4e status carries the flip as `persistence_cleared`, and a polled read races the free-running world (the player can walk onto the apitem after the tape ends). The tick-exact reading is the `hold` bracket at `takenAt + 1` and `takenAt`.
8. **My own predictions.**
   - The solver's walk is not the walker's: room 255 ticks to the take against the walker's 220. They are different producers with different corridors, and both are exact on the game.
   - The surface census refused the observer's first spelling (`run.inCeremony` and `run.playerDeaths` read directly). It is folded behind the queries now.
   - The first D2 control held the key for 600 ms, walked the player into the room's top edge and made the keyup row non-discriminating. Cut to 150 ms.

## For the JS arc

To serve a generated room's apitem with the solver instead of the J2 walker, `seedlingWasmPlayback.js` (the `if (generated)` branch at about `:333`) would make this call for a **location** goal:

```js
const a = apItemsOf(record).find((x) => x.tag === goal.tag);       // jsRuntimeCore
request = arrivalSolveRequest({ staging, levelSource, records, scratchPersistence: true,
    name: `wasm-location-${goal.level}`,
    solverGoal: { kind: 'collect-placement', placement: { x: a.x, y: a.y } } });
```

In `jsRuntimeSolver.solverGoalFor`, the same is the `location` arm with `placement = {x, y}` of the apitem, instead of the `mounted` early return. Exit goals can stay on the walker. Notes:

- **The staging no longer needs the lift.** An apitem clear is admitted now (D1b), so `wasmWalkTape.js:103-112`'s `apItemClears` filtering is redundant but harmless.
- **An apitem already taken** is gone from `world.apItems`, so the solver refuses with *"resolves to NOTHING"*. Keep the walker's zero-tick `done` (check `isCollected` before asking).
- **`plan.solution` walks on to the centre after the take**: room 266 ticks, taken on 254. No ceremony follows, so shipping it whole is harmless. To end the tape on the take, the cut is `takenAt + 1`. That number is on the segment's `records` (`strategy: 'apitem'`), which `solveFromTape` does not return today; surfacing it is a one-line change in their file. Without it, `apItemTakenOnTick` over `plan.expected` rows gives the same tick in a room with no ceremony.
- **The patch for `wasmWalkTape.test.js`:**
  - `:194`: `expect(createRunForStaging(staging, levelSource, { scratchPersistence: true }).world.apItems).toEqual([])`, replacing the `toThrow`.
  - `:221-227` (*"(b) lost"*): `expect(r.ok).toBe(true); expect(r.plan.verbs).toContain('apitem')`, renamed *"(b) found"*.

## Residue

| # | item | site |
|---|---|---|
| 1 | **`wasmWalkTape.test.js` reds 2 pins by construction** (the refusal, and "resolves to NOTHING"). The file is the JS arc's; the patch is above | `wasmWalkTape.test.js:194`, `:221-227` |
| 2 | **One apitem per tick** (the page's rule, mirrored for the equality). The game takes every overlapping APItem on the tick. No committed room has two overlapping | `apItemTakenOnTick`; `jsRuntimeCore.apItemContact` |
| 3 | **`player.fallFromCeiling`** (`Pickup.as:64`) blocks a contact in the game; neither the page nor the solver models it. An apitem under a pit-fall landing would diverge | same |
| 4 | **A tag −1 apitem**: the page re-reports it every overlapping tick; the solver takes it once, by id | same |
| 5 | **The `apitem` class row's `src` cites `APItem.as:98-104`**, which is stale at the pin (`:110-117`). Not edited: it is a string the entity/constants censuses may read | `levelWorld.js` `ENTITY_CLASSES.apitem` |
| 6 | **The R4 bridge as `windowsFrom(…, {strip: true})` builds it is refused by the driver's boundary guard** (declared [] vs live). `run-seedling-director --bridge` drives that driver (`--win`), so it would meet the same refusal. Not run here (Windows-only) | `director.windowsFrom`; `seedling-bot-replay-win.py` boundary guard |
| 7 | **Three comments say a key is held at a window's end**, which D2 refutes: the driver (`.py` ~414-421, ~598), `run-seedling-director.mjs` ~120-127, and `director.assertWindowEndsAtRest`'s first arm (*"is still HELD when the window ends"*). Not edited: the driver's bytes are in the differential's model fingerprint, and the director's finding text may be pinned. The coast arm (`> end − 8`) is unaffected | those sites |
| 8 | **`docs/json/developer/procgen/flash.md:435`** says the solver has no apitem goal kind (the JS arc's prose) | doc |

## Byte-inertia

| Artifact | W0 | head |
|---|---|---|
| identity log (every row, the six `--check`s, the reference) | md5 `771ff8ba…` | **md5 `771ff8ba…`, identical** |
| tapeRunner (name, status) pairs | 449, md5 `fb3b59f8…` | **identical** |
| `fixtures/**` | — | **added only**: `f2-apitem-oracle.json`. No tape, expectation or index moved; `campaign-frontier.json` untouched |

Not touched or not run: AS3, wasm, gitlinks, every committed tape and expectation, biome defaults, `standing-values --write`, `pytest`, the unfiltered vitest, and the JS arc's files.

## Rows the coordinator must BANK

**CI-read** (⚖ 52, not measured here): the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`). It should show `wasmWalkTape.test.js`'s 2 reds (residue 1) and, as far as I know, nothing else of this slice's.

**Box rows:**
- identity log md5 **`771ff8baa769ff4e4d0940ffb24a0541`** (unmoved), six `--check`s unmoved;
- solver surface **192** rows (was 191); constants **4,937**; instruments **319** (was 317); tapeRunner **449**; roster **196** (unmoved);
- new fixture `f2-apitem-oracle.json` md5 **`07d69bcfb550054a8bf1e10e4b137d45`**; new probes `probe-seedling-f2-apitem.mjs` (game rows 15/15 PASS) and `probe-seedling-f2-boundary.mjs` (VERDICT (i));
- whichever of F1b / F2 merges second rebases. The conflict will be in `seedling-bot-log.md` (both entries go after R5-swim's), `solverBot.js` (separate regions) and the generated reference files (regenerate them).
