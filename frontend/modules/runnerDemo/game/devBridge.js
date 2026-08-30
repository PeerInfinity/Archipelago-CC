/**
 * Standalone dev harness — plays HOST for the Runner page when it's
 * opened directly in a tab (no iframe, no app). Drives the same
 * `__swfBridge` contract the real flash bridge uses: configure() with
 * a fixture level + physics stamp, pollItems() from item checkboxes,
 * and logging implementations of the outward calls (sendLocation /
 * sendExit). Swapping in the real bridge requires zero page changes.
 *
 * Test surface: every outward call is also recorded in
 * `window.__devCalls` ([{ fn, args }]) so the Playwright verification
 * can assert traversal (portal touch observed) without scraping the
 * log DOM. URL params: ?fixture=<id> picks the starting fixture,
 * ?profile=<id> the physics profile.
 */

import { FIXTURES } from '../fixtures.js';
import { PROFILES, DEFAULT_PROFILE_ID, physicsStampFor } from '../physics.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from '../gameCore.js';

export function installDevHarness(bridge, container) {
    container.innerHTML = `
        <h3>dev harness (standalone)</h3>
        <div>fixture: <select id="dev-fixture"></select>
             profile: <select id="dev-profile"></select>
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
    window.__devCalls = [];
    const record = (fn, ...args) => {
        window.__devCalls.push({ fn, args });
        log(`${fn}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
    };

    // host side of the outward contract: log what the game reports
    bridge.sendLocation = (pickupId) => record('sendLocation', pickupId);
    bridge.sendExit = (portalId, side) => record('sendExit', portalId, side);

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

    // fixture + profile selects -> configure
    const params = new URLSearchParams(window.location.search);
    const fixtureEl = container.querySelector('#dev-fixture');
    for (const f of FIXTURES) {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.id;
        fixtureEl.append(opt);
    }
    const profileEl = container.querySelector('#dev-profile');
    for (const id of Object.keys(PROFILES)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        profileEl.append(opt);
    }
    const wantFixture = params.get('fixture');
    if (FIXTURES.some((f) => f.id === wantFixture)) fixtureEl.value = wantFixture;
    const wantProfile = params.get('profile');
    profileEl.value = PROFILES[wantProfile] ? wantProfile : DEFAULT_PROFILE_ID;

    const loadFixture = () => {
        const level = FIXTURES.find((f) => f.id === fixtureEl.value);
        bridge.configure({
            regionId: `standalone_${level.id}`,
            params: {
                runnerLevel: level,
                physics: physicsStampFor(profileEl.value),
            },
        });
        log(`configure(${level.id}, ${profileEl.value})`);
    };
    fixtureEl.addEventListener('change', loadFixture);
    profileEl.addEventListener('change', loadFixture);
    container.querySelector('#dev-reset').addEventListener('click', () => bridge.reset?.());

    loadFixture();
}
