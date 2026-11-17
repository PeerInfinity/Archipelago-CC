/**
 * mazeSetMapUnreachable.test — **THE MAZE REPORT'S UNREACHABLE REGIONS, AS ROOMS OF THE MAZE LAB MAP** (slice
 * `maze-map-unreachable`).
 *
 * The maze lab's map provider (`mazeSetMap.createMazeSetMap`) answers `setEditorView`'s optional `unreachableOf` with
 * the lifted `procgenCore/setMapUnreachable.unreachableRoomsOf`. Every claim is against a REAL maze REPORT
 * (`setEditorCore.reportOver` over `mazeSetLab.mazeSetBindings`, the binding the lab mounts), never a hand-typed list.
 *
 * MUTANTS (each reds a row): the provider's hook removed (the provider row); join by position in `atlas.regions`
 * instead of `map_ref` (the reorder row); mark every compiled region (the closed-chain row).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reportOver } from '../procgenCore/setEditorCore.js';
import { unreachableRoomsOf } from '../procgenCore/setMapUnreachable.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { unreachableRoomsOf as seedlingUnreachableRoomsOf } from '../seedlingDemo/seedlingSetMapUnreachable.js';
import { createMazeSetAdapter, createSetSession, emptyMazeOverlay, setRecord } from './mazeSetAdapter.js';
import { mazeSetBindings } from './mazeSetLab.js';
import { createMazeSetMap } from './mazeSetMap.js';

const PACK = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../region-libraries/demo-maze-pack.json', import.meta.url)), 'utf8'));
const RULES_SCHEMA = loadRulesSchema();
const ATLAS_SCHEMA = loadAtlasSchema();
const BINDINGS = mazeSetBindings({ rulesSchema: RULES_SCHEMA });

/** The demo pack wired as a CHAIN, 0 ↔ 1 ↔ 2 ↔ 3, through the adapter's own `connect` op. */
const CHAIN = Object.freeze([
    { from: [0, 'exit_1'], to: [1, 'exit_3'] },
    { from: [1, 'exit_1'], to: [2, 'exit_3'] },
    { from: [2, 'exit_1'], to: [3, 'exit_3'] },
]);
const chainSession = () => {
    const s = createSetSession(createMazeSetAdapter({ rulesSchema: RULES_SCHEMA }), setRecord(PACK, emptyMazeOverlay()));
    for (const l of CHAIN) expect(s.apply({ op: 'connect', from: l.from, to: l.to, one_way: false }).ok).toBe(true);
    return s;
};
const report = (s) => reportOver({
    session: s, deps: {}, adapterFns: BINDINGS.adapterFns, document: BINDINGS.document, ruleKeys: BINDINGS.ruleKeys,
    compileRegionAtlas, validateRegionAtlas, atlasSchema: ATLAS_SCHEMA,
});
/** The REPORT's own `reach` error rows, as region names. */
const reachRows = (rep) => rep.rows.filter((r) => r.kind === 'reach' && r.severity === 'error')
    .map((r) => /region "([^"]+)"/.exec(r.text)[1]);

describe('⛓ maze-map-unreachable — the maze REPORT\'s unreachable regions → the rooms the maze map marks', () => {
    it('the maze REPORT carries what the join needs: compiled rules, its derived atlas, map_ref = the entry index', () => {
        const rep = report(chainSession());
        expect(rep.rules).toBeTruthy();
        expect(rep.derivedParts).toBe(null);
        expect(rep.atlas.regions.map((r) => r.map_ref)).toEqual(PACK.entries.map((_, i) => i));
    });

    it('a chain that closes marks NO room (and the REPORT names none)', () => {
        const rep = report(chainSession());
        expect(reachRows(rep)).toEqual([]);
        expect(unreachableRoomsOf(rep)).toEqual([]);
    });

    it('a disconnected link marks exactly the rooms the REPORT names, each by its own map_ref', () => {
        const s = chainSession();
        expect(s.apply({ op: 'disconnect', room: 1, exit_id: 'exit_1' }).ok).toBe(true);
        const rep = report(s);
        const marks = unreachableRoomsOf(rep);
        expect(marks.map((m) => m.room)).toEqual([2, 3]);
        expect(marks.every((m) => m.partial === false)).toBe(true);
        expect(marks.flatMap((m) => m.regions).sort()).toEqual(reachRows(rep).sort());
        for (const m of marks) {
            for (const name of m.regions) {
                expect(rep.atlas.regions.find((r) => r.region_id === name).map_ref).toBe(m.room);
            }
        }
    });

    it('the join is map_ref, not the atlas list order (a reordered atlas marks the same rooms)', () => {
        const s = chainSession();
        s.apply({ op: 'disconnect', room: 2, exit_id: 'exit_1' });
        const rep = report(s);
        const reversed = { ...rep, atlas: { ...rep.atlas, regions: [...rep.atlas.regions].reverse() } };
        expect(unreachableRoomsOf(reversed)).toEqual(unreachableRoomsOf(rep));
        expect(unreachableRoomsOf(rep).map((m) => m.room)).toEqual([3]);
    });

    it('the maze map provider carries the hook, and it is the SAME function Seedling\'s provider answers with', () => {
        const s = chainSession();
        s.apply({ op: 'disconnect', room: 1, exit_id: 'exit_1' });
        const rep = report(s);
        const provider = createMazeSetMap();
        expect(typeof provider.unreachableOf).toBe('function');
        expect(provider.unreachableOf(rep)).toEqual(unreachableRoomsOf(rep));
        expect(seedlingUnreachableRoomsOf).toBe(unreachableRoomsOf);
    });
});
