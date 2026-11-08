# Seedling hammer-phase L53-KILLLOCK — the L53 water-arena kill-lock (BK3) clears its chasers (`KILLLOCK_CHASER_REWIND`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-l53-killlock` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-07 ("DRILL-EXIT-PASS,L53-KILLLOCK,DRILL-WATER to fidelity") |
| Start SHA | `0d575b78eab99a88659b9bfe7c42621b43a75121` (= `origin/main` at launch) |
| Head | W0 `eb2fdb3e`; M `3fe827a4`; I `9adc0654`; D `63b6f006`; this report is the last commit on the branch |
| Branch | `claude/l53-killlock-water-arena-hdcwly` (the harness's designated branch; nothing pushed elsewhere) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l53-killlock-evidence/` (`README.md` names every file: `w0/`, `m/`, `i/`, `radius/`, `d/`, `tools/`) |
| Scope | No mid-run message reached this session; the scope is the brief's |
| Environment | bootstrap `--seedling` READY (it initialised `shared`, `bulletml-dodge`, the wasm builds and `vendor/seedling`); node v22.23.4; 4 cores; `:8000` `serve-nocache.py` (started here). ⚠ Brief miss: the five other non-wasm submodules (`cavernous-ii`, `journey-to-ascension`, `omsi-loops`, `swfRecompilerPanel/browser`, `textAdventureEngine`) were initialised only AFTER the gates. `generate-procgen-reference` (no diff), `check-procgen-reference`, the docs index and the identity block were then re-run, all green |

## 2. The answer first

**The one thing to know first: the solver fix works in the model, and the page's remaining hit is a fidelity gap. The
game keeps a broken rock solid to chasers for two updates longer than the model does.** With the switch ON, 9001 and
9002 both reach L54 on the p4g page, with one room hit each. Both hits trace to `breakablerock@128,160`: the model frees
the jellyfish at the rock's face at `goneAt`, while the game holds them two more updates. With that 2-update lag (a
scratch what-if, never on a tracked path), both game captures reproduce exactly (bodies and player, worst |Δ| 0.000 px),
and the switch still solves both legs hitless. That row is fidelity's (hand-over §9).

