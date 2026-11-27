/**
 * ENGINE NIT (B): the pull-disc fixture (rules-lavatrap-pull-line recorded it; rules-engine-nit-b FIXED the half that was loose).
 *
 * A pull breaks monotonicity: holding its gate (the Dark Suit) a step into its disc from outside is REELED onto the trap
 * (`mazeRoomEngine.pullAfterMove`), so a cell reachable WITHOUT the suit can be unreachable WITH it. The rules are monotone-safe
 * exactly when the pull disc equals rule T's tongue disc (a disc cell the tongue kills on is gated, so the reel only removes
 * cells the suit-less walk could not stand on either).
 *
 * Rule K's pass-1 sketch (origin/claude/rules-k-pursuit-speed-0s83t8 @b66f327267, its STOP) hit it: K isolates L78 (11,6) as
 * sub-region r6c11, main's disc reels from (11,6) though the wall (10,6) blocks the tongue's line (`LavaTrap.as:86-88`), and
 * every pair into r6c11 came back unreachable. This file pins that, on K's own payload (a TEST-ONLY fixture, outside the
 * engine closure).
 *
 * ⛓ WHY THE FIRST ROW STAYS (rules-engine-nit-b): the Dark Suit is never shed in play (`learnLattice.pullUpSet` cites the AS3),
 * and an AP rule is UPWARD-CLOSED — a set granted is granted with every superset. A grant at S therefore needs EVERY lattice
 * point ⊇ S to reach, the full point among them; when the full point misses r6c11, no S qualifies, so `unreachable` is the
 * SOUND answer, not a false prune (over-strict only against a model that let the player drop the suit). The half that was
 * really loose is the `covered` skip, which granted supersets it never searched: the up-set guard closes it, and
 * `deriveLevelWorldLogic.pullUpSet.test.js` pins it on a synthetic world (red with the guard off). The uncut disc is still
 * the WRONG disc for the game (the tongue's line is blocked); the line-cut disc is what `lavaTrapPulls` emits.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const { payload: K_L78 } = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/l78-k-sketch-pull-nit-payload.json.gz', import.meta.url))));
const TARGET = 'level_78__r6c11';
const FROM = 'level_78__r0c16';
const CUT = [[11, 6], [9, 8]]; // trap (9,6)'s disc cells whose line to the trap crosses a wall: (10,6) and (9,7)
const pullAt = (p, x, y) => p.pulls.find((q) => q.x === x && q.y === y);
const derive = (payload) => deriveLevelWorldLogic(deserializeMazeWorld(payload), HELPERS, { native: true });
const pair = (out) => out.pairs.find((p) => p.from === FROM && p.to === TARGET);

describe('engine nit (B): reach is not monotone under a pull disc wider than its tongue disc', () => {
    it('the fixture is K\'s L78: r6c11 is the one cell (11,6), and trap (9,6)\'s disc holds the two wall-blocked cells', () => {
        const rows = K_L78.shared_world.rows;
        const owner = K_L78.shared_world.regions.indexOf(TARGET);
        expect(owner).toBeGreaterThanOrEqual(0);
        const cells = rows.flatMap((r, y) => [...r].map((ch, x) => [ch, x, y])).filter(([ch]) => ch !== '.')
            .filter(([ch]) => ch === rows[6][11]).map(([, x, y]) => [x, y]);
        expect(cells).toEqual([[11, 6]]);
        const from = pullAt(K_L78, 9, 6).from.map((c) => [c.x, c.y]);
        for (const c of CUT) expect(from).toContainEqual(c);
    });

    it('UNCUT disc (main before the line test): every pair into r6c11 is unreachable — sound under upward closure, pinned', () => {
        const out = derive(K_L78);
        expect(pair(out).unreachable).toBe(true);
        expect(out.pairs.filter((p) => p.to === TARGET).every((p) => p.unreachable)).toBe(true);
    });

    it('LINE-CUT disc (lavaTrapPulls now): the pair derives, and the suit-less arms are among its minimal sets', () => {
        const cut = structuredClone(K_L78);
        const p = pullAt(cut, 9, 6);
        p.from = p.from.filter((c) => !CUT.some(([x, y]) => c.x === x && c.y === y));
        const out = derive(cut);
        expect(pair(out).unreachable).toBe(false);
        expect(pair(out).minimal).toContainEqual(['Ghost Spear']);
        expect(pair(out).minimal.some((m) => !m.includes('Dark Suit'))).toBe(true);
    });
});
