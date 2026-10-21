/**
 * ⛓⛓ SEEDLING FIDELITY IGNEOUS — the Igneous-to-Lava tile (type 31), game-witnessed (wave 20; planning-9's finding:
 * sweep leg 649 dies on the game at t39 where the model walks on). One switch, OFF (`contactFidelity.igneousLava`).
 *
 *  - D1: five tapes on p4g headless (`fixtures/igneous-witness/`, each with the game's drained stream): leg 649's own,
 *    eight vs nine in-range renders (only the ninth breaks), a carried counter, a fresh stand, a restart's rebuild.
 *  - D2: `igneousLava.js` (the render's state machine) stepped by `levelRun.renderIgneousNow`, the lava written through
 *    the per-visit tile overlay. ON every witness is reproduced at 0 px, the deaths included; OFF each parts at its tick.
 *  - D3: `dangerMap.igneousDanger` (a box at a tick: a breaking tile's lava tick, a dwell that would break one) and
 *    `dangerMap.igneousWalkDanger` (the clocks replayed along a previewed walk, read by `solverBot`'s `probeSamples`).
 *    Survey step 195's OFF plan dies on it; its ON plan (`igneous-l76-survey195-on`) is witnessed on the game.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import {
    IGNEOUS, IGNEOUS_FRESH, igneousInRange, igneousRendersToLava, stepIgneousRender,
} from './igneousLava.js';
import { dangerAt, igneousWalkDanger } from './dangerMap.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'igneous-witness');
const tapeJson = (name) => JSON.parse(readFileSync(join(WIT, `${name}.tape.json`), 'utf8'));
const gameRows = (name) => JSON.parse(readFileSync(join(WIT, `${name}.game-obs.json`), 'utf8')).rows;

/** The model's observation stream for a witness, against the game's: the first tick off and the worst |Δ|. */
const compare = (name) => {
    const game = new Map(gameRows(name).map(([t, level, x, y]) => [t, { level, x, y }]));
    let run = null;
    const st = createTapeStepper(tapeJson(name), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let worst = 0;
    let first = null;
    let compared = 0;
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        const g = game.get(o.t);
        if (!g) continue;
        compared += 1;
        const d = g.level === o.level ? Math.max(Math.abs(g.x - o.x), Math.abs(g.y - o.y)) : Infinity;
        if (d > 0 && first === null) first = o.t;
        if (d > worst) worst = d;
    }
    return { compared, worst, first, run };
};

/** name → [the tick OFF parts from the game, the ON lava deaths' respawn ticks, the ON `lava` render ticks] */
const WITNESSES = {
    'igneous-l76-leg649': [39, [69], [38]],
    'igneous-l76-k8': [97, [127], [75]],
    'igneous-l76-k9-rebuild': [52, [82], [40, 140]],
    'igneous-l76-k4-stand': [109, [109], [78]],
    'igneous-l76-fresh-stand': [111, [111], [80]],
};

/** The OFF plan of survey step 195 (519 ticks): its first 40 ticks are leg 649's tape, so it dies ON at t39. */
const samplesOf = (name, upto) => {
    const t = tapeJson(name);
    const out = [];
    const st = createTapeStepper(t, { levelSource: atlasLevelSource() });
    for (let r = st.next(); !r.done && out.length < upto; r = st.next()) {
        const o = r.value.observation;
        if (o.t > 0) out.push({ tick: o.t, x: o.x, y: o.y });
    }
    return out;
};

const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_IGNEOUS_LAVA'];

