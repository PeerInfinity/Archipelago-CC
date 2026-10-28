/**
 * seedlingPuzzleSkin — G7's proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL TAPES: committed fixture tapes through the model
 *      (`tapeRunner.runTape`) — L8's blocks shoved and its sand traps killed
 *      by the arrows (`f4-l8-sandtraps`, the stairs up), L65's spear block
 *      thrust onto the pit where it SINKS (`pushblock-l65-reach-l68`), L38's
 *      fire block (`prox-l38-chest`) — and a stand through the JS runtime at
 *      L16 (the traps chomp; flipped stairs up and down). Each tick's ops are
 *      a golden line; a run of identical lines is one line (`t=a..b`).
 *      ⚠ CHANGE DETECTORS recorded from this renderer. Re-record after a
 *      deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM, by hand from the AS3: the stairs' frame and
 *      flip pivot, a block's frame on the world clock and its 0.1 fade, the
 *      trap's chomp range and its return to the world frame.
 *   3. ONE MUTANT PER CLASS (`PUZZLE_RULES`, and dropping the skin): each
 *      turns a golden red.
 *   4. THE ADAPTER reads the run and writes nothing.
 *   5. ⛔ STATE IDENTITY: each tape's observation stream, final state,
 *      ledgers and `stateLog` byte-identical with the adapter, the reducer and
 *      the ops running every tick, and without; and `stateDigest` equal.
 *   6. THE PAGE: `roomOps` with the new predicates leaves every op it does not
 *      replace in place, and without them is the old list op for op.
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
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { TELEPORTER_COLOUR, formatOp, roomOps, teleporterArtFilter } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { ENEMY_COVERAGE, worldFrame } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import {
    BLOCKS, KEYS, PUZZLE_COVERAGE, PUZZLE_OBJECT_TAGS, PUZZLE_RULES, puzzleOps, puzzleSkinView, stepPuzzleSkin,
} from './seedlingPuzzleSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/**
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * otherwise `level`/`at`/`n` stand the JS runtime still. `want` is what the
 * tape must really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'L8-blocks-traps', fixture: 'f4-l8-sandtraps',
        want: ['st:up', 'b:pushableblock', 'b:moved', 't:idle', 't:dying', 't:hit'] },
    { name: 'L65-spear-sinks', fixture: 'pushblock-l65-reach-l68', want: ['b:pushableblockspear', 'b:moved', 'b:sinking'] },
    { name: 'L38-fire-block', fixture: 'prox-l38-chest', want: ['b:pushableblockfire'] },
    // west of L16's two traps (centres (40,40) and (56,40)), 18 px below the first: within its 20 px chomp range
    { name: 'L16-stand', level: 16, at: [32, 50], n: 120, want: ['st:up', 'st:down', 'st:flip', 't:idle', 't:chomp', 'b:pushableblock'] },
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

/**
 * Drive a tape; `each(tick, run)` after every tick. Returns what the state
 * identity compares (both arms read exactly these, and only after the last tick).
 */
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
        const view = puzzleSkinView(run, { record: recordOf(run.level) });
        skin = stepPuzzleSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : puzzleOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    const v = r.view;
    for (const s of v.stairs) { out.push(s.up ? 'st:up' : 'st:down'); if (s.flip) out.push('st:flip'); }
    for (const b of v.blocks) {
        out.push(`b:${b.tag}`);
        if (b.moved) out.push('b:moved');
        if (b.destroy) out.push('b:sinking');
    }
    for (const t of v.traps) {
        const st = r.skin.bodies.get(`s:${t.id}`);
        out.push(t.dying ? 't:dying' : (st?.sprite.anim === 'chomp' ? 't:chomp' : 't:idle'));
        if (st?.tint) out.push('t:hit');
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

describe('1. golden puzzle ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's stairs, blocks and sand traps`, () => {
            const rows = runTape(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`puzzle-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G7\'s classes are drawn, every key reached the pack, nothing is counted twice', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn]);
        for (const c of PUZZLE_COVERAGE.drawn) expect(before.has(c), `${c} is G7's`).toBe(false);
        expect([...PUZZLE_OBJECT_TAGS].sort()).toEqual(Object.keys(BLOCKS).sort());
    });
});

