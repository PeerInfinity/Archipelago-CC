# Seedling FIDELITY — slice DIGEST: `run.stateDigest()`, the key for a cross-pass escape cache

Slice `seedling-fidelity-digest` (Opus, cloud). The planner is `seedling-fidelity-planning-9`. ⚖ The user (2026-10-18:
*"I agree with that plan"*): fidelity's digest lands first, then hammer's cache, briefed on top of it.

**Verdict: W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS.**
- The digest is **emit-only**. Nothing calls it by default, and every tape, md5, `--check` and bounded vitest row is
  unchanged.
- On EX's L18 sweep: **0 false-equal pairs** OFF and floor-ON, and on the clocked-hazard probe.
- It matches **99.9 %** of EX's CONTENT repeats (66.7 % of calls). Those calls are **36.5 % (OFF) / 38.3 % (ON) of
  the lab's wall**.

| | |
|---|---|
| Start SHA | **`b73f3181`** (`origin/main` at the fetch) |
| Head | the commit carrying this report. Before it: W0 + D1 `7a1489ab`, D2 `728db6da`, D3 `f247c8a2` (vitest rows, mutants, probe evidence) |
| Branch | `claude/seedling-fidelity-digest-myfjmh` (the harness's name; the brief said `seedling-fidelity-digest`). Nothing went to `main` |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-digest-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `tools/`) |

## The one thing to know first

**A declared row reaches the escape only through what `applyTimedClears` writes, and it writes at `c.at === tick`.**
- The escape reads eight run members. By code, the closure they reach reads 74 bindings.
- `persistence`, `timedClears` and `declaredClears` are **not** among those 74 bindings.
- So two runs whose row is `PENDING_AT` and `at = T` are indistinguishable to every escape reader below T. That is
  measured, not argued:
  - the digests are equal through `ticksCompleted = T`;
  - they first differ at `T + 1`, in `place` and `persist` only;
  - the escape's whole run surface agrees on the ticks the digest does.
- A no-row run (pass 1) also digests equal below T. Its own `advance` at T throws: the kill-lock arm, which no escape
  reads.

**There is one reader that CAN tell `PENDING_AT` from `T` below T: the kill-lock ledger.**
- `spinnerKillLockOpens[].declaredAt` (and the chaser's, and `staticBodyDeaths`) records the row's `at`.
- It does so from the removal on: t306 in L18, 100 ticks before T = 406.
- The arms' *decision* reads the row's existence only.
- No escape reads that ledger, so the digest leaves it out. A whole-run digest would have to include it (D4).

## W0 — the base (PASS)

Battery: `evidence/tools/battery.sh`, at the untouched base in the primary tree.

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `b73f3181` (`w0/sha-w0.txt`). EX's branch `claude/seedling-hammer-escape-cache-vpd6k2` @ `70490b1f` was fetched for its report, lab and evidence |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, Node v22.22.0. As EX found, six submodules were still uninitialised after `READY`; each was `git submodule update --init`ed by name. Server: `serve-nocache.py 8000` |
| identity block | `w0/identity-w0.txt`: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set **OK**, reference **ALL 7 + 5 MATCH**. Every row equals EX's at `b3adfad282` |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 (= EX) |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass (= EX) |
| surface / constants / entities / profile / roster | GREEN **312** · **6,002** · PASS **566** · PASS **138** · **280** |
| bounded vitest BEFORE | `levelRun`, `contactFidelity`, `contactFidelityHook`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `twoPassSolve`, `fidelityKillLock`, `fidelityLapseCost`, `fidelityAxeTiming`, `fidelityBeamTower`, `fidelitySpinningAxe`, `fidelityLavaChainPlayer`, `fidelityForkHygiene`, `tapeIndexManifest`: **14 files, 684 / 684** (`w0/vitest-w0-summary.txt`) |

## D1 — the field census, by code (PASS)

**The method.** Two AST tools (`@babel/parser`), committed in `evidence/tools/`.

1. `escape-reach.mjs` starts at `strikeEscape` / `pressEscape` and follows every call to a top-level function of
   `solverBot.js`, `spaceTimeReach.js`, `solveProgress.js`, `ghostSpinnerPress.js`, `playerPhysicsV2.js` and
   `hazards.js`. It reaches **49 functions** and **8 run members**:
   - `ticksCompleted`, `state`, `level`, `world`, `previewStepper`, `spinnerForecastWithPress`, `gameTimeAt`
     (`clearOfHammersAt`) and `progress` (`strikePressOf`);
   - `level` and `world` are also read by `tilesOf` (the progress instrument) and `lethalFloorFrom`
     (`fallDestination(run.world, …)`).

   It also lists the module-level switches those 49 functions read (`d1/escape-reach-solverbot.txt`).
2. `closure-census.mjs` takes every binding at `createLevelRun`'s top scope:
   - **594 bindings** in total: parameters, `let`, `const` and functions;
   - for each one, every reader and every writer, attributed to the closure function or run member it sits in;
   - from the 8 members, the call graph by name reaches **145 closure units**. Those units read **74 non-function
     bindings**.

   It runs without the local-shadowing filter, which over-approximates. The filtered run finds 73; the one more is
   `cutscene`.

**The table** is `d1/d1-census-table.md`. Each of the 74 rows gives the declaration line, its readers inside the
reach, every writer, and the digest component. Condensed:

| digest component | bindings (read in the escape's reach) | where they are written |
|---|---|---|
| `staging` | the parameters `boot noclip noHazards noDamage grants equips roles pins save seam` | never: constant for the run, but they differ between runs |
| `place` | `level ticksCompleted firstTickInWorld world worlds` | `enterWorld`, `advance`, `runFrozenTick`; `world` / `worlds` are rebuilt by `applyClearNow`, `applyTimedDespawns`, `applyEarnedClears`, `fireStaticRemovals`, `dropWorldIfBuiltStale`, `stepBulbGraphicNow` |
| `clock` | `clock` (`now()`), `clockRefusal` | `advance` / `spendFrozen` (`clock.spend`); **`adoptWindowClock`** (a member, not `advance`) |
| `player` | `state damage frozenTimer swordWindow slashState slashEndsAt spearEndsAt ceremony bobArena bobNoInput primary slotOrder inventory grantsByLevel equipsByTick` | `advance` and its steppers; **`equipNow`** (`primary`, `equipsByTick`: `replayOntoFork`, `solverBot.js:18161`, and the segment's equip, `:18745`); **`addEquips`** (`equipsByTick`) |
| `persist` | `clearedByLevel pendingEarnedClears despawnedByLevel staticRemovedTags unreadRoomWrites totemParts keys collectedPickups lockSnap moonrockSet chestOpens rockFalls` | `applyTimedClears` → `applyClearNow` (at `c.at === tick`), `applyEarnedClears`, the kill / press / chest arms; **`takeApItem`** (the view's apitem take: `pendingEarnedClears`) |
| `visit` | the 18 `…States` maps the reach reads (`activator bridge pushable rock burn rope fallRock moonrock crusher boss shieldBoss finalDoor turret beamTower magicalLock chest pulser spinner`), `pullsByLevel wandWindows fireWindows` | their own `…StateFor` (a LAZY first build), `freshVisitState`, `dropWorldIfBuiltStale`, `advance` |
| excluded, by name | `levelSource` (a function: the caller keys on the staging it came from), `crossRoomWriterIndex` (a memo of `levelSource`), `PROGRESS_FIELDS` (frozen), and six pure functions of digested parameters: `seamBoot clockDeclared bootCutscene cutscene` (`seam`), `bootSave` (`save`), `spawn` (`boot`) | — |

74 = 65 digested + 9 excluded by name; 0 unaccounted.

**The persistence channel, every reader** (`d1/d1-census-table.md`, tail). None of these is read in the escape reach:
- `persistence`: read at construction only, into `clearedByLevel` (rows without `at`), `timedClears` and
  `declaredClears`.
- `timedClears`: read by `applyTimedClears`, `appliedTimedClearsNow` and `addTimedClears`.
- `declaredClears`: read by `assertSpinnerRemovalIsDeclared`, `assertChaserRemovalIsDeclared`,
  `assertScratchSlotIsFree`, `fireStaticRemovals` and `addTimedClears`.
- `despawn` and `scratchPersistence`.

**The crux, measured** (`levelRunStateDigest.test.js`, on `r9-solve-18`'s committed `{18,0} at 406`):

| question | answer |
|---|---|
| does any ESCAPE reader see `PENDING_AT` and `at = T` differently below T? | **No.** By code: no escape reader reads either list. Measured: the digest and the escape surface (the 8 members, probed) are equal through `ticksCompleted = 406`. The first difference is at **407**, in components `place` + `persist` (the clear and the rebuilt world) |
| do the kill-lock arms? | Their DECISION reads existence only (`declared.some((p) => p.tag === o.flag)`), so `PENDING_AT` ≡ `T` for them. Their LEDGER ROWS record the `at`: `declaredAt [[406]]` vs `[[9007199254740991]]`, from the removal at t306. So do the throw messages (`assertScratchSlotIsFree`'s `with at=…`). No escape reads any of these |
| and a run with NO row (pass 1)? | Its digest is equal below T (`declaredClears` is not read). Its `advance` from 406 throws `undeclaredKillLock {18, [0]}`: the kill-lock arm, scheduled at the removal + fade |

**The other mutators.** `d1/member-writers.txt` lists, for every run member except `advance`, every binding its reach
writes.
- The real writes are: `equipNow`, `addEquips`, `addTimedClears`, `takeApItem` and `adoptWindowClock`.
- The rest are lazy first builds (`worldFor`, the `…StateFor` getters) and memos.
- The census also attributes writes to `stateDigest`. That is an over-approximation: a read of `world` pulls in its
  initialiser. The "reading it changes nothing" row disproves it, and so do the mutants' exact restores.

**The switches.** `flag-closure.mjs` walks `levelRun.js`'s static import closure: 74 modules, 21 non-frozen UPPER
objects. Minus the four `…_COUNTS` counters (instruments), 17 remain:
- 12 are read inside levelRun's closure. `CONTACT_FIDELITY`, `KILLLOCK_BODIES`, `PRESS_KILL_COST`,
  `GHOST_SPINNER_PRESS` (`ghostSpinnerPressFor`), `GHOSTSWORD_PRESS`, `GHOSTSWORD_MOTION`, `STATIC_SWORD_ARM`,
  `PUSH_SPEAR_DIRECTION`, `WAND_VERB`, `PICKUP_REMOVED_NEXT_FRAME`, `NEAREST_TILE_INDEX` and `SOLID_GRID` are
  digested (`globals`).
- 5 are solver-side switches that live in pressKillCost / ghostSpinnerPress and that levelRun never reads:
  `STRIKE_SCAN_COST`, `PRESS_KILL_BOMBS`, `REFUGE_ETA_CUT`, `GHOST_SEARCH_BUCKETS` and `GHOST_KILL_RUNG`. The caller
  keys on them, with solverBot's own (D4).

**Known limits of the census tools**, named:
- The writer column misses writes through an alias or a method (`const st = spinnerStateFor(level); st.byId.set(…)`,
  `clock.spend`, `c.applied = true`). The reader set is what the digest needs, and readers are not affected.
- Calls are followed by name. A closure stored in state is attributed to the unit that creates it.
- Functions in imported modules are not entered from `levelRun` (only their switches). The data they read is passed in
  from closure bindings, which are counted.

## D2 — `run.stateDigest()` (PASS)

`levelRun.js` (commit `728db6da`):

- `stateDigest({parts = false, fresh = false} = {})` returns a 28-hex-digit (106-bit, two `cyrb53` lanes) hash of the
  components' hashes. `parts: true` returns `{digest, parts}` with the seven component hashes: `staging`, `place`,
  `clock`, `player`, `persist`, `visit`, `globals`.
- `stateDigestParts` has the field list, with the docblock naming every exclusion.
- It uses two module functions, `canonicalDigestText` (exported, for tests and labs) and `digestOfText`.
- The canonical text:
  - keeps the run's own orders (Map / Set / array / object insertion order);
  - writes no object identity: a cycle is `^depth`;
  - writes numbers as `String(n)`, with `-0` as its own token;
  - never invokes a getter, and writes a function as `fn`.

  Over 280 tapes, no function sits in any non-world component (`d2/replay-scan.jsonl`; the debug walk found none).
- A world is hashed once per object, from its own data properties. A tile-write world is hashed as its base's hash plus
  its own tiles. `fresh: true` re-hashes every world.
- It never calls a `…StateFor`, so a visit state not yet built is absent (see the share's misses).
- Imports gained, for `globals`: `NEAREST_TILE_INDEX`, `SOLID_GRID`, `PUSH_SPEAR_DIRECTION`, `GHOST_SPINNER_PRESS`,
  `GHOSTSWORD_MOTION`. All their modules were already in the closure.

**The comment, fixed.**
- The `spinnerForecast` memo's item 5 said *"`advance` is its only mutating member"*. It now names the five members
  that write run state outside `advance`.
- The claim the memo needs still holds, by the census: nothing those five write is read by the forecast's reach (only
  lazy first builds are).

**Determinism** (`d2/replay-scan.jsonl`, `tools/replay-scan.mjs`). Every committed tape (**280**) was replayed on two
fresh runs in lockstep, digested every tick:
- **169,012 ticks, 0 disagreements**;
- every tick's digest distinct within its tape;
- `fresh` = memo at every tape's end.

**Cost.**

| workload | digest median | escape median (strike callers) | ratio | digest total vs escape total |
|---|---|---|---|---|
| L18 sweep OFF (lab) | **0.174 ms** (p90 0.268) | 0.697 ms | **0.25** | 11.7 s vs 82.9 s |
| L18 sweep floor ON (lab) | **0.171 ms** (p90 0.251) | 0.861 ms | **0.20** | 17.6 s vs 130.7 s |
| 280 tapes, per tick | 0.19 ms (median of per-tape medians; worst tape 0.65 ms) | — | — | — |

The max single call is 9–23 ms (L18) and 101 ms (one tape): the first hash of a new world object.

**Census moves** (both expected, both green):
- `census-seedling-solver-surface --write`: run object 217 → 218 properties (method 24 → 25), and line numbers. Still
  312 rows. No solver file reads `stateDigest` yet, so no row exists to classify. When hammer's cache reads it, the row
  should be `seedling` / `live-state`.
- `census-seedling-constants --write`: 26 new literals, all `structural` (the `levelRun.js|*|*` row), and 790 moved
  lines. `--check` then reads 0 drift. Reference `--check`: ALL 7 + 5 MATCH.

## D3 — the gates (PASS)

### 1. No false equal — **0**

**The lab.** EX's `make-lab.py`, re-applied to a SCRATCH worktree at `728db6da`, never the tracked tree. Then
`tools/make-lab-digest.py` adds, to every `pressEscape` record:
- `dg` = `run.stateDigest()`, taken before the call;
- its parts and its own wall clock;
- every 200th call, `dgFresh`.

**The key** is (digest, the call's arguments by value, the globals). The globals are EX's: the whole `CONTACT_FIDELITY`,
`GHOST_SPINNER_PRESS`, the deadline's state and fineness, and whether a progress hook is installed. `tools/d3-gate.py`
counts the pairs that share a key but differ in their answer.

| workload | calls (strike) | runs | **false equal** (answer) | answer, asks or nodes differ | fresh ≠ memo |
|---|---|---|---|---|---|
| **L18 sweep, floor OFF** (default) | 56,655 (55,791) | 135 | **0** | 0 | 0 / 283 |
| **L18 sweep, floor ON** | 81,525 (80,595) | 135 | **0** | 0 | 0 / 407 |
| **clocked-hazard surface probe** (below) | 10,344 points | 32 | **0** | — | — |

The call counts equal EX's exactly. The lab is inert: the norm-md5 of the sweep's output is **`de6f6e4e` (OFF) /
`bae5c6de` (ON)** at the base, the head and the lab alike, which are EX's values (`d3/l18-inertia.txt`).

**The clocked-hazard workloads.** No committed workload calls `pressEscape` in a room with an axe, a beam tower or a
lava chain:
- the vanilla spinner rooms are L18 / 39 / 40 / 92, and none holds one;
- the generators put one class per chamber (`census-seedling-enemies`).

So the ANSWER there is the escape's whole run surface, probed every tick (`tools/surface-probe.mjs`):
- every key set previewed 8 ticks deep;
- `spinnerForecastWithPress` from three press ticks;
- `gameTimeAt(0 / 5 / 40)`;
- the weapon;
- the world's canonical text.

The tapes:

| tape | level | hazard |
|---|---|---|
| `axe-l48-reach-l49`, `stance-l48-chest` | L48 | spinning axe |
| `axe-l61-reach-l62`, `axe-l61-reach-l63` | L61 | spinning axe |
| `axe-l71-reach-l76` | L71 | spinning axe |
| `ladder2-l104-beam` | L104 | beam tower |
| `r3-collect-darksuit` | L79 | lava chain |
| `r9-solve-18` | L18 | spinner (for comparison) |

Each tape ran in four variants:
- its staging;
- a `PENDING_AT` row on an unused tag of its level;
- a far-future `at` row on that tag;
- `seam.time + 1`.

The `PENDING_AT` and far-future variants share history, the way the two-pass loop's passes do. The time shift does not
share history (it differs in the clock). Exception: L79's tape has no `seam`, so its time-shift variant is its base.

Result: **10,344 points; 5,225 cross-run pairs share a digest, 0 with different surfaces** (`d3/surface-probe.json`).

### 2. The share — **99.9 % of EX's CONTENT repeats**

| | DIGEST repeats | CONTENT repeats (EX's key) | digest ∩ content | their escape s | share of the lab wall |
|---|---|---|---|---|---|
| L18 OFF | 37,770 (66.7 %) | 37,815 (66.7 %) | **37,770 / 37,815 = 99.9 %** (99.5 % of their escape time) | 55.0 s of 82.9 s | **36.5 %** of 150.8 s |
| L18 ON | 54,350 (66.7 %) | 54,403 (66.7 %) | **54,350 / 54,403 = 99.9 %** (99.6 %) | 86.4 s of 130.7 s | **38.3 %** of 225.7 s |

- **Every digest repeat is also a content repeat.** The digest finds nothing EX's proxy did not.
- **The misses (45 OFF, 53 ON) are all at tick 0, and all in `visit`.**
  - The first escape call of a segment (`admission`) runs before the first `advance`, when the visit maps are not yet
    built.
  - That call's own `previewStepper` builds 17 of them, and its `spinnerForecastWithPress` builds `spinnerStates`.
  - So the next call in the same tick (`walk`) digests "built". That is a missed match, never a false one.
- The lab wall includes the lab's own hashing. EX measured 38.3 / 41.0 % of a lighter lab's wall; the share as a
  fraction of the escape time is the stable figure (99.5 / 99.6 %).

### 3. A mutant per field — **98 / 98 as predicted**, at four states

`tools/mutant-hook.py` puts an `eval` hook into `stateDigest` in a SCRATCH copy of `levelRun.js`. `tools/mutants.mjs`
then, for each field:
- perturbs that one closure binding around one `stateDigest()` call (copy + restore);
- in place for a Map, Set, array or object, by rebinding for a `let`, a parameter or a frozen value;
- checks that the digest flips in exactly the predicted component, and that it equals the base again after the restore.

The predictions were written first (`d3/mutant-predictions.json`):
- 77 digested fields flip their component;
- 8 excluded fields leave the digest equal;
- 11 not-in-the-reach controls leave it equal: `persistence`, `declaredClears`, `timedClears`, `despawn`,
  `scratchPersistence`, `scratchClears`, `pendingKillLockThrows`, `spinnerKillLockOpens`, `playerHits`,
  `staticBodyDeaths`, `PRESS_KILL_COST_COUNTS`.

| state | result |
|---|---|
| `r9-solve-18` @ t200 (L18, spinners) | 98 / 98 |
| `axe-l48-reach-l49` @ t200 (L48, axe) | 98 / 98 |
| `ladder2-l104-beam` @ t150 (L104, beam tower) | 98 / 98 |
| `r3-collect-darksuit` @ t40 (L79, lava chain) | 98 / 98 |

**The first run was not 98 / 98, said plainly.** It was 96 mutants, 12 of them not as predicted:
- 8 were mechanics: frozen arrays and const primitives cannot be perturbed in place. They are now rebound, or
  classified `IMMUTABLE` where a `const` primitive cannot differ inside a run (`clockDeclared`, `bootCutscene`,
  `bootSave`, all functions of a digested parameter).
- 3 were the same frozen-array mechanics on the controls.
- **1 was a finding: `world` edited IN PLACE does not flip the memoised digest.** That is the claim the memo rests on
  (worlds are replaced, never edited). Two rows now pin it:
  - `world (in place; memo)` reads equal;
  - `world (in place; fresh)` flips `place`.

  So `fresh: true` is the gate for that claim. It held on 690 sampled L18 calls and 280 tape ends.

### 4. The `PENDING_AT` rows (vitest)

`frontend/modules/seedlingDemo/levelRunStateDigest.test.js` has **8 rows**, about 4 s:
- two fresh runs agree on the digest at every tick, and no two ticks share one;
- a run digested every tick (some ticks `fresh`) walks the tape exactly as one that never is, and `fresh` equals the
  memo;
- **`PENDING_AT` vs `at = T`**: equal below T and first different at **T + 1 = 407**, in `['place', 'persist']`; the
  escape surface agrees where the digest does and differs where it differs;
- **the reader that CAN tell below T** is the kill-lock ledger's `declaredAt` (`[[406]]` vs `[[PENDING_AT]]`, from
  the removal at t306), while the digests stay equal;
- **no row**: the digest is equal below T, and `advance` at T throws `undeclaredKillLock {level 18, flags [0]}`;
- a module switch moves `globals` alone;
- `seam.time + 1` moves `staging` + `clock`;
- a tick moves `place`, `clock` and `player`, but never `staging` or `globals`.

### 5. Byte-inertia (the digest is never called by default)

| row | BEFORE (W0, `b73f3181`) | AFTER (`f247c8a2` tree) |
|---|---|---|
| identity block | as W0 | **byte-identical to W0** (`diff` empty; `after/identity-after.txt`), generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb` | **identical**, all exit 0 |
| tapeRunner pairs | 617 `8f27f975` | **617 `8f27f975`**, 0 non-pass |
| L18 sweep norm-md5 OFF / ON | `de6f6e4e` / `bae5c6de` (base) | **`de6f6e4e` / `bae5c6de`** (head) |
| surface / constants / entities / profile / roster | 312 · 6,002 · 566 · 138 · 280 | 312 · **6,028** (`--write`: 26 structural literals) · 566 · 138 · 280, all green |
| bounded vitest | 14 files, 684 / 684 | **15 files, 692 / 692** (the 14 plus `levelRunStateDigest`) |

## D4 — the hand-over to hammer (PASS)

**What an exact cross-pass `pressEscape` cache must key on:**
1. **`run.stateDigest()`**, taken at the call, before it.
2. **The call's arguments, by value:**
   - `state` (with its symbol keys), `at`, `keys` (the held sets, in order), `pressAt`, `id`, `deadline`;
   - and `caller` only if the cache stores anything caller-specific (the escape's answer does not read it).
3. **The solverBot-side globals, which levelRun cannot see:**
   - `HAMMER_ESCAPE_BOUNDS` (frozen today, but key on it if it can be swapped);
   - `GHOST_SPINNER_PRESS.enabled` (`strikePressOf`; also in `globals`, so harmless twice);
   - `PRESS_KILL_COST.enabled`. Its docblock says the bound skips only calls that would answer null, so the answer is
     unchanged. Keep it in the key anyway until that is a measured row;
   - the deadline: none / live / `hammer-escape` tripped, and `fine`;
   - whether a progress hook is installed (`activeProgress`: `onNode` / `progressSearch` side effects, which the
     cache's replay must re-emit — EX's residue 1).

   The solver-side switches levelRun never reads (`STRIKE_SCAN_COST`, `PRESS_KILL_BOMBS`, `REFUGE_ETA_CUT`,
   `GHOST_SEARCH_BUCKETS`, `GHOST_KILL_RUNG`) are not read by the escape's 49 functions either
   (`d1/escape-reach-solverbot.txt`). Leave them out of the key, or include them for safety.
4. **The `levelSource`.** It is a function, so it is not in the digest. Scope the cache to one `twoPassSolve` call
   (one `makeRun`, one source), as EX's design already does.

**What the digest deliberately does NOT cover, and why:**
- **The persistence channel** (`persistence`, `timedClears`, `declaredClears`, `despawn`, `scratchPersistence`).
  No escape reads it. That is exactly what lets passes 2 and 3 hit pass 1's entries below T.
- **The ledgers.** No escape reads them. They include the kill-lock rows, whose `declaredAt` DOES differ between
  passes from the removal on.
- **⚠ So the digest is an ESCAPE key, not a run-equivalence.** Two runs with one digest may diverge at the next
  `advance`: pass 1 throws at T where pass 2 does not. A cache for any other reader must re-run the census from that
  reader (`closure-census.mjs --from=<members>`).
- **What the escape cannot see.** The spinning axes' and lava chains' visit state (`spinningAxeStates`,
  `lavaChainStates`) are not in `liveSolidOpts` / `stepOptsFor`, so they are not in the escape's reach. The beam towers
  ARE in the reach (`beamTowerRectsNow`, digested under `visit`). If a later slice teaches the escape about axes or
  chains, it must add those maps (and their update counts) to `stateDigestParts`; the census tool will show them.
- **Lazy first builds.** A visit state not yet built reads differently from one built and unchanged. Cost: 45 / 53
  misses on L18, all at tick 0.

**The cost budget for the cache.**
- One digest per call is 0.17 ms against a 0.70 ms (OFF) / 0.86 ms (ON) median escape: 11.7 s / 17.6 s of digest
  against the 55.0 s / 86.4 s the repeats spend. Net, ≈ 43 s (OFF) / 69 s (ON) of the lab sweep.
- Taking the digest once per tick instead of once per call is NOT exact as it stands. `equipNow` and the lazy builds
  write inside a tick (the tick-0 misses are exactly that). A per-tick memo would need its own invalidation on those
  writers.

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-fidelity-digest-myfjmh`.
2. **"Do the kill-lock arms see a `PENDING_AT` row and an `at = T` row DIFFERENTLY before tick T?"**
   - Their decision does not: it reads existence.
   - Their ledger rows do (`declaredAt`), from the removal (t306), 100 ticks before T.
   - So the honest answer is "yes, but no escape reader reads where they do". The digest therefore keys the escape, not
     the run.
3. **The visit clocks as escape readers.** Of EX's list, only the beam towers (`beamTowerStates`), the game clock and
   the spinners are in the escape's reach. The axes' update count and the lava chains are not. The hammers' `gameTime`
   is the clock (`gameTimeAt`).
4. **"At least one other workload with clocked hazards" for the false-equal gate.** No committed workload calls the
   escape in such a room. That leg is the escape's surface, probed, not the escape itself.
5. **Line numbers.** EX's lines hold at this base except the memo comment, which sat at `:16044-16053` in the file
   before this slice's insertion (`:16216` after it). The other lines named are unchanged in content.
6. **The bootstrap still leaves six submodules uninitialised after `READY`** (EX's finding 6, again).

## Residue

1. **For hammer (the next slice): the cache.**
   - Key: D4.
   - Replay: EX's residue 1 (the ask points through `deadlineReached('hammer-escape')`, and the `onNode` list through
     `progressStatesFor`).
   - The reachable saving is 99.9 % of the CONTENT repeats.
   - When it lands, `census-seedling-solver-surface` will gain a `run.stateDigest` row (suggested `seedling` /
     `live-state`).
2. **`PRESS_KILL_COST`'s "a skipped call could only have returned null" is a docblock, not a row.** The cache key
   should carry the switch until one exists.
3. **CI.** I cannot dispatch it (403). The push run of `JavaScript Unit Tests` at `f247c8a2` (the last head carrying
   code; every later commit is docs/evidence only) read through `ci-vitest-summary.mjs f247c8a2 --wait`:
   - **suite: vitest (unfiltered): 20,942 passed, 0 skipped, 0 failed**;
   - **slow battery: 253 / 253**.

   The planner should read the report head the same way. No solver code moved, so no divergence sweep is needed, and
   no dispatch is owed.
4. **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No AS3, wasm, gitlink or
   rules edit. No `git stash`, nothing to `main`, no force-push. `solverBot.js`, `twoPassSolve.js`, the press-kill code
   and `jsRuntime*` / `flashPanel/*` were read, never edited (the lab's `solverBot.js` was a scratch worktree's).
5. **Tree hygiene.**
   - The scratch worktrees (`wt`, `mut`, `lab`) live under the scratchpad and are removed by name at the end.
   - The raw lab records (~17 MB + ~25 MB) are not committed; `evidence/tools/` reproduces them.
   - The dev server on :8000 (PID 886) was killed by PID.
