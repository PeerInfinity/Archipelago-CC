// scratch (APPROACH): replay saved latch keys (latch.mjs OUT=) on a fresh run of the latch boot and print, from tick
// FROM to TO, the player, iceturret@472,400's clock (shootTimer, anim, the int distance), the blasts in flight and the hits.
// Decides nothing. Usage: FROM=800 TO=970 node clock.mjs <keys.json>
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const fs = await import('node:fs');
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const saved = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const FROM = +(process.env.FROM ?? 0);
const TO = +(process.env.TO ?? 1e9);
const ID = process.env.TID ?? 'iceturret@472,400';
const boot = await l40LatchBoot();
const folded = buildTape(saved.perTick.map((k) => new Set(k)), boot.boot, 'ap', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = parseTape(JSON.stringify({ ...boot, name: 'ap', tick_count: saved.perTick.length, inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(saved.equips ?? [])] }));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
let k = 0;
while (!r.done) {
    const o = r.value.observation;
    if (run && o.t >= FROM && o.t <= TO) {
        const t = run.entities('turrets')?.get(ID);
        const c = (run.entities('turretDamage') ?? []).find((x) => x.id === ID) ?? {};
        const d = t ? Math.trunc(Math.hypot(run.state.x - t.x, run.state.y - t.y)) : null;
        const bl = run.blastsInFlight.map((b) => `${b.id ?? '?'}@${b.x.toFixed(0)},${b.y.toFixed(0)}`).join(' ');
        console.log(`t${o.t} key[${[...(saved.perTick[k - 1] ?? [])].join('+')}] p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) `
            + `T(${t?.x},${t?.y}) ${t?.dead ? 'DEAD' : ''} st${c.shootTimer} ${c.anim || '-'} ang${(c.angle ?? 0).toFixed(0)} hT${c.hitsTimer} d${d} `
            + `hp${c.hits} frz${run.progress('frozenTimer') ?? ''} hits${run.playerHits.length} [${bl}]`);
    }
    k += 1;
    r = st.next();
}
