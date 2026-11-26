# Runtime probe (copy -> plant a marker throw at both ON branches -> measure -> restore): does the ON arm ever FIRE on
# the committed tapes or the acceptance batch? A fire becomes `RUNTIME-PROBE` (a tape DIFFERS; the md5 moves).
# Positive control: this slice's own rows (they stage the shapes) must hit it.
import re, shutil, subprocess
D = 'frontend/modules/seedlingDemo/'
PLANTS = [
    (D + 'activators.js', "    if (!presserRecursionHangsOn(g, value)) return false;\n",
     "    if (!presserRecursionHangsOn(g, value)) return false;\n    throw new Error(`RUNTIME-PROBE presserRecursionHang fired: level ${world.level} group ${t} by ${by}`);\n"),
    (D + 'levelWorld.js', "        for (const g of presserRecursionGroups({ pressers, solids })) {\n            if (g.bootBy) {",
     "        for (const g of presserRecursionGroups({ pressers, solids })) {\n            if (g.bootBy || g.firstFrame) throw new Error(`RUNTIME-PROBE presserRecursionHang refused at build: ${where} group ${g.t}`);\n            if (g.bootBy) {"),
]
backs = []
try:
    for path, old, new in PLANTS:
        src = open(path, encoding='utf-8').read(); assert src.count(old) == 1, path
        shutil.copy(path, path + '.probe-bak'); backs.append(path)
        open(path, 'w', encoding='utf-8').write(src.replace(old, new))
    t = subprocess.run(['node', 'CC/docs/cloud-reports/seedling-fidelity-presserloop-evidence/tools/tape-onoff.mjs'], capture_output=True, text=True).stdout
    print('tapes (ON arm carries the probe):', t.strip().splitlines()[-1]); print('  tapes that DIFFER:', [l.split()[0] for l in t.splitlines() if 'DIFFERS' in l])
    a = subprocess.run('SEEDLING_PRESSER_RECURSION_HANG=1 node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum', shell=True, capture_output=True, text=True).stdout
    print('acceptance ON with the probe, md5:', a.strip(), '(standing 391322d681b7aa0229d94b3f6906d024)')
    c = subprocess.run(['npx', 'vitest', 'run', D + 'fidelityPresserHang.test.js', '--maxWorkers=3'], capture_output=True, text=True)
    out = re.sub(r'\x1b\[[0-9;]*m', '', c.stdout + c.stderr)
    print('positive control (this slice\'s rows):', re.search(r'Tests\s+(.*)', out).group(1), '| RUNTIME-PROBE messages:', out.count('RUNTIME-PROBE'))
finally:
    for path in backs: shutil.move(path + '.probe-bak', path)
print('restored:', subprocess.run(['git', 'status', '--short', '--', D], capture_output=True, text=True).stdout or 'clean')
