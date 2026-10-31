// scratch (SHIELDBUMP D1 witness): at SPIN's stands on leg 860's staging, DRIVE a fresh run along the aim, the press and
// a stood train (+ `--hold=<key>` ticks after, to walk INTO the body), record the player's state at the top of every tick
// and the run's spinner rects after it, then ask spinnerForecastWithPress (players = the driven states) and the fight
// cursor (advance(state, press)) from a SECOND fresh run at the stand, with forecastShieldBump OFF and ON. Prints, per
// stand and arm: the run's spinner bumps, the first row the forecast leaves the run and the worst px, the unmodelled list.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const R = args.root ?? '/tmp/claude-0/sbwt/';
const D = R + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { replayTape } = await import(D + 'jsRuntimeSolver.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const row = JSON.parse(gunzipSync(readFileSync(D + 'fixtures/spin-witness/leg860-request.json.gz')).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: Number(args.seam ?? 5950) } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } },
    perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null,
    holds: REQ.holds ?? null });
const STANDS = { certified: [808, 854, 'right'], envelope: [814, 854, 'right'], exhausted: [829, 860, 'left'],
    approach: [820, 854, 'right'], ...(args.stand ? { custom: JSON.parse(args.stand) } : {}) };
const NO = new Set();
const hold = Number(args.hold ?? 0);
const train = Number(args.train ?? 6);
for (const [name, [x, y, key]] of Object.entries(STANDS)) {
    const keys = [new Set([key]), new Set(['primary'])];
    for (let k = 0; k < train; k += 1) keys.push(NO);
    for (let k = 0; k < hold; k += 1) keys.push(new Set([args.holdKey ?? key]));
    const drive = standAt(x, y);
    const n = drive.ticksCompleted;
    const states = [];
    const runRows = [];
    const b0 = drive.shieldBumps.length;
    for (const k of keys) {
        states.push({ ...drive.state });
        drive.advance(k);
        runRows.push((drive.entities('spinnerBodies') ?? []).map((b) => b.rect));
    }
    states.push({ ...drive.state });
    const bumps = drive.shieldBumps.slice(b0).filter((b) => b.family === 'spinner').map((b) => `t${b.t - 1}:${b.id}:${b.shoved ? 'shoved' : b.why}`);
    const cmp = (rows) => {
        let firstErr = -1; let worst = 0;
        rows.forEach((r, i) => {
            if (!runRows[i]) return;
            r.forEach((rect, k) => {
                const b = runRows[i][k];
                if (!b) return;
                const d = Math.max(Math.abs(b.x - rect.x), Math.abs(b.y - rect.y));
                if (d > 0 && firstErr < 0) firstErr = i;
                worst = Math.max(worst, d);
            });
        });
        return { firstErr, worst: +worst.toFixed(3) };
    };
    const out = { stand: name, ticks: keys.length, runBumps: bumps, hits: drive.playerHits.length };
    for (const on of [false, true]) {
        withContactFidelity({ forecastShieldBump: on }, () => {
            const run = standAt(x, y);
            const at = (t) => states[t - n] ?? null;
            const pressDir = states[1].direction;
            const f = run.spinnerForecastWithPress(keys.length, { pressAt: n + 1, direction: pressDir,
                positions: at, players: at });
            const F = run.spinnerFightForecast();
            for (let i = 0; i < keys.length; i += 1) F.advance(states[i], i === 1 ? { direction: pressDir } : null);
            out[on ? 'ON' : 'OFF'] = { press: { ...cmp(f.rows), unmodelled: f.unmodelled.length,
                bumps: f.shieldBump?.bumps.map((b) => `t${b.t}:${b.id}`) ?? null },
            cursor: { ...cmp(F.rows), unmodelled: F.unmodelled.length, bumps: F.shieldBumps?.map((b) => `t${b.t}:${b.id}`) ?? null } };
        });
    }
    console.log(JSON.stringify(out));
}
