# Seedling fidelity L67BK4 — L67's spear block parked on the trap's button (`laneWeigh`, OFF) and L43's Totem fought (`totemBossFight`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-l67bk4` (planner `seedling-fidelity-planning-13`, wave 31) |
| Start SHA | `89da08f355` (= `fidelity-harvest/w30`: main `cfc681a566` + W30 flipped ON, 77 default-ON keys) |
| Code head | `73a1308d` (CI `JavaScript Unit Tests` green: **22,877 / 0 failed**, slow 268 / 268, run 40225639594); the report is the commit after it |
| Harness branch | `claude/l67-boss-key-4-1ktz4x` (nothing pushed elsewhere) |
| Port | 9737 (primary tree); 9738 the W0 worktree, 9739 an ON worktree (both literals flipped) for the probe battery, 9740 the AFTER identity worktree |
| Verdicts | **W0 PASS · D1 PASS behind `laneWeigh` (OFF) · D2 PASS behind `totemBossFight` (OFF) · game witnesses PASS (p4g, 0 px, 11/11 clocks) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-l67bk4-evidence/`; fixtures `frontend/modules/seedlingDemo/fixtures/l67bk4-witness/cap{898,862,872}.jsonl.gz` |

## The one thing to know first

**Neither room was a refusal the game agrees with.** L67's ladder did not run out of rungs because of the arrows. An
earlier, cheaper move had **sunk the room's own answer**: the clear-path block search pushed L67's only spear block
into a pit (one thrust), and the button that silences the trap was left with no holder. L43's `bosstotem` is a real
wall, a Solid before the wake and the clamp after, but the model already stepped the whole fight. Only the solver had no
verb for it. Both are now solved inside 640 units and played on the game at 0 px. The 13 L43 corridor legs and leg 898
go `failed → done` in the keyed sweep.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | harness branch reset to `89da08f355`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9738 bash scripts/procgen/identity-block.sh .` at a pristine detached worktree of `89da08f355` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `7e1497c4`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `a591fa9d` · l18 `6460d60d` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `27478177`, all exit 0 |
| generated set | in the block | NOT MEASURED (the worktree has no venv; environmental, named) |
| reference | in the block | 4 DIFFER: the known box artifact (registry, capabilities, two substrate regions) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **353** · PASS **6,938** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` (`evidence/tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 180 files (`evidence/vitest-files.txt`: the brief's list, TURRETCIRCLE's 131, and every test naming `resolveSpearPushStrategy`, `deriveLaneSilencer`, `deriveWeigh`, `deriveBlockRoute`, `OBSTACLE_STRATEGIES`, `STRATEGY_EXECUTORS`, `CONTACT_FIDELITY_KEYS/DEFAULTS`, `entities('bosses')`, `bosstotem`/`BossTotem`, `switchGatedRow`, `pushableblockspear`, `R8_STRATEGY_EXECUTORS`, `KNOWN_STRATEGY_VERBS`, `frontierExecutor`), base worktree | **5,452 / 5,453**; the one red is the environmental `seedlingAtlasArm` |
| `fidelityL32ArenaPrefix.slow` | `vitest -c vitest.slow.config.js` | 5 / 5 |
| the legs, re-derived at the base | `seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks` | 918 legs. **L67 Boss Key 4 is leg 898 here (the brief's 908)**; L43's `bosstotem` corridor is legs **862–874** (13, `level_43__r3c8 <- {in_L40_320_576, in_pit_L40_*} ~> level_43__r13c7 ~> level_43__r8c7 -> exit:out_teleporter_144_64`). The keys are in `evidence/leg-keys.txt` (54 legs: every L43/L67 leg) |
| captures | local sweep, p4g, `inv`, page-legs 1, `--capture-requests` on legs 898, 862, 872 | 898: *"the combat ladder is EXHAUSTED … arrowLane:arrowtrap@48,48"*. 862/872: *"no corridor … Obstacle: solid:bosstotem … No strategy row exists"* |
| replay (node) | `replay-seedling-solve-request.mjs --id=898`, `SEEDLING_ARROW_LANE_CROSSING=0|1` | OFF: the ladder refusal (58 units, both passes). **`arrowLaneCrossing` ON** (the brief's ask): *"ARROWLANE … the crossing is not admitted: the fork's drive is refuted — waypoint 5 (56,152): not reached within 400 ticks"*. A tank-a-hit crossing is not this room's answer anyway (below) |

## D1 — L67 Boss Key 4 (PASS, behind `laneWeigh`, OFF) — `4f7817a0`

### What the ladder runs out on, measured

L67 is `Dungeon6/8.oel`:

```
<pushableblockspear x="144" y="112"/>   <button x="96" y="112" tset="0"/>
<bosskey x="48" y="64" keyType="4"/>     <arrowtrap x="48" y="48" tset="0" shoot="1"/>
<lightpole x="160" y="104" tset="-1" tag="1"/>   <teleporter x="224" y="112" to="59"/>
```

The trap is `shootDefault` (it fires until its group is pressed), and its lane runs down through the key. Group 0 is
the button, so a block parked on the button silences it. `Button.update` re-collides `["Player","Enemy","Solid"]` every
tick, and the run's `armedArrowTraps` reads `pressedGroups` with the moving solids. The light pole is `tset -1`: a
light, not a switch. The spear block stands at tile (9,7), the only cell between the arrival region and the west half.

Reading the run at the ladder's refusal: **`pushableblockspear@144,112` is `removed`, at x 128**. The frontier's
`shove` had already run `deriveBlockRoute`'s clear-path search, whose cheapest answer is *one thrust W into the pit at
(8,7) (DESTROYED there)*. That empties the corridor and loses the room. `deriveBlockRoute`'s `press` goal onto the
button tile (6,7) does exist, measured from the arrival: **N W W S W, five thrusts, 11 expansions**, and it empties
the same cell.

### The change

`contactFidelity.js`: `laneWeigh` (OFF; `SEEDLING_LANE_WEIGH=0|1`). In `resolveSpearPushStrategy`, when the clear-path
route DESTROYS the block, `laneHolderRoute` is asked: a `press` route parking it on a `Button` whose group silences a
trap that is armed now (`armedArrowTraps` ∧ `!arrowTrapFires(trap, true)`), with no order destroying it. If one
exists, it replaces the clear-path route. The resolution keeps the shove's shape (`route`, `slot`, `weapon: 'spear'`,
plus `laneHolder: {presser, traps}`), and its rejected list names the sinking route and why it was dropped. Everything
downstream is unchanged: `execRoute` → `execSpearPress`, the walk, the collect. By census only L67 can trigger it: of
the three `shoot="1"` rooms (`Dungeon2/3`, `Dungeon6/8`), only `Dungeon6/8` has a button on the trap's own group.

A ladder arm that would weigh the button from inside the PULL rung was built and removed. It never fired on any leg,
because the block always stands between L67's door and the key, so the clear-path yield always answers first.
Unmeasured code was not shipped.

**Measured** (`fidelityL67Bk4.test.js`): leg 898's request ON solves in **233 units** (dashless 75, full 158; 801 t,
verbs `shove, walk`). The replay takes no hit and ends with the block on (6,7), the trap silent and the player on the
key's cell. **Seam census ±10: 21/21 clocks, one answer** (`evidence/census-898-on.jsonl`).

