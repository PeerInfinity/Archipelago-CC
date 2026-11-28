import { describe, expect, it } from 'vitest';
import { MYSTERY_WALK_REFUSALS, createMysteryPlaybackController } from './mysteryPlaybackController.js';

const OFFICE = 'The case';
const office = () => ({
    regionId: OFFICE,
    payload: {
        story: 's',
        ap_locations: { 'q.a': 'Question 01', 'q.b': 'Question 02' },
        papers: {},
        exits: new Map([['Down to the street', { exitName: 'Down to the street', targetRegion: 'The street' }]]),
    },
});

function setup({ here = OFFICE, regions = [office()] } = {}) {
    const sent = [];
    const controller = createMysteryPlaybackController({
        dispatcher: { publish: (event, payload, options) => sent.push({ event, payload, options }) },
        getCaseRegions: () => regions,
        getActiveRegionId: () => here,
        sourceModule: 'mysteryArchipelago',
    });
    return { controller, sent };
}

describe('the mystery playback controller', () => {
    it('checks a question\'s location under the logic gate, in one step', () => {
        const { controller, sent } = setup();
        expect(controller.walkTo({ kind: 'location', name: 'Question 02' })).toBe(true);
        expect(sent).toEqual([{
            event: 'user:locationCheck',
            payload: { locationName: 'Question 02', regionName: OFFICE, sourceModule: 'mysteryArchipelago', originator: 'PlaybackBot', fromBot: true },
            options: { initialTarget: 'bottom' },
        }]);
        expect(sent[0].payload.reportedByGame).toBeUndefined();
    });

    it('leaves the office by a named exit', () => {
        const { controller, sent } = setup();
        expect(controller.walkTo({ kind: 'exit', name: 'Down to the street' })).toBe(true);
        expect(sent[0].event).toBe('user:regionMove');
        expect(sent[0].payload).toMatchObject({ sourceRegion: OFFICE, targetRegion: 'The street', exitName: 'Down to the street' });
    });

    it('refuses by name, and sends nothing, what it cannot take', () => {
        const { controller, sent } = setup();
        expect(controller.walkTo({ kind: 'location', name: 'Something in the gutter' })).toBe(false);
        expect(controller.lastRefusal).toBe(MYSTERY_WALK_REFUSALS.NOT_A_QUESTION);
        expect(controller.walkTo({ kind: 'exit', name: 'Out of the window' })).toBe(false);
        expect(controller.lastRefusal).toBe(MYSTERY_WALK_REFUSALS.NO_SUCH_EXIT);
        expect(controller.walkTo({ kind: 'tile', x: 1, y: 1 })).toBe(false);
        expect(controller.lastRefusal).toBe(MYSTERY_WALK_REFUSALS.UNKNOWN_TARGET);
        expect(sent).toEqual([]);
    });

    it('refuses away from a case region, and a taken target clears the last refusal', () => {
        const away = setup({ here: 'The street' });
        expect(away.controller.walkTo({ kind: 'location', name: 'Question 01' })).toBe(false);
        expect(away.controller.lastRefusal).toBe(MYSTERY_WALK_REFUSALS.NO_CASE_REGION);
        const { controller } = setup();
        controller.walkTo({ kind: 'tile' });
        controller.walkTo({ kind: 'location', name: 'Question 01' });
        expect(controller.lastRefusal).toBeNull();
    });

    it('has the whole controller surface, and `perform` is the same act', () => {
        const { controller, sent } = setup();
        for (const m of ['play', 'stop', 'step', 'instant', 'reset', 'setRate']) expect(() => controller[m]()).not.toThrow();
        expect(controller.perform({ kind: 'location', name: 'Question 01' })).toBe(true);
        expect(sent).toHaveLength(1);
    });
});
