# Seedling HAMMER-PHASE PKB — `PRESS_KILL_BOMBS` flipped ON, and the refuge preview refuses the shake band

Slice `seedling-hammer-press-kill-bombs-flip` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User,
2026-10-24: *"Please queue a slice for both of the tasks you described"*. It answers BW's licence question (flip
`PRESS_KILL_BOMBS`) and LB's hand-over 5b. The evidence is in
[`seedling-hammer-press-kill-bombs-flip-evidence/`](seedling-hammer-press-kill-bombs-flip-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`6faff978ce`** (`origin/main` at the fetch). It holds the SFF + SFF2 + PDS harvest: `STRIKE_ETA_FLOOR_DEFAULT = true` (`solverBot.js:10984`) and PDS's `previewWalkOrDeath` in `deriveRefuge` |
| branch | `claude/seedling-press-kill-bombs-flip-8etz0m`, the session's designated branch (not the brief's `seedling-hammer-press-kill-bombs-flip`). Nothing went to `main` |
| commits | W0 `04207e2b` · P1 `3bfb3cb3` · P2 `00d4ea78` · D `482a540e` · this report (the head) |
| box | 4 cores, node v22.22.0. Dev server `serve-nocache.py 9587`. **The container restarted once** during P2's measurements; every partial file was checked line by line and resumed (§ 5) |

## 2. The answer

**Leg 371 (`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`; id still 371), phases
solving of 45:**

| | W0 (base: floor ON, bombs OFF) | P1 (bombs ON) | P2 (+ the band catch) |
|---|---|---|---|
| phases solving | **22** | **30** | **30** |
| solves lost vs the previous column | — | 0 | 0 |
| band (shake) phases in the period | 14 | 1 (not the refuge preview) | 1 (the same seam, the same bytes) |

**The movers, by kind:**
- **P1:**
  - one test row, mechanical (m): `hammerRefugeCut` › t1150's bombs-OFF arm read the default;
  - one switch row re-pinned: `hammerPressBombs` › "ships OFF" → "ships ON";
  - no witness (w), no stop (s);
  - identity block, roster and bw-bombstand's tape unmoved;
  - on L40's 47 page requests, one mover: 371 itself (a solve stays a solve).
- **P2:** nothing moves at the defaults. Leg 371's census is byte-identical to P1's, and so is the L40 radius (47 of 47).
  P2's effect shows only with the bombs OFF: 11 of the 14 band phases become the kill's named *"nowhere to be"*.

## 3. W0 — the baselines at `6faff978ce`

