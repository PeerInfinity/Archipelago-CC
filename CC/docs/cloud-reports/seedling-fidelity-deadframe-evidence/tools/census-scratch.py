#!/usr/bin/env python3
"""DEADFRAME (wave 66) D1 census — COPY + RESTORE, never committed (wave 64/65's scratch method).

  python3 census-scratch.py apply     copy levelRun.js aside, then add the census hooks (`globalThis.__DF`, which nothing
                                      shipped sets: unset, every edit is a no-op)
  python3 census-scratch.py restore   copy it back and check `git diff --quiet`

Hooks:
  * `clock.spend` (every dead-frame span the model charges, by kind/why): `__DF.onSpend(frames, kind, why, sim)`, where
    `sim` steps a CLONE of the level's activator state `frames` times with the box and the blocks as they stand (the
    responders the game runs on those frames; wave 65's probe method: copy + restore, diff) and counts the frames on
    which a responder's `open`/`alpha` changed, and the open flips.
  * the end of every live tick (beside `armButtonFallRocks`): `__DF.onTick(o)` with the spinner / wallflyer boxes on a
    Button / ButtonRoom, and on a presser whose group holds an unlanded FallRock.
"""
import shutil, subprocess, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
D = os.path.join(ROOT, 'frontend/modules/seedlingDemo')
SAVE = os.environ.get('SCRATCH_SAVE', '/tmp/claude-0/deadframe-census-save')
FILES = ['levelRun.js']
SIM = r'''
    if (globalThis.__DF) {
        const spend0 = clock.spend;
        clock.spend = (f, k, w, t) => {
            let sim = null;
            try { sim = __dfSim(f); } catch (e) { sim = { error: String(e?.message ?? e).slice(0, 120) }; }
            try { globalThis.__DF.onSpend(f, k, w, sim, level); } catch { /* census only */ }
            return spend0(f, k, w, t);
        };
    }
    function __dfSim(frames) {
        if (noclip || frames <= 0) return null;
        const a = activatorStateFor(level);
        const w = worldFor(level);
        const acts = w.activators ?? [];
        const pulsers = (w.pulsers ?? []).length;
        if (acts.length === 0) return { responders: 0, pulsers, changed: 0, flips: 0 };
        const c = structuredClone(a);
        const box = playerBoxAt(state.x, state.y);
        const ms = movingSolidsNow();
        const snap = () => [...c.byId].map(([id, s]) => `${id}:${s.open ? 1 : 0}:${s.alpha}`);
        let changed = 0; let flips = 0; let first = null; const ids = new Set();
        for (let k = 1; k <= frames; k += 1) {
            const before = snap();
            stepActivators(c, w, box, { inventory, keys, movingSolids: ms });
            const after = snap();
            let ch = false;
            for (let i = 0; i < before.length; i += 1) {
                if (before[i] === after[i]) continue;
                ch = true; ids.add(before[i].split(':')[0]);
                if (before[i].split(':')[1] !== after[i].split(':')[1]) flips += 1;
            }
            if (ch) { changed += 1; if (first === null) first = k; }
        }
        return { responders: acts.length, pulsers, changed, flips, first, ids: [...ids] };
    }
'''
TICK = r'''
                if (globalThis.__DF && !next.transition) {
                    try {
                        const w = worldFor(level);
                        const en = [...(spinnerRectsNow() ?? []).map((r) => ({ kind: 'spinner', rect: r.rect })),
                            ...wallFlyerBodiesNow().map((b) => ({ kind: 'wallflyer', rect: wallFlyerRect(b) }))];
                        const rocks = fallRockStateFor(level);
                        for (const e of en) for (const p of (w.pressers ?? [])) {
                            if (!(e.rect.x < p.rect.right && e.rect.right > p.rect.x && e.rect.y < p.rect.bottom && e.rect.bottom > p.rect.y)) continue;
                            const rockGroup = (w.fallRocks ?? []).some((r) => r.t === p.t && rocks.has(r.id) && !rocks.get(r.id).landed);
                            globalThis.__DF.onTick({ kind: e.kind, presser: `${p.tag}@${p.x},${p.y}`, t: p.t, rockGroup, level, tick: ticksCompleted });
                        }
                    } catch (err) { globalThis.__DF.tickErr = String(err?.message ?? err).slice(0, 120); }
                }
'''
EDITS = [
    ('levelRun.js', "    const clock = createGameClock({\n        bootTime: clockRefusal === null ? beginEntryTimeFromDeclared(clockDeclared) : null,\n    });\n",
     "    const clock = createGameClock({\n        bootTime: clockRefusal === null ? beginEntryTimeFromDeclared(clockDeclared) : null,\n    });\n" + SIM),
    ('levelRun.js', "                if (!next.transition) armButtonFallRocks(playerBoxAt(next.x, next.y));\n",
     TICK + "                if (!next.transition) armButtonFallRocks(playerBoxAt(next.x, next.y));\n"),
]
def apply():
    os.makedirs(SAVE, exist_ok=True)
    for f in FILES: shutil.copy2(os.path.join(D, f), os.path.join(SAVE, f))
    for f, a, b in EDITS:
        p = os.path.join(D, f); s = open(p).read(); n = s.count(a)
        if n != 1:
            restore(); sys.exit(f'census-scratch: {f}: anchor found {n} times: {a[:70]!r}')
        open(p, 'w').write(s.replace(a, b))
    print('census-scratch: applied', len(EDITS), 'edits; saved copies in', SAVE)
def restore():
    for f in FILES:
        src = os.path.join(SAVE, f)
        if os.path.exists(src): shutil.copy2(src, os.path.join(D, f))
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--quiet', '--', *[os.path.join(D, f) for f in FILES]])
    print('census-scratch: restored;', 'git diff clean' if r.returncode == 0 else 'GIT DIFF NOT CLEAN')
    if r.returncode != 0: sys.exit(1)
if __name__ == '__main__':
    {'apply': apply, 'restore': restore}[sys.argv[1]]()
