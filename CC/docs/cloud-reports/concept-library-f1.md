# Concept library F1: the roaming enemy, a body without a kill lock (cloud report)

`concept-library-f1` is a cloud fan-out build of plan `concept-library-plan.md` §6 (the generator half of F1). This file is the report the coordinator reviews. The as-built record is § *Concept library F1 — the roaming enemy* in `docs/json/developer/procgen/seedling-bot-log.md`.

- **Started from:** `ec5b431` (`origin/main`). This is the SHA the brief expected. W0 reproduces the brief's premises (measured at `996080b006`) unchanged.
- **Branch:** `claude/roaming-enemy-element-5bqt4p`. The brief named `concept-library-f1`, but the cloud harness only allows pushes to its designated branch.
- **Head:** the commit that adds this file, directly after `e53aec0`.
- **Commits, one per D:**

  | D | commit | what |
  |---|---|---|
  | D1 | `61e09ef` | the census arms |
  | D2 | `6343e7c` | the element, `LAW_NONE` |
  | D3 | `50fb392` | the head |
  | D4 | `9ab890d` | the Seedling binding |
  | D5 | `99a6e4b` | the body ablation and the sweep block |
  | D6 | `498ff9e` | the wasm witness branch |
  | D7 | `c02926a` | the pipeline room rows |
  | D8 | `e53aec0` | the docs |
  | — | this commit | the report |

