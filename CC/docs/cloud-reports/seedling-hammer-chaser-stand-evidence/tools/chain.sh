#!/bin/bash
# MEASUREMENT-ONLY: wait for the first request matrix, then the HSB request variants, the sweep, the fixtures.
while kill -0 $(cat /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/req.pid) 2>/dev/null; do sleep 20; done
cd /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/tools
VARIANTS="oachsb all4oachsb ppoachsb psoachsb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/req-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/req.jsonl 2
VARIANTS="all4oachsb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/sweep-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/sweep1.jsonl 2
VARIANTS="off oachsb all4 all4oac all4oachsb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/fx-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/fx.jsonl 3
echo CHAIN-DONE > /tmp/claude-0/-home-user-Archipelago-CC/71f3de28-d5be-51d6-97a1-b4b3a0697b79/scratchpad/chain.done
