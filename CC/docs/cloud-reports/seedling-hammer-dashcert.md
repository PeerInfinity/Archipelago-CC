# seedling-hammer-dashcert — the whole-dash certificate passes a corridor the drive is hit on

Slice DASHCERT of the hammer phase (`seedling-hammer-dashcert`), cloud, Opus. ⚖ The user queued it on 2026-11-02, one of
five parallel hammer slices. Planner: `seedling-hammer-phase-planning-2`. No mid-run message changed the scope.
Evidence: [`seedling-hammer-dashcert-evidence/`](./seedling-hammer-dashcert-evidence/). Log: `seedling-bot-log.md` §
*Seedling hammer-phase DASHCERT — the whole-dash certificate sees the swing's line of sight*.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `6d9f991739` (`origin/main` at checkout) |
| Head | the commit carrying this report. The last code commit is `dda5608a`: W0 `a5af7348`, I `4d1cdc25` + `65e1916b` + `dda5608a`, D `3d1fbf89` + `13f84ac3` + `1dfa8529` |
| Branch | `claude/seedling-hammer-dashcert-8tp7sx` (the harness named it; the brief's `seedling-hammer-dashcert`) |
| Measured with fidelity's key | every `fineStanceWalk` answer comes from a throwaway worktree: main `6d9f991739` with `origin/claude/seedling-fidelity-l100-lattice-4h9hax` (`6fcccce4f9`) scratch-merged (one conflict, `seedling-solver-surface.json`, taken from main), then this slice's diff applied. Nothing from that branch is on mine |

## 2. The answer first

**The one thing to know first.** The certificate is not wrong about the walk it previews. **The preview walks a
different room from the drive**, because `previewWalk`'s chaser swing arm has no line-of-sight gate. The run got that gate
from fidelity MASKS D2 (`pixelMaskSightLines`, ON). The preview never did, and neither did the forecast's `hit`
(`levelRun.js`). At step 216 the gap is two ticks on one jellyfish, and that is enough to make the two walks part.

| question | answer (measured) |
|---|---|
| Why does the whole-dash certificate pass a corridor whose drive is hit? | The preview lands the t48 press on `jellyfish@80,16` at **t50**. The run refuses t49 and t50 (`collideLine("Solid") meets tile:Cliff`) and lands it at **t51**. The two i-frames then run 2 ticks apart. At t81 the preview's scheduled dash is certified (that body's `hitsTimer` is 29 in the preview), and the drive's own `certifyDash` yields it (`hitsTimer` 1: *"EXPIRES MID-DASH"*). The positions part at t82, and the drive meets `jellyfish@80,112` at t125 in a room the preview never had |
| What does the preview see differently at t125? | Everything, by then: it is 36 px from the drive (preview (106,28), drive (97,64)). The first difference is at t50, and it is not the dash's timing or the knockback model. It is a swing the game refuses |
| (1) certify on the drive's model | **The fix.** Ask the run's own line test in the certificate's previews. Step 216: 327 t, hitless, preview = drive at every sample, game-witnessed |
| (2) bill chaser contact | Already done (`probeSamples` reads each sample's chasers). It bills nothing because the preview's room has no contact. Not a fix |
| (3) refuse the dash where the certificate cannot see a mobile | Measured as "refuse the whole chain when one of its preview swings is line-blocked". **Not a fix**: the window-by-window fallback is just as blind and plans the same hit (731 t, UNBILLED) |
| (b) can the certificate reuse one preview per corridor? | It already does: the whole-chain check is one preview per corridor. The ~60 s / ~105 s is the press-blind `planSwordDash` **scan**: 43.5 of 44.7 s (step 172, 3,860 previews) and 87.2 of 88.8 s (step 200, 5,256 previews). That is ~4 whole-walk previews per candidate start over a ~1,000-tick corridor, and it ends with no plan. Not fixed here (§ 9) |

**Before → after.** Step 216 with `fineStanceWalk` ON and `unbilledDamageGate` ON:
- before: *UNBILLED DAMAGE … [t124 (run t125, L100) chaser:jellyfish@80,112]*; at the defaults, SOLVED 731 t with 1 hit and 1 re-plan;
- after (`DASH_CERT_SIGHT` ON): **SOLVED 327 t, 0 hits, 0 re-plans, L101**. The game agrees at every tick.

## 3. W0 — reproduce

| row | result |
|---|---|
| base | `git checkout -B claude/seedling-hammer-dashcert-8tp7sx origin/main` → `6d9f991739`. `session_bootstrap.sh --seedling` → `READY`, node v22.23.4. The five `-` submodules (cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine) were initialised before any gate |
| (a), the verdict | `seg219.mjs` (L100LATTICE's tool) with the key ON: SOLVED 731 t, one hit at t125 by `jellyfish@80,112`; with the gate ON, UNBILLED DAMAGE. The t0 walk row: `swordDash` 217 t vs 275 t baseline, 8 windows, `why` "certified whole (fidelity L40BK2)" (`evidence/w0/a-reproduce.txt`) |
| (a), first parting | With the scratch patch recording the certificate's preview samples (`tools/scratch-instrument.patch`, `part216.mjs`), the preview's sample at tick k equals the drive after k−1 advances, exactly, through t82. The positions part at **t83** (Δ1.41 px); the held sets part at t82 (preview `right+up+primary`, drive `right+up`) (`a-parting.txt`) |
| (a), why the held sets part | The two strike policies (same plan object, `dec216.mjs`) agree through t80. At t81 the preview's policy presses the scheduled dash and the drive's yields it: `jellyfish@80,16`'s `hitsTimer` is 29 in the preview and 1 in the drive (`a-policies.txt`) |
| (a), why the body differs | `j16.mjs`: the body is equal on both sides through t49. The preview strikes it at **t50** (`hitsTimer` 30), the drive at **t52** in the policy's reading (= landed in the run's t51 advance). `press216.mjs` reads the run's own swing ledger: t47 and t48 out of reach; **t49 and t50 `collideLine("Solid") meets tile:Cliff`**; t51 landed (`a-jelly16.txt`, `a-drive-swings.txt`) |
| (b) | M4 (`SCR_M4=1`: the D1b axis rule off) with a timing patch in `spinnerDashWhole`. Step 172: 1066 t, 44.7 s, of which the blind scan 43.5 s (3,860 previews), whole 0 ms (no plan: never reached). Step 200: 1416 t, 88.8 s, blind 87.2 s (5,256 previews) (`b-step172-m4.txt`, `b-step200-m4.txt`) |

## 4. M — the design check

The fix point. The run's chaser arm (`levelRun.applyThrust`, under `pixelMaskSightLines`) asks `collideLineSolid(state.x,
state.y, c.x, c.y, {masks: true})` after the reach and before `enemyHit`, and a Flyer waives it. The preview arm
(`solverBot.previewWalk`, the only caller of `chaserForecast().hit`, measured by `grep -a`) asks the rect and the reach, then
hits. `run.collideLineSolid` is exported by the run, so the preview can ask the same test with no `levelRun.js` edit.

| design | step 216 (key ON, gate ON) | route survey, defaults | scope |
|---|---|---|---|
| (1a) the line in EVERY preview (scratch) | SOLVED 327 t, 0 hits; preview = drive at every sample | not run (wider than the brief's region) | every walk probe, kill preview, stance check |
| **(1b) the line in the certificate's previews only (shipped)** | **SOLVED 327 t, 0 hits; same keys as 1a** | **identical, 237 / 237** | `spinnerDashWhole`'s blind scan, its whole preview, its fallback |
| (2) bill chaser contact | already in `probeSamples`; 731 t + UNBILLED | — | — |
| (3) refuse the whole chain on a line-blocked preview swing | **731 t, 1 hit, UNBILLED** (the fallback is equally blind) | — | — |

Why (1b): it is the certificate's own fix, and the chain it certifies is the chain driven (⚖ 30(c)). (1a) is the honest
model fix for every preview and is handed over (§ 9). Its radius is unmeasured.

**Radius measurements** (`evidence/m/`):
- **Route survey, defaults, OFF vs ON** (`survey-main-off-vs-on.txt`): **0 movers**, 201 solved both ways.
- **Route survey, `fineStanceWalk` ON both arms, OFF vs ON** (`survey-lattice-off-vs-on.txt`): **1 mover, step 216**.
  731 t / 1 hit / 1 re-plan → 327 t / 0 / 0, L101 both. 202 solved both ways.
- **Audit, defaults ON** (`survey-audit-on.txt`, `tools/audit-preload.mjs` in every solve process):
  - 411 certificate asks, 330 whole-chain previews, all 330 certified.
  - **1,831 swings refused on the line**, in 4 solve processes (one alone refused 1,817 in a single ask).
  - None of it changes a verdict, a tick or a hit (the survey with the audit installed = without).
- **L12 172 / 200 (M4)**: the cost is in the scan, which the switch does not touch.
- **L40 requests**: the 870 captured page requests (sweep `38845773709`) are not reachable from a cloud session (no
  artifact download here). L40 is covered by the bounded set (`solveProgress`'s L40 kill rung, the `hammerDashWindow` L4 /
  L20 / leg 108 rows, `fidelityL40Bk2`) and the slow hammer files, all green ON. The planner's sweep is the population row (§ 7).
- **r9**: the identity block's `solve-seedling-r9-campaign --check` is `be9c19c8`, exit 0, ON and OFF.

## 5. I — the fix

**The switch.** `solverBot.DASH_CERT_SIGHT` (`SEEDLING_DASH_CERT_SIGHT=1`, `withDashCertSight(enabled, fn)`), **OFF**, beside
`DASH_STAND_WHOLE`. Its docblock carries the user's queueing.
- ON, `spinnerDashWhole` raises a module depth around its whole body (`spinnerDashWholeAsked`, the old body unchanged).
- In `previewWalk`'s chaser arm: if the depth > 0, `CONTACT_FIDELITY.pixelMaskSightLines` is ON and the body is not a
  Flyer, then `dashCertLineBlocked` asks `run.collideLineSolid(…, {masks: true})`. A blocked line is not a hit.
  - A run without the query fails by name.
- OFF: the depth is 0 and the gate is one false comparison. Byte-identical: the survey, the producers, the identity block
  and the bounded set are equal.
- **Fidelity's key is never read.** The switch is inert to `fineStanceWalk` in both directions: it is OFF-identical on
  main and on the scratch merge (the lattice survey's OFF arm = L100LATTICE's ON survey: 202 solved, step 216 731 t).
- `counts` (`asks`, `refused`) and `audit` (null) are the measurement's sinks. The whole check computes the probe once;
  it calls it only where it always did (an arrival) or for an installed audit.
- `SEEDLING_DASH_CERT_SIGHT` joins `solverEnvChannel.SOLVER_ENV_NAMES`.
- No strategy gate is involved: no new kill arm or rung.

**Rows** (`hammerDashCert.test.js`, fast tier, ~1 s on main / ~14 s with the key):

| row | holds |
|---|---|
| ships OFF | `enabled` false (skipped under the env) |
| the witness replays on the model | `fixtures/dashcert-witness/step216-on.json` (10.9 KB): 327 t, 0 hits, L101, the game's own end |
| a clean corridor is OFF exactly | step 216 with no fine walk (main's 16 px break walk): the certificate is asked (asks > 0) and refuses no line (0). Same refusal and same keys ON and OFF |
| ON with `fineStanceWalk` (**skips by name where the key is absent**, i.e. on main today) | OFF → UNBILLED DAMAGE `chaser:jellyfish@80,112`. ON → no error, refused > 0, keys = the witness tape's key for key, 0 hits, L101 |

**Game witness** (`evidence/i/witness-step216-on.txt`). p4g headless, `probe-seedling-chaser-mobiles --class=Jellyfish
--player-hits --frames`, port 9771:
- the sample clock fits at shift [0];
- Jellyfish: 1,103 comparisons, worst |Δ| 0;
- `cmp216.mjs` (L100LATTICE's tool): player 0 px at all 327 ticks, the game's `hits` never steps, and the game is in L101 at t327.

**Mutants** (`evidence/i/mutants.txt`; copy + restore in the scratch tree):

| mutant | predicted | measured |
|---|---|---|
| m1 the old certificate restored (depth not raised) | the key row red | **1 red**: that row |
| m2 the chaser not billed (the whole check's samples with `chasers: null`) | a red | **0 red**. No whole-chain preview on the route meets a chaser (audit: 330/330 certified, no danger kinds), and step 216's certified walk is hitless. The billing half has no catcher (§ 9) |

**The ON radius, by mover class:**

| radius | ON movers | class |
|---|---|---|
| route survey, defaults (237) | **0** | — |
| route survey with `fineStanceWalk` (237) | **1**: step 216, −404 t, −1 hit, −1 re-plan | ticks/hits (fixes the unbilled hit) |
| bounded set ON (34 files) | 0 (837 pass, 2 skipped: both "ships OFF" rows) | — |
| producers ON (`ci-producer-checks --jobs=4`) | 0 of 97 | — |
| identity block ON | 0 (every row = OFF = the published values) | — |
| the L100LATTICE flip's two re-records (`l100-sliver-rock`, `rulesref-l66-door`) | not measured ON. They are step 168/sliver plans; step 168 is not a survey mover ON | — |

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52), defaults | **34 files, 838 pass / 1 skipped** (`evidence/d/bounded-off.txt`; list in `bounded-files.txt`: every test naming the dash surface, the certificate, `pixelMaskSightLines`, `solveProgress`, `solverDeadline`, `ShouldStop`, `fidelityLapseCost`, + this slice's file) |
| bounded vitest, switch ON | **34 files, 837 / 2 skipped** (`bounded-on.txt`) |
| the hammer `.slow` files + `jsRuntimeSolverCalibration.slow` (serial, locally) | 5 of 8 green (`hammerSouthDoor`, `jsRuntimeSolverCalibration`, `hammerLatchWeigh`, `hammerTurretApproach`, `hammerSpinnerPress`) before my own 1 h timeout stopped the run. `hammerDashShape`, `hammerEscapeGenerated` and `hammerIceTurretStatic` were not reached locally; CI's slow battery runs them (below) |
| `ci-producer-checks --jobs=4` | defaults **97 run, 0 red**, 1 skipped; ON **97 run, 0 red**, 1 skipped |
| identity block (`SEEDLING_PORT=9771 identity-block.sh .`) | OFF: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated OK, the six producers `7486f32e` `93f75467` `88e33db7` `35456fbc` `6cd35fe1` `be9c19c8` exit 0, reference ALL MATCH. **ON: identical** |
| `census-seedling-solver-surface` | `--check` red on counts (`run:collideLineSolid` 12 → 14, `CONTACT_FIDELITY` import 174 → 175, `run:level` 178 → 179, the audit's read) → `--write` → GREEN 371 rows, **no new row** |
| `census-seedling-constants --check` | PASS, 7,045 literals, 0 drift |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README, docsIndex) → ALL CHECKS PASSED |
| `quicklaunch/generate-docs-index.mjs --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (`--host=http://127.0.0.1:9771`) | ALL PASS |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | 32 / 32 |
| **JSUT** | `4d1cdc25` (run `41392363873`): 25,269 pass / **1 failed** / 1 skipped, slow battery **365 / 365**. The one red was shard 1, most likely the surface census I committed red there and fixed in the next commit `65e1916b` (I did not pull the failing name out of the log). The later runs are below |
| not run | pytest, unfiltered local vitest (⚖ 52), `standing-values --write`, any dispatch (cloud: 403) |