| question | answer |
|---|---|
| Do 9001 / 9002 / 482 reproduce at main's defaults? | **Yes.** Page: 9001 fails with the census's text (*"jellyfish@144,192 is still in the world after the whole 174-tick bound … 22.5 px"*); 9002 runs out at 640 then 2560 (⏱ DEADLINE); 482 is done (5 t). Node, uncapped (`chain.mjs`, 40960): 9001 is REFUSED at 7368 units (2372 + 4996; the full pass ends on `puncher@136,96` *"166-tick bound … 39.7 px"*); 9002 is REFUSED at 5555; 482 SOLVED 5 t / 25 units. The census's numbers, unit for unit |
| Why does the press kill end 22.5 px off the jellyfish? | **Three solver causes, none of them a budget.** (1) The kill-lock's chaser arm asks `deriveKillByChaser` at **tolerance 0**: an exact float position *and* a full stop. The walk it then drives arrives at `DEFAULT_TOLERANCE` (1.0). Once water and shield bumps leave the player off the lattice (120.6,151.35), every preview is refused *"did not settle — 400 ticks without arriving"* (79 of 83, 77 of 96, 37 of 37…), and the arm falls back to "stand here". (2) On the dashless pass that stand-here dwell lands the jellyfish's 3rd hit on dwell tick 161 of 174, and the bound runs out during its 8-frame "die". The 22.5 px is a dying body. (3) On the full pass the two jellyfish die, and the puncher is pinned for all 166 ticks on an Ice Wall corner: its 12-px box clips tile (96..112,128..144) on every y step, and its x impulse only flips ±0.3 px. The combat ladder's own chaser arm already asks at the segment's tolerance; the kill-lock arm was the only one at 0 |
| Is any of it a model gap (jellyfish / puncher in water)? | **Not the motion in water.** The game's bodies match the model to 0.01 px through t177 (9001) and t373 (9002), and the game pins the puncher at the same coordinates as the model. **The gap is a rock-removal fencepost.** The game keeps a broken `BreakableRock` solid to chasers two updates past the model's `goneAt` (`levelRun.brokenRockIdsNow`'s `ticksCompleted + 1`, which its own comment calls unmeasured). STOPPED there; hand-over §9 |
| The design | **`KILLLOCK_CHASER_REWIND`** (new, OFF), inside the kill executor's chaser arm. ON: (1) the arm derives at `DEFAULT_TOLERANCE` and keeps every scored stance; (2) when an attempt's walk or dwell is refused, it rewinds the turn (`ctx.rewind`) and tries the next stance, then the next body (at most 6 attempts); (3) a dying body's death window is stood out; a refusal raised after the deadline tripped is passed on unrewound |
| 9001 / 9002 ON | **SOLVED, 0 hits in the model on a fresh run (⚖ 30(c))**, both into L54. Held retry (2560), the worker's passes: 9001 **594 t** (the full pass), 9002 **906 t** (the dashless pass). Uncapped: 933 t / 844 units and 906 t / 1207 units. **On the p4g page: both done, 1 room hit each** (t289, t482), the fencepost above |
| 482 ON | = OFF byte for byte (5 t; the arm is never asked) |
| L95-PUNCHER's switches on 9001/9002 (scratch merge question) | L95-PUNCHER added **no switch**: its answer is `CHASER_STAGED_HUNT` + `CLEARTAG_STAND`, both already on main. Both together leave 9001 and 9002 **= D0**, digest for digest (`m/arms-l95-switches.jsonl`). With this switch added, the result is this switch's plans byte for byte. No branch merge was needed |
| Cost vs 640 / 2560 | **Inside the held retry (2560), not inside 640.** The 640 first ask is deadline-bound both ways; the retry answers ON (9001 1210 units of 2560 for its two passes, 9002 1206 dashless). Uncapped: 844 / 1207 units, against OFF's 7368 / 5555 |
| The ON radius (226 legs, 239 page requests) | **1 mover, cost only.** Leg 749 (L98 ← L93) now answers at the 640 ask the plan that OFF's 2560 retry answered, byte for byte (`fd487cf33080`, 642 vs 1602 units). The arm runs on no other request in the inventory |
| Should the leg list build the walk's link legs? | **Yes, as a separate mode.** The walk enters L53 at `r2c2` and crosses `r2c2 → r9c10 → r14c9`. The list builds link legs only for rooms *no* door enters, and `r14c9` has a door (L54), so the walk's crossing is not in it. The same goes for L92's `r4c2` (the census's 9003). Not changed here (out of scope) |

## 3. W0 — reproduce

- **Page sweep, defaults** (`w0/page-sweep-d0.tsv`): `probe-seedling-divergence-sweep.mjs --legs=w0/legs-9001-9002-482.jsonl --mode=inv
  --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g --capture-requests=…`.
  - **How the hand-built legs reached the page:** the census's 9001/9002 lines (its `cross-room-legs.jsonl.gz`, the
    list's own link format: `arrive.entry: 'link'`, `through: [r2c2, r9c10]`), plus 482's line from this head's
    `seedling-divergence-legs.mjs`, in one jsonl passed with `--legs=`.
  - The leg list's inventory equals the census's: same sphere 5.6, and 9001's inventory is identical to 482's.
- **Results**: 482 done (roomHits 0); 9001 failed with the jellyfish text; 9002 failed on the deadline text. These are
  the census's results.
