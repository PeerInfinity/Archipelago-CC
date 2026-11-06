# Seedling hammer-phase DOOR-CARRY — a leg carries the game flags its route already cleared (opt-in)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-door-carry` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-06 ("Launch DOOR-CARRY now"), from the ruling of 2026-11-05 *"Carry the door for now, solve in visit after that works."* |
| Start SHA | `05bf82cc9f363440551f5aa11356f6fd00a20fba` (origin/main) |
| Head | this report is the last commit on the branch. Steps: W0 `d765c8c4`, M + I (two commits after it), D (docs, the measurements, this report) |
| Branch | `claude/seedling-hammer-door-carry-56b5hz` (the harness's designated branch) |
| Behaviour | **unchanged by default.** No solver, driver, model, generator, fidelity, AS3, wasm, gitlink or rules file is edited. The new mode is OFF (`--carry-route-flags` absent; workflow input `carry_route_flags: false`), and OFF the leg list is byte-identical (`cmp` and a test row) |
| Files | `scripts/procgen/seedling-divergence-legs.mjs` (the mode), `probe-seedling-divergence-sweep.mjs` (the row stamp and a `ROUTE-CARRY:` line), `.github/workflows/seedling-divergence-sweep.yml` (one boolean input, stamped in the run name), `seedlingDivergenceRouteCarry.test.js` (new), `seedlingDivergenceSweep.test.js` (+1 row), `sweepControl.test.js` (the rendered default title gains `carry=false`), `seedling-bot.md`, `seedling-bot-log.md`, and the regenerated procgen reference |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-door-carry-evidence/` (`w0/`, `m/`, `w1/`, `radius/`, `tools/`) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` READY; every submodule initialised (the wasm one included: the page runs drive `seedling_bot_ap_p4g`); node v22.23.4; 4 cores; dev server :8000 (`serve-nocache.py`, started here) |

## 2. The answer first

**The one thing to know first: "earlier than the leg" has to mean the route's COLLECTION order, not the sphere a goal
becomes accessible at.** BK2, the Chest and flag 12 all become accessible at sphere 5.3 (row 29). By that order BK2
carries nothing, because its leg's inventory lacks flag 12. The route actually collects flag 12 at 6.1 (row 33), BK2 at
6.6 (row 38) and the Chest at 6.7. With that order, BK2 carries the door. This is the census's "a real player clears flag
12 before BK2 on the same save", made mechanical.

| question | answer |
|---|---|
| How many legs does the carry touch? | **87 of 930** (exit 27, location 60), across 14 levels. 41 more have a carry that their existing staging already holds, so they are not stamped and not changed |
| Are L40's BK2 / flag-8 arrivals among them? | **Yes.** BK2 869/870 carry `flag:L40:12`. Flag 8 395/412 carry `flag:L40:12`, `:1` and `:7`. The Chest 394/411 carry `flag:L40:12` too. Flag 12's own legs 871/872 carry nothing (a leg never carries its own goal) |
| Does the game take the carried flags? | **Yes, every one.** 87/87 rows read the carried flags back from `persistence_cleared`; 0 `stage-failed` |
| The L40 legs under the carry, at main's defaults | all six still **refuse** (page and node). BK2 now stops at `hold stance (wandlock@448,432)` instead of the BobSoldier; flag 8 still has no reachable key-line stance; the Chests stay on the SE fight |
| …with `LATCH_WEIGH_FIRST` + `TURRET_APPROACH` + `APPROACH_DOOR` | **869 SOLVED** hitless, 4491 t, 3236 u (over the 2560 retry by 676). **870 SOLVED** hitless, 4519 t, 1021 u (fits) |
| …with `KEYLOCK_TURRET` (merged in a scratch tree, not committed) | **395 SOLVED** hitless, 718 t, 2534 u (fits the retry by 26). **412 SOLVED** hitless, 748 t, 323 u |
| …with all four | all four of the above solve, at the same numbers |
| The radius at the defaults (page, 87 carried legs, ON vs OFF) | **77 unchanged; 6 gained; 2 lost; 2 changed end but not verdict.** Detail in §5 |
| Design | **an opt-in leg-list mode** (`--carry-route-flags`), not a derived `--stage-flags` spec (§4) |

## 3. W0 — the flags each leg's route has already cleared

Tool `tools/w0-carry.mjs`, output `w0/w0-summary.txt` and `w0/w0-touched.tsv`. It is an INDEPENDENT derivation: it
reads the rules and the sphere log itself. The implementation's carry matches it on all 930 legs (0 mismatches).

- **The flags:** the 36 `game_state` events of the playthrough (`event_kind: 'game_state'`, an integer
  `obstacle {level, tag}`). The route collects all 36. Chests, keys and totem parts hold persistence tags too, but the
  rules carry no `obstacle` for them, so they are out of scope.
- **The leg's place in the route:** a location goal sits at the row where the route collects it, and carries flags
  collected at a row before that. An exit goal crosses with its sphere's inventory, and carries flags collected at rows
  up to and including that sphere (the AP inventory the leg already holds). A goal the route never reaches carries
  nothing.
- **The persistence the room reads** (from the AS3): a room is built from its own level's table. The only cross-level
  read is `Scenery/FinalDoor.as:50`, `checkPersistence(0, watcher_text)`, where L113 reads L114's Watcher flag.
  `ButtonRoom.as:93` writes another room's slot but reads none.
  - In the rules, the only rule that names another level's flag *other than the exit's own target level* is exactly
    that one: L113 → L115 and the L113 flag-0 location naming L114:0. Every other cross-level name is a door edge's
    far-side obstacle (e.g. `level_12__r0c19 -> level_0__r11c19` naming L0:1), which the far room reads.
  - L113's legs already stage L114:0 as a goal event, so at this SHA every carried flag is the leg's own level's.
- **Own goal:** a flag-location goal never carries its own flag.

| level | legs touched |
|---|---|
| 12 | 28 |
| 40 | 18 |
| 63 | 9 |
| 30 | 8 |
| 0 | 7 |
| 62 | 5 |
| 71 | 3 |
| 39, 101 | 2 each |
| 16, 20, 28, 68, 112 | 1 each |

Flags added per touched leg: 1 → 53 legs; 2 → 16; 3 → 4; 4 → 7; 7 → 7. The sevens are L12's Witch legs and the late L12
locks.

L40's 18: the north-west room r0c53 (369–378: its teleporter exits, flags 1/7 and Totem Part 64,144), the r23c29 room
(393–395, 410–412: Totem Part 160,640, Chest, flag 8) and BK2 (869/870).

## 4. M — the design

| | **A. leg-list mode `--carry-route-flags` (chosen)** | B. keep the default, derive a `--stage-flags` spec by key |
|---|---|---|
| Where it is computed | the leg list, which already holds the sphere log, the rules and the event map | a new deriver, then a `<key>=>L:T,…|…` string in a dispatch input |
| Default list and baselines | byte-identical OFF (pinned) | byte-identical |
| Stamp | `carriedFlags` on the leg, so every row carries it, plus a `ROUTE-CARRY:` line | `stagedFlags`, the WITNESS stamp, which reads as a hand-picked model witness rather than the route's state |
| The whole inventory | one boolean | an 87-key spec; a key that moves at a later SHA fails the run |
| Channel (setter, read-back, `stage-failed`, a page of its own) | the same `stagedEvents` channel | the same |

**Recommendation: A.** B stays available for one-leg witnesses (KEYLOCK-TURRET's use). But the route's state is a
property of the leg list, not a hand witness, and the radius needs the whole list. `m/design.md` holds the table and
the rule.

## 5. I — the mode, its rows, the measurements

**The mode.** All of it is in `seedling-divergence-legs.mjs`; every function is exported and pure.
- `collectionRows(log)`: the route's collection row per location.
- `routeBefore(goal, sphere, collected)`: the test above.
- `levelReads(level, …)`: own flags, plus another level's flag a rule of the level names, except an exit's target level.
- `routeCarry({goal, sphere, flags, collected, reads})`: the derived list, in collection order, never the leg's own
  goal.
- `withRouteCarry(leg, carry)`: appends the flags the leg's `stagedEvents` lacks (with `otherLevel` as written) and
  stamps `carriedFlags` with exactly those. A leg it adds nothing to, or a skipped leg, is returned as the same object.

The sweep: `stamp(leg)` also emits `carriedFlags`, so every row of a carried leg (run, skipped, hang, page-boot-failed)
says so, and a `ROUTE-CARRY: N leg(s)` line names the run. The workflow: `carry_route_flags` (boolean, default false)
reaches only the plan job's leg-list line (`${CARRY:+--carry-route-flags}`) and is stamped in the run name.
⚖ "Flags flow game → AP only" is unchanged in the runtime: this is the harness's staging, as the event staging is.

**Rows** (`seedlingDivergenceRouteCarry.test.js`, 19 rows):
- collection row versus accessibility;
- location `<` versus exit `<=`;
- a never-reached goal carries nothing;
- L40's BK2, flag 8 and flag 12 on a synthetic table;
- reads with the far-side exclusion and the FinalDoor read;
- `withRouteCarry`'s dedup, same-object and skip rules;
- the stamp;
- on the committed list: OFF holds no `carriedFlags`; ON keeps every key in order; every uncarried leg is
  byte-identical; every carried leg is its OFF self plus exactly `carriedFlags` appended; no own goal, no skipped leg,
  no repeated flag; the radius pin is 87; the L40 carries are exact.

Plus `seedlingDivergenceSweep.test.js`'s workflow row (default false, stamped, plan only).

**Mutants, one per rule:**

| rule | the slip | caught by |
|---|---|---|
| never its own goal | `<=` on a location goal | the own-goal row |
| the room's reads | every flag read | another level's flag appears |
| the door edge's far side | the target-level exclusion dropped | L0:1 reads as L12's |
| collection order | the accessibility sphere used instead | BK2's inventory at 5.3 lacks flag 12, yet BK2 carries it |
| OFF is byte-identical | any change to the default list | the byte rows |

**The L40 legs.** On the page, at main's defaults, with the carry (`w1/page-arm1-rows.jsonl`): all six refuse.

| leg | OFF (L40-CENSUS W0) | ON, page and node, defaults |
|---|---|---|
| 394 Chest | the BobSoldier notch (A2) | the same (deadline, then ladder exhausted at `bobsoldier@880,832`) |
| 411 Chest | death at t822 on the SE press (A1) | the same |
| 869 BK2 | A2 (BobSoldier) | `shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432)`: ladder exhausted |
| 870 BK2 | A1 | the same as 869 |
| 395 / 412 flag 8 | wall F (no reachable key-line stance) | the same |

**Node replays** of those captured requests: `tools/chain.mjs` (L40-CENSUS's instrument, copied unchanged), cap 8192
units, `tools/arms-carry.sh`, `w1/chain-arms.txt`. KEYLOCK_TURRET runs in a scratch worktree, main + the
`claude/seedling-keylock-turret-flag8-twuh7u` branch merged (its one conflict was the census JSON; never committed).
Rows are ticks / work units:

| leg | D0 | LWF+TA+SD | KT | KT+LWF+TA+SD |
|---|---|---|---|---|
| 869 BK2 | REFUSED 492 u | **SOLVED** 4491 t / 3236 u, hitless | REFUSED | **SOLVED** 4491 t / 3236 u |
| 870 BK2 | REFUSED 496 u | **SOLVED** 4519 t / 1021 u, hitless | REFUSED | **SOLVED** 4519 t / 1021 u |
| 395 flag 8 | REFUSED 20 u | REFUSED | **SOLVED** 718 t / 2534 u, hitless | **SOLVED** 718 t / 2534 u |
| 412 flag 8 | REFUSED 20 u | REFUSED | **SOLVED** 748 t / 323 u, hitless | **SOLVED** 748 t / 323 u |
| 394 Chest | REFUSED 1920 u | REFUSED | REFUSED | REFUSED |
| 411 Chest | REFUSED 82 u | REFUSED | REFUSED | REFUSED |

Each SOLVED plan was replayed on a fresh run of the model: no hits, no deaths. The BK2 numbers equal the census's
hand-staged tag-12 arm (4491 t / 3235 u and 4519 t / 1020 u, dashless) to within a unit. The flag-8 legs also carry
flags 1 and 7, where the census and KEYLOCK-TURRET staged tag 12 alone.

**The radius at the defaults** (page, `--page-legs=60`, the 87 carried ids, ON from the carried list and OFF from the
default list; `radius/radius.tsv`, `radius/radon-rows.jsonl`, `radius/radoff-rows.jsonl`):

| class | legs |
|---|---|
| same verdict, same end, same hits | 77 |
| same verdict, other end | 2: 186 crossed → done; 580 timeout → failed |
| **GAINED** (ON passes, OFF does not) | **6**: L40 r0c53's wandlock legs 372 (+1 hit), 373, 377, 378 (OFF: the clear-tag `hold` ran but stopped with the group LATCHED; ON: done); 552 L62 → L63 exit (carries L62:0, the lit pole; OFF: the darktrap ladder exhausted); 909 L63 Chest (OFF: no corridor past `pushableblockspear@112,96`) |
| **LOST** | **2**: 371 L40 Totem Part 64,144 (carries 12+1+7+8; the anytime deadline at its walk), 578 L63 r10c2 → teleporter (carries L63:1; the bridge spear stance has no reachable floor cell) |

By mover class: 4 are L40's north-west latch room (all gained). 2 are L62/L63 (dark rooms) gained, and 1 L63 lost. 1 is a
budget loss in L40. Movers outside L40 are the carry's own business, not the door's. Each is one page run, not repeated.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52): the 15 files that import the touched modules or pin their sources (`seedlingDivergence*`, `seedlingSolveRequestCodec`, `boxLock`, `sweepControl`, `dashShape`, `fidelityLapseCost`, `solverEnvChannel`, `strategySwitch`) | **267/267** |
| `contentIdentity.test.js`, `entityBlocks.test.js` | 60/60 |
| `census-seedling-solver-surface --check` | GREEN (371 rows; no solver line moved) |
| `census-seedling-constants --check` | PASS |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (my flag in the instruments index, docs words); ALL CHECKS PASSED |
| `generate-docs-index --check` | current |
| `ci-producer-checks --jobs=4` | **97 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm by design). ⚠ An earlier pass, run beside the identity block on the same 4 cores, printed `1 red` with its log cut off, so I cannot name it. The rerun at the same code was 0 red |
| identity block (`identity-block.sh`, head vs a pristine `05bf82cc9f` worktree on its own :8124 server) | **identical**, every md5 row (maze, acceptance, kind pairs c3/c6/c4, enemy/element/area censuses, killgate s2/s5/s9, levels s1, the six `solve-seedling-r8/r9 --check` producers, exit 0). Two rows first differed, both from the worktree environment: `generated set` (the worktree has no venv; OK once the primary venv is activated) and `reference` (the worktree has only the symlinked submodules, so the substrate registry lacks the other substrates' columns) |
| hammer `.slow` / `.train` files | **none reachable**: no hammer `.slow` or `.train` file imports the leg list, the sweep or the workflow, and no solver file changed. None run |
| `check-seedling-wasm-ship` headless | not run: nothing under its paths changed |
| JSUT | run **42146301199** at `c886b43c` (every code change; later commits are docs/evidence only): **25714 passed, 0 failed**; the **slow battery 414/414** green |

⚠ Two commits (docs and evidence only) were made with `BOX_LOCK_COMMIT_ANYWAY=1` under my own running sweep's lock. The
sweep never loads those files, so no measured run changed tree mid-flight in a way that matters.


## 7. What the harvest A/B should expect, and the ON dispatch

- **OFF (any sweep without the input): no movers.** The default list is byte-identical: no `carriedFlags`, no new
  staging, no new pages. A control at this head equals main's.
- **ON, the radius**, against an OFF sweep of the same SHA and ids:
  `gh workflow run seedling-divergence-sweep.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-hammer-door-carry-56b5hz -f carry_route_flags=true -f ids=<the 87 ids in radius/radius.tsv>`
  (or no `ids` for the whole inventory: only the 87 differ). Expect the six gains and two losses of §5 or nearby. Every
  carried leg is a page of its own, so the ON sweep adds about 87 page boots.
- **ON, the L40 witness with the wave-6 switches on main:**
  `-f carry_route_flags=true -f ids=869,870,394,411,395,412 -f solver_env="SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1"`.
  Expect 870 to pass. 869's solve needs 3236 units, past the page's 2560 retry: expect `failed` at the deadline unless
  the budget moves.
- **With KEYLOCK_TURRET** (once harvested, or from a branch carrying both): add `;SEEDLING_KEYLOCK_TURRET=1`. Expect
  395/412 to pass (2534 / 323 units).

## 8. What the brief got wrong (measured)

- **"The AP route places flag 12 and BK2 in the same sphere"** is true of where they become ACCESSIBLE (5.3), and that
  is exactly the order by which BK2 would carry nothing. The route's collection order puts the door first (6.1 < 6.6).
  The rule had to be stated in collection rows to make the ruling hold.
- **"The flags flow game → AP only, so a leg at 6.6 holds flag 12 as an AP item":** BK2's leg sits at 5.3 and does NOT
  hold flag 12 as an AP item. The flag-8 legs (6.6) do. BK2's mismatch was that the route reached it later than its
  sphere says.
- The brief named BK2 and flag 8. **The Chest legs (394/411) carry the door too** (the route collects the Chest at 6.7).
  It moves nothing for them: their wall is the SE fight.
- **The carry is wider than the door:** the flag-8 legs also carry flags 1 and 7 (r0c53's wandlocks, collected 7.1/7.2,
  before flag 8 at 7.3), and 69 of the 87 touched legs are outside L40.

## 9. Residue and hand-overs

- **869's budget:** 3236 units on the carried request, over the 2560 retry by 676 (the census's A3 / budget question).
- **The two losses** (371 deadline, 578 L63 bridge stance) and 372's hit are one page run each. A repeat at a second seam
  says whether they are carry movers or phase flakes. 578's refusal (*"no floor cell … puts the spear's rect on it"*)
  is the solver's bridge rung under L63 flag 1 cleared: a state the route reaches, which the solver did not see before.
  It is a solver hand-over, not a harness one.
- **"Solve in visit after that works"** (the ruling's second half) is unchanged: walls D and E stand for a BK2 leg that
  does not carry the door.
- The scratch worktrees (`kt`, `base`) and the dev server live in the scratchpad only; nothing of them is committed.
