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
- Regression tests

---

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
| Unit Tests | `unit-tests.yml` | Python/JS unit tests |
| CodeQL Analysis | `codeql-analysis.yml` | Security analysis |
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
