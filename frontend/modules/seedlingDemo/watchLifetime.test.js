/**
 * watchLifetime — the arm-teardown mechanism, tested where it is pure
 * (in-place SOURCE switching, slice 1).
 *
 * ⛔ THE LAST DESCRIBE IS A STRUCTURAL ROW AND IT IS THE POINT OF THE
 * MODULE. Everything above it proves the mechanism WORKS; that one proves
 * the page USES it — that no `addEventListener` in `watchViewer.js` bypasses
 * a lifetime. A leak witness that only sees the listeners registered through
 * itself would report a clean teardown with the leak sitting beside it, so
 * the absence is asserted over the source rather than trusted.
 *
 * The browser row (`scripts/procgen/check-seedling-editor-switch.mjs`) proves
 * the PAGE'S path: chromium, a real arm switch, and the readout this module
 * publishes. This file is the half that can be asserted without one.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLifetime, createLifetimeHolder, WatchLifetimeError } from './watchLifetime.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A minimal EventTarget stand-in that records what survived an abort. */
const fakeTarget = () => {
    const live = new Set();
    return {
        live,
        addEventListener(type, handler, options) {
            const entry = { type, handler };
            live.add(entry);
            options?.signal?.addEventListener('abort', () => live.delete(entry));
        },
    };
};

describe('a lifetime', () => {
    it('is alive until it is retired, and keeps the FIRST reason', () => {
        const lt = createLifetime('solve', 1);
        expect(lt.alive()).toBe(true);
        expect(lt.retire('switched to manual')).toBe(true);
        expect(lt.alive()).toBe(false);
        // Idempotent, and the second call must not overwrite the real reason
        // with the noise of a cascading teardown.
        expect(lt.retire('page unloaded')).toBe(false);
        expect(lt.state().retiredWhy).toBe('switched to manual');
    });

    it('⛔ refuses to be created without a name', () => {
        expect(() => createLifetime('')).toThrow(WatchLifetimeError);
    });

    it('drops every listener it registered when it retires', () => {
        const lt = createLifetime('manual', 1);
        const target = fakeTarget();
        lt.on(target, 'keydown', () => {});
        lt.on(target, 'keyup', () => {});
        expect(target.live.size).toBe(2);
        expect(lt.state().listeners).toBe(2);
        lt.retire('superseded');
        expect(target.live.size).toBe(0);
    });

    it('⛔ REFUSES to register on a retired lifetime rather than no-opping', () => {
        // An aborted signal makes addEventListener a silent no-op: the arm
        // would hold a listener that never fires and never learn why.
        const lt = createLifetime('manual', 1);
        lt.retire('superseded');
        expect(() => lt.on(fakeTarget(), 'keydown', () => {})).toThrow(WatchLifetimeError);
    });

    it('⛔ refuses a target that is not an EventTarget', () => {
        const lt = createLifetime('manual', 1);
        expect(() => lt.on({}, 'keydown', () => {})).toThrow(WatchLifetimeError);
    });

    describe('guard', () => {
        it('passes calls through — and arguments and return value with them', () => {
            const lt = createLifetime('replay', 1);
            const body = vi.fn((n) => n * 2);
            const tick = lt.guard('frame', body);
            expect(tick(21)).toBe(42);
            expect(body).toHaveBeenCalledTimes(1);
        });

        it('⛓ stops a self-scheduling loop, and NAMES it as the leak witness', () => {
            const lt = createLifetime('manual', 1);
            let ticks = 0;
            let scheduled = null;
            // The page's own shape: the body re-arms from its own tail.
            const tick = lt.guard('manual-frame', () => {
                ticks += 1;
                scheduled = tick;
            });
            tick();
            tick();
            expect(ticks).toBe(2);

            lt.retire('switched to solve');
            // The tick it was already scheduled for still fires — and is the
            // one blocked call. It must not re-arm.
            scheduled();
            expect(ticks).toBe(2);
            expect(lt.state().stopped).toEqual(['manual-frame']);
        });

        it('⚠ does NOT swallow throws — the loops keep their own discipline', () => {
            const lt = createLifetime('replay', 1);
            const tick = lt.guard('frame', () => { throw new Error('cannot draw tick 7'); });
            expect(() => tick()).toThrow('cannot draw tick 7');
        });

        it('⛔ refuses an unnamed loop', () => {
            const lt = createLifetime('replay', 1);
            expect(() => lt.guard('', () => {})).toThrow(WatchLifetimeError);
        });
    });

    describe('report', () => {
        it('runs while the arm owns the page', () => {
            const lt = createLifetime('solve', 1);
            const paint = vi.fn();
            expect(lt.report('a refusal', paint)).toBe(true);
            expect(paint).toHaveBeenCalledTimes(1);
        });

        it('⛔ KEEPS a retired arm\'s message instead of painting it or dropping it', () => {
            const lt = createLifetime('solve', 1);
            const paint = vi.fn();
            lt.retire('switched to manual');
            expect(lt.report('the solve arm failed: no such level', paint)).toBe(false);
            // Not painted — it would be a refusal about nothing on screen.
            expect(paint).not.toHaveBeenCalled();
            // And not dropped either.
            expect(lt.state().suppressed).toEqual(['the solve arm failed: no such level']);
        });
    });

    describe('onRetire', () => {
        it('runs its hooks once, at retirement', () => {
            const lt = createLifetime('generate', 1);
            const release = vi.fn();
            lt.onRetire(release);
            expect(release).not.toHaveBeenCalled();
            lt.retire('superseded');
            lt.retire('again');
            expect(release).toHaveBeenCalledTimes(1);
        });

        it('⚠ runs a hook attached AFTER retirement immediately, never never', () => {
            // A hook registered during a cascading teardown is a race, not a
            // mistake — dropping it would leak the resource it releases.
            const lt = createLifetime('generate', 1);
            lt.retire('superseded');
            const release = vi.fn();
            lt.onRetire(release);
            expect(release).toHaveBeenCalledTimes(1);
        });
    });
});

