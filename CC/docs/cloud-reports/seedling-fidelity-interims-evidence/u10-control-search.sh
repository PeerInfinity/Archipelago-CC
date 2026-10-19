cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/6f8cb257-c0d0-5512-9faf-5f8714505200/scratchpad
for x in 384 392 400 408 424 432 440 448; do for y in 232 240 248 256 264 272 280; do
 r=$(BX=$x BY=$y SCRATCH_OUT=$S/out/u10s node scripts/procgen/zz-scratch-u10-search.mjs 2>&1 | grep -a "positive\|BY THE PUNCH\|PUNCHED at\|alive" | sed -n '1,3p' | cut -c1-12 | tr '\n' ' ')
 echo "$x,$y $r"
done; done > $S/logs/u10search.txt
echo DONE >> $S/logs/u10search.txt
