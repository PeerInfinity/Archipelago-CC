# the mutants of TURRET_APPROACH_VOLLEY_ORDER: mutants.py <solverBot.js> <M1|M2|M3|M4> rewrites the file in place (restore from a copy)
import sys
p, m = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf8', newline='').read()
def rep(a, b):
    global s
    assert s.count(a) == 1, (m, a)
    s = s.replace(a, b)
if m == 'M1':   # the wait order reverted: ascending whatever the anchor
    rep("    if (anchor === null) return all;\n", "    if (anchor !== undefined) return all;\n")
elif m == 'M2': # rank by rank reverted: a route's every wait before the next route's first (depth-first)
    rep("            if (rank >= rt.order.length) continue;\n            const record = attempt(rt.side, rt.via, rt.order[rank], { order: 'volley', anchor: rt.anchor, rank });\n            if (record === DONE) continue;\n            if (record !== null) return record;\n            next.push(rt);\n",
        "            for (let k = 0; k < rt.order.length; k += 1) {\n                const record = attempt(rt.side, rt.via, rt.order[k], { order: 'volley', anchor: rt.anchor, rank: k });\n                if (record === DONE) break;\n                if (record !== null) return record;\n            }\n")
elif m == 'M3': # the anchor never read off the turret's clock
    rep("        if (now === 'startshot' && was !== 'startshot') return i;\n", "        if (now === 'startshot' && was !== 'startshot') continue;\n")
elif m == 'M4': # the switch not read: OFF's loop under ON
    rep("    if (TURRET_APPROACH_VOLLEY_ORDER.enabled) {\n", "    if (TURRET_APPROACH_VOLLEY_ORDER.enabled && false) {\n")
open(p, 'w', encoding='utf8', newline='').write(s)
