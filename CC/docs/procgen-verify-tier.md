# The procgen `verify-*` / `dump-*` tier — which are gates, which are reports, which are red, which nobody runs

**Measured 2026-09-05 on `main` at `90543c26f`, node v18.20.6, WSL2.** Survey only: no product
code was changed. Every count below names the command that derives it — re-run the command, do
not trust the number.

## Why this exists

The APWorld editor hub arc (queue doc §5n) found three things failing or inert **unwatched** in one
week: `verify-region-marking-tool.mjs` Phase F red after an upstream change (trap 1207); two hub
doors publishing an event the bus silently refused; and `verify-rule-gated-portals.mjs` red at HEAD
with an identical failure on a pre-arc checkout. H6b's closing line was *"the residue is not a
feature, it is that the bounce/procgen script tier has no battery"*.

⚠ **That sentence was a claim, and this survey measured it.** It is *almost* right, and wrong in a
way that matters — see "What the batteries actually cover" below.

## Headline numbers

| what | count | command |
|---|---|---|
| `verify-*.mjs` | 50 | `ls scripts/procgen \| grep -acE '^verify-.*\.mjs$'` |
| `dump-*` (`.js`+`.mjs`) | 12 | `ls scripts/procgen \| grep -acE '^dump-.*\.(m?js)$'` |
| gates the roster derives | 33 | `node scripts/procgen/gates.mjs --list \| grep -acE '^check-'` |
| **`verify-*` in the roster** | **0** | `node scripts/procgen/gates.mjs --list \| grep -acE '^verify-'` |
| `standing-values.json` rows | 66 | `node -e "console.log(Object.keys(require('./scripts/procgen/standing-values.json').rows).length)"` |
| procgen scripts named by a workflow | 5 | `grep -rahoE "scripts/procgen/[A-Za-z0-9_.-]+" .github/workflows/ \| sort -u \| wc -l` |
| **`verify-*` named by a workflow** | **1** | `grep -rahoE "scripts/procgen/verify-[A-Za-z0-9_.-]+" .github/workflows/ \| sort -u \| wc -l` |
| scripts run for this survey | 61 of 62 | see the table; the 62nd is cost-excluded and named below |

**Of the 62 scripts, 59 are in no battery of any kind.** Two are CI identity arms
(`dump-maze-byteidentity`, `dump-seedling-kind-pairs`, via `identity-block.sh` → `ci-gates`
identity arms). One — `verify-seedling-wasm-bridge.mjs` — is named by a workflow, and even that
one **cannot fail a build** (see below).

## ⛔ The exclusion is STRUCTURAL, not an oversight per script

Three independent mechanisms decide membership, and all three key on the **filename prefix
`check-`**:

- `gateRoster.js` — `export const isGateFile = (f) => /^check-[a-z0-9-]+\.mjs$/.test(f)`
- `reachClosure.js:813` — `git(['ls-files', '--', 'scripts/procgen/check-*.mjs'])`
- `ci-gates.mjs` — reads the roster, so it inherits the same rule

`gateRoster.js`'s own header says a gate *"joins this roster by READING ITS FLAG, which is the only
membership rule that cannot go stale."* That is true of the flags a gate declares — but **the
population it is applied to is chosen by name first**. A `verify-*` script cannot join a battery by
declaring anything; it would have to be renamed. So the 50 `verify-*` scripts are not fifty
oversights, they are one naming rule.

## What the batteries actually cover (H6b's premise, refined)

"The tier has no battery" is wrong in one specific way, and the distinction is the useful part:

- **`check-procgen-help.mjs` covers all 50** — it spawns `--help` and a bare `import` on every
  `scripts/procgen/*.mjs` (`check-procgen-help.mjs:533`: `readdirSync(DIR).filter(f => f.endsWith('.mjs'))`)
  and asserts both doors are inert. All 50 `verify-*` appear in its baseline.
- **`generate-procgen-reference.mjs` → `procgenDocs/generated/instruments.js` covers all 50** — one
  catalogue row each, gated by `check-procgen-reference`.

So the tier has a **hygiene** battery and a **catalogue** battery. Neither one ever asks whether the
script's own claim still holds. **Nothing runs them.** That is the accurate form of H6b's sentence.

⚠ **The six `dump-*.js` files are outside even the hygiene gate** — its population is `.mjs` only.
`dump-bounce-level.js`, `dump-bounce-region.js`, `dump-grid-growth.js`, `dump-runner-level.js`,
`dump-shuffled-spiral.js`, `dump-sphere-growth.js` are in no registry at all. One of them,
`dump-sphere-growth.js`, **writes `sphere-growth-dump.json` into the repository root** on a bare run
(measured; the file was removed afterwards).