- **Node** (`w0/node-chains-d0.txt`; the census's `tools/chain.mjs`, unchanged, cap 40960, `--frames=1`):
  | leg | end | work (dashless + full) | where the work went |
  |---|---|---|---|
  | 9001/0, 9001/1 | REFUSED: full pass on `puncher@136,96` *"166-tick bound … 39.7 px"* | 7368 (2372 + 4996) | `execKill>deriveKillByChaser` 6310 |
  | 9002/0, 9002/1 | REFUSED: *"break stance (breakablerock@128,160): the combat ladder is EXHAUSTED … chaser:puncher@136,96"* | 5555 (4963 + 592) | `deriveKillByChaser` |
  | 482/0 | SOLVED 5 t, 0 hits | 25 | — |
- **The per-body chain** (debug lines in a scratch worktree, `w0/scratch-debug-and-prototype.patch`; traces in `w0/`):
  - **The room** (`w0/room-l53-9001.txt`). The arena (x 128–208, y 144–208) is mostly snow (tile 21), with ice at the
    lock. Water is the shaft at x 112–128 (y 144–176) and the west pool. The arena is entered from above through the
    puncher's corridor (x 112–128, y 112–144) and past `breakablerock@112,128` / `@128,160`.
  - **Every derived stance is refused "did not settle".** The arm is asked from (120.6,151.35), on the water tile, off
    the lattice (`w0/derive-trace-9001-d0.txt`). Per ask, the refusals by class: `jellyfish@144,192` 79 of 83 reachable,
    `jellyfish@152,168` 79 of 90, `jellyfish@184,160` 77 of 96, `puncher@136,96` 37 of 37. All are *"the preview spent
    400 tick(s) without arriving"*: `previewWalk(…, tolerance = 0)` needs |Δ| ≤ 0 and `vx = vy = 0`. So the arm takes
    its stand-here fallback: *"inside its 160 px leash of where the walk stands, so it comes"*.
  - **Dashless: the jellyfish dies after the bound.** In the stand-here dwell (`w0/dwell-trace-9001-d0.txt.gz`), hits
    go 1 at t247, 2 at t277, then 3 at t391 = dwell tick 163 of 174. The death is then in the run, but strikeBodies
    drops the body only at `destroy` (die anim 8 frames at rate 7 ≈ 57 ticks). The refusal's (136.1,178.1) / 22.5 px
    is that dying body.
  - **Full pass: the puncher is pinned.** Both jellyfish die (the 2nd at t391). The puncher is asked from (122.3,158.5).
    It holds (115.6,119.4) with `v = (0.39,0.92)` for all 166 ticks (`w0/puncher-pin-9001.txt`):
    - every y step meets `tile:Ice Wall` (96..112,128..144), because its box x 109.6–121.6 overlaps x < 112;
    - x+0.38 is free, but the bang-bang impulse flips it.
    - It is on screen (camera (40,74), 160×160). `collideLineSolid`'s point line to the player is clear, so the
      refusal names no blocker.
  - **The game pins it too.** In the ON capture the game's puncher sits at the model's (115.60,119.38) at every
    compared tick. The pin is the game's; it is not a model gap.

## 4. M — the designs, measured

Node, `chain.mjs` (cap 40960) over the page's captured requests; a scratch prototype first (`L53_X`, in a scratch
worktree), then this branch's switch. Rows in `m/ablations.jsonl`, `m/arms-l95-switches.jsonl`.

| design | 9001 | 9002 | 482 | verdict |
|---|---|---|---|---|
| D0 | REFUSED 7368 | REFUSED 5555 | SOLVED 5 | — |
| (a) the arm at the walk's tolerance, no retry | REFUSED 815: the one priced stance (120,168) is hit/outrun; *"159-tick bound (64 guard steps) … 19.4 px"* | not run | — | not enough: the forecast prices stances, but the live walk arrives on another tick and the shield bumps move the body |
| (b) rewind over the arm's stances at tolerance 0 | REFUSED 4776 | REFUSED 2970 | — | nothing prices, so there is nothing to retry |
| (c) (a) + rewind (no dying grace) | SOLVED 606 t (full pass) / 2345 | SOLVED 906 / 1217 | — | works |
| **(d) (c) + the dying grace = `KILLLOCK_CHASER_REWIND`** | **SOLVED 933 / 844** (dashless), 0 hits | **SOLVED 906 / 1207**, 0 hits | **= OFF** | **THE ANSWER** |
| a staged order over the three jellyfish | — | — | — | not built: (d)'s queue (the arm's own choice, then that body's other stances, then the next body nearest first) already kills all four |
| baiting into the press | — | — | — | not built: no measured case needs it |
| a puncher arm | — | — | — | not built: the same arm kills the puncher from (136,120), the corridor floor beside the corner, at its 2nd attempt |
| L95-PUNCHER (`CHASER_STAGED_HUNT` + `CLEARTAG_STAND`) | = D0 | = D0 | — | inert here; with (d): (d)'s plans byte for byte |

