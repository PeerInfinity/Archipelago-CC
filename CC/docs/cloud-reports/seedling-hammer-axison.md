# Seedling hammer-phase AXISON — what `AXIS_STRIKE` ON still breaks (`AXIS_STRIKE`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-axison` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `31ce3077a1` (= `origin/main` at launch; `CHOOSER_PAIR` ON at size 3, train 15's switches present) |
| Head | the row `65b96fc9`, docs `105d8f8b`, gates `cc7e672d` / `1d0f6298`; this report is the last commit on the branch |
| Branch | `claude/seedling-axis-strike-breaks-89ch2b` (the harness's designated branch). Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-axison-evidence/` (`w0/`, `m/`, `i/`, `d/`; the instruments are in `tools/`) |
| Scope | No mid-run message reached this session, so the scope is the brief's. No fidelity W36 key moved under the run; every answer is at the start SHA's defaults |

## 2. The answer first

**The one thing to know first: on this sweep, the axis strike itself breaks nothing.** Every regression the ON sweep
shows, and every gain, comes from the other half of `AXIS_STRIKE`: the clear-tag keylock stand (`axisClearTagStand`,
AXIS-L12HITS). That half belongs to CLEARTAG-STAND. A scratch load hook ran ON with either half withheld. On all
10 captured mover requests, the strikes alone answer OFF's plan byte for byte, and the stand alone answers ON's.

| mover (CI 41477361069 vs 41477345657) | page, 2 runs per arm (this head) | cause | owner |
|---|---|---|---|
| L95 → L12 flag 4, pass → **refused** | reproduced both runs | **the clear-tag stand.** The priced 110-tick hold meets `puncher@416,256`'s punch. The kill rung's 17 stances all have a punched WAIT (t603–607), and avoid / detour / forced-hit see a covered goal. OFF passes with **2 hits** in that same hold | **CLEARTAG-STAND** (stopped here) |
| L95 → L12 flag 5, pass → **budget** | reproduced both runs (anytime deadline) | **the clear-tag stand.** In node it passes with 0 hits, but its work is 423 against OFF's 168 units, which the page's 640 budget does not fit | **CLEARTAG-STAND** |
| L104 → L105 exit, +2 hits | **not reproduced**: 0 hits ON in both runs | **neither: an arrival-seam flake.** The page's OFF and ON requests differ only in the seam. Over seams 6167–6227, OFF = ON on 61 of 61 and no axis policy is built. From seam 6224 both arms take `flyer@192,16`'s two drops | none (OFF has it too) |
| 4 L35 / L95 legs, 2 hits → 0 | reproduced both runs | the clear-tag stand (the gain is AXIS-L12HITS's) | CLEARTAG-STAND |
| L32 pit → L30 flag 0, refusal → pass | reproduced both runs | the clear-tag stand (0 axis policies built) | CLEARTAG-STAND |
| L71 → L72 exit, refusal → pass | **not reproduced**: ON refuses in both runs | a deadline flake (`shouldStop`). Node gives OFF = ON | none |

| question | answer |
|---|---|
| Is any regression the axis strike's own aim / press? | **No.** Measured in node on the movers' own page requests |
| A route the strikes newly admit? | **No.** With the stand withheld, the L12 / L30 legs never build an axis policy (0 policies), so the strikes never ran there |
| The clear-tag stand? | **Yes, every L12 / L30 mover**, both the regressions and the gains. Stopped on those legs and handed to CLEARTAG-STAND (§9) |
| A fix inside AXIS's code? | **None warranted, none made.** There is nothing in `axisAlongStrike` / `walkAxisOf` / `axisStrikeFor` to fix on these movers |
| Is a 0-regression ON sweep reachable from AXIS's side? | **Not from AXIS's code alone.** The strikes' own half is regression-free on every measured workload. The switch also carries the stand, and the flag-4 refusal is the stand's. AXIS is flip-ready when CLEARTAG-STAND's change is |
| Rows | One attribution row (row 7). The brief's "L95 and L105 ON pass with 0 hits" is not reachable from AXIS: L95 is the stand's, and L105 takes the hits OFF too (§8) |

## 3. W0 — reproduce

| row | result |
|---|---|
| base | `31ce3077a1`; `session_bootstrap.sh --seedling` done (node v22.23.4; its AP `pip` step FAILED, `/root/CC/pip.log`, as in AXIS and AXIS-L12HITS, and nothing here reads it). Every non-wasm submodule was initialised before the first gate |
| legs | `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`: 923 legs. 14 mover keys were picked (`w0/keys.txt`): the 6 L12 bosslock legs from L35 / L95, the 6 L30 legs from the L32 pit, L72's two exits (617 run) and L105's (775) |
| page sweep ×2 per arm | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=… --capture-requests`, OFF then `--solver-env=SEEDLING_AXIS_STRIKE=1`, this tree on :8000, twice (`w0/page-run1.txt`, `page-run2.txt`, `page-rows.jsonl`). Both runs agree in kind on every leg (table below) |
| node replays | `tools/axis-replay.mjs`, AXIS-L12HITS's tool plus the model's hits re-driven with `replayTape`. Deterministic, and each node answer matches its page row's verdict and hit count |

| leg | OFF (both runs) | ON (both runs) |
|---|---|---|
| 127 L35 → flag 4 | 494 t, 2 hits (t433, t474) | 643 t, 0 hits |
| 128 L35 → flag 5 | 541 t, 2 hits | 648 t, 0 hits |
| **160 L95/64 → flag 4** | 632 t, 2 hits (t575, t615) | **REFUSED** (keylock stance: the combat ladder is exhausted) |
| **161 L95/64 → flag 5** | 610 t, 2 hits | **budget** (`shouldStop` deadline) |
| 171 L95/80 → flag 4 | 672 t, 2 hits | 700 t, 0 hits |
| 172 L95/80 → flag 5 | 675 t, 2 hits | 750 t, 0 hits |
| 330 L32 pit → L30 flag 0 | refused (the lock did not open within its bound) | 306 t, 0 hits |
| 326–329, 331 (L30) | pass, 0 hits | identical |
| 617 L72 exit (176,0) | refused | refused |
| **775 L105 exit (80,144)** | 348 t / 396 t, 0 hits | 398 t / 398 t, 0 hits |

So the CI regressions on L12 flags 4 and 5 are real and stable. The L105 one and L72's gain did not reproduce.

## 4. M — the design check

**The arm split** (`tools/arm-loader.mjs`, a scratch load hook: `AXISON_NO_STAND=1` drops the `axisClearTagStand` spread
at the clear-tag site; `AXISON_NO_STRIKE=1` makes `axisStrikeFor` return `null`). Every captured request (`m/arm-split.txt`):

| request | OFF | ON | strikes alone | stand alone | axis policies ON |
|---|---|---|---|---|---|
| 127/0 | 494 t, 2 h | 643 t, 0 h | **= OFF** | **= ON** | 2 |
| 128/0 | 541 t, 2 h | 648 t, 0 h | = OFF | = ON | 2 |
| 160/0 | 632 t, 2 h | refusal | = OFF | = ON | 2 |
| 161/0 | 610 t, 2 h | 783 t, 0 h | = OFF | = ON | 2 |
| 171/0 | 672 t, 2 h | 700 t, 0 h | = OFF | = ON | 0 |
| 172/0 | 675 t, 2 h | 750 t, 0 h | = OFF | = ON | 2 |
| 330/0 | refusal | 306 t, 0 h | = OFF | = ON | 0 |
| 617/0, 617/1 | refusal | refusal | = OFF | = ON | 0 |
| 775/0 | 348 t, 0 h | 348 t, 0 h | = OFF | = ON | 0 |

On L12, policies are built ON only because the stand changes the route (the kill and the stance corridor): with the
stand withheld, the strikes alone build **0** policies on leg 160 (`i/cut-vs-uncut.txt`, KWP-off arm). The strikes
then act on that new route, but the stand-alone arm already gives ON's bytes, so they change nothing there either.

**L105 seam scan** (`w0/l105-seam-scan.jsonl`): the OFF-captured request at seam offsets −20 … +40 (seams 6167–6227), both
arms. OFF = ON on 61 / 61 (plan, ticks, hits), with 0 axis policies built. Ticks wander with the seam (348 / 381 / 396 /
398 / 402 / 413 …). From seam 6224 the answer is ~308 t with **2 hits, `drop` by `flyer@192,16`** (t283, t303), in
both arms. CI's ON leg arrived at such a seam; the switch has no hand in it.

**The design table** (the brief's three causes, per regression):

| regression | the axis strike itself | a route the strikes admit | the clear-tag stand | decision |
|---|---|---|---|---|
| L95 flag 4 refused | no (strikes alone = OFF) | no (0 policies without the stand) | **yes** (stand alone = ON) | **STOP, hand to CLEARTAG-STAND** |
| L95 flag 5 budget | no | no | **yes** (the stand's extra kill work, 168 → 423 units) | STOP, hand to CLEARTAG-STAND |
| L105 +2 hits | no | no | no | seam flake, OFF too; no fix |

No fix was weighed inside AXIS's code because nothing there moves a mover. The options the brief lists (narrowing
the offer, withholding near a puncher) would only remove value the strike has elsewhere: AXIS-L12HITS measured that
both lose L6's lane hit and survey step 79's.

**Radius of the strikes at this head** (re-measured, with CPAIR-3 now default):

| workload | OFF vs ON (`SEEDLING_AXIS_STRIKE=1`) |
|---|---|
| route survey `--through=end`, 237 steps (`m/survey-off-vs-on.txt`) | 201 SOLVED / 36 REFUSED both ways; **1 mover**, step 79 (L53), refusal text 166 → 167 t (AXIS's known text-only mover) |
| r9 campaign `--check`, ON (`m/r9-on.txt`) | all checks green |
| L40 captured requests | not re-captured: no AXIS code changed since AXIS-L12HITS measured 58 / 58 identical, and CPAIR-3 has no axis-aligned L40 tick per AXIS |

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch.** No change: `AXIS_STRIKE` (OFF), no new switch, no new `SEEDLING_*` read, no `solverBot.js` edit. OFF is
  byte-identical because nothing in the code moved.
- **Row 7** (`hammerAxisStrikes.test.js`, *"AXISON: on L95 flag 4 and L105 the axis strikes alone build no policy and
  answer OFF's plan"*). It uses two cut page requests in `fixtures/hammer-axison/`:
  - `leg160-l12-request.json.gz` (9.7 KB, atlas cut to level 12);
  - `leg775-l105-seam6224-request.json.gz` (2.5 KB, levels 104–106, seam +37).
  - Cut and uncut answer byte-identically in every arm (`i/cut-vs-uncut.txt`).
  - L95: OFF is 632 t with punches at t575 / t615. ON with the stand withheld (`withKeylockWaitPriced(false)`, row 6's
    instrument) builds 0 policies and gives OFF's plan.
  - L105: OFF is 310 t with `flyer@192,16` drops at t283 / t303, and ON is the same plan, the same hits and 0 policies.
  - It deliberately does **not** pin ON at the defaults on L95: that answer is CLEARTAG-STAND's to move.
  - 7 / 7 in ~19 s.
- **Mutants** (`i/mutants.txt`; edit, run the file, restore):

| mutant | result |
|---|---|
| M1 the stand applied with `KEYLOCK_WAIT_PRICED` off (the row's isolation broken) | **RED**: row 7 (and rows 5, 6) |
| M2 `axisStrikeFor` ignores the switch (a policy OFF too) | rows 1, 2, 6 RED; **row 7 GREEN, by design**: neither leg drives an axis-aligned walk with the stand withheld, so no axis-code mutant can move it. Row 7 is an attribution pin, not a guard on the strike's mechanics (rows 2–4 are) |

- **The ON radius, by mover class** (the CI sweep's ON movers):

| class | legs | cause |
|---|---|---|
| refusal / budget (regression) | L95 → L12 flags 4, 5 | the clear-tag stand |
| hits removed (gain) | 4 L35 / L95 legs | the clear-tag stand |
| refusal → pass (gain) | L30 flag 0 | the clear-tag stand |
| hits / refusal flake (OFF too) | L105, L72 | the seam and the deadline |
| **the axis strike** | **none of the above**; elsewhere only survey step 79's refusal text | — |

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) | `hammerAxisStrikes`, `solverEnvChannel`, `strategySwitch`: **3 files, 39 / 39** |
| the hammer `.slow` files (9, `vitest.slow.config.js`) | **8 files passed, 1 skipped (19 / 19 run tests passed)** (`d/slow-hammer.txt`). The skip is `hammerEscapeExact.slow`'s own gate |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`d/producer-off.txt`). The first OFF run read 1 red, the battery's `TREE-MOVED` guard alone: this slice's docs edit landed while it ran (`d/producer-off-treemoved.txt`). It was re-run on a still tree |
| `ci-producer-checks --jobs=4`, `SEEDLING_AXIS_STRIKE=1` | **97 run, 0 red**, 1 skipped (`d/producer-on.txt`) |
| identity block | green (maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, generated set OK, every producer `--check` exit 0, reference ALL MATCH). **ON equals OFF row for row** (`d/identity-off.txt`, `identity-on.txt`) |
| `census-seedling-solver-surface --check` | GREEN 371 (no code moved, nothing to classify) |
| `census-seedling-constants --check` | PASS (0 new / 0 vanished) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated after the docs (`docsIndex.js`, `procgen/README.md`); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, :8000) | **ALL PASS** (416 PASS rows, `d/wasm-ship.txt`). A first run was killed by a worker restart and re-run whole |
| docs | `seedling-bot.md` (AXIS's entry gains the AXISON sentence; the switch stays OFF); `seedling-bot-log.md` (`### Seedling hammer-phase AXISON — …`) |
| JSUT | run **41531074777** at `65b96fc9` (the row commit): **suite 25,387 passed / 0 failed / 6 skipped; slow Vitest job green**. Run **41545548330** at `105d8f8b` (the docs and regenerated reference): **suite 25,387 passed / 0 failed / 6 skipped; slow battery 372 / 373 passed, 0 failed** (40 files). The report and evidence commits after it touch no path its filter watches |

## 7. What the harvest A/B should expect

**OFF: no movers.** No source line changed. The branch adds one test row, two fixtures, docs and evidence.

**ON: exactly what CI 41477361069 showed, minus the flakes.** AXISON does not change ON. The planner's harvest A/B of
*this* branch against main is OFF = OFF.

**The ON sweep to dispatch** (`seedling-divergence-sweep.yml`), in two pairs so the halves stay apart:

1. **The switch as it ships** (the one the brief asks about; what the last wave's AXIS report missed):
   `solver_env=SEEDLING_AXIS_STRIKE=1`, full sweep (no `keys`), against an OFF full sweep at the same SHA. Expect the
   L95 flag 4 / 5 regressions and the L35 / L95 / L30 gains for as long as CLEARTAG-STAND has not landed. Re-run any
   L105 / L72 mover before believing it (§4).
2. **The axis strike alone** (the isolation this slice measured in node): `solver_env=SEEDLING_AXIS_STRIKE=1;SEEDLING_KEYLOCK_WAIT_PRICED=0`
   against an OFF arm with `solver_env=SEEDLING_KEYLOCK_WAIT_PRICED=0`, full sweep. `KEYLOCK_WAIT_PRICED` off
   withholds the stand (and the frontier arm's L30KEYLOCK tail, in both arms alike), so the pair differs only by the
   strikes. **Expect 0 movers**, or seam / deadline flakes that re-runs clear. A mover that survives a re-run there is an
   axis-strike regression, and this slice did not see one.

A narrow keyed check of the same claim, on the movers: `keys` =
`level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 5: bosslock@432,240 cleared|level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144|level_72 <- in_L71_304_96 -> exit:out_teleporter_176_0`,
in arm 2's pair: expect OFF = ON on all four.

## 8. What the brief got wrong (measured)

- **"Regressions … L95 → flag 4 refused, flag 5 budget"** are real but are **not AXIS's strike**: they come from the
  clear-tag stand that AXIS-L12HITS put under the same switch. The brief's own STOP rule applies, and was taken.
- **"`level_105 … ` passes but gains 2 hits (0 → 2)"**: a seam flake. It did not reproduce in 2 page runs per arm, and
  at the seams where it occurs OFF takes the same `flyer@192,16` drops.
- **"Gains: `level_72 <- in_L71_304_96 -> exit:out_teleporter_176_0` refusal → pass"**: not reproduced. ON refused in both
  page runs (the anytime deadline), and node gives OFF = ON.
- **"Rows: the L95 and L105 legs ON pass with 0 hits"**: not reachable from AXIS's code. The L95 ON answer is the
  stand's, and L105 at the hitting seam is hit OFF too, so pinning 0 hits there would plan around a flyer drop that the
  switch does not touch.
- **"The 4 L12 legs from L35/L95 go 2 hits → 0"**: true, and OFF's 2 hits are in the keylock **hold**, the pre-existing
  gap AXIS-L12HITS named (§9 there). They are not an AXIS gain.

## 9. Residue and hand-overs

- **To CLEARTAG-STAND** (the stand is theirs). On L95 → L12 flag 4 (`in_L95_624_64`), pricing the hold makes the
  stance walk meet `puncher@416,256`'s punch, and the ladder cannot kill it:
  - **kill:** all 17 reachable leash stances have a punched WAIT (t603–607), and GUARD APPROACH finds no approach
    stance either;
  - **avoid / detour / forced-hit:** the goal tile (26,16) is inside the live puncher's volume (a covered goal);
  - **flag 5** is the same stand, over budget on the page (node: 783 t, 0 hits, work 423 vs OFF's 168).

  OFF passes both legs only by taking 2 punches in the unpriced hold. The full refusal text is in
  `m/arm-split.jsonl` (id 160, arm `on`). The fixture `fixtures/hammer-axison/leg160-l12-request.json.gz` is the page's
  own request and is ready for their row.
- **Flip-readiness of `AXIS_STRIKE`** is now CLEARTAG-STAND's call. If they move the stand out from under
  `AXIS_STRIKE` (into a helper with its own switch), the strike half stands as measured here: regression-free on the
  movers, the survey's one text mover, r9 green.
- **L105's seam-dependent `flyer@192,16` drops** (OFF too, from seam 6224) are a model / route question for nobody's
  switch. They are noted here, not handed on.
- **Box-lock overrides.** Some commits used `BOX_LOCK_COMMIT_ANYWAY=1` under this session's own sweep or wasm-ship lock.
  None of those commits moved a served file: the instruments, the evidence, and the test row with its fixtures, which
  the page does not load.
- **The capture** (~8 MB per arm, 2 runs) is not committed; `w0/keys.txt` and `w0/capture-legs.txt` name it.
- **Bootstrap residue:** the AP `pip` step fails (`/root/CC/pip.log`), as in the last two AXIS slices.
- A worker restart killed the dev server and the first wasm-ship run; both were restarted and wasm-ship re-ran whole.
