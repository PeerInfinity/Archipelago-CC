#!/usr/bin/env bash
# rules-lavatrap-neck: the unit rows' mutations m1-m5, each applied to a scratch copy of the module, the bounded test file run,
# and the module restored. Run from the repo root: bash CC/docs/cloud-reports/rules-lavatrap-neck-evidence/tools/mutations.sh
set -u
F=scripts/procgen/seedlingTrapTongueGuard.js
ORIG=$(mktemp)
cp "$F" "$ORIG"
sub() { python3 -c "import sys;p=sys.argv[1];s=open(p).read();o,n=sys.argv[2],sys.argv[3];assert o in s,o;open(p,'w').write(s.replace(o,n,1))" "$F" "$1" "$2"; }
run() { echo "== $1"; npx vitest run scripts/procgen/seedlingTrapTongueGuard.test.js 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "FAIL .*>|Tests "; cp "$ORIG" "$F"; }
sub "    if (sealed && sealed.length === 0) return { grid, traps, sealed };" ""; run "m1 discsSeal ignored (every disc stamped)"
sub "const seen = pixelFlood(room, seed.points, enterable, (i) => masks.some((m) => m[i] === 1));" "const seen = pixelFlood(room, seed.points, enterable, () => false);"; run "m2 the flood does not avoid live reaches"
sub "for (const id of dead) { live.delete(id); killedFrom.get(id).push(seed.name); }" "for (const id of dead) { killedFrom.get(id).push(seed.name); } if (dead.every((id) => killedFrom.get(id).filter((n) => n === seed.name).length > 1)) break; for (const id of dead) live.add(id);"; run "m3 a killed trap stays live"
sub "        for (let k = chompRange + 1; k <= searchPx; k += 1) {" "        for (let k = 1; k <= searchPx; k += 1) {"; sub "            if (Math.floor(Math.hypot(p[0] - cx, p[1] - cy)) <= chompRange) continue;" ""; run "m4 the spot search starts inside the disc"
sub "export const tongueKills = (tag, classes = TONGUE_KILL_CLASSES) => classes[tag]?.kills === true;" "export const tongueKills = () => true;"; run "m5 tongueKills ignores the class table"
cmp -s "$ORIG" "$F" && echo "module restored"
rm -f "$ORIG"
