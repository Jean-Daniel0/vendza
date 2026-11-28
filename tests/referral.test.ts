import assert from 'node:assert/strict';
import { generateReferralCode, normalizeReferralCode, phoneKey, rateAt, netCommission, fraudCheck, attachReferral, creditReferralForOrder, reverseReferralForOrder, sweepReferralEarnings, ledgerTotals, canWithdraw, getOrCreateCode } from '../server/referral';

function fakeDb(tables: Record<string, any[]>) {
  let seq = 0;
  const uniq: Record<string, (row: any, rows: any[]) => boolean> = {
    referral_earnings: (r, rows) => rows.some(x => x.order_id === r.order_id && x.kind === r.kind && r.kind !== 'payout'),
    referrals: (r, rows) => rows.some(x => x.referee_id === r.referee_id),
    referral_codes: (r, rows) => rows.some(x => x.code === r.code || x.vendor_id === r.vendor_id),
  };
  const q = (name: string) => {
    tables[name] = tables[name] || [];
    const filters: Array<(r: any) => boolean> = []; let op: any = null; let single = false;
    const match = () => tables[name].filter(r => filters.every(f => f(r)));
    const api: any = {
      select: () => api, order: () => api, limit: () => api,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return api; },
      in: (c: string, vs: any[]) => { filters.push(r => vs.includes(r[c])); return api; },
      maybeSingle: () => { single = true; return api; },
      insert: (rows: any[]) => { op = () => { for (const r of rows) { if (uniq[name]?.(r, tables[name])) return { error: { code: '23505' } }; tables[name].push({ id: 'id' + (++seq), ...r }); } return { error: null }; }; return api; },
      update: (p: any) => { op = () => { match().forEach(r => Object.assign(r, p)); return { error: null }; }; return api; },
      then: (res: any, rej: any) => Promise.resolve(op ? op() : single ? { data: match()[0] ?? null, error: null } : { data: match(), error: null }).then(res, rej),
    };
    return api;
  };
  return { from: q };
}

