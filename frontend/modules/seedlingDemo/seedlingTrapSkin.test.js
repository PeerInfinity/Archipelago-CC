/**
 * seedlingTrapSkin — G8's trap proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL TAPES through the model: L8's arrow traps (`f4-l8-sandtraps`), L29's
 *      rock dropped by its button (the `fallRockButton` walk), L32's large rock
 *      (`enc-l32-fallen-door`), L63's dark trap killed by a light (the fidelity
 *      witness `darktrap2-l63-step145-light`), and stands through the JS runtime
 *      at L45's ice trap (it chomps) and L77's lava trap. Each tick's ops are a
 *      golden line. ⚠ CHANGE DETECTORS: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM, by hand: the arrow trap's frame and anchor, the
 *      ice trap's 8 px chomp and its return to the world frame, the dark trap's
 *      "die1" frames, the lava trap's anchor, a rock parked and landed.
 *   3. ONE MUTANT PER FAMILY. 4. THE ADAPTER writes nothing.
 *   5. ⛔ STATE IDENTITY with the renderer on and off, `stateDigest` included.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { runTape as runFixtureTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { formatOp } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { worldFrame } from './seedlingEnemySkin.js';
import { ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import { SOLIDS_COVERAGE } from './seedlingSolidsSkin.js';
import { NPC_COVERAGE } from './seedlingNpcSkin.js';
import { NIGHT_COPIES } from './seedlingNightSkin.js';
import { createLevelRun } from './levelRun.js';
import { KEYS, TRAP_COVERAGE, TRAP_RULES, stepTrapSkin, trapOps, trapSkinView } from './seedlingTrapSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/**
 * THE TAPES. `fixture` a committed tape; `witness` a fidelity witness's embedded
 * tape; `drive` a `createLevelRun` with held-key spans; otherwise `level`/`at`/`n`
 * stand the JS runtime still. `want` is what the tape must really reach.
 */
export const TAPES = Object.freeze([
    { name: 'L8-arrow-traps', fixture: 'f4-l8-sandtraps', want: ['a:arrowtrap'] },
    // `fallRockButton.test.js`'s walk: north over L29's button, which drops `fallrock@112,112` into the corridor
    { name: 'L29-rock-falls', drive: { boot: { level: 29, x: 112, y: 144 }, n: 60, spans: [{ key: 'up', from: 0, to: 59 }] },
        want: ['r:fallrock', 'r:parked', 'r:landed'] },
    { name: 'L32-large-rock', fixture: 'enc-l32-fallen-door', want: ['r:fallrocklarge'] },
    { name: 'L63-dark-trap-light', witness: 'darktrap2-l63-step145-light', want: ['d:idle', 'd:dying'] },
    // `Game(level, x, y)` puts the player at the cell's centre: 6 px below L45's ice trap (centre (72, 72))
    { name: 'L45-ice-trap-chomps', level: 45, at: [64, 70], n: 40, want: ['i:idle', 'i:chomp'] },
    { name: 'L77-lava-trap', level: 77, at: [96, 224], n: 20, want: ['l:lavatrap'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

const LEDGERS = ['transitions', 'playerHits', 'playerDeaths', 'earnedClears'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v instanceof Set ? [...v] : v;
}) : null);

/** Drive a tape; `each(tick, run)` after every tick. Returns what the state identity compares. */
function drive(tape, each = () => {}) {
    if (tape.drive) {
        const d = tape.drive;
        const run = createLevelRun({ levelSource: atlasLevelSource(), boot: d.boot, noDamage: true });
        const stream = [];
        for (let t = 0; t < d.n; t += 1) {
            const r = run.advance(new Set(d.spans.filter((sp) => t >= sp.from && t <= sp.to).map((sp) => sp.key)));
            stream.push(JSON.stringify([t, run.level, run.state, r.transition ?? null]));
            each(t, run);
        }
        return { stream, end: JSON.stringify([ledgersOf(run), run.rockFalls]), stateLog: '', digest: JSON.stringify(run.stateDigest()) };
    }
    if (tape.fixture || tape.witness) {
        let last = null;
        const stream = [];
        const src = tape.witness
            ? JSON.parse(readFileSync(join(HERE, 'fixtures/darktrap-witness', `${tape.witness}.json`), 'utf8')).tape
            : { ...fixture(tape.fixture), ...(tape.with ?? {}) };
        const out = runFixtureTape(src, {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
        });
        return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last)]), stateLog: '',
            digest: last?.stateDigest ? JSON.stringify(last.stateDigest()) : null };
    }
    const reports = [];
    const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
    const stream = [];
    for (let i = 0; i < tape.n; i += 1) {
        rt.tick(new Set());
        stream.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
        each(rt.ticks, rt.run);
    }
    return { stream, end: JSON.stringify(ledgersOf(rt.run)), stateLog: JSON.stringify(reports),
        digest: rt.run?.stateDigest ? JSON.stringify(rt.run.stateDigest()) : null };
}

