# Seedling hammer-phase KEYGATE-YIELD — why 8/83 generated keygate rooms refuse `the-goal-approach-is-blocked`

Slice `seedling-hammer-keygate-yield` (cloud, Opus). Planner: `seedling-hammer-phase-planning-3`. ⚖ Queued by the user
2026-11-04. No mid-run scope message was received; the scope is the brief.

## 1. Start, head, branch

- Start: `origin/main` @ `26ed405d3f45d3cb86ebae87207035fc08a57e04`
- Branch: `claude/keygate-yield-blocked-goal-kzv751`
- Head: see the last commit on the branch (this report is the last commit; the code head it reports on is
  `476d7f2277`).

## 2. The answer first

**One thing to know first:** all 8 refusals are the **solver's**. Each room can be solved in the game. The key is
collected and the lock opens. The collect walk then aims at a stance that `deriveStance` chose **before** the lock
opened. That stance sits beyond the torch, in a one-tile dead end whose only way in is the torch's own cell, and the
planner treats that cell as an avoid volume by design. The aim is never derived again, so the walk refuses next to an
open door.

| Question | Answer (measured) |
|---|---|
| The 8/83, per arm | Reproduced at `26ed405d3f`. The same 8 rooms in **pre-sword and post-sword** (§3). 83 placed, 75 certified in each arm, which matches sweeps 41681846644 / 41681852122. |
| Is each room solvable in the game's terms? | **Yes, all 8.** The key is on the boot side and is collected (`keys [0]`). The lock's key line is reached from the start side and the lock opens (`openActivators` holds it). The torch can be walked onto from where the run stands once the torch's own avoid volume is ignored. |
| Key behind its own lock? | **No, in none of the 8.** |
| What is "no walkable tile path from (3,8) to (1,6)"? | **Neither a refused door nor a true absence.** The door is open and walkable: `(3,8)→(3,7)→(3,6)` plans. The target (1,6) = (24,104) is the cell **west of** `torchpickup@32,96`, which sits on tile (2,6). (1,6) can only be entered through (2,6), the torch's avoid volume. It is a stale aim, not a wall. |
| Classification | **solver: 8**, generator: 0, certifier: 0. The gap's name, `the-goal-approach-is-blocked`, is a fair reading of the refusal. The fault is the solver's stance, not the wording. |
| Fix | `COLLECT_RESTANCE` (**OFF**): on a later walk attempt whose plan fails, a corridorless collect stance is derived again from the live run. |
| Yield before → after (ON) | **pre-sword 75/83 → 83/83; post-sword 75/83 → 83/83.** |

## 3. W0 — attribution

### The captured case

Bushy 14x14, seed 3, pre-sword, `keygate` (type 0), areas 0. `capture.mjs` was saved verbatim from the brief and run;
`request.json` and `answer.json` are in the evidence directory. The replay matches the seam (`replayMatchesSeam: true`).

```
   01234567890123
 0 ##############      boot (1,1); key = bosskey@160,144 (tile 10,9)
 1 #.........#.##      lock = bosslock@48,112 (tile 3,7), key line y=129 (the row under it)
 2 #######.###.##      torch = torchpickup@32,96, rect x36..44 y100..108 → tile (2,6)
 3 #.#.......#.##
 4 #.#####.###.##
 5 #.#.#.....#.##
 6 #.T.#####.#.##      T = torch; (1,6) is reached ONLY through T
 7 ###B#.#.....##      B = the lock
 8 #...#.###.####      (3,8) = the keylock stance
 9 #.........B.##      second B = the key
10 #...#.#.#.####
11 #...#.#.#...##
```

The trace, from `answer.json` and `probe-after-lock.mjs`:

1. **t0–242:** the walk reaches the key and collects it (`collect`).
2. **t281:** the torch goal starts. `deriveStance` finds that no ring cell around the torch has a corridor (the pocket is
   behind the lock). It returns the nearest collectable cell by `(d, y, x)`, which is `(24,104)` (west wins over east,
   `(56,104)`, on the `x` tie-break), flagged `corridor: false`. The walk enters the ladder, `keylock` is selected and
   resolved (the run holds key 0), the walk goes to the stance (56,136), and the lock opens.
