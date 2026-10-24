# Seedling HAMMER-PHASE SFF — `STRIKE_ETA_FLOOR` flipped ON, and what moved re-recorded

Slice `seedling-hammer-strike-floor-flip` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User,
2026-10-23: *"Yes, please go ahead with that plan"*: flip the press-kill guards first (GF, `dbe7668ca7`), then
`STRIKE_ETA_FLOOR` as its own flip and re-record slice. This is that slice. The evidence is in
[`seedling-hammer-strike-floor-flip-evidence/`](seedling-hammer-strike-floor-flip-evidence/).

⛔ **Read this first: one (s) item is open, and it leaves the slow battery red ON** (§ 4.3, § 8.1). The floor-ON
bounded pass previews a cell through `walkTo`. That path lets a preview's `PhysicsV2Error` (a drown) escape
`deriveStrike`, so the generator's oracle aborts on empty post-sword seed 30 instead of rejecting the candidate. The
fix is in solver logic, which is outside this slice's scope, so it is handed over, not pinned away.

## 1. Where this ran

| | |
|---|---|
| start SHA | **`dbe7668ca7`** (`origin/main` at the fetch; contains GF, the guards ON) |
| branch | `claude/seedling-strike-eta-floor-flip-ugfnjp`. This is the session's designated branch, not the brief's `seedling-hammer-strike-floor-flip`. Nothing went to `main` |
| W0 evidence | `9fa65703` |
| F1 + F2 | `f7060d11` (one commit) |
| F3 records | `9ffef145`; CI's first-run fixes `16ad7e81` |
| head | the commit that adds this report (see `git log`) |
| box | 4 cores, node v22.22.0; dev server `serve-nocache.py 9587` (PID 931, killed by PID at the end) |

## 2. W0 — the OFF baseline, and the ON table at this base

**OFF** (`w0/`, `SEEDLING_STRIKE_ETA_FLOOR=0`, which at the base equals the default):
- `identity-block.sh`: rc 0. Every row equals SF3's OFF byte for byte (`diff` against SF3's `identity-off.txt` is
  empty).
- Bounded vitest: SF3's 21 files **503 passed, 1 skipped**. The extended set (SF3's 4 new files, plus the files added
  since `ef6bdd6d86` that reach the solver: `fidelityDrillKill`, `fidelityMasks`, `fidelityYeti`,
  `seedlingDialogueSkin`) passed **119 / 119**. No file added since SF3 names the floor (`rg -a`).
- `ci-producer-checks.mjs --jobs=4`: **93 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, its named
  exclusion).

**ON at this base** (`SEEDLING_STRIKE_ETA_FLOOR=1`, before any edit), against SF3's guards-OFF table:

| item | at `dbe7668ca7` | vs SF3 |
|---|---|---|
| identity rows ON | acceptance `9fbd9304`, c3 `c4a58671`, c6 `5d06a8b0`, c4 `7e1497c4`, killgate `7c15ed57 / 47116405 / 4d3bbf17`, `r8-d2-chain` `f5490519` / `r8-l18` `3c81acbe` / `r9-campaign` `a6b59269` (exit 1 each) | **same**, byte for byte |
| gate rows, SF3's 21 files | **30 failed in 12 files** | SF3's 29 **same**, plus **1 new**: `hammerGhostKillRung` › GF's guards-ON sibling (1216 → **778**). GF added that row after SF3 measured |
| gate rows, the extended set | `hammerPressKillGuards` 3 (HO1; HO2 OFF / ON 1202 → 788) | **same** |
| roster producers red ON | the same 8: `f1c-l18-phase`, `hammer-a-escape`, `-b1-approach`, `-b2-fight`, `-bw-bombstand`, `-g1-ghostkill`, `l40button-witness`, `-sf-strikefloor`, with SF3's first-failing lines | **same** |
| gone | — | nothing in SF3's table is gone. The guards did not mask any of SF3's rows: each one reproduces with the guards ON |