describe('IGNEOUS — the state machine (`Tile.as:390-433`)', () => {
    it('the constants are the AS3\'s: counter 8, three frames (IgneousLava.png is 48x16), radius sqrt(512)/2, 31 → 17', () => {
        expect(IGNEOUS).toEqual({ type: 31, becomes: 17, counterMax: 8, frameCount: 3, radius: Math.sqrt(512) / 2 });
        expect(IGNEOUS_FRESH).toEqual({ counter: 8, breaking: false, frame: 0, lava: false });
    });

    it('in range from the CENTRE: d <= 11.3137 counts, d 11.75 does not', () => {
        const tile = { x: 40, y: 88 };
        expect(igneousInRange(tile, 29.5, 88)).toBe(true);
        expect(igneousInRange(tile, 40 - Math.sqrt(512) / 2, 88)).toBe(true);
        expect(igneousInRange(tile, 28.25, 88)).toBe(false);
    });

    it('a fresh tile turns on its 36th consecutive in-range render; 9 to break, then 27 with nobody near', () => {
        let s = IGNEOUS_FRESH;
        const events = [];
        for (let i = 1; i <= 9; i += 1) {
            const r = stepIgneousRender(s, true);
            s = r.state;
            if (r.event) events.push([i, r.event]);
        }
        expect(events).toEqual([[9, 'break']]);
        expect(igneousRendersToLava(s)).toBe(27);
        for (let i = 10; i <= 36; i += 1) {
            const r = stepIgneousRender(s, false);
            s = r.state;
            if (r.event) events.push([i, r.event]);
        }
        expect(events).toEqual([[9, 'break'], [18, 'frame'], [27, 'frame'], [36, 'lava']]);
        expect(s.lava).toBe(true);
        expect(igneousRendersToLava(IGNEOUS_FRESH)).toBe(36);
    });

    it('out of range before the break changes nothing — the counter is not reset', () => {
        let s = IGNEOUS_FRESH;
        for (let i = 0; i < 4; i += 1) s = stepIgneousRender(s, true).state;
        expect(stepIgneousRender(s, false).state).toBe(s);
        expect(s.counter).toBe(4);
        expect(igneousRendersToLava(s)).toBe(5 + 27);
    });
});

describe('IGNEOUS — the tile on the game (D1) and in the model (D2)', () => {
    it.skipIf(ENV.some((k) => process.env[k]))('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.igneousLava).toBe(false);
        expect(CONTACT_FIDELITY.igneousLava).toBe(false);
    });

    it.each(Object.entries(WITNESSES))('%s — OFF parts from the game at its tick; ON 0 px, the lava death included', (name, [offAt, deaths, lavaAt]) => {
        const off = withContactFidelity({ igneousLava: false }, () => compare(name));
        expect(off.first).toBe(offAt);
        expect(off.run.playerDeaths).toEqual([]);
        expect(off.run.igneousEvents).toEqual([]);
        expect(off.run.tileWrites.size).toBe(0);
        const on = withContactFidelity({ igneousLava: true }, () => compare(name));
        expect(on.compared).toBe(gameRows(name).length);
        expect(on.worst).toBe(0);
        expect(on.run.playerDeaths.map((d) => [d.t, d.source])).toEqual(deaths.map((t) => [t, 'lava']));
        expect(on.run.igneousEvents.filter((e) => e.event === 'lava').map((e) => [e.t, e.tile])).toEqual(
            lavaAt.map((t) => [t, '2,5']));
    });

    it('the query: `igneousTiles` is null OFF; ON it lists L76\'s 36 tiles with their clocks', () => {
        const name = 'igneous-l76-leg649';
        const t = parseTape(readFileSync(join(WIT, `${name}.tape.json`), 'utf8'));
        const offRun = withContactFidelity({ igneousLava: false }, () => createRunForStaging(stagingFromTape(t), atlasLevelSource()));
        expect(withContactFidelity({ igneousLava: false }, () => offRun.entities('igneousTiles'))).toBeNull();
        withContactFidelity({ igneousLava: true }, () => {
            const run = createRunForStaging(stagingFromTape(t), atlasLevelSource());
            for (let i = 0; i < 20; i += 1) run.advance(new Set(heldKeysAt(t, i)));
            const tiles = run.entities('igneousTiles');
            expect(tiles).toHaveLength(36);
            const under = tiles.find((x) => x.tx === 2 && x.ty === 5);
            // break at the t11 render; t12..t19 count the breaking counter 8 → 0, t20 steps frame 1
            expect(under).toMatchObject({ x: 40, y: 88, breaking: true, frame: 1, counter: 8, lava: false });
            expect(tiles.filter((x) => x.breaking).length).toBe(1);
        });
    });

    it('an arrival within range of an unturned tile refuses by name (the load fade\'s renders would count it)', () => {
        const t = tapeJson('igneous-l76-fresh-stand');
        // boot (24,80) lands (32,88): 8 px from tile (2,5)'s centre
        const staged = parseTape(JSON.stringify({ ...t, boot: { level: 76, x: 24, y: 80 } }));
        withContactFidelity({ igneousLava: true }, () => {
            const run = createRunForStaging(stagingFromTape(staged), atlasLevelSource());
            expect(() => run.advance(new Set())).toThrow(/arrival \(32, 88\) in level 76 is within 11\.31 px of Igneous-to-Lava tile \(2,5\)/);
        });
        withContactFidelity({ igneousLava: false }, () => {
            const run = createRunForStaging(stagingFromTape(staged), atlasLevelSource());
            expect(() => run.advance(new Set())).not.toThrow();
        });
    });
});

