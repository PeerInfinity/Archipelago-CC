const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const S = await import(M + 'fidelitySkinSwing.js');
for (const w of S.SKINSWING_WITNESSES) {
    const tape = await S.skinSwingTape(w);
    const on = await S.skinSwingModelSamples(tape, { pixelMaskSightLines: true });
    const by = new Map();
    for (const h of on.pressHits) {
        const k = `${h.id} ${h.landed ? 'LANDED' : h.why.replace(/[\d.]+ > /, '… > ')}`;
        const e = by.get(k) ?? { n: 0, first: h.t, last: h.t }; e.n++; e.last = h.t; by.set(k, e);
    }
    console.log(w.name, 'pressHits', on.pressHits.length);
    for (const [k, e] of by) console.log(`  ${k}  ×${e.n} t${e.first}..t${e.last}`);
}
