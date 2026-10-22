// BOSSFORK: replay a captured request's perTick prefix on the model (its own contactFidelity) and report the beast/mouth.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { withContactFidelity } = await import(R + 'frontend/modules/seedlingDemo/contactFidelity.js');
const [file, id, i] = process.argv.slice(2);
const row = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = restoreRequest(row.requests[Number(i)].request);
const ls = levelSourceFromAtlas(req.source.records);
withContactFidelity(req.contactFidelity, () => {
    const run = createRunForStaging(req.staging, ls, { scratchPersistence: req.scratchPersistence });
    let mouthAt = null; let reportAt = null;
    req.perTick.forEach((k, t) => {
        run.advance(k);
        const f = run.entities('tentacleBeastFight');
        if (mouthAt === null && run.world.teleporters.some((x) => x.runtime === 'tentacle_beast_mouth')) mouthAt = t + 1;
        if (reportAt === null && f?.report) reportAt = t + 1;
    });
    const f = run.entities('tentacleBeastFight');
    console.log('ticks', req.perTick.length, 'level', run.level, 'pos', run.state.x, run.state.y, 'beast', f?.beast?.anim, 'dead', f?.beast?.dead,
        'maxTentacles', f?.beast?.maxTentacles, 'report', JSON.stringify(f?.report), 'reportAt', reportAt, 'mouthAt', mouthAt,
        'earned', JSON.stringify(run.earnedClears), 'hits', run.damage?.hits, 'deaths', run.playerDeaths.length);
    console.log('tentacleBeastEvents tail', JSON.stringify((run.tentacleBeastEvents ?? []).slice(-6)).slice(0, 900));
});
