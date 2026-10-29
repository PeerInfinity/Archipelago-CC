/**
 * SPHERE-ORDER-9 (session tile-primitives-sphere-order-9, ⚖ 2026-10-29 "Forced pull, rules' disc"): L80's LavaTraps on the smallest
 * compiles that have them. A LavaTrap's tongue reels the player onto its own tile across lava or a pit within 32 px, released with the
 * Dark Suit (`LavaTrap.as:22,56-90`); the rules producer prices each one as a one-way Dark Suit lift (`applyLavaTrapPulls` over
 * `lavaTrapPulls`). Its rows are walked by the world's `pulls`, so L80 is one level world — where its two crossings out of r8c1 no longer
 * share one exit cell (main walled r8c1 → r6c4 there). L78's three traps have two whose discs one step enters at once: their pulls are
 * DROPPED by name and L78 projects as before.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { PLAYTHROUGH_MAP, playthroughAnalyzerOptions, playthroughHandRuledGridFor } from '../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { lavaTrapPulls } from '../../flashPanel/seedlingPlaythroughOverlay.js';
import { seedlingLevelEntities } from '../../flashPanel/seedlingAtlasAnalysis.js';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { chainedPull } from '../../procgenPipeline/regionAtlasMazeProjection.js';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const SUIT = { rule: 'Has', args: { item_name: 'Dark Suit' } };
const levelOf = (n) => (PLAYTHROUGH_MAP.levels ?? PLAYTHROUGH_MAP).find((l) => l.level === n);
const payloadOf = (rules, level) => Object.values(rules.preset_sidecars['1'])
    .find((s) => s.playable_payload?.atlas_region === level && s.playable_payload.shared_world)?.playable_payload;

describe('the analysis rows: the rules producer\'s own discs', () => {
    it('L80\'s two LavaTraps are `pull` rows carrying `lavaTrapPulls` and the Dark Suit', () => {
        const level = levelOf(80);
        const rows = seedlingLevelEntities(level, playthroughAnalyzerOptions.resolveCondition, { grid: playthroughHandRuledGridFor(level) })
            .filter((r) => r.kind === 'pull');
        // entity order (the map's), the producer's sorted row-major
        expect(rows.map((r) => r.tiles[0])).toEqual([[2, 14], [5, 6]]);
        expect(rows.map((r) => ({ tiles: r.tiles, from: r.from, rule: r.rule })).reverse()).toEqual(
            lavaTrapPulls(level, 16).map((p) => ({ tiles: [p.tile], from: p.from, rule: SUIT })));
    });
});

/**
 * The cut carries L79 too: r16c1 is L80's member L79's stairs land in, and only a member an AP crossing enters from outside is
 * priced from its own arrival. Without L79 (the preset at sphere 8.5) r16c1, r12c3 and r8c4 are entered from no root, so the
 * pulls are not exercised there — the whole-game run and this cut are where they are.
 */
