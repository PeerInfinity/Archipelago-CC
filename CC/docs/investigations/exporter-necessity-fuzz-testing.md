# Exporter Necessity Investigation via Fuzz Testing

**Date:** 2026-02-03

## Summary

We investigated which custom exporters in `exporter/games/official/` are necessary by running fuzz tests with the exporter files deleted. The key finding is that **UT fuzz and spoiler fuzz tests exercise different code paths**, so both must be considered when evaluating exporter necessity.

## Background

The `exporter/games/` directory contains custom Python modules that handle game-specific logic for exporting rule data. The hypothesis was that some of these exporters might be unnecessary if the modified tracker can handle the games purely from world definitions.

## Methodology

1. Added a `delete_exporter_games` option to both workflow files:
   - `.github/workflows/test-ut-fuzz.yml`
   - `.github/workflows/test-spoiler-fuzz.yml`

2. Ran both workflows with deletion enabled (10 runs per game)

3. Compared results to identify which games pass without their exporters

## Results

### UT Fuzz Results (Modified Tracker)

With exporter files deleted, 43/85 games passed 10/10.

Four official exporters appeared unnecessary based on UT fuzz alone:
| Exporter | Game | UT Fuzz Result |
|----------|------|----------------|
| `factorio.py` | Factorio | 10/10 |
| `osrs.py` | Old School Runescape | 10/10 |
| `raft.py` | Raft | 10/10 |
| `sm64ex.py` | Super Mario 64 | 10/10 |

### Spoiler Fuzz Results

With exporter files deleted, 39/73 games passed 10/10.

Cross-referencing with the four exporters identified above:
| Exporter | Game | UT Fuzz | Spoiler Fuzz |
|----------|------|---------|--------------|
| `sm64ex.py` | Super Mario 64 | 10/10 ✓ | 10/10 ✓ |
| `factorio.py` | Factorio | 10/10 ✓ | 8/10 ⚠ |
| `osrs.py` | Old School Runescape | 10/10 ✓ | 0/10 ✗ |
| `raft.py` | Raft | 10/10 ✓ | 0/10 ✗ |

## Key Finding

**UT fuzz and spoiler fuzz tests exercise different code paths.** A game passing UT fuzz does not guarantee it will pass spoiler fuzz.

- **UT fuzz** tests the Universal Tracker's ability to track item collection and location accessibility
- **Spoiler fuzz** tests the full spoiler log verification, which may rely on different exported data

Three exporters (`factorio.py`, `osrs.py`, `raft.py`) that appeared safe to delete based on UT fuzz results were actually needed for spoiler testing.

## Outcome

- **Deleted:** `sm64ex.py` (Super Mario 64) - passes both UT fuzz and spoiler fuzz 10/10
- **Restored:** `factorio.py`, `osrs.py`, `raft.py` - needed for spoiler testing

## Lessons Learned

1. **Always run both fuzz test types** before concluding an exporter is unnecessary
2. **Different test modes exercise different code paths** - passing one doesn't imply passing the other
3. **The workflow option `delete_exporter_games`** is useful for this type of investigation

## Recommendations

When evaluating exporter necessity in the future:
1. Run UT fuzz with `delete_exporter_games: true`
2. Run spoiler fuzz with `delete_exporter_games: true`
3. Only consider an exporter unnecessary if games pass **both** tests
4. Consider running with higher run counts (e.g., 100) for more confidence

## Files Changed

- Added `delete_exporter_games` input to both fuzz test workflows
- Deleted `exporter/games/official/sm64ex.py` (confirmed unnecessary)
- Kept `exporter/games/official/factorio.py`, `osrs.py`, `raft.py` (needed for spoiler fuzz)
