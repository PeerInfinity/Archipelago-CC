#!/bin/bash
# SCRATCH (seedling-hammer-sf): run "<ROOT> <TAG> <mode> <workload>" lines from a file, $PAR at a time, via sf2-run.sh.
S=${S:-/tmp/claude-0/sf2}
xargs -P ${PAR:-1} -L 1 sh -c 'ROOT=$0 TAG=$1 bash '$S'/tools/sf2-run.sh $2 $3' < "$1"
echo "QUEUE DONE $1"
