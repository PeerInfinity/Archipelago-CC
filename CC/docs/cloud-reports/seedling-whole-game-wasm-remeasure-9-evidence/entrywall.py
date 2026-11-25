# per-entry wall from [MEASURE tick|end]: entry k = head while botCursor == k-1 (15 s tick granularity)
import re,sys
first={};last=None;heads={};end=None
for line in open(sys.argv[1],errors='replace'):
    m=re.search(r'\[MEASURE (tick|end)\].*? t=(\d+)s .*?botCursor=(\d+) .*?botHead="((?:[^"\\]|\\.)*)"',line)
    if not m: continue
    kind,t,c,h=m.group(1),int(m.group(2)),int(m.group(3)),m.group(4)
    e=c+1; first.setdefault(e,t); heads.setdefault(e,h); last=(e,t)
    if kind=='end': end=t
ks=sorted(first)
want=[int(x) for x in sys.argv[2:]] or ks
for k in want:
    if k not in first: print(f"entry {k}: never head"); continue
    nxt=[first[j] for j in ks if j>k]
    if nxt: print(f"entry {k} {heads[k]!r}: head {first[k]}s -> next {nxt[0]}s = ~{nxt[0]-first[k]} s (passed)")
    else: print(f"entry {k} {heads[k]!r}: head {first[k]}s -> end {end}s = ~{(end or last[1])-first[k]} s (the stop)")