/** Run a tape with the renderer; per tick: the view, the skin and the ops. */
function runTape(tape, opts = {}) {
    const rows = [];
    let skin = null;
    drive(tape, (tick, run) => {
        const view = trapSkinView(run);
        skin = stepTrapSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : trapOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    const v = r.view;
    for (const _ of v.arrowTraps) out.push('a:arrowtrap');
    for (const t of v.iceTraps) out.push(r.skin.bodies.get(t.id)?.anim === 'chomp' ? 'i:chomp' : 'i:idle');
    for (const t of v.darkTraps) out.push(t.dieIndex !== null ? 'd:dying' : (t.startDying ? 'd:lit' : 'd:idle'));
    for (const _ of v.lavaTraps) out.push('l:lavatrap');
    for (const f of v.fallRocks) out.push(`r:${f.tag}`, f.landed ? 'r:landed' : 'r:parked');
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

describe('1. golden trap ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's traps and rocks`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`trap-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G8\'s trap classes are new, every key reached the pack', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn]);
        for (const c of TRAP_COVERAGE.drawn) expect(before.has(c), `${c} is G8's`).toBe(false);
    });
});

describe('2. by hand from the AS3', () => {
    const RUN = {};
    const V = (over = {}) => ({ epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900, player: { x: 0, y: 0 },
        arrowTraps: [], iceTraps: [], darkTraps: [], lavaTraps: [], fallRocks: [], ...over });

    it('an arrow trap: Game.worldFrame(2) at the render, centred at (x + 8, y + 2.5), layer -y', () => {
        for (const time of [0, 22, 23, 44, 45]) {
            const v = V({ gameTime: time, arrowTraps: [{ id: 'a', x: 104, y: 34.5 }] });
            const [op] = trapOps(v, art, { skin: stepTrapSkin(null, v, 1) });
            // ⛓ G10 (F4): 5 px high → int origin 2, so the picture sits half a pixel lower than G8 drew it
            expect([op.frame, op.dx, op.dy, op.layer]).toEqual([worldFrame(time, 2), 96, 32.5, -34.5]);
        }
    });

    it('an ice trap: "chomp" [0,1,2,1] within int(distance) ≤ 8 (the previous tick\'s player), then the world frame again', () => {
        const t = { id: 'i', x: 72, y: 72 };
        const at = (p, time) => V({ gameTime: time, player: p, iceTraps: [t] });
        let s = stepTrapSkin(null, at({ x: 72, y: 200 }, 100), 1);
        s = stepTrapSkin(s, at({ x: 72, y: 80.9 }, 101), 2);   // it sees the previous tick's player: still far
        expect(s.bodies.get('i').anim).toBe('');
        s = stepTrapSkin(s, at({ x: 72, y: 80.9 }, 102), 3);   // 8.9 → int 8: in range
        expect([s.bodies.get('i').anim, s.bodies.get('i').frame]).toEqual(['chomp', 0]);
        let far = stepTrapSkin(null, at({ x: 72, y: 81 }, 100), 1);
        far = stepTrapSkin(far, at({ x: 72, y: 81 }, 101), 2);
        expect([far.bodies.get('i').anim, far.bodies.get('i').frame]).toEqual(['', worldFrame(100, 2)]);
        const [op] = trapOps(at({ x: 0, y: 0 }, 0), art, { skin: far });
        expect([op.dx, op.dy, op.layer]).toEqual([64, 64, -(72 - 8 + 12.8)]);
    });

    it('a dark trap: "die1" at the run\'s dieIndex; frozen while it waits to die', () => {
        const d = (over) => ({ id: 'd', x: 120, y: 216, startDying: false, dieIndex: null, removed: false, ...over });
        const die1 = [4, 0, 1, 0, 4, 5, 4, 5, 6, 7, 8, 9, 10, 11];
        const skin = stepTrapSkin(null, V({ darkTraps: [d({})] }), 1);
        expect(die1.map((f, i) => trapOps(V({ darkTraps: [d({ startDying: true, dieIndex: i })] }), art, { skin })[0].frame)).toEqual(die1);
        // "die1" is the one state drawn again onto nightBmp (`NIGHT_COPIES['seedling:enemy/darktrap']`)
        expect(trapOps(V({ darkTraps: [d({ startDying: true, dieIndex: 2 })] }), art, { skin })[0].dying).toBe(true);
        expect(trapOps(V({ darkTraps: [d({})] }), art, { skin })[0].dying).toBe(undefined);
        expect(NIGHT_COPIES['seedling:enemy/darktrap'].when({ dying: true })).toBe(true);
        const lit = stepTrapSkin(skin, V({ player: { x: 120, y: 216 }, darkTraps: [d({ startDying: true })] }), 2);
        expect(lit.bodies.get('d')).toEqual(skin.bodies.get('d'));
    });

    it('a lava trap at its centre, frame 0, layer -(y − 5 + 8); a rock parked above the room, then on its cell', () => {
        const v = V({ lavaTraps: [{ id: 'l', x: 104, y: 200 }],
            fallRocks: [{ id: 'f', tag: 'fallrock', x: 120, fallTo: 120, y: -16, landed: false },
                { id: 'g', tag: 'fallrocklarge', x: 80, fallTo: 144, y: 144, landed: true }] });
        const ops = trapOps(v, art, { skin: stepTrapSkin(null, v, 1) });
        expect(ops.map((o) => [o.key.split('/')[1], o.frame, o.dx, o.dy, o.layer])).toEqual([
            ['lavatrap', 0, 96, 192, -203], ['fallrock', 0, 112, -24, -128], ['fallrocklarge', 0, 64, 128, -160]]);
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `trap-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['the skin dropped (arrow traps)', 'L8-arrow-traps', { drop: true }],
        ['the skin dropped (a falling rock)', 'L29-rock-falls', { drop: true }],
        ['the skin dropped (the large rock)', 'L32-large-rock', { drop: true }],
        ['the skin dropped (a dark trap)', 'L63-dark-trap-light', { drop: true }],
        ['the skin dropped (an ice trap)', 'L45-ice-trap-chomps', { drop: true }],
        ['the skin dropped (a lava trap)', 'L77-lava-trap', { drop: true }],
        ['ArrowTrap — worldFrame: frame 0 always', 'L8-arrow-traps', { rules: { worldFrame: () => 0 } }],
        ['IceTrap — chompUpdate: never chomps', 'L45-ice-trap-chomps', { rules: { chompUpdate: (sp, t, ctx) => { if (sp.anim === '') sp.frame = worldFrame(ctx.time, 2); } } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('trapSkinView wrote to the run'); }, defineProperty: () => { throw new Error('trapSkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({
            level: 29, gameTime: 50, transitions: [frozen({ t: 10, from_level: 28, to_level: 29 })], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({
                arrowTraps: [frozen({ id: 'arrowtrap@96,32', x: 96, y: 32 })],
                pressEnemies: [frozen({ tag: 'icetrap', as3: 'IceTrap', x: 0, y: 0 }), frozen({ tag: 'darktrap', as3: 'DarkTrap', x: 16, y: 0 }),
                    frozen({ tag: 'lavatrap', as3: 'LavaTrap', x: 32, y: 0 }), frozen({ tag: 'bob', as3: 'Bob', x: 48, y: 0 })],
                fallRocks: [frozen({ id: 'fallrock@112,112', tag: 'fallrock', x: 112, y: 112 }), frozen({ id: 'fallrock@0,64', tag: 'fallrock', x: 0, y: 64 })],
            }),
            // a fall in an EARLIER visit (t 5 < this visit's 10) is not this one's
            rockFalls: [frozen({ id: 'fallrock@112,112', level: 29, t: 30 }), frozen({ id: 'fallrock@0,64', level: 29, t: 5 })],
            darkTraps: [frozen({ id: 'darktrap@16,0', startDying: true, dieIndex: 3, removed: false })],
        });
        const v = trapSkinView(run);
        expect(v.epoch).toEqual({ run, key: '29|1|0' });
        expect(v.arrowTraps).toEqual([{ id: 'arrowtrap@96,32', x: 104, y: 34.5 }]);
        expect(v.iceTraps).toEqual([{ id: 'icetrap@0,0', x: 8, y: 8 }]);
        expect(v.darkTraps).toEqual([{ id: 'darktrap@16,0', x: 24, y: 8, startDying: true, dieIndex: 3, removed: false }]);
        expect(v.lavaTraps).toEqual([{ id: 'lavatrap@32,0', x: 40, y: 8 }]);
        expect(v.fallRocks).toEqual([{ id: 'fallrock@112,112', tag: 'fallrock', x: 120, fallTo: 120, y: 120, landed: true },
            { id: 'fallrock@0,64', tag: 'fallrock', x: 8, fallTo: 72, y: -16, landed: false }]);
        expect(trapSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the trap renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = trapSkinView(run);
                skin = stepTrapSkin(skin, view, tick);
                drawn += trapOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});
