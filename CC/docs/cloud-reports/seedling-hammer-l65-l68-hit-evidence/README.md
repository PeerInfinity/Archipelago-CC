# seedling-hammer-l65-l68-hit — evidence (MEASUREMENT ONLY)

Nothing here is a gate or a fixture. Every file was produced in the `seedling-hammer-l65-l68-hit` cloud session; the
report is `../seedling-hammer-l65-l68-hit.md`.

| file | what |
|---|---|
| `chain-off.txt`, `chain-on.txt` | the three-leg chain from S1 37:8 (L63 → L65 → L68 → Health), each leg's passes, and a fresh replay of the whole chain; OFF / `WALK_BLADE_ARM` ON |
| `trace-off-l65.txt` | the OFF L65 → L68 plan, the player and `bob@208,80` every 20 ticks and every tick t1241–t1299 |
| `replays-154.jsonl` | all 154 captured requests of re-measure-10 (S1, P1×2, committed) and re-measure-11 (S1, L1, P1, on `claude/seedling-whole-game-wasm-remeasure-bypmjt`), solved OFF and ON, each plan replayed fresh |
| `survey-*-steps.txt`, `survey-*-vs-*.txt` | the route survey `--through=end` (250 steps) per step, and the arm comparisons (OFF / ON / `UNBILLED_DAMAGE_GATE` / gate + ON) |
| `sweep-l65-l68-off-vs-on.txt`, `sweep-*.log` | the live p4g divergence sweep (`--mode=inv`, one page per leg), the 10 L65 / L68 legs by key, OFF vs ON |
| `tools/` | the scratch probes (absolute paths of the session's box; `chain.mjs` reads `CHAIN_FILE`, default the re-measure-11 S1 capture copied to the session scratchpad) |

Every measurement ran with `SEEDLING_WAND_SHOT_TRAP_BODIES=1`, `SEEDLING_WAND_SHOT_ENEMY_BODIES=1` and
`SEEDLING_AXE_TIMING_SWORD_SWAP=1`; the ON arm adds `SEEDLING_WALK_BLADE_ARM=1`.
