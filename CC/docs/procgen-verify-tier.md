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
| `verify-atlas-sphere-roundtrip.mjs` | node | — | **none** | 0 | exit 1 | 18.5s | 1 assertion(s) FAILED. | **RESOLVED** — the preset is regenerated (V2 Task 0); 68 PASS / 0 FAIL. | (V2 Task 0) — untouched here. |
| `verify-bot-playthrough.mjs` | browser (:8000) | — | **none** | 1 | exit 1 | 250s | Error: [A — bounce-only full sphere playthrough] timeout waiting for: bot finished its queue | **STALE** — `bounce_sphere_worldgen` / `bounce_mixed_worldgen` deleted at `ccfc5bad0` (2026-06-26). | STALE — **V3b owns the name**; not deleted here. |
| `verify-bounce-embed.mjs` | browser (:8000) | — | **none** | 2 | exit 0 | 18s |  |
| `verify-bounce-touch.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 9s | All bounce touch checks passed. |
| `verify-cli-sphere-config.mjs` | node | — | **none** | 0 | exit 0 | 2.7s | VERIFY CLI SPHERE CONFIG: ALL OK |
| `verify-dj-real-embed.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 101s | Error: timeout waiting for: dj page configured with region_3_3 | **STALE** — `bounce_dj_worldgen` deleted at `ccfc5bad0` (2026-06-26). | STALE — **V3b owns the name**; not deleted here. |
| `verify-dj-swf-patch.mjs` | node | — | **none** | 0 | exit 0 | 0.3s | PASS: swf_inject.mjs output byte-identical to inject_tracer.py --stage-width 600 (681148 bytes) |
| `verify-grid-growth-ui.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 15s | PASS — grid-growth streams denominator-less live progress and produces a result |
| `verify-item-channels.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 27s | ‼ FAILURE: rep 0 leaked a cross-substrate grant | **INSTRUMENT — and a FLAKE, not a standing red** (5 red / 2 green solo at HEAD). The "leak" is the check losing a race to the task's OWN auto-repeat: `omsi gold 0 -> 2` is rep 1's scheduled award arriving on time, and the rep counter reads `reps=2` at the failure. FIXED. | **GREEN at V2** — untouched here. |
| `verify-jta-balance-pass.mjs` | node | — | **none** | 6 | exit 0 | 7.2s | PASS: full coverage, no stalls, no saturation |
| `verify-jta-cost-hooks.mjs` | node | — | **none** | 0 | exit 0 | 3.2s | ALL CHECKS PASSED |
| `verify-jta-dataset-load.mjs` | node | — | **none** | 1 | exit 0 | 0.2s | All dataset-load smoke checks passed. |
| `verify-jta-dataset-pipeline-preset.mjs` | node | — | **none** | 1 | exit 0 | 0.2s | ALL PASS — the pipeline reproduces the playable jta_dataset_test world |
| `verify-jta-dataset-transfer.mjs` | node | — | **none** | 1 | exit 0 | 0.4s | All dataset-transfer assertions passed. |
| `verify-jta-dataset-url-boot.mjs` | node | — | **none** | 0 | exit 0 | 2.0s | All ?dataset= boot assertions passed. |
| `verify-jta-generated-dataset.mjs` | node | — | **none** | 0 | exit 0 | 1.0s | All generated-dataset assertions passed. |
| `verify-jta-locations-roundtrip.mjs` | node | — | **none** | 5 | exit 0 | 15.4s | All round-trip assertions passed. |
| `verify-jta-managed-zone-skip.mjs` | node | — | **none** | 0 | exit 0 | 0.7s | All managed-mode zone-skip assertions passed. |
| `verify-maze-consumable-tiles.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 35s | ‼ FAILURE: timeout waiting for: omsi resources.houses reaches 1 | (V1's — fixed there) | (V1's) — untouched here. |
| `verify-maze-loop-mana.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 44s | ‼ FAILURE: timeout waiting for: loop mode auto-enabled | **INSTRUMENT** — its uncommitted fixture was simply ABSENT, so the page loaded no world; regenerated, that assertion passes. FIXED (a preflight). ⚖ Underneath is **SUBJECT**: loops HALTS at the first maze `locationCheck`. | **FIXED (V3a).** The ⚖ is CLOSED by the user's ruling: the park is INTENDED. Every maze block is set to Bot before `startProcessing()` and read back; two transient claims moved onto the event stream. 3× green, 12–13 s. |
| `verify-omsi-mana-leg.mjs` | browser (:8000) | — | **none** | 1 | exit 1 | 41s | ‼ FAILURE: timeout waiting for: per-batch draining (≥5 small decrements tracking the budget) | **INSTRUMENT** — it drives UNPARKED live play, which `f2e392df1` (2026-07-24, park-gated stepping) froze BY DESIGN a week after the script was written. 304 messages, 304 `skippedGated`, 0 `ticksStepped`. ⚖ Named, not fixed. | **FIXED (V3a).** The park is built the way the green in-app rows build it, and asserted on the bridge's own `step gate: OPEN` line. Three further findings underneath: the park races the region entry; the fork boots at a HELD boundary; victory must be claimed before the exhaustion leg destroys the park. 3× green, 17 s. |
| `verify-preset-panel-click.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 24s | ALL OK |
| `verify-procgen-presets.mjs` | browser (:8000) | — | **none** | 1 | exit 0 | 171s | All 27 preset drop-down checks passed. |
| `verify-region-library-roundtrip.mjs` | node | — | **none** | 2 | exit 0 | 15.8s | All region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip-maze.mjs` | node | — | **none** | 0 | exit 0 | 30.8s | All maze sphere region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip-runner.mjs` | node | — | **none** | 1 | exit 0 | 51.3s | All runner sphere region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip.mjs` | node | — | **none** | 6 | exit 0 | 25.9s | All sphere region-library round-trip assertions passed. |
| `verify-region-library-ui.mjs` | browser (:8000) | — | **none** | 0 | exit 0 | 45s | All region-library UI assertions passed. |
| `verify-region-marking-tool.mjs` | browser (:8000) | host | **none** | 13 | exit 0 | 11s | OK: region marking tool verified in-app |
| `verify-region-step-editing.mjs` | node | — | **none** | 3 | exit 0 | 19.0s | VERIFY REGION-STEP EDITING: ALL OK |
| `verify-rule-gated-portals.mjs` | browser (:8000) | — | **none** | 0 | exit 1 | 45s | locator.click: Timeout 30000ms exceeded. | **INSTRUMENT**, stale TWICE from 2026-06-19 (`85c1c3ba1` label, `06eafea4e` prep hook). FIXED; the app's authored-lock claim is now GREEN and newly witnessed. ⚖ One leg (the no-input climb reaching the portal) remains. | **FIXED (V3a).** The ⚖ leg is CUT by the user's ruling; the witnessed `PORTAL UNLOCKED` claim stays and the header now says that per-portal physical reachability is NOT asserted. 3× green, 26–29 s (was ~120 s). |
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

⇒ **V2 (below) gives every row a verdict; V3a fixes the last three.** The third column is the survey's,
the fourth is V2's (as amended by V2b), and the fifth is where the row stands after **V3a**.
**All eight are accounted for: five fixed instruments, one fixed-here omsi instrument, two STALE
(V3b owns their names), and — with V2's SUBJECT ruling overturned at V2b — ZERO subject defects.**

