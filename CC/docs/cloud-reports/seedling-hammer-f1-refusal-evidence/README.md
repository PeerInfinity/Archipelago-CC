# seedling-hammer-f1-refusal evidence

Measurement only (nothing here is imported by the app). The captures were fetched from their branches into a scratch dir,
as CHASER-STAND did:
- re-measure-9 `F1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-9-ltkolv`) as `cap/r9-F1.jsonl`;
- re-measure-8 `A1`/`P1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-8-89f0jy`) as `cap/r8-A1.jsonl` /
  `cap/r8-P1.jsonl`.

The job files (`measure/*-jobs.txt`) and the tools name those scratch paths. The fixtures are the committed L40 request
fixtures. "five" = PKSW + PKRB + DSS + OAC + HSB (LHM ON by default); "fiversb" = five + `SEEDLING_REFUSAL_STAND_BOMBS=1`.

- `tools/`:
  - `solve.mjs`: CHASER-STAND's, plus the RSB counts and `BUDGET=` (the 2560 held-retry budget);
  - `variants.sh` (`venv2 five|fiversb`), `matrix.sh`, `chain2.sh`;
  - `lhmc-hook.mjs`: every cell `latchedHoldCells` drops, and why;
  - `lhmd-hook.mjs` / `lhmd2-hook.mjs`: the delayed-start LHM probe, preview / preview + forks (`LHM_DELAY=D`);
  - `solve2.mjs`: `DUMP_LHM`;
  - `lhmcfg.mjs`: the planner's two non-default LHM configs, solved as their committed rows solve them;
  - `reqwitness.mjs`: solve + play on the game;
  - `survey2.sh` + `reach-preload2.mjs`.
- `measure/`:
  - the F1 32:10 LHM cell log and delay probes;
  - `requests.md`, `sweep-32-10.md`, `fixtures.md` (+ raw JSONL);
  - `retry-2560-raw.jsonl`, `lhm-configs.jsonl`, `acceptance-md5.txt`.
- `survey/`: both surveys (gzipped), RSB's per-step reach, `summary.txt`.
- `game/`: the F1 32:10 game witness under five + RSB.
- `census/legs-reach.txt`: the seed-1 sweep legs (by key) that start in or target L40.
