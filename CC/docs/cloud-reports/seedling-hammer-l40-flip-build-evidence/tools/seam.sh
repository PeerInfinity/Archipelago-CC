# seam.sh <label> <req> <id> <i> <from..to> [ENV...]
S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
l=$1 req=$2 id=$3 i=$4 rng=$5; shift 5
cd /home/user/Archipelago-CC
env "$@" node scripts/procgen/replay-seedling-solve-request.mjs --requests=$req --id=$id --i=$i --seam-time-sweep=$rng --jobs=${JOBS:-2} --out=$S/m/seam-$l-$id-$i.jsonl > $S/m/seam-$l-$id-$i.txt 2>&1
