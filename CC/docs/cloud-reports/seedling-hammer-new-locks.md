# Seedling hammer-phase NEW-LOCKS — the L18, L26 and L53 lock legs (`KILLLOCK_CLEAR_WRITE`, `ROCKLOCK_KILL`, `KILLLOCK_LINE_STANCE`, all OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-new-locks` (planner `seedling-hammer-phase-planning-4`), cloud. ⚖ The user, 2026-11-10: *"One slice, all three (Recommended)"* |
| Start SHA | `a66a450e7048d09f7fcfbb1ffa643e24141ab065` (= `origin/main` at launch; train 77) |
| Head | W0 `88170267`; M+I `25646124`; I `16287cfd`; D `655d52fd` (the last code-bearing head); this report is the last commit on the branch |
| Branch | `claude/seedling-hammer-new-locks-qfgbia` (the harness's designated branch; nothing pushed elsewhere) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-new-locks-evidence/` (`w0/`, `m/`, `i/`, `radius/`, `d/`, `tools/`) |
| Scope | The brief's. No follow-up from the planner reached this session |
| Environment | bootstrap `--seedling` READY (it initialised `shared`, `bulletml-dodge`, the wasm builds and `vendor/seedling`). ⚠ Brief miss: the five other non-wasm submodules were initialised only AFTER the gates; `generate-procgen-reference` (no diff), `check-procgen-reference`, the docs index and `check-procgen-docs` were then re-run, all green; node v22.23.4; 4 cores; `:8000` `serve-nocache.py` (started here), and a second server on `:8123` over a scratch copy with the four switches flipped (the page witness, §4) |

## 2. The answer first

**The one thing to know first: all three parts are solved, and on the real page (p4g) all five legs end done with 0
room hits and the flag collected. But the page witness for L26 needs the switch on the page's MAIN thread, which
`?seedlingSolverEnv=` does not reach.** The goal mapper (`jsRuntimeSolver.clearTagVerbOf`) decides `no-verb` on the main
thread, from its own copy of `OBSTACLE_STRATEGIES`, before any request is made. So an ON sweep through `solver_env` moves
223, 910 and 911, and leaves 286/289 `no-verb` until `ROCKLOCK_KILL`'s default flips. The witness here is a scratch copy
with the defaults flipped, served on its own port.

| part | answer |
|---|---|
| **L18 (223)** | **SOLVED, and the fix is the solver's.** The kill works. The model writes `{18,0}` through its scratch layer (`run.scratchClears`, t360 = the second spinner's removal t259 + the lock's 101-step fade) and rebuilds the world without the lock. The clear-tag order waited on `earnedClears`, which has no kill-lock arm, and refused `not-written`. **`KILLLOCK_CLEAR_WRITE`**: the order reads the scratch row for that lock and flag. Node 361 t, 0 hits; page done, 0 hits, flag collected |
| **L26 (286, 289)** | **SOLVED.** `rocklock@112,208` is `tset -1`, tag 0, two punchers, no presser: a kill-lock. **`ROCKLOCK_KILL`**: the row (`Lock`'s `hold`, switch-gated), the instance asked for its opener (`tset == -1` → `kill`), the lock row taken from the level's kill-lock list. It also needs `KILLLOCK_CHASER_REWIND` (the punchers) and `KILLLOCK_CLEAR_WRITE` (the finish). Node 629 t / 315 t, 0 hits; page done, 0 hits, flag collected (scratch flip) |
| **L53 (910, 911)** | **SOLVED.** **`KILLLOCK_LINE_STANCE`** on top of `KILLLOCK_CHASER_REWIND` (+ `KILLLOCK_CLEAR_WRITE` for the finish). Node: 911 606 t at the first ask (640), 910 799 t at the held retry (2560), 0 hits; page done, 0 hits, flag collected |
| Hand-overs | None blocks a leg. Two notes for other owners in §9: the mapper is keyed by class and the solver by instance (lab); a RockLock's fade is read as a Lock's (fidelity) |

What each fix is derived from, and which shipped rooms it reaches, is in §5.

## 3. W0 — reproduce, and the census

**Page, defaults** (`w0/page-sweep-d0.txt`; `probe-seedling-divergence-sweep.mjs --ids=223,286,289,910,911 --mode=inv
--producer=solver --page-legs=1 --page=seedling_bot_ap_p4g --capture-requests=…`, 90 s legs):

| id | end | the refusal |
|---|---|---|
| 223 | failed | `clear-tag {18,0} lock@144,112: 'kill' ran (…), and the run's earnedClears still does not hold {18,0} 120 ticks later` (`not-written`) |
| 286, 289 | failed | `no-verb: no strategy row exists for solid:rocklock`, said by the MAPPER: **no request is made** |
| 910 | failed | `chaser kill (puncher@136,96) by press: … after the whole 191-tick bound … blocked by tile:Ice Wall — the body is PINNED` (640 deadline, then 2560) |
| 911 | failed | `the count is still waiting on [four bodies] and no stance derives for any of them` (previews do not settle) |

These are the planner's five rows. **Node**: 223's captured request replays to the same refusal (148 units,
`w0/node-223.txt`); 910/911's requests replay to the page's texts (`radius/summary.txt`, the `off` arm). 286/289 have
no request at the defaults; theirs were captured on the scratch flip (§4) and replay OFF to the solver's own `no-verb`.

**The census** (`w0/census-locks.txt`, `tools/census-locks.mjs`, over `seedling-map.json`):

- **Rocklocks: 2.** L26 `rocklock@112,208` (`tset -1`, tag 0; counted `puncher@32,208`, `puncher@80,168`; no
  presser). L112 `rocklock@112,16` (`tset 0`, tag 1; the Final Boss's group lock, no presser).
- **Kill-locks (a `KILL_LOCK_TAGS` entity with `tset -1`): 10.** L5, L18, L26 (the rocklock), L39 (a wandlock), L53,
  L60, L71, L78, L98, L99. Only three have an event leg that asks the kill work order: L18 `{18,0}`, L26 `{26,0}`,
  L53 `{53,2}` (L39's `{39,8}` is pressed from L38).
- **A counted body pinned behind a solid from some arrival** is a state, not a census row: it is measured in the ON
  radius (§5), over every leg of those ten levels and L112 (71 legs).

## 4. M — the measurements

**L18: why `{18,0}` does not set** (a debug dump at the refusal, in a scratch worktree; `i/` rows pin it):

- `spinnerKillLockOpens`: `spinner@48,96` removed t112 (*"totalEnemies() is still 1"*), `spinner@112,48` removed t259
  (*"went 2 -> 0"*, opens `lock@144,112`). The solver's count is the game's: both spinners, nothing omitted.
- `run.scratchClears`: `{level 18, tag 0, at 360, removedAt 259, lock 'lock@144,112'}`. The write is made, on the tick
  the fade ends; the world is rebuilt without the lock.
- `run.ledger('earnedClears')`: **empty**. `levelRun.earnedClearsNow` lists lock snaps, key opens, poles, room writes,
  rocks, bosses; it has no kill-lock arm.
- So none of the brief's four candidates is the cause. The model does model it; the solver read the other ledger.
  The fix is in `execClearTag` (the solver), on the pattern its rope arm already uses (`ropePulls`).

**L26: what opens the rocklock.** `RockLock.as:52`: `tSet == -1 && totalEnemies() == 0`, then 0.01 alpha an update,
`type = ""` and `setPersistence(tag, false)` at 0. The instance: `tset -1`. The model already bills it
(`combat.KILL_LOCK_TAGS` holds `rocklock`; the kill-lock ledger opens it; the scratch layer writes `{26,0}`). With the
row alone the kill work order takes it and its chaser arm refuses *"the count is still waiting on [puncher@32,208,
puncher@80,168]"*: every preview *"did not settle — 400 tick(s)"*, which is L53-KILLLOCK's finding (1). With
`KILLLOCK_CHASER_REWIND` both punchers die.

**L53: where the work went.** Leg 910 with the rewind and a first cut of the line stance solved in 3,556 units, above
the 2,560 retry: **3,193 of them were `deriveKillByChaser` scans of bodies that could not come** (the jellyfish behind
the arena wall, ~500 units a scan, twice). Skipping the scan for a body pinned from where the player stands took 910 to
809 units and 911 to 169.

**The arms, node, the page's own budgets** (`m/fixture-cut.txt`, `radius/summary.txt`; `fix-solve.mjs` = the worker's
`solveAnytime`; every solved plan re-driven on a fresh run):

| leg / request | defaults | the three new | + `KILLLOCK_CHASER_REWIND` |
|---|---|---|---|
| 223 / 0 (640) | refused `not-written` | **361 t**, 0 hits | 361 t |
| 286 / 0 (640) | refused `no-verb` | refused (the punchers) | **629 t**, 0 hits |
| 289 / 0 (640) | refused `no-verb` | refused (the punchers) | **315 t**, 0 hits |
| 910 / 0 (640) | deadline | = defaults | deadline-bound (another text) |
| 910 / 1 (2560) | refused, puncher PINNED | = defaults | **799 t**, 0 hits, 953 units |
| 911 / 0 (640) | refused, no stance | = defaults | **606 t**, 0 hits, 642 units |

**The page witness** (p4g, 90 s legs):

- `--solver-env=SEEDLING_KILLLOCK_CLEAR_WRITE=1;SEEDLING_ROCKLOCK_KILL=1` on `:8000` (`m/page-sweep-ab.txt`): **223 done**,
  426 t, 0 room hits, `{18,0}` set and collected. 286/289 still `no-verb` from the mapper (the main thread).
- The scratch copy with the four defaults flipped, `--host=http://localhost:8123` (`m/page-sweep-flip4.txt`,
  `m/page-sweep-flip4.jsonl`):

| id | end | plan | room hits | flag |
|---|---|---|---|---|
| 223 | done | 430 t, `kill` | 0 | `{18,0}` set, collected |
| 286 | done | 629 t, `kill+walk` | 0 | `{26,0}` set, collected |
| 289 | done | 315 t, `kill` | 0 | `{26,0}` set, collected |
| 910 | done | a refusal at 640, then 799 t, `break+kill+walk` | 0 | `{53,2}` set, collected |
| 911 | done | 606 t, `break+kill+walk` | 0 | `{53,2}` set, collected |

  No divergence row on any of the five. (L53-KILLLOCK's page hit is gone: `ROCK_GONE_FENCEPOST` has landed since.)
- Earlier cuts, kept as evidence: the rocklock row without the rewind (`m/page-sweep-flip-l26.txt`: both refuse on the
  punchers); the rewind without the line stance (`m/page-sweep-flip3.txt`: 286/289 done, 910/911 refuse).

## 5. I — the switches, the rows, the mutants, the ON radius

**The switches** (all in `solverBot.js`, all OFF, each `SEEDLING_<NAME>=1` / the page's `?seedlingSolverEnv=` / its
wrapper; three new lines in `solverEnvChannel.SOLVER_ENV_NAMES`):

| switch | what it is derived from | shipped rooms it reaches |
|---|---|---|
| `KILLLOCK_CLEAR_WRITE` (`withKillLockClearWrite`) | The run's own ledger: `run.scratchClears` holds a row for THIS lock id and flag. `execClearTag`'s `written()` gains that reader beside `earnedClears` and the rope row. A non-scratch run has no such row and is unchanged | Every clear-tag whose verb is the kill work order: L18 `{18,0}`, L26 `{26,0}`, L53 `{53,2}`. The other seven kill-locks have no event leg |
| `ROCKLOCK_KILL` (`withRockLockKill`) | The instance's own `tset`: a rocklock in the level's kill-lock list (`world.combat.killLocks`, i.e. `combat.killLocksIn`: `tset == -1`) is `kill`; any other rocklock has no verb. The row is `Lock`'s (`hold`), switch-gated (`switchGatedRow`, non-enumerable) | L26 (both event legs, and the walk's crossing to L28 behind the rocklock). L112's rocklock (`tset 0`) keeps its refusal: `no-verb`, and `obstacleGateFor`'s ENCOUNTER gate on the frontier |
| `KILLLOCK_LINE_STANCE` (`withKillLockLineStance`; read only with `KILLLOCK_CHASER_REWIND` on and a rewind) | The body's own box (`chaserBoxAt`), its own Solids (`world.solidBoxesForMover` for that body), its own leash (`ENEMY_CLASSES[tag].aggro.range`), the sword's reach (`SLASH_REACH`), the planner's floor (`plannerObstacleAt`) and the lattice. No level, no coordinate | Every kill-lock chaser turn with a body pinned from where the player stands. Measured movers: L53 (910, 911, and the walk's 9001/9002), L98 (756). L26, L60, L71, L78, L99: no mover in the radius |

How `KILLLOCK_LINE_STANCE` works, in order:
1. A body is PINNED from here when its box, swept every 1 px along the straight line to the player, meets one of its
   own Solids (`chaserPinnedFromHere`). A pinned body is not asked the arm's stance scan and is not waited for where the
   player stands.
2. When a turn's own stances are spent, or it has none, each live counted body (nearest first) offers LINE STANCES
   (`chaserLineStances`): lattice cells inside its leash, plannable for the player, beyond the sword's reach of its box,
   to which its box sweeps clear; nearest the player first.
3. Each is one attempt of the arm's own (`killLockChaserAttempt`: the ladder's walk to the cell, which breaks the rocks
   on the way, then the guarded dwell), rewound when refused: at most 3 a body, 6 a turn. ⚖ 30(c): the attempt kept is
   the one the run drove.

