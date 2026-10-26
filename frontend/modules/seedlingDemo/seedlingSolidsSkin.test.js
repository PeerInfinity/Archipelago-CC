/**
 * seedlingSolidsSkin — G8's proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL TAPES through the model: L3's rock and ghost rock broken
 *      (`ghostsword-l3-rock*`), L38's covers opened and its chest opened and
 *      faded (`prox-l38-chest`), L24's tree burned (`burn-l24-reach-exit`), L71's
 *      lock held open from its button (`l71-hold-102-open`), L20's ButtonRoom
 *      booting pressed (`f6-l20-reentry`), L31's and L30's boss locks opened
 *      (`r5-bosskey-leg`), and L43's magical lock destroyed by the wand (the
 *      `wandL43` drive). Each tick's ops are a golden line; a run of identical
 *      lines is one line (`t=a..b`). ⚠ CHANGE DETECTORS recorded from this
 *      renderer: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM, by hand from the AS3: the chest's timer and
 *      alpha, each animation's frame list, the world-clock frames, a button's
 *      one-update lag, the layers.
 *   3. ONE FACT: each animation's last frame is drawn on the run's own end
 *      tick, and the body is gone on the next.
 *   4. ONE MUTANT PER FAMILY (`SOLIDS_RULES`, and dropping the skin): each
 *      turns a golden red.
 *   5. THE ADAPTER reads the run and writes nothing.
 *   6. ⛔ STATE IDENTITY: each tape's stream, final state, ledgers and
 *      `stateDigest` identical with the adapter (incl. `activatorsNow`), the
 *      reducer and the ops running every tick, and without.
 *   7. THE PAGE: `roomOps` with the new predicate loses exactly the replaced
 *      rectangles.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createLevelRun } from './levelRun.js';
import { md5 } from './md5.js';
import { runTape as runFixtureTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { formatOp, roomOps } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { worldFrame } from './seedlingEnemySkin.js';
import { HIT_TO_GONE_TICKS as ROCK_N } from './breakableRocks.js';
import { HIT_TO_GONE_TICKS as TREE_N } from './burnableTree.js';
import { MAGICAL_LOCK_CALLBACK_TICK_OFFSET } from './magicalLock.js';
import { ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import {
    KEYS, RESPONDER_ART, SOLIDS_COVERAGE, SOLIDS_OBJECT_TAGS, SOLIDS_RULES, solidsOps, solidsSkinView, stepSolidsSkin,
} from './seedlingSolidsSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** `wandL43.test.js`'s drive: face north, one wand press at t20 (the shot opens the lock at t30), stand. */
const L43_WAND = Object.freeze({
    boot: { level: 43, x: 144, y: 152 }, grants: [{ level: 43, items: ['wand'] }], equips: [{ t: 0, slot: 0 }], n: 60,
    spans: [{ key: 'up', from: 0, to: 2 }, { key: 'primary', from: 20, to: 20 }],
});

/**
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * `drive` a `createLevelRun` with held-key spans. `want` is what the tape
 * must really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'L3-rock-breaks', fixture: 'ghostsword-l3-rock', want: ['r:whole', 'r:breaking', 'r:ghost'] },
    { name: 'L3-ghost-rock-breaks', fixture: 'ghostsword-l3-rockghost', want: ['r:ghost', 'r:breaking'] },
    { name: 'L38-chest-covers', fixture: 'prox-l38-chest',
        want: ['c:shut', 'c:open', 'a:cover', 'a:open', 'bt:button', 'bt:buttonroom', 'bt:wire'] },
    { name: 'L24-tree-burns', fixture: 'burn-l24-reach-exit', want: ['t:whole', 't:burning'] },
    { name: 'L43-wand-lock', drive: L43_WAND, want: ['m:whole', 'm:destroying'] },
    { name: 'L71-lock-opens', fixture: 'l71-hold-102-open', want: ['a:lock', 'a:shieldlock', 'a:open', 'bt:button', 'bt:down', 'c:shut'] },
    { name: 'L20-buttonroom-boots-down', fixture: 'f6-l20-reentry', want: ['bt:buttonroom', 'bt:down', 'a:lock', 'a:open'] },
    { name: 'L31-bosslock-opens', fixture: 'r5-bosskey-leg', want: ['a:bosslock', 'a:open', 'r:whole'] },
]);

const LEDGERS = ['transitions', 'playerHits', 'playerDeaths', 'earnedClears'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v instanceof Set ? [...v] : v;
}) : null);

/** Drive a tape; `each(tick, run)` after every tick. Returns what the state identity compares. */
function drive(tape, each = () => {}) {
    if (tape.fixture) {
        let last = null;
        const stream = [];
        const out = runFixtureTape(fixture(tape.fixture), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
        });
        return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last)]),
            digest: last?.stateDigest ? JSON.stringify(last.stateDigest()) : null };
    }
    const d = tape.drive;
    const run = createLevelRun({ levelSource: atlasLevelSource(), boot: d.boot, grants: d.grants, equips: d.equips, noDamage: true });
    const stream = [];
    for (let t = 0; t < d.n; t += 1) {
        const r = run.advance(new Set(d.spans.filter((s) => t >= s.from && t <= s.to).map((s) => s.key)));
        stream.push(JSON.stringify([t, run.level, run.state, r.transition ?? null]));
        each(t, run);
    }
    return { stream, end: JSON.stringify([ledgersOf(run), run.magicalLocksOpened]), digest: JSON.stringify(run.stateDigest()) };
}

