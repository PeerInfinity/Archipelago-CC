# replay-table.py <replay dir>: one line per replay file pair: the REPLAY line, run-0 answer/work, live answer; and the counts' result/play
import json,re,sys,os,glob
d=sys.argv[1]
for f in sorted(glob.glob(f"{d}/*.txt")):
    n=os.path.basename(f)[:-4]
    if n.startswith('counts-'): continue
    t=open(f,errors='replace').read()
    rows=[json.loads(l[4:]) for l in t.splitlines() if l.startswith('ROW ')]
    rep=next((l for l in t.splitlines() if l.startswith('REPLAY:')),'(no REPLAY line)')
    live=re.search(r'LIVE: .*?"answer":"(\w+)"',t)
    a=sorted({r['answer'] for r in rows}); w=sorted({r['work'] for r in rows})
    c=open(f"{d}/counts-{n}.txt",errors='replace').read() if os.path.exists(f"{d}/counts-{n}.txt") else ''
    res=re.search(r'  result (.*)',c); 
    print(f"{n:16} {rep.split(': ',1)[1] if ': ' in rep else rep} | answers={a} work={w} live={live.group(1) if live else None} | counts: {res.group(1)[:220] if res else '-'}")
