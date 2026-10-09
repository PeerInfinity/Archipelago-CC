/**
 * SEEDLING FIDELITY WALLFLYER — the WallFlyer's death (W6, `contactFidelity.wallFlyerKill`) and the moving shield's
 * turn of one (W7, `wallFlyerShieldBump`), replayed against the game in node.
 *
 * `fixtures/wallflyer-witness/<tape>.json` holds the GAME's WallFlyer rows (`botMobiles()`, p4f headless) at every
 * sampled tick of the witness tapes (`scripts/procgen/probe-seedling-wallflyer-mobiles.mjs --record`), authored by
 * `scripts/procgen/plan-seedling-wallflyer.mjs`. At the shipped defaults the model reproduces every body — position,
 * velocity, `hits`/`hits_timer`, the "die" anim and its index, `destroy`, alpha and presence — at every sampled tick.
 * With a switch OFF the BEFORE model returns: the kill is refused by its old words, and the shield turns nothing.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { CORPSE_COUNTING, KILL_ARM_POLICY, KILL_SIDE_WRITES, removalTicksAfterHit } from './enemyDamage.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createTapeStepper } from './tapeRunner.js';
import { WALLFLYER, wallFlyerDeathTicks } from './wallFlyer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'wallflyer-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

const levelSource = atlasLevelSource();

/** The model's run after each tick of a committed tape (index 0 = boot), and the run itself at the end. */
function replay(name) {
    let run = null;
    const st = createTapeStepper(loadTape(name), { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = run ? run.wallFlyers.bodies.map((b) => ({ ...b })) : [];
        r = st.next();
    }
    return { col, run };
}

/** The probe's join: the cheapest assignment of the game's rows to the model's LIVE bodies. */
function join2(game, live) {
    const cost = (g, b) => Math.hypot(g.x - b.x, g.y - b.y)
        + (g.hits !== b.hits ? 1000 : 0) + (g.hits_timer !== b.hitsTimer ? 1000 : 0);
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)])
        .map((p) => [x, ...p])));
    let best = Infinity;
    let pairing = [];
    for (const p of perms(live)) {
        const c = game.reduce((s, g, i) => s + cost(g, p[i]), 0);
        if (c < best) { best = c; pairing = p.slice(0, game.length); }
    }
    return pairing;
}

/** Every disagreement between the game's samples and the model's bodies, as strings. */
function disagreements(w, col) {
    const out = [];
    for (const s of w.samples) {
        const live = (col[s.t] ?? []).filter((b) => !b.removed);
        if (s.bodies.length !== live.length) {
            out.push(`t ${s.t}: game ${s.bodies.length} rows, model ${live.length} live`);
            continue;
        }
        const pairing = join2(s.bodies, live);
        s.bodies.forEach((g, i) => {
            const b = pairing[i];
            const dying = b.dieAnim !== null && !b.destroy;
            const bad = [
                g.x !== b.x || g.y !== b.y || g.vx !== b.vx || g.vy !== b.vy ? 'pos/v' : null,
                g.hits !== b.hits || g.hits_timer !== b.hitsTimer ? 'hits' : null,
                g.destroy !== b.destroy ? 'destroy' : null,
                (g.anim === 'die') !== dying ? 'anim' : null,
                g.anim === 'die' && g.anim_index !== b.dieAnim.index ? 'die index' : null,
                g.alpha !== b.alpha ? 'alpha' : null,
            ].filter(Boolean);
            if (bad.length) out.push(`t ${s.t} ${b.id}: ${bad.join(', ')}`);
        });
    }
    return out;
}

describe('the switches and the tables', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('W6 and W7 ship ON', () => {
        expect(CONTACT_FIDELITY.wallFlyerKill).toBe(true);
        expect(CONTACT_FIDELITY.wallFlyerShieldBump).toBe(true);
    });
    it('`KILL_ARM_POLICY.WallFlyer` answers W6 at call time', () => {
        withContactFidelity({ wallFlyerKill: false }, () => {
            expect(KILL_ARM_POLICY.WallFlyer.policy).toBe('refused');
            expect(KILL_ARM_POLICY.WallFlyer.why).toBe('the Bob cost; off every R5 route');
        });
        withContactFidelity({ wallFlyerKill: true }, () => {
            expect(KILL_ARM_POLICY.WallFlyer.policy).toBe('modelled');
        });
    });
    it('the death is `anim+fade`, writes nothing, and its removal is the die anim plus the fade', () => {
        expect(CORPSE_COUNTING.WallFlyer).toMatchObject({ shape: 'anim+fade', removesBody: true, chaserTag: null });
        expect(KILL_SIDE_WRITES.WallFlyer.writes).toBe('none');
        // `add("die", [5, 6, 7, 8], 10)` — four frames, measured on the game below as 13 graphic updates
        expect(WALLFLYER.dieAnimFrames).toBe(4);
        expect(wallFlyerDeathTicks()).toBe(13);
        expect(removalTicksAfterHit('WallFlyer', wallFlyerDeathTicks())).toBe(24);
    });
});

