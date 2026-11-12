# GitHub Actions Workflows

This document describes the GitHub Actions workflows used for testing and CI/CD in this repository.

## Quick Reference

| Workflow | Trigger | Purpose | Results Branch |
|----------|---------|---------|----------------|
| [Test ALTTP Spoiler](#test-alttp-spoiler) | Push/PR/Manual | ALTTP spoiler and regression tests | N/A |
| [Test All Sequential](#test-all-sequential) | Manual | Comprehensive sequential testing | `test-results-original` / `test-results-worldgen` / `test-results-apworld` |
| [Test Spoiler Fuzz](#test-spoiler-fuzz) | Manual | Fuzz testing for spoiler generation | `test-results-spoiler-fuzz` / `test-results-spoiler-fuzz-apworlds` |
| [Test UT Fuzz](#test-ut-fuzz) | Manual | Universal Tracker fuzz testing | `test-results-ut-fuzz-{mode}` / `test-results-ut-fuzz-apworlds-{mode}` |
| [Test Multiworld UT Fuzz](#test-multiworld-ut-fuzz) | Manual | Multiworld assembly UT testing | `test-results-multiworld-ut-fuzz` |
| [Test World Generator](#test-world-generator) | Manual | World generator consistency testing | `test-results-world-generator` / `test-results-world-generator-canonical` / `test-results-world-generator-random` |
| [Cloudberry end-to-end](#cloudberry-end-to-end) | Push (Cloudberry paths only)/Manual | The Cloudberry substrate's generation and play gates against the live Cloudberry site | N/A |

## Push-run policy (the two heavy push workflows)

`unittests.yml` (the upstream Python matrix, Windows and macOS legs included) and `unittests_frontend.yml`
(vitest, the headless gates, the browser shards) run on pushes to every branch. Two fork rules limit that
(2026-10-10, after CI queued behind the account's ~40-concurrent-job cap):

- **A newer push to the same branch cancels the older run** of either workflow (`concurrency`). This applies
  only to pushes to refs other than `main`: `main`, pull requests and `workflow_dispatch` runs never cancel or
  queue. So an intermediate head of a branch can end `cancelled` — read CI at the branch's last head.
- **`unittests.yml` skips its matrix on a branch push whose changes pytest never reads** (frontend JS, non-Python
  `scripts/procgen/`, `test_json/`, prose). Its first job, *Python tests needed?*, decides with
  `scripts/test/python-tests-needed.py` (pinned by `test/test_python_tests_needed.py`). `main` and pull requests
  always run the matrix, and so does any push whose changed-file list cannot be read.

## Checks moved off push (2026-10-21, the user's ruling; each keeps a manual or scheduled home)

| Check | Was | Now | Run it |
|---|---|---|---|
| CodeQL (`codeql-analysis.yml`) | push to `main` + PRs + weekly | weekly cron (Mon 08:44 UTC) + dispatch | `gh workflow run codeql-analysis.yml -R PeerInfinity/Archipelago-CC` |
| Python Windows 3.11 / Windows 3.13 / macOS 3.13 legs (`unittests.yml`) | every matrix run | pull requests + a `full_matrix` dispatch; pushes run the Linux legs and hosting | `gh workflow run unittests.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f full_matrix=true` |
| `gate: seedling-wasm-ship` (JSUT browser shard) | every push | its own shard, in the matrix only when a pushed path hits its filter (`@ci-paths` in the gate + `scripts/procgen/ciPathFilter.js`'s derived inputs), and on every dispatch | `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref <branch>` |
| test-substrates `apworld` batch (`test-templates.yml`) | every main push | only when a pushed path hits its `pushPaths` or the derived import closure of its rows (`list-test-batches.js --on-push --changed=`) | `gh workflow run test-substrates-manual.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f batch=apworld` |
| `identity: empty pairs c3/c6`, `carved pairs c4`; the `solve-seedling-*` chain `--check`s | headless/browser arms | the box (their instruments declare `@ci-box`) | `node scripts/procgen/standing-values.mjs --write --key='<row key>'` |
| 89 `producer: plan-seedling-* --check` arms, `identity: generated set` | headless/browser arms | deleted as duplicates: the gating `Producer --checks` job and `gate: seedling-generated-set` run the same commands | — |

## Checks moved off the slice push (2026-11-02, Robert's ruling, CI manual-only P1–P6)

A **slice push** is a push to any branch other than `main` and `js-land/**` (the landing train). Each check below
still runs at the train, so `main` never takes a head it has not passed.

| Check | Was | Now | Run it on a slice |
|---|---|---|---|
| P1/P2/P3/P5: the train Vitest tier (`*.train.test.js`, `vitest.train.config.js`): the Seedling hammer/fidelity behaviour pins, `seedlingGenCapacity`, the maze certifier's scripted sample, `hammerGhostKillRung`, `hammerChooserPair` | slow tier or default tier, every push | the `Train-tier Vitest (shard k/3)` jobs (serial inside; split longest-first by `scripts/test/trainShardPlan.js` off `scripts/test/train-shard-costs.json`): js-land/** pushes, a main push whose SHA has no earlier run that passed every shard, and a `train` or `train_only` dispatch. `hammerEscapeGenerated.slow` stays on push as the solver smoke row; `hammerEscapeExact`, `hammerBk2Combat` and `fidelityCorpseBump2` moved here from the slow tier on 2026-11-08 | Train shards only: `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f train_only=true`. With the default tier, slow tier and gates too: `... -f train=true` |
| P4: `gate: seedling-wasm-ship` | any push that hit its `@ci-paths` or derived import closure | on a slice push, only its declared globs (`flashPanel/**`, the recompiler page, `vendor/seedling`) and its own file (`@ci-paths-slice declared`); always on main, js-land/**, PRs and every dispatch | `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref <branch>` |
| P6: Python ubuntu 3.12 / 3.13 legs (`unittests.yml`) | every matrix run | main, js-land/**, PRs and every dispatch; a slice push runs 3.11.2 + hosting | `gh workflow run unittests.yml -R PeerInfinity/Archipelago-CC --ref <branch>` |

A `train_only` run concludes `success` with its suite and gate jobs skipped. The main-push guard (`Same SHA already green?`, `ciSummary.decideAlreadyGreen`) counts only a run whose suite jobs ran and passed, so a train-only success never lets a main push skip the suite or the gates; its train shards do count toward `train_green`, once a run with a passed suite exists at that SHA.

## Running Workflows Manually

All test workflows can be triggered manually from the GitHub Actions tab:

1. Go to **Actions** tab in the repository
2. Select the workflow from the left sidebar
3. Click **Run workflow** button
4. Configure inputs if needed
5. Click **Run workflow** to start

---

## Test Workflows

### Test ALTTP Spoiler

**File:** `test-templates.yml`

**Triggers:** Push to main, Pull requests, Manual

**Purpose:** CI workflow for testing ALTTP template changes. Runs on every PR/push that modifies templates or test scripts.

**Tests:**
- ALTTP template generation and spoiler test
- Regression tests (the ES-module boot, then the bundled boot)
- Substrate tests: one parallel matrix job per ON-PUSH batch of `frontend/modules/tests/testBatches.js` (every batch not marked `manual: true`, listed by `scripts/test/list-test-batches.js --on-push`; a batch with `pushPaths` — `apworld` — only when a pushed path hits its filter), each followed by its budget-headroom check (`scripts/test/check-batch-headroom.js`)

---

### Substrate tests — manual batches

**File:** `test-substrates-manual.yml` (was `test-substrates-bot-walks.yml`)

**Triggers:** Manual (`workflow_dispatch`; the user ruled the bot walks manual-only on 2026-09-27, and the noiz2sa and runner rows on 2026-10-09), plus `workflow_call` from the nightly below. Never push or pull_request.

**Purpose:** The MANUAL batches of `npm test -- --mode=test-substrates` (`manual: true` in `frontend/modules/tests/testBatches.js`), which `test-templates.yml` never runs. The `batch` input names one manual batch or a path-filtered on-push batch (`apworld`), or `all` (the default) runs every manual batch as parallel jobs; any other on-push batch name is refused. One smoke row per manual substrate still runs on push (its config `batch` field).

### Substrate tests — nightly manual batches

**File:** `test-substrates-nightly.yml`

**Triggers:** `schedule` `37 10 * * *` (10:37 UTC = 02:37 PST; 03:37 Pacific during PDT, still inside the after-hours window, so the cron is not shifted for DST), and `workflow_dispatch` (at the ref dispatched on; only a run at `main` is the nightly).

**Purpose:** ⚖ Robert 2026-11-11 (option C). One run a night of every manual batch at `main`, as a drift signal. It calls `test-substrates-manual.yml` with `batch=all` (`workflow_call`), so the batch list, setup and per-batch headroom check are that file's. Its own `Nightly summary` job writes the job summary (per batch: PASSED/total, failing rows, NEVER STARTED / CUT OFF, the headroom verdict, the job's conclusion) and uploads `nightly-manual-summary.json` (artifact `nightly-manual-summary`, 30 days: `{runId, sha, ref, red, redBatches, batches: {<batch>: {result, passed, total, failing, neverStarted, cutOff, headroom, job}}}`, written by `scripts/test/nightly-manual-summary.js`). The run is red when any batch is red. Its own concurrency group means a second nightly waits behind the first.

**⛔ A SIGNAL, NEVER EVIDENCE.** A nightly result at `main` is never landing evidence for any SHA, `main`'s next head included. A red is a note to the owner of the batch (via js-17 or the planner that reads it in the morning). Nothing is posted outside CI.

**Morning pickup** (the newest scheduled run, its verdict, then its JSON):

```bash
id=$(gh run list -R PeerInfinity/Archipelago-CC -w test-substrates-nightly.yml -b main -e schedule -L 1 --json databaseId -q '.[0].databaseId'); d=$(mktemp -d); gh run download "$id" -R PeerInfinity/Archipelago-CC -n nightly-manual-summary -D "$d" && jq '{runId, sha, red, redBatches, batches: (.batches | map_values({result, passed, total, failing}))}' "$d/nightly-manual-summary.json"
```

### After-hours bulk runs (B1, convention; ⚖ Robert 2026-11-11)

Bulk harvests and exploratory sweeps (divergence-sweep harvests, multi-arm A/B sweeps, survey batches, wasm-probe fan-outs) are dispatched **22:00–07:00 Pacific**, so they do not hold the runners that push gates wait on during the day. **Exempt, run now:** (1) anything a landing train dispatches; (2) gate runs at a slice tip (`train_only`, `full_matrix`, TT); (3) a re-measure that a queued packet is waiting on. It is a convention, with no enforcement. The nightly above is in the window too, and is a signal, never evidence.

---

### Cloudberry end-to-end

**File:** `cloudberry-e2e.yml`

Runs on a push that changes a Cloudberry file (the `cloudberryDemo` module, the flash bridge, the demo pack, the
committed `cloudberry_sphere_worldgen`, `cloudberry_maze_mix_worldgen`, `cloudberry_double_jump_worldgen` and `cloudberry_hero_physics_worldgen` worlds and presets, `scripts/procgen/*cloudberry*`, the site fetcher, the
in-app rows and tutorial, this workflow), and by hand: `gh workflow run cloudberry-e2e.yml -R PeerInfinity/Archipelago-CC --ref <branch>`.

It downloads the LIVE Cloudberry site into the gitignored `frontend/external/cloudberry/`
(`scripts/setup/fetch-cloudberry-site.mjs`; nothing of Cloudberry is committed here), starts a dev server, and runs
`check-cloudberry-sphere.mjs` (a sphere world generated by the game's own generator, a mixed world, `Generate.py`,
played to Victory), its `--check` against the committed presets, the same with `--double-jump` (a Double-hero level behind
the Double Jump gate, played to Victory; it needs a live page with `features.doubleJump`), the same with `--physics` (P5b: that
world with the hero's physics as world settings and per-region variation, played to Victory), `check-cloudberry-embed.mjs` (the demo pack in a
spiral world, played; a sphere world from it, played to Victory by the Playback Bot), and the manual in-app batch
`cloudberry` (`npm test -- --mode=test-substrates --batch=cloudberry`: the substrate's rows and its tutorial walks)
with its budget headroom. `test-substrates-manual.yml` also takes `-f batch=cloudberry` (it fetches the site for
that batch). ⚠ The live site moves when the Cloudberry repo deploys, so a red right after a Cloudberry deploy can be the
generator having changed rather than this repository.

### Test All Sequential

**File:** `test-all-sequential.yml`

**Triggers:** Manual only

**Purpose:** Comprehensive testing with extensive configuration options.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `spoiler_mode` | choice | `10-seeds` | `single-seed` or `10-seeds` |
| `start_seed` | number | `1` | Starting seed number |
| `delete_existing_results` | boolean | `true` | Clean results before testing |
| `test_generation_consistency` | boolean | `true` | Verify deterministic generation |
| `retest_failures` | choice | `2-times` | Retry count for failures |
| `spoiler_tests` | choice | `both` | `skip`, `minimal-only`, `full-only`, `both` |
| `enable_multiclient` | boolean | `true` | Run multiclient tests |
| `enable_multiworld` | boolean | `true` | Run multiworld tests |
| `multiworld_parallelization` | choice | `parallel-10-jobs` | Parallelization strategy |
| `template_type` | choice | `original` | `original`, `worldgen`, or `apworld` |

---

## Fuzz Testing Workflows

### Test Spoiler Fuzz

**File:** `test-spoiler-fuzz.yml`

**Triggers:** Manual only

**Purpose:** Fuzz testing for spoiler log generation across all games.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `runs_per_game` | number | `10` | Fuzz iterations per game |
| `generation_timeout` | number | `300` | Seed generation timeout (seconds) |
| `test_timeout` | number | `120` | Spoiler test timeout (seconds) |
| `seed` | number | `1` | Random seed for reproducibility |
| `delete_existing_results` | boolean | `true` | Clean results before testing |
| `debug_mode` | boolean | `false` | Test only Adventure/Clique |
| `test_apworlds` | boolean | `false` | Test APWorlds instead of bundled |
| `spoiler_mode` | choice | `minimal-spoilers` | Spoiler detail level |

---

### Test UT Fuzz

**File:** `test-ut-fuzz.yml`

**Triggers:** Manual only

**Purpose:** Fuzz testing for Universal Tracker integration.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `runs_per_game` | number | `10` | Fuzz iterations per game |
| `jobs` | number | `4` | Parallel jobs per runner |
| `timeout` | number | `60` | Generation timeout (seconds) |
| `seed` | number | `1` | Random seed |
| `delete_existing_results` | boolean | `true` | Clean results |
| `debug_mode` | boolean | `false` | Debug mode (Adventure only) |
| `test_original_ut` | boolean | `false` | Test original UT version |
| `prefer_native_ut` | boolean | `false` | Prefer native UT support |
| `test_apworlds` | boolean | `false` | Test APWorlds |

---

### Test Multiworld UT Fuzz

**File:** `test-multiworld-ut-fuzz.yml`

**Triggers:** Manual only

**Purpose:** Test Universal Tracker with multiworld assembly.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `runs_per_test` | number | `3` | Runs per game addition |
| `seed` | number | `1` | Base random seed |
| `max_players` | number | `10` | Maximum players |
| `clean_start` | boolean | `true` | Clean before starting |
| `debug_mode` | boolean | `false` | Debug mode |

---

### Test World Generator

**File:** `test-world-generator.yml`

**Triggers:** Manual only

**Purpose:** Test world generator consistency.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `seed` | number | `1` | Seed for testing |
| `test_mode` | choice | `both` | `canonical`, `random`, or `both` |
| `delete_existing_results` | boolean | `true` | Clean results |
| `debug_mode` | boolean | `false` | Debug mode (Adventure only) |

---

## Other Workflows

### Build & Deploy

| Workflow | File | Purpose |
|----------|------|---------|
| Build | `build.yml` | Build validation |
| Deploy GH Pages | `deploy-gh-pages.yml` | Deploy to GitHub Pages |
| Generate Presets | `generate-presets.yml` | Generate preset files |
| Docker | `docker.yml` | Docker image builds |
| Release | `release.yml` | Release automation |

### Code Quality

| Workflow | File | Purpose |
|----------|------|---------|
| JavaScript Unit Tests | `unittests_frontend.yml` | Parallel jobs: `JavaScript Unit Tests (Vitest shard k/N)` + `JavaScript Unit Tests (slow Vitest)` (`test:unit` + `test:unit:slow` — `ciSummary.js` finds the suite rows by those names), `Train-tier Vitest (shard k/3)` (`scripts/test/run-train-shard.mjs`; js-land/** train pushes, main and `-f train=true` / `-f train_only=true` dispatch only — ⚖ Robert 2026-11-02, 2026-11-08; the name stays outside the suite's), `Headless procgen gates` (`ci-gates.mjs`), and the browser gate shard matrix |
| CodeQL Analysis | `codeql-analysis.yml` | Security analysis (weekly + dispatch; no push trigger since 2026-10-21) |
| Strict Type Check | `strict-type-check.yml` | TypeScript type checking |
| Scan Build | `scan-build.yml` | Static analysis |

### Utilities

| Workflow | File | Purpose |
|----------|------|---------|
| Analyze Modified Files | `analyze-modified-files.yml` | Change analysis |
| Label Pull Requests | `label-pull-requests.yml` | Auto-labeling |
| CTest | `ctest.yml` | C++ testing |

---

## Result Branches

Each workflow mode saves results to a dedicated branch to prevent concurrent runs from overwriting each other:

| Branch | Workflow | Content |
|--------|----------|---------|
| `test-results-original` | Test All Sequential (original) | Spoiler/multiclient/multiworld results |
| `test-results-worldgen` | Test All Sequential (worldgen) | Spoiler/multiclient/multiworld results (worldgen) |
| `test-results-apworld` | Test All Sequential (apworld) | Spoiler/multiclient/multiworld results (apworld) |
| `test-results-spoiler-fuzz` | Test Spoiler Fuzz (bundled) | Spoiler fuzz results |
| `test-results-spoiler-fuzz-apworlds` | Test Spoiler Fuzz (apworlds) | Spoiler fuzz results (apworld) |
| `test-results-ut-fuzz-{mode}` | Test UT Fuzz (bundled) | UT fuzz results (mode = original, original-seeded, worldgen, pickle, hybrid) |
| `test-results-ut-fuzz-apworlds-{mode}` | Test UT Fuzz (apworlds) | UT fuzz results (apworld) |
| `test-results-multiworld-ut-fuzz` | Test Multiworld UT Fuzz | Multiworld UT fuzz results |
| `test-results-world-generator` | Test World Generator (both) | World generator results |
| `test-results-world-generator-canonical` | Test World Generator (canonical) | Canonical world generator results |
| `test-results-world-generator-random` | Test World Generator (random) | Random world generator results |

---

## Common Patterns

### Parallelization
Most test workflows split work across 10 parallel runners for faster execution.

### Caching
Workflows cache:
- Python virtual environments
- Node.js dependencies
- Playwright browsers

### APWorld Support
Several workflows support testing with APWorlds via the `test_apworlds` input.

### Debug Mode
Most workflows have a `debug_mode` option that tests only Adventure.yaml for quick iteration.
