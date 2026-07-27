// Unit tests for the Seedling map extractor (region-atlas plan, Phase 2,
// Deliverable 1).
//
// Two strata, deliberately independent:
//   1. the parsers, against two real .oel files committed as fixtures (MIT);
//   2. the COMMITTED extract, against the shipped flashPanel/games/seedling.json
//      — which is the check that matters, because the whole extractor rests on
//      the claim that a level's `/*N */` embed index is the same number that
//      config's teleport / region_coords / location_coords use. Encoding that
//      correspondence here means a future re-extract that broke it fails a test
//      instead of quietly pointing the marking tool at the wrong rooms.
//
// Regenerating the extract byte-for-byte needs the user's Seedling checkout, so
// that half lives in the CLI (`--check`, documented in atlases/README.md). What
// runs here without it is the other half: the committed file is exactly what
// the extractor's writer emits for its own content.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { parseXml, parseOelLevel, parseLevelTable, decodeXmlText, TILE_SIZE } from './seedlingOgmo.js';
import { compactJsonFile } from '../../frontend/modules/procgenPipeline/compactJson.js';

const readFixture = (name) => readFileSync(fileURLToPath(new URL(`./seedling-fixtures/${name}`, import.meta.url)), 'utf8');
const readRepo = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

const FALLHOLE = readFixture('fallhole.oel');
const DUNGEON6_10 = readFixture('dungeon6-10.oel');

const MAP_PATH = 'frontend/modules/flashPanel/atlases/seedling-map.json';
const MAP_TEXT = readRepo(MAP_PATH);
const MAP = JSON.parse(MAP_TEXT);
const GAME_CONFIG = JSON.parse(readRepo('frontend/modules/flashPanel/games/seedling.json'));

const levelOf = (n) => MAP.levels.find((l) => l.level === n);
const entitiesOf = (n, type) => levelOf(n).entities.filter((e) => e.type === type);

describe('parseXml', () => {
    it('reads nested elements, attributes and text', () => {
        const root = parseXml('<level><width>80</width><tiles set="tileset"><tile tx="0" ty="0"/></tiles></level>');
        expect(root.tag).toBe('level');
        expect(root.children.map((c) => c.tag)).toEqual(['width', 'tiles']);
        expect(root.children[0].text).toBe('80');
        expect(root.children[1].attrs).toEqual({ set: 'tileset' });
        expect(root.children[1].children[0].attrs).toEqual({ tx: '0', ty: '0' });
    });

    it('does not end a tag on a ">" inside a quoted value', () => {
        // treelarge.oel really contains this: `text="…Press &lt;W> to hear…"`.
        // A regex-based `<[^>]*>` scan tears the element in half here.
        const root = parseXml('<objects><rekcahdam x="168" text="Press &lt;W> to hear!"/><tree x="8"/></objects>');
        expect(root.children).toHaveLength(2);
        expect(root.children[0].attrs.text).toBe('Press <W> to hear!');
        expect(root.children[1].attrs.x).toBe('8');
    });

    it('decodes the entities the levels use, plus numeric ones', () => {
        expect(decodeXmlText('&lt;W&gt; &amp; &quot;x&quot; &apos;y&apos;')).toBe('<W> & "x" \'y\'');
        expect(decodeXmlText('&#65;&#x42;')).toBe('AB');
        expect(decodeXmlText('&nosuch; 100% & fine')).toBe('&nosuch; 100% & fine');
    });

    it('rejects malformed documents rather than guessing', () => {
        expect(() => parseXml('<a><b></a>')).toThrow(/does not match/);
        expect(() => parseXml('<a>')).toThrow(/unclosed element/);
        expect(() => parseXml('<a x=1/>')).toThrow(/not quoted/);
        expect(() => parseXml('<a/><b/>')).toThrow(/exactly one root element/);
        expect(() => parseXml('<a x/>')).toThrow(/has no value/);
    });
});

