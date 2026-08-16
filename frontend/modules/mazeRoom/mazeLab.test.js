/**
 * mazeLab — the maze lab page's headless half.
 *
 * CONSTRUCTIVE-MODE arc, slice 3. ⛔ The standing law these are written against:
 * **a round-trip fixed point tests SELF-CONSISTENCY, never correctness** (⚖
 * kickoff §5). Every parameter's VALUE therefore gets an independently produced
 * answer beside its round trip — a writer that dropped `anchortries` and a
 * reader that defaulted it would round-trip perfectly and generate a different
 * level.
 */

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_MAZE_BIOME, MazeLabError, MazeRoomEditor, PALETTE_TYPES, SOURCES,
    agreementWithPayload, applyDirective, applyEdit, certify, describeState, generateStep,
    generateWithDirectives, labCatalogue, labPayload, loadPayload, planCells, readLabParams,
    SKELETON_KIND_NAMES, DEFAULT_SKELETON, serializeMazeLevel, skeletonCatalogue, solveState,
    stepFromParams, undoEdit, writeLabParams,
} from './mazeLab.js';
import { deserializeMazeLevel } from './procgenMaze.js';
import { TILE_FLOOR, TILE_WALL, getTile } from './mazeRoomEngine.js';
import { UrlParamsError } from '../procgenCore/urlParams.js';

const ROOM = { width: 5, height: 5 };
const step0 = (seed = 1, over = {}) => generateStep({ seed, step: 0, ...ROOM, ...over });

describe('mazeLab — the URL, ONE reader and ONE writer', () => {
    it('reads the WHOLE grammar and every default is stated', () => {
        const p = readLabParams('');
        expect(p.source).toBe(SOURCES.GENERATE);
        expect(p.seed).toBe(1);
        expect(p.biome).toBe(DEFAULT_MAZE_BIOME);
        expect(p.width).toBe(11);
        expect(p.height).toBe(11);
        expect(p.bounds).toEqual({
            obstacleTarget: 6, triesPerStep: 8, saturationK: 3, anchorTriesPerCandidate: 1,
        });
        expect(p.budget).toEqual({ maxExpansions: 20000 });
        expect(p.roster).toBe(null);
        expect(p.directed).toBe(null);
        expect(p.run).toBe(false);
    });

    it('⛓ every parameter\'s VALUE is read INDEPENDENTLY of any round trip', () => {
        // ⛔ Each number here is a different, non-default literal, so a reader
        // that ignored one and defaulted it would be caught by that one row.
        const p = readLabParams('?source=solve&seed=42&biome=maze-v1&width=7&height=9'
            + '&count=5&tries=4&k=2&anchortries=3&expansions=77&run=1');
        expect(p.source).toBe('solve');
        expect(p.seed).toBe(42);
        expect(p.width).toBe(7);
        expect(p.height).toBe(9);
        expect(p.bounds.obstacleTarget).toBe(5);
        expect(p.bounds.triesPerStep).toBe(4);
        expect(p.bounds.saturationK).toBe(2);
        expect(p.bounds.anchorTriesPerCandidate).toBe(3);
        expect(p.budget.maxExpansions).toBe(77);
        expect(p.run).toBe(true);
        expect(stepFromParams(p)).toBe(5);
    });

    it('⛔ refuses an unknown ?source= rather than falling back to GENERATE', () => {
        expect(() => readLabParams('?source=drive')).toThrow(MazeLabError);
        expect(() => readLabParams('?source=drive')).toThrow(/is not one of \[generate, edit, solve\]/);
    });

    it('⛔ refuses an unknown ?biome= and a non-integer bound BY NAME', () => {
        expect(() => readLabParams('?biome=pre-sword')).toThrow(/is not one of \[maze-v1\]/);
        expect(() => readLabParams('?count=2.5')).toThrow(UrlParamsError);
        expect(() => readLabParams('?count=2.5')).toThrow(/\?count="2\.5" is not an integer/);
        expect(() => readLabParams('?width=1.5')).toThrow(/\?width="1\.5" is not an integer/);
    });

    it('⛔ the roster grammar: BOTH axes refuse, an EMPTY value refuses, absent is whole', () => {
        expect(readLabParams('').roster).toBe(null);
        expect(readLabParams('?families=wall').roster)
            .toEqual({ axis: 'families', names: ['wall'] });
        expect(() => readLabParams('?families=wall&templates=wall-segment'))
            .toThrow(/BOTH present.*two spellings of one setting/s);
        expect(() => readLabParams('?families=')).toThrow(/names nothing/);
        expect(() => readLabParams('?families=kill')).toThrow(/does not offer/);
    });

    it('reads ?directed= against the palette, and refuses an unknown template', () => {
        const p = readLabParams('?directed=wall-segment(ori=v,len=3)@12d');
        expect(p.directed).toHaveLength(1);
        expect(p.directed[0]).toMatchObject({
            template: 'wall-segment', params: { ori: 'v', len: 3 }, bound: 12, anchor: null,
        });
        expect(() => readLabParams('?directed=water-pool@12d')).toThrow(/does not hold/);
        expect(() => readLabParams('?directed=wall-segment(ori=q)@12d'))
            .toThrow(/not in its declared domain \[h, v\]/);
    });

    it('⛓ writer -> reader is an INVERSE, and the written string names the literals', () => {
        const st = generateStep({
            seed: 12, step: 2, width: 7, height: 9,
            bounds: {
                obstacleTarget: 2, triesPerStep: 4, saturationK: 2, anchorTriesPerCandidate: 3,
            },
            budget: { maxExpansions: 555 },
        });
        const search = writeLabParams('', {
            source: SOURCES.EDIT,
            seed: st.seed,
            biome: st.biome,
            width: st.width,
            height: st.height,
            bounds: st.bounds,
            budget: st.budget,
            step: st.step,
        });
        // ⛔ THE LITERALS, asserted — not just that a round trip agrees.
        const q = new URLSearchParams(search);
        expect(q.get('source')).toBe('edit');
        expect(q.get('seed')).toBe('12');
        expect(q.get('width')).toBe('7');
        expect(q.get('height')).toBe('9');
        expect(q.get('count')).toBe('2');
        expect(q.get('tries')).toBe('4');
        expect(q.get('k')).toBe('2');
        expect(q.get('anchortries')).toBe('3');
        expect(q.get('expansions')).toBe('555');
        expect(q.get('run')).toBe('1');
        const back = readLabParams(search);
        expect(back.seed).toBe(12);
        expect(back.width).toBe(7);
        expect(back.height).toBe(9);
        expect(back.bounds).toEqual(st.bounds);
        expect(back.budget).toEqual(st.budget);
        expect(stepFromParams(back)).toBe(2);
    });

    it('⛓ the round trip REGENERATES the same level (the fixed point, beside the values)', () => {
        const args = {
            seed: 4, step: 3, ...ROOM,
            bounds: {
                obstacleTarget: 3, triesPerStep: 6, saturationK: 2, anchorTriesPerCandidate: 2,
            },
        };
        const st = generateStep(args);
        const search = writeLabParams('', {
            seed: st.seed,
            biome: st.biome,
            width: st.width,
            height: st.height,
            bounds: st.bounds,
            budget: st.budget,
            step: st.step,
        });
        const p = readLabParams(search);
        const again = generateStep({
            seed: p.seed,
            biome: p.biome,
            step: stepFromParams(p),
            bounds: p.bounds,
            budget: p.budget,
            width: p.width,
            height: p.height,
        });
        expect(serializeMazeLevel(again.record)).toEqual(serializeMazeLevel(st.record));
        // …and the string is a FIXED POINT.
        expect(writeLabParams(search, {
            seed: p.seed,
            biome: p.biome,
            width: p.width,
            height: p.height,
            bounds: p.bounds,
            budget: p.budget,
            step: stepFromParams(p),
        })).toBe(search);
    });

    it('⛔ ?run= is DELETED at step 0, never written run=0', () => {
        const st = step0();
        const s = writeLabParams('', {
            seed: st.seed,
            biome: st.biome,
            width: st.width,
            height: st.height,
            bounds: st.bounds,
            budget: st.budget,
            step: 0,
        });
        expect(new URLSearchParams(s).has('run')).toBe(false);
        expect(stepFromParams(readLabParams(s))).toBe(0);
    });

    it('⚠ every parameter this page does not own SURVIVES a rewrite', () => {
        const st = step0();
        const s = writeLabParams('?mine=keepme&tick=7', {
            seed: st.seed,
            biome: st.biome,
            width: st.width,
            height: st.height,
            bounds: st.bounds,
            budget: st.budget,
            step: 0,
        });
        const q = new URLSearchParams(s);
        expect(q.get('mine')).toBe('keepme');
        expect(q.get('tick')).toBe('7');
    });
});

