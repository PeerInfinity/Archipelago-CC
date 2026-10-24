#!/bin/bash
# D3/AFTER rows, sequential: identity block, L18 sweep, C2's ghost sweep; per config (env), outputs <tag>-*.txt
S=/tmp/claude-0/-home-user-Archipelago-CC/b5b1f0ed-6a24-5130-a3b0-645912f108c0/scratchpad
cd /home/user/Archipelago-CC; source .venv/bin/activate
run() { tag=$1; shift
  env "$@" node scripts/procgen/sweep-seedling-l18-residues.mjs > $S/$tag-l18.txt 2>&1
  env "$@" node $S/ghost-sweep.mjs > $S/$tag-ghost.txt 2>&1
  env "$@" SEEDLING_PORT=9581 bash scripts/procgen/identity-block.sh . > $S/$tag-identity.txt 2>&1; echo "rc=$?" >> $S/$tag-identity.txt
}
run on-mw0 SEEDLING_PRESS_KILL_BOMBS=1
run on-mw1 SEEDLING_PRESS_KILL_BOMBS=1 SEEDLING_MOVING_WAIT=1
echo done > $S/d3.done
