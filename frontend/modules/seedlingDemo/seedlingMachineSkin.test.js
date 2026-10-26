/**
 * seedlingMachineSkin — G9b's machine proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL RUNS: a committed tape per machine and per live state — a beam tower
 *      firing (and one whose clock the run lost: its stand-in), a pulser's ring,
 *      a wire lit from its ButtonRoom, the whirlpool, the Pull's circle, the
 *      moonrock beaming and landing, the pile, the final door opening, the Owl's
 *      pods through all four anims. ⚠ CHANGE DETECTORS:
 *      `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. BY HAND from the AS3. 2b. The night layer takes the copies, rings, beams
 *      and the Pull's circle. 3. ONE MUTANT PER FAMILY. 4. THE ADAPTER writes
 *      nothing. 5. ⛔ STATE IDENTITY with the renderer on and off.
 *   6. ⛓ `machinesNow` (⚖ fidelity-14): a read on a room whose pulser / tower state
 *      was never built stores nothing (the DIGESTREAD shape), and it copies scalars.
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
import { createLevelRun } from './levelRun.js';
import { formatOp } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { worldFrame, ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import { SOLIDS_COVERAGE } from './seedlingSolidsSkin.js';
import { NPC_COVERAGE } from './seedlingNpcSkin.js';
import { TRAP_COVERAGE } from './seedlingTrapSkin.js';
import { LAMP_COVERAGE } from './seedlingLampSkin.js';
import { NIGHT_COPIES, nightOps, nightSkinView } from './seedlingNightSkin.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { PICKUP_COVERAGE } from './seedlingPickupSkin.js';
import {
    KEYS, MACHINE_COVERAGE, MACHINE_RULES, animIndex, beamLine, machineNightOps, machineOps, machineSkinView, stepMachineSkin, wireMask,
} from './seedlingMachineSkin.js';

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

/** THE TAPES: `fixture` a committed tape; otherwise `level`/`at`/`n` stand the JS runtime still. */
export const TAPES = Object.freeze([
    { name: 'L104-beam', fixture: 'ladder2-l104-beam', want: ['beam', 'beam:firing'] },
    { name: 'L107-beam-unknown', fixture: 'ghostmotion-l102-axis', want: ['beam:unknown', 'pulser'] },
    { name: 'L38-ring-wire', fixture: 'prox-l38-chest', want: ['pulser', 'pulser:ring', 'wire', 'wire:on'] },
    { name: 'L40-wire', fixture: 'r5-l40-part0', want: ['wire', 'wire:on', 'pulser'] },
    { name: 'L46-whirlpool', fixture: 'stance-l46-chest', want: ['whirl'] },
    { name: 'L12-pull', fixture: 'u12-pull-cross', want: ['pull', 'pull:circle', 'stones'] },
    { name: 'L0-moonrock', fixture: 'u14-moonrock-beam', want: ['rock:parked', 'rock:beam', 'rock:set'] },
    { name: 'L2-pile', fixture: 'f6-l2-reentry', want: ['pile'] },
    { name: 'L113-door', fixture: 'r6-final-door', want: ['door', 'door:open'] },
    { name: 'L112-pods', fixture: 'r6-owl-control', want: ['pod:open', 'pod:opened', 'pod:close', 'pod:closed'] },
]);
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

