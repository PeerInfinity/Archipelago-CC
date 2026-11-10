# wrap the body of the `it(` at a given line in withL40Flip(false, ...): `it(name, [async] () => {BODY}[, T]);`
import sys,re
path, line = sys.argv[1], int(sys.argv[2])
src = open(path).read()
lines = src.split('\n'); start = sum(len(l)+1 for l in lines[:line-1])
i = src.index('=> {', start)  # the row's arrow body
asyncarrow = src.rfind('async', start, i) != -1 and src.rfind('async', start, i) > src.rfind(',', start, i) - 8
# find the matching close brace, skipping strings / template literals / comments
j = i + 3; depth = 0; n = len(src)
k = j
while k < n:
    c = src[k]
    if c in '\'"`':
        q = c; k += 1
        while src[k] != q:
            if src[k] == '\\': k += 1
            k += 1
    elif src.startswith('//', k): k = src.index('\n', k)
    elif src.startswith('/*', k): k = src.index('*/', k) + 1
    elif c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0: break
    k += 1
close = k
# arrow start: the `(` of `() =>` or `async () =>`
a = src.rfind('async () =>', start, i + 4) if 'async () =>' in src[start:i+4] else src.rfind('() =>', start, i + 4)
head = src[a:i]  # e.g. 'async () ' or '() '
body = src[i+3:close+1]
if head.startswith('async'):
    new = 'async () => withL40Flip(false, async () => ' + body + ')'
else:
    new = '() => withL40Flip(false, () => ' + body + ')'
out = src[:a] + new + src[close+1:]
if "from './l40FlipSet.js'" not in out:
    m = list(re.finditer(r"^import .*?;\n", out, re.M | re.S))[-1]
    out = out[:m.end()] + "import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set\n" + out[m.end():]
open(path, 'w').write(out)
print('wrapped', path, line)
