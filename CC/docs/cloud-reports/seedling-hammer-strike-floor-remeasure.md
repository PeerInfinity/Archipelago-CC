# Seedling HAMMER-PHASE — slice SF3: re-measure the strike-timing floor on today's main

Slice `seedling-hammer-strike-floor-remeasure` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ The user
(2026-10-22): *"Please run both measuring steps"*. **Measure only.** `STRIKE_ETA_FLOOR` stays OFF. No tape, fixture, pin
or witness was re-recorded, and no runtime file was edited. ON means the env var `SEEDLING_STRIKE_ETA_FLOOR=1`.

## 1. Base, head, branch, defaults

| | |
|---|---|
| Start SHA | **`ef6bdd6d86`** (= `origin/main` at the fetch; contains the runner pin `c2f479fe72`) |
| Head | the commit carrying this report (W0 commit `33e98ba0` before it) |
| Branch | `claude/strike-eta-floor-remeasure-fb3k63` (the harness names it; the brief's `seedling-hammer-strike-floor-remeasure`). Nothing went to `main` |
| Box | 4 cores, node v22.22.0; 1-minute loads 1.3–3.2 during M1 (`evidence/m1/m1-walls.jsonl`) |

**Switch defaults at the base** (`evidence/w0/defaults.txt`, read from the modules, not from the source text):

| switch | default | SF2's base |
|---|---|---|
| `CONTACT_FIDELITY.strikeIframeLapse` (the lapse) | **ON** | OFF |
| `ESCAPE_CROSS_PASS_CACHE` | **ON** | OFF (did not exist) |
| `STRING_PULL_FAST` | **ON** | — |
| `REFUGE_ETA_CUT` | ON | ON |
| `PRESS_KILL_DONE_ON_WALK` | ON | ON |
| `STRIKE_PREVIEW_CAP` | 16 | 16 |
| `STRIKE_ETA_FLOOR` | **OFF** | OFF |

## 2. The answer, first

- **The L18 sweep costs 1.35× OFF** (83.2 s → 112.3 s, medians of 3 rounds), against SF2's **1.44×**.
- **The escape cache did not move the ratio.** With the cache opted out, L18 runs 112.0 s → 151.0 s, also
  **1.35×**. The cache speeds both modes by the same ~26 %, with the same 2/3 hit rate. ON does 1.44× OFF's
  lookups: 81,525 against 56,655, with 54,350 and 37,770 hits. Opting out of the lapse or `STRING_PULL_FAST` does not
  move the ratio either (1.30–1.35×). On L18 all three switches are answer-inert. The drop from 1.44× is not
  attributed to any switch; see § 7.
- **Solves gained / lost: 0 / 0.** The L18 sweep and C2's ghost staging SOLVE 45 / 45 both ways. Both still refuse
  staging A (sword, ghost) and legs 387 and 404, both ways. The answers are byte-stable over 3 rounds, in every
  workload and both modes.
- **The re-record table grew.** SF2 had 22 gate rows in 12 files; today there are **29 in 12 files** on SF2's 21-file
  list, plus **3** in `hammerPressKillGuards` (a file added since). Other new rows:
  - **one witness tape** (`l40button-l42-part0`);
  - **one witness premise** (`bw-bombstand`'s interim pin);
  - `hammer-sf-strikefloor`'s "ships OFF" row.

  The new `ci-producer-checks.mjs` roster goes from 0 red to **8 of 93 red** ON.
- **The trades are SF2's.** Every tick, kill and solve length of SF2's movers reproduces. The one exception is
  `r9-solve-18`: its committed base was re-recorded to 440 t since SF2, and ON now gives 390 t, where SF2 measured
  518 → 476.

## 3. M1 — the cost and the movers

**The method** (`evidence/tools/m1-rounds.sh`, `sf3-run.sh`):
- 3 rounds.
- In each round, OFF and ON of one workload run side by side (`xargs -P 2`).
- The workload order rotates by 4 per round, and the mode order alternates.
- Each wall carries the 1-minute load at its start.
- The XC count hook (`xc-count-hook.mjs`) logs `ESCAPE_CROSS_PASS_CACHE_COUNTS` per process.
- SF2's leg ids shifted by 10 in today's `seedling-divergence-legs.mjs` list. **Leg 397 is today's 387 and leg 414 is
  today's 404**, matched by key (`evidence/m1/legs-ids.txt`).

| workload | OFF median / min s | ON median / min s | **ON ÷ OFF** | SF2 (cap ÷ OFF) | answer OFF → ON (norm-md5, stable ×3) | XC lookups / hits OFF → ON |
|---|---|---|---|---|---|---|
| staging A, sword | 86.2 / 81.4 | 20.3 / 18.0 | **0.24×** | 0.49× | `deafe3a4` → `6584e122` | 0 → 0 |
| staging A, ghost | 76.5 / 67.2 | 22.3 / 20.6 | **0.29×** | 0.57× | `a5f113ee` → `58533491` | 0 → 0 |
| leg 387 (SF2's 397), ghost | 73.9 / 73.6 | 54.9 / 54.7 | **0.74×** | 0.74× | `46f418a3` → `880444c1` | 0 → 0 |
| leg 404 (SF2's 414), ghost | 82.3 / 80.2 | 51.3 / 51.0 | **0.62×** | 0.81× | `00e039af` → `34b0a367` | 0 → 0 |
| **L18 sweep (45)** | 83.2 / 81.1 | 112.3 / 107.3 | **1.35×** | **1.44×** | `de6f6e4e` → `bae5c6de` | 56,655 / 37,770 → 81,525 / 54,350 |
| C2's ghost staging (45) | 62.2 / 61.8 | 74.7 / 73.5 | 1.20× | 1.08× | `1ca7eed5` → `0a9504dc` (= SF2) | 73,566 / 49,044 → 87,468 / 58,312 |
| `r9-campaign --check` | 46.7 / 44.6 | 49.7 / 47.1 | 1.06× | 0.97× | `eea79738` → `2f25aa6e` (exit 1) | 1,626 / 1,084 → 1,884 / 1,256 |
| `r8-l18 --check` | 1.8 / 1.8 | 3.2 / 3.1 | 1.78× | 1.82× | `dfda7600` → `cc1f3610` (= SF2, exit 1) | 807 / 538 → 1,734 / 1,156 |
| `r8-d2-chain --check` | 2.9 / 2.9 | 4.5 / 4.3 | 1.55× | 1.47× | `8afbe7e2` → `25720cae` (= SF2, exit 1) | 807 / 538 → 1,734 / 1,156 |
| killgate s2 | 3.0 / 3.0 | 7.3 / 7.3 | 2.43× | 2.00× | `8e12a2ac` → `639eb96a` (= SF2) | 0 → 0 |
| killgate s5 | 7.0 / 6.4 | 3.2 / 3.0 | 0.46× | 0.48× | `5f08a6a2` → `a4e9b9a8` (= SF2) | 0 → 0 |
| killgate s9 | 8.1 / 7.7 | 4.3 / 4.2 | 0.53× | 0.56× | `99a34f19` → `40b5e59e` (= SF2) | 0 → 0 |

Per-round walls: `evidence/m1/m1-table.md`. Loads ran 1.3–3.2, so the walls are usable (no fallback to work units).
The box is faster than SF2's (L18 OFF 83 s against 110 s).

**The L18 attribution controls** (`evidence/m1/xc-walls.jsonl`, `sw-walls.jsonl`; the same side-by-side pairing):

| L18 sweep with | OFF s | ON s | ON ÷ OFF | answers |
|---|---|---|---|---|
| today's defaults (above) | 83.2 | 112.3 | 1.35× | `de6f6e4e` / `bae5c6de` |
| `SEEDLING_ESCAPE_CROSS_PASS_CACHE=0` (3 rounds) | 112.0 (108.1–114.2) | 151.0 (145.0–151.7) | **1.35×** | the same |
| `SEEDLING_STRIKE_IFRAME_LAPSE=0` (2 rounds) | 81.4 / 80.6 | 105.7 / 107.9 | 1.30–1.34× | the same |
| `SEEDLING_STRING_PULL_FAST=0` (2 rounds) | 81.3 / 80.6 | 108.5 / 107.0 | 1.33× | the same |

**The movers, OFF → ON** (round 1's outputs: `evidence/m1/outs/`):

| workload | OFF | ON | solve gained / lost · ticks · hits | vs SF2 |
|---|---|---|---|---|
| staging A, sword | REFUSED t3113 on `bob@736,752`; spinner killed t3100; 6 landings (511 / 1770 / 1985 / 2960 / 3062 / 3100) | REFUSED **t1753** on **`bob@736,752`**; killed **t1740**; landings 511 / 1610 / 1654 / 1740 / 1743 | none · refusal 1,360 t sooner | OFF = SF2. ON: the same ticks and landings, but the refusal now names **`bob@736,752`**, not `bobsoldier@880,832` |
| staging A, ghost | REFUSED t2195; killed t2114 (`@880,848`) and t2182 (`@816,848`) | REFUSED **t1629**; `@880,848` killed **t1616**; `@816,848` never fought | none | = SF2 both ways (only the message text moved) |
| leg 387, ghost | refused on **`bobsoldier@880,832`** | refused on `bob@736,752` | none | **OFF's obstacle swapped** (SF2's OFF named `bob@736,752`); ON's obstacle swapped the other way |
| leg 404, ghost | refused on `bob@736,800` | refused on `bob@736,752` | none | = SF2 (message text only) |
| L18 sweep | 45 SOLVE, Σ 19,545, 0 hits | **45 SOLVE**, Σ **19,558**, 0 hits; 24 shorter, 21 longer, 0 equal. Largest: r38 363 → 586, r44 346 → 483, r34 363 → 486; r17 492 → 367, r15 449 → 367, r5 515 → 437 | none · Σ +13 | **= SF2 row for row** (only the header's committed residue moved, 40 → 12) |
| C2's ghost staging | 45 SOLVE, Σ 15,178 | 45 SOLVE, all at 328 t, Σ 14,760 | none · Σ −418 | = SF2 byte for byte |
| `r9-campaign --check` | exit 0; `r9-solve-18` 440 t; Σ 10,622 | exit 1: `r9-solve-18` **440 → 390 t** (`{18,0}` 406 → 355); Σ **10,622 → 10,572**; `r9-solve-19`'s free oracle fails (declared seam.time 10372 against 10322) | shorter | **new numbers.** `main` re-recorded `r9-solve-18` (518 → 440) since SF2, and SF2's 518 → 476 is now 440 → 390 |
| `r8-l18 --check` | exit 0 | exit 1: `r8-solve-18` **363 → 467 t**, `{18,0}` 305 → 419; spinners die t111 / t193 → t161 / t307 | longer | = SF2 |
| `r8-d2-chain --check` | exit 0 | exit 1: the headline **1,669 → 1,773 t**; its prefix row fails at tick 11 | longer | = SF2 |
| killgate s2 / s5 / s9 | `8e12a2ac / 5f08a6a2 / 99a34f19` | `639eb96a / a4e9b9a8 / 40b5e59e` | the printed verdicts are unchanged | = SF2 |

No workload reports a player death. The hits columns above are spinner landings; the L18 and ghost sweeps report
0 player hits both ways.

**What changed against SF2:**
- **L18 1.44× → 1.35×.** Not the escape cache: the ratio is 1.35× with it on or off. Not the lapse, and not
  `STRING_PULL_FAST`. The answers are SF2's row for row, so the work is the same work. The XC flip-prep slice
  measured 1.40× on its own box (2026-10-18). What remains is code drift outside the three switches since then, or the box (SF2 ran three modes
  side by side at loads up to 5.4; here two ran at 1.3–3.2). Unattributed.
- **Staging A got cheaper ON, relatively.** It is 0.24× / 0.29× OFF, against SF2's 0.49× / 0.57×. ON's walls fell
  ~3× (62.9 → 20.3 s), more than OFF's (129 → 86 s). The trajectories are the same, so this is per-derivation cost.
- **The ghost staging got dearer relatively** (1.08× → 1.20×), with the same answers.

## 4. M2 — the re-record table at today's main (ON)

- **OFF baseline at the base:**
  - identity block exit 0 (`evidence/m2/identity-off.txt`);
  - SF2's 21 files **501 / 501**, the 4 new files **52 / 52**;
  - roster **93 run, 0 red, 1 skipped** (`r7-ends-meet`, its named exclusion).
- **Base drift since SF2** (OFF, not this switch): carved pairs c4 `b9d2185d → ebb9e743`, ENEMY census `afdc6d1a →
  f0bec576`, and `r9-campaign --check` `712f0ead → 0dd65640`. Every other identity row equals SF2's W0.

| kind | what | measured ON | vs SF2 |
|---|---|---|---|
| committed tapes + traces (producers) | `r8-solve-18` (`solve-seedling-r8-l18`) | 363 → 467 t | **same** |
| | `r8-d2` (`solve-seedling-r8-d2-chain`) | 1,669 → 1,773 t; `{18,0}` 305 → 419 | **same** |
| | `r9-solve-18` (`solve-seedling-r9-campaign`), and `r9-solve-19`'s declared seam.time | **440 → 390 t**; Σ 10,622 → 10,572 | **same row, new numbers** (SF2: 518 → 476, Σ 10,931 → 10,889) |
| witness producers whose `--check` fails ON on a premise | `f1c-l18-phase`: *"the solve STALLED for the hammer's phase at least once"* → `[]` | **same** (output md5 `934d9871` = SF2's) |
| | `hammer-a-escape` (×2): *"with the switch OFF this staging REFUSES HAMMER_SAFETY"* → it solved | **same** (`65742bdc`) |
| | `hammer-b1-approach`: *"with the switch OFF … solves to the committed walk's length"* → 476 | **same** (`866666cd`) |
| | `hammer-b2-fight`: the same premise → 476 | **same** (`2cd6b74f`) |
| | `hammer-g1-ghostkill`: *"the ghost press kills spinner@816,848"* → never fought | **same** (`5acf8d97`) |
| | `hammer-bw-bombstand`: (1) *"the press kill's stand takes bombpusher@112,128#7 on t1157's ledger row"* → `[]`; (2) the ON solve stops at t1248 on `#9`'s blast on `bob@272,112` | **same** |
| | `hammer-bw-bombstand` (3): *"the INTERIM pin's witness — lapse ON: the ON solve stops at t1339 on #11's Explosion reaching spinner@192,160"* → 1,663 executed, no refusal | **new** (the premise was added since SF2) |
| | `l40button-witness`: *"l40button-l42-part0: the model replays it to the part"* → 1,915 observations, ends at L40 (226.0, 132.8) | **new** (the producer landed 2026-10-18) |
| | `hammer-sf-strikefloor`: *"the switch ships OFF"* → `enabled true` | **new**, mechanical: the env var turns it ON. A flip rewrites this row; the witness tape itself is byte-identical ON |
| witness TAPES that drift ON | `f1c-l18-phase42`, `hammer-a-l18-escape15`, `-escape21`, `hammer-g1-l40-ghostkill` | **same** (bw still throws before its drift check) |
| | `l40button-l42-part0` | **new** |
| identity rows (`identity-block.sh`, `SEEDLING_PORT=9587`) | acceptance batch `9fbd9304`; empty pairs c3 `c4a58671`, c6 `5d06a8b0`; killgate s2 / s5 / s9 `7c15ed57 / 47116405 / 4d3bbf17` | **same** digests as SF2's ON |
| | carved pairs c4 `ebb9e743 → 7e1497c4` | **same row, new digests** (SF2: `b9d2185d → 1c5127cd`; the OFF base moved) |
| | `r8-d2-chain` `f5490519`, `r8-l18` `3c81acbe` (exit 1) | **same** |
| | `r9-campaign` `0dd65640 → a6b59269` (exit 1) | **same row, new digests** (SF2: `8475fa2a`) |
| gate rows, SF2's 21-file list (`evidence/m2/vitest-sf2-on.txt`): **29 failed in 12 files**, 471 passed, 1 skipped | the 22 rows SF2 listed: `hammerApproach` (1), `hammerEscape` (2), `hammerFight` (1), `hammerFightFallback` (2), `hammerGhostKillRung` (1), `hammerGhostSpinner` (2), `hammerPressBombs` (1), `pressKillCost` (1), `procgenScratchPersistence` (3), `solveProgress` (3), `solverBot` (1), `solverSpinnerKill` (4; F2 515 → 490, 264 → 197, 269 → 238, 210 → 229) | **same**, all 22, and the F2 numbers too |
| | `solveProgress` +7: PR (2: the residue-21 answer/asks row, *"non-vacuous, string pull"*), RK (3: `lastWhy.name` on the committed solves, the residue-21 answer row, *"v1's fields are W0's bytes"*), TC2 (2: the residue-21 frame rows) | **new**: rows added since SF2 that pin L18's residue-21 bytes or the committed solves |
| gate rows, files added since SF2 (today's selection rule; `vitest-new-on.txt`) | `hammerPressKillGuards` (3): HO1 *"ON the band's candidates are refused by name"* (expected > 0, got 0); HO2 OFF/ON *"the death at t1202"* → **788** | **new**. `escapeCrossPassCache`, `fidelityL40Contact` and `hammerDashShape` stay green ON |
| `ci-producer-checks.mjs` roster (`producers-on.txt`) | **8 of 93 red ON**: `f1c-l18-phase`, `hammer-a-escape`, `hammer-b1-approach`, `hammer-b2-fight`, `hammer-g1-ghostkill`, `hammer-bw-bombstand`, `l40button-witness`, `hammer-sf-strikefloor` | **new instrument** (it landed 2026-10-19). The 3 `solve-seedling-*` producers are not in its globs; they are the identity block's rows |
| not moved | maze, ENEMY census, guard, AREA, levels pre/post-sword, generated set, `r8-battery`, `r8-tail`, `r9-l3`, reference (ALL 7 + 5); the other 85 roster producers | as SF2 (plus the 85) |

**Size:**

| | SF2 | today |
|---|---|---|
| producer tapes (+ traces) | 3 | 3 (same; `r9-solve-18`'s numbers new) |
| witness producers red ON | 6 | **8** (+ `l40button-witness`, + `hammer-sf-strikefloor`'s ships-OFF row); bw has a 3rd failing premise |
| witness tapes drifting | 4 | **5** (+ `l40button-l42-part0`) |
| identity rows | 7 (+ 3 producer rows) | 7 (+ 3), the same set |
| gate rows | 22 in 12 files | **29 in 12 files + 3 in 1 new file = 32 in 13** |

## 5. Recommendation (a recommendation only; the flip is the user's call)

**Flip, as one dedicated re-record slice.** Do not leave it parked. Do a named cheaper step first, inside that slice:
the mechanical re-pins.

Why flip:
- It loses no solve anywhere measured (0 / 0).
- Its cost on the one workload where it costs is now lower (L18 1.35×, not 1.44×). That cost is seconds per sweep on
  this box (+29 s over 45 residues).
- It is far cheaper where the kill is long: staging A 0.24× / 0.29×, the legs 0.62–0.74×, killgate s5 / s9 ~0.5×.
- The defect it repairs (OFF skips reachable strikes) is unchanged.

Why the re-record slice first:
- The table grows each week the switch stays OFF: +7 gate rows, +1 witness tape and +1 premise since SF2, all from
  slices that pinned OFF bytes.
- Waiting buys no cheaper flip. The escape cache was the obvious candidate, and it is ratio-neutral.

The slice's order:
1. **Mechanical:**
   - `hammer-sf-strikefloor`'s ships-OFF row;
   - b1 / b2's OFF-length premise. Re-pin it to the re-recorded `r9-solve-18` (ON: 390). ⚠ b1 / b2 print 476 ON;
     whether their staging is the committed tape's needs checking there;
   - the 3 producer tapes;
   - the identity digests;
   - the 22 + 7 + 3 gate pins.
2. **Design work:** four new stagings or retirements (f1c, a-escape ×2, g1, bw's three premises) and the new
   `l40button-l42-part0` witness.
3. **Page legs:** the divergence sweep SF2 named, run from a scratch branch with the default set.

**If the user prefers to keep it OFF:** at least have new slices stop pinning OFF-only bytes, or pin both modes, so the
table stops growing.

## 6. What the brief got wrong (measured)

1. **The leg ids.** "Legs 397 and 414" are **387 and 404** in today's leg list. The list moved by 10 ahead of them; the
   keys are SF2's.
2. **"Name the cause … for example the XC hit counts ON vs OFF."** The cache is not the cause. The ratio is 1.35×
   with it on and with it off. It hits 2/3 of lookups in both modes and scales both walls by the same ~26 %.
3. **"`r9-solve-18` 518 → 476 t."** `main` re-recorded `r9-solve-18` to 440 t since SF2. ON now gives 390 t, and the
   campaign Σ is 10,622 → 10,572.
4. **"The lapse is ON (`7a20beb2fd`)."** The lapse is ON (read from `CONTACT_FIDELITY`), but that commit is not in
   this shallow clone (`git rev-parse` fails), so it was not verified by SHA. `426b1f8938` and `66277efb17` are
   ancestors of the base.
5. **"SF2's 21-file list" as the bounded gate set.** Today the same selection rule also picks up 4 more files. One of
   them, `hammerPressKillGuards`, fails 3 rows ON. Both lists were run and reported apart.
6. **The bootstrap.** `session_bootstrap.sh --seedling` printed `done`, not `READY`. Its pip step failed on an
   interactive `ModuleUpdate` prompt (EOF), and all 9 submodules were left `-`. The 8 non-wasm ones were initialised
   by hand, and wasm came up through the bootstrap's mirror.

## 7. Residue

1. **The L18 ratio's drop (1.44× → 1.35×) is unattributed.** It is not caused by the three switches the brief named
   (measured), and the answers are SF2's. The candidates are non-switch code since 2026-10-18 (XC flip-prep measured
   1.40×) and the box/load. A cheap check would be L18 OFF/ON at `426b1f8938` against today on one box. Not run.
2. **Two refusal obstacles swapped** (staging A sword ON; leg 387 OFF and ON), with every tick unchanged. They are
   workloads, not artifacts. The game was not asked.
3. **`hammerPressKillGuards` HO2's 1202 → 788** is a pin of OFF's death tick. Whether ON's earlier death is a better
   trajectory or a new hazard was not examined.
4. **CI was not dispatched** (measure only; no ref here changes code). The suite number for this head is CI's, by
   ⚖ 52.
5. **Hygiene.**
   - The dev server I started (`serve-nocache.py 9587`, PID 1256) was killed by PID.
   - No tracked file was edited; `git status` was clean before the roster runs (they assert it).
   - All scratch lived in the session scratchpad.
   - ⚠ `git config --worktree core.hooksPath` landed in `.git/config` (this clone has no worktrees, so it is the one
     tree).

## Evidence (`seedling-hammer-strike-floor-remeasure-evidence/`)

- **w0/**: `sha.txt`, `defaults.txt` (every switch, `CONTACT_FIDELITY`, `STRING_PULL_FAST`).
- **tools/**: `sf3-run.sh` (one workload, one mode, XC hook), `m1-rounds.sh`, `xc-control.sh`, `sw-control.sh`,
  `m2-battery.sh`, `m1-table.py`. SF2's `norm.py`, RE's `g1-solve.mjs` / `d1-leg.mjs` /
  `ghost-sweep.mjs` and XC's `xc-count-hook.mjs` / `defaults.mjs` were used unchanged. The leg inputs came from
  `seedling-divergence-legs.mjs --out=legs.jsonl` and `probe-seedling-divergence-sweep.mjs --legs=… --mode=inv
  --ids=390 --dump=dump.json`.
- **m1/**: `m1-table.md`, `m1-walls.jsonl`, `xc-walls.jsonl`, `sw-walls.jsonl`, `legs-ids.txt`; `outs/` holds round
  1's output and XC counts per workload and mode.
- **m2/**: `identity-off.txt`, `identity-on.txt`; `vitest-{sf2,new}-{off,on}.txt` and the file lists; `on-fails.txt`;
  `producers-off.txt`, `producers-on.txt`; `plans.txt` and `plans/` (the 8 roster reds ON, full output); `m2.log`.
