#!/bin/bash
# SCRATCH (seedling-hammer-sf): run "<ROOT> <TAG> <mode> <workload>" lines from a file, $PAR at a time, via sf-run.sh.
S=${S:-/tmp/claude-0/-home-user-Archipelago-CC/7ab4ddbb-3ffa-5d06-91ee-6935e4e4988c/scratchpad}
xargs -P ${PAR:-1} -L 1 sh -c 'ROOT=$0 TAG=$1 bash '$S'/tools/sf-run.sh $2 $3' < "$1"
echo "QUEUE DONE $1"
