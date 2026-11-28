#!/usr/bin/env node
// wave 72 D1: the witness's mounted set (`l25Sets().vanilla`, which carries `SEEDLING_SET_PATCHES`) with L39's ONE
// patched difference put back — `fallrock@144,624` (tset 6, tag 10), the atlas record's entity the
// `l39-fallrock-removed` patch deletes — under its own `set_id`. So the GAME runs the room the model's `runTape`
// (atlas source) replays. usage: node set-with-rock.mjs > set.json
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const L25 = await import(`${ROOT}frontend/modules/seedlingDemo/fidelityL25ApItem.js`);
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const base = L25.l25Sets(ROOT).vanilla;
const rock = atlasLevelSource()(39).entities.find((e) => e.type === 'fallrock');
const set = { ...base, set_id: `${base.set_id}-w72-rock`, rooms: base.rooms.map((r) => (r.id !== 39 ? r
    : { ...r, source: { record: { ...r.source.record, entities: [...r.source.record.entities, rock] } } })) };
process.stdout.write(`${JSON.stringify(set)}\n`);