3. **Next attempt:** the walk plans to the **same** `(24,104)` again. It fails because (2,6) is the torch's avoid
   volume. The frontier names `pickup:torchpickup` itself, the `collect` frontier strategy cannot bind it, and the walk
   refuses.

Probe at the refusal (`probe-after-lock.mjs`, the live run):
- `keys [0]`, `openActivators: [bosslock@48,112]`, player at (56.48,130.06).
- Plan to (24,104): **REFUSED**, the refusal's own text. With `avoidVolumes: false`: **PLANS** `[(56,104),(24,104)]`.
- Plan to (56,104), the door's far side: **PLANS** `[(56,136),(56,120),(56,104)]`. Plan onto the door cell (56,120):
  **PLANS**.
- Plan onto the torch tile (40,104): refused by name, *"pickup torchpickup at (32,96)"*.

### The 8 cases (`attribute.mjs`; `attribution-off-pre-sword.jsonl`)

| Cell | Key held | Lock open | Stale aim | Aim plans? | Aim plans w/o volumes | Near-side ring cell (corridor + collect) | Class |
|---|---|---|---|---|---|---|---|
| branchy 10x10 s1 | 0 | yes | (104,104) | no | yes | (88,120) | solver |
| branchy 10x10 s11 | 0 | yes | (88,24) | no | yes | (88,56) | solver |
| branchy 14x14 s11 | 0 | yes | (184,24) | no | yes | (184,56) | solver |
| bushy 14x14 s3 | 0 | yes | (24,104) | no | yes | (56,104) | solver |
| bushy 14x14 s4 | 0 | yes | (152,40) | no | yes | (136,56) | solver |
| bushy 14x14 s11 | 0 | yes | (184,24) | no | yes | (184,56) | solver |
| loopy 14x14 s1 | 0 | yes | (184,152) | no | yes | (184,184) | solver |
| loopy 14x14 s2 | 0 | yes | (152,104) | no | yes | (152,136) | solver |

Post-sword has the same 8 cells with the same refusal text (`sweep-off.json`). The palette changes only the ticks.

**Generator hand-over: none.** No room is bad. **Certifier hand-over: none.**

⚠ "also on the frontier: bosskey@…" in the refusal text is not evidence that the key went uncollected. The run holds
key 0 in every case. The bosskey row is still in `world.pickups` (the key is drawn held), and the frontier sentence lists
it.

## 4. M — design

| Design | What | Verdict |
|---|---|---|
| **A. Re-derive in the walk's attempt loop (chosen)** | `walkTo` gets a `reaim` option. On a later attempt (attempt > 0) whose plan to the aim fails, the collect site's `collectReaim` asks `deriveStance` again from the live run. A stance that now has a corridor replaces the aim once, and the attempt re-plans. | The smallest change. It uses the same derivation, the live state and no new geometry. A walk whose aim plans is never asked. |
| B. Catch the refusal at the collect site and walk again | Let the walk refuse, then derive and walk again. | Rejected. A refusal from inside the ladder has already recorded rows and considered orders. Resuming after a thrown refusal is a second control flow. |
| C. Prefer the near side in the corridorless order | Change `(d, y, x)` to favour the side the ladder will open. | Rejected. Before the clear, nothing says which side opens, and it would move every corridorless stance on the roster. |
| D. Drop the pickup's own avoid volume from the walk | — | Rejected. The volume encodes a game fact (`deriveStance`'s ⚖ 46 docblock: a drive straight at a special pickup stalls in the ceremony). |

Scratch measurement during M: the first cut excluded the STRIKELAPSE case (`collectStandWalk`). It moved nothing,
because `CONTACT_FIDELITY.strikeIframeLapse` is **ON** at the defaults. The shipped cut re-prices that tail from the new
stance instead: `collectStandWalk` depends on the stance only through the tail's length, so a re-aimed walk is still
certified with the approach it drives (⚖ 30(c)).

## 5. I — the switch, rows, mutants, ON radius

- **Switch:** `solverBot.COLLECT_RESTANCE`, **OFF**, `SEEDLING_COLLECT_RESTANCE=1` / `withCollectRestance(enabled, fn)`,
  `COLLECT_RESTANCE_DEFAULT = false`. The instrument is `COLLECT_RESTANCE_COUNTS.restances` (`{what, attempt, tick,
  from, to}`), with `resetCollectRestanceCounts()`. Added to `solverEnvChannel.SOLVER_ENV_NAMES`.