**Verdict: PASS on D1–D8.** The one thing the coordinator must know first is in [§ The finding](#the-finding-read-this-first).

## The finding (read this first)

**A roaming body in the element's own geometry almost never touches the route.** Of 187 body ablations over both palettes, **186 are INERT** and **1 is COSTS**. The blob is the chamber's blob, and the binding seals its exit mouth and joins only its entry. So the blob is a dead-end side room the walk never enters, and a spinner that stays home costs nothing.

The generator can now place a lock-less enemy, certify it and ship it: 96 of 168 cells place, 94 certify, and the three wasm subjects agree per tick. What it rarely produces is a level where that enemy *matters*.

Two levers would make the danger real, and neither is this slice's:

1. **A geometry decision** (needs a ⚖ ruling): a roam blob that carries the corridor THROUGH it, with both mouths open, or bodies placed on the main path.
2. **F2** (the solver rung). On today's geometry F2 moves at most the 2 named refusals per palette. Once bodies sit on the route, W0 says about half the positions refuse, and that is where F2 pays.

## W0: the premises, reproduced (both tables match §1 exactly)

The scratch probe `w0-premises.mjs` uses the census's own room: start (1,1), a 6x6 chamber (2,2)..(7,7), goal (8,8), one spinner, no lock, `solve` at `DEFAULT_BUDGET`. D1's census arms re-measure the same numbers.

**Table 1: goal class × boot**

| arm | pre-sword | post-sword |
|---|---|---|
| control, torch | SOLVED 251 | SOLVED 155 |
| control, totempart | SOLVED 218 | SOLVED 123 |
| spinner (4,4), torch | **THREW** at tick 222: *"level 900 holds live spinners AND a DIALOGUED ceremony (torch)…"* | **THREW** at tick 225 |
| spinner (4,4), totempart | SOLVED certified, 218 | SOLVED certified, 221 |
| spinner (7,2), torch | **THREW** at tick 222 | **THREW** at tick 126 |
| spinner (7,2), totempart | SOLVED certified, 218 | SOLVED certified, 123 |

**Table 2: totempart, twelve positions (pre-sword ‖ post-sword)**

- **SOLVED on both boots:** (4,4) 218‖221 · (7,2) 218‖123 · (2,3) 218‖142 · (3,3) 218‖150 · (7,7) 218‖123 · (5,2) 218‖123.
- **REFUSED on both boots:** (2,2) (5,5) (6,6) (7,6) (2,7) (3,6). Each says *"solverBot(w0) collect (128,128) stance: the combat ladder is EXHAUSTED"*.

**The other W0 banks:**
- The census default md5 is `4ce6c5b3f44fbd9c26bb7a25d72bb647`.
- Bounded vitest BEFORE (the brief's four paths) is **16 files / 308 tests**.

## The identity block: BEFORE (`ec5b431`) and AFTER (`c02926a`), row for row

The command is `bash scripts/procgen/identity-block.sh .`. It ran BEFORE on the clean tree at `ec5b431`, and AFTER at D7's head with `SEEDLING_PORT=8710`. `diff` of the two, excluding the generated-set row: **identical**.

| row | BEFORE = AFTER |
|---|---|
| maze byte-identity | `246dfbceff75c1cc27fdb347469a77d7` |
| acceptance batch | `4330bad70290dd18d94b11ca5b0bc5cb` |
| empty pairs c3 | `fa0dc4bb1f9495cfe6eec8b710efccfc` |
| empty pairs c6 | `f5c9ece7641978ad9a56032c488f18fe` |
| carved pairs c4 | `8c972028c1de2345e13264bd546ac90e` |
| ENEMY census default | `4ce6c5b3f44fbd9c26bb7a25d72bb647` |
| guard census (elements) | `a6d18d49ae256c321d175f45ec76dccc` |
| AREA census default | `06b14d5d57428ae7fcb248060a8d492e` |
| killgate s2 / s5 / s9 | `1b4eab8e…` / `b018ab2b…` / `65e81dd3…` |
| level pre-sword s1 | `e28c1e5d6522dcca4682c44e7333a32f` |
| level post-sword s1 | `9219ff9131427fb727004036a20e255b` |
| generated set | OK (see below) |
| r8-battery / d2-chain / l18 / tail / r9-l3 / r9-campaign `--check` | `410f27c0…` / `b470c14d…` / `17be7d70…` / `9a6a3192…` / `6cd35fe1…` / `2823a811…`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE |

**The generated-set row.** BEFORE printed exit 1 with *"the driver stage is KEPT"*. The cause is `ERR_CONNECTION_REFUSED` on `:8000`: this box's server is on `:8710`. Re-run at `ec5b431` with `SEEDLING_PORT=8710`, it prints **OK**. AFTER, with the same variable, it also prints OK. This is an environment effect, not a red.

## Per D

### D1: the census arms (`61e09ef`)

`census-seedling-enemies.mjs` gained `--goal=<class>`, `--boot=pre-sword|post-sword`, `--at=<tx,ty>[;…]` and a `--classes=` filter (so a position sweep is one command). Each default is the value the file hard-coded before the flag existed.

- **Gate:** with no flag, the stdout md5 is `4ce6c5b3f44fbd9c26bb7a25d72bb647`, the same as W0.
- **Reproduction:** `--goal=totempart --boot=<b> --classes=spinner --at='4,4;7,2;2,3;3,3;7,7;5,2;2,2;5,5;6,6;7,6;2,7;3,6'` reproduces Table 2 exactly on both boots.
- **Reference:** the instruments index was regenerated. `argvHelp` and `checkProcgenHelp` are green.

### D2: the element (`6343e7c`)

`procgenCore/elements/roam.js`:
- It imports `openChamberBlob` and `openChamberMouths`, and draws its bodies with `drawBlobBodies`. That function was **moved verbatim out of `buildArena`**, which now calls it at the same point in its stream.
- Ids are `roam_body_<i>`. There is no lock, no `doorCells`, no `clearer` and no symbol.
- The draw count is `2 + bodies`, and the docblock declares it.
- Its law is the new `LAW_NONE = 'none'` in `ELEMENT_LAWS`.
- It refuses by name: `site-is-not-a-declared-footprint` (the chamber's) and `roam-has-no-room-for-its-bodies` (`ROAM_REFUSALS`, registered with the refusal census and the reference).

**Gates:**
- `roam.test` 12/12. Its first row is the no-fork proof: at the same values, site and seed it asserts the chamber's tiles, area and ports AND the arena's body cells.
- `arena.test` 10/10, unchanged, and the identity block is unmoved. Together those are the proof that the arena's draw did not move.
- `refusalCensus` 17/17.

### D3: the head (`50fb392`)

`ELEMENT_TABLE.roam` is appended LAST, so no existing head moves in `ELEMENT_NAMES`. It has no `needs`, `extra: []`, and a `why` quoting the two reasons. `defaultElementsFor` is unchanged, and its literal pin row stays green.

`headsNeeding` now reads the law **positively**: only `cut` can meet a directive. It answers the shipped table exactly as before (pinned), and a new row shows `roam` is never forceable, even on a table that gives it `needs`.

The literal head lists in `procgenDoorElements.test` and `urlParams.test` gained `roam`. They exist to go red on a new head, and they did.

### D4: the Seedling binding (`9ab890d`)

**What changed:**
- `compositeSeedlingElement` takes `killLock`. The default is `true`, which is the arena and every caller before F1. The generator passes `law !== LAW_NONE`, and the record keeps `bodies` with `killLockCell: null`.
- `seedlingElementEntities` turns each body into a `spinner {tag:'-1'}`, with **no lock and no tag spent**.
- `ROAMING_GOAL_CLASS = 'totempart'`. A level whose committed record holds a roaming body certifies against it. A dropped or refused roam level keeps the torch, and every other level keeps it byte for byte (level s1 md5s above). `summary.goalClass` reads the effective class.
- **Why `totempart` over `bosskey`:** it is textless unconditionally, while `bosskey` is textless only for `keyType != 0`. Its one side effect is `BossTotemPart.removed()` writing `Player.hasTotemPartSet`, which no palette row, boot item or pin reads. The three wasm witnesses agree per tick through the pickup, so it moves no observation.
- A REFUSED certification on a roam level gets the gap **`the-solver-cannot-cross-the-roaming-body`**, with `reasonText` in the solver's own words. `rooms` s10 is the pin on both boots: *"the combat ladder is EXHAUSTED"*. A budget exhaustion keeps its own gap. No budget is touched.
- **Refuse rather than redraw:** the element is dropped (the existing path), and "another site" is the caller's next try, not a redraw inside the level. The brief's two phrases pull against each other, and this keeps the standing ruling.

**Gates:**
- `procgenRoam.test` 9 rows at D4 (15 by D7).
- The bounded suite at D4 was 18 files / 663 tests.

### D5: the grade and the yield (`99a6e4b`)

`procgenSeedling.bodyAblation`:
- The **with** arm is the loop's own last solve (`summary.finalTicks`, the same reasoning as `requireVerdict`), so it costs no extra solve.
- The **without** arm is the final record minus the spinner entities on the committed body cells, solved with the same pins and budget. **The boot is `palette.items`, and it is not a parameter.**
- The verdicts are `INERT`, `COSTS` and `NOT-ESTABLISHED`, with `deltaTicks`, and the result is recorded as `summary.bodyAblation` (omitted without a roaming body).
- `GRADES` is unchanged and pinned. `sweep-yield-table.mjs` calls the same function and prints a roaming-enemy block only when some row carries an ablation.

**The yield.** Predicted before the run:
- geometry identical across the two palettes;
- PLACED about 45–55% at 10x10 and about 65–75% at 14x14;
- CERTIFIED/PLACED at least 90%, with at most 5 named refusals per palette;
- INERT at least 80%, COSTS 5–10%, NOT-ESTABLISHED about 0.

Measured. The command was `node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --kinds=empty,branchy,bushy,loopy,open,rooms,winding --sizes=10x10,14x14 --elements='roam' --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --palette=<p>`:

| palette | cells | PLACED | CERTIFIED | named refusal | INERT | COSTS | NOT-EST. | aborted |
|---|---|---|---|---|---|---|---|---|
| pre-sword | 168 | **96** | **94** | 2 × `the-solver-cannot-cross-the-roaming-body` (bushy 10x10, rooms 10x10) | 94 | 0 | 0 | 0 |
| post-sword | 168 | **96** | **94** | 2 × the same | 92 | **1** (branchy 10x10 s7, Δ63: 149 vs 86) | 0 | 1 |

- **Per size:** 10x10 places 36/84 (43%), and 14x14 places 60/84 (71%), identical on both palettes, as predicted.
- **Geometry refusals (72 per palette, all from the composite):** 42 `the-entry-port-cannot-be-joined`, 17 `the-tunnel-shortens-the-way-to-the-goal`, 13 `the-reserved-rectangle-seals-the-room`.
- **Prediction vs measured:** the INERT share (98–100%) came in above the prediction, and COSTS (about 0.5%) far below it. That is the finding above.
- **Aborted.** The one aborted roam cell (branchy 10x10 post-sword s10) is the **pre-existing** pass-2 `swing … collideLine("Solid")` line-of-sight throw (the palette's exclusion row and bot-log §9.5c/§9b.3; an endorsed R9 exception). A second post-sword abort is outside the roam rows. At branchy 14x14 s12 the element was refused geometrically, and it is the **known swim-T2 residue**: a pass-2 `pit-patch` whose certification dies in a pit (*"…NO control block"*).

### D6: the wasm witnesses (`498ff9e`)

`check-seedling-wasm-element.mjs` gained a ROAMING branch: bodies with no kill lock must be the `roam` element's, and certified. The arena branch is unchanged. The runs were headless logic-only with `--host=http://localhost:8710 --areas=0`.

| subject | per tick | end state | failures |
|---|---|---|---|
| `roam` empty s8 **pre-sword** (2 bodies, 42 ticks) | **agrees per tick (43 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |
| `roam` branchy s7 **post-sword** (2 bodies, 149 ticks; the COSTS level) | **agrees per tick (150 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |
| `roam` loopy s6 **pre-sword** (2 bodies, 51 ticks) | **agrees per tick (52 observations)** | Δx 0 Δy 0 | **0 FAILURE(S)** |

Every run also passed: sentence = drain = game tick + 1; game level 0; game ticks = certification ticks. The branchy s7 subject is the one level where the bodies are on the route, so the real game reproduced live roaming spinners interacting with the walk tick for tick.

### D7: the pipeline room (`c02926a`)

`generateGenRoom({params: {seedlingGen: {elements: 'roam'}}})` at drawn seed 16807, pre-sword and post-sword:
- re-roll 0;
- 2 spinners, no lock, goal `totempart`;
- `placeGenItems` seats location 0 on the goal cell with tag 0.

No `GEN_ROOM_*` refusal fires for the head or the goal class. The assembler matches the goal by position.

Probe over drawn seeds 1–12 plus 16807, both biomes:
- 13/13 build, and 12 of them at re-roll 0 (drawn 6 re-rolled once, for doors);
- the element placed in 8 of 13;
- location 0 was on the goal cell every time.

The gen-room suites stay green (6 files / 84 tests including the new rows).

### D8: records (`e53aec0`)

- `architecture.md`: `roam` joins the pre-carve list.
- `seedling-bot-log.md`: a `###` section for F1.
- `generate-procgen-reference.mjs` was run after every docs or table edit, and the regenerated files are committed. `--check` reads ALL MATCH.
- `procgenDocs` is 8 files / 483 green.

**Bounded vitest AFTER:**
- the brief's four paths: **17 files / 320 tests** (BEFORE 16/308, plus `roam.test.js`'s 12);
- the other touched test files (`procgenRoam`, `refusalCensus`, `procgenRequireDirective`, `urlParams`, `procgenDoorElements`, `argvHelp`): 6 files / 179.

No unfiltered vitest and no pytest were run.

## The mutants (predicted, then one build each, copy and restore, `cmp`-identical after)

| mutant | predicted | measured |
|---|---|---|
| (a) the textless-goal switch removed (`goalClass = d.goalClass`) | every placed roam room THROWS at the collect, by the guard's own name | **24/24** placed rooms (empty s1–24, both boots) THREW: *"levelRun: level 900 holds live spinners AND a DIALOGUED ceremony (torch) is running at tick 129…"* |
| (b) the without-arm at the OTHER boot | the INERT row turns COSTS, and the COSTS row turns NOT-ESTABLISHED; the same-boot pin reds | the INERT row read **106 vs 147** (it would have graded COSTS), and the COSTS row read **NOT-ESTABLISHED**; 2 rows red |

## The kill-lock interaction, as measured

A `tset:-1` lock opens on `totalEnemies() == 0`, which counts every live enemy. The scratch probe `killlock-probe.mjs` uses the census's arena room (lock at (4,1), a 5x5 blob, textless goal, post-sword):

| arm | outcome |
|---|---|
| control (no lock, no body) | SOLVED 48 |
| lock + 1 arena body | SOLVED 358 `[kill, collect]` |
| lock + 2 arena bodies (both reachable) | SOLVED 424 |
| **lock + arena body + a roaming body in a goal-side pocket** | **BUDGET_EXHAUSTED**: the lock waits on a body behind it |
| no lock, roaming body in the goal-side pocket | REFUSED, *"the combat ladder is EXHAUSTED"* |

**Decision: refused by name.** The refusal `a-kill-lock-would-count-the-roaming-bodies` sits beside the door law (`doorRefusal`, at the anchor) and costs nothing without a roaming body. **No path reaches it today:**
- one head per level keeps `roam` away from `killgate` and `arena`;
- pass 2 cannot place a kill lock, because `wall-gap-spinner-killlock` was retired on 2026-08-16 and the active roster in both biomes is `wall-segment, water-pool, pit-patch`.

It is therefore trap 296's shape on real data. Its gate is the unit row that offers a fake `tset:-1` template to a roam room (refused) and to the chamber at the same seed (not refused).

## What the brief got wrong (measured)

1. **"PASS 2 may still add `wall-gap-spinner-killlock` in a post-sword biome."** It cannot. The row is in `POST_SWORD_EXCLUDED_TEMPLATES`, `KILL_LOCK_TEMPLATES` is empty, and neither roster has a spinner or a `tset:-1` lock. The palette's "only spinner row" at `procgenPalette.js:1337` is an exclusion row.
2. **"`headsNeeding` already excludes anything but the cut law."** It excluded only the shortcut law (`law !== LAW_SHORTCUT`). A third law would have slipped through by omission. It now tests `law === cut`.
3. **"`bodyAblation` … does NOT add a word to `GRADES`."** That is true, but two of its three words, `INERT` and `NOT-ESTABLISHED`, already ARE `GRADES` words. They are used with the same meaning, and `COSTS` is the only new one.
4. **"The binding tries another site (⚖ refuse rather than redraw)."** These conflict: the site is one `pick` and the standing ruling forbids a second one. The refusal drops the element, and the next try is the caller's.
5. **"The probe says about half."** The probe's half is positions **on the route** of an open chamber. The element's blob is a sealed side room, so 94/96 placed levels certify and the bodies are almost always inert (§ The finding).
6. The brief's first act was `git checkout -B concept-library-f1`. The harness's branch was used instead, as the brief anticipated.

## Residue

- **The design question (§ The finding)** is for a ruling: a through-room roam (both mouths open), or bodies on the main path. Without it the element is certified but rarely costs anything.
- **Two named refusals per palette** (bushy 10x10 and rooms 10x10) are F2's.
- **What F2 buys in yield:** on today's geometry, at most +2 certified per palette (94 → 96 of 96 placed). With on-route bodies, W0's 6-of-12 refusal rate is the ceiling F2 would lift.
- **Two pre-existing abort classes met in the sweep:** the swing line-of-sight throw, and swim T2's pit-patch/pit-fall. Neither is this slice's, and neither is widened around.
- **`hasTotemPartSet[0]`** is written when a roam level's goal is collected in the real game. It is inert in a one-room ship and in a pipeline room (location 0 replaces the pickup). If an exported multi-room set ever shipped roam levels with real totem parts elsewhere, the shared slot would need a look (`Player.hasAllTotemParts()` gates the Wand fade).
- **The generated reference's refusal table** did not list `arena` or `shortcut` before this slice (only `open-chamber`). `roam` was added. The two older omissions are recorded, not fixed.