JSUT at the later heads (`13f84ac3` run `41399366402`, `dda5608a` run `41406437270`) were still running when this report
was written. The planner reads them with `node scripts/procgen/ci-summary.mjs --run=41406437270`.

## 7. What the harvest A/B should expect, and the ON sweep to run

- **OFF: no movers.** Survey identical, producers 0 red, identity block equal. The OFF path is the old call plus one false
  comparison per preview swing.
- **ON at main's defaults: no movers expected.** Survey 0 movers. The audit says the line refuses 1,831 swings in 4 solves
  and changes nothing on the route.
- **ON with `fineStanceWalk`: step 216 / leg 914** goes from 1 unbilled hit to 0 (731 → 327 t).

**The exact ON sweep dispatches** (`seedling-divergence-sweep.yml`, on `claude/seedling-hammer-dashcert-8tp7sx`, the full leg
list, `keys` empty, `contact_fidelity` empty):
1. ON arm: `solver_env=SEEDLING_DASH_CERT_SIGHT=1`.
2. OFF control: `solver_env` empty.
3. **The flip-partner arm.** On a scratch commit that merges `origin/claude/seedling-fidelity-l100-lattice-4h9hax` into this
   branch: `contact_fidelity` = L100LATTICE's `evidence/sweep-on-arm.contact_fidelity.txt` string (the 105 default-ON keys +
   `fineStanceWalk`) with `solver_env=SEEDLING_DASH_CERT_SIGHT=1`, and again with `solver_env` empty.
   - Expected: leg 914 (`level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 -> exit:out_teleporter_288_96`) done in both
     arms, hitless only with the switch.
   - Watch any page-budget leg whose time moves: the certificate's line test adds one `collideLineSolid` per in-reach
     chaser per swing test.
