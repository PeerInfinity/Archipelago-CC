#!/bin/bash
# mcensus.sh <root> <outdir> <tag> [env...]: 5226-5280 in 2 chunks per arm (one process per chunk), both arms
root=$1; out=$2; tag=$3; shift 3; mkdir -p $out; cd /tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad
for arm in default pkb0; do
  ex=""; [ $arm = pkb0 ] && ex="SEEDLING_PRESS_KILL_BOMBS=0"
  for ch in 5226-5253 5254-5280; do
    env "$@" $ex BX_ROOT=$root node tools/l371-multi.mjs --requests=/tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad/w0/req-371.jsonl --seams=$ch | grep '^RESULT ' | cut -c8- > $out/$tag-$arm-$ch.part &
  done
done
wait
for arm in default pkb0; do cat $out/$tag-$arm-*.part > $out/$tag-$arm.jsonl; done
echo DONE > $out/$tag.done
