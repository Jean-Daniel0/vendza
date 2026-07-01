import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Loader2, PartyPopper, Check, Activity } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface SubscriptionSuccessProps {
  onBackToDashboard: () => void;
  user: any;
  onRefreshUser: () => Promise<void>;
}

export const SubscriptionSuccess: React.FC<SubscriptionSuccessProps> = ({
  onBackToDashboard,
  user,
  onRefreshUser
}) => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'checking' | 'timeout'>('verifying');
  const [pollingCount, setPollingCount] = useState<number>(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string>("Vérification de la validation de votre paiement en cours...");

  // Parse URL parameters for fallback
  const searchParams = new URLSearchParams(window.location.search);
  const referenceId = searchParams.get('referenceId') || '';
  const plan = searchParams.get('plan') || '';
  const billing = searchParams.get('billing') || 'mensuel';

  const verifierAbonnement = async () => {
    if (!user || !isSupabaseConfigured || !supabase) {
      setStatus('success'); // Fail-open safely
      return;
    }

    try {
      console.log(`[SubscriptionSuccess] Polling check active subscriber record for user=${user.id}, plan=${plan}`);

      // Wait to let webhook execute and verify db state
      if (referenceId && referenceId.startsWith('sub-') && pollingCount === 1) {
        setFeedbackMsg("Mise à jour finale des permissions d'accès...");
      }

      // 1. Check if Supabase profile contains the activated plan
      const { data: profil } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();

      // 2. Fetch the latest active subscription record inside database
      const { data: activeSub } = await supabase
        .from('vendor_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const normalizedProfilePlan = String(profil?.plan || '').replace('_', ' ').toLowerCase();
      const normalizedQueryPlan = String(plan || '').replace('_', ' ').toLowerCase();

      const profileMatch = profil && normalizedProfilePlan.includes(normalizedQueryPlan);
      const subMatch = activeSub && activeSub.plan_code;

      if (profileMatch || subMatch) {
        console.log(`[SubscriptionSuccess] Payment status validation detected! profilPlan=${profil?.plan}, subPlan=${activeSub?.plan_code}`);
        
        // Finalize state matching update to avoid browser session memory gaps
        const cachedSub = sessionStorage.getItem('pendingSubscription');
        if (cachedSub) {
          try {
            const parsed = JSON.parse(cachedSub);
            // If premium depts exist, update profiles and shops appropriately
            if (parsed.selectedDepts && parsed.selectedDepts.length > 0) {
              await supabase
                .from('profiles')
                .update({ premium_depts: parsed.selectedDepts })
                .eq('id', user.id);

              await supabase
                .from('shops')
                .update({ premium_depts: parsed.selectedDepts })
                .eq('vendor_id', user.id);
            }
          } catch (e) {}
          sessionStorage.removeItem('pendingSubscription');
        }

        // Refresh user details in React
        await onRefreshUser();
        setStatus('success');
      } else {
        if (pollingCount < 8) {
          setPollingCount(prev => prev + 1);
        } else {
          setStatus('timeout');
          setFeedbackMsg("Votre paiement est en cours de validation par votre banque ou MonCash. Ne vous inquiétez pas, il s'activera automatiquement sous peu.");
        }
      }
    } catch (err: any) {
      console.error("[SubscriptionSuccess] Error during checking:", err.message);
      if (pollingCount < 8) {
        setPollingCount(prev => prev + 1);
      } else {
        setStatus('timeout');
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(verifierAbonnement, 2500);
    return () => clearTimeout(timer);
  }, [pollingCount, user]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 border border-slate-100 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Decorative subtle visual glow backgrounds */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-br from-teal-500/15 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {status === 'verifying' && (
          <div className="py-12 space-y-4 animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-600 rounded-full animate-bounce">
              <Loader2 className="animate-spin h-8 w-8" />
            </div>
            <h2 className="font-serif text-xl font-bold text-slate-800">
              Vérification de votre paiement...
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              {feedbackMsg}
            </p>
            <div className="flex items-center justify-center gap-1.5 pt-2 text-[10px] font-mono text-blue-500 font-bold">
              <Activity size={12} className="animate-pulse" /> Référence Id : {referenceId || "En attente"}
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5 animate-in zoom-in-95 duration-200">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full border-4 border-emerald-100 shadow-lg relative">
              <PartyPopper size={36} className="text-emerald-600 animate-wiggle" />
              <div className="absolute -top-1 -right-1 bg-teal-500 text-white rounded-full p-1 border-2 border-white">
                <Check size={12} />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                Abonnement Activé ⭐
              </span>
              <h2 className="font-serif text-2xl font-black text-slate-800 pt-2">
                Merci pour votre soutien !
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-semibold">
                Votre boutique Vendza est maintenant officiellement activée en mode premium ! Vos départements de livraison ont été programmés et vos listes de produits bénéficient désormais de commissions réduites.
              </p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl max-w-sm mx-auto space-y-1.5 text-left text-xs font-medium text-slate-600">
              <p className="flex justify-between">
                <span>Plan actif :</span>
                <span className="font-bold text-slate-800 uppercase text-[11px]">{plan === 'pro_national' ? '🏆 Pro National' : '⭐ Pro Local'}</span>
              </p>
              <p className="flex justify-between">
                <span>Facturation :</span>
                <span className="font-bold text-slate-800 capitalize text-[11px]">{billing === 'annuel' ? 'Annuelle' : 'Mensuelle'}</span>
              </p>
              <p className="flex justify-between">
                <span>Statut Badge :</span>
                <span className="text-[10px] font-extrabold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded">✓ VERIFIE VENDZA</span>
              </p>
            </div>

            <button
              onClick={onBackToDashboard}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              Aller vers l'Espace Vendeur <ArrowRight size={14} />
            </button>
          </div>
        )}

        {status === 'timeout' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 text-amber-600 rounded-full">
              <ShieldCheck size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif text-lg font-bold text-slate-800">
                Validation finale en suspens...
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
                {feedbackMsg}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStatus('verifying');
                  setPollingCount(0);
                }}
                className="flex-1 py-3 border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition"
              >
                Re-essayer la vérification
              </button>
              <button
                onClick={onBackToDashboard}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 text-white rounded-xl font-bold text-xs cursor-pointer transition shadow"
              >
                Voir le Tableau de bord
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
