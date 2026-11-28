import React, { useEffect, useState } from 'react';
import { Copy, Check, Share2, Users, ArrowLeft } from 'lucide-react';
import { apiFetchAuthed } from '../lib/api';

type Row = { id: string; shop: string; status: string; since: string; first_sale_at: string | null; sales: number; earned: number; cancelled: number; pending: number; rate: number; first_period_ends: string | null };
type Data = { code: string; link: string; referrals: Row[]; totals: { earned: number; cancelled: number; paid: number; balance: number; pending: number }; min_payout: number; can_withdraw: boolean; rate_first: number; rate_after: number };

const htg = (n: number) => `${Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString('fr-FR') : (Math.round(n * 100) / 100).toLocaleString('fr-FR')} Gdes`;
const pct = (r: number) => `${Math.round(r * 1000) / 10} %`.replace('.', ',');
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const STATUS: Record<string, string> = { pending: 'Pas encore de vente', active: 'Actif', blocked: 'Arrêté', rejected: 'Refusé' };

export const ReferralView: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    apiFetchAuthed('/api/referral/me').then(async r => { const j = await r.json().catch(() => ({})); if (!live) return; r.ok ? setD(j) : setErr(j.error || 'Impossible de charger vos filleuls pour le moment.'); }).catch(() => live && setErr('Impossible de charger vos filleuls pour le moment.'));
    return () => { live = false; };
  }, []);

  const copy = async () => { if (!d) return; try { await navigator.clipboard.writeText(d.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* le lien reste affiché */ } };
  const share = () => { if (!d) return; const text = `Vends sur Vendza, la marketplace haïtienne avec paiement sécurisé : ${d.link}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 font-sans">
      <button onClick={() => onNavigate('vendor-dashboard')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft size={14} /> Retour</button>
      <div>
        <h1 className="font-serif text-xl font-black text-[#0c1445]">Parrainage</h1>
        <p className="text-xs text-slate-500">Invitez d’autres vendeurs et gagnez une part de la commission que Vendza encaisse sur leurs ventes.</p>
      </div>
      {err && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</p>}
      {!d && !err && <p className="text-sm text-slate-500">Chargement…</p>}
      {d && (<>
        <section className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Votre lien personnel</p>
          <p className="break-all rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800" data-testid="ref-link">{d.link}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white cursor-pointer">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Lien copié' : 'Copier le lien'}</button>
            <button onClick={share} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"><Share2 size={14} /> Partager sur WhatsApp</button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Vous gagnez <b>{pct(d.rate_first)}</b> de la commission réellement encaissée par Vendza sur les ventes de votre filleul pendant <b>6 mois</b> à partir de sa première vente livrée, puis <b>{pct(d.rate_after)}</b> ensuite. Un gain n’est compté qu’une fois la livraison confirmée et l’argent libéré au vendeur ; il est annulé en cas de remboursement.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Stat label="Gains acquis" value={htg(d.totals.earned)} />
          <Stat label="En attente de livraison" value={htg(d.totals.pending)} hint="Estimation" />
          <Stat label="Gains annulés" value={htg(d.totals.cancelled)} />
          <Stat label="Déjà retiré" value={htg(d.totals.paid)} />
        </section>

        <section className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
          <p className="text-sm font-bold text-slate-800">Solde disponible : {htg(d.totals.balance)}</p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden><div className="h-full bg-teal-500" style={{ width: `${Math.min(100, Math.round((d.totals.balance / d.min_payout) * 100))}%` }} /></div>
          {d.can_withdraw
            ? <p className="text-xs text-emerald-700">Vous avez atteint le seuil de {htg(d.min_payout)}. <button onClick={() => onNavigate('about')} className="font-bold underline cursor-pointer">Écrivez-nous</button> pour demander votre retrait par MonCash.</p>
            : <p className="text-xs text-slate-500">Retrait par MonCash à partir de {htg(d.min_payout)}. Il vous manque {htg(Math.max(0, d.min_payout - d.totals.balance))}.</p>}
        </section>

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Users size={15} /> Mes filleuls{d.referrals.length > 0 ? ` (${d.referrals.length})` : ''}</p>
          {d.referrals.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-500">Aucun filleul pour le moment. Partagez votre lien : il apparaîtra ici dès qu’un vendeur s’inscrit avec.</p>}
          {d.referrals.map(r => (
            <article key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-xs shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">{r.shop}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{STATUS[r.status] || r.status}</span>
              </div>
              <p className="mt-1 text-slate-500">Inscrit le {day(r.since)}{r.first_sale_at ? ` · taux actuel ${pct(r.rate)}` : ''}</p>
              {r.first_sale_at && r.rate === d.rate_first && r.first_period_ends && <p className="text-slate-500">{pct(d.rate_first)} jusqu’au {day(r.first_period_ends)}</p>}
              <dl className="mt-2 grid grid-cols-3 gap-2">
                <div><dt className="text-slate-400">Ventes</dt><dd className="font-bold text-slate-800">{r.sales}</dd></div>
                <div><dt className="text-slate-400">Gagné</dt><dd className="font-bold text-slate-800">{htg(r.earned)}</dd></div>
                <div><dt className="text-slate-400">En attente</dt><dd className="font-bold text-slate-800">{htg(r.pending)}</dd></div>
              </dl>
              {r.cancelled > 0 && <p className="mt-1 text-red-600">Annulé : {htg(r.cancelled)}</p>}
            </article>
          ))}
        </section>
      </>)}
    </div>
  );
};

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);
