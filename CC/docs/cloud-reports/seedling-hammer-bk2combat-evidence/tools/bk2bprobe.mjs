// scratch (BK2COMBAT): fidelity L40BK2B's corridor boot (the BobSoldier measured alone), the solver OFF/ON, under the
// fidelity switches as given (none = the shipped orbit; D1 = orbitFreeAim): the removal tick and the hits. Decides nothing.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const B = await import(M + 'fidelityL40Bk2b.js');
const SB = await import(M + 'solverBot.js');
for (const [label, sw] of [['plain', {}], ['D1', B.L40BK2B_D1_SWITCHES]]) {
    for (const on of [false, true]) {
        SB.resetChaserStagedHuntCounts();
        const r = await SB.withChaserStagedHunt(on, () => B.l40Bk2bSolve(sw));
        const o = r.out ?? r.refusal;
        const perTick = (o.perTick ?? []).map((k) => [...k].sort());
        const removed = await B.l40Bk2bRemovalTick(perTick);
        let hits = null;
        try {
            const tape = await B.l40Bk2bTape('p', perTick);
            const { parseTape } = await import(M + 'tapeFormat.js');
            const { createTapeStepper } = await import(M + 'tapeRunner.js');
            const { atlasLevelSource } = await import(M + 'levelSource.js');
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            for (let x = st.next(); !x.done; x = st.next());
            hits = run.playerHits.map((h) => ({ t: h.t, id: h.id }));
        } catch (e) { hits = `replay threw: ${String(e.message).slice(0, 120)}`; }
        console.log(label, on ? 'ON ' : 'OFF', r.out ? `SOLVED ${perTick.length}` : `REFUSED ${perTick.length}t`, 'removed', removed, 'hits', JSON.stringify(hits),
            JSON.stringify(SB.CHASER_STAGED_HUNT_COUNTS.asks), r.out ? '' : String(r.refusal.message).slice(0, 160));
    }
}
