#!/bin/bash
# LB D1's queue (two lanes). Measure only.
cd /home/user/Archipelago-CC
(
 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --id=414 --i=0 --cpu=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-def.cpuprofile --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-def-cpu.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-def-cpu.log 2>&1
 env SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --id=414 --i=0 --budget=1000000000 --frames --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-wb-nobudget.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-wb-nobudget.log 2>&1
 env SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --id=414 --i=0 --frames --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-wb.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p414-i0-wb.log 2>&1
) &
(
 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --requests=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/input/requests-397-rebuilt.jsonl --id=397 --budget=1000000000 --frames --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-def-nobudget.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-def-nobudget.log 2>&1
 env SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --requests=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/input/requests-397-rebuilt.jsonl --id=397 --budget=1000000000 --frames --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-wb-nobudget.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-wb-nobudget.log 2>&1
 node CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools/lb-prof.mjs --requests=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/input/requests-397-rebuilt.jsonl --id=397 --cpu=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-def.cpuprofile --out=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-def-cpu.json > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/p397-def-cpu.log 2>&1
) &
wait
echo QUEUE-D1-DONE > CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/d1/queue.done
