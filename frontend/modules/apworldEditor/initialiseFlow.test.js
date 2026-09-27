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
import {
    INITIALISE_BARE_ONLY, INITIALISE_LOOP_MODE_ON, initialiseFailureSentence, initialiseOpRefusal,
    initialiseSphereLogRefusal,
} from './rulesDocOps.js';
import {
    BACK_EXITS, DEFAULT_REGION_XP_EFFECT, DEFAULT_SUBSTRATE_ID, INITIALISE_FIRST_SEED, INITIALISE_SIZE_KEYS,
    INITIALISE_STAGES, INITIALISE_XP_EFFECTS, SPHERE_LOG_SOURCE, UNPLACED_WHY, autoGridSide,
    initialiseGridSide, initialiseTargets, planInitialise,
} from './slotInitialise.js';
import { startRegionsOf } from '../procgenCore/rulesGraph.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { regionSizeFor } from './regionRegenerate.js';
import {
    INITIALISE_JOB, REGION_GENERATION_CANCELLED, initialiseTimeoutSentence,
} from './regionGenerationRun.js';
import ApworldEditorUI from './apworldEditorUI.js';
import {
    INITIALISE_DOOR_LABEL, initialiseAnswer, initialiseArgs, initialiseDoorShown, initialiseFormDefaults,
    initialiseJob, initialisePreview, initialiseTickerText, withAutoSide,
    initialiseBagFor, withInitialisePatch, initialiseLoopToggle,
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
const MM3 = read('mm3/AP_14089154938208861744/AP_14089154938208861744_rules.json');
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

    it('⛔ M3 — a slot declaring TWO starts still gets the door; its preview is the op\'s refusal, no plan', () => {
        const doc = JSON.parse(JSON.stringify(APCALC));
        doc.start_regions[P] = { default: ['C', 'A'], available: [] };
        expect(initialiseDoorShown(doc, P)).toBe(true);
        const st = initialiseFormDefaults(doc, P);
        const pv = initialisePreview(doc, P, st);
        expect(pv.refusal).toBe(initialiseOpRefusal(doc, initialiseArgs(P, st)));
        expect(pv.refusal).toContain('declares 2 start regions');
        expect(pv.text).toBe(pv.refusal);
        expect(pv.plan).toBeNull();
    });
});

describe('the form', () => {
    it('⛓ opens on the engine\'s default substrate, the AUTO side, the first seed, return exits ON, loop mode OFF', () => {
        const st = initialiseFormDefaults(APCALC, P);
        const bag = initialiseBagFor(APCALC, P, DEFAULT_SUBSTRATE_ID);
        expect(st).toEqual({
            substrate: DEFAULT_SUBSTRATE_ID, seed: INITIALISE_FIRST_SEED, backExits: BACK_EXITS.ADD, sideAuto: true,
            side: autoGridSide(APCALC, P, { substrate: DEFAULT_SUBSTRATE_ID, seed: INITIALISE_FIRST_SEED, bag }).side,
            bag,
            // ⛓ S3 — off by default (the pipeline's `enableLoopMode: false`), the generator's default effect.
            loopMode: { enabled: false, regionXpEffect: DEFAULT_REGION_XP_EFFECT },
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
            backExits: st.backExits, bag: st.bag,
        });
        expect(args.bag).not.toBe(st.bag);
        expect(initialiseJob(APCALC, P, st)).toEqual({ job: INITIALISE_JOB, doc: APCALC, ...args });
    });
});

/** ⛓ The first key of a target's defaults whose value is a number or a boolean — derived, never typed. */
const firstKnob = (id) => {
    const d = substrateRegistry.get(id)?.defaultProcgenParams ?? {};
    return Object.keys(d).find((k) => typeof d[k] === 'number' || typeof d[k] === 'boolean') ?? null;
};
const moved = (v) => (typeof v === 'boolean' ? !v : v + 1);
const { width: W, height: H } = INITIALISE_SIZE_KEYS;

