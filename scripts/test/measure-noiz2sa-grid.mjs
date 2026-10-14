/**
 * Measure the Noiz2sa difficulty model against the game HEADLESS over a grid of skills × spans (bulletml N5), the
 * sibling of `measure-noiz2sa-pricing.mjs`: the same visit (`segment-run.js` runSegment: restart on a hit until the
 * clear or `--max-attempts`, attempt a of visit v on attemptBotSeed(v, a)), the same bot (equal tracks at the skill,
 * observed perception, centered hitbox, game seed 1), but the skill and the span come from flags instead of a priced
 * rules.json, and every ATTEMPT is kept (its frames and the scene it was hit in), so a cell yields the per-attempt
 * deathless rate and each scene's conditional pass rate inside the span.
 *
 * Needs the game's own dependency in the submodule (`npm install --no-save --no-package-lock --omit=dev` inside
 * `frontend/modules/bulletml-dodge`).
 *
 *   node scripts/test/measure-noiz2sa-grid.mjs --skills 90,95 --spans "10:7–10:boss,1:9,pick:3" [--visits 200]
 *        [--max-attempts 100] [--attempt-cap 2000] [--chunk 5] [--jobs 4] [--out raw.json]
 *   node scripts/test/measure-noiz2sa-grid.mjs --rules path/to/rules.json [same options]   (each priced region's move
 *        span at its pricing skill, rounded, with its rate and planned cost)
 *
 * A span is STAGE:SCENE–STAGE:SCENE, one position, or pick:N — the span `pickSpan(N, skill)` picks (the 50% rule).
 * `--attempt-cap`: stop starting visits in a cell once it has played this many attempts (a hopeless cell would play
 * visits × max-attempts); the cell reports the visits it played. `--out` is resumable: a cell already in it is kept.
 */
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const GAME = path.join(repoRoot, 'frontend/modules/bulletml-dodge/src/game');
const FPS = 62.5;

