# SEEDLING FIDELITY — FRONTIER2: the campaign frontier reports BOTH route-only and full-route coverage

Session `seedling-fidelity-frontier2` (Opus, cloud), planner `seedling-fidelity-planning-2`.

| | |
|---|---|
| start SHA | `f90c4eee46418cacbd40f9eac321859b4e68936c` (origin/main at checkout; 3 commits past the planner's `d3b1b5d01b`, incl. the rules recompile `d46b727`) |
| head | `the commit that adds this report (child of `69dca227`)` |
| harness branch | `claude/frontier-route-modes-7oj1au` |
| commits | D1 `fb4057e5` · D2 `e4d570c1` · D3 ``69dca227` (the log entry, the docs index) + this report` (this report + the log entry) |
| verdicts | **D1 PASS · D2 PASS · D3 PASS** |

## The one thing to know first

**"Route-only" needed TWO things, not one.** Keeping only the progression pickups (the brief's definition) gives the
old five pickups exactly, but over today's rules the route still left the chain at step 27: AP's `CanReachRegion` is
global, so from L29 the derivation took L22's teleporter into L30's north pocket and through the `r0c4 → r2c10` boss
lock from the near side. The game opens that lock only for a player who went round to its far side. Route-only is
therefore also **walked**: `CanReachRegion(X)` holds once an earlier leg stood in X. With both, the route-only route
is the chain's room sequence step for step (30/30, complete). `full` is unchanged (AP's reading) and is still the
default, so the rules arc's `--through=end` is byte-inert (stdout md5-identical; `route.json` gains one key).

## W0 (at `f90c4ee`, primary tree, `SEEDLING_PORT=9350`)

| row | command | result |
|---|---|---|
| identity block | `bash scripts/procgen/identity-block.sh .` (venv active), my 8 changed files copied aside and restored to `f90c4ee` content for the run | log md5 **`5bf108151ad7a075428d0ff20f15240e`** |
| six `--check`s | the block's producer loop | `405d9c4b…` · `8e7a43be…` · `33d20889…` · `35456fbc…` · `6cd35fe1…` · `56bb3724fd0ed3dda184e6e7d6d5d27c`, **all exit 0** (the first five = ROBUST's bank; `r9-campaign` has moved since then, before this slice) |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / profile / entities | `--check` each | **GREEN 198** · **PASS 4,968** · **PASS 138** (both JSONs) · **PASS 518**. Surface json `9f2a96dd7d6d17ba277f3e05f4f9cd4f` |
| roster | `fixtures/tapes/index.json` `tapes` | **222** |
| bounded vitest BEFORE | `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `addEquips`, `director`, `solverEncounter` (the three other readers of the frontier/survey), `boxLock`, `boxLockCommit`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface`, `surveyRoute`, `surveyFamily`, `surveyGrants`, `rerecordCampaign` (base content, copy + restore) | **26 files / 874 tests, all green** |
| tapeRunner | (fullName, status) pairs, sorted, `name\tstatus\n` | **501/501**, md5 `51829dac294c79fba6ed687124fdaf96` (no tape or runner input moves in this slice) |
| `check-procgen-help` | (runs in a throwaway worktree at HEAD `f90c4ee`) | **25 CHECK(S) FAILED**, all `IMPORT SIDE EFFECT` / `HELP SIDE EFFECT` rows on 25 `census-*`/`plan-*`/`probe-*`/`measure-*`/`migrate-*` scripts, none of them touched here (list in Residue) |
| `--check-frontier` | `census-seedling-campaign.mjs --check-frontier` | **FAIL `sources`** (rules `c48453…` → `2df805…`, sphere order `03f215…` → `f62307…`); chain/segments/arrivals PASS — the planner's finding, reproduced |

## D1: two route modes in the survey (PASS, `fb4057e5`)

