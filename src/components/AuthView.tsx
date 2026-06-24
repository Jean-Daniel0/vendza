import React, { useState } from 'react';
import { LogIn, UserPlus, Key, Eye, EyeOff, Check, Flame, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { HAITIAN_ZONES } from '../data';
import { TermsPage } from './TermsPage';
import { PrivacyPage } from './PrivacyPage';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthViewProps {
  onLogin: (user: UserProfile) => void;
  onNavigate: (view: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onLogin,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Custom non-blocking visual feedback state (safely bypassing browser sandbox modal blocks)
  const [notification, setNotification] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning' | 'info';
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const showNotice = (
    text: string, 
    type: 'success' | 'error' | 'warning' | 'info' = 'info', 
    action?: { label: string; onClick: () => void }
  ) => {
    setNotification({ text, type, action });
    setIsLoading(false);
  };

  const clearNotice = () => {
    setNotification(null);
  };

  const handleTabChange = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    setNotification(null);
  };

  // Login fields
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginType, setLoginType] = useState<'client' | 'vendeur'>('client');

  // Sign up fields
  const [signupType, setSignupType] = useState<'client' | 'vendeur'>('client');
  const [prenom, setPrenom] = useState<string>('');
  const [nom, setNom] = useState<string>('');
  const [tel, setTel] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [dept, setDept] = useState<string>('Ouest');
  const [commune, setCommune] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  // Acceptance parameters & interactive views
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);
  const [termsModalOpen, setTermsModalOpen] = useState<boolean>(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState<boolean>(false);

  // Password strength logic
  const getPasswordStrength = () => {
    if (!password) return { label: 'Vide', percent: 0, color: 'bg-slate-200' };
    if (password.length < 5) return { label: 'Faible', percent: 30, color: 'bg-red-500' };
    if (password.length < 8) return { label: 'Moyen', percent: 65, color: 'bg-amber-500' };
    return { label: 'Fort', percent: 100, color: 'bg-emerald-500' };
  };

  const pwdStrength = getPasswordStrength();

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      const errMsg = "❌ Le serveur Supabase n'est pas configuré. Veuillez définir les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";
      console.error("[Vendza Supabase Config Error]", errMsg);
      showNotice(errMsg, 'error');
      return;
    }
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        console.error("[Vendza Google Sign-In Error]", error);
        showNotice("Erreur de connexion Google: " + error.message, 'error');
      }
    } catch (err: any) {
      console.error("[Vendza Google Sign-In Exception]", err);
      showNotice("Erreur lors de la connexion Google: " + err.message, 'error');
    }
  };

  const adaptiveInsert = async (table: string, payload: any) => {
    if (!supabase) return { ok: false };
    const body = { ...payload };
    let lastError: any = null;
    for (let k = 0; k < 15; k += 1) {
      try {
        const { error } = await supabase.from(table).insert([body]);
        if (!error) return { ok: true };
        lastError = error;
        const msgText = String(error.message || '');
        if (error.code === '42P01' || (msgText.includes('relation') && msgText.includes('does not exist'))) {
          break;
        }
        const miss = msgText.match(/Could not find the '([^']+)' column/i) || msgText.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
        if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
          delete body[miss[1]];
          continue;
        }
        break;
      } catch (err) {
        return { ok: false, error: err };
      }
    }
    return { ok: false, error: lastError };
  };

  const adaptiveUpdate = async (table: string, payload: any, matchId: string) => {
    if (!supabase) return { ok: false };
    const body = { ...payload };
    let lastError: any = null;
    for (let k = 0; k < 15; k += 1) {
      try {
        const { error } = await supabase.from(table).update(body).eq('id', matchId);
        if (!error) return { ok: true };
        lastError = error;
        const msgText = String(error.message || '');
        if (error.code === '42P01' || (msgText.includes('relation') && msgText.includes('does not exist'))) {
          break;
        }
        const miss = msgText.match(/Could not find the '([^']+)' column/i) || msgText.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
        if (miss && miss[1] && Object.prototype.hasOwnProperty.call(body, miss[1])) {
          delete body[miss[1]];
          continue;
        }
        break;
      } catch (err) {
        return { ok: false, error: err };
      }
    }
    return { ok: false, error: lastError };
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    clearNotice();

    if (!isSupabaseConfigured || !supabase) {
      const errMsg = "❌ Supabase n'est pas configuré. Veuillez définir les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";
      console.error("[Vendza Supabase Config Error]", errMsg);
      showNotice(errMsg, 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Step 3.1 — Connecter l'utilisateur
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (error) {
        console.error("[Vendza Supabase Auth Error]", error);
        showNotice(`Erreur de connexion : ${error.message}`, 'error');
        return;
      }
      
      if (authData && authData.user) {
        // Step 3.2 — Récupérer le profil complet
        let { data: profil, error: profileError } = await supabase
          .from('profiles')
          .select('*, shops(*)')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          console.error("[Vendza Supabase Profile Error]", profileError);
        }

        // Step 3.3 — Si profil est null → le créer automatiquement
        if (profileError || !profil) {
          console.warn("Profil introuvable, création automatique...");
          const { error: insertError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            email: authData.user.email,
            type: 'client',
            plan: 'gratuit',
            statut_verification: 'non_verifie',
            created_at: new Date()
          });

          if (insertError) {
            console.error("[Vendza Supabase Profile Insert Error]", insertError);
          } else {
            // Re-fetch to load default/new structure completely
            const { data: newProfil } = await supabase
              .from('profiles')
              .select('*, shops(*)')
              .eq('id', authData.user.id)
              .single();
            if (newProfil) {
              profil = newProfil;
            }
          }
        }

        const profile = profil;
        let loggedUser: UserProfile;

        if (profile) {
          const firstName = profile.prenom || profile.first_name || profile.name || profile.full_name?.split(' ')[0] || '';
          const lastName = profile.nom || profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || '';
          
          let finalUserType = (profile.type || profile.user_type || 'client') as 'client' | 'vendeur';
          let finalShopName = profile.boutique_nom || profile.shop_name || profile.boutique || profile.name || undefined;

          if (loginType === 'vendeur' && finalUserType !== 'vendeur') {
            finalUserType = 'vendeur';
            finalShopName = finalShopName || `Boutique de ${firstName}`;
            const updatePayload = {
              user_type: 'vendeur',
              type: 'vendeur',
              shop_name: finalShopName,
              boutique: finalShopName,
              boutique_nom: finalShopName
            };
            await adaptiveUpdate('profiles', updatePayload, profile.id || authData.user.id);
          }

          const avatarVal = profile.avatar_url || profile.avatar || profile.photo_url || profile.profile_image || undefined;
          const bannerVal = profile.banner || profile.cover_url || profile.cover_image || profile.banner_url || undefined;

          // Safe plan deserializer / normalization (for 'gratuit', 'pro_local', 'pro_national')
          const rawPlanVal = profile.plan || 'Gratuit';
          let normalizedPlan: 'Gratuit' | 'Pro Local' | 'Pro National' = 'Gratuit';
          const cleanPlan = String(rawPlanVal).toLowerCase().replace(/_/g, ' ');
          if (cleanPlan === 'pro local') {
            normalizedPlan = 'Pro Local';
          } else if (cleanPlan === 'pro national') {
            normalizedPlan = 'Pro National';
          }

          const rawStatut = profile.statut_verification || 'non_verifie';
          let normalizedStatut: 'non_verifie' | 'en_verification' | 'verifie' = 'non_verifie';
          const cleanStatut = String(rawStatut).toLowerCase();
          if (cleanStatut === 'en_verification') {
            normalizedStatut = 'en_verification';
          } else if (cleanStatut === 'verifie') {
            normalizedStatut = 'verifie';
          }

          loggedUser = {
            id: profile.id || authData.user.id,
            prenom: firstName,
            nom: lastName,
            email: profile.email || authData.user.email || '',
            tel: profile.telephone || profile.tel || profile.phone_number || profile.phone || '',
            departement: profile.departement || 'Ouest',
            commune: profile.commune || '',
            shopName: finalShopName,
            shopDesc: profile.boutique_desc || profile.shop_desc || profile.shop_description || undefined,
            avatar: avatarVal,
            banner: bannerVal,
            userType: finalUserType,
            plan: normalizedPlan,
            premiumDepts: profile.premium_depts || [],
            statutVerification: normalizedStatut,
            revenusBloques: Number(profile.revenus_bloques || 0)
          };
        } else {
          // Profile fallback
          const emailValue = authData.user.email || '';
          const parts = emailValue.split('@')[0].split('.');
          const prenomText = parts[0] ? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1)) : 'Acheteur';
          const nomText = parts[1] ? (parts[1].charAt(0).toUpperCase() + parts[1].slice(1)) : 'Vendza';
          
          const shopNameVal = loginType === 'vendeur' ? `Boutique de ${prenomText}` : undefined;

          const autoPayload: any = {
            id: authData.user.id,
            prenom: prenomText,
            first_name: prenomText,
            nom: nomText,
            last_name: nomText,
            full_name: `${prenomText} ${nomText}`.trim(),
            email: emailValue,
            user_type: loginType, // Respect the selected loginType from the form tab!
            type: loginType,
            plan: 'gratuit',
            departement: 'Ouest',
            commune: 'Pétion-Ville',
            shop_name: shopNameVal || null,
            boutique: shopNameVal || null,
            boutique_nom: shopNameVal || null
          };

          const insertRes = await adaptiveInsert('profiles', autoPayload);
          if (insertRes.error) {
            console.error("[Vendza Supabase Profile Autocreate Error]", insertRes.error);
          }

          loggedUser = {
            id: authData.user.id,
            prenom: prenomText,
            nom: nomText,
            email: emailValue,
            tel: '',
            departement: 'Ouest',
            commune: 'Pétion-Ville',
            shopName: shopNameVal,
            userType: loginType,
            plan: 'Gratuit',
            premiumDepts: []
          };
        }

        // Step 3.5 — Stocker le profil dans le state global
        onLogin(loggedUser);

        // Step 3.4 — Redirection selon le type
        if (loggedUser.userType === 'vendeur') {
          window.history.pushState({}, '', '/vendeur/tableau-de-bord-vendeur');
          onNavigate('vendor-dashboard');
        } else {
          window.history.pushState({}, '', '/client/tableau-de-bord-client');
          onNavigate('client-dashboard');
        }
      }
    } catch (err: any) {
      console.error("[Vendza Supabase Login Exception]", err);
      showNotice(`Erreur inattendue : ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotice();
    if (!prenom || !nom || !email || !password || !commune) {
      showNotice("Veuillez renseigner tous les champs obligatoires (Prenom, Nom, Email, Mot de passe, Commune).", 'warning');
      return;
    }

    if (!acceptTerms) {
      showNotice("Veuillez accepter la Politique de Confidentialité et les Conditions d'Utilisation pour continuer.", 'warning');
      return;
    }

    if (password.length < 6) {
      showNotice("Le mot de passe est trop court. Il doit contenir au moins 6 caractères.", 'warning');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      const errMsg = "❌ Supabase n'est pas configuré. Veuillez définir les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";
      console.error("[Vendza Supabase Config Error]", errMsg);
      showNotice(errMsg, 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Step 2.2 — Créer le compte auth Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { prenom, nom, type: signupType }
        }
      });

      // Step 2.5 — Gérer les erreurs de création de compte auth (Mot de passe court, Email utilisé)
      if (authError) {
        console.error("[Vendza Supabase Auth SignUp Error]", authError);
        let errorMsg = `Erreur d'inscription : ${authError.message}`;
        if (authError.message.toLowerCase().includes('already registered') || authError.status === 422) {
          errorMsg = "❌ Cet email est déjà utilisé. Veuillez vous connecter ou utiliser un autre email.";
        }
        showNotice(errorMsg, 'error');
        return;
      }

      if (authData && authData.user) {
        // Step 2.3 — Créer le profil dans profiles
        const shopNameVal = signupType === 'vendeur' ? (shopName || `Boutique de ${prenom}`) : null;
        
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          prenom,
          nom,
          email,
          telephone: tel || '',
          type: signupType,        // 'client' ou 'vendeur'
          departement: dept,
          commune,
          plan: 'gratuit',
          statut_verification: 'non_verifie',
          created_at: new Date()
        });

        // Step 2.5 — Gérer les erreurs (Profil déjà existant ou autres)
        if (profileError) {
          console.error("[Vendza Supabase Profile SignUp Error]", profileError);
          const isConflict = profileError.code === '23505' || profileError.message?.toLowerCase().includes('duplicate') || profileError.message?.toLowerCase().includes('already exists');
          if (isConflict) {
            console.log("Profil déjà existant (ON CONFLICT DO NOTHING).");
          } else {
            showNotice(`Erreur lors de la création de votre profil : ${profileError.message}`, 'error');
            return;
          }
        }

        // Optional: Create initial user storage welcome file but catch any errors gracefully
        try {
          const bucketName = 'images';
          const welcomeFileName = `users/${authData.user.id}/welcome.json`;
          const initObj = {
            user_id: authData.user.id,
            prenom,
            nom,
            role: signupType,
            message: `Dossier de stockage initialise avec succes pour ${prenom} ${nom}. Tous vos fichiers d'images de produits, d'avatars et de d'identite seront recus ici.`,
            created_at: new Date().toISOString()
          };
          const blob = new Blob([JSON.stringify(initObj, null, 2)], { type: 'application/json' });
          
          let uploadRes = await supabase.storage.from(bucketName).upload(welcomeFileName, blob, {
            contentType: 'application/json',
            upsert: true
          });
          
          if (uploadRes.error && (uploadRes.error.message?.toLowerCase().includes('not found') || uploadRes.error.message?.toLowerCase().includes('bucket'))) {
            try {
              await supabase.storage.createBucket(bucketName, { public: true });
              await supabase.storage.from(bucketName).upload(welcomeFileName, blob, {
                contentType: 'application/json',
                upsert: true
              });
            } catch (errBucket) {
              console.warn("Failed to auto-create bucket on signup:", errBucket);
            }
          }
        } catch (storageErr: any) {
          console.warn("Could not create initial user storage welcome file:", storageErr);
        }

        const loggedUser: UserProfile = {
          id: authData.user.id,
          prenom,
          nom,
          email,
          tel: tel || '',
          departement: dept,
          commune,
          shopName: shopNameVal || undefined,
          userType: signupType,
          plan: 'Gratuit',
          premiumDepts: [],
          statutVerification: 'non_verifie',
          revenusBloques: 0
        };

        // Force instant login
        onLogin(loggedUser);

        // Step 2.4 — Si type === 'vendeur' → rediriger vers /vendeur/onboarding
        //            Si type === 'client' → rediriger vers le tableau de bord client
        if (signupType === 'vendeur') {
          window.history.pushState({}, '', '/vendeur/onboarding');
          onNavigate('vendor-dashboard');
        } else {
          window.history.pushState({}, '', '/client/tableau-de-bord-client');
          onNavigate('client-dashboard');
        }
      }
    } catch (err: any) {
      console.error("[Vendza Supabase SignUp Exception]", err);
      showNotice(`Erreur lors de l'inscription : ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Selection log Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1 border">
        <button
          onClick={() => handleTabChange('login')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'login' ? 'bg-white shadow-sm font-extrabold text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LogIn size={13} /> Connexion
        </button>
        <button
          onClick={() => handleTabChange('signup')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'signup' ? 'bg-white shadow-sm font-extrabold text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus size={13} /> Inscription
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl border text-xs leading-relaxed flex flex-col gap-2 animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : notification.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex gap-2 items-start font-medium">
            <span className="text-sm">
              {notification.type === 'success' ? '✓' : notification.type === 'error' ? '❌' : notification.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="flex-1">{notification.text}</div>
          </div>
          {notification.action && (
            <button
              type="button"
              onClick={notification.action.onClick}
              className="mt-1 self-start px-3 py-1.5 bg-[#0c1445] hover:bg-[#151c4f] text-white font-bold rounded-lg text-[11px] transition cursor-pointer select-none"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      )}

      {activeTab === 'login' ? (
        /* Login card */
        <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <h3 className="font-serif text-sm font-bold text-slate-800 pb-1.5 border-b">Connectez-vous à votre espace</h3>

            {/* Account type switch */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Type d'accès</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLoginType('client')}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                    loginType === 'client' ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  Client / Acheteur
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('vendeur')}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                    loginType === 'vendeur' ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  Vendeur / Boutique
                </button>
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Email</label>
              <input
                type="email"
                placeholder="votre.nom@exemple.com"
                required
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-600 text-slate-700"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
              />
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Mot de passe</span>
                <span className="text-blue-500 font-bold select-none cursor-pointer">Oublié ?</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Saisir votre mot de passe"
                  required
                  className="w-full py-2.5 px-3 pr-10 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-600 text-slate-700 font-mono"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 bg-[#0c1445] hover:bg-[#151c4f] text-white text-xs font-black tracking-widest uppercase rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                isLoading ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {isLoading ? 'Authentification...' : "Signer le document d'accès"}
            </button>

            <div className="relative my-2.5 text-center">
              <span className="absolute inset-x-0 top-1/2 border-b border-slate-100" />
              <span className="relative bg-white px-3 text-[10px] uppercase font-bold text-[#a0aec0]">ou</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer select-none shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22.81-.6z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z"/>
              </svg>
              Se connecter avec Google
            </button>
          </form>
        </div>
      ) : (
        /* Sign up card */
        <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <h3 className="font-serif text-sm font-bold text-slate-800 pb-1.5 border-b">Rejoignez la confiance Vendza</h3>
            
            {/* Choose type card */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">Je souhaite...</label>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setSignupType('client')}
                  className={`p-3 border rounded-xl text-center cursor-pointer transition ${
                    signupType === 'client' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className="text-xl block">🛍️</span>
                  <span className="text-xs font-black">Acheter</span>
                </div>

                <div
                  onClick={() => setSignupType('vendeur')}
                  className={`p-3 border rounded-xl text-center cursor-pointer transition ${
                    signupType === 'vendeur' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className="text-xl block">🏪</span>
                  <span className="text-xs font-black">Vendre</span>
                </div>
              </div>
            </div>

            {/* Name/Surname row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="Jean-Daniel"
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nom *</label>
                <input
                  type="text"
                  required
                  placeholder="Michel"
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                />
              </div>
            </div>

            {/* Email & Tel */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email *</label>
              <input
                type="email"
                required
                placeholder="votre.nom@exemple.com"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Téléphone (Portefeuille local)</label>
              <input
                type="tel"
                placeholder="+509 XXXX XXXX"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs"
                value={tel}
                onChange={e => setTel(e.target.value)}
              />
            </div>

            {/* Area selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Département</label>
                <select
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50"
                  value={dept}
                  onChange={e => setDept(e.target.value)}
                >
                  {Object.keys(HAITIAN_ZONES).map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Commune *</label>
                <select
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50"
                  value={commune}
                  onChange={e => setCommune(e.target.value)}
                  required
                >
                  <option value="">Sélectionner…</option>
                  {HAITIAN_ZONES[dept].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Shop input if vendor type selected */}
            {signupType === 'vendeur' && (
              <div className="space-y-1 bg-teal-50 border border-teal-200 p-3 rounded-xl">
                <label className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Nom de votre boutique *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Bella Chic Boutique"
                  className="w-full py-2 px-3 border border-teal-300 rounded-lg text-xs bg-white focus:border-teal-500"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                />
              </div>
            )}

            {/* Safe Password & strength indicators */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mot de passe *</label>
              <input
                type="password"
                required
                placeholder="Créer un mot de passe fort"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs font-mono"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {password && (
                <div className="pt-1">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${pwdStrength.color} transition-all`} style={{ width: `${pwdStrength.percent}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">Force : {pwdStrength.label}</span>
                </div>
              )}
            </div>

            {/* Acceptance of terms & privacy policy */}
            <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 mt-2 select-none">
              <input
                type="checkbox"
                id="accept-terms-privacy"
                required
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
              />
              <label htmlFor="accept-terms-privacy" className="text-[11px] text-slate-500 leading-normal cursor-pointer">
                J'accepte la <button type="button" onClick={() => setPrivacyModalOpen(true)} className="text-teal-700 font-bold hover:underline bg-transparent border-0 cursor-pointer p-0 inline">Politique de Confidentialité</button> et de concert les <button type="button" onClick={() => setTermsModalOpen(true)} className="text-blue-600 font-bold hover:underline bg-transparent border-0 cursor-pointer p-0 inline">Conditions d'Utilisation</button> de Vendza.ht *
              </label>
            </div>

             <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 bg-gradient-to-r from-blue-600 to-teal-500 hover:opacity-95 text-white text-xs font-black tracking-widest uppercase rounded-xl transition shadow-md cursor-pointer mt-4 flex items-center justify-center gap-2 ${
                isLoading ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {isLoading ? 'Inscription...' : '🚀 Finaliser la création de compte'}
            </button>
          </form>
        </div>
      )}

      {/* Terms Overlay Modal */}
      {termsModalOpen && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-2 relative animate-scale-up">
            <TermsPage onBack={() => setTermsModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Privacy Overlay Modal */}
      {privacyModalOpen && (
        <div className="fixed inset-0 z-55 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-2 relative animate-scale-up">
            <PrivacyPage onBack={() => setPrivacyModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
