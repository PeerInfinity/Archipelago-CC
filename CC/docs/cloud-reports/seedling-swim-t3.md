# Seedling swim T3: the fallrock responder and the survey's pit edge

**Slice:** `seedling-swim-t3`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §6).

This slice is a MODEL arm and a SURVEY. The campaign is read-only here, and its route stays at sphere 2.1 (⚖ Q14).

| | |
|---|---|
| Started from | `origin/main` @ `279d75d4514b257f2e6776d6a8127ead6029b098`. The brief expected `d05e5ae017` or later; `279d75d` is 18 commits later. |
| Harness branch | `claude/seedling-swim-t3-responder-elreix`. The harness allows only this branch. It was reset onto `origin/main` before any work. |
| Commits | D1 `127b11c`, D2 `7edad28`, D3 `8d1a33b`, D4 `5da96c5`, D5 `5077ab2`, then this report. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | PASS | S2's four refusals reproduce byte-for-byte. The census, the six `--check`s and the default-mode md5s are banked. |
| D1 | PASS | `FALL_RESPONDERS` plus a run-side arm: a Button now drops its group's FallRock. It is byte-inert for every committed artifact. |
| D2 | PASS (measured, did not move) | Step 27 is still REFUSED with S2's exact text. The refusal site is T2's `botDriverV2.runHold`. |
| D3 | PASS | Survey pit edge. Step 24 goes NO-EDGE → REFUSED (the solver has no `reach-pit` goal). Step 25 goes NO-ARRIVAL → **SOLVED, 26 ticks**. |
| D4 | PASS (measured refusal) | With the Green Key granted, step 29 refuses by a NEW name. The BossLock opens only from the south, and the route arrives from the north. |
| D5 | PASS | Log section added, reference regenerated, docs check green. Bounded vitest after: 15 files, 798 tests. |

**The one thing to know first.** L29's key does not need the button. The corridor is 16 px wide and the button is 8 px wide, so a player hugging either wall walks past it unpressed. What refuses step 27 is the planner (T2's files): it reads the button tile as an obstacle whose answer is `hold`. The fix belongs in the planner, not in the responder table.

## W0: the clean tree (`279d75d`)

**The survey.** Command:
```
node scripts/procgen/survey-seedling-route.mjs --through=2.2 --out=/tmp/w0-survey.json --only=24,25,27,29 --timeout=120
```
Result: `## HEADLINE: 0/4 route steps SOLVE today`. All four refusal strings are equal to S2's JSON (a `==` comparison per row). The refusals, verbatim:
- **Step 24:** `the atlas has 0 edges L12 -> L21 (none). A route hop with more than one door has an ambiguous `reach-exit` goal and the survey will not pick one for you.`
- **Step 25:** the same text (NO-ARRIVAL).
- **Step 27:** `solverBot(survey-step-27) collect (112,64) stance (ladder-routed: no corridor from (24,232) to a stance that can collect bosskey@112,64 — 27 walkable candidate(s) in range, 27 of them with an approach to the pickup; the nearest of those is the aim and the walk's own obstacle ladder is what must open it) -> hold: button@112,128 presses group t=0, which NO responder in level 29 answers — the level's responders are [none] and its pulsers are [none] and its arrow traps are [none]. Holding it would open nothing and arm nothing.`
- **Step 29:** `solverBot(survey-step-29) reach-exit (224,160)->L32 -> keylock: undefined needs a key this run does not hold. The key is a SUB-ORDER — a `collect-placement` goal the macro layer owes — and inventing a stance for an unkeyed lock would be a wait with no mechanism behind it.`

**Banked rows:**

| Row | Result |
|---|---|
| `census-seedling-campaign.mjs` | exit 0, `⇒ NO CHAIN ROOM MOVES`, output md5 `88fa2333013aaabb84298f0f4fd5d72a` |
| `solve-seedling-r8-battery --check` | exit 0, md5 `410f27c077b1ee854a14c24b73dc6335` |
| `solve-seedling-r8-d2-chain --check` | exit 0, md5 `b470c14d1d272fb7d0e03fdcde9cf20e` |
| `solve-seedling-r8-l18 --check` | exit 0, md5 `17be7d70e7bf116f9c3438de04be6b15` |
| `solve-seedling-r8-tail --check` | exit 0, md5 `9a6a31925cb5204eee4cb0ad66febed6` |
| `solve-seedling-r9-l3 --check` | exit 0, md5 `6cd35fe1414af6bf5beb7605f235cb8e` |
| `solve-seedling-r9-campaign --check` | exit 0, md5 `2823a8112d1cb76e6d0324a5cf713085` |
| survey `--derive-only` stdout | `27ff43dbb8e4d4e08c3dc741c5a02bc7` (= S2) |
| survey `route.json` | `1e08f9ad37c505a5ca8360a882cc6b96` (= S2) |
| bounded vitest BEFORE | `activators`, `fallRock`, `levelWorld`, `levelRun`, `scripts/procgen/surveyFamily`: 5 files, 302 tests, green |