**Measured first.**
- The old survey (`a261ef7fd9^`) did not derive its pickups: it TYPED three regexes (+ two under `--through=2.2`)
  and asserted each against the sphere order's item. The brief's "derived from the sphere order, not typed" is a
  requirement on the new code, not a description of the old.
- The sphere labels moved under the typed bound: `70d9a87c` (35 locations re-sphered) made L32's Bob Boss **3.1**;
  **2.2** is now L25's Seal chest.
- Rule census over the playthrough's `AP_1_rules.json` (`Has` by item@count): every key is asked at count 1
  (`Red Key@1` ×4, `Green Key@1` ×8, `Fire@1` ×42, …); `Seal` is asked only as `@16` (×2, the L113 → L115 seal
  door), `Totem Shard` only as `@5` (×1, the Wand), and `Light`, `Health`, `The Seed` by no rule.
- A pure necessity derivation (minimal subset of rows that still derives) through 3.1 gives sword → Red Key →
  Green Key → Fire: it drops the **Shield**, which the old route carried. Not the old definition, so not used.
- Keys alone through 3.1 = sword (0.1) → Red Key (1.1) → Shield (2.1) → Green Key (2.3) → Fire (3.1), the old five.
  Their derived legs over today's rules: `29>22>30>32` for the last one. Same on the rules at `d3b1b5d01b` and at
  `70d9a87c^` (scratch copies), so the turn is not the recompile. It is `level_30__r0c4 → level_30__r2c10`:
  `And(CanReachRegion(level_30__r2c10), Has(Green Key))`, true under AP's start-anchored reading because r2c10 is
  reachable from the start via L31. The chain went `29>31>30>32`. **Keys alone cover 26, not 30.**
- A walk reading (`CanReachRegion(X)` iff an earlier leg stood in X), scratch: all five legs equal the chain's rooms.

**The change.**
- `surveyRoute.js`:
  - `ROUTE_MODES = ['full', 'route-only']`.
  - `keyItemsOf(rules)`: the items any exit/location rule asks for by a single-copy `Has`.
  - `routeOnlyRows(rows, keys, bound)`: the rows granting a key, plus the bound; `skipped` names every other row.
  - `makeRuleHolds`' decider takes an optional third argument `stood` (a Set): `CanReachRegion(X)` is
    `stood.has(X)`. The verdict cache keys on the Set's identity.
  - `deriveLegs({walk})`: each leg is decided with the regions the earlier legs stood in (the start counts), and
    returns `legHolds[i]`, so the survey's alternatives for leg i ask the same decider.
  - `chainBound(order, segments)`: the bound is the sphere row the chain's terminal segment ends on (room + the
    `encounter`/`item` it carries away), refused by name when the tail is not terminal or the row is not unique.
- `survey-seedling-route.mjs`:
  - `--route=full|route-only`, default `full`. `route-only` needs `--through`.
  - The mode is named in `route.json` as `routeMode {mode, through, definition, keyItems?, skipped?}`, under
    `--through` only.
  - Step children get `--route=`. `spare` is filtered the same way as the bounded rows.
- `seedlingSurveyDir.throughSurveyDir(repo, through, mode)` spells `through-<s>` (full, as before) and
  `through-<s>-route-only`.

**Witness.** Route-only through 3.1 (survey `--timeout=1500`): 30 steps, `crossesTo`
`2,3,…,11,3,2,0,13,14,15,16,18,19,20,13,0,12,21,22,29,31,30,32,∅`. That is the chain's arrival list, and
**30/30 SOLVE**. Skipped and named: `0.2/0.3/0.4/1.2/2.2:Seal`, `2.4:Light`. Full through 3.1: 60 steps,
**48/60 SOLVE**, 12 refused (all after step 18).

**Mutants** (predicted, then made by copy + restore, md5 restored `b8da048f…`):

