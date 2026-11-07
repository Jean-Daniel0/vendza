import assert from 'node:assert/strict';
import { isValidAdminSlug, classifyAdminPath, jwtClaims, hasSecondFactor, FailureTracker, maskIdNumber, validateVerification, summarizeOrders, createAdminGuard, clientIp, promoFlags } from '../server/adminSecurity';

const slug = 'gestion-k3j9x2m4p8q1w7z5a6b0c';
assert.ok(isValidAdminSlug(slug)); assert.ok(!isValidAdminSlug('gestion-court')); assert.ok(!isValidAdminSlug('admin')); assert.ok(!isValidAdminSlug(undefined));
assert.equal(classifyAdminPath(`/${slug}`, slug), 'match');
assert.equal(classifyAdminPath(`/${slug.toUpperCase()}/`, slug), 'match');
assert.equal(classifyAdminPath('/admin/paiements', slug), 'hidden');
assert.equal(classifyAdminPath('/gestion-devine', slug), 'hidden');
assert.equal(classifyAdminPath('/admin', undefined), 'hidden');
assert.equal(classifyAdminPath(`/${slug}`, undefined), 'hidden'); // sans secret valide : nulle part
assert.equal(classifyAdminPath('/boutique/x', slug), 'other'); assert.equal(classifyAdminPath('/', slug), 'other'); assert.equal(classifyAdminPath('/api/admin/me', slug), 'other');

const jwt = (c: object) => `h.${Buffer.from(JSON.stringify(c)).toString('base64url')}.s`;
assert.equal(jwtClaims(jwt({ aal: 'aal2' })).aal, 'aal2');
assert.ok(hasSecondFactor(jwt({ aal: 'aal2' }))); assert.ok(!hasSecondFactor(jwt({ aal: 'aal1' }))); assert.ok(!hasSecondFactor('n-importe-quoi')); assert.ok(!hasSecondFactor(''));

const t = new FailureTracker(3, 1000);
assert.ok(!t.isBlocked('ip', 0)); t.record('ip', 0); t.record('ip', 1); t.record('ip', 2);
assert.ok(t.isBlocked('ip', 3)); assert.ok(!t.isBlocked('autre', 3)); assert.ok(!t.isBlocked('ip', 5000));

assert.ok(maskIdNumber('0012345678').endsWith('5678')); assert.ok(!maskIdNumber('0012345678').includes('0012'));
assert.equal(maskIdNumber(''), ''); assert.equal(maskIdNumber('12'), '••••');
assert.deepEqual(validateVerification({ decision: 'verifie' }).ok, true); assert.equal((validateVerification({ decision: 'admin' }) as any).ok, false);

const now = Date.parse('2026-11-05T00:00:00Z');
const s = summarizeOrders([{ status: 'payee', total_price: 1000, created_at: '2026-11-01T00:00:00Z' }, { status: "'pending'", total_price: 5, created_at: '2026-11-01T00:00:00Z' }, { status: 'completed', total_price: '500', created_at: '2026-08-01T00:00:00Z' }], now);
assert.equal(s.sales30, 1000); assert.equal(s.count30, 1); assert.equal(s.byStatus.pending, 1); assert.equal(s.total, 3);

assert.deepEqual(promoFlags({ price: 4000, old_price: 10000 }), { discount: 60, flags: ['remise_elevee'] });
assert.deepEqual(promoFlags({ price: 5000, old_price: null, old_price_declared: 10000, promo_status: 'refusee' }), { discount: 50, flags: ['refusee'] });
assert.deepEqual(promoFlags({ price: 100, old_price: 120, promo_status: 'transition' }), { discount: 17, flags: ['transition'] });
assert.deepEqual(promoFlags({ price: 100 }), { discount: 0, flags: [] });

// Gardien : anonyme, non-admin, admin sans 2e facteur, admin complet
const mk = (token: string, user: any, isAdmin: boolean, ip = '1.1.1.1') => {
  const res: any = { code: 0, body: null, locals: {}, setHeader() {}, status(c: number) { this.code = c; return this; }, json(b: any) { this.body = b; return this; } };
  const req: any = { headers: { authorization: token ? `Bearer ${token}` : '', 'x-forwarded-for': `9.9.9.9, ${ip}` }, socket: {} };
  return { req, res };
};
const guard = createAdminGuard({ getAuthedUser: async (r: any) => (r.headers.authorization ? { id: 'u1', email: 'a@b.c' } : null),
  makeUserClient: (tok: string) => ({ rpc: async () => ({ data: tok.includes('ADMIN'), error: null }) }), requireMfa: () => true, tracker: new FailureTracker(2, 60000) });
(async () => {
  let x = mk('', null, false); assert.equal(await guard(x.req, x.res), null); assert.equal(x.res.code, 404);
  x = mk('user', null, false); assert.equal(await guard(x.req, x.res), null); assert.equal(x.res.code, 404);
  x = mk('user', null, false); assert.equal(await guard(x.req, x.res), null); assert.equal(x.res.code, 429); // trop d'échecs depuis la même adresse
  const aal1 = `ADMIN.${Buffer.from('{"aal":"aal1"}').toString('base64url')}.s`;
  const aal2 = `ADMIN.${Buffer.from('{"aal":"aal2"}').toString('base64url')}.s`;
  x = mk(aal1, null, true, '2.2.2.2'); assert.equal(await guard(x.req, x.res), null); assert.equal(x.res.code, 401); assert.equal(x.res.body.mfa, true);
  x = mk(aal1, null, true, '2.2.2.2'); const sk = await guard(x.req, x.res, { skipMfa: true }); assert.equal(sk?.id, 'u1');
  x = mk(aal2, null, true, '2.2.2.2'); const ok = await guard(x.req, x.res); assert.equal(ok?.id, 'u1'); assert.equal(x.res.locals.adminId, 'u1');
  assert.equal(clientIp(x.req), '2.2.2.2');
  console.log('  ✓ adminSecurity: adresse secrète, 2e facteur, limite des tentatives, fausse 404, gardien admin');
})();
