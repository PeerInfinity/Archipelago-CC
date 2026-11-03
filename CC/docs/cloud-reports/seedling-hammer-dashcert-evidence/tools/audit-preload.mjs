// DASHCERT: node --import <this> … — installs DASH_CERT_SIGHT.audit and writes it (with counts) to $DASHCERT_AUDIT_OUT at exit.
import { writeFileSync } from 'node:fs';
const REPO = process.env.DASHCERT_REPO;
const sb = await import(`${REPO}/frontend/modules/seedlingDemo/solverBot.js`);
sb.DASH_CERT_SIGHT.audit = [];
process.on('exit', () => writeFileSync(`${process.env.DASHCERT_AUDIT_OUT}.${process.pid}.json`, JSON.stringify({ counts: sb.DASH_CERT_SIGHT.counts,
    enabled: sb.DASH_CERT_SIGHT.enabled, rows: sb.DASH_CERT_SIGHT.audit })));
