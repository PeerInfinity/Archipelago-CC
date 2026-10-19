// SCRATCH D1 probe 4: XC's L104 call (t100, pressAt 101) with the shield the seam boots with, and with it dropped.
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(R + 'fixtures/index.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const sb = await import(R + 'solverBot.js');
const SOURCE = atlasLevelSource();
const tape = loadTape('ladder2-l104-beam');
const st = stagingFromTape(tape);
console.log('seam keys', JSON.stringify(st.seam).slice(0, 600));
for (const [what, seam] of [['as staged', st.seam], ['shield dropped', { ...st.seam, items: { ...st.seam.items, hasShield: false, hasDarkShield: false } }]]) {
  for (const T of [100, 150, 200]) {
    let run;
    try {
      run = createRunForStaging({ ...st, seam }, SOURCE);
      for (let t = 0; t < T; t += 1) run.advance(heldKeysAt(tape, t));
    } catch (e) { console.log(what, T, 'threw', e.message.slice(0, 160)); continue; }
    for (const id of ['none', null]) {
      const r = sb.pressEscape(run, { state: run.state, at: T, keys: [new Set()], pressAt: T + 1, id });
      console.log(what, 't' + T, 'shield', run.inventory?.hasShield, 'id', id, '→', r.ok, r.claim, r.bound ?? '', (r.why ?? '').slice(0, 110), 'spinners', run.entities('spinnerBodies').length);
    }
  }
}
