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
import { BOSS_COVERAGE, BOSS_RULES, KEYS, bossOps, bossSkinView, stepBossSkin } from './seedlingBossSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
/** A game witness's embedded tape (`fixtures/<dir>/<name>.json`, recorded on the game). */
const witnessTape = (path) => JSON.parse(readFileSync(join(HERE, 'fixtures', `${path}.json`), 'utf8')).tape;

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
    { name: 'L82-kof-kill', witness: 'lavaboss-witness/kof-policy-kill',
        want: ['lava:sit', 'lava:smash', 'lava:smashback', 'lava:armsup', 'lava:sweep', 'lava:sweepback', 'lava:hit', 'lava:hitplayer', 'lava:tint',
            'lava:die', 'lava:dead', 'lava:ball'] },
    { name: 'L82-kof-reflect', witness: 'lavaboss-witness/kof-reflect', want: ['lava:sit', 'lava:sweep', 'lava:ball'] },
    { name: 'L57-tb-kill', witness: 'tentaclebeast-witness/tb-policy-s2',
        want: ['beast:under', 'beast:rise', 'beast:sit', 'beast:dying', 'beast:dead', 'tentacle:rise', 'tentacle:sit', 'tentacle:hit', 'tentacle:hitting',
            'tentacle:sink', 'tentacle:cut', 'tentacle:tint', 'whirl:grow', 'whirl:live', 'whirl:die'] },
    { name: 'L57-tb-cleared', witness: 'tentaclebeast-witness/tb-enter-cleared', want: ['beast:dead'] },
    // ⚠ `digestAcrossRuns: false` — `lightBoss.js`'s MODULE-LEVEL `flierSeq` (G10's finding, for fidelity): a flier's `seq`
    //    is in `stateDigest`'s `visit` part and counts on across runs in one process, so two identical runs differ. Section 5
    //    pins the defect (two OFF runs differ) instead of comparing the digest; the stream, end, ledgers and stateLog still do.
    { name: 'L69-lights-kill', witness: 'lights-witness/lights-solve-sword', digestAcrossRuns: false,
        want: ['totem', 'flier:sit', 'flier:red', 'flier:dark', 'flier:die', 'shot', 'totem:dying'] },
    { name: 'L69-lights-stand', witness: 'lights-witness/lights-stand', want: ['totem', 'flier:sit', 'shot'] },
    { name: 'L111-frozen', level: 111, at: [80, 200], n: 3, want: ['frozen'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

const LEDGERS = ['transitions', 'playerHits', 'playerDeaths', 'earnedClears', 'collected', 'shieldBossKills', 'shieldBossHits', 'finalBossKills', 'owlTicks',
    'lavaBossEvents', 'tentacleBeastEvents', 'lightsEvents'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v instanceof Set ? [...v] : v;
}) : null);

