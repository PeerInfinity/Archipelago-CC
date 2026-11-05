/**
 * seedlingDemo/hammerKeygateYield.test — ⛓⛓ SEEDLING HAMMER-PHASE KEYGATE-YIELD (`COLLECT_RESTANCE`, OFF): a
 * corridorless collect stance is re-derived once the walk's ladder has opened the way (`collectReaim`, `walkTo`'s
 * `reaim`). The rows:
 *   · SHIPS OFF, and the env alone turns it on;
 *   · the captured room (the lab's keygate, bushy 14x14 seed 3 pre-sword): OFF refuses by its text, the walk aimed at
 *     (24,104) beyond `torchpickup@32,96` with the lock open; ON the aim is replaced ONCE, by the near-side cell
 *     (56,104), and the room certifies;
 *   · a keygate room that already certifies (empty 10x10 seed 1 pre-sword) answers ON exactly as OFF;
 *   · the walk is handed `reaim` only behind the switch (a source row).
 * Mutants (the report § 5): the `attempt > 0` guard dropped, the corridor test dropped (`corridor === false` accepted),
 * and the call-site gate dropped.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { solve } from './procgenOracle.js';
import { atlasOf } from './procgenLevel.js';
import {
    COLLECT_RESTANCE, COLLECT_RESTANCE_COUNTS, COLLECT_RESTANCE_DEFAULT, collectReaim, resetCollectRestanceCounts,
    withCollectRestance,
} from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', name), 'utf8'));
const answer = (f) => {
    const out = solve(f.levelRecord, f.staging, f.goals, f.budget, { name: f.name });
    return { verdict: out.verdict, reasonText: out.reasonText ?? null, ticks: out.ticksSpent ?? null,
        rows: JSON.stringify(out.rows ?? null) };
};

describe('hammer-phase KEYGATE-YIELD: COLLECT_RESTANCE', () => {
    it('ships OFF, and the env alone turns it on', () => {
        expect(COLLECT_RESTANCE_DEFAULT).toBe(false);
        expect(COLLECT_RESTANCE.enabled).toBe(globalThis.process?.env?.SEEDLING_COLLECT_RESTANCE === '1');
        withCollectRestance(true, () => expect(COLLECT_RESTANCE.enabled).toBe(true));
        withCollectRestance(false, () => expect(COLLECT_RESTANCE.enabled).toBe(false));
    });

    it('the captured keygate room: OFF refuses at the stale aim beyond the torch; ON re-derives once and certifies', () => {
        const f = fixture('hammer-keygate-yield-bushy14-s3.json');
        resetCollectRestanceCounts();
        const off = withCollectRestance(false, () => answer(f));
        expect(off.verdict).toBe('REFUSED');
        expect(off.reasonText).toMatch(/no corridor for goal collect-placement toward \(24,104\) in level 900\. Obstacle: pickup:torchpickup \(torchpickup@32,96\)/);
        expect(off.reasonText).toMatch(/no walkable tile path in level 900 from tile \(3,8\) to \(1,6\)/);
        expect(COLLECT_RESTANCE_COUNTS.restances).toEqual([]);
        const on = withCollectRestance(true, () => answer(f));
        expect(on.verdict).toBe('SOLVED');
        // one re-aim exactly: the array matched whole (a second entry would not match)
        expect(COLLECT_RESTANCE_COUNTS.restances).toMatchObject([{ attempt: 1, from: { x: 24, y: 104 }, to: { x: 56, y: 104 } }]);
        resetCollectRestanceCounts();
    }, 120000);

    it('a keygate room that already certifies answers ON exactly as OFF', () => {
        const f = fixture('hammer-keygate-yield-empty10-s1.json');
        resetCollectRestanceCounts();
        const off = withCollectRestance(false, () => answer(f));
        expect(off.verdict).toBe('SOLVED');
        const on = withCollectRestance(true, () => answer(f));
        expect(on).toEqual(off);
        expect(COLLECT_RESTANCE_COUNTS.restances).toEqual([]);
    }, 120000);

    it('`collectReaim` answers null while the stance is still corridorless (the lock shut)', () => {
        const f = fixture('hammer-keygate-yield-bushy14-s3.json');
        const run = createRunForStaging(f.staging, levelSourceFromAtlas(atlasOf(f.levelRecord)), { scratchPersistence: true });
        const torch = run.world.pickups.find((p) => p.tag === 'torchpickup');
        const reaim = collectReaim(run, { strategy: 'collect', target: torch }, false);
        // at the boot the torch's pocket is sealed behind `bosslock@48,112`: every ring cell is corridorless
        expect(run.entities('openActivators').has('bosslock@48,112')).toBe(false);
        expect(reaim(new Set())).toBe(null);
    }, 60000);

    it('the walk is handed `reaim` only behind the switch, and only for a corridorless stance', () => {
        const src = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
        const sites = src.split('\n').filter((l) => /reaim: collectReaim\(/.test(l));
        expect(sites).toHaveLength(1);
        expect(src).toMatch(/\.\.\.\(COLLECT_RESTANCE\.enabled && stance\.corridor === false\n\s+\? \{ reaim: collectReaim\(run, resolved, economies\) \} : \{\}\)/);
        expect(src).toMatch(/if \(reaim !== null && attempt > 0 && !fineFirst\) \{/);
    });
});
