/**
 * MAZE SEEDLING LINK (⚖ Robert 2026-11-14 "Link back: maze lab → Seedling"): a maze room converted from a Seedling
 * level links to `seedlingDemo/watch.html?source=edit&level=<N>`. Driven over EVERY committed preset from disk, through
 * the same `openPresetRegion` the page runs over HTTP.
 *
 * Measured at main 9b99178fa7 (2026-11-14): of all maze rooms (sidecars carrying `playable_payload`) in every preset,
 * 126 carry an integer `level` — 116 in seedling_playthrough_maze, 10 in seedling_atlas_maze — over 115 distinct levels,
 * and both presets declare `region_atlas["1"].map_document = seedling-map.json`, the editor's own map. Every one links;
 * every other maze room carries no level and gets no link. The 150 room-less regions open their shared world's room,
 * whose level they link to.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapDocumentPath } from '../flashPanel/mapDocumentPath.js';
import { levelOfPayload } from './mazeLab.js';
import { PRESET_INDEX_PATH, openPresetRegion, presetRulesPath } from './mazeLabPreset.js';
import {
    SEEDLING_EDITOR_PAGE, seedlingEditorMap, seedlingEditorUrl, seedlingLinkFor, seedlingOriginOf,
} from './mazeSeedlingLink.js';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cache = new Map();
const fromDisk = async (path) => {
    if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(FRONTEND, path), 'utf8')));
    return cache.get(path);
};
const INDEX = JSON.parse(readFileSync(join(FRONTEND, PRESET_INDEX_PATH), 'utf8'));

/** Every preset folder the index names whose ONE rules file exists, as `{spec, rules}` (found by shape, not name). */
const PRESETS = Object.entries(INDEX).flatMap(([id, e]) => {
    const folders = Object.keys(e?.folders ?? {});
    return folders.flatMap((folder) => {
        const spec = folders.length === 1 ? id : `${id}/${folder}`;
        let where;
        try { where = presetRulesPath(INDEX, spec); } catch { return []; }
        if (!existsSync(join(FRONTEND, where.path))) return [];
        return [{ spec, rules: JSON.parse(readFileSync(join(FRONTEND, where.path), 'utf8')) }];
    });
});
/** Every maze ROOM of every preset: `{spec, rules, player, region, sidecar}`. */
const ROOMS = PRESETS.flatMap(({ spec, rules }) => Object.entries(rules.preset_sidecars ?? {})
    .flatMap(([player, sc]) => Object.entries(sc ?? {})
        .filter(([, s]) => s?.substrate === 'maze' && s.playable_payload !== undefined)
        .map(([region, sidecar]) => ({ spec, rules, player, region, sidecar }))));
const originOf = (r) => seedlingOriginOf({ payload: r.sidecar.playable_payload, rules: r.rules, player: r.player });
const LINKED = ROOMS.filter((r) => originOf(r)?.linkable);

const MAP = JSON.parse(readFileSync(join(FRONTEND, mapDocumentPath(null).path), 'utf8'));
const VANILLA = new Set(MAP.levels.map((l) => l.level));

