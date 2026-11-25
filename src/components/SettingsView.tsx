import React, { useCallback, useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { BellRing, ChevronRight, FileText, KeyRound, LogOut, Mail, ShieldCheck, Store, CreditCard, User2, HelpCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { PREF_COLUMNS, PrefKey, PushState, hasPasswordLogin, pushState, readPrefs, validatePasswordChange } from '../lib/accountSettings';

type Props = {
  user: UserProfile;
  onNavigate: (view: string) => void;
  onEditProfile: () => void;
  onPrefsChanged: (patch: Record<string, boolean>) => void;
  onLogout: () => void;
};

const Section: React.FC<{ icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }> = ({ icon, title, hint, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</span>
      <div><h2 className="text-sm font-extrabold text-slate-800">{title}</h2>{hint && <p className="text-[11px] text-slate-400">{hint}</p>}</div>
    </div>
    {children}
  </section>
);

const Switch: React.FC<{ checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }> = ({ checked, disabled, label, onChange }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors disabled:opacity-50 ${checked ? 'bg-teal-600' : 'bg-slate-300'}`}>
    <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const LinkRow: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">
    <span className="text-slate-400">{icon}</span><span className="flex-1">{label}</span><ChevronRight size={14} className="text-slate-300" />
  </button>
);

export const SettingsView: React.FC<Props> = ({ user, onNavigate, onEditProfile, onPrefsChanged, onLogout }) => {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [push, setPush] = useState<PushState>(() => pushState(typeof Notification !== 'undefined' ? Notification.permission : undefined));
  const [pushBusy, setPushBusy] = useState(false);
  const [canPassword, setCanPassword] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState({ cur: '', next: '', conf: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Valeurs réelles depuis la base (jamais une valeur supposée)
  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setLoadError(true); return; }
    const { data, error } = await supabase.from('profiles').select('newsletter, notif_commandes').eq('id', user.id).maybeSingle();
    if (error) { setLoadError(true); return; }
    setLoadError(false); setPrefs(readPrefs(data));
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await (supabase as any).auth.getUser();
        const u = data?.user;
        setCanPassword(hasPasswordLogin(u?.identities, u?.app_metadata?.provider));
      } catch { setCanPassword(false); }
    })();
  }, []);

  const toggle = async (key: PrefKey, value: boolean) => {
    if (!prefs || !supabase) return;
    const column = PREF_COLUMNS[key];
    const before = prefs[key];
    setNotice(null); setSaving(key); setPrefs({ ...prefs, [key]: value }); // affichage immédiat, annulé si la base refuse
    const { error } = await supabase.from('profiles').update({ [column]: value, updated_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(null);
    if (error) { setPrefs(p => (p ? { ...p, [key]: before } : p)); setNotice({ type: 'error', text: 'Enregistrement impossible. Réessayez dans un instant.' }); return; }
    onPrefsChanged({ [column === 'newsletter' ? 'newsletter' : 'notifCommandes']: value });
    setNotice({ type: 'ok', text: 'Préférence enregistrée.' });
  };

  const enablePush = async () => {
    setPushBusy(true);
    try { await OneSignal.Notifications.requestPermission(); } catch { /* le navigateur peut refuser */ }
    setPush(pushState(typeof Notification !== 'undefined' ? Notification.permission : undefined));
    setPushBusy(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwdMsg(null);
    const check = validatePasswordChange(pwd.cur, pwd.next, pwd.conf);
    if (check.ok === false) { setPwdMsg({ type: 'error', text: check.error }); return; }
    if (!supabase || !user.email) { setPwdMsg({ type: 'error', text: 'Changement impossible pour le moment.' }); return; }
    setPwdBusy(true);
    try {
      const auth = (supabase as any).auth;
      // On vérifie l'ancien mot de passe avant de le remplacer
      const { error: bad } = await auth.signInWithPassword({ email: user.email, password: pwd.cur });
      if (bad) { setPwdMsg({ type: 'error', text: 'Mot de passe actuel incorrect.' }); return; }
      const { error } = await auth.updateUser({ password: pwd.next });
      if (error) { setPwdMsg({ type: 'error', text: 'Le nouveau mot de passe a été refusé. Choisissez-en un plus solide.' }); return; }
      setPwd({ cur: '', next: '', conf: '' });
      setPwdMsg({ type: 'ok', text: 'Mot de passe modifié.' });
    } catch { setPwdMsg({ type: 'error', text: 'Changement impossible pour le moment.' }); }
    finally { setPwdBusy(false); }
  };

  const vendor = user.userType === 'vendeur';
  const inputCls = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-3 py-5">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">Paramètres</h1>
        <p className="text-xs text-slate-500">Compte, notifications, e-mails et sécurité, au même endroit.</p>
      </header>

      <Section icon={<User2 size={16} />} title="Mon compte" hint={user.email}>
        <p className="mb-1 px-2 text-xs text-slate-600">{user.prenom} {user.nom} · {vendor ? 'Vendeur' : 'Client'}{vendor && user.plan ? ` · Forfait ${user.plan}` : ''}</p>
        <LinkRow icon={<User2 size={15} />} label="Modifier mon profil" onClick={onEditProfile} />
        {vendor && <LinkRow icon={<Store size={15} />} label="Boutique et profil vendeur" onClick={() => onNavigate('shop-settings')} />}
        {vendor && <LinkRow icon={<CreditCard size={15} />} label="Abonnement et forfaits" onClick={() => onNavigate('subscription')} />}
      </Section>

      <Section icon={<Mail size={16} />} title="Promotions et e-mails" hint="Votre accord, modifiable à tout moment">
        {loadError ? (
          <p role="alert" className="text-xs text-red-700">Impossible de charger vos préférences. <button className="underline" onClick={load}>Réessayer</button></p>
        ) : !prefs ? <p className="text-xs text-slate-400">Chargement…</p> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Promotions, ventes flash et offres Vendza</p>
                <p className="text-[11px] text-slate-500">Ventes flash, suggestions et offres, par notification et par e-mail. Chaque e-mail contient un lien de désinscription.</p>
              </div>
              <Switch checked={prefs.promotions} disabled={saving === 'promotions'} label="Promotions, ventes flash et offres" onChange={v => toggle('promotions', v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Rappels de panier et alertes de stock</p>
                <p className="text-[11px] text-slate-500">Un rappel si votre panier vous attend, une alerte si un article va être épuisé.</p>
              </div>
              <Switch checked={prefs.cart} disabled={saving === 'cart'} label="Rappels de panier et alertes de stock" onChange={v => toggle('cart', v)} />
            </div>
            <p className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-500">Les messages sur vos commandes (paiement, livraison, virement) restent toujours actifs : ils protègent votre achat ou votre vente.</p>
            {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`text-xs ${notice.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{notice.text}</p>}
          </div>
        )}
      </Section>

      <Section icon={<BellRing size={16} />} title="Notifications sur cet appareil" hint="Ce réglage dépend de votre navigateur">
        {push === 'granted' && <p className="text-xs text-emerald-700">Activées sur cet appareil.</p>}
        {push === 'default' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">Pas encore activées sur cet appareil.</p>
            <button disabled={pushBusy} onClick={enablePush} className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{pushBusy ? '…' : 'Activer'}</button>
          </div>
        )}
        {push === 'denied' && <p className="text-xs text-amber-700">Bloquées dans votre navigateur. Pour les recevoir, autorisez les notifications pour Vendza dans les réglages du site, puis rechargez la page.</p>}
        {push === 'unsupported' && <p className="text-xs text-slate-500">Ce navigateur ne permet pas les notifications.</p>}
      </Section>

      <Section icon={<KeyRound size={16} />} title="Sécurité" hint="Mot de passe">
        {canPassword === null ? <p className="text-xs text-slate-400">Chargement…</p>
          : canPassword === false ? <p className="text-xs text-slate-500">Votre compte se connecte avec Google : il n'y a pas de mot de passe Vendza à changer ici.</p>
          : (
            <form onSubmit={changePassword} className="space-y-2">
              <input type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={pwd.cur} onChange={e => setPwd(p => ({ ...p, cur: e.target.value }))} className={inputCls} />
              <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} className={inputCls} />
              <input type="password" autoComplete="new-password" placeholder="Confirmer le nouveau mot de passe" value={pwd.conf} onChange={e => setPwd(p => ({ ...p, conf: e.target.value }))} className={inputCls} />
              {pwdMsg && <p role={pwdMsg.type === 'error' ? 'alert' : 'status'} className={`text-xs ${pwdMsg.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{pwdMsg.text}</p>}
              <button disabled={pwdBusy} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{pwdBusy ? '…' : 'Changer le mot de passe'}</button>
            </form>
          )}
      </Section>

      <Section icon={<FileText size={16} />} title="Informations légales">
        <LinkRow icon={<FileText size={15} />} label="Conditions d'utilisation" onClick={() => onNavigate('terms')} />
        <LinkRow icon={<ShieldCheck size={15} />} label="Politique de confidentialité" onClick={() => onNavigate('privacy')} />
        <LinkRow icon={<HelpCircle size={15} />} label="À propos de Vendza" onClick={() => onNavigate('about')} />
      </Section>

      <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-xs font-bold text-red-600">
        <LogOut size={14} /> Déconnexion
      </button>
    </div>
  );
};

export default SettingsView;
