# Seedling HAMMER-PHASE — slice LD: the Lights fight's shots and fliers in the danger map

Slice `seedling-hammer-lights-danger` (Opus, cloud). The planner is `seedling-hammer-phase-planning-2`. ⚖ The user
approved the slice on 2026-10-21 ("Yes, please launch the slice"). Switch: `CONTACT_FIDELITY.lightsBossFight`, still
OFF. No switch moved.

**Verdict: the victim takes 0 hits; nothing moved IN the digest; no fixture moved.**
- Survey step 159 with `lightsBossFight` ON: **823 t / 1 hit → 826 t / 0 hits**.
- `dangerMap.lightsDanger` prices the fight's shots and fliers by stepping a copy with `lightBoss.js`'s own functions.

⚠ **The one thing to know first: LIGHTSARR is merged into this branch.** Fidelity LIGHTSARR
(`origin/claude/lightsarr-lights-arrival-zpv7ou`, `c33e95b7`) is not on main, and the victim exists only with its
shield fix. At main ON, step 159 is 559 t with 0 hits. So this branch merges LIGHTSARR (`21d539b8`, a merge commit; no
rewrite), and the two land together or LIGHTSARR lands first. The pricing itself does not depend on the shield.

## 1. SHAs

| | |
|---|---|
| Start SHA | **`2408fc5a6e`** (`origin/main` at the fetch) |
| Base the work is on | **`21d539b8`** = main `2408fc5a6e` + LIGHTSARR `c33e95b7` (merge; the conflicts were generated files plus the bot log, see §2) |
| Head | the commit carrying this report. Before it: D1 `9596e66c`, D2 `d7731f63`, D3 `6dbdfa1a`, the D3 fix `7fa44ca3` (the last head with code) |
| Branch | `claude/seedling-hammer-lights-danger-fvp3ii` (the harness's; the brief said `seedling-hammer-lights-danger`). Nothing went to `main`; nothing was force-pushed |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-lights-danger-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `mutants/`, `tools/`) |

## 2. W0 — the base and the victim

**The harness.** The CI run the brief cites (39663950831) ran `seedling-survey.yml` on the scratch branch
`fid9-on/lightsarr` (head `5b51ab93`, "lightsBossFight default true — survey A/B only, never merge"). Locally the same
switch is `SEEDLING_LIGHTS_BOSS_FIGHT=1` (`contactFidelity.js:972`), with
`survey-seedling-route.mjs --through=end --route=full --only=158,159,160`.

| tree | step 158 L70 | **step 159 L69** | step 160 L36 |
|---|---|---|---|
| main `2408fc5a6e`, ON | SOLVED 105 t | SOLVED **559 t, 0 hits** | SOLVED 50 t |
| merge `21d539b8` (+ LIGHTSARR), ON | SOLVED 105 t | SOLVED **823 t, 1 hit**, 2 decisions | SOLVED 50 t |

**The victim, replayed on the model** (the survey's own walk tape, `evidence/tools/victim.mjs`; the tape is
`evidence/w0/step-159-walk-before.json`, also committed as `fixtures/hammer-ld-lights/step159-walk.json`):
- the kill: `endedAt` **t806**;
- the shot: **`lightbosscontroller@72,72#75`**, fired at **t784** from (56,60) with v (−0.779, 0.628);
- the hit: `shot-hit` at update **t811**, at (34.98, 76.94);
- the only hit on the tape.

**The OFF baseline.** `run.entities('lightsFight')` is `null` while OFF (`levelRun.lightsFightNow` returns before it
builds anything), so the new arm adds nothing OFF. The producer roster measures that (§5).

**The merge.**
- Conflicts were in generated files: the solver-surface census, the constants census and its doc region, the procgen
  reference and the docs index.
  - Each was regenerated with its own tool.
  - The surface census carries LIGHTSARR's hand classification of `import:lightsShieldBump` over unchanged.
- The bot log keeps both entries, DA's and LIGHTSARR's.
- After the merge: surface GREEN 339, constants PASS, reference matches, and `fidelityLightsArr` / `fidelityLights` /
  `levelRunStateDigest` / `seedlingConstantsCensus` / `jsRuntimeLightsWiring` are green.

## 3. D1 — the pricing

**`dangerMap.lightsDanger(run, box, horizon, mode)`**, added to `dangerAt`'s union. Its shape is `predictArrows`'
(the model's own stepper on clones), not `arrowDanger`'s sweep:
- **The copy.** It copies `run.entities('lightsFight')[0]` (`cloneLightsFight`) and steps it in `lightsVerb`'s
  `forecastTick` order, without the player:
  - every shot (`stepLightBossShot`, `playerBox: null`);
  - every flier and its graphic (`stepLightBossFlier`, `stepLightBossFlierGraphic`);
  - the controller on `time + 1` (`stepLightsController`; it is skipped when the fight has no `Game.time` yet);
  - the removals.
- **The cull.** It is margin 0, against the camera at rest: L69 is the 160x160 screen, so `view()` clamps it to (0,0).
  This is `lightsVerb.restingOnScreen`, copied.
- **The shot's box.** The 4×4 `LIGHT_BOSS.shot.hitbox`, Player only. A shot is reported as kind **`spit`** with
  `lights: true`.
  - A `LightBossShot` IS a `TurretSpit` (`LightBossShot.as`).
  - That kind is what lets the ladder's existing DODGE rung (the `spitOnly` arm) answer it, with no edit to
    `solverBot.js`.
- **A flier.** Its contact gate is `Enemy.hitPlayer`'s: not dying and `hitsTimer <= 0`, as `stepLightBossFlier` leaves
  them. It is reported as kind **`lightBoss`**.
- **The frame.**
  - Update T+1 moves a shot or a flier and then tests the box the player left at T. So a box at horizon h meets frame
    h+1.
  - TRANSIT prices frames h and h+1; WAIT prices the union of 0 … h+1.
- **The direction.** The copy holds no player, so a shot that would hit the walk earlier stays in the air, and a flier
  is neither struck nor shoved. Both only add danger: `predictArrows` leaves out bodies for the same reason.
- **The memo.** The frames are memoised per run, keyed on `ticksCompleted` plus the fight's own state. A walk's probe
  asks one cell per sample, and each sample is a horizon further on. Stepping stops once nothing more can enter the
  air.
- **`TRANSIT_INGREDIENTS`** gains a `lights` row: autonomous, `atEta: true`.

**Rows:**
- **`dangerMap.test.js`**, 5 rows, `hammer LD — the Lights fight's shots and fliers`:
  - **The frame.** Frame 17 is the first whose box meets the test box, so horizon 16 sees it only through h+1. Also:
    nothing at horizon 0, and a WAIT union.
  - **The cull.** A shot leaving the screen at x 158 → 163 is never priced beyond it. CONTROL: the same shot is
    priced at the edge while still on screen.
  - **The flier gate.** Live: priced. Dying (`createSpriteAnim` die): not priced. Inside `hitsTimer` 30: not priced.
  - **OFF.** The null family gives nothing. A real room (L6) OFF gives nothing. A handed-in fight is a `dangerAt`
    source.
  - **The copy.** Asking the danger map does not move the run's fight.
- **`fidelityLights.test.js`**, 3 rows on the 823 t tape:
  - The tape takes exactly one hit: t811, shot #75, fired at t784 from (56,60), after `endedAt` 806.
  - **Asked at t806, `dangerAt` (transit) over every later L69 tick of the walk names exactly one cell:
    `[810, spit:#75]`.** That is the box update t811 tests.
  - CONTROL: OFF, there is no fight to read.
- **Mutants** (made by copy, restored by copy; `evidence/mutants/`):
  - **M1**, the arm dropped from the union. Predicted: the fidelity row and the dangerMap union row fail. Measured:
    both fail, 2 of 82.
  - **M2**, frame h only (no h+1). Predicted: the fidelity row fails. **Measured: it passed.** A 4×4 shot under 1 px/t
    overlaps the t810 box on frame h as well. The frame row above was added because of this, and M2 now fails it
    (1 of 5).

**The victim, after** (`evidence/d1/`):

| | before (merge `21d539b8`) | after (`9596e66c`) |
|---|---|---|
| step 159 ON | SOLVED **823 t, 1 hit**, 2 decisions, 158 s | SOLVED **826 t, 0 hits**, 3 decisions, 156 s (130 s on the XC rerun) |
| kill (`endedAt`) | t806 | t806 (the fight's keys are identical through t806) |
| the walk | t807 `down+primary+right` … hit at t811 | t807 idle (a 1-tick stall), then a different line to the Teleporter; no hit events |
| steps 158 / 160 | 105 t / 50 t | 105 t / 50 t |

Asked at t806 on the after-tape, `dangerAt` names no cell (`evidence/d1/victim-after.txt`).

## 4. D2 — the digest re-check

- **`escape-reach`** (`strikeEscape,pressEscape` over solverBot / spaceTimeReach / solveProgress / ghostSpinnerPress /
  playerPhysicsV2 / hazards / pressKillCost, with `dangerMap.js` added):
  - **Unchanged by D1:** 61 functions, 9 run members (`evidence/d2/escape-reach-*.txt`).
  - The hammer escape reaches **no danger-map function**, so D1's read of `run.entities('lightsFight')` is outside it.
  - The only line that differs between the file sets with and without `dangerMap.js` is `HITBOX`'s import attribution.
- **`member-reach`** (`evidence/d2/member-reach-after.txt`):
  - `lightsExits` → `advance`, `entities`, `tentacleBeastFight`. It also reaches the escape as the `world` that
    `visitWorld` writes, which `place` digests (DA's finding).
  - `lightsSpearRepeats` → `advance`.
  - `lightsFights` is already IN (DA). `lightsEvents` → `advance`, `entities`, `lightsFight`.
  - None of the escape's eight members reaches `lightsExits`, `lightsSpearRepeats` or `lightsEvents`.
- **So no map moves IN.** `stateDigestParts` and `DIGEST_EXEMPT` are unchanged, and I added no new run state.
- **XC verify** (`SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1`, DA's count hook; `evidence/d2/xc/verify-counts.jsonl`):

| workload | lookups | hits verified | mismatches |
|---|---|---|---|
| `plan-seedling-hammer-a-escape --check` | 3240 | 2160 | **0** |
| `plan-seedling-hammer-b1-approach --check` | 2481 | 1654 | **0** |
| `plan-seedling-hammer-b2-fight --check` | 1545 | 1030 | **0** |
| the two ON Lights solves (DA's `lights-solve.mjs`) | 0 | 0 | 0 |
| survey step 159 ON | 0 | 0 | 0 |

The Lights workloads make no escape lookups (as DA measured), so their zero is vacuous. The hammer rows are not.

## 5. D3 — fixtures, producers, gates, CI

**The ON fixtures did not move.**

| fixture | before | after |
|---|---|---|
| `lights-solve-sword` | witness tape, 559 t, 0 hits | re-solved key for key: `tapeEqual: true`, 559 t |
| `lights-solve-spear` | witness tape, 361 t, 0 hits | re-solved key for key: `tapeEqual: true`, 361 t |

- `fidelityLights.slow.test.js`: 2 / 2 green.
- `lights-stand`, `lights-revisit` and `lightsarr-*` are game witnesses replayed, not solved: all green in
  `fidelityLights.test` / `fidelityLightsArr.test`.
- No fixture was re-recorded.

**The producer sweep** (`node scripts/procgen/ci-producer-checks.mjs --jobs=4 --timeout-s=1500`):

| run | result |
|---|---|
| before, worktree at `21d539b8` | 93 run · **0 red** · 1 skipped (`plan-seedling-r7-ends-meet`, browser-only, as the roster says) |
| after, `9596e66c` | 93 run · **0 red** · 1 skipped |

The rc is the same for every producer (`evidence/d3/producers-*.log`). No OFF tape, fixture or pin changed.

**The gates:**
- surface census `--write`: dangerMap.js site counts only, 339 rows, nothing new to classify, then GREEN;
- `census-seedling-constants --check`: PASS (0 new, 0 moved);
- entities: PASS 566;
- profile: PASS 138;
- `generate-procgen-reference` then `--check`: ALL 7 MODULES AND 5 REGIONS MATCH;
- `generate-docs-index`;
- `check-procgen-docs`: ALL CHECKS PASSED.

**Bounded vitest** (`evidence/d3/vitest-files.txt`): **19 files / 629 green.** The list is:
- `dangerMap`, `fidelityLights`, `fidelityLightsArr`, `jsRuntimeLightsWiring`, `levelRunStateDigest`,
  `escapeCrossPassCache`, `solverBot`, `seedlingConstantsCensus`;
- every test file `rg -a` finds naming `TRANSIT_INGREDIENTS`, `dangerAt`, `dangerDuringTransit`, `lightsFight` or a
  lights fixture: `fidelityAxe`, `fidelityBobSoldier2`, `fidelityBombPusher`, `fidelityCorridorBody`, `fidelityIgneous`,
  `fidelityLadder2`, `fidelityMovingWait`, `levelRun`, `solveProgress`, `turretSolver`, `watchOverlays`.

No unfiltered local vitest (⚖ 52).

⚠ **The list missed `entityBlocks.test.js`**, and CI caught it (§8). `FAMILY_BLOCKS`' `lightsFight` row names the
solver files that read the family. Its readers are now `dangerMap` and `lightsVerb`, and the row and
`seedling-solver-surface.md`'s hand table said `lightsVerb` alone.
- Fixed in `7fa44ca3`.
- Then green locally: `entityBlocks`, `docLinks`, `docsRender`, `seedlingSolverSurface`, `dangerMap` and
  `fidelityLights`, 6 files / 209.
- The rule for next time: a new `run.entities('<family>')` reader is a `FAMILY_BLOCKS.solverReads` edit, and
  `rg -a -l "solverReads|entityBlocks"` finds the pins.

**CI (JSUT):** see §8.

## 6. What the brief got wrong (measured)

- **"The report … may be on main by the time you start."** It was not, and **the victim does not exist on main**: step
  159 ON at `2408fc5a6e` is 559 t with 0 hits. Run 39663950831 ran on `fid9-on/lightsarr`, a scratch branch on top of
  LIGHTSARR with the default flipped. The branch merges LIGHTSARR to have the victim at all.
- **"Once the danger map reads the fight, the escape's reach may read them too."** It does not. The hammer escape
  calls no danger-map function (`escape-reach`, with `dangerMap.js` in the file set, is unchanged), so nothing moves IN.
- **"The ON-only fixtures … may move."** None moved: both Lights solves re-solve key for key. The reach-exit leg of
  those solves is never priced against a shot.
- **"`git checkout -B seedling-hammer-lights-danger`."** The harness's branch is
  `claude/seedling-hammer-lights-danger-fvp3ii`, and that is the one used.
- **My own prediction for M2 was wrong** (§3). The victim alone does not pin the frame, so a constructed row does.
- **The brief's bounded list** (and my `rg -a` sweep, which searched for the danger map's names, not the family's
  readers) missed `entityBlocks.test.js` (§5).

## 7. Residue and hand-overs

1. **LIGHTSARR first, or together.** This branch carries the merge `21d539b8`. Landing it lands LIGHTSARR. If LIGHTSARR
   lands on main first, the merge is a no-op.
2. **The lazy build (ON only).** `run.entities('lightsFight')` → `lightsFightFor(level)` stores an entry (a `null` one
   in any room without a fight). The danger map now asks it in every room.
   - `stepLightsNow` already does the same on every tick ON, so the only new case is an ask before a run's first
     `advance`.
   - `lightsFights` is in `visit`, so such a run digests differently from one that has not asked. That is a missed XC
     match, never a false one (`stateDigestParts`' own note). XC measured 0 lookups in every Lights workload.
3. **A `lightBoss` source has no ladder rung.** A live flier on a walk is refused by AVOID (it is not one of
   `dangerVolumes`' shapes), not stalled past.
   - Latent: no committed walk meets a live flier.
   - The intro walk runs before the spawn, the fight is the verb's, and the reach-exit runs after the kill.
4. **The copy holds no player.** A flier the sword would kill stays alive in the forecast. That forbids more, never
   less. It matters only for a walk taken while fliers live (as 3).
5. **CI dispatch for the planner.** `seedling-survey.yml` has no `contact_fidelity` input (LIGHTSARR's note). An ON arm
   of `only=158,159,160` needs a scratch branch with the default flipped, as `fid9-on/lightsarr` was. Expect step 159
   SOLVED 826 t / 0 hits. An OFF run of the same steps on this branch should equal main.
6. LIGHTSARR's own residue is unchanged: the dark shield on a flier, and the wand arm.

## 8. CI at the pushed heads

| head | run | result |
|---|---|---|
| `9596e66c` (D1) | 39669846542 | cancelled by the next push (INCOMPLETE; no sum) |
| `6dbdfa1a` (D3) | 39670872227 | **red**: shard 1/3, 2 failures, both in `entityBlocks.test.js` (`lightsFight`'s `solverReads`). Unfiltered 21790 / 2 failed; slow 261 / 0 |
| `7fa44ca3` (the fix) | **39672844116** | **unfiltered 891 files / 21792 passed / 0 failed; slow battery 21 / 261 passed / 0 failed** |

**The gates at `7fa44ca3`** (`ci-summary.mjs --run=39672844116 --gates`; the run concluded **success**, 13 jobs):
- 60 same, 10 MOVED, 1 shallow, 89 not-banked, 0 MISSING.
- **Every row's CI value equals main's own run at `2408fc5a` (39662208143) but one.** So the 10 MOVED rows move
  against the standing bank, not because of this branch. They are gate roster counts, plus `r9-campaign` at
  `0dd65640`, LIGHTSARR's recorded base value.
- The one difference is `plan-seedling-l40button-witness --check` (not banked; exit 0 on both). Its output prints
  wall-clock seconds. Two local runs at this head give two md5s (6 s vs 7 s), and its tapes are byte-identical.
- Evidence: `evidence/ci/`.

This report's commit touches only `CC/docs/`. `7fa44ca3` is the last head with code.

## Rows to BANK

- Survey step 159 ON (LIGHTSARR merged): **823 t / 1 hit → 826 t / 0 hits**. The hit was `LightBossShot` #75 (fired
  t784 at (56,60)) at update t811, after the kill at t806.
- Asked at t806, the danger map prices #75 on the t810 box, and nowhere else on the walk.
- The hammer escape reaches no danger-map function. No map moves IN. XC verify: 4,844 hammer hits, 0 mismatches.
- The two ON Lights solves are unchanged, key for key. The producer roster is 93 / 0 red, before and after.
