import re,sys
seen={};names={}
for line in open(sys.argv[1],errors='replace'):
    m=re.search(r'\[MEASURE (?:tick|end)\].*? t=(\d+)s .*?regionChanges=(\d+) .*?status="(.*)"',line)
    if not m: continue
    t,r,st=m.groups()
    for e in re.finditer(r'(?:"([^"\\]+)\\?" )?\((\d+)/48\)',st):
        n=int(e.group(2))
        if n not in seen: seen[n]=(t,r)
    for e in re.finditer(r'(?:walking to|to location) \\"([^"\\]+)\\" \((\d+)/48\)',st):
        names.setdefault(int(e.group(2)),e.group(1))
print(' '.join(f'{n}@{t}s/r{r}' for n,(t,r) in sorted(seen.items())))
for n in sorted(names): print(n,names[n])