## ⚠ The one workflow row is non-gating AND path-filtered

`verify-seedling-wasm-bridge.mjs` is named by `.github/workflows/seedling-wasm.yml:231`. Two
measured qualifications:

- it is **STEP 2, `continue-on-error`** — the workflow's own header says *"⛔ NOTHING THAT RUNS THE
  GAME GATES A PUSH"*;
- the workflow's `on: push: paths:` filter lists only the wasm submodule, `.gitmodules`,
  `check-seedling-wasm-pins.mjs` and the workflow file — **editing
  `verify-seedling-wasm-bridge.mjs` itself does not trigger it.**

"Named by a workflow" is therefore not the same as "in a battery", and for this row it means
neither gating nor triggered-by-its-own-change.

## ⚠ A tracked claim this survey overturns

`vitest.slow.config.js:60-66` says of the runner suites it excludes: *"NOT TOUCHED, and each still
runs: … and the Playwright instruments `scripts/procgen/verify-runner-*.mjs`."*
`docs/json/developer/procgen/runner.md:103` repeats it. **Nothing runs them.** All four
`verify-runner-*.mjs` are in no battery; they were run here, by hand, for the first time this
survey can evidence. (They all pass — the claim is wrong about the mechanism, not about the state.)

Similarly `architecture.md:124`, `gotchas.md:61` and `stepped-pipeline.md:35` say
`scripts/procgen/verify-*.mjs` is what *catches* byte-identity drift. Two of those scripts are red
at HEAD on exactly that assertion (below), and had been for an unknown time.

Also measured: `dump-runner-level.js`'s only executing reference is
`runnerDemo/generatorFeatures.slow.test.js:313`, which is inside
`frontend/modules/runnerDemo/**/*.slow.test.js` — **excluded** by `vitest.slow.config.js:69`. Its
one runner does not run.

## Method

- **Enumerate** — `ls scripts/procgen | grep -aE '^(verify|dump)-.*\.(m?js)$'` (62 files).
- **Membership** — `gates.mjs --list` (derived), `ciGatePlan.ciRunnable`, `standing-values.json`,
  `identity-block.sh`, `.github/workflows/`, and `git grep` for each basename, discounting the two
  registries that contain everything.
- **Run** — one at a time, detached (`setsid nohup`, PID captured at launch), 900 s cap per script,
  box lock respected, against the user's existing `:8000` dev server. Load recorded at each start.
- **⛑ Re-run under contention** — a concurrent session began a full clang build mid-survey (box load
  13.9). Every red measured under load was **re-run solo on a quiet box**; one of eight
  (`verify-bounce-embed`) flipped to green, so it was starvation, not a defect. The solo re-run is
  the authoritative row in the table.
- **Pre-existing vs new** — the pre-arc SHA is `697c94ee6` (the commit before the APWorld hub arc's
  planning doc `1ac5d6135`). A throwaway worktree was checked out there, its `shared` submodule
  restored to the pre-arc gitlink, and control copies of the reds (port rewritten 8000→8130) were
  run against that tree served on `:8130`.


## The table

One row per script. **in a battery?** is derived membership; **other refs** counts tracked
references excluding the file itself and the two catch-all registries. **run** is the solo
re-run where one was needed, otherwise the first run. No recommendations here — those are in
the report to the planner.

