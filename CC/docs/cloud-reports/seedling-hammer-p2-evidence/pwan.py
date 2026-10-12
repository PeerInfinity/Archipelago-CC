import json,sys,collections
L=json.load(open(sys.argv[1]))
tot=collections.Counter(); ms=collections.Counter(); n=collections.Counter()
for r in L: tot[r['c']]+=1; ms[r['c']]+=r['ms']; n[r['c']]+=r['n']
print('calls',dict(tot)); print('ms',{k:round(v) for k,v in ms.items()}); print('samples',dict(n))
ticks=sorted(set(r['t'] for r in L)); print('ticks with previews',len(ticks))
# within-tick duplicates (same t, same state, same target) across callers
seen={}; dup=collections.Counter(); dupms=collections.Counter()
for r in L:
    k=(r['t'],r['s'],r['x'],r['y'])
    if k in seen: dup[(seen[k],r['c'])]+=1; dupms[(seen[k],r['c'])]+=r['ms']
    else: seen[k]=r['c']
print('within-tick dup (first,second):',dict(dup),{k:round(v) for k,v in dupms.items()})
# cross-tick: same state (all fields) and target as any earlier tick
seen2={}; cross=collections.Counter(); crossms=collections.Counter(); crosssame=collections.Counter()
for r in L:
    k=(r['s'],r['x'],r['y'])
    if k in seen2 and seen2[k][0]!=r['t']:
        cross[r['c']]+=1; crossms[r['c']]+=r['ms']
        if seen2[k][1]==(r['n'],r['tr']): crosssame[r['c']]+=1
    seen2.setdefault(k,(r['t'],(r['n'],r['tr'])))
print('cross-tick same state+target:',dict(cross),{k:round(v) for k,v in crossms.items()},'same result:',dict(crosssame))
# state repeats tick to tick
st={}
for r in L: st.setdefault(r['t'],r['s'])
rep=sum(1 for a,b in zip(ticks,ticks[1:]) if st[a]==st[b]); print('consecutive preview-ticks with identical state',rep,'of',len(ticks)-1)
# refuge waste past best
w=0; wn=0; trunc=collections.Counter()
for r in L:
    if r['c']=='R':
        trunc[r['tr']]+=1
        if r['best'] is not None and r['n']>r['best']: w+=r['n']-r['best']-1; wn+=1
print('refuge truncations',dict(trunc),'previews past best',wn,'samples past best+1',w)
st2=collections.Counter(r['tr'] for r in L if r['c']!='R'); print('strike truncations',dict(st2))
