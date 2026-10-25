// SCRATCH (PDS D3): the producer's premises at the defaults (lapse ON): OFF (PRESS_KILL_BOMBS OFF) and ON.
const REPO = process.argv[2];
const P = await import(`${REPO}/scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs`);
const staging = await P.bombStandStaging();
for (const [label, en, o] of [['off-lapse', false, { lapse: true }], ['off-prelapse', false, {}],
    ['on-prelapse-blastOff', true, { blastBody: false }]]) {
    const r = await P.bombStandSolve(staging, en, o);
    const a = await P.bombStandAccount(staging, r.keys.slice(0, Math.min(r.keys.length, 1293)), { lapse: o.lapse ?? false });
    console.log(label, JSON.stringify({ n: r.keys.length, message: (r.message ?? '').slice(0, 220), hits: r.hits,
        landed: a.landed.slice(0, 3) }));
}