| script | drives | flags | in a battery? | other refs | run | wall | verdict line |
|---|---|---|---|---|---|---|---|
| `dump-bounce-level.js` | node | — | **none** | 1 | exit 0 | 0.1s |  |
| `dump-bounce-region.js` | node | — | **none** | 1 | exit 1 | 0.2s | ERROR: pass exactly one of --spec or --preset |
| `dump-dj-traces.mjs` | node | grant,out,ticks | **none** | 0 | exit 2 | 0.1s | usage: dump-dj-traces.mjs <rules.json> <region_id> [--ticks N] [--grant "Item@tick[,Item@tick]" |
| `dump-grid-growth.js` | node | — | **none** | 3 | exit 0 | 0.5s |  |
| `dump-maze-byteidentity.mjs` | node | — | CI identity arm | 5 | exit 0 | 2.3s | MD5 8cc31554d3fbb3c547bce7ca0eec16ce |
| `dump-runner-level.js` | node | — | **none** | 1 | exit 0 | 0.1s |  |
| `dump-seedling-kind-pairs.mjs` | node | biomes,count,dash,kinds,seeds | CI identity arm | 7 | exit 0 | 118.9s |  |
| `dump-shuffled-spiral.js` | node | — | **none** | 4 | exit 1 | 0.5s | ERROR: at least one --quota is required |
| `dump-sphere-byteidentity.mjs` | node | — | **none** | 3 | exit 0 | 3.1s |  |
| `dump-sphere-growth.js` | node | — | **none** | 8 | exit 0 | 0.4s |  |
| `dump-spiral-byteidentity.mjs` | node | — | **none** | 5 | exit 0 | 0.6s | ALL PASS — stepped spiral == monolith |
| `dump-topdown-byteidentity.mjs` | node | — | **none** | 1 | exit 0 | 0.9s |  |
| `verify-atlas-sphere-roundtrip.mjs` | node | — | **none** | 0 | exit 1 | 18.5s | 1 assertion(s) FAILED. |
| `verify-bot-playthrough.mjs` | browser (:8000) | — | **none** | 1 | exit 1 | 250s | Error: [A — bounce-only full sphere playthrough] timeout waiting for: bot finished its queue |
| `verify-bounce-embed.mjs` | browser (:8000) | — | **none** | 2 | exit 0 | 18s |  |
| `verify-bounce-touch.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 9s | All bounce touch checks passed. |
| `verify-cli-sphere-config.mjs` | node | — | **none** | 0 | exit 0 | 2.7s | VERIFY CLI SPHERE CONFIG: ALL OK |
| `verify-dj-real-embed.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 101s | Error: timeout waiting for: dj page configured with region_3_3 |
| `verify-dj-swf-patch.mjs` | node | — | **none** | 0 | exit 0 | 0.3s | PASS: swf_inject.mjs output byte-identical to inject_tracer.py --stage-width 600 (681148 bytes) |
| `verify-grid-growth-ui.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 15s | PASS — grid-growth streams denominator-less live progress and produces a result |
| `verify-item-channels.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 27s | ‼ FAILURE: rep 0 leaked a cross-substrate grant |
| `verify-jta-balance-pass.mjs` | node | — | **none** | 6 | exit 0 | 7.2s | PASS: full coverage, no stalls, no saturation |
| `verify-jta-cost-hooks.mjs` | node | — | **none** | 0 | exit 0 | 3.2s | ALL CHECKS PASSED |
| `verify-jta-dataset-load.mjs` | node | — | **none** | 1 | exit 0 | 0.2s | All dataset-load smoke checks passed. |
| `verify-jta-dataset-pipeline-preset.mjs` | node | — | **none** | 1 | exit 0 | 0.2s | ALL PASS — the pipeline reproduces the playable jta_dataset_test world |
| `verify-jta-dataset-transfer.mjs` | node | — | **none** | 1 | exit 0 | 0.4s | All dataset-transfer assertions passed. |
| `verify-jta-dataset-url-boot.mjs` | node | — | **none** | 0 | exit 0 | 2.0s | All ?dataset= boot assertions passed. |
| `verify-jta-generated-dataset.mjs` | node | — | **none** | 0 | exit 0 | 1.0s | All generated-dataset assertions passed. |
| `verify-jta-locations-roundtrip.mjs` | node | — | **none** | 5 | exit 0 | 15.4s | All round-trip assertions passed. |
| `verify-jta-managed-zone-skip.mjs` | node | — | **none** | 0 | exit 0 | 0.7s | All managed-mode zone-skip assertions passed. |
| `verify-maze-consumable-tiles.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 35s | ‼ FAILURE: timeout waiting for: omsi resources.houses reaches 1 |
| `verify-maze-loop-mana.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 44s | ‼ FAILURE: timeout waiting for: loop mode auto-enabled |
| `verify-omsi-mana-leg.mjs` | browser (:8000) | — | **none** | 1 | exit 1 | 41s | ‼ FAILURE: timeout waiting for: per-batch draining (≥5 small decrements tracking the budget) |
| `verify-preset-panel-click.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 24s | ALL OK |
| `verify-procgen-presets.mjs` | browser (:8000) | — | **none** | 1 | exit 0 | 171s | All 27 preset drop-down checks passed. |
| `verify-region-library-roundtrip.mjs` | node | — | **none** | 2 | exit 0 | 15.8s | All region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip-maze.mjs` | node | — | **none** | 0 | exit 0 | 30.8s | All maze sphere region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip-runner.mjs` | node | — | **none** | 1 | exit 0 | 51.3s | All runner sphere region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip.mjs` | node | — | **none** | 6 | exit 0 | 25.9s | All sphere region-library round-trip assertions passed. |
| `verify-region-library-ui.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 45s | All region-library UI assertions passed. |
| `verify-region-marking-tool.mjs` | browser (:8000) | host | **none** | 13 | exit 0 | 11s | OK: region marking tool verified in-app |
| `verify-region-step-editing.mjs` | node | — | **none** | 3 | exit 0 | 19.0s | VERIFY REGION-STEP EDITING: ALL OK |
| `verify-rule-gated-portals.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 45s | locator.click: Timeout 30000ms exceeded. |
| `verify-runner-bot.mjs` | browser (:8000) | — | **none** | 1 | exit 0 | 31s | All runner bot checks passed. |
| `verify-runner-embed.mjs` | browser (:8000) | — | **none** | 1 | exit 0 | 80s | All runner embed checks passed (sphere-grown world, bot-driven). |
| `verify-runner-game.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 11s | All runner game-page checks passed. |
| `verify-runner-smoke.mjs` | browser (:8000) | — | **none** | 2 | exit 0 | 16s | All runner smoke checks passed. |
| `verify-seedling-ap-placement.mjs` | `--win` (Windows Chrome) | no-panel,win,win-port | **none** | 6 | exit 0 | 442s | ALL ROWS PASSED — seedling_bot_ap_p4c, END 2026-09-05T18:22:37.550Z |
| `verify-seedling-atlas-maze.mjs` | node | no-browser | **none** | 2 | exit 0 | 11.4s | OK: 10 atlas sub-regions are playable maze worlds (20 exits, 14 gates) |
| `verify-seedling-atlas-play.mjs` | browser (:8000) | host | **none** | 2 | exit 0 | 43s | OK: the real Seedling game walks between atlas regions, and the arrival teleport does not echo |
| `verify-seedling-atlas-preset.mjs` | browser (:8000) | — | **none** | 1 | exit 0 | 5s | OK: seedling_atlas preset loads with 11 regions and 23 exits |
| `verify-seedling-bot-differential.mjs` | `--win` (Windows Chrome) | only,record,resume,tier,win | **none** | 65 | not run | — |  |
| `verify-seedling-wasm-bridge.mjs` | browser (:8000) | host | workflow (non-gating) | 7 | exit 0 | 45s | ALL PASS |
| `verify-sphere-batch-stepping.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 63s | VERIFY SPHERE BATCH STEPPING: ALL OK |
| `verify-sphere-envelope-resume.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 24s | VERIFY SPHERE ENVELOPE RESUME: ALL OK |
| `verify-sphere-growth-ui.mjs` | browser (:8000) | — | **none** | 2 | exit 0 | 22s | VERIFY SPHERE GROWTH UI: ALL OK |
| `verify-sphere-steps-ui.mjs` | browser (:8000) | host | **none** | 5 | exit 0 | 103s | VERIFY SPHERE STEPS UI: ALL OK |
| `verify-spiral-steps-ui.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 19s | ✅ ALL PASS |
| `verify-ta-mana-leg.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 9s | verify-ta-mana-leg: ALL PASS |
| `verify-topdown-steps-ui.mjs` | browser (:8000) | host | **none** | 3 | exit 0 | 81s | ✅ ALL PASS |
| `verify-topdown-steps.mjs` | node | — | **none** | 7 | exit 0 | 1.1s | ALL PASS — stepped runner == monolith |
| `verify-world-persistence-reload.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 82s | PASS — 23 checks |

## (a) Reds and crashes

Eight scripts fail at HEAD. **Every one is in no battery**, so every one had been failing unwatched. Six are
**pre-existing**, one is **new**, one is **inconclusive**.
Each was re-run **solo on a quiet box** before being called red; the first failure of a ninth,
`verify-bounce-embed`, did **not** reproduce solo and is classed as starvation, not a defect.

| script | first failing line | pre-existing at `697c94ee6`? |
|---|---|---|
| `verify-item-channels.mjs` | `‼ FAILURE: rep 0 leaked a cross-substrate grant` | **PRE-EXISTING** — identical failure on the pre-arc tree |
| `verify-maze-loop-mana.mjs` | `‼ FAILURE: timeout waiting for: loop mode auto-enabled` | **PRE-EXISTING** — identical |
| `verify-omsi-mana-leg.mjs` | `‼ FAILURE: timeout waiting for: per-batch draining (≥5 small decrements tracking the budget)` | **PRE-EXISTING** — identical |
| `verify-dj-real-embed.mjs` | `Error: timeout waiting for: dj page configured with region_3_3` | **PRE-EXISTING** — identical |
| `verify-rule-gated-portals.mjs` | `locator.click: Timeout 30000ms exceeded` waiting for the pipeline panel's Generate button (`:153`) | **PRE-EXISTING** — H6b already controlled this one at `f45b82789~1`; reproduced here |
| `verify-maze-consumable-tiles.mjs` | `‼ FAILURE: timeout waiting for: omsi resources.houses reaches 1` | **NEW — and the cause is the FIXTURE, not the tree** (see below) |
| `verify-bot-playthrough.mjs` | `Error: [A — bounce-only full sphere playthrough] timeout waiting for: bot finished its queue` | **PRE-EXISTING** — identical failure on the pre-arc tree (253 s) |
| `verify-atlas-sphere-roundtrip.mjs` | `FAIL: the committed seedling_atlas_sphere preset regenerates byte-identically` (1 FAIL against 67 PASS) | **INCONCLUSIVE** — the pre-arc control CRASHED (see below) |

### ⛑ The `maze-consumable-tiles` red is a GENERATOR-OUTPUT drift, proved by a cross-control

The script's header says its fixture is *"NOT committed — regenerate with"* a `spiral-step.js`
command. Regenerating it and running gives three measurements:

| tree | fixture (md5) | result |
|---|---|---|
| pre-arc `697c94ee6` | pre-arc `2ef8f4abe0e23af9023362555f21096f` | **PASS** — `VERIFY MAZE CONSUMABLE TILES: OK` |
| HEAD `90543c26f` | HEAD `40e87ff5d96d7b78e12e14f6201d06c8` | **FAIL** — `omsi resources.houses reaches 1` |
| **HEAD `90543c26f`** | **pre-arc `2ef8f4ab…`** | **PASS** |

The same documented command produces a **different fixture** before and after the arc, and the HEAD
tree passes when handed the old fixture. **The regression is in what the generator emits, not in the
code under test.** ⚠ This is the same claim `verify-atlas-sphere-roundtrip` is failing on — *"the
committed preset regenerates byte-identically"* — reached independently by a second script. Two
unwatched scripts are reporting one drift.

### The two rows that did not resolve

- **`verify-atlas-sphere-roundtrip.mjs` — pre-arc control CRASHED, verdict inconclusive.** In the
  throwaway worktree the script's own `Generate.py` export step produced nothing and the run died on
  `ENOENT … scandir 'frontend/presets/atlas_sphere_worldgen'` — a harness failure, which per
  `feedback_exit_code_without_a_summary_is_not_a_verdict` is a third category, not a red. What *is*
  measured: the committed `seedling_atlas_sphere` preset last changed at `ddfe003b2`, **before** the
  arc, and the failing assertion is a byte-identity one. Resolving this is the first job of the
  follow-up slice.
- **`verify-seedling-bot-differential.mjs` — NOT RUN, cost-excluded.** It is one of the two scripts
  holding `/mnt/c/Windows/py.exe`; its full drive is a measured **142-minute** GPU run
  (`gateRoster.js:80` and `:388`). Running it was disproportionate for a survey. **It is the one
  script of 62 this survey leaves without a verdict**, and it is named here so that is visible
  rather than silently absent.

### The `--win` tier

Two scripts hold the Windows driver path (`grep -al "/mnt/c/Windows/py.exe" scripts/procgen/verify-*.mjs`
→ 2). ⚠ The kickoff brief said three; the measured count at HEAD is **two**.

`verify-seedling-ap-placement.mjs --win` was run here on real-GPU Windows Chrome and **PASSED** —
`ALL ROWS PASSED — seedling_bot_ap_p4c`, 442 s, six arms. ⛑ Note for whoever runs it next: its
header tells you to start `python3 -m http.server 8129` yourself. Without that the run dies in 8 s on
`ERR_CONNECTION_REFUSED`, because `serveRepoRoot.js:97` binds `127.0.0.1` on an **ephemeral** port
which Windows Chrome cannot reach — the script's own server is not the one `--win` uses.

## (b) Reports — scripts that print no verdict, or cannot fail

Eight scripts exit 0 having printed **no summary line at all** (derived: rows in the table whose run
is `exit 0` and whose verdict column is empty):

`dump-bounce-level.js` · `dump-grid-growth.js` · `dump-runner-level.js` ·
`dump-seedling-kind-pairs.mjs` · `dump-sphere-byteidentity.mjs` · `dump-sphere-growth.js` ·
`dump-topdown-byteidentity.mjs` · **`verify-bounce-embed.mjs`**

For the `dump-*` scripts that is correct behaviour — they are dumps, and two of them
(`dump-maze-byteidentity`, `dump-seedling-kind-pairs`) have their verdict taken *elsewhere*, as an
md5 in a CI identity arm. **`verify-bounce-embed.mjs` is the one misfiled row**: it is named
`verify-`, it drives a full playthrough, and a green run is indistinguishable from a truncated one.

⚠ **H6b's characterisation of it needs one correction.** H6b wrote that it *"prints no verdict and
cannot fail — a report, not a gate."* The first half is right; the second is not. It fails by
**throwing** — `waitFor` throws on timeout (`:64`) and two revisit assertions throw explicitly
(`:128`, `:134`), and an unhandled rejection exits non-zero under Node 18. Measured: it exited 1
under contention and 0 solo. So it *can* fail — what it lacks is a **pass** line. The fix is one
`console.log`, not a redesign.

Three `dump-*` scripts exit non-zero on a bare run because they **require arguments**
(`dump-bounce-region.js`, `dump-dj-traces.mjs`, `dump-shuffled-spiral.js`). Those are usage
refusals, not reds, and are classed as such in the table.

## (c) Scripts nothing references

Every `.mjs` in `scripts/procgen/` appears in two registries that contain *everything* —
`procgenDocs/generated/instruments.js` and `check-procgen-help.baseline.json` — so a naive "grep for
the basename" finds a hit for all 50 and answers nothing. Discounting those two, **23 of the 50
`verify-*` scripts have no other reference anywhere in the tree** (js/mjs/json/yml/py/sh):

```
verify-atlas-sphere-roundtrip     verify-bounce-touch              verify-cli-sphere-config
verify-dj-real-embed              verify-dj-swf-patch              verify-grid-growth-ui
verify-item-channels              verify-jta-cost-hooks            verify-jta-dataset-url-boot
verify-jta-generated-dataset      verify-jta-managed-zone-skip     verify-maze-consumable-tiles
verify-maze-loop-mana             verify-preset-panel-click        verify-region-library-sphere-roundtrip-maze
verify-region-library-ui          verify-rule-gated-portals        verify-runner-game
verify-sphere-batch-stepping      verify-sphere-envelope-resume    verify-spiral-steps-ui
verify-ta-mana-leg                verify-world-persistence-reload
```

**The correlation is measured, not asserted: 6 of those 23 are red (26%), against 2 of the other 27
(7%).** Being referenced by nothing and being broken are the same population.

⚠ Of the remaining 27, most "references" are **prose** — a docblock sentence or a plan naming the
script. Only four are references a machine follows:
`identity-block.sh` → `dump-maze-byteidentity`, `dump-seedling-kind-pairs`;
`seedling-wasm.yml` → `verify-seedling-wasm-bridge` (non-gating);
`rosterCategories.test.js` + `probe-seedling-deadframes.mjs` → `verify-seedling-bot-differential`
(a bounded `--tier=` refusal probe, which never drives the game);
`verify-atlas-sphere-roundtrip.mjs:287` → `dump-sphere-growth.js`.
Two more read a script's **source as text** without running it —
`apworldEditor/hubExits.test.js:214` pins a literal inside `verify-region-marking-tool.mjs`, and
`check-seedling-wasm-pins.mjs:463` pins a spelling inside `verify-seedling-ap-placement.mjs`.

---

# V1 as built — the drift bisect (2026-09-05, `main` at `e0408c3b4`)

**⛔ The finding this slice was launched to chase does not exist.** V1's brief was "chase the
GENERATOR-OUTPUT drift" the survey proved by cross-control above. Re-measured here, the
`maze_consumable_test` generator emits **the same document before and after the arc**, and the red is
**pre-existing**, not new. The survey's own §"⛑ The `maze-consumable-tiles` red is a GENERATOR-OUTPUT
drift" is superseded by this section. What the slice DID find is a real generator-output drift — in the
OTHER script, `verify-atlas-sphere-roundtrip`, which the survey had left inconclusive.

## (1) The normalisation, and why the survey's md5s could not have agreed

`spiral-step.js run` writes one file and one only (measured: `find frontend/presets/maze_consumable_test
-type f` → 1). Its only nondeterminism is a wall-clock field: two consecutive HEAD runs differ in
`generatedAt` and in **nothing else** (`json.dumps(..., sort_keys=True)` diff → one line).

So the identity used from here on is the **normalised** md5: parse, recursively drop every
`generatedAt`, `json.dumps(sort_keys=True, separators=(',',':'))`, md5 that. The survey's two md5s were
of RAW FILE BYTES, which carry `generatedAt` — **two raw md5s of this document can never be equal**,
whatever the tree. That is why the survey read a drift where there is none.

| tree | shared submodule | normalised md5 | length |
|---|---|---|---|
| pre-arc `697c94ee6` (throwaway worktree) | `ef31e39` | `9d529f460a4fe3d6969f49b4001a8092` | 5623 |
| HEAD `ba892d0cb` (primary tree) | `4b78f33` | `9d529f460a4fe3d6969f49b4001a8092` | 5623 |

**Identical.** `90543c26f..HEAD` is docs-only (`git diff --stat` → 2 files, both `CC/docs/`), so the
survey's HEAD and this one are the same code. No bisect was possible, because there is nothing to
bisect: the generator did not drift.

## (2) The red is PRE-EXISTING, and the survey's control drove the wrong tree

The cross-control was re-run properly. ⚠ **`verify-maze-consumable-tiles.mjs` hardcodes
`http://localhost:8000/...`, and the dev server on :8000 serves the PRIMARY tree.** A run launched
from a worktree still drives HEAD's frontend — so a "pre-arc control" that only changes the *cwd*
measures nothing. Here the worktree got its own server (`python3 -m http.server 8001` rooted at
`wt-prearc`, all six submodules initialised, script copied with the port rewritten; the script itself
is byte-identical at the two SHAs — `diff` → no output):

| tree serving :800N | fixture | result |
|---|---|---|
| HEAD (`:8000`) | HEAD's | **FAIL** — `omsi resources.houses reaches 1`, 3/3 runs |
| pre-arc `697c94ee6` (`:8001`) | pre-arc's | **FAIL** — same assertion, same five ✓ lines before it |

`verify-maze-consumable-tiles` moves from the survey's **NEW** row to **PRE-EXISTING**. That makes the
count of pre-existing reds **seven**, and the "new" column empty.

## (3) The mechanism: the script waited for the ENGINE, not for the BRIDGE

The red is genuine but it is a defect in the **instrument**, and it is a race, which is why the same
tree passed for the survey and failed here.

Traced at 1 Hz (`_visualizer._state.player_pos`, `_target`, `_clock._running`, the omsi frame's
`eventBusSubscriptions`, and `resources.houses`), the maze side ALWAYS works: the player starts at
(4,3), steps to (5,3) within ~1–5 s, the visualiser logs `consumable_pickup: Collected 1x omsi/houses`,
`grantItem` validates and returns true, and **no** `[resourceChannels] grantItem rejected` warning
fires. `resources.houses` nonetheless stays 0 in most runs.

The discriminator is the frame table. At the moment `walkToTile` is issued:

```
T0 omsi grant-sub: {"present":false,"hasGrant":null,"n":null}
+4906ms          : {"present":true,"hasGrant":true,"n":9}   pos={"x":5,"y":3}
```

The omsi frame has **no `eventBusSubscriptions` entry at all** at T0; the entry (with
`crossSubstrate:itemGranted` in it) lands ~5 s later, while the bot reaches the tile in ~1 s. The
grant is published into that gap, and per `iframeHandshake.js`'s own contract *"a publish before
[IFRAME_APP_READY] reaches nobody and is not even queued"* — dropped silently, by design (these tiles
are logic-inert per D5, so a dropped grant can never make a world unwinnable).