const LEDGERS = ['transitions', 'playerHits', 'playerDeaths', 'earnedClears', 'collected', 'wandFades'];
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
        const view = machineSkinView(run, { record: recordOf(run.level) });
        skin = stepMachineSkin(skin, view, tick);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : machineOps(view, art, { skin, ...opts }),
            night: opts.drop ? [] : machineNightOps(view, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const v = r.view;
    const out = [];
    for (const b of v.beamTowers) {
        out.push(b.animKnown && b.yKnown ? 'beam' : 'beam:unknown');
        if (b.animKnown && b.anim !== 'sit' && (b.frame - 1) % 2 === 1) out.push('beam:firing');
    }
    for (const p of v.pulsers) out.push('pulser', ...(p.radius > 10 ? ['pulser:ring'] : []));
    for (const w of v.wires) out.push(r.skin?.lit.has(w.id) ? 'wire:on' : 'wire');
    if (v.whirlpools.length) out.push('whirl');
    for (const p of v.pulls) out.push('pull', ...(r.skin?.pulls.get(p.id)?.count ? ['pull:circle'] : []));
    for (const p of v.pods) out.push(`pod:${p.anim ?? 'own'}`);
    if (v.stones.length) out.push('stones');
    if (v.piles.length) out.push('pile');
    for (const k of v.rocks) out.push(k.beaming ? 'rock:beam' : (k.y < 0 ? 'rock:parked' : 'rock:set'));
    for (const d of v.doors) out.push(d.opening ? 'door:open' : 'door');
    return out;
}
const n3 = (x) => +(+x).toFixed(3);
const fmt = (o) => {
    if (o.line) return `line(${n3(o.line.x1)},${n3(o.line.y1)}→${n3(o.line.x2)},${n3(o.line.y2)} ${o.colour} a=${n3(o.alpha)} w=${n3(o.line.thick)})`;
    if (o.circle) return `circle(${n3(o.circle.x)},${n3(o.circle.y)},${n3(o.circle.r)}${o.circle.thick !== undefined ? ` w=${n3(o.circle.thick)}` : ''} ${o.colour} a=${n3(o.alpha)})`;
    return `${formatPlayerOp(o, formatOp)}${o.nightCopy ? ' night' : ''}${o.nightExtra ? ` +${o.nightExtra.length}` : ''}`;
};
function goldenLines(rows) {
    const lines = [];
    let open = null;
    for (const r of rows) {
        const body = `L${r.view.level} [${[...new Set(tagsOf(r))].join(',')}] | ${r.ops.map(fmt).join(' ; ')}${r.night.length ? ` || ${r.night.map(fmt).join(' ; ')}` : ''}`.trimEnd();
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

describe('1. golden machine ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} run: every tick's machines`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`machine-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            expect(rows.flatMap((r) => r.ops).length, `${tape.name}: it drew`).toBeGreaterThan(0);
        }, 240_000);
    }

    it('the coverage table: G9b\'s machine classes are new, every key reached the pack', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn, ...LAMP_COVERAGE.drawn, ...PICKUP_COVERAGE.drawn]);
        for (const c of MACHINE_COVERAGE.drawn) expect(before.has(c), `${c} is G9b's`).toBe(false);
    });

    it('a beam tower whose clock the run lost is its stand-in (⚖ fidelity-14: never a guessed frame)', () => {
        const rows = rowsOf(TAPES.find((t) => t.name === 'L107-beam-unknown'));
        const lost = rows.filter((r) => r.view.beamTowers.some((b) => !b.animKnown || !b.yKnown));
        expect(lost.length).toBeGreaterThan(0);
        for (const r of lost) expect(r.ops.filter((o) => o.key === KEYS.beamTower)).toHaveLength(r.view.beamTowers.filter((b) => b.animKnown && b.yKnown).length);
    });
});

