# Seedling fidelity L32BOB: the L32 Bob encounter's fight forecast vs the run

| | |
|---|---|
| session | `seedling-fidelity-l32bob` (wave 32, planner `seedling-fidelity-planning-14`) |
| harness branch | `claude/l32-bob-encounter-forecast-2tgmvs` |
| start SHA | `1e17f44738` (main, W31 landed; 85 default-ON keys, counted on `contactFidelity.js`) |
| head | `3f7e8a88` + this report (D1 `d4336689`, D1 records `f32af2d8`, D2 `5a69e96b`, records `9e87a666` (log + evidence), `3f7e8a88` (docs index regenerated)) |
| verdicts | **W0 PASS · D1 PASS (new key OFF, byte-identical) · D2 PASS (every L32 staging solves ON) · movers: none measured, STOP with the list** |

**The one thing to know first:** the decline is not a corpse-fade residue (MISCRES). It is a **swing already in flight**.
Every L32 staging solves from its boot. A solve that starts *inside* a swing declines: that is a continuation whose prefix
ends within 5 ticks of a press, which is what the JS page's replan produces. The run fires that swing's remaining hit
tests (`Player.slash()` tests on every tick `slashing` is up), and one of them lands. The forecast started from an empty
test map and never saw it. The game agrees with the run. With `encounterSwingInFlight` ON, all 140 in-swing continuations
of the four L32 stagings solve.

## W0: the decline, reproduced and attributed (PASS)

**Every L32 staging solves from boot, at the base, both ways the JS arc stages it.**
- The JS core (`createJsRuntime` + `setVanilla`, `new_instance Game` at L32, `solveFromTape` on the session as the solve
  service runs it, `dashless` and full passes). Items sword+shield, +torch at (64,112), +dark shield, +Fire, sword alone:
  all SOLVED (825–839 ticks).
- The tapes' own stagings (`swim-u5-bobboss-encounter`, `enc-l32-live-arrival`, `r9-solve-32`, `enc-l32-fallen-door`,
  `r1-dark-shield-bobboss`, `apb-l32-fresh-fire-held`), with scratch persistence on and off, dash `none` and default: all
  SOLVED.

**The decline is a continuation's.** Re-solving the U5 plan from every 10th tick of its own plan:
`evidence/sweep10-u5-off.txt` gives 82/83 solved. **k 380** declines: *"the forecast landed form 1's hit at +58 and the
run's boss reports 2 landing(s) — the forecast and the run disagree."*

**The first disagreement, tick by tick** (`evidence/tools/w0d.mjs`: the solve's own ticks re-played to its strike search
at t380, then the forecast and the run stepped side by side on the plan's keys):
- At the seam: `slashing` is up (`slashTimer` 17, `endsAt` 381). The tape's press at **376** is still testing; its window
  holds the T+4 and T+5 repeats (t380, t381).
- **+0 (t380):** the run's T+4 test meets the boss's i-frame (`boss-hit … why: hitsTimer`).
- **+1 (t381):** the run's **T+5 test LANDS**. Form 1 goes from 1 hit to 2, with i-frames 30. The forecast has no test at
  +1, so its form 1 stays at 1 hit with i-frames 0. Positions agree throughout.
- **+58:** the forecast's own press lands, and so does the run's. That is 2 landings against an expected 1, so the
  executor declines.

The forecast is the side that is wrong. `forecastEncounterPlan` seeded the slash STATE from `slashInfo`, but its `tests`
came from an empty map; it never read the run's `swordWindow`. (The hammer's spinner forecasts do read it, at
`levelRun.js` `win: swordWindow`.)

**Game witness (p4g, headless, port 9743).** `probe-seedling-encounter-ticks.mjs --tape=apb-l32-fresh-no-fire --from=370
--to=560` (`evidence/game-probe-apb-l32-fresh-no-fire-t370-560.txt`): 191 sampled ticks, game and model boss rows at
**0 px**, drained stream worst |Δ| 0. Form 1's death flight starts at **t426** on the game, after its third landing at 425.
The model's ledger has form 1's landings at 351 (press 348), **381 (press 376, its T+5)** and 425 (press 420); no other
press lands in form 1. Without the 381 landing there is no death at 426. **The game agrees with the run.**

**What the brief's numbers were:** the JS arc's text was *"+11 … 0 landing(s)"*, measured 4×. I could not reproduce that
shape at this base from any staging I could build. Every decline I reproduced reads "+57/+58/+59 … 2 landing(s)": 12 of
them, 3 per staging × 4 stagings (the census below). That fits "4×" if the JS arc's four were one per staging. If its
"+11 / 0" text is a distinct case, it is outside what I measured. Hand the planner the JS arc's captured request for it
(`capture_requests`) and replay it ON with `replay-seedling-solve-request.mjs`.

