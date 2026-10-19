# Seedling HAMMER-PHASE — slice EX: the escape-admission cache, exact

Slice `seedling-hammer-escape-cache` (Opus, cloud). The planner is `seedling-hammer-phase-planning-2`. ⚖ The user
(2026-10-18) had this run in parallel with SP and TC2.

**Verdict: STOP at D1 (measured).** At the defaults, the honest key repeats on 0.2 % of `pressEscape` calls. It would
save 0.6 % of the L18 sweep, and the bar was 10 %. So `ESCAPE_ADMISSION_CACHE` was not added. No solver code moved,
nothing was re-recorded and no default changed.

| | |
|---|---|
| Start SHA | **`b3adfad282`** (`origin/main` at the fetch) |
| Head | the commit carrying this report. Before it: W0 + D1 evidence `2a51add8`, D4 `793864a8` |
| Branch | `claude/seedling-hammer-escape-cache-vpd6k2` (the name the harness set; the brief's `seedling-hammer-escape-cache`). Nothing went to `main` |
| Verdict | **W0 PASS · D1 STOP (measured; the reason below) · D2 / D3 not built · D4 PASS (records + the owed DK pin)** |

## The one thing to know first

**WC's repeats are real, but they are not repeats of the input.** The same (body, cell, absolute press tick) is asked
again from a *later* tick, and by then the world the search reads has moved. That world is the spinners, the run's
tick and the forecast rows. The input repeats in only two places:
1. **The same run at the same tick:** 0.2 % of calls, ~0.6 % of the wall. A cache keyed this way is exact, but nearly
   worthless.
2. **Across `twoPassSolve`'s passes:** 66.7 % of calls, **38 % (OFF) / 41 % (ON) of the L18 sweep's wall**. Every
   repeat had the same answer and the same work units. But each pass builds a *new* run from *different* persistence.
   The proof that the declared `at` row cannot reach the world before its tick lives in `levelRun.js`, which is
   fidelity's file. So that key needs a state digest from `levelRun`, or that proof (lines named under D1). The brief
   says to STOP there.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `b3adfad282` (`evidence/w0/sha.txt`) |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. **Six** submodules were still `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine), so I ran `git submodule update --init` on each. Node v22.22.0. Servers: `serve-nocache.py 9598` (PID 752, the primary tree) and `9599` (PID 1510, a pristine worktree for W0) |
| defaults | `STRIKE_ETA_FLOOR` **OFF**, `STRIKE_PREVIEW_CAP` 16, `HAMMER_ESCAPE` / `HAMMER_ESCAPE_FALLBACK` ON, `HAMMER_APPROACH` / `HAMMER_FIGHT` OFF, `PRESS_KILL_COST` / `STRIKE_SCAN_COST` / `REFUGE_ETA_CUT` / `PRESS_KILL_DONE_ON_WALK` ON, `GHOST_SPINNER_PRESS` / `GHOST_KILL_RUNG` ON, `DASH_LEG_PRECHECK` / `DASH_KEEP_PARTIAL` ON. `HAMMER_ESCAPE_BOUNDS` {horizon 75, cell 8, maxExpansions 50,000}. Full list and `CONTACT_FIDELITY`: `evidence/w0/defaults.txt` |
| identity block | at a pristine worktree (`evidence/w0/identity-w0.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, **ENEMY `f0bec576`** (WC: `36b59445`; it moved with this week's fidelity flips), guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`. The **generated set** row needs the venv and the page port, so I re-ran it in the primary tree with `SEEDLING_PORT=9598`: **OK** |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1` **`3d41b9fb`**, all exit 0 (the campaign row moved since WC's `6b1bf15c`) |
| reference `--check` | the pristine worktree reports 4 differing regions, in the loop-mode chart, which reads the submodules through the worktree's symlinks. That is environmental. In the primary tree at the base, the only differences were the ones my log entry made, and after D4's regeneration: **ALL 7 + 5 MATCH** |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass (WC: 611 `a970aa03`) |
| surface / constants / entities / profile / roster | GREEN **312** · **6,002** · PASS **566** · PASS **138** · **280** (`evidence/w0/censuses-w0.txt`) |
| bounded vitest BEFORE | `solverBot*`, `hammer*` (not `.slow`), `solveProgress*`, `lintGateLabels`. No `pressEscape*` or `spaceTimeReach*` test file exists. **19 files, 327 / 327** in 389 s (`evidence/w0/vitest-w0.txt`). The DK row passed this time, under one parallel run |

## D1 — the key (STOP)

**The lab** (`evidence/tools/make-lab.py`) was applied to a scratch worktree copy of `solverBot.js`, never to the tracked
tree. For every `pressEscape` call (every caller) it writes one record with these fields:
- **the run** (an id per run object) and its tick, the segment (one per `solveSegment`), the caller, body, cell and
  press tick;
- **the call's arguments** (`state` with its symbol keys, `at`, `keys`, `pressAt`, `id`, `deadline`), hashed by value;
- **the globals**: the whole `CONTACT_FIDELITY` stamp, `GHOST_SPINNER_PRESS`, and the deadline's state (none / live /
  `hammer-escape` tripped, fine or not), plus whether a progress hook is installed;
