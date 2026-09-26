/**
 * apworldEditor/initialiseFlow — **WHAT THE "INITIALISE PROCGEN DATA" FORM SAYS
 * AND SENDS: THE ROWS** (APWORLD SUBSTRATE CHANGE R7). The door's test, the
 * form's defaults, the preview sentence, the ticker, and the answers — on the
 * committed classic documents, read-only.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { INITIALISE_BARE_ONLY, initialiseOpRefusal } from './rulesDocOps.js';
import {
    BACK_EXITS, DEFAULT_SUBSTRATE_ID, INITIALISE_FIRST_SEED, autoGridSide, planInitialise,
} from './slotInitialise.js';
import {
    INITIALISE_JOB, REGION_GENERATION_CANCELLED, initialiseTimeoutSentence,
} from './regionGenerationRun.js';
import ApworldEditorUI from './apworldEditorUI.js';
import {
    INITIALISE_DOOR_LABEL, initialiseAnswer, initialiseArgs, initialiseDoorShown, initialiseFormDefaults,
    initialiseJob, initialisePreview, initialiseTickerText, withAutoSide,
} from './initialiseFlow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const APCALC = read('apcalc/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const ADVENTURE = read('adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const P = '1';

describe('the door', () => {
    it('⛓ is shown on a bare slot with regions, and on no slot that carries an entry', () => {
        expect(INITIALISE_DOOR_LABEL).toBe('Initialise procgen data ▸');
        expect(initialiseDoorShown(APCALC, P)).toBe(true);
        expect(initialiseDoorShown(ADVENTURE, P)).toBe(true);
        for (const p of Object.keys(FOUR.regions)) expect(initialiseDoorShown(FOUR, p), p).toBe(false);
        expect(initialiseDoorShown(APCALC, '5')).toBe(false);
    });
});

describe('the form', () => {
    it('⛓ opens on the engine\'s default substrate, the AUTO side, the first seed, return exits ON', () => {
        const st = initialiseFormDefaults(APCALC, P);
        expect(st).toEqual({
            substrate: DEFAULT_SUBSTRATE_ID, seed: INITIALISE_FIRST_SEED, backExits: BACK_EXITS.ADD, sideAuto: true,
            side: autoGridSide(APCALC, P, { substrate: DEFAULT_SUBSTRATE_ID, seed: INITIALISE_FIRST_SEED }).side,
        });
    });

    it('⛓ an AUTO side follows the seed; a typed side stays', () => {
        const st = initialiseFormDefaults(APCALC, P);
        const typed = withAutoSide(APCALC, P, { ...st, sideAuto: false, side: 3, seed: 9 });
        expect(typed.side).toBe(3);
        const auto = withAutoSide(APCALC, P, { ...st, seed: 9 });
        expect(auto.side).toBe(autoGridSide(APCALC, P, { seed: 9 }).side);
    });

    it('⛓ the job and the op take the same arguments', () => {
        const st = initialiseFormDefaults(APCALC, P);
        const args = initialiseArgs(P, st);
        expect(args).toEqual({
            player: P, substrate: st.substrate, gridDims: { width: st.side, height: st.side }, seed: st.seed,
            backExits: st.backExits,
        });
        expect(initialiseJob(APCALC, P, st)).toEqual({ job: INITIALISE_JOB, doc: APCALC, ...args });
    });
});

describe('the preview', () => {
    it('⛓ is the layout\'s plan in one sentence — every number the plan\'s', () => {
        const st = initialiseFormDefaults(APCALC, P);
        const pv = initialisePreview(APCALC, P, st);
        const plan = planInitialise(APCALC, P, initialiseArgs(P, st));
        expect(pv.refusal).toBeNull();
        expect(pv.plan).toEqual(plan);
        expect(plan.returnExits).toBeGreaterThan(0);
        expect(pv.text).toBe(`${plan.placed} regions placed on ${st.side}×${st.side}, ${plan.teleporters} teleporters; `
            + `${plan.returnExits} return exits will be added; 0 unplaceable`);
    });

    it('⛓ return exits OFF says so, and a too-small grid NAMES the unplaceable with their why', () => {
        const st = { ...initialiseFormDefaults(APCALC, P), backExits: BACK_EXITS.NONE, sideAuto: false, side: 3 };
        const pv = initialisePreview(APCALC, P, st);
        expect(pv.text).toContain('no return exits (off)');
        expect(pv.plan.unplaced.length).toBeGreaterThan(0);
        for (const u of pv.plan.unplaced) expect(pv.text).toContain(`${u.region} (${u.why})`);
    });

    it('⛔ a state the op refuses previews the op\'s own sentence (the form then draws no Generate)', () => {
        const pv = initialisePreview(FOUR, P, initialiseFormDefaults(APCALC, P));
        expect(pv.refusal).toContain(INITIALISE_BARE_ONLY);
        expect(pv.refusal).toBe(initialiseOpRefusal(FOUR, initialiseArgs(P, initialiseFormDefaults(APCALC, P))));
        const bad = initialisePreview(APCALC, P, { ...initialiseFormDefaults(APCALC, P), side: 0, sideAuto: false });
        expect(bad.refusal).toContain('`gridDims`');
        expect(bad.plan).toBeNull();
    });
});

describe('the ticker and the answers', () => {
    it('⛓ the ticker reads built N / M · t s of B, or the library load', () => {
        expect(initialiseTickerText({ phase: 'running', elapsedS: 12.34, budgetS: 300, progress: { index: 120, total: 445 } }))
            .toBe('built 120 / 445 · 12.3 s of 300');
        expect(initialiseTickerText({ phase: 'running', elapsedS: 0.05, budgetS: 300, progress: null })).toBe('0.1 s of 300');
        expect(initialiseTickerText({ phase: 'loading', elapsedS: 1.2, budgetS: 300 })).toBe('Loading the substrate libraries… 1.2 s');
    });

    it('⛓ a result that can land is answered by the op (no text here); every other outcome in its own words', () => {
        const args = initialiseArgs(P, initialiseFormDefaults(APCALC, P));
        expect(initialiseAnswer(args, { ok: true })).toEqual({ landed: true, text: null });
        expect(initialiseAnswer(args, { ok: false, timedOut: true, phase: 'running' }, 300, { index: 7, total: 81 }).text)
            .toBe(initialiseTimeoutSentence(300, args.substrate, P, { index: 7, total: 81 }));
        expect(initialiseAnswer(args, { ok: false, cancelled: true }).text).toBe(`apworld: ${REGION_GENERATION_CANCELLED}.`);
        expect(initialiseAnswer(args, { ok: false, workerFailed: true, threw: 'x' }).text).toBe('apworld: x');
        const threw = initialiseAnswer(args, { ok: false, why: 'boom', region: 'R' }).text;
        expect(threw).toContain('on region "R" — boom');
        expect(threw).toContain('Nothing was recorded');
    });
});

/**
 * ⛓⛓ THE PANEL'S TEARDOWN RULE (a remounted panel keeps OLD listeners): the
 * worker handle and the ticker live on the PANEL; the methods run on a minimal
 * `this` — the panel's own prototype, no DOM (R2's recipe).
 */
