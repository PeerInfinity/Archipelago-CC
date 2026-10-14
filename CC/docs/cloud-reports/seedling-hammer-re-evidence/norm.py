#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-re): the md5 of a workload's stdout with every wall-clock field stripped, so two modes'
outputs compare by answer. JSON lines lose `ms` / `s` / `seconds` keys (at any depth); text lines lose `12.3s`,
`123 ms` and `(… s)` tokens.  usage: norm.py <file.out>...  → `<md5>  <file>`"""
import hashlib
import json
import re
import sys

TIME_KEYS = {'ms', 's', 'seconds', 'wallMs', 'elapsedMs'}
TOK = re.compile(r'\b\d+(?:\.\d+)?\s?(?:ms|s)\b')


def strip(v):
    if isinstance(v, dict):
        return {k: strip(x) for k, x in v.items() if k not in TIME_KEYS}
    if isinstance(v, list):
        return [strip(x) for x in v]
    return v


def norm(path):
    out = []
    for line in open(path, encoding='utf8', errors='replace'):
        line = line.rstrip('\n')
        try:
            out.append(json.dumps(strip(json.loads(line)), sort_keys=True))
        except ValueError:
            out.append(re.sub(r'\s+', ' ', TOK.sub('<t>', line)).strip())
    return hashlib.md5('\n'.join(out).encode()).hexdigest()


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(norm(p), p)
