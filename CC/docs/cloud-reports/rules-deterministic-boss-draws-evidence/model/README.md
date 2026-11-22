# The scratch model (never committed under `frontend/`)

`scratch-model.diff` is the whole difference between `frontend/modules/seedlingDemo/` at the base and the untracked
copy `frontend/modules/seedlingDemoDet/` that the tools import (`SEEDLING_DEMO_DIR`, default `seedlingDemoDet`). To rebuild it:

    cp -r frontend/modules/seedlingDemo frontend/modules/seedlingDemoDet
    (cd frontend/modules/seedlingDemoDet && patch -p1 < ../../../CC/docs/cloud-reports/rules-deterministic-boss-draws-evidence/model/scratch-model.diff)

⚠ Run it inside the COPY, with `-p1`. A `-p0` from `frontend/modules` would patch the original `seedlingDemo/`.
(Verified: applying it to fresh copies of the six files reproduces the copy byte for byte.)

What it changes:
- `finalBossRng.js`: `DetOwlStream`, the patch's Owl patterns. It has the same site methods and per-site ledger as
  `OwlDrawStream`, so `levelRun`'s per-tick draw-count assertion still holds, and it has no generator. Knobs:
  - `DET_OWL`: `barrage=every|vdc|hash`, `aim=halton|zero|hash`, `scale=vdc5|mean|hash`, `grenade=leg|room|hash`,
    `death=strata|centre|hash`, or `pat=hash` for all of them;
  - `DET_HASH=jiggle|mix`: option H is the `Game.shakeJiggle` hash, and option H2 is a lowbias32 mixing hash with an
    int-exact `imul32`;
  - `DET_PHASE=<n>`: added to every hash key (the global-`Game.time` sample).
- `finalBossFight.js`: `stepFinalBoss` hands the boss to the stream, because the patterns read `rockfallTime`.
- `levelRun.js`: the Owl's stream is a `DetOwlStream` (unless `DET_OWL_OFF`). A TentacleBeast build never carries the
  previous build's stream (unless `DET_TB_OFF`), so every entry restarts the patterns.
- `tentacleBeast.js`: `DetTentacleStream` (`DET_TB=pat=halton|hash,whirl=tick|scan`, plus `DET_HASH`), the patch's
  `break`, and no stream premises (unless `DET_TB_OFF`).
- `solverBot.js`: the TentacleBeast resolver also accepts a Spear, so the rule's Spear arm can be tried (the policy is
  unchanged).
- `tentacleBeastPolicy.js`: `DET_TB_PRESSGAP` (default 7, as shipped), for the Spear's 11-tick fire window.
