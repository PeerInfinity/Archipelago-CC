# PIT-WEST evidence

- `w0/` — `page-sweep.tsv` (387/388/871 on the page at main's defaults), `page-sweep-l40-64-off.tsv` (all 64 L40 legs at
  the defaults: 51 done, 13 failed), `chain-d0.jsonl` (387/388 replayed uncapped, `tools/chain.mjs`: 3527 units a pass),
  `map-387.txt` / `map-388.txt` (the arrival's walkable lattice, the 17 volumes, the smallest admitting removal sets).
- `m/idle-600.txt` — the six cluster bodies over 600 idle ticks (none moves).
- `i/` — `chain-arms.tsv` (each node arm: work, plan digest, the fresh-run 30(c) check, work by site),
  `mutants.txt` (M1–M8), `page-on-witness.tsv` (the game page with `--solver-env` ON: 387/388 done, 0 room hits),
  `walk-fate.txt` (which bodies the ON walks remove, and when), `radius-*.tsv` (the 70 captured L40 requests per arm).
- `tools/` — scratch instruments (they decide nothing): `chain.mjs` (the census's, copied), `map.mjs`, `radius.mjs`,
  `idle.mjs`, `walkfate.mjs`, `cut.mjs` (the fixture cutter). The captured requests (37 MB) are not committed: re-capture
  with `probe-seedling-divergence-sweep.mjs --legs=<legs> --mode=inv --producer=solver --page-legs=1
  --page=seedling_bot_ap_p4g --ids=<the 64 L40 ids> --capture-requests=<out>` against a :8000 dev server.
