import json,re,sys
S=sys.argv[1]
src=open('levelRun.js',encoding='utf8',errors='replace').read()
c=json.load(open(f'{S}/census-noshadow.json'))
cs=json.load(open(f'{S}/census.json'))
rows={r['name']:r for r in c['rows']}
rows_s={r['name']:r for r in cs['rows']}
# digest parts
m=re.search(r'const stateDigestParts = .*?\n    \};\n',src,re.S).group(0)
parts={}
for pm in re.finditer(r'(\w+): part\(\{(.*?)\}\)',m,re.S):
    for n in re.findall(r'[A-Za-z_]\w*(?=\s*[,}:]|\s*$)',pm.group(2)):
        parts[n]=pm.group(1)
# also 'now: clock.now()'
parts.setdefault('clock','clock')
decl=[(mm.group(1),src[:mm.start()].count('\n')+1) for mm in re.finditer(r'^    const (\w+) = new Map\(\);',src,re.M)]
for name,line in decl:
    r=rows.get(name); rs=rows_s.get(name)
    rr=r['reachedRead'] if r else []
    rrs=rs['reachedRead'] if rs else []
    w=[u for u in (r['writers'] if r else {}) if u!='<construction>']
    rd=list((r['readers'] if r else {}).keys())
    print(f"{name}\t{line}\t{parts.get(name,'-')}\treach(shadow)={len(rrs)}\treach(noshadow)={len(rr)}:{','.join(rr[:6])}\tW={','.join(w[:8])}\tR={len(rd)}")
