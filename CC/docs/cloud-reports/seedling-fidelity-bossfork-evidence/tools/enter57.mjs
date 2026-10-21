const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
import { readFileSync } from 'node:fs';
const SRC = atlasLevelSource();
const l58 = SRC(58);
console.log('L58 doors to 57:', JSON.stringify(l58.entities.filter((e) => e.attrs && Number(e.attrs.to) === 57).map((e) => ({ type: e.type, x: e.x, y: e.y, px: e.attrs.playerx, py: e.attrs.playery }))));
const base = JSON.parse(readFileSync(M + 'fixtures/tentaclebeast-witness/tb-idle-s1.json', 'utf8')).tape;
const door = l58.entities.find((e) => e.attrs && Number(e.attrs.to) === 57);
const keys = process.argv.slice(2);
for (const bx of [door.x + 8]) {
  const tape = { ...base, boot: { level: 58, x: bx, y: door.y + 24 }, persistence: [{ level: 57, tag: 0, note: '' }], inputs: [], tick_count: 0 };
  withContactFidelity({ tentacleBeastFight: true }, () => {
    const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(tape))), SRC);
    for (let i = 0; i < 200; i++) {
      const a = run.advance(new Set([keys[0] ?? 'up']));
      if (a?.transition) {
        console.log('transition at', i, run.level, run.state.x, run.state.y, 'mouths', JSON.stringify(run.world.teleporters.filter((t) => t.runtime).map((t) => `${t.x},${t.y}`)));
        break;
      }
    }
  });
}
