import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { HAITIAN_ZONES } from '../data';
import { sanitizeFees } from '../lib/shipping';

// Le vendeur fixe lui-même ses frais de livraison : un tarif par défaut + des tarifs par département.
export const ShippingFeesCard: React.FC<{ vendorId: string }> = ({ vendorId }) => {
  const [defaultFee, setDefaultFee] = useState<string>('');
  const [fees, setFees] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured || !supabase) return;
      const { data } = await supabase.from('shops').select('shipping_fee_default, shipping_fees').eq('vendor_id', vendorId).maybeSingle();
      if (data) {
        setDefaultFee(data.shipping_fee_default === null || data.shipping_fee_default === undefined ? '' : String(data.shipping_fee_default));
        const f: Record<string, string> = {};
        Object.entries((data.shipping_fees || {}) as Record<string, number>).forEach(([k, v]) => { f[k] = String(v); });
        setFees(f);
      }
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, [vendorId]);

  const save = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setBusy(true); setMsg(null);
    const def = defaultFee.trim() === '' ? null : Number(defaultFee);
    if (def !== null && (!Number.isFinite(def) || def < 0 || def > 100000)) { setBusy(false); setMsg({ ok: false, text: 'Le tarif par défaut doit être entre 0 et 100 000 Gdes.' }); return; }
    const clean = sanitizeFees(fees);
    const { error } = await supabase.from('shops').update({ shipping_fee_default: def === null ? null : Math.round(def), shipping_fees: clean }).eq('vendor_id', vendorId);
    setBusy(false);
    setMsg(error ? { ok: false, text: 'Enregistrement impossible : ' + error.message } : { ok: true, text: '✅ Frais de livraison enregistrés. Ils s\'appliquent aux prochaines commandes.' });
  };

  if (!loaded) return null;
  const input = 'w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-xs';
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-3xs space-y-3">
      <div className="border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🚚 Mes frais de livraison</h3>
        <p className="text-[10px] text-slate-400">C'est vous qui fixez le prix. Il est ajouté à chaque commande de votre boutique selon la zone du client.</p>
      </div>
      <label className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-700">
        <span>Tarif par défaut (Gdes)<span className="block font-normal text-[10px] text-slate-400">0 = livraison gratuite · vide = tarif standard Vendza</span></span>
        <input inputMode="numeric" className={input} value={defaultFee} placeholder="vide" onChange={e => setDefaultFee(e.target.value.replace(/[^0-9]/g, ''))} />
      </label>
      <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Tarif par département (facultatif)</p>
      <div className="space-y-2">
        {Object.keys(HAITIAN_ZONES).map(d => (
          <label key={d} className="flex items-center justify-between gap-3 text-[11px] text-slate-700">
            <span>{d}</span>
            <input inputMode="numeric" className={input} value={fees[d] ?? ''} placeholder="défaut" onChange={e => setFees(prev => ({ ...prev, [d]: e.target.value.replace(/[^0-9]/g, '') }))} />
          </label>
        ))}
      </div>
      {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
      <button type="button" onClick={save} disabled={busy} className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-60">{busy ? '…' : 'Enregistrer mes frais'}</button>
    </div>
  );
};
