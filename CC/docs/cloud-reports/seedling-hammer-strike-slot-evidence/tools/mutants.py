# MEASUREMENT ONLY: each mutant = copy the file, apply one edit, run hammerStrikeSlot.test.js, restore the copy.
import subprocess, sys
D = 'frontend/modules/seedlingDemo/'
MUTANTS = [
    ('M1 gate back on the inventory (no slot read in strikePolicyFor)', D + 'solverBot.js',
     "    const slotIsBlade = STRIKE_SLOT.enabled\n", "    const slotIsBlade = false\n"),
    ('M2 accept `sword` while the Ghost Sword is held', D + 'strikeSlot.js',
     "    return weapon === 'sword' && !inventory?.hasGhostSword;", "    return weapon === 'sword';"),
    ('M3 a built policy never stands down (no per-tick read)', D + 'strikePolicy.js',
     "            if (slotIsBlade !== null && !slotIsBlade()) {", "            if (false) {"),
    ('M4 planSwordDash ignores the slot', D + 'solverBot.js',
     "    if (STRIKE_SLOT.enabled && !pressIsBlade(run.progress('primaryWeapon'), run.progress('inventory'))) {",
     "    if (false) {"),
]
for name, path, old, new in MUTANTS:
    src = open(path).read()
    assert src.count(old) == 1, (name, src.count(old))
    try:
        open(path, 'w').write(src.replace(old, new))
        r = subprocess.run(['npx', 'vitest', 'run', D + 'hammerStrikeSlot.test.js'], capture_output=True, text=True)
        out = r.stdout + r.stderr
        failed = [l.strip() for l in out.splitlines() if l.strip().startswith(('×', '✗', 'FAIL')) or ' ✗ ' in l or '×' in l]
        print(f"{name}: {'RED' if r.returncode else 'GREEN (survives)'}")
        for l in failed[:6]: print('   ', l[:160])
    finally:
        open(path, 'w').write(src)
