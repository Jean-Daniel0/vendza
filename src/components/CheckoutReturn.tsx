import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';

interface CheckoutReturnProps {
  onGoHome: () => void;
  onGoToOrders: () => void;
  isSupabaseConfigured: boolean;
  supabase: any;
  clearCart: () => void;
  onViewTicket?: (orderId: string) => void;
}

export const CheckoutReturn: React.FC<CheckoutReturnProps> = ({
  onGoHome,
  onGoToOrders,
  isSupabaseConfigured,
  supabase,
  clearCart,
  onViewTicket,
}) => {
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout'>('pending');
  const [reference, setReference] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<boolean>(false);

  useEffect(() => {
    // 1. Parse query parameters from URL
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('reference') || params.get('orderId') || params.get('referenceId');
    const errParam = params.get('error');
    const cancelledParam = params.get('cancelled');

    setReference(refParam);

    if (cancelledParam === 'true' || cancelledParam === '1') {
      setStatus('cancelled');
      return;
    }

    if (errParam) {
      setStatus('failed');
      setErrorMessage(errParam);
      return;
    }

    if (!refParam) {
      setStatus('failed');
      setErrorMessage("Référence de paiement manquante dans l'URL.");
      return;
    }

    // 2. Start Polling the status of MonCashConnect (webhook fallback)
    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 30; // 30 attempts * 3 seconds = 90 seconds
    const intervalMs = 3000;

    // We clear client-side cart on success detection so they don't buy again
    const handleSuccess = (payAmount: number) => {
      setAmount(payAmount);
      setStatus('completed');
      clearCart();

      if (refParam.startsWith('sub-')) {
        setRedirecting(true);
        setTimeout(() => {
          if (isMounted) {
            const planCode = refParam.includes('pro_national') ? 'pro_national' : 'pro_local';
            window.location.href = `/paiement/abonnement/succes?referenceId=${refParam}&plan=${planCode}&billing=mensuel`;
          }
        }, 2200);
        return;
      }

      // Trigger auto-redirection to order ticket after a 2.5s delay to let the user see the animation
      if (onViewTicket) {
        setRedirecting(true);
        setTimeout(() => {
          if (isMounted) {
            onViewTicket(refParam);
          }
        }, 2500);
      }
    };

    const pollPaymentStatus = async () => {
      if (!isMounted) return;

      try {
        pollCount++;
        setAttempts(pollCount);

        // Check if DB order row has been created by the webhook in the meantime
        if (isSupabaseConfigured && supabase) {
          const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
          let orClause = '';
          if (isUuid(refParam)) {
            orClause = `id.eq.${refParam},qr_token.eq.${refParam},qr_token.like.${refParam}_sub_%`;
          } else {
            orClause = `qr_token.eq.${refParam},stripe_session_id.eq.${refParam},qr_token.like.${refParam}_sub_%`;
          }

          if (refParam.startsWith('BZK_')) {
            orClause += `,stripe_session_id.eq.${refParam}`;
          }

          const { data: ords } = await supabase
            .from('orders')
            .select('id, total_price')
            .or(orClause);

          if (ords && ords.length > 0) {
            console.log('[Payment Polling Status] Found finalized order(s) in Supabase database:', ords);
            const totalSum = ords.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
            handleSuccess(totalSum);
            return;
          }
        }

        // If we reached max attempts, declare timeout
        if (pollCount >= maxPolls) {
          setStatus('timeout');
        } else {
          // Schedule next poll
          setTimeout(pollPaymentStatus, intervalMs);
        }
      } catch (err: any) {
        console.warn('[Payment Polling Error] Attempt failed:', err.message);
        if (pollCount >= maxPolls) {
          setStatus('timeout');
        } else {
          setTimeout(pollPaymentStatus, intervalMs);
        }
      }
    };

    // Execute first poll immediately
    pollPaymentStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center"
      >
        {status === 'pending' && (
          <div className="space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute animate-ping h-16 w-16 rounded-full bg-[#e2001a]/10 opacity-75"></div>
              <div className="relative rounded-full bg-[#e2001a]/5 p-5">
                <Loader2 className="h-10 w-10 text-[#e2001a] animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vérification du paiement</h1>
              <p className="text-slate-500 text-sm leading-relaxed px-2">
                Nous vérifions le statut de votre transaction MonCash en temps réel. Ne fermez pas cette page.
              </p>
            </div>

            {/* Micro Stepper stats */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Référence</span>
                <span className="font-mono text-slate-700 font-bold">{reference || '...'}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#e2001a] transition-all duration-300"
                  style={{ width: `${Math.min(100, (attempts / 30) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Validation en cours...</span>
                <span>Tentative {attempts}/30</span>
              </div>
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-emerald-50 p-5 text-emerald-500">
                <CheckCircle2 className="h-14 w-14" />
              </div>
            </div>
            
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                Paiement Réussi • Sandbox
              </span>
              <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">Félicitations!</h1>
              <p className="text-slate-500 text-sm">
                {redirecting 
                  ? (reference?.startsWith('sub-') ? "Redirection automatique vers votre espace Vendeur Premium..." : "Redirection automatique vers votre reçu de commande...")
                  : (reference?.startsWith('sub-') ? "Votre abonnement Vendeur Premium Vendza a été activé avec succès !" : "Votre transaction MonCash a été validée avec succès.")}
              </p>
            </div>

            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 space-y-2 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">ID de transaction</span>
                <span className="font-mono text-slate-700 font-bold">{reference}</span>
              </div>
              {amount !== null && amount > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-emerald-100">
                  <span className="text-slate-400">Montant payé</span>
                  <span className="font-bold text-slate-900">{amount.toLocaleString()} HTG</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  if (reference?.startsWith('sub-')) {
                    const planCode = reference.includes('pro_national') ? 'pro_national' : 'pro_local';
                    window.location.href = `/paiement/abonnement/succes?referenceId=${reference}&plan=${planCode}&billing=mensuel`;
                  } else if (onViewTicket && reference) {
                    onViewTicket(reference);
                  } else {
                    onGoToOrders();
                  }
                }}
                className="w-full flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white bg-slate-900 hover:bg-slate-850 font-semibold transition-all shadow-md text-sm cursor-pointer animate-pulse"
              >
                {redirecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  reference?.startsWith('sub-') ? (
                    <>
                      Activer Espace Premium
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Suivre Commande
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )
                )}
              </button>
              <button
                onClick={onGoHome}
                className="w-full flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition-all text-sm cursor-pointer"
              >
                Page d'accueil
              </button>
            </div>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-amber-50 p-5 text-amber-500">
                <AlertTriangle className="h-14 w-14" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                Paiement Annulé
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Achat interrompu</h1>
              <p className="text-slate-500 text-sm">
                Vous avez annulé la transaction lors de la saisie sur la passerelle MonCash.
              </p>
            </div>

            {reference && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Référence</span>
                  <span className="font-mono text-slate-700">{reference}</span>
                </div>
              </div>
            )}

            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={onGoHome}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white bg-[#e2001a] hover:bg-[#c40016] font-semibold transition-all shadow-md text-sm cursor-pointer"
              >
                Retourner à la boutique
              </button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-red-50 p-5 text-red-500">
                <XCircle className="h-14 w-14" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                Paiement Échoué
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Erreur de transaction</h1>
              <p className="text-slate-500 text-sm px-2">
                {errorMessage || "Nous n'avons pas pu valider votre paiement MonCash pour le moment."}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={onGoHome}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white bg-slate-900 hover:bg-slate-850 font-semibold transition-all shadow-md text-sm cursor-pointer"
              >
                Réessayer le paiement
              </button>
            </div>
          </div>
        )}

        {status === 'timeout' && (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-slate-100 p-5 text-slate-500">
                <Loader2 className="h-14 w-14" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Expiration Délai Webhook
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Délai dépassé</h1>
              <p className="text-slate-500 text-sm leading-relaxed px-2">
                Le traitement de la transaction prend un peu plus de temps que prévu. Ne vous inquiétez pas, si votre compte MonCash a été débité, la commande sera validée en arrière-plan sous peu.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onGoToOrders}
                className="w-full flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white bg-slate-900 hover:bg-slate-850 font-semibold transition-all shadow-md text-sm cursor-pointer"
              >
                Mes Commandes
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onGoHome}
                className="w-full flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition-all text-sm cursor-pointer"
              >
                Boutique
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
