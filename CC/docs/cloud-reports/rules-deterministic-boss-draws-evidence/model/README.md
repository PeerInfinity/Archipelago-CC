# The scratch model (never committed under `frontend/`)

`scratch-model.diff` is the whole difference between `frontend/modules/seedlingDemo/` at the base and the untracked
copy `frontend/modules/seedlingDemoDet/` the tools import (`SEEDLING_DEMO_DIR`, default `seedlingDemoDet`). To rebuild it:

    cp -r frontend/modules/seedlingDemo frontend/modules/seedlingDemoDet
    (cd frontend/modules && patch -p0 < ../../CC/docs/cloud-reports/rules-deterministic-boss-draws-evidence/model/scratch-model.diff)

What it changes:
- `finalBossRng.js`: `DetOwlStream` (the patch's Owl patterns, the same site methods and ledger as `OwlDrawStream`, no
  generator), knobs `DET_OWL` (`barrage=every|vdc|hash`, `aim=halton|zero|hash`, `scale=vdc5|mean|hash`,
  `grenade=leg|room|hash`, `death=strata|centre|hash`, or `pat=hash` for all) and `DET_HASH=jiggle|mix` (option H = the
  `Game.shakeJiggle` hash, option H2 = a lowbias32 mixing hash with int-exact `imul32`).
- `finalBossFight.js`: `stepFinalBoss` hands the boss to the stream (the patterns read `rockfallTime`).
- `levelRun.js`: the Owl's stream is a `DetOwlStream` (unless `DET_OWL_OFF`); a TentacleBeast build never carries the
  previous build's stream (unless `DET_TB_OFF`): every entry restarts the patterns.
- `tentacleBeast.js`: `DetTentacleStream` (`DET_TB=pat=halton|hash,whirl=tick|scan`), the patch's `break`, no stream
  premises (unless `DET_TB_OFF`).
- `solverBot.js`: the TentacleBeast resolver also accepts a Spear (to try the rule's Spear arm; the policy is unchanged).
- `tentacleBeastPolicy.js`: `DET_TB_PRESSGAP` (default 7, as shipped) for the Spear arm's 11-tick fire window.
