# Seedling fidelity PROXIMITY: proximity hazards as obstacles the solver passes

**Slice:** `seedling-fidelity-proximity`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-3`), wave 6.

| | |
|---|---|
| Started from | `origin/main` @ **`88a7e4d`** (`88a7e4daa…`, contains wave 5's `9527592`) |
| Head | the commit that adds this report (the last on the branch). The code head is **`8ba5a31`** |
| Harness branch | `claude/proximity-hazards-obstacles-0zl5s2` (the brief's local name was not used; the harness branch is the only one pushed) |
| Commits | D2 **`ba10336`** · D3 **`509cd9d`** · D4 records **`8ba5a31`** · this report. D1 is measurement: its table is below, its census rows are in `fidelityProximity.test.js` |
| Dev servers | `serve-nocache.py 9380` (primary tree) and `9381` (a scratch worktree, never pushed, used for the game recordings while the base bare pass ran on the primary tree) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (L40/L98 move on to other obstacles, named) · D4 PASS** |

## The one thing to know first

**None of the three "proximity hazards" was a wall in the game, and none of the three survey families was what its family stamp said.**

- **ButtonRoom (L38, steps 68/103/145).** A press is a latch the puzzle needs, not a hazard. With the row (`hold`) the solver presses it — and then stops on the real problem: the chest in the corridor is under a shut `Cover`, whose only opener is a momentary `Button` that a `Pulser` parks a fire block on. That five-link chain is now derived by a new refinement, **`hold → pulse`**. All three steps SOLVE.
- **Button (L29, step 57).** The `skirt` did apply — outbound. The RETURN failed twice over: the return stance tile (the fallrock's own row) has no wall to align against, and every walk between the two crossings had moved x off the 0.05 grid, from which an x-only align can never land the one admissible x. Both fixed; step 57 SOLVES.
- **IceTurret (L40/L98, steps 109/215).** The census volume is the 129 px attack range; the game charges a volley (`freeze(15)` + one damage per blast, stopped by walls and by a faced shield). New verb **`brave`** crosses it. Pricing the body's contact (as briefed) exposed a model bug the game measured: a live turret's sweep treated the player as a solid (0.0131 px off on the contact tick). Steps 109/215 now refuse on the NEXT obstacle, by name.

**Byte-inertia:** the identity block is byte-identical (`3d79bab0bdd9e262eb8e42c07a609d18`, six `--check`s unchanged); every one of the 511 BEFORE tapeRunner pairs is unchanged. No flag was needed.

## W0 (at `88a7e4d`, before any edit)

| Row | Command | Result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` |
| identity block | `SEEDLING_PORT=9380 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`3d79bab0bdd9e262eb8e42c07a609d18`**, exit 0; reference ALL 7 + 5 MATCH; generated set OK |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, all exit 0 |
| route survey | `survey-seedling-route.mjs --through=end` | 236 steps: **137 SOLVED / 97 REFUSED / 2 TIMEOUT** |
| bounded vitest BEFORE | 56 files (the brief's list + every test naming a function/table touched: `rg -al` over OBSTACLE_STRATEGIES, STRATEGY_REFINEMENTS, STRATEGY_EXECUTORS, KNOWN_STRATEGY_VERBS, executorDerivations, CONTACT_STEPPED, contactPricing, fallTrapPresser, skirt, iceturret, buttonroom, pulser) | **56 files / 2,303 tests, all green** |
| tapeRunner | sorted `(fullName, status)` | **511** pairs, md5 `0ce826422e03bda48b1733c7bd18a08f`, 0 failed |
| surface / constants / entities / profile | the four `--check`s | GREEN 198 (json `e80fdf30…`) · PASS 4,977 · PASS 518 · PASS 138 (both JSONs) |
| roster | `fixtures/tapes/index.json` | **227** |
| sweep legs | `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` | 799 legs (725 exit, 74 location) |

The survey's proximity rows at the base, word for word as briefed: 57 (L29 `button@112,128`, VERB-APPLY skirt), 68 / 103 / 145 (L38 `buttonroom@144,128`, VERB-MISSING), 109 (L40 `iceturret@472,400`), 215 (L98 `iceturret@104,24`). The `lavatrap` rows (180, 181, 227) are D7's and untouched.

## D1 — what "proximity" means, and what the game punishes (PASS, measured)

Read from the AS3 (`Puzzlements/ButtonRoom.as`, `Puzzlements/Button.as`, `Puzzlements/Cover.as`, `Puzzlements/Pulser.as`, `Scenery/FallRock.as`, `Enemies/IceTurret.as`, `Projectiles/IceTurretBlast.as`, `Enemies/Enemy.as`, `Player.as`).

| class | the model's volume | the game's truth | verdict |
|---|---|---|---|
| `ButtonRoom` | the 8x6 press rect (`setHitbox(8, 6, 4, 3)` at the ctor half-tile), a `stand-on` hazard | a press is a LATCH (`set activate` is `if (a)`, *"Can't be reset to false!!"*): `room == -1` publishes `t` in the room; `room >= 0` clears a flag in another level (all four in the game are `flip = 1`: L38→L37, L38→L39, L61→L63, L63→L62). No damage, no freeze, no move | **not a hazard**: the press is the puzzle |
| `Button` (L29) | the same rect; the group answers only `fallrock@112,112` | a press calls `FallRock.fall()`: `freezeObjects` for 60 ticks, the camera, a persistence write, and the rock lands as a Solid in the shaft (row 7) — sealing the Boss Key's pocket for good | **a real trap**: skirt it, both ways |
| `IceTurret` range | a `point` disc, r 129 (`attackRange` 128 compared as an `int`) | inside it the turret turns a tenth of the angle per tick and, every `shootTimerMax` 25 ticks plus its animation, fires three 6 px/tick blasts along its OWN (lagging) angle. A blast that reaches the player is `freeze(15)` then `hit(null, 0, p)`: one damage, no knockback, behind i-frames. A wall (`"Solid"`) or the faced shield entity (`"Shield"`) stops it | **not a wall**: a cost the run steps |
| `IceTurret` body | contact UNPRICED (`pricedBy: null` → the census scan THREW on a live-body contact) | `Enemy.hitPlayer` while `currentAnim != "dead"`: `p.hit(this, 3, (x, y), 1)` behind `hitsTimer <= 0`. The live turret is `"Enemy"`, not solid; `"Player"` joins its sweep's solids only in `death()` | priced (D3) |

⚠ The census's `iceturret` effect string still says *"Player.freeze(90)"*; the source is `freezeTime = 15` (`IceTurretBlast.as:261`) and the run already uses 15 (`BLAST_FREEZE_TICKS`). The string was left (a census text, not a number; named in Residue).

**Per survey step / sweep leg:**

| row | hazard | model | game | after |
|---|---|---|---|---|
| step 68 (L38, collect chest) | `buttonroom@144,128` | wall | a latch; the chest is under `cover@144,112` | SOLVED 358 t |
| steps 103, 145 (L38 → L39) | same | wall | same; the chest blocks the north corridor | SOLVED 359 t each |
| step 57 (L29 → L22) | `button@112,128` | skirt (outbound only) | a trap; both crossings must miss the rect | SOLVED 596 t |
| step 109 (L40 → L39) | `iceturret@472,400` range | wall | volleys | REFUSED: keylock loop at `bosslock@480,352` |
| step 215 (L98 chest) | `iceturret@104,24` range | wall | volleys | REFUSED: the chest's 1-px rect-vs-line sliver |
| leg 296 (L29 exit) | button | refused | trap | SOLVED 342 t |
| leg 338 (L38 exit) | buttonroom | refused | latch | SOLVED 627 t |
| legs 530 / 532 / 535 / 539 (L63 exits) | `buttonroom@32,64` (L63→L62, `flip = 1`) | refused | a latch writing a clear in L62 | SOLVED 120 / 150 / 119 / 132 t |
| legs 542 / 544 (L63 exits) | same | refused | same | REFUSED: combat ladder at L63's `spinningaxe@128,80` (AXE's region) |
| leg 708 (L98 exit) | turret range | refused | volleys | REFUSED: L98's kill-lock (the turret must DIE — `classCount(IceTurret)`) |

## D2 — the ButtonRoom row, the covered chest, `pulse`, and the skirt (PASS, game-witnessed)

**The transcription** (`ba10336`, `solverBot.js`):
- **`OBSTACLE_STRATEGIES['proximity-hazard:buttonroom'] = 'hold'`.** `openerPresserFor`'s "the obstacle IS the presser" arm already derives the stance, the exemption and the hold; the run already models the press (`pressedGroups`, the cross-room write, F6's `bootPress`, `latchAtBuild`). No new executor.
- **A chest under a SHUT `Cover` is the cover's order first** (`coverOverChest`): in `resolveChestStrategy` (the frontier path) and in the goal path's placement-blocker loop, where `placementBlocker` cannot see a solid in the chest's own cell.
- **`hold → pulse`** (a new `STRATEGY_REFINEMENTS` row; `pulseWeighFor`, `resolvePulseStrategy`, `execPulse`; `STRATEGY_EXECUTORS.pulse`). It fires when a responder's every opener is a momentary `button` and a room `Pulser`, published by a LATCHING presser, has a live `pushableblockfire` in its 22 px reach whose pulse push (`pulser.pulsePushes`, the run's own transcription) lands it on one of those buttons. The resolution is the publisher's own `hold`; when the publisher sits under its own shut cover (L38's `buttonroom@208,224` under `cover@208,224`) the cover's latching opener is held first (the `uncover` stage). Then a wait until the run reports the responder open, bounded by two pulser cycles + the fade + `HOLD_SLACK`. A press the stance walk already made is not held again (`openedOnApproach` / `pressedOnApproach`; `runHold` refuses a hold that changes nothing).
- **`skirt`, the return.** (1) A fallback stance up to `SKIRT_STANCE_REACH` (3) tiles out where the align wall covers ±`SKIRT_STANCE_BAND` (3) px — asked ONLY when the original rule finds no lane, so every skirt it already resolves keeps its stance. L29's return aligns on row 5. (2) **`skirtGridKept`**: once the run has skirted in this level AND a remaining goal of the segment aims back across the button row, every `walkTo` is axis-aligned and `execCollect` approaches the pickup with `holdOneAxis` (a frames-1 pickup's collection inside that approach is recorded in `runCollect`'s shape). Without it the return stance was reached at x = 125.34132982111198, from which no x-only sequence of any depth lands 126 (measured, depth 16/24/32, both lanes).

**Witnesses** (`scripts/procgen/plan-seedling-proximity-witness.mjs`, the survey's staging; `--check` byte-identical). Recorded with `check-seedling-bot-differential --record --only=…` on p4f (headless logic-only, port 9381) and compared: **ALL CHECKS PASSED**, *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*.

| tape | what | plan | game = model |
|---|---|---|---|
| `prox-l38-chest` | step 68 | `pulse` (uncover: `buttonroom@144,128`), `pulse` (the pulser pushes `pushableblockfire@80,208` on t146), `chest` (opens t249), out by `teleporter@144,0` | 359 obs, 38→39; keys, totem, seal parts and `save.time` (9316) all agree |
| `prox-l38-reach-l39` | step 103 | `hold` (`buttonroom@144,128`), `pulse`, `chest` | 360 obs, 38→39 |
| `prox-l29-key-return` | step 57 | skirt N (east lane x 126, 38 t), the Boss Key, skirt S from row 5 (63 t), `fallrock@112,112` never falls | 597 obs, 29→22; the press rect is never entered |

`fidelityProximity.test.js` (D2): the row, the refinement, the executor, its derivations, the known verb; `pulseWeighFor` on L38 (and its CONTROL: `cover@208,224`'s opener latches, so `null`); both L38 solves with the tape = the plan key for key, and `unknownStrategyVerbs: []`; the L29 solve (two skirts, no fallen rock), tape = plan; the three game rows at 0 px. `procgenWeigh.test.js` drives the new refinement row (`hold -> pulse`, L38 from the survey's step-103 staging).

**Mutants** (predicted first, copy → edit → run → copy back; `solverBot.js` restored md5 `9e5243310454ee9965c44cf8b40b8ed1` each time):

| mutant | predicted | measured |
|---|---|---|
| m1: the buttonroom row removed | 103 VERB-MISSING; **68 still solves** (the goal path presses it through `pulse`'s uncover stage) | 2 red (the table row, step 103); survey **68 SOLVED 358**, **103 VERB-MISSING** *"Obstacle: proximity-hazard:buttonroom … No strategy row exists"* |
| m2: `pulseWeighFor` → null | 68 and 103 refuse | 3 red; **68**: *"the placement is INSIDE solid:cover (cover@144,112) … No strategy row exists"*; **103**: VERB-APPLY `chest` |
| m3: the frontier's covered-chest arm removed | 103 refuses "NEVER OPENED"; 68 solves | 1 red; **103**: *"chest@144,112 NEVER OPENED in 400 ticks … the cover is"*; 68 SOLVED 358 |
| m4: the fallback stance removed | 57 VERB-APPLY on the return | 1 red; **57** VERB-APPLY *"Obstacle: proximity-hazard:button (button@112,128)"* |
| m5: `skirtGridKept` → false | 57 fails at the align | 1 red; **57**: *"no x-input sequence of at most 16 ticks takes the stance state (x=125.34132982111198, vx=0) EXACTLY onto x=126"* — the base's own cause |

## D3 — the ice turret (PASS; L40/L98 decline on the next obstacle, by name)

**The transcription** (`509cd9d`):
- **Contact priced.** `combat.CONTACT_STEPPED_PRICED_BY.iceturret = 'stepIceTurretsNow'`; `iceTurret.stepIceTurret` gains an optional `hitPlayer` callback at `Enemy.update`'s tail (after `hitUpdate`, gated `!dead && hitsTimer <= 0 && overlap`); `levelRun.stepIceTurretsNow` passes `applyPlayerHit({source: 'iceturret', force: 3, damage: 1, from: the turret's live point, retaliate: the dark suit's hit, refused by name if it kills})`, and `null` under `noDamage`/`noclip`. The census scan skips the class. `ICE_TURRET_CONTACT` carries the numbers.
- **The sweep fix the game demanded.** `blockedAt` treated the player as a solid for every turret; `"Player"` joins only in `death()`. The first recording refuted the model on the contact tick: *"tick 20 differs: expected y=404.6729288638602, got 404.65982583581604 [dy=-0.0131]"*. With the player in the body the live turret's y-snap still runs (423.5, not 424), and `(488, 423.5)` reproduces the game's knockback to Δ0.0130. After the fix: 49/49 observations at 0 px. Unreachable before (the contact threw).
- **`OBSTACLE_STRATEGIES['proximity-hazard:iceturret'] = 'brave'`** (`resolveBraveStrategy`, `execBrave`, `STRATEGY_EXECUTORS.brave`): a zero-tick exemption of the range; the walk the loop then plans pays the volleys the run steps (and the death reboot, if it comes to that). A corpse (`run.turrets`) is named as one.

**Witnesses** (hand-authored keys, same producer; recorded and compared, ALL CHECKS PASSED):

| tape | what | game = model |
|---|---|---|
| `prox-l40-turret-contact` | boots at entity (496,384) and walks `down` into the live body | 49 obs, the contact on t20 (`source: 'iceturret'`, `knockback.dy` −2.727…), 0 px after the sweep fix |
| `prox-l40-turret-volley` | boots at entity (488,464) in the turret's corridor, walks `down`, rests (**no shield**) | 121 obs; volleys on t4, t49, t93; the third lands on t103 (a 15-tick freeze, one hit); 0 px |

⚠ **Measured on the way:** with the route's inventory (`hasShield`) the volley tape drew two volleys and NO hit — the faced shield takes the blasts — and in row 24 the wall tiles shield the walk entirely. The second volley's centre blast passed 0 px from the box (the aim lags a tenth per tick).

**Mutants** (`levelRun.js` restored md5 `504260d2b37a012a1cdb46873bb27999`):

| mutant | predicted | measured |
|---|---|---|
| m6: the `hitPlayer` callback off | the contact rows red; the volley green | 2 red (the bill, the contact's game row) |
| m7: the sweep fix reverted | the contact's game row red, 0.013 px | 1 red (the contact's game row) |
| m8: the iceturret row removed | 109 / 215 VERB-MISSING | 1 red (the table row); survey **109 / 215 VERB-MISSING** |

**L40 + L98:** both now refuse on the obstacle behind the turret — step 109 on a `keylock` loop at `bosslock@480,352` (*"applied 4 strategies … the corridor still does not plan"*), step 215 on the chest's own volume (Residue 2). L98's exit (leg 708) is a kill-lock the turret itself holds shut, so L98 ultimately needs a turret KILL.

## D4 — the census before → after (PASS)

**Route survey** (`--through=end`, full, at the base and at the code head — the head run in the scratch worktree, `solverBot.js` byte-equal to `509cd9d`): **137 / 97 / 2 → 141 / 93 / 2.**

| step | level | before | after |
|---|---|---|---|
| **57** | L29 | VERB-APPLY skirt | **SOLVED 596 t** |
| **68** | L38 | VERB-MISSING buttonroom | **SOLVED 358 t** |
| **103** | L38 | VERB-MISSING buttonroom | **SOLVED 359 t** |
| **145** | L38 | VERB-MISSING buttonroom | **SOLVED 359 t** |
| 109 | L40 | VERB-MISSING iceturret | REFUSED (unclassified): keylock loop at `bosslock@480,352` |
| 215 | L98 | VERB-MISSING iceturret | REFUSED (unclassified): *"the route entered a proximity-hazard — chest at (160,32) … at (168.597…,51.326…)"* |
| 72, 111 | L38 → L37 | the chest-stance loop | *"no REACHABLE stance inside buttonroom@144,128 … from (152,24)"* (the staged boot has the chest shut; see Residue 5) |
| 226 | L107 | VERB-APPLY (frontier `buttonroom@288,176`, `crusher@32,0`) | LADDER: the hold stance's corridor crosses `crusher@32,0`'s lane |
| 70, 105, 161, 196 | L40, L63 | — | same verdict and obstacle; only the "also on the frontier" list moved (a registered verb sorts first) |

No step that solved at the base refuses now; the 2 TIMEOUTs are unchanged.

**Sweep legs** (`seedling-divergence-bare.mjs`, node, the same engine path; exit legs with an atlas dump, location legs with the vanilla delivered set dumped by `probe-seedling-divergence-sweep.mjs --dump`):

| legs | before | after |
|---|---|---|
| exit 296 (L29), 338 (L38), 530, 532, 535, 539 (L63) | proximity refusals | **SOLVED** |
| exit 542, 544 (L63) | proximity-hazard:buttonroom | combat ladder at the axe |
| exit 708 (L98) | proximity-hazard:iceturret | the kill-lock |
| location 340 (L38 chest) | proximity-hazard:buttonroom | `solid:cover` — in the delivered set the chest is an **APItem** under `cover@144,112`, and `solid:cover` has no row (Residue 4) |
| location 352, 355 (L40 totem 64,144) | proximity-hazard:iceturret | TIMEOUT (120 s) |
| location 710 (L98 chest) | proximity-hazard:iceturret | combat ladder at `spinningaxe@96,64` |
| exit 294 (L29) | SOLVED 364 | SOLVED 364 (unmoved) |

**L63:** four legs solve now (530, 532, 535, 539). Whether they are the four the J2 walker crossed I cannot confirm from here (the CI sweep's walker rows are not in this checkout); 542/544 still refuse, on L63's spinning axe.

**Records:**

| Row | W0 | head | movers |
|---|---|---|---|
| identity log | `3d79bab0…` | **`3d79bab0bdd9e262eb8e42c07a609d18`**, `diff` empty | none |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724` | identical, all exit 0 | none |
| tapeRunner | 511, `0ce82642…` | **521**, md5 `1a92dc77eff4277b9a5e1684782172c7`; the 511 old pairs are a subset | +10 (the five witnesses, a differential row and a stepping row each) |
| roster | 227 | **232** (`generate-tape-index.mjs`) | the five `prox-*` tapes |
| solver surface | GREEN 198 | **GREEN 202** (`--write`, classify, `--check`, `--write` again identical) | + `import:PULSER`, `pulsePushes`, `pulserCycle`, `newPushable` (through the `solverView` door: a direct import is the surface's RED *door* finding); site-count drift |
| constants | PASS 4,977 | **PASS 4,981** (`--profile-rows` → `--write` → `--check`) | + `ICE_TURRET_CONTACT` force 3 / damage 1, the contact's `hitsTimer <= 0`; `levelRun`'s `terrainAt` `?? 0` re-keyed (its statement grew) and the old function-level row retired |
| profile / entities | 138 / 518 | **138 / 518** | none |
| entityBlocks | — | `turrets.solverReads` += `solverBot` (and the surface doc's table row) | `brave` reads `run.turrets` |
| reference | ALL 7 + 5 | **ALL 7 + 5 MATCH**; `check-procgen-docs` ALL CHECKS PASSED; `check-procgen-help --in-place --only=plan-seedling-proximity-witness.mjs` ALL PASS | the log entry, `seedling-bot.md`, instruments +1 |
| bounded vitest AFTER | 56 / 2,303 green | the same 56 + `fidelityProximity`: **57 files / 2,325**; 3 red on the first run, all bookkeeping (the constants force row, `entityBlocks`' `turrets` reads ×2), fixed and re-run green; the final re-run of those files + `tapeRunner` + the pins: **885 / 885** | + `fidelityProximity` (16 rows) |

⚠ **One standing row is red at the head, by design:** `scripts/procgen/rosterCategories.test.js` (not in the bounded set) reads *"expected 167 to be 172"* — the composite standing value, +5 for the five new tapes; green at the base. Re-sealing it is `standing-values --write`, which this slice may not run (see BANK).

**Pins** (unions, by name): `tapeEnvelope`, `observationTolerance` (incl. `swapped`), `dialogueAutoAdvance` (inert) **227 → 232**: `prox-l38-chest`, `prox-l38-reach-l39`, `prox-l29-key-return`, `prox-l40-turret-volley`, `prox-l40-turret-contact`. `tapeIndexManifest` follows the index. **`R8_ENEMY_BRIDGE`** (the exposure three slices missed): `prox-l29-key-return` (ends on L22's arrival, `bob@96,144`), `prox-l40-turret-volley` and `prox-l40-turret-contact` (L40, 12 bobs + 2 punchers, none reaches) declared, with the test's three mirrors; exposed 59 → 62. The stepped-contact partition now bridges `iceturret`: `refused: []`.

`boxLock`: the witness producer takes no box (no browser), so `guarded` is unchanged.

## The JS arc's pins and what it must wire

**No JS-arc pin moved**: `jsRuntimeDeclarations`, `jsRuntimeArrivalOnDoor`, `jsRuntimeAtlas`, `solverDeadline`, `seedlingCanCross` are in both bounded runs, green. No JS-arc file was edited; `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` keep their contracts. No new `SolverRefusal.obstacle.kind`.

**What it gains / must wire:**
- Two verbs in trace rows and records: **`pulse`** (records carry `stage: 'uncover'` or `{publisher, pulser, block, button, waited, pressedOnApproach?}`) and **`brave`** (a **zero-tick** record: `ticks: 0`, the range exempted for the rest of the goal). Both are in `KNOWN_STRATEGY_VERBS`.
- A solve through a skirted room now walks AXIS-ALIGNED between the crossings (no dash, no opportunistic strike on those walks).
- A live-turret contact is billed rather than refused, so a live walk into a turret body is a hit, not a throw.
- New optional exports: `solverBot.pulseWeighFor`, `solverBot.coverOverChest`, `iceTurret.ICE_TURRET_CONTACT`.

## What the brief got wrong (measured)

1. **"236 steps, 128 SOLVED / 96 REFUSED / 12 TIMEOUT"** (the RULES arc at `f90c4eee46`). At `88a7e4d` the survey reads **137 / 97 / 2**. The six proximity rows reproduce exactly as briefed.
2. **"`VERB-MISSING proximity-hazard:buttonroom` ×3"** as the whole family. The row was missing, but it was the first link: with it, all three steps stopped on `chest@144,112` *"NEVER OPENED"* — the chest is under a shut cover whose opener is a momentary button only a Pulser can hold. The fix is a refinement, not a row.
3. **"`VERB-APPLY proximity-hazard:button` (L29, the `skirt` verb did not apply)".** It applied outbound. It failed on the return — no wall on the stance row, and the x grid lost between crossings.
4. **"IceTurret's contact is UNPRICED"** is true, but it is not what blocked steps 109/215: the RANGE disc did. Pricing the contact exposed a second divergence (the live turret's sweep stopped at the player).
5. **"(collect-placement): obstacle proximity … L38, L40, L98".** In the vanilla delivered set those placements are APItems: L38's sits under `cover@144,112`, whose frontier row (`solid:cover`) does not exist.
6. **"L63's four walker-crossed legs must SOLVE"**: four L63 legs solve; that they are the walker's four is not verifiable from this checkout.
7. **"proximity-hazard:iceturret … L40, L98 solve or decline by a true name"**: they decline by the NEXT obstacle's true name (a keylock loop; the chest volume) — and L98's exit needs the turret DEAD (its kill-lock), which `brave` does not do.

## Residue

1. **Step 109 (L40):** a `keylock` loop at `bosslock@480,352` from the L42 side — four keylock applications and no corridor. Not this family.
2. **Step 215 (L98) — the chest's census volume is wrong by a pixel.** The `chest` hazard is the rect `[y, y+18)`, but `Chest.update`'s trigger is `collideLine` on the integer row `y+17`. A box with `y` in `(49, 50)` overlaps the rect without containing the row: the drive's detector calls it "entered" and nothing in the game happens. A `line` volume would fix it — and would re-plan around every chest (possible tape movers), so it is left for a slice that can measure that.
3. **L40's turret corridor**: the danger map prices the live body (a static Enemy) and finds no path through the 8 px gaps beside it; the AVOID rung refuses (leg/harness measured). A rung that threads an 8 px gap, or a kill.
4. **The APItem under a cover** (delivered set, L38): `solid:cover` has no strategy row (FRONTIER's family); the apitem goal path has no covered-placement arm. `pulse` would apply unchanged once the cover is the obstacle.
5. **Steps 72/111 (L38 southbound):** the staged boot has the chest shut and the buttonrooms unpressed; from the north the chest blocks the way to `buttonroom@144,128`. In the campaign the chest is already open (the survey's staged boots do not carry it).
6. **`brave` walks blind.** No blast forecast exists in `previewWalk`; a crossing that would die is refused by the run's own death, after the fact. The faced shield blocks blasts — a free defence `brave` does not plan for.
7. **The census `iceturret` effect string** says `freeze(90)`; the game and the run use 15.
8. **L98 needs a turret kill** (its stairs are a `tset = -1` kill-lock); L63's 542/544 and L98's 710 stop at spinning axes (AXE's region); step 226 (L107) at a crusher lane.

## Byte-inertia

- **No committed tape, expectation, trace, declaration or producer digest moved**: the identity block is byte-identical, and the 511 BEFORE tapeRunner pairs are unchanged. Added: five tapes, their five game expectations, the regenerated `index.json`.
- Tape / expectation md5 (first 8): `prox-l38-chest` `185d163a` / `df03cee3` (358 t); `prox-l38-reach-l39` `f35a96ce` / `1628bad2` (359 t); `prox-l29-key-return` `9a66b4c7` / `8c37a5f0` (596 t); `prox-l40-turret-volley` `7c1dd887` / `7abe9d26` (120 t); `prox-l40-turret-contact` `059a7ca7` / `d2872091` (48 t).
- The `skirt` changes are additive (a fallback only when the old rule finds no lane; the grid rule only when a crossing back is owed) — `solverSkirt.test.js`'s pinned 150 / 379 t are unchanged. The contact bill is `null` under `noDamage`, and a live-body contact used to throw. The sweep fix is reachable only with the player in a live body, which threw before.
- Not touched: the AS3, the wasm, every gitlink, the rules; the JS arc's files; the other wave-6 regions (ARRIVAL's inside-solid read, AXE's axe pricing, FRONTIER's `solid:*` rows and pixel mask, TERRAIN's physics). `OBSTACLE_STRATEGIES` gained two rows (`proximity-hazard:buttonroom`, `proximity-hazard:iceturret`), none reordered or reworded.
- Not run: `standing-values --write`, `pytest`, the unfiltered vitest. No `git stash`. Every mutant was copy → edit → run → copy back, md5-checked.
- Scratch (not committed): two worktrees (`/home/user/wt-prox`, `/home/user/wt-base`), both survey JSONs, the bare/location JSONLs, the vitest JSONs, the identity logs, the delivered-set dump, the mutant runner.

## The identity rows the coordinator must BANK

- identity log md5: BEFORE = AFTER **`3d79bab0bdd9e262eb8e42c07a609d18`**
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `56bb3724fd0ed3dda184e6e7d6d5d27c`, all exit 0
- counts: tapeRunner **521** (pairs md5 `1a92dc77eff4277b9a5e1684782172c7`), roster **232**, surface **GREEN 202**, constants **PASS 4,981**, entities 518, profile 138, instruments +1
- `R8_ENEMY_BRIDGE` exposed **62**; the stepped partition bridges `iceturret` (`refused: []`)
- route survey (`--through=end`): **141 / 93 / 2**
- **`scripts/procgen/rosterCategories.test.js` is RED at the head** (*"the LIVE row carries one part per derived category …: expected 167 to be 172"*; green at `88a7e4d`, 18/18): the composite standing value is owed +5 for the `prox-*` tapes. `standing-values --write` is not licensed here, so the coordinator re-seals it when banking