| mutant | predicted | measured |
|---|---|---|
| M1 `keyItemsOf` counts any `Has` (Seal@16 is a key) | 2 red: the key set, the route-only rows | **2 red**, those two |
| M2 `deriveLegs` ignores `walk` | 1 red: the one-way-lock walk row | **1 red**, that row |
| M3 `chainBound` drops the level filter | 2 red: both `chainBound` rows | **2 red**, both |

## D2: the frontier reports both (PASS, `e4d570c1`)

**The change.**
- `census-seedling-campaign.mjs`:
  - The bound is `chainBound` (`3.1`), not `through-2.2`.
  - Each mode is read from its own `throughSurveyDir`. A `route.json` whose `routeMode` names another mode or bound
    is refused, not aligned against.
  - `campaign-frontier.json` gains `coverage: {'route-only', full}`. Each block holds the mode, the bound, the survey
    directory name, `routeSteps`, and that mode's `deriveFrontier` answer.
  - The top level stays the route-only answer and keeps its shape, so the page, the reference, the editor sequence
    and `--grow` read it unchanged.
  - An alignment break is now FIELDS: `lastArrival`, `nextStep` (the route step the chain did not take), its survey
    `refusal`, and `divergence {segment, arrives, routeStep, routeCrossesTo}`. The sentence was reworded: it used to
    say "no stop this alignment can name", and that is no longer true.
- `--check-frontier`:
  - per mode, an identity row (needs no survey);
  - an answer row, compared whole, or SKIPPED by name when that mode's survey is absent.
  - The complete route-only answer is now actually compared. The top-level rows SKIP whenever `nextStep` is null,
    which a complete frontier always is.
- `campaignChain.test`:
  - the tail follows `coverage['route-only']` (it equals the top level; `covered` = the chain's length =
    `routeSteps`);
  - a second row pins the full route's stop as a RELATION over the artifact (`divergence.segment` = the chain's own
    segment at `covered`, `arrives` = the measured arrival, `nextStep.step` = `covered + 1`, …), not a literal;
  - a third row covers the reference printing both lines.
- `reference/campaignChain.mjs` prints `COVERAGE, BY ROUTE MODE`.
- `rerecord --grow` reads the route-only survey through the artifact's bound, never a typed label.

**Re-derived at `f90c4ee`** (`--write-frontier` → md5 `b34d0ab4b95a2aa98719fe18f5080de4`, was `7c327927…`):

| mode | through | covered / steps | answer |
|---|---|---|---|
| route-only (top level) | 3.1 | **30 / 30** | **COMPLETE**, last arrival step 30 L30 `r9-solve-32` |
| full | 3.1 | **17 / 60** | `r9-solve-16` arrives in **L18**; route step **18** (L16, `stairsdown@112,64`) crosses to **L17**. The survey SOLVES that step (`refusal: null`) |

`--check-frontier`: **8 pass, 0 fail**.

**Mutants:**

| mutant | predicted | measured |
|---|---|---|
| MC1 data: `coverage.full.covered` 17 → 18 | check: exactly `coverage.full (answer)` FAIL; vitest: the full-stop row red | **as predicted** (7 pass 1 fail; that row red) |
| MC2 code: the top level read from the FULL survey | check: 3 FAIL (`lastArrival`, `nextStep`, `refusal`) | **2 FAIL** — `refusal` is null on both sides, so it matched. Prediction missed one detail |

A self-inflicted red on the way: the reference's new `v.coverage.length` threw for the three existing markdown rows,
whose fake view has no `coverage` (3 red). Fixed with `(v.coverage ?? [])` before the commit.

## D3: records (PASS)

- The frontier is written; `--check-frontier` PASS (8/8).
- **No tape moves.** No fixture under `fixtures/tapes/` or `fixtures/traces/` is touched; tapeRunner pairs
  unchanged; the identity block's six `--check`s are identical.
- The `seedling-bot-log.md` entry (`69dca227`), with two trap candidates. The generated `campaign-chain` region,
  `instruments.js` (`--route`) and the docs index are regenerated; `generate-procgen-reference.mjs --check` MATCH,
  `check-procgen-docs` ALL PASS.
