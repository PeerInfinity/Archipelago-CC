/**
 * Seedling fidelity L25APITEM (wave 37d): a playthrough AP chest is the `apitem` the delivery ships.
 *
 *   · D1 (the room): `apChestDelivery.deliveredChestDocument` writes, for each of the 16 ledger chests, exactly the
 *     element the randomizer's own `rewriteRecordSet` writes (type `apitem`, the chest's cell, its vanilla tag), and
 *     touches nothing else.
 *   · D1 (the game): the survey's step-34 tape on the DELIVERED set takes `apitem@96,96` on tick 48 — inside the
 *     chest's own cell, from the north-east, never from under it — and the model replays the game at 0 px
 *     (`fixtures/l25apitem-witness/oracle.json`, `probe-seedling-l25-apitem.mjs --record`, p4g). The VANILLA set is
 *     the control: the same keys leave the Chest Solid, and the model's bottom-line room is the game's at 0 px too.
 *   · D1 (the solver): at the survey's call shape, the delivered room SOLVES with strategy `apitem` (taken on 48, the
 *     committed tape's ticks), and the vanilla room still refuses on the bottom-line stance (STANCE_REENTRY).
 *   · OFF: the key is read by the route survey alone — a vanilla chest still opens from its bottom line with it ON.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { apChestRows, deliveredChestDocument } from './apChestDelivery.js';
import { L25_ORACLE, l25Replay, l25Sets, l25Tape } from './fidelityL25ApItem.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const ORACLE = readJson(L25_ORACLE);
const SETS = l25Sets(ROOT);
const TAPE = l25Tape(ROOT);
const GOALS = [{ kind: 'collect-placement', placement: { x: 96, y: 96 } }, { kind: 'reach-exit', exit: { x: 144, y: 32 } }];

describe('L25APITEM D1 — the room: the delivery\'s own apitem in place of each ledger chest', () => {
    const doc = deliveredChestDocument(MAP);
    const chestLevels = R7_GOAL_LEDGER.filter((r) => r.kind === 'chest').map((r) => r.level);
    it('the key ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.apChestItem).toBe(false);
    });
    it('replaces exactly the 16 ledger chests, at their cell, with their vanilla tag', () => {
        expect(chestLevels).toHaveLength(16);
        expect(doc.apChestDelivery.replaced.map((r) => r.level)).toEqual(chestLevels);
        expect(doc.levels.filter((l) => chestLevels.includes(l.level) && l.entities.some((e) => e.type === 'chest'))).toEqual([]);
        expect(apChestRows(MAP)).toHaveLength(16);
        for (const l of MAP.levels) {
            const out = doc.levels.find((x) => x.level === l.level);
            if (!chestLevels.includes(l.level)) { expect(out).toBe(l); continue; }
            const i = l.entities.findIndex((e) => e.type === 'chest');
            expect(out.entities.filter((e, j) => j !== i)).toEqual(l.entities.filter((e, j) => j !== i));
            expect(out.entities[i]).toEqual({ type: 'apitem', x: l.entities[i].x, y: l.entities[i].y,
                attrs: { tag: l.entities[i].attrs.tag, look: 'chest' } });
        }
        expect(MAP.levels.find((l) => l.level === 25).entities.some((e) => e.type === 'chest')).toBe(true);
    });
    it('is the randomizer\'s own rewrite (type, cell, tag) for every chest row', () => {
        const rooms = new Map(SETS.delivered.rooms.map((r) => [r.id, r.source.record]));
        for (const r of doc.apChestDelivery.replaced) {
            const hits = rooms.get(r.level).entities.filter((e) => e.type === 'apitem' && e.x === r.x && e.y === r.y);
            expect(hits).toHaveLength(1);
            expect(Number(hits[0].attrs.tag)).toBe(r.tag);
        }
    });
});

describe('L25APITEM D1 — the game: the delivered L25 takes the chest from the north-east, at 0 px', () => {
    const d = l25Replay(TAPE, SETS.deliveredSource);
    const v = l25Replay(TAPE, SETS.vanillaSource);
    it('the oracle is the probe\'s, on p4g, for this tape and these sets', () => {
        expect(ORACLE).toMatchObject({ build: 'seedling_bot_ap_p4g', delivered_set: SETS.delivered.set_id,
            vanilla_set: SETS.vanilla.set_id, slot: '25,0' });
    });
    it('the model takes apitem@96,96 on the GAME\'s tick (the TAKE/BEFORE bracket), inside the chest\'s cell', () => {
        expect(d.apItems.map((a) => [a.id, a.tag, a.rect.x, a.rect.y, a.rect.w, a.rect.h])).toEqual([['apitem@96,96', 0, 100, 100, 8, 8]]);
        expect(d.takenAt).toBe(48);
        expect(ORACLE.takenAt).toBe(48);
        expect(ORACLE.take).toEqual({ ticks: 49, cleared: true });
        expect(ORACLE.before).toEqual({ ticks: 48, cleared: false });
        expect(d.rows[48]).toEqual(ORACLE.takenAtGame);
        // ⛔ NOT the bottom line: the take stands ABOVE the chest's bottom edge (y 112) and RIGHT of its centre.
        expect(d.taken.at.y).toBeLessThan(112);
        expect(d.taken.at.x).toBeGreaterThan(104);
    });
    it('the whole tape: the game\'s stream is the model\'s (0 px, 109 rows), 0 hits, out to L22', () => {
        expect(ORACLE.delivered).toMatchObject({ observations: 109, cleared: true, hits: 0, positions: { compared: 109, worst: 0 } });
        expect(d.rows).toHaveLength(109);
        expect(d.rows.at(-1)).toEqual(ORACLE.delivered.end);
    });
    it('CONTROL: the vanilla set keeps the Chest Solid, and the model\'s vanilla room is the game\'s at 0 px', () => {
        expect(v.apItems).toEqual([]);
        expect(v.chestOpens).toEqual([]);
        expect(ORACLE.vanilla).toMatchObject({ cleared: false, positions: { compared: 109, worst: 0 } });
        expect(v.rows.at(-1)).toEqual(ORACLE.vanilla.end);
        expect(v.rows.findIndex((r, i) => r.x !== d.rows[i].x || r.y !== d.rows[i].y)).toBe(45);
    });
});

describe('L25APITEM D1 — the solver at the survey\'s call shape', () => {
    const atlas = patchedMapDocument(MAP);
    const staging = stagingFromTape(TAPE);
    it('the delivered room SOLVES: strategy `apitem`, taken on 48, the committed tape\'s 108 ticks', () => {
        const run = createRunForStaging(staging, levelSourceFromAtlas(deliveredChestDocument(atlas)));
        const out = solveSegment({ run, goals: GOALS, name: 'l25apitem', boot: staging.boot });
        expect(out.records.map((r) => [r.goal, r.strategy ?? null, r.arm ?? null, r.takenAt ?? null]))
            .toEqual([['collect-placement', 'apitem', 'walk', 48], ['reach-exit', null, null, null]]);
        expect(out.perTick).toHaveLength(TAPE.tick_count);
    });
    it('the vanilla room still refuses on the bottom-line stance (the non-AP rule is unchanged)', () => {
        const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
        expect(() => solveSegment({ run, goals: GOALS, name: 'l25apitem-vanilla', boot: staging.boot }))
            .toThrow(/chest \(96,96\) stance: STANCE_REENTRY/);
    });
    it('the key is not read by the model: a vanilla chest opens from its bottom line with it ON (r8-solve-11)', () => {
        const tape = parseTape(readJson('frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-11.json'));
        const opens = (on) => withContactFidelity({ apChestItem: on }, () => runTape(tape, { levelSource: atlasLevelSource() }).chestOpens.map((c) => c.id));
        expect(opens(false)).toContain('chest@32,48');
        expect(opens(true)).toEqual(opens(false));
    });
});
