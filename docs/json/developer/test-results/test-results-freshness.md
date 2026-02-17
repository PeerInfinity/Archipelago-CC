# Test Results Freshness Report

This report shows when each test result document was generated, how fresh the underlying data is, and how to regenerate each document.

**Report Generated:** 2026-02-14 02:28:14 UTC

## Summary

- **Total Documents:** 42
- **With Date Info:** 39
- 🟢 **Fresh (0-1 days):** 10
- 🟡 **Recent (2-7 days):** 2
- 🟠 **Aging (8-30 days):** 25
- 🔴 **Stale (>30 days):** 2

## Documentation Sync Status

Status of documentation coverage across the codebase:

| Check | Coverage | Status | Command |
|-------|----------|--------|--------|
| Rule Types Documentation | 100.0% (138/138) | ✅ Complete | `python scripts/docs/sync-rule-docs.py` |
| Rule Types Test Coverage | 100.0% (119/119) | ✅ Complete | `python scripts/docs/sync-rule-tests.py` |
| Script Documentation | 96.4% (80/83) | 🟡 3 gaps | `python scripts/docs/sync-script-docs.py` |
| Document Reachability | 102.3% (220/215) | 🟡 1 orphans | `python scripts/docs/find_orphaned_docs.py` |

## Workflow Overview

Overview of GitHub Actions workflows, their modes, the test result files they produce, and the documents generated from those results.

### [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml)

Runs spoiler, multiclient, and multiworld tests across all game templates.

**Workflow file:** `.github/workflows/test-all-sequential.yml`

**Key inputs:**

| Input | Options |
|-------|---------|
| `template_type` | original, worldgen, apworld |
| `spoiler_mode` | single-seed, 10-seeds |
| `enable_minimal_spoilers` | boolean (default: true) |
| `enable_full_spoilers` | boolean (default: true) |
| `enable_multiclient` | boolean (default: true) |
| `enable_multiworld` | boolean (default: true) |

**Test results and documents:**

| Status | Mode | Test Result File | Document | Freshness |
|--------|------|-----------------|----------|----------|
| 🟢 | original / Minimal Spoilers | `scripts/output/spoiler-minimal/test-results.json` | [test-results-spoilers-minimal.md](./test-results-spoilers-minimal.md) | 2026-02-13 03:08 |
| 🟠 | worldgen / Minimal Spoilers | `scripts/output/spoiler-minimal-worldgen/test-results.json` | [test-results-spoilers-minimal-worldgen.md](./test-results-spoilers-minimal-worldgen.md) | 2026-01-27 22:55 (17 days) |
| 🟠 | apworld / Minimal Spoilers | `scripts/output/spoiler-minimal-apworld/test-results.json` | [test-results-spoilers-minimal-apworld.md](./test-results-spoilers-minimal-apworld.md) | 2026-01-24 05:56 (20 days) |
| 🟢 | original / Full Spoilers | `scripts/output/spoiler-full/test-results.json` | [test-results-spoilers-full.md](./test-results-spoilers-full.md) | 2026-02-13 03:14 |
| 🟠 | worldgen / Full Spoilers | `scripts/output/spoiler-full-worldgen/test-results.json` | [test-results-spoilers-full-worldgen.md](./test-results-spoilers-full-worldgen.md) | 2026-01-27 23:02 (17 days) |
| 🟠 | apworld / Full Spoilers | `scripts/output/spoiler-full-apworld/test-results.json` | [test-results-spoilers-full-apworld.md](./test-results-spoilers-full-apworld.md) | 2026-01-24 06:28 (20 days) |
| 🟢 | original / Multiclient | `scripts/output/multiclient/test-results.json` | [test-results-multiclient.md](./test-results-multiclient.md) | 2026-02-13 03:23 |
| 🔴 | worldgen / Multiclient | `scripts/output/multiclient-worldgen/test-results.json` | [test-results-multiclient-worldgen.md](./test-results-multiclient-worldgen.md) | 2026-01-08 06:08 (36 days) |
| 🟠 | apworld / Multiclient | `scripts/output/multiclient-apworld/test-results.json` | [test-results-multiclient-apworld.md](./test-results-multiclient-apworld.md) | 2026-01-24 07:47 (20 days) |
| 🟢 | original / Multiworld | `scripts/output/multiworld/test-results.json` | [test-results-multiworld.md](./test-results-multiworld.md) | 2026-02-13 03:32 |
| 🔴 | worldgen / Multiworld | `scripts/output/multiworld-worldgen/test-results.json` | [test-results-multiworld-worldgen.md](./test-results-multiworld-worldgen.md) | 2026-01-08 06:23 (36 days) |
| 🟠 | apworld / Multiworld | `scripts/output/multiworld-apworld/test-results.json` | [test-results-multiworld-apworld.md](./test-results-multiworld-apworld.md) | 2026-01-24 09:07 (20 days) |

