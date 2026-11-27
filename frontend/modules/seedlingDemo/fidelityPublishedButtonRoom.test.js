/**
 * ⛓ SEEDLING FIDELITY BUTTONROOMCLEAR (wave 63) — a ButtonRoom REACHED BY ANOTHER PRESSER'S PUBLISH runs its whole
 * setter (`CONTACT_FIDELITY.publishedButtonRoomSetter`, OFF byte-identical).
 *
 *     Puzzlements/ButtonRoom.as:67-98  if (a): room == -1 → persist (flip 0 true, flip 1 false) to every other
 *                                      Activators of t; room >= 0 → setPersistence(t, persist, room); then :96, its
 *                                      OWN tag cleared
 *     Button.as:42-61 · RopeStart.as:79-91 · Wand.as:55-70 · a local flip-0 ButtonRoom — the callers of `activate = true`
 *     Game.as:2341-2419                every responder class is added AFTER every ButtonRoom (World.addUpdate
 *                                      prepends), so it takes the true, then a flip-1 one's false
 *
 * Game witness (this slice, p4g; staged L38 rooms, group 6; `-evidence/d3/witness-p4g.json`): every shape's ledger,
 * stream and next-visit boot. ON replays it at 0 px with the game's cleared set; OFF misses the published-to clear.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { createActivatorState, flipAnswerGroups, pressedGroups, publishedButtonRoomWrites, queuePublishedTrue, stepActivators } from './activators.js';
import { buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { l25Sets } from './fidelityL25ApItem.js';
import { HANG_SHAPES, hangTape } from './fidelityPresserHang.js';
import { BR_SHAPES, HANG_GROUP, brShape, brTape, hangRecord, hangReplay } from './fidelityPublishedButtonRoom.js';

const KEY = 'publishedButtonRoomSetter';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const WITNESS = JSON.parse(readFileSync(join(ROOT, 'CC/docs/cloud-reports/seedling-fidelity-buttonroomclear-evidence/d3/witness-p4g.json'), 'utf8'));
const VANILLA = atlasLevelSource();
const SETS = l25Sets(ROOT);
/** The base's last four OFF keys (waves 57 to 62), for the composition rows. */
const LAST_FOUR = { nestedRockCeremony: true, plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true };
/** The two controls whose model rows lag the game by one update OFF and ON alike (named, not this key's). */
const LAG_CONTROLS = new Set(['btn-lock', 'btn-cover']);

const num = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const srcFor = (shape) => (n) => hangRecord(SETS.vanillaSource(n), shape);
const replay = (shape, over = {}) => withContactFidelity({ [KEY]: false, ...over }, () => {
    const r = hangReplay(brTape(ROOT, shape), srcFor(shape));
    // Read the ledgers inside the switch scope (a reader is a consumer like any other).
    const cleared = new Set(shape.clears.map((t) => `38,${t}`));
    if (r.run) {
        for (const c of [...r.run.earnedClears, ...r.run.bankedClears, ...r.run.ledger('unreadRoomWrites')]) {
            if (c.level === 37 || c.level === 38) cleared.add(`${c.level},${c.tag}`);
        }
    }
    return { ...r, cleared: [...cleared].sort(num).join(' '), whole: JSON.stringify({ rows: r.rows, error: r.error,
        roomWrites: r.run?.roomWrites, earned: r.run?.earnedClears, banked: r.run?.bankedClears }) };
});
const gameOf = (name) => {
    const row = WITNESS.rows.find((r) => r.shape === name);
    return { ticks: row.drain.ticks, cleared: row.summary.cleared.split(' ').filter(Boolean).sort(num).join(' '), level: row.summary.level };
};
const maxPx = (game, rows) => {
    let px = 0;
    for (let i = 0; i < game.length; i++) {
        if (game[i].level !== rows[i].level) return Infinity;
        px = Math.max(px, Math.abs(game[i].x - rows[i].x), Math.abs(game[i].y - rows[i].y));
    }
    return px;
};
const tapeResult = (name, over, src = VANILLA) => withContactFidelity({ [KEY]: false, ...over }, () => {
    try { return JSON.stringify(runTape(loadTape(name), { levelSource: src })); } catch (e) { return `THROW ${e.name}: ${e.message}`; }
});

describe('BUTTONROOMCLEAR — the key', () => {
    it('ships OFF, appended last, with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        // ⛓ wave 65 (RESPONDERORDER) appended `responderStepAfterReaders` after it.
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(KEY) + 1)).toEqual(['responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame']);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PUBLISHED_BUTTON_ROOM_SETTER');
    });
    it.skipIf(!!process.env.SEEDLING_PUBLISHED_BUTTON_ROOM_SETTER)('is OFF in this process', () => {
        expect(CONTACT_FIDELITY[KEY]).toBe(false);
    });
});

