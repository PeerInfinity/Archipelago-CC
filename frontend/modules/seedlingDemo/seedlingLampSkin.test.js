/**
 * seedlingLampSkin — G8's lamp-body proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL RUNS: L8's torches (`f4-l8-sandtraps`), L38's orbs
 *      (`prox-l38-chest`), and G5's own stands at L63 (three unlit poles) and
 *      L74 (a lit pole). Each tick's ops are a golden line. ⚠ CHANGE DETECTORS:
 *      `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. BY HAND: the torch's frame and layer, the orb's float = its light's
 *      (`orbFloat`, one spelling) and tint, the pole's bob = its light's
 *      (`poleAt`) and its nightBmp copy only while `activate` and not hit.
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
import { TRAP_COVERAGE } from './seedlingTrapSkin.js';
import { KEYS, LAMP_COVERAGE, LAMP_RULES, lampOps, lampSkinView } from './seedlingLampSkin.js';
import { orbFloat, poleAt } from './seedlingNightSkin.js';

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

/** THE TAPES: `fixture` a committed tape; `witness` a fidelity witness's embedded tape; otherwise `level`/`at`/`n` stand the JS runtime still. */
export const TAPES = Object.freeze([
    { name: 'L8-torches', fixture: 'f4-l8-sandtraps', want: ['torch'] },
    { name: 'L38-orbs', fixture: 'prox-l38-chest', want: ['orb', 'orb:tint'] },
    { name: 'L63-poles-dark', level: 63, at: [72, 120], n: 120, want: ['pole', 'orb'] },
    // L74's pole is INVERTED: lit while `activate` is false, so its body is never copied onto nightBmp
    { name: 'L74-pole-lit', level: 74, at: [40, 40], n: 120, want: ['pole'] },
    // the fidelity witness that strikes L63's uninverted pole lit: `activate`, so its body is copied (outside its hit timer)
    { name: 'L63-pole-struck', witness: 'darktrap2-l63-step145-light', want: ['pole', 'pole:night'] },
]);
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

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
        const view = lampSkinView(run, { record: recordOf(run.level) });
        rows.push({ tick, view, skin, ops: opts.drop ? [] : lampOps(view, art, opts) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const _ of r.view.torches) out.push('torch');
    for (const o of r.view.orbs) out.push('orb', ...(o.tint ? ['orb:tint'] : []));
    for (const p of r.view.poles) out.push('pole', ...(p.night ? ['pole:night'] : []));
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

describe('1. golden lamp ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} run: every tick's torches, orbs and poles`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`lamp-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G8\'s lamp classes are new, every key reached the pack', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn]);
        for (const c of LAMP_COVERAGE.drawn) expect(before.has(c), `${c} is G8's`).toBe(false);
    });
});

describe('2. by hand from the AS3', () => {
    const V = (over = {}) => ({ level: 9, gameTime: 900, torches: [], orbs: [], poles: [], ...over });

    it('a torch: Game.worldFrame(3) at the render, centred, layer -(y − 5 + 10 + 8)', () => {
        for (const time of [0, 14, 15, 30, 44]) {
            const [op] = lampOps(V({ gameTime: time, torches: [{ x: 40, y: 72 }] }), art);
            expect([op.frame, op.dx, op.dy, op.layer]).toEqual([worldFrame(time, 3), 38, 67, -(72 + 13)]);
        }
    });

    it('an orb: where its light is (`orbFloat`), tinted, frame worldFrame(5, 4), layer from its START (-(sy + 16))', () => {
        for (const time of [0, 50, 100, 177]) {
            const o = { sx: 100, sy: 60, tint: '#ff8800' };
            const [op] = lampOps(V({ gameTime: time, orbs: [o] }), art);
            const at = orbFloat(o, time, 9);
            expect([op.dx, op.dy, op.frame, op.tint, op.layer]).toEqual([at.x - 4, at.y - 4, worldFrame(time, 5, 4), '#ff8800', -76]);
        }
    });

    it('a light pole: its bob is its light\'s (`poleAt`); drawn again onto nightBmp only while `activate` and not hit', () => {
        const p = (night) => ({ id: 'p', x: 40, startY: 40, night });
        for (const time of [0, 11, 22, 33]) {
            const [op] = lampOps(V({ gameTime: time, poles: [p(false)] }), art);
            expect([op.dx, op.dy, op.layer, op.nightCopy]).toEqual([32, poleAt(p(false), time).y - 8, -48, undefined]);
        }
        expect(lampOps(V({ poles: [p(true)] }), art)[0].nightCopy).toBe(true);
        expect(NIGHT_COPIES['seedling:scenery/lightpole'].when({ nightCopy: true })).toBe(true);
        expect(NIGHT_COPIES['seedling:scenery/lightpole'].when({})).toBe(false);
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `lamp-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['the skin dropped (torches)', 'L8-torches', { drop: true }],
        ['the skin dropped (orbs)', 'L38-orbs', { drop: true }],
        ['the skin dropped (poles)', 'L74-pole-lit', { drop: true }],
        ['Torch — worldFrame: frame 0 always', 'L8-torches', { rules: { worldFrame: () => 0 } }],
        ['Orb — orbFloat: no float', 'L38-orbs', { rules: { orbFloat: (o) => ({ x: o.sx, y: o.sy }) } }],
        ['LightPole — poleAt: no bob', 'L74-pole-lit', { rules: { poleAt: (q) => ({ ...q, y: q.startY - 8 }) } }],
        ['the skin dropped (a struck pole)', 'L63-pole-struck', { drop: true }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('lampSkinView wrote to the run'); }, defineProperty: () => { throw new Error('lampSkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({ level: 74, gameTime: 5, state: frozen({ x: 0, y: 0 }),
            lightPolesNow: [frozen({ id: 'lightpole@32,32', lit: true, hitsTimer: 0 }), frozen({ id: 'lightpole@64,32', lit: false, hitsTimer: 0 }),
                frozen({ id: 'lightpole@96,32', lit: true, hitsTimer: 4 })] });
        const record = { entities: [{ type: 'torch', x: 0, y: 16 }, { type: 'orb', x: 8, y: 8, attrs: { c: '16711680' } },
            { type: 'lightpole', x: 32, y: 32 }, { type: 'lightpole', x: 64, y: 32, attrs: { invert: '1' } }, { type: 'lightpole', x: 96, y: 32 }] };
        const v = lampSkinView(run, { record });
        expect(v.torches).toEqual([{ x: 8, y: 24 }]);
        expect(v.orbs).toEqual([{ sx: 8, sy: 8, tint: '#ff0000' }]);
        // lit = activate XOR invert: the inverted unlit pole IS active; a pole inside its hit timer is not copied
        expect(v.poles.map((p) => p.night)).toEqual([true, true, false]);
        expect(lampSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the lamp renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            const on = drive(tape, (tick, run) => { drawn += lampOps(lampSkinView(run, { record: recordOf(run.level) }), art).length; });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});
