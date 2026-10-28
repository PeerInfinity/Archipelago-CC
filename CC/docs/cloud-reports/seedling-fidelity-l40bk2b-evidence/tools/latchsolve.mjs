const SD = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot, l40LatchSolve, l40LatchModelSamples, l40LatchTape } = await import(SD + 'fidelityL40Latch.js');
for (const over of [{}, { orbitFreeAim: true }, { orbitFreeAim: true, strategyBoundDistinct: true }]) {
  const t0 = Date.now();
  const { out, refusal } = await l40LatchSolve(await l40LatchBoot(), over);
  const perTick = (out?.perTick ?? refusal?.perTick ?? []).map((k) => [...k]);
  const tape = await l40LatchTape('x', perTick);
  const m = await l40LatchModelSamples({ ...tape, equips: [...(tape.equips ?? []), ...(refusal?.equips ?? [])] }, over);
  console.log(JSON.stringify(over), `${((Date.now() - t0) / 1000).toFixed(0)} s`, out ? 'SOLVED' : 'REFUSED', perTick.length, 't; hits', JSON.stringify(m.hits), '\n  ', (() => { const s = String(refusal?.message ?? ''); const i = s.lastIndexOf(' -> '); return s.slice(i, i + 420); })());
}
