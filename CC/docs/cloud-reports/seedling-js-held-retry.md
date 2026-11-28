# seedling-js-held-retry — the JS page runs wasm's two solve policies: the held 4× retry, and the fresh solve after a refused continuation

BUILD + LANDING PACKET. Cloud slice, launched by `seedling-js-planning-24` (js-24); `seedling-hammer-phase-planning-17` copied.
⚖ Robert 2026-11-27 17:47:30Z *"Fix the retry only (Recommended)"* → 17:48:11Z *"Include the fallback (Recommended)"*.
Not licensed and not touched: the game-clock carry across JS room boots (`jsRuntimeCore.js:688/695`) and the L57 exit check
(`jsRuntimeCore.js:1755-1761` at base).

## Summary for Robert

**The JS page now does what the wasm page does when a solve runs out of effort.** If the solver runs out of its work limit
and has no plan, the JS page asks once more with 4× the limit, the room held, as wasm does. If that runs out too, the bot
stops and names both budgets. If the bot is solving on from a room where it just played a plan, and the solver refuses,
the page re-enters the room and solves fresh from its arrival, as wasm does. It does this at most once per goal, and it
names each time in the log.

**How far the JS walk gets now:** seed 1, the shipped limits on: **23/48 on every JS run** (5 runs over three trees, the last at the final merge tip). It was 8/48.
L22→L25, the old wall, now plays wasm's exact plan: the retry at 2560 finds the 113-tick plan `78614fcbef7f`, with 0 hits.
L40's first item is cut at 640 and solves on the retry (1022 ticks, 0 hits). L40's second item solves directly on the JS
side (785 ticks), so it never needed the fallback there. On wasm that same item is the one that needs it. The JS walk
now stops at **L57**: *"level 57 has no teleporter or pit on tile (6, 4)"*, the JS-only exit check you kept out of scope.
That is the same stop as the diagnosis's no-limit run (J0). The fallback did fire on JS, at **L20 and L38** on every run. Both times
the fresh solve played (324 ticks and 4 ticks). On 2 of 5 runs it also fired at L32, where an item arrived during the solve; the fresh solve then played too. Before, the bot walked those legs for 90 ticks and then asked the solver again. The
solver's answers did not change: 20 captured requests replay to the same answer at base and at the tip.

## Base, tip, branches

| item | value |
|---|---|
| base | Built on `origin/main` @ **`102dcbeb16`** (train 227). Main moved twice while I measured: <br>• to **`960ff0a8`** (train 228, `hammer-flip-lhm`, incl. `solverBot.js`), merged clean as **`290fc161`**; <br>• to **`07787a89`** (trains `an-time4`, `region-map-painter-throws`, `mystery-play`, `rules-engine-nit-b`), merged as **`089c0ee0`**. The only conflicts were the generated docs index; I took main's and regenerated. |
| what was measured where | **At the final merge tip `089c0ee0`** (base `07787a89`): the closure and engineMd5, the bounded vitest, the 20 replays (base vs tip), both local in-app batches, and one JS walk (FJ1). **At the first merge tip `290fc161`** (base `960ff0a8`): the full walk set (MJ1, MJ2, MW1), the same invariants, replays and in-app batches. Between the two, main's four trains touch none of this slice's files, and nothing in `jsRuntime*`, `wasmPlayback.js`, `seedlingWasmPlayback.js` or `solverBot.js`. They do move two engine-closure files (`deriveLevelWorldLogic.js`, `learnLattice.js`), the playthrough derived-rule table and the mystery submodule. FJ1 is the check that the JS walk did not move with them |
| landing branch | `claude/seedling-js-held-retry-1ec1ey` (the harness's branch; the brief's `seedling-js-held-retry` is this one). Commits: `6270c9f5` (the build), `290fc161` and `089c0ee0` (the two merges), then this report (the landing tip, the final commit) |
| measuring branch (final tip) | local `measure3/seedling-js-held-retry` = `089c0ee0` + the capture probe → `02678ce7`, `0e9482b2`. Head `0e9482b2`. FJ1 only. Not pushed |
| measuring branch (first merge tip) | local `measure2/seedling-js-held-retry` = `290fc161` + the diagnosis's capture probe `d1d9da5e` → `703e7e6e`, `a3b1633f` → `baf43ebd`. Head `baf43ebd`. **Not pushed, not on the landing branch.** The no-limit probe `3028cb27` was **not** taken (these walks run at the shipped limits) |
| measuring branch (pre-merge) | local `measure/seedling-js-held-retry` = `6270c9f5` + the same probe (`562179a1`, `b2084da9`). Head `b2084da9`. Supplementary only |
| wasm builds | `frontend/modules/flashPanel/wasm` @ `9968c7dda4c08397e93b0900d73a9e8126cda8b6` (gitlink = checkout, unchanged) |
| box | `scripts/cloud/session_bootstrap.sh --all` → READY (chromium OK); dev server `scripts/serve-nocache.py 8000`; 4 CPUs; no `SEEDLING_*` in the environment. WebGPU: the wasm walks configured a WebGPU canvas (`MW1.measure.log`). `frontend/modules/flashPanel/wasm` checked out at its gitlink. No container restart |