**What the attempts did** (ON, the held-retry request, dashless; the row in `hammerL53Killlock.test.js`).
- 9001:
  - `jellyfish@144,192` at (120,168): the WAIT was hit at dwell tick 37, so it was rewound. Then (120,152): killed.
  - `puncher@136,96` at (120,136): hit at dwell tick 23, so it was rewound. Then (136,120): killed.
  - `jellyfish@184,160`: killed at the first stance.
- 9002: `jellyfish@152,168`, `jellyfish@144,192` and `jellyfish@184,160` (the last after two rewinds), then the puncher.

**Cost vs 640 / 2560.**
- The page's first ask (640) is deadline-bound, OFF and ON.
- The held retry (2560) answers ON: 9001 with the full pass (594 t), 9002 with the dashless pass (906 t; its full pass
  is cut by the window).
- On the page the plan arrived at the retry in both legs (`m/page-sweep-on.tsv`, `notes`). No leg here needs more
  than 2560.

**The game witness (ON, p4g).**
- `probe-seedling-divergence-sweep.mjs … --solver-env=SEEDLING_KILLLOCK_CHASER_REWIND=1` over the same legs file. Both
  9001 and 9002 end **done**, into L54, with **roomHits max 1**:
  - 9001: the 594-t plan diverges at t289, the player knocked −2.72 px, `hits 1`. The page re-plans; 696 t finishes.
  - 9002: the 906-t plan diverges at t482; the page re-plans; 831 t finishes.
  - 482: done, 0 hits.
- `probe-seedling-contact-divergence.mjs --capture` (a scratch copy adding `?seedlingSolverEnv=`; 9001 and 9002 each
  on its own page) samples every game body per tick (`m/contact-capture-900{1,2}-on.json.gz`).
  `tools/body-diff.mjs` compares them with the model:
  - 9001: the first body divergence is **t178**. Two jellyfish are held by the game at x 150.35 / y 182.21, i.e.
    flush against the left/top faces of tile (128..144,160..176). The model moved them through.
  - 9002: the same at **t374**.
  - The model's `rocksBroken` puts `breakablerock@128,160` at fired 171 → `goneAt` 178 (9001), and fired 367 →
    `goneAt` 374 (9002). The game frees the bodies at t180 / t376.
