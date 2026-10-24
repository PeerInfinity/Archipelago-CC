/**
 * omsiSubstrateWrapper/exitActions — the synthetic exit actions' NAMES are keyed
 * by the exit (PIPELINE RELAYOUT R2). The fork keys an action by its name with
 * the spaces removed and refuses a key it already holds
 * (`omsi-loops/managed.js` `injectSyntheticAction`); `forkKey` below states that
 * rule so the rows can ask whether two actions would collide.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { exitActionLabel, syntheticExitActions } from './exitActions.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** The fork's key for an action name (`name.replace(/ /gu, "")`, managed.js). */
const forkKey = (name) => name.replace(/ /gu, '');

describe('⛓⛓ two exits of one region on ONE side register TWO actions', () => {
    const exits = [
        { exit_id: 'exit_W', exitName: 'exit_W', side: 'W', targetRegion: 'region_0_0' },
        { exit_id: 'exit_W2', exitName: 'exit_W2', side: 'W', targetRegion: 'region_0_0' },
    ];

    it('the premise: their LABELS are one label (the key the fork used to receive)', () => {
        expect(exitActionLabel(exits[0])).toBe(exitActionLabel(exits[1]));
    });

    it('their names — and the fork\'s keys — are distinct, each carrying its exit and readable label', () => {
        const actions = syntheticExitActions(exits);
        expect(actions.map((a) => a.exitName)).toEqual(['exit_W', 'exit_W2']);
        expect(new Set(actions.map((a) => forkKey(a.name))).size).toBe(exits.length);
        for (const a of actions) {
            expect(a.name.startsWith(a.label)).toBe(true);
            expect(a.name).toContain(a.exitName);
        }
    });

    it('a dangling exit (no targetRegion) registers nothing', () => {
        expect(syntheticExitActions([{ exit_id: 'x', exitName: 'x', side: 'N' }])).toEqual([]);
    });
});

describe('⛓ the committed omsi regions: every action key is distinct within its region', () => {
    const dir = join(ROOT, 'frontend', 'presets', 'omsi_region_split_test');
    const docs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())
        .flatMap((d) => readdirSync(join(dir, d.name)).filter((f) => f.endsWith('_rules.json'))
            .map((f) => JSON.parse(readFileSync(join(dir, d.name, f), 'utf8'))));

    it('the population is not vacuous, and holds a region with two exits on one side', () => {
        const omsi = docs.flatMap((doc) => Object.values(doc.preset_sidecars ?? {}).flatMap((s) => Object.values(s)))
            .filter((e) => e.substrate === 'omsi');
        expect(omsi.length).toBeGreaterThan(0);
        expect(omsi.some((e) => {
            const sides = (e.playable_payload.exits ?? []).map((x) => x.side);
            return sides.length !== new Set(sides).size;
        })).toBe(true);
        for (const e of omsi) {
            const actions = syntheticExitActions(e.playable_payload.exits);
            expect(actions.length).toBe((e.playable_payload.exits ?? []).filter((x) => x.targetRegion).length);
            expect(new Set(actions.map((a) => forkKey(a.name))).size).toBe(actions.length);
        }
    });
});
