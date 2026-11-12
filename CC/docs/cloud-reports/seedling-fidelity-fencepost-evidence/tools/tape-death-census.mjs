// FENCEPOST W0/D2 (measure only): replay every committed fixture tape in the model and report, per tape, the
// spinner deaths it crosses: per body the tick `destroy` goes up, the last tick it is listed in
// `run.entities('spinnerBodies')`, and the "corpse reads" (a listed body with destroy up and alpha <= 0: the
// removePending fencepost). With `--on=<key,...>` the keys are turned ON for the replay; `--md5` adds the stream md5
// of every tape (runTapeToStream) so two arms can be diffed.
// Usage (from the repo root): node CC/docs/cloud-reports/seedling-fidelity-fencepost-evidence/tools/tape-death-census.mjs [--on=spinnerRemoveRead] [--md5] [--only=<substr>]
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const DEMO = resolve('frontend/modules/seedlingDemo');
const load = (f) => import(pathToFileURL(join(DEMO, f)).href);
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? null;
const on = (arg('on') ?? '').split(',').filter(Boolean);
const off = (arg('off') ?? '').split(',').filter(Boolean);
const only = arg('only');
const wantMd5 = process.argv.includes('--md5');
const { createTapeStepper, runTapeToStream } = await load('tapeRunner.js');
const { atlasLevelSource } = await load('levelSource.js');
const fixtures = await load('fixtures/index.js');
const { withContactFidelity } = await load('contactFidelity.js');
const over = {}; for (const k of on) over[k] = true; for (const k of off) over[k] = false;
const levelSource = atlasLevelSource();
let crossing = 0; let corpseReads = 0; let errors = 0; let n = 0;
for (const name of fixtures.fixtureNames()) {
    if (only && !name.includes(only)) continue;
    n += 1;
    const tape = fixtures.loadTape(name);
    const seen = new Map(); let err = null; let reads = 0; let md5 = '';
    withContactFidelity(over, () => {
        try {
            let run = null;
            const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
            let r = st.next();
            while (!r.done) {
                const t = r.value.observation.t;
                if (run) {
                    for (const b of run.entities('spinnerBodies') ?? []) {
                        const key = `${run.level}:${b.id}`;
                        const p = seen.get(key) ?? { destroyAt: null, last: null, corpse: [] };
                        if (b.destroy && p.destroyAt === null) p.destroyAt = t;
                        if (b.destroy && b.alpha <= 0) { p.corpse.push(t); reads += 1; }
                        p.last = t; seen.set(key, p);
                    }
                }
                r = st.next();
            }
            if (wantMd5) md5 = createHash('md5').update(JSON.stringify(runTapeToStream(tape, { levelSource }))).digest('hex');
        } catch (e) { err = String(e.message).split('\n')[0].slice(0, 140); }
    });
    const deaths = [...seen].filter(([, p]) => p.destroyAt !== null);
    if (err) errors += 1;
    if (deaths.length > 0) crossing += 1;
    corpseReads += reads;
    if (deaths.length > 0 || err || wantMd5) {
        console.log(`${name}${md5 ? ' md5 ' + md5 : ''}${err ? ' ERROR ' + err : ''}`
            + deaths.map(([k, p]) => ` | ${k} destroy@${p.destroyAt} last@${p.last} corpseReads[${p.corpse}]`).join(''));
    }
}
console.log(`## ${n} tape(s): ${crossing} cross a spinner death, ${corpseReads} corpse read(s) (destroy && alpha <= 0), ${errors} replay error(s); on=[${on}] off=[${off}]`);
