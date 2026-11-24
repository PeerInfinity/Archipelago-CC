# seedling-hammer-kt-arrival — evidence

Measurement only. The probes in `tools/` are scratch scripts (node, run from the repo root at the commit named in the
report); nothing in the app imports them.

| path | what |
|---|---|
| `tools/m.mjs` | one captured worker request solved as the worker does (`solveAnytime`), `BUDGET=<n>` overriding `budgetWork`; a plan's keys replayed on a FRESH run (hits, deaths, the level crossing); the turret counters |
| `tools/leg.mjs` | the L40 flag-8 stagings of legs 395/412 (`hammerKeylockTurretL40.js`) solved with goal `cleartag` (L40 flag 8) or `exit` (teleporter@944,96 → L41), `door` 1/0 (tag 12 staged or not), `idle` N empty ticks before the solve |
| `tools/fx.mjs` | the committed fixture `fixtures/kt-arrival/A1-29-11.request.json` solved over the committed atlas with its own L40/L41 records |
| `m1/base-on.txt`, `base-off-2560.txt` | A1 29:11 at the base: GSW+PM ON at 640, and OFF at 2560 — the refusal (work 74) |
| `m1/isk-*.txt` | the planner's follow-up: `SEEDLING_ICETURRET_STATIC_KILL=1` in each mode (`both`, `chooser`, `hit`), at 640, 2560 and unbounded |
| `legs/395-ct.txt` | leg 395's staging, clear-tag goal, at the base: SOLVED 718 (KEYLOCK_TURRET, `right` wait 29, 70 forks) |
| `legs/395-ct-idle{50,100,150}.txt` | the same with 50/100/150 empty ticks first: 50 solves, 100 and 150 refuse (504 forks) |
| `legs/395-exit-off.txt` | leg 395's staging with the reach-exit goal: the A1 29:11 refusal, word for word |
| `legs/395-exit-on.txt`, `412-exit-on.txt` | the hand-off alone (before the edge bait): the kill refuses at APPROACH's staging point (488,561) |
| `sweep/x<N>.txt` | ⚠ a TEMPORARY debug hook (since removed): APPROACH's staging point pushed N px past its first point (leg 395 clear-tag, idle 100) |
| `sweep/w<N>.txt` | ⚠ TEMPORARY hook: N still ticks at the staging point before the tries |
| `sweep/edge<D>.txt` | ⚠ TEMPORARY hook: every try first stops on the staging→turret line at D px from the turret (the edge bait's prototype) |
