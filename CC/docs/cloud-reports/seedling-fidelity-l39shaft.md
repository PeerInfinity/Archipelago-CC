# seedling-fidelity-l39shaft — L39's three-block shaft as a licensed solver special case (wave 31)

Planner `seedling-fidelity-planning-13`. Session `seedling-fidelity-l39shaft`.

| | |
|---|---|
| start | `fidelity-harvest/w30` **`89da08f355`** (main `cfc681a566` + W30 flipped ON; 77 default-ON keys) |
| head | the commit carrying this report (the last before it: `a07a25ab`) |
| harness branch | `claude/l39-shaft-solver-9shwt3` (local `seedling-fidelity-l39shaft`) |
| verdicts | **W0 PASS · D1 PASS · D2 PASS · movers measured, STOP with the list (three keys OFF; the flip is yours)** |

⚖ The user (2026-10-25): *"L39 has a mechanic not used anywhere else in the game. The solution is to move the three blocks
into the three inner switches, then stand between them and use fire, which means that for a moment the blocks are half on
one button and half on another. For this one, we might need to give the solver a special case, rather than trying to find a
general rule that would solve this."*

**The one thing to know first:** with `l39ShaftPress` (+ `collectSpanAim` for the part) ON, all four L39 visits SOLVE, and the
solver's own step-66 plan matches the game at 0 px on every tick (p4g, delivered set). That holds only with the third key,
`spinnerPointExact`, ON: it corrects a one-ulp `Point` spelling in `spinner.js`. Long logical-links B now walks past L39 and
ends at **L40 Boss Key 2** (+1023 s, 18 checks), which is L40BK2's room.

## W0 — the room and the refusal (PASS)

**The room** (`Dungeon3` L39, the atlas records, read in AS3):