**`solverBot.js` lines touched** (for the parallel harvest; nothing in `approachKillForCorpse`, which starts at 12586):
- the table's gated row (≈779–782);
- the new block before `refineStrategy`: `ROCKLOCK_KILL`, `rockLockKillRow`, `KILLLOCK_CLEAR_WRITE`, `killLockStands`
  (≈3082–3145), and `refineStrategy`'s rocklock arm (≈3193–3196);
- `resolveKillStrategy`: the lock row's fallback (≈13225);
- `execKill`'s "still there" read (≈18149);
- the new block before `killLockChaserRewindTurn`: `KILLLOCK_LINE_STANCE`, `chaserLineClear`, `chaserLineStances`,
  `chaserPinnedFromHere`, `killLockLineStanceTurn` (≈19128–19263); the turn's two reads (≈19310, 19346);
- `execKillByChaser`: the pinned skip, the stand-here guard, the no-stance line turn, the fade's read (≈19409–19442,
  19561); the press arm's fade read (≈20556);
- `execClearTag`: `killLockWritten` (≈32884–32901).

Other files: `solverEnvChannel.js` (three names), `seedling-solver-surface.json` (re-written; one new row,
`run:scratchClears`, classified `seedling` / `event-ledger`), `train-shard-costs.json` (one row, a local measure).

