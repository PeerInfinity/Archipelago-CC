/**
 * P1-a — the randomizer's eligibility, DETECTED FROM DATA (EDITOR INTEGRATION
 * slice P1; plan §17.1, §17.5).
 *
 * ⛔ THE THREE PRESETS AND THE REAL MANIFEST ARE THE FIXTURES. ⚖ "no opt-in
 * flag" means the rows have to be about the documents that actually ship: the
 * seedling presets' own `flash_panel` wiring and the submodule's own
 * `builds.json`. A hand-typed manifest would agree with a hand-typed lookup
 * and say nothing about whether the preset the app loads is eligible.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    AP_ITEM_CAPABILITY,
    ELIGIBILITY_CHECK_IDS,
    WASM_BUILD_CAPABILITIES,
    buildNameFromWasmPath,
    capabilitiesOf,
    seedlingRandomizerEligibility,
} from './seedlingRandomizerEligibility.js';

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(path(rel), 'utf8'));

const PRESETS = {
    seedling: '../../presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    seedling_atlas: '../../presets/seedling_atlas/AP_1/AP_1_rules.json',
    seedling_playthrough: '../../presets/seedling_playthrough/AP_1/AP_1_rules.json',
};

const MANIFEST_PATH = './wasm/builds.json';
const HAVE_SUBMODULE = existsSync(path(MANIFEST_PATH));
/**
 * ⛓ SKIPPED BY NAME, never silently. The wasm submodule is not checked out in
 * every clone; a row that quietly disappeared would read as a passing row.
 */
const withSubmodule = HAVE_SUBMODULE ? it : it.skip;

const OK_ASSETS = {
    recordSet: { url: '/fixtures/seedling-vanilla-set.json', ok: true },
    map: { url: '/atlases/seedling-map.json', ok: true, source: 'atlases default' },
};
const OK_PLACEMENT = { resolved: 40, total: 41, unresolved: ['seed@L115'] };

describe('the build name is DERIVED from the preset, never spelled', () => {
    it('takes the directory of a `flash_panel.wasm` page', () => {
        expect(buildNameFromWasmPath('seedling_bot_ap_p4d/game.html'))
            .toBe('seedling_bot_ap_p4d');
    });

    it('survives a prefix, a query string and a full URL', () => {
        expect(buildNameFromWasmPath('./modules/flashPanel/wasm/seedling_bot_ap_p4c/game.html'))
            .toBe('seedling_bot_ap_p4c');
        expect(buildNameFromWasmPath('http://127.0.0.1:8129/frontend/modules/flashPanel/wasm/'
            + 'seedling_bot_ap_p4b/game.html?v=2#x')).toBe('seedling_bot_ap_p4b');
    });

    it('refuses what is not a page path', () => {
        expect(buildNameFromWasmPath('')).toBeNull();
        expect(buildNameFromWasmPath(null)).toBeNull();
        expect(buildNameFromWasmPath('game.html')).toBeNull();
    });
});

describe('the manifest lookup is BY DIRECTORY NAME', () => {
    const manifest = {
        builds: [
            { name: 'a_build', capabilities: [] },
            { name: 'b_build', capabilities: [AP_ITEM_CAPABILITY] },
            { name: 'c_build' },
        ],
    };

    it('finds the entry whose `name` is the page directory', () => {
        expect(capabilitiesOf(manifest, 'b_build').capabilities).toEqual([AP_ITEM_CAPABILITY]);
    });

    /**
     * ⛔ AND `null` IS NOT `[]`. An entry that predates the field says
     * NOTHING; one with `[]` says "measured, none". Collapsing them would make
     * a stale manifest look like a build that lost a feature.
     */
    it('distinguishes "declares none" from "declares nothing"', () => {
        expect(capabilitiesOf(manifest, 'a_build').capabilities).toEqual([]);
        expect(capabilitiesOf(manifest, 'c_build').capabilities).toBeNull();
        expect(capabilitiesOf(manifest, 'no_such_build').entry).toBeNull();
    });
});

