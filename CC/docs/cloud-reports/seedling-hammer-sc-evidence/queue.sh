#!/bin/bash
# SCRATCH (seedling-hammer-sc): run "<mode> <workload>" lines from a file, $PAR at a time, each via sc-run.sh.
S=${S:-/tmp/claude-0/-home-user-Archipelago-CC/507826ac-12b4-5994-a664-5fe07cb34f34/scratchpad}
xargs -P ${PAR:-1} -L 1 bash $S/tools/sc-run.sh < "$1"
echo "QUEUE DONE $1"