**Derived documents** (generated from multiple result files):

| Status | Document | Command | Freshness |
|--------|----------|---------|-----------|
| 🟢 | [test-results-summary.md](./test-results-summary.md) | `python scripts/docs/generate-test-chart.py --summary` | 2026-02-13 03:08 |
| 🟠 | [test-results-summary-worldgen.md](./test-results-summary-worldgen.md) | `python scripts/docs/generate-test-chart.py --summary --worldgen` | 2026-01-27 22:55 (17 days) |
| 🟠 | [test-results-summary-apworld.md](./test-results-summary-apworld.md) | `python scripts/docs/generate-test-chart.py --summary --apworld` | 2026-01-24 05:56 (20 days) |
| 🟢 | [test-results-processing-times.md](./test-results-processing-times.md) | `python scripts/docs/generate-test-chart.py --processing-times` | 2026-02-13 03:08 |
| 🟠 | [test-results-processing-times-worldgen.md](./test-results-processing-times-worldgen.md) | `python scripts/docs/generate-test-chart.py --processing-times --worldgen` | 2026-01-27 22:55 (17 days) |
| 🟠 | [test-results-processing-times-apworld.md](./test-results-processing-times-apworld.md) | `python scripts/docs/generate-test-chart.py --processing-times --apworld` | 2026-01-24 05:56 (20 days) |

### [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml)

Fuzz tests Universal Tracker by generating random option combinations and tracking games.

**Workflow file:** `.github/workflows/test-ut-fuzz.yml`

**Key inputs:**

| Input | Options |
|-------|---------|
| `ut_mode` | original, worldgen, pickle, hybrid |
| `test_apworlds` | boolean (default: false) |
| `runs_per_game` | number (default: 10) |
| `seed` | number (default: 1) |

**Test results and documents:**

| Status | Mode | Test Result File | Document | Freshness |
|--------|------|-----------------|----------|----------|
| 🟠 | bundled / original | `scripts/output/ut-fuzz/test-results-original-fixed-seed.json` | [test-results-ut-fuzz-original.md](./test-results-ut-fuzz-original.md) | 2026-01-26 04:45 (18 days) |
| 🟢 | bundled / worldgen | `scripts/output/ut-fuzz/test-results-worldgen-fixed-seed.json` | [test-results-ut-fuzz-worldgen.md](./test-results-ut-fuzz-worldgen.md) | 2026-02-13 04:52 |
| 🟠 | bundled / hybrid | `scripts/output/ut-fuzz/test-results-hybrid-fixed-seed.json` | [test-results-ut-fuzz-hybrid.md](./test-results-ut-fuzz-hybrid.md) | 2026-02-04 19:19 (9 days) |
| 🟡 | bundled / pickle | `scripts/output/ut-fuzz/test-results-pickle-fixed-seed.json` | [test-results-ut-fuzz-pickle.md](./test-results-ut-fuzz-pickle.md) | 2026-02-07 05:13 (6 days) |
| 🟠 | apworlds / original | `scripts/output/ut-fuzz/test-results-apworlds-original-fixed-seed.json` | [test-results-ut-fuzz-apworlds-original.md](./test-results-ut-fuzz-apworlds-original.md) | 2026-01-25 06:50 (19 days) |
| 🟠 | apworlds / worldgen | `scripts/output/ut-fuzz/test-results-apworlds-worldgen-fixed-seed.json` | [test-results-ut-fuzz-apworlds-worldgen.md](./test-results-ut-fuzz-apworlds-worldgen.md) | 2026-01-24 05:05 (20 days) |
| 🟠 | apworlds / hybrid | `scripts/output/ut-fuzz/test-results-apworlds-hybrid-fixed-seed.json` | [test-results-ut-fuzz-apworlds-hybrid.md](./test-results-ut-fuzz-apworlds-hybrid.md) | 2026-02-04 21:03 (9 days) |
| 🟠 | apworlds / pickle | `scripts/output/ut-fuzz/test-results-apworlds-pickle-fixed-seed.json` | [test-results-ut-fuzz-apworlds-pickle.md](./test-results-ut-fuzz-apworlds-pickle.md) | 2026-02-04 19:44 (9 days) |

