# Seedling fidelity GATESUBJ — three stale browser-gate subjects re-pointed by search, and reds that no longer hide

**Slice:** `seedling-fidelity-gatesubj`, an Opus build session for the Seedling model-fidelity arc (planner `seedling-fidelity-planning-9`). ⚖ The user chose it on 2026-10-21 (*"Cloud slice"*).

| | |
|---|---|
| Started from | `f1b4f85446` (= `origin/main` at start; LIGHTS + IGNEOUS on, switches OFF) |
| Harness branch | `claude/seedling-gate-subjects-hz4f53` (the harness pushes only there) |
| Commits | D4 `3d1a1bcb` · D2 `2a8152a6` · D1 `edc1236f` · D3 `65dd95ba` + `6dd3ddfb` · log `9ae1184f` · D4 fix `26fbfb26` · reference `ea4a9fe2` · this report |
| Last code head | `ea4a9fe2` |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | All three CI failures reproduced locally, verbatim: demos 260/1, phases 90/1, refusal 15/5. |
| D1 | **PASS** (grid moved; see below) | Demo 9 names pre-sword/killgate seed 1. The demos gate asserts the literal equals the shared search and prints the line to paste on a mismatch. |
| D2 | **PASS** (grid moved) | `droppedElementSubject.js`: pre-sword/killgate, a certification drop with geometry, smaller seed wins, ceiling 200. The phases gate is 94/0. |
| D3 | **PASS** | Row 1 walks a measured 6-row candidate list. Candidate 1 (L6 `r8-l6-bob-contact` → `exit:224,32`) holds with 17 queries and 0 dangerous. Gate 21/0. |
| D4 | **PASS** | `CI_GATE_EXPECTED_RED` plus `ci-expected-red.mjs` run after each gate shard. In its first real run it failed jobs by name, including one red that I introduced myself. |

**The one thing to know first.** The brief's grid for D1/D2, post-sword + killgate, is **dry**. Through `generateStep`, seeds 1..1000 hold **no certification drop at all**. The 15 cells that do not place are all `wall-does-not-seal` placement refusals: 26, 28, 118, 308, 347, 405, 409, 574, 634, 725, 804, 863, 906, 924, 953. They never reach a certification and carry no geometry. No ceiling would have revived that search, because the solver now walks every post-sword kill gate it is given (`HAMMER_ESCAPE` on). I moved the grid to **pre-sword + killgate**. Every placed seed there drops at the certification **with** geometry: the boot holds no sword, so the drop is the biome's and no solver change can revoke it. The planner may prefer a different grid. The search is one constant (`DROPPED_GRID`), and the gates follow it.

## W0 — the base, measured

Server: `python3 scripts/serve-nocache.py 9705` (PID 901). All three runs used `--host=http://localhost:9705`.

