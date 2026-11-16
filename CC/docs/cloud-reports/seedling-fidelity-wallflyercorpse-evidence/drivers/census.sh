#!/bin/bash
# census.sh <tag> : the 32 wallflyer-room sweep keys, 3 in parallel; env passes through. REPO = the scratch head worktree.
S=/tmp/claude-0/-home-user-Archipelago-CC/b6ef35e4-454d-5cb1-bc72-e179e41fe92e/scratchpad
export S TAG="$1"
mkdir -p "$S/census/$TAG"
i=0; while IFS= read -r k; do i=$((i+1)); printf '%s\t%s\n' "$i" "$k"; done < "$S/wf-keys.txt" | \
  xargs -P 3 -d '\n' -I{} bash -c 'n=$(printf "%s" "{}" | cut -f1); k=$(printf "%s" "{}" | cut -f2-); REPO=$S/head timeout 900 node $S/inv-leg.mjs --legs=$S/sweep/legs/legs.jsonl --rows=$S/sweep/merged/merged/rows.jsonl --dump=$S/sweep/merged/merged/delivered-set.json "--key=$k" > "$S/census/$TAG/$n.json" 2>/dev/null || echo "{\"key\":\"$k\",\"crash\":true}" > "$S/census/$TAG/$n.json"'
echo DONE > "$S/census/$TAG.done"
