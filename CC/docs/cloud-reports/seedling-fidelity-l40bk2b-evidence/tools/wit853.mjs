// scratch: solve a captured request under ROOT (OPP + keys by env), take the final refusal's ticks, build a tape on the
// request's staging header, write it, and replay it in the model (the main tree's fidelityL40Latch fold) to check it.
import { readFileSync, writeFileSync } from 'node:fs';
const R = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, out, name = 'l40bk2b-orbit-chain'] = process.argv.slice(2);
const r = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => String(x.id) === id);
const req = restoreRequest(r.requests.find((x) => String(x.i) === i).request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
globalThis.__keepRefusals = [];
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const ref = globalThis.__keepRefusals.filter((e) => String(a.message ?? '').includes(e.message.slice(0, 200))).at(-1);
console.log('refusal fields', Object.keys(ref ?? {}).join(','), 'holds', JSON.stringify(ref?.holds ?? null)?.slice(0, 200));
console.log(`answer ok ${a.ok} work ${a.work}; refusals kept ${globalThis.__keepRefusals.length}; match ${!!ref} perTick ${ref?.perTick?.length} equips ${JSON.stringify(ref?.equips ?? null)}`);
const { buildTape } = await import(M + 'botDriverV1.js');
const { requiredTapeVersion, parseTape } = await import(M + 'tapeFormat.js');
const st = req.staging;
const folded = buildTape(ref.perTick.map((k) => new Set(k)), st.boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
const t = { game: 'seedling', name, boot: st.boot, noclip: false, noDamage: false, noHazards: st.noHazards, grants: st.grants,
  persistence: st.persistence, despawn: st.despawn, equips: [...(st.equips ?? []), ...(ref.equips ?? [])], pins: st.pins, save: st.save,
  rng: st.rng, seam: st.seam, inventory_slots: st.inventory_slots, tick_count: ref.perTick.length, inputs: folded.inputs,
  refused: ref.message.slice(0, 600) };
t.tape_version = requiredTapeVersion(t);
parseTape(JSON.stringify(t));
writeFileSync(out, JSON.stringify(t));
console.log(`wrote ${out}: ${t.tick_count} t, v${t.tape_version}`);