describe('the panel stops the initialise run and its ticker at every boundary', () => {
    const P = ApworldEditorUI.prototype;
    const live = () => {
        const cancel = vi.fn();
        const self = {
            _initialise: { player: P, run: { handle: { cancel } } },
            _initialiseTicker: setInterval(() => {}, 1000),
            _regionGen: null, _regionGenTicker: null,
        };
        Object.assign(self, {
            _stopInitialiseRun: P._stopInitialiseRun, _closeInitialise: P._closeInitialise,
            _stopRegionGenRun: P._stopRegionGenRun, _closeRegionGeneration: P._closeRegionGeneration,
        });
        return { self, cancel };
    };

    it('⛓ _closeInitialise cancels the run (terminating its worker), clears the ticker, closes the form', () => {
        const { self, cancel } = live();
        const ticker = self._initialiseTicker;
        const cleared = vi.spyOn(globalThis, 'clearInterval');
        self._closeInitialise();
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cleared).toHaveBeenCalledWith(ticker);
        expect(self._initialiseTicker).toBeNull();
        expect(self._initialise).toBeNull();
        cleared.mockRestore();
    });

    it('⛓⛓ onPanelDestroy stops them (mutant: the ticker left running on destroy)', () => {
        const { self, cancel } = live();
        Object.assign(self, {
            _teardownRawEditor: () => {}, _closeRoomEditor: () => {}, _keyHandler: null,
            rawJsonUnsubscribe: null, loadRulesUnsubscribe: null, selectRegionUnsubscribe: null,
        });
        P.onPanelDestroy.call(self);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(self._initialiseTicker).toBeNull();
        expect(self._initialise).toBeNull();
    });

    it('⛓ the door is drawn only on a bare slot, and disabled while that slot\'s form is open', () => {
        const mk = (doc, playerId, open) => P._makeInitialiseDoor.call({
            rulesDoc: doc, playerId, _initialise: open ? { player: String(playerId) } : null,
            // ⛓ No DOM here: a button is a plain object with the fields the method sets.
            _openInitialise: () => {}, _makeButton: (label) => ({ textContent: label, style: {} }),
        });
        expect(mk(FOUR, '1', false)).toBeNull();
        const door = mk(APCALC, '1', false);
        expect(door.textContent).toBe(INITIALISE_DOOR_LABEL);
        expect(door.disabled).toBe(false);
        expect(mk(APCALC, '1', true).disabled).toBe(true);
    });
});
