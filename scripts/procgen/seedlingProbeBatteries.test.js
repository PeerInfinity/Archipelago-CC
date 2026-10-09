/**
 * seedling-probe-batteries.json — every battery is runnable as committed:
 * every probe exists, every arg parses and is a flag the probe itself parses,
 * no duplicate job ids (slice seedling-probe-battery).
 */
import { describe, expect, it } from 'vitest';
import { batteryMatrix, batteryProblems, parseArgs, readBatteries } from './seedlingProbeBatteries.js';

describe('the committed batteries', () => {
    const batteries = readBatteries();
    it('there is a standard battery', () => expect(Object.keys(batteries)).toContain('standard'));
    for (const name of Object.keys(batteries)) {
        it(`${name}: no refusals`, () => expect(batteryProblems(name, batteries[name])).toEqual([]));
    }
    it('standard is the brief\'s list, each probe with its own args', () => {
        expect(batteryMatrix('standard').map((e) => `${e.probe} ${e.args}`.trim())).toEqual([
            'probe-seedling-wasm-logical-links.mjs --only=B',
            'probe-seedling-wasm-vanilla-map.mjs',
            'probe-seedling-wasm-arrival-composites.mjs',
            'probe-seedling-wasm-midroom-replan.mjs --only=D',
            'probe-seedling-restart-route.mjs --only=W,J',
            'probe-seedling-restart-warp.mjs --only=W,J',
            'probe-seedling-wasm-adopt.mjs',
            'probe-seedling-obstacle-events.mjs --only=W,J',
            'probe-seedling-wasm-generated-playback.mjs',
            'probe-seedling-loop-restart.mjs',
        ]);
    });
});

describe('the validator refuses', () => {
    const p = (entries) => batteryProblems('t', entries);
    it('a probe that does not exist', () => expect(p([{ probe: 'probe-seedling-nope.mjs', args: '' }])[0]).toMatch(/does not exist/));
    it('a name that is not a probe', () => expect(p([{ probe: '../x.mjs' }])[0]).toMatch(/not a probe-seedling/));
    it('a flag the probe does not parse', () => expect(p([{ probe: 'probe-seedling-restart-warp.mjs', args: '--onyl=W' }])[0])
        .toMatch(/--onyl is not a flag the probe parses/));
    it('--host (the job sets it)', () => expect(p([{ probe: 'probe-seedling-restart-warp.mjs', args: '--host=http://x' }])[0])
        .toMatch(/--host is set by the job/));
    it('shell metacharacters', () => expect(parseArgs('--only=W;rm').problems).toHaveLength(1));
    it('a duplicate id', () => expect(p([{ probe: 'probe-seedling-restart-warp.mjs' }, { probe: 'probe-seedling-restart-warp.mjs', args: '--only=J' }])[0])
        .toMatch(/duplicate id/));
    it('…unless the duplicate names itself', () => expect(p([{ probe: 'probe-seedling-restart-warp.mjs' },
        { probe: 'probe-seedling-restart-warp.mjs', args: '--only=J', id: 'restart-warp-J' }])).toEqual([]));
    it('an unknown key', () => expect(p([{ probe: 'probe-seedling-restart-warp.mjs', arg: '--only=J' }])[0]).toMatch(/unknown key/));
    it('an unknown battery, by name', () => expect(() => batteryMatrix('nope')).toThrow(/no battery "nope"/));
});
