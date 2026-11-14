Evidence for seedling-hammer-spear-wallflyer-l22.md (base 71adf001dd, origin/hammer-stack-trio).

Names: s<SPEAR_ARM>_w<WALLFLYER_KILL_ARM>; exp0 = the base's dangerMap.js; exp1 = patches/experiment-dangermap-removed-wallflyer.patch
applied (a THROWAWAY, never committed: staticEnemyDanger skips a wallflyer the run's roster lists as removed, gated by
the env EXP_WF_GONE=1). Every run was made with the patch applied only for its duration and the file restored with cp +
cmp; the committed tree carries neither patch.

drivers/
  replay.mjs, variants.mjs   SPEAR-ARM's harness (copied unchanged): a captured request solved as the worker does.
  counts.mjs <capture> [variant]   replay.mjs plus BODY_FAMILY_KILL_COUNTS and SPEAR_ARM_COUNTS.
  cc.mjs <inventory csv>     canCross L22 (from L25's door) -> L29, dashMode none, plus the arms' counts.
  tape49.mjs <capture> <out> the solve's plan written as a walk tape on the request's own staging (seam.items.hitsMax ->
                             seam.hits_max), then the TAPE replayed on the model (parseTape -> createRunForStaging).
  rows.js <frames> <out>     the game frames' first frame per tick -> [t, level, hits, hits_timer, x, y].
patches/
  temporary-instrumentation.patch   the KILLRUNG / fork prints behind DBG_KR=<file> (reverted).
  experiment-dangermap-removed-wallflyer.patch   the experiment above (reverted).
r49/        captured request #49 (CONNECTED-L22's cap_conn_L22_49.json), the four switch combinations x exp0/exp1; *.trace.txt
            are the KILLRUNG prints (the hit's sources, the player's position) and one line per fork of the arm.
cancross/   the fixture-free row: canCross L22 from L25 -> L29 with ['spear'] and ['fire','spear'].
other-captures/   #44 and #50 (both arms OFF vs ON; exp1 with both ON).
step35/     vanilla survey step 35 (sword held), WALLFLYER_KILL_ARM ON, exp0 vs exp1 rows (identical md5 0706aa39e2…).
witness/    the exp1 plans of #49 as walk tapes, and the GAME's reading (probe-seedling-chaser-mobiles.mjs --class=Bob
            --player-hits --frames, own dev server on port 9791, stopped by PID): logs and per-tick rows. The 2 MB frame
            dumps are not kept.