## D2 — L43's Totem (PASS, behind `totemBossFight`, OFF) — `c1ded8d6`, `07fce177`, `d2d86cfa`

### Is the body a real wall? Measured

`BossTotem.as:280-330`. Until it wakes the body is `type = "Solid"`, an 80x32 box at `[112,192) x [180,212)`: exactly
the arena's five open columns. Once `fullyActivated`, `p.y` is assigned to the body's bottom every tick (the clamp).
The north half (the magical lock at (144,112) and `teleporter@144,64 → L37`) is therefore reached only after the kill.
The rules agree (`r13c7 → r8c7` needs 5 shards + Wand). The legs hold both, and in the AP-delivered room the Wand
location is an `apitem`, so `classCount(Wand) <= 0` and the body wakes on the first live tick (measured: `activated`
at t0). **The body is a real wall, and the refusal was a solver gap:** `bossTotem.js`/`bossTotemFight.js` already step
the wake, the descent, the laser, the attack's shots, the 20-tick pacer, the death and the white-out (R6, the
game-witnessed `r6-totem-kill`). Only the strategy row was missing.

### The change

- `contactFidelity.js`: `totemBossFight` (OFF; `SEEDLING_TOTEM_BOSS_FIGHT=0|1`).
- `solverBot.js`: `solid:bosstotem` → `totem` and `totem` → `execTotemBoss`, both switch-gated rows (Lights' shape:
  absent and non-enumerable OFF). `resolveTotemBossStrategy` binds the body and refuses by name when the switch is off,
  the body is dead, or the run holds no Wand slot (`onlyHitBy = "Wand"`). D2b adds a refusal while the body sleeps with
  an untaken vanilla `wand` pickup in the room (below). `execTotemBoss` selects the Wand and walks to the stance (west
  of the laser's fixed band, `d0` below the body). It then plays each `BOSS_TOTEM_POLICY_VARIANTS` entry on a FORK until
  the body is REMOVED (one tick after the white-out's request) with no death, keeping the first hitless variant (else
  the fewest hits), and plays that variant on the run. The run must bill the fork's hit count.
- `bossTotemPolicy.js` (new): the `r6-totem-kill` cycle read off the live body. It settles west of the band at `d0`;
  from the first walking tick, every 22 ticks, it taps up, idles a tick and presses; then it bursts `down` up to `burst`
  ticks while `D < dt`; after `destroy` it idles.
- `levelRun.js`: the `bosses` view gains `x, y, state, walking, collidable, hits, hitsTimer, destroy, removed`,
  **only while the switch is ON** (OFF the object is byte-identical). No new per-visit map; the view reads `bossStates`,
  which is already in the digest.
- `entityBlocks.js` + `seedling-solver-surface.md`: `FAMILY_BLOCKS.bosses.solverReads` gains `solverBot` (D2c: found
  red by the bounded vitest and CI).

**Measured** (`fidelityL67Bk4.test.js`): legs 862/872 ON solve in **199 / 168 units** (1,054 / 1,057 t, verbs `totem,
walk, wand`). Each kill writes `{43,5}` into `earnedClears`; the walk takes the Wand apitem `{43,0}` in passing, the
wand opens the magical lock `{43,4}`, and the leg crosses to L37 with no hit. **Seam census ±10: 21/21 clocks each, one
answer.** The variant table's ranking is load-bearing. The first variant (the scratch prototype's) kills with **2
hits** on three of the four captured passes, and the second, `{d0 90, dt 70, burst 10}`, is hitless on all four.

