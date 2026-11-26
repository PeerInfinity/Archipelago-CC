#!/usr/bin/env python3
"""Scratch edits for fidelity READERORDER's replay arms and runtime probe -- COPY + RESTORE, never committed.

  python3 scratch.py apply     copy the two sources aside (scratch dir), then edit them in place
  python3 scratch.py restore   copy them back and check `git diff --quiet` on both

Every edit is gated on `globalThis.__RO`, which nothing in the shipped code sets, so with it unset the edited tree
behaves as the shipped one (`globalThis.__RO?.x` is undefined):
  E1 activators.js  stepActivators: write `state.openBefore` when `__RO` is set too (the snapshot W61's
                    `openActivatorIdsBeforeStep` reads; shipped, only `chestCoverFencepost` writes it).
  E2 levelRun.js    pushableCtx: `__RO.arm === 'before'` -> the block reads `openActivatorIdsBeforeStep`.
                    `__RO.probe` -> every `collides` query is asked under the other set too; a query whose answer
                    differs is recorded in `__RO.hits` ({reader:'pushable', level, t, id}).
  E3 levelRun.js    spinnerCtx (the Spinner's and the WallFlyer's read): the same, against the shipped read
                    (`openActivatorIdsBeforeLatestStep` under `spinnerLockLag`). `__RO.who` names the stepper
                    (set by E4) so a forecast's query is told from a step's.
  E4 levelRun.js    the main tick's `stepSpinners(...)` and `stepWallFlyersNow()` set `__RO.who` around them.
  E5 activators.js  `__RO.pressLag` -> the presses (`pressedGroups`, the room = -1 latch) read the player box the
                    PREVIOUS step was given (the Button's publish of the frame before; `pulserPublishLag`'s rule,
                    for the responders); the occupancy guard keeps the current box.
"""
import shutil, subprocess, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
D = os.path.join(ROOT, 'frontend/modules/seedlingDemo')
SAVE = os.environ.get('SCRATCH_SAVE', '/tmp/claude-0/readerorder-scratch-save')
FILES = ['activators.js', 'levelRun.js']

