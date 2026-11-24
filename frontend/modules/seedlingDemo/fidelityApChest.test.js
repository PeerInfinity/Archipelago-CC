/**
 * fidelityApChest — **THE AP CHEST ON A BUILD DECLARING `apchest`** (slice seedling-fidelity-apchest).
 *
 * p4h (`seedling_bot_ap_p4h`, Seedling `p4h-as3` 169247c4c4) builds an `<apitem kind="chest">` as
 * `Pickups/APChest` (`Game.as:2333-2337`): the vanilla `Chest`'s Solid box, bottom line, `frame` latch, 60-update
 * fade and `check()`, with no `checkBySeal`, no `SealPiece` and no RNG draw (`chest.js` `AP_CHEST`). The model reads
 * the build's capabilities (`apChestRoster.declaresApChest`) and builds that element as the `chest` row; the open is
 * the AP location's take (`setPersistence(tag, false)` on the open frame, `APChest.as:90-92`).
 *
 * p4g (capabilities null ⇒ `P4G_CAPABILITIES`, no `apchest`) is untouched: the element is the overlap `APItem`.
 * ⛔ Nothing here is a game witness: the p4h page plays `AP_CHEST_PLANS` (`probe-seedling-apchest.mjs`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AP_CHEST, CHEST, chestProbeLine, chestStanceBand, createChestState, stepChests } from './chest.js';
import { apChestAsChest, apChestRecord, buildLevelWorld } from './levelWorld.js';
import { declaresApChest } from './apChestRoster.js';
import { P4G_CAPABILITIES, setModelBuildDefault } from './modelBuild.js';
import { atlasLevelSource } from './levelSource.js';
import { HITBOX } from './playerPhysicsV1.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { L25_TAPE, l25Sets } from './fidelityL25ApItem.js';
import { AP_CHEST_PLANS, apChestPlanTape, apChestReplay, coverButtonRecord } from './fidelityApChest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MANIFEST = readJson('frontend/modules/flashPanel/wasm/builds.json');
const P4H_CAPS = MANIFEST.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;
const SETS = l25Sets(ROOT);
const DELIVERED = SETS.deliveredSource;
const VANILLA = atlasLevelSource();
const COVER_BUTTON = (src) => (n) => coverButtonRecord(src(n));

/** The three chest levels the rules' latch events sit on, and their delivered chest. */
const CHESTS = { 11: { x: 32, y: 48, tag: 0 }, 25: { x: 96, y: 96, tag: 0 }, 38: { x: 144, y: 112, tag: 1 } };
const plan = (name) => AP_CHEST_PLANS.find((p) => p.name === name);
const play = (name, { src = DELIVERED, capabilities = P4H_CAPS } = {}) => {
    const p = plan(name);
    return { p, ...apChestReplay(apChestPlanTape(ROOT, p), p.modelOnly ? COVER_BUTTON(src) : src, { capabilities }) };
};
const eastFace = CHESTS[25].x + 16 + HITBOX.originX;

describe('the gate is the build\'s capability and the element\'s kind', () => {
    it('p4h declares `apchest`; p4g (the manifest\'s default row) does not', () => {
        expect(declaresApChest(P4H_CAPS)).toBe(true);
        expect(declaresApChest(P4G_CAPABILITIES)).toBe(false);
        expect(declaresApChest(MANIFEST.builds.find((b) => b.role === 'default').capabilities)).toBe(false);
    });
    it('only `<apitem kind="chest">` on an `apchest` build reads as the chest row; anything else is the same object', () => {
        const ap = { type: 'apitem', x: 96, y: 96, attrs: { tag: '0', look: 'chest', kind: 'chest' } };
        const plain = { type: 'apitem', x: 96, y: 96, attrs: { tag: '0', look: 'sword' } };
        expect(apChestAsChest(ap, false)).toBe(ap);
        expect(apChestAsChest(plain, true)).toBe(plain);
        expect(apChestAsChest({ ...ap, attrs: { ...ap.attrs, kind: 'pickup' } }, true).type).toBe('apitem');
        expect(apChestAsChest(ap, true)).toEqual({ type: 'chest', x: 96, y: 96, attrs: { tag: '0' }, apChest: { id: 'apitem@96,96' } });
    });
    it('the delivered set writes `kind: chest` on the three chests the rows walk', () => {
        for (const [n, c] of Object.entries(CHESTS)) {
            const hits = DELIVERED(Number(n)).entities.filter((e) => e.type === 'apitem' && e.x === c.x && e.y === c.y);
            expect(hits.map((e) => [e.attrs.kind, Number(e.attrs.tag)])).toEqual([['chest', c.tag]]);
        }
    });
    it('APChest\'s constants: the chest\'s fade, and no seal, no checkBySeal, no RNG draw (Chest draws at construction)', () => {
        expect(AP_CHEST.openTimerMax).toBe(CHEST.openTimerMax);
        expect([AP_CHEST.drawsAtConstruction, AP_CHEST.drawsOnOpen, AP_CHEST.sealPiece, AP_CHEST.checkBySeal])
            .toEqual([false, false, false, false]);
        expect(CHEST.ctorDraws).toBe(1);
    });
});