describe('2. by hand from the AS3', () => {
    const RUN = {};
    const V = (over = {}) => ({ epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900, player: { x: 0, y: 0 }, stairs: [], blocks: [], traps: [], ...over });

    it('stairs: frame int(!up), at the entity\'s own x, y; a flip mirrors about the frame centre (originX 8)', () => {
        const skin = stepPuzzleSkin(null, V(), 1);
        const [up, down] = puzzleOps(V({ stairs: [{ x: 64, y: 16, up: true, flip: false }, { x: 112, y: 64, up: false, flip: true }] }), art, { skin });
        expect([up.frame, up.dx, up.dy, up.flipX, up.layer]).toEqual([0, 64, 16, false, -16]);
        expect([down.frame, down.dx, down.dy, down.flipX, down.pivotX, down.layer]).toEqual([1, 112, 64, true, 8, -64]);
    });

    it('blocks: frame = Game.worldFrame(4) at the render; the fire / spear tints; layer -(y + 16)', () => {
        const blocks = Object.keys(BLOCKS).map((tag, i) => ({ id: `${tag}@0,0`, tag, x: 16 * i, y: 32, destroy: false }));
        for (const time of [0, 11, 12, 33, 44, 45, 90]) {
            const v = V({ gameTime: time, blocks });
            const ops = puzzleOps(v, art, { skin: stepPuzzleSkin(null, v, 1) });
            expect(ops.map((o) => o.frame)).toEqual(blocks.map(() => Math.floor((time % 45) / (45 / 4))));
            expect(ops.map((o) => o.tint ?? null)).toEqual([null, '#ff0000', '#8822ff']);
            expect(ops.map((o) => o.layer)).toEqual([-48, -48, -48]);
        }
        expect(worldFrame(44, 4)).toBe(3);
    });

    it('a sinking block: alpha 0.9 on the update that sets `destroy`, then 0.1 less each update', () => {
        const b = (destroy) => ({ id: 'pb', tag: 'pushableblock', x: 0, y: 0, destroy });
        let skin = null;
        const alphas = [];
        for (const d of [false, false, true, true, true, true]) {
            const v = V({ blocks: [b(d)] });
            skin = stepPuzzleSkin(skin, v, 1);
            alphas.push(+(puzzleOps(v, art, { skin })[0].alpha ?? 1).toFixed(4));
        }
        expect(alphas).toEqual([1, 1, 0.9, 0.8, 0.7, 0.6]);
    });

    it('a sand trap: the world frame while idle; "chomp" within 20 px (int distance), looping back to the world frame', () => {
        const trap = { id: 'sandtrap@0,0', x: 100, y: 100, hitsTimer: 0, dying: false, dieIndex: null };
        const at = (px, py, t) => V({ gameTime: t, player: { x: px, y: py }, traps: [trap] });
        let skin = stepPuzzleSkin(null, at(100, 150, 100), 1);
        expect(skin.bodies.get('s:sandtrap@0,0').sprite.anim).toBe('');
        // 20.9 → int 20: in range (the player seen is the PREVIOUS tick's, so the next step chomps)
        skin = stepPuzzleSkin(skin, at(100, 120.9, 101), 2);
        skin = stepPuzzleSkin(skin, at(100, 120.9, 102), 3);
        expect(skin.bodies.get('s:sandtrap@0,0').sprite.anim).toBe('chomp');
        let far = stepPuzzleSkin(null, at(100, 121, 100), 1);
        far = stepPuzzleSkin(far, at(100, 121, 101), 2);
        expect(far.bodies.get('s:sandtrap@0,0').sprite.anim).toBe('');
        // idle frames follow Game.worldFrame(2) at the top-of-frame clock
        const idle = [];
        let s = null;
        for (let t = 0; t < 60; t += 1) { s = stepPuzzleSkin(s, at(100, 200, t + 1), t); idle.push(s.bodies.get('s:sandtrap@0,0').sprite.frame); }
        expect(idle).toEqual(Array.from({ length: 60 }, (_, t) => worldFrame(t, 2)));
    });
});

