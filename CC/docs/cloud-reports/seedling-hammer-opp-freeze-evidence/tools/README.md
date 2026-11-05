# OPP-FREEZE W0 instruments

- `hook.mjs` — preloaded with `NODE_OPTIONS=--import=<hook.mjs>` (it reaches the survey's per-step children). It needs a
  ONE-LINE scratch patch in `solverBot.execKillByPressOnce`, directly after `const d = opp.decide(...)`:
  `globalThis.__OPPF_W0?.(run, d, offered);` (applied for W0, reverted before any commit). For every OPP ask it reads
  `run.progress('freezeForecast')` (a pure read) and logs the asks on a refused tick, and the decisions taken there
  (with the stack); separately it logs every `FROZEN_TICK_PRESS` error with its stack and whether
  `execKillByPressOnce` is on it. Per-process summary rows on exit.
- `legs.mjs <root> <fixture.json.gz>` — one committed captured sweep request, solved as the worker does.
- `probe-construct.mjs <root>` — the constructed case: fidelity's L40 freeze tape (no presses), a policy aims at t51,
  then the owed press at t52 (the contact tick) asked with OFF vs forecast options.
- The 860 runs use the frozenpress report's `leg860s.mjs` (`CC/docs/cloud-reports/seedling-fidelity-frozenpress-evidence/tools/`).
