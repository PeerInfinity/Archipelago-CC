// SCRATCH (PDS D2): per-seed wall time of seedlingGenCapacity.slow's post-sword body, in the tree given as argv[2].
const room = await import(`${process.argv[2]}/frontend/modules/seedlingDemo/seedlingGenRoom.js`);
const seeds = (process.argv[3] ?? '1-60').split('-').map(Number);
const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const genRoom = (seed, biome) => room.generateGenRoom({
    region_id: 'census', exits: [{ exit_id: 'e0' }, { exit_id: 'e1' }], size: { width: 10, height: 10 },
    rng: seededRng(seed), params: { seedlingGen: { biome } } }).world;
const items = (n) => ({ items_to_place: Array.from({ length: n }, (_, i) => `i${i}`) });
let total = 0;
for (let s = seeds[0]; s <= seeds[1]; s += 1) {
    const t0 = Date.now(); let out = 'ok';
    try { const w = genRoom(s, 'post-sword'); room.placeGenItems(w, items(30));
        try { room.placeGenItems(genRoom(s, 'post-sword'), items(31)); out = 'NOT REFUSED'; } catch { out = 'ok'; } }
    catch (e) { out = `THREW ${e.message.slice(0, 100)}`; }
    const dt = Date.now() - t0; total += dt;
    console.log(`seed ${s}\t${(dt / 1000).toFixed(1)}s\t${out}`);
}
console.log(`total ${(total / 1000).toFixed(1)}s`);