describe('mazeSeedlingLink — which rooms link back, over every committed preset', () => {
    it('the census: the converted rooms link, every other maze room has no origin, and none is converted-but-stuck', () => {
        const byPreset = {};
        for (const r of LINKED) byPreset[r.spec] = (byPreset[r.spec] ?? 0) + 1;
        expect(byPreset).toEqual({ seedling_playthrough_maze: 116, seedling_atlas_maze: 10 });
        expect(LINKED.length).toBe(126);
        const rest = ROOMS.filter((r) => !originOf(r)?.linkable);
        expect(rest.every((r) => originOf(r) === null)).toBe(true);
        expect(rest.length).toBeGreaterThan(0);
        expect(rest.every((r) => !Number.isInteger(r.sidecar.playable_payload?.level))).toBe(true);
    });

    it('every linked level is a level of the map the Seedling editor reads, and the URL opens it in the EDIT arm', () => {
        expect(seedlingEditorMap()).toBe(mapDocumentPath(null).name);
        expect(VANILLA.size).toBe(116);
        const levels = new Set(LINKED.map((r) => originOf(r).level));
        expect(levels.size).toBe(115);
        for (const r of LINKED) {
            const o = originOf(r);
            expect(VANILLA.has(o.level)).toBe(true);
            expect(o.mapDocument).toBe(seedlingEditorMap());
            expect(o.url).toBe(`${SEEDLING_EDITOR_PAGE}?source=edit&level=${o.level}`);
        }
        expect(seedlingEditorUrl(5)).toBe('modules/seedlingDemo/watch.html?source=edit&level=5');
        expect(existsSync(join(FRONTEND, SEEDLING_EDITOR_PAGE))).toBe(true);
    });

    it('every region of every converted preset, room-less ones included, links to its opened room\'s level', async () => {
        const specs = [...new Set(LINKED.map((r) => r.spec))];
        let roomless = 0;
        let rooms = 0;
        for (const spec of specs) {
            const { rules } = PRESETS.find((p) => p.spec === spec);
            for (const [player, sc] of Object.entries(rules.preset_sidecars)) {
                for (const region of Object.keys(sc)) {
                    const link = await openPresetRegion({ preset: spec, region, fetchJson: fromDisk });
                    const origin = seedlingOriginOf({ payload: link.sidecar.playable_payload, rules, player: link.player });
                    expect(link.player).toBe(player);
                    expect(origin.linkable).toBe(true);
                    expect(origin.level).toBe(sc[link.room].playable_payload.level);
                    const v = seedlingLinkFor({ origin, presetLink: link });
                    if (link.room === region) {
                        rooms += 1;
                        expect(v.notes.some((n) => n.includes('has no room of its own'))).toBe(false);
                    } else {
                        roomless += 1;
                        const note = v.notes.find((n) => n.includes('has no room of its own'));
                        expect(note).toContain(region);
                        expect(note).toContain(link.room);
                        expect(note).toContain(link.sharedWorld);
                        expect(note).toContain(`, ${origin.level} (the whole level)`);
                    }
                }
            }
        }
        expect({ rooms, roomless }).toEqual({ rooms: 126, roomless: 150 });
    });

    it('a level split across several maze rooms: every one links to the same level, and says how many share it', () => {
        const byKey = new Map();
        for (const r of LINKED) {
            const k = `${r.spec}|${originOf(r).level}`;
            byKey.set(k, [...(byKey.get(k) ?? []), r]);
        }
        const split = [...byKey].filter(([, rs]) => rs.length > 1)
            .map(([k, rs]) => [k, rs.length]).sort();
        expect(split).toEqual([['seedling_atlas_maze|0', 6], ['seedling_atlas_maze|3', 2],
            ['seedling_playthrough_maze|94', 2]]);
        for (const [k, n] of split) {
            const rs = byKey.get(k);
            const urls = new Set(rs.map((r) => originOf(r).url));
            expect(urls.size).toBe(1);
            for (const r of rs) {
                expect(originOf(r).siblings).toBe(n);
                expect(seedlingLinkFor({ origin: originOf(r) }).notes)
                    .toContain(`level ${originOf(r).level} is split across ${n} maze rooms in this preset; each links `
                        + `to the whole level ${originOf(r).level}`);
            }
        }
        const level0 = LINKED.filter((r) => originOf(r).level === 0);
        expect(level0.length).toBe(7);
        expect(new Set(level0.map((r) => originOf(r).url)).size).toBe(1);
        const single = LINKED.find((r) => byKey.get(`${r.spec}|${originOf(r).level}`).length === 1);
        expect(seedlingLinkFor({ origin: originOf(single) }).notes).toEqual([]);
    });

    it('an EDITED room still links to the ORIGINAL level, with a note that the edits are not carried over', () => {
        const origin = originOf(LINKED[0]);
        const edited = seedlingLinkFor({ origin, edits: 3 });
        expect(edited.ok).toBe(true);
        expect(edited.url).toBe(origin.url);
        expect(edited.label).toBe(`open level ${origin.level} in the Seedling editor ↗`);
        expect(edited.notes).toContain(`the Seedling editor opens the ORIGINAL level ${origin.level}: this room's 3 `
            + 'maze edit(s) are not carried over');
        expect(seedlingLinkFor({ origin, edits: 0 }).notes.some((n) => n.includes('ORIGINAL'))).toBe(false);
    });
});

describe('mazeSeedlingLink — the rooms that do not link, and why', () => {
    const room = LINKED[0];
    const payload = room.sidecar.playable_payload;

    it('a PASTED converted room (no rules) is converted but cannot link, and the reason names its level', () => {
        const fromBox = seedlingOriginOf({ payload: levelOfPayload(room.sidecar) });
        expect(fromBox.linkable).toBe(false);
        expect(fromBox.level).toBe(payload.level);
        expect(fromBox.reason).toContain(`level number ${payload.level}`);
        expect(fromBox.reason).toContain('open it by preset link');
        const v = seedlingLinkFor({ origin: fromBox });
        expect(v).toEqual({ shown: true, ok: false, level: payload.level, reason: fromBox.reason });
        expect(seedlingOriginOf({ payload: levelOfPayload(payload) }).linkable).toBe(false);
    });

    it('a lab payload (its `level` is the world object) and a generated maze have no origin: no link, no note', () => {
        const generated = ROOMS.find((r) => !Number.isInteger(r.sidecar.playable_payload?.level));
        expect(seedlingOriginOf({ payload: generated.sidecar.playable_payload, rules: generated.rules,
            player: generated.player })).toBe(null);
        expect(seedlingOriginOf({ payload: levelOfPayload({ seed: 1, level: { width: 3, height: 3 } }) })).toBe(null);
        expect(seedlingOriginOf({ payload: { ...payload, level: '5' }, rules: room.rules, player: room.player })).toBe(null);
        expect(seedlingLinkFor({ origin: null })).toEqual({ shown: false });
    });

    it('a preset that declares no map_document, or another map, cannot link, and says which', () => {
        const noAtlas = { ...room.rules, region_atlas: undefined };
        const none = seedlingOriginOf({ payload, rules: noAtlas, player: room.player });
        expect(none.linkable).toBe(false);
        expect(none.reason).toContain('declares no `region_atlas.map_document`');
        const blank = { ...room.rules, region_atlas: { [room.player]: { ...room.rules.region_atlas[room.player],
            map_document: '' } } };
        expect(seedlingOriginOf({ payload, rules: blank, player: room.player }).linkable).toBe(false);
        const other = { ...room.rules, region_atlas: { [room.player]: { ...room.rules.region_atlas[room.player],
            map_document: 'another-map.json' } } };
        const elsewhere = seedlingOriginOf({ payload, rules: other, player: room.player });
        expect(elsewhere.linkable).toBe(false);
        expect(elsewhere.reason).toBe(`this room was converted from level ${payload.level} of another-map.json; the `
            + `Seedling editor reads ${seedlingEditorMap()}`);
        const otherPlayer = seedlingOriginOf({ payload, rules: room.rules, player: '99' });
        expect(otherPlayer.linkable).toBe(false);
    });
});