/** Run a tape with the renderer; per tick: the view, the skin and the ops. */
function runTape(tape, opts = {}) {
    const rows = [];
    let skin = null;
    drive(tape, (tick, run) => {
        const view = solidsSkinView(run, { record: recordOf(run.level) });
        skin = stepSolidsSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : solidsOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    const v = r.view;
    for (const c of v.chests) out.push(c.open ? 'c:open' : 'c:shut');
    for (const b of v.rocks) { out.push(b.k === null ? 'r:whole' : 'r:breaking'); if (b.ghost) out.push('r:ghost'); }
    for (const t of v.trees) out.push(t.k === null ? 't:whole' : 't:burning');
    for (const m of v.magicalLocks) out.push(m.k === null ? 'm:whole' : 'm:destroying');
    for (const a of v.responders) out.push(`a:${a.tag}`, ...(a.open ? ['a:open'] : []));
    for (const b of v.buttons) {
        out.push(`bt:${b.tag}`);
        if (r.skin.buttons.get(b.id)?.shown) out.push('bt:down');
        if (b.wire) out.push('bt:wire');
    }
    return out;
}
function goldenLines(rows) {
    const lines = [];
    let open = null;
    for (const r of rows) {
        const body = `L${r.view.level} [${[...new Set(tagsOf(r))].join(',')}] | ${r.ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`.trimEnd();
        if (open && open.body === body) { open.to = r.tick; continue; }
        if (open) lines.push(open);
        open = { from: r.tick, to: r.tick, body };
    }
    if (open) lines.push(open);
    return lines.map((l) => `t=${l.from}${l.to !== l.from ? `..${l.to}` : ''} ${l.body}`);
}

function golden(name, lines) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        mkdirSync(GOLDENS, { recursive: true });
        writeFileSync(path, `${lines.join('\n')}\n`);
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

const ROWS = new Map();
const rowsOf = (tape) => {
    if (!ROWS.has(tape.name)) ROWS.set(tape.name, runTape(tape));
    return ROWS.get(tape.name);
};

describe('1. golden solids ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's chests, rocks, trees, locks and buttons`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`solids-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G8\'s classes are new, every key reached the pack', () => {
        for (const k of [...Object.values(KEYS), ...Object.values(RESPONDER_ART).map((s) => s.key).filter((k) => typeof k === 'string'),
            ...[0, 1, 2, 3, 4].map((i) => RESPONDER_ART.bosslock.key({ keyType: i }))]) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn]);
        for (const c of SOLIDS_COVERAGE.drawn) expect(before.has(c), `${c} is G8's`).toBe(false);
    });
});

