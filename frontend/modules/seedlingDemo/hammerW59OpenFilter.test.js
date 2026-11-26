/**
 * ⛓ hammer-phase W59-OPEN — an apitem the RUN took itself (fidelity PLAINSPAN, `CONTACT_FIDELITY.plainPickupInFreeze`)
 * is the segment's take on the tick the run took it, and is no longer `open` to the segment view.
 *
 * Before: the segment view (`solveSegmentUnder`'s `viewOf`) filtered `open` by its OWN `apItemsTaken`, so with the key ON
 * an apitem the run banked on a freeze's frame stayed open, and the view recorded it at the LATER tick it next met it
 * (fidelity's report, "To hammer"). Now the view calls `recordRunSideApItemTakes` after each `advance`, before the
 * filter. The witness is fidelity's staged L29 row: two apitems under the button's frame-A box (the run banks both at
 * t 25, the advance at tape tick 24). Key OFF, the run's list never grows and the view is unchanged.
 */
import { describe, expect, it } from 'vitest';

import { loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { apItemTakenOnTick, recordRunSideApItemTakes } from './solverBot.js';

const AP = (x, y, tag) => ({ type: 'apitem', x, y, attrs: { tag: String(tag), look: 'ap' } });
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];

function stagedL29(inject) {
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === 29);
    L.entities = L.entities.concat(inject);
    return levelSourceFromAtlas(atlas);
}

/** Drive L29 up onto `button@112,128` as the segment view does: its ledger, its `open` filter, its one report a tick. */
function viewDrive(on, ticks = 40) {
    return withContactFidelity({ plainPickupInFreeze: on }, () => {
        const run = createLevelRun({ levelSource: stagedL29([AP(112, 127, 7), AP(110, 127, 9)]),
            boot: { level: 29, x: 112, y: 160 }, seam: { time: 900 }, roles: ROLES, pins: ['sound', 'dead_frames'] });
        const taken = new Map();
        const runSide = [];
        for (let k = 0; k < ticks; k += 1) {
            const items = run.world?.apItems ?? [];
            const pre = { level: run.level, x: run.state.x, y: run.state.y,
                inCeremony: Boolean(run.progress('inCeremony')), deaths: run.ledger('playerDeaths').length,
                transitions: run.transitions.length };
            const from = run.plainFreezeTakes.length;
            run.advance(new Set(['up']));
            runSide.push(...recordRunSideApItemTakes(run, from, items, k, taken));
            const open = items.filter((a) => !taken.has(`${pre.level}:${a.id}`));
            const a = apItemTakenOnTick(open, pre, { level: run.level, deaths: run.ledger('playerDeaths').length,
                transitions: run.transitions.length });
            if (a) {
                taken.set(`${pre.level}:${a.id}`, { tick: k, level: pre.level, apItem: a });
                run.takeApItem({ level: pre.level, id: a.id, tag: a.tag });
            }
        }
        return { ledger: [...taken.values()].map((r) => [r.tick, r.apItem.id]), runSide,
            bank: run.earnedClears.filter((e) => String(e.by).startsWith('apitem@')).map((e) => [e.t, e.by]) };
    });
}

describe('hammer-phase W59-OPEN — the segment view reads the run\'s own apitem takes', () => {
    it('a run without `plainFreezeTakes`, or one whose list did not grow, writes nothing', () => {
        const taken = new Map();
        expect(recordRunSideApItemTakes({}, 0, [], 3, taken)).toEqual([]);
        expect(recordRunSideApItemTakes({ plainFreezeTakes: [{ level: 1, id: 'a', tag: 2 }] }, 1, [], 3, taken))
            .toEqual([]);
        expect(taken.size).toBe(0);
    });

    it('a new run-side take is written at the given tick (with the level\'s apitem); one already held is kept', () => {
        const item = { id: 'apitem@1,2', tag: 4, x: 1, y: 2 };
        const taken = new Map([['5:apitem@9,9', { tick: 1, level: 5, apItem: { id: 'apitem@9,9', tag: 8 } }]]);
        const run = { plainFreezeTakes: [{ level: 5, id: 'apitem@9,9', tag: 8 }, { level: 5, id: 'apitem@1,2', tag: 4 }] };
        expect(recordRunSideApItemTakes(run, 0, [item], 7, taken)).toEqual(['5:apitem@1,2']);
        expect(taken.get('5:apitem@1,2')).toEqual({ tick: 7, level: 5, apItem: item });
        expect(taken.get('5:apitem@9,9').tick).toBe(1);
    });

    it('L29 frame A, two apitems under one box: key OFF the view takes the second a tick late; ON both on A (= the bank)',
        () => {
            const off = viewDrive(false);
            expect(off.runSide).toEqual([]);
            expect(off.ledger).toEqual([[24, 'apitem@112,127'], [25, 'apitem@110,127']]);
            const on = viewDrive(true);
            expect(on.bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
            expect(on.runSide).toEqual(['29:apitem@112,127', '29:apitem@110,127']);
            expect(on.ledger).toEqual([[24, 'apitem@112,127'], [24, 'apitem@110,127']]);
        });
});
