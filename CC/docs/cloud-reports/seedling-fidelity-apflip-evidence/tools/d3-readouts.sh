#!/bin/bash
# d3-readouts.sh — the game's persistence_cleared for each recorded apb-* tape (the witness tool, one arm, the vanilla set)
E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-fidelity-apflip-evidence
for s in $E/d3/specs/*.json; do SEEDLING_PORT=9698 node $E/tools/witness.mjs $s --out=$E/d3/witness; done
