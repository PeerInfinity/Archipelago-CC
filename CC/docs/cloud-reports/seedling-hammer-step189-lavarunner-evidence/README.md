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
