const { loadAtlas } = await import(new URL('../../../../../frontend/modules/seedlingDemo/levelSource.js', import.meta.url).pathname);
const a = loadAtlas();
const lv = a.levels ?? a.records ?? a;
const arr = Array.isArray(lv) ? lv : Object.values(lv);
console.log('records', arr.length, Object.keys(arr[0] ?? {}).slice(0, 12));
const READERS = ['arrowtrap', 'iceturret', 'turret', 'lavatrap', 'drill', 'spinner', 'crusher', 'chest', 'pole', 'droplet', 'bosstotem', 'lavaboss', 'pulser', 'button', 'buttonroom', 'cover', 'pull', 'lock', 'rocklock', 'bosslock', 'stick'];
for (const r of arr) {
  const ents = r.entities ?? r.objects ?? [];
  const tags = (Array.isArray(ents) ? ents : Object.values(ents)).map((e) => e.type ?? e.tag ?? e.name);
  if (!tags.includes('opentree')) continue;
  const near = [...new Set(tags.filter((t) => READERS.includes(t)))];
  console.log('level', r.level ?? r.index ?? r.id, 'opentrees', tags.filter((t) => t === 'opentree').length, 'readers in room', JSON.stringify(near));
}
for (const L of [12, 27, 65]) {
  const r = arr.find((x) => x.level === L);
  const ents = r.entities;
  const pick = ents.filter((e) => ['opentree', 'pole', 'chest', 'pull', 'bosslock', 'droplet', 'turret'].includes(e.type));
  console.log('L' + L, pick.map((e) => `${e.type}@${e.x},${e.y}${e.attrs && Object.keys(e.attrs).length ? JSON.stringify(e.attrs) : ''}`).join(' '));
}
