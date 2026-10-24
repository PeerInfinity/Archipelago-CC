/**
 * Seedling fidelity MISCRES (wave 29): the small residues.
 *
 * D1 — REMBODY's residue, two switches (both OFF):
 *   `forecastCorpseFade`     `chaserForecastNow` steps a cloned corpse's fade (and a cloned "die" anim to `destroy`), so
 *                            a corpse stops being a sibling wall where the live run (the game) removes it. WITNESSED on p4g
 *                            by SKINSWING's `skinswing-l71-resite` (the forecast seeded at t58, the tape's presses mirrored
 *                            through the forecast's own `hit`).
 *   `nonChaserRemovalBlocks` a drill, wallflyer or ice turret removed this tick stays an "Enemy" wall to the movers stepped
 *                            after it this tick (`World.remove` queues). NO game witness reaches it (no AP_1 recording has
 *                            such a removal beside a later "Enemy" mover); the DRILLKILL p4g recordings, whose drills fade
 *                            out, are the byte-inertia rows: ON = OFF = the game.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore; `evidence/mutants.txt`) ──
 *   m1 the forecast's destroy branch never fades (`c.alpha -= …` dropped)
 *        predicted: the t58 row reds.  MEASURED: 2 red — the t58 row and the t50..t62 seeds row.
 *   m2 the forecast never steps the clone's "die" anim to `destroy`
 *        predicted: nothing reds.  MEASURED: 1 red — the t50 seed clones bodies still in "die", so the anim arm IS
 *        witnessed (my prediction read only the t58 seed, where every corpse is already `destroy`).
 *   m3 `removedThisTickStillBlocks` ignores the tick (a removed body is a wall forever)
 *        predicted: the drill rows red.  MEASURED: 0 red — no recording has a drill hop (or a chaser sweep) into a dead
 *        drill's box, so `nonChaserRemovalBlocks` has NO discriminating row: it is the game's rule transcribed, unwitnessed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SKINSWING_WITNESS_DIR, compareSkinSwing, skinSwingModelSamples } from './fidelitySkinSwing.js';
import { DRILLKILL_WITNESS_DIR, DRILLKILL_WITNESSES, DRILLKILL_SWITCHES, compareDrillKillWitness, drillKillModelSamples }
    from './fidelityDrillKill.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { ENTITY_CLASSES } from './levelWorld.js';
import { arrivalStaging } from './fidelityArrival.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveAnytime, ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const loadSkin = (name) => JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, `${name}.json`), 'utf8'));
const loadDrill = (name) => JSON.parse(readFileSync(join(DRILLKILL_WITNESS_DIR, `${name}.json`), 'utf8'));

/**
 * The chaser forecast taken at tick `from` of `skinswing-l71-resite`, stepped beside the live run (the game at 0 px
 * with `removedBodyBlocks` ON) for `n` ticks. The tape presses the sword; a live body whose `hits` rose this tick takes
 * the same press in the forecast (`hit(id, playerPos)`, the strike policy's own call, from the start-of-tick player).
 * @returns {Array<{t, live, proj, worst}>} per tick: live bodies (not removed, not destroyed), projected, the worst px
 */
function forecastBesideLive(over, from, n) {
    const rec = loadSkin('skinswing-l71-resite');
    return withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)),
            { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (r.value.observation.t < from) r = st.next();
        const fc = run.chaserForecast();
        const rows = [];
        for (let t = from + 1; t <= from + n; t += 1) {
            const before = { ...run.state };
            const hitsBefore = new Map(run.chasers.map((c) => [c.id, c.hits]));
            const proj = fc.step(before);
            r = st.next();
            for (const c of run.chasers) {
                if (!c.removed && c.hits > (hitsBefore.get(c.id) ?? c.hits)) fc.hit(c.id, before);
            }
            const live = run.chasers.filter((c) => !c.removed && !c.destroy);
            let worst = 0;
            for (const c of live) {
                const f = proj.find((p) => p.id === c.id);
                worst = Math.max(worst, f ? Math.max(Math.abs(f.x - c.x), Math.abs(f.y - c.y)) : Infinity);
            }
            rows.push({ t, live: live.length, proj: proj.length, worst });
        }
        return rows;
    });
}
const firstOff = (rows) => rows.find((r) => r.worst > 1e-9) ?? null;

describe('fidelity MISCRES D1 — the switches', () => {
    it('both ship OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.forecastCorpseFade).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.nonChaserRemovalBlocks).toBe(false);
    });
});

