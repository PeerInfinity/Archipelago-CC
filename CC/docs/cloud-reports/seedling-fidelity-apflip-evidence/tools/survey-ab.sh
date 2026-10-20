#!/bin/bash
# survey-ab.sh — the route survey's apReportBosses-reachable steps, OFF then ON (local; the CI survey is the planner's).
cd /home/user/Archipelago-CC
for arm in 0 1; do SEEDLING_AP_REPORT_BOSSES=$arm node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=28,30,32,39,43,49,51,57,74,80,94,113,115,130,144,161,165,175,182,208 --out=CC/docs/cloud-reports/seedling-fidelity-apflip-evidence/survey/survey-$arm.json > CC/docs/cloud-reports/seedling-fidelity-apflip-evidence/survey/survey-$arm.log 2>&1; echo "arm $arm rc=$?" >> CC/docs/cloud-reports/seedling-fidelity-apflip-evidence/survey/done.txt; done
