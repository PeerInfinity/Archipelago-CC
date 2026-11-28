"""JS vs wasm solve-request field diff (seedling-js-boot-rng-clock). usage: reqdiff.py <all.jsonl> <J1.sel.jsonl>"""
import json, sys
reqs = {}
for r in map(json.loads, open(sys.argv[1])):
    parts = r['key'].split(' '); reqs[parts[1] if parts[0].startswith(('held#','l57#')) else parts[0]] = r['requests'][0]['request']
for o in map(json.loads, open(sys.argv[2])):
    reqs[f"new-J1#{o['seq']}"] = o['requests'][0]['request']
def norm(rq):
    rq = json.loads(json.dumps(rq))
    st = rq.get('staging', {})
    if isinstance(st.get('persistence'), list):
        st['persistence'] = sorted(json.dumps(p, sort_keys=True) for p in st['persistence'])
    if isinstance(st.get('pins'), list): st['pins'] = sorted(st['pins'])
    rq.pop('name', None)
    return rq
def walk(a, b, p, out):
    if type(a) != type(b): out.append((p, a, b)); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append((f'{p}.{k}', a.get(k, '<absent>'), b.get(k, '<absent>')))
            else: walk(a[k], b[k], f'{p}.{k}', out)
    elif isinstance(a, list):
        if p.endswith('persistence'):
            sa, sb = set(a), set(b)
            if sa != sb: out.append((p, f'{len(a)} rows (-{len(sb - sa)} vs wasm)', f'{len(b)} rows'))
            return
        if len(a) != len(b): out.append((p, f'len {len(a)}', f'len {len(b)}')); return
        for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f'{p}[{i}]', out)
    elif a != b: out.append((p, a, b))
PAIRS = [
    ('L22 a0', 'diagJ1#70', 'new-J1#67', 'diagW2#45'),
    ('L40 item 1 a0', 'tipJ1#125', 'new-J1#133', 'diagW2#93'),
    ('L40 item 2 continuation', 'tipJ1#127', 'new-J1#135', 'diagW2#95'),
    ('L40 item 2 fresh', None, 'new-J1#136', 'diagW2#96'),
    ('L57 exit', 'J1#163', 'new-J1#167', 'W1#118'),
]
def short(v):
    s = json.dumps(v) if not isinstance(v, str) else v
    return s if len(s) <= 90 else s[:87] + '...'
for name, old, new, w in PAIRS:
    print(f'## {name}: wasm {w}')
    for lab, k in (('BEFORE (base JS)', old), ('NOW (this slice)', new)):
        if k is None: print(f'  {lab}: (no base JS request at this goal)'); continue
        out = []; walk(norm(reqs[k]), norm(reqs[w]), '', out)
        print(f'  {lab} {k}: {len(out)} differing field(s)')
        for p, a, b in out:
            if p.startswith('.source') or p.startswith('.live'): 
                print(f'    {p}: (differs)'); continue
            print(f'    {p}: JS {short(a)} | wasm {short(b)}')