describe('the holder', () => {
    it('⛔ retires the previous arm BEFORE the next one exists', () => {
        // The window in which two arms are both alive is the state the
        // reload used to make unreachable; the order is what closes it.
        const holder = createLifetimeHolder();
        const first = holder.start('solve');
        let bothAlive = false;
        first.onRetire(() => { bothAlive = holder.current() !== null && holder.current() !== first; });
        const second = holder.start('manual');
        expect(bothAlive).toBe(false);
        expect(first.alive()).toBe(false);
        expect(second.alive()).toBe(true);
        expect(holder.current()).toBe(second);
    });

    it('gives two mounts of the SAME arm distinct generations', () => {
        // solve → manual → solve is the leak case, and two rows both called
        // "solve" would hide which one leaked.
        const holder = createLifetimeHolder();
        holder.start('solve');
        holder.start('manual');
        const third = holder.start('solve');
        expect(third.generation).toBe(3);
        expect(holder.state().retired.map((r) => `${r.name}#${r.generation}`))
            .toEqual(['solve#1', 'manual#2']);
    });

    it('⛓ keeps the RETIRED arms, because the leak question is about the past', () => {
        const holder = createLifetimeHolder();
        const solve = holder.start('solve');
        const tick = solve.guard('manual-frame', () => {});
        tick();
        holder.start('manual');
        tick();
        const [retired] = holder.state().retired;
        expect(retired.alive).toBe(false);
        expect(retired.stopped).toEqual(['manual-frame']);
        expect(retired.retiredWhy).toContain('manual');
    });

    it('bounds the history rather than growing it for the life of the tab', () => {
        const holder = createLifetimeHolder({ keep: 2 });
        for (const n of ['a', 'b', 'c', 'd']) holder.start(n);
        expect(holder.state().retired.map((r) => r.name)).toEqual(['b', 'c']);
    });

    it('publishes on every change, and the state is re-read at call time', () => {
        const seen = [];
        const holder = createLifetimeHolder({ publish: (s) => seen.push(s) });
        const lt = holder.start('solve');
        expect(seen).toHaveLength(1);
        expect(seen[0].current.listeners).toBe(0);
        lt.on(fakeTarget(), 'input', () => {});
        // ⚠ The published snapshot is of its own instant; `state()` is the
        // live reading. A readout assigned from a getter at mount time would
        // report the count from before the arm finished mounting.
        expect(seen[0].current.listeners).toBe(0);
        expect(holder.state().current.listeners).toBe(1);
    });

    it('retires on page teardown with nothing taking over', () => {
        const holder = createLifetimeHolder();
        holder.start('solve');
        expect(holder.retire('the page was unloaded')).toBe(true);
        expect(holder.current()).toBeNull();
        expect(holder.state().retired[0].retiredWhy).toBe('the page was unloaded');
        expect(holder.retire('again')).toBe(false);
    });
});

