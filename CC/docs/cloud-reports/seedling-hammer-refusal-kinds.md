# Seedling hammer-phase RK: refusal kinds and the last `why` (solve-progress v2)

Slice `seedling-hammer-refusal-kinds` (Opus, cloud) for planner `seedling-hammer-phase-planning-2`. This is solve-progress
Tier C item 1 (the plan's S5), with the `v: 2` groundwork.

| | |
|---|---|
| start | `3f5c3ff0fd` (`origin/main` at checkout) |
| head | `a42b8877` (D4), then this report's own commit. Commits: `2bb94912` W0 + D1 · `f1c87b6c` D2 · `8b4e7527` D3 · `a42b8877` D4 |
| branch | `claude/seedling-refusal-kinds-z6gmg9`. The brief named `seedling-hammer-refusal-kinds`; this session's harness designates the `claude/…` branch, and both point at the same work |
| evidence | `CC/docs/cloud-reports/seedling-hammer-refusal-kinds-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS (no STOP: no throw-site field is needed in fidelity's files) · D2 PASS · D3 PASS ·
D4 PASS.

**The one thing to know first.** The kind is read on the **verbatim** sentence and the solver's own fields, never on the
cut key, and every v1 byte is unchanged. On the four committed gate solves, all 18 rejections have a kind and none is
`other`; across the six producers it is 55 events, none `other`. Over the whole source, though, the rules are a census,
not a proof: 75 of `solverBot.js`'s refusal sites have fixed words no rule names yet, and would read `other` if a solve
met them (`d1/static-residue.txt`). Two of the investigation's kinds, `not-faster` and `leg-bound`, never reach the
tree at all. They are `planSwordDash`'s window rows.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-refusal-kinds-z6gmg9 origin/main` → `3f5c3ff0fd` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. Node v22.22.0. Server `serve-nocache.py 9595`, PID 695 |
| defaults | `w0/defaults.txt`. Every `solverBot` switch as `main` ships it (`DASH_KEEP_PARTIAL` / `DASH_LEG_PRECHECK` now ON, `HAMMER_ESCAPE` ON, `STRIKE_ETA_FLOOR` OFF, …). `CONTACT_FIDELITY`: `sealDoorApproach`, `arrowLaneCrossing`, `axeTimingRung` and `axeGateTransit` all OFF. `SOLVE_PROGRESS_INTERVAL_MS` is 100 (S2 has landed) |
| identity block | `w0/identity-w0.txt`: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0. The first five equal HB's W0. Campaign has moved since HB (`6b1bf15c` → `3d41b9fb`, the statueTalkRange flip and the dash flip landed in between) |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass (= HB) |
| surface / constants / entities / profile / roster | GREEN 312 · 6,002 · 566 · 138 · 280 |
| bounded vitest BEFORE | 23 files (`solveProgress*`, `jsRuntimeSolveProgress`, `solverBot*`, `hammer*` (not `.slow`), `flashPanel/seedlingSolveProgress*`, `lintGateLabels`; `w0/vitest-files-w0.txt`; `solveProgressTap` is in the `solveProgress*` glob): **353 / 353** |

**The byte-identity baseline** (`tools/rkprobe.mjs`, the real tap at 100 ms, a deadline that never trips, fine
checkpoints on; `w0/l18-100.json`, `w0/l40-100.json`):

| solve | digest | `shouldStop` | hook calls | segment: outcome · asks | rejection keys per node |
|---|---|---|---|---|---|
| L18 (`r9-solve-18`, residue 21 → exit (176,112)) | `230dc0ff` | 165 | 1,593 | 0 threw `{walk 13, hammer-escape 37}` · 1 threw `{walk 14, hammer-escape 37}` · 2 solved `{walk 18, hammer-escape 37, sword-dash 9}` | seg 0: `levelRun` on segment → goal → walk → verb:kill → arm:press, `exhausted` on the escape leaf; seg 1: `` `Game.totalEnemies()` reached zero at tick # `` on the same five, `exhausted` on the leaf; seg 2: `exhausted` on the leaf |
| L40 (`r5-l40-part5` → collect (160,640)) | `3addc379` | 167 | 372 | 0 solved `{walk 61, kill-chaser 97, sword-dash 9}` | rung:avoid *"the danger-forbidden corridor STILL probes dangerous at"*, rung:time *"the aim is # px away and `mover.MOVER_RANGE` … UPPER BOU…"*, rung:bait *"no stance within puncher@#,#'s leash"* |

The md5 of the **v1 projection** (every segment's final snapshot, peeked at `done`, with `v` dropped; `tools/v1proj.mjs`,
`w0/v1proj-w0.txt`): L18 `84b55e41`, L40 `642785a1`, L6 `c2d3c373`, L3 `d87fd4b1`.

## D1 — the census (PASS, measure only)

Two instruments, neither of them a tracked edit:
- **What the tree really tallies.** `tools/census-loader.mjs` is a Node loader hook that injects a recorder into
  `solveProgress.js` at load time, at the three places a rejection is tallied (`progressLeave`, `progressRow`,
  `progressSearch`). `tools/census.sh` runs it under the six producers' `--check` and the four probe solves
  (`d1/census-raw.jsonl`, 53 distinct payloads, each verbatim with its fields). The producers' md5s under the recorder
  equal their W0 `--check`s.
- **Every refusal site.** `tools/static-sites.mjs` lists each site of `solverBot.js` with its line and the head of its
  sentence (`d1/static-sites.jsonl`, 365 rows): `refuse` 130, rung `why`s 64, `fail` 60, `new SolverRefusal` 58,
  `refuseCT` 15, search `bound:` literals 11, `refused = {rung, why}` 9, `planSwordDash`'s `row.kind` 7,
  `PendingDeclaration` 5, `SolverBotError` 4, `refuseDanger` 2.

**What the committed solves reject** (the six producers plus L18, L40, L6 and L3; `d1/census-kinds.txt`):

| kind | via | the solver's words | source |
|---|---|---|---|
| `pending` | an error (`Error` with `undeclaredKillLock`) | *"levelRun: spinner@112,48's removal at tick 205 OPENS 1 kill lock(s) in level 18 … The tape DECLARES no clear for them"* | `levelRun.js:3221` (sentence), `:3230` (field); `:11324` / `:11331` |
| `pending` | an error (`PendingDeclaration`, `obstacle.kind: 'kill-lock'`) | *"`Game.totalEnemies()` reached zero at tick 205 (spinner@112,48) and lock@144,112 is ARMING"* | `solverBot.js:13150` (also `:14090`, `:14954`) |
| `danger` | rung row, AVOID | *"the danger-forbidden corridor STILL probes dangerous at (168.4,638.1) — …"* | `solverBot.js:19736` |
| `does-not-apply` | rung row, AVOID | *"every reason the probe gave is a TurretSpit (…); a spit is the walk's own timing, not a static volume, so a re-plan around the danger map's volumes answers a different question"* | `solverBot.js:19713` |
| `exhausted` | rung row, AVOID | *"no admissible corridor with the danger map's 6 volume(s) forbidden — no walkable tile path in level 6 …"* | `solverBot.js:19724` |
| `bound` | rung row, TIME | *"the aim is 193 px away and `mover.MOVER_RANGE` measures this search reaching 48 px as an UPPER BOUND at dwell 4 …"* | `solverBot.js:20586` |
| `exhausted` | rung row, BAIT | *"no stance within puncher@128,624's leash (80) both pulls its straight line through a kill region and is itself danger-free …"* | `solverBot.js:16903` |
| `does-not-apply` | rung row, BAIT | *"sandtrap@96,80 is a STATIC census body (`speed 0`, …) … That is a KILL question"* | `solverBot.js:20676` |
| `exhausted` | search leaf `escape-free` | `bound: 'exhausted'`, *"depth first (deepest 35) and then breadth first: no state reachable from index 31 survives to index 37 …"* | `spaceTimeReach.js:293` |

**The wishlist's kinds, traced:**
- *deadline* (window / budget / walk / sword-dash). The solver writes the deadline in three places:
  - a search's `bound: 'deadline'` (`spaceTimeReach.js:185`, `solverBot.js:7305`, `deriveFight`'s `no(false, 'deadline', …)`);
  - a site's own sentence (`anytime deadline`: `refuseWalkDeadline` `:18852`, the crusher fork `:859`, TIME `:20595`, DETOUR `:17713`; `at the deadline`: the AXE arm `:20203`, the PHASE arm `:20426`);
  - `withSolveDeadline`'s `deadlineClause` (`⏱ DEADLINE: …`), appended to a refusal raised after a trip (`:18355`).

  `window` and `budget` are **not** solver distinctions. They are the JS arc's `limit.first` (`jsRuntimeSolver.js:277–287`), and the solver sees only that `shouldStop` said yes.
