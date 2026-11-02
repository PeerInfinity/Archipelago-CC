# Seedling hammer-phase AXIS-L12HITS — why AXIS's walk strikes cost hits on L12 (`AXIS_STRIKE`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-axis-l12hits` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `6d9f991739` (= `origin/main` at launch) |
| Head | W0 `4317608e`, I `b44018b2` + `80eba14c`, D `f50a5fe4`, M+D `084ddc71`; this report is the last commit on the branch |
| Branch | `claude/axis-l12hits-walk-strikes-8v9jst` (the harness's designated branch). Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-axis-l12hits-evidence/` (`w0/`, `m/`, `i/`, `d/`, instruments under `tools/`) |
| Scope | No mid-run message reached this session; the scope is the brief's. No fidelity W36 branch was scratch-merged; every answer below is main's code |
| Order | I was committed before M's evidence (the radius runs took hours, and the I commit started CI early); M's design check ran on scratch load hooks, never on the branch |

## 2. The answer first

**The one thing to know first: the hits are not on the strike's ticks, and the model is not wrong.** All 16 hits
(2 per leg) are `puncher@416,256`'s punches during the keylock's **hold**. They land 29–40 ticks after the stance walk
ends, and the model bills each at the game's own tick (`exact: true`). The axis strikes are what changed the route: they
keep the transit clean, so the solve skips the kill. The stand that follows was never certified: the **clear-tag** arm's
keylock stance walk never carried the hold as its tail.

| question | answer |
|---|---|
| What makes the hit? | **The stand after the walk.** None of the strike's own aim/press ticks, no stop and no facing change. ON, RULESREF's `punchGateTimed` asks the aligned corridor, and AXIS now arms it with the axis strikes. They land 1–2 hits on the puncher (never the 3rd) and keep the transit hitless, so that corridor is adopted. The player then stands at (424,264) / (440,264) for the keylock's 110-tick hold beside a live puncher, which punches twice |
| Why didn't the certifier price it? | The clear-tag arm (`execClearTag` → `walkTo(goal, resolved.stance, …)`) never hands the walk the keylock's hold as its tail; only the frontier arm does (`keylockStandWalk`, L30KEYLOCK). The probe ran with `stand: null` (`probe-loader.mjs`). OFF, it never matters: the strike-free transit is punched, so the ladder's kill rung clears the puncher first |
| Is it ⚖ 30(c)? | Yes, in the stand rather than the walk: the walk certified (transit only) was not the drive (transit + the executor's stand) |
| The fix | `solverBot.axisClearTagStand`: under `AXIS_STRIKE` ON, the clear-tag arm's keylock stance walk gets `keylockStandWalk`'s tail. Its probe meets the punch, the kill runs first, and **all 8 legs answer OFF's plan byte for byte, 0 hits** (node, and the page sweep at the head). OFF: `{}`, byte-identical |
| ON radius beyond L12 | **0 movers**: L40's 58 captured requests, the route survey's 237 steps, the r9 campaign, the producer roster and the identity block |
| Before → after (sweep, ON) | roomHits max **2 → 0** on the 8 legs; tick counts back to OFF's (771/777/836/842/864/872/444/447) |

## 3. W0 — reproduce

| row | result |
|---|---|
| base | `6d9f991739`; bootstrap `--seedling` done (node v22.23.4; the AP `pip` step FAILED, `/root/CC/pip.log`, as in AXIS; nothing here reads it); every non-wasm submodule initialised before the first gate |
| bounded set (`w0/bounded-files.txt`: every non-slow test naming `axisAligned`, `walkToUnder`, `strikePolicyFor`, `AXIS_STRIKE` or `holdOneAxis`, and the hammer rows) | **35 files, 390 / 390**. The 7 hammer `.slow` files (`w0/slow-files.txt`) run in the slow tier (§6) |
| page sweep, this tree on :8000 (`--mode=inv --producer=solver --keys=<the 8> --capture-requests`) | OFF: 8/8 pass, roomHits max 0. ON (`--solver-env=SEEDLING_AXIS_STRIKE=1`): legs 105/106/116/117 pass with **2 hits each, at the model's ticks** (e.g. 105: t782, t822; `exact: true`). This reproduces CI. ⚠ Legs 138–150 of that ON run served the **fixed** code: my scratch edit landed (05:06:20) between pages 2 and 3, and the server's log shows pages 3–4 loading `solverBot.js` after it (05:08, 05:11). They read 0 hits at OFF's ticks, an accidental early witness of the fix. Labelled so in `w0/page-sweep-rows.jsonl`; the deliberate witness is §6 |
| node replays (`tools/l12-batch.sh`, the captured requests, the base worktree) | ON, every leg: 2 model hits, all `punch` from `puncher@416,256` (`w0/replay-base.jsonl`, and from the ON-captured requests `w0/replay-base-onreq.jsonl`) |

**Per hit** (`w0/base-on-hit-ticks.jsonl`, `tools/l12-trace.mjs`, base ON):

| leg | stance walk ends | strikes (aim → press, key) | press hits landed | player hits (punch) | billed by the model? |
|---|---|---|---|---|---|
| 105 (L0 → flag 4) | t752 at (424.35,263.95) | t693 `right` → t694; t720 `left` → t721; t742 `left` → t743 | t695 (1), t744 (2) | **t782, t822** | yes, at the game's ticks |
| 106 (L0 → flag 5) | t759 at (439.55,263.95) | t693 → t694; t720 → t721 | t695 (1) | **t793, t823** | yes |
| 116 (L33 → flag 4) | t984 | t925 → t926; t952 → t953; t974 → t975 | t927, t976 | **t1013, t1053** | yes |
| 117 (L33 → flag 5) | t988 | t925 → t926; t952 → t953 | t927 | **t1026, t1054** | yes |
| 138 (L36 → flag 4) | t900 | t841 → t842; t868 → t869; t890 → t891 | t843, t892 | **t929, t969** | yes |
| 139 (L36 → flag 5) | t900 | t841 → t842; t868 → t869 | t843 | **t940, t970** | yes |
| 149 (L88 → flag 4) | t345 at (424.4,264.4) | t286 → t287; t313 → t314; t335 → t336 | t288, t337 | **t375, t415** | yes |
| 150 (L88 → flag 5) | t345 | t286 → t287; t313 → t314 | t288 | **t385, t415** | yes |

Every aim is along the walk's x axis (`right`, then `left` back), and every press holds `primary` alone: AXIS's lane
guarantee holds. The player's position at each hit is the stance (x ≈ 428–446 after the knockback, y 258.05–258.15 on
the game's rows). OFF on the same requests: the walk is `keylock stance -> kill (puncher@416,256) stance`, never
axis-aligned, the puncher is killed, and there are 0 hits.

**The certificate** (`tools/probe-trace.mjs`, leg 105 ON): the axis-aligned stance corridor's probe (`t0` 0, 15
waypoints to (424,264)) samples 752 transit ticks, **0 dwell**, `stand: null`, and returns clean. `keylockStandWalk`
is never asked on this arm (`tools/ks-loader.mjs`: no call). Asked with the resolution, it would have answered
`{stand: {ticks: 110}}` (the lock's key line `{x0: 418, x1: 427, y: 257}`).

## 4. M — the design check

| design | the 8 L12 legs (ON) | AXIS's L6 lane row (`tools/design-l6lane.mjs`) | survey step 79 (L53 puncher) | L40 / survey / r9 | verdict |
|---|---|---|---|---|---|
| (1) offer only bodies the press kills (`hits ≥ 2` of `hitsMax` 3; `tools/design-loader.mjs`) | OFF's plan on all 8, 0 hits (`m/replay-designs-1-3.jsonl`) | **loses it**: no strike, the bob's hit returns at t20 | **loses it**: refusal back to OFF's text (166 t, 39.7 px) | not run: it is already disqualified by AXIS's own rows | not built |
| (2) price the strike's own ticks in the walk's certificate | — | — | — | — | **already true**: `probeCorridor` previews the axis-armed walk (`axisStrikeFor`, ⚖ 30(c)) and the strike ticks are clean. The unpriced ticks are the hold's |
| (3) withhold the axis strike near a puncher in contact range (centre distance < 22 px) | OFF's plan on all 8, 0 hits | keeps it (no puncher on L6) | **loses it**: 166 t, 39.4 px | not run: same disqualifier | not built: it plans around the punch instead of modelling it (⚖ "model a game interaction; never plan around it") |
| (4) **price the clear-tag keylock hold as the stance walk's tail** (`axisClearTagStand`) | **OFF's plan byte for byte on all 8, 0 hits** (`m/replay-fix.jsonl`) | keeps it (row 2 green) | keeps it (= base ON: 167 t, 40.2 px) | L40 58/58 identical to base ON; survey 0 movers; r9 `--check` green | **BUILT** |

Why (4) is the honest fix: the certifier is missing the ticks the drive actually spends. The frontier arm already
prices this exact stand (L30KEYLOCK); the clear-tag arm, which the bosslock legs reach, did not. (1) and (3) remove the
axis strike's value to hide a stand the model can price.

## 5. I — the switch, the rows, the mutants, the ON radius

- **No new switch.** The fix sits under `AXIS_STRIKE` (OFF). `solverBot.axisClearTagStand(run, verb, resolved)`, beside
  `axisStrikeFor`, returns `{}` unless the switch is ON, the verb is `keylock`, and `KEYLOCK_WAIT_PRICED` is on (then
  `keylockStandWalk`, which itself returns `{}` without a hold or a key line). It is called at one site, the clear-tag
  arm's stance walk in `execClearTag`. The docblock carries the user's queueing and the CI sweep that found it. No new
  `SEEDLING_*` read; no `strategySwitch.js` edit; no new kill arm or rung (the kill the probe sends to is the existing
  ladder's).
- **Rows** (`hammerAxisStrikes.test.js`, 4 → 6, all green in ~6 s):
  5. `axisClearTagStand`'s gates on L12's own `bosslock@416,240`: ON a keylock gets a 110-tick tail; OFF, `kill`, or
     `KEYLOCK_WAIT_PRICED` off → `{}`.
  6. **L12 leg 149** (fixture `fixtures/hammer-axis-l12/leg149-l12-request.json.gz`, the page's captured request with
     its atlas records cut to level 12: **9.6 KB**. Cut and uncut answer byte-identically OFF, ON and at the base:
     444/444/430 t, plans `cac9c22b8946` / `cac9c22b8946` / `2d34c91a8dea`): OFF 444 t, 0 hits; ON the same plan
     string, 0 hits (the model's hits re-driven with `replayTape`). The non-vacuity arm: ON with the tail withheld
     (`withKeylockWaitPriced(false)`, the tail's own instrument) is the regression, 430 t, hits `[[375, punch,
     puncher@416,256], [415, punch, puncher@416,256]]`, the base's ticks.
- **Mutants** (`tools/mutants.py` in a separate worktree; `i/mutants.txt`):

| mutant | result |
|---|---|
| M1 remove the fix (`axisClearTagStand` → `{}`) | **RED** (rows 5, 6) |
| M2 drop the call at the clear-tag site | **RED** (row 6) |
| M3 OFF too (the `AXIS_STRIKE` gate dropped) | **RED** (row 5) |
| M4 every verb (the `keylock` gate dropped) | **RED** (row 5) |

  The first draft of row 5 used a stand-in lock with no key line. M3 and M4 survived it, so the row was rewritten on L12's
  real lock (`80eba14c`).
- **The ON radius, by mover class** (base ON vs fix ON):

| workload | movers | class |
|---|---|---|
| the 8 L12 legs | **8** | **hits removed**: 2 → 0 each, every one to OFF's plan byte for byte (the kill first, then the hold) |
| L40, 58 captured requests (AXIS's 52 keys, captured OFF at this head; `m/l40-*-on.jsonl`) | **0** (58/58 identical in verdict, ticks, plan sha, work, message; 45 ok / 13 refused both ways) | — |
| route survey `--through=end`, 237 steps (`m/survey-base-on-vs-fix-on.txt`) | **0** full-row movers (201 SOLVED / 36 REFUSED both ways; step 79 keeps AXIS's 167 t text) | — |
| r9 campaign `--check`, ON | green (`m/r9-fix-on.txt`) | — |
| producer roster ON | 0 red (97 run) | — |
| identity block ON | equal to OFF row for row | — |

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) | W0 35 files 390/390; at the head the touched files (`hammerAxisStrikes`, `solverEnvChannel`, `strategySwitch`, `fidelityL30KeyLock`) 4 files 50/50; `seedlingSolverSurface.test.js` 36/36 |
| the hammer `.slow` files (`vitest.slow.config.js`) | **7 files, 15/15** (`d/slow-hammer.txt`). A first local run was stopped by the session's 30-minute background limit after 3 files passed; the other 4 were re-run to completion |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`d/producer-off.txt`) |
| `ci-producer-checks --jobs=4`, `SEEDLING_AXIS_STRIKE=1` | **97 run, 0 red**, 1 skipped (`d/producer-on.txt`) |
| identity block at the head | every row green; equal row for row to AXIS's recorded block (`identity-after.txt`); ON equal to OFF (`d/identity-head.txt`, `d/identity-on.txt`) |
| `census-seedling-solver-surface --check` | GREEN 371 after `--write` (`f50a5fe4`): `AXIS_STRIKE`'s import count 2 → 3 sites; no new row to classify |
| `census-seedling-constants --check` | PASS (0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`docsIndex.js`, `procgen/README.md`); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, :8000) | **ALL PASS** (416 PASS rows; `d/wasm-ship.txt`) |
| page sweep at the head, ON, the 8 legs | **8/8 pass, roomHits max 0**, OFF's tick counts, every plan stamped `SEEDLING_AXIS_STRIKE=1` (`d/page-sweep-head-on.jsonl`) |
| docs | `seedling-bot.md` (AXIS's entry: AXIS-L12HITS, the fix, still OFF); `seedling-bot-log.md` (`### Seedling hammer-phase AXIS-L12HITS — …`) |
| JSUT | run **41394388022** at `80eba14c`: suite 25,268 passed / **1 failed**; **slow battery 365 / 365**. The red was `scripts/procgen/seedlingSolverSurface.test.js` (i) (the surface JSON not yet re-written for `AXIS_STRIKE`'s third site): reproduced red at that tree, green 36/36 after `f50a5fe4`. Run **41408464232** at `084ddc71` (the I/M/D head): **suite 25,269 / 25,269 passed, 0 failed; slow battery 365 / 365** |

## 7. What the harvest A/B should expect

**OFF: no movers.** `axisClearTagStand` reads one boolean and returns `{}`, which spreads nothing into the walk's
options, so the walk is handed exactly what it was.

**ON:** the 8 L12 legs move from 2 hits to 0, each to OFF's plan; nothing else moves (L40 requests, survey, r9). The
exact ON sweep to dispatch (`seedling-divergence-sweep.yml`):

- `keys` = `level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L0_304_176 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L33_32_64 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L33_32_64 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L36_32_128 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L36_32_128 -> location:L12 flag 5: bosslock@432,240 cleared|level_12__r0c19 <- in_L88_96_304 -> location:L12 flag 4: bosslock@416,240 cleared|level_12__r0c19 <- in_L88_96_304 -> location:L12 flag 5: bosslock@432,240 cleared`
- `solver_env` = `SEEDLING_AXIS_STRIKE=1`
- expect: 8/8 pass, roomHits max 0, ticks 771 / 777 / 836 / 842 / 864 / 872 / 444 / 447.

Then the full sweep with `solver_env=SEEDLING_AXIS_STRIKE=1` against an OFF run: expect no other mover. The 6 L12
bosslock legs from L35 / L95 (`in_L35_32_64`, `in_L95_624_64`, `in_L95_624_80`) were outside the brief's 8 and were not
measured here. CI's ON sweeps did not list them as movers, so they did not regress; why their route avoids the
aligned corridor was not traced. The full ON sweep covers them.

## 8. What the brief got wrong (measured)

- **"An axis-along strike on an L12 walk aims or presses into contact, or stops the walk where a body reaches it."**
  None of these. Every strike is an aim along the walk's axis and a `primary`-only press, and no hit lands on a strike
  tick or on the walk. The hits land in the keylock's hold, after the walk, because the strikes changed which corridor
  certified.
- **"Either the certifier never priced the strike's ticks, or the hit lands where the model and the walk part."**
  Neither: the strike's ticks are priced (the probe previews the axis-armed walk), and the model and game agree to the
  tick. The certifier never priced the **stand**: the clear-tag arm's keylock hold.
- **"Rows (`hammerAxisStrikes.test.js`) … the existing 4 rows stay green."** True; 2 rows added (6).
- The brief names 8 legs. The leg list has **14** L12 bosslock legs at this head (6 more from L35 and L95); see §7.

## 9. Residue and hand-overs

- **A pre-existing gap, OFF too, left for the planner:** the clear-tag arm's keylock stance walk never prices the hold,
  with or without AXIS. OFF it is masked wherever the transit is unsafe (the kill runs first). Any other way of making
  that transit clean (a future strike policy, a dash, a removed body) would expose the same unpriced stand. The fix here
  is gated on `AXIS_STRIKE` so OFF stays byte-identical; un-gating it (L30KEYLOCK's tail on both arms) is a change OFF and
  needs its own A/B. Measured here only ON.
- **JSUT:** green at `084ddc71` (run 41408464232, 25,269/25,269, slow 365/365). This report's push starts a docs-only
  successor; read it with `node scripts/procgen/ci-summary.mjs <head sha> --wait`.
- **The capture** (L12 ~4 MB, L40 ~31 MB) is not committed; the keys are in `w0/l12-keys.txt` and `m/l40-leg-keys.txt`.
- **Box-lock overrides:** two commits (`b44018b2`, `80eba14c`) used `BOX_LOCK_COMMIT_ANYWAY=1` under this session's own
  L40 capture sweep. A commit moves no served file; the sweep only captured OFF requests, which the fix does not touch.
- **Bootstrap residue:** the AP `pip` step fails (`/root/CC/pip.log`), as in AXIS.
- **Worktrees** created for the base and the mutants were removed (`git worktree remove`, by name).