- **a world proxy**: level, tick, `entities('spinnerBodies')`, `run.state` and `run.gameTime` (the hammer's phase);
- **the answer**: the whole object, and its certificate alone (ok, claim, bound, keys, states, landing);
- **the work units**: `shouldStop` ask points and `onNode` states, counted by wrapping both;
- **the wall time**.

**The lab is inert:** the norm-md5 of every workload's output equals the pristine base's. L18 OFF / ON gave `de6f6e4e` /
`bae5c6de`, staging A sword OFF / ON gave `82834f24` / `7d8e280e`, all equal to WC's.

**The table** (`evidence/d1/d1-table.txt`; the lab's walls include its hashing, so the % of wall is a share, not a
timing):

| workload | floor | calls (strike) | escape s / wall s | **K1** (run, body, cell, press tick) | **K2** = K1 + player state | **EXACT** (run, tick, args, globals) | **CONTENT** across runs (world proxy + args + globals) |
|---|---|---|---|---|---|---|---|
| **L18 sweep (45)** | **OFF (default)** | 56,655 (55,791) | 70.6 / 123.6 (57 %) | 58.4 % of calls · 20.4 % of wall · cert same 99.0 % | 50.1 % · 17.3 % · 100 % | **0.2 % · 0.6 % of wall** · 100 % | 66.7 % · **38.3 %** · 100 % |
| | ON | 81,525 (80,595) | 105.8 / 171.4 (62 %) | 55.5 % · 26.1 % · 99.7 % | 38.1 % · 17.3 % · 100 % | **0.2 % · 0.5 %** · 100 % | 66.7 % · **41.0 %** · 100 % |
| L18 r21, `--deadline=never` (probe) | OFF | 1,626 | 3.0 / 5.8 | 62.7 % · cert 99.1 % | 56.6 % · 100 % | 0.2 % (3 calls) · 1.2 % | 66.7 % · 33.6 % · 100 % |
| | ON | 1,803 | 2.1 / 4.7 | 61.6 % · 99.5 % | 51.4 % · 100 % | 0.2 % · 1.5 % | 66.7 % · 28.8 % · 100 % |
| staging A, sword (L40) | OFF | 20 (14) | **0.0** / 126.0 | 0 | 0 | 0 | 0 |
| | ON | 15 (11) | 0.0 / 54.4 | 2 calls | 1 | 1 | 1 |
| L40 kill rung (`r5-l40-part5`, probe) | OFF / ON | **0** | — | — | — | — | — |

The call counts match WC exactly (55,791 OFF, 80,595 ON on L18). The "same" columns compare each repeat's answer with
the first answer under that key. Under K1 / K2 the full answer differs in > 99 % of repeats, because the `why` strings
carry absolute ticks and the approach states differ. The certificate (the escape from the landing) agrees, as WC found.
Under EXACT and CONTENT, the full answer, the ask count and the node count agree in **100 %** of repeats.

**What the rows mean:**
- **K1 / K2 are cross-tick.** A K1 repeat is the executor re-deriving one tick later and asking the same absolute
  press tick. Between the two calls the run advanced, so these inputs differ:
  - the spinners, which move every tick;
  - `n`, so the forecast rows are re-indexed and re-derived from new live bodies;
  - the approach, which starts from a different state and covers one tick fewer.

  The certificate agrees 99–100 % of the time, but no key over the full input can match these calls. Equal answers on a
  key that drops inputs are evidence, not exactness.
- **EXACT** is the only key the solver can honestly build. The fields are the run object, `run.ticksCompleted`, the
  call's arguments by value, and the globals. `levelRun` states that `advance` is the run's only mutator
  (`levelRun.js:16044-16053`). That is not quite true: `equipNow` (`replayOntoFork`, `solverBot.js:18161`) and the
  view's apitem take also write to the run, so a real key would also need the weapon slot. Even with that, it repeats on
  135 / 159 calls (one same-tick re-derivation per segment). That is 0.6 % / 0.5 % of the L18 wall: **STOP (< 10 %)**.
- **CONTENT is where the time is,** and every one of those repeats is across passes:
  - Each L18 residue is solved by `twoPassSolve` in **3 passes**, so 135 segments, one run each, with no forks inside a
    pass. Passes 2 and 3 replay pass 1 below the declared tick and re-ask the same escapes. Every repeat had the same
    answer, asks and nodes.
  - A per-solve cache keyed on the run's whole state would save **38 % of the sweep OFF and 41 % ON**.
  - **The key it needs is not the solver's to build:**
    - Pass k + 1's run is a NEW `createLevelRun` from different persistence: the kill-lock's `PENDING_AT` row becomes
      the measured `at = T`.
    - That its state below T equals pass k's is an argument about `levelRun`, not a value either side can compare.
      `assertTwoPassPrefixAgrees` checks the keys after the fact, and a cache that fed pass 2 from pass 1 would make
      those keys agree by construction, which hides a real divergence.
    - The lines the argument rests on (fidelity's file, read only):
      - `levelRun.js:851-855`: boot clears skip `at` rows;
      - `:876-877`: `timedClears`;
      - `:899`: `declaredClears = persistence`, read by the kill-lock arms at `:3088`, `:3120`, `:10310` and `:11255`,
        which read the row's existence, not its tick;
      - `:935-941`: `applyTimedClears` fires only at `c.at === tick`;
      - `:18288`: `advance` calls it.
    - What's missing is either a `levelRun` state digest (what the forecast memo's key at `:16032-16056` enumerates,
      plus the stepper's `stepOptsFor` bag at `:17544-17560`, `slashInfoNow` / `swordWindow` / `inventory` / `ceremony`
      read by `spinnerForecastWithPress` at `:16205-16240`, and the visit clocks), or a stated invariant that a timed row
      is inert before its tick.
- **The world proxy is not complete.** WC's v1 proxy, without `gameTime`, gave 30 (OFF) / 47 (ON) cross-run repeats with
  a *different* answer: the residues re-phase the hammers and the proxy missed it. Adding the game time took that to 0,
  but that is a measurement, not a proof that nothing else is missing. Fidelity-9's visit clocks (axes, beam towers,
  lava chains) are among the readers the solver cannot see.

