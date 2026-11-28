import assert from 'node:assert/strict';
import { captureReferral, readPendingRef, cleanRefCode, REF_DAYS } from '../src/lib/referralCapture';
const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, removeItem: (k: string) => { delete m[k]; } }; };
const T = 1_800_000_000_000;
assert.equal(cleanRefCode(' ab-cd12ef '), 'ABCD12EF');
const s = mem();
assert.equal(captureReferral('?ref=abcd2345&utm_source=facebook&utm_campaign=nov', s, T), true);
assert.deepEqual(readPendingRef(s, T + 1000), { code: 'ABCD2345', at: T, utmSource: 'facebook', utmCampaign: 'nov' });
assert.equal(captureReferral('?ref=ZZZZ9999', s, T + 5000), false);         // le premier lien gagne
assert.equal(readPendingRef(s, T + 5000)!.code, 'ABCD2345');
assert.equal(readPendingRef(s, T + (REF_DAYS + 1) * 86400000), null);        // expiré après 30 jours
assert.equal(captureReferral('?ref=ZZZZ9999', s, T + (REF_DAYS + 1) * 86400000), true); // un nouveau lien est alors accepté
assert.equal(captureReferral('?ref=ab', mem(), T), false);                    // trop court
assert.equal(captureReferral('?page=a-propos', mem(), T), false);
console.log('✓ referralCapture');