So the guards-ON table is SF3's plus one row. A further **11 rows** in 6 files and **7 rows in CI** surfaced only
after the re-record or under the full suite (§ 4.1, § 4.4). They are not in SF3's list because SF3's selection rule
does not reach them.

## 3. F1 — the flip, and every reader

`frontend/modules/seedlingDemo/solverBot.js`:

| | before | after |
|---|---|---|
| `STRIKE_ETA_FLOOR.enabled` | `…SEEDLING_STRIKE_ETA_FLOOR === '1'` | `… !== '0'` |
| `STRIKE_ETA_FLOOR_DEFAULT` | `false` | `true` |
| the docblock above it | "OFF … its flip is the user's call" | ON since SFF, the ruling and its date, SF3's numbers, the `=0` opt-out, the witness-pin rule, and why the initialiser is the default (the page worker has no `process`) |

Measured in node: the defaults print `true true`; with `=0` they print `false true`.

**Readers** (`rg -a STRIKE_ETA_FLOOR`, outside the cloud reports):
- `solverBot.js`: three one-line comments that said "OFF" (the import note at l.137, the `STRIKE_CANDIDATES` docblock
  tail, and `deriveStrike`'s `measured` line). These are comment-only changes, a little outside the brief's
  "initialiser, `_DEFAULT` and docblock". No logic was edited.
- `docs/json/developer/procgen/seedling-bot.md`: **OFF → ON**, the opt-out, and a "The flip" paragraph (what moved and
  how each kind was kept).
- `hammerStrikeEtaFloor.test.js`: the header and the "ships OFF" row → *"ships ON (the user's flip, hammer-phase SFF,
  2026-10-23)"*, skipped under `=0`.
- `plan-seedling-hammer-sf-strikefloor.mjs`: the "ships OFF" check now reads **`STRIKE_ETA_FLOOR_DEFAULT === true`**,
  not `.enabled`, so the `=0` roster control stays green. Both of its solves already pin the floor explicitly.
- `frontend/modules/procgenDocs/generated/instruments.js`: regenerated from that header.
- `seedling-solver-surface.json` has no switch-state row: census GREEN, 345 rows, nothing to `--write`.
  `census-seedling-constants` reports 0 new and 0 vanished.
- `pressKillGuards.js:27` mentions the floor as history ("… `STRIKE_ETA_FLOOR` after, in its own slice"). It is
  outside the scope and still true, so it was left alone.

## 4. F2 — every moved item, its kind, before → after

Kinds: **(m)** mechanical (the item pins the default's answer, and ON's is just as valid); **(w)** witness (a walk
the game played under OFF: pinned `withStrikeEtaFloor(false, …)`, the tape byte-identical); **(s)** stop.

### 4.1 Producers and tapes

