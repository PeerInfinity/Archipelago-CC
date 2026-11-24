# seedling-hammer-edgebait — evidence

Measurement only. The probes in `tools/` are scratch scripts (node, run from the repo root at the commit named in the
report); nothing in the app imports them.

| path | what |
|---|---|
| `tools/leg.mjs` | KT-ARRIVAL's `leg.mjs` (the L40 flag-8 stagings of legs 395/412 = 853/854 at this base, `hammerKeylockTurretL40.js`) plus the `ICETURRET_STATIC_KILL_COUNTS` row. `node leg.mjs <395|412> <cleartag|exit> [door] [idle]`: `solveFromTape`, NO budget |
| `tools/legA.mjs` | the same stagings solved as the page WORKER does (`solveAnytime`, the captured request's two passes, `budgetWork` 640 unless `BUDGET=`) |
| `tools/fx.mjs` | the committed A1 29:11 fixture (`fixtures/kt-arrival/A1-29-11.request.json`) over the committed atlas, `BUDGET=` override, fresh-run replay, the turret counters |
| `tools/temporary-hooks.diff` | ⚠ the TEMPORARY hooks of step 1 (never committed to the source): `HOOK_EB_KT` (KEYLOCK_TURRET's turretFirst gets `edgeBait`), `HOOK_ANCHOR_EDGE` (the volley anchor probed after the edge stop), `HOOK_EB_ISK` (ICEST's tries first stop at the edge), `HOOK_ISK_APPROACH=first|after` (+`HOOK_ISK_APPROACH_EDGE=0`) (ICEST's kill handed to APPROACH, before/after its own tries) |
| `m1/base-md5.txt` | acceptance md5 at the base |
| `m1/{395,412}-ct-idle*.txt` | base, `solveFromTape`: the clear-tag goal after N idle ticks (KEYLOCK_TURRET's 0-cell path) |
| `m1/hkA-*` | the same with `HOOK_EB_KT=1` (edge-first) |
| `m1/hkAC-*` | `HOOK_EB_KT=1 HOOK_ANCHOR_EDGE=1` |
| `m1/A-*-{off,hkA}.txt` | `legA.mjs` (worker budget 640): base vs edge-first |
| `m1/isk-*` | `SEEDLING_ICETURRET_STATIC_KILL=1`: A1 (fixture) and leg 395's exit goal, base / `HOOK_EB_ISK` / `HOOK_ISK_APPROACH`; `isk-kta-a1-640` = ICEST + KT-ARRIVAL both ON |
| `m4/head-md5.txt` | acceptance md5 at the head (OFF) |
| `m4/{A,U}-*-on.txt` | `SEEDLING_KEYLOCK_TURRET_EDGE_BAIT=1`: `legA.mjs` (worker, 640) and `leg.mjs` (unbounded) on legs 853/854 (395/412 in the tools' names), clear-tag goal, idle 0/100/150 |
| `m4/a1-{off,eb,kta,kta-eb}.txt` | A1 29:11 (fixture) with neither switch / EDGE_BAIT / KEYLOCK_TURRET_ARRIVAL / both |
| `gates/` | acceptance md5 (base, head); the bounded vitest file list and its OFF / ON summaries |
| `survey/l40-l98-{off,on,kta,kta-on}-rows.jsonl` | `survey-seedling-route --through=end --only=66,96,134,136,149,166,173,227`, rows without `ms`/`traceRows`/`replay` (refusals cut to 400 chars); identity was computed on the full rows minus `ms` |
| `page/` | the p4g sweep (`--mode=inv`) of legs 853/854 by key, OFF and `--solver-env=SEEDLING_KEYLOCK_TURRET_EDGE_BAIT=1` (`granted` dropped); `legs-853-854.jsonl` the two legs as `seedling-divergence-legs.mjs` wrote them at this base |
