#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-digest-audit D1): give a SCRATCH copy of levelRun.js a run member `__eval(src)` that
evaluates `src` inside createLevelRun's closure (to perturb one closure map, and restore it, between two probes)."""
import sys
p = sys.argv[1]
assert '/scratchpad/' in p, p
s = open(p).read()
old = "    return {\n        get level() { return level; },\n"
assert s.count(old) == 1
s = s.replace(old, "    return {\n        __eval(src) { return eval(src); },\n        get level() { return level; },\n")
open(p, 'w').write(s)
print('audit hook applied', p)
