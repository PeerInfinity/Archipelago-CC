// scratch (BK2COMBAT): fidelityL30KeyLock's two pit landings, the switch OFF/ON (fidelity's rows' switches as given), the verdict.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { l30keylockPlan } = await import('/home/user/Archipelago-CC/scripts/procgen/plan-seedling-l30keylock.mjs');
const SB = await import(M + 'solverBot.js');
const v = (p) => ({ solved: p.solved ? p.solved.out.perTick.length : null, hits: p.run.playerHits.map((h) => ({ t: h.t, id: h.id })),
    refusal: p.refusal ? String(p.refusal.message).slice(0, 200) : null });
for (const [label, fid, opts] of [['both OFF 224', { strikeIframeLapse: false, chaserOrbitKill: false }, { rescan: false, waitPriced: false }],
    ['WAIT alone 224', { strikeIframeLapse: false, chaserOrbitKill: false }, { rescan: false, waitPriced: true }]]) {
    for (const on of [false, true]) {
        SB.resetChaserStagedHuntCounts();
        const p = await withContactFidelity(fid, () => SB.withChaserStagedHunt(on, () => l30keylockPlan(224, opts)));
        console.log(label, on ? 'ON ' : 'OFF', JSON.stringify(v(p)), JSON.stringify(SB.CHASER_STAGED_HUNT_COUNTS.asks));
    }
}
