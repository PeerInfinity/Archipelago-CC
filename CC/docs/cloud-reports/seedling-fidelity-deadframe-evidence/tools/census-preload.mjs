// DEADFRAME D1: the census hooks for an in-process run (the acceptance batch): `node --import <this> <script>` with
// `census-scratch.py apply`. Prints the totals to stderr at exit. Subprocesses are not counted.
const t = { spans: {}, overlaps: {} };
globalThis.__DF = {
    onSpend(f, k, w, sim) {
        const key = `${k}:${String(w ?? '').split(' ')[0]}`;
        const e = t.spans[key] = t.spans[key] ?? { spans: 0, frames: 0, withResponders: 0, spansChanged: 0, changedFrames: 0 };
        e.spans += 1; e.frames += f;
        if (sim?.responders > 0) e.withResponders += 1;
        if (sim?.changed > 0) { e.spansChanged += 1; e.changedFrames += sim.changed; }
    },
    onTick(o) { const key = `${o.kind}-on-${o.presser.split('@')[0]}${o.rockGroup ? '-rockgroup' : ''}`; t.overlaps[key] = (t.overlaps[key] ?? 0) + 1; },
};
process.on('exit', () => process.stderr.write(`DEADFRAME-CENSUS ${JSON.stringify(t)}\n`));