// ── the structural row ───────────────────────────────────────────────────

describe('⛔ every listener in the page goes through a lifetime', () => {
    /**
     * The mechanism can only witness what it registered. A bare
     * `addEventListener` in the page is therefore invisible to the readout —
     * the leak would sit beside a report of a clean teardown, which is the
     * "graceful skip hides the surface" shape applied to the check itself.
     *
     * ⚠ ASSERTED OVER THE SOURCE, because there is no runtime moment at which
     * a listener nobody registered through the holder can be counted. This is
     * the same discipline `TRUE_START_CHAIN` uses: a value checked across the
     * boundary it cannot be imported across.
     */
    const source = (name) => readFileSync(join(HERE, name), 'utf8');

    it('watchViewer.js calls addEventListener nowhere directly', () => {
        /**
         * ⚠ THE FIRST CUT OF THIS ROW PASSED VACUOUSLY, and the pattern is
         * worth keeping: it matched `/(?<![\w.])addEventListener\(/`, whose
         * negative lookbehind excludes a leading dot — so it skipped
         * `window.addEventListener(`, which is EVERY call it was written to
         * catch. It went green against the five live listeners it was meant
         * to fail on. A structural check that cannot fail against the code it
         * was written for is a check of nothing; this one is deliberately
         * blunt, and the only legal call site lives in another file.
         */
        const offenders = source('watchViewer.js')
            .split('\n')
            .map((line, i) => ({ line: line.trim(), n: i + 1 }))
            .filter((r) => /addEventListener\s*\(/.test(r.line))
            .map((r) => `watchViewer.js:${r.n}  ${r.line}`);
        expect(offenders).toEqual([]);
    });

    it('the lifetime module is the ONE place that calls it', () => {
        // Belt and braces on the rule above: if the wrapper ever stopped
        // calling it, every `lifetime.on` in the page would be a silent no-op
        // and the tests above would still pass on stubs.
        //
        // ⛓ CONSTRUCTIVE-MODE slice 3: the implementation moved to
        // `procgenCore/pageLifetime.js` (the maze lab page needs the same
        // teardown and may not import `seedlingDemo/`). ⛔ The row is REPOINTED,
        // never relaxed — it still asserts the real call site, at its real path.
        expect(source('../procgenCore/pageLifetime.js')).toMatch(/target\.addEventListener\(/);
    });

    it('the seedlingDemo spelling is a RE-EXPORT, not a second copy', () => {
        /**
         * ⛓ The other half of the move. A shim that exported only
         * `createLifetimeHolder` would leave `watchViewer.js`'s `createLifetime`
         * import undefined at load — a page that dies on boot, which no unit
         * test above would see because they all import the names directly.
         * ⛔ And a shim that RE-IMPLEMENTED anything would be the second copy
         * the move exists to prevent, so the file is asserted to hold no
         * `addEventListener` of its own.
         */
        const shim = source('watchLifetime.js');
        expect(shim).toMatch(/from '\.\.\/procgenCore\/pageLifetime\.js'/);
        expect(shim).not.toMatch(/addEventListener\s*\(/);
        for (const name of ['createLifetime', 'createLifetimeHolder', 'WatchLifetimeError',
            'PageLifetimeError']) {
            expect(shim, name).toContain(name);
        }
    });
});