**D2b — the vanilla room (found by the survey).** In the game's own rooms the Wand is a real `Wand` pickup and the body
never wakes until it is collected (its fade, dialogue and the rocks' drop). ON, the survey's step 157 handed the verb a
clear-tag, and every variant ran 2,400 ticks against a sleeping body. The resolver now refuses by name: *"bosstotem@152,168
sleeps while wand@144,224 stands — it wakes on `classCount(Wand) <= 0` …"*. Ordering the pickup before the fight is
residue (below).

## Game witnesses (PASS, p4g, headless logic-only, 0 px)

`evidence/witness.mjs` is BEAMLANE's instrument, generalised. It solves the captured request 0 at each arrival clock
with the switch env set, folds the plan with its `equips` into a tape, and replays it on the model and on the game.
**It delivers the request's own AP set first** (`botLoadLevels`: the vanilla record set with every room replaced by the
request's records, L-room re-assembly checked exactly).

| leg | clocks | model | game |
|---|---|---|---|
| 898 (L67 Boss Key 4), `laneWeigh` | 5442, 5455, 5462, 5467, 5475 | 801 t, 0 hits | **stream equal (first differing row −1)**, 0 hits, `persistence_cleared` `{67,0}` (the AP check) + `{67,1}` (the light pole, toggled by the second thrust's `alsoReaches`) |
| 862 (L43 from the L40 stairs), `totemBossFight` | 5464, 5473, 5477 | 1,054 t to L37, 0 hits | **equal**, levels [43, 37], 0 hits, `{43,0}`, `{43,4}`, `{43,5}` |
| 872 (L43 from an L40 pit), `totemBossFight` | 5467, 5476, 5480 | 1,057 t to L37, 0 hits | **equal**, levels [43, 37], 0 hits, same three clears |

`evidence/witness-{898,862,872}.{txt,json}`. **33/33 checks per leg family; 11/11 clocks.**

⚠ Two witness facts a reader needs:
- **A fresh page plays the VANILLA rooms.** The first L43 run without delivery matched the model for 892 rows and then
  parted. `botMobiles` showed the game's Totem asleep (`type "Solid"`, hits 0) and a real `Pickups::Wand` lifted over
  the player with its dialogue NPC: the vanilla set. The model had solved against the AP set (an `apitem`). With the
  request's records delivered, the stream is equal to L37.
- `inventory_slots` is staging-only (no tape field). The sweep page held the L43 slots in acquisition order
  `[0,1,3,2]`, while a fresh page builds `[0,1,2,3]`. The witness therefore solves with the staged order dropped, so the
  plan's `equips` name the slots the page holds. Only the Wand's slot index moves.

## Mutants (predicted first; copy + restore, in a separate worktree)

| mutant | predicted | measured |
|---|---|---|
| M1 `laneHolderRoute` returns null | 1 red (D1 ON) | **1 red**, as predicted |
| M2 the yield asked even when no clear-path step destroys | survives (L67's clear-path always destroys; no other room reaches the arm) | **survived**, as predicted. The guard is defensive by census |
| M3 the policy never presses | 2 red (862, 872 ON) | **2 red** |
| M4 the executor keeps the first OK variant whatever its hits | survives (I expected the first variant to be hitless) | **2 red — my prediction was wrong**: the first variant takes 2 hits from the solver's own stance walk, so the hitless-first ranking is what makes these legs hitless |
| M5 the `bosses` view never carries the fight fields | 2 red | **2 red** |
| M6 no tracking burst | 2 red | **2 red** |
| M7 the sleeping-boss refusal dropped | 1 red (the vanilla row) | **1 red** |

## The movers (both keys ON) — before → after, and the dispatches to confirm

**Route survey, full, local** (`survey-seedling-route.mjs --through=end --route=full`, `=0` vs both `=1`, at `c1ded8d6`;
`evidence/survey-{off,on}.rows.json`): 241 rows. **SOLVED 189 → 190 / REFUSED 52 → 51**. Compared by (level, goals, boot):

| step (this base) | room | OFF → ON |
|---|---|---|
| **142** | L67 Boss Key 4 (the brief's step 140) | REFUSED (*"the combat ladder is EXHAUSTED … arrowLane:arrowtrap@48,48"*) → **SOLVED 957 t**, 0 hits |
| 157 | L43, skip-totem + the L37 door (vanilla rooms) | the goal itself moves: OFF the survey's `bossGoal` reads `skip` (*"no strategy row for solid:bosstotem"*); ON it hands a `clear-tag {43,5}` (`totem` is registered). Verdict REFUSED → REFUSED, words: *"pickup:wand … 'collect' failed to apply"* → *"bosstotem@152,168 sleeps while wand@144,224 stands …"* (D2b, `--only=157` re-run at `07fce177`) |

No other row moves (verdict, clock or words). Step 137 (L43, wand + door, vanilla) refuses identically in both arms
(residue, below).

**Keyed sweep, local** (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g
--page-legs=1 --keys=<54 L43+L67 legs>`; arm A `--contact-fidelity=<the 77 defaults>`, arm B = A + `laneWeigh,totemBossFight`;
`evidence/sweep-{A1,B1,A2,B2}.jsonl`, `evidence/cf-{A,B}.txt`):

| legs (by key) | A1 / A2 (77 defaults) | B1 / B2 (+ both keys) | what moves |
|---|---|---|---|
| **862–874** (L43 r3c8 ×13, the `bosstotem` corridor) | failed / failed (*"no corridor … solid:bosstotem … No strategy row exists"*) | **done / done** | the corridor legs reach L37 through the fight |
| **898** (L67 Boss Key 4) | failed / failed (*"the combat ladder is EXHAUSTED … arrowtrap@48,48"*) | **done / done** | the key is collected under a silent trap |
| 875–887 (L43 *Totem of Lacste* location ×13) | unresolved / unresolved | unresolved / unresolved | nothing: the JS goal map refuses the boss kill before the solver is asked (*"the bot has no fight executor for it"*), see the JS wiring |
| the other 27 (L43 r13c7 exits/Wand ×26, L67 r6c11 exit) | done / done | done / done | nothing |

Totals: **A 27 done / 14 failed / 13 unresolved in both runs; B 41 done / 13 unresolved in both runs.** **14 movers, all
`failed → done`, and both repeats agree leg for leg; 0 regressions; 0 `crossed`↔`done` noise in this set.**

**Probes standard, ON** (the `ontree` worktree with both literals flipped, served on 9739, every probe `--host=` it;
`evidence/probe-battery-standard-on.txt`): **11/11 ALL CHECKS PASSED** — logical-links B,R; vanilla-map;
arrival-composites (its `moved L43 pit door` row crosses on plan, as at the base); midroom-replan D; restart-route W,J;
restart-warp W,J; adopt; obstacle-events W,J; generated-playback; loop-restart; seal-delivery A.

**Dispatches for the planner (branch `claude/l67-boss-key-4-1ktz4x`):**
1. `seedling-survey.yml -f through=end -f route=full` on `claude/l67-boss-key-4-1ktz4x` (OFF) and on a scratch branch
   off it with the two literals flipped to `true` (ON). The workflow has no contact-fidelity input, and I may not push
   another branch: the flip is the two `false` → `true` lines in `contactFidelity.js`. Expect the two rows above.
2. `seedling-divergence-sweep.yml` ×2 per arm: `keys=<evidence/leg-keys.txt>` (the 54 L43/L67 legs; or the 14 movers
   alone, below), `contact_fidelity=<evidence/cf-A.txt>` vs `<evidence/cf-B.txt>`, `capture_requests=true` on B.
3. `seedling-probe.yml -f battery=standard` on that same flipped scratch branch (local 11/11).

## The JS arc's pins that move, and what it must wire

- **`seedlingPlaybackController.BOUND_BOSS_FIGHTS` needs `bosstotem: 'totemBossFight'`** (the lights/boss wiring
  shape). Until then the 13 *"Level 043 - Totem of Lacste"* location legs (875–887) stay `unresolved` in both arms
  (*"a BOSS KILL … the bot has no fight executor for it"*). With the row, `atlasBossGoal` hands the solver a clear-tag
  `{43,5}`, which the `totem` verb serves. The verb was measured only through the L43 exit legs' frontier, not through
  that clear-tag path; `seedlingBossFightBinding.test.js` will want the row.
- No `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` change. New optional resolution
  field `laneHolder` (D1). No new `SolverRefusal.obstacle.kind`.

## Handed to the hammer arc

Nothing. Neither change touches the strike, refuge, escape, approach/fight search or the press-kill arms.

## Deltas

- `run.entities('bosses')` rows gain nine fields **with `totemBossFight` ON only** (named for the skin renderer: it
  reads the totem's rects, which are unchanged).
- `FAMILY_BLOCKS.bosses.solverReads` = `['botDriverV2', 'solverBot']` (and the surface doc's table row).
- Surface census: the closure gains `bossTotemPolicy.js` (`--write`, GREEN 353). Constants census: line moves only
  (`--write`, 0 new / 0 vanished, PASS 6,938). Entities 566, profile 138 unchanged.
- Docs: a `seedling-bot-log.md` entry, two `seedling-bot.md` paragraphs, the procgen docs index regenerated (heading
  and word counts: CI's `docsRender` / `generated.test` caught the stale index at `d3ec45bd`).

## What the brief got wrong (measured)

1. **"Leg 908"** is leg **898** at this base (re-derived; match by key).
2. **"Survey step 140"** is step **142** at this base.
3. **"Find what the ladder runs out on":** the ladder ran out on the armed lane only because an earlier `shove` had
   destroyed the block that silences it. The arrows were never the gap, and `arrowLaneCrossing` ON is the wrong lever:
   it still refuses, and under ⚖ 2026-10-21's ruling a tank-a-hit crossing is not what the logic should expect.
4. **"Is the body a real wall … (an honest refusal) or a model gap?"** Both and neither. It is a real wall in the game,
   but the MODEL already stepped the fight; the gap was the solver's strategy table.
5. The L43 legs "stop at no corridor: `bosstotem`" — **13**, as briefed, but the sweep also holds 13 Totem-of-Lacste
   *location* legs whose blocker is the JS goal map, not the solver (above).

## Residue

- **The vanilla L43 fight** (survey steps 137/157): the Wand must be collected before the fight (the wake), and the
  frontier has no `collect` for a pickup obstacle (*"Strategy 'collect' failed to apply"*). The awake body is also not a
  frontier obstacle (it is an `"Enemy"` held by the clamp, not a Solid), so a reach-exit after the Wand walks into the
  clamp (step 137, both arms). The AP rooms (every sweep leg) have neither problem.
- The `totem` verb on the clear-tag path (`Level 043 - Totem of Lacste`) awaits the JS wiring above.
- D1's light pole: the second thrust's spear rect also toggles `lightpole@160,104` (tag 1; `PRESS_ARM_POLICY` inert),
  so the witness writes `{67,1}`: the room goes dark. Harmless to the route; named.
- M2's guard is reachable in no room (census); it stays as a defence, not a measured row.

## Byte-inertia

Both switches OFF: tapeRunner pairs **635, `88fc7df4…` (= W0)**; roster 289; no committed tape, no producer `--check`,
no identity row moves: **identity AFTER at `73a1308d` (`SEEDLING_PORT=9740`, a pristine worktree; `evidence/identity-after.txt`) is line-for-line equal to W0** — every census md5, the six producer `--check`s (`405d9c4b` · `a591fa9d` · `6460d60d` · `35456fbc` · `6cd35fe1` · `27478177`) and the reference's 4 known DIFFER rows.

## Bounded vitest AFTER (`evidence/vitest-files.txt`, 181 files with `fidelityL67Bk4`)

| arm | result |
|---|---|
| OFF (defaults), at `ace085f1` | 5,461 / 5,464: the environmental `seedlingAtlasArm` and `entityBlocks` ×2, which D2c (`d2d86cfa`) fixes; re-run at D2c: `entityBlocks` 30/30. CI at `73a1308d` is green on the whole suite |
| ON (`SEEDLING_LANE_WEIGH=1 SEEDLING_TOTEM_BOSS_FIGHT=1`) | 5,459 / 5,464. Reds: `seedlingAtlasArm` (environmental); `entityBlocks` ×2 (fixed by D2c); `contactFidelity` *"contact witnesses: the shipped defaults: all three ON"* and `dashShape` *"the defaults add no field"*: both compare against the defaults, which env-forcing moves (`CONTACT_FIDELITY_DEFAULTS` is frozen before the env lines, and an off-default worker stamps `contactFidelity` on the request). **A default flip owes**: `contactFidelity.test.js`'s defaults pin (`laneWeigh`/`totemBossFight` → true), `fidelityL67Bk4`'s "ship OFF" row, and the `switchGatedRow` → plain-row promotion (the derivation row, the catalogue's pending list and `KNOWN_STRATEGY_VERBS`, per `switchGatedRow`'s docblock) |

## Rows to BANK

- `fidelityL67Bk4.test.js` (9 rows): defaults OFF; the totem rows are switch-gated; D1 OFF refusal / ON solve + replay
  (block on (6,7), trap silent, key cell); D2 OFF refusal / ON 862 + 872 (solve ≤ 640, `{43,5}`, 0 hits, → L37);
  the vanilla-L43 named refusal; the variant table.
- Witness tool `evidence/witness.mjs` and the three captures.
- Licence ask: flip `laneWeigh` and `totemBossFight` with the movers above. The JS arc wires `BOUND_BOSS_FIGHTS.bosstotem`.