**Banks** (`evidence/identity-w0.txt`, a pristine worktree at `1e17f44738` served on 9744; `identity-after.txt`, this
tree with the key OFF):

| row | W0 (base) = AFTER (OFF) |
|---|---|
| identity | maze `57e07d21` · acceptance `cf54cdf7` · c3 `31dc4572` · c6 `40d0a4c4` · **c4 `c9bdd11e`** · ENEMY `f0bec576` · guard `a6d18d49` · AREA `02b22525` · killgate `7c15ed57`/`47116405`/`4d3bbf17` · levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | battery `da331da7` **exit 1** · d2-chain `8be1a293` **exit 1** · l18 `b8d8452a` **exit 1** · tail `35456fbc` 0 · r9-l3 `6cd35fe1` 0 · campaign `e69370f6` **exit 1**. Identical md5 at base and after; see "what the brief got wrong" |
| generated set | not measurable on this box (the venv's playwright 1.56, the pin 1.63) |
| reference | 4 DIFFER at both (the box artifact, as in W31) |
| surface / constants | surface GREEN 353 after `--write` (it records the new imports and `CONTACT_FIDELITY` sites) · constants PASS |
| bounded vitest BEFORE (base) | 97 files: 2,584 passed / **1 failed**: `seedlingAtlasArm` (environmental, as in W31) |
| bounded vitest AFTER (defaults) | 98 files (+ `fidelityL32Bob`): 2,590 passed / 2 failed. These are `seedlingAtlasArm` and the surface census, which went green after the `--write` (committed `f32af2d8`) |
| bounded vitest key ON | 98 files: the same `seedlingAtlasArm` red. `contactFidelity`'s defaults row read the env hook; it now skips under `SEEDLING_ENCOUNTER_SWING_IN_FLIGHT`, as it does under every per-key hook |
| slow `fidelityL32ArenaPrefix` | 5/5 OFF, 5/5 ON |

The bounded set is the brief's list plus every test that `grep -a`s `bobBossForecast`, `searchEncounter*`, `bobBoss`,
`apReportBosses` or the decline text (`evidence/vitest-files.txt`).

## D1: fix the wrong side, the forecast (PASS, OFF)

**The change.** The new key is `CONTACT_FIDELITY.encounterSwingInFlight`, OFF, with `SEEDLING_ENCOUNTER_SWING_IN_FLIGHT=0|1`.
- `levelRun.bobBossForecast()`: with the key ON it returns `window: swordWindow` (the run's own window object; it is
  immutable, because `swordWindowStep` returns a new one). `slash(b, p, direction, scale = SLASH_SCALE_NORMAL)` now takes
  a thrust's own scale, so a dash's remaining tests use the dash's rect and reach. With the key OFF there is no `window`,
  and every caller passes three arguments, as before.
- `solverBot.forecastEncounterPlan`: with the key ON, it steps that window at the top of each tick
  (`swordWindowStep(win, t0 + k)`), as `advance` steps it. Each fired thrust is tested with `fc.slash(…, th.direction,
  th.scale)`. The plan's own press replaces the in-flight swing's remaining tests and schedules its own
  (`swordWindowSchedule(swordWindowReplace(win), …)`), which mirrors `advance`'s two places. Every landing through the
  plan's own press's is counted (`landings`).
- A thrust in flight that is not a sword's is not modelled here. That plan is not taken; it counts as a touch at that
  tick, as a previewed death does.
- `searchEncounterStrike`: with the key ON, the plan carries `landings`. `execBobBossEncounter` checks
  `after === before + (plan.landings ?? 1)`. With the key OFF, the decline text is unchanged.

**Witness.** The game, as in W0. The model's run was already right, so no model state changed, and with the key OFF the
forecast is byte-identical.

**Gate:** `fidelityL32Bob.test.js`. Its rows: the default OFF; W0's three landings in form 1 on the tape (348→351,
376→381, 420→425); the seam is inside the 376 swing; with the key OFF, the continuation declines by the old text and the
forecast has no window and no count; with the key ON, the plan counts 2 landings at n 40 / +45 (its boss now sits in the
in-flight landing's i-frames, as the run's does), and the continuation solves in 459 ticks with both reports, untouched,
still in L32.

**Mutants** (predicted first, made by copy and restore, md5 restored; `evidence/mutants.txt`):