describe('parseOelLevel', () => {
    it('converts geometry from pixels to tiles', () => {
        const lvl = parseOelLevel(FALLHOLE, 'fallhole.oel');
        expect(lvl.width).toBe(5);
        expect(lvl.height).toBe(5);
        expect(TILE_SIZE).toBe(16);
    });

    it('keeps every tile layer, with its set and raw tx/ty identity', () => {
        const lvl = parseOelLevel(FALLHOLE, 'fallhole.oel');
        expect(lvl.layers.map((l) => [l.name, l.set])).toEqual([
            ['tiles', 'tileset'],
            ['cliffsides', 'cliffsidesset'],
        ]);
        expect(lvl.layers[0].tiles).toHaveLength(15);
        // <tile tx="80" ty="0" x="32" y="32"/> -> [x, y, tx, ty] with x/y in tiles
        expect(lvl.layers[0].tiles[0]).toEqual([2, 2, 80, 0]);
        expect(lvl.layers[1].tiles[0]).toEqual([2, 0, 64, 0]);
    });

    it('keeps entities with raw pixel positions and verbatim attributes', () => {
        const lvl = parseOelLevel(FALLHOLE, 'fallhole.oel');
        expect(lvl.entities).toEqual([
            { type: 'teleporter', x: 32, y: 64, attrs: { to: '12', playerx: '32', playery: '864' } },
            { type: 'lightalpha', x: 0, y: 0, attrs: { alpha: '0.1' } },
            { type: 'control', x: 32, y: 16, attrs: { fallthrough: '84', xOff: '-32', yOff: '-32' } },
        ]);
    });

    it('handles a level with no cliffsides layer', () => {
        const lvl = parseOelLevel(DUNGEON6_10, 'dungeon6-10.oel');
        expect(lvl.layers.map((l) => l.name)).toEqual(['tiles']);
        expect(lvl.width).toBe(5);
        expect(lvl.layers[0].tiles.every((t) => t.length === 4)).toBe(true);
    });

    it('drops overpaint outside the level rectangle, as the game does, and counts it', () => {
        // dungeon6-10 is 5 tiles wide but has placements at x=80px (tile 5).
        const lvl = parseOelLevel(DUNGEON6_10, 'dungeon6-10.oel');
        expect(DUNGEON6_10).toContain('x="80" y="32"');
        expect(lvl.layers[0].tiles.some(([x]) => x >= lvl.width)).toBe(false);
        expect(lvl.tiles_outside_level).toBe(2);
        // A level with no overpaint carries no counter at all.
        expect(parseOelLevel(FALLHOLE, 'f').tiles_outside_level).toBeUndefined();
    });

    it('refuses geometry it cannot express in tiles', () => {
        const off = FALLHOLE.replace('x="32" y="32"', 'x="33" y="32"');
        expect(() => parseOelLevel(off, 'x')).toThrow(/off the 16px grid/);
        const odd = FALLHOLE.replace('<width>80</width>', '<width>84</width>');
        expect(() => parseOelLevel(odd, 'x')).toThrow(/not a multiple of 16/);
        expect(() => parseOelLevel('<world><width>16</width></world>', 'x')).toThrow(/expected <level>/);
        expect(() => parseOelLevel('<level><height>16</height></level>', 'x')).toThrow(/has no <width>/);
    });
});

