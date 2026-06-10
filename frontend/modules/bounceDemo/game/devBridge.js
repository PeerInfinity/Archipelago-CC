/**
 * Standalone dev harness — plays HOST for the Bounce Demo page when
 * it's opened directly in a tab (no iframe, no app). Drives the same
 * `__swfBridge` contract the real flash bridge uses: configure() with
 * a zone's transformed level, pollItems() from item checkboxes, and
 * logging implementations of the outward calls (sendLocation /
 * sendExit). Swapping in the real bridge requires zero page changes.
 */

import { ZONES } from '../bounceDemoLibrary.js';
import { attachSideExits } from '../sideExits.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from '../apRules.js';

const ALL_SIDES = ['N', 'E', 'S', 'W'];

export function installDevHarness(bridge, container) {
    container.innerHTML = `
        <h3>dev harness (standalone)</h3>
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

    // zone select -> configure (same transform the pipeline applies)
    const zoneEl = container.querySelector('#dev-zone');
    ZONES.forEach((zone, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = `${idx}: ${zone.level.id}`;
        zoneEl.append(opt);
    });
    const loadZone = (idx) => {
        const { level, sidePortals } = attachSideExits(ZONES[idx].level, ALL_SIDES);
        bridge.configure({
            regionId: `standalone_z${idx}`,
            params: { bounceLevel: level, sidePortals },
        });
        log(`configure(zone ${idx}: ${level.id})`);
    };
    zoneEl.addEventListener('change', () => loadZone(Number(zoneEl.value)));
    container.querySelector('#dev-reset').addEventListener('click', () => bridge.reset?.());

    loadZone(0);
}
