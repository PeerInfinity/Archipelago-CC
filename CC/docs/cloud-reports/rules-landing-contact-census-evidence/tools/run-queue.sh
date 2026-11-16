#!/usr/bin/env bash
# rules-landing-contact-census: the game runs, in order (each takes the box lock in turn). From the evidence dir.
set -u
T=tapes; O=runs/game
mkdir -p $O
node tools/play.mjs --spot=vanilla --arrivals=73:64:16,73:32:128 --out=$O > runs/play-vanilla-arrivals.log 2>&1
node tools/play.mjs --spot=delivered --arrivals=73:64:16,73:32:128 --out=$O > runs/play-delivered-arrivals.log 2>&1
node tools/play.mjs --spot=delivered --out=$O --tapes=$T/l73-north-sword-delivered.tape.json,$T/l73s-sword-east@delivered.tape.json,$T/l73s-fire@delivered.tape.json,$T/l73n-fire-bulb@delivered.tape.json > runs/play-delivered-crossings.log 2>&1
node tools/play.mjs --spot=vanilla --out=$O --tapes=$T/l73-north-sword-vanilla.tape.json,$T/l73s-sword-east@vanilla.tape.json > runs/play-vanilla-crossings.log 2>&1
node tools/play.mjs --spot=40,0 --arrivals=73:64:16,73:32:128 --out=$O > runs/play-alt-40-0.log 2>&1
node tools/play.mjs --spot=72,64 --arrivals=73:64:16,73:32:128 --out=$O > runs/play-alt-72-64.log 2>&1
echo QUEUE-DONE