describe('2. by hand from the AS3', () => {
    const RUN = {};
    const V = (over = {}) => ({ epoch: { run: RUN, key: 'syn' }, level: 9, now: 100, gameTime: 900,
        chests: [], rocks: [], trees: [], magicalLocks: [], responders: [], rockLocks: [], buttons: [], ...over });
    const frames = (key, name, n) => Array.from({ length: n }, (_, k) => SOLIDS_RULES.spriteAfter(key, name, k).frame);

    it('a chest: frame 1 and openTimer 60 − 1 on the opening update, alpha min(timer / 20, 1), gone at 0; layer = its cell top', () => {
        const c = (open) => ({ id: 'chest@32,48', x: 32, y: 48, open });
        let skin = null;
        const seen = [];
        for (let i = 0; i < 62; i += 1) {
            const v = V({ chests: [c(i >= 1)] });
            skin = stepSolidsSkin(skin, v, i);
            const [op] = solidsOps(v, art, { skin });
            seen.push(op ? [op.frame, +(op.alpha ?? 1).toFixed(4)] : null);
            if (i === 0) expect([op.dx, op.dy, op.layer]).toEqual([32, 48, -48]);
        }
        expect(seen[0]).toEqual([0, 1]);
        expect(seen[1]).toEqual([1, 1]);           // timer 59
        expect(seen[40]).toEqual([1, 1]);          // timer 20
        expect(seen[41]).toEqual([1, 0.95]);       // timer 19
        expect(seen[59]).toEqual([1, 0.05]);       // timer 1
        expect(seen[60]).toBe(null);               // timer 0: removed
    });

    it('the animations: Spritemap at 1/30 s a tick (FP.elapsed\'s clamp)', () => {
        // break [0,1,2,3] @20: the timer gains 0.666 an update; destroy [3..9] @15 and burn [0..19] @15 gain 0.4995
        expect(frames(KEYS.rock, 'break', 7)).toEqual([0, 0, 1, 1, 2, 3, 3]);
        expect(frames(KEYS.magicalLock, 'destroy', 15)).toEqual([3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
        expect(frames(KEYS.tree, 'burn', 41)).toEqual([0, 0, 0, ...Array.from({ length: 19 }, (_, i) => [i + 1, i + 1]).flat()]);
    });

    it('the world-clock frames: a lock Game.worldFrame(frameCount) and a magical lock worldFrame(3), at the render clock', () => {
        for (const time of [0, 7, 8, 30, 44, 45]) {
            const v = V({ gameTime: time, responders: Object.keys(RESPONDER_ART).map((tag, i) => ({ id: `${tag}@${16 * i},0`, tag, x: 16 * i, y: 0, keyType: 0, open: false })),
                magicalLocks: [{ id: 'm', x: 0, y: 32, fire: false, k: null }] });
            const ops = solidsOps(v, art, { skin: stepSolidsSkin(null, v, 1) });
            expect(ops.map((o) => o.frame)).toEqual([worldFrame(time, 3), ...Object.values(RESPONDER_ART).map((s) => worldFrame(time, s.frames))]);
        }
    });

    it('the layers and origins: each class\'s own `layer`, centred on its cell', () => {
        const v = V({
            rocks: [{ id: 'r', x: 16, y: 32, ghost: false, k: null }], trees: [{ id: 't', x: 48, y: 64, k: null }],
            magicalLocks: [{ id: 'm', x: 80, y: 96, fire: true, k: null }],
            responders: [{ id: 'l', tag: 'lock', x: 0, y: 112, open: false }, { id: 'c', tag: 'cover', x: 16, y: 112, open: false },
                { id: 'b', tag: 'bosslock', x: 32, y: 112, keyType: 4, open: false }, { id: 'o', tag: 'lock', x: 48, y: 112, open: true }],
            rockLocks: [{ x: 64, y: 112 }],
            buttons: [{ id: 'button@0,128', tag: 'button', x: 0, y: 128, boot: false, down: false, wire: false },
                { id: 'buttonroom@16,128', tag: 'buttonroom', x: 16, y: 128, boot: true, down: true, wire: true }],
        });
        const ops = solidsOps(v, art, { skin: stepSolidsSkin(null, v, 1) });
        expect(ops.map((o) => [o.key.split('/')[1], o.dx, o.dy, o.layer])).toEqual([
            ['breakablerock', 16, 32, -48], ['burnabletree', 48, 64, -96], ['magicallockfire', 77, 93.5, -112],
            ['lock', 0, 112, -120], ['cover', 16, 112, -129], ['bosslock4', 32, 112, -128],   // the open lock is not drawn
            ['rocklock', 64, 112, 0], ['button', 4, 132, -136], ['buttonroom', 16, 128, 100],
        ]);
        expect(ops.at(-1).frame).toBe(3);   // a ButtonRoom booted down over a wire: int(true) + 2
    });

    it('a button: the frame after a tick is the press the run reported after the one BEFORE (it updates before the Player)', () => {
        const b = (down) => ({ id: 'button@0,0', tag: 'button', x: 0, y: 0, boot: false, down, wire: false });
        let skin = null;
        const shown = [];
        for (const d of [false, true, true, false, false]) {
            skin = stepSolidsSkin(skin, V({ buttons: [b(d)] }), 1);
            shown.push(skin.buttons.get('button@0,0').shown);
        }
        expect(shown).toEqual([false, false, true, true, false]);
    });
});

describe('3. ONE FACT: the last frame is drawn on the run\'s own end tick', () => {
    // `first`: the k of the first view after the hit. A rock / tree is hit by the PLAYER, who updates after it, so its
    // graphic has not stepped yet (0); the wand shot is added after the lock and updates BEFORE it (`addUpdate`
    // prepends), so the lock's graphic steps in the hit's own update (1) — `MAGICAL_LOCK_CALLBACK_TICK_OFFSET` says so.
    const FAMILIES = [
        ['L3-rock-breaks', (v) => v.rocks, ROCK_N, 3, 0],
        ['L24-tree-burns', (v) => v.trees, TREE_N, 19, 0],
        ['L43-wand-lock', (v) => v.magicalLocks, MAGICAL_LOCK_CALLBACK_TICK_OFFSET + 1, 9, 1],
    ];
    for (const [name, bodies, n, lastFrame, first] of FAMILIES) {
        it(`${name}: k runs ${first}..${n - 1} (the model's own count), ends on frame ${lastFrame}, and the body is gone the view after`, () => {
            const rows = rowsOf(TAPES.find((t) => t.name === name));
            const ks = new Map();
            rows.forEach((r, i) => {
                for (const b of bodies(r.view)) if (b.k !== null) (ks.get(b.id) ?? ks.set(b.id, []).get(b.id)).push([i, b.k]);
            });
            expect(ks.size).toBeGreaterThan(0);
            for (const [id, seq] of ks) {
                expect(seq.map(([, k]) => k)).toEqual(Array.from({ length: n - first }, (_, k) => k + first));
                const [i, k] = seq.at(-1);
                const key = rows[i].ops.find((o) => o.key && bodies(rows[i].view).some((b) => b.id === id))?.key;
                expect(SOLIDS_RULES.spriteAfter(key, Object.keys(art.resolve(key).sprite.anims)[0], k).frame).toBe(lastFrame);
                expect(bodies(rows[i + 1].view).some((b) => b.id === id), `${id} gone after its last frame`).toBe(false);
            }
        }, 240_000);
    }
});

describe('4. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `solids-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['the skin dropped (rocks)', 'L3-rock-breaks', { drop: true }],
        ['the skin dropped (chest, covers, buttons)', 'L38-chest-covers', { drop: true }],
        ['the skin dropped (tree)', 'L24-tree-burns', { drop: true }],
        ['the skin dropped (magical lock)', 'L43-wand-lock', { drop: true }],
        ['the skin dropped (locks)', 'L71-lock-opens', { drop: true }],
        ['the skin dropped (boss locks)', 'L31-bosslock-opens', { drop: true }],
        ['Chest — chestTimer: never fades', 'L38-chest-covers', { rules: { chestTimer: (p, open) => (open ? CHEST_HOLD : null) } }],
        ['BreakableRock — spriteAfter: frozen on frame 0', 'L3-rock-breaks', { rules: { spriteAfter: () => ({ frame: 0 }) } }],
        ['BurnableTree — spriteAfter: frozen on frame 0', 'L24-tree-burns', { rules: { spriteAfter: () => ({ frame: 0 }) } }],
        ['MagicalLock — spriteAfter: frozen on frame 3', 'L43-wand-lock', { rules: { spriteAfter: () => ({ frame: 3 }) } }],
        // (L71's tape predates the game clock — `gameTime` null, so its locks sit on worldFrame(0); L38 has the clock)
        ['Lock family (Cover) — worldFrame: frame 0 always', 'L38-chest-covers', { rules: { worldFrame: () => 0 } }],
        ['Button — buttonFrame: no one-update lag', 'L71-lock-opens', { rules: { buttonFrame: (before, b) => b.down } }],
        ['ButtonRoom — buttonFrame: never down', 'L20-buttonroom-boots-down', { rules: { buttonFrame: () => false } }],
        // ⛓ G9c — the responders' fade (`stepResponder`): opaque until the run opens it (G8's default state) turns each red
        ...[['Lock', 'L71-lock-opens'], ['Cover', 'L38-chest-covers'], ['BossLock', 'L31-bosslock-opens']].map(([cls, tape]) => [
            `${cls} — stepResponder: no fade (G8's open/shut)`, tape,
            { rules: { stepResponder: (prev, a) => ({ state: { alpha: a.open ? 0 : 1, solid: !a.open, active: false, keyTimer: 60, scale: 1 }, drift: false }) } }]),
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});
const CHEST_HOLD = 59;

describe('5. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('solidsSkinView wrote to the run'); }, defineProperty: () => { throw new Error('solidsSkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({
            level: 9, ticksCompleted: 50, gameTime: 400, transitions: [], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({
                objectSolids: [frozen({ tag: 'breakablerock', x: 0, y: 0, rockId: 'breakablerock@0,0', rockType: 0 }),
                    frozen({ tag: 'breakablerockghost', x: 16, y: 0, rockId: 'breakablerockghost@16,0', rockType: 1 }),
                    frozen({ tag: 'rocklock', x: 32, y: 0 })],
                chests: [frozen({ id: 'chest@48,0', x: 48, y: 0 })],
                burnableTrees: [frozen({ id: 'burnabletree@64,0', x: 64, y: 0 })],
                magicalLocks: [frozen({ id: 'magicallock@96,0', x: 96, y: 0, lockType: 0 })],
                activators: [frozen({ id: 'lock@112,0', tag: 'lock', x: 112, y: 0 }), frozen({ id: 'bosslock@128,0', tag: 'bosslock', x: 128, y: 0, keyType: 2 })],
                pressers: [frozen({ tag: 'buttonroom', x: 144, y: 0, bootPressed: false })],
            }),
            openChests: new Set(['chest@48,0']), brokenRocks: new Set(['breakablerock@0,0']), burnedTrees: new Set(),
            openActivators: new Set(['lock@112,0']),
            rocksBroken: [frozen({ level: 9, id: 'breakablerock@0,0', hitTick: 44, goneAt: 51 })],
            treeBurns: [frozen({ level: 9, id: 'burnabletree@64,0', t: 20, goneAt: 61 })],
            magicalLocksOpened: [frozen({ level: 9, id: 'magicallock@96,0', hitTick: 40, openTick: 55 })],
            activatorsNow: frozen({ responders: [], pressers: [frozen({ id: 'buttonroom@144,0', tag: 'buttonroom', down: true })] }),
        });
        const v = solidsSkinView(run, { record: { entities: [{ type: 'wire', x: 144, y: 16 }] } });
        expect(v.epoch).toEqual({ run, key: '9|0|0' });
        expect(v.chests).toEqual([{ id: 'chest@48,0', x: 48, y: 0, open: true }]);
        // broken by the run's collision read, but its picture runs to goneAt: k = 7 − (51 + 1 − 50)
        expect(v.rocks).toEqual([{ id: 'breakablerock@0,0', x: 0, y: 0, ghost: false, k: 5, gone: false },
            { id: 'breakablerockghost@16,0', x: 16, y: 0, ghost: true, k: null, gone: false }]);
        expect(v.trees).toEqual([{ id: 'burnabletree@64,0', x: 64, y: 0, k: 41 - (61 + 1 - 50), gone: false }]);
        expect(v.magicalLocks).toEqual([{ id: 'magicallock@96,0', x: 96, y: 0, fire: false, k: 15 - (54 + 1 - 50), gone: false }]);
        expect(v.responders).toEqual([{ id: 'lock@112,0', tag: 'lock', x: 112, y: 0, keyType: null, open: true },
            { id: 'bosslock@128,0', tag: 'bosslock', x: 128, y: 0, keyType: 2, open: false }]);
        expect(v.rockLocks).toEqual([{ x: 32, y: 0 }]);
        expect(v.buttons).toEqual([{ id: 'buttonroom@144,0', tag: 'buttonroom', x: 144, y: 0, boot: false, down: true, wire: true }]);
        expect(solidsSkinView(null)).toBe(null);
    });
});

describe('6. ⛔ STATE IDENTITY — the solids renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = solidsSkinView(run, { record: recordOf(run.level) });
                skin = stepSolidsSkin(skin, view, tick);
                drawn += solidsOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

describe('7. the room\'s own ops: only the replaced rectangles leave', () => {
    const roomOf = (level) => buildLevelWorld(levelSourceFromAtlas(MAP)(level));
    for (const level of [3, 12, 38, 71]) {
        it(`L${level}: with the predicate, exactly the solids' rectangles go`, () => {
            const world = roomOf(level);
            const base = roomOps(world, art, { level }).map(formatOp);
            const withP = roomOps(world, art, { level, drawnObjects: (o) => SOLIDS_OBJECT_TAGS.has(o.tag) }).map(formatOp);
            const gone = [...world.objectSolids, ...world.pixelmasks].filter((o) => SOLIDS_OBJECT_TAGS.has(o.tag)).length;
            expect(gone).toBeGreaterThan(0);
            expect(base.length - withP.length).toBe(gone);
            const kept = new Set(withP);
            expect(base.filter((l) => !kept.has(l)).every((l) => l.startsWith('fillRect('))).toBe(true);
        });
    }
});