- *danger*: `refuseDanger` (`:18863`), `obstacle.kind: 'danger'` (11 sites, including ARROWLANE `:21598` and AXETIMING
  `:20235`), `HAMMER_SAFETY`, and the AVOID row above.
- *not-faster*, *leg-bound*: **`planSwordDash`'s per-window rows** (`row.kind`, `:6207`, `:6231`), with `stalled`,
  `crossing`, `shake-room`, `unpriced-hit` and `danger`. A window rejected inside a dash plan is not a tree rejection,
  and `planSwordDash` has no count point (the schema's §3 rule), so none of these reach the tree.
- *already-true*: *"the latched wait's condition is already true"* (`:3260`, a `SolverRefusal`), and `is ALREADY`.
- What the wishlist missed: `pending` (the two-pass loop's by-design first pass, the most frequent kind on the committed
  solves), `exhausted`, `bound` (the solver's own named bounds), `does-not-apply` (*"That is a KILL question"*),
  `unmodelled`, `diverged` (the run did not do what the plan said) and `error` (a thrown non-refusal).

**The enum** (`REFUSAL_KINDS`, closed, every name a word the solver uses for it): `deadline`, `pending`, `danger`,
`bound`, `exhausted`, `does-not-apply`, `already-true`, `unmodelled`, `diverged`, `error`, `other`. The rules and their
words are in the schema doc's §2 table and in `solveProgress.js` (`progressKind`, `BOUND_KINDS`, `CLEAR_TAG_KINDS`,
`WHY_KINDS`). In order:
1. the solver's fields: `bound: 'deadline'`; a `PendingDeclaration`, a refusal's `pending`, or `undeclaredKillLock`;
2. the deadline's words anywhere in the verbatim sentence;
3. `code` (`HAMMER_SAFETY`, `STRIKE_BOUND_EXHAUSTED`), a search's other `bound`, an `obstacle.kind` (`danger`,
   `unmodelled-*`, `unbilled-*`), or a `clear-tag` refusal's `obstacle.reason`;