**What exists.** No `surveySeedlingRoute*` test exists. The survey's only unit-rowed piece is `surveyFamily.test.js`.

## D1: the fallrock responder (`127b11c`), PASS

**The mechanism.** `FallRock extends Activators` with a `t` (`Scenery/FallRock.as:14,33`), and its `set activate` is `if (a && !_active) { fall(); … }`. So `Button.activateAll` drops it.

**Before this slice**, the run modelled only two publishers: the rope's (L28 and L39) and the wand's (L43). It did not model the button's. A walk over L29's button therefore found the corridor open where the game lands a Solid in it.

**What landed:**
- **`activators.js`**
  - `FALL_RESPONDERS`: covers `fallrock` only.
  - `FALL_RESPONDER_ROOMS`: the rooms where a local presser shares a rock's group.
  - `groupResponders(world, t)`: every responder of a group, across all four lanes (activator, pulser, arrowtrap, fallrock).
  - `fallRocksArmedBy(world, box, movingSolids)`: the press test. It counts a Button, or a `room = -1` ButtonRoom whose publish is true.

  It is deliberately NOT a `RESPONDERS` / `ACTIVATOR_RESPONDERS` row. Those rows are Solid until published and passable after; a rock is the inverse (passable until published, Solid after). In `world.activators`, a parked rock would be a wall from tick 0 that `stepActivators` fades open.

  `fallrocklarge` is left out. The run's rock state is 16x16, and no local button shares a group with a large rock: L82's button is t=1 and its rock t=0, and L32 has no presser.
- **`levelRun.js`: the arm.**
  - **When it fires.** It is set at the end of the tick whose post-move box presses, and resolved at the top of the next tick.
  - **The frames**, derived from the add order. `Game.as` adds buttons at `:2318` and fallrocks at `:2330`, and `addUpdate` prepends, so the rock updates BEFORE the Button. Frame A (the press) is therefore live to the tape and frozen to the player (`runFrozenTick`). It is followed by the wand's dead span (`dropRocksTogether`: every `FallRock.update` call is dead) and its ghost step.
  - **What it banks.** The persistence write is banked as an earned clear.
  - **What it refuses by name:** a snap, a pulser in the group, a boss in the room, and a press made during another freeze.
- **`fallRockButton.test.js`**, 5 rows:
  1. L29's `button@112,128` has ONE responder, `fallrock@112,112`.
  2. `FALL_RESPONDER_ROOMS` is re-derived from all 116 levels.
  3. The press test hits at the centre and misses at x=114 and x=126.
  4. A centre walk drops the rock: 172 dead frames = `fallRockFreezeTicks(120).total`. The tick after the press does not move. The cell is Solid in the run's own view. The walk stops at y ≥ 130.
  5. A wall-hugging walk (x=114 or x=126) passes the button unpressed and reaches y < 80. The measured value is 66.6.

**The fallrock rooms of the map.** A census over all 116 levels via `buildLevelWorld`, `world.fallRocks` against `world.pressers`:

