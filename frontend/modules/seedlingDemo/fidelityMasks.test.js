/**
 * Seedling fidelity MASKS (wave 25): `collideLine("Solid", …)` samples the "Solid" PIXELMASKS for every reader whose
 * game line can meet one, behind `CONTACT_FIDELITY.pixelMaskSightLines` (OFF).
 *
 *   · W0 (`CC/docs/cloud-reports/seedling-fidelity-masks-evidence/`): the game's "Solid" line tests are five —
 *     `Player.slash` (`Player.as:917`), `Crusher.as:58`, `Drill.as:86`, `Spinner.as:82` (`runRange` 0: moot) and
 *     `LavaTrap.as:88` (no reader: the tongue's launch is not stepped). Every other line (a spinner's hammer, a
 *     wallflyer's ray, the BobBoss swords, a chest's probe, a spinning axe) is of type "Player" and never meets a mask.
 *     No crusher shares a level with a mask. Masks lie on swing lines beside the movers of L12, L27, L28, L65, L88,
 *     L91, L92, L99, L100, and on L57's tentacles (the beast's own body).
 *   · D1 (the game): `fixtures/mask-witness/` (`probe-seedling-mask-lines.mjs --record`, p4g), replayed here against
 *     the model with the key ON at 0 px.
 *   · D2 (the model): `levelRun.collideLineSolid`'s `{masks}` (DRILL's sampler), passed by the drill (a lone one's
 *     too), the wallflyer, the corridor body forecast and the tentacle arms (the beast's by-name interim retires), and
 *     the solver's chaser / drill mirrors; the chaser arm of `applyThrust` gains the line it never asked (boxes and
 *     masks). The spinner family (the hammer arc's forecast and strike line, and the executor that must agree with
 *     them) stays on the boxes — handed over (L92 holds a spinner beside CliffSides).
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 the chaser arm asks no line (`lineBlocker` always null)
 *        -> `mask-l65-wall` reds at t5 (the bob is knocked back where the game's is not).
 *   m2 the line's mask filter keeps the OpenTree
 *        -> `mask-l65-opentree` reds at t89 (the model refuses the t87-89 swings the game lands).
 *   m3 the bounding prefilter drops a mask it must keep (`p.maskX + p.mask.w > lx0` → `p.maskX > lx0`)
 *        -> the prefilter row reds.
 *   m4 the key's OFF arm samples masks (`withMasks = true`)
 *        -> the byte-inertia row reds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { maskHitsBox } from './levelWorld.js';
import { ropeStaging } from './fidelityRope.js';
import { compareDrillWitness } from './fidelityDrill.js';
import { MASK_SWITCHES, MASK_WITNESS_DIR, MASK_WITNESSES, maskModelSamples } from './fidelityMasks.js';

const SRC = atlasLevelSource();
const load = (name) => JSON.parse(readFileSync(join(MASK_WITNESS_DIR, `${name}.json`), 'utf8'));
const runAt = async (level, x, y) => createRunForStaging(await ropeStaging({ boot: { level, x, y },
    items: ['hasSword'], persistence: [] }), SRC);

/** The line without the prefilter: every "Solid" mask but the OpenTree, every sample (the reference). */
function bruteMaskLine(world, fx, fy, tx, ty) {
    const masks = world.pixelmasks.filter((p) => p.cls?.type === 'Solid' && p.cls.as3 !== 'OpenTree');
    const at = (px, py) => masks.find((p) => maskHitsBox(p.mask, p.maskX, p.maskY,
        { x: px, y: py, right: px + 1, bottom: py + 1 })) ?? null;
    [fx, fy, tx, ty] = [fx, fy, tx, ty].map(Math.trunc);
    if (Math.hypot(tx - fx, ty - fy) < 1) return at(fx, ty);
    const xD = Math.abs(tx - fx);
    const yD = Math.abs(ty - fy);
    let xs = tx > fx ? 1 : -1;
    let ys = ty > fy ? 1 : -1;
    let x = fx;
    let y = fy;
    if (xD > yD) {
        ys *= yD / xD;
        while (xs > 0 ? x < tx : x > tx) { const s = at(x, y); if (s) return s; x += xs; y += ys; }
    } else {
        xs *= xD / yD;
        while (ys > 0 ? y < ty : y > ty) { const s = at(x, y); if (s) return s; x += xs; y += ys; }
    }
    return null;
}

describe('fidelity MASKS — the switch', () => {
    it('is OFF by default', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.pixelMaskSightLines).toBe(false);
    });
});

