# Test Results Freshness Report

This report shows when each test result document was generated, how fresh the underlying data is, and how to regenerate each document.

**Report Generated:** 2026-02-07 14:01:40

## Summary

- **Total Documents:** 42
- **With Date Info:** 42
- 🟢 **Fresh (0-1 days):** 11
- 🟡 **Recent (2-7 days):** 5
- 🟠 **Aging (8-30 days):** 26
- 🔴 **Stale (>30 days):** 0

## Documentation Sync Status

Status of documentation coverage across the codebase:

| Check | Coverage | Status | Command |
|-------|----------|--------|--------|
| Rule Types Documentation | 95.8% (138/144) | 🟡 6 gaps | `python scripts/docs/sync-rule-docs.py` |
| Rule Types Test Coverage | 95.2% (119/125) | 🟡 6 gaps | `python scripts/docs/sync-rule-tests.py` |
| Script Documentation | 100.0% (78/78) | ✅ Complete | `python scripts/docs/sync-script-docs.py` |
| Document Reachability | 102.9% (212/206) | ✅ Complete | `python scripts/docs/find_orphaned_docs.py` |

## Document Freshness

| Status | Document | Source Data | Days Old | Workflow | Local Command |
|--------|----------|-------------|----------|----------|---------------|
| 🟠 | [test-results-fuzz-summary-apworlds.md](./test-results-fuzz-summary-apworlds.md) | 2026-01-24 05:05 | 14 days | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py --apworld` |
| 🟢 | [test-results-fuzz-summary.md](./test-results-fuzz-summary.md) | 2026-02-07 04:18 |  | _Local only_ | `python scripts/docs/generate_fuzz_summary_chart.py` |
| 🟠 | [test-results-multiclient-apworld.md](./test-results-multiclient-apworld.md) | 2026-01-24 07:47 | 14 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --apworld -p` |
| 🟠 | [test-results-multiclient-worldgen.md](./test-results-multiclient-worldgen.md) | 2026-01-08 06:08 | 30 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient --worldgen -p` |
| 🟢 | [test-results-multiclient.md](./test-results-multiclient.md) | 2026-02-07 06:32 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiclient -p` |
| 🟠 | [test-results-multiworld-apworld.md](./test-results-multiworld-apworld.md) | 2026-01-24 09:07 | 14 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --apworld -p` |
| 🟢 | [test-results-multiworld-ut-fuzz.md](./test-results-multiworld-ut-fuzz.md) | 2026-02-06 04:22 | 1 day | [Test Multiworld UT Fuzz Assembly](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-multiworld-ut-fuzz.yml) | `python scripts/test/test-multiworld-ut-fuzz.py -p` |
| 🟠 | [test-results-multiworld-worldgen.md](./test-results-multiworld-worldgen.md) | 2026-01-08 06:23 | 30 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld --worldgen -p` |
| 🟢 | [test-results-multiworld.md](./test-results-multiworld.md) | 2026-02-07 06:42 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --multiworld -p` |
| 🟠 | [test-results-processing-times-apworld.md](./test-results-processing-times-apworld.md) | 2026-01-24 05:56 | 14 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --apworld` |
| 🟠 | [test-results-processing-times-worldgen.md](./test-results-processing-times-worldgen.md) | 2026-01-27 22:55 | 10 days | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times --worldgen` |
| 🟢 | [test-results-processing-times.md](./test-results-processing-times.md) | 2026-02-07 05:53 |  | _Local only_ | `python scripts/docs/generate-test-chart.py --processing-times` |
| 🟠 | [test-results-spoiler-fuzz-apworlds.md](./test-results-spoiler-fuzz-apworlds.md) | 2026-01-25 04:56 | 13 days | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py --apworld -p` |
| 🟡 | [test-results-spoiler-fuzz.md](./test-results-spoiler-fuzz.md) | 2026-02-03 19:55 | 3 days | [Test Spoiler Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-spoiler-fuzz.yml) | `python scripts/test/test-all-spoiler-fuzz.py -p` |
| 🟠 | [test-results-spoilers-full-apworld.md](./test-results-spoilers-full-apworld.md) | 2026-01-24 06:28 | 14 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --apworld -p` |
| 🟠 | [test-results-spoilers-full-worldgen.md](./test-results-spoilers-full-worldgen.md) | 2026-01-27 23:02 | 10 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-full.md](./test-results-spoilers-full.md) | 2026-02-07 06:19 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --full-spoilers -p` |
| 🟠 | [test-results-spoilers-minimal-apworld.md](./test-results-spoilers-minimal-apworld.md) | 2026-01-24 05:56 | 14 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --apworld -p` |
| 🟠 | [test-results-spoilers-minimal-worldgen.md](./test-results-spoilers-minimal-worldgen.md) | 2026-01-27 22:55 | 10 days | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers --worldgen -p` |
| 🟢 | [test-results-spoilers-minimal.md](./test-results-spoilers-minimal.md) | 2026-02-07 05:53 |  | [Test All Templates (Sequential)](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-all-sequential.yml) | `python scripts/test/test-all-templates.py --minimal-spoilers -p` |
| 🟠 | [test-results-summary-apworld.md](./test-results-summary-apworld.md) | 2026-01-24 05:56 | 14 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --apworld` |
| 🟠 | [test-results-summary-worldgen.md](./test-results-summary-worldgen.md) | 2026-01-27 22:55 | 10 days | _Local only_ | `python scripts/docs/generate-test-chart.py --summary --worldgen` |
| 🟢 | [test-results-summary.md](./test-results-summary.md) | 2026-02-07 05:53 |  | _Local only_ | `python scripts/docs/generate-test-chart.py --summary` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | 2026-01-25 06:50 | 13 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-pickle.md](./test-results-ut-fuzz-apworlds-comparison-original-pickle.md) | 2026-01-25 06:50 | 13 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-original-worldgen.md](./test-results-ut-fuzz-apworlds-comparison-original-worldgen.md) | 2026-01-24 05:05 | 14 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md) | 2026-01-24 05:05 | 14 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟠 | [test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md](./test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md) | 2026-01-24 05:05 | 14 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py --apworld` |
| 🟡 | [test-results-ut-fuzz-apworlds-hybrid.md](./test-results-ut-fuzz-apworlds-hybrid.md) | 2026-02-04 21:03 | 2 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid` |
| 🟠 | [test-results-ut-fuzz-apworlds-original.md](./test-results-ut-fuzz-apworlds-original.md) | 2026-01-25 06:50 | 13 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --original` |
| 🟡 | [test-results-ut-fuzz-apworlds-pickle.md](./test-results-ut-fuzz-apworlds-pickle.md) | 2026-02-04 19:44 | 2 days | _Local only_ | _Unknown_ |
| 🟠 | [test-results-ut-fuzz-apworlds-worldgen.md](./test-results-ut-fuzz-apworlds-worldgen.md) | 2026-01-24 05:05 | 14 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --apworld --worldgen` |
| 🟠 | [test-results-ut-fuzz-comparison-original-hybrid.md](./test-results-ut-fuzz-comparison-original-hybrid.md) | 2026-01-26 04:45 | 12 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟠 | [test-results-ut-fuzz-comparison-original-pickle.md](./test-results-ut-fuzz-comparison-original-pickle.md) | 2026-01-26 04:45 | 12 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟠 | [test-results-ut-fuzz-comparison-original-worldgen.md](./test-results-ut-fuzz-comparison-original-worldgen.md) | 2026-01-26 04:45 | 12 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟡 | [test-results-ut-fuzz-comparison-worldgen-hybrid.md](./test-results-ut-fuzz-comparison-worldgen-hybrid.md) | 2026-02-04 19:19 | 2 days | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟢 | [test-results-ut-fuzz-comparison-worldgen-pickle.md](./test-results-ut-fuzz-comparison-worldgen-pickle.md) | 2026-02-07 04:18 |  | _Local only_ | `python scripts/docs/compare_ut_fuzz_results.py` |
| 🟡 | [test-results-ut-fuzz-hybrid.md](./test-results-ut-fuzz-hybrid.md) | 2026-02-04 19:19 | 2 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --hybrid` |
| 🟠 | [test-results-ut-fuzz-original.md](./test-results-ut-fuzz-original.md) | 2026-01-26 04:45 | 12 days | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --original` |
| 🟢 | [test-results-ut-fuzz-pickle.md](./test-results-ut-fuzz-pickle.md) | 2026-02-07 05:13 |  | _Local only_ | _Unknown_ |
| 🟢 | [test-results-ut-fuzz-worldgen.md](./test-results-ut-fuzz-worldgen.md) | 2026-02-07 04:18 |  | [Test UT Fuzzer](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-ut-fuzz.yml) | `python scripts/docs/generate_ut_fuzz_chart.py --worldgen` |
| 🟠 | [test-results-world-generator.md](./test-results-world-generator.md) | 2026-01-14 04:15 | 24 days | [Test World Generator](https://github.com/PeerInfinity/Archipelago-CC/actions/workflows/test-world-generator.yml) | `python scripts/docs/generate-world-generator-report.py` |

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