## The two policies, quoted (file:line at base `102dcbeb16`; both wasm files are byte-identical at base, `960ff0a8` and the tip)

### 1. The held retry

**wasm (the spec, read-only)** — `frontend/modules/seedlingDemo/wasmPlayback.js`:
```js
:1047  export const SOLVE_RETRY_BUDGET_FACTOR = 4;
:1049  export const MAX_SOLVE_RETRIES = 1;
:1064  export function expiryAction({ provisional = null, retries = 0, unanswered = true }) {
           if (provisional?.ok) return 'provisional';
           return unanswered && retries < MAX_SOLVE_RETRIES ? 'retry' : 'give-up';
       }
:1079  export function expiryFailure({ goal, budgets = [], refusal = null }) { … `the solver ran out of ${spent} work units${… ' on its held retry'} on ${goal?.kind} in level ${goal?.level}` … }
```
`frontend/modules/flashPanel/seedlingWasmPlayback.js`:
```js
:1544  if (!play.request.producer && budgetCut(res)) {
           stats.expiries += 1;
           const cut = { provisional: res, answered: handle.answered ?? 0, passes: handle.passes ?? [] };
           const unanswered = (handle.answered ?? 0) < (play.request.passes?.length ?? 0);
           const action = expiryAction({ provisional: res, retries: play.retries, unanswered });
           if (action === 'retry' && retrySolve(cut)) return;
           … else { const refusal = betterAnswer(play.best, res) ? res : play.best;
                    const why = expiryFailure({ goal, budgets: play.budgets, refusal });
:1558               if (play.continuation) { contFallback(why, 'continuation-budget'); return; }
                    fail(why); return; }
:1564  if (play.best && !betterAnswer(play.best, res)) res = play.best;
:1419  function retrySolve(cut) {   // budgetLimited guard; stats.retries; play.best kept
:1425      const budget = play.budget * SOLVE_RETRY_BUDGET_FACTOR;
:1429      … { ...play.request, passes: passesAfter(play.request.passes, cut.answered), budgetWork: budget };
:1439      handle = svc().start(req, { attempt: { retry: play.retries, budgets: [...play.budgets] } });
```

**JS at base** — `frontend/modules/seedlingDemo/jsRuntimeSolver.js` `createRuntimeSolver`:
```js
:1441  // ⛓ RETRY ATTEMPT — this solver never re-asks a start at a larger budget: each start is attempt 0
:1506  const expired = budgetCut(r);            // stats only
:1515  if (!r.ok) {
:1516      if (r.kind === 'divergence') return { failed: r.message };
:1517      return decline(String(r.message), r.obstacle ?? null);   // a cut refusal became a decline
```

**JS at the tip** (`jsRuntimeSolver.js`, line numbers at `290fc161`): `:86` imports `expiryAction, expiryFailure,
SOLVE_RETRY_BUDGET_FACTOR` from `wasmPlayback.js` (no constant copied). `take()` `:1612-1622`: on `budgetCut(r)`,
`unanswered = (p.handle.answered ?? 0) < (p.request.passes ?? ANYTIME_PASSES).length`, then the same `expiryAction`. `'retry'`
→ `retryHeld` (`:1511-1527`): `budgetLimited` guard, the SAME stored request with `passes: passesAfter(…, answered)` and
`budgetWork: budget × SOLVE_RETRY_BUDGET_FACTOR`, `attempt: {retry: 1, budgets: [640, 2560]}`, `best` kept by
`betterAnswer`, the room held (the session is not stepped while `solving`). `'give-up'` → `{ failed: expiryFailure({goal,
budgets, refusal}) }`, or the W7 fallback on a continuation (`'continuation-budget'`). `:1624` the same
`if (p.best && !betterAnswer(p.best, res)) res = p.best`. **The first ask is byte-identical to base** (no `passes` field,
`attempt: {retry: 0, budgets: [640]}`; pinned in the test, and the replay table below).

### 2. Continuation → fresh solve (W7)

