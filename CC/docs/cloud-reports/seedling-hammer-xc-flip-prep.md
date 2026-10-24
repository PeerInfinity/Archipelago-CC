# Seedling HAMMER-PHASE — slice XF: XC flip prep

Slice `seedling-hammer-xc-flip-prep` (Opus, cloud). The planner is `seedling-hammer-phase-planning-2`. ⚖ The user
(2026-10-18) picked "XC flip, then the floor flip". Every flip is the user's call. This slice builds the evidence and a
flip-ready branch, and lands or flips nothing on `main`.

**Verdict: W0 PASS · D1 PASS (constructed; no committed workload can reach it) · D2 PASS · D3 PASS · D4 PASS.**

| | |
|---|---|
| Start SHA | **`0f4bcfaef5`** (`origin/main` at the fetch) |
| D2 branch | `claude/seedling-xc-flip-prep-j4d9z4` (the harness's name; the brief said `seedling-hammer-xc-flip-prep`). D2 code `3ced5997`, then evidence `ef7359aa` / `30a01b9f`, D4 `f5bd6ced`, then this report |
| Flip branch | **`seedling-hammer-xc-flip`**, head **`d157d3c4`**: default flip `d8eab5a0` (evidence measured here), then the reference regenerated `d157d3c4` (word counts only). Parent `3ced5997` (the D2 code head). **Not merged anywhere** |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-xc-flip-prep-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `flip/`, `tools/`) |

## The one thing to know first

**No room in the game can put a beam tower inside an escape SEARCH.**
- The escape searches only after the press LANDS on a spinner, and no room holds both: spinners are in L18 / 39 / 40 /
  92, towers in L103–108.
- L104's `unmodelled` return (the carried shield) is the first of two walls. With the shield dropped, it returns at
  `no-landing`.
- So fidelity-9's condition is met by a CONSTRUCTED room: L18 plus one injected tower.
- Two rows pin it:
  - **two seam times**: the drift parts the answers;
  - **a visit-only pair**: the only shape a key without `visit` can confuse.
- The seam-time row cannot catch the visit-dropped mutant, because the `staging` and `clock` parts already part it.

## W0 — the base (PASS)

`evidence/w0/`, the primary tree at `0f4bcfaef5`.

| row | result |
|---|---|
| base | `git checkout -B <branch> origin/main` → `0f4bcfaef5`. `session_bootstrap.sh --seedling`: `READY`, Node v22.22.0. Six submodules were `-` after `READY` (XC's finding 8 again), initialised by name. Server `serve-nocache.py 9603`, PID 591 |
| defaults | `ESCAPE_CROSS_PASS_CACHE` OFF, `STRIKE_ETA_FLOOR` OFF (cap 16), `HAMMER_ESCAPE` + fallback ON, `PRESS_KILL_COST` / `STRIKE_SCAN_COST` / `REFUGE_ETA_CUT` ON, `GHOST_SPINNER_PRESS` / `GHOST_KILL_RUNG` ON (`w0/defaults.txt`) |
| identity block | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK, reference **ALL 7 + 5 MATCH**. Every row equals XC's W0 |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN **314** · **6,028** (0 drift) · PASS 566 · PASS 138 · 280 |
| bounded vitest BEFORE | `escapeCrossPassCache`, `solverBot*`, `hammer*` (not `.slow`), `twoPassSolve*`, `levelRunStateDigest*`, `lintGateLabels`: **19 files, 291 / 291** |

## D1 — the beam-tower search (PASS: constructed, after measuring that nothing committed reaches it)

**The census** (`tools/d1-census-hook.mjs`, one record per `pressEscape` call through `HAMMER_ESCAPE_TRACE`; the level,
whether its world holds a `BeamTower` Solid, and how the call ended):

| workload | calls | in a tower world | searched | early `no-landing` | other |
|---|---|---|---|---|---|
| `r8-battery`, `r8-tail`, `r9-l3` `--check` | 0 | 0 | — | — | — |
| `r8-l18` / `r8-d2-chain` `--check` | 807 each (L18) | 0 | 36 | 771 | — |
| `r9-campaign --check` | 1,626 (L18) | 0 | 42 | 1,584 | — |
| killgate s2 / s5 / s9 (L900) | 657 / 81 / 342 | 0 | 72 / 72 / 81 | 585 / 9 / 261 | — |
| **L18 sweep** (45 residues) | **56,655** | 0 | **2,028** | **54,471** | `approach` 141, `line` 15 |

The atlas: towers in **L103, 104, 105, 107, 108**; spinners in **L18, 39, 40, 92**; both: **none**.

**Why L104 stops early, and whether another tick or stance avoids it** (`d1/l104-shield.txt`):

| L104 call | t100 | t150 | t200 |
|---|---|---|---|
| as staged (the seam boots `hasShield`) | `claim: false`, the shield's `unmodelled` | same | same |
| shield dropped from the seam's `items` | `no-landing`: no test reached a body | `no-landing`: the press is swallowed | `no-landing` |

So no tick or stance in L104 helps. Passing `id: null` does not help either: the room holds 0 spinners, and the forecast
lands only on a spinner.

**The construction** (`tools/d1-tower-grid.mjs`, `tools/d1-visit-only-pairs.mjs`):
- L18's record plus one `beamtower` at (92, 84), `direction` 1 (up), `rate` 4 (it holds its side, so the beam never
  crosses the walk).
