import assert from 'node:assert/strict';
import { takePromoSlots, runNewToday, runPopular, runVendorSummary, runDeliveryReminder, pushEvent, notifyReviewPush, notifyDeliveredPush, notifyPayoutPush, buildNewToday, buildPopular, buildVendorSummary, buildDeliveryReminder, PROMO_DAILY_MAX } from '../server/notifyPlus';
import { runFlashSale, runRecommendations } from '../server/campaigns';

function fakeDb(tables: Record<string, any[]>) {
  const q = (name: string) => {
    tables[name] = tables[name] || [];
    const filters: Array<(r: any) => boolean> = []; let op: (() => any) | null = null; let single = false;
    const match = () => tables[name].filter(r => filters.every(f => f(r)));
    const t = (v: any) => (typeof v === 'string' && /\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : v);
    const api: any = {
      select: () => api, limit: () => api,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return api; },
      in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return api; },
      gte: (c: string, v: any) => { filters.push(r => t(r[c]) >= t(v)); return api; },
      lte: (c: string, v: any) => { filters.push(r => t(r[c]) <= t(v)); return api; },
      maybeSingle: () => { single = true; return api; },
      insert: (row: any) => { op = (() => { if (name === 'notification_log' && tables[name].some(r => r.key === row.key)) return { error: { message: 'dup' } }; tables[name].push(row); return { error: null }; }) as any; return api; },
      delete: () => { op = (() => { const m = match(); tables[name] = tables[name].filter(r => !m.includes(r)); return { error: null }; }) as any; return api; },
      update: (patch: any) => { op = (() => { match().forEach(r => Object.assign(r, patch)); return { error: null }; }) as any; return api; },
      then: (res: any, rej: any) => Promise.resolve(typeof op === 'function' ? op() : single ? { data: match()[0] ?? null, error: null } : { data: match(), error: null }).then(res, rej),
    };
    return api;
  };
  return { tables, from: (n: string) => q(n) };
}
const sentLog: Array<{ ids: string[]; title: string; message: string; cat: string }> = [];
const send = async (ids: string[], title: string, message: string, cat: string) => { sentLog.push({ ids, title, message, cat }); };
const reset = () => { sentLog.length = 0; };
const ago = (now: Date, h: number) => new Date(now.getTime() - h * 3600e3).toISOString();

