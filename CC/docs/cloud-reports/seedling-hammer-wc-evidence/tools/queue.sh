#!/bin/bash
# SCRATCH: run "<ROOT> <TAG> <mode> <workload>" lines from a file, $PAR at a time, via wc-run.sh.
S=${S:-/tmp/claude-0/wc}
xargs -P ${PAR:-1} -L 1 sh -c 'ROOT=$0 TAG=$1 bash '$S'/tools/wc-run.sh $2 $3' < "$1"
echo "QUEUE DONE $1"
