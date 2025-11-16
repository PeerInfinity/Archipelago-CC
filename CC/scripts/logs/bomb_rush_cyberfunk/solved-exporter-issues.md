# Solved Exporter Issues

## Issue 1: Individual challenge functions not preserved as helpers [SOLVED]

**Location affected:** Pyramid Island: Score challenge reward (and potentially others)

**Symptom:** Location is accessible too early (Sphere 5.7 instead of 5.9)

**Root cause:** The `pyramid_island_challenge1` function (and similar individual challenge functions) were not in the `should_preserve_as_helper` list in the exporter. When these functions were inlined, they produced empty "and" rules instead of proper helper calls.

**Fix applied:** Added all individual challenge functions to the preserve list in `exporter/games/bomb_rush_cyberfunk.py`:
- versum_hill_challenge1, versum_hill_challenge2, versum_hill_challenge3
- brink_terminal_challenge1, brink_terminal_challenge2, brink_terminal_challenge3
- millennium_mall_challenge1, millennium_mall_challenge2, millennium_mall_challenge3, millennium_mall_challenge4
- pyramid_island_challenge1, pyramid_island_challenge2, pyramid_island_challenge3
- mataan_challenge3

**Verification:** Spoiler test now passes for seed 9.

