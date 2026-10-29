/**
 * mazeSeedlingSprites — S2 of the maze Seedling-art ladder (slice maze-seedling-art-2), in node over the COMMITTED
 * packs, map and presets (no pixels):
 *
 *   1. ⚖ RULING 5's CENSUS: every maze obstacle / block / button / trap / item of every Seedling maze payload matches
 *      exactly one level entity (or is a terrain gate, or an item on no entity) — zero refusals, and each refusal
 *      kind fires by name on a mutant world.
 *   2. GOLDEN live draw lists (`formatOp`) at real states: L0 at the start and with a rock broken, L4 walked by the
 *      engine's own `step` onto its button and then pushing the block, L12 at the start. A CHANGE DETECTOR of the
 *      frame choice. Re-record: `UPDATE_MAZE_SPRITE_GOLDENS=1 npx vitest run <this file>`.
 *   3. The state really drives the picture: a broken rock / a taken item has no op but keeps its cell; a pressed
 *      button is frame 1; the block is drawn where the maze has it; an event item keeps its marker.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { formatOp } from '../seedlingDemo/seedlingSkinRenderer.js';
import { patchedMapDocument } from '../seedlingDemo/seedlingSetPatches.js';
import { INPUT_E, INPUT_S, createState, deserializeMazeWorld, setObstacle, step } from './mazeRoomEngine.js';
import { plainView } from './mazeRoomRender.js';
import { itemLook, seedlingCensus, seedlingSprites } from './mazeSeedlingSprites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/seedling-sprite-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = new Map(patchedMapDocument(MAP).levels.map((r) => [r.level, r]));
const rulesOf = (preset) => JSON.parse(readFileSync(join(ROOT, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
const PLAYTHROUGH = rulesOf('seedling_playthrough_maze');
const payloadsOf = (rules) => Object.entries(rules.preset_sidecars?.['1'] ?? {})
    .filter(([, v]) => v.playable_payload).map(([k, v]) => [k, v.playable_payload]);
const worldOf = (payload) => deserializeMazeWorld(JSON.parse(JSON.stringify(payload)));
const regionWorld = (id) => worldOf(PLAYTHROUGH.preset_sidecars['1'][id].playable_payload);
const EVENTS = PLAYTHROUGH.items['1'];
const isEvent = (name) => EVENTS[name]?.event === true;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** The panel's own view of a state (`plainView` + the state's fields), and the live sprites over it. */
function spritesAt(world, state) {
    const view = plainView({
        tilePx: 32, playerPos: state.player_pos, inventory: state.inventory,
        broken: state.broken ?? null, facing: state.facing ?? null,
    });
    const census = seedlingCensus(world, RECORDS.get(world.atlas.level));
    return { census, ...seedlingSprites(census, art, { mazeWorld: world, view, blocks: state.blocks ?? null, isEvent }) };
}
const lines = ({ ops, player }) => [...ops.map(formatOp), ...(player ?? []).map((op) => `player ${formatOp(op)}`)];
const walk = (world, ...inputs) => inputs.reduce((s, input) => {
    const next = step(world, s, input);
    if (!next) throw new Error(`the engine refused ${input} at ${JSON.stringify(s.player_pos)}`);
    return next;
}, createState(world));

describe('1. ⚖ ruling 5 — the census: one entity per maze object, refused by name otherwise', () => {
    for (const preset of ['seedling_playthrough_maze', 'seedling_atlas_maze']) {
        it(`${preset}: zero refusals over every Seedling payload`, () => {
            const refusals = [];
            const what = new Set();
            for (const [k, p] of payloadsOf(rulesOf(preset))) {
                if (!Number.isInteger(p.level)) continue;
                const c = seedlingCensus(worldOf(p), RECORDS.get(p.level));
                refusals.push(...c.refusals.map((r) => `${k}: ${r}`));
                for (const r of c.rows) what.add(`${r.what}:${r.cls}`);
            }
            expect(refusals).toEqual([]);
            expect(what.size).toBeGreaterThan(0);
        });
    }

    it('the playthrough preset reaches every drawn class S2 names (rocks, locks, poles, blocks, buttons, traps, items)', () => {
        const what = new Set();
        for (const [, p] of payloadsOf(PLAYTHROUGH)) {
            for (const r of seedlingCensus(worldOf(p), RECORDS.get(p.level)).rows) what.add(`${r.what}:${r.cls}`);
        }
        for (const w of ['obstacle:BreakableRock', 'obstacle:Lock', 'obstacle:BossLock', 'obstacle:DarkTrap', 'obstacle:RopeStart',
            'block:PushableBlock', 'button:Button', 'trap:ArrowTrap', 'item:Chest']) expect(what, w).toContain(w);
    });

    it('refuses by name: a rock on no rock, a gate naming a body elsewhere, an unknown kind', () => {
        const world = regionWorld('level_0__r1c6');
        world.obstacleLib = { ...world.obstacleLib,
            gate_far: { id: 'gate_far', clear_set_type: 'rule', clear_rule: { rule: 'True_' } },
            odd: { id: 'odd', kind: 'catapult', clear_set: [] } };
        setObstacle(world, world.entrance.x, world.entrance.y, 'rock_sword_spear');
        setObstacle(world, 1, 1, 'gate_far~x: breakablerock@288,176 cleared');
        world.obstacleLib['gate_far~x: breakablerock@288,176 cleared'] = world.obstacleLib.gate_far;
        setObstacle(world, 2, 1, 'odd');
        const { refusals } = seedlingCensus(world, RECORDS.get(0));
        expect(refusals.join('\n')).toMatch(new RegExp(`rock rock_sword_spear at ${world.entrance.x},${world.entrance.y}: no entity of BreakableRock`));
        expect(refusals.join('\n')).toMatch(/at 1,1: names breakablerock@288,176, whose footprint is not on the cell/);
        expect(refusals.join('\n')).toMatch(/odd at 2,1: kind "catapult" has no drawn class/);
    });
});

