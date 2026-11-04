// scratch (BK2COMBAT): hammerSpinnerPress.slow's leg 860 under A5 (SPIN's switch OFF), CHASER_STAGED_HUNT OFF/ON. Decides nothing.

import { appendFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
{
    const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
    const { withContactFidelity } = await import(M + 'contactFidelity.js');
    const { ANYTIME_PASSES, solveAnytime } = await import(M + 'jsRuntimeSolver.js');
    const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
    const SB = await import(M + 'solverBot.js');
    const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
    for (const on of [false, true]) {
        const row = JSON.parse(gunzipSync(readFileSync(join(M, 'fixtures', 'spin-witness', 'leg860-request.json.gz'))).toString('utf8'));
        const c = row.request;
        const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
        SB.resetChaserStagedHuntCounts();
        SB.CHOOSER_PAIR.size = 3;
        const a = SB.withChaserStagedHunt(on, () => SB.withChooserPair(true, () => SB.withIceTurretStaticKill(true, () => withOpportunisticStrike(true,
            () => SB.withLatchWeighFirst(true, () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true },
                () => solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) }, { passes })))))));
        appendFileSync(process.argv[2], ['SPIN860', on ? 'ON' : 'OFF', a.ok ? 'SOLVED ' + a.plan.solution.length : 'REFUSED', JSON.stringify(SB.CHASER_STAGED_HUNT_COUNTS.asks),
            String(a.message ?? '').slice(0, 300), '…', String(a.message ?? '').slice(-700)].join(' ') + '\n');
    }
}