- The call is XC's spinner row: from t76 along the tape, the press at t77 on the first spinner. The player carries no
  shield.
- The tower's 16x32 Solid stands beside the escape's search region. The walk to t76 is the tower-free run's (the
  player's state measured equal).
- **The seam pair:** shifts 0 and **45**. 45 is one hammer period (`gameTime % 45`) and half the drift's period
  (`worldFrame(time, 100, 2)` spans 90). Without the tower, both shifts give the same answer (`d1/l18-t76-press.txt`).
  With it, the escapes take **75 vs 9,685** expansions and answer differently.
- The grid found 5 / 25 placements (step 8) and 21 (step 4) where both shifts search and answer differently
  (`d1/tower-grid*.txt`).
- **The visit-only pair:** both BEAMTOWER switches OFF for the first k ticks of one run, so its tower is built at k.
  At (92, 84), k = 40 gives **75 vs 10,515** expansions, and only `visit` differs. 36 (placement, k) pairs qualify
  (`d1/visit-only-pairs.txt`).

## D2 — the rows (PASS)

Two rows in `escapeCrossPassCache.test.js` (17 → **19**, both ~4 s). The helpers are `TOWER_SOURCE`, `towerRunAt`,
`towerCall`.

**Row 1 — a drifting beam tower inside a SEARCH, two seam times a hammer period apart:**
- the tower is beside the walk (the player at t76 equals the tower-free run's), and no shield is carried;
- control: with no tower, and with the tower present but `beamTowerDrift` OFF, shift 0 and 45 give the same OFF
  answer;
- drift ON (the default): the two `visit` parts differ, both escapes are entered and SEARCH (expansions > 0 each), the
  work and the answers differ;
- ON in one scope: 2 misses, 2 entries, each OFF's answer; asked again, 2 hits, each its own answer;
- verify mode: 2 verified, 0 mismatches.

**Row 2 — `visit` is in the key:**
- one seam, one tick, one clock, one player: the parts that differ are exactly `['visit']`;
- both escapes SEARCH and their answers differ;
- ON: 2 misses, 0 hits, 2 entries; verify: 2 verified, 0 mismatches.

**Mutants** (`d2/mutants.txt`, `tools/xf-mutants.py` on a scratch worktree):

| mutant | red rows |
|---|---|
| **M9: the key's digest without `visit`** (and the moved-check on the same digest) | **row 2**; XC's per-CALL row (a lazy visit build is no longer seen as a move); the deadline row |
| M1: no digest (XC's, re-run) | **row 1**, **row 2**, both XC clocked-hazard rows, the deadline row |

**Row 1 stays green under M9. That is measured, not missed:** a seam shift moves `staging` (the seam) and `clock` too.
Only a visit-only pair can tell whether `visit` is in the key, which is why row 2 exists.

## D3 — the flip branch and its evidence (PASS)

**The branch** `seedling-hammer-xc-flip` changes:
- the default: `enabled: SEEDLING_ESCAPE_CROSS_PASS_CACHE !== '0'`;
- the docblock;
- the default row, which reads the env and checks that `withEscapeCrossPassCache(false, …)` restores;
- `seedling-bot.md`'s paragraph;
- a bot-log entry;
- the regenerated reference (word counts).

No other code moved.

**Its local evidence** (`evidence/flip/`, measured at `d8eab5a0`; `d157d3c4` adds only the regenerated reference):

| row | result |
|---|---|
| identity block | every md5 equals W0's; the six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0. Reference at `d8eab5a0`: 2 regions differed (word counts from the docs edits), regenerated in `d157d3c4`, then **ALL 7 + 5 MATCH** |
| surface / constants | GREEN 314 · 6,028, 0 drift (the `'1'` → `'0'` literal is cosmetic/structural) |
| tapeRunner pairs | 617 `8f27f975`, 0 non-pass |
| hammer tier + progress rows | W0's 19 files + `solveProgress`, `solveProgressHeartbeat`, `solveProgressTap`: **22 files, 375 / 375** with the cache ON by default |
| verify campaign (`SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1`) | `r9-campaign` 1,626 lookups / 1,084 verified; `r8-l18` and `r8-d2-chain` 807 / 538 each; battery, tail, l3: 0 lookups; L18 sweep floor OFF 56,655 / 37,770; floor ON 81,525 / 54,350. **94,280 hits verified, 0 mismatches**, all exit 0, the sweeps' norm-md5 `de6f6e4e` / `bae5c6de` (OFF's) |

**The full-sweep A/B the planner should dispatch** (XC residue 1's checklist). Run `seedling-hammer-xc-flip` (ON) against
its parent `3ced5997` (OFF; = `main` + test rows only), capture on. Two arms on the ON branch, one of them with
`SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1`. Read per leg:
1. the verdict, the tape bytes, the ticks and the `perTick` md5. All must equal the parent's;
2. the progress capture: the v1 projection and the v2 fields (`rejectionKinds`, `lastWhy`, `frame`). All must be
   equal;
3. the deadline: the `shouldStop` totals and `budget.asks` by site. A worker solve installs a real clock, so trips land
   on hits (`tripReplays` > 0 somewhere is expected). All must be equal;
4. `ESCAPE_CROSS_PASS_CACHE_COUNTS` per leg, in the verify arm: `verifyMismatches` 0 over the whole harvest, and
   `verified` > 0 (the count it checked);
5. `notStoredCap` and the peak `maxNodes` under the progress hook (the hook makes entries large). No leg should hit
   the cap;
6. `wallBySite`: read it, do not pin it (a hit spends ~0 at its site). The expected wall: L18-type legs ≈ 0.7×,
   legs with no escape ≈ 1.0×;
7. `jsRuntimeSolver`'s recording Proxy is not served (no fewer `stateDigest` reads than the census).

The flip is answer-identical by construction, so any mover in (1)–(3) is a defect, not a trade.

**The floor** (`STRIKE_ETA_FLOOR`) on the D2 branch: 3 interleaved rounds, three modes per workload
(`evidence/d3/floor-walls.jsonl`, `tools/xf-floor-rounds.sh`):

| workload | today (both OFF) | cache ON | **floor ON + cache ON** | floor+cache ÷ today | floor+cache ÷ cache |
|---|---|---|---|---|---|
| **L18 sweep** | 136.8 / 128.7 / 126.9 (**128.7**) | 98.8 / 91.6 / 90.0 (**91.6**) | 129.1 / 124.5 / 127.8 (**127.8**) | **0.99×** | **1.40×** |
| staging A, sword | 139.9 / 133.8 / 174.8 (**139.9**) | 138.7 / 130.6 / 134.1 (**134.1**) | 60.1 / 59.0 / 60.5 (**60.1**) | **0.43×** | 0.45× |
| L40 kill rung (`r5-l40-part5`) | 5.3 / 4.8 / 4.7 (**4.8**) | 5.3 / 4.9 / 5.1 (**5.1**) | 5.2 / 4.7 / 5.0 (**5.0**) | 1.04× | 0.98× |

Medians in bold. The box ran ~30 % slower than XC's (L18 today 128.7 vs 98.8 s); the ratios reproduce XC's (1.00 /
0.72 / 1.39). ⚠ Two short probes (≈ 3 s) ran during round 1's first workload.

**The floor's answer movers** (norm-md5 is stable in every round; the cache moves nothing):
- **L18 sweep** `de6f6e4e` → `bae5c6de`:
  - all 45 residues still SOLVE, with 0 verdict movers;
  - **24 shorter, 21 longer, 0 equal**, sum 19,545 → 19,558 t;
  - the largest movers: r38 363 → 586 (+223), r44 346 → 483, r34 363 → 486, r17 492 → 367 (−125), r15 / r16 449 / 445
    → 367 (`d3/l18-off.out`, `d3/l18-floor-cache.out`).
- **Staging A (sword)** `82834f24` → `7d8e280e`: still REFUSED at `bob@736,752` (the chest corridor's chaser), but
  `spinner@880,848` dies at **t1740** instead of **t3100**, and the refusal comes at t1753 instead of t3113. The
  landings are 511 / 1610 / 1654 / **1740** against OFF's 511 / 1770 / 1985 / 2960 / 3062 / **3100**.
- **L40** `r5-l40-part5`: the same answer `3addc379`, 679 t, 372 hook calls. Its norm-md5 differs in one round only
  through the wall-dependent "longest gap" text (as XC found).

No floor-flip branch was built.

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase XF — XC flip prep` (D2 branch). The flip branch carries its own `### … XC flip` entry |
| surface / constants | `--check`: GREEN 314 · 6,028, 0 drift. No `--write` was needed: no surface or literal moved on the D2 branch |
| reference | `generate-procgen-reference.mjs`, then `--check`: **ALL 7 + 5 MATCH**; `generate-docs-index.mjs`: 187 docs (unchanged) |
| bounded vitest AFTER | the W0 set: **19 files, 293 / 293** (291 + the two rows) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No AS3, wasm, gitlink or rules edit, no `git stash`, nothing to `main`, no force-push. `levelRun.js`, `mover.js`, `contactFidelity.js`, `strikePolicy.js`, `botDriverV2.js`, `solveProgress.js`, `execKillByPress` / `deriveStrike` / the chooser, the tap, `jsRuntimeSolveService.js` and `flashPanel/*` were read, never edited. The test toggles `CONTACT_FIDELITY.beamTowerDrift` / `beamTowerBeamHit` at runtime and restores them; the module is unchanged |

## What the brief got wrong (measured)

1. **The branch.** The harness names the D2 branch `claude/seedling-xc-flip-prep-j4d9z4`.
2. **"A staging, a press and a tick in a beam-tower room where the forecast has no unmodelled probe."** No such call
   searches. Without the shield, a tower room returns at `no-landing`, because the escape's search starts at a landing
   on a spinner and no room holds both. The construction needed an injected tower in a spinner room.
3. **"Say whether another tick or stance avoids it."** None does in L104 (t100 / 150 / 200, `id` none or null).
4. **"A mutant: the visit part dropped → the row goes red"** (the two-seam row). It stays green. Two seam times differ
   in `staging` and `clock`, so a visit-less key still parts them. The red row is the visit-only pair (row 2).
5. **"The digest's visit part is covered only by DIGEST's own mutants."** It was not: XC's per-CALL row (the lazy
   build) already goes red under M9. What no row covered was a drifting visit state that matters to a search; rows 1
   and 2 add it.
6. **"The floor flip changes answers."** Only some workloads. L40's kill rung is answer-identical under the floor.
   L18's verdicts are all unchanged (45 / 45 SOLVE); only lengths move.

## Said plainly — a mistake and its repair

`git add -A` in the flip worktree committed that worktree's `node_modules` symlink. Checking that local commit out in
the primary tree replaced the primary's ignored `node_modules` directory: git treats ignored files as expendable.
- The commit was **never pushed**. I amended it locally (`git rm --cached node_modules`) before the first push.
- I restored `node_modules` with `npm ci`, and re-ran the censuses green.
- Every flip-branch number above was measured after the repair.

## Residue

1. **The flip itself** is the user's call. Before it, the planner dispatches the A/B above, the flip branch against
   `3ced5997`.
2. **CI.** The push run of `JavaScript Unit Tests` at this report's head and at `d157d3c4` is the suite number (⚖ 52):
   `node scripts/procgen/ci-vitest-summary.mjs <sha> --wait`. I dispatched nothing.
3. **The floor flip** (later, separate): it costs 1.40× on L18 over a cache-ON base (0.99× today's wall). Its movers
   are listed above, and there is no branch for it.
4. **A real tower-and-spinner room** would make rows 1 and 2 natural instead of constructed. That is generator or
   level work (one class per chamber today), not this slice's.
5. **Tree hygiene.** The scratch worktrees (`mut`, `flip`) are under the scratchpad and removed by name; the dev server
   on :9603 (PID 591) is killed by PID.