describe('the game witnesses (fixtures/wallflyer-witness/)', () => {
    it('three tapes, each recorded on the game', () => {
        expect(WITNESSES.map((w) => w.tape).sort()).toEqual(['wallflyer-kill', 'wallflyer-kill-flight', 'wallflyer-shield-bump']);
        for (const w of WITNESSES) expect(w.samples.length).toBe(loadTape(w.tape).tick_count + 1);
    });

    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY).each(WITNESSES.map((w) => [w.tape, w]))(
        '%s — the shipped defaults reproduce every game body at every sampled tick', (name, w) => {
            const { col } = replay(name);
            expect(disagreements(w, col)).toEqual([]);
        },
    );

    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('⛓ the rest kill: "die" on the press, `destroy` 14 later, removed 25 after the blow', () => {
        const { run } = replay('wallflyer-kill');
        const ev = run.wallFlyers.events.filter((e) => e.id === 'wallflyer@64,80' && e.kind !== 'struck');
        expect(ev.map((e) => [e.kind, e.t])).toEqual([['killed', 65], ['destroyed', 79], ['removed', 90]]);
        // the game's count falls 4 -> 3 between t 89 and t 90
        const w = WITNESSES.find((x) => x.tape === 'wallflyer-kill');
        expect(w.samples.find((s) => s.t === 89).bodies).toHaveLength(4);
        expect(w.samples.find((s) => s.t === 90).bodies).toHaveLength(3);
        // the press fencepost: the die anim's first update is the tick AFTER the blow (the Player updates last)
        expect(90 - 65).toBe(removalTicksAfterHit('WallFlyer', wallFlyerDeathTicks()) + 1);
    });

    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('⛔ the in-flight kill: the corpse keeps flying until `endAnim` sets `destroy`', () => {
        const { col, run } = replay('wallflyer-kill-flight');
        const kill = run.wallFlyers.events.find((e) => e.kind === 'killed');
        expect(kill).toMatchObject({ t: 85, id: 'wallflyer@64,80', vx: 4, x: 79 });
        expect(Math.abs(kill.vy)).toBe(0);
        const at = (t) => col[t].find((b) => b.id === 'wallflyer@64,80');
        expect(at(98).destroy).toBe(false);
        expect(at(98).x).toBeGreaterThan(at(86).x + 40);
        expect(at(99)).toMatchObject({ destroy: true, x: 131 });
        expect(at(105).x).toBe(131);
    });

    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('⛓ the shield turns the flying body on the ticks its box touches it', () => {
        const { run } = replay('wallflyer-shield-bump');
        const turns = run.shieldBumps.filter((r) => r.family === 'wallflyer' && r.shoved).map((r) => r.t);
        expect(turns).toEqual([5, 7, 9, 13]);
    });
});

describe('OFF is the BEFORE model', () => {
    it('W6 OFF: the killing press refuses by the W2 words, verbatim', () => {
        withContactFidelity({ wallFlyerKill: false }, () => {
            expect(() => replay('wallflyer-kill')).toThrow(/the sword press at tick 64 KILLS wallflyer@64,80 in level 22\. `WallFlyer\.startDeath` plays "die"; its die anim, its fade and its place in `totalEnemies\(\)` are not staged for this class\. Refused by name \(seedling-fidelity-terrain W2\)\./);
        });
    });
    it('W7 OFF: no wallflyer is asked, and the game\'s body leaves the model at the first turn', () => {
        withContactFidelity({ wallFlyerShieldBump: false }, () => {
            const { col, run } = replay('wallflyer-shield-bump');
            expect(run.shieldBumps.filter((r) => r.family === 'wallflyer')).toEqual([]);
            const w = WITNESSES.find((x) => x.tape === 'wallflyer-shield-bump');
            expect(disagreements(w, col)[0]).toMatch(/^t 5 wallflyer@48,112: pos\/v/);
        });
    });
});