The script's boot gate was `typeof (await omsiEval('resources.gold')) === 'number'`. That proves the
omsi **game** loaded inside the iframe and says nothing about the omsi **bridge** having subscribed on
the host. **Two different clocks.**

**Fix (`e0408c3b4`):** one more `waitFor` before the walk, on the subscription rather than the engine —
`adapterCore.eventBusSubscriptions.get('omsiSubstrateWrapper').has('crossSubstrate:itemGranted')`.

```
  ✓ omsi bridge subscribed to crossSubstrate:itemGranted
  …
VERIFY MAZE CONSUMABLE TILES: OK
```

Same tree, same fixture: **3/3 FAIL before, 4/4 OK after.**

## (4) `verify-atlas-sphere-roundtrip` — resolved, and THIS one is the real drift

Run in the PRIMARY tree where `Generate.py` works (16.7 s): **67 PASS, 1 FAIL** — the survey's row
reproduces exactly. ⛑ The pre-arc control that crashed for the survey was never re-attempted here and
is not needed: the bisect below dates the cause directly, and it predates `697c94ee6` anyway, so a
pre-arc control would have failed too.

The failing assertion regenerates the committed preset with `dump-sphere-growth.js` and compares bytes.
Both files are 124 377 bytes; the **normalised** md5s differ too (`810782be…` regenerated vs
`4b2b0c50…` committed), so this is real content, not the wall clock. A JSON diff by path gives
**exactly six differing values, no keys added or removed**:

