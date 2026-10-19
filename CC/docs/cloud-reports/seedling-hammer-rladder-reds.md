# Seedling hammer-phase RR — the orphaned R-ladder producer reds, then a CI row

Session `seedling-hammer-rladder-reds` (cloud, Opus). Planner: `seedling-hammer-phase-planning-2`. ⚖ Approved by the
user on 2026-10-19.

## 1. SHAs

- **Start:** `d8fa8e0b19` (origin/main at the fetch). Brief tag: "`76a4dacb7f`" for the planner's worktree.
- **Head:** the commit that adds this report (its parent is `bec3878f76`, the mutant revert). The code under test is identical to `acea26d78d`; only docs and this report land after it.
- **Branch:** `claude/seedling-rladder-reds-gagh13`. The harness designated this branch; the brief named
  `seedling-hammer-rladder-reds`. Nothing was pushed to `main`.

## 2. W0 — the sweep at `d8fa8e0b19`

Every `scripts/procgen/plan-seedling-*.mjs --check` (90 files, not 42) plus `regenerate-r3-tapes` and
`regenerate-r4-tapes`, run serially, with no dev server.
- **Total:** 619 s of box time.
- **Not 1 s each:** `hammer-sf-strikefloor` took 205 s and `hammer-g1-ghostkill` took 145 s.

**Red at base, 8 rows:**

| producer | rc | first failing line |
|---|---|---|
| `plan-seedling-pushblock-witness` | 1 | `FAIL: the committed pushblock-l65-sword-press is what this script produces today — ⛔ DRIFT` |
| `plan-seedling-r5-conch` | 1 | `buildTape: pins is a version 5 field … must also declare equips` |
| `plan-seedling-r5-feather` | 1 | the same |
| `plan-seedling-r6-shieldboss` | 1 | `FAIL ⛔⛔ THE TAG PRECEDES THE CORPSE BY 23 AND THE CORPSE THE REMOVAL BY 11` |
| `plan-seedling-r7-attribution` | 1 | `--check: value-change set DRIFTED — got , recorded r3-collect-sword, r3-walk-1-sword, r3-walk-full` |
| `plan-seedling-r7-ends-meet` | 1 | `page.goto: net::ERR_CONNECTION_REFUSED` (no server). **Green (rc 0, CHECK CLEAN) with a server on :8000**, so it is not a real red |
| `regenerate-r3-tapes` | 1 | `DIFFERS r3-walk-3-torch` and `DIFFERS r3-walk-full` |
| `regenerate-r4-tapes` | 1 | `DIFFERS r4-walk-3-torch` and `DIFFERS r4-walk-full` |

All other rows were green (rc 0). That includes `regenerate-r2-tapes` (`0 tape(s) differ`), which the item-4 glob also
enrols.

<details><summary>The full table (rc, seconds)</summary>