| script | first failing line | pre-existing at `697c94ee6`? | ⇒ V2 verdict | ⇒ V3a |
|---|---|---|---|---|
| `verify-item-channels.mjs` | `‼ FAILURE: rep 0 leaked a cross-substrate grant` | **PRE-EXISTING** — identical failure on the pre-arc tree | **INSTRUMENT — and a FLAKE, not a standing red** (5 red / 2 green solo at HEAD). The "leak" is the check losing a race to the task's OWN auto-repeat: `omsi gold 0 -> 2` is rep 1's scheduled award arriving on time, and the rep counter reads `reps=2` at the failure. FIXED. |
| `verify-maze-loop-mana.mjs` | `‼ FAILURE: timeout waiting for: loop mode auto-enabled` | **PRE-EXISTING** — identical | **INSTRUMENT** — its uncommitted fixture was simply ABSENT, so the page loaded no world; regenerated, that assertion passes. FIXED (a preflight). ⚖ Underneath is **SUBJECT**: loops HALTS at the first maze `locationCheck`. |
| `verify-omsi-mana-leg.mjs` | `‼ FAILURE: timeout waiting for: per-batch draining (≥5 small decrements tracking the budget)` | **PRE-EXISTING** — identical | **INSTRUMENT** — it drives UNPARKED live play, which `f2e392df1` (2026-07-24, park-gated stepping) froze BY DESIGN a week after the script was written. 304 messages, 304 `skippedGated`, 0 `ticksStepped`. ⚖ Named, not fixed. |
| `verify-dj-real-embed.mjs` | `Error: timeout waiting for: dj page configured with region_3_3` | **PRE-EXISTING** — identical | **STALE** — `bounce_dj_worldgen` deleted at `ccfc5bad0` (2026-06-26). |
| `verify-rule-gated-portals.mjs` | `locator.click: Timeout 30000ms exceeded` waiting for the pipeline panel's Generate button (`:153`) | **PRE-EXISTING** — H6b already controlled this one at `f45b82789~1`; reproduced here | **INSTRUMENT**, stale TWICE from 2026-06-19 (`85c1c3ba1` label, `06eafea4e` prep hook). FIXED; the app's authored-lock claim is now GREEN and newly witnessed. ⚖ One leg (the no-input climb reaching the portal) remains. |
| `verify-maze-consumable-tiles.mjs` | `‼ FAILURE: timeout waiting for: omsi resources.houses reaches 1` | **NEW — and the cause is the FIXTURE, not the tree** (see below) | (V1's — fixed there) |
| `verify-bot-playthrough.mjs` | `Error: [A — bounce-only full sphere playthrough] timeout waiting for: bot finished its queue` | **PRE-EXISTING** — identical failure on the pre-arc tree (253 s) | **STALE** — `bounce_sphere_worldgen` / `bounce_mixed_worldgen` deleted at `ccfc5bad0` (2026-06-26). |
| `verify-atlas-sphere-roundtrip.mjs` | `FAIL: the committed seedling_atlas_sphere preset regenerates byte-identically` (1 FAIL against 67 PASS) | **INCONCLUSIVE** — the pre-arc control CRASHED (see below) | **RESOLVED** — the preset is regenerated (V2 Task 0); 68 PASS / 0 FAIL. |

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
| ⚖ 52 suite, from CI at the pushed SHA | run `33987686739` at `e104f62e3` **success** — `suite: vitest (unfiltered) 436/13301 (13293 passed \| 8 skipped \| 0 failed)`; slow battery `12/217 (217 passed \| 0 failed)`. **Delta 0/0** against the H6b close (`ef2f40efe`, 436/13,301), derived per file: `git merge-base --is-ancestor ef2f40efe e104f62e3` holds, and the four files changed in that range include **zero** `*.test.js` — `regionRoundTrip.js` is another session's, the other three are this slice's one script and two docs. |

# V2 as built — the ⚖ regeneration, the six reds, the help gate (2026-09-05)

Three tasks, and **the survey's "cluster" is dissolved**: the three scripts it grouped as *"cross-substrate
grant + two mana legs, may be one defect"* have **three unrelated causes**, and V1's grant-before-subscribe
race explains **none** of them. Two more rows turn out to be **STALE** — their subject was deleted
2.5 months ago and nobody noticed, which is this survey's thesis arriving twice more.

## Task 0 — `seedling_atlas_sphere` regenerated (⚖ user, 2026-09-05)

Regenerated with the command the preset's own README and `verify-atlas-sphere-roundtrip.mjs:287-292`
both run — `dump-sphere-growth.js --seed 1 --region 8x6 --quota maze=6 --quota atlas:seedling=10
--start maze --fillers 3 --atlas frontend/atlas-pools/seedling-atlas-pool.json --rules-out <the preset>`.
⛑ The brief pointed at `:220-228`; that is the THROWAWAY `atlas_sphere_worldgen` world's
`world_generator` + `Generate.py` path. The committed preset's regeneration is the `dump-sphere-growth.js`
call at `:287`, which is also what its byte-identity assertion compares against.

**Exactly the six values V1 named moved**, no keys added or removed, file length unchanged at
124 377 bytes — a 1:1 match for `c8447dd56`'s diff to the atlas pool:

| path | before (committed) | after (regenerated) |
|---|---|---|
| `/preset_sidecars/1/overworld_start__r8c0/playable_payload/tiles/[211]` | 1 | 0 |
| `/preset_sidecars/1/overworld_start__r8c0/playable_payload/tiles/[231]` | 1 | 0 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/tiles/[9]` | 1 | 0 |
| `/preset_sidecars/1/starting_house/playable_payload/tiles/[19]` | 1 | 0 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/entrance/x` | 4 | 2 |
| `/preset_sidecars/1/owls_nest_entrance/playable_payload/exits/[2]/x` | 4 | 2 |

| gate | verdict |
|---|---|
| `verify-atlas-sphere-roundtrip.mjs` | **68 PASS / 0 FAIL** (was 67/1), run twice |
| `pytest test test_json worlds` | **1507 passed, 2 skipped, 21 299 subtests**, 492 s |
| `test/general/test_schema_validation.py` (strict schema) | 2 passed, 210 subtests |
| `test/test_rules_json_writer_agreement.py` | 6 passed, 307 subtests |
| `frontend/presets/preset_files.json` | **unchanged** — same file, same path |
| pins naming this preset | **none** (re-derived: `standing-values.json` has zero `atlas` rows; there is no `scripts/known-original-md5s.json`) |

⚠ **The whole-`pytest` run WRITES INTO THE TREE, and that is not this slice's change.** It generated an
APQuest seed and appended it to the *tracked* `frontend/presets/preset_files.json`, leaving
`frontend/presets/apquest/AP_07758176404715800194/` untracked beside it. Both were restored and neither is
in any commit here — but anyone reading `git status` after a full pytest should know the tree is dirty by
the test run, not by them.

## Task 1 — the six pre-existing reds, one verdict each

| script | verdict | cause, dated |
|---|---|---|
| `verify-rule-gated-portals.mjs` | **INSTRUMENT** (fixed; one leg is a ⚖) | `85c1c3ba1` + `06eafea4e`, both 2026-06-19 | **INSTRUMENT**, stale TWICE from 2026-06-19 (`85c1c3ba1` label, `06eafea4e` prep hook). FIXED; the app's authored-lock claim is now GREEN and newly witnessed. ⚖ One leg (the no-input climb reaching the portal) remains. |
| `verify-maze-loop-mana.mjs` | **INSTRUMENT** over a **SUBJECT** ⚖ | fixture absent; then loops halts | **INSTRUMENT** — its uncommitted fixture was simply ABSENT, so the page loaded no world; regenerated, that assertion passes. FIXED (a preflight). ⚖ Underneath is **SUBJECT**: loops HALTS at the first maze `locationCheck`. |
| `verify-omsi-mana-leg.mjs` | **INSTRUMENT** (named, not fixed — ⚖) | `f2e392df1`, 2026-07-24 | **INSTRUMENT** — it drives UNPARKED live play, which `f2e392df1` (2026-07-24, park-gated stepping) froze BY DESIGN a week after the script was written. 304 messages, 304 `skippedGated`, 0 `ticksStepped`. ⚖ Named, not fixed. |
| `verify-item-channels.mjs` | **INSTRUMENT** (fixed) — a FLAKE, not a standing red | the task's own auto-repeat | **INSTRUMENT — and a FLAKE, not a standing red** (5 red / 2 green solo at HEAD). The "leak" is the check losing a race to the task's OWN auto-repeat: `omsi gold 0 -> 2` is rep 1's scheduled award arriving on time, and the rep counter reads `reps=2` at the failure. FIXED. |
| `verify-dj-real-embed.mjs` | **STALE** | `ccfc5bad0`, 2026-06-26 | **STALE** — `bounce_dj_worldgen` deleted at `ccfc5bad0` (2026-06-26). |
| `verify-bot-playthrough.mjs` | **STALE** | `ccfc5bad0`, 2026-06-26 | **STALE** — `bounce_sphere_worldgen` / `bounce_mixed_worldgen` deleted at `ccfc5bad0` (2026-06-26). |

### `verify-rule-gated-portals.mjs` — INSTRUMENT, stale twice from the SAME day

Written 2026-06-10; the sphere pipeline was reworked on **2026-06-19** and this file was never re-pointed.

1. **`85c1c3ba1`** made sphere mode's primary button **"Run all"**, not "Generate" — and re-pointed
   `verify-sphere-growth-ui.mjs` *in the same commit*. `git show --stat 85c1c3ba1` touches two scripts and
   neither is this one, its sibling driving the same mode. Every run since died on that selector.
2. **`06eafea4e`** moved bounce's free arrow into the substrate adapter hook `prepareSphereGrowth`, where
   it became a STARTING ITEM and **left the pool** (`itemPoolDelta: {[pick]: -1}`). This file hand-copied
   the OLD contract. Past defect 1 the panel answered
   `ERROR: planSpheres: 3 spheres need at least 3 items; pool has 2`.

Fixed: the selector; a two-arrow pool so one can still be spent on sphere 1; and `buildWorld` now **calls**
`collectSphereGrowthPrep` — the same function `procgenPipelineUI.js:4263` calls — instead of duplicating it.

⛓ **The app's claim under test is GREEN, and it had never been witnessed before.** A new assertion splits
step 3's two claims apart, so "the bridge never re-evaluated the rule" can no longer hide inside "the player
did not arrive":

```
SEED 14: start region_2_2 | free 'Right arrow' | pool 'Left arrow' in the start region
         | key_red in region_3_2 (gate [Left arrow]) | key-gated region_2_1 on start side N
GATE STATES (pre-key): {"portals":{"side_exit_N":false},"pickups":{}}
LOCKED PORTAL HOLDS: still in region_2_2 after the column climb
KEY COLLECTED: key_red in inventory
PORTAL UNLOCKED: gate_rules re-evaluated on the snapshot update
```

⚖ **FOR THE USER — the fourth leg, not fixed here.** *"The no-input player climbs the column and exits
through the unlocked portal BY ITSELF"* times out at 90 s. Measured, holding **both** arrows:
`CLIMB REACHED: entrance → b0 → b1 → b2`, then it bounces on `b2` for the remaining ~85 s
(`botStatus.active` false throughout — this leg is pure physics). The seed scan reasons over the sphere
TREE and cannot see whether the gated portal is physically reachable by an unaided climb; the old seed
happened to satisfy it, the new pool's seeds do not. Closing it means deriving per-portal reachability
(`canJump.js` / `deriveRules.js`) into the scan, or driving the last hop the way step 2 does — which would
gut the claim. **That is instrument DESIGN, not triage.**

### `verify-maze-loop-mana.mjs` — INSTRUMENT on top, SUBJECT underneath

⛔ **Its fixture was simply not on disk.** `frontend/presets/maze_loop_worldgen/` is deliberately NOT
committed (the header says so and carries the regeneration command) and was absent, so the page loaded no
world and the run died on `timeout waiting for: loop mode auto-enabled` — a line that reads exactly like the
app failing to auto-enable loop mode, and was recorded that way. Regenerated with the header's own command
the fixture is the documented shape to the letter (`region_2_2 -> region_2_3 -> region_3_3`, one location
each, `loop_costs` present) and that assertion **passes**. A preflight now names the prerequisite and prints
the command; it was driven with the fixture moved aside before being believed.

⛑ This also settles the brief's `?mode=loops` question: it is unrelated. `frontend/modes.json:233` really
does define a `loops` mode (the backlog entry recording otherwise was already corrected 2026-09-04), and
this red was a missing file.

⚖ **FOR THE USER — what the fixture uncovers is SUBJECT.** With it present the run reaches
`timeout waiting for: per-tile charging (≥3 small decrements + XP accrual)`. Measured twice — through the
script, and through a standalone probe sampling every 5 s for 60 s:

- the loops queue builds correctly: **6 actions** (`regionMove Menu->region_2_2`,
  `locationCheck region_2_2__loc_0__5_4`, `regionMove region_2_2->region_2_3`, …);
- `getLoopState().startProcessing()` **does** start — `isProcessing` true, `isPaused` false,
  `currentActionIndex` 0 → 1 (action 0, the Menu hop, runs);
- within 5 s `isProcessing` is false again and never resumes: index frozen at **1**, region `region_2_2`,
  mana **100/100**, `manaEvents` `[100]`, `substrateCompleted` `[]`, every region's XP 0, for 60–180 s.

**Processing HALTS at the first maze `locationCheck`** — the delegated per-tile charging the instrument
exists to observe never runs. The script is right and its fixture is right; what stops is the app.

### `verify-omsi-mana-leg.mjs` — INSTRUMENT: it drives a mode the app deliberately froze

Its first four assertions pass (`loop mode auto-enabled`, `omsi region entered; bridge clock running`,
`native budget bonus 250 raised maxMana (100 → 350)`, `game budget pinned to pool`). Then nothing drains,
and the timeout dump says why in one field:

```
clockStats: {"messages":304,"callbacks":304,"ticksStepped":0,"skippedGated":304, …}
[omsi-bridge] step gate: CLOSED (enforced=true, livePlay=none, bot=none, here=none)
```

**All 304 ticks were refused by the step gate.** `_mayStepClock()` (`omsiSubstrateWrapper/bridge.js:531`)
opens only for a replay, a bot region, or `_stepGateLiveRegion === _currentRegionId`; and
`loopState.livePlayRegion()` (`loopState.js:2283`) returns null unless the loops queue is **parked** on a
`manual` / `record` / `bot` block. This script does not build a loops queue at all — it enters the omsi
region and queues a Wander **inside the game**. That is unparked live play, which **`f2e392df1`
(2026-07-24, "omsi arc D slice 2: park-gated stepping")** froze *by design*, one week after this script was
written (`7f8862ec2`, 2026-07-17).

⚠ The bridge's own docblock says *"Both default to the OPEN position, so the game is never stuck waiting for
a push that never comes"* — and `enforced=true` with `livePlay=none` is exactly stuck. That sentence is true
of each half separately and false of the pair.

⚖ **FOR THE USER — named, not fixed.** The repair is to teach the instrument to park a loops queue on a
manual block in the omsi region before driving, which is instrument design; and the row above shows loops
halting at the first substrate action anyway, so the two ⚖ are probably one piece of work.

### `verify-item-channels.mjs` — INSTRUMENT: a FLAKE, and the flake was a race with the task's own repeat

⛔ **It is not a standing red.** Solo runs at HEAD: **5 red / 2 green** over seven, every red identical.
The survey's `‼ FAILURE: rep 0 leaked a cross-substrate grant` could not name what it saw, so the first fix
was to make it print the numbers — which produced the answer immediately: `omsi gold 0 -> 2`, and 2 is
**exactly rep 1's scheduled foreign award** (`omsi/gold x2`).

Three alternatives were measured rather than argued:

- **the omsi engine drifting on its own** — refuted: a probe held the `jta_schedule_test` page 30 s driving
  nothing, sampling every 2 s; `gold` 0 and `timer` 250 in all 15 samples, with the step gate CLOSED;
- **stale progress surviving the save clear** — refuted: the task's own counter reads `reps: 0` immediately
  before the call (`{"id":14,"name":"Salvage the Pressure Door","reps":0,"maxReps":10,…}`);
- **the task's own auto-repeat** — **confirmed**: reading the counter at the moment of failure gives
  **`reps=2`**. `maxReps` is 10 and the fork starts the next rep as soon as one finishes, so rep 1 had
  already run and its gold had arrived **on time**. The old check polled rep 0's local deposit at 400 ms
  and then read gold, so whenever rep 1 landed inside that window it reported a leak that never happened.

Fixed: the rep counter and the omsi bag are now read in **one round trip** and polled together at 50 ms, and
the no-early-crossing claim is made **only about a window actually observed** (`reps === 1` — rep 0 done,
rep 1 not). If the reps run past that window the leg says so and **skips** the claim rather than inventing a
verdict, and it then does not re-drive rep 1 (which would be rep 2, a different schedule entry).

### `verify-dj-real-embed.mjs` and `verify-bot-playthrough.mjs` — STALE, same commit

Their subjects were deleted **2.5 months ago**. `ccfc5bad0` (2026-06-26, *"presets: regenerate post-0.6.8 +
preserve dev presets"*) says in its own message that it *"drops … the `*_worldgen` preset dirs that the
workflow does not produce"*, and among them were all three of these:

| preset | on disk | in `preset_files.json` | tracked | deleted by |
|---|---|---|---|---|
| `bounce_dj_worldgen` | no | no | no | `ccfc5bad0` |
| `bounce_sphere_worldgen` | no | no | no | `ccfc5bad0` |
| `bounce_mixed_worldgen` | no | no | no | `ccfc5bad0` |

Both scripts address them as `?game=<name>&seed=1`, and `modeDataLoader.js:366-395` resolves `?game=`
**through `preset_files.json`** — a name that is not in it yields no `rulesOverride` at all, so the app boots
with no world and the waits (`dj page configured with region_3_3`; `bot finished its queue`) can only time
out. ⛔ **Neither script is deleted here** — V3 owns names.

## Task 2 — `check-procgen-help.mjs`: **ALL PASS**

```
ALL PASS — `--doors=all`: 267 instrument(s) answer `--help` with no side effect this gate can
observe; 252 are on the import-door baseline as module-scope workers and every import door was asked
```

Both reds were the APWorld hub arc's, and both postdate the baseline's `measuredAt` (`c5b7bd876`), so the
gate red them **by name** as new module-scope workers — the gate working, not a regression.

- `measure-apworld-raw-view.mjs` (H2) — **IMPORT** door only. The box lock, the corpus scan and
  `chromium.launch()` ran at module scope, so a bare `await import()` **took the real box and drove a
  headless browser**. `--help` was already inert.
- `shot-loaded-composite-map.mjs` (H4a) — **BOTH** doors: it had no `argvHelp` call at all, so `--help` ran
  the whole shot, and its body was module scope, so an import did too.

Fixed **to the law, not baselined**: the driving half of each moves into an `async function main()` behind
`if (isEntryPoint(import.meta.url))` — the pattern `check-slice-records.mjs` and `record-slice.mjs` already
use, and 15 of the 267 instruments have an inert import this way. ⛔ Baselining was the local precedent
(252 of 262 entries are on the baseline, and `verify-seedling-ap-placement.mjs` was **hand-interpolated**
there at EDITOR INTEGRATION P2 for this exact symptom), but the baseline names the IMPORT door only and
`shot-loaded-composite-map.mjs` was failing HELP too.

Measured on the working tree, both doors, each child in its own `XDG_CACHE_HOME`:

| door | before | after |
|---|---|---|
| import | exit 1, 1 cache entry (`seedling-box`), `# box lock: TAKEN …` on stdout | exit 0, **0** cache entries, no stdout, no stderr |
| help | (shot) ran the instrument | exit 0, the derived help text, empty stderr |

⚠ **`verify-seedling-ap-placement.mjs`'s row is GREEN** — the brief asked. It is not fixed; it is
**on the baseline**, hand-interpolated at P2, and `ALL PASS` above includes it.

⛑ Adding `argvHelp` to one file moves its derived row, so `generate-procgen-reference.mjs` was re-run:
`instruments.js` gains one inherited-flag entry and `architecture.md`'s generated region moves
**264 → 265** argvHelp inheritors. `check-procgen-reference.mjs` was RED on the stale `instruments.js`
before that regeneration — that red was this slice's, and it is green after.

## What V2 overturns

- **The survey's cluster is dissolved.** *"The first three CLUSTER (cross-substrate grant + two mana legs)
  and may be one defect"* — they have three unrelated causes: a race with a task's own auto-repeat, a
  fixture that was not on disk, and a step gate that freezes unparked live play by design.
- **V1's grant-before-subscribe race explains none of them**, and it was the brief's leading hypothesis.
- **`verify-item-channels` was never a standing red** — it is a flake (5/7 at HEAD), so the survey's
  "eight scripts fail at HEAD" is **seven that fail and one that sometimes does**.
- **Two of the six are STALE**, not failing: their presets were deleted at `ccfc5bad0` on 2026-06-26 and
  nothing in the tree said so. That is two more worked examples of this survey's thesis.
- The reds that remain are **two ⚖ for the user** (loops halting at the first substrate action; the
  no-input climb not reaching a correctly-unlocked portal) plus one instrument-design job the omsi leg
  needs — and the omsi one is probably the same piece of work as the loops one.

## ⚖ 52 — the suite row, QUOTED from CI at the pushed SHA

```
CI vitest @ 84b5e7115 — run 33992632924 success (2026-09-05T21:17:58Z)
  suite: vitest (unfiltered)  436/13301   (13293 passed | 8 skipped | 0 failed)
  slow battery                12/217      (217 passed | 0 failed)
```

**Delta: ZERO on both counts.** `git merge-base --is-ancestor ef2f40efe 84b5e7115` holds, so the APWorld
hub arc's standing `436/13,301` is comparable — and V2 moves neither number. It touches exactly one test
file (`scripts/procgen/boxLock.test.js`, +16/−1) and adds no test, which is what a zero delta should look
like here: the change declares two files in an existing row's list rather than asserting anything new.

---

# V2b as built — the loops halt is a **PARK, by design**; V2's SUBJECT ruling is OVERTURNED (2026-09-05)

⚖ user, 2026-09-05: *"Investigate the loops halt now, before the rename."* A diagnosis slice — reproduce,
isolate, name the cause; fix only if the cause is one clear defect. **It is not.** The halt is loops'
documented M4/M6 park, and `verify-maze-loop-mana.mjs` is a **fourth INSTRUMENT** red — the same shape, from
the same week, as the omsi mana leg.

## The firing site, in one stack

Reproduced first try, headless, on the regenerated fixture, with a throwaway probe that replaced
`loopState.isProcessing` and `.currentActionIndex` with accessors and printed the stack of every write.
Two writes in the whole run, 45 ms apart:

```
[+1ms]  isProcessing = true    (index 0)
    at LoopState._beginProcessing   (loopState.js:871)
    at LoopState.startProcessing    (loopState.js:836)

[+30ms] currentActionIndex 0 -> 1  (action 0, the Menu -> region_2_2 hop, completed)
    at LoopState._completeCurrentAction (loopState.js:3243)

[+45ms] isProcessing = false   (index 1)
    at LoopState.stopProcessing          (loopState.js:915)
    at LoopState._handleManualRegionEntry(loopState.js:2516)
    at LoopState._processFrame           (loopState.js:1220)
```

`loopState.js:1220` is the M4 **block-mode dispatch**:

```js
if (modeBlock && (blockMode === 'manual' || blockMode === 'record')) {
  …
  this._handleManualRegionEntry(modeBlock.region);   // → stopProcessing()
  return;
}
```

`loopState:manualEntered` fires with `regionName: "region_2_2"`, and the omsi bridge's own log flips to
`step gate: CLOSED (enforced=true, livePlay=region_2_2, …)` in the same frame — the park is visible from a
second subsystem. **Nothing throws, nothing is dropped, no message races a subscriber**: V1's
publish-before-subscribe shape is refuted here by the stack alone (a direct synchronous call, not an
`eventBus` hop).

## Why the block is in a parking mode: two commits, six days after the instrument was written

Measured on the page, per region, with the queue built exactly as the instrument builds it:

| region | `getBlockMode(r,1)` | supportsManual | supportsRecord | captureShape | `regionSolver` | boundRecording |
|---|---|---|---|---|---|---|
| `region_2_2` | **`record`** | true | true | `fine` | `delegation` | false |
| `region_2_3` | **`record`** | true | true | `fine` | `delegation` | false |
| `region_3_3` | **`record`** | true | true | `fine` | `delegation` | false |

No block has an explicit mode, so `getBlockMode` falls through to `this.defaultBlockMode`
(`loopState.js:216`) — **`'record'`**, set by **`47c3a7f346`** (2026-07-23, *"loops M4 (5/n): … Record
default"*). The instrument was added by **`48458da2bc`** (2026-07-17). **Six days.**

And the other half, which is what makes this unfixable by re-defaulting: **`05979752fb`** (2026-07-23,
*"loops M6 (2/n): the Bot radio — one trigger for both solvers"*) **deleted the unconditional delegation
dispatch from `_processFrame`**. The removal left its own tombstone at `loopState.js:1314-1318`:

> `// (M6: the unconditional bot dispatch that used to sit here — the last leg of the auto execution chain`
> `// — is gone. Solver execution is reachable only through the Bot branch above. …)`

So **substrate delegation — the exact seam this instrument exists to observe — is reachable only from a
`bot`-mode block.** Every other mode parks a fine-grained maze block: `manual` and `record` at `:1220`,
`playback` with no bound recording at `:1249`, a `bot` block with no engageable solver at `:1295`. The
contract is written down: `docs/json/developer/procgen/loop-recording.md:18,23,34` — *"a **Bot** block is
the one trigger for both [solvers]"*, *"Bot is an explicit per-block choice: it does not join the
`defaultBlockMode` enum"*.

## The discriminator: the same run with the blocks set to `bot`

One line changed in the probe (`setBlockMode(r, 1, 'bot')` on the three regions before
`startProcessing()`), nothing else — same fixture, same queue, same 30 s window:

| observable | default (`record`) | forced `bot` |
|---|---|---|
| `loopState:manualEntered` | `["region_2_2"]` | `[]` |
| `manaChanged` events | 1 | **11** |
| per-tile decrements | none | **16.67, 13.75, 13.75, 13.75**, then 42.08 |
| region XP | all 0 | `region_2_2` 16.67, `region_2_3` 41.25, `region_3_3` 60 |
| `loops:substrateActionCompleted` | `[]` | `[true,true,true,**false**,true]` |
| `loopResetCount` | 0 | **1**, mana refilled, queue snapped to index 0 |
| final region | `region_2_2`, frozen at index 1 | walked the whole chain to `region_3_3` |

**Every claim `verify-maze-loop-mana.mjs` makes — delegated per-tile charging, 1:1 XP, `completed:false`
from the interrupted walk, the OOM reset — is satisfied by the app as it stands.** The instrument asks for
them without asking for the mode that produces them.

## Verdict: INSTRUMENT (⚖ named, not fixed) — and V2's own ruling is overturned

V2 wrote *"The script is right and its fixture is right; what stops is the app."* The first two clauses hold;
**the third does not.** The app is doing what M4 and M6 designed and documented. `verify-maze-loop-mana.mjs`
joins the other three as **INSTRUMENT**, which makes V2's tally **five INSTRUMENT / two STALE / zero
SUBJECT** — one more worked example of this survey's thesis, and the strongest one: the red had already been
mis-attributed to the app twice (the survey, then V2).

⛑ The contrast the brief asked for lands in one line: **`mazeBlockModeTests.js:212` calls
`setBlockMode(region, visit.instance, 'manual')`.** The green maze block-mode rows are green *because they
set a mode*; they drive the park deliberately. **No `scripts/procgen/*.mjs` instrument sets a block mode at
all** (grepped, zero hits) — so every node-side instrument that expects a maze block to auto-execute has
been asking for a path M6 removed.

## ⚖ (a) and ⚖ (c) — ONE cause family, TWO opposite repairs

Both instruments were written on **2026-07-17**; both were invalidated by loops' park-gating week,
**2026-07-23/24** (`47c3a7f346` Record default, `05979752fb` bot-only solver dispatch, `f2e392df1`
park-gated omsi stepping). That is one design change with two stale consumers — but the repairs point in
**opposite directions**, so this is not one code fix:

- **maze (⚖ a)** needs its blocks set to **`bot`**, so delegation dispatches and **no park happens**;
- **omsi (⚖ c)** needs a loops queue **parked** on a `manual`/`record`/`bot` block in the omsi region, so
  `_mayStepClock` (`omsiSubstrateWrapper/bridge.js:531`) sees `livePlayRegion()` and **opens**.

The park the maze leg must avoid is the same park the omsi leg must create. Reading them as "probably one
piece of work" (V2) is right about the *cause* and wrong about the *fix*.

## ⚖ FOR THE USER — the question, with its answer already measured

**Is "a maze region in a loops queue parks for live play unless its block is explicitly set to Bot" the
intended contract?** M4/M6's code comments and `loop-recording.md` both say yes, and M6 says why: a Bot
block that can't engage *"parks for live play with a loud `console.warn`, never a silent generic-timer
teleport through content the bot was meant to play."*

- **If yes** — `verify-maze-loop-mana.mjs` gains three `setBlockMode(region, 1, 'bot')` calls before
  `startProcessing()` and goes green (measured above), and the same slice can decide whether the omsi leg
  gets its manual park. That is **instrument design**, one small slice, and it would close both ⚖ at once.
- **If no** — i.e. loops *should* auto-run a solver for a fine-grained substrate with no recording — then
  `05979752fb` is the defect, and reverting it re-opens exactly the silent-teleport failure mode M6 was
  written to prevent. That reading contradicts a documented ruling, so it is the user's call, not a
  triage call.

**Not fixed here.** Per the slice's own rule — DESIGN ⇒ record the reproduction, the site and the question,
and stop. No product code and no instrument was touched by V2b; the probes were throwaways in gitignored
`NewDocs/scratch/`.

---

# V3a as built — three instrument-design fixes; the survey's eight rows are all accounted for (2026-09-05)

⚖ user, 2026-09-05, two rulings, both taken as given: **(1)** *"a maze block parks for live play unless
explicitly set to Bot"* is the INTENDED contract — the instruments change, the app does not; **(2)**
`verify-rule-gated-portals.mjs`'s physics leg is **CUT**, its witnessed `PORTAL UNLOCKED` claim stays.
⛔ **No app code was touched.** Three commits, one per script, pushed on `main`:
`b86580f9ca` (portals) · `226e397674` (maze) · `2b8c9be271` (omsi).

**Every gate green, and the omsi leg turned out to be four findings, not one.** The maze and portal fixes
were the size the brief predicted; the omsi one was not, and each layer only became visible once the one
above it was repaired.

## The three OK lines, quoted with END times and load

| instrument | runs | OK line | wall | load at END |
|---|---|---|---|---|
| `verify-rule-gated-portals.mjs` | 3/3 | `VERIFY RULE-GATED PORTALS: ALL OK` | 27 / 26 / 29 s | 1.92 1.48 2.57 · 2.58 1.69 2.62 · 3.92 2.16 2.74 |
| `verify-maze-loop-mana.mjs` | 3/3 | `VERIFY MAZE LOOP MANA: OK` | 13 / 12 / 13 s | 2.61 2.32 2.66 · 3.84 2.61 2.76 · 3.70 2.62 2.76 |
| `verify-omsi-mana-leg.mjs` | 3/3 | `VERIFY OMSI MANA LEG: OK (17.0s wall)` | 18 / 18 / 18 s | 1.23 1.16 1.58 · 1.54 1.25 1.60 · 1.48 1.25 1.60 |

END times UTC: portals 21:47:37 / 21:48:03 / 21:48:32 · maze 21:52:15 / 21:52:27 / 21:52:40 ·
omsi 22:15:20 / 22:15:38 / 22:15:56.

## (1) `verify-maze-loop-mana.mjs` — Bot, read back, and two claims taken off SAMPLING

The fix the brief specified, plus one it could not have: **two of this script's claims are about
TRANSIENTS**, and a 500 ms poll cannot see either.

The blocks are set with the public *"set all"* control (`setAllBlockModes('bot')`, which skips any region
whose substrate cannot offer the mode, so it cannot claim a block it did not set) and then **read back**
per chain region. That read-back is the row that reds by name if the mode is ever left at the default
again — instead of 180 s later as a mana timeout that reads like the walker never charging.

Measured, and matching V2b's discriminator to the digit:

```
✓ every maze block set to Bot (3 changed; read back
  {"region_2_2":"bot","region_2_3":"bot","region_3_3":"bot"})
manaEvents [100, 83.33, 83.33, 83.33, 69.58, 69.58, 69.58, 55.83, 42.08, 0, 120]   (11)
drops 16.67 · 13.75 · 13.75 · 13.75 · 42.08
XP    region_2_2 16.67 | region_2_3 41.25 | region_3_3 60
substrateActionCompleted [true, true, true, false, true]     loopResetCount 1
```

⛓ **The transient.** The reset's teleport and the queue's next move land in the SAME MILLISECOND:

```
+1917ms region_2_3->region_2_2 mana 120.00/120 resets 1 [fromReset]
+1917ms region_2_2->region_3_3 mana 120.00/120 resets 1
```

so the old `teleport back to start region` wait timed out on a teleport that had happened perfectly. It now
asserts the `gameState:regionChanged` **carrying `fromReset`** and landing on
`procgenPlayer.getResolvedStartRegion()` — the same function the omsi leg already used, and it answers
`region_2_2` here. *"The chain was walked"* reads the same cumulative log rather than where the player
happens to be standing; `completed:false` became a bounded wait rather than a field read off the snapshot
that first saw the reset (two publishes, not one).

## (2) `verify-rule-gated-portals.mjs` — the leg is cut, and the seed filter's REASON changed

Legs 1–3 stay on real physics auto-play; the witnessed claim now prints its evidence:

```
GATE STATES (pre-key): {"portals":{"side_exit_N":false},"pickups":{}}
LOCKED PORTAL HOLDS: still in region_2_2 after the column climb
KEY COLLECTED: key_red in inventory
PORTAL UNLOCKED: gate_rules re-evaluated on the snapshot update
  | gate states: {"portals":{"side_exit_N":true},"pickups":{}}
```

The header now states what is NOT asserted — per-portal physical reachability — and why the seed scan
cannot assert it (it reasons over the sphere TREE and has no model of the level's geometry). Cutting the
leg took ~85 s off each run: **~120 s → 26–29 s**.

⛑ **The `keyGated.side !== 'S'` filter STAYS, with a rewritten reason.** It no longer guards the cut leg;
it keeps **step 1** non-vacuous — *"the locked portal HOLDS"* is only a claim about a lock if the climb
actually passes the portal, and on an unreachable S exit the player could not have left through it locked
or open. Dropping the line would also re-pick the seed: measured, seeds **12 / 14 / 15** match the
topology and **12 is the S one**, so SEED would move from 14 to 12 and every logged region id with it.

## (3) `verify-omsi-mana-leg.mjs` — FOUR findings, each hidden behind the one before it

The brief predicted one fix (build the park). That fix is right and it is the first of four; the other
three only became visible once the gate it opens stopped being the thing that failed.

### 3a. The park — and it is asserted on the BRIDGE'S OWN LOG LINE

Built the way the green in-app rows build it (`omsiSubstrateWrapper/test-helpers.js`'s
`parkManualBlocks`): clear the path (loops' own `clearQueue` would teleport the player out), queue the
region's one graph exit as the block's departure, set the block Manual, hurry the arrival move, start
processing. The script cannot import that module (browser-side only), so `exit_N` / `region_1_0` are
re-declared with a note saying so, and the park fails by name if they drift.

```
✓ parked Manual block (instance 1, mode manual); step gate OPEN —
  [omsi-bridge] step gate: OPEN (enforced=true, livePlay=region_1_1, bot=none, here=region_1_1)
```

That is the same line V2 read the failure off (`CLOSED (… livePlay=none …)`), which is the point: reading
it back OPEN proves the park reached the bridge, rather than that a getter agreed with itself.

### 3b. THE PARK RACES THE REGION ENTRY — and loops' hard pause is unrecoverable

A `user:regionMove` lands as **more than one** `gameState:regionChanged`, and one arriving after the block
has parked is read as `manualWrongRegion`. Deterministic, three runs of three, identical:

```
+69ms  regionChanged {"from":"region_0_0","to":"region_1_1"}
+80ms  regionChanged {"from":null,"to":"region_1_1"}
+380ms manualEntered {"regionName":"region_1_1","expectedNextRegion":"region_1_0"}
+527ms queuePausedUntilReset {"actualRegion":"region_1_1","expectedRegion":"region_1_0",
                              "reason":"manualWrongRegion"}
```

⛔ **`startProcessing()` does NOT clear `_queuePausedUntilReset`** — only `_releaseParkForReset`,
`_resetLoop` and `resetForNewRules` do (`loopState.js:3728 / 3789 / 3743`) — so once it is set, no
re-park can rescue the run. Two changes: the script **waits for the region-event stream to go QUIET**
before parking (⛔ not a fixed sleep — the quiet period is the thing being waited for), and the gate wait
**refuses early and by name** on that flag rather than polling out 30 s into a timeout that looks
identical to "the park never took". Before the settle the park was ~50/50 across nine attempts; after it,
6/6.

### 3c. THE FORK BOOTS AT A HELD BOUNDARY — the park opens one gate and a different one is shut

With the park in place the run still stepped nothing, and the counters said where:
`ticksStepped: 0, skippedGated: 0, skippedHeldBoundary: 301`. Measured at boot, before anything is driven:

```
{shouldRestart: true, timer: 250, timeNeeded: 250, currentLen: 0, loops: 0, effTime: 0}
```

The fork boots **parked past a loop end with an empty compiled list**. Under the host-driven clock that is
a deadlock by construction: `clockGate.js`'s `isBoundaryHeld` refuses to step one (stepping mints a phantom
loop per tick), and only `restart()` clears `shouldRestart` — which `singleTick` would call, if it were
allowed to run. It is the same shape as gotchas.md's *"a frozen substrate cannot generate the reset that
unfreezes it"*.

⛑ **Every BRIDGE-mediated plan install already handles this** — `_forceLoopRecompile()`
(`bridge.js:1650`) runs on the replay install, the bot exit install, the bot cold start and the host's
reset catch-up. **LIVE PLAY has no such path.** And that is why the green in-app row never needed one:
`omsi-loop-exhaustion-single-reset` runs AFTER `omsi-out-of-mana-loop-reset` in the same page, and that
row's host loop reset already ran `restartLoop()` through the catch-up. A standalone script has no
predecessor. So the instrument makes the call — **conditionally**, mirroring `isBoundaryHeld`'s two halves
in the same order, so it does nothing and says so if the app ever cold-starts live play itself:

```
✓ cold start: boundary released
  {"shouldRestart":true,"timer":250,"timeNeeded":350,"currentLen":0,"nextLen":1,"effTime":0}
  -> {"shouldRestart":false,"timer":0,"timeNeeded":250,"currentLen":1,"nextLen":1,"effTime":0}
✓ pool drains in small mirrored steps (6 decrements; pool tracks budget)
  — ticksStepped 0 → 30, skippedGated 0
```

It costs **no host reset**: `_handleGameRestart`'s no-progress guard drops a restart whose loop consumed
under `NO_PROGRESS_LOOP_S` of effective time, and `totals.effectiveTime` is 0 at boot. Measured —
`loopResetCount` stayed **0** across the call and advanced to 1 only at the genuine exhaustion 2 s later.

### 3d. VICTORY HAD TO MOVE AHEAD OF THE EXHAUSTION LEG

Newly reachable, leg 5 then failed. Not because the victory watch is gated — it is not,
`_checkVictoryProgress()` is called from `_clockTick` outside the step gate (`bridge.js:718`) — but
because the `user:locationCheck` it publishes carries no `fromLoop` during live play, so loops' M3b strict
action gate refuses it without a parked block to exempt it. And by then the park is gone:
`fireLoopResetTeleport` moves the player out of the omsi region while the queue is parked on a Manual
block there, which is `manualWrongRegion` again. Re-parking after the reset was measured dead 3/3:

```
· park after the reset: {"manualEntered":true,"pausedUntilReset":true,"livePlay":null}
  | stepGate {"enforced":true,"livePlayRegion":null} mayStep=false
```

So the claim that needs the park is now made **while the park is alive**: victory runs straight after the
park, before the Wander plan is queued. Re-entry no longer claims the gate re-opens — that is **logged,
not asserted**: `isClockRunning()` is the bridge's INTERVAL, not the gate, and the old leg 4 was satisfied
by a bridge that could not step a single tick.

## What V3a overturns

- **The omsi leg was not "build the park".** The park is one of four layers; three of them
  (the entry race, the cold boot, the victory ordering) were invisible until the park worked.
- **A green in-app row is not a control for a standalone instrument.**
  `omsi-loop-exhaustion-single-reset` is green (measured this session, `test-substrates --batch=fast`
  83/83) **because a sibling row ran first in the same page** and its host reset cold-started the fork.
  The row is green and the script was right to fail.
- **The brief's "⚠ it is a REAL-TIME bot walk class of instrument (minutes each)" is wrong for this
  fixture** — measured 17.0 / 17.2 / 16.9 s wall, ~11.6 s of which is the fixed page boot. It is
  real-time in KIND (the drain is the pinned pool at ~50 ticks/s), and the pinned pool here is 100.
  The header now says the measured number instead of a class.
- **Two of the maze leg's claims were about transients**, which V2b's discriminator could not have
  revealed: it read final state, and the instrument polls.

## ⚖ FOR THE USER — one new question, and it is an APP question

**Should LIVE PLAY cold-start the fork's loop, the way every bridge-mediated plan install already does?**
A player who enters a freshly-booted omsi region, parks a Manual block and queues an action in the game's
own UI gets a game that never starts: the boundary is held, the host clock refuses to step it, and nothing
in the live-play path calls `restartLoop()`. The bot, replay and host-reset paths all call
`_forceLoopRecompile()`; live play is the one that does not. **Not fixed here** — this slice's rule is no
app code — and the instrument's cold start is deliberately conditional so it would go quiet on its own if
the app took the job.

## Gates

| gate | verdict |
|---|---|
| `verify-rule-gated-portals.mjs` | **3/3 green solo** (table above) |
| `verify-maze-loop-mana.mjs` | **3/3 green solo** |
| `verify-omsi-mana-leg.mjs` | **3/3 green solo** |
| `check-procgen-help.mjs --doors=all` | **ALL PASS** — 267 instruments, 252 on the import-door baseline, 430.3 s |
| `check-procgen-reference.mjs --check` | **ALL CHECKS PASSED** — the docblocks' first sentences are what `instruments.js` catalogues and none moved, so no generator run was owed |
| bounded vitest (`boxLock` · `argvHelp` · `gateRoster` · `rosterCategories` · `procgenDocs/`) | **11 files, 526 tests, 0 failed**, 17.1 s — including `--check` exits 0 — regenerating produces byte-identical files |
| in-app `test-substrates --batch=fast` | **83/83 passed** |
| `compare-runs.js` | **No differences in status, roster, or duration** (83/83 → 83/83) |

⛑ One docblock-only follow-up (`ea70…`, the omsi header's step numbering) landed after the table
above, so its three affected gates were re-run on the final bytes: `VERIFY OMSI MANA LEG: OK
(17.9s wall)` (END 22:41:20Z, rc=0, load 2.05 0.98 1.68) · `check-procgen-reference --check`
**ALL CHECKS PASSED** · bounded vitest (`boxLock` + `procgenDocs/`) **8 files / 475 tests / 0
failed**. A comment edit is exactly the change `boxLock.test.js` has read as a defect before, which
is why it was re-driven rather than reasoned about.

## ⚖ 52 — the suite row, QUOTED from CI at the pushed SHA

```
CI vitest @ 2b8c9be27 — run 33995895019 success (2026-09-05T22:26:02Z)
  suite: vitest (unfiltered)  436/13301   (13293 passed | 8 skipped | 0 failed)
  slow battery                12/217      (217 passed | 0 failed)
```

**Delta: ZERO on both counts, and derived per file rather than eyeballed.**
`git merge-base --is-ancestor` holds for BOTH standing baselines against `2b8c9be271` — `ef2f40efe`
(the APWorld hub arc's `436/13,301`) and `84b5e7115` (V2's own row) — so the numbers are comparable, and
they are the same numbers. V3a's three code commits touch **3 files, of which 0 are test files**
(`git diff --name-only 16c11b0e78..2b8c9be271` → the three `scripts/procgen/verify-*.mjs` and nothing
else), and add no test, so a zero delta is what this change *must* look like. `2b8c9be271` is the last
code commit; everything after it on this slice is docs.

---

# V3b — the rename (2026-09-05, `main` at `580b178cd3`)

**⚖ RULED (user, 2026-09-05):** the rename happens, after V1's drift bisect and V2/V2b/V3a's red
triage. The survey deliberately made no recommendation on which script gets which name; this
section DERIVES it from the class and says the rule out loud. **This table is committed BEFORE any
file moves**, so the derivation is readable on its own in the diff.

## The rule, and the mechanism it is made true for

Three mechanisms select the gate population by the filename prefix `check-`, and only by that:

- `gateRoster.js:47` — `export const isGateFile = (f) => /^check-[a-z0-9-]+\.mjs$/.test(f)`
- `reachClosure.js:813` — `git(['ls-files', '--', 'scripts/procgen/check-*.mjs'])`
- `ci-gates.mjs` — reads the roster, so it inherits the rule

`gateRoster.js`'s header promises a gate *"joins this roster by READING ITS FLAG, which is the only
membership rule that cannot go stale."* That is true of the FLAGS (`--host=`, `--root=`, `--pages=`)
— but **the population those flags are read over is chosen by NAME first**, so no `verify-*` can join
by declaring anything. ⇒ the rename makes the name mean what all three mechanisms already assume.

**The class rule, in one sentence each:**

- **GATE** — *its exit status is a function of its own findings*, and it prints a verdict line.
  Measured two ways, both in the table's evidence column: a `process.exit()` whose argument is
  computed from a failure counter (`failures === 0 ? 0 : 1`, `allOk ? 0 : 1`), **or** a literal
  `process.exit(1)` reached from a check on the SUBJECT, **or** — where neither exists — assertions
  that `throw`, which under Node 18 exit non-zero as an unhandled rejection (the survey measured
  exactly this for `verify-bounce-embed`). ⇒ `check-<name>.mjs`.
- **REPORT** — *every non-zero exit it can reach is a guard on its INPUT, never a claim about its
  subject*: an unknown flag, a missing `--quota`, a bad fixture id. The status says "you called me
  wrong", and the script prints no verdict at all. ⇒ keeps `dump-<name>`.
- **STALE** — the subject the script drives no longer exists in the tree. ⇒ deleted.

## ⛔ There is no third prefix, and that is a DERIVED answer, not a preference

The brief asked which prefix a report takes — `dump-` or a new `report-` — and to say why. **The
question dissolves on the measurement: all 11 REPORT-class scripts are already named `dump-`.** A
`report-` prefix introduced here would have a population of ZERO after this slice, and the one
mechanism that would have to learn it (`check-procgen-help.mjs`, whose population is `*.mjs`) does
not key on a prefix at all. ⇒ **no `report-` prefix is created.** A report IS a dump in this
directory, and the reason is that nobody ever wrote a report under another name.

⚠ The traffic runs the OTHER way, and it is one file: **`dump-spiral-byteidentity.mjs` is a GATE**.
Its own header says so — *"Not a passive dump: it self-checks and exits non-zero on any mismatch"* —
it ends `process.exit(allOk ? 0 : 1)` and prints `ALL PASS — stepped spiral == monolith`. Its three
byte-identity siblings (`dump-maze-`, `dump-sphere-`, `dump-topdown-byteidentity.mjs`) genuinely
cannot fail: no non-zero exit exists anywhere in them. Four files with one naming stem, and the
prefix was wrong on exactly the one that carries a verdict.

## ⛔⛔ WHAT OVERTURNED THE BRIEF: the roster has NO cost exclusion, and the rename is a 4 → 51 CI job change

The kickoff said to put the slow newly-adopted gates *"behind the roster's existing cost/`--win`
exclusions"*. **Measured: no cost exclusion exists.** `ciGatePlan.js:150` is the whole predicate —

```js
export function ciRunnable(gate) { return !gate.windows; }
```

— so every non-Windows `check-*.mjs` becomes a CI arm the moment it is renamed, and
`planCiShards` prices *an arm the runner has never measured at the WHOLE budget*, deliberately
(`ciGatePlan.js:41`: *"pricing an unknown at zero is how one shard silently becomes the slow one"*).
A brand-new gate is precisely such an arm, so each one lands **in a shard of its own**.

Measured by mirroring the repo root (every top-level entry symlinked, `scripts/procgen` a real copy)
and applying the full rename there — the mirror reproduces the real tree's BEFORE numbers exactly,
which is what makes it a control:

| set | BEFORE | AFTER the naked rename |
|---|---|---|
| `--set=browser` | **25 arms / 3 shards** | **52 arms / 30 shards** (27 unpriced at 600 s each) |
| `--set=headless` | **31 arms / 1 shard** | **51 arms / 21 shards** (20 unpriced) |
| procgen gate jobs per push | **4** | **51** |

⇒ **⚖ RULED (user, 2026-09-05): the fourth declaration — `@ci-box` — and the CI plan does not move.**

`ciRunnable` becomes `!gate.windows && !gate.ciBox`, and every newly adopted gate declares

```
 * @ci-box <why the box must answer this gate>
```

in its own docblock, parsed by `gateRoster.js` the way `@ci-face`, `@ci-shallow` and `@ci-argv`
already are, with the same by-name refusal for a missing reason. This is not a new idea in this
file — it is the argument `@ci-shallow`'s own docblock makes, verbatim: *"a row that must never be
CI-sourced is excluded by a clause that names the REASON, and the reason is a fact only the gate
knows"*, and *"it is one line to delete"*. ⛓ The verification is that **BEFORE == AFTER**: the shard
plan after this slice is byte-identical to the one above, which no timing band or roster-count
assertion could have told us.

⛑ **What this deliberately does NOT do.** It does not decide which of the 49 belongs in CI. That is
a per-gate question with a real answer each (an uncommitted fixture; a `Generate.py` and a Python
venv; the omsi submodule; 171 s of wall clock), and answering 49 of them is a slice of its own. What
the declaration buys is that each answer is written where the gate is, one line to delete, instead of
being a silence.

## The `--win` tier

`verify-seedling-ap-placement.mjs` and `verify-seedling-bot-differential.mjs` hold
`/mnt/c/Windows/py.exe` as a literal, so `gateRoster`'s `WINDOWS_RE` classifies them `windows` and
`ciRunnable` already excludes them — the `--win` half of the brief's sentence is real, and it needs
nothing added. Both are renamed to `check-`. ⛔ **`check-seedling-bot-differential.mjs` is NOT run
in this slice**: its full drive is a measured 142-minute GPU run (`gateRoster.js:80`, `:388`), it was
the one script of 62 the survey left without a verdict, and it is named here so that is visible
rather than silently absent.

## The derived table — 62 rows, one per script

**Class counts: 49 GATE · 11 REPORT · 2 STALE.** GATE by driver: 27 browser · 20 node · 2 windows.
⚠ The `evidence` column's verdict quote is the SURVEY's measurement, so five rows quote a `‼ FAILURE`
line — that is the strongest possible evidence for the class (the script both printed a verdict and
failed on it), and those five were fixed at V2/V3a; see §(a).

| old | new | class | drives | wall | evidence |
|---|---|---|---|---|---|
| `dump-spiral-byteidentity.mjs` | `check-spiral-byteidentity.mjs` | GATE | node | 0.6s | `process.exit(allOk ? 0 : 1)` · ALL PASS — stepped spiral == monolith |
| `verify-atlas-sphere-roundtrip.mjs` | `check-atlas-sphere-roundtrip.mjs` | GATE | node | 18.5s | `process.exit(failures === 0 ? 0 : 1)` · 1 assertion(s) FAILED. |
| `verify-bounce-embed.mjs` | `check-bounce-embed.mjs` | GATE | browser | 18s | `throw`×4 (unhandled rejection ⇒ non-zero) · **no verdict line — one added here** |
| `verify-bounce-touch.mjs` | `check-bounce-touch.mjs` | GATE | browser | 9s | `process.exit(1)` · All bounce touch checks passed. |
| `verify-cli-sphere-config.mjs` | `check-cli-sphere-config.mjs` | GATE | node | 2.7s | `process.exit(1)` · VERIFY CLI SPHERE CONFIG: ALL OK |
| `verify-dj-swf-patch.mjs` | `check-dj-swf-patch.mjs` | GATE | node | 0.3s | `process.exit(1)` · PASS: swf_inject.mjs output byte-identical to inject_trace |
| `verify-grid-growth-ui.mjs` | `check-grid-growth-ui.mjs` | GATE | browser | 15s | `process.exit(1)` · PASS — grid-growth streams denominator-less live progress  |
| `verify-item-channels.mjs` | `check-item-channels.mjs` | GATE | browser | 27s | `process.exit(1)` · ‼ FAILURE: rep 0 leaked a cross-substrate grant |
| `verify-jta-balance-pass.mjs` | `check-jta-balance-pass.mjs` | GATE | node | 7.2s | `process.exit(2 / 1)` · PASS: full coverage, no stalls, no saturation |
| `verify-jta-cost-hooks.mjs` | `check-jta-cost-hooks.mjs` | GATE | node | 3.2s | `process.exit(1)` · ALL CHECKS PASSED |
| `verify-jta-dataset-load.mjs` | `check-jta-dataset-load.mjs` | GATE | node | 0.2s | `process.exit(1)` · All dataset-load smoke checks passed. |
| `verify-jta-dataset-pipeline-preset.mjs` | `check-jta-dataset-pipeline-preset.mjs` | GATE | node | 0.2s | `process.exit(failures === 0 ? 0 : 1 / 1)` · ALL PASS — the pipeline reproduces the playable jta_datase |
| `verify-jta-dataset-transfer.mjs` | `check-jta-dataset-transfer.mjs` | GATE | node | 0.4s | `process.exit(1)` · All dataset-transfer assertions passed. |
| `verify-jta-dataset-url-boot.mjs` | `check-jta-dataset-url-boot.mjs` | GATE | node | 2.0s | `process.exit(1)` · All ?dataset= boot assertions passed. |
| `verify-jta-generated-dataset.mjs` | `check-jta-generated-dataset.mjs` | GATE | node | 1.0s | `process.exit(failures === 0 ? 0 : 1)` · All generated-dataset assertions passed. |
| `verify-jta-locations-roundtrip.mjs` | `check-jta-locations-roundtrip.mjs` | GATE | node | 15.4s | `process.exit(failures === 0 ? 0 : 1)` · All round-trip assertions passed. |
| `verify-jta-managed-zone-skip.mjs` | `check-jta-managed-zone-skip.mjs` | GATE | node | 0.7s | `process.exit(failures === 0 ? 0 : 1)` · All managed-mode zone-skip assertions passed. |
| `verify-maze-consumable-tiles.mjs` | `check-maze-consumable-tiles.mjs` | GATE | browser | 35s | `process.exit(1)` · ‼ FAILURE: timeout waiting for: omsi resources.houses reac |
| `verify-maze-loop-mana.mjs` | `check-maze-loop-mana.mjs` | GATE | browser | 44s | `process.exit(1)` · ‼ FAILURE: timeout waiting for: loop mode auto-enabled |
| `verify-omsi-mana-leg.mjs` | `check-omsi-mana-leg.mjs` | GATE | browser | 41s | `process.exit(1)` · ‼ FAILURE: timeout waiting for: per-batch draining (≥5 sma |
| `verify-preset-panel-click.mjs` | `check-preset-panel-click.mjs` | GATE | browser | 24s | `process.exit(failures === 0 ? 0 : 1)` · ALL OK |
| `verify-procgen-presets.mjs` | `check-procgen-presets.mjs` | GATE | browser | 171s | `throw`×7 (unhandled rejection ⇒ non-zero) · All 27 preset drop-down checks passed. |
| `verify-region-library-roundtrip.mjs` | `check-region-library-roundtrip.mjs` | GATE | node | 15.8s | `process.exit(failures === 0 ? 0 : 1)` · All region-library round-trip assertions passed. |
| `verify-region-library-sphere-roundtrip-maze.mjs` | `check-region-library-sphere-roundtrip-maze.mjs` | GATE | node | 30.8s | `process.exit(failures === 0 ? 0 : 1)` · All maze sphere region-library round-trip assertions passe |
| `verify-region-library-sphere-roundtrip-runner.mjs` | `check-region-library-sphere-roundtrip-runner.mjs` | GATE | node | 51.3s | `process.exit(failures === 0 ? 0 : 1)` · All runner sphere region-library round-trip assertions pas |
| `verify-region-library-sphere-roundtrip.mjs` | `check-region-library-sphere-roundtrip.mjs` | GATE | node | 25.9s | `process.exit(failures === 0 ? 0 : 1)` · All sphere region-library round-trip assertions passed. |
| `verify-region-library-ui.mjs` | `check-region-library-ui.mjs` | GATE | browser | 45s | `process.exit(failures.length ? 1 : 0)` · All region-library UI assertions passed. |
| `verify-region-marking-tool.mjs` | `check-region-marking-tool.mjs` | GATE | browser | 11s | `process.exit(failures === 0 ? 0 : 1)` · OK: region marking tool verified in-app |
| `verify-region-step-editing.mjs` | `check-region-step-editing.mjs` | GATE | node | 19.0s | `process.exit(1)` · VERIFY REGION-STEP EDITING: ALL OK |
| `verify-rule-gated-portals.mjs` | `check-rule-gated-portals.mjs` | GATE | browser | 45s | `process.exit(1)` · locator.click: Timeout 30000ms exceeded. |
| `verify-runner-bot.mjs` | `check-runner-bot.mjs` | GATE | browser | 31s | `process.exit(1)` · All runner bot checks passed. |
| `verify-runner-embed.mjs` | `check-runner-embed.mjs` | GATE | browser | 80s | `process.exit(1)` · All runner embed checks passed (sphere-grown world, bot-dr |
| `verify-runner-game.mjs` | `check-runner-game.mjs` | GATE | browser | 11s | `process.exit(1)` · All runner game-page checks passed. |
| `verify-runner-smoke.mjs` | `check-runner-smoke.mjs` | GATE | browser | 16s | `process.exit(1)` · All runner smoke checks passed. |
| `verify-seedling-ap-placement.mjs` | `check-seedling-ap-placement.mjs` | GATE | windows | 442s | `process.exit(failures === 0 ? 0 : 1)` · ALL ROWS PASSED — seedling_bot_ap_p4c, END 2026-09-05T18:2 |
| `verify-seedling-atlas-maze.mjs` | `check-seedling-atlas-maze.mjs` | GATE | node | 11.4s | `process.exit(failures === 0 ? 0 : 1)` · OK: 10 atlas sub-regions are playable maze worlds (20 exit |
| `verify-seedling-atlas-play.mjs` | `check-seedling-atlas-play.mjs` | GATE | browser | 43s | `process.exit(failures === 0 ? 0 : 1)` · OK: the real Seedling game walks between atlas regions, an |
| `verify-seedling-atlas-preset.mjs` | `check-seedling-atlas-preset.mjs` | GATE | browser | 5s | `process.exit(failures === 0 ? 0 : 1)` · OK: seedling_atlas preset loads with 11 regions and 23 exi |
| `verify-seedling-bot-differential.mjs` | `check-seedling-bot-differential.mjs` | GATE | windows | — | `process.exit(1 / failures === 0 ? 0 : 1)` · **no verdict line — one added here** |
| `verify-seedling-wasm-bridge.mjs` | `check-seedling-wasm-bridge.mjs` | GATE | browser | 45s | `process.exit(failures === 0 ? 0 : 1)` · ALL PASS |
| `verify-sphere-batch-stepping.mjs` | `check-sphere-batch-stepping.mjs` | GATE | browser | 63s | `process.exit(1)` · VERIFY SPHERE BATCH STEPPING: ALL OK |
| `verify-sphere-envelope-resume.mjs` | `check-sphere-envelope-resume.mjs` | GATE | browser | 24s | `process.exit(1)` · VERIFY SPHERE ENVELOPE RESUME: ALL OK |
| `verify-sphere-growth-ui.mjs` | `check-sphere-growth-ui.mjs` | GATE | browser | 22s | `process.exit(1)` · VERIFY SPHERE GROWTH UI: ALL OK |
| `verify-sphere-steps-ui.mjs` | `check-sphere-steps-ui.mjs` | GATE | browser | 103s | `process.exit(1)` · VERIFY SPHERE STEPS UI: ALL OK |
| `verify-spiral-steps-ui.mjs` | `check-spiral-steps-ui.mjs` | GATE | browser | 19s | `process.exit(1 / failures.length ? 1 : 0)` · ✅ ALL PASS |
| `verify-ta-mana-leg.mjs` | `check-ta-mana-leg.mjs` | GATE | browser | 9s | `process.exit(1)` · verify-ta-mana-leg: ALL PASS |
| `verify-topdown-steps-ui.mjs` | `check-topdown-steps-ui.mjs` | GATE | browser | 81s | `process.exit(1 / failures.length ? 1 : 0)` · ✅ ALL PASS |
| `verify-topdown-steps.mjs` | `check-topdown-steps.mjs` | GATE | node | 1.1s | `process.exit(allOk ? 0 : 1)` · ALL PASS — stepped runner == monolith |
| `verify-world-persistence-reload.mjs` | `check-world-persistence-reload.mjs` | GATE | browser | 82s | `throw`×2 (unhandled rejection ⇒ non-zero) · PASS — 23 checks |
| `dump-bounce-level.js` | *(unchanged)* | REPORT | node | 0.1s | non-zero exit is a usage/IO guard only (`process.exit(1)`); survey §(b) |
| `dump-bounce-region.js` | *(unchanged)* | REPORT | node | 0.2s | non-zero exit is a usage/IO guard only (`process.exit(1)`); survey §(b) |
| `dump-dj-traces.mjs` | *(unchanged)* | REPORT | node | 0.1s | non-zero exit is a usage/IO guard only (`process.exit(2)`); survey §(b) |
| `dump-grid-growth.js` | *(unchanged)* | REPORT | node | 0.5s | non-zero exit is a usage/IO guard only (`process.exit(1)`); survey §(b) |
| `dump-maze-byteidentity.mjs` | *(unchanged)* | REPORT | node | 2.3s | no non-zero exit at all; survey §(b) |
| `dump-runner-level.js` | *(unchanged)* | REPORT | node | 0.1s | no non-zero exit at all; survey §(b) |
| `dump-seedling-kind-pairs.mjs` | *(unchanged)* | REPORT | node | 118.9s | non-zero exit is a usage/IO guard only (`process.exit(2)`); survey §(b) |
| `dump-shuffled-spiral.js` | *(unchanged)* | REPORT | node | 0.5s | non-zero exit is a usage/IO guard only (`process.exit(1)`); survey §(b) |
| `dump-sphere-byteidentity.mjs` | *(unchanged)* | REPORT | node | 3.1s | no non-zero exit at all; survey §(b) |
| `dump-sphere-growth.js` | *(unchanged)* | REPORT | node | 0.4s | non-zero exit is a usage/IO guard only (`process.exit(1)`); survey §(b) |
| `dump-topdown-byteidentity.mjs` | *(unchanged)* | REPORT | node | 0.9s | no non-zero exit at all; survey §(b) |
| `verify-bot-playthrough.mjs` | *(deleted)* | STALE | browser | 250s | subject world deleted at `ccfc5bad0`; V2 §Task 1 |
| `verify-dj-real-embed.mjs` | *(deleted)* | STALE | browser | 101s | subject world deleted at `ccfc5bad0`; V2 §Task 1 |

## The STALE two — ⚖ RULED: deleted

**⚖ RULED (user, 2026-09-05): delete both.** `verify-dj-real-embed.mjs` drives
`bounce_dj_worldgen`; `verify-bot-playthrough.mjs` drives `bounce_sphere_worldgen` /
`bounce_mixed_worldgen`. All three worlds were deleted at `ccfc5bad0` (2026-06-26), so neither
script can pass at any SHA — V2 §Task 1 measured both failing identically on the pre-arc tree. A
script whose subject no longer exists has no name in the new scheme, and history keeps both
recoverable by SHA. The alternative on the record — keeping them under a `stale-` prefix — was
declined: it would create a third prefix with two members that no mechanism reads, still inside
`check-procgen-help`'s population and still in the docs catalogue.

## One instrument change, and it is the one the survey named

`verify-bounce-embed.mjs` is the survey's one misfiled row: it CAN fail (four `throw`s plus a
`waitFor` that throws on timeout — measured exit 1 under contention, 0 solo) but **prints no verdict
at all**, so a green run is indistinguishable from a truncated one. V2 and V3a never touched it,
because it was not red. The survey's own conclusion — *"The fix is one `console.log`, not a
redesign"* — is applied here, and then it is renamed with the rest of the GATE class.

⛑ **What that line does NOT claim.** The script ends by printing `ERRORS (n)` from the page's
console and exits 0 regardless of `n`. Turning that count into a failing assertion would be a NEW
claim, not a rename, and it is out of this slice — so the added line names what the run actually
asserted (the phases and revisits that would have thrown), and the error count stays diagnostic.
⚖ **A candidate for a later slice**, named rather than silently left.

---

# V3b as built — the tier is renamed, and the CI plan did not move (2026-09-05)

Four commits on `main`, each staged by path:

| commit | what |
|---|---|
| `5f39eb83f9` | Task 0 — the derived rename table, **before any file moves** |
| `df404e911b` | the GATE batch: 49 `git mv` + the 2 deletions + the `@ci-box` mechanism |
| `486670cc13` | every reader of a renamed script, and two FALSE claims retired |
| `af54c20d46` | the help baseline, re-recorded at the renamed head (627.0 s) |

## What moved

| class | count | outcome |
|---|---|---|
| GATE | **49** | `git mv` → `check-<name>.mjs` (27 browser · 20 node · 2 windows) |
| REPORT | **11** | unchanged — every one was already `dump-` |
| STALE | **2** | deleted (`verify-dj-real-embed.mjs`, `verify-bot-playthrough.mjs`) |

Every move is a `git mv`, so `git log --follow` reaches the pre-rename history of each file.

## The roster, and the shard plan that did NOT move

```
BEFORE (580b178cd3)  33 gate(s) + 1 declared arm(s); 23 browser, 4 windows. local 34, live 4
AFTER  (486670cc13)  82 gate(s) + 1 declared arm(s); 52 browser, 6 windows. local 83, live 4
```

| `ci-gates --plan` | BEFORE | the NAKED rename (measured in a mirror) | **AFTER, with `@ci-box`** |
|---|---|---|---|
| `--set=browser` | 25 arms / **3 shards** | 52 arms / **30 shards** | **25 arms / 3 shards** |
| `--set=headless` | 31 arms / **1 shard** | 51 arms / **21 shards** | **31 arms / 1 shard** |
| procgen gate jobs per push | **4** | **51** | **4** |

⛓ **BEFORE == AFTER is the check, and no roster-count assertion could have made it.** 47 of the 49
newly adopted gates declare `@ci-box` (the other two are the Windows pair, which `ciRunnable`'s
first clause already excluded and which therefore declare nothing). ⚖ Deciding which of the 49 CI
should adopt is a slice of its own; each is one line to delete, in the gate that knows.

## The mechanism, in four files

- `gateRoster.js` — `CI_BOX_LINE_RE` + `ciBoxIn()`, refusing by name an empty reason, a second
  declaration, and the PAIR `@ci-box` + (`@ci-face` | `@ci-argv`) — a box-only gate has no CI run
  for a face to re-key or for argv to point at.
- `ciGatePlan.js` — `ciRunnable = !gate.windows && !gate.ciBox`. ⛓ The two clauses are different in
  kind and the docblock says so: `windows` is READ OFF THE FILE (it holds `/mnt/c/Windows/py.exe`),
  `ciBox` is a JUDGEMENT somebody wrote down. The first cannot be wrong; the second is one line to
  delete when it stops being true.
- `ci-gates.mjs` — the `## CI-SKIPPED |` line prints the gate's OWN reason instead of the Windows
  sentence, because "cannot be answered here" and "somebody decided the box answers this" are two
  different things to tell a reader.
- `ci-summary.mjs` — a second refusal rung with its own sentence, above the Windows one.

Tests: `gateRoster.test.js` gains the parser describe (reason as free text · null when absent ·
a prose mention is not a declaration · empty refused by name · two refused by name · the live roster
carries them, non-vacuously) and the two-way pair refusal; `ciGatePlan.test.js`'s `ciRunnable`
describe now asserts the refused set is **exactly `windows ∪ @ci-box`** as a SET over files with
each half proved non-empty first, plus a new row that a gate declaring NEITHER is still accepted —
without which a `ciRunnable` that returned `false` for everything would pass every other row.

## The reader sweep

**187 tracked files** rewritten longest-name-first (so `…-sphere-roundtrip` never ate
`…-sphere-roundtrip-maze`), plus **five** a whole-name sweep structurally cannot see:

| site | why the sweep missed it |
|---|---|
| `frontend/modules/flashPanel/index.js` | basename wrapped across a `//` comment break |
| `frontend/modules/flashPanel/README.md` | a `{wasm-bridge,atlas-play}` brace spelling |
| `probe-seedling-r9-dash-rect-mobiles.mjs` | basename wrapped inside a docblock |
| `check-maze-loop-mana.mjs` · `check-omsi-mana-leg.mjs` | eventBus SUBSCRIBER IDs, not paths |

⛔ **`CC/docs/procgen-verify-tier.md` is deliberately NOT rewritten.** It is the survey; its subject
is the `verify-*` tier as it was, and rewriting `verify-` out of *"the 50 `verify-*` scripts are not
fifty oversights, they are one naming rule"* would make the record nonsense. The map lives in
§"V3b — the rename" above, two screens down from every old name in it.

## Two FALSE claims the survey found, retired with the rename

- `vitest.slow.config.js:60-66` and `docs/json/developer/procgen/runner.md:103` both said the
  `verify-runner-*.mjs` Playwright instruments *"still run"*. **Nothing ran them** — all four were in
  no battery of any kind. They PASS, so the sentence was wrong about the MECHANISM, not the state.
  Both sites now quote what they said and say what was measured.
- `frontend/modules/procgenPipeline/braidSphereBot.slow.test.js` called itself *"the headless
  analogue of `scripts/procgen/verify-bot-playthrough.mjs`"*. That script is deleted, so this file is
  now the ONLY driver of the claim — and the docblock says that instead of sending a reader after a
  sibling that is not there.

## Generated artifacts, each delta derived per file

| artifact | before | after | why |
|---|---|---|---|
| `procgenDocs/generated/instruments.js` | 267 files | **265** | the two deletions; 0 FINDING(S), `--check` exits 0 |
| `check-procgen-help.baseline.json` — instruments | 262 | **265** | the gate's population is every `*.mjs` |
| — importDoorEffectful | 252 | **250** | the two deletions |
| — wroteIntoTheRepo | 13 | **19** | ⚠ a CEILING artifact, below |

⛔ **The `wroteIntoTheRepo` jump is a measurement artifact, not new behaviour, and it is named here
rather than left to be found.** The gate kills a baselined file's import door at that file's own
recorded ceiling; a file the baseline does not name yet has none. So the six roundtrip gates
(`atlas-sphere`, `jta-locations`, `region-library` ×4) ran to completion under their NEW names for
the first time and their real write sets were recorded — `check-atlas-sphere-roundtrip` alone writes
**411** paths (Python `__pycache__`, a generated world, `host.yaml.tmp`). They always did that; the
old record was truncated by its own ceiling. ⛑ Every byte of it landed in the gate's throwaway
worktree: `git status` after the write run was the baseline file and nothing else. ⛓ Every key delta
in that file is accounted for by the rename, derived rather than eyeballed — canonicalising
`verify-` → `check-` over the old keys leaves **zero** entries appearing or disappearing for any
other reason.

## Standing values — 49 candidates NAMED, none added

`standingRows()` derives **114** rows now (was 65 + the composite); `standing-values.json` banks
**66**. ⇒ **49 derived rows have no banked value**, one per newly adopted gate, and per the brief
none was added here. They are the same 49 the `@ci-box` question is about: a row earns a value when
somebody decides the gate is worth standing behind, and that decision and the CI one are the same
decision.

## ⚠ A roster fidelity finding the rename exposed — the flag is read in a spelling the roster does not know

`gateRoster.readsFlag` matches this directory's ONE spelling, `arg('host', …)`. Measured over the 49:

| | count |
|---|---|
| declare `host` the way the roster reads it | **5** |
| read `--host=` by hand (`process.argv.find(a => a.startsWith('--host='))`) — roster shows `[-]` | **20** |
| take no host at all | **24** |

⛑ **Consequence today: nil**, and that is exactly why it is written down. All 20 default to
`http://localhost:8000`, which is the right server on this box, and `@ci-box` keeps every one of them
off the runner. It becomes load-bearing the moment one is adopted: `argvFor` would hand it no
`--host=`, and it would drive a server the runner does not have while reporting a clean pass or a
timeout that names the wrong thing. ⚖ **A candidate for the adoption slice** — teaching those 20 the
`arg('host')` spelling is part of the price of adopting them, not a separate cleanup.

## Measured and NOT changed

- **`seedling-wasm.yml`'s `paths:` filter still does not list the bridge gate.** Editing
  `check-seedling-wasm-bridge.mjs` STILL does not trigger its own workflow — the survey's finding,
  unmoved by the rename, because only the `check-seedling-wasm-pins.mjs` line was ever in the filter.
  The rename moved one line in that workflow (the `node …bridge.mjs` invocation at `:231`), which is
  `continue-on-error` and gates nothing.
- **`package.json` names no procgen script at all** — so the brief's "package.json scripts" leg is
  empty, measured rather than assumed.
- **The `seedling-wasm` submodule still names four old scripts** —
  `frontend/modules/flashPanel/wasm/README.md` (4) and `builds.json` (5). Editing them is a submodule
  commit plus a gitlink bump, which is an ask-first step and out of this slice; the submodule is
  clean and untouched. ⚖ Named for whoever next bumps that pointer.
- **`check-seedling-bot-differential.mjs` was NOT run.** Its full drive is a measured 142-minute GPU
  run; it joins the roster as a `--win` row, `ciRunnable` excludes it on the Windows clause, and it
  remains the one script of the original 62 with no verdict from this arc.

## Gates

| gate | verdict |
|---|---|
| `node scripts/procgen/gates.mjs --list` | **82 gate(s) + 1 declared arm; 52 browser, 6 windows** — all 49 adopted scripts appear |
| `ci-gates.mjs --plan --set=browser` | **25 arms / 3 shards** — identical to the pre-rename partition |
| `ci-gates.mjs --plan --set=headless` | **31 arms / 1 shard** — identical |
| `check-procgen-help.mjs --doors=all` | **ALL PASS** — 265 instruments, 250 on the import-door baseline, **618.9 s** |
| `check-procgen-reference.mjs --check` | **ALL 6 GENERATED MODULES AND 4 MARKDOWN REGIONS MATCH THE CODE** |
| `check-procgen-docs.mjs --host=…:8000` | **ALL CHECKS PASSED** |
| `check-slice-records.mjs` | **ALL PASS — 73 VERIFIED, 37 UNVERIFIABLE (not claimed green), 2 NOTE(S)** |
| bounded vitest — `scripts/procgen/` + `procgenDocs/` | **37 files / 1049 tests / 0 failed** (see the flake note) |
| in-app `test-substrates --batch=fast` | **83/83 passed**, `[PROGRESS 83/83]` |
| `compare-runs.js` | **83/83 → 83/83, no new failures, no roster change**, exit 0 |
| `check-seedling-bot-differential.mjs --win` | **NOT RUN** — a measured 142-minute GPU drive, named rather than silently absent |

### ⛑ The one red, and it is a contention flake — measured, not asserted

The 37-file bounded vitest failed twice and passed three times over **five** samples, always the same
way: `frontend/modules/procgenDocs/generated.test.js` → *"Hook timed out in 10000ms"* at `:557`, a
`beforeAll` that imports the eight substrate libraries in `REGISTRY_LIBRARIES`. Three controls, in
increasing strength:

1. **That file alone: 3 runs, 3 green** (7 files / 452 tests each), and inside the full batch it
   takes 17.4 s of wall for 49 tests — the hook is the slow part, not a test.
2. **None of the eight libraries moved in this slice** — `git diff --stat 580b178cd3..HEAD` over all
   eight is empty.
3. **The only V3b edit to the failing FILE is one word inside a comment** (`verify-runner-smoke.mjs`
   → `check-runner-smoke.mjs` in a docblock sentence).

⇒ this is the parallelism flake `vitest.slow.config.js`'s own docblock describes (synchronous
CPU-bound imports under the default run's file parallelism), reached through a `beforeAll` hook
rather than a test body. ⛔ It is NOT a `--batch` or roster question and it is not this rename's;
recorded here so the next reader does not re-derive it from one red sample.

## ⚖ FOR THE USER — what V3b leaves on the record

1. **Which of the 49 does CI adopt?** Each carries a `@ci-box` line with a measured reason (an
   uncommitted fixture · this tree's Python venv · a hardcoded `localhost:8000` · never priced on a
   runner). Adoption is deleting that line — and paying for it: an unpriced arm takes a whole 600 s
   shard until a finished run re-prices it, and the 20 hand-read `--host=` gates above need the
   `arg('host')` spelling first.
2. **Should `check-bounce-embed.mjs`'s `ERRORS (n)` count FAIL the run?** It prints the page's
   console errors and exits 0 whatever `n` is. V3b gave it the PASS line the survey named and
   deliberately did NOT turn that count into an assertion — that is a new claim, not a rename.
3. **The `seedling-wasm` submodule names four old scripts** (`README.md` ×4, `builds.json` ×5).
   A submodule commit plus a gitlink bump — ask-first, and out of this slice.
4. **33 memory files under `~/.claude/projects/…/memory/` name a renamed script.** Only this arc's
   own project note was touched; the rest are the planner's, listed in the report back.
