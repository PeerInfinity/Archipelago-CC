// L40-CORNER: the game's sampled positions (legwitness.mjs --play's `samples`: [tick, level, x, y, hits]) against the
// model's run of the same plan on the same staging (scratch persistence); prints the alignment and every divergence.
//   node samples.mjs <plan.json> <game.json>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.cwd();
const { createRunForStaging } = await import(join(R, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { inventorySlotsFor } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { levelSourceFromAtlas } = await import(join(R, 'frontend/modules/seedlingDemo/atlasSource.js'));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { gunzipSync } = await import('node:zlib');
const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const fx = JSON.parse(gunzipSync(readFileSync(join(R, 'frontend/modules/seedlingDemo/fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz'))).toString('utf8'));
const { source } = restoreRequest(fx.requests[0].request);
const staging = { ...plan.staging, inventory_slots: inventorySlotsFor(plan.staging.seam?.items ?? {}) };
const run = createRunForStaging(staging, levelSourceFromAtlas(source.records), { scratchPersistence: true });
const eq = new Map(plan.equipsAt);
const pos = [[run.level, run.state.x, run.state.y, run.playerHits.length]];
plan.keys.forEach((k, i) => { if (eq.has(i)) run.equipNow(eq.get(i)); run.advance(new Set(k)); pos.push([run.level, run.state.x, run.state.y, run.playerHits.length]); });
for (const off of [-1, 0, 1]) {
    const bad = [];
    let n = 0;
    for (const [t, level, x, y, hits] of game.samples) {
        const m = pos[t + off];
        if (!m) continue;
        n += 1;
        const d = Math.hypot(m[1] - x, m[2] - y);
        if (m[0] !== level || d > 1e-6 || (hits ?? 0) !== m[3]) bad.push({ t, game: [level, x, y, hits], model: m, d });
    }
    console.log(`offset ${off}: ${n} sample(s) compared, ${bad.length} diverging${bad.length ? ` — first ${JSON.stringify(bad[0])}` : ''}`);
}
