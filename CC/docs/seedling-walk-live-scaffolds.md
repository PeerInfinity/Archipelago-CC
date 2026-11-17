# seedling-walk-live-scaffolds: a whole-game walk command and a live-server test scaffold

Session `seedling-walk-live-scaffolds` (Opus), launched and reviewed by `seedling-js-planning-21`. Licence: Robert,
2026-11-17 ("Walk + live-server scaffolds": *"A main-branch whole-game walk command that prints N/48 and where it
stopped, plus a scaffold of the live-server test command. Real passes wait for the playthrough."*). Two commands and
their docs. No solver, bot or game change, and no new CI job.

- Branch `seedling-walk-live-scaffolds`, base **`fb030c550b`** (= `git merge-base HEAD origin/main`; origin/main had not
  moved at packet time, so the "merge" was a no-op and the gates ran at the tip).
- Gitlinks moved: **0**.

## What was added

| commit | what |
|---|---|
| `6f02d272c7` | **The walk instrument, on main, inert by default.** These are the knobs every re-measure cherry-picked from the MEASUREMENT-ONLY `d6b6aed4d`, in the same four files (`tutorialTests.js`, `seedling.js`, `steps/procgen.js`, `app.spec.js`). Changes from `d6b6aed4d`: the sampler starts only when a `?measure*` param is set (`MEASURE_ACTIVE`, with no `await` on the inert path); `playbackBot` and `flashPanel` are imported **lazily** inside the sampler, where `d6b6aed4d` imported them at the top of `tutorialTests.js`; `procgen.js` reads `?measureBotStallMs` itself instead of through `globalThis.__measureBotStallMs`. Additive: `botHead=` on every `[MEASURE]` line, and `walkEnd=`, `walkStep=` and `why=` (walkTutorial's outcome) on `[MEASURE end]`. |
| `79861e0359` | `scripts/procgen/walk-seedling-whole-game.mjs` + `walkSeedlingWholeGame.test.js` (7 rows, pinned on re-measure-4's own end lines). |
| `9f606cc839`, `64a4f20dd0` | `scripts/test/seedling-live-server.mjs` + `seedlingLiveServer.test.js` (4 rows). The second commit is the fix from the first live run (below). |
| `817d014449` | `seedling-bot.md` § *Running the whole-game walk* and § *Live-server test (scaffold)*, with the procgen reference regenerated. |

**`.mjs`, not `.py`, for the live-server command.** `run_multiclient_test.py` is a Python orchestrator around
Playwright clients. Here, the browser half is Playwright in Node and the box lock is `boxLock.js`, and
`clientReady.js` (the guard against connecting early) is Node too. A `.py` file would only spawn a Node driver.

## The inert-by-default proof

| what | at | result |
|---|---|---|
| local `npm test -- --mode=test-substrates --batch=tutorials-seedling --port=8150` | `64a4f20dd0` | **4/4 PASSED** (recompile 16.3 s, bot 124.6 s, multiworld 0.3 s, bot-js 111.2 s). There is **no** `[MEASURE` line and no `measure…` URL param anywhere in its log (`grep -c` = 0) |
| CI, every tutorial batch: `test-substrates-manual.yml` dispatched per batch | `64a4f20dd0` | runs 44193328144, 44193332366, 44193337080, 44193341539, 44193345578, 44193349226, 44193353275: all **success** |
| … row by row against the nightly at main (run **44066819358**, `756d28a196`, same workflow), `compare-runs.js` | | `tutorials` 24/24, `tutorials-procgen` 9/9, `tutorials-procgen-loops` 2/2, `tutorials-tracker` 8/8, `tutorials-seedling` 4/4, `tutorials-seedling-whole-game` 1/1, `feature-checks` 10/10: **"No differences in status, roster, or duration."** for all seven (58 rows) |
| … result-JSON fields | | No field added or removed by this slice. The only key-set difference is `summary.failedConditionsCount`, which comes and goes **in both directions** (present on main and absent on the tip for two batches; the reverse for one). It is always `0`, and it is written by one of `testLogic.js`'s three summary sites, a file this slice does not touch |
| TT (`test-templates.yml`, dispatched) | `64a4f20dd0` | run **44193298194** success; its 9 jobs and their conclusions are identical to main's TT run 44187220914 at `fb030c550b` |

⚠ The nightly baseline is main at `756d28a196` (this morning), not exactly at `fb030c550b`. It is the newest main run of
those batches; the trains between the two did not change any tutorial row's status, roster or duration.

## The two commands' outputs

**Walk** (`--budget-s=600 --port=8150`, wasm, seed 1, local; head `6f02d272c7`):

```
10/48, stop: entry 11 "Level 030 - Torchpickup" in level_31__r24c10, cause: budget: the step's wait ran out (status "Sphere 4.7 → routing via \"level_31__r24c10 -> level_30__r2c10\" → level_30__r2c10 (11/48)") (transport wasm; walk 602 s, run 636 s)
```

The `[MEASURE end]` line under it: `checked=18 botQueue=48 botCursor=10 botChecked=10 botHead="Level 030 - Torchpickup" …
regionChanges=57 wasmPushes=40 transport=wasm wasmMemMB=656 … walkEnd=failed walkStep=bot-plays why="its done check never held"`.
Entry 10 (L22→L29, the step-35 exit) played as a 609-tick plan inside the 600 s budget, the same plan re-measure-4 saw.
⚠ **Disclosure:** the run's results JSON records `treeMoved: true` (0 → 9 tracked changes). I edited and staged the docs
and the two scripts while it ran. The instrument files it exercised (`6f02d272c7`) were not touched, and the walk script
was already loaded. No commit was made while it held the box lock.

**Live server** (`--upstream=~/CC/ap-upstream-seedling --port=8150 --budget-s=120 --keep`; upstream main `f5b97c5e9a`,
AP 0.6.9; seed 2, Sprout alone; JS runtime):

```
[live] generated AP_01043188731678011336.zip (seed 2, 1 player(s))
[live] MultiServer pid 1893467 on :43339 (log /tmp/seedling-live-server-4NthLv/multiserver.log)
[live] app: Loaded the server-sent Seedling Playthrough rules with the server's placements (48 locations, room seed 01043188731678011336).
connected as Sprout (slot 1), checks sent 3/48, goal not reached, bot after 120 s: "Sphere 1.7 → routing via \"level_0__r11c19 -> level_12__r0c19\" → level_12__r42c28 (4/48)" (run 161 s, 0 page error(s))
[live] MultiServer pid 1893467 stopped
[live] custom_worlds restored (2 put back, 0 removed)
exit=0
```

Server log: `Sprout sent Fire to Sprout (Level 010 - Sword)`, `… Health … (Level 011 - Chest)`, `… Light … (Level 086 - Chest)`.
Afterwards `kill -0 1893467` reported no such process, and the box lock was released.

⚠ **The first live run failed** (exit 2, `ClientNotReadyError`): it connected before the client's `initialize()`, and its
two `async` `waitForFunction` predicates resolved at their first poll (`clientReady.js` trap 2). `64a4f20dd0` now waits with
`waitForClientReady` and uses a sync predicate. Its cleanup still worked: server pid 1892077 was stopped and the files were
put back. It did lose the two set-aside upstream apworlds' mtimes. Their bytes were restored, and I reset the mtimes by
hand (`touch -d "2026-11-11 07:39"`). The script now restores mtimes itself.

## What the scaffold cannot do yet

- **It never requires the goal**; it only reports it. A full play is about 50 min on wasm, and today the bot stops earlier
  (re-measure-4: L58 yeti at 24/48 on wasm). Real passes wait for the playthrough.
- **Foreign items.** With `--with-apquest` nobody plays Questy, so Sprout's items placed in Questy's world never arrive.
  The probes sent them from a second in-page socket; that is not wired here.
- Sprout is always slot 1. It has no reconnect, no release or collect modes, and one room per run.
- `custom_worlds/` in the upstream tree is shared. The script sets aside and restores what was there, but a concurrent
  upstream generation in that tree during a run would see this tree's packed apworld.
- It is not a CI job and is in no batch (Robert: no new per-push checks).

## Gates

| gate | at | result |
|---|---|---|
| JSUT (push) | `64a4f20dd0` | run **44193299373** success: suite **1326 files / 28473 passed / 0 failed**; slow 36/438 |
| JSUT at main | `fb030c550b` | run 44176264422: 1324 / 28460. **Delta: +2 files, +13 tests, 0 failed** (11 are the new rows; I did not attribute the other 2) |
| unittests (push) | `64a4f20dd0` | run **44193299362** success |
| TT (dispatch) | `64a4f20dd0` | run **44193298194** success (above) |
| bounded vitest (⚖ 52) | local | `procgenDocs`, `quickLaunch`, `tutorials`, `lintGateLabels`, `argvHelp`, `noNewDocsReferences` + the two new files: 23 files / 708 passed |

## Doc pins

- `generate-procgen-reference.mjs` rewrote `README.md`'s docs-index region (seedling-bot.md 55,787 → 56,700 words; corpus
  556,968 → 557,881), `architecture.md`'s instruments line (555 → 556 instruments, 472 → 473 with flags, 290 → 291 cited,
  `--help` inherited 552 → 553), `generated/docsIndex.js` and `generated/instruments.js` (new category `walk`). `--check`
  after: 0 findings.
- Doc-link census (`docLinks.test.js`): **unchanged**, because no markdown link was added. The `quickLaunch` docs index was
  regenerated and did not change.
- No tracked file cites a `NewDocs/` path (`noNewDocsReferences.test.js` green).

## Leftovers

- Dev server on port 8150 (pid 1867326) stopped by literal PID. The `--keep` temp dirs `/tmp/seedling-live-server-*` are
  deleted.
- No stash, no force-push, no main push.
