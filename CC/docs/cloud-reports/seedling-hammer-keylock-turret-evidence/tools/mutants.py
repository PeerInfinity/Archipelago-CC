# scratch (KEYLOCK-TURRET I): each mutant applied to solverBot.js, the fast rows run, the file restored byte for byte.
# Usage: python3 mutants.py <out-dir>
import hashlib, os, re, subprocess, sys
P = 'frontend/modules/seedlingDemo/solverBot.js'
MUTANTS = {
    'M1-no-derivation': ("    if (KEYLOCK_TURRET.enabled && candidates.length === 0) {", "    if (false && KEYLOCK_TURRET.enabled && candidates.length === 0) {"),
    'M2-no-kill': ("    for (const id of kill) {\n        requireVerb('kill', 'keylock:turretFirst', id);", "    for (const id of []) {\n        requireVerb('kill', 'keylock:turretFirst', id);"),
    'M3-walk-disc-not-exempt': ("            contactsOverride: exempt,\n            ...(KEYLOCK_WAIT_PRICED.enabled && lockRow?.keyLine", "            contactsOverride: undefined,\n            ...(KEYLOCK_WAIT_PRICED.enabled && lockRow?.keyLine"),
    'M4-guard-inverted': ("    if (KEYLOCK_TURRET.enabled && candidates.length === 0) {", "    if (!KEYLOCK_TURRET.enabled && candidates.length === 0) {"),
    'M5-dead-counts-as-live': ("        return t !== null && !t.dead && !t.removed;", "        return t !== null;"),
}
out = sys.argv[1]
orig = open(P, 'rb').read()
h0 = hashlib.sha256(orig).hexdigest()
for name, (a, b) in MUTANTS.items():
    s = orig.decode()
    assert s.count(a) == 1, name
    open(P, 'w').write(s.replace(a, b))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerKeylockTurret.test.js'],
                           capture_output=True, text=True, timeout=1200)
        txt = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
        lines = [l.strip() for l in txt.splitlines() if re.match(r'\s*[×✓] ', l) or 'Tests ' in l]
        open(os.path.join(out, f'{name}.txt'), 'w').write(f'{name}: {a!r} -> {b!r}\n' + '\n'.join(lines) + '\n')
        print(name, [l for l in lines if l.startswith('×') or 'Tests' in l])
    finally:
        open(P, 'wb').write(orig)
assert hashlib.sha256(open(P, 'rb').read()).hexdigest() == h0
print('restored', h0[:12])
