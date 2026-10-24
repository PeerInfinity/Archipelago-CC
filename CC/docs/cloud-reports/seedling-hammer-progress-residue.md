# Seedling hammer-phase PR: the solve-progress residue (`soft-lock`, the last `other` sites, caches and churn)

Slice `seedling-hammer-progress-residue` (Opus, cloud) for planner `seedling-hammer-phase-planning-2`. ⚖ The user
(2026-10-18) picked the solve-progress residue in the replan and ruled *a NEW `soft-lock` refusal kind* for the
Watcher's Seed refusal. It ran in parallel with LB (the L40 band) and XF (the XC flip prep); neither's region was edited.

| | |
|---|---|
| start | `0f4bcfaef5` (`origin/main` at checkout; fidelity's wave 19 was **not** on main) |
| head | `75e88a52` (the D4 evidence), then this report's own commit. Commits: `30d8d4ef` W0 + D1 · `c312e9b0` D2 · `df53c5af` D3 · `4427e86d` D4 records · `75e88a52` D4 evidence |
| branch | `claude/seedling-hammer-progress-residue-cma341`. The brief named `seedling-hammer-progress-residue`; this session's harness designates the `claude/…` branch. Not merged, not pushed to `main` |
| evidence | `CC/docs/cloud-reports/seedling-hammer-progress-residue-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS · D2 PASS · D3 **PASS with one STOP** (the escape member's solver-side wiring) · D4 PASS.

**The one thing to know first.** `caches.escapeCrossPass` is built, gated and measured, but **`solverBot.js` does not
wire it**. XC's "ON is OFF" rows (`escapeCrossPassCache.test.js`, XF's file) compare the whole progress stream with the
cache ON and OFF. A member that reports the switch differs by design, so with the one line in, 10 of those 17 rows go
red. Until XF's rows compare the stream without `caches`, an installer wires the member from its hook
(`progressCaches(ESCAPE_CROSS_PASS_CACHE_COUNTS)` at site `segment`). The held line is in the residue.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-progress-residue-cma341 origin/main` → `0f4bcfaef5` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` after it (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` on each by name. Node v22.22.0. Server `serve-nocache.py 9601`, PID 829 |
| identity block | `w0/identity-w0.txt`: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`f0bec576`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK. It equals XC's, TC2's and SP's W0. ENEMY is not RK2's `36b59445`: it was banked at the BeamTower flip, before TC2 |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0; reference ALL 7 + 5 MATCH |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN 314 · 6,028 · 566 · 138 · 280 |
| bounded vitest BEFORE | RK2's 30 files + `escapeCrossPassCache` + `stringPullFast` (`w0/vitest-files-w0.txt`; `solveProgress*` and `lintGateLabels` are in RK2's 30): **927 / 927**, 32 files |
| RK's baselines | `w0/rkprobe-w0.jsonl`: L18 `230dc0ff` · `shouldStop` 165 · asks `{walk 13, hammer-escape 37}`, `{14, 37}`, `{18, 37, sword-dash 9}`; L40 `3addc379` · 167 · `{walk 61, kill-chaser 97, sword-dash 9}`. The same hooked under the real tap at 100 ms (L18 1,593 hook calls, L40 372) |
| v1 projection md5s | `w0/v1proj-w0.jsonl`: L18 `84b55e41`, L40 `642785a1`, L6 `c2d3c373`, L3 `d87fd4b1` = the test's pins. ⚠ RK2's `v1proj.mjs` predates TC2: it kept `frame`, so its md5s are not the pins (`w0/v1proj-w0-rk2tool-keeps-frame.jsonl`). This slice's copy drops `frame` (and PR's fields), as the test's `v1Of` does |
| kind totals | L18 `pending` 10 + `exhausted` 3; L40 `danger` / `bound` / `exhausted` 1 each; L6 `exhausted` / `bound` 1 each; L3 none (the test's pins, green in the 927) |
| runtime census | RK2's `census.sh` (`w0/census-raw-w0.jsonl`, `census-kinds-w0.txt`): 53 payloads over the six producers' `--check` and the four probe solves; **`pending` 32 · `exhausted` 12 · `bound` 7 · `does-not-apply` 3 · `danger` 1, no `other`** = RK2's |

## D1 — the census (PASS, measure only)

### The instrument
RK2 read each `solverBot.js` site's whole argument text with its literals joined, but every `${…}` stayed unexpanded.
That hid two things:
- a variable NAME can match a rule (`${bound}` matches `\bbound\b`, though a run writes a number there);
- a ternary's literal branches are read only fused together.

D1 widens the census on both axes (`tools/`):
- `closure.mjs`: the static import closure of `solverBot.js` + `twoPassSolve.js`, 93 modules (`d1/closure.txt`).
- `static-sites3.mjs`: RK2's site lexer over **every** closure file, with the plain `new Error(` / `TypeError` /
  `RangeError` forms added. 1,350 sites in 63 files (`d1/static-sites3-before.jsonl`; two more rows are the emitter's
  own `lastWhy = {why: …}`, excluded).
- `static-classify3.mjs`: RK2's classifier over them, with each `${…}` filled with `7` as the test's `fromSource` does.
  It knows that a `refuse(` outside `solverBot.js` throws its module's own `Error` subclass (`EntityRecordError`,
  `ProfileOverrideError`, `R7AcceptanceError`, `tapeEnvelope`'s `fail`).
- `static-variants.mjs`: every **run-time spelling** of a site. Each `${…}` is expanded to each string literal inside it
  (recursively) and to `7`, and every variant is classified. It over-approximates: a `7` for an expression that is
  always one of its literals does not occur at run time. Each such site is read below by hand.

**Reachability, by code.** Only `solverBot.js` constructs a `SolverRefusal`: 58 `new SolverRefusal(` and 5
`new PendingDeclaration(` lines, plus its `refuse` helpers. No other closure module names the class. `progressKind`'s last rule makes any other thrown `Error` `error`, never `other`. A search result's `bound` is
closed over the source by RK's gate row. So **`other` can only come from a `solverBot.js` sentence**, a refused row's
`why`, or a search `why`. The other 62 modules' 976 sites land in `error` (852) or in a kind named by their words
(`diverged` 55, `already-true` 20, `does-not-apply` 15, `exhausted` 11, `unmodelled` 11, `bound` 9, `danger` 2,
`precondition` 1). None is `other`, and each site's kind is in `d1/static-classified3-filled-before.jsonl`.

### The census table — every site that lands in `other`, or should not be where it lands

| site | sentence (fixed words) | kind before | honest kind | why |
|---|---|---|---|---|
| `solverBot.js:2142` (`execTalk`) | *"the dialogue opened with the box at (x,y) on the live Seed the watcher holds out on pages 9..19 — collecting it **is a soft-lock**."* | `other` (RK2's pinned residue) | **`soft-lock`** | the run arrived where it meant to, and going on is what the game forbids: not damage, not a missing state |
| `levelRun.js:14014` (a plain `Error`; fidelity's file, read only) | *"levelRun: the stance overlaps the Watcher's LIVE SEED at tick t … It **is a SOFT-LOCK**, not a lost pickup …"* | `error` | **`soft-lock`** | its own words; `lastWhy.name` keeps `Error` |
| `levelRun.js:19502` (a plain `Error`, read only) | *"levelRun: a plain Seed collected in level L reboots into a level with NO `seed` object … That **is a SOFT-LOCK** for the rest of the page …"* | `error` | **`soft-lock`** | the same |
| `solverBot.js:16920` (the rope's pull) | *"pressed rope at tick t (or NEVER — the aim never resolved) and group t=g **is NOT latched in the live run** N ticks later … the corridor this rung promised does not exist."* | `bound` to RK2's head (off the **variable** `${bound}`); **`other`** at run time | **`diverged`** | an executor outcome the run did not reach, the family RK2 named `diverged` |
| `solverBot.js:23599` (`collect-placement`'s blocker) | *"the placement is INSIDE key (id) — a pickup in a solid is an obstacle, not a stance problem."* + one of three branches | `unmodelled` to RK2's head (the branches fused); at run time **`other`** on *"Strategy 's' **failed to apply**."*, `unmodelled` on the other two | **`exhausted`** for `failed to apply` | the registered strategy's resolver resolved nothing. Its frontier sibling (`:19563`, *"no corridor … Strategy 's' failed to apply"*) already reads `exhausted`, as RK2's `unresolved` does |
| `solverBot.js:6021` (`planSwordDash`) | `refuse('deadline')`: the plan report after a reached deadline | `other` | **`deadline`** (the bare word) | the deadline's own word. Its report never reaches the tree (RK2): this is for completeness, not a moved count |
| `solverBot.js:8959`, `:8973` | *"after the lean / thrust the block is … as route step ${i + 1} requires."* | `other` to RK2's head | `diverged` (no change) | **an instrument artefact**: filled, the rule matches; RK2's family row already pinned `:8971` |
| `solverBot.js:2087` (`resolveTalkStrategy`) | *"no stance to open w's dialogue from … N would freeze the box against the live Seed … (a soft-lock), and M plan no corridor …"* | `exhausted` | `exhausted` (**not** `soft-lock`) | the search found no stance; the soft-lock is why some were not tried. The rule must not read the bare noun |

`d1/static-variants-before.txt`: 269 non-wrapper `solverBot.js` sites, **4** with an `other` spelling (`:2142`,
`:6021`, `:16920`, `:23599`); RK2's instrument, re-run here (`d1/static-residue2-before.txt`), gives RK2's 4 (`:2142`,
`:6021`, `:8959`, `:8973`), lines +2. ⚠ One `solverBot.js` row (`:21915`, *"the combat ladder is EXHAUSTED … summary"*) is
absent from `d1/sb-classified3-*` because the filter that drops the summary line also matched its sentence. It is
`exhausted` before and after, so no count above moves for it.

**The tree's own `other` (the runtime `tree.*` counts).** The runtime census reads every rejection the tree tallied over
the six producers' `--check` and the four probe solves. It has **none** in `other`, at W0 and after D2 (`d2/census-kinds-d2.txt`
is byte-equal to `w0/census-kinds-w0.txt`). No committed solve meets any site in the table.

**Other soft-locks?** Every `soft-lock` mention in the closure was read: `solverBot.js` `:1999` and `:2090`, `levelRun.js`
`:2861`, `:14023`, `:14120`, `:19472`, `:19494` and `:19508`, `dialogue.js:596`, `endingChain.js:126`,
`r8Acceptance.js:2512`, `watchManual.js:206` and `watchViewer.js:5144`. Only the three in the table are refusal
sentences that *claim* a soft-lock. The rest are comments, docblocks, the no-stance search (`:2087`/`:2090`), or not on
the solve path.

## D2 — the kinds (PASS)

`frontend/modules/seedlingDemo/solveProgress.js` only. No refusal sentence was reworded, and `solverBot.js` /
`levelRun.js` are unedited.
1. `REFUSAL_KINDS` gains **`soft-lock` immediately before `other`** (⚖ js-7: the chips follow the list). `other` stays
   last, and the earlier eleven keep their places.
2. `SOFT_LOCK_WORDS = /\bis a (?:soft-lock|SOFT-LOCK)\b/`, the sentence rule placed right after `already-true`. It reads
   the sentence's *claim*, never the bare noun (mutant p3).
3. `exhausted` + `\bfailed to apply\b`; `diverged` + `is NOT latched in the live run`; `deadline` + `^deadline$`.
4. `v` stays **2**: the kind is additive, and no consumer gates on `v`. The schema doc's §5 has a "v2 additions (PR)"
   section. I found no reason to bump.

**Gate rows** (`solveProgress.test.js`, PR block):

| row | what it pins |
|---|---|
| the order | `REFUSAL_KINDS.at(-2) === 'soft-lock'`, `at(-1) === 'other'`, the first eleven unchanged |
| the soft-lock sentences | `execTalk`'s, read out of `solverBot.js`, → `soft-lock` (`SolverRefusal`); `levelRun`'s two, read out of `levelRun.js` as plain `Error`s, → `soft-lock` with `progressErrorName` `Error` |
| not stretched | `:2087`'s no-stance refusal (its message contains `(a soft-lock)`) stays `exhausted`; a soft-lock mentioned as a noun stays `other` |
| each newly classified site | `:16920` both branches → `diverged`; `:23599` → `exhausted` / `unmodelled` / `unmodelled` by branch; bare `deadline` → `deadline`, but *"the deadline was near"* → `other`; `:8959`'s filled sentence → `diverged` |
| RK2's residue row | **re-pinned** `other` → `soft-lock` (the family row) |
| RK's / RK2's / TC2's rows | unchanged and green. Kind totals on L18 / L40 / L6 / L3 unchanged (no committed site moved); `other` on the committed solves stays 0 |

**Mutants** (`tools/mutants3.py`, `d2/mutants.txt`; the file also carries D3's three):

| mutant | caught by |
|---|---|
| p1: the soft-lock words removed from the rule (`/(?!)/`) | 3 red: the soft-lock row (`execTalk`'s sentence → `other`), RK2's family row, RK2's rung-independence row |
| p2: `soft-lock` placed after `other` | 3 red: the order row, RK2's family row (`at(-1)`), RK's closed-over-the-source row |
| p3: the rule reads the bare noun (`/soft-lock/i`) | 1 red: the not-stretched row (`:2087` → `soft-lock`) |

**Static counts after** (`d2/`): the variant instrument's residue is **4 → 1**. The one left is `:23599`, and only through
its over-approximated `7` spellings: its three real branches are `exhausted` / `unmodelled` / `unmodelled`. So the
run-time residue is **0**. Sites that changed kind (`d2/static-kind-changes.txt`), and no others:
- `levelRun.js:14014` and `:19502`: `error` → `soft-lock`;
- `solverBot.js:2142`: `other` → `soft-lock`;
- `:6021`: `other` → `deadline`;
- `:16920`: `other` → `diverged`.

`:23599`'s branch moved at run time, not in a single static head.

**For js-7 (the view; JS-arc files untouched):** `soft-lock` is a chip like the others. `kindChips` iterates the
`REFUSAL_KINDS` export, so it lands second-to-last with no code change: the view test's `UNKNOWN KIND` and `CHIPS` rows
pass. As a reading aid it means **"the game would be wedged: the run is where it meant to be, and stepping on is what
is forbidden"**. If the view colours kinds, it belongs with the hard stops (`danger`), not with `pending` /
`precondition`. On the last-why line, `lastWhy.name` `Error` with kind `soft-lock` is `levelRun`'s own refusal (worth
showing; it is not a bug).

## D3 — churn and cache rates (PASS, one STOP)

### The shape (js-7's: counts, one bounded object per segment)
```
caches: { stringPull:      { hits, misses } | null,
          escapeCrossPass: { hits, crossPassHits, misses, stored, tripped, digestMoved, cap, bypassed } | null },
churn:  { opened, succeeded, rejected, moved }
```
These are top-level snapshot fields with fixed key sets. There are no arrays and no ratios. The largest
`{caches, churn}` at any snapshot of the four solves is **127 bytes** with XC OFF and **222 bytes** with XC ON
(`d3/caches-d3.jsonl`).

- **`stringPull`.** No counter existed beside SP's memo, so one was added. `botDriverV2.js` gets **one line** in
  `stringPullBlockedAt`'s closure, `if (activeProgress !== null) progressStringPull(v !== undefined); // ⛓ PR`, plus
  the import (`progressStringPull`). A hit is a point already asked in that `planWaypoints` call. The member is created
  on the first ask in the segment, so it is `null` with `STRING_PULL_FAST` OFF (no memo is built) or when the segment
  plans nothing.
- **`escapeCrossPass`.** It reads the existing `ESCAPE_CROSS_PASS_CACHE_COUNTS`. `progressCaches(counts)` takes a copy
  of the eight fields at the segment's start (the first call wins), and each peek reports `now − base`. The miss causes
  are the cache's own counters: `notStoredTripped` → `tripped`, `notStoredMoved` → `digestMoved`, `notStoredCap` →
  `cap`, and `bypassedTripped` → `bypassed`. The field `lookups` is `hits + misses`, so it is left out.
- **`churn`.** It is defined from what the emitter already does: `opened` counts the frames pushed under the segment's
  root (`progressEnter`). `succeeded` and `rejected` count the frames popped by returning or by a rejection; an error
  unwinding three frames closes three. `moved` counts the climb cursor's identity changes (`progressRung`, `progressRow`).
  **What it measures:** how often the solver abandons a path and takes another. It is coarse. A rung row's or a search
  leaf's rejection opens no frame, so on L40 and L6 `rejected` is 0 and the ladder's refusals are in the tree's
  `rejections`. A finer churn (per rung row, per search) would only be a sum of the tree's own counts; it would not be
  new solver work, so nothing was STOPPED for it.

### ⛔ STOP: the escape member's solver-side wiring
The planned wiring was one line in `solveSegmentUnder`'s `if (activeProgress !== null) { progressReaders(…) }` block:
```js
progressCaches(ESCAPE_CROSS_PASS_CACHE.enabled && activeEscapeScope !== null ? ESCAPE_CROSS_PASS_CACHE_COUNTS : null); // ⛓ PR: emit-only
```
With it, `escapeCrossPassCache.test.js` went **10 red of 17**: both L18 rows, L6 / L3 ON-is-OFF, the mid-search trip,
both verify rows and the three `maxEntries` rows. Each compares `JSON.stringify({site, snap})` streams ON vs OFF
(`:83`), and ON's member is counts where OFF's is `null`. That file is XF's (the brief's parallel slice), so I did not
edit it, and the line is **not** in `solverBot.js`. Without the line, the file passes **17 / 17**: `stringPull` and
`churn` are the same with the cache ON and OFF. `progressCaches` is exported, and an installer that knows the cache is
in hand calls it from its hook's first call of the segment (site `segment`). The test, `d3-caches.mjs` and (when it
wants the rate) js-7's tap can do this today.

**To lift it:** XF's stream rows compare `snap` without `caches` (`const { caches, ...rest } = snap`), then the line
above goes in, and the PR source row (`solverBot.js` does not call `progressCaches`) flips to pin it inside that block.

`stringPullFast.test.js` (SP's, landed; not a parallel slice's region) had the same shape: 4 red. Its OFF-vs-ON stream
rows now compare the stream without `caches`, and they check the member (`null` at every OFF segment; counted at an ON
segment that planned).

### Gate rows and measurements

| row | result |
|---|---|
| byte-identity (`d3/rkprobe-d3.jsonl`) | L18 `230dc0ff` · 165 · asks = W0, hooked (1,593 calls) and unhooked; L40 `3addc379` · 167 · asks = W0, hooked (372) and unhooked. The test rows pin the same, plus `cacheEntered()` unhooked = 0 |
| v1 projection md5s (`d3/v1proj-d3.jsonl`) | `84b55e41 · 642785a1 · c2d3c373 · d87fd4b1` = W0, with `caches` / `churn` dropped too. TC2's stream md5s (every snapshot, `frame` / `caches` / `churn` dropped) and its snapshot counts (1,593 · 372 · 41 · 27) are green |
| bounded shape at every snapshot | L18, L40, L6, L3: the key sets are exact, every value is a non-negative integer, the bytes are under 400, the counts never fall within a segment, and at `done` `succeeded + rejected = opened` |
| non-vacuous, string pull | final `stringPull` hits / misses: L18 `—` · `—` · 123 / 340; L40 **47,073 / 44,962**; L6 4,229 / 1,947; L3 1,674 / 1,055 |
| non-vacuous, escape cache (XC ON in the test, wired by its hook) | L18's segments: pass 1 `{misses 542, stored 542}`; passes 2 and 3 `{hits 542, crossPassHits 542}` each. Σ over the segments = the solve's own delta of the process-wide counters, field by field; `misses = stored + tripped + digestMoved + cap`; the answer equals OFF's |
| churn | L18 `{4,0,4,0}` `{4,0,4,0}` `{4,4,0,0}` (opened, succeeded, rejected, moved): the two refused passes' frames close by the unwinding error; L40 `{4,4,0,6}`; L6 `{5,5,0,5}`; L3 `{2,2,0,0}` |
| unwired | XC ON, no installer wiring: `escapeCrossPass` `null` on all three L18 segments; `progressCaches(null)` → `null` |
| source | `botDriverV2.js`: exactly one `progressStringPull(` line, guarded; `solverBot.js` names none of `progressCaches`, `progressStringPull`, `cacheEntered`; the counters' code reads no `shouldStop`, deadline, clock, `emit(` or `work(` |
| snapshot growth | the final snapshot grows **+99 to +135 bytes** per segment (L18 3,016 / 3,088 / 2,588 vs W0's 2,906 / 2,978 / 2,457; L40 3,831 vs 3,696) |

**Mutants** (`d2/mutants.txt`):

| mutant | caught by |
|---|---|
| p4: the memo's count point unguarded (made null-safe) | 3 red: L18 and L40 byte-identity rows (`cacheEntered()` 463 / 92,035 unhooked) and the source row |
| p5: the escape member reports the process-wide counters, not the delta | 1 red: the XC ON row (Σ hits 4,878 ≠ the solve's 1,084) |
| p6: `churn.opened` kept as a list | 4 red: the bounded-shape row on all four solves |

No deadline site, `shouldStop`, work unit or default changed. Unhooked, the memo line and the frames' counts are behind
`activeProgress !== null` (the counts live in functions reached only through it).

## D4 — records (PASS)

| row | result |
|---|---|
| bot log | `seedling-bot-log.md`: `### Seedling hammer-phase PR — solve-progress residue` |
| schema doc | `seedling-solve-progress.md`: §2's block (`caches`, `churn`), the kinds table (a `soft-lock` row; PR's words on `deadline`, `exhausted` and `diverged`), the census paragraph, `### caches and churn` (with the held wiring); §3 (the memo's line is not a count point); §5 "v2 additions (PR)"; §6 the PR pins |
| surface / constants | `--check` GREEN 314 · 6,028, 0 drift, so there was nothing to `--write` (`solverBot.js` is unchanged) |
| reference | `generate-procgen-reference.mjs` (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`), then `check-procgen-reference.mjs`: ALL CHECKS PASSED; `generate-docs-index.mjs`: current (187 docs) |
| identity block AFTER | `d4/identity-d4.txt`, run at `4427e86d` (D2 + D3 code, D4 records): **byte-equal to W0**, every row; the six `--check`s exit 0 with the same md5s; reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 314 · 6,028 · 566 · 138 · 280 (= W0) |
| runtime census AFTER | `d4/census-raw-d4.jsonl`: the 53 payloads are **byte-equal** to W0's; kinds (`d4/census-kinds-d4.txt`) = W0's, no `other`; the six producers' md5s and the four probes' digests and `shouldStop` are equal (only their walls differ) |
| bounded vitest AFTER | the W0 set (32 files; `d4/vitest-files-d4.txt`): **941 / 941** (= 927 + the 14 PR rows; `solveProgress.test.js` 57 tests) |
| not run (⚖ 52, the brief) | no unfiltered vitest, no `pytest`, no `standing-values --write`. The CI vitest suite at the pushed SHA and the in-app `seedling-js-runtime-solve-progress-view` row are the harvest's |

**What js-7's view needs** (JS-arc files untouched):
- **The `soft-lock` chip.** Nothing, if the view keeps iterating `REFUSAL_KINDS`. It lands second-to-last.
- **The rate fields.** `snapshot.caches.stringPull.{hits, misses}` (rate = `hits / (hits + misses)`) and
  `snapshot.caches.escapeCrossPass.{hits, crossPassHits, misses, stored, tripped, digestMoved, cap, bypassed}`
  (hit rate `hits / (hits + misses)`, cross-pass share `crossPassHits / hits`, the miss causes summing to
  `misses − stored`). A `null` member means OFF or no data: draw nothing, never a 0 %. Each is **per segment**, like
  `budget`. The escape member stays `null` until something wires it: XF's rows plus the held line, or the tap calling
  `progressCaches` at site `segment`.
- **`churn`.** `{opened, succeeded, rejected, moved}`; `rejected / opened` is the abandoned share. It is coarse (see D3).

## What the brief got wrong (measured)

1. **"4 static `other` sites plus the Watcher's soft-lock sentence."** The soft-lock **is** one of RK2's 4. Of the
   other three, two (`:8959` / `:8973`) are an instrument artefact that already matches at run time, and one (`:6021`)
   never reaches the tree. Two **other** run-time `other` sites were hidden by RK2's instrument (`:16920`, `:23599`'s
   branch).
2. **"Read counters that already exist … `caches.escapeCrossPass` non-null when ON".** Doing so breaks XC's own "ON is
   OFF" stream rows (XF's file), 10 of 17. The brief's two constraints (wire it in `solverBot.js`, don't edit XF's
   tests) cannot both hold, so the wiring is held (D3's STOP).
3. **"`botDriverV2.js` is read-only except a one-line counter".** One line plus its import, as planned. But SP's
   `stringPullFast.test.js` also compared the whole stream OFF vs ON and needed a projection (4 rows).
4. **The tools.** RK2's `v1proj.mjs` predates TC2's `frame` and does not reproduce the pins at main. This slice's copy
   drops `frame` / `caches` / `churn`.
5. **The branch.** The brief's `seedling-hammer-progress-residue`; the harness designates
   `claude/seedling-hammer-progress-residue-cma341`.
6. **The soft-lock sites.** The brief named one, the Watcher's. By their own words there are three: `levelRun`'s two
   `Error`s are soft-locks too (they were `error`).

## Residue

1. **The held line** (D3's STOP): `progressCaches(…)` beside `progressReaders` in `solveSegmentUnder`, after XF's stream
   rows drop `caches`. Until then `caches.escapeCrossPass` is `null` on every solve no installer wires.
2. **`soft-lock` has no real-solve row.** All three sentences are pinned from their source. A committed solve that
   meets the live Seed would be the first real row; the planner's resolver avoids it by design.
3. **Static counts are an indicator.** The variant instrument over-approximates (a `7` spelling of an always-literal
   expression). `:23599`'s `7` spellings are its only residue, read by hand.
4. **Fidelity's wave 19** (HOUSEKEEP) was not on main at W0. When it lands, its new `obstacle.kind`s
   (`unmodelled-frozen-press`, `unmodelled-pit-teleporter` → `unmodelled` by field; `orphan-presser` → `does-not-apply`
   by words) should be re-run through `tools/static-variants.mjs`.
5. **At harvest, not run here:** the CI vitest suite at the pushed SHA (⚖ 52), and the in-app
   `seedling-js-runtime-solve-progress-view` row (js-7's).
