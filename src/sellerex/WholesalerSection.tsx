import React, { useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';

type Application = { id: string; business_name: string; status: 'pending' | 'approved' | 'rejected'; review_note: string | null; created_at: string };

const STATUS_LABEL: Record<Application['status'], { text: string; cls: string }> = {
  pending: { text: 'En cours de vérification', cls: 'bg-amber-100 text-amber-800' },
  approved: { text: 'Approuvé', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { text: 'Refusé', cls: 'bg-red-100 text-red-700' },
};

const splitList = (s: string) => s.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
const input = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600';

export default function WholesalerSection() {
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<Application | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [f, setF] = useState({
    business_name: '', contact_name: '', phone: '', whatsapp: '', nif: '', categories: '', description: '',
    min_order_qty: '10', min_order_amount_htg: '0', delivery_zones: '', accept_terms: false,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: k === 'accept_terms' ? (e.target as HTMLInputElement).checked : e.target.value }));

  useEffect(() => {
    apiFetchAuthed('/api/sellerex/wholesaler/me').then(r => r.json()).then(j => setApp(j.application || null))
      .catch(() => setErrors(['Impossible de charger votre demande.'])).finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors([]);
    try {
      const r = await apiFetchAuthed('/api/sellerex/wholesaler/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          categories: splitList(f.categories), delivery_zones: splitList(f.delivery_zones),
          min_order_qty: Number(f.min_order_qty), min_order_amount_htg: Number(f.min_order_amount_htg || 0),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErrors(j.details?.length ? j.details : [j.error || 'Envoi impossible.']);
      else { setApp({ id: '', business_name: f.business_name, status: 'pending', review_note: null, created_at: new Date().toISOString() }); setShowForm(false); }
    } catch { setErrors(['Erreur réseau. Réessayez.']); }
    setBusy(false);
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;

  if (app && !showForm) {
    const s = STATUS_LABEL[app.status];
    return (
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold">Ma demande grossiste</h1>
        <p className="text-sm text-slate-600">{app.business_name}</p>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>{s.text}</span>
        {app.review_note && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{app.review_note}</p>}
        {app.status === 'rejected' && <button className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white" onClick={() => setShowForm(true)}>Refaire une demande</button>}
      </section>
    );
  }

  return (
    <section aria-labelledby="who-title">
      <h1 id="who-title" className="text-xl font-bold">Devenir grossiste sur Vendza</h1>
      <p className="mb-4 mt-1 text-sm text-slate-600">Vendez en gros aux vendeurs Vendza avec des quantités minimales. Votre demande est vérifiée par notre équipe avant activation.</p>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium">Nom de l'entreprise<input required className={input} value={f.business_name} onChange={set('business_name')} maxLength={120} /></label>
        <label className="block text-sm font-medium">Nom du contact<input required className={input} value={f.contact_name} onChange={set('contact_name')} maxLength={100} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Téléphone<input required inputMode="tel" className={input} value={f.phone} onChange={set('phone')} placeholder="+509 …" /></label>
          <label className="block text-sm font-medium">WhatsApp (facultatif)<input inputMode="tel" className={input} value={f.whatsapp} onChange={set('whatsapp')} /></label>
        </div>
        <label className="block text-sm font-medium">NIF / patente (facultatif)<input className={input} value={f.nif} onChange={set('nif')} maxLength={40} /></label>
        <label className="block text-sm font-medium">Catégories (séparées par des virgules)<input required className={input} value={f.categories} onChange={set('categories')} placeholder="Mode, Beauté, Accessoires" /></label>
        <label className="block text-sm font-medium">Description de votre activité<textarea required rows={4} className={input} value={f.description} onChange={set('description')} minLength={20} maxLength={1000} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Quantité minimale par commande<input required type="number" min={1} max={100000} className={input} value={f.min_order_qty} onChange={set('min_order_qty')} /></label>
          <label className="block text-sm font-medium">Montant minimal (Gdes)<input type="number" min={0} className={input} value={f.min_order_amount_htg} onChange={set('min_order_amount_htg')} /></label>
        </div>
        <label className="block text-sm font-medium">Zones de livraison (séparées par des virgules)<input required className={input} value={f.delivery_zones} onChange={set('delivery_zones')} placeholder="Ouest, Nord, Artibonite" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.accept_terms} onChange={set('accept_terms')} className="mt-1" />
          <span>J'accepte les <a className="underline text-teal-700" href="https://www.vendza.store/conditions" target="_blank" rel="noopener noreferrer">conditions d'utilisation</a> de Vendza.</span></label>
        {errors.length > 0 && <ul role="alert" className="list-disc rounded-xl bg-red-50 p-3 pl-7 text-sm text-red-700">{errors.map(m => <li key={m}>{m}</li>)}</ul>}
        <button disabled={busy} className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Envoi…' : 'Envoyer ma demande'}</button>
      </form>
    </section>
  );
}
