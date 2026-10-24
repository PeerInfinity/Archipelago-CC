# Seedling HAMMER-PHASE — slice B3b: B3's rewind on main's ONE run factory (`forkRun`), rebased

Slice `seedling-hammer-b3b` (Opus fix-up, cloud), planner `seedling-hammer-phase-planning`. Merge-shaped: no new
behaviour with the flag OFF; B3's report (`seedling-hammer-b3.md`, rebased here) stands for everything not re-measured.

| | |
|---|---|
| Start SHA | `de0d78314e` (main; contains `07495e1b54` and the JS arc's code `98f437c`/`708d7bc`) |
| Head | the commit carrying this report (W0 `1b744e8`…`f53cdb2`; D1 `bb6717b`; D3 `7ca18f2`) |
| Harness branch | `claude/seedling-hammer-b3b-forkrun-ufmbco` (the brief's `seedling-hammer-b3b`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9550` (`SEEDLING_PORT=9550`); a scratch worktree `/home/user/wt-b3b` on 9551 (D1's identity block before the commit, the mutants) |
| Verdicts | **W0 PASS · D1 PASS (both halves: the rewind on `forkRun`, and the fork on the same helper — byte-inert) · D2 PASS · D3 PASS** |

## The one thing to know first

**`rewindRun` is gone. The rewind and the crusher's fork now use one factory (`forkRun`) and one replay
(`replayToTick`, from the segment's BOOT with the prefix included).** With the flag OFF nothing moved. The identity
block, the six `--check`s, the crusher witness, the L18 sweep and the tapeRunner pairs all equal W0. The exactness gate
gives 2,440 probes on B3's 11 rows (B3's exact count) and 31 more on a new prefix row through the JS worker's
`forkRunFor`, with 0 mismatches. As a side effect **the worker now reaches the fallback** (it passes `forkRun`, so it
has a rewind). Measured ON: the rewind fires at t0 and the kill is solved. What the JS arc still has to wire is the
recording Proxy and `out.liveRun` (§ D2.4).

## W0 — the rebase (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-b3b-forkrun-ufmbco origin/main` | `de0d78314e`; `git merge-base --is-ancestor 07495e1b54 origin/main` → yes. `3e0ff8b80f` (B3's base, the B2 bank) is in main |
| cherry-pick | `d541207 2baf8f1 a9956ce 9225d34 4541594 bd53f77` (= `3e0ff8b80f..bd53f77551`) | **5 commits land** (`1b744e8 d291ab8 842f971 7fb5717 f53cdb2`): `9225d34` (a reference regeneration only) is EMPTY once main's generated side is taken and regenerated |
| conflict 1 | `watchSolve.solveForPage` (main: `forkRun`; B3: `rewindRun` + `out.liveRun`) | main's `forkRun` line kept, B3's `built` / `run = out.liveRun ?? built` kept (at W0 the rewind therefore had NO factory on this path; D1 gives it `forkRun`) |
| conflict 2 | `README.md`, `generated/docsIndex.js`, `generated/urlGrammar.js` (`a9956ce`) | main's side, then `generate-procgen-reference.mjs`; `--check` ALL 7 + 5 MATCH |
| no conflict | `twoPassSolve` (main `forkRun: () => makeRun(rows)`; B3 adds `rewindRun`, `passRows`) | merged textually: both factories passed at W0 |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0; `bulletml-dodge` checked out at its pin `7423ee86` |
| identity block | `SEEDLING_PORT=9550 bash scripts/procgen/identity-block.sh .` at `f53cdb25de` | log (non-`#` lines) md5 `34f1a75d4c38f0a2300c46493ec92f7d`. maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set **OK**, reference ALL 7 + 5 MATCH — **= the brief's expected rows; main did not move them** |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 |
| tapeRunner pairs | `npx vitest run …/tapeRunner.test.js --reporter=json`; `status\tfullName`, sorted, newline-terminated | **575**, md5 `3dd640fad700c9f492fb7259b4954fa5` (= B3's) |
| surface / constants / entities / profile | each `--check` | GREEN 227 · PASS 5,443 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 259 |
| crusher witness | `plan-seedling-crusher-witness.mjs --check` (the one `grep -a crusher` planner that solves through `solveSegment`; the `r5-*` planners and probes do not fork) | stdout md5 `fa10cbc14833bc487570742b5a5d309d`, exit 0, "all checks green". No roster tape is a crusher witness by name |

## D1 — one factory (PASS; `bb6717b`)

**The option.** `rewindRun` is dropped. `solveSegment`'s `forkRun` JSDoc now states the contract once: a fresh run at
the segment's boot, built as `run` was, sharing nothing. When the caller handed over a prefixed run, the factory re-makes
the PLAY's equips on the first `prefix.length` advances. It also names both readers: `bait`'s `ctx.fork` and the
fallback's `ctx.rewind`. `twoPassSolve` passes only `forkRun: () => makeRun(passRows)`. `solveForPage` already passed
only `forkRun` after W0. `procgenOracle` is unchanged.

**The one replay.** `replayToTick({makeRun, perTick, from = 0, to, handover, equips, takes})` replays
`perTick[0 … to)` onto `forkRun()`, the prefix included. Inside `solveSegment` one closure `replayTo(t)` feeds it this
segment's own equips (`solverEquips`, run clock → tape index, `e.t − offset`) and apitem takes (`apItemsTaken`).
- `rewind.replay(t)` = `replayTo(t)`. A `t` inside the caller's prefix is refused by name.
- `fork()` = `replayTo(perTick.length)`. It used to be its own loop over keys and equips.

**The ticks check.** B3 checked the factory's run at creation against the handed-over clock (`startTicks: ticked`). A
boot factory is at 0 there, so the check moved to where the handed-over state actually is. At tape tick `prefix.length`,
the replayed run must have completed `ticked` ticks (`handover: {at: prefix.length, ticks: ticked}`). With an empty
prefix that is the creation check again (0 = 0). B3's unit row "refuses a factory from another state" passes unchanged.

**What changed for the fork** (the "one helper" half), each measured inert below:
1. It now replays this segment's apitem takes. This is B3's residue 2: a fork past a take no longer diverges.
2. Its equips now go to tape index `e.t − offset` rather than `e.t`. These are the same whenever the handed-over run's
   clock equals its prefix length, which holds on every caller measured (`twoPassSolve`/`solveForPage` have no prefix,
   so offset is 0; the worker's shadow has no dead frames in any row here).
3. It gains the clock check at the end of the prefix.
4. Several equips on one tick now apply in order, where the old `Map` kept the last. The final slot is the same.

**Its inertia** (CRUSHER_BAIT ON by default), all at the D1 code:

| row | W0 | D1 |
|---|---|---|
| identity block (D1 code in the worktree, before the commit) | `34f1a75d…` | every digest row and the six `--check`s **identical** (`diff` of the two logs: only the reference row, *6 DIFFER* — the docs not yet regenerated, in a worktree; at head the reference is ALL 7 + 5 MATCH) |
| ENEMY census (crushers among its families) | `30bcc49c` | `30bcc49c` |
| `plan-seedling-crusher-witness --check` | `fa10cbc1`, exit 0 | **`fa10cbc1`, exit 0** (`diff` empty) |
| `jsRuntimeSolverForkRun` 5/5, `.slow` (L42 through `bait` on `forkRunFor`) 1/1 | — | pass |

Nothing moved, so the fork stays on the shared helper (no STOP).

## D2 — re-measured (flag OFF unless named)

### 1. Exactness gate — PASS

`node scripts/procgen/check-seedling-rewind-exactness.mjs --row=<r> --json=…` at the D1 code. Each row's stdout md5
equals its producer:

| row | stdout md5 | probes | kill starts | max tick | mismatches | rewind median / max |
|---|---|---|---|---|---|---|
| battery | `405d9c4b` | 0 | — | — | — | re-solves nothing (instrument exit 1 on 0 probes, as B3) |
| d2-chain | `b76f6483` | 48 | 3 | 1,650 | **0** | 13.3 / 61 ms |
| l18 | `465a8b46` | 22 | 3 | 350 | **0** | 6.0 / 16 ms |
| tail | `35456fbc` | 18 | 0 | 400 | **0** | 15.9 / 32 ms |
| r9-l3 | `6cd35fe1` | 3 | 0 | 150 | **0** | 4.8 / 8 ms |
| campaign | `13b8d51f` | 49 | 3 | 500 | **0** | 11.3 / 40 ms |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | 80 / 88 / 142 | 9 each | 350 / 350 / 650 | **0** | ≤ 4.4 / 20 ms |
| enemy | `30bcc49c` | 92 | 2 | 350 | **0** | 2.9 / 9 ms |
| acceptance | `76602ae8` | 714 | 19 | 700 | **0** | 1.6 / 17 ms |
| sweep (45 solves) | (prints wall times) | 1,184 | 135 | 500 | **0** | 3.9 / 20 ms |
| **B3's 11 rows** | | **2,440** (= B3 exactly) | **192** | | **0** | |
| **`fork-prefix` (new)** | `6de19ab0` (`{"ok":true,"ticks":1566,"verbs":["bait","collect","walk"]}`) | **31** | 0 | 1,550 | **0** | 45 / 128 ms |

**The new row** is `--row=fork-prefix`, which spawns the gate itself as `--drive=fork-prefix` under the hook. No new
instrument file. It drives the JS worker's production path, `jsRuntimeSolver.solveFromTape` → `forkRunFor({…, equips,
prefixLength})`, from L42's arrival (`crusher-l42-round-trip`'s staging, the `jsRuntimeSolverForkRun` fixture). Behind
it is a **12-tick PLAY prefix that equips slot 1 at tick 3**, and the solve is dashless. Every probe (t50 … t1550) is a
tick inside the segment, rebuilt from a boot run with the prefix and the PLAY equip re-made by the factory: 0
mismatches. The solve also forks for `bait` through the same helper, prefix included, and plans L42 in 1,566 t. That is
`rewindRun`'s never-had case: B3's worker passed no factory, so this row would have had 0 probes.

**Mutants** (predicted first; copy + restore in `/home/user/wt-b3b`):

| mutant | predicted | measured | md5 at both ends |
|---|---|---|---|
| B3's m1: the factory without the pass's persistence (`twoPassSolve`: `forkRun: () => makeRun([])`) | `--row=l18` red from t250 (`spinnerKillLockOpens[1].declaredAt`), the t350 replay throws; stdout intact (no `bait` on L18) | **as predicted**: 5 mismatches (t250, t300 `declaredAt` 305 vs null; t350 a throw), stdout `465a8b46` | `twoPassSolve.js` `a9f97daa` |
| b3b-m2: the prefix replay dropped (`replayTo`: `from: prefix.length` on the boot factory) | `--row=fork-prefix` red on every probe, the clock check refusing (the replay stands at 0 where the handed-over run stood at 12); and since `fork` shares the helper, the solve itself refuses at its first `bait` fork, so the child's stdout moves; empty-prefix rows untouched | **as predicted**: 5 mismatches (t50…t250, each a refused replay), then the solve refuses *"replayToTick: the run factory must build the run the segment was handed (12 tick(s) completed at tape tick 12); its replay stood at 0 there"*; stdout `3e6d5c4a` ≠ `6de19ab0` | `solverBot.js` `5367be83` |

The unit file has the same two in miniature. `hammerFightFallback`'s new b3b row checks three things: a boot
`forkRunFor` with a PLAY equip replayed to t20 equals the straight run; the factory without the equip does not; and
`from: 10` (m2) is refused by the clock check.

### 2. Byte-identity OFF — PASS

The identity block and the six `--check`s at D1 = W0, row for row (D1 above). L18 sweep
(`sweep-seedling-l18-residues.mjs`): **45/45**; the lengths line md5 `1c019765ddfd7f8d950c7f2a3a61b5f3` = B3's (=
A4's lengths).

### 3. Fallback ON — the cheap rows re-confirmed — PASS

| row | B3 | B3b (rebased, D1 code) |
|---|---|---|
| `hammerFightFallback` | 9/9 | **10/10** (B3's 9 + the b3b prefix row; in the AFTER set) |
| monotonicity `--row=c4 --modes=off,fallback` | 116 → 131 | **116 → 131**, refused→solved 15, replay mismatches 0, solved→refused 0 (93.6 s / 120.9 s) |
| monotonicity `--row=acceptance --modes=off,fallback` | 19 → 21 | **19 → 21**, refused→solved 2, solved→refused 0 |
| ON movers (`SEEDLING_HAMMER_FIGHT_FALLBACK=1`, the block's own commands) | acceptance `0094257a`, c3 `6873ee49`, c6 `15dbcf3f`, c4 `bc35ee7e` | **`0094257a2f5d474abd3049d21d2d9c72`, `6873ee49b9b7fa84ea6c3f328d34b51b`, `15dbcf3fe4010a097984f227f714e61e`, `bc35ee7e11dc9f01831feebce87ef53c`** — identical; main moved none |

The capacity rows were not re-run (B3's D2.4 stands; the planner's open question).

### 4. The worker — what remains for the JS arc

`solveFromTape` already passes `forkRunFor({…, equips, prefixLength: perTick.length})`. After D1, **that factory
serves the rewind too**, so B3's item 1 ("pass `rewindRun`") is done and nothing more needs wiring for the rewind to
exist. Measured (scratch, `withHammerEscape(false)`, L18 `r9-solve-18` staging at residue 4, `perTick: []`, both
persistence modes):
- OFF: refused (`HAMMER_SAFETY`, *"every key set … lands the player box on … the hammer line"*).
- ON: **the fallback fires in the worker**: `{how: 'rewind', verdict: 'solved', t: 0}`. The solve then stops on *"the
  solver raised a model-sourced declaration {18,0} … on a scratch run"*. The control is `withHammerFight(true)` through
  the same path, and it stops on **the same** declaration, so this is the staging's kill-lock declaration in the worker
  and not the rewind (the default escape solves it, 513 t).

What remains, all inside the JS arc's files:
1. **The recording Proxy.** `solveFromTape` wraps the shadow in a Proxy that records `expected` (a row per advance) and
   `equipsAt`/`equipItems`. After a rewind the segment drives a fresh `forkRunFor` run, not that Proxy. So `expected`
   keeps the rows past the rewind tick and misses every post-rewind advance, and the length check would throw
   `ShadowDivergence` on any fallback that completes. The fix is to cut `expected` and the equip maps back to `t` and
   record the fresh run. This is read from the code, not measured: no worker staging here reaches a completed fallback.
2. **Read `out.liveRun`** (non-enumerable) after a solve that used a fallback.
3. **Re-calibration** if the flag is ever on for live play (a retry's fight search spends `hammer-fight` units).

Item 2 of B3's original list (return an unrecorded run) is satisfied as it stands: `forkRunFor` builds a plain run.

Unchanged, measured OFF and ON: `measure-seedling-l18-live-gap.mjs` gives **518 / 500 / 503 t (full)**, work
59 / 57 / 57, budget/count/none. The OFF and ON logs are identical (`diff` empty; the r40–r42 lines md5 `bcca0be7`).
`jsRuntimeSolverCalibration.slow` is **5/5 OFF, 5/5 ON**.

## D3 — records (PASS; `7ca18f2` + this report)

| row | result |
|---|---|
| `seedling-bot.md` | the press-kill paragraph: the rewind is on `forkRun`, the one factory (`bait`'s too), the prefix included |
| `seedling-bot-log.md` | B3's D0 entry, in place: one sentence that B3b dropped `rewindRun` for `forkRun` and the fork shares `replayToTick` |
| surface / constants / entities / profile | `--check` GREEN 227 · PASS 5,443 · PASS 528 · PASS 138, no `--write` needed |
| reference | regenerated (`docsIndex`, README): `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| help door | `check-seedling-rewind-exactness --help` exit 0; a bare import does nothing; `--rows` lists `fork-prefix` |
| bounded vitest AFTER (flag OFF) | B3's 83-file set − `seedlingGenCapacity` + `hammerFightFallback` + `jsRuntimeSolverForkRun` = **84 files, 3,095 tests, 3,095 pass, 0 fail**; tapeRunner **575**, md5 `3dd640fad700c9f492fb7259b4954fa5` = W0; `lintGateLabels` 14/14; `hammerFightFallback` 10/10; `jsRuntimeSolverForkRun` 5/5 (+ `.slow` 1/1 under `vitest.slow.config.js`) |

## Deltas

| row | W0 (`f53cdb2`) | head |
|---|---|---|
| `solveSegment` options | `forkRun`, `rewindRun` | `forkRun` (one contract, two readers) |
| `replayToTick` | `{from = prefix.length, startTicks}` on a handed-over-state factory | `{from = 0, handover}` on a boot factory, prefix included |
| the crusher's `fork` | its own loop (keys, equips at `e.t`) | `replayTo(perTick.length)` (keys, equips at `e.t − offset`, apitem takes, the clock check) |
| `twoPassSolve` | `forkRun` + `rewindRun` | `forkRun` |
| the worker | no rewind | a rewind (via `forkRunFor`); inert OFF |
| exactness gate | 12 rows | 13 (`fork-prefix`) |
| `hammerFightFallback` | 9 rows | 10 |
| identity, producers, tapes, roster 259, surface/constants | — | unchanged |

## What the brief got wrong (measured)

1. **"Cherry-pick … (six)"**: six were picked and **five landed**. `9225d34` is a reference regeneration and is empty
   once main's generated side is taken and regenerated.
2. **"The ticks check (`ticksCompleted` of the replayed run vs the live run at `t`) stays"**: it cannot stay as B3
   wrote it, because a boot factory is at 0 at creation. It moved to the end of the prefix (`handover`), the one tick
   where the live run's clock is known. With an empty prefix it is B3's check exactly.
3. **"Probe counts ≈ B3's 2,440"**: exactly 2,440 on B3's 11 rows. The new row adds 31.
4. **The fork's change is more than apitem takes.** It also re-indexes the fork's equips from the run clock to the tape
   index (`e.t − offset`) and adds the clock check. Both are no-ops wherever the handed-over clock equals the prefix
   length, which is every row measured.
5. **The worker list**: "the worker would have to wire a second factory" is moot now. With D1 the worker gets the
   rewind from the factory it already passes. What remains is the recording Proxy and `out.liveRun`, not a factory.

## Residue

| # | item | owner |
|---|---|---|
| 0 | Removed by name only what I created: the worktree `/home/user/wt-b3b`, the two servers (by PID), my scratch `/tmp/claude-0/b3b` | — |
| 1 | The worker: the recording Proxy does not see post-rewind advances (§ D2.4 item 1); `out.liveRun` unread | JS arc |
| 2 | No measured row forks past an apitem take, so the fork's take replay is proven inert but not shown useful on a real row | fidelity arc (crusher) |
| 3 | B3's residues 1 (capacity re-roll cost), 3 (no late-starting kill), 4 (`ladder2-witness` drift), 5 (`check-procgen-help`) stand, not re-measured | as B3 |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, `jsRuntime*.js`, `flashPanel/*`, the worker, `bait`, `CRUSHER_BAIT`,
  `chooseBodyToRemove`, the ghost-sword press, `procgenOracle`.
- **No committed tape moved; no producer digest moved** (OFF; and ON, the four movers are B3's own).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used.
  Kills by PID only.

## Rows to BANK

- **Nothing moved with the flag OFF, at the rebased base `de0d78314e`**: acceptance `76602ae8`, c3 `4937da80`, c6
  `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, killgate `006b0639`/`7d4cb820`/`49e23d85`, producers `405d9c4b
  b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`; crusher witness `fa10cbc1`; roster 259; surface GREEN 227; constants
  5,443; entities 528; profile 138; tapeRunner 575 `3dd640fa`.
- **New:** `check-seedling-rewind-exactness` 12 probing rows (B3's 11 + `fork-prefix`) — 2,471 probes, 0 mismatches;
  `hammerFightFallback` 10/10.
- **For a licence (ON, not banked):** B3's four movers, unchanged on the rebased base.
