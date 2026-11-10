# print the tick each listed bob's hits change, for a solved plan
S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
cd /home/user/Archipelago-CC
env "$@" timeout 900 node $S/tools/near.mjs --requests=$REQ --id=$ID --i=$I --from=1 --to=99999 --fam=chasers --dump=1 --r=9999 $XARGS 2>&1 | python3 -c '
import sys,json,re
last={}
for l in sys.stdin:
    if l.startswith("answer") or l.startswith("hits"): print(l.strip()[:400]); continue
    m=re.match(r"t(\d+) p=\(([^)]*)\) keys=(\S*)",l)
    if not m: continue
    for js in re.findall(r"\{\"id\".*?\"alpha\":[^}]*\}",l):
        e=json.loads(js); k=(e["hits"],e["dying"],e["destroy"])
        if last.get(e["id"])!=k: print("t"+m.group(1),"p=("+m.group(2)+")",m.group(3),e["id"],"hits",e["hits"],"timer",e["hitsTimer"],"dying",e["dying"],"at",e["x"],e["y"]); last[e["id"]]=k
'