const NOW = new Date('2026-12-01T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

(async () => {
  // Outils purs
  assert.equal(generateReferralCode(() => 0).length, 8);
  assert.equal(normalizeReferralCode(' ab-12 cd '), 'AB12CD');
  assert.equal(phoneKey('+509 3712-3456'), '37123456'); assert.equal(phoneKey('12'), '');
  assert.equal(rateAt(null, NOW), 0.15);
  assert.equal(rateAt(day(30), NOW), 0.15);
  assert.equal(rateAt(day(200), NOW), 0.015);
  // 10 000 Gdes en MonCash, commission 20 % = 2 000, frais 9 % = 900 -> net 1 100 ; carte 12 % = 1 200 sans frais
  assert.equal(netCommission({ total_price: 10000, payment_method: 'moncash' }, 2000), 1100);
  assert.equal(netCommission({ total_price: 10000, payment_method: 'stripe' }, 1200), 1200);
  assert.equal(netCommission({ total_price: 10000, payment_method: 'moncash' }, 200), 0); // fondateur : jamais de perte
  assert.equal(netCommission({ total_price: 10000, shipping_subsidy: 250, payment_method: 'moncash' }, 2050), 2050 - 922.5);
  // Anti-fraude
  assert.deepEqual(fraudCheck({ id: 'a', phones: [], moncash: [] }, { id: 'a', phones: [], moncash: [] }), { ok: false, reason: 'auto_parrainage' });
  assert.deepEqual(fraudCheck({ id: 'a', phones: ['3712 3456'], moncash: [] }, { id: 'b', phones: ['+509 37123456'], moncash: [] }), { ok: false, reason: 'meme_telephone' });
  assert.deepEqual(fraudCheck({ id: 'a', phones: [], moncash: ['37123456'] }, { id: 'b', phones: [], moncash: ['509-3712-3456'] }), { ok: false, reason: 'meme_moncash' });
  assert.deepEqual(fraudCheck({ id: 'a', phones: [], moncash: ['37123456'] }, { id: 'b', phones: ['37123456'], moncash: [] }), { ok: false, reason: 'meme_telephone' });
  assert.deepEqual(fraudCheck({ id: 'a', phones: ['11111111'], moncash: [] }, { id: 'b', phones: ['22222222'], moncash: [] }), { ok: true });

  const base = () => ({
    profiles: [
      { id: 'P', telephone: '11111111', numero_moncash: '11111111', type: 'vendeur', created_at: day(100) },
      { id: 'F', telephone: '22222222', numero_moncash: '22222222', type: 'vendeur', created_at: day(1) },
      { id: 'OLD', telephone: '33333333', numero_moncash: '', type: 'vendeur', created_at: day(100) },
      { id: 'CLONE', telephone: '11111111', numero_moncash: '', type: 'vendeur', created_at: day(1) },
    ],
    referral_codes: [{ vendor_id: 'P', code: 'PARRAIN1' }],
  } as Record<string, any[]>);

  // Code
  { const t = base(); const db: any = fakeDb(t); assert.equal(await getOrCreateCode(db, 'P'), 'PARRAIN1'); const c = await getOrCreateCode(db, 'F'); assert.match(c, /^[A-Z2-9]{8}$/); assert.equal(await getOrCreateCode(db, 'F'), c); }

  // Rattachement
  { const t = base(); const db: any = fakeDb(t);
    assert.deepEqual(await attachReferral(db, { refereeId: 'F', code: 'parrain1', utmSource: 'facebook' }, NOW), { status: 'ok' });
    assert.equal(t.referrals[0].status, 'pending'); assert.equal(t.referrals[0].utm_source, 'facebook');
    assert.equal((await attachReferral(db, { refereeId: 'F', code: 'PARRAIN1' }, NOW)).reason, 'deja_parraine'); // un seul parrain
    assert.equal((await attachReferral(db, { refereeId: 'P', code: 'PARRAIN1' }, NOW)).reason, 'auto_parrainage');
    assert.equal((await attachReferral(db, { refereeId: 'OLD', code: 'PARRAIN1' }, NOW)).reason, 'compte_existant'); // pas rétroactif
    assert.equal((await attachReferral(db, { refereeId: 'F', code: 'XXXX' }, NOW)).reason, 'code_inconnu');
    const t2 = base(); const db2: any = fakeDb(t2);
    assert.equal((await attachReferral(db2, { refereeId: 'F', code: 'PARRAIN1', clickedAt: day(40) }, NOW)).reason, 'lien_expire');
    assert.equal((await attachReferral(db2, { refereeId: 'CLONE', code: 'PARRAIN1' }, NOW)).status, 'ok'); // même téléphone : enregistré mais refusé
    assert.equal(t2.referrals[0].status, 'rejected'); assert.equal(t2.referrals[0].reject_reason, 'meme_telephone');
  }

  // Gains
  const order = (id: string, extra: any = {}) => ({ id, vendor_id: 'F', vendor_credited: true, total_price: 10000, payment_method: 'moncash', ...extra });
  const commission = async () => 2000;
  { const t = base(); const db: any = fakeDb(t); await attachReferral(db, { refereeId: 'F', code: 'PARRAIN1' }, NOW);
    const deps = { db, commissionFor: commission, now: () => NOW };
    // séquestre non libéré, test, pas de parrain : rien
    assert.equal((await creditReferralForOrder(deps, order('o0', { vendor_credited: false }))).reason, 'sequestre_non_libere');
    assert.equal((await creditReferralForOrder(deps, order('o0', { payment_method: 'moncash_sandbox' }))).reason, 'paiement_test');
    assert.equal((await creditReferralForOrder(deps, order('o0', { vendor_id: 'P' }))).reason, 'pas_de_parrain');
    // 1re vente : 15 % de 1 100 = 165, démarre les 6 mois
    const r1 = await creditReferralForOrder(deps, order('o1')); assert.deepEqual(r1, { status: 'credited', amount: 165 });
    assert.equal(t.referrals[0].status, 'active'); assert.equal(t.referrals[0].first_sale_at, NOW.toISOString());
    // double appel : pas de double gain
    assert.equal((await creditReferralForOrder(deps, order('o1'))).reason, 'deja_compte');
    assert.equal(t.referral_earnings.length, 1);
    // remboursement : une ligne négative, une seule fois
    assert.deepEqual(await reverseReferralForOrder(db, 'o1'), { status: 'reversed', amount: -165 });
    assert.equal((await reverseReferralForOrder(db, 'o1')).status, 'skipped');
    assert.deepEqual(ledgerTotals(t.referral_earnings), { earned: 165, reversed: 165, paid: 0, balance: 0 });
    assert.equal((await reverseReferralForOrder(db, 'inconnue')).status, 'skipped');
  }
  // Après 6 mois : 1,5 % ; inactivité 90 jours : arrêt
  { const t = base(); t.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'active', first_sale_at: day(200), last_sale_at: day(5) }]; const db: any = fakeDb(t);
    const r = await creditReferralForOrder({ db, commissionFor: commission, now: () => NOW }, order('o2')); assert.deepEqual(r, { status: 'credited', amount: 16.5 });
    const t2 = base(); t2.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'active', first_sale_at: day(300), last_sale_at: day(120) }]; const db2: any = fakeDb(t2);
    const r2 = await creditReferralForOrder({ db: db2, commissionFor: commission, now: () => NOW }, order('o3')); assert.equal(r2.reason, 'inactivite_90_jours');
    assert.equal(t2.referrals[0].status, 'blocked'); assert.equal(t2.referral_earnings?.length ?? 0, 0);
    // pendant les 6 premiers mois l'inactivité n'arrête rien
    const t3 = base(); t3.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'active', first_sale_at: day(150), last_sale_at: day(120) }]; const db3: any = fakeDb(t3);
    assert.equal((await creditReferralForOrder({ db: db3, commissionFor: commission, now: () => NOW }, order('o4'))).status, 'credited');
  }
  // Filleul fondateur : commission faible, frais > commission -> aucun gain, aucune perte
  { const t = base(); t.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'pending' }]; const db: any = fakeDb(t);
    const r = await creditReferralForOrder({ db, commissionFor: async () => 200, now: () => NOW }, order('o5')); assert.equal(r.reason, 'commission_nette_nulle');
    assert.equal(t.referrals[0].status, 'active'); assert.equal(t.referral_earnings?.length ?? 0, 0);
  }
  // Fraude découverte au moment du 1er gain (numéro MonCash saisi après l'inscription)
  { const t = base(); t.profiles.find(p => p.id === 'F')!.numero_moncash = '11111111'; t.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'pending' }]; const db: any = fakeDb(t);
    const r = await creditReferralForOrder({ db, commissionFor: commission, now: () => NOW }, order('o6')); assert.equal(r.reason, 'meme_moncash');
    assert.equal(t.referrals[0].status, 'rejected');
  }
  // Parrainage bloqué par l'admin
  { const t = base(); t.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'blocked' }]; const db: any = fakeDb(t);
    assert.equal((await creditReferralForOrder({ db, commissionFor: commission, now: () => NOW }, order('o7'))).reason, 'parrainage_blocked');
  }
  // Rattrapage
  { const t = base(); t.referrals = [{ id: 'R', referrer_id: 'P', referee_id: 'F', status: 'pending' }]; t.orders = [order('s1'), order('s2'), order('s3', { vendor_credited: false })]; const db: any = fakeDb(t);
    const out = await sweepReferralEarnings({ db, commissionFor: commission, now: () => NOW }); assert.equal(out.credited, 2);
    assert.equal((await sweepReferralEarnings({ db, commissionFor: commission, now: () => NOW })).credited, 0);
  }
  // Soldes et seuil
  assert.deepEqual(ledgerTotals([{ kind: 'earn', amount: 3000 }, { kind: 'reversal', amount: -500 }, { kind: 'payout', amount: -1000 }]), { earned: 3000, reversed: 500, paid: 1000, balance: 1500 });
  assert.equal(canWithdraw(2499.99), false); assert.equal(canWithdraw(2500), true);
  console.log('✓ referral');
})().catch(e => { console.error(e); process.exit(1); });