| ring | button | cell | group | opens |
|---|---|---|---|---|
| inner | `button@144,128` | (9,8) | t1 | `cover@176,144` (11,9) + `wandlock@48,160` (3,10, block 3's pocket) |
| inner | `button@160,144` | (10,9) | t2 | `cover@112,144` (7,9) |
| inner | `button@128,144` | (8,9) | t0 | `cover@144,112` (9,7) |
| outer | `button@144,112` | (9,7) under cover t0 | t4 | `wandlock@144,48` |
| outer | `button@176,144` | (11,9) under cover t1 | t5 | `wandlock@144,32` |
| outer | `button@112,144` | (7,9) under cover t2 | t3 | `wandlock@144,64` |

- `Button.as:27-39`: `activate = tempCheck` on every update (hitables Player/Enemy/Solid), so only a parked Solid holds a group.
- `Cover.as:37-66`: while its group is published the alpha falls 0.1 per tick and the type goes "" at 0. When the group drops,
  `reset()` makes it Solid again unless a Solid (or the Player) is inside it.
- `Lock.as:62-101`: the alpha falls 0.01 per tick. `turnOff()` writes `setPersistence(tag, false)`; `returnToNormal()`
  writes it back TRUE. Locks with `tSet ≥ 0` are never deleted at build, so every visit meets the shaft shut.
- `PushableBlockFire.as:76-123`: a Fire hit pushes the block one tile `atan2` away from the player. Diagonal only within
  `bothRange` 0.1 of 45°.

**The refusal, reproduced at the base** (`survey-seedling-route.mjs --through=end --route=full --only=66`): *"no REACHABLE
stance inside button@144,112 … wandlock@144,48 — its group t=4 publishes only while a Solid sits on button@144,112, and NO
block in this room can reach it …"*, 0.4–3 s. The solver had parked `pushableblockfire@144,176` on t2 (10,9) by the fire route
(east to (10,11), then north) and was standing on t3.

**Banks** (`evidence/identity-w0.txt`, a pristine worktree at `89da08f355`, served on 9748):

| row | value |
|---|---|
| identity | maze `57e07d21` · acceptance `cf54cdf7` · c3 `31dc4572` · c6 `40d0a4c4` · c4 `7e1497c4` · ENEMY `f0bec576` · guard `a6d18d49` · AREA `02b22525` · killgate `7c15ed57`/`47116405`/`4d3bbf17` · levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | battery `405d9c4b` · d2-chain `a591fa9d` · l18 `6460d60d` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `27478177`, all exit 0 |
| generated set | not measurable on this box: the venv's playwright is 1.56, the pin is 1.63 (same at head) |
| reference | 4 DIFFER: the box artifact (no noiz2sa substrate; same at head) |
| surface / constants / entities / profile | GREEN 349 → (head) 353 · PASS 6,911 → 6,940 · PASS 566 · PASS 138 |
| roster | 289 |
| tapeRunner pairs | 635, md5 `88fc7df4dd05d11dfd84ebbea675cc8e` (= FIREMOVE's) |
| bounded vitest BEFORE | 155 files: **4,812 passed / 1 failed / 7 skipped**; slow `fidelityL32ArenaPrefix` 5/5. The red is environmental: `seedlingAtlasArm` (`evidence/rows-before.txt`, `vitest-files.txt`) |

## D1 — the game witness of the user's solution (PASS; no model gap)

`probe-seedling-l39-shaft.mjs` (new; box-lock roster row) plays a tape on a FRESH p4g page (headless, logic-only). Each poll
reads `botStatus` and `botMobiles`. The fold (`fidelityL39Shaft.js`) is:
- the player;
- every `PushableBlockFire` and every `Spinner` (dying ones dropped on both sides);
- L39's lock tags {0,1,2,7} in `persistence_cleared`.

The model replays the same tape, and every tick is compared.

The scripted input is the committed `r5-shaft` (`SHAFT_PLAN`), played on the page's own levels. In order:
1. The rope is pulled by Fire.
2. Block 1 goes up column 9 onto t1.
3. Block 2 goes down column 12 and across cover t1 onto t2.
4. Block 3 leaves its pocket through `wandlock@48,160` and goes east along row 9 onto t0.
5. ONE press from (9,9).

`fixtures/l39shaft-witness/l39shaft-scripted.json`:

| check | result |
|---|---|
| the game reproduces the model at 0 px: the player, all 3 blocks, all 3 spinners, the lock tags | **PASS, all 2,763 ticks** |
| **the half-on moment**: all three blocks each on two buttons (the inner one and the outer one) | **t2250..t2260, 11 ticks**, game = model |
| every outer button under a block | from t2250 |
| locks | {39,0} {39,2} cleared t2349, {39,1} t2351; {39,7} written t648 and **taken back** t2262 |
| the ledger's read offset | 1 tick (the game's poll reads the array after the tick that wrote it), fixed, measured |

The half-on readout is derived from block positions alone (`buttonsUnder`, the 8x6 button hitbox), the same function on
both sides. ⚠ The tape is `noDamage` (R5's own relax); D2 is the honest run.

## D2 — the solver (PASS)

### The special case, `l39ShaftPress` (OFF)

- **Table** `solverBot.L39_SHAFT`, named as L39's in its docblock: the inner and outer buttons, the covers, the locks, the
  stance (9,9) and the final exact set. `l39ShaftIn(run)` is true only in level 39 and only while every id is in the built
  world.
- **Refinement.** In `refineStrategy`, a frontier member (a lock, a cover, one of the six buttons) answers `l39shaft`.
  `resolveObstacleStrategy` has the row, and the verb is a `switchGatedRow` in `STRATEGY_EXECUTORS`. No Fire is refused by
  name (the item is the work order).
- **Either state** (⚖ the user's standard). `l39ShaftState(run)` reads where every fire block is, which inner and outer
  buttons hold one, and whether the locks are open.
- **The executor** (`execL39Shaft`):
  1. For each EMPTY inner button in dependency order t1, t2, t0: the cheapest fire route (`deriveBlockRoute`, `press`
     goal, `compareCost`) of any block not already on an inner button. It walks to the route's first stance and runs it
     through `execRoute`, whose post-condition is the block on its tile.
  2. The walk to (9,9), the settle, and the Fire's slot.
  3. ONE `runFire` with the three-move exact set.
  4. `runDwell` until the three locks are open (bound 200).

  A state already at "outer" only dwells; a state with all three inner buttons loaded only presses and dwells.
- **The departure wait.** A stance walk refused at PLAN time (no tick spent) by a live **spinner**'s body (`obstacle.kind
  'danger'`, id `spinner@…`) is asked again after 16 idle ticks, up to 480. Every idle tick is checked for a hit. Measured
  need: block 3's first stance from (12.5,9.5) is refused because `spinner@112,88` crosses the corridor at its ETA; TIME is
  a last-mile rung and no KILL strike is reachable.

### Two more gaps found by the game witness, each its own key (OFF)

- **`collectSpanAim`.** `totempart@72,40`'s rect [72,88)x[40,56) straddles x = 80 under its only free cell (5,1), next to
  (4,1)'s wall. `runCollect`'s centre aim drifts into the wall: *"the sweep was blocked by tile:Blue Wall (dark) at (72,24)"*
  (a `BotDriverV2Error`). R5 slice 13 declared this by hand (`r5Shaft.TOTEM_PART_2.aim`). ON, the rule is in
  `solverBot.collectSpanAim`: when the box already overlaps the rect on one axis, **and** the centre approach's own path
  (`chooseHeld`'s 45° until the shorter axis arrives, then straight, the box swept at 0.5 px) meets a Solid, the aim keeps
  that axis and closes on the other.
  - ⚠ Narrowed after measuring. The first rule (any one-span stance) moved 10 bounded rows and 7 survey steps whose
    approach is clear; the path test moves none of them (below).
- **`spinnerPointExact`.** `spinner.spinnerFriction` spelled `Point.length` / `normalize` as `Math.hypot` and `(v/len)*t`.
  The runtime's spelling is `sqrt(x*x+y*y)` and a multiply by `t/len` (`playerPhysicsV1.pointNormalize`; `chasers.js`
  retired the same spelling at wave 8).
  - Measured: D2's witness disagrees on ONE spinner's last bit (t547 in the survey's tape, t637 in my first nodash tape,
    max 5.7e-14 px). It is the only disagreement over 3,494 ticks.
  - ON: `spinnerPoint.js` (its own module, so `spinner.js` stays outside `oneSpelling`'s import-reach subject and keeps its
    OFF arm byte for byte).
  - ⚠ `oneSpelling` never visited `spinner.js`. Its bound is the import reach, stated in its own header.

### The witness — the solver's own plan on the game

`fixtures/l39shaft-witness/l39shaft-solver-step66.json` is the route survey's own step-66 walk view (`.cache/…/views/
step-66-walk.json`, keys ON), played on p4g on the **delivered set** (`--set=delivered`: `vanillaRecordSet` with the default
patches, mounted by `botLoadLevels`; the model replays on `patchedMapDocument`'s records):

| check | result |
|---|---|
| game = model at 0 px, `spinnerPointExact` ON | **PASS, all 3,494 ticks** (OFF: the one-ulp spinner, t547) |
| the half-on window | t2393..t2403, 11 ticks, game = model |
| locks | {39,0} {39,2} t2492, {39,1} t2494; {39,7} t368 → back t2405 |
| end | the part collected (the ceremony's dead frames matched), the exit taken: L40 t3496 (488,904), 0 hits |

`fidelityL39Shaft.test.js`, 15 rows:
- the switches;
- the room and its states;
- D1 at 0 px, with the half-on window and the lock timeline pinned;
- D2 at 0 px, and the OFF mutant/control (the ulp);
- **the solver, keys ON, plans EXACTLY the recorded tape from the same boot** (every tick's keys, the equips, the
  `l39shaft` verb);
- the OFF control (*"no REACHABLE stance inside button@144,112"*);
- the `collectSpanAim`-OFF control (the wall);
- three either-state rows, solved from D2's own states:
  - t2330, all inner: press and fade only;
  - t2420, outer: fade only;
  - t300, one home: routes for t2 and t0, then the press.

**Mutants** (predicted first; copy, edit, run, restore; `evidence/mutants.txt`):

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | no final press | plan = tape, either-state "inner" | those + "one home" + the aim control (4): neither reaches its row's end |
| m2 | the refine hook off | plan = tape + three either-state rows | those 4 + the aim control (5) |
| m3 | `spinnerFrictionExact` with the old normalize | the switches row + D2's 0 px | exactly those 2 |
| m4 | `collectSpanAim` always null | plan = tape | exactly that |

### What the brief got wrong / what I got wrong (measured)

- **"js-11's logical-links B ENDS at Totem Part 72,40"**: true at the defaults. ON, B ends at L40 Boss Key 2 (+1023 s).
- **"the solver has parked a block on t2 … the player stands on the t3 button"**: correct. The parked block is
  `pushableblockfire@144,176` (block 1, by spawn), not block 2. With the special case, block 1 goes to t1 instead, routed up
  column 9 (3 presses), which is what frees the other two.
- **The sweep cannot see the shaft.** The region graph has no L39 leg that crosses it. L39's three legs are r0c9 (arrival
  from L40, goals at the top) and r25c9 → L38. The keyed sweep measures `spinnerPointExact` in the spinner rooms, not the
  special case.
- **My own wrong turn**: my first D2 witness ran on the page's vanilla levels. Vanilla L39 still has `fallrock@144,624`, so
  the rope's publication freezes the room. The survey's walk diverged at t72, which read like a sword-dash model gap until
  the set was matched to the survey's (delivered). The probe now takes `--set`.
- **My first survey diff** keyed rows on (level, goals, boot block), which many staged visits share, and showed 30 bogus
  movers. Pairing by step shows the truth. Two concurrent full runs gave rows identical to a sequential run (no contention
  noise).

## The movers (before → after), and the dispatches to confirm them

### Route survey, full (local, sequential, `--through=end --route=full`; `evidence/survey-full-*.txt`)

A = the 77 defaults, B = A + `l39ShaftPress` + `collectSpanAim` + `spinnerPointExact`, both at head (A = the base, by OFF
byte-inertia). A: 189 SOLVED / 52 REFUSED. B: 193 / 48. **Exactly 4 rows move:**

| step | room | A | B |
|---|---|---|---|
| 66 | L39 v1, Totem Part 72,40 then → L40 | REFUSED `button@144,112` | **SOLVED 3,496 t** (needs `collectSpanAim` too) |
| 94 | L39 v2 → L40 | REFUSED | **SOLVED 3,376 t** (`l39ShaftPress` alone) |
| 135 | L39 v3 → L40 | REFUSED | **SOLVED 3,376 t** (alone) |
| 155 | L39 v4 → L40 | REFUSED | **SOLVED 3,253 t** (alone) |

By key: `spinnerPointExact` alone moves 0 rows. The narrowed `collectSpanAim` alone moves 0 rows (the first rule moved steps
10/28/29/37/39/98/179 by a few ticks each and 137's refusal text; `evidence` in the commit history).

### Keyed sweep ×2 (local, `--mode=inv --producer=solver --capture-requests`; `evidence/sweep-summary.txt`)

51 legs re-derived at my base (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`), listed in
`evidence/sweep-keys.txt`: every leg in the four spinner rooms (L18, L39, L40, L92) plus L38's two L39 doors. Arm A is the
default; arm B is `--contact-fidelity=` the 80 keys of `evidence/arm-B.txt`.

| | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| done / failed | 40 / 11 | 39 / 12 | 39 / 12 | 40 / 11 |

Only leg 371 differs (`level_40__r0c53 <- in_L42_240_336 -> Totem Part 64,144`: A1 done, A2 failed, B1 failed, B2 done). Its
captured requests replay in node with OFF = ON: A1's (seam 5578) solves either way and B1's (seam 5581) refuses either way.
FIREMOVE recorded the same leg flipping with its seam. **0 key-driven verdicts.** ⚠ The sweep ran on the first (unnarrowed)
`collectSpanAim`; the narrowing only removes cases.

### Probes, the three keys ON (scratch flip, restored; `evidence/probes-on.txt`)

- `battery=standard`: **11/11 ALL CHECKS PASSED**, `arrival-composites` included.
- `battery=long` (logical-links B, 1,200 s): **ALL CHECKS PASSED**. B now walks through L39 (+913 s the L38 plug, +923 s
  walking to the part, the part checked, 0 divergences) and ENDS at *"Level 040 - Boss Key 2 … no REACHABLE stance inside
  button@816,400"* at **+1023 s, 18 checks**. At the defaults it ended at L39's Totem Part 72,40.

### Bounded vitest with the keys ON (`evidence/rows-on.txt`, `rows-on-by-key.txt`)

156 files: 4,814 passed / 17 failed before the narrowing. The reds, attributed key by key:
- **the defaults tables** (a flip owes them): `contactFidelity.test.js > the shipped defaults`;
  `fidelityL39Shaft.test.js > all three ship OFF`.
- **`l39ShaftPress`**: `fidelityWandHold.test.js > WANDHOLD L39 — … OFF` and `… ON: refused by name …`. These are the
  controls pinning the old L39 refusal (WANDHOLD's row; FIREMOVE re-pinned it to `button@144,112`). **A flip owes this re-pin
  to the solve.**
- **`collectSpanAim` (the first rule)**: 10 rows in `fidelityBobSoldier2`, `fidelityCrusher`, `fidelityLeash`,
  `fidelityStrikeLapse`, `fidelityWandHold` (L40 legs 368/371) and `stringPullFast`. **The narrowed rule moves none of them**
  (64/64 ON).
- **`spinnerPointExact`**: none.
- `seedlingAtlasArm` is the environmental red, as at the base.

### Producers with the keys ON

`evidence/producers-on.txt`: **all six `--check` md5s with the three keys ON equal W0's** (battery `405d9c4b`, d2-chain
`a591fa9d`, l18 `6460d60d`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `27478177`). No producer digest moves ON. ⚠ The
`[exit N]` column in that file is not trustworthy (`PIPESTATUS` read outside the substitution); the md5s are. Equal output
includes the producers' own verdict lines.

### Please run, on `claude/l39-shaft-solver-9shwt3`

1. **Survey full**: `seedling-survey.yml` with `through=end`, `route=full`. Arm A uses `contact_fidelity=` the 77 keys of
   `evidence/arm-A.txt`; arm B uses the 80 keys of `evidence/arm-B.txt`. Compare with 39496129402 by (level, goal, boot)
   **and step order**. Expected: L39 steps 66/94/135/155 REFUSED → SOLVED, everything else equal.
2. **Keyed sweep ×2**: `seedling-divergence-sweep.yml` with `keys=` the 51 keys of `evidence/sweep-keys.txt`
   (`|`-separated), `capture_requests=true`, arms A/B as above. Expected: no key-driven verdict (371 is seam noise).
3. **Probes**: `seedling-probe.yml battery=standard` and `battery=long` with the three keys ON. Expected: 11/11, and B ending
   at L40 Boss Key 2. Also a `seedling-probe.yml` run of `probe-seedling-l39-shaft.mjs` (D1, 0 px expected) and of
   `probe-seedling-l39-shaft.mjs --tape=frontend/modules/seedlingDemo/fixtures/l39shaft-witness/l39shaft-solver-step66.json
   --set=delivered --on=spinnerPointExact` (0 px expected).

## What the JS arc must wire / pins that move

- **No contract change**: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched. There
  is no new `SolverRefusal.obstacle.kind`; the refusals use `solid` / `proximity-hazard`.
- **New verb** `l39shaft` (ON only). Its trace row's verb is not in `decisionTrace.KNOWN_STRATEGY_VERBS` (reported as
  unknown, not refused). List it at the flip; ⚠ `fidelityArrowLane.test.js` pins `.at(-1) === 'pace'`, so that row moves
  with it.
- **New record**: `{kind: 'l39shaft', postCondition: 'press', start, parks: [{presser, block, from, orders, route, waited,
  ticks} | {press: true, pressTick, at, waited}], dwell, ticks}`.
- **New exports**: `solverBot.L39_SHAFT`, `L39_SHAFT_FADE_BOUND`, `L39_SHAFT_WAIT_STEP`/`_MAX`, `l39ShaftIn`,
  `l39ShaftState`; `spinnerPoint.spinnerFrictionExact`.
- **Run state**: none added, renamed or reshaped. No per-visit map; `stateDigestParts` is untouched. The skin is not
  affected.
- The walker (`botDriverV2.drive`/`chooseHeld`/…) and `runFire` are untouched, so no `producer:walker` row moves.
- The flashPanel contact settings pick the three keys up from `CONTACT_FIDELITY_KEYS` (no wiring needed).

## Hand-overs

- **To the hammer arc (information, nothing edited in its region):** `spinnerPointExact` changes `stepSpinner`'s friction,
  which the spinner forecasts (`spinnerFightForecast`, `spinnerForecastWithPress`) step. ON, they get the runtime's last
  bit. The bounded set (theirs included) moved no row ON.
- **To L40BK2:** logical-links B's next refusal is theirs: L40 Boss Key 2, `button@816,400`.
- **To the planner:** a vanilla-set witness of the survey's walk diverges at t72 (the vanilla L39 `fallrock@144,624`
  freeze against the walk's sword dash). The delivered set removes the rock, so this is moot for the playthrough. It is noted
  in case a vanilla tape ever needs the dash after a rope cut.

## Byte-inertia (OFF)

- **Identity at head = the base, every row** (`evidence/identity-after.txt` vs `identity-w0.txt`: IDENTICAL), all six
  producer `--check`s exit 0 with the same md5s. The generated set is not measurable on this box on either side; the
  reference's 4 box-artifact DIFFERs are on both sides.
- tapeRunner pairs: 635, `88fc7df4…`, both sides. Roster: 289. No tape, fixture or producer digest moved.
- Censuses at head: surface GREEN 353, constants PASS 6,940 (two `spinnerPoint.js` literals classified), entities 566,
  profile 138.
- **Bounded vitest AFTER (defaults)**: 156 files, **4,830 passed / 1 failed / 7 skipped**. The red is `seedlingAtlasArm`
  (environmental, as before). Slow 5/5. `docsRender`/`generated.test.js`: the 4 noiz2sa box regions only.
- **CI `JavaScript Unit Tests`**: at `f9125f31` 22,882 passed / 2 failed. Both were the instruments index missing the new
  probe, fixed in `fd139e8f`. The last head is read in the final message.

## Residue

- The special case is L39's table. The general multi-block ordering it stands in for (park several blocks whose covers
  depend on each other) is unbuilt, as licensed.
