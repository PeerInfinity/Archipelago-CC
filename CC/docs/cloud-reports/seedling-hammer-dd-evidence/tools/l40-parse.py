"""SCRATCH (seedling-hammer-dd): parse l40-run.sh's jsonl, whose rows `dash`'s echo split at every `\\n` escape.
A row starts at a line beginning '{"id":'; continuation lines are rejoined with a literal \\n."""
import json, re, sys
rows, cur = [], None
for line in open(sys.argv[1], encoding='utf8', errors='replace'):
    line = line.rstrip('\n')
    if line.startswith('{"id":'):
        if cur is not None: rows.append(cur)
        cur = line
    else:
        cur += '\\n' + line
if cur is not None: rows.append(cur)
out = []
for r in rows:
    r = re.sub(r'"wall":\.', '"wall":0.', r)
    r = ''.join(ch if ord(ch) >= 32 else ' ' for ch in r)
    out.append(json.loads(r))
json.dump(out, open(sys.argv[2], 'w'))
print(len(out), 'rows')