describe('mazeLab — GENERATE', () => {
    it('step 0 is the SKELETON and its goal is the ladder\'s goal at every step', () => {
        const zero = step0(3);
        const three = generateStep({ seed: 3, step: 3, ...ROOM });
        expect(zero.model.goalCell).toEqual(three.model.goalCell);
        expect(zero.trace).toEqual([]);
        expect(zero.summary).toBe(null);
        // an untouched skeleton is all floor
        expect([...zero.record.tiles].every((t) => t === TILE_FLOOR)).toBe(true);
    });

    it('⛓ a step-k level is the CLI\'s own --count=k output (the prefix property)', () => {
        // The page's STEP is "obstacleTarget = k, re-run", so a run to k is a
        // strict PREFIX of a run to k+1. Asserted rather than argued.
        const four = generateStep({ seed: 2, step: 4, ...ROOM });
        const five = generateStep({ seed: 2, step: 5, ...ROOM });
        expect(five.trace.slice(0, four.trace.length)).toEqual(four.trace);
    });

    it('a generated level is CERTIFIED; a skeleton nobody solved is not', () => {
        expect(step0(3).certification).toBe(null);
        expect(generateStep({ seed: 3, step: 3, ...ROOM }).certification).toBeTruthy();
    });

    it('⛓ the ROOM is a real parameter — §9.6\'s reverts only exist in a small one', () => {
        /**
         * ⛓ THE MEASUREMENT THIS PARAMETER EXISTS FOR (slice 2 §9.6): the
         * DEFAULT room never exercises the revert path at all, so a page
         * without `?width=` would show a palette that appears to refuse
         * nothing. ⚠ Swept over seeds rather than asserted on one — "seed 1
         * reverts" is a fact about seed 1 and would expire the next time a
         * draw order moved; "the small room reverts and the big one does not"
         * is the claim.
         */
        const reverted = (s) => s.trace.filter((r) => r.outcome === 'REVERTED').length;
        const over = (w, h) => [...Array(12).keys()]
            .reduce((n, i) => n + reverted(generateStep({
                seed: i + 1, step: 12, width: w, height: h,
            })), 0);
        expect(over(11, 11)).toBe(0);
        expect(over(5, 5)).toBeGreaterThan(0);
    });

    it('the catalogue is built FROM the roster and names both families', () => {
        const cat = labCatalogue(DEFAULT_MAZE_BIOME);
        expect(cat.groups.map((g) => g.family).sort()).toEqual(['door', 'wall']);
        expect(cat.counts.templates).toBe(2);
        expect(cat.groups.every((g) => g.templates.every((t) => t.selectable))).toBe(true);
    });

    it('RESTRICT reaches the loop — the run draws only from the named family', () => {
        const roster = { axis: 'families', names: ['wall'] };
        const st = generateStep({ seed: 7, step: 4, ...ROOM, roster });
        const drawn = new Set(st.trace.filter((r) => r.family !== 'skeleton')
            .map((r) => r.family));
        expect([...drawn]).toEqual(['wall']);
        expect(st.palette.name).toBe('maze-v1[families:wall]');
        expect(st.roster).toEqual(roster);
    });

    it('⛓⛓ a directive on a VERBLESS palette is NO_VERB, never solved-only', () => {
        /**
         * ⛓ THE DEFECT THIS ROW LOCKS DOWN (found by `check-maze-lab.mjs`):
         * `mazeLab.applyDirective` first passed `discharges: () => false`, which
         * claims every maze family HAS a verb no solve used. `levelGenerator`
         * reads `null` as "no verb" and `false` as "has one, not discharged",
         * and the difference is not cosmetic: under `false`,
         * `take = solved && kind !== SOLVED_ONLY` REVERTS the first solving
         * anchor and keeps searching for a discharge that cannot happen.
         */
        const st = generateStep({ seed: 5, step: 2, width: 11, height: 11 });
        const out = applyDirective(st, {
            template: 'door-key', params: { dir: 'S', dist: 1 }, anchor: null, bound: 12,
        }, 0);
        const d = out.directives[0];
        expect(d.outcome).toBe('KEPT');
        expect(d.keptKind).toBe('solved-no-verb');
        // ⛔ AND THE COST: a NO_VERB template is taken at the FIRST solving
        // anchor, so the walk is one anchor long.
        expect(d.anchorsWalked).toBe(1);
    });

    it('generateWithDirectives is the ONE replay path — batch == one at a time', () => {
        const specs = [
            { template: 'wall-segment', params: { ori: 'v', len: 3 }, anchor: null, bound: 12 },
            { template: 'door-key', params: { dir: 'E', dist: 1 }, anchor: null, bound: 12 },
        ];
        const batch = generateWithDirectives({ seed: 6, step: 2, ...ROOM, directed: specs });
        let one = generateStep({ seed: 6, step: 2, ...ROOM });
        specs.forEach((s, i) => { one = applyDirective(one, s, i); });
        expect(serializeMazeLevel(batch.record)).toEqual(serializeMazeLevel(one.record));
        expect(batch.directives).toEqual(one.directives);
    });
});

