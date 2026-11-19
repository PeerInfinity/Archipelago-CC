#!/bin/bash
# spot.sh <out.jsonl> — OFF and claim-alone spot checks at this base, to set against L40-CORNER's full sweeps at f43e2de82a
# (the code between the two bases is an OFF-only fidelity key): per fixture a solved clock, a hit-taking/lost one, a refusal.
out=$1; T=$(dirname "$0")
{ for s in 5213 5225 5241 5247 5250; do echo "off flag12-L39 $s"; echo "claim flag12-L39 $s"; done
  for s in 5213 5214 5232 5244; do echo "off flag12-L43 $s"; echo "claim flag12-L43 $s"; done
  for s in 5220 5242 5247; do echo "off chest-L39 $s"; echo "claim chest-L39 $s"; done; } \
 | CAP=${CAP:-300} xargs -P4 -n3 sh -c 'e=""; [ $0 = claim ] && e=SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1; l=$(env $e timeout '"${CAP:-300}"' node '"$T"'/seam.mjs --fx=$1 --seam=$2 --budget=2560 2>/dev/null) || l="{\"fx\":\"$1\",\"seam\":$2,\"arm\":\"$0\",\"cap\":true}"; printf "%s\n" "$l"' >> "$out"
