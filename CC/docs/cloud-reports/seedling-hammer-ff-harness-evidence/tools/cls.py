import sys,json,re
import glob,os
files=glob.glob(os.path.join(sys.argv[1],'*.json'))
rows=sorted((json.load(open(f)) for f in files if os.path.getsize(f)), key=lambda d:d['seam'])
for d in rows:
    def c(p):
        if p['ok']: return f"SOLVE {p['ticks']}t"
        m=p['message'] or ''
        if 'shadow advanced' in m:
            g=re.search(r'returned (\d+) key set\(s\) but the shadow advanced (\d+)',m); return f"DIVERGE {g.group(1)}/{g.group(2)}"
        return (p['code'] or p['kind'] or '?')+':'+m[:70].replace('\n',' ')
    ff=[(r['how'],r['verdict'],r['t'],r.get('ticks'),r.get('refused')) for r in d.get('ff',[])]
    print(d['seam'], d['seam']%45, 'OK' if d['ok'] else 'NO', d['work'], d['answer'], ' | '.join(c(p) for p in d['passes']), 'FF=',ff)
