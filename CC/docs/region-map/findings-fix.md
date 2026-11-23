# Region view findings: the Exits sort fix, and the measured no-fixes

Slice `region-view-findings`, cut at `ad56c5aaa9` (origin/main; `git merge-base HEAD origin/main` =
`ad56c5aaa97fe32b27014625aaf5a95314f07aac`). It picks up the findings `dedup.md` § "Left alone … findings" left for
later.

⚖ Ruling (session 84c8ab35, archipelago-cc-23), **2026-11-22T21:37:37.942Z**, on the dedup findings: *"Small fix
slice after zoom (Recommended)"*. The option read: *"After the zoom/edge-lines slice lands, one slice fixes the Exits
sort, measures whether the app ever produces the inputs the smaller differences disagree on, and fixes those only if
it does. The fixes are visible behaviour changes, each with a test."*

## What changed, as the user sees it

**One change.** In the Exits panel, **"Sort by Accessibility (Original)"** now lists the traversable exits first. Then
come "To Locked Region", "Rule Fails", "From Locked Region, Rule OK" and "Fully Locked", each group in the preset's
original order. Before the fix, this sort treated every region as locked, so it split the exits only on their own
rule. Each traversable exit sat in original order among the "From Locked Region, Rule OK" exits (and any "To Locked
Region" ones). "Rule Fails" exits sat among the "Fully Locked" ones.

- The cards themselves (their colour, status line and region links) do not change: they already read
  `isRegionReachable`. Only their order changes, and only under this one sort.
- Every other sort, and the Locations and Regions panels, are byte-identical (below).
- **How it now differs from "Sort by Accessibility (Name)":** only in the order *inside* a status group. "(Original)"
  keeps the preset's order there, "(Name)" sorts by name. They are not identical. Over the generated space, with
  names given in original order, the two orders are equal (450 of 450 exits). On alttp S1 the two traversable exits
  of the vitest's cut come out in opposite order. Both options stay as they are (removing or merging one is the
  user's call).
- Example, alttp seed 1 at the initial load, five real exits:
  - BEFORE: Links House S&Q · Death Mountain Entrance Drop · Hyrule Castle Secret Entrance Exit · Old Man S&Q · Lake
    Hylia Central Island Teleporter.
  - AFTER: Links House S&Q · Hyrule Castle Secret Entrance Exit · Old Man S&Q · Death Mountain Entrance Drop · Lake
    Hylia Central Island Teleporter.

  The real page shows exactly this relative order, before and after.

No in-app row or tutorial walk reads either accessibility sort's order (below), so no row was re-pointed.

## Step 1: what the inputs actually hold (the counts)

Instrument: `scripts/dev/region-panels-dom-snapshot.mjs`, the dedup slice's real-snapshot harness, with a new in-page
census, `FINDINGS_FN` → `findings.json`. It runs over the D0 presets (`seedling_playthrough`, `alttp`,
`procgen_topdown`) at S1–S7:
- S1: the initial load.
- S2: 3 checks + one move.
- S3: discovery on.
- S4: the show-undiscovered boxes unticked.
- S5: Loop mode on.
- S6: Loop mode + discovery, partly discovered.
- S7: a fresh page.

Per state it counts:
- `snapshot.regionReachability[name]`, for every region name the preset uses (regions, exit targets and location
  parents; a name with no entry counts as *missing*);
- what `evaluateRule` returns for every location rule and every exit rule.

BEFORE and AFTER produce the same `findings.json`.

| Preset | States | names | `'reachable'` | `'unreachable'` | `true` | `false` | `'checked'` | missing | other |
|---|---|---|---|---|---|---|---|---|---|
| seedling_playthrough | S1, S7 | 307 | 20 | 287 | 0 | 0 | 0 | 0 | 0 |
| seedling_playthrough | S2–S6 | 307 | 40 | 267 | 0 | 0 | 0 | 0 | 0 |
| alttp | S1–S7 | 239 | 49 | 190 | 0 | 0 | 0 | 0 | 0 |
| procgen_topdown | S1, S7 | 10 | 2 | 8 | 0 | 0 | 0 | 0 | 0 |
| procgen_topdown | S2–S6 | 10 | 3 | 7 | 0 | 0 | 0 | 0 | 0 |

| Preset | States | location rules `true` / `false` / `undefined` | exit rules `true` / `false` | throw | non-boolean truthy |
|---|---|---|---|---|---|
| seedling_playthrough | S1, S7 | 45 / 44 / 0 | 265 / 901 | 0 | **0** |
| seedling_playthrough | S2–S6 | 62 / 27 / 0 | 399 / 767 | 0 | **0** |
| alttp | S1–S7 | 70 / 195 / 3 | 214 / 177 | 0 | **0** |
| procgen_topdown | S1, S7 | 21 / 4 / 0 | 9 / 8 | 0 | **0** |
| procgen_topdown | S2–S6 | 21 / 4 / 0 | 10 / 7 | 0 | **0** |

(Every location and exit in these presets has a rule; `null` and falsy non-booleans: 0.)

The producer agrees with the counts: `stateManager/core/statePersistence.js` (`:163-169`, `:702-704`, `:731-733`)
writes only `'reachable'` and `'unreachable'`.

## Each finding: fix or no fix

| Finding | Input it disagrees on | Occurs? | Decision |
|---|---|---|---|
| `exits/exitUI.js` `accessibility_original` sort (`=== true \|\| === 'checked'`) | `'reachable'` | **yes**: every reachable region, every state | **FIXED**: both sides (A and B) now call `isRegionReachable` |
| `locations/locationUI.js`'s two-value region test, ×6 (`'reachable' \|\| 'checked'`, no `true`) | `true` | **no**: 0 in 21 preset-states | **No change: unreachable input.** The region/rule split stays as it is |
| `locations/locationUI.js` location evaluation (strict `=== true` vs `locationState`'s truthiness) | a non-boolean truthy rule result | **no**: 0. `undefined` occurs (alttp, 3 locations), and both tests read it as not met | **No change: unreachable input** |
| `regions/regionBlockBuilder.js:994-1009` (`ruleMet`, `=== true`, vs truthiness) | a non-boolean truthy rule result | **no**: 0 | **No change: unreachable input** |

## Proof

### The vitest: `exits/exitUI.accessibilityOriginalSort.test.js` (4 rows)
It drives the real `ExitUI.prototype.updateExitDisplay` (the sort and the card loop) against a permissive fake DOM,
and reads the order back off the cards' `data-exit`.
1. **The alttp S1 cut.** Five real exits (original indexes 0, 2, 70, 72, 73), with the live `regionReachability`
   values and rule results. The AFTER order is pinned. **It fails at base.** Run against a copy of the base
   `exitUI.js`, it received the BEFORE order quoted above.
2. **The tie-break.** The same cut under "Accessibility (Name)": only the two traversable exits swap places.
3. **The generated space.** The dedup equivalence space's 15 values (`true`, `false`, `'reachable'`, `'checked'`, …,
   `{}`, `[]`) × parent × connected × rule pass/fail = 450 exits. The fixed sort's order equals the `accessibility`
   sort's, 450 of 450. **It fails at base.**
4. **The one intended difference, named and counted.** BEFORE (the dedup's verbatim `exitSortOriginalA` testkit copy)
   against AFTER (`isRegionReachable`): **32 of the 450 exits change status, and every one goes through a
   `'reachable'` region.** All other 418 are unchanged.
   - 17 of the 32 have a passing rule: the parent is `'reachable'` (15), or the parent is `true`/`'checked'` and the
     connected region is `'reachable'` (2).
   - The other 15 have a failing rule and a `'reachable'` parent.

The dedup's `regionView/reachabilityCopies.equivalence.test.js` still passes unchanged. Its BEFORE oracles are the
base copies, so they were not re-recorded.

### DOM: the Exits, Locations and Regions panels, before and after
3 presets × 7 states × every sort (Regions also in Show All + Expand All), with Loop mode on (S5, S6) and partial
discovery (S3, S4, S6). That makes 336 captures.
- `digests.json`: BEFORE `91e6dbc74149a7413dbdf1c821230079bd5385bc79671922d9c5cf8319448acc`. That equals the dedup
  slice's recorded AFTER digest byte for byte, so the instrument reproduces. AFTER
  `3674590dd54909ec39e8b1c5e7992721bc408a7e98d80913172a38ac27e7da68`.
- Per panel (sha256 over the sorted `preset|state|capture|sha256` lines):

  | Panel | moved | BEFORE | AFTER |
  |---|---|---|---|
  | Locations | **0 of 84** | `5f42bfa5…fdcc833` | `5f42bfa5…fdcc833` |
  | Exits | **12 of 84** | `ec3d36dd…a3c8c70` | `e660f3fd…a2b447` |
  | Regions | **0 of 168** | `4e668595…be538d2` | `4e668595…be538d2` |

  The Locations and Exits BEFORE digests equal `dedup.md`'s. Its Regions figure (189) also counted the
  expand-button entries.
- Every other capture is byte-identical, 315 of 315. Their combined digest is `b02afd25…0277de1` both sides.
- **The 12 moved captures, all of them `exits-sort-accessibility_original`:**

  | Preset | States | cards | rows moved per capture |
  |---|---|---|---|
  | seedling_playthrough | S1, S7 | 1,166 | 337 |
  | seedling_playthrough | S2, S5 | 1,166 | 1,097 |
  | alttp | S1, S2, S5, S7 | 391 | 198 |
  | procgen_topdown | S1, S2, S5, S7 | 17 | 15 |

  Each is attributed to the one fix site, and checked:
  1. The same multiset of card HTML, byte for byte: only the order moved.
  2. AFTER is sorted by (status rank, original index).
  3. BEFORE is exactly (rule passes first, then original index), which is what "every region locked" predicts.
- **Why S3, S4 and S6 did not move.** With discovery on, the panel shows only the discovered exits: 1 to 3 of them.
  Their relative order agrees under both versions. For example, alttp S3 shows 2 traversable exits and 1 "Rule
  Fails"; BEFORE that is rule-OK, rule-OK, rule-fails, the same sequence.
- Real-snapshot oracle (the dedup's 17 replaced copies), BEFORE and AFTER: seedling_playthrough 54,306 rows,
  alttp 27,846, procgen_topdown 1,344. **0 mismatches.**

### Tests that read the order
`git grep -a` over `frontend/modules/tests/`, `frontend/modules/tutorials/` and `frontend/test-configs/`, for the
sort selects (`#exit-sort-select`, `#sort-select`, `#region-sort-select`), `accessibility_original` and the card
classes:
- `test_exit_panel_basic`, `test_location_panel_basic` and `test_region_panel_basic` only check that the select
  exists and that cards render.
- `test_library_exit_accessibility`, `test_library_location_accessibility` and the two
  `test_library_region_accessibility_*` rows find their card by name and read its status class. Status is unchanged.
- The tracker tutorial `trackAGame.js` finds its exit card by name text. It never sets a sort.
- No row or walk selects either accessibility sort. **None was re-pointed.** All six panel rows PASSED in the local
  `test-regression` run (60/60) and in TT's regression job. No `batch=tutorials` dispatch is owed: no walk reads the
  Exits or Locations sort.

### Gates
The code tip is `d32ac33915`. origin/main had not moved from `ad56c5aaa9` (an ancestor), so no merge was needed and
the gate SHA is the tip. Each run below is at headSha `d32ac33915fe560ce466ad6e60719e2a75e03cad`.

| Run | What | Result |
|---|---|---|
| 45097618756 | JavaScript Unit Tests (push) | success, every job. Default tier 1,420 files / 29,826 tests vs base run 45084612582 at `ad56c5aaa9` (1,419 / 29,822): **+F 1, +T 4**, the new file's 4 rows. Slow tier 37 / 446 both sides. 0 failed |
| 45097618750 | unittests (push) | success |
| 45097625158 | TT, `test-templates.yml` (dispatch) | success, all 9 jobs. Regression 60/60 |

- **Headroom:**
  - fast 319.5 s of 600 (53%); main `ad56c5aaa9` (run 45093186107) 316.5 s: **+3.0 s**.
  - fast-bundled 336.7 s (56%); main 322.0 s: **+14.7 s**.
  - Both are under the 70% / +20 s stop.
- **Closure:** `seedlingDerivedRuleTable.js --print-engine-closure` engineMd5 `74ae60f575531492ed9eaec1839e1fe3`
  (42 files) at base and at the tip. Closure ∩ diff = ∅. 0 gitlinks.
- **Bounded vitest** (⚖ 52), at the tip: `regionView/`, `exits/`, `locations/`, `regions/`, `commonUI/` (16 files,
  181 tests), plus `moduleImportOrder` and `quickLaunchImportOrder` (2 files, 65 tests). All green. No other test
  imports `exitUI.js`.
- **Local `npm test -- --mode=test-regression`:** 60/60.

## What was left, and why

- **Locations' two-value region test (×6), its location evaluation, and `regionBlockBuilder`'s `ruleMet`.** Each one
  disagrees with the helpers only on an input the app never produces (counts above). Changing them would change no
  visible behaviour today, and it would break Locations' region/rule split. If a producer ever starts writing `true`
  or a non-boolean rule result, `FINDINGS_FN` is the instrument that shows it.
- **Not surveyed for identity** (as briefed; listed only). Each one's test includes `'reachable'`, so none has the
  Exits defect:
  - `loops/loopBlockBuilder.js:244-247`, `:867-871`;
  - `pathAnalyzer/pathAnalyzerLogic.js:116-118`, `:380-389`, `:579-581`, and `pathAnalyzerUI.js:744-746`;
  - `spoilerChecklist/spoilerChecklistUI.js:854-857`;
  - `spoilerTest/analysisReporter.js:114`, `:140-141`, `comparisonEngine.js:88` (`'reachable'` only), `:164-167`,
    `:441`, and `eventProcessor.js:842-845`;
  - `stateManager/core/workerSpoilerTest.js:505-506`, `:582` (`'reachable'` only), `stateManager/index.js:576`,
    `:588`, and `stateManager/stateManagerWorker.js:1591-1593`.
- The Region Graph's class read-backs (D2), and `regionMap/`: out of scope.
- The two accessibility sorts now differ only in their tie-break. Whether to keep both is the user's call.
