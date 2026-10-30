import React, { useCallback, useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';

type App = {
  id: string; business_name: string; contact_name: string; phone: string; whatsapp: string | null; nif: string | null;
  categories: string[]; description: string; min_order_qty: number; min_order_amount_htg: number; delivery_zones: string[]; created_at: string;
};

export default function AdminSection() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await apiFetchAuthed('/api/sellerex/admin/wholesalers?status=pending');
      if (!r.ok) throw new Error();
      setApps((await r.json()).applications || []);
    } catch { setError('Impossible de charger les demandes.'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id); setError(''); setNotice('');
    try {
      const r = await apiFetchAuthed(`/api/sellerex/admin/wholesalers/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] || '' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.details?.join(' ') || j.error || 'Décision impossible.');
      else { setNotice(decision === 'approved' ? 'Demande approuvée.' : 'Demande refusée.'); await load(); }
    } catch { setError('Erreur réseau. Réessayez.'); }
    setBusyId(null);
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;

  return (
    <section aria-labelledby="adm-title" className="space-y-4">
      <h1 id="adm-title" className="text-xl font-bold">Demandes grossistes en attente ({apps.length})</h1>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {apps.length === 0 && <p className="text-sm text-slate-500">Aucune demande en attente.</p>}
      {apps.map(a => (
        <article key={a.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold">{a.business_name}</h2>
            <span className="shrink-0 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <p>{a.contact_name} · {a.phone}{a.whatsapp ? ` · WhatsApp ${a.whatsapp}` : ''}</p>
          <p className="text-slate-500">NIF / patente : {a.nif || 'non fourni'}</p>
          <p>{a.description}</p>
          <p><b>Catégories :</b> {a.categories.join(', ')}</p>
          <p><b>Zones :</b> {a.delivery_zones.join(', ')}</p>
          <p><b>Minimum :</b> {a.min_order_qty} unités{a.min_order_amount_htg > 0 ? ` · ${a.min_order_amount_htg} Gdes` : ''}</p>
          <textarea rows={2} maxLength={500} placeholder="Note (obligatoire en cas de refus)" value={notes[a.id] || ''}
            onChange={e => setNotes(p => ({ ...p, [a.id]: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600" />
          <div className="flex gap-2">
            <button disabled={busyId === a.id} onClick={() => decide(a.id, 'approved')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Approuver</button>
            <button disabled={busyId === a.id} onClick={() => decide(a.id, 'rejected')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Refuser</button>
          </div>
        </article>
      ))}
    </section>
  );
}
