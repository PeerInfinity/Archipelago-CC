#!/bin/bash
# MEASUREMENT-ONLY: one request/variant → one summary line. args: label capfile id i ; env passes through.
S=${SCRATCH:?}
cd /home/user/Archipelago-CC || exit 1
lab=$1; shift
out=$(WIN=0,0 ROWLO=0 ROWHI=0 node --import $S/trace-reg.mjs $S/probe1.mjs "$@" 2>&1)
ok=$(echo "$out" | grep -a '^ok' | cut -c1-30)
hits=$(echo "$out" | grep -a '^OWNER seg 0' | sed 's/.*HIT \(t[0-9]* [^ ]*\) <- \([0-9]*\) {"verb":"\([a-z]*\)".*/\1 [\3@\2]/' | tr '\n' ';')
[ -z "$ok" ] && ok="REFUSED $(echo "$out" | grep -a -m1 'solverBot(' | cut -c1-160)"
echo "$lab | $ok | hits: ${hits:-none}"