describe('BUTTONROOMCLEAR — the parts, on built worlds', () => {
    const world = (name) => buildLevelWorld(hangRecord(VANILLA(38), brShape(name)));
    it('flipAnswerGroups: the groups holding a local flip-1 ButtonRoom (not a cross-room or flip-0 one)', () => {
        expect([...flipAnswerGroups(world('btn-br1'))]).toEqual([HANG_GROUP]);
        expect([...flipAnswerGroups(world('btn-brx1'))]).toEqual([]);
        expect([...flipAnswerGroups(buildLevelWorld(VANILLA(38)))]).toEqual([]);
    });
    it('publishedButtonRoomWrites: the reached ones in getClass order (the reverse XML order), once per visit, not the publisher, not a flip-0', () => {
        const w = world('btn-brx0-then-brx1');
        const st = createActivatorState(w);
        const ev = [];
        publishedButtonRoomWrites(st, w, HANG_GROUP, 'button@144,224', ev);
        expect(ev.map((e) => [e.id, e.writes.map((x) => `${x.level ?? 38},${x.tag}=${x.value}`)])).toEqual([
            ['buttonroom@112,240', ['37,6=false', '38,11=false']],
            ['buttonroom@176,240', ['37,6=true', '38,10=false']],
        ]);
        const again = [];
        publishedButtonRoomWrites(st, w, HANG_GROUP, 'button@144,224', again);
        expect(again).toEqual([]);
        const w0 = world('br0-br1');
        const st0 = createActivatorState(w0);
        const ev0 = [];
        publishedButtonRoomWrites(st0, w0, HANG_GROUP, 'buttonroom@144,224', ev0);
        expect(ev0.map((e) => e.id)).toEqual(['buttonroom@176,240']);
    });
    it('ON: a Button press in a flip-answer group presses nothing, and the queued publish is drained by the step', () => {
        const w = world('btn-br1');
        const box = w.pressers.find((p) => p.tag === 'button' && p.t === HANG_GROUP).rect;
        const on = withContactFidelity({ [KEY]: true }, () => pressedGroups(w, box));
        const off = withContactFidelity({ [KEY]: false }, () => pressedGroups(w, box));
        expect(off.has(HANG_GROUP)).toBe(true);
        expect(on.has(HANG_GROUP)).toBe(false);
        const st = withContactFidelity({ [KEY]: true }, () => createActivatorState(w));
        queuePublishedTrue(st, HANG_GROUP, 'test');
        const ev = withContactFidelity({ [KEY]: true }, () => stepActivators(st, w, { x: 0, y: 0, w: 1, h: 1, right: 1, bottom: 1 }, { inventory: {}, keys: new Set() }));
        expect(ev.filter((e) => e.kind === 'roomwrite').map((e) => [e.id, e.publishedBy])).toEqual([['buttonroom@176,240', 'test']]);
        expect(st.publishedTrue).toEqual([]);
    });
});

describe('BUTTONROOMCLEAR — every witnessed shape (ON = the game; OFF plays as today)', () => {
    for (const { name, source } of BR_SHAPES) {
        it(`${name}: ${source}`, () => {
            const shape = brShape(name);
            const game = gameOf(name);
            const off = replay(shape);
            const on = replay(shape, { [KEY]: true });
            expect(on.error).toBeNull();
            expect(on.rows.length).toBe(game.ticks.length);
            expect(on.cleared).toBe(game.cleared);
            if (LAG_CONTROLS.has(name)) {
                // The control: the key changes nothing, and the model's one-update Lock/Cover lag is the base's (named).
                expect(on.whole).toBe(off.whole);
                expect(maxPx(game.ticks, on.rows)).toBe(Infinity);
            } else {
                expect(maxPx(game.ticks, on.rows)).toBe(0);
                // OFF misses what the published-to ButtonRoom wrote (or, with a responder, opens it).
                expect(off.cleared).not.toBe(game.cleared);
            }
        });
    }
    it('the next-visit boot: the published-to ButtonRoom boots pressed on re-entry ON (OFF unpressed), the ledger unchanged by the re-entry', () => {
        for (const name of ['btn-br1-revisit', 'btn-brx1-revisit', 'br0-br1-revisit']) {
            const shape = brShape(name);
            const on = replay(shape, { [KEY]: true });
            const off = replay(shape);
            const tags = (r) => r.cleared.split(' ').filter((c) => c.startsWith('38,')).map((c) => Number(c.slice(3)));
            const boot = (r) => buildLevelWorld(hangRecord(VANILLA(38), shape), { cleared: tags(r) }).pressers.find((p) => p.x === 176 && p.y === 240).bootPressed;
            expect([name, boot(on), boot(off)]).toEqual([name, true, false]);
            // the walk-in (t99) adds nothing to the ledger: the re-entry's `check()` re-writes the values it holds
            const walk = replay({ ...shape, name: name.replace('-revisit', '') }, { [KEY]: true });
            expect(on.cleared).toBe(walk.cleared);
        }
    });
});

