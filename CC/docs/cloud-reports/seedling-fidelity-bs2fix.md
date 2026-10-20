# seedling-fidelity-bs2fix — the bobsoldier2 INTERIM pin: retirement prepared, licence pending

Planner `seedling-fidelity-planning-9`, wave 20. **No model, solver, walker or `CONTACT_FIDELITY` change.**
⚖ The user (2026-10-19): bobsoldier2 *"Keep pin, queue fix"*; (2026-10-20): *"run it now"*.

| | |
|---|---|
| Start SHA | `934f99422b` (= main: R7 + L40GUARD flip + H1 wording + `rules-r4b-followup`) |
| Head | the commit carrying this report (code head `7297414e`) |
| Harness branch | `claude/seedling-bs2fix-interim-pin-dnukf2` (the brief's `seedling-fidelity-bs2fix` is the harness's branch here) |
| Box | 4 cores, Node 22.22.0, `SEEDLING_PORT=9703`; pristine base worktree `/home/user/wt-base`, licensed worktree `/home/user/wt-licence` |
| Commits | D1 `5daed8d5` · D2 `1f2ba5c6` · reference `f7f1183e` · D3 + bot log `1cad2ff1` · reference `7297414e` · this report |

**Verdicts: W0 PASS (one base red, not mine) · D1 PASS · D2 PASS (control chosen; restated rows prepared) ·
D3 STOP for the licence (one mover outside the region, with a proposed restatement).**

## The one thing to know first

With the lapse ON, step 50 **never reaches the kill arm's dwell, at any switch setting**. The collect runs first
(STRIKELAPSE D1's stand walk) with the body alive on 2 hits. The exit walk's gate decides: with `SWORD_GATE_TIMED` the
walk's own press kills the body (395 t). The ON torch plan **is the CI survey's own step-50 walk, key for key**, and the
game reproduces it on p4g.

So the retirement is small:
- **one tape moves**: `bobsoldier2-l30-torch`, 460 → 395 t;
- **the BEFORE becomes a named, permanent control**: `strikeIframeLapse` OFF, u10's shape. Its tape does not move;
- **one fixture row moves**: `hasTorch` 226 → 169;
- **one bounded row outside my region goes red**: `fidelityStrikeLapse`'s "OFF … byte for byte". A proposed patch is
  in the evidence.

Everything is in `seedling-fidelity-bs2fix-evidence/licence/`, ready to apply. The user licenses it.

## W0 (at `934f99422b`)

| row | command | result |
|---|---|---|
| tree | `git status`; `session_bootstrap.sh --seedling` | clean · `READY` |
| identity block | `SEEDLING_PORT=9703 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639` / `7d4cb820` / `49e23d85`, levels `e28c1e5d` / `fb1a59e5`, generated set OK. All equal L40GUARD's W0, except c4, which the L40GUARD flip moved on main (`b9d2185d → ebb9e743`, its own report) (`evidence/logs/w0-identity.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1`, exit 0 · **r9-campaign `c6fc1297` EXIT 1** (below) |
| reference | the block's row | "1 DIFFER": `instruments.js`, from MY producer's new `--out` flag (the row ran after that edit). Regenerated (`f7f1183e`, `7297414e`); `check-procgen-reference` ALL CHECKS PASSED at head |
| tapeRunner pairs | bounded vitest JSON, `(fullName, status)` sorted, `name\tstatus\n`, md5 | **635**, md5 **`a02def3b2b47710b8825a88cd62f6c4c`**, 0 non-pass (= at head, = licensed) |
| surface / constants / entities / profile | each `--check` | GREEN **321** · PASS **6,102** literals · PASS 566 · PASS 138 |
| roster | `fixtures/tapes/index.json` | **289** |
| bounded vitest BEFORE | 75 files (`evidence/logs/vitest-files.txt`): the brief's list, plus `fidelityApBosses` (the brief's `apReportBosses`), `tapeRunner`, `fidelityForkHygiene`, `deadFrameBand`, `argvHelp`, `seedlingConstantsCensus`, `seedlingSolverSurface`, and every `grep -a` hit for `plan-seedling-bobsoldier2` / `bobsoldier2-l30` / `pickup-removal-witness` / `BOBSOLDIER2_STEP50` (adds `hammerPressKillDoneOnWalk`). `fidelityL32ArenaPrefix.slow` under the slow config | **2,574 / 2,574**; slow **5 / 5** |

