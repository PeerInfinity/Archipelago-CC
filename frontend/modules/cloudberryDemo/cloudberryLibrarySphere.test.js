/**
 * A SPHERE world from the demo Cloudberry pack (P3a): the pack the only content source.
 * Before P3a the sphere library source picked entries by sides and slot count alone and a
 * library-only world had no goal — the oracle reported "sphere count mismatch: computed 1,
 * planned 3" and Victory was never placed. Now the entry's real geometry decides
 * (`libraryEntryFitsSpecs`) and the library's substrate supplies the goal
 * (presetRun's `selectedItemSubstrates`). Pure JS: library entries need no generator.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import './cloudberryLibrary.js';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';

const PACK = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),
    '../../region-libraries/demo-cloudberry-pack.json'), 'utf8'));

const ev = (r, inv) => {
    if (!r) return true;
    if (r.rule === 'True_') return true;
    if (r.rule === 'Has') return (inv[r.args.item_name] ?? 0) >= (r.args.count ?? 1);
    if (r.rule === 'And') return r.children.every((c) => ev(c, inv));
    if (r.rule === 'Or') return r.children.some((c) => ev(c, inv));
    return false;
};
/** Sweep the compiled world from Menu: what a player can reach and collect. */
function sweep(rules) {
    const regs = rules.regions['1'];
    const inv = {};
    const reach = new Set(['Menu']);
    const got = new Set();
    for (let changed = true; changed;) {
        changed = false;
        for (const r of [...reach]) {
            for (const e of regs[r].exits ?? []) {
                if (!reach.has(e.connected_region) && ev(e.access_rule, inv)) { reach.add(e.connected_region); changed = true; }
            }
            for (const l of regs[r].locations ?? []) {
                if (got.has(l.name) || !ev(l.access_rule, inv)) continue;
                got.add(l.name);
                const it = l.item?.name ?? l.item;
                if (it) inv[it] = (inv[it] ?? 0) + 1;
                changed = true;
            }
        }
    }
    return { inv, reach };
}

const state = (seed) => ({
    mode: 'sphereGrowth',
    params: { seed, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2, sphereCount: 3, fillerCount: 0, revisitPercent: 0 },
    scenario: { items: { 'Moving Blocks': 1, 'Bouncy Blocks': 1, Victory: 1 }, obstacles: {} },
    substrateQuotas: {}, substrateMix: {}, substrateMode: 'quotas',
});

describe('a sphere world built from the demo Cloudberry pack', () => {
    for (const seed of [1, 2, 3]) {
        it(`seed ${seed}: the oracle holds, every region is reachable, Victory placed and reachable`, async () => {
            const r = await runPresetHeadless(buildRunFromState(state(seed), { resolvedLibraries: [{ library: PACK, count: 7 }] }));
            expect(r.oracleErrors).toEqual([]);
            const regs = r.rulesJson.regions['1'];
            const { inv, reach } = sweep(r.rulesJson);
            expect(reach.size).toBe(Object.keys(regs).length);
            expect(inv.Victory).toBe(1);
            const subs = Object.values(r.rulesJson.preset_sidecars['1']).map((v) => v.substrate);
            expect(subs).toEqual(['cloudberry', 'cloudberry', 'cloudberry']);
            // Each region's way back (the start door) is free.
            for (const v of Object.values(r.rulesJson.preset_sidecars['1'])) {
                const back = v.playable_payload?.params?.backExitSide;
                if (back) expect(v.playable_payload.exits.find((e) => e.side === back)).toBeTruthy();
            }
        });
    }
});
