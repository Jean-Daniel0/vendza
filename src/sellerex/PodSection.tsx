import React, { useCallback, useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';

type Provider = { id: string; slug: string; name: string; description: string | null; auth_type: 'api_key' | 'oauth'; status: 'coming_soon' | 'active' };
type Connection = { id: string; status: string; secret_hint: string | null; provider: { slug: string; name: string } | null };

// Logos des fournisseurs (fichiers du dossier public/images)
const LOGOS: Record<string, string> = { dprinting: '/images/dprinting-logo.jpg' };

export default function PodSection() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, c] = await Promise.all([apiFetchAuthed('/api/sellerex/providers'), apiFetchAuthed('/api/sellerex/connections')]);
      if (!p.ok || !c.ok) throw new Error();
      setProviders((await p.json()).providers || []);
      setConnections((await c.json()).connections || []);
    } catch { setError('Impossible de charger les fournisseurs. Réessayez.'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const connect = async (slug: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await apiFetchAuthed('/api/sellerex/connections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: slug, api_key: apiKey }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'Connexion impossible.'); }
      else { setNotice('Fournisseur connecté.'); setApiKey(''); setOpenSlug(null); await load(); }
    } catch { setError('Erreur réseau. Réessayez.'); }
    setBusy(false);
  };

  const disconnect = async (slug: string) => {
    if (!window.confirm('Déconnecter ce fournisseur ? Votre clé sera supprimée.')) return;
    const r = await apiFetchAuthed(`/api/sellerex/connections/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    if (r.ok) { setNotice('Fournisseur déconnecté.'); load(); } else setError('Déconnexion impossible.');
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Chargement…</p>;

  return (
    <section aria-labelledby="pod-title" className="space-y-4">
      <div>
        <h1 id="pod-title" className="text-xl font-bold">Fournisseurs d'impression à la demande</h1>
        <p className="mt-1 text-sm text-slate-600">Connectez un fournisseur pour vendre des produits personnalisés, fabriqués à la commande, sans stock. Réservé aux vendeurs dont l'identité est vérifiée.</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {providers.length === 0 && <p className="text-sm text-slate-500">Aucun fournisseur pour le moment.</p>}
      {providers.map(p => {
        const conn = connections.find(c => c.provider?.slug === p.slug);
        const ready = p.status === 'active' && p.auth_type === 'api_key';
        return (
          <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                {LOGOS[p.slug]
                  ? <img src={LOGOS[p.slug]} alt={`Logo ${p.name}`} loading="lazy" className="mb-2 h-14 w-auto rounded-lg" />
                  : <h2 className="font-bold">{p.name}</h2>}
                {LOGOS[p.slug] && <h2 className="sr-only">{p.name}</h2>}
                {p.description && <p className="mt-0.5 text-sm text-slate-600">{p.description}</p>}
              </div>
              {conn ? <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Connecté</span>
                : !ready ? <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Bientôt</span> : null}
            </div>

            {conn ? (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Clé {conn.secret_hint || '••••'}</span>
                <button className="font-semibold text-red-600 underline" onClick={() => disconnect(p.slug)}>Déconnecter</button>
              </div>
            ) : ready ? (
              openSlug === p.slug ? (
                <form className="mt-3 space-y-2" onSubmit={(e: React.FormEvent) => { e.preventDefault(); connect(p.slug); }}>
                  <label className="block text-sm font-medium" htmlFor={`key-${p.slug}`}>Clé API de {p.name}</label>
                  <input id={`key-${p.slug}`} type="password" autoComplete="off" required value={apiKey} onChange={e => setApiKey(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
                  <p className="text-xs text-slate-500">Votre clé est chiffrée sur nos serveurs et n'est plus jamais affichée.</p>
                  <div className="flex gap-2">
                    <button disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Vérification…' : 'Connecter'}</button>
                    <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={() => { setOpenSlug(null); setApiKey(''); }}>Annuler</button>
                  </div>
                </form>
              ) : (
                <button className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white" onClick={() => { setOpenSlug(p.slug); setError(''); setNotice(''); }}>Connecter</button>
              )
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
