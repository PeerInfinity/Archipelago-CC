#!/usr/bin/env python3
"""SCRATCH: tapeRunner pairs — count, md5 over sorted `status\tfullName` lines, non-pass count, from vitest's JSON."""
import hashlib, json, sys
j = json.load(open(sys.argv[1]))
rows = sorted(f"{a['status']}\t{a['fullName']}" for t in j['testResults'] for a in t['assertionResults'])
bad = sum(1 for r in rows if not r.startswith('passed'))
print(len(rows), hashlib.md5('\n'.join(rows).encode()).hexdigest(), bad, 'non-pass')