| check | defaults (bombs OFF) | `SEEDLING_PRESS_KILL_BOMBS=1` |
|---|---|---|
| identity block (`w0/identity-*.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `7e1497c4`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`; producers `405d9c4b a591fa9d 6460d60d 35456fbc 6cd35fe1 27478177`, all exit 0; reference ALL MATCH. This is PDS's ON block, row for row | **identical** |
| `ci-producer-checks --jobs=4` | 93 run, 0 red, 1 skipped | 93 run, 0 red, 1 skipped |
| bounded vitest (148 files, `w0/bounded-files.txt`) | **4,660 / 4,660** | **1 red**: `hammerRefugeCut` › t1150's bombs-OFF arm (§ 4); 4,658 passed, 1 skipped (the "ships" row skips under any env value) |

**The bounded set:** PDS's 88 files, plus every non-slow test that `rg -a` finds naming `PRESS_KILL_BOMBS`,
`withPressKillBombs`, `execKillByPress`, `deriveStrike`, `deriveRefuge`, `pressKillGuards` or `PRESS_KILL_SHAKE_GUARD`,
plus every seedlingDemo test that names hammer, L40 or the bombpusher. That makes 148 files. The two `.slow` files run
separately, under `vitest.slow.config.js` (§ 6).

- ⚠ The "generated set" row in the first identity run read *"playwright 1.56.0, the pin is 1.63.0"*. That is the venv,
  not the tree. I installed `scripts/procgen/requirements-headless.txt` into the venv, and every later run reads `OK`.

**The 371 census at W0.** I captured the request on the page (`probe-seedling-divergence-sweep.mjs --mode=inv
--producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…`). At this base the page's
seam was 5257, and the page refused on the shake band (`w0/page-row-371.jsonl`). I ran L371's `l371-solve.mjs` over
5226–5280 (one period plus a 10-seam overlap), one fresh process per seam. The tool's import base is patched to an
absolute path (`tools/l371-solve.mjs`).

| arm | phases solving of 45 | overlap pairs identical | classes over the period |
|---|---|---|---|
| defaults | **22** | 10 / 10 | 22 SOLVE · 14 shake-throw · 3 HAMMER_SAFETY@kill t1339 · 2 HAMMER_SAFETY@break · 2 EXHAUSTED@break · 1 deadline · 1 reboot@kill t1524 |
| `=1` | **30** | 10 / 10 | 30 SOLVE · 5 EXHAUSTED@hold · 5 EXHAUSTED@break · 2 HAMMER_SAFETY@break · 2 HAMMER_SAFETY(refuge)@break · 1 shake-throw |

These match L371's own arms: its floor-ON arm was 22, and its both-ON arm was 30. The floor is now the default, so the
22 is today's baseline, not L371's 8.

## 4. P1 — the flip

**Measured ON at the base, before the flip** (the `=1` column above): one mover.
- `hammerRefugeCut.test.js` › *"t1150: the bombs refuse the nearest refuge, and the cut keeps BW's answer"*. Its last
  two assertions ask *"with the bombs OFF"* through `both(run)`, which read the default. ON it got BW's ON refuge
  (216,168) where it expects OFF's (232,200).
- **(m)**: the row's own words say OFF. It is now `withPressKillBombs(false, () => both(run))`.

**The flip** (`pressKillCost.js`, GF's shape):

| | before | after |
|---|---|---|
| `PRESS_KILL_BOMBS.enabled` | `…SEEDLING_PRESS_KILL_BOMBS === '1'` | `… !== '0'` |
| `PRESS_KILL_BOMBS_DEFAULT` | `false` | `true` |

- The docblock names the ruling, L371's measurement, the preconditions and the opt-outs.
- Node prints `true true` at the defaults and `false true` at `=0`.

**Re-pins and readers:**
- `hammerPressBombs.test.js` › "ships OFF" → *"ships ON (the user's flip, hammer-phase PKB, 2026-10-24)"*. It still
  skips under any env value. The header now says every other row names its arm, so the flip moves none of them.
- `hammerRefugeCut.test.js`: the pin above.
- **Comments only** (no logic): `solverBot.js:131`'s import comment and `deriveRefuge`'s bomb line, *"OFF"* → *"ON since
  PKB"*.
- `seedling-bot.md` § *The press kill's waits see the lobber's bombs*: **OFF → ON**, with the flip's paragraph.
- `seedling-solver-surface.json`: the `why` text, plus three line numbers from `--write` (the docblock grew 7 lines).
  GREEN, 347 rows.
- The generated procgen `README.md` and `docsIndex.js` (word counts).
- No producer in the roster names the switch except `plan-seedling-hammer-bw-bombstand` (not in the roster).

**bw-bombstand's fate:** `--check` at the new defaults is **7 / 7 green, the tape byte-identical**
(`p1/bombstand-check.txt`). Every solve there passes `withPressKillBombs(enabled, …)` explicitly, and PDS had already
measured OFF = ON on this staging. **No re-witness was needed.**

**OFF's identity proof** (`SEEDLING_PRESS_KILL_BOMBS=0` at P1 against W0's defaults):

| | W0 defaults | P1 at `=0` |
|---|---|---|
| identity block | `w0/identity-dflt.txt` | **every value row identical**. Only the reference row read *"2 differ"*, because the `seedling-bot.md` edit moved the generated word counts. After the regeneration it reads ALL MATCH (P2's block) |
| roster | 93 / 0 red | **93 / 0 red**, the same verdict per producer (sorted diff empty) |
| bounded failures | none | **none** (4,659 passed + the "ships ON" row skipped) |

**ON at P1:** identity = W0's ON, roster 93 / 0, bounded **4,660 / 4,660**.

**371 at P1** (`p1/census.txt`): **30 of 45**, byte-identical seam for seam to W0's `=1` arm.

Transitions from W0, over the period:

| W0 class | P1 class | phases |
|---|---|---|
| SOLVE | SOLVE | 22 |
| shake-throw | **SOLVE** | **8** |
| shake-throw | EXHAUSTED@break (bomb `#10` / the spinner) | 3 |
| shake-throw | EXHAUSTED@hold (bomb `#11`) | 2 |
| shake-throw | HAMMER_SAFETY(refuge)@break | 1 |
| HAMMER_SAFETY@kill t1339 | EXHAUSTED@hold | 3 |
| reboot@kill t1524 | EXHAUSTED@break | 1 |
| deadline@hold | shake-throw (seam 5243, § 5) | 1 |
| EXHAUSTED@break | HAMMER_SAFETY(refuge)@break | 1 |
| unchanged refusals (HAMMER_SAFETY@break ×2, EXHAUSTED@break ×1) | | 3 |

No solve was lost.

## 5. P2 — the refuge band catch

**The catch** (`solverBot.js`, `deriveRefuge`'s candidate loop):

```js
        let walk;
        try {
            walk = cut && best !== null
                ? previewWalkOrDeath(run, [{ x: c.x, y: c.y }], DEFAULT_TOLERANCE, { stopWhen: refugeEtaCut(best.eta) })
                : previewWalkOrDeath(run, [{ x: c.x, y: c.y }], DEFAULT_TOLERANCE);
        } catch (e) {
            /** ⛓ hammer-phase PKB — LB's HAND-OVER 5b … (docblock) */
            if (!PRESS_KILL_SHAKE_GUARD.enabled || !isShakeBandThrow(e)) throw e;
            PRESS_KILL_GUARD_COUNTS.shakeRefused += 1;
            continue;
        }
```

- **The counter is `shakeRefused`, not a sibling.** It is the guard's one band instrument, and a sibling would have
  meant editing `pressKillGuards.js`, which is out of scope.
- The death case stays `previewWalkOrDeath`'s (PDS). The band case wraps it, so a band throw that passes through PDS's
  `instanceof PhysicsV2Error` test (it fails that test and rethrows) lands here.
- Nothing else was touched: no `pressKillGuards.js`, no `previewWalk`, no refusal text.

**The rows** (`hammerPreviewDeathSweep.test.js`, 4 new rows, staged as PDS's deaths): the run's preview stepper throws
the forecast's own words on a chosen step.
- I did not commit the 371 seam-5226 state: the capture is 530 KB, and the staged form tests the same branch. 371's real
  state is in the census below.
- G1's witness at t1251: the band on (488,872) skips that refuge for **(488,856) at eta 16** (PDS's death answer), and
  `shakeRefused` counts **6**. Six of the twelve candidates' walks pass within 6 px of the banded spot (measured).
- Every preview banded → `null` (the kill's *"nowhere to be"*), not a throw.
- **Guard OFF rethrows** the band, and `shakeRefused` is unchanged.
- ON, an error that is not the forecast's band still throws: the live run's own `levelRun:` band words, and a defect.
- **The mutant** (the catch removed, i.e. a bare rethrow): rows 1 and 2 go red (`p2/mutant.txt`). The file was restored
  byte for byte (`cmp`).

**371 after P2** (`p2/census.txt`):

| arm | phases solving | vs the arm before |
|---|---|---|
| defaults (bombs ON) | **30 of 45** | **byte-identical to P1 on all 55 seams** |
| `SEEDLING_PRESS_KILL_BOMBS=0` (the band phases' fate) | 22 of 45 | vs W0's defaults: **11 of the 14 band phases → the kill's named refusal** (8 at the break stance, 3 at the kill), the same work units; **3 still throw**; no solve gained or lost |
| `SEEDLING_PRESS_KILL_SHAKE_GUARD=0` | — | **P2 = P1 (with the guard OFF) on all 55 seams**: answer, units and ok, byte for byte |

**What the band phases became:**
- **Bombs ON (shipped):** none of W0's 14 band phases reach the refuge preview's band any more. The flip reroutes them
  all (8 solve). The one band phase left at P1 and P2 is seam 5243, a former deadline phase. Its throw is built in
  `onScreenAt ← … ← swordTickAt ← dangerNow ← refuseDanger ← walkToUnder` (`p2/stack-5243-default.txt`): the walk's own
  danger read, not a candidate search, so P2 does not and should not catch it.
- **Bombs OFF:** 11 become the kill's *"no reachable cell in level 40 is clear of every live body's 7x7 rect and of the
  13 px hammer line … The room has nowhere to be."* They are a named refusal, not a solve. The 3 that still throw do so
  from `probeCorridor ← walkToUnder` (`p2/stack-5252-pkb0.txt`), the executor's gate that PDS left bare by design.

**Radius:**
- bounded set at P2's defaults: **4,664 / 4,664** (+ the 4 rows);
- roster: 93 / 0 at the defaults, at `PRESS_KILL_BOMBS=0` and at `PRESS_KILL_SHAKE_GUARD=0`;
- identity: = P1's ON, with the reference row now ALL MATCH;
- **L40, freshly captured.** I captured every L40 leg on the page at P2's tree (42 legs, **47 requests**: 31 done, 11
  failed; the same 47 as L371). I replayed each request at its own seam in a P1 worktree (`3bfb3cb3`) and in the P2
  tree (`radius/`):
  - **P1 vs P2: 47 of 47 identical, 0 movers** (solves 31 = 31; `shakeRefused` unchanged on every request);
  - P1's own radius, from the same requests at P1 `=0` vs P1 ON: **46 of 47 identical**. The one mover is (371, i 0) at
    seam 5278: solve → solve, 1736 t → 1915 t, 328 → 596 units;
  - on the page at P2's tree, 371 itself was `done` at seam 5278.

**The container restart.** It hit during the P2 census and the L40 capture.
- Every partial JSONL was parsed whole (no torn line).
- The census resumed by seam (`tools/census-resume.sh`), and the capture resumed by the ids it lacked.
- The tree and the P2 edit were intact (`cmp` against the scratch copy). The stale box lock was reclaimed by the tool
  itself.

## 6. D — the gates

| gate | result |
|---|---|
| bounded vitest (⚖ 52, by path, 148 files) | W0 4,660 / 4,660 · P1 ON 4,660 / 4,660 · P1 `=0` 4,659 + 1 skipped · P2 ON **4,664 / 4,664** |
| both `.slow` files, locally at P2 (`vitest.slow.config.js`) | **3 / 3**: post-sword 1–60 seats every seed in 471 s; pre-sword in 23 s; seed 30 certified in 35 s |
| `ci-producer-checks --jobs=4` | 0 red ON, at `PRESS_KILL_BOMBS=0` and at `PRESS_KILL_SHAKE_GUARD=0` (93 run, 1 skipped each) |
| identity block | § 3–5 |
| `census-seedling-solver-surface --check` | GREEN, 347 rows |
| `census-seedling-constants --check` | PASS (0 new, 0 vanished; 93 moved, line shifts) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, own server) | **ALL PASS, 415** |
| `seedling-bot-log.md` | `### Seedling hammer-phase PKB — the press kill's waits see the bombs, and the refuge preview refuses the shake band` |
| **JSUT** at `00d4ea78` (P2), run **40155792788** (`ci-vitest-summary.mjs`) | **suite 22,709 passed / 0 failed / 0 skipped; slow battery 268 / 268** |
| that run's gates (`ci-summary.mjs --run=40155792788 --gates`) | every row exit 0 |

**The MOVED rows** are the bank's age, not this slice's:
- the identity rows CI prints (acceptance `cf54cdf7`, killgate `7c15ed57` / `47116405` / `4d3bbf17`) are W0's own
  values, both with the bombs ON and OFF;
- the gate row-count growth and the two r7 producer md5s were attributed so by GF and PDS.

The D and report commits change docs only. JSUT re-runs on them, and the planner reads it there.

## 7. What the planner's harvest A/B should expect

**Steps that can move (P1):**
- Only rooms that hold a lobber or a bomb ask anything (`bombsInPlay`), and only `Dungeon4/2.oel` (L40) holds a
  BombPusher.
- Among the route's legs, expect **L40 only**, and inside L40 **only the press-kill leg
  `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`**. It should solve at about **30 of 45**
  arrival phases (two thirds), against 22 of 45 with the bombs OFF (the floor ON). Its answer depends on
  `seam.time mod 45`, so ×5 samples give a rate, not a verdict.
- Every other L40 key was identical at its captured seam (46 of 47 requests). This includes the two chest legs
  (`… -> location:Level 040 - Chest`, ids 387 / 404), which refuse at their arrivals both ways.

**P2:** expect **no route mover**. It engages only when a refuge preview throws the band, and with the bombs ON no L40
request reached that throw (0 of 47; 0 of 55 seams on 371).

**Generated levels:** not measured for a placed BombPusher. The identity block's generated rows (pairs, levels,
killgate) and both slow capacity rows are unmoved, ON and OFF.

**Should not move:** anything OFF; any room without a lobber; the 93 roster producers; bw-bombstand.

**`standing-values`:** nothing new. The acceptance batch is `cf54cdf7` both ways (main's move, PDS § 7). No `--write`.

## 8. What the brief got wrong (measured)

1. **"371: 8 of 45 by default, 22 with `PRESS_KILL_BOMBS=1`"** is `f9342f25b8`'s floor-OFF picture. At this base the
   floor is ON, so the baseline is **22**, and the flip takes it to **30** (L371's "both" number).
2. **"16 of 45 phases throw the shake band … in the refuge preview" (LB 5b) — at this base it is 14, and with the flip
   ON it is 0.** The flip reroutes every one of them before the refuge preview's band. So P2 moves nothing on the
   shipped path. Its value is the bombs-OFF path, and any future band on a candidate refuge: 11 of 14 become a named
   refusal at `=0`.
3. **The one band phase left is not 5b.** Seam 5243 throws from `walkTo`'s danger read (`refuseDanger` → `swordTickAt`),
   and at `=0` three throw from `probeCorridor`. Neither site is a candidate search.
4. **"Re-witness bw-bombstand if it moves":** it did not move (7 / 7, the tape byte-identical).
5. **"Re-pin every OFF-subject row or producer GF-style (pinned OFF + an ON sibling)":** no row or producer had an OFF
   subject that read the default. The one mover was a bombs-OFF arm inside a row whose ON arm already exists, so it is a
   pin, not a sibling.
6. **"Re-capture 5226 with `--capture-requests`":** I captured it (the page's seam is now 5257), but kept it out of the
   tree (530 KB). The unit rows stage the band, as PDS staged deaths.
7. **"`STRIKE_ETA_FLOOR_DEFAULT = true` … PDS's catch"**: both present, as stated.
8. **Branch:** the designated branch is `claude/seedling-press-kill-bombs-flip-8etz0m`.
9. **My own P2 commit message** says *"12 of W0's 14 band phases"*. That was a count over all 55 seams. Over one period
   it is **11 of 14** (this report and the bot log are right).
10. The bootstrap again left six submodules uninitialised after `READY`. I initialised them; no gitlink moved.

## 9. Residue and hand-overs

1. **The band still escapes at two non-candidate sites.** These are for the planner to assign, not this slice's scope:
   - `walkToUnder` → `refuseDanger` → `dangerNow` → `swordTickAt` → the chaser forecast (371 seam 5243, ON);
   - `probeCorridor` (the executor's gate; 3 phases at `=0`, and LB's 414 rows).

   Both are reads about the walk the run is about to take. A catch there decides what the executor does, so it is not
   a candidate refusal.
2. **LB's ask that an all-banded refuge "say the band hid them"** is not done. The kill's text still reads *"no
   reachable cell … is clear"*. That text lives in `execKillByPressOnce`, outside the brief's `deriveRefuge`-only scope.
   The bot log names it as a trap candidate.
3. **The CI probes, TT and the route sweep / survey A/B** are the planner's (`workflow_dispatch` is 403 from here). § 7
   is the expectation.
4. **`HAMMER_FIGHT_FALLBACK`'s shadow divergence at 5230** (L371 residue 3) was not touched.
5. **Hygiene:**
   - no stash, no force-push, nothing pushed to `main`;
   - no `pytest`, no unfiltered local vitest, no `standing-values --write`;
   - no AS3, wasm, gitlink, rules, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js`,
     `flashPanel/*` or `previewWalk` edit;
   - no other switch flipped;
   - the venv got `requirements-headless.txt` (untracked);
   - the P1 worktree in the scratchpad is removed by name; the dev server is killed by PID.