describe('p4g: the delivered chest is still the overlap APItem, the world unchanged', () => {
    for (const n of [11, 25, 38]) {
        it(`L${n}: an apitem, no chest, no chest solid; the same record whether the build is named or not`, () => {
            const rec = DELIVERED(n);
            const w = buildLevelWorld(rec);
            const c = CHESTS[n];
            expect(w.apItems.map((a) => [a.id, a.tag])).toEqual([[`apitem@${c.x},${c.y}`, c.tag]]);
            expect(w.chests).toEqual([]);
            expect(w.solids.filter((s) => s.chestId)).toEqual([]);
            expect(apChestRecord(rec, P4G_CAPABILITIES)).toBe(rec);
            expect(apChestRecord(rec, null)).toBe(rec);
        });
    }
    it('every plan replays the same with p4g named as with no build named; the side walk passes through the cell', () => {
        for (const p of AP_CHEST_PLANS) {
            const a = play(p.name, { capabilities: null });
            const b = play(p.name, { capabilities: P4G_CAPABILITIES });
            expect(b.rows).toEqual(a.rows);
            expect(a.takes).toEqual([]);
            expect(a.openTick).toBe(null);
        }
        expect(play('l25-side', { capabilities: null }).rows.at(-1).x).toBeLessThan(CHESTS[25].x + 16);
    });
});

describe('p4h: the AP chest is the vanilla chest\'s Solid, opened only from its bottom line', () => {
    for (const n of [11, 25, 38]) {
        it(`L${n}: a chest row (apChest, its AP id), a chest solid, no apitem; the vanilla chest's rect and band`, () => {
            const w = buildLevelWorld(apChestRecord(DELIVERED(n), P4H_CAPS));
            const c = CHESTS[n];
            expect(w.apItems).toEqual([]);
            expect(w.chests).toEqual([{ id: `chest@${c.x},${c.y}`, tag: 'chest', x: c.x, y: c.y, persistTag: c.tag,
                apChest: true, apItemId: `apitem@${c.x},${c.y}` }]);
            const vanilla = buildLevelWorld(VANILLA(n));
            expect(w.solids.find((s) => s.chestId).rect).toEqual(vanilla.solids.find((s) => s.chestId).rect);
            expect(chestStanceBand(c.x, c.y, HITBOX)).toEqual(chestStanceBand(vanilla.chests[0].x, vanilla.chests[0].y, HITBOX));
        });
    }
    it('Solid before open: the L25 side walk stops at its east face, the walk from above at its top face', () => {
        const side = play('l25-side');
        expect(side.rows.at(-1).x).toBeGreaterThanOrEqual(eastFace);
        expect([side.openTick, side.takes]).toEqual([null, []]);
        const above = play('l25-above');
        expect(above.rows.at(-1).y + HITBOX.height - HITBOX.originY).toBeLessThanOrEqual(CHESTS[25].y);
        expect([above.openTick, above.takes]).toEqual([null, []]);
    });
    it('the L25 survey tape (p4g takes the apitem from the north-east on tick 48) takes nothing on p4h', () => {
        const tape = parseTape(readJson(L25_TAPE));
        const run = createRunForStaging(stagingFromTape(tape), DELIVERED, { capabilities: P4H_CAPS, scratchPersistence: true });
        for (let t = 0; t < tape.tick_count; t++) run.advance(heldKeysAt(tape, t));
        expect(run.earnedClears.filter((c) => c.level === 25 && c.tag === 0)).toEqual([]);
        expect(run.world.apItems ?? []).toEqual([]);
    });
    for (const [n, name] of [[25, 'l25-below'], [11, 'l11-below']]) {
        it(`L${n}: the open frame from the line below is the AP take on that frame, and the passage from it`, () => {
            const { p, rows, openTick, takes, run } = play(name);
            expect(openTick).toBe(p.predicted.openTick);
            expect(takes).toEqual([{ level: n, tag: CHESTS[n].tag, by: `apitem@${CHESTS[n].x},${CHESTS[n].y}`, t: openTick }]);
            // the frame before: the box holds the probe row (`keyLineTouches`), below the chest's bottom face
            const line = chestProbeLine(CHESTS[n].x, CHESTS[n].y);
            expect(rows[openTick - 1].y - HITBOX.originY).toBeLessThanOrEqual(line.y);
            expect(rows[openTick - 1].y - HITBOX.originY).toBeGreaterThanOrEqual(CHESTS[n].y + 16);
            // the passage: the same frame's move already enters the chest's own cell
            expect(rows.findIndex((r) => r.y - HITBOX.originY < CHESTS[n].y + 16)).toBe(p.predicted.passageTick);
            expect(run.sealPiece).toBe(null);
            expect(run.sealCollections).toEqual([]);
            expect(run.chestOpens).toEqual([]);
        });
    }
    it('the vanilla L11 chest under the same keys opens on the same tick, and spawns its SealPiece', () => {
        const v = play('l11-below', { src: VANILLA, capabilities: null });
        expect(v.openTick).toBe(plan('l11-below').predicted.openTick);
        expect(v.run.chestOpens.map((c) => [c.id, c.t])).toEqual([['chest@32,48', v.openTick]]);
        expect(v.takes).toEqual([]);
    });
    it('L38: no open while its Cover overlaps it — the stand under the line, with the cover shut, opens nothing', () => {
        const out = play('l38-covered');
        expect([out.openTick, out.takes]).toEqual([null, []]);
        expect(out.rows.at(-1).y - HITBOX.originY).toBeGreaterThanOrEqual(CHESTS[38].y + 16);
    });
    it('L38 (model-only button): the cover opens, then the chest on the next tick — the vanilla order (named STOP)', () => {
        const ap = play('l38-cover-button');
        const v = play('l38-cover-button', { src: VANILLA, capabilities: null });
        expect(ap.takes.map((t) => t.t)).toEqual([ap.p.predicted.openTick]);
        expect(v.run.chestOpens.map((c) => c.t)).toEqual([ap.p.predicted.openTick]);
        expect(v.run.sealCollections).toHaveLength(1);
        expect(ap.run.sealCollections).toEqual([]);
    });
    it('a save holding every seal part keeps the AP chest Solid (no checkBySeal) and removes the vanilla one', () => {
        const seals = (src, capabilities) => {
            const p = plan('l25-side');
            const tape = apChestPlanTape(ROOT, p);
            const full = parseTape({ ...tape, save: { ...tape.save, seal_parts: Array.from({ length: 16 }, (_, i) => i) } });
            return apChestReplay(full, src, { capabilities }).rows.at(-1).x;
        };
        expect(seals(DELIVERED, P4H_CAPS)).toBeGreaterThanOrEqual(eastFace);
        expect(seals(VANILLA, null)).toBeLessThan(CHESTS[25].x + 16);
    });
});

