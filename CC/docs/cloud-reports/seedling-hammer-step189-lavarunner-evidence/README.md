# seedling-hammer-step189-lavarunner — evidence

Measurement-only files for `CC/docs/cloud-reports/seedling-hammer-step189-lavarunner.md`. The captured requests are
re-measure-11's (`claude/seedling-whole-game-wasm-remeasure-bypmjt` @98bcc6259b,
`…/seedling-whole-game-wasm-remeasure-11-evidence/P1.stop-requests-32-37-38-39.jsonl.gz`) and are NOT copied here.

- `measure/{38-6,39-1}-{base,six,ls}.txt` — `tools/rc.mjs` (re-measure-11's `replay-counts.mjs`, full message) at base
  de6e6e7fa8: defaults / SIX / `SEEDLING_KILLLOCK_LINE_STANCE=1`.
- `measure/l71-scene-38-6.txt` — `tools/scene.mjs`: L71 at the request's tick 0 (tile map, `#` = Solid, `~` = lava),
  the five counted lavarunners, the lock, the activators.
- `measure/l71-hand-spear-{38-6,39-1}.txt` — `tools/probe.mjs`: hand-driven keys on the model from the request's
  prefix — into the east pocket, spear selected, facing west, thrusts through the Dark Stone wall.
- `measure/acceptance-md5.txt` — `batch-seedling-acceptance.mjs | md5sum` at base and with the switch OFF.
- `measure/{38-6,39-1}-kps.txt`, `…-six-kps.txt` — `tools/rc.mjs` with `SEEDLING_KILLLOCK_PINNED_SPEAR=1` (defaults / SIX):
  the answer, the plan's ticks and hits on a fresh replay, and `KILLLOCK_PINNED_SPEAR_COUNTS`.
- `measure/replay-{off,kps}-{38-6,39-1}.txt` — `replay-seedling-solve-request.mjs --n=3`: one answer and one trace over 3
  fresh processes, each pass's work.
- `game/{38-6,39-1}-kps.{log,json}` — `tools/reqwitness.mjs` (f1-refusal's, + the slot re-map by item): the plan played
  on a FRESH p4g page (headless logic-only, under the box lock); `samples` = [tick, level, x, y, hits] every 5 ticks;
  `tools/cmp.mjs` compares them with the model's trajectory. `game/38-6-kps-unmapped-slot.log` is the first run, made
  before the re-map: the fresh page's slot 2 held the WAND, so the plan fired wand shots (see the report, §8).
- `survey/survey-{base,six,kps,sixkps}.json.gz` — `survey-seedling-route.mjs --through=end`; `survey/summary.txt` from
  `tools/survey-diff.py` (every step's verdict, ticks, replay incl. hits/deaths, refusal text).
- `sweep/{off,kps}.jsonl.gz`, `sweep/l71-legs.md` — the 29 L71 legs of the seed-1 leg list, `--mode=inv`, OFF vs ON
  (`tools/sweep-run.sh`). (A first `--mode=bare` start was aborted after 4 legs: bare legs hold no items, so no spear.)
- `census/killlock-census.txt`, `census/legs-killlock-rooms.txt` — the atlas's kill-lock rooms and the legs that start in
  them, with whether the leg's AP inventory holds the Ghost Spear.
