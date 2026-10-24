// SCRATCH (SFF): pressKillCost row 342's on/off derivations, field by field, under the floor at FLOOR.
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withPressKillCost, withStrikeScanCost } = await import(M + 'pressKillCost.js');
const { deriveStrike, withStrikeEtaFloor } = await import(M + 'solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/hammer-p1-l40-south-boot.json', 'utf8'))));
const derivations = (on) => withPressKillCost(true, () => withStrikeScanCost(on, () => {
    const run = createRunForStaging(staging, atlasLevelSource());
    const first = deriveStrike(run, 'spinner@880,848', new Set(), 0, { continuation: true });
    const again = deriveStrike(run, 'spinner@880,848', new Set(), 0);
    const far = deriveStrike(run, 'spinner@192,144', new Set(), 0);
    return { first, again, far };
}));
const floor = process.argv[2] !== 'off';
withStrikeEtaFloor(floor, () => {
    const on = JSON.parse(JSON.stringify(derivations(true)));
    const off = JSON.parse(JSON.stringify(derivations(false)));
    for (const k of ['first', 'again', 'far']) {
        const keys = new Set([...Object.keys(on[k] ?? {}), ...Object.keys(off[k] ?? {})]);
        for (const f of keys) {
            const a = JSON.stringify(on[k]?.[f]), b = JSON.stringify(off[k]?.[f]);
            if (a !== b) console.log(k, f, 'ON:', a?.slice(0, 300), '| OFF:', b?.slice(0, 300));
        }
        console.log(k, 'cell', JSON.stringify(on[k]?.cell), 'unreachable', on[k]?.unreachable, off[k]?.unreachable);
    }
});
