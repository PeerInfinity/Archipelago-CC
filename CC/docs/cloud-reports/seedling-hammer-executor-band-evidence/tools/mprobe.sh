#!/bin/bash
# mprobe.sh <T1> <T2> <tag>: the scratch tree at 5243 (defaults) and 5252-5254 (bombs OFF)
cd /tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad
BX_ROOT=/tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad/m BX_T1=$1 BX_T2=$2 node tools/l371-multi.mjs --requests=/tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad/w0/req-371.jsonl --seams=5243-5243 | grep '^RESULT ' | cut -c8- > m-probe/$3-default.jsonl
BX_ROOT=/tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad/m BX_T1=$1 BX_T2=$2 SEEDLING_PRESS_KILL_BOMBS=0 node tools/l371-multi.mjs --requests=/tmp/claude-0/-home-user-Archipelago-CC/b6e76d03-4047-53b1-b9e6-3aa5346b97cd/scratchpad/w0/req-371.jsonl --seams=5252-5254 | grep '^RESULT ' | cut -c8- > m-probe/$3-pkb0.jsonl