describe('2. golden live draw lists (frame CHOICE, at real states)', () => {
    const L4 = () => regionWorld('level_4');
    const cases = {
        'L0-start': () => { const w = regionWorld('level_0__r1c6'); return [w, createState(w)]; },
        'L0-rock-broken': () => {
            const w = regionWorld('level_0__r1c6');
            const s = createState(w);
            const rock = [...w.obstacles].find(([, id]) => id === 'rock_sword_spear')[0];
            return [w, { ...s, broken: [rock] }];
        },
        'L4-on-button': () => { const w = L4(); return [w, walk(w, INPUT_S, INPUT_S, INPUT_S)]; },
        'L4-block-pushed': () => { const w = L4(); return [w, walk(w, INPUT_S, INPUT_S, INPUT_S, INPUT_E)]; },
        'L12-start': () => { const w = regionWorld('level_12__r0c19'); return [w, createState(w)]; },
    };
    for (const [name, make] of Object.entries(cases)) {
        it(name, () => {
            const [world, state] = make();
            const got = lines(spritesAt(world, state));
            const path = join(GOLDENS, `${name}.txt`);
            if (process.env.UPDATE_MAZE_SPRITE_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${got.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} (record with UPDATE_MAZE_SPRITE_GOLDENS=1)`).toBe(true);
            expect(got).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
            expect(got.some((l) => l.startsWith('player drawImage(seedling/ShrumBlue'))).toBe(true);
        });
    }
});

describe('3. the maze state drives the picture', () => {
    it('a broken rock has no sprite but keeps its cell (no marker either)', () => {
        const w = regionWorld('level_0__r1c6');
        const s = createState(w);
        const rock = [...w.obstacles].find(([, id]) => id === 'rock_sword_spear')[0];
        const before = spritesAt(w, s);
        const after = spritesAt(w, { ...s, broken: [rock] });
        expect(after.ops.length).toBe(before.ops.length - 1);
        expect(after.cells.has(rock)).toBe(true);
    });

    it('L4: the button is frame 1 under the player, the block moves with the push, the button is up again', () => {
        const w = regionWorld('level_4');
        const button = (r) => r.ops.find((op) => op.key === 'seedling:puzzlement/button');
        const block = (r) => r.ops.find((op) => op.key === 'seedling:puzzlement/pushableblock');
        const start = spritesAt(w, createState(w));
        expect(button(start).frame).toBe(0);
        expect(block(start)).toMatchObject({ dx: 32, dy: 64 });
        const on = spritesAt(w, walk(w, INPUT_S, INPUT_S, INPUT_S));
        expect(button(on).frame).toBe(1);
        const pushed = spritesAt(w, walk(w, INPUT_S, INPUT_S, INPUT_S, INPUT_E));
        expect(block(pushed)).toMatchObject({ dx: 48, dy: 64 });
        expect(button(pushed).frame).toBe(0);
        // the block's start cell is still the art's (no marker), and so is every trap
        expect(pushed.cells.has('2,4')).toBe(true);
        for (const t of w.traps) expect(pushed.cells.has(`${t.x},${t.y}`)).toBe(true);
    });

    it('a taken item has no sprite; an event item has no sprite AND keeps its marker', () => {
        const w = regionWorld('level_11');
        const [cell, item] = [...w.items][0];
        const s = createState(w);
        expect(spritesAt(w, s).ops.some((op) => op.key === 'seedling:pickup/chest')).toBe(true);
        const taken = spritesAt(w, { ...s, inventory: new Set([item]) });
        expect(taken.ops.some((op) => op.key === 'seedling:pickup/chest')).toBe(false);
        expect(taken.cells.has(cell)).toBe(true);
        const [region] = payloadsOf(PLAYTHROUGH).find(([, p]) => (p.items ?? []).some((i) => isEvent(i.id)));
        const ew = regionWorld(region);
        const [ecell] = [...ew.items].find(([, id]) => isEvent(id));
        expect(spritesAt(ew, createState(ew)).cells.has(ecell)).toBe(false);
    });

    it('an item\'s look: its cell\'s own graphic, else its first; keys by index; anything else the logo', () => {
        expect(itemLook('Seal', 'chest')).toBe('chest');
        expect(itemLook('Progressive Swim', 'feather')).toBe('feather');
        expect(itemLook('Progressive Swim', 'chest')).toBe('conch');
        expect(itemLook('Purple Key', 'bosskey')).toBe('bosskey2');
        expect(itemLook('Fire', 'fallrocklarge')).toBe('ap');
    });

    it('the player faces where the maze says (the stand frame; the left is the side frame mirrored)', () => {
        const w = regionWorld('level_0__r1c6');
        const s = createState(w);
        const at = (facing) => spritesAt(w, { ...s, facing }).player[0];
        expect(at('S').frame).toBe(0);
        expect(at('N').frame).toBe(6);
        expect(at('E')).toMatchObject({ frame: 3, flipX: false });
        expect(at('W')).toMatchObject({ frame: 3, flipX: true });
    });
});
