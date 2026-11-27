cd /home/user/Archipelago-CC
export SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS=1 SEEDLING_PULSER_DEAD_FRAME_UPDATE=1 SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME=1
O=/tmp/claude-0/sweep-out; mkdir -p $O; : > $O/summary.txt
split -l 30 -d /tmp/claude-0/sweep-fast.txt $O/batch-
for b in $O/batch-*; do
  [ "${b##*.}" = "log" ] && continue
  npx vitest run $(cat $b | tr '\n' ' ') --maxWorkers=3 > $b.log 2>&1
  echo "$(basename $b): $(sed 's/\x1b\[[0-9;]*m//g' $b.log | grep -aE '^\s+Tests ' | tail -1)" >> $O/summary.txt
done
while read f; do
  cfg=vitest.slow.config.js; case "$f" in *.train.*) cfg=vitest.train.config.js;; esac
  npx vitest run --config $cfg "$f" > $O/heavy-$(basename $f).log 2>&1
  echo "heavy $f: $(sed 's/\x1b\[[0-9;]*m//g' $O/heavy-$(basename $f).log | grep -aE '^\s+Tests ' | tail -1)" >> $O/summary.txt
done < /tmp/claude-0/sweep-heavy.txt
echo DONE >> $O/summary.txt
