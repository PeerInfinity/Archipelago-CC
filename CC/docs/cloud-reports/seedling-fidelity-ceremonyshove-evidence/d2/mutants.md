# CEREMONYSHOVE D2 mutants (predicted first; made by copy + restore of levelRun.js; `fidelityCeremonyShove.test.js`)

| mutant | predicted | measured (test) | measured (comparison alone, `tools/cmp.mjs` EITHER=1 ON) |
|---|---|---|---|
| M1 lump 150 frames, not 149 | touch ON red only | 4 ON rows red | touch red (103 ticks, worst 3.95); iframe / dying / player-iframe 0 |
| M2 lump one tick late (`due + 2`) | all 4 ON rows red | 4 ON rows red | — |
| M3 no release frame | touch ON red only | 4 ON rows red | touch red (68 ticks, worst 3.95); the other three 0 |
| M4 no chaser step on ceremony ticks | iframe red (cer+1 reads 21 vs the game's 20); dying green (alpha is not compared) | iframe red only | — |
| M5 no player i-frame drain in the lump | player-iframe red only | player-iframe red only | — |

M1/M3: the prediction missed the test's own lump-row pin (`[149, 1]`), asserted on every ON row; the behaviour
(the comparison alone) is red exactly where predicted. Every mutant was restored (`cmp` against the saved copy).
| M6 seal lump deferred one tick (the first cut) | l17 ON red only | l17 ON red only (and the lump row's `t`) |
