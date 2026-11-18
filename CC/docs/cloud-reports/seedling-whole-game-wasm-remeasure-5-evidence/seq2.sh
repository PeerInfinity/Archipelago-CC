#!/bin/bash
until [ -s /tmp/claude-0/-home-user-Archipelago-CC/9f8d4571-911f-5f1e-81f6-c0a589d9556d/scratchpad/logs/seq1.done ]; do sleep 20; done
/tmp/claude-0/-home-user-Archipelago-CC/9f8d4571-911f-5f1e-81f6-c0a589d9556d/scratchpad/run-arm.sh A3
echo SEQ2-DONE >> /tmp/claude-0/-home-user-Archipelago-CC/9f8d4571-911f-5f1e-81f6-c0a589d9556d/scratchpad/logs/seq2.done