**wasm** — `seedlingWasmPlayback.js`:
```js
:1452  function fallback(why, kind) {
           stats.fallbacks.push({ goal: goal?.name ?? goal?.kind, kind, why });
           history.push({ goal, outcome: 'fallback', kind, reason: why, shipped: r?.shipped.length ?? null });
           log(`[wasm playback] ${goal?.name ?? goal?.kind}: ${why} — falling back to a forced re-arrival`, 'warn');
           … reArrive(`re-entering level ${g.level} (${FALLBACK_POLICY}: ${why})`, kind);
:1472  function contFallback(why, kind) { if (frozen && resumeFrozen(why)) return; fallback(why, kind); }
:1568  if (play.continuation) { contFallback(why, 'continuation-declined'); return; }   // any !res.ok
```
`reArrive` (`:931-947`) teleports to the room's recorded spawn; the fresh solve is `continuation: false`, so its refusal fails.

**JS at base:** no fallback. A refused second-goal solve was a decline (the walker walked or failed it, by obstacle).

**JS at the tip:** a **continuation** is the goal's first ask, on the same run and in the same level where an earlier
goal's plan was played (`jsRuntimeSolver.js:1482`, `lastPlayed` set at `:1780`). This is wasm's "solving on from the
held room". One that cannot be served (`!res.ok`, any kind, as at wasm `:1568`; or `give-up` after its retry, as at
`:1558`) calls `fallback(p, why, kind)` (`:1535-1544`). The fallback is bounded to one per goal. It asks the page to
`reArrive`, counts `stats.fallbacks.push({goal, level, kind, why})`, emits a `fallback` event (*… — falling back to a
forced re-arrival*, wasm's words), and holds the room until the page has replaced the session (`:1737`). `jsRuntimeCore.js`
`:534` queues it, and `:937-941` lands it at the next tick's boundary: `boot(arrival, "re-entering level N (forced
re-arrival: …)")`. Any boot clears it (`:732`). The next ask is fresh: a new run, so not a continuation, so its refusal
takes the existing decline path.

**Where the JS frame differs (named):**
- The re-arrival is the page's own `boot(arrival)`, with no host teleport and no glue round trip.
- There is no `botStatus`. The "held room" is the session not stepping while the solver says `solving`.
- There is no `frozen`/`resumeFrozen` arm (the JS page has no delivery freeze).
- The re-boot stages the page clock (`PAGE_BOOT_TIME` 4800), as every JS boot does today (the clock carry is not licensed).
- A refusal that is **not** a cut stays a **decline** on a fresh solve, where wasm fails it. That is the JS walker's
  existing decline policy (walk instead, obstacle arms, decline-retry), unchanged.
