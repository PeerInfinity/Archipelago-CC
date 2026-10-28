# Seedling fidelity L100FIX — the 8 px swing arm asks only the cells the 16 px ring cannot name (`fineSwingStance`, still OFF)

Wave 34, planner `seedling-fidelity-planning-16`. Session `seedling-fidelity-l100fix`.

- **Start:** main `caa42ea5df` (97 default-ON keys of 109, counted in `contactFidelity.js`).
- **Head:** see the last section (the report is the last commit).
- **Harness branch:** `claude/seedling-fidelity-l100-fix-inlx5f`.
- **Evidence:** `seedling-fidelity-l100fix-evidence/` (the arm probe is `tools/leg371-arms.mjs <0|1>`).
- **Port:** 9761.

| D | verdict | switch | what changed |
|---|---|---|---|
| W0 | **PASS** | — | Leg 371 reproduced in both arms. The first divergence is at t1286: the 16 px ring failed on its **start tile**, and the fine arm admitted a cell inside a ring cell's tile. |
| D1 fix | **PASS** | `fineSwingStance` (OFF) | The fine arm skips cells the ring already named, and admits the rest by `stanceReaches` on the 8 px lattice. With the key ON, leg 371 solves key for key, both `--check`s are green, and L100 is unchanged. |
| D2 flip readiness | **PASS** (the list is below; default NOT flipped) | — | Key ON: the only bounded-vitest red is the defaults pin. Identity block, six chain `--check`s, tapeRunner pairs and 95 producers are all unchanged. The survey moves one row (step 219, as W33 measured). The standard probe battery ON is 11/11 ALL CHECKS PASSED, and `r7-ends-meet --check` is CLEAN. |

## W0 — the base, and leg 371's divergence

