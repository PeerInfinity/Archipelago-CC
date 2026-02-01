# Test Results Freshness Report

This report shows when each test result document was generated, how fresh the underlying data is, and how to regenerate each document.

**Report Generated:** 2026-02-01 07:49:32

## Summary

- **Total Documents:** 36
- **With Date Info:** 36
- 🟢 **Fresh (0-1 days):** 10
- 🟡 **Recent (2-7 days):** 11
- 🟠 **Aging (8-30 days):** 15
- 🔴 **Stale (>30 days):** 0

## Documentation Sync Status

Status of documentation coverage across the codebase:

| Check | Coverage | Status | Command |
|-------|----------|--------|--------|
| Rule Types Documentation | 92.1% (116/126) | 🟡 10 gaps | `python scripts/docs/sync-rule-docs.py` |
| Rule Types Test Coverage | 52.3% (56/107) | 🟠 51 gaps | `python scripts/docs/sync-rule-tests.py` |
| Script Documentation | 43.4% (33/76) | 🟠 43 gaps | `python scripts/docs/sync-script-docs.py` |
| Document Reachability | 69.6% (133/191) | 🟠 63 orphans | `python scripts/docs/find_orphaned_docs.py` |

## Document Freshness

| Status | Document | Source Data | Days Old | Workflow | Local Command |
|--------|----------|-------------|----------|----------|---------------|
| 🟠 | [test-results-fuzz-summary-apworlds.md](./test-results-fuzz-summary-apworlds.md) | 2026-01-24 05:05 | 8 days | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py --apworld` |
| 🟢 | [test-results-fuzz-summary.md](./test-results-fuzz-summary.md) | 2026-01-31 01:30 | 1 day | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py` |
| 🟠 | [test-results-multiclient-apworld.md](./test-results-multiclient-apworld.md) | 2026-01-24 07:47 | 8 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --apworld -p` |
| 🟠 | [test-results-multiclient-worldgen.md](./test-results-multiclient-worldgen.md) | 2026-01-08 06:08 | 24 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --worldgen -p` |
| 🟢 | [test-results-multiclient.md](./test-results-multiclient.md) | 2026-01-31 04:22 | 1 day | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient -p` |
| 🟡 | [test-results-multiworld-apworld.md](./test-results-multiworld-apworld.md) | 2026-01-24 09:07 | 7 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --apworld -p` |
| 🟠 | [test-results-multiworld-ut-fuzz.md](./test-results-multiworld-ut-fuzz.md) | 2026-01-12 05:56 | 20 days | [Test Multiworld UT Fuzz Assembly](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-multiworld-ut-fuzz.yml) | `python scripts/test/test-multiworld-ut-fuzz.py -p` |
| 🟠 | [test-results-multiworld-worldgen.md](./test-results-multiworld-worldgen.md) | 2026-01-08 06:23 | 24 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --worldgen -p` |
| 🟢 | [test-results-multiworld.md](./test-results-multiworld.md) | 2026-01-31 04:30 | 1 day | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld -p` |
| 🟠 | [test-results-processing-times-apworld.md](./test-results-processing-times-apworld.md) | 2026-01-24 05:56 | 8 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --apworld` |
| 🟡 | [test-results-processing-times-worldgen.md](./test-results-processing-times-worldgen.md) | 2026-01-27 22:55 | 4 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --worldgen` |
| 🟢 | [test-results-processing-times.md](./test-results-processing-times.md) | 2026-01-31 04:08 | 1 day | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times` |
| 🟡 | [test-results-spoiler-fuzz-apworlds.md](./test-results-spoiler-fuzz-apworlds.md) | 2026-01-25 04:56 | 7 days | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py --apworld -p` |
| 🟡 | [test-results-spoiler-fuzz.md](./test-results-spoiler-fuzz.md) | 2026-01-27 20:12 | 4 days | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py -p` |
| 🟠 | [test-results-spoilers-full-apworld.md](./test-results-spoilers-full-apworld.md) | 2026-01-24 06:28 | 8 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --apworld -p` |
| 🟡 | [test-results-spoilers-full-worldgen.md](./test-results-spoilers-full-worldgen.md) | 2026-01-27 23:02 | 4 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-full.md](./test-results-spoilers-full.md) | 2026-01-31 04:15 | 1 day | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers -p` |
| 🟠 | [test-results-spoilers-minimal-apworld.md](./test-results-spoilers-minimal-apworld.md) | 2026-01-24 05:56 | 8 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --apworld -p` |
| 🟡 | [test-results-spoilers-minimal-worldgen.md](./test-results-spoilers-minimal-worldgen.md) | 2026-01-27 22:55 | 4 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-minimal.md](./test-results-spoilers-minimal.md) | 2026-01-31 04:08 | 1 day | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers -p` |
| 🟠 | [test-results-summary-apworld.md](./test-results-summary-apworld.md) | 2026-01-24 05:56 | 8 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --apworld` |
| 🟡 | [test-results-summary-worldgen.md](./test-results-summary-worldgen.md) | 2026-01-27 22:55 | 4 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --worldgen` |
| 🟢 | [test-results-summary.md](./test-results-summary.md) | 2026-01-31 04:08 | 1 day | _Local only_ | `python scripts/docs/generate-test-chart.py --summary` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md) | 2026-01-23 07:07 | 9 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | 2026-01-23 07:07 | 9 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-modified.md](./test-results-ut-fuzz-apworlds-comparison-original-modified.md) | 2026-01-24 05:05 | 8 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-hybrid.md](./test-results-ut-fuzz-apworlds-hybrid.md) | 2026-01-23 07:07 | 9 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid` |
| 🟠 | [test-results-ut-fuzz-apworlds-modified.md](./test-results-ut-fuzz-apworlds-modified.md) | 2026-01-24 05:05 | 8 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --modified` |
| 🟡 | [test-results-ut-fuzz-apworlds-original.md](./test-results-ut-fuzz-apworlds-original.md) | 2026-01-25 06:50 | 7 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --original` |
| 🟢 | [test-results-ut-fuzz-comparison-modified-hybrid.md](./test-results-ut-fuzz-comparison-modified-hybrid.md) | 2026-01-31 19:51 |  | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟡 | [test-results-ut-fuzz-comparison-original-hybrid.md](./test-results-ut-fuzz-comparison-original-hybrid.md) | 2026-01-26 04:45 | 6 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟡 | [test-results-ut-fuzz-comparison-original-modified.md](./test-results-ut-fuzz-comparison-original-modified.md) | 2026-01-26 04:45 | 6 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟢 | [test-results-ut-fuzz-hybrid.md](./test-results-ut-fuzz-hybrid.md) | 2026-01-31 19:51 |  | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --hybrid` |
| 🟢 | [test-results-ut-fuzz-modified.md](./test-results-ut-fuzz-modified.md) | 2026-02-01 05:06 |  | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --modified` |
| 🟡 | [test-results-ut-fuzz-original.md](./test-results-ut-fuzz-original.md) | 2026-01-26 04:45 | 6 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --original` |
| 🟠 | [test-results-world-generator.md](./test-results-world-generator.md) | 2026-01-14 04:15 | 18 days | [Test World Generator](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-world-generator.yml) | `python scripts/docs/generate-world-generator-report.py` |

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

# Generate UT fuzz chart (apworld hybrid)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid

# Generate UT fuzz chart (apworld modified)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --modified

# Generate UT fuzz chart (apworld original)
python scripts/docs/generate_ut_fuzz_chart.py --apworld --original

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz comparison chart
python scripts/docs/compare_ut_fuzz_results.py

# Generate UT fuzz chart (hybrid)
python scripts/docs/generate_ut_fuzz_chart.py --hybrid

# Generate UT fuzz chart (modified)
python scripts/docs/generate_ut_fuzz_chart.py --modified

# Generate UT fuzz chart (original)
python scripts/docs/generate_ut_fuzz_chart.py --original

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
