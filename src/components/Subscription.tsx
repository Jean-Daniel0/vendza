import React, { useState, useEffect } from 'react';
import { CreditCard, Check, ShieldCheck, Ticket, DollarSign, Sparkles, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface SubscriptionProps {
  user: UserProfile | null;
  onUpgradePlan: (
    plan: 'Gratuit' | 'Pro Local' | 'Pro National',
    depts?: string[],
    billing?: 'mensuel' | 'annuel',
    amount?: number
  ) => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({
  user,
  onUpgradePlan
}) => {
  const [isAnnual, setIsAnnual] = useState<boolean>(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<'Pro Local' | 'Pro National' | null>(null);
  
  // Modal depts checklist
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [paymentStep, setPaymentStep] = useState<number>(1);
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);

  // Loaded DB active subscription info
  const [currentDbSub, setCurrentDbSub] = useState<any>(null);
  const [loadingDbSub, setLoadingDbSub] = useState<boolean>(false);

  const localPrice = isAnnual ? 3500 : 350; // Annuel = 3500 HTG/an, Mensuel = 350 HTG/mois
  const nationalPrice = isAnnual ? 4990 : 499; // Annuel = 4990 HTG/an, Mensuel = 499 HTG/mois

  const haitianDepts = [
    'Ouest', 'Nord', 'Sud', 'Artibonite', 'Centre', 
    'Nord-Est', 'Nord-Ouest', 'Nippes', 'Sud-Est', "Grand'Anse"
  ];

  // Charger le plan actuel du vendeur
  const chargerPlanActuel = async () => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    setLoadingDbSub(true);
    try {
      const { data: subscription } = await supabase
        .from('vendor_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription) {
        setCurrentDbSub(subscription);
      }
    } catch (err) {
      console.error("Error retrieving active subscription:", err);
    } finally {
      setLoadingDbSub(false);
    }
  };

  useEffect(() => {
    chargerPlanActuel();
  }, [user]);

  if (!user) return null;

  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => {
      if (prev.includes(dept)) {
        return prev.filter(d => d !== dept);
      }
      const quota = selectedPlanModal === 'Pro Local' ? 5 : haitianDepts.length;
      if (prev.length >= quota) {
        alert(`Le plan ${selectedPlanModal} limite à ${quota} départements de livraison.`);
        return prev;
      }
      return [...prev, dept];
    });
  };

  const handleNextStep = () => {
    if (selectedDepts.length === 0) {
      alert('Veuillez sélectionner au moins 1 département de livraison.');
      return;
    }
    setPaymentStep(2);
  };

  const openPlanModal = (plan: 'Pro Local' | 'Pro National') => {
    setSelectedPlanModal(plan);
    setPaymentStep(1);
    const userDepts = user.premiumDepts || [];
    if (user.plan === plan && userDepts.length > 0) {
      setSelectedDepts([...userDepts]);
    } else if (userDepts.length > 0) {
      setSelectedDepts([...userDepts].slice(0, plan === 'Pro Local' ? 5 : 10));
    } else {
      setSelectedDepts([user.departement].filter(Boolean));
    }
  };

  // Payer abonnement avec MonCash
  const payerAbonnementMonCash = async () => {
    if (!selectedPlanModal) return;
    const billingStr = isAnnual ? 'annuel' : 'mensuel';
    const amount = selectedPlanModal === 'Pro Local' ? localPrice : nationalPrice;
    
    // Générer referenceId unique pour cet abonnement
    const referenceId = `sub-${user.id.substring(0, 8)}-${Date.now()}`;

    // Stocker en session
    sessionStorage.setItem('pendingSubscription', JSON.stringify({
      planCode: selectedPlanModal === 'Pro National' ? 'pro_national' : 'pro_local',
      billing: billingStr,
      montant: amount,
      referenceId: referenceId,
      userId: user.id,
      selectedDepts: selectedDepts
    }));

    setLoadingPayment('moncash');

    try {
      console.log(`[Subscription Client] Creating Bazik payment for sub: ${referenceId}`);
      const response = await fetch('/api/bazik/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: referenceId,
          amount: Math.round(amount),
          buyerName: `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Vendeur Vendza',
          buyerEmail: user.email || '',
          description: `Abonnement Vendza ${selectedPlanModal} — ${billingStr}`
        })
      });

      if (!response.ok) {
        throw new Error("Erreur de création de session MonCashConnect");
      }

      const resData = await response.json();
      const actualUrl = resData.paymentUrl || resData.payment_url;

      if (!actualUrl) {
        throw new Error("L'URL de paiement MonCash est absente");
      }

      // Redirect vendor
      window.location.href = actualUrl;
    } catch (err: any) {
      setLoadingPayment(null);
      alert(`Erreur MonCash: ${err.message || 'Impossible de se connecter au service.'}`);
    }
  };

  // Payer abonnement avec Stripe
  const payerAbonnementStripe = async () => {
    if (!selectedPlanModal) return;
    const billingStr = isAnnual ? 'annuel' : 'mensuel';
    const amount = selectedPlanModal === 'Pro Local' ? localPrice : nationalPrice;
    
    const referenceId = `sub-${user.id.substring(0, 8)}-${Date.now()}`;

    // Stocker en session
    sessionStorage.setItem('pendingSubscription', JSON.stringify({
      planCode: selectedPlanModal === 'Pro National' ? 'pro_national' : 'pro_local',
      billing: billingStr,
      montant: amount,
      referenceId: referenceId,
      userId: user.id,
      selectedDepts: selectedDepts
    }));

    setLoadingPayment('stripe');

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          referenceId: referenceId,
          planCode: selectedPlanModal === 'Pro National' ? 'pro_national' : 'pro_local',
          billing: billingStr,
          userId: user.id,
          customerEmail: user.email,
          items: [{
            name: `Abonnement Vendza — ${selectedPlanModal} (${billingStr === 'annuel' ? 'Annuel' : 'Mensuel'})`,
            description: `Accès vendeur privilège avec commission réduite et boost visibilité.`,
            price: amount,
            quantity: 1,
            image_url: null
          }],
          successUrl: `${window.location.origin}/paiement/abonnement/succes?referenceId=${referenceId}&plan=${selectedPlanModal === 'Pro National' ? 'pro_national' : 'pro_local'}&billing=${billingStr}`,
          cancelUrl: `${window.location.origin}`
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Erreur communication Stripe session");
      }

      const { url } = await response.json();
      if (!url) {
        throw new Error("L'URL de redirection Stripe est manquante");
      }

      window.location.href = url;
    } catch (err: any) {
      setLoadingPayment(null);
      alert(`Erreur Stripe: ${err.message || 'Impossible d\'initialiser Stripe.'}`);
    }
  };

  const formattedExpiresAt = () => {
    if (!currentDbSub?.expires_at && !user.planExpiresAt) return null;
    const rawDate = currentDbSub?.expires_at || user.planExpiresAt;
    try {
      return new Date(rawDate).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Title */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 border border-teal-100 text-teal-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest sm:text-xs">
          <Sparkles size={12} className="animate-pulse" /> Développez votre Chiffre d'Affaires
        </span>
        <h1 className="font-serif text-xl sm:text-3xl font-extrabold text-slate-800 leading-tight">
          Choisissez votre plan vendeur
        </h1>
        <p className="text-xs text-[#5a6480] max-w-sm mx-auto leading-relaxed">
          Badge "Vérifié", couverture élargie aux provinces, et commission réduite pour booster vos revenus.
        </p>
      </div>

      {/* Bill Switch */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-xs font-bold ${!isAnnual ? 'text-blue-600' : 'text-slate-400'}`}>Mensuel</span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={`w-11 h-6 rounded-full relative transition-colors ${isAnnual ? 'bg-teal-600' : 'bg-slate-300'} cursor-pointer`}
          aria-label="Basculer facturation annuelle"
        >
          <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all text-xs flex items-center justify-center font-bold ${isAnnual ? 'right-0.5' : 'left-0.5'}`} />
        </button>
        <span className={`text-xs font-bold ${isAnnual ? 'text-teal-600' : 'text-slate-400'}`}>Annuel</span>
        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Économie -17%</span>
      </div>

      {/* Current Active Plan summary card */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-500/20 to-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-teal-400 tracking-widest uppercase">Abonnement Actuellement Actif</span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-serif">
                {user.plan === 'Pro National' || user.plan === 'pro_national' ? '🏆 Pro National' : user.plan === 'Pro Local' || user.plan === 'pro_local' ? '⭐ Pro Local' : '📦 Plan de base (Gratuit)'}
              </h2>
              <span className="text-[9px] bg-white/10 text-white border border-white/20 px-2.5 py-0.5 rounded-full font-bold">
                Actif
              </span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              {user.plan === 'Pro National' || user.plan === 'pro_national'
                ? "Vous bénéficiez d'une couverture nationale intégrale en Haïti. Votre badge ⭐ Vedette est affiché partout." 
                : user.plan === 'Pro Local' || user.plan === 'pro_local'
                  ? "Vous livrez régionalement dans vos départements sélectionnés. Votre commission est réduite à 15% !" 
                  : "Votre visibilité et vos zones de livraison sont limitées. Mettez à niveau pour réduire vos commissions."}
            </p>

            {formattedExpiresAt() && (
              <p className="text-[10px] text-teal-300 font-mono">
                📅 Date d'expiration ou renouvellement : <strong>{formattedExpiresAt()}</strong>
              </p>
            )}
          </div>

          <div className="shrink-0 bg-white/5 border border-white/10 p-3 rounded-xl text-center flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Zone Principale</span>
            <span className="text-xs font-black text-white block mt-0.5">{user.departement || "Ouest"} / {user.commune || "Pétion-Ville"}</span>
          </div>
        </div>

        {/* Selected departments listed block */}
        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
            Zones de livraison couvertes :
          </span>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {user.plan === 'Pro National' || user.plan === 'pro_national' ? (
              haitianDepts.map(dept => (
                <span key={dept} className="text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-md shadow-2xs">
                  ✓ {dept}
                </span>
              ))
            ) : user.plan === 'Pro Local' || user.plan === 'pro_local' ? (
              user.premiumDepts && user.premiumDepts.length > 0 ? (
                user.premiumDepts.map(dept => (
                  <span key={dept} className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-md shadow-2xs">
                    ✓ {dept}
                  </span>
                ))
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md shadow-2xs">
                  ✓ {user.departement || 'Ouest'} (Département d'origine)
                </span>
              )
            ) : (
              <span className="text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-md">
                ✓ {user.departement || 'Ouest'} (Limite plan gratuit)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plans List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-slate-800">
        {/* Gratuit Plan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="font-serif text-sm font-bold text-slate-800">Plan de base</h3>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Gratuit</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-slate-800">
              0 HTG <span className="text-xs font-sans font-medium text-slate-400">/ mois</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">Idéal pour tester Vendza et vendre quelques objets d'occasion.</p>
            <div className="h-px bg-slate-100" />
            <div className="space-y-2 text-xs text-slate-500 font-medium">
              <p className="flex items-center gap-2"><Check size={13} className="text-emerald-500" /> 1 département de livraison ({user.departement || 'Ouest'})</p>
              <p className="flex items-center gap-2 animate-pulse"><Check size={13} className="text-emerald-500" /> Commission standard : <strong>20%</strong></p>
              <p className="flex items-center gap-2 text-slate-300">✕ Badge Vérifié non disponible</p>
            </div>
          </div>
          <button
            onClick={() => {
              onUpgradePlan('Gratuit', [user.departement || 'Ouest'], 'mensuel', 0);
              alert('Plan Gratuit activé avec succès');
            }}
            disabled={user.plan === 'Gratuit' || !user.plan}
            className={`w-full py-2 font-bold text-xs rounded-xl border transition cursor-pointer ${
              user.plan === 'Gratuit' || !user.plan
                ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
            }`}
          >
            {user.plan === 'Gratuit' || !user.plan ? 'Votre plan actuel' : 'Repasser au Plan gratuit'}
          </button>
        </div>

        {/* Pro Local Plan */}
        <div className="bg-white border-2 border-blue-400 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-md">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="font-serif text-sm font-bold text-blue-900">Pro Local</h3>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Populaire</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-blue-600">
              {isAnnual ? '3 500 HTG' : '350 HTG'} <span className="text-xs font-sans font-medium text-slate-400">/{isAnnual ? 'an' : 'mois'}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">Couverture régionale supérieure pour les marchands en province.</p>
            <div className="h-px bg-slate-100" />
            <div className="space-y-2 text-xs text-slate-600 font-bold">
              <p className="flex items-center gap-2"><Check size={13} className="text-blue-600" /> 5 départements de livraison</p>
              <p className="flex items-center gap-2"><Check size={13} className="text-blue-600" /> Commission réduite à <strong>15%</strong></p>
              <p className="flex items-center gap-2"><Check size={13} className="text-blue-600" /> Badge Vendeur Vérifié & Priorité</p>
            </div>
          </div>
          <button
            onClick={() => openPlanModal('Pro Local')}
            className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-md transition cursor-pointer ${
              user.plan === 'Pro Local' || user.plan === 'pro_local'
                ? 'bg-blue-100 hover:bg-blue-200 text-blue-800' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {user.plan === 'Pro Local' || user.plan === 'pro_local' ? 'Gérer / Modifier l\'abonnement' : 'Choisir Pro Local'}
          </button>
        </div>

        {/* Pro National Plan */}
        <div className="bg-white border-2 border-teal-500 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-md">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="font-serif text-sm font-bold text-teal-900">Pro National</h3>
              <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">élite</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-teal-700">
              {isAnnual ? '4 990 HTG' : '499 HTG'} <span className="text-xs font-sans font-medium text-slate-400">/{isAnnual ? 'an' : 'mois'}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">Pour les grandes enseignes couvrant tout le territoire national.</p>
            <div className="h-px bg-slate-100" />
            <div className="space-y-2 text-xs text-slate-600 font-bold">
              <p className="flex items-center gap-2"><Check size={13} className="text-teal-600" /> Tous les départements (Haïti entier)</p>
              <p className="flex items-center gap-2"><Check size={13} className="text-teal-600" /> Commission ultra réduite : <strong>10%</strong></p>
              <p className="flex items-center gap-2"><Check size={13} className="text-teal-600" /> Badge Or Vedette & visibilité maximale</p>
            </div>
          </div>
          <button
            onClick={() => openPlanModal('Pro National')}
            className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-md transition cursor-pointer ${
              user.plan === 'Pro National' || user.plan === 'pro_national'
                ? 'bg-teal-100 hover:bg-teal-200 text-teal-850' 
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            {user.plan === 'Pro National' || user.plan === 'pro_national' ? 'Gérer / Modifier l\'abonnement' : 'Choisir Pro National'}
          </button>
        </div>
      </div>

      {/* Multi-step subscription payment modal */}
      {selectedPlanModal && (
        <div id="modal-paiement-sub" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
            {/* Header step modal */}
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Activer le plan {selectedPlanModal}</h3>
                <p className="text-xs text-slate-500">Étape {paymentStep} de 2</p>
              </div>
              <button 
                onClick={() => setSelectedPlanModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer transition p-1"
              >
                ✕
              </button>
            </div>

            {paymentStep === 1 ? (
              <div className="space-y-4 text-xs text-slate-700">
                <p className="font-bold text-slate-800 text-sm">1. Définissez vos départements autorisés à la livraison :</p>
                <p className="text-[11px] text-slate-400">
                  Sélectionnez les départements où vos clients pourront commander vos produits directs en livraison sécurisée.
                </p>

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-200 p-3 rounded-xl bg-slate-50 font-medium">
                  {haitianDepts.map(d => {
                    const isSelected = selectedDepts.includes(d);
                    return (
                      <div
                        key={d}
                        onClick={() => toggleDept(d)}
                        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 cursor-pointer select-none transition-all ${
                          isSelected ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span>{d}</span>
                        {isSelected && <Check size={11} className="text-blue-600" />}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[11px] font-bold text-slate-500 pt-1">
                  <span>Quota choisi : {selectedDepts.length} / {selectedPlanModal === 'Pro Local' ? 5 : haitianDepts.length}</span>
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition cursor-pointer shadow-md"
                >
                  Continuer avec le paiement
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-700">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-center">
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full font-bold uppercase tracking-widest">
                    Récapitulatif Forfait
                  </span>
                  <p className="font-serif text-lg font-black text-slate-900 mt-2">
                    {isAnnual ? `${localPrice.toLocaleString()} HTG / an` : `${localPrice.toLocaleString()} HTG / mois`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Abonnement {selectedPlanModal} ({isAnnual ? 'Facturation Annuelle' : 'Facturation Mensuelle'})
                  </p>
                  <p className="text-[11px] text-emerald-600 font-bold">
                    ✓ Commission réduite à {selectedPlanModal === 'Pro National' ? '10%' : '15%'}
                  </p>
                </div>

                <p className="font-bold text-slate-800 text-sm">2. Sélectionnez votre méthode de paiement :</p>

                <div className="space-y-3">
                  {/* MonCash payment option */}
                  <button
                    onClick={payerAbonnementMonCash}
                    disabled={loadingPayment !== null}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-[#cc0612] hover:bg-[#b0050f] disabled:opacity-50 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                  >
                    {loadingPayment === 'moncash' ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Connexion MonCash...
                      </>
                    ) : (
                      <>
                        <Smartphone size={15} />
                        Payer avec MonCash
                      </>
                    )}
                  </button>

                  {/* Stripe payment option */}
                  <button
                    onClick={payerAbonnementStripe}
                    disabled={loadingPayment !== null}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#635bff] hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01]"
                  >
                    {loadingPayment === 'stripe' ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5" />
                        Connexion Stripe...
                      </>
                    ) : (
                      <>
                        <CreditCard size={15} />
                        Payer par carte
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-1">
                  🔒 Paiement crypté 100% sécurisé direct ou via séquestre SSL.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStep(1)}
                    disabled={loadingPayment !== null}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-50 transition"
                  >
                    ← Retour
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