| row | command | result |
|---|---|---|
| base | `git checkout` at `caa42ea5df`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9761 identity-block.sh .` with the base `solverBot.js` (the only tracked diff at the time; `identity-before.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK. File md5 **`590b0b88`** (= W33's) |
| six `--check`s | in the block | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, **all exit 0** |
| reference | in the block | 4 DIFFER (the known box artifact, the same at base and head) |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` | **639** passed, md5 **`c2260ed7`** |
| surface / constants / entities / profile | each `--check` | surface RED at D1 (−1 `run:state`, −1 `run:world` site, mine; re-written in `9503728e`) · constants PASS **6,999** · entities PASS **566** · profile PASS **138** |
| roster | `fixtures/tapes/index.json` | **291** tapes (unchanged) |
| bounded vitest BEFORE | the brief's list, plus every test that `grep -a`s `deriveSwingStance` / `fineSwingStance` / `stanceReaches` / `deriveBreakStance` / `breakStanceCandidates` / `execBreak` / `resolveBreakStrategy` / `breakVerb` / `stanceHypothesis`, plus the surface/constants/entity/profile tests (`vitest-files.txt`; 95 default + 2 slow files) | **2,298 / 2,298** + slow **rc 0** |

**Leg 371, both arms** (`tools/leg371-arms.mjs`; `movingWait` + `bombBlastBody` ON, strike floor OFF, `CHOOSER_PAIR` /
`OPPORTUNISTIC_STRIKE` / `ICETURRET_STATIC_KILL` at the defaults, OFF). It runs in **~7 s** per arm, not the brief's ~5 min.
- OFF: **SOLVED 1,667 t**. Verbs: brave `iceturret@472,400`, hold, kill `spinner@192,128`, break `breakablerock@176,128` from
  (200,136), hold, collect.
- ON (base code): **REFUSED** *"collect (64,144) stance (ladder-routed: …) -> hold stance (wandlock@176,80) -> break stance
  (breakablerock@176,128): applied 4 strategies for one goal [brave(iceturret@472,400), hold(wandlock@176,80),
  hold(wandlock@208,128), break(breakablerock@176,128)] and the corridor still does not plan."* That is the brief's
  ladder-routed refusal, now with the bound's sentence on the end.

**The first divergent stance call** (scratch instrumentation, not committed; `w0-leg371-divergence.txt`):
- Both arms apply the same ladder up to t1112: brave, hold `wandlock@176,80`, hold `wandlock@208,128` (stance (280,216)),
  then break `breakablerock@176,128` with stance (200,136).
- At **t1286**, the walk to that stance (`walkToUnder` → `identifyAndSelect` → `resolveBreakStrategy` → `deriveBreakStance`)
  re-derives the break stance from **(270.62,174.17)**.
  - The 16 px ring offers (168,136), (200,136) and (200,152). All three fail, both directly and under the hypothesis.
  - **Why they fail:** `planWaypoints` on the 16 px lattice from that point says *"A\* start tile (16,10) … is not walkable:
    solid ruinedpillar at (264,136)"*. The ring failed on its **start**, not on its cells.
  - OFF, the refusal sends the ladder to kill `spinner@192,128`. The break from (200,136) then solves.
  - ON, the fine arm plans on 8 px from the same start: `[(260,172), (196,132)]`. It returns **(196,132)** with
    `discharged: []`, and the ladder's attempt at a fifth `break` hits `MAX_STRATEGIES_PER_GOAL` (4).
- `stanceReaches(run, (196,132), contacts, hypothesis)` on 16 px returns **null**, for the same start-tile reason.
- **All 11 fine candidates** at t1286 lie inside a ring candidate's tile: 4 in (168,136)'s (their 8 px plans fail), and 7 in
  (200,136)'s or (200,152)'s (their 8 px plans pass).

**Mechanism (measured; the suspect was partly wrong).** The suspect said the fine arm skips the hypothesis test. Adding
`stanceReaches` alone does not fix it, though:
- On 16 px it rejects every cell from this start, including the sliver's own L100 walk: that is W33's mutant M1, row 2.
- On 8 px it admits (196,132).

The real difference is the **lattice of the start**. The fine arm re-asked, on a finer lattice, cells the ring had already
named, so it overrode the ring's answer instead of extending it.

## D1 — the fix (`solverBot.js`, behind `fineSwingStance`) — PASS

**The change** (`deriveSwingStance`'s fine arm, plus `stanceReaches`' optional lattice):
- A fine candidate whose 16 px node (`nodeCentre(nodeAt(c, 16), 16)`) is one of the ring's candidates is skipped: the ring
  already asked that cell. `admit` still applies.
- Each remaining cell is admitted by **`stanceReaches`, the 16 px loops' own test, planned on `FINE_LATTICE`**. With
  `STANCE_ROCKS` ON, every cell is first asked directly (`() => []`), then under the same ownless hypothesis. `discharged`
  comes back as the ring's does.
- `stanceReaches(run, aim, contacts, hypothesisOf, lattice = null)`: with no lattice, both `planWaypoints` calls get exactly
  the opts they always did (`solverPlanOpts`' `extra` defaults to `{}`).
- OFF is byte-identical by construction (the 16 px loops are untouched) and by measurement (below).
- The rule is general: it names no level, rock or tile. L100's sliver cells (124,y) have 16 px nodes (120,y), which are
  `pixelmask` obstacles and never ring candidates, so they remain this arm's to ask.

**Target, with the key ON:**

| row | result |
|---|---|
| leg 371 (`fidelityL100Fix.test.js`, new) | **SOLVED 1,667 t**. Verbs [brave, hold, kill, break, hold, collect], break stance (200,136), `perTick` key for key equal to `wandhold-l42-371-paced` |
| `fidelityWandHold.test.js` (`SEEDLING_FINE_SWING_STANCE=1`) | **10 / 10** (both L40 legs' witness rows) |
| `plan-seedling-hammer-bw-bombstand --check` | green with the key OFF and ON (1,667 t, player hits 0) |
| `plan-seedling-l100-witness --check` | green with the key OFF and ON (byte-identical) |
| `fidelityL100.test.js` | **3 / 3**: the sliver's OFF refusal; the ON plan IS `l100-sliver-rock`; the arrival no longer refuses the stance |
| L100→L101 (W33's `step-219-boot.json`, `l100-seg-probe.mjs`, key ON) | **byte-identical to the base code's ON output** (md5 `033f3d15`, 369 B): *"break stance (breakablerock@128,144) -> kill (jellyfish@88,144) by press: the dwell was HIT at tick 193"* |

**Mutants** (predicted first; made by copying the file and restoring it):

| mutant | predicted | measured |
|---|---|---|
| MA: drop the "named by the ring" filter | leg 371 ON reds; L100 3/3 green | **as predicted**: `fidelityL100Fix` red (REFUSED, the bound), L100 3/3 |
| MB: the fine `stanceReaches` planned on 16 px | L100 row 2 (from the sliver) red; leg 371 green | **as predicted**: row 2 red, rows 1 and 3 green, leg 371 SOLVED |
| MC: the switch guard `if (true)` | L100 row 1 (OFF) red; leg 371 green | **rows 1 and 3 red** (row 3 compares against the OFF arm too, as W33's M2 measured); leg 371 SOLVED |

## D2 — flip readiness (key ON; the default NOT flipped) — PASS, list below

| gate | arm | result |
|---|---|---|
| bounded vitest (the same 96 default files, including the new one) | `SEEDLING_FINE_SWING_STANCE=1` | **2,298 / 2,299**. The ONE red is `contactFidelity.test.js` › *"contact witnesses … the shipped defaults: all three ON"*, the defaults pin a flip owes by construction |
| bounded slow (`fidelityL32ArenaPrefix`, `fidelityL40Bk2` slow) | env ON | rc 0 |
| tapeRunner pairs | env ON | **639**, `c2260ed7` (equal) |
| identity block + six chain `--check`s | env ON | **equal** to BEFORE, md5 `590b0b88`, six exit 0 |
| `ci-producer-checks.mjs --jobs=3` | env ON (inherited by every child) | **95 run, 0 red, 1 skipped, 0 known-red** (`producers-on.txt`). Skipped: `plan-seedling-r7-ends-meet` (browser); run below |
| `plan-seedling-r7-ends-meet --check` | default flipped locally, page on 9761 | **CHECK CLEAN**, rc 0 (`r7-ends-meet-on.log`) |
| standard probe battery | default flipped locally (uncommitted, restored), page on 9761 | **11 / 11 ALL CHECKS PASSED**, rc 0 each (`probe-battery-standard-on.txt`): logical-links B,R 25 · vanilla-map 23 · arrival-composites **95** · midroom-replan D 10 · restart-route W,J 18 · restart-warp W,J 28 · adopt 51 · obstacle-events W,J 22 · generated-playback 35 · loop-restart 30 · seal-delivery A 6 PASS rows, 0 FAIL |

At the defaults (AFTER): bounded vitest **2,299 / 2,299** (+1 = the new row); slow rc 0; identity block **`590b0b88`**,
six exit 0; tapeRunner pairs **`c2260ed7`**. **Byte-inert OFF.**

**What a flip owes** (when the user licenses it):
- `contactFidelity.test.js`: the defaults pin (`fineSwingStance: true`).
- `fidelityL100.test.js` row 1 and row 3's OFF half: they pass `withContactFidelity({ fineSwingStance: false })`
  explicitly, so they stay valid.
- The brief's L40 rows are already green ON.

## Movers — the survey/sweep rows this moves (key ON), and the dispatches

- **Route survey, full, local, both arms** (`survey-full-{off,on}.rows.txt`, 240 steps at this head, the same route in both
  arms): **201 SOLVED / 39 REFUSED in both**. OFF equals the brief's newest baseline (`40617953040`, 201/39). There is
  **ONE mover**, the same one W33 measured:

  | step | level | OFF | ON |
  |---|---|---|---|
  | 219 | L100 → L101 | REFUSED: *no REACHABLE stance for a swing at breakablerock@128,144 …* | REFUSED: *… break stance (breakablerock@128,144) -> kill (jellyfish@88,144) by press: the dwell was HIT at tick 193* |

  Leg 371 is not in the survey: its staging is `l40buttonStaging`, not the survey's.
- **Not measured here (cloud has no dispatch). The planner should run:**
  1. **Survey A/B** — `seedling-survey.yml` on branch `claude/seedling-fidelity-l100-fix-inlx5f`, `--through=end --route=full`.
     Run it once at the defaults, and once on a scratch commit that flips `fineSwingStance: true` (or `-f only=219` for the
     one mover). Expected: step 219's text only.
  2. **Keyed divergence sweep A/B, ×2** — `seedling-divergence-sweep.yml` on the branch, with
     `keys=` = `seedling-fidelity-l100fix-evidence/sweep-keys-swing-levels.pipe.txt`.
     - That is **169 legs** (11.1 KB) on the 14 levels that hold a swing target, re-derived at this base with
       `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` (912 legs). Both `break` and `pull` use
       `deriveSwingStance`, so the targets are `breakablerock` / `breakablerockghost` / `rope`, on levels 0, 3, 15, 16, 28,
       30, 39, 40, 41, 53, 73, 92, 100, 101.
     - Arms: `contact_fidelity=` the contents of `contact-fidelity-on-arm.txt` (the 97 default-ON keys plus
       `fineSwingStance`; the input turns every unlisted key OFF), against the defaults (empty). Add `capture_requests` on the
       ON arm.
     - Expected: the L100→L101 leg (match by KEY `level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 ->
       exit:out_teleporter_288_96`) moves its refusal text. Nothing else should move beyond the ~20-each-way `crossed`↔`done`
       noise. Repeat any other mover ×2 before believing it.
  3. **`seedling-probe.yml battery=standard`** on a scratch commit that flips the default. Expected: as measured locally
     below.

## The JS arc's pins and wiring

- No JS-arc file is touched.
- No `solveSegment` / `twoPassSolve` / `createRunForStaging` / `PendingDeclaration` contract changes.
- No new staging/result field and no new `SolverRefusal.obstacle.kind`.
- No `run.*` field is renamed or reshaped. The surface census moved two **site counts** only.
- Nothing to wire.

## Handed over

- **Nothing to the hammer arc from this slice.** The fix is inside `deriveSwingStance`'s fine arm and `stanceReaches`. No
  chooser, strike, escape, `planWaypoints` or digest edit, and no new run state.
- The L100 jellyfish dwell (t193 in the segment, t308 in the run per W33) stays **HAMMER's**, untouched.
- Unchanged from W33's queue: the waterfall push in the corridor planner, and a spear `break` arm.

## Deltas

- `solverBot.js`:
  - `stanceReaches` gains an optional `lattice` (null → unchanged opts).
  - `deriveSwingStance`'s fine arm filters ring-named cells and admits by `stanceReaches` on `FINE_LATTICE` (behind the key).
- New: `fidelityL100Fix.test.js` (1 row, ~11 s).
- `scripts/procgen/seedling-solver-surface.json` re-written: `run:state` 757 → 756, `run:world` 387 → 386 sites.
- `seedling-bot-log.md`: the L100FIX entry.
- Evidence: `seedling-fidelity-l100fix-evidence/`.
- No tape, expectation, roster, standing value, AS3, wasm, gitlink or rules change.

## What the brief got wrong (measured)

- *"~5 min per arm in node"*: **~7 s per arm** (`tools/leg371-arms.mjs`).
- *"Suspect: … skipping the contact + hypothesis test (`stanceReaches`)"*: this is not the mechanism.
  - `stanceReaches` on 16 px rejects the fine stance only because the **start** tile is unwalkable. Used as-is, it would also
    reject L100's sliver walk (MB measured that).
  - On 8 px it admits the regressing stance.
  - The mechanism is that the fine arm re-asked cells the ring had already named.
- *"The NEXT L100 blocker (jellyfish@88,144's dwell hit, t308)"*: the survey/segment refusal says **tick 193**
  (the segment clock). W33's log says t308 on the run clock. Both describe the same event.
- The ON refusal text: the brief quotes *"ladder-routed: no corridor … the walk's own obstacle ladder is what must open it"*.
  The full text, measured at this base, adds *"-> hold stance (wandlock@176,80) -> break stance (breakablerock@176,128):
  applied 4 strategies for one goal […]"*, the `MAX_STRATEGIES_PER_GOAL` bound.

## Residue

- At D1 (`108335c2`), push CI had **one** unfiltered-vitest red: `seedlingSolverSurface.test.js` › *"(i) every static row's
  files and site counts match"*. Re-measured locally against that commit's surface JSON: red, and 36 / 36 at the head
  (`9503728e` re-wrote it). JS Unit Tests did not trigger at `9503728e`, because its path filter does not match a lone
  `scripts/procgen/*.json` change.
  JS Unit Tests at the final head: see the last line of this report.
- `rosterCategories` / standing values: untouched (no tape added).

## Rows to BANK

- `fidelityL100Fix.test.js` (leg 371 ON, key for key).
- Identity `590b0b88` at `caa42ea5df` and at this head, in both arms.
- tapeRunner pairs `c2260ed7` (639).
- Constants 6,999, entities 566, profile 138, surface 360 rows.
- Survey full 201/39 in both arms, one mover (step 219).

## Head and CI

- **Commits:** `108335c2` (D1) → `9503728e` (surface) → `46e48c53` (log + evidence) → this report commit (head).
- **CI:** the only `JavaScript Unit Tests` run on this branch is at `108335c2`: 23,941 passed, 1 failed (the surface row
  above), slow battery 271 / 271. The later commits touch only `scripts/procgen/*.json` and docs, so they did not trigger it
  (`ci-vitest-summary.mjs 9503728e`: *"no JavaScript Unit Tests run"*).
- **Before harvest, the planner should re-read CI** once a code-path push triggers it. Expected: green, since the one red is
  fixed by `9503728e` (re-measured locally: `seedlingSolverSurface` 36 / 36).