| item | kind | before → after | how, and the game gate |
|---|---|---|---|
| `r8-solve-18` (`solve-seedling-r8-l18.mjs`, write mode = default) | m | 363 → **467 t**; `{18,0}` 305 → **419**; spinners die t161 / t307 | re-recorded; `--check` rc 0 (`6460d60d`) |
| `r8-d2` (`solve-seedling-r8-d2-chain.mjs`) | m | 1,669 → **1,773 t** (467 + 746 + 560) | re-recorded **with the game**: its write mode replays on wasm (`REPLAY_OK`, needs `SEEDLING_PORT`). `r8-d2-19` and `-20` rewrote only their seam (`time` +104 and the transported RNG `seed`); walks unchanged. `--check` rc 0 (`1e8180a5`) |
| `r9-solve-18` (`solve-seedling-r9-campaign.mjs`) | m | 440 → **390 t**; `{18,0}` 406 → **355**; Σ 10,622 → **10,572** | re-recorded (8 min 59 s, game replays inside). **Twelve later segments** (`r9-solve-19`, `-20`, `-13-v2`, `-0-v3`, `-12`, `-21`, `-22`, `-29`, `-30`, `-31`, `-32`) rewrote **only** their seam: `time` −50, plus the RNG `cosmetic` / `fp` that ride it. Their walks are byte-identical. The write-mode run's two FAILs compare against the pre-write tapes, as expected; `--check` afterwards rc 0 (`5266b7a6`) |
| game streams `expectations/{r8-solve-18,r8-d2,r9-solve-18}.json` | m (game-recorded) | old walks' streams → the new walks' | `check-seedling-bot-differential.mjs --record --only=r8-solve-18,r8-d2,r9-solve-18` (headless wasm, p4g): *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*, 468 / 1,774 / 391 observations. ⛔ These are recordings of the game, not of the model |
| the differential over **all 16** moved tapes (compare mode) | gate | before the record: the 3 walks FAIL (tick counts), chain `r8-d2` FAILS provenance; **13 seam-only tapes PASS** against their old streams | after: **ALL CHECKS PASSED** (`f2/diff-compare2.txt`) |
| `playthroughWalk.js` `clears[].evidence.removedAt` (chain provenance) | m | `r8-d2` 205 → **319** (at 419); `r9-campaign`'s L18 row 306 → **255** (at 355) | the chain law (`stagedClearFindings`) demands each `at`-clear's provenance. The producers' write mode does not touch this file, and the differential found it. This is fixture metadata, not solver logic |
| `fixtures/tapes/index.json` (the picker's manifest) | m | 3 tick counts | `generate-tape-index.mjs` (CI found it, § 4.4) |
| `witness-bases/r9-solve-18.flip14.json` (**new**) | — | the pre-SFF `r9-solve-18` (440 t), byte for byte (`git show`, `cmp` identical) | kept outside the roster for the escape cache's key rows (§ 4.2), F1c's precedent |
| `plan-seedling-f1c-l18-phase` | w | red ON → green | `withStrikeEtaFloor(false, …)` around its rung solve, plus a header note; `--check` rc 0, tape byte-identical |
| `plan-seedling-hammer-a-escape` (×2 witnesses) | w | same | the `solve` closure pinned OFF |
| `plan-seedling-hammer-b1-approach` | w | same | same |
| `plan-seedling-hammer-b2-fight` | w | same | same |
| `plan-seedling-hammer-g1-ghostkill` | w | same | `ghostKillSolve` pinned floor OFF, inside GF's `guardsOff` (GF residue 4) |
| `plan-seedling-hammer-bw-bombstand` (all three premises) | w | same | `bombStandSolve` pinned OFF |
| `plan-seedling-l40button-witness` | w | same | `l40buttonPlan` pinned OFF (beside its INTERIM fidelity pin) |
| `plan-seedling-hammer-sf-strikefloor` | m (its check) | "ships OFF" → "ships ON" | § 3 |

`git diff dbe7668ca7 -- fixtures/hammer-*-witness fixtures/f1c-* fixtures/bomb-witness fixtures/hammer-lb-hx` is
empty: **no witness tape or game row changed**.

### 4.2 Gate rows (the bounded files)

| file › row | kind | before → after | reason |
|---|---|---|---|
| `hammerApproach` › *OFF is the switch-off walk …* | m | 518 → **476** | `r9-solve-18`'s staging at residue 40 with `HAMMER_APPROACH` OFF; ON is still shorter and takes no hit |
| `hammerFight` › the same row | m | 518 → **476** | same |
| `hammerEscape` › *escape21 / escape15 IS the solve* | w | red → green, floor OFF | the two game witnesses `hammer-a-l18-escape{21,15}` |
| `hammerEscape` › **new** ×2: *… the strike floor at its shipped ON: the escape OFF no longer refuses* | ON sibling | — → **474 t / 540 t**, no hit, L19 | the ON answer is a claim: the floor alone clears both stagings |
| `hammerFightFallback` › *a refusal today …* / *a retry … is UNDONE* | m | message `/The corner formed/` → `/the HAMMER-PHASE rung first saw this corner at t263/`; `refusedAt` 267 → **266** | still a HAMMER_SAFETY refusal at residue 4, and the retry still solves (324 / 349 t unchanged). Only the refusal's wording and tick moved |
| `hammerGhostKillRung` › all its solves (`solveA`) | w | 2195 / 1216 → unchanged, floor OFF | GF residue 4: its witness is G1's OFF-floor walk. ON, the floor's own gate pins the moved kill (t1616 / t778) |
| `hammerGhostSpinner` › D3 ghost ON | m | 336 → **328**; landings 92 / 159 → **70 / 156** | D3's solve is model-only (the C2 witness is the 91-tick walk, and those rows stayed green) |
| `hammerGhostSpinner` › D3 sword | m | 518 → **476** | same staging as B1 |
| `hammerPressBombs` › *t1099 …* | w | (248,184) → (248,168) ON; pinned OFF | the derivation is asked on fidelity's game-witnessed MOVINGWAIT walk, whose stance (248,184) the floor-OFF solve chose |
| `pressKillCost` › *r9-solve-18 … the shift is taken* | m | `forecastShifted > 400` → **`> 350`** (measured 382) | a non-vacuity floor on the re-recorded committed tape |
| `pressKillCost` › *the kill-start derivation, then two refused ones …* | w-like (an OFF-chosen staging) | pinned floor OFF | its second derivation was picked because OFF's floor refuses it. ON it finds (728,680) |
| `pressKillCost` › **new**: *the strike floor ON: P2 keeps the same answers; only the far refusal's `etaSkipped` moves* | ON sibling + **(s)** | `etaSkipped` 9,149 (P2 ON) vs 16,202 (P2 OFF) | § 8.2 |
| `procgenScratchPersistence` ×3 | m | removal 142 → **133**, clear 243 → **234**, `declaredAt` 242 → **233** | follows the file's own re-pin history (517 → … → 142 → 133) |
| `solveProgress` › every L18 residue-21 row (10 red) | w | pinned floor OFF (`floor: false` on `SOLVES[0]` and `RK_SOLVES[0]`, through `floorOf`) | the file's header says this solve IS `hammer-a-l18-escape21`'s, and every W0 byte (`v1` md5, asks, `shouldStop` 165) was taken there |
| `solveProgress` › **new** `SOLVES[3]`: *L18 residue 21, the strike floor at its shipped ON: no hook, a peeking hook …* | ON sibling | 367 t, 3 passes, byte-identical across all four hooks | keeps the hook's observation-only claim on the shipped path |
| `solverSpinnerKill` F2 ×4 | m | (2,2) 515 → **490**, (2,7) 264 → **197**, (5,5) 269 → **238**, (7,6) 210 → **229** (= SF3's) | (3,6) 160 and the corridor 193 did not move |
| `hammerPressKillGuards` › HO1 | w-like (an OFF model fixture) | pinned floor OFF | `ho1-keys-t2439.json` is the floor-OFF base's solve, and the shake-band state is on that walk |
| `hammerPressKillGuards` › HO2 OFF / ON | m | death t1202 → **t788** (both); refusal at t788, `perTick` 788 | solved from the boot at the defaults. Both answers keep their shape |
| `hammerStrikeEtaFloor` › *ships OFF* | m | → *ships ON* | § 3. Its witness rows already pass `withStrikeEtaFloor(true, …)` (GF residue 2) and did not move |
| `solverBot.test` › *L18 spends the fade WALKING* | m | red ON → green | fixed by the re-recorded `r8-solve-18` alone |
| `escapeCrossPassCache` › 3 key rows (clocked hazard, tower in a search, `visit` in the key) | m (a frozen walk) | red after the re-record (green ON at W0) | they drive the committed walk to t76 / its t77 press. Now they drive `witness-bases/r9-solve-18.flip14.json` (all 5 `loadTape(L18.tape)` reads). The staging is the same (`stagingOf` drops timed rows) |
| `fidelityF1c` › rung stall at 42, the named remainder at 18, *the witness walks the rung's solve* | w | pinned floor OFF (`solveOffAt`) | the rung's game witness `f1c-l18-phase42` |
| `fidelityF1c` › *escape ON, the same two residues* | m | 503 / 445 → **477 / 372**, still no stall, escapes > 0 | |
| `fidelityF1c` › *the committed window IS the solve, key for key* | m | stayed green | the re-recorded `r9-solve-18` is the ON solve |
| `levelRunStateDigest` › *a tick moves `place` and `clock` …* | m | t30 → **t20** | the new walk stands still at t30 |
| `solveProgressHeartbeat` › L18 residue 21 | m | 445 → **367** | an emit-only invariance at the default; no W0 bytes pinned |
| `stringPullFast` › L18 residue 21 | m | digest `230dc0ff` → **`441782e9`** | an ON ≡ OFF invariance at the default |
| `watchOverlays` › *r8-solve-18: BOTH spinner paths …* | m | landing presses 44 / 77 / 110 / 159 / 192 → **33 / 127 / 160 / 240 / 273 / 306** | the file's own re-pin history. No double landing any more |

### 4.3 (s) — stop

1. **`hammerEscapeGenerated.slow` › *empty post-sword seed 30 …*** and **`seedlingGenCapacity.slow` › *post-sword,
   drawn seeds 1–60 …*** are red ON and green with `=0` (measured locally: `f3/seed30-on.txt`, `seed30-ctl0.txt`).
   The trace: `execute` → `execKillByPress` → `nextNow` → **`deriveStrike` → `measuredPair` → `walkTo` →
   `previewWalk`** → `levelRun.step` → `deathRefusal` (*"the player DROWNED in level 900 …"*). `walkTo`'s catch
   handles only the shake band, so a preview's `PhysicsV2Error` escapes the solver and the generator aborts
   (*"NOT one of the three verdict classes"*). OFF never previews in the bounded pass, which is why A2's fix
   (`previewOrDeath`, *"a previewed death is a step not taken"*) never had to cover it. The honest fix is in solver
   logic (a death in `walkTo`'s preview reads as a truncated walk), so it is handed over (§ 8.1). The two rows were
   **not** pinned OFF.
2. P2's `etaSkipped` (§ 4.2). It is a diagnostic counter, not an answer, and a row names it. Whether the counter should
   be P2-invariant is a solver question (§ 8.2).

### 4.4 Found by CI's first run (`40045141787`, at `9ffef145`)

| row | kind | before → after |
|---|---|---|
| `tapeIndexManifest` × 3 | m | regenerated `index.json` |
| `procgenCorridorBody` › *post-sword: … by a KILL* | m | 232 → **187 t** |
| `procgenCountableClock` › *a hammer-safety `SolverBotError` becomes REFUSED* | w-like (refusal vehicle) | ON, (7,2) solves; pinned floor OFF, as A2 pinned the escape |
| the two slow rows | **s** | § 4.3 |

**Counts:**
- **(m): 3 producer tapes** (+ 13 seam-only tapes they rewrote), **3 game streams**, **2 provenance rows**, **1
  manifest** and **29 gate rows** (with the 3 `sf-strikefloor` / ship rows).
- **(w): 7 producers** and **21 gate rows** (16 of them `solveProgress`'s L18 family), with **4 ON siblings**
  added.
- **(s): 2** (one defect, two red rows; one counter).

## 5. F3 — the gates

| gate | result |
|---|---|
| bounded vitest (by path, ⚖ 52) | every file touched is green alone: the 13 W0-red files, the 51 files naming a re-recorded tape or `playthroughWalk` (first run: 11 red in 6 files, all fixed), plus `tapeIndexManifest`, `procgenCorridorBody` and `procgenCountableClock` |
| `ci-producer-checks.mjs --jobs=4` ON (`f3/producers-on.txt`) | **93 run, 0 red**, 1 skipped |
| the same with `SEEDLING_STRIKE_ETA_FLOOR=0` (`f3/producers-ctl0.txt`) | **93 run, 0 red**, 1 skipped |
| identity block ON (`f3/identity-on.txt`) | acceptance `9fbd9304`, c3 `c4a58671`, c6 `5d06a8b0`, c4 `7e1497c4`, killgate s2 / s5 / s9 `7c15ed57 / 47116405 / 4d3bbf17` (= W0's ON); **`r8-d2-chain` `1e8180a5`, `r8-l18` `6460d60d`, `r9-campaign` `5266b7a6`, all exit 0**; maze, ENEMY, guard, AREA, levels, generated set, `r8-battery`, `r8-tail` and `r9-l3` unmoved. The reference row read "4 differ" before the regeneration below |
| `census-seedling-solver-surface --check` | GREEN, 345 rows (no `--write`) |
| `census-seedling-constants --check` | PASS |
| `generate-procgen-reference` → `check-procgen-reference` | 0 findings → ALL CHECKS PASSED (the campaign-chain region 10,622 → 10,572 t, `r9-solve-18` 440 → 390) |
| `generate-docs-index.mjs --check` | OK (191 docs) |
| `check-seedling-bot-differential` (headless wasm), the 16 moved tapes | ALL CHECKS PASSED after `--record` of the 3 walks |
| `seedling-bot-log.md` | `### Seedling hammer-phase SFF — the strike-timing floor flipped ON` |
| **JSUT** at `9ffef145`, run **40045141787** | suite **22,342 passed / 5 failed**; slow **263 / 2 failed**. The 5 were fixed in `16ad7e81`; the 2 slow rows are § 4.3's (s) |
| **JSUT** at `16ad7e81` | see § 5.1 |

### 5.1 JSUT at `16ad7e81`

Pending when this report was committed. Read it with `node scripts/procgen/ci-summary.mjs 16ad7e81` (the push of this report triggers its own run too). Expected: the 5 suite rows green, and the slow battery still red on § 4.3's two rows.

## 6. What the planner's harvest A/B should expect

The floor reads in exactly one place: `deriveStrike`'s bounded pass (and `strikeScanBox`'s floor), which the spinner
press kill asks. So:
- **Steps that can move:** a leg or step that asks a spinner press kill, i.e. rooms with spinner bodies (the atlas:
  L18, L39, L40, L92) and generated levels carrying a spinner or corridor body. Expect what SF3 measured: 0 solves
  gained or lost on its workloads, **many legs shorter and some longer** (L18's 45 residues: 24 shorter, 21 longer,
  Σ +13), and wall clock 1.35× on L18-like legs but 0.2–0.7× where the kill was long (staging A, legs 387 / 404,
  killgate s5 / s9).
- **Seeds and stagings that move without a spinner leg:** the identity rows show the acceptance batch, empty pairs
  c3 / c6, carved c4 and killgate s2 / s5 / s9 all move. These are generated rooms with press kills.
- **⚠ The generated-level survey may abort** on seeds whose spinner room borders water or lava: § 4.3's `walkTo` drown
  escapes as an abort, not a refusal. Expect post-sword seed 30 at least. A survey A/B run before that fix lands will
  read those seeds as *errors* ON, not as refusals.
- **Should not move:** legs with no spinner kill (maze, guard, ENEMY census, AREA, levels pre / post-sword s1,
  `r8-battery`, `r8-tail` and `r9-l3`, all byte-identical).
- **Witness legs:** anything replaying a committed witness tape is unchanged (pinned OFF). Anything replaying
  `r8-solve-18`, `r8-d2` or `r9-solve-18` replays the new walks, which the game agreed with here.

## 7. What the brief got wrong (measured)

1. **The branch**: the session's designated branch is `claude/seedling-strike-eta-floor-flip-ugfnjp`.
2. **"the 3 solve-producer tapes (… with `r9-solve-19`'s declared seam.time)"**: the campaign write moved **16** tapes,
   not 4. Besides the three walks, `r8-d2-19` / `-20` and twelve `r9-solve-*` segments rewrote their seam `time`
   **and** the RNG (`seed` or `cosmetic` / `fp`) that rides the clock. The game streams of the 3 walks also needed
   `--record`, and two chain provenance rows in `playthroughWalk.js` had to follow. That file is neither a producer
   nor a test, and nothing but the differential's chain law points at it.
3. **"b1-approach, b2-fight … (w)"**: true of the producers. Their gate rows' *"OFF is the switch-off walk"* (518)
   are (m), because they pin the default's solve at residue 40, not the witness.
4. **"Re-record … with each producer's own write mode"**: `r8-d2-chain` and `r9-campaign`'s write mode drives the
   **wasm game** (it needs a dev server and `SEEDLING_PORT`), so those re-records were played on the game, not just
   modelled.
5. **SF3's table was the whole list**: at this base it is SF3's plus one row (GF's sibling). Re-recording `r8-solve-18`
   / `r9-solve-18` then moved 11 rows in 6 files that SF3's selection rule never reaches (rows that drive or count a
   committed walk). CI found 7 more, including the § 4.3 defect.
6. **`differential --win`** (the producers' own header) is the Windows-Python path; on this box it is the default
   (headless) mode.
7. **The bootstrap** printed `READY` and again left six submodules uninitialised; they were initialised by hand. No
   gitlink moved.
8. **"`solverBot.js`, ONLY the initialiser, `_DEFAULT` and docblock"**: three comment lines elsewhere in it also said
   "OFF" and were changed (§ 3). No logic was edited.

## 8. Residue and hand-overs

1. **(s) — the drown in `walkTo`.** In `solverBot.js` `deriveStrike`, `walkTo`'s `try { previewWalk(…) } catch` should
   read a `PhysicsV2Error` as a truncated walk (a death is a step not taken; A2's `previewOrDeath` rule), next to its
   shake-band case. That turns the abort into a skipped candidate. Then re-run `hammerEscapeGenerated.slow` (seed 30)
   and `seedlingGenCapacity.slow` (post-sword seeds 1–60). ⚠ Until then **the slow battery is red at this branch's
   head** (2 rows), and green with `=0`. Merging this branch before that fix ships the abort to the page's generator.
2. **(s) — `etaSkipped` under P2.** `STRIKE_SCAN_COST` (P2) boxes cells out before the measured-ETA check, so those
   cells are never counted in `etaSkipped`: 9,149 vs 16,202 on the far refusal. If the counter should mean the same
   under P2, it is a counting change in `deriveStrike`.
3. The **CI probes, TT and the route sweep / survey A/B** are the planner's (`workflow_dispatch` is 403 from here).
   § 6 says what to expect, including the survey abort.
4. **`standing-values`**: the three `solve-seedling-*` `--check` md5s moved (`1e8180a5`, `6460d60d`, `5266b7a6`), and
   so did `plan-seedling-hammer-sf-strikefloor`'s stdout (its check line's text). Re-banking is the planner's call;
   no `standing-values --write` was run.
5. **Re-pin candidates left as they are:** the `witness-bases/r9-solve-18.flip14.json` freeze could be retired if the
   XC key rows are re-pointed at a tick of the new walk. That is a choice about those rows, not a defect.
6. **Hygiene:**
   - no stash, no force-push, nothing pushed to `main`;
   - no `pytest`, no unfiltered local vitest, no `standing-values --write`;
   - no AS3, wasm, gitlink or rules edit, and no edit to `levelRun.js`, `dangerMap.js`, `botDriverV*.js`,
     `pressKillGuards.js` or `flashPanel/*`;
   - the dev server I started (PID 931) was killed by PID; all scratch lived in the session scratchpad.
