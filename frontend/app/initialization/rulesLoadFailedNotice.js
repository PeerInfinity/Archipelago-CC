/**
 * rulesLoadFailedNotice — the page's one visible surface for a rules load the
 * state-manager worker could not complete (`stateManager:loadFailed`, from the
 * worker's `rulesLoadFailed`).
 *
 * ⛓ Before this, such a load left the page hanging with two console lines. Now
 * it shows a fixed banner naming the game, the player, the phase and the message.
 * A later successful load (`stateManager:rulesLoaded`) removes it.
 *
 * The formatter is pure and unit-tested (rulesLoadFailedNotice.test.js). The
 * banner is a plain DOM node, so it does not depend on any panel being up.
 *
 * @module app/initialization/rulesLoadFailedNotice
 */

export const RULES_LOAD_FAILED_BANNER_ID = 'rules-load-failed-banner';

/**
 * The banner's text lines. Each field that is missing is named as missing, so a
 * blank never reads as data.
 * @param {object} failure - {game, player, phase, where, message, source}
 * @returns {{title: string, lines: string[]}}
 */
export function formatRulesLoadFailure(failure = {}) {
  const or = (v, missing) => (v === null || v === undefined || v === '' ? missing : String(v));
  const lines = [
    `Game: ${or(failure.game, 'unknown game')}`,
    `Player: ${or(failure.player, 'unknown player')}`,
    `Phase: ${or(failure.phase, 'unknown phase')}${failure.where ? ` (region '${failure.where}')` : ''}`,
    `Error: ${or(failure.message, 'no message')}`,
  ];
  if (failure.source) lines.push(`Rules file: ${failure.source}`);
  return { title: 'The rules could not be loaded.', lines };
}

function renderBanner(doc, failure) {
  doc.getElementById(RULES_LOAD_FAILED_BANNER_ID)?.remove();
  const { title, lines } = formatRulesLoadFailure(failure);
  const banner = doc.createElement('div');
  banner.id = RULES_LOAD_FAILED_BANNER_ID;
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position:fixed', 'top:8px', 'left:50%', 'transform:translateX(-50%)', 'z-index:100000',
    'max-width:min(720px, calc(100vw - 32px))', 'padding:10px 14px', 'border-radius:6px',
    'background:#5c1414', 'color:#fff', 'border:1px solid #ff8a8a',
    'font:13px/1.4 system-ui, sans-serif', 'box-shadow:0 2px 10px rgba(0,0,0,.4)',
    'white-space:pre-wrap', 'overflow-wrap:anywhere',
  ].join(';');
  const head = doc.createElement('strong');
  head.textContent = title;
  const body = doc.createElement('div');
  body.className = 'rules-load-failed-details';
  body.textContent = lines.join('\n');
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = 'Dismiss';
  close.style.cssText = 'margin-top:6px';
  close.addEventListener('click', () => banner.remove());
  banner.append(head, body, close);
  (doc.body || doc.documentElement).appendChild(banner);
  return banner;
}

/**
 * Subscribes the banner to the bus. Returns an uninstall function.
 * @param {object} eventBus
 * @param {Document} [doc]
 */
export function installRulesLoadFailedNotice(eventBus, doc = globalThis.document) {
  if (!eventBus || !doc) return () => {};
  const onFailed = (failure) => {
    renderBanner(doc, failure);
    // The loading screen would otherwise sit over the page with nothing behind it.
    doc.getElementById('loading-screen')?.classList.add('hidden');
  };
  const onLoaded = () => doc.getElementById(RULES_LOAD_FAILED_BANNER_ID)?.remove();
  eventBus.subscribe('stateManager:loadFailed', onFailed, 'core');
  eventBus.subscribe('stateManager:rulesLoaded', onLoaded, 'core');
  return () => {
    eventBus.unsubscribe('stateManager:loadFailed', onFailed, 'core');
    eventBus.unsubscribe('stateManager:rulesLoaded', onLoaded, 'core');
  };
}