| mutant | predicted | measured |
|---|---|---|
| m1 `win` seeded EMPTY with the key ON (the window ignored) | the "ON: counts 2" and "ON: solves" rows red | exactly those 2 red |
| m2 the press does not replace the in-flight window | **not caught** at k 380 (the swing's last test is t381, before any press) | 7/7 green, as predicted |
| m3 the executor compares against 1 | the "ON: solves" row red | exactly that row red |

m2 is a real gap in the gate. The census below is its only net, and it does not isolate it either.

## D2: the solve, with the forecast agreeing (PASS)

**The census** (`evidence/census-in-swing.txt`, `tools/w0g.mjs`) took every prefix of each staging's own solved plan that
ends with `slashing` up and a live boss: 4 stagings × 35 prefixes. Each was solved with the key OFF and ON, the way
`solveFromTape` does (scratch persistence, dash `none`, the prefix handed over).

| staging | in-swing prefixes | OFF declines | ON |
|---|---|---|---|
| `swim-u5-bobboss-encounter` | 35 | k 379, 380, 381 (+59/+58/+57, 2 landings) | 35/35 SOLVED |
| `enc-l32-live-arrival` | 35 | k 372, 373, 374 | 35/35 SOLVED |
| `enc-l32-fallen-door` | 35 | k 378, 379, 380 | 35/35 SOLVED |
| `apb-l32-fresh-fire-held` | 35 | k 379, 380, 381 | 35/35 SOLVED |

The U5 plan sampled every 10 ticks with the key ON (`sweep10-u5-on.txt`): 83/83 solved; the key OFF gives 82/83. With the
key ON, some in-swing prefixes that already solved get a different plan length (e.g. U5 k 67 778→772 and k 94 745→761),
because the forecast's boss is now the run's. There are no new refusals.

**Gate:** D2's four rows in `fidelityL32Bob.test.js`, one declining seam per staging, continued from the committed tape.
With the key OFF each declines by name; with it ON each solves with {32,3} and {32,4} reported, untouched, still in L32.

**The next refusal.** From these stagings, the Bob encounter itself has none with the key ON. The route's next refusal at
L32 is survey step 40's second goal: `encounter(Level 032 - Times → Seal)` refuses *"the arena's exit
(burnabletree@64,0) burns only with Fire, and under `apReportBosses` the Fire pickup grants …"*. It reads the same with
the key OFF and ON. By ⚖ the user's 2026-10-20 ruling (no special-case grants; L32's stairs are open since the rock
move), I read that as a correct item refusal, not a gap.

## Movers (STOP with the list: there are none)

Only two callers reach the change: `execBobBossEncounter` (the L32 encounter goal) and its `untilKill` arena prefix.
Measured with the key ON against OFF:

| surface | result |
|---|---|
| `plan-seedling-encounters.mjs --check` (all 8 L32/L12/L43 encounter tapes) | exit 0, 31/31 PASS with the key ON |
| `plan-seedling-r1-dark-suit` / `r3-death` / `r5-bobboss` / `u11-dark-shield` / `r5-swim` `--check` | exit 0, output md5 equal OFF/ON (`producers-onoff.txt`) |
| `solve-seedling-r9-campaign --check` (holds `r9-solve-32`) | exit 1 with the key OFF and ON, output md5 equal (`e69370f6`), the base's own red |
| identity block, the key OFF | md5-identical to the base, row for row |
| survey step 40 (the only L32 step, `--route=full`) | JSON equal OFF/ON (timings stripped) |
| arena-prefix legs 349/350 (`seedling-fidelity-l32arena-evidence` requests) | `replay-seedling-solve-request` ROWs equal OFF/ON (both passes solve, 1008 t) |
| bounded vitest + slow arena prefix | no red from the key |

No committed tape and no producer `--check` digest moves with the key ON, and no bounded vitest row moves. **The flip is
yours.** From-boot solves never start mid-swing, so the expected movers are JS-page continuations only.

### Please run, on `claude/l32-bob-encounter-forecast-2tgmvs`

Arm A is `contact_fidelity=` the 85 keys of `evidence/arm-A.txt`. Arm B is the 86 keys of `evidence/arm-B.txt` (A plus
`encounterSwingInFlight`).
1. **Survey full:** `seedling-survey.yml` with `through=end`, `route=full`, arms A and B. Compare with `40250392329` by
   (level, goal, boot). Expected: equal (step 40 measured equal locally).
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with `keys=` the 18 keys of `evidence/sweep-keys.txt`, joined with
   `|` (every leg in or out of L32, derived at this base), `capture_requests=true`, arms A and B, twice. Expected: no
   key-driven verdict, since a sweep leg's solve starts at an arrival, not mid-swing.
3. **Probes:** `seedling-probe.yml battery=standard` with arm B (and A as control). Expected 11/11 and no move.
   Logical-links B passes L32 (the arena prefix).
4. **The JS arc's own decline:** its captured request for the 4× decline, replayed with
   `replay-seedling-solve-request.mjs` with the key ON. If it was the "+11 / 0 landings" shape and still declines, that
   is a second class this slice did not see.

