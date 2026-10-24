/**
 * `loopsCostDebugger/costDebuggerUI` — **THE LATER HAND-OFF WINS** (APWORLD
 * SUBSTRATE CHANGE P1b′, trap 1478).
 *
 * `_adoptWorkingCopy` is async: it awaits `documentStateManager` (4–306 ms over
 * the committed corpus) before it sets the working copy. Two hand-offs close
 * together can therefore RESOLVE out of order, and until P1b′ the slower,
 * EARLIER one landed last and replaced the later one — the panel planned a
 * document nobody had handed it most recently, and a Send from it was refused
 * by the hub's stale-token veto (the in-app L4 row, red once in a 136-row
 * batch while the debugger held the row before's JtA document).
 *
 * The real method is driven here, on a panel object with its DOM halves
 * stubbed: the translation is a deferred promise per hand-off, so the test
 * decides which finishes first.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const planner = { useStateManager: vi.fn() };
const pending = [];

vi.mock('./index.js', () => ({
    getCostPlanner: () => planner,
    getModuleEventBus: () => ({ publish() {}, subscribe() { return () => {}; } }),
    getSphereLog: () => null,
    consumePendingWorkingCopy: () => null,
    LOOPS_COST_DEBUGGER_LOAD_RULES: 'loopsCostDebugger:loadRules',
}));

vi.mock('./documentStateManager.js', () => ({
    documentPlayerId: () => '1',
    documentSphereLog: () => null,
    // ⛓ One deferred translation per call; the test resolves them in its order.
    documentStateManager: (jsonData) => new Promise((resolve, reject) => {
        pending.push({ jsonData, resolve, reject });
    }),
}));

const { CostDebuggerUI } = await import('./costDebuggerUI.js');

/** A panel with its state fields and no DOM: every render half is a no-op. */
function panel() {
    const ui = Object.create(CostDebuggerUI.prototype);
    Object.assign(ui, {
        _workingCopy: null, _adoptSeq: 0, _isStale: false, verificationResults: [],
        selectedStepIndex: -1, statuses: [],
    });
    ui._setStatus = (text) => ui.statuses.push(text);
    for (const m of ['_refreshStepList', '_refreshDetailView', '_updateSummary', '_updateStatus', '_updateButtons']) {
        ui[m] = () => {};
    }
    return ui;
}

const sm = (name) => ({ name, stats: { regions: 1, locations: 1, ms: 1 } });
const doc = (game) => ({ game_name: game });

describe('_adoptWorkingCopy — a completion that is no longer the latest hand-off is dropped', () => {
    beforeEach(() => {
        pending.length = 0;
        planner.useStateManager.mockClear();
    });

    it('⛓⛓ two overlapping hand-offs resolving OUT OF ORDER → the working copy is the LATER one', async () => {
        const ui = panel();
        const earlier = doc('JtA Schedule Test');
        const later = doc('Omsi Substrate Test');
        const first = ui._adoptWorkingCopy(earlier, 'the APWorld editor', '1', () => 'earlier');
        const second = ui._adoptWorkingCopy(later, 'the APWorld editor', '1', () => 'later');
        expect(pending.map((p) => p.jsonData)).toEqual([earlier, later]);

        pending[1].resolve(sm('later'));
        await second;
        expect(ui._workingCopy.jsonData).toBe(later);

        // ⛔ The EARLIER translation finishes last — the case the guard exists for.
        pending[0].resolve(sm('earlier'));
        await first;
        expect(ui._workingCopy.jsonData).toBe(later);
        expect(ui._workingCopy.onSave()).toBe('later');
        // ⛓ …and the planner was pointed at the later document only.
        expect(planner.useStateManager.mock.calls.map(([s]) => s.name)).toEqual(['later']);
    });

    it('⛓ in order, each hand-off is adopted as it lands (the guard drops nothing current)', async () => {
        const ui = panel();
        const a = doc('A');
        const b = doc('B');
        const first = ui._adoptWorkingCopy(a, 'x', '1');
        pending[0].resolve(sm('a'));
        await first;
        expect(ui._workingCopy.jsonData).toBe(a);
        const second = ui._adoptWorkingCopy(b, 'x', '1');
        pending[1].resolve(sm('b'));
        await second;
        expect(ui._workingCopy.jsonData).toBe(b);
        expect(planner.useStateManager).toHaveBeenCalledTimes(2);
    });

    it('⛓ a stale FAILURE does not overwrite the later hand-off\'s status either', async () => {
        const ui = panel();
        const first = ui._adoptWorkingCopy(doc('A'), 'x', '1');
        const second = ui._adoptWorkingCopy(doc('B'), 'x', '1');
        pending[1].resolve(sm('b'));
        await second;
        const statusesAfterLater = ui.statuses.length;
        pending[0].reject(new Error('boom'));
        await first;
        expect(ui._workingCopy.jsonData.game_name).toBe('B');
        expect(ui.statuses.length).toBe(statusesAfterLater);
    });

    it('⛓ "Use applied state" while a hand-off is still reading wins over its late completion', async () => {
        const ui = panel();
        const first = ui._adoptWorkingCopy(doc('A'), 'x', '1');
        ui._useAppliedState();
        pending[0].resolve(sm('a'));
        await first;
        expect(ui._workingCopy).toBeNull();
    });
});