| producer | rc | s | first failing line |
|---|---|---|---|
| `plan-seedling-axe-witness` | 0 | 12.1s |  |
| `plan-seedling-bobsoldier` | 0 | 0.5s |  |
| `plan-seedling-bobsoldier2` | 0 | 2.0s |  |
| `plan-seedling-bulb` | 0 | 0.5s |  |
| `plan-seedling-burn-witness` | 0 | 0.8s |  |
| `plan-seedling-c1-static-sword` | 0 | 15.8s |  |
| `plan-seedling-crusher-witness` | 0 | 10.7s |  |
| `plan-seedling-encounters` | 0 | 19.0s |  |
| `plan-seedling-f1-l5-lock` | 0 | 0.5s |  |
| `plan-seedling-f1-l5-open-lock` | 0 | 1.2s |  |
| `plan-seedling-f1c-l18-lock` | 0 | 0.6s |  |
| `plan-seedling-f1c-l18-phase` | 0 | 14.7s |  |
| `plan-seedling-f4-l8-sandtraps` | 0 | 1.1s |  |
| `plan-seedling-f6-reentry` | 0 | 0.4s |  |
| `plan-seedling-f7-reentry` | 0 | 0.4s |  |
| `plan-seedling-frontier3-witness` | 0 | 1.1s |  |
| `plan-seedling-ghostmotion` | 0 | 0.3s |  |
| `plan-seedling-ghostsword` | 0 | 0.4s |  |
| `plan-seedling-hammer-a-escape` | 0 | 11.3s |  |
| `plan-seedling-hammer-b1-approach` | 0 | 8.0s |  |
| `plan-seedling-hammer-b2-fight` | 0 | 10.5s |  |
| `plan-seedling-hammer-bw-bombstand` | 0 | 21.5s |  |
| `plan-seedling-hammer-c2-ghost` | 0 | 0.4s |  |
| `plan-seedling-hammer-d-ghostwall` | 0 | 0.7s |  |
| `plan-seedling-hammer-dd-walkkill` | 0 | 2.6s |  |
| `plan-seedling-hammer-g1-ghostkill` | 0 | 144.5s |  |
| `plan-seedling-hammer-sf-strikefloor` | 0 | 205.4s |  |
| `plan-seedling-l12keyline-witness` | 0 | 3.7s |  |
| `plan-seedling-l14-swordless` | 0 | 1.4s |  |
| `plan-seedling-l30keylock` | 0 | 8.5s |  |
| `plan-seedling-l40button-witness` | 0 | 19.6s |  |
| `plan-seedling-ladder2-witness` | 0 | 1.9s |  |
| `plan-seedling-proximity-witness` | 0 | 2.3s |  |
| `plan-seedling-pushblock-witness` | 1 | 2.0s | FAIL: the committed pushblock-l65-sword-press is what this script produces today — ⛔ DRIFT — re-run with |
| `plan-seedling-r1-dark-suit` | 0 | 0.6s |  |
| `plan-seedling-r1-route` | 0 | 1.3s |  |
| `plan-seedling-r2-route` | 0 | 11.5s |  |
| `plan-seedling-r2-singles` | 0 | 0.4s |  |
| `plan-seedling-r2-wallflyer` | 0 | 0.3s |  |
| `plan-seedling-r3-death` | 0 | 0.4s |  |
| `plan-seedling-r3-route` | 0 | 4.6s |  |
| `plan-seedling-r4-route` | 0 | 4.7s |  |
| `plan-seedling-r4` | 0 | 0.4s |  |
| `plan-seedling-r5-bobboss` | 0 | 0.2s |  |
| `plan-seedling-r5-bosskey` | 0 | 0.5s |  |
| `plan-seedling-r5-conch` | 1 | 0.6s |         throw new Error('buildTape: pins is a version 5 field and version 5 is version 4 ' |
| `plan-seedling-r5-feather` | 1 | 0.8s |         throw new Error('buildTape: pins is a version 5 field and version 5 is version 4 ' |
| `plan-seedling-r5-karlore` | 0 | 0.4s |  |
| `plan-seedling-r5-l37-burn` | 0 | 0.6s |  |
| `plan-seedling-r5-l40-join` | 0 | 1.5s |  |
| `plan-seedling-r5-l40-part0` | 0 | 1.5s |  |
| `plan-seedling-r5-l40-part1` | 0 | 0.8s |  |
| `plan-seedling-r5-l40-part5` | 0 | 3.9s |  |
| `plan-seedling-r5-l41-part3` | 0 | 2.2s |  |
| `plan-seedling-r5-l42-part4` | 0 | 3.0s |  |
| `plan-seedling-r5-l43-wand` | 0 | 0.3s |  |
| `plan-seedling-r5-l60-kill` | 0 | 0.1s |  |
| `plan-seedling-r5-shaft` | 0 | 1.9s |  |
| `plan-seedling-r5-swim` | 0 | 0.4s |  |
| `plan-seedling-r5-totem-entrance` | 0 | 0.9s |  |
| `plan-seedling-r5-waterfall` | 0 | 0.4s |  |
| `plan-seedling-r6-shieldboss` | 1 | 0.5s | FAIL ⛔⛔ THE TAG PRECEDES THE CORPSE BY 23 AND THE CORPSE THE REMOVAL BY 11 |
| `plan-seedling-r6-wblood` | 0 | 0.7s |  |
| `plan-seedling-r6-wdoor` | 0 | 0.3s |  |
| `plan-seedling-r6-wowl` | 0 | 0.7s |  |
| `plan-seedling-r6-wseed` | 0 | 0.5s |  |
| `plan-seedling-r6-wtalk` | 0 | 0.3s |  |
| `plan-seedling-r7-attribution` | 1 | 16.8s |  |
| `plan-seedling-r7-ends-meet` | 1 | 2.4s |   name: 'Error' |
| `plan-seedling-r8-hammer-pair` | 0 | 1.1s |  |
| `plan-seedling-r8-l18-spinner` | 0 | 0.6s |  |
| `plan-seedling-r9-l0-sword-dash` | 0 | 0.3s |  |
| `plan-seedling-r9-l6-bob-press` | 0 | 0.3s |  |
| `plan-seedling-r9-l6-harmless-window` | 0 | 0.6s |  |
| `plan-seedling-r9-l6-sword-dash-hit` | 0 | 0.4s |  |
| `plan-seedling-return-l15` | 0 | 0.4s |  |
| `plan-seedling-sealdoor-witness` | 0 | 0.6s |  |
| `plan-seedling-slots-witness` | 0 | 1.4s |  |
| `plan-seedling-stance-witness` | 0 | 3.9s |  |
| `plan-seedling-u10-puncher-dwell` | 0 | 0.5s |  |
| `plan-seedling-u11-dark-shield` | 0 | 0.4s |  |
| `plan-seedling-u11-facing` | 0 | 0.3s |  |
| `plan-seedling-u12-pull` | 0 | 0.4s |  |
| `plan-seedling-u14-moonrock` | 0 | 0.3s |  |
| `plan-seedling-u15-turret` | 0 | 0.4s |  |
| `plan-seedling-u7-puncher` | 0 | 0.4s |  |
| `plan-seedling-u9-shield-bump` | 0 | 0.4s |  |
| `plan-seedling-wallflyer` | 0 | 0.4s |  |
| `plan-seedling-wand-witness` | 0 | 0.7s |  |
| `plan-seedling-watcher-witness` | 0 | 2.0s |  |
| `plan-seedling-watchertalk-witness` | 0 | 0.5s |  |
| `regenerate-r3-tapes` | 1 | 5.5s | DIFFERS r3-walk-3-torch: 1947 ticks, 11 legs, 10 transitions, 1 grants, 1 collect(s), 0 touch(es), 0 hold(s),  |
| `regenerate-r4-tapes` | 1 | 4.4s | DIFFERS r4-walk-3-torch: 1947 ticks, 11 legs, 10 transitions, 1 grants, 1 collect(s), 0 spear(s), 0 keylock(s) |
</details>

## 3. D1 — per item

### Item 1: `plan-seedling-r5-conch` — PASS (`38b4ce1e2a`)
- **Cause:** `84ebe05dcb` made `buildTape` refuse a v5 tape (`pins`) that does not also declare `equips` (v4).
- **First bad:** `84ebe05dcb`. Measured: its parent gives rc 0, it gives rc 1.
- **Fix:** `equips: []` in the `synthesizeLegs` relax, next to `pins:`.
- **md5:** `--write` emits `r5-d5-conch.json` byte-identical: `3651f059d97e47b1e682bda2c404fae4` committed and emitted.
  `--check` goes from rc 1 to rc 0.

### Item 2: `plan-seedling-r5-feather` — PASS on the check, and a hand-over on the tape (`884372f6ef`)
- **Two stacked reds:**
  - `84ebe05dcb`, the same as conch. Fixed with `equips: []`.
  - **`bb156222b6`** ("R7 slice 6 — R6 debt 2 paid, a pickup's own tag reaches earnedClears"). Bisected with the
    `equips` patch applied at every step: `84ebe05dcb^` is good and the head is bad.
- **Which set is honest:** `{89,0}` in `earnedClears`. `Feather.as:45` runs `setPersistence(tag, false)`, and
  `PICKUP_CLEARS_OWN_TAG.feather` cites it. So the walk did turn off that flag itself, and the model was deliberately
  taught to say so.
- **Fix:** check-side. The wanted opener set is the declared `earnedClears` entries plus each declared pickup whose class
  is in the model's `PICKUP_CLEARS_OWN_TAG` (derived from that table, not listed). `FEATHER_EARNED` and `r5Feather.js`
  are untouched.
- **Route:** the old route still works and is unchanged: transitions 87→92@652, 92→91@1076 and 91→89@1311, the same two
  rock presses, and the feather collected. `--check` goes from rc 1 to rc 0.
- **⚠ md5 — the tape does NOT match.** The committed fixture is `6687b626b3ec0a84c21b380927bd92e5` (1735 t). `--write`
  emits `f31689689f4103f51b56bae529137511` (1534 t).
  - First bad (emission bisect, with the `equips` and opener patches applied and the tape written to scratch): **`5ec1edb6bd`**
    ("swim T2 D1: the planner prices a swum water node", `WATER_STEP_COST` in `botDriverV2.js`).
  - `291d412cce` (the fixture's commit) and `84ebe05dcb^` both emit the fixture byte-identical.
  - `--check` never compared bytes, so it does not see this. → Hand-over (§7).

### Item 3: `plan-seedling-r6-shieldboss` — PASS (`3632487ece`)
- **Cause:** the check expected 3 kill rows. The run logs 4: `tag@409 → destroy@432 → removeRequested@443 → removed@444`.
  `shieldBossDeathSchedule` derives all four (409/432/443/444).
- **First bad:** `3b37466df7`, its own introducing commit.
- **Choice: assert the 4-entry sequence.** Each row is asserted against its derived tick, and `removed` must be
  `removeRequested + 1`. I chose not to filter, for three reasons:
  - `removeRequested` is a real instant (`FP.world.remove` is CALLED while the body is still a wall).
  - `solverBot.js:15737` reads that row.
  - The check's own name, "THE CORPSE THE REMOVAL BY 11", is destroy→removeRequested (432→443); destroy→removed is 12.

  Asserting it means that losing or moving the row still turns the check red.
- **Result:** `--check` goes from rc 1 to rc 0.
- **⚠ md5:**
  - `r6-shield-control.json` is byte-identical (`fb85ac701e3218284c89eb9eafea239a`).
  - `r6-shield-kill.json` is committed as `0772c3535f2b9e21d81402a96b4a4335` and emitted as `155fe646cee8fc5b63982990b28093f5`.
    The emitted tape is the same everywhere except that it is one tick later (tick_count 653→654, the 5 talk presses
    458→459…).
  - That emission is identical at `3b37466df7` (with the check bypassed), so the committed kill tape has **never** been
    this producer's output: its check was red, and `--write` exits before writing. This is not new drift. → Hand-over.

### Item 4: `regenerate-r3-tapes` / `regenerate-r4-tapes` — STOP (the honest fix is a re-record)

**Field-by-field diff (emitted vs committed):**
- `r3-walk-3-torch`: `inputs` and `tick_count` differ (1947 emitted vs 1964 committed). The first input difference is #32,
  `left 386→410` vs `386→406`.
- `r3-walk-full`: 12105 vs 12122. The first difference is #242, at tick 2500, which is the same torch segment.
- `r4-walk-3-torch` is the same as the r3 tape.
- `r4-walk-full`: 10035 vs 10052, plus `equips` `t 6198` vs `6215`.
- All four also differ in **formatting**. `f2baacde0a` re-pinned them by text as `"pins": ["dead_frames"]` on one line,
  while `serializeTape` writes the array over three lines (the other r3 tapes, emitted by the regenerator, are
  multi-line).

**First bad: `0670ca91e6`** ("seedling fidelity WATCHERFLIP D1: release WATCHER's held silent squares").
- Bisect criterion: `inputs` and `tick_count` equal to head's fixture.
- Good: `d8aa19a7c2`, `84ebe05dcb^`, `5ec1edb6bd^` and `5ec1edb6bd`.
- Confirmed for r4 separately: `0670ca91e6^` reproduces the route and `0670ca91e6` gives 10035 t.

**Why STOP:**
- A silent watcher stopped being a planner volume, and that is an honest model change. The synthesizer now finds a route
  17 ticks shorter through the torch segment.
- Reproducing the committed route would need the spec to put a false obstacle back, which is not a fix. Agreement needs a
  re-record, which the brief forbids while R7 is in flight.
- The `pins` formatting would then need either the re-record (multi-line) or a regenerator special case.

No file changed for this item; the CI handles it as KNOWN_RED (D2).

### Sweep extras (in scope: the fix was in the producer or its check)
- **`plan-seedling-pushblock-witness` — PASS (`989d652870`).**
  - First bad: `f2baacde0a` (parent rc 0, it rc 1). That commit's text re-pin moved the AUTHORED fixture
    `pushblock-l65-sword-press` to v5 with a one-line `pins`, and the producer still authored v4 with no pins.
  - Fix: the producer authors v5 + `pins: ['dead_frames']`, emitted on one line.
  - The fixture is byte-identical and unchanged (`7e5d12c1eccd7b2ad55a966809357ac0`). The model's no-move verdict holds
    under the pin.
- **`plan-seedling-r7-attribution` — PASS (`9dfd90ffa6`).**
  - First bad: `f2baacde0a` (parent rc 0, it rc 1). The re-pin moved R7's three recorded v≤3 tapes to v5, and
    `predictedAttribution` only moves v≤3 values.
  - Fix: the check names each recorded tape that left the v≤3 domain and compares the rest. A recorded name that is
    missing, or still v≤3 and not derived, still reads DRIFTED.
  - `R7_BATCH` is untouched; `r7Acceptance.test.js` pins it at length 3.
- **`plan-seedling-r7-ends-meet`** — not a red (it needs a server). It is CI-excluded in D2.

**No committed tape, fixture, expectation or pin changed on the branch**: `git diff d8fa8e0b19..HEAD -- '*fixtures*'` is
empty. Every `--write` probe went to scratch or was restored by name.

## 4. D2 — the CI job

- **Script:** `scripts/procgen/ci-producer-checks.mjs`.
  - The roster is a glob: `scripts/procgen/plan-seedling-*.mjs` and
    `frontend/modules/seedlingDemo/fixtures/regenerate-*-tapes.mjs`. That is 93 files; `regenerate.mjs` has no
    `--check` and the glob leaves it out.
  - It runs producers in parallel (`--jobs`, default = cores) with a per-producer deadline. It prints
    `## PRODUCER | name | rc | s | first failing line` for each and `## PRODUCER-DONE` at the end, and exits 1 on any
    red.
  - **It is also red when:** the battery moves `git status --porcelain`; a file names neither `--check` nor `--write`
    (it is not spawned, because nothing says it is dry); or an exclusion or known-red names no enrolled file.
  - The HELP and IMPORT doors are inert: `check-procgen-help --only=ci-producer-checks.mjs` gives ALL PASS.
- **Named, not hidden:**
  - `EXCLUDED`: `plan-seedling-r7-ends-meet`. Its `--check` drives the wasm game in Chromium on a dev server, and it
    already runs as a browser arm in the `browser-gates` matrix.
  - `KNOWN_RED`: `regenerate-r3-tapes` and `regenerate-r4-tapes`. They run, and they pass only while their
    `DIFFERS`/`FAIL` name set is exactly the declared tapes. If any other tape drifts, or the debt is paid, the row is red.
- **Home:** the `producer-checks` job ("Producer --checks") in `.github/workflows/unittests_frontend.yml`, beside
  `headless-gates`.
  - It sits behind the same `already-green` guard and inherits the workflow's path filters (`frontend/**`,
    `scripts/**/*.mjs`, …).
  - Unlike the reader above it, it has **no** `continue-on-error`.
  - It checks out no submodules. Measured: in a worktree with none initialised, all 90 plans and r2 are rc 0, and only
    the declared r3/r4 are red.
- **Green at head:** run **39335594476** at `acea26d78d`, job "Producer --checks" (118344763617), **success**:
  `## PRODUCER-DONE | 93 run | 0 red | 1 skipped | 2 known-red`.
  - It took 4 m 03 s for the step (`--jobs` 4).
  - The slowest producers were `hammer-sf-strikefloor` (197 s) and `hammer-g1-ghostkill` (162 s).
  - r3/r4 ran as declared.
- **Mutant:** `45e7527c72` dropped `equips: []` from `plan-seedling-r5-conch`.
  - It was pushed to this branch only, never to main.
  - Run **39337098834**, job 118349317052, **failure**: `## PRODUCER-DONE | 93 run | 1 red`, with exit 1 on the
    `buildTape … must also declare equips` throw.
  - The mutant was dropped by a revert commit, `bec3878f76`, not by a force-push (the brief forbids force-pushes).
    `--check` is rc 0 again locally after the revert.

## 5. D3
- `seedling-bot-log.md`: entry `### Seedling hammer-phase RR — the orphaned R-ladder producer reds, and the CI row`.
- `generate-procgen-reference.mjs` regenerated (444 instruments). `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN
  REGIONS MATCH THE CODE`. `generate-docs-index.mjs` was run too.
- Bounded vitest over the tests that pin touched files (found with `rg -a`): `r7Acceptance.test.js`,
  `ciDocsOnly.test.js`, `ciGatePlan.test.js` and `ciSummary.test.js` — **4 files, 209 passed**. No unfiltered run
  (⚖ 52).

## 6. What the brief got wrong (measured)
- **"42 files":** there are 90 `plan-seedling-*.mjs`, plus 3 `regenerate-*-tapes`.
- **"each takes about 1 s":** the sweep is 619 s; two producers are 145 s and 205 s.
- **Item 2:** the drift is not a route change. The model gained a ledger family at `bb156222b6`, the route still works,
  and the honest set is the walk's `[89:0, 91:29]`. But the feather tape has *separately* drifted (`5ec1edb6bd`), which
  the brief did not know.
- **Item 3:** the fix was check-side as briefed, but the kill tape was never the producer's output (1 tick off since its
  own commit).
- **Item 4:** "fix the producer or its spec so they agree" is not possible honestly. The first bad commit is a model
  change (`0670ca91e6`), and the text re-pin's one-line `pins` cannot be produced by `serializeTape` anyway.
- **Unlisted reds at base:** `pushblock-witness` and `r7-attribution`, both from `f2baacde0a`, today's re-pin commit,
  which the brief's planner worktree (`76a4dacb7f`) may predate.
- **The brief's base vs mine:** I measured at `d8fa8e0b19`.

## 7. Residue / hand-overs
1. **Re-record `r3-walk-3-torch`, `r3-walk-full`, `r4-walk-3-torch` and `r4-walk-full`** (cause `0670ca91e6`). The
   re-record also normalises their `pins` formatting. Then drop their `KNOWN_RED` entries; the CI row goes red until
   that is done. Owner: whoever does R7's re-record.
2. **`r5-feather.json` is no longer its producer's output** (1735 → 1534 t, cause `5ec1edb6bd` `WATER_STEP_COST`). It
   needs either a re-record or a planner opt-out in `botDriverV2.js`, which was read-only here.
3. **`r6-shield-kill.json` is 1 tick earlier than its producer emits** (since `3b37466df7`). Decide which is right
   against the game (the kill's key contact, `contactTick`), then re-record or fix the producer's `TALK_FROM`
   derivation.
4. **A `--check` that never compares bytes.** `r5-conch`, `r5-feather` and `r6-shieldboss` assert their plans but never
   compare the emitted tape to the fixture (pushblock-witness and the regenerators do). Adding the comparison would turn
   items 2 and 3 red today, so it belongs with hand-overs 2 and 3.
5. The `solve-seedling-*` producers are not in this glob. They run as standing identity rows in `headless-gates`, which
   is a reader (`continue-on-error`), not a merge gate.
