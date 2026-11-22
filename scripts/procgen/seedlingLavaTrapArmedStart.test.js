/**
 * ⚠ KNOWN DIVERGENCE, PINNED (slice tile-pixel-pull-disc, design-8's ruling B 2026-11-22): ARMED ON A FRESH START.
 *
 * The game spawns the player at a tile's CENTRE (`Player.as:375`). A trap's `wait` starts TRUE (`LavaTrap.as:26`) but
 * clears on the first frame the player is out of range (`:99-102`), so a player whose start CENTRE lies outside a trap's
 * range is ARMED for it at once, even when the tile is a PARTIAL cell of that trap's disc (its near edge in range). The
 * maze starts every fresh state UNARMED (`createState`), so from such a start it does not reel a step the game reels.
 * Measured (phase-2 STOP, `tile-primitives-pixel-pull-disc-landing.md` witness backlog): the faithful model would LOOSEN
 * two internal L80 pairs (r8c4 > r0c2, r8c4 > r6c5 to the Dark Suit alone, by a lift from the armed start) and tighten
 * none, so today's maze is on the STRICT side. Its fix waits for a GAME witness (stand at L80 (4,8)'s centre, step into
 * (5,6)'s disc, expect the reel).
 *
 * Row 1 pins the COUNT of derivation fresh starts (the level worlds' sub-region entrances) that lie in a centre-out
 * PARTIAL disc cell, derived from the payload and the producer's disc, so the divergence cannot grow silently.
 * Row 2 replays the L78 pull-order tape's setup (`probe-seedling-l78-pull-order.mjs` `down`: start at (8,4)'s centre with
 * the Dark Suit, hold DOWN): the game reels onto (9,6); the maze, from a fresh state there, does not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLAYTHROUGH_MAP, playthroughLavaTrapPulls } from './make-seedling-playthrough-rules.mjs';
import { LAVATRAP_PULL } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { deserializeMazeWorld, createState, step, INPUT_S } from '../../frontend/modules/mazeRoom/mazeRoomEngine.js';

const T = 16;
const MAZE = JSON.parse(readFileSync(new URL('../../frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const levelOf = (n) => (PLAYTHROUGH_MAP.levels ?? PLAYTHROUGH_MAP).find((l) => l.level === n);
const pullWorlds = () => {
    const seen = new Map();
    for (const sc of Object.values(MAZE.preset_sidecars['1'])) {
        const pl = sc.playable_payload;
        if (!pl?.shared_world || !pl.pulls?.length) continue;
        const n = Number(/level_(\d+)/.exec(pl.atlas_region)[1]);
        if (!seen.has(n)) seen.set(n, pl);
    }
    return seen;
};
/** Is the CENTRE of tile `t` out of the range of the trap on `trap` (`int(FP.distance) > chompRange`, `LavaTrap.as:81`)? */
const centreOut = (t, trap) => Math.trunc(Math.hypot((t[0] - trap[0]) * T, (t[1] - trap[1]) * T)) > LAVATRAP_PULL.chompRange;

describe('known divergence: a fresh start at a centre-out PARTIAL disc cell is armed in the game, not in the maze', () => {
    it('the derivation fresh starts in such a cell: COUNT pinned (today 1, L80 r8c4 at (4,8) in (5,6)\'s disc)', () => {
        const found = [];
        for (const [n, pl] of pullWorlds()) {
            const o = pl.shared_world.origin ?? pl.origin ?? { x: 0, y: 0 };
            const pulls = playthroughLavaTrapPulls(levelOf(n));
            for (const [region, at] of Object.entries(pl.shared_world.entrances ?? {})) {
                const cell = [at.x + (o.x ?? 0), at.y + (o.y ?? 0)];
                for (const p of pulls) {
                    if (p.partial.some((c) => c[0] === cell[0] && c[1] === cell[1]) && centreOut(cell, p.tile)) found.push(`L${n} ${region} (${cell}) in (${p.tile})`);
                }
            }
        }
        // a re-record that changes this list reds the row: review whether the divergence now loosens or tightens a row
        expect(found).toEqual(['L80 level_80__r8c4 (4,8) in (5,6)']);
    });

    it('the L78 pull-order tape\'s setup: from (8,4)\'s centre, holding DOWN, the GAME reels onto (9,6); the MAZE does not', () => {
        const pl = pullWorlds().get(78);
        const world = deserializeMazeWorld(pl);
        const at = { ...world, entrance: { x: 8, y: 4 } };
        expect(playthroughLavaTrapPulls(levelOf(78)).filter((p) => p.partial.some((c) => c[0] === 8 && c[1] === 4) && centreOut([8, 4], p.tile))
            .map((p) => String(p.tile))).toEqual(['6,5', '9,6']); // the traps the game arms at that start
        // a gate on (8,5) wants an arm besides the suit; the pull's own gate is the suit
        const s = { ...createState(at), inventory: new Set(['Dark Suit', 'Progressive Sword']) };
        expect(s.pullArmed).toEqual([]); // the maze: unarmed
        const next = step(at, s, INPUT_S);
        expect(next.player_pos).toEqual({ x: 8, y: 5 }); // the maze's answer (KNOWN DIVERGENCE): unreeled
        // the GAME's answer (the tape): reeled onto (9,6) — what a fix must turn this row into
        expect(next.player_pos).not.toEqual({ x: 9, y: 6 });
    });
});