- **OFF is byte-identical by construction.** The collect site passes no `reaim`, and the new branch in `walkToUnder`
  tests `reaim !== null` first. Measured: both producer runs, the identity block, and an OFF sweep with no movers
  against the pre-change sweep (§6).
- **`solverBot.js` lines touched** (at the head): `collectReaim` 10154–10174 (new, exported, placed after
  `deriveStance`); the switch block 16650–16686 (new, after `resetApproachDoorCounts`); `walkToUnder`'s `reaim`
  parameter 30423–30428; the re-aim branch at the head of the plan's `catch` 30488–30500; the collect site's spread
  32516–32519. Nothing else. No other function changes.
- **Rows** (`hammerKeygateYield.test.js`, 5 rows; fixtures `fixtures/hammer-keygate-yield-bushy14-s3.json` 3.1 KB and
  `…-empty10-s1.json` 2.0 KB):
  1. ships OFF; the env alone turns it on.
  2. Captured room: OFF refuses by its text (`toward (24,104)`, `torchpickup@32,96`, `from tile (3,8) to (1,6)`); ON
     solves with exactly one re-aim, attempt 1, (24,104) → (56,104).
  3. A keygate room that already certifies (empty 10x10 s1): ON gives the same answer as OFF (verdict, reason, ticks,
     rows), with no re-aim.
  4. `collectReaim` returns null while the lock is shut (the stance is still corridorless).
  5. Source row: one call site, behind `COLLECT_RESTANCE.enabled && stance.corridor === false`, and the
     `attempt > 0` guard.
  The fixture cut drops only `config`/`call` prose from `request.json`. `levelRecord`/`staging`/`goals`/`budget`/`name`
  are equal (checked), so it gives the same answer as the captured request.
- **Mutants** (each run on the rows, then restored with `cmp`):

  | Mutant | Red rows |
  |---|---|
  | M1: `attempt > 0` guard dropped | source row |
  | M2: the corridor test dropped (`corridor === false` accepted) | row 4. It survived the first four rows; row 4 was added for it. |
  | M3: the call-site gate dropped (always ON) | rows 2 and 5 |
  | M4: the re-aim never replaces the aim | row 2 |

- **ON radius, by mover class** (keygate sweep, both arms, 168 cells each):
  - **(a) the fixed class: 8 per arm.** The 8 rooms of §3 go REFUSED → certified.
  - **(b) the same defect in pass 2: 1 per arm.** loopy 14x14 s4: OFF, a `water-pool` candidate was reverted on
    *"no corridor for goal collect-placement …"*. ON, it is kept on the first try, the final room differs, and
    `finalTicks` goes 557 → 381 (pre-sword) and 400 → 297 (post-sword). The skeleton-only certification is identical,
    557 → 557.
  - No other cell moved: placed, certified, gap, `finalTicks`, `keptCount`, `byTemplate` and `revertReasons` were
    compared. The total REVERT count stays 12 per arm. The one collect-placement revert is replaced by a correct
    *"no REACHABLE stance on bosslock@96,48's key line"* revert of a later candidate.

## 6. D — gates

