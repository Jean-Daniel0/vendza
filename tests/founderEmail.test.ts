import assert from 'node:assert/strict';
import { founderInvite, sendViaResend, EmailConfig } from '../server/email';
import { unsubToken, verifyUnsubToken, unsubscribeUrl, registerUnsubscribeRoutes } from '../server/unsubscribe';
import { runFounderInviteEmail } from '../server/founderAdmin';

const cfg: EmailConfig = { apiKey: 're_test', from: 'Vendza <a@vendza.store>', siteUrl: 'https://www.vendza.store' };
const U = '11111111-1111-4111-8111-111111111111';
const SECRET = 'secret-de-test';

// --- jeton signé
assert.ok(verifyUnsubToken(U, unsubToken(U, SECRET), SECRET));
assert.ok(!verifyUnsubToken(U, unsubToken(U, 'autre'), SECRET));
assert.ok(!verifyUnsubToken('22222222-2222-4222-8222-222222222222', unsubToken(U, SECRET), SECRET));
assert.ok(!verifyUnsubToken(U, '', SECRET)); assert.ok(!verifyUnsubToken(U, 'x', ''));
const url = unsubscribeUrl(cfg.siteUrl, U, SECRET);
assert.ok(url.startsWith('https://www.vendza.store/api/email/unsubscribe?u=' + U) && !url.includes(SECRET));

// --- modèle : texte en HTML, JPEG pour l'image, désinscription, échappement, pas d'emoji
const m = founderInvite({ siteUrl: cfg.siteUrl, name: '<b>Léa</b>', remaining: 49, unsubscribeUrl: url });
assert.ok(m.html.includes('programme-fondateurs-email.jpg') && !m.html.includes('.webp'));
assert.ok(m.html.includes('49 places sur 50') && m.html.includes('Se désinscrire') && m.text.includes(url));
assert.ok(!m.html.includes('<b>Léa</b>') && !/[\r\n]/.test(m.subject) && !/\p{Extended_Pictographic}/u.test(m.html + m.text + m.subject));
assert.ok(founderInvite({ siteUrl: cfg.siteUrl, remaining: 1, unsubscribeUrl: url }).subject.includes('1 place sur 50'));

(async () => {
  // --- Resend reçoit les en-têtes de désinscription
  let body: any;
  await sendViaResend(cfg, { to: 'a@b.co', rendered: m, headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }, (async (_u: any, init: any) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ id: 'x' }) }; }) as any);
  assert.equal(body.headers['List-Unsubscribe'], `<${url}>`);

  // --- faux Supabase : 4 boutiques, v1 membre, a=promos oui, b=promos non, c=promos oui, d=promos null
  const members = ['v1']; const logged = new Set<string>(); const profs = [{ id: 'a', newsletter: true }, { id: 'b', newsletter: false }, { id: 'c', newsletter: true }, { id: 'd', newsletter: null }];
  const db: any = { from: (t: string) => t === 'shops' ? { select: () => ({ limit: async () => ({ data: ['a', 'b', 'c', 'd', 'v1'].map(vendor_id => ({ vendor_id })) }) }) }
    : t === 'founder_program' ? { select: () => ({ limit: async () => ({ data: members.map(vendor_id => ({ vendor_id })) }) }) }
    : t === 'profiles' ? { select: () => ({ in: async (_c: string, ids: string[]) => ({ data: profs.filter(p => ids.includes(p.id)) }) }) }
    : { select: () => ({ in: async (_c: string, keys: string[]) => ({ data: keys.filter(k => logged.has(k)).map(dedupe_key => ({ dedupe_key })) }) }), insert: async ({ dedupe_key }: any) => { logged.add(dedupe_key); return { error: null }; }, update: () => ({ eq: async () => ({}) }), delete: () => ({ eq: async () => ({}) }) } };
  const sent: string[] = [];
  const deps = (c: EmailConfig | null): any => ({ db: { ...db, auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@x.co` } } }) } } }, cfg: c, spacingMs: 0,
    send: async (_c: any, msg: any) => { sent.push(msg.to); return { ok: true, id: 'id' }; } });
  const run = (c: EmailConfig | null, o: any) => { const d = deps(c); return runFounderInviteEmail(d.db, d, SECRET, o); };

  const sim = await run(null, { simulate: true });
  assert.deepEqual([sim.status, sim.recipients, sim.optedOut, sim.emailsEnabled], ['simulation', 2, 2, false]); assert.equal(sent.length, 0);
  const off = await run(null, { simulate: false });
  assert.equal(off.status, 'skipped'); assert.equal(sent.length, 0);
  const r1 = await run(cfg, { simulate: false, batch: 1 });
  assert.deepEqual([r1.status, r1.recipients, r1.remaining], ['sent', 1, 1]); assert.deepEqual(sent, ['a@x.co']);
  const r2 = await run(cfg, { simulate: false });
  assert.equal(r2.recipients, 1); assert.deepEqual(sent, ['a@x.co', 'c@x.co']);
  const r3 = await run(cfg, { simulate: false });
  assert.equal(r3.recipients, 0); assert.equal(r3.alreadySent, 2); assert.equal(sent.length, 2); // b, d (pas de consentement) et v1 (membre) n'ont jamais reçu
  console.log('  ✓ founderEmail: consentement, envoi unique, lots, simulation, e-mails désactivés');

  // --- routes de désinscription : GET ne change rien, POST désinscrit, jeton faux refusé
  const handlers: Record<string, any> = {}; const updates: any[] = [];
  const app: any = { get: (p: string, h: any) => { handlers['GET ' + p] = h; }, post: (p: string, h: any) => { handlers['POST ' + p] = h; } };
  registerUnsubscribeRoutes(app, { supabase: { from: () => ({ update: (v: any) => ({ eq: async (_c: string, id: string) => { updates.push([v, id]); return { error: null }; } }) }) }, secret: SECRET });
  const call = async (k: string, q: any) => { const r: any = { code: 200, set() { return r; }, status(c: number) { r.code = c; return r; }, type() { return r; }, send(b: string) { r.body = b; return r; } }; await handlers[k]({ query: q }, r); return r; };
  const t = unsubToken(U, SECRET); const P = '/api/email/unsubscribe';
  assert.equal((await call('GET ' + P, { u: U, t })).code, 200); assert.equal(updates.length, 0);
  assert.equal((await call('POST ' + P, { u: U, t: 'faux' })).code, 400); assert.equal(updates.length, 0);
  assert.equal((await call('POST ' + P, { u: U, t })).code, 200); assert.deepEqual(updates, [[{ newsletter: false }, U]]);
  console.log('  ✓ founderEmail: désinscription (aperçu sans effet, jeton vérifié, newsletter=false)');
})();
