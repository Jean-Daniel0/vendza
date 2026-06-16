import React, { useState, useEffect } from 'react';
import { Store, CheckCircle, Smartphone, Award, ShieldAlert, Sparkles, MapPin, UploadCloud, ChevronRight, ChevronLeft, Building, FileText, Check, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabaseClient';

interface BecomeSellerViewProps {
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
  { label: 'Mode', emoji: '👗' },
  { label: 'Électronique', emoji: '📱' },
  { label: 'Maison', emoji: '🏠' },
  { label: 'Beauté', emoji: '💄' },
  { label: 'Alimentation', emoji: '🍽️' },
  { label: 'Sport', emoji: '⚽' },
  { label: 'Audio', emoji: '🎵' },
  { label: 'Photo', emoji: '📸' },
  { label: 'Gaming', emoji: '🎮' },
  { label: 'Autre', emoji: '📦' }
];

export const BecomeSellerView: React.FC<BecomeSellerViewProps> = ({
  user,
  onUpdateProfile,
  onNavigate
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 5;

  const [realtimeChecking, setRealtimeChecking] = useState(true);
  const [hasSellerAccount, setHasSellerAccount] = useState(!!user.shopName);

  useEffect(() => {
    let active = true;
    const checkRealtimeStatus = async () => {
      if (!supabase || !user?.id) {
        setRealtimeChecking(false);
        return;
      }
      try {
        let { data: profile, error } = await supabase
          .from('profiles')
          .select('boutique_nom, type')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          const actualShopName = profile.boutique_nom;
          const actualUserType = profile.type;
          
          if (actualShopName) {
            setHasSellerAccount(true);
            if (!user.shopName) {
              onUpdateProfile({
                shopName: actualShopName,
                userType: (actualUserType || 'vendeur') as 'client' | 'vendeur'
              });
            }
          }
        }
      } catch (err) {
        console.error("Error checking vendor status in real-time:", err);
      } finally {
        if (active) {
          setRealtimeChecking(false);
        }
      }
    };

    checkRealtimeStatus();
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Step 1: Boutique Info
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');

  // Step 2: Categories
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Step 3: Logo
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Step 4: Payment Details
  const [moncash, setMoncash] = useState('');
  const [moncashNom, setMoncashNom] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  // Step 5: ID Identity
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idFile, setIdFile] = useState<string>('');

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [onboardSuccess, setOnboardSuccess] = useState(false);
  const [finalStatus, setFinalStatus] = useState<'non_verifie' | 'en_verification'>('non_verifie');

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep === TOTAL_STEPS) {
        handleSubmit();
      } else {
        setCurrentStep(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const skipPaymentStep = () => {
    // Empty payment fields and proceed
    setMoncash('');
    setMoncashNom('');
    setBankName('');
    setBankAccount('');
    setCurrentStep(5);
  };

  const skipIdentityStep = () => {
    setIdType('');
    setIdNumber('');
    setIdFile('');
    handleSubmit(true); // Flag to skip verification
  };

  const validateStep = (step: number) => {
    const errs: Record<string, string> = {};
    let isValid = true;

    if (step === 1) {
      if (!shopName.trim()) {
        errs.shopName = "Le nom de la boutique est requis.";
        isValid = false;
      }
      if (shopDesc.trim().length < 20) {
        errs.shopDesc = "La description doit contenir au moins 20 caractères.";
        isValid = false;
      }
    } else if (step === 2) {
      if (selectedCats.length === 0) {
        errs.categories = "Sélectionnez au moins une catégorie.";
        isValid = false;
      }
    } else if (step === 4) {
      // payment is optional, but if partially filled, validate
      if (moncash.trim() || moncashNom.trim()) {
        if (moncash.trim().length < 8) {
          errs.moncash = "Veuillez entrer un numéro MonCash de 8 chiffres minimum.";
          isValid = false;
        }
        if (!moncashNom.trim()) {
          errs.moncashNom = "Veuillez indiquer le nom exact du titulaire MonCash.";
          isValid = false;
        }
      }
    } else if (step === 5) {
      // ID is optional, but if partially filled, validate
      if (idType || idNumber.trim() || idFile) {
        if (!idType) {
          errs.idType = "Le type de document est obligatoire.";
          isValid = false;
        }
        if (!idNumber.trim()) {
          errs.idNumber = "Le numéro du document est obligatoire.";
          isValid = false;
        }
        if (!idFile) {
          errs.idFile = "Veuillez joindre la photo de votre pièce d'identité.";
          isValid = false;
        }
      }
    }

    setErrors(errs);
    return isValid;
  };

  const handleToggleCat = (catName: string) => {
    if (selectedCats.includes(catName)) {
      setSelectedCats(prev => prev.filter(c => c !== catName));
    } else {
      setSelectedCats(prev => [...prev, catName]);
    }
    // clear error for step 2 on click
    if (errors.categories) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.categories;
        return next;
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("L'image de logo ne doit pas dépasser 5 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("La pièce d'identité ne doit pas dépasser 10 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setIdFile(reader.result);
          if (errors.idFile) {
            setErrors(prev => {
              const next = { ...prev };
              delete next.idFile;
              return next;
            });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (skippedId = false) => {
    setSubmitting(true);
    
    const hasPaiement = !!moncash.trim();
    const hasVerification = !skippedId && !!idNumber.trim() && !!idFile;
    const statut: 'non_verifie' | 'en_verification' = (hasPaiement && hasVerification) ? 'en_verification' : 'non_verifie';
    
    setFinalStatus(statut);

    // Save profile updates to Supabase
    onUpdateProfile({
      userType: 'vendeur',
      shopName: shopName,
      shopDesc: shopDesc,
      categories: selectedCats,
      avatar: logoPreview || user.avatar,
      moncash: moncash || '',
      moncashNom: moncashNom || '',
      banque: bankName || '',
      compteBanque: bankAccount || '',
      idType: idType || '',
      idNumber: idNumber || '',
      idFile: idFile || '',
      statutVerification: statut,
      plan: 'Gratuit' // default start plan
    });

    setSubmitting(false);
    setOnboardSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (realtimeChecking && !user.shopName) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center font-sans animate-pulse">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">Vérification en direct de votre compte...</p>
      </div>
    );
  }

  if (hasSellerAccount) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center font-sans">
        <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">
          🏪
        </div>
        <h2 className="font-serif text-xl font-black text-[#0c1445] tracking-tight mb-2 animate-fade-in">
          Vous possédez déjà un compte Vendeur !
        </h2>
        <p className="text-xs text-slate-500 font-semibold mb-6 leading-relaxed max-w-sm mx-auto">
          Votre boutique <strong className="text-teal-700">« {user.shopName || shopName || 'Ma Boutique'} »</strong> est déjà enregistrée. Vous n'avez pas besoin de remplir à nouveau le formulaire d'inscription.
        </p>

        <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            onClick={() => {
              onUpdateProfile({ userType: 'vendeur' });
              onNavigate('vendor-dashboard');
            }}
            className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            🔑 Activer le Mode Boutique
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
          >
            Retourner au Marché principal
          </button>
        </div>
      </div>
    );
  }

  if (onboardSuccess) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center font-sans">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-4xl mx-auto mb-6 shadow-md shadow-emerald-200">
          🎉
        </div>
        
        <h2 className="font-serif text-2xl font-black text-[#0c1445] tracking-tight mb-2">
          Boutique créée !
        </h2>
        
        {finalStatus === 'en_verification' ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs font-semibold leading-relaxed mb-6 text-left flex gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <strong className="text-amber-950 font-bold block mb-1">En cours de vérification :</strong>
              Notre équipe examine votre pièce d'identité et vos informations de paiement. Votre boutique sera activée après validation sous 24h-48h.
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 text-xs font-semibold leading-relaxed mb-6 text-left flex gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <strong className="text-red-950 font-bold block mb-1">Revenus bloqués :</strong>
              Votre boutique est opérationnelle et vous pouvez publier des produits ! Cependant, vos gains de ventes seront conservés en attente jusqu'à complet renseignement de votre compte MonCash et de votre CIN dans votre profil.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="p-4 bg-white border border-slate-100 rounded-2xl text-left shadow-3xs">
            <span className="text-lg block mb-1">📦</span>
            <span className="block text-xs font-extrabold text-[#0c1445] mb-0.5">Préparez vos produits</span>
            <span className="text-[10px] text-slate-400 font-semibold leading-normal">Créez vos fiches dès maintenant en mode brouillon ou public.</span>
          </div>
          <div className="p-4 bg-white border border-slate-100 rounded-2xl text-left shadow-3xs">
            <span className="text-lg block mb-1">📸</span>
            <span className="block text-xs font-extrabold text-[#0c1445] mb-0.5">Soignez vos photos</span>
            <span className="text-[10px] text-slate-400 font-semibold leading-normal">Un fond uniforme, clair et lumineux multiplie vos ventes.</span>
          </div>
          <div className="p-4 bg-white border border-slate-100 rounded-2xl text-left shadow-3xs">
            <span className="text-lg block mb-1">💰</span>
            <span className="block text-xs font-extrabold text-[#0c1445] mb-0.5">Fixez de bons prix</span>
            <span className="text-[10px] text-slate-400 font-semibold leading-normal">Étudiez le marché haïtien pour offrir des tarifs justes et compétitifs.</span>
          </div>
          <div className="p-4 bg-white border border-slate-100 rounded-2xl text-left shadow-3xs">
            <span className="text-lg block mb-1">🚚</span>
            <span className="block text-xs font-extrabold text-[#0c1445] mb-0.5">Zone de livraison</span>
            <span className="text-[10px] text-slate-400 font-semibold leading-normal">Dites à vos clients jusqu'où vos transporteurs peuvent livrer.</span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('vendor-dashboard')}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer"
        >
          <span>Aller au Tableau de Bord</span>
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4 font-sans space-y-6 pb-24">
      
      {/* Dynamic Progress indicator */}
      <div className="bg-white border rounded-3xl p-4 shadow-3xs">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-3">
          <span className="uppercase tracking-wider">Configuration de boutique</span>
          <span>Étape {currentStep} sur 5</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-teal-500 transition-all duration-300"
            style={{ width: `${(currentStep - 1) * 25}%` }}
          />
        </div>
        
        {/* Step Circles */}
        <div className="flex justify-between items-center mt-3.5">
          {[1, 2, 3, 4, 5].map(st => (
            <div key={st} className="flex items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-black transition-all ${
                st < currentStep 
                  ? 'bg-emerald-500 text-white' 
                  : st === currentStep 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-50' 
                    : 'bg-slate-100 text-slate-400 border'
              }`}>
                {st < currentStep ? '✓' : st}
              </div>
              {st < 5 && <div className={`w-8 h-0.5 ${st < currentStep ? 'bg-emerald-500' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ═ Step 1 — Boutique ═ */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-3xl">🏪</span>
            <h3 className="font-serif text-lg font-black text-[#0c1445] mt-2 mb-1">Votre Boutique</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">Donnez un nom et décrivez votre enseigne de commerce unique sur Vendza.</p>
          </div>

          <div className="bg-white border rounded-3xl p-5 space-y-4 shadow-3xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nom de la boutique <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={shopName}
                onChange={(e) => {
                  setShopName(e.target.value.slice(0, 50));
                  if (errors.shopName) setErrors(prev => { const n = {...prev}; delete n.shopName; return n; });
                }}
                placeholder="Ex : TechShop HT, Mode Élégance…"
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold focus:outline-none focus:border-blue-600 ${errors.shopName ? 'border-red-500' : 'border-slate-100'}`}
              />
              <div className="text-right text-[9px] text-slate-400 font-bold">{shopName.length}/50</div>
              {errors.shopName && <p className="text-[9.5px] font-bold text-red-600">{errors.shopName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Présentation / Description <span className="text-red-500">*</span></label>
              <textarea 
                value={shopDesc}
                onChange={(e) => {
                  setShopDesc(e.target.value.slice(0, 300));
                  if (errors.shopDesc) setErrors(prev => { const n = {...prev}; delete n.shopDesc; return n; });
                }}
                placeholder="Ex : Boutique spécialisée dans l'électronique de pointe et smartphone d'origine. Garantie de 6 mois sur tous nos produits..."
                rows={4}
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold leading-relaxed focus:outline-none focus:border-blue-600 ${errors.shopDesc ? 'border-red-500' : 'border-slate-100'}`}
              />
              <div className="text-right text-[9px] text-slate-400 font-bold">{shopDesc.length}/300</div>
              {errors.shopDesc && <p className="text-[9.5px] font-bold text-red-600">{errors.shopDesc}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═ Step 2 — Catégories ═ */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-3xl">🗂️</span>
            <h3 className="font-serif text-lg font-black text-[#0c1445] mt-2 mb-1">Type de Produits</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">Sélectionnez les catégories d'articles que vous commercialisez (choisir au moins 1).</p>
          </div>

          <div className="bg-white border rounded-3xl p-5 shadow-3xs space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => {
                const isSel = selectedCats.includes(cat.label);
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => handleToggleCat(cat.label)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer select-none ${
                      isSel 
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-ns' 
                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0 font-black ${
                      isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSel && '✓'}
                    </div>
                    <span className="text-sm shrink-0">{cat.emoji}</span>
                    <span className="text-xs font-bold leading-none truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.categories && <p className="text-[9.5px] font-bold text-red-600 text-center pt-2">{errors.categories}</p>}
          </div>
        </div>
      )}

      {/* ═ Step 3 — Logo/Photo ═ */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-3xl">📸</span>
            <h3 className="font-serif text-lg font-black text-[#0c1445] mt-2 mb-1">Photo de Boutique / Logo</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">Uploadez un bel emblème ou votre logo de commerce pour asseoir votre réputation.</p>
          </div>

          <div className="bg-white border rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 relative overflow-hidden group hover:bg-slate-100/50 transition">
              {logoPreview ? (
                <div className="flex flex-col items-center">
                  <img src={logoPreview} alt="Logo Preview" className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md mb-2" referrerPolicy="no-referrer" />
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">✓ IMAGE SÉLECTIONNÉE</span>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <UploadCloud size={32} className="text-slate-400 mx-auto" />
                  <span className="block text-xs font-bold text-slate-700">Sélectionner une image</span>
                  <span className="block text-[9px] text-slate-400">JPG, PNG - Max 5 Mo</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={handleLogoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            <div className="bg-blue-50/70 border border-blue-100/50 rounded-2xl p-3.5 space-y-1.5 text-[10.5px] text-blue-900">
              <span className="font-extrabold text-[#0c1445] flex items-center gap-1">💡 Conseils pour augmenter vos ventes :</span>
              <ul className="list-disc pl-3 font-semibold space-y-0.5 text-slate-600">
                <li>Privilégiez un fond clair, uni ou neutre.</li>
                <li>Format carré recommandé (1:1).</li>
                <li>Finesse d'éclairage et produit bien centré.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ═ Step 4 — Paiement ═ */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-3xl">💰</span>
            <h3 className="font-serif text-lg font-black text-[#0c1445] mt-2 mb-1">Compte de Recouvrement</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">Veuillez renseigner votre ligne MonCash pour recevoir automatiquement les paiements acheteurs débrayés.</p>
          </div>

          <div className="bg-amber-100 text-amber-900 border border-amber-300/30 rounded-2xl p-4 flex gap-3 shadow-3xs">
            <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-amber-950 flex items-center justify-between">
                <span>Cette étape est optionnelle</span>
                <button 
                  onClick={skipPaymentStep}
                  className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-800 text-[9.5px] font-black uppercase rounded shrink-0 transition"
                >
                  Passer →
                </button>
              </div>
              <p className="text-[10px] leading-relaxed font-semibold text-amber-800 mt-1">
                Sans ces informations, vous pouvez vendre mais vos <strong>revenus seront gelés</strong> jusqu'à complétion dans vos paramètres.
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5 pb-2 border-b border-dashed">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span className="text-xs font-black text-[#0c1445]">MonCash (Recommandé)</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Numéro de téléphone MonCash <span className="text-red-500">*</span></label>
              <input 
                type="tel" 
                value={moncash}
                onChange={(e) => {
                  setMoncash(e.target.value);
                  if (errors.moncash) setErrors(prev => { const n = {...prev}; delete n.moncash; return n; });
                }}
                placeholder="+509 XXXX XXXX"
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold focus:outline-none focus:border-blue-600 ${errors.moncash ? 'border-red-500' : 'border-slate-100'}`}
              />
              {errors.moncash && <p className="text-[9.5px] font-bold text-red-600">{errors.moncash}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nom complet du titulaire <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={moncashNom}
                onChange={(e) => {
                  setMoncashNom(e.target.value);
                  if (errors.moncashNom) setErrors(prev => { const n = {...prev}; delete n.moncashNom; return n; });
                }}
                placeholder="Ex : Michel Jean Daniel"
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold focus:outline-none focus:border-blue-600 ${errors.moncashNom ? 'border-red-500' : 'border-slate-100'}`}
              />
              {errors.moncashNom && <p className="text-[9.5px] font-bold text-red-600">{errors.moncashNom}</p>}
            </div>

            <div className="border-t border-dashed my-3 pt-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">Ou renseignez un Compte Bancaire alternatif</span>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Banque</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Sélectionner...</option>
                    <option>Sogebank</option>
                    <option>BNC</option>
                    <option>Unibank</option>
                    <option>Sogebel</option>
                    <option>BUH</option>
                    <option>Capital Bank</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Compte Nº</label>
                  <input 
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Nº de compte"
                    className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
            
            <p className="text-[9px] font-bold text-slate-400 text-center">🛡️ Chiffrement de sécurité actif sur les informations bancaires.</p>
          </div>
        </div>
      )}

      {/* ═ Step 5 — Pièce d'identité ═ */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-3xl">🪪</span>
            <h3 className="font-serif text-lg font-black text-[#0c1445] mt-2 mb-1">Validation d'Identité</h3>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">Veuillez soumettre une pièce officielle pour sécuriser la confiance client.</p>
          </div>

          <div className="bg-amber-100 text-amber-900 border border-amber-300/30 rounded-2xl p-4 flex gap-3 shadow-3xs">
            <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-amber-950 flex items-center justify-between">
                <span>Cette étape est optionnelle</span>
                <button 
                  onClick={skipIdentityStep}
                  className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-800 text-[9.5px] font-black uppercase rounded shrink-0 transition"
                >
                  Passer →
                </button>
              </div>
              <p className="text-[10px] leading-relaxed font-semibold text-amber-800 mt-1">
                La non-vérification de pièce implique un gel technique de versement. Vous pourrez téléverser plus tard.
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-3xl p-5 shadow-3xs space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Type de document <span className="text-red-500">*</span></label>
              <select
                value={idType}
                onChange={(e) => {
                  setIdType(e.target.value);
                  if (errors.idType) setErrors(prev => { const n = {...prev}; delete n.idType; return n; });
                }}
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-bold focus:outline-none focus:border-blue-600 ${errors.idType ? 'border-red-500' : 'border-slate-100'}`}
              >
                <option value="">Sélectionner un type...</option>
                <option value="CIN">Carte d'Identité Nationale (CIN/NIF)</option>
                <option value="Passeport">Passeport d'Haïti</option>
                <option value="Permis">Permis de Conduire</option>
              </select>
              {errors.idType && <p className="text-[9.5px] font-bold text-red-600">{errors.idType}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nº de pièce d'identité <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={idNumber}
                onChange={(e) => {
                  setIdNumber(e.target.value);
                  if (errors.idNumber) setErrors(prev => { const n = {...prev}; delete n.idNumber; return n; });
                }}
                placeholder="Ex : CIN-02-01-99-..."
                className={`w-full p-3 border rounded-xl bg-slate-50 focus:bg-white text-xs font-semibold focus:outline-none focus:border-blue-600 ${errors.idNumber ? 'border-red-500' : 'border-slate-100'}`}
              />
              {errors.idNumber && <p className="text-[9.5px] font-bold text-red-600">{errors.idNumber}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Photo Recto de la pièce <span className="text-red-500">*</span></label>
              <div className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 relative overflow-hidden group hover:bg-slate-100/50 transition">
                {idFile ? (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl text-emerald-600">📄</span>
                    <span className="text-[9.5px] font-bold text-emerald-600 mt-1">FICHIER RECTO AJOUTÉ</span>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <UploadCloud size={24} className="text-slate-400 mx-auto" />
                    <span className="block text-[11px] font-bold text-slate-700">Prendre photo CIN</span>
                    <span className="block text-[8.5px] text-slate-400 font-semibold">JPG, PNG, PDF (Max 10 Mo)</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={handleIdUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              {errors.idFile && <p className="text-[9.5px] font-bold text-red-600">{errors.idFile}</p>}
            </div>

            <div className="p-3 bg-teal-50 border border-teal-100/50 text-teal-900 rounded-2xl text-[9.5px] font-semibold leading-relaxed">
              ⚠️ <strong>Luminosité importante :</strong> Veillez à ce que les caractères et vos photos d'aspiration soient visibles et nets, sinon notre service risque de rejeter la conformité.
            </div>
          </div>
        </div>
      )}

      {/* ═ Footer Controls ═ */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t flex justify-between gap-3 shadow-lg z-50 max-w-md mx-auto">
        <button
          type="button"
          disabled={currentStep === 1 || submitting}
          onClick={handleBackStep}
          className="flex-1 py-3 text-xs bg-white text-slate-500 border rounded-xl hover:bg-slate-100 font-extrabold transition uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          <span>Retour</span>
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={handleNextStep}
          className="flex-2 py-3 text-xs bg-[#0c1445] text-white rounded-xl hover:bg-blue-900 font-extrabold transition uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer shadow-sm select-none"
        >
          <span>{currentStep === TOTAL_STEPS ? (submitting ? 'Validation...' : 'Créer ma boutique 🚀') : 'Continuer'}</span>
          {currentStep < TOTAL_STEPS && <ChevronRight size={14} />}
        </button>
      </div>

    </div>
  );
};