describe('BUTTONROOMCLEAR — the near misses (ON = OFF, the whole result)', () => {
    const T = String(HANG_GROUP);
    const mk = (name, entities) => ({ name, tape: 'walk', clears: [], entities });
    const NEAR = [
        mk('br1-alone (pressed directly)', [{ type: 'buttonroom', x: 144, y: 224, attrs: { tset: T, tag: '10', flip: '1', room: '-1' } }]),
        mk('btn + br1 in another group', [{ type: 'button', x: 144, y: 224, attrs: { tset: T } }, { type: 'buttonroom', x: 176, y: 240, attrs: { tset: '7', tag: '10', flip: '1', room: '-1' } }]),
        mk('br1 publishes false into a br1', [{ type: 'buttonroom', x: 144, y: 224, attrs: { tset: T, tag: '10', flip: '1', room: '-1' } }, { type: 'buttonroom', x: 176, y: 240, attrs: { tset: T, tag: '11', flip: '1', room: '-1' } }]),
        mk('brx pressed directly + a Button off the walk (wave 62 brx-btn)', [{ type: 'buttonroom', x: 144, y: 224, attrs: { tset: T, tag: '10', flip: '0', room: '37' } }, { type: 'button', x: 176, y: 240, attrs: { tset: T } }]),
    ];
    for (const shape of NEAR) {
        it(shape.name, () => {
            expect(replay(shape, { [KEY]: true }).whole).toBe(replay(shape).whole);
        });
    }
});

describe('BUTTONROOMCLEAR — composition', () => {
    it('with presserRecursionHang ON: every wave-62 shape is unchanged by this key (the hangs still refuse)', () => {
        for (const shape of HANG_SHAPES) {
            const go = (over) => withContactFidelity({ [KEY]: false, presserRecursionHang: true, ...over }, () => {
                const r = hangReplay(hangTape(ROOT, shape), srcFor(shape));
                return JSON.stringify({ rows: r.rows, error: r.error });
            });
            const both = go({ [KEY]: true });
            expect([shape.name, both]).toEqual([shape.name, go({})]);
        }
        const hung = withContactFidelity({ [KEY]: true, presserRecursionHang: true }, () => hangReplay(hangTape(ROOT, HANG_SHAPES.find((s) => s.name === 'btn-br0')), srcFor(HANG_SHAPES.find((s) => s.name === 'btn-br0'))));
        expect(hung.error?.name).toBe('PresserRecursionHang');
    });
    it('with the base\'s last four OFF keys ON: the witnessed shapes still match the game', () => {
        for (const name of ['btn-br1', 'btn-brx0-then-brx1', 'pull-br1', 'btn-br1-lock', 'br0-br1-revisit']) {
            const shape = brShape(name);
            const game = gameOf(name);
            const on = replay(shape, { ...LAST_FOUR, [KEY]: true });
            expect([name, on.cleared, maxPx(game.ticks, on.rows)]).toEqual([name, game.cleared, 0]);
        }
    });
    it('prox-l38-chest with all five ON = the last four alone', () => {
        expect(tapeResult('prox-l38-chest', { ...LAST_FOUR, [KEY]: true })).toBe(tapeResult('prox-l38-chest', LAST_FOUR));
    });
});

describe('BUTTONROOMCLEAR — vanilla (ON = OFF, the whole result)', () => {
    // The rooms holding a ButtonRoom (L20, L38, L40, L61, L63, L107) and the wand's sweep (L43), on committed tapes.
    for (const name of ['prox-l38-chest', 'prox-l38-reach-l39', 'r5-l38-fade-door', 'r5-l40-part0', 'r5-l40-join', 'l40button-l41-part0',
        'axe-l61-reach-l63', 'r3-collect-shield', 'r5-l43-wand', 'r5-shaft', 'f7-l16-reentry']) {
        it(name, () => {
            expect(tapeResult(name, { [KEY]: true })).toBe(tapeResult(name, {}));
        });
    }
});