describe('L80 in the maze (L71 + L79 + L80)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_71', 'level_79', 'level_80'] }).text);
    const pp = payloadOf(RULES, 'level_80');

    it('is ONE level world whose pulls are the producer\'s discs on its floor, gated on the Dark Suit', () => {
        expect(pp, 'L80 is a level world').toBeDefined();
        expect(pp.pulls.map((p) => [p.x, p.y])).toEqual([[2, 14], [5, 6]]);
        for (const p of pp.pulls) {
            const disc = lavaTrapPulls(levelOf(80), 16).find((q) => q.tile[0] === p.x && q.tile[1] === p.y).from;
            expect(p.from.map((c) => [c.x, c.y]).every(([x, y]) => disc.some(([dx, dy]) => dx === x && dy === y))).toBe(true);
            expect(pp.obstacleLib[p.gate]).toMatchObject({ kind: 'pull', clear_set_type: 'rule', clear_rule: SUIT });
        }
        expect(pp.pulls[0].from).toContainEqual({ x: 2, y: 16 }); // r16c1's way up, 32 px below the trap
        expect(() => deserializeMazeWorld(pp)).not.toThrow();
    });

    it('certifies clean (main: r16c1 → r12c3, r8c1 → r6c4 and r8c4 → r6c4 "not priced")', () => {
        const regions = Object.keys(RULES.preset_sidecars['1']).filter((n) => n.startsWith('level_80'));
        const out = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions });
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        // the lift is priced by the pull: r16c1 reaches all of L80 holding the Dark Suit
        expect(out.lines).toEqual(expect.arrayContaining([
            'level_80__r16c1>level_80__r12c3=[["Dark Suit"]]', 'level_80__r16c1>level_80__r6c4=[["Dark Suit"]]',
            'level_80__r8c1@Level 080 - Chest<level_80__r16c1=[["Dark Suit"]]',
        ]));
    });

    it('the scripted tile definition agrees with the native engine on every line (the pulls walked by both)', () => {
        const regions = Object.keys(RULES.preset_sidecars['1']).filter((n) => n.startsWith('level_80'));
        const native = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions });
        const scripted = certifyPlaythroughMaze(RULES, HELPERS, { native: false, atlas: ATLAS, regions });
        expect(scripted.problems).toEqual([]);
        expect([...scripted.lines].sort()).toEqual([...native.lines].sort());
    });

    it('mutant control: a broken `pulled` helper makes the scripted arm disagree with the native one', () => {
        const regions = Object.keys(RULES.preset_sidecars['1']).filter((n) => n.startsWith('level_80'));
        const native = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions });
        const broken = { ...HELPERS, pulled: { ...HELPERS.pulled, body: { type: 'constant', value: false } } };
        const scripted = certifyPlaythroughMaze(RULES, broken, { native: false, atlas: ATLAS, regions });
        expect(scripted.problems).toContain('level_80__r16c1 → level_80__r12c3 holding [Dark Suit]: derived false, atlas true');
        expect([...scripted.lines].sort()).not.toEqual([...native.lines].sort());
    });

    it('mutant control: with the pulls stripped from the world the lifts are not priced again', () => {
        const copy = structuredClone(RULES);
        delete payloadOf(copy, 'level_80').pulls;
        const regions = Object.keys(copy.preset_sidecars['1']).filter((n) => n.startsWith('level_80'));
        const out = certifyPlaythroughMaze(copy, HELPERS, { native: true, atlas: ATLAS, regions });
        expect(out.problems).toContain('level_80__r16c1 → level_80__r12c3 holding [Dark Suit]: derived false, atlas true');
        expect(out.problems).toHaveLength(6);
    });
});

describe('chained pulls are refused by name, and no level of the whole game has one', () => {
    it('`chainedPull` names a trap standing in another\'s disc', () => {
        expect(chainedPull([{ x: 5, y: 1, from: [{ x: 3, y: 1 }] }, { x: 3, y: 1, from: [{ x: 2, y: 1 }] }]))
            .toBe('trap at (3,1) lies in the disc of trap at (5,1): chained pulls are not modelled');
        expect(chainedPull([{ x: 5, y: 1, from: [{ x: 4, y: 1 }] }, { x: 1, y: 1, from: [{ x: 2, y: 1 }] }])).toBeNull();
    });
    it('L77, L78, L80, L108: no trap lies in another\'s disc (L108\'s are 48 px apart, the disc 32)', () => {
        for (const n of [77, 78, 80, 108]) {
            const rows = lavaTrapPulls(levelOf(n), 16).map((p) => ({ x: p.tile[0], y: p.tile[1], from: p.from.map(([x, y]) => ({ x, y })) }));
            expect(chainedPull(rows), `L${n}`).toBeNull();
        }
    });
});

describe('L78: one step into two discs at once is not settled', () => {
    const built = buildPlaythroughMaze({ levels: ['level_78'] });
    it('its pulls are dropped by name and it projects as it did without them', () => {
        const notes = (built.report.maze_notes ?? []).filter((n) => n.region_id === 'level_78' && n.kind === 'pull_ambiguous_dropped');
        expect(notes.map((n) => n.message)).toEqual(['traps at (6,5) and (9,6) both grab the step 8,4 → 8,5 — its 3 pull(s) are not modelled']);
        const rules = JSON.parse(built.text);
        expect(Object.values(rules.preset_sidecars['1']).some((s) => s.playable_payload?.pulls)).toBe(false);
    });
});
