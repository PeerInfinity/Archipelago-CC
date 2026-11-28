# seedling-hammer-chaser-stand evidence

Measurement only (nothing here is imported by the app). Captures were fetched from their branches into a scratch dir:
re-measure-9 `F1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-9-ltkolv`) as `r9-F1.jsonl`, re-measure-8
`A1`/`P1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-8-89f0jy`) as `r8-A1.jsonl` / `r8-P1.jsonl`; the
job files (`measure/*-jobs.txt`) name those scratch paths. The fixtures are the committed L40 request fixtures.

- `tools/`: `solve.mjs` (STACK4's, + a `passes` column, `ONLY_PASS=`, the OAC counts), `matrix.sh`, `variants.sh`
  (OAC / PSB / HSB × all4 / PKSW+PKRB (`pp`) / PKSW (`ps`)), `cs-hook.mjs` (per-tick press-kill key choice + PKC verdicts),
  `ha-hook.mjs` (hit-avoid budget), `psb-hook.mjs` (PSB's stand question as a shadow), `reqwitness.mjs` (solve + play on
  the game), `reach-preload.mjs`, `survey.sh`, `reqtable.py`, `sweeptable.py`, `sdiff.py`-compatible outputs.
- `measure/`: the per-tick logs, `requests.md` (+ raw), `sweep-32-10.md` (+ raw; the off/all4 columns are STACK4's raw rows,
  off there = LHM OFF), `fixtures.md` (+ raw), `hit-avoid-budget.txt`, `psb-stand-shadow.txt`, `acceptance-md5.txt`.
- `survey/`: per-step comparisons (`3way-alone.tsv`: STACK4 off vs OAC vs OAC+PSB; `4way-all4.tsv`: STACK4 off, STACK4 all4,
  all4+OAC, all4+OAC+HSB), `summary.txt`, reach (`reach-all4oachsb.jsonl`), the survey JSONs gzipped.
- `game/`: the F1 32:10 game witnesses (all4+OAC+PSB, and the all4 control).
- `census/legs-reach.txt`: the legs (by key) a spinner room with a chaser holds.
