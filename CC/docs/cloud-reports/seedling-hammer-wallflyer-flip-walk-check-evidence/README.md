# Evidence: `seedling-hammer-wallflyer-flip-walk-check` (MEASUREMENT ONLY)

Each `*.measure.log` is one `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game` run, trimmed by
`grep -aE '\[MEASURE|\[PROGRESS|tutorial-walk-timing|box lock|frozen|PW DEBUG: URL|\[wasm playback\]|\[playback\] the wasm|\[js runtime\] (solved|the solver declined)|IN-APP'`
(consecutive duplicates collapsed). Line kinds: `[MEASURE tick|end]` the 15 s sampler (re-measure-3's);
`[MEASURE hit]` the game's own `botStatus()` hits / hits_timer / level / deaths (JS only) on any change, polled at 100 ms;
`[MEASURE status]` the bot status on change (playing tick masked, so `playing tick _/539` is the plan length);
`[MEASURE flyers]` the live WallFlyer mobiles in L22/L29 and a census of every other non-Player class (wasm `botMobiles`).

| file | arm | env beyond re-measure-3's knobs | head (box lock) |
|---|---|---|---|
| A1 | wasm seed 1, flip ON | — (no hit/status/flyers lines yet) | c3d44c9e |
| A2 | wasm seed 1, flip ON | step cut 720 s (stopped on its own at 652 s) | 6eee95b0 |
| B1 | JS seed 1, flip ON | `TEST_MEASURE_FLASH_RUNTIME=js` (no hit lines) | c3d44c9e |
| B2 | JS seed 1, flip ON, hit witness | `…=js`, step cut 600 s | 6b80969d |
| Ap1 | wasm seed 2, flip ON | `TEST_MEASURE_PLAYTHROUGH_SEED=2` (hit lines only) | 69afdedf (+ the seed-2 preset entry) |
| Ap2 | wasm seed 2, flip ON | seed 2, step cut 800 s (flyers, no census) | 070c7eb6 (+ preset entry) |
| Ap3 | wasm seed 2, flip ON | seed 2, step cut 720 s (flyers + census) | 6eee95b0 (+ preset entry) |
| Actl | wasm seed 1, CONTROL | `TEST_MEASURE_SOLVER_ENV=SEEDLING_WALLFLYER_KILL_ARM=0` | 070c7eb6 |
| ApCtl | wasm seed 2, CONTROL | seed 2 + `…KILL_ARM=0`, step cut 800 s (stopped on its own at 668 s) | 6eee95b0 (+ preset entry) |
| Anolim | wasm seed 1, flip ON, NO WORK LIMIT | `TEST_MEASURE_NO_WORK_LIMIT=1`, step cut 1800 s | 070c7eb6 |
