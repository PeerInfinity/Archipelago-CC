/**
 * quotaNotice — the one visible sign that a localStorage write did not fit: a
 * dismissable banner across the top of the page, naming the key, its size and
 * the largest keys, with a button that opens the Storage panel.
 *
 * The app had no notifier to reuse (plan §39.0): commonUI has no toast, and the
 * only messages were per-panel `alert`s. The banner lives here, beside the panel
 * it opens, and is fed by app/core/storageQuota.js's listener (index.js).
 * One banner at a time: a later failure replaces the text and counts.
 */

export const QUOTA_NOTICE_ID = 'storage-quota-notice';

let failures = 0;

/** The banner element, or null when none is showing. */
export function quotaNoticeElement(doc = globalThis.document) {
    return doc?.getElementById(QUOTA_NOTICE_ID) ?? null;
}

/** Remove the banner (and reset its count). */
export function hideQuotaNotice(doc = globalThis.document) {
    quotaNoticeElement(doc)?.remove();
    failures = 0;
}

/**
 * Show (or update) the banner for `notice` (storageQuota's shape).
 * `onOpen` is called by the "Open Storage panel" button.
 */
export function showQuotaNotice(notice, { onOpen, doc = globalThis.document } = {}) {
    if (!doc?.body) return null;
    failures += 1;
    let el = quotaNoticeElement(doc);
    if (!el) {
        el = doc.createElement('div');
        el.id = QUOTA_NOTICE_ID;
        el.className = 'storage-quota-notice';
        el.setAttribute('role', 'alert');

        const text = doc.createElement('span');
        text.className = 'storage-quota-notice-text';
        el.appendChild(text);

        const open = doc.createElement('button');
        open.type = 'button';
        open.className = 'storage-quota-notice-open';
        open.textContent = 'Open Storage panel';
        el.appendChild(open);

        const dismiss = doc.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'storage-quota-notice-dismiss';
        dismiss.textContent = 'Dismiss';
        dismiss.title = 'Hide this notice (it comes back on the next write that does not fit)';
        dismiss.addEventListener('click', () => hideQuotaNotice(doc));
        el.appendChild(dismiss);

        doc.body.prepend(el);
    }
    el.querySelector('.storage-quota-notice-text').textContent = notice.message
        + (failures > 1 ? ` (${failures} writes have failed so far.)` : '');
    const open = el.querySelector('.storage-quota-notice-open');
    open.onclick = () => onOpen?.();
    el.dataset.key = notice.key ?? '';
    return el;
}
