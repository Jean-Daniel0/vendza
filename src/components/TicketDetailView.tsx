import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Printer, ShieldCheck, Tag, Info, 
  MapPin, User, Calendar, Check, Send, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Order, UserProfile } from '../types';
import { QRCodeRenderer } from './QRCodeRenderer';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { parseOrderContacts } from '../lib/contacts';

import { EIcon } from './EIcon';
interface TicketDetailViewProps {
  order: Order;
  user: UserProfile | null;
  onBack: () => void;
  onConfirmDelivery?: (orderId: string, code?: string) => Promise<{ success: boolean; message: string }> | void;
  onNavigate?: (view: string) => void;
}


// Bande de barres décorative dérivée de la référence (aspect ticket de caisse ; le vrai contrôle se fait par le QR code)
const BarcodeStrip: React.FC<{ value: string }> = ({ value }) => {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 56; i++) {
    const c = value.charCodeAt(i % value.length) + i * 7;
    const w = 1 + (c % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + (i % 2 === 1 ? 0 : 0);
  }
  return (
    <svg viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className="mx-auto mt-2 h-10 w-full max-w-[260px]" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={40} fill="#111" />)}
    </svg>
  );
};

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  order,
  user,
  onBack,
  onConfirmDelivery,
  onNavigate
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [clientProfil, setClientProfil] = useState<any>(null);
  const [vendeurProfil, setVendeurProfil] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!showInfo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowInfo(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInfo]);

  const isBuyer = user?.id === order.clientId;
  const isVendor = !isBuyer;

  useEffect(() => {
    async function loadProfiles() {
      if (!isSupabaseConfigured || !supabase) return;
      setLoading(true);
      try {
        // Téléphones : seulement l'acheteur et le vendeur de cette commande les reçoivent (fonction SQL protégée)
        let gotContacts = false;
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_order_contacts', { p_order_id: order.id });
        if (!rpcErr) {
          const contacts = parseOrderContacts(rpcData);
          if (contacts.buyer) setClientProfil(contacts.buyer);
          if (contacts.vendor) setVendeurProfil(contacts.vendor);
          gotContacts = !!(contacts.buyer || contacts.vendor);
        }
        if (!gotContacts) {
          // Repli : noms et photo seulement (vue publique), sans téléphone
          const buyerId = order.clientId || (order as any).buyer_id;
          if (buyerId) {
            const { data: clientData } = await supabase.from('profiles_public').select('prenom, nom, avatar_url').eq('id', buyerId).maybeSingle();
            if (clientData) setClientProfil(clientData);
          }
          const vendorId = (order as any).vendor_id || order.items[0]?.vendeurId;
          if (vendorId) {
            const { data: vendorData } = await supabase.from('profiles_public').select('prenom, nom').eq('id', vendorId).maybeSingle();
            if (vendorData) setVendeurProfil(vendorData);
          }
        }
      } catch (err) {
        console.error("Error loading profiles for ticket:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfiles();
  }, [order.id, order.clientId, order.items]);

  const nomClient = clientProfil?.prenom 
    ? `${clientProfil.prenom} ${clientProfil.nom || ''}`.trim()
    : (order.clientNom || 'Client');

  const telClient = clientProfil?.telephone 
    || order.clientTel
    || 'Non renseigné';

  const nomVendeur = vendeurProfil?.prenom
    ? `${vendeurProfil.prenom} ${vendeurProfil.nom || ''}`.trim()
    : 'Vendeur';

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    window.print();
  };

  const handleReleaseFunds = async () => {
    if (!onConfirmDelivery) return;
    setIsConfirming(true);
    try {
      const result: any = await onConfirmDelivery(order.id);
      if (result && result.success === false) {
        setActionMessage(`Erreur: ${result.message}`);
      } else {
        setActionMessage(`${result?.message || 'Réception confirmée. Le versement au vendeur est en cours.'}`);
      }
    } catch (e: any) {
      setActionMessage(`Erreur: ${e.message || 'Impossible de valider la livraison'}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed bottom-5 right-5 z-60 bg-blue-900 border border-teal-500 text-teal-300 font-bold text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <ShieldCheck size={14} className="text-teal-400" strokeWidth={3} />
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage('')} className="ml-2 hover:text-white shrink-0"><EIcon name="X" /></button>
        </div>
      )}


      {/* Fenêtre d'informations (bouton « ! ») : tout ce qui était dans l'ancienne « feuille de route de sécurité » */}
      {showInfo && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Informations sur la commande" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowInfo(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans" style={{ maxHeight: 'min(88dvh, 640px)' }}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 min-w-0">
                <ShieldCheck size={16} className="text-teal-600 shrink-0" />
                <span className="truncate">Sécurité de la commande</span>
              </h2>
              <button type="button" aria-label="Fermer" onClick={() => setShowInfo(false)} className="shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"><EIcon name="X" /></button>
            </div>

            <div className="px-4 py-3 space-y-3 overflow-y-auto text-[12px] leading-relaxed text-slate-600">
              <div className="flex justify-center">
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                  order.status === 'livree' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {order.status === 'livree' ? 'Livraison validée' : 'Fonds en séquestre'}
                </span>
              </div>

              <section className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-800">Fonctionnement du séquestre</h3>
                <p>
                  {isBuyer
                    ? "Vos Gourdes restent en sécurité chez Vendza. Une fois les marchandises examinées et acceptées en mains propres, cliquez sur « Confirmer la réception » pour libérer le paiement au vendeur."
                    : "Les fonds ont été déposés par l'acheteur et sont garantis. Ils vous seront versés dès que l'acheteur confirme la réception du colis."}
                </p>
              </section>

              <section className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-800">Colis sécurisé</h3>
                <p>
                  {isBuyer
                    ? "Le paiement n'est transmis au vendeur qu'après votre confirmation de réception."
                    : "Le code QR officiel de déblocage est affiché sur le ticket de la commande."}
                </p>
                <p className="text-[11px] text-slate-500 pt-0.5">Référence : <span className="font-mono font-bold text-slate-800 break-all">{order.id.toUpperCase()}</span></p>
              </section>

              {isBuyer && order.status !== 'livree' && (
                <div className="flex items-start gap-2 text-[11px] text-red-600 font-semibold bg-red-50 border border-red-100 p-2.5 rounded-xl">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>N'appuyez sur « Confirmer la réception » que si vous avez le colis en main et l'avez vérifié.</span>
                </div>
              )}
              {isVendor && order.status !== 'livree' && (
                <p className="text-[11px] text-slate-500 font-semibold text-center">En attente de la confirmation de l'acheteur pour le versement.</p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowInfo(false)} className="w-full py-2.5 rounded-xl bg-[#0c1445] hover:bg-[#1a255c] text-white text-xs font-bold cursor-pointer">Compris</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Primary Header/Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-150 pb-5 gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 py-1.5 bg-[#f1f5f9] hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black tracking-wide transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-3xs"
          >
            <ArrowLeft size={13} strokeWidth={2.5} />
            <span>RETOUR</span>
          </button>
          
          <div className="h-5 w-px bg-slate-200" />
          
          <div>
            <h1 className="font-serif text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <EIcon name="Ticket" /> Billet de Garde & Reçu Officiel
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">
              Plateforme Mandataire Séquestre Vendza
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <div>
            <button
              type="button"
              aria-label="Informations sur le séquestre"
              aria-expanded={showInfo}
              onClick={() => setShowInfo(v => !v)}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-base font-black transition cursor-pointer border border-slate-200 shadow-3xs flex items-center justify-center"
            >
              !
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200 shadow-3xs"
          >
            <Printer size={13} strokeWidth={2.5} />
            <span>Imprimer</span>
          </button>
          <button
            onClick={onBack}
            className="text-[10px] uppercase font-black px-4 py-3 text-white bg-[#0c1445] rounded-xl hover:bg-[#1a255c] transition text-center border border-slate-900 cursor-pointer shadow-sm"
          >
            Fermer l'onglet
          </button>
        </div>
      </div>

      {/* Ticket centré (une seule colonne) */}
      <div className="max-w-[480px] mx-auto space-y-4">
          <div className="bg-slate-100 rounded-3xl p-4 sm:p-8 print:p-0 print:bg-white">
          <div id="printable-ticket">
            <div className="mx-auto w-full max-w-[380px] text-slate-900 drop-shadow-md print:drop-shadow-none" style={{ fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
              {/* Bord dentelé du haut */}
              <svg className="block w-full h-2" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <pattern id="zig-top" width="10" height="8" patternUnits="userSpaceOnUse">
                    <polygon points="0,8 5,0 10,8" fill="#fff" />
                  </pattern>
                </defs>
                <rect width="100%" height="8" fill="url(#zig-top)" />
              </svg>

              <div className="bg-white px-7 py-6 text-[13px] leading-snug">
                {/* En-tête */}
                <div className="text-center">
                  <div className="text-lg tracking-wide">REÇU DE COMMANDE</div>
                  <div className="text-[11px] tracking-widest">*****</div>
                  <div className="text-2xl mt-1 font-medium">Vendza</div>
                  <div className="text-[12px]">Paiement sécurisé · Séquestre</div>
                  <div className="text-[11px] tracking-widest">*****</div>
                </div>

                {/* Infos */}
                <dl className="mt-4 space-y-0.5">
                  <div className="flex gap-2"><dt className="w-20 shrink-0">Date :</dt><dd>{order.date} {order.heure}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0">Commande :</dt><dd className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0">Client :</dt><dd className="min-w-0 break-words">{nomClient}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0">Vendeur :</dt><dd className="min-w-0 break-words">{nomVendeur}</dd></div>
                  <div className="flex gap-2"><dt className="w-20 shrink-0">Livraison :</dt><dd className="min-w-0 break-words">{[order.commune, order.departement].filter(Boolean).join(', ') || '—'}</dd></div>
                  {isVendor && telClient !== 'Non renseigné' && (
                    <div className="flex gap-2"><dt className="w-20 shrink-0">Tél client :</dt><dd className="font-mono">{telClient}</dd></div>
                  )}
                  {isBuyer && vendeurProfil?.telephone && (
                    <div className="flex gap-2"><dt className="w-20 shrink-0">Tél vendeur :</dt><dd className="font-mono">{vendeurProfil.telephone}</dd></div>
                  )}
                </dl>

                <div className="my-3 border-t-[3px] border-double border-slate-800" />

                {/* Produits : le ticket s'allonge avec le nombre de produits */}
                <ul className="space-y-1.5">
                  {order.items.map((item, idx) => {
                    const variant = [item.couleur, item.taille].filter(Boolean).join(' · ');
                    return (
                      <li key={idx}>
                        <div className="flex justify-between gap-3">
                          <span className="min-w-0 break-words"># {item.productNom}</span>
                          <span className="shrink-0 tabular-nums">{((item.prix || 0) * item.qte).toLocaleString('fr-FR')}</span>
                        </div>
                        {(item.qte > 1 || variant) && (
                          <div className="pl-3 text-[11px] text-slate-500">
                            {item.qte > 1 && <span>{item.qte} × {(item.prix || 0).toLocaleString('fr-FR')}</span>}
                            {item.qte > 1 && variant && <span> · </span>}
                            {variant && <span>{variant}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="my-3 border-t-2 border-dashed border-slate-800" />

                {/* Totaux */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Sous-total</span>
                    <span className="tabular-nums">{order.items.reduce((s, i) => s + (i.prix || 0) * i.qte, 0).toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Livraison</span>
                    <span className="tabular-nums">{order.fraisLivraison ? Number(order.fraisLivraison).toLocaleString('fr-FR') : 'Gratuit'}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Réduction</span>
                      <span className="tabular-nums">-{Number(order.discount).toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline font-bold text-base pt-1">
                    <span>Total (Gdes)</span>
                    <span className="tabular-nums">{order.total.toLocaleString('fr-FR')}</span>
                  </div>
                </div>

                <div className="my-3 border-t-2 border-dashed border-slate-800" />

                {/* Paiement et statut */}
                <div className="space-y-0.5">
                  {order.paymentMethod && (
                    <div className="flex justify-between"><span>Paiement :</span><span>{order.paymentMethod}</span></div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Statut :</span>
                    <span>{order.status === 'livree' ? 'LIVRÉ' : 'FONDS EN SÉQUESTRE'}</span>
                  </div>
                </div>

                {/* QR de validation : vendeur seulement */}
                {isVendor && (
                  <div className="mt-4 flex flex-col items-center text-center gap-1.5">
                    <QRCodeRenderer value={`https://www.vendza.store/?order=${order.id}`} size={120} />
                    <p className="text-[11px] leading-snug max-w-[260px]">
                      Code de validation de la commande.
                    </p>
                  </div>
                )}

                <div className="mt-5 text-center">
                  <div className="font-bold tracking-wide">MERCI !</div>
                  <BarcodeStrip value={order.id} />
                  <div className="font-mono text-[10px] tracking-widest mt-1 break-all">{order.id.toUpperCase()}</div>
                </div>
              </div>

              {/* Bord dentelé du bas */}
              <svg className="block w-full h-2" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <pattern id="zig-bottom" width="10" height="8" patternUnits="userSpaceOnUse">
                    <polygon points="0,0 5,8 10,0" fill="#fff" />
                  </pattern>
                </defs>
                <rect width="100%" height="8" fill="url(#zig-bottom)" />
              </svg>
            </div>
          </div>
          </div>

          {/* Statut + action de l'acheteur sous le ticket */}
          <div className="print:hidden space-y-3">
            <div className="flex justify-center">
              <span className={`text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full border shadow-3xs ${
                order.status === 'livree'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                {order.status === 'livree' ? <><EIcon name="CheckCircle2" /> LIVRAISON VALIDÉE</> : <><EIcon name="Hourglass" /> FONDS EN SÉQUESTRE</>}
              </span>
            </div>

            {isBuyer && order.status !== 'livree' && onConfirmDelivery && (
              <div className="space-y-2">
                <button
                  disabled={isConfirming}
                  onClick={handleReleaseFunds}
                  className="w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  {isConfirming ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                  <span>Confirmer la réception (Débloquer fonds)</span>
                </button>
                <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold bg-red-50 border border-red-150 p-2 rounded-xl">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>N'appuyez que si vous êtes en possession physique du colis vérifié.</span>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};