describe('IGNEOUS — the solver\'s pricing (D3)', () => {
    const fresh = () => {
        const t = parseTape(readFileSync(join(WIT, 'igneous-l76-leg649.tape.json'), 'utf8'));
        return createRunForStaging(stagingFromTape(t), atlasLevelSource());
    };

    it('the walk check names the tile and its clock where a dwell turns it under the walk (leg 649\'s 40 ticks)', () => {
        withContactFidelity({ igneousLava: true }, () => {
            const run = fresh();
            const hit = igneousWalkDanger(run, samplesOf('igneous-l76-leg649', 40));
            expect(hit).toMatchObject({ tick: 39, danger: true });
            expect(hit.sources).toEqual([expect.objectContaining({ kind: 'igneous', id: 'igneous@2,5', breakAt: 11, lavaAt: 38 })]);
            // the ON plan leaves (2,5) before its t38 render: clean over all 496 ticks
            expect(igneousWalkDanger(run, samplesOf('igneous-l76-survey195-on', 496))).toBeNull();
        });
        withContactFidelity({ igneousLava: false }, () => {
            expect(igneousWalkDanger(fresh(), samplesOf('igneous-l76-leg649', 40))).toBeNull();
        });
    });

    it('dangerAt: a WAIT that would break a tile in range is danger; a transit past an unbroken one is not', () => {
        withContactFidelity({ igneousLava: true }, () => {
            const run = fresh();
            const on = playerBoxAt(40, 88);
            const wait9 = dangerAt(run, 9, on, { mode: 'wait' });
            expect(wait9.sources.filter((x) => x.kind === 'igneous').map((x) => [x.id, x.breaksAt])).toEqual([['igneous@2,5', 9]]);
            expect(dangerAt(run, 8, on, { mode: 'wait' }).sources.some((x) => x.kind === 'igneous')).toBe(false);
            expect(dangerAt(run, 30, on, { mode: 'transit' }).sources.some((x) => x.kind === 'igneous')).toBe(false);
            // the start's own tile (1,5) is out of range of (2,5): (24,88) is 16 px from its centre
            expect(dangerAt(run, 60, playerBoxAt(24, 88), { mode: 'wait' }).sources.some((x) => x.kind === 'igneous')).toBe(false);
        });
    });

    it('dangerAt: a BREAKING tile is lava from its clock in both modes', () => {
        withContactFidelity({ igneousLava: true }, () => {
            const t = parseTape(readFileSync(join(WIT, 'igneous-l76-leg649.tape.json'), 'utf8'));
            const run = createRunForStaging(stagingFromTape(t), atlasLevelSource());
            for (let i = 0; i < 20; i += 1) run.advance(new Set(heldKeysAt(t, i)));
            // broken at the t11 render, frame 1 at t20: lava at the t38 render
            const on = playerBoxAt(40, 88);
            for (const mode of ['wait', 'transit']) {
                expect(dangerAt(run, 37, on, { mode }).sources.some((x) => x.kind === 'igneous')).toBe(false);
                const d = dangerAt(run, 38, on, { mode }).sources.filter((x) => x.kind === 'igneous');
                expect(d.map((x) => [x.id, x.lavaAt])).toEqual([['igneous@2,5', 38]]);
            }
        });
    });

    it('igneous-l76-survey195-on — the ON plan on the game: 0 px, no death, the snake crumbling behind it', () => {
        const on = withContactFidelity({ igneousLava: true }, () => compare('igneous-l76-survey195-on'));
        expect(on.compared).toBe(497);
        expect(on.worst).toBe(0);
        expect(on.run.playerDeaths).toEqual([]);
        expect(on.run.igneousEvents.filter((e) => e.event === 'lava').length).toBeGreaterThan(5);
        const off = withContactFidelity({ igneousLava: false }, () => compare('igneous-l76-survey195-on'));
        expect(off.worst).toBe(0);
    });
});
