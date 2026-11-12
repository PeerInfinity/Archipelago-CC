/**
 * MAZE CONVERTED LINK (step 2 of 3): `lab.html?preset=<id>&region=<name>` opens one room of a committed preset.
 * `mazeLabPreset` resolves the two names over the real documents (`presets/preset_files.json` → the preset's rules →
 * `preset_sidecars[player][region]`), and the page hands the sidecar to `loadPayload` (step 1's ONE loader).
 *
 * Driven over the committed `seedling_playthrough_maze` preset from disk through the same `openPresetRegion` the page
 * runs over HTTP. Measured there (2026-11-12, after no-hit): 266 regions = 116 rooms + 150 room-less regions of 55
 * shared level worlds; every room-less region is listed by exactly one room's `playable_payload.shared_world.regions`
 * (62 rooms hold a shared world, 54 are rooms of their own), so every region resolves and none is refused.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_BOUNDS } from '../procgenCore/levelGenerator.js';
import { MazeLabError, labPayload, loadPayload, readLabParams, writeLabParams } from './mazeLab.js';
import {
    PRESET_INDEX_PATH, describePresetLink, openPresetRegion, presetRulesPath, resolvePresetRegion,
} from './mazeLabPreset.js';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();
const fromDisk = async (path) => {
    if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(FRONTEND, path), 'utf8')));
    return cache.get(path);
};
const INDEX = JSON.parse(readFileSync(join(FRONTEND, PRESET_INDEX_PATH), 'utf8'));
const PRESET = 'seedling_playthrough_maze';
const RULES_PATH = presetRulesPath(INDEX, PRESET).path;
const RULES = JSON.parse(readFileSync(join(FRONTEND, RULES_PATH), 'utf8'));
const [PLAYER] = Object.keys(RULES.preset_sidecars);
const SIDECARS = RULES.preset_sidecars[PLAYER];
const REGIONS = Object.keys(SIDECARS);
const isRoom = (k) => SIDECARS[k].playable_payload !== undefined;
const open = (region, preset = PRESET) => openPresetRegion({ preset, region, fetchJson: fromDisk });
const refusal = async (p) => {
    try { await p; } catch (e) { return e; }
    return null;
};

describe('maze converted link — the resolver over the real preset', () => {
    it('the preset resolves to its one folder and its one whole rules file (no per-player slice)', () => {
        const where = presetRulesPath(INDEX, PRESET);
        expect(where.preset).toBe(PRESET);
        expect(Object.keys(INDEX[PRESET].folders)).toEqual([where.folder]);
        expect(where.path).toBe(`presets/${PRESET}/${where.folder}/${where.file}`);
        expect(where.file.endsWith('_rules.json')).toBe(true);
        expect(existsSync(join(FRONTEND, where.path))).toBe(true);
        expect(presetRulesPath(INDEX, `${PRESET}/${where.folder}`)).toEqual(where);
    });

    it('every region resolves: a room opens itself, a room-less region opens the ONE room whose shared world lists it', () => {
        const counts = { self: 0, viaHolder: 0 };
        const holders = new Map();
        for (const region of REGIONS) {
            const hit = resolvePresetRegion(RULES, region, { preset: PRESET });
            expect(hit.player).toBe(PLAYER);
            expect(hit.region).toBe(region);
            expect(isRoom(hit.room)).toBe(true);
            expect(hit.sidecar).toBe(SIDECARS[hit.room]);
            if (isRoom(region)) {
                expect(hit.room).toBe(region);
                counts.self += 1;
            } else {
                expect(hit.room).not.toBe(region);
                expect(hit.sharedWorld).toBe(SIDECARS[region].shared_world);
                expect(SIDECARS[hit.room].shared_world).toBe(hit.sharedWorld);
                expect(SIDECARS[hit.room].playable_payload.shared_world.regions).toContain(region);
                holders.set(hit.sharedWorld, hit.room);
                counts.viaHolder += 1;
            }
        }
        // Measured on the committed preset after no-hit (266 = 116 + 150; 55 shared worlds reached via a holder).
        expect(counts).toEqual({ self: 116, viaHolder: 150 });
        expect(holders.size).toBe(55);
    });

    it('a trap room opens BY LINK with its traps, the same level LOAD gives the sidecar', async () => {
        const trapRooms = REGIONS.filter((k) => (SIDECARS[k].playable_payload?.traps ?? []).length);
        expect(trapRooms.length).toBeGreaterThan(0);
        for (const region of trapRooms) {
            const link = await open(region);
            const state = loadPayload(link.sidecar);
            expect(state.record.traps.length).toBe(SIDECARS[region].playable_payload.traps.length);
            expect(JSON.stringify(labPayload(state))).toBe(JSON.stringify(labPayload(loadPayload(SIDECARS[region]))));
        }
    });

    it('a room-less region opens its room\'s level, and the status line names both', async () => {
        const region = REGIONS.find((k) => !isRoom(k));
        const link = await open(region);
        expect(JSON.stringify(labPayload(loadPayload(link.sidecar))))
            .toBe(JSON.stringify(labPayload(loadPayload(SIDECARS[link.room]))));
        const line = describePresetLink(link);
        expect(line).toContain(region);
        expect(line).toContain(link.room);
        expect(line).toContain(link.sharedWorld);
        expect(describePresetLink(await open(link.room))).not.toContain('no room of its own');
    });
});

describe('maze converted link — refusals by name', () => {
    it('an unknown preset, a bad spelling, an unknown folder', async () => {
        expect((await refusal(open('x', 'no_such_preset'))).message).toMatch(/"no_such_preset" is not a preset/);
        expect(() => presetRulesPath(INDEX, 'a/b/c')).toThrow(/is not a preset id/);
        expect(() => presetRulesPath(INDEX, '')).toThrow(MazeLabError);
        expect(() => presetRulesPath(INDEX, `${PRESET}/AP_nope`)).toThrow(/has no folder "AP_nope"/);
    });

    it('a preset with several folders must name one', () => {
        const multi = Object.keys(INDEX).find((k) => Object.keys(INDEX[k].folders ?? {}).length > 1);
        expect(multi).toBeTruthy();
        expect(() => presetRulesPath(INDEX, multi)).toThrow(/folders .* name one/);
    });

    it('a per-player slice is not the folder\'s rules file', () => {
        const index = { p: { folders: { F: { files: ['AP_1_P1_rules.json', 'AP_1_P2_rules.json', 'AP_1_rules.json'] } } } };
        expect(presetRulesPath(index, 'p').file).toBe('AP_1_rules.json');
        const none = { p: { folders: { F: { files: ['AP_1_P1_rules.json'] } } } };
        expect(() => presetRulesPath(none, 'p')).toThrow(/lists 0 rules files/);
    });

    it('an unknown region names the preset and the region', async () => {
        const e = await refusal(open('no_such_region'));
        expect(e).toBeInstanceOf(MazeLabError);
        expect(e.message).toContain(`${PRESET} has no region "no_such_region"`);
    });

    it('a preset with no sidecars is refused as not procgen', () => {
        expect(() => resolvePresetRegion({ items: {} }, 'r', { preset: 'plain' })).toThrow(/plain carries no `preset_sidecars`/);
    });

    it('a non-maze sidecar is refused naming its substrate', () => {
        const rules = { preset_sidecars: { 1: { r: { substrate: 'topdown', playable_payload: {} } } } };
        expect(() => resolvePresetRegion(rules, 'r')).toThrow(/is a "topdown" sidecar/);
    });

    it('a room-less region with zero or several holders is refused, counting them', () => {
        const lone = { preset_sidecars: { 1: { r: { substrate: 'maze', shared_world: 'w' } } } };
        expect(() => resolvePresetRegion(lone, 'r')).toThrow(/and 0 rooms list it/);
        const room = (regions) => ({ substrate: 'maze', shared_world: 'w', playable_payload: { shared_world: { regions } } });
        const two = { preset_sidecars: { 1: { r: { substrate: 'maze', shared_world: 'w' }, a: room(['a', 'r']), b: room(['b', 'r']) } } };
        expect(() => resolvePresetRegion(two, 'r')).toThrow(/and 2 rooms list it \(a, b\)/);
        // The holder is the room that LISTS the region, not any room of the same world.
        const one = { preset_sidecars: { 1: { r: { substrate: 'maze', shared_world: 'w' }, a: room(['a']), b: room(['b', 'r']) } } };
        expect(resolvePresetRegion(one, 'r').room).toBe('b');
    });

    it('a region in two players\' sidecars is refused', () => {
        const s = { substrate: 'maze', playable_payload: {} };
        expect(() => resolvePresetRegion({ preset_sidecars: { 1: { r: s }, 2: { r: s } } }, 'r'))
            .toThrow(/sidecars of 2 players \(1, 2\)/);
    });

    it('a fetch failure names the document it was fetching', async () => {
        const e = await refusal(openPresetRegion({
            preset: PRESET, region: 'r', fetchJson: async () => { throw new Error('HTTP 404'); },
        }));
        expect(e.message).toContain(`could not fetch the preset index ${PRESET_INDEX_PATH} (HTTP 404)`);
    });
});

describe('maze converted link — the URL grammar', () => {
    it('the reader takes both, refuses one alone, an empty one, and either beside ?gen=', () => {
        expect(readLabParams('')).toMatchObject({ preset: null, region: null });
        expect(readLabParams('?source=edit&preset=p&region=r')).toMatchObject({ source: 'edit', preset: 'p', region: 'r' });
        expect(() => readLabParams('?preset=p')).toThrow(/\?preset= without \?region=/);
        expect(() => readLabParams('?region=r')).toThrow(/\?region= without \?preset=/);
        expect(() => readLabParams('?preset=&region=r')).toThrow(/both must name something/);
        expect(() => readLabParams('?preset=p&region=r&gen=/x.json')).toThrow(/both name a level/);
    });

    const args = {
        seed: 1, biome: 'maze-v1', width: 20, height: 20, bounds: DEFAULT_BOUNDS, budget: { maxExpansions: 20000 }, step: 0,
    };
    it('the writer keeps the link while its room is on screen and drops it otherwise', () => {
        const kept = new URLSearchParams(writeLabParams('?preset=p&region=r', { ...args, presetLink: { preset: 'p', region: 'r' } }));
        expect([kept.get('preset'), kept.get('region')]).toEqual(['p', 'r']);
        const back = readLabParams(`?${kept}`);
        expect([back.preset, back.region]).toEqual(['p', 'r']);
        const dropped = new URLSearchParams(writeLabParams('?preset=p&region=r', args));
        expect(dropped.has('preset') || dropped.has('region')).toBe(false);
        expect(writeLabParams('', args)).toBe(writeLabParams('', { ...args, presetLink: null }));
    });
});