EDITS = [
    ('activators.js',
     "    if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);",
     "    if (CONTACT_FIDELITY.chestCoverFencepost || globalThis.__RO) state.openBefore = openActivatorIds(state);"),
    ('levelRun.js',
     "        const openActivators = noclip ? null : openActivatorIds(activatorStateFor(level));\n        const playerBox = playerBoxAt(state.x, state.y);",
     "        const RO = globalThis.__RO;\n"
     "        const shippedOpen = noclip ? null : openActivatorIds(activatorStateFor(level));\n"
     "        const beforeOpen = noclip ? null : openActivatorIdsBeforeStep(activatorStateFor(level));\n"
     "        const openActivators = RO?.arm === 'before' ? beforeOpen : shippedOpen;\n"
     "        const playerBox = playerBoxAt(state.x, state.y);"),
    ('levelRun.js',
     "                const hit = world.collidesSolid(rect, { ...base, pushables: withoutSelf });\n                if (hit) return hit;",
     "                const hit = world.collidesSolid(rect, { ...base, pushables: withoutSelf });\n"
     "                if (RO?.probe && !noclip) {\n"
     "                    const alt = world.collidesSolid(rect, { ...normalizeLiveOpts(liveSolidOpts({ beforeTypeFlip: firstTickInWorld,\n"
     "                        openActivators: openActivators === beforeOpen ? shippedOpen : beforeOpen, openBridges })), pushables: withoutSelf });\n"
     "                    if (!!alt !== !!hit) RO.hits.push({ reader: 'pushable', level, t: ticksCompleted, id: self.id, shipped: !!hit });\n"
     "                }\n"
     "                if (hit) return hit;"),
    ('levelRun.js',
     "        const openActivators = noclip ? null : (CONTACT_FIDELITY.spinnerLockLag\n"
     "            ? openActivatorIdsBeforeLatestStep(activatorStateFor(level), world)\n"
     "            : openActivatorIds(activatorStateFor(level)));",
     "        const RO = globalThis.__RO;\n"
     "        const shippedOpen = noclip ? null : (CONTACT_FIDELITY.spinnerLockLag\n"
     "            ? openActivatorIdsBeforeLatestStep(activatorStateFor(level), world)\n"
     "            : openActivatorIds(activatorStateFor(level)));\n"
     "        const beforeOpen = noclip ? null : openActivatorIdsBeforeStep(activatorStateFor(level));\n"
     "        const openActivators = RO?.arm === 'before' ? beforeOpen : shippedOpen;"),
    ('levelRun.js',
     "            collides: (rect) => world.collidesSolid(rect, base),",
     "            collides: (rect) => {\n"
     "                const hit = world.collidesSolid(rect, base);\n"
     "                if (RO?.probe && !noclip) {\n"
     "                    const alt = world.collidesSolid(rect, normalizeLiveOpts(liveSolidOpts({ beforeTypeFlip: over.beforeTypeFlip ?? firstTickInWorld,\n"
     "                        openActivators: openActivators === beforeOpen ? shippedOpen : beforeOpen, openBridges, pushables })));\n"
     "                    if (!!alt !== !!hit) RO.hits.push({ reader: RO.who ?? 'spinnerCtx(other)', level, t: ticksCompleted, shipped: !!hit });\n"
     "                }\n"
     "                return hit;\n"
     "            },"),
    ('levelRun.js',
     "                stepSpinners(spinState, spinnerCtx());",
     "                if (globalThis.__RO) globalThis.__RO.who = 'spinner';\n"
     "                stepSpinners(spinState, spinnerCtx());\n"
     "                if (globalThis.__RO) globalThis.__RO.who = null;"),
    ('levelRun.js',
     "            if (!noclip) stepWallFlyersNow();\n            if (!noclip && CONTACT_FIDELITY.drillLive) stepDrillsNow({ mainTick: true });",
     "            if (globalThis.__RO) globalThis.__RO.who = 'wallflyer';\n"
     "            if (!noclip) stepWallFlyersNow();\n"
     "            if (globalThis.__RO) globalThis.__RO.who = null;\n"
     "            if (!noclip && CONTACT_FIDELITY.drillLive) stepDrillsNow({ mainTick: true });"),
    ('activators.js',
     "    const pressed = pressedGroups(world, playerBox, movingSolids);",
     "    const pressBox = globalThis.__RO?.pressLag ? (state.__roPrevBox ?? playerBox) : playerBox;\n"
     "    if (globalThis.__RO) state.__roPrevBox = playerBox;\n"
     "    const pressed = pressedGroups(world, pressBox, movingSolids);"),
    ('activators.js',
     "        const byPlayer = rectsOverlap(playerBox, p.rect);",
     "        const byPlayer = rectsOverlap(pressBox, p.rect);"),
]


def apply():
    os.makedirs(SAVE, exist_ok=True)
    for f in FILES:
        shutil.copy2(os.path.join(D, f), os.path.join(SAVE, f))
    for f, a, b in EDITS:
        p = os.path.join(D, f)
        s = open(p).read()
        n = s.count(a)
        if n != 1:
            restore()
            sys.exit(f'scratch: {f}: anchor found {n} times (need 1): {a[:80]!r}')
        open(p, 'w').write(s.replace(a, b))
    print('scratch: applied', len(EDITS), 'edits; saved copies in', SAVE)


def restore():
    for f in FILES:
        src = os.path.join(SAVE, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(D, f))
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--quiet', '--', *[os.path.join(D, f) for f in FILES]])
    print('scratch: restored;', 'git diff clean' if r.returncode == 0 else 'GIT DIFF NOT CLEAN')
    if r.returncode != 0:
        sys.exit(1)


if __name__ == '__main__':
    {'apply': apply, 'restore': restore}[sys.argv[1]]()
