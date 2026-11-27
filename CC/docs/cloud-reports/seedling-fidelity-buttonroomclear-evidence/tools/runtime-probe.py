# Runtime probe (copy -> plant a marker throw at every ON branch that CHANGES something -> measure -> restore): does the
# ON arm of `publishedButtonRoomSetter` ever FIRE on the committed tapes or the acceptance batch? A fire becomes
# `RUNTIME-PROBE` (a tape DIFFERS; the md5 moves). Positive control: this slice's own rows (they stage the shapes).
# The queue itself (`queuePublishedTrue`) is not a fire: it changes nothing unless a ButtonRoom is reached.
import re, shutil, subprocess
D = 'frontend/modules/seedlingDemo/'
P = lambda site: f"throw new Error('RUNTIME-PROBE publishedButtonRoomSetter fired: {site}'); "
PLANTS = [
    (D + 'activators.js', "        state.roomWritten.add(id);\n        events.push({ kind: 'roomwrite', id, presser: p, writes: crossRoomWrites(p), publish: localPublish(p), publishedBy: by });",
     "        " + P('a reached ButtonRoom ran its setter') + "state.roomWritten.add(id);\n        events.push({ kind: 'roomwrite', id, presser: p, writes: crossRoomWrites(p), publish: localPublish(p), publishedBy: by });"),
    (D + 'activators.js', "        if (answered && answered.has(p.t) && publishesTrue(p)) continue;",
     "        if (answered && answered.has(p.t) && publishesTrue(p)) { " + P('pressedGroups answered false') + "}"),
    (D + 'activators.js', "        if (flipAnswerGroups(world).has(group)) return false;",
     "        if (flipAnswerGroups(world).has(group)) { " + P('latchAtBuild answered false') + "}"),
    (D + 'activators.js', "            && flipAnswerGroups(world).has(publish.group))) state.latched.set(publish.group, true);",
     "            && flipAnswerGroups(world).has(publish.group) && (() => { " + P('the press latch answered false') + "})())) state.latched.set(publish.group, true);"),
    (D + 'levelRun.js', "                if (!flipAnswerGroups(worldFor(n)).has(pub.group)) act.latched.set(pub.group, pub.value);",
     "                if (flipAnswerGroups(worldFor(n)).has(pub.group)) " + P('the pull latch answered false') + "\n                if (!flipAnswerGroups(worldFor(n)).has(pub.group)) act.latched.set(pub.group, pub.value);"),
    (D + 'levelRun.js', "                            if (!flipAnswerGroups(worldFor(level)).has(group)) activatorStateFor(level).latched.set(group, true);",
     "                            if (flipAnswerGroups(worldFor(level)).has(group)) " + P('the wand latch answered false') + "\n                            if (!flipAnswerGroups(worldFor(level)).has(group)) activatorStateFor(level).latched.set(group, true);"),
    (D + 'levelRun.js', "                    if (w.value === true && CONTACT_FIDELITY.publishedButtonRoomSetter) {\n",
     "                    if (w.value === true && CONTACT_FIDELITY.publishedButtonRoomSetter) {\n                        " + P('a TRUE roomwrite') + "\n"),
]
backs = []
try:
    for path, old, new in PLANTS:
        src = open(path, encoding='utf-8').read(); assert src.count(old) == 1, (path, old[:60])
        if path not in backs: shutil.copy(path, path + '.probe-bak'); backs.append(path)
        open(path, 'w', encoding='utf-8').write(src.replace(old, new))
    t = subprocess.run(['node', 'CC/docs/cloud-reports/seedling-fidelity-buttonroomclear-evidence/tools/tape-onoff.mjs'], capture_output=True, text=True).stdout
    print('tapes (ON arm carries the probe):', t.strip().splitlines()[-1]); print('  tapes that DIFFER:', [l.split()[0] for l in t.splitlines() if 'DIFFERS' in l])
    a = subprocess.run('SEEDLING_PUBLISHED_BUTTON_ROOM_SETTER=1 node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum', shell=True, capture_output=True, text=True).stdout
    print('acceptance ON with the probe, md5:', a.strip(), '(standing 391322d681b7aa0229d94b3f6906d024)')
    c = subprocess.run(['npx', 'vitest', 'run', D + 'fidelityPublishedButtonRoom.test.js', '--maxWorkers=3'], capture_output=True, text=True)
    out = re.sub(r'\x1b\[[0-9;]*m', '', c.stdout + c.stderr)
    print('positive control (this slice\'s rows):', re.search(r'Tests\s+(.*)', out).group(1), '| RUNTIME-PROBE messages:', out.count('RUNTIME-PROBE'),
          '| sites:', sorted(set(re.findall(r'RUNTIME-PROBE publishedButtonRoomSetter fired: ([^\'"\n]+)', out))))
finally:
    for path in backs: shutil.move(path + '.probe-bak', path)
print('restored:', subprocess.run(['git', 'status', '--short', '--', D], capture_output=True, text=True).stdout or 'clean')
