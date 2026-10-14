#!/bin/bash
# ctl.sh <tag> [env...] — r9-campaign --check in the lab worktree
cd /tmp/claude-0/c4b/wt
tag=$1; shift
env "$@" node scripts/procgen/solve-seedling-r9-campaign.mjs --check > /tmp/claude-0/c4b/runs/ctl-$tag.txt 2>&1
e=$?
echo "$tag $(grep -av '^# box lock:' /tmp/claude-0/c4b/runs/ctl-$tag.txt | md5sum | cut -c1-8) exit $e"