describe('mazeLab — EDIT (⚖ ruling 8 + §3.8)', () => {
    const editorFor = (state, type) => {
        const e = new MazeRoomEditor({
            itemLib: { key_red: {} }, obstacleLib: { door_red: {} },
        });
        e.selectType(type);
        return e;
    };
    /**
     * ⛔ THE TARGET CELL IS ASKED FOR, NEVER GUESSED. A hard-coded (3,3) is a
     * cell the generator may already have walled or gated, and the editor would
     * REFUSE it — the row would then assert about a refusal while claiming to
     * assert about an edit. `model.isFree` is the loop's own adjudication.
     */
    const freeCell = (state) => {
        const hit = state.model.allCells(state.record)
            .find((c) => state.model.isFree(state.record, c.tx, c.ty));
        if (!hit) throw new Error('no free cell — the fixture cannot test an edit');
        return hit;
    };

    it('⛔ an edit lands on a CLONE — the state it was applied to is untouched', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const c = freeCell(st);
        const before = serializeMazeLevel(st.record);
        const { state: after } = applyEdit(st, editorFor(st, PALETTE_TYPES.WALL), c.tx, c.ty);
        expect(serializeMazeLevel(st.record)).toEqual(before);
        expect(getTile(after.record, c.tx, c.ty)).toBe(TILE_WALL);
        expect(after.record).not.toBe(st.record);
    });

    it('⚖ §3.8: an edit UNCERTIFIES, and `null` is not `false`', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        expect(st.certification).toBeTruthy();
        const c = freeCell(st);
        const { state } = applyEdit(st, editorFor(st, PALETTE_TYPES.WALL), c.tx, c.ty);
        expect(state.certification).toBe(null);
        expect(state.edits).toHaveLength(1);
        expect(describeState(state)).toMatch(/1 manual edit\(s\)/);
        expect(describeState(state)).toMatch(/UNCERTIFIED/);
        expect(describeState(state)).toMatch(/the URL is NOT a reproduction after edits/);
    });

    it('⛔ a REFUSED edit changes NOTHING — not the world, not the certification', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const ed = editorFor(st, PALETTE_TYPES.WALL);
        // The entrance is protected by the editor.
        const out = applyEdit(st, ed, st.record.entrance.x, st.record.entrance.y);
        expect(out.result.ok).toBe(false);
        expect(out.result.description).toMatch(/Cannot place wall on the entrance/);
        expect(out.state).toBe(st);
        expect(out.state.certification).toBeTruthy();
    });

    it('⛔ an edit that CHANGED NOTHING is not an edit either', () => {
        /**
         * ⛓ THE DEFECT THIS ROW LOCKS DOWN: `MazeRoomEditor._setTile` reports
         * `{ok: true, type: 'tile'}` for "Tile (x,y) already floor." — `'noop'`
         * is reserved for its REFUSALS — so a guard on `ok`/`type` counted a
         * click that did nothing as a manual edit: the count bumped, the
         * CERTIFICATION dropped and the identity line announced that the URL
         * had stopped being a reproduction. `applyEdit` now asks the WORLD.
         */
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        expect(st.certification).toBeTruthy();
        const c = freeCell(st);
        const out = applyEdit(st, editorFor(st, PALETTE_TYPES.FLOOR), c.tx, c.ty);
        expect(out.result.ok).toBe(true);
        expect(out.result.description).toMatch(/already floor/);
        expect(out.state).toBe(st);
        expect(out.state.edits).toHaveLength(0);
        expect(out.state.certification).toBeTruthy();
        expect(describeState(out.state)).not.toMatch(/manual edit/);
    });

    it('UNDO pops the world stack and stays UNCERTIFIED', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const before = serializeMazeLevel(st.record);
        const { state: a } = applyEdit(st, editorFor(st, PALETTE_TYPES.WALL),
            freeCell(st).tx, freeCell(st).ty);
        const c2 = freeCell(a);
        const { state: b } = applyEdit(a, editorFor(a, PALETTE_TYPES.WALL), c2.tx, c2.ty);
        expect(b.edits).toHaveLength(2);
        const back = undoEdit(undoEdit(b));
        expect(back.edits).toHaveLength(0);
        expect(serializeMazeLevel(back.record)).toEqual(before);
        // ⛔ Still uncertified: nobody has solved the world now on screen.
        expect(back.certification).toBe(null);
        // …and undoing past the bottom is a no-op, not a throw.
        expect(undoEdit(back)).toBe(back);
    });

    it('⛔ applyEdit refuses anything that is not a MazeRoomEditor', () => {
        expect(() => applyEdit(step0(), { applyAt: () => ({ ok: true }) }, 1, 1))
            .toThrow(/needs a MazeRoomEditor/);
    });
});

