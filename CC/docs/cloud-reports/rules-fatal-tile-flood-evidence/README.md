# rules-fatal-tile-flood — evidence

Base `origin/main` = `f96d6b66254cd8c2dd08323a489d5d1f07525600`. Report: `../cloud-report-rules-fatal-tile-flood.md`.
REPORT ONLY: the patch below was applied to a scratch COPY of the tree (`cp -a`, in the session scratchpad), measured, and discarded.

| file | what |
|---|---|
| `tools/flood.mjs` | THE PROTOTYPE: `fatalReach(level, body, classRow, wall, tileTypes)`, pure. AS3 citations in its header |
| `flood.patch` | the same flood wired into `killLockRoomRuling(level, {wall})` / `buildKillLockRulings(map, {wallOf})` and the producer (two-phase `KILL_LOCKS`), code only. Apply to f96d6b6625 with `git apply` |
| `tools/census.mjs` | `ROOT=<tree> node census.mjs`: every kill-lock room as the tree's producer computes it (verdict, condition, why, each body's env), vanilla = delivered check, the walls audit, each non-free body's flood |
| `census-before.json` | census on main |
| `census-after.json` | census on the patched scratch tree |
| `tools/walls-equal.mjs` → `runs/walls-second-build-vs-grid.txt` | a SECOND grid build (no entityOverride) vs the analyzer grid: 24 cells differ on 116 levels (L39 (4,6) among them) — why the patch does not use one |
| `tools/wallcmp.mjs` → `runs/walls-phase2-vs-final.txt` | the walls the patched producer floods over vs the final analyzer grid: 0 of 2470 cells differ |
| `tools/dump.mjs` | dumps a tree's `playthroughKillLocks` (with `FLOOD_RULINGS_JSON` it reads the injected rulings: variant B) |
| `tools/lava-reach.mjs` → `runs/lava-reach.txt` | Q5: each lava-standing `dieInLava = false` body's flood, by tile type and grid kind |
| `tools/keywalk.py` (copy of rules-lavatrap-pull-line's) → `runs/keywalk-*.txt` | every JSON path that differs, main vs scratch: the three presets, the derived-rule table, the probe's row file |
| `tools/ruling.mjs`, `tools/grid.mjs`, `tools/dump_regions.py` | copied from `rules-l71-l63-oddities` (7d9e5b6242), unchanged |
| `runs/regen-check-main.txt` | `regen-seedling.mjs --check` on main: every step OK |
| `runs/regen-check-scratch-before-write.txt` | on the scratch tree: only `maze` STALE |
| `runs/regen-write-scratch.txt` | `--write` on the scratch tree: only `seedling_playthrough_maze/AP_1/AP_1_rules.json` changes |
| `runs/regen-check-scratch-after-write.txt` | then `rules` REFUSED: STALE derived-rule table (payloadMd5 only) |
| `runs/regen-check-scratch-variantB.txt` | the same with the phase-2 rulings injected at phase 1: identical (the memo order does not matter) |
| `runs/table-probe-{main,scratch}.log` | `GITHUB_SHA=… probe-seedling-derived-rules.mjs --shards=2` (REGEN_RECIPE's probe, local) |
| `runs/certify-{vanilla,er}-scratch.txt` | `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new` [`--source=er`] on the scratch tree |
| `runs/vitest-*.txt` | bounded `npx vitest run <paths>` on main and on the scratch tree |
| `runs/rules-l71-l99-{playthrough,er}.txt` | the committed L71/L99 regions (main; scratch byte-identical) |
