# Mutants (copy -> break -> run the rows file -> restore), each with its prediction. usage: python3 mutants.py
import re, shutil, subprocess
D = 'frontend/modules/seedlingDemo/'
A, L = D + 'activators.js', D + 'levelRun.js'
MUTANTS = [
    ('M1 the reached ones in XML order (not getClass order)', 'the two-on-one-slot shapes and the getClass-order unit row',
     A, "    for (let i = brs.length - 1; i >= 0; i--) {", "    for (let i = 0; i < brs.length; i++) {"),
    ('M2 no flip-1 answer to a press (pressedGroups keeps the group)', 'btn-br1-lock, btn-br1-cover, the composition row (it holds btn-br1-lock), the unit press row',
     A, "        if (answered && answered.has(p.t) && publishesTrue(p)) continue;", ""),
    ('M3 a flip-0 press still latches a flip-answer group', 'br0-br1-lock only',
     A, "            && flipAnswerGroups(world).has(publish.group))) state.latched.set", "            && false)) state.latched.set"),
    ('M4 the rope pull is not queued', 'pull-br1 (staged and composition)',
     L, "                queuePublishedTrue(act, pub.group, ropeSolid.ropeId);\n", ""),
    ('M5 a TRUE roomwrite does not put the slot back', 'btn-brx0-then-brx1 (staged and composition)',
     L, "                    if (w.value === true && CONTACT_FIDELITY.publishedButtonRoomSetter) {", "                    if (false) {"),
    ('M6 only local flip-1 ButtonRooms are run (no cross-room)', 'every brx shape (btn-brx1, both two-on-one-slot, br0-brx1, btn-brx1-revisit), the revisit row, the unit getClass row, a composition row',
     A, "        if (!(p.room >= 0) && !p.flip) continue;\n        state.roomWritten.add(id);", "        if (!(p.room >= 0) && !p.flip) continue;\n        if (p.room >= 0) continue;\n        state.roomWritten.add(id);"),
    ('M7 a build check() publish is not queued', 'ropeboot-br1 only (no other shape boots a publisher into an unwritten ButtonRoom)',
     A, "        queuePublishedTrue(state, group, 'check()');\n", ""),
]
for name, pred, path, old, new in MUTANTS:
    src = open(path, encoding='utf-8').read(); assert src.count(old) == 1, (name, old)
    shutil.copy(path, path + '.mut-bak')
    try:
        open(path, 'w', encoding='utf-8').write(src.replace(old, new))
        c = subprocess.run(['npx', 'vitest', 'run', D + 'fidelityPublishedButtonRoom.test.js', '--maxWorkers=3'], capture_output=True, text=True)
        out = re.sub(r'\x1b\[[0-9;]*m', '', c.stdout + c.stderr)
        red = sorted(set(re.findall(r'FAIL .*?fidelityPublishedButtonRoom\.test\.js > [^>]+> (.+)', out)))
        print(f'{name}\n  predicted: {pred}\n  observed: {re.search(r"Tests\s+(.*)", out).group(1)}')
        for r in red: print(f'    red: {r.strip()[:110]}')
    finally:
        shutil.move(path + '.mut-bak', path)
print('restored:', subprocess.run(['git', 'status', '--short', '--', D], capture_output=True, text=True).stdout or 'clean')