(async () => {
  // --- plafond : 4 par jour et par personne, remise à zéro le lendemain
  { const db: any = fakeDb({});
    for (let i = 0; i < PROMO_DAILY_MAX; i++) assert.deepEqual(await takePromoSlots(db, ['u1'], '2026-11-25'), ['u1']);
    assert.deepEqual(await takePromoSlots(db, ['u1'], '2026-11-25'), []);
    assert.deepEqual(await takePromoSlots(db, ['u1', 'u2'], '2026-11-25'), ['u2']);
    assert.deepEqual(await takePromoSlots(db, ['u1'], '2026-11-26'), ['u1']);
    console.log('  ✓ notifyPlus: plafond de 4 messages promo par personne et par jour'); }

  // --- nouveautés du jour
  { const now = new Date('2026-11-25T15:00:00Z');
    const mk = (extra: any = {}) => fakeDb({ products: [{ id: 'p1', name: 'Robe', price: 1500, stock: 3, is_active: true, status: 'published', created_at: ago(now, 5) }, { id: 'p2', name: 'Ancien', price: 1, stock: 3, is_active: true, status: 'published', created_at: ago(now, 72) }, { id: 'p3', name: 'Épuisé', stock: 0, is_active: true, status: 'published', created_at: ago(now, 2) }], profiles: [{ id: 'a', newsletter: true }, { id: 'b', newsletter: false }, { id: 'c', newsletter: true }], ...extra });
    reset(); let db: any = mk();
    const r = await runNewToday(db, send, now);
    assert.equal(r.status, 'sent'); assert.deepEqual(sentLog[0].ids, ['a', 'c']); assert.ok(sentLog[0].message.includes('Robe') && !sentLog[0].message.includes('Ancien') && !sentLog[0].message.includes('Épuisé'));
    assert.equal((await runNewToday(db, send, now)).status, 'skipped'); assert.equal(sentLog.length, 1);   // une seule fois par jour
    db = mk({ products: [{ id: 'p2', name: 'Ancien', stock: 3, is_active: true, status: 'published', created_at: ago(now, 72) }] });
    assert.equal((await runNewToday(db, send, now)).status, 'skipped');                                       // rien de nouveau : rien d'envoyé
    assert.equal((await runNewToday(mk(), send, new Date('2026-11-25T11:00:00Z'))).status, 'skipped');        // 6h à Port-au-Prince : hors plage
    console.log('  ✓ notifyPlus: nouveautés du jour (contenu réel, consentement, une fois par jour, plage horaire)'); }

  // --- produits populaires
  { const now = new Date('2026-11-25T17:00:00Z');
    const orders = (n: number, pid = 'p1', status = 'payee') => Array.from({ length: n }, (_, i) => ({ product_id: pid, status, created_at: ago(now, 10 + i) }));
    const mk = (o: any[], stock = 5) => fakeDb({ orders: o, products: [{ id: 'p1', name: 'Casque', stock, is_active: true, status: 'published' }], profiles: [{ id: 'a', newsletter: true }] });
    reset(); assert.equal((await runPopular(mk(orders(3)), send, now)).status, 'sent'); assert.ok(sentLog[0].message.includes('Casque') && sentLog[0].message.includes('3 commandes'));
    assert.equal((await runPopular(mk(orders(1)), send, now)).status, 'skipped');            // une seule commande : pas « populaire »
    assert.equal((await runPopular(mk(orders(3, 'p1', 'annulee')), send, now)).status, 'skipped');
    assert.equal((await runPopular(mk(orders(3), 0), send, now)).status, 'skipped');         // plus en vente
    console.log('  ✓ notifyPlus: produits populaires (au moins 2 commandes payées, encore en vente)'); }

  // --- résumé vendeur et rappel de livraison
  { const now = new Date('2026-11-25T23:30:00Z');   // 18h30 à Port-au-Prince
    const today = '2026-11-25T20:00:00Z', yesterday = '2026-11-24T20:00:00Z';
    const mk = () => fakeDb({ orders: [
      { vendor_id: 'v1', total_price: 1000, status: 'payee', created_at: today }, { vendor_id: 'v1', total_price: 500, status: 'completed', created_at: today }, { vendor_id: 'v1', total_price: 900, status: 'payee', created_at: yesterday },
      { vendor_id: 'v2', total_price: 700, status: 'payee', created_at: today }, { vendor_id: 'v3', total_price: 300, status: 'payee', created_at: yesterday },
    ], profiles: [{ id: 'v1', notif_livraisons: true }, { id: 'v2', notif_livraisons: false }, { id: 'v3', notif_livraisons: true }] });
    reset(); const db: any = mk();
    assert.equal((await runVendorSummary(db, send, now)).status, 'sent');
    assert.equal(sentLog.length, 1); assert.deepEqual(sentLog[0].ids, ['v1']);                       // v2 a coupé, v3 n'a rien vendu aujourd'hui
    assert.ok(sentLog[0].message.includes('2 commandes payées') && sentLog[0].message.includes('1 500 HTG'.replace(' ', ' ')) || /2 commandes payées \(1.500 HTG\)\. 2 à livrer/.test(sentLog[0].message), sentLog[0].message);
    assert.equal((await runVendorSummary(db, send, now)).status, 'skipped');                          // une fois par jour et par vendeur

    const m2 = new Date('2026-11-25T15:00:00Z');       // 10h
    reset(); const d2: any = fakeDb({ orders: [{ vendor_id: 'v1', status: 'payee', created_at: ago(m2, 30) }, { vendor_id: 'v1', status: 'payee', created_at: ago(m2, 50) }, { vendor_id: 'v1', status: 'payee', created_at: ago(m2, 2) }, { vendor_id: 'v1', status: 'payee', created_at: ago(m2, 24 * 20) }, { vendor_id: 'v2', status: 'payee', created_at: ago(m2, 30) }], profiles: [{ id: 'v1' }, { id: 'v2', notif_livraisons: false }] });
    assert.equal((await runDeliveryReminder(d2, send, m2)).status, 'sent');
    assert.deepEqual(sentLog.map(s => s.ids[0]), ['v1']); assert.ok(sentLog[0].message.startsWith('2 commandes payées attendent'), sentLog[0].message);   // ni la récente (2 h) ni l'ancienne (20 jours), v2 a coupé
    console.log('  ✓ notifyPlus: résumé vendeur et rappel de livraison (chiffres réels, préférence, une fois par jour)'); }

  // --- événements : préférence, doublon, échec
  { reset(); const db: any = fakeDb({ profiles: [{ id: 'u1' }, { id: 'u2', notif_livraisons: false }] });
    const ev = (userId: string, key: string) => pushEvent(db, send, { userId, pref: 'notif_livraisons', title: 't', message: 'm', category: 'order', key });
    assert.equal(await ev('u1', 'k1'), 'sent'); assert.equal(await ev('u1', 'k1'), 'duplicate'); assert.equal(await ev('u2', 'k2'), 'muted'); assert.equal(await ev('', 'k3'), 'no-recipient');
    assert.equal(db.tables.notification_log.some((r: any) => r.key === 'k2'), false);                // coupé : aucune clé réservée
    const boom = await pushEvent(db, async () => { throw new Error('x'); }, { userId: 'u1', pref: 'notif_livraisons', title: 't', message: 'm', category: 'order', key: 'k4' });
    assert.equal(boom, 'failed'); assert.equal(db.tables.notification_log.some((r: any) => r.key === 'k4'), false);   // échec : un nouvel essai reste possible
    console.log('  ✓ notifyPlus: événements (préférence respectée, envoi unique, reprise après échec)'); }

  // --- livraison, virement, avis
  { reset(); const db: any = fakeDb({ orders: [{ id: '49749283-4bc9-488a-9f05-e93ec2b01be5', buyer_id: 'b1', vendor_id: 'v1' }], profiles: [{ id: 'b1' }, { id: 'v1' }, { id: 'rev' }],
      reviews: [{ id: 'r1', user_id: 'rev', product_id: 'p1', rating: 5, comment: 'Très bien' }], products: [{ id: 'p1', name: 'Sac', vendor_id: 'v1' }, { id: 'p2', name: 'Mien', vendor_id: 'rev' }] });
    await notifyDeliveredPush(db, send, '49749283-4bc9-488a-9f05-e93ec2b01be5'); await notifyDeliveredPush(db, send, '49749283-4bc9-488a-9f05-e93ec2b01be5');
    assert.deepEqual(sentLog.map(s => s.ids[0]).sort(), ['b1', 'v1']); assert.ok(sentLog.every(s => s.message.includes('#49749283')));
    reset(); assert.equal(await notifyPayoutPush(db, send, 'o1', 'v1', 1250), 'sent'); assert.ok(/1.250 HTG/.test(sentLog[0].message));
    reset(); assert.equal(await notifyReviewPush(db, send, 'autre', 'r1'), 'no-recipient');            // seul l'auteur de l'avis peut déclencher
    assert.equal(await notifyReviewPush(db, send, 'rev', 'r1'), 'sent'); assert.deepEqual(sentLog[0].ids, ['v1']); assert.ok(sentLog[0].title.includes('5/5') && sentLog[0].message.includes('Sac'));
    assert.equal(await notifyReviewPush(db, send, 'rev', 'r1'), 'duplicate');
    db.tables.reviews.push({ id: 'r2', user_id: 'rev', product_id: 'p2', rating: 4, comment: '' });
    assert.equal(await notifyReviewPush(db, send, 'rev', 'r2'), 'no-recipient');                        // pas de notification pour son propre produit
    console.log('  ✓ notifyPlus: livraison, virement, avis (auteur vérifié, une fois, pas d\'auto-notification)'); }

  // --- les campagnes existantes respectent aussi le plafond
  { const now = new Date('2026-11-25T17:30:00Z');
    const db: any = fakeDb({ products: [{ id: 'p1', name: 'Promo', price: 50, old_price: 100, stock: 5, is_active: true, status: 'published', category: 'Mode' }], profiles: [{ id: 'a', newsletter: true }, { id: 'b', newsletter: true }], notification_log: [{ key: 'promo-2026-11-25-a-1' }, { key: 'promo-2026-11-25-a-2' }, { key: 'promo-2026-11-25-a-3' }, { key: 'promo-2026-11-25-a-4' }], platform_messages: [] });
    reset(); const r = await runFlashSale(db, send, now);
    assert.equal(r.status, 'sent'); assert.deepEqual(sentLog[0].ids, ['b']);                             // « a » a déjà reçu 4 messages aujourd'hui
    console.log('  ✓ notifyPlus: la vente flash respecte le plafond quotidien'); }

  // --- textes : réels, sans emoji
  for (const m of [buildNewToday([{ name: 'A', price: 100 }]), buildNewToday([{ name: 'A' }, { name: 'B' }]), buildPopular('A', 3), buildVendorSummary(1, 500, 0), buildVendorSummary(3, 1500, 2), buildDeliveryReminder(1), buildDeliveryReminder(4)]) {
    assert.ok(m.title && m.message && !/\p{Extended_Pictographic}/u.test(m.title + m.message));
  }
  assert.ok(buildDeliveryReminder(1).message.startsWith('1 commande payée attend')); assert.ok(buildVendorSummary(1, 500, 0).message.includes('1 commande payée'));
  console.log('  ✓ notifyPlus: textes (accords, aucun emoji)');
})();