describe('fidelity MASKS — D2: `collideLineSolid`\'s `{masks}`', () => {
    it('L28: the line drill@128,96 → (164,113) crosses the CliffSide at (160,112)\'s pixels only with `{masks: true}`', async () => {
        const run = await runAt(28, 96, 64);
        expect(run.collideLineSolid(136, 104, 164, 113)).toBeNull();
        expect(run.collideLineSolid(136, 104, 164, 113, { masks: true })).toEqual({ tag: 'cliffside2',
            at: { x: 161, y: expect.closeTo(112.0357, 3) } });
    });

    it('an OpenTree is type "Tree" (`Scenery/Tree.as:22`): never a blocker, masks or not', async () => {
        const run = await runAt(65, 192, 40);
        const ot = run.world.pixelmasks.find((p) => p.cls.as3 === 'OpenTree');
        expect(ot).toBeTruthy();
        // (200,48) is an opaque pixel of L65's OpenTree (its top-left row)
        expect(maskHitsBox(ot.mask, ot.maskX, ot.maskY, { x: 200, y: 48, right: 201, bottom: 49 })).toBe(true);
        expect(run.collideLineSolid(200, 48, 212, 72, { masks: true })).toBeNull();
    });

    it('the bounding prefilter answers what every mask, every sample answers (L12, L28, L91: 3,000 lines each)', async () => {
        for (const [level, x, y] of [[12, 232, 808], [28, 96, 64], [91, 120, 72]]) {
            const run = await runAt(level, x, y);
            const w = run.world;
            let seed = level * 7919;
            const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
            const m = w.pixelmasks.filter((p) => p.cls?.type === 'Solid');
            let met = 0;
            for (let i = 0; i < 3000; i += 1) {
                const p = m[rnd(m.length)];
                const fx = p.maskX - 24 + rnd(p.mask.w + 48) + rnd(100) / 100;
                const fy = p.maskY - 24 + rnd(p.mask.h + 48) + rnd(100) / 100;
                const tx = fx - 40 + rnd(80);
                const ty = fy - 40 + rnd(80);
                const ref = bruteMaskLine(w, fx, fy, tx, ty);
                const got = run.collideLineSolid(fx, fy, tx, ty, { masks: true });
                // the boxes answer first in the run's line: compare only where they are clear
                if (run.collideLineSolid(fx, fy, tx, ty) !== null) continue;
                expect(got?.at ?? null, `L${level} (${fx},${fy})→(${tx},${ty})`)
                    .toEqual(ref ? got?.at ?? 'a blocker' : null);
                if (ref) met += 1;
            }
            expect(met).toBeGreaterThan(20);
        }
    });

    it('byte-inertia: the key OFF, a four-argument line reads the boxes alone', async () => {
        const run = await runAt(28, 96, 64);
        withContactFidelity({ pixelMaskSightLines: false }, () => {
            expect(run.collideLineSolid(136, 104, 164, 113)).toBeNull();
        });
        withContactFidelity({ pixelMaskSightLines: true }, () => {
            // the default stays the boxes even ON: a reader opts in (the spinner family does not — handed over)
            expect(run.collideLineSolid(136, 104, 164, 113)).toBeNull();
        });
    });
});

describe('fidelity MASKS — D1: the game witnesses (p4g), replayed at 0 px with the key ON', () => {
    it('the witness set is the module\'s', () => {
        expect(MASK_WITNESSES.map((w) => w.name)).toEqual(['mask-l65-opentree', 'mask-l65-wall']);
    });

    it.each(MASK_WITNESSES.map((w) => [w.name, w]))('%s: 0 px with the key ON', async (name) => {
        const rec = load(name);
        const model = await maskModelSamples(rec.tape);
        expect(model.error).toBeNull();
        expect(compareDrillWitness(rec.samples, model.samples, rec.tape.boot.level)).toEqual([]);
    });

    it('mask-l65-wall: OFF, the chaser arm asks no line and knocks the bob back at t3; the game does not', async () => {
        const rec = load('mask-l65-wall');
        const off = await maskModelSamples(rec.tape, { ...MASK_SWITCHES, pixelMaskSightLines: false });
        const bad = compareDrillWitness(rec.samples, off.samples, 65);
        expect(bad[0]).toMatch(/^t 5 bob@208,80/);
        const on = await maskModelSamples(rec.tape);
        expect(on.pressHits.find((h) => h.t === 3)?.why).toBe('collideLine("Solid") meets tile:Body Wall at (224, 80)');
    });

    it('mask-l65-opentree (a control): OFF reproduces the game too, and the t87-89 swings land ON', async () => {
        const rec = load('mask-l65-opentree');
        const off = await maskModelSamples(rec.tape, { ...MASK_SWITCHES, pixelMaskSightLines: false });
        expect(compareDrillWitness(rec.samples, off.samples, 65)).toEqual([]);
        const on = await maskModelSamples(rec.tape);
        expect(on.pressHits.filter((h) => h.t >= 87 && h.t <= 89).some((h) => h.landed)).toBe(true);
    });
});