describe('S2 — the generation settings bag', () => {
    it('⛓ opens on the target\'s own defaults and the slot\'s region size (regionSizeFor), every realiser target', () => {
        const size = regionSizeFor(ADVENTURE, P);
        for (const id of initialiseTargets()) {
            expect(initialiseBagFor(ADVENTURE, P, id), id).toEqual({
                ...(substrateRegistry.get(id).defaultProcgenParams ?? {}), [W]: size.width, [H]: size.height,
            });
        }
    });

    it('⛓⛓ a substrate change RESETS every key but the size (mutant: the old bag kept)', () => {
        const targets = initialiseTargets().filter((id) => firstKnob(id));
        expect(targets.length).toBeGreaterThanOrEqual(2);
        const [a, b] = targets;
        const st = withInitialisePatch(ADVENTURE, P, initialiseFormDefaults(ADVENTURE, P), { substrate: a });
        const k = firstKnob(a);
        st.bag[k] = moved(st.bag[k]);
        st.bag[W] += 3;
        const next = withInitialisePatch(ADVENTURE, P, st, { substrate: b });
        expect(next.bag).toEqual({
            ...substrateRegistry.get(b).defaultProcgenParams, [W]: st.bag[W], [H]: st.bag[H],
        });
        expect(Object.hasOwn(next.bag, k)).toBe(Object.hasOwn(substrateRegistry.get(b).defaultProcgenParams, k));
        // ⛓ a patch that does not change the substrate keeps the bag as it is
        expect(withInitialisePatch(ADVENTURE, P, st, { seed: 4 }).bag).toBe(st.bag);
        expect(withInitialisePatch(ADVENTURE, P, st, { substrate: a }).bag).toBe(st.bag);
    });

    it('⛓ the auto side follows the bag\'s size (the layout reads it)', () => {
        const st = initialiseFormDefaults(APCALC, P);
        const big = { ...st, bag: { ...st.bag, [W]: st.bag[W] * 3, [H]: st.bag[H] * 3 } };
        expect(withAutoSide(APCALC, P, big).side).toBe(autoGridSide(APCALC, P, { ...big, bag: big.bag }).side);
    });

    it('⛓⛓ a HOOK knob does not move the plan (the layout reads only the size) — the preview re-plans on a size move only', () => {
        for (const id of initialiseTargets().filter((t) => firstKnob(t))) {
            const st = withInitialisePatch(ADVENTURE, P, initialiseFormDefaults(ADVENTURE, P), { substrate: id });
            const k = firstKnob(id);
            const other = { ...st, bag: { ...st.bag, [k]: moved(st.bag[k]) } };
            expect(planInitialise(ADVENTURE, P, initialiseArgs(P, other)), id)
                .toEqual(planInitialise(ADVENTURE, P, initialiseArgs(P, st)));
        }
    });

    it('⛔ a bag the op refuses: not an object (by name); a size below one tile previews the op\'s sentence', () => {
        const st = initialiseFormDefaults(ADVENTURE, P);
        for (const bad of ['x', 7, [], null]) {
            expect(initialiseOpRefusal(ADVENTURE, { ...initialiseArgs(P, st), bag: bad }), String(bad)).toContain('`bag`');
        }
        const zero = initialisePreview(ADVENTURE, P, { ...st, sideAuto: false, bag: { ...st.bag, [W]: 0 } });
        expect(zero.refusal).toContain(`\`${W}\``);
        expect(initialiseOpRefusal(ADVENTURE, { ...initialiseArgs(P, st), bag: undefined })).toBeNull();
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

    it('⛓ M2 — a stripped Menu is the HUB: the sentence says its exits → the roots (mm3), and nothing when none (apcalc)', () => {
        const st = initialiseFormDefaults(MM3, P);
        const pv = initialisePreview(MM3, P, st);
        const { plan } = pv;
        const [menu] = startRegionsOf(MM3, P).default;
        const exits = MM3.regions[P][menu].exits.length;
        expect(plan.menu).toBe(menu);
        expect(plan.menuExits).toBe(exits);
        expect(plan.menuRoots.length).toBe(exits);
        expect(pv.text.endsWith(`; ${menu}: ${exits} exits → ${exits} roots`)).toBe(true);
        // ⛓ a side too small for every root: fewer roots than exits, the shortage named.
        const small = initialisePreview(MM3, P, { ...st, sideAuto: false, side: initialiseGridSide(Object.keys(MM3.regions[P]).length) });
        expect(small.plan.menuRoots.length).toBeLessThan(exits);
        expect(small.text).toContain(`${menu}: ${exits} exits → ${small.plan.menuRoots.length} roots`);
        expect(small.text).toContain(`(${UNPLACED_WHY.NO_FREE_CELL})`);
        expect(initialisePreview(APCALC, P, initialiseFormDefaults(APCALC, P)).text).not.toContain('→');
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

/* ── S3: loop mode on the form ──────────────────────────────────────────── */

describe('S3 — loop mode on the form', () => {
    const ADV_LOG = readFileSync(join(ROOT, 'frontend', 'presets',
        'adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl'), 'utf8')
        .trim().split('\n').map((l) => JSON.parse(l));
    const on = (st, fx = DEFAULT_REGION_XP_EFFECT) => ({ ...st, loopMode: { enabled: true, regionXpEffect: fx } });

    it('⛓⛓ OFF (the default) sends the pre-S3 args and job exactly — no `loopMode`, no log, even with a page log', () => {
        const st = initialiseFormDefaults(ADVENTURE, P);
        expect(st.loopMode.enabled).toBe(false);
        const args = initialiseArgs(P, st);
        expect(Object.hasOwn(args, 'loopMode')).toBe(false);
        const job = initialiseJob(ADVENTURE, P, st, ADV_LOG);
        expect(Object.hasOwn(job, 'loopMode')).toBe(false);
        expect(Object.hasOwn(job, 'sphereLog')).toBe(false);
        expect(initialisePreview(ADVENTURE, P, st, ADV_LOG)).toEqual(initialisePreview(ADVENTURE, P, st));
    });

    it('⛓ ON: the args carry a COPY of {enabled, regionXpEffect}; the job carries the page\'s entries as data', () => {
        const st = on(initialiseFormDefaults(ADVENTURE, P), INITIALISE_XP_EFFECTS.at(-1));
        const args = initialiseArgs(P, st);
        expect(args.loopMode).toEqual(st.loopMode);
        expect(args.loopMode).not.toBe(st.loopMode);
        const job = initialiseJob(ADVENTURE, P, st, ADV_LOG);
        expect(job.sphereLog).toBe(ADV_LOG);
        expect(Object.hasOwn(initialiseJob(ADVENTURE, P, st, []), 'sphereLog')).toBe(false);
        expect(Object.hasOwn(initialiseJob(ADVENTURE, P, st, null), 'sphereLog')).toBe(false);
    });

    it('⛓⛓ the toggle: DISABLED with the op\'s own sentence when no log is reachable; the page\'s, else the embedded one', () => {
        const none = initialiseLoopToggle(ADVENTURE, P, null);
        expect(none.refusal).toBe(initialiseSphereLogRefusal(ADVENTURE, { player: P, loopMode: { enabled: true } }));
        expect(none.refusal).toContain('none is loaded and the document embeds none');
        expect(initialiseLoopToggle(ADVENTURE, P, ADV_LOG)).toEqual({
            refusal: null, source: SPHERE_LOG_SOURCE.PAGE, entries: ADV_LOG.length,
        });
        const embedded = { ...ADVENTURE, sphere_log: ADV_LOG };
        expect(initialiseLoopToggle(embedded, P, null).source).toBe(SPHERE_LOG_SOURCE.EMBEDDED);
    });

    it('⛓ the preview: loop mode ON with no log is the op\'s refusal (no Generate); with one, the plan names the log', () => {
        const st = on(initialiseFormDefaults(ADVENTURE, P));
        const pv = initialisePreview(ADVENTURE, P, st, null);
        expect(pv.plan).toBeNull();
        expect(pv.refusal).toBe(initialiseLoopToggle(ADVENTURE, P, null).refusal);
        const ok = initialisePreview(ADVENTURE, P, st, ADV_LOG);
        expect(ok.refusal).toBeNull();
        expect(ok.text).toBe(`${initialisePreview(ADVENTURE, P, { ...st, loopMode: { enabled: false } }).text}; `
            + `${INITIALISE_LOOP_MODE_ON} (${DEFAULT_REGION_XP_EFFECT}), priced from the loaded sphere log`);
        const held = { ...ADVENTURE, loop_costs: { [P]: { regions: {}, locations: {} } } };
        expect(initialisePreview(held, P, st, ADV_LOG).refusal).toContain('already carries a `loop_costs` block');
    });

    it('⛓ a generator throw is answered in the op\'s words — not as the realiser\'s', () => {
        const res = { ok: false, why: 'boom', stage: INITIALISE_STAGES.LOOP_COSTS };
        const a = initialiseAnswer({ substrate: DEFAULT_SUBSTRATE_ID, player: P }, res, 60);
        expect(a).toEqual({ landed: false, text: `${initialiseFailureSentence(DEFAULT_SUBSTRATE_ID, res)} Nothing was recorded.` });
        expect(a.text).not.toContain('realiser threw');
    });
});
