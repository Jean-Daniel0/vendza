import React, { useCallback, useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';

type Refund = {
  id: string; order_id: string; status: 'pending' | 'paid' | 'rejected'; created_at: string; paid_at: string | null; note: string;
  amount: number; fee: number; buyer_name: string; buyer_moncash: string; buyer_phone: string;
  product_name: string; payment_method: string; payment_reference: string;
};
type Payout = {
  order_id: string; shop: string; moncash: string; moncash_name: string; total_price: number;
  payout_amount: number | null; state: string; created_at: string | null;
};
type Queue = { refunds: Refund[]; payouts: Payout[]; totals: { refunds_pending_count: number; refunds_pending_amount: number; payouts_open_count: number } };
type LogRow = { id: string; created_at: string; admin_email: string | null; action: string; order_id: string | null; amount: number | null; reference: string | null; note: string | null };

const htg = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} HTG`;
const day = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function AdminPaymentsPage() {
  const [state, setState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [tab, setTab] = useState<'refunds' | 'payouts' | 'log'>('refunds');
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bazik, setBazik] = useState<{ balance: number | null; reserved?: number | null; environment?: string | null; raw?: string; error?: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const me = await apiFetchAuthed('/api/admin/payments/me');
      if (!me.ok) { setState('denied'); return; }
      const [q, l] = await Promise.all([apiFetchAuthed('/api/admin/payments/queue'), apiFetchAuthed('/api/admin/payments/log')]);
      if (!q.ok) throw new Error();
      setQueue(await q.json());
      setLog(l.ok ? (await l.json()).log || [] : []);
      try {
        const b = await apiFetchAuthed('/api/admin/payments/bazik-balance');
        setBazik(b.ok ? await b.json() : { balance: null, error: 'Solde Bazik indisponible.' });
      } catch { setBazik({ balance: null, error: 'Solde Bazik indisponible.' }); }
      setState('ok');
    } catch { setError('Impossible de charger les paiements.'); setState('ok'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, kind: 'paid' | 'reject') => {
    setBusy(id); setError(''); setNotice('');
    try {
      const r = await apiFetchAuthed(`/api/admin/payments/refunds/${id}/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: refs[id] || '', note: notes[id] || '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || 'Opération impossible.');
      else { setNotice(j.logged === false ? 'Enregistré, mais le journal n’a pas pu être écrit : prévenez le développeur.' : kind === 'paid' ? 'Remboursement marqué payé.' : 'Remboursement refusé.'); await load(); }
    } catch { setError('Erreur réseau. Réessayez.'); }
    setBusy(null);
  };

  const download = async (kind: 'refunds' | 'payouts' | 'log') => {
    setError('');
    try {
      const r = await apiFetchAuthed(`/api/admin/payments/export/${kind}`);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = `vendza-${kind}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setError('Export impossible.'); }
  };

  if (state === 'loading') return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;
  if (state === 'denied') return <p className="mx-auto max-w-md py-16 text-center text-sm text-slate-600">Accès réservé à l’administrateur. Connectez-vous sur vendza.store avec le compte admin, puis revenez sur cette page.</p>;

  const pending = (queue?.refunds || []).filter(r => r.status === 'pending');
  const done = (queue?.refunds || []).filter(r => r.status !== 'pending');

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 text-slate-900">
      <h1 className="text-xl font-bold">Paiements</h1>
      <p className="text-sm text-slate-500">
        À rembourser : <b>{queue?.totals.refunds_pending_count ?? 0}</b> ({htg(queue?.totals.refunds_pending_amount ?? 0)}) · Virements vendeurs à suivre : <b>{queue?.totals.payouts_open_count ?? 0}</b>
      </p>
      {bazik && (() => {
        const owed = (queue?.payouts || []).reduce((s, p) => s + (p.payout_amount ?? p.total_price), 0);
        const low = bazik.balance !== null && owed > bazik.balance;
        return (
          <p className={`rounded-xl p-3 text-sm ${low ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
            Solde Bazik disponible : <b>{bazik.balance !== null ? htg(bazik.balance) : 'non lu'}</b>
            {bazik.reserved ? ` · réservé ${htg(bazik.reserved)}` : ''}
            {bazik.environment ? ` · compte ${bazik.environment === 'production' ? 'RÉEL (production)' : 'TEST (sandbox)'}` : ''}
            {bazik.error ? ` · ${bazik.error}` : ''}{bazik.raw ? ` · réponse : ${bazik.raw}` : ''}
            {low ? ` · Attention : les virements en attente peuvent atteindre ${htg(owed)}, le solde pourrait ne pas suffire (les frais Bazik s’ajoutent à chaque virement).` : ''}
          </p>
        );
      })()}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <nav className="flex gap-2 text-sm" aria-label="Sections">
        {([['refunds', 'Remboursements'], ['payouts', 'Virements vendeurs'], ['log', 'Journal']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`rounded-full px-3 py-1.5 font-medium ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{label}</button>
        ))}
        <button onClick={() => download(tab)} className="ml-auto rounded-full border border-slate-300 px-3 py-1.5">Exporter CSV</button>
      </nav>

      {tab === 'refunds' && (
        <section className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-slate-500">Aucun remboursement en attente.</p>}
          {pending.map(r => (
            <article key={r.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold">{htg(r.amount)} à rembourser</h2>
                <span className="shrink-0 text-xs text-slate-400">{day(r.created_at)}</span>
              </div>
              <p>{r.buyer_name || 'Acheteur'} · MonCash <b>{r.buyer_moncash || 'non renseigné'}</b>{r.buyer_phone ? ` · tél. ${r.buyer_phone}` : ''}</p>
              <p className="text-slate-500">{r.product_name} · payé par {r.payment_method || '—'} · frais retenus {htg(r.fee)}</p>
              <input value={refs[r.id] || ''} onChange={e => setRefs({ ...refs, [r.id]: e.target.value })} placeholder="Référence MonCash du remboursement"
                className="w-full rounded-xl border border-slate-300 p-2" aria-label="Référence MonCash du remboursement" />
              <input value={notes[r.id] || ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note ou motif (obligatoire pour refuser)"
                className="w-full rounded-xl border border-slate-300 p-2" aria-label="Note ou motif" />
              <div className="flex gap-2">
                <button disabled={busy === r.id} onClick={() => decide(r.id, 'paid')} className="rounded-xl bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Marquer payé</button>
                <button disabled={busy === r.id} onClick={() => decide(r.id, 'reject')} className="rounded-xl border border-red-300 px-3 py-2 font-semibold text-red-700 disabled:opacity-50">Refuser</button>
              </div>
            </article>
          ))}
          {done.length > 0 && <h2 className="pt-2 text-sm font-bold text-slate-500">Déjà traités ({done.length})</h2>}
          {done.map(r => (
            <p key={r.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              {r.status === 'paid' ? 'Payé' : 'Refusé'} · {htg(r.amount)} · {r.buyer_name || 'Acheteur'} · {day(r.paid_at || r.created_at)}{r.note ? ` · ${r.note}` : ''}
            </p>
          ))}
        </section>
      )}

      {tab === 'payouts' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">Commandes livrées dont le vendeur n’a pas encore reçu son virement. Le virement automatique se relance depuis la commande (acheteur ou vendeur) ; « n° MonCash manquant » = le vendeur doit renseigner son numéro.</p>
          {(queue?.payouts.length ?? 0) === 0 && <p className="text-sm text-slate-500">Aucun virement en attente.</p>}
          {queue?.payouts.map(p => (
            <article key={p.order_id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold">{p.shop || 'Vendeur'}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${p.state.startsWith('n° MonCash') ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{p.state}</span>
              </div>
              <p>MonCash {p.moncash || '—'}{p.moncash_name ? ` (${p.moncash_name})` : ''}</p>
              <p className="text-slate-500">Commande {htg(p.total_price)}{p.payout_amount != null ? ` · virement ${htg(p.payout_amount)}` : ''} · {day(p.created_at)}</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'log' && (
        <section className="space-y-2">
          {log.length === 0 && <p className="text-sm text-slate-500">Journal vide.</p>}
          {log.map(l => (
            <p key={l.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {day(l.created_at)} · {l.admin_email || 'admin'} · <b>{l.action === 'refund_paid' ? 'remboursement payé' : 'remboursement refusé'}</b>
              {l.amount != null ? ` · ${htg(l.amount)}` : ''}{l.reference ? ` · réf. ${l.reference}` : ''}{l.note ? ` · ${l.note}` : ''}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
