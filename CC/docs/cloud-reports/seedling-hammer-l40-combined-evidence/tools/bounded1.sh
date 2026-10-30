#!/bin/bash
# scratch (L40C): the 8 files that move under A5, under single switches. Usage: bounded1.sh <outdir> "<name>=<env>"...
O=$1; shift; cd "$(dirname "$0")/../../../../.."
for spec in "$@"; do name=${spec%%=*}; X=${spec#*=}
  env $X npx vitest run frontend/modules/seedlingDemo/fidelityL40Bk2.test.js frontend/modules/seedlingDemo/fidelityL40Latch.test.js frontend/modules/seedlingDemo/fidelityL40Res.test.js frontend/modules/seedlingDemo/hammerChooserPair.test.js frontend/modules/seedlingDemo/hammerGhostKillRung.test.js frontend/modules/seedlingDemo/hammerPressKillChasers.test.js frontend/modules/seedlingDemo/hammerPressKillGuards.test.js frontend/modules/seedlingDemo/hammerStrikeEtaFloor.test.js > "$O/bounded8-$name.txt" 2>&1; echo "bounded8 $name rc=$?"
done
