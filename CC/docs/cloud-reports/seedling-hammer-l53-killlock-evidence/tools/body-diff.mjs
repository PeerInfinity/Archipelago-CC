// MEASUREMENT ONLY (L53-KILLLOCK): a `probe-seedling-contact-divergence.mjs --capture` witness replayed on the model
// (`replay-seedling-contact-capture.mjs`'s run building, restated with the chasers read), and per tick each GAME body
// matched to the model chaser of its class nearest it: the first tick any body's position differs by > --eps px,
// and the rows from --from to --to (game vs model, per body). Usage: node body-diff.mjs --file=<capture.json>
// [--eps=0.01] [--from=T0 --to=T1]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { untag } = await import(ROOT + '/scripts/procgen/replay-seedling-contact-capture.mjs');
const { createRunForStaging } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const cap = JSON.parse(readFileSync(args.file, 'utf8'));
const req = untag(cap.request); const plan = untag(cap.plan);
const run = createRunForStaging(req.staging, levelSourceFromAtlas(untag(cap.records)), { scratchPersistence: req.scratchPersistence === true });
const prefix = req.perTick ?? []; const keys = [...prefix, ...(plan.solution ?? [])];
const game = new Map((cap.game ?? []).map((g) => [g.t, g]));
const EPS = Number(args.eps ?? 0.01); const from = Number(args.from ?? -1); const to = Number(args.to ?? -1);
const CLS = { Jellyfish: 'jellyfish', Puncher: 'puncher' };
let first = null;
for (let i = 0; i < keys.length; i += 1) {
    const t = i - prefix.length;
    const g = game.get(t);
    if (t >= 0 && g) {
        const ms = (run.entities('chasers') ?? []).filter((c) => !c.removed);
        const rows = [];
        let worst = 0;
        for (const b of g.bodies.filter((x) => CLS[x.cls])) {
            const cand = ms.filter((c) => c.tag === CLS[b.cls]);
            const m = cand.sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
            const d = m ? Math.max(Math.abs(m.x - b.x), Math.abs(m.y - b.y)) : Infinity;
            worst = Math.max(worst, d);
            rows.push(`${b.cls[0]} g(${b.x.toFixed(2)},${b.y.toFixed(2)} v ${b.vx.toFixed(2)},${b.vy.toFixed(2)} h${b.enemy?.hits} i${b.enemy?.hits_timer}${b.destroy ? ' X' : ''} ${b.anim})`
                + ` m${m ? `[${m.id}](${m.x.toFixed(2)},${m.y.toFixed(2)} v ${(m.vx ?? m.v?.x ?? NaN).toFixed?.(2)},${(m.vy ?? m.v?.y ?? NaN).toFixed?.(2)} h${m.hits} i${m.hitsTimer}${m.dying ? ' D' : ''})` : '-'} Δ${d.toFixed(2)}`);
        }
        const p = `p g(${g.player.x.toFixed(2)},${g.player.y.toFixed(2)}) m(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)})`;
        if (first === null && worst > EPS) { first = t; console.log(`FIRST BODY DIFF > ${EPS} px at t${t} (worst ${worst.toFixed(3)})`); console.log(`t${t} ${p}\n   ${rows.join('\n   ')}`); }
        if (t >= from && t <= to) console.log(`t${t} keys[${[...keys[i]].join('+')}] ${p}\n   ${rows.join('\n   ')}`);
    }
    run.advance(keys[i]);
}
if (first === null) console.log(`no body differs by > ${EPS} px over ${game.size} sampled ticks`);
