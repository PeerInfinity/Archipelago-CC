# Seedling hammer-phase AXIS — strikes on axis-aligned walks (`AXIS_STRIKE`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-axis-strikes` (planner `seedling-hammer-phase-planning-2`), cloud, Opus |
| Start SHA | `84404513` (= `origin/main` at launch) |
| Head | code `07a6531f` (I), docs `902ef8c5` (D), gates `142d2d12` (the constants census and the evidence); this report is the last commit on the branch |
| Branch | `claude/seedling-hammer-axis-strikes-6cubdp`, the harness's designated branch. Nothing was pushed elsewhere |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-axis-strikes-evidence/` (the instruments are under `tools/`, the census and radius tables under `census/`, the design scratch under `m/`) |
| Scope | No mid-run message reached this session; the scope is the brief's. `CHOOSER_PAIR` had not flipped on `main` when this ran: every L40 answer below was measured at the defaults AND with `SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3`, and none depends on the flip |

## 2. The answer first

**The one thing to know first: at this head no L40 walk is axis-aligned at all.** OPP's 262 missed ticks (at
`12b0c124`) are gone. Over the 60 captured L40 requests the solver drives 50,052 ticks (47,668 with CPAIR-3), and **0**
of them are on an axis-aligned walk. The only axis-aligned walk anywhere on the measured workloads with a body in
reach is L53's puncher exit (route survey step 79, RULESREF's `punchGateTimed`).

