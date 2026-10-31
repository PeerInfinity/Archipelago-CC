# Seedling hammer-phase SPIN: the press kill of `spinner@816,848` on L40's Boss Key 2 leg from L39

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-spinner-press` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `9c0f9045` (origin/main at the checkout) |
| Head | W0 `b8302cf6`; M `c252f9c0`; I `76af24c7`; D `03b4cf67`; this report is the last commit |
| Branch | `claude/seedling-hammer-spinner-press-hgt8a9` (the harness's designated branch; the brief's local name `seedling-hammer-spinner-press` was used locally and pushed to it) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-spinner-press-evidence/` (`w0/`, `m/`, `i/`, `d/`, instruments under `tools/`) |
| Switch | `pressKillGuards.PRESS_ESCAPE_SHIELD_CLAIM`, **OFF** (`SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1`, `withPressEscapeShieldClaim`) |
| Scope messages | none arrived mid-run |

## 2. The answer first

**The one thing to know first:** the wall was not about the walk. The press that decided it was taken **with no escape
claim**, because hammer-phase A's escape (`pressEscape`) refuses to claim anything whenever the shield is carried.
`levelRun.spinnerForecastWithPress` names `shieldBumpNow` as unmodelled for any inventory with a shield, so on every
press kill after the shield the escape is inert, and A3's fallback presses. On 860 the escape kernel, asked anyway,
**exhausts** from the t2744 landing: no hitless way out of that landing exists, and the corner 19 t later is its
consequence.

**The cause, named:** the press timing against the body's phase. The kill aimed at t2742 into a landing with no way
out. The refuge walk after it (t2749 on) re-derives its target every tick on the far side of the knocked-back body,
but no walk could have saved it: a space-time search from each refuge tick t2749–t2752 exhausts too
(`m/designB-holdout-searches.txt`). The stance, the strike window and the landing point are downstream of that one
press.

**The design chosen (C′):** ON, when the shield bump is the ONLY unmodelled source, `pressEscape` asks the bump-blind
forecast. This is the forecast every other press-kill predicate already treats as the answer (`safeStep`, the rung, the
refuge, `deriveStrike`). Then:
- a certificate is adopted only if no state on its whole path (approach, train, escape) puts the shield's **envelope**
  on a forecast body. The envelope is the union of `playerShieldRect`'s boxes, tested against rows `i − 1 … i + 1`.
  Where it touches nothing the bump cannot fire, so the forecast is exact on that path;