- The JS fallback is bounded to **one per goal** (wasm's bound is structural: its fresh solve is not a continuation).
  On JS the bound holds three ways: the per-goal count, "the goal's first ask", and "the run the plan was played on"
  (the re-boot is a new run).

**Exports:** none were needed. `expiryAction`, `expiryFailure`, `SOLVE_RETRY_BUDGET_FACTOR` and `MAX_SOLVE_RETRIES`
were already exported. `wasmPlayback.js` and `seedlingWasmPlayback.js` are **unchanged** (`git diff 102dcbeb 290fc161 --
<both>` is empty). The import makes an ESM cycle (`wasmPlayback → wasmArrival → jsRuntimeSolver`). Every imported name is
read inside `createRuntimeSolver`'s closures only, never at module top level. Verified: `jsRuntimeSolver`, `jsRuntimeCore`,
`jsRuntimeSolveWorker` (shimmed `self`), `wasmPlayback`, `wasmArrival`, `jsRuntimeWalker` and `seedlingWasmPlayback`
each import first-in-process without error.

## Diff stat (landing tip vs `origin/main` 07787a89; the same 8 files vs 960ff0a8) — 0 gitlinks

```
 docs/json/developer/procgen/README.md              |   6 +-     (GENERATED region, regenerated)
 docs/json/developer/procgen/flash.md               |   5 +-
 .../developer/procgen/seedling-solve-progress.md   |   2 +-
 .../modules/procgenDocs/generated/docsIndex.js     |  10 +-     (generated, regenerated)
 frontend/modules/seedlingDemo/jsRuntimeCore.js     |  18 ++
 .../seedlingDemo/jsRuntimeHeldRetry.test.js        | 228 +++++++ (new)
 .../seedlingDemo/jsRuntimeSolveService.test.js     |  31 +--     (one row re-recorded)
 frontend/modules/seedlingDemo/jsRuntimeSolver.js   | 168 +++++++++++++--
 8 files changed, 426 insertions(+), 42 deletions(-)
```
Plus this report and its evidence directory. **0 gitlinks** (`git diff --raw origin/main HEAD | grep -c " 160000"` = 0).

## Tests (vitest, bounded) and their mutant reds

New: `frontend/modules/seedlingDemo/jsRuntimeHeldRetry.test.js`, 9 rows, driving the real core with a scripted stub service.
The policies choose the requests, so a script is the whole input:

| row | pins |
|---|---|
| (a) the policy is the wasm page's | `SOLVE_RETRY_BUDGET_FACTOR` 4, `MAX_SOLVE_RETRIES` 1, budget 640 |
| (a) cut + refusal + pass left | ONE re-ask: budget 2560, `passes: [full]`, `attempt {retry:1, budgets:[640,2560]}`, the request otherwise byte-identical (the room held, same session); the first ask has no `passes` (as at base); its plan plays |
| (a) a second cut | FAILED by `expiryFailure` (*the solver ran out of 640, then 2560 work units on its held retry on exit in level 86: …*), no third ask |
| (a) no cut | no re-ask; the existing decline (*walking instead*) |
| (a) provisional / no limit | a cut with a plan plays it, no re-ask; budget 0 never re-asks |
| (b) refused continuation | ONE re-arrival (boot at the arrival (48,48), a new session), a fresh solve (prefix 0); `fallbacks: [{kind:'continuation-declined', …}]`; the `fallback` event |
| (b) continuation cut twice | `[prefix 1, 640] → [prefix 21, 640] → [21, 2560] → [0, 640]`; `kind: 'continuation-budget'`, `why` = `expiryFailure` |
| (b) refused fresh solve | the existing decline; one boot, one fallback, never a second |
| (b) not a continuation | a goal's first solve in a room no plan played in: the existing decline, no boot |

**Mutants** (`evidence/mutants.txt`; each run with only that change):
- **base** (`102dcbeb`'s `jsRuntimeSolver.js` + `jsRuntimeCore.js`) → **8 of 9 red** (all but the constants row). The same
  at the new base `960ff0a8` (the two files are equal there; also at `07787a89`): 9 red over the two files (the 8, plus
  the re-recorded row below).
- r2, the factor 2 → 3 red (the retry row, the second-cut row, the continuation-cut row).
- r3, every pass re-sent → 1 red (the retry row).
- f2, the fallback unbounded with all three guards off → 2 red (the two (b) re-arrival rows). Any one guard alone holds
  the bound; measured with only the count off, all 9 stay green.
- f3, every first solve a continuation → 8 red.

**Re-recorded (one existing row; the reason: the policy):** `jsRuntimeSolveService.test.js` *"a solve that runs out of its
WORK budget DECLINES BY NAME … and the walker takes the goal"*. At a 1-unit budget, the cut refusal was a decline and the
bot walked. Now it is retried at 4 units, cut again, and FAILS by `expiryFailure` (*the solver ran out of 1, then 4 work
units on its held retry on exit in level 4: … ⏱ DEADLINE … `walk` site*). It is renamed *"… runs out of its WORK budget
twice (the held retry at 4×) FAILS BY NAME …"*. It reds on base (the old decline). No other unit row moved.

**Bounded vitest** (⚖ 52, `--maxWorkers=3`), every default-tier test file that imports `jsRuntimeSolver.js`,
`jsRuntimeCore.js` or `wasmPlayback.js` (`grep -a -l`; list in `evidence/vitest-bounded.files.txt`):
- at the **final tip `089c0ee0`: 129 files, 2528 / 2528 passed**; at the first merge tip `290fc161`: 129 files, 2528 / 2528 (466 s);
- pre-merge, at `6270c9f5` before the re-record: 123 files, 2389 / 2390. The one red was the row above before its re-record. After the
  re-record, that file plus the new one gave 31 / 31.

## Walk measure (seed 1, the SHIPPED limits, no `SEEDLING_*`, fresh page per walk, `walk-seedling-whole-game.mjs`)

All walks ran on a measuring branch (the landing code + the capture probe, which only records). The JS rows quote the
**JS frame's own requests** (`js-runtime-L…`); the wasm rows quote the wasm engine's (`wasm-…`). "hits" = the plan's
`modelHits` (pass rows). Answers are `sha1[0:12]` of the plan / refusal (the probe's and the replayer's hash).

**At the first merge tip** (`measure2` head `baf43ebd` = `290fc161` + probe):

**At the final tip** (`measure3` head `0e9482b2` = `089c0ee0` + probe), one JS walk:

| arm | runtime | checked | stop / cause | L22→L25 | L40 item 1 | L40 item 2 | retries / fallbacks |
|---|---|---|---|---|---|---|---|
| **FJ1** | JS | **23/48** | entry 24 "Level 089 - Feather" in `level_57`, the same L57 refusal (1279 s) | #61 cut `124fe8a24dc3` → #62 retry **`78614fcbef7f`, 113 t, 0 hits** | #123 cut `5d51…` → #124 retry **`a0d702e11a78`, 1022 t, 0 hits** | #125 continuation SOLVED `59f9ba4d8666`, 785 t, 0 hits | 4 retries (L22, L40, L48, L53) / 3 fallbacks (L20, **L32**, L38) |

FJ1 is MJ1/MJ2 again: the same depth, stop, answers and ticks. Its extra L32 fallback is J2's `hasFire` delivery race
again (below), now seen on 2 of 5 JS runs.



| arm | runtime | checked | stop | cause | walk |
|---|---|---|---|---|---|
| **MJ1** | JS | **23/48** | entry 24 "Level 089 - Feather" in `level_57` | refusal *"level_57: the bot cannot walk to exit "level_57 -> level_58__r4c1" — the JS runtime refused {…"tiles":[[6,4]]…}: level 57 has no teleporter or pit on tile (6, 4)"* — **the L57 exit check, out of scope** | 1289 s |
| **MJ2** | JS | **23/48** | the same entry, the same text | the same | 1271 s |
| **MW1** | wasm (control) | **28/48** | entry 29 "Level 041 - Totem Part 240,144" in `level_39__r0c9` | `budget: the step's wait ran out` (2400 s, by design) — **deeper than the diagnosis's W2 (23/48 at 1500 s)** | 2400 s |

| leg | request | MJ1 | MJ2 | MW1 (wasm) | the diagnosis |
|---|---|---|---|---|---|
| **L22→L25** | a0, 640 | #64 REFUSED `124fe8a24dc3`: dashless refusal (work 178), full **cut** (`budget`, 465) | #63 same | #45 REFUSED `d777bfb2c075`, the same passes | J1/J2 the same `124f…`, then **no retry**; W1/W2 `d777…` |
| | **held retry**, 2560, `passes: [full]` | **#65 SOLVED `78614fcbef7f`, 113 t, 0 hits** (work 817) | #64 the same | #46 SOLVED `78614fcbef7f`, 113 t, 0 hits | W1/W2 retry `78614fcbef7f`; J0 (no limit) `78614fcbef7f` |
| | fallback | — | — | — | — |
| **L40 item 1** (880,816) | a0, 640 | #123 REFUSED `5d514a643e92`: both passes **cut** (`budget`) | #124 same | #90 REFUSED `668f4ca7aff6`, both cut | W2 #93 `668f…`; J0 #126 @640 `5d51…` |
| | **held retry**, 2560, `passes: [dashless, full]` (the dashless pass was cut, so it runs again) | **#124 SOLVED `a0d702e11a78`, 1022 t, 0 hits** | #125 the same | #91 SOLVED `8e2c3dcc23fd`, 1106 t, 0 hits | W2 #94 `8e2c…` 1106 t; J0 (no limit) `a0d7…` 1022 t |
| **L40 item 2** (160,640), the spinner | continuation, 640 | **#125 SOLVED `59f9ba4d8666`, 785 t, 0 hits** (prefix 1018, work 150) | #126 the same | #92 continuation (prefix 1106) REFUSED `72fb6ec7ac18` by name (*the combat ladder is EXHAUSTED … spinner:spinner@816,848*) | W2 #95 `72fb…` |
| | **fallback** → forced re-arrival + fresh solve | **not needed** (the continuation solved) | not needed | **#93 fresh solve SOLVED `acb3a63487eb`, 494 t, 0 hits** | W2 #96 `acb3…` 494 t |

- **The brief's expectations:** L22→L25 plays `78614fcbef7f` (113 t, 0 hits): **yes**, on both JS runs. L40 item 1
  solves on the retry: **yes**. L40 item 2 "passes via the fresh solve": **on wasm, yes. On JS it passes without one**,
  because its continuation solves at 640 (as in J0). The JS request for item 2 is not wasm's: JS reaches it from its own
  item-1 plan (1022 t vs wasm's 1106 t), and the item-1 plans differ by the game clock (`seam.time` 4800 on JS vs 33953 on MW1 there;
  the clock carry is not licensed). The policy is in place for it: a refusal there would re-arrive and solve fresh.
- **Where the JS fallback DID fire** (both JS runs, the same legs and outcomes):

  | leg | the refused continuation | then | base (the diagnosis's J0) |
  |---|---|---|---|
  | `level_20__r3c1 -> level_13` | *no corridor … Obstacle: proximity-hazard:shieldlocknorm (shieldlocknorm@176,16)* | boot L20 at (192,64), **fresh solve SOLVED, 324 t** (hold, walk) → crossed to L13 | declined → walked 90 t → decline-retry solved → done |
  | `level_38 -> level_37__r0c18` | *hold: every responder in group t=2 [cover@208,224] is ALREADY OPEN before the hold begins …* | boot L38 at (144,288), **fresh solve SOLVED, 4 t** → crossed to L37 | declined → walked 90 t → decline-retry → done |

  `solverStats.fallbacks`-style counts per JS run: **4 held retries** (L22, L40 item 1, L48 `level_48__r2c10 -> level_49`,
  L53 `level_53__r14c9 -> level_54__r1c8`) and **2 fallbacks** (L20, L38). All four retries solved (113 t, 1022 t, 430 t, 768 t, on both runs), and no second cut
  failed anywhere.
- **The wasm control is unchanged:** MW1's L22 and L40 chains are the diagnosis's W2 **byte for byte**: the same requests'
  answers `d777… → 78614… / 668f… → 8e2c… / 72fb… → acb3…`, with the same ticks and the same work. The wasm log counts
  (5 fallback, 11 retry log lines) equal the pre-merge W1's.

**Pre-merge, supplementary** (`measure` head `b2084da9` = `6270c9f5` + probe; base `102dcbeb`):

| arm | runtime | checked | stop / cause | L22→L25 | L40 item 1 | L40 item 2 | fallbacks |
|---|---|---|---|---|---|---|---|
| J1 | JS | 23/48 | L57, the same refusal (1276 s) | #65 cut `124f…` → #66 retry **`78614fcbef7f`** 113 t | #125 cut → #126 retry `a0d7…` 1022 t | #127 continuation SOLVED `59f9…` 785 t | L20, L38 |
| J2 | JS | 23/48 | L57, the same (1271 s) | #66 → #67, the same | #126 → #127, the same | #128, the same | L20, **L32**, L38 |
| W1 | wasm | 28/48 | budget (2400 s) | #45 `d777…` → #46 `78614…` | #94 `668f…` → #95 **`1c1e32cb58a8`** 1267 t | #96 continuation REFUSED `6343…` → #97 fresh `acb3…` 494 t | — |

- **J2's (and FJ1's) L32 fallback is a delivery race, not the policy misfiring.** The host wrote `hasFire` into the live run while
  `level_32 -> level_30__r2c10`'s solve was in flight, so the solve's request lacked FIRE. The solver refused (*burnabletree@64,0
  cannot be burned by this run — this run does not hold FIRE*). The re-arrival boot staged the flag, and the fresh solve played
  (207 t, burn + walk). In J1, MJ1 and MJ2 the flag landed before the ask, and the leg solved directly (190 t, 190 t, 196 t: the ask's prefix depends on when the delivery landed).
- **W1's L40 item-1 plan (1267 t) differs from W2's (1106 t) only by its input.** The two requests differ in exactly one
  leaf, `staging.seam.time` 33953 → 34013 (wasm's running game clock, which moves run to run). Both replay to their own
  page answers at base and tip (rows 4 and 19 of the replay table). MW1 then drew W2's clock and plan exactly.

## Invariants

- **Closure-nil.** `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`: 42 files + root, the same
  list everywhere (`evidence/engine-closure-*.txt`):

  | tree | engineMd5 |
  |---|---|
  | base `102dcbeb` / build `6270c9f5` | `74ae60f575531492ed9eaec1839e1fe3` (equal) |
  | base `960ff0a8` / first merge tip `290fc161` | `74ae60f575531492ed9eaec1839e1fe3` (equal) |
  | **base `07787a89` / final tip `089c0ee0`** | **`6c8cd75145bdf58d2eed7d7cc9e6b512` (equal)**. Main's `rules-engine-nit-b` moved it, not this slice |

  The diff (tip vs base, 8 files) ∩ the closure = **∅** at every pair. No closure, engine, solverBot, levelRun,
  contactFidelity, generator or tileStep file is touched.
- **No solver answer changed** (`replay-seedling-solve-request.mjs --n=1 --live`, the 20 requests in
  `evidence/replay.requests.jsonl.gz`; run at base with base's `jsRuntimeSolver.js` / `jsRuntimeCore.js` swapped in, and at
  the tip). The base is `960ff0a8` (its two files equal `102dcbeb`'s), the tip `290fc161`:

| # | request (arm#seq name attempt) | budget | prefix | page answer | replay @ base 960ff0a8 | replay @ tip 290fc161 | plan ticks |
|---|---|---|---|---|---|---|---|
| 1 | diagW2#45 wasm-exit-22 retry0 | 640 | 0 | `d777bfb2c075` | `d777bfb2c075` | `d777bfb2c075` | refused |
| 2 | diagW2#46 wasm-exit-22 retry1 | 2560 | 0 | `78614fcbef7f` | `78614fcbef7f` | `78614fcbef7f` | 113 |
| 3 | diagW2#93 wasm-location-40 retry0 | 640 | 0 | `668f4ca7aff6` | `668f4ca7aff6` | `668f4ca7aff6` | refused |
| 4 | diagW2#94 wasm-location-40 retry1 | 2560 | 0 | `8e2c3dcc23fd` | `8e2c3dcc23fd` | `8e2c3dcc23fd` | 1106 |
| 5 | diagW2#95 wasm-continue-location-40 retry0 | 640 | 1106 | `72fb6ec7ac18` | `72fb6ec7ac18` | `72fb6ec7ac18` | refused |
| 6 | diagW2#96 wasm-location-40 retry0 | 640 | 0 | `acb3a63487eb` | `acb3a63487eb` | `acb3a63487eb` | 494 |
| 7 | diagJ1#70 js-runtime-L22-exit retry0 | 640 | 0 | `124fe8a24dc3` | `124fe8a24dc3` | `124fe8a24dc3` | refused |
| 8 | tipMJ1#64 js-runtime-L22-exit retry0 | 640 | 0 | `124fe8a24dc3` | `124fe8a24dc3` | `124fe8a24dc3` | refused |
| 9 | tipMJ1#65 js-runtime-L22-exit retry1 | 2560 | 0 | `78614fcbef7f` | `78614fcbef7f` | `78614fcbef7f` | 113 |
| 10 | tipMJ1#123 js-runtime-L40-location retry0 | 640 | 0 | `5d514a643e92` | `5d514a643e92` | `5d514a643e92` | refused |
| 11 | tipMJ1#124 js-runtime-L40-location retry1 | 2560 | 0 | `a0d702e11a78` | `a0d702e11a78` | `a0d702e11a78` | 1022 |
| 12 | tipMJ1#125 js-runtime-L40-location retry0 | 640 | 1018 | `59f9ba4d8666` | `59f9ba4d8666` | `59f9ba4d8666` | 785 |
| 13 | tipMW1#45 wasm-exit-22 retry0 | 640 | 0 | `d777bfb2c075` | `d777bfb2c075` | `d777bfb2c075` | refused |
| 14 | tipMW1#46 wasm-exit-22 retry1 | 2560 | 0 | `78614fcbef7f` | `78614fcbef7f` | `78614fcbef7f` | 113 |
| 15 | tipMW1#90 wasm-location-40 retry0 | 640 | 0 | `668f4ca7aff6` | `668f4ca7aff6` | `668f4ca7aff6` | refused |
| 16 | tipMW1#91 wasm-location-40 retry1 | 2560 | 0 | `8e2c3dcc23fd` | `8e2c3dcc23fd` | `8e2c3dcc23fd` | 1106 |
| 17 | tipMW1#92 wasm-continue-location-40 retry0 | 640 | 1106 | `72fb6ec7ac18` | `72fb6ec7ac18` | `72fb6ec7ac18` | refused |
| 18 | tipMW1#93 wasm-location-40 retry0 | 640 | 0 | `acb3a63487eb` | `acb3a63487eb` | `acb3a63487eb` | 494 |
| 19 | preW1#95 wasm-location-40 retry1 | 2560 | 0 | `1c1e32cb58a8` | `1c1e32cb58a8` | `1c1e32cb58a8` | 1267 |
| 20 | preW1#96 wasm-continue-location-40 retry0 | 640 | 1267 | `634346939b1e` | `634346939b1e` | `634346939b1e` | refused |

**page = base = tip on all 20: True.** Every request: `1 distinct answer(s) over 1, 1 distinct trace(s)`.

  **At the final tip** the same 20 requests: base `07787a89` vs tip `089c0ee0`: page = base = tip on **20 / 20**
  (`evidence/final/`). Pre-merge (base `102dcbeb` vs `6270c9f5`, 16 requests incl. J1/W1's): 16 / 16 (`evidence/premerge-replay/`).
- **Derived-rule table / acceptance:** no file of either touched, nothing regenerated (the diff is the 8 files above).
- **wasm path unchanged:** both wasm files byte-identical, and the wasm control walk (above) plays the diagnosis's
  W2 L22 and L40 answers byte for byte.

## In-app rows

Local runs (results `treeMoved: false`, unbundled):

| batch | at the final tip `089c0ee0` | at the first merge tip `290fc161` |
|---|---|---|
| `npm test -- --mode=test-substrates --batch=seedling-js` | **45 / 45 PASSED** (rc 0) | 45 / 45 PASSED |
| `npm test -- --mode=test-substrates --batch=seedling-js-solver` | **12 / 12 PASSED** (rc 0) | 12 / 12 PASSED |

**In-app pins moved: none.** No JS-runtime in-app row changed in these two batches. The whole-game walk row
(`tutorials-seedling-whole-game`) grades against `firstFailingStep: 'bot-plays'`, so it reads PASSED whatever the depth;
its *measure* moved 8/48 → 23/48 (above). `tutorials-seedling` and `tutorials-seedling-whole-game` are js-24's dispatches.
**Unit pins moved: one**, `jsRuntimeSolveService.test.js`'s 1-unit-budget row (old: a decline, walked; new: retried at
4, FAILED by name; the reason is the policy itself). See *Tests*.

## Docs

- `docs/json/developer/procgen/flash.md`: a new bullet, *The held retry and the fresh solve*, plus one sentence corrected
  (the fine-unit paragraph said a cut is "on the JS page … a named decline").
- `docs/json/developer/procgen/seedling-solve-progress.md`: the retry-label row (the JS solver now tells its retry).
- `node scripts/procgen/check-procgen-docs.mjs` → ALL CHECKS PASSED. `generate-procgen-reference.mjs --check` → match.
  **Generated pins moved (regenerated, by my doc edits):** `frontend/modules/procgenDocs/generated/docsIndex.js` (word /
  line counts) and `docs/json/developer/procgen/README.md` § `GENERATED:procgen-docs-index` (578,520 → 578,776 words;
  flash.md 35862 → 36107; seedling-solve-progress.md 13621 → 13632). After the merge the check still matches.
- `seedling-bot-log.md` and `architecture.md` are untouched. No tracked file cites a path under the local-only new-docs folder.

## CI for js-24 to dispatch at the landing tip

- [ ] JSUT (`unittests_frontend.yml` push, or dispatch): the suite at the tip
- [ ] ut (`unittests.yml`)
- [ ] TT dispatch, all batches. **fast headroom** vs the median of 3 main samples; STOP at > +20 s or > 70 %
- [ ] `test-substrates-manual` `batch=tutorials-seedling`
- [ ] `test-substrates-manual` `batch=tutorials-seedling-whole-game`
- [ ] both route surveys (END + 4.2): **0 movers per step** (ticks and hits). Expected 0: the survey's solves are requests
      to `solveAnytime`, and the slice sends no new kind of request to them
- No `train_only`: no solver, hammer, fidelity, generator or tileStep file is touched.
- ⚠ A JS-runtime in-app row could move only if its walk meets a budget cut (it now retries, or fails by name after a
  second cut) or a refused continuation (it now re-boots and solves fresh). The local batches are listed above. Any
  other mover is a STOP.

## Follow-ups (asks, not built)

1. **L57, the JS walk's next wall** (`jsRuntimeCore.js`'s exit check, `:1755-1761` at base, `:1773-1779` at the tip):
   `level 57 has no teleporter or pit on tile (6, 4)`. JS stops there on all 4 JS walks; wasm walks past it (MW1, W1: 28/48).
   This is now the JS walk's next wall, an ask for its own ruling.
2. **The game clock** (`jsRuntimeCore.js:688/695`): carry the run's `Main.time` across JS room boots, so JS plans match
   wasm's. Measured in the diagnosis: at L40 the clock picks which plan is found. **Nothing here depends on it:** L22 plays
   wasm's exact plan on both clocks. L40 item 2 is a continuation that JS serves and wasm refuses, because the item-1
   plans differ by clock. With the clock carried, JS would meet wasm's refusal there, and the new fallback is what would
   pass it.
3. (Observation, not a defect of this slice.) J2 and FJ1 (2 of 5 JS runs) met a host-delivery race at L32: `hasFire` was written into the live run
   while the exit's solve was in flight, so the solve's request lacked FIRE and refused the burn. The fallback's
   re-boot staged the flag, and the fresh solve played. On base this was a decline, walked. The race itself (a solve
   asked before a delivery lands) is pre-existing.

## Evidence (`CC/docs/cloud-reports/seedling-js-held-retry-evidence/`)

- `FJ1.*` (final tip), `MJ1/MJ2/MW1.*` (first merge tip) and `J1/J2/W1.*` (pre-merge): `.summary.txt` (the walk line), `.solves.txt` (every probe row,
  one line each: attempt, budget, passes, prefix, answer, ticks, per-pass work/limit/hits), `.requests.jsonl.gz` (the
  L22/L40 probe rows, the replayer's input format), `.measure.log.gz`.
- `seq.log`, `run-arm.sh`, `seq.sh`, `seq2.sh`, `final.sh`, `sumcap.py`; `final/` (the final tip's vitest, replays, in-app runs).
- `replay.requests.jsonl.gz` (the 20 replayed requests), `replay-{base,tip}.out.jsonl`, `replay-*.REPLAY.txt`, `replay-table.md`; `premerge-replay/` (16).
- `mutants.txt`, `vitest-bounded-{mergetip,premerge}.txt` + `.files.txt`, `engine-closure-*.txt` (102dcbeb, 6270c9f5, 960ff0a8, 290fc161, 07787a89, 089c0ee0), `inapp-*.txt`.
