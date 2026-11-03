#!/bin/bash
# bounded vitest by path (⚖ 52): BEFORE at the base worktree, AFTER OFF/ON at the head
CB=/tmp/claude-0/cb
run() { # dir tag config listfile env
  local dir=$1 tag=$2 cfg=$3 list=$4; shift 4
  ( cd $dir && env "$@" npx vitest run $cfg --reporter=json --outputFile=$CB/bounded-$tag.json $(cat $list) > $CB/bounded-$tag.log 2>&1 )
  echo "$tag exit $?" >> $CB/bounded-status.txt
}
: > $CB/bounded-status.txt
run /tmp/claude-0/base base-fast "" $CB/bounded-fast-base.txt X=1
run /home/user/Archipelago-CC off-fast "" $CB/bounded-fast.txt SEEDLING_CORPSE_BUMP_REST_READ=0
run /home/user/Archipelago-CC on-fast "" $CB/bounded-fast.txt SEEDLING_CORPSE_BUMP_REST_READ=1
run /tmp/claude-0/base base-slow "-c vitest.slow.config.js" $CB/bounded-slow-base.txt X=1
run /home/user/Archipelago-CC off-slow "-c vitest.slow.config.js" $CB/bounded-slow.txt SEEDLING_CORPSE_BUMP_REST_READ=0
run /home/user/Archipelago-CC on-slow "-c vitest.slow.config.js" $CB/bounded-slow.txt SEEDLING_CORPSE_BUMP_REST_READ=1
echo ALLDONE >> $CB/bounded-status.txt
