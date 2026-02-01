# GitHub Actions Workflows

This document describes the GitHub Actions workflows used for testing and CI/CD in this repository.

## Quick Reference

| Workflow | Trigger | Purpose | Results Branch |
|----------|---------|---------|----------------|
| [Test Templates](#test-templates) | Push/PR/Manual | Quick or full template testing | `test-results-update` |
| [Test Spoilers Split](#test-spoilers-split) | Manual | Parallel seed/template tests | `test-results-update` |
| [Test Individual](#test-individual) | Manual | Single test type for all templates | `test-results-update` |
| [Test All Sequential](#test-all-sequential) | Manual | Comprehensive sequential testing | `test-results-update` |
| [Test Spoiler Fuzz](#test-spoiler-fuzz) | Manual | Fuzz testing for spoiler generation | `spoiler-fuzz-test` |
| [Test UT Fuzz](#test-ut-fuzz) | Manual | Universal Tracker fuzz testing | `ut-fuzz-test` |
| [Test Multiworld UT Fuzz](#test-multiworld-ut-fuzz) | Manual | Multiworld assembly UT testing | `multiworld-ut-fuzz-test` |
| [Test World Generator](#test-world-generator) | Manual | World generator consistency testing | `test-results-update` |

## Running Workflows Manually

All test workflows can be triggered manually from the GitHub Actions tab:

1. Go to **Actions** tab in the repository
2. Select the workflow from the left sidebar
3. Click **Run workflow** button
4. Configure inputs if needed
5. Click **Run workflow** to start

---

## Test Workflows

### Test Templates

**File:** `test-templates.yml`

**Triggers:** Push to main, Pull requests, Manual

**Purpose:** Primary CI workflow for testing template changes.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `test_suite` | choice | `quick` | `quick` (ALTTP only) or `full` (all tests) |

**Quick Mode:** Tests ALTTP template with regression tests
**Full Mode:** Runs 4 parallel test configurations:
- Minimal spoilers
- Full spoilers
- Multiclient
- Multiworld

---

### Test Spoilers Split

**File:** `test-spoilers-split.yml`

**Triggers:** Manual only

**Purpose:** Run parallelized seed or template tests.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `test_type` | choice | `seeds-minimal` | Test configuration to run |

**Test Types:**
- `seeds-minimal` - Seeds 1-10 with minimal spoilers
- `seeds-full` - Seeds 1-10 with full spoilers
- `templates-minimal` - All templates, minimal spoilers
- `templates-full` - All templates, full spoilers
- `multiclient` - Multiclient tests
- `multiworld` - Multiworld tests

---

### Test Individual

**File:** `test-individual.yml`

**Triggers:** Manual only

**Purpose:** Run a single test type across all templates.

**Inputs:**
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `test_type` | choice | `minimal-spoiler` | Which test to run |

**Test Types:**
- `minimal-spoiler` / `full-spoiler` - Spoiler tests
- `minimal-spoiler-retest` / `full-spoiler-retest` - Retest failures
- `multiclient` / `multiworld` - Network tests

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

Test workflows commit results to specific branches:

| Branch | Workflows | Content |
|--------|-----------|---------|
| `test-results-update` | Most test workflows | Test result JSON and charts |
| `spoiler-fuzz-test` | Spoiler fuzzer | Spoiler fuzz results |
| `ut-fuzz-test` | UT fuzzer | UT fuzz results |
| `multiworld-ut-fuzz-test` | Multiworld UT | Multiworld UT fuzz results |

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