4. the sentence's rules;
5. `error` for any other thrown non-refusal, else `other`.

**Derivable from what `progressReason` already sees: yes.** Every rule reads the payload `progressReason` is handed
(the error, the refused row, the search result). It reads it whole and verbatim, not cut. The one field the committed
solves need from a throw site, `levelRun`'s `undeclaredKillLock`, **already exists** (`levelRun.js:3230`, `:11331`), and
`solverBot` already reads it (`:12888`, `:14254`). So no throw site in fidelity's files needs a field, and there is no
STOP.

**Fidelity-9's conditions:**
- No rung or verb name enters a rule. A rung's refusals are classified by their own words and fields, so the condition
  that names come from the solver's own tables is met by using none. The two tables that do name things are keyed on
  the solver's own fields, and a gate row reads them out of the source: every `bound` literal in `solverBot.js` and
  `spaceTimeReach.js` (14 bounds) and every `refuseCT` reason (7).
- `axeTimingRung`, `arrowLaneCrossing`, `sealDoorApproach`: a gate row classifies each one's refusal shapes with the
  switch ON and OFF. The shapes are AXETIMING's blade-gap rows (exhausted, deadline, bound) and its crossing's HIT
  refusal (danger: it carries `obstacle.kind: 'danger'`); ARROWLANE's armed-lane refusal (danger); and SEALDOOR's door
  predicate sentence (`does-not-apply`), its stance (`exhausted`), its wait (`diverged` ×2), and the clear-tag order's
  `unresolved` (with the door's predicate sentence inside) and `no-verb`. The kinds are equal both ways, and none is
  `other`.
- ⚠ Fidelity's seal flip had **not** landed when this slice finished (`origin/main` = `b9641cfb`, which touched only
  `survey-seedling-route.mjs` / `surveyGrants*`). So the SEALDOOR shapes are the site's own sentences rebuilt with
  their fields, not a solve with the switch on. The residue names the row that is owed.

