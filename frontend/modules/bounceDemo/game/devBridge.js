/**
 * Standalone dev harness — plays HOST for the Bounce Demo page when
 * it's opened directly in a tab (no iframe, no app). Drives the same
 * `__swfBridge` contract the real flash bridge uses: configure() with
 * a zone's transformed level, pollItems() from item checkboxes, and
 * logging implementations of the outward calls (sendLocation /
 * sendExit). Swapping in the real bridge requires zero page changes.
 */

import { ZONES } from '../bounceDemoLibrary.js';
import { generateZoneSet } from '../generator.js';
import { attachSideExits } from '../sideExits.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from '../apRules.js';

const ALL_SIDES = ['N', 'E', 'S', 'W'];

export function installDevHarness(bridge, container) {
    container.innerHTML = `
        <h3>dev harness (standalone)</h3>
        <div>zones: <select id="dev-source">
                <option value="fixtures">fixtures</option>
                <option value="gen">generated (seed)</option>
             </select>
             seed <input id="dev-seed" type="number" value="1" style="width:4em">
             jitter <input id="dev-jitter" type="number" value="0" min="0" max="40" style="width:4em">
             placement: <select id="dev-placement">
                <option value="directional">directional</option>
                <option value="arbitrary">arbitrary</option>
             </select></div>
        <div>level: <select id="dev-zone"></select>
             <button id="dev-reset">reset level</button></div>
        <h3>items (pollItems)</h3>
        <div id="dev-items"></div>
        <h3>outward calls</h3>
        <div id="devlog"></div>`;

    const logEl = container.querySelector('#devlog');
    const log = (text) => {
        logEl.textContent += `${text}\n`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    // host side of the outward contract: log what the game reports
    bridge.sendLocation = (pickupId) => log(`sendLocation(${pickupId})`);
    bridge.sendExit = (portalId, side) => log(`sendExit(${portalId}, side=${side})`);

    // item checkboxes -> pollItems
    const itemNames = [...Object.values(ABILITY_ITEM_NAMES), VICTORY_ITEM_NAME];
    const itemsEl = container.querySelector('#dev-items');
    for (const name of itemNames) {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = name;
        label.append(box, ` ${name}`);
        itemsEl.append(label);
    }
    const pushItems = () => {
        const granted = [...itemsEl.querySelectorAll('input:checked')].map((b) => b.value);
        bridge.pollItems(granted);
        log(`pollItems([${granted.join(', ')}])`);
    };
    itemsEl.addEventListener('change', pushItems);

    // zone-source + placement + zone select -> configure (same
    // transform the pipeline applies)
    const sourceEl = container.querySelector('#dev-source');
    const seedEl = container.querySelector('#dev-seed');
    const jitterEl = container.querySelector('#dev-jitter');
    const placementEl = container.querySelector('#dev-placement');
    const zoneEl = container.querySelector('#dev-zone');
    let zones = ZONES;

    const rebuildZoneList = () => {
        zoneEl.innerHTML = '';
        zones.forEach((zone, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            const grants = Object.values(zone.items).join('+') || 'filler';
            opt.textContent = `${idx}: ${zone.level.id} [${grants}]`;
            zoneEl.append(opt);
        });
    };
    const loadZone = (idx) => {
        const { level, sidePortals } = attachSideExits(zones[idx].level, ALL_SIDES, {
            placement: placementEl.value,
        });
        bridge.configure({
            regionId: `standalone_z${idx}`,
            params: { bounceLevel: level, sidePortals },
        });
        log(`configure(zone ${idx}: ${level.id}, ${placementEl.value})`);
    };
    const reloadSource = () => {
        // jitter applies to generated zones only (fixtures are static);
        // generateZoneSet adds both arrows to non-starter requirements
        // when jittered, since jitter only verifies under two-way
        // correction. Generation runs the full verifier — expect a
        // short pause at higher jitter.
        zones = sourceEl.value === 'gen'
            ? generateZoneSet({
                count: 7,
                seed: Number(seedEl.value) || 1,
                jitter: Math.max(0, Number(jitterEl.value) || 0),
            })
            : ZONES;
        rebuildZoneList();
        loadZone(0);
    };
    sourceEl.addEventListener('change', reloadSource);
    const regen = () => { if (sourceEl.value === 'gen') reloadSource(); };
    seedEl.addEventListener('change', regen);
    jitterEl.addEventListener('change', regen);
    placementEl.addEventListener('change', () => loadZone(Number(zoneEl.value)));
    zoneEl.addEventListener('change', () => loadZone(Number(zoneEl.value)));
    container.querySelector('#dev-reset').addEventListener('click', () => bridge.reset?.());

    rebuildZoneList();
    loadZone(0);
}
