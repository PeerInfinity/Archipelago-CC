import json,sys,re
from collections import Counter
def walk(a,b,p,out):
    if isinstance(a,dict) and isinstance(b,dict):
        for k in sorted(set(a)|set(b),key=str):
            q=f"{p}/{k}"
            if k not in a: out.append(('ADD',q,None,b[k]))
            elif k not in b: out.append(('DEL',q,a[k],None))
            else: walk(a[k],b[k],q,out)
    elif isinstance(a,list) and isinstance(b,list) and len(a)==len(b):
        for i,(x,y) in enumerate(zip(a,b)): walk(x,y,f"{p}[{i}]",out)
    elif a!=b: out.append(('CHG',p,a,b))
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
out=[]; walk(a,b,'',out)
atlas=[o for o in out if o[0]=='CHG' and isinstance(o[2],str) and re.fullmatch(r'seedling-[0-9a-f]{8}',o[2])]
rest=[o for o in out if o not in atlas]
print(f"{len(out)} differences; {len(atlas)} are atlas-id CHG {Counter((o[2],o[3]) for o in atlas)}")
for o in rest: print(o[0],o[1],json.dumps(o[2])[:400] if o[2] is not None else '',' -> ',json.dumps(o[3])[:400] if o[3] is not None else '')