| Command | Output | Exit |
|---|---|---|
| `check-seedling-editor-refusal.mjs` | 15 PASS / 5 FAIL. Row 1 reads `status=ok`, then `undefined recorded query(s)` and `NO dangerSources field`. Rows 2–4 and L11 pass (97 t against the tape's 97; chest gone at tick 6). | 1 (12 s) |
| `check-seedling-editor-phases.mjs` | 90 / 1: `NO seed in 1..20 drops its element; this claim has no subject` | 1 (21 s) |
| `check-procgen-demos.mjs` (standalone) | 260 / 1: `elements.refused.reason = null` | 1 (424 s) |

These are CI's lines verbatim (job 119026462651, run 39540239745). The run's other two red arms came from headless shard 0: `seedling-hammer-monotonicity` and `seedling-rewind-exactness`, both `0/0 | exit=1 | (no total)`. `seedling-full-tier-owed` read `2/0/1 | exit=0` (green) at that run.

Bounded unit tests: `npx vitest run` over `seedlingConstantsCensus`, `procgenDocs/generated`, `watchGenerate`, `watchGenOverlay`, `levelRun`, `activators` and `ciExpectedRed` (the test files that `grep -a` the subjects are `levelRun.test.js` and `activators.test.js`, for `l71-shieldlock-open`). Result: **7 files, 451 tests, all pass**, measured at the D1/D2 tree. None of these files reads anything D1–D3 changed except the generated reference.

⚠ `generated.test` fails locally until `frontend/modules/bulletml-dodge` is initialised. `session_bootstrap.sh --seedling` leaves it out, and `noiz2saPricing.js` imports from it. With it initialised, the reference check is green. Local environment only; CI checks out every submodule.

## D2 — the phases gate (`2a8152a6`)

**Measurement.** `generateStep({seed, biome, step: 0, elements: {name: 'killgate'}})` is the page's own entry point.

| Grid | Range | Time | Certification drops | Other non-placed cells |
|---|---|---|---|---|
| post-sword / killgate | 1..400 | 191.6 s (~2.1 seeds/s, contended box) | **0** | `wall-does-not-seal`: 26, 28, 118, 308, 347 |
| post-sword / killgate | 401..1000 | 289.7 s | **0** | `wall-does-not-seal`: 405, 409, 574, 634, 725, 804, 863, 906, 924, 953 |
| pre-sword / killgate | 1..200 | 1.0 s | every placed seed (1..25, 27, 29..117, 119..200), each **with geometry**, `the-skeleton-does-not-solve-with-the-element` | `wall-does-not-seal`: 26, 28, 118 |

**Today's drop list** (seed, geometry y/n): post-sword, none. Pre-sword: 1 y, 2 y, 3 y, … every placed seed y. A 30-seed scan of all 13 elements × both biomes is in the evidence below. It shows certification drops in post-sword only for elements whose key the boot lacks (shieldgate, watergate, watershortcut) and for `guard` 12, 13.

**Change.** `scripts/procgen/droppedElementSubject.js` holds `DROPPED_GRID`, `DROPPED_CEILING = 200`, `isCertificationDrop` (`ran === false`, `certified === false`, a reason, `placed.length > 0`), `findDroppedSubject(generateStep)` and `dryGridMessage()`. The phases gate imports it in place of its local 1..20 loop. A dry grid still refuses by name, with the ceiling in the message.

**Gate.** `check-seedling-editor-phases.mjs --host=…:9705` printed 94 PASS / 0 FAIL, exit 0. It reports `dropped element = seed 1 (the-skeleton-does-not-solve-with-the-element)`, the overlay draws no element group, and the reason is a legend row.

**Mutant.** I copied the module, forced it back to post-sword with ceiling 20, and restored it (md5 `561be052…` before and after). Predicted 90 / 1 naming the dry grid; measured **90 / 1, exit 1**: *"NO seed in 1..20 of post-sword/killgate drops its element at the CERTIFICATION with geometry; this claim has no subject"*.

## D1 — demo 9 (`edc1236f`)

**Choice: the gate asserts the catalogue literal equals the search.** I did not generate the catalogue row from the search. `demos.js` is static data with three readers: this gate, `demos.html` (a browser page, on GitHub Pages too) and the generated reference. A search in the module would run the generator on every page load and make the reference non-deterministic. `check-procgen-demos.mjs` now carries `SEARCHED_SUBJECTS` (keyed by entry id). For `dropped-element` it runs the shared search and asserts that the `url`'s and the `cli`'s `seed`/`biome`/`elements` equal the result. On a mismatch, the detail is the line to paste.

**Change.** In `demos.js` row 9, the url is now `seed=1&biome=pre-sword&…&elements=killgate` and the cli is `--seed=1 --biome=pre-sword`. One sentence was added to `demonstrates`: the subject is a pre-sword kill gate. No other doc quoted the old subject; the other `seed=3&biome=post-sword` mentions are different demos.

**Gate.** `--only=dropped-element` gave ALL CHECKS PASSED, exit 0. The CLI ran with exit 0 in 0.4 s, and the claim holds (`elements.refused.reason = "the-skeleton-does-not-solve-with-the-element"`). The reference regenerates byte-identical for `catalogue.js`.

**Mutant.** I put the url and cli back to `seed=3&biome=post-sword` and restored afterwards (md5 `f91f1b78…` before and after). Predicted 3 FAIL; measured **3 FAIL, exit 1**:
- the url, with `paste into demos.js: url: 'source=generate&seed=1&biome=pre-sword&…'`;
- the cli, with its paste line;
- the claim, with today's `elements.refused.reason = null`.

## D3 — the refusal row (`65dd95ba`, `6dd3ddfb`)

**Measurement** (U1's method). This was a Node sweep of `solveForPage`, the page's own call, over every committed tape's own boot × every usable census goal. It covered 289 tapes and 1,304 solves: 802 ok and 502 refused. Seven tapes hit the 120 s per-tape limit partway: `r4-iceturret-bobs`, `r5-l40-join`, `r5-l40-join-control`, `r5-press-delay`, `r5-press-delay-control`, `r5-press-glide` and `r5-press-repeat`. Node and the page agree on L71 → `exit:304,96`: **ok** in both (186 t in Node).

**Every EXHAUSTED ladder refusal in the atlas today** (17; each has `dangerQueries > 0` and `dangerous = 0`, which is §17.5's theorem holding atlas-wide):

| Boot tape (own boot) | L | Goal | Queries | First danger source |
|---|---|---|---|---|
| **`r8-l6-bob-contact`** | 6 | `exit:224,32` | 17 | `enemy:sandtrap@64,16` (static) |
| `frontier3-l62-door-niche` | 62 | `exit:48,304` (also `96,304`, `192,304`, `240,304`) | 6 | `enemy:darktrap@112,208` (static) |
| `pushblock-l65-sword-press` | 65 | `exit:128,0` | 7 | `enemy:darktrap@144,144` (static) |
| `prox-l40-turret-volley` | 40 | `exit:944,96` (also `848,0`, `place:64,144`, `place:656,528`) | 9 | `enemy:iceturret@472,400` (static) |
| `r2-terrain-killlock` | 5 | `exit:80,16` | 7 | `chaser:bob@16,64` |
| `bobsoldier-sword` | 30 | `place:64,64` | 7 | `chaser:bobsoldier@48,80` |
| `r3-collect-torch`, `r5-bosskey-lock-shut` | 30 | `place:64,64` | 7 | `chaser:bobsoldier@48,80` |
| `r4-iceturret-bobs` | 40 | `place:160,640`, `place:880,816`, `exit:320,576` | 7 | `chaser:bob@352,448` |

⚠ **No refusal anywhere is sourced from a `hazard:`.** L71's spinning axe was the last one, and AXE D2's dodge solved it. Every remaining subject is a body, and a later kill or removal rung could clear it. That is why the gate walks a list rather than holding a literal.

**Change.** `ROW1_CANDIDATES` holds six rows: the first row of each distinct room above, static enemies before chasers, then by level. The gate solves them **in the page**, in order. The first whose readout is the ladder's own refusal (`refused`, `combat ladder is EXHAUSTED`, `dangerQueries > 0`) is row 1. Every candidate is printed as `tried` or `not tried`, and a dry list refuses by name. The zero (`dangerousQueries === 0`, `dangerSources` empty) and the on-screen line remain **claims about** the chosen subject, not selection criteria, so selection cannot make them vacuous. Rows 2–4 and the L11 row are unchanged, and they still pass at today's head: 97 t, chest gone at tick 6.

**Gate.** 21 PASS / 0 FAIL, exit 0, with `candidate 1 of 6`. Row 1: `refused, 17 query(s), EXHAUSTED`, then `0 dangerous, 0 reason(s)`, and the page says *"the danger the bot was told: 17 query(s), 0 DANGEROUS — every gate this walk reached answered CLEAR"*.

**Mutant.** I set the list to the stale L71 row alone and restored afterwards (md5 `c73c7c84…` before and after). Predicted 14 / 1 with the five row-1 claims not run. Measured **14 PASS / 1 FAIL, exit 1**: `tried l71-shieldlock-open → exit:304,96: ok` and *"NONE of the 1 candidate(s) is still the ladder's own refusal with a recorded population"*. Base said "five checks fail"; the new shape says one, and names the cause, instead of five dead checks.

## D4 — the expected-red table (`3d1a1bcb`, fix `26fbfb26`)

**Change.**
- `scripts/procgen/ciExpectedRed.js` holds `CI_GATE_EXPECTED_RED` (rows `{owner, why, since}`, keyed by the CI key) and a pure `judgeExpectedRed(log, table, knownKeys)`.
- `scripts/procgen/ci-expected-red.mjs <log>` is the CLI.
- `unittests_frontend.yml` gains one step, `Expected reds only? (shard …)`, after each headless and browser shard's `Battery complete?` (`if: !cancelled()`).

The gate steps keep `continue-on-error`, and no other arm or step was reordered or reworded. The judge fails in four cases:
- `UNEXPECTED-RED`: a non-zero exit, not listed;
- `NOW-GREEN`: a listed arm printed `exit=0` — "drop its entry";
- `STALE`: a listed key names no CI arm of any set;
- `NO-GATE-LINES`: the log carries no gate line.

A listed arm absent from the log belongs to another shard (`ELSEWHERE`) and is named, not judged.

**The table as seeded** (what is red at my head besides my three):

| Arm | Owner | Why | Since |
|---|---|---|---|
| `gate: seedling-hammer-monotonicity` | `seedling-hammer-phase-planning-2` | **Crash on invocation**, not a measured red. The roster runs it bare, and it requires `--row=`: `Error: --row=null: not a row (--rows lists them)`, 0.0 s, no verdict line. Reproduced locally: exit 1, same line. | `014fc135` (2026-10-17, introducing commit) |
| `gate: seedling-rewind-exactness` | `seedling-hammer-phase-planning-2` | **Crash on invocation**: `Error: --row=null: not a row (--rows lists them), and no --script`. Reproduced locally: exit 1. | `014fc135` |

`seedling-full-tier-owed` is **not** listed. It read `exit=0` at the base and at my runs (`2/0/1`, "the question could not be put"), and listing it would make the judge red with `NOW-GREEN`.

**Measured both ways.**
- **Unit rows** (`ciExpectedRed.test.js`, 9 tests): each verdict, an unparseable exit read as red, and the committed table's rows each naming a real CI key.
- **Against the base run's downloaded logs.** Headless shard 0: `0 red | 2 expected-red`, exit 0. Headless shard 1 and browser shard 3: 0 red. Browser shard 2: **3 UNEXPECTED-RED** (`procgen-demos`, `seedling-editor-phases`, `seedling-editor-refusal`), exit 1. This is the mutant: the base itself.
- **In production.** The first complete run of the step was 39543674024 at `edc1236f` (D1/D2 in, D3 not yet pushed). It failed two jobs by name:
  - `Browser gate shard — seedling-ap-placement +22`: `UNEXPECTED-RED | gate: seedling-editor-refusal | exit=1 | 15/5`. Demos and phases now read `exit=0`.
  - `Headless procgen gates (shard 1)`: `UNEXPECTED-RED | gate: procgen-help | exit=1 | 448/1`, with evidence *"ci-expected-red.mjs — HELP ok · IMPORT SIDE EFFECT"*. **My own new CLI ran its judge at module scope.** I fixed it in `26fbfb26` (a `main()` behind `isEntryPoint`); `check-procgen-help.mjs --only=ci-expected-red.mjs` now reads ALL PASS. Before D4, this red would have joined the silent five.

  Headless shard 0 passed with its two expected reds. The D4-head run (39543349069) was cancelled by my next push; its shards 1 and 3 ran the new step green.

## The CI run at my last code head

Run **39545422705** at `ea4a9fe258`: **conclusion `success`, all 13 jobs green**, including every `Expected reds only?` step.

- **Browser shard 2** (`seedling-ap-placement +22`): `## CI-GATE | gate: procgen-demos | 264/0 | exit=0 | ALL CHECKS PASSED`; `## CI-GATE | gate: seedling-editor-phases | 94/0 | exit=0 | ALL CHECKS PASSED`; `## CI-GATE | gate: seedling-editor-refusal | 21/0 | exit=0 | ALL CHECKS PASSED`. The judge read `## EXPECTED-RED-DONE | 23 gate line(s) read | 0 red | 0 expected-red`.
- **Headless shard 0**: the two hammer arms are still `0/0 | exit=1 | (no total)`, and the judge read `EXPECTED-RED` for both (owner `seedling-hammer-phase-planning-2`), then `51 gate line(s) read | 0 red | 2 expected-red`. `seedling-full-tier-owed` read `2/0/1 | exit=0`.
- **Headless shard 1**: `## CI-GATE | gate: procgen-help | 449/0 | exit=0` (the D4 import fix holds). The judge read `49 gate line(s) read | 0 red | 0 expected-red`.
- **Vitest** (`node scripts/procgen/ci-vitest-summary.mjs ea4a9fe258`): `suite: vitest (unfiltered) 876/21592 (21592 passed | 0 skipped | 0 failed)`; `slow battery 21/261 (261 passed | 0 failed)`.

The demos value moved 260/1 → 264/0: D1 added the search's three rows, and the claim row turned PASS.

## What the brief got wrong (measured)

1. **"Widen the search so it cannot run dry … measure what the ceiling must be."** No ceiling up to 1000 finds a post-sword killgate certification drop. The grid had to move, not the range.
2. **"Smaller seed that DROPS its element WITH certification geometry"**, applied to the brief's own 10-03 numbers: those seeds (26, 28, 118) are **placement** refusals (`wall-does-not-seal`, `certified: null`). They never were certification drops, so the phases gate's `certified === false` test correctly skipped them.
3. **"Seed the table with … `seedling-full-tier-owed` if it is red."** It was green at the base and at my runs.
4. **The hammer arms** are not "owed" or "real". They crash on invocation (`--row=null`).
5. **"Five checks fail"** is today's refusal message. With a list, a stale subject produces one named FAIL, not five dead checks.

## Residue

- No `hazard:`-sourced ladder refusal is left in the atlas. Every D3 candidate is a body a later kill rung might clear. When all six clear, the gate refuses by name, and the sweep must be re-run. The method is above; the scratch instrument was `refsweep.mjs` (Node: `censusGoalOptions` × `solveForPage`), not committed.
- The 7 tapes that hit the 120 s sweep limit were only partly swept.
- `session_bootstrap.sh --seedling` does not initialise `bulletml-dodge`, so `generated.test` / `generate-procgen-reference --check` read 4 false diffs locally (registry, capabilities and two markdown regions).
- The hammer arms: either the gates take a default row set under a battery, or `gateRoster` passes one. That is the hammer-phase arc's (owner named in the table).

## Rows to BANK

- `gate: procgen-demos`, `gate: seedling-editor-phases`, `gate: seedling-editor-refusal`: `exit=0` at the head (values from CI, below).
- `CI_GATE_EXPECTED_RED`: 2 rows (the hammer arms).
- Trap candidate (third recurrence): *a pinned SUBJECT over a property a solver change can revoke*. New this time: a bounded SEARCH runs dry exactly as a literal goes stale. The durable subjects are structural (a biome that cannot walk the gadget) or a walked candidate list.
- Trap candidate: a red printed in a `continue-on-error` line is a red nobody reads. A step that reads the line and fails the job is what makes it seen, and it caught its own author's red on its first run.

## Evidence (scratch, not committed)

- The 13-element × 2-biome × seeds 1..30 grid. Post-sword certification drops occur only for elements whose key the boot lacks (shieldgate, watergate, watershortcut) and for `guard` 12, 13. Pre-sword killgate, rockgate, corridorbody, arena, shortcut, shieldgate and watergate all drop at the certification with geometry.
- CI logs of run 39540239745 (base) and 39543674024 (`edc1236f`).