| Gate | Result |
|---|---|
| Bounded vitest by path (⚖ 52): `hammerKeygateYield`, `solverEnvChannel`, `strategySwitch`, `contentIdentity`, `entityBlocks`, `boxLock`, `boxLockCommit` | 7 files, 132 passed |
| Hammer `.slow` files (`hammerBk2Combat`, `hammerDashShape`, `hammerEscapeExact`, `hammerEscapeGenerated`), `vitest.slow.config.js` | 4 files, **8 passed** (1596 s) |
| `ci-producer-checks --jobs=4`, defaults (clean tree) | 97 run, **0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, the standing browser-arm skip) |
| `ci-producer-checks --jobs=4`, `SEEDLING_COLLECT_RESTANCE=1` | 97 run, **0 red**, 1 skipped |
| `identity-block.sh` (dev server on :8000) | exit 0 (every row `[exit 0]`; reference: all 7 generated modules and 5 markdown regions match) |
| `census-seedling-solver-surface --check` | Red before `--write`: one new `CONTACT_FIDELITY` read site (`collectReaim`'s `strikeIframeLapse`), solverBot 145 → 146. After `--write`: green, 371 rows. No new row to classify (a count only). |
| `census-seedling-constants --check` | PASS (7061 literals, 0 drift) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (193 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless) | ALL PASS — 415 PASS, 0 FAIL, 0 SKIP (dev server on :8000) |
| JSUT | run **41961040388** on `476d7f2277`. PENDING at commit time |
| Train tier | **None run locally, by reasoning.** OFF is byte-identical by construction (no `reaim` is passed), and the train pins run at the defaults. The planner's dispatched train-tier run is the measurement. |

Docs: `seedling-bot.md` gets a paragraph after POCKET-BURN naming `COLLECT_RESTANCE` (OFF) and what it does.
`seedling-bot-log.md` gets the entry `### Seedling hammer-phase KEYGATE-YIELD — …`.

## 7. What the harvest A/B should expect, and the ON dispatch

- **OFF: no movers** on anything (producer checks, identity block, train tier, survey).
- **ON:** the keygate sweep certifies 83/83 per arm. Outside keygate, a mover is a collect whose ring stance was
  corridorless and whose stale aim still fails to plan after a ladder clear. Before this switch every such room
  refused, so an ON mover should be REFUSED → SOLVED, or a pass-2 revert → kept. The ON producer run at the defaults
  was 0 red, so no committed artifact moves.
- **The ON sweep dispatch.** ⚠ `seedling-gen-sweep.yml` has **no `solver_env` input** (its inputs are arms, kinds,
  palette, seeds, sizes, cellbudget, verb and goal), so the ON arm cannot be dispatched on it today. Either add a
  `solver_env` input that exports `SEEDLING_COLLECT_RESTANCE=1` into the sweep step, or run it as I did here:
  ```
  # per arm (pre-sword, post-sword); OFF = the same without the env
  SEEDLING_COLLECT_RESTANCE=1 node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --palette=<arm> \
    --elements=keygate --seeds=1-12 --sizes=10x10,14x14 --cellbudget=600 --json=<out>.json
  # = gh workflow run seedling-gen-sweep.yml --ref claude/keygate-yield-blocked-goal-kzv751 \
  #     -f arms=keygate -f palette=<arm> -f seeds=1-12 -f sizes=10x10,14x14 -f verb=keylock  (+ solver_env, once it exists)
  ```
  The divergence sweep's `solver_env` takes `SEEDLING_COLLECT_RESTANCE=1` (the name is in `SOLVER_ENV_NAMES`).

## 8. What the brief got wrong (measured)

- *"the bosskey still on the frontier"*: the key is **collected** in all 8 rooms (`keys [0]`). The refusal sentence
  lists the held key's leftover `world.pickups` row. The obstacle the frontier actually named is the **torch**.
- *"the walk stuck at the lock's stance"*: true of the player's position, but the lock is **open**. The walk is not
  stuck on the lock; it has nowhere to go because its aim is stale.
- Gate commands: `identity-block.sh` and `check-seedling-wasm-ship` need a dev server on :8000. The first run of the
  wasm check SKIPped silently, exit 0, without one. I started `scripts/serve-nocache.py 8000` (none was running).
- The sweep workflow has no `solver_env` (§7).

## 9. Residue and hand-overs

- **Lab (generator):** none. The rooms are good.
- **Workflow:** `seedling-gen-sweep.yml` needs a `solver_env` input for ON-arm sweeps (§7). Its owner's call; not
  edited here.
- **Train tier:** for the planner to dispatch at the head.
- Evidence (`CC/docs/cloud-reports/seedling-hammer-keygate-yield-evidence/`): `capture.mjs` (the brief's, verbatim),
  `request.json`, `answer.json`, `probe-after-lock.mjs`, `attribute.mjs`, `attribution-off-pre-sword.jsonl`,
  `attribution-on-pre-sword.jsonl` (all 8 SOLVED ON), `make-fixture.mjs`, `sweep-off.json`, `sweep-on.json`.
- A dev server I started (`scripts/serve-nocache.py 8000`, pid 8388) is left running for the session.
