#!/bin/bash
# MEASUREMENT-ONLY (f1-refusal): five vs five+RSB over the requests, the 16-seam sweep and the 18 L40 fixtures.
cd /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/tools
VARIANTS="five fiversb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/req-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/req.jsonl 3
VARIANTS="five fiversb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/sweep-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/sweep.jsonl 3
VARIANTS="five fiversb" bash matrix.sh /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/fx-jobs.txt /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/fx.jsonl 3
echo CHAIN-DONE > /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/chain.done