describe('3. one mutant per class turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `puzzle-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['the skin dropped: nothing drawn', 'L8-blocks-traps', { drop: true }],
        ['the skin dropped (stairs, chomp)', 'L16-stand', { drop: true }],
        ['the skin dropped (a sinking block)', 'L65-spear-sinks', { drop: true }],
        ['PushableBlock — blockAlpha: never fades', 'L65-spear-sinks', { rules: { blockAlpha: () => 1 } }],
        ['SandTrap — trapUpdate: never chomps', 'L16-stand', { rules: { trapUpdate: (sp, t, ctx, R) => { if (sp.anim === '') sp.frame = R.worldFrame(ctx.time, 2); } } }],
        ['SandTrap — hitTint: never tinted', 'L8-blocks-traps', { rules: { hitTint: () => null } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('puzzleSkinView wrote to the run'); }, defineProperty: () => { throw new Error('puzzleSkinView defined on the run'); } });

    it('maps every class; a write anywhere throws', () => {
        const run = frozen({
            level: 8, gameTime: 50, transitions: [], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({
                pushables: [frozen({ id: 'pushableblock@96,112', tag: 'pushableblock', x: 96, y: 112 }),
                    frozen({ id: 'pushableblock@112,48', tag: 'pushableblock', x: 112, y: 48 })],
                pressEnemies: [frozen({ tag: 'sandtrap', as3: 'SandTrap', x: 96, y: 80 }), frozen({ tag: 'bob', as3: 'Bob', x: 0, y: 0 }),
                    frozen({ tag: 'sandtrap', as3: 'SandTrap', x: 96, y: 128 })],
            }),
            pushables: new Map([['pushableblock@96,112', frozen({ rect: { x: 96, y: 120 }, destroy: true, removed: false })],
                ['pushableblock@112,48', frozen({ rect: { x: 112, y: 48 }, destroy: false, removed: true })]]),
            staticBodies: [frozen({ id: 'sandtrap@96,128', hitsTimer: 7, dying: true, dieIndex: 2, removed: false })],
        });
        const v = puzzleSkinView(run, { record: { entities: [{ type: 'stairsup', x: 144, y: 32, attrs: { flip: '1' } }, { type: 'torch', x: 0, y: 0 }] } });
        expect(v.epoch).toEqual({ run, key: '8|0|0' });
        expect(v.stairs).toEqual([{ x: 144, y: 32, up: true, flip: true }]);
        expect(v.blocks).toEqual([{ id: 'pushableblock@96,112', tag: 'pushableblock', x: 96, y: 120, moved: true, destroy: true, removed: false }]);
        expect(v.traps).toEqual([
            { id: 'sandtrap@96,80', x: 104, y: 88, hitsTimer: 0, dying: false, dieIndex: null, removed: false },
            { id: 'sandtrap@96,128', x: 104, y: 136, hitsTimer: 7, dying: true, dieIndex: 2, removed: false },
        ]);
        expect(puzzleSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the puzzle renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest byte-identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = puzzleSkinView(run, { record: recordOf(run.level) });
                skin = stepPuzzleSkin(skin, view, tick);
                drawn += puzzleOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

describe('6. the room\'s own ops: only the replaced rectangles leave', () => {
    const roomOf = (level) => buildLevelWorld(levelSourceFromAtlas(MAP)(level));
    for (const level of [8, 16, 40, 65]) {
        it(`L${level}: without the predicates the list is unchanged; with them, exactly the blocks' and stairs' rectangles go`, () => {
            const world = roomOf(level);
            const base = roomOps(world, art, { level }).map(formatOp);
            const without = roomOps(world, art, { level, drawnObjects: () => false, drawnTeleporters: () => false }).map(formatOp);
            expect(without).toEqual(base);
            const withP = roomOps(world, art, { level, drawnObjects: (o) => PUZZLE_OBJECT_TAGS.has(o.tag), drawnTeleporters: (tp) => tp.isStairs === true });
            const gone = world.objectSolids.filter((o) => PUZZLE_OBJECT_TAGS.has(o.tag)).length
                + world.teleporters.filter((tp) => !tp.deactivated && tp.isStairs).length;
            expect(gone).toBeGreaterThan(0);
            expect(base.length - withP.length).toBe(gone);
            const kept = new Set(withP.map(formatOp));
            expect(base.filter((l) => !kept.has(l)).every((l) => l.startsWith('fillRect('))).toBe(true);
        });
    }
});

describe('7. the teleporters with art: only the game\'s SHOWN portals keep a stand-in (slice seedling-js-mobile-polish)', () => {
    const roomOf = (level) => buildLevelWorld(levelSourceFromAtlas(MAP)(level));
    const tpRects = (ops) => ops.filter((o) => o?.colour === TELEPORTER_COLOUR && !o.key);
    const shownIn = (level) => (recordOf(level)?.entities ?? []).filter((e) => e.type === 'teleporter' && Number(e.attrs?.show ?? 0) !== 0);
    it('the vanilla map shows exactly six portals (L43 L58 L100 L101 L106 L109)', () => {
        const levels = MAP.levels.filter((l) => shownIn(l.level).length > 0).map((l) => l.level);
        expect(levels).toEqual([43, 58, 100, 101, 106, 109]);
    });
    for (const level of [8, 16, 40, 43, 101]) {
        it(`L${level}: with art no invisible teleporter is painted; the debug (art-less) view paints every active one`, () => {
            const world = roomOf(level);
            const active = world.teleporters.filter((tp) => !tp.deactivated);
            expect(active.length).toBeGreaterThan(0);
            const shown = new Set(shownIn(level).map((e) => `${Number(e.x)},${Number(e.y)}`));
            const shownActive = active.filter((tp) => !tp.isStairs && shown.has(`${tp.x},${tp.y}`));
            // the record's x,y ARE the world's: a shown portal in the record is found in the world
            expect(shownActive.length > 0).toBe(shown.size > 0);
            const withArt = roomOps(world, art, { level, drawnTeleporters: teleporterArtFilter(recordOf(level)) });
            expect(tpRects(withArt).map((o) => `${o.rect.x},${o.rect.y}`).sort())
                .toEqual(shownActive.map((tp) => `${tp.rect.x},${tp.rect.y}`).sort());
            // only the teleporter rectangles left: every other op is the old list's, in order
            const old = roomOps(world, art, { level, drawnTeleporters: (tp) => tp.isStairs === true });
            const isTp = (o) => o?.colour === TELEPORTER_COLOUR && !o.key;
            expect(withArt.filter((o) => !isTp(o)).map(formatOp)).toEqual(old.filter((o) => !isTp(o)).map(formatOp));
            const debug = roomOps(world, null, { level });
            expect(tpRects(debug).length).toBe(active.length);
        });
    }
    it('MUTANT: the old filter (stairs only) paints the invisible ones — the row above would be red', () => {
        const world = roomOf(8);
        const old = roomOps(world, art, { level: 8, drawnTeleporters: (tp) => tp.isStairs === true });
        expect(tpRects(old).length).toBeGreaterThan(0);
    });
    it('THE PAGE passes the filter with art (jsRuntimePage.js)', () => {
        const src = readFileSync(join(HERE, 'jsRuntimePage.js'), 'utf8');
        expect(src).toContain('drawnTeleporters: teleporterArtFilter(');
        expect(src).not.toContain('drawnTeleporters: (tp) => tp.isStairs === true');
    });
});
