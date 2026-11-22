#!/usr/bin/env bash
# rules-wand-chaser-killarm-census: per row × column, wsim beam (two score weights) → candidate tapes → the GAME.
#   tools/wand/batch.sh <col: wand|firewand> <row,row,...|all> [width] [depth]
set -u
cd "$(dirname "$0")/../.."
COL=$1; ROWS=$2; W=${3:-300}; D=${4:-200}
case $COL in wand) ITEMS=hasWand;; firewand) ITEMS=hasWand,hasFire,hasFireWand;; *) echo bad col; exit 2;; esac
[ "$ROWS" = all ] && ROWS=$(python3 -c "import json;print(','.join(json.load(open('tools/wand/rows.json'))))")
OUTT=${OUTT:-tapes/q2}; OUTR=${OUTR:-runs/q2}; mkdir -p $OUTT $OUTR
for r in ${ROWS//,/ }; do
  read -r BOOT GOAL PAIR < <(python3 -c "import json;r=json.load(open('tools/wand/rows.json'))['$r'];print(r['boot'],r['goal'],','.join(r['pair']))")
  IT=$ITEMS; [ -n "$PAIR" ] && IT="$ITEMS,$PAIR"
  for kw in 6 20; do
    timeout 600 node tools/wand/wsim.mjs --boot=$BOOT --goal=$GOAL --items=$IT --width=$W --depth=$D --killw=$kw --wins=2 \
      --out=$OUTT/$r-$COL-k$kw.tape.json > $OUTR/$r-$COL-k$kw.wsim.log 2>&1
    echo "$r $COL k$kw $(cut -c1-160 $OUTR/$r-$COL-k$kw.wsim.log | head -2 | tr '\n' ' ')"
  done
done
