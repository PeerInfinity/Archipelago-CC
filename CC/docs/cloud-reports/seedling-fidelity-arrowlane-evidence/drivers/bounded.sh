# usage: bounded.sh <tree> <out> [env...]
tree=$1; out=$2; shift 2
cd $tree
files=$(while read f; do [ -f "$f" ] && echo $f; done < /tmp/claude-0/w/bounded2.txt)
env "$@" npx vitest run $files --reporter=json --outputFile=$out > $out.log 2>&1
echo "exit $?" >> $out.log