**OFF is byte-identical by construction**: every new read is `<SWITCH>.enabled && …` or returns the old expression
first (`killLockStands` = the activator roster's test, then a switch-gated arm). Measured: the bounded rows, the
producer checks, the acceptance batch md5 and the radius's `off` arm.

**Rows.**
- `hammerNewLocks.test.js` (13 rows, ~25 s):
  1. the three ship OFF and the channel knows the names;
  2. `solid:rocklock` is a row only while ON, `Lock`'s own, never enumerable; `clearTagVerbOf` follows it;
  3. 223 OFF: `not-written`;
  4. 223 ON: 361 t, `46b04032411f`, 0 hits, the scratch row at t360, `earnedClears` still empty;
  5. 286/289 OFF: `no-verb`;
  6. `ROCKLOCK_KILL` alone: the kill work order takes it and refuses on the punchers;
  7. the rewind without `KILLLOCK_CLEAR_WRITE`: the rocklock leaves the world, `not-written`;
  8. 286/289 all ON: 629 t `2e67ef21dc8b`, 315 t `c9fa81f02f3e`, 0 hits, `{26,0}` written;
  9. the door behind the rocklock (289's request, its goal swapped for the L28 teleporter) OFF: no corridor;
  10. the same ON: 357 t `ac2590edef0b` into L28, 0 hits;
  11. the line stances from 911's arrival: every jellyfish's cells lie in the arena, the puncher's in its corridor,
      nearest the player first;
  12. 911: the rewind alone refuses; ON 606 t `0af3161975c3`, 0 hits; without the clear's write, `not-written`;
  13. the line stance without the rewind = OFF's refusal.
- `hammerNewLocks.train.test.js` (1 row, ~14 s): 910's held retry. OFF pinned puncher; the rewind alone refuses; ON
  799 t `1a65d0116cca`, 0 hits, the puncher and a jellyfish each killed from their third line stance.
- `hammerNewLocksLegs.js`: the fixtures and the one solve both files use (test support; nothing in the solver imports it).

**Fixtures**: `fixtures/hammer-new-locks/`, the page's captured requests cut to the leg's level (289 also holds L28
for the door row), 1.3–3.1 KB. Cut = uncut on every answer, OFF and ON, digest and work (`m/fixture-cut.txt`).

**Mutants** (`i/mutants.txt`, `tools/mutants.py`, a scratch worktree): 11 of 12 red.

| mutant | result |
|---|---|
| M1 the clear-tag never reads the kill-lock write | RED |
| M2 the scratch row asked by flag alone, not by lock id | survived: **equivalent** here (one scratch row a flag in these rooms; the id keeps a static body's own-tag row from answering for a lock) |
| M3 no `solid:rocklock` row | RED |
| M4 the rocklock instance is never a kill-lock | RED |
| M5 a rocklock is read as gone at once | RED (the door row, added for it) |
| M6 a pinned body is still asked the scan and waited for | RED |
| M7 no line test | RED |
| M8 line stances farthest first | RED |
| M9 no standoff | RED |
| M10 one line stance a body | RED |
| M11 no line-stance turn | RED |
| M12 the point line, not the box sweep | RED |

**The ON radius.** Population: every leg of the ten kill-lock levels and L112, 71 legs (`radius/ids.txt`). The page
sweep at the defaults with request capture (`radius/page-sweep-off.txt`): 58 done, 9 failed, 1 crossed, 2 skipped, 1
unresolved. Then every captured request (75, over 65 legs) solved in node as the worker solves it under four arms
(`tools/radius.mjs`; `radius/radius-off-new-rew-all.jsonl.gz`, `radius/summary.txt`): `off`, `new` (the three), `rew`
(`KILLLOCK_CHASER_REWIND` alone), `all`.

| mover class | `new` vs `off` | `all` vs `rew` |
|---|---|---|
| refusal → solved | **1**: 223 | **4 requests, 3 legs**: 223, 910 (its retry), 911 (both requests) |
| refusal → refusal (other text) | 0 | **1**: 910's first ask (deadline-bound both ways) |
| plan → other plan | 0 | **2 requests, 1 leg**: 756 `level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112`: 562 t with **2 model hits** → 466 t with **0**, 642 / 756 → 186 units |
| solved → refusal | 0 | 0 |
| none | 74 | 68 |

Outside the capture (legs that make no request at the defaults, or that the leg list lacks):
- 286, 289: refusal → solved (the scratch flip, §4).
- 807 `level_112__r2c2 <- in_L111_128_48 -> location:L112 flag 1: rocklock@112,16 cleared`: refused → refused, the same
  `no-verb`, now said by the solver after one request, not by the mapper (`radius/page-sweep-flip-807.txt`).
- L53-KILLLOCK's 9001 / 9002 (the walk's L53 crossing, its fixtures; `radius/l53-killlock-fixtures.txt`): plan → other
  plan, 0 hits both: 768 → 608 t (1770 → 841 units) and 959 → 744 t (2474 → 641 units). 482 unmoved.
- No plan with a model hit under `new` or `all` that `off` / `rew` did not already have (753's 1 hit is in every arm).

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest by path, defaults (`d/bounded-files.txt`, 19 files: `hammerNewLocks`, `hammerL53Killlock`, `hammerKeylockTurret`, `hammerClearTagChain`, `hammerClearTagStand`, `hammerApproach`, `hammerFightFallback`, `hammerBk2Combat`, `strategySwitch`, `solverEnvChannel`, `entityBlocks`, `contentIdentity`, `fidelityClearTag`, `fidelityKillLock`, `killLockBodiesHook`, `jsRuntimeSolverEventGoal`, `procgenWeigh`, `solverBot`, `trainShardPlan`) | **19 files, 390 passed** (`d/bounded-off.txt`) |
| the same with the three switches ON | **385 passed, 5 red, each by design** (`d/bounded-on.txt`): three `hammerL53Killlock` rows (the line stance changes 9001/9002's plans; still solved, 0 hits, §5) and two `jsRuntimeSolverEventGoal` rows that pin *"L112's rocklock: the mapper says no-verb"* (ON the mapper maps it and the solver says `no-verb`). All five owe a re-record at a flip (§9) |
| the `.train` files the change reaches, locally by path (`d/train-files.txt`) | **7 files, 17 passed** (1279 s): `hammerNewLocks`, `hammerL53Killlock`, `hammerKeylockTurret`, `hammerClearTagChain`, `hammerChooserPair`, `hammerTurretApproach`, `hammerIceTurretStatic` |
| `ci-producer-checks --jobs=4`, defaults | **98 run, 0 red**, 1 skipped (`d/producer-off.txt`) |
| `ci-producer-checks --jobs=4`, the three switches ON | **98 run, 0 red**, 1 skipped (`d/producer-on.txt`) |
| `census-seedling-solver-surface --check` | RED first (site counts; `run:scratchClears` unlisted), `--write`, the row classified, then **GREEN, 372 rows** (`d/surface.txt`) |
| `census-seedling-constants --check` | **PASS**, 0 new (`d/constants.txt`) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (the docs index); **ALL CHECKS PASSED** |
| `generate-docs-index.mjs --check` | OK (193 docs) |
| `check-procgen-docs` | ALL CHECKS PASSED |
| `batch-seedling-acceptance.mjs \| md5sum` | `abb206c88de25e7ba1874510d493ce85` at the base and at the head (`d/acceptance.txt`) |
| docs | `seedling-bot.md`: one paragraph naming the three switches (OFF). `seedling-bot-log.md`: `### Seedling hammer-phase NEW-LOCKS — …` |
| JSUT | run **42890446760** at `655d52fd` (the last code-bearing head): suite (unfiltered vitest) **26399 passed, 0 failed**; **slow battery 431 / 431 passed, 0 failed** (`node scripts/procgen/ci-summary.mjs --run=42890446760`; `d/jsut.txt`). Its Producer --checks and both headless gate shards are green; one browser gate shard (`seedling-ap-placement +17`) was still running when this was written, the other six green. ⚠ The run before it (42883829905 at `16287cfd`) was red on one row, *"`--check` exits 0 — regenerating produces byte-identical files"*: that commit edited `seedling-bot.md` without regenerating the docs index. `655d52fd` regenerated it |

Not run here (the planner's, by the brief): the train tier in CI, TT, the survey, the sweep A/B.

## 7. What the harvest A/B should expect

**OFF: no movers.** Every new read is behind its switch.

**The ON dispatch** (`seedling-divergence-sweep.yml`), against an OFF run at the same SHA:

- `solver_env` = `SEEDLING_KILLLOCK_CHASER_REWIND=1;SEEDLING_KILLLOCK_CLEAR_WRITE=1;SEEDLING_KILLLOCK_LINE_STANCE=1;SEEDLING_ROCKLOCK_KILL=1`
- `keys` = `level_18__r1c1 <- in_L16_352_80 -> location:L18 flag 0: lock@144,112 cleared|level_53__r9c10 <- in_L48_0_112 ~> level_53__r2c2 -> location:L53 flag 2: lock@144,208 cleared|level_53__r9c10 <- in_L51_176_144 ~> level_53__r2c2 -> location:L53 flag 2: lock@144,208 cleared|level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112|level_26__r2c4 <- in_L25_0_96 -> location:L26 flag 0: rocklock@112,208 cleared|level_26__r2c4 <- in_L27_32_0 -> location:L26 flag 0: rocklock@112,208 cleared`
  (or empty for the full list)
- `carry_route_flags` = `false`. ⚠ It makes no difference for these legs: all seven are the same leg in both lists (no
  carried flag; measured on both leg lists at this head).
- `leg_budget_ms` = `90000` (the default; every leg here finished inside it: 910, the longest, took 34 s).

Expect: **223, 910, 911 failed → done**, 0 room hits; 756 done → done, a shorter plan; **286 and 289 stay failed
`no-verb`** (the mapper, §2) until the default flips. With the default flipped: 286, 289 → done, and 807 (L112) stays
failed with one request made.

The baseline for the line stance alone is `SEEDLING_KILLLOCK_CHASER_REWIND=1`: against it the same legs move, plus
nothing else in the 71-leg radius.

## 8. What the brief got wrong (measured)

- *"Why does `{18,0}` not set after the kill? Candidates: an enemy `totalEnemies()` counts that the solver's count
  omits; the lock's fade outlasting the 120-tick check; the flag being written only when the fade ends; or the model not
  modelling this."* None of the four. The model writes the flag on the tick the fade ends (t360), inside the kill
  verb's own wait. The order read `earnedClears`, and the kill-lock write is in `scratchClears`.
- *"find out what the solver's kill-lock 'count' is and whether it matches"*: it matches. `countedBodiesLeft` is the
  combat census's counted bodies, and the model's ledger opened the lock at the second removal.
- *"The counted chasers stand behind an Ice Wall"* (L53): true, and also behind two breakable rocks. No cell the
  player can reach from either arrival has a clear line to a jellyfish; the stance has to be one the ladder's walk
  opens. The line stance therefore offers cells whether or not they are reachable now.
- *"Does 286/289 then solve … on the page?"* Only with `KILLLOCK_CHASER_REWIND` and `KILLLOCK_CLEAR_WRITE` too, and
  only with the row on the main thread (§2).
- *"mapping it to the verb(s) Lock already uses … an activator lock → `hold`"*: a group rocklock is given NO verb.
  The model's activator roster does not hold a RockLock (`activators.js`), so a `hold` on its group would open nothing
  in the model. The one shipped case (L112) is opened by the Final Boss's death, not by a presser.
- *"L26 rocklock is where the randomized seed-2 whole-game walk stops"*: not re-measured (no seed-2 preset is
  committed). The door row shows the frontier crosses it ON from the L27 arrival.

## 9. Residue and hand-overs

- **For the lab (`jsRuntimeSolver.js`, not edited here): the mapper is keyed by class, the solver by instance.**
  `clearTagVerbOf('solid:rocklock')` answers `{hold, registered}` once the row exists, for every rocklock. The solver
  then asks the instance, and L112's has no verb. So with `ROCKLOCK_KILL` ON, `jsRuntimeSolverEventGoal.test.js`'s two
  L112 rows move (the mapper maps, the solver refuses `no-verb`). At a flip either the mapper asks the instance, or
  those two rows are re-recorded. The page's outcome for 807 is the same either way (failed).
- **For fidelity (`levelRun.js`, not edited): a RockLock's fade is read as a Lock's.** `killLockClearTick` reads
  `RESPONDERS[tag]?.fade ?? RESPONDERS.lock.fade`, and `RESPONDERS` has no `rocklock` row. `RockLock.update` writes on
  the update its alpha reaches 0; `Lock.activationStep` calls `turnOff()` on the update after. So the model may open
  the rocklock one tick late. Not measured to the tick: both L26 legs and the door row stand past the write, and the
  page shows no divergence.
- **Rows owed at a flip** (five, §6): `hammerL53Killlock.test.js`'s two ON plans and its budget-960 row (under the line
  stance), and the two L112 rows above.
- **`STRATEGY_REFINEMENTS`** (the descriptive table) has no rocklock row: its `hold → kill` row's words already cover
  it (*"the lock is a KILL-LOCK (`tset == -1`)"*), and `procgenWeigh.test.js` drives a case per row.
- **Not measured**: the whole-game walk with the switches ON; seed 2; the tick of the game's RockLock write.
- **Tooling** (scratch, in the evidence `tools/`; they decide nothing): `chain.mjs` (the census's, with a `--tries`
  print), `fix-solve.mjs`, `radius.mjs`, `rows.mjs`, `world.mjs`, `census-locks.mjs`, `cut-fixture.mjs`, `mutants.py`.
  The scratch worktrees (`wt-dbg`, `wt-flip`, `wt-mut`) lived in the session scratchpad and were removed by name.
- Commits used the default hook setup. Background jobs on this box advance only while a command runs, so the 71-leg
  radius sweep took about two hours of wall clock.
