/**
 * Screen-wrap arrow asymmetry — the empirical basis for keeping
 * single-arrow gating under wrap (user question 2026-06-10: "are there
 * platform placements accessible with one arrow key but not the
 * other?"). Answer: YES, robustly — but which arrow reaches a
 * placement depends on level width and launch airtime, because wrap
 * makes the "long way around" a real route once an arc can cover
 * (width − direct distance).
 *
 * Probe shape: a two-platform level (launch L center, target T at
 * +dx, dy above, optional spring/jetpack on L), canJump under
 * {right}-only vs {left}-only.
 *
 * Findings pinned below (full sweep in the session notes):
 * - +140 (the branch-tip offset) is RIGHT-ONLY at width ≥ 600 for
 *   plain, spring AND jetpack launches → the generator's 600px width
 *   floor for arrow-gated levels.
 * - At width 420 a spring-launch +140 collapses to EITHER-arrow (the
 *   484px-apex airtime wraps 280px the other way).
 * - Asymmetry cuts both ways: at width 420 a +220 plain target is
 *   LEFT-only (direct 220 exceeds plain drift; the 200px wrap path
 *   doesn't).
 */
import { describe, it, expect } from 'vitest';
import { canJump } from './canJump.js';
import { wrapX } from './physics.js';

function probe({ width, dx, dy, launch = 'plain' }) {
    const cx = width / 2;
    const level = {
        id: 'probe',
        size: { width, height: 800 + dy },
        platforms: [
            { id: 'L', x: cx, y: 600 + dy, type: 'green' },
            { id: 'T', x: wrapX(cx + dx, width), y: 600, type: 'green' },
        ],
        springs: launch === 'spring' ? [{ id: 's', x: cx, y: 595 + dy, on: 'L' }] : [],
        jetpacks: launch === 'jetpack' ? [{ id: 'j', x: cx, y: 595 + dy, on: 'L' }] : [],
        pickups: [],
        portals: [{ id: 'e', x: cx, y: 50, on: 'T', target_region: null, direction: 'up' }],
    };
    const ab = (right, left) => ({
        right, left,
        springs: launch === 'spring',
        jetpacks: launch === 'jetpack',
        blue: false, brown: false,
    });
    return {
        right: canJump(level, 'L', 'T', ab(true, false)),
        left: canJump(level, 'L', 'T', ab(false, true)),
    };
}

describe('screen-wrap arrow asymmetry (the probe behind the width floor)', () => {
    it('+140 branch tips are right-only at width 600 for every launch type', () => {
        expect(probe({ width: 600, dx: 140, dy: 120 }))
            .toEqual({ right: true, left: false });
        expect(probe({ width: 600, dx: 140, dy: 400, launch: 'spring' }))
            .toEqual({ right: true, left: false });
        expect(probe({ width: 600, dx: 140, dy: 1100, launch: 'jetpack' }))
            .toEqual({ right: true, left: false });
    });

    it('a spring-launch +140 tip collapses to either-arrow at width 420', () => {
        expect(probe({ width: 420, dx: 140, dy: 400, launch: 'spring' }))
            .toEqual({ right: true, left: true });
    });

    it('a plain +140 tip stays right-only even at width 420', () => {
        expect(probe({ width: 420, dx: 140, dy: 120 }))
            .toEqual({ right: true, left: false });
    });

    it('asymmetry cuts both ways: +220 plain at width 420 is LEFT-only (wrap path shorter)', () => {
        expect(probe({ width: 420, dx: 220, dy: 120 }))
            .toEqual({ right: false, left: true });
    });

    it('narrow levels make everything either-arrow (spring at width 200)', () => {
        expect(probe({ width: 200, dx: 140, dy: 400, launch: 'spring' }))
            .toEqual({ right: true, left: true });
    });
});
