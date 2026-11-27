solvecap.mjs  — SKIPWALLS' replay of one captured page request (node solvecap.mjs <A1.jsonl> 32 12).
probe.mjs / search.mjs — measurement only. They need a temporary one-line hook at the top of execHold's pace
question in solverBot.js, which is NOT committed:
    if (globalThis.process?.env?.LH_PROBE) globalThis.__lhProbe?.(run, resolved, ctx, { forkWalkTo, fadeForkStand,
        solverPlanOpts, senseContacts, planWaypointsOrNull, playerBoxAt, plannerObstacleAt, forkStep });
search.mjs forks the segment at the hold and, for free plannable cells on a 16 px lattice nearest first, walks the fork
there and stands until the hold's own `until`, inside the hold's 131-tick bound (NC = cells asked).
A1.jsonl = re-measure-8's A1.stop-requests.jsonl.gz, gunzipped
(origin/claude/whole-game-wasm-remeasure-8-89f0jy @7174bc96b9).
