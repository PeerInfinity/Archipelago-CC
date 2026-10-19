#!/usr/bin/env node
// bw-solve.mjs --lapse=0|1 [--out=<tape.json>] — hammer BW's bombstand ON solve (MOVING_WAIT + PRESS_KILL_BOMBS ON),
// the process's switches otherwise (SEEDLING_BOMB_BLAST_BODY=1 for the D2/D3 arm). Prints ticks, the refusal, the
// player's hits, the bomb body-hit ledger, the end digest and the keys' md5; --out writes the executed keys as a tape.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const lapse = arg('lapse') === '1';
const P = await import(join(REPO, 'scripts', 'procgen', 'plan-seedling-hammer-bw-bombstand.mjs'));
const { solveSegment, withMovingWait } = await import(join(MODULE, 'solverBot.js'));
const { withContactFidelity, CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));
const { withPressKillBombs } = await import(join(MODULE, 'pressKillCost.js'));
const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { L40BUTTON_GOAL } = await import(join(REPO, 'scripts', 'procgen', 'plan-seedling-l40button-witness.mjs'));
const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
const staging = await P.bombStandStaging();
const run = createRunForStaging(staging, atlasLevelSource());
const keys = [];
const advance = run.advance;
run.advance = (held) => { keys.push(new Set(held)); return advance.call(run, held); };
let message = null;
let result = null;
const t0 = Date.now();
withContactFidelity({ strikeIframeLapse: lapse }, () => withMovingWait(true, () => withPressKillBombs(true, () => {
    try {
        result = solveSegment({ run, goals: [JSON.parse(JSON.stringify(L40BUTTON_GOAL))], name: P.NAME, boot: staging.boot,
            dashMode: 'all' });
    } catch (e) { message = String(e?.message ?? e); }
})));
const keyText = keys.map((s) => [...s].sort().join('+')).join(',');
console.log(JSON.stringify({
    lapse, bombBlastBody: CONTACT_FIDELITY.bombBlastBody ?? null, wallSec: Math.round((Date.now() - t0) / 1000),
    ticks: keys.length, ticksCompleted: run.ticksCompleted, outcome: message ? 'threw' : 'returned', resultKeys: result ? Object.keys(result).slice(0, 12) : null, solved: result?.solved ?? result?.ok ?? null,
    message: message?.slice(0, 600) ?? null,
    hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
    bodyHits: (run.ledger('bombEvents') ?? []).filter((h) => h.what === 'body-hit').map((h) => [h.t, h.id, h.body, h.arm, h.hitsAfter, h.killed ? 'killed' : (h.refusedAt ? 'refused' : 'landed')]),
    blasts: (run.ledger('bombEvents') ?? []).filter((e) => e.what === 'blast').map((e) => [e.t, e.id.split('#')[1], e.at.x, e.at.y, e.hitPlayer ? 'HIT' : '']),
    digest: typeof run.stateDigest === 'function' ? run.stateDigest() : null,
    keysMd5: createHash('md5').update(keyText).digest('hex'),
}));
const OUT = arg('out');
if (OUT) writeFileSync(OUT, `${JSON.stringify(buildStagedTape({ staging, perTick: keys, name: `bw-solve-lapse${lapse ? 1 : 0}` }))}\n`);
