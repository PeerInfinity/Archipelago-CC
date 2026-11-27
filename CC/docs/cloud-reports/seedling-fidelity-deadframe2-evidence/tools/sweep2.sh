cd /home/user/Archipelago-CC
export SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS=1 SEEDLING_PULSER_DEAD_FRAME_UPDATE=1 SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME=1
O=/tmp/claude-0/sweep-out; mkdir -p $O/claims
while read f; do
  mkdir $O/claims/$(basename $f) 2>/dev/null || continue
  cfg=vitest.slow.config.js; case "$f" in *.train.*) cfg=vitest.train.config.js;; esac
  npx vitest run --config $cfg "$f" > $O/heavy-$(basename $f).log 2>&1
  echo "heavy $f: $(sed 's/\x1b\[[0-9;]*m//g' $O/heavy-$(basename $f).log | grep -aE '^\s+Tests ' | tail -1)" >> $O/summary.txt
done < /tmp/claude-0/sweep-heavy-rest.txt
echo "STREAM-DONE $1" >> $O/summary.txt
