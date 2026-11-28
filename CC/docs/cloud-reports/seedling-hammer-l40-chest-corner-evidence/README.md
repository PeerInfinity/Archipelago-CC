# seedling-hammer-l40-chest-corner evidence

Measurement only (nothing here is imported by the app). The captured requests were read from their branches into a
scratch dir and are NOT committed: re-measure-9 `F1`/`P1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-9-ltkolv`
@30e8f29067), re-measure-10 `P1.stop-requests-19-32` / `S1.stop-requests-19-26-29` (`claude/whole-game-wasm-remeasure-ckojg7`
@796503a221), and the committed fixture `frontend/modules/seedlingDemo/fixtures/hammer-kill880/P1-19-1-request.json.gz`
(re-measure-6 P1 19:1). The job files name those scratch paths.

- `tools/`: `rc.mjs` (re-measure-11's `replay-counts.mjs`, + fixture input), `solve.mjs` (chaser-stand's, + the PKH rows in
  `reach.pkh`), `seg-reg.mjs`/`seg-hook.mjs` (in-memory loader patch: the plan's verb rows), `run.sh` (job × config;
  `D` = base defaults, `SIX` = the six OFF switches, `DP` = defaults + `SEEDLING_PRESS_KILL_HOLD=1`, `SP` = SIX + PKH),
  `matrix.sh` (rc.mjs × config), `page.sh` (the 52-key page sweep, D then DP), `list19.py`, `arr.py`.
- `measure/requests/`: every entry-19 press-kill request (19:1 at 640, 19:2 at 2560) of re-measure-9 F1/P1, re-measure-10
  P1/S1 and the KILL880 fixture, under D/SIX/DP/SP (rc.mjs output).
- `measure/fixtures-raw.jsonl`: the 18 L40 fixtures by key, D/DP/SIX/SP.
- `measure/seam-sweep-raw.jsonl` (16 seams, step 5, D/DP/SP) and `seam-sweep-1tick-raw.jsonl` (±1..4, D/DP) of re-measure-9 P1 19:2.
- `measure/p1-19-2-pkh-plan*.txt|json`: the PKH plan's per-tick player and spinner-body positions t626–740, and its verb rows.
- `measure/legs-*.jsonl.gz` / `legs-summary.txt`: the 52 L40/L92 keyed legs on the p4g page, PKH off vs on.
- `survey/`: `survey-seedling-route.mjs --through=end`, PKH off vs on, per step.
- `game/`: the p4g fresh-page witness of re-measure-9 P1 19:2's PKH plan (`tools/reqwitness.mjs`, chaser-stand's).
