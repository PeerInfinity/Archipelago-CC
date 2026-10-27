/**
 * seedlingPickupSkin — G9a's placed-pickup proof, in node, over the COMMITTED
 * seedling pack's manifest (no pixels):
 *
 *   1. REAL RUNS: a committed tape per pickup class the tapes reach (present →
 *      its ceremony RISEN over the player → taken), the Wand's approach fade
 *      (hidden → shown), and JS-runtime stands for the two classes no tape
 *      reaches (GhostSword L106, FireWand L109). Each tick's ops are a golden
 *      line. ⚠ CHANGE DETECTORS: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   2. BY HAND from the AS3: each class's frame, the wand bob and glow, the
 *      health spin and flips, the boss key 2 circle, the ceremony's risen place,
 *      the night copies (only on a vanilla pickup's op).
 *   3. ONE MUTANT PER FAMILY. 4. THE ADAPTER writes nothing.
 *   5. ⛔ STATE IDENTITY with the renderer on and off, `stateDigest` included.
 *   6. THE AP LOOK: an AP slot is an `apitem` — this skin draws nothing there and
 *      G3's `apItemOps` draws its look; `roomOps`' stand-in goes only where asked.
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
import { levelSourceFromAtlas } from './atlasSource.js';
import { createLevelRun } from './levelRun.js';
import { formatOp, roomOps } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { apItemOps, worldFrame, ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import { SOLIDS_COVERAGE } from './seedlingSolidsSkin.js';
import { NPC_COVERAGE } from './seedlingNpcSkin.js';
import { TRAP_COVERAGE } from './seedlingTrapSkin.js';
import { LAMP_COVERAGE } from './seedlingLampSkin.js';
import { NIGHT_COPIES, nightOps, nightSkinView } from './seedlingNightSkin.js';
import { HITBOX } from './playerPhysicsV1.js';
import {
    KEYS, PICKUP_COVERAGE, PICKUP_RULES, PICKUP_TAGS, pickupOps, pickupSkinView, stepPickupSkin,
} from './seedlingPickupSkin.js';

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
    { name: 'L10-sword', fixture: 'r3-collect-sword', want: ['sword', 'sword:held', 'taken'] },
    { name: 'L20-shield', fixture: 'r3-collect-shield', want: ['shield', 'shield:held', 'taken'] },
    { name: 'L43-wand', fixture: 'r5-l43-wand', want: ['wand:hidden', 'wand', 'wand:held', 'taken'] },
    { name: 'L49-conch', fixture: 'r5-d5-conch', want: ['conch', 'conch:held', 'taken'] },
    { name: 'L64-spear', fixture: 'r3-collect-spear', want: ['ghostspear', 'ghostspear:held', 'taken'] },
    { name: 'L68-health', fixture: 'r4-walk-6-health', want: ['health', 'health:held', 'taken'] },
    { name: 'L74-darkshield', fixture: 'r3-collect-darkshield', want: ['darkshield', 'darkshield:held', 'taken'] },
    { name: 'L79-darksuit', fixture: 'r3-collect-darksuit', want: ['darksuit', 'darksuit:held', 'taken'] },
    { name: 'L89-feather', fixture: 'r3-collect-feather', want: ['feather', 'feather:held', 'taken'] },
    { name: 'L30-torch', fixture: 'r3-collect-torch', want: ['torchpickup', 'torchpickup:held', 'taken'] },
    { name: 'L19-bosskey0', fixture: 'r6-shield-kill', want: ['bosskey0', 'bosskey0:held', 'taken'] },
    { name: 'L29-bosskey1', fixture: 'u15-turret-spit', want: ['bosskey1'] },
    { name: 'L40-parts-bosskey2', fixture: 'prox-l40-turret-contact', want: ['totempart', 'bosskey2'] },
    { name: 'L67-bosskey4', fixture: 'ladder2-l59-grenade', want: ['bosskey4'] },
    { name: 'L115-seed', fixture: 'r6-seed-control', want: ['seed', 'seed:held'] },
    { name: 'L106-ghostsword', level: 106, at: [64, 104], n: 90, want: ['ghostsword'] },
    { name: 'L109-firewand', level: 109, at: [160, 104], n: 90, want: ['firewand'] },
]);

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
        const view = pickupSkinView(run);
        skin = stepPickupSkin(skin, view, tick);
        rows.push({ tick, view, ops: opts.drop ? [] : pickupOps(view, art, { skin, ...opts }) });
    });
    return rows;
}

const lookOf = (p) => (p.tag === 'bosskey' ? `bosskey${p.keyType}` : p.tag);
/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const p of r.view.pickups) out.push(p.hidden ? `${lookOf(p)}:hidden` : p.held ? `${lookOf(p)}:held` : lookOf(p));
    if (r.view.taken > 0) out.push('taken');
    return out;
}
const fmt = (o) => `${formatPlayerOp(o, formatOp)}${o.nightCopy ? ' night' : ''}${o.nightExtra
    ? ` +${o.nightExtra.map((c) => `circle(${c.circle.x},${c.circle.y},${+c.circle.r.toFixed(3)},${c.colour})`).join('')}` : ''}`;
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

describe('1. golden pickup ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} run: every tick's placed pickups`, () => {
            const rows = rowsOf(tape);
            const lines = goldenLines(rows);
            expect(lines).toEqual(golden(`pickup-${tape.name}.txt`, lines));
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the coverage table: G9a\'s pickup classes are new, every key reached the pack', () => {
        for (const k of Object.values(KEYS)) expect(art.has(k), k).toBe(true);
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
            ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn, ...LAMP_COVERAGE.drawn]);
        for (const c of PICKUP_COVERAGE.drawn) expect(before.has(c), `${c} is G9a's`).toBe(false);
    });
});

describe('2. by hand from the AS3', () => {
    const P = (tag, over = {}) => ({ id: `${tag}@0,0`, tag, x: 40, y: 40, hit: { h: 8, originY: 4 }, bottom: 44, held: false, hidden: false, ...over });
    const V = (pickups, over = {}) => ({ epoch: { run: 1, key: 'k' }, level: 9, gameTime: 900, player: { x: 60, y: 80 }, taken: 0, pickups, ...over });
    const one = (p, over) => pickupOps(V([p], over), art)[0];

    it('each class\'s frame at the render (`render()`), centred on its cell, layer −(hitbox bottom)', () => {
        for (const time of [0, 14, 15, 30, 44, 61, 133]) {
            const f = (tag, extra = {}) => one(P(tag, extra), { gameTime: time }).frame;
            expect(f('sword')).toBe(worldFrame(time, 3));
            expect(f('conch')).toBe(worldFrame(time, 3));
            expect(f('feather')).toBe(worldFrame(time, 8));
            expect(f('ghostspear')).toBe(worldFrame(time, 2));
            expect(f('ghostsword')).toBe(worldFrame(time, 2));
            expect(f('health')).toBe(worldFrame(time, 6));
            expect(f('bosskey', { keyType: 0 })).toBe(worldFrame(time, 7));
            expect(f('wand')).toBe(worldFrame(time, 6));
            expect(f('seed')).toBe([0, 1, 2, 1][worldFrame(time, 4)]);
            expect(f('shield')).toBe(0);
            expect(f('torchpickup')).toBe(0);
            expect(f('totempart', { totemPart: 3 })).toBe(3);
        }
        const op = one(P('sword'));
        expect([op.dx, op.dy, op.layer]).toEqual([32, 32, -44]);
    });

    it('the Wand / Fire Wand bob `2·sin(2π·(time % 45)/45)` and their glow circles', () => {
        for (const time of [0, 11, 22, 33]) {
            const bob = 2 * Math.sin((2 * Math.PI * (time % 45)) / 45);
            const op = one(P('firewand'), { gameTime: time });
            expect(op.dy).toBeCloseTo(40 + bob - 4, 9);   // ⛓ G10 (F4): 9 px high → int origin 4
            const frame = worldFrame(time, 6);
            const r = (6 * frame) / 5 + 14;
            // cx = x + int(-2 + 3), cy = int(y) + int(-4 + bob + 1)
            expect(op.nightExtra.map((c) => [c.circle.x, c.circle.y, c.circle.r, c.colour, c.alpha]))
                .toEqual([[41, 40 + Math.trunc(-3 + bob), r, '#ff8800', 0.2], [41, 40 + Math.trunc(-3 + bob), r / 2, '#ff8800', 0.2]]);
        }
        expect(one(P('wand')).nightExtra[0].colour).toBe('#ffff00');
        expect(pickupOps(V([P('wand', { hidden: true })]), art)).toEqual([]);
    });

    it('HealthPickup: 10° more each render this visit (counter-clockwise), flips from the cosmetic band', () => {
        let skin = null;
        const view = V([P('health')]);
        const rots = [];
        for (let t = 5; t < 9; t += 1) {
            skin = stepPickupSkin(skin, view, t);
            rots.push(pickupOps(view, art, { skin })[0].rot);
        }
        expect(rots).toEqual([-10, -20, -30, -40]);
        // a new visit restarts the count
        skin = stepPickupSkin(skin, { ...view, epoch: { run: 1, key: 'other' } }, 9);
        expect(pickupOps({ ...view, epoch: { run: 1, key: 'other' } }, art, { skin })[0].rot).toBe(-10);
        const [sx, sy] = PICKUP_RULES.flips(9, P('health'));
        const op = pickupOps(view, art, { skin: null })[0];
        expect([op.scaleX ?? 1, op.scaleY ?? 1]).toEqual([sx, sy]);
    });

    it('boss key 2: its circle (0xFFFFCC at 0.25), then its night copy; keys 2–4 copied, 0–1 not', () => {
        for (const time of [0, 9, 18, 27, 36]) {
            const op = one(P('bosskey', { keyType: 2 }), { gameTime: time });
            expect(op.nightExtra).toHaveLength(1);
            expect(op.nightExtra[0].circle).toEqual({ x: 40, y: 40, r: 8 * (1.1 + (0.25 * worldFrame(time, 5)) / 5) });
        }
        for (const k of [0, 1, 2, 3, 4]) expect(!!one(P('bosskey', { keyType: k })).nightCopy, `key ${k}`).toBe(k >= 2);
    });

    it('the night copies: only on the vanilla pickup\'s op — an AP look with the same sheet is never copied', () => {
        for (const tag of ['health', 'ghostsword', 'torchpickup']) {
            const op = one(P(tag));
            expect(op.nightCopy, tag).toBe(true);
            expect(NIGHT_COPIES[op.key].when(op)).toBe(true);
            const [ap] = apItemOps([{ look: tag, rect: { x: 36, y: 36, right: 44, bottom: 44 } }], art, '#e8c040');
            expect(ap.key).toBe(op.key);
            expect(NIGHT_COPIES[ap.key].when(ap)).toBe(false);
        }
        expect(one(P('sword')).nightCopy).toBeUndefined();
    });

    it('the ceremony: RISEN over the player (x = player.x, y = player.y − originY − offY − 5), layer −FP.height, the torch on frame 1', () => {
        const p = P('sword', { held: true });
        const op = one(p);
        const offY = Math.min(8 - 4, 16 - 8);
        expect([op.dx + 8, op.dy + 8, op.layer]).toEqual([60, 80 - HITBOX.originY - offY - 5, -160]);
        expect(one(P('torchpickup', { held: true })).frame).toBe(1);
        // the ghost spear: hitbox 4 high (origin 2), image 7 high (int origin 3) → offY = min(2, 4)
        const s = one(P('ghostspear', { held: true, hit: { h: 4, originY: 2 } }));
        expect(s.dy + 3).toBe(80 - HITBOX.originY - 2 - 5);   // ⛓ G10 (F4): the image's int origin, 3
    });
});

describe('2b. the night layer takes the copies and the glows (`nightOps` over the room\'s ops)', () => {
    for (const [level, at, key, circles] of [[40, [656, 560], 'seedling:pickup/bosskey2', 1], [109, [160, 104], 'seedling:pickup/firewand', 2]]) {
        it(`L${level}: ${key}'s ${circles} circle(s), then its copy only where the class copies`, () => {
            const rt = boot(level, at);
            for (let i = 0; i < 3; i += 1) rt.tick(new Set());
            const run = rt.run;
            const ops = pickupOps(pickupSkinView(run), art);
            const mine = ops.find((o) => o.key === key);
            const record = MAP.levels.find((l) => l.level === level);
            const night = nightOps(nightSkinView(run, { record }), art, { ops, cam: { x: 0, y: 0, w: 160, h: 160 } });
            expect(night.alpha).toBeGreaterThan(0);
            const circ = night.ops.filter((o) => o.circle && mine.nightExtra.includes(o));
            expect(circ).toHaveLength(circles);
            const copies = night.ops.filter((o) => o.key === key);
            expect(copies).toHaveLength(mine.nightCopy ? 1 : 0);
            // without the skin's ops the night layer has none of them
            const bare = nightOps(nightSkinView(run, { record }), art, { ops: [], cam: { x: 0, y: 0, w: 160, h: 160 } });
            expect(bare.ops.filter((o) => o.key === key || mine.nightExtra.includes(o))).toEqual([]);
        });
    }
});

describe('3. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `pickup-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts));
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ...TAPES.map((t) => [`the skin dropped (${t.name})`, t.name, { drop: true }]),
        // (the r3 tapes run with the game clock unknown — `gameTime` null, frame 0 — so the clock's mutants ride live clocks)
        ['frame: 0 always (BossKey 1)', 'L29-bosskey1', { rules: { frame: () => 0 } }],
        ['no wand bob (Fire Wand)', 'L109-firewand', { rules: { bob: () => 0 } }],
        ['no health spin', 'L68-health', { rules: { spin: () => 0 } }],
        ['the ceremony not risen (drawn on its cell)', 'L10-sword', { rules: { risen: (p) => ({ x: p.x, y: p.y }) } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(0), 240_000);
});

describe('4. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('pickupSkinView wrote to the run'); }, defineProperty: () => { throw new Error('pickupSkinView defined on the run'); } });

    it('maps the pickups, the taken, the ceremony and the wand gate; a write anywhere throws', () => {
        const pk = (tag, x, y, extra = {}) => frozen({ tag, x, y, rect: frozen({ x: x + 4, y: y + 4, right: x + 12, bottom: y + 12 }),
            cls: frozen({ pickup: frozen({ h: 8, originY: 4 }) }), ...extra });
        const run = frozen({ level: 43, gameTime: 5, state: frozen({ x: 150, y: 220 }), transitions: [], playerDeaths: [],
            world: frozen({ pickups: [pk('wand', 144, 224), pk('sword', 0, 0), pk('bosskey', 32, 0, { keyType: 2 })] }),
            takenPickups: new Set(['pickup:sword@0,0']), wandFades: [], ceremonyNow: frozen({ tag: 'wand', level: 43, runtime: false }) });
        const v = pickupSkinView(run);
        expect(v.taken).toBe(1);
        expect(v.pickups.map((p) => [p.tag, p.x, p.y, p.held, p.hidden, p.keyType])).toEqual([
            ['wand', 152, 232, true, true, undefined], ['bosskey', 40, 8, false, false, 2]]);
        expect(pickupSkinView(null)).toBe(null);
    });
});

describe('5. ⛔ STATE IDENTITY — the pickup renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers, the stateLog and stateDigest identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const v = pickupSkinView(run);
                skin = stepPickupSkin(skin, v, tick);
                drawn += pickupOps(v, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
            expect(on.digest).toBe(off.digest);
        }, 240_000);
    }
});

describe('6. THE AP LOOK — an AP slot is an `apitem`, drawn by G3, never by this skin', () => {
    /** L10 with its sword slot rewritten to an `apitem` holding `look` (what `apPlacementRewriter` writes). */
    const apRun = (look) => {
        const levels = MAP.levels.map((l) => (l.level !== 10 ? l : {
            ...l, entities: l.entities.map((e) => (e.type !== 'sword' ? e : { ...e, type: 'apitem', attrs: { ...e.attrs, look } })),
        }));
        return createLevelRun({ levelSource: levelSourceFromAtlas({ ...MAP, levels }), boot: { level: 10, x: 48, y: 80 }, noDamage: true });
    };

    it('vanilla L10: the Sword drawn by this skin; the stand-in skipped only through `drawnPickups`', () => {
        const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 10, x: 48, y: 80 }, noDamage: true });
        run.advance(new Set());
        const ops = pickupOps(pickupSkinView(run), art);
        expect(ops.map((o) => o.key)).toEqual(['seedling:pickup/sword']);
        const stand = (o) => !o.sheetRef && o.colour === '#e8c040' && o.alpha === 0.5;
        expect(roomOps(run.world, art, { level: 10 }).filter(stand)).toHaveLength(1);
        expect(roomOps(run.world, art, { level: 10, drawnPickups: (p) => PICKUP_TAGS.has(p.tag) }).filter(stand)).toHaveLength(0);
    });

    for (const [look, key] of [['sword', 'seedling:pickup/sword'], ['ap', 'archipelago:pickup/item']]) {
        it(`an AP slot holding "${look}": no vanilla pickup here; G3 draws ${key} on frame 0`, () => {
            const run = apRun(look);
            for (let i = 0; i < 20; i += 1) run.advance(new Set());
            expect(pickupOps(pickupSkinView(run), art)).toEqual([]);
            const ap = run.world.apItems;
            expect(ap).toHaveLength(1);
            const [op] = apItemOps(ap, art, '#e8c040');
            expect([op.key, op.frame, op.nightCopy]).toEqual([key, 0, undefined]);
        });
    }
});