- an **exhausted** escape search is a claimed negative, so the aim waits for a certified strike (A3's preference);
- every other negative stays OFF's no-claim.

**Why this design, measured.** Four designs on 860 (seam 5950, A5, 10240), § 4:

| design | 860 |
|---|---|
| A: certify the refuge walk (`deriveRefuge` refuses a walk that meets a rect or the line) | worse: "no reachable cell … The room has nowhere to be" |
| B: a certified hold-out (space-time search) when the refuge walk previews into a corner | the wall stands; nothing survives from any refuge tick |
| C: shield-only certificates (envelope-checked), negatives left as no claim | the wall stands (digest `fa7856c4e8da`) |
| **C′: C plus the exhausted negative claimed** | **the kill completes**: landings t2626 / t2761 / t2817 |
| C′ negatives only (no certificate adopted) | passes at seam 5950; **at main's own seam 5102 it is OFF** (`a0f1db73b99b`) |

Both halves carry weight. At seam 5950 the claimed negative stops the doomed press. At seam 5102 the certificates
re-time the earlier kill of `spinner@880,848`, and the chooser then hands ICEST.

**Effect** (`i/`, `m/`; ON against OFF; a digest is the md5 of the refusal):

| leg / arm | budget | seam 5950/5425 (L40C's) | seam 5102/5117 (main's BK2 capture) |
|---|---|---|---|
| **860, A5** | 10240 | OFF: the corner (770.96,860.99), work 2832 → **ON: `spinner@816,848` killed (t2626/2761/2817)**, then the anytime deadline inside `kill (iceturret@472,400)`, work 10241 | OFF: the combat ladder on the spinner's body at (714.3,679.2), no press kill → **ON: ICEST handed at t1520, `spinner@816,848` killed (t2626/2759/2792)**, then the deadline |
| 860, A5 | 2560 | OFF = ON: the weigh-stance waypoint stall (`0283c36cb88f`) | text mover: the same stall (`9fd2c168a1ce` → `b99ab1c69d95`; `spinner@880,848`'s kill re-timed) |
| 860, A5 − ICEST | 10240 | OFF = ON: the combat ladder on the spinner's body (`0837a4660f48`) | text mover: the same ladder, moved (`a0f1db73b99b` → `d6046bc7ed55`) |
| 860, A5 − ICEST | 2560 | OFF = ON (`0283c36cb88f`) | text mover (`9fd2c168a1ce` → `b99ab1c69d95`) |
| 861, A5 | 10240 | OFF = ON: the deadline (`27cd3718c4e8`); the spinner's press kill already completes OFF here | text mover: ICEST's "no side" family (`108143e99cb2` → `6899382148a2`) |
| 861, A5 | 2560 | OFF = ON (`27cd3718c4e8`) | text mover (`d36342659e93` → `bb20e97328c2`) |
| 861, A5 − ICEST | 10240 / 2560 | — | text movers: the ladder on the spinner's body (`412d2d21d211` → `586a07ab3328`; `1b1f9fcb1f0c` → `c268a0cb4ad3`) |

**Does the fix need the budget?** Yes. At the shipped budget (2560) no arm reaches the `spinner@816,848` press kill
on either leg, at either seam, OFF or ON. The anytime deadline or an earlier wall comes first. The fix shows only with
the deadline lifted (10240), as the brief expected.

**What 860 meets next:** the **anytime deadline inside `kill (iceturret@472,400)`** (ICEST's kill, the `crusher-fork`
site, at t3179 in the trace). This is the chain resuming the turret kill the staging was for. At the captured seam the
answer the solve reports is an earlier pass's (the weigh-stance waypoint stall), because the solve spends all 10240
units. **Without ICEST**, 860 never reaches the press kill: the combat ladder on the spinner's body, on the
weigh-stance walk, belongs to the chooser and ICEST (CPWIT / APPROACH), not to this slice.

**Flip readiness:** **not ready.** The switch solves nothing new and loses no solve on any workload measured. It moves the L40 refusal one link on 860 at 10240, and it shortens two L40 solves (one by a bomb hit fewer). But a flip moves **three identity rows** (empty pairs c3, c6 and carved pairs c4: their generated certify solves kill spinners with the shield carried) and **6 bounded rows in 4 files** (§ 5), none of them yet re-pinned or game-witnessed. The ON kill on 860 also has no game witness yet (§ 9). Ready means: the planner's witness of 860's kill, the identity rows' re-record (the generated levels' certify solves), and the 6 rows re-pinned.

## 3. W0

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B seedling-hammer-spinner-press origin/main` → `9c0f9045`; `session_bootstrap.sh --seedling` → READY, node v22.22.0. ⚠ The six non-wasm submodules were first left `-`; `check-procgen-reference` then failed at the clean base (`registry.js` fields 35 vs 25). Initialised, it matches |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, the six producer `--check`s exit 0 (r9 campaign `be9c19c8`). **Every row equals L40C's published values.** The reference row printed DIFFER inside that run: my scratch edit landed mid-run, and the uninitialised submodules made it fail on its own. Re-run on the initialised tree: ALL 7 MATCH |
| `ci-producer-checks --jobs=4` (a clean worktree at the base, `producer-base.txt`) | **97 run, 0 red, 1 skipped** |
| bounded set by path (`bounded-files.txt`: every test naming `execKillByPress`, `pressKillGuards`, `HAMMER_PHASE_RUNG`, `spinner@816,848`, `spinner@880,848`, `PRESS_KILL_CHASERS`, `OPPORTUNISTIC_STRIKE`, `pressEscape`, `HAMMER_ESCAPE`, plus every `hammer*` and `fidelityL40*` fast file) | **43 files, 526/526** (`bounded-base.txt`, 795 s) |
| the leg list | `seedling-divergence-legs.mjs` at the base: 919 legs; **860/861 are still the BK2 legs' ids** (keys = L40C's) |
| the BK2 capture | `probe-seedling-divergence-sweep --mode=inv --producer=solver --keys=<860|861> --capture-requests`. Two requests each. **Seams: 860 at 5102, 861 at 5117** (L40C: 5950 / 5425) |
| 860 at its own seam | A5 2560: the weigh-stance waypoint 5 stall at (472.8,674.2) (`9fd2c168a1ce`). **A5 10240 and A5 − ICEST 10240 are the same answer**: `weigh stance (wandlock@448,432)`, the combat ladder EXHAUSTED on `spinner@816,848`'s BODY at (709.4,678.5) (`a0f1db73b99b`, work 2833). ICEST is never handed. **The brief's ICEST wall does not reproduce at the capture's seam** |
| attribution | L40C's base code (`480c2aa4`, a worktree) on THIS capture gives main's answer (`a0f1db73b99b`): the code did not move it. The request did. The page's seam is its wall clock, so each capture lands at another hammer phase |
| **both walls reproduced** | the request re-stamped to L40C's seam (`SPIN_SEAM=5950`, `tools/arms.mjs`): **A5 10240 = L40C's `fa7856c4e8da`** (`kill (spinner@816,848) by press`, the corner at (770.96,860.99) 19 t after the landing at t2744, work 2832) and **A5 − ICEST 10240 = L40C's `0837a4660f48`** (the ladder on the body at (718.6,682.8), horizon 380). 861 at 5425, A5 10240 = L40C's deadline (`27cd3718c4e8`) |
| the full L40 capture (for the radius) | the 52 L40 keys (`tools/l40-leg-keys.txt`): **52 legs, 59 requests** (L40C: 61). In it the BK2 legs landed at seams 5947 / 5406 |

## 4. M

**The trace** (`tools/scratch.patch`: env-gated `console.error` instrumentation, never committed to product code;
`m/off-trace-t2700-2762.txt`). At seam 5950, A5, 10240:

- the strike `(760,856)@2747` is walked; the live arm finds the body in reach early, aims at t2742 and presses at
  t2743. **`esc -`**: no escape certificate. `m/off-aim-escapes.txt`: at every aim on this leg (t539, t871, t904,
  t2624, t2742) `pressEscape` returns `{ok: false, claim: false, why: "the forecast names shield bump
  (`shieldBumpNow`) as unmodelled"}`;
- the press lands at t2744 (h2, i-frame 30). The body is knocked west to 736.6, then comes east at 3 → 1 px/t,
  straight at the player;
- t2749 on: no strike (the i-frame), a refuge every tick. The refuge flips between (744,840), (744,856) and
  (760,856), all on the far side of the body. `stepToward` + `safeStep` back east, one tick deep, until
  (771.81,860.99): every key set lands on the rect or the line.

**The cause:** the press at t2743. The escape kernel asked at that aim (design C) **exhausts**: *"no state reachable
from index 7 survives to index 11"* (`m/designC-aim-escapes.txt`). Nothing after the landing can change that:
design B's space-time search from each refuge tick t2749–t2752 exhausts within 10–13 ticks
(`m/designB-holdout-searches.txt`). The refuge's target-flipping is real, but it is not the cause.

**The designs** (each measured on 860, seam 5950, A5, 10240; scratch, `tools/scratch.patch`, `m/d*.jsonl.gz`):

| design | what | result |
|---|---|---|
| A | `deriveRefuge` refuses a candidate whose previewed walk meets a body rect or the line | REFUSED earlier: *"no reachable cell … nowhere to be"* (`095c83802fac`) |
| B | on a refuge tick whose walk previews into a corner within one period, follow a `spaceTimeReach` hold-out from the live state | the preview sees the corner only at +0; searched on every refuge tick (B-always) it finds nothing until t2753, too late: the same corner at (771.64,860.74) |
| C-ignore (an upper bound only) | the shield flag dropped outright | the chain diverges at the first aims (t539…); refused on an unrelated weigh fade, work 4745. Not a design: it adopts certificates whose path the bump may touch |
| C | shield-only certificates whose envelope meets no body; negatives no claim | certificates at t539/871/904/2624; t2742 exhausts → no claim → pressed; **the wall stands** (`fa7856c4e8da`) |
| **C′** | C plus the exhausted negative claimed | t2742's aim refused; aims again at t2759 (no claim) and t2815 (certified); **landings 2626/2761/2817, the body destroyed**; the chain goes on to t3179 and the deadline inside `kill (iceturret@472,400)` (`m/designCprime-*.txt`) |
| C′ negatives only | the exhausted negative claimed, no certificate adopted | seam 5950: passes (same landings). **Seam 5102: = OFF** (`a0f1db73b99b`, ICEST never handed) |

C′ was chosen. It is the only design that passes the spinner at both seams. Its two halves are each load-bearing at
one seam, and it changes nothing but `pressEscape`'s answer under a carried shield. The other workloads are in § 5.

## 5. I

**The switch** (`frontend/modules/seedlingDemo/pressKillGuards.js`, beside the other press-kill guards):
`PRESS_ESCAPE_SHIELD_CLAIM = { enabled: env SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM === '1' }`, `_DEFAULT = false`,
`withPressEscapeShieldClaim`, `PRESS_ESCAPE_SHIELD_CLAIM_COUNTS` (`asked`, `certified`, `envelope`, `exhausted`,
`noClaim`), `SHIELD_ENVELOPE` (derived from `playerShieldRect`: x −6…6, y −6…7 about the point),
`shieldEnvelopeMeets`, `shieldOnlyUnmodelled`. The docblock carries the user's queueing and L40C's ranking.
`PRESS_KILL_DONE_TRACE = { sink: null }` hands a completed press kill's `{bodies, from, t, landings, perTick, equips}`
to a witness. The hook is `solverBot.pressEscapeOnce`: OFF returns its no-claim at the same line as before, and
nothing else below reads the switch. `playerShieldRect` reaches `pressKillGuards.js` through the door
(`solverView.js`), as the solver-surface census requires.

**Byte-identity OFF:** every OFF digest re-measured after the change equals W0's (860 A5 10240 at 5950 =
`fa7856c4e8da`; 860 A5 2560 at 5950 = `0283c36cb88f`; 861 at 5425 = `27cd3718c4e8`). Roster, bounded set and
identity in § 6.

**Rows** (`hammerSpinnerPress.test.js`, 11 rows, ~5 s; fixture `fixtures/spin-witness/leg860-request.json.gz`, the
page's request 860/1 at `9c0f9045`, re-stamped to seam 5950 in the test as `fidelityL40Bk2`'s leg-368 rows do):
- ships OFF (the default, the env, the `with…` scope);
- the envelope is the union of `playerShieldRect`'s boxes, each edge attained;
- `shieldOnlyUnmodelled` (the shield alone, never with another source, never empty);
- `shieldEnvelopeMeets`: rows i − 1, i, i + 1 are met, i ± 2 not, touching edges not, the next state's point asked;
- **four stands beside `spinner@816,848` on 860's own staging**, found by a scan of the room (`tools/scan.mjs`): OFF
  makes no claim at all four; ON is **certified** at (808,854) (75 keys), **envelope → no claim** at (814,854),
  **exhausted → claimed** at (829,860), **approach → no claim** at (820,854);
- no shield: ON deep-equals OFF at all four stands, and the switch is never asked;
- a solve with no spinner on the press (`fidelityStrikeLapse`'s bobsoldier2 L30 arm, 413 t): ON's keys = OFF's,
  never asked.

`hammerSpinnerPress.slow.test.js` (2 rows, ~145 + ~240 s alone; 310 + 400 s under load): **OFF reproduces the wall**
(the refusal's exact text, and no kill of the spinner), and **ON passes the spinner**: the done sink reports the kill
with three landings; its 2830 keys and equips, replayed on a FRESH run from the request's staging, kill the body at
t2830 with **0 hits and 0 deaths** and the same landing ticks (⚖ 30(c), `m/witness-on-860-5950-10240.txt`).

**Mutants** (each applied, the fast file run, then reverted):

| mutant | red rows |
|---|---|
| drop the fix (`shieldClaim = false`) | 4: certified, envelope, exhausted, approach |
| the claim where the shield CAN reach the body (the envelope check dropped) | 1: the envelope stand |
| mis-timed by one phase step (rows i…i+2 for i−1…i+1) | 1: `shieldEnvelopeMeets` |

**The ON radius, by mover class:**

| workload | OFF → ON | movers |
|---|---|---|
| 860 / 861 (§ 2's table) | 860 passes the spinner at 10240 (both seams); the rest = OFF or text | **advance**: 860 A5 10240 at both seams. **text**: 860 at 5102 (2560, and A5 − ICEST), 861 at 5117. **none worse** |
| L40, 59 captured requests, defaults (A0) | 41 → 41 SOLVED | **2**: 366/0 Totem 64,144 **SOLVED 1757 → 1699 t, two bomb hits (t1340, t1386) → one (t1340)**, game-modelled: better; 382/0 Chest: the same `bob@736,800` ladder, moved (text) |
| L40, 59 requests, A5 | 47 → 47 SOLVED | **1**: 382/0 Chest ← L39 **SOLVED 1468 → 1395 t, hitless both**, game-modelled: better |
| route survey (`--through=end`, 237 rows at this base) | 201 → 201 SOLVED | **0** |
| r9 campaign `--check` | green | **= (green)** |
| producer roster | 97 run, 0 red (both) | **0** |
| bounded set (43 files) | 537/537 → 531/537 (44 files: the 43 + the new fast file) | **6 rows, 4 files, all L40 press-kill pins** that read the process env: `hammerChooserPair` "853 at 5196" ON arm (the burn-stance ladder now names `bob@736,800`, not `bob@736,752`: text); `hammerOpportunisticStrike` "step 67" (the kill's strike cycles [604, 718] → [604]); `hammerPressKillGuards` "HO2 OFF" and "HO2 ON" (the press kill's death t788 → t785, still a death); `hammerRefugeBandText` "371 at 5266" and "371 at 5265" (a tick in the refusal 92 → 94 / 422). None is a solve lost |
| identity block | OFF = W0 on every row | **3**: empty pairs c3 `31dc4572` → `2d527877`, c6 `40d0a4c4` → `b6d7de6a`, carved pairs c4 `c9bdd11e` → `62bc5f69` (the generated levels' certify solves: spinners with the shield carried). Every other row, the six producer `--check`s and the reference unchanged |

**Flip readiness:** see § 2. The pins a flip moves: identity c3 / c6 / c4 (a re-record of the generated certify solves, the planner's licence) and the 6 bounded rows above (pinned OFF or re-pinned ON, as PKC and OPP did). No producer `--check` moves. All four files are hammer files (`hammerChooserPair`, `hammerOpportunisticStrike`, `hammerPressKillGuards`, `hammerRefugeBandText`), so no fidelity signature is needed.

## 6. D

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), OFF | **44 files, 537/537** (the 43 W0 files + `hammerSpinnerPress.test.js`; `d/bounded-off.txt`) |
| the hammer `.slow` files (`hammerSpinnerPress`, `hammerDashShape`, `hammerEscapeGenerated`, `hammerIceTurretStatic`, `hammerLatchWeigh`) | `hammerSpinnerPress.slow.test.js` locally 2/2. CI's slow battery at `03b4cf67` (run 41107230652): **28 files, 277/277**. It was also green at `76af24c7` (run 41099926340, 277/277) |
| `ci-producer-checks --jobs=4` OFF / ON | OFF **97 run, 0 red, 1 skipped** (re-run on a still tree, `d/producer-off2.txt`; the first OFF run printed 1 red = the battery's TREE-MOVED row, my doc edits landing mid-run, every producer exit 0, kept as `d/producer-off-treemoved.txt`) / ON **97 run, 0 red, 1 skipped** |
| identity block OFF (after) / ON | OFF = W0 on every row (`d/identity-off.txt`) / ON moves c3, c6, c4 (§ 5) |
| `census-seedling-solver-surface --check` | GREEN, 364 rows. `--write` re-wrote the table: the base was already stale by `levelRun.js` line moves (the xc-model merge; `--check` at the clean base: DIFFERS, the same byte count). New rows classified: `import:playerShieldRect` (`seedling` / `geometry-query`). The sink's equips read is `run.ledger('equipsFired')`, as the fold requires |
| `census-seedling-constants --check` | PASS (7015 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (the docs index's word counts: the two doc additions); ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, swiftshader) | **ALL PASS** (unloaded, `d/wasm-ship-unloaded-tail.txt`). A first run under load with my outer 900 s timeout cut the campaign stage's driver (211 cascaded FAILs, rc 124); the re-run alone passed |
| JSUT (CI at the pushed head) | run **41107230652** @ `03b4cf67`: **24351/24351** (3 shards green) and the slow battery 277/277. At `76af24c7` (run 41099926340) one row was red: `procgenDocs/generated.test.js` (the docs index's word counts, not yet regenerated); fixed by `03b4cf67` |
| `seedling-bot.md` | the switch named (OFF) and what it does, after OPP's paragraph |
| `seedling-bot-log.md` | `### Seedling hammer-phase SPIN — the press kill of spinner@816,848` |

## 7. What the harvest A/B should expect

- **OFF: no movers.** The switch is read in one place, after the no-claim OFF returns, and the sink is `null`. Every
  OFF digest re-measured equals W0's. The bounded set OFF is 537/537, the roster OFF 0 red, the identity OFF = W0, CI green.
- **ON (the planner's sweep / survey A/B):** the page's worker has no `process`, so the switch is OFF in the browser.
  An ON sweep needs a build or flag that sets it (L40C's CPAIR-3 note applies the same way). Expect, at the defaults:
  366/0 (Totem 64,144) shorter with one bomb hit fewer, 382/0's refusal text; under A5 382/0 (Chest ← L39) shorter.
  In node, ON also moves three identity rows (empty pairs c3 / c6, carved pairs c4) and 6 bounded rows (§ 5).
  860 reaches the kill of `spinner@816,848` only with the deadline lifted (10240), and then meets the deadline inside
  ICEST's kill. Because the walls are seam-dependent, a sweep's 860 row moves only at the phases where the press kill
  is reached.

## 8. What the brief got wrong (measured)

- *"With ICEST (A5, … 10240): the chain reaches `kill (iceturret@472,400)` → staging (up) → `kill (spinner@816,848) by
  press` and refuses …"*: at main's capture (seam 5102) it does not. ICEST is never handed, and A5 = A5 − ICEST, the
  ladder on the spinner's body. The wall is a phase: it reproduces exactly at L40C's seam 5950, and the seam is the
  page's wall clock, so a fresh capture can land elsewhere.
- *"Without ICEST: … the combat ladder exhausted on `spinner@816,848`'s body at (718.6,682.8)"*: at 5950, yes. At
  5102 at (709.4,678.5), horizon 217.
- *"Leg 861 (← L43) stops the same way at (599.1,678.5)"*: at main's 5117, A5 − ICEST 10240 stops on the ladder at
  (743.7,724.4) on the spinner's HAMMER (horizon 318), and A5 on ICEST's "no side". At 5425, A5 10240 is the deadline,
  and **861's `spinner@816,848` press kill completes even OFF there** (t3113/3188/3225).
- *"Find why every key set lands on the 7x7 rect or the 13 px hammer line at (770.96,860.99)"*: the brief's candidate
  causes (the stance, the strike window, the press timing, the landing point) all point at the walk. The walk was
  already lost at the press: the escape that should have refused that press makes no claim under a carried shield.
- *"Re-capture the L40 requests (L40C's recipe)"*: the recipe gives 52 legs / **59** requests at this base (L40C 61).
- The brief puts the fix in `execKillByPress*` / `pressKillGuards.js`. It lives in `pressEscapeOnce` (the press
  kill's escape, called by its aim and by `deriveStrike`), with the switch in `pressKillGuards.js`. `pressEscape` is
  not on the out-of-scope list; say if the planner reads it otherwise.

## 9. Residue and hand-overs

- **To fidelity (the honest fix is theirs):** `levelRun.spinnerForecastWithPress` (and `spinnerFightForecast`)
  report `shieldBumpNow` as unmodelled for ANY inventory with a shield. Modelling the plain shield bump in the
  forecast (a knockback by `SHIELD_FORCE` when `shieldBumpTouches`) would make the escape exact under the shield,
  with no envelope and no bump-blind claim. This slice's switch is the solver-side stand-in until then.
- **To the planner:** the game witness of ON's 860 kill (wasm / TT). The keys are reproducible with
  `tools/witness.mjs` (A5, `SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1`, `SPIN_SEAM=5950`, `L40C_BUDGET_WORK=10240`). Also
  the sweep / survey A/B ON (the page needs a flag), and a seam census of 860 (45 phases) ON vs OFF. This slice
  measured three seams (5102, 5947, 5950), not the period.
- **To APPROACH / CPWIT:** what 860 meets next is ICEST's own kill (`kill (iceturret@472,400)`) running out the
  10240-unit deadline. Without ICEST, the ladder on the spinner's body on the weigh-stance walk is the chooser's.
- **The box lock:** commit `76af24c7` was made under `BOX_LOCK_COMMIT_ANYWAY=1`. The lock was this session's own L40
  capture. A commit does not change the working tree the page serves, and the page runs the switch OFF.
- **A contaminated job, re-run:** one matrix job (`860:A5-IC:10240:-:on`) started inside the mutant window (17:00:19,
  under "drop the fix"). Its rows are kept as `i/CONTAMINATED-…` and the job was re-run clean.
- **Not measured here:** game witnesses; the unfiltered vitest (⚖ 52); the six other L40C arms ON (only A0 and A5).
- **Not committed:** the captures (the BK2 capture is 1 MB, the L40 capture larger), the survey JSONs; the 860/1
  request is committed as the test fixture.