| Level | Rocks | Pressers | Same-group local |
|---|---|---|---|
| L28 | `fallrock@112,240` (t1, tag1) | `button@112,240` (t0) | none (the rope publishes t1) |
| **L29** | `fallrock@112,112` (t0, tag0) | `button@112,128` (t0) | **yes** |
| L32 | `fallrocklarge@64,128` (t0, tag1) | none | none |
| L37 | `fallrock@288,32` (t0, tag4) | none | none (armed cross-room from L38's `buttonroom`, R1) |
| L39 | `fallrock@144,624` (t6, tag10) | six buttons (t0–t5) | none (the rope publishes t6) |
| L43 | three rocks (t0) | none | none (the wand publishes t0) |
| **L74** | `fallrock@288,144` (t0, tag2) | `button@288,128` (t0) | **yes** (the mirror of L29: the button is above the rock) |
| L82 | `fallrocklarge@128,224` (t0) | `button@192,240` (t1) | none |

**Why no committed tape moves.** Tapes entering L29 or L74: `r5-bosskey-leg` (L29, booting at the north side, 96,32), `r2-walk-5-darkshield`, `r2-walk-full` and `r3-collect-darkshield` (L74). I replayed each through `runTape` with a per-tick overlap test against the button rects. None presses: the nearest approach is 63.9 px in L29 and ≥ 250.6 px in L74. With no press, the arm never fires.

**Gate rows (D1 tree):**

| Gate | Result |
|---|---|
| `census-seedling-campaign.mjs` | exit 0, output `cmp`-IDENTICAL to W0 (`88fa2333…`) |
| six r8/r9 `--check`s | all exit 0, every output `cmp`-IDENTICAL to W0 (md5s as in the W0 table) |
| bounded vitest: W0's 5 files + `fallRockButton` | 6 files, 307 tests, green |
| `r5Acceptance` + `deadFrameBand` + `tapeRunner` (the tape-replay suites) | 3 files, 459 tests, green |

**Mutants** (each one build, copy and restore; the file md5 is identical after):

| Mutant | Predicted | Measured |
|---|---|---|
| (a) `FALL_RESPONDERS.fallrock` renamed away | rows 1–4 red, row 5 (asserts no fall) green | 4 failed, 1 passed |
| (a2) the live-site `armButtonFallRocks` call removed | row 4 red only | 1 failed, 4 passed |

The brief's second half of mutant (a) ("step 27 refuses with S2's text again") is vacuous. Step 27 refuses with S2's text with the row present too (D2).

## D2: step 27 re-run (`7edad28`), PASS as a measurement

**Prediction:** REFUSED, text identical to S2's. The refusal is raised by `botDriverV2.runHold`'s group check, which reads `world.activators`/`pulsers`/`arrowTraps` and not `groupResponders`. It fires at plan time, before a tick runs, so the D1 arm cannot reach it.

**Command:**
```
node scripts/procgen/survey-seedling-route.mjs --through=2.2 \
  --out=CC/docs/cloud-reports/seedling-swim-t3-survey.json --only=27 --timeout=180
```
**Result:** REFUSED in 269 ms, text byte-identical to S2's (quoted in W0). Nothing in `fixtures/` moves.

**What the right verdict is.** In the MODEL, the key IS reachable from the south without pressing. The two wall-hug walks above reach y=66.6 beside the key. The solver refuses because `planTilePath` works in whole tiles: the button tile's centre box overlaps the 8x6 avoid volume, and `OBSTACLE_STRATEGIES['proximity-hazard:button'] = 'hold'` turns that into a press.

If `runHold` did consult `groupResponders`, the hold would press, the D1 arm would drop the rock into (112,112), and the walk to the key would then refuse on the rock. Pressing is a trap here; it is never an opener.

**The fix is T2's.** Two options, in `botDriverV2`/`solverBot`:
- a sub-tile corridor past a stand-on volume; or
- a `hold` refusal that names the fallrock lane and hands the leg back to the planner as "avoid, do not press".

## D3: the survey's pit edge (`8d1a33b`), PASS

**What landed** (`--through` only; the model is imported under the flag). `pitEdgeFor(from, to)` requires all of the following:
- `world.fallthrough.level === to`: the level's `control` block, as `levelWorld` reads it.
- The AP export's `preset_sidecars` names exactly one `out_pit_*` exit tile for the hop.
- The model builds that tile as a pit tile.
- `playerPhysicsV2.fallDestination` (the run's own fall resolver) lands where the export's `target_spawn` says.

If any of these fails, the hop refuses by name.

For L12 the two sources agree: tile (36,43) = `pit@576,688`, control offset (496,608), landing L21@80,80. The landing is the same for every point in the tile, because the offset is tile-aligned and the resolver snaps.

**How the steps use it:**
- The crossing becomes a `reach-pit` goal, handed to the solver as is.
- The next step's arrival is the landing, staged on the ground. The boot note names this: it is not the 83 px ceiling descent the fall plays.

**Predictions:** 24 REFUSED on the solver's own vocabulary; 25 SOLVED or a room refusal. Both held.

**Rows before → after:**

| Step | Before (S2 / W0) | After (T3) |
|---|---|---|
| 24 L12 | NO-EDGE: `the atlas has 0 edges L12 -> L21 (none)…` | REFUSED: `solverBot: goals[0]: unknown goal kind "reach-pit". Slice 2 owns 'reach-exit' and 'collect-placement'; a new kind is a policy addition, not a free string here — the trace's vocabulary is open, the solver's is not.` |
| 25 L21 | NO-ARRIVAL: the same text | **SOLVED, 26 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass. Boot: staged `r8-solve-11` re-pointed at `L21@80,80`, *"the arrival is a PIT landing (pit@576,688 (out_pit_5_5, tile 36,43)), staged on the ground at the fall's ctor args rather than as the ceiling descent"*. |

**Default mode is byte-identical.** `--derive-only` stdout is `27ff43dbb8e4d4e08c3dc741c5a02bc7` and `route.json` is `1e08f9ad37c505a5ca8360a882cc6b96`, re-measured after D3 and again after D4.

**Mutant (b)**, `pitEdgeFor` returning null (predicted: S2's two verdicts and texts):
- Measured: 24 NO-EDGE and 25 NO-ARRIVAL, each `==` S2's row.
- Restored, file md5 identical.

## D4: step 29 with the key granted (`5da96c5`), PASS as a measured refusal

**The staging needs no producer change.** A tape's v6 `save.keys` block is read by `levelRun` at boot (`levelRun.js:3513`). So the survey stages one arrival-keyed row, `STAGED_SAVE_GRANTS`: `L30@64,16 → keys [1]`, the Green Key collected at step 27. It applies under `--through` only, and the row records `boot.saveGrant` in its output.

**Command:** `--through=2.2 --only=29 --timeout=180`, predicted SOLVED or a new named refusal. Row, verbatim:

> REFUSED — `solverBot(survey-step-29) reach-exit (224,160)->L32 -> keylock stance (bosslock@64,32) -> keylock stance (bosslock@64,32) -> keylock stance (bosslock@64,32) -> keylock stance (bosslock@64,32): applied 4 strategies for one goal [keylock(bosslock@64,32), keylock(bosslock@64,32), keylock(bosslock@64,32), keylock(bosslock@64,32)] and the corridor still does not plan. A policy that keeps clearing obstacles without a corridor appearing is not making progress.`

**Why, read off the map and the AS3:**
- `BossLock.update`'s probe is `collideLine("Player", …, y - originY + height + 1, …)`, the one-pixel row BELOW the lock. The model's `keyLine` for `bosslock@64,32` is `{x0 66, x1 75, y 49}`.
- L22's `teleporter@96,192` lands at L30@64,16, a one-tile pocket NORTH of the lock. The pocket's only other exit is the teleporter back.
- So the Green Key cannot open this door from the side the route arrives on.
- Meanwhile the AP export gates `level_30__r0c4 -> level_30__r2c10` and its reverse on `Has(Green Key)` in both directions.

This is a gating mismatch between the atlas/AP rules and the game, not a staging bound. Whether the game intends L30 to be entered first from L28 or L31 (opening the lock from the south) is a question for the atlas derivation's owner.

## D5: records (`5077ab2`), PASS

- **`seedling-bot-log.md`:** § *Seedling substrate T3-swim — the fallrock responder and the survey's pit edge*, directly after § S2-swim. T1 and T2 append there too, so a merge conflict at the coordinator is expected.
- **The reference.** `generate-procgen-reference.mjs` was run (README index + `docsIndex.js`). `check-procgen-docs.mjs` prints `ALL CHECKS PASSED`.
- **The survey JSON.** `CC/docs/cloud-reports/seedling-swim-t3-survey.json` holds the final `--only=24,25,27,29 --timeout=180` rows on the finished tree (md5 `ade5c875ad295f92075c9e0995dc0d05`). `## HEADLINE: 1/4 route steps SOLVE today`.
- **Bounded vitest AFTER:** W0's 5 files + `fallRockButton` + `scripts/procgen/checkProcgenHelp` + `frontend/modules/procgenDocs`. Result: 15 files, 798 tests, green. The unfiltered suite was not run (ruling 52).

## Survey rows 24/25/27/29: before → after

| Step | Level | S2 / W0 | T3 |
|---|---|---|---|
| 24 | L12 | NO-EDGE | REFUSED: the solver has no `reach-pit` goal (T2) |
| 25 | L21 | NO-ARRIVAL | **SOLVED, 26 ticks** (staged at the pit landing) |
| 27 | L29 | REFUSED (the button) | REFUSED, byte-identical: the planner's `hold` (T2) |
| 29 | L30 | REFUSED (no key) | REFUSED by a new name: the one-sided BossLock vs AP's two-way Green-Key rule |
| 30 | L32 | REFUSED (macro layer) | not re-run; stays refused (R-f is a design, not this slice's) |

## What the brief got wrong (measured)

1. **The AS3 path.** `FallRock.as` is `vendor/seedling/src/Scenery/FallRock.as`, not `Puzzlements/`.
2. **"Mutant (a): the row removed ⇒ step 27 refuses with S2's text again."** Step 27 refuses with S2's text with the row present. The refusal is `botDriverV2.runHold`'s (T2's file), at plan time.
3. **"A walk that presses the button on the way to the key…"** No walk needs to press it. The 8 px button in a 16 px corridor is passable unpressed by the 4 px player box. The route consequence belongs to the planner.
4. **"`levelWorld.js` the responder table".** `ACTIVATOR_RESPONDERS` is consulted only in the `collider === 'rect'` branch, and `activators.test.js` pins it as `RESPONDERS ∪ KEY_RESPONDERS`. A `fallrock` entry there would be unreachable, and its sign inverted. The table landed in `activators.js`; `levelWorld.js` is unchanged.
5. **"Step 29 is a bound, not a wall: with the key it should plan."** It does not plan. The door opens only from the south, and the route arrives from the north.
6. **The expected SHA.** The brief expected `d05e5ae017`; `origin/main` was `279d75d` (18 commits later).

## Residue

- **Owed to T2 (the planner):**
  - a sub-tile corridor past a stand-on presser, or a `hold` that recognises the fallrock lane as "avoid, do not press";
  - a `reach-pit` goal kind. Its `allowPit` tile is the survey's `goal.pit`.
- **The atlas derivation:** the one-sided BossLock at L30 (`level_30__r0c4 ↔ r2c10`), and any other BossLock whose arrival side is the probe-less side. Not censused here.
- **The D1 arm is unwitnessed.** Frame A (live, player frozen) and the dead span equal to `fallRockFreezeTicks` are read from the add order, not measured. A game witness of a synthetic L29 press would pin them. L29's turrets during the freeze are the wand arm's semantics (`dropRocksTogether` steps no turret) and are unmeasured.
- **`fallrocklarge`** would need 32x32 run state before it could join `FALL_RESPONDERS`. No local button reaches one today.
- **The survey's staged grants are one explicit row.** A derivation that grants every earlier route pickup to later staged rooms would also move rows 22–30 (the shield). That is a policy.

## Byte-inertia

| Artifact | W0 (clean `279d75d`) | After (finished tree) |
|---|---|---|
| `census-seedling-campaign.mjs` output | `88fa2333013aaabb84298f0f4fd5d72a`, exit 0, `NO CHAIN ROOM MOVES` | `cmp`-identical |
| `solve-seedling-r8-battery --check` | `410f27c0…`, exit 0 | identical |
| `solve-seedling-r8-d2-chain --check` | `b470c14d…`, exit 0 | identical |
| `solve-seedling-r8-l18 --check` | `17be7d70…`, exit 0 | identical |
| `solve-seedling-r8-tail --check` | `9a6a3192…`, exit 0 | identical |
| `solve-seedling-r9-l3 --check` | `6cd35fe1…`, exit 0 | identical |
| `solve-seedling-r9-campaign --check` | `2823a811…`, exit 0 | identical |
| survey `--derive-only` stdout | `27ff43dbb8e4d4e08c3dc741c5a02bc7` | identical |
| survey `route.json` | `1e08f9ad37c505a5ca8360a882cc6b96` | identical |
| `frontend/modules/seedlingDemo/fixtures/**` | — | 0 files differ from `origin/main` |
| `campaign-frontier.json`, AS3, wasm, gitlinks | — | untouched |
