import fs from 'node:fs';
const E = await import('/home/user/Archipelago-CC/frontend/modules/mazeRoom/mazeRoomEngine.js');
const [file, carrierName, sx, sy, ...items] = process.argv.slice(2);
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const sc = doc.preset_sidecars['1'][carrierName];
const world = E.deserializeMazeWorld(sc.playable_payload);
let st = E.createState(world);
st.player_pos = { x: +sx, y: +sy };
const inv = new Set(items);
const seen = new Set([`${sx},${sy}`]); const q = [st];
while (q.length) { const s = q.shift(); for (const d of ['N','E','S','W']) { let n; try { n = E.step(world, s, d, inv); } catch (e) { continue; } if (!n) continue; const k = `${n.player_pos.x},${n.player_pos.y}`; if (seen.has(k)) continue; seen.add(k); q.push(n); } }
for (let y = 0; y < world.height; y++) { let r = ''; for (let x = 0; x < world.width; x++) r += seen.has(`${x},${y}`) ? 'o' : (E.isFloor(world, x, y) ? '.' : '#'); console.log(r); }