**Derived documents** (generated from multiple result files):

| Status | Document | Command | Freshness |
|--------|----------|---------|-----------|
| ⚪ | [test-results-ut-fuzz-comparison-original-worldgen.md](./test-results-ut-fuzz-comparison-original-worldgen.md) | `python scripts/docs/compare_ut_fuzz_results.py` | N/A (N/A) |
| 🟠 | [test-results-ut-fuzz-comparison-original-hybrid.md](./test-results-ut-fuzz-comparison-original-hybrid.md) | `python scripts/docs/compare_ut_fuzz_results.py` | 2026-01-26 04:45 (18 days) |
| 🟠 | [test-results-ut-fuzz-comparison-original-pickle.md](./test-results-ut-fuzz-comparison-original-pickle.md) | `python scripts/docs/compare_ut_fuzz_results.py` | 2026-01-26 04:45 (18 days) |
| ⚪ | [test-results-ut-fuzz-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | `python scripts/docs/compare_ut_fuzz_results.py` | N/A (N/A) |
| ⚪ | [test-results-ut-fuzz-comparison-worldgen-pickle.md](./test-results-ut-fuzz-comparison-worldgen-pickle.md) | `python scripts/docs/compare_ut_fuzz_results.py` | N/A (N/A) |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-worldgen.md](./test-results-ut-fuzz-apworlds-comparison-original-worldgen.md) | `python scripts/docs/compare_ut_fuzz_results.py --apworld` | 2026-01-24 05:05 (20 days) |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | `python scripts/docs/compare_ut_fuzz_results.py --apworld` | 2026-01-25 06:50 (19 days) |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-pickle.md](./test-results-ut-fuzz-apworlds-comparison-original-pickle.md) | `python scripts/docs/compare_ut_fuzz_results.py --apworld` | 2026-01-25 06:50 (19 days) |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md) | `python scripts/docs/compare_ut_fuzz_results.py --apworld` | 2026-01-24 05:05 (20 days) |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md) | `python scripts/docs/compare_ut_fuzz_results.py --apworld` | 2026-01-24 05:05 (20 days) |

### [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml)

Fuzz tests by generating random seeds and running spoiler verification on them.

**Workflow file:** `.github/workflows/test-spoiler-fuzz.yml`

**Key inputs:**

| Input | Options |
|-------|---------|
| `test_apworlds` | boolean (default: false) |
| `spoiler_mode` | minimal-spoilers, full-spoilers |
| `runs_per_game` | number (default: 10) |
| `seed` | number (default: 1) |

**Test results and documents:**

| Status | Mode | Test Result File | Document | Freshness |
|--------|------|-----------------|----------|----------|
| 🟢 | bundled | `scripts/output/spoiler-fuzz/test-results-fixed-seed.json` | [test-results-spoiler-fuzz.md](./test-results-spoiler-fuzz.md) | 2026-02-13 04:46 |
| 🟠 | apworlds | `scripts/output/spoiler-fuzz/test-results-apworlds-fixed-seed.json` | [test-results-spoiler-fuzz-apworlds.md](./test-results-spoiler-fuzz-apworlds.md) | 2026-01-25 04:56 (19 days) |

**Derived documents** (generated from multiple result files):

| Status | Document | Command | Freshness |
|--------|----------|---------|-----------|
| 🟢 | [test-results-fuzz-summary.md](./test-results-fuzz-summary.md) | `python scripts/docs/generate_fuzz_summary_chart.py` | 2026-02-13 04:52 |
| 🟠 | [test-results-fuzz-summary-apworlds.md](./test-results-fuzz-summary-apworlds.md) | `python scripts/docs/generate_fuzz_summary_chart.py --apworld` | 2026-01-24 05:05 (20 days) |

### [Test Multiworld UT Fuzz Assembly](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-multiworld-ut-fuzz.yml)

Tests Universal Tracker with incrementally assembled multiworld games.

**Workflow file:** `.github/workflows/test-multiworld-ut-fuzz.yml`

**Key inputs:**

| Input | Options |
|-------|---------|
| `runs_per_test` | number (default: 3) |
| `max_players` | number (default: 10) |
| `seed` | number (default: 1) |
| `timeout` | number (default: 60) |

**Test results and documents:**

