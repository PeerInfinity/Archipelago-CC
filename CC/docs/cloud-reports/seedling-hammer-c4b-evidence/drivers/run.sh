#!/bin/bash
# run.sh <tag> <id> [env...]  — lab leg run; writes runs/<tag>.json, .err, .sink.jsonl
cd /tmp/claude-0/c4b
tag=$1; id=$2; shift 2
env "$@" REPO=/tmp/claude-0/c4b/lab BUDGET=2560 SINK=runs/$tag.sink.jsonl timeout 1500 node labrun.mjs --id=$id > runs/$tag.json 2> runs/$tag.err
echo "$tag rc=$?"
