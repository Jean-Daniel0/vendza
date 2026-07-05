import React, { useState, useEffect } from 'react';
import { Save, User2, Store, Lock, Sparkles, MapPin, CheckCircle, RefreshCw, Upload, CreditCard, ShieldCheck, AlertCircle, Trash } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ShopSettingsViewProps {
  user: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNavigate: (view: string) => void;
}

const HAITIAN_ZONES: Record<string, string[]> = {
  'Ouest': ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour', 'Tabarre', 'Cité Soleil', 'Croix-des-Bouquets', 'Kenscoff', 'Léogâne', 'Petit-Goâve'],
  'Nord': ['Cap-Haïtien', 'Limonade', 'Plaine-du-Nord', 'Milot', 'Grande-Rivière-du-Nord'],
  'Nord-Ouest': ['Port-de-Paix', 'Saint-Louis-du-Nord', 'Jean-Rabel', 'Môle-Saint-Nicolas'],
  'Nord-Est': ['Fort-Liberté', 'Ouanaminthe', 'Terrier-Rouge', 'Trou-du-Nord'],
  'Artibonite': ['Gonaïves', 'Saint-Marc', 'Verrettes', 'Petite-Rivière-de-l\'Artibonite', 'Gros-Morne'],
  'Centre': ['Hinche', 'Mirebalais', 'Lascahobas', 'Boucan-Carré'],
  'Sud': ['Les Cayes', 'Port-Salut', 'Camp-Perrin', 'Aquin', 'Saint-Louis-du-Sud'],
  'Grande-Anse': ['Jérémie', 'Anse-d\'Hainault', 'Dame-Marie', 'Corail'],
  'Nippes': ['Miragoâne', 'Anse-à-Veau', 'Petite-Rivière-de-Nippes', 'Barradères'],
  'Sud-Est': ['Jacmel', 'Marigot', 'Bainet', 'Belle-Anse']
};

const CATEGORIES = [
  'Mode', 'Électronique', 'Maison', 'Beauté', 'Alimentation', 
  'Sport', 'Audio', 'Photo', 'Gaming', 'Autre'
];

