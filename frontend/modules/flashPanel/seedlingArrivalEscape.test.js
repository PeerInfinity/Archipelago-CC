/**
 * ⛓ WAVE-6 CONSUMER — `seedlingArrivalEscape`: fidelity ARRIVAL's `arrival-inside-solid` refusal, its `wayOut`
 * translated to the AP's terms (the Restart offer; the other arrivals as AP exits of the committed playthrough).
 *
 * The refusal is the MODEL's own (a real `solveSegment` at L12's landing in L0, (288,176), the rock unbroken),
 * settled the way the worker settles it (`settleSolve`: plain data), so a field the solver renames reds here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { ARRIVAL_INSIDE_SOLID, isArrivalInsideSolid, doorXY, doorExitsOf, arrivalEscape } from './seedlingArrivalEscape.js';
import { ARRIVAL_INSIDE_SOLID as WALKER_KIND } from '../seedlingDemo/jsRuntimeWalker.js';
import { atlasLevelSource } from '../seedlingDemo/levelSource.js';
import { createRunForStaging } from '../seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../seedlingDemo/fidelityArrival.js';
import { solveSegment } from '../seedlingDemo/solverBot.js';
import { settleSolve } from '../seedlingDemo/jsRuntimeSolver.js';

const RULES = JSON.parse(readFileSync(fileURLToPath(new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json',
    import.meta.url)), 'utf8'));
/** regionId → `flash_seedling` payload: what the controller's atlas/vanilla map carries as `regions`. */
const REGIONS = new Map(Object.entries(RULES.preset_sidecars['1'])
    .filter(([, v]) => v.substrate === 'flash_seedling').map(([k, v]) => [k, v.playable_payload]));
const ruleExits = new Set(Object.values(RULES.regions['1']).flatMap((r) => (r.exits ?? []).map((x) => x.name)));

/** The solver's refusal at L12 → L0 (288,176), bare (the out-of-order arrival), as the worker settles it. */
function refusalAt(boot, exit) {
    const run = createRunForStaging(arrivalStaging(boot, { items: [], cleared: [] }), atlasLevelSource());
    return settleSolve(() => solveSegment({ run, goals: [{ kind: 'reach-exit', exit }], name: 'escape-row', boot }));
}

describe('seedlingArrivalEscape — the refusal, in the AP\'s terms', () => {
    const settled = refusalAt({ level: 0, x: 288, y: 176 }, { x: 304, y: 176 });

    it('the kind is ONE name: the model\'s refusal, the walker\'s constant and this module\'s agree', () => {
        expect(settled.ok).toBe(false);
        expect(settled.kind).toBe('refusal');
        expect(settled.obstacle.kind).toBe(ARRIVAL_INSIDE_SOLID);
        expect(WALKER_KIND).toBe(ARRIVAL_INSIDE_SOLID);
        expect(isArrivalInsideSolid(settled.obstacle)).toBe(true);
    });

    it('L0 (288,176): Restart offered; EVERY other arrival is an AP exit of the playthrough, none unmapped', () => {
        const e = arrivalEscape(settled.obstacle, REGIONS);
        expect(e).toMatchObject({ kind: ARRIVAL_INSIDE_SOLID, solids: ['breakablerock@288,176'],
            at: { level: 0, x: 296, y: 184 }, restart: true, unmapped: [] });
        expect(e.arrivals.map((a) => `L${a.from} ${a.door} = ${a.exit}`)).toEqual([
            'L2 stairs@48,16 = level_2 -> level_0__r8c0',
            'L13 stairs@64,144 = level_13 -> level_0__r8c0',
            'L86 teleporter@48,64 = level_86 -> level_0__r8c0',
            'L89 teleporter@160,304 = level_89__r11c12 -> level_0__r2c13',
            'L94 teleporter@304,160 = level_94__r2c16 -> level_0__r8c0',
            'L94 teleporter@304,176 = level_94__r2c16 -> level_0__r8c0 #2',
        ]);
        // each is a real rules exit, out of its region, landing in level 0 (never L12's door, which landed inside)
        for (const a of e.arrivals) {
            expect(ruleExits.has(a.exit), a.exit).toBe(true);
            expect(a.exit.startsWith(`${a.region} -> `)).toBe(true);
            expect(REGIONS.get(a.landing)?.level).toBe(0);
        }
        expect(e.arrivals.some((a) => a.from === 12)).toBe(false);
    });

    it('no map regions: the arrivals are kept UNMAPPED by name, never dropped', () => {
        const e = arrivalEscape(settled.obstacle, null);
        expect(e.arrivals).toEqual([]);
        expect(e.unmapped).toEqual(['L2 stairs@48,16', 'L13 stairs@64,144', 'L86 teleporter@48,64',
            'L89 teleporter@160,304', 'L94 teleporter@304,160', 'L94 teleporter@304,176']);
    });

    it('any other obstacle (or none) is not an escape', () => {
        expect(arrivalEscape({ kind: 'hazard-floor', id: 'x', floors: ['lava'] }, REGIONS)).toBeNull();
        expect(arrivalEscape(null, REGIONS)).toBeNull();
        expect(arrivalEscape({ kind: ARRIVAL_INSIDE_SOLID, id: 'a', wayOut: [] }, REGIONS))
            .toEqual({ kind: ARRIVAL_INSIDE_SOLID, solids: ['a'], at: null, restart: false, arrivals: [], unmapped: [] });
    });

    it('a door is read by its coordinates; a pit / garbage is no door', () => {
        expect(doorXY('teleporter@48,96')).toEqual({ x: 48, y: 96 });
        expect(doorXY('stairs@48,16')).toEqual({ x: 48, y: 16 });
        expect(doorXY('lock@48,16')).toBeNull();
        expect(doorXY(undefined)).toBeNull();
        expect(doorExitsOf(REGIONS, { from: 2, door: 'teleporter@48,96', to: 3 }))
            .toEqual([{ region: 'level_2', exit: 'level_2 -> level_3__r0c4', landing: 'level_3__r0c4' }]);
        // the right door into the WRONG level is not it
        expect(doorExitsOf(REGIONS, { from: 2, door: 'teleporter@48,96', to: 0 })).toEqual([]);
    });
});