## The JS arc: pins and wiring

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
  There is no new `SolverRefusal.obstacle.kind`.
- **New fields, ON only:** `run.bobBossForecast().window` (the run's `swordWindow`); `slash`'s optional 4th argument
  `scale`; the strike plan's `landings`. With the key ON, the decline text gains a suffix *" (the forecast's landings:
  N)"* only when N ≠ 1.
- **Run state:** none added, renamed or reshaped. There is no per-visit map, `stateDigest`/`stateDigestParts` are
  untouched, and the skin is unaffected.
- The walker (`botDriverV2.*`) is untouched, so no `producer:walker` row moves.
- **What it must wire for the encounter leg:** lift `jsRuntimeCore.validateGoal`'s blanket encounter refusal. The solver
  side is ready: `solverGoalFor` maps the encounter location to `{kind: 'encounter', at, drop, then: null}`, and
  `encounterReportAddresses` gives {32,3}+{32,4} with `apReportBosses` ON. With the key ON, a replan inside a swing agrees
  with the run. The completion is the reports, not the item.

## Hand-overs

- **Hammer arc:** nothing. The spinner forecasts were read, not edited; the fix sits in the Bob forecast and its executor.

## What the brief got wrong (measured)

1. **"First suspect: MISCRES residue (`forecastCorpseFade` / `nonChaserRemovalBlocks`)."** The cause is not a removal
   lag. It is the swing in flight: the boss's positions agree tick for tick, and only its hits and i-frames differ, from
   +1.
2. **"+11 … 0 landing(s)".** That shape is not reproduced at `1e17f44738` from any L32 staging or in-swing continuation
   (175+ continuations and 6 tape stagings). Every decline here is "+57..59, 2 landings" (dispatch 4 above).
3. **The six `--check` identities are not all green at `1e17f44738`.** battery, d2-chain, l18 and campaign exit 1 at the
   pristine base, with md5s identical to this tree's. Cause, measured on battery: the committed
   `fixtures/traces/r8-solve-11.trace.json` lacks the `"sword-dash" … "certified whole (fidelity L40BK2)"` rows that
   `dashSpinnerForecast` (flipped ON at W31) now writes. `SEEDLING_DASH_SPINNER_FORECAST=0 … r8-battery --check` gives
   "all checks green". The W31 flip owes a trace re-record (planner's).
4. `carved pairs c4` reads `c9bdd11e` at the base. W31's L39SHAFT/L40BK2 banks quote `7e1497c4`. It moved on main after
   them; it is not mine, and it is equal at base and after.

## Residue

- m2 (the press's replace) is not isolated by any row (see Mutants).
- A non-sword thrust in flight (a spear press at the seam) is not forecast: the plan is not taken. It is not measured
  anywhere; no L32 staging presses a spear.

## Byte-inertia

With the key OFF, the identity block is md5-identical to the base and every producer output is equal. The forecast's OFF
path is the old code: an empty `tests` map, no `window`, and the same text.

## Rows to BANK

- `encounterSwingInFlight` OFF; `fidelityL32Bob.test.js` 11 rows (D1 7, D2 4).
- The census: OFF 12 declines / 140; ON 0 / 140.
- The game witness: `apb-l32-fresh-no-fire` t370–560, boss rows 0 px; form 1's death at t426.
- Solver surface: 353 rows.
- Main's `--check` reds: battery/d2-chain/l18/campaign exit 1 at `1e17f44738` (the trace re-record the W31 flip owes).

## CI

`JavaScript Unit Tests` at `3f7e8a88` (my last code-path head; this report is the only commit after it): run
`40386869224`, conclusion **success**. Vitest unfiltered (quoted from CI, ⚖ 52): **23,062 passed / 0 failed**; slow
battery 269/269; the producer `--checks`, headless and browser gate jobs are green.

Earlier heads, read and fixed:
- `d4336689` (run 40371240073): shard 1/3 red, the solver-surface census, re-sealed in `f32af2d8`.
- `9e87a666` (run 40380473268): 3 red, all from my bot-log entry. `procgenDocs/generated` `--check` and `docsRender`
  ×2 failed because the docs index was not regenerated; the headless gate's UNEXPECTED-RED was
  `generate-procgen-reference.mjs`. Fixed in `3f7e8a88`, which regenerates only `docsIndex.js` and the README index
  region. The generator's capability/registry/substrate rewrites are this box's noiz2sa artifact and were not
  committed.

⚠ CI's `Producer --checks` job is green. That job may not hold the four `--check`s that read exit 1 locally at both the
base and this tree (item 3 of "what the brief got wrong"). The local red reproduces at a pristine `1e17f44738` and
clears with `SEEDLING_DASH_SPINNER_FORECAST=0`.
