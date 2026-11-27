#!/usr/bin/env python3
"""DEADFRAME2 (wave 69) D1 census — COPY + RESTORE, never committed (wave 66's `census-scratch.py`, widened).

  python3 census2-scratch.py apply [--clock149]   copy levelRun.js aside, then add the hooks (`globalThis.__DF`, which
                                                  nothing shipped sets: unset, every edit is a no-op). `--clock149`
                                                  ALSO charges a TEXTED pickup's phase A 149 frames on the model clock
                                                  instead of 150 (the 149-clock census: unconditional, no `__DF` gate)
  python3 census2-scratch.py restore              copy it back and check `git diff --quiet`

Hooks (wave 66's, plus):
  * `clock.spend`: `__DF.onSpend(frames, kind, why, sim, level, pulse)` — `sim` is wave 66's responder clone-step; `pulse`
    steps a CLONE of every Pulser of the level `frames` times, armed as the live tick would arm it (the plain current
    pressed set + the latch), and counts the frames on which its state moved, the hit frames, and the hit frames on
    which a fire block / the player / a spinner lies in the ring (`pulseReaches`).
  * the end of every live tick: wave 66's enemy-on-presser rows, plus a BLOCK whose rect overlaps a Button / ButtonRoom
    whose group holds an unlanded, unfallen FallRock (`fallRocksArmedBy` with no player box: the block arm alone).
  * the placed pickup's ceremony start: `__DF.onLump(texted, tag, level)` (a runtime Dark Sword / Fire is texted and
    counted at its own spend by tag).
"""
import shutil, subprocess, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
D = os.path.join(ROOT, 'frontend/modules/seedlingDemo')
SAVE = os.environ.get('SCRATCH_SAVE', '/tmp/claude-0/deadframe2-census-save')
FILES = ['levelRun.js']
SIM = r'''
    if (globalThis.__DF) {
        const spend0 = clock.spend;
        clock.spend = (f, k, w, t) => {
            let sim = null; let pulse = null;
            try { sim = __dfSim(f); } catch (e) { sim = { error: String(e?.message ?? e).slice(0, 120) }; }
            try { pulse = __dfPulse(f); } catch (e) { pulse = { error: String(e?.message ?? e).slice(0, 120) }; }
            try { globalThis.__DF.onSpend(f, k, w, sim, level, pulse); } catch { /* census only */ }
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
    function __dfPulse(frames) {
        if (noclip || frames <= 0) return null;
        const st = pulserStateFor(level);
        if (st.size === 0) return null;
        const a = activatorStateFor(level);
        const pressed = pressedGroups(worldFor(level), playerBoxAt(state.x, state.y), movingSolidsNow());
        const targets = [];
        for (const [bid, r] of pushableRectsNow?.() ?? []) {
            if (r.removed) continue;
            targets.push({ id: bid, type: 'Solid', as3: 'PushableBlockFire', x: r.rect.x + 8, y: r.rect.y + 8, originX: 8, originY: 8, w: 16, h: 16 });
        }
        targets.push({ id: 'player', type: 'Player', as3: 'Player', x: state.x, y: state.y, originX: 2, originY: 2, w: 4, h: 5 });
        let changed = 0; let hits = 0; let reachHits = 0; let active = 0; const reached = new Set();
        for (const [, p0] of st) {
            let p = { ...p0 };
            const armed = pressed.has(p.t) || a.latched?.get(p.t) === true;
            if (armed || p.radius > 10) active += 1;
            for (let k = 1; k <= frames; k += 1) {
                const r = stepPulser(p, armed);
                if (JSON.stringify(r.state) !== JSON.stringify(p)) changed += 1;
                if (r.hit) {
                    hits += 1;
                    const rr = pulseReaches(r.state, targets);
                    if (rr.length) { reachHits += 1; for (const x of rr) reached.add(x.arm ?? x.id); }
                }
                p = r.state;
            }
        }
        return { pulsers: st.size, active, changed, hits, reachHits, reached: [...reached] };
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
                        if (rocks.size > 0) {
                            const NB = { x: -1e9, y: -1e9, w: 0, h: 0, right: -1e9, bottom: -1e9 };
                            const armed = fallRocksArmedBy(w, NB, movingSolidsNow())
                                .filter((r) => rocks.has(r.id) && !rocks.get(r.id).landed && !rocks.get(r.id).active);
                            if (armed.length) globalThis.__DF.onTick({ kind: 'block', presser: `fallrock-button`, t: armed[0].t, rockGroup: true, level, tick: ticksCompleted, ids: armed.map((r) => r.id) });
                        }
                    } catch (err) { globalThis.__DF.tickErr = String(err?.message ?? err).slice(0, 120); }
                }
'''
LUMP = "                    if (globalThis.__DF) globalThis.__DF.onLump?.(entry.text !== '', hit.tag ?? 'pickup', level);\n"
EDITS = [
    ('levelRun.js', "    const clock = createGameClock({\n        bootTime: clockRefusal === null ? beginEntryTimeFromDeclared(clockDeclared) : null,\n    });\n",
     "    const clock = createGameClock({\n        bootTime: clockRefusal === null ? beginEntryTimeFromDeclared(clockDeclared) : null,\n    });\n" + SIM),
    ('levelRun.js', "                if (!next.transition) armButtonFallRocks(playerBoxAt(next.x, next.y));\n",
     TICK + "                if (!next.transition) armButtonFallRocks(playerBoxAt(next.x, next.y));\n"),
    ('levelRun.js', "                    spendCeremonyPhaseA(hit.tag ?? 'pickup');\n",
     LUMP + "                    spendCeremonyPhaseA(hit.tag ?? 'pickup');\n"),
]
CLOCK149 = [
    # the placed pickup: 149 when texted
    ('levelRun.js', "                    spendCeremonyPhaseA(hit.tag ?? 'pickup');\n",
     "                    spendCeremonyPhaseA(hit.tag ?? 'pickup', entry.text !== '' ? CEREMONY_LUMP_SHOVE_FRAMES : undefined);\n"),
    ('levelRun.js', "                    spendCeremonyPhaseA('darksword');\n", "                    spendCeremonyPhaseA('darksword', CEREMONY_LUMP_SHOVE_FRAMES);\n"),
    ('levelRun.js', "                    spendCeremonyPhaseA('fire');\n", "                    spendCeremonyPhaseA('fire', CEREMONY_LUMP_SHOVE_FRAMES);\n"),
    ('levelRun.js', "    const spendCeremonyPhaseA = (tag) => clock.spend(\n        CEREMONY_DEAD_FRAMES.pickup, 'ceremony',",
     "    const spendCeremonyPhaseA = (tag, n = CEREMONY_DEAD_FRAMES.pickup) => clock.spend(\n        n, 'ceremony',"),
]
def apply(clock149):
    os.makedirs(SAVE, exist_ok=True)
    for f in FILES: shutil.copy2(os.path.join(D, f), os.path.join(SAVE, f))
    for f, a, b in EDITS + (CLOCK149 if clock149 else []):
        p = os.path.join(D, f); s = open(p).read(); n = s.count(a)
        if n != 1:
            restore(); sys.exit(f'census2-scratch: {f}: anchor found {n} times: {a[:70]!r}')
        open(p, 'w').write(s.replace(a, b))
    print('census2-scratch: applied', len(EDITS) + (len(CLOCK149) if clock149 else 0), 'edits; saved copies in', SAVE)
def restore():
    for f in FILES:
        src = os.path.join(SAVE, f)
        if os.path.exists(src): shutil.copy2(src, os.path.join(D, f))
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--quiet', '--', *[os.path.join(D, f) for f in FILES]])
    print('census2-scratch: restored;', 'git diff clean' if r.returncode == 0 else 'GIT DIFF NOT CLEAN')
    if r.returncode != 0: sys.exit(1)
if __name__ == '__main__':
    if sys.argv[1] == 'apply': apply('--clock149' in sys.argv)
    else: restore()
