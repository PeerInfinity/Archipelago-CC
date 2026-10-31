// scratch (SHIELDBUMP D2): pressEscape at SPIN's four stands, forecastShieldBump × PRESS_ESCAPE_SHIELD_CLAIM
const R = '/home/user/Archipelago-CC/';
const D = R + 'frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs');
const { gunzipSync } = await import('node:zlib');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { replayTape } = await import(D + 'jsRuntimeSolver.js');
const { pressEscape } = await import(D + 'solverBot.js');
const PG = await import(D + 'pressKillGuards.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const row = JSON.parse(gunzipSync(readFileSync(D + 'fixtures/spin-witness/leg860-request.json.gz')).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } },
    perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const STANDS = { certified: [808, 854, 'right'], envelope: [814, 854, 'right'], exhausted: [829, 860, 'left'], approach: [820, 854, 'right'] };
for (const key of [false, true]) for (const spin of [false, true]) {
    for (const [name, [x, y, k]] of Object.entries(STANDS)) {
        PG.resetPressEscapeShieldClaimCounts();
        const r = withContactFidelity({ forecastShieldBump: key }, () => PG.withPressEscapeShieldClaim(spin, () => {
            const run = standAt(x, y);
            return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([k])], pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' });
        }));
        const probe = withContactFidelity({ forecastShieldBump: key }, () => { const run = standAt(x, y); return run.spinnerForecastWithPress(0, { pressAt: run.ticksCompleted + 1, direction: 0, id: 'spinner@816,848', positions: [] }).unmodelled; });
        console.log(JSON.stringify({ key, spin, stand: name, ok: r.ok, claim: r.claim, bound: r.bound ?? null, keys: r.keys?.length ?? null,
            shieldOnlyUnmodelled: PG.shieldOnlyUnmodelled(probe), counts: { ...PG.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, why: (r.why ?? '').slice(0, 110) }));
    }
}