- Survey A/B: `seedling-survey.yml` at the head, and on the same scratch merge with the switch ON. `through=end route=full`
  (cheap variant `only=216`).

## 8. What the brief got wrong (measured)

1. *"What does the preview see differently at t125 (the jellyfish's state, the dash's timing, the knockback)?"* None of
   those, at t125. The walks parted 43 ticks earlier, and the root is 77 ticks earlier: a line-of-sight refusal on a
   **different** jellyfish (`@80,16`, not `@80,112`). The preview never asks the line.
2. *"(b) can the certificate reuse one preview per corridor instead of one per chain link?"* It already uses one. The
   cost is `planSwordDash`'s press-blind scan (98 % of the time on both L12 steps). The whole-chain preview is not reached
   on those corridors at all (no plan).
3. *"(2) bill chaser contact in the certificate"*: it is already billed. The preview's room had no contact to bill.
4. *"Mutants: … the chaser not billed"*: on this route it has no catcher. No whole-chain preview meets a chaser.

## 9. Residue and hand-overs

1. **The line in every preview** (design 1a): `previewWalk`'s chaser arm lacks MASKS D2's gate for every caller (walk
   probes, kills, stances), not only the certificate.
   - It is a preview ≠ drive gap of the MASKS key. Fidelity's call (`pixelMaskSightLines` is theirs); the planner routes it.
   - Its radius is unmeasured. The scratch measured step 216 only.
   - The forecast's own `hit` (`levelRun.js`, out of my bounds) has no line either. Today `previewWalk` is its only caller.
2. **m2's catcher.** No route corridor exercises the certificate's chaser billing. A generated room with a chaser crossing
   a dashed chain would be its row.
3. **(b) the scan's cost.** `planSwordDash` previews ~4 whole walks per candidate start (O(N²) on a long corridor).
   Previewing a candidate from a mid-walk snapshot would cut it, but needs the preview's state (chaser forecast, sword
   window, policy) to be resumable. A dash-search question; L100LATTICE's D1b keeps it off the shipped path.
4. **The `fineStanceWalk` flip.** This switch is its partner for (a). The flip packet would flip both, or flip this one
   first (it is inert on main).
5. **Tree hygiene.** The scratch worktree (`<scratchpad>/wt-lat`) and the server on :9771 are removed / killed by path and
   PID at session end. The survey JSONs and audit sinks stay in the scratchpad (too large for the tree); their diffs are in
   `evidence/m/`.
6. **Out of scope, untouched:** fidelity's files, the strike policy, the press escape, the hold stance, `levelRun.js` /
   `dangerMap.js` / `botDriverV*.js` / `iceTurret.js` / `flashPanel/*`, `strategySwitch.js`. No switch flipped, and no
   fidelity row needs signing.
