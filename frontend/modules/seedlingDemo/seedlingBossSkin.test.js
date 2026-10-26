/**
 * seedlingBossSkin — G10's boss proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. REAL RUNS: a committed tape per boss and per live state — L19's ShieldBoss
 *      sitting, moving its shield, stabbing, hit (the red flash) and dying
 *      (HARDLIGHT, then nothing once `destroy`); the FrozenBoss stood still in
 *      L111 (no tape reaches it). ⚠ CHANGE DETECTORS:
 *      `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. BY HAND from the AS3. 2b. The night layer takes the FrozenBoss's copy.
 *   3. ONE MUTANT PER FAMILY. 4. THE ADAPTER writes nothing. 5. ⛔ STATE IDENTITY
 *      with the renderer on and off.
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
import { ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import { SOLIDS_COVERAGE } from './seedlingSolidsSkin.js';
import { NPC_COVERAGE } from './seedlingNpcSkin.js';
import { TRAP_COVERAGE } from './seedlingTrapSkin.js';
import { LAMP_COVERAGE } from './seedlingLampSkin.js';
import { PICKUP_COVERAGE } from './seedlingPickupSkin.js';
import { MACHINE_COVERAGE } from './seedlingMachineSkin.js';
import { nightOps, nightSkinView } from './seedlingNightSkin.js';
import { BOSS_COVERAGE, KEYS, bossOps, bossSkinView, stepBossSkin } from './seedlingBossSkin.js';

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
    { name: 'L19-shield-kill', fixture: 'r6-shield-kill', want: ['shield:sit', 'shield:moveShield', 'shield:movedShield', 'shield:die', 'shield:hit', 'shield:gone'] },
    { name: 'L19-shield-stab', fixture: 'r6-shield-control', want: ['shield:sit', 'shield:moveShield', 'shield:stab'] },
    { name: 'L112-owl-kill', fixture: 'r6-owl-kill', want: ['owl:intro', 'owl:walk', 'owl:sit', 'owl:hit', 'owl:die', 'owl:dead', 'owl:deadframe'] },
    { name: 'L112-owl-control', fixture: 'r6-owl-control', want: ['owl:intro', 'owl:walk', 'owl:sit'] },
    { name: 'L111-frozen', level: 111, at: [80, 200], n: 3, want: ['frozen'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

const LEDGERS = ['transitions', 'playerHits', 'playerDeaths', 'earnedClears', 'collected', 'shieldBossKills', 'shieldBossHits', 'finalBossKills', 'owlTicks'];
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
        const view = bossSkinView(run);
        skin = stepBossSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: opts.drop ? [] : bossOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const b of r.view.shieldBosses) {
        if (b.destroy || b.removed) { out.push('shield:gone'); continue; }
        out.push(`shield:${b.anim}`);
        if (r.skin?.bodies.get(b.id)?.tint) out.push('shield:hit');
    }
    for (const b of r.view.finalBosses) {
        const st = r.skin?.bodies.get(b.id);
        if (['die', 'dead', 'deadframe'].includes(b.anim)) out.push(`owl:${b.anim}`);
        else out.push(!b.started ? 'owl:intro' : (st?.sprite.anim === 'walk' ? 'owl:walk' : 'owl:sit'));
        if (st?.tint) out.push('owl:hit');
    }
    if (r.view.frozenBosses.length) out.push('frozen');
    return out;
}
const fmt = (o) => `${formatPlayerOp(o, formatOp)}${o.blend ? ` ${o.blend}` : ''}${o.nightCopy ? ' night' : ''}`;
function goldenLines(rows) {
    const lines = [];
    let open = null;
    for (const r of rows) {
        const body = `L${r.view.level} [${[...new Set(tagsOf(r))].join(',')}] | ${r.ops.map(fmt).join(' ; ')}`.trimEnd();
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
const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));

describe('1. golden boss ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} run: every tick's bosses`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`boss-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            expect(rows.flatMap((r) => r.ops).length, `${tape.name}: it drew`).toBeGreaterThan(0);
        }, 240_000);
    }

    it('the coverage table: G10\'s boss classes are new, every key reached the pack', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn, ...LAMP_COVERAGE.drawn, ...PICKUP_COVERAGE.drawn,
            ...MACHINE_COVERAGE.drawn]);
        for (const c of BOSS_COVERAGE.drawn) expect(before.has(c), `${c} is G10's`).toBe(false);
    });

    it('L19: the frame drawn IS the run\'s frame on every live tick, and nothing is drawn from `destroy` on', () => {
        const rows = rowsOf(T['L19-shield-kill']);
        let live = 0;
        for (const r of rows) {
            const [b] = r.view.shieldBosses;
            const op = r.ops.find((o) => o.key === KEYS.shieldBoss);
            if (!b || b.destroy || b.removed) { expect(op, `t=${r.tick}`).toBeUndefined(); continue; }
            live += 1;
            expect(op.frame, `t=${r.tick}`).toBe(b.frame);
            expect([op.dx, op.dy]).toEqual([b.x - 28, b.y - 40]);
            expect(op.blend ?? null).toBe(b.anim === 'die' ? 'hard-light' : null);
        }
        expect(live).toBeGreaterThan(400);
        expect(rows.some((r) => r.view.shieldBosses[0]?.destroy && !r.view.shieldBosses[0].removed), 'the destroyed-not-removed span').toBe(true);
    });
});

describe('2. by hand from the AS3', () => {
    const V = (over = {}) => ({ epoch: { run: 1, key: 'k' }, level: 19, gameTime: 900, shieldBosses: [], finalBosses: [], frozenBosses: [], ...over });
    const owl = (over) => ({ id: 'owl', x: 72, y: 104, vx: 0, vy: 0, started: true, rockfallTime: -1, hits: 0, hitsTimer: 0, destroy: false,
        anim: '', animAge: null, ...over });
    const sb = (over) => ({ id: 'sb', x: 104, y: 72, anim: 'sit', frame: 0, hitsTimer: 0, destroy: false, removed: false, ...over });

    it('Enemy.hitUpdate under ShieldBoss.update: red from h = 30, white from 20, red from 10, normal at 1 — only on ticks the update ran', () => {
        let s = stepBossSkin(null, V({ shieldBosses: [sb({})] }), 1);
        // the hit lands in the PLAYER's update (30 after a 0): no toggle that tick
        s = stepBossSkin(s, V({ shieldBosses: [sb({ hitsTimer: 30 })] }), 2);
        expect(s.bodies.get('sb').tint).toBe(null);
        const tints = [];
        for (let h = 29; h >= 0; h -= 1) {
            s = stepBossSkin(s, V({ shieldBosses: [sb({ hitsTimer: h })] }), 33 - h);
            tints.push(s.bodies.get('sb').tint);
        }
        const red = '#ff0000';
        expect(tints).toEqual([...Array(10).fill(red), ...Array(10).fill(null), ...Array(9).fill(red), null]);
        // the kill: hitsTimer stays 30 through "die" (no update ran), so the tint holds
        let k = stepBossSkin(null, V({ shieldBosses: [sb({})] }), 1);
        for (let i = 0; i < 5; i += 1) k = stepBossSkin(k, V({ shieldBosses: [sb({ anim: 'die', frame: 9, hitsTimer: 30 })] }), 2 + i);
        expect(k.bodies.get('sb').tint).toBe(null);
    });

    it('ShieldBoss.render: centred 56 × 80, layer −(y + 40), HARDLIGHT only while "die", nothing once destroy', () => {
        const skin = stepBossSkin(null, V({ shieldBosses: [sb({})] }), 1);
        const [op] = bossOps(V({ shieldBosses: [sb({ frame: 5, anim: 'stab' })] }), art, { skin });
        expect([op.key, op.frame, op.dx, op.dy, op.sw, op.sh, op.layer, op.blend]).toEqual([KEYS.shieldBoss, 5, 76, 32, 56, 80, -112, undefined]);
        expect(bossOps(V({ shieldBosses: [sb({ anim: 'die', frame: 12 })] }), art, { skin })[0].blend).toBe('hard-light');
        expect(bossOps(V({ shieldBosses: [sb({ anim: 'die', frame: 12, destroy: true })] }), art, { skin })).toEqual([]);
        expect(bossOps(V({ shieldBosses: [sb({ removed: true })] }), art, { skin })).toEqual([]);
    });

    it('FrozenBoss: the Image at the placement (origin 0), layer −(y + 128 + 32·2/3), marked for its nightBmp copy', () => {
        const skin = stepBossSkin(null, V(), 1);
        const [op] = bossOps(V({ frozenBosses: [{ id: 'f', x: 96, y: 16 }] }), art, { skin });
        expect([op.dx, op.dy, op.sw, op.sh, op.nightCopy]).toEqual([96, 16, 160, 160, true]);
        expect(op.layer).toBeCloseTo(-(16 + 128 + 64 / 3), 12);
    });

    it('FinalBoss.update: the intro holds frame 0; the walk branch (|v| = 1) walks at 15 fps and its endAnim sits; a rockfall sits on worldFrame(4)', () => {
        const frames = (seq, start = 900) => {
            let s = null;
            return seq.map((o, i) => {
                s = stepBossSkin(s, V({ gameTime: start + i, finalBosses: [owl(o)] }), i);
                return [s.bodies.get('owl').sprite.anim, bossOps(V({ gameTime: start + i, finalBosses: [owl(o)] }), art, { skin: s })[0].frame];
            });
        };
        expect(frames([{ started: false }, { started: false }])).toEqual([['', 0], ['', 0]]);
        // walking: index steps every 2 updates (15 · 0.0333 = 0.4995 → every third? no: 2.002 updates per frame)
        const walk = frames(Array.from({ length: 10 }, () => ({ vx: 0.6, vy: 0.8 })));
        expect(walk.map(([a]) => a).slice(0, 8).every((a) => a === 'walk')).toBe(true);
        expect(new Set(walk.map(([, f]) => f))).toEqual(new Set([0, 1, 2, 3]));
        // the rockfall (prev rockfallTime > 0): play(""), then the sit frame from Game.time at the update
        const sit = frames([{ vx: 1, rockfallTime: 240 }, { rockfallTime: 239 }, { rockfallTime: 238 }], 45 * 3);
        expect(sit[1][0]).toBe('');
        expect(sit[2][1]).toBe([0, 1, 2, 3][Math.floor(((45 * 3 + 1) % 45) / (45 / 4))]);
    });

    it('FinalBoss death: "die" [4..11] at 5 fps from the run\'s age, then "dead" 11, "deadframe" 11; no fade, the corpse stays', () => {
        const skin = stepBossSkin(null, V({ finalBosses: [owl({})] }), 1);
        const f = (anim, animAge) => bossOps(V({ finalBosses: [owl({ anim, animAge, destroy: true })] }), art, { skin })[0];
        expect([0, 6, 7, 13, 41].map((a) => f('die', a).frame)).toEqual([4, 4, 5, 6, 10]);
        expect(f('dead', 30).frame).toBe(11);
        expect([f('deadframe', null).frame, f('deadframe', null).alpha]).toEqual([11, undefined]);
        expect(f('die', 0).layer).toBe(-(104 + 6));
    });

    it('a stack without the key draws the stand-in rectangle (the hitbox)', () => {
        const none = { has: () => false };
        const skin = stepBossSkin(null, V({ shieldBosses: [sb({})] }), 1);
        expect(bossOps(V({ shieldBosses: [sb({})] }), none, { skin })[0].rect).toEqual({ x: 80, y: 48, w: 48, h: 48, right: 128, bottom: 96 });
    });
});

describe('2b. the night layer takes the FrozenBoss\'s copy', () => {
    it('L111: the body is copied onto nightBmp at the same alpha', () => {
        const row = rowsOf(T['L111-frozen']).at(-1);
        const nv = { ...nightSkinView({ level: 111, state: { x: 0, y: 0 }, world: null }, {}), gameTime: row.view.gameTime };
        const night = nightOps(nv, art, { ops: row.ops, cam: { x: 0, y: 0, w: 160, h: 160 } });
        if (night) expect(night.ops.filter((o) => o.key === KEYS.frozenBoss)).toHaveLength(1);
        const unmarked = row.ops.map((o) => ({ ...o, nightCopy: undefined }));
        const n2 = nightOps(nv, art, { ops: unmarked, cam: { x: 0, y: 0, w: 160, h: 160 } });
        if (n2) expect(n2.ops.filter((o) => o.key === KEYS.frozenBoss)).toHaveLength(0);
    });
});

describe('3. one mutant per family turns a golden red', () => {
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `boss-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ...TAPES.map((t) => [`the skin dropped (${t.name})`, t.name, { drop: true }]),
        ['ShieldBoss — no hit tint', 'L19-shield-kill', { rules: { bossTint: () => null } }],
        ['ShieldBoss — tint on every tick (no update witness)', 'L19-shield-kill', { rules: { bossTint: (st, h) => (h > 0 ? '#ff0000' : st.tint) } }],
        ['ShieldBoss — no HARDLIGHT on "die"', 'L19-shield-kill', { rules: { dieBlend: () => null } }],
        ['FinalBoss — the walk branch never seen', 'L112-owl-kill', { rules: { owlWalked: () => false } }],
        ['FinalBoss — sit frame 0 always', 'L112-owl-kill', { rules: { worldFrame: () => 0 } }],
        ['FinalBoss — death frame 4 always', 'L112-owl-kill', { rules: { owlDeathFrame: () => 4 } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('bossSkinView wrote to the run'); }, defineProperty: () => { throw new Error('bossSkinView defined on the run'); } });
    it('maps every family; a write anywhere throws', () => {
        const run = frozen({ level: 19, gameTime: 5, state: frozen({ x: 0, y: 0 }), transitions: [], playerDeaths: [],
            world: frozen({ objectSolids: [frozen({ tag: 'frozenboss', x: 96, y: 16 })] }),
            shieldBosses: [frozen({ id: 'sb', x: 104, y: 72, anim: 'sit', frame: 0, hitsTimer: 0, destroy: false, removed: false })] });
        const v = bossSkinView(run);
        expect(v.shieldBosses).toEqual([{ id: 'sb', x: 104, y: 72, anim: 'sit', frame: 0, hitsTimer: 0, destroy: false, removed: false }]);
        expect(v.frozenBosses).toEqual([{ id: 'frozenboss@96,16', x: 96, y: 16 }]);
        expect(bossSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the boss renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const v = bossSkinView(run);
                skin = stepBossSkin(skin, v, tick);
                drawn += bossOps(v, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

