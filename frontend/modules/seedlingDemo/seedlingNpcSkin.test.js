/**
 * seedlingNpcSkin — G8's NPC proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL TAPES through the model: the L12 Witch talked to (`enc-l12-witch`,
 *      the intro character standing by), the L114 Watcher's talk with the seed
 *      held out (`r6-watcher-talk`), Karlore in range (`r5-karlore-plug`), L0's
 *      intro character and statue prompt (`r9-l0-sword-dash`) — and stands
 *      through the JS runtime beside the Oracle (it wakes), the L34 trio, the
 *      Hermit and the Totem, the Yeti, the Sensei, Rekcahdam and the L19 sign.
 *      Each tick's ops are a golden line; a run of identical lines is one line.
 *      ⚠ CHANGE DETECTORS: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. THE INDEPENDENT STRATUM, by hand from the AS3: the talk prompt's place
 *      and frame, the facing kept out of range, `talked`, the stand frames, the
 *      Oracle's wake, the Watcher's direction / seed / die frames and layers.
 *   3. ONE MUTANT PER FAMILY (`NPC_RULES`, and dropping the skin).
 *   4. THE ADAPTER reads the run and writes nothing.
 *   5. ⛔ STATE IDENTITY: stream, end state, ledgers, stateLog and
 *      `stateDigest` identical with the renderer running every tick and without.
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
import {
    NPC_ART, NPC_COVERAGE, NPC_RULES, TALK_KEY, WATCHER_KEY, npcOps, npcSkinView, stepNpcSkin,
} from './seedlingNpcSkin.js';

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
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * otherwise `level`/`at`/`n` stand the JS runtime still (no key, so no talk:
 * the prompt shows). `want` is what the tape must really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'L12-witch-talks', fixture: 'enc-l12-witch', want: ['n:witch', 'n:introchar', 'n:talking', 'n:prompt'] },
    // ⚠ The Watcher is drawn only with the shield (`visible = Player.hasShield`), and neither L114 tape holds it: both run
    // again with a shield GRANT (`with`), a real tape plus one item. Without it they draw no Watcher (as the game does).
    // (`r6-watcher-blood` with the shield lands no hit, so the die frames are the by-hand stratum's alone.)
    { name: 'L114-watcher-seed', fixture: 'r6-watcher-talk', with: { grants: [{ level: 114, items: ['shield'] }] },
        want: ['w:watcher', 'w:seed', 'w:visible'] },
    { name: 'L48-karlore', fixture: 'r5-karlore-plug', want: ['n:karlore', 'n:prompt'] },
    { name: 'L0-introchar-statue', fixture: 'r9-l0-sword-dash', want: ['n:introchar', 'n:statue2'] },
    // `Game(level, x, y)` puts the player at the cell's centre (x + 8, y + 8).
    // 24 px below the Oracle's centre (72, 40): in its talk range, inside its 48 px wake
    { name: 'L1-oracle-wakes', level: 1, at: [64, 56], n: 90, want: ['n:oracle', 'o:waken', 'o:awake', 'n:prompt'] },
    { name: 'L34-trio', level: 34, at: [56, 72], n: 60, want: ['n:introchar', 'n:forestchar', 'n:adnanchar', 'n:prompt', 'n:flip'] },
    { name: 'L37-hermit-totem', level: 37, at: [264, 176], n: 60, want: ['n:hermit', 'n:totem', 'n:prompt'] },
    { name: 'L58-yeti', level: 58, at: [56, 80], n: 60, want: ['n:yeti', 'n:prompt'] },
    { name: 'L64-sensei', level: 64, at: [32, 72], n: 60, want: ['n:sensei', 'n:prompt'] },
    { name: 'L94-rekcahdam', level: 94, at: [192, 192], n: 60, want: ['n:rekcahdam', 'n:adnanchar', 'n:prompt'] },
    { name: 'L19-sign', level: 19, at: [64, 148], n: 30, want: ['n:sign', 'n:prompt'] },
    // below `statue2@184,160` (entity (200, 152), frame 1: its 32 px talk range): its prompt, no body of ours
    { name: 'L0-statue-prompt', level: 0, at: [192, 168], n: 30, want: ['n:statue2', 'n:prompt'] },
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
    if (tape.fixture) {
        let last = null;
        const stream = [];
        const out = runFixtureTape({ ...fixture(tape.fixture), ...(tape.with ?? {}) }, {
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
        const view = npcSkinView(run);
        skin = stepNpcSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : npcOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const t of r.view.talkers) {
        const st = r.skin.bodies.get(t.id);
        out.push(`n:${t.tag}`);
        if (t.talking) out.push('n:talking');
        if (st?.inRange && !st.talked) out.push('n:prompt');
        if (st?.flip) out.push('n:flip');
        if (t.tag === 'oracle' && st?.sprite.anim) out.push(`o:${st.sprite.anim}`);
    }
    for (const w of r.view.watchers) {
        out.push('w:watcher');
        const f = r.skin.bodies.get(w.id)?.frame;
        if (f === 6) out.push('w:seed');
        if (f >= 7) out.push('w:die');
        if (r.view.shield) out.push('w:visible');
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

describe('1. golden NPC ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's NPCs, prompts and watchers`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`npc-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G8\'s NPC classes are new, every key reached the pack', () => {
        for (const k of [TALK_KEY, WATCHER_KEY, ...Object.values(NPC_ART).map((s) => s.key).filter(Boolean)]) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn]);
        for (const c of NPC_COVERAGE.drawn) expect(before.has(c), `${c} is G8's`).toBe(false);
    });
});

describe('2. by hand from the AS3', () => {
    const RUN = {};
    const V = (over = {}) => ({ epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900, player: { x: 0, y: 0 }, shield: false,
        talkers: [], watchers: [], ...over });
    const witch = (talking = false) => ({ id: 'witch@0,0', tag: 'witch', x: 100, y: 100, talking });

    it('the talk prompt: in range and not talked, at (x − 5, y − originY − 2 − 14), Game.worldFrame(2, 1/1.25)', () => {
        let skin = null;
        for (const p of [{ x: 100, y: 124 }, { x: 100, y: 124 }]) skin = stepNpcSkin(skin, V({ player: p, talkers: [witch()] }), 1);
        const ops = npcOps(V({ player: { x: 100, y: 124 }, talkers: [witch()] }), art, { skin });
        const prompt = ops.find((o) => o.key === TALK_KEY);
        // the Witch's image is 16 × 13: originY 6.5
        expect([prompt.dx, prompt.dy, prompt.frame, prompt.layer]).toEqual([95, 100 - 6.5 - 2 - 14, worldFrame(900, 2, 0.8), -(100 + 6.5)]);
        // out of range (24.0001): no prompt
        let far = null;
        for (let i = 0; i < 2; i += 1) far = stepNpcSkin(far, V({ player: { x: 100, y: 124.01 }, talkers: [witch()] }), 1);
        expect(npcOps(V({ talkers: [witch()] }), art, { skin: far }).some((o) => o.key === TALK_KEY)).toBe(false);
    });

    it('talked: a talk start hides the prompt until the player leaves the range; the facing is kept out of range', () => {
        const at = (p, talking) => V({ player: p, talkers: [witch(talking)] });
        let s = stepNpcSkin(null, at({ x: 110, y: 110 }, false), 1);
        s = stepNpcSkin(s, at({ x: 110, y: 110 }, false), 2);
        expect([s.bodies.get('witch@0,0').inRange, s.bodies.get('witch@0,0').talked, s.bodies.get('witch@0,0').flip]).toEqual([true, false, false]);
        s = stepNpcSkin(s, at({ x: 90, y: 110 }, true), 3);            // talks; (the facing still reads the previous tick)
        s = stepNpcSkin(s, at({ x: 90, y: 110 }, false), 4);           // the talk ended in range: still talked, now facing left
        expect([s.bodies.get('witch@0,0').talked, s.bodies.get('witch@0,0').flip]).toEqual([true, true]);
        s = stepNpcSkin(s, at({ x: 300, y: 300 }, false), 5);
        s = stepNpcSkin(s, at({ x: 300, y: 300 }, false), 6);          // out of range: talked reset, the facing KEPT
        expect([s.bodies.get('witch@0,0').inRange, s.bodies.get('witch@0,0').talked, s.bodies.get('witch@0,0').flip]).toEqual([false, false, true]);
    });

    it('the stand frames: worldFrame(2) at the render clock (Hermit / Sensei through their standAnimFrames); "talk" while talking', () => {
        for (const [tag, list] of [['witch', [0, 1]], ['hermit', [0, 2]], ['sensei', [0, 1]], ['sign', [0]]]) {
            for (const time of [0, 22, 23, 44, 45]) {
                const v = V({ gameTime: time, player: { x: 500, y: 500 }, talkers: [{ id: tag, tag, x: 0, y: 0, talking: false }] });
                expect(stepNpcSkin(null, v, 1).bodies.get(tag).sprite.frame, `${tag} t${time}`).toBe(list[worldFrame(time, list.length)]);
            }
        }
        let s = null;
        const frames = [];
        for (let i = 0; i < 14; i += 1) {
            s = stepNpcSkin(s, V({ gameTime: i, talkers: [{ id: 'h', tag: 'hermit', x: 0, y: 0, talking: true }] }), i);
            frames.push(s.bodies.get('h').sprite.frame);
        }
        // talk [1,2,3,0,0] @15: played at the first render, then 0.4995 a tick
        expect(frames).toEqual([1, 1, 1, 2, 2, 3, 3, 0, 0, 0, 0, 1, 1, 2]);
    });

    it('the Oracle: asleep (frame 0) from its ctor, "waken" within 48 px at the render, then "awake" (frame 3)', () => {
        const v = (p) => V({ player: p, talkers: [{ id: 'o', tag: 'oracle', x: 72, y: 40, talking: false }] });
        let s = stepNpcSkin(null, v({ x: 72, y: 89 }), 1);   // 49 px: stays asleep
        expect([s.bodies.get('o').sprite.anim, s.bodies.get('o').sprite.frame]).toEqual(['sleep', 0]);
        const seen = [];
        for (let i = 0; i < 24; i += 1) { s = stepNpcSkin(s, v({ x: 72, y: 88 }), i); seen.push(s.bodies.get('o').sprite.frame); }
        // waken [0,1,2] @5: 0.1665 a tick, so a frame every 6 updates; its end plays "awake" (frame 3)
        expect(seen).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
        expect(s.bodies.get('o').sprite.anim).toBe('awake');
        const [op] = npcOps(v({ x: 72, y: 88 }), art, { skin: s });
        expect([op.dx, op.dy, op.layer]).toEqual([64, 24, -48]);
    });

    it('the Watcher: hidden without the shield; the direction frame, the seed frame on pages 9..19, the die frames', () => {
        const w = (over = {}) => ({ id: 'w', x: 100, y: 100, cleared: false, talking: false, page: null, hits: 0, text: true, ...over });
        const frameOf = (watcher, p) => { const s = stepNpcSkin(stepNpcSkin(null, V({ player: p, watchers: [watcher] }), 1), V({ player: p, watchers: [watcher] }), 2); return s.bodies.get('w').frame; };
        expect([frameOf(w(), { x: 150, y: 100 }), frameOf(w(), { x: 100, y: 50 }), frameOf(w(), { x: 50, y: 100 }), frameOf(w(), { x: 100, y: 150 })]).toEqual([0, 1, 3, 4]);
        expect(frameOf(w({ talking: true, page: 9 }), { x: 150, y: 100 })).toBe(6);
        expect(frameOf(w({ talking: true, page: 20 }), { x: 150, y: 100 })).toBe(0);
        expect([1, 2, 3, 4, 9].map((hits) => frameOf(w({ hits }), { x: 150, y: 100 }))).toEqual([7, 8, 9, 9, 9]);
        const s = stepNpcSkin(null, V({ watchers: [w()] }), 1);
        expect(npcOps(V({ watchers: [w()] }), art, { skin: s })).toEqual([]);
        const [op] = npcOps(V({ shield: true, watchers: [w()] }), art, { skin: s });
        expect([op.key, op.dx, op.dy, op.layer]).toEqual([WATCHER_KEY, 94, 92.5, -(100 - 8 + 32 / 3)]);
        expect(npcOps(V({ shield: true, watchers: [w({ text: false })] }), art, { skin: s })[0].layer).toBe(-(100 + 128));
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `npc-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['the skin dropped (the Witch, the intro character)', 'L12-witch-talks', { drop: true }],
        ['the skin dropped (the Watcher)', 'L114-watcher-seed', { drop: true }],
        ['the skin dropped (the Oracle)', 'L1-oracle-wakes', { drop: true }],
        ['the skin dropped (the L34 trio)', 'L34-trio', { drop: true }],
        ['the skin dropped (the Hermit, the Totem)', 'L37-hermit-totem', { drop: true }],
        ['NPC — talkUpdate: never in range (no prompt, no facing)', 'L34-trio', { rules: { talkUpdate: (st) => { st.inRange = false; } } }],
        ['NPC — npcFrame: no talk anim', 'L12-witch-talks', { rules: { npcFrame: (st) => { st.sprite = { ...st.sprite, anim: '', frame: 0 }; } } }],
        ['Oracle — npcFrame: never wakes', 'L1-oracle-wakes', { rules: { npcFrame: (st, t, ctx) => (t.tag === 'oracle' ? undefined : NPC_RULES.npcFrame(st, t, ctx)) } }],
        ['Watcher — watcherFrame: never the seed', 'L114-watcher-seed', { rules: { watcherFrame: () => 0 } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('npcSkinView wrote to the run'); }, defineProperty: () => { throw new Error('npcSkinView defined on the run'); } });

    it('maps the talkers and the watchers; a write anywhere throws', () => {
        const run = frozen({
            level: 12, gameTime: 50, transitions: [], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({
                talkers: [frozen({ id: 'witch@416,384', tag: 'witch', ex: 424, ey: 392 }), frozen({ id: 'introchar@560,608', tag: 'introchar', ex: 568, ey: 616 }),
                    frozen({ id: 'blob@0,0', tag: 'notannpc', ex: 0, ey: 0 })],
                watchers: [frozen({ id: 'watcher@296,104', text: '' })],
            }),
            talkCircles: [frozen({ id: 'witch@416,384' }), frozen({ id: 'blob@0,0' })],
            talkingNow: frozen({ source: 'talker', id: 'witch@416,384' }),
            watchers: [frozen({ id: 'watcher@296,104', x: 304, y: 112, cleared: true, talking: false, page: null, hits: 2 })],
            inventory: frozen({ hasShield: true }),
        });
        const v = npcSkinView(run);
        expect(v.epoch).toEqual({ run, key: '12|0|0' });
        expect(v.shield).toBe(true);
        expect(v.talkers).toEqual([{ id: 'witch@416,384', tag: 'witch', x: 424, y: 392, talking: true }]);
        expect(v.watchers).toEqual([{ id: 'watcher@296,104', x: 304, y: 112, cleared: true, talking: false, page: null, hits: 2, text: false }]);
        expect(npcSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the NPC renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = npcSkinView(run);
                skin = stepNpcSkin(skin, view, tick);
                drawn += npcOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});
