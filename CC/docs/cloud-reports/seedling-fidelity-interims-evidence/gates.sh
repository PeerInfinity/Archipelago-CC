#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/6f8cb257-c0d0-5512-9faf-5f8714505200/scratchpad
FILES=$(cat $S/bounded.txt)
cd /home/user/Archipelago-CC && timeout 5400 npx vitest run $FILES > $S/logs/vitest-after.log 2>&1; echo "exit $?" >> $S/logs/vitest-after.log
cd $S/base && timeout 5400 npx vitest run $FILES > $S/logs/vitest-before.log 2>&1; echo "exit $?" >> $S/logs/vitest-before.log
echo done > $S/logs/gates.done