describe('each predicate, false, names ITSELF', () => {
    const base = {
        flashPanel: { config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html' },
        transport: 'wasm',
        manifest: { builds: [{ name: 'seedling_bot_ap_p4d', capabilities: [AP_ITEM_CAPABILITY] }] },
        placement: OK_PLACEMENT,
        assets: OK_ASSETS,
    };

    it('all four true ⇒ eligible', () => {
        const v = seedlingRandomizerEligibility(base);
        expect(v.verdict).toBe('eligible');
        expect(v.eligible).toBe(true);
        expect(v.failed).toBeNull();
        expect(v.checks.map((c) => c.id)).toEqual([...ELIGIBILITY_CHECK_IDS]);
        expect(v.checks.every((c) => c.status === 'pass')).toBe(true);
    });

    it('(i) the FLASH transport is refused, by name, with the reason', () => {
        const v = seedlingRandomizerEligibility({ ...base, transport: 'flash' });
        expect(v.failed).toBe('transport');
        expect(v.why).toMatch(/wasm-only/);
    });

    it('(i) a preset with no `wasm` page is refused at the transport check', () => {
        const v = seedlingRandomizerEligibility({
            ...base, flashPanel: { config: 'robotkitty.json', swf: 'robotkitty_injected.swf' },
        });
        expect(v.failed).toBe('transport');
    });

    it('(ii) a build that declares no `apitem` is refused, by name', () => {
        const v = seedlingRandomizerEligibility({
            ...base,
            manifest: { builds: [{ name: 'seedling_bot_ap_p4d', capabilities: [] }] },
        });
        expect(v.failed).toBe('capability');
        expect(v.why).toMatch(/does not declare "apitem"/);
    });

    it('(ii) a build entry with NO capabilities field is refused, and says why', () => {
        const v = seedlingRandomizerEligibility({
            ...base, manifest: { builds: [{ name: 'seedling_bot_ap_p4d' }] },
        });
        expect(v.failed).toBe('capability');
        expect(v.why).toMatch(/declares no `capabilities` array/);
    });

    it('(ii) a preset pointing at a build the manifest does not publish', () => {
        const v = seedlingRandomizerEligibility({
            ...base, flashPanel: { wasm: 'seedling_bot_ap_p9z/game.html' },
        });
        expect(v.failed).toBe('capability');
        expect(v.why).toMatch(/no entry named "seedling_bot_ap_p9z"/);
    });

    it('(iii) ZERO resolved locations is the only placement refusal, and the count is reported', () => {
        const v = seedlingRandomizerEligibility({
            ...base, placement: { resolved: 0, total: 41, unresolved: [] },
        });
        expect(v.failed).toBe('placement');
        expect(v.why).toMatch(/0 of 41/);

        // ⛓ ONE is enough: the rest stay on the adapter's property path, which
        // is H6's existing contract (`hostOwnedLocations` is a SET).
        expect(seedlingRandomizerEligibility({
            ...base, placement: { resolved: 1, total: 41 },
        }).verdict).toBe('eligible');
    });

    it('(iv) an unreachable map is refused and NAMES the url and its source', () => {
        const v = seedlingRandomizerEligibility({
            ...base,
            assets: { ...OK_ASSETS, map: { url: '/atlases/nope.json', ok: false, source: 'region_atlas.map_document' } },
        });
        expect(v.failed).toBe('assets');
        expect(v.why).toMatch(/nope\.json/);
        expect(v.why).toMatch(/region_atlas\.map_document/);
    });
});

describe('an unresolved input is UNDECIDED, and never hides a real failure', () => {
    const cheap = {
        flashPanel: { wasm: 'seedling_bot_ap_p4d/game.html' },
        transport: 'wasm',
        manifest: { builds: [{ name: 'seedling_bot_ap_p4d', capabilities: [AP_ITEM_CAPABILITY] }] },
    };

    it('the two cheap checks alone ⇒ undecided, not ineligible', () => {
        const v = seedlingRandomizerEligibility(cheap);
        expect(v.verdict).toBe('undecided');
        expect(v.eligible).toBe(false);
        expect(v.failed).toBeNull();
        expect(v.why).toMatch(/^placement: /);
    });

    it('a cheap check that FAILS is decided immediately, without the heavy half', () => {
        expect(seedlingRandomizerEligibility({ ...cheap, transport: 'flash' }).verdict)
            .toBe('ineligible');
    });

    /**
     * ⛔⛔ A LATER *FAIL* OUTRANKS AN EARLIER *UNKNOWN*, and this is the row
     * for the shape it exists for: the map fetch dies, so (iv) FAILS — and
     * (iii), declared FIRST, could not even be evaluated because resolving the
     * ledger needs that very map. Reporting "undecided: placement" here would
     * tell the person nothing about the thing that actually broke.
     */
    it('an unknown (iii) does not mask a failing (iv)', () => {
        const v = seedlingRandomizerEligibility({
            ...cheap,
            assets: { recordSet: { url: '/a', ok: true }, map: { url: '/b', ok: false, source: 'x' } },
        });
        expect(v.verdict).toBe('ineligible');
        expect(v.failed).toBe('assets');
    });
});

describe('the THREE SHIPPED PRESETS against the SHIPPED manifest', () => {
    const rules = Object.fromEntries(
        Object.entries(PRESETS).map(([k, rel]) => [k, readJson(rel)]));

    it('all three name a wasm page, and it is the SAME build', () => {
        const names = Object.values(rules)
            .map((r) => buildNameFromWasmPath(r.flash_panel?.wasm));
        expect(new Set(names).size).toBe(1);
        expect(names[0]).toBeTruthy();
    });

    withSubmodule('every shipped preset is eligible on the shipped manifest', () => {
        const manifest = readJson(MANIFEST_PATH);
        for (const [name, r] of Object.entries(rules)) {
            const v = seedlingRandomizerEligibility({
                flashPanel: r.flash_panel,
                transport: 'wasm',
                manifest,
                placement: OK_PLACEMENT,
                assets: OK_ASSETS,
            });
            expect(v.verdict, `${name}: ${v.why}`).toBe('eligible');
        }
    });

    /**
     * ⛔⛔ THE MUTANT THE CONTROL ARM IS BUILT ON. Point the presets back at a
     * build that declares NOTHING and every one of them must go ineligible at
     * the CAPABILITY check — not at the transport, not at the placement. A
     * lookup that ignored `capabilities` would read all three as eligible and
     * the browser control arm is what would find it, an hour later.
     */
    withSubmodule('…and INELIGIBLE on a manifest entry that declares no apitem', () => {
        const manifest = readJson(MANIFEST_PATH);
        const stripped = {
            ...manifest,
            builds: manifest.builds.map((b) => ({ ...b, capabilities: [] })),
        };
        for (const [name, r] of Object.entries(rules)) {
            const v = seedlingRandomizerEligibility({
                flashPanel: r.flash_panel,
                transport: 'wasm',
                manifest: stripped,
                placement: OK_PLACEMENT,
                assets: OK_ASSETS,
            });
            expect(v.failed, name).toBe('capability');
        }
    });

    withSubmodule('the shipped manifest declares the vocabulary and nothing else', () => {
        const manifest = readJson(MANIFEST_PATH);
        for (const b of manifest.builds) {
            expect(Array.isArray(b.capabilities), `${b.name} has no capabilities array`).toBe(true);
            for (const cap of b.capabilities) expect(WASM_BUILD_CAPABILITIES).toContain(cap);
        }
        // ⛓ Exactly one build carries the class; a second would mean a default
        // moved without anyone saying so.
        const capable = manifest.builds.filter((b) => b.capabilities?.includes(AP_ITEM_CAPABILITY));
        expect(capable.map((b) => b.name)).toHaveLength(1);
    });
});
