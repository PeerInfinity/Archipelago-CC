import { describe, it, expect } from 'vitest';
import {
    computeLocationProgress, formatLocationProgress, describeLocationProgress, mountChecksLine,
} from './checksLine.js';

const STATIC = {
    locations: new Map([
        ['A', { id: 1 }],
        ['B', { id: 2 }],
        ['C', { id: 3 }],
        ['D', { id: 4 }],
        ['Ev1', { id: null }],
        ['Ev2', {}],
    ]),
};
const SNAPSHOT = {
    checkedLocations: ['A', 'Ev1'],
    locationReachability: { B: 'reachable', C: 'unreachable' },
};

describe('computeLocationProgress', () => {
    it('counts checked, reachable, unreachable and events', () => {
        expect(computeLocationProgress(SNAPSHOT, STATIC)).toEqual({
            checked: 1, total: 4, reachable: 1, unreachable: 2, eventsChecked: 1, eventsTotal: 2,
        });
    });

    it('is null until both the snapshot and the static data exist', () => {
        expect(computeLocationProgress(null, STATIC)).toBeNull();
        expect(computeLocationProgress(SNAPSHOT, null)).toBeNull();
        expect(computeLocationProgress(SNAPSHOT, {})).toBeNull();
    });
});

describe('formatLocationProgress', () => {
    it('prints the Console line', () => {
        expect(formatLocationProgress(computeLocationProgress(SNAPSHOT, STATIC)))
            .toBe('Checked: 1/4, Reachable: 1, Unreachable: 2, Events: 1/2');
    });

    it('prints question marks without counts', () => {
        expect(formatLocationProgress(null)).toBe('Checked: ?/?, Reachable: ?, Unreachable: ?, Events: ?/?');
        expect(describeLocationProgress(null)).toMatch(/not yet available/);
    });
});

describe('mountChecksLine', () => {
    function fakeBus() {
        const subs = new Map();
        return {
            subs,
            subscribe(event, fn, moduleName) {
                subs.set(event, { fn, moduleName });
                return () => subs.delete(event);
            },
            emit(event, data) { subs.get(event)?.fn(data); },
        };
    }
    function fakeElement() {
        const classes = new Set();
        return { textContent: '', title: '', classList: { add: (c) => classes.add(c) }, classes };
    }

    it('draws now, redraws on a snapshot update, and stops after dispose', () => {
        const bus = fakeBus();
        const el = fakeElement();
        const stateManager = { getLatestStateSnapshot: () => null, getStaticData: () => STATIC };
        const line = mountChecksLine(el, { bus, stateManager, moduleName: 'client' });
        expect(el.textContent).toMatch(/^Checked: \?/);
        expect(el.classes.has('checks-line')).toBe(true);
        expect(bus.subs.get('stateManager:snapshotUpdated').moduleName).toBe('client');

        bus.emit('stateManager:snapshotUpdated', { snapshot: SNAPSHOT });
        expect(el.textContent).toBe('Checked: 1/4, Reachable: 1, Unreachable: 2, Events: 1/2');

        line.dispose();
        expect(bus.subs.size).toBe(0);
    });
});
