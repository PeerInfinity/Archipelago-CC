# Seedling hammer-phase PKC — the press kill prices the chasers beside its walks (`PRESS_KILL_CHASERS`, OFF)

| | |
|---|---|
| Session | `seedling-hammer-press-kill-chasers` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `1e17f447` (= `origin/main` at launch; wave 31 is in it) |
| Head | code and docs `da0f05ff` (JSUT green); this report and its evidence are the one commit after it (this report is the last commit) |
| Branch | `claude/seedling-press-kill-chasers-o4immq` — the harness's designated branch. The brief named `seedling-hammer-press-kill-chasers`, but the session may push only to its designated branch. Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-press-kill-chasers-evidence/` |
| Verdicts | **W0 PASS** · **M1: the step** (`safeStep`) · **M2: treatment C** (a chaser-clear preference in `safeStep`) · **I PASS** behind `PRESS_KILL_CHASERS` (OFF) · **D** PASS: JSUT run 40276821052 green, slow battery 269/269 |

## 2. The answer first

**Where the chaser went unpriced.** It was the press kill's per-tick step, `execKillByPressOnce` → `safeStep` →
`landsClearOfHammers`. That step asks only the spinners' rects and hammers, one tick on. The strike walk it executes was
derived at t604 by `deriveStrike`: the cell (744,776), pressed at +733. Its walk preview **does** price the chasers:
`walkTo` → `dangerDuringTransit` with the samples' own `chasers`, transit mode, horizon 0, per tick. It passed
`bob@736,752` **2.9 px** clear at +54 (`evidence/m1-preview-gap-t604.txt`).

The executor does not walk the preview. `stepToward` dodges the spinners and `safeStep` overrides, so the live walk ran
**1.4 px ahead** of the preview (keys `right` / `left,down` where the preview held `down`). A chaser is player-coupled,
and the bob's contact landed at t660 (`evidence/m1-live-vs-preview-t604.txt`). The strike's dwell, 637 ticks standing
beside the same bob, is priced against hammers only (`dwellUnsafeAt`). It took t749 and t780, and
`PRESS_KILL_REBOOT_GUARD` refused the death.