**Coverage over the whole source** (`tools/static-classify.mjs`; `d1/static-classified.jsonl`, `d1/static-residue.txt`).
It is approximate by construction: a head is the sentence's first ~200 source characters with `${…}` unexpanded. Of
365 sites:

| | sites |
|---|---|
| `diverged` | 65 |
| `error` (`fail()`: a contract `SolverBotError`) | 47 |
| wrappers (`${what}: ${why}`, `why = detour.why`), whose kind is their inner sentence's | 41 |
| `does-not-apply` | 38 |
| `exhausted` | 35 |
| `bound` | 23 |
| `danger` | 16 |
| `deadline` | 7 |
| `planSwordDash` window rows (not in the tree) | 7 |
| `pending` | 5 |
| `unmodelled` | 5 |
| `already-true` | 1 |
| **`other`** | **75** |

The 75 are named by line in `d1/static-residue.txt`. Most are executor sentences with no shared verb (*"the encounter
has run 240 ticks without the drop"*, *"the ordering search found N charge(s)"*, the teleporter's `inside-solid` /
`closed`). None of them is met by a committed solve.

## D2 — the fields (`v: 2`) (PASS)

`frontend/modules/seedlingDemo/solveProgress.js`:
1. **`tree.*.rejectionKinds {kind: n}`** beside `rejections`. `reject(node, reason, kind)` tallies both together, so on
   every node Σ kinds = Σ reasons. `rejections` is unchanged.
2. **`lastWhy {why, kind, key} | null`** at the snapshot's top level, one per segment, overwritten:
   - `why` is `progressWhy(x)`, verbatim: an error's `message`, a row's or a search's `why`, else the `bound`.
   - `key` is the node it landed on: a rung's node, a search's leaf, or an error's **deepest** frame.
   - An error that unwinds through several frames keeps the deepest key, but its words are re-read at each frame.
     *Found while building:* inside a segment that installed its own `shouldStop`, `withSolveDeadline` appends its
     clause to the error **after** the inner frames have left, so only the outer leaves can see it.
