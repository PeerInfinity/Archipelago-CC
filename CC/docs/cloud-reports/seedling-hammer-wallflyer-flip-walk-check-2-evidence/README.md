# Evidence: `seedling-hammer-wallflyer-flip-walk-check-2` (MEASUREMENT ONLY)

Each `*.measure.log` is one `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game` run, trimmed by
`grep -aE '^RUN |^EXIT |\[MEASURE|\[PROGRESS|tutorial-walk-timing|box lock|frozen|PW DEBUG: URL|\[wasm playback\]|\[playback\] the wasm|\[js runtime\] (solved|the solver declined)|IN-APP'`
(the `[MEASURE worker env] unreadable` lines for workers that closed before the 15 s probe are dropped; consecutive
duplicates collapsed). Line kinds are the first walk check's (`[MEASURE tick|end|hit|status|flyers]`) plus this slice's:
`[MEASURE worker]` / `[MEASURE worker env]` (each solve worker's URL, and its own `process.env` wallflyer switches read
IN the worker 15 s after it starts), `[MEASURE jsframe]` (the JS runtime page's URL), `[MEASURE] contact
wallFlyerCorpseGone: ON` (the panel-switch override took).

Common knobs (all runs): `TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000
TEST_MEASURE_BOT_STALL_MS=300000`. Every run stopped on its own (none hit the step cut).

| file | arm | env beyond the common knobs | head (box lock) | stop |
|---|---|---|---|---|
| A | wasm s1, defaults | — | 26d6035e | 9/48, entry 10 L22→L29 refusal (budget), 683.7 s |
| B | JS s1, defaults | `TEST_MEASURE_FLASH_RUNTIME=js` | 26d6035e | 8/48, entry 9 L22→L25 refusal (R1), 370.2 s |
| Bc | JS s1, corpse key via env — **INERT** (the key never reached the JS page's worker; see report §3) | `…=js TEST_MEASURE_SOLVER_ENV=SEEDLING_WALLFLYER_CORPSE_GONE=1` | 26d6035e | = B, 373.3 s |
| Bc2 | **JS s1, corpse key ON** (the panel's contact switch → `?contactFidelity=…wallFlyerCorpseGone…`) | `…=js TEST_MEASURE_CONTACT_CORPSE_GONE=1` | ed534e2c | = B, 366.2 s |
| Ac | wasm s1, corpse key ON (control) | `TEST_MEASURE_SOLVER_ENV=SEEDLING_WALLFLYER_CORPSE_GONE=1` | 26d6035e (tree moved to ed534e2c mid-run; inert) | 24/48, no-goal L58 yeti flag, 2307.1 s; 1 hit at L39 |
| Ap1 | wasm s2, defaults | `TEST_MEASURE_PLAYTHROUGH_SEED=2` | ed534e2c (+ the seed-2 preset entry; tree moved to 787163e5, evidence only) | 4/48, playback stall at tick 1/858 L12→L21, 644.0 s |
| Ap2 | wasm s2, defaults (repeat) | same | 787163e5 (+ the seed-2 preset entry) | identical to Ap1, 644.3 s |

A first A′ attempt (7 s) failed at load, `no preset for game=seedling_playthrough seed=2`: I had generated seed 2 from
`Seedling.yaml`. It was reverted and regenerated from `Seedling Playthrough.yaml`; its log is not kept.
