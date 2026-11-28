"""Per goal (level, kind, boot): the JS walk's SOLVED answers vs the wasm walks'. usage: solvecmp.py <js.solves> <wasm.solves>..."""
import re, sys
def goals(path):
    g = {}
    for l in open(path):
        m = re.match(r'\S+ #(\d+) (\S+) .*?boot=(\{[^}]*\}) row=\S+ -> (SOLVED|REFUSED) (\w+)', l)
        if not m: continue
        seq, name, boot, verdict, ans = m.groups()
        lv = re.search(r'(?:L|-)(\d+)(?:-|$)', name.replace('js-runtime-', '-'))
        kind = 'continue' if 'continue' in name else ('exit' if 'exit' in name else 'location')
        key = (int(re.search(r'\d+', name.split('-L')[-1] if 'js-runtime' in name else name.split('-')[-1]).group()), kind)
        g.setdefault(key, []).append((verdict, ans, int(seq), boot))
    return g
js = goals(sys.argv[1]); wasm = {}
for p in sys.argv[2:]:
    for k, v in goals(p).items(): wasm.setdefault(k, []).extend(v)
same = diff = 0
for k in sorted(js):
    js_sol = [a for v, a, *_ in js[k] if v == 'SOLVED']
    w_sol = {a for v, a, *_ in wasm.get(k, []) if v == 'SOLVED'}
    hits = [a for a in js_sol if a in w_sol]
    if not js_sol: continue
    tag = 'SAME' if hits else ('no wasm solve' if not w_sol else 'DIFF')
    same += bool(hits); diff += (tag == 'DIFF')
    print(f'L{k[0]:<3} {k[1]:<8} JS {",".join(js_sol)}  wasm {",".join(sorted(w_sol)) or "-"}  {tag}')
print(f'goals with a JS solve also played by wasm: {same}; differing: {diff}')
