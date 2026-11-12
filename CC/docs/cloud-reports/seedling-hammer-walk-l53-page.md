# Cloud report: `seedling-hammer-walk-l53-page` — does the kill-lock rewind's L53 → L54 plan play hitless in the game? (MEASUREMENT ONLY)

Planner: `seedling-hammer-phase-planning-5`. Ruling: the user, 2026-11-11, *"Page play, then flip both (Recommended)"*.
This slice is the page play. No solver, model, fidelity, driver, flashPanel, rules, AS3, wasm or gitlink file was changed,
and no switch was flipped.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `b704baece038494f08b65ef78172a41c63a83fd2` (`origin/hammer-harvest-new-locks`, over main `737a451f50`). The session's own checkout started at main `737a451f50` |
| Instruments (not for landing) | WALK-WALLS' `8fc6dd3c` (walk knobs) → `be18b6c7`, and `d2a6b6e0` (request capture) → `c9b87e11`. Both cherry-picked cleanly. This slice adds `71930b23`: the `TEST_MEASURE_SOLVER_ENV` knob (app.spec.js, +6) and the evidence tool `tools/play-request.mjs` |
| Evidence commits | `533ba6e9` (request replay), `e56c77fd` (the walk) |
| Head | this report's commit (the last on the branch) |
| Branch | `claude/seedling-l53-page-hitless-test-n8e8a7` (the harness's designated branch; it is this brief's branch) |
| Environment | bootstrap `--seedling` READY; the five non-wasm submodules shown `-` were initialised before any run; node v22.23.4; dev server `:8000` (`serve-nocache.py`, started here as PID 997 and stopped) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-walk-l53-page-evidence/` (`replay/`, `walk/`, `tools/`) |
| Planner messages | none arrived |

## 2. The answer first

**Yes: the plan plays hitless in the game.** On the p4g wasm game (the default build), the walk's L53 → L54 exit plan
has 0 room hits and 0 divergences, and the player arrives in L54 at (152,24) on the plan's last tick. This holds with
REWIND + LINE_STANCE (608 ticks) and with REWIND alone (768 ticks). Every drained game row equals the model's
`plan.expected` row, to the bit.

**The one thing to know first:** the whole-game walk with both switches on **passed entry 24** (BK3 via
`level_53__r14c9 -> level_54__r1c8`) with no re-plan. Its own solve gave the identical plan (`47828ac6e4c5`).
**The walk's next new stop is entry 25 at `level_58__r3c3`: "L58 flag 1: yeti@56,56 cleared".** The solver has no verb
for `solid:yeti`. This is a catalogue gap, not a kill-lock one. L40 Boss Key 2 (entry 19) is still skipped first, as
WALK-WALLS measured; it is a staging wall that these switches do not touch.

## 3. The harness and why

**Primary: a request replay on the game page** (`tools/play-request.mjs`). It is the cheapest harness that plays the
walk's OWN request, and it can repeat the second arm at no cost. It has two phases:

1. **Solve** (node, `SEEDLING_*` env set, read back from solverBot's switch objects). The captured request
   (WALK-WALLS' `l53/walk-req112-l53-l54-2560.json.gz`) is solved with `solveAnytime`, the page worker's dispatch, using
   the request's own passes and its 2,560 budget. The plan is replayed on a fresh model run (chain.mjs's `modelled`).
   It is then folded into a tape the probe-seedling-l107-lane way: `buildStagedTape` over the request's own staging,
   with its seam clock (40623) and rng seed kept, so a fresh game boots at the state the model solved against, and
   `plan.equipsAt` → tape equips (none here).
2. **Play** (one fresh p4g page per tape, headless logic-only, under the box lock). The steps are `botLoadTape` →
   `botStart` → drain to the latch. `botStatus.hits` is sampled on every 50 ms poll; it is the field the divergence
   lab's `roomHits` reads. The drained rows are compared with `plan.expected` by `wasmPlayback.firstDivergence`'s rule.

**The instrument's controls:**
- Shifting `expected[300].x` by +0.5 px is caught at t300 (`replay/play.txt`).
- `botStatus` exposes `hits` and `hits_timer`. A 400-tick stand-still tape at the same staging took no hit: the chasers
  do not reach the boot tile. That shows the field is present and staged at 0, **not** that it rises.
- That the field rises on a game hit in this room was measured by L53-KILLLOCK (9001/9002, `roomHits max 1`).
- The independent signal is the stream: a hit knocks the player back (L53-KILLLOCK: −2.72 px), and no row moved.

⚠ **This harness's staging differs from production.** Production ships `shippedTape` (seam null, `SHIPPED_RNG`, the live
game's clock and rng left alone) onto the live game. This harness instead boots a fresh game at the declared clock and
rng. The walk (§5) is the production check of the same plan.

**Secondary: one whole-game walk.** It used WALK-WALLS' harness and knobs plus
`TEST_MEASURE_SOLVER_ENV='SEEDLING_KILLLOCK_CHASER_REWIND=1;SEEDLING_KILLLOCK_LINE_STANCE=1'` (new, measurement only:
it appends `?seedlingSolverEnv=` to the app URL, and the solve worker reads the page's own `location.search`), skip
probe `TEST_MEASURE_SKIP_REFUSALS=10`, and capture `(-53|L53-|-54)`. I ran it because it answers Q4 and plays the plan
through the production engine.

## 4. The play, per arm (request 112, p4g)

| arm | node solve at 2,560 (page budget) | model fresh run | game (p4g) |
|---|---|---|---|
| defaults | **REFUSED, 2,562**: the live text verbatim (jellyfish@152,168 dwell HIT at dwell tick 145, run tick 374) | — | nothing to play |
| **REWIND + LINE_STANCE** | **SOLVED, 841 u** (dashless 707 t / 714 u; full 608 t / 127 u, the plan), verbs break, kill, walk, digest `47828ac6e4c5` | agrees with `expected`, 0 hits, 0 deaths, ends L54 | **608 rows compared, first divergence none, hits 0 → 0 (no rise), arrives L54 (152,24) at t608**, no error. Game rows digest `a89ae8435e15` |
| **REWIND alone** | **SOLVED, 1,770 u** (dashless 768 t / 1,201 u; full refused in its window), digest `4723c92643d7` | agrees, 0 hits, 0 deaths, ends L54 | **768 rows compared, no divergence, hits 0, arrives L54 (152,24) at t768**, no error. Game rows `b385ac972930` |
| request **114** (the §5 walk's own retry), REWIND + LINE_STANCE | SOLVED 841 u, **the same plan `47828ac6e4c5`** (also from the committed cut) | agrees, 0 hits | **608 rows, no divergence, hits 0, L54 at t608** |

Q3 (hit or divergence: where, whose class) does not arise. Both arms are hitless and exact.

The numbers equal WALK-WALLS §4's page-budget column unit for unit (1,770; 841).

What was NOT compared: the bodies' positions. Only the player's stream and the game's hit counter were compared.
L53-KILLLOCK's rock fencepost (jellyfish held two updates at `breakablerock@128,160`'s faces) is not visible in this
stream. Both plans break a rock, and the player stream still matches through every tick. So if the fencepost is
present here, it does not reach the player.

## 5. The walk with the env on: its stops

`PASSED 2020.8s` (the ratchet, not victory), `bot-plays` 2008.6 s. The results JSON records `treeMoved: true`: evidence
commit `533ba6e9` landed during the run under `BOX_LOCK_COMMIT_ANYWAY=1` (no code changed). The output is in
`walk/walk-probe-run.txt` and `walk/walk-solve-summaries.jsonl`.

| skip | t | entry | where / why |
|---|---|---|---|
| 1 | 1428 s | 19/48 "Level 040 - Boss Key 2" (6.8) | Still refused, with **different text**: "shove stance (pushableblockfire@576,576) → weigh → iceturret@472,400 approach door wandlock@480,560 … combat ladder EXHAUSTED … `spinner@880,848`", then out of 640/2560 (requests 93/94). WALK-WALLS' stop text was a pure deadline. Not investigated: the wall is still WALK-WALLS' missing flag 12 (staging) |
| — | — | **24/48 "Level 055 - Boss Key 3" (6.13)** | **Passed.** Request 113 (640) hit the deadline (643). The retry, 114 (2,560), solved at 841 u. The next solve is L54's exit (115, 142 u), so the engine never re-planned L53: the shipped plan did not diverge at 0 px. BK3 itself followed: `wasm-location-55` (118, 94 u) |
| 2–10 | 2005–2017 s | 25/48 "Level 089 - Feather" (6.14) onward | **At `level_58__r3c3`: "L58 flag 1: yeti@56,56 cleared" is a saved-obstacle EVENT … the solver's clear-tag refuses it — no-verb: no strategy row exists for `solid:yeti`."** After that come "no path from level_58__r3c3 …" rows. The walk ended there (entries 25–34 skipped) |

So the env moves the walk's stop from entry 24 (L53, WALK-WALLS) to entry 25. WALK-WALLS' third stop, the L91 drill
(`level_91 -> level_89__r1c10`), is not reached: the walk now stops before it, at L58.

The walk's staging at L53 carries one more cleared flag than WALK-WALLS' did, `{40,15}`, because this walk solved
another L40 goal (95/96). It does not change the L53 plan (same digest).

## 6. Next step

**The flip as ruled.** The page play the user asked for first is hitless with both switches, and also with REWIND alone.
Per the ruling, the next slice builds one flip of both `KILLLOCK_CHASER_REWIND` and `KILLLOCK_LINE_STANCE` after
NEW-LOCKS lands (3 sweeps + keyed + surveys), brought back as a landing question tied to its SHA. Nothing measured here
blocks it.

For the planner to word (not done here):
- the L40 BK2 staging (WALK-WALLS' WALK-ROUTE-EVENTS);
- the new L58 yeti clear-tag wall (`solid:yeti` has no catalogue verb). It needs to be measured first: is the yeti event
  on the AP route's path to entry 25, and is it killable in the game?

## 7. What the brief got wrong (measured)

- *"If no harness replays a captured request on the page, run the whole-game walk"*: one does, in effect.
  `probe-seedling-l107-lane.mjs`'s pattern (captured staging → `buildStagedTape` → p4g) plays a solved request's plan.
  I generalised it as `tools/play-request.mjs`. I ran the walk anyway, for Q4 and the production path.
- *"with `?seedlingSolverEnv=…` [on the walk]"*: the app harness had no way to put that param on the app URL.
  `TEST_MEASURE_SOLVER_ENV` was added (measurement only). The capture's answer summary carries no `solverEnv` stamp, so
  the env was confirmed by behaviour: 841 u and a solve where the defaults refuse, unit for unit, plus the node replay
  of 114 giving the same digest.
- *"full pass 608 t with sword-dash used"*: confirmed, the shipped plan is the full pass's 608 t.
- *"skip probe … so it gets past L40's BK2 wall"*: it did. Note that L40's refusal text changed under the env (§5).

## 8. Residue

- Branch commits: the two cherry-picked instruments, the knob + tool, two evidence commits, this report. Nothing to
  land as-is.
- The uncut walk capture (`cap-walk.jsonl`, 128 lines) and the full arm JSONs (with tapes and expected rows) stayed in
  the session scratchpad. The committed cuts are 113/114 (levels 53+54); the 114 cut replays to the same digest.
- Dev server PID 997 stopped. The box lock was released by its runs. No preset, `preset_files.json` or test-results file
  is in the tree.
- Not run: pytest, unfiltered vitest, `standing-values --write`.