The walks outside the press kill that do price chasers (`walkToUnder`'s gate, `probeCorridor`) certify the walk they
then drive. The press kill certified one walk (the preview) and drove another (`stepToward` + `safeStep`). Nothing
priced the chaser per tick on the driven walk.

**The treatment (C, "a better third").** ON, `safeStep` considers the key sets OFF accepts, in OFF's order, and takes the
first whose next step also lands clear of every chaser (`solverBot.landsClearOfChasers`). The test steps the run's chaser
forecast once against the player as the tick starts, then once against the stepped player. That is `previewWalk`'s
pairing: the game's `chaserContactNow` tests the post-move body against the box this step leaves. The verdict comes from
`chaserDanger`'s per-tick arm, the transit question with the contact gate, sword lines and punch.

Three guards keep it narrow:
- when no hammer-clear set is also chaser-clear, OFF's choice is taken (`unavoidable`), so ON never refuses where OFF
  steps;
- a press is never swapped;
- a shake-band forecast is left to OFF (`banded`).

**Measured effect (ON vs OFF):**

| workload | OFF | ON |
|---|---|---|
| step 67, node, `solveSegment` from the boot (Boss Key 2) | REFUSED: the press kill's death t780 (`bob@736,752`, hits 660/749/780) | REFUSED at tick 1738, **one link later**: chest stance, `bobsoldier@880,832`'s sword (combat ladder exhausted); 0 hits |
| step 67, the survey's child (`survey-seedling-route --through=end --only=67`) | REFUSED (unclassified): the press kill's death t780 | REFUSED (LADDER): chest stance, `bobsoldier@880,832` |
| leg 860, one hammer period (45 seams, its captured request 1, a fresh process per seam) | **29 press-kill deaths** to `bob@736,752`; 7 "every key set lands"; 9 burn-stance refusals | **0 deaths**; 37 burn-stance refusals (23 `bob@736,752`, 13 `bobsoldier@880,832`, 1 `bob@736,800`); 8 "every key set lands" |
| leg 859, same census | 0 deaths: 42 burn-stance refusals, 3 "every key set lands" | 0 deaths: the same 42 / 3; 3 seams re-name the burn stance's chaser |
| L40 radius: all 52 L40 legs' 60 captured requests, each replayed at its own seam | — | **59 identical**; the mover 860/1 goes from death to the burn-stance refusal |
| L18 sweep (45 residues) | 45/45 SOLVE | 45/45 SOLVE, byte-identical rows (wall times aside) |
| bounded set (31 files) | 442/442 + the new file's 2 | **8 rows move**, all L40 rows that pin the chest press kill's death (§5) |

**Is the switch ready to flip?** **Ready in behaviour, not yet in rows.** On every workload measured it removes the press kill's chaser deaths and adds none. No solve becomes a refusal, and OFF is untouched. A flip still needs:
- the planner's whole-route A/B (sweep and survey; cloud sessions cannot dispatch it);
- four L40 rows re-pinned to their ON answers: `fidelityL40Bk2` D1 ON, `fidelityL40Res` D2 ON, `hammerPressKillGuards` HO2 OFF/ON (§5). GF did the same at its flip.

The two game-witnessed rows (G1, SF) are already pinned OFF.

## 3. W0 — the base, the baselines, the reproductions

| row | result |
|---|---|
| base | `git fetch origin main`; the designated branch already sat at `origin/main` = `1e17f447` ("W31 x hammer bxff …"). Wave 31: `CONTACT_FIDELITY_DEFAULTS.weighHypothesisChain` and `.dashSpinnerForecast` are `true`; L40BK2's report, evidence and `fixtures/l40bk2-witness/step67-boot.json` are present |
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, node v22.22.0; six non-wasm submodules initialised by hand; `requirements-headless.txt` installed (the venv had Playwright 1.56 against the 1.63 pin, so the identity block's generated row asked for it) |
| identity block (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; reference ALL MATCH |
| the six producer `--check`s | tail `35456fbc` exit 0, r9-l3 `6cd35fe1` exit 0; **four red at the base**: battery `da331da7`, d2-chain `8be1a293`, l18 `b8d8452a`, r9-campaign `e69370f6`, each a committed-trace DRIFT (`evidence/checks-red-at-base.txt`). Re-run solo: the same bytes and exit 1. Not this slice's: they are the base's |
| `ci-producer-checks --jobs=4` | **93 run, 0 red**, 1 skipped (`evidence/producer-w0.txt`) |
| bounded vitest (`evidence/bounded.txt`: every test naming `execKillByPress`, `deriveStrike`, `deriveRefuge`, `refugeNow`, `pressKillCost`, `pressKillGuards` or `noStrikeMove`, plus every L40 and hammer test file; no file names `noStrikeMove` alone) | **30 files, 442 / 442** (`evidence/rows-before.txt`) |

**Reproductions:**
- **Node, step 67** (`tools/solve67.mjs`, L40BK2's harness, the fixture): REFUSED in 30 s at *"kill (spinner@880,848) by
  press: the player died at t780 (chaser bob@736,752) … PRESS_KILL_REBOOT_GUARD"*. Hits 660 / 749 / 780, all
  `bob@736,752`. The kill starts on tick 0, so the whole 780-tick refusal is the press kill.
- **Survey step 67**: the same death at **t780** in the survey's child. L40BK2's "t766" was its page/two-pass solve.
- **Legs 859/860.** Captured through the divergence sweep (`--mode=inv --producer=solver --capture-requests`, the 52 L40
  legs, a clean base worktree served on 9741). The ids hold at this base. At the captured seams:
  - **860** (seam 5437) dies in the press kill at **t799** (`bob@736,752`, two landings);
  - **859** (seam 5933) refuses earlier, at the burn stance under `bobsoldier@880,832`'s sword.
  - The capture (60 requests, 5.2 MB gzipped) is not committed; the planner's own capture replaces it.
- **Seam census, one hammer period** (the replay's `--seam-time-sweep=0..44`, a fresh process per seam): the table in
  §2. These phases die to a chaser OFF:
  - **860**: 29 of 45, every one `bob@736,752` (`evidence/census-860.txt`);
  - **859**: none (`evidence/census-859.txt`).

## 4. M1 and M2

### M1 — at the first hit (t660)

| question | answer |
|---|---|
| the sub-step that chose the move | the **strike walk**: `strike` = (744,776) pressAt t1337, from `deriveStrike` on t604 (not an approach certificate; `tools/trace67.mjs` hooks the executor's branch per tick, `evidence/m1-trace-step67-off.txt`). Each tick: `chooseHeld` → `stepToward` (spinners only, survival depth 4) → `safeStep` (spinners only, one tick) |
| the danger query that walk's choice asked | at derivation: `walkTo` → `dangerDuringTransit(run, sm.tick, box, sm.arrows, sm.chasers, …)`, **transit** mode, horizon 0, the walk's own forecast bodies (`chasers` passed, not null); the bob **was in it** and passed 2.9 px clear at +54. Per tick while driving: `landsClearOfHammers` — `run.spinnerForecast(2)[1]` only; **no chaser query at all** |
| the dwell | `dwellUnsafeAt`: hammers only (`clearOfHammersAt`), +94 → +731; `strikeStandBlast` prices bombs only |
| why the preview missed the contact | the driven walk left the preview (`stepToward`'s spinner dodge at +4…+6 and after) and ran 1.4 px ahead; the bob closed on the driven player, not the previewed one (`evidence/m1-live-vs-preview-t604.txt`: live +54 (743.8,740.1) against the preview's (744.0,738.7); the bob's contact and recoil at +56 live) |
| the walks that DO price chasers | `walkToUnder`'s gate and `probeCorridor` price the walk they then drive, sample by sample; the press kill prices a preview and drives another walk |

### M2 — the treatments (scratch patch by env, `tools/m2-scratch-treatments.patch`; step 67 in node, `evidence/m2-step67-arms.txt`)

| arm | what it prices | step 67 | hits | ms | cost of note |
|---|---|---|---|---|---|
| OFF | — | press-kill death t780 | 660/749/780 | 42 k | — |
| (A) stand | `deriveStrike`'s stand (walk + stand to the train end) against the chaser forecast, both passes | the kill completes; REFUSED at the chest stance | **972, 1116** (bob@736,752) | **237 k** | refused 20,940 of 20,947 candidates: a chaser closes on any player who stands |
| (A′) refuge | `deriveRefuge`'s walk and wait against the chasers | **unchanged** (death t780) | 660/749/780 | 42 k | 0 refuges refused |
| **(C) step** | `safeStep`: a hammer-clear key set that is also chaser-clear one tick on | the kill completes; REFUSED at the chest stance (tick 1738) | **none** | **49 k** | — |
| A + A′ + C | all three | as C (tick 1567) | none | 274 k | — |

(B), refusing the candidate by name when a chaser is in reach and unpriceable, was not built. Every chaser here *is*
priceable (the forecast answers exactly), so B has nothing to refuse on this workload. C's own `unavoidable` is the
place where a chaser is in reach and cannot be avoided, and it keeps OFF's step rather than refusing.

**Recommendation: C.** It is the only arm that removes every hit, it costs +17% at step 67 against +460% for A, and it
asks nothing of the forecast's structure: it is the transit question, asked once per tick of the walk actually driven.
The L40 radius, the 859/860 censuses and the L18 sweep (§2) were run for C, the recommended arm. A was rejected on step
67 alone: still hit, 5.6× the time.

⛔ Boundaries: C lives in `solverBot.js` (`safeStep`, the new `landsClearOfChasers`) and `pressKillCost.js` (the switch).
`levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js` and `flashPanel/*` are untouched: it reads
`run.chaserForecast()` and `chaserDanger` as they stand.

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch.** `pressKillCost.PRESS_KILL_CHASERS` (`enabled: SEEDLING_PRESS_KILL_CHASERS === '1'`),
  `PRESS_KILL_CHASERS_DEFAULT = false`, `withPressKillChasers(enabled, fn)`, and the instrument
  `PRESS_KILL_CHASERS_COUNTS {asked, swapped, unavoidable, banded}`.
  - It is re-exported through `solverView.js` (the door), and its docblock carries ⛓ fidelity L40BK2 D3.
  - **OFF is byte-identical by construction**: the only new read is `PRESS_KILL_CHASERS.enabled`, first in its `if`, so
    OFF builds no forecast and calls nothing new. It is measured too (§6).
- **Rows** (`hammerPressKillChasers.test.js`). The fixture is the existing 1.9 KB `step67-boot.json`, so no cut was
  needed. Goal: the chest (880,816), whose stance needs the press kill from tick 0; both arms are capped at t800.
  1. **ships OFF.**
  2. **OFF dies / ON avoids, and ON with no chaser in reach = OFF.**
     - OFF: `SolverRefusal` *"… by press: the player died at t780 (chaser bob@736,752) … PRESS_KILL_REBOOT_GUARD"*, hits
       660/749/780, counts all 0.
     - ON: reaches the cap with **no hit**, `swapped > 0`.
     - ON's keys equal OFF's through **t657**, with the forecast asked on every tick and nothing swapped; t658 is the
       first step ON takes differently.
  - 2 / 2 in 62 s.
- **Mutants** (copy, edit, run, restore; `evidence/mutants.py`, `mutants.txt`). All three red:
  - M1: the ON block removed;
  - M2: the landing test always clear;
  - M3: one forecast step instead of two (the wrong pairing). This one is red too, because the death returns.
- **Two witnesses pinned OFF (GF's precedent).** `plan-seedling-hammer-g1-ghostkill` and `-sf-strikefloor` were the
  only producer reds with the switch ON, and their rows were 4 of the 8 bounded-set movers. Both are game-witnessed press
  kills *across* `bob@736,752`'s death; ON, the death does not happen and the solve leaves the witness. Their producers'
  solves (`scripts/procgen/plan-seedling-hammer-{g1-ghostkill,sf-strikefloor}.mjs`) and the matching rows in
  `hammerGhostKillRung.test.js` / `hammerStrikeEtaFloor.test.js` now run under `withPressKillChasers(false, …)`, with a
  docblock note. This is a harness pin, not a behaviour change: the switch ships OFF, and both `--check`s are green OFF
  and ON. Strictly, `scripts/procgen` producers sit outside the brief's in-scope list. I treated them as the witnesses'
  fixtures, as GF did.
- **ON radius, by mover class:**

| workload | movers ON | class |
|---|---|---|
| step 67 (node, survey) | 1 | **death → next link** (chest stance, `bobsoldier@880,832`) |
| L40, 60 requests | 1 (860/1) | **death → later refusal** (the burn stance's walk, `bob@736,752`) |
| 860 census | 29 of 45 phases leave the death; 1 of them (5444) becomes `safeStep`'s existing "every key set lands" spinner refusal | death → later refusal / death → spinner refusal |
| 859 census | 3 of 45 re-name the burn stance's chaser | refusal → refusal (same stage) |
| L18 sweep | 0 | — |
| bounded set ON (`evidence/rows-on-before-pin.txt`; after G1/SF were pinned, 4 rows in 3 files: `rows-on-after-pin.txt`) | **8 rows, 5 files** | every one pins the chest press kill's death or the kill across it: `fidelityL40Bk2` D1 ON and `fidelityL40Res` D2 ON (the chain now ends at the chest stance's `bobsoldier@880,832`, not the death); `hammerGhostKillRung` ×2 and `hammerStrikeEtaFloor` ×2 (game-witnessed kills ACROSS the death: ON the executed prefix leaves the witness, 1289 / 1313 ticks against 2195 / 1629, refused later on `bob@736,752` / `bobsoldier@880,832`); `hammerPressKillGuards` HO2 OFF/ON (the death at t788 does not happen, so the cap at t1300 is met) |
| producer roster ON | **93 run, 0 red** (after pinning G1/SF OFF; before the pin those two were the only reds) | |
| identity block ON | **equal** to OFF, row for row (`evidence/identity-on.txt`) | |

No mover turns a solve into a refusal, and no mover adds a death.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path, OFF at the head (⚖ 52) | **31 files, 444 / 444** (442 + the new file's 2; `evidence/rows-after.txt`) |
| the new file | 2 / 2 |
| both hammer `.slow` files PKB ran (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`) | **2 / 2** (`vitest.slow.config.js`, locally) |
| `ci-producer-checks --jobs=4`, defaults | **93 run, 0 red** |
| `ci-producer-checks --jobs=4`, `SEEDLING_PRESS_KILL_CHASERS=1` | **93 run, 0 red** (after pinning G1/SF OFF; before the pin those two were the only reds) |
| identity block at the head (OFF) vs W0 | **every row equal**. Two lines differ for reasons outside the solver: the generated set now reads `OK` (W0's venv had Playwright 1.56), and the reference read DIFFER mid-slice before it was regenerated (`evidence/identity-after.txt`) |
| `census-seedling-solver-surface --check` | GREEN **355** after `--write`: two new rows classified (`PRESS_KILL_CHASERS`, `_COUNTS`), four counts moved (`chaserForecast` 3 → 5 sites in `solverBot.js`, …) |
| `census-seedling-constants --check` | PASS after `--write`: the switch's five counter zeros, classified structural. JSUT 40274162546 caught them first, as `seedlingConstantsCensus`'s mutant (b) drift |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`procgenDocs/generated/docsIndex.js`, `procgen/README.md`'s region); ALL 7 MODULES + 5 REGIONS MATCH |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless | **ALL PASS** (415 PASS rows, the r9-campaign included; `evidence/wasm-ship.txt`) |
| docs | `seedling-bot.md` (the switch, OFF, a paragraph after BX's); `seedling-bot-log.md` (`### Seedling hammer-phase PKC — …`) |
| JSUT | run **40274162546** at `c6e522ff`: suite 23,051/23,052, **slow battery 269/269**. The one red was `seedlingConstantsCensus` mutant (b), because the constants census did not yet hold the five counter zeros; fixed in `da0f05ff`. Then run **40276821052** at `da0f05ff`: **suite 23,052 passed / 0 failed / 0 skipped; slow battery 269 / 269** |

## 7. What the planner's harvest A/B should expect

With the switch **OFF**: **no movers**. OFF reads one boolean, and the identity block, the producer roster and the
bounded set are equal to W0.

With it ON, the movers are the L40 press kill's chaser deaths:
- the chest / Boss Key 2 chain: steps 67 and 93, leg 860 (859 only re-names a chaser); step 93 is expected but was not measured here;
- the 8 L40 rows of §5.

Each mover goes from a death to the next link's refusal.

## 8. What the brief got wrong (measured)

- **"Legs 859/860 … fail at that apitem two-pass" (via the press kill).**
  - **860** does at its captured seam (t799) and on 29 of 45 phases.
  - **859** never dies there, at its seam or on any of 45 phases. It refuses earlier, on the burn stance's chasers.
- **Step 67's death is t780, not t766**, in node and in the survey's child alike. t766 was L40BK2's page solve.
- **"The open question is whether chasers are priced at all on its walks and waits."** They are, on the strike's walk
  preview (`deriveStrike`'s `walkTo` asks `dangerDuringTransit` with the walk's own forecast bodies).
  - What is not priced is the walk the kill **drives**: `stepToward` + `safeStep`, which leave the preview.
  - The dwell and refuge waits are not priced against chasers either. Pricing them is not the fix: the stand arm
    over-refuses, and the refuge arm moves nothing.
- **"The bounded set … every test naming `noStrikeMove`"**: no test names it outside files already in the set.
- **The six identity `--check`s**: four are red at the base (committed-trace drift). The brief's battery assumes green.

## 9. Residue and hand-overs

- **To the planner:** the next blocker on the Boss Key 2 chain is now the one L40BK2 predicted, `bobsoldier@880,832`.
  - On step 67 it is the chest stance's corridor (its sword).
  - On 859/860 it is the burn stance's walk: `bob@736,752` / `bobsoldier@880,832` / `bob@736,800`.
- **`unavoidable`**: where no hammer-clear key set is chaser-clear, ON keeps OFF's step and the contact may land. It was
  not seen to decide a verdict on these workloads (no ON death anywhere). A refusal by name there (brief's B) would be
  the next increment if a workload shows it.
- **"Every key set lands" (`safeStep`'s spinner refusal)** is 7 → 8 phases on 860. Seam 5444 moved there from the death:
  the kill now survives the bob and then meets the spinners' corner. That is the spinner side, not this switch's.
- The dwell is still priced against hammers only. ON, the executor's step keeps the player off the chaser while the
  dwell stands, which is why the stand pricing is not needed.
- The capture of the 52 L40 legs was not committed (5.2 MB). The planner's sweep recaptures.
- **Step 93** (`stanceReentryNextDoor`) was not run here; it reaches the same kill (L40RES), so it should move with step 67.
- **The planner's dispatches** (403 from the cloud): the probe battery, TT, and the sweep / survey A/B with `SEEDLING_PRESS_KILL_CHASERS=1` in the node half. The page's worker has no `process`, so the switch is OFF there whatever the env.
