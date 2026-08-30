/**
 * G1 — preset bot-replay gate (runner test-strategy rebalance §2, the headline
 * replacement for the demoted generate-and-verify matrix rows).
 *
 * Reads the COMMITTED preset artifacts (runner_worldgen + runner_sphere_worldgen
 * rules.json — no generation at all) and drives the real createBotDriver through
 * EVERY goal (pickup + portal) of every runner region, under two item sets:
 *   (a) the region's own gate requirement (union of every goal's minimal
 *       ability set — the committed-region analogue of the flagship zone test's
 *       zone.spec.requirement), and
 *   (b) the FULL ability vocabulary — the superset where the §4.10 budget-mirage
 *       play-hostility class bites (a Double-Jump shortcut feasible only at
 *       fresh budget, proposed after a bed spent it).
 * Every goal must COMPLETE, with zero deaths and zero foreign (non-target)
 * portal fires — the same standard a human player is held to, on the exact
 * artifacts users load. Cheaper AND stronger than a matrix row (~1.5 s/region/
 * set), and the stratum that caught both shipped play-hostility bugs
 * (tipTrap, budgetMirage). Portals are all OPEN (gate states default true) —
 * the hardest case for blocked-host avoidance.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGameSession, ABILITY_ITEM_NAMES } from './gameCore.js';
import { createBotDriver } from './botDriver.js';
import { deriveGeneratedRules } from './generator.js';

const SEED_ID = 'AP_14089154938208861744';
const PRESETS = [
    ['runner_worldgen', `frontend/presets/runner_worldgen/${SEED_ID}/${SEED_ID}_rules.json`],
    ['runner_sphere_worldgen', `frontend/presets/runner_sphere_worldgen/${SEED_ID}/${SEED_ID}_rules.json`],
];

/** Every runner region in a committed preset's sidecars, with its level and
 *  the physics constants it was authored under. Non-runner regions (mixed
 *  worlds) carry no runnerLevel and are skipped. */
function runnerRegions(rulesPath) {
    const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
    const sidecars = rules.preset_sidecars?.['1'] ?? {};
    const out = [];
    for (const [regionId, sc] of Object.entries(sidecars)) {
        const params = sc.playable_payload?.params;
        if (!params?.runnerLevel) continue;
        out.push({ regionId, level: params.runnerLevel, constants: params.physics?.constants });
    }
    return out;
}

describe('G1 — committed runner presets are bot-play-clean', () => {
    for (const [presetName, rulesPath] of PRESETS) {
        for (const { regionId, level, constants } of runnerRegions(rulesPath)) {
            it(`${presetName}/${regionId}: every goal bot-completable (entry items + full vocab)`, () => {
                // The region's own gate requirement, derived from its committed
                // geometry: the union of every goal's minimal ability set.
                const derived = deriveGeneratedRules(level, constants);
                expect(derived.defects, `${presetName}/${regionId} committed geometry has defects`)
                    .toEqual([]);
                const abilities = new Set();
                for (const g of [...Object.values(derived.pickups), ...Object.values(derived.exits)]) {
                    for (const a of (g.minimalSets[0] ?? [])) abilities.add(a);
                }
                const entryItems = [...abilities].map((a) => ABILITY_ITEM_NAMES[a]);
                const fullItems = Object.values(ABILITY_ITEM_NAMES);

                const targets = [
                    ...level.pickups.map((p) => ({ kind: 'pickup', id: p.id })),
                    ...level.portals.map((p) => ({ kind: 'portal', id: p.id })),
                ];

                for (const items of [entryItems, fullItems]) {
                    // One session + driver per item set; targets drive in
                    // sequence, exactly as loops/the flagship zone gate replay
                    // (state carries; a goal behind the player triggers a reset).
                    const session = createGameSession(level, { constants });
                    session.setItems(items);
                    const helpers = {
                        isPortalOpen: (id) => session.gateStates.portals[id] !== false,
                        isPickupOpen: (id) => session.gateStates.pickups[id] !== false,
                    };
                    const driver = createBotDriver();
                    for (const target of targets) {
                        driver.setTarget({ ...target });
                        let done = false;
                        let deaths = 0;
                        let foreign = 0;
                        for (let f = 0; f < 12000 && !done; f++) {
                            const bot = driver.nextInput(
                                session.state, level, session.abilities, helpers);
                            for (const ev of session.tick({
                                jump: !!bot?.jump, drop: !!bot?.drop, reset: !!bot?.reset,
                            })) {
                                if (ev.type === 'respawned' && ev.cause !== 'reset') deaths += 1;
                                if (ev.type === 'exit') {
                                    const pid = ev.id ?? ev.portalId;
                                    if (target.kind === 'portal' && pid === target.id) done = true;
                                    else foreign += 1;
                                }
                                if (ev.type === 'pickup' && target.kind === 'pickup'
                                        && ev.id === target.id) done = true;
                            }
                        }
                        const label = `${presetName}/${regionId} [${items.join(',') || 'no items'}]`
                            + ` ${target.kind}:${target.id}`;
                        expect(done, `${label} not completed`).toBe(true);
                        expect(deaths, `${label} deaths`).toBe(0);
                        expect(foreign, `${label} foreign portal fires`).toBe(0);
                    }
                }
            }, 60000);
        }
    }
});
