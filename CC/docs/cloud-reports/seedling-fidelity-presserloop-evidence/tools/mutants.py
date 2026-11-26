# Mutants for fidelityPresserHang.test.js: copy -> break -> run the file -> restore (wave 61's pattern).
# usage (repo root): python3 <this>   -> prints, per mutant, the red row names
import re, shutil, subprocess, sys
D = 'frontend/modules/seedlingDemo/'
MUTANTS = [
    ('M1 trueLoops ignores flip-0 ButtonRooms', D + 'levelWorld.js',
     "const trueLoops = pass + count('br0') >= 2;", "const trueLoops = pass >= 2;"),
    ('M2 no first-frame refusal', D + 'levelWorld.js',
     "const firstFrame = count('button') >= 1 && falseLoops;", "const firstFrame = false;"),
    ('M3 the hang step keeps stepping (marks, no return)', D + 'activators.js',
     "if (markPresserHang(state, world, p.t, value, `${p.tag}@${p.x},${p.y} (pressed)`)) return [];",
     "markPresserHang(state, world, p.t, value, `${p.tag}@${p.x},${p.y} (pressed)`);"),
    ('M4 advance never refuses', D + 'levelRun.js',
     "if (CONTACT_FIDELITY.presserRecursionHang && activatorStates.get(level)?.presserHang) {",
     "if (false && activatorStates.get(level)?.presserHang) {"),
    ('M5 a flip-1 press publishes true', D + 'activators.js',
     "const value = p.tag === 'buttonroom' ? !p.flip : true;", "const value = true;"),
]
for name, path, old, new in MUTANTS:
    src = open(path, encoding='utf-8').read()
    assert src.count(old) == 1, (name, old)
    shutil.copy(path, '/tmp/claude-0/mutant.bak')
    try:
        open(path, 'w', encoding='utf-8').write(src.replace(old, new))
        out = subprocess.run(['npx', 'vitest', 'run', D + 'fidelityPresserHang.test.js', '--maxWorkers=3'],
                             capture_output=True, text=True).stdout
        out = re.sub(r'\x1b\[[0-9;]*m', '', out)
        reds = sorted(set(m.group(1).strip() for m in re.finditer(r'FAIL .*?fidelityPresserHang\.test\.js > (.*)', out)))
        tests = re.search(r'Tests\s+(.*)', out)
        print(f'== {name}: {tests.group(1) if tests else "?"}')
        for r in reds: print('   red:', r)
    finally:
        shutil.copy('/tmp/claude-0/mutant.bak', path)
print('restored; git diff --stat of the mutated files:')
print(subprocess.run(['git', 'diff', '--stat', '--', D + 'levelWorld.js', D + 'activators.js', D + 'levelRun.js'], capture_output=True, text=True).stdout or '(none vs index)')
