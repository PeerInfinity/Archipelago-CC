#!/bin/bash
until grep -aq "^exit" /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-before-slow.log 2>/dev/null; do sleep 20; done
for t in head:/home/user/Archipelago-CC licence:/home/user/wt-licence; do n=${t%%:*}; d=${t#*:}
cd $d && timeout 5400 npx vitest run $(cat /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/bounded-fast.txt) --reporter=json --outputFile=/tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-$n.json > /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-$n.log 2>&1; echo "exit $?" >> /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-$n.log
cd $d && timeout 3600 npx vitest run --config vitest.slow.config.js frontend/modules/seedlingDemo/fidelityL32ArenaPrefix.slow.test.js > /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-$n-slow.log 2>&1; echo "exit $?" >> /tmp/claude-0/-home-user-Archipelago-CC/a71aea9f-a27e-5ef2-967b-faaa761a4364/scratchpad/vitest-$n-slow.log
done
