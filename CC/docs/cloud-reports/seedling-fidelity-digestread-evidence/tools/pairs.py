#!/usr/bin/env python3
"""pairs.py <vitest-json> — sorted `status\tfullName` lines of every assertion (the tapeRunner pairs row)."""
import json, sys
j = json.load(open(sys.argv[1]))
rows = sorted(f"{a['status']}\t{a['fullName']}" for r in j['testResults'] for a in r['assertionResults'])
print('\n'.join(rows))
