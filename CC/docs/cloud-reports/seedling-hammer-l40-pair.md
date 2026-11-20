# Seedling hammer-phase L40-PAIR: the pair is not hitless; `PRESS_KILL_CHASERS` alone answers the L40 corner and moves nothing else

Slice `seedling-hammer-l40-pair` (Opus, cloud). Planner `seedling-hammer-phase-planning-12`. ⚖ The user approved the slice on
2026-11-19 (*"Measure the pair, then flip (Recommended)"*): a measurement session, no product-code change. Any flip is the
planner's next step, behind the user's SHA-bound OK.

## 1. SHAs

| | |
|---|---|
| Start (base) | `f0be39d5d7ba776ed8e9b32cb2748c546b43c729` (origin/main, TRAIN 169, `HIT_AWARE_ANSWER` ON) |
| Evidence head before this report | `f5a76b7b2d` |
| Head | the commit carrying this report (`Cloud-Status: final`) |
| Branch | `claude/seedling-hammer-l40-pair-ggu2an` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l40-pair-evidence/` (`seams/`, `census/`, `flip/`, `survey/`, `game/`, `tools/`, `prior/`) |
| Fixtures (new, data only) | `frontend/modules/seedlingDemo/fixtures/hammer-l40-pair/` (3 requests, § 9) |

No planner follow-up arrived during the session. I followed the brief alone. The container restarted once, mid-chain.
Everything committed survived, and the steps it cut were re-run (`tools/rest.sh`, resumable).

## 2. The answer first

**Verdict: the pair is NOT hitless.** On flag12-L43 it makes **three clocks hit-taking that OFF solves hitless**: 5214 and
5215 (`bob@736,800` at t803), and 5241 (`bob@736,752` at t788). It also **loses a clock OFF solves** on every leg measured:
5250 from L39 (flag-12 and Chest), and 5244 and 5245 from L43. In the census it loses 2 legs. ⚖ By the no-hit rule the pair is
not flippable.

**Recommended flip set: `PRESS_KILL_CHASERS` alone** (`SEEDLING_PRESS_KILL_CHASERS=1`, the solve **worker's** thread: it is
read in `solverBot.safeStep`, the press kill's per-tick step). Measured at 2560 over one full hammer period:

| leg | OFF: solved (with a hit) / refused | PKC alone | the pair |
|---|---|---|---|
| flag12-L39 | 40 (0) / 5 | **42 (0) / 3**: +5241, +5242; **every other clock digest-identical to OFF** | 41 (0) / 4: +5241, +5242, −5250; 21 other clocks re-planned |
| chest-L39 | 40 (0) / 5 | **42 (0) / 3**: +5241, +5242; every other clock digest-identical | 41 (0) / 4: +5241, +5242, −5250 |
| flag12-L43 | 30 (3) / 15 | **30 (3) / 15: all 45 clocks digest-identical to OFF** | 32 (4) / 13: +5232, +5233, +5237, +5240 (with a hit); −5244, −5245; 5214, 5215, 5241 now hit-taking; 5213, 5256, 5257 now hitless |

- **Census, 54 spinner-room legs:** PKC moves **0**, the pair moves 4.
- **Survey `--through=end`:** PKC moves **0** steps, the pair moves 2. No step gains a hit either way.
- **Identity c3/c6/c4:** PKC leaves them at OFF; the pair moves all three.
- **Game witness:** p4g plays PKC's 5241 plan (`ac3d24baa49e`, 1615 t) **1615/1615, 0 hits, end = model to the last digit,
  161 samples, 0 diverging**.

**The one thing to know first:** the L40 corner at 5241/5242 does not need the shield claim. L40-CORNER read the corner as the
claim's (the press taken with no certified way out). Measured, the chasers' step choice inside the press kill answers it
alone: PKC prefers a hammer-clear key set that is also chaser-clear, and the corner then does not form. The claim is what
brings the hits and the losses. It re-plans the burn stance's walk on L43 into the chasers, and its 5250 loss is the burn
stance's ladder on `chaser:bob@736,800`.

## 3. The reproduction (measured at the base)

- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at the base and at the head (no product code changed: the only
  non-evidence files are three fixture `.gz`).
- **OFF row at 5241** (`seams/repro-5241-off.json`): flag12-L39, 2560, **refused at work 724**, 28 s, with L40-CORNER's text:
  *"burn stance (burnabletree@872,784) -> kill (spinner@816,848) by press: every key set … at (868.73,855.83) … There is no step
  out. The corner formed 7 tick(s) after the press on spinner@816,848 LANDED at t1360"*.
- **OFF and claim-alone arms: L40-CORNER's sweeps, reused** (`prior/l40corner-base-off.jsonl`, `prior/l40corner-claim.jsonl`,
  measured at `f43e2de82a`). The code between that base and this one is TRAIN 167–169, FROZENTICK, whose fidelity key is OFF.
  Validated three ways:
  - **23 spot rows** (`seams/spot-off-claim.jsonl`, `tools/spot.sh`): OFF and claim at 5213/5225/5241/5247/5250 (flag12-L39),
    5213/5214/5232/5244 (flag12-L43) and 5220/5242/5247 (chest-L39). All **23/23 identical** in verdict, sha and hits. A
    24th row (claim, flag12-L43 5232) was lost to the container restart and re-run in the recap below: identical.
  - **The pair on flag12-L39** equals L40-CORNER's pair run (`prior/l40corner-pair-L39.jsonl`) on **45/45 clocks**, plan for
    plan.
  - **The base's own hit plan:** flag12-L43 5213/5256/5257 ship `bfecf9bc7bbd` (1749 t, `bob@736,800` at t790) here too.

## 4. Design + change, OFF identity

**No product change.** Measurement tools and evidence only, plus three request fixtures (§ 9). The acceptance md5 is
`391322d681b7aa0229d94b3f6906d024` at the base and at the head. `census-seedling-solver-surface.mjs --check` is GREEN (374
rows); `generate-procgen-reference.mjs --check` reports all 7 modules and 5 regions matching; `generate-docs-index.mjs --check`
is current. No docs edit, so no procgenDocs pins are owed.

**Tools** (`tools/`):
- **From L40-CORNER:** `seam.mjs`, gaining `--file=`; `compare.sh`; `census.mjs`; `tab.sh`; `survey-diff.mjs`; `samples.mjs`.
- **From L40-SPINNER-WALLS:** `legwitness.mjs`.
- **From HIT-TIEBREAK:** `census-leg.mjs`, plus the page's one held retry at `SOLVE_RETRY_BUDGET_FACTOR`× when the answer
  `budgetCut`s, and the shipped plan's sha.
- **New:** `sweep-arm.sh` (one arm, 3 legs × 45 clocks, 300 s wall cap per solve, resumable); `census-arm.sh` and
  `census-cmp.mjs`; `recap.sh` (the capped solves at 900 s); `flip.sh`; `rest.sh`; `cut-seam-fixture.mjs`; `repair-jsonl.mjs`.
  ⚠ `repair-jsonl.mjs` exists because the first arm ran with `sh -c 'echo …'`: dash's `echo` turned each JSON `\n` escape into a
  newline. The pair file was rejoined (135 records, all parse); every later arm prints with `printf`.

**The mechanism, read off the code** (`pressKillCost.js` § PKC, `solverBot.safeStep`). The press kill's per-tick step takes the
planned key set, else the first alternative that lands clear of every spinner one tick on. ON, among those same hammer-clear
sets and in OFF's order, it prefers the first that is also clear of every chaser one tick on. If none is, OFF's choice stands
(`unavoidable`). It is asked only on a press-kill tick, in a room with spinner bodies and a chaser forecast. So it can move a
plan only where a press kill walks beside a chaser, which is why it moves so little here.

## 5. Rows and bounded vitest runs

**Seam sweeps** (`seams/pair.jsonl`, `seams/pkc.jsonl`; `compare-off-pair.txt`, `compare-off-pkc.txt`, `compare-claim-pair.txt`;
135 solves per arm, budget 2560, 4 jobs, 300 s wall cap):

| arm | flag12-L39 movers vs OFF | chest-L39 | flag12-L43 |
|---|---|---|---|
| claim alone (L40-CORNER) | +5241, +5242; −5250; **5247 hit-taking** | the same four | +5232, +5233, +5237, +5240 (with a hit); −5244, −5245; **5214, 5215, 5241, 5248, 5249 hit-taking** |
| **PKC alone** | **+5241 (1615 t), +5242 (1615 t), 0 hits; 0 other movers** | **+5241, +5242 (1534 t), 0 hits; 0 other** | **0 movers** |
| pair | +5241 (1110 t), +5242 (1169 t); **−5250**; 21 clocks re-planned, all hitless | +5241, +5242; **−5250**; 21 re-planned, all hitless | +5232, +5233, +5237, +5240 (1 h); **−5244, −5245**; **5214, 5215 (`bob@736,800` t803), 5241 (`bob@736,752` t788) now hit-taking**; 5213, 5256, 5257 now hitless |

Compared with the claim alone, the pair removes the claim's 5247 hit on L39 and its 5248/5249 hits on L43. It keeps the claim's
5214/5215/5241 hits and every one of its losses.

**Every loss, text** (`seams/pair.txt`). The same refusal on all four:

> *"burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (743.8,855.8) —
> chaser:bob@736,800 (inside leash 80 (d=4.3) …) … avoid: … A\* goal tile (55,51) … for (888,824) — is not walkable:
> danger:bobsoldier@880,832 …"*

Chest-L39 says the same at `apitem (880,816) contact`. Work: 1758 (flag12-L39 5250), 1374 (chest-L39 5250), 1758 and 1752
(flag12-L43 5244, 5245); 35–47 s each.

**Wall caps (the hazard the brief named).**
- **In the sweeps:** 3 solves hit the 300 s cap under 4 jobs: the pair at flag12-L43 5227 and 5232, PKC at flag12-L43 5227.
- **Recap** (`seams/recap.jsonl`, 900 s cap, 3 jobs). All of them **solve**:
  - 5227 gives OFF's own plan `5615506525c2` (2068 t, hitless) under OFF, PKC, claim and the pair, taking 614–637 s in every
    arm, **OFF included**.
  - 5232 gives `2e02dd4318fc` (1777 t, hitless) under the claim and the pair, about 284 s.
  - So PKC is digest-identical to OFF at every L43 clock, and 5232 is a pair gain.
- **The `spinner@880,848` refusals** (13 per arm): 91–167 s under PKC, 133–199 s under the pair, at 112–496 work units. The
  budget does not see this time (L40-CORNER's hazard, re-measured). No census leg, survey step or spot row was capped.

**Bounded vitest, flip readiness** (`flip/`, `tools/flip.sh`). Files: the 7 default-tier and 4 train-tier test files that name
either switch (`grep -a -rl`), plus the SPIN slice's four bounded files: `hammerOpportunisticStrike`, `hammerPressKillGuards`,
`hammerRefugeBandText`, `hammerChooserPair`. Default tier:
`npx vitest run <7 files>`; train: `npx vitest run --config vitest.train.config.js <4 files>`.

| arm | default tier | train tier | rows that move vs OFF |
|---|---|---|---|
| OFF | **52/52** | **17/17** | — |
| **PKC** | 48/52 (3 failed, 1 skipped) | 16/17 | **5**: (a) `hammerPressKillChasers` "ships OFF" skips (its own OFF pin, by design); (b) `hammerPressKillGuards` "HO2 OFF: the press kill carries on past the death at t787": deaths `[787]` → **`[]`**, the death is gone; (c) "HO2 ON: refused by name on the tick of the first death": no death, so the run reaches the row's t1300 sentinel; (d) `hammerOpportunisticStrike` "step 67": reaches the t800 sentinel instead of the dying kill (the step PKC's own doc measured); (e) `hammerChooserPair.train` "853 at 5196" ON arm: still refused, but the refusal is no longer the press kill's death at t1228 (`chaser bob@736,800`); it now refuses at an `apitem (6…` contact (text mover) |
| pair | 45/52 (6 failed, 1 skipped) | 16/17 | **8**: PKC's 5, plus `hammerEscapeExact` "ON under a shield is OFF's no-claim" (the claim certifies: `{ok:true, claim:true}`), and both `hammerRefugeBandText` 371 rows (a refusal tick 92 → 94 / 422) |

Every PKC mover is a pin on a press kill that died, or a refusal text downstream of one. No PKC row loses a solve or gains a
hit. **The re-pin list a PKC flip owes: those 5 rows** (4 hammer files plus its own ships-OFF pin). All four are hammer files,
so no fidelity signature is needed.

**Identity rows** (`flip/identity-*.txt`; the c3/c6/c4 commands of `scripts/procgen/identity-block.sh`):

| row | OFF (this base) | PKC | pair |
|---|---|---|---|
| empty pairs c3 | `d356fc8a0fd231c1c2aa582371199602` | **= OFF** | `bbc9ce7be220c50d834925d165c80093` |
| empty pairs c6 | `483c791e9ab6f5389674536b9af773f3` | **= OFF** | `59c3f4b81f419ff74d67c5ff51baf617` |
| carved pairs c4 | `e83b066d3d91cd4e4f60653df21a8709` | **= OFF** | `fd17f4e2a819806af17b0a3c26faed78` |

The pair moves all three through the claim (the SPIN report's c3/c4/c6 finding: generated certify solves killing spinners with
the shield carried). PKC moves none. ⚠ This base's OFF c3 (`d356fc8a…`) differs from `standing-values.json`'s
(`4937da80…`, measured at `a833318744`). I compared arms against this base's own value and did not touch standing-values.

No train-tier row was added: the evidence rows and fixtures are enough for the planner's re-pin, and no behaviour ships.

## 6. Game witness (p4g)

The flag-12 L39 request at 5241, **`PRESS_KILL_CHASERS` ON**, the worker's dispatch at 2560 (`game/f12-5241-pkc-solve.json`):
plan `ac3d24baa49e`, 1615 t, work 2361, verbs bait/hold/kill/walk. Played with `tools/legwitness.mjs --plan --play` on
`seedling_bot_ap_p4g` (headless logic-only, the delivered set, under the box lock; `serve-nocache.py` on 8000 started for it and
stopped by PID):

| | model | game |
|---|---|---|
| ticks | 1615 | **finished 1615 / 1615** |
| hits | 0 | **0** |
| end | (887.56, 775.83) | **(887.562319193881, 775.8304781969423), the same** |
| flags | 40:0, 40:12 | 40:0, 40:12 (and 40:13, 40:15, 40:16, the run's pickups) |
| samples | | **161 sampled ticks, 0 diverging at offset 0** (`game/f12-5241-pkc-samples.txt`) |

Not witnessed: PKC's 5242 plan and chest-L39's (same family, `215315cf8bd9`), and the pair's plans. L40-CORNER witnessed
the claim's 5241 plan `106c40080ca0`, which the pair also ships.

## 7. Census: which seed-1 divergence-sweep legs can move, and why

**Method** (`tools/census-leg.mjs`, `tools/census-arm.sh`, `census/`):
- **Leg list:** rebuilt at this base, `seedling-divergence-legs.mjs --presets=seedling_playthrough`, 922 legs
  (`census/legs.jsonl.gz`). `tools/census.mjs` gives the same **50** shield-carrying spinner-room legs as L40-CORNER, key
  for key (L40 46, L39 3, L92 1; `census/census.txt`).
- **Solving:** each leg is solved in node as the page's solver producer asks it: inv staging, with the sphere's items and slots
  from HIT-TIEBREAK's `sphere-items.jsonl` matched by KEY; save keys, seals and totems from the sphere inventory; a fresh p4g
  page's delivered set (`census/dump.json.gz`, from one sweep leg); `ANYTIME_PASSES` at `SOLVER_BUDGET_WORK` 640. A
  budget-cut refusal is asked again at 2560 (the page's held retry; 6 of the 50 legs need it).
- **Why 54:** PKC reads no shield, so its upper bound is **every** spinner-room leg with a chaser forecast. I also ran the 4
  without the shield (L18 ×3, L92 ×1; `census/noshield-legs.txt`).

| arm | 50 shield legs | 4 no-shield legs |
|---|---|---|
| OFF | 49 solved (0 with a hit) / 1 refused (854, `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`: the ladder on `chaser:puncher@816,128`) | 3 solved / 1 refused |
| **PKC** | **0 moved** | **0 moved** |
| pair | **4 moved**: 47 solved / 3 refused (`census/cmp-pair.txt`) | 0 moved |

The pair's 4 movers, by KEY:
- `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest`: OFF 1022 t hitless (held retry) → **REFUSED**, the
  ladder on `chaser:bob@736,800` (the 5250 shape).
- `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`: OFF 1101 t
  hitless → **REFUSED**, the same.
- `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest`: 1144 t → 1011 t (held retry), hitless both.
- `level_40__r48c54 <- in_L43_176_464 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`: 1132 t → 1092 t,
  hitless both.

⚠ The node census's arrival clock is a fresh runtime's, not the page's. A leg's verdict can follow the clock (§ 5 shows it
does on these legs), so the census is one clock per leg. The seam sweeps are the period-wide measure. No full divergence sweep
was run (the planner's, at the flip). `seedling-divergence-sweep.yml`'s `solver_env` takes `SEEDLING_PRESS_KILL_CHASERS=1`.

**Survey `--through=end`** (`survey/end-{off,pkc,pair}.log` and `.json.gz`, `survey/diff-{pkc,pair}.txt`):
- **All three arms:** 224/250 SOLVED.
- **PKC:** **0 steps moved** (every verdict, tick count, hit count and refusal text equal).
- **The pair:** 2 moved. Step 66 (L40 Chest + Totem Part 160,640): the same ladder refusal, a moved corridor point.
  Step 96 (L40 flag 12 + Boss Key 2): REFUSED → **TIMEOUT**.
- **No step gains a hit in either arm.**

## 8. What the brief got wrong (measured)

1. **"The pair on flag12-L39 gives +2 / −1 (5250) / 0 hits"**: correct, re-measured digest-identical (45/45). But the
   implication that the pair is the candidate flip set does not hold. **On flag12-L43 the pair makes 3 hitless clocks
   hit-taking** (5214, 5215, 5241) and loses 2 (5244, 5245) (§ 5).
2. **The premise that the claim is what solves the corner** (from L40-CORNER: *"the claim alone solves the L40 corner"*, and
   the pair framed as claim + PKC to repair the claim's hits): **PKC alone solves the corner** at 5241 and 5242 on both L39
   legs, hitless. It is game-witnessed at 5241, and it leaves every other clock and leg digest-identical. The claim is not
   needed for the corner. It is the source of every hit and every loss measured here.
3. **"Re-confirm the OFF row at 5241"**: confirmed (refused, work 724, the same text).
4. **The wall-time hazard: *"the spinner@880,848 face costs 170–225 s per refusal"***: at 4 jobs it is 91–199 s here. The
   larger cost is flag12-L43 5227, a SOLVE of 614–637 s under every arm including OFF. At a 300 s cap it reads as a loss;
   re-asked at 900 s it is OFF's plan.

## 9. Residue / hand-overs

- **For the planner (the flip):** flip `PRESS_KILL_CHASERS` alone, not the pair. It owes:
  - re-pinning the 5 bounded rows (§ 5: `hammerPressKillChasers` ships-OFF; `hammerPressKillGuards` HO2 OFF / HO2 ON;
    `hammerOpportunisticStrike` step 67; `hammerChooserPair.train` 853 at 5196's ON-arm text);
  - no identity re-record (c3/c6/c4 unchanged);
  - the planner's full sweep, where `solver_env` gives the real leg count.
  `PRESS_ESCAPE_SHIELD_CLAIM` stays OFF. ⚖ The no-hit rule forbids it on L43 (5214, 5215, 5241), with or without PKC.
- **The fixtures for the next slice** (`frontend/modules/seedlingDemo/fixtures/hammer-l40-pair/`, `tools/cut-seam-fixture.mjs`).
  Each is its source request byte for byte with only `staging.seam.time` re-stamped, plus a `measured` block (the pair's
  refusal, work and passes at 2560):
  - `flag12-L39-5250-request.json.gz` (leg 871's request at 5250);
  - `flag12-L43-5244-request.json.gz` (leg 872's at 5244);
  - `chest-L39-5250-request.json.gz`.

  That shape is the burn stance's ladder EXHAUSTED on `chaser:bob@736,800`, with `bobsoldier@880,832` covering the goal tile
  (888,824). It is seed 1's wasm wall (A1/A3), and it is reached only when the claim re-times the press kill. OFF and PKC solve
  all three requests. It is a ladder/chaser-arm question (`GUARD_APPROACH_STANCE`, `COVERED_GOAL_REFUSAL`), not a press one.
- **Still standing under PKC** (not this slice's):
  - the `spinner@880,848` press refusals on L39 at 5225, 5227 and 5228 (`SHOVED_BODY_LOOKAHEAD` answers 5225, per L40-CORNER);
  - flag12-L43's 15 refusals: the `spinner@880,848` press, the burn stance's ladder on `spinner@816,848`'s body, one deadline;
  - the base's hit plan `bfecf9bc7bbd` at flag12-L43 5213/5256/5257 (`bob@736,800` at t790). **PKC does not fix it**; only
    the claim re-plans it hitless, while taking hits elsewhere.
- **Wall time:** flag12-L43 5227 needs about 10 minutes of wall time at 2560 under every arm. The page sees that as a stall
  the work budget does not count.
- **Not done:** a p4g witness of PKC's 5242 and chest-L39 plans; a train-tier row pinning PKC's 5241 answer (the planner's
  re-pin wave can take `seams/pkc.jsonl`'s `ac3d24baa49e` / `215315cf8bd9`); a full divergence sweep (the planner's).