| Status | Mode | Test Result File | Document | Freshness |
|--------|------|-----------------|----------|----------|
| 🟡 | default | `scripts/output/multiworld-ut-fuzz/test-results-fixed-seed.json` | [test-results-multiworld-ut-fuzz.md](./test-results-multiworld-ut-fuzz.md) | 2026-02-06 04:22 (7 days) |

### [Test World Generator](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-world-generator.yml)

Tests the world generator by generating worlds from rules and running spoiler tests.

**Workflow file:** `.github/workflows/test-world-generator.yml`

**Key inputs:**

| Input | Options |
|-------|---------|
| `test_mode` | canonical, random, both |
| `seed` | number (default: 1) |

**Test results and documents:**

| Status | Mode | Test Result File | Document | Freshness |
|--------|------|-----------------|----------|----------|
| 🟢 | canonical | `scripts/output/world-generator/test-results-canonical.json` | [test-results-world-generator.md](./test-results-world-generator.md) | 2026-02-13 02:34 |
| 🟢 | random | `scripts/output/world-generator/test-results-random.json` | [test-results-world-generator.md](./test-results-world-generator.md) | 2026-02-13 02:34 |

## Document Freshness

| Status | Document | Source Data | Days Old | Workflow | Local Command |
|--------|----------|-------------|----------|----------|---------------|
| 🟠 | [test-results-fuzz-summary-apworlds.md](./test-results-fuzz-summary-apworlds.md) | 2026-01-24 05:05 | 20 days | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py --apworld` |
| 🟢 | [test-results-fuzz-summary.md](./test-results-fuzz-summary.md) | 2026-02-13 04:52 |  | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py` |
| 🟠 | [test-results-multiclient-apworld.md](./test-results-multiclient-apworld.md) | 2026-01-24 07:47 | 20 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --apworld -p` |
| 🔴 | [test-results-multiclient-worldgen.md](./test-results-multiclient-worldgen.md) | 2026-01-08 06:08 | 36 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --worldgen -p` |
| 🟢 | [test-results-multiclient.md](./test-results-multiclient.md) | 2026-02-13 03:23 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient -p` |
| 🟠 | [test-results-multiworld-apworld.md](./test-results-multiworld-apworld.md) | 2026-01-24 09:07 | 20 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --apworld -p` |
| 🟡 | [test-results-multiworld-ut-fuzz.md](./test-results-multiworld-ut-fuzz.md) | 2026-02-06 04:22 | 7 days | [Test Multiworld UT Fuzz Assembly](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-multiworld-ut-fuzz.yml) | `python scripts/test/test-multiworld-ut-fuzz.py -p` |
| 🔴 | [test-results-multiworld-worldgen.md](./test-results-multiworld-worldgen.md) | 2026-01-08 06:23 | 36 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --worldgen -p` |
| 🟢 | [test-results-multiworld.md](./test-results-multiworld.md) | 2026-02-13 03:32 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld -p` |
| 🟠 | [test-results-processing-times-apworld.md](./test-results-processing-times-apworld.md) | 2026-01-24 05:56 | 20 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --apworld` |
| 🟠 | [test-results-processing-times-worldgen.md](./test-results-processing-times-worldgen.md) | 2026-01-27 22:55 | 17 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --worldgen` |
| 🟢 | [test-results-processing-times.md](./test-results-processing-times.md) | 2026-02-13 03:08 |  | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times` |
| 🟠 | [test-results-spoiler-fuzz-apworlds.md](./test-results-spoiler-fuzz-apworlds.md) | 2026-01-25 04:56 | 19 days | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py --apworld -p` |
| 🟢 | [test-results-spoiler-fuzz.md](./test-results-spoiler-fuzz.md) | 2026-02-13 04:46 |  | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py -p` |
| 🟠 | [test-results-spoilers-full-apworld.md](./test-results-spoilers-full-apworld.md) | 2026-01-24 06:28 | 20 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --apworld -p` |
| 🟠 | [test-results-spoilers-full-worldgen.md](./test-results-spoilers-full-worldgen.md) | 2026-01-27 23:02 | 17 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-full.md](./test-results-spoilers-full.md) | 2026-02-13 03:14 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers -p` |
| 🟠 | [test-results-spoilers-minimal-apworld.md](./test-results-spoilers-minimal-apworld.md) | 2026-01-24 05:56 | 20 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --apworld -p` |
| 🟠 | [test-results-spoilers-minimal-worldgen.md](./test-results-spoilers-minimal-worldgen.md) | 2026-01-27 22:55 | 17 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-minimal.md](./test-results-spoilers-minimal.md) | 2026-02-13 03:08 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers -p` |
| 🟠 | [test-results-summary-apworld.md](./test-results-summary-apworld.md) | 2026-01-24 05:56 | 20 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --apworld` |
| 🟠 | [test-results-summary-worldgen.md](./test-results-summary-worldgen.md) | 2026-01-27 22:55 | 17 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --worldgen` |
| 🟢 | [test-results-summary.md](./test-results-summary.md) | 2026-02-13 03:08 |  | _Local only_ | `python scripts/docs/generate-test-chart.py --summary` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | 2026-01-25 06:50 | 19 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-pickle.md](./test-results-ut-fuzz-apworlds-comparison-original-pickle.md) | 2026-01-25 06:50 | 19 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-worldgen.md](./test-results-ut-fuzz-apworlds-comparison-original-worldgen.md) | 2026-01-24 05:05 | 20 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md) | 2026-01-24 05:05 | 20 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md) | 2026-01-24 05:05 | 20 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-hybrid.md](./test-results-ut-fuzz-apworlds-hybrid.md) | 2026-02-04 21:03 | 9 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid` |
| 🟠 | [test-results-ut-fuzz-apworlds-original.md](./test-results-ut-fuzz-apworlds-original.md) | 2026-01-25 06:50 | 19 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --original` |
| 🟠 | [test-results-ut-fuzz-apworlds-pickle.md](./test-results-ut-fuzz-apworlds-pickle.md) | 2026-02-04 19:44 | 9 days | _Local only_ | _Unknown_ |
| 🟠 | [test-results-ut-fuzz-apworlds-worldgen.md](./test-results-ut-fuzz-apworlds-worldgen.md) | 2026-01-24 05:05 | 20 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --worldgen` |
| 🟠 | [test-results-ut-fuzz-comparison-original-hybrid.md](./test-results-ut-fuzz-comparison-original-hybrid.md) | 2026-01-26 04:45 | 18 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟠 | [test-results-ut-fuzz-comparison-original-pickle.md](./test-results-ut-fuzz-comparison-original-pickle.md) | 2026-01-26 04:45 | 18 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| ⚪ | [test-results-ut-fuzz-comparison-original-worldgen.md](./test-results-ut-fuzz-comparison-original-worldgen.md) | N/A | N/A | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| ⚪ | [test-results-ut-fuzz-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | N/A | N/A | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| ⚪ | [test-results-ut-fuzz-comparison-worldgen-pickle.md](./test-results-ut-fuzz-comparison-worldgen-pickle.md) | N/A | N/A | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟠 | [test-results-ut-fuzz-hybrid.md](./test-results-ut-fuzz-hybrid.md) | 2026-02-04 19:19 | 9 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --hybrid` |
| 🟠 | [test-results-ut-fuzz-original.md](./test-results-ut-fuzz-original.md) | 2026-01-26 04:45 | 18 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --original` |
| 🟡 | [test-results-ut-fuzz-pickle.md](./test-results-ut-fuzz-pickle.md) | 2026-02-07 05:13 | 6 days | _Local only_ | _Unknown_ |
| 🟢 | [test-results-ut-fuzz-worldgen.md](./test-results-ut-fuzz-worldgen.md) | 2026-02-13 04:52 |  | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --worldgen` |
| 🟢 | [test-results-world-generator.md](./test-results-world-generator.md) | 2026-02-13 02:34 |  | [Test World Generator](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-world-generator.yml) | `python scripts/docs/generate-world-generator-report.py` |

## Regeneration Commands

Quick reference for updating stale documents. Use **GitHub Workflows** for CI integration or **Local Commands** for development.

### Spoiler Tests

**GitHub Workflows:**
- [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml)

**Local Commands:**
```bash
# Run full spoiler tests (apworld)
python scripts/test/test-all-templates.py --full-spoilers --apworld -p

# Run full spoiler tests (worldgen)
python scripts/test/test-all-templates.py --full-spoilers --worldgen -p

# Run full spoiler tests
python scripts/test/test-all-templates.py --full-spoilers -p

# Run minimal spoiler tests (apworld)
python scripts/test/test-all-templates.py --minimal-spoilers --apworld -p

# Run minimal spoiler tests (worldgen)
python scripts/test/test-all-templates.py --minimal-spoilers --worldgen -p

# Run minimal spoiler tests
python scripts/test/test-all-templates.py --minimal-spoilers -p

```

### Multiclient Tests

**GitHub Workflows:**
- [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml)

**Local Commands:**
```bash
# Run multiclient tests (apworld)
python scripts/test/test-all-templates.py --multiclient --apworld -p

# Run multiclient tests (worldgen)
python scripts/test/test-all-templates.py --multiclient --worldgen -p

# Run multiclient tests
python scripts/test/test-all-templates.py --multiclient -p

```

### Multiworld Tests

**GitHub Workflows:**
- [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml)
- [Test Multiworld UT Fuzz Assembly](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-multiworld-ut-fuzz.yml)

**Local Commands:**
```bash
# Run multiworld tests (apworld)
python scripts/test/test-all-templates.py --multiworld --apworld -p

# Run multiworld UT fuzz tests
python scripts/test/test-multiworld-ut-fuzz.py -p

# Run multiworld tests (worldgen)
python scripts/test/test-all-templates.py --multiworld --worldgen -p

# Run multiworld tests
python scripts/test/test-all-templates.py --multiworld -p

```

### Fuzz Tests

**GitHub Workflows:**
- [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml)
- [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml)

**Local Commands:**
```bash
# Generate fuzz summary chart (apworld)
python scripts/docs/generate_fuzz_summary_chart.py --apworld

# Generate fuzz summary chart
python scripts/docs/generate_fuzz_summary_chart.py

# Run spoiler fuzz tests (apworld)
python scripts/test/test-all-spoiler-fuzz.py --apworld -p

# Run spoiler fuzz tests
python scripts/test/test-all-spoiler-fuzz.py -p

# Generate UT fuzz comparison chart (apworld)
python scripts/docs/compare_ut_fuzz_results.py --apworld

# Generate UT fuzz comparison chart (apworld)
python scripts/docs/compare_ut_fuzz_results.py --apworld

# Generate UT fuzz comparison chart (apworld)
python scripts/docs/compare_ut_fuzz_results.py --apworld

# Generate UT fuzz comparison chart (apworld)
python scripts/docs/compare_ut_fuzz_results.py --apworld

# Generate UT fuzz comparison chart (apworld)
python scripts/docs/compare_ut_fuzz_results.py --apworld

# Generate UT fuzz chart (apworld hybrid)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid

# Generate UT fuzz chart (apworld original)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --original

# Generate UT fuzz chart (apworld worldgen)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --worldgen

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz chart (hybrid)
python scripts/docs/generate_ut_fuzz_chart.py --hybrid

# Generate UT fuzz chart (original)
python scripts/docs/generate_ut_fuzz_chart.py --original

# Generate UT fuzz chart (worldgen)
python scripts/docs/generate_ut_fuzz_chart.py --worldgen

```

### Charts & Reports

**GitHub Workflows:**
- [Test World Generator](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-world-generator.yml)

**Local Commands:**
```bash
# Generate processing times chart (apworld)
python scripts/docs/generate-test-chart.py --processing-times --apworld

# Generate processing times chart (worldgen)
python scripts/docs/generate-test-chart.py --processing-times --worldgen

# Generate processing times chart
python scripts/docs/generate-test-chart.py --processing-times

# Generate test summary chart (apworld)
python scripts/docs/generate-test-chart.py --summary --apworld

# Generate test summary chart (worldgen)
python scripts/docs/generate-test-chart.py --summary --worldgen

# Generate test summary chart
python scripts/docs/generate-test-chart.py --summary

# Generate world generator report
python scripts/docs/generate-world-generator-report.py

```

## Freshness Legend

- 🟢 **Fresh:** Source data from today or yesterday
- 🟡 **Recent:** Source data within the last week
- 🟠 **Aging:** Source data within the last month
- 🔴 **Stale:** Source data over a month ago
- ⚪ **Unknown:** No source data date found in document

## Notes

- **Source Data Date:** When the underlying test results were generated
- **Workflow:** GitHub Actions workflow for CI-based regeneration (click to run)
- **Local Command:** Terminal command to regenerate the document locally
- The `-p` flag runs post-processing to generate the markdown charts
- Documents marked _Local only_ have no automated workflow and must be run manually
- See [.github/workflows/README.md](https://github.com/PeerInfinity/Archipelago-CC/blob/main/.github/workflows/README.md) for workflow documentation
- To regenerate all documents at once, run: `python scripts/docs/generate-all-docs.py`
