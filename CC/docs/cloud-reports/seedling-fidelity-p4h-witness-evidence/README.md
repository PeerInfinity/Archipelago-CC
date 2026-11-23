# p4h game witnesses, a measure pass (planner seedling-fidelity-planning-23, 2026-11-23)

Recorded LOCALLY on the p4h game (`seedling_bot_ap_p4h`, wasm a335206) on the headless logic-only channel
(`__swfGpu.lost == 1`), a fresh page per tape, at the p4h port tip 723e3c4476. These are evidence, not fixtures:
nothing here is enrolled in a test. Re-records into `fixtures/` each need Robert's OK.

## TentacleBeast (`tb-recordings/`, from `probe-seedling-bosskills.mjs --record`, `SEEDLING_PAGE=seedling_bot_ap_p4h`)
Each file is a witness in the `fixtures/tentaclebeast-witness/` shape (`tape` + per-tick `samples`). Compared by
`tools/p4h-witness-compare.test.js.txt` (a copy of `fidelityTentacleBeast.test.js` reading these files, with the model
default set to p4h's capabilities via `modelBuild.setModelBuildDefault`).

- MATCH every tick (player, beast, every tentacle, the generator): tb-death-s3, tb-enter-cleared, tb-hitless-door,
  tb-hitless-s2, tb-idle-s1, and the three p4h plans tb-hitless-{door,pit,s2}-p4h (1149 / 1491 / 1491 t, 0 hits, L58).
- DIVERGE (player position, sub-pixel; the game's player accelerates one tick before the model's):
  tb-hitless-pit from t970, tb-solve-s2 from t406, tb-policy-s2 from t406, whirlpool-drown-s15 from t1028. Beast,
  tentacles and generator agree up to there. Whirlpools are not in `botMobiles` (an Entity), so their positions are
  not sampled.

## Owl (`owl/`, from rules-12's `judge.mjs`, p4h page, model as p4h)
- `owl-judge-p4h.json`: r6-owl-control (727 t, 1 hit) and r6-owl-kill (816 t, 0 hits, both flags) MATCH the model
  every tick. det-owl-sword-A / det-owl-spear-A WIN on the game (0 hits, 112:0+112:1, L113 at 80,136; 2227 / 2200 t).
  The model diverges at t2207 / t2180 and ends in L112.
- `owl-exit-p4h.json` (`tools/judge-exit.mjs`, the judge plus an exit-window capture): the last 80 ticks of the game
  stream and the model stream, plus every Mobile within 48 px of the player. Sword A: the model's y holds at 34.566
  from t2205 while the game's player climbs on (33.07 at t2207 … 25.87 at t2213; x 114.6 → 118.9). No Mobile is near
  the player on the game.