- **The what-if** (`m/rock-lag-whatif.txt`, scratch: `brokenRockIdsNow` read n updates later):
  | n | 9001 | 9002 |
  |---|---|---|
  | 0 (the model) | bodies diverge t178; player hit t289 | t374; hit t482 |
  | 1 | bodies diverge t179 | t375 |
  | **2** | **no body differs over 293 ticks; player PASS, worst \|Δ\| 0.000** | **no body differs over 487 ticks; PASS, 0.000** |
  | 3 | bodies diverge t180 | t376 |

  Under n = 2, the switch OFF still refuses both; ON solves both hitless (768 t / 959 t, the worker's passes).

## 5. I — the switch, the rows, the mutants, the ON radius

- **The switch**: `solverBot.KILLLOCK_CHASER_REWIND`.
  - Turned on by `SEEDLING_KILLLOCK_CHASER_REWIND=1` (joins `solverEnvChannel.SOLVER_ENV_NAMES`), the page's
    `?seedlingSolverEnv=`, or `withKillLockChaserRewind`.
  - `KILLLOCK_CHASER_REWIND_DEFAULT = false`, `KILLLOCK_CHASER_REWIND_TRIES = 6`.
  - Instrument: `KILLLOCK_CHASER_REWIND_COUNTS.tries`.
  - It sits inside `execKillByChaser`, which runs only as the kill executor (`callableExecutor('kill')`), so the
    strategy switch's `kill` gate covers it; `strategySwitch.test.js` is green. No new arm or rung.
- **`solverBot.js` lines touched** (for the parallel harvest; all inside the kill-lock chaser arm):
  - `guardedChaserDwell`: the `dyingGrace` option and the loop bound (≈18022, 18066);
  - the new block after `chaserKillCeiling`: the switch, `killLockChaserAttempt`, `killLockChaserRewindTurn`
    (≈18845–19001);
  - `execKillByChaser`: the two derivation option spreads, the rewind turn, the grace (≈19053, 19082–19091, 19104,
    19130);
  - `deriveKillByChaser`: the `allScored` option and its `scored` field (≈24846, 25263).
  - Nothing in the L91 drill code. `solverEnvChannel.js`: one name. `seedling-solver-surface.json`: re-written,
    371 rows, counts only.
- **OFF is byte-identical by construction.** Every new read is `KILLLOCK_CHASER_REWIND.enabled ? … : {}`, or a default
  (`dyingGrace = 0`, `allScored = false`) that the OFF path never sets. Measured: the bounded rows, the slow battery,
  the producer checks and the identity block all match.
- **Rows.**
  - `hammerL53Killlock.test.js` (default tier, 5 rows, ~20 s):
    1. ships OFF, and the channel knows the name;
    2. 9001 dashless: OFF gives the census's 174-tick text; ON gives 933 t, plan `cc11c2c5a665`, 0 hits, L54, and the
       5 attempts in order;
    3. 9002 dashless: OFF is deadline-bound; ON gives 906 t, `bf6a54ee9d41`, 0 hits, all four bodies killed;
    4. 9001 at 640: ON is deadline-bound and the trip's refusal is passed on unrewound;
    5. 482: ON = OFF.
  - `hammerL53Killlock.train.test.js` (2 rows, ~20 s): the worker's two passes. 9001 gives 594 t `54a15ec7f984` and
    9002 906 t `bf6a54ee9d41`, 0 hits, L54; OFF refuses. These are the plans the page played.
- **Fixtures**: `fixtures/hammer-l53-killlock/`. These are the page's captured requests, cut to the levels 53+54 atlas
  records (`tools/cut-fixture.mjs`), 3.6–3.7 KB each: 9001's and 9002's held-retry request, and 482's request. Cut =
  uncut on all six answers (OFF/ON × 3), digests and work equal (`i/fixture-cut.txt`).
- **Mutants** (`i/mutants.txt`, `tools/mutants.py`, in a scratch worktree removed by name):
  | mutant | result |
  |---|---|
  | M1 no rewind | RED (9001, 9002) |
  | M2 tolerance 0 under the switch | RED (9001, 9002) |
  | M3 no dying grace | RED (9001) |
  | M4 worst-scored stance first | RED (9001, 9002) |
  | M5 one attempt per turn | RED (3 rows) |
  | M6 the asked-bodies filter dropped | survived: **equivalent** (it only re-asks bodies that refused at the same tick; cost) |
  | M7 the deadline rethrow dropped | RED (the 640 row, added for it) |
- **The ON radius.** Every leg in a level with a jellyfish, a puncher or a kill-lock: levels 12, 26, 40, 45, 53, 54, 60,
  63, 71, 92, 98, 99, 100, 104, 105, i.e. 234 legs (`radius/ids.txt`).
  - Page sweep OFF at this head with request capture (`radius/page-sweep-off.tsv`): 183 done, 28 failed, 16 crossed,
    3 skipped, 1 timeout.
  - Then every captured request was solved in node as the worker solves it, OFF and ON, and each plan re-driven on a
    fresh run (`tools/radius.mjs`; `radius/radius-off-on.jsonl.gz`): 239 requests over 226 legs. The other 8 made no
    request: 3 skipped by name, 5 that the model refused to build.
  | mover class | legs |
  |---|---|
  | refusal → solved (cost only: the same plan as OFF's next retry) | **1**: 749 `level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112`. Request 0 (640): OFF deadline; ON `fd487cf33080` 807 t in 642 units, which is OFF's request-1 (2560) plan byte for byte (1602 units). That plan has 1 model hit (`iceturret@104,24` blast t790), OFF and ON alike; the OFF page took 0 there |
  | refusal → refusal (other text) | 0 |
  | plan → other plan | 0 |
  | none | 238 requests |
  - The switch's arm is entered (any attempt row) only on 749/0 and 749/1. It is never asked on L60, L71, L99 or the
    L12 / L40 / L63 jellyfish-and-puncher legs, because none of them reaches the kill-lock chaser arm.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52; `d/bounded-files.txt`: `hammerL53Killlock`, `fidelityKillLock`, `killLockBodiesHook`, `hammerBk2Combat`, `hammerStagedHuntScanMemo`, `hammerFightFallback`, `solverEnvChannel`, `strategySwitch`, `entityBlocks`, `contentIdentity`, `boxLock`, `boxLockCommit`) | **12 files, 180 passed** at the defaults (`d/bounded-off.txt`) and with `SEEDLING_KILLLOCK_CHASER_REWIND=1` (`d/bounded-on.txt`) |
| the hammer `.slow` files (`vitest.slow.config.js`: Bk2Combat, DashShape, EscapeExact, EscapeGenerated) | **4 passed, 8 / 8** (`d/slow-hammer.txt`; 996 s under a concurrent page sweep) |
| the `.train` files the change reaches (by path, `vitest.train.config.js`) | **4 passed, 11 / 11**: `hammerL53Killlock` (new), `hammerIceTurretStatic` (the L98 kill-lock's turret), `hammerStagedHuntScanMemo` (`deriveKillByChaser`), `hammerChooserPair` (the kill rung's chaser arm) (`d/train.txt`) |
| `ci-producer-checks --jobs=4`, defaults | **97 run, 0 red**, 1 skipped (`d/producer-off.txt`) |
| `ci-producer-checks --jobs=4`, `SEEDLING_KILLLOCK_CHASER_REWIND=1` | **97 run, 0 red**, 1 skipped (`d/producer-on.txt`) |
| identity block (`identity-block.sh .`) | exit 0; every producer `--check` exit 0; r9 campaign `be9c19c8…` (L95-PUNCHER's recorded value); reference ALL MATCH (`d/identity.txt`). ⚠ The first run's `generated set` row was refused by the box lock (this session's own radius sweep held it). The re-run, after every submodule was initialised, is byte-identical on every other row, and that row reads OK |
| `census-seedling-solver-surface --check` | RED first (site counts moved: new `entities`/`ledger`/`state` reads and `killWindowTicks` imports), `--write`, then **GREEN, 371 rows**. No new row to classify (`d/surface.txt`) |
| `census-seedling-constants --check` | **PASS**, 0 new / 0 moved (`d/constants.txt`) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (the docs index word counts); **ALL CHECKS PASSED** (`d/check-ref.txt`) |
| `generate-docs-index --check` | OK (193 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS** (`d/wasm-ship.txt`) |
| `solverEnvChannel.test.js`, `strategySwitch.test.js` | 2 files, 33 passed |
| docs | `seedling-bot.md`: a paragraph naming the switch (OFF) and what it does, before STAGED-HUNT-CHEAP's. `seedling-bot-log.md`: `### Seedling hammer-phase L53-KILLLOCK — …` |
| JSUT | run **42415151367** at `63b6f006` (the last code-bearing head; it carries `9adc0654`'s code): **success**. Suite (unfiltered vitest) **25842 passed, 0 failed**; **slow battery 439 / 439 passed, 0 failed** (`node scripts/procgen/ci-summary.mjs --run=42415151367`; `d/jsut.txt`) |

## 7. What the harvest A/B should expect

**OFF: no movers.** Every new read is behind the switch.

**The ON arm.** The census's 9001/9002 are not in the leg list, so the CI sweep cannot run them. Their witness is the
local page run above (`m/page-sweep-on.tsv`, `m/contact-capture-*`), and it can be re-run with the committed legs file:
`probe-seedling-divergence-sweep.mjs --legs=CC/docs/cloud-reports/seedling-hammer-l53-killlock-evidence/w0/legs-9001-9002-482.jsonl
--mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g --solver-env=SEEDLING_KILLLOCK_CHASER_REWIND=1`.
Expect both to reach L54 with 1 room hit each, until fidelity's rock row lands.

The sweep dispatch for the ON arm (`seedling-divergence-sweep.yml`):
- `solver_env` = `SEEDLING_KILLLOCK_CHASER_REWIND=1`, `keys` empty (the full list), against an OFF run at the same
  SHA. Expect 1 mover: 749 (`level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112`). It answers on the first ask the
  plan OFF answers on its retry, so its end and roomHits should not move; only its `retries` / `budgets` do.
- The narrow form: `keys` = `level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112`, the same `solver_env`.

## 8. What the brief got wrong (measured)

- *"the press bound … the jellyfish's motion model in water"*: the jellyfish's motion in water matches the game to
  0.01 px through t177. The 22.5 px is a body already dying (its third hit landed at dwell tick 161 of 174). The
  arm's real failure is upstream: no stance prices at tolerance 0, so the arm stands where it is.
- *"full on `puncher@136,96` … 39.7 px"*: the puncher is not off-camera or slow. It is pinned on an Ice Wall corner,
  and the game pins it identically.
- *"Say whether its [L95-PUNCHER's] switches change 9001/9002 (measure on a scratch merge)"*: L95-PUNCHER built no
  switch. Its answer is `CHASER_STAGED_HUNT` + `CLEARTAG_STAND`, which are on main, so no merge was needed. Measured
  on main: = D0.
- *"Game witness: 9001 on the p4g page with the switch ON"*: done. It is not hitless in the game (1 hit each), and the
  reason is a model gap outside this slice (§9).
- *"in the landing queue … DOOR-CARRY (`--carry-route-flags`)"*: not needed. The census measured that no L53 leg
  carries a flag.

## 9. Residue and hand-overs

- **⛔ HAND-OVER TO FIDELITY — a broken rock stays solid to chasers two updates past `goneAt` (proposed name
  ROCK-CHASER-FENCEPOST).**
  - **Where:** `levelRun.brokenRockIdsNow` reads `brokenRockIds(rockStateFor(level), ticksCompleted + 1)`. The comment
    beside the burned-tree read says *"(The rocks' query keeps its `+ 1`: nothing here measured it.)"*, and
    `breakableRocks.HIT_TO_GONE_TICKS` names a ±1.
  - **The witness:** `m/contact-capture-9001-on.json.gz` and `-9002-on.json.gz` (p4g, ON).
  - **What the witness shows:**
    - The game's jellyfish are held at `breakablerock@128,160`'s faces on samples 178–179 (9001) and 374–375 (9002),
      and move on 180 / 376.
    - The model frees them at 178 / 374 (= `goneAt`).
    - Read 2 updates later, both captures reproduce every body and the player to 0.000 px (n = 1 and 3 do not).
  - **Is it chasers only?** Not measured. The player was not at a rock face on those ticks.
  - **What it unlocks:** with it, both legs should be hitless on the page. Under the scratch lag, the switch solves both
    hitless (768 t / 959 t).
  - **Rows it moves:** none of this slice's rows (they are model rows). Fidelity's own rows over rock removals would.
- **Leg list (the census's residue, confirmed).** The list has no link legs for rooms that a door does enter, so the
  walk's L53 crossing (`r2c2 → r14c9`) and L92's are missing. A builder mode for the walk's link legs is the lab's call.
  Not changed here.
- **Not measured:**
  - the whole-game walk through L53 with the switch ON;
  - seed 2's own inventory (no seed-2 preset is committed; 9002 copies the vanilla 5.6 inventory, as the census did).
- **Tooling** (scratch, in the evidence `tools/`; they decide nothing): `chain.mjs` (the census's), `room.mjs`,
  `around.mjs`, `body-diff.mjs`, `rocks-broken.mjs`, `cut-fixture.mjs`, `radius.mjs`, `plan-sha.mjs`, `mutants.py`.
  - The scratch worktrees (`wt-dbg`, `wt-mut`) live in the session scratchpad, not in the repo.
  - Commits used the default hook setup (no foreign box lock named this tree).