describe('2. by hand from the AS3', () => {
    const V = (over = {}) => ({ epoch: { run: 1, key: 'k' }, level: 9, gameTime: 900, size: { width: 160, height: 160 }, player: { x: 0, y: 0 },
        beamTowers: [], pulsers: [], wires: [], rooms: [], whirlpools: [], pulls: [], pods: [], stones: [], piles: [], rocks: [], doors: [], ...over });

    it('Wire.check(): the 4-neighbour mask (+1 right, +2 up, +4 left, +8 down), the level\'s edge counting', () => {
        const mk = (x, y) => ({ x, y, box: { x, y, right: x + 16, bottom: y + 16 } });
        const a = mk(32, 32);
        const b = mk(48, 32);
        const c = mk(32, 48);
        const boxes = [a.box, b.box, c.box];
        expect(wireMask({ ...a, box: a.box }, boxes, { width: 160, height: 160 })).toBe(1 + 8);
        expect(wireMask({ ...b, box: b.box }, boxes, { width: 160, height: 160 })).toBe(4);
        expect(wireMask({ ...mk(144, 0), box: null }, [], { width: 160, height: 160 })).toBe(1 + 2);
    });

    it('a wire LATCHES on from a pressed ButtonRoom through the chain and never goes off this visit', () => {
        const wires = [{ id: 'w1', x: 16, y: 0, img: 0 }, { id: 'w2', x: 32, y: 0, img: 0 }, { id: 'w3', x: 64, y: 0, img: 0 }];
        let s = stepMachineSkin(null, V({ wires, rooms: [{ id: 'r', x: 0, y: 0, down: false }] }), 1);
        expect([...s.lit]).toEqual([]);
        s = stepMachineSkin(s, V({ wires, rooms: [{ id: 'r', x: 0, y: 0, down: true }] }), 2);
        expect([...s.lit].sort()).toEqual(['w1', 'w2']);
        s = stepMachineSkin(s, V({ wires, rooms: [{ id: 'r', x: 0, y: 0, down: false }] }), 3);
        expect([...s.lit].sort()).toEqual(['w1', 'w2']);
        const ops = machineOps(V({ wires }), art, { skin: s });
        expect(ops.map((o) => [o.tint, !!o.nightCopy])).toEqual([['#ffff00', true], ['#ffff00', true], ['#404040', false]]);
    });

    it('BeamTower render(): alpha 0 on "sit", 0.1 on a side\'s first frame, 1 on the firing one; n lines to the edge, red outside', () => {
        const t = (over) => ({ id: 't', cx: 24, y: 72, direction: 0, anim: 'right', index: 1, frame: 2, animKnown: true, yKnown: true, ...over });
        const lines = (o) => machineOps(V({ beamTowers: [t(o)] }), art).filter((x) => x.line);
        expect(lines({ anim: 'sit', frame: 0 })).toEqual([]);
        expect(lines({ frame: 1 }).map((l) => l.alpha)).toEqual([0.1, 0.1, 0.1, 0.1, 0.1]);
        const fire = lines({});
        expect(fire.map((l) => l.colour)).toEqual(['#ff0000', '#ffff00', '#ffff00', '#ffff00', '#ff0000']);
        expect(fire[0].line).toEqual({ x1: 30, y1: 53, x2: 160, y2: 53, thick: 1 });
        expect(beamLine(t({ direction: 1 }), 0, { width: 160, height: 160 })).toEqual([{ x: 22, y: 53 }, { x: 22, y: 0 }]);
        // up: the beam is drawn BEFORE the body; every other side after it
        const up = machineOps(V({ beamTowers: [t({ direction: 1, anim: 'up', frame: 4 })] }), art);
        expect(up.findIndex((o) => o.key)).toBe(4);
        expect(machineOps(V({ beamTowers: [t({})] }), art).findIndex((o) => o.key)).toBe(0);
    });

    it('Pulser render(): while radius > 10 a ring of rVal = 1 − r/28, (8 − 1)·rVal + 1 thick; the light copy 2 thicker; frame of "pulse" at 20 fps', () => {
        const p = { id: 'p', x: 88, y: 232, t: 1, activate: true, radius: 17.2, pulseTimer: -1, anim: '', animTick: 0 };
        const ops = machineOps(V({ pulsers: [p] }), art);
        const rVal = 1 - 17.2 / 28;
        expect(ops[0].circle).toEqual({ x: 88, y: 232, r: 17.2, thick: 7 * rVal + 1 });
        expect(ops[0].alpha).toBeCloseTo(rVal, 12);
        expect(ops[1].nightExtra[0].circle.thick).toBeCloseTo(7 * rVal + 3, 12);
        expect(ops[1].nightCopy).toBe(true);
        expect(machineOps(V({ pulsers: [{ ...p, radius: 10 }] }), art)).toHaveLength(1);
        for (let k = 0; k < 15; k += 1) expect(MACHINE_RULES.pulseFrame({ anim: 'pulse', animTick: k })).toBe([0, 1, 2, 3, 4][animIndex(20, k, 5, true)]);
    });

    it('Pull update(): radius += 0.5 per colliding body, 0 with none, else wrapped at √512/2; the circle at count/3, nightBmp only', () => {
        const pulls = [{ id: 'q', x: 0, y: 0 }];
        let s = null;
        const rs = [];
        for (let t = 0; t < 30; t += 1) {
            s = stepMachineSkin(s, V({ pulls, player: { x: 8, y: 10 } }), t);
            rs.push(s.pulls.get('q').radius);
        }
        let r = 0;
        for (let t = 0; t < 30; t += 1) { r = (r + 0.5) % (Math.sqrt(512) / 2); expect(rs[t]).toBe(r); }
        const [c] = machineNightOps(V({ pulls, player: { x: 8, y: 10 } }), { skin: s });
        expect([c.circle.x, c.circle.y, c.colour, c.alpha]).toEqual([8, 8, '#ff0000', 1 / 3]);
        expect(machineOps(V({ pulls }), art, { skin: s })).toEqual([]);
        s = stepMachineSkin(s, V({ pulls, player: { x: 100, y: 100 } }), 31);
        expect(s.pulls.get('q').radius).toBe(0);
        expect(machineNightOps(V({ pulls, player: { x: 100, y: 100 } }), { skin: s })).toEqual([]);
    });

    it('Whirlpool: alpha 0.5, whirlFrames[worldFrame(16)], 20° more each render from a cosmetic start (counter-clockwise)', () => {
        const w = { id: 'w', x: 64, y: 64 };
        let s = null;
        const rots = [];
        for (let t = 0; t < 3; t += 1) {
            s = stepMachineSkin(s, V({ whirlpools: [w] }), t);
            rots.push(machineOps(V({ whirlpools: [w] }), art, { skin: s })[0].rot);
        }
        expect(((rots[1] - rots[0]) % 360 + 360) % 360).toBeCloseTo(340, 9);
        const [op] = machineOps(V({ whirlpools: [w], gameTime: 100 }), art);
        expect([op.alpha, op.frame]).toEqual([0.5, [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1][worldFrame(100, 16)]]);
    });

    it('FinalDoor: frame 0 until it opens, then "open" [1,1,1,1,2..25] at 15 fps; Pod: its anim at 10 fps, the body behind it once past frame 3', () => {
        expect(MACHINE_RULES.doorFrame({ opening: false })).toBe(0);
        expect([1, 2, 4, 5, 8, 9, 200].map((u) => MACHINE_RULES.doorFrame({ opening: true, openUpdates: u })))
            .toEqual([1, 1, 1, 1, 1, 2, 25].map((f, i) => (i < 6 ? [1, 1, 1, 1, 2, 3][animIndex(15, [1, 2, 4, 5, 8, 9][i], 28)] : 25)));
        const pod = (anim, animAge) => ({ id: 'p', x: 40, y: 40, anim, animAge });
        const [body, shell] = machineOps(V({ pods: [pod('close', 0)] }), art);
        expect([body.layer, shell.frame, shell.layer, shell.alpha]).toEqual([8, 6, 7, 0.5]);
        const [, closed] = machineOps(V({ pods: [pod('closed', 3)] }), art);
        expect([closed.frame, closed.layer]).toEqual([0, -(40 + 48)]);
    });
});

