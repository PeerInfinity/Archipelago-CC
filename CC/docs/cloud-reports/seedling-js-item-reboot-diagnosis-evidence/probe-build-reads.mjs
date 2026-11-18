import { readFileSync } from 'node:fs';
// MEASUREMENT-ONLY (slice seedling-js-item-reboot-diagnosis): does the model's BUILD read held keys / totem parts?
const R=new URL('../../../../frontend/modules/', import.meta.url).pathname;
const { createJsRuntime } = await import(R+'seedlingDemo/jsRuntimeCore.js');
const MAP = JSON.parse(readFileSync(R+'flashPanel/atlases/seedling-map.json','utf8'));
for (const held of [false,true]) {
  const rt = createJsRuntime({});
  rt.setVanilla(MAP);
  const q=[]; if (held) q.push({invocation:'method_call',path:[{class:'Main'}],method:'hasKeySet',args:[2,true]},{invocation:'method_call',path:[{class:'Main'}],method:'hasTotemPartSet',args:[0,true]},{invocation:'method_call',path:[{class:'Main'}],method:'hasTotemPartSet',args:[1,true]});
  q.push({ invocation:'new_instance', className:'Game', args:[40,928,96]});
  rt.queueItems(q); rt.tick();
  const w=rt.run.world;
  const pk=(w.pickups||[]).filter(p=>/bosskey|totem/.test(p.tag||p.type||p.id||'')).map(p=>p.id||p.tag+'@'+p.x+','+p.y);
  console.log('key2 held', held, '| run.keys', [...rt.run.keys], '| save.totem_parts', JSON.stringify(rt.run.saveState?.totem_parts), '| bosskey/totem pickups in the built world:', JSON.stringify(pk), '| all pickup tags', JSON.stringify((w.pickups||[]).map(p=>p.tag)));
}
