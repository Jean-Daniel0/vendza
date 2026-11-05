import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import PodSection from './PodSection';
import WholesalerSection from './WholesalerSection';

type Tab = 'pod' | 'wholesaler';
const MAIN_SITE = 'https://www.vendza.store';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await (supabase as any).auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError('E-mail ou mot de passe incorrect.');
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Connexion</h2>
      <p className="text-sm text-slate-500">Utilisez le même compte que sur Vendza. Vous n'avez pas de compte ?{' '}
        <a className="font-semibold text-teal-700 underline" href={`${MAIN_SITE}/creer-un-compte`}>Créer un compte</a>
      </p>
      <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail"
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
      <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe"
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}

export default function SellerexApp() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('pod');

  useEffect(() => {
    document.title = 'Sellerex | Vendza';
    fetch('/api/sellerex/config').then(r => r.json()).then(j => setEnabled(!!j.enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    const auth = (supabase as any).auth;
    auth.getSession().then(({ data }: any) => setSignedIn(!!data?.session));
    const { data: sub } = auth.onAuthStateChange((_e: string, session: any) => setSignedIn(!!session));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const tabBtn = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} aria-pressed={tab === id}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="/" className="text-lg font-extrabold text-teal-800">Sellerex <span className="text-xs font-medium text-slate-400">par Vendza</span></a>
          <div className="flex items-center gap-3 text-sm">
            <a className="text-slate-600 underline" href={MAIN_SITE}>Vendza</a>
            {signedIn && <button className="text-slate-600 underline" onClick={() => (supabase as any).auth.signOut()}>Déconnexion</button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {enabled === null || signedIn === null ? (
          <p className="py-16 text-center text-sm text-slate-500">Chargement…</p>
        ) : !enabled ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-xl font-bold">Sellerex arrive bientôt</h1>
            <p className="mt-2 text-sm text-slate-600">Connectez vos fournisseurs d'impression à la demande et inscrivez-vous comme grossiste sur Vendza.</p>
          </div>
        ) : !signedIn ? (
          <LoginForm />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Sections">
              {tabBtn('pod', 'Fournisseurs POD')}
              {tabBtn('wholesaler', 'Devenir grossiste')}
            </div>
            {tab === 'pod' ? <PodSection /> : <WholesalerSection />}
          </>
        )}
      </main>
    </div>
  );
}