describe('2b. the night layer takes the machines\' copies, rings, beams and the Pull\'s circle', () => {
    it('L38: the lit wire at 0.1 and the pulser\'s body copied; L12: the Pull\'s circle through `extra`', () => {
        const row = rowsOf(TAPES.find((t) => t.name === 'L38-ring-wire')).find((r) => r.ops.some((o) => o.circle) && r.skin.lit.size > 0);
        expect(row).toBeTruthy();
        const nv = { ...nightSkinView({ level: 38, state: { x: 0, y: 0 }, world: null }, { record: recordOf(38) }), gameTime: row.view.gameTime };
        const night = nightOps(nv, art, { ops: row.ops, cam: { x: 0, y: 0, w: 160, h: 160 } });
        expect(night.ops.filter((o) => o.key === KEYS.wire).every((o) => o.alpha === 0.1)).toBe(true);
        expect(night.ops.some((o) => o.key === KEYS.wire)).toBe(true);
        expect(night.ops.filter((o) => o.key === KEYS.pulser)).toHaveLength(row.view.pulsers.length);
        expect(night.ops.some((o) => o.circle?.thick !== undefined)).toBe(true);
        const pull = rowsOf(TAPES.find((t) => t.name === 'L12-pull')).find((r) => r.night.length > 0);
        const nv12 = nightSkinView({ level: 12, state: { x: 0, y: 0 }, world: null }, { record: recordOf(12) });
        const n12 = nightOps({ ...nv12, gameTime: pull.view.gameTime }, art, { ops: [], cam: { x: 0, y: 0, w: 160, h: 160 }, extra: pull.night });
        if (n12) expect(n12.ops).toEqual(expect.arrayContaining(pull.night));
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `machine-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ...TAPES.map((t) => [`the skin dropped (${t.name})`, t.name, { drop: true }]),
        ['Pulser — frame 0 always', 'L38-ring-wire', { rules: { pulseFrame: () => 0 } }],
        ['Whirlpool — no spin', 'L46-whirlpool', { rules: { whirlAngle: () => 0 } }],
        ['FinalDoor — never opens', 'L113-door', { rules: { doorFrame: () => 0 } }],
        ['Pod — frame 0 always', 'L112-pods', { rules: { podFrame: () => 0 } }],
        ['Moonrock — worldFrame 0', 'L0-moonrock', { rules: { worldFrame: () => 0 } }],
        ['Grass — one start index', 'L12-pull', { rules: { grassStart: () => 1 } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('machineSkinView wrote to the run'); }, defineProperty: () => { throw new Error('machineSkinView defined on the run'); } });
    it('maps every family; a write anywhere throws', () => {
        const run = frozen({ level: 38, gameTime: 5, state: frozen({ x: 0, y: 0 }), transitions: [], playerDeaths: [],
            world: frozen({ world: frozen({ width: 320, height: 320 }), objectSolids: [frozen({ tag: 'moonrockpile', x: 0, y: 64 })] }),
            machinesNow: frozen({ pulsers: [frozen({ id: 'p', x: 8, y: 8, radius: 12 })], beamTowers: [] }),
            activatorsNow: frozen({ responders: [], pressers: [frozen({ id: 'buttonroom@0,0', tag: 'buttonroom', down: true })] }),
            pulls: [frozen({ id: 'pull@0,32', x: 0, y: 32 })], owlPods: [], moonrock: frozen({ beam: false, rocks: [] }), finalDoors: [] });
        const record = { entities: [{ type: 'buttonroom', x: 0, y: 0 }, { type: 'wire', x: 16, y: 0, attrs: { img: '-1' } },
            { type: 'moonrockpile', x: 0, y: 64 }, { type: 'moonrockpile', x: 64, y: 64 }, { type: 'littlestones', x: 32, y: 32 }] };
        const v = machineSkinView(run, { record });
        expect(v.wires).toEqual([{ id: 'wire@16,0', x: 16, y: 0, img: 2 + 4 }]);
        expect(v.rooms[0].down).toBe(true);
        expect(v.piles).toEqual([{ x: 0, y: 64 }]);
        expect(v.pulsers[0].radius).toBe(12);
        expect(machineSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the machine renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const v = machineSkinView(run, { record: recordOf(run.level) });
                skin = stepMachineSkin(skin, v, tick);
                drawn += machineOps(v, art, { skin }).length + machineNightOps(v, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

describe('6. ⛓ machinesNow (⚖ fidelity-14 2026-10-26): reads build nothing, copies scalars', () => {
    const STAGING = stagingFromTape(loadTape('r9-solve-18'));
    const SOURCE = atlasLevelSource();
    const fresh = (level) => createRunForStaging({ ...STAGING, boot: { level, x: 160, y: 120 }, persistence: [] }, SOURCE);

    for (const level of [104, 107, 38, 40]) {
        it(`L${level}, never ticked: the read leaves every digest part where a never-read twin has it, then and after 30 ticks`, () => {
            const read = fresh(level);
            const twin = fresh(level);
            const before = read.stateDigest({ parts: true });
            const m = read.machinesNow;
            expect(m.pulsers.length + m.beamTowers.length).toBeGreaterThan(0);
            expect(read.stateDigest({ parts: true })).toEqual(before);
            expect(read.stateDigest({ parts: true })).toEqual(twin.stateDigest({ parts: true }));
            for (let i = 0; i < 30; i += 1) {
                read.advance(new Set());
                twin.advance(new Set());
                void read.machinesNow;
            }
            expect(read.stateDigest({ parts: true })).toEqual(twin.stateDigest({ parts: true }));
        });
    }

    it('every row is scalars only (a renderer cannot reach model state through it)', () => {
        const run = fresh(38);
        for (let i = 0; i < 5; i += 1) run.advance(new Set());
        const m = run.machinesNow;
        for (const row of [...m.pulsers, ...fresh(104).machinesNow.beamTowers]) {
            for (const [k, v] of Object.entries(row)) expect(v === null || typeof v !== 'object', k).toBe(true);
        }
        m.pulsers[0].radius = 999;
        expect(run.machinesNow.pulsers[0].radius).not.toBe(999);
    });
});
