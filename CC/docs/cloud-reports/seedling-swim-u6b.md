# Seedling swim U6b: the seven-tape L18 re-record on U6's branch, rebased over main; the full-tier profile witness

**Slice:** `seedling-swim-u6b`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15.11), under ⚖ Q36 (2026-10-01), the licence for the seven tapes.

| | |
|---|---|
| U6's head | `c744272` (`6d69f8f` + the report commit), branch `claude/seedling-swim-u6-00w74g` |
| main | `0a8771ad8d` (still main's head when this report was written) |
| Rebased U6 head | `af32af2` (U6's six commits: `e4ce750` `5156d30` `87b44c8` `4152028` `c675436` `af32af2`) |
| Head before this report | `f17648b` |
| Harness branch | `claude/seedling-swim-u6b-rebase-iwk8oj` (the harness pins it; the brief's `seedling-swim-u6b` name was not used) |
| Commits | D1 prep `a25c308` `c0aa940` · D1 `f4029ee` `db96a9b` · D2 `1e0478e` `25e5aa3` `1b4849d` `c24595b` · D3 `f36294d` `457c59a` · D4 `0ae8013` · D5 `f17648b` · this report |
| Parallel siblings | U9 and U10 on main. I touched none of their regions: no `chasers.js`, `enemyDamage.js`, `levelRun.js` chaser/forecast code, `deriveKillByChaser`, `chaserDanger` or `refuseDanger`. No solver or simulation file was edited at all. |

## Headline

| D | Verdict | One line |
|---|---|---|
| Rebase | **PASS** | 2 of 6 commits conflicted, and all conflicts were resolved by the brief's rules. The re-pinned rows auto-merged and are green at the rebased head. |
| W0 | **PASS** | The three L18-bearing `--check`s are red at **U6's own D3 digests**. The other three are at main's. The twelve: 12/12 post, 6/12 pre. Census NO CHAIN ROOM MOVES at 5713. `tapeRunner` **371/371 green, not red** (see "brief wrong" 1). |
| D1 | **PASS** | `r8-solve-18` **522 t**, the `r8-d2` headline **1828 t**, `r9-solve-18` **455 t**, chain **5774 t**. All five predictions exact. The fixtures diff names exactly the seven tapes and their three moved traces. |
| D2 | **PASS** | All seven recorded headless and agree per tick: observations = ticks + 1, the model reproduces each, 0 FAIL. `tapeRunner` 371/371. All six `--check`s exit 0, three at new md5s. Census NO CHAIN ROOM MOVES at 5774. |
| D3 | **PASS** | The full tier is 135 keys over 157 tapes: **75 moves / 60 blind**, **1787 s** (predicted ~1790). `--check` also named the fast JSON (127 keys on main), so I re-measured it: 64 / 71, 334 s. Both PASS. |
| D4 | **PASS** | Corridor body **143 / 122** and roam **10/8 both palettes**, both = U6's head exactly. The corridor pin s8 holds by its own rule. Two more rows pinned the old L18 walk and are re-pinned. |
| D5 | **PASS** | Log section updated, reference regenerated, surface GREEN 187, bounded vitest green after. |

**The one thing to know first.** The re-record landed, and nothing outside the seven tapes moved.
- The four successors (`r8-d2-19`, `r8-d2-20`, `r9-solve-19`, `r9-solve-20`) keep their walks byte for byte. Their traces and recorded expectations are byte-identical; only `seam.time` and the game-measured RNG in their boot blocks moved.
- To get there, `solve-seedling-r8-d2-chain.mjs` had to learn to drive its latch **headless**: it spelled `py.exe` and `/mnt/c` inline and could not run on a cloud box at all. U6's *"two headless latch drives"* was not true of the file on main.
- Merging needs the `campaign` tier on CI (`seedling-full-tier.yml`) for the new tapes, which is the coordinator's dispatch (⚖ 70 (f)).

## The rebase

| conflict | in commit | resolution |
|---|---|---|
| `scripts/procgen/seedling-solver-surface.json` | `de4fbbb` (U6 D5 re-points) | Took U6's side and ran `census-…-surface --write`. That left **2 UNCLASSIFIED** rows (`run:bobBossForecast`, `import:inventorySlotsFor`), main's classifications lost by taking U6's side. I restored their `class`/`form`/`why` from main's file, re-ran `--write`, and got `--check` GREEN 187. |
| `docs/json/developer/procgen/README.md`, `frontend/modules/procgenDocs/generated/docsIndex.js` | `6d69f8f` (U6 D5 docs) | Took main's, then `generate-procgen-reference.mjs` + `scripts/quicklaunch/generate-docs-index.mjs`. |
| `seedling-bot-log.md` | `6d69f8f` | Kept both. U6's section sits after § U8-swim (order U5, U7, U8, U6). |
| `seedling-bot.md` (the solver paragraph) | `6d69f8f` | Merged at sentence level: main's paragraph (the encounter goal, the puncher), with U6's span replacing main's *"still reads one phase ahead … so it did not ship"* (the transit pairing, the dead-spinner exclusion, the dwell, the nine sets, the remaining rebound wall). *"U7-swim the latest"* became *"U6-swim the latest"*. |

These auto-merged with no conflict and are green at the rebased head: `procgenCorridorBody` (s8), `procgenRoam`, `procgenCountableClock`, `procgenScratchPersistence`, `seedlingGenRoomRequire` (s8), `watchGenOverlay` (s6), `solverBot.test` ⚖ 47 (120,112) and `seedlingSolverSurface`.

## W0: the banked rows (rebased head `af32af2`)

| Row | Result |
|---|---|
| `identity-block.sh .` (`SEEDLING_PORT=8870`) | maze `246dfbce…`, acceptance `e417212b…`, c3 `09ba691c…`, c6 `8f4d7d5a…`, c4 `8768de47…`, ENEMY `577aedfe…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…`, level pre/post s1 `e28c1e5d…`/`c4841acb…`, generated set OK |
| … against main's values | **unchanged:** maze, guard, AREA, both levels. **Moved:** acceptance, c3, c6, c4, ENEMY and killgate ×3. Every mover is a post-sword spinner row, which U6's levers move. **Level post-sword s1 does NOT move over this main** (`c4841acb…` = main), although on U6's own base it moved. |
| six `--check`s | battery `410f27c0` exit 0 · d2-chain `b9340bff` **exit 1** · l18 `d2984ef2` **exit 1** · tail `9a6a3192` exit 0 · r9-l3 `6cd35fe1` exit 0 · r9-campaign `7d26db7a` **exit 1**. The three reds are **U6's own D3 digests**, byte for byte. |
| reference `--check` | 1 module differed after the D1-prep port (the instruments index names d2-chain's new `--win` flag). Regenerated (`c0aa940`), then ALL 7 + 5 MATCH. |
| campaign census `--no-write` | exit 0, `9545859b…` (= U6's W0), chain 21/21 **5713 t**, **NO CHAIN ROOM MOVES** |
| `--check-frontier` | exit 1. Only the stale `sources` row fails (`AP_1_rules.json` `602b318b…` on disk vs `c4845373…` derived); the survey files are not on disk. Pre-existing; reported, not written. |
| constants `--check` | PASS, 4619 literals, 0 new / 0 vanished / 0 moved |
| surface `--check` | GREEN 187 |
| `tapeRunner` | **371/371** green (main's 365 + 6 rows main added since U6's base) |
| bounded vitest (the brief's 15 paths) | **15 files / 519 tests**, green |
| twelve + CORRIDOR | post **12/12**: (4,4) 219, (7,2) 123, (2,3) 142, (3,3) 150, (7,7) 123, (5,2) 123, (2,2) 260, (5,5) 241, (6,6) 251, (7,6) 212, (2,7) 258, (3,6) 173, CORRIDOR 225. Pre **6/12** at 218; the other six and CORRIDOR refuse EXHAUSTED. U6's head table, exactly. |

## D1: the seven, re-derived (`a25c308`, `c0aa940`, `f4029ee`, `db96a9b`)

**Prep: the d2 chain could not run here.** `solve-seedling-r8-d2-chain.mjs`'s `latchOf` called `/mnt/c/Windows/py.exe` against `localhost:8000` with no other channel, so on a box without Windows Chrome the producer cannot author segments 1 and 2. I ported it to `seedlingDriver.driverChannel`, on `solve-seedling-r9-campaign.mjs`'s L16 precedent:
- headless logic-only by default, with `--win` kept;
- the page on `SEEDLING_PORT`.

The `--check` path drives nothing. Measured: W0's `b9340bff` was taken with the ported file and equals U6's digest, so `--check` stdout is unchanged. This is tooling, not solver; no solver file was touched.

| tape | before (main) | after | how |
|---|---|---|---|
| `r8-solve-18` | 485 t | **522 t** (pred 522) | `solve-seedling-r8-l18.mjs`: {18,0} at 422 (removal 321 + fade 101), 0 hits, 0 contacts, 18897 B |
| `r8-d2` (headline) | 1791 t | **1828 t** (pred 1828) | `solve-seedling-r8-d2-chain.mjs`: 522 + 746 + 560, cuts [522, 1268]. Two headless latch drives (523 obs / 40 dead; 747 obs / 190 dead). |
| `r8-d2-19` | 746 t | 746 t | boot block only; trace byte-identical |
| `r8-d2-20` | 560 t | 560 t | boot block only; trace byte-identical |
| `r9-solve-18` | 394 t | **455 t** (pred 455) | `solve-seedling-r9-campaign.mjs`: 21 headless latch drives (cache empty) |
| `r9-solve-19` | 746 t | 746 t | `seam.time` 10466 → **10527** (U6's arithmetic, exact) and the game-measured cosmetic RNG; trace byte-identical |
| `r9-solve-20` | 161 t | 161 t | `seam.time` 11382 → 11443; trace byte-identical |
| **chain** | 5713 t | **5774 t** (pred 5774) | segments 183,47,245,255,558,294,146,827,122,83,97,152,23,145,36,118,456,625,**455**,746,161 |

- **The fixtures diff** (`git diff --stat origin/main -- …/fixtures` after D1): the seven tapes plus `traces/r8-solve-18`, `traces/r8-d2` and `traces/r9-solve-18`. Nothing else. `r9-solve-2` was rewritten by the producer and came out byte-identical, as did every other campaign segment.
- **The campaign producer exits 1**, on two rows that compare the recorded chain with the *pre-run committed* tapes (*"sum(segment ticks) … 5774 against committed 5713"* and *"every RECORDED segment's solved length is its committed tape's own"* at segment 18). That is the drift line a licensed re-record prints, not a refusal: every segment was written, and the `--check` at D2 is the gate (exit 0).

## D2: the game (`1e0478e`, `25e5aa3`, `1b4849d`, `c24595b`)

`check-seedling-bot-differential.mjs --record --only=<name> --host=http://localhost:8870`, headless logic-only, one tape at a time:

| tape | observations (= ticks + 1) | model reproduces the recording | PASS / FAIL | expectation |
|---|---|---|---|---|
| `r8-solve-18` | 523 | yes, 1 transition | 30 / 0 | moved |
| `r8-d2-19` | 747 | yes | 31 / 0 | **byte-identical** |
| `r8-d2-20` | 561 | yes | 32 / 0 | **byte-identical** |
| `r8-d2` | 1829 | yes, 3 transitions | 33 / 0 | moved |
| `r9-solve-18` | 456 | yes | 30 / 0 | moved |
| `r9-solve-19` | 747 | yes | 31 / 0 | **byte-identical** |
| `r9-solve-20` | 162 | yes, 0 transitions | 30 / 0 | **byte-identical** |

(The `25e5aa3` message says "three expectations"; only `r8-d2.json` changed in it, and the other two re-recorded identically.)

| row | result |
|---|---|
| `generate-tape-index.mjs` / `--check` | wrote 157 tapes / OK |
| `tapeRunner.test.js` | **371/371** (pred 371: no new tape, so no new row). The chain row U6 saw red is green. |
| `tapeIndexManifest.test.js` | 160/160 |
| roster pins `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance` | green at **157 tapes**, unchanged (no new tape) |
| six `--check`s | battery `410f27c0` · **d2-chain `7cba9530`** · **l18 `cef8048e`** · tail `9a6a3192` · r9-l3 `6cd35fe1` · **r9-campaign `46990775`**, **all exit 0** |
| campaign census `--no-write` | exit 0, `acc7b8fe…`, chain 21/21 **5774 t**, tail 3/3 **1828 t**, **NO CHAIN ROOM MOVES** (pred) |
| `--check-frontier` | exit 1, the same single stale `sources` row; chain / segments / arrivals PASS. Reported, not written. |

## D3: the profile witnesses (`f36294d`, `457c59a`)

| tier | command | head (clean) | tapes | wall (pred) | moves / blind | physics | rule |
|---|---|---|---|---|---|---|---|
| **full** | `--write --jobs=4 --tier=full` | `c24595b` | 157 (control stable ×2, one declared diverger `r5-l60-kill`) | **1787 s** (~1790: 1651 s × 135/127 × 157/154) | **75 / 60** | 33 / 17 | 42 / 43 |
| fast | `--write --jobs=4 --tier=fast` | `f36294d` | 104 | 334 s (~350) | 64 / 71 | 30 / 20 | 34 / 51 |

- Before this slice the full JSON named 127 keys and 154 tapes (engine-prep R1: 70 / 57).
- The fast JSON was **not** current on main. It named 127 keys and 102 tapes (`bbdbe7d`), so `--check` reported 8 RED rows: U7's `puncherDieAnimFrames`, `…DieAnimRate`, `…AttackAnimFrames`, `…AttackAnimRate`, `…PunchForce`, `…PunchReach`, `…RunRange` and `…AttackRange`. The brief licensed a rewrite exactly when `--check` names it.
- After both writes, `--check`: **PASS — both name all 135 keys**. `seedlingProfileWitness.test.js` 8/8.
- During the full run I parked the uncommitted log edit in the scratchpad. The witness stamps `head`/`treeClean` at write time, and both JSONs read `treeClean: true` at a pushed commit.

## D4: the census and the yield (rebased head; code identical to U6's head plus main)

**Twelve + CORRIDOR:** post-sword **12/12** (pred), pre-sword 6/12. The table is as W0 above: tapes do not reach it, and the code did not change after the rebase.

**Corridor-body sweep, post-sword** (`sweep-yield-table.mjs --substrate=seedling --kinds=… --sizes=10x10,14x14 --elements=corridorbody --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --palette=post-sword`, three kind-shards). Prediction: U6's head numbers.

| | U6 head | U6b (rebased) |
|---|---|---|
| placed | 143 | **143** |
| certified | 122 | **122** |
| named `the-solver-cannot-cross-the-roaming-body` | 14 | **14** |
| per-target / strike bound | 5 / 2 | 5 / 2 |
| TIMEOUT / THREW | 3 / 0 | 3 (branchy 14 s9, empty 14 s5, winding 14 s9) / 0 |

Per kind × size (placed/certified): empty 12/10 · 11/11; branchy 11/8 · 9/8; bushy 12/10 · 11/9; loopy 8/8 · 11/9; open 6/6 · 7/6; rooms 11/8 · 12/10; winding 12/9 · 10/10. Identical to U6's table except `empty` 10x10 (U6: 12/10/1, here 12/10 with 1 named + 1 per-target; same totals).

**Roam** (F1b's command, both palettes). Pre-sword 10 placed / 8 certified (md5 of the output without timing lines `d779c645…`). Post-sword **10/8** (`5418d719…`): `branchy` and `winding` 14x14 s12 refuse with the named refusal. Both = U6's head.

**Re-pins, each by its own rule:**

| row | rule | measured | verdict |
|---|---|---|---|
| `procgenCorridorBody` refusing seed | rooms s1–s12, the fast one that refuses by name | s6 refuses (7.4 s), **s8 refuses (0.9 s)**, s9 per-target, the rest certify | **s8 stays** (main pinned s10, which certifies at 234 t here) |
| `procgenRoam`, `procgenCountableClock`, `procgenScratchPersistence`, `seedlingGenRoomRequire`, `watchGenOverlay`, `solverBot.test` ⚖ 47 | green at the rebased head | green in the bounded vitest at W0 and after | unchanged from U6's re-points; I did not re-sweep them (main's U5/U7/U8 changes did not redden any) |
| **`playthroughWalk` r8-d2 `clears` evidence** | `removedAt` = the producer's measured removal | `playthroughAcceptance` RED: *"r8-solve-18's clear of {18,0} at tick 422 … NO `clears` row on this chain names that tag at that tick"*. The producer: *"computed the removal at 321"* | **292 → 321** (`0ae8013`) |
| **`watchOverlays` r8-solve-18** | the landing presses are the run's ledger | RED: expected `[44,112,145,245,278]`, got **`[44,113,146,168,231,307]`**; then *"expected 161 to be greater than 308"* | re-pinned; the one pre-kill miss is pinned by tick (`[161]`) rather than claimed absent (`0ae8013`) |

The old walk landed six hits from five presses (one swing on both bodies). The new walk lands six from six, so slice 11's double landing belonged to that walk.

**Boundaries.** `check-seedling-producer-boundaries.mjs` after D2 read 17 VERIFIED / 6 REFUSED. Two of the refusals were r8-d2's own boundaries: the d2 producer never wrote the machine-global latch cache. It now caches on r9-campaign's key scheme (`0ae8013`). A re-run drove both latches and rewrote every tape **byte-identically** with `--check` still `7cba9530`. The gate now reads **19 VERIFIED, 0 DISAGREES, 4 REFUSED**: the toy r7 pair and the promoted `r8-solve-1..3`, which no producer drives.

## D5: records (`f17648b`)

- `seedling-bot-log.md` § *U6-swim*: the opening now says the re-record landed in U6b, and a **U6b** block after D4 gives the seven tapes, the numbers, the digests, the d2 producer port + cache, the two re-pins and both witnesses. The section stays after § U8-swim.
- `seedling-bot.md` § the combat ladder: U6's sentences, merged into main's paragraph at the rebase. No L18 tick count is quoted there, so none is stale.
- Reference: `generate-procgen-reference.mjs` + `scripts/quicklaunch/generate-docs-index.mjs`. `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED. The instruments index now cites `solve-seedling-r8-d2-chain` from the log (cited 127 → 128).
- **Bounded vitest after:** the brief's 15 paths + `tapeRunner` + `tapeIndexManifest` + `seedlingProfileWitness`: **18 files / 1058 tests** green. The other 18 test files that reference the moved tapes or totals (`placedTalk`, `levelRun`, `ulpDash`, `watchManual`, `fixtures/tiers`, `procgenWeigh`, `watchSolve`, `watchWasm`, `director`, `gameClock`, `playthroughAcceptance`, `watchOverlays`, `reachClosure`, `provisionalLatch`, `walkMoves`, `rerecordCampaign`, `exportSeedlingView`, `boxLock`) plus `lintGateLabels`: **19 files / 838 tests** green after `0ae8013` (2 red before it; above).

**Trap candidates for the coordinator** (U6's three, still standing, plus two from this slice):
1. A player-coupled knockback is in no autonomous forecast (U6).
2. A goal satisfied in passing must be recognised (U6; U5/U10's goal loop).
3. A priced wait turns "walk now, stand there" into a policy choice (U6).
4. **A producer whose only channel is the Windows box cannot discharge a licence in the cloud.** The re-record needed a tooling port before any solver ran. Every `latchOf` should go through `driverChannel`. One inline spelling remains: `solve-seedling-r8-tail.mjs` names `py.exe` and has no `driverChannel` (`grep -al "py.exe" scripts/procgen/solve-seedling-*.mjs scripts/procgen/plan-seedling-*.mjs`). It was not touched here, because its tapes did not move.
5. **A test row that pins a walk's tail pins the walk, not the room.** `watchOverlays`' "every non-landing press comes after the last kill" and the r8-d2 `clears` evidence both restated `r8-solve-18`'s old walk. The licensed re-record had to find them by running the 18 files that name the tape. U6's D4 list (six commands) did not name them, because they are not producers.

## The surface delta

187 → 187 rows, `--check` GREEN at every commit. The only change against main is the U6 commit's site counts, plus main's two U5 rows (`bobBossForecast`, `inventorySlotsFor`) restored at the rebase. No new member, export or row.

## What the brief got wrong (measured)

1. **"`tapeRunner` (expect RED on the three L18-bearing rows until D2)."** `tapeRunner` replays the *committed* tapes and runs no solver, so U6's code cannot redden it. At W0 it is **371/371**. It would only go red with one tape moved and not the rest (U6's 364/365).
2. **"`solve-seedling-r8-d2-chain.mjs` (`r8-d2`, `r8-d2-19`, `r8-d2-20`; two headless latch drives)."** On main the file had no headless channel (`py.exe` inline, port 8000 fixed). It needed the port first (`a25c308`).
3. **"The fast JSON is main's — do NOT rewrite it unless `--check` names it."** `--check` named it: 127 keys, 8 RED. Rewritten.
4. **"Expected rebase conflicts … re-pinned test rows."** None of the test rows conflicted; they auto-merged. The real hazard was the surface table: taking U6's side silently dropped main's two classifications. `--write` then reported them UNCLASSIFIED, and `--check` would have been red.
5. **"U6's D1–D3 may move the post-sword rows AGAIN … level post s1."** Over this main, level post-sword s1 stays at main's `c4841acb…`. Eight rows moved (acceptance, c3, c6, c4, ENEMY, killgate ×3).
6. **"`tapeRunner` count predicted: 365 + the rows the new expectations add."** The base is 371 on main, and replacing seven expectations adds no row: **371**.
7. **"D2 … the three roster-count pins … 157 tapes."** Correct, but the brief's list of what the re-record touches missed **two rows that pin the old walk** (`watchOverlays`, the `playthroughWalk` clears evidence). Both went red only outside the brief's bounded paths.

## Residue

- **The `campaign` tier on CI** for the seven tapes (`seedling-full-tier.yml`) is the coordinator's dispatch at the merge. The pushed head is not CI-measured by this slice (⚖ 52: no local unfiltered vitest).
- `campaign-frontier.json` `sources` is stale, as it was at W0 (main's state). Not written (⛔).
- `campaignChain.js:166` still reads *"The survey's own solve is 485 tick(s)"* for `r9-solve-18`. This is the survey's number at growth time: provenance, not a pin, and it already disagreed with the committed 394. Left alone.
- **Four boundaries stay REFUSED-UNVERIFIED** in the boundaries gate (`r7-ends-meet-1→2`, `r8-solve-1→2→3→4`). No latch for those bytes exists on this box, and no producer here drives them.
- **The trap candidates** above, for numbering.
- **Scratch instruments** (session scratchpad, not committed): `twelve.mjs` (the twelve + CORRIDOR), `cbrooms.mjs` (the corridor pin's rooms sweep), the sweep shard outputs, every run log.

## Byte-inertia

| artifact | main `0a8771a` | W0 (rebased, `af32af2`) | after D2 (`c24595b`) | head (`f17648b`) |
|---|---|---|---|---|
| battery `--check` | `410f27c0` ✓ | `410f27c0` ✓ | `410f27c0` ✓ | `410f27c0` ✓ |
| d2-chain `--check` | `b470c14d` ✓ | `b9340bff` exit 1 (U6's, expected) | **`7cba9530` ✓** | `7cba9530` ✓ (re-measured after the cache) |
| l18 `--check` | `17be7d70` ✓ | `d2984ef2` exit 1 (U6's) | **`cef8048e` ✓** | — |
| tail `--check` | `9a6a3192` ✓ | `9a6a3192` ✓ | `9a6a3192` ✓ | — |
| r9-l3 `--check` | `6cd35fe1` ✓ | `6cd35fe1` ✓ | `6cd35fe1` ✓ | — |
| r9-campaign `--check` | `2823a811` ✓ | `7d26db7a` exit 1 (U6's) | **`46990775` ✓** | — |
| campaign census | NO MOVES, 5713 (`9545859b`) | identical | NO MOVES, **5774** (`acc7b8fe`) | — |
| `fixtures/**` vs main | — | 0 lines | the 7 tapes + 3 traces + 3 expectations + index | identical to after D2 |
| `tapeRunner` | 371 | 371 ✓ | 371 ✓ | 371 ✓ |
| profile witnesses `--check` | **RED** (fast 8, full 8 rows) | — | — | **PASS** both (135 keys) |
| solver surface | GREEN 187 | GREEN 187 | GREEN 187 | GREEN 187 |
| constants `--check` | — | PASS (4619) | — | PASS |
| reference `--check` | — | ALL MATCH (after `c0aa940`) | — | ALL MATCH |

I did not touch or run any AS3, wasm, gitlink, biome default, `standing-values --write`, `--write-frontier`, `pytest` or unfiltered `vitest run`, and I edited no simulation or solver file. Outside the seven tapes, their expectations, traces and the index, the only fixtures-adjacent edit is `playthroughWalk.js`'s one evidence number. The other non-doc edits are the d2 producer's channel and cache, the two witness JSONs, and the `watchOverlays` row.
