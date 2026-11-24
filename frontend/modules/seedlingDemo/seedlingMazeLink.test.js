/**
 * SEEDLING → MAZE LINK: the EDIT arm's room → its converted maze room(s) in the maze lab, or a stated reason.
 *
 * Driven over the committed documents from disk (the preset index, the Seedling presets' rules, the map document,
 * the editor's vanilla set) through the same injected `fetchJson` the page uses over HTTP. Measured 2026-11-14 at
 * 6bb35ce5a0: 116 vanilla levels, all distinct by content; 115 have a converted maze room and one (level 81, which no
 * door reaches and the playthrough atlas has no region for) has none; 126 maze rooms = the playthrough maze preset's
 * 116 rooms + the atlas maze preset's 10. ⛔ No preset name and no level list in the module: the rows below derive
 * their expectations from the same documents and only the measured numbers are asserted.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openPresetRegion } from '../mazeRoom/mazeLabPreset.js';
import { mapDocumentPath } from '../flashPanel/mapDocumentPath.js';
import { SEEDLING_SET_PATCHES, applySetPatches } from './seedlingSetPatches.js';
import { editorVanillaSet } from './watchSetEditor.js';
import {
    MAZE_LAB_PAGE, findMazeCounterparts, identifyVanillaLevel, mazeLabUrl, mazeLinkFor, roomContentKey,
} from './seedlingMazeLink.js';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();
const fromDisk = async (path) => {
    if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(FRONTEND, path), 'utf8')));
    return cache.get(path);
};
const MAP_NAME = mapDocumentPath(null).name;
const MAP = JSON.parse(readFileSync(join(FRONTEND, mapDocumentPath(null).path), 'utf8'));
const EMBED = JSON.parse(readFileSync(join(FRONTEND, 'modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));
const LEVELS = MAP.levels;
const counterparts = () => findMazeCounterparts({ mapDoc: MAP, mapName: MAP_NAME, fetchJson: fromDisk });
const linkOf = async (record, extra = {}) => mazeLinkFor({
    baseRecord: record, baseKind: 'atlas', mapDoc: MAP, counterparts: await counterparts(), ...extra,
});

describe('which vanilla level a room is, by content', () => {
    it('a map-document level is identified as itself, and the content keys are distinct', () => {
        expect(LEVELS.length).toBe(116);
        expect(new Set(LEVELS.map(roomContentKey)).size).toBe(LEVELS.length);
        for (const l of LEVELS) expect(identifyVanillaLevel(l, MAP)).toEqual(expect.objectContaining({ level: l.level }));
    });

    it('every room of the editor\'s vanilla set (whose records carry no level or path) is identified by content', () => {
        const { set } = editorVanillaSet(EMBED, MAP);
        expect(set.rooms.length).toBe(116);
        const got = set.rooms.map((r) => identifyVanillaLevel(r.source.record, MAP)?.level);
        expect(got.every(Number.isInteger)).toBe(true);
        expect(new Set(got).size).toBe(set.rooms.length);
    });

    it('a delivered (patched) room is its level, marked delivered and naming the patches; the game room names them too', () => {
        const delivered = applySetPatches(LEVELS);
        const patched = [...new Set(SEEDLING_SET_PATCHES.map((p) => p.level))];
        expect(patched.length).toBeGreaterThan(0);
        for (const level of patched) {
            const ids = SEEDLING_SET_PATCHES.filter((p) => p.level === level).map((p) => p.id);
            const room = delivered.find((l) => l.level === level);
            expect(identifyVanillaLevel(room, MAP)).toEqual({ level, delivered: true, patchIds: ids });
            const game = LEVELS.find((l) => l.level === level);
            expect(identifyVanillaLevel(game, MAP)).toEqual({ level, delivered: false, patchIds: ids });
        }
    });

    it('a room whose content matches no vanilla level is no level (one entity gone; the size changed)', () => {
        const l = LEVELS.find((x) => x.level === 5);
        expect(l.entities.length).toBeGreaterThan(0);
        const changed = { ...l, entities: l.entities.slice(1) };
        expect(identifyVanillaLevel(changed, MAP)).toBeNull();
        expect(identifyVanillaLevel({ ...l, width: l.width + 1 }, MAP)).toBeNull();
    });
});

describe('which maze rooms convert a level, read off the preset index and rules', () => {
    it('every converted room opens through the maze lab\'s own resolver as itself, at its level, whole-level sized', async () => {
        const c = await counterparts();
        const rooms = [...c.byLevel.entries()].flatMap(([level, rs]) => rs.map((r) => ({ level, ...r })));
        expect(c.byLevel.size).toBe(115);
        expect(rooms.length).toBe(126);
        expect(c.skipped).toEqual([]);
        const perSpec = {};
        for (const r of rooms) perSpec[r.spec] = (perSpec[r.spec] ?? 0) + 1;
        expect(Object.values(perSpec).sort((a, b) => a - b)).toEqual([10, 116]);
        for (const r of rooms) {
            const hit = await openPresetRegion({ preset: r.spec, region: r.region, fetchJson: fromDisk });
            expect(hit.room).toBe(r.region);
            const pp = hit.sidecar.playable_payload;
            const level = LEVELS.find((l) => l.level === r.level);
            expect([pp.level, pp.width, pp.height]).toEqual([r.level, level.width, level.height]);
            const url = new URL(mazeLabUrl(r.spec, r.region), 'http://x/frontend/');
            expect(url.pathname).toBe(`/frontend/${MAZE_LAB_PAGE}`);
            expect(Object.fromEntries(url.searchParams)).toEqual({ source: 'edit', preset: r.spec, region: r.region });
        }
    });

    it('the levels with no converted room are exactly the ones no rules document gives a maze room, with the reason', async () => {
        const c = await counterparts();
        const without = LEVELS.map((l) => l.level).filter((n) => !c.byLevel.has(n));
        expect(without).toEqual([81]);
        const link = await linkOf(LEVELS.find((l) => l.level === 81));
        expect(link.ok).toBe(false);
        expect(link.reason).toContain('no maze preset converts level 81');
        for (const spec of c.searched) expect(link.reason).toContain(spec);
    });

    it('several rooms of one level are all offered, the preset that converts the most levels first', async () => {
        const c = await counterparts();
        const coverage = (spec) => new Set([...c.byLevel.entries()]
            .filter(([, rs]) => rs.some((r) => r.spec === spec)).map(([n]) => n)).size;
        const multi = [...c.byLevel.entries()].filter(([, rs]) => new Set(rs.map((r) => r.spec)).size > 1);
        expect(multi.length).toBeGreaterThan(0);
        for (const [, rs] of multi) {
            const cov = rs.map((r) => coverage(r.spec));
            expect(cov).toEqual([...cov].sort((a, b) => b - a));
        }
        const link = await linkOf(LEVELS.find((l) => l.level === multi[0][0]));
        expect(link.options.map((o) => o.region)).toEqual(multi[0][1].map((r) => r.region));
    });
});

describe('what the link says for the room the editor holds', () => {
    it('an unedited vanilla room links to its counterpart(s) with no edit note', async () => {
        const l = LEVELS.find((x) => x.level === 5);
        const link = await linkOf(l);
        expect(link.ok).toBe(true);
        expect(link.level).toBe(5);
        expect(link.options.length).toBeGreaterThan(0);
        expect(link.notes.join(' ')).not.toContain('UNEDITED');
    });

    it('an edited room links to the UNEDITED original and says how many edits the maze lab will not show', async () => {
        const l = LEVELS.find((x) => x.level === 5);
        const plain = await linkOf(l);
        const edited = await linkOf(l, { edits: 3 });
        expect(edited.options).toEqual(plain.options);
        expect(edited.notes.join(' ')).toContain('UNEDITED original of level 5');
        expect(edited.notes.join(' ')).toContain('3 edit(s)');
    });

    it('a generated room has no link, by name', async () => {
        const link = await linkOf(LEVELS[0], { baseKind: 'generate' });
        expect(link).toEqual({ ok: false, reason: expect.stringContaining('GENERATED room has no maze conversion') });
    });

    it('a room matching no vanilla level has no link, by name', async () => {
        const l = LEVELS.find((x) => x.level === 5);
        const link = await linkOf({ ...l, width: l.width + 1 });
        expect(link).toEqual({ ok: false, reason: expect.stringContaining('matches no vanilla level') });
    });

    it('a patched level\'s link names the delivered set\'s patches', async () => {
        const [p] = SEEDLING_SET_PATCHES;
        const game = await linkOf(LEVELS.find((l) => l.level === p.level));
        expect(game.notes.join(' ')).toContain(`delivers level ${p.level} patched`);
        const delivered = await linkOf(applySetPatches(LEVELS).find((l) => l.level === p.level));
        expect(delivered.options).toEqual(game.options);
        expect(delivered.notes.join(' ')).toContain('as the randomizer DELIVERS it');
    });
});

describe('the search, on synthetic documents (what is NOT a counterpart)', () => {
    const maze = (level, extra = {}) => ({ substrate: 'maze', playable_payload: { level, width: 1, height: 1 }, ...extra });
    const rulesWith = (sidecars, mapDocument = MAP_NAME) => ({
        region_atlas: { 1: { atlas_id: 'x', game: MAP.game, map_document: mapDocument } },
        preset_sidecars: { 1: sidecars },
    });
    const run = (docs) => findMazeCounterparts({
        mapDoc: MAP, mapName: MAP_NAME,
        fetchJson: async (path) => { if (!(path in docs)) throw new Error(`no ${path}`); return docs[path]; },
    });
    const folder = (game, files = ['r_rules.json']) => ({ folders: { F: { games: [{ game }], files, has_procgen_data: true } } });

    it('only the map document\'s own game, only its own map, only maze sidecars with a level number', async () => {
        const c = await run({
            'presets/preset_files.json': { a: folder(MAP.game), b: folder('other game'), c: folder(MAP.game) },
            'presets/a/F/r_rules.json': rulesWith({
                room_a: maze(3),
                not_maze: { substrate: 'flash_seedling', playable_payload: { level: 4 } },
                no_level: { substrate: 'maze', playable_payload: { width: 1 } },
            }),
            'presets/b/F/r_rules.json': rulesWith({ room_b: maze(3) }),
            'presets/c/F/r_rules.json': rulesWith({ room_c: maze(3) }, 'another-map.json'),
        });
        expect(c.searched).toEqual(['a', 'c']);
        expect([...c.byLevel.keys()]).toEqual([3]);
        expect(c.byLevel.get(3).map((r) => r.region)).toEqual(['room_a']);
    });

    it('a region the maze lab would refuse is skipped with its reason, and an unreadable rules file is skipped too', async () => {
        const c = await run({
            'presets/preset_files.json': { a: folder(MAP.game), gone: folder(MAP.game) },
            'presets/a/F/r_rules.json': {
                ...rulesWith({ twice: maze(3) }),
                preset_sidecars: { 1: { twice: maze(3) }, 2: { twice: maze(3) } },
            },
        });
        expect(c.byLevel.size).toBe(0);
        expect(c.skipped.map((s) => s.spec).sort()).toEqual(['a', 'a', 'gone']);
        expect(c.skipped.find((s) => s.region === 'twice').why).toContain('2 players');
    });

    it('an unreadable preset index is a thrown error (the page shows it), not an empty answer', async () => {
        await expect(run({})).rejects.toThrow('no presets/preset_files.json');
    });
});
