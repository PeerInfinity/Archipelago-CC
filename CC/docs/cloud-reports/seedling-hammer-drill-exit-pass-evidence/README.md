# DRILL-EXIT-PASS evidence

- `tools/` — scratch, decides nothing: `replay.mjs` (a captured page request through `solveAnytime` in node, its own
  budget/passes/window, a SOLVED plan replayed on a fresh run row by row), `sweeptsv.py` (sweep `--out` → TSV), `ab.py`
  (replay rows → TSV).
- `w0/` — main `0d575b78ea`'s defaults: the page sweep (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
  --page-legs=1 --page=seedling_bot_ap_p4g --capture-requests`) for 717–720 and for the 21 legs whose room holds a drill
  (L28, L88, L91; ids 292–299, 700–708, 717–720), and the node replays of 717–720. ⚠ 701's D0 row is contaminated (a
  half-edited tree was served); re-captured in `page/sweep-701-D0-recaptured.tsv`.
- `m/` — the arms: `arms-717-720.tsv` (OFF, A alone = c0, A+C1, A+C2); `radius-shapeA-pass-first.tsv` (the census's
  shape, the armed pass BEFORE the walk, on all 21 legs: 6 moved, 707 regressed); `radius-shapeR-rung-after-walk.tsv`
  (the shipped rung: 718/719 only).
- `page/` — the page ON witness: `--solver-env=SEEDLING_DRILL_EXIT_PASS=1` on the 21 legs (718 done 190 t, 0 room hits,
  0 divergences; 719 the DRILL D2 refusal; the rest = D0).
- `d/` — the identity block AFTER (this tree) and BEFORE (a pristine worktree of `0d575b78ea`).
- The captured requests (4 MB) are not committed; re-capture with the W0 command.