3. **`SOLVE_PROGRESS_VERSION` → 2.** The schema doc has a §5 "v1 → v2" table, one row per field with why, and it says
   the S3 tap stamps (`budget.spent`, `limit`, `wallBySite`, `rate`, `request`, `best`, `progressAttempt`) are
   **unchanged at v2** (js-7's condition).
4. **Read after the solver computed it.** `progressKind` and `progressWhy` are pure (no clock, no `shouldStop`; a gate
   row scans the body) and are reached only from the count points behind `activeProgress !== null`. `solverBot.js`
   never calls them (a gate row scans for that). No deadline site, no `shouldStop`, no work unit, no default and no plan
   changed.
5. **The one `solverBot.js` line** (`:12158`, the fight search's progress leaf, already inside its null check):
   `progressSearch('fight', { ok, bound, why: out.why, expansions })`. Before, the fight's leaf had no sentence, so its
   `lastWhy` would have been only its bound. It is an observation of a value `deriveFight` had already computed, and it
   is no throw site in fidelity's files.

**For js-7 (the JS arc):**
- **Confirmed: no consumer gates on `v`.** `grep -anr SOLVE_PROGRESS_VERSION frontend/modules` finds only
  `solveProgress.js` and `solveProgress.test.js`. The view, the tap, the worker and the service never compare `v`.
- **The grant was not needed, and was not used.** `solveProgressTap.test.js:304` checks `posted.v` on a **synthetic**
  `v: 1` snapshot passing through the tap (`snap()` at `:54`), so it stays green at v2. Changing it to
  `SOLVE_PROGRESS_VERSION` would turn it **red**. No JS-arc file was edited.
- **What the view half could show** (js-7's slice; not built here):
  - on each tree row, its kind tallies as compact chips (`pending ×5 · exhausted ×1`), with the reason keys kept in the
    tooltip;
  - on an active climb's rung rows, the kind beside the inline reason;
  - one **last-why line** under the active path: `‹kind› at ‹key›: ‹why›`, the why verbatim, clamped to a line or two
    with an expander, since some run to 900+ characters. On the final note it is the segment's refusal.
  - ⚠ A segment-wide kind histogram must not sum every node: an error that unwound through five frames is tallied on
    all five. Count the rung and search nodes plus the deepest node of each error (`lastWhy.key` marks where one
    landed).

**Gate rows** (`solveProgress.test.js`, 27 / 27; the new ones):

| row | what it pins |
|---|---|
| L18, L40 byte-identity | the digest is equal hooked and unhooked; `shouldStop` 165 / 167 both ways (= W0); each segment's `budget.asks` = W0's literals; Σ asks = `shouldStop`; unhooked, `kindEntered()` does not move |
| L18, L40, L6, L3: v1 bytes and kinds | the v1 projection md5 = W0's (`84b55e41`, `642785a1`, `c2d3c373`, `d87fd4b1`); every kind ∈ `REFUSAL_KINDS`; Σ kinds = Σ rejections on every node; `other` = 0; per-solve kind totals pinned (L18 `pending` 10 + `exhausted` 3; L40 `danger`, `bound`, `exhausted` 1 each; L6 `exhausted`, `bound` 1 each; L3 none) |
| non-vacuous | ≥ K = 15 rejections (measured 18) in ≥ 4 kinds (measured 4) |
| `lastWhy` verbatim, thrown | L18's first pass alone (`solveSegment`): `lastWhy.why === err.message`, kind `pending`, key `segment/goal#0/walk/verb:kill/arm:press`; the cut key (`levelRun`) has kind `other` |
| `lastWhy` verbatim, rows | L40's and L6's last `why` is a `rejected[].why` of the solve's own trace, on that rung's node |
| `lastWhy` shape | at every snapshot of a stream: `null` or exactly `{why, kind, key}`, never an array, with a key that is a node of its tree |
| deadline clause | a sentence ending in `⏱ DEADLINE: …` is `deadline`; its cut key is not |
| fields | bound, `pending`, `undeclaredKillLock`, the codes, `obstacle`, `error`, `other` |
| closed over the source | every search bound and `refuseCT` reason in the source has a kind |
| fidelity switches ON / OFF | as above |
| only an install reaches it | `solverBot.js` never names `progressKind` / `progressWhy` / `kindEntered`; the lookup's body reads no `shouldStop`, `activeDeadline` or clock |

**Mutants** (`tools/mutants.py`, `d2/mutants.txt`), each run against the RK rows:

| mutant | caught by |
|---|---|
| k1: the kind read off the cut key (`progressKind(progressReason(err))`) | the L18 v1-and-kinds row (`other` 10, expected 0) and the thrown-`lastWhy` row (`other`, expected `pending`) |
| k2: `lastWhy` kept as a growing list | five rows: the L18, L40 and L6 shape checks (`['0','1',…]` vs `['why','kind','key']`) and both verbatim rows |
| k3: a kind lookup that calls `shouldStop` (in `rowFor`, before `progressRow`) | the L40 byte-identity row: `shouldStop` 167 → **171** |
| k4: a kind lookup unhooked (`progressKind(refused)` outside the null check) | the L40 byte-identity row (`kindEntered()` +4 with no hook) and the source row |

## D3 — measure (PASS)

`tools/d3.sh`, `d3/rounds.jsonl`. Three interleaved rounds; L18 and L40; v1 (a detached worktree at `3f5c3ff0fd`) and
v2 (this tree); each unhooked and under the real tap at 100 ms; load average 0.6–1.3 on the 4-core box.

| solve · tree · hook | wall (3 rounds) | median | digest | `shouldStop` | final snapshot bytes per segment |
|---|---|---|---|---|---|
| L18 · v1 · none | 5.49 / 5.25 / 5.63 s | 5.49 s | `230dc0ff` | 165 | — |
| L18 · v2 · none | 5.52 / 5.51 / 5.78 s | 5.52 s | `230dc0ff` | 165 | — |
| L18 · v1 · tap 100 ms | 5.42 / 5.33 / 6.01 s | 5.42 s | `230dc0ff` | 165 | 2,021 · 2,203 · 2,008 |
| L18 · v2 · tap 100 ms | 6.00 / 5.40 / 5.93 s | 5.93 s | `230dc0ff` | 165 | **2,878 · 2,937 · 2,432** |
| L40 · v1 · none | 8.48 / 8.23 / 8.59 s | 8.48 s | `3addc379` | 167 | — |
| L40 · v2 · none | 8.53 / 8.09 / 8.67 s | 8.53 s | `3addc379` | 167 | — |
| L40 · v1 · tap 100 ms | 7.93 / 8.79 / 8.83 s | 8.79 s | `3addc379` | 167 | 3,038 |
| L40 · v2 · tap 100 ms | 8.01 / 8.30 / 8.45 s | 8.30 s | `3addc379` | 167 | **3,671** |

- The digest and `shouldStop` are identical in all 24 runs.
- Unhooked, v1 and v2 differ by 0.03–0.05 s, as they should: the code paths are the same.
- Under the tap, the medians move +0.5 s (L18) and −0.5 s (L40). Both are inside the round-to-round spread (~0.7 s), so
  no overhead is resolvable on this box.
- The snapshot grows by 430–860 bytes per segment. Most of that is the verbatim `lastWhy` (563, 440 and 164 characters
  on L18's three segments) plus `"rejectionKinds":{}` on each node.
- The kind tallies at 100 ms equal D2's (`d2/l18-100.json`, `d2/l40-100.json`): L18 seg 0/1 `pending` on five nodes and
  `exhausted` on the leaf, seg 2 `exhausted`; L40 `danger` / `bound` / `exhausted` on AVOID / TIME / BAIT. `lastWhy`:
  L18 seg 0 the `levelRun` sentence (`pending`, on `arm:press`), seg 1 the `PendingDeclaration` (`pending`, on
  `arm:press`), seg 2 the escape search (`exhausted`, on its leaf); L40 BAIT's no-stance (`exhausted`, on
  `rung:bait`).

## D4 — records (PASS)

| row | result |
|---|---|
| bot log | `seedling-bot-log.md`: `### Seedling hammer-phase RK — refusal kinds and the last why (solve-progress v2)` |
| schema doc | `seedling-solve-progress.md`: §2 is `v: 2` (the block, `rejectionKinds`, "Rejection kinds" with its table and the caveat on the investigation's kinds, `lastWhy`); §4 notes what v2 adds to the example; §5 has the "v1 → v2" table with the S3 stamps unchanged; §6 has the RK pins |
| surface / constants | `--check` GREEN 312 rows · 6,002 literals, 0 drift, so nothing to `--write` (no `solverBot` export changed; the one `solverBot.js` line adds a property read, not a literal) |
| reference | regenerated (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`: the two docs' word and line counts), then `--check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH; `generate-docs-index.mjs --check`: current (176 docs) |
| identity block AFTER | `d4/identity-d4.txt`, run at `8b4e7527` (D2's code): **byte-equal to W0**, every row; the six `--check`s exit 0 with the same md5s; reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 312 · 6,002 · 566 · 138 · 280 (= W0) |
| bounded vitest AFTER | 30 files: the W0 set, plus `solveProgressHeartbeat`, `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeIndexManifest` (`lintGateLabels` was already in the W0 set) (`d4/vitest-files-d4.txt`): **860 / 860** |
| not run (⚖ 52, the brief) | no unfiltered vitest, no `pytest`, no `standing-values --write`. The in-app row `seedling-js-runtime-solve-progress-view` is the harvest's to run (js-7's condition) |

## What the brief got wrong (measured)

1. **"Refusal kinds (… not-faster, leg-bound …)."** These are `planSwordDash`'s per-window rows
   (`solverBot.js:6207`, `:6231`), with `stalled`, `crossing`, `shake-room` and `unpriced-hit`. They never reach the
   progress tree: a window rejected inside a dash plan is not a node's rejection, and `planSwordDash` has no count
   point. They are not in the enum.
2. **"Deadline window / budget."** That is the JS arc's `limit.first`. The solver cannot tell the two apart. It sees
   `shouldStop` say yes, so the kind is `deadline`, and the first site that tripped is in the verbatim sentence.
3. **js-7's grant at `solveProgressTap.test.js:304`.** It was not needed. That assertion checks a synthetic `v: 1`
   passing through the tap, so v → 2 leaves it green, and the suggested change would have turned it red.
4. **"If a kind needs a field at a throw site in fidelity's files: STOP."** None does. The one structural field the
   committed solves need, `levelRun`'s `undeclaredKillLock`, is already on the throw.
5. **"`lastWhy` … equals the thrown `why`."** It holds, but it is subtler than it reads: `withSolveDeadline` appends its
   `⏱ DEADLINE` clause to a refusal after the error has left the inner frames. So the inner nodes tally the room's
   words, and only the outer leaves (and `lastWhy`, which re-reads at each frame) see the clause. The deadline-clause
   gate row is a unit row because no committed solve raises a non-deadline refusal after a trip.
6. **The six `--check`s.** Campaign's md5 is `3d41b9fb` at this base, not HB's `6b1bf15c`: the statueTalkRange and
   dash flips landed in between. That is a moved baseline, not a red one; the AFTER equals it.
7. **The branch.** The brief's `seedling-hammer-refusal-kinds`; this harness designates
   `claude/seedling-refusal-kinds-z6gmg9`.

## Residue

1. **The static `other` residue**, 75 sites (`d1/static-residue.txt`), plus 41 wrappers whose kind is their inner
   sentence's. A solve that meets one tallies `other`. The gate row holds `other` at 0 only on the four committed gate
   solves, and the six producers' census is 0 as well. A future slice can name more families (the encounter and
   ceremony executors, the teleporter's `inside-solid` / `closed`, the ordering search) or ask fidelity for a `kind`
   field at those throws.
2. **The fidelity-switch rungs have no real-solve row.** They are classified from their sites' own sentences and fields,
   ON and OFF. When fidelity's seal flip lands, a solve with `sealDoorApproach` ON that reaches the door is owed: its
   clear-tag `unresolved` and the predicate sentence, through the real tree.
3. **Text before `error`.** A thrown non-refusal whose words match a rule takes that rule's kind (the planner's *"no
   walkable tile path"*, thrown as an `Error`, is `exhausted`). The class name is not in `lastWhy`. If the view wants
   it, `lastWhy.name` is a one-field v2 addition.
4. **The window kinds.** If the view wants `not-faster` / `leg-bound`, they are in the dash plan (`out.dashes`, the
   rows `planSwordDash` keeps), not in the tree. Moving them into the tree would need a count point inside
   `planSwordDash`, which the schema's §3 rule forbids today.
5. **At harvest, not run here:** the in-app row `seedling-js-runtime-solve-progress-view` green in test-templates at
   the tip (js-7's condition), and the CI vitest suite at the pushed SHA (⚖ 52).
6. **Scratch worktrees.** `/home/user/rk-wt` (branch `rk-dev`) and `/home/user/rk-base` (detached at `3f5c3ff0fd`)
   were created for development and D3's v1 arm. Both are removed at the end, by name.