/** Drive a tape; `each(tick, run)` after every tick. Returns what the state identity compares. */
function drive(tape, each = () => {}) {
    if (tape.fixture || tape.witness) {
        let last = null;
        const stream = [];
        const out = runFixtureTape(tape.witness ? witnessTape(tape.witness) : fixture(tape.fixture), {
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
    for (const b of r.view.lavaBosses) {
        if (b.removed) continue;
        out.push(`lava:${b.anim}`);
        if (r.skin?.bodies.get(b.id)?.tint) out.push('lava:tint');
        if (b.balls.length) out.push('lava:ball');
    }
    for (const b of r.view.tentacleBeasts) {
        out.push(b.anim === '' ? (b.dead ? 'beast:dead' : 'beast:sit') : `beast:${b.anim}`);
        for (const t of b.tentacles) {
            out.push(`tentacle:${t.anim}`);
            if (r.skin?.bodies.get(`tentacle:${t.id}`)?.tint) out.push('tentacle:tint');
        }
        for (const w of b.whirlpools) out.push(w.timer >= 90 ? 'whirl:grow' : (w.timer >= 30 ? 'whirl:live' : 'whirl:die'));
    }
    for (const f of r.view.lights) {
        out.push(r.skin?.bodies.get(`totem:${f.id}`)?.dyingRenders ? 'totem:dying' : 'totem');
        for (const b of f.fliers) {
            out.push(b.dying ? 'flier:die' : 'flier:sit');
            const c = r.skin?.bodies.get(`flier:${b.id}`)?.colour;
            if (c) out.push(c === '#ff0000' ? 'flier:red' : 'flier:dark');
        }
        if (f.shots.length) out.push('shot');
    }
    if (r.view.frozenBosses.length) out.push('frozen');
    return out;
}
const fmt = (o) => `${formatPlayerOp(o, formatOp)}${o.blend ? ` ${o.blend}` : ''}${o.nightCopy ? ' night' : ''}${
    o.nightExtra ? ` +night[${o.nightExtra.map((c) => formatPlayerOp(c, formatOp)).join(';')}]` : ''}${o.solidExtra ? ` +solid${o.solidExtra.length}` : ''}`;
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
    const V = (over = {}) => ({ epoch: { run: 1, key: 'k' }, level: 19, gameTime: 900, shieldBosses: [], finalBosses: [], lavaBosses: [], tentacleBeasts: [], lights: [], frozenBosses: [], ...over });
    const kof = (over) => ({ id: 'kof', x: 160, y: 88, anim: 'sit', index: 0, hitsTimer: 0, startAttacking: true, destroy: false, alpha: 1,
        removed: false, balls: [], ...over });
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

    it('LavaBoss.render: main at (1, 1) then the copies at 0.8 (scaled on armsup/sweep); on "dead" main = last alpha, copies = this one', () => {
        let s = stepBossSkin(null, V({ lavaBosses: [kof({})] }), 1);
        let [op] = bossOps(V({ lavaBosses: [kof({ anim: 'smashback', index: 2 })] }), art, { skin: s });
        expect([op.frame, op.dx, op.dy, op.layer, op.alpha]).toEqual([12, 80, 47, -(88 + 41), undefined]);
        expect(op.nightExtra[0].alpha).toBe(0.8);
        expect(op.solidExtra).toEqual(op.nightExtra);
        expect(op.nightExtra[0].scaleX).toBeUndefined();
        [op] = bossOps(V({ lavaBosses: [kof({ anim: 'sweep', index: 1 })] }), art, { skin: s });
        expect(op.nightExtra[0].scaleX).toBeGreaterThanOrEqual(0.8);
        expect(op.nightExtra[0].scaleX).toBeLessThan(1);
        s = stepBossSkin(null, V({ lavaBosses: [kof({ anim: 'dead', destroy: true, alpha: 0.5 })] }), 1);
        s = stepBossSkin(s, V({ lavaBosses: [kof({ anim: 'dead', destroy: true, alpha: 0.49 })] }), 2);
        [op] = bossOps(V({ lavaBosses: [kof({ anim: 'dead', destroy: true, alpha: 0.49 })] }), art, { skin: s });
        expect([op.frame, op.alpha, op.nightExtra[0].alpha]).toEqual([27, 0.5, 0.49]);
        expect(bossOps(V({ lavaBosses: [kof({ removed: true })] }), art, { skin: s })).toEqual([]);
    });

    it('LavaBall: scale 0.5 about (32, 16), angle atan2(−vy, vx), "fly" at 10 fps (not updated on its spawn tick), copied onto nightBmp', () => {
        const ball = { id: 'b1', x: 100, y: 120, vx: 0, vy: 1 };
        let s = null;
        const fr = [];
        for (let t = 0; t < 7; t += 1) {
            s = stepBossSkin(s, V({ lavaBosses: [kof({ balls: [ball] })] }), t);
            fr.push(bossOps(V({ lavaBosses: [kof({ balls: [ball] })] }), art, { skin: s }).find((o) => o.key === KEYS.lavaBall).frame);
        }
        // 10 fps at the clamped 0.0333: an index every third update (0.999 < 1 after three)
        expect(fr).toEqual([0, 0, 0, 0, 1, 1, 1]);
        const op = bossOps(V({ lavaBosses: [kof({ balls: [ball] })] }), art, { skin: s }).find((o) => o.key === KEYS.lavaBall);
        expect([op.rot, op.scaleX, op.pivotX, op.pivotY, op.dx, op.dy, op.nightCopy]).toEqual([-90, 0.5, 32, 16, 68, 104, true]);
    });

    it('TentacleBeast: "rise" aged from its first tick at 8 fps (12 frames), then the sitting frames on worldFrame(4); dead: worldFrame(4, 2)', () => {
        const tb = (over) => ({ id: 'tb', x: 104, y: 72, anim: 'under', activated: false, dead: false, tentacles: [], whirlpools: [], ...over });
        let s = stepBossSkin(null, V({ tentacleBeasts: [tb({})] }), 0);
        expect(bossOps(V({ tentacleBeasts: [tb({})] }), art, { skin: s })[0].frame).toBe(12);
        const fr = [];
        for (let i = 0; i < 9; i += 1) {
            s = stepBossSkin(s, V({ tentacleBeasts: [tb({ anim: 'rise' })] }), 1 + i);
            fr.push(bossOps(V({ tentacleBeasts: [tb({ anim: 'rise' })] }), art, { skin: s })[0].frame);
        }
        // 8 · 0.0333 = 0.2664 a graphic update: the index steps on the 4th, 8th, … (1.0656, 2.1312)
        expect(fr).toEqual([11, 11, 11, 10, 10, 10, 10, 9, 9]);
        const sitAt = (gameTime, dead) => {
            const k = stepBossSkin(null, V({ gameTime, tentacleBeasts: [tb({ anim: '', dead })] }), 1);
            return bossOps(V({ gameTime, tentacleBeasts: [tb({ anim: '', dead })] }), art, { skin: k })[0].frame;
        };
        expect([sitAt(1, false), sitAt(13, false), sitAt(25, false), sitAt(36, false)]).toEqual([0, 1, 2, 1]);
        expect([sitAt(1, true), sitAt(25, true), sitAt(50, true), sitAt(70, true)]).toEqual([17, 18, 19, 18]);
    });

    it('Tentacle: the pivot (8, 47), mirrored when left; the run\'s frame and alpha; a timed whirlpool grows, lives and dies by its timer', () => {
        const t = { id: 't1', x: 60, y: 140, right: false, anim: 'cut', index: 2, destroy: true, alpha: 0.7, hitsTimer: 0 };
        const w = { id: 'w', x: 100, y: 150, timer: 165 };
        const tb = { id: 'tb', x: 104, y: 72, anim: '', activated: true, dead: false, tentacles: [t], whirlpools: [w] };
        const s = stepBossSkin(null, V({ tentacleBeasts: [tb] }), 1);
        const ops = bossOps(V({ tentacleBeasts: [tb] }), art, { skin: s });
        const op = ops.find((o) => o.key === KEYS.tentacle);
        expect([op.frame, op.dx, op.dy, op.flipX, op.alpha, op.layer]).toEqual([19, 52, 93, true, 0.7, -142]);
        const wo = ops.find((o) => o.key === KEYS.whirlpool);
        expect([wo.scaleX, wo.alpha]).toEqual([0.5, 0.25]);
        expect(BOSS_RULES.whirlLook(60)).toEqual({ scale: 1, alpha: 0.5 });
        expect(BOSS_RULES.whirlLook(15)).toEqual({ scale: 0.5, alpha: 0.25 });
    });

    it('LightBoss: red/normal toggles where normal darkens with the hits its PREVIOUS update saw; "die" frames at 1.1; turned to angleFace', () => {
        const fl = (over) => ({ id: 'f', x: 80, y: 60, hits: 0, hitsTimer: 0, angleFace: Math.PI / 2, dying: false, dieIndex: 0, ...over });
        const L = (b, over = {}) => V({ lights: [{ id: 'L', x: 72, y: 72, totemDie: false, fliers: [b], shots: [], ...over }] });
        let s = stepBossSkin(null, L(fl({})), 0);
        s = stepBossSkin(s, L(fl({ hits: 1, hitsTimer: 30 })), 1); // the sword lands in the player's update
        const cs = [];
        for (let h = 29; h >= 0; h -= 1) {
            s = stepBossSkin(s, L(fl({ hits: 1, hitsTimer: h })), 31 - h);
            cs.push(s.bodies.get('flier:f').colour);
        }
        // h 30: white == normal (white, hits 0 at that update) → red; h 20: red → normal #aaaaaa; h 10 → red; h 1 → #aaaaaa
        expect(cs).toEqual([...Array(10).fill('#ff0000'), ...Array(10).fill('#aaaaaa'), ...Array(9).fill('#ff0000'), '#aaaaaa']);
        const op = bossOps(L(fl({ hits: 1 })), art, { skin: s }).find((o) => o.key === KEYS.lightBoss);
        expect([op.tint, op.rot, op.dx, op.dy]).toEqual(['#aaaaaa', -90, 72, 52]);
        const die = bossOps(L(fl({ dying: true, dieIndex: 4 })), art, { skin: s }).find((o) => o.key === KEYS.lightBoss);
        expect([die.frame, die.scaleX]).toEqual([5, 1.1]);
    });

    it('LightBossShot spins 10° an update from 0 (not on its spawn tick); the totem lifts 10 px, x·0.9, y+0.1, reddens a render once dying', () => {
        const L = (over) => V({ lights: [{ id: 'L', x: 72, y: 72, totemDie: false, fliers: [], shots: [{ id: 's', x: 50, y: 50 }], ...over }] });
        let s = null;
        const rots = [];
        for (let i = 0; i < 4; i += 1) {
            s = stepBossSkin(s, L({}), i);
            rots.push(bossOps(L({}), art, { skin: s }).find((o) => o.key === KEYS.lightShot).rot);
        }
        expect(rots.map((r) => Math.abs(r))).toEqual([0, 10, 20, 30]);
        const totem = (k) => {
            let t = stepBossSkin(null, L({ shots: [] }), 0);
            for (let i = 0; i < k; i += 1) t = stepBossSkin(t, L({ shots: [], totemDie: true }), 1 + i);
            return bossOps(L({ shots: [], totemDie: k > 0 }), art, { skin: t }).find((o) => o.key === KEYS.lightTotem);
        };
        expect([totem(0).dx, totem(0).dy, totem(0).layer, totem(0).nightCopy]).toEqual([72, 64, -80, true]);
        const t2 = totem(2);
        expect([t2.scaleX, t2.scaleY, t2.tint, t2.dy]).toEqual([0.81, 1.2, '#ff6666', 44]);
        expect(totem(1).tint).toBe('#ff7272'); // 255 − 255·0.55 = 114.75 → 114 (`uint +=` truncates)
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
        ['LavaBoss — frame 0 always', 'L82-kof-kill', { rules: { lavaFrame: () => 0 } }],
        ['LavaBoss — the copies at full alpha', 'L82-kof-kill', { rules: { lavaCopyAlpha: () => 1 } }],
        ['LavaBall — no angle', 'L82-kof-reflect', { rules: { ballAngle: () => 0 } }],
        ['TentacleBeast — frame 12 always', 'L57-tb-kill', { rules: { beastFrame: () => 12 } }],
        ['Tentacle — frame 5 always', 'L57-tb-kill', { rules: { tentacleFrame: () => 5 } }],
        ['Whirlpool — full size from its spawn', 'L57-tb-kill', { rules: { whirlLook: () => ({ scale: 1, alpha: 0.5 }) } }],
        ['TentacleBeast — the dead sitting frames never', 'L57-tb-cleared', { rules: { beastFrame: () => 0 } }],
        ['LightBoss — the plain Enemy tint (no darkening normal)', 'L69-lights-kill', { rules: { flierTint: (c, h, now) => (h > 0 && now === h - 1 && h % 10 === 0 ? (c ? null : '#ff0000') : c) } }],
        ['LightBossTotem — never dies', 'L69-lights-kill', { rules: { totemLook: () => ({ scaleX: 1, scaleY: 1, tint: null, dy: 0 }) } }],
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
            if (tape.digestAcrossRuns === false) {
                // ⛔ KNOWN-DEFECT PIN, NOT A REQUIREMENT: `lightBoss.js:258` keeps `flierSeq` at MODULE level (owner:
                // fidelity), so two identical runs in one process digest differently. The fix flips this row ON PURPOSE:
                // then delete the pin and the tape's `digestAcrossRuns: false`, and compare the digest like every other tape.
                expect(drive(tape).digest, 'KNOWN DEFECT (fidelity): flierSeq is module-level').not.toBe(off.digest);
            } else expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

