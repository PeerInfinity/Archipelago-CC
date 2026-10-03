# Seedling fidelity F4: a static "Enemy" body's arrow death (L8's sandtraps) · the solver plans L8 from either state

**Slice:** `seedling-fidelity-f4`, an Opus build session run in the cloud (planner `seedling-fidelity-planning`). ⚖ The user, 2026-10-03: the solver must handle L8 with the sandtraps cleared or not, know which state it is in, and neither clear the save nor leave and re-enter the room; teach the model the sandtrap's death rather than add a live-game oracle. I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s `prefix` admission), any AS3, the wasm or a gitlink, and none of F1c's regions (the press kill's `safeStep`, the hammer rung, the spinner kill-lock arm, the chaser kill-lock ledger, `levelRun`'s arrow update order, the chain tapes, `playthroughWalk.js`, `campaign-frontier.json`). `fidelityF4.test.js` and the D1 planner import `jsRuntimeCore` and `wasmArrival` read-only. No signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/f2b` @ `5c4ea0eec2` (F2 on main `db8374536c`) |
| Head | this report's commit, on top of `2b4216a` |
| Harness branch | `claude/enemy-arrow-death-sandtraps-j3lwjw` (the harness pins it, not `seedling-fidelity-f4`) |
| Commits | D1 `829188b` · D2 `09dddf6` · D3 records `9fd21f4` + `2b4216a` · this report |
| Dev server | `scripts/serve-nocache.py 9150` (`SEEDLING_PORT=9150`, build `seedling_bot_ap_p4e`, headless logic-only) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Identity log md5 `771ff8ba…` (= F1's and F2's bank). The six `--check`s are `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0. tapeRunner 449/449 (pairs md5 `fb3b59f8…`); surface GREEN 192; constants PASS 4,937; profile 138 (both tiers); entities 518; roster 196; bounded vitest 26 files / 1,909 green. |
| D1 | **PASS** (the rule, read off the game) | **Three hits, not one.** An arrow is `Enemy.hit(5, p)`: one damage, 30 i-frames that only the body's own update runs down. `sandtrap@96,80` takes t164, t197, t230; "die" (19 updates) from t230; gone on **t248**, and `persistence_cleared` carries {8,0} on that same observation. `sandtrap@96,128`: t564, t597, t630, gone with {8,1} on **t648**. Witness `f4-l8-sandtraps`, recorded twice, byte-identical. |
| D2 | **PASS** | The model computes it (`STATIC_ARROW_DEATH.SandTrap`, one `enemyHit`, the chasers' sprite stepper). Every sandtrap row on every sampled L8 tick of three tapes is the game's (2,599 ticks, 0 disagreements). The JS arc's L8 arrival **solves from all four boot states**: 827 / 650 / 509 / 294 ticks, zero hits. The uncleared solve IS the recorded game witness, key for key. Mutants 2/2 as predicted. Census: 1 of 196 committed tapes moves (`r7-act2-full`, bodies only, game-checked). |
| D3 | **PASS, with one explained red `--check` (STOP)** | Identity log: every row byte-identical except ONE line: `solve-seedling-r9-campaign --check` `975e2f48…` → **`fdf740ef…`, exit 1**. Its two failures are both `r8-solve-8` (tape and trace DRIFT), because the producer's re-solve of window 8 no longer needs a declaration. Every seam oracle still passes. tapeRunner 451/451 (the 449 W0 pairs identical). Surface GREEN 193. Constants PASS 4,948. Reference ALL 7 + 5 MATCH. |

**The one thing to know first.** The two committed L8 tapes declare sandtrap clears the game does not make on those ticks: `r8-solve-8` says {8,0}@246 / {8,1}@645 (the game removes them on 248 / 648) and `r7-act2-full` says @2515 / @3067 (game: 2383 / 2905). Both tapes still replay (their player streams are unchanged and their recordings pass), and I moved neither. But a producer that re-solves L8 now gets the run's own deaths and no declaration: `solve-seedling-r9-campaign --check` re-solves window 8 (`r8-solve-8`) in the same 827 ticks, with zero hits and the same calm L9 arrival. Every free-oracle seam passes, including `r8-solve-9`'s `seam.time` 7514. But the keys part from the committed tape at t247 (the old early clear made the committed walk react two ticks sooner), and the re-solve declares no {8,0}/{8,1} rows, because the run computes and writes them itself. So the check exits 1 with `r8-solve-8` tape and trace DRIFT. Making it green means re-recording `r8-solve-8`: its inputs from t247, and its two timed rows dropped or set to the game's 248/648. That is not licensed here, so it is a **STOP**, and the moved set is exactly `r8-solve-8` (tape + trace). The coordinator asks the user.

## W0 (at `5c4ea0e`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9150 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `fce3ad42…` · c6 `8e59dec8…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Log md5 **`771ff8baa769ff4e4d0940ffb24a0541`** |
| six `--check`s | the block's producer loop | battery `410f27c0…` · d2-chain `7cba9530…` · l18 `cef8048e…` · tail `9a6a3192…` · r9-l3 `6cd35fe1…` · campaign `975e2f48…`, all exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **449/449**; sorted (name, status) pairs md5 `fb3b59f89a97e901db61733df13573f6` |
| surface / constants / profile / entities | the four `--check`s | GREEN 192 / PASS 4,937 / 138 keys (both tiers) / 518 leaves |
| roster | `fixtures/tapes/index.json` | 196 tapes |
| bounded vitest BEFORE | levelRun, enemyDamage, arrowTrap, chasers, solverBot, botDriverV2, tapeRunner, levelWorld, twoPassSolve, playthroughAcceptance, jsRuntimeSolver, jsRuntimeDeclarations (read-only), boxLock, lintGateLabels, seedlingSolverSurface, seedlingConstantsCensus, plus every file that pins a word or value this slice touches (ropeSword, contactControl, contactPairV2, r8Acceptance, levelSetValidator, watchManual, director, r7Acceptance, tapeFormat, rerecordCampaign) | **26 files / 1,909 tests, all green**, exit 0 |

## D1: the sandtrap's arrow death, on the game (`829188b`)

**Reproduced first.** The JS arc's L8 staging (`createJsRuntime`, `Game(8,144,48)`) plus `arrivalSolverGoal` → `solveSegment` with `scratchPersistence`: `PendingDeclaration {level 8, tag 0, source 'game'}` after **478** ticks, with the 318-tick bound (3 × `ARROW_KILL_FLOOR` 96 + 30). With `{8,0}@248` declared, it waits on {8,1} (868 t). With both declared at the game's ticks (248/648), it solves in 827 t.

**The instrument.** A scratch sampler (`test-results/f4/game.mjs`, not committed) plays a tape on the p4e page and reads `botMobiles()` and `botStatus()` between frames, keeping the first sample per tick: SandTrap, Arrow and Player rows, and `persistence_cleared`. On `r8-solve-8` it sampled 828/828 ticks with no straddled tick. The witness is the solver's own L8 solve, written by `plan-seedling-f4-l8-sandtraps.mjs` (committed, `--check`): `r8-solve-8`'s staging and boot block, the `out_teleporter_96_192` goal, and {8,0}@248 / {8,1}@648 declared GAME-sourced. The planner asserts that the JS arc's own staging solves to the same 827 keys, that the walk takes zero hits and crosses to L9 on t827, and that the model's replay of the written tape equals the solve run on all 828 observations. The sampler ran twice on it (826 common ticks, **0 differences**). `check-seedling-bot-differential --record --only=f4-l8-sandtraps` ran twice, and the expectation was `94cc6266f79216c71aa88998b0c37d59` both times; the compare pass is ALL CHECKS PASSED.

**What the game does** (identical on the witness and on `r8-solve-8`, whose walk is the same until t247):

| tick (observation) | `sandtrap@96,80` (104,88) | `sandtrap@96,128` (104,136) | `persistence_cleared` (L8) |
|---|---|---|---|
| 0 | hits 0, ht 0 | hits 0, ht 0 | — |
| 164 | **hits 1, ht 29** | 0 | — |
| 165 … 193 | ht 28 … 0 (one per tick) | 0 | — |
| 175, 186 | volleys land on i-frames: no damage | | |
| 197 | **hits 2, ht 29** | 0 | — |
| 230 | **hits 3, ht 29, "die" index 0** | 0 | — |
| 233 / 236 / 239 / 242 / 245 | "die" index 1 / 2 / 3 / 4 / 5 | 0 | — |
| 247 | hits 3, ht 12, "die" 5 (last present) | 0 | — |
| **248** | **gone** | 0 | **{8,0}** |
| 564 / 597 / 630 | — | hits 1 / 2 / 3 ("die" from 630) | {8,0} |
| **648** | — | **gone** | **{8,0}, {8,1}** |

**The rule, with its numbers.**
- **`hitsMax` is the `Enemy` default, 3.** `SandTrap` sets none. Each arrow is `(hits[i] as Enemy).hit(v.length, new Point(x, y))` (`Arrow.as:51-53`), so `d` = 1 and `t` = "". All three arrows of a volley overlap the body on one tick; the first to update lands and the other two meet the i-frames. Which arrow lands does not matter here: the knockback is empty, so the witness does not depend on F1's arrow order.
- **The i-frames are `hitsTimerMax` 30, run down by `Enemy.update`'s `hitUpdate`,** which runs in the body's own update, after the arrow's (arrows are run-time additions; `loadlevel` adds `sandtrap` at `Game.as:2268`, below `arrowtrap` at `:2320`). So the hit's own observation reads 29, and the timer reaches 0 on t193. The next volley after that lands (t197): the trap fires every 11 ticks, so hits land 33 ticks apart. `hitUpdate` sits behind `onScreen()`; both bodies are on screen for the whole witness.
- **`knockback` is an empty override** (`SandTrap.as:77-80`): position (104,88) on every tick.
- **The death.** `startDeath` is `play("die")` with no `destroy` (`:88-92`). "die" is six frames at rate 10 under `FP.elapsed` 0.0333, which is 19 graphic updates. The first update is on the killing tick: the graphic advances after the entity, outside the `onScreen` gate. On the 19th, `endAnim`'s "die" arm calls `FP.world.remove(this)` (`:94-100`). That is t230 + 18 = **t248**. There is no `Mobile.death` fade.
- **The flip.** `removed()` is `super.removed(); Game.setPersistence(tag, false)` (`:82-86`). The body is absent and {8,0} is cleared on the **same** observation, 248. The fencepost is: kill tick K, removal and flag on K + 18.

**How this sits against the brief's numbers.** Probe O's t248 and t648 are exactly these removals. "About 88 ticks into the hold, so probably ONE hit" is wrong: it is three hits on the volley cadence behind the i-frames (see *What the brief got wrong*).

**The game oracle.** `fixtures/f4-sandtraps-oracle.json` (70 KB) holds the game's SandTrap rows (`[x, y, hits, hits_timer, die index | null]`) on every sampled L8 tick of `f4-l8-sandtraps` (827 ticks), `r8-solve-8` (827) and `r7-act2-full` (945, sampled from t2280, because per-frame polling exits the game near t2019, as F1 found). It also holds the first observation carrying each tag: 248/648, 248/648 and **2383/2905**.

## D2: the transcription (`09dddf6`)

**One rule, shared machinery.**
- `enemyDamage.STATIC_ARROW_DEATH` lists the static classes whose arrow death the run computes. Today that is `SandTrap`: die anim `{frames 6, rate 10}`, `knocksBack: false`, `witness: 'f4-l8-sandtraps'`.
- `createStaticBodyDamage(as3)` builds the state from `ENEMY_DAMAGE_DEFAULTS`, the same fields `createEnemyDamage` uses, and refuses every class not listed.
- New rows: `CORPSE_COUNTING.SandTrap` (a fifth shape, `anim`: removal at `endAnim`, no fade; `removalTicksAfterHit` returns the anim length) and `KILL_SIDE_WRITES.SandTrap` (`ownTag`, site `removed`).
- `levelRun.applyArrowHit`'s static arm calls the same `enemyHit(…, ARROW_ENEMY_HIT)` the chaser arm calls. On a kill it starts the "die" anim with `chasers.createSpriteAnim`.
- `stepStaticBodiesNow` runs right below `stepArrowTrapsNow`, in the body's slot. It runs `enemyHitUpdate` (with `onScreenNow` asked only while the timer runs) and `stepSpriteAnim`.
- At the top of the next tick, `fireStaticRemovals` removes the body from the level record through `despawnedByLevel`, the v10 despawn path, so no list the world derives can keep it. `removed()`'s tag goes through one channel:
  - **declared**, when the staging declares the slot (the tape is the one writer; the ledger records `declaredAt` beside `removedAt`);
  - **scratch**, in a scratch run (`applyClearNow`, plus a `scratchClears` row, as the chaser kill-lock ledger does);
  - **earned** otherwise (`pendingEarnedClears`, cashed at the next build, as a spinner's own `removed()` write is).
- `worldFor` does not pass the builder a cleared tag whose every bearer the run itself despawned. Otherwise the builder's orphan guard reads the game's state as a clear nobody reads.
- The player-contact gate (`enemyHitPlayerFires`) reads the live body's `hitsTimer` and "die". Until now those were constants with a note that a future stepper would replace them.
- New faces: the ledger `staticBodyDeaths` and the entity family `staticBodies`. The differential asserts that every row of `staticBodyDeaths` is off in the game's own `persistence_cleared`.

**"A way to know which state it's in."** The staging's boot persistence carries it: a cleared tag builds the room without its body. The solver's static arm plans from the live room. Its hold's `until` asks whether the body has left the world, and the run removes it on the game's tick, so the hold ends by itself in any state. No census is consulted for the death.

**§11.4, lifted only for SandTrap.**
- Static arm: if the bound runs out on a class the run computes, the solver refuses by name (`… the run COMPUTES <id>'s arrow death … still standing with N hit(s)`) instead of raising a game-sourced declaration. An uncomputed class keeps the old `PendingDeclaration` and its words.
- `drainCeiling`'s bait loop: a computed static body left outside every lane is a `SolverRefusal`. An uncomputed one is still game-sourced.
- The no-target `killWhy` now names the computed classes.

**Witness 1 (the game's rows in the model).** `fidelityF4.test.js` replays each oracle tape and compares the live room's sandtraps (census presence and the run's own roster) to the game's on every sampled tick:

| tape | sampled L8 ticks | disagreements | model's `staticBodyDeaths` (killed → removed, channel, declared) |
|---|---|---|---|
| `f4-l8-sandtraps` | 827 | **0** | 230 → 248 declared @248 · 630 → 648 declared @648 |
| `r8-solve-8` | 827 | **0** | 230 → 248 declared @**246** · 630 → 648 declared @**645** |
| `r7-act2-full` | 945 (from t2280) | **0** | 2365 → 2383 declared @**2515** · 2887 → 2905 declared @**3067** |

Before D2 the model had no static damage state at all: every sandtrap read hits 0 until a declared clear removed it, at 246/645 and 2515/3067. Landed hits on the witness are exactly `[164, 197, 230]` and `[564, 597, 630]`. The compare pass on the game (`--only=f4-l8-sandtraps,r8-solve-8,r7-act2-full`) is ALL CHECKS PASSED, including the new row on each, e.g. *"every static body the model killed wrote its own tag in the game — sandtrap@96,80 -> 8:0 (removed t2383, declared), sandtrap@96,128 -> 8:1 (removed t2905, declared)"*.

**Witness 2 (the solver row, four boot states).** These use the JS arc's staging, imported read-only the way `fidelityF1.test.js` does: `createJsRuntime` → `Game(8,144,48)` → `arrivalSolverGoal` → `createRunForStaging(…, {scratchPersistence: true})` → `solveSegment`.

| boot state | result | ticks | hits | the run's own deaths (scratch writes, v9 `declaredAt`) |
|---|---|---|---|---|
| neither cleared | **SOLVES** | **827** | 0 | {8,0}@248, {8,1}@648 |
| {8,0} only | **SOLVES** | **650** | 0 | {8,1}@436 |
| {8,1} only | **SOLVES** | **509** | 0 | {8,0}@248 |
| both cleared | **SOLVES** | **294** | 0 | none |

A run without the scratch layer solves the same 827 keys and banks both tags as `earned`. The JS runtime itself, measured with a scratch copy of `jsRuntimeDeclarations`' `midRoom` (the copy was deleted, not committed), now solves L8 live: 1 solve, 0 declines, 827 keys (prefix 1), the page plays to L9 with zero hits, and its scratch layer writes {8,0}/{8,1} at 249/649, one tick later than above because of its own prefix.

**Witness 3 (the game witness of the uncleared solve).** The uncleared solve's 827 keys equal `f4-l8-sandtraps`' keys on every tick (asserted in `fidelityF4`). That tape is the D1 recording: zero hits in the game (`hits 0`, `hits_timer 0` at the latch), the crossing to L9 on t827, and the flips on t248 and t648, the model's ticks.

**Mutants** (each predicted first, run as copy + restore):
- **m1, the death off** (the static arm never starts "die"). Predicted 9 red / 3 green: the three oracle rows, the death-ticks row, the declarations row and the four uncleared-state solver rows red, these last declining with the new F4 refusal; the both-cleared row, the class rows and the boot-cleared row green. **Measured exactly that.** The solver rows read `BotDriverV2Error: … · ⛓ F4: the run COMPUTES sandtrap@96,80's arrow death … still standing with 3 hit(s)`. Restored md5-identical (`bf05b77a…`). ⚠ The brief predicted *"the solver row declines with the old PendingDeclaration"*. It does not, by design: a computed class whose body survives the bound is the model's own answer, not a tick the game owes.
- **m2, the §11.4 lift reverted** (`STATIC_ARROW_DEATH.SandTrap.policy` = 'refused'). Predicted 10 red / 2 green: m1's nine plus the class row. **Measured exactly that.** The uncleared-state rows decline with the **old** `PendingDeclaration` and the old words *"… sandtrap@96,80 is STILL STANDING in this model — which is correct: §11.4 refuses to compute a static "Enemy" body's arrow death …"*. Restored md5-identical (`f3e9a4b8…`).

**Refusal words.** `rg -a "§11.4|refuses to compute a static|STILL STANDING|GAME-sourced declaration"` over the test tree:
- `solverBot.test.js`: the L8 rows. I updated them: undeclared, the room now solves.
- `twoPassSolve.test.js`: its game-sourced arm used L8 as its only room. L8 now solves in one pass with no declaration and no oracle (a new row). The arm's five control-flow rows keep their assertions through an explicitly synthetic harness (`syntheticGameArm`: the real L8 run, raising the game-sourced declaration at fixed ticks).
- `jsRuntimeDeclarations.test.js`: the JS arc's file, **not edited** (below).
- No pin elsewhere matched; `r8Acceptance` and `levelSetValidator` mention §11.4 only in comments.

**Census of committed tapes** (scratch instrument: per tick, the player, every chaser's x/y/v/hits/i-frames, every arrow in flight and the census body list; md5 per tape; before = `5c4ea0e`, after = head):

| | count | names |
|---|---|---|
| identical | **195** of 196 | — |
| moved | **1** | `r7-act2-full` |
| new | 1 | `f4-l8-sandtraps` |

`r7-act2-full` moves from t2384: `sandtrap@96,80` leaves the census at t2383, not at the declared 2515, and the arrows then fly on to `sandtrap@96,128`, which dies on t2905, not at 3067. Its **player stream is byte-identical** (no hit, no input moved), and it was checked against the game: the body probe reads 945 sampled L8 ticks with 0 disagreements. `r8-solve-8`'s digest does not move, because its early declarations (246/645) remove the bodies before the run's own removals at 248/648 and nothing reads them in between. Its static state now exists, and it is the game's (827 ticks, 0 disagreements). **No committed tape's declaration or inputs move**, and none is re-recorded.

## For the JS arc

| pin | file:line | old | **new, measured** | why |
|---|---|---|---|---|
| "L8: the solver's PendingDeclaration (source game) → declined NAMING the missing oracle; the walker walks" | `jsRuntimeDeclarations.test.js:239` | `s.declines` **1** | **0** | The solver no longer declines L8. Over the same 30 ticks the runtime reads `solverStats = {solves: 1, declines: 0, played: 30, lastSolve: {level 8, keys 827, verbs [kill, shove, walk], prefix 1, end {level 9, x 152, y 24, deaths 0}}}`. Settled, the page plays all 827 keys, `state: done`, crosses `8 → 9` at the teleporter (96,192), with zero hits; `scratchClears` = {8,0}@249, {8,1}@649. |

The row's other assertions (`lastDecline` naming *"GAME-sourced declaration {8,n} (sandtrap@96,80)"*, `no game oracle`, `reason`) fall with it. A proposed patch is to invert the row: `solves 1, declines 0`, state `done`, crossing `8 → 9`. The `declarationRefusal` / `settleSolve` row (synthetic PendingDeclarations) is unaffected and green. Their L8 game-oracle plumbing (probe O's `gameTick`) is no longer needed for L8. Every other static class still raises a game-sourced declaration, but none is in an arrow lane on the map (residue 1).

## Deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 192 | **GREEN 193** | + `STATIC_ARROW_DEATH` (import through `solverView`, `seedling`/`constant`); folds + `staticBodies`, `staticBodyDeaths` |
| constants | PASS 4,937 | **PASS 4,948** | +11; the three new literals classified (`rule`), 0 unclassified |
| profile / entities | 138 / 518 | **138 / 518** | none |
| tape index / tapeRunner | 196 / 449 | **197 / 451** | + `f4-l8-sandtraps` × 2 rows; the 449 W0 pairs identical |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | instruments 321 → 322; docs index |
| bounded vitest | 26 / 1,909 | **34 files / 2,311: 2,308 green, 3 red, all explained** | + `fidelityF4` (12), the roster tests; reds: `rosterCategories` BANK row (residue 3), `jsRuntimeDeclarations` L8 (above), and `seedlingConstantsCensus` (v), which I fixed in `2b4216a` (24/24 green after it) |

## What the brief got wrong (measured)

1. **"Probably ONE hit, not three."** Three. The game clears {8,0} 88 ticks into the hold because the volleys land every 33 ticks (an 11-tick cadence behind 30 i-frames), and "die" adds 18 ticks after the third.
2. **"The model holds … declines … at 478 t; the hold starts at about t160"** is right. But the first hit lands on t164, and the model's own `arrowBodyHits` already showed it, labelled `static-enemy` and billed nothing.
3. **"With {8,0} booted cleared, it waits on {8,1} (655 t)"**: this needs a clarification, not a correction. Booted cleared it is 655 t; declared `@248` (the game's mid-visit tick) it is 868 t.
4. **"`levelWorld.js:~1571` … `notSolid('SandTrap', …)`"**: the row's note still reads as if the clear were the only way out, *"killing one is a LEDGER entry"*. It is, and it is now computed. The `PERSISTENCE_RESPONSE.sandtrap` docblock (*"The model owns no Arrow × Enemy (§16.4, still refused)"*) is now stale for SandTrap. I left both rows untouched: the response is still `despawn`, which is right.
5. **Mutant 1's prediction** (*"the death off ⇒ the solver row declines with the old PendingDeclaration"*): it declines with the new F4 refusal, because the class still says the run computes it. The old declaration is mutant 2's outcome.
6. **"If your witness depends on which of two same-tick arrows lands"**: it does not. All three arrows of a volley overlap the body on one tick, and with an empty `knockback` it does not matter which lands.
7. **The committed tapes' L8 numbers are not the game's.** `r8-solve-8`'s 246/645 came from a truncation search that read the flag after the game had run on, and `r7-act2-full`'s 2515/3067 are later still. The game removes those bodies on 248/648 and 2383/2905.

## Residue

| # | item | refusal / pin (trimmed) | site |
|---|---|---|---|
| 1 | **Every static class but SandTrap** keeps §11.4: an arrow stops on it and does nothing, and the solver raises a game-sourced declaration if a hold waits on one. No other static `"Enemy"` body stands in an arrow lane on the map (arrow traps share a room with a static trap only in L8 and L16, and L16's sandtraps are outside its lanes). DarkTrap's arrow behaviour (stop, no damage: `hit()` overridden empty) is already the game's. | *"… is STILL STANDING in this model — which is correct: §11.4 refuses to compute a static "Enemy" body's arrow death …"*; *"… none of them is a body this run STEPS … §11.4 refuses …"* | `solverBot.js` static arm (~10855) and `drainCeiling` (~7165) |
| 2 | **A sword kill of a sandtrap** is still refused: `KILL_ARM_POLICY.SandTrap` is `refused`. The death staging is the same `Enemy.hit`, but no press has been witnessed on one. | *"the Bob cost; a static hazard whose volume `hazards.js` prices instead"* | `enemyDamage.js:328` |
| 3 | **The composite roster row** (`rosterCategories.test.js:175`): `mechanic` banked 136, the roster now 137 | a BANK row, moved only by `standing-values --write`, which this slice may not run | `scripts/procgen/rosterCategories.test.js` |
| 4 | **`r8-solve-8` {8,0}@246/{8,1}@645 and `r7-act2-full` @2515/@3067** disagree with the game's removals (248/648; 2383/2905). The model now says so on every replay (`staticBodyDeaths[].declaredAt` ≠ `removedAt`, pinned in `fidelityF4`). | none; no input or player stream depends on them | the two tapes; `playthroughWalk.js`'s L8 evidence rows if they quote 246/645 (F1c's file, not read here) |
| 5 | **`solve-seedling-r9-campaign --check` exits 1** (`r8-solve-8` re-solves to the same 827 t, keys differ from t247, no timed rows; window 9's seam oracle passes) | *"r8-solve-8 is byte-identical to what this solver derives — ⛔ DRIFT"* (tape and trace) | `scripts/procgen/solve-seedling-r9-campaign.mjs`; STOP, the user's call |
| 6 | **The derived second shove's last-resort sink** (`solverBot.test` "the derived second shove SINKS the block"). On L8's undeclared pass the second block is no longer a frontier obstacle: the walk pushes it once the sandtrap is gone. No room on the map reaches the sink now, a bounded vacuity. The units row beside it (`world.width` in tiles) is unchanged. | the row now asserts that no second shove is derived | `solverBot.test.js` |
| 7 | **An untagged sandtrap's death** would write OUT OF BAND (`setPersistence(-1)`), and is refused by name. All thirteen in the extract carry a tag. | *"… carries no persistence tag, so its `removed()` would write OUT OF BAND … refused by name"* | `levelRun.applyArrowHit` |

## Byte-inertia

| Artifact | W0 (`5c4ea0e`) | head |
|---|---|---|
| identity log | md5 `771ff8baa769ff4e4d0940ffb24a0541` | md5 **`5014f40750cf7002827b148c2d146230`**: `diff` against W0 is **one line**, the campaign `--check` below. Every census, pair, killgate, level, generated-set and reference row is byte-identical |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, exit 0 | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1` **`fdf740ef` (exit 1)** — `r8-tail` is unmoved because it SKIPs L8 without `--game` |
| tapeRunner | 449 (name, status) pairs, md5 `fb3b59f8…` | **identical**, +2 new rows (451/451) |
| model census, 196 tapes | — | **195 identical**; `r7-act2-full` moved (bodies, arrows), player identical, game-checked |
| `fixtures/**` | — | **added only**: one tape, one expectation, `f4-sandtraps-oracle.json`, the index. No committed tape or expectation moved; `campaign-frontier.json` untouched |

Untouched or not run: AS3, wasm, gitlinks, every committed tape and expectation, biome defaults, `campaign-frontier.json`, the JS arc's files, F1c's regions, `standing-values --write`, `pytest`, the unfiltered vitest.

**Scratch instruments** (session scratchpad and `test-results/f4/`, not committed): the game sampler (`game.mjs`, with `--from` and `--hold`), its analyser, the oracle builder, the model-vs-game body comparator, the 196-tape census, the L8 solve driver, and a throwaway copy of `jsRuntimeDeclarations` for the measurement above (deleted).

## Rows the coordinator must BANK

**CI-read** (not measured here; ⚖ 52): the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`), which will show residue 3 and the JS arc's L8 pin red, and nothing else I know of. The differential's full tier now has 197 tapes; the witness was recorded here, headless.

**Box rows:**
- identity log md5 **`5014f40750cf7002827b148c2d146230`** (bankable only if the `r8-solve-8` STOP is resolved by NOT re-recording; a re-record moves it again);
- `solve-seedling-r9-campaign --check` **`fdf740ef36bb0ef295a12c607b53e93d` exit 1**: NOT bankable as green; it is the STOP (residue 5);
- the other five `--check`s unchanged: `410f27c0…`, `7cba9530…`, `cef8048e…`, `9a6a3192…`, `6cd35fe1…`, all exit 0;
- tapeRunner **451**; constants **4,948**; surface **193**; instruments **322**; roster 196 → **197** (`mechanic` 136 → 137, a `standing-values` row);
- new fixtures: `f4-l8-sandtraps` (expectation `94cc6266f79216c71aa88998b0c37d59`), `f4-sandtraps-oracle.json`.