**Work units.** Under every key the ask count of a repeat equals the first call's (100 % under K2, EXACT and CONTENT).
`onNode` counts agree wherever the certificate does. So a replay is feasible in principle. Since no cache was built,
nothing replays.

**STOP, with the floor-ON figure.** At the defaults the exact key saves 0.6 % of L18 OFF. With the floor ON it saves
0.5 %, so L18 ON + the exact cache ÷ OFF ≈ 170.6 / 123.6 = **1.38×** (lab walls; the lab's ON ÷ OFF is 1.39×, WC's
pristine 1.42×). For the record, a cross-pass cache, if `levelRun` gave it a key, would make ON ÷ OFF about
101.1 / 123.6 = **0.82×** against today's OFF, or **1.33×** against an OFF that had it too.

## D2 / D3 — not built (STOP)

`ESCAPE_ADMISSION_CACHE` was not added. No gate rows, mutants or timing rounds were run for a cache that does not exist.
The replay design is in the residue, for whoever gets the key.

## D4 — records, and the owed pin (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase EX — the escape-admission cache` |
| owed DK pin | `hammerDashShape.test.js`'s row *"ON, sweep request 392:0 solved whole ships the same ticks for less work"* moved, **byte-identical** (body, assertions, its 180 s timeout, and its `describe` label), to **`frontend/modules/seedlingDemo/hammerDashShape.slow.test.js`**. The source file leaves a comment where the row was, its docblock names the new home, and its now-unused `solveAnytime` import is gone. `test:unit` excludes `*.slow`; `test:unit:slow` (serial) runs it: **1 / 1 in 32 s solo** (`evidence/d4/vitest-slow-dk.txt`) |
| surface / constants | no solver code moved: `--check` only, GREEN **312** · **6,002**, 0 drift (`evidence/d4/censuses-d4.txt`) |
| reference | `generate-procgen-reference.mjs` (the log moved the procgen README's word count and `docsIndex.js`), then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs, unchanged |
| bounded vitest AFTER | the W0 set plus `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeIndexManifest`: **22 files, 669 / 669** in 386 s (`evidence/d4/vitest-d4.txt`) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, nothing to `main`, no AS3, wasm, gitlink or rules edit. `botDriverV2.js`, `solveProgress.js`, `deriveStrike` / `execKillByPress` and fidelity's files were untouched |

**CI for the planner.** `JavaScript Unit Tests` at the head, read with `node scripts/procgen/ci-vitest-summary.mjs
<head> --wait`. No solver code moved, so no divergence sweep is needed.

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-hammer-escape-cache-vpd6k2`.
2. **"56 % repeat a (body, cell, absolute tick) … 38 % also repeat the player state, and all of those get the same
   answer."** The numbers reproduce (55.5 % / 38.1 % ON, 99.7 % / 100 % same certificate). But every one of those
   repeats is asked from a later tick, so the full input differs. They cannot be cache hits under an exact key.
3. **"Est. saving 15–23 % of the ON sweep."** Under the exact key it is 0.5 %. The large saving exists only across the
   two-pass loop's passes (41 % ON), and that key belongs to `levelRun`.
4. **"floor ON's whole extra cost is the escape … `strikeEscape` +50.3 s."** Measured directly: escape time is 70.6 s
   OFF and 105.8 s ON (+35.2 s of a +47.8 s lab-wall delta). That agrees in direction but is smaller than WC's profile
   attribution.
5. **"L40" as a workload.** The solve-progress L40 row (`r5-l40-part5`, the kill rung) never calls `pressEscape`, and
   staging A (also L40) calls it 20 times for ≈ 0 s. At these workloads the escape is an L18 cost.
6. **The bootstrap left six submodules uninitialised** after `READY` (as WC found).
7. **"`advance` is its only mutating member"** (`levelRun.js:16044`, which the brief's per-tick reasoning leans on) is
   stale. `equipNow` and the apitem take also write to the run (`replayOntoFork`, `solverBot.js:18161`; the segment's `equip`, `:18745`).

## Residue

1. **For the user: the cross-pass escape cache, a fidelity-side decision.** 66.7 % of L18's escape calls (38–41 % of the
   sweep) repeat across `twoPassSolve`'s passes, with equal answers and work. An exact form needs one of two things:
   - (a) a `levelRun` state digest, a reader over everything the escape reads, including the visit clocks;
   - (b) a stated, gated invariant that a timed (`at`) persistence row is inert before its tick, so the key can be
     (staging, persistence with `at` rows past the tick masked, held prefix, equips, takes).

   Either is `levelRun.js` (fidelity's). With it, the cache would sit around `pressEscapeOnce`, scoped per
   `twoPassSolve` call. A hit would replay the miss's ask points in order through `deadlineReached('hammer-escape')`
   and its `onNode` (x, y, index) list through `progressStatesFor`. A trip at ask k returns the deadline negative that
   ask k would have returned (its expansions, nodes and deepest recorded per ask), and a miss that tripped is not
   stored. The design is sketched here, not built.
2. **The weapon slot is a run mutation the forecast memo's key does not name.** `spinnerForecast`'s memo keys on
   `ticksCompleted` and others, and its docblock claims `advance` is the only mutator. `equipNow` between two forecasts
   in one tick would change `weaponForPress` but not `spinnerForecast`'s rows (the memo holds no press), so I see no
   live defect. The docblock is stale, though. That is fidelity's to reword.
3. **Tree hygiene.** The scratch worktrees (`ex/lab`, `ex/base`) were removed by name, the two `/tmp/seedling-driver-*`
   stages my generated-set runs kept were removed by name, and both servers (PIDs 752, 1510) were killed by PID. The raw
   lab records (~4 MB gzipped) are not committed; `evidence/tools/` reproduces them.
