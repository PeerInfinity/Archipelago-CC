# Solved Exporter Issues for Zillion

This document tracks resolved issues in the Zillion exporter (exporter/games/zillion.py).

## Solved Issues

### Issue 1: Misunderstood gun/jump requirement semantics
- **Status**: SOLVED
- **Description**: The gun and jump requirement fields represent item counts, not power thresholds. `gun=N` means "need N Zillion items" and `jump=N` means "need N jump levels (N * opas_per_level Opa-Opas)".
- **Impact**: Reduced failing locations from ~40 to just 2
- **Root cause**: Misinterpreted req.gun and req.jump as power values instead of item counts
- **Fix**: Simplified logic to use req_gun directly as Zillion count and req_jump * opas_per_level as Opa-Opa count
- **Files changed**: exporter/games/zillion.py (lines 69-165)