describe('parseLevelTable', () => {
    const source = (arrayBody, embeds) => `
    public class Game extends World
    {
    ${embeds}
        [Embed(source = "../assets/graphics/Snow.png")] private static var imgSnow:Class;
        public static const levels:Array = new Array(${arrayBody});
    }`;
    const embed = (i, path, cls) => `/*${i}  */\t[Embed(source = '../assets/levels/${path}', mimeType = "application/octet-stream")] public static var ${cls}:Class;`;

    const GOOD = source('OverWorld1, Building1,\n\t\tDungeon1_Entrance', [
        embed(0, 'OverWorld.oel', 'OverWorld1'),
        embed(1, 'Building1.oel', 'Building1'),
        embed(2, 'Dungeon1/Entrance.oel', 'Dungeon1_Entrance'),
    ].join('\n'));

    it('returns the array order, with paths relative to the checkout root', () => {
        expect(parseLevelTable(GOOD)).toEqual([
            { level: 0, class: 'OverWorld1', path: 'assets/levels/OverWorld.oel' },
            { level: 1, class: 'Building1', path: 'assets/levels/Building1.oel' },
            { level: 2, class: 'Dungeon1_Entrance', path: 'assets/levels/Dungeon1/Entrance.oel' },
        ]);
    });

    it('ignores the graphics embeds, which carry no index comment', () => {
        expect(parseLevelTable(GOOD)).toHaveLength(3);
    });

    it('throws when the comment index and the array order disagree', () => {
        // This is the drift that would silently renumber every `level:` in
        // seedling.json, so it must never be papered over.
        const drifted = GOOD.replace('/*1  */', '/*7  */');
        expect(() => parseLevelTable(drifted)).toThrow(/embed comment says \/\*7\*\//);
    });

    it('throws on a level embed the array never names', () => {
        const orphan = `${GOOD.replace('public static const levels', `${embed(3, 'End/1.oel', 'End_1')}\n    public static const levels`)}`;
        expect(() => parseLevelTable(orphan)).toThrow(/absent from the levels array: End_1/);
    });

    it('throws on an array entry with no embed', () => {
        const missing = GOOD.replace('Dungeon1_Entrance);', 'Dungeon1_Entrance, Ghost_1);');
        expect(() => parseLevelTable(missing)).toThrow(/levels\[3\] names Ghost_1/);
    });

    it('throws when the table is absent entirely', () => {
        expect(() => parseLevelTable('class Game {}')).toThrow(/no level embeds found/);
        expect(() => parseLevelTable(embed(0, 'A.oel', 'A'))).toThrow(/could not find/);
    });
});

describe('the committed Seedling map extract', () => {
    it('is exactly what the compact writer emits for its own content', () => {
        expect(compactJsonFile(MAP, { maxInline: 220 })).toBe(MAP_TEXT);
    });

    it('indexes every level densely from 0', () => {
        expect(MAP.levels.map((l) => l.level)).toEqual(MAP.levels.map((_, i) => i));
        expect(MAP.level_count).toBe(MAP.levels.length);
        expect(MAP.tile_size).toBe(16);
    });

    it('keeps every tile placement inside its level', () => {
        for (const lvl of MAP.levels) {
            for (const layer of lvl.layers) {
                for (const [x, y] of layer.tiles) {
                    expect(x >= 0 && x < lvl.width && y >= 0 && y < lvl.height).toBe(true);
                }
            }
        }
    });

    it('counts the overpaint it dropped instead of hiding it', () => {
        // 51 of the 116 levels are painted past their own rectangle; the game
        // discards those placements too (Game.as loadlevel).
        const withOverpaint = MAP.levels.filter((l) => l.tiles_outside_level > 0);
        expect(withOverpaint.length).toBe(51);
        expect(withOverpaint.reduce((n, l) => n + l.tiles_outside_level, 0)).toBe(506);
    });

    it('records the unused rooms by name only', () => {
        expect(MAP.unreferenced_files).toContain('assets/levels/Island.oel');
        expect(MAP.levels.some((l) => l.path === 'assets/levels/Island.oel')).toBe(false);
    });
});

// The load-bearing claim of the whole extractor: `level` in the flashPanel game
// config == the index into Game.as's levels array == this extract's `level`.
describe('level numbering matches flashPanel/games/seedling.json', () => {
    it('resolves every level-to-level link to a real level', () => {
        const links = MAP.levels.flatMap((l) => l.entities
            .filter((e) => ['teleporter', 'stairsdown', 'stairsup'].includes(e.type))
            .map((e) => Number(e.attrs?.to)));
        expect(links.length).toBeGreaterThan(200);
        for (const to of links) {
            expect(Number.isInteger(to)).toBe(true);
            expect(to).toBeGreaterThanOrEqual(0);
            expect(to).toBeLessThan(MAP.level_count);
        }
    });

    it("region_coords[Owl's Nest] is OverWorld's stairs down into Dungeon 1", () => {
        const target = GAME_CONFIG.region_coords["Owl's Nest"];
        expect(target).toEqual({ level: 2, x: 48, y: 32 });
        const stairs = entitiesOf(0, 'stairsdown')
            .find((e) => Number(e.attrs.to) === target.level);
        expect(stairs.attrs.playerx).toBe(String(target.x));
        expect(stairs.attrs.playery).toBe(String(target.y));
        expect(levelOf(target.level).path).toBe('assets/levels/Dungeon1/Entrance.oel');
    });

    it('region_coords[Gundernourd] is the teleporter into Dungeon 2\'s boss room', () => {
        const target = GAME_CONFIG.region_coords.Gundernourd;
        expect(target).toEqual({ level: 19, x: 16, y: 144 });
        const source = MAP.levels.find((l) => l.entities.some(
            (e) => e.type === 'teleporter' && Number(e.attrs.to) === target.level,
        ));
        const tp = source.entities.find((e) => e.type === 'teleporter' && Number(e.attrs.to) === target.level);
        expect([tp.attrs.playerx, tp.attrs.playery]).toEqual([String(target.x), String(target.y)]);
        expect(levelOf(target.level).path).toBe('assets/levels/Dungeon2/6.oel');
    });

    it('every location_coords entry lands on its pickup entity', () => {
        // The teleport target stands the player NEXT to the pickup, so the
        // entity is within one tile of the recorded spot.
        const pickups = {
            Sword: 'sword', Shield: 'shield', Wand: 'wand', Conch: 'conch',
            'Ghost Spear': 'ghostspear', 'Dark Shield': 'darkshield', 'Dark Suit': 'darksuit',
            "Penguin's Feather": 'feather', 'Ghost Sword': 'ghostsword', 'Fire Wand': 'firewand',
        };
        for (const [name, type] of Object.entries(pickups)) {
            const coords = GAME_CONFIG.location_coords[name];
            const near = entitiesOf(coords.level, type)
                .filter((e) => Math.abs(e.x - coords.x) <= TILE_SIZE && Math.abs(e.y - coords.y) <= TILE_SIZE);
            expect(near, `${name} at level ${coords.level} (${coords.x},${coords.y})`).toHaveLength(1);
        }
    });
});