if (process.env.N5_GRID_WORKER) {
    // a worker: {id, skill, span, from, to, maxAttempts} → per visit its attempts [{f: frames, c: cleared, h: hit scene index}]
    const { loadNoiz2saPatterns } = await import(path.join(GAME, 'patterns-node.js'));
    const { runSegment } = await import(path.join(GAME, 'segment-run.js'));
    const { botOptions, trackKnobs, TRACKS } = await import(path.join(GAME, 'human.js'));
    const pats = loadNoiz2saPatterns();
    process.on('message', (job) => {
        if (job === 'exit') process.exit(0);
        const knobs = trackKnobs(Object.fromEntries(TRACKS.map((k) => [k, job.skill])));
        const { botSeed: _, ...bot } = botOptions({ perception: 'observed', knobs });
        const visits = [];
        for (let v = job.from; v <= job.to; v++) {
            const { result } = runSegment(pats, { start: job.span.start, end: job.span.end, bot, botSeed: v, seed: 1, hitbox: 'centered', maxAttempts: job.maxAttempts });
            visits.push(result.runs.map((r) => ({ f: r.frames, c: r.cleared, h: r.hitAt ? r.hitAt.stage * 10 + r.hitAt.scene : null })));
        }
        process.send({ id: job.id, visits });
    });
} else {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
    const { spanDifficulty, sceneChance, parseSpan, pickSpan, sceneIndex } = await import(path.join(repoRoot, 'frontend/modules/noiz2saSubstrate/noiz2saDifficulty.js'));
    const { showSpan } = await import(path.join(repoRoot, 'frontend/modules/noiz2saSubstrate/noiz2saRegion.js'));
    const visits = Number(opt('visits', 200));
    const maxAttempts = Number(opt('max-attempts', 100));
    const attemptCap = Number(opt('attempt-cap', Infinity));
    const chunk = Number(opt('chunk', 5));
    const jobs = Number(opt('jobs', Math.min(4, os.cpus().length)));
    const outPath = opt('out', null);

    // the cells
    const cells = [];
    if (opt('rules', null)) {
        const doc = JSON.parse(fs.readFileSync(opt('rules'), 'utf8'));
        const pid = Object.keys(doc.regions)[0];
        for (const [region, sc] of Object.entries(doc.preset_sidecars?.[pid] ?? {})) {
            const p = sc.playable_payload;
            if (sc.substrate !== 'noiz2sa' || !p?.pricing) continue;
            cells.push({ label: `${opt('label', path.basename(opt('rules')))}:${region}`, region, skill: Math.round(p.pricing.skill), span: p.move,
                rate: p.timeDrainPerSecond, planned: p.pricing.cost, pricing: p.pricing });
        }
    } else {
        for (const skill of opt('skills', '95').split(',').map(Number)) {
            for (const t of opt('spans', '10:7–10:boss').split(',').map((s) => s.trim())) {
                const span = t.startsWith('pick:') ? pickSpan(Number(t.slice(5)), skill).span : parseSpan(t);
                cells.push({ label: `${t.startsWith('pick:') ? `${t}=` : ''}${showSpan(span)}@${skill}`, skill, span, picked: t.startsWith('pick:') ? Number(t.slice(5)) : null });
            }
        }
    }
    for (const c of cells) {
        const d = spanDifficulty(c.span, c.skill);
        const [a, b] = [sceneIndex(c.span.start), sceneIndex(c.span.end)];
        c.spanText = showSpan(c.span);
        c.model = { p: d.p, seconds: d.seconds, measured: d.measured,
            scenes: Array.from({ length: b - a + 1 }, (_, k) => ({ index: a + k, p: sceneChance(a + k, c.skill) })) };
    }

    const out = outPath && fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { meta: {}, cells: [] };
    out.meta = { tool: 'scripts/test/measure-noiz2sa-grid.mjs', bot: 'equal tracks at the skill, observed perception', hitbox: 'centered', gameSeed: 1, maxAttempts, fps: FPS };
    const have = new Set(out.cells.map((c) => `${c.spanText}@${c.skill}@${c.maxAttempts}`));
    const todo = cells.filter((c) => !have.has(`${c.spanText}@${c.skill}@${maxAttempts}`));

    const workers = Array.from({ length: jobs }, () => fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, N5_GRID_WORKER: '1' } }));
    const save = () => { if (outPath) fs.writeFileSync(outPath, JSON.stringify(out) + '\n'); };
    const t0 = Date.now();
    for (const c of todo) {
        const results = new Map(); // first visit → visits
        let next = 1; let played = 0; let stop = false;
        await new Promise((resolve) => {
            let busy = 0;
            const dispatch = (w) => {
                if (stop || next > visits) { if (busy === 0) resolve(); return; }
                const from = next; const to = Math.min(visits, next + chunk - 1); next = to + 1; busy++;
                w.once('message', (m) => {
                    busy--; results.set(from, m.visits);
                    played += m.visits.reduce((a, v) => a + v.length, 0);
                    if (played >= attemptCap) stop = true;
                    dispatch(w);
                });
                w.send({ id: from, skill: c.skill, span: c.span, from, to, maxAttempts });
            };
            workers.forEach(dispatch);
        });
        // keep visits in order and contiguous from 1 (an in-flight chunk past the cap is kept: it ran)
        c.maxAttempts = maxAttempts;
        c.visits = [...results.entries()].sort((x, y) => x[0] - y[0]).flatMap(([, v]) => v);
        out.cells.push(c);
        save();
        const att = c.visits.flat(); const clears = att.filter((x) => x.c).length;
        const cens = c.visits.filter((v) => !v.at(-1).c).length;
        const E = c.visits.reduce((a, v) => a + v.reduce((s, x) => s + x.f, 0), 0) / c.visits.length / FPS;
        console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${c.label}: model p ${c.model.p.toFixed(3)} measured ${(clears / att.length).toFixed(3)} `
            + `(${clears}/${att.length}), visits ${c.visits.length}, censored ${cens}, E model ${c.model.seconds.toFixed(1)} s measured ${E.toFixed(1)} s`);
    }
    workers.forEach((w) => w.send('exit'));
}