**The base red.** `solve-seedling-r9-campaign --check` FAILS at the pristine base worktree:
`r9-solve-32 trace is byte-identical … ⛔ DRIFT`, md5 `c6fc1297` in both trees (`evidence/logs/r9-campaign-check-at-base.log`).
L40GUARD's W0 had it green (`3d41b9fb`), so something between then and `934f99422b` moved r9-solve-32's trace sidecar
(R7's APFLIP / `rules-r4b-followup` touch L32's Bob Boss). Nothing of mine reaches it: `reach-seedling-change` names
two producers, this one and `hammer-dd-walkkill`. It is the planner's to route.

## D1 — the ON tapes on the game (PASS)

**Re-derived at the defaults** (the producer's new retired arm, `SEEDLING_BS2_LAPSE_RETIRED=1 … --out=<scratch>`):
- `bobsoldier2-l30-torch`: 460 → **395 t**. Its inputs equal the wave-19 interims' ON tape and the CI survey's step-50
  walk view (run 39496129402, `views/step-50-walk.json`), key for key.
- The both-OFF arm at the defaults (the interims' "dash-stance ON", evidence only): **168 t**, refused at the exit gate.

**On the game** (`check-seedling-bot-differential --record --only=<name>`, p4g = the DEFAULT build, headless, :9703):

| tape | obs | the model | vs the interims' p4f recording |
|---|---|---|---|
| `bobsoldier2-l30-torch` (ON, 395 t) | 396, 1 transition | "⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE" | **identical content** |
| both-OFF at the defaults (168 t, evidence only) | 169 | reproduces | **identical content** |
| committed `-dash-stance` + `-torch` (no record, the oracle check) | 146 / 461 | ALL CHECKS PASSED | — |

**p4g does not differ from p4f** for any of these.

**The torch tape's `hasTorch` tick.** `probe-seedling-encounter-ticks.mjs --tape=bobsoldier2-l30-torch` on p4g: the
game's flag flips at **obs 169** (168 sampled, false). Drained stream: 396 obs, worst |Δ| 0. The model with
`PICKUP_REMOVED_NEXT_FRAME` OFF lands it at 168, ON at 169, and the x/y stream is identical either way. That is exactly
the shape `fidelityEncounters2` asserts.

The prepared row is in `evidence/pickup-removal-witness.row.json`:
`{gameObs 169, sampled [168,169], page seedling_bot_ap_p4g, streamWorst 0, observations 396}`.
⚠ The probe's calibration reads `fits: []` because of one sample, t168: the first page answer of tick 168 is the
ceremony's last frozen frame (the game shows t167's position). Every other sampled tick fits shift 0, and the drained
stream (dead-frame aware) matches everywhere. The old tape had the same straddle at t225 (BOBSOLDIER2's trap candidate 3).

**Body probe** (`probe-seedling-bobsoldier-mobiles --tape=bobsoldier2-l30-torch`, ON tape placed temporarily):
- 182 comparisons; 181 exact.
- The one off is the same t168 straddle: game body (74.369,74.265) = the model's t167 body.
- The body dies at t171 on both.

The ON tapes' replay does not read the switch. The player stream and the body (x, y, hits, hitsTimer, destroy) hash
the same with `strikeIframeLapse` OFF and ON, for all four tapes (`scripts/bs2-replay-indep.mjs`).

## D2 — what the BEFORE means with the lapse ON (PASS: a named control)

**Measured: step 50 at the defaults, switch by switch** (`scripts/bs2-measure.mjs`, `bs2-trace.mjs`):

| switches | lapse OFF (the pin) | lapse ON (the defaults) |
|---|---|---|
| both ON | SOLVED 460: dwell kill from (88,56), 22/53 | **SOLVED 395**: collect, then `killedOnWalk` (pressed t169) towards (72,88), dwell 0 |
| both OFF | REFUSED: the dwell (145 t driven) | **REFUSED 168 t**: reach-exit gate at (72.65,66.46), pad 16 against the LIVE body (h2, d=7.1) |
| D2a alone | REFUSED: pad 16 against the corpse at (87.86,58.05) | REFUSED 168 t: same as both OFF |
| D2b alone | REFUSED: the dwell | **SOLVED 404**: the same kill on the walk |

**The choice: a control, not a new ON witness.** The dwell refusal the BEFORE witnesses is unreachable with the lapse
ON at every switch setting, so there is no ON witness of it to record. It is the pre-lapse executor/forecast mismatch:
the only game evidence for `KILL_STANCE_AS_FORECAST`'s defect. The tape is game-recorded keys whose replay is
switch-independent (D1). So the producer keeps the BEFORE under `CONTROL_FIDELITY = { strikeIframeLapse: false }`,
named and permanent (u10's `REFUSED_CONTROL_FIDELITY` shape). Its tape stays **byte-identical**, with no move and no
re-record.

**SWORD_GATE_TIMED's ON witness is the gate at t168 on the ON tape** (`scripts/bs2-gate.mjs`):
- The player is at (72.65,66.46), the exit walk's first gate after the torch ceremony.
- The body is LIVE at (74.59,73.76), h2, hitsTimer 0.
- The pad forbids ("pad 16"); the timed tick is clear; horizon +5 (the WAIT question) is danger.

Under the pin the same row was asked of a corpse at t167. That is the restated D2b row.

**Change (in tree, `1f2ba5c6`):**
- `fidelityBobSoldier2`: a new describe, *"BS2FIX — step 50 at the defaults"*, with four rows at the defaults: both ON
  395 with `killedOnWalk` t169; D2b alone 404; both OFF and D2a alone refused at 168 by the pad against the live body,
  never the dwell.
- These rows read no tape, so they hold before and after the licence.
- The comment at `:86-89` no longer claims "ON step 50 REFUSES at every switch setting". That was FLIP14's measurement,
  false since STRIKELAPSE D1 and hammer DD.

**Mutants** (predicted, made by copy → edit → restore; producer restored to md5 `5585e840`):

| mutant | predicted red | measured |
|---|---|---|
| M1 `bobsoldier2Plan` ignores the `swordGate` override | D2a-alone ON, D2a-alone lapse-OFF | exactly those 2 (11 green) |
| M2 `killStance` forced false | both-ON ON (404 ≠ 395), both-ON lapse-OFF (the torch witness), D2a lapse-OFF (dwell, not pad) | exactly those 3 (10 green) |

**The producer, behind the pin (`5daed8d5`).**
- `LAPSE_PIN_RETIRED` (env `SEEDLING_BS2_LAPSE_RETIRED=1`, OFF by default) runs:
  - the AFTER at the defaults, with its kill row restated: the collect first, then the chaser arm `killedOnWalk`
    towards (72,88), dwell 0;
  - the BEFORE under `CONTROL_FIDELITY`.
- `--out=<dir>` writes or compares the tapes elsewhere.
- OFF, the pinned producer is **byte-identical**: the `--check` log md5 is `2e94b9ef` at the base and at head.
- Retired, `--check` is green against the ON tapes.

## D3 — the movers, and the licence (STOP: the user licenses)

**The licence kit** is `evidence/licence/licence-bs2fix.patch`, which applies at head. It holds:
- the producer default flipped to retired (`<date>` placeholder for the licence's date);
- `fixtures/tapes/bobsoldier2-l30-torch.json` and its expectation (the p4g recording);
- the `pickup-removal-witness.json` row (226 → 169, p4g, 396 obs);
- `r8Acceptance.js`'s row (ticks 460 → 395, the why restated);
- `pickupRemoval.js`'s comment (obs 226 → 169);
- `tapes/index.json` regenerated;
- `fidelityBobSoldier2` restated:
  - D1 torch `killedAt` 167 → 171;
  - the lapse-OFF "both ON" row becomes a control row (460 t, the (88,56) dwell) with no tape compare;
  - the ON row asserts the plan IS the committed tape, key for key;
  - the D2b gate rows move to t168, the live body (h2, not destroyed).

**Licensed, measured in `/home/user/wt-licence`:**

| gate | result |
|---|---|
| producer `--check` (retired by default) | all checks green; both tapes byte-identical |
| importers' `--check` (`c1-static-sword`, `hammer-dd-walkkill`, `l30keylock`) | green; output md5 equal to the base (`9d7c1950`, `bee0869b`, `5873a210`) |
| surface / constants / entities / profile / tape index | 321 / 6,102 / 566 / 138 / 289: unmoved |
| tapeRunner pairs | 635, md5 `a02def3b`: unmoved |
| bounded vitest (75 files) + slow | **2,577 / 2,578** + 5/5. ONE red (below) |

**Every mover, by name:**
- **tape:** `bobsoldier2-l30-torch` 460 → 395 (tape md5 `556c004f` → `36d8ef89`; expectation → `489e2fcb`).
- **fixture:** `pickup-removal-witness.json`, the `bobsoldier2-l30-torch` row.
- **roster records:** `r8Acceptance.js` (ticks 460 → 395, descriptive); `tapes/index.json`.
- **in-region test rows:** `fidelityBobSoldier2`: D1 torch, D2 "both ON", the two D2b rows. `fidelityEncounters2`:
  no code change; it reads the fixture.
- **⛔ outside my region:** `fidelityStrikeLapse` › *"OFF: the plan is the witness `bobsoldier2-l30-torch` (460 t), byte
  for byte"*. It compares the lapse-OFF plan to the committed tape, so it goes red when the tape moves.
  `evidence/licence/licence-strikelapse-row.patch` proposes this restatement:
  - the plan stays 460 t;
  - its keys hash to `a1022d66cec65d411527f5620fe2a7ad`, the retired tape's key digest (`scripts/bs2-keydigest.mjs`);
  - green measured. STRIKELAPSE's owner (the planner) decides.
- **Not moved** (measured): `dead-frame-observations.json`'s torch row (190 dead = 150 + 40, 2 loads, same on the ON
  recording); `fidelityStrikeLapse` / `fidelityCeremonyShove`'s staging rows (the ON tape's staging is field-identical);
  the roster pins (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`): green licensed.

## Survey / sweep rows this moves

**None, before or after the licence.** No model, solver, walker or switch default changes. `SEEDLING_BS2_LAPSE_RETIRED`
is a producer-only switch, and the survey and the sweep do not import the producer (`grep -a`). The CI survey at the base
already reads step 50 **SOLVED 395**, which is this slice's ON tape.

**Dispatches for the planner: none owed.** Optional, after applying the licence: `seedling-probe.yml` `battery=standard`
on the licensed branch, to re-witness the moved tape in CI's own browser.

## The JS arc / the hammer arc

- **JS arc:** no pins move and nothing needs wiring. No `run.*` field, staging field or contract changed.
- **Hammer arc:** nothing handed over. `plan-seedling-hammer-dd-walkkill` imports `bobsoldier2Staging` (unchanged).
  Its `--check` output is byte-identical licensed.

## What the brief got wrong (measured)

1. **"Re-record both tapes."** Only the torch tape needs to move. The BEFORE's replay does not read the switch, and the
   control keeps it byte-identical.
2. **The base is not fully green.** `r9-campaign --check` exits 1 at `934f99422b` (r9-solve-32's trace).
3. **The mover set is wider than the region.** `fidelityStrikeLapse`'s byte-for-byte row also reads the torch tape.
   `r8Acceptance.js` and a `pickupRemoval.js` comment carry its numbers.
4. **The quoted line numbers are right** (`contactFidelity.js:328`, the producer `:111` / `:208`, the test
   `:91,98,105,110` and `:86-89`). But the comment at `:86-89` was itself stale.

## Residue / trap candidates

- **Trap candidate:** a test comment that quotes a measurement under a switch decays when another slice repairs the
  path. FLIP14's "ON refuses at every setting" stood for two waves after STRIKELAPSE D1 and hammer DD made it false.
- **Trap candidate (repeat):** the encounter-ticks and body probes calibrate on the FIRST page answer of each tick. A
  tick whose first answer is a ceremony's last frozen frame breaks `fits`, while the drained stream is exact (t168 here,
  t225 on the old tape).
- `SEEDLING_BS2_LAPSE_RETIRED` and `--out=` stay after the licence: the env becomes the opt-out (`=0`).

## Byte-inertia

- The pinned producer's `--check` is byte-identical (log md5 `2e94b9ef`).
- No module file changed. The identity block, censuses and tapeRunner pairs are unmoved.
- The reference was regenerated twice for my own edits (`instruments.js` flags and citation, the docs index word count).

## Rows to BANK

- `fidelityBobSoldier2`: 13 rows at head (the base's 9 + the 4 BS2FIX ON rows).
- bounded vitest: BEFORE 2,574 / HEAD 2,578 / licensed 2,577 + 1 red (named above), slow 5/5.
- tapeRunner pairs 635 `a02def3b`.
- The licence: one tape (torch 395 t, p4g, 396 obs), one fixture row (`hasTorch` 169), one out-of-region row (patch
  proposed).
- `r9-campaign --check` red at the base: `c6fc1297`.

**CI** (`JavaScript Unit Tests`, run 39509014193, at code head `7297414e`): **21,429 / 21,429** passed (3 shards),
slow battery **259 / 259**. The report commits after it touch only `CC/docs/` and do not trigger the workflow.
