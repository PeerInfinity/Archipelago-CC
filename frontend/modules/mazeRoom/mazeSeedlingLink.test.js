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
import {
    MazeRoomEditor, PALETTE_TYPES, applyEdit, convertedFromOfState, generateStep, labPayload, levelOfPayload, loadPayload,
    withConvertedFrom,
} from './mazeLab.js';
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
        // ⛓ rules-lavatrap-neck: roomless 150 -> 158, rule T splits L77 (level_77 -> r2c0 + r12c6 + r15c6: +2 sharing r2c0's
        //   world) and L78 (+6 sub-regions sharing r0c2's world), in the playthrough maze preset.
        // ⛓ rules-k-pursuit-resume: roomless 158 -> 190 — rule K + (b) (a lavarunner that outruns the player gates its leash cut at its kill-lock arm) splits L72 (+9 sub-regions), L74 (+4), L75 (+9) and re-cuts L73 (+3), L78 (+4), L80 (+3), L99 (+3), in the playthrough maze preset.
        // ⛓ rules-ap-chest-solid: the AP chest is a one-sided Solid — L11 and L38 split in two, L25 gains its chest sub-region, L63 loses its chest one-tile sub-region (190 -> 191)
        expect({ rooms, roomless }).toEqual({ rooms: 126, roomless: 191 });
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

    it('a BARE pasted sidecar (no rules, no `converted_from`) is converted but cannot link; the reason names its level', () => {
        const fromBox = seedlingOriginOf({ payload: levelOfPayload(room.sidecar) });
        expect(fromBox.linkable).toBe(false);
        expect(fromBox.level).toBe(payload.level);
        expect(fromBox.reason).toContain(`level number ${payload.level}`);
        expect(fromBox.reason).toContain('open it by preset link');
        const v = seedlingLinkFor({ origin: fromBox });
        expect(v).toEqual({ shown: true, ok: false, level: payload.level, reason: fromBox.reason });
        expect(seedlingOriginOf({ payload: levelOfPayload(payload) }).linkable).toBe(false);
        expect(fromBox.reason).toContain('paste the maze lab\'s own save box');
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

/**
 * ⛓⛓ MAZE PASTED ROOM LINK (⚖ Robert 2026-11-16 "Maze lab link back to Seedling"): the maze lab's own save box, copied
 * from a room opened by preset link and pasted into LOAD, links to the same level. The state is built the way the page
 * builds it (`withConvertedFrom(loadPayload(sidecar), origin)`), the box is the JSON text of `labPayload`, and the paste
 * is `loadPayload(JSON.parse(text))` — the page's own LOAD path.
 */
describe('mazeSeedlingLink — a paste of the maze lab\'s own save box', () => {
    const bootOf = (r) => withConvertedFrom(loadPayload(r.sidecar), originOf(r));
    const copyOf = (state) => JSON.stringify(labPayload(state), null, 2);
    const pasteOriginOf = (text) => {
        const payload = JSON.parse(text);
        const loaded = loadPayload(payload);
        return { loaded, origin: seedlingOriginOf({ payload: levelOfPayload(payload), convertedFrom: convertedFromOfState(loaded) }) };
    };

    it('every converted room: COPY → PASTE links to the same level as its preset-link boot, and the copy is a fixed point', () => {
        for (const r of LINKED) {
            const boot = originOf(r);
            const text = copyOf(bootOf(r));
            expect(JSON.parse(text).converted_from).toEqual({ map_document: seedlingEditorMap(), level: boot.level, edits: 0 });
            const { loaded, origin } = pasteOriginOf(text);
            expect(origin.linkable).toBe(true);
            expect(origin.url).toBe(boot.url);
            expect(seedlingLinkFor({ origin, edits: convertedFromOfState(loaded).edits }).notes).toEqual([]);
            expect(copyOf(loaded)).toBe(text);
            // ⛔ the rest of the payload is exactly what it was before this slice (the block only ADDS a key)
            const { converted_from: _c, ...rest } = JSON.parse(text);
            expect(JSON.stringify(rest)).toBe(JSON.stringify(labPayload(loadPayload(r.sidecar))));
        }
    });

    it('an EDITED room: the copy counts its edits, and the paste (and an edit after it) still notes the ORIGINAL level', () => {
        const r = LINKED[0];
        const boot = bootOf(r);
        const e = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
        e.selectType(PALETTE_TYPES.WALL);
        const c = boot.model.allCells(boot.record).find((p) => boot.model.isFree(boot.record, p.tx, p.ty));
        const edited = applyEdit(boot, e, c.tx, c.ty).state;
        expect(convertedFromOfState(edited)).not.toBe(null);
        const text = copyOf(edited);
        expect(JSON.parse(text).converted_from.edits).toBe(1);
        const { loaded, origin } = pasteOriginOf(text);
        expect(origin.url).toBe(originOf(r).url);
        const pastedView = seedlingLinkFor({ origin, edits: convertedFromOfState(loaded).edits + loaded.edits.length });
        expect(pastedView.notes).toContain(`the Seedling editor opens the ORIGINAL level ${origin.level}: this room's 1 `
            + 'maze edit(s) are not carried over');
        const c2 = loaded.model.allCells(loaded.record).find((p) => loaded.model.isFree(loaded.record, p.tx, p.ty));
        const again = applyEdit(loaded, e, c2.tx, c2.ty).state;
        expect(convertedFromOfState(again).edits + again.edits.length).toBe(2);
        expect(JSON.parse(copyOf(again)).converted_from.edits).toBe(2);
    });

    it('an unproven room writes no block, and a paste that does not name the editor\'s map never links', () => {
        const generated = generateStep({ seed: 1, step: 1 });
        expect('converted_from' in labPayload(generated)).toBe(false);
        expect(withConvertedFrom(generated, null)).toBe(generated);
        const r = LINKED[0];
        const bareSidecar = loadPayload(r.sidecar);
        expect('convertedFrom' in bareSidecar).toBe(false);
        expect(withConvertedFrom(bareSidecar, { level: 3, linkable: false, reason: 'x' })).toBe(bareSidecar);
        const good = JSON.parse(copyOf(bootOf(r)));
        const level = good.converted_from.level;
        const other = pasteOriginOf(JSON.stringify({ ...good, converted_from: { ...good.converted_from,
            map_document: 'another-map.json' } })).origin;
        expect(other.linkable).toBe(false);
        expect(other.reason).toBe(`this room was converted from level ${level} of another-map.json; the Seedling editor `
            + `reads ${seedlingEditorMap()}`);
        for (const bad of [{ level }, { map_document: '', level }, { map_document: seedlingEditorMap(), level: '5' }, 'x']) {
            const { loaded, origin } = pasteOriginOf(JSON.stringify({ ...good, converted_from: bad }));
            expect('convertedFrom' in loaded).toBe(false);
            expect(origin).toBe(null);
        }
        const { converted_from: _c, ...old } = good;
        expect(pasteOriginOf(JSON.stringify(old)).origin).toBe(null);
    });

    it('a directive or ladder step moves the base, and the claim lapses with it', () => {
        const boot = bootOf(LINKED[0]);
        const moved = Object.freeze({ ...boot, baseRecord: generateStep({ seed: 1, step: 1 }).record });
        expect(convertedFromOfState(moved)).toBe(null);
        expect('converted_from' in labPayload(moved)).toBe(false);
    });
});