- The departure wait is a bounded idle (16 × up to 30) for a spinner at plan time. The ladder still has no rung that crosses
  a room past a billiard.
- The final press stance is the cell centre the walk reaches. `bothRange` is wide (0.1 rad of 45°), and a pure axis was
  measured on every press.
- Survey visits 2–4 each re-solve the shaft (the locks have `tSet ≥ 0`, so their persistence never deletes them). The game
  agrees: every visit meets them shut.

## Rows to BANK

- **W0**: the refusal reproduced at the base; the identity block, censuses, roster, tapeRunner pairs and bounded vitest at the
  base.
- **D1**: the user's solution on p4g at 0 px over 2,763 ticks, including spinners; the half-on window t2250..t2260; the lock
  timeline including the taken-back {39,7}.
- **D2**:
  - `l39ShaftPress`, `collectSpanAim` (narrowed) and `spinnerPointExact`;
  - the solver's own step-66 plan on p4g at 0 px over 3,494 ticks (delivered set);
  - plan = tape;
  - the three either-state rows;
  - mutants m1–m4.
- **Movers**:
  - survey: exactly 4 rows, L39 ×4 REFUSED → SOLVED;
  - sweep: 0 key-driven verdicts;
  - probes standard 11/11 ON; long B past L39 to L40 BK2;
  - bounded ON: WANDHOLD's L39 controls plus the defaults tables owe re-pins.
- **Trap candidates** (in the bot-log entry): a witness on the wrong level set; a survey diff keyed on non-unique fields; a
  general rule found in one room must be measured everywhere before it ships.
- **Commits**: D1 `bfcd63ee` · D2 `f9125f31` · docs `fd139e8f` · evidence `658c0e02`, `745c7523` · D2b narrowing `bb6295b2` ·
  bot-log `a07a25ab` · this report.
