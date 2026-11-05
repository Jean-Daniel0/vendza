import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiFetchAuthed } from '../lib/api';
import { LogoLoader } from '../components/LogoLoader';

const PaymentsPage = lazy(() => import('../components/AdminPaymentsPage'));
const WholesalersSection = lazy(() => import('../sellerex/AdminSection'));

const IDLE_MS = 30 * 60 * 1000; // déconnexion après 30 minutes sans activité
type Gate = 'boot' | 'login' | 'checking' | 'denied' | 'enroll' | 'challenge' | 'ready';
type Tab = 'overview' | 'payments' | 'identities' | 'disputes' | 'wholesalers' | 'audit';
const auth = () => (supabase as any).auth;
const htg = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} HTG`;
const when = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const Loading = () => <div className="flex justify-center py-12"><LogoLoader size={72} /></div>;
const Card: React.FC<{ title: string; value: React.ReactNode; tone?: 'warn' }> = ({ title, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

async function getJson(url: string, init?: RequestInit) {
  const r = await apiFetchAuthed(url, init);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

function LoginForm({ onDone, error }: { onDone: () => void; error?: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(error || '');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error: err } = await auth().signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setMsg('Identifiants incorrects.'); else onDone();
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-bold">Espace sécurisé</h1>
      <input type="email" required autoComplete="username" placeholder="Adresse e-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      <input type="password" required autoComplete="current-password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? '…' : 'Se connecter'}</button>
    </form>
  );
}

function CodeStep({ mode, onDone, onCancel }: { mode: 'enroll' | 'challenge'; onDone: () => void; onCancel: () => void }) {
  const [factorId, setFactorId] = useState(''); const [qr, setQr] = useState(''); const [secret, setSecret] = useState('');
  const [code, setCode] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await auth().mfa.listFactors();
        const all: any[] = data?.all || [];
        if (mode === 'challenge') {
          const f = (data?.totp || [])[0]; if (!f) { setMsg('Aucun appareil enregistré.'); return; }
          setFactorId(f.id);
        } else {
          for (const f of all.filter(x => x.status === 'unverified')) { try { await auth().mfa.unenroll({ factorId: f.id }); } catch {} }
          const { data: en, error } = await auth().mfa.enroll({ factorType: 'totp', friendlyName: `Admin ${Date.now()}` });
          if (error || !en) { setMsg('Activation indisponible pour le moment.'); return; }
          setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret);
        }
        setReady(true);
      } catch { setMsg('Service de vérification indisponible.'); }
    })();
  }, [mode]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await auth().mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) { setMsg('Code incorrect ou expiré.'); setCode(''); } else onDone();
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-bold">{mode === 'enroll' ? 'Activer la double authentification' : 'Code de vérification'}</h1>
      {mode === 'enroll' ? (
        <>
          <p className="text-sm text-slate-600">Scannez ce code avec une application d’authentification (Google Authenticator, Authy, 1Password…), puis saisissez le code à 6 chiffres.</p>
          {qr ? <img src={qr} alt="Code à scanner" className="mx-auto h-44 w-44" /> : !msg && <Loading />}
          {secret && <p className="break-all text-center text-[11px] text-slate-500">Clé manuelle : {secret}</p>}
        </>
      ) : <p className="text-sm text-slate-600">Saisissez le code à 6 chiffres de votre application d’authentification.</p>}
      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required placeholder="000000" value={code} onChange={e => setCode(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-center text-lg tracking-widest" />
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
      <button disabled={busy || !ready} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? '…' : 'Valider'}</button>
      <button type="button" onClick={onCancel} className="w-full text-xs text-slate-500 underline">Se déconnecter</button>
    </form>
  );
}

function Overview() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { getJson('/api/admin/overview').then(r => r.ok ? setD(r.j) : setErr('Impossible de charger le résumé.')); }, []);
  if (err) return <p role="alert" className="text-sm text-red-700">{err}</p>;
  if (!d) return <Loading />;
  const st = d.orders.byStatus as Record<string, number>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card title="Ventes payées (30 jours)" value={htg(d.orders.sales30)} />
        <Card title="Commandes (30 jours)" value={d.orders.count30} />
        <Card title="Utilisateurs (total)" value={d.users} />
        <Card title="Clients" value={d.clients} />
        <Card title="Vendeurs" value={d.vendors} />
        <Card title="Boutiques" value={d.shops} />
        <Card title="Litiges ouverts" value={d.open_disputes} tone={d.open_disputes ? 'warn' : undefined} />
        <Card title="Identités à vérifier" value={d.pending_identities} tone={d.pending_identities ? 'warn' : undefined} />
      </div>
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Utilisateurs = clients + vendeurs ({d.clients} + {d.vendors} = {d.clients + d.vendors}{d.users !== d.clients + d.vendors ? `, soit ${d.users - d.clients - d.vendors} autre(s) type(s)` : ''}). Les boutiques sont comptées séparément : une boutique est rattachée à un compte{d.shops_by_non_vendor ? `, et ${d.shops_by_non_vendor} boutique${d.shops_by_non_vendor > 1 ? 's sont tenues' : ' est tenue'} par un compte de type « client »` : ''}, d’où l’écart possible entre vendeurs et boutiques.
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p className="mb-2 font-bold">Commandes par statut</p>
        <ul className="grid grid-cols-2 gap-1 text-slate-600">{Object.entries(st).map(([k, v]) => <li key={k}>{k} : <b>{v}</b></li>)}</ul>
        {d.truncated && <p className="mt-2 text-xs text-slate-400">Calcul sur les 5 000 commandes les plus récentes.</p>}
      </div>
    </div>
  );
}

function Identities() {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [busy, setBusy] = useState<string | null>(null); const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => { const r = await getJson('/api/admin/identities'); if (r.ok) setRows(r.j.identities || []); else setErr('Impossible de charger la liste.'); }, []);
  useEffect(() => { load(); }, [load]);
  const open = async (id: string) => {
    setBusy(id); setErr('');
    const r = await getJson(`/api/admin/identities/${id}/document-link`, { method: 'POST' });
    setBusy(null);
    if (r.ok) window.open(r.j.url, '_blank', 'noopener,noreferrer'); else setErr(r.j.error || 'Ouverture impossible.');
  };
  const decide = async (id: string, decision: 'verifie' | 'non_verifie') => {
    if (!window.confirm(decision === 'verifie' ? 'Valider cette boutique ?' : 'Refuser cette vérification ?')) return;
    setBusy(id); setErr(''); setOk('');
    const r = await getJson(`/api/admin/identities/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note: notes[id] || '' }) });
    setBusy(null);
    if (r.ok) { setOk(decision === 'verifie' ? 'Boutique vérifiée.' : 'Vérification refusée.'); load(); } else setErr(r.j.error || 'Décision impossible.');
  };
  if (!rows && !err) return <Loading />;
  return (
    <div className="space-y-3">
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">Aucune vérification en attente.</p>}
      {(rows || []).map(r => (
        <article key={r.vendor_id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex justify-between gap-2"><h2 className="font-bold">{r.shop_name || 'Boutique'}</h2><span className="text-xs text-slate-400">{when(r.created_at)}</span></div>
          <p className="text-slate-600">Pièce : {r.id_type || 'non précisée'} · N° {r.id_number || '—'} · Forfait {r.plan || 'gratuit'}</p>
          <p className="text-xs text-slate-500">Le lien vers la pièce expire après 60 secondes et chaque ouverture est journalisée.</p>
          <textarea rows={2} maxLength={300} placeholder="Note (facultative)" value={notes[r.vendor_id] || ''} onChange={e => setNotes(p => ({ ...p, [r.vendor_id]: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy === r.vendor_id || !r.has_document} onClick={() => open(r.vendor_id)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Voir la pièce</button>
            <button disabled={busy === r.vendor_id} onClick={() => decide(r.vendor_id, 'verifie')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Valider</button>
            <button disabled={busy === r.vendor_id} onClick={() => decide(r.vendor_id, 'non_verifie')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Refuser</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Disputes() {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { getJson('/api/admin/disputes?status=open').then(r => r.ok ? setRows(r.j.disputes || []) : setErr('Impossible de charger les litiges.')); }, []);
  if (err) return <p role="alert" className="text-sm text-red-700">{err}</p>;
  if (!rows) return <Loading />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Lecture seule : les fonds restent gelés en séquestre tant que le litige n’est pas tranché.</p>
      {rows.length === 0 && <p className="text-sm text-slate-500">Aucun litige ouvert.</p>}
      {rows.map(d => (
        <article key={d.id} className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex justify-between gap-2"><h2 className="font-bold">{d.order?.product_name || 'Commande'} · {d.order ? htg(Number(d.order.total_price) || 0) : ''}</h2><span className="text-xs text-slate-400">{when(d.created_at)}</span></div>
          <p>{d.reason}</p>
          <p className="text-xs text-slate-500">Client : {d.order?.client_name || '—'} · Boutique : {d.order?.vendor_name || '—'} · Paiement : {d.order?.payment_method || '—'}</p>
          <p className="break-all text-[11px] text-slate-400">Commande {d.order_id}</p>
        </article>
      ))}
    </div>
  );
}

function AuditLog() {
  const [rows, setRows] = useState<any[] | null>(null); const [na, setNa] = useState(false);
  useEffect(() => { getJson('/api/admin/audit').then(r => { setRows(r.j.log || []); setNa(!!r.j.unavailable); }); }, []);
  if (!rows) return <Loading />;
  if (na) return <p className="text-sm text-slate-500">Journal non activé : exécutez la migration <code>20261105_admin_audit_log.sql</code>.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Action</th><th className="p-2">Chemin</th><th className="p-2">IP</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map(r => <tr key={r.id}><td className="p-2 whitespace-nowrap">{when(r.created_at)}</td><td className="p-2">{r.action}{r.detail ? ` · ${r.detail}` : ''}</td><td className="p-2 break-all">{r.method} {r.path} {r.status}</td><td className="p-2">{r.ip}</td></tr>)}</tbody></table>
      {rows.length === 0 && <p className="p-3 text-sm text-slate-500">Journal vide.</p>}
    </div>
  );
}

export default function AdminApp() {
  const [gate, setGate] = useState<Gate>('boot');
  const [tab, setTab] = useState<Tab>('overview');
  const [email, setEmail] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.title = 'Espace sécurisé';
    let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!m) { m = document.createElement('meta'); m.name = 'robots'; document.head.appendChild(m); }
    m.content = 'noindex, nofollow, noarchive';
  }, []);

  const signOut = useCallback(async () => { try { await auth().signOut(); } catch {} setGate('login'); }, []);

  const check = useCallback(async () => {
    setGate('checking');
    const r = await getJson('/api/admin/session');
    if (r.status === 404 || (!r.ok && !r.j?.mfa)) { setGate('denied'); return; }
    setEmail(r.j.email || '');
    if (r.j.state === 'ok') { setGate('ready'); return; }
    try {
      const { data } = await auth().mfa.listFactors();
      setGate((data?.totp || []).length ? 'challenge' : 'enroll');
    } catch { setGate('denied'); }
  }, []);

  useEffect(() => {
    auth().getSession().then(({ data }: any) => { if (data?.session) check(); else setGate('login'); }).catch(() => setGate('login'));
  }, [check]);

  // Déconnexion automatique après inactivité
  useEffect(() => {
    if (gate !== 'ready') return;
    const reset = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(signOut, IDLE_MS); };
    const evts = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    evts.forEach(e => window.addEventListener(e, reset, { passive: true })); reset();
    return () => { evts.forEach(e => window.removeEventListener(e, reset)); window.clearTimeout(timer.current); };
  }, [gate, signOut]);

  const tabs: Array<[Tab, string]> = [['overview', 'Accueil'], ['payments', 'Paiements'], ['identities', 'Identités'], ['disputes', 'Litiges'], ['wholesalers', 'Grossistes Sellerex'], ['audit', 'Journal']];

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-10 text-slate-900">
      {gate === 'boot' || gate === 'checking' ? <Loading />
        : gate === 'login' ? <LoginForm onDone={check} />
        : gate === 'denied' ? (
          <div className="mx-auto mt-16 max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm">
            <p>Accès refusé.</p><button onClick={signOut} className="text-xs text-slate-500 underline">Se déconnecter</button>
          </div>)
        : gate === 'enroll' || gate === 'challenge' ? <CodeStep mode={gate} onDone={check} onCancel={signOut} />
        : (
          <div className="mx-auto max-w-4xl">
            <header className="flex items-center justify-between py-4">
              <h1 className="text-lg font-extrabold">Administration</h1>
              <div className="flex items-center gap-3 text-xs text-slate-500"><span className="hidden sm:inline">{email}</span><button onClick={signOut} className="underline">Déconnexion</button></div>
            </header>
            <nav className="mb-5 flex flex-wrap gap-2" aria-label="Sections">
              {tabs.map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{label}</button>
              ))}
            </nav>
            <Suspense fallback={<Loading />}>
              {tab === 'overview' ? <Overview /> : tab === 'payments' ? <PaymentsPage /> : tab === 'identities' ? <Identities />
                : tab === 'disputes' ? <Disputes /> : tab === 'wholesalers' ? <WholesalersSection /> : <AuditLog />}
            </Suspense>
          </div>)}
    </div>
  );
}
