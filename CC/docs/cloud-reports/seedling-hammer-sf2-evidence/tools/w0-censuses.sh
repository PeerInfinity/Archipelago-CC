#!/bin/bash
cd ${1:-/home/user/Archipelago-CC}
for s in census-seedling-solver-surface census-seedling-constants witness-seedling-entities witness-seedling-profile; do
  echo "== $s"; node scripts/procgen/$s.mjs --check 2>&1 | tail -3; echo "rc=$?"
done
echo "== roster"; node -e "const j=require('./frontend/modules/seedlingDemo/fixtures/tapes/index.json'); console.log(Array.isArray(j)?j.length:Object.keys(j.tapes??j).length)"