| question | answer |
|---|---|
| Is a strike on an axis-aligned walk safe? | **Yes, in one form: aimed only ALONG the walk's own axis** (design 1). The aim key is then the walk's own axis key (forward or back), the press holds `primary` alone, and the other coordinate never moves. On L6's lane (y = 56) y is exact and x stays on the 0.05 grid on every one of 40 ticks, and the preview spends the drive's keys. Pausing to aim across the lane (design 2) is **not** safe: from rest the aim key moves the player 1.70 px off the lane, and no one-key return lands back on it |
| What does it buy? | **On today's workloads: one modelled hit, no solve, no refusal moved in kind.** L40: nothing (no axis-aligned tick; 60/60 identical ON, and 60/60 with CPAIR-3). r9 campaign: nothing (27 axis ticks, none with a body in reach; `--check` green ON). Route survey: 1 mover of 237 (step 79), whose axis walk lands `puncher@136,96`'s second hit at t135; the step still refuses at the same press kill of the puncher (the bound's text 166 → 167 t). 201/237 SOLVED both ways |
| L40, preview side | one axis-along policy is built ON in `solveProgress.test.js`'s L40 kill-rung workload (`r5-l40-part5`), in a preview of RULESREF's punch-gate corridor that is never driven: it walks 4 states fewer and moves 3 instrument pins; the answer is OFF's byte for byte |
| Kills | 0 |
| Ticks saved | 0 (no solve moved) |
| Refusals moved | 0 in kind; 1 in text (survey step 79) |
| Does any answer depend on the CPAIR flip? | No. L40 has no axis-aligned tick with or without it, and the survey and the campaign never ask the chooser for a pair (CPAIR's census) |

## 3. W0 — base and census

| row | result |
|---|---|
| base | `git fetch origin main` → `84404513`; the designated branch reset onto it |
| bootstrap | `session_bootstrap.sh --seedling` → done (node v22.23.4). Its AP `pip` step failed on a `bsdiff4` version prompt in `/root/CC/seed` (not this tree; nothing here reads it). Every non-wasm submodule initialised before the first gate |
| identity block (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, … (the file). The six producer `--check`s exit 0; reference ALL MATCH. The `generated set` row could not take the box (the L40 capture held it), as in OPP; re-measured at the head (§6) |
| `ci-producer-checks --jobs=4` (`producer-w0.txt`) | **97 run, 0 red**, 1 skipped |
| bounded set (`bounded-files.txt`: every test naming `axisAligned`, `walkToUnder`, `strikePolicyFor`, `OPPORTUNISTIC_STRIKE`, `holdOneAxis`, `skirtGridKept`, `punchGateTimed` or `SWIM U2`, every hammer row, `solverSkirt`, `fidelityProximity`, `solverEnvChannel`; the `.slow` files run apart) | **38 files, 556 / 556** (`bounded-w0.txt`) |
| the L40 capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, CPAIR's 52 L40 leg keys (`l40-leg-keys.txt`), this tree on :8000: 52 legs (39 done, 11 failed, 2 timeout; `capture-legs.txt`), **60 requests**. The capture (~31 MB) is not committed |

**The instrument** (`tools/axis-loader.mjs` + `axis-register.mjs`, measurement only): a load hook makes
`botDriverV2.driveStepHeld` call a global just before it returns, so every DRIVEN tick (not a preview) is seen with its
final keys. On each driven tick of an axis-aligned walk it asks the policy's own `strikeCandidates` (owed empty) whether
a body is in sword reach, takes the walk's axis (the velocity's, else the held key's), and asks the same scan with only
the bodies whose `facingToward` is on that axis. `tools/axis-replay.mjs` replays a captured request as the worker does
(`solveAnytime`); `axis-batch.mjs` runs every request, one fresh process each. Replays are deterministic: 21 requests
replayed twice gave identical answers.

**The census** (`census/*.txt`):

| workload | driven ticks | on axis-aligned walks | with a body in reach | reachable along the axis |
|---|---|---|---|---|
| 60 L40 requests, defaults | 50,052 (81 runs incl. 21 repeats) | **0** | 0 | 0 |
| 60 L40 requests, CPAIR-3 | 47,668 | **0** | 0 | 0 |
| r9 campaign (`--check`) | 5,977 | 27 | 0 | 0 |
| route survey (`--through=end`, 237 steps) | 65,234 | 4,165 | **40** | **22** |

Every in-reach tick is survey step 79 (L53, `reach-exit (144,240)->L54`, the axis-aligned walk RULESREF's
`punchGateTimed` asks beside the pinned puncher), and every one is `puncher@136,96`:

| ticks | walk axis | the puncher's facing | along the axis? |
|---|---|---|---|
| t120–t138 (18) | x (walking `right`) | up (above the player) | **no** — the case the walk is axis-aligned for: `right+up` would graze it |
| t133 (1) | x | left (behind) | yes |
| t139–t159 (21) | y (walking `down`, away) | up (behind) | yes |

## 4. M — the design check

| design | lane exact? | game-modelled? | on the census ticks | L40 (60 req) | L40 CPAIR-3 | survey | r9 | verdict |
|---|---|---|---|---|---|---|---|---|
| (1) aim only along the walk's axis (`axisAlongStrike`) | **yes**: the aim key is the axis's own, the press holds no direction key; L6 lane: y = 56 and x on the 0.05 grid all 40 ticks (`m/design1-l6lane.txt`); step 79's ON walk keeps x = 120.50 through its y-axis strike | yes: the policy's own aim/press, `levelRun`'s `enemyHit` (L6: the hit lands at t12; L53: `puncher@136,96` hit 2 at t135) | aims twice on the 22 along-axis ticks (t133 aim → t134 press → the hit lands t135; t160 aim → t161 press, no hit lands), never on the 18 off-axis ones | 60/60 identical | 60/60 identical | 1 mover (step 79, refusal text) | identical, green | **BUILT** |
| (2) pause, aim across, strike, resume | **no**: from rest, `up` one tick then the press puts the player 1.70 px off the lane; one `down` overshoots to +1.90, a single `down` tap leaves −0.60 (`m/design2-pause.txt`). A lane walk that admits one x exactly cannot take it | — | would aim at the 18 off-axis ticks (the puncher above), moving the player toward the body the walk was made axis-aligned to slide away from | not run | not run | not run | not run | **not built** |
| (3) leave it | — | — | — | — | — | — | — | not needed: (1) is measured safe |

Why the plain policy is not safe on these walks (OPP's ruling, re-measured): on L6 the plain policy on the same axis
drive aims `down` at t37 (the bob below). `holdOneAxis` drops that key while the player moves along x, so the aim is
silently lost and the press that follows faces the old direction: the policy's model and the walk part.

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch.** `pressKillCost.AXIS_STRIKE` (`enabled: SEEDLING_AXIS_STRIKE === '1'`), `AXIS_STRIKE_DEFAULT = false`,
  `withAxisStrike(enabled, fn)`, the instrument `AXIS_STRIKE_COUNTS {policies, asked, withheld, noAxis, aimed, pressed}`
  and `resetAxisStrikeCounts()`, beside `OPPORTUNISTIC_STRIKE`, re-exported through `solverView.js`; the docblock
  carries the user's queueing and OPP's hand-over. `SOLVER_ENV_NAMES` has `SEEDLING_AXIS_STRIKE`, so the page channel
  (`?seedlingSolverEnv=SEEDLING_AXIS_STRIKE=1`) and the sweep's `--solver-env` reach it.
- **Code** (`solverBot.js`):
  - `strikePolicyFor(run, {axisAlong: true})`, a new row of the one construction site: the same `createStrikePolicy`
    wrapped by `axisAlongStrike` (a dash plan is refused by name: an axis-aligned walk is undashed);
  - `axisAlongStrike(policy)`: on an aim tick, the policy is asked with only the bodies whose `facingToward` lies on
    `walkAxisOf`'s axis; on a press tick (an aim owed) it is asked with every body, so the Bulb veto and the swing see
    the whole rect; every getter is the wrapped policy's;
  - `walkAxisOf(state, walkHeld)`: the velocity's axis when one component moves, at rest the held keys' axis when they
    name one, else `null` (nothing offered);
  - `axisStrikeFor(run, dashMode)`: `null` OFF, the row ON — at every site that handed an axis-aligned walk
    `strike: null`: `probeCorridor`'s preview, the ladder's AVOID / TIME / BAIT / timing previews (11 sites), the axe
    crossing's families, the forced-hit crossing's `strikeFor`, `certifyLaneWalk` and the drive in `walkToUnder`.
    So the walk certified is the walk driven (⚖ 30(c)).
  - **OFF is byte-identical by construction**: `axisStrikeFor` reads one boolean and returns `null`, which is what each
    site passed before. Measured too (§6).
- **Rows** (`hammerAxisStrikes.test.js`, 4 rows, no fixture beyond the atlas and the committed `r9-l6-bob-press` tape):
  1. **ships OFF** (`AXIS_STRIKE_DEFAULT`, the env read, the channel's name; OFF `axisStrikeFor` is `null`, ON not);
  2. **the census tick** (L6's `bob@112,48` dead ahead on an axis-aligned walk east along y = 56): OFF holds `right`
     into it, no press, hit at t20; ON aims `right` at t10 (the walk's own key), presses at t11 (`primary` alone), the
     hit lands in the model at t12 (`enemyHit`, hits 1), a second strike aims `left` (back along the axis) at t37, and
     the player takes no hit by t40; y is 56 with vy 0 on every tick of both arms, ON keeps x on the 0.05 grid on all
     40 ticks (OFF leaves it at t20, the contact's knockback); the preview with the same row spends the same keys;
  3. **a body reachable only off-axis = OFF**: moving east with the bob 14 px below, the plain policy aims `down`, the
     axis row decides `none` and keeps `right`; the same at rest; the same bob ahead is aimed with `right`; no single
     axis (two keys or none at rest, a diagonal velocity) → nothing;
  4. **a non-axis walk = OFF**: the plain-policy drive past the bob (it strikes) is the same keys with the switch ON,
     and a whole `solveSegment` (L6 → the teleporter) answers OFF's keys ON with no axis-along policy built.
  - 4 / 4 in ~5 s.
- **Mutants** (`tools/mutants.py`, `mutants.txt`: copy, edit, run, restore):

| mutant | result |
|---|---|
| M1 aim off-axis (the offer keeps the bodies whose facing is OFF the axis) | **RED** (rows 2 and 3) |
| M2 the lane drifts (at rest the axis is not asked: an aim across the lane from rest) | **RED** (row 3) |
| M3 drop the arm (`axisStrikeFor` always `null`) | **RED** (rows 1 and 2) |
| M2b the press adds a perpendicular key | **GREEN — survives, as predicted**: `holdOneAxis` drops a second axis while the first has velocity, and the press always comes the tick after an aim along a moving axis. The lane is guarded twice while moving; only at rest (M2) is the offer the only guard |

- **The ON radius, by mover class:**

| workload | movers ON | class |
|---|---|---|
| L40, 60 requests (defaults) | **0** (60/60 identical in verdict, ticks, plan sha, work and message) | — |
| L40, 60 requests (CPAIR-3) | **0** | — |
| route survey, 237 steps | **1** (step 79, L53) | **refusal → refusal, same stage, text only**: the axis walk lands `puncher@136,96`'s 2nd hit (t135); the chaser press kill still cannot finish it inside its bound (166 → 167 t; the puncher 39.7 → 40.2 px away) |
| r9 campaign `--check` | 0 (green ON; no axis-along policy built) | — |
| bounded set ON (`bounded-on.txt`) | **3 rows, 1 file**: `solveProgress.test.js`'s L40 kill rung (`r5-l40-part5` → the totem part (160,640)), its v1 md5, its TC2 work row (`previewStates` 16506 → 16502) and its TC2 stream digest | **preview-only, answer unchanged**: ON builds one axis-along policy in a preview of an axis-aligned corridor that is never driven (RULESREF's punch-gate probe beside L40's two punchers); that preview aims and presses once, so it walks 4 states fewer. The answer is OFF's byte for byte (679 t, plan md5 `83ea3652…`, `shouldStop` 183, 34 previews, 0 driven axis-aligned ticks; `census/l40-part5-off-on.txt`). These rows pin the progress instrument's bytes; they are left at OFF's values (the switch ships OFF) and a flip would re-pin them |
| producer roster ON | **0** (97 run, 0 red) | — |
| identity block ON | **0** (equal to OFF row for row) | — |

No mover turns a solve into a refusal, adds a hit on the player, or adds a death.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path, OFF at the head (⚖ 52) | **39 files, 560 / 560** (556 + the new file's 4; `bounded-off.txt`). With `SEEDLING_AXIS_STRIKE=1`: 557 / 560, the 3 preview-only `solveProgress` rows of §5 (`bounded-on.txt`) |
| the new file | 4 / 4 |
| the hammer `.slow` files (`hammerDashShape`, `hammerEscapeGenerated`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerSpinnerPress`, `hammerTurretApproach`; `vitest.slow.config.js`) | **6 files, 11 / 11** (`slow-hammer.txt`) |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`producer-off.txt`) |
| `ci-producer-checks --jobs=4`, `SEEDLING_AXIS_STRIKE=1` | **97 run, 0 red** (`producer-on.txt`). A first ON run read 1 red, the battery's `TREE-MOVED` guard alone: this slice's own evidence files appeared in the tree while it ran, and all 97 producers exited 0 there too (`producer-on-treemoved.txt`); re-run with its output outside the tree |
| identity block at the head vs W0 | **every row equal** to W0 (`identity-after.txt`); the `generated set` row now reads OK (W0 could not take the box). ON: equal to OFF row for row (`identity-on.txt`) |
| `census-seedling-solver-surface --check` | GREEN **367** after `--write`: two rows classified (`AXIS_STRIKE`, `AXIS_STRIKE_COUNTS`, class `seedling`, form `constant`); the `presses.js` direction imports' counts moved (`AXIS_OF_FACING`) |
| `census-seedling-constants --check` | PASS after `--write` (`142d2d12`): the switch's 7 counter zeros classified structural. The first JSUT read red on it (below), because `seedlingConstantsCensus.test.js` holds the committed CSV to a drift-free tree |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (`procgenDocs/generated/docsIndex.js`, `procgen/README.md`'s region); ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless page on :8000) | **ALL PASS** (416 PASS rows, the r9 campaign included; `wasm-ship.txt`) |
| `solverEnvChannel.test.js` | green (in the bounded set and beside the new file: 15 / 15) |
| docs | `seedling-bot.md` (the switch, OFF, what it does and what it measured); `seedling-bot-log.md` (`### Seedling hammer-phase AXIS — …`) |
| JSUT | run **41230430090** at `902ef8c5`: suite **25,013 passed / 1 failed / 0 skipped**; **slow battery 351 / 351**; the one red was `seedlingConstantsCensus.test.js` (the constants CSV not re-written for the switch's counter zeros), fixed in `142d2d12` (`--write`; that file 24 / 24 locally). Run **41238248272** at `142d2d12` was still QUEUED (all four vitest jobs) more than 90 minutes after the push, when this report was committed (no runner had picked up any of its jobs). It is the head's JSUT: the report-only commits after it do not trigger the workflow (its path filter). The planner should read it with `node scripts/procgen/ci-summary.mjs --run=41238248272 --wait` |

## 7. What the harvest A/B should expect

With the switch **OFF: no movers.** OFF reads one boolean and passes the `null` every site passed before; the L40
requests, the survey, the campaign, the bounded set, the producer roster and the identity block match the base.

With it **ON**: survey step 79's refusal text (166 → 167 t), and the three `solveProgress.test.js` instrument pins of
the L40 kill rung (a preview walks 4 states fewer; the answer is OFF's). No L40 sweep leg should move: none of its
DRIVEN walks is axis-aligned at this head, and the 60 captured requests answer OFF's bytes and work units ON. **The game witness to ask for**, if the planner wants the one modelled hit in the game: survey step 79 is a node
survey row, not a sweep leg. The nearest page workload is the divergence sweep over L53's legs with
`solver_env=SEEDLING_AXIS_STRIKE=1` (keys = the L53 legs to `out_teleporter_144_240`). On the L40 keys a sweep with
`solver_env=SEEDLING_AXIS_STRIKE=1` should equal OFF leg for leg.

## 8. What the brief got wrong (measured)

- **"On the 52 L40 legs (59 captured requests …), the axis-aligned walks miss 262 in-reach ticks."** At `84404513` the
  60 captured requests drive **no** axis-aligned tick at all (with or without CPAIR-3). The legs OPP counted (the west
  pits from `in_L39_144_0` / `in_L43_176_464`, beside `puncher@128,624`) now drive no axis-aligned walk; which change
  between OPP's base (`12b0c124`) and this one removed them was not traced. OPP's number is its base's.
- **The lane's reason on the only live workload is not a skirt.** Swim U2 / PROXIMITY's lane (L29, one x exactly) has
  axis-aligned walks on the survey but no body in reach; the walk that meets a body is RULESREF's puncher exit (L53),
  where the reason is the graze, not the grid. Design (1) keeps both.
- **"A strike that pauses the walk (stand, aim, strike, resume on the lane)":** an aim cannot be taken without moving.
  An aim key accelerates the player, so "stand and aim across" is a move of 0.8 px on the aim tick and 1.70 px by rest.

## 9. Residue and hand-overs

- **The design question is closed; the payoff is not.** Design (1) is safe and built, but today it buys one modelled hit
  on one survey step. A flip has no workload that gains; it would be a cost-free OFF → ON (the survey's one mover is
  text). The planner decides whether to flip it for the future workloads where an axis-aligned walk meets a body.
- **Game witness:** the L53 hit at t135 is model-only (node survey). A page sweep over L53 with the switch is the
  witness (§7).
- **M2b survives** by design (`holdOneAxis` is a second guard while moving); not a gap.
- **The Bulb veto at the aim** sees only the on-axis bodies (the press re-asks it with every body and drops the aim).
  That costs at most one on-axis aim tick, harmless to the lane, and was never met on any workload.
- **The capture** (60 requests, ~31 MB) is not committed; `l40-leg-keys.txt` and `capture-legs.txt` name it.
- **Bootstrap residue:** `session_bootstrap.sh`'s AP `pip` step fails on `bsdiff4==1.2.6` (an interactive prompt under
  `/root/CC/seed`); nothing in this slice reads it.