- `rerecord-seedling-campaign --grow --to=S0`: it reads `through-3.1-route-only` through the artifact's bound and
  refuses *THE ROUTE ENDS HERE* (exit 0, nothing written). That is the correct answer for a complete route.
- Surface/constants/profile/entities: `--check` unchanged (no new surface, so no `--write` was owed).
- No new box-taking instrument (`boxLock` row n/a).

**The rules arc, told:** its `--through=end` calls are **not affected in what they derive**:
- `full` is the default;
- the cache directory is still `through-end/`;
- stdout is md5-identical (`2d001a0dea94de114001a6465ee60d16`, base and head);
- `route.json` is identical except the added top-level `routeMode` key (`4e9bda17…` → `892b2b2f…`; with the key
  deleted, JSON-equal);
- step children now also receive `--route=full`, which they parse as the default.

If any of its code compares `route.json` bytes, re-bank the md5; nothing else moves.

## The JS arc's pins that move

**None.** No `jsRuntime*`, `flashPanel/*`, `wasmArrival`, `wasmWalkTape`, solver worker, or `solveSegment` /
`twoPassSolve` / `PendingDeclaration` / `createRunForStaging` change; no new staging or result field. Nothing to wire.

## Deltas

| row | before | after |
|---|---|---|
| `campaign-frontier.json` | `7c32792707afa21840a9f0b4fc9fcb53`, `sources` stale, no `coverage` | `b34d0ab4b95a2aa98719fe18f5080de4`, `sources` current, two blocks |
| `--check-frontier` | 3 pass 1 fail (+SKIP) | 8 pass 0 fail (+SKIP of the top-level nextStep trio, now covered by the route-only answer row) |
| bounded vitest | 26 / 874 | 26 / **884** (+7 `surveyRoute`, +3 `campaignChain`) |
| identity block | `5bf108151ad7a075428d0ff20f15240e` | **`5bf108151ad7a075428d0ff20f15240e`**, byte-identical (at `e4d570c1`) |
| `check-procgen-help` | 25 FAILED | **25 FAILED, the same 25 scripts** (at `e4d570c1`); `survey-seedling-route`, `census-seedling-campaign` and `rerecord-seedling-campaign` PASS (HELP ok, IMPORT SIDE EFFECT known) |
| instruments.js | — | `survey-seedling-route.mjs` gains the `route` flag row |
| seedling-bot-log `campaign-chain` region | ROUTE COMPLETE (sphere 2.2) | ROUTE COMPLETE (sphere 3.1) + the two coverage lines |

## What the brief got wrong (measured)

1. **"Route-only (the progression pickups, as the old survey derived them) → expected covered 30."** Picking the
   progression pickups is not enough. Over today's rules those five legs cover **26**: leg 3.1 takes `29>22>30>32`
   through a one-way lock that RULES (A) spells as `CanReachRegion(far side) ∧ key` from the near side. The same
   happens on the rules at `d3b1b5d01b` and at `70d9a87c^`. 30 needs the walk reading (D1).
2. **"The sphere order itself did not change for these rows."** The labels did. `70d9a87c` re-sphered 35
   locations: Red Key 1.2 → 1.1, Green Key 1.4 → 2.3, Bob Boss 2.2 → 3.1. So `--through=2.2` now ends at L25's
   Seal chest. The ORDER of the five progression rows is unchanged. The planner's full-mode `covered 17` holds
   because the divergence (step 18) comes before 2.2's end; at 3.1 it is still 17.
3. **"Which pickups, derived from the sphere order, not typed" as a reading of the old survey.** The old survey
   typed them (regexes, item asserted). The derivation is new here (`keyItemsOf`).
4. **The reproduction recipe's bound.** `--through=2.2` is the wrong bound at main. The census now reads it off the
   chain (`chainBound` → 3.1), so the next label move cannot strand it.