| path | regenerated | committed |
|---|---|---|
| `/preset_sidecars/1/overworld_start__r8c0/playable_payload/tiles/[211]` | 0 | 1 |
| `/preset_sidecars/1/overworld_start__r8c0/playable_payload/tiles/[231]` | 0 | 1 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/tiles/[9]` | 0 | 1 |
| `/preset_sidecars/1/starting_house/playable_payload/tiles/[19]` | 0 | 1 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/entrance/x` | 2 | 4 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/exits/[2]/x` | 2 | 4 |

**Bisected** (`ddfe003b2`..`697c94ee6`, 1568 commits, 11 steps, ~8 s total; `git bisect run` in a
throwaway worktree, `git submodule update --init --force frontend/modules/shared` per step, the
normalised md5 as the predicate):

> **`c8447dd56` is the first bad commit** — *"chore(procgen): regenerate the two artifacts whose
> `--check` gates had gone stale on main (⚖ user 2026-08-25)"*, 2026-08-24.

Its diff to `frontend/atlas-pools/seedling-atlas-pool.json` is **four tiles `1 → 0`, `entrance_tile.x`
and `entrance.x` `4 → 2`, plus `pool_id`/`content_hash`** — a 1:1 match for the six values above. The
drift is not in the generator. It is in the generator's **INPUT**.

### The ruling: (a) INTENDED — a stale committed derivative, not a defect

`c8447dd56` deliberately re-pinned the pool because the pool's OWN `--check` gate had gone stale. What
it did not do is regenerate the pool's other consumer. The committed
`frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json` was last regenerated at `ddfe003b2`
(2026-07-27) — **before** the pool moved — so it has been stale for **12 days**. The commit's own
record says *"The atlas half was already byte-identical; no atlas_ref moves"*, and that sentence is
true — **of `seedling_playthrough`**, the other artifact it regenerated. `seedling_atlas_sphere` is a
different, second consumer of the same pool, and nothing in the tree told anyone.

`verify-atlas-sphere-roundtrip`'s FAIL is therefore **correct and true**. The script is right; the
committed preset is stale. **It was not fixed here** — see the ⚖ below.

### Which committed presets share the producer path (measured, not assumed)

`git grep -al "owls_nest_entrance" -- frontend/presets` → three. They do not share a fate:

| preset | shape | state |
|---|---|---|
| `seedling_atlas` | `atlas_ref` + `atlas_region` — a **REFERENCE** (the H5 finding) | cannot go stale on tile bytes |
| `seedling_atlas_maze` | inlines `playable_payload`; `owls_nest_entrance.entrance.x` = **2** | current with the pool |
| `seedling_atlas_sphere` | inlines `playable_payload`; `.entrance.x` = **4** | **STALE** |

**Exactly one** committed preset is affected. No `check-*` gate names `seedling_atlas_sphere` at all
(`git grep -al seedling_atlas_sphere -- scripts/procgen` → only the two `verify-*` scripts) — which is
this survey's whole thesis, arriving with a worked example.

### ⚖ FOR THE USER — a committed preset whose bytes would move

Regenerating `frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json` would move six values in a
tracked file and is a ⚖ 49-class re-record. **Not done here.** The three options, for the record:
regenerate it (six values, and the script goes green); leave it and pin the six known deltas as an
accepted diff; or drop the byte-identity assertion in favour of a normalised comparison. The first
looks right — the pool is the source of truth and the preset is simply behind it — but it is the
user's call, not the slice's.

## (5) What this section overturns

- The survey's **"NEW — and the cause is the FIXTURE, not the tree"** for `verify-maze-consumable-tiles`:
  wrong on both halves. The fixture is byte-stable across the arc, and the tree fails at `697c94ee6` too.
- The survey's **"Two unwatched scripts are reporting one drift."** They are reporting **two unrelated
  things**: an iframe-subscription race in one instrument, and a stale committed derivative behind a
  re-pinned atlas pool in the other.
- **`verify-atlas-sphere-roundtrip` is no longer inconclusive** — it is a true red with a named cause
  and a named first-bad commit.

## (6) Gates run for this slice

| gate | verdict |
|---|---|
| `verify-maze-consumable-tiles.mjs` | **`VERIFY MAZE CONSUMABLE TILES: OK`** — 4/4 |
| `check-procgen-reference.mjs` | `ALL CHECKS PASSED` |
| `check-procgen-help.mjs` | `2 CHECK(S) FAILED` — `measure-apworld-raw-view.mjs` (IMPORT side effect) and `shot-loaded-composite-map.mjs` (HELP + IMPORT side effects). **Neither is touched by this slice** (its one code commit edits one file, and it is not either of them). ⛑ Unattributed here and left for V2: the survey's population was the 62 `verify-*`/`dump-*` scripts, so it never ran this gate — these two reds have no prior measurement to compare against. |
| bounded vitest | none owed — `git grep -al verify-maze-consumable-tiles` finds only the two everything-registries (`instruments.js`, `check-procgen-help.baseline.json`), and the header docblock the catalogue reads was not edited. |
