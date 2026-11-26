# statuses.py <log> <entry...>: the distinct status sequence (ticks) while each entry is the head; "playing tick a/b" folded
import re,sys
rows=[]
for line in open(sys.argv[1],errors='replace'):
    m=re.search(r'\[MEASURE (?:tick|end)\].*? t=(\d+)s .*?botCursor=(\d+) .*?status="((?:[^"\\]|\\.)*)"',line)
    if m: rows.append((int(m.group(1)),int(m.group(2))+1,m.group(3)))
for e in map(int,sys.argv[2:]):
    print(f"== entry {e}"); prev=None
    for t,k,s in rows:
        if k!=e: continue
        s2=re.sub(r'playing tick \d+/(\d+)',r'playing tick …/\1',s).replace('\\"','"')
        s2=re.sub(r'^(Sphere [\d.]+ → )','',s2)[:230]
        if s2!=prev: print(f"  t={t}s {s2}"); prev=s2