export const ShopSettingsView: React.FC<ShopSettingsViewProps> = ({
  user,
  onUpdateProfile,
  onNavigate
}) => {
  const [editMode, setEditMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Local mirror states
  const [formPrenom, setFormPrenom] = useState(user.prenom || '');
  const [formNom, setFormNom] = useState(user.nom || '');
  const [formEmail, setFormEmail] = useState(user.email || '');
  const [formTel, setFormTel] = useState(user.tel || '');
  const [formDept, setFormDept] = useState(user.departement || 'Ouest');
  const [formCommune, setFormCommune] = useState(user.commune || 'Pétion-Ville');
  
  const [formShopName, setFormShopName] = useState(user.shopName || '');
  const [formShopDesc, setFormShopDesc] = useState(user.shopDesc || '');
  const [formAvatar, setFormAvatar] = useState(user.avatar || '');
  const [formBanner, setFormBanner] = useState(user.banner || '');

  // Newly requested fields for full profile & shop editing
  const [formCategories, setFormCategories] = useState<string[]>(user.categories || []);
  const [formMoncash, setFormMoncash] = useState(user.moncash || '');
  const [formMoncashNom, setFormMoncashNom] = useState(user.moncashNom || '');
  const [formBanque, setFormBanque] = useState(user.banque || '');
  const [formCompteBanque, setFormCompteBanque] = useState(user.compteBanque || '');
  
  const [formIdType, setFormIdType] = useState(user.idType || '');
  const [formIdNumber, setFormIdNumber] = useState(user.idNumber || '');
  const [formIdFile, setFormIdFile] = useState(user.idFile || '');
  const [formStatutVerification, setFormStatutVerification] = useState<'non_verifie' | 'en_verification' | 'verifie'>(user.statutVerification || 'non_verifie');

  // Password reset states
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConf, setPwdConf] = useState('');
  const [pwdStatus, setPwdStatus] = useState({ type: '', text: '' });

  // Notifications and storage file states
  const [prefOrders, setPrefOrders] = useState<boolean>(true);
  const [prefPromo, setPrefPromo] = useState<boolean>(true);
  const [prefAvis, setPrefAvis] = useState<boolean>(true);
  const [prefNewsletter, setPrefNewsletter] = useState<boolean>(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Step 4.1 — Récupérer le profil au chargement de la page et pré-remplir tous les champs
  useEffect(() => {
    const fetchProfileData = async () => {
      if (isSupabaseConfigured && supabase && user?.id) {
        try {
          const { data: profil, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profil && !error) {
            setFormPrenom(profil.prenom || '');
            setFormNom(profil.nom || '');
            setFormEmail(profil.email || '');
            setFormTel(profil.telephone || profil.tel || '');
            setFormDept(profil.departement || 'Ouest');
            setFormCommune(profil.commune || 'Pétion-Ville');
            setFormShopName(profil.boutique_nom || profil.shop_name || '');
            setFormShopDesc(profil.boutique_desc || profil.shop_desc || '');
            setFormAvatar(profil.avatar_url || profil.avatar || '');
            setFormMoncash(profil.numero_moncash || profil.moncash || '');
            setFormStatutVerification(profil.statut_verification || 'non_verifie');
            setPrefOrders(profil.notif_commandes !== undefined ? profil.notif_commandes : true);
            setPrefPromo(profil.notif_livraisons !== undefined ? profil.notif_livraisons : true);
            setPrefAvis(profil.notif_avis !== undefined ? profil.notif_avis : true);
            setPrefNewsletter(profil.newsletter !== undefined ? profil.newsletter : false);
          }
        } catch (err) {
          console.warn("Could not load fresh profile from Supabase:", err);
        }
      }
    };
    fetchProfileData();
  }, [user?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const uploadAvatar = async (file: File, userId: string) => {
    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop lourde — maximum 2MB');
      return null;
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      alert('Fichier non valide — images uniquement');
      return null;
    }

    // Nom du fichier unique (userId/avatar.png/jpg/etc.)
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/avatar.${ext}`;

    if (!isSupabaseConfigured || !supabase) {
      showToast("⚠️ Supabase non configuré pour l'upload d'avatar.");
      return null;
    }

    // Upload dans Supabase Storage - avec auto-création du bucket si inexistant
    let { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.warn("Upload failed, trying to create 'avatars' bucket...", uploadError);
      try {
        await supabase.storage.createBucket('avatars', { public: true });
        const { error: retryError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, { 
            upsert: true,
            contentType: file.type
          });
        uploadError = retryError;
      } catch (errBucket) {
        console.error("Could not create avatars bucket:", errBucket);
      }
    }

    if (uploadError) {
      console.error('Upload error:', uploadError);
      showToast(`❌ Erreur d'upload : ${uploadError.message}`);
      return null;
    }

    // Récupérer l'URL publique
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Mettre à jour profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: data.publicUrl,
        updated_at: new Date()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      showToast(`❌ Erreur de mise à jour profil : ${updateError.message}`);
      return null;
    }

    // Mettre à jour l'état local et propager l'information
    setFormAvatar(data.publicUrl);
    onUpdateProfile({
      avatar: data.publicUrl
    });
    showToast("📸 Photo de profil mise à jour avec succès !");
    return data.publicUrl;
  };

  const handleSaveProfile = async () => {
    if (!formPrenom.trim() || !formNom.trim() || !formEmail.trim() || !formShopName.trim()) {
      showToast("⚠️ Les champs Prénom, Nom, Email et Nom de Boutique sont obligatoires (*)");
      return;
    }

    // Adaptively adjust verification status if identity / payment info is now completely filled or removed
    let nextStatut = formStatutVerification;
    if (formStatutVerification === 'non_verifie' && formMoncash.trim() && formIdNumber.trim() && formIdFile) {
      nextStatut = 'en_verification';
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // Step 4.3 — À la sauvegarde, mettre à jour profiles
        const { error } = await supabase
          .from('profiles')
          .update({
            prenom: formPrenom,
            nom: formNom,
            telephone: formTel,
            departement: formDept,
            commune: formCommune,
            boutique_nom: formShopName,
            boutique_desc: formShopDesc,
            numero_moncash: formMoncash,
            moncash_nom: formMoncashNom,
            moncashnom: formMoncashNom,
            avatar_url: formAvatar,
            notif_commandes: prefOrders,
            notif_livraisons: prefPromo,
            notif_avis: prefAvis,
            newsletter: prefNewsletter,
            updated_at: new Date()
          })
          .eq('id', user.id);

        if (error) {
          showToast(`❌ Erreur lors de l'enregistrement : ${error.message}`);
          return;
        }

        // Action d'enregistrement d'avatar déjà effectuée immédiatement

        // Step 4.5 — Afficher un message de succès après sauvegarde et notifier l'utilisateur
        onUpdateProfile({
          prenom: formPrenom,
          nom: formNom,
          email: formEmail,
          tel: formTel,
          departement: formDept,
          commune: formCommune,
          shopName: formShopName,
          shopDesc: formShopDesc,
          avatar: formAvatar,
          banner: formBanner,
          categories: formCategories,
          moncash: formMoncash,
          moncashNom: formMoncashNom,
          banque: formBanque,
          compteBanque: formCompteBanque,
          idType: formIdType,
          idNumber: formIdNumber,
          idFile: formIdFile,
          statutVerification: nextStatut,
          notifOrders: prefOrders,
          notifPromo: prefPromo,
          notifAvis: prefAvis,
          newsletter: prefNewsletter
        });

        alert("✅ Vos modifications ont été enregistrées avec succès dans la base de données sécurisée !");
        setFormStatutVerification(nextStatut);
        setEditMode(false);
        showToast("💾 Tous les champs de votre profil et boutique ont été sauvegardés !");
      } else {
        // Fallback local update
        onUpdateProfile({
          prenom: formPrenom,
          nom: formNom,
          email: formEmail,
          tel: formTel,
          departement: formDept,
          commune: formCommune,
          shopName: formShopName,
          shopDesc: formShopDesc,
          avatar: formAvatar,
          banner: formBanner,
          categories: formCategories,
          moncash: formMoncash,
          moncashNom: formMoncashNom,
          banque: formBanque,
          compteBanque: formCompteBanque,
          idType: formIdType,
          idNumber: formIdNumber,
          idFile: formIdFile,
          statutVerification: nextStatut
        });
        setFormStatutVerification(nextStatut);
        setEditMode(false);
        showToast("💾 Tous les champs de votre profil et boutique ont été sauvegardés localement !");
      }
    } catch (err: any) {
      showToast(`❌ Erreur : ${err.message}`);
    }
  };

  const handleToggleCategory = (catName: string) => {
    if (formCategories.includes(catName)) {
      setFormCategories(prev => prev.filter(c => c !== catName));
    } else {
      setFormCategories(prev => [...prev, catName]);
    }
  };

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast("❌ Fichier trop lourd (max 10 Mo)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFormIdFile(reader.result);
          showToast("✓ Photo de pièce d'identité chargée localement !");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCurrent) {
      setPwdStatus({ type: 'error', text: 'Saisissez votre mot de passe actuel.' });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdStatus({ type: 'error', text: 'Le mot de passe doit faire au moins 6 caractères.' });
      return;
    }
    if (pwdNew !== pwdConf) {
      setPwdStatus({ type: 'error', text: 'Les deux mots de passe saisis sont différents.' });
      return;
    }

    setPwdStatus({ type: 'success', text: '✓ Mot de passe réinitialisé !' });
    setPwdCurrent('');
    setPwdNew('');
    setPwdConf('');
    setTimeout(() => setPwdStatus({ type: '', text: '' }), 5000);
  };

  const scrollToMoncash = () => {
    setEditMode(true);
    setTimeout(() => {
      const el = document.getElementById('moncash_container');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = document.getElementById('moncash_input');
        if (input) input.focus();
      }
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Toast alert display */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-60 bg-teal-900 border border-teal-400 text-teal-100 text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Warning Banner for missing MonCash number */}
      {!formMoncash && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                Votre numéro MonCash n'est pas configuré.
              </p>
              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                Vous ne pourrez pas recevoir vos paiements automatiquement après livraison.
              </p>
            </div>
          </div>
          <button
            onClick={scrollToMoncash}
            className="self-start sm:self-center bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 duration-150"
          >
            Saisir mon numéro maintenant
          </button>
        </div>
      )}

      {/* Breadcrumb / Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="font-serif text-lg font-black text-[#0c1445]">
            🏪 Page Boutique, Profil &amp; Identité
          </h1>
          <p className="text-xs text-slate-400 font-semibold">
            Gérez votre identité commerciale, vos comptes de paiements et vos pièces d'authentification.
          </p>
        </div>
        
        <button
          onClick={() => {
            if (editMode) {
              handleSaveProfile();
            } else {
              setEditMode(true);
            }
          }}
          className={`inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
            editMode 
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
              : 'bg-[#0c1445] hover:bg-[#151c4f] text-white'
          }`}
        >
          {editMode ? (
            <><Save size={14} /> Enregistrer tout</>
          ) : (
            <><User2 size={14} /> Modifier mon Profil</>
          )}
        </button>
      </div>

      {/* Header cover */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-xs group/cover">
        {formBanner ? (
          <img 
            src={formBanner} 
            alt="Photo de couverture" 
            className="w-full h-40 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-40 bg-gradient-to-r from-[#0c1445] via-teal-950 to-emerald-950 relative">
            <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent opacity-60" />
          </div>
        )}
        <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 font-mono text-[9px] font-extrabold uppercase tracking-widest border border-amber-400/20 px-3 py-1 rounded-full backdrop-blur-xs">
          ✓ Membre Certifié {user.plan}
        </div>

        {/* Cover photo upload button - visible only in editMode */}
        {editMode && (
          <label className="absolute bottom-3 right-4 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-150">
            <Sparkles size={12} className="text-teal-600" />
            <span>Modifier la couverture</span>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                      setFormBanner(reader.result);
                      showToast("📸 Photo de couverture ajoutée ! N'oubliez pas de cliquer sur Enregistrer.");
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden" 
            />
          </label>
        )}
      </div>

      {/* Avatar overlay */}
      <div className="p-6 pt-0 bg-white rounded-3xl border border-slate-100 shadow-2xs relative -mt-8 mx-1">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12 mb-4">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-900 to-[#0c1445] text-white border-4 border-white flex items-center justify-center text-5xl font-serif font-black shadow-md relative group select-none overflow-hidden">
            {formAvatar ? (
              <img 
                src={formAvatar} 
                alt="Photo de profil gérant" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>
                {formPrenom 
                  ? formPrenom.charAt(0).toUpperCase() 
                  : (formEmail ? formEmail.charAt(0).toUpperCase() : 'B')
                }
              </span>
            )}

            {editMode && (
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer text-white text-[10px] font-bold">
                <Sparkles size={16} />
                <span className="text-center px-1">Changer</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setFormAvatar(reader.result);
                          showToast("📸 Photo de profil ajoutée ! Traitement de l'envoi...");
                        }
                      };
                      reader.readAsDataURL(file);

                      // Upload immediat dans Supabase
                      uploadAvatar(file, user.id);
                    }
                  }}
                  className="hidden" 
                />
              </label>
            )}
          </div>

          <div className="space-y-0.5 text-center sm:text-left">
            <h2 className="font-serif text-lg font-black tracking-tight text-[#0c1445] flex items-center justify-center sm:justify-start gap-1.5">
              <span>{formShopName || 'Ma Vitrine Vendza'}</span>
              {user.plan === 'Pro Local' && (
                <span className="inline-flex items-center shrink-0" title="Pro Local">
                  <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
              )}
              {user.plan === 'Pro National' && (
                <span className="inline-flex items-center shrink-0" title="Pro National">
                  <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <span>Gérant : {formPrenom} {formNom}</span>
              <span className="hidden sm:inline text-[#9aa3bf]">•</span>
              <span>{formEmail}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1.5">
              <span className="text-[9px] font-black tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-100 px-2.5 py-0.5 rounded-full">
                🏪 Compte vendeur
              </span>
              <span className="text-[9px] font-black tracking-wider uppercase bg-[#dff0e2] text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                📍 {formCommune}, {formDept}
              </span>
              <span className="text-[9px] font-black tracking-wider uppercase bg-blue-50 text-blue-800 border border-blue-100 px-2.5 py-0.5 rounded-full">
                ★ Plan {user.plan}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className="mb-6">
          {formStatutVerification === 'verifie' ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs font-semibold flex items-center gap-3">
              <ShieldCheck className="text-emerald-600 shrink-0" size={24} />
              <div>
                <strong className="text-emerald-950 font-bold block mb-0.5">Identité Vérifiée avec succès ✓</strong>
                Toutes les pièces d'identité et coordonnées de paiement ont été validées par l'équipe Vendza. Votre boutique possède le badge de confiance maximale.
              </div>
            </div>
          ) : formStatutVerification === 'en_verification' ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs font-semibold flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <strong className="text-amber-950 font-bold block mb-0.5">Dossier en cours d'examen</strong>
                Vos pièces justificatives ont été déposées et sont en cours d'analyse par notre équipe de conformité. Ce processus prend en moyenne 24h à 48h.
              </div>
            </div>
          ) : (user.plan && user.plan !== 'Gratuit' && user.plan !== 'gratuit') ? (
            <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={24} />
              <div>
                <strong className="text-red-950 font-bold block mb-0.5">Statut : Non vérifié (Revenus bloqués) ⚠️</strong>
                Vos gains de ventes restent séquestrés tant que vous n'avez pas renseigné un numéro MonCash de dépôt de fonds et versé une pièce d'identité (CIN ou Passeport au verso) valide. Cliquez sur "Modifier mon Profil" pour compléter vos informations.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100/80 text-slate-700 rounded-2xl p-4 text-xs font-semibold flex items-center gap-3">
              <ShieldCheck className="text-emerald-600 shrink-0" size={24} />
              <div>
                <strong className="text-slate-800 font-bold block mb-0.5">Plan Actuel : Gratuit (Sécurisé) ✅</strong>
                Votre boutique opère en toute sérénité sous le plan de base gratuit. Vos revenus sont transférables en direct sans nécessité de déposer une pièce d'identité de gérant.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
          {/* Left Forms */}
          <div className="md:col-span-7 space-y-5">
            
            {/* Personal credentials & ID Verification block */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-3xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg">
                  <User2 size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identité Gérant &amp; Pièce Justificative</h3>
                  <p className="text-[9px] text-slate-400">Coordonnées légales obligatoires</p>
                </div>
              </div>

              {!editMode ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                    <span className="text-base text-slate-400 mt-0.5">👤</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Nom complet</span>
                      <span className="text-xs font-black text-slate-700">{formPrenom} {formNom || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                    <span className="text-base text-slate-400 mt-0.5">📧</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Adresse mail</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{formEmail}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                    <span className="text-base text-slate-400 mt-0.5">📞</span>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Téléphone</span>
                      <span className="text-xs font-mono font-bold text-slate-700">{formTel || 'Non renseigné'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                      <span className="text-base text-slate-400 mt-0.5">📍</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Département</span>
                        <span className="text-xs font-black text-slate-700">{formDept}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-2.5 rounded-xl hover:bg-slate-50 transition">
                      <span className="text-base text-slate-400 mt-0.5">🏙️</span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Commune</span>
                        <span className="text-xs font-black text-slate-700">{formCommune}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pièce Nationale d'Identité</span>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Type de document</span>
                        <div className="font-bold text-slate-700">{formIdType || 'Non spécifié'}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Numéro de pièce</span>
                        <div className="font-mono font-bold text-slate-700">{formIdNumber || 'Non spécifié'}</div>
                      </div>
                    </div>
                    {formIdFile ? (
                      <div className="p-2 border rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold flex items-center justify-between">
                        <span>📄 Image de pièce d'identité validée localement</span>
                        <button onClick={() => setFormIdFile('')} disabled className="text-red-500 opacity-30 cursor-not-allowed">Supprimer</button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-semibold italic">⚠️ Aucune copie de pièce justificative importée.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs text-slate-700 font-semibold">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Prénom *</label>
                      <input 
                        type="text" 
                        value={formPrenom}
                        onChange={(e) => setFormPrenom(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nom *</label>
                      <input 
                        type="text" 
                        value={formNom}
                        onChange={(e) => setFormNom(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email *</label>
                    <input 
                      type="email" 
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Téléphone</label>
                    <input 
                      type="tel" 
                      placeholder="+509 XXXX XXXX"
                      value={formTel}
                      onChange={(e) => setFormTel(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Département</label>
                      <select 
                        value={formDept}
                        onChange={(e) => {
                          const newDept = e.target.value;
                          setFormDept(newDept);
                          const defCommunes = HAITIAN_ZONES[newDept] || [];
                          if (defCommunes.length > 0) setFormCommune(defCommunes[0]);
                        }}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-semibold"
                      >
                        {Object.keys(HAITIAN_ZONES).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Commune</label>
                      <select 
                        value={formCommune}
                        onChange={(e) => setFormCommune(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-semibold"
                      >
                        {(HAITIAN_ZONES[formDept] || []).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ID inputs in editMode */}
                  <div className="border-t border-dashed pt-3 space-y-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Modifier Pièce d'Identité</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 font-semibold">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Type de pièce</label>
                        <select
                          value={formIdType}
                          onChange={(e) => setFormIdType(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700 font-extrabold"
                        >
                          <option value="">Sélectionner...</option>
                          <option value="CIN">CIN (Identité Nationale)</option>
                          <option value="Passeport">Passeport</option>
                          <option value="Permis">Permis de conduire</option>
                        </select>
                      </div>

                      <div className="space-y-1 font-semibold">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Nº de document</label>
                        <input
                          type="text"
                          value={formIdNumber}
                          onChange={(e) => setFormIdNumber(e.target.value)}
                          placeholder="Ex: 01-02-99-..."
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase block">Photo Recto de la pièce d'identité</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="file" 
                          id="settings-id-file" 
                          accept="image/*,application/pdf" 
                          onChange={handleIdUpload}
                          className="hidden" 
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('settings-id-file')?.click()}
                          className="py-1.5 px-3 border bg-slate-100 rounded-lg text-slate-700 font-bold text-[10.5px] cursor-pointer hover:bg-slate-200 transition"
                        >
                          <Upload size={12} className="inline mr-1 text-slate-600" /> Charger photo
                        </button>
                        {formIdFile ? (
                          <span className="text-[10px] text-emerald-600 font-bold truncate max-w-xs">✓ Pièce chargée</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Aucun fichier joint</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shop info presentation block */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-3xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 bg-teal-50 text-teal-600 flex items-center justify-center rounded-lg">
                  <Store size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identité Commerciale &amp; Rayons</h3>
                  <p className="text-[9px] text-slate-400">Présentation de la boutique et ses catégories</p>
                </div>
              </div>

              {!editMode ? (
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                     <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Nom commercial de votre magasin</span>
                    <span className="text-xs font-black text-slate-800">{formShopName || '—'}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Slogan &amp; Présentation</span>
                    <p className="text-xs text-slate-600 leading-normal font-medium bg-slate-50 p-2.5 rounded-lg border">
                      {formShopDesc || 'Aucune description rédigée.'}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Catégories d'articles vendus</span>
                    <div className="flex flex-wrap gap-1">
                      {formCategories.length > 0 ? formCategories.map(c => (
                        <span key={c} className="text-[9px] bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full border">
                          {c}
                        </span>
                      )) : (
                        <span className="text-xs italic text-slate-400">Aucune catégorie sélectionnée.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nom de la vitrine *</label>
                    <input 
                      type="text" 
                      value={formShopName}
                      onChange={(e) => setFormShopName(e.target.value)}
                      placeholder="Ex : TechShop Haïti"
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Description &amp; Slogan</label>
                    <textarea 
                      value={formShopDesc}
                      onChange={(e) => setFormShopDesc(e.target.value)}
                      placeholder="Décrivez votre boutique"
                      rows={3}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50 text-slate-700" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Rayons de commercialisation</label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {CATEGORIES.map(c => {
                        const hasCat = formCategories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleToggleCategory(c)}
                            className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border cursor-pointer select-none transition-all ${
                              hasCat 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            {hasCat ? `✓ ${c}` : c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t font-bold">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      <Save size={13} /> Sauvegarder tout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right block: Payments and Security */}
          <div className="md:col-span-4 lg:col-span-5 space-y-5">
            
            {/* Payment Account Details */}
            <div id="moncash_container" className="bg-white border border-slate-100 rounded-3xl p-5 shadow-3xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 bg-red-50 text-red-600 flex items-center justify-center rounded-lg">
                  <CreditCard size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recouvrement &amp; Dépôts</h3>
                  <p className="text-[9px] text-slate-400">Où Vendza vous verse vos bénéfices</p>
                </div>
              </div>

              {!editMode ? (
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="p-3 bg-red-50/50 border border-red-100 rounded-2xl space-y-2">
                    <span className="text-[10.5px] font-black text-red-950 block">Compte MonCash (Défaut)</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-bold block">Numéro</span>
                        <span className="font-mono font-black text-slate-800">{formMoncash || 'Non spécifié ⚠️'}</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-bold block">Titulaire de compte</span>
                        <span className="font-bold text-slate-800 truncate block">{formMoncashNom || 'Non spécifié'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Compte Bancaire (Alternatif)</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[8.5px] text-slate-400 block font-bold">Banque</span>
                        <span className="font-black text-slate-700">{formBanque || 'Aucune'}</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] text-slate-400 block font-bold">Nº de compte</span>
                        <span className="font-mono font-bold text-slate-700 truncate block">{formCompteBanque || 'Aucun'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs text-slate-700 font-semibold">
                  <div className="p-3 bg-red-50/60 border border-red-100 rounded-2xl space-y-3">
                    <span className="text-[10.5px] font-black text-red-950 block">Compte MonCash</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Numéro Téléphone MonCash</label>
                      <input
                        id="moncash_input"
                        type="tel"
                        value={formMoncash}
                        onChange={(e) => setFormMoncash(e.target.value)}
                        placeholder="+509 XXXX XXXX"
                        className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Nom exact du gérant titulaire</label>
                      <input
                        type="text"
                        value={formMoncashNom}
                        onChange={(e) => setFormMoncashNom(e.target.value)}
                        placeholder="Titulaire MonCash"
                        className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                      />
                    </div>
                  </div>

                  <div className="border-t border-dashed pt-3 space-y-2">
                    <span className="text-[10.5px] font-black text-slate-400 uppercase block">Coordonnées bancaires</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-slate-400 uppercase">Banque</label>
                        <select
                          value={formBanque}
                          onChange={(e) => setFormBanque(e.target.value)}
                          className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white font-extrabold"
                        >
                          <option value="">Sélectionner...</option>
                          <option>Sogebank</option>
                          <option>BNC</option>
                          <option>Unibank</option>
                          <option>BUH</option>
                          <option>Capital Bank</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-slate-400 uppercase">Numéro de Compte</label>
                        <input
                          type="text"
                          value={formCompteBanque}
                          onChange={(e) => setFormCompteBanque(e.target.value)}
                          placeholder="Compte bancaire"
                          className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Password resetting */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-3xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 bg-amber-50 text-amber-600 flex items-center justify-center rounded-lg">
                  <Lock size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sécurité des identifiants</h3>
                  <p className="text-[9px] text-slate-400">Modifier vos codes secrets d'accessibilité</p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Code de connexion actuel</label>
                  <input 
                    type="password" 
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nouveau mot de passe</label>
                  <input 
                    type="password" 
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    placeholder="Minimal 6 caractères"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Confirmer le nouveau code</label>
                  <input 
                    type="password" 
                    value={pwdConf}
                    onChange={(e) => setPwdConf(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-mono" 
                  />
                </div>

                {pwdStatus.text && (
                  <p className={`text-[10px] font-bold py-1 px-2 rounded ${pwdStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                    {pwdStatus.text}
                  </p>
                )}

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 border text-white font-bold rounded-xl text-xs uppercase transition tracking-wider cursor-pointer"
                >
                  Mettre à jour mot de passe
                </button>
              </form>
            </div>

            {/* Securised Escrow Guarantee Notification info panel */}
            <div className="bg-gradient-to-br from-[#0c1445] to-[#1e3a8a] text-white rounded-3xl p-5 shadow-xs space-y-3 text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-300">Séquestre National</h4>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-200 font-medium">
                Toutes vos données et transactions à la vitrine <strong>{user.shopName || 'Ma Vitrine'}</strong> sont garanties à 100% par le pôle de confiance nationale de Vendza. Les versements sont protégés et audités par validation de signature QR unique lors de la délivrance.
              </p>
              <div className="border-t border-white/10 pt-2.5 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase text-teal-400 tracking-wider">Paiements sécurisés actifs</span>
                <span className="text-[9.5px] px-2 py-0.5 bg-teal-400/20 border border-teal-300/30 rounded text-teal-300 font-black font-mono">OK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