describe('p4h: the fade, persistence and check()', () => {
    it('the fade is 60 updates counted from the open frame, then removal; hasAllSealParts never removes it', () => {
        const st = createChestState([{ id: 'chest@96,96', x: 96, y: 96, persistTag: 0 }]);
        st.get('chest@96,96').apChest = true;   // as `levelRun.chestStateFor` marks an APChest row
        const line = chestProbeLine(96, 96);
        const under = { x: line.x0, y: line.y, right: line.x0 + 4, bottom: line.y + 5 };
        const away = { x: 0, y: 0, right: 4, bottom: 5 };
        const ctx = (box) => ({ playerBox: box, solidOver: () => false, hasAllSealParts: true });
        expect(stepChests(st, ctx(away))).toEqual([]);
        expect(stepChests(st, ctx(under)))
            .toEqual([{ kind: 'chestopen', id: 'chest@96,96', persistTag: 0, x: 96, y: 96, apChest: true }]);
        let goneAt = null;
        for (let k = 2; k <= 70 && goneAt === null; k++) {
            const ev = stepChests(st, ctx(under));
            expect(ev.some((e) => e.kind === 'chestopen')).toBe(false);
            if (ev.some((e) => e.kind === 'chestgone' && e.why === 'fade')) goneAt = k;
        }
        expect(goneAt).toBe(AP_CHEST.openTimerMax);
        const p = plan('l25-below').predicted;
        expect(p.fadeEndTick).toBe(p.openTick + AP_CHEST.openTimerMax - 1);
    });
    it('the take is banked: a re-entry of L25 builds no chest and no solid (`check()` on the cleared tag)', () => {
        const out = play('l25-below');
        expect(out.run.bankedClears).toContainEqual({ level: 25, tag: 0 });
        const again = buildLevelWorld(apChestRecord(DELIVERED(25), P4H_CAPS), { cleared: [0] });
        expect([again.chests, again.solids.filter((s) => s.chestId), again.apItems]).toEqual([[], [], []]);
    });
    it('a measurement default (`setModelBuildDefault`) reaches a run that names no build', () => {
        const restore = setModelBuildDefault(P4H_CAPS);
        try {
            expect(play('l25-below', { capabilities: null }).takes.map((t) => t.by)).toEqual(['apitem@96,96']);
        } finally { restore(); }
        expect(play('l25-below', { capabilities: null }).takes).toEqual([]);
    });
});

describe('the witness plans: the predicted ticks are the model\'s', () => {
    for (const p of AP_CHEST_PLANS) {
        it(`${p.name}: ${p.what}`, () => {
            expect(play(p.name).openTick).toBe(p.predicted.openTick);
        });
    }
});
