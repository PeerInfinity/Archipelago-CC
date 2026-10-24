import json,re,sys
d=json.load(open(sys.argv[1]))
prev={s[0]:s for s in d['samples']}
drive={}
for line in open(sys.argv[2]):
    m=re.match(r'(\d+) P\(([-\d.]+),([-\d.]+)\) (\S*)\s*(.*)',line)
    if m:
        b={}
        for part in m.group(5).split(' | '):
            mm=re.match(r'(\S+):\(([-\d.]+),([-\d.]+)\) h(\d+)/(\d+)',part)
            if mm: b[mm.group(1)]=(float(mm.group(2)),float(mm.group(3)))
        drive[int(m.group(1))]=(float(m.group(2)),float(m.group(3)),b)
nb=0;fb=None;npl=0;fp=None
for t,p in sorted(prev.items()):
    if t-1 in drive and t>=4:
        dv=drive[t-1]
        if abs(p[2]-dv[0])>0.01 or abs(p[3]-dv[1])>0.01:
            npl+=1; fp=fp or (t,p[2:4],dv[:2])
    if t in drive:
        for c in p[4]:
            e=drive[t][2].get(c[0])
            if e and (abs(c[1]-e[0])>0.06 or abs(c[2]-e[1])>0.06):
                nb+=1; fb=fb or (t,c[0],c[1:3],e); break
print('samples',len(prev),'player diffs',npl,'first',fp,'body diffs',nb,'first',fb)
