// WALLS-CENSUS-2 scratch instrument (measure only). The captured L26 request (the L28 arrival pocket), replayed in the
// MODEL with N idle ticks (and optionally a west-facing sword press every k ticks): where the two Punchers go, whether
// the run's chaser roster steps them, and whether `rocklock@112,208` ever opens. Prints one JSON line per sample.
//   node l26-pocket-idle.mjs <req-l26.jsonl> [--leg=0] [--ticks=600] [--every=60] [--swing=<k>] [--hold=left[+up]]
import { readFileSync } from 'node:fs';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { restoreRequest } = await import(`${REPO}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${REPO}/frontend/modules/seedlingDemo/atlasSource.js`);
const { replayTape } = await import(`${REPO}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const L = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const req = restoreRequest(L.find((l) => String(l.id) === arg('leg', '0')).requests[0].request);
const levelSource = levelSourceFromAtlas(req.source.records);
const N = Number(arg('ticks', '600')), EVERY = Number(arg('every', '60')), SWING = Number(arg('swing', '0'));
const HOLD = arg('hold', ''); // e.g. left, or left+up: held on every tick that is not a swing tick
const perTick = [];
for (let i = 0; i < N; i += 1) perTick.push(SWING && i % SWING === 0 ? new Set(['left', 'x']) : (SWING && i % SWING === 1 ? new Set(['x']) : new Set(HOLD ? HOLD.split('+') : [])));
const run = replayTape({ staging: req.staging, perTick: [], levelSource, scratchPersistence: req.scratchPersistence, equips: req.equips });
console.log(JSON.stringify({ start: { level: run.level, x: run.state.x, y: run.state.y }, chaserVerdict: run.chaserRoomVerdict?.(run.level) ?? null }));
for (let i = 0; i < N; i += 1) {
    run.advance(perTick[i]);
    if ((i + 1) % EVERY === 0 || i === 0) {
        const ch = run.entities('chasers');
        const list = ch ? [...(ch.values?.() ?? ch)].map((c) => ({ id: c.id, x: +(+c.x).toFixed(1), y: +(+c.y).toFixed(1), removed: !!c.removed, destroy: !!c.destroy })) : null;
        const open = run.entities('openActivators');
        console.log(JSON.stringify({ t: i + 1, player: { x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1) }, chasers: list,
            open: open ? [...open] : null, hits: run.ledger('playerHits')?.length ?? null }));
    }
}