describe('mazeLab — SOLVE and the certification law', () => {
    it('SOLVE on a generated level agrees with the loop\'s own certification', () => {
        const st = generateStep({ seed: 3, step: 3, ...ROOM });
        const solved = solveState(st);
        expect(solved.verdict).toBe('SOLVED');
        expect(solved.ticks).toBe(st.certification.steps);
    });

    it('⛓ a SEALED entrance is REFUSED with the oracle\'s own text, and stays uncertified', () => {
        let st = step0(1);
        for (const [x, y] of [[1, 0], [0, 1]]) {
            const e = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
            e.selectType(PALETTE_TYPES.WALL);
            st = applyEdit(st, e, x, y).state;
        }
        const after = certify(st);
        expect(after.lastSolve.verdict).toBe('REFUSED');
        expect(after.lastSolve.reasonText).toMatch(/no route from the entrance/);
        // ⛔ A REFUSAL IS A NO, NOT A RECORD.
        expect(after.certification).toBe(null);
        expect(describeState(after)).toMatch(/UNCERTIFIED/);
    });

    it('certify() on a still-solvable world puts the certification back', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const e = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
        e.selectType(PALETTE_TYPES.WALL);
        /**
         * ⚠ ONE stray wall in an open 5x5 room cannot disconnect it (the room
         * is 2-connected everywhere the model calls free), so the level is
         * still solvable — which is the point: the certification came back
         * because the ORACLE said so, not because the edit was cosmetic.
         */
        const c = st.model.allCells(st.record)
            .find((p) => st.model.isFree(st.record, p.tx, p.ty));
        const edited = applyEdit(st, e, c.tx, c.ty).state;
        expect(edited.certification).toBe(null);
        expect(getTile(edited.record, c.tx, c.ty)).toBe(TILE_WALL);
        expect(certify(edited).certification).toBeTruthy();
    });

    it('⛔ planCells REPLAYS through the engine\'s own step, and ends on the goal', () => {
        const st = generateStep({ seed: 3, step: 3, ...ROOM });
        const solved = solveState(st);
        const cells = planCells(st, solved);
        expect(cells).toHaveLength(solved.plan.length + 1);
        expect(cells[0]).toEqual({ x: st.record.entrance.x, y: st.record.entrance.y });
        expect(cells[cells.length - 1]).toEqual(st.model.goalPos);
        // every step is one orthogonal move — a page-side movement model would
        // not be constrained to that
        for (let i = 1; i < cells.length; i += 1) {
            const d = Math.abs(cells[i].x - cells[i - 1].x)
                + Math.abs(cells[i].y - cells[i - 1].y);
            expect(d).toBe(1);
        }
        expect(planCells(st, { plan: [] })).toBe(null);
    });
});

