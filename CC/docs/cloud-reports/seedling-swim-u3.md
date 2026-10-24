# Seedling swim U3: F2 end to end — the strike schedule's line of sight and the corridor-body head

**Slice:** `seedling-swim-u3`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §14).

| | |
|---|---|
| Started from | `origin/main` @ `a8225ce975` (the brief's expected SHA) |
| Harness branch | `claude/seedling-swim-u3-42d4q1` (the harness pins this branch) |
| Commits | D1 `6e2a8fc5` · D2 `30bdc6ae` · D3 `0dee3d40` + witness `f1c6793e` · D4 docs `813dbba5` + log `cba2d0a0` · this report |
| Parallel sibling | U2 (the `skirt` executor, `resolveKeylockStrategy`, `mover.js`, `botDriverV2.js`, the survey). None of those were touched here. |

`origin/main` has moved since the start (`bc99136d`, other work). U2 has not landed. The merge is the coordinator's.

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces U1's and F1b's values. |
| D1 | **PASS** | `run.collideLineSolid` is the one simulation line. `tapeRunner` is 365/365 before and after, and the identity block is unmoved. |
| D2 | **PASS (line of sight) / STOP (hammer-safe half)** | (2,2) SOLVES in 154 t, so post-sword now solves 9 of the 12 positions. The hammer-safe widening is what the search already does. |
| D3 | **PASS, with one measured correction** | `corridorbody` places 137 and certifies 76 of 168 cells post-sword (roam: 10/8). The witness agrees per tick. The sword grade is **SHORTENS, not STRONG**. |
| D4 | **PASS** | The log section, the seedling-bot.md sentence, architecture.md, the catalogue, the reference and docs index regenerated, and the surface table GREEN at 185. |

**The one thing to know first.** The corridor body is the lever the through-room lacked, and its yield is 14× roam's. The brief's premise that "the without-arm is REFUSED by the sword (STRONG)" does not hold, however. On the certified `rooms` seeds, the pre-sword solver walks past the billiard when it bounces clear of the cut, so `--require=hasSword` grades it SHORTENS. I kept `needs: ['hasSword']` (the seam refuses it by name pre-sword) and added `meetsRequire: false` to the table row. `headsNeeding('hasSword')` therefore stays `[killgate, arena, rockgate]`. Without that field the head would have joined the `require` `+` list, which moves every `--require=hasSword` room: measured, `seedlingGenRoomRequire` went red, and the docs' seed-25 STRONG demo sits on the same path. Whether a corridor body should ever be a `require` head is a ruling.

## W0: the banked rows (clean tree `a8225ce975`)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8830`) | maze `246dfbce…`, acceptance `4330bad7…`, c3 `fa0dc4bb…`, c6 `f5c9ece7…`, **c4 `8c972028…`**, ENEMY `4ce6c5b3…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`65e81dd3…`, level pre/post s1 `e28c1e5d…`/`9219ff91…`, generated set OK, reference ALL 7 + 5 MATCH. All of these equal F1b's table. |
| six r8/r9 `--check`s | battery `410f27c0…`, d2-chain `b470c14d…`, l18 `17be7d70…`, tail `9a6a3192…`, r9-l3 `6cd35fe1…`, r9-campaign `2823a811…`, all exit 0 |
| `census-seedling-campaign` | `88fa2333013aaabb84298f0f4fd5d72a`, `NO CHAIN ROOM MOVES` (U1's value) |
| `tapeRunner.test.js` | **365 passed** (1 file, 63 s). The brief said 360 and ~195 s. It prints no identity md5. |
| bounded vitest (the brief's five paths) | **14 files / 360 tests**, green |
| roam yield (F1b's command) | pre `3137c9db…`, post `b7070c77…`. Both palettes: 168 cells, 10 placed, 8 certified, 2 × `the-solver-cannot-cross-the-roaming-body` (`branchy` and `winding` 14x14 s12). |

The twelve positions and the CORRIDOR arm reproduced U1's table exactly. Post-sword: 8 of 12 solve; (2,2), (7,6), (2,7) and (3,6) refuse. Pre-sword: the six U1 solves solve at 218 t and the other six refuse; the CORRIDOR arm refuses on both boots.

## D1: the member

- **Name and shape:** `run.collideLineSolid(fromX, fromY, toX, toY)` returns the first Solid box, `{tag, at: {x, y}}`, or `null`. It is the closure `assertSpinnerLineOfSight` already asks: the same live geometry and the same truncating signature.
- **Placement:** `levelRun.js`, beside `arrowCoverAt`. `advance` never reads it.
- **No door export.** The door (`solverView.js`) carries static imports only, and a run member reaches the family through the run object. The brief's "a door export" does not apply.
- **Surface row:** `run / seedling / geometry-query`. The brief's `form: query` is not a form: `FORMS` is `live-state, event-ledger, forecast, stepper, geometry-query, constant, function`. The census adds the row at the member's first family read, so it landed with D2 (184 → 185). At D1 alone, `--check` was GREEN at 184.
- **The proof, run at a pristine D1 worktree:** `tapeRunner` **365/365** before and after. Every identity row matches W0 row for row. The worktree's reference row reads "4 DIFFER", which is an environment artifact: it reads the same in every worktree, and at every head the main tree reads ALL MATCH.

## D2: the schedule sees walls

**What shipped:**
- `strikeLineBlocked` asks every body the train could test: the slash rect overlaps it, it is within `SLASH_REACH`, and `run.collideLineSolid` from the cell to its entity point finds a blocker. The window is forecast indices `i .. i + SLASH_HIT_TICKS`.
- `deriveStrike` skips a (cell, tick) that fails this and counts the skip (`sighted`).
- The no-strike refusal names the count only when it is greater than 0, so every refusal the check did not touch keeps its text.
- `trainLineBlockedHere` adds the same check to the live press arm, over its previewed aim, press and stand positions.
- **Finding:** U1's (2,2) came from that live arm. It pressed from the START cell (27.4, 25.9) at a body that had wandered into reach across the corner of tile (2,1).

**Twelve positions + CORRIDOR, post-sword, W0 → D2 (first lines):**

| position | W0 | D2 |
|---|---|---|
| (4,4) (7,2) (2,3) (3,3) (7,7) (5,2) | SOLVED 221/123/142/150/123/123 | unchanged |
| (5,5) (6,6) | SOLVED 234/235 | unchanged |
| **(2,2)** | REFUSED: `… the combat ladder is EXHAUSTED …` whose kill line is *"… swung through a Solid — … tile:Stone at (32, 29.000000000000004) on the line to its entity point …"* | **SOLVED 154 t**, certified, 1 kill (3 landings, 137 t) |
| (7,6) | `… -> kill (spinner@112,96) by press: no reachable cell … for the next 45 tick(s) … nowhere to be.` | byte-identical |
| (2,7) | `… -> kill (spinner@32,112) by press: every key set … There is no step out.` | byte-identical |
| (3,6) | `… EXHAUSTED …`, kill line *"no (cell, tick) … 640 ticks … 44 opportunit(ies)"* | byte-identical (0 skipped, so the text is unchanged) |
| CORRIDOR (4,1) | `… EXHAUSTED …`, kill line *"… 40 opportunit(ies)"* | byte-identical |

Predicted: (2,2) SOLVES or refuses by a new name, and the other three are unchanged. Measured: exactly that. **Pre-sword:** all 13 rows are byte-identical to W0.

**The hammer-safe half: STOP.** `deriveStrike` already takes every walkable cell of the room and tests the body's 7×7 rect and the hammer line at each train tick's own phase (`clearOfHammersAt` with `gameTimeAt(i+1)`, exact on every procgen boot). It does not test every tick. The *"nowhere to be"* text belongs to `deriveRefuge`, which is only asked after no strike was derivable. Its window is the body's i-frame or one hammer period (45 t), priced over that whole window by design (trap 154). Widening it would be a policy change, not the missing predicate.

**Mutant (a):** both predicates forced false (`return null` / `return false`). Predicted: (2,2)'s text is byte-identical to W0. Measured: `BYTE-IDENTICAL` after `diff` (the probe's name normalised). The solverBot md5 was `68be2028…` before and after the restore.

**Unit row:** `solverSpinnerKill.test.js`'s (2,2) row, which was "REFUSED, naming the line-of-sight refusal", now reads "SOLVES in 154 t, the swing planned on a clear line".

## D3: `corridorbody`

**What shipped:**
- `soloDoor.CORRIDOR_BODY`: on-connector, `LAW_CUT`, `buildSoloDoor`'s cut search, id `corridorbody_door`, and the rock gate's refusals.
- The realiser row: `spinner {tag:'-1'}`, with no lock and no tag.
- `ON_CONNECTOR_BODY_IDS`. The on-connector composite carries `bodies` + `killLockCell: null` only when there are any, so no rock-gate payload moves.
- The TEXTLESS goal swap on the on-connector commit.
- The `ELEMENT_TABLE` row, LAST, with `needs: ['hasSword']` and `meetsRequire: false`.
- The `generate-seedling-level` line for a body door, and the wasm witness branch.
- `roamingBodies` then carries the refusal name, the body ablation, and the kill-lock-counts-the-roamers clause, with no second spelling.

**Yield** (F1b's kinds/sizes/seeds/bounds, `--elements=corridorbody`; the prediction was written before the run):

| palette | cells | PLACED | CERTIFIED | named refusals | geometry | harness |
|---|---|---|---|---|---|---|
| **post-sword** | 168 | **137** (pred ~146) | **76** (pred 90–115) | 59 × `the-solver-cannot-cross-the-roaming-body` (pred 30–55), 2 × `the-certification-solve-exhausted-per-target-ticks` | 22 `wall-does-not-seal` (pred 22) | 9 TIMEOUT, 10 THREW `GenerationAborted` |
| **pre-sword** | 168 | 146 | **0** (pred 0) | every placement refused at the seam | 22 `wall-does-not-seal` | 0 |

Post-sword per kind × size (placed / certified / named roaming refusals):

| kind | 10x10 | 14x14 |
|---|---|---|
| empty | 10 / 8 / 1 (+1 budget) | 10 / 8 / 1 (+1 budget) |
| branchy | 11 / 8 / 3 | 7 / 2 / 5 |
| bushy | 12 / 6 / 6 | 11 / 5 / 6 |
| loopy | 8 / 4 / 4 | 10 / 5 / 5 |
| open | 6 / 4 / 2 | 6 / 4 / 2 |
| rooms | 11 / 7 / 4 | 12 / 5 / 7 |
| winding | 12 / 5 / 7 | 11 / 5 / 6 |

- **Body ablation:** INERT 19, COSTS 44, NOT-ESTABLISHED 3, aborted 10.
- **Sweep md5s:** post `23e51330…`, pre `149958a9…`.
- **The 10 throws** are one class: *"the player fell into a pit in level 900, which has NO control block"* (`PhysicsV2Error`), which is swim T2's pit residue. W0's roam sweep has the same class. A body on the route makes the walk dodge and take knockback near pass-2 pits more often.
- Of the 59 named refusals, 41 read *"the combat ladder is EXHAUSTED"* or *"the danger map forbids"*. The rest are the press executor's *"nowhere to be"* and *"no step out"*, the same two walls as (7,6) and (2,7).

**The grade (measured, and what the brief got wrong):**
- `--require=hasSword --elements=corridorbody` refused `the-item-is-not-required: SHORTENS` on `rooms` 10x10 s1 and s3.
- The certification verbs at those seeds were `[collect]` only: the post-sword walk dodged the body too.
- Hence `meetsRequire: false` (see the headline).

**Witness** (`check-seedling-wasm-element.mjs --elements=corridorbody --biome=post-sword --seed=1 --skeleton=open --width=10 --height=10 --areas=0 --host=http://localhost:8830`, headless logic-only):
- The level certified in 223 t with `[kill, collect]`, with `corridorbody_door` at (2,1) and `killLockCell` null.
- **Agrees per tick (224 observations)**, end Δx 0 Δy 0, game 223 = certification 223, **0 FAILURE(S)**.

**Mutants** (each predicted first; one build, copied and restored md5-identical, tree clean after):
- **(b)** `needs` dropped. Predicted: the table row and the pre-sword row red. Measured: exactly those 2 red. Pre-sword the solve then runs and refuses `the-solver-cannot-cross-the-roaming-body`.
- **(c)** The removal is never observed (`if (!body) continue` and the final check forced). Predicted: the witness reds as a budget verdict, not renamed. Measured: 1 red, `BUDGET_EXHAUSTED`, gap `the-certification-solve-exhausted-strike-schedule bound (2010 driven ticks)`, *"… 6 strike(s) planned, 3 landing(s)) and the body is still in the world."*

**Tests:**
- New: `procgenCorridorBody.test.js`, 7 rows.
- Two pinned head lists appended (`urlParams.test.js`, `procgenDoorElements.test.js`).
- `procgenCore/**` + `procgenDocs` + the D3 suites: 74 files, 2455 tests, green after the two list updates.

## Surface table delta (184 → 185, `--check` GREEN)

| row | class / form | why |
|---|---|---|
| run `collideLineSolid` | seedling / geometry-query | Returns the first Solid box a truncated 1 px World.collideLine raycast from one point to another meets, or null: the levelRun closure assertSpinnerLineOfSight asks, Player.slash's line-of-sight gate on a swing at an Enemy, a Seedling hit rule. |

The existing rows grew by site counts only (`spinnerForecast`, `state`, `distanceRectPoint`, `SLASH_HIT_TICKS`, `SLASH_REACH`, `slashRect`, `SPINNER`). `census-seedling-constants --check`: PASS, 0 new.

## What the brief got wrong (measured)

1. **The corridor body's sword grade is SHORTENS, not STRONG.** See the headline. The `require` path is kept unmoved by a declared row field.
2. **`form: query`** is not a surface form; the nearest is `geometry-query`. A run member also has no **door export**.
3. **`tapeRunner`** has 365 tests, not 360, and runs in ~60 s, not ~195 s. It prints no identity md5.
4. **"The byte-inertia rows are the proof nothing committed moves."** D2 moved one identity row, **`carved pairs c4`** (`8c972028…` → `3bacdc9e…`). The only differing line: `bushy post-sword seed 6` **THREW** the run's line-of-sight `Error` at W0 (it escaped the generator), and now it generates (TARGET_REACHED, 114 → 118 t). This is the D2 fix working on a pass-2 spinner. It is a measurement row, not a committed artifact. The standing header value is the coordinator's; `standing-values --write` was not run.
5. **The hammer-safe widening** is what the search already does (see D2).
6. **The corridor body does not stay on its cell.** A spinner is a billiard. It starts ON the cut and roams the corridor, so some levels certify by a dodge (`[collect]`) and some by a kill (`[kill, collect]`).

## Residue

- **(7,6), (2,7), (3,6) and the CORRIDOR arm** still refuse. These are the refuge's 45-tick window, the per-tick step-out, and a transit-unsafe corridor. They are the same walls as 22 of the corridor body's 59 named refusals, so the next solver lever is a moving refuge or a deeper `stepToward`, not the line of sight.
- **The pit-class throws** (10 of 168 post-sword cells) are swim T2's `pit-patch` with no control block. The body makes them likelier.
- **`meetsRequire`** is a new table field that `headsNeeding` reads. Whether a corridor body should ever be a `require` head (for example, with a geometry that pins the billiard) is a ruling.
- **The worktree reference row** reads "4 DIFFER" in any detached worktree. The main tree reads ALL MATCH.
- **Scratch instruments** (session scratchpad): `probe-positions.mjs`, `probe-cb.mjs`, `cert-witness.mjs`, and the bank scripts.

## Byte-inertia

| Artifact | W0 (`a8225ce975`) | D1 (`6e2a8fc5`) | D2 (`30bdc6ae`) | D3 (`0dee3d40`) |
|---|---|---|---|---|
| identity block, 13 md5 rows | as F1b | identical | identical **except c4** (`3bacdc9e…`, see above) | identical to D2 |
| six r8/r9 `--check`s | `410f27c0…` `b470c14d…` `17be7d70…` `9a6a3192…` `6cd35fe1…` `2823a811…`, exit 0 | identical | identical | identical |
| campaign census | `88fa2333…`, NO CHAIN ROOM MOVES | — | identical (content; the path differs) | — |
| generated set | OK | — | OK | OK (worktree), and OK at head on :8830 |
| `tapeRunner.test.js` | 365/365 | 365/365 | — | 365/365 at head |
| roam yield blocks (pre/post) | 10/8/2 | — | identical | identical |
| `fixtures/**`, presets | — | — | — | `git diff origin/main` = 0 lines |
| solver surface | GREEN 184 | GREEN 184 | GREEN 185 | GREEN 185 |
| reference `--check` (main tree) | ALL MATCH | ALL MATCH | ALL MATCH | ALL MATCH at every head |
| bounded vitest (five paths) | 14 / 360 | — | — | 14 / 360 at head |

No AS3, wasm, gitlink, tape, biome default, `standing-values`, `pytest` or unfiltered vitest was touched or run. None of U2's regions were touched.