describe('fidelity MISCRES D1 — `forecastCorpseFade`: the L71 resite witness (p4g), forecast against live', () => {
    // t58: three corpses fading (removed on t63, the game's frame); t95 the room restarts (the player died) — no forecast
    // follows a restart, so the window ends at t94.
    it('seeded at t58: ON the forecast equals the live run (= the game) through t94; OFF it leaves at t64', () => {
        const on = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: true }, 58, 36);
        expect(firstOff(on)).toBeNull();
        const off = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: false }, 58, 36);
        const o = firstOff(off);
        expect(o.t).toBe(64);
        expect(o.worst).toBeCloseTo(1.164, 3);
        expect(Math.max(...off.map((r) => r.worst))).toBeGreaterThan(8);
    });
    it('seeded at t50..t62 (the corpses cloned while fading): ON holds 0 px to t94 from every seed', () => {
        for (const from of [50, 55, 60, 62]) {
            const on = forecastBesideLive({ removedBodyBlocks: true, forecastCorpseFade: true }, from, 94 - from);
            expect([from, firstOff(on)]).toEqual([from, null]);
        }
    });
    it('the live run is untouched by the switch: ON the model is the game for all 300 ticks', async () => {
        const rec = loadSkin('skinswing-l71-resite');
        const on = await skinSwingModelSamples(rec.tape, { removedBodyBlocks: true, forecastCorpseFade: true });
        expect(on.error).toBeNull();
        expect(compareSkinSwing(rec.samples, on.samples)).toEqual([]);
    });
});

describe('fidelity MISCRES D1 — `nonChaserRemovalBlocks`: the DRILLKILL recordings (p4g), byte-inert where no mover meets the corpse', () => {
    const ONK = { ...DRILLKILL_SWITCHES, nonChaserRemovalBlocks: true };
    it.each(DRILLKILL_WITNESSES.map((w) => [w.name]))('%s: ON the model is still the game on every sampled tick', async (name) => {
        const rec = loadDrill(name);
        const model = await drillKillModelSamples(rec.tape, ONK);
        expect(model.error).toBeNull();
        expect(compareDrillKillWitness(rec.samples, model.samples, rec.tape.boot.level)).toEqual([]);
    }, 120000);
    it('a drill\'s removal is stamped with its tick ON (and read on that tick only); OFF no stamp is written', () => {
        const w = DRILLKILL_WITNESSES.find((x) => x.boot.x === 16 && x.script.goals);
        const rec = loadDrill(w.name);
        const stamps = (over) => withContactFidelity(over, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)),
                { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            const out = [];
            let r = st.next();
            const seen = new Set();
            while (!r.done) {
                for (const d of run?.drills.bodies ?? []) {
                    if (d.removed && !seen.has(d.id)) { seen.add(d.id); out.push({ id: d.id, t: r.value.observation.t, stamp: d.removedTick ?? null }); }
                }
                r = st.next();
            }
            return out;
        });
        const on = stamps(ONK);
        expect(on.length).toBe(2);
        for (const s of on) expect(s.stamp).toBe(s.t);
        expect(stamps({ ...DRILLKILL_SWITCHES, nonChaserRemovalBlocks: false }).map((s) => s.stamp)).toEqual([null, null]);
    }, 120000);
});

/**
 * D3 — three unowned model rows, read in the AS3; NONE moves the model, so each is a pinned fact.
 *   opentree  `ENTITY_CLASSES.opentree.type` is "Solid"; the game's class is `Tree` (`Scenery/Tree.as:24` writes
 *             `type = "Tree"`, `OpenTree.as` never re-types it). The one model reader that branches on a pixelmask's type
 *             is `collideLineSolid`, which exempts the class by name (fidelity MASKS, witnessed on p4g:
 *             `mask-l65-opentree`). Every other pixelmask reader (`collidesSolid`, `collidesBlast`, `collidesArrowCover`)
 *             tests the mask whatever its type, and each AS3 list it mirrors carries "Tree" (`Mobile.solids`,
 *             `IceTurretBlast`/`Arrow`/`TurretSpit`/`LavaBall` `hitables`). The AS3 readers that ask "Solid" but not
 *             "Tree" (`Chest`, `Pole`, `Pull`, the locks, `Droplet`, `Crusher`, `Stick`, `BossTotemShot`) never meet an
 *             opentree box: pinned below by the rooms' geometry.
 *   owl       `Game.talkingPic` is read only by `Game.render`'s talk box (`Game.as:1726-1735`). The owl's talk IS
 *             modelled: `FinalBoss.update`'s `if (!started)` freezes the room (`finalBossFight.introFreeze`) until
 *             `Input.released(keys[6])` (`levelRun`'s `introRelease`). `run.talkingNow` does not name it (render only:
 *             handed to the JS skin).
 */

