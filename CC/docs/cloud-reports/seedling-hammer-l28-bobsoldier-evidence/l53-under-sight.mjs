#!/usr/bin/env node
// EVIDENCE (slice seedling-hammer-l28-bobsoldier). Nothing tracked is edited. L53-KILLLOCK's three captured legs
// (`hammerL53Killlock.test.js`'s fixtures and its `solveLeg`, verbatim in shape), each under `KILLLOCK_CHASER_REWIND`
// OFF / ON crossed with `KILL_STANCE_SIGHT` OFF / ON: outcome, ticks, the fresh replay's hits / deaths / level, and
// the sight switch's counts.
//   node CC/docs/cloud-reports/seedling-hammer-l28-bobsoldier-evidence/l53-under-sight.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const ROOT = process.env.ARCHCC_ROOT ?? '/home/user/Archipelago-CC';
const M = join(ROOT, 'frontend/modules/seedlingDemo');
const SB = await import(join(M, 'solverBot.js'));
const { restoreRequest } = await import(join(ROOT, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await import(join(M, 'atlasSource.js'));
const { ANYTIME_PASSES, replayTape, solveAnytime } = await import(join(M, 'jsRuntimeSolver.js'));
const FIX = (n) => JSON.parse(gunzipSync(readFileSync(join(M, 'fixtures', 'hammer-l53-killlock', n))).toString('utf8'));
const LEGS = { 9001: 'leg9001-l51-l53-retry2560-request.json.gz', 9002: 'leg9002-l48-l53-retry2560-request.json.gz',
    482: 'leg482-l54-l53-request.json.gz' };
for (const [name, file] of Object.entries(LEGS)) {
    const leg = FIX(file);
    for (const rewind of [false, true]) {
        for (const sight of [false, true]) {
            const req = restoreRequest(leg.requests[0].request);
            const { passes: asked = ANYTIME_PASSES, source, ...tape } = req;
            const passes = asked.filter((p) => p.pass === 'dashless');
            const levelSource = levelSourceFromAtlas(source.records);
            SB.KILL_STANCE_SIGHT.counts.asks = 0;
            SB.KILL_STANCE_SIGHT.counts.refused = 0;
            const t0 = Date.now();
            const answer = SB.withKillStanceSight(sight, () => SB.withKillLockChaserRewind(rewind,
                () => solveAnytime({ ...tape, source, levelSource }, { passes })));
            const row = { leg: Number(name), rewind, sight, ms: Date.now() - t0, ok: answer.ok,
                counts: { ...SB.KILL_STANCE_SIGHT.counts } };
            if (answer.ok) {
                const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
                    levelSource, scratchPersistence: tape.scratchPersistence });
                const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
                Object.assign(row, { ticks: answer.plan.solution.length,
                    planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12), level: fresh.level,
                    hits: fresh.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
                    deaths: fresh.ledger('playerDeaths').length });
            } else row.message = String(answer.message ?? '').slice(0, 220);
            console.log(JSON.stringify(row));
        }
    }
}
