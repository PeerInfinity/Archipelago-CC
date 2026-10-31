// scratch (SHIELDBUMP W0): at SPIN's four stands beside spinner@816,848 on leg 860's staging, ask pressEscape (SPIN ON
// so a certificate exists where one can), then DRIVE a fresh run along the escape's whole path (approach, press, train,
// certificate) and compare the run's spinner rects, row by row, with the forecast `first.rows` the escape searched in.
// Every spinner shield bump the run actually stepped is listed with the forecast's error at and after it.
// Usage: node w0-stands.mjs --root=<tree>/   (the tree carries the scratch __sbW0 hook)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const R = args.root ?? '/tmp/claude-0/sbwt/';
const D = R + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { replayTape } = await import(D + 'jsRuntimeSolver.js');
const { pressEscape } = await import(D + 'solverBot.js');
const PG = await import(D + 'pressKillGuards.js');
const { CONTACT_FIDELITY } = await import(D + 'contactFidelity.js');
const row = JSON.parse(gunzipSync(readFileSync(D + 'fixtures/spin-witness/leg860-request.json.gz')).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: Number(args.seam ?? 5950) } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const BODY = 'spinner@816,848';
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } },
    perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null,
    holds: REQ.holds ?? null });
const STANDS = { certified: [808, 854, 'right'], envelope: [814, 854, 'right'], exhausted: [829, 860, 'left'],
    approach: [820, 854, 'right'] };
const spin = args.spin !== '0';
PG.PRESS_ESCAPE_SHIELD_CLAIM.enabled = spin;
console.log('KEY', JSON.stringify({ forecastShieldBump: CONTACT_FIDELITY.forecastShieldBump ?? '(absent)', spin }));
const NO = new Set();
for (const [name, [x, y, key]] of Object.entries(STANDS)) {
    const cap = {};
    globalThis.__sbW0 = (phase, o) => { cap[phase] = o; };
    const run = standAt(x, y);
    const n = run.ticksCompleted;
    const r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: BODY, caller: 'aim' });
    globalThis.__sbW0 = undefined;
    const out = { stand: name, ok: r.ok, claim: r.claim, bound: r.bound ?? null, why: r.why?.slice(0, 160) ?? null,
        unmodelled: cap.first?.first.unmodelled ?? null };
    if (!cap.first) { console.log(JSON.stringify(out)); continue; }
    const { first, pressAt, trainEnd } = cap.first;
    // the path's keys, tick by tick from n: the aim, the press, the train stood, then the certificate (if any)
    const keys = [new Set([key]), new Set(['primary'])];
    const L = cap.cert?.L ?? first.landing?.t ?? (trainEnd + 1);
    for (let t = pressAt + 1; t < (cap.cert ? L : trainEnd + 1); t += 1) keys.push(NO);
    if (cap.cert) keys.push(...cap.cert.keys);
    const drive = standAt(x, y);
    const bumps0 = drive.shieldBumps.length;
    const diffs = [];
    for (let i = 0; i < keys.length && i < first.rows.length; i += 1) {
        drive.advance(keys[i]);
        const live = drive.entities('spinnerBodies') ?? [];
        let worst = 0;
        first.rows[i].forEach((rect, k) => {
            const b = live[k];
            if (!b) return;
            worst = Math.max(worst, Math.abs(b.rect.x - rect.x), Math.abs(b.rect.y - rect.y));
        });
        diffs.push(+worst.toFixed(3));
    }
    const bumps = drive.shieldBumps.slice(bumps0).filter((b) => b.family === 'spinner')
        .map((b) => ({ t: b.t, i: b.t - 1 - n, id: b.id, shoved: b.shoved, v: b.v }));
    const firstErr = diffs.findIndex((d) => d > 0);
    console.log(JSON.stringify({ ...out, cert: !!cap.cert, pathTicks: keys.length, rows: first.rows.length, bumps,
        firstErrRow: firstErr, maxErr: Math.max(0, ...diffs), errAtBumps: bumps.map((b) => diffs[b.i] ?? null),
        hits: drive.playerHits.length }));
}