describe('fidelity MISCRES D3 — `opentree` is typed "Solid", the game says "Tree": no model reader can tell', () => {
    it('the model row keeps "Solid" and names the class; the sight line exempts it by class', () => {
        expect(ENTITY_CLASSES.opentree.as3).toBe('OpenTree');
        expect(ENTITY_CLASSES.opentree.type).toBe('Solid');
        expect(ENTITY_CLASSES.opentree.collider).toBe('pixelmask');
        expect(ENTITY_CLASSES.treebare.type).toBe('Tree');
    });
    it('the opentrees stand in L12, L27, L65 — and no "Solid"-only AS3 reader of those rooms meets one\'s box (±1 px)', () => {
        const SOLID_ONLY = ['chest', 'pole', 'pull', 'bosslock', 'lock', 'rocklock', 'cover', 'button', 'buttonroom',
            'crusher', 'stick', 'bosstotem', 'pulser'];
        const levels = [];
        for (const r of loadAtlas().levels) {
            const trees = r.entities.filter((e) => e.type === 'opentree');
            if (trees.length === 0) continue;
            levels.push(r.level);
            for (const tr of trees) {
                const box = { x: tr.x - 1, y: tr.y - 1, right: tr.x + 33, bottom: tr.y + 33 };
                for (const e of r.entities.filter((x) => SOLID_ONLY.includes(x.type))) {
                    const eb = { x: e.x, y: e.y, right: e.x + 16, bottom: e.y + 16 };
                    const meets = eb.x < box.right && box.x < eb.right && eb.y < box.bottom && box.y < eb.bottom;
                    expect([r.level, `${e.type}@${e.x},${e.y}`, meets]).toEqual([r.level, `${e.type}@${e.x},${e.y}`, false]);
                }
            }
        }
        expect(levels).toEqual([12, 27, 65]);
    });
});

describe('fidelity MISCRES D3 — the owl\'s talk (`Game.talkingPic`): modelled as the intro freeze; the portrait is render only', () => {
    it('L112: the Owl stands frozen until a primary release, and `talkingNow` does not name him (handed to the skin)', () => {
        const st0 = arrivalStaging({ level: 112, x: 32, y: 208 }, { items: ['hasSword'] });
        const run = createRunForStaging({ ...st0, rng: { ...(st0.rng ?? {}), seed: 1234567, split: true } }, atlasLevelSource());
        for (let t = 0; t < 5; t += 1) {
            run.advance(new Set());
            expect(run.finalBosses.map((b) => [b.started, b.x, b.y])).toEqual([[false, 72, 104]]);
            expect(run.talkingNow).toBeNull();
        }
        run.advance(new Set(['primary']));
        run.advance(new Set());
        expect(run.finalBosses[0].started).toBe(true);
        expect(run.owlTicks.some((r) => r.phase === 'intro')).toBe(true);
    });
});

/**
 * D3 — IGFADE's leg 650 (`level_76 <- in_L77_0_32 -> exit:out_teleporter_0_80`; id 637 at this base): its verdict is a
 * function of the ARRIVAL CLOCK. The request is the page's own (captured by the local sweep at seam 5603, p4g, inv,
 * solver; `fixtures/miscres/leg637-l76-request.json.gz`). OFF the phase arm stalls only near `lavachain@128,64`'s
 * doorstep, inside the range of L76's type-31 tile (8,6), so every phase-shifting stall turns the tile: 18 of 61 clocks
 * (5573..5590) solve, the rest run out of the 640 / 2,560 budgets at `phase-dodge` (unbudgeted: refused after 11,726
 * units). `phaseDodgeArrivalStall` asks a stall at the walk's start first in such a room: 61 / 61 clocks solve within 640.
 *   m4 the key's `unshift(0)` dropped -> the ON row reds (= OFF).   m5 the igneous gate dropped (every room) -> nothing
 *   here reds (L76 holds the tiles; the gate is what bounds the movers to the igneous rooms — named, not pinned).
 */

const LEG637 = JSON.parse(gunzipSync(readFileSync(join(import.meta.dirname, 'fixtures', 'miscres',
    'leg637-l76-request.json.gz'))).toString('utf8'));
function solve637(over) {
    const req = restoreRequest(LEG637.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const answer = withContactFidelity(over, () => solveAnytime({ ...tape, source,
        levelSource: levelSourceFromAtlas(source.records) }, { passes }));
    return { seam: tape.staging.seam.time, budget: tape.budgetWork, ok: answer.ok,
        passes: (answer.passes ?? []).map((p) => ({ pass: p.pass, ok: p.ok, ticks: p.ticks, work: p.work, deadline: p.deadline ?? null })) };
}

describe('fidelity MISCRES D3 — `phaseDodgeArrivalStall`: IGFADE\'s leg 650 (L76), the page\'s own request', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.phaseDodgeArrivalStall).toBe(false);
    });
    it('OFF: the 640-unit request runs out at `phase-dodge` (the doorstep stalls light the type-31 tile)', () => {
        const r = solve637({ phaseDodgeArrivalStall: false });
        expect([r.seam, r.budget, r.ok]).toEqual([5603, 640, false]);
        expect(r.passes.map((p) => [p.pass, p.deadline])).toEqual([['dashless', 'phase-dodge'], ['full', 'walk']]);
    }, 120000);
    it('ON: the stall at the walk\'s start is asked first — both passes solve inside the 640 units', () => {
        const r = solve637({ phaseDodgeArrivalStall: true });
        expect(r.ok).toBe(true);
        expect(r.passes.map((p) => [p.pass, p.ok, p.ticks, p.work])).toEqual([
            ['dashless', true, 727, 94], ['full', true, 706, 180]]);
    }, 120000);
});