describe('mazeLab — the payload (⚖ ruling 9)', () => {
    it('⛓ serialize -> deserialize is a ROUND TRIP', () => {
        const st = generateStep({ seed: 8, step: 4, width: 7, height: 7 });
        const level = serializeMazeLevel(st.record);
        expect(serializeMazeLevel(deserializeMazeLevel(level))).toEqual(level);
    });

    it('⛓⛓ …and a HAND-WRITTEN payload loads to the world a reader would predict', () => {
        /**
         * ⛔ THE INDEPENDENT-VALUE HALF. The round trip above is a fixed point
         * and would pass against a consistently-wrong writer; this payload was
         * typed here, and every claim below is about what a person reading it
         * expects to see.
         */
        const hand = {
            width: 3,
            height: 2,
            //  (0,0) floor  (1,0) WALL   (2,0) floor
            //  (0,1) floor  (1,1) floor  (2,1) floor
            tiles: [0, 1, 0, 0, 0, 0],
            entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'goal', x: 2, y: 0 }],
            obstacles: [{ x: 1, y: 1, id: 'door_red' }],
            items: [{ x: 0, y: 1, id: 'key_red' }],
        };
        const w = deserializeMazeLevel(hand);
        expect(w.width).toBe(3);
        expect(w.height).toBe(2);
        expect(getTile(w, 1, 0)).toBe(TILE_WALL);
        expect(getTile(w, 0, 0)).toBe(TILE_FLOOR);
        expect(getTile(w, 2, 1)).toBe(TILE_FLOOR);
        expect(w.entrance).toEqual({ x: 0, y: 0 });
        expect([...w.exits.values()][0]).toMatchObject({ exit_id: 'goal', x: 2, y: 0 });
        expect(w.obstacles.get('1,1')).toBe('door_red');
        expect(w.items.get('0,1')).toBe('key_red');
        expect(w.obstacles.size).toBe(1);
        expect(w.items.size).toBe(1);
    });

    it('⛔ deserialize REFUSES a malformed payload BY NAME, and never repairs one', () => {
        const ok = {
            width: 2, height: 2, tiles: [0, 0, 0, 0],
            entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'goal', x: 1, y: 1 }],
        };
        expect(() => deserializeMazeLevel({ ...ok, tiles: [0, 0, 0] }))
            .toThrow(/PADDED WITH ZEROS/);
        expect(() => deserializeMazeLevel({ ...ok, tiles: [0, 0, 0, 7] }))
            .toThrow(/grid vocabulary is TILE_FLOOR/);
        expect(() => deserializeMazeLevel({ ...ok, entrance: { x: 9, y: 0 } }))
            .toThrow(/"entrance" is at .* not a cell of the 2x2 grid/);
        expect(() => deserializeMazeLevel({ ...ok, exits: [] }))
            .toThrow(/a room with no exit has no goal/);
        expect(() => deserializeMazeLevel({ ...ok, exits: [{ x: 1, y: 1 }] }))
            .toThrow(/no "exit_id"/);
        expect(() => deserializeMazeLevel(null)).toThrow(/expected an object/);
    });

    it('the payload carries the edits and the certification; the URL carries neither', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const e = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
        e.selectType(PALETTE_TYPES.WALL);
        const c = st.model.allCells(st.record)
            .find((p) => st.model.isFree(st.record, p.tx, p.ty));
        const edited = applyEdit(st, e, c.tx, c.ty).state;
        const pay = labPayload(edited);
        expect(pay.edits).toHaveLength(1);
        expect(pay.certified).toBe(false);
        const search = writeLabParams('', {
            seed: edited.seed,
            biome: edited.biome,
            width: edited.width,
            height: edited.height,
            bounds: edited.bounds,
            budget: edited.budget,
            step: edited.step,
        });
        expect(search).not.toMatch(/edit/);
    });

    it('⛓ a LOADED level is UNCERTIFIED whatever the file claimed', () => {
        const st = generateStep({ seed: 3, step: 3, ...ROOM });
        const pay = { ...labPayload(st), certified: true };
        const back = loadPayload(pay);
        expect(back.certification).toBe(null);
        expect(serializeMazeLevel(back.record)).toEqual(pay.level);
        // …and it solves, because it is the same world.
        expect(certify(back).lastSolve.verdict).toBe('SOLVED');
    });

    it('⛓⛓ loadPayload binds the model to the LOADED world\'s exit, not the seed\'s', () => {
        /**
         * ⛔ A payload may have been EDITED and its exit MOVED. A model whose
         * `goalPos` came from the seed would solve for a cell this world has no
         * exit on — the solve would answer about a different level and say
         * nothing about it.
         */
        const st = generateStep({ seed: 3, step: 0, ...ROOM });
        const level = serializeMazeLevel(st.record);
        const moved = {
            ...level,
            exits: [{ exit_id: 'goal', x: ROOM.width - 1, y: ROOM.height - 1 }],
        };
        const back = loadPayload({ level: moved, seed: 3, biome: DEFAULT_MAZE_BIOME });
        expect(back.model.goalPos).toEqual({ x: ROOM.width - 1, y: ROOM.height - 1 });
        expect(certify(back).lastSolve.certification.endedAt)
            .toEqual({ x: ROOM.width - 1, y: ROOM.height - 1 });
    });

    it('agreementWithPayload REPRODUCES, and says so when it agrees', () => {
        const st = generateStep({ seed: 3, step: 3, ...ROOM });
        const again = generateStep({ seed: 3, step: 3, ...ROOM });
        const a = agreementWithPayload(labPayload(st), again);
        expect(a).toMatchObject({ checked: true, agrees: true, differences: [] });
    });

    it('⛓ …and names WHICH field diverged rather than reporting "the level differs"', () => {
        const st = generateStep({ seed: 3, step: 3, ...ROOM });
        const other = generateStep({ seed: 4, step: 3, ...ROOM });
        const a = agreementWithPayload(labPayload(st), other);
        expect(a.agrees).toBe(false);
        expect(a.differences).toContain('seed');
        expect(a.differences).toContain('level');
    });

    it('⚖ ruling 9: an EDITED payload is NOT reproduced — the check says so by name', () => {
        const st = generateStep({ seed: 3, step: 2, ...ROOM });
        const e = new MazeRoomEditor({ itemLib: {}, obstacleLib: {} });
        e.selectType(PALETTE_TYPES.WALL);
        const c = st.model.allCells(st.record)
            .find((p) => st.model.isFree(st.record, p.tx, p.ty));
        const edited = applyEdit(st, e, c.tx, c.ty).state;
        const a = agreementWithPayload(labPayload(edited), st);
        expect(a.checked).toBe(false);
        expect(a.why).toMatch(/1 MANUAL EDIT\(S\)/);
        expect(a.why).toMatch(/Use LOAD/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `?skeleton=` ON THE MAZE LAB PAGE — CONSTRUCTIVE-MODE SLICE 5
 * ══════════════════════════════════════════════════════════════════════ */

describe('mazeLab — the skeleton kind', () => {
    const base = { seed: 3, biome: DEFAULT_MAZE_BIOME, step: 0 };

    it('renamed the open room to `empty` — one vocabulary, both substrates', () => {
        // ⛔ A LITERAL, not the constant it came from: a half-done rename would
        // still satisfy a comparison against the constant.
        expect(DEFAULT_SKELETON.kind).toBe('empty');
        expect(SKELETON_KIND_NAMES).toContain('winding');
        expect(SKELETON_KIND_NAMES).toContain('corridor');
    });

    it('carries the kind onto every state and defaults to the open room', () => {
        expect(generateStep(base).skeleton).toEqual({ kind: 'empty' });
        expect(generateStep({ ...base, skeleton: { kind: 'winding' } }).skeleton)
            .toEqual({ kind: 'winding' });
        expect(generateStep({ ...base, step: 2, skeleton: { kind: 'rooms' } }).skeleton)
            .toEqual({ kind: 'rooms' });
    });

    /**
     * ⛔ THE VALUE IS CHECKED AGAINST A LITERAL THIS FILE STATES, never against
     * a round trip — a fixed point tests self-consistency and never
     * correctness (⚖ kickoff §5).
     */
    it('reads and writes ?skeleton= — the literal value, and ABSENCE at the default', () => {
        expect(readLabParams('?seed=3').skeleton).toEqual({ kind: 'empty' });
        expect(readLabParams('?seed=3&skeleton=rooms').skeleton).toEqual({ kind: 'rooms' });
        const st = generateStep({ ...base, skeleton: { kind: 'winding' } });
        const url = writeLabParams('', {
            seed: st.seed, biome: st.biome, width: st.width, height: st.height,
            bounds: st.bounds, budget: st.budget, step: 0, skeleton: st.skeleton,
        });
        expect(url).toContain('skeleton=winding');
        expect(writeLabParams('', {
            seed: 3, biome: DEFAULT_MAZE_BIOME, width: 11, height: 11,
            bounds: st.bounds, budget: st.budget, step: 0,
        })).not.toContain('skeleton');
    });

    it('REFUSES an unknown kind at READ time, with the whole vocabulary', () => {
        expect(() => readLabParams('?skeleton=spiral'))
            .toThrow(/\?skeleton="spiral".*is not a skeleton kind/s);
    });

    /** ⛓ The maze can run every kind, INCLUDING the two Seedling refuses. */
    it('accepts the simulator-bound kinds the Seedling page refuses', () => {
        expect(readLabParams('?skeleton=corridor').skeleton).toEqual({ kind: 'corridor' });
        expect(generateStep({ ...base, skeleton: { kind: 'classic' } }).skeleton)
            .toEqual({ kind: 'classic' });
    });

    /** ⛓ The fixed point, AFTER the independent value check above. */
    it('round-trips: what the writer wrote, the reader reads back', () => {
        const st = generateStep({ ...base, skeleton: { kind: 'bushy' } });
        const url = writeLabParams('', {
            seed: st.seed, biome: st.biome, width: st.width, height: st.height,
            bounds: st.bounds, budget: st.budget, step: 0, skeleton: st.skeleton,
        });
        expect(readLabParams(`?${url}`).skeleton).toEqual({ kind: 'bushy' });
    });

    it('the payload carries the block, and an old `open-room` payload DIVERGES BY NAME', () => {
        const st = generateStep({ ...base, step: 2, skeleton: { kind: 'winding' } });
        expect(labPayload(st).skeleton).toEqual({ kind: 'winding' });
        const old = { ...labPayload(st), skeleton: { kind: 'open-room' } };
        const check = agreementWithPayload(old, st);
        expect(check.differences).toContain('skeleton');
        expect(check.agrees).toBe(false);
        // …and the same payload with its own block agrees.
        expect(agreementWithPayload(labPayload(st), st).agrees).toBe(true);
    });

    it('names the kind in the identity line — and only when it is carved', () => {
        expect(describeState(generateStep(base))).not.toMatch(/skeleton: /);
        const line = describeState(generateStep({ ...base, skeleton: { kind: 'rooms' } }));
        expect(line).toMatch(/skeleton: rooms \(CARVED, not the open room\)/);
        expect(line).toMatch(/the SKELETON — a rooms CARVE and its goal/);
    });

    it('lists the kinds as their OWN catalogue section, not as roster rows', () => {
        const rows = skeletonCatalogue({ simulator: true });
        expect(rows).toHaveLength(SKELETON_KIND_NAMES.length);
        expect(rows.every((r) => r.offered)).toBe(true);
        expect(rows.find((r) => r.kind === 'winding').description).toMatch(/dead end/);
        // ⛔ …and NOT in the template catalogue, which is what a RUN draws from.
        expect(labCatalogue(DEFAULT_MAZE_BIOME).groups
            .flatMap((g) => g.templates.map((t) => t.name))).not.toContain('winding');
    });

    it('a LOADED payload keeps the kind that produced it', () => {
        const st = generateStep({ ...base, step: 1, skeleton: { kind: 'loopy' } });
        expect(loadPayload(labPayload(st)).skeleton).toEqual({ kind: 'loopy' });
    });

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SLICE 7 — THE KIND PARAMETERS ON THIS PAGE
     * ══════════════════════════════════════════════════════════════════ */

    it('READS a `;` clause to the expected OBJECT and WRITES the expected STRING', () => {
        expect(readLabParams('?seed=3&skeleton=rooms;minRoom=2').skeleton)
            .toEqual({ kind: 'rooms', params: { minRoom: 2 } });
        expect(readLabParams('?skeleton=winding;chambers=2').skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 2 } });
        const st = generateStep({
            ...base, skeleton: { kind: 'rooms', params: { minRoom: 2, chambers: 1 } },
        });
        const url = writeLabParams('', {
            seed: st.seed, biome: st.biome, width: st.width, height: st.height,
            bounds: st.bounds, budget: st.budget, step: 0, skeleton: st.skeleton,
        });
        expect(new URLSearchParams(url).get('skeleton')).toBe('rooms;minRoom=2;chambers=1');
        // ⛔ …and a value AT its default is not written at all.
        expect(new URLSearchParams(writeLabParams('', {
            seed: 3, biome: DEFAULT_MAZE_BIOME, width: 11, height: 11,
            bounds: st.bounds, budget: st.budget, step: 0,
            skeleton: { kind: 'rooms', params: { minRoom: 3 } },
        })).get('skeleton')).toBe('rooms');
    });

    it('the state carries the NORMALIZED block; the fixed point holds after', () => {
        expect(generateStep({ ...base, skeleton: { kind: 'rooms', params: { minRoom: 3 } } })
            .skeleton).toEqual({ kind: 'rooms' });
        const st = generateStep({
            ...base, skeleton: { kind: 'winding', params: { chambers: 3 } },
        });
        const url = writeLabParams('', {
            seed: st.seed, biome: st.biome, width: st.width, height: st.height,
            bounds: st.bounds, budget: st.budget, step: 0, skeleton: st.skeleton,
        });
        expect(readLabParams(`?${url}`).skeleton)
            .toEqual({ kind: 'winding', params: { chambers: 3 } });
    });

    /**
     * ⛓⛓ A VALUE CLAIM, NOT AN ECHO (trap 269): the parameter must change the
     * ROOM, and the subject is the tile count of step 0 — computed here, from
     * the record the page produced.
     */
    it('`chambers=2` really opens more FLOOR than the same seed without it', () => {
        const floor = (st) => [...st.record.tiles].filter((t) => t === 0).length;
        const bare = generateStep({ ...base, skeleton: { kind: 'winding' } });
        const wide = generateStep({
            ...base, skeleton: { kind: 'winding', params: { chambers: 2 } },
        });
        expect(floor(wide)).toBeGreaterThan(floor(bare));
        // ⛔ and the DEFAULT value is byte-inert — the same room, tile for tile.
        const zero = generateStep({
            ...base, skeleton: { kind: 'winding', params: { chambers: 0 } },
        });
        expect([...zero.record.tiles]).toEqual([...bare.record.tiles]);
    });

    it('names the non-default PARAMETERS in the identity line, and only those', () => {
        expect(describeState(generateStep({ ...base, skeleton: { kind: 'rooms' } })))
            .toMatch(/skeleton: rooms \(CARVED/);
        expect(describeState(generateStep({
            ...base, skeleton: { kind: 'rooms', params: { minRoom: 2, chambers: 1 } },
        }))).toMatch(/skeleton: rooms;minRoom=2;chambers=1 \(CARVED/);
        // ⛔ a value at its default is NOT named — the clause stays readable.
        expect(describeState(generateStep({
            ...base, skeleton: { kind: 'rooms', params: { minRoom: 3 } },
        }))).toMatch(/skeleton: rooms \(CARVED/);
    });

    /**
     * ⛔ THE DISCRIMINATING SUBJECT IS A PAYLOAD THAT SPELLS ITS DEFAULTS OUT.
     * "An old payload with no `params` agrees" is INERT — the state has no
     * `params` either, so that comparison passes whether or not either side is
     * normalized. What only the normalization can carry is the payload that
     * says `{minRoom:3, chambers:0}` where the state says nothing: the same
     * room, two spellings.
     */
    it('a payload spelling its DEFAULTS still AGREES; one naming a value DIVERGES', () => {
        const st = generateStep({ ...base, step: 2, skeleton: { kind: 'rooms' } });
        expect(st.skeleton).toEqual({ kind: 'rooms' });
        const spelled = {
            ...labPayload(st), skeleton: { kind: 'rooms', params: { minRoom: 3, chambers: 0 } },
        };
        expect(agreementWithPayload(spelled, st).agrees).toBe(true);
        const bare = { ...labPayload(st), skeleton: { kind: 'rooms' } };
        expect(agreementWithPayload(bare, st).agrees).toBe(true);
        const other = generateStep({
            ...base, step: 2, skeleton: { kind: 'rooms', params: { minRoom: 2 } },
        });
        expect(agreementWithPayload(labPayload(st), other).differences).toContain('skeleton');
    });

    it('REFUSES an undeclared key and an out-of-domain value at READ time', () => {
        expect(() => readLabParams('?skeleton=winding;minRoom=2'))
            .toThrow(/"winding" has no parameter "minRoom"/);
        expect(() => readLabParams('?skeleton=rooms;minRoom=9'))
            .toThrow(/declared domain \[2, 3, 4\]/);
    });

    it('the CATALOGUE carries each kind\'s schema, for the page\'s form', () => {
        const rows = skeletonCatalogue({ simulator: true });
        expect(rows.find((r) => r.kind === 'rooms').params.map((p) => p.key))
            .toEqual(['minRoom', 'chambers']);
        expect(rows.find((r) => r.kind === 'classic').params).toEqual([]);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE AREA GRAPH AND THE DIRECTIVE — ELEMENTS ARC 1, SLICE 3
 * ══════════════════════════════════════════════════════════════════════ */

describe('mazeLab — ?areas= and ?require=', () => {
    /** ⛓ 15x15 `rooms` at one key: where the acceptance table says a graph runs. */
    const BIG = { width: 15, height: 15, skeleton: { kind: 'rooms' } };
    const BOUNDS = {
        obstacleTarget: 2, triesPerStep: 4, saturationK: 3, anchorTriesPerCandidate: 1,
    };

    it('READS both parameters, and their ABSENCE is the default', () => {
        const bare = readLabParams('?seed=3');
        expect(bare.areas).toEqual({ keys: 0 });
        expect(bare.require).toBe(null);
        const p = readLabParams('?seed=3&areas=2%3Bgraphify%3D0.5&require=K0,K1');
        expect(p.areas).toEqual({ keys: 2, params: { graphify: 0.5 } });
        expect(p.require).toEqual(['K0', 'K1']);
    });

    it('WRITES the LITERAL values, and DELETES both at their defaults', () => {
        const args = {
            source: SOURCES.GENERATE, seed: 3, biome: DEFAULT_MAZE_BIOME, width: 11, height: 11,
            bounds: { obstacleTarget: 2, triesPerStep: 8, saturationK: 3,
                anchorTriesPerCandidate: 1 },
            budget: { maxExpansions: 20000 }, step: 0,
        };
        const q = new URLSearchParams(writeLabParams('', {
            ...args, areas: { keys: 2, params: { graphify: 0.5 } }, require: ['K0', 'K1'],
        }));
        expect(q.get('areas')).toBe('2;graphify=0.5');
        expect(q.get('require')).toBe('K0,K1');
        const bare = new URLSearchParams(writeLabParams('?areas=2&require=K0', args));
        expect(bare.get('areas')).toBe(null);
        expect(bare.get('require')).toBe(null);
    });

    /**
     * ⛓⛓⛓ THE VALUE CLAIM, NOT THE ECHO (trap 269 / §12.8's defect): the spec
     * has to reach the MODEL, and what says so is DOORS ON THE GRID — a page
     * that read the parameter and generated the same room would pass every
     * readout claim and fail this one.
     */
    it('⛓⛓ the spec reaches the MODEL — the level gains DOORS and a KEY', () => {
        const off = generateStep({ seed: 1, step: 0, ...BIG, bounds: BOUNDS });
        const on = generateStep({ seed: 1, step: 0, ...BIG, areas: { keys: 1 }, bounds: BOUNDS });
        expect(off.model.areas.ran).toBe(false);
        expect(on.model.areas.ran).toBe(true);
        const doors = [...on.record.obstacles.values()].filter((id) => id.startsWith('door_K'));
        const keys = [...on.record.items.values()].filter((id) => id.startsWith('key_K'));
        expect(doors.length).toBe(on.model.areas.doors.length);
        expect(doors.length).toBeGreaterThan(0);
        expect(keys).toEqual(['key_K0']);
        // ⛔ …and the room WITHOUT areas carries none of them, so the row above
        // is about the spec rather than about the carve.
        expect([...off.record.obstacles.values()].some((id) => id.startsWith('door_K')))
            .toBe(false);
        expect(JSON.stringify(serializeMazeLevel(on.record)))
            .not.toBe(JSON.stringify(serializeMazeLevel(off.record)));
    });

    it('⛓ the DIRECTIVE is answered at step 0 AND at a ladder rung, with the same proof', () => {
        const zero = generateStep({
            seed: 1, step: 0, ...BIG, areas: { keys: 1 }, require: ['K0'], bounds: BOUNDS,
        });
        const three = generateStep({
            seed: 1, step: 3, ...BIG, areas: { keys: 1 }, require: ['K0'], bounds: BOUNDS,
        });
        for (const st of [zero, three]) {
            expect(st.requireResult.refused).toBe(null);
            expect(st.requireResult.met[0].grade).toBe('STRONG');
            expect(st.requireResult.met[0].planWithoutKey).toBe(null);
        }
        // ⛔ and NO directive means NO result object at all
        expect(generateStep({ seed: 1, step: 0, ...BIG, areas: { keys: 1 }, bounds: BOUNDS })
            .requireResult).toBe(null);
    });

    it('⛔ a REFUSED directive is reported BY NAME on the state, at both rungs', () => {
        for (const step of [0, 2]) {
            const st = generateStep({
                seed: 1, step, ...BIG, areas: { keys: 1 }, require: ['K1'], bounds: BOUNDS,
            });
            expect(st.requireResult.refused.reason)
                .toBe('no-key-level-admits-this-symbol-within-maxkeys');
            expect(st.requireResult.met).toEqual([]);
        }
    });

    it('the IDENTITY LINE names the spec and the directive, and stays SILENT at the default', () => {
        const st = generateStep({
            seed: 1, step: 0, ...BIG, areas: { keys: 1 }, require: ['K0'], bounds: BOUNDS,
        });
        const line = describeState(st);
        expect(line).toMatch(/areas: 1/);
        expect(line).toMatch(/requires: K0/);
        expect(line).toMatch(/require K0 MET — K0 STRONG/);
        expect(line).toMatch(/areas: \d+ area\(s\), 1 symbol\(s\) \[K0\]/);
        const plain = describeState(generateStep({ seed: 1, step: 0, ...ROOM }));
        expect(plain).not.toMatch(/areas:/);
        expect(plain).not.toMatch(/requires:/);
    });

    it('⛔ the identity line prints the module\'s OWN refusal, verbatim', () => {
        /** ⛓ 11x11 at two keys — the honest refusal the acceptance table found. */
        const st = generateStep({
            seed: 2, step: 0, width: 11, height: 11, skeleton: { kind: 'rooms' },
            areas: { keys: 2 }, bounds: BOUNDS,
        });
        expect(st.model.areas.ran).toBe(false);
        expect(describeState(st)).toContain(`⛔ the area graph REFUSED: `
            + `${st.model.areas.refused.reason}`);
    });

    it('the PAYLOAD carries both, and `agreementWithPayload` REPORTS a mismatch by name', () => {
        const st = generateStep({
            seed: 1, step: 2, ...BIG, areas: { keys: 1 }, require: ['K0'], bounds: BOUNDS,
        });
        const payload = labPayload(st);
        expect(payload.areas).toEqual({ keys: 1 });
        expect(payload.require).toEqual(['K0']);
        expect(agreementWithPayload(payload, st).agrees).toBe(true);
        // ⛓ a payload built with a DIFFERENT graph is a reported difference,
        // named — not a silent agreement and not a throw.
        const other = agreementWithPayload({ ...payload, areas: { keys: 2 } }, st);
        expect(other.agrees).toBe(false);
        expect(other.differences).toContain('areas');
        // ⛔ …and a payload naming a value THIS BUILD does not declare is
        // REPORTED rather than thrown at (§14.7's lesson, on the second spec).
        const retired = agreementWithPayload(
            { ...payload, areas: { keys: 1, params: { partition: 'grid' } } }, st);
        expect(retired.agrees).toBe(false);
        expect(retired.differences).toContain('areas');
        // ⛓ a payload written BEFORE this slice carries neither field and still
        // AGREES with a page at the defaults (the both-sides default).
        const old = labPayload(generateStep({ seed: 1, step: 2, ...BIG, bounds: BOUNDS }));
        delete old.areas;
        delete old.require;
        expect(agreementWithPayload(old, generateStep({
            seed: 1, step: 2, ...BIG, bounds: BOUNDS,
        })).agrees).toBe(true);
    });

    it('a LOADED payload reports the graph it names, and derives nothing', () => {
        const st = generateStep({
            seed: 1, step: 1, ...BIG, areas: { keys: 1 }, require: ['K0'], bounds: BOUNDS,
        });
        const back = loadPayload(labPayload(st));
        expect(back.areas).toEqual({ keys: 1 });
        expect(back.require).toEqual(['K0']);
        // ⛔ nothing is re-derived: the loaded model is built at the OPEN room
        // without areas, so there is no graph to draw and no proof to claim.
        expect(back.requireResult).toBe(null);
        expect(back.model.areas.ran).toBe(false);
    });

    it('the URL round trip is a FIXED POINT — asserted only after the literals above', () => {
        const search = 'source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2'
            + '&tries=4&k=3&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000';
        const p = readLabParams(`?${search}`);
        const st = generateWithDirectives({ ...p, step: stepFromParams(p) });
        const written = writeLabParams(`?${search}`, {
            source: p.source, seed: st.seed, biome: st.biome, width: st.width, height: st.height,
            bounds: st.bounds, budget: st.budget, step: st.step, roster: st.roster,
            directives: st.directives, skeleton: st.skeleton, areas: st.areas,
            require: st.require,
        });
        const again = readLabParams(`?${written}`);
        expect(again.areas).toEqual(p.areas);
        expect(again.require).toEqual(p.require);
        expect(JSON.stringify(serializeMazeLevel(
            generateWithDirectives({ ...again, step: stepFromParams(again) }).record,
        ))).toBe(JSON.stringify(serializeMazeLevel(st.record)));
    });

    it('⛔ REFUSES a malformed value BY NAME, naming the parameter', () => {
        expect(() => readLabParams('?areas=9')).toThrow(UrlParamsError);
        expect(() => readLabParams('?areas=9')).toThrow(/\?areas="9"/);
        expect(() => readLabParams('?require=key_red')).toThrow(/\?require="key_red"/);
        expect(() => readLabParams('?require=')).toThrow(/an EMPTY `require` list/);
    });
});