## Residue

- **Route-only to `end` is not a goal of this mode.** The Wand (6.1) needs `Totem Shard@5` and the L115 door
  needs `Seal@16`, and route-only skips both pools. Past where a counted pool gates, the route-only derivation would
  walk to a location whose rule does not hold (with `spare: []` it does check location rules and would refuse by
  name). Named here, not handled.
- **The walk's bound:** `stood` is what EARLIER legs walked. A leg's own BFS does not count regions it passes
  through as stood. No seed-1 leg needs it.
- **The page shows the top level only** (`watchViewer.js` prints `nextStep`/`complete`/`why`). The `coverage` blocks
  are in the artifact, the census report and the generated reference, not on the watch page. Wiring them there is a
  page decision outside this slice's region.
- **The full route's 12 refusals** (for whoever chains the Seal legs): steps 20 L16, 21 L15, 33 L18, 34 L16, 35 L15,
  42 L0 and 48 L19 (unclassified); 40 L36 (LADDER); 55 L25 (VERB-MISSING); 56 L22 (unclassified); 57 L29
  (VERB-APPLY, `skirt`); 59 L30 (unclassified: no corridor to a stance for `torchpickup@64,64`).
- **`check-procgen-help`'s 25 pre-existing FAILs** (at base and head alike): `census-seedling-atlas-doors`,
  `-bosslocks`, `-solver-surface`, `measure-seedling-solver-surface`, `migrate-per-player-blocks`,
  `plan-seedling-r1-dark-suit`, `-r2-singles`, `-r2-wallflyer`, `-r3-death`, `-r4`, `-u10-puncher-dwell`,
  `-u11-dark-shield`, `-u11-facing`, `-u12-pull`, `-u14-moonrock`, `-u15-turret`, `-u7-puncher`,
  `-u9-shield-bump`, `probe-seedling-hold`, `-r1-suit-census`, `-r2-census`, `-u11-wall5`,
  `-u15-turret-mobiles`, `-u7-puncher-mobiles`, `-u9-shield-mobiles`. None is touched here.
- **The survey's L12 step is slow:** 10+ minutes per run under load (steps 24 and 52), inside the 1500 s bound.

## Byte-inertia

- Survey stdout md5, base vs head:
  - default `--derive-only` `e1775cfa…`;
  - `--through=end` `2d001a0d…`;
  - `--through=3.1` `2fe6cab9…`.
  All identical. The default `route.json` is identical (`cd483d69…`). The `--through` `route.json` differs only by
  the added `routeMode` key (JSON-equal with it removed).
- Identity block: the log is byte-identical, base vs head (`5bf108151ad7a075428d0ff20f15240e`), all six `--check`s with it
- No AS3, wasm, gitlink or rules edit; no `standing-values --write`, no `pytest`, no unfiltered vitest.

## Rows to BANK

- `campaign-frontier.json` md5 `b34d0ab4b95a2aa98719fe18f5080de4`.
  - Route-only through 3.1: **30/30 COMPLETE**.
  - Full through 3.1: **17/60**, next step 18 (L16 → L17); the survey has 48/60 SOLVE.
- `--check-frontier` **8/8 PASS**.
- Bounded vitest **26 files / 884 tests**.
- Identity block **`5bf108151ad7a075428d0ff20f15240e`**, byte-identical (at `e4d570c1`); six `--check`s as W0.
- tapeRunner **501/501** `51829dac294c79fba6ed687124fdaf96`.
- Surface GREEN 198 `9f2a96dd7d6d17ba277f3e05f4f9cd4f` · constants PASS 4,968 · profile 138 · entities 518 · roster 222.
- `check-procgen-help` **25 FAILED, the same 25 scripts** (at `e4d570c1`); `survey-seedling-route`, `census-seedling-campaign` and `rerecord-seedling-campaign` PASS (HELP ok, IMPORT SIDE EFFECT known).
