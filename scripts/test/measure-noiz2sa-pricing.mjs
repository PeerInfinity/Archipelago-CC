/**
 * Measure a priced Noiz2sa world's rates HEADLESS (bulletml N5): for each priced region, play its move span as the
 * page plays a visit (`segment-run.js` runSegment: restart on a hit until the clear, attempt a of visit v on
 * attemptBotSeed(v, a − 1)) with the bot at the walk's PREDICTED skill (equal tracks, fixed for the visit), over many
 * visit seeds; report the mean game seconds of a visit and the mana it costs at the region's rate
 * (floor(seconds) × rate, as the drain charges) against the planned cost. This is the check the in-app row cannot make:
 * one visit is one draw of a long-tailed variable.
 *
 * Needs the game's own dependency in the submodule (`npm install --no-save --no-package-lock --omit=dev` inside
 * `frontend/modules/bulletml-dodge`; its node_modules is ignored there).
 *
 *   node scripts/test/measure-noiz2sa-pricing.mjs [rules.json] [--visits 200] [--max-attempts 100] [--jobs 4]
 */
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const GAME = path.join(repoRoot, 'frontend/modules/bulletml-dodge/src/game');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

if (process.env.N5_WORKER) {
    // a worker: visits [from, to] of one span at one skill → their seconds and attempt counts
    const { loadNoiz2saPatterns } = await import(path.join(GAME, 'patterns-node.js'));
    const { runSegment } = await import(path.join(GAME, 'segment-run.js'));
    const { botOptions, trackKnobs, TRACKS } = await import(path.join(GAME, 'human.js'));
    const job = JSON.parse(process.env.N5_WORKER);
    const knobs = trackKnobs(Object.fromEntries(TRACKS.map((k) => [k, job.skill])));
    const { botSeed: _, ...bot } = botOptions({ perception: 'observed', knobs });
    const pats = loadNoiz2saPatterns();
    const out = [];
    for (let v = job.from; v <= job.to; v++) {
        const { result } = runSegment(pats, { start: job.span.start, end: job.span.end, bot, botSeed: v, seed: job.seed, hitbox: 'centered', maxAttempts: job.maxAttempts });
        const frames = result.runs.reduce((a, r) => a + r.frames, 0);
        out.push({ seconds: frames / 62.5, attempts: result.runs.length, cleared: result.runs.at(-1)?.cleared === true });
    }
    process.send(out);
    process.exit(0);
}

const rulesPath = args.find((a) => a.endsWith('.json'))
    ?? path.join(repoRoot, 'frontend/presets/noiz2sa_priced_test/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const visits = Number(opt('visits', 200));
const maxAttempts = Number(opt('max-attempts', 100));
const jobs = Number(opt('jobs', Math.min(4, os.cpus().length)));
const { showSpan } = await import(path.join(repoRoot, 'frontend/modules/noiz2saSubstrate/noiz2saRegion.js'));

const doc = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const pid = Object.keys(doc.regions)[0];
const runPart = (job) => new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, N5_WORKER: JSON.stringify(job) } });
    child.on('message', resolve);
    child.on('error', reject);
});
console.log(`${path.relative(repoRoot, rulesPath)}: ${visits} visits a region, at most ${maxAttempts} attempts a visit`);
console.log('region | move span | skill | model p | model E (s) | measured E (s) | censored | rate | planned | measured mana');
for (const [region, sc] of Object.entries(doc.preset_sidecars?.[pid] ?? {})) {
    const p = sc.playable_payload;
    if (sc.substrate !== 'noiz2sa' || !p?.pricing || typeof p.timeDrainPerSecond !== 'number') continue;
    const skill = Math.round(p.pricing.skill); // tracks are whole steps; the walk's mean track rounded
    const per = Math.ceil(visits / jobs);
    const parts = await Promise.all(Array.from({ length: jobs }, (_, j) => ({ from: 1 + j * per, to: Math.min(visits, (j + 1) * per) }))
        .filter((r) => r.from <= r.to)
        .map((r) => runPart({ ...r, span: p.move, seed: p.seed ?? 1, skill, maxAttempts })));
    const all = parts.flat();
    const meanE = all.reduce((a, x) => a + x.seconds, 0) / all.length;
    const mana = all.reduce((a, x) => a + Math.floor(x.seconds) * p.timeDrainPerSecond, 0) / all.length;
    const censored = all.filter((x) => !x.cleared).length;
    console.log(`${region} | ${showSpan(p.move)} | ${skill} | ${p.pricing.p} | ${p.pricing.seconds} | ${meanE.toFixed(2)} | ${censored}/${all.length} `
        + `| ${p.timeDrainPerSecond} | ${p.pricing.cost} | ${mana.toFixed(2)}`);
}
